---
source: docs/usage.md
sourceCommit: a8c3f8f6
sourceSha256: 06562916f7abbce822d9a5ca87d42cc0b3306de611e06ebce33ca5b2bd10d101
translatedAt: 2026-10-17
---
# Den Compiler verwenden

Ein Programm aus Quelltexten bauen; der Einstieg ist das einzige Modul, das
`main/1` exportiert, und erhält die Kommandozeilenargumente als Strings:

```sh
clau -O2 -o demo examples/compile/answer.erl examples/compile/client.erl
./demo
clau -o app --entry app:start src/*.erl     # app:start/1, else app:start/0
```

Unter Windows hängt `-o` die Endung `.exe` an, wenn der Pfad keine Endung hat.
Ohne `-o` werden positionale Eingaben im Speicher kompiliert und melden nur
Diagnosen. Einstiegswahl, Argumente, Exit-Status und Linken beschreibt
[ausführbare Dateien](executables.md); [das Beispiel mit kompilierten
Modulen](../examples/compile/) zeigt einen C++-Host, der die ausgegebenen
Objekte selbst linkt.

Projekte beschreiben Ziele in TOML; jedes Ziel mit einem Schlüssel `output`
oder `entry` wird zu seiner Ausgabe gelinkt (Standard `build/<target>`), und
Ausgaben werden erst ersetzt, nachdem jedes ausgewählte Ziel erfolgreich war:

```sh
clau --new-project myapp                        # writes an annotated myapp.toml
clau --project myapp.toml                       # build every target
clau --project examples/project/project.toml --target app --parse-check
```

Manifest, Quellsuche, ignorierte Quellen, Build-Verzeichnisse und Caches
beschreibt [Projekte](projects.md).

Häufige Optionen (`clau --help` listet alle auf):

| Option | Zweck |
| --- | --- |
| `-o, --output PATH`, `--entry M[:F[/A]]` | Eine ausführbare Datei linken und ihren Einstieg wählen |
| `--project PATH`, `--target NAME` | Ein TOML-Projekt oder ausgewählte Ziele bauen |
| `-O0`, `-O2`, `-Os`, `--no-type-specialization` | Optimierung (Standard O0; O2 ergänzt Typspezialisierung) |
| `-g`, `--lto`, `--keep-exports` | Debug-Zeilentabellen, Link-Time-Optimierung, unerreichbare Exporte behalten |
| `-I DIR`, `-D NAME[=TERM]`, `--app-dir APP=DIR` | Include-Pfade, Makros, Wurzeln für `include_lib` |
| `--enable-feature F`, `--disable-feature F` | Sprach-Features von OTP |
| `--parse-transform M`, `--transform-path DIR`, `--erl PATH\|none` | Parse-Transforms und das Host-OTP, das sie ausführt |
| `--emit obj\|llvm-ir\|llvm-bc`, `--artifact-dir DIR` | Ein Artefakt pro Modul schreiben (Standardwurzel `build/aot`) |
| `--target-triple TRIPLE`, `--linker PATH`, `--runtime-library PATH` | Ziel, Link-Treiber und Runtime-Archiv |
| `--build-dir DIR`, `--no-cache`, `--cache-inference-in-dirs PAT` | Temporäre Dateien und Build-Caches |
| `--verbose`, `--print-stage-times` | Phasen verfolgen; jede Stufe auf stderr zeitmessen |

Inspektionsaktionen geben auf stdout aus und kompilieren keine ausführbaren
Dateien:

| Option | Ausgabe |
| --- | --- |
| `--preprocess-check`, `--parse-check` | Nichts; nur Diagnosen |
| `--print-pp`, `--print-ast`, `--print-source`, `--print-abstr` | Vorverarbeiteter Quelltext, Syntaxbaum, Quelltext, abstraktes Format von OTP |
| `--print-inputs` | Jede Quelle des Batches, einschließlich per Referenz hinzugefügter Bibliotheksmodule |
| `--print-env` | Die aufgelöste Kompilierumgebung als TOML |
| `--print-types` | Quelltext, annotiert mit inferierten Typen |
| `--print-ir`, `--print-optimized-ir`, `--print-asm` | IR vor/nach der LLVM-Optimierung, Assembly mit IR- und Erlang-Kommentaren |

`clau` endet mit 0 bei Erfolg (auch mit Warnungen), 1 bei Quell- oder
Projektfehlern und 2 bei Verwendungsfehlern. Details:
[Kompilierung](compile.md), [Präprozessor](preprocessor.md),
[Parser](parser.md).

Parse-Transforms (`-compile({parse_transform, M})`) laufen auf einem auf dem
Host installierten Erlang/OTP 29 (`erl` im `PATH` oder `--erl`), wie bei
`erlc`; nur die Kompilierung braucht OTP, nie die ausführbare Datei.
Transforms außer denen von OTP selbst müssen zuerst zu `.beam` kompiliert
werden ([Parse-Transforms](transforms.md)).

### Runtime-Optionen

Programme lesen Runtime-Optionen aus der Umgebungsvariablen `CLAUSE_FLAGS` und
aus führenden Kommandozeilenargumenten, bis zum ersten anderen Argument oder
`--`:

```sh
./demo --schedulers 4 --max-heap 100000000 -- arg1 arg2
```

`--schedulers N`, `--max-atoms N`, `--max-heap BYTES`, `--max-stack BYTES`,
`--max-memory BYTES` und `--profile FILE` sind unter
[Runtime-Optionen](executables.md#runtime-options) beschrieben.
