---
source: docs/abi.md
sourceCommit: 6ed3851c
sourceSha256: 28bc0f8706b31345a108f5bf8b8e9cc549766717aa19b28e456f94ce2b1d2009
translatedAt: 2026-10-15
---
# ABI du code généré (révision 21)

Contrat privé entre la sortie du compilateur et le runtime. Il s'agit de C++23
interne au projet, non compatible avec BEAM et qui n'est pas une FFI générale.
Les objets et le runtime doivent provenir du même build ; les révisions de
descripteur plus anciennes sont rejetées avant toute utilisation.

En-têtes : [v1.hpp](../abi/include/clause/abi/v1.hpp) (types de terme, de
contexte et de fonction), [term.hpp](../abi/include/clause/abi/term.hpp)
(codec des entiers immédiats), [status.hpp](../abi/include/clause/abi/status.hpp),
[builtins.hpp](../abi/include/clause/abi/builtins.hpp),
[startup.hpp](../abi/include/clause/abi/startup.hpp) (démarrage du programme).

## Termes

Un terme est un mot non signé de la largeur d'un pointeur de la cible (32 ou
64 bits). Les dispositions dérivent de la cible LLVM configurée, si bien que le
code multicible utilise les largeurs de la cible.

- Petits entiers : quatre bits de poids faible `0xf` ; charge utile signée de
  `word_bits - 4` bits, plage `[-2^(word_bits-5), 2^(word_bits-5)-1]`. Les
  valeurs plus grandes sont des bignums sur le tas.
- Atomes : six bits de poids faible `0x0b`, charge utile non recyclée et valable
  pour tout le processus. Les identifiants ne sont jamais sérialisés ni utilisés
  pour l'ordre. `false`, `true`, `undefined`, `ok` et `error` sont fixes :
  charges utiles 0–4 dans tout runtime (révisions 11 et 13).
- Tuple vide `0x2b` et nil `0x3b` exactement ; les autres bits de charge utile
  sont invalides.
