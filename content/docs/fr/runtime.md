---
source: docs/runtime.md
sourceCommit: 6ed3851c
sourceSha256: 487cb38fceea0b489183ca4c47c3c3b8494d2df44fd821e82de92e1c896f5864
translatedAt: 2026-10-15
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
résolus maintiennent le code et l'orthographe des atomes en vie après la
destruction du runtime, mais jamais un processus.

## Mémoire des processus

Chaque contexte possède un `ProcessHeap` : un unique bloc de tas créé par sa
première allocation et dimensionné à `max(min_heap_words, request)`, plus une
chaîne de fragments de tas appartenant au même processus. Les mots ne se
déplacent que lorsque l'hôte appelle `collect()` à un point sûr.

Le tas suit la conception classique d'ERTS ; [runtime-heap.md](runtime-heap.md)
en est le contrat (disposition, zones, dimensionnement, admission, racines,
collecte).

- `allocate(words)` renvoie un stockage de mots mis à zéro. `reserve` donne
  une réservation déplaçable uniquement (move-only), avec validation explicite
  et annulation automatique. Une seule réservation à la fois par tas :
  construire d'abord les enfants, réserver le parent en dernier.
- L'allocation par incrément de pointeur (bump allocation) remplit le bloc de
  tas ; une requête qui n'y tient pas va dans le fragment le plus récent,
  sinon dans un nouveau fragment dimensionné à `max(min_heap_words, request)`
  (plafonné par le budget restant). Les mots sont seulement alignés sur le
  mot. L'annulation réinitialise le sommet de la zone, abandonne un fragment
  (ou le bloc de tas) créé par la réservation et restaure exactement la
  comptabilité.
- Rejette zéro, le dépassement de capacité et le budget épuisé avant la
  publication. Erreurs : `out_of_memory` (allocation) ou `limit_exceeded`
  (budget) ; le code généré reçoit le statut exact.
