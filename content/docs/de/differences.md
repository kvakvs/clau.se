---
source: docs/differences.md
sourceCommit: a8c3f8f6
sourceSha256: 3ef4e2009b365f68cd20c9627686948139c57277d62690565abaab54507ac818
translatedAt: 2026-10-17
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
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3` | Interne Reihenfolge (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel); ein Iterator ist eine Position oder eine `{K, V, Next}`-Kette | Kanonische Schlüsselreihenfolge; ein Iterator läuft über eine Schlüsselliste weiter | [Builtins](builtins.md#erts-internal) |
| Ausgabe von Maps (`erlang:display/1`, `~w`, `~p`) | Reihenfolge des internen Layouts (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel) | Reihenfolge der Map-Schlüssel, wie `~kw` von OTP | [Terme](terms.md#printing) |
| Reihenfolge von `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` | Die interne Reihenfolge der Map (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel) | Schlüsselreihenfolge | [Bibliothek](library.md) |
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
| Pid-Nummern | Der erste Benutzerprozess ist etwa `<0.80.0>`; Nummern werden wiederverwendet, nachdem die Pid-Tabelle überläuft | Der erste Prozess ist `<0.1.0>`; Nummern stammen aus einer Sequenz und werden nie wiederverwendet | [Terme](terms.md#pids-and-references) |
| Code nach `spawn(Fun)` einer Fun anderer Stelligkeit | Die Typanalyse des Compilers kann den Code nach dem Aufruf als unerreichbar ansehen und entfernen, sodass der Aufrufer sofort die Pid zurückgibt | Der Aufrufer läuft weiter; nur der neue Prozess schlägt mit `{badarity, {Fun, []}}` fehl | [Prozesse](processes.md#builtins) |
| Stack eines `function_clause`, das ein `lists`-Builtin auslöst (`lists:sublist/2`, `lists:max/1`, ...) | Der oberste Frame ist die Erlang-Funktion, oft eine interne Hilfsfunktion (`lists:sublist_2/2`), mit ihren Argumenten | Der Aufrufer liegt oben: Builtins legen keinen Frame an | [Builtins](builtins.md#lists-module) |
| Letztes Bit von `math`-Ergebnissen (`math:erfc(1)`, ...) | Die C-Bibliothek, mit der OTP gebaut wurde | Die C-Bibliothek, die Clause-Programme linken (Windows: `0.15729920705028513` für `erfc(1)`, OTP `0.1572992070502851`) | [Builtins](builtins.md#math-module) |
| Ergebnis von `binary:compile_pattern/1` | `{bm, Ref}` oder `{ac, Ref}` mit einer opaken Referenz | `{bm, [Pattern]}` oder `{ac, Patterns}` | [Builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` eines Sub-Binarys | Die Größe des Binarys, in das es verweist | Seine eigene Größe | [Builtins](builtins.md#binary-module) |
| Kosten von `persistent_term:get/1,2` | Konstant: Der Wert bleibt in einem Literalbereich; `put`/`erase` eines ersetzten Werts lösen eine globale Speicherbereinigung aus | Kopiert den Wert bei jedem Lesen in den Heap des Lesers; keine globale Speicherbereinigung | [Runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` und `get/0` | Enthalten die Terme, die `kernel` und `stdlib` von OTP beim Start speichern (26 unter OTP 29) | Nur die eigenen Terme des Programms | [Builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` eines kompilierten Moduls | Die `.beam`-Datei, aus der es geladen wurde | `preloaded`: Jedes Modul ist in die ausführbare Datei gelinkt | [Builtins](builtins.md#code-module) |
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
| Module `socket`, `net` | Die Socket-NIF-API | Fehlen: Ein Verweis ist ein Kompilierfehler; stattdessen `gen_tcp`, `gen_udp`, `inet` verwenden | [Bibliothek](library.md) |
| Ausgabelisten von `zlib` | Ein Binary pro internem Block, verschachtelt, wo ein Stream endete und neu begann | Ein Binary pro Aufruf, `[]`, wenn es keines gibt; die Bytes sind die von OTP | [Builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` und lange `zlib`-Aufrufe | Kehren nach einer begrenzten Ausgabemenge zurück (`{continue, Output}`) und geben ab | Entpacken alle eingereihten Eingaben in einem Aufruf (`{finished, Output}`); ein langer Aufruf belegt seinen Scheduler-Thread | [Builtins](builtins.md#zlib-module) |
| Lange `re`-Matches | `re:run/3` und die globale Schleife geben nach einer begrenzten Arbeitsmenge ab | Ein Match läuft bis zum Ende und belegt seinen Scheduler-Thread; ein globaler Lauf gibt nur zwischen Matches ab | [Builtins](builtins.md#re-module) |
| `re:compile/2` mit `export`, `re:import/1` | Ein exportiertes Muster `{re_exported_pattern, ...}`, das ein anderer Knoten importiert | `export` ist `badarg`; `import/1` löst `{not_implemented, import, 1}` aus | [Builtins](builtins.md#re-module) |
| Argumentfehler von `re` | `badarg`, ausgelöst von `re:run/3` (oder `replace`, `split`) mit den Argumenten des Aufrufers und `error_info` | `badarg`, ausgelöst von der `re`-Hilfsfunktion, die das Argument abgelehnt hat, mit deren Argumenten | [Builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` für Module von `kernel`, `stdlib` und `compiler` | Immer `false` | [Builtins](builtins.md#code-module) |
| Ausgabe auf ein Dateigerät (`io:format(File, ...)`) | Zeichen werden in der Kodierung der Datei kodiert (standardmäßig `latin1`: Zeichen über 255 sind ein Fehler) | Immer UTF-8-Bytes | [io](io.md#calls) |
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
| `erlang:system_info(machine)` | `"BEAM"` | `"Clause"` | [Builtins](builtins.md#system-information) |
| Tuning-Optionen von `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Angewendet | Geprüft und akzeptiert, nicht angewendet | [Prozesse](processes.md#spawn-options) |
| `hibernate/3` | Verwirft den Stack; der Prozess endet, wenn `M:F` zurückkehrt | Behält den Stack; das Ergebnis von `M:F` kehrt zum Aufrufer von `hibernate/3` zurück | [Prozesse](processes.md#spawn-options) |
| `monitor(port, Item, Options)` mit Optionen | Akzeptiert | `badarg` | [Prozesse](processes.md#aliases) |
| `spawn_request_abandon/1` | `true`, solange die Antwort aussteht | Immer `false`: Die Antwort wird gesendet, bevor `spawn_request` zurückkehrt | [Prozesse](processes.md#spawn-options) |
| Letztes Bit von `math:log2/1` (Windows) | Der Windows-Build von OTP teilt `log(X)` durch `log(2)` (`math:log2(1.0e308)` ist `1023.1538532253077`) | `log2` der C-Bibliothek (`1023.1538532253076`) | [Builtins](builtins.md#math-module) |
| Werte von `phash/2`, `phash2/1,2` | Die Hash-Funktion von OTP | Clauses eigener stabiler Hash mit denselben Wertebereichen und derselben Gleichheitsgarantie | [Builtins](builtins.md#hashing) |
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
| `io:get_line`, `io:get_chars` und `file:read/2` im Listenmodus bei Nicht-ASCII-Eingabe | Zeichen gemäß der Gerätekodierung dekodiert | Ein Listenelement pro Byte | [Ports](ports.md#standard-io-and-files) |
| Ergebnis von `os:cmd/1` | Aus der Ausgabe dekodierte Unicode-Zeichen | Die Bytes der Ausgabe | [Ports](ports.md#subprocesses) |
| Leere Argumente von `{spawn_executable, F}` unter Windows | Aus der Befehlszeile entfernt | Als `""` übergeben | [Ports](ports.md#subprocesses) |
| `{exit_status, S}` und `eof` eines gestarteten Programms | Unbestimmte Reihenfolge, `exit_status` kann vor den letzten Daten ankommen | Nach allen Daten, vor `eof` | [Ports](ports.md#subprocesses) |
| Ausgelastete Ports | Ein Port mit zu viel ausstehender Ausgabe suspendiert Sender, Socket-Ports eingeschlossen; `force` von `port_command/3` funktioniert bei Treibern, die es erlauben | Nur Ports gestarteter Programme werden ausgelastet; `fd`- und Socket-Ports nie; `force` löst bei jedem Treiber `notsup` aus | [Ports](ports.md#busy-ports) |
| `{active, N}` von Sockets | Eine Ganzzahl `N` zählt Nachrichten bis `{tcp_passive, S}` | `exit(badarg)`; nur `true`, `false` und `once` | [Ports](ports.md#sockets) |
| Socket-Tuning-Optionen (`nodelay`, `keepalive`, `send_timeout`, `delay_send`, Puffer) | Angewendet; andere `inet`-Optionen (`header`, `{packet, line}`, `http`, ...) funktionieren | Die aufgeführten Tuning-Optionen werden akzeptiert, aber nicht angewendet; andere Optionen ergeben `exit(badarg)` | [Ports](ports.md#sockets) |
| Socket-Fehlergründe | Jeder POSIX-Grund, den das System meldet | Die gängigen (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); andere sind `eio` | [Ports](ports.md#sockets) |
| Port-Eingabe, während der verbundene Prozess 1.024 Nachrichten hält und laufen kann | Liest und liefert weiter | Liefert nicht mehr, bis die Zeitscheibe des Prozesses endet; ab 64 KiB gehaltener Daten wird nicht mehr gelesen, sodass das schreibende Programm blockiert | [Ports](ports.md#busy-ports) |
| `gen_tcp:close/1` mit ausstehender Ausgabe | Wartet bis zur Einstellung `linger`/`send_timeout`, bis die Ausgabe gesendet ist | Kehrt sofort zurück; der I/O-Thread sendet die ausstehende Ausgabe und schließt dann | [Ports](ports.md#sockets) |
| Typen von `monitor/2` | `process`, `port`, `time_offset` | `process` und `port`; `time_offset` löst `badarg` aus (keine Änderungen des Zeitversatzes) | [Prozesse](processes.md#monitors) |
| `exit/2`, `exit_signal/2` an eine Referenz | Sendet an den Prozess-Alias, falls die Referenz ein aktiver ist | Nichts: Exit-Signale gehen nie an Aliase | [Prozesse](processes.md#exit-signals) |
| Referenznummern | Mischen eine Scheduler-Kennung und Zähler pro Scheduler (`#Ref<0.178111994.4235460610.214105>`) | Ein programmweiter Zähler (`#Ref<0.0.0.1>`), sodass Referenzen nach Erzeugung geordnet sind | [Terme](terms.md#pids-and-references) |

## Fehler, Stacktraces und Berichte

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Orte im Stacktrace | `[{file, F}, {line, L}]`, `error_info` für `error/3` | Immer `[]`; kein `error_info` | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` mit Stack-Einträgen `{Fun, Args}` | Akzeptiert | Abgewiesen | [ABI](abi.md#stack-traces) |
| Oberster Frame bei `function_clause` | Argumentliste | Stelligkeit | [ABI](abi.md#stack-traces) |
| Oberster Frame bei `undef` | `{M, F, Args, []}` der fehlenden Funktion | Der Frame der aufrufenden Funktion | [Funs](funs.md#dynamic-calls) |
| Dynamischer Aufruf eines Exports, den eine ausführbare Datei nicht erreichen kann (sein Modul wird nur über einen Stacktrace, eine Ausnahme oder eine Nachricht von außerhalb des Programms benannt) | Ruft ihn auf | `undef`, außer beim Bauen mit `--keep-exports`; `function_exported/3` und `module_info(exports)` führen ihn trotzdem auf | [Ausführbare Dateien](executables.md#export-liveness) |
| Frames fehlschlagender BIFs/Operatoren | Vorhanden (`{erlang, '+', Args, ...}`) | Fehlen; nichts unterhalb der Einstiegsfunktion | [ABI](abi.md#stack-traces) |
| Atomtabelle voll (`list_to_atom/1`) | Der Emulator bricht ab (`no more index entries in atom_tab`) und schreibt einen Crash-Dump | `clau: runtime failure: entry call failed: resource_limit`, Exit-Code 70 | [Builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` mit Zeichen über 255 | Die ersten Ziffern verwenden nur das niedrige Byte jedes Zeichens (`[16#131]` ist 1) | `badarg` | [Builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` eines BIF | Wahr für jedes BIF des Emulators | Nur wahr für die Builtins, die diese Runtime bereitstellt | [Builtins](builtins.md#how-calls-reach-them) |
| Fehlerberichte abgestürzter Prozesse | An den Logger gesendet, später von dessen Standard-Handler geschrieben (unter `erl` auf die Standardausgabe, oft verloren, wenn ein Escript vorher anhält) | Auf stderr geschrieben, wenn der Prozess endet, vor jeder späteren Ausgabe | [Prozesse](processes.md#exits) |
| Aufrufe von Funktionen, die nie zurückkehren | Als Endaufrufe kompiliert (Aufrufer fehlt im Trace) | Gewöhnliche Aufrufe (Aufrufer vorhanden) | [ABI](abi.md#stack-traces) |
| Hostspeicher erschöpft | Der Emulator meldet, dass er keinen Speicher allozieren kann, schreibt einen Crash-Dump und stoppt | `clau: runtime failure: entry call failed: out_of_memory`, Exit-Code 70, kein Dump | [Runtime-Heap](runtime-heap.md#failure-behavior) |
| Speicherung von Maps mit mehr als 32 Schlüsseln | Ein HAMT auf dem Heap aus Knoten mit 16-facher Hash-Verzweigung | Ein B+-Baum auf dem Heap mit bis zu 16 Einträgen pro Knoten in Schlüsselreihenfolge; Heap-Größen großer Maps weichen von denen in OTP ab | [Runtime-Heap](runtime-heap.md#map-trees) |
| Speicherobergrenze pro Prozess | `max_heap_size` (in Wörtern, Heap und Stack) beendet den Prozess mit Grund `killed` und protokolliert einen Fehlerbericht | `--max-heap` / `--max-stack` (Bytes) und das runtimeweite `--max-memory` lassen den anfordernden Prozess mit `resource_limit` fehlschlagen: `clau: runtime failure: entry call failed: resource_limit`, Exit-Code 70 | [Runtime-Heap](runtime-heap.md#runtime-memory-limit) |
| Programmargumente | `escript` übergibt jedes Argument an `main/1`; Emulator-Flags (`+t`) kommen aus `%%!` oder `ERL_FLAGS` | Führende Runtime-Optionen (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) werden zuerst herausgenommen; `CLAUSE_FLAGS` enthält dieselben Optionen | [Ausführbare Dateien](executables.md#runtime-options) |
| Nicht abgefangene Ausnahme in einem gewöhnlichen Einstiegsmodul | `escript` endet mit 127 | Endet mit 1 und einer Zeile `uncaught exception <class>: <reason>` (Escript-Quellen behalten 127) | [Ausführbare Dateien](executables.md) |
| Compiler-Diagnosen | Wortlaut von `erl_lint` (`variable 'X' is unbound`) und Warnungen | Eigener Wortlaut (`unbound variable X`); OTP-Lint-Warnungen werden größtenteils nicht ausgegeben (auch Warnungen zu nativen Records: unbekannte Felder in Zugriff, Aktualisierung und Mustern, qualifizierte Konstruktion im eigenen Modul ohne Werte, ungenutzte oder in Headern definierte Records; ein späteres Muster, das einen aus einem Zweig exportierten Namen matcht) | [Semantik](semantic.md#bindings) |
| Behaviour-Modul mit handgeschriebener `behaviour_info/1` | Ruft sie beim Kompilieren der Nutzer auf und warnt vor fehlenden, falsch definierten oder veralteten Callbacks | Nicht ausgewertet: Die Callbacks der Nutzer werden nicht geprüft | [Semantik](semantic.md#behaviours) |
| Behaviour-Module außerhalb des Batches (`gen_server`, `supervisor`, ...) | Aus dem Codepfad geladen; ihre Callbacks werden geprüft | Warnung `behaviour M undefined` | [Semantik](semantic.md#behaviours) |
| `-behaviour` mit einem Wert, der kein Atom ist | Die Warnung gibt den Term mit `~w` aus (`behaviour [115,116,114] undefined`) | Gibt den Quelltext des Attributs aus (`behaviour "str" undefined`); der Fehler ist derselbe | [Semantik](semantic.md#behaviours) |
| `module_info(md5)` und das daraus von OTP abgeleitete `vsn` | MD5 des kompilierten BEAM-Codes | MD5 des ausgegebenen Quelltexts des Moduls; die abgeleitete `vsn`-Ganzzahl weicht entsprechend ab | [Semantik](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` der Compiler-Anwendung von OTP, die ihr übergebenen `options` | Die Version von Clause; `options` immer `[]` | [Semantik](semantic.md#predefined-functions) |
| `module_info(functions)` | Führt auch die Funktionen auf, die OTP für Funs erzeugt (`'-f/0-fun-0-'/0`) | Nur Quelltextfunktionen und die vordefinierten | [Semantik](semantic.md#predefined-functions) |
| `-nominal` in `module_info(attributes)` | Als `{nominal,[{Name,AbstractType,Params}]}` im abstrakten Format behalten | Weggelassen | [Semantik](semantic.md#predefined-functions) |
| Eine Funktion eines Clause-Bibliotheksmoduls, die Clause nicht implementiert hat (ein `erlang`-BIF, `lists:ukeysort/2`, ...) | Läuft | Kompiliert; löst beim Aufruf `error({not_implemented, F, A})` aus, mit `M:F/A` oben auf dem Stack ([Status](../library/modules.terms)) | [Bibliothek](library.md#provided-or-missing), [Builtins](builtins.md#erlang-module) |
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

## io

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Steuersequenzen `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, Modifikator `K` | Formatiert | `badarg` | [io](io.md#formats) |
| `~p` von Containern, die tiefer als 256 Ebenen verschachtelt sind | Ausgegeben | `system_limit` | [io](io.md#pretty-printing-p) |
| Feldbreiten und `~ts`-Präzision bei kombinierenden Zeichen oder `\r\n` | Zählen Graphem-Cluster | Zählen Codepoints | [io](io.md#formats) |
| Negative Präzision oder Füllanzahl (`~.*c` mit -1) | Endlosschleife | `badarg` | [io](io.md#formats) |

## Parse-Transforms

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Name im `file`-Attribut einer eingebundenen Datei (`--print-abstr`, Eingabe des Transforms) | Das Include-Verzeichnis mit dem Namen verbunden, wie gefunden (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | Der Pfad relativ zum Arbeitsverzeichnis, wenn die Datei darunter liegt, sonst der absolute Pfad | [Transforms](transforms.md#interchange) |
| `generated`-Annotationen importierter Formen (`.abstr`-Eingaben, Ausgabe des Transforms) | `erl_lint` und der Compiler überspringen manche Warnungen für erzeugten Code | Ignoriert: Der Code wird wie Quelltext geprüft | [Transforms](transforms.md#importing-forms) |
| Formen `{error, {Location, Module, Descriptor}}` in importiertem Code | Mit `Module:format_error/1` formatiert | Der Termtext des Deskriptors; das Formatieren braucht OTP | [Transforms](transforms.md#importing-forms) |
| Ein Modul mit Präprozessor- oder Parse-Fehlern, das einen Parse-Transform nennt | Der Transform läuft und erhält die Fehler als Formen `{error, E}`; `erl_lint` meldet sie danach | Fehler werden gemeldet, und der Transform läuft nicht | [Transforms](transforms.md#clause-pipeline) |
| Kompilieroptionen, die ein Transform erhält | Die vollständige Optionsliste von erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (das Arbeitsverzeichnis), `{i, _}`, `{d, ...}` und `{parse_transform, _}` | [Transforms](transforms.md#otp-behavior) |
