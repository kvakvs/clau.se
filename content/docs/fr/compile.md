---
source: docs/compile.md
sourceCommit: 06042fa
sourceSha256: 6cf8b5c873d19e18501458078ca8c8ceb51da4da995693046af31ca5a78824b4
translatedAt: 2026-10-09
---
# Compilation

`clau` compile des modules Erlang/OTP 29 via LLVM en IR vérifié, en bitcode ou
en objets natifs. `-o/--output` lie les entrées positionnelles (ou une cible de
projet sélectionnée), leur objet de démarrage d'[entrée](executables.md) et le
runtime en un exécutable ([édition de liens](executables.md#linking)) ; les
compilations de projet lient les cibles exécutables vers les sorties de leur
manifeste ([projets](projects.md#executables)). Les objets émis peuvent aussi
s'exécuter via un harnais C++ lié au runtime (voir l'exemple ci-dessous).

## Sous-ensemble de source accepté

Modules nommés avec exports et clauses de fonction ordonnées. Les têtes et les
correspondances dans les corps acceptent les variables, `_`, les alias, les noms
répétés et les motifs sur atomes, entiers arbitraires, flottants finis, tuples,
listes/chaînes, maps, bitstrings et records ordinaires sous forme de tuples. Les
corps sont des séquences de correspondances, constructeurs, opérateurs/BIF de
garde vérifiés, `erlang:display/1` ([affichage](terms.md#printing)), `halt/0,1`
([code de sortie](executables.md#exit-status)), les fonctions qui lèvent
`error/1,2,3`, `exit/1`, `throw/1` et `erlang:raise/3`
([ABI](abi.md#failure-channel-revision-2)), les autres
[builtins du pont](builtins.md) (`erlang:function_exported/3`) et les funs de
builtins, `case`/`if`, `catch Expr`,
`try ... of ... catch Class:Reason:Stack ... after` avec
[traces de pile](abi.md#stack-traces), `maybe ... else ... end`, les
comprehensions de liste, de binary et de map
([motifs](patterns.md#comprehensions)) et les appels directs locaux ou distants
littéraux au sein du lot, y compris la récursion sur soi, mutuelle et entre
modules sur des cadres de processus explicites avec de vrais appels terminaux
([modèle d'exécution](execution-model.md#implementation)) ; la récursion non
terminale est bornée par la pile du processus (sans plafond par défaut), non par
la pile native. Les gardes prennent en charge tout le catalogue admis. Voir
[motifs](patterns.md), [gardes](guards.md) et [termes](terms.md).

Les valeurs fonctionnelles `fun F/A`, `fun M:F/A`, les funs anonymes et nommées
avec variables capturées, les appels de funs et les appels dynamiques
(`M:F(...)`, `apply/2,3`) s'exécutent ([funs](funs.md)). Rejetés avec
diagnostics, même dans les fonctions inutilisées :
`receive`, funs de builtins,
processus et messagerie.
Attributs acceptés : `module`, `export`, `file`, `record` tuple et natif,
`export_record`, `import_record`, formes type/spec,
`doc`/`moduledoc`, `author`, `vsn`, `copyright`, `deprecated`,
`-compile` avec `{no_auto_import, ...}` ou des options `nowarn_*` qui ne
concernent que les avertissements (par exemple `nowarn_deprecated_catch`) et
`-import` des BIF de garde d'`erlang`. Les autres attributs (`on_load`, parse
transforms, autres options `compile`, modules paramétrés) sont rejetés.
Les sources commençant par `#!` suivent les
[règles des escripts](executables.md#escripts) (module implicite et export de
`main/1`, `-mode` accepté).
Les formes type/spec sont analysées mais ne modifient jamais le code généré. Les
modes purement syntaxiques (`--parse-check`, `--print-ast`, `--print-source`,
...) acceptent la grammaire complète.

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
`-DGENERATED_DIR="$PWD/build/example-aot"` (les exécutions natives n'y sont pas
encore validées).

Autres actions sur les mêmes sources :

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

## Affichage du source

`--print-source` (une action du frontend, comme `--print-ast`) affiche chaque
module analysé sous forme de source Erlang ; `--print-types` affiche le même
texte avec des annotations de type. L'afficheur (`print_source`,
`expression_source`, `type_source` dans `printing.hpp` ;
`compiler/src/printing/source_*`) est réutilisable :

- Les formes se suivent dans l'ordre du source, avec une ligne vide autour de
  chaque fonction ; la forme `-file` que le préprocesseur ajoute avant un module
  est omise, celles qui entourent les fichiers inclus sont conservées.
- Le texte est la syntaxe analysée : les macros sont développées, les inclusions
  intégrées, et les commentaires, l'orthographe et la mise en page d'origine ont
  disparu. Les clauses et les expressions de bloc (`case`, `if`, `receive`,
  `try`, `maybe`, `begin`, funs de plus d'une ligne) occupent des lignes
  indentées de quatre colonnes ; tout le reste tient sur une ligne. Les
  parenthèses ne proviennent que des groupes du source lui-même.
- Le texte affiché se réanalyse en le même arbre syntaxique, et l'afficher de
  nouveau donne le même texte (CTest `printing_source` sur les fixtures
  analysables).
- `SourceNotes` ajoute une annotation à une expression, affichée sous la forme
  `Expression :: Text` (entre parenthèses sauf s'il s'agit d'une expression
  formant tout un corps ; ce n'est pas de l'Erlang), et des lignes de
  commentaire au-dessus d'une forme. Les motifs, les gardes et le côté gauche
  d'une correspondance n'en portent aucune.

## Options

| Option | Comportement |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publie un artefact par module |
| `--artifact-dir DIR` | Racine des artefacts (exige `--emit`) |
| `-o PATH` / `--output PATH` | Lie un exécutable ([édition de liens](executables.md#linking)) ; incompatible avec `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Pilote Clang et archive du runtime pour `-o` |
| `--entry MODULE[:FUNCTION]` | Fonction d'entrée/1 de l'exécutable ; validée dans tous les modes de compilation et ajoute l'artefact de démarrage `clausev1_start` ([exécutables](executables.md#startup-object)) |
| `--target-triple TRIPLE` | Machine cible ; `--target` sert à sélectionner une cible de projet |
| `-O0` / `-O2` / `-Os` | Code générique par défaut + LLVM O0 / spécialisation bornée + LLVM O2 / LLVM Os, sans spécialisation, une section par symbole et élimination par l'éditeur de liens du code et des données non référencés |
| `--no-type-specialization` | Désactive les variantes quel que soit l'ordre des options |
| `--print-ir` / `--print-optimized-ir` | IR vérifié avant/après les passes LLVM, avec les lignes du source Erlang en commentaires |
| `--print-types` | Chaque module sous forme de source Erlang annoté des types inférés ([sémantique](semantic.md#--print-types)) ; s'arrête avant LLVM |
| `--verbose` | Événements de phase `[pp]`, `[parse]` et `[comp]` sur stderr |
| `--impldebug n[,n...]` | Sortie de débogage par étape d'implémentation sur stderr (par ex. `23` : résumés d'inférence) |

- Sans `--emit`, la compilation vérifie les objets en mémoire et n'écrit rien.
- Les entrées positionnelles forment un lot ; chaque cible de projet est son
  propre lot.
- Racines des artefacts : `build/aot` (positionnel) ou `build/aot/<hex-target>`
  sous le répertoire du manifeste. Les racines explicites sont relatives à
  l'invocation.
- Les noms sont en hexadécimal réversible : `answer` →
  `clausev1_616e73776572__0.obj` (`.o` pour ELF/Mach-O, `.ll`, `.bc`) ; l'objet
  de démarrage est `clausev1_start.obj`.
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
  développées) et survivent à l'optimisation grâce aux emplacements de débogage.

## Backend

- Un contexte LLVM et une machine cible par lot. Le triplet de l'hôte utilise le
  CPU et les fonctionnalités de l'hôte ; les triplets étrangers utilisent le CPU
  générique. PIC, petit modèle de code.
- Backends : X86, ARM, AArch64 (intersection avec le SDK). Les backends inconnus
  ou absents échouent ; il n'y a pas de repli sur l'hôte.
- La vérification s'exécute avant et après l'optimisation ; elle contrôle la
  validité de l'IR, pas la correction Erlang.
- Budgets par cible : 1 024 modules, 250 000 nœuds d'AST par module, 1 000 000
  par lot. Sortie sérialisée : 64 Mio par module, 256 Mio par lot. Dépasser un
  budget est un diagnostic de ressource ordinaire.

## SDK LLVM

LLVM stable **23.1.x**, au minimum 23.1.1. LLVM est une dépendance de l'hôte :
l'architecture, la bibliothèque standard C++ et le CRT Windows doivent
correspondre à ceux de l'outil de compilation. Le code du projet conserve les
exceptions/RTTI ; aucune exception ne doit traverser LLVM lors du déroulement de
la pile. Le runtime n'utilise jamais LLVM.

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

Configuration Windows x64 de référence (2026-09-29) : clang-cl 23.1.2 de l'hôte
dans `C:/Program Files/LLVM/bin`, SDK
`thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`, outils Visual Studio 18
x64, Windows SDK 10.0.26100.0, Ninja, `/MT`, `_ITERATOR_DEBUG_LEVEL=0`. La
sélection automatique applique `/MT` et les réglages d'itérateur ; un
`LLVM_DIR` explicite ne le fait pas, et la sonde d'édition de liens échoue alors.

Référence macOS historique : `llvm` 23.1.1_1 de Homebrew (arm64,
`libLLVM.23.1.dylib` partagée, assertions désactivées) avec AppleClang 21.

Autres prérequis : CMake ≥ 3.28, un compilateur C++23, Boost ≥ 1.90, toml++
3.4.0 et les outils de qualité. OTP n'est nécessaire que pour les audits
optionnels et la régénération des fixtures.
