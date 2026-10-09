---
source: docs/validation.md
sourceCommit: 06042fa
sourceSha256: ed256a9f28346170cd141eff3a0d84d3dcaad4d06bbf853414738bd11cb36bd5
translatedAt: 2026-10-09
---
# Validierung

## Aktuelle Basislinie

Plan 11 step 1, 2026-10-03, Commit `b1a471f`, Windows x64: clang-cl 23.1.2,
LLVM SDK 23.1.2 (`/MT`, `_ITERATOR_DEBUG_LEVEL=0`), Lizard 1.24.0, clang-tidy
22.1.8, OTP-Pin `21776803ecd1` mit Orakel OTP 29.1.1 / ERTS 17.1.

| Prüfung | Ergebnis |
| --- | --- |
| Frischer kombinierter Debug-CTest | 125/125, keine Auslassungen (729 s seriell; 85 s mit `-j 16`) |
| CTest im Schnellmodus (`debug-fast`) | 122 Tests, etwa 60 s |
| `check-quality` | Bestanden; Lizard CCN 10, clang-tidy über 258 Produktionseinheiten |
| Optionale OTP-Audit-Tests | 14/14 |
| `regenerate.py --corpus all --check` | 19/19 Korpora reproduzierbar |
| Fremde O0/O2-Objekte | 7 Ziele untersucht (Linux x86/x64/ARM/AArch64, Windows x86/x64, Apple Silicon) |

## Ausführen der Prüfstufe

