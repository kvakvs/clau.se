---
source: docs/building.md
sourceCommit: 06042fa
sourceSha256: de3570e747becc95b3596b8c17bf4d8bab1fa83db2aae32da918222afd413e6c
translatedAt: 2026-10-09
---
# Den Compiler bauen

Im Wurzelverzeichnis des Repositorys:

```sh
cmake --preset debug
cmake --build --preset debug
```

Unter Windows das clang-cl/Ninja-Multi-Config-Preset aus der Developer-Shell
verwenden:

```powershell
cmake --preset windows
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Tests und ihre Hilfsprogramme sind optional. Für Tests explizit konfigurieren:

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug --no-tests=error
```

Unter Windows:

```powershell
cmake --preset windows -DBUILD_TESTING=ON
cmake --build --preset windows-debug
ctest --preset windows-debug --no-tests=error
cmake --build --preset windows-release
ctest --preset windows-release --no-tests=error
```

Tests haben zwei Modi, ausgewählt über `CLAUSE_TEST_MODE`:

- `fast` für die Entwicklung: Golden-Korpora laufen mit zwei
  Policy/Treiber-Kombinationen (O0 positional und O2 ohne Spezialisierung über
  ein Projekt) statt allen acht, Mutationsfälle laufen einmal, und Tests mit dem
  Label `full_only` (separate CMake-Consumer-Projekte und Zeitmessungen) werden
  ausgeschlossen.
- `full` (Standard, wenn nicht gesetzt) führt jede Kombination und jeden Test
  aus; zu verwenden, wenn ein größeres Feature fertig ist.

```sh
ctest --preset debug-fast            # or windows-debug-fast; tests use half the logical CPUs
ctest --preset debug -j 32           # full mode; -j N runs N/2 tests at once
make test                            # fast; make test-full or TEST_MODE=full for full
```

`make-test.bat` folgt denselben Einstellungen `TEST_MODE` (Standard `fast`) und
`TEST_JOBS` (Standard: alle logischen CPUs). Jeder Test reserviert zwei
CTest-Prozessorslots (`PROCESSORS 2`), sodass eine Slotanzahl von N höchstens
N/2 Tests gleichzeitig ausführt und Raum für die Compiler und verschachtelten
nativen Builds lässt, die die Tests starten. Auf einem Windows-x64-Host mit
32 Threads dauert der schnelle Modus etwa eine Minute und der volle Modus etwa
85 Sekunden mit 16 Jobs (729 Sekunden seriell).

Für ein Build-Verzeichnis ohne Preset zum Testen `-DBUILD_TESTING=ON` an
`cmake -S . -B <dir>` übergeben. CMake speichert diese Einstellung im Cache;
`-DBUILD_TESTING=OFF` übergeben, wenn das Verzeichnis für gewöhnliche Builds
wiederverwendet wird. Die normalen Presets und Build-Wrapper setzen sie auf
`OFF`.

Die Batch-Skripte spiegeln die Makefile-Ziele `build`, `format` und `clean`:
`make-build.bat`, `make-test.bat`, `make-format.bat` und `make-clean.bat`. Die
Build- und Testskripte konfigurieren clang-cl mit Ninja Multi-Config wie das
Preset `windows`; sie betreten die Visual-Studio-x64-Umgebung selbst, wenn die
Shell keine Developer-Shell ist, und fügen `%ProgramFiles%\LLVM\bin` zu `PATH`
hinzu, wenn `clang-cl` fehlt. Ein Build-Verzeichnis, das mit einem anderen
Generator oder Compiler konfiguriert wurde, wird von Grund auf neu konfiguriert;
`CLAUSE_TOOLCHAIN=default` setzen, um die eigene Wahl von CMake beizubehalten
(zum Beispiel MSVC `cl` in einem separaten Verzeichnis). Build-Standards sind
`BUILD_DIR=build/debug`, `BUILD_TYPE=Debug` und die Parallelität des nativen
Build-Werkzeugs (überschreibbar mit `JOBS=N`); die Umgebungsvariablen
`CMAKE`, `CTEST`, `CMAKE_ARGS` und `CLANG_FORMAT` überschreiben ebenfalls die
entsprechenden Werkzeuge/Optionen.
`make-test.bat` konfiguriert mit aktivierten Tests, baut alle Ziele und führt
dann CTest aus, entsprechend `make test`, und gibt Fehler bei Konfiguration,
Build oder Tests weiter.
Clean entfernt die repository-lokalen Verzeichnisse `build/` und
`cmake-build*/`.

