---
source: docs/compile.md
sourceCommit: a8c3f8f6
sourceSha256: 070de594787444f6afefbf3760848986bda8c85ff204932e596a67502385ae50
translatedAt: 2026-10-17
---
# Kompilierung

`clau` kompiliert Erlang/OTP-29-Module über LLVM zu verifiziertem IR, Bitcode
oder nativen Objekten. `-o/--output` linkt positionale Eingaben (oder ein
ausgewähltes Projektziel), ihr [Einstiegs](executables.md)-Startobjekt und die
Runtime zu einer ausführbaren Datei ([Linken](executables.md#linking));
Projekt-Builds linken ausführbare Ziele zu den Ausgaben ihres Manifests
([Projekte](projects.md#executables)). Erzeugte Objekte können auch über ein
C++-Harness laufen, das mit der Runtime gelinkt ist (siehe Beispiel unten).

## Akzeptierte Teilmenge des Quelltexts

Benannte Module der gewöhnlichen Sprache von OTP 29: geordnete
Funktionsklauseln mit [Mustern](patterns.md) und [Guards](guards.md); Matches,
Konstruktoren, Operatoren und Builtins ([Builtins](builtins.md)); `case`, `if`,
`receive`, `catch`, `try ... of ... catch Class:Reason:Stack ... after` mit
[Stacktraces](abi.md#stack-traces), `maybe ... else ... end`; Listen-, Binary-
und Map-Comprehensions ([Muster](patterns.md#comprehensions)); Tupel- und
[native Records](native-records.md); [Funs](funs.md), lokale, entfernte und
dynamische Aufrufe (`M:F(...)`, `apply/2,3`); [Prozesse](processes.md) und
[Ports](ports.md). Aufrufe laufen auf expliziten Prozess-Frames mit echten
Endaufrufen (tail calls) ([Ausführungsmodell](execution-model.md#implementation));
Rumpfrekursion ist durch den Prozess-Stack begrenzt (standardmäßig unbegrenzt),
nicht durch den nativen Stack. Module, die ein Batch nennt, aber nicht
deklariert, stammen aus der [Bibliothek](library.md). Match-Qualifier in
Comprehensions aus dem experimentellen Feature `compr_assign` werden als
`[heap expressions] notimpl` abgewiesen.

Akzeptierte Attribute: `module`, `export`, `file`, Tupel- und native `record`,
`export_record`, `import_record`, Type/Spec-Formen, `doc`/`moduledoc`,
`behaviour`/`behavior` ([Behaviours](semantic.md#behaviours)), jedes
informative Attribut (`vsn`, `author`, `copyright`, `deprecated`, `dialyzer`,
benutzerdefiniertes `-name(Term)`; aufbewahrt für
[`module_info(attributes)`](semantic.md#predefined-functions)),
`-import(Module, [F/A, ...])` ([Importe](semantic.md#imports)) und `-compile`
mit Optionen, die nichts an der Ausgabe von Clause ändern:
`{no_auto_import, ...}`, Warnungsoptionen (`nowarn_*`, `warn_*`,
`{nowarn_unused_function, [...]}`) sowie Optimierungs-, Debug- und
Berichtshinweise (`inline`, `{inline, [F/A]}`, `{inline_size, N}`,
`{inline_effort, N}`, `inline_list_funcs`, `debug_info`, `deterministic`,
`report*`, `verbose`, ...). `{parse_transform, Module}` führt den Transform vor
der Analyse auf dem Erlang/OTP des Hosts aus
([Parse-Transforms](transforms.md)). `on_load`, `nifs`, `export_all`, andere
`compile`-Optionen und parametrisierte Module werden abgewiesen; die Diagnose
nennt sie, zum Beispiel
`[behavior-changing attributes] notimpl [module="m" operation="-compile option export_all"]`.
Jedes Modul erhält `module_info/0,1`. Quellen, die mit `#!` beginnen, folgen
den [Escript-Regeln](executables.md#escripts) (implizites Modul und Export von
`main/1`, `-mode` wird akzeptiert). Type/Spec-Formen werden analysiert, ändern
aber nie den generierten Code. Reine Syntaxmodi (`--parse-check`,
`--print-ast`, `--print-source`, ...) akzeptieren die vollständige Grammatik.

## Das Beispiel mit kompilierten Modulen ausführen

`client:main/1` macht das Beispiel zu einem Programm:

```sh
./build/debug/bin/clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo     # prints 42, -7 and {record,map,binary,list,integer,other}
```

Dieselben Module laufen auch über ein C++-Harness. Aus einer
Windows-x64-Developer-PowerShell mit dem gebauten Compiler:

```powershell
$tool = './build/debug/bin/clau.exe'
& $tool -O0 --emit obj --artifact-dir build/example-aot examples/compile/answer.erl examples/compile/client.erl
cmake -S examples/compile -B build/example-native -G Ninja -DCMAKE_CXX_COMPILER=clang-cl -DCMAKE_BUILD_TYPE=Debug "-DGENERATED_DIR:PATH=$((Resolve-Path build/example-aot).Path)"
cmake --build build/example-native
./build/example-native/bin/Debug/compiled_modules.exe
```

Es gibt `42`, `-7`, `record`, `map`, `binary`, `list`, `integer`, `other` aus,
je eines pro Zeile. Das Harness registriert Module explizit, erzeugt einen
Kontext und dekodiert Ergebnisse; es ist ein Beispiel-Host, kein produktiver
Einstiegspunkt. Unter Unix `build/debug/bin/clau`, `clang++` und
`-DGENERATED_DIR="$PWD/build/example-aot"` verwenden. Der CTest
`codegen_examples` führt diese Befehle mit jeder Policy aus.

Weitere Aktionen auf denselben Quellen:

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

## Ausgabe im Abstract Format

`--print-abstr` (eine Frontend-Aktion) gibt jedes geparste Modul als die Formen
im [Abstract Format](https://www.erlang.org/doc/apps/erts/absform.html) von OTP
aus, die `epp` einem Parse-Transform übergeben würde, ein Term von
`file:consult/1` pro Zeile, dieselben Terme, die `erlc +to_abstr` schreibt
([Transforms](transforms.md)).

## Ausgabe des Quelltexts

`--print-source` (eine Frontend-Aktion wie `--print-ast`) gibt jedes geparste
Modul als Erlang-Quelltext aus; `--print-types` gibt denselben Text mit
Typannotationen aus. Der Printer (`print_source`, `expression_source`,
`type_source` in `printing.hpp`; `compiler/src/printing/source_*`) ist
wiederverwendbar:

- Formen folgen in Quelltextreihenfolge aufeinander, mit einer Leerzeile um jede
  Funktion; die `-file`-Form, die der Präprozessor vor einem Modul einfügt,
  entfällt, die um eingebundene Dateien bleiben erhalten.
- Der Text ist die geparste Syntax: Makros sind expandiert, Includes eingefügt,
  und Kommentare, ursprüngliche Schreibweise und Layout sind verschwunden.
  Klauseln und Blockausdrücke (`case`, `if`, `receive`, `try`, `maybe`, `begin`,
  Funs mit mehr als einer Zeile) erhalten um vier Spalten eingerückte Zeilen;
  alles andere steht in einer Zeile. Klammern stammen nur aus den eigenen
  Gruppierungen des Quelltexts.
- Ausgegebener Text wird wieder zum selben Syntaxbaum geparst, und erneutes
  Ausgeben ergibt denselben Text (CTest `printing_source` über die parsebaren
  Fixtures).
- `SourceNotes` fügt einem Ausdruck eine Notiz hinzu, ausgegeben als
  nachgestellter Kommentar `% Text` nach der Interpunktion der Zeile, in der der
  Ausdruck endet, sowie Kommentarzeilen über einer Form. Nur Ausdrücke, die
  ganze Zeilen einnehmen, tragen Notizen (Rumpfausdrücke und der geprüfte Wert
  eines `case`; einer pro Zeile, der äußerste), sodass lange verschachtelte
  Ausdrücke lesbar bleiben und der Text Erlang bleibt. Muster und Guards tragen
  keine.

## Optionen

| Option | Verhalten |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Ein Artefakt pro Modul veröffentlichen |
| `--artifact-dir DIR` | Artefaktwurzel (erfordert `--emit`) |
| `-o PATH` / `--output PATH` | Eine ausführbare Datei linken ([Linken](executables.md#linking)); kollidiert mit `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Clang-Treiber und Runtime-Archiv für `-o` |
| `--no-cache` | [Build-Caches](projects.md#build-caches) weder lesen noch schreiben |
| `--cache-inference-in-dirs PATTERN` | Wiederholbar: Module in passenden Verzeichnissen behalten ihre Inferenzergebnisse im Build-Cache, zusätzlich zu den impliziten OTP-Anwendungsverzeichnissen ([Inferenz-Cache](projects.md#inference-cache)) |
| `--build-dir DIR` | Wo Clause temporäre Dateien ablegt (unter `DIR/tmp`); ersetzt das `build_dir` jedes ausgewählten Projektziels; positionale Eingaben haben ohne die Option keines ([Build-Verzeichnis](projects.md#build-directory)) |
| `--entry MODULE[:FUNCTION[/ARITY]]` | Einstiegsfunktion/1 der ausführbaren Datei (sonst Funktion/0; `/0` oder `/1` wählt eine aus); wird in jedem Kompiliermodus validiert und fügt das Startartefakt `clausev1_start` hinzu ([ausführbare Dateien](executables.md#startup-object)); IR- und Assembly-Inspektionen lassen dann weg, was er nicht erreicht ([Lebendigkeit von Exporten](executables.md#export-liveness)) |
| `--target-triple TRIPLE` | Zielmaschine; `--target` ist die Auswahl des Projektziels |
| `-O0` / `-O2` / `-Os` | Generischer Standardcode + LLVM O0 / begrenzte Spezialisierung + LLVM O2 / LLVM Os, keine Spezialisierung, ein Abschnitt pro Symbol und Entfernen nicht referenzierten Codes und nicht referenzierter Daten durch den Linker |
| `--no-type-specialization` | Varianten unabhängig von der Optionsreihenfolge deaktivieren |
| `--lto` | Die Module als Bitcode mit Link-Time-Optimierung von LLD linken (Windows-MSVC- und ELF-Ziele; braucht `-o` oder einen linkenden Projekt-Build) ([Linken](executables.md#linking)) |
| `--keep-exports` | Jeden Export einer ausführbaren Datei aufrufbar halten, statt die unerreichbaren wegzulassen; braucht `-o`, einen linkenden Projekt-Build oder eine IR-/Assembly-Inspektion ([Lebendigkeit von Exporten](executables.md#export-liveness)) |
| `-g` | Erlang-Zeilentabellen in Objekten und gelinkten ausführbaren Dateien (CodeView/PDB auf MSVC-Zielen, sonst DWARF) ([Debugging](debugging.md)) |
| `--print-ir` / `--print-optimized-ir` | Verifiziertes IR vor/nach den LLVM-Pässen, mit Erlang-Quelltextzeilen als Kommentaren |
| `--print-asm` | Die Ziel-Assembly jedes Moduls nach der gewählten Pipeline, jede Folge von Maschinencode kommentiert mit der IR-Instruktion und der Erlang-Zeile, aus der sie stammt ([Assembly-Listings](#assembly-listings)) |
| `--print-types` | Jedes Modul als Erlang-Quelltext, annotiert mit inferierten Typen ([Semantik](semantic.md#--print-types)); stoppt vor LLVM |
| `--verbose` | Phasenereignisse `[pp]`, `[parse]` und `[comp]` auf stderr, dann die Zusammenfassung `[index] ...` des [Verzeichnisindex](projects.md#directory-index) |
| `--print-stage-times` | `[time] <stage> <subject>: <ms> ms` auf stderr: `plan` pro Projektmanifest (Laden und Expandieren der Muster jedes ausgewählten Ziels), `preprocess`, `parse` und `transform` (Module mit Parse-Transforms) pro Quelldatei, `compile` pro Batch (Modulanzahl, Projektziel), `link` pro ausführbarer Datei; ` (cached)` folgt einer Stufe, die ein [zwischengespeichertes](projects.md#build-caches) Ergebnis wiederverwendet hat. Vor der Gesamtzeit `compile` eines Batches stehen seine Phasen mit demselben Subjekt: `index`, `calls`, `liveness` (ausführbare Dateien und Inspektionen mit Einstiegspunkt), `declared-types`, `inference-cache` (mit `N of M covered modules reused`, [Inferenz-Cache](projects.md#inference-cache)), `inference`, `inference-store`, `contracts`, `lower`, `optimize`, `emit` (die gelaufenen). Nach `inference`: Zeilen `inference pass N` mit den Arbeitsschritten des Durchlaufs aus dem Arbeitsbudget der Inferenz (`N of BUDGET work steps`) und wie er endete (`inputs changed`, `fun results changed`, `settled` oder der letzte Durchlauf nach nicht stabilisierten Durchläufen), mit Nennung der Funktion, die lief, als das Budget aufgebraucht war; dann `inference slowest <module>:<function>/<arity>` für die 10 Funktionen (rekursive Gruppen nennen ein Mitglied `and N more`), die über alle Durchläufe am längsten brauchten, mit ihren Arbeitsschritten und dem Anteil dieser Arbeit am Budget der Durchläufe, die sie ausführten (`877450 work steps, 43.9% of 10 passes of 200000 budget`), und `widened to term()`, wenn ein Budget einen ihrer Fakten verbreitert hat; dann `inference rounds <module>:<function>/<arity> and N more` für die 10 langsamsten rekursiven Gruppen: Lösungsläufe über alle Durchläufe, gelaufene Runden gegenüber der Obergrenze pro Lösungslauf (8 + 4 pro Mitglied), Lösungsläufe, die die Obergrenze erreichten oder ihr Achtel des Durchlaufbudgets verbrauchten (jedes Mitglied zu `term()` verbreitert), Lösungsläufe, die sofort aufgaben, weil ein früherer Durchlauf es tat (`remembered`), oder mit verbrauchtem Durchlaufbudget endeten, Durchgänge über Mitglieder (und die übersprungenen, weil sich nichts geändert hat, was sie lesen) und der Anteil, der eine Zusammenfassung änderte (gewachsen, Eingaben vom Funktionstyp geändert oder zurückgekippt auf eine der letzten 4 Zusammenfassungen des Mitglieds), sowie die pro Runde geänderten Mitglieder des letzten Lösungslaufs in zehn Rundengruppen. Eine zwischengespeicherte Kompilierung gibt keine Phasen aus |
| `--print-env` | Die aufgelöste Kompilierumgebung als TOML auf stdout ausgeben und beenden, ohne Quellen zu verarbeiten ([Umgebungsbericht](#environment-report)) |
| `--print-inputs` | Die Eingaben präprozessieren und parsen, die Module, die sie nennen, wie bei der Kompilierung hinzufügen, dann jede Quelle des Batches auf stdout auflisten und vor der Kompilierung stoppen ([Projekte](projects.md#cli-and-target-selection)) |

- Ohne `--emit` verifiziert die Kompilierung Objekte im Speicher und schreibt
  nichts außerhalb des [Build-Verzeichnisses](projects.md#build-directory).
- Positionale Eingaben bilden einen Batch; jedes Projektziel ist ein eigener
  Batch.
- Artefaktwurzeln: `build/aot` (positional) oder `build/aot/<hex-target>` unter
  dem Manifestverzeichnis. Explizite Wurzeln sind relativ zum Aufruf.
- Namen sind umkehrbares Hex: `answer` → `clausev1_616e73776572__0.obj` (`.o`
  für ELF/Mach-O, `.ll`, `.bc`); das Startobjekt ist `clausev1_start.obj`.
- Alle Batches werden vor der Veröffentlichung kompiliert und bereitgestellt.
  Fehlschläge veröffentlichen nichts und behalten frühere Ausgaben; das Ersetzen
  ist atomar pro Datei, nicht pro Batch.
- `--emit` kollidiert mit `-o`; Kompilierschalter kollidieren mit reinen
  Frontend-Aktionen und `--new-project`. `--print-types` weist Ziel- und
  Optimierungsoptionen ab.
- IR-Snapshots sind LLVM-Assembly; mehrere Snapshots sind durch maskierte
  Kommentarköpfe getrennt und bilden kein einzelnes parsebares Modul. Für
  Werkzeugeingaben `--emit llvm-ir` verwenden. Kommentare mit Quelltextzeilen
  zeigen den Originaltext (nicht expandierte Makros) und überleben die
  Optimierung über Debug-Orte.

## Assembly-Listings

`--print-asm` führt die gewählte Pipeline aus (wie `--print-optimized-ir`) und
gibt dann die Assembly jedes Eingabemoduls aus derselben Zielmaschine aus, die
Objekte schreibt, ein Modul nach dem anderen. Kommentare verwenden das
Kennzeichen des Ziels (`#` auf x86, `//` auf AArch64-ELF, `;` bei Apple, `@`
auf ARM):

```
# erlang answer.erl:3: value() -> 42.
#     ir store i64 687, ptr %frame.slots, align 8
	movq	$687, 32(%r15,%r12,8)
#     ir br i1 %4, label %return.inline, label %return.service
```

- Ein `ir`-Kommentar eröffnet jede Folge von Instruktionen, die aus einer
  IR-Instruktion ausgewählt wurden, geschrieben so, wie `--print-optimized-ir`
  sie ausgibt (dieselbe Wertnummerierung, `switch` auf eine Zeile
  zusammengefasst, kein `!dbg`). Code, der über Instruktionen hinweg verschoben
  oder zusammengeführt wurde, wiederholt oder überspringt Kommentare, wie es die
  Zeilentabelle sagt.
- Ein `erlang`-Kommentar nennt die physische Datei, Zeile und den Text, wie
  IR-Quelltextkommentare, wenn sich die Zeile innerhalb einer Funktion ändert.
  Instruktionen, deren Lowering nirgends verortet ist (Wrapper,
  Frame-Einrichtung), haben keinen.
- Das Listing kompiliert eine Kopie, deren Zeilentabelle IR-Instruktionen statt
  Erlang-Zeilen nummeriert; die Direktiven, Debug-Abschnitte und Labels dieser
  Zeilentabelle entfallen. Neu assembliert ergibt es das Objekt, das
  `--emit obj` schreibt.
- Mit anderen Inspektionen gibt jedes Modul nacheinander `before`, `after` und
  `assembly` aus, jeweils nach einem Kopf (`stage=assembly`). Wie die
  IR-Inspektion weist es `--emit`, `--artifact-dir`, `--output` und
  `--print-types` ab. x86-Listings verwenden AT&T-Syntax.
- Mit `--entry` lassen IR- und Assembly-Inspektionen die Funktionen weg, die der
  Einstiegspunkt nicht erreichen kann, wie es die ausführbare Datei tut
  (`--keep-exports` behält sie).

## Umgebungsbericht

`--print-env` validiert die ganze Befehlszeile (Konflikte, lesbare positionale
Eingaben, Projektplanung), gibt dann aus, was dieser Befehl verwenden würde, als
ein TOML-Dokument auf stdout, endet mit 0 und liest keinen Quelltext. Pfade sind
absolut, mit `/`.

```toml
# clau compile environment (--print-env)
command = ["clau", "--print-env", "-O2", "-o", "app", "main.erl"]  # as given
actions = ["link"]          # see below
working_directory = "/work"

[[targets]]                 # one per selected project target; one for positional inputs
name = "app"                # project targets only
project = "/work/project.toml"
sources = ["/work/src/main.erl"]           # globs and search paths resolved
library_directory = "/clau/library"     # application dirs, searched before source_search_paths
build_dir = "/work/build"   # "" for positional inputs without --build-dir
entry = "main:main"         # or "auto" when linking without --entry
output = "/work/app"        # linking only: final name (".exe" on Windows)
linker = "/usr/bin/clang++" # linking only; "" when none is found
runtime_library = "/clau/lib/libclause_runtime.a"

[targets.options]           # manifest option names
source_search_paths = []    # directories, patterns expanded
include_dirs = []           # search order, patterns expanded
defines = []
applications = { "stdlib" = "/otp/lib/stdlib" }  # last mapping wins
enabled_features = ["maybe_expr"]                # OTP defaults plus changes

[targets.backend]
target_triple = "x86_64-unknown-linux-gnu"  # host when not given
optimization = "O2"
type_specialization = true  # O2 without --no-type-specialization
debug_info = false
lto = false
keep_exports = false        # --keep-exports or the project option
emit = "none"               # or obj, llvm-ir, llvm-bc
artifact_dir = "/work/build/aot"
```

(Arrays geben ein Element pro Zeile aus.) `actions` listet die
Frontend-Aktionen (`print-pp`, `parse-check`, `print-ast`, `print-source`,
`print-abstr`, sonst `preprocess-check`; `print-inputs` allein ersetzt sie),
sonst die Inspektionen (`print-types`, `print-ir`, `print-optimized-ir`,
`print-asm`), sonst `emit`, `link` (`-o`) oder `compile`. In einem
Projekt-Build linken auch Ziele mit einem `output`. Module, die später über
ihren Namen gefunden werden (über `source_search_paths` oder die Bibliothek),
werden nicht aufgeführt: Sie zu finden braucht Parsen (`--print-inputs` tut
das). `--print-env` lässt sich nicht mit `--new-project` kombinieren.

## Kompilier-Cache

Ein Batch mit einem Build-Verzeichnis (jedes Projektziel, positionale Eingaben
mit `--build-dir`) behält sein Kompilierergebnis im
[Build-Cache](projects.md#build-caches): die Diagnosen in Reihenfolge, den
Fehlschlag und, wenn eine ausführbare Datei oder `--emit` sie braucht, die
Objekte (oder den Bitcode) jedes Moduls und des Startmoduls. Ein späterer Build
desselben Batches mit denselben Optionen spielt die Diagnosen erneut ab und
linkt oder veröffentlicht die behaltenen Objekte genau wie frische;
`--print-stage-times` zeigt dann `[time] compile ... (cached)`. `--print-ir`,
`--print-optimized-ir`, `--print-asm` und `--print-types` rechnen immer neu,
und `--no-cache` liest und schreibt nichts.

- **Einheit der Wiederverwendung: der ganze Batch.** Analyse, Typinferenz,
  Spezialisierungsbudgets (pro Ziel), Lebendigkeit von Exporten und das
  Startmodul erstrecken sich über jedes Modul, daher hängt das Objekt eines
  Moduls von Fakten anderer ab (Typen der Aufgerufenen, Records, Behaviours,
  welche Funktionen lebendig bleiben). Diese Fakten haben heute keine kanonische
  Form, die sich pro Modul hashen ließe, daher ließe sich ein Schlüssel pro
  Modul nicht als korrekt beweisen; jede Änderung an irgendeinem Modul des
  Batches kompiliert den Batch neu. Nur Inferenzergebnisse werden für abgedeckte
  Bibliotheksverzeichnisse pro Modul behalten
  ([Inferenz-Cache](projects.md#inference-cache)), sodass eine solche
  Neukompilierung sie wiederverwendet.
- **Schlüssel.** Die Version von `clau` und die Identität der ausführbaren
  Datei; Pfad und Fingerabdruck jeder Eingabe (jede Datei, die das Frontend
  dafür gelesen hat, Pfad und Bytes, in Reihenfolge: die Quelle, ihre Includes
  und `include_lib`-Dateien und die Antwort ihrer Parse-Transforms; die
  Präprozessoroptionen; der erzeugte Text von Platzhaltern), vordefinierte
  Formen und Escript-Status; das aufgelöste Triple, die Optimierungsstufe,
  `--emit`, `--no-type-specialization`, `-g`, `--lto`, `--keep-exports`, ob eine
  ausführbare Datei gelinkt wird, die Auswahl des Einstiegspunkts und das
  Projektziel. Einträge eines Ziels mit anderen Optionen werden nebeneinander
  behalten.
- **Speicherung.** Jede Ausgabe ist ein eigener Teil, sodass ein Objekt, das
  größer als die Inline-Grenze des Speichers ist, zu einer inhaltsadressierten
  Blob-Datei wird, die geteilt wird, wenn zwei Optionsmengen identische Objekte
  erzeugen.

## Backend

- Ein LLVM-Kontext und eine Zielmaschine pro Batch. Das Host-Triple verwendet
  Host-CPU und -Features; fremde Triples verwenden die generische CPU. PIC,
  kleines Codemodell.
- Backends: X86, ARM, AArch64 (Schnittmenge mit dem SDK). Unbekannte oder
  fehlende Backends schlagen fehl; es gibt keinen Rückfall auf den Host.
- Die Verifikation läuft vor und nach der Optimierung; sie prüft die Gültigkeit
  des IR, nicht die Korrektheit des Erlang-Codes.
- Budgets pro Ziel: 16.384 Module, 1.500.000 AST-Knoten pro Modul, 16.000.000
  pro Batch. Serialisierte Ausgabe: 64 MiB pro Modul, 256 MiB pro Batch. Das
  Überschreiten eines Budgets ist eine gewöhnliche Ressourcendiagnose.

## LLVM-SDK

Stabiles LLVM **23.1.x**, mindestens 23.1.1. LLVM ist eine Host-Abhängigkeit:
Architektur, C++-Standardbibliothek und Windows-CRT müssen zum Compiler-Werkzeug
passen. Projektcode behält Ausnahmen/RTTI; keine Ausnahme darf durch LLVM
abgewickelt werden. Die Runtime verwendet LLVM nie.

- Die Suche durchsucht Standardpräfixe (`/usr`, `/usr/local`, `/opt/homebrew`,
  `/opt/local`, `/opt/llvm`, Linuxbrew, `/Library/Developer/Toolchains`,
  Program Files unter Windows), einschließlich versionierter Layouts.
  Build-Bäume werden abgewiesen.
- `LLVM_DIR` wählt ein SDK explizit aus; ungültige Auswahlen schlagen ohne
  Rückfall fehl.
- Wird keines gefunden, lädt CMake das festgelegte Archiv **23.1.2** (mit
  SHA-256-Prüfung) nach `thirdparty/` herunter, für Windows x64/ARM64, Linux
  x64/ARM64 oder macOS ARM64. `CLAUSE_DOWNLOAD_LLVM=OFF` deaktiviert Downloads.
- Eine Link-Probe zur Konfigurationszeit prüft die ABI-Kompatibilität.

Referenz-Setup Windows x64: Host-clang-cl 23.1.2 in
`C:/Program Files/LLVM/bin`, SDK
`thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`,
Visual-Studio-18-x64-Werkzeuge, Windows SDK 10.0.26100.0, Ninja, `/MT`,
`_ITERATOR_DEBUG_LEVEL=0`. Die automatische Auswahl wendet die Einstellungen für
`/MT` und Iteratoren an; ein explizites `LLVM_DIR` tut das nicht, und die
Link-Probe schlägt dann fehl.

## PCRE2

Die `re`-Builtins der Runtime verwenden PCRE2 **10.47**, das Release, das
OTP 29 mitliefert (`erts/emulator/pcre/vendor.info`), sodass sich
Mustersyntax, Optionen und Captures wie bei OTP verhalten: 8-Bit-Codeeinheiten,
Unicode-Unterstützung, kein JIT, unverändertes `pcre2_match` (der Yield-Patch
von OTP wird nicht übernommen). PCRE2 steht unter BSD-3-Clause mit der
PCRE2-Ausnahme für kompilierte Binärdateien; keine PCRE2-Datei ist eingecheckt.
CMake (`cmake/Pcre2Dependencies.cmake`) löst es in dieser Reihenfolge auf:

1. `-DCLAUSE_PCRE2_ROOT=<source directory>` hat Vorrang (kein Download); die
   Version in dessen `configure.ac` muss 10.47 sein.
2. Ein installiertes PCRE2 ab 10.47 (`CLAUSE_PCRE2_SYSTEM=ON`, der Standard):
   das CMake-Paket (`find_package(pcre2 CONFIG COMPONENTS 8BIT)`, statische
   Bibliotheken bevorzugt), sonst pkg-config `libpcre2-8`, wobei ein statisches
   `libpcre2-8.a` der gemeinsamen Bibliothek vorgezogen wird.
3. Das festgelegte Release, heruntergeladen nach `thirdparty/pcre2-10.47` und
   verifiziert (`pcre2-10.47.tar.bz2`, SHA-256
   `47fe8c99461250d42f89e6e8fdaeba9da057855d06eb7fc08d9ca03fd08d7bc7`);
   `-DCLAUSE_DOWNLOAD_PCRE2=OFF` deaktiviert den Download.

Ein Quellverzeichnis (1 oder 3) baut die Objektbibliothek `clause_pcre2` aus
den aufgeführten `.c`-Dateien, mit den mitgelieferten `config.h.generic`,
`pcre2.h.generic` und `pcre2_chartables.c.dist`, die in den Build-Baum kopiert
werden (kein Erzeugungsschritt, keine Warnungsflags des Projekts, außerhalb von
clang-tidy und Lizard), und ihre Objekte werden `clause_runtime` selbst
hinzugefügt: Das Archiv ist in sich abgeschlossen, und jeder Konsument (Links
von `clau`, verschachtelte Testprogramme, `runtime_link`, `examples/compile`)
erhält PCRE2 damit. Eine installierte Bibliothek wird stattdessen zu einer
zusätzlichen Linker-Eingabe, festgehalten in `clause_runtime.link` neben dem
Archiv (eine Eingabe pro Zeile), die `clau` jedem Link hinzufügt; eine
gemeinsame Bibliothek macht die ausführbaren Dateien zur Laufzeit von ihr
abhängig. Pro Plattform: Windows verwendet den Download (praktisch wird kein
PCRE2 des Systems gesucht); Linux und macOS verwenden ein installiertes PCRE2
ab 10.47, wenn vorhanden, sonst den Download. PCRE2 wird immer in die Runtime
gelinkt, auch in Programme, die `re` nie aufrufen.

## zlib

Das zlib-Modul der Runtime und komprimierte externe Terme verwenden zlib
**1.3.2**, das Release, das OTP 29 mitliefert
(`erts/emulator/zlib/vendor.info`), sodass komprimierte Bytes denen von OTP
gleichen. CMake kompiliert seine Bibliotheksquellen
(`cmake/ZlibDependencies.cmake`, `clause_add_runtime_zlib`) in die
Objektbibliothek `clause_runtime_zlib`, deren Objekte wie die von PCRE2 in
`clause_runtime` eingehen; `-DCLAUSE_RUNTIME_ZLIB_ROOT=<source directory>` hat
Vorrang, andernfalls wird das Release auf jedem Host nach
`thirdparty/zlib-1.3.2` heruntergeladen und verifiziert (SHA-256
`bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16`). Die
Lizenz von zlib ist die zlib-Lizenz. Das LLVM des Compilers behält sein eigenes
zlib; beide treffen nie in einer Binärdatei zusammen.

Weitere Voraussetzungen: CMake ≥ 3.28, ein C++23-Compiler, Boost ≥ 1.90,
toml++ 3.4.0 und die Qualitätswerkzeuge. OTP wird nur für optionale Audits und
die Neuerzeugung von Fixtures benötigt.
