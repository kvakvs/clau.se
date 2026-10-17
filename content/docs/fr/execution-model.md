---
source: docs/execution-model.md
sourceCommit: a8c3f8f6
sourceSha256: 20c13ce39d1763e6ec342e1ed9aaa741312fc2be68cb0e08dd005c77a126fc43
translatedAt: 2026-10-17
---
# Modèle d'exécution : cadres et continuations

Comment les fonctions Erlang générées appellent, retournent, se suspendent et
échouent. Le modèle a été choisi après la comparaison de prototypes décrite
dans [alternatives comparées](#alternatives-compared) ; le côté code généré de
son ABI se trouve dans [cadres et transferts](abi.md#frames-and-transfers).

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

- Une pile plate unique par processus (`ProcessStack`, `process/stack`)
  contient les en-têtes de cadre et les emplacements (slots), grandit par
  déplacement et est adressée sous la forme base plus décalage.
- Chaque fonction est une fonction LLVM, son **corps**, qui commence par un
  `switch` sur l'indice de reprise du cadre, de sorte qu'elle conserve tous les
  blocs, jonctions et gestionnaires de la fonction.
- Les arguments et les résultats transitent par les registres de processus
  `x[]` (registres X de BEAM). Chaque pointeur de code a l'unique signature
  `abi::v1::Code`, `void(void *context, TermWord x0, ..., TermWord x5)` : les
  `abi::v1::register_arguments` (6) premiers registres passent aussi comme
  paramètres, de sorte que les premiers arguments d'un appel et le résultat
  d'un retour restent dans des registres machine.
- Un échec retourne à travers chaque appelant, qui vérifie le canal d'échec
  après l'appel ([canal d'échec](abi.md#failure-channel-revision-2)).

## État du processus

`abi::v1::FrameState` se trouve au début de chaque contexte, de sorte que le
code généré le lit et le met à jour inline :

| Champ | Signification |
| --- | --- |
| `stack`, `top`, `limit` | Le bloc de pile (se déplace lorsqu'il grandit), son premier mot libre, et les mots qu'un empilement peut atteindre sans grandir ni dépasser la limite de pile |
| `frame` | Décalage en mots de l'en-tête du cadre courant |
| `registers`, `live` | Les 256 registres d'arguments/de résultat ; les `live` premiers mots sont des racines lors d'un transfert |
| `reductions` | Entrées de fonction restantes dans la tranche de temps |
| `slow`, `failed` | Bits qui envoient les transferts vers les services (`slow_collect`, `slow_profile`) ; non nul tant que le canal d'échec contient un échec |

`heap_top`/`heap_limit`, `runtime` et `self` servent à l'allocation inline,
aux chargements d'atomes et à `self/0`
([cadres et transferts](abi.md#frames-and-transfers)). Un processus suspendu
enregistre l'entrée à laquelle il reprend dans `ProcessStack::resume_`.

## Cadres

Un cadre est un en-tête de 4 mots suivi des emplacements de la fonction
(registres Y de BEAM) : les emplacements de termes, qui sont des racines, puis
les emplacements bruts pour les valeurs natives déversées.

| Mot d'en-tête | Signification |
| --- | --- |
| `previous` | Décalage de l'en-tête de l'appelant (les cadres sont chaînés par décalages, jamais par pointeurs) |
| `function` | Le `FrameDescriptor` de la fonction |
| `resume` | Indice de continuation sur lequel le corps aiguille lorsque le contrôle revient ici |
| `handler` | Indice de gestionnaire ; toujours 0, car les échecs retournent à travers les appelants |

Le descripteur `<symbol>.frame` nomme le module, la fonction et l'arité et
contient le pointeur de code du corps et le nombre d'emplacements
([abi](abi.md#frames-and-transfers)). Les mots d'en-tête ne sont pas des
termes ; un parcours suit `previous` et lit le nombre d'emplacements dans les
descripteurs. Un **cadre de fond** (bottom frame) appartenant au runtime se
trouve sous le premier appel de chaque processus et de chaque invocation par
l'hôte : y retourner stocke le résultat dans le premier registre et termine
l'appel natif.

## Opérations

- **Appel (non terminal).** Les valeurs vivantes après l'appel sont déversées
  (spill) dans des emplacements. L'appelant fixe son propre `resume` à l'indice
  de continuation suivant, place les arguments dans les registres et transfère
  vers l'appelé. Les appels locaux, distants, de fun et dynamiques sont le
  même transfert ; un appel de fun ou dynamique demande d'abord le
  `FrameDescriptor` de l'appelé à un service de préparation
  ([funs](funs.md#dynamic-calls)).
- **Entrée.** Dépense une réduction, empile un cadre mis à zéro (en agrandissant
  la pile lorsqu'elle est pleine), copie dans les emplacements les arguments
  situés au-delà des paramètres, fixe `resume = 0` et transfère vers le corps
  de l'appelé.
- **Retour.** L'appelé passe le résultat en `x0`, dépile son cadre
  (`top = frame`, `frame = previous`) et transfère vers le corps de
  l'appelant, qui aiguille sur le `resume` de l'appelant.
- **Appel terminal.** L'appelant dépile son propre cadre sans transférer, puis
  entre dans l'appelé à sa place. L'appelant de l'appelant reste la cible du
  retour, donc la récursion terminale s'exécute en pile Erlang et native
  constante. Un appel terminal sur soi-même garde son cadre là où il est : il
  dépense une réduction, réinitialise les mots de reprise et de gestionnaire
  du cadre ainsi que le nombre de valeurs vivantes et copie les arguments
  au-delà des paramètres, sans réécrire l'en-tête ni mettre à zéro les
  emplacements ; LLVM le transforme en boucle. Un appel terminal vers un autre
  membre du cycle d'appels terminaux de l'appelant (des fonctions d'un même
  module qui s'atteignent mutuellement par des appels terminaux) conserve le
  lien vers l'appelant et les emplacements de termes que les deux cadres ont
  en commun : il écrit le descripteur de l'appelé, ne met à zéro que les
  emplacements de termes de l'appelé au-delà de ceux de l'appelant et saute
  le test de limite de pile lorsque le cadre de l'appelé n'est pas plus grand.
  Comme pour un appel terminal sur soi-même, un emplacement conservé peut
  contenir un terme d'un membre précédent jusqu'à ce que l'appelé l'écrive,
  de sorte que les collectes peuvent garder un tel terme en vie un peu plus
  longtemps.
- **Cession (yield).** Lorsqu'il ne reste aucune réduction, une entrée
  n'empile rien : elle s'enregistre dans `ProcessStack::resume_`, conserve ses
  arguments comme racines de registres (`ProcessStack::keep_registers`) et
  renvoie un code qui termine la tranche de temps, de sorte que la pile native
  se déroule jusqu'à l'exécuteur, qui recharge plus tard le budget et répète
  l'entrée. Les têtes de boucle des comprehensions dépensent aussi une
  réduction et cèdent la main via une entrée lorsqu'il n'en reste plus. Un
  `receive` attend via le builtin `CLAUSE_wait_frame_v1`, entré comme un appel
  ([receive](processes.md#receive)).
- **Sortie.** Retourner dans le cadre de fond termine le processus avec son
  résultat ; un échec qui y retourne termine le processus avec l'échec.
- **Exceptions.** Une levée ou une vérification de service échouée enregistre
  l'erreur dans le canal et copie les 8 cadres les plus internes de la chaîne
  pour la trace de pile ([traces de pile](abi.md#stack-traces)). Chaque
  appelant vérifie le canal après l'appel et retourne aussitôt, ou saute vers
  le bloc gestionnaire d'un `catch`, `try` ou `after` englobant dans le même
  corps ([canal d'échec](abi.md#failure-channel-revision-2)). Les halts et les
  échecs d'infrastructure sautent tous les gestionnaires et retournent au
  cadre de fond.
- **Invocation par l'hôte.** Un symbole exporté garde une signature native et
  exécute sa fonction au-dessus d'un cadre de fond avec `CLAUSE_invoke_v1`, en
  la reprenant après chaque cession ; les exceptions natives levées par les
  services y sont contenues. Les services du runtime restent des appels natifs
  ordinaires et ne rentrent jamais dans le code généré.

Chaque appel empile un cadre ; les fonctions feuilles ne s'en dispensent pas,
de sorte que chaque fonction conserve son entrée dans la trace de pile.

## Visibilité des racines

À chaque transfert et à chaque point sûr, les racines d'un processus sont : les
emplacements de termes de tous les cadres de sa pile, `x[0..live)`, et la
charge utile, la liste d'arguments et le terme de pile du canal d'échec
([racines](runtime-heap.md#roots-and-safe-points)).

Les valeurs ne survivent jamais à un transfert dans des registres natifs ou des
valeurs SSA, sauf les paramètres du transfert lui-même. Chaque corps recharge
l'adresse de son cadre depuis `stack + frame` après y être entré, et lit les
valeurs vivantes dans les emplacements. Au sein d'une continuation, un service
qui peut empiler un cadre ou déplacer le tas invalide tout pointeur
d'emplacement et tout pointeur de tas conservés dans des valeurs SSA ; la règle
de rechargement pour les collectes est fixée dans
[règle de rechargement](runtime-heap.md#reload-rule).

Le bloc de pile grandit en doublant et en se déplaçant tant que la limite à
l'échelle du runtime le permet, ne rétrécit jamais pendant l'exécution et est
séparé du bloc de tas. Il n'a pas de borne sur le nombre de cadres ; les mots
de pile comptent dans la
[limite mémoire du runtime](runtime-heap.md#runtime-memory-limit).

## Cibles

`musttail` avec une signature de code uniforme est accepté par chaque cible
requise en O0 et O2 (prototype ci-dessous, clang 23.1.2) :

| Cible | Mot | Résultat |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | sauts terminaux |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | sauts terminaux |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | sauts terminaux |
| `armv7-unknown-linux-gnueabihf` | 32 | sauts terminaux |

Le backend signale une erreur lorsqu'il ne peut pas honorer un appel
`musttail`, donc une compilation réussie constitue la garantie. Solution de
repli pour une future cible qui le rejetterait : un **trampoline**, où chaque
code retourne le pointeur de code suivant à la boucle de l'ordonnanceur au lieu
de sauter ; les cadres, les racines et les indices de continuation sont
inchangés. Aucune cible requise n'en a besoin.

## Implémentation

- **Deux étapes.** L'abaissement (lowering) émet la *forme native* : une
  fonction `TermWord(context,
  arguments)` par fonction Erlang, des appels ordinaires entre elles, un appel
  provisoire `clause.frame` nommant les emplacements de termes, et un `ret` du
  résultat d'un appel en position terminale. `lower_frames`
  (`compiler/src/codegen/frames.cpp`) déplace ensuite chaque corps dans
  `<symbol>.body`, ajoute le prologue (en-tête de cadre, registres, switch de
  reprise), découpe les blocs après les appels non terminaux et les points sûrs
  des têtes de boucle, déverse les valeurs utilisées après eux (les termes dans
  des emplacements de termes, les autres mots dans des emplacements bruts),
  remonte les adresses d'emplacement constantes dans le prologue et transforme
  les appels, les appels terminaux et les retours en transferts `musttail`. La
  spécialisation de types et les points d'accroche de test travaillent sur la
  forme native ; le backend exécute `lower_frames` avant l'inspection de l'IR
  et `optimize` l'exécute si c'est encore nécessaire.
- **Transferts inline.** Les entrées, les entrées terminales et les retours
  s'exécutent inline sur `FrameState`. Chacun se replie sur `CLAUSE_enter_v1`,
  `CLAUSE_tail_v1` ou `CLAUSE_return_v1` lorsque le tas demande une collecte,
  que le processus est profilé, qu'il ne reste aucune réduction, que la pile
  doit grandir ou atteint sa limite, ou que l'appelé est un builtin. La
  vérification d'échec après un appel lit le mot `failed` de l'état. Les
  chemins de service stockent les paramètres dans le tableau de registres
  avant le service et les rechargent après.
- **Paramètres.** Un corps lit ses premiers arguments dans les paramètres
  lorsqu'il démarre et le résultat de l'appel dans `x0` lorsqu'il reprend ;
  `lower_frames` ne déverse l'un ou l'autre dans un emplacement que s'il est
  vivant à travers un appel ou un point sûr.
- **Les positions terminales** sont la dernière expression du corps d'une
  clause, suivie à travers les blocs, les parenthèses et les corps de clauses
  de `case`, `if` et `receive`. Les appels dans les opérandes de `catch`,
  `try`, `maybe` et `andalso`/`orelse` ne sont pas des appels terminaux.
- **Boucles.** Les générateurs de comprehension sont des boucles à l'intérieur
  d'un corps. Leurs curseurs et leur accumulateur vivent dans des emplacements
  de termes, de sorte qu'aucune valeur SSA n'est transportée autour d'une
  boucle et qu'un point de reprise à l'intérieur n'a besoin de rien au-delà
  des déversements habituels.
- **Points sûrs.** Les entrées de fonction et les têtes de boucle des
  comprehensions effectuent une collecte lorsque le tas le demande
  ([collecte dans le code généré](runtime-heap.md#collection-in-generated-code)) ;
  les emplacements de déversement bruts ne contiennent jamais de termes.
- **Pas de plafond.** La pile grandit jusqu'à ce que l'hôte refuse de la
  mémoire, ce qui échoue avec `out_of_memory` (code de sortie 70,
  [exécutables](executables.md)), comme grandit un processus OTP. Un
  `StackOptions::limit_words` optionnel par processus (distinct du budget de
  tas optionnel) fait échouer un empilement au-delà avec `resource_limit`.

## Alternatives comparées

[tests/prototypes/execution_model](../tests/prototypes/execution_model/)
abaisse à la main les mêmes fonctions Erlang (récursion de corps `sum/1`,
récursion terminale `loop/2`, `fail/1` levant une erreur à la profondeur N,
`catcher/1` la capturant) de trois façons et les compile pour chaque cible
ci-dessus en O0 et O2 (`python tests/prototypes/execution_model/run.py`). Sous
Windows x64 en O2, le modèle choisi a exécuté une récursion de corps à 1M de
profondeur en 17 ms avec 5 mots par cadre et 10M d'appels terminaux en pile
constante ; sa variante trampoline a réussi les mêmes exécutions. Rejetées :

- **Appels natifs avec cadres de racines explicites.** Une récursion profonde
  nécessite une pile native par processus dimensionnée pour l'appel le plus
  profond (environ 13 000 niveaux dans un thread de 1 Mio) ; la suspension
  nécessite une commutation de pile propre à chaque cible ; les cibles 32 bits
  ne peuvent pas réserver de grandes piles pour de nombreux processus.
- **Coroutines LLVM.** Une allocation sur le tas par appel, pas d'appels
  terminaux, des cadres dont le ramasse-miettes ne peut pas voir la
  disposition, des passes de coroutines même en O0, et le transfert symétrique
  dépend de toute façon de `musttail`.
- **Une fonction LLVM par continuation** (CPS classique). Mêmes transferts,
  mais les jonctions et les gestionnaires atteints depuis plusieurs
  continuations devraient être découpés en fonctions supplémentaires ; le
  switch de reprise conserve un parcours à fonction unique.

Coûts acceptés : un saut indirect par retour plus un aiguillage par switch ;
les valeurs vivantes à travers les appels sont rechargées depuis les
emplacements ; les backtraces du débogueur natif ne montrent que la fonction
courante, tandis que les traces de pile Erlang proviennent de la chaîne de
cadres ([débogage](debugging.md)).