Qualitätsprüfungen und Formatierung gelten standardmäßig für geänderte Dateien:
alles, was sich im Arbeitsbaum von `HEAD` unterscheidet, plus nicht verfolgte
Dateien.

Die Qualitätswerkzeuge liegen in der ignorierten Umgebung `.venv-quality/`,
festgelegt durch `tools/requirements-quality.txt`:
`python -m venv .venv-quality` then `.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt`
(`.venv-quality/bin/python` außerhalb von Windows).

- `cmake --build build/debug --target check-quality` führt Lizard auf geänderten
  produktiven C++-Dateien aus und clang-tidy auf geänderten
  Übersetzungseinheiten sowie solchen, die einen geänderten Header einbinden
  (aus den von Ninja aufgezeichneten Abhängigkeiten). Änderungen an
  `.clang-tidy`, `cmake/` oder produktiven `CMakeLists.txt` oder fehlende
  Abhängigkeitsdaten prüfen jede Übersetzungseinheit.
  `CLAUSE_QUALITY_BASE` setzen (zum Beispiel `origin/master`), um mit einer
  anderen Basis zu vergleichen.
- `check-quality-all` (und `check-complexity-all`, `check-clang-tidy-all`)
  prüfen jede Datei.
- clang-tidy läuft in Batches von `4 x jobs` Übersetzungseinheiten und gibt nach
  jedem eine passed/FAILED-Zeile aus; jeder Batch läuft, danach schlägt die
  Prüfung fehl, wenn einer fehlgeschlagen ist. Um einen langen Lauf in kürzere
  separate Aufrufe aufzuteilen, das Skript direkt mit einem Shard aufrufen, zum
  Beispiel
  `cmake -DQUALITY_SCOPE=all -DQUALITY_BUILD_DIR=build/debug -DQUALITY_SHARD=1/4 -P cmake/CheckClangTidy.cmake`
  für das erste Viertel (`QUALITY_BATCH` und `QUALITY_JOBS` überschreiben
  Batch-Größe und Jobs; Jobs sind standardmäßig die Hälfte der logischen
  Kerne).
- `make format` / `make-format.bat` formatieren geänderte C++-Dateien;
  `make format-all` oder `FORMAT_SCOPE=all make-format.bat` formatiert alles.

`clau.bat --help` baut zuerst und reicht dann alle Argumente an die ausführbare
Datei der gewählten Konfiguration weiter. Build-Fehler stoppen die Ausführung;
Eingabepfade des Compilers bleiben relativ zum Arbeitsverzeichnis des Aufrufers,
und sein Exit-Code bleibt erhalten.

Für die Runtime-Entwicklung ohne Herunterladen oder Verwenden des LLVM-C++-SDK
mit `cmake --preset windows -DCLAUSE_BUILD_COMPILER=OFF` konfigurieren; es
gelten dieselben Build-/Test-Presets. Die Option wieder auf `ON` setzen, sobald
das SDK verfügbar ist. MSVC `cl` wird in einem separaten Build-Verzeichnis
ebenfalls akzeptiert; MinGW wird für native Windows-Entwicklungs-Builds nicht
unterstützt. x86 oder x64 über die Developer-Umgebung auswählen (oder mit `-A`
bei einem Visual-Studio-Generator) und ein LLVM-SDK und eine Runtime dieser
Architektur verwenden.

Die Standard-CRT unter Windows ist `/MDd` für Debug und `/MD` für andere
Konfigurationen, einschließlich der statischen Runtime-Bibliothek und ihrer
Nutzer. Eine explizite Einstellung `CMAKE_MSVC_RUNTIME_LIBRARY` bleibt erhalten;
sie muss zum LLVM-SDK und allen gelinkten C++-Bibliotheken passen. Das Mischen
von Debug- und Release-STL/CRT-Artefakten vermeiden.
Windows-Projektquellen und CLI-/Pfad-Fixtures verwenden UTF-8.

