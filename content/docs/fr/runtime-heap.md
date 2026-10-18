---
source: docs/runtime-heap.md
sourceCommit: 336caea7
sourceSha256: 8549242b795751ec135403e46efd9594eb697d8d4beb804ad5f7aa8dc1b4f7c0
translatedAt: 2026-10-18
---
# Contrat du tas de processus

Les tas de processus suivent la conception classique d'ERTS : un bloc de tas
contigu par processus plus des fragments de débordement, des cellules
autodescriptives, de grands binaries dans des tampons partagés hors du tas, et
un ramasse-miettes par copie qui ne s'exécute qu'aux points sûrs. Cette note en
est le contrat ; [runtime.md](runtime.md#process-memory) résume l'API hôte.

## Disposition des mots

Un terme est un mot de la cible (32 ou 64 bits) ; les encodages sont décrits
dans [abi.md](abi.md#terms). Chaque zone du tas est une suite d'objets qu'un
parcoureur analyse à partir de son premier mot :

- **Mot d'en-tête** (étiquette primaire `00`) : les bits 2 à 6 contiennent le
  `BoxedKind`, les bits 7 et au-delà le nombre de mots qui suivent l'en-tête.
  Un terme boxed pointe sur son en-tête. Le compte couvre chaque mot de préfixe,
  de charge utile et de remplissage, si bien que le parcoureur saute la charge
  utile non tracée sans l'interpréter. Il a 25 bits sur les cibles 32 bits (au
  plus 33 554 431 mots) et 57 sur les cibles 64 bits (`BoxHeader::MAX_COUNT`) :
  la limite d'arité des tuples (2^24 - 1) et le plus grand bignum
  (131 072 mots en 32 bits) y tiennent par assertion statique, les maps le
  vérifient à leur construction, et les cellules cons et les cellules de taille
  fixe n'ont pas de grand compte.
- **Cellule cons** : deux mots de terme (tête, queue) sans en-tête. Un terme de
  liste pointe sur la tête. Une tête n'est jamais un en-tête car aucun terme n'a
  l'étiquette `00`.
- **Remplissage** : le mot entièrement nul (type `tuple`, compte 0) est un
  remplissage d'un mot ; le type `filler` avec un compte n couvre n mots
  supplémentaires. Les réservations commencent à zéro, donc les mots réservés
  mais inutilisés s'analysent comme du remplissage. Les tuples non vides ont
  toujours un compte non nul et `{}` est un immédiat.

Aucune cellule n'a besoin d'un alignement plus strict qu'un mot.
`memory/heap_walk` analyse une zone cellule par cellule et
`ProcessHeap::verify` vérifie un tas entier. Les cellules ne contiennent que des
mots et des octets, à l'exception du `std::shared_ptr` du binary hors tas
(ci-dessous), si bien qu'une cellule se déplace en copiant ses mots.

| Type | Mots après l'en-tête | Mots tracés |
| --- | --- | --- |
| cons (sans en-tête) | 2 mots au total | tête, queue |
| `tuple` | n emplacements d'éléments | tous |
| `map` | 2n emplacements : les clés dans l'ordre exact des termes, chacune suivie de sa valeur ; au plus 32 entrées | tous |
| `tree_map` | nombre d'entrées, mot d'édition, `map_node` racine : 3 mots ([arbres de maps](#map-trees)) | la racine |
| `map_node` | entrées en dessous, mot d'édition, puis n clés et n valeurs (une feuille) ou n enfants (une branche) ; jamais un terme | clés et valeurs ou enfants |
| `native_record` | adresse du `RecordDefinition` du runtime, puis n valeurs de champs dans l'ordre de définition | valeurs |
| `fun_closure` | adresse du `FunDefinition` du runtime, puis n valeurs capturées ([funs](funs.md)) | valeurs |
| `bignum` | mot de signe, puis les limbes de la magnitude, les moins significatifs d'abord | aucun |
| `floating` | 8 octets : 1 mot (64 bits) ou 2 mots (32 bits) | aucun |
| `reference` | 8 octets : le numéro de référence ([pids et références](terms.md#pids-and-references)) | aucun |
| `heap_binary` | longueur en bits, puis les octets de données arrondis aux mots (au plus 64 octets) | aucun |
| `refc_binary` | décalage en bits, longueur en bits, premier octet du tampon (lu par le code généré), fin et limite d'ajout, `std::shared_ptr` (2 mots), lien hors tas : 8 mots | aucun |
| `sub_binary` | décalage en bits dans l'original, longueur en bits, le `heap_binary` ou `refc_binary` original (jamais un sous-binary) : 3 mots | l'original |
| `filler` | n mots inutilisés | aucun |

Le compte d'une `map` est en mots (entrées = compte / 2). Les pids et les ports
sont des immédiats, admis d'après les numéros émis par le runtime.

## Binaries hors tas

Un binary de plus de 64 octets est un tampon immuable qui flotte en dehors de
tout tas de processus, partagé par comptage de références (ProcBin et `Binary`
de BEAM).

- Sa cellule boxed `refc_binary` contient un `std::shared_ptr` vers le tampon,
  un décalage en bits et une longueur en bits. Les tranches d'un grand binary (et
  les tranches de celles-ci) sont des cellules `sub_binary` qui nomment la
  cellule originale, comme les sous-binaries d'ERTS : une tranche ne prend
  aucune référence sur le tampon et maintient l'original en vie. Copier une
  cellule vers un autre processus copie le `shared_ptr`
  ([copie entre tas](#copying-between-heaps)), jamais les octets.
- Chaque cellule est chaînée dans la liste hors tas de son processus via son mot
  de lien. Cette liste est le seul moyen de retrouver l'état C++ de ces
  cellules.
- Déplacer une cellule copie ses autres mots et construit par déplacement le
  `shared_ptr` dans la nouvelle cellule, si bien que l'ancienne copie ne possède
  plus rien. Après une collecte, le balayage de la liste rechaîne les cellules
  déplacées et détruit le `shared_ptr` des cellules mortes ; le démontage les
  détruit toutes. Un tampon est libéré lorsque sa dernière cellule, dans
  n'importe quel processus, meurt.
- Chaque processus compte ses cellules par tampon (`HeapStorage::buffers_`) ; un
  tampon est imputé une fois à chaque processus qui le référence (ses mots hors
  tas, le tas binaire virtuel d'ERTS) jusqu'à ce que la dernière cellule de ce
  processus pour ce tampon meure, et une fois au compte global du runtime de sa
  création jusqu'à sa libération.
- `std::shared_ptr` fait deux pointeurs dans toutes les STL prises en charge ;
  un `static_assert` maintient la taille de la cellule à huit mots après
  l'en-tête pour les deux largeurs.

### Références à handle

Une référence à handle est une référence qui détient aussi un tampon hors tas,
comme une référence magique d'OTP détient une ressource ; les tableaux
`atomics` y vivent ([atomics et compteurs](builtins.md#atomics-and-counters)).

- Sa cellule a le type `reference` et la disposition de `refc_binary` : huit
  mots après l'en-tête, le numéro de référence de 64 bits dans les mots de
  décalage et de longueur en bits (là où une cellule de référence simple le
  garde), puis le `shared_ptr` et le mot de lien. Chaque service de référence ne
  lit que le numéro, si bien qu'elle se compare, se hache, s'affiche et s'encode
  comme une référence simple.
- Elle est listée, déplacée, balayée, imputée et copiée exactement comme une
  cellule de binary hors tas (`layout::off_heap_cell`) ; son tampon est libéré
  lorsque la dernière copie de la référence, dans n'importe quel processus,
  meurt.
- Un registre global au processus associe les numéros des handles vivants à
  leurs tampons (références faibles), si bien que `binary_to_term/1` d'un handle
  encodé reconstruit un handle partageant le tampon tant que celui-ci vit, et
  une référence simple ensuite. Les entrées expirées sont retirées à mesure que
  le registre grandit.

## Arbres de maps

Une map de plus de 32 entrées (`MAP_SMALL_MAP_LIMIT` d'OTP) est un talon (stub)
`tree_map` de 4 mots qui nomme la racine d'un arbre B+ persistant
(`terms/map_tree`) dont les nœuds sont des cellules `map_node` du même tas, de
même qu'OTP garde les nœuds de son HAMT sur le tas. Les maps plus petites
restent des cellules `map`.

- Les feuilles contiennent jusqu'à 16 mots de clé et de valeur dans l'ordre
  exact des clés ; les branches contiennent jusqu'à 16 enfants avec leurs
  premières clés, et chaque nœud compte les entrées situées en dessous de lui,
  si bien que la recherche et l'accès par position sont en O(log n). Chaque nœud
  sauf la racine est au moins à moitié plein.
- Une mise à jour copie le chemin vers la feuille modifiée (environ 35 mots par
  niveau) et partage tous les autres nœuds avec la map source, qui reste
  inchangée, si bien que construire une map clé par clé coûte O(n log n) au lieu
  de O(n^2). Elle compte d'abord les mots du chemin et les alloue en une fois ;
  une mise à jour échouée les annule.
- Les nœuds sont des cellules ordinaires : les collectes les déplacent, les
  promeuvent et les libèrent, les versions mortes ne coûtent rien, et ils
  comptent dans `heap_size`, pas comme mots hors tas. Copier une map vers un
  autre tas (messages) copie ses nœuds comme n'importe quelles cellules.
- Chaque talon et chaque nœud porte un mot d'édition : le jeton de la mise à
  jour qui l'a créé, au-dessus d'un bit de feuille. Les nœuds portant le jeton
  de la mise à jour en cours sont modifiés sur place (une mise à jour de
  plusieurs clés écrit chaque nœud une seule fois). Les jetons émis avant la
  dernière collecte n'autorisent aucune modification sur place, puisque la
  collecte a pu promouvoir les nœuds, et une copie vers un autre tas efface le
  jeton.
- Une mise à jour possédée (`MapOperation::update_owned`) dont le compilateur a
  prouvé que la source n'est plus lue ensuite consomme le talon source (racine
  `[]`, taille 0) et réutilise son jeton tant qu'il est à jour, si bien qu'elle
  modifie sur place les nœuds créés par la propre mise à jour de la source et
  copie le reste du chemin. Une mise à jour possédée échouée rend l'arbre au
  talon. Le compilateur ne marque une mise à jour comme possédée que lorsque la
  fonction a construit elle-même la map source (`M = <map expression or
  comprehension>` dans le même corps de clause), ne lit `M` nulle part ailleurs
  et ne la capture jamais dans une fun (`semantic/map_ownership`).

## Zones

- **Tas.** Un bloc `[start, top, end)` par processus avec allocation par
  incrément de pointeur. Il est créé par la première allocation du processus,
  dimensionné à `max(min_heap_words, request)` afin que cette requête tienne
  toujours (les fragments commencent au minimum, au plus 233 mots, puis
  grandissent, voir ci-dessous), et possédé par ce seul processus. Le code
  généré y alloue directement les petits tuples, les listes, les flottants et
  les closures par incrément de pointeur via
  `FrameState::heap_top`/`heap_limit` : `HeapStorage::absorb` intègre ces mots
  au sommet et à `used_words_` avant toute opération sur le tas (réservation,
  admission, collecte, vérification, requêtes d'utilisation) et `expose` montre
  de nouveau les mots libres après chacune. L'allocation en ligne ne crée
  jamais de fragment et reste désactivée sous un budget par processus. Dès que
  le bloc a moins de 64 mots libres, `expose` montre à la place le fragment
  propre le plus récent du processus (jamais un bloc de message adopté), si bien
  que l'allocation entre deux points sûrs, comme les retours d'une récursion de
  corps, reste en ligne après l'ouverture du premier fragment (fenêtres de
  fragments). Sans budget, chaque nouveau fragment est au moins aussi grand que
  les fragments précédents.
- **Zones de littéraux.** Les littéraux composés de chaque module — chaînes et
  listes constantes, tuples de constantes, flottants, littéraux bignum et
  binaries constants — sont disposés par le compilateur sous forme de cellules
  de tas dans une variable globale en lecture seule
  (`ModuleDescriptor::literals`), enregistrée pour tout le runtime
  (`detail::LiteralAreas`, un instantané trié sans verrou) lors de
  l'enregistrement du module. Les termes de tous les processus peuvent y
  pointer : l'admission vérifie `HeapStorage::readable` (tas, fragments,
  puis littéraux), tandis que `TermAccess::object` lit des pointeurs de
  confiance. Le ramasse-miettes
  laisse les mots littéraux tels quels (`owned` reste limité au tas) ; les
  copies entre tas et vers les tampons de messages continuent d'y pointer (une
  racine littérale n'a pas besoin de copie) ; le vérificateur les accepte. Les
  littéraux ne contiennent que des immédiats (uniquement des atomes fixes) et
  des mots d'autres littéraux.
- **Fragments.** Lorsqu'une requête ne tient pas et que le tas ne peut pas
  bouger, elle va dans le fragment le plus récent si elle y tient, sinon dans un
  nouveau fragment dimensionné pour la contenir (au moins la taille minimale du
  tas) et chaîné au processus. La collecte suivante fusionne les fragments dans
  le nouveau bloc de tas. Une réservation vit dans une seule zone ;
  l'annulation réinitialise le sommet de cette zone et supprime un fragment (ou
  le bloc de tas) créé par la réservation. L'allocation ne déplace jamais le
  tas : le débordement reste dans des fragments jusqu'au prochain point sûr ou
  à la prochaine collecte hôte
  ([collecte dans le code généré](#collection-in-generated-code)).
- **Pile.** Les cadres générés vivent sur une pile plate par processus, séparée
  du tas (`ProcessStack`,
  [modèle d'exécution](execution-model.md#implementation)). Elle n'a pas de
  plafond par défaut ; une limite optionnelle par processus
  `StackOptions::limit_words` la borne indépendamment du tas.
- **Liste hors tas.** Voir ci-dessus.
- **Vieille zone.** Les objets qui ont survécu à deux collectes
  ([générations](#generations)) ; les collectes mineures la laissent en place,
  un balayage complet la copie dans le nouveau bloc et la libère.

## Dimensionnement et budget

- `min_heap_words` est le `min_heap_size` du processus : 233 mots par défaut
  (comme ERTS), `--min-heap-size` pour tous les processus (`+hms` d'ERTS),
  `{min_heap_size, N}` dans `spawn_opt` ou `process_flag(min_heap_size, N)` pour
  un seul ; un réglage est arrondi à une taille de tas supérieure et jamais en
  dessous de la valeur par défaut du runtime, et `process_flag` prend effet à la
  collecte suivante. Comme aucun bloc n'est plus petit, un processus n'effectue
  pas de collecte avant d'avoir alloué autant de mots.
- Le tas commence à `min_heap_words` et grandit selon la suite de tailles
  d'ERTS : 12, 38, puis chaque taille est la somme des deux précédentes plus un
  jusqu'à 833 026 mots, puis par paliers de 20 % (`heap_size_at_least`).
- Le nouveau bloc d'une collecte est la plus petite de ces tailles qui
  maintient les mots qu'il peut recevoir sous 75 % de sa taille : d'abord tous
  les mots utilisés, puisque les données vivantes ne sont pas connues avant la
  copie. Un résultat vivant à moins de 25 % est copié une fois de plus dans la
  taille dont ses données vivantes ont besoin ; si l'allocation de ce bloc
  échoue, le plus grand est conservé. Aucun des deux n'est plus petit que
  `min_heap_words`. Les deux tailles comptent les mots de la pile du processus
  comme vivants, car ERTS garde la pile à l'intérieur du bloc de tas.
- Avec un budget défini (ci-dessous), un nouveau bloc contient au plus ses mots
  vivants plus la moitié du budget restant après eux et les tampons hors tas
  (`block_limit`), jamais moins que `min_heap_words`. L'autre moitié reste libre
  pour les fragments et les nouveaux tampons hors tas, si bien que les déchets
  alloués après une collecte atteignent le point sûr suivant comme déclencheur
  au lieu d'épuiser le budget. La première copie est dimensionnée d'après tous
  les mots utilisés, donc un bloc qui dépasse la limite pour les mots ayant
  survécu est copié une fois de plus dans la taille fixée par la politique.
- Il n'y a pas de plafond mémoire par défaut, ni par processus ni pour le
  runtime : le tas grandit jusqu'à ce que l'hôte refuse de la mémoire
  (`out_of_memory`), tandis que le dimensionnement ci-dessus le maintient près de
  sa taille vivante. Un budget optionnel par processus,
  `HeapOptions::limit_bytes` (par défaut `UNLIMITED_HEAP_BYTES`), couvre le bloc
  de tas, les fragments et les octets des tampons hors tas que ce processus
  référence ; le dépasser donne `limit_exceeded`. Pendant une collecte,
  l'ancien et le nouveau bloc coexistent ; seul le nouveau bloc est vérifié par
  rapport au budget, plafonné au budget restant après les tampons hors tas.
  L'imputation d'un tampon est restituée lorsque le processus abandonne sa
  dernière cellule pour celui-ci. La pile garde son propre plafond optionnel,
  `StackOptions::limit_words`. Les programmes définissent les deux plafonds
  avec `--max-heap` et `--max-stack`
  ([options du runtime](executables.md#runtime-options)).

## Blocs de tas

Les blocs de tas, les fragments et les vieilles zones proviennent de
`memory/heap_blocks`. Un bloc qu'une collecte libère reste attaché à son thread
pour les collectes suivantes de ce thread (comme les carriers d'ERTS conservent
la mémoire) : un nouveau bloc prend le plus petit bloc en cache d'au moins sa
taille et d'au plus le double, sinon de la mémoire neuve. Chaque thread garde au
plus 8 blocs et 4M mots (32 Mo sur les cibles 64 bits) ; les blocs de moins de
4 096 mots ne sont pas conservés, car les listes libres du tas C++ les servent à
peu de frais. Sans cela, l'espace de destination (to-space) de chaque collecte
prenait des pages neuves au système d'exploitation et payait un défaut de page
par page touchée, et la libération d'un grand bloc rendait ses pages. Les blocs
en cache ne sont imputés à aucun processus ni au compte global du runtime ; un
thread libère son cache lorsqu'il se termine.

## Limite mémoire du runtime

- Une limite optionnelle globale au runtime,
  `RuntimeOptions::memory_limit_bytes` (par défaut `UNLIMITED_HEAP_BYTES` ; les
  programmes la définissent avec `--max-memory`), borne la mémoire de tous les
  processus ensemble : blocs de tas, fragments, tampons hors tas et capacité des
  piles. OTP n'a pas de telle limite ; cela se rapproche le plus de l'exécution
  de la VM sous une limite mémoire du système d'exploitation, mais fait échouer
  un seul processus au lieu du nœud.
- Un compte par runtime (`detail::RuntimeMemory`, partagé par tous les stockages
  de tas et toutes les piles) est débité à la création d'un bloc, d'un fragment,
  d'un tampon hors tas ou d'une capacité de pile et crédité à sa suppression ;
  un tampon partagé par plusieurs processus est imputé une fois et restitué
  lorsque sa dernière référence meurt. Le démontage restitue toutes les
  imputations du processus. `Runtime::memory_bytes()` indique le total.
- Pour chaque processus, la limite agit comme un budget égal au stockage qu'il
  possède plus ce que la limite laisse disponible (`HeapStorage::budget`,
  `room`), si bien que le dimensionnement ci-dessus garde libre la moitié de la
  mémoire libre après chaque collecte, et qu'une requête au-delà donne
  `limit_exceeded` (`resource_limit`) pour le seul processus demandeur ; les
  autres processus continuent de s'exécuter. Les déchets d'un autre processus
  comptent jusqu'à ce que ce processus effectue une collecte.
- L'espace de destination (to-space) d'une collecte est imputé même au-delà de
  la limite, car il remplace les blocs qu'il libère à la fin de la même
  collecte.
- La pile double tant que la limite le permet, puis ne grandit que du cadre
  en cours d'empilement.

## Admission

Les pointeurs vers un tas de processus ne sont créés que par le compilateur et
le runtime à l'intérieur de ce processus, et désignent toujours un début
d'objet ; il n'y a pas de pointeurs intérieurs à détecter. L'admission est une
vérification de propriété pour les mots rendus à un processus.
`Term::from_word(word, context)` / `TermAccess::admit` vérifient d'abord que
le stockage est vivant (`expired_context`) ; les atomes et les pids/ports
doivent appartenir à ce runtime (les atomes fixes sont partagés). Pour les mots
composés :

1. L'adresse est alignée sur un mot à l'intérieur de l'une des zones du
   processus, sous son `top` : le bloc de tas est vérifié en premier, puis les
   fragments triés par adresse, puis les zones de littéraux ([zones](#areas)).
   Les adresses hors de ces plages échouent sans chargement ; cela ne détecte
   pas les anciens mots aux adresses réutilisées.
2. Un mot boxed désigne un en-tête d'un type admis (pas un remplissage) ; un mot
   de liste désigne une cellule cons (un mot qui n'est pas un en-tête).

Après admission, `TermAccess::object` décode le type, le compte et la charge
utile via `trusted_cell`, sans recherche dans le tas ; `child` enveloppe le
mot stocké et `validate` ne vérifie que la représentation. Les fabriques
réadmettent toujours les entrées via `ProcessHeap::retain`, en rejetant les
entrées composées étrangères avec `wrong_owner`.

Ces vérifications ne s'exécutent qu'en compilation Debug (`CHECKED_ADMISSION`,
OPTM.2C). Une compilation Release fait confiance à tous les mots composés,
d'atomes, de pids et de ports transmis à un builtin, un service ou une fabrique,
comme ERTS fait confiance à ses Eterms : le code généré ne produit que des mots
de son propre processus, des zones de littéraux et des atomes du runtime ; les
recherches de plage et de propriétaire ne faisaient donc qu'ajouter un coût à
chaque argument. Les autres immédiats sont toujours classés. Les tests qui
fournissent des mots falsifiés ou étrangers n'attendent un rejet que lorsque
`CHECKED_ADMISSION` est actif.
`map_find` peut comparer en lecture seule la clé d'un autre processus sans ce
rejet. `verify()` reste la vérification complète, pour les tests, que chaque
emplacement désigne un début d'objet.

## Racines et points sûrs

`ProcessContext::visit_roots` énumère chaque mot racine pour le ramasse-miettes.
À un point sûr, rien d'autre ne détient de mots du tas du processus :

| Propriétaire | Mots racines | Notes |
| --- | --- | --- |
| Emplacements de termes des cadres | Les `roots` premiers emplacements de chaque cadre de la pile | Les cadres du fond n'en ont aucun ; les indices de reprise et de gestionnaire sont des entiers |
| Emplacements bruts des cadres | Aucun | Valeurs natives déversées ; le code généré n'y garde aucun mot du tas à un point sûr ([règle de rechargement](#reload-rule)) |
| Registres | `x[0..live)` (`ProcessStack::keep_registers`) | Les arguments d'une entrée suspendue ; chaque empilement et dépilement efface `live` |
| Canal d'échec | Charge utile d'erreur (`fvalue` de BEAM), liste d'arguments de `erlang:error/2,3`, terme de trace de pile | Terms de `GeneratedCallState` réécrits par `Term::rebind`, qui ne stocke que le nouveau mot ; les cadres de trace capturés sont des pointeurs de descripteurs vers le code |
| État d'interception (trap) | Les mots de terme du `TrapState` d'un builtin qui intercepte ([portions](builtins.md#portions)) | Libérés lorsque le builtin se termine ou échoue |
| Dictionnaire de processus | Chaque clé et chaque valeur | Jusqu'à leur effacement ou la fin du processus |
| Boîte aux lettres | Chaque message dans la boîte de réception des signaux et la file de messages, y compris les messages `'EXIT'` et `'DOWN'` | Jusqu'à ce qu'un receive le prenne ; réécrits sur place, donc le curseur de receive (une position dans la liste) et l'échéance du timeout restent valides |
| Racines explicites | La plage qu'un hôte passe à `collect(roots)` | Relues après l'appel |
| Liste hors tas | Aucun | Les liens sont balayés et rechaînés, non tracés |

Aucune cellule du tas ne détient d'épingle. Les atomes sont des immédiats et la
table des atomes n'est jamais collectée. Les cellules de fun désignent le code
via leur `FunDefinition` non tracé, qui vit aussi longtemps que le runtime ;
les modules chargés ne sont jamais déchargés, donc ni les funs ni les
descripteurs de trace n'ont besoin d'épingle. Les petits immédiats ne sont pas
des racines.

Comme dans le code C d'ERTS, un `Term` hôte est exactement un mot trivialement
copiable, valide jusqu'au prochain ramassage de son tas ou à la fin du
processus ; il n'a ni épinglage, ni pointeur de tas, ni jeton de durée de vie,
ni époque de ramassage ([propriété](terms.md#ownership)). Un accès après l'une
de ces limites lit de la mémoire déplacée ou libérée et est indéfini, sans
vérification `stale_term`. Les racines enregistrées sont réécrites ; un Term
hôte non enregistré doit être reconstruit depuis son mot racine réécrit. Un
Term appartient à son processus ; les autres processus ne peuvent le lire que
tant que la source reste stable.

Le tas ne se déplace qu'à un point sûr, et jamais tant qu'une réservation est
ouverte :

- un `collect()` hôte explicite pendant que le contexte n'exécute aucun code
  généré ;
- un `collect()` alors que du code généré en cours d'exécution a déclaré une
  portée `SafePoint`, promettant qu'il ne détient de mots du tas que dans les
  racines ci-dessus. Le runtime n'en ouvre une qu'aux points sûrs du code généré
  décrits dans la section suivante.

Toute autre requête retourne `unsafe_point` et ne change rien, pas même le canal
d'échec d'un appel généré en cours. L'allocation ne déplace jamais le tas :
une requête qui ne tient pas crée un fragment.

## Tampons de messages

Un `MessageBuffer`
([message_buffer.hpp](../runtime/src/memory/message_buffer.hpp)) garde un terme
en dehors de tout processus : `copy_of(value, sender)` copie le graphe depuis
le tas du processus expéditeur dans son propre `HeapStorage`. Le
`ProcessContext` de l'expéditeur fournit les options de tas, les zones de
littéraux, les atomes, les identités et le compte mémoire du runtime ; le tampon
conserve son propre jeton de durée de vie et partage les binaries hors tas.
Il utilise le même `GraphCopy` qu'un envoi ; `copy_to` le copie dans le tas
d'un destinataire. Les immédiats et les racines littérales n'ont besoin
d'aucun stockage. Les fabriques, les réservations et les tampons de messages
conservent leurs vérifications de durée de vie (`expired_context`) ; un Term
lu dans un tampon n'épingle rien et ne doit pas survivre à son stockage.
Le tampon n'est jamais collecté et est libéré avec son dernier propriétaire ;
son bloc fait exactement les mots du terme, quel que soit le tas minimal de
l'expéditeur. Les messages vers un processus s'exécutant sur un autre thread
de travail ([workers](processes.md#workers)), les messages des timers et les
étiquettes de moniteurs l'utilisent, si bien qu'ils ne sont jamais réencodés ;
les [termes persistants](runtime.md#persistent-terms) vivent dans leur propre
plage d'adresses et sont copiés, sans partage, dans les tampons.

**Remise des messages.** Un envoi dont le message occupe au moins
`MessageBuffer::ADOPTED_WORDS` (512) mots, comptés par
`MessageBuffer::large(value, sender, minimum)` avec un parcours borné qui
s'arrête à cette valeur, construit le tampon avant de prendre le verrou de
l'exécuteur, si bien que l'expéditeur ne détient aucun verrou pendant la copie.
Le destinataire reprend ensuite le tampon au lieu de le copier
(`MessageBuffer::take`, `HeapStorage::adopt`), lorsque le tampon n'a pas
d'autre propriétaire et que le destinataire a un bloc de tas et pas de budget :
le bloc rejoint ses fragments aux mêmes adresses, les listes de binaries hors
tas et de maps du tampon rejoignent les siennes avec leurs imputations, et le
tampon est laissé vide. Personne d'autre ne peut atteindre le bloc avant ou
après, donc aucun mot n'est copié deux fois. Les fragments adoptés ne demandent
une collecte qu'une fois que leurs mots atteignent ceux du jeune bloc, comme
les fragments de messages d'ERTS, et la collecte suivante les traite comme des
données jeunes. Les messages plus petits sont copiés, comme avant : c'est moins
coûteux qu'un fragment pour chacun.

## Collecte dans le code généré

Le code généré n'effectue de collecte qu'à quelques **points sûrs** (safepoints)
où chaque terme vivant se trouve déjà dans une racine. Tout le reste, y compris
chaque service qui alloue, est une **section critique** qui ne déplace jamais le
tas.

### Déclencheurs

Un point sûr effectue une collecte lorsque le tas le demande
(`wants_collection()`) ; sinon il coûte une vérification.

| Déclencheur | Condition au point sûr | Équivalent ERTS |
| --- | --- | --- |
| Tas plein | Un fragment existe : une allocation n'a pas tenu dans le bloc de tas depuis la dernière collecte | Le sommet du tas atteint la fin du tas |
| Pression des binaries hors tas (une collecte mineure, sauf si la dernière a libéré moins de la moitié, [pression des binaries](#generations)) | Les mots hors tas atteignent la limite du tas binaire virtuel : 46 422 mots au départ, après chaque collecte le double des mots hors tas survivants ou les survivants plus les mots vivants du tas, selon la plus grande valeur (jamais moins de 46 422), mais au plus les survivants plus la moitié du budget laissé libre après le bloc de tas | `bin_vheap_sz` / tas binaire virtuel |
| `erlang:garbage_collect/0,1,2` | Une requête du builtin ([introspection](processes.md#introspection)), prise en compte au prochain point sûr de la cible | Balayage complet explicite |

Un point sûr exécute une **collecte mineure**, sauf si un balayage complet est
dû : une requête `garbage_collect`, une pression des binaries hors tas, un
budget de tas, ou une vieille zone sans place pour les mots mûrs
([générations](#generations)). Le `ProcessHeap::collect` public est toujours un
balayage complet.

Le nouveau bloc est dimensionné pour les mots vivants **plus les mots de pile
utilisés** (ERTS garde la pile à l'intérieur du bloc de tas) : une pile profonde
obtient un tas plus grand, si bien qu'une longue récursion effectue des collectes
proportionnelles à ses allocations plutôt que de reparcourir toute la pile toutes
les quelques centaines de mots.

### Points sûrs

| Point | Emplacement | Vivant hors des emplacements de termes des cadres |
| --- | --- | --- |
| Entrée de fonction | Dans `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (et donc l'invocation hôte), avant l'empilement du cadre de l'appelé ; une entrée en ligne prend ce chemin chaque fois que le tas demande une collecte | Les arguments de l'appelé `x[0..arity)`, gardés comme racines (`keep_registers`) |
| Tête de boucle | `CLAUSE_safepoint_v1(context)` en tête de chaque boucle de générateur de comprehension, appelé seulement tant que le tas demande une collecte | Rien |

Toute boucle Erlang est soit une récursion, qui passe par une entrée de fonction
à chaque itération, soit une comprehension, qui passe par sa tête de boucle,
donc les déchets entre deux points sûrs sont bornés par du code linéaire et des
résultats de service uniques.

Ne sont pas des points sûrs (sections critiques, qui continuent d'allouer dans
des fragments) : tous les autres services du runtime, y compris les services
d'allocation, de construction et de correspondance ; `CLAUSE_return_v1` ; la
propagation des exceptions ; et la remise des messages. Les services peuvent
donc détenir des mots bruts du tas en C++ pendant toute leur exécution, et leurs
tableaux d'entrée et leurs sorties n'ont pas besoin d'être rechargés.

### Processus en attente et suspendus

Un processus qui ne s'exécute pas n'est jamais collecté : il attend dans un
receive, est en file après un yield ou un trap, ou n'a pas encore démarré, et
tout ce qu'il détient est déjà une racine (ses cadres, les registres de l'entrée
ou de la continuation à laquelle il reprendra, l'état de trap et ses messages).
Les messages qui lui sont envoyés sont copiés dans des fragments de son tas.
Chaque remise réveille un processus en attente, et sa reprise répète l'entrée
de sa continuation (le builtin d'attente, une continuation de trap ou la
fonction à laquelle il a cédé), ce qui est un point sûr d'entrée de fonction :
la première chose que fait un processus repris est une collecte si son tas la
demande. Un processus qui attend dans un receive sélectif sautant de nombreux
messages effectue donc des collectes à mesure qu'ils arrivent, de même qu'ERTS
collecte un processus lors de sa prochaine planification. Le golden
`executables_mailbox_collection` couvre l'accumulation, l'attente avec timeout,
la récursion profonde sous charge de messages, et un consommateur accusant
réception de 3 000 messages dans les limites de `--max-heap 65536`.

L'allocation n'est pas un point sûr (contrairement au `test_heap` de BEAM) :
cela exigerait que chaque entrée de service et chaque terme SSA vivant au
travers d'une allocation soit dans une racine, un rechargement après chaque
service qui alloue et un protocole de nouvelle tentative dans chaque service,
alors que les deux points sûrs ci-dessus bornent déjà les déchets.

### Règle de rechargement

Aucune valeur SSA (une valeur dans un registre natif) ne détient de mot du tas à
travers un point sûr, et aucun pointeur natif n'en traverse un du tout (c'est
déjà une erreur dans `lower_frames`).

- `lower_frames` traite un appel de point sûr de tête de boucle comme le point
  de reprise d'un appel : il scinde le bloc après l'appel et déverse chaque
  valeur lue après lui qui a été calculée avant lui. Une **valeur de terme** (un
  chargement depuis un emplacement de terme ou un registre, une valeur stockée
  dans un emplacement de terme, ou un PHI de telles valeurs) est stockée après
  sa définition dans son emplacement de terme existant ou dans un nouvel
  emplacement de terme compté dans les `roots` du descripteur, puis rechargée
  avant chaque utilisation. Les autres mots (petits immédiats, atomes, entiers
  bruts, indicateurs) gardent des emplacements bruts : une collecte ne les
  modifie jamais.
- Les appels déversent et rechargent de la même manière, les termes dans des
  emplacements de termes, si bien que le point sûr d'entrée voit chaque terme
  vivant de chaque appelant.
- La base du cadre reste valide à travers un point sûr de tête de boucle, car
  une collecte réécrit les mots de la pile sur place et ne déplace jamais la
  pile ; chaque transfert la relit dans le prologue du corps comme auparavant.
- L'optimisation s'exécute après `lower_frames` et ne peut pas remplacer un
  rechargement par l'ancienne valeur SSA : l'adresse du cadre est chargée depuis
  le `FrameState` du contexte, et l'appel opaque de point sûr peut écrire chaque
  emplacement à travers elle ([prototype](#prototype)).

### Comportement en cas d'échec

- Une collecte à un point sûr n'enregistre jamais d'échec. Lorsque son nouveau
  bloc ne peut pas être alloué (`out_of_memory`), le tas reste tel quel et
  l'exécution continue avec des fragments.
- **Épuisement de la mémoire.** Sans plafond, la mémoire ne s'épuise que
  lorsque l'hôte refuse un bloc de tas, un fragment, un tampon hors tas ou une
  croissance de pile : `out_of_memory`. Avec un budget optionnel ou une
  [limite globale du runtime](#runtime-memory-limit) définis, une requête
  au-delà donne `limit_exceeded`, signalé comme `resource_limit`. Les deux sont
  des échecs d'infrastructure : aucun gestionnaire ne s'exécute, les cadres se
  déroulent jusqu'au cadre du fond et un programme affiche
  `clau: runtime failure: entry call failed: <status>` puis se termine avec le
  code 70 après avoir vidé stdout et détruit le processus
  ([exécutables](executables.md#exit-status), [différences](differences.md)).
  Comme chaque collecte garde libre la moitié du budget restant après ses
  survivants ([dimensionnement](#sizing-and-budget), [déclencheurs](#triggers)),
  un budget n'échoue que lorsque l'ensemble vivant ne tient plus ou lorsque du
  code linéaire entre deux points sûrs alloue plus que cette moitié ; les
  déchets sont collectés d'abord.

### Implémentation

- `ProcessStack::safepoint(live)` interroge `ProcessHeap::wants_collection()`
  (un fragment existe, les mots hors tas ont atteint `binary_limit_words_`, ou
  une collecte a été demandée), garde `x[0..live)` comme racines, ouvre un
  `SafePoint` et effectue la collecte ; une collecte échouée est ignorée.
  `enter` (et donc `tail` et `invoke`) l'appelle avec l'arité de l'appelé avant
  l'empilement ; `CLAUSE_safepoint_v1` l'appelle avec 0.
- L'abaissement des comprehensions émet la vérification de tête de boucle en
  tête de chaque boucle de générateur (`lowering_comprehensions`).
- `lower_frames` scinde chaque corps après un appel de point sûr et déverse les
  valeurs qui le traversent comme après un appel. Les arguments arrivent dans
  des registres et ne sont pas stockés à l'entrée : un argument qui traverse un
  appel ou un point sûr est stocké dans son propre emplacement d'argument après
  son arrivée. `home()` conserve l'emplacement d'argument ou un emplacement de
  terme du même bloc lorsqu'il contient la valeur ; sinon une valeur de terme
  (`term_value` : chargée depuis un emplacement de terme ou un registre,
  stockée dans un emplacement de terme, ou un PHI de celles-ci) reçoit un
  nouvel emplacement de terme, que `place_slots` ajoute à la suite des
  emplacements de termes de tête avant les emplacements bruts, et toute autre
  valeur un emplacement brut.
- `collected_size` plafonne le bloc à `block_limit(live)` ; `shrink` s'exécute
  aussi lorsque le bloc dépasse la limite des mots survivants ; `collect`
  plafonne `binary_limit_words_` aux survivants plus la moitié du budget laissé
  libre après le bloc.
- Couverture : les goldens OTP `executables_garbage_collection` (plus de
  64 Mio alloués avec un petit ensemble vivant : boucles terminales, binaries
  hors tas, filtres de comprehension qui allouent, récursion de corps profonde,
  charge utile d'erreur capturée ; avec des exécutions plafonnées sous
  `--max-heap`, `--max-stack` et `--max-memory`) et `executables_heap_growth`
  (72 Mo de binaries retenus) ; `runtime_collection` `near_budget` et
  `shared_limit` vérifient le budget et la limite globale du runtime.

### Prototype

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) contient une boucle
de style comprehension sous forme post-`lower_frames` (`loop.ll`) : un terme `Y`
calculé avant la boucle est stocké dans un emplacement de terme et rechargé
après le point sûr de tête de boucle. `python tests/prototypes/safepoint/run.py`
le compile pour `x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu`,
`i686-pc-windows-msvc` et `armv7-unknown-linux-gnueabihf` en O0 et O2 et
vérifie qu'un chargement du mot de cadre de `Y` suit l'appel de point sûr, si
bien que l'optimiseur ne réutilise jamais le registre qui contenait `Y`.

## Collecte

Une copie de Cheney (`memory/heap_collect`), en balayage complet ou en collecte
mineure ([générations](#generations)) : allouer d'abord le nouveau bloc (un
échec donne `out_of_memory` et laisse le tas intact), puis copier
l'objet derrière chaque mot racine et parcourir
le nouveau bloc de gauche à droite en copiant les enfants de chaque copie.
L'en-tête d'un objet boxed déplacé est remplacé par un pointeur boxed vers sa
copie ; une cellule cons déplacée reçoit une tête nulle et une queue pointant
vers sa copie. Le renvoi préserve le partage. Les racines sont réécrites sur
place, la liste hors tas est balayée (copies rechaînées dans l'ordre de la
liste, cellules mortes détruites), et l'ancien bloc et les fragments sont
libérés. Un tas jamais alloué n'est pas collecté. `CollectionStats` indique les
mots avant, les mots vivants, le nouveau bloc de tas, les fragments fusionnés,
la capacité en emplacements de la pile et les mots hors tas.

## Générations

Collecte générationnelle, comme la fait ERTS, sans sa barrière d'écriture :

- **Marque de niveau haut.** Après une collecte, chaque objet du nouveau bloc a
  survécu à une collecte ; le sommet du bloc devient la marque de niveau haut
  (high-water mark). La collecte mineure suivante copie le jeune bloc et les
  fragments, en **promouvant** les objets situés sous la marque dans la vieille
  zone et le reste dans un nouveau jeune bloc.
- **Vieille zone.** Un bloc qui ne bouge jamais entre deux balayages complets ;
  une collecte mineure ne le copie ni ne le parcourt. Elle est créée par la
  première collecte mineure qui promeut, dimensionnée au double des mots mûrs.
  Lorsqu'elle ne peut pas accueillir les mots mûrs, le point sûr exécute à la
  place un balayage complet, qui laisse tout dans le nouveau bloc sous sa marque
  de niveau haut et libère la vieille zone.
- **Invariant.** Un objet immuable ne pointe que vers des objets plus anciens
  que lui, si bien que la promotion par adresse ne laisse jamais un vieil objet
  pointer vers un jeune. Les écritures sur place du runtime le respectent : les
  boucles de binaries et les binaries extensibles écrivent des entiers, et une
  mise à jour de map ne modifie sur place que des nœuds créés depuis la
  dernière collecte. Les builds de débogage vérifient après chaque collecte
  mineure qu'aucun vieil objet ne pointe dans le jeune bloc ou dans un fragment.
- **Balayages.** La liste des binaries hors tas conserve les cellules de la
  vieille zone, rechaîne celles qui ont été renvoyées et libère les jeunes
  cellules mortes ; les vieilles cellules mortes attendent le prochain balayage
  complet.
- **Dimensionnement du jeune bloc.** Une collecte mineure conserve la taille du
  jeune bloc, comme le fait ERTS, et au moins un huitième de la vieille zone
  (ERTS). Le code généré n'effectue de collecte qu'aux points sûrs, si bien que
  l'allocation entre deux d'entre eux (les retours d'une récursion de corps)
  peut déborder loin dans les fragments ; lorsqu'ils contiennent un quart du
  bloc ou plus, le bloc suivant grandit d'autant et n'est pas réduit. Sinon, un
  jeune bloc de plus de 8 000 mots vivant à moins de 25 % est copié dans trois
  fois ses mots vivants (la règle mineure d'ERTS).
- **Limite hors tas.** Après une collecte mineure, la limite du tas binaire
  virtuel ne compte que les jeunes mots vivants : la vieille zone peut contenir
  des mots morts, qui ne doivent pas retarder le balayage complet qui libère les
  vieux binaries morts.
- **Pression des binaries.** Atteindre la limite collecte la jeune génération,
  comme le fait le tas binaire virtuel d'ERTS, ce qui libère les binaries des
  jeunes cellules mortes. Lorsqu'une telle collecte mineure libère moins de la
  moitié des mots hors tas, la suivante due à la pression des binaries est un
  balayage complet, qui libère aussi les binaries des vieilles cellules mortes
  (`binary_sweep_due_`).

## Copie entre tas

`ProcessHeap::add(value)`, ou de manière équivalente `value.copy_to(heap)`,
retourne un terme du tas de destination (`size_object` et `copy_struct` de
BEAM). Les cellules sources sont lues via des pointeurs de
confiance, et une cellule cons n'a pas besoin d'être analysée :

- Un terme que la destination peut lire (son propre tas ou une zone de
  littéraux, vérifié par `storage_->readable(address)`) conserve son identité ;
  les autres graphes sont copiés. Les zones de littéraux reconnues par le
  registre du runtime de destination restent partagées. Les deux tas doivent
  être vivants et appartenir au même runtime : un contrat pour l'appelant,
  sans vérification entre runtimes sur les copies composées ni vérification
  de durée de vie de la source par handle. Lire une source après un ramassage
  ou sa fin est indéfini. Les atomes, pids et ports racines passent toujours
  par l'admission de destination ; une destination expirée signale
  `expired_context`. Les fabriques refusent toujours les entrées composées
  étrangères (`ProcessHeap::retain`), donc seule une copie explicite déplace
  un graphe.
- Les copies sont plates, comme le `copy_struct` par défaut d'ERTS (sans sa
  variante optionnelle qui préserve le partage) : un sous-terme est copié une
  fois par chemin qui l'atteint, donc `{T, T}` copie `T` deux fois, et un terme
  dont le partage double à chaque niveau grandit exponentiellement, comme sur
  OTP. Un parcours avec une pile explicite (sans récursion) additionne les mots
  de chaque objet atteint ; la copie est une réservation unique de cette somme,
  dans le bloc de tas ou un fragment, remplie par un second parcours dans le
  même ordre qui relit chaque cellule et fait pointer chaque emplacement vers la
  copie de son enfant. Aucune table n'associe les objets source à leurs copies,
  et seules les cellules de binaries et les talons de maps conservent leurs
  décalages.
- La copie d'un binary hors tas est une nouvelle cellule partageant le tampon ;
  la destination prend une référence sur le tampon (en imputant ses propres mots
  hors tas si elle n'en détenait aucune) avant de réserver, et n'inscrit la
  cellule dans sa liste qu'après la validation de la réservation.
- La source est seulement lue. Un échec (`resource_limit` pour le budget de la
  destination ou la limite du runtime, `out_of_memory` pour l'hôte) abandonne
  les références sur les tampons et annule la réservation, si bien que les deux
  tas et toutes les imputations sont comme avant. Une copie ne possède aucun
  stockage de la source : elle survit à la collecte et au démontage de la
  source.

## Mesures

`runtime_heap_measurements` (CTest en mode complet ; chiffres affichés, sans
seuil) construit une liste de 100 000 éléments de tuples `{Index, Float}` via
`TermFactory`, la parcourt de nouveau via des accesseurs vérifiés, effectue une
collecte avec la liste comme seule racine et parcourt la copie, et crée
1 000 contextes qui détiennent chacun un petit tuple. Il indique les temps de
construction et de parcours, les mots de tas utilisés et la capacité, les
octets annexes (allocations hôtes au-delà du stockage du tas) ainsi que les
octets et les mots de tas par contexte.
