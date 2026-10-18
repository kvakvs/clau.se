---
source: docs/validation.md
sourceCommit: 336caea7
sourceSha256: b00092bc767953e496774561feaef35ac500b4db73b4344eafd6dda372c90e24
translatedAt: 2026-10-18
---
# Validierung

## Aktuelle Basislinie

Zuletzt erfasste Prüfstufen auf dem Windows-x64-Entwicklungshost (clang-cl und
LLVM-SDK 23.1.2, `/MT`, `_ITERATOR_DEBUG_LEVEL=0`); spätere Schritte erfassen
ihre in `.agents/00-finished.md`:

| Prüfung | Ergebnis |
| --- | --- |
| Frischer kombinierter Debug-CTest (2026-10-14) | 299/300 bestanden; der Fehlschlag ist die bekannte IR-Größengrenze von `codegen_measurements`; `codegen_resource_cli` ist deaktiviert |
| `check-quality-all` (derselbe Lauf) | Sauber; Lizard CCN 10 |
| Optionale OTP-Audit-Tests (2026-10-14, Pin `d199a49a01a2`, Orakel OTP 29.1.1) | 17/17 |
| `regenerate.py --corpus all --check` (ebenso) | 19/19 Korpora reproduzierbar |

## Ausführen der Prüfstufe