Alle Projektziele verwenden C++23 und behandeln Compiler-Warnungen als Fehler.
Die ausführbare Datei ist `build/debug/bin/clau`. Build-Presets und Wrapper
fordern parallele Builds unter Windows, Linux und macOS mit der
Standard-Jobanzahl des nativen Build-Werkzeugs an (`jobs: 0` in Presets,
`--parallel` in Wrappern). Eine explizite Grenze mit
`cmake --build --preset debug --parallel 8` oder `JOBS=8` für die Wrapper
setzen. Für ein Build-Verzeichnis ohne Preset `cmake --build <dir> --parallel`
verwenden.
Das Windows-Preset legt die ausführbare Datei in
`build/windows/bin/<Config>/clau.exe` und die Runtime in
`build/windows/lib/<Config>/clause_runtime.lib` ab.

Alternativ baut `make build` nur `clau` und seine Abhängigkeiten, und
`make test` baut und führt die vollständige Testsuite aus. Für eine andere
Konfiguration:

```sh
make test BUILD_DIR=build/release BUILD_TYPE=Release JOBS=4
```

CMake findet installierte Boost- und Erlang-Versionen, einschließlich
Homebrew-Installationen. Diese Optionen beim Konfigurieren übergeben, um
Standards zu überschreiben:

| Option                                      | Zweck                                                         |
|---------------------------------------------|---------------------------------------------------------------|
| `-DCLAUSE_BOOST_ROOT=/path/to/boost`    | Eine Boost-Installation oder einen vollständigen Quellbaum auswählen |
| `-DCLAUSE_TOML_ROOT=/path/to/tomlplusplus-3.4.0` | Die festgelegte TOML-Abhängigkeit auswählen |
| `-DCLAUSE_OTP_AUDITS=ON` | Optionale Live-Audits gegen OTP/Referenz aktivieren; Standard ist OFF |
| `-DCLAUSE_ESCRIPT=/path/to/bin/escript` | OTP 29+ für optionale Audits auswählen; von normalen Tests nicht verwendet |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Eine installierte Clang-Programmdatei unter Windows auswählen |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Ein vorhandenes LLVM-23.1.x-SDK auswählen (ungültige explizite Pfade schlagen fehl) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Ein installiertes SDK verlangen; automatische LLVM-Downloads deaktivieren |
| `-DBUILD_TESTING=ON`                        | Tests, Hilfsprogramme und deren Erlang-Abhängigkeit aktivieren (Standard: OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF`           | Nur die Runtime-Bibliothek bauen                              |
| `-DCLAUSE_BUILD_RUNTIME=OFF`            | Nur den Compiler bauen                                        |

Bei Multi-Konfigurations-Generatoren beim Bauen `--config Debug` und beim
Testen `-C Debug` hinzufügen. CMake-fähige IDEs können das Repository mit dem
Preset `debug` öffnen oder mit dem Preset `windows` und einer
Visual-Studio-Entwicklungstoolchain.

Boost- und toml++-Header verwenden CMake-`SYSTEM`-Includes, sodass Warnungen für
Projektcode weiterhin als Fehler gelten. Bei nativen macOS-Builds markiert CMake
außerdem das verlinkte Include-Verzeichnis von Homebrew als `SYSTEM`, wenn
dessen Boost-Header zur gewählten Installation auflösen.
So legen geerbte Flags wie `CXXFLAGS=-I/opt/homebrew/include` keine
Boost-Warnungen offen, auch wenn dieses Flag bereits von CMake gecacht ist.
Bei anderen Installationen keine Abhängigkeitspfade über globale `-I`-Flags
hinzufügen (auch nicht über `CXXFLAGS`): Ein gewöhnlicher Include-Pfad kann
Vorrang vor dem Systempfad einer Abhängigkeit haben. Meldet CLion
Boost-Warnungen als Fehler, diese globalen Flags entfernen und den
gecachten Wert leeren, zum Beispiel:

```sh
cmake -S . -B cmake-build-debug -DCMAKE_CXX_FLAGS:STRING=
```

Danach CMake in CLion neu laden. Zur Auswahl von Installationen die oben
genannten Optionen für Abhängigkeitswurzeln verwenden, statt globale
Include-Flags hinzuzufügen.
