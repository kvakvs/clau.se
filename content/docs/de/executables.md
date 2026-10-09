---
source: docs/executables.md
sourceCommit: 06042fa
sourceSha256: aaec2d5d2a83da50b160d09c8b37ecf1648199279e5aed4b35ef794633bf589a
translatedAt: 2026-10-09
---
# Ausführbare Dateien

Vertrag für Programme, die mit `clau -o` oder einem Projekt-Build erstellt
werden. Positionelle Eingaben oder genau ein ausgewähltes Projektziel werden
zum `-o`-Pfad gelinkt; ein Projekt-Build linkt jedes ausgewählte ausführbare
Ziel zu seinem `output` im Manifest ([Linken](#linking),
[Projekte](projects.md#executables)).

## Auswahl des Einstiegspunkts

Der Einstiegspunkt ist eine exportierte Funktion der Stelligkeit 1, die die
Argumentliste erhält.

| Quelle | Schreibweise | Geltungsbereich |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION]` | Positioneller Batch oder das einzige ausgewählte Projektziel |
| Manifest | `entry = "MODULE[:FUNCTION]"` in einer `[[targets]]`-Tabelle | Dieses Ziel |
| Standard | Das einzige escript, sonst das einzige Modul, das `main/1` exportiert | Nur wenn eine ausführbare Datei angefordert wird (`-o` oder ein Projektziel mit `output`) |

- `FUNCTION` ist standardmäßig `main`. Namen sind Atomtext ohne
  Anführungszeichen: 1–255 Unicode-Skalare, gültiges UTF-8, keine
  Steuerzeichen und kein `:`. Andere Schreibweisen sind Aufruffehler (CLI,
  Exit 2) oder Manifest-Fehler (Exit 1).
- `entry` ist ein optionaler Schlüssel des Schemas 1; ältere Manifeste bleiben
  gültig. Das gesamte Manifest wird dekodiert, daher scheitert ein fehlerhaftes
  `entry` auch in nicht ausgewählten Zielen.
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
| Kein `F/1` | `<file>:<line>:<col>: entry function M:F/1 is not defined` an der Moduldeklaration |
| Nur andere Stelligkeiten | `... is not defined; found F/N, but the entry receives one argument (the argument list)` an dieser Definition |
| `F/1` nicht exportiert | `<file>:<line>:<col>: entry function M:F/1 is not exported` an der Definition |
| Keine Auswahl, kein Export von `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION] (an exported FUNCTION/1; FUNCTION defaults to main)` |
| Keine Auswahl, mehrere | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (gleicher Hinweis) |

Für Projektziele nennt der Hinweis auch den Manifest-Schlüssel: `... --entry MODULE[:FUNCTION] or with
entry = "MODULE[:FUNCTION]" in this target's [[targets]] table of the project manifest ...`, zum Beispiel:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1; plain "app" calls app:main/1
```

## Argumente

`Entry(Argv)` erhält eine echte Liste von Strings (Listen von
Unicode-Codepoints), ohne den Programmnamen und die führenden
[Runtime-Optionen](#runtime-options), sonst unverändert und in Reihenfolge, wie
bei `escript`.

- POSIX: Die Bytes jedes Arguments werden als UTF-8 dekodiert; ein Byte, das
  keine gültige Sequenz beginnt, wird zum Codepoint dieses Bytes
  (Latin-1-Rückfall).
- Windows: der breite (UTF-16-)Argumentvektor der CRT, aufgeteilt nach
  denselben Regeln wie `argv`; ein ungepaartes Surrogat wird zu U+FFFD.
- Keine weitere Optionsauswertung, kein Globbing und keine Expansion von
  Umgebungsvariablen findet in der Runtime statt.

## Runtime-Optionen

Die Runtime liest ihre Optionen aus der Umgebungsvariable `CLAUSE_FLAGS`
(Wörter getrennt an Leerzeichen und Tabs, kein Quoting) und dann aus den
führenden Befehlszeilenargumenten, sodass die Befehlszeile gewinnt. Beide
werden gleich ausgewertet; ein Wert steht im nächsten Argument oder nach `=`.

| Option | Wirkung |
| --- | --- |
| `--max-atoms N` | Größe der Atomtabelle, 1 bis 2^26 (67.108.864); Standard 2^20 (1.048.576), wie `+t` von OTP |
| `--max-heap BYTES` | Obergrenze für Heap-Block, Fragmente und Off-Heap-binaries jedes Prozesses, mindestens der minimale Heap (233 Wörter); standardmäßig unbegrenzt |
| `--max-stack BYTES` | Obergrenze für den Frame-Stack jedes Prozesses; standardmäßig unbegrenzt |
| `--max-memory BYTES` | Obergrenze für den Speicher aller Prozesse zusammen (Heaps, Off-Heap-binaries, Stacks); standardmäßig unbegrenzt |
| `--schedulers N` | Scheduler-Worker, die Prozesse ausführen, 1 bis 1.024; Standard einer pro logischem Prozessor, wie `+S` von OTP ([Worker](processes.md#workers)) |
| `--args-file FILE` | Optionsdatei wie `vm.args` von OTP: reserviert, meldet `runtime option --args-file is not implemented` |
| `--` | Beendet die Runtime-Optionen; alle folgenden Argumente gehen an `Entry` |

Auf der Befehlszeile endet die Auswertung beim ersten Argument, das keine
Runtime-Option ist, sodass `prog data --max-atoms 9` alle drei Argumente an das
Programm übergibt. In `CLAUSE_FLAGS` muss jedes Wort eine Runtime-Option sein.
Ein ungültiger Wert, ein Wort in der Variable, das keine Option ist, oder
`--args-file` stoppt das Programm, bevor irgendein Modul registriert ist:
`clau: runtime failure: <reason>`, Exit 70. Prozessanzahlen sind nicht begrenzt,
und Speicher ist standardmäßig unbegrenzt. Byte-Werte sind dezimal ohne
Suffixe und werden auf ganze Wörter abgerundet; ein Programm, das eine
Obergrenze erreicht, scheitert mit `resource_limit`, Exit 70
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
| Speicher des Hosts erschöpft (Wachstum von Heap, Off-Heap-binary oder Stack verweigert; standardmäßig keine Speichergrenze, [Speichererschöpfung](runtime-heap.md#failure-behavior)) | `clau: runtime failure: entry call failed: out_of_memory`, 70 |

Ungültige Argumente von `halt/1` lösen im Aufrufer `badarg` aus. Endet der
Einstiegspunkt, beendet sich das Programm: Andere Prozesse werden gestoppt,
ohne weiterzulaufen, wie bei `halt/1` von OTP nach der Rückkehr von `escript`.
Ein Halt in einem beliebigen Prozess beendet das Programm mit dessen Status,
und ein Runtime-Fehler in einem beliebigen Prozess beendet es mit 70; eine
Ausnahme in einem gestarteten Prozess beendet nur diesen Prozess
([Prozesse](processes.md)).

`halt/0,1`, `error/1,2,3`, `exit/1` und `throw/1` sind mit oder ohne Präfix
`erlang:` aufrufbar; eine lokale Definition oder
`-compile({no_auto_import, ...})` hält den unqualifizierten Namen lokal, wie in
OTP. `halt/2` ist nicht verfügbar.
`halt(N)` behält die unteren 31 Bits jeder nichtnegativen Ganzzahl, wie OTP.
Ein Slogan ist eine echte Liste von höchstens 1.023 Unicode-Codepoints. Ein
Halt wickelt den Einstiegspunkt wie ein Fehler über den geprüften Fehlerkanal
ab, sodass er das Programm erst nach dem erzeugten Aufräumen stoppt.

## Ausgabeströme

- stdout: Ausgabe von `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Gepuffert; geleert auf jedem Exit-Pfad außer `abort`.
- stderr: der Bericht über nicht abgefangene Ausnahmen, Ausgabe von
  `standard_error`, Runtime-Fehler und die Fehlerberichte anderer Prozesse, die
  abstürzen ([Prozesse](processes.md#exits)).
- Der Bericht ist eine Zeile `uncaught exception <class>: <reason in ~w form>`,
  später gefolgt von Stack-Frames (step 15). Sein genauer Text ist keine stabile
  Schnittstelle; Tests matchen ihn über Muster.

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

1. Startdeskriptor und jeden Moduldeskriptor auf ABI-Revision und Breite
   prüft, bevor irgendetwas registriert wird; eine Abweichung endet mit 70.
2. Die Runtime startet und alle Module registriert; jeder Fehler stoppt vor
   dem Einstiegspunkt und verwirft die Runtime (Exit 70), sodass kein
   Erlang-Code gegen einen unvollständigen Batch läuft.
3. Den Einstiegsprozess erzeugt, argv aufbaut und den Aufruf von `M:F/1` als
   Hauptprozess einreiht, ihn dann zusammen mit jedem Prozess, den er startet,
   auf dem kooperativen Executor ([Prozesse](processes.md)) ausführt, bis er
   endet.
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

`clau [-O0|-O2|-Os] -o PATH a.erl b.erl ...` (oder `--project FILE [--target T] -o PATH`
für ein ausgewähltes Ziel) kompiliert den Batch im Speicher, fügt das
Startobjekt für den [Einstiegspunkt](#entry-selection) hinzu und linkt eine
ausführbare Datei:

```sh
clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo          # build/demo.exe on Windows
```

`-Os` legt zusätzlich jede erzeugte und jede Runtime-Funktion und jedes
Datenobjekt in einen eigenen Abschnitt und linkt mit `--gc-sections` (ELF),
`-dead_strip` (Mach-O) oder `/OPT:REF /OPT:ICF` (MSVC), sodass Code, den kein
Einstiegspfad erreicht, entfernt wird.

- `PATH` ist relativ zum Aufruf. Für Windows-Ziele wird `.exe` angehängt, wenn
  der Dateiname keine Erweiterung hat. Sein Verzeichnis muss existieren.
- Linker: `--linker PATH` (ein Pfad oder Programmname), sonst `clang++` oder
  `clang` aus `PATH`, dann (Windows) `%ProgramFiles%/LLVM/bin`. Er läuft als
  `<clang> --driver-mode=g++ --target=<triple> -o <staged> <objects> <runtime>`,
  sodass Clang den Plattform-Linker und die C/C++-Runtime-Bibliotheken wählt
  (unter Windows findet es MSVC und das SDK selbst; keine Entwickler-Shell
  nötig).
- Runtime: `--runtime-library PATH`, sonst das Archiv `clause_runtime` des
  Builds, der `clau` erzeugt hat (Pfad relativ zur ausführbaren Datei
  gespeichert, z. B. `bin/../lib/clause_runtime.lib`). Jedes native Objekt im
  Archiv muss zu Architektur und Objektformat des Ziels passen;
  `--target-triple` für ein anderes Ziel braucht daher eine dafür gebaute
  Runtime.
- Objekte und die ausführbare Datei werden in einem privaten Verzeichnis
  `.clause-link-*` neben der Ausgabe bereitgestellt, das danach entfernt wird.
  Die Ausgabe wird erst nach einem erfolgreichen Linken ersetzt, sodass jeder
  Fehler eine vorhandene Datei unverändert lässt. Die Ausgabe darf kein
  Verzeichnis sein und keine Eingabe überdecken.
- Linker-Warnungen werden an stderr weitergereicht; `--linker` und
  `--runtime-library` verlangen `--output` oder einen linkenden Projekt-Build.
- Projekt-Builds ohne `-o` linken jedes ausgewählte Ziel, das `output` oder
  `entry` hat, zu seiner Ausgabe im Manifest, legen fehlende Verzeichnisse an
  und ersetzen die Ausgaben erst, nachdem alle ausgewählten Ziele gelinkt
  wurden ([Projekte](projects.md#executables)).

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

Goldens für [Programm-Fixtures](../tests/fixtures/programs/README.md) führen
den Einstiegspunkt unter OTP mit denselben Regeln aus
([Orakel](../tests/compiler/programs/oracle.escript)); dasselbe Orakel erzeugt
die [Golden-Fälle für ausführbare Dateien](../tests/fixtures/executables/README.md),
die der End-to-End-Runner unter jeder Policy linkt und ausführt. Unterschiede
zu `escript` für gewöhnliche Module: Nicht abgefangene Ausnahmen enden mit 1
statt 127, und `main/1` muss exportiert sein. Escript-Quelltexte behalten die
Regeln von OTP (siehe oben).
