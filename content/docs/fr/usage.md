---
source: docs/usage.md
sourceCommit: 06042fa
sourceSha256: 69cd5cc2e8c6acc6bf67d677812a78d984940084e75d4930fbdcdf681e488435
translatedAt: 2026-10-09
---
# Utiliser le compilateur

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

Sous macOS, `./run-macos.sh --parse-check examples/project/src/main.erl` compile
d'abord puis lance le dernier exécutable, en transmettant tous les arguments sans
modification. Il accepte les variables d'environnement `BUILD_DIR`, `BUILD_TYPE`
et `JOBS` pour remplacer les valeurs par défaut.

```text
clau [options] <source.erl>...
  --project <path>        Read a TOML project instead of positional sources
  --target <name>         Select a target; repeat for more (default: all)
  --new-project <filename>  Create an annotated starter; append .toml when needed
  --preprocess-check       Check preprocessing only
  --parse-check            Preprocess and check syntax
  --print-pp               Print expanded Erlang source
  --print-ast              Print an indented syntax tree
  --print-source           Print each module as Erlang source
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  --verbose               Trace files and compilation phases to stderr
  --impldebug <n[,n...]>   Enable debug output for selected implementation steps
  -I, --include <dir>      Add an include directory (last supplied searched first)
  -D, --define <name[=term]>  Define a macro (default value: true)
  --app-dir <app=dir>      Set an include_lib application directory
  --enable-feature <name>  Enable a language feature
  --disable-feature <name> Disable a language feature
  -h, --help              Show all options
  --version               Show version
  --                      Treat remaining arguments as input paths
```

Mettre entre guillemets les chemins contenant des espaces et les valeurs de
macro contenant de la ponctuation du shell :

```sh
./build/debug/bin/clau --parse-check -I include '-DVERSION={1,0}' \
  --app-dir myapp=examples/project examples/project/src/main.erl
```

Les modes de vérification sont silencieux en cas de succès ; les diagnostics vont
sur stderr. Les modes d'affichage écrivent sur stdout et peuvent être combinés :
`--print-pp --print-ast` affiche le source avant l'arbre pour chaque entrée.
Ajouter `--preprocess-check` ne désactive pas l'analyse syntaxique demandée par
`--parse-check` ou `--print-ast`. Les erreurs peuvent laisser une sortie
affichée partielle.

Sans action de vérification/affichage, les entrées sources et `--project`
exécutent toute la chaîne jusqu'à des tampons d'objets natifs vérifiés en
mémoire. Les entrées positionnelles forment un lot ; chaque cible de projet forme
son propre lot. `--emit` écrit les artefacts sous `build/aot` ou
`--artifact-dir` ; les projets ajoutent un nom de cible encodé et utilisent une
racine par défaut relative au manifeste. Les noms de fichiers encodent l'identité
du module. `-o PATH` lie les entrées positionnelles, ou une cible de projet
sélectionnée, en un exécutable avec Clang et la bibliothèque du runtime (entrée :
`--entry MODULE[:FUNCTION]`, `entry` du manifeste, ou le seul module exportant
`main/1`). Sans `-o`, les cibles de projet ayant une clé `output` ou `entry` sont
liées vers leur `output` TOML (par défaut `build/<target>`), avec publication
seulement une fois toutes les cibles sélectionnées liées.
Voir [exécutables](executables.md) pour le contrat sur l'entrée, les arguments et
le code de sortie.

```sh
clau -O2 -o demo answer.erl client.erl && ./demo
clau -O2 --emit obj answer.erl client.erl
clau --print-ir --print-optimized-ir -O2 answer.erl
clau --print-types answer.erl client.erl
```

L'inspection de l'IR autorise les deux étapes ensemble et s'arrête avant
l'émission des objets. Plusieurs instantanés sont des modules séparés ; utiliser
`--emit llvm-ir` pour obtenir des fichiers d'assembleur individuels.
L'inspection des types s'arrête avant LLVM et affiche chaque module sous forme de
source avec les signatures de fonctions inférées et des annotations
`Expression :: Type`. Elle accepte les options de prétraitement/projet/verbosité,
mais rejette les autres actions, les destinations de sortie et la politique du
backend. Voir [options de compilation](compile.md).

