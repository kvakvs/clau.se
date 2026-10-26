---
source: docs/building.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b5b9cdbb0544c714f847eac4931ed0fa38d8de1144153349efac4c2302159cbc
translatedAt: 2026-10-26
---
# Clause bauen

Wie `clau` und `clause_runtime` gebaut werden, der Build konfiguriert wird,
die Tests ausgeführt und die Entwicklerwerkzeuge verwendet werden. Testdesign
und Ergebnisse stehen unter [Validierung](validation.md).

## Voraussetzungen

- CMake 3.28+ und ein C++23-Compiler; unter Windows die Workload
  **Desktopentwicklung mit C++** von Visual Studio mit einem Windows SDK,
  Ninja und einer globalen LLVM/Clang-Installation (`clang-cl` und `clang`
  zum Linken von Programmen).
- LLVM-23.1.x-C++-SDK (23.1.1 oder neuer) für den Compiler. Eine globale
  Installation wird bevorzugt; andernfalls lädt CMake das festgelegte SDK
  23.1.2 unter Windows x64/ARM64, Linux x64/ARM64 und macOS ARM64 nach
  `thirdparty/` herunter ([LLVM-SDK](compile.md#llvm-sdk)). Die
  LLVM-Kommandozeilenwerkzeuge allein enthalten das SDK nicht.
- Boost 1.90+ (Multiprecision, Asio und Parser für den Compiler; nur Header),
  toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 und zlib 1.3.2. CMake lädt
  fehlende Abhängigkeiten mit SHA-256-Prüfungen nach `thirdparty/` herunter
  und verwendet sie offline erneut, auch für neue Build-Verzeichnisse;
  unter Linux und macOS stammen Boost und toml++ aus einer Installation oder
  `thirdparty/` ([Build-Abhängigkeit](projects.md#build-dependency)).
- Python 3 für Tests sowie die Qualitäts-, Benchmark- und Listing-Werkzeuge.
- Erlang/OTP wird zum Bauen oder Testen nicht benötigt. Tests verwenden
  [projekteigene Golden-Fixtures](../tests/fixtures/patternmatch/generated/README.md);
  nur Parse-Transformationen, optionale Live-Audits, die Neuerzeugung von
  Fixtures und Benchmarks benötigen eine Installation von OTP 29.

Unter macOS (Erlang optional):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```

## Konfigurieren und bauen

```sh
cmake --preset debug                    # build/debug, single configuration
cmake --build --preset debug
```

Unter Windows aus einer x64-Developer-Shell mit `clang-cl` und `ninja` im
`PATH`:

```powershell
cmake --preset windows                  # build/windows, Ninja Multi-Config
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Das Preset `debug` legt `clau` in `build/debug/bin` ab, das Preset `windows` in
`build/windows/bin/<Config>/clau.exe`, mit der Runtime in
`build/windows/lib/<Config>/clause_runtime.lib`. `clau` findet das
Runtime-Archiv und die Module in `library/` relativ zum eigenen Speicherort.

## Wrapper

Überschreibungen per Umgebung: `BUILD_DIR`, `TOOL_BUILD_DIR`, `BUILD_TYPE`,
`JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`.

| Makefile | Windows | Wirkung |
| --- | --- | --- |
| `make build` | `make-build.bat` | `clau` in `build/tool` ohne Tests bauen (das Batch-Skript baut Release und auch die Runtime) |
| `make test`, `make test-full` | `make-test.bat` | `build/debug` mit Tests konfigurieren, alles bauen, CTest ausführen |
| `make format`, `make format-all` | `make-format.bat` | Geänderte (oder mit `FORMAT_SCOPE=all` alle) C++-Dateien mit clang-format formatieren |
| `make benchmark` | `make-benchmark.bat` | Release-Build in `build/bench`, dann Vergleich mit dem OTP des Hosts |
| `make clean` | `make-clean.bat` | `build/` und `cmake-build*/` entfernen |

Die Batch-Skripte betreten bei Bedarf selbst die Visual-Studio-x64-Umgebung,
fügen `%ProgramFiles%\LLVM\bin` zu `PATH` hinzu, wenn `clang-cl` fehlt, und
konfigurieren ein Build-Verzeichnis neu, das mit einem anderen Generator oder
Compiler erstellt wurde; `CLAUSE_TOOLCHAIN=default` setzen, um die eigene Wahl
von CMake beizubehalten. `clau.bat` (Windows) und `run-macos.sh` bauen zuerst
`build/tool` und führen dann `clau` mit allen Argumenten aus, wobei
Arbeitsverzeichnis und Exit-Code des Aufrufers erhalten bleiben.

## Konfigurationsoptionen

| Option | Zweck |
| --- | --- |
| `-DBUILD_TESTING=ON` | Tests und ihre Hilfsprogramme bauen (Standard OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF` | Nur die LLVM-freie Runtime-Bibliothek bauen |
| `-DCLAUSE_BUILD_RUNTIME=OFF` | Nur den Compiler bauen |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Ein LLVM-23.1.x-SDK auswählen (ein ungültiger expliziter Pfad schlägt fehl) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Ein installiertes SDK verlangen |
| `-DCLAUSE_BOOST_ROOT=...`, `-DCLAUSE_TOML_ROOT=...`, `-DCLAUSE_SQLITE_ROOT=...`, `-DCLAUSE_PCRE2_ROOT=...` | Quelle oder Installation einer Abhängigkeit auswählen (Offline-Einrichtung) |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Die Clang-Programmdatei unter Windows auswählen |
| `-DCLAUSE_OTP_AUDITS=ON`, `-DCLAUSE_ESCRIPT=/path/to/escript` | Optionale Live-Audits gegen OTP aktivieren und das verwendete OTP 29 auswählen |
| `-DCLAUSE_TEST_DEBUG_INFO=ON` | Testprogramme mit Debug-Informationen bauen (um einen Absturz zu debuggen) |
| `-DCLAUSE_OPTIMIZED_COMPILER=OFF` | `clau` und die Compiler-Bibliotheken in Debug ohne Optimierung bauen (um einen Absturz von `clau` zu debuggen) |

Hinweise zu Windows: Die Standard-CRT ist `/MDd` (Debug) oder `/MD`; ein
explizites `CMAKE_MSVC_RUNTIME_LIBRARY` muss zum LLVM-SDK passen. MSVC `cl`
funktioniert in einem separaten Build-Verzeichnis; MinGW wird nicht unterstützt.
Projektziele behandeln Warnungen als Fehler und binden Abhängigkeiten als
`SYSTEM`-Header ein; daher keine Abhängigkeitspfade über globale `-I`-Flags wie
`CXXFLAGS` hinzufügen (in CLion einen gecachten Wert mit
`-DCMAKE_CXX_FLAGS:STRING=` leeren), sondern die oben genannten Optionen
verwenden.

## Tests

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug-fast                # or windows-debug-fast
ctest --preset debug -j 16               # full mode
```

`CLAUSE_TEST_MODE=fast` (die Presets `*-fast`, `make test`, `make-test.bat`)
führt eine reduzierte Matrix aus Optimierungsstufen und Treibern aus und
überspringt `full_only`-Tests; `full` (Standard, wenn nicht gesetzt,
`make test-full`, `TEST_MODE=full`) führt alles aus. Jeder Test reserviert zwei
CTest-Slots, sodass `-j N` N/2 Tests gleichzeitig ausführt.

## Qualitätsprüfung

Lizard und clang-tidy, festgelegt in `tools/requirements-quality.txt` und
installiert in `.venv-quality/` (außerhalb von Windows
`.venv-quality/bin/python` verwenden):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` prüft Dateien, die sich seit `HEAD` (oder
`CLAUSE_QUALITY_BASE`) geändert haben, sowie eine Übersetzungseinheit pro
geändertem Header (`check-quality-all` erfasst alle abhängigen Einheiten),
und benötigt einen Build mit aktiviertem Compiler und aktivierter Runtime; `check-complexity-all` und `check-clang-tidy-all`
führen jeweils ein Werkzeug aus. `cmake/CheckClangTidy.cmake` akzeptiert
`QUALITY_SHARD=K/N`, um einen langen Lauf aufzuteilen.

## Benchmarks und Listings

`make benchmark` / `make-benchmark.bat` bauen ein Release-`clau` in
`build/bench` und vergleichen die Programme `benchmarks/bench_*.erl` mit dem
OTP des Hosts und einem älteren Clause-Commit; `benchmarks/run.py --help`
listet die Optionen auf ([Benchmarks](validation.md#benchmarks)). Sie sind
nie Teil der Tests.

`benchmarks/compile_times.py` misst `clau` selbst: Es führt eine
Kompilierungsaufgabe (`--workload W1` oder `clau`-Argumente nach `--`)
mehrmals auf den Leistungskernen mit `--no-cache --print-stage-times` aus und
meldet Median, Minimum und Streuung jeder Phase und jedes Inferenzdurchlaufs,
die langsamsten Inferenzkomponenten sowie die Übereinstimmung der
Durchlaufzähler und der Standardausgabe zwischen den Läufen. Mit
`--baseline <clau.exe>` wechseln sich die beiden Builds ab, und die
Zusammenfassung zeigt ihr Verhältnis. Während Builds, Tests oder ein anderes
`clau` laufen, verweigert es die Messung, sofern nicht `--force-noisy`
angegeben wird, und schreibt JSON nach `build/bench/compile-times/`.

`decompile-debug.bat <module>` und `decompile-release.bat <module>` schreiben
den Debug- oder Release-Assemblercode einer Clause-C++-Quelldatei nach
`<module>.debug.asm` / `<module>.release.asm`, mit Quelltextzeilen und
dekodierten Namen (`tools/asm.py`, clang-cl-Builds; `--function TEXT` filtert).
