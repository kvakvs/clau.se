---
source: docs/building.md
sourceCommit: 06042fa
sourceSha256: de3570e747becc95b3596b8c17bf4d8bab1fa83db2aae32da918222afd413e6c
translatedAt: 2026-10-09
---
# Construire le compilateur

Depuis la racine du dépôt :

```sh
cmake --preset debug
cmake --build --preset debug
```

Sous Windows, utiliser le preset clang-cl/Ninja Multi-Config depuis le shell de
développement :

```powershell
cmake --preset windows
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Les tests et leurs exécutables auxiliaires sont optionnels. Configurer
explicitement pour les tests :

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug --no-tests=error
```

Sous Windows :

```powershell
cmake --preset windows -DBUILD_TESTING=ON
cmake --build --preset windows-debug
ctest --preset windows-debug --no-tests=error
cmake --build --preset windows-release
ctest --preset windows-release --no-tests=error
```

Les tests ont deux modes, choisis par `CLAUSE_TEST_MODE` :

- `fast` pour le développement : les corpus de référence (golden) exécutent deux
  combinaisons politique/pilote (O0 positionnel et O2 sans spécialisation via un
  projet) au lieu des huit, les cas de mutation s'exécutent une seule fois, et les
  tests étiquetés `full_only` (projets consommateurs CMake séparés et mesures de
  temps) sont exclus.
