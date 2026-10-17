---
source: docs/executables.md
sourceCommit: a8c3f8f6
sourceSha256: 70d36ba8e8c6b7bf8d1497635905c412b3fd8db8a36ef4ee8de8c1ee6f06f6ae
translatedAt: 2026-10-17
---
# Ausführbare Dateien

Vertrag für Programme, die mit `clau -o` oder einem Projekt-Build erstellt
werden. Positionelle Eingaben oder genau ein ausgewähltes Projektziel werden
zum `-o`-Pfad gelinkt; ein Projekt-Build linkt jedes ausgewählte ausführbare
Ziel zu seinem `output` im Manifest ([Linken](#linking),
[Projekte](projects.md#executables)).

## Auswahl des Einstiegspunkts

Der Einstiegspunkt ist eine exportierte Funktion der Stelligkeit 1, die die
Argumentliste erhält. Eine ausgewählte `FUNCTION` ohne `FUNCTION/1` darf
stattdessen ein exportiertes `FUNCTION/0` sein: Sie läuft ohne die
Programmargumente (Runtime-Optionen werden trotzdem herausgenommen). Ein Suffix
`/0` oder `/1` wählt nur diese Stelligkeit, sodass
`--entry benchmarks:run/0` auch dann `run/0` ausführt, wenn `run/1` ebenfalls
exportiert ist. Der Standard (keine Auswahl) ist immer `main/1`.

| Quelle | Schreibweise | Geltungsbereich |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION[/ARITY]]` | Positioneller Batch oder das einzige ausgewählte Projektziel |
| Manifest | `entry = "MODULE[:FUNCTION[/ARITY]]"` in einer `[[targets]]`-Tabelle | Dieses Ziel |
| Standard | Das einzige escript, sonst das einzige Modul, das `main/1` exportiert | Nur wenn eine ausführbare Datei angefordert wird (`-o` oder ein Projektziel mit `output`) |

- `FUNCTION` ist standardmäßig `main`. Namen sind Atomtext ohne
  Anführungszeichen: 1–255 Unicode-Skalare, gültiges UTF-8, keine Steuerzeichen
  und kein `:`. Ein abschließendes `/DIGITS` nach `FUNCTION` ist die
  Stelligkeit und muss `0` oder `1` sein; andere Schrägstriche bleiben Teil des
  Namens. Andere Schreibweisen sind Aufruffehler (CLI, Exit 2) oder
  Manifest-Fehler (Exit 1).
- Das gesamte Manifest wird dekodiert, daher scheitert ein fehlerhaftes `entry`
  auch in nicht ausgewählten Zielen ([Manifest](projects.md)).
- Das CLI-`--entry` überschreibt den Manifest-Schlüssel und verlangt genau ein
  ausgewähltes Ziel. Es steht im Konflikt mit Prüf-/Ausgabeaktionen und
  `--new-project`; diese Aktionen ignorieren `entry` im Manifest (wie sie
  `output` ignorieren).
- Ein expliziter Einstiegspunkt wird in jedem kompilierenden Modus (Standard,
  `--emit`, IR-/Typinspektion) zusammen mit den gewöhnlichen semantischen
  Diagnosen validiert.

| Fehler | Diagnose (Exit 1) |
| --- | --- |
| Modul nicht im Batch | `<origin>: entry module M is not among the compiled modules` (Herkunft: `--entry` oder Manifest `file:line:col [target t] (entry)`) |
| Weder `F/1` noch `F/0` | `<file>:<line>:<col>: entry function M:F/1 is not defined` an der Moduldeklaration |
| Explizites `F/A` fehlt | `... entry function M:F/A is not defined; found F/N` an einer gleichnamigen Definition, sonst an der Moduldeklaration |
| Nur andere Stelligkeiten | `... is not defined; found F/N, but the entry takes the argument list (FUNCTION/1) or nothing (FUNCTION/0)` an dieser Definition |
| `F/1` (sonst `F/0`) nicht exportiert | `<file>:<line>:<col>: entry function M:F/A is not exported` an der Definition |
| Keine Auswahl, kein Export von `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION[/ARITY]] (an exported FUNCTION/1, or FUNCTION/0 run without the program arguments; FUNCTION defaults to main, ARITY to 1, else 0)` |
| Keine Auswahl, mehrere | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (gleicher Hinweis) |

Für Projektziele nennt der Hinweis auch den Manifest-Schlüssel: `... --entry
MODULE[:FUNCTION[/ARITY]] or with entry = "MODULE[:FUNCTION[/ARITY]]" in this
target's [[targets]] table of the project manifest ...`, zum Beispiel:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1 (or app:start/0); "app:start/0" calls app:start/0; plain "app" calls app:main/1
```

## Argumente

`Entry(Argv)` erhält eine echte Liste von Strings (Listen von
Unicode-Codepoints), ohne den Programmnamen und die führenden
[Runtime-Optionen](#runtime-options), sonst unverändert und in Reihenfolge, wie
bei `escript`.

- POSIX: Die Bytes jedes Arguments werden als UTF-8 dekodiert; ein Byte, das
  keine gültige Sequenz beginnt, wird zum Codepoint dieses Bytes
  (Latin-1-Rückfall).
- Windows: der breite (UTF-16-)Argumentvektor der CRT, aufgeteilt nach denselben
  Regeln wie `argv`; ein ungepaartes Surrogat wird zu U+FFFD.
- Keine weitere Optionsauswertung, kein Globbing und keine Expansion von
  Umgebungsvariablen findet in der Runtime statt.

## Runtime-Optionen

Die Runtime liest ihre Optionen aus der Umgebungsvariable `CLAUSE_FLAGS`
(Wörter getrennt an Leerzeichen und Tabs, kein Quoting) und dann aus den
führenden Befehlszeilenargumenten, sodass die Befehlszeile gewinnt. Beide werden
gleich ausgewertet; ein Wert steht im nächsten Argument oder nach `=`.

| Option | Wirkung |
| --- | --- |
| `--max-atoms N` | Größe der Atomtabelle, 1 bis 2^26 (67.108.864); Standard 2^20 (1.048.576), wie `+t` von OTP |
| `--max-heap BYTES` | Obergrenze für Heap-Block, Fragmente und Off-Heap-Binaries jedes Prozesses, mindestens der minimale Heap (233 Wörter); standardmäßig unbegrenzt |
| `--max-stack BYTES` | Obergrenze für den Frame-Stack jedes Prozesses; standardmäßig unbegrenzt |
| `--min-heap-size WORDS` | Standard-`min_heap_size` jedes Prozesses, mindestens 1, aufgerundet auf eine Heap-Größe, wie `+hms` von OTP; höchstens `--max-heap`; Standard 233 ([Größenbemessung](runtime-heap.md#sizing-and-budget)) |
| `--max-memory BYTES` | Obergrenze für den Speicher aller Prozesse zusammen (Heaps, Off-Heap-Binaries, Stacks); standardmäßig unbegrenzt |
| `--schedulers N` | Scheduler-Worker, die Prozesse ausführen, 1 bis 1.024; Standard einer pro logischem Prozessor, wie `+S` von OTP ([Worker](processes.md#workers)) |
| `--profile FILE` | Schreibt beim Programmende einen Bericht über Eintritte und Eigenzeit pro Funktion und pro Prozess nach `FILE` ([Profiling](profiling.md)); standardmäßig aus |
| `--args-file FILE` | Optionsdatei wie `vm.args` von OTP: reserviert, meldet `runtime option --args-file is not implemented` |
| `--` | Beendet die Runtime-Optionen; alle folgenden Argumente gehen an `Entry` |

Auf der Befehlszeile endet die Auswertung beim ersten Argument, das keine
Runtime-Option ist, sodass `prog data --max-atoms 9` alle drei Argumente an das
Programm übergibt. In `CLAUSE_FLAGS` muss jedes Wort eine Runtime-Option sein.
Ein ungültiger Wert, ein Wort in der Variable, das keine Option ist, oder
`--args-file` stoppt das Programm, bevor irgendein Modul registriert ist:
`clau: runtime failure: <reason>`, Exit 70. Prozessanzahlen sind nicht begrenzt,
und Speicher ist standardmäßig unbegrenzt. Byte-Werte sind dezimal ohne Suffixe
und werden auf ganze Wörter abgerundet; ein Programm, das eine Obergrenze
erreicht, scheitert mit `resource_limit`, Exit 70
([Speichergrenze der Runtime](runtime-heap.md#runtime-memory-limit)).

## Exit-Status

| Ergebnis | Status |
| --- | --- |
| Einstiegspunkt kehrt zurück (beliebiger Wert) | 0 |
| `erlang:halt()` | 0 |
| `erlang:halt(N)`, nichtnegative Ganzzahl | `N` (POSIX-Hosts behalten die unteren 8 Bits) |
| `erlang:halt(Slogan)` mit einem String | Slogan auf stderr, dann 1 (kein Crash-Dump) |
| `erlang:halt(abort)` | Nativer Abbruch (kein Leeren der Puffer) |
| Jede Ausnahme, die den Einstiegspunkt verlässt, einschließlich `throw` und `exit(normal)` | Bericht auf stderr, 1 |
| Einstiegsprozess durch ein Exit-Signal beendet ([Prozesse](processes.md#exit-signals)) | Gemeldet als nicht abgefangenes `exit`, 1; Grund `normal`: 0 |
| Fehler beim Start der Runtime oder in der Infrastruktur (ABI-Abweichung, Registrierung, Speicher vor dem Einstieg) | Meldung auf stderr, 70 |
| Speicher des Hosts erschöpft (Wachstum von Heap, Off-Heap-Binary oder Stack verweigert; standardmäßig keine Speichergrenze, [Speichererschöpfung](runtime-heap.md#failure-behavior)) | `clau: runtime failure: entry call failed: out_of_memory`, 70 |

Ungültige Argumente von `halt/1` lösen im Aufrufer `badarg` aus. Endet der
Einstiegspunkt, beendet sich das Programm: Andere Prozesse werden gestoppt, ohne
weiterzulaufen, wie bei `halt/1` von OTP nach der Rückkehr von `escript`. Ein
Halt in einem beliebigen Prozess beendet das Programm mit dessen Status, und ein
Runtime-Fehler in einem beliebigen Prozess beendet es mit 70; eine Ausnahme in
einem gestarteten Prozess beendet nur diesen Prozess
([Prozesse](processes.md)).

`halt/0,1`, `error/1,2,3`, `exit/1` und `throw/1` sind mit oder ohne Präfix
`erlang:` aufrufbar; eine lokale Definition oder
`-compile({no_auto_import, ...})` hält den unqualifizierten Namen lokal, wie in
OTP. `halt/2` ist nicht verfügbar. `halt(N)` behält die unteren 31 Bits jeder
nichtnegativen Ganzzahl, wie OTP. Ein Slogan ist eine echte Liste von höchstens
1.023 Unicode-Codepoints. Ein Halt wickelt den Einstiegspunkt wie ein Fehler
über den geprüften Fehlerkanal ab, sodass er das Programm erst nach dem
erzeugten Aufräumen stoppt.

## Ausgabeströme

- stdout: Ausgabe von `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Gepuffert; geleert auf jedem Exit-Pfad außer `abort`.
- stderr: der Bericht über nicht abgefangene Ausnahmen, Ausgabe von
  `standard_error`, Runtime-Fehler und die Fehlerberichte anderer Prozesse, die
  abstürzen ([Prozesse](processes.md#exits)).
- Der Bericht ist eine Zeile `uncaught exception <class>: <reason in ~w form>`,
  ohne Stack-Frames. Sein genauer Text ist keine stabile Schnittstelle; Tests
  matchen ihn über Muster.

## Startobjekt

Kompilieren mit einem expliziten Einstiegspunkt (`--entry` oder `entry` im
Manifest) fügt nach den Modulen des Batches ein Startmodul hinzu. Mit `--emit`
wird es als `clausev1_start.{obj,o,ll,bc}` neben den Modulartefakten
veröffentlicht (der Name kann nicht mit einem Modulartefakt kollidieren). Es
enthält einen konstanten `abi::v1::StartupDescriptor`
([startup.hpp](../abi/include/clause/abi/startup.hpp)): ABI-Revision,
Term-Breite, jeden Moduldeskriptor in Quelltextreihenfolge, die Schreibweisen
von Einstiegsmodul und -funktion sowie ein escript-Flag. Sein
`int main(int, char **)` ruft `CLAUSE_main_v1` der Runtime auf, das:

1. Startdeskriptor und jeden Moduldeskriptor auf ABI-Revision und Breite prüft,
   bevor irgendetwas registriert wird; eine Abweichung endet mit 70.
2. Die Runtime startet und alle Module registriert; jeder Fehler stoppt vor dem
   Einstiegspunkt und verwirft die Runtime (Exit 70), sodass kein Erlang-Code
   gegen einen unvollständigen Batch läuft.
3. Den Einstiegsprozess erzeugt, argv aufbaut und den Aufruf von `M:F/1` als
   Hauptprozess einreiht, ihn dann zusammen mit jedem Prozess, den er startet,
   auf den Scheduler-Workern ([Prozesse](processes.md)) ausführt, bis er endet.
4. Das Ergebnis auf den obigen Exit-Status abbildet, Berichte nach dem Leeren
   von stdout ausgibt, dann jeden Prozess freigibt und die Runtime auf jedem
   Pfad herunterfährt (außer `halt(abort)`).

`clau -o` linkt diese Objekte selbst ([Linken](#linking)). Manuelles Linken
(das [Rezept für das native Harness](compile.md#run-the-compiled-module-example)
ohne Harness-Quelltext):

```powershell
& $tool --emit obj --entry app --artifact-dir build/app app.erl helper.erl
clang-cl /MT build/app/*.obj build/debug/lib/clause_runtime.lib /Fe:app.exe
```

Jedes Clang-kompatible Linken der Objekte mit `Clause::generated_program`
funktioniert genauso (siehe `tests/compiler/linking/startup.cmake`).

## Linken

`clau [-O0|-O2|-Os] -o PATH a.erl b.erl ...` (oder
`--project FILE [--target T] -o PATH` für ein ausgewähltes Ziel) kompiliert den
Batch im Speicher, fügt das Startobjekt für den
[Einstiegspunkt](#entry-selection) hinzu und linkt eine ausführbare Datei:

```sh
clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo          # build/demo.exe on Windows
```

`-Os` legt zusätzlich jede erzeugte und jede Runtime-Funktion und jedes
Datenobjekt in einen eigenen Abschnitt und linkt mit `--gc-sections` (ELF),
`-dead_strip` (Mach-O) oder `/OPT:REF /OPT:ICF` (MSVC), sodass Code, den kein
Einstiegspfad erreicht, entfernt wird.

`--lto` kompiliert die Module und das Startmodul zu LLVM-Bitcode statt zu
Objekten und linkt mit `-flto -fuse-ld=lld`, sodass LLD den erzeugten Code des
Programms als eine Einheit gegen das native Runtime-Archiv optimiert.
Modul- und Startdeskriptoren, exportierte Einstiegspunkte und `main` bleiben
referenziert und überleben; Programme verhalten sich wie ohne die Option. Nur
LLD liest den Bitcode dieses Compilers, daher wird `--lto` für Windows-MSVC- und
ELF-Ziele akzeptiert; andere scheitern vor dem Linken mit
`--lto is not supported for target <triple>: it needs LLD`. `--lto` braucht eine
ausführbare Ausgabe (`-o` oder einen linkenden Projekt-Build). Das installierte
Clang/LLD muss dasselbe LLVM-Release wie `clau` sein (23.1).

### Lebendigkeit von Exporten

Eine ausführbare Datei lässt die Exporte weg, die sie nicht erreichen kann,
sodass das Dead-Stripping von `-Os` und `--lto` Bibliothekscode entfernen, den
das Programm nie aufruft. Direkt nach der Auflösung der Aufrufe, vor der
Typinferenz, beginnt eine Analyse des ganzen Batches bei der Einstiegsfunktion
und markiert als lebendig alles, was eine lebendige Funktion direkt aufruft
(auch über `-import` und Auto-Importe von OTP), jedes `fun F/A` und literale
`fun M:F/A` sowie die literalen Ziele von `apply/3`, `spawn/3`, `spawn_link/3`,
`spawn_monitor/3`, `spawn_opt/4,5`, `spawn_request/3,5`, `hibernate/3` und
`make_fun/3` (jede Stelligkeit von `M:F`, wenn die Argumentliste nicht literal
ist), und `file:write/2`, sobald `io:format/3`, `io:fwrite/3`,
`io:put_chars/2` oder `io:nl/1` lebendig ist (ihre Builtins schreiben darüber
auf ein Prozessgerät). Sie bleibt konservativ:

- ein Modul, dessen Namensatom irgendwo in lebendigem Code als Wert verwendet
  wird (übergeben, gespeichert, gesendet, `?MODULE`, ein Record-Tag,
  `M:F(...)` mit einer Funktion zur Laufzeit, `fun M:F/A` mit einem Teil zur
  Laufzeit), behält jeden Export, was auch die Callbacks von per Namen
  gestarteten Behaviour-Modulen behält;
- sobald lebendiger Code sowohl einen Aufruf mit einem Modul zur Laufzeit
  (`M:F(...)`, `apply/3` oder ein Spawn mit variablem Modul, `fun M:F/A` mit
  variablem Modul, `binary_to_term/1,2`) als auch ein atomerzeugendes Builtin
  (`list_to_atom/1`, `list_to_existing_atom/1`, `binary_to_atom/1,2`,
  `binary_to_existing_atom/1,2`, `binary_to_term/1,2`, `fun_info/1,2`,
  `fun_info_mfa/1`, `process_info/1,2`, `loaded/0`, `pre_loaded/0`) enthält,
  bleibt jeder Export jedes Moduls.

Eine Funktion, die nichts Lebendiges erreicht, erhält überhaupt keinen Code. Ein
weggelassener Export behält seinen Namen in der Exporttabelle des Moduls ohne
Code, sodass `function_exported/3` und `module_info(exports)` antworten, als
wäre er exportiert, während ein dynamischer Aufruf, der ihn erreicht, `undef`
auslöst ([Unterschiede](differences.md#errors-stack-traces-and-reports)). Das
kann nur geschehen, wenn ein Modulname von außerhalb der Analyse stammt: aus
einem Stacktrace, einem Ausnahmeterm oder Daten von außerhalb des Programms.
`--verbose` protokolliert das Ergebnis pro Modul
(`phase=liveness detail="dropped-exports=3"` oder
`detail="kept-all-exports reason='m' is used as a value in main:main/1"`).

Eine Funktion, die nichts Lebendiges erreicht, wird auch nie typinferiert oder
gegen ihre `-spec` geprüft: Die Inferenz deckt nur lebendigen Code ab, was für
Programme schneller ist, die wenig von großen Bibliotheksmodulen nutzen, und die
Fakten lebendiger Funktionen nur einengen kann, da unerreichbare Aufrufer ihre
Argumente nicht mehr vereinigen. Eine Spezifikation, der nur unerreichbarer Code
widerspricht, wird daher für `--emit`-Artefakte gemeldet, aber nicht für die
ausführbare Datei.

`--keep-exports` (oder die Projektoption `keep_exports = true`) hält jeden
Export aufrufbar. Die Analyse gilt für ausführbare Dateien (`-o` oder ein
linkender Projekt-Build) und für IR- und Assembly-Inspektionen mit einem
Einstiegspunkt (`--entry` oder das Manifest-`entry` des Ziels), die dann den
Code der ausführbaren Datei zeigen; `--emit`-Artefakte, die für andere Programme
gedacht sind, behalten jeden Export.

`-g` behält Erlang-Zeilentabellen für Debugger: in der ausführbaren Datei (ELF)
oder in einer daneben veröffentlichten `<name>.pdb` (MSVC-Ziele)
([Debugging](debugging.md)).

- `PATH` ist relativ zum Aufruf. Für Windows-Ziele wird `.exe` angehängt, wenn
  der Dateiname keine Erweiterung hat. Sein Verzeichnis muss existieren.
- Linker: `--linker PATH` (ein Pfad oder Programmname), sonst `clang++` oder
  `clang` aus `PATH`, dann (Windows) `%ProgramFiles%/LLVM/bin`. Er läuft als
  `<clang> --driver-mode=g++ --target=<triple> -o <staged> <objects> <runtime>`,
  sodass Clang den Plattform-Linker und die C/C++-Runtime-Bibliotheken wählt
  (unter Windows findet es MSVC und das SDK selbst; keine Developer-Shell
  nötig).
- Runtime: `--runtime-library PATH`, sonst das Archiv `clause_runtime` des
  Builds, der `clau` erzeugt hat (Pfad relativ zur ausführbaren Datei
  gespeichert, z. B. `bin/../lib/clause_runtime.lib`). Jedes native Objekt im
  Archiv muss zu Architektur und Objektformat des Ziels passen;
  `--target-triple` für ein anderes Ziel braucht daher eine dafür gebaute
  Runtime.
- Objekte und die ausführbare Datei werden in einem privaten Verzeichnis
  `.clause-link-*` neben der Ausgabe bereitgestellt, das danach entfernt wird;
  es bleibt dort und nicht im [Build-Verzeichnis](projects.md#build-directory),
  weil die abschließende Umbenennung keine Laufwerksgrenzen überschreiten darf.
  Die Ausgabe wird erst nach einem erfolgreichen Linken ersetzt, sodass jeder
  Fehler eine vorhandene Datei unverändert lässt. Die Ausgabe darf kein
  Verzeichnis sein und keine Eingabe überdecken.
- Linker-Warnungen werden an stderr weitergereicht; `--linker` und
  `--runtime-library` verlangen `--output` oder einen linkenden Projekt-Build.
- Projekt-Builds ohne `-o` linken jedes ausgewählte Ziel, das `output` oder
  `entry` hat, zu seiner Ausgabe im Manifest, legen fehlende Verzeichnisse an
  und ersetzen die Ausgaben erst, nachdem alle ausgewählten Ziele gelinkt wurden
  ([Projekte](projects.md#executables)).

| Fehler (Exit 1) | Diagnose |
| --- | --- |
| Kein Clang | `cannot find clang++ or clang on PATH; install LLVM/Clang or pass --linker` / `linker not found: X` |
| Keine Runtime | `runtime library not found: P; build the clause_runtime target or pass --runtime-library` |
| Kein Archiv | `runtime library is not a static library: P: ...` |
| Falsches Ziel | `runtime library P contains x86_64 coff objects, but the executable targets T; ...` |
| Link-Fehler | `linking O failed: <clang> exited with status N:`, gefolgt von der Ausgabe des Linkers (erste 64 KiB) |
| Ungültiges Ziel | `output directory does not exist: D`, `artifact destination is not a regular file: O`, `artifact destination aliases an input: O` |

## Escripts

Eine Quelldatei, deren erste Zeile mit `#!` beginnt, wird als escript
kompiliert, in jedem Modus und mit jedem Dateinamen (positionelle Eingaben oder
`.erl`-Dateien eines Projekts). Die Regeln folgen `escript` aus OTP 29 für
Quelltext-Skripte:

- Die `#!`-Zeile wird ignoriert. Ein optionaler Kommentar in Zeile 2 und eine
  Emulator-Zeile `%%!` (Zeile 2 oder Zeile 3 nach dem Kommentar) sind
  Kommentare; `%%!`-Argumente können nicht auf kompilierten Code angewendet
  werden und erzeugen eine Warnung.
- Ist die erste Form nicht `-module(...)`, heißt das Modul
  `<file name with '.' replaced by '_'>__escript` (`?MODULE` eingeschlossen).
  OTP fügt einen Zeitstempel/eindeutigen Suffix hinzu; Clause hält den Namen
  deterministisch. Die synthetisierte Deklaration belegt Zeile 1, sodass
  spätere Zeilennummern unverändert bleiben.
- `main/1` ist erforderlich (`escript does not define main/1`) und implizit
  exportiert; andere Funktionen folgen den normalen Exportregeln.
- `-mode(compile | interpret | debug | native)` wird akzeptiert und ignoriert;
  andere Werte sind Fehler. Außerhalb von escripts bleibt `-mode` nicht
  unterstützt.
- Einstiegspunkt: Ohne `--entry` ist das einzige escript im Batch der
  Einstiegspunkt (es gewinnt gegenüber Modulen, die `main/1` exportieren);
  mehrere escripts sind mehrdeutig.
- Exit-Status wie bei `escript` von OTP: Eine Ausnahme, die den
  escript-Einstiegspunkt verlässt, endet mit 127 und
  `escript: exception <class>: <reason>` auf stderr; die übrigen Zeilen der
  Exit-Status-Tabelle gelten unverändert.
- Dateien ohne `#!` sind gewöhnliche Module. (OTPs `escript file.erl` würde
  ihre erste Zeile überspringen; Clause tut das nicht.) Vorkompilierte Beam-
  und Archiv-escripts werden nicht unterstützt.

## Vergleich mit OTP

Goldens für [Programm-Fixtures](../tests/fixtures/programs/README.md) führen den
Einstiegspunkt unter OTP mit denselben Regeln aus
([Orakel](../tests/compiler/programs/oracle.escript)); dasselbe Orakel erzeugt
die [Golden-Fälle für ausführbare Dateien](../tests/fixtures/executables/README.md),
die der End-to-End-Runner unter jeder Policy linkt und ausführt. Unterschiede zu
`escript` für gewöhnliche Module: Nicht abgefangene Ausnahmen enden mit 1 statt
127, und `main/1` muss exportiert sein. Escript-Quelltexte behalten die Regeln
von OTP (siehe oben).
