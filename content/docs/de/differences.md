---
source: docs/differences.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d23f82e2b75a7d8717057d09d1a6e30555fb75f81b5e810be0aaa9fc83a5b22c
translatedAt: 2026-10-26
---
# Unterschiede zu Erlang/OTP

Beobachtbares Verhalten, bei dem Clause bewusst vom festgelegten OTP 29
(`maint-29`, siehe [otp-reference.md](otp-reference.md)) abweicht. Jeder
Eintrag verweist auf den Vertrag, dem er gehört. Ein Eintrag wird entfernt,
sobald der Unterschied behoben ist. Noch nicht implementierte Features
(gemeldet als `notimpl`) sind hier nicht aufgeführt; siehe
[features.md](features.md) und den Plan.

## Maps

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Reihenfolge des Map-Generators (`K := V <- M`) | Flache Maps (bis zu 32 Schlüssel) werden in Schlüsselreihenfolge durchlaufen, Atom-Schlüssel jedoch in Atomtabellen-Reihenfolge, die zwischen VM-Läufen variiert; größere Maps in Hash-Reihenfolge | Immer kanonische Schlüsselreihenfolge (Term-Ordnung) | [Muster](patterns.md#comprehensions) |
| `bad_generators`-Nutzlast eines Map-Generators in einer Zip-Gruppe | Sein Iterator: `{K, V, Next}`-Kette, die mit `none` endet, in der Reihenfolge von OTP | Dieselbe Kette, in kanonischer Schlüsselreihenfolge aufgebaut | [Muster](patterns.md#comprehensions) |
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3`, die Ausführungsreihenfolge von `maps`-funs (`intersect_with/3`, `merge_with/3`, ...), `proplists:get_keys/1`, `sets` der Version 2 (`to_list/1`, `fold/3`) | Interne Reihenfolge (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel); ein Iterator ist eine Position oder eine `{K, V, Next}`-Kette | Kanonische Schlüsselreihenfolge; ein Iterator läuft über eine Schlüsselliste weiter | [Builtins](builtins.md#erts-internal) |
| Ausgabe von Maps (`erlang:display/1`, `~w`, `~p`) | Reihenfolge des internen Layouts (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel) | Reihenfolge der Map-Schlüssel, wie `~kw` von OTP | [Terme](terms.md#printing) |
| Reihenfolge von `digraph:vertices/1`, `edges/1`, `source_vertices/1`, `sink_vertices/1` sowie der Ordnungen und Komponenten von `digraph_utils`, soweit sie von diesen Listen ausgehen | Hash-Reihenfolge der Knoten- und Kantentabellen | Hash-Reihenfolge von Clause ([ETS](#ets)); Pfade und Nachbarlisten folgen bei beiden der Einfügereihenfolge der Kanten | [builtins](builtins.md#digraph) |
| Reihenfolge von `maps:keys/1`, `values/1`, `to_list/1`, `fold/3`, der von `json:encode/1` geschriebenen Elemente, der von `erl_parse:abstract/1,2` einer map zugewiesenen Felder sowie der Knotenlisten und Durchläufe von `graph` | Die interne Reihenfolge der Map (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel) | Schlüsselreihenfolge | [library](library.md) |
| Ausgabe nativer Records (`erlang:display/1`) | Felder in der Reihenfolge der Atomtabellen-Indizes | Definitionsreihenfolge, wie `~w` | [Native Records](native-records.md#printing-and-order) |
| `==` zwischen nativen Records, deren Felder sich nur als Ganzzahl/Gleitkommazahl unterscheiden | Der Compiler kann es zu `=:=` falten (false) | Numerischer Vergleich (true) | [Native Records](native-records.md#printing-and-order) |
| Externe Konstruktion eines nativen Records eines nicht geladenen Moduls | Scheitert, bis das definierende Modul geladen ist | Jedes Modul des Batches wird beim Start geladen; ein Modul außerhalb des Batches scheitert immer | [Native Records](native-records.md#differences-kept) |
| Ausgabe lokaler Funs (`#Fun<M.Index.Uniq>`) | Index aus der Lambda-Nummerierung des Compilers, `Uniq` ein Hash des Modulcodes | Index der lokalen Funs des Moduls in Quelltextreihenfolge, `Uniq` immer 0 | [Funs](funs.md#comparison-and-printing) |
| Ordnung zweier lokaler Funs eines Moduls | Nach dem Index von OTP | Nach dem Index in Quelltextreihenfolge, sodass Funs verschiedener Funktionen anders geordnet sein können | [Funs](funs.md#comparison-and-printing) |
| Namen anonymer Funs in Stacktraces (`-f/1-fun-N-`) | `N` aus der Nummerierung des Compilers | `N` zählt die Funs von `f/1` in Quelltextreihenfolge | [Funs](funs.md#closures) |
| Eine anonyme Fun im Standardwert eines Record-Felds | Jede Konstruktionsstelle expandiert ihre eigene Kopie: Funs von zwei Stellen sind ungleich | Eine Fun für den Standardwert: Funs von jeder Konstruktionsstelle sind gleich | [Funs](funs.md#closures) |
| Reihenfolge der erfassten Werte von Funs, die in Comprehensions erzeugt werden | Freie Variablen der von der Comprehension erzeugten Funktion | Definitionsreihenfolge in der umschließenden Funktion; nur sichtbar beim Vergleich zweier solcher Funs | [Funs](funs.md#closures) |

## Pids, Referenzen und Prozesse

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Einmalige und periodische Timer von `timer`, außer Sendungen an lokale Pids | Vom Prozess `timer_server` ausgeführt, der bei der ersten Verwendung unter `kernel_sup` startet; die Signale von `exit_after/2,3` kommen von ihm | Kein Timer-Server: Jeder Timer ist ein eigener Prozess, der das Signal von `exit_after` sendet; `cancel/1` kehrt zurück, bevor dieser Prozess die Stornierung gesehen hat | [builtins](builtins.md#timer) |
| Pid-Nummern | Der erste Benutzerprozess ist etwa `<0.80.0>`; Nummern werden wiederverwendet, nachdem die Pid-Tabelle überläuft | Der erste Prozess ist `<0.1.0>`; Nummern stammen aus einer Sequenz und werden nie wiederverwendet | [Terme](terms.md#pids-and-references) |
| Code nach `spawn(Fun)` einer Fun anderer Stelligkeit | Die Typanalyse des Compilers kann den Code nach dem Aufruf als unerreichbar ansehen und entfernen, sodass der Aufrufer sofort die Pid zurückgibt | Der Aufrufer läuft weiter; nur der neue Prozess schlägt mit `{badarity, {Fun, []}}` fehl | [Prozesse](processes.md#builtins) |
| Stack eines `function_clause`, das ein `lists`-Builtin auslöst (`lists:sublist/2`, `lists:max/1`, ...) | Der oberste Frame ist die Erlang-Funktion, oft eine interne Hilfsfunktion (`lists:sublist_2/2`), mit ihren Argumenten | Der Aufrufer liegt oben: Builtins legen keinen Frame an | [Builtins](builtins.md#lists-module) |
| Letztes Bit von `math`-Ergebnissen (`math:erfc(1)`, ...) | Die C-Bibliothek, mit der OTP gebaut wurde | Die C-Bibliothek, die Clause-Programme linken (Windows: `0.15729920705028513` für `erfc(1)`, OTP `0.1572992070502851`) | [Builtins](builtins.md#math-module) |
| Ergebnis von `binary:compile_pattern/1` | `{bm, Ref}` oder `{ac, Ref}` mit einer opaken Referenz | `{bm, [Pattern]}` oder `{ac, Patterns}` | [Builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` eines Sub-Binarys | Die Größe des Binarys, in das es verweist | Seine eigene Größe | [Builtins](builtins.md#binary-module) |
| Speicher ersetzter oder gelöschter persistenter Terme | Im Hintergrund von einem Literalbereichs-Speicherbereinigungsprozess freigegeben, der jeden Prozess den Wert herauskopieren lässt | Jeder Prozess kopiert ihn bei seiner nächsten Zeitscheibe heraus (geparkte sofort durch `put`/`erase`), dann wird der Bereich freigegeben; kein Speicherbereinigungsprozess | [Runtime](runtime.md#persistent-terms) |
| In Nachrichten gesendete persistente Terme | Bleiben wie Literale gemeinsam genutzt: Der Heap des Empfängers wächst nicht | Wie jeder andere Term in den Heap des Empfängers kopiert | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` und `get/0` | Enthalten die Terme, die `kernel` und `stdlib` von OTP beim Start speichern (26 unter OTP 29) | Nur die eigenen Terme des Programms | [Builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` eines kompilierten Moduls | Die `.beam`-Datei, aus der es geladen wurde | `preloaded`: Jedes Modul ist in die ausführbare Datei gelinkt | [Builtins](builtins.md#code-module) |
| Option `priority` von `send/3`, `link/2`, `exit/3`, `exit_signal/3` | Priorisierte Nachrichten und Signale überholen gewöhnliche | Akzeptiert; als gewöhnliche Nachrichten und Signale zugestellt | [processes](processes.md#builtins) |
| `spawn/2,4`, `spawn_link/2,4`, `spawn_monitor/2,4` mit Angabe eines anderen Knotens | Eine Warnmeldung `** Can not start ... on Node **` wird protokolliert | Keine Ausgabe; die nutzlose Pid endet weiterhin mit `noconnection` | [processes](processes.md#builtins) |
| Flags von `system_flag/2` außer `backtrace_depth` und `min_heap_size` (`fullsweep_after`, `schedulers_online`, `multi_scheduling`, `max_heap_size`, ...) | Ändern den Emulator | Ohne Wirkung geprüft und zurückgelesen; `system_logger` beginnt als `undefined` (kein Logger-Prozess); `cpu_topology`, `erts_alloc`, `scheduler_bind_type` ergeben `badarg` | [builtins](builtins.md#system-information) |
| Timer eines suspendierten Prozesses (`receive ... after`, `send_after/3` und `start_timer/3` an seine Pid) | Mit dem Prozess suspendiert, bis er fortgesetzt wird (OTP 28, 29) | Laufen weiter: Ein während der Suspendierung abgelaufenes Zeitlimit wird beim Fortsetzen des Prozesses behandelt; eine Timer-Nachricht wartet in seiner Mailbox | [processes](processes.md#suspending-processes) |
| Ausgabe von `process_display/2` | Stack-Dump von OTP mit Adressen und Stack-Plätzen | Ein `Module:Function/Arity` pro Frame | [processes](processes.md#builtins) |
| `process_flag(save_calls, N)` | Speichert die letzten N Aufrufe für `process_info(Pid, last_calls)` | Gespeichert und zurückgelesen; keine Aufrufe werden gespeichert | [processes](processes.md#builtins) |
| `adler32_combine/3`, `crc32_combine/3` mit einer zweiten Größe über 2^31 - 1 unter Windows | Kombiniert | `badarg` (`z_off_t` von zlib ist dort 32 Bit breit) | [builtins](builtins.md#erlang-module) |
| `init:get_arguments/0`, `init:get_argument/1` | Die Flags des Emulators: `root`, `bindir`, `progname`, `home` und jedes `-Flag` der Befehlszeile | Nur `home`; eine ausführbare Datei hat keine Emulator-Flags | [Builtins](builtins.md#init-module) |
| `init:script_name/0`, `init:script_id/0` | Der Pfad des Boot-Skripts und `{"Erlang/OTP", "29"}` | Der absolute Pfad der ausführbaren Datei und `{"Clause", "29"}` | [Builtins](builtins.md#init-module) |
| `init:get_status/0`, `init:ensure_loaded/1` im Einstieg | `{starting, started}` und Laden von Code, während `escript`-, `-s`- oder `-eval`-Code beim Start läuft; `{started, started}` und `not_allowed` nach dem Start | Immer die Antworten für den gestarteten Zustand | [Builtins](builtins.md#init-module) |
| `init:stop/0,1`, `init:reboot/0` | Geben `ok` zurück; `init` fährt dann die Anwendungen herunter und hält an, während der Aufrufer weiterläuft | Halten sofort an; der Aufruf kehrt nie zurück | [Builtins](builtins.md#init-module) |
| `init:get_argument(home)` unter Windows ohne `HOMEDRIVE`/`HOMEPATH` | Der Profilordner der Shell | `USERPROFILE`, normalerweise derselbe Ordner | [Builtins](builtins.md#init-module) |
| `erlang:halt(Slogan)`, `init:stop(Slogan)` | Gibt den Slogan aus, schreibt `erl_crash.dump` ins aktuelle Verzeichnis und meldet das auf stderr; Exit-Status 1 | Gibt den Slogan auf stderr aus, schreibt keinen Crash-Dump; Exit-Status 1 | [Ausführbare Dateien](executables.md) |
| `init:restart/0,1`, `init:boot/1`, `init:make_permanent/2` | Starten das System im selben Knoten neu, booten es oder setzen das Boot-Skript des nächsten Neustarts | Abgelehnt: Fehler `notsup`, `{error, notsup}` von `make_permanent/2` | [Builtins](builtins.md#init-module) |
| Stelligkeit von `atomics:new/2` | Jede positive Ganzzahl, die der Allokator bedienen kann; eine riesige beendet den Knoten mit einem Crash-Dump | 1 bis 2^27, sonst `badarg` | [Builtins](builtins.md#atomics-and-counters) |
| `counters` mit `write_concurrency` | Zähler pro Scheduler, beim Lesen summiert; der Speicher in `info/1` wächst mit der Anzahl der Scheduler | Ein Atomics-Array; der Speicher in `info/1` ist der des Arrays | [Builtins](builtins.md#atomics-and-counters) |
| `erts_internal:term_type/1` | Die interne Darstellung: `flatmap` oder `hashmap`, `heap_binary`, `refc_binary` oder `sub_binary`, ... | Jede Map `flatmap`, jeder Bitstring `sub_binary` | [Builtins](builtins.md#erts-internal) |
| `erl_prim_loader:get_path/0` | Der Boot-Codepfad | `["."]` bis `set_path/1` | [Ports](ports.md#standard-io-and-files) |
| `file:read_link_info/1,2` eines symbolischen Links unter Windows | Die eigenen Reparse-Point-Daten des Links | Größe und Zeiten des Ziels mit Typ `symlink` | [Ports](ports.md#standard-io-and-files) |
| `inet:gethostbyname/1,2` | Der kanonische Name und die Aliase des Resolvers (`inet_res`, Hosts-Datei, nativ) | Der angefragte Name und keine Aliase; Adressen vom System-Resolver | [Ports](ports.md#sockets) |
| Modul `socket` | Die Socket-NIF-API | Fehlt: Ein Verweis ist ein Kompilierfehler; stattdessen `gen_tcp`, `gen_udp`, `inet` verwenden | [library](library.md) |
| `net:getifaddrs/1,2` mit einem Namensraum, `inet:getifaddrs([{netns, _}])` | `net` ruft sich endlos selbst auf (OTP 29); `inet` liest unter Linux den Namensraum | `{error, enotsup}` | [builtins](builtins.md#network-names) |
| Ausgabelisten von `zlib` | Ein Binary pro internem Block, verschachtelt, wo ein Stream endete und neu begann | Ein Binary pro Aufruf, `[]`, wenn es keines gibt; die Bytes sind die von OTP | [Builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` und lange `zlib`-Aufrufe | Kehren nach einer begrenzten Ausgabemenge zurück (`{continue, Output}`) und geben ab | Entpacken alle eingereihten Eingaben in einem Aufruf (`{finished, Output}`); ein langer Aufruf belegt seinen Scheduler-Thread | [Builtins](builtins.md#zlib-module) |
| Lange `re`-Matches | `re:run/3` und die globale Schleife geben nach einer begrenzten Arbeitsmenge ab | Ein Match läuft bis zum Ende und belegt seinen Scheduler-Thread; ein globaler Lauf gibt nur zwischen Matches ab | [Builtins](builtins.md#re-module) |
| `re:compile/2` mit `export`, `re:import/1` | Ein exportiertes Muster `{re_exported_pattern, ...}`, das ein anderer Knoten importiert | `export` ist `badarg`; `import/1` löst `{not_implemented, import, 1}` aus | [Builtins](builtins.md#re-module) |
| Argumentfehler von `re` | `badarg`, ausgelöst von `re:run/3` (oder `replace`, `split`) mit den Argumenten des Aufrufers und `error_info` | `badarg`, ausgelöst von der `re`-Hilfsfunktion, die das Argument abgelehnt hat, mit deren Argumenten | [Builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` für Module von `kernel`, `stdlib` und `compiler` sowie für die Module der von `code:stick_dir/1` angegebenen Verzeichnisse | Immer `false`; `stick_dir/1` prüft nur, ob sich das Verzeichnis auflisten lässt | [builtins](builtins.md#code-module) |
| `code:root_dir/0` und der anfängliche Codepfad | Installationsverzeichnis von OTP; der Pfad enthält dessen Verzeichnisse `lib/*/ebin` | Verzeichnis der ausführbaren Datei; der Pfad enthält die `ebin`-Verzeichnisse von `lib/` daneben und von `ERL_LIBS`, dann `"."` | [builtins](builtins.md#code-module) |
| `code:load_file/1`, `load_abs/1`, `load_binary/3`, `atomic_load/1`, `prepare_loading/1` mit gültigem Objektcode | Laden das Modul | `{error, badfile}`: Jedes Modul ist in die ausführbare Datei gelinkt (D01) | [builtins](builtins.md#code-module) |
| `code:coverage_support/0` und die Abdeckungsfunktionen | `true` mit dem JIT; Abdeckungsmodi und Zähler | `false`; die anderen lösen `badarg` aus, wie OTP ohne Unterstützung für Abdeckung | [builtins](builtins.md#code-module) |
| `code:get_doc/1` eines im Programm vorhandenen Moduls | Sein Dokumentationsblock nach EEP 48 | `{error, missing}`: Ausführbare Dateien betten keine Dokumentation ein | [builtins](builtins.md#code-module) |
| Formatieren eines großen Terms (`io:format/1,2`) | Läuft in Erlang-Code (`io_lib`) und im Group Leader, sodass der Prozess während des Formatierens verdrängt werden kann | Läuft in einem Builtin-Aufruf bis zum Ende; andere Prozesse warten | [Builtins](builtins.md#portions) |
| Flags von `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` und weitere | Nur `trap_exit` und `min_heap_size`; jedes andere Flag löst `badarg` aus | [Prozesse](processes.md#builtins) |
| Reihenfolge der Fehlerberichte gleichzeitig abstürzender Prozesse | Logger-Reihenfolge | Die Reihenfolge, in der ihre Worker sie beenden | [Prozesse](processes.md#workers) |
| Exit-Signale (`exit/2`, `exit_signal/2`) an einen Prozess, der auf einem anderen Scheduler läuft | In seine Signalwarteschlange eingereiht und später behandelt, während der Sender weiterläuft | Der Sender wartet, bis die Zeitscheibe des Ziels endet, und handelt dann sofort; nur als Zeitverhalten beobachtbar (Nachrichten werden gepuffert, und der Sender läuft weiter) | [Prozesse](processes.md#workers) |
| `term_to_binary/1` einer lokalen Fun oder eines nativen Records | Kodiert (`NEW_FUN_EXT`, ...) | `error:notsup`; `fun M:F/A` wird kodiert | [Builtins](builtins.md#external-term-format) |
| `term_to_binary/1` einer Map mit mehr als 32 Schlüsseln | Hash-Reihenfolge, außer mit `deterministic` | Immer Schlüsselreihenfolge (die Bytes von `deterministic`) | [Builtins](builtins.md#external-term-format) |
| `binary_to_term/1` der Pid, des Ports oder der Referenz eines anderen Knotens; Option `local` von `term_to_binary/2` | Externe Identitäten; Kodierung `LOCAL_EXT` | `badarg` | [Builtins](builtins.md#external-term-format) |
| Zeitgrenze von Timern | Hängt von der nativen Zeiteinheit ab (etwa 2^49.7 ms unter Windows) | Relative Zeit 0..2^49-1 ms auf jeder Plattform | [Prozesse](processes.md#timers) |
| `unique_integer/0,1` ohne `positive` | Kann negativ sein | Immer positiv und steigend | [Builtins](builtins.md#time) |
| Elemente `current_function`, `initial_call`, `current_stacktrace`, ... von `process_info/2` | Gemeldet | `error:{notsup, Item}`; `process_info/1` lässt sie weg | [Prozesse](processes.md#introspection) |
| `reductions` von `process_info/2`; `reductions`, `garbage_collection`, `io` von `statistics/1` | Gezählt | 0 (nicht geführt) | [Builtins](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Bereinigt vor der Rückkehr | Bereinigt am nächsten Safepoint des Ziels | [Prozesse](processes.md#introspection) |
| `erlang:system_info(machine)` und damit `?MACHINE` von `epp` und das dadurch benannte Makro | `"BEAM"`, `'BEAM'` | `"Clause"`, `'Clause'` | [builtins](builtins.md#system-information) |
| `erlang:system_info(schedulers)` eines mit einer Affinitätsmaske gestarteten Programms (`start /affinity`, `taskset`) | Ein Scheduler pro logischem Prozessor des Hosts (32 bei einer Maske für 7 CPUs), `schedulers_online` einer pro CPU der Maske | Beide einer pro CPU der Maske: Clause startet nur die aktiven Worker | [processes](processes.md#workers) |
| Tuning-Optionen von `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Angewendet | Geprüft und akzeptiert, nicht angewendet | [Prozesse](processes.md#spawn-options) |
| `hibernate/3` | Verwirft den Stack; der Prozess endet, wenn `M:F` zurückkehrt | Behält den Stack; das Ergebnis von `M:F` kehrt zum Aufrufer von `hibernate/3` zurück | [Prozesse](processes.md#spawn-options) |
| `monitor(port, Item, Options)` mit Optionen | Akzeptiert | `badarg` | [Prozesse](processes.md#aliases) |
| `spawn_request_abandon/1` | `true`, solange die Antwort aussteht | Immer `false`: Die Antwort wird gesendet, bevor `spawn_request` zurückkehrt | [Prozesse](processes.md#spawn-options) |
| Letztes Bit von `math:log2/1` (Windows) | Der Windows-Build von OTP teilt `log(X)` durch `log(2)` (`math:log2(1.0e308)` ist `1023.1538532253077`) | `log2` der C-Bibliothek (`1023.1538532253076`) | [Builtins](builtins.md#math-module) |
| `phash/2`, `phash2/1,2` von Pids, Ports, Referenzen, funs und native records | Hashes der Prozess-, Port- und Referenznummern von OTP, des Index und der eindeutigen Nummer einer fun, des Hashs einer record-Definition | Hashes der Nummern von Clause, des Moduls, der Stelligkeit oder des Index und der eingefangenen Werte einer fun, der Feldwerte eines record; jeder andere Term hat den Hash-Wert von OTP | [Builtins](builtins.md#hashing) |
| `dict:fold/3`, `map/2`, `filter/2` mit einer Nicht-fun | `function_clause` oder `{badfun, F}`, wenn der erste von OTP besuchte Bucket einen Eintrag enthält | `function_clause` | [Builtins](builtins.md#collections) |
| `erlang:is_builtin/3` von `lists:reverse/2` und anderen in C implementierten Bibliotheksfunktionen | `true` | `false`: nur die Builtins der Runtime und `apply/2,3` | [Funs](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` von `fun_info/1,2` einer lokalen Fun | Pid des Erzeugers, Prüfsummen des Compilers | `undefined`, MD5 des Modulnamens | [Funs](funs.md#fun-information) |
| Kontext von `md5_init/0` | Der 92-Byte-Zustand von OTP | Clauses 96-Byte-Zustand; die Digests sind gleich | [Builtins](builtins.md#hashing) |
| `erlang:delete_module/1` eines geladenen Moduls | Macht seinen Code alt (`true`) | `error:notsup`: Gelinkter Code bleibt | [Builtins](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Bereitet ein gültiges BEAM-Binary vor | Immer `{error, badfile}` | [Builtins](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | Die vorgeladenen Boot-Module | Jedes Modul des Programms | [Builtins](builtins.md#code-loading) |
| `list_to_pid/1` einer nie vergebenen Nummer | Gibt einen Pid-Term zurück | `badarg`: Nur von diesem Programm erzeugte Pids werden zugelassen | [Terme](terms.md#pids-and-references) |
| `list_to_port/1` einer nie vergebenen Nummer | Gibt einen Port-Term zurück | `badarg`: Nur von diesem Programm geöffnete Ports werden zugelassen | [Ports](ports.md#identity) |
| Werte von `port_info/1,2` | `id` ist ein Tabellenindex; `memory`, `queue_size`, `locking` beschreiben den Treiber | `id` ist die Port-Nummer; `memory` und `queue_size` sind 0; `locking` ist `port_level` | [Ports](ports.md#builtins-and-port-messages) |
| Schreiben in eine nur zum Lesen geöffnete Datei | `{error, eacces}` unter Windows, `{error, ebadf}` anderswo | `{error, ebadf}` überall | [Ports](ports.md#standard-io-and-files) |
| Port von `win32reg` | Der eingelinkte Port `registry__drv__` (`{spawn, "registry__drv__ rw"}`), der Befehle mit Port-Nachrichten beantwortet | Der Treiber `clause_registry` (`{spawn_driver, ...}`), der dieselben Antworten über `port_control/3` liefert; `port_info/2` nennt ihn `clause_registry` | [ports](ports.md#the-registry) |
| Programmname von `argparse` ohne die Option `progname` | `progname` des Emulators (`erl`) | Name der ausführbaren Datei ohne Erweiterung (`init` hat kein `progname`) | [library](library.md) |
| Oberster Stack-Frame eines Fehlers bei der Befehlsvalidierung von `argparse` | Die validierende Funktion (`argparse:validate_command/2`, `validate_option/2`, eine fun darin) mit `[Entity]` | `argparse:validate/2` mit `[Entity]` | [builtins](builtins.md#argparse) |
| `escript:script_name/0` | Pfad des Escripts, das erste einfache Argument | Pfad der ausführbaren Datei: Ein Clause-Programm ist sein eigenes Skript | [library](library.md) |
| `escript:extract/2` mit `compile_source` | Der zu einer beam-Datei kompilierte Quelltext | `{error, {compile, ...}}`: Clause-Programme haben keinen Compiler | [library](library.md) |
| `erl_abstract_code:debug_info(core_v1, ...)` (Core Erlang von beam_lib) | Core Erlang vom Compiler | `{error, failed_conversion}`: Clause-Programme haben keinen Compiler | [library](library.md) |
| `zstd:get_frame_header/1` eines abgeschnittenen Frame-Headers | Die Felder nicht initialisierten Speichers | Die Felder auf null (`'ZSTD_frame'`, Größen 0) | [builtins](builtins.md#zstd-module) |
| `file:open/2` mit `raw` oder `ram` | Ein im Aufrufer bedienter record `#file_descriptor{}` (`is_pid/1` ist false); `io`-Anfragen darauf scheitern; eine `ram`-Datei hat kein `read_line/1` (`undef`), und eine geschlossene antwortet mit `{error, einval}` | Eine Dateiserver-Pid wie bei anderen Dateien; positionierte Ein-/Ausgabe und `sendfile/5` antworten wie bei den raw-Dateien von OTP; eine `ram`-Datei beantwortet `read_line/1` und Ein-/Ausgabeanfragen mit `{error, enotsup}`, nach dem Schließen mit `{error, terminated}` | [ports](ports.md#standard-io-and-files) |
| `file:truncate/1` auf einer nur zum Lesen geöffneten Datei | Der Fehler der Plattform (`eacces` unter Windows, `einval` anderswo) | Der Fehler der C-Runtime für den Deskriptor (`ebadf` oder `einval`); der Server stoppt wie bei OTP | [ports](ports.md#standard-io-and-files) |
| Mit `{utf16, _}` oder `{utf32, _}` geöffnete oder darauf gesetzte Dateien | Zeilen und Zeichen in der Kodierung dekodiert | Zeilen enden vor dem Dekodieren an einem Byte 10 | [ports](ports.md#standard-io-and-files) |
| Sequenzen von `io_ansi` unter Linux und macOS | Aus der terminfo-Datenbank von `TERM`, soweit sie die Fähigkeit enthält (`setaf`, `sgr0`, ...); `tput/1,2`, `tigetnum/1`, `tigetflag/1`, `tinfo/0` lesen sie | Die eingebauten ANSI-Sequenzen, die OTP ohne terminfo verwendet (wie OTP unter Windows); `tigetnum/1`, `tigetflag/1`, `tinfo/0` antworten mit `{error, enotsup}`, `tput/1,2` lösen `{enotsup, Capability}` aus; `enabled/0,1` verlangt ein `TERM` ungleich `dumb` | [library](library.md#contents) |
| `io_ansi:scan/1` und `tput/1,2` unter Windows | Scheitern mit `try_clause` am `{error, enotsup}` von terminfo | `scan/1` matcht die eingebauten Sequenzen; `tput/1,2` lösen `{enotsup, Capability}` aus | [library](library.md#contents) |
| `socket` unter Windows: `recvmsg`, `sendmsg`, `sendfile`, `sendmmsg`, `recvmmsg` | Lösen `notsup` aus | Funktionieren wie unter Linux und macOS | [library](library.md#contents) |
| `socket` unter Windows: ein Datagramm länger als die Länge von `recv` | `{error, {completion_status, ...more_data...}}` | Das abgeschnittene Datagramm, wie anderswo | [library](library.md#contents) |
| `socket` unter Linux und macOS: `ioctl/2,3,4`, `getopt_native/3`, `setopt_native/3`, `open/1,2` eines Deskriptors, Domäne `local`, SCTP | Unterstützt | Wie von OTP unter Windows abgelehnt (`{error, {invalid, ...}}`, `notsup`); `local` ergibt `{error, eafnosupport}` | [library](library.md#contents) |
| `socket:info/1`, `i/0,1,2` | Zähler und Zustände des NIF, `fd` ist der Deskriptor | Zähler der erfolgten Aufrufe, Zustände wie vom Modul geführt; `Fd` ist die Port-Nummer | [library](library.md#contents) |
| Antworten von `inet_res` | Antworten von `gethostbyname`, `getbyname` und `gethostbyaddr` werden nach TTL in `inet_db` zwischengespeichert; eine zwischengespeicherte Abfrage kann Adressen anders anordnen | Nichts wird zwischengespeichert: Jede Abfrage fragt die Nameserver | [library](library.md#contents) |
| Resolver-Konfiguration unter Linux und macOS | `inet_db` liest auch `host.conf`/`nsswitch.conf` und `inetrc`-Dateien, verfolgt Änderungen an `resolv.conf` und leitet unter Linux die Domäne aus dem Hostnamen ab | Die Zeilen `nameserver`, `domain` und `search` von `resolv.conf` und die Hosts-Datei, einmal gelesen | [library](library.md#contents) |
| `os:set_signal(Signal, handle)` (Linux, macOS) | Das Signal geht an `erl_signal_server`, dessen Standard-Handler das System bei `sigterm` stoppt und bei `sigusr1` und `sigquit` anhält | Kein `erl_signal_server`: `sigterm` und `sigquit` beenden mit Status 0, `sigusr1` mit Status 1, andere werden verworfen; ohne `set_signal` behält `SIGTERM` die Standardaktion des Systems | [ports](ports.md#subprocesses) |
| Leere Argumente von `{spawn_executable, F}` unter Windows | Aus der Befehlszeile entfernt | Als `""` übergeben | [Ports](ports.md#subprocesses) |
| `{exit_status, S}` und `eof` eines gestarteten Programms | Unbestimmte Reihenfolge, `exit_status` kann vor den letzten Daten ankommen | Nach allen Daten, vor `eof` | [Ports](ports.md#subprocesses) |
| Ausgelastete Ports | Ein Port mit zu viel ausstehender Ausgabe suspendiert Sender, Socket-Ports eingeschlossen; `force` von `port_command/3` funktioniert bei Treibern, die es erlauben | Nur Ports gestarteter Programme werden ausgelastet; `fd`- und Socket-Ports nie; `force` löst bei jedem Treiber `notsup` aus | [Ports](ports.md#busy-ports) |
| `{active, N}` von Sockets | Eine Ganzzahl `N` zählt Nachrichten bis `{tcp_passive, S}` | `exit(badarg)`; nur `true`, `false` und `once` | [Ports](ports.md#sockets) |
| Socket-Optionen von `inet_drv` selbst (`header`, `deliver`, `exit_on_close`, `send_timeout`, `send_timeout_close`, `delay_send`, Wasserstandsmarken, `packet_size`, `show_econnreset`, `buffer`, `read_packets`, `recvtos`, `recvttl`, `line_delimiter`) | Angewendet | Mit den Standardwerten von OTP gespeichert und von `getopts/2` gemeldet, ohne Wirkung; die Systemoptionen (`nodelay`, `keepalive`, `linger`, Puffer, `tos`, Multicast, ...) werden angewendet | [ports](ports.md#sockets) |
| Andere Socket-Optionen (`{packet, line \| http \| ...}`, `{raw, ...}`, `bind_to_device`, `netns`) | Funktionieren | `exit(badarg)` beim Öffnen, `{error, einval}` von `setopts/2` und `getopts/2` | [ports](ports.md#sockets) |
| `inet:getopts(S, [multicast_if])` unter Windows | Liest bei einem TCP-Socket nicht initialisierten Speicher und nach dem Setzen bei einem UDP-Socket die Any-Adresse | Der Systemwert; die Any-Adresse, wenn der Socket keine hat | [ports](ports.md#sockets) |
| `port_info(Socket, input \| output)`, `input` und `output` von `inet:info/1` | Die Bytes der Treiberbefehle und Antworten | 0: Socket-Verkehr wird nur von `inet:getstat/1,2` gezählt | [ports](ports.md#sockets) |
| Socket-Fehlergründe | Jeder POSIX-Grund, den das System meldet | Die gängigen (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); andere sind `eio` | [Ports](ports.md#sockets) |
| Port-Eingabe, während der verbundene Prozess 1.024 Nachrichten hält und laufen kann | Liest und liefert weiter | Liefert nicht mehr, bis die Zeitscheibe des Prozesses endet; ab 64 KiB gehaltener Daten wird nicht mehr gelesen, sodass das schreibende Programm blockiert | [Ports](ports.md#busy-ports) |
| `gen_tcp:close/1` mit ausstehender Ausgabe | Wartet bis zur Einstellung `linger`/`send_timeout`, bis die Ausgabe gesendet ist | Kehrt sofort zurück; der I/O-Thread sendet die ausstehende Ausgabe und schließt dann | [Ports](ports.md#sockets) |
| Typen von `monitor/2` | `process`, `port`, `time_offset` | `process` und `port`; `time_offset` löst `badarg` aus (keine Änderungen des Zeitversatzes) | [Prozesse](processes.md#monitors) |
| `exit/2`, `exit_signal/2` an eine Referenz | Sendet an den Prozess-Alias, falls die Referenz ein aktiver ist | Nichts: Exit-Signale gehen nie an Aliase | [Prozesse](processes.md#exit-signals) |
| Referenznummern | Mischen eine Scheduler-Kennung und Zähler pro Scheduler (`#Ref<0.178111994.4235460610.214105>`) | Ein programmweiter Zähler (`#Ref<0.0.0.1>`), sodass Referenzen nach Erzeugung geordnet sind | [Terme](terms.md#pids-and-references) |

## Fehler, Stacktraces und Berichte

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Orte im Stacktrace | `[{file, F}, {line, L}]`, `error_info` für `error/3` | Immer `[]`; kein `error_info`, sodass `erl_error:format_exception/3,4` dafür keine Orte oder Zeilen `*** argument` zeigt | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` mit Stack-Einträgen `{Fun, Args}` | Akzeptiert | Abgewiesen | [ABI](abi.md#stack-traces) |
| Oberster Frame bei `function_clause` | Argumentliste | Stelligkeit | [ABI](abi.md#stack-traces) |
| Oberster Frame bei `undef` eines Aufrufs `M:F(A1, ..., An)` | `{M, F, [A1, ..., An], []}` | `{M, F, N, []}`: Die Stelligkeit anstelle der Argumente (`apply/3` und fun-Aufrufe zeigen die Argumente) | [funs](funs.md#dynamic-calls) |
| Dynamischer Aufruf eines Exports, den eine ausführbare Datei nicht erreichen kann (sein Modul wird nur über einen Stacktrace, eine Ausnahme oder eine Nachricht von außerhalb des Programms benannt) | Ruft ihn auf | `undef`, außer beim Bauen mit `--keep-exports`; `function_exported/3` und `module_info(exports)` führen ihn trotzdem auf | [Ausführbare Dateien](executables.md#export-liveness) |
| Frames fehlschlagender BIFs/Operatoren | Vorhanden (`{erlang, '+', Args, ...}`) | Fehlen; nichts unterhalb der Einstiegsfunktion | [ABI](abi.md#stack-traces) |
| Atomtabelle voll (`list_to_atom/1`) | Der Emulator bricht ab (`no more index entries in atom_tab`) und schreibt einen Crash-Dump | `clau: runtime failure: entry call failed: resource_limit`, Exit-Code 70 | [Builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` mit Zeichen über 255 | Die ersten Ziffern verwenden nur das niedrige Byte jedes Zeichens (`[16#131]` ist 1) | `badarg` | [Builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` eines BIF | Wahr für jedes BIF des Emulators | Nur wahr für die Builtins, die diese Runtime bereitstellt | [Builtins](builtins.md#how-calls-reach-them) |
| Fehlerberichte abgestürzter Prozesse | An den Logger gesendet, später von dessen Standard-Handler geschrieben (unter `erl` auf die Standardausgabe, oft verloren, wenn ein Escript vorher anhält) | Auf stderr geschrieben, wenn der Prozess endet, vor jeder späteren Ausgabe; kein `logger`-Ereignis, daher für Handler und Filter nicht sichtbar | [processes](processes.md#exits) |
| Aufrufe von Funktionen, die nie zurückkehren | Als Endaufrufe kompiliert (Aufrufer fehlt im Trace) | Gewöhnliche Aufrufe (Aufrufer vorhanden) | [ABI](abi.md#stack-traces) |
| Ausnahmen innerhalb einer bekannten anonymen fun bei `-O2` (`F = fun ... end, F(X)`, `lists:map(fun ... end, L)` und die anderen Listenschleifen, `maps:fold(fun ... end, A, M)`) | Frames der fun (`-f/1-fun-0-`) und der Hilfsfunktionen von `lists` und `maps` (`lists:map_1/2`) | Der Rumpf der fun läuft im Aufrufer eingebettet: Diese Frames fehlen, und ein unechter Listenrest bei `map/2`, `foldl/3`, `all/2`, `any/2`, `flatmap/2` löst `function_clause` mit dem Aufrufer oben aus | [funs](funs.md#inlined-funs) |
| Hostspeicher erschöpft | Der Emulator meldet, dass er keinen Speicher allozieren kann, schreibt einen Crash-Dump und stoppt | `clau: runtime failure: entry call failed: out_of_memory`, Exit-Code 70, kein Dump | [Runtime-Heap](runtime-heap.md#failure-behavior) |
| Speicherung von Maps mit mehr als 32 Schlüsseln | Ein HAMT auf dem Heap aus Knoten mit 16-facher Hash-Verzweigung | Ein B+-Baum auf dem Heap mit bis zu 16 Einträgen pro Knoten in Schlüsselreihenfolge; Heap-Größen großer Maps weichen von denen in OTP ab | [Runtime-Heap](runtime-heap.md#map-trees) |
| Speicherobergrenze pro Prozess | `max_heap_size` (in Wörtern, Heap und Stack) beendet den Prozess mit Grund `killed` und protokolliert einen Fehlerbericht | `--max-heap` / `--max-stack` (Bytes) und das runtimeweite `--max-memory` lassen den anfordernden Prozess mit `resource_limit` fehlschlagen: `clau: runtime failure: entry call failed: resource_limit`, Exit-Code 70 | [Runtime-Heap](runtime-heap.md#runtime-memory-limit) |
| Programmargumente | `escript` übergibt jedes Argument an `main/1`; Emulator-Flags (`+t`) kommen aus `%%!` oder `ERL_FLAGS` | Führende Runtime-Optionen (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) werden zuerst herausgenommen; `CLAUSE_FLAGS` enthält dieselben Optionen | [Ausführbare Dateien](executables.md#runtime-options) |
| Nicht abgefangene Ausnahme in einem gewöhnlichen Einstiegsmodul | `escript` endet mit 127 | Endet mit 1 und einer Zeile `uncaught exception <class>: <reason>` (Escript-Quellen behalten 127) | [Ausführbare Dateien](executables.md) |
| Compiler-Diagnosen | Wortlaut von `erl_lint` (`variable 'X' is unbound`) und Warnungen | Eigener Wortlaut (`unbound variable X`); OTP-Lint-Warnungen werden größtenteils nicht ausgegeben (auch Warnungen zu nativen Records: unbekannte Felder in Zugriff, Aktualisierung und Mustern, qualifizierte Konstruktion im eigenen Modul ohne Werte, ungenutzte oder in Headern definierte Records; ein späteres Muster, das einen aus einem Zweig exportierten Namen matcht) | [Semantik](semantic.md#bindings) |
| Behaviour-Modul mit handgeschriebener `behaviour_info/1` | Ruft sie beim Kompilieren der Nutzer auf und warnt vor fehlenden, falsch definierten oder veralteten Callbacks | Nicht ausgewertet: Die Callbacks der Nutzer werden nicht geprüft | [Semantik](semantic.md#behaviours) |
| Behaviour-Module weder im Batch noch in der Clause-Bibliothek (`application`, ...) | Aus dem Codepfad geladen; ihre Callbacks werden geprüft | Warnung `behaviour M undefined` | [semantic](semantic.md#behaviours) |
| Standard-Handler von `logger` | `logger_std_h` schreibt asynchron mit Überlastschutz (Synchron-, Verwerf- und Leerungsmodi, Grenzen für Lastspitzen, Beenden bei Überlast) | Ebenfalls auf `standard_io` (`standard_error` mit `CLAUSE_LOGGER_TYPE=standard_error`), aber jedes Ereignis wird vor der Rückkehr des Protokollierungsaufrufs geschrieben; die Überlastoptionen werden ohne Wirkung geprüft und gespeichert | [library](library.md) |
| Handler-Prozesse von `logger_std_h` | Von `logger_sup` überwacht, nach `overload_kill_restart_after` neu gestartet | Mit dem `logger`-Server verlinkt; ein Handler, dessen Prozess stirbt, wird entfernt | [library](library.md) |
| `net_adm:names/0,1` | Fragt epmd: `{ok, Names}`, wenn auf dem Host ein epmd läuft | `{error, address}`: Clause hat keinen epmd-Client | [library](library.md) |
| `net_kernel:start/1,2` | Startet die Verteilung oder liefert den Fehler von OTP, wenn das nicht möglich ist | Nicht verfügbar (`not_implemented`) | [library](library.md) |
| Ablaufverfolgung: `erlang:trace/3`, `trace_pattern/2,3`, `trace_info/2`, `trace_delivered/1`, `system_monitor/0,1,2`, `system_profile/0,2`, `seq_trace/2`, `seq_trace_info/1`, `seq_trace_print/1,2`, `dt_*`, das Modul `trace`, `erl_tracer:enabled/3`, `trace/5` | Verfolgen den Ablauf | `error:notsup` | [builtins](builtins.md#erlang-module) |
| Token von `seq_trace` | Mit Nachrichten weitergegeben; fortlaufende Nummern zählen sie; ein System-Tracer empfängt Trace-Nachrichten | Nur pro Prozess gespeichert: nicht weitergegeben, Nummern bleiben wie gesetzt, keine Trace-Nachrichten | [library](library.md) |
| Geltungsbereiche von `pg` und `global` | Replizieren zwischen verbundenen Knoten; `pg` überwacht Knoten über `net_kernel` | Ein Knoten, keine Gegenstellen oder Knotenüberwachung | [library](library.md) |
| Anwendungsressourcen | Beim Laden im Codepfad gefundene `.app`-Dateien; `sys.config`, `-config` und Argumente `-App Key Value` setzen Umgebungen | Aus den Ressourcendateien des Builds in die ausführbare Datei kompiliert; Änderungen erfordern einen Neubau; keine Konfigurationsdateien oder -argumente | [library](library.md#applications) |
| Anwendungen `kernel` und `stdlib` | Beim Booten gestartet; `kernel` hat einen Master und einen obersten Supervisor | Ohne Master geladen und laufend: `get_supervisor(kernel)` ist `undefined`, `info/0` führt sie als laufend mit `undefined` auf | [library](library.md#applications) |
| `application:ensure_all_started/3` mit `concurrent` | Startet unabhängige Anwendungen gleichzeitig; die Liste folgt der Abschlussreihenfolge | Startet sie nacheinander, Abhängigkeiten zuerst | [library](library.md#applications) |
| `application:takeover/2` | Wartet auf die Steuerung verteilter Anwendungen | Endet mit `noproc` (kein `dist_ac`), wie `load/2` mit Knoten bei beiden | [library](library.md#applications) |
| Ein-/Ausgabeanfragen an einen Anwendungsmaster | An den Group Leader weitergeleitet, unter dem die Anwendung gestartet wurde | Über Standard-Ein-/Ausgabe beantwortet | [library](library.md#applications) |
| `erlang:process_flag(error_handler, Module)` | Die Runtime ruft bei undefinierten Aufrufen `Module:undefined_function/3` und `undefined_lambda/3` auf | `badarg`; `process_info/2` meldet immer `error_handler`, und undefinierte Aufrufe lösen direkt `undef` aus ([`error_handler`](library.md) ist nur aufrufbar) | [library](library.md) |
| Details von Absturzberichten (`proc_lib`) | Ausnahmetext von `erl_error` mit erweiterten Fehlerinformationen; Nachbarn mit `current_function`, `initial_call` und `current_stacktrace`; echte `reductions` | Klassenzeile der Ausnahme und Stack-Frames ohne erweiterte Fehlerinformationen; Nachbarn ohne diese Elemente; `reductions` 0 | [library](library.md) |
| `client_info` in Fehlerberichten von `gen_server`, `gen_statem` und `gen_fsm` | `current_stacktrace` des aufrufenden Prozesses | `[]`: Clause hält keinen aktuellen Stack eines anderen Prozesses vor | [library](library.md) |
| `-behaviour` mit einem Wert, der kein Atom ist | Die Warnung gibt den Term mit `~w` aus (`behaviour [115,116,114] undefined`) | Gibt den Quelltext des Attributs aus (`behaviour "str" undefined`); der Fehler ist derselbe | [Semantik](semantic.md#behaviours) |
| `module_info(md5)` und das daraus von OTP abgeleitete `vsn` | MD5 des kompilierten BEAM-Codes | MD5 des ausgegebenen Quelltexts des Moduls; die abgeleitete `vsn`-Ganzzahl weicht entsprechend ab | [Semantik](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` der Compiler-Anwendung von OTP, die ihr übergebenen `options` | Die Version von Clause; `options` immer `[]` | [Semantik](semantic.md#predefined-functions) |
| `module_info(functions)` | Führt auch die Funktionen auf, die OTP für Funs erzeugt (`'-f/0-fun-0-'/0`) | Nur Quelltextfunktionen und die vordefinierten | [Semantik](semantic.md#predefined-functions) |
| `-nominal` in `module_info(attributes)` | Als `{nominal,[{Name,AbstractType,Params}]}` im abstrakten Format behalten | Weggelassen | [Semantik](semantic.md#predefined-functions) |
| Eine Funktion eines Clause-Bibliotheksmoduls, die Clause nicht implementiert hat (ein `erlang`-BIF, `lists:rmerge/2`, ...) | Läuft | Kompiliert; löst beim Aufruf `error({not_implemented, F, A})` aus, mit `M:F/A` oben auf dem Stack ([Status](../library/modules.terms)) | [Bibliothek](library.md#provided-or-missing), [Builtins](builtins.md#erlang-module) |
| Import eines Moduls außerhalb des Batches | Kompiliert; der Aufruf löst zur Laufzeit `undef` aus, wenn das Modul fehlt | Kompilierfehler `unknown module M`, wenn der Import aufgerufen wird (ungenutzte Importe brauchen kein Modul) | [Semantik](semantic.md#imports) |
| Warnung `import directive overrides auto-imported BIF` | Für jedes automatisch importierte BIF von `erl_internal:bif/2` | Nur für die automatisch importierten BIFs, die Clause implementiert | [Semantik](semantic.md#imports) |

## Sprachliche Grenzfälle

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Ganzzahlsegment breiter als die Ganzzahlgrenze, Wert darüber hinaus (`<<V:4194241>>` aus lauter Einsen) | Der x86-JIT matcht mit einem ungültigen Term; dessen Verwendung bringt die VM zum Absturz | Kein Match | [Terme](terms.md#integers) |
| Zip-Gruppe, deren lockere und strikte Generatoren sich eine Variable teilen | Der Überspringtest behält Variablen strikter Muster in den lockeren Mustern | Ein verworfener Schritt wird übersprungen, sobald die strikten Muster für sich allein matchen | [Muster](patterns.md#comprehensions) |
| Aufruf einer externen Fun, `M:F(Args)` oder `apply/3` eines Moduls außerhalb des Programms | Lädt das Modul aus dem Codepfad, `undef`, wenn es fehlt | `undef`; Bibliotheksmodule werden nur Teil des Programms, wenn es sie mit einem literalen Atom benennt | [Funs](funs.md#dynamic-calls), [Bibliothek](library.md#how-programs-get-them) |
| Dateien ohne `#!`, die als Escripts übergeben werden | `escript file.erl` überspringt die erste Zeile | Als gewöhnliche Module kompiliert | [Ausführbare Dateien](executables.md) |
| Vorkompilierte Beam- und Archiv-Escripts | Laufen | Nicht unterstützt | [Ausführbare Dateien](executables.md) |
| Modulname eines Escripts ohne `-module` | `<name>__escript` plus ein Zeitstempel-/Eindeutigkeitssuffix | `<name>__escript`, deterministisch | [Ausführbare Dateien](executables.md#escripts) |
| `include_lib` einer Anwendung, die in mehreren `<app>-<version>`-Verzeichnissen gefunden wird | Der Codepfad enthält eine Version (der Start wählt die höchste); keine Diagnose | Die höchste Version unterhalb jedes durchsuchten Verzeichnisses, mit einer Warnung pro Lauf, die sie auflistet | [Präprozessor](preprocessor.md#compatibility-policies) |
| Eine `-spec`, deren Typen keinen Wert mit dem inferierten Ergebnis, der Einstiegsdomäne oder den Argumenten eines Aufrufs gemeinsam haben | Kompiliert; Dialyzer kann warnen | Eine widersprochene Einstiegsdomäne eines Arguments ist ein Kompilierfehler, der den deklarierten und den inferierten Typ nennt; ein widersprochenes Ergebnis oder ein widersprochener Aufruf ist eine Warnung, und die inferierten Typen werden verwendet | [Semantische Analyse](semantic.md#inference) |

## ETS

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Reihenfolge von `first/1`, `next/2`, `tab2list/1`, `foldl/3` und `i/1` über Tabellen vom Typ `set`, `bag` und `duplicate_bag` sowie die Nummerierung von `slot/2` | Lineare Hash-Plätze, Sperre für Sperre durchlaufen; die Reihenfolge ändert sich mit dem Wachstum der Tabelle | Teile, dann Buckets in Reihenfolge, dann Schlüssel in Einfügereihenfolge innerhalb eines Buckets; ein Platz ist ein Bucket | [runtime](runtime.md#ets-tables) |
| `ets:all/0` | Enthält die Tabellen von `kernel` und `stdlib` von OTP; Reihenfolge der Scheduler-Antworten | Nur die Tabellen des Programms, ohne bestimmte Reihenfolge | [builtins](builtins.md#ets) |
| `memory` von `info/2` | Allozierte Wörter der Tabelle und ihrer Objekte | Gespeicherte Objektwörter plus eigener Zusatzaufwand von Clause | [builtins](builtins.md#ets) |
| `{write_concurrency, auto}` | Sperrenzahl passt sich der Konkurrenz an (64 bis 8192) | 64 feste Teile wie bei `true`; `stats` meldet 64 Sperren | [runtime](runtime.md#ets-tables) |
| `compressed` | Speichert Elemente außer dem Schlüssel im externen Format | Akzeptiert und gemeldet; Objekte werden unverändert gespeichert | [builtins](builtins.md#ets) |
| `stats` von `info/2` eines `ordered_set` mit `write_concurrency`; `data`; `binary` | CA-Baum `{RouteNodes, BaseNodes, MaxDepth}`; gibt die Tabelle aus; die außerhalb des Heaps liegenden binary-Werte der Tabelle | `false`; `true` ohne Ausgabe; `[]` | [builtins](builtins.md#ets) |
| `badarg` eines `ets`-Builtins | Enthält `error_info` mit einer Ursache (`id`, `access`, `type`, ...) | Einfaches `badarg` | [builtins](builtins.md#ets) |
| Reihenfolge der Ergebnisse von `select`, `match` und `match_object` bei Hash-Tabellen sowie die Ergebnisse jedes Blocks von `select/3` | Ergebnisse jedes Durchlaufschritts vorne angehängt, neueste zuerst; lineare Hash-Plätze | Durchlaufreihenfolge der Teile und Buckets von Clause; jeder Block enthält die ersten `Limit` gesammelten Ergebnisse | [builtins](builtins.md#ets) |
| `select_delete/2`, `select_replace/2` über eine ganze Tabelle | Unterbrechen alle 1000 Objekte (die Tabelle bleibt währenddessen fixiert) | Laufen am Stück, jeder Teil unter seiner Sperre | [runtime](runtime.md#ets-tables) |
| Match-Spezifikationen mit einer Variablen mit Nummer 25 oder höher | Nummerieren jedes Atom `'$N'` der Spezifikation neu, selbst innerhalb von `{const, ...}` (so ergibt `{const, '$30'}` den Wert `'$0'`) | Variablen behalten ihre Nummern; `{const, '$30'}` ergibt `'$30'` | [runtime](runtime.md#match-specifications) |
| Guards und Rümpfe von Match-Spezifikationen mit mehr als 1000 Verschachtelungsebenen | Kompilieren, bis der C-Stack knapp wird (`system_limit`) | `system_limit` | [runtime](runtime.md#match-specifications) |
| Trace-Aktionen in `erlang:match_spec_test/3`: `enable_trace`, `disable_trace`, `trace` mit gültigen Flags | Ändern die Trace-Flags des Aufrufers (29.1.1 stürzt ohne Tracer ab) | `true` nach Prüfung der Flags (und dass ein Pid-Argument lebt); nichts ändert sich | [builtins](builtins.md#ets) |
| `ets:tab2file/2,3` und `file2tab/1,2` | Über einen nach einer neuen Referenz benannten disk_log-Prozess | Direkt mit `file` geschrieben und gelesen | [builtins](builtins.md#ets) |
| `{process_dump}` und `{current_stacktrace}` in `erlang:match_spec_test/3` | Dump-Text des Prozesses; sein Stacktrace | `<<>>`; `[]` | [builtins](builtins.md#ets) |

## dets

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Gemeinsam an einer Tabelle wartende Anfragen | Gleichzeitig eingereihte Such-, Einfüge- und Löschanfragen teilen eine Cache-Aktualisierung; Suchanfragen werden vor den Schreibvorgängen beantwortet; eine fixierte Tabelle lässt manche Schreiber 1 ms schlafen | Jede Anfrage einzeln in Ankunftsreihenfolge | [builtins](builtins.md#dets) |
| Lange dets-Operationen (Reparaturen, `init_table/2,3`, Kompaktierungen, Leeren eines großen Caches) | Erlang-Code, anhand von Reduktionen verdrängt | Jeweils ein Builtin-Aufruf; der Worker der Tabelle führt währenddessen nichts anderes aus | [builtins](builtins.md#dets) |
| Prozesse von `dets` | Der `dets`-Server und `dets_sup` unter `kernel_safe_sup`, Tabellen unter `dets_sup` | Ein bei der ersten Verwendung gestarteter `dets`-Server ohne Supervisor; Tabellenprozesse mit ihm verlinkt | [builtins](builtins.md#dets) |
| Reihenfolge von `dets:all/0` | ETS-Reihenfolge der Registrierung | ETS-Reihenfolge von Clause ([ETS](#ets)) | [builtins](builtins.md#dets) |
| Berichte | Eine Reparatur wird auf Info-Ebene protokolliert; `verbose/0,1` und `DETS_DEBUG` protokollieren mehr; ein interner Fehler ist `{dets_bug, ...}` | Nichts wird protokolliert | [builtins](builtins.md#dets) |

## io

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| `~p`, `~w` und `io_lib`-Schreibfunktionen bei Containern, die tiefer als 256 Ebenen verschachtelt sind | Ausgegeben | `system_limit` | [io](io.md#pretty-printing-p) |
| `io_lib:print/4` mit einer Spalte oder Zeilenlänge, die keine Ganzzahl ist | Abhängig vom Term: ausgegeben (guards scheitern still), `function_clause` oder `badarith` | `badarith` für jeden Container-Term | [io_lib](builtins.md#io_lib) |
| Negative Präzision oder Füllanzahl (`~.*c` mit -1) | Endlosschleife | `badarg` | [io](io.md#formats) |

## erl_scan

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Position einer Fortsetzung von `tokens/3,4` (`continuation_location/1`, undokumentiert) | Dort, wo der Scanner anhielt, innerhalb des unvollständigen Tokens | Anfang des unvollständigen Tokens, das mit den nächsten Zeichen erneut gescannt wird | [erl_scan](builtins.md#erl-scan) |
| `{compiler_internal, [ssa_checks]}` | Scannt Prüfkommentare `%ssa%` in Token | Ignoriert: Sie bleiben Kommentare | [erl_scan](builtins.md#erl-scan) |
| Eine Gleitkommazahl mit Basis (`16#1.8#e1`, Basis ungleich 10), deren Ziffern 53 Bit überschreiten | Die Mantisse wird wie große Ganzzahlen von ERTS umgewandelt | In einem double-Wert akkumuliert; das letzte Bit kann abweichen | [erl_scan](builtins.md#erl-scan) |
| Ein Listenelement, das kein Zeichen ist, innerhalb einer Zeichenkette, eines in Anführungszeichen gesetzten Atoms oder einer Escape-Sequenz | Je nach Klausel `function_clause`, `case_clause` oder `if_clause` | `function_clause` | [erl_scan](builtins.md#erl-scan) |

## erl_parse

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Token `'%ssa%'` (SSA-Prüfklauseln der Compiler-Tests von OTP) | In Klauseln `ssa_check_when` geparst | Ein Syntaxfehler; `erl_scan` erzeugt das Token nie | [erl_parse](builtins.md#erl-parse) |

## erl_eval

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Stacktrace eines vom Evaluator ausgelösten Fehlers (`{badmatch, V}`, `undef` eines lokalen Aufrufs, ...) | Aktueller Stack des auswertenden Prozesses (`process_info/2` `current_stacktrace`) | Der Stack beim `throw` des Evaluators, das ihn erfasst, in den Frames von Clause | [erl_eval](builtins.md#erl-eval) |

## erl_lint

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Durch `-behaviour` benannte Behaviours | Jedes Modul im Codepfad beantwortet `behaviour_info/1` | Nur in das Programm gelinkte Module antworten; ein anderes ergibt `undefined_behaviour` | [erl_lint](builtins.md#erl-lint) |
| Reihenfolge mehrerer in einem map-Fold gefundener Fehler (einmal vorkommende Typvariablen eines Typs, Spezifikationen ohne Funktion, Callback-Prüfungen) | Interne Reihenfolge der map (Atome nach Index) | Term-Ordnung | [erl_lint](builtins.md#erl-lint) |
| `erlang:is_builtin/3` für nicht exportierte Einträge von `-deprecated`, `-removed` und `-unsafe` | BIF-Tabelle von OTP | Builtins der Runtime einschließlich nativer Bibliotheksfunktionen | [erl_lint](builtins.md#erl-lint) |
| `is_guard_expr/1` einer record-Konstruktion | Löst `case_clause` aus | Gibt an, ob die Felder guard-Ausdrücke sind | [erl_lint](builtins.md#erl-lint) |

## epp

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| `-include_lib("App/...")` außerhalb des Include-Pfads | In `code:lib_dir(App)` gefunden, das die Anwendungen von OTP kennt | In `code:lib_dir(App)` des Codepfads von Clause gefunden, der keine OTP-Anwendungen enthält, sofern sie nicht hinzugefügt werden | [library](library.md#contents) |

## erl_pp

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Form der von `erl_pp` zurückgegebenen Zeichen | Tief verschachtelte Zeichenlisten | Eine flache Zeichenliste; die abgeflachte Ausgabe ist gleich | [builtins](builtins.md#erl-pp) |

## qlc

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Stacktrace einer in einem Cursor-Prozess ausgelösten Ausnahme, wie von `next_answers/1,2` erneut ausgelöst | Stacktrace des Cursors, gefolgt von `process_info(self(), current_stacktrace)` des Eigentümers | Gefolgt vom Stacktrace einer im Eigentümer abgefangenen Ausnahme (Clause hat kein Element `current_stacktrace`) | [qlc](builtins.md#qlc) |
| `qlc:q/1,2` in `erl_eval`, `ets:table/1,2`, `dets:table/1,2` in einem Programm, das `qlc` nie benennt | `qlc` ist immer geladen | `undef` für `qlc`: Diese erreichen es über einen Namen zur Laufzeit, daher linken nur Programme, die `qlc` benennen (jedes Modul mit `qlc.hrl` tut das), dieses Modul | [library](library.md#how-programs-get-them) |
| Annotationsnummern im Code kompilierter Abfragen (`info/2` mit `{format, abstract_code}`) | Der Transform von OTP nummeriert Annotationen unter Berücksichtigung jeder Ganzzahl des Moduls, einschließlich der Zeichen des Pfads von `qlc.hrl` in dessen `file`-Attribut | Derselbe Transform, aber `qlc.hrl` von Clause hat einen anderen Pfad, daher können Nummern nach der ersten Abfrage abweichen; der Code ist ansonsten gleich | [qlc](builtins.md#qlc) |

## qlc_pt

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Meldungen von `qlc_pt:parse_transform/2` zur Laufzeit | Von `compile:noenv_forms/2` (`strong_validation`): `erl_lint` und die Core-Durchläufe des Compilers, etwa Warnungen von `sys_core_fold` | Nur von `erl_lint`, wie bei `qlc_pt` von OTP, wenn der Compiler nicht verfügbar ist | [qlc_pt](builtins.md#qlc-pt) |

## Interaktive Shell

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Zeilenbearbeitung im Terminal | `edlin`: Cursortasten, Zeilenverlauf, Suche, Tab-Vervollständigung über `edlin_expand`, mehrzeilige Eingabeaufforderung `..>` | Eigene Zeilenbearbeitung des Terminals (Cooked-Modus); Zeilen werden gelesen, wie das Terminal sie liefert, mit derselben Eingabeaufforderung für jede weitere Zeile eines Befehls, wie OTP bei Eingaben über eine Pipe | [library](library.md#interactive-shell) |
| Job-Steuerung | Ctrl+G öffnet das JCL-Menü (neue, verbundene, unterbrochene und beendete Shells) | Keine; Banner und Hinweis zu langsamen Befehlen nennen weiterhin Ctrl+G, wie OTP sie ausgibt | [library](library.md#interactive-shell) |
| `exit().`, wenn die Shell Eingaben über eine Pipe liest | Eine neue Shell startet und liest nichts mehr | Eine neue Shell startet und liest die restliche Eingabe | [library](library.md#interactive-shell) |
| Programme, die die Shell ohne `--shell` starten | Jedes Modul des Codepfads ist aufrufbar | Nur die vom Programm gelinkten Module; ohne `--keep-exports` erreichen dynamische Aufrufe nur Exporte, die das Programm erreichen kann | [library](library.md#interactive-shell) |
| Records kompilierter Module (`rr(Module)`, `shell_default` und `user_default` beim Start) | Aus den Debug-Informationen oder dem Quelltext des Moduls gelesen | `{error, nofile}`: Gelinkter Code behält keinen abstrakten Code; `rr/1,2,3` lesen ihn aus Quelltext- und `.beam`-Dateien | [library](library.md#interactive-shell) |
| `save_module/1` | Schreibt das Modul und kompiliert es mit `c:c/1` | Schreibt nur das Modul (kein Compiler) | [library](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` innerhalb eines Aufrufs oder eines record-Feldwerts | Funktionsköpfe und Argumenttypen aus der Spezifikation der Funktion (`lists:seq(From, To)`), von der Spezifikation zugelassene Atome und Typen | Köpfe `Mod:Fun/Arity` der exportierten Stelligkeiten, keine Typvorschläge: Gelinkter Code behält keine Spezifikationen | [library](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` für Funktionen und Module | Funktionen nach den Gruppen der Dokumentation geordnet; Module des Codepfads | Eine Gruppe `Functions` (keine Dokumentation); Module des Programms | [library](library.md#interactive-shell) |
| Spalten von `c:i/0,1`, `c:ni/0`, `c:regs/0` | Ursprünglicher Aufruf und aktuelle Funktion jedes Prozesses | Ursprünglicher Aufruf von `proc_lib` oder `undefined`; aktuelle Funktion `undefined` (kein Element `current_function`) | [library](library.md#interactive-shell) |

## Zufallszahlen

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Streifenhöhen der Normalverteilungs-Ziggurat von `rand` | Tabellierte Konstanten | Aus den Konstanten der Ziggurat auf den nächsten double-Wert berechnet; eine Höhe kann im letzten Bit abweichen, was eine Annahme im langsamen Pfad nur bei einer Ziehung innerhalb dieses Bits der Grenze ändert (Wahrscheinlichkeit etwa 2^-53 pro Ziehung im langsamen Pfad). Streifenbreiten und Grenzen werden an OTP beobachtet und sind gleich | [Builtins](builtins.md#random-numbers) |

## crypto

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Reihenfolge von `crypto:supports(ciphers)` | Die nach Atomindex sortierte Tabelle des NIF, der zwischen VM-Läufen variiert, dann die Aliase | Tabellenreihenfolge von OTP, dann die Aliase | [builtins](builtins.md#crypto-module) |
| `{File, Line}` der Fehler `{badarg \| notsup \| error, {File, Line}, Description}` von `crypto` | C-Quelldatei und Zeile von OTP (`{"hash.c", 111}`) | C++-Quelldatei und Zeile von Clause (`{"hash.cpp", 63}`); Klasse und Beschreibung wie bei OTP | [builtins](builtins.md#crypto-module) |
| `link_type` von `crypto:info/0` | Wie OTP libcrypto gelinkt hat (gewöhnlich `dynamic`) | Immer `static`, auch wenn eine installierte dynamische libcrypto gelinkt wird | [OpenSSL](crypto.md) |
| Lange Berechnungen mit `pbkdf2_hmac/5` (mehr als 100 Iterationen oder 64 Bytes) | Laufen auf einem Dirty-CPU-Scheduler | Laufen auf dem Scheduler-Arbeitsthread des aufrufenden Prozesses, der währenddessen keinen anderen Prozess ausführt | [builtins](builtins.md#crypto-module) |
| `modules` der Anwendung `crypto` | `[crypto, crypto_ec_curves]` | `[crypto]` | [library](library.md) |
| Lange Texte für `crypto_one_time/4,5` und `crypto_one_time_aead/4,6,7` (mehr als 20000 Bytes) | Laufen auf einem Dirty-CPU-Scheduler | Laufen auf dem Scheduler-Arbeitsthread des aufrufenden Prozesses, der währenddessen keinen anderen Prozess ausführt | [builtins](builtins.md#crypto-module) |
| Anwendungsvariable `fips_mode` von `crypto` | Beim Laden des Moduls `crypto` gelesen: `true` aktiviert den FIPS-Modus | Nicht gelesen (Clause hat kein `on_load` und Programme haben keine `sys.config`): `crypto:enable_fips_mode/1` oder `clau --fips` verwenden | [crypto](crypto.md#fips) |
| `crypto:info_fips/0` ohne ladbaren FIPS-Provider | `not_enabled`, wenn OTP mit FIPS-Unterstützung gebaut wurde, sonst `not_supported` | `not_supported` | [crypto](crypto.md#fips) |
| Ladezeitpunkt der Anwendung `crypto` | Beim Laden des Moduls `crypto` (dessen `on_load`) | Wenn ein Generator `crypto_cache`, `crypto_aes` oder `crypto_prng1` erstmals `rand_cache_size` liest | [library](library.md) |
| RSA-Schlüsselerzeugung (`crypto:generate_key(rsa, ...)`) und SLH-DSA-Signaturen | Laufen auf einem Dirty-CPU-Scheduler | Laufen auf dem Scheduler-Arbeitsthread des aufrufenden Prozesses, der währenddessen keinen anderen Prozess ausführt | [builtins](builtins.md#crypto-module) |
| Option `rsa_sslv23_padding` von `crypto:public_encrypt/4` und seinen verwandten Funktionen | Akzeptiert, wenn OTP gegen ein OpenSSL mit SSLv23-Padding gebaut wurde (1.1, 3.x) | `"Bad padding type in option rsa_padding"`, wie OTP gegen OpenSSL 4 gebaut | [builtins](builtins.md#crypto-module) |
| `crypto:ec_curve/1` für eine in der gelinkten libcrypto fehlende Kurve (ein ohne binäre Kurven gebautes OpenSSL) | Die Parameter aus `crypto_ec_curves` | `error:function_clause`, wie bei einer unbekannten Kurve: Die Parameter stammen aus den eingebauten Kurven der libcrypto | [builtins](builtins.md#crypto-module) |
| Entschlüsselung von Debug-Informationen durch `beam_lib` in einem Programm, das `crypto` nicht aufruft | `crypto` ist immer vorhanden | `key_missing_or_invalid`, sofern das Programm nicht `crypto` linkt (`--with-crypto`), da `beam_lib` es dynamisch aufruft | [library](library.md) |

## ASN.1

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Stack in `{error, {asn1, {Reason, Stack}}}` | Frames der erzeugten Funktionen `enc_*`/`dec_*` und von `asn1rtt_*` | Frames von `Module:encode/2` oder `decode/2` und dem Codec-Builtin | [asn1](asn1.md#generated-modules) |
| Funktionen eines erzeugten Moduls | Exportiert auch `enc_Type/1,2`, `dec_Type/1,2` und die anderen von asn1ct erzeugten Funktionen pro Typ | Nur `encode/2`, `decode/2`, `info/0`, die Optionsfunktionen und die Wertfunktionen | [asn1](asn1.md#generated-modules) |
| Ein `CHOICE`, dessen Rumpf mit `...` beginnt (keine Wurzelalternativen) | asn1ct meldet einen Syntaxfehler | Akzeptiert | [asn1](asn1.md#coverage) |
| Wertmakros und Funktionen, die einen anderen Wert innerhalb eines offenen Typs benennen (`mgf1SHA1`, `rSASSA-PSS-Default-Identifier` von PKCS-1) | asn1ct belässt `{'Externalvaluereference', Line, Module, Name}` anstelle des Werts | Der referenzierte Wert | [asn1](asn1.md#generated-modules) |
| Ein Laufzeitfehler (kein ASN.1-Fehler), während `public_key` einen Erweiterungswert dekodiert oder kodiert | Direkt bei Auftreten aus der erzeugten Funktion `dec_ext-*`/`enc_ext-*` ausgelöst, meist Klasse `error` | `exit({error, {asn1, Reason}})`: Der Wert durchläuft `decode/2` oder `encode/2` des erzeugten Moduls, das jeden Fehlschlag verpackt | [public_key](public_key.md#functions) |
| Standard-Diffie-Hellman-Gruppen von `public_key:dh_gex_group/4` | Die von OTP erzeugten Gruppen (`lib/public_key/priv/moduli`), 60–81 pro Größe | Acht pro Größe aus der moduli-Datei von OpenSSH; dieselben Größen (2047 bis 8191) | [public_key](public_key.md#keys-and-signatures) |
| Frames einer Ausnahme von `public_key` | `public_key`, `pubkey_pem`, `pubkey_pbe`, `pubkey_cert_records`, `pubkey_cert`, `pubkey_ssh` | `public_key`, `clause_public_key_codec` und `clause_public_key_keys` | [public_key](public_key.md#functions) |

## Parse-Transforms

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Name im `file`-Attribut einer eingebundenen Datei (`--print-abstr`, Eingabe des Transforms) | Das Include-Verzeichnis mit dem Namen verbunden, wie gefunden (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | Der Pfad relativ zum Arbeitsverzeichnis, wenn die Datei darunter liegt, sonst der absolute Pfad | [Transforms](transforms.md#interchange) |
| Annotationen mit Zeile 0 in importierten Formen (erzeugter Code, etwa vom `qlc`-Transform) | Eine gültige Zeile: Der Code hat keine Quelltextzeile | Der Code nimmt die Stelle des davor importierten Knotens ein | [transforms](transforms.md#importing-forms) |
| `generated`-Annotationen importierter Formen (`.abstr`-Eingaben, Ausgabe des Transforms) | `erl_lint` und der Compiler überspringen manche Warnungen für erzeugten Code | Ignoriert: Der Code wird wie Quelltext geprüft | [Transforms](transforms.md#importing-forms) |
| Formen `{error, {Location, Module, Descriptor}}` in importiertem Code | Mit `Module:format_error/1` formatiert | Der Termtext des Deskriptors; das Formatieren braucht OTP | [Transforms](transforms.md#importing-forms) |
| Ein Modul mit Präprozessor- oder Parse-Fehlern, das einen Parse-Transform nennt | Der Transform läuft und erhält die Fehler als Formen `{error, E}`; `erl_lint` meldet sie danach | Fehler werden gemeldet, und der Transform läuft nicht | [Transforms](transforms.md#clause-pipeline) |
| Kompilieroptionen, die ein Transform erhält | Die vollständige Optionsliste von erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (das Arbeitsverzeichnis), `{i, _}`, `{d, ...}` und `{parse_transform, _}` | [Transforms](transforms.md#otp-behavior) |
