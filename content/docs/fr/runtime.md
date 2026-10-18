---
source: docs/runtime.md
sourceCommit: 336caea7
sourceSha256: 9c7fc7cdb9594636008282ecfb3e10405ea5b5df219484609c5b5cb58a468a30
translatedAt: 2026-10-18
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
  littéraux d'OTP : tout processus peut le détenir et l'envoyer (une copie
  dans un autre processus conserve le mot) ; les collectes le laissent intact,
  et l'admission l'accepte comme un littéral. Les tampons de messages et les
  nouveaux termes persistants copient les mots persistants.
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
