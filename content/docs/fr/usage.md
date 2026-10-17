---
source: docs/usage.md
sourceCommit: a8c3f8f6
sourceSha256: 06562916f7abbce822d9a5ca87d42cc0b3306de611e06ebce33ca5b2bd10d101
translatedAt: 2026-10-17
---
# Utiliser le compilateur

Construire un programme à partir des sources ; l'entrée est le seul module
exportant `main/1`, qui reçoit les arguments de la ligne de commande sous forme
de chaînes :

```sh
clau -O2 -o demo examples/compile/answer.erl examples/compile/client.erl
./demo
clau -o app --entry app:start src/*.erl     # app:start/1, else app:start/0
```

Sous Windows, `-o` ajoute `.exe` lorsque le chemin n'a pas d'extension. Sans
`-o`, les entrées positionnelles sont compilées en mémoire et ne produisent que
des diagnostics. Voir [exécutables](executables.md) pour le choix de l'entrée,
les arguments, le code de sortie et l'édition de liens, et
[l'exemple de module compilé](../examples/compile/) pour un hôte C++ qui lie
lui-même les objets émis.

Les projets décrivent leurs cibles en TOML ; chaque cible ayant une clé `output`
ou `entry` est liée vers sa sortie (par défaut `build/<target>`), et les sorties
ne sont remplacées qu'une fois que toutes les cibles sélectionnées ont réussi :

```sh
clau --new-project myapp                        # writes an annotated myapp.toml
clau --project myapp.toml                       # build every target
clau --project examples/project/project.toml --target app --parse-check
```

Voir [projets](projects.md) pour le manifeste, la découverte des sources, les
sources ignorées, les répertoires de build et les caches.

Options courantes (`clau --help` les liste toutes) :

| Option | Rôle |
| --- | --- |
| `-o, --output PATH`, `--entry M[:F[/A]]` | Lier un exécutable et choisir son entrée |
| `--project PATH`, `--target NAME` | Construire un projet TOML, ou des cibles choisies |
| `-O0`, `-O2`, `-Os`, `--no-type-specialization` | Optimisation (O0 par défaut ; O2 ajoute la spécialisation par type) |
| `-g`, `--lto`, `--keep-exports` | Tables de lignes de débogage, optimisation à l'édition de liens, conservation des exports inaccessibles |
| `-I DIR`, `-D NAME[=TERM]`, `--app-dir APP=DIR` | Chemins d'inclusion, macros, racines de `include_lib` |
| `--enable-feature F`, `--disable-feature F` | Fonctionnalités du langage OTP |
| `--parse-transform M`, `--transform-path DIR`, `--erl PATH\|none` | Parse transforms et l'OTP de l'hôte qui les exécute |
| `--emit obj\|llvm-ir\|llvm-bc`, `--artifact-dir DIR` | Écrire un artefact par module (racine par défaut `build/aot`) |
| `--target-triple TRIPLE`, `--linker PATH`, `--runtime-library PATH` | Cible, pilote d'édition de liens et archive du runtime |
| `--build-dir DIR`, `--no-cache`, `--cache-inference-in-dirs PAT` | Fichiers temporaires et caches de build |
| `--verbose`, `--print-stage-times` | Tracer les phases ; chronométrer chaque étape sur stderr |

Les actions d'inspection écrivent sur stdout et ne compilent pas
d'exécutables :

| Option | Affiche |
| --- | --- |
| `--preprocess-check`, `--parse-check` | Rien ; diagnostics uniquement |
| `--print-pp`, `--print-ast`, `--print-source`, `--print-abstr` | Source prétraité, arbre syntaxique, source, format abstrait d'OTP |
| `--print-inputs` | Chaque source du lot, y compris les modules de bibliothèque ajoutés par référence |
| `--print-env` | L'environnement de compilation résolu, en TOML |
| `--print-types` | Le source annoté avec les types inférés |
| `--print-ir`, `--print-optimized-ir`, `--print-asm` | L'IR avant/après l'optimisation LLVM, l'assembleur avec commentaires IR et Erlang |

`clau` se termine avec 0 en cas de succès (avertissements compris), 1 pour les
erreurs de source ou de projet et 2 pour les erreurs d'utilisation. Détails :
[compilation](compile.md), [prétraitement](preprocessor.md),
[analyseur syntaxique](parser.md).

Les parse transforms (`-compile({parse_transform, M})`) s'exécutent sur un
Erlang/OTP 29 installé sur l'hôte (`erl` dans le `PATH`, ou `--erl`), comme le
ferait `erlc` ; seule la compilation a besoin d'OTP, jamais l'exécutable. Les
transforms autres que ceux d'OTP doivent d'abord être compilés en `.beam`
([parse transforms](transforms.md)).

### Options du runtime

Les programmes lisent les options du runtime dans la variable d'environnement
`CLAUSE_FLAGS` et dans les premiers arguments de la ligne de commande, jusqu'au
premier autre argument ou jusqu'à `--` :

```sh
./demo --schedulers 4 --max-heap 100000000 -- arg1 arg2
```

`--schedulers N`, `--max-atoms N`, `--max-heap BYTES`, `--max-stack BYTES`,
`--max-memory BYTES` et `--profile FILE` sont décrits dans
[options du runtime](executables.md#runtime-options).