`--verbose` affiche `[pp] <filename>` pour les fichiers sources et les inclusions
résolues du préprocesseur, et `[parse] <filename>` quand chaque source entre dans
l'analyseur. Les inclusions imbriquées et de bibliothèque sont tracées au fur et à
mesure de leur chargement ; les inclusions inactives sont ignorées. L'analyseur
consomme les jetons développés de façon incrémentale, sa trace peut donc précéder
celles des inclusions. `[comp]` ajoute les phases sémantique/backend et les
décisions de spécialisation bornée au moment où elles commencent. Le traçage va
sur stderr dans tous les modes, projets compris.

`--impldebug 23` ou `--impldebug 23,24,27` sélectionne une sortie de débogage
optionnelle par étape d'implémentation, indépendamment de `--verbose`. Les
options répétées combinent leurs sélections ; les doublons sont ignorés. Les
valeurs sont des entiers décimaux signés sur 32 bits, avec signes `+`/`-`
optionnels, sans espaces ni membres de liste vides. Les étapes 23–27 affichent
sur stderr les entrées/résultats de fonctions inférés et les relations entre
paramètres avec le préfixe de l'étape choisie (par exemple `[impldebug 27]`). Ce
sont les entrées analysées de l'abaissement, pas un dump d'IR. Les étapes futures
peuvent tester leur propre numéro ; sélectionner une étape sans sortie de débogage
n'a aucun effet. La même sélection s'applique aux entrées positionnelles et à
toutes les cibles de projet sélectionnées. Les actions de vérification/affichage
purement frontend n'exécutent pas l'inférence.

Codes de sortie : **0** en cas de succès (avertissements compris), **1** pour les
erreurs de source/projet, **2** pour les erreurs d'utilisation ou les noms de
cible inconnus.
Chaque entrée a un état de prétraitement indépendant ; toute erreur dans une
source fait échouer la commande dans son ensemble.

Les vérifications syntaxiques ne valident pas la sémantique et n'exécutent pas
les parse transforms. Les modes de vérification/affichage ne créent pas de
fichiers de sortie et rejettent `-o`/`--output`. La compilation par défaut sans
`-o` n'écrit aucun exécutable.

Voir [prétraitement](preprocessor.md), [utilisation de l'analyseur](parser.md) et
[état de la validation](validation.md) pour plus de détails.


## Projets


Exécuter l'exemple fourni à deux cibles :

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target app
./build/debug/bin/clau --preprocess-check --project examples/project/project.toml --target tests --target app
```

Créer un projet annoté dans un répertoire existant :

```sh
mkdir -p build/project-demo
./build/debug/bin/clau --new-project build/project-demo/demo
mkdir -p build/project-demo/src
cp examples/project/src/main.erl build/project-demo/src/main.erl
./build/debug/bin/clau --parse-check --project build/project-demo/demo.toml
```

La création n'écrit que le fichier TOML demandé et refuse les destinations
existantes. Le modèle de départ contient une cible `app` utilisant `src`, avec
toutes les options du frontend à leurs valeurs par défaut. Ajouter des fichiers
sources avant de le vérifier.

Les chemins du manifeste sont relatifs au fichier TOML ; les chemins de la CLI
sont relatifs au répertoire d'invocation. Toutes les cibles s'exécutent par
défaut. Répéter `--target` pour choisir un sous-ensemble ordonné ; les sélections
répétées s'exécutent une seule fois. `sources` accepte des noms de fichiers
littéraux et des motifs `*`, `?`, `**` ; `source_dirs` découvre récursivement les
fichiers `.erl`. Les chemins de recherche de sources ne servent qu'à localiser
les fichiers listés explicitement. Les chemins d'inclusion de la CLI sont
prioritaires, les racines d'application de la CLI remplacent les noms
correspondants, les réglages de fonctionnalités de la CLI s'appliquent en dernier,
et les définitions de macro en double restent des erreurs.

Voir [format et utilisation des projets](projects.md). Les projets prennent en
charge toutes les actions de la CLI ; la génération d'exécutables reste non
implémentée.

Le [catalogue des gardes admises](guards.md) comprend `is_integer/3` vérifiée,
les appels qualifiés et les anciens tests au niveau supérieur ; les identités de
processus/nœud et de native record conservent des diagnostics de capacité
explicites.
