---
source: docs/library.md
sourceCommit: 336caea7
sourceSha256: 0fc98265c5256c76cd34c89f89a48993e3452732ca40c3a295860a34bee27186
translatedAt: 2026-10-18
---
# Bibliotheksmodule

Clause liefert eigene Versionen der OTP-Module, die Programme aufrufen, in
Erlang nach dem dokumentierten Verhalten von OTP geschrieben (nicht aus
OTP-Quelltexten kopiert) über [Builtins](builtins.md) der Runtime, und
kompiliert sie mit den Programmen, die sie verwenden.

## Inhalt

Jedes bereitgestellte Modul exportiert die vollständige Liste von OTP 29 für
seinen Namen; sein Inventar `<module>.terms` ([Dateien](#files)) hält fest,
welche Funktionen implementiert und welche Stubs sind.

| Modul | Inhalt |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | Die gängigen Funktionen; Datenfunktionen wie `sublist/2,3`, `flatten/1,2`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2` sind Runtime-Builtins; jede dokumentierte Funktion ist implementiert ([Modul lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Jede dokumentierte Funktion; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... sind Runtime-Builtins, Funktionen mit funs sind Erlang ([Modul maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Jede dokumentierte Funktion; Listendurchläufe sind Runtime-Builtins, Funktionen mit funs sind Erlang ([Sammlungen](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Jede dokumentierte Funktion; gregorianische Arithmetik als Runtime-Builtins, lokale Zeit und RFC 3339 in Erlang ([calendar](builtins.md#calendar)) |
| [`filename`](../library/stdlib/filename.erl) | Jede dokumentierte Funktion nach den Unix- und Windows-Regeln von OTP für den Host; Namensdurchläufe sind Runtime-Builtins, `absname/1,2` und `basedir/2,3` (aus `HOME`, den XDG-Variablen und `APPDATA`) sind Erlang ([filename](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Jede dokumentierte Funktion als Runtime-Builtin: Parsen nach RFC 3986 mit den Fehlerfragmenten von OTP, erneutes Zusammensetzen, Normalisierung, Auflösung, Prozentkodierung und form-urlencoded-Abfragen ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Jede dokumentierte Funktion mit iodata, Fehlern und Callback-Reihenfolge von OTP; `decode/1`, `encode/1`, `format/1,2` und die Binary-Escape-Funktionen sind Runtime-Builtins, Encoder und Formatierer mit funs sowie Callback-Decoder sind Erlang ([Kodierungen](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Jede dokumentierte Funktion mit Zuständen und Folgen von OTP; die Algorithmen von OTP laufen als Runtime-Builtins, Plug-in-Generatoren in Erlang ([Zufallszahlen](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Jede dokumentierte Funktion als Runtime-Builtin, das chardata wie `string.erl` von OTP durchläuft, sodass Ergebnisse die Formen von OTP behalten ([string](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Jede dokumentierte Funktion als Runtime-Builtin ([Kodierungen](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Jede dokumentierte Funktion über dem record von OTP 29; record-Operationen sind Runtime-Builtins, Folds und Mapfolds sind Erlang ([Sammlungen](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Jede dokumentierte Funktion über den Baum- und Warteschlangenformen von OTP; Operationen ohne funs sind Runtime-Builtins ([Sammlungen](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Jede dokumentierte Funktion über den records (Mengen der Version 1) und Maps (Version 2) von OTP; Operationen ohne funs sind Runtime-Builtins ([Sammlungen](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (Server der Standardeingabe oder eine geöffnete Datei), `request/1,2`, `requests/1,2` (das I/O-Protokoll von OTP, [Dateien](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` und `nl/0,1` sind Runtime-Builtins ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Schreib-, Prüf- und Sammelfunktionen, Format-Engine und Pretty Printer (`print/1,4`, `~p`, `chars_limit`) als Runtime-Builtins in den tiefen Listenformen von OTP; `get_until`, `format_prompt` und `write/3` sind Erlang; `fread/2,3` sind Stubs ([io_lib](builtins.md#io_lib)) |
| [`binary`](../library/stdlib/binary.erl) | Jede Funktion; `replace/3,4` und `list_to_bin/1` in Erlang, die anderen Runtime-Builtins ([Modul binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Jede Funktion als Runtime-Builtin ([Modul math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Jede Funktion als Runtime-Builtin: Konvertierungen, `bin_is_7bit/1`, Byte Order Marks, Normalisierungsformen, Kategorien und Bezeichnereigenschaften ([Modul unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Jede Funktion über erzeugten Tabellen, die chardata-Durchläufe als Runtime-Builtins ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Jede Funktion außer `import/1`, über PCRE2 ([Modul re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Dateien öffnen, lesen, schreiben, positionieren und schließen, ganze Dateien lesen und schreiben, Dateiinformationen und Verzeichnisoperationen über den Dateitreiber ([Dateien](ports.md#standard-io-and-files)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl) | Sockets über Socket-Ports ([Sockets](ports.md#sockets)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Clauses eigenes: das Protokoll des Socket-Treibers, das die drei obigen Module gemeinsam nutzen |
| [`os`](../library/kernel/os.erl) | `cmd/1` über einen Port, Abfragen zu Umgebung, Zeit und Version ([Modul maps](builtins.md#maps-module)) |
| [`code`](../library/kernel/code.erl) | Abfragen geladener Module ohne Code-Server ([Modul code](builtins.md#code-module)); Pfade und Laden sind Stubs |
| [`application_controller`](../library/kernel/application_controller.erl) | Alles Stubs; verdeckt das von OTP, das `prim_file` aufruft (luerl erreicht es über `application` von OTP) |
| [`erlang`](../library/erts/erlang.erl) | Erzeugte Stubs jedes `erlang`-Exports von OTP 29; Katalog-Builtins haben Platzhalterrümpfe, `nif_error/1,2` haben Rümpfe, die anderen lösen beim Aufruf `{not_implemented, F, A}` aus ([Modul erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Die Antworten eines gestarteten Systems; `boot/1`, `restart/0,1` und `make_permanent/2` abgelehnt ([Modul init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Jede Funktion als Runtime-Builtin ([persistente Terme](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Jede Funktion ([atomics und counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Was `stdlib` und `kernel` aufrufen; die Gruppen Distribution, `.beam`, Emulator und Purger-Prozess zurückgewiesen ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Dateiabfragen über `file`; Laden und Archive zurückgewiesen ([Dateien](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Jede Funktion über das festgelegte zlib ([Modul zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` über die Schritte eines kompilierten receive ([prim eval](builtins.md#prim-eval)) |

Ergebnisse und Fehlergründe entsprechen OTP 29, einschließlich der
Fehlerformen der Erlang-Implementierungen von OTP (`lists:map(F, x)` ergibt
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`,
`lists:seq(1, 10, 0)` `badarg`) und seiner BIFs (`lists:member/2`,
`lists:keyfind/3`, `lists:reverse/2`, die `maps`-Funktionen: `badarg`,
`{badmap, M}`, `{badkey, K}`). `lists:member/2` vergleicht mit `=:=`,
`lists:keyfind/3` mit `==`. `lists:sort/1` ist ein stabiler Mergesort, dessen
Durchläufe zwischen auf- und absteigenden Läufen wechseln, sodass kein
Zusammenführen einen Lauf umkehrt. Stacktraces nennen die
Bibliotheksfunktionen, nicht die von OTP.

## Wie Programme sie erhalten

- Nennt ein Batch (positionelle Eingaben oder ein Projektziel) ein Modul mit
  einem literalen Atom — `M:F(...)` mit literalem `M`, `fun M:F/A`,
  `apply(M, F, Args)` mit literalem `M`, `-behaviour(M)` oder
  `-import(M, ...)` —, das keine Eingabe definiert, sucht der Compiler `M.erl`
  in den Anwendungsverzeichnissen der Bibliothek, dann in den
  `source_search_paths` des Projekts
  ([Projekte](projects.md#paths-and-discovery)), parst und kompiliert die erste
  gefundene Datei in den Batch und wiederholt das für die Module, die die
  hinzugefügten Dateien nennen
  ([zu welchem Modul ein Name aufgelöst wird](#which-module-a-name-resolves-to)).
  Ein Aufruf `M:F(...)` eines Katalog-Builtins (`io:format/2`, `os:type/0`)
  nennt kein Modul. `--print-inputs` listet die Eingaben auf, die dadurch
  hinzukommen.
- Die Bibliothek ist `library/` des Build-Baums, relativ zu `clau` gefunden wie
  das Runtime-Archiv, mit einem Verzeichnis pro OTP-Anwendung (`erts`,
  `kernel`, `stdlib`).
- Ein Modul des Batches mit demselben Namen ersetzt das Bibliotheksmodul, mit
  einer Warnung; Katalog-Builtins dieses Namens gewinnen weiterhin
  ([Registrierung](builtins.md#registration)).
- Bibliotheksmodule sind gewöhnliche Batch-Module: Sie werden in ausführbare
  Dateien gelinkt und erzeugen bei Objekt- oder IR-Ausgabe eigene Artefakte.
  Sie sind Erlang-Code, daher geben sie wie anderer Code ab.
- Ein Modul, das nur über Laufzeitnamen erreicht wird (`M:F(...)` mit `M` als
  Variable), wird nicht hinzugefügt: Ein solcher Aufruf löst `undef` aus, sofern
  nicht etwas anderes das Modul nennt.

## Ersatz für Runtime-Module

Clause vertritt die OTP-Module, die ERTS in C implementiert (NIFs, BIFs,
Port-Treiber, die vorgeladenen Module von `erts/preloaded/src`), sowie Module,
die OTP beim Bauen erzeugt (`unicode_util`). `kernel` und `stdlib` von OTP sind
reines Erlang, rufen aber diese Module auf.

### Bereitgestellt oder fehlend

Was die Runtime braucht und nicht in reinem Erlang geschrieben werden kann,
wird pro Modul entschieden, und pro Funktionsgruppe, wo ein Modul Belange
mischt:

- **Bereitgestellt (provided):** Clause liefert das Modul mit der exakten
  Exportliste von OTP 29. Jede Funktion hat einen von vier Status:
  `implemented` (ein Runtime-Builtin oder ein Erlang-Rumpf über vorhandenen
  Runtime-Diensten), `refused` (gibt zurück oder löst aus, was Aufrufer in OTP
  bereits behandeln, wenn ein Feature fehlt, etwa `{error, enotsup}`), `stub`
  (löst `error({not_implemented, F, A})` mit `M:F/A` oben auf dem Stack aus,
  wie es die [`erlang`-Stubs](builtins.md#erlang-module) tun; noch nicht
  umgesetzt) oder `declined` (ein Stub, der bleibt, mit einem Grund wie
  Distribution oder Laden von Code). Ein neues Modul beginnt mit jeder Funktion
  als Stub, sodass es auffindbar ist und seine Aufrufer kompilieren; Gruppen
  wechseln dann in ihren entschiedenen Status.
- **Builtin-Platzhalter:** Eine von einem Katalog-Builtin implementierte
  Funktion behält ihren Export und den Rumpf
  `F(_, ...) -> clause_builtin_placeholder.`, der nie ausgeführt wird: Die
  Registrierung bindet stattdessen das Builtin, und ein qualifizierter Aufruf
  `M:F(...)` wird zur Brücke kompiliert. Nur ein unqualifizierter Aufruf im
  Modul würde den Platzhalter erreichen, daher ruft das Modul seine eigenen
  Builtins qualifiziert auf; `library_inventory` weist Platzhalter ohne
  zugehöriges Katalog-Builtin, als `not_implemented`-Stub verbliebene
  Katalog-Builtins und unqualifizierte Aufrufe eines Platzhalters zurück.
- **Fehlend (missing):** Clause liefert gar kein Modul, womöglich für immer,
  und hält fest, warum und welche höheren Clause-Module den Platz seiner
  Aufrufer einnehmen (`library/modules.terms`). Die niedrigen Datei- und
  Socket-Schichten `prim_*` (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) sowie `socket` und `net` sind die
  fehlenden Module: Programme verwenden stattdessen `file`, `gen_tcp`,
  `gen_udp` und `inet` von Clause, und weil Clause-Module gegenüber denen von
  OTP gewinnen (siehe unten), gelangen die Aufrufer eines fehlenden Moduls aus
  OTP (`gen_tcp_socket`, `inet_tcp`, ... von OTP) nie in einen Batch. Ein
  fehlendes Modul erhält nie einen Stub, daher ist eine Referenz darauf ein
  Fehler zur Kompilierzeit, nie eine Überraschung zur Laufzeit.

Funktionen, die für die Runtime trivial sind, werden ohne eigene Entscheidung
implementiert.

### Zu welchem Modul ein Name aufgelöst wird

OTP ist auf dem Rechner des Nutzers optional; ist es vorhanden, darf es nicht
ändern, was ein Build kompiliert. Ein Modulname wird in dieser Reihenfolge
aufgelöst:

1. **Explizite Eingaben:** Quellen, die der Nutzer aufführt (`sources`,
   `source_dirs`, positionelle Eingaben). Eine, die den Namen eines
   Clause-Moduls trägt, ersetzt es, mit einer Warnung, die beide Dateien nennt.
2. **Clause-Module:** die Bibliotheksmodule, bereitgestellte Ersatzmodule
   eingeschlossen.
3. **`source_search_paths`**, wie unter
   [Projekte](projects.md#paths-and-discovery) beschrieben.

Der Name eines fehlenden Moduls ist reserviert: Eine gleichnamige Datei auf
einem Suchpfad (zum Beispiel `erts/preloaded/src/prim_file.erl` von OTP) wird
nicht verwendet, und die Diagnose sagt, dass Clause das Modul nicht
bereitstellt. Eine explizite Eingabe darf es dennoch bereitstellen, mit der
Ersetzungswarnung.

`ignore_modules` gilt auch für Clause-Module: Ein ignoriertes Clause-Modul
fehlt im Batch, und eine explizite Eingabe kann es dann ohne Warnung
bereitstellen, da nichts ersetzt wird.

### Dateien

- Bibliotheksmodule liegen in `library/<application>/`, benannt nach der
  OTP-Anwendung, der das Modul in OTP gehört: `erts` (Gegenstücke der
  vorgeladenen Module und `erlang`), `kernel`, `stdlib`. Die privaten
  Hilfsmodule von Clause (`clause_socket`, `clause_re`, `clause_unicode`,
  `clause_zlib`, `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`) liegen neben den Modulen,
  denen sie dienen. Die Suche in der Bibliothek durchsucht jedes
  Anwendungsverzeichnis; ein Modulname existiert in höchstens einem davon.
- `library/modules.terms` listet jedes Modul auf, über das Clause entscheidet:
  `{Module, Application, provided}.` oder
  `{Module, Application, missing, "reason"}.` Der Compiler liest es, um zu
  wissen, welche Namen Clause-Module und welche reserviert sind.
- Jedes bereitgestellte Modul hat daneben ein Inventar `<module>.terms`:
  `{Name, Arity, Group, Status}.` pro Export von OTP 29, sortiert nach Name und
  Stelligkeit, wobei `Group` die Entscheidungsgruppe nennt (zum Beispiel
  `stdlib`, `distribution`, `beam`). `erlang.terms` behält sein eigenes Format
  (`{Name, Arity, Flags, Status}`, [Modul erlang](builtins.md#erlang-module)).
- Exportlisten werden an einem OTP 29 des Hosts beobachtet
  (`M:module_info(exports)`); kein OTP-Quelltext wird kopiert. Ergebnisse und
  Fehlerterme implementierter Funktionen entsprechen OTP 29; bewusste
  Abweichungen stehen unter [Unterschiede](differences.md).

### Dokumentierte Funktionen

`library/documented.terms` listet die öffentlichen Funktionen auf, die OTP 29
für `erts`, `kernel` und `stdlib` dokumentiert:
`{Module, Application, Name, Arity}.` pro Funktion, deren Modul- und
Funktionsdokumentation nicht verborgen ist und die nicht veraltet ist,
beobachtet aus den Doc-Chunks des Host-OTP durch
`tests/compiler/library/observe_docs.escript` (explizit auszuführen).
Undokumentierte Exporte bleiben in den Inventaren, dürfen aber Stubs bleiben.

- `library_inventory` prüft, dass jede dokumentierte Funktion eines
  bereitgestellten Moduls in dessen Inventar steht und kein Stub ist,
  ausgenommen Module, die `library_modules.py` als teilweise implementiert
  mit dem abschließenden Plan-Step aufführt.
- `python tests/compiler/library/library_modules.py coverage .` gibt für
  jedes dokumentierte Modul die Anzahl implementierter und dokumentierter
  Funktionen aus.

### Typen

Weil Clause-Module gegenüber denen von OTP gewinnen, muss OTP-Code, der in
seinen Specs `file:filename()` oder `erlang:time_unit()` nennt, diese Typen in
den Clause-Modulen finden. Jedes bereitgestellte Modul, dessen Gegenstück in
OTP Typen exportiert, bindet `<module>.types.hrl` aus seinem eigenen
Verzeichnis ein: die Liste `-export_type`, dann die exportierten Typen und die
lokalen Typen und Records, die sie verwenden, so wie OTP sie definiert (die
Dokumentation zeigt dieselben Definitionen; die installierte Dokumentation
enthält keine Typdefinitionen, daher stammen sie aus der Implementierung: den
Debug-Informationen der Beam-Datei oder dem mitgelieferten Quelltext eines
vorgeladenen Moduls wie `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` schreibt den
Header aus dem OTP des Hosts, und `--check` vergleicht seine Formen mit einer
frischen Beobachtung (CTest `library_freshness`); `library_modules.py check`
verlangt, dass jedes Modul seinen Header einbindet. Typen, die die Header aus
Modulen außerhalb des Programms nennen (`unicode:chardata()`,
`calendar:datetime()`), und die breiten Unions von OTP (`file:posix()` hat mehr
Glieder, als der Typgraph behält) werden ohne Warnung zu `term()` aufgelöst:
Die Diagnosen gehören zur Bibliothek von Clause, nicht zum Programm des
Nutzers.

### Kernel-Dienste beim Start

`file`, `io`, `code` und `logger` von OTP rufen registrierte Server auf
(`file_server_2`, `code_server`, den I/O-Server eines Group Leaders,
`logger`), die die Anwendung `kernel` beim Booten startet. Eine ausführbare
Datei von Clause startet keinen davon: `file` und `io` von Clause brauchen
keinen Server, und ein OTP-Modul, das einen braucht, scheitert so, wie es unter
OTP ohne diesen Server scheitert (`noproc`). OTP-Code, der über `logger`
protokolliert oder zur Laufzeit `code` aufruft, funktioniert daher nicht. Das
Booten der ganzen Anwendung `kernel` ist nicht geplant.

### Ledger

Der Projektplan sieht jedes dokumentierte Modul von `erts`, `kernel` und
`stdlib` vor; echte Programme (zuerst luerl) setzen die Prioritäten. Es kompilieren und ausführen, jeden
Fehler klassifizieren (`unknown module`, `undefined function M:F/A`, nicht
unterstützte Syntax oder Features, anderes) und jeden einem Plan-Step, einem
anderen Backlog-Eintrag oder einer festgehaltenen Ablehnung zuordnen. Ist das
stderr des Laufs in einer Datei gespeichert, gibt
`python tests/compiler/library/library_modules.py report FILE` die
Klassifikation als Tabellen aus: jedes unbekannte Modul mit seiner
Fehleranzahl, aufrufenden Modulen und aufgerufenen Funktionen mit
Stelligkeiten; undefinierte Funktionen nach Modul; andere Meldungen mit ihren
Anzahlen.

### Werkzeuge

Alle liegen in `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` schreibt
  `LIBRARY/APP/MODULE.terms` aus `MODULE:module_info(exports)` des OTP des
  Hosts und behält dabei Gruppe und Status jedes bereits vorhandenen Eintrags;
  ein neuer Export beginnt als `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` schreibt die
  Moduldatei einmalig, jeder Export ein Stub; danach wird die Datei von Hand
  bearbeitet.
- `python library_modules.py check ROOT` (CTest `library_inventory`, ohne OTP)
  meldet jede Unstimmigkeit: ein bereitgestelltes Modul ohne seine Dateien, ein
  fehlendes Modul mit einer Datei, ein Inventar, das nicht als bereitgestellt
  aufgeführt ist, ein Export, der nicht im Inventar steht, oder umgekehrt, ein
  `stub`/`declined`-Eintrag, der kein `not_implemented`-Stub ist, ein
  `implemented`/`refused`-Eintrag ohne Rumpf oder Katalog-Builtin.
  `library_rejects` belegt das an einer absichtlich inkonsistenten
  Fixture-Bibliothek.
- CTest `library_freshness` (Labels `host_otp`, `full_only`) beobachtet jedes
  Inventar neu und verlangt, dass es unverändert ist, und beobachtet, erzeugt,
  prüft und kompiliert dann ein neues Modul von Anfang bis Ende.
  `library_report` führt `clau` auf einem Fixture-Programm aus und prüft die
  Zeilen des Berichts.
