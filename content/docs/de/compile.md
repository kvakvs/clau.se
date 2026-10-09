---
source: docs/compile.md
sourceCommit: 06042fa
sourceSha256: 6cf8b5c873d19e18501458078ca8c8ceb51da4da995693046af31ca5a78824b4
translatedAt: 2026-10-09
---
# Kompilierung

`clau` kompiliert Erlang/OTP-29-Module über LLVM zu verifiziertem IR, Bitcode
oder nativen Objekten. `-o/--output` linkt positionale Eingaben (oder ein
ausgewähltes Projektziel), ihr [Einstiegs](executables.md)-Startobjekt und die
Runtime zu einer ausführbaren Datei ([Linken](executables.md#linking));
Projekt-Builds linken ausführbare Ziele zu den Ausgaben ihres Manifests
([Projekte](projects.md#executables)). Erzeugte
Objekte können auch über ein C++-Harness laufen, das mit der Runtime gelinkt ist
(siehe Beispiel unten).

## Akzeptierte Teilmenge des Quelltexts

Benannte Module mit Exporten und geordneten Funktionsklauseln. Köpfe und Matches
im Rumpf akzeptieren Variablen, `_`, Aliase, wiederholte Namen und Muster über
Atome, beliebige Ganzzahlen, endliche Gleitkommazahlen, Tupel,
Listen/Zeichenketten, Maps, Bitstrings und gewöhnliche Tupel-Records. Rümpfe
sind Folgen von Matches, Konstruktoren, geprüften Operatoren/Guard-BIFs,
`erlang:display/1` ([Ausgabe](terms.md#printing)),
`halt/0,1` ([Exit-Status](executables.md#exit-status)), den auslösenden
`error/1,2,3`, `exit/1`, `throw/1` und `erlang:raise/3`
([ABI](abi.md#failure-channel-revision-2)), den übrigen
[Brücken-Builtins](builtins.md) (`erlang:function_exported/3`) und Funs von
Builtins, `case`/`if`, `catch Expr`,
`try ... of ... catch Class:Reason:Stack ... after` mit
[Stacktraces](abi.md#stack-traces), `maybe ... else ... end`, Listen-, Binary-
und Map-Comprehensions
([Muster](patterns.md#comprehensions)) sowie direkten lokalen oder
literalen entfernten Aufrufen innerhalb des Batches, einschließlich Selbst-,
wechselseitiger und modulübergreifender Rekursion auf expliziten Prozess-Frames
mit echten Endaufrufen (tail calls)
([Ausführungsmodell](execution-model.md#implementation)); Rumpfrekursion ist
durch den Prozess-Stack begrenzt (standardmäßig unbegrenzt), nicht durch den
nativen Stack. Guards unterstützen den vollständigen zugelassenen
Katalog. Siehe [Muster](patterns.md), [Guards](guards.md) und [Terme](terms.md).

Funktionswerte `fun F/A`, `fun M:F/A`, anonyme und benannte Funs mit
erfassten Variablen, Aufrufe von Funs und dynamische Aufrufe (`M:F(...)`,
`apply/2,3`) laufen ([Funs](funs.md)). Mit Diagnosen abgewiesen, selbst in
unbenutzten Funktionen:
`receive`, Funs von Builtins,
Prozesse und Nachrichtenaustausch.
Akzeptierte Attribute: `module`, `export`, `file`, Tupel- und native `record`,
`export_record`, `import_record`, Type/Spec-Formen,
`doc`/`moduledoc`, `author`, `vsn`, `copyright`, `deprecated`,
`-compile` mit `{no_auto_import, ...}` oder reinen Warnungsoptionen `nowarn_*`
(zum Beispiel `nowarn_deprecated_catch`) und `-import` von `erlang`-Guard-BIFs.
Andere Attribute (`on_load`, Parse-Transforms, andere
`compile`-Optionen, parametrisierte Module) werden abgewiesen.
Quellen, die mit `#!` beginnen, folgen den [Escript-Regeln](executables.md#escripts)
(implizites Modul und Export von `main/1`, `-mode` wird akzeptiert).
Type/Spec-Formen werden analysiert, ändern aber nie den generierten Code. Reine
Syntaxmodi (`--parse-check`, `--print-ast`, `--print-source`, ...) akzeptieren
die vollständige Grammatik.

## Das Beispiel mit kompilierten Modulen ausführen

`client:main/1` macht das Beispiel zu einem Programm:

```sh
./build/debug/bin/clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo     # prints 42, -7 and {record,map,binary,list,integer,other}
```

Dieselben Module laufen auch über ein C++-Harness. Aus einer Windows-x64-
Developer-PowerShell mit dem gebauten Compiler:

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
Einstiegspunkt. Unter Unix
`build/debug/bin/clau`, `clang++` und `-DGENERATED_DIR="$PWD/build/example-aot"`
verwenden (native Läufe sind dort noch nicht validiert).

Weitere Aktionen auf denselben Quellen:

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

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
- `SourceNotes` fügt einem Ausdruck eine Annotation hinzu, ausgegeben als
  `Expression :: Text` (in Klammern, außer es ist ein ganzer Rumpfausdruck; kein
  Erlang), sowie Kommentarzeilen über einer Form. Muster, Guards und die linke
  Seite eines Matches tragen keine.

## Optionen

| Option | Verhalten |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Ein Artefakt pro Modul veröffentlichen |
| `--artifact-dir DIR` | Artefaktwurzel (erfordert `--emit`) |
| `-o PATH` / `--output PATH` | Eine ausführbare Datei linken ([Linken](executables.md#linking)); kollidiert mit `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Clang-Treiber und Runtime-Archiv für `-o` |
| `--entry MODULE[:FUNCTION]` | Einstiegsfunktion/1 der ausführbaren Datei; wird in jedem Kompiliermodus validiert und fügt das Startartefakt `clausev1_start` hinzu ([ausführbare Dateien](executables.md#startup-object)) |
| `--target-triple TRIPLE` | Zielmaschine; `--target` ist die Auswahl des Projektziels |
| `-O0` / `-O2` / `-Os` | Generischer Standardcode + LLVM O0 / begrenzte Spezialisierung + LLVM O2 / LLVM Os, keine Spezialisierung, ein Abschnitt pro Symbol und Entfernen nicht referenzierten Codes und nicht referenzierter Daten durch den Linker |
| `--no-type-specialization` | Varianten unabhängig von der Optionsreihenfolge deaktivieren |
| `--print-ir` / `--print-optimized-ir` | Verifiziertes IR vor/nach den LLVM-Pässen, mit Erlang-Quelltextzeilen als Kommentaren |
| `--print-types` | Jedes Modul als Erlang-Quelltext, annotiert mit inferierten Typen ([Semantik](semantic.md#--print-types)); stoppt vor LLVM |
| `--verbose` | Phasenereignisse `[pp]`, `[parse]` und `[comp]` auf stderr |
| `--impldebug n[,n...]` | Debug-Ausgabe von Implementierungsschritten auf stderr (z. B. `23`: Inferenz-Zusammenfassungen) |

- Ohne `--emit` verifiziert die Kompilierung Objekte im Speicher und schreibt
  nichts.
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

## Backend

- Ein LLVM-Kontext und eine Zielmaschine pro Batch. Das Host-Triple verwendet
  Host-CPU und -Features; fremde Triples verwenden die generische CPU. PIC,
  kleines Codemodell.
- Backends: X86, ARM, AArch64 (Schnittmenge mit dem SDK). Unbekannte oder
  fehlende Backends schlagen fehl; es gibt keinen Rückfall auf den Host.
- Die Verifikation läuft vor und nach der Optimierung; sie prüft die Gültigkeit
  des IR, nicht die Korrektheit des Erlang-Codes.
- Budgets pro Ziel: 1.024 Module, 250.000 AST-Knoten pro Modul, 1.000.000 pro
  Batch. Serialisierte Ausgabe: 64 MiB pro Modul, 256 MiB pro Batch. Das
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

Referenz-Setup Windows x64 (2026-09-29): Host-clang-cl 23.1.2 in
`C:/Program Files/LLVM/bin`, SDK `thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`,
Visual-Studio-18-x64-Werkzeuge, Windows SDK 10.0.26100.0, Ninja, `/MT`,
`_ITERATOR_DEBUG_LEVEL=0`. Die automatische Auswahl wendet die Einstellungen für
`/MT` und Iteratoren an; ein explizites `LLVM_DIR` tut das nicht, und die
Link-Probe schlägt dann fehl.

Historische macOS-Referenz: Homebrew `llvm` 23.1.1_1 (arm64, gemeinsame
`libLLVM.23.1.dylib`, Assertions aus) mit AppleClang 21.

Weitere Voraussetzungen: CMake ≥ 3.28, ein C++23-Compiler, Boost ≥ 1.90, toml++
3.4.0 und die Qualitätswerkzeuge. OTP wird nur für optionale Audits und die
Neuerzeugung von Fixtures benötigt.
