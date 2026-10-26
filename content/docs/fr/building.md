---
source: docs/building.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b5b9cdbb0544c714f847eac4931ed0fa38d8de1144153349efac4c2302159cbc
translatedAt: 2026-10-26
---
# Construire Clause

Comment compiler `clau` et `clause_runtime`, configurer la compilation, lancer
les tests et utiliser les outils de développement. La conception et les
résultats des tests sont dans [validation](validation.md).

## Prérequis

- CMake 3.28+ et un compilateur C++23 ; sous Windows, la charge de travail
  **Développement Desktop en C++** de Visual Studio avec un SDK Windows, Ninja
  et une installation globale de LLVM/Clang (`clang-cl`, et `clang` pour
  l'édition de liens des programmes).
- Le SDK C++ LLVM 23.1.x (23.1.1 ou ultérieur) pour le compilateur. Une
  installation globale est préférable ; sinon CMake télécharge le SDK épinglé
  23.1.2 dans `thirdparty/` sous Windows x64/ARM64, Linux x64/ARM64 et macOS
  ARM64 ([SDK LLVM](compile.md#llvm-sdk)). Les outils en ligne de commande
  LLVM seuls ne comprennent pas le SDK.
- Boost 1.90+ (Multiprecision, Asio et Parser pour le compilateur ; uniquement
  des en-têtes), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 et zlib 1.3.2.
  CMake télécharge les dépendances manquantes dans `thirdparty/` avec des
  vérifications SHA-256 et les réutilise hors ligne, même pour de nouveaux
  répertoires de compilation ; sous Linux et macOS, Boost et toml++ proviennent
  d'une installation ou de `thirdparty/`
  ([dépendance de compilation](projects.md#build-dependency)).
- Python 3 pour les tests et les outils de qualité, de benchmark et de listing.
- Erlang/OTP n'est pas nécessaire pour compiler ni tester. Les tests utilisent
  des [fixtures de référence propres au projet](../tests/fixtures/patternmatch/generated/README.md) ;
  seules les transformations syntaxiques, les audits optionnels en direct, la
  régénération des fixtures et les benchmarks nécessitent une installation
  d'OTP 29.

Sous macOS (Erlang optionnel) :

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```

## Configurer et compiler

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

## Scripts d'enveloppe

Variables d'environnement de remplacement : `BUILD_DIR`, `TOOL_BUILD_DIR`,
`BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`.

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

## Options de configuration

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
| `-DCLAUSE_OPTIMIZED_COMPILER=OFF` | Compile `clau` et les bibliothèques du compilateur sans optimisation en Debug (pour déboguer un plantage de `clau`) |

Notes pour Windows : le CRT par défaut est `/MDd` (Debug) ou `/MD` ; un réglage
explicite `CMAKE_MSVC_RUNTIME_LIBRARY` doit correspondre au SDK LLVM. `cl` de
MSVC fonctionne dans un répertoire de compilation séparé ; MinGW n'est pas pris
en charge. Les cibles du projet traitent les avertissements comme des erreurs
et incluent les dépendances comme en-têtes `SYSTEM` ; éviter donc d'ajouter des
chemins de dépendances via des options `-I` globales comme `CXXFLAGS` (dans
CLion, vider une valeur en cache avec `-DCMAKE_CXX_FLAGS:STRING=`) ; utiliser
plutôt les options de racine.

## Tests

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
emplacements CTest, de sorte que `-j N` exécute N/2 tests simultanément.

## Contrôle de qualité

Lizard et clang-tidy, épinglés dans `tools/requirements-quality.txt` et installés
dans `.venv-quality/` (utiliser `.venv-quality/bin/python` hors de Windows) :

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` vérifie les fichiers modifiés depuis `HEAD` (ou
`CLAUSE_QUALITY_BASE`) ainsi qu’une unité de traduction par en-tête
modifié (`check-quality-all` couvre tous les dépendants), et nécessite une
compilation où le compilateur et le runtime
sont tous deux activés ; `check-complexity-all` et `check-clang-tidy-all`
lancent un seul outil. `cmake/CheckClangTidy.cmake` accepte
`QUALITY_SHARD=K/N` pour découper une longue exécution.

## Benchmarks et listings

`make benchmark` / `make-benchmark.bat` compilent un `clau` Release dans
`build/bench` et comparent les programmes `benchmarks/bench_*.erl` à l'OTP de
l'hôte et à un ancien commit de Clause ; `benchmarks/run.py --help` liste les
options ([benchmarks](validation.md#benchmarks)). Ils ne font jamais partie
des tests.

`benchmarks/compile_times.py` chronomètre `clau` lui-même : il exécute une
charge de compilation (`--workload W1`, ou des arguments de `clau` après `--`)
plusieurs fois sur les cœurs performants avec `--no-cache --print-stage-times`,
et indique la médiane, le minimum et la dispersion de chaque phase et passe
d'inférence, les composants d'inférence les plus lents, et si les compteurs de
passes et la sortie standard concordent entre les exécutions. Avec
`--baseline <clau.exe>`, les deux versions alternent et le résumé indique leur
rapport. Il refuse de chronométrer pendant des compilations, des tests ou une
autre exécution de `clau`, sauf avec `--force-noisy`, et écrit du JSON dans
`build/bench/compile-times/`.

`decompile-debug.bat <module>` et `decompile-release.bat <module>` écrivent
l'assembleur Debug ou Release d'un source C++ de Clause dans
`<module>.debug.asm` / `<module>.release.asm`, avec les lignes source et les
noms démanglés (`tools/asm.py`, compilations clang-cl ; `--function TEXT`
filtre les résultats).