Aus einer x64-Entwickler-Shell von Visual Studio mit `C:\Program Files\LLVM\bin`
im `PATH` (die automatische SDK-Auswahl verwendet `thirdparty/` wieder):

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files + dependents
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` führt Golden-Korpora bei O0 positionell plus O2 als
  Projekt ohne Spezialisierung aus, führt Mutationen einmal aus und überspringt
  `full_only`-Tests. Der Vollmodus (Standard) führt alle
  Treiber-/Richtlinienkombinationen aus.
- `check-quality`, `make format` und `make-format.bat` erfassen die seit `HEAD`
  geänderten Dateien plus nicht versionierte Dateien; `cmake/quality_scope.py`
  fügt Übersetzungseinheiten hinzu, die einen geänderten Header einbinden.
  Änderungen an `.clang-tidy`, `cmake/` oder am Produktions-CMake wählen alles
  aus.
- Testprogramme enthalten keine Debuginformationen (keine PDBs); mit
  `-DCLAUSE_TEST_DEBUG_INFO=ON` konfigurieren, um sie für einen Debugger neu zu
  bauen. Verschachtelte native Konsumenten linken die Runtime des
  übergeordneten Builds über `ClauseRuntimeTargets.cmake`, statt sie erneut zu
  kompilieren; nur `runtime_link` baut die Runtime eigenständig.
- Schwellenwerte und Unterdrückungen werden nie angehoben, um die Prüfstufe zu
  bestehen.

## Fixtures und Herkunft

- Normale Builds und Tests brauchen weder OTP noch seinen Quelltext-Checkout.
  Goldens wurden einmalig aus OTP erzeugt und sind mit Hashes eingecheckt;
  Hash-Prüfungen laufen, bevor ein Fixture verwendet wird.
- Neunzehn Muster-/Guard-Korpora enthalten 67.748 native erwartete
  Werte/Fehler und 106 semantische Akzeptanzzeilen. Jeder native Korpus führt
  positionelle und Projekttreiber bei O0/O2 mit Spezialisierung an/aus, lokale
  und Remote-Aufrufe aus.
- Eingecheckte Erlang-Eingaben sind lokal verfasst
  (`tests/fixtures/patternmatch/fragments/`, Präprozessor
  `semantic/headers/`). Ein Audit vom 2026-10-03 entfernte alle kopierten
  OTP-Dateien; ein Vergleich mit einem 60-Token-Fenster gegen 4.150
  Erlang-Dateien und 1.190 C/C++-Dateien von OTP fand außer einem erzeugten
  Ganzzahltupel keine verbleibende Überschneidung. `fixture_sources` erzwingt
  die Isolation.
- Sechs Programm-Fixtures für das Endziel (`tests/fixtures/programs/`, plan 11
  step 2) enthalten OTP-Goldens für stdout/Exit-Status und die heutigen
  Kompilierdiagnosen; `programs_compile` prüft sie ohne OTP, und
  `tests/compiler/programs/regenerate.py --check` reproduziert sie unter OTP
  ([Fixture-Übersicht](../tests/fixtures/programs/README.md)).
- Goldens zur Termausgabe (`tests/fixtures/printing/`, plan 11 step 4)
  enthalten OTP-Text von `~w` und `erlang:display/1` für 9.542 Werte plus die
  OTP-stdout kompilierter display-Aufrufe;
  `tests/compiler/printing/regenerate.py --check` reproduziert sie
  ([Fixture-Notizen](../tests/fixtures/printing/README.md)).
- Golden-Fälle für ausführbare Dateien (`tests/fixtures/executables/`, plan 11
  step 8) sind Quelltextverzeichnisse plus eine `golden.json` mit OTP-stdout/
  Exit-Status und einem selbst verfassten stderr-Muster;
  `tests/compiler/executables/run.py` linkt und führt jeden unter der
  Richtlinien-/Treibermatrix aus (CTest `executables_<case>`), und
  `regenerate.py --check` reproduziert sie unter OTP
  ([Fallnotizen](../tests/fixtures/executables/README.md)).
- Regenerierung und Live-Audits sind explizit:
  `-DCLAUSE_OTP_AUDITS=ON` und `tests/compiler/patternmatch/regenerate.py`
  ([Anleitung](../tests/fixtures/patternmatch/generated/README.md)). Nichts
  aktualisiert Goldens oder den Pin stillschweigend.

## Testdesign

Verhalten wird über die echte CLI, erzeugte Objekte, gelinkte native
Konsumenten und OTP-Goldens getestet. Gezielte Unit-Tests bleiben nur dort, wo
Quelltext den Zustand nicht erreichen kann, jeweils mit im Test angegebenem
Zweck:

- Eingespeiste Budgets und Allokations-/IO-Fehler (`project_limits`,
  `project_creation_failure`, `codegen_limits`, `codegen_write_failure`,
  `runtime_lifecycle_failure`, Fehlernähte erzeugter Aufrufe).
- Invarianten zu privatem Besitz, ungültigen/veralteten Handles und Rollback
  im Parser, im semantischen Typgraphen und im Backend.
- Validierung roher Wörter und 32/64-Bit-Termgrenzen (`runtime_immediate`,
  `runtime_term_tag`, `abi_integers`).
- Fehlschläge der Diagnosesenke und der stabile Snapshot der Feature-IDs.

Fälle zu Dateisystemfähigkeiten (Links, Groß-/Kleinschreibungs-Aliase) melden
Auslassungen pro Fall; sie stehen nie für das Bestehen eines ganzen Tests.

## Plattform- und Sanitizer-Status

- Native Ausführung erzeugten Codes: nur Windows x64.
- Linux, Apple Silicon und native 32-Bit-Ausführung: ausstehend (Objekte werden
  nur untersucht).
- ASan, UBSan und LeakSanitizer für Compiler/Frontend: ausstehend. Das
  vorgebaute Windows-LLVM-SDK kollidiert mit instrumentiertem Code
  (`annotate_string` 0 gegenüber 1; früher auch doppelte
  rpmalloc-/ASan-Allokatorsymbole). Keine Prüfung wurde deaktiviert, um das zu
  umgehen.
- ASan nur für die Runtime besteht unter Windows mit Release-Proben,
  `/EHsc /fsanitize=address`, `/MT`, Clangs ASan-Importbibliothek und statischem
  Runtime-Thunk sowie der ASan-DLL im `PATH`.
- Historische macOS-arm64-Läufe (2026-09-19/20) bestanden vollständige
  Debug-, C++26-, ASan+UBSan-, Nur-Compiler- und Nur-Runtime-Builds für die
  Parser- und Projektstufen; sie liegen vor dem Backend.

## Verlauf

Verdichtet aus den früheren schrittweisen Aufzeichnungen (Originale in der
Git-Historie bis Commit `2777c98`). Sofern nicht anders angegeben: Windows x64,
LLVM 23.1.2, Pin `21776803ecd1`, Orakel OTP 29.1.1 / ERTS 17.1. Testzahlen sind
vollständige CTest-Durchläufe ohne Auslassungen.

| Datum | Meilenstein | Tests | Qualitätseinheiten | Anmerkungen |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Parser phase VI (macOS arm64, OTP 29.1 `751f87b7`, Orakel 29.0.5) | 46 | vollständig | 344/344 Produktionen belegt; Korpus aus 10 Dateien |
| 2026-09-20 | Projekte (macOS arm64) | 64 | vollständig | Debug, Nur-Compiler, ASan+UBSan |
| 2026-09-28 | Testmigration auf CLI-Abläufe | 74/75 | — | Basislinie 78/93; Stack-Überlauf in `parser_hardening` später mit 8-MiB-Stack behoben |
| 2026-09-28 | Reparatur der Windows-Prüfstufe | 75 | vollständig | Lizard + clang-tidy sauber |
| 2026-09-29 | Compiler-Meilenstein steps 1–46 | 103 | 182 | Nur-Compiler 80, Nur-Runtime 16, Runtime-ASan 16 |
| 2026-10-01 | PG1 semantische Matrix und Nachweise | 104 | — | Quelltext-Hashes festgelegt |
| 2026-10-01 | PG2 Fehlerkanal | 108 | — | ABI rev 2 |
| 2026-10-01 | PG3 Atome | 109 | 189 | ABI rev 3 |
| 2026-10-01 | PG4 Bindungen mit Gültigkeitsbereich | 111 | 191 | 26 Zulässigkeitsfälle |
| 2026-10-02 | PG5 Mustersemantik | 113 | 196 | 92 Zulässigkeitsmodule |
| 2026-10-02 | PG6 Matching von Immediates | 114 | 199 | 34 Aufrufe |
| 2026-10-02 | PG7 Guards auf Immediates | 119 | 205 | 1.689 Aufrufe |
| 2026-10-02 | PG8 Kontrollfluss in Guards | 120 | 207 | 2.075 Aufrufe |
| 2026-10-02 | PG9 geordnete Klauseln | 121 | 208 | 1.020 Aufrufe |
| 2026-10-02 | PG10 Matches im Rumpf | 122 | 209 | 1.666 Aufrufe |
| 2026-10-02 | PG11 stabiler Heap und Wurzeln | 123 | 213 | ABI rev 4 |
| 2026-10-02 | PG12 Tupel/Listen/Strings | 125 | 221 | 4.801 Aufrufe |
| 2026-10-02 | PG13 beliebig große Ganzzahlen | 127 | 231 | 16.065 Aufrufe |
| 2026-10-02 | PG14 Gleitkommazahlen | 129 | 238 | 14.436 Aufrufe |
| 2026-10-02 | PG15 Maps | 131 | 244 | 8.010 Aufrufe |
| 2026-10-02 | PG15a OTP-freie Goldens | 118 | 244 | 14 Korpora, 49.959 Werte; Audits optional |
| 2026-10-02 | PG16 bitstrings | 120 | 253 | 8.826 Aufrufe |
| 2026-10-03 | PG17 Tupel-records | 121 | 257 | 1.025 Ergebnisse, 29 semantische Fälle |
| 2026-10-03 | PG18 Guard-Katalog | 122 | 257 | 81 Zeilen, 5.033 Ergebnisse |
| 2026-10-03 | PG19 Bindungsfakten | 123 | 258 | 822 Ergebnisse, 976 Dominanzprüfungen |
| 2026-10-03 | PG20 Abschluss | 124 | 258 | 19 Korpora, 67.634 Werte, 1.969 vorgegebene Ergebnisse |
| 2026-10-03 | OTP-Quelltext-Audit | 125 | 258 | Kopierte OTP-Dateien durch lokale Fragmente ersetzt |
| 2026-10-03 | Basislinie Plan 11 step 1 | 125 | 258 | Siehe aktuelle Basislinie |
| 2026-10-03 | Plan 11 step 2 Programm-Fixtures | 126 | 258 | Sechs OTP-Goldens; Schnellmodus 123 Tests; vollständig `-j 16` 83 s |
| 2026-10-03 | Plan 11 step 4 Termausgabe | 128 schnell | 265 | 9.542 Goldens für `~w`/display; 154 kompilierte display-Aufrufe unter allen Richtlinien; clang-tidy mit einem Job ausgeführt (gleichzeitige Läufe brachten das Werkzeug bei unveränderten Einheiten zum Absturz) |
| 2026-10-04 | Plan 11 step 8 Runner für ausführbare Dateien (phase B abgeschlossen) | 138 (135 schnell) | 272 | Fälle `demo`, `exits` unter acht Richtlinien-/Treiberkombinationen; vollständig `-j 16` 235 s |
| 2026-10-04 | Plan 11 step 8I klassischer Heap (phase C abgeschlossen) | 144 (140 schnell) | 276 | Vollständig `-j 16` 370 s: 143/144, `codegen_dependency` lief unter Last nach 120 s in ein Timeout und bestand allein in 29 s; Lizard-all 0 Warnungen; tidy-all bestand mit einem Job nach einem stillen Abbruch mit zwei Jobs |
| 2026-10-04 | Plan 11 step 9 `case` und `begin` | 146 (142 schnell) | 114 geändert | Schnell 142/142; betroffene Tests 7/7 im Vollmodus; Lizard 0 Warnungen; tidy bestand mit einem Job nach einem stillen Abbruch mit zwei Jobs |
| 2026-10-05 | Plan 11 step 10 `if` | 147 (143 schnell) | 114 geändert | Schnell 143/143; betroffene Tests 8/8 im Vollmodus; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 11 Auslösen im Quelltext | 148 (144 schnell) | 124 geändert | Schnell 144/144; betroffene Tests 22/22 im Vollmodus; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 12 `catch Expr` | 149 (145 schnell) | 277 | Schnell 145/145; betroffene Tests 25/25 im Vollmodus; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 13 `try ... of ... catch` | 150 (146 schnell) | 189 geändert | Schnell 146/146; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 14 `try ... after` | 153 (149 schnell) | 2 geändert | Schnell 149/149; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 15 Stacktraces und `raise/3` | 154 (150 schnell) | 129 geändert | Schnell 150/150; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 16 `maybe` (phase D abgeschlossen) | 155 (151 schnell) | 277 | Schnell 151/151; vollständig `-j 16` 155/155 in 259 s; Lizard-all 0 Warnungen; tidy-all bestanden |
| 2026-10-05 | Plan 11 step 18 rekursive Aufrufgraphen | 156 (152 schnell) | 91 geändert | Schnell 152/152; betroffene Tests 13/13 im Vollmodus; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 19 explizite Frames und Endaufrufe | 157 (153 schnell) | 278 | Schneller und vollständiger CTest bestanden (mit dem Fall aus step 20: 154/154, 158/158); Konfiguration mit clang-cl; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-05 | Plan 11 step 20 tiefe Rumpfrekursion und Stack-Budget | 158 (154 schnell) | 278 | Schnell 154/154; vollständig 158/158; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 21 List-comprehensions | 159 (155 schnell) | geändert | Schnell 155/155; betroffene Tests im Vollmodus; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 22 Binary- und Map-comprehensions (phase E abgeschlossen) | 160 (156 schnell) | alle | Schnell 156/156; vollständig `-j 12` 160/160 in 275 s; Lizard-all 0 Warnungen; tidy-all bestanden nach Behebung von vier Befunden in neuem Code |
| 2026-10-06 | Plan 11 step 23 Wurzelinventar, `SafePoint`, lebende Register | 160 (156 schnell) | 50 geändert | Schnell 156/156; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 26 Bereinigung aus erzeugtem Code | 161 (157 schnell) | 63 geändert | Schnell 157/157; vollständig `-j 12` 161/161 in 107 s; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 27 Heap-Erschöpfung nach Bereinigung | 162 (158 schnell) | 50 geändert | Schnell 158/158; vollständig `-j 12` 162/162 in 108 s; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 27 Korrektur: keine standardmäßigen Speicherobergrenzen | 162 (158 schnell) | 50 geändert | Vollständig `-j 12` 158/162 in 120 s, 4 `codegen_failure_*` behoben, indem `out_of_memory` erwartet wird, danach 10/10 betroffene; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 27 Nacharbeit: keine Obergrenzen für binaries oder Prozessanzahl, `--max-atoms` | 164 (160 schnell) | 281 | Schnell 160/160; vollständig `-j 12` 164/164 in 105 s; Lizard 0 Warnungen; tidy-all bestanden |
| 2026-10-06 | Plan 11 step 28 Graphkopien zwischen Heaps, geteilte Off-Heap-Puffer | 166 (162 schnell) | 71 geändert | Schnell 162/162; vollständig `-j 12` 166/166 in 130 s; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-07 | Plan 11 step 29 record-Updates | 167 (163 schnell) | 38 geändert | Schnell 163/163; Lizard 0 Warnungen; tidy bestanden; records-Korpus reproduzierbar unter OTP |
| 2026-10-07 | Plan 11 step 30 `record_info/2` | 168 (164 schnell) | 42 geändert | Schnell 164/164; vollständig `-j 12` 168/168 in 119 s; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-07 | Plan 11 step 31B Zellen für native records und `CLAUSE_record_v1` (ABI 6) | 169 (165 schnell) | 283 geändert | Schnell 165/165; vollständig `-j 12` 169/169 in 122 s; Lizard 0 Warnungen; tidy bestanden nach zwei Korrekturen |
| 2026-10-07 | Plan 11 step 31C lokale native records | 170 (166 schnell) | 285 geändert | Schnell 166/166; vollständig `-j 12` 170/170 in 146 s; Lizard und tidy bestanden nach Komplexitätskorrekturen |
| 2026-10-07 | Plan 11 step 31D qualifizierte und importierte native records | 171 (167 schnell) | 124 geändert | Schnell 167/167; vollständig `-j 12` 171/171 in 129 s; Lizard 0 Warnungen; tidy bestanden nach drei Korrekturen |
| 2026-10-07 | Plan 11 step 31E anonyme native records (step 31 abgeschlossen) | 172 (168 schnell) | 33 geändert | Schnell 168/168; vollständig `-j 12` 172/172 in 124 s; Lizard 0 Warnungen; tidy bestanden nach einer Korrektur |
| 2026-10-07 | Plan 11 step 32 Funktionswerte `fun F/A`, `fun M:F/A` (ABI 7) | 173 (169 schnell) | 289 geändert | Schnell 169/169; vollständig `-j 12` 173/173 in 122 s; Lizard und tidy bestanden nach Komplexitätskorrekturen |
| 2026-10-07 | Plan 11 step 33 Closures mit erfassten Variablen | 175 (171 schnell) | 134 geändert | Schnell 171/171; vollständig `-j 12` 175/175 in 126 s; Lizard und tidy bestanden nach Komplexitätskorrekturen |
| 2026-10-07 | Plan 11 step 34 benannte funs | 176 (172 schnell) | 132 geändert | Schnell 172/172; vollständig `-j 12` 176/176 in 152 s; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-07 | Plan 11 step 35 dynamische Aufrufe `M:F(Args)`, `apply/2,3`, `fun M:F/A` zur Laufzeit (ABI 8) | 177 (173 schnell) | 290 (Analysator-Konfiguration geändert) | Schnell 173/173; vollständig `-j 12` 177/177 in 142 s; Lizard 0 Warnungen und tidy bestanden nach einer Komplexitäts- und drei tidy-Korrekturen |
| 2026-10-06 | Plan 11 step 27E Bignum-Grenze von ERTS, `error:system_limit` | 165 (161 schnell) | 157 geändert | Schnell 161/161; vollständig `-j 12` 165/165 in 130 s; Lizard 0 Warnungen; tidy bestanden; 21 Goldens für ausführbare Dateien reproduzierbar unter OTP |
| 2026-10-06 | Plan 11 step 27D keine Obergrenzen für Map-Größe oder Schlüsselarbeit | 164 (160 schnell) | 13 geändert | Schnell 160/160; vollständig `-j 12` 164/164 in 115 s; nach einer tidy-Korrektur in `bit_order` bestehen 35 betroffene Tests; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 27C Tupel-Stelligkeitsgrenze 16.777.215 | 164 (160 schnell) | 51 geändert | Schnell 160/160; vollständig `-j 12` 164/164 in 121 s; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 27B keine Obergrenzen für Listenlänge oder Vergleichsarbeit | 164 (160 schnell) | 4 geändert | Schnell 160/160; vollständig `-j 12` 164/164 in 125 s; Lizard 0 Warnungen; tidy bestanden |
| 2026-10-06 | Plan 11 step 27A runtime-weites Speicherlimit und `--max-heap/stack/memory` | 164 (160 schnell) | 49 geändert | Schnell 160/160; vollständig `-j 12` 164/164 in 118 s; nach einer tidy-Korrektur in `ProcessStack::grow` bestehen 42 betroffene Tests; Lizard 0 Warnungen; tidy bestanden |

PG = Schritt des Muster-/Guard-Plans (archiviert in `.agents/00-finished.md`).
