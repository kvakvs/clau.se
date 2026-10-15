---
source: docs/usage.md
sourceCommit: 6ed3851c
sourceSha256: d4118cc040e610cc84df916720e96a6009b90b6a1cbfe086434dc5800fe49461
translatedAt: 2026-10-15
---
# Den Compiler verwenden

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

Unter macOS baut `./run-macos.sh --parse-check examples/project/src/main.erl`
zuerst und führt dann die neueste ausführbare Datei aus, wobei alle Argumente
unverändert weitergereicht werden. Es akzeptiert die Umgebungsvariablen
`TOOL_BUILD_DIR`, `BUILD_TYPE` und `JOBS` als Überschreibungen.

```text
clau [options] <source.erl>...
  --project <path>        Read a TOML project instead of positional sources
  --target <name>         Select a target; repeat for more (default: all)
  --new-project <filename>  Create an annotated starter; append .toml when needed
  --preprocess-check       Check preprocessing only
  --parse-check            Preprocess and check syntax
  --print-pp               Print expanded Erlang source
  --print-ast              Print an indented syntax tree
  --print-source           Print each module as Erlang source
  --print-abstr            Print each module as OTP abstract format forms
  --parse-transform <mod>  Apply a parse transform to every module
  --transform-path <dir>   Directory of precompiled transform modules (.beam)
  --erl <path|none>        Host Erlang/OTP 29 erl that runs parse transforms
  --print-inputs           List the batch's sources, including modules added by reference; do not compile
  --print-env              Print the resolved compile environment as TOML and exit
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --print-asm              Print each module's assembly with IR and Erlang source comments
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  -g                      Emit Erlang line tables; executables keep them for debuggers
  --lto                   Link modules as bitcode with link-time optimization (LLD targets)
  --keep-exports          Keep every export of an executable callable (default: unreachable ones left out)
  --build-dir <dir>       Keep temporary files and caches below <dir> (projects default: <manifest-dir>/build)
  --no-cache              Neither read nor write build caches
  --cache-inference-in-dirs <pattern>  Cache inference results of modules in matching directories (besides OTP's)
  --verbose               Trace files and compilation phases to stderr
  --print-stage-times     Print preprocess/parse/transform time per file, compile time per batch and link time to stderr
  -I, --include <dir>      Add an include directory (last supplied searched first)
  -D, --define <name[=term]>  Define a macro (default value: true)
  --app-dir <app=dir>      Set an include_lib application directory
  --enable-feature <name>  Enable a language feature
  --disable-feature <name> Disable a language feature
  -h, --help              Show all options
  --version               Show version
  --                      Treat remaining arguments as input paths
```

Pfade mit Leerzeichen und Makrowerte mit Shell-Satzzeichen in Anführungszeichen
setzen:

```sh
./build/debug/bin/clau --parse-check -I include '-DVERSION={1,0}' \
  --app-dir myapp=examples/project examples/project/src/main.erl
```

Prüfmodi sind bei Erfolg still; Diagnosen gehen nach stderr. Ausgabemodi
schreiben nach stdout und lassen sich kombinieren: `--print-pp --print-ast` gibt
für jede Eingabe den Quelltext vor dem Baum aus. Das Hinzufügen von
`--preprocess-check` deaktiviert nicht das Parsen, das `--parse-check` oder
`--print-ast` anfordern. Fehler können eine unvollständige Ausgabe hinterlassen.

Ohne Prüf-/Ausgabeaktion durchlaufen Quelleingaben und `--project` die
vollständige Pipeline bis zu verifizierten nativen Objektpuffern im Speicher.
Positionale Eingaben bilden einen Batch; jedes Projektziel bildet einen eigenen
Batch. `--emit` schreibt Artefakte unter `build/aot` oder `--artifact-dir`;
Projekte hängen einen kodierten Zielnamen an und verwenden eine
manifest-relative Standardwurzel. Dateinamen kodieren die Identität des Moduls.
`-o PATH` linkt positionale Eingaben oder ein ausgewähltes Projektziel mit Clang
und der Runtime-Bibliothek zu einer ausführbaren Datei (Einstieg:
`--entry MODULE[:FUNCTION]`, Manifest-`entry` oder das einzige Modul, das
`main/1` exportiert). Ohne `-o` werden Projektziele mit einem Schlüssel `output`
oder `entry` zu ihrem TOML-`output` gelinkt (Standard `build/<target>`), wobei
erst veröffentlicht wird, nachdem jedes ausgewählte Ziel gelinkt wurde.
Den Vertrag für Einstieg, Argumente und Exit-Status beschreibt
[ausführbare Dateien](executables.md).

```sh
clau -O2 -o demo answer.erl client.erl && ./demo
clau -O2 --emit obj answer.erl client.erl
clau --print-ir --print-optimized-ir -O2 answer.erl
clau --print-asm -O2 answer.erl
clau --print-types answer.erl client.erl
```

