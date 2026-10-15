---
source: docs/library.md
sourceCommit: 6ed3851c
sourceSha256: 827659aa3cf1548562f97b6e8d7a37e0f230599570a6c78628cd7a72896102f9
translatedAt: 2026-10-15
---
# Bibliotheksmodule

Eine projekteigene Teilmenge der OTP-Module `lists` und `maps`, in Erlang nach
dem dokumentierten Verhalten von OTP geschrieben (nicht aus OTP-Quelltexten
kopiert) und mit den Programmen kompiliert, die sie verwenden.

## Inhalt

| Modul | Funktionen |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1`, `foreach/2`, `mapfoldl/3`, `mapfoldr/3`, `partition/2`, `splitwith/2`; Runtime-Builtins `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`, `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2`, `keymember/3`, `keysearch/3`, `keydelete/3` ([Modul lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1`, `filter/2`, `map/2`, `foreach/2`, `update_with/3,4`; Runtime-Builtins `get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`, `without/2`, `from_keys/2` ([Modul maps](builtins.md#maps-module)) |
| [`file`](../library/kernel/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2,3`, `read_file_info/1,2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` über den Dateitreiber ([Dateien](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (Server der Standardeingabe oder eine geöffnete Datei), `request/1,2`, `requests/1,2` (das I/O-Protokoll von OTP, [Dateien](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` und `nl/0,1` sind Runtime-Builtins ([io](io.md)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` über Socket-Ports ([Sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/kernel/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/kernel/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Clauses eigenes: das Protokoll des Socket-Treibers, das die drei obigen Module gemeinsam nutzen |
| [`erlang`](../library/erts/erlang.erl) | Erzeugte Stubs jedes `erlang`-Exports von OTP 29; Builtins ersetzen ihre, `nif_error/1,2` haben Rümpfe, die anderen lösen beim Aufruf `{not_implemented, F, A}` aus ([Modul erlang](builtins.md#erlang-module)) |
| [`binary`](../library/stdlib/binary.erl) | Jede Funktion von OTP 29: `replace/3,4` und `list_to_bin/1` in Erlang, die anderen Runtime-Builtins ([Modul binary](builtins.md#binary-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Konvertierungen, `bin_is_7bit/1` und Byte Order Marks als Runtime-Builtins ([Modul unicode](builtins.md#unicode-module)); Normalisierung und Eigenschaften sind Stubs |
| [`math`](../library/stdlib/math.erl) | Jede Funktion von OTP 29 als Runtime-Builtin ([Modul math](builtins.md#math-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Jede Funktion von OTP 29 als Runtime-Builtin ([persistente Terme](builtins.md#persistent-terms)) |
| [`code`](../library/kernel/code.erl) | Abfragen geladener Module als Runtime-Builtins ohne Code-Server ([Modul code](builtins.md#code-module)); Pfade und Laden sind Stubs |
| [`os`](../library/kernel/os.erl) | `cmd/1` über einen Port ([Unterprozesse](ports.md#subprocesses)), `timestamp/0`, `system_time/0,1`, `perf_counter/0,1`, `getenv/2`; `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0` und `version/0` sind Runtime-Builtins |

Ergebnisse und Fehlergründe entsprechen OTP 29, einschließlich der
Fehlerformen der Erlang-Implementierungen von OTP (`lists:map(F, x)` ergibt
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`,
`lists:seq(1, 10, 0)` `badarg`) und seiner BIFs (`lists:member/2`,
`lists:keyfind/3`, `lists:reverse/2`, die `maps`-Funktionen: `badarg`,
`{badmap, M}`, `{badkey, K}`). `lists:member/2` vergleicht mit `=:=`,
`lists:keyfind/3` mit `==`. `lists:sort/1` ist ein stabiler Mergesort.
Stacktraces nennen die Bibliotheksfunktionen, nicht die von OTP.

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
  nennt kein Modul.
- Die Bibliothek ist `library/` des Build-Baums, relativ zu `clau` gefunden wie
  das Runtime-Archiv, mit einem Verzeichnis pro OTP-Anwendung (`erts`,
  `kernel`, `stdlib`).
- Ein Modul des Batches mit demselben Namen ersetzt das Bibliotheksmodul, mit
  einer Warnung.
- Bibliotheksmodule sind gewöhnliche Batch-Module: Sie werden in ausführbare
  Dateien gelinkt und erzeugen bei Objekt- oder IR-Ausgabe eigene Artefakte.
- Ein Modul, das nur über Laufzeitnamen erreicht wird (`M:F(...)` mit `M` als
  Variable), wird nicht hinzugefügt: Ein solcher Aufruf löst `undef` aus, sofern
  nicht etwas anderes das Modul nennt.
- Bibliotheksfunktionen sind Erlang-Code, daher geben sie wie anderer Code ab,
  sobald der Scheduler existiert.

## Ersatz für Runtime-Module

Plan 11 step 41I (2026-10-12) entscheidet, wie Clause die OTP-Module vertritt,
die ERTS in C implementiert (NIFs, BIFs, Port-Treiber, die vorgeladenen Module
von `erts/preloaded/src`), sowie Module, die OTP beim Bauen erzeugt
(`unicode_util`). `kernel` und `stdlib` von OTP sind reines Erlang, rufen aber
diese Module auf; die Steps ab 41J setzen diesen Vertrag um.

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
  umgesetzt; Vorgabe des Nutzers 2026-10-12) oder `declined` (ein Stub, der
  bleibt, mit einem Grund wie Distribution oder Laden von Code, das auf plan
  step 71 wartet). Ein Modul beginnt mit jeder Funktion als Stub, sodass es
  auffindbar ist und seine Aufrufer kompilieren; Gruppen wechseln dann in ihren
  entschiedenen Status.
- **Fehlend (missing):** Clause liefert gar kein Modul, womöglich für immer,
  und hält fest, warum und welche höheren Clause-Module den Platz seiner
  Aufrufer einnehmen. Die niedrigen Datei- und Socket-Schichten `prim_*` sind
  der typische Fall: Programme verwenden stattdessen `file`, `gen_tcp`,
  `gen_udp` und `inet` von Clause, und weil Clause-Module gegenüber denen von
  OTP gewinnen (siehe unten), gelangen die Aufrufer eines fehlenden Moduls aus
  OTP nie in einen Batch. Ein fehlendes Modul erhält nie einen Stub, daher ist
  eine Referenz darauf ein Fehler zur Kompilierzeit, nie eine Überraschung zur
  Laufzeit.

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
  vorgeladenen Module und `erlang`), `kernel` (`file`, `gen_tcp`, `gen_udp`,
  `inet`, `os` und Clauses eigenes `clause_socket`), `stdlib` (`binary`,
  `lists`, `maps`, `math`, `io`, `unicode`, `unicode_util`). Die Suche in der
  Bibliothek durchsucht jedes Anwendungsverzeichnis; ein Modulname existiert in
  höchstens einem davon.
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
- Jedes Bibliotheksmodul von Clause exportiert die vollständige Liste von
  OTP 29 für seinen Namen, sodass dagegen kompilierter OTP-Code jede Funktion
  findet; Clauses eigene `lists`, `maps`, `file`, `io`, `os`, `gen_tcp`,
  `gen_udp` und `inet` erhalten ebenfalls Inventare und Stubs für das, was sie
  noch nicht implementieren.

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
Datei von Clause startet keinen davon und startet laut Entscheidung vom
2026-10-12 vorerst weiterhin keinen: `file` und `io` von Clause brauchen keinen
Server, und ein OTP-Modul, das einen braucht, scheitert so, wie es unter OTP
ohne diesen Server scheitert (`noproc`). Kosten: OTP-Code, der über `logger`
protokolliert oder zur Laufzeit `code` aufruft, funktioniert nicht, bis ein
späterer Ledger-Eintrag eine minimale Dienstmenge für das Startobjekt auswählt.
Das Booten der ganzen Anwendung `kernel` ist nicht geplant.

### Ledger

Das Projekt luerl treibt diese Arbeit an. Nach jedem Step

```text
clau.bat --project test-luerl --entry luerl:init
```

ausführen, jeden Fehler klassifizieren (`unknown module`,
`undefined function M:F/A`, nicht unterstützte Syntax oder Features, anderes)
und jeden einem Step von plan 11 phase H3, einem anderen Backlog-Eintrag oder
einer festgehaltenen Ablehnung zuordnen. Ist das stderr des Laufs in einer
Datei gespeichert, gibt `python tests/compiler/library/library_modules.py report
FILE` die Klassifikation als Tabellen aus: jedes unbekannte Modul mit seiner
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
  `stub`/`declined`-Eintrag, der kein `undef` auslösender Stub ist, ein
  `implemented`/`refused`-Eintrag ohne Rumpf oder Katalog-Builtin.
  `library_rejects` belegt das an einer absichtlich inkonsistenten
  Fixture-Bibliothek.
- CTest `library_freshness` (Label `host_otp`) beobachtet jedes Inventar neu
  und verlangt, dass es unverändert ist, und beobachtet, erzeugt, prüft und
  kompiliert dann ein neues Modul von Anfang bis Ende. `library_report` führt
  `clau` auf einem Fixture-Programm aus und prüft die Zeilen des Berichts.

| Modul | Entscheidung (2026-10-12) | Grund oder Plan-Step |
| --- | --- | --- |
| `init` | bereitgestellt; implementiert außer `boot/1`, `restart/0,1` und `make_permanent/2`, abgelehnt | Antworten zu Argumenten und Status eines gestarteten Systems (41L, [Modul init](builtins.md#init-module)) |
| `persistent_term` | bereitgestellt, alles Stubs | runtimeweite Term-Tabelle (41M) |
| `erts_internal` | bereitgestellt; Gruppen `stdlib` und `counters` implementiert, `get_creation/0` und `map_hashmap_children/1` abgelehnt (refused), die Gruppen `distribution`, `beam` und `emulator` zurückgewiesen (declined) | 41N ([erts_internal](builtins.md#erts-internal)); keine Distribution, keine `.beam`-Dateien |
| `atomics`, `counters`, `erts_code_purger` | bereitgestellt; `atomics`, `counters` implementiert; `purge/1`, `soft_purge/1` implementiert, der Purger-Prozess zurückgewiesen | 41N ([atomics und counters](builtins.md#atomics-and-counters)); das Laden von Code wartet auf step 71 |
| `unicode_util` | bereitgestellt, implementiert (41O1, 41O2) | Tabellen erzeugt aus den Antworten von OTP und den Unicode-Daten ([unicode_util](builtins.md#unicode-util)) |
| `erl_prim_loader` | bereitgestellt; Dateiabfragen über `file` implementiert, Laden und Archive zurückgewiesen | 41P ([Dateien](ports.md#standard-io-and-files)); das Laden von Code wartet auf step 71 |
| `zlib` | bereitgestellt, implementiert über das festgelegte zlib (41Q) | Streams sind Handle-Referenzen ([Modul zlib](builtins.md#zlib-module)) |
| `prim_eval` | bereitgestellt, implementiert (41S) | `'receive'/2` über die Schritte eines kompilierten receive ([prim eval](builtins.md#prim-eval)) |
| `application_controller` | bereitgestellt, alles Stubs | verdeckt das von OTP, das `prim_file` aufruft (luerl nennt es über `application` von OTP) |
| `lists`, `maps`, `io`, `file`, `os`, `gen_tcp`, `gen_udp`, `inet` | bereitgestellt, die vollständigen Exportlisten von OTP 29; was Clause hatte, bleibt implementiert, der Rest Stubs | wachsen nach Bedarf des Ledgers |
| `re` | bereitgestellt; implementiert (41ZA, 41ZB) außer `import/1`, zurückgewiesen | über das festgelegte PCRE2 ([Modul re](builtins.md#re-module)); Clause exportiert keine Muster |
| `prim_file`, `prim_buffer` | fehlend, entschieden in 41P | `file` von Clause ist die Dateischicht; `filelib`/`filename` von OTP laufen darauf |
| `prim_socket`, `prim_net`, `prim_inet`, `socket_registry`, `socket`, `net` | fehlend, entschieden in 41R | `gen_tcp`, `gen_udp`, `inet` von Clause sind die Netzwerkschicht; `gen_tcp_socket`, `gen_udp_socket`, `inet_tcp`, `inet_udp` von OTP werden nur aus den verdeckten Modulen von OTP erreicht ([Sockets](ports.md#sockets-57f)) |

Neueste luerl-Schicht (2026-10-12, nach den Steps 41K1 und 41K2, mit
`NEW_STACKTRACE` definiert, wie es `rebar.config.script` von luerl ab OTP 21
tut, und `inet` nicht mehr in `ignore_modules`): Das Ziel kompiliert und linkt
ohne Fehler. 83 Warnungen bleiben: 74 Typen der ignorierten Module
`erl_parse` und `compile`, 8 Typen von OTP-Modulen außerhalb des Programms, die
OTP-Code nennt, den das Ziel kompiliert, eine Verbreiterung durch das Budget
des Typgraphen in diesem Code. Die ausführbare Datei startet `luerl:init/0`
und endet mit 0. Die nächste Schicht ist das Laufzeitverhalten: welche Stubs
luerl erreicht, wenn es Lua-Code ausführt.

Laufzeitschicht (2026-10-14, nach den Phasen H3–H5): Ein Treiber, der 35
Lua-Schnipsel über `luerl:do` ausführt, baut mit 17 Warnungen und gibt für 34
davon die Ausgabe von OTP 29 aus, `os.date` eingeschlossen. Der übrige, ein
`goto`, scheitert mit `function_clause` von OTP; nur seine Stack-Frames
weichen ab, ohne Argumente oder Positionen
([Unterschiede](differences.md)).