Aus einer x64-Entwickler-Shell von Visual Studio mit `C:\Program Files\LLVM\bin`
im `PATH` (die automatische SDK-Auswahl verwendet `thirdparty/` wieder):

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files, one unit per header
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` führt Golden-Korpora bei O0 positionell plus O2 als
  Projekt ohne Spezialisierung aus, führt Mutationen einmal aus und überspringt
  `full_only`-Tests (separate Konsumentenprojekte wie `runtime_generated_link`,
  Messungen, das Host-OTP-Audit `library_freshness` und die langsamen Abläufe
  `linking_lto`, `linking_exports`, `linking_compile_cache`, `programs_compile`
  und `transforms_cache`). Der Vollmodus (Standard)
  führt alle Treiber-/Richtlinienkombinationen aus.
- Lange Tests, die von einem Python- oder CMake-Skript gesteuert werden, tragen
  feste CTest-`COST`: CTest lernt die Kosten eines Wrappers aus dessen eigener
  geringer CPU-Zeit und würde sie zuletzt starten.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multipliziert die Grenzen pro Lauf des
  Golden-Runners (60 s) und des Runners für semantische Fälle (15 s) für
  instrumentierte Builds.
- `check-quality`, `make format` und `make-format.bat` erfassen die seit `HEAD`
  geänderten Dateien plus nicht versionierte Dateien; `cmake/quality_scope.py`
  fügt pro geändertem Header eine Übersetzungseinheit hinzu, die ihn einbindet
  (seine eigene Quelldatei, sonst seinen ersten Nutzer, aus den
  Abhängigkeitsdaten von Ninja in beliebiger Konfiguration; die weiteren
  abhängigen Einheiten des Headers übernimmt `check-quality-all` in der
  vollständigen Prüfstufe), und für
  clang-tidy Einheiten, deren Kompilierbefehl von dem abweicht, den der letzte
  bestandene Lauf erfasst hat (`build/debug/quality/tidy-commands.json`), sodass
  eine Änderung an einer Build-Regel nur die Einheiten erneut prüft, die sie
  ändert. Änderungen an `.clang-tidy` oder den tidy-Skripten wählen alles aus,
  ebenso Änderungen an Build-Regeln vor dem ersten erfassten Lauf.
- `CLAUSE_OPTIMIZED_COMPILER` (Standard ON) kompiliert `clau` und die
  Compiler-Bibliotheken auch in Debug-Builds optimiert, wobei ihre
  Debuginformationen und die Debug-Inferenzbudgets erhalten bleiben; Tests
  verbringen die meiste Zeit in `clau`. Muss ein Compiler-Absturz schrittweise
  durchlaufen werden, mit `-DCLAUSE_OPTIMIZED_COMPILER=OFF` konfigurieren, neu
  bauen und den fehlschlagenden Test erneut ausführen.
- Testprogramme enthalten keine Debuginformationen (keine PDBs); mit
  `-DCLAUSE_TEST_DEBUG_INFO=ON` konfigurieren, um sie für einen Debugger neu zu
  bauen. Verschachtelte native Konsumenten linken die Runtime des
  übergeordneten Builds über `ClauseRuntimeTargets.cmake`, statt sie erneut zu
  kompilieren; nur `runtime_link` baut die Runtime eigenständig.
- Schwellenwerte und Unterdrückungen werden nie angehoben, um die Prüfstufe zu
  bestehen. Zwei Ausnahmen für Drittcode sind konfiguriert (Entscheidung des
  Nutzers): `cmake/tidy_filter.py` verwirft Berichte des statischen Analysators,
  die in Boost-Headern liegen (Fehlalarme zum Limb-Speicher von
  Boost.Multiprecision unter Linux, die ein Umschreiben des aufrufenden Codes
  nur verschiebt), und zählt sie in der Ausgabe, und
  `bugprone-exception-escape` ignoriert `bad_array_new_length` (die
  Move-Konstruktoren von map/set in MSVC allozieren; ein Allokationsfehler ist
  ohnehin fatal).
- clang-tidy prüft Projekt-Header auf jedem Host: Der Header-Filter akzeptiert
  die Trennzeichen `/` und `\`.

### Linux

Dieselbe Prüfstufe läuft unter Linux mit dem festgelegten Linux-SDK von
LLVM 23.1.2 als Host-Compiler (`CC`/`CXX` aus seinem `bin/`), der libstdc++
des Systems, Ninja und CMake 3.28 oder neuer. Boost 1.90 und toml++ 3.4.0
stammen aus installierten Paketen oder werden nach `thirdparty/` entpackt
(`boost_1_90_0/`, `tomlplusplus-3.4.0/`); nur Windows lädt sie herunter. Das
`ld.lld` des Release-Archivs linkt ICU 70 (Ubuntu 22.04) und sein `lldb`
linkt Python 3.14; auf Hosts ohne diese braucht `linking_lto` ICU 70 in
`LD_LIBRARY_PATH`, und `linking_debugger` verwendet GDB.

```sh
cmake --preset debug --fresh -G Ninja -DBUILD_TESTING=ON
cmake --build build/debug
ctest --preset debug -j 16
```

`check-quality` (Lizard, clang-tidy) läuft nur auf dem
Windows-Entwicklungshost; andere Hosts bauen und führen die Tests aus (unter
Linux war es einmal sauber, siehe [Verlauf](#history)).

### Andere Ziele

32-Bit- und ARM-Ziele werden ohne einen für sie gebauten Compiler geprüft (für
diese Hosts gibt es kein LLVM-SDK):

- Ein reiner Runtime-Build (`-DCLAUSE_BUILD_COMPILER=OFF -DBUILD_TESTING=ON`)
  für das Ziel führt dort die Runtime- und ABI-Tests aus: nativ, in einem
  Userland des Ziels (chroot) oder über den Emulator des Hosts (qemu binfmt).
- `tests/compiler/executables/cross.py` führt jedes Executable-Golden und
  Programm-Fixture mit dem `clau` dieses Hosts, `--target-triple`, dem
  Runtime-Archiv jenes Builds und einem `--linker` aus, der die Bibliotheken
  des Ziels erreicht (`run.py --target-option` reicht sie durch).

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
  `semantic/headers/`); `fixture_sources` erzwingt die Isolation von
  OTP-Quellen.
- Sechs Programm-Fixtures für das Endziel (`tests/fixtures/programs/`)
  enthalten OTP-Goldens für stdout/Exit-Status und ihre Kompilierdiagnosen;
  `programs_compile` prüft sie ohne OTP, und
  `tests/compiler/programs/regenerate.py --check` reproduziert sie unter OTP
  ([Fixture-Übersicht](../tests/fixtures/programs/README.md)).
- Goldens zur Termausgabe (`tests/fixtures/printing/`) enthalten OTP-Text von
  `~w` und `erlang:display/1` für 9.542 Werte plus die OTP-stdout kompilierter
  display-Aufrufe; `tests/compiler/printing/regenerate.py --check` reproduziert
  sie ([Fixture-Notizen](../tests/fixtures/printing/README.md)).
- Golden-Fälle für ausführbare Dateien (`tests/fixtures/executables/`) sind
  Quelltextverzeichnisse plus eine `golden.json` mit OTP-stdout/Exit-Status und
  einem selbst verfassten stderr-Muster; `tests/compiler/executables/run.py`
  linkt und führt jeden unter der Richtlinien-/Treibermatrix aus (CTest
  `executables_<case>`), und `regenerate.py --check` reproduziert sie unter OTP
  ([Fallnotizen](../tests/fixtures/executables/README.md)).
- Regenerierung und Live-Audits sind explizit: `-DCLAUSE_OTP_AUDITS=ON` und
  `tests/compiler/patternmatch/regenerate.py`
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

- Native Ausführung erzeugten Codes: Windows x64; Linux x86-64. Ergebnisse für
  32-Bit und ARM (Runtime-Tests und cross-gelinkte Goldens) stehen im Verlauf.
- Apple Silicon: seit Bestehen des Backends nicht validiert.
- ASan, UBSan und LeakSanitizer für Compiler und Runtime: Linux x86-64, eine
  kombinierte Debug-Konfiguration
  (`-fsanitize=address,undefined -fno-sanitize=vptr -fno-sanitize-recover=undefined`),
  vollständiges CTest mit `CLAUSE_TEST_TIMEOUT_SCALE=10` (instrumentierter Code
  läuft um ein Mehrfaches langsamer): kein Sanitizer-Bericht. Compiler, Runtime
  und die Testprogramme sind instrumentiert; Programme, die `clau` linkt,
  beziehen die Sanitizer-Runtime aus einem `clang++`-Wrapper im `PATH`, ihr
  erzeugter Code ist nicht instrumentiert. Die vier Tests mit eingespeister
  Verweigerung durch den Host (`codegen_failure_*`,
  `runtime_lifecycle_failure`, `runtime_memory`) liegen außerhalb des Bereichs
  von ASan: Sein `operator new` bricht bei einer unmöglichen Größe ab, statt zu
  werfen.
- ThreadSanitizer: Linux x86-64, derselbe Instrumentierungsbereich mit
  `-fsanitize=thread`; vollständiges CTest und die Nebenläufigkeitstests je
  fünfmal melden keinen Race. Ebenfalls außerhalb des Bereichs: die beiden
  Tests, die `operator new` ersetzen.
- Unter Windows kollidiert das vorgebaute LLVM-SDK weiterhin mit
  instrumentiertem Code (`annotate_string` 0 gegenüber 1).
- ASan nur für die Runtime besteht unter Windows mit Release-Proben,
  `/EHsc /fsanitize=address`, `/MT`, Clangs ASan-Importbibliothek und statischem
  Runtime-Thunk sowie der ASan-DLL im `PATH`.
- Historische macOS-arm64-Läufe (2026-09-19/20) bestanden vollständige
  Debug-, C++26-, ASan+UBSan-, Nur-Compiler- und Nur-Runtime-Builds für die
  Parser- und Projektstufen; sie liegen vor dem Backend.

## Benchmarks

Manueller Leistungsvergleich mit Erlang/OTP. Er ist nie Teil von CTest, der
Commit-Prüfstufe oder `check-quality`, und nur er braucht ein Erlang/OTP auf
dem Host; Ergebnisse sind hostspezifische Belege, keine Ergebnisse der
Prüfstufe.

```powershell
make-benchmark.bat                         # Windows; set JOBS=N to cap parallel builds
make-benchmark.bat --repeat 9 --only bench_gc,bench_msg
make benchmark BENCH_ARGS="--baseline HEAD~5"   # other hosts
```

- Beide konfigurieren und bauen ein Release-`clau` und eine Release-Runtime in
  `build/bench` und führen dann `benchmarks/run.py` aus (`--help` listet seine
  Optionen).
- Programme: `benchmarks/bench_*.erl` mit `bench_util.erl`, unverändert gebaut
  von `erlc` und `clau -O2`. Jedes misst seine Kernels mit
  `erlang:monotonic_time/1` nach einem Aufwärmaufruf und gibt
  `BENCH <name> <nanoseconds>` aus: Datenerzeugung, Datenverarbeitung,
  Speicherbereinigung, Nachrichtenaustausch, Datei-I/O (in einem leeren
  temporären Arbeitsverzeichnis) und Loopback-Sockets.
- Systeme, auf demselben Host in einem Lauf, verschränkt: OTP mit seiner
  Standardvariante (JIT), OTP `-emu_flavor emu`, wenn installiert (der
  Windows-Installer liefert nur den JIT, daher zeigen diese Spalten `n/a`),
  Clause HEAD bei O2 und mit `--lto` sowie ein früherer Clause-Commit
  (Standard: der neueste Commit, der mindestens einen Tag älter als HEAD ist;
  `--baseline REV`, `--no-baseline`), gebaut in einem zwischengespeicherten
  Worktree unter `build/bench-base/<hash>`, der `thirdparty/` teilt.
- Bericht: pro Kernel der Median von `--repeat` Läufen (Standard 5) in
  Millisekunden mit sechs Nachkommastellen und seine Streuung, die Veränderung
  von Clause O2 gegenüber jedem System (`+N%`: Clause schneller, das andere
  braucht N% länger; `-N%`: Clause braucht N% länger; `(Fx)` das
  Zeitverhältnis) mit einem geometrischen Mittel, `--lto` gegenüber OTP und
  O2, Gesamtlaufzeiten der Programme einschließlich Start, Größen der ausführbaren Dateien, Fehlschläge und
  Zeitüberschreitungen (`--timeout`, 600 s pro Lauf). Iterationszahlen halten
  einen Standardlauf unter 10 Minuten; Clause, das langsamste System, bestimmt
  die Größen, daher dauern manche OTP-Kernels nur wenige Millisekunden.
- Größen der ausführbaren Dateien in Bytes: jedes Programm bei `-O2`, mit
  `--lto` und bei `-O0` (ein zusätzlicher Build, nur gemessen, nie ausgeführt;
  beide durch `--no-lto` übersprungen) und die Vergleichsbasis bei `-O2`, mit
  einer Summenzeile und den Änderungen O2 gegenüber O0, `--lto` gegenüber O2,
  `--lto` gegenüber O0 und O2 gegenüber der Vergleichsbasis (`-N%` kleiner);
  außerdem `clau` bei HEAD und der Vergleichsbasis. Der Verlauf speichert sie
  als `sizes_bytes` (`programs`: Programm → Spalte → Bytes, `clau`:
  `head`/`baseline` → Bytes; `null`, wenn ein Build fehlgeschlagen ist).
- Verlauf: `benchmarks/history/<host>.json` behält einen Datensatz pro Lauftag
  (Laufdatum, HEAD-Hash und Commit-Datum, Mediane von Clause, OTP und
  Vergleichsbasis, Größen), `benchmarks/history/reports/<host>/<day>-<hash>.txt` die
  Textberichte; ein erneuter Lauf am selben Tag ersetzt beide. Datensätze und
  Berichte, die mehr als 183 Tage vor dem neuesten liegen, werden entfernt; ein
  Lauf mit nicht committeten Quelltextänderungen wird berichtet, aber nicht
  erfasst. Das Verlaufsverzeichnis ist in gitignore: Es bleibt auf dem Host, der
  den Lauf ausgeführt hat.
- Listings: Mit `--listings` schreibt ein Lauf vor dem Messen die
  [`--print-asm`](compile.md#assembly-listings)- und `--print-ir`-Listings jedes
  Programms (mit `bench_util`, `--entry <program>`, sodass unerreichbarer
  Bibliothekscode wie in der ausführbaren Datei wegfällt) neben die Berichte
  als `<program>.debug.asm` / `<program>.debug.ll` (`-O0`) und
  `<program>.release.asm` / `<program>.release.ll` (`-O2`, der Code, den die
  Spalte `clause-o2` ausführt) und ersetzt die Listings des vorigen Laufs, auch
  mit `--no-history` und nicht committeten Änderungen. `--print-ir` ist die IR
  vor der LLVM-Pipeline; die Assembly-Kommentare zitieren die IR danach. Ein
  Programm, das nicht kompiliert, verliert seine veralteten Listings.

## Verlauf

Verdichtet aus den früheren schrittweisen Aufzeichnungen (Originale in der
Git-Historie bis Commit `2777c98`). Sofern nicht anders angegeben: Windows x64,
LLVM 23.1.2, Pin `21776803ecd1`, Orakel OTP 29.1.1 / ERTS 17.1. Testzahlen sind
vollständige CTest-Durchläufe ohne Auslassungen.

| Datum | Meilenstein | Tests | Qualitätseinheiten | Anmerkungen |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Parser phase VI (macOS arm64, OTP 29.1 `751f87b7`, Orakel 29.0.5) | 46 | vollständig | 344/344 Produktionen belegt; Korpus aus 10 Dateien |
| 2026-09-20 | Projekte (macOS arm64) | 64 | vollständig | Debug, Nur-Compiler, ASan+UBSan |
| 2026-09-28 | Testmigration auf CLI-Abläufe; Reparatur der Windows-Prüfstufe | 75 | vollständig | Stack-Überlauf in `parser_hardening` mit 8-MiB-Stack behoben; Lizard + clang-tidy sauber |
| 2026-09-29 | Compiler-Meilenstein steps 1–46 | 103 | 182 | Nur-Compiler 80, Nur-Runtime 16, Runtime-ASan 16 |
| 2026-10-01 – 10-03 | Muster-/Guard-Plan PG1–PG20 | 104–131 | 189–258 | ABI-Revisionen 2–4; PG15a machte Goldens OTP-frei (Audits optional, 131 → 118 Tests); abgeschlossen mit 19 Korpora, 67.634 Werten, 1.969 vorgegebenen Ergebnissen |
| 2026-10-03 | OTP-Quelltext-Audit | 125 | 258 | Kopierte OTP-Dateien durch lokale Fragmente ersetzt; ein Vergleich mit einem 60-Token-Fenster gegen 4.150 Erlang- und 1.190 C/C++-Dateien von OTP fand außer einem erzeugten Ganzzahltupel keine Überschneidung |
| 2026-10-03 | Basislinie Plan 11 step 1 (Commit `b1a471f`, Pin `21776803ecd1`, Lizard 1.24.0, clang-tidy 22.1.8) | 125 (122 schnell) | 258 | Vollständig 729 s seriell, 85 s mit `-j 16`; 14/14 Audits; 19/19 Korpora; fremde O0/O2-Objekte für 7 Ziele untersucht |
| 2026-10-03 | Steps 2, 4: Programm-Fixtures, Termausgabe | 126–128 | 265 | Sechs OTP-Programm-Goldens; 9.542 Goldens für `~w`/display |
| 2026-10-04 | Steps 8, 8I: Runner für ausführbare Dateien, klassischer Heap (phases B, C abgeschlossen) | 138–144 | 272–276 | Vollständig `-j 16` 235–370 s |
| 2026-10-04 – 10-05 | Steps 9–20: `case`, `if`, Auslösen, `catch`, `try`, Stacktraces, `maybe` (phase D abgeschlossen), Rekursion, Frames und Endaufrufe | 146–158 | 277–278 | Schnelle und betroffene Tests im Vollmodus pro Schritt; vollständig `-j 16` 155/155 in 259 s bei phase D |
| 2026-10-06 | Steps 21–28: Comprehensions (phase E abgeschlossen), Wurzeln und Bereinigung, Speicher- und Termgrenzen (27A–27E), Graphkopien | 159–166 | 278–281 | Vollständig `-j 12` 105–275 s; step 27 entfernte standardmäßige Speicherobergrenzen |
| 2026-10-07 | Steps 29–35: Records, native Records (ABI 6), Funs (ABI 7), Closures, benannte Funs, dynamische Aufrufe (ABI 8) | 167–177 | 283–290 | Vollständig `-j 12` 119–152 s |
| 2026-10-09 | Step 63 Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, LLVM 23.1.2 SDK clang, libstdc++ 14, GDB 16.2) | 235 | 338 | Vollständiges CTest 235/235 in 161 s; Lizard und clang-tidy unter Linux sauber (7 Analysator-Berichte in Boost-Headern ignoriert); Windows-Prüfstufe 235/235 mit geprüften Headern |
| 2026-10-09 | Step 64 32-Bit: Windows x86 (WoW64, clang-cl) und Linux i386 (Debian-13-chroot, clang 19) | 42 + 65 Goldens | — | Runtime-/ABI-Tests 42/42 nativ auf beiden; `cross.py`-Goldens 65/65 auf beiden (nur für 64 Bit gedachte Läufe von `integer_limit` übersprungen) |
| 2026-10-09 | Step 65 Linux arm64 und armhf (Debian-13-Sysroots, qemu-user 9.2) | 42 + 65 Goldens | — | Runtime-/ABI-Tests je 42/42; Goldens je 64/65 (`port_spawn` `enoent`: Lücke in `posix_spawn` von qemu), Laufgrenze 900 s |
| 2026-10-10 | Step 67 ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Kein Sanitizer-Bericht; vier Tests mit eingespeister Verweigerung durch den Host außerhalb des Bereichs von ASan; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Step 68 ThreadSanitizer (Linux x86-64) | 233 | — | Eine Umkehrung der Sperrreihenfolge korrigiert (`Executor::clear`); danach kein Bericht in vollständigem CTest und 15 Nebenläufigkeitstests x5 |
| 2026-10-10 | Steps 65A–65C: Behaviours, `module_info/0,1`, Importe | 234–236 schnell | 342–344 | Lint- und Executable-Goldens reproduzierbar unter OTP 29.1.1 |
| 2026-10-11 | Steps 73A–73G Parse-Transformationen | 242/243 schnell | — | Bekannter Fehlschlag von `codegen_resource_cli`, inzwischen deaktiviert |
| 2026-10-12 | Steps 62D1–62E Build-Verzeichnis und Caches | 263/264 | alle | Vollständiges CTest, bekannter Fehlschlag von `codegen_resource_cli`; `check-quality-all` sauber |
| 2026-10-13 | Steps 58U–58W Inferenz-Cache | 278/279 | alle | Vollständiges CTest, bekannter Fehlschlag von `codegen_measurements`; `check-quality-all` sauber |
| 2026-10-14 | Step 41S `prim_eval` und der erneute luerl-Lauf (H3 abgeschlossen) | 299/300 | alle | Siehe aktuelle Basislinie |
| 2026-10-17 | Plan 20 OPTM.2 (Ein-Wort-Term, persistente Terme an Ort und Stelle und freigegeben) und OPTM.3 (ungeprüfte Zugriffsfunktionen) | 330/332 | alle | Vollständiger CTest: bekannter Fehler in `codegen_measurements`, und `library_freshness` (Host-OTP) erwartet noch die durch `b0e62a38` ersetzten `not_implemented`-Stub-Rümpfe; `check-quality-all` sauber |

PG = Schritt des Muster-/Guard-Plans; die Aufzeichnungen der Schritte von plan
11 sind in `.agents/00-finished.md` archiviert.
