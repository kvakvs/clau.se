---
source: docs/runtime.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 2cf400ead0e2884a583331bb170855aa26c0961dcb974a1e54e32894bebbdbcf
translatedAt: 2026-10-26
---
# Runtime

`clause_runtime` est une bibliothèque C++23 sans LLVM. Elle possède les
contextes, les tas de processus, les atomes, les modules chargés et la gestion
du cycle de vie, et exécute les processus Erlang sur des workers de
l'ordonnanceur ([processus](processes.md)). Toutes les API sont internes au
projet ; les appels de l'hôte doivent être sérialisés par runtime et ne pas
chevaucher l'exécution d'un programme, dont les workers se synchronisent entre
eux ([threads](#threads)).

## Édition de liens

Lier exactement un runtime compilé pour la cible via
`Clause::generated_program` :

```cmake
add_executable(harness harness.cpp)
target_link_libraries(harness PRIVATE Clause::generated_program)
```

Cela apporte l'archive, les en-têtes ABI/runtime et C++23, mais pas LLVM.
[link_consumer.cpp](../tests/runtime/link_consumer.cpp) montre un cycle de vie
complet.

## Cycle de vie

[runtime.hpp](../runtime/include/clause/runtime/runtime.hpp) :

- `Runtime::start(options)` → `std::expected<std::unique_ptr<Runtime>, Status>`.
  Valeurs par défaut : version actuelle de l'ABI et largeur de terme native,
  `max_atoms` 2^20 (au plus 2^26 ; les programmes le fixent avec
  `--max-atoms`, [options du runtime](executables.md#runtime-options)). Le
  nombre de contextes n'est pas limité. `process_heap` et `process_stack` sont
  les options des contextes créés par `create_context()` ;
  `memory_limit_bytes` est la
  [limite optionnelle à l'échelle du runtime](runtime-heap.md#runtime-memory-limit),
  rapportée par `memory_bytes()`. Aucune n'est plafonnée par défaut.
- `create_context()` ou `create_context(heap_options, stack_options)` →
  `ProcessContext*` emprunté, stable jusqu'à sa destruction. Valeurs par
  défaut du tas : tas minimal de 233 mots (`min_heap_words`) et aucun plafond
  mémoire (`limit_bytes` = `UNLIMITED_HEAP_BYTES` ; un budget fixé est un
  multiple de mot au moins égal au tas minimal). La pile n'est pas plafonnée
  non plus, sauf si `StackOptions::limit_words` est défini.
- `destroy_context(ctx)`, `shutdown()` : l'arrêt renvoie `busy` tant qu'il
  reste des contextes ; ensuite, il réussit de façon idempotente et les appels
  ultérieurs renvoient `stopped`. Le destructeur nettoie les contextes
  restants.
- Les identités de contexte et de runtime ne sont jamais recyclées ; leur
  épuisement échoue. L'identité d'un contexte porte son numéro de pid
  ([pids](terms.md#pids-and-references)). Un pointeur de contexte est un
  emprunt, pas une identité. `lifetime()` donne un jeton faible qui rapporte
  `alive() == false` avant la destruction du tas.
- Les appels de cycle de vie ne lèvent jamais d'exception et sont
  silencieux. Valeurs de statut : [abi.md](abi.md#runtime-services).

Ordre de destruction : fermer les enregistrements de l'ordonnanceur → détruire
les contextes → libérer les enregistrements de code → détruire le service
d'ordonnancement → la table des atomes en dernier. Les handles de fonction
résolus maintiennent le code en vie après la destruction du runtime, mais les
mots de leurs emplacements d'atomes n'épinglent aucune orthographe. Le stockage
des atomes retire ses emplacements globaux avant de libérer les enregistrements ;
l'accès à l'orthographe par un Term d'atome non fixe survivant signale
`expired_context`.

## Mémoire des processus

Chaque contexte possède un `ProcessHeap`
([process_heap.hpp](../runtime/include/process_heap.hpp)) ; sa disposition,
ses zones, son dimensionnement, son admission, ses racines et sa collecte sont
spécifiés dans [runtime-heap.md](runtime-heap.md). L'API de l'hôte :

- `allocate(words)` renvoie un stockage de mots mis à zéro. `reserve` donne
  une réservation déplaçable uniquement (move-only), avec validation explicite
  et annulation automatique. Une seule réservation à la fois par tas :
  construire d'abord les enfants, réserver le parent en dernier. Les mots bruts
  de `allocate()` doivent rester à zéro ou contenir des objets complets
  ([disposition des mots](runtime-heap.md#word-layout)).
- Zéro, le dépassement de capacité et un budget épuisé sont rejetés avant la
  publication : `out_of_memory` (allocation) ou `limit_exceeded` (budget) ; le
  code généré reçoit le statut exact
  ([comportement en cas d'échec](runtime-heap.md#failure-behavior)).
- `add(value)`/`copy_to` copient un graphe d'un autre processus du même
  runtime ([copie entre tas](runtime-heap.md#copying-between-heaps)).
- `used_words` compte les mots alloués, `capacity_words` le bloc de tas et les
  fragments, `off_heap_words` les tampons hors tas que ce processus référence,
  chacun une fois
  ([dimensionnement et budget](runtime-heap.md#sizing-and-budget)).
- `verify()` parcourt le bloc de tas et chaque fragment et vérifie que chaque
  emplacement de terme pointe vers le début d'un objet du même processus
  (tests et débogage ; `corrupt_heap` sinon).
- `collect(roots)` copie tout ce qui est atteignable depuis les racines du
  processus et les mots racines de l'hôte dans un nouveau bloc de tas
  ([collecte](runtime-heap.md#collection)). Elle ne s'exécute qu'à un point
  sûr, sinon `unsafe_point`
  ([racines et points sûrs](runtime-heap.md#roots-and-safe-points)) ; le code
  généré effectue la collecte à ses propres points sûrs
  ([collecte dans le code généré](runtime-heap.md#collection-in-generated-code)).
  Les Terms hôtes sont des valeurs d'un mot sans racine ; les reconstruire
  depuis les racines réécrites après la collecte. Ils n'ont aucune vérification
  de durée de vie ou de péremption et ne peuvent pas être lus après une collecte
  ou la fin du processus. Les fabriques et les réservations conservent leurs
  propres jetons de durée de vie et signalent toujours `expired_context`.

## Serveur de code et builtins

Chaque runtime possède un `CodeServer`
([code_server.hpp](../runtime/include/clause/runtime/code_server.hpp),
[callable.hpp](../runtime/include/clause/runtime/callable.hpp)) :

```cpp
auto functions = std::make_unique<ModuleRegistry>();
auto added = functions->add("identity", 1,
    [](ProcessContext &, std::span<const Term> args) -> CallResult<Term> { return args.front(); });
auto loaded = context.code_server().load({"native_demo", CodeImage::linked(), std::move(functions)});
auto fn = context.code_server().resolve({.module = "native_demo", .function = "identity", .arity = 1});
```

- Un `ModuleRegistry` associe un nom/arité exact (≤ 255) à un appelable
  entièrement en `Term`. `load` le fige et le publie ; les doublons ou les
  échecs ne publient rien.
- L'enregistrement indexe aussi les liaisons des modules générés dans des
  tables de hachage : descripteurs de module, de record et de fun vers leurs
  liaisons et définitions, et mots d'atomes `Module:Function/Arity` vers les
  cadres d'export. Les appels dynamiques, `apply/3`, les `fun M:F/A` créées à
  l'exécution et les recherches de descripteurs prennent donc un temps attendu
  constant en fonction du nombre de modules et d'exports. Les index sont
  construits au sein de l'enregistrement : un module rejeté n'ajoute aucune
  entrée, et ils ne changent que sous le verrou exclusif du serveur.
- `resolve` distingue module manquant et export manquant. `ResolvedFunction`
  épingle l'image du module ; `call` vérifie l'arité, les arguments et les
  résultats, et transforme les exceptions de l'hôte en échecs.
- Les corps natifs doivent être synchrones, non bloquants et ne doivent pas
  conserver le contexte ni la plage d'arguments.
- Un catalogue borné de BIF différés connus (`self/0`, `length/1`, `spawn/3`,
  `spawn_link/3`, `send/2`, `make_ref/0`, `garbage_collect/0`, `apply/3` (le
  code généré appelle plutôt `apply/2,3` via les services d'appel dynamique,
  [funs](funs.md#dynamic-calls)), `tuple_size/1`, `+/2`) rapporte
  `not_implemented` ; les autres noms non enregistrés renvoient
  silencieusement `unknown_builtin`. Ce chemin de l'hôte n'atteint pas les
  builtins de production.
- Les builtins de production vivent dans le `BuiltinRegistry` du serveur,
  enregistrés au démarrage du runtime ; le code généré, les appels dynamiques
  et les funs les atteignent via le [pont des builtins](builtins.md).
- `CodeServer::export_frame` trouve le `FrameDescriptor` d'un export par
  module, atome de fonction et arité ; `function_frame` ajoute les builtins
  pour les appels dynamiques ; `external_fun` interne les définitions des funs
  externes construites à l'exécution.
- Les modules ne sont jamais déchargés ; `CodeServer::unload` est différé et
  le chargement dynamique n'est pas pris en charge.

## Termes persistants

Une table par runtime (`memory/persistent_terms`), détenue par `Runtime::Impl`
et atteinte via `ProcessContext::persistent_terms()`, conserve les termes de
`persistent_term` ([builtins](builtins.md#persistent-terms)).

- Chaque clé et valeur est copiée dans sa propre zone de la plage des termes
  persistants du runtime (`memory/persistent_region`) : une réservation
  d'adresses (64 GiB d'espace d'adressage sur les hôtes 64 bits, 256 MiB sur
  ceux à 32 bits) dont les pages sont engagées à mesure que les zones sont
  allouées ; une seule comparaison de plage suffit donc à déterminer si un
  mot désigne un terme persistant. Les copies ne partagent que les littéraux
  des modules, donc chaque zone est autonome ; ses binaries partagent leurs
  tampons.
- Les entrées sont des mots racines trouvés par un hachage de la clé (les
  builtins utilisent le hachage de termes de `phash2`) et une égalité exacte,
  comparée sur place.
- Une lecture renvoie le mot stocké sur place, comme les termes persistants
  littéraux d'OTP : tout processus peut le détenir ; les collectes le laissent
  intact, et l'admission l'accepte comme un littéral. Les envois à d'autres
  processus, les tampons de messages et les nouveaux termes persistants copient
  les mots persistants (un envoi parcourt son message une seule fois, avant le
  verrou de l'exécuteur, afin de ne pas partager une zone pouvant être retirée
  entre-temps).
- **Récupération.** La zone d'une valeur remplacée ou effacée est retirée sous
  une nouvelle époque. Dès lors, toute copie copie ses mots, et chaque
  processus enregistré lors du retrait copie les objets retirés qu'il détient
  dans son propre tas lors d'un balayage complet d'évacuation (`Copier` avec
  la région, chaque objet une fois, tampons de binaries détenus avant le
  balayage) : un processus en cours d'exécution ou en file au début de sa
  prochaine tranche, un processus en attente aussitôt, par l'opération put ou
  erase qui l'a retirée (`Executor::evacuate_parked`, sous le verrou de
  l'exécuteur). Une fois que tous ces processus l'ont fait ou se sont terminés,
  la zone est libérée. `info/0` ne compte que les entrées actuelles.
- Un verrou partagé sert les lecteurs sur un nombre quelconque de threads
  de travail ; put et erase le prennent en exclusif (les copies sont faites
  avant). Le test CTest `runtime_persistent_terms` couvre les valeurs qui
  survivent à leur auteur, les lectures sur place entre collectes et entre
  processus, les valeurs remplacées et effacées détenues par des lecteurs,
  les lecteurs et auteurs concurrents, et la récupération (copies retirées,
  évacuation, zones et imputations libérées).

## Tables ETS

Un registre par runtime (`ets/tables`), détenu par `Runtime::Impl` et atteint
via `ProcessContext::ets_tables()`, conserve les tables de `ets`
([builtins](builtins.md#ets)).

- **Objets.** Chaque objet stocké (et les données d'un héritier) est un
  `DetachedTerm` (`memory/detached_term`) : une copie à plat dans son propre
  bloc, produite par la copie de graphe, hors de tout tas. Les littéraux des
  modules restent partagés ; les termes persistants sont copiés, car leurs
  zones peuvent être retirées ; les cellules de binary partagent leurs tampons.
  Les blocs ne bougent jamais et n'appartiennent à aucun processus ; les
  lecteurs les comparent et les hachent donc sur place et les copient dans
  leur propre tas. Leurs mots sont imputés au compte mémoire du runtime.
- **Index** (`ets/index`). Les tables `set`, `bag` et `duplicate_bag`
  utilisent un index de hachage : un tableau de compartiments dont la taille
  est une puissance de deux, chacun contenant un petit vecteur d'entrées (une
  par clé, ses objets dans l'ordre d'insertion), doublant au-delà de deux clés
  par compartiment et diminuant de moitié en dessous d'une clé pour huit.
  Les clés sont trouvées par la dispersion sur 64 bits de leur hachage `phash2`
  et l'égalité exacte. Les tables `ordered_set` utilisent un `std::set` avec
  un nœud par clé dans l'ordre des termes, où les clés comparées égales (`1`,
  `1.0`) constituent une seule clé ; remplacer un objet conserve son nœud.
- **Parties et verrous** (`ets/table`). Une table de hachage avec
  `write_concurrency` (`true` ou `auto`) répartit ses clés en 64 parties selon
  les bits de poids fort du hachage, chacune étant un index avec son propre
  `shared_mutex` ; toute autre table n'a qu'une partie. Le verrou de table est
  partagé par les opérations sur une seule clé et pris en exclusif par celles
  sur la table entière (listes d'objets, `delete_all_objects/1`, fixation,
  suppression), de sorte qu'une insertion de liste est atomique et isolée comme
  dans OTP. Les lectures copient les objets pendant que leur partie est
  verrouillée en mode partagé.
- **Parcours et fixation.** Une table de hachage se parcourt partie par partie
  et compartiment par compartiment, dans les deux sens ; `next/2` depuis une
  clé absente donne `badarg`. Tant que la table est fixée (`safe_fixtable/2`,
  `foldl/3`), ses index ne changent jamais de taille, une clé supprimée reste
  comme marqueur conservant un objet pour sa clé, et les nouvelles clés
  rejoignent la fin de leur compartiment ; un parcours voit donc une seule
  fois chaque clé restée présente. La dernière levée de fixation supprime les
  marqueurs et redimensionne les index. Un ordered_set se parcourt depuis
  n'importe quelle clé vers la plus proche.
- **Registre.** Tables par numéro d'identifiant (une référence ordinaire issue
  de la séquence du programme) et par nom, et tables que chaque processus
  possède ou fixe. La fin d'un processus (`Executor::release_tables`, sous le
  verrou de l'exécuteur avant le signalement des liens et des moniteurs) libère
  ses fixations et transmet chaque table qu'il possédait à un héritier vivant
  autre que lui-même, qui reçoit `{'ETS-TRANSFER', Table, From, HeirData}`
  (aucun message pour un héritier défini sans données), ou la supprime. Ordre
  des verrous : celui de l'exécuteur, du registre, d'une table ; les builtins
  ne prennent jamais le verrou de l'exécuteur en détenant un verrou ETS, et
  `give_away/3` envoie son message après les avoir libérés.
- **Portions**. `tab2list/1` et les sélections de tous les objets (`select/2`,
  `select_reverse/2`, `match/2`, `match_object/2`, `select_count/2`) parcourent
  la table par portions d'autant d'objets que le budget du processus le permet,
  puis cèdent l'exécution (`builtins/ets/table_walks.cpp`) ; une table de
  hachage est fixée par le processus qui la parcourt, de sa première cession
  jusqu'à la fin, comme dans OTP, pour que ses emplacements restent en place.
  `delete_all_objects/1` et `delete/1` vident ou suppriment la table d'un coup
  en retirant ses index (`Table::empty`, `Table::destroy`), puis libèrent les
  anciens objets par portions (`builtins/ets/disposal.cpp`, `Index::shed`) ;
  une table de hachage fixée est plutôt vidée sur place, en conservant ses
  marqueurs. Les tables laissées par un propriétaire terminé sont libérées par
  le thread de travail après la libération du verrou de l'exécuteur.
  `select_delete/2` et `select_replace/2` s'exécutent encore d'un seul tenant.
- **Compteurs sur place.** `update_counter/3,4` sur une clé dont l'objet est
  la copie propre à la table et dont les compteurs restent de petits entiers
  modifie les champs stockés sur place, sous le verrou de la partie, comme
  dans OTP ; un bignum, un objet littéral de module ou un objet par défaut
  prend le chemin général, qui stocke une nouvelle copie.
- Le test CTest `executables_ets_concurrency` couvre les compteurs, les
  insertions et les parcours depuis de nombreux processus sur un et quatre
  threads de travail, et la fin de propriétaires de nombreuses tables ;
  `executables_ets_portions` montre d'autres processus s'exécutant pendant les
  opérations longues sur un seul thread de travail.
- **Sélections** ([spécifications de filtrage](#match-specifications)). Une
  sélection sur toute la table lit chaque partie sous ses verrous ; si toutes
  ses têtes lient la clé, elle recherche les clés. Une sélection par blocs
  parcourt une table de hachage emplacement par emplacement (chacun sous le
  verrou de sa partie) et un ordered_set par clés depuis la dernière ; une
  continuation désigne donc un emplacement ou une clé. `select_delete/2` et
  `select_replace/2` modifient chaque partie sous son propre verrou
  (`Index::edit`) ; une table de hachage fixée conserve entre-temps les
  marqueurs des clés supprimées.

## Spécifications de filtrage

`runtime/src/match_spec/` compile et exécute les spécifications de filtrage
comme le fait `erl_db_util.c` d'OTP, pour `ets` et
`erlang:match_spec_test/3` ([builtins](builtins.md#ets)).

- **Programmes.** `compile` transforme une spécification en `Program` : par
  clause, un motif de tête, des expressions de guard et de corps sur des
  emplacements de variables numérotés, et les variables liées par la tête
  (`'$$'`). Les constantes sont réduites comme dans OTP (`{{...}}` et
  `{const, X}` en valeurs ; une map constante conserve ses clés telles
  qu'écrites) et conservées comme copies `DetachedTerm`, de sorte qu'un
  programme n'appartient à aucun processus. Deux dialectes : `table` (ets) et
  `trace` (les têtes sont des listes d'arguments, une liste se terminant par
  `'_'` correspond à un préfixe, `'$N'` ou `'_'` à la liste entière ; les corps
  peuvent exécuter des actions de traçage).
- **Vérifications.** Le compilateur applique les vérifications d'OTP dans son
  ordre et, lors du lint (`erlang:match_spec_test/3`), donne les messages d'OTP
  pour la première clause qui en produit, les opérandes des appels et des
  tuples étant compilés du dernier au premier comme dans OTP ; un message est
  tronqué à 99 octets comme par le tampon d'OTP. Les fonctions de guard sont
  celles de la table d'OTP (`match_spec/functions.cpp`), avec les contextes où
  chacune peut être appelée ; une imbrication au-delà de 1000 niveaux donne
  `system_limit`.
- **Exécution** (`match_spec/run.cpp`). Les clauses sont essayées dans l'ordre.
  Une tête lie des parties de l'objet sur place (égalité exacte pour les
  constantes et les variables répétées, maps contenant au moins les clés du
  motif) ; les guards les lisent sur place et doivent donner exactement
  `true` ; un corps copie chaque valeur produite dans le tas de l'appelant.
  Une fonction de guard qui lève une exception fait échouer la clause ; dans
  un corps, elle donne `'EXIT'` à sa place et le corps continue, tout comme
  `and`, `or`, `andalso` et `orelse` sur un terme non booléen. La plupart des
  fonctions de guard sont les opérations sur les termes du service immédiat
  (`terms/immediate_terms.hpp`).
- Les **spécifications compilées** sont des références handle contenant le
  programme (`match_spec/handles.cpp`) ; elles survivent donc à
  `term_to_binary/1` au sein du programme comme les références magiques
  d'OTP 20+.

## Gestion de l'ordonnanceur

`SchedulerService`
([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp)) est un
registre du cycle de vie des processus destiné à l'hôte ; il n'exécute aucun
code. Les programmes s'exécutent sur l'exécuteur
([processus](processes.md#executor)), qui ne l'utilise pas.

- `register_process(context)` une fois par contexte (même runtime) ; les
  doublons renvoient `already_registered`. `remove_process(id)` retire un
  enregistrement qui n'est pas en cours d'exécution.
- `begin_dispatch` → en cours d'exécution ; `finish_dispatch` → exécutable,
  en attente ou terminé (avec une raison). `set_suspended` bascule un
  indicateur sur les enregistrements exécutables/en attente. Les autres
  transitions renvoient `invalid_transition`.
- `request_shutdown()` ferme l'enregistrement, la répartition et le contrôle
  de suspension ; l'inspection et les retours restent disponibles pour la
  vidange.
- `run` et `execute` rapportent `not_implemented`.

## Threads

Les workers de l'ordonnanceur ([workers](processes.md#workers)) exécutent les
processus sur plusieurs threads d'un même runtime. Les services qu'ils
partagent sont synchronisés ; tout le reste reste confiné au thread qui
exécute son processus ou protégé par le mutex de l'exécuteur.

- Atomes : `AtomStorage` protège sa map d'orthographes et ses enregistrements
  possédés par un mutex partagé. `existing` et `size` le partagent ; `intern`
  cherche d'abord sous le verrou partagé, puis prend le verrou exclusif pour
  une nouvelle orthographe et vérifie à nouveau, de sorte que les internements
  concurrents obtiennent un seul mot. La publication utilise
  `detail::atom_table`, global au processus ; l'admission et les lectures
  d'orthographe utilisent son index de numéros sans verrou (`lookup` vérifie
  aussi le propriétaire de l'enregistrement). Les atomes fixes n'ont besoin
  d'aucun verrou. Les enregistrements restent inchangés jusqu'à ce que la
  destruction retire leurs emplacements ([atomes](terms.md#atoms)).
- Code : `CodeServer` protège ses modules et les définitions de funs externes
  par un mutex partagé. Les recherches (`find_module`, `resolve`,
  `atom_word`, `record_definition`, `fun_definition`, `export_frame`,
  `function_frame`, `owns`) le partagent ; `load` et la construction d'une
  nouvelle définition de fun externe le prennent en exclusif, de sorte que des
  enregistrements concurrents d'un même nom publient un seul module (les
  autres obtiennent `duplicate_module`) et que des appels `external_fun`
  concurrents obtiennent une seule définition. Le registre des builtins est
  rempli au démarrage du runtime, avant l'exécution de tout worker, et
  seulement lu ensuite.
- Épinglage : les modules ne sont jamais supprimés tant que le runtime vit et
  le serveur est détruit après chaque contexte, donc les définitions, cadres et
  emplacements d'atomes qu'il a renvoyés restent valides pour chaque invocation
  et chaque cellule de fun. Les handles `ResolvedFunction` et `find_module`
  conservent aussi leur module après la disparition du runtime ; leurs
  emplacements d'atomes conservent des mots, sans épingler les orthographes.
- Numéros de pid et de port : `IdentityNumbers` émet les numéros sous un
  verrou exclusif et admet les mots de pid et de port sous un verrou partagé.
- Mémoire : le compte à l'échelle du runtime (`RuntimeMemory`) impute et
  libère par des opérations atomiques ; une imputation ne fait jamais dépasser
  au compte une limite optionnelle.
- Autres threads : le thread des minuteries
  ([délais de réception](processes.md#receive-timeouts)), le thread d'E/S et,
  sous Windows, le thread de lecture d'une entrée `fd`
  ([thread d'E/S](ports.md#io-thread)) ne touchent l'état des processus qu'à
  travers le mutex de l'exécuteur.
- Édition de liens : sous Linux, le runtime ajoute `-pthread` pour ses
  threads ; sous Windows, il lie Winsock (`ws2_32`, `mswsock`) pour les
  sockets.

## Sortie standard

`RuntimeOptions::standard_output`
([output.hpp](../runtime/include/clause/runtime/output.hpp)) reçoit la sortie
de `erlang:display/1` et de `io` vers la sortie standard ([io](io.md)). Par
défaut, l'écriture se fait sur le `stdout` du processus via stdio de C (avec
tampon) ; un récepteur de l'hôte renvoie `false` pour signaler une écriture
échouée.

`erlang:display/1` rend son argument dans le
[style d'affichage](terms.md#printing), écrit le texte et un saut de ligne en
une seule écriture et renvoie `true`. Les limites de rendu et les écritures
refusées deviennent des statuts d'infrastructure (`resource_limit`,
`output_failure`, ...) dans le canal vérifié, jamais des exceptions Erlang.

## Démarrage du programme

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) exécute un programme entier pour le `main` généré
([exécutables](executables.md)) : il vérifie l'ABI de chaque descripteur,
démarre un runtime, enregistre tous les modules avant tout code d'entrée,
construit argv dans le contexte d'entrée, exécute l'entrée sur l'exécuteur et
convertit le résultat en [code de sortie](executables.md#exit-status). Les
rapports vont sur stderr après le vidage de stdout ; le contexte et le runtime
sont détruits dans l'ordre sur chaque chemin. `CLAUSE_halt_v1` implémente
`erlang:halt/0,1` (`abort` appelle `std::abort`).

## Services différés

Ceux-ci rapportent une ligne `[feature] notimpl`
([fonctionnalités](features.md)) et ne changent aucun état :

| Frontière | Erreur |
| --- | --- |
| `TermFactory::function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` sur un BIF catalogué | `Status::not_implemented` |