Die IR-Inspektion erlaubt beide Stufen zusammen und stoppt vor der Ausgabe von
Objekten. Mehrere Snapshots sind separate Module; für einzelne Assembly-Dateien
`--emit llvm-ir` verwenden.
`--print-asm` gibt die Ziel-Assembly jedes Moduls aus, wobei jede Folge von
Instruktionen mit der IR-Instruktion und der Erlang-Zeile kommentiert ist, aus
der sie stammt ([Assembly-Listings](compile.md#assembly-listings)).
Die Typinspektion stoppt vor LLVM und gibt jedes
Modul als Quelltext mit inferierten Funktionssignaturen und nachgestellten
Kommentaren `% Type` am äußersten Ausdruck jeder Zeile aus. Sie akzeptiert Präprozessor-, Projekt- und
Ausführlichkeitsoptionen, weist aber andere Aktionen, Ausgabeziele und
Backend-Einstellungen ab. Siehe [Kompilieroptionen](compile.md).

`--verbose` gibt `[pp] <filename>` für Quelldateien und aufgelöste
Präprozessor-Includes aus sowie `[parse] <filename>`, wenn eine Quelle in den
Parser eintritt. Verschachtelte und Bibliotheks-Includes werden beim Laden
protokolliert; inaktive Includes werden übersprungen. Der Parser verarbeitet
expandierte Tokens inkrementell, daher kann sein Trace vor Include-Traces
erscheinen. `[comp]` ergänzt semantische und Backend-Phasen sowie begrenzte
Spezialisierungsentscheidungen, sobald sie beginnen. Die Protokollierung geht in
jedem Modus nach stderr, auch bei Projekten.

`--print-stage-times` gibt `[time] <stage> <subject>: <milliseconds> ms` auf
stderr aus, sobald jede Stufe endet: `preprocess` (Lesen und Präprozessor),
`parse` und, für Module mit Parse-Transforms, `transform` (der Lauf des
Host-`erl` und der Import seiner Formen) pro Quelldatei, `compile` (Analyse bis
zur Objektausgabe) einmal pro Batch, mit Angabe der Modulanzahl und des
Projektziels, und `link` pro ausführbarer Datei, mit Angabe ihres endgültigen
Pfads. Der Parser zieht Formen aus dem Präprozessor, daher werden die beiden
Zeiten pro Datei getrennt gemessen, während sie sich abwechseln.

Exit-Codes: **0** bei Erfolg (auch mit Warnungen), **1** bei Quell- oder
Projektfehlern, **2** bei Verwendungsfehlern oder unbekannten Zielnamen.
Jede Eingabe hat einen unabhängigen Präprozessorzustand; jeder Quellfehler lässt
den gesamten Befehl fehlschlagen.

Syntaxprüfungen validieren keine Semantik und führen keine Parse-Transforms
aus. Prüf-/Ausgabemodi erzeugen keine Ausgabedateien und weisen
`-o`/`--output` ab. Die Standardkompilierung ohne `-o` schreibt keine
ausführbare Datei.

Weitere Details unter [Präprozessor](preprocessor.md),
[Verwendung des Parsers](parser.md) und
[Validierungsstatus](validation.md).

## Projekte

Das enthaltene Beispiel mit zwei Zielen ausführen:

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target app
./build/debug/bin/clau --preprocess-check --project examples/project/project.toml --target tests --target app
```

Ein kommentiertes Projekt in einem vorhandenen Verzeichnis erstellen:

```sh
mkdir -p build/project-demo
./build/debug/bin/clau --new-project build/project-demo/demo
mkdir -p build/project-demo/src
cp examples/project/src/main.erl build/project-demo/src/main.erl
./build/debug/bin/clau --parse-check --project build/project-demo/demo.toml
```

Die Erstellung schreibt nur die angeforderte TOML-Datei und verweigert
vorhandene Ziele. Die Vorlage enthält ein Ziel `app`, das `src` verwendet, mit
allen Frontend-Optionen auf ihren Standardwerten. Vor dem Prüfen Quelldateien
hinzufügen.

Manifestpfade sind relativ zur TOML-Datei; CLI-Pfade sind relativ zum
Aufrufverzeichnis. Standardmäßig laufen alle Ziele. `--target` wiederholen, um
eine geordnete Teilmenge zu wählen; wiederholte Auswahlen laufen einmal.
`sources` unterstützt literale Dateinamen und die Muster `*`, `?`, `**`;
`source_dirs` findet `.erl`-Dateien rekursiv. Quell-Suchpfade finden nur
explizit aufgeführte Dateien. CLI-Include-Pfade haben Vorrang,
CLI-Anwendungswurzeln ersetzen gleichnamige, CLI-Feature-Einstellungen gelten
zuletzt, und doppelte Makrodefinitionen bleiben Fehler.

Siehe [Projektformat und Arbeitsabläufe](projects.md). Projekte unterstützen
jede CLI-Aktion; die Erzeugung ausführbarer Dateien bleibt unimplementiert.

Der [zugelassene Guard-Katalog](guards.md) umfasst geprüftes
`is_integer/3`, qualifizierte Aufrufe und veraltete Tests auf oberster Ebene;
Prozess-/Knoten-Identitäten und Identitäten nativer Records behalten explizite
Capability-Diagnosen.
