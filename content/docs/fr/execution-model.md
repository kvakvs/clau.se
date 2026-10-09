---
source: docs/execution-model.md
sourceCommit: 06042fa
sourceSha256: 4496f092872f90d6a3fb46c26f67950a76fa663502d4f2c80d8be45d55c8a599
translatedAt: 2026-10-09
---
# Modèle d'exécution : cadres et continuations

Décision du plan 11 step 17 (2026-10-05). Elle fixe la manière dont les
fonctions Erlang générées appellent, retournent, se suspendent et échouent une
fois arrivés la récursion, les appels terminaux et les processus. Le step 19 a
implémenté les appels, les retours, les appels terminaux et les cadres
([Implémentation](#implementation) liste ce qui reste ouvert) ; les steps 23,
24, 26 et 43 s'appuient dessus.

## Décision

Chaque processus Erlang s'exécute sur sa propre **pile plate de cadres
explicites** (frames), et le code généré ne passe d'une fonction à l'autre que
par des **transferts terminaux garantis** (LLVM `musttail`). Un appel non
terminal stocke la continuation de l'appelant dans le cadre de l'appelant et
saute vers l'appelé ; un retour saute de nouveau vers cette continuation. La
pile native reste donc à un seul niveau d'appel au-dessus de l'ordonnanceur,
quelle que soit la profondeur de récursion Erlang, et un processus peut
s'arrêter à n'importe quel transfert et reprendre plus tard sur n'importe quel
thread.

- Une pile plate unique par processus remplace la pile de racines segmentée
  de 8F. Elle contient les en-têtes de cadre et les emplacements (slots),
  grandit par déplacement et est adressée sous la forme base plus décalage.
- Chaque fonction qui a besoin d'un cadre est abaissée (lowering) en une
  **entrée** et un **corps**. Le corps commence par un `switch` sur l'indice
  de continuation du cadre, de sorte qu'une seule fonction LLVM conserve tous
  les blocs, jonctions et gestionnaires de la fonction.
- Les arguments et les résultats transitent par les registres de processus
  `x[0..n)` (registres X de BEAM) ; chaque pointeur de code a l'unique
  signature `void code(Process *)`.
- Les exceptions déroulent les cadres jusqu'au cadre le plus interne dont
  l'en-tête nomme une continuation de gestionnaire.

## État du processus

| Champ | Signification |
| --- | --- |
| `stack`, `capacity` | Un tableau de mots extensible ; se déplace lorsqu'il grandit |
| `frame`, `top` | Décalages en mots de l'en-tête du cadre courant et du premier mot libre |
| `x[]`, `live` | Registres d'arguments/de résultat ; les `live` premiers mots sont des racines lors d'un transfert |
| `reductions` | Appels restants dans la tranche de temps |
| `resume_at` | Entrée à laquelle un processus suspendu reprend |
| canal d'échec | Le canal de révision 2 actuel : raison, charge utile, trace de pile, `halted` |

## Cadres

Un cadre est un en-tête fixe suivi des emplacements de la fonction (registres
Y de BEAM). Les emplacements sont mis à zéro à l'empilement, comme le sont
aujourd'hui les cadres de racines.

| Mot d'en-tête | Signification |
| --- | --- |
| `previous` | Décalage de l'en-tête de l'appelant (les cadres sont chaînés par décalages, jamais par pointeurs) |
| `function` | Le descripteur de la fonction |
| `resume` | Indice de continuation sur lequel le corps aiguille lorsque le contrôle revient ici |
| `handler` | Indice de continuation du gestionnaire actif le plus interne, 0 s'il n'y en a pas |

Le descripteur étend l'actuel `abi::v1::FrameDescriptor` (descripteur de
module, emplacements des atomes de module et de fonction, arité) avec les
pointeurs de code de l'entrée et du corps et le nombre d'emplacements. Les
mots d'en-tête ne sont pas des termes ; un parcours suit `previous` et lit le
nombre d'emplacements dans les descripteurs. Un **cadre de fond** (bottom
frame) appartenant au runtime se trouve sous le premier appel de chaque
processus : la continuation 1 est une sortie normale (résultat dans `x[0]`),
la continuation 2 le gestionnaire d'une exception non capturée.

