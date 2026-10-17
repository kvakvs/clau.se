---
source: docs/building.md
sourceCommit: a8c3f8f6
sourceSha256: 94c0fac180752b278facfe18589c191a0a15ee95e55d9dbf7d4d049c4774e079
translatedAt: 2026-10-17
---
# Den Compiler bauen

Im Wurzelverzeichnis des Repositorys konfigurieren und bauen:

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

Wrapper (Überschreibungen per Umgebung: `BUILD_DIR`, `TOOL_BUILD_DIR`,
`BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`):

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

Konfigurationsoptionen:

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

Hinweise zu Windows: Die Standard-CRT ist `/MDd` (Debug) oder `/MD`; ein
explizites `CMAKE_MSVC_RUNTIME_LIBRARY` muss zum LLVM-SDK passen. MSVC `cl`
funktioniert in einem separaten Build-Verzeichnis; MinGW wird nicht unterstützt.
Projektziele behandeln Warnungen als Fehler und binden Abhängigkeiten als
`SYSTEM`-Header ein; daher keine Abhängigkeitspfade über globale `-I`-Flags wie
`CXXFLAGS` hinzufügen (in CLion einen gecachten Wert mit
`-DCMAKE_CXX_FLAGS:STRING=` leeren), sondern die oben genannten Optionen
verwenden.

## Tests

Tests werden beim Konfigurieren explizit aktiviert:

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
CTest-Slots, sodass `-j N` N/2 Tests gleichzeitig ausführt. Tests kompilieren
echte Erlang-Quellen über die CLI und vergleichen die ausführbaren Dateien mit
von OTP erzeugten Golden-Dateien; Baseline, Fixtures und Testdesign stehen unter
[Validierung](validation.md).

Qualitätsprüfung (Lizard und clang-tidy, Werkzeuge festgelegt in
`tools/requirements-quality.txt` und installiert in `.venv-quality/`; außerhalb
von Windows `.venv-quality/bin/python` verwenden):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` prüft Dateien, die sich seit `HEAD` (oder
`CLAUSE_QUALITY_BASE`) geändert haben, sowie Übersetzungseinheiten, die einen
geänderten Header einbinden, und benötigt einen Build mit aktiviertem Compiler
und aktivierter Runtime; `check-complexity-all` und `check-clang-tidy-all`
führen jeweils ein Werkzeug aus. `cmake/CheckClangTidy.cmake` akzeptiert
`QUALITY_SHARD=K/N`, um einen langen Lauf aufzuteilen.
