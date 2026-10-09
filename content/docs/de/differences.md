---
source: docs/differences.md
sourceCommit: 06042fa
sourceSha256: b5d1cfc31fec7aaf6e6c4ca75f9056df534ca608a2c93e97a44e6c5e00a1109b
translatedAt: 2026-10-09
---
# Unterschiede zu Erlang/OTP

Beobachtbares Verhalten, bei dem Clause bewusst vom festgelegten OTP 29
(`maint-29`, siehe [otp-reference.md](otp-reference.md)) abweicht. Jeder Eintrag
verweist auf den Vertrag, dem er gehört. Ein Eintrag wird entfernt, sobald der
Unterschied behoben ist. Noch nicht implementierte Funktionen (gemeldet als
`notimpl`) sind hier nicht aufgeführt; siehe [features.md](features.md) und den
Plan.

## Maps

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Reihenfolge des Map-Generators (`K := V <- M`) | Flache Maps (bis zu 32 Schlüssel) werden in Schlüsselreihenfolge durchlaufen, Atom-Schlüssel jedoch in Atomtabellen-Reihenfolge, die zwischen VM-Läufen variiert; größere Maps in Hash-Reihenfolge | Immer kanonische Schlüsselreihenfolge (Term-Ordnung) | [Muster](patterns.md#comprehensions) |
| `bad_generators`-Nutzlast eines Map-Generators in einer Zip-Gruppe | Sein Iterator: `{K, V, Next}`-Kette, die mit `none` endet, in der Reihenfolge von OTP | Dieselbe Kette, in kanonischer Schlüsselreihenfolge aufgebaut | [Muster](patterns.md#comprehensions) |
| Ausgabe von Maps (`erlang:display/1`, `~w`, `~p`) | Reihenfolge des internen Layouts (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel) | Reihenfolge der Map-Schlüssel, wie OTPs `~kw` | [Terme](terms.md#printing) |
| Ausgabe nativer Records (`erlang:display/1`) | Felder in der Reihenfolge der Atomtabellen-Indizes | Definitionsreihenfolge, wie `~w` | [Native Records](native-records.md#printing-and-order) |
| `==` zwischen nativen Records, deren Felder sich nur als Ganzzahl/Gleitkommazahl unterscheiden | Der Compiler kann es zu `=:=` falten (false) | Numerischer Vergleich (true) | [Native Records](native-records.md#printing-and-order) |
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
| Formatieren eines großen Terms (`io:format/1,2`) | Läuft in Erlang-Code (`io_lib`) und im Group Leader, sodass der Prozess während des Formatierens verdrängt werden kann | Läuft in einem Builtin-Aufruf bis zum Ende; andere Prozesse warten | [Builtins](builtins.md#portions) |
| Flags von `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` und weitere | Nur `trap_exit`; jedes andere Flag löst `badarg` aus | [Prozesse](processes.md#builtins) |
| Reihenfolge der Fehlerberichte gleichzeitig abstürzender Prozesse | Logger-Reihenfolge | Die Reihenfolge, in der ihre Worker sie beenden | [Prozesse](processes.md#workers) |
| Signale an einen Prozess, der auf einem anderen Scheduler läuft | In seine Signalwarteschlange eingereiht und später behandelt, während der Sender weiterläuft | Der Sender wartet, bis die Zeitscheibe des Ziels endet, und handelt dann sofort; nur als Zeitverhalten beobachtbar | [Prozesse](processes.md#workers) |
| `list_to_port/1` einer nie vergebenen Nummer | Gibt einen Port-Term zurück | `badarg`: nur von diesem Programm geöffnete Ports werden zugelassen | [Ports](ports.md#identity) |
| Werte von `port_info/1,2` | `id` ist ein Tabellenindex; `memory`, `queue_size`, `locking` beschreiben den Treiber | `id` ist die Port-Nummer; `memory` und `queue_size` sind 0; `locking` ist `port_level` | [Ports](ports.md#builtins-and-port-messages) |
| Schreiben in eine nur zum Lesen geöffnete Datei | `{error, eacces}` unter Windows, `{error, ebadf}` anderswo | `{error, ebadf}` überall | [Ports](ports.md#standard-io-and-files) |
| `io:get_line`, `io:get_chars` und `file:read/2` im Listenmodus bei Nicht-ASCII-Eingabe | Zeichen gemäß der Gerätekodierung dekodiert | Ein Listenelement pro Byte | [Ports](ports.md#standard-io-and-files) |
| Ergebnis von `os:cmd/1` | Aus der Ausgabe dekodierte Unicode-Zeichen | Die Bytes der Ausgabe | [Ports](ports.md#subprocesses) |
| Leere Argumente von `{spawn_executable, F}` unter Windows | Aus der Befehlszeile entfernt | Als `""` übergeben | [Ports](ports.md#subprocesses) |
| `{exit_status, S}` und `eof` eines gestarteten Programms | Unbestimmte Reihenfolge, `exit_status` kann vor den letzten Daten ankommen | Nach allen Daten, vor `eof` | [Ports](ports.md#subprocesses) |
| Ausgelastete Ports | Ein Port mit zu viel ausstehender Ausgabe suspendiert Sender; `force` von `port_command/3` funktioniert bei Treibern, die es erlauben | Ausgabe suspendiert nie; `force` löst bei jedem Treiber `notsup` aus | [Ports](ports.md#io-thread) |
| `{active, N}` von Sockets | Eine Ganzzahl `N` zählt Nachrichten bis `{tcp_passive, S}` | `exit(badarg)`; nur `true`, `false` und `once` | [Ports](ports.md#sockets-57f) |
| Socket-Tuning-Optionen (`nodelay`, `keepalive`, `send_timeout`, `delay_send`, Puffer) | Angewendet; andere `inet`-Optionen (`header`, `{packet, line}`, `http`, ...) funktionieren | Die aufgeführten Tuning-Optionen werden akzeptiert, aber nicht angewendet; andere Optionen ergeben `exit(badarg)` | [Ports](ports.md#sockets-57f) |
| Socket-Fehlergründe | Jeder POSIX-Grund, den das System meldet | Die gängigen (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); andere sind `eio` | [Ports](ports.md#sockets-57f) |
| Port-Eingabe, während der verbundene Prozess 1.024 Nachrichten hält und laufen kann | Liest und liefert weiter | Liefert nicht mehr, bis die Zeitscheibe des Prozesses endet; ab 64 KiB gehaltener Daten wird nicht mehr gelesen, sodass das schreibende Programm blockiert | [Ports](ports.md#busy-ports) |
| `gen_tcp:close/1` mit ausstehender Ausgabe | Wartet bis zur Einstellung `linger`/`send_timeout`, bis die Ausgabe gesendet ist | Kehrt sofort zurück; der I/O-Thread sendet die ausstehende Ausgabe und schließt dann | [Ports](ports.md#sockets-57f) |
| Typen von `monitor/2` | `process`, `port`, `time_offset` | `process` und `port`; `time_offset` löst `badarg` aus (keine Änderungen des Zeitversatzes) | [Prozesse](processes.md#monitors) |
| `exit/2`, `exit_signal/2` an eine Referenz | Sendet an den Prozess-Alias, falls die Referenz ein aktiver ist | Nichts (keine Aliase) | [Prozesse](processes.md#exit-signals) |
| Referenznummern | Mischen eine Scheduler-Kennung und Zähler pro Scheduler (`#Ref<0.178111994.4235460610.214105>`) | Ein programmweiter Zähler (`#Ref<0.0.0.1>`), sodass Referenzen nach Erzeugung geordnet sind | [Terme](terms.md#pids-and-references) |

## Fehler, Stacktraces und Berichte

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Orte im Stacktrace | `[{file, F}, {line, L}]`, `error_info` für `error/3` | Immer `[]`; kein `error_info` | [ABI](abi.md#stack-traces) |
| Oberster Frame bei `function_clause` | Argumentliste | Stelligkeit | [ABI](abi.md#stack-traces) |
| Oberster Frame bei `undef` | `{M, F, Args, []}` der fehlenden Funktion | Der Frame der aufrufenden Funktion | [Funs](funs.md#dynamic-calls) |
| Frames fehlschlagender BIFs/Operatoren | Vorhanden (`{erlang, '+', Args, ...}`) | Fehlen; nichts unterhalb der Einstiegsfunktion | [ABI](abi.md#stack-traces) |
| Atomtabelle voll (`list_to_atom/1`) | Der Emulator bricht ab (`no more index entries in atom_tab`) und schreibt einen Crash-Dump | `clau: runtime failure: entry call failed: resource_limit`, Exit-Code 70 | [Builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` mit Zeichen über 255 | Die ersten Ziffern verwenden nur das niedrige Byte jedes Zeichens (`[16#131]` ist 1) | `badarg` | [Builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` eines BIF | Wahr für jedes BIF des Emulators | Nur wahr für die Builtins, die diese Runtime bereitstellt | [Builtins](builtins.md#how-calls-reach-them) |
| Fehlerberichte abgestürzter Prozesse | An den Logger gesendet, später von dessen Standard-Handler geschrieben (unter `erl` auf die Standardausgabe, oft verloren, wenn ein Escript vorher anhält) | Auf stderr geschrieben, wenn der Prozess endet, vor jeder späteren Ausgabe | [Prozesse](processes.md#exits) |
| Aufrufe von Funktionen, die nie zurückkehren | Als Endaufrufe kompiliert (Aufrufer fehlt im Trace) | Gewöhnliche Aufrufe (Aufrufer vorhanden) | [ABI](abi.md#stack-traces) |
| Hostspeicher erschöpft | Der Emulator meldet, dass er keinen Speicher allozieren kann, schreibt einen Crash-Dump und stoppt | `clau: runtime failure: entry call failed: out_of_memory`, Exit-Code 70, kein Dump | [Runtime-Heap](runtime-heap.md#failure-behavior) |
| Speicherobergrenze pro Prozess | `max_heap_size` (in Wörtern, Heap und Stack) beendet den Prozess mit Grund `killed` und protokolliert einen Fehlerbericht | `--max-heap` / `--max-stack` (Bytes) und das runtimeweite `--max-memory` lassen den anfordernden Prozess mit `resource_limit` fehlschlagen: `clau: runtime failure: entry call failed: resource_limit`, Exit-Code 70 | [Runtime-Heap](runtime-heap.md#runtime-memory-limit) |
| Programmargumente | `escript` übergibt jedes Argument an `main/1`; Emulator-Flags (`+t`) kommen aus `%%!` oder `ERL_FLAGS` | Führende Runtime-Optionen (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) werden zuerst herausgenommen; `CLAUSE_FLAGS` enthält dieselben Optionen | [Ausführbare Dateien](executables.md#runtime-options) |
| Nicht abgefangene Ausnahme in einem gewöhnlichen Einstiegsmodul | `escript` endet mit 127 | Endet mit 1 und einer Zeile `uncaught exception <class>: <reason>` (Escript-Quellen behalten 127) | [Ausführbare Dateien](executables.md) |
| Compiler-Diagnosen | Wortlaut von `erl_lint` (`variable 'X' is unbound`) und Warnungen | Eigener Wortlaut (`unbound variable X`); OTP-Lint-Warnungen werden größtenteils nicht ausgegeben (auch nicht für unbekannte Felder nativer Records in Zugriff, Aktualisierung und Mustern) | [Semantik](semantic.md#bindings) |

## Sprachliche Grenzfälle

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Ganzzahlsegment breiter als die Ganzzahlgrenze, Wert darüber hinaus (`<<V:4194241>>` aus lauter Einsen) | Der x86-JIT matcht mit einem ungültigen Term; dessen Verwendung bringt die VM zum Absturz | Kein Match | [Terme](terms.md#integers) |
| Zip-Gruppe, deren lockere und strikte Generatoren sich eine Variable teilen | Der Überspringtest behält Variablen strikter Muster in den lockeren Mustern | Ein verworfener Schritt wird übersprungen, sobald die strikten Muster für sich allein matchen | [Muster](patterns.md#comprehensions) |
| Aufruf einer externen Fun, `M:F(Args)` oder `apply/3` eines Moduls außerhalb des Programms | Lädt das Modul aus dem Codepfad, `undef`, wenn es fehlt | `undef`; Bibliotheksmodule werden nur Teil des Programms, wenn es sie mit einem literalen Atom benennt | [Funs](funs.md#dynamic-calls), [Bibliothek](library.md#how-programs-get-them) |
| `lists` und `maps` | Die vollständigen Module; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` folgen der internen Reihenfolge der Map (Atomtabellen-Reihenfolge für Atom-Schlüssel, Hash-Reihenfolge über 32 Schlüssel) | Die [Bibliotheksteilmenge](library.md); Map-Funktionen folgen der Schlüsselreihenfolge | [Bibliothek](library.md) |
| Dateien ohne `#!`, die als Escripts übergeben werden | `escript file.erl` überspringt die erste Zeile | Als gewöhnliche Module kompiliert | [Ausführbare Dateien](executables.md) |
| Vorkompilierte Beam- und Archiv-Escripts | Laufen | Nicht unterstützt | [Ausführbare Dateien](executables.md) |
| Eine `-spec`, deren Typen keinen Wert mit dem inferierten Ergebnis, der Einstiegsdomäne oder den Argumenten eines Aufrufs gemeinsam haben | Kompiliert; Dialyzer kann warnen | Kompilierfehler, der den deklarierten und den inferierten Typ nennt | [Semantische Analyse](semantic.md#inference) |

## io

| Unterschied | OTP | Clause | Zuständig |
| --- | --- | --- | --- |
| Steuersequenzen `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, Modifikator `K` | Formatiert | `badarg` | [io](io.md#formats) |
| `~p` von Containern, die tiefer als 256 Ebenen verschachtelt sind | Ausgegeben | `system_limit` | [io](io.md#pretty-printing-p) |
| Feldbreiten und `~ts`-Präzision bei kombinierenden Zeichen oder `\r\n` | Zählen Graphem-Cluster | Zählen Codepoints | [io](io.md#formats) |
| Negative Präzision oder Füllanzahl (`~.*c` mit -1) | Endlosschleife | `badarg` | [io](io.md#formats) |
| `io`-Funktionen außer `format/1,2`, `put_chars/1` | Existieren | `unknown module io` | [io](io.md#calls) |
