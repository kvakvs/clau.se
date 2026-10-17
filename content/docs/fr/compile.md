---
source: docs/compile.md
sourceCommit: a8c3f8f6
sourceSha256: 070de594787444f6afefbf3760848986bda8c85ff204932e596a67502385ae50
translatedAt: 2026-10-17
---
# Compilation

`clau` compile des modules Erlang/OTP 29 via LLVM en IR vérifié, en bitcode ou
en objets natifs. `-o/--output` lie les entrées positionnelles (ou une cible de
projet sélectionnée), leur objet de démarrage d'[entrée](executables.md) et le
runtime en un exécutable ([édition de liens](executables.md#linking)) ; les
builds de projet lient les cibles exécutables vers les sorties de leur
manifeste ([projets](projects.md#executables)). Les objets émis peuvent aussi
s'exécuter via un harnais C++ lié au runtime (voir l'exemple ci-dessous).

## Sous-ensemble de source accepté

Modules nommés du langage OTP 29 ordinaire : clauses de fonction ordonnées avec
[motifs](patterns.md) et [guards](guards.md) ; correspondances, constructeurs,
opérateurs et builtins ([builtins](builtins.md)) ; `case`, `if`, `receive`,
`catch`, `try ... of ... catch Class:Reason:Stack ... after` avec
[traces de pile](abi.md#stack-traces), `maybe ... else ... end` ;
comprehensions de liste, de binary et de map
([motifs](patterns.md#comprehensions)) ; records tuples et
[native records](native-records.md) ; [funs](funs.md), appels locaux, distants
et dynamiques (`M:F(...)`, `apply/2,3`) ; [processus](processes.md) et
[ports](ports.md). Les appels s'exécutent sur des cadres de processus
explicites avec de vrais appels terminaux
([modèle d'exécution](execution-model.md#implementation)) ; la récursion non
terminale est bornée par la pile du processus (sans plafond par défaut), non
par la pile native. Les modules qu'un lot nomme sans les déclarer proviennent
de la [bibliothèque](library.md). Les qualificateurs de correspondance dans les
comprehensions de la fonctionnalité expérimentale `compr_assign` sont rejetés
avec `[heap expressions] notimpl`.

Attributs acceptés : `module`, `export`, `file`, `record` tuple et natif,
`export_record`, `import_record`, formes type/spec, `doc`/`moduledoc`,
`behaviour`/`behavior` ([behaviours](semantic.md#behaviours)), tout attribut
informatif (`vsn`, `author`, `copyright`, `deprecated`, `dialyzer`,
`-name(Term)` défini par l'utilisateur ; conservés pour
[`module_info(attributes)`](semantic.md#predefined-functions)),
`-import(Module, [F/A, ...])` ([imports](semantic.md#imports)) et `-compile`
avec des options qui ne changent rien à ce qu'émet Clause :
`{no_auto_import, ...}`, les options d'avertissement (`nowarn_*`, `warn_*`,
`{nowarn_unused_function, [...]}`) et les indications d'optimisation, de
débogage et de rapport (`inline`, `{inline, [F/A]}`, `{inline_size, N}`,
`{inline_effort, N}`, `inline_list_funcs`, `debug_info`, `deterministic`,
`report*`, `verbose`, ...). `{parse_transform, Module}` exécute la
transformation sur l'Erlang/OTP de l'hôte avant l'analyse
([parse transforms](transforms.md)). `on_load`, `nifs`, `export_all`, les
autres options `compile` et les modules paramétrés sont rejetés ; le
diagnostic les nomme, par exemple
`[behavior-changing attributes] notimpl [module="m" operation="-compile option export_all"]`.
Chaque module reçoit `module_info/0,1`. Les sources commençant par `#!`
suivent les [règles des escripts](executables.md#escripts) (module implicite et
export de `main/1`, `-mode` accepté). Les formes type/spec sont analysées mais
ne modifient jamais le code généré. Les modes purement syntaxiques
(`--parse-check`, `--print-ast`, `--print-source`, ...) acceptent la grammaire
complète.

## Exécuter l'exemple de module compilé

`client:main/1` fait de l'exemple un programme :

```sh
./build/debug/bin/clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo     # prints 42, -7 and {record,map,binary,list,integer,other}
```

Les mêmes modules s'exécutent aussi via un harnais C++. Depuis un Developer
PowerShell Windows x64 avec le compilateur construit :

```powershell
$tool = './build/debug/bin/clau.exe'
& $tool -O0 --emit obj --artifact-dir build/example-aot examples/compile/answer.erl examples/compile/client.erl
cmake -S examples/compile -B build/example-native -G Ninja -DCMAKE_CXX_COMPILER=clang-cl -DCMAKE_BUILD_TYPE=Debug "-DGENERATED_DIR:PATH=$((Resolve-Path build/example-aot).Path)"
cmake --build build/example-native
./build/example-native/bin/Debug/compiled_modules.exe
```

Il affiche `42`, `-7`, `record`, `map`, `binary`, `list`, `integer`, `other`,
un par ligne. Le harnais enregistre explicitement les modules, crée un contexte
et décode les résultats ; c'est un hôte d'exemple, pas un point d'entrée de
production. Sous Unix, utiliser `build/debug/bin/clau`, `clang++` et
`-DGENERATED_DIR="$PWD/build/example-aot"`. Le test CTest `codegen_examples`
exécute ces commandes sous chaque politique.

Autres actions sur les mêmes sources :

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

## Affichage du format abstrait

`--print-abstr` (une action du frontend) affiche chaque module analysé sous
forme des formes du
[format abstrait](https://www.erlang.org/doc/apps/erts/absform.html) d'OTP
qu'`epp` remettrait à un parse transform, un terme `file:consult/1` par ligne,
les mêmes termes qu'écrit `erlc +to_abstr` ([transforms](transforms.md)).

## Affichage du source

`--print-source` (une action du frontend, comme `--print-ast`) affiche chaque
module analysé sous forme de source Erlang ; `--print-types` affiche le même
texte avec des annotations de type. L'afficheur (`print_source`,
`expression_source`, `type_source` dans `printing.hpp` ;
`compiler/src/printing/source_*`) est réutilisable :

- Les formes se suivent dans l'ordre du source, avec une ligne vide autour de
  chaque fonction ; la forme `-file` que le préprocesseur ajoute avant un
  module est omise, celles qui entourent les fichiers inclus sont conservées.
- Le texte est la syntaxe analysée : les macros sont développées, les
  inclusions intégrées, et les commentaires, l'écriture et la mise en page
  d'origine ont disparu. Les clauses et les expressions de bloc (`case`, `if`,
  `receive`, `try`, `maybe`, `begin`, funs de plus d'une ligne) occupent des
  lignes indentées de quatre colonnes ; tout le reste tient sur une ligne. Les
  parenthèses ne proviennent que des groupes du source lui-même.
- Le texte affiché se réanalyse en le même arbre syntaxique, et l'afficher de
  nouveau donne le même texte (CTest `printing_source` sur les fixtures
  analysables).
- `SourceNotes` ajoute une note à une expression, affichée sous forme de
  commentaire `% Text` en fin de ligne, après la ponctuation de la ligne où
  l'expression se termine, et des lignes de commentaire au-dessus d'une forme.
  Seules les expressions occupant des lignes entières portent des notes (les
  expressions de corps et la valeur examinée d'un `case` ; une par ligne, la
  plus externe), de sorte que les longues expressions imbriquées restent
  lisibles et que le texte reste de l'Erlang. Les motifs et les guards n'en
  portent aucune.

## Options

| Option | Comportement |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publie un artefact par module |
| `--artifact-dir DIR` | Racine des artefacts (exige `--emit`) |
| `-o PATH` / `--output PATH` | Lie un exécutable ([édition de liens](executables.md#linking)) ; incompatible avec `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Pilote Clang et archive du runtime pour `-o` |
| `--no-cache` | Ne lit ni n'écrit les [caches de build](projects.md#build-caches) |
| `--cache-inference-in-dirs PATTERN` | Répétable : les modules des répertoires correspondants gardent leurs résultats d'inférence dans le cache de build, en plus des répertoires d'applications OTP implicites ([cache d'inférence](projects.md#inference-cache)) |
| `--build-dir DIR` | Où Clause garde ses fichiers temporaires (sous `DIR/tmp`) ; remplace le `build_dir` de chaque cible de projet sélectionnée ; sans cette option, les entrées positionnelles n'en ont pas ([répertoire de build](projects.md#build-directory)) |
| `--entry MODULE[:FUNCTION[/ARITY]]` | Fonction d'entrée/1 de l'exécutable (sinon fonction/0 ; `/0` ou `/1` en sélectionne une) ; validée dans tous les modes de compilation et ajoute l'artefact de démarrage `clausev1_start` ([exécutables](executables.md#startup-object)) ; les inspections d'IR et d'assembleur laissent alors de côté ce qu'elle ne peut atteindre ([vivacité des exports](executables.md#export-liveness)) |
| `--target-triple TRIPLE` | Machine cible ; `--target` sert à sélectionner une cible de projet |
| `-O0` / `-O2` / `-Os` | Code générique par défaut + LLVM O0 / spécialisation bornée + LLVM O2 / LLVM Os, sans spécialisation, une section par symbole et élimination par l'éditeur de liens du code et des données non référencés |
| `--no-type-specialization` | Désactive les variantes quel que soit l'ordre des options |
| `--lto` | Lie les modules sous forme de bitcode avec l'optimisation à l'édition de liens de LLD (cibles Windows MSVC et ELF ; exige `-o` ou un build de projet qui lie) ([édition de liens](executables.md#linking)) |
| `--keep-exports` | Garde chaque export d'un exécutable appelable au lieu de laisser de côté ceux qu'il ne peut atteindre ; exige `-o`, un build de projet qui lie ou une inspection d'IR/d'assembleur ([vivacité des exports](executables.md#export-liveness)) |
| `-g` | Tables de lignes Erlang dans les objets et les exécutables liés (CodeView/PDB sur les cibles MSVC, DWARF ailleurs) ([débogage](debugging.md)) |
| `--print-ir` / `--print-optimized-ir` | IR vérifié avant/après les passes LLVM, avec les lignes du source Erlang en commentaires |
| `--print-asm` | L'assembleur cible de chaque module après le pipeline sélectionné, chaque suite de code machine commentée par l'instruction IR et la ligne Erlang dont elle provient ([listings d'assembleur](#assembly-listings)) |
| `--print-types` | Chaque module sous forme de source Erlang annoté des types inférés ([sémantique](semantic.md#--print-types)) ; s'arrête avant LLVM |
| `--verbose` | Événements de phase `[pp]`, `[parse]` et `[comp]` sur stderr, puis le résumé `[index] ...` de l'[index des répertoires](projects.md#directory-index) |
| `--print-stage-times` | `[time] <stage> <subject>: <ms> ms` sur stderr : `plan` par manifeste de projet (son chargement et l'expansion des motifs de chaque cible sélectionnée), `preprocess`, `parse` et `transform` (modules avec parse transforms) par fichier source, `compile` par lot (nombre de modules, cible de projet), `link` par exécutable ; ` (cached)` suit une étape qui a réutilisé un résultat [en cache](projects.md#build-caches). Avant le total `compile` d'un lot viennent ses phases avec le même sujet : `index`, `calls`, `liveness` (exécutables et inspections avec un point d'entrée), `declared-types`, `inference-cache` (avec `N of M covered modules reused`, [cache d'inférence](projects.md#inference-cache)), `inference`, `inference-store`, `contracts`, `lower`, `optimize`, `emit` (celles qui se sont exécutées). Après `inference` : des lignes `inference pass N` avec les pas de travail de la passe rapportés au budget de travail de l'inférence (`N of BUDGET work steps`) et la façon dont elle s'est terminée (`inputs changed`, `fun results changed`, `settled`, ou la passe finale après des passes non stabilisées), en nommant la fonction en cours d'exécution lorsque le budget s'est épuisé ; puis `inference slowest <module>:<function>/<arity>` pour les 10 fonctions (les groupes récursifs nomment un membre `and N more`) qui ont pris le plus de temps sur l'ensemble des passes, avec leurs pas de travail et la part de ce travail dans le budget des passes qui les ont exécutées (`877450 work steps, 43.9% of 10 passes of 200000 budget`), et `widened to term()` lorsqu'un budget a élargi l'un de leurs faits ; puis `inference rounds <module>:<function>/<arity> and N more` pour les 10 groupes récursifs les plus lents : résolutions sur l'ensemble des passes, tours exécutés par rapport au plafond par résolution (8 + 4 par membre), résolutions ayant atteint le plafond ou dépensé leur huitième du budget de la passe (chaque membre élargi à `term()`), résolutions abandonnées d'emblée parce qu'une passe antérieure l'avait fait (`remembered`) ou terminées avec le budget de la passe épuisé, parcours de membres (et ceux sautés parce que rien de ce qu'ils lisent n'avait changé) et la part qui a changé un résumé (agrandi, entrées de type fonction changées, ou revenu à l'un des 4 derniers résumés du membre), et les membres changés par tour de la dernière résolution en dix groupes de tours. Une compilation en cache n'affiche aucune phase |
| `--print-env` | Affiche l'environnement de compilation résolu en TOML sur stdout et termine sans traiter les sources ([rapport d'environnement](#environment-report)) |
| `--print-inputs` | Prétraite et analyse les entrées, ajoute les modules qu'elles nomment comme le fait la compilation, puis liste chaque source du lot sur stdout et s'arrête avant la compilation ([projets](projects.md#cli-and-target-selection)) |

- Sans `--emit`, la compilation vérifie les objets en mémoire et n'écrit rien
  hors du [répertoire de build](projects.md#build-directory).
- Les entrées positionnelles forment un lot ; chaque cible de projet est son
  propre lot.
- Racines des artefacts : `build/aot` (positionnel) ou `build/aot/<hex-target>`
  sous le répertoire du manifeste. Les racines explicites sont relatives à
  l'invocation.
- Les noms sont en hexadécimal réversible : `answer` →
  `clausev1_616e73776572__0.obj` (`.o` pour ELF/Mach-O, `.ll`, `.bc`) ;
  l'objet de démarrage est `clausev1_start.obj`.
- Tous les lots sont compilés et préparés avant publication. Les échecs ne
  publient rien et conservent les sorties précédentes ; le remplacement est
  atomique par fichier, pas par lot.
- `--emit` est incompatible avec `-o` ; les options de compilation sont
  incompatibles avec les actions purement frontend et `--new-project`.
  `--print-types` rejette les options de cible/d'optimisation.
- Les instantanés d'IR sont de l'assembleur LLVM ; plusieurs instantanés sont
  séparés par des en-têtes de commentaire échappés et ne forment pas un module
  analysable. Utiliser `--emit llvm-ir` comme entrée pour des outils. Les
  commentaires de ligne source montrent le texte d'origine (macros non
  développées) et survivent à l'optimisation grâce aux emplacements de
  débogage.

## Listings d'assembleur

`--print-asm` exécute le pipeline sélectionné (comme `--print-optimized-ir`),
puis affiche l'assembleur de chaque module d'entrée depuis la même machine
cible que celle qui écrit les objets, un module à la fois. Les commentaires
utilisent le marqueur de la cible (`#` sur x86, `//` sur AArch64 ELF, `;` sur
Apple, `@` sur ARM) :

```
# erlang answer.erl:3: value() -> 42.
#     ir store i64 687, ptr %frame.slots, align 8
	movq	$687, 32(%r15,%r12,8)
#     ir br i1 %4, label %return.inline, label %return.service
```

- Un commentaire `ir` ouvre chaque suite d'instructions sélectionnées à partir
  d'une instruction IR, écrite comme l'affiche `--print-optimized-ir` (même
  numérotation des valeurs, `switch` replié sur une ligne, sans `!dbg`). Le
  code déplacé ou fusionné entre instructions répète ou saute des commentaires
  selon ce que dit la table de lignes.
- Un commentaire `erlang` nomme le fichier physique, la ligne et le texte,
  comme les commentaires de source de l'IR, lorsque la ligne change au sein
  d'une fonction. Les instructions que l'abaissement n'a localisées nulle part
  (wrappers, mise en place du cadre) n'en ont pas.
- Le listing compile une copie dont la table de lignes numérote les
  instructions IR au lieu des lignes Erlang ; les directives de cette table de
  lignes, les sections de débogage et les étiquettes sont laissées de côté.
  Réassemblé, il donne l'objet qu'écrit `--emit obj`.
- Avec d'autres inspections, chaque module affiche tour à tour `before`,
  `after` et `assembly`, chacun après un en-tête (`stage=assembly`). Comme
  l'inspection de l'IR, elle rejette `--emit`, `--artifact-dir`, `--output` et
  `--print-types`. Les listings x86 utilisent la syntaxe AT&T.
- Avec `--entry`, les inspections d'IR et d'assembleur laissent de côté les
  fonctions que le point d'entrée ne peut atteindre, comme le fait
  l'exécutable (`--keep-exports` les garde).

## Rapport d'environnement

`--print-env` valide toute la ligne de commande (conflits, entrées
positionnelles lisibles, planification du projet), puis affiche ce que cette
commande utiliserait sous forme d'un document TOML sur stdout, termine avec le
code 0 et ne lit aucun source. Les chemins sont absolus, avec `/`.

```toml
# clau compile environment (--print-env)
command = ["clau", "--print-env", "-O2", "-o", "app", "main.erl"]  # as given
actions = ["link"]          # see below
working_directory = "/work"

[[targets]]                 # one per selected project target; one for positional inputs
name = "app"                # project targets only
project = "/work/project.toml"
sources = ["/work/src/main.erl"]           # globs and search paths resolved
library_directory = "/clau/library"     # application dirs, searched before source_search_paths
build_dir = "/work/build"   # "" for positional inputs without --build-dir
entry = "main:main"         # or "auto" when linking without --entry
output = "/work/app"        # linking only: final name (".exe" on Windows)
linker = "/usr/bin/clang++" # linking only; "" when none is found
runtime_library = "/clau/lib/libclause_runtime.a"

[targets.options]           # manifest option names
source_search_paths = []    # directories, patterns expanded
include_dirs = []           # search order, patterns expanded
defines = []
applications = { "stdlib" = "/otp/lib/stdlib" }  # last mapping wins
enabled_features = ["maybe_expr"]                # OTP defaults plus changes

[targets.backend]
target_triple = "x86_64-unknown-linux-gnu"  # host when not given
optimization = "O2"
type_specialization = true  # O2 without --no-type-specialization
debug_info = false
lto = false
keep_exports = false        # --keep-exports or the project option
emit = "none"               # or obj, llvm-ir, llvm-bc
artifact_dir = "/work/build/aot"
```

(Les tableaux affichent un élément par ligne.) `actions` liste les actions du
frontend (`print-pp`, `parse-check`, `print-ast`, `print-source`,
`print-abstr`, sinon `preprocess-check` ; `print-inputs` seul les remplace),
sinon les inspections (`print-types`, `print-ir`, `print-optimized-ir`,
`print-asm`), sinon `emit`, `link` (`-o`) ou `compile`. Dans un build de
projet, les cibles ayant un `output` lient aussi. Les modules trouvés plus tard
par leur nom (via `source_search_paths` ou la bibliothèque) ne sont pas
listés : les trouver exige l'analyse syntaxique (ce que fait
`--print-inputs`). `--print-env` ne peut pas être combiné avec
`--new-project`.

## Cache de compilation

Un lot disposant d'un répertoire de build (chaque cible de projet, les entrées
positionnelles avec `--build-dir`) garde le résultat de sa compilation dans le
[cache de build](projects.md#build-caches) : les diagnostics dans l'ordre,
l'échec et, lorsqu'un exécutable ou `--emit` en a besoin, les objets (ou le
bitcode) de chaque module et du module de démarrage. Un build ultérieur du même
lot avec les mêmes options rejoue les diagnostics et lie ou publie les objets
conservés exactement comme des objets neufs ; `--print-stage-times` affiche
alors `[time] compile ... (cached)`. `--print-ir`, `--print-optimized-ir`,
`--print-asm` et `--print-types` recalculent toujours, et `--no-cache` ne lit
ni n'écrit rien.

- **Unité de réutilisation : le lot entier.** L'analyse, l'inférence de types,
  les budgets de spécialisation (par cible), la vivacité des exports et le
  module de démarrage couvrent tous les modules, donc l'objet d'un module
  dépend de faits concernant les autres (types des appelés, records,
  behaviours, fonctions qui restent vivantes). Ces faits n'ont aujourd'hui
  aucune forme canonique à hacher par module, donc une clé par module ne
  pourrait pas être prouvée correcte ; toute modification de n'importe quel
  module du lot recompile le lot. Seuls les résultats d'inférence sont gardés
  par module pour les répertoires de bibliothèque couverts
  ([cache d'inférence](projects.md#inference-cache)), de sorte qu'une telle
  recompilation les réutilise.
- **Clé.** La version de `clau` et l'identité de l'exécutable ; le chemin et
  l'empreinte de chaque entrée (chaque fichier que le frontend a lu pour elle,
  chemin et octets, dans l'ordre : le source, ses inclusions et ses fichiers
  `include_lib`, et la réponse de ses parse transforms ; les options de
  prétraitement ; le texte généré des placeholders), les formes prédéfinies et
  le statut escript ; le triplet résolu, le niveau d'optimisation, `--emit`,
  `--no-type-specialization`, `-g`, `--lto`, `--keep-exports`, le fait qu'un
  exécutable soit lié ou non, la sélection du point d'entrée et la cible de
  projet. Les entrées d'une même cible avec d'autres options sont gardées côte
  à côte.
- **Stockage.** Chaque sortie est une partie à part entière, de sorte qu'un
  objet plus grand que la limite en ligne du stockage devient un fichier blob
  adressé par son contenu, partagé lorsque deux ensembles d'options produisent
  des objets identiques.

## Backend

- Un contexte LLVM et une machine cible par lot. Le triplet de l'hôte utilise
  le CPU et les fonctionnalités de l'hôte ; les triplets étrangers utilisent le
  CPU générique. PIC, petit modèle de code.
- Backends : X86, ARM, AArch64 (intersection avec le SDK). Les backends
  inconnus ou absents échouent ; il n'y a pas de repli sur l'hôte.
- La vérification s'exécute avant et après l'optimisation ; elle contrôle la
  validité de l'IR, pas la correction Erlang.
- Budgets par cible : 16 384 modules, 1 500 000 nœuds d'AST par module,
  16 000 000 par lot. Sortie sérialisée : 64 Mio par module, 256 Mio par lot.
  Dépasser un budget est un diagnostic de ressource ordinaire.

## SDK LLVM

LLVM stable **23.1.x**, au minimum 23.1.1. LLVM est une dépendance de l'hôte :
l'architecture, la bibliothèque standard C++ et le CRT Windows doivent
correspondre à ceux de l'outil de compilation. Le code du projet conserve les
exceptions/RTTI ; aucune exception ne doit traverser LLVM lors du déroulement
de la pile. Le runtime n'utilise jamais LLVM.

- La découverte parcourt les préfixes standard (`/usr`, `/usr/local`,
  `/opt/homebrew`, `/opt/local`, `/opt/llvm`, Linuxbrew,
  `/Library/Developer/Toolchains`, Program Files sous Windows), y compris les
  dispositions versionnées. Les arbres de compilation sont rejetés.
- `LLVM_DIR` sélectionne explicitement un SDK ; les sélections invalides
  échouent sans repli.
- Si aucun n'est trouvé, CMake télécharge l'archive épinglée **23.1.2**
  (SHA-256 vérifié) dans `thirdparty/` pour Windows x64/ARM64, Linux x64/ARM64
  ou macOS ARM64. `CLAUSE_DOWNLOAD_LLVM=OFF` désactive les téléchargements.
- Une sonde d'édition de liens au moment de la configuration vérifie la
  compatibilité ABI.

Configuration Windows x64 de référence : clang-cl 23.1.2 de l'hôte dans
`C:/Program Files/LLVM/bin`, SDK
`thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`, outils Visual Studio 18
x64, Windows SDK 10.0.26100.0, Ninja, `/MT`, `_ITERATOR_DEBUG_LEVEL=0`. La
sélection automatique applique `/MT` et les réglages d'itérateur ; un
`LLVM_DIR` explicite ne le fait pas, et la sonde d'édition de liens échoue
alors.

## PCRE2

Les builtins `re` du runtime utilisent PCRE2 **10.47**, la version qu'embarque
OTP 29 (`erts/emulator/pcre/vendor.info`), de sorte que la syntaxe des motifs,
les options et les captures se comportent comme dans OTP : unités de code de
8 bits, prise en charge d'Unicode, sans JIT, `pcre2_match` d'origine (le
correctif de cession d'OTP n'est pas repris). PCRE2 est sous licence
BSD-3-Clause avec l'exception PCRE2 pour les binaires compilés ; aucun fichier
de PCRE2 n'est versionné. CMake (`cmake/Pcre2Dependencies.cmake`) le résout
dans cet ordre :

1. `-DCLAUSE_PCRE2_ROOT=<source directory>` est prioritaire (aucun
   téléchargement) ; la version de son `configure.ac` doit être 10.47.
2. Un PCRE2 installé d'au moins la version 10.47 (`CLAUSE_PCRE2_SYSTEM=ON`, la
   valeur par défaut) : le paquet CMake
   (`find_package(pcre2 CONFIG COMPONENTS 8BIT)`, bibliothèques statiques
   préférées), sinon pkg-config `libpcre2-8`, une `libpcre2-8.a` statique étant
   préférée à la bibliothèque partagée.
3. La version épinglée, téléchargée dans `thirdparty/pcre2-10.47` et vérifiée
   (`pcre2-10.47.tar.bz2`, SHA-256
   `47fe8c99461250d42f89e6e8fdaeba9da057855d06eb7fc08d9ca03fd08d7bc7`) ;
   `-DCLAUSE_DOWNLOAD_PCRE2=OFF` désactive le téléchargement.

Un répertoire source (1 ou 3) construit la bibliothèque d'objets
`clause_pcre2` à partir des fichiers `.c` listés, avec les fichiers distribués
`config.h.generic`, `pcre2.h.generic` et `pcre2_chartables.c.dist` copiés dans
l'arbre de build (aucune étape de génération, aucune option d'avertissement du
projet, hors de clang-tidy et de Lizard), et ses objets sont ajoutés à
`clause_runtime` lui-même : l'archive est autonome et chaque consommateur
(éditions de liens de `clau`, programmes de test imbriqués, `runtime_link`,
`examples/compile`) obtient PCRE2 avec elle. Une bibliothèque installée devient
à la place une entrée supplémentaire de l'éditeur de liens, enregistrée dans
`clause_runtime.link` à côté de l'archive (une entrée par ligne), que `clau`
ajoute à chaque édition de liens ; une bibliothèque partagée rend les
exécutables dépendants d'elle à l'exécution. Par plateforme : Windows utilise
le téléchargement (aucun PCRE2 système n'y est recherché en pratique) ; Linux
et macOS utilisent un PCRE2 10.47 ou plus récent installé s'il est présent,
sinon le téléchargement. PCRE2 est toujours lié dans le runtime, y compris dans
les programmes qui n'appellent jamais `re`.

## zlib

Le module zlib du runtime et les termes externes compressés utilisent zlib
**1.3.2**, la version qu'embarque OTP 29 (`erts/emulator/zlib/vendor.info`), de
sorte que les octets compressés sont identiques à ceux d'OTP. CMake compile ses
sources de bibliothèque (`cmake/ZlibDependencies.cmake`,
`clause_add_runtime_zlib`) dans la bibliothèque d'objets `clause_runtime_zlib`,
dont les objets rejoignent `clause_runtime` comme ceux de PCRE2 ;
`-DCLAUSE_RUNTIME_ZLIB_ROOT=<source directory>` est prioritaire, sinon la
version est téléchargée dans `thirdparty/zlib-1.3.2` et vérifiée (SHA-256
`bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16`) sur chaque
hôte. La licence de zlib est la licence zlib. Le LLVM du compilateur garde sa
propre zlib ; les deux ne se rencontrent jamais dans un même binaire.

Autres prérequis : CMake ≥ 3.28, un compilateur C++23, Boost ≥ 1.90, toml++
3.4.0 et les outils de qualité. OTP n'est nécessaire que pour les audits
optionnels et la régénération des fixtures.