## Opérations

- **Appel (non terminal).** Les valeurs vivantes sont déjà dans des
  emplacements (la règle d'enracinement actuelle). L'appelant fixe son propre
  `resume` à l'indice de continuation suivant, écrit les arguments dans
  `x[0..n)` et transfère vers l'entrée de l'appelé. Un appel distant transfère
  vers le symbole d'entrée exporté.
- **Entrée.** Compte une réduction (voir cession), empile un cadre mis à zéro
  (en déplaçant la pile lorsqu'elle est pleine), copie `x[0..n)` dans les
  emplacements, fixe `resume = 0` et transfère vers le corps.
- **Retour.** L'appelé écrit le résultat dans `x[0]`, dépile son cadre
  (`top = frame`, `frame = previous`) et transfère vers le corps de
  l'appelant, qui aiguille sur le `resume` de l'appelant.
- **Appel terminal.** Les arguments vont dans `x[0..n)`, l'appelant dépile son
  propre cadre sans transférer, puis transfère vers l'entrée de l'appelé.
  L'appelant de l'appelant reste la cible du retour, donc la récursion
  terminale s'exécute en pile Erlang et native constante. Les appels terminaux
  locaux, mutuels et distants sont le même saut.
- **Cession (yield).** Chaque entrée dépense une réduction. À zéro, elle
  s'enregistre dans `resume_at` et retourne à l'ordonnanceur au lieu
  d'empiler un cadre ; les arguments restent dans `x[0..arity)`, qui sont
  alors les seuls registres du processus à enraciner. La reprise recharge le
  budget et transfère vers `resume_at`, qui répète l'entrée. Les attentes
  ultérieures (`receive`, step 46) stockent un indice de continuation du corps
  au lieu d'une entrée.
- **Sortie.** Retourner dans le cadre de fond enregistre une sortie normale ;
  y dérouler enregistre une exception non capturée. Dans les deux cas, le
  code retourne à l'ordonnanceur.
- **Propagation des exceptions.** Une levée ou une vérification de service
  échouée enregistre l'erreur dans le canal comme aujourd'hui et nomme les 8
  cadres les plus internes pour la trace à partir de la chaîne de cadres. Le
  dérouleur dépile ensuite les cadres dont le `handler` vaut 0, fixe
  `resume = handler` dans le premier cadre qui en a un et transfère vers son
  corps. Les gestionnaires `catch`, `try` et `after` sont des indices de
  continuation ; entrer dans une région protégée fixe `handler` et en sortir
  restaure l'indice englobant, tous deux connus statiquement au sein d'une
  fonction. Les halts et les échecs d'infrastructure sautent tous les
  gestionnaires et déroulent directement jusqu'au cadre de fond, comme ils
  sautent les gestionnaires aujourd'hui. Le gestionnaire récupère l'exception
  avec les services actuels (`CLAUSE_catch_v1`, `CLAUSE_exception_v2`) et la
  relève à travers le dérouleur.
- **Invocation par l'hôte.** Le runtime empile un cadre de fond, charge `x[]`
  et exécute la boucle de l'ordonnanceur jusqu'à atteindre ce cadre. Les
  services du runtime restent des appels natifs ordinaires et ne rentrent
  jamais dans le code généré ; seule cette boucle de l'hôte le démarre.

Une fonction qui ne fait aucun appel non terminal et ne conserve aucun
emplacement à travers un point sûr peut se passer de cadre et retourner
directement au corps de son appelant. C'est une optimisation que le
compilateur pourra ajouter plus tard, pas une partie du contrat.

## Visibilité des racines

À chaque transfert et à chaque point sûr, les racines d'un processus sont :
tous les emplacements de tous les cadres de sa pile, `x[0..live)`, et la
charge utile, la liste d'arguments et le terme de pile du canal d'échec (déjà
des racines du processus). Les mots de transmission du résultat de l'actuelle
pile de racines disparaissent ; `x[0]` prend leur rôle.

Les valeurs ne survivent jamais à un transfert dans des registres natifs ou
des valeurs SSA. Chaque corps recharge l'adresse de son cadre depuis
`stack + frame` après y être entré, et lit les valeurs vivantes dans les
emplacements. Au sein d'une continuation, un service qui peut empiler un cadre
ou déplacer le tas invalide tout pointeur d'emplacement et tout pointeur de
tas conservés dans des valeurs SSA ; la règle de rechargement pour les
collectes est fixée dans
[collecte dans le code généré](runtime-heap.md#collection-in-generated-code).

## Successeur de la pile de racines 8F

La pile segmentée n'existe que parce que le code généré conserve des pointeurs
de cadre absolus à travers les appels. Dans ce modèle, aucun pointeur de cadre
ne survit à un transfert, donc la pile devient un bloc plat unique par
processus :

- les en-têtes de cadre vivent dans la pile, les emplacements sont adressés
  sous la forme `stack + frame + header + index` ;
- le bloc grandit en doublant et en se déplaçant (`realloc`), ne rétrécit
  jamais pendant l'exécution et est séparé du bloc de tas ;
- la limite de 4 096 cadres est supprimée ; les mots de pile comptent dans le
  budget mémoire du processus, et le dépasser est l'échec documenté du
  step 20.

## Cibles

`musttail` avec la signature uniforme `void (Process *)` est accepté par
chaque cible requise en O0 et O2 (prototype ci-dessous, clang 23.1.2) :

| Cible | Mot | Résultat |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | sauts terminaux |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | sauts terminaux |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | sauts terminaux |
| `armv7-unknown-linux-gnueabihf` | 32 | sauts terminaux |

Le backend signale une erreur lorsqu'il ne peut pas honorer un appel
`musttail`, donc une compilation réussie constitue la garantie. Solution de
repli pour une future cible qui le rejetterait : un **trampoline**. Chaque
code retourne le pointeur de code suivant à la boucle de l'ordonnanceur au
lieu de sauter (null suspend) ; les cadres, les racines et les indices de
continuation sont inchangés. Aucune cible requise n'en a besoin.

## Implémentation

Le step 19 (2026-10-05) implémente le modèle avec ces choix et ces lacunes :

- **Deux étapes.** L'abaissement émet toujours la *forme native* : une
  fonction `TermWord(context, arguments)` par fonction Erlang, des appels
  ordinaires entre elles, un appel provisoire `clause.frame` nommant les
  emplacements de termes, et un `ret` du résultat d'un appel en position
  terminale. `lower_frames` (`compiler/src/codegen/frames.cpp`) déplace
  ensuite chaque corps dans `<symbol>.body`, ajoute le prologue (en-tête de
  cadre, registres, switch de reprise), découpe les blocs après les appels non
  terminaux et les points sûrs des têtes de boucle, déverse (spill) les
  valeurs utilisées après eux (les termes dans des emplacements de termes, les
  autres mots dans des emplacements bruts), remonte les adresses d'emplacement
  constantes dans le prologue et transforme les appels, les appels terminaux
  et les retours en transferts `musttail`. La spécialisation de types et les
  points d'accroche de test travaillent sur la forme native ; le backend
  exécute `lower_frames` avant l'inspection de l'IR et `optimize` l'exécute si
  c'est encore nécessaire.
- **Entrée et corps.** Il n'y a pas de fonction d'entrée séparée : l'appelant
  appelle `CLAUSE_enter_v1(context, callee.frame)`, qui empile le cadre,
  copie les arguments et renvoie le corps de l'appelé. Un appel terminal
  utilise `CLAUSE_tail_v1`, qui libère d'abord le cadre de l'appelant.
- **Les positions terminales** sont la dernière expression du corps d'une
  clause, suivie à travers les blocs, les parenthèses et les corps de clauses
  `case` et `if`. Les appels dans les opérandes de `catch`, `try`, `maybe` et
  `andalso`/`orelse` ne sont pas des appels terminaux.
- **Les exceptions** retournent à travers chaque appelant, qui vérifie le
  canal après l'appel comme auparavant ; les indices de gestionnaire et le
  déroulement direct restent une optimisation. Les traces de pile lisent la
  chaîne de cadres au moment de la levée.
- **Boucles.** Les générateurs de comprehension sont des boucles à l'intérieur
  d'un corps. Leurs curseurs et leur accumulateur vivent dans des emplacements
  de termes, de sorte qu'aucune valeur SSA n'est transportée autour d'une
  boucle et qu'un point de reprise à l'intérieur n'a besoin de rien au-delà
  des déversements habituels.
- **Cessions** (step 43, [processus](processes.md)). `CLAUSE_enter_v1` et
  `CLAUSE_tail_v1` dépensent une des réductions du processus ; s'il n'en reste
  plus, ils enregistrent la fonction appelée (`ProcessStack::resume_`, le
  `resume_at` du modèle), conservent ses arguments comme racines de registres
  et renvoient un code qui termine la tranche de temps, de sorte que la pile
  native se déroule jusqu'à l'exécuteur, qui répète plus tard l'entrée. Les
  têtes de boucle ne cèdent pas la main. Le ramasse-miettes énumère les
  emplacements de termes des cadres, les registres qu'une suspension garde
  vivants (`ProcessStack::keep_registers`) et le canal d'échec (step 23,
  [racines](runtime-heap.md#roots-and-safe-points)). Les entrées de fonction et
  les têtes de boucle des comprehensions sont des points sûrs qui effectuent
  une collecte lorsque le tas le demande (step 26,
  [collecte dans le code généré](runtime-heap.md#collection-in-generated-code)) ;
  les emplacements de déversement bruts ne contiennent jamais de termes.
- **Pas de plafond.** La pile grandit jusqu'à ce que l'hôte refuse de la
  mémoire, ce qui échoue avec `out_of_memory` (code de sortie 70,
  [exécutables](executables.md)), comme grandit un processus OTP. Un
  `StackOptions::limit_words` optionnel par processus (distinct du budget de
  tas optionnel) fait échouer un empilement au-delà avec `resource_limit`. Les
  cadres occupent aujourd'hui 4 mots d'en-tête plus 1 à 40 emplacements.
- **Entrée de l'hôte.** Un symbole exporté garde la signature native et
  exécute sa fonction au-dessus d'un cadre de fond du runtime avec
  `CLAUSE_invoke_v1` ; les exceptions natives levées par les services y sont
  contenues.

## Alternatives comparées

Prototype dans [tests/prototypes/execution_model](../tests/prototypes/execution_model/) :
les mêmes fonctions Erlang (récursion de corps `sum/1`, récursion terminale
`loop/2`, `fail/1` levant `boom` à la profondeur N, `catcher/1` la capturant)
abaissées à la main de trois façons. Hôte : Windows x64, clang 23.1.2 ; les
temps sont des exécutions uniques en O2. Lancer
`python tests/prototypes/execution_model/run.py`.

| | Cadres explicites + `musttail` (choisi) | Appels natifs + cadres de racines (actuel) | Coroutines LLVM (C++20) |
| --- | --- | --- | --- |
| Récursion de corps à 1M de profondeur | ok, 17 ms ; 5 mots par cadre ; 17 déplacements de pile | 80 o de pile native par niveau : environ 13 000 niveaux dans un thread de 1 Mio | ok, 60 ms ; une allocation sur le tas de 64 à 80 o par appel |
| 10M appels terminaux | ok, 5 ms ; pile constante | En O0, croît de 80 o par appel ; en O2, seulement par chance grâce aux sibling calls | pas d'appels terminaux : 1M d'itérations conservent 1M de cadres |
| Cession / reprise | à chaque entrée ; deux processus s'entrelacent | impossible sans une pile native par processus | transfert symétrique (lui-même `musttail`) |
| Pile native à la profondeur 1M | 136 à 144 o | croît à chaque niveau | 144 à 520 o |
| Racines visibles par le GC | emplacements dans des cadres connus | emplacements dans des cadres connus | disposition du cadre de coroutine choisie par LLVM ; les termes nécessiteraient une seconde copie enracinée |
| Exceptions | déroulement jusqu'au cadre du gestionnaire | vérification du canal à chaque retour | vérification du canal à chaque retour |

La variante trampoline du modèle choisi réussit les mêmes exécutions (20 ms de
récursion, 16 ms pour 10M d'appels terminaux en O2). Rejetées :

- **Appels natifs avec cadres de racines explicites.** Une récursion profonde
  nécessite une pile native par processus dimensionnée pour l'appel le plus
  profond ; la suspension nécessite une commutation de pile propre à chaque
  cible ; les cibles 32 bits ne peuvent pas réserver de grandes piles pour de
  nombreux processus.
- **Coroutines LLVM.** Une allocation par appel, pas d'appels terminaux, des
  cadres opaques pour le ramasse-miettes, des passes de coroutines même en O0,
  et le transfert symétrique dépend de toute façon de `musttail`.
- **Une fonction LLVM par continuation** (CPS classique). Mêmes transferts,
  mais les jonctions et les gestionnaires atteints depuis plusieurs
  continuations devraient être découpés en fonctions supplémentaires ; le
  switch de reprise conserve l'actuel parcours à fonction unique.

Coûts acceptés : un saut indirect par retour plus un aiguillage par switch ;
les valeurs vivantes à travers les appels sont rechargées depuis les
emplacements (elles y sont déjà stockées) ; les backtraces du débogueur natif
ne montrent que la fonction courante, tandis que les traces de pile Erlang
proviennent de la chaîne de cadres.

## Preuves du prototype

`run.py` construit le modèle choisi (`musttail` et trampoline), la référence
native et le modèle à coroutines pour l'hôte en O0 et O2, les exécute, et
compile les fonctions abaissées à la main (`generated.cpp`, freestanding) pour
chaque cible ci-dessus en O0 et O2, en comptant les appels `musttail` dans
l'IR et les sauts terminaux dans l'assembleur. Résultat du 2026-10-05 : PASS.
Pour le modèle choisi aux deux niveaux : retour (42), récursion de corps à
1 000 000 de profondeur, 10 000 000 d'appels terminaux, une erreur levée à la
profondeur 100 000 capturée par un cadre de gestionnaire, la même erreur non
capturée (cadre de fond, trace de 8 cadres `fail`), et deux processus
s'entrelaçant par tranches de 4 000 réductions (1 002 tranches). Les 15 sites
de transfert sont tous `musttail` en O0 sur chaque cible (14 en O2 après
l'inlining).

Le corps de `sum/1` pour `i686-pc-windows-msvc` (IR O2, noms raccourcis).
L'IR `x86_64-pc-windows-msvc` est identique avec des mots `i64` et des
décalages doublés.

```llvm
%2 = load ptr, ptr %0, align 4                      ; stack base
%3 = getelementptr inbounds nuw i8, ptr %0, i32 8
%4 = load i32, ptr %3, align 4                      ; current frame offset
%5 = getelementptr inbounds nuw [4 x i8], ptr %2, i32 %4
%6 = getelementptr inbounds nuw i8, ptr %5, i32 16  ; slot 0 (N)
%7 = getelementptr inbounds nuw i8, ptr %5, i32 8   ; header: resume index
%8 = load i32, ptr %7, align 4
%9 = icmp eq i32 %8, 0                              ; switch on resume
...
16:                                                 ; N > 0: call sum(N - 1)
  store i32 1, ptr %7, align 4                      ; resume = 1
  ...                                               ; x0 = N - 1
  %19 = tail call ptr @call(ptr %0, ptr @SUM)       ; push frame or park
  musttail call void %19(ptr nonnull %0)
  ret void
20:                                                 ; resume 1: x0 += N
  ...
  %24 = tail call ptr @leave(ptr %0)                ; pop, caller body
  musttail call void %24(ptr nonnull %0)
  ret void
```
