---
source: docs/building.md
sourceCommit: 336caea7
sourceSha256: 86d39780700856574257fd2d598102b8e551505085c42a0a8175f9c2c7b2330c
translatedAt: 2026-10-18
---
# Construire le compilateur

Configurer et compiler depuis la racine du dépôt :

```sh
cmake --preset debug                    # build/debug, single configuration
cmake --build --preset debug
```

Sous Windows, depuis un shell de développement x64 avec `clang-cl` et `ninja`
dans le `PATH` :

```powershell
cmake --preset windows                  # build/windows, Ninja Multi-Config
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Le preset `debug` place `clau` dans `build/debug/bin` ; le preset `windows` dans
`build/windows/bin/<Config>/clau.exe`, avec le runtime dans
`build/windows/lib/<Config>/clause_runtime.lib`. `clau` trouve l'archive du
runtime et les modules de `library/` par rapport à son propre emplacement.

Scripts d'enveloppe (variables d'environnement de remplacement : `BUILD_DIR`,
`TOOL_BUILD_DIR`, `BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`,
`CLANG_FORMAT`) :

| Makefile | Windows | Rôle |
| --- | --- | --- |
| `make build` | `make-build.bat` | Compile `clau` dans `build/tool` sans les tests (le script batch compile en Release et compile aussi le runtime) |
| `make test`, `make test-full` | `make-test.bat` | Configure `build/debug` avec les tests, compile tout, lance CTest |
| `make format`, `make format-all` | `make-format.bat` | Applique clang-format aux fichiers C++ modifiés (ou, avec `FORMAT_SCOPE=all`, à tous) |
| `make benchmark` | `make-benchmark.bat` | Compilation Release dans `build/bench`, puis comparaison avec l'OTP de l'hôte |
| `make clean` | `make-clean.bat` | Supprime `build/` et `cmake-build*/` |

Les scripts batch entrent eux-mêmes dans l'environnement Visual Studio x64 si
nécessaire, ajoutent `%ProgramFiles%\LLVM\bin` au `PATH` quand `clang-cl` est
absent et reconfigurent un répertoire de compilation créé par un autre
générateur ou compilateur ; définir `CLAUSE_TOOLCHAIN=default` pour garder le
choix propre de CMake. `clau.bat` (Windows) et `run-macos.sh` compilent d'abord
`build/tool`, puis lancent `clau` avec tous les arguments, en conservant le
répertoire de travail et le code de sortie de l'appelant.

Options de configuration :

| Option | Rôle |
| --- | --- |
| `-DBUILD_TESTING=ON` | Compile les tests et leurs programmes auxiliaires (OFF par défaut) |
| `-DCLAUSE_BUILD_COMPILER=OFF` | Compile seulement la bibliothèque du runtime, sans LLVM |
| `-DCLAUSE_BUILD_RUNTIME=OFF` | Compile seulement le compilateur |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Choisit un SDK LLVM 23.1.x (un chemin explicite invalide échoue) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Exige un SDK installé |
| `-DCLAUSE_BOOST_ROOT=...`, `-DCLAUSE_TOML_ROOT=...`, `-DCLAUSE_SQLITE_ROOT=...`, `-DCLAUSE_PCRE2_ROOT=...` | Choisit les sources ou l'installation d'une dépendance (configuration hors ligne) |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Choisit l'exécutable Clang sous Windows |
| `-DCLAUSE_OTP_AUDITS=ON`, `-DCLAUSE_ESCRIPT=/path/to/escript` | Active les audits optionnels en direct avec OTP et choisit l'OTP 29 utilisé |
| `-DCLAUSE_TEST_DEBUG_INFO=ON` | Compile les programmes de test avec les informations de débogage (pour déboguer un plantage) |

Notes pour Windows : le CRT par défaut est `/MDd` (Debug) ou `/MD` ; un réglage
explicite `CMAKE_MSVC_RUNTIME_LIBRARY` doit correspondre au SDK LLVM. `cl` de
MSVC fonctionne dans un répertoire de compilation séparé ; MinGW n'est pas pris
en charge. Les cibles du projet traitent les avertissements comme des erreurs
et incluent les dépendances comme en-têtes `SYSTEM` ; éviter donc d'ajouter des
chemins de dépendances via des options `-I` globales comme `CXXFLAGS` (dans
CLion, vider une valeur en cache avec `-DCMAKE_CXX_FLAGS:STRING=`) ; utiliser
plutôt les options de racine.

## Tests

Les tests s'activent explicitement lors de la configuration :

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug-fast                # or windows-debug-fast
ctest --preset debug -j 16               # full mode
```

`CLAUSE_TEST_MODE=fast` (les presets `*-fast`, `make test`, `make-test.bat`)
exécute une matrice réduite d'optimisations et de pilotes et ignore les tests
`full_only` ; `full` (la valeur par défaut si rien n'est défini,
`make test-full`, `TEST_MODE=full`) exécute tout. Chaque test réserve deux
emplacements CTest, de sorte que `-j N` exécute N/2 tests simultanément. Les
tests compilent de vrais sources Erlang via la CLI et comparent les exécutables
avec des références (goldens) générées par OTP ; voir
[validation](validation.md) pour la base de référence, les fixtures et la
conception des tests.

Contrôle de qualité (Lizard et clang-tidy, outils épinglés dans
`tools/requirements-quality.txt` et installés dans `.venv-quality/` ; utiliser
`.venv-quality/bin/python` hors de Windows) :

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` vérifie les fichiers modifiés depuis `HEAD` (ou
`CLAUSE_QUALITY_BASE`) ainsi qu’une unité de traduction par en-tête
modifié (`check-quality-all` couvre tous les dépendants lors de la
vérification complète), et nécessite une compilation où le compilateur et le runtime
sont tous deux activés ; `check-complexity-all` et `check-clang-tidy-all`
lancent un seul outil. `cmake/CheckClangTidy.cmake` accepte
`QUALITY_SHARD=K/N` pour découper une longue exécution.