- `full` (la valeur par défaut si rien n'est défini) exécute toutes les
  combinaisons et tous les tests ; l'utiliser quand une fonctionnalité majeure
  est terminée.

```sh
ctest --preset debug-fast            # or windows-debug-fast; tests use half the logical CPUs
ctest --preset debug -j 32           # full mode; -j N runs N/2 tests at once
make test                            # fast; make test-full or TEST_MODE=full for full
```

`make-test.bat` suit les mêmes réglages `TEST_MODE` (par défaut `fast`) et
`TEST_JOBS` (par défaut tous les CPU logiques). Chaque test réserve deux
emplacements de processeur CTest (`PROCESSORS 2`), de sorte qu'un nombre
d'emplacements N exécute au plus N/2 tests simultanément, ce qui laisse de la
place aux compilateurs et aux compilations natives imbriquées que les tests
lancent. Sur un hôte Windows x64 à 32 threads, le mode rapide prend environ une
minute et le mode complet environ 85 secondes avec 16 jobs (729 secondes en
série).

Pour un répertoire de compilation sans preset, passer `-DBUILD_TESTING=ON` à
`cmake -S . -B <dir>` pour les tests. CMake met ce réglage en cache ; passer
`-DBUILD_TESTING=OFF` en réutilisant ce répertoire pour des compilations
ordinaires. Les presets normaux et les scripts d'enveloppe le fixent à `OFF`.

Les scripts batch reproduisent les cibles `build`, `format` et `clean` du
Makefile : `make-build.bat`, `make-test.bat`, `make-format.bat` et
`make-clean.bat`. Les scripts de compilation et de test configurent clang-cl avec
Ninja Multi-Config, comme le preset `windows`, en entrant eux-mêmes dans
l'environnement Visual Studio x64 quand le shell n'est pas un shell de
développement et en ajoutant `%ProgramFiles%\LLVM\bin` au `PATH` quand
`clang-cl` est absent. Un répertoire de compilation configuré avec un autre
générateur ou compilateur est reconfiguré à partir de zéro ; définir
`CLAUSE_TOOLCHAIN=default` pour garder le choix propre de CMake (par exemple
`cl` de MSVC dans un répertoire séparé). Les valeurs par défaut de compilation
sont `BUILD_DIR=build/debug`, `BUILD_TYPE=Debug` et le parallélisme de l'outil
de compilation natif (modifiable avec `JOBS=N`) ; les variables d'environnement
`CMAKE`, `CTEST`, `CMAKE_ARGS` et `CLANG_FORMAT` remplacent aussi les
outils/options correspondants. `make-test.bat` configure avec les tests activés,
compile toutes les cibles, puis lance CTest, comme `make test`, en propageant les
échecs de configuration, de compilation ou de test. Le nettoyage supprime les
répertoires `build/` et `cmake-build*/` locaux au dépôt.

Les contrôles de qualité et le formatage portent par défaut sur les fichiers
modifiés : tout ce qui diffère de `HEAD` dans l'arbre de travail, plus les
fichiers non suivis.

Les outils de qualité vivent dans l'environnement ignoré `.venv-quality/`,
épinglé par `tools/requirements-quality.txt` :
`python -m venv .venv-quality` puis `.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt`
(`.venv-quality/bin/python` hors de Windows).

- `cmake --build build/debug --target check-quality` exécute Lizard sur les
  fichiers C++ de production modifiés et clang-tidy sur les unités de traduction
  modifiées ainsi que celles qui incluent un en-tête modifié (d'après les
  dépendances enregistrées par Ninja). Les modifications de `.clang-tidy`, de
  `cmake/` ou des `CMakeLists.txt` de production, ou l'absence de données de
  dépendances, entraînent la vérification de toutes les unités de traduction.
  Définir `CLAUSE_QUALITY_BASE` (par exemple `origin/master`) pour comparer avec
  une autre base.
- `check-quality-all` (ainsi que `check-complexity-all`, `check-clang-tidy-all`)
  vérifient tous les fichiers.
- clang-tidy s'exécute par lots de `4 x jobs` unités de traduction et affiche
  une ligne passed/FAILED après chacun ; tous les lots s'exécutent, puis le
  contrôle échoue si l'un d'eux a échoué. Pour découper une longue exécution en
  invocations séparées plus courtes, appeler directement le script avec un
  fragment, par exemple
  `cmake -DQUALITY_SCOPE=all -DQUALITY_BUILD_DIR=build/debug -DQUALITY_SHARD=1/4 -P cmake/CheckClangTidy.cmake`
  pour le premier quart (`QUALITY_BATCH` et `QUALITY_JOBS` remplacent la taille
  des lots et le nombre de jobs ; par défaut, la moitié des cœurs logiques).
- `make format` / `make-format.bat` formatent les fichiers C++ modifiés ;
  `make format-all` ou `FORMAT_SCOPE=all make-format.bat` formatent tout.

`clau.bat --help` compile d'abord, puis transmet tous les arguments à
l'exécutable de la configuration choisie. Les échecs de compilation arrêtent
l'exécution ; les chemins d'entrée du compilateur restent relatifs au répertoire
de travail de l'appelant, et son code de sortie est préservé.

Pour développer le runtime sans télécharger ni utiliser le SDK C++ de LLVM,
configurer avec `cmake --preset windows -DCLAUSE_BUILD_COMPILER=OFF` ; les mêmes
presets de compilation/test s'appliquent. Remettre l'option à `ON` quand le SDK
est disponible. `cl` de MSVC est aussi accepté dans un répertoire de compilation
séparé ; MinGW n'est pas pris en charge pour les compilations de développement
Windows natives. Choisir x86 ou x64 via l'environnement de développement (ou
`-A` avec un générateur Visual Studio), et utiliser un SDK et un runtime LLVM de
cette architecture.

Le CRT par défaut sous Windows est `/MDd` en Debug et `/MD` pour les autres
configurations, y compris la bibliothèque statique du runtime et ses
consommateurs. Un réglage explicite `CMAKE_MSVC_RUNTIME_LIBRARY` est conservé ;
il doit correspondre au SDK LLVM et à toutes les bibliothèques C++ liées. Éviter
de mélanger des artefacts STL/CRT Debug et Release. Les sources du projet sous
Windows et les fixtures CLI/chemins utilisent UTF-8.

