---
source: docs/transforms.md
sourceCommit: a8c3f8f6
sourceSha256: 567b9700399599cf0acdea30debb2cd52560a7a8675d9d86d9939a7e932bb33b
translatedAt: 2026-10-17
---
# Parse-Transforms

## Parse-Transforms verwenden

- **Voraussetzung:** Erlang/OTP 29 auf dem Host installiert, nur zum
  Kompilieren von Modulen, die einen Transform verwenden
  ([OTP des Hosts](#host-otp)). `--erl none` führt nie Host-Code aus: Module,
  die einen Transform brauchen, scheitern.
- **Einen Transform aufrufen** im Quelltext mit
  `-compile({parse_transform, Module}).` (oder innerhalb einer Liste
  `-compile([...])`) oder für jedes Modul des Befehls mit
  `--parse-transform Module` (wiederholbar; diese laufen zuerst, wie
  `erlc +'{parse_transform,M}'`).
- **Transform-Module** werden als `.beam`-Dateien auf den Transform-Pfaden
  gefunden, dann als Projektquellen, die bei jedem Build vom OTP des Hosts
  kompiliert werden, dann unter den Modulen von OTP
  ([Transform-Module](#transform-modules)).
- **Vorkompilieren** muss man einen Transform, der aus einer anderen
  Bibliothek stammt (immer), oder einen Projekt-Transform, den der
  Host-Compiler mit den Include-Verzeichnissen und Defines des Ziels nicht
  bauen kann: `erlc -o deps/lib/ebin deps/lib/src/*.erl` mit dem OTP des
  Hosts, dann `deps/lib/ebin` mit `--transform-path` oder in
  `transform_paths` angeben. Die `.beam` muss aus dem OTP-Release des Hosts
  stammen; eine `.beam` dort gewinnt gegenüber einer Quelle desselben Moduls.
- **Was ihn ausführt:** Kompilieren, `--print-ast`, `--print-source` und
  `--print-abstr` (das die transformierten Formen zeigt); `--parse-check`,
  `--preprocess-check` und `--print-pp` tun es nicht.

```sh
clau --erl "C:/Program Files/Erlang OTP/bin/erl.exe" --transform-path ebin -o app app.erl
```

Clause wendet `{parse_transform, Module}` so an, wie es `erlc` tut. Es
exportiert das geparste Modul als Formen im
[Abstract Format](https://www.erlang.org/doc/apps/erts/absform.html) von OTP,
führt das Transform-Modul auf einem auf dem Host installierten Erlang/OTP 29
aus, importiert die zurückgegebenen Formen als neue Syntax des Moduls und
kompiliert diese (`compiler/src/transforms/`). OTP wird nur gebraucht, während
ein Modul kompiliert wird, das einen Transform verwendet; erzeugte Programme
brauchen es nie.

## Verhalten von OTP

Aus dem festgelegten `lib/compiler/src/compile.erl` (`transform_module`,
`foldl_transform`, `maybe_strip_columns`) und beobachtet unter OTP 29.1.1:

- Transforms laufen als erster Standarddurchlauf: nach `epp` und dem Parsen,
  vor `erl_lint`, bevor `erl_internal` `module_info/0,1` und
  `behaviour_info/1` hinzufügt.
- Die Transform-Liste besteht aus jedem `{parse_transform, M}` der
  Kompilieroptionen (`erlc +'{parse_transform,m}'`), dann aus denen der
  `-compile`-Attribute in Formreihenfolge. Ein zweimal genannter Transform
  läuft zweimal. Bevor der erste läuft, werden diese Optionen aus den Formen
  entfernt: Ein `-compile`-Attribut, das nur die Option enthält, verschwindet,
  eine Liste verliert das Element.
- `M` muss sich laden lassen (`code:ensure_loaded/1`) und `parse_transform/2`
  exportieren, sonst der Fehler `undefined parse transform 'M'` (ohne Ort).
- `M:parse_transform(Forms, Options)` erhält die Formen und die
  Kompilieroptionen (nicht die `-compile`-Optionen des Quelltexts):
  `{features, Enabled}`, `report_warnings`, `report_errors`, `{cwd, Dir}`,
  `{outdir, Dir}`, `{i, Dir}` pro Include-Verzeichnis, `{d, Name[, Value]}` pro
  Define, plus jedes als Option angegebene `{parse_transform, M}`.
- Es gibt `Forms`, `{warning, Forms, Warnings}` oder
  `{error, Errors, Warnings}` zurück, wobei jede Liste
  `[{File, [{Location, Module, Descriptor}]}]` ist, formatiert durch
  `Module:format_error(Descriptor)`. Eine Ausnahme ist der Fehler
  `error in parse transform 'M': ...` (`compile:format_error/1` von
  `{parse_transform, M, {Class, Reason, Stack}}`). Der nächste Transform erhält
  die Formen des vorigen; der erste Fehler beendet die Kette.
- Gibt `M:parse_transform_info/0` `#{error_location => line}` zurück, oder ist
  die Kompilieroption `{error_location, line}` gesetzt, werden Spalten aus den
  Formen entfernt, bevor `M` läuft, und aus den endgültigen Formen.
- Formen tragen Annotationen `{Line, Column}`. `epp` fügt zuerst
  `{attribute, {1,1}, file, {File, 1}}` hinzu, dasselbe für jede eingebundene
  Datei, wenn sie beginnt, und `{attribute, {L,1}, file, {File, L}}`, wenn die
  einbindende Datei in Zeile `L` fortfährt, der Zeile nach ihrem `-include`.
  Makrodefinitionen und andere Direktiven hinterlassen keine Form. Die Liste
  endet mit `{eof, Location}`, dem Ende der Hauptdatei. Präprozessor- und
  Parse-Fehler bleiben als Formen `{error, E}` in der Liste, und `erl_lint`
  meldet sie nach den Transforms.
- Formen von OTP 29, die `absform.md` nicht aufführt: `{attribute, A,
  native_record, {Name, Fields}}`; Record-Namen `{Module, Name}`
  (qualifiziert) und `[]` (`#_`) in Ausdrücken `record`/`record_field`;
  `{type, A, record, [{tuple, A, [Module, Name]} | Fields]}` für qualifizierte
  Record-Typen; `{zip, A, Qualifiers}` als Qualifier von Comprehensions;
  `{mc, ...}`, `m_generate` und die `_strict`-Generatoren.
- `erlc +to_abstr` schreibt die Formen nach den Transforms (und `erl_lint`)
  nach `File.abstr`, ein `~p.`-Term pro Form; `erlc File.abstr`
  (`compile:file(F, [from_abstr])`) kompiliert eine solche Datei ohne
  Präprozessor oder Parser.

## Pipeline von Clause

1. Das Modul präprozessieren und parsen. Präprozessor- oder Parse-Fehler
   beenden hier; Transforms laufen nicht auf einem Modul mit Fehlern
   (abweichend von OTP, das die Fehler als Formen weitergibt).
2. Die Transforms in der Reihenfolge von OTP sammeln: Optionen
   `--parse-transform` und die `parse_transforms` des Projekts, dann
   `-compile`-Attribute. Ein Modul ohne Transforms überspringt den Rest und
   startet OTP nie.
3. Diese Optionen aus den Formen entfernen und sie exportieren: Annotationen
   `{Line, Column}`, wie `erl_parse` sie vergibt, die `file`-Attribute von
   `epp` und `eof`. Die vordefinierten Funktionen sind noch nicht Teil der
   Formen.
4. Den [Loader](#loader) einmal für das Modul ausführen.
5. Die zurückgegebenen Formen importieren, indem sie in Tokens umgewandelt
   werden, die an ihren Annotationen verortet sind, und mit dem Parser von
   Clause geparst werden; ein `file`-Attribut wechselt die Datei der folgenden
   Formen wie in `erl_lint`.
6. Die vordefinierten Funktionen hinzufügen, dann wie üblich linten, analysieren
   und kompilieren.

Die Aktionen, die Transforms ausführen, stehen unter
[Parse-Transforms verwenden](#using-parse-transforms).

## Austausch

- `clau` und der Loader tauschen Dateien im External Term Format aus
  (`term_to_binary`, Version 131, unkomprimiert): exakte Gleitkommazahlen,
  UTF-8-Atome, große Ganzzahlen und kein Parsen von Text in Erlang. Das Format
  selbst (Tags, Layouts, Grenzprüfungen) liegt einmal in
  `abi/include/clause/abi/external_term.hpp`, unabhängig von jeder
  Termdarstellung; `term_to_binary` und `binary_to_term` der Runtime teilen es
  ([External Term Format](builtins.md#external-term-format)). Das Termmodell
  des Compilers von Clause umfasst Atome, Ganzzahlen, Gleitkommazahlen, echte
  und unechte Listen, Tupel, Maps und Bitstrings; Pids, Ports, Referenzen und
  Funs werden mit einer Diagnose abgewiesen.
- `.abstr`-Text ist die Syntax von
  [`file:consult/1`](https://www.erlang.org/doc/apps/kernel/file.html#consult/1):
  ein Term pro Form, jeder endet mit `.`. `--print-abstr` gibt die Formen jedes
  Moduls nach den Transforms in dieser Syntax auf stdout aus, eine Form pro
  Zeile; eine `.abstr`-Eingabedatei wird wie `erlc File.abstr` kompiliert.
  Clause schreibt kanonischen Text, nicht das `~p`-Layout von OTP; es kommt auf
  gleiche Terme an. Die Formen gleichen
  `epp:parse_file(F, [{location, {1, 1}}])` für jedes Konstrukt von
  `tests/fixtures/transforms/abstract/`, einschließlich der `file`-Attribute
  von `epp` (ein explizites `-file` wird mit
  `[{generated, true}, {location, L}]` annotiert) und eines `eof`, gezählt ab
  dem letzten `-file` der Hauptdatei.

## Formen importieren

Zurückgegebene Formen und `.abstr`-Eingaben (positional oder Projekt-`sources`)
werden zu Tokens, die an ihren Annotationen verortet sind, und durchlaufen den
Parser von Clause, sodass sie dieselben Syntaxprüfungen wie Quelltext erhalten;
die Operatorrangfolge entscheidet, wo Klammern ergänzt werden. `{Line, Column}`,
ein bloßes `Line` (angezeigt als `file:line:`) und Property-Listen mit
`location` und `file` werden akzeptiert; `generated` wird ignoriert. Ein
file-Attribut wechselt die Datei der folgenden Formen; existiert diese Datei,
behält importierter Code seine Debug-Zeilen und Quelltextkommentare.
Fehlerhafte Formen sind Fehler an ihrer Annotation (`unknown expression bogus`,
`expected {Name, Arity}`, `invalid annotation`), und das Modul scheitert; die
Formen `{error, _}`/`{warning, _}` von OTP werden mit ihrem Deskriptor
gemeldet, dessen Formatierung OTP braucht. Ein exportiertes Modul zu
importieren und erneut zu exportieren ergibt dieselben Formen.

## OTP des Hosts

- `erl` wird in dieser Reihenfolge gefunden: `--erl PATH`, `erl` aus `PATH`,
  dann unter Windows `%ProgramFiles%\Erlang OTP\bin\erl.exe`. Keines zu finden,
  wenn ein Modul einen Transform braucht, ist ein Fehler, der den Transform und
  das Modul nennt; es gibt keinen Rückfall, der Transforms überspringt.
- Der Host muss OTP 29 ausführen (`erlang:system_info(otp_release)`); ein
  anderes Release ist ein Fehler.
- Der [Loader](#loader) läuft als `erl -noshell -noinput -pa Dir ... -eval ...`
  (Verzeichnisse des Codepfads absolut gemacht) mit einer Zeitgrenze von
  600 s. Sein stdout und stderr (einschließlich der `io:format`-Ausgabe des
  Transforms) werden nach seinem Ende in das stderr von `clau` kopiert.
  Ein Loader, der endet, ohne eine Antwort zu schreiben, die Zeit
  überschreitet oder nicht starten kann, ist ein Fehler.
- Ein Transform führt beliebigen Code mit den Rechten des Nutzers aus, genau
  wie unter `erlc`.

## Loader

`compiler/src/transforms/loader/clause_transform_loader.erl` gehört dem Projekt
und ist in `clau` eingebettet. Jeder Lauf schreibt ihn und die Anfrage in ein
frisches temporäres Verzeichnis, `clause-transform-*` unter `<build_dir>/tmp`
([Build-Verzeichnis](projects.md#build-directory)) oder, für positionale
Eingaben ohne `--build-dir`, im temporären Verzeichnis des Systems, das nach
dem Lauf entfernt wird; `erl` kompiliert und lädt den Loader im Speicher. Die
Anfrage enthält die Formen, die Optionen, die Transform-Liste, den Dateinamen
des Moduls und die zu bauenden Transform-Quellen des Projekts. Mit einem
Build-Verzeichnis werden die Antwort und die Ausgabe des Loaders im
[Build-Cache](projects.md#build-caches) behalten und wiederverwendet, solange
die Anfrage und alles, wovon sie abhängt, unverändert sind; die Liste der
Sticky-Module des Hosts wird auf dieselbe Weise behalten. Der Loader:

1. prüft das OTP-Release;
2. kompiliert die angefragten Transform-Quellen des Projekts im Speicher und
   lädt sie;
3. für jeden Transform: lädt ihn, entfernt Spalten, wie es
   `parse_transform_info/0` verlangt, ruft `parse_transform/2` auf und
   formatiert Warnungen und Fehler mit `Module:format_error/1` zu
   `{File, Location, Text}`;
4. schreibt `{ok, Forms, Warnings}` oder `{error, Errors, Warnings}` und hält
   an.

## Transform-Module

Ein Transform-Modul wird in dieser Reihenfolge gesucht:

1. **Vorkompilierte `.beam`-Dateien** in den Verzeichnissen von
   `--transform-path DIR` (wiederholbar) und der Projektoption
   `transform_paths`, die vor denen von OTP in den Codepfad des Loaders
   kommen. Das ist der einzige Weg, einen Transform zu verwenden, der aus einer
   abhängigen Bibliothek stammt: Diese Bibliothek zuerst mit dem OTP des Hosts
   bauen (zum Beispiel `erlc -o deps/lib/ebin deps/lib/src/*.erl`); Clause baut
   nie Abhängigkeiten. Die `.beam` muss aus dem OTP-Hauptrelease des Hosts
   stammen.
2. **Die Quellen des aktuellen Projekts**: eine `Module.erl` im Batch oder in
   seinen `source_search_paths`, bei jedem Lauf vom Loader im Speicher mit den
   Include-Verzeichnissen und Defines des Ziels kompiliert, zusammen mit den
   Projektmodulen, die er per Namen aufruft (auf dieselbe Weise gefunden). Die
   Suche übergeht Quellen, die `ignore_dirs` oder `ignore_modules` auslassen,
   wie es die [Modulsuche](projects.md#ignored-sources) tut. Clause sucht diese
   Quellen einmal pro Batch und behält sie im Speicher; der Loader kompiliert
   sie dennoch für jedes Modul, auf dem der Transform läuft, daher lohnt es
   sich, einen großen Transform vorzukompilieren, um diese Zeit zu sparen.
   Module, die der Host aus seinen Sticky-Verzeichnissen lädt (`kernel`,
   `stdlib`, `compiler`, etwa `ms_transform` oder `qlc_pt`, wenn die Quellen von
   OTP auf einem Suchpfad liegen), lassen sich nicht neu laden, daher werden die
   eigenen Module des Hosts verwendet: Ihre Quellen und die Module, die nur sie
   aufrufen, werden weder gesucht noch kompiliert. Clause fragt das `erl` des
   Hosts einmal pro Aufruf nach diesen Modulen.
3. **Die eigenen Module von OTP** (`ms_transform`, `qlc`) aus dem Codepfad des
   Hosts. OTP liefert `erl_id_trans` nur als Beispielquelle, nicht als Modul.
   Ihre Header werden wie jedes `include_lib` aufgelöst
   ([Präprozessor](preprocessor.md#compatibility-policies)): die Anwendung
   zuordnen, wie in
   `--app-dir "stdlib=C:/Program Files/Erlang OTP/lib/stdlib-8.1"` für
   `include_lib("stdlib/include/ms_transform.hrl")`, oder den Transform direkt
   mit `-compile({parse_transform, ms_transform})` nennen.

Das Kompilieren eines Projekt-Transforms kann scheitern, wo sein echter Build
gelingt: Header von Abhängigkeiten, ein Transform des Transforms oder Makros,
die nur ein anderes Build-Werkzeug definiert. Clause meldet dann die Meldungen
des Compilers zur Quelle des Transforms mit dem Hinweis, ihn mit dem OTP des
Hosts zu einer `.beam` vorzukompilieren und ihr Verzeichnis mit
`--transform-path` zu übergeben. Ein Projekt-Transform wird von Clause auch als
gewöhnliches Modul kompiliert, wenn er Teil des Batches ist; seine eigenen
Aufrufe (`erl_syntax`, `erl_parse`, ...) können dann Bibliotheksmodule
brauchen, die Clause nicht mitliefert, daher Transforms aus den `sources` eines
Ziels heraushalten, wenn nur der Transform sie braucht.

## Diagnosen

| Situation | Meldung |
| --- | --- |
| Kein OTP auf dem Host | `File: parse transform 'M' needs Erlang/OTP 29 on the host; pass --erl` |
| `--erl` nennt keine ausführbare Datei | `File: erl not found: PATH` |
| Falsches OTP-Release | `parse transforms need Erlang/OTP 29 on the host, found N` |
| Transform nicht gefunden | `File: undefined parse transform 'M'` (Text von OTP) |
| Transform hat ausgelöst | `File: error in parse transform 'M': ...` (Text von OTP) |
| Warnung oder Fehler des Transforms | `File:Line:Column: Text` wie zurückgegeben |
| Transform-Quelle kompiliert nicht | ihre Meldungen, dann der Hinweis zum Vorkompilieren |
| Ein Transform-Pfad existiert nicht | `File: parse transform path is not a directory: DIR` |
| Eine `.beam` auf einem Transform-Pfad lädt nicht | `File: cannot load parse transform 'M' from PATH: Reason` |
| Loader gescheitert, Zeit überschritten oder keine Antwort geschrieben | `parse transform loader failed: ...` |
| Ungültige zurückgegebene Formen | die Diagnose des Parsers am Ort der Form |

## Optionen

| CLI | Projekt (`[targets.options]`) | Bedeutung |
| --- | --- | --- |
| `--parse-transform M` | `parse_transforms = ["m"]` | `M` auf jedes Modul anwenden, vor dessen eigenen `-compile`-Transforms (die der CLI zuerst) |
| `--transform-path DIR` | `transform_paths = ["deps/*/ebin"]` | Codepfad für vorkompilierte Transform-`.beam`-Dateien; Muster wie in `source_search_paths` |
| `--erl PATH` oder `none` | — | `erl`-Datei des Hosts; `none` führt nie Host-Code aus |
| `--print-abstr` | — | Die Formen nach den Transforms ausgeben, statt zu kompilieren |

Ein Projekt, das einen eigenen Transform und einen vorkompilierten aus einer
Abhängigkeit verwendet:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[targets.options]
source_search_paths = ["transforms"]  # transforms/pt_rewrite.erl, compiled for each build
parse_transforms = ["pt_dep"]         # applied to every module of the target
transform_paths = ["deps/*/ebin"]     # deps/ptdep/ebin/pt_dep.beam, built with erlc first
```
