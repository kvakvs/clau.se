---
source: docs/runtime-heap.md
sourceCommit: 06042fa
sourceSha256: b86a14bcde03a998409e7048283225de3a5f8f84ded889ba64544a4671571cbc
translatedAt: 2026-10-09
---
# Contrat du tas de processus

Les tas de processus suivent la conception classique d'ERTS. Cette note en est
le contrat ; le plan 11 phase C (steps 8A–8I) l'a livré, et les steps
ultérieurs nommés ci-dessous l'étendent.
[runtime.md](runtime.md#process-memory) résume l'API.

## Ce que la phase C a remplacé

| Avant la phase C | Problème | Remplacement |
| --- | --- | --- |
| Une liste de blocs (chunks) qui ne bougent jamais | Les cellules ne peuvent être ni compactées ni copiées ; la capacité ne fait que croître | Un bloc de tas contigu plus des fragments, déplacés par un ramasse-miettes par copie (8G, 8H) |
| Chaque cellule est un nœud dans un index `std::map` par processus | Les mots du tas seuls ne sont pas analysables ; une allocation hôte et une recherche en O(log n) par cellule | Cellules autodescriptives ; admission par plage possédée et en-tête (8C, 8D) |
| Chaque cellule de bitstring a un tableau fixe de 64 octets et un `shared_ptr`, libérés via un registre de destructeurs | Grandes cellules pour de petites données ; rien ne peut déplacer une cellule ni retrouver ses copies mortes | Binaries de tas de taille variable et cellules de binaries hors tas dans une liste hors tas par processus (8B) |
| Le `Term` hôte épingle le tas avec `shared_ptr<HeapStorage>` ; les valeurs détenues par le runtime vivent uniquement dans des `Term` | Rien qu'un ramasse-miettes puisse trouver ou réécrire | Modèle ERTS : le C++ ne détient des mots bruts qu'entre deux points sûrs ; les valeurs détenues par le runtime sont des mots racines du processus ; les appelants hôtes passent des racines explicites à `collect()` (8E) |
| Un tampon de tas par cadre racine généré | Aucune pile de processus à parcourir | Une pile de cadres racines par processus (8F) |
| Pas de zone de débordement | Une allocation tient dans le budget ou échoue | Des fragments de tas tant que le tas ne doit pas bouger (8G) |

Le code généré, son ABI et tout résultat observable des programmes restent
inchangés.

## Disposition des mots

Un terme est un mot de la cible (32 ou 64 bits) ; les encodages sont décrits
dans [abi.md](abi.md#terms). Chaque zone du tas est une suite d'objets qu'un
parcoureur analyse à partir de son premier mot :

- **Mot d'en-tête** (étiquette primaire `00`) : les bits 2 à 6 contiennent le
  `BoxedKind`, les bits 7 et au-delà le nombre de mots qui suivent l'en-tête.
  Un terme boxed pointe sur son en-tête. Le compte couvre chaque mot de préfixe,
  de charge utile et de remplissage, si bien que le parcoureur saute la charge
  utile non tracée sans l'interpréter.
- **Cellule cons** : deux mots de terme (tête, queue) sans en-tête. Un terme de
  liste pointe sur la tête. Une tête n'est jamais un en-tête car aucun terme n'a
  l'étiquette `00`.
- **Remplissage** : le mot entièrement nul (type `tuple`, compte 0) est un
  remplissage d'un mot ; le type `filler` avec un compte n couvre n mots
  supplémentaires. Les réservations commencent à zéro, donc les mots réservés
  mais inutilisés s'analysent comme du remplissage. Les tuples non vides ont
  toujours un compte non nul et `{}` est un immédiat.

Aucune cellule n'a besoin d'un alignement plus strict qu'un mot. `memory/heap_walk` analyse une zone cellule par cellule et `ProcessHeap::verify`
vérifie un tas entier (8C). Les cellules ne contiennent que des mots et des
octets, à l'exception du `std::shared_ptr` du binary hors tas (ci-dessous), si
bien qu'une cellule se déplace en copiant ses mots.

| Type | Mots après l'en-tête | Mots tracés |
| --- | --- | --- |
| cons (sans en-tête) | 2 mots au total | tête, queue |
| `tuple` | n emplacements d'éléments | tous |
| `map` | 2n emplacements : les clés dans l'ordre exact des termes, chacune suivie de sa valeur | tous |
| `native_record` | adresse du `RecordDefinition` du runtime, puis n valeurs de champs dans l'ordre de définition | valeurs |
| `fun_closure` | adresse du `FunDefinition` du runtime, puis n valeurs capturées ([funs](funs.md)) | valeurs |
| `bignum` | mot de signe, puis les limbes de la magnitude, les moins significatifs d'abord | aucun |
| `floating` | 8 octets : 1 mot (64 bits) ou 2 mots (32 bits) | aucun |
| `reference` | 8 octets : le numéro de référence ([pids et références](terms.md#pids-and-references)) | aucun |
| `heap_binary` | longueur en bits, puis les octets de données arrondis aux mots (au plus 64 octets) | aucun |
| `refc_binary` | décalage en bits, longueur en bits, `std::shared_ptr` (2 mots), lien hors tas : 5 mots | aucun |
| `filler` | n mots inutilisés | aucun |

Le compte d'une `map` est en mots (entrées = compte / 2). Les pids sont des immédiats, admis d'après les numéros émis
par le runtime. Les types pas encore admis (identités externes) suivront les
mêmes règles à leur arrivée : les identités et les descripteurs sont des
identifiants de registre dans des mots non tracés, jamais des pointeurs C++
propriétaires.

## Binaries hors tas

Un binary de plus de 64 octets est un tampon immuable qui flotte en dehors de
tout tas de processus, partagé par comptage de références (ProcBin et `Binary`
de BEAM).

- Sa cellule boxed `refc_binary` contient un `std::shared_ptr` vers le tampon,
  un décalage en bits et une longueur en bits ; les tranches d'un grand binary
  sont de nouvelles cellules `refc_binary` partageant le tampon (les
  sous-binaries d'ERTS ne sont pas utilisés). Copier une cellule vers un autre
  processus copie le `shared_ptr` ([copie entre tas](#copying-between-heaps)),
  jamais les octets.
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
  un `static_assert` maintient la taille de la cellule à cinq mots après
  l'en-tête pour les deux largeurs.

## Zones

- **Tas.** Un bloc `[start, top, end)` par processus avec allocation par
  incrément de pointeur (8G). Il est créé par la première allocation du
  processus, dimensionné à `max(min_heap_words, request)` afin que cette
  requête tienne toujours, et possédé par ce seul processus.
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
- **Pile.** Les cadres générés (registres Y de BEAM) vivent sur une pile plate
  par processus, séparée du tas (`ProcessStack`, step 19). Chaque cadre est un
  en-tête de quatre mots (décalage de l'en-tête de l'appelant, descripteur,
  reprise, gestionnaire) suivi d'emplacements de termes (termes déversés
  compris) et d'emplacements bruts de déversement ; les cadres sont chaînés par
  décalages, si bien que le
  bloc grandit par doublement et se déplace. Il n'a pas de plafond par défaut ;
  une limite optionnelle par processus `StackOptions::limit_words` le borne
  indépendamment du tas
  ([modèle d'exécution](execution-model.md#implementation)).
- **Liste hors tas.** Voir ci-dessus.
- **Vieux tas.** Aucun. La collecte générationnelle est différée ; les termes
  immuables ne pointent jamais de données plus anciennes vers des données plus
  récentes, donc une marque de niveau haut et un vieux tas pourront être ajoutés
  plus tard sans changer les cellules.

## Dimensionnement et budget

- Le tas commence à `min_heap_words` (233 mots, comme ERTS) et grandit selon la
  suite de tailles d'ERTS : 12, 38, puis chaque taille est la somme des deux
  précédentes plus un jusqu'à 833 026 mots, puis par paliers de 20 %
  (`heap_size_at_least`).
- Le nouveau bloc d'une collecte est la plus petite de ces tailles qui
  maintient les mots qu'il peut recevoir sous 75 % de sa taille : d'abord tous
  les mots utilisés, puisque les données vivantes ne sont pas connues avant la
  copie. Un résultat vivant à moins de 25 % est copié une fois de plus dans la
  taille dont ses données vivantes ont besoin (8H) ; si l'allocation de ce bloc
  échoue, le plus grand est conservé. Aucun des deux n'est plus petit que
  `min_heap_words`. Les deux tailles comptent les mots de la pile du processus
  comme vivants (step 26), car ERTS garde la pile à l'intérieur du bloc de tas.
- Avec un budget défini (ci-dessous), un nouveau bloc contient au plus ses mots vivants plus la moitié du
  budget restant après eux et les tampons hors tas (`block_limit`, step 27),
  jamais moins que `min_heap_words`. L'autre moitié reste libre pour les
  fragments et les nouveaux tampons hors tas, si bien que les déchets alloués
  après une collecte atteignent le point sûr suivant comme déclencheur au lieu
  d'épuiser le budget. La première copie est dimensionnée d'après tous les mots
  utilisés, donc un bloc qui dépasse la limite pour les mots ayant survécu est
  copié une fois de plus dans la taille fixée par la politique.
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

## Limite mémoire du runtime

- Une limite optionnelle globale au runtime, `RuntimeOptions::memory_limit_bytes`
  (par défaut `UNLIMITED_HEAP_BYTES` ; les programmes la définissent avec
  `--max-memory`), borne la mémoire de tous les processus ensemble : blocs de
  tas, fragments, tampons hors tas et capacité des piles (step 27A). OTP n'a pas
  de telle limite ; cela se rapproche le plus de l'exécution de la VM sous une
  limite mémoire du système d'exploitation, mais fait échouer un seul processus
  au lieu du nœud.
- Un compte par runtime (`detail::RuntimeMemory`, partagé par tous les stockages
  de tas et toutes les piles) est débité à la création d'un bloc, d'un fragment,
  d'un tampon hors tas ou d'une capacité de pile et crédité à sa suppression ;
  un tampon partagé par plusieurs processus est imputé une fois et restitué
  lorsque sa dernière référence meurt (step 28). Le démontage restitue toutes les
  imputations du processus.
  `Runtime::memory_bytes()` indique le total.
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
d'objet ; il n'y a pas de pointeurs intérieurs à détecter. L'admission (8D) est
une vérification de propriété pour les mots rendus à un processus :

1. L'adresse est alignée sur un mot à l'intérieur de l'une des zones du
   processus, sous son `top` : le bloc de tas est vérifié en premier, puis les
   fragments triés par adresse. Les mots étrangers ou périmés échouent ici sans
   aucun chargement.
2. Un mot boxed désigne un en-tête d'un type admis (pas un remplissage) ; un mot
   de liste désigne une cellule cons (un mot qui n'est pas un en-tête).

Les accesseurs décodent le type, le compte et la charge utile à partir de
l'en-tête lui-même. `verify()` reste la vérification complète, pour les tests,
que chaque emplacement désigne un début d'objet.

## Racines et points sûrs

`ProcessContext::visit_roots` énumère chaque mot racine pour le ramasse-miettes
(step 23). À un point sûr, rien d'autre ne détient de mots du tas du
processus :

| Propriétaire | Mots racines | Notes |
| --- | --- | --- |
| Emplacements de termes des cadres | Les `roots` premiers emplacements de chaque cadre de la pile (step 19) | Les cadres du fond n'en ont aucun ; les indices de reprise et de gestionnaire sont des entiers |
| Emplacements bruts des cadres | Aucun | Valeurs natives déversées ; le code généré n'y garde aucun mot du tas à un point sûr (règle de rechargement du step 24) |
| Registres | `x[0..live)` (`ProcessStack::keep_registers`) | Les arguments d'une entrée suspendue (step 43) ; chaque empilement et dépilement efface `live` |
| Canal d'échec | Charge utile d'erreur (`fvalue` de BEAM), liste d'arguments de `erlang:error/2,3`, terme de trace de pile | Reliés sur place ; les cadres de trace capturés sont des pointeurs de descripteurs vers le code |
| État d'interception (trap) | Les mots de terme du `TrapState` d'un builtin qui intercepte (step 43A) | Libérés lorsque le builtin se termine ou échoue |
| Boîte aux lettres | Chaque message dans la boîte de réception des signaux et la file de messages (step 45), y compris les messages `'EXIT'` et `'DOWN'` | Jusqu'à ce qu'un receive le prenne ; réécrits sur place, donc le curseur de receive (une position dans la liste) et l'échéance du timeout restent valides |
| Racines explicites | La plage qu'un hôte passe à `collect(roots)` (8E) | Relues après l'appel |
| Liste hors tas | Aucun | Les liens sont balayés et rechaînés, non tracés |

Aucune cellule du tas ne détient d'épingle. Les atomes sont des immédiats et la
table des atomes n'est jamais collectée. Les cellules de fun désignent le code
via leur `FunDefinition` non tracé, qui vit aussi longtemps que le runtime ;
les modules chargés ne sont jamais déchargés, donc ni les funs ni les
descripteurs de trace n'ont besoin d'épingle. Les petits immédiats ne sont pas
des racines.

Comme dans le code C d'ERTS, un `Term` hôte est un mot étiqueté brut valide
jusqu'au prochain point sûr de son tas. Il n'épingle pas le stockage du tas ; il
garde un jeton faible de durée de vie du contexte et le compteur de collectes du
tas, si bien qu'une utilisation après le démontage signale `expired_context` et
qu'une utilisation après une collecte ultérieure signale une erreur de terme
périmé. Un `Term` n'est valide qu'à l'intérieur de son propre processus ; les
autres processus peuvent seulement le lire.

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

## Collecte dans le code généré

Décision du plan 11 step 24 (2026-10-06), implémentée au step 26
([implémentation](#implementation)). Le code
généré n'effectue de collecte qu'à quelques **points sûrs** (safepoints) où
chaque terme vivant se trouve déjà dans une racine. Tout le reste, y compris
chaque service qui alloue, est une **section critique** qui ne déplace jamais le
tas.

### Déclencheurs

Un point sûr effectue une collecte lorsque le tas le demande ; sinon il coûte
une vérification.

| Déclencheur | Condition au point sûr | Équivalent ERTS |
| --- | --- | --- |
| Tas plein | Un fragment existe : une allocation n'a pas tenu dans le bloc de tas depuis la dernière collecte | Le sommet du tas atteint la fin du tas |
| Pression des binaries hors tas | Les mots hors tas atteignent la limite du tas binaire virtuel : 46 422 mots au départ, après chaque collecte le double des mots hors tas survivants, jamais moins, mais au plus les survivants plus la moitié du budget laissé libre après le bloc de tas (step 27) | `bin_vheap_sz` / tas binaire virtuel |
| `erlang:garbage_collect/0` | Toujours ; arrive avec les familles de builtins (steps 36-37) sous forme de point sûr forcé | Balayage complet explicite |

Le nouveau bloc est dimensionné pour les mots vivants **plus les mots de pile
utilisés** (ERTS garde la pile à l'intérieur du bloc de tas) : une pile profonde
obtient un tas plus grand, si bien qu'une longue récursion effectue des collectes
proportionnelles à ses allocations plutôt que de reparcourir toute la pile toutes
les quelques centaines de mots.

### Points sûrs

| Point | Emplacement | Vivant hors des emplacements de termes des cadres |
| --- | --- | --- |
| Entrée de fonction | Dans `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (et donc l'invocation hôte), avant l'empilement du cadre de l'appelé | Les arguments de l'appelé `x[0..arity)`, gardés comme racines (`keep_registers`) |
| Tête de boucle | Un appel de `CLAUSE_safepoint_v1(context)` en tête de chaque boucle de générateur de comprehension | Rien |

Toute boucle Erlang est soit une récursion, qui passe par une entrée de fonction
à chaque itération, soit une comprehension, qui passe par sa tête de boucle,
donc les déchets entre deux points sûrs sont bornés par du code linéaire et des
résultats de service uniques.

Ne sont pas des points sûrs (sections critiques, qui continuent d'allouer dans
des fragments) : tous les autres services du runtime, y compris les services
d'allocation, de construction et de correspondance ; `CLAUSE_return_v1` ; la
propagation des exceptions ; et plus tard la remise des messages (step 45). Les
services peuvent donc détenir des mots bruts du tas en C++ pendant toute leur
exécution, et leurs tableaux d'entrée et leurs sorties n'ont pas besoin d'être
rechargés.

### Processus en attente et suspendus

Plan step 51. Un processus qui ne s'exécute pas n'est jamais collecté : il attend
dans un receive, est en file après un yield ou un trap, ou n'a pas encore
démarré, et tout ce qu'il détient est déjà une racine (ses cadres, les registres
de l'entrée ou de la continuation à laquelle il reprendra, l'état de trap et
ses messages). Les messages qui lui sont envoyés sont copiés dans des fragments
de son tas. Chaque remise réveille un processus en attente, et sa reprise répète
l'entrée de sa continuation (le builtin d'attente, une continuation de trap ou
la fonction à laquelle il a cédé), ce qui est un point sûr d'entrée de
fonction : la première chose que fait un processus repris est une collecte si
son tas la demande. Un processus qui attend dans un receive sélectif sautant de
nombreux messages effectue donc des collectes à mesure qu'ils arrivent, de même
qu'ERTS collecte un processus lors de sa prochaine planification.
`executables_mailbox_collection` vérifie l'accumulation, l'attente avec timeout
et la récursion profonde sous charge de messages, ainsi qu'un consommateur
accusant réception de 3 000 messages reste dans `--max-heap 65536`.

Rejeté : l'allocation comme point sûr (`test_heap` de BEAM). Cela exigerait que
chaque entrée de service et chaque terme SSA vivant au travers d'une allocation
soit dans une racine, un rechargement après chaque service qui alloue et un
protocole de nouvelle tentative dans chaque service, alors que les deux points
sûrs ci-dessus bornent déjà les déchets.

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
  rechargement par l'ancienne valeur SSA : l'adresse du cadre provient de
  `CLAUSE_frame_v1`, donc l'appel de point sûr peut écrire chaque emplacement
  (prototype ci-dessous).

### Comportement en cas d'échec

- Une collecte à un point sûr n'enregistre jamais d'échec. Lorsque son nouveau
  bloc ne peut pas être alloué (`out_of_memory`), le tas reste tel quel et
  l'exécution continue avec des fragments.
- **Épuisement de la mémoire** (step 27). Sans plafond, la mémoire ne s'épuise
  que lorsque l'hôte refuse un bloc de tas, un fragment, un tampon hors tas ou
  une croissance de pile : `out_of_memory`. Avec un budget optionnel ou une
  [limite globale du runtime](#runtime-memory-limit) définis, une requête
  au-delà donne `limit_exceeded`, signalé comme `resource_limit`. Les deux sont
  des échecs d'infrastructure : aucun gestionnaire ne s'exécute, les cadres se
  déroulent jusqu'au cadre du fond et un programme affiche
  `clau: runtime failure: entry call failed: <status>`
  puis se termine avec le code 70 après avoir vidé stdout et détruit le
  processus ([exécutables](executables.md#exit-status), [différences](differences.md)).
  Comme chaque collecte garde libre la moitié du budget restant après ses
  survivants ([dimensionnement](#sizing-and-budget), [déclencheurs](#triggers)),
  un budget n'échoue que lorsque l'ensemble vivant ne tient plus ou lorsque du
  code linéaire entre deux points sûrs alloue plus que cette moitié ; les déchets
  sont collectés d'abord.

### Implémentation

Step 26 (2026-10-06) :

- `ProcessStack::safepoint(live)` interroge `ProcessHeap::wants_collection()`
  (un fragment existe, ou les mots hors tas ont atteint `binary_limit_words_`),
  garde `x[0..live)` comme racines, ouvre un `SafePoint` et effectue la
  collecte ; une collecte échouée est ignorée. `enter` (et donc `tail` et
  `invoke`) l'appelle avec l'arité de l'appelé avant l'empilement ;
  `CLAUSE_safepoint_v1` l'appelle avec 0.
- L'abaissement des comprehensions émet `CLAUSE_safepoint_v1` en tête de chaque
  boucle de générateur (`lowering_comprehensions`).
- `lower_frames` scinde chaque corps après un appel de point sûr et déverse les
  valeurs qui le traversent comme après un appel. `home()` conserve
  l'emplacement d'argument ou un emplacement de terme du même bloc lorsqu'il
  contient la valeur ; sinon une valeur de terme (`term_value` : chargée depuis
  un emplacement de terme ou un registre, stockée dans un emplacement de terme,
  ou un PHI de celles-ci) reçoit un nouvel emplacement de terme, que
  `place_slots` ajoute à la suite des emplacements de termes de tête avant les
  emplacements bruts, et toute autre valeur un emplacement brut.
- La référence `executables_garbage_collection` (générée par OTP) alloue plus de
  64 Mio avec un petit ensemble vivant : une boucle terminale construisant une
  chaîne de 400 mots à chaque itération, 9 000 binaries hors tas de 8 Kio, une
  comprehension dont le filtre alloue pour chaque élément, une récursion de corps
  profonde de 20 000 niveaux gardant un terme imbriqué (tuple, liste, binary) par
  cadre, et une charge utile d'erreur capturée après le déroulement de cadres qui
  allouent puis conservée pendant une longue boucle qui alloue.

Step 27 (2026-10-06) :

- `collected_size` plafonne le bloc à `block_limit(live)` ; `shrink` s'exécute
  aussi lorsque le bloc dépasse la limite des mots survivants ; `collect`
  plafonne `binary_limit_words_` aux survivants plus la moitié du budget laissé
  libre après le bloc.
- Auparavant, un bloc pouvait prendre tout le budget restant (dimensionné
  d'après les mots utilisés, déchets compris) et le tas binaire virtuel pouvait
  le dépasser dès que les survivants dépassaient la moitié du budget, si bien que
  des allocations échouaient alors que des déchets n'étaient pas encore
  collectés : avec le budget de 64 Mio alors par défaut, une exécution 64 bits
  retenant 700 binaries de 64 Kio tout en en abandonnant quatre par itération
  échouait à 68 % de données vivantes ; avec les plafonds, 1 010 (99 %)
  tiennent.
- Le budget de tas par défaut de 64 Mio et le budget de pile de 2^24 mots ont
  été supprimés (directive de l'utilisateur) : les deux sont optionnels par
  processus (`Runtime::create_context(HeapOptions, StackOptions)`), sans
  plafond par défaut.
- La référence `executables_heap_growth` garde 1 100 binaries de 65 540 octets
  (72 Mo) tout en en abandonnant quatre par itération et affiche le compte comme
  le fait OTP. `runtime_collection` `near_budget` vérifie les deux plafonds avec
  un budget de 10 000 mots (bloc de tas et tampons hors tas).

Step 27A (2026-10-06) :

- Limite globale du runtime et `--max-heap`, `--max-stack`, `--max-memory`
  ([limite mémoire du runtime](#runtime-memory-limit)). Des exécutions de
  référence rédigées à la main prouvent de nouveau que la mémoire est bornée :
  `garbage_collection` `churn` et `binaries` sous une limite de runtime de
  1 Mio, `comprehension` sous un plafond de tas de 1 Mio et `payload` sous une
  limite de runtime de 16 Mio (chacun alloue plus de 64 Mio) ; les boucles
  `tail_calls` sous une pile de 4 Kio et un plafond de tas de 64 Kio ; `deep`
  sous 1 Mio et `deep_recursion` `build` sous une pile de 64 Kio échouent avec
  `resource_limit`. `deep` lui-même a besoin d'environ 100 Mio en O0 (les cadres
  vivants gardent des termes périmés et font environ 130 mots chacun), il n'a
  donc pas d'exécution réussie avec plafond.
  `runtime_collection` `shared_limit` : deux processus sous une limite de
  40 000 mots ; le bloc du détenteur s'arrête à 28 000 mots, l'autre collecte 20
  séries de déchets près de la limite, puis échoue sur une liste de 16 000 mots
  avec `resource_limit` tandis que le détenteur continue d'allouer, et le
  démontage restitue toutes les imputations.

### Prototype

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) contient une boucle
de style comprehension sous forme post-`lower_frames` (`loop.ll`) : un terme `Y`
calculé avant la boucle est stocké dans un emplacement de terme et rechargé
après le point sûr de tête de boucle. `python tests/prototypes/safepoint/run.py`
le compile pour `x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu` (mots de
64 bits), `i686-pc-windows-msvc` et `armv7-unknown-linux-gnueabihf` (mots de
32 bits) en O0 et O2 et vérifie qu'un chargement du mot de cadre de `Y` suit
l'appel de point sûr. Les huit réussissent avec clang 23.1.2. En O2 (i686), la
boucle conserve le rechargement depuis l'emplacement et ne réutilise jamais le
registre qui contenait `Y` :

```text
LBB0_2:                     # loop head
    pushl  %edi
    calll  _clause_safepoint_v1
    pushl  20(%esi)         # cursor reloaded from its term slot
    ...
    pushl  24(%esi)         # accumulator
    pushl  28(%esi)         # Y reloaded from its term slot
    calll  _make
```

## Collecte

Une copie de Cheney à balayage complet (8H, `memory/heap_collect`) : allouer
d'abord le nouveau bloc (un échec donne `out_of_memory` et laisse le tas
intact), puis marquer comme périmés les `Term` hôtes, copier l'objet derrière
chaque mot racine et parcourir le nouveau bloc de gauche à droite en copiant
les enfants de chaque copie. L'en-tête d'un objet boxed déplacé est remplacé par
un pointeur boxed vers sa copie ; une cellule cons déplacée reçoit une tête
nulle et une queue pointant vers sa copie. Le renvoi préserve le partage. Les
racines sont réécrites sur place, la liste hors tas est balayée (copies
rechaînées dans l'ordre de la liste, cellules mortes détruites), et l'ancien
bloc et les fragments sont libérés. Un tas jamais alloué n'est pas collecté.
`CollectionStats` indique les mots avant, les mots vivants, le nouveau bloc de
tas, les fragments fusionnés, la capacité en emplacements de la pile et les
mots hors tas.

## Copie entre tas

`ProcessHeap::add(value)`, ou de manière équivalente `value.copy_to(heap)`,
retourne un terme du tas de destination (step 28, `size_object` et
`copy_struct` de BEAM) :

- Les immédiats et les atomes du même runtime n'ont besoin d'aucun stockage, et
  un terme du tas de destination conserve son identité. Un graphe d'un autre
  processus du même runtime est copié ; le graphe d'un autre runtime donne
  `wrong_owner`, une source expirée `expired_context`, un handle source plus
  ancien que la dernière collecte de son tas `stale_term`. Les fabriques
  refusent toujours les entrées étrangères (`ProcessHeap::retain`), donc seule
  une copie explicite déplace un graphe.
- Un parcours unique avec une pile explicite (sans récursion) trouve chaque objet
  distinct atteignable depuis la valeur, indexé par adresse, si bien que le
  partage interne survit : `{T, T}` copie `T` une seule fois, contrairement au
  `copy_struct` par défaut d'ERTS, qui aplatit le partage. La copie est une
  réservation unique de la somme de leurs mots, dans le bloc de tas ou un
  fragment, remplie dans l'ordre du parcours avec les pointeurs réécrits vers
  les copies.
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
`TermFactory`, la parcourt de nouveau via des accesseurs vérifiés, et crée
1 000 contextes qui détiennent chacun un petit tuple. Depuis 8I, il effectue
aussi une collecte avec la liste comme seule racine et parcourt la copie. Les
octets annexes sont les allocations hôtes au-delà du stockage du tas (un index
d'objets avant 8D, la chaîne de fragments depuis 8G).

| Révision | Build | Construction / parcours du noyau | Mots de tas utilisés / capacité | Octets annexes | Octets par contexte | Mots de tas par contexte |
| --- | --- | --- | --- | --- | --- | --- |
| `bb09359` (liste de blocs, index d'objets) | Windows x64 Debug, clang-cl | 264 / 81 ms | 700 000 / 704 512 | 24 002 256 (environ 80 par cellule) | 66 217 | 8 192 |
| 8D (liste de blocs, plage possédée) | Windows x64 Debug, clang-cl | 185 / 147 ms | 700 000 / 704 512 | 3 440 | 66 057 | 8 192 |
| 8G (tas de 233 mots, environ 3 000 fragments) | Windows x64 Debug, clang-cl | 219 / 174 ms | 700 000 / 706 223 | 163 878 | 2 377 | 233 |
| 8I, avant collecte | Windows x64 Debug, clang-cl | 216 / 173 ms | 700 000 / 706 223 | 163 878 | 2 377 | 233 |
| 8I, après une collecte | Windows x64 Debug, clang-cl | collecte 56 ms / parcours 72 ms | 700 000 / 999 631 | 0 | — | — |

Par rapport à la référence `bb09359` : les métadonnées annexes par cellule ont
disparu (de 24 Mo à rien une fois la collecte faite), un contexte a besoin de
2,4 Ko et de 233 mots de tas au lieu de 66 Ko et 8 192 mots, la construction est
environ 20 % plus rapide, et le parcours est plus lent jusqu'à ce qu'une
collecte fusionne les fragments (l'admission par fragment est une recherche
dichotomique sur environ 3 000 plages) ; après une collecte, le parcours prend
72 ms. Un ensemble vivant de 700 000 mots est collecté en environ 56 ms dans un
bloc de 999 631 mots, la taille ERTS qui le maintient sous 75 %.
