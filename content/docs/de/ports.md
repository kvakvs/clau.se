---
source: docs/ports.md
sourceCommit: 06042fa
sourceSha256: ffc81af5614a310568c39bb585031013ebcf0a5b801da59a58e2b7fa8ef0fa3c
translatedAt: 2026-10-09
---
# Ports

Entscheidung von Plan 11, step 57A (2026-10-08). Sie ersetzt die Entscheidung
aus step 53 (keine Ports, [Prozesse](processes.md#ports)): Programme erhalten
Ports so, wie OTP sie definiert, und externe I/O läuft über sie. Die Steps
57B–57F setzen sie um; jeder Abschnitt nennt seinen Step. Dieser Vertrag legt
die Darstellung, das Treibermodell und den I/O-Thread fest, bevor irgendein
Quelltext einen Port öffnen kann.

Umgesetzt: Identitäten, die Port-Tabelle, die Port-Builtins und -Nachrichten,
Links, Monitore, Namen und Exit-Signale von Ports sowie reine Ausgabe-`fd`-Ports
(step 57B, `runtime/src/scheduler/ports.cpp`, `runtime/src/builtins/ports.cpp`,
`runtime/src/ports/`; OTP-Golden `executables_port_identities`); der I/O-Thread
und `fd`-Port-Eingabe mit Stream-, Paket- und Zeilen-Framing (step 57C,
`runtime/src/ports/io*.cpp`; OTP-Golden `executables_port_input`);
Unterprozess-Ports, `os:type/0`, `os:getenv/1` und `os:cmd/1` (step 57D,
`runtime/src/ports/spawn*.cpp`, `library/stdlib/os.erl`; OTP-Golden
`executables_port_spawn`); der Dateitreiber, die Teilmenge `file` der
Bibliothek und Standardeingabe über `io:get_line`/`io:get_chars` (step 57E,
`runtime/src/ports/file.cpp`, `library/stdlib/{file,io}.erl`; OTP-Golden
`executables_file_io`); Sockets (step 57F, OTP-Golden `executables_sockets`);
ein ereignisgesteuerter I/O-Thread für jede Port-Art (step 57G1,
`runtime/src/ports/reactor.cpp`; OTP-Golden `executables_many_ports`,
Runtime-Test `runtime_port_io`); Port-Tasks auf den Scheduler-Workern (step
57G2, `runtime/src/scheduler/ports.cpp`; OTP-Golden
`executables_port_fairness`); ausgelastete Ports (busy ports) und begrenzte
Eingabe (step 57G3; OTP-Goldens `executables_busy_ports`,
`executables_slow_owner`).

## Identität

- Ein Port ist ein Immediate-Wort: Tag `0x7` (`TermKind2::port` unter dem
  primären Tag `see_termkind2`, neben `0x3` der Pids), als Nutzlast eine
  Port-Nummer aus einer prozessweiten Folge, die nie wiederverwendet wird, wie
  bei Pid-Nummern ([Pids](terms.md#pids-and-references)). Eine Runtime
  akzeptiert nur die Nummern, die sie selbst vergeben hat; gefälschte und
  fremde Port-Wörter werden abgewiesen.
- Ausgabe: `#Port<0.N>`; `port_to_list/1` liefert diesen Text und
  `list_to_port/1` parst ihn (badarg für alles andere).
- Ordnung: Zahlen < Atome < Referenzen < funs < Ports < Pids < Tupel, wie in
  OTP; Ports werden nach Nummer verglichen.
- Die Identität eines geschlossenen Ports bleibt gültig: `is_port/1` bleibt
  wahr, `port_info/1,2` antworten `undefined`, Sendungen an ihn werden
  verworfen.
- Ports sind Immediates, daher brauchen Kopieren, Speicherbereinigung und
  Nachrichten nichts Neues.

## Port-Tabelle und Besitz

- Jede Runtime führt in ihrem Executor eine Port-Tabelle (Nummer → Port),
  geschützt durch den Executor-Mutex wie die Links und Namen der Prozesse
  ([Worker](processes.md#workers)).
- Ein Port speichert seinen Treiber, seinen verbundenen Prozess (den Öffner,
  geändert durch `port_connect/2` oder `{Pid, {connect, New}}`), seine Links,
  die auf ihn gehaltenen Monitore, einen optionalen registrierten Namen, seine
  Optionen und seine Ein-/Ausgabe-Bytezähler.
- `open_port/2` verlinkt den neuen Port mit seinem Öffner. Endet der
  verbundene Prozess, schließt sich sein Port; ein Port, der sich schließt,
  sendet Exit-Signale an seine Links und `'DOWN'`-Nachrichten an seine
  Monitore mit seinem Grund (`normal` für ein Schließen, das kein Fehler ist,
  sonst ein POSIX-Atom wie `epipe`).
- Ein Exit-Signal, das einen Port erreicht, schließt ihn mit seinem Grund
  (`kill` aus `exit/2` als `killed`), außer `normal` über einen Link von einem
  anderen als dem verbundenen Prozess, was nur den Link entfernt.
  `exit(Port, normal)` schließt den Port. Ein verbundener Prozess, der den
  Link gelöst hat, lässt seinen Port offen, wenn er endet.
- Eine Anfrage-Nachricht von einem anderen als dem verbundenen Prozess oder
  eine fehlerhafte Nachricht sendet dem verbundenen Prozess ein Exit-Signal
  `badsig` vom Port; der Port bleibt offen.
- Exit-Signale und Nachrichten eines Ports an einen Prozess, der auf einem
  anderen Worker läuft, warten, bis dessen Zeitscheibe endet (sie enthalten
  nur Atome, Pids und Ports); ein `exit(Port, Reason)` mit einem Grund-Term
  im Heap des Senders lässt das Builtin erneut laufen, bis kein verlinkter
  oder überwachender Prozess anderswo läuft, wie bei Prozesssignalen
  ([Worker](processes.md#workers)).
- Ports nehmen registrierte Namen (`register/2`) und `monitor(port, Port)`
  an; `link/1` und `unlink/1` akzeptieren sie.

## Builtins und Port-Nachrichten

| Builtin oder Nachricht | Step |
| --- | --- |
| `is_port/1` wahr für Ports, `port_to_list/1`, `list_to_port/1`, `ports/0` | 57B |
| `port_info/1,2` (`name`, `links`, `id`, `connected`, `input`, `output`, `os_pid`, `monitors`, `monitored_by`, `registered_name`) | 57B |
| `port_close/1`, `port_connect/2`, `port_command/2,3` | 57B |
| `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}` | 57B |
| `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` auf Ports; `register/2` eines Ports | 57B |
| `port_control/3`, `port_call/3` | 57B (badarg für Treiber ohne Steuerung); genutzt von den Treibern aus 57E/57F |
| `open_port({fd, In, Out}, Opts)` | 57B Ausgabe; Eingabe ab 57C |
| `open_port({spawn, Command} \| {spawn_executable, File}, Opts)` | 57D |
| Interne Treiber der Projektbibliothek (`file`, Sockets) | 57E, 57F |

Die Builtins ersetzen die Diagnosen `[ports] notimpl` aus step 53; das Feature
`ports` gilt ab 57B als umgesetzt. Fehler folgen OTP: `badarg` für einen
geschlossenen oder ungültigen Port und ungültige Argumente, der POSIX-Grund
(`enoent`, `eacces`) als `error` für ein fehlgeschlagenes Öffnen.

Nachrichten eines Ports gehen an seinen verbundenen Prozess:
`{Port, {data, Data}}`, `{Port, eof}` (Option `eof`),
`{Port, {exit_status, Status}}` (Option `exit_status`), `{Port, closed}`
(nach `{Pid, close}`), `{Port, connected}` (an den alten Besitzer nach einem
Connect).

## Datenmodi und Optionen

| Option | Wirkung |
| --- | --- |
| `stream` (Standard), `{packet, N}` (N = 1, 2, 4) | Bytes, wie sie ankommen, oder Nachrichten, gerahmt durch eine N Byte lange Big-Endian-Länge, die auch die Ausgabe erhält |
| `{line, L}` | `{eol, Line}` pro Zeile, `{noeol, Part}` für Teile länger als `L` oder ein nicht abgeschlossenes Ende |
| `binary` | Daten als binaries statt Byte-Listen |
| `eof` | `{Port, eof}` am Ende der Eingabe; der Port bleibt offen, bis er geschlossen wird |
| `exit_status` | `{Port, {exit_status, S}}`, wenn das Programm endet (Spawn-Ports) |
| `use_stdio` (Standard), `nouse_stdio`, `stderr_to_stdout`, `in`, `out`, `hide` | Wie in OTP (`hide` hat keine Wirkung) |
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Spawn-Ports (57D) |
| `{busy_limits_port, {Low, High} \| disabled}` | Gepufferte Ausgabe-Bytes, die den Port auslasten ([ausgelastete Ports](#busy-ports), 57G3) |

Ohne `eof` schließt das Ende der Eingabe den Port mit Grund `normal`, nach der
Nachricht `exit_status`, falls diese angefordert wurde. Unbekannte Optionen
ergeben `badarg`.

## Treiber

Ein Treiber ist ein C++-Objekt hinter einem Port (`runtime/src/ports/`): Er
öffnet die Ressource, nimmt Ausgabe an (`port_command`), beantwortet
`port_control/3`, wenn er Steuerung unterstützt, meldet Eingabe und Fehler als
Ereignisse und schließt. Treiber:

- `fd`: vorhandene Deskriptoren, Ausgabe synchron geschrieben (57B), Eingabe
  über den I/O-Thread (57C).
- `spawn`: ein Kindprogramm mit stdin und stdout als Pipes (57D).
- `file`: eine geöffnete Datei des Moduls `file` der Projektbibliothek; seine
  Operationen sind synchrone `port_control/3`-Aufrufe, die den Worker, der den
  Aufrufer ausführt, für die Dauer der Platten-I/O blockieren können, wie es
  die Dirty-I/O-Scheduler von OTP tun (57E).
- `tcp_inet`, `udp_inet`: Sockets von `gen_tcp`, `gen_udp` und `inet` der
  Projektbibliothek auf Boost.Asio; Verbindungsaufbau, Annehmen und Empfangen
  sind asynchron (57F, [Sockets](#sockets-57f)).

Die internen Treiber von `file` und den Sockets werden mit
`{spawn_driver, Name}` unter Clause-Namen geöffnet, und ihre
`port_control/3`-Operationen sind ein Clause-Protokoll: Programme nutzen die
Bibliotheksmodule, nicht die Protokolle `prim_inet`/`efile` von OTP.

## I/O-Thread

Ein I/O-Thread pro Runtime (`detail::Reactor`, `runtime/src/ports/reactor.hpp`,
step 57G1) betreibt einen Boost.Asio-`io_context`: einen I/O Completion Port
unter Windows, `epoll` unter Linux, `kqueue` unter macOS. Der erste Port, der
ihn braucht, startet ihn; er bedient jede Port-Art, sodass ein Port keinen
eigenen Thread kostet:

- Pipes gestarteter Programme: überlappende Named Pipes unter Windows
  (`windows::stream_handle`; anonyme Pipes können nicht überlappend sein),
  sonst gewöhnliche Pipes (`posix::stream_descriptor`). Ausgabe wird
  gepuffert und durch asynchrone Schreibvorgänge in Reihenfolge geschrieben.
- `fd`-Eingabe unter Linux und macOS: Der Thread wartet, bis der Deskriptor
  lesbar ist, dann nimmt ein `read()`, was vorhanden ist, sodass die eigenen
  Deskriptoren des Programms ihren blockierenden Modus behalten; eine reguläre
  Datei, auf die nicht gewartet werden kann, wird sofort gelesen.
- Programmenden: Unter Windows wartet der Wait-Thread-Pool des Systems
  (`RegisterWaitForSingleObject`, wie ihn `object_handle` von Asio nutzt) auf
  das Prozess-Handle, und das Ende wird auf dem I/O-Thread gemeldet; unter
  Linux und macOS sammeln ein `SIGCHLD`-Handler (`signal_set`) und
  `waitpid(WNOHANG)` jedes überwachte Programm ein, auch nachdem sein Port
  geschlossen wurde.
- Sockets ([Sockets](#sockets-57f)).
- Ausnahme: Ein `fd`-Eingabe-Handle unter Windows (eine Konsole oder eine
  geerbte anonyme Pipe) kann nicht überlappend sein, daher liest es ein
  eigener blockierender Thread, wie bei libuv und ERTS; das Schließen des
  Ports bricht das Lesen ab (`CancelSynchronousIo`) und gibt den Thread frei.

`runtime/src/ports/io*.cpp` enthalten die Port-I/O (`detail::IoService`): Ihre
Methoden übergeben Arbeit nur an den I/O-Thread, wo der gesamte I/O-Zustand
liegt.

- Der I/O-Thread übergibt Eingabe so, wie sie gelesen wurde: rohe Bytes, das
  Ende der Eingabe, einen Lesefehler, den Exit-Status eines Programms.
  Socket-Ereignisse (Nachrichten, angenommene Verbindungen) werden auf die
  gleiche Weise übergeben.

## Port-Tasks

Step 57G2. Ein Port wird wie ein Prozess eingeplant: Was der I/O-Thread
übergibt, wartet im Port, und der Port wartet in der Port-Warteschlange des
Executors, bis ein Scheduler-Worker seinen Task ausführt.

- Worker nehmen abwechselnd einen Port-Task und eine Prozess-Zeitscheibe,
  solange beide Warteschlangen Arbeit haben, sodass ein Port, der mit Eingabe
  flutet, Prozesse nicht aushungern kann und Prozesse Ports nicht aushungern
  können; ein untätiger Worker nimmt, was gerade ansteht.
- Ein Task läuft unter dem Executor-Mutex für `PORT_TASK_REDUCTIONS` (die
  4.000 einer Zeitscheibe): Jede Nachricht, die er zustellt, kostet 100
  Reduktionen plus eine pro 64 Bytes, die sie trägt. Ein Port mit
  verbleibender Arbeit wird hinten erneut eingereiht.
- Der Task rahmt die Eingabe (`InputDecoder`): Stream-Eingabe kommt in den
  Blöcken an, die Lesevorgänge liefern; `{packet, N}` hält Bytes zurück, bis
  ein ganzes Paket angekommen ist (ein unvollständiges Paket am Ende der
  Eingabe wird verworfen, wie in OTP); `{line, L}` trennt bei `\n`, sendet eine
  Zeile, die länger als `L` ist, als `{noeol, Part}`-Stücke und ein nicht
  abgeschlossenes Ende als `{noeol, Rest}`. `port_info(P, input)` zählt jedes
  gelesene Byte, Zeilenumbrüche und Paket-Header eingeschlossen, zum
  Zeitpunkt des Lesens.
- Das Ende der Eingabe sendet `{Port, eof}` mit Option `eof`, sonst schließt
  es den Port mit Grund `normal`; ein Lesefehler schließt ihn mit `eio`.
- Eine Nachricht wird sofort zu einer Nachricht an ihren Prozess, wenn dieser
  Prozess nicht auf einem Worker läuft (sie weckt ihn wie jede Nachricht),
  sonst wenn seine Zeitscheibe endet, sodass der Heap eines laufenden
  Prozesses nie von einem anderen Thread berührt wird.
- Commands, Schließen, Connects und Exit-Signale, die an einen Port gesendet
  werden, wirken sofort auf dem Worker des Senders, wie ERTS es für einen
  nicht ausgelasteten Port tut: Ein `fd`-Port schreibt seine Ausgabe sofort
  auf dem Worker des Aufrufers; die Pipe- und Socket-Treiber puffern Ausgabe
  und lassen sie vom I/O-Thread schreiben (57D, 57F, 57G1); ein ausgelasteter
  Port suspendiert den Sender ([ausgelastete Ports](#busy-ports)).

Der Prototyp `tests/prototypes/poller/` (`run.py --wsl`) zeigt das Aufwecken
unter Windows (Completion Port) und WSL Linux (`poll()`): Ein untätiger
Scheduler-Thread wacht 9–91 µs nach der Eingabe auf, und das Herunterfahren
stoppt den I/O-Thread ohne Eingabe.

Am Programmende wird jeder Port geschlossen (Kindprogramme sehen das Ende der
Eingabe; sie werden nicht beendet, wie in OTP), und der I/O-Thread stoppt: Er
wird außerhalb des Executor-Mutex gejoint, weil eine laufende Zustellung ihn
nimmt; ein Windows-`fd`-Leser, der in einem nicht abbrechbaren Lesevorgang
blockiert, wird abgekoppelt und stellt nichts mehr zu.

## Ausgelastete Ports

Step 57G3. Ausgabe, die ein Treiber für den I/O-Thread puffert (Pipes
gestarteter Programme), zählt gegen die Auslastungsgrenzen des Ports,
`busy_limits_port` von OTP (Standardwerte: hoch 8.192 Bytes, niedrig 4.096;
`{busy_limits_port, {Low, High}}` oder `disabled` als Option von
`open_port/2`, Grenzen mindestens 1, eine niedrige Grenze über der hohen wird
auf diese gesenkt):

- Ein Schreibvorgang, der die gepufferte Ausgabe auf die hohe Grenze oder
  darüber bringt, geht noch hinaus und lastet den Port aus; er bleibt
  ausgelastet, bis der I/O-Thread genug geschrieben hat, dass weniger als die
  niedrige Grenze gepuffert ist.
- `port_command/2` und `Port ! {Pid, {command, Data}}` an einen ausgelasteten
  Port suspendieren den Sender, der nichts schreibt; sobald der Port nicht
  mehr ausgelastet ist oder sich schließt, führt der Sender sein Builtin erneut
  aus (ein geschlossener Port ergibt dann `badarg`, wie in OTP). Ein
  suspendierter Prozess empfängt weiterhin Exit-Signale.
- `port_command/3` mit `nosuspend` gibt für einen ausgelasteten Port `false`
  zurück und schreibt nichts; `force` löst `notsup` aus, da die Spawn- und
  `fd`-Treiber von OTP es nicht erlauben.
- `port_info(P, queue_size)` ist die gepufferte, noch nicht geschriebene
  Ausgabe.
- `fd`-Ports schreiben sofort, und Socket-Ausgabe geht über `port_control/3`,
  daher ist keiner von beiden je ausgelastet.

Ein Port begrenzt auch die Eingabe, die er hält:

- Wenn mehr als 64 KiB rohe Eingabe auf den Task des Ports warten, hört der
  I/O-Thread auf, den Port zu lesen (ein Programm, das in ihn schreibt,
  blockiert dann wie bei einer vollen Pipe), bis der Task sie unter 32 KiB
  gebracht hat.
- Solange der verbundene Prozess laufen kann (er läuft oder steht in der
  Warteschlange, wartet nicht in einem `receive`, ist nicht suspendiert oder
  blockiert) und bereits 1.024 Nachrichten hält (oder so viele Port-Signale
  hat, die auf das Ende seiner Zeitscheibe warten), stellt der Task des Ports
  nichts mehr zu, bis die Zeitscheibe dieses Prozesses geendet hat. Ein
  Prozess, der in einem `receive` wartet, erhält die Eingabe immer, sodass ein
  receive auf eine spätere Nachricht des Ports nicht ewig warten kann.

## Unterprozesse

Step 57D. `open_port({spawn, Command}, Options)` und
`open_port({spawn_executable, File}, Options)` starten ein Programm, dessen
stdin und stdout Pipes des Ports sind:

- `{spawn, Command}`: unter Linux und macOS `/bin/sh -c Command`; unter
  Windows `CreateProcessW` mit `Command` als Befehlszeile (es findet das
  Programm im Suchpfad). `{spawn_executable, File}` führt `File` ohne Shell
  aus, mit argv[0] `{arg0, A}` (Standard `File`) und `{args, List}`; unter
  Windows werden Argumente nach den Regeln von `CommandLineToArgvW` gequotet.
- `{env, [{Name, Value | false}]}` setzt oder entfernt Variablen des Kindes,
  `{cd, Dir}` sein Verzeichnis, `stderr_to_stdout` führt stderr in den Port
  zusammen; andernfalls teilt das Kind die stderr des Programms. `in` öffnet
  keine stdin-Pipe und `out` keine stdout-Pipe (stattdessen das Null-Gerät).
  `hide` und `overlapped_io` haben keine Wirkung.
- Ein Programm, das nicht gestartet werden kann, löst `error:Reason` mit dem
  POSIX-Grund aus (`enoent`, `eacces`, `enoexec`); ungültige Namen und
  Optionen lösen `badarg` aus.
- Ausgabe wird gepuffert und vom I/O-Thread geschrieben, mit den
  Auslastungsgrenzen des Ports ([ausgelastete Ports](#busy-ports)); das
  Schließen des Ports lässt ihn das Gepufferte fertig schreiben und schließt
  dann die stdin des Programms. Das Programm
  wird nie beendet; es endet normalerweise am Ende der Eingabe.
- Option `exit_status` sendet `{Port, {exit_status, S}}`, sobald das Programm
  geendet hat (sein Exit-Code; unter Linux und macOS 128 plus das Signal für
  ein Programm, das durch ein Signal beendet wurde), und vor `{Port, eof}`
  oder dem Schließen am Ende der Eingabe; ein Port, der nichts liest, meldet
  es, wenn das Programm endet, und schließt sich dann.
- `port_info(P, os_pid)` ist die Prozess-ID des Programms; `name` ist der
  Befehl oder die Datei.
- `os:cmd/1` der Bibliothek führt `Command` unter Windows mit `COMSPEC /c` aus
  (`cmd`, wenn nicht gesetzt) oder mit `/bin/sh -c`, sammelt stdout und
  stderr, bis das Programm sie schließt, und gibt die Bytes als Liste zurück;
  `os:type/0` ist `{win32, nt}`, `{unix, linux}` oder `{unix, darwin}`;
  `os:getenv/1` gibt einen String oder `false` zurück.

## Standard-I/O und Dateien

Step 57E.

- `io:format`, `io:put_chars` und `erlang:display` schreiben weiterhin direkt
  auf die Standardausgabe ([io](io.md)). Die Standardeingabe liest ein
  einziger Server-Prozess der Bibliothek, registriert als `clause_stdin` und
  bei erster Nutzung gestartet, der einen `{fd, 0, 1}`-Port besitzt:
  `io:get_line/1,2` schreibt den Prompt und gibt dann die nächste Zeile mit
  ihrem Zeilenumbruch zurück, den Rest der Eingabe ohne einen solchen an
  seinem Ende, dann `eof`; `io:get_chars/2,3` gibt bis zu `N` Zeichen zurück,
  dann `eof`. Anfragen mehrerer Prozesse werden in Eingangsreihenfolge
  beantwortet. Eingabe wird als Bytes zurückgegeben (ein Listenelement pro
  Byte).
- Das Modul `file` der Bibliothek steuert den Dateitreiber der Runtime,
  `{spawn_driver, "clause_file"}`, mit `port_control/3`. Seine Operationen
  (`ports/file.cpp`: open, read, write, position, read_line, close sowie die
  Pfadoperationen read_file, write_file, delete, rename, list_dir, make_dir,
  del_dir) sind synchrone Systemaufrufe auf dem Worker des Aufrufers,
  außerhalb des Executor-Mutex; ihre Antworten beginnen mit einem Status-Byte
  (0 ok, 1 Fehler und sein POSIX-Grund, 2 Dateiende). Das Protokoll ist
  Clauses eigenes.
- `file:open/2` gibt die Pid eines I/O-Servers zurück, der einen Datei-Port
  besitzt und mit dem Öffner verlinkt ist (Modi `read`, `write`, `append`,
  `exclusive`, `binary`; andere Modi werden ignoriert, wie OTP Optionen
  ignoriert, die es nicht nutzt). `read/2`, `read_line/1`, `write/2`,
  `position/2` und `io:get_line/2`, `io:get_chars/3` darauf sind Anfragen an
  diesen Server; nach `close/1` geben Anfragen `{error, terminated}` zurück,
  und `close/1` bleibt `ok`.
- Fehler folgen OTP: `{error, enoent}`, `eexist`, `eisdir` (ein Verzeichnis,
  das als Datei geöffnet oder gelesen wird), `einval` (eine negative
  Position), `ebadf` (Lesen einer nur schreibbaren oder Schreiben einer nur
  lesbaren Datei), `badarg` für ungültige Namen und Daten. Dateinamen sind
  Strings, binaries oder Atome, kodiert als UTF-8.
- Ein vom Programm referenziertes Modul, das ein Builtin des Katalogs ist
  (`io:format`), zieht das gleichnamige Bibliotheksmodul nicht mehr ins
  Programm; nur ein Aufruf einer seiner Erlang-Funktionen tut das.

## Sockets (57F)

Ein Socket ist ein Port, wie beim `inet_drv`-Backend von OTP:
`is_port(Socket)` ist wahr, und Nachrichten im aktiven Modus sind
`{tcp, Socket, Data}`, `{tcp_closed, Socket}`, `{tcp_error, Socket, Reason}`,
`{udp, Socket, Address, Port, Data}`. Die Teilmenge: `gen_tcp:connect/3,4`,
`listen/2`, `accept/1,2`, `send/2`, `recv/2,3`, `close/1`,
`controlling_process/2`, `shutdown/2`; `gen_udp:open/1,2`, `send/4`,
`recv/2,3`, `close/1`; `inet:setopts/2`, `inet:port/1`, `inet:peername/1`,
`inet:sockname/1`; Modi `{active, true | false | once}`, `binary`/`list`,
`{packet, 0 | 1 | 2 | 4 | raw}`, `{reuseaddr, Bool}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6`; IPv4- und IPv6-Adressen
als Tupel, Hostnamen als Strings oder Atome (`loopback` eingeschlossen). Die
Tuning-Optionen `nodelay`, `keepalive`, `send_timeout`, `send_timeout_close`,
`delay_send` und `exit_on_close` werden akzeptiert und nicht angewendet; jede
andere Option ergibt `exit(badarg)`, wie bei einer ungültigen in OTP.

Implementierung (`runtime/src/ports/sockets.cpp`):

- Der I/O-Thread der Runtime ([I/O-Thread](#io-thread)) bedient die Sockets;
  der Zustand jedes Sockets liegt auf diesem Thread. Die Bibliothek öffnet
  einen Port mit `{spawn_driver, "tcp_inet" | "udp_inet"}` und steuert ihn mit
  `port_control/3`; der aufrufende Worker übergibt die Operation an den
  I/O-Thread und wartet auf dessen synchrone Antwort (Status-Byte 0 und ein
  Ergebnis oder 1 und ein POSIX-Grund).
- Wartende Operationen (connect, accept, recv) antworten später mit einer
  Nachricht `{clause_socket, Socket, Reply}` an ihren Aufrufer, sodass der
  Aufrufer in einem gewöhnlichen `receive` blockiert und andere Prozesse
  weiterlaufen. Ein Timeout bricht die Anfrage ab; der Abbruch selbst
  antwortet `cancelled` nach allem, was der Socket zuvor gesendet hat, sodass
  eine Antwort, die das Rennen gewonnen hat, zurückgegeben statt verloren
  wird.
- Socket-Nachrichten werden außerhalb des Heaps beschrieben
  (`ports/value.hpp`) und bei der Zustellung im Heap des Empfängers aufgebaut,
  nach den Executor-Regeln aus [I/O-Thread](#io-thread). Eine angenommene
  Verbindung wird zu einem neuen Port, der dem Aufrufer von `accept` gehört und
  mit ihm verlinkt ist, mit dem Modus des lauschenden Sockets.
- `controlling_process/2` stoppt die aktive Zustellung, verschiebt die bereits
  an den alten Besitzer gesendeten Nachrichten des Sockets zum neuen und
  verbindet dann den Port neu, wie es `inet` von OTP tut; nur der Besitzer darf
  es aufrufen (`{error, not_owner}`).
- Ausgabe wird ohne Obergrenze gepuffert und auf dem I/O-Thread in
  Reihenfolge geschrieben. Das Schließen eines Ports sendet das Gepufferte und
  schließt dann die Verbindung geordnet (FIN); ein geschlossener Port
  antwortet jedem wartenden Aufrufer `{error, closed}`. Die Namensauflösung
  läuft auf dem Worker des Aufrufers, da sie blockiert.
- Socket-Ports werden wie andere Ports eingeplant ([Port-Tasks](#port-tasks)):
  Die Nachrichten eines Sockets warten in seinem Port, bis der Task des Ports
  sie zustellt.

## Nicht bereitgestellt

Linked-in-Treiber und NIFs, `erlang:open_port({spawn_driver, Name})` für
OTP-Treibernamen, Distributions-Ports, `port_call/3` auf den bereitgestellten
Treibern außer dem eigenen Protokoll der Bibliothek, ausgelastete Socket-Ports
sowie die Optionen `overlapped_io`, `parallelism` und `busy_limits_msgq`.