Toutes les cibles du projet utilisent C++23 et traitent les avertissements du
compilateur comme des erreurs. L'exécutable est `build/debug/bin/clau`. Les
presets de compilation et les scripts d'enveloppe demandent des compilations
parallèles sous Windows, Linux et macOS avec le nombre de jobs par défaut de
l'outil de compilation natif (`jobs: 0` dans les presets, `--parallel` dans les
scripts). Fixer une limite explicite avec
`cmake --build --preset debug --parallel 8` ou `JOBS=8` pour les scripts. Pour
un répertoire de compilation sans preset, utiliser
`cmake --build <dir> --parallel`. Le preset Windows place l'exécutable dans
`build/windows/bin/<Config>/clau.exe` et le runtime dans
`build/windows/lib/<Config>/clause_runtime.lib`.

Sinon, utiliser `make build` pour ne compiler que `clau` et ses dépendances, ou
`make test` pour compiler et exécuter toute la suite de tests. Pour une autre
configuration :

```sh
make test BUILD_DIR=build/release BUILD_TYPE=Release JOBS=4
```

CMake découvre les installations de Boost et d'Erlang, y compris celles de
Homebrew. Passer ces options lors de la configuration pour remplacer les valeurs
par défaut :

| Option                                      | Rôle                                                          |
|---------------------------------------------|---------------------------------------------------------------|
| `-DCLAUSE_BOOST_ROOT=/path/to/boost`    | Choisit une installation de Boost ou un arbre source complet |
| `-DCLAUSE_TOML_ROOT=/path/to/tomlplusplus-3.4.0` | Choisit la dépendance TOML épinglée |
| `-DCLAUSE_OTP_AUDITS=ON` | Active les audits optionnels en direct OTP/de référence ; OFF par défaut |
| `-DCLAUSE_ESCRIPT=/path/to/bin/escript` | Choisit OTP 29+ pour les audits optionnels ; inutilisé par les tests normaux |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Choisit un exécutable Clang installé sous Windows |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Choisit un SDK LLVM 23.1.x existant (les chemins explicites invalides échouent) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Exige un SDK installé ; désactive les téléchargements automatiques de LLVM |
| `-DBUILD_TESTING=ON`                        | Active les tests, les exécutables auxiliaires et leur dépendance à Erlang (par défaut : OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF`           | Compile seulement la bibliothèque du runtime                  |
| `-DCLAUSE_BUILD_RUNTIME=OFF`            | Compile seulement le compilateur                              |

Pour les générateurs multi-configurations, ajouter `--config Debug` à la
compilation et `-C Debug` aux tests. Les IDE compatibles CMake peuvent ouvrir le
dépôt avec le preset `debug`, ou le preset `windows` avec une chaîne d'outils de
développement Visual Studio.

Les en-têtes de Boost et de toml++ utilisent les inclusions `SYSTEM` de CMake,
ce qui conserve les avertissements comme erreurs pour le code du projet. Dans les
compilations macOS natives, CMake marque aussi comme `SYSTEM` le répertoire
d'inclusion lié de Homebrew quand ses en-têtes Boost correspondent à
l'installation choisie. Ainsi, des options héritées comme
`CXXFLAGS=-I/opt/homebrew/include` n'exposent pas les avertissements de Boost,
y compris quand cette option est déjà en cache dans CMake.
Pour les autres installations, éviter d'ajouter des chemins de dépendances via
des options `-I` globales (y compris `CXXFLAGS`) : un chemin d'inclusion
ordinaire peut avoir priorité sur le chemin système d'une dépendance. Si CLion
signale des avertissements de Boost comme erreurs, retirer ces options globales
et vider la valeur en cache, par exemple :

```sh
cmake -S . -B cmake-build-debug -DCMAKE_CXX_FLAGS:STRING=
```

Recharger ensuite CMake dans CLion. Utiliser les options de racine des
dépendances ci-dessus pour choisir les installations plutôt que d'ajouter des
options d'inclusion globales.