- Les binaries de plus de 64 octets vivent dans des tampons partagés hors du
  tas. Chaque cellule du tas qui en référence un contient un
  `std::shared_ptr` et rejoint la liste hors tas du processus lors de la
  publication ; la destruction parcourt la liste et abandonne ces références
  ([binaries hors tas](runtime-heap.md#off-heap-binaries)).
- `add(value)`/`copy_to` copient un graphe d'un autre processus du même
  runtime, en conservant son partage et en partageant les tampons hors tas ;
  une copie échouée ne change rien
  ([copie entre tas](runtime-heap.md#copying-between-heaps)).
- `used_words` compte les mots alloués ; `capacity_words` compte le bloc de
  tas et les fragments ; `off_heap_words` compte les tampons que ce processus
  référence, chacun une fois. Les mots de stockage et hors tas partagent le
  budget optionnel `limit_bytes` ; une collecte conserve la moitié du budget
  restant une fois les survivants libérés, donc l'épuiser signifie que les
  données vivantes ne tiennent plus
  ([comportement en cas d'échec](runtime-heap.md#failure-behavior)).
- Chaque mot utilisé s'analyse comme un objet précédé d'un en-tête, une
  cellule cons ou du remplissage ([disposition des mots](runtime-heap.md#word-layout)) ;
  les mots réservés commencent à zéro. Les mots bruts de `allocate()` doivent
  rester à zéro ou contenir des objets complets. `verify()` parcourt le bloc
  de tas et chaque fragment et vérifie que chaque emplacement de terme pointe
  vers le début d'un objet du même processus (tests et débogage ;
  `corrupt_heap` sinon).
- `collect(roots)` copie tout ce qui est atteignable depuis les racines du
  processus et les mots racines de l'hôte dans un nouveau bloc de tas, libère
  l'ancien bloc et les fragments, libère les binaries hors tas morts et
  réécrit les racines ([collecte](runtime-heap.md#collection)). Le code généré
  effectue une collecte aux entrées de fonction et aux têtes de boucle des
  comprehensions lorsque `wants_collection()`
  ([collecte dans le code généré](runtime-heap.md#collection-in-generated-code)).
  Elle ne s'exécute qu'à un point sûr (aucun code généré en cours d'exécution
  hors d'une portée `SafePoint`, aucune réservation ouverte), sinon
  `unsafe_point` ; l'[inventaire des racines](runtime-heap.md#roots-and-safe-points)
  liste ce qu'elle réécrit ; l'échec de l'allocation du nouveau bloc donne
  `out_of_memory` sans aucun changement.

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
  constant en fonction du nombre de modules et d'exports (environ 80 ns par
  recherche d'export en Debug avec 10 ou 400 modules). Les index sont
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
- `CodeServer::unload` est différé ; le chargement dynamique n'est pas pris en
  charge.

## Termes persistants

Source : `memory/persistent_terms`. Une table par runtime, détenue par
`Runtime::Impl` et atteinte via `ProcessContext::persistent_terms()`, conserve
les termes de `persistent_term` (builtins : step 41M2).

- Une clé et sa valeur sont chacune copiées dans un `MessageBuffer`
  ([tampons de messages](runtime-heap.md#message-buffers)) hors de tout
  processus, de sorte qu'elles survivent au processus qui les a stockées et
  qu'aucune collecte ne les déplace.
- Les entrées sont trouvées par un hachage de la clé (les builtins utilisent le
  hachage de termes de `phash2`) et une égalité exacte, comparée sur place dans
  le tampon (`MessageBuffer::value`).
- Une lecture copie la valeur dans le tas du lecteur (décidé le 2026-10-14).
  OTP remet à la place une référence vers une zone de littéraux et ne copie
  qu'au remplacement ou à l'effacement, via une collecte globale ; l'admission
  de Clause n'accepte que les mots des zones propres au processus, de sorte que
  des littéraux sur place exigeraient une nouvelle région de termes partagée.
  La copie garde chaque tas de processus autonome : une valeur remplacée ou
  effacée est libérée lorsque le dernier lecteur qui la copie encore abandonne
  sa référence au tampon, et aucune collecte globale n'est nécessaire. Les
  lectures coûtent la taille de la valeur ([différences](differences.md)).
- Un verrou partagé sert les lecteurs sur un nombre quelconque de workers ;
  `put` et l'effacement le prennent en exclusif et ne copient jamais en le
  détenant. Le test CTest `runtime_persistent_terms` couvre les valeurs qui
  survivent à leur auteur, les valeurs remplacées détenues par des lecteurs,
  les lecteurs et auteurs concurrents, et les imputations libérées.

## Gestion de l'ordonnanceur

`SchedulerService` ([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp))
enregistre uniquement le cycle de vie des processus ; il n'exécute aucun code.

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

Des esquisses de conception pour les workers et les processus se trouvent
dans [runtime/design/](../runtime/design/) et
`runtime/include/{scheduler,process}.hpp`. Les messages sont implémentés
([processus](processes.md#messages)) : un envoi copie le message dans le tas
du destinataire et l'ajoute à sa boîte de réception des signaux
(`runtime/include/mailbox.hpp`).

## Threads

Les workers de l'ordonnanceur ([workers](processes.md#workers))
exécutent les processus sur plusieurs threads d'un même runtime. Les services
qu'ils partagent sont synchronisés ; tout le reste reste confiné au thread qui
exécute son processus ou protégé par le mutex de l'exécuteur.

- Atomes : `AtomStorage` protège ses deux index par un mutex
  partagé. Les recherches (`lookup`, `boolean`, `size`) le partagent ;
  `intern` cherche sous le verrou partagé et seule une nouvelle orthographe
  prend le verrou exclusif, vérifie à nouveau et publie l'entrée, de sorte que
  des appels `intern` concurrents pour une même orthographe obtiennent un seul
  mot. Les mots restent stables : une entrée n'est jamais modifiée ni
  supprimée avant la destruction.
- Code : `CodeServer` protège ses modules et les définitions de funs
  externes par un mutex partagé. Les recherches (`find_module`, `resolve`,
  `atom_word`, `record_definition`, `fun_definition`, `export_frame`,
  `function_frame`, `owns`) le partagent ; `load` et la construction d'une
  nouvelle définition de fun externe le prennent en exclusif, de sorte que des
  enregistrements concurrents d'un même nom publient un seul module (les
  autres obtiennent `duplicate_module`) et que des appels `external_fun`
  concurrents obtiennent une seule définition. Le registre des builtins est
  rempli au démarrage du runtime, avant l'exécution de tout worker, et
  seulement lu ensuite.
- Épinglage : les modules ne sont jamais supprimés tant que le runtime vit (le
  déchargement est différé) et le serveur est détruit après chaque contexte,
  donc les définitions, cadres et emplacements d'atomes qu'il a renvoyés
  restent valides pour chaque invocation et chaque cellule de fun. Les handles
  `ResolvedFunction` et `find_module` conservent aussi leur module après la
  disparition du runtime.
- Numéros de pid : `ProcessNumbers` émet les numéros sous un verrou
  exclusif et admet les mots de pid sous un verrou partagé.
- Mémoire : le compte à l'échelle du runtime (`RuntimeMemory`)
  impute et libère par des opérations atomiques ; une imputation ne fait
  jamais dépasser au compte une limite optionnelle.
- E/S des ports : les threads de lecture, d'écriture et de
  surveillance du service d'E/S et le thread des sockets
  ([ports](ports.md#io-thread)) ne touchent l'état des processus qu'à travers
  le mutex de l'exécuteur.
- Édition de liens : sous Linux, le runtime ajoute `-pthread` pour ses
  threads ; sous Windows, il lie Winsock (`ws2_32`, `mswsock`) pour les
  sockets.

## Sortie standard

`RuntimeOptions::standard_output` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
reçoit `erlang:display/1` et, plus tard, les octets de `standard_io`. Par
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
`runtime/src/startup/`) exécute un programme entier pour le `main` généré : il
vérifie l'ABI de chaque descripteur, démarre un runtime par défaut, enregistre
tous les modules avant tout code d'entrée, construit argv dans le contexte
d'entrée, appelle l'entrée et convertit le résultat en code de sortie des
[exécutables](executables.md#exit-status). Les rapports vont sur stderr après
le vidage de stdout ; le contexte et le runtime sont détruits dans l'ordre sur
chaque chemin. `CLAUSE_halt_v1` implémente `erlang:halt/0,1` (`abort` appelle
`std::abort`).

## Services différés

Ceux-ci rapportent une ligne `[feature] notimpl` ([fonctionnalités](features.md))
et ne changent aucun état :

| Frontière | Erreur |
| --- | --- |
| `TermFactory::port` (pas encore de ports), `reference(ReferenceIdentity)` et `function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` sur un BIF catalogué | `Status::not_implemented` |