- Pids locaux : quatre bits de poids faible `0x3`, la charge utile étant le
  numéro de processus, admis uniquement lorsque le runtime l'a émis
  ([pids et références](terms.md#pids-and-references)).
- Les mots boxed et de liste pointent dans le tas du processus propriétaire et
  ne sont admis qu'après que le runtime a prouvé la propriété (voir
  [termes](terms.md)).
- Étiquettes primaires : liste `0x1`, boxed `0x2`. Un en-tête place son genre à
  partir du bit 2 et le nombre de mots qui suivent à partir du bit 7
  (`header_count_shift`) ; le genre d'un tuple est 0. Le code généré ne lit les
  éléments de tuple et les cellules cons en ligne qu'après que l'inférence ou un
  test de forme dominant a prouvé la cellule
  ([preuves](specialization.md#proofs)) ; les plans de correspondance testent
  les formes de tuple et de cons en ligne à tous les niveaux d'optimisation (une
  étiquette boxed, puis l'en-tête), et l'égalité exacte compare d'abord les
  mots, n'appelant `CLAUSE_exact_v1` que pour deux mots de liste ou boxed
  distincts. Le runtime vérifie ces constantes par assertion.

## Fonctions et symboles

Signature d'entrée (convention d'appel C native, liaison C non requise) :

```cpp
TermWord function(ProcessContext *context, const TermWord *arguments);
```

Les arguments forment un tableau emprunté, aligné sur les mots, dans l'ordre du
source (null pour l'arité 0). Le contexte est vivant et transmis inchangé à
travers les appels. Un mot retourné n'est utilisable qu'après vérification du
canal d'échec.

Symboles : `clausev1_<hex module>_<hex function>_<arity>`, hexadécimal en
minuscules des octets UTF-8, arité décimale canonique ; réversibles et
indépendants de l'hôte. Les entrées exportées sont externes, les autres
internes.

## Enregistrement des modules

Chaque module émet `clausev1_<hex module>__0.descriptor` et `.register`. Le
descripteur contient la version de l'ABI, la largeur des termes, la table des
exports (nom, arité, entrée hôte et le `FrameDescriptor` dans lequel entrent les
appels dynamiques), les graphies des atomes (paires pointeur/taille UTF-8), les
descripteurs de native records (emplacements d'atomes du module, du nom et des
champs, indicateur d'export ; [native records](native-records.md#representation))
dans une table externe `<prefix>.records` à laquelle se réfèrent les autres
modules d'un lot, et les descripteurs de funs dans une table privée
`<prefix>.funs` ([funs](funs.md#representation)). L'enregistrement appelle
`CLAUSE_register_module_v4(Runtime*)`, qui valide la version, la largeur et tous
les exports, interne les atomes, construit un registre figé et le publie avec
l'image du code en une seule transaction. Les modules en double ne remplacent
jamais le code ; tout échec ne publie rien (les atomes déjà internés restent
dans la table bornée).

- Appeler `.register` explicitement avant de résoudre les exports. Il n'y a pas
  de constructeurs globaux ; les utilisateurs d'archives statiques doivent
  référencer les entrées d'enregistrement.
- `llvm.used` conserve les descripteurs et les entrées ; une édition de liens
  sans le runtime échoue sur le symbole de service manquant.
- L'adresse du descripteur est la clé de liaison des atomes ; son image doit
  rester mappée pendant toute la durée de vie du module. Chaque runtime possède
  ses propres liaisons pour une même image.
- Les expressions d'atome lisent les emplacements via `CLAUSE_atom_v3` ; elles
  n'internent jamais.
- Un objet de démarrage (`clausev1_start`) répertorie chaque descripteur dans un
  `StartupDescriptor` et son `main` natif appelle
  `CLAUSE_main_v1(argc, argv, descriptor)`, qui enregistre tous les modules
  et exécute l'entrée ([exécutables](executables.md#startup-object)).

## Canal d'échec (révision 2)

Les erreurs ne sont pas encodées dans les bits des termes. Après chaque appel
généré qui n'est pas terminal, l'appelant vérifie le canal avant d'utiliser le
résultat ou d'évaluer l'argument suivant : il lit le mot `failed` du
`FrameState` du contexte, que le runtime maintient égal à
`CLAUSE_call_failed_v2(context)`. En cas d'échec, l'appelé retourne un mot zéro
invalide.

| Issue | Transport |
| --- | --- |
| Non-correspondance de motif, rejet par un guard | Poursuite vers le candidat suivant ; canal intact |
| Clauses épuisées | `error:function_clause` ; `error:{case_clause, Value}` avec une charge utile possédée pour un `case` ; `error:if_clause` ; `error:{try_clause, Value}` pour les clauses `of` d'un try ; `error:{else_clause, Value}` pour les clauses `else` d'un maybe |
| Échec de correspondance dans le corps | `error:{badmatch, Value}` avec une charge utile possédée |
| Comprehensions | `error:{bad_generator, Tail}`, `error:{bad_filter, Value}`, `error:{bad_generators, Inputs}` (`ErrorReason` 16-18) ; le rejet par un générateur strict donne `{badmatch, Element}` |
| Accès aux records, mauvais arguments, arithmétique, maps | `badrecord`, `badarg`, `badarith`, `badmap`/`badkey` |
| Champ de native record manquant | `ErrorReason::badfield` (20), charge utile `{{Module, Name}, Field}` |
| Appel d'une valeur (`F(Args)`) | `ErrorReason::badfun` (22, la charge utile étant la valeur), `badarity` (23, charge utile `{Fun, Args}`), `undef` (24), enregistrés par `CLAUSE_apply_v1` ([funs](funs.md)) |
| Appels dynamiques (`M:F(Args)`, `apply/2,3`, `fun M:F/A` avec des variables) | `badarg` pour un module ou une fonction qui n'est pas un atome, une liste d'arguments impropre ou une arité invalide ; `undef` lorsqu'aucun module du programme n'exporte la fonction ; `badfun`/`badarity` comme ci-dessus ([funs](funs.md#dynamic-calls)) |
| Construction native externe sans valeur | `ErrorReason::novalue` (21), charge utile `{{Module, Name}, Field}` |
| Résultat entier au-delà de la limite de taille | Issue de service `ValueOutcome::system_limit` (3) : un guard rejette, un corps lève `error:system_limit` (`ErrorReason` 19) |
| Opérande gauche paresseux invalide | `{badarg, Value}` |
| Infrastructure (OOM, limites, propriété, interne) | `CallError::runtime_failure` avec le `Status` exact |
| `erlang:error/1,2,3`, `exit/1`, `throw/1`, `erlang:raise/3` | `raised_error`/`raised_exit`/`raised_throw` : la classe provient de l'identifiant, la charge utile possédée est la raison entière |
| `erlang:halt/0,1` | `CallError::halted` avec `halt_status` (et le slogan) |

Les raisons sont des identifiants typés enregistrés par `CLAUSE_raise_v2` ; les
trois identifiants `raised_*` sélectionnent la classe `exit` ou `throw` (sinon
`error`) et portent n'importe quel terme comme raison. `error/2,3` lèvent via
`CLAUSE_error_v1(context, reason, args)`, qui conserve aussi une liste `args`
pour le cadre de pile du sommet. Le premier échec l'emporte ; les invocations
imbriquées partagent
le canal. `GeneratedInvocation` est la portée hôte : elle vérifie les échecs en
attente avant l'entrée et après le retour, copie le résultat ou l'erreur, et ne
nettoie qu'à la sortie la plus externe (y compris en cas d'exceptions C++).
Aucune exception ne traverse les entrées générées. Les appelants d'entrées
brutes doivent ouvrir une `GeneratedInvocation` ; les hôtes normaux utilisent
`ResolvedFunction::call`.

`catch Expr` redirige chaque vérification d'échec et chaque levée à l'intérieur
d'`Expr` vers un bloc gestionnaire qui appelle `CLAUSE_catch_v1(context, slot)`.
Pour une exception Erlang en attente, il écrit la valeur du catch dans
l'emplacement racine et nettoie le canal : le terme lancé, `{'EXIT', Reason}`
pour un exit, ou `{'EXIT', {Reason, []}}` pour une erreur (les raisons typées
deviennent leurs termes OTP, comme `{badmatch, V}` ; la pile est décrite
[plus bas](#stack-traces)). Les arrêts (halts) et les échecs d'infrastructure
restent en attente, et la vérification propre au gestionnaire continue vers le
gestionnaire englobant ou la sortie de la fonction. Les liaisons créées à
l'intérieur d'`Expr` ne sont plus sûres ensuite, si bien que la jonction ne
fusionne que la valeur.

`try Body of ... catch ... end` protège uniquement `Body` de la même manière. Son
gestionnaire appelle `CLAUSE_exception_v2(context, class_slot, reason_slot, stack_slot)`,
qui écrit l'atome de classe (`error`, `exit` ou `throw`), la raison et le terme
de trace de pile dans des emplacements racines et nettoie le canal (les arrêts
et les échecs d'infrastructure restent en attente comme pour
`catch`). Les clauses catch font ensuite correspondre `Class:Reason` avec des
motifs et des guards ordinaires ; une classe omise correspond à `throw`, et une
variable de pile nommée se lie au terme de pile. Si aucune ne correspond,
`CLAUSE_reraise_v2(context, class, reason, stack)` enregistre de nouveau
l'exception avec une raison `raised_*` et la même pile, qui est signalée et
capturée exactement comme l'originale.
Les clauses `of` sélectionnent sur la valeur du corps et lèvent
`{try_clause, Value}` (`ErrorReason::try_clause = 14`) ; les exceptions à
l'intérieur des clauses `of` et des gestionnaires vont au gestionnaire
englobant.

`maybe` n'a besoin d'aucun service : chaque `?=` est une correspondance
ordinaire dont l'arête d'échec quitte le corps vers la sortie du maybe avec la
valeur non appariée (déjà enracinée). Sans `else`, cette valeur est le
résultat ; sinon les clauses `else` sélectionnent sur elle comme des clauses
`case` et lèvent `{else_clause, Value}`
(`ErrorReason::else_clause = 15`) si aucune ne correspond.

Les comprehensions utilisent les services existants avec quelques opérations :
les éléments accumulés sont inversés par la construction `reverse`
(`ContainerConstruction::reverse = 2`, valeurs `{List, Tail}`), qui construit
le résultat en une seule réservation de tas ; les générateurs de listes testent
et lisent les cellules cons en ligne ; une
comprehension de binary joint ses morceaux avec `BitOperation::concat`
(`{List}`) et une comprehension de map construit sa map avec
`MapOperation::from_list` (`{Pairs}`, les clés ultérieures l'emportent). Les
générateurs de maps prennent `MapOperation::entries` (11, `{Map}`) une seule
fois : une cellule contenant les clés et les valeurs aux mots `1 + 2i` et
`2 + 2i` dans l'ordre canonique des clés (une map classique elle-même, ou une
copie en forme de tuple des entrées d'une map hors tas que seul le code généré
lit), et lisent chaque entrée en ligne ; `key_at`/`value_at`
(`{Map, Position}`) restent pour les autres appelants. L'entrée restante d'un
zip est exposée avec `MapOperation::iterator`, la chaîne `{K, V, Next}` d'OTP
se terminant par `none`.
`MapOperation::update_owned` (10) prend les opérandes de `update` pour une mise
à jour de map dont le compilateur a prouvé que la source n'est plus lue
ensuite : une map source hors tas est mise à jour sur place et son talon (stub)
est laissé consommé (vide).
Les générateurs de bitstrings utilisent l'extraction de
motif ordinaire plus un segment final `binary`/`all` pour le reste.

`try ... after A end` ajoute une seconde protection autour du corps et de toutes
les clauses `of` et catch. Sur le chemin normal, `A` s'exécute après que la
valeur sélectionnée a été enracinée, et sa valeur est ignorée. Le gestionnaire
after prend l'exception avec `CLAUSE_exception_v2`, exécute une seconde copie
de `A` et relève l'exception avec `CLAUSE_reraise_v2` ; une exception ou un
échec à l'intérieur de `A` sort plutôt par le gestionnaire englobant, en
remplaçant l'original. Les arrêts et les échecs d'infrastructure sautent `A`.
Les emplacements racines appartiennent au cadre de la fonction, si bien que
chaque chemin les libère à la sortie de la fonction.

### Traces de pile

Chaque cadre racine nomme sa fonction générée avec un
`abi::v1::FrameDescriptor` privé (descripteur de module, emplacements d'atomes
du nom de module et de fonction, arité). Lorsqu'une exception Erlang est
enregistrée, le canal copie les 8 cadres nommés les plus internes (la
`backtrace_depth` par défaut de BEAM) ; le terme
`[{Module, Function, Arity, []}, ...]` n'est construit que lorsqu'un
gestionnaire, un `catch` ou un rapport le demande. Le cadre du sommet affiche la
liste d'arguments de `error/2,3` au lieu de l'arité lorsque cet argument est une
liste.

`erlang:raise(Class, Reason, Stack)` (`CLAUSE_reraise_v2`) accepte les piles
que BEAM accepte : une liste propre de `{M, F, A}` (complétés par une
localisation `[]`) ou de `{M, F, A, Location}` avec des atomes `M`, `F` et une
liste `Location`, tronquée à 8 entrées ; la pile est alors conservée telle
quelle et les cadres ne sont plus capturés. Une classe ou une pile invalide
n'enregistre rien et l'appel s'évalue en `badarg`, comme dans OTP.
`erlang:get_stacktrace/0` est rejeté avec le texte de lint « removed »
d'OTP 29.

Différences par rapport à OTP, toutes visibles uniquement dans le terme de
pile :

- Les localisations sont toujours `[]` (OTP ajoute `{file, F}`, `{line, L}`),
  et les options de `error/3` n'ajoutent aucun `error_info`.
- Un cadre de sommet `function_clause` affiche l'arité, pas la liste
  d'arguments.
- Aucun cadre ne nomme un BIF ou un opérateur en échec (OTP ajoute
  `{erlang, '+', Args, [{error_info, ...}]}`), et rien n'apparaît sous la
  fonction d'entrée.
- Un appel terminal libère le cadre de l'appelant, donc, comme dans
  OTP, un appelant qui s'est terminé par un appel terminal est absent de la
  trace. OTP transforme aussi en appels terminaux les appels à des fonctions qui
  ne retournent jamais ; Clause ne le fait pas.
- Les entrées de pile `{Fun, Args}` d'`erlang:raise/3` sont toujours rejetées.

## Cadres et transferts

Les fonctions générées s'exécutent sur des cadres explicites
([modèle d'exécution](execution-model.md), step 19 ; services dans
[frames.hpp](../abi/include/clause/abi/frames.hpp)).
Chaque fonction possède un descripteur `<symbol>.frame` (`FrameDescriptor` :
descripteur de module, emplacements d'atomes du module et de la fonction,
arité, code du corps, nombre d'emplacements, nombre d'emplacements de termes ;
externe pour les fonctions exportées) et un `<symbol>.body` interne
de type `abi::v1::Code`, `void(void *context, TermWord x0, TermWord x1, TermWord x2)`
(révision 10) ; avec un runtime construit par Clang sur x86-64 et AArch64, les
corps et chaque transfert utilisent la convention `preserve_none`, comme
`abi::v1::Code` sur ces cibles (révision 16) : les corps ne retournent jamais
normalement et ne sauvegardent donc aucun registre préservé par l'appelé ;
l'enregistrement rejette un module dont la `code_convention` (0 aucune, 1 C,
2 `preserve_none`) n'est pas celle du runtime. Un `<symbol>` exporté conserve la
signature `TermWord(Context *, const TermWord *)` comme entrée hôte appelant
`CLAUSE_invoke_v1(context, frame, arguments)`.

- Chaque contexte commence par un `abi::v1::FrameState` (révision 9) : bloc de
  pile, sommet, limite d'empilement, décalage du cadre courant, réductions
  restantes, pointeur des registres, nombre de registres vivants, bits lents, le
  mot d'échec et (révision 12) les mots libres du bloc de tas
  `[heap_top, heap_limit)`, un mot de la cible chacun. Un corps lit l'en-tête de
  son cadre (`stack + frame`) et les registres à partir de lui à l'entrée et
  effectue un aiguillage sur le mot de reprise de l'en-tête.
- Motifs binaires (cibles 64 bits) : le test de début, le test de fin et les
  segments entiers d'une largeur constante en octets entiers jusqu'à 56 bits à
  une position alignée sur l'octet lisent la cellule en ligne
  (`abi::v1::heap_binary_*_word`, `refc_*_word` : le `data_` d'une vue hors tas
  est le premier octet de son tampon) ; les autres segments et les positions non
  alignées appellent `CLAUSE_bits_v1`. Un sujet `sub_binary` (`sub_*_word`) est
  lu à travers son original. Un `Rest/binary` ou `Rest/bits` final d'unité 1 est
  alloué en ligne par incrément de pointeur comme une cellule `sub_binary` de
  4 mots de l'original.
- Une construction de binary dont chaque octet est connu à la compilation
  (petites constantes entières et littéraux de chaîne à des largeurs constantes
  en octets entiers, au plus 64 octets) est une cellule binary en ligne de la
  zone de littéraux du module, comme les autres littéraux composés.
- `Left ++ Right`, où `Left` est écrit comme une liste propre (un littéral de
  chaîne, ou une liste sans queue), est construit comme `[E1, ..., En | Right]`,
  comme le fait le compilateur d'OTP, sans appeler `erlang:'++'/2`.
- `erlang:make_tuple(N, V)` avec un petit `N` dans 1..64 alloue le tuple par
  incrément de pointeur et le remplit avec `llvm.experimental.memset.pattern`
  quand le tas a de la place ; sinon le builtin s'exécute.
- Les constructions de binary (cibles 64 bits) dont tous les segments sont des
  entiers de largeurs constantes en octets entiers jusqu'à 64 bits, au plus
  64 octets au total, sont allouées en ligne par incrément de pointeur comme
  cellules `heap_binary` (en-tête, longueur en bits, mots de données mis à zéro,
  puis les octets de chaque segment) quand chaque valeur est un petit entier et
  que le tas a de la place ; sinon `CLAUSE_bits_v1` les construit.
  Les mêmes segments après un accumulateur binary entier (`<<Acc/binary, ...>>`)
  sont écrits dans le tampon de l'accumulateur quand celui-ci est un
  `refc_binary` (ou un `sub_binary` d'un tel binary) se terminant, aligné sur
  l'octet, au `refc_append_end_word` de la cellule avec de la place sous
  `refc_append_limit_word` : les octets vont après la fin, la fin avance, et le
  résultat est un `sub_binary` de 4 mots de cette cellule.
- `+ - * /` (cibles 64 bits) avec un opérande flottant, et `/` de deux nombres
  quelconques, lisent chaque opérande comme un double (un petit entier converti,
  la valeur d'une cellule flottante lue à travers une sélection entre sa cellule
  et une cellule de substitution constante, si bien qu'aucun chargement ne
  dépend d'un branchement), calculent dans les registres et allouent par
  incrément de pointeur la cellule flottante de 2 mots quand le résultat est
  fini, le diviseur non nul et que le tas a de la place ; sinon
  `CLAUSE_immediate_v1` lève `badarith` ou promeut.
- Les expressions de map sans base dont les clés sont des littéraux atomes ou
  petits entiers (au plus 32 distincts) sont écrites en ligne comme cellules de
  map classique, clés triées à la compilation dans l'ordre exact des termes, la
  dernière valeur d'une clé répétée étant conservée ; sinon `CLAUSE_map_v1` les
  construit.
- Les tuples et les listes d'au plus 64 mots sont alloués en ligne par
  incrément de pointeur dans `[heap_top, heap_limit)` (en-tête ou cellules cons
  écrits sur place, `heap_top` avancé), sinon construits par
  `CLAUSE_construct_v1` ; le résultat est enraciné comme une sortie de service.
  Le runtime prend en compte les mots en ligne avant chaque opération sur le tas
  et réinitialise les deux champs après chacune ; ils sont null tant qu'aucun
  bloc de tas n'existe ou qu'un budget de tas par processus s'applique, si bien
  que chaque allocation passe alors par le service
  ([tas](runtime-heap.md#areas)).
  `CLAUSE_frame_v1` et `CLAUSE_registers_v1` restent pour d'autres
  consommateurs.
- Un corps ne sort que par des appels `musttail`. Les appels, appels terminaux
  et retours s'exécutent en ligne quand ils le peuvent : une entrée dépense une
  réduction, empile le cadre mis à zéro et copie elle-même les arguments, sauf
  si le tas veut une collecte, si le processus est profilé, s'il ne reste aucune
  réduction, si l'empilement dépasserait la limite ou si l'appelé est un builtin
  (corps null) ; un retour dépile en ligne sauf si le processus est profilé.
  Sinon le code vient de `CLAUSE_enter_v1` (appel), `CLAUSE_tail_v1` (appel
  terminal) ou `CLAUSE_return_v1` (retour), qui maintiennent l'état à jour.
- Chaque transfert passe les premiers registres X, au nombre de
  `abi::v1::register_arguments` (6 depuis la révision 17), comme paramètres C
  après le contexte : les premiers arguments d'un appel, le résultat d'un retour
  (comme `x0` du corps de l'appelant), zéro pour ceux qui ne servent pas. Les
  arguments suivants transitent par le tableau de registres. Autour de chaque
  service de transfert, le code généré stocke les paramètres dans le tableau
  (les services et le collecteur les y lisent) et les recharge ensuite. Le
  runtime appelle le code de la même manière (`ProcessStack::run_code`), et le
  corps de son cadre inférieur stocke `x0` dans le premier registre pour l'hôte.
- Une entrée met le cadre à zéro et ne copie dans leurs emplacements que les
  arguments au-delà des paramètres ; un corps ne garde un argument paramètre
  dans son emplacement que là où `lower_frames` le déverse à travers un appel ou
  un point sûr. Les valeurs évaluées ne sont pas stockées d'emblée : la
  descente (lowering) marque les termes calculés (métadonnées `clause.term`) et
  `lower_frames` ne donne un emplacement de terme qu'à une valeur qui traverse
  un appel ou un point sûr ; les tableaux d'arguments des services passent
  toujours par des emplacements racines. Les candidats en échec effacent leurs
  emplacements. Les valeurs dont un corps a encore besoin après un appel ou un
  point sûr de tête de boucle sont déversées (spilled) : les termes dans des
  emplacements de termes (comptés dans les `roots` du descripteur), les autres
  mots dans des emplacements bruts situés après eux ; les emplacements bruts ne
  sont pas des racines.
- Un résultat passe comme `x0` ; les charges utiles d'erreur sont des
  mots racines du canal (`fvalue` de BEAM). Un échec retourne à l'appelant comme
  un résultat et chaque appelant vérifie le canal après l'appel ; le mot de
  gestionnaire de l'en-tête reste à 0.
- La pile n'a pas de plafond par défaut ; un empilement que l'hôte ne peut pas
  allouer enregistre `out_of_memory`, et un empilement au-delà d'une limite
  optionnelle par processus `StackOptions::limit_words` enregistre
  `resource_limit` (échecs d'infrastructure).
- Un appel d'une valeur fonctionnelle passe ses arguments, puis les valeurs
  capturées par la fun, dans les registres ; `CLAUSE_apply_v1` retourne le
  `FrameDescriptor` dans lequel entre le transfert ([funs](funs.md#representation)).
- Points sûrs (safepoints) : `CLAUSE_enter_v1`/`CLAUSE_tail_v1` effectuent une
  collecte avant d'empiler le cadre de l'appelé (ses arguments sont des racines
  de registre) ; le tas positionne le bit `slow_collect` chaque fois qu'il veut
  une collecte, si bien que les entrées en ligne n'en sautent jamais. Et
  `CLAUSE_safepoint_v1(context)` à chaque tête de boucle de comprehension
  effectue une collecte sur place ; la tête ne l'appelle que tant que
  `FrameState::slow` contient `slow_collect`, puis dépense une réduction et,
  quand il n'en reste plus, entre dans `erlang:self/0` (l'entrée suspend le
  processus), si bien que les longues boucles sans appel partagent
  l'ordonnanceur. Tout autre service est une section critique qui ne déplace jamais le tas
  ([collecte dans le code généré](runtime-heap.md#collection-in-generated-code)).

## Services du runtime

Le code généré appelle des services C++ vérifiés : `CLAUSE_exact_v1` (égalité
exacte), `CLAUSE_immediate_v1` (prédicats et requêtes sur les immédiats),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1` (plus appelé par le code généré :
les formes et les champs de tuple et de cons sont testés et lus en ligne),
`CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`,
`CLAUSE_record_v1` (création, lecture, mise à jour, correspondance et test de
native records sous un `RecordCheck` ; issues `bad_record`, `bad_field`,
`no_match`), `CLAUSE_make_fun_v1` (construction d'une fun à partir d'un
`FunDescriptor`). Chacun retourne un succès, une erreur sémantique
(`badarg`/`badarith`/...) ou un échec d'infrastructure et n'écrit sa sortie
qu'en cas de succès. `CLAUSE_display_v1` ([output.hpp](../abi/include/clause/abi/output.hpp))
affiche une ligne `erlang:display/1` et produit `true` ; il n'a pas d'erreur
sémantique. `CLAUSE_halt_v1` ne réussit jamais : il enregistre une demande
d'arrêt (`CallError::halted` avec le code de sortie) ou `badarg`, de sorte que
l'appelant se déroule. Les graphies pour l'éditeur de liens suivent la
décoration (mangling) C++ Itanium ou Microsoft de la cible.

Formes en ligne (`codegen/lowering_inline.cpp`) : les tests de type (`is_atom`,
`is_integer`, `is_number`, `is_boolean`, `is_tuple`, `is_list`,
`is_bitstring`, `is_float`, `is_map`, `is_pid`, `is_port`, `is_reference`,
`is_function/1`, `is_record/1` natif, `is_binary/1` par le mot de longueur en
bits) lisent les étiquettes et, après un test d'étiquette boxed, le genre de
l'en-tête (`abi::v1::HeaderKind`) ; ils n'appellent jamais de service. Les
comparaisons de deux immédiats (`==`, `/=`) ou de deux petits entiers (`<`,
`=<`, `>`, `>=`), `element/2`, `tuple_size/1`, `hd/1`, `tl/1`, les opérateurs
booléens, `band`, `bor`, `bxor`, `bsr`, `bsl` (tant que le résultat reste
petit) et `div`/`rem` sur petits entiers s'exécutent en ligne ; `self/0` lit
`FrameState::self`. Ils s'exécutent en ligne là où leurs opérandes le
permettent et appellent sinon `CLAUSE_immediate_v1`, qui conserve tous les cas
d'erreur et de bignum. `setelement/3` d'un petit indice dans un tuple boxed
copie le tuple dans les mots libres du bloc de tas et remplace l'emplacement en
ligne ; sinon, ou sans place, il entre dans le builtin de pont.

`CLAUSE_builtin_frame_v1(context, builtin)` ([builtins.hpp](../abi/include/clause/abi/builtins.hpp))
retourne le `FrameDescriptor` du builtin de production d'indice `builtin` dans
`abi::v1::bridge_builtins` (ajout seulement) ; le code généré y entre comme dans
une fonction avec les arguments dans les registres, et les erreurs et les échecs
vont au canal vérifié ([builtins](builtins.md)). Un `FrameDescriptor` dont le
corps est null est un builtin : y entrer exécute le builtin sur les registres et
retourne dans l'appelant, ou suspend le processus à la continuation du builtin
lorsque celui-ci a été intercepté (trapped) ([portions](builtins.md#portions)).

`abi::v1::dispatch_builtin` appelle les builtins enregistrés par l'hôte d'après
les octets du module et de la fonction, le tableau d'arguments et l'arité, et
retourne un `Status` ; la sortie n'est écrite qu'en cas de succès.

| Status | Valeur | Signification |
| --- | ---: | --- |
| `ok` | 0 | Succès |
| `not_implemented` | 1 | Fonctionnalité différée connue, signalée une seule fois |
| `invalid_argument` | 2 | Entrée invalide |
| `diagnostic_failure` | 3 | Échec de la remise du rapport |
| `out_of_memory` | 4 | Échec de l'allocation, état restauré |
| `busy` | 5 | Contextes vivants ou dispatch en cours |
| `wrong_owner` | 6 | L'objet appartient à un autre runtime ou contexte |
| `resource_limit` | 7 | Plafond ou budget épuisé |
| `stopped` | 8 | Propriétaire arrêté |
| `abi_mismatch` | 9 | La version ou la largeur des termes diffère |
| `internal_error` | 10 | Échec inattendu contenu |
| `unknown_builtin` | 11 | Signature non enregistrée ni cataloguée |
| `erlang_error` | 12 | Erreur Erlang structurée enregistrée |
| `output_failure` | 13 | La sortie standard a refusé une écriture |

## Révisions

| Révision | Modification |
| --- | --- |
| 1 | Descripteurs et entrées initiaux |
| 2 | Canal d'échec vérifié |
| 3 | Graphies et emplacements des atomes dans les descripteurs |
| 4 | Portées racines générées obligatoires |
| 5 | Cadres de processus explicites et transferts |
| 6 | Descripteurs de native records dans les descripteurs de module, `CLAUSE_record_v1` |
| 7 | Descripteurs de funs dans les descripteurs de module, `CLAUSE_make_fun_v1`, `CLAUSE_apply_v1` |
| 8 | Les descripteurs d'export nomment leur `FrameDescriptor` ; services d'appel dynamique `CLAUSE_call_v1`, `CLAUSE_apply_list_v1`, `CLAUSE_call_list_v1`, `CLAUSE_make_external_fun_v1` |
| 9 | Chaque contexte commence par `abi::v1::FrameState` ; transferts en ligne |
| 10 | Premiers registres X passés comme paramètres du code |
| 11 | Mots fixes de `false` et `true` |
| 12 | Champs de tas en ligne `heap_top`/`heap_limit` dans `FrameState` |
| 13 | `undefined`, `ok`, `error` fixes ; `ModuleDescriptor::atom_cache` et `FrameState::runtime` |
| 14 | Zones de littéraux de module : `ModuleDescriptor::literals`, `literal_words` |
| 15 | `FrameState::self`, le mot pid du contexte |
| 16 | `Code` utilise `preserve_none` sur x86-64 et AArch64 avec un runtime construit par Clang ; `ModuleDescriptor::code_convention` |
| 17 | Six registres X comme paramètres de `Code` (`register_arguments`) |
| 18 | Cellules `sub_binary` (`HeaderKind::sub_binary`, `sub_*_word`) et extraction de `Rest` en ligne |
| 19 | Mots de fin et de limite d'ajout dans les cellules `refc_binary` (`refc_append_*_word`, 8 mots de charge utile) et ajouts en ligne |
| 20 | `MapOperation::entries` et générateurs de maps en ligne |
| 21 | `ModuleDescriptor::fun_cache` et fermetures en ligne |
