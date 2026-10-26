---
source: docs/ports.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 0b9c882a696b24690dffccf55456c63d826a600ed7e2be286259a5df3eb6bf57
translatedAt: 2026-10-26
---
# Ports

Programme erhalten Ports so, wie OTP sie definiert, und externe I/O läuft über
sie. Die Port-Tabelle, die Exit-Regeln und die Port-Tasks stehen in
`runtime/src/scheduler/ports.cpp`, die Builtins in
`runtime/src/builtins/erlang/ports.cpp`, die Treiber und der I/O-Thread in
`runtime/src/ports/`. OTP-Goldens: `executables_port_identities`,
`executables_port_input`, `executables_port_spawn`, `executables_file_io`,
`executables_sockets`, `executables_many_ports`, `executables_port_fairness`,
`executables_busy_ports`, `executables_slow_owner`; Runtime-Test
`runtime_port_io`.

## Identität

- Ein Port ist ein Immediate-Wort: Tag `0x7` (`TermKind2::port` unter dem
  primären Tag `see_termkind2`, neben `0x3` der Pids), als Nutzlast eine
  Port-Nummer aus einer prozessweiten Folge, die nie wiederverwendet wird, wie
  bei Pid-Nummern ([Pids](terms.md#pids-and-references)). Eine Runtime
  akzeptiert nur die Nummern, die sie selbst vergeben hat; gefälschte und fremde
  Port-Wörter werden abgewiesen.
- Ausgabe: `#Port<0.N>`; `port_to_list/1` liefert diesen Text und
  `list_to_port/1` parst ihn (badarg für alles andere).
- Ordnung: Zahlen < Atome < Referenzen < Funs < Ports < Pids < Tupel, wie in
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
- `open_port/2` verlinkt den neuen Port mit seinem Öffner. Endet der verbundene
  Prozess, schließt sich sein Port; ein Port, der sich schließt, sendet
  Exit-Signale an seine Links und `'DOWN'`-Nachrichten an seine Monitore mit
  seinem Grund (`normal` für ein Schließen, das kein Fehler ist, sonst ein
  POSIX-Atom wie `epipe`).
- Ein Exit-Signal, das einen Port erreicht, schließt ihn mit seinem Grund
  (`kill` aus `exit/2` als `killed`), außer `normal` über einen Link von einem
  anderen als dem verbundenen Prozess, was nur den Link entfernt.
  `exit(Port, normal)` schließt den Port. Ein verbundener Prozess, der den Link
  gelöst hat, lässt seinen Port offen, wenn er endet.
- Eine Anfrage-Nachricht von einem anderen als dem verbundenen Prozess oder eine
  fehlerhafte Nachricht sendet dem verbundenen Prozess ein Exit-Signal `badsig`
  vom Port; der Port bleibt offen.
- Exit-Signale und Nachrichten eines Ports an einen Prozess, der auf einem
  anderen Worker läuft, warten, bis dessen Zeitscheibe endet (sie enthalten nur
  Atome, Pids und Ports); ein `exit(Port, Reason)` mit einem Grund-Term im Heap
  des Senders lässt das Builtin erneut laufen, bis kein verlinkter oder
  überwachender Prozess anderswo läuft, wie bei Prozesssignalen
  ([Worker](processes.md#workers)).
- Ports nehmen registrierte Namen (`register/2`) und `monitor(port, Port)` an;
  `link/1` und `unlink/1` akzeptieren sie.

## Builtins und Port-Nachrichten

- `is_port/1` (wahr für Ports), `port_to_list/1`, `list_to_port/1`, `ports/0`.
- `port_info/1,2`: `name`, `links`, `id`, `connected`, `input`, `output`,
  `os_pid`, `monitors`, `monitored_by`, `registered_name`, `queue_size`
  ([ausgelastete Ports](#busy-ports)).
- `port_close/1`, `port_connect/2`, `port_command/2,3`; die Nachrichten
  `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}`.
- `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` auf Ports; `register/2`
  eines Ports.
- `port_control/3`, `port_call/3`: `badarg` für Treiber ohne Steuerung; die
  Treiber `file` und Socket werden über `port_control/3` gesteuert.
- `open_port({fd, In, Out}, Opts)`, `open_port({spawn, Command}, Opts)`,
  `open_port({spawn_executable, File}, Opts)` und die internen Treiber der
  Projektbibliothek (`file`, Sockets).

Fehler folgen OTP: `badarg` für einen geschlossenen oder ungültigen Port und
ungültige Argumente, der POSIX-Grund (`enoent`, `eacces`) als `error` für ein
fehlgeschlagenes Öffnen.

Nachrichten eines Ports gehen an seinen verbundenen Prozess:
`{Port, {data, Data}}`, `{Port, eof}` (Option `eof`),
`{Port, {exit_status, Status}}` (Option `exit_status`), `{Port, closed}` (nach
`{Pid, close}`), `{Port, connected}` (an den alten Besitzer nach einem
Connect).

## Datenmodi und Optionen

| Option | Wirkung |
| --- | --- |
| `stream` (Standard), `{packet, N}` (N = 1, 2, 4) | Bytes, wie sie ankommen, oder Nachrichten, gerahmt durch eine N Byte lange Big-Endian-Länge, die auch die Ausgabe erhält |
| `{line, L}` | `{eol, Line}` pro Zeile, `{noeol, Part}` für Teile länger als `L` oder ein nicht abgeschlossenes Ende |
| `binary` | Daten als Binaries statt Byte-Listen |
| `eof` | `{Port, eof}` am Ende der Eingabe; der Port bleibt offen, bis er geschlossen wird |
| `exit_status` | `{Port, {exit_status, S}}`, wenn das Programm endet (Spawn-Ports) |
| `use_stdio` (Standard), `nouse_stdio`, `stderr_to_stdout`, `in`, `out`, `hide` | Wie in OTP (`hide` hat keine Wirkung) |
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Spawn-Ports ([Unterprozesse](#subprocesses)) |
| `{busy_limits_port, {Low, High} \| disabled}` | Gepufferte Ausgabe-Bytes, die den Port auslasten ([ausgelastete Ports](#busy-ports)) |

Ohne `eof` schließt das Ende der Eingabe den Port mit Grund `normal`, nach der
Nachricht `exit_status`, falls diese angefordert wurde. Unbekannte Optionen
ergeben `badarg`.

## Treiber

Ein Treiber ist ein C++-Objekt hinter einem Port (`runtime/src/ports/`): Er
öffnet die Ressource, nimmt Ausgabe an (`port_command`), beantwortet
`port_control/3`, wenn er Steuerung unterstützt, meldet Eingabe und Fehler als
Ereignisse und schließt. Treiber:

- `fd`: vorhandene Deskriptoren, Ausgabe synchron geschrieben, Eingabe über den
  I/O-Thread.
- `spawn`: ein Kindprogramm mit stdin und stdout als Pipes
  ([Unterprozesse](#subprocesses)).
- `file`: eine geöffnete Datei des Moduls `file` der Projektbibliothek; seine
  Operationen sind synchrone `port_control/3`-Aufrufe, die den Worker, der den
  Aufrufer ausführt, für die Dauer der Platten-I/O blockieren können, wie es die
  Dirty-I/O-Scheduler von OTP tun ([Dateien](#standard-io-and-files)).
- `tcp_inet`, `udp_inet`: Sockets von `gen_tcp`, `gen_udp` und `inet` der
  Projektbibliothek auf Boost.Asio; Verbindungsaufbau, Annehmen und Empfangen
  sind asynchron ([Sockets](#sockets)).
- `clause_registry` (Windows): die Registry von `win32reg`
  ([die Registry](#the-registry)).

Die internen Treiber von `file`, den Sockets und der Registry werden mit
`{spawn_driver, Name}` unter Clause-Namen geöffnet, und ihre
`port_control/3`-Operationen sind ein Clause-Protokoll: Programme nutzen die
Bibliotheksmodule, nicht die Protokolle `prim_inet`/`efile` von OTP.

## I/O-Thread

Ein I/O-Thread pro Runtime (`detail::Reactor`, `runtime/src/ports/reactor.hpp`)
betreibt einen Boost.Asio-`io_context`: einen I/O Completion Port unter
Windows, `epoll` unter Linux, `kqueue` unter macOS. Der erste Port, der ihn
braucht, startet ihn; er bedient jede Port-Art, sodass ein Port keinen eigenen
Thread kostet:

- Pipes gestarteter Programme: überlappende Named Pipes unter Windows
  (`windows::stream_handle`; anonyme Pipes können nicht überlappend sein), sonst
  gewöhnliche Pipes (`posix::stream_descriptor`). Ausgabe wird gepuffert und
  durch asynchrone Schreibvorgänge in Reihenfolge geschrieben.
- `fd`-Eingabe unter Linux und macOS: Der Thread wartet, bis der Deskriptor
  lesbar ist, dann nimmt ein `read()`, was vorhanden ist, sodass die eigenen
  Deskriptoren des Programms ihren blockierenden Modus behalten; eine reguläre
  Datei, auf die nicht gewartet werden kann, wird sofort gelesen.
- Programmenden: Unter Windows wartet der Wait-Thread-Pool des Systems
  (`RegisterWaitForSingleObject`, wie ihn `object_handle` von Asio nutzt) auf
  das Prozess-Handle, und das Ende wird auf dem I/O-Thread gemeldet; unter Linux
  und macOS sammeln ein `SIGCHLD`-Handler (`signal_set`) und
  `waitpid(WNOHANG)` jedes überwachte Programm ein, auch nachdem sein Port
  geschlossen wurde.
- Sockets ([Sockets](#sockets)).
- Ausnahme: Ein `fd`-Eingabe-Handle unter Windows (eine Konsole oder eine
  geerbte anonyme Pipe) kann nicht überlappend sein, daher liest es ein eigener
  blockierender Thread, wie bei libuv und ERTS; das Schließen des Ports bricht
  das Lesen ab (`CancelSynchronousIo`) und gibt den Thread frei.

`runtime/src/ports/io*.cpp` enthalten die Port-I/O (`detail::IoService`): Ihre
Methoden übergeben Arbeit nur an den I/O-Thread, wo der gesamte I/O-Zustand
liegt. Der I/O-Thread übergibt Eingabe so, wie sie gelesen wurde: rohe Bytes,
das Ende der Eingabe, einen Lesefehler, den Exit-Status eines Programms.
Socket-Ereignisse (Nachrichten, angenommene Verbindungen) werden auf die gleiche
Weise übergeben.

Der Prototyp `tests/prototypes/poller/` (`run.py --wsl`) zeigt das Aufwecken
unter Windows (Completion Port) und WSL Linux (`poll()`): Ein untätiger
Scheduler-Thread wacht 9–91 µs nach der Eingabe auf, und das Herunterfahren
stoppt den I/O-Thread ohne Eingabe.

Am Programmende wird jeder Port geschlossen (Kindprogramme sehen das Ende der
Eingabe; sie werden nicht beendet, wie in OTP), und der I/O-Thread stoppt: Er
wird außerhalb des Executor-Mutex gejoint, weil eine laufende Zustellung ihn
nimmt; ein Windows-`fd`-Leser, der in einem nicht abbrechbaren Lesevorgang
blockiert, wird abgekoppelt und stellt nichts mehr zu.

## Port-Tasks

Ein Port wird wie ein Prozess eingeplant: Was der I/O-Thread übergibt, wartet im
Port, und der Port wartet in der Port-Warteschlange des Executors, bis ein
Scheduler-Worker seinen Task ausführt.

- Worker nehmen abwechselnd einen Port-Task und eine Prozess-Zeitscheibe,
  solange beide Warteschlangen Arbeit haben, sodass ein Port, der mit Eingabe
  flutet, Prozesse nicht aushungern kann und Prozesse Ports nicht aushungern
  können; ein untätiger Worker nimmt, was gerade ansteht.
- Ein Task läuft unter dem Executor-Mutex für `PORT_TASK_REDUCTIONS` (die 4.000
  einer Zeitscheibe): Jede Nachricht, die er zustellt, kostet 100 Reduktionen
  plus eine pro 64 Bytes, die sie trägt. Ein Port mit verbleibender Arbeit wird
  hinten erneut eingereiht.
- Der Task rahmt die Eingabe (`InputDecoder`): Stream-Eingabe kommt in den
  Blöcken an, die Lesevorgänge liefern; `{packet, N}` hält Bytes zurück, bis ein
  ganzes Paket angekommen ist (ein unvollständiges Paket am Ende der Eingabe
  wird verworfen, wie in OTP); `{line, L}` trennt bei `\n`, sendet eine Zeile,
  die länger als `L` ist, als `{noeol, Part}`-Stücke und ein nicht
  abgeschlossenes Ende als `{noeol, Rest}`. `port_info(P, input)` zählt jedes
  gelesene Byte, Zeilenumbrüche und Paket-Header eingeschlossen, zum Zeitpunkt
  des Lesens.
- Das Ende der Eingabe sendet `{Port, eof}` mit Option `eof`, sonst schließt es
  den Port mit Grund `normal`; ein Lesefehler schließt ihn mit `eio`.
- Eine Nachricht wird sofort zu einer Nachricht an ihren Prozess, wenn dieser
  Prozess nicht auf einem Worker läuft (sie weckt ihn wie jede Nachricht), sonst
  wenn seine Zeitscheibe endet, sodass der Heap eines laufenden Prozesses nie
  von einem anderen Thread berührt wird.
- Commands, Schließen, Connects und Exit-Signale, die an einen Port gesendet
  werden, wirken sofort auf dem Worker des Senders, wie ERTS es für einen nicht
  ausgelasteten Port tut: Ein `fd`-Port schreibt seine Ausgabe sofort auf dem
  Worker des Aufrufers; die Pipe- und Socket-Treiber puffern Ausgabe und lassen
  sie vom I/O-Thread schreiben; ein ausgelasteter Port suspendiert den Sender
  ([ausgelastete Ports](#busy-ports)).

## Ausgelastete Ports

Ausgabe, die ein Treiber für den I/O-Thread puffert (Pipes gestarteter
Programme), zählt gegen die Auslastungsgrenzen des Ports, `busy_limits_port` von
OTP (Standardwerte: hoch 8.192 Bytes, niedrig 4.096;
`{busy_limits_port, {Low, High}}` oder `disabled` als Option von
`open_port/2`, Grenzen mindestens 1, eine niedrige Grenze über der hohen wird
auf diese gesenkt):

- Ein Schreibvorgang, der die gepufferte Ausgabe auf die hohe Grenze oder
  darüber bringt, geht noch hinaus und lastet den Port aus; er bleibt
  ausgelastet, bis der I/O-Thread genug geschrieben hat, dass weniger als die
  niedrige Grenze gepuffert ist.
- `port_command/2` und `Port ! {Pid, {command, Data}}` an einen ausgelasteten
  Port suspendieren den Sender, der nichts schreibt; sobald der Port nicht mehr
  ausgelastet ist oder sich schließt, führt der Sender sein Builtin erneut aus
  (ein geschlossener Port ergibt dann `badarg`, wie in OTP). Ein suspendierter
  Prozess empfängt weiterhin Exit-Signale.
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
  blockiert) und bereits 1.024 Nachrichten hält (oder so viele Port-Signale hat,
  die auf das Ende seiner Zeitscheibe warten), stellt der Task des Ports nichts
  mehr zu, bis die Zeitscheibe dieses Prozesses geendet hat. Ein Prozess, der in
  einem `receive` wartet, erhält die Eingabe immer, sodass ein receive auf eine
  spätere Nachricht des Ports nicht ewig warten kann.

## Unterprozesse

`open_port({spawn, Command}, Options)` und
`open_port({spawn_executable, File}, Options)` starten ein Programm, dessen
stdin und stdout Pipes des Ports sind:

- `{spawn, Command}`: unter Linux und macOS `/bin/sh -c Command`; unter Windows
  `CreateProcessW` mit `Command` als Befehlszeile (es findet das Programm im
  Suchpfad). `{spawn_executable, File}` führt `File` ohne Shell aus, mit
  argv[0] `{arg0, A}` (Standard `File`) und `{args, List}`; unter Windows
  werden Argumente nach den Regeln von `CommandLineToArgvW` gequotet.
- `{env, [{Name, Value | false}]}` setzt oder entfernt Variablen des Kindes,
  `{cd, Dir}` sein Verzeichnis, `stderr_to_stdout` führt stderr in den Port
  zusammen; andernfalls teilt das Kind die stderr des Programms. `in` allein
  öffnet keine stdin-Pipe und `out` allein keine stdout-Pipe (stattdessen das
  Null-Gerät); mit beiden oder keiner der Optionen hat der Port beide Pipes,
  wie in OTP. `hide` und `overlapped_io` haben keine Wirkung.
- Ein Programm, das nicht gestartet werden kann, löst `error:Reason` mit dem
  POSIX-Grund aus (`enoent`, `eacces`, `enoexec`); ungültige Namen und Optionen
  lösen `badarg` aus.
- Ausgabe wird gepuffert und vom I/O-Thread geschrieben, mit den
  Auslastungsgrenzen des Ports ([ausgelastete Ports](#busy-ports)); das
  Schließen des Ports lässt ihn das Gepufferte fertig schreiben und schließt
  dann die stdin des Programms. Das Programm wird nie beendet; es endet
  normalerweise am Ende der Eingabe.
- Option `exit_status` sendet `{Port, {exit_status, S}}`, sobald das Programm
  geendet hat (sein Exit-Code; unter Linux und macOS 128 plus das Signal für ein
  Programm, das durch ein Signal beendet wurde), und vor `{Port, eof}` oder dem
  Schließen am Ende der Eingabe; ein Port, der nichts liest, meldet es, wenn das
  Programm endet, und schließt sich dann.
- `port_info(P, os_pid)` ist die Prozess-ID des Programms; `name` ist der Befehl
  oder die Datei.
- `os:cmd/1` der Bibliothek führt `Command` unter Windows mit `COMSPEC /c` aus
  (`cmd`, wenn nicht gesetzt) oder mit `/bin/sh -c`, sammelt stdout und stderr,
  bis das Programm sie schließt, und gibt die Bytes als Liste zurück;
  `os:type/0` ist `{win32, nt}`, `{unix, linux}` oder `{unix, darwin}`;
  `os:getenv/1` gibt einen String oder `false` zurück.

## Standard-I/O und Dateien

- `io:format`, `io:put_chars` und `erlang:display` schreiben direkt auf die
  Standardausgabe ([io](io.md)). Die Standardeingabe liest ein einziger
  Server-Prozess der Bibliothek, registriert als `clause_stdin` und bei erster
  Nutzung gestartet, der einen `{fd, 0, 1}`-Port besitzt: `io:get_line/1,2`
  schreibt den Prompt und gibt dann die nächste Zeile mit ihrem Zeilenumbruch
  zurück, den Rest der Eingabe ohne einen solchen an seinem Ende, dann `eof`;
  `io:get_chars/2,3` gibt bis zu `N` Zeichen zurück, dann `eof`. Anfragen
  mehrerer Prozesse werden in Eingangsreihenfolge beantwortet. Eingabe wird als
  UTF-8 in Zeichen dekodiert, wie OTP sein Terminal liest; der Server hält die
  noshell-Optionen von OTP für `standard_io` (`binary`, `encoding`, `echo`,
  `log`; `io:getopts/0,1`, `io:setopts/1,2`): Der binary-Modus gibt binaries
  zurück, `echo` schreibt verbrauchte Eingabe auf die Standardausgabe,
  `get_password` ergibt ohne Shell `{error, enotsup}`, wie bei OTP.
- Dateiserver beantworten `getopts` und `setopts` wie der Datei-I/O-Server von
  OTP (`binary`/`list` und `encoding`; `file:open/2` nimmt `{encoding, E}` an):
  I/O-Anfragen (`io:get_line`, `get_chars`, `put_chars`, `get_until`) kodieren
  und dekodieren die Gerätekodierung, und `file:read/2`, `read_line/1` auf einer
  kodierten Datei antworten wie latin1-Anfragen an `get_chars`/`get_line`
  (`no_translation` über 255, was den Server stoppt). Ausgabe von
  `io:format/3`, `io:put_chars/2`, `io:nl/1` an eine beliebige Pid ist eine
  `put_chars`-Anfrage im I/O-Protokoll.
- Das Modul `file` der Bibliothek steuert den Dateitreiber der Runtime,
  `{spawn_driver, "clause_file"}`, mit `port_control/3`. Seine Operationen
  (`ports/file.cpp`: open, read, write, position, read_line, sync, close sowie die
  Pfadoperationen read_file, write_file, delete, rename, list_dir, make_dir,
  del_dir und read_file_info, `ports/file_info.cpp`; get_cwd, set_cwd,
  read_link, read_link_info, make_link und make_symlink,
  `ports/file_paths.cpp`) sind synchrone Systemaufrufe auf dem Worker des
  Aufrufers, außerhalb des Executor-Mutex; ihre Antworten beginnen mit einem
  Status-Byte (0 ok, 1 Fehler und sein POSIX-Grund, 2 Dateiende). Das Protokoll
  ist Clauses eigenes. read_line liest 64 KB im Voraus und gibt Zeilen aus
  diesem Puffer zurück; jede andere Operation auf der Datei springt zuerst über
  die noch nicht zurückgegebenen Bytes zurück, sodass Positionen exakt bleiben.
- Pfadoperationen führen die Systemaufrufe von OTP aus und keine weiteren: Der
  Status eines Pfads wird erst gelesen, wenn ein Öffnen oder Löschen scheitert
  (um `eisdir` oder `eperm` zurückzugeben); delete entfernt den Link einer Datei
  und nie ein Verzeichnis, und read_file liest eine Datei bis zu der von ihrem
  Deskriptor gemeldeten Größe, wie OTP, ohne ihr Ende durch Lesen zu prüfen.
- `port_control/3` übergibt ein binary oder `[]` direkt an den Treiber (andere
  iodata werden zuerst abgeflacht), und eine Antwort wird ohne Kopie zum
  Ergebnis-binary: Antworten sind `ByteBuffer`s
  (`runtime/include/byte_buffer.hpp`), Byte-Vektoren, die ohne Nullen wachsen,
  sodass ein Lesevorgang die Bytes seiner Antwort einmal füllt.
- `file:open/2` gibt die Pid eines I/O-Servers zurück, der einen Datei-Port
  besitzt und sich schließt, wenn der Öffner endet, wie bei OTP (unter Windows
  ist die Datei zum Lesen, Schreiben und Löschen freigegeben, wie OTP sie
  öffnet, sodass eine geöffnete Datei gelöscht oder umbenannt werden kann)
  (Modi `read`, `write`, `append`, `exclusive`, `binary`, `raw`; andere Modi
  werden ignoriert, wie OTP Optionen ignoriert, die es nicht nutzt; `write`
  kürzt die Datei, sofern nicht auch `append` angegeben ist).
- `file:write_file/3` öffnet mit seinen Modi plus `binary` und `write`;
  `file:read_file_info/1,2` geben das `#file_info{}` von OTP aus dem Status des
  Pfads zurück (Links werden verfolgt), mit Zeiten als lokales oder universelles
  Datum und Uhrzeit oder POSIX-Sekunden (`{time, local | universal | posix}`;
  `raw` wird akzeptiert). Unter Windows sind `inode`, `uid` und `gid` 0, und
  `major_device` ist die Laufwerksnummer, wie OTP sie meldet. `read/2`,
  `read_line/1`, `write/2`, `position/2` und `io:get_line/2`,
  `io:get_chars/3` darauf sind Anfragen an diesen Server; nach `close/1` geben
  Anfragen `{error, terminated}` zurück, und `close/1` bleibt `ok`.
- Positionierte I/O und Dateiänderungen: `pread/2,3` und `pwrite/2,3`
  positionieren auf einem Dateiserver und lesen oder schreiben dann (`cur`
  liest weiter, die Position verschiebt sich), wie der Server von OTP; eine
  `raw`-Datei nimmt nur ganzzahlige Offsets an (sonst `badarg`) und behält ihre
  Position. `truncate/1` kürzt an der Position; `advise/4` nimmt die
  Hinweis-Atome von OTP an (`posix_fadvise` unter Linux, anderswo ignoriert,
  wie bei OTP); `allocate/3` reserviert Platz (`fallocate`, macOS
  `F_PREALLOCATE`, `{error, enotsup}` unter Windows), wobei seine Argumente
  zuerst geprüft werden (`badarg` für Nichtzahlen, `einval` für negative Werte
  und Floats). Wie der Dateiserver von OTP antwortet ein Server, dessen
  Schreiben, positioniertes Schreiben, sync, truncate oder advice scheitert,
  mit dem Fehler und endet, sodass spätere Anfragen `{error, terminated}`
  erhalten; eine raw-Datei läuft weiter. `write_file_info/2,3` und
  `change_mode/2`, `change_owner/2,3`, `change_group/2`, `change_time/2,3`
  ändern Besitzer, Berechtigungen und Zeiten in der Reihenfolge von prim_file
  (Windows: Besitzer ignoriert, nur das Schreibschutzattribut aus dem
  Schreibbit des Besitzers, auch die Erstellungszeit wird gesetzt).
  `sendfile/2,5` lesen eine raw-Datei in Blöcken (höchstens 1 MiB,
  `chunk_size`) und senden sie mit `gen_tcp:send/2` oder dem angegebenen fun,
  dem Rückfallpfad von OTP: Clause hat kein natives sendfile. `format_error/1`
  liefert die Texte von OTP, POSIX-Texte aus `erl_posix_msg:message/1`.
- Zeilen und fehlgeschlagene Lesevorgänge: `read_line/1` und `io:get_line`
  lesen ein CRLF-Ende als LF (die Position zählt das CR), wie OTP; ein
  Dateiserver, dessen Lesevorgang scheitert, antwortet mit dem Fehler und endet,
  und einer, dessen Zeilenlesen scheitert, endet ohne Antwort (der Aufrufer
  erhält `{error, terminated}`), wie bei OTP.
- `compressed` und `compressed_one`: Schreiben läuft durch einen
  gzip-deflate-Stream (zlib, window bits 31), der beim Schließen abgeschlossen
  wird, auch wenn der Server stoppt oder sein Öffner endet; Lesen dekomprimiert
  eine Datei, die mit den Kennbytes von gzip beginnt (`compressed` liest
  verkettete Teile als einen, `compressed_one` stoppt nach dem ersten), und
  liest jede andere Datei unverändert. Positionen zählen unkomprimierte Bytes:
  vorwärts durch Lesen oder Schreiben von Nullen, rückwärts nur beim Lesen
  (erneut vom Anfang an), `eof` ergibt `einval`. Lesen einer zum Schreiben
  geöffneten Datei oder Schreiben einer zum Lesen geöffneten ergibt `ebadf`;
  `allocate/3` und bei raw-Dateien positionierte I/O ergeben `enotsup`; ein
  Dateiserver stoppt nach `truncate`, `advise` und `sync` (`enotsup`), wie bei
  OTP. Gleichzeitiges Lesen und Schreiben oder Anhängen ergibt
  `{error, einval}`.
- `{zstd, Options}`: wie `compressed`, über einen mit `Options` erzeugten
  zstd-Kontext (`{error, badarg}`, wenn er sie ablehnt): Jeder Schreibvorgang
  ist ein eigener Frame, und Schließen fügt einen leeren hinzu, wie die
  Schicht von OTP schreibt; Lesen dekomprimiert die in 8-KiB-Blöcken gelesenen
  Frames.
- `ram`: Die Datei ist ihr iodata-Inhalt im Speicher, von einem Prozess wie
  andere Dateien bedient und mit ihrem Öffner geschlossen; nur die Modi
  `read`, `write` und `binary` (`read`, wenn keiner angegeben ist, alles andere
  `badarg`, `raw` mit `ram` löst `badarg` aus). Lesen, Schreiben, Positionen,
  `pread`/`pwrite` (die Position bleibt erhalten), `truncate`, `sync`, `advise`
  und `allocate` antworten wie der ram-Dateitreiber von OTP: Schreiben hinter
  dem Ende füllt die Lücke mit Nullen, Offsets und Größen jenseits von 32 Bit mit
  Vorzeichen ergeben `einval`, Schreiben einer nur lesbaren Datei ergibt
  `ebadf`, ihr Kürzen `eacces`.
- Das I/O-Protokoll von OTP: Der Standardeingabe-Server und der Server jeder
  geöffneten Datei beantworten `{io_request, From, ReplyAs, Request}` mit
  `{io_reply, ReplyAs, Reply}`, was `io:request/1,2` und `io:requests/1,2`
  senden (`standard_io` und `user` bezeichnen den Standardeingabe-Server, ein
  anderes Atom einen registrierten Prozess; `{error, arguments}`, wenn er nicht
  registriert ist, `{error, calling_self}` für den Aufrufer selbst). Anfragen:
  `get_until` (`M:F(Cont, Chars | eof, Extra...)` ab `Cont = []`, gespeist mit
  dem Gepufferten oder mit Dateiblöcken von 4 KiB bis `{done, Result, Rest}`;
  `Rest` wird von der nächsten Anfrage erneut gelesen: im Puffer behalten, oder
  bei einer Datei wird die Position darüber zurückbewegt), `get_line`,
  `get_chars`, `put_chars` (Zeichen oder `M:F(A)`), die alten Formen ohne
  Kodierung (latin1) und `{requests, List}` (der Reihe nach, mit Abbruch beim
  ersten `{error, _}`). Zeichen sind Bytes, wie oben; eine Datei im Binärmodus
  gibt ein Listenergebnis von `get_until` als Binary zurück. Andere erhalten
  `{error, {request, Request}}`. Eine fehlschlagende `get_until`- oder
  `put_chars`-Funktion lässt den Server einer Datei `{error, Function}`
  antworten und mit dem Fehler enden, wie es der von OTP tut; der Öffner lebt
  weiter (der Dateiserver von OTP ist nicht mit ihm verlinkt). Eingabeanfragen
  auf der Standardeingabe schreiben ihren Prompt.
- Verzeichnisse, Links und Kopien: `get_cwd/0` schreibt das aktuelle
  Verzeichnis wie OTP (Schrägstriche, ein kleingeschriebener
  Laufwerksbuchstabe), `get_cwd/1` nimmt ein Windows-Laufwerk (`enotsup`
  anderswo); `set_cwd/1` ändert es für das ganze Programm; `read_link/1`,
  `read_link_all/1` (`einval` für einen Pfad, der kein Link ist),
  `read_link_info/1,2` (der eigene Status eines letzten Links: POSIX `lstat`,
  unter Windows die Felder des Ziels mit Typ `symlink`), `make_link/2`,
  `make_symlink/2` (braucht unter Windows ein Privileg: `eperm`, wie OTP),
  `list_dir_all/1`, `del_dir_r/1`, `copy/2,3` (Namen, `{Name, Modes}` oder
  geöffnete Dateien; `{ok, BytesCopied}`), `raw_read_file_info/1`,
  `read_file/2`, `delete/2`, `native_name_encoding/0` (`utf8`). `del_dir/1`
  antwortet `enoent` für einen fehlenden Pfad und `enotdir` für eine Datei.
- Das `file` von Clause ist die Dateischicht; `filelib` und `filename` von
  Clause laufen darauf (`filelib:fold_files/5` nutzt `re`);
  `erl_prim_loader` wird über `file` bereitgestellt, mit den bloßen
  `error`-Antworten von OTP und einem Loader-Pfad von `["."]` (`set_path/1`),
  seine Lade- und Archivfunktionen werden abgelehnt; `prim_file` und
  `prim_buffer` fehlen weiterhin, sodass die Aufrufer von `raw_file_io*`
  aus OTP nie in ein Programm gelangen.
- Fehler folgen OTP: `{error, enoent}`, `eexist`, `eisdir` (ein Verzeichnis, das
  als Datei geöffnet oder gelesen wird), `einval` (eine negative Position;
  `badarg` für eine Angabe, die keine Position ist),
  `ebadf` (Lesen einer nur schreibbaren oder Schreiben einer nur lesbaren
  Datei), `badarg` für ungültige Namen und Daten. Dateinamen sind Strings,
  Binaries oder Atome, kodiert als UTF-8.

## Sockets

Ein Socket ist ein Port, wie beim `inet_drv`-Backend von OTP:
`is_port(Socket)` ist wahr, und Nachrichten im aktiven Modus sind
`{tcp, Socket, Data}`, `{tcp_closed, Socket}`, `{tcp_error, Socket, Reason}`,
`{udp, Socket, Address, Port, Data}`. Die Teilmenge:
`gen_tcp:connect/2,3,4` (Host und Port oder eine Socket-Adress-map),
`listen/2`, `accept/1,2`, `send/2`, `recv/2,3`, `close/1`,
`controlling_process/2`, `shutdown/2`; `gen_udp:open/1,2`, `connect/2,3`,
`send/2,3,4,5` (die Zielformen und Zusatzdaten von OTP), `recv/2,3`,
`close/1`; `inet:setopts/2`, `getopts/2`, `getstat/1,2`, `info/1`, `i/0,1,2`,
`monitor/1`, `cancel_monitor/1`, `port/1`, `peername/1`, `peernames/1,2`,
`sockname/1`, `socknames/1,2`; Modi `{active, true | false | once}`,
`binary`/`list` (`{mode, M}`), `{packet, 0 | 1 | 2 | 4 | raw}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6`; IPv4- und IPv6-Adressen
als Tupel, Hostnamen als Strings oder Atome (`loopback` eingeschlossen).

Optionen jenseits des Datenmodus (`ports/socket_options.cpp`,
`library/kernel/clause_socket_options.erl`) sind Treiber-records aus einem
Code und einem Wert, angegeben beim Öffnen eines Sockets (gesetzt vor dem
Binden oder Verbindungsaufbau) oder durch `setopts/2`; jede Option eines
`setopts/2`-Aufrufs wird geprüft, bevor eine gesetzt wird. Die Systemoptionen
(`reuseaddr`, `keepalive`, `dontroute`, `linger`, `broadcast`, `sndbuf`,
`recbuf`, `nodelay`, `tos`, `tclass`, `ipv6_v6only`, `multicast_ttl`,
`multicast_loop`, `multicast_if`, `add_membership`, `drop_membership`,
`exclusiveaddruse` unter Windows, `priority` und `reuseport`, wo das System
sie anbietet) gehen an `setsockopt` und werden mit `getsockopt` zurückgelesen;
die Optionen, die `inet_drv` von OTP selbst hält (`buffer`, `header`,
`deliver`, `exit_on_close`, `send_timeout`, Wasserstandsmarken,
`packet_size`, ...), werden mit den Standardwerten von inet_drv gehalten und
nicht angewendet ([Unterschiede](differences.md)). Wie bei inet_drv erhöht ein
Empfangspuffer `buffer`, bis es gesetzt wird, und `getopts/2` lässt Optionen
aus, die einem Socket-Typ fehlen (`broadcast` bei einem TCP-Socket, `nodelay`
bei einem UDP-Socket, `tclass` bei IPv4), und weist unbekannte mit
`{error, einval}` ab. Eine angenommene Verbindung übernimmt die Optionen ihres
lauschenden Sockets. `send/5` mit Zusatzdaten setzt `tos`, `tclass` oder `ttl`
nur für dieses Datagramm; unter Windows ergibt es `{error, einval}`, wie OTP.

Jeder Socket zählt seinen Datenverkehr für `getstat/1,2` wie inet_drv:
Empfangene Pakete sind Lesevorgänge (TCP) oder Datagramme, gesendete Pakete sind
`send`-Aufrufe (mit ihrem Paket-Header) oder Datagramme, mit den gleitenden
Durchschnittswerten von inet_drv; `send_pend` ist die gepufferte und noch nicht
geschriebene Ausgabe. `getstatus` liefert die Status-Flags von inet_drv
(`open`, `connected`, `connecting`, `listen`, `accepting`), die `info/1` und
`i/0,1,2` mit den Namen und der Modulspalte von OTP (`inet_tcp`, `inet6_udp`,
...) ausgeben. Abfragen eines geschlossenen Sockets antworten
`{error, einval}`, wie OTP.

Das Modul `socket` (`library/kernel/socket.erl`) nutzt dieselben Treiber-Ports
im passiven binary-Modus. Ein Stream-Socket kann vor dem Lauschen oder
Verbindungsaufbau gebunden werden (Operation 22 öffnet und bindet den
System-Socket, den `listen` zum Acceptor macht oder `connect` verbindet); ein
Datagramm-Socket wird durch `udp_open` gebunden, implizit bei seinem ersten
Senden. Das Ende einer Verbindung beantwortet jedes wartende `recv` (auch
eines, das mehr Bytes anfordert, als übrig sind). `socket` hält die Bytes, die
ein recv nicht übernommen hat, in seinem eigenen Puffer, sodass `recv/2,3,4`
die Antworten `{error, {timeout, Data}}` und `{error, {closed, Data}}` von OTP
liefert.

Implementierung (`runtime/src/ports/sockets.cpp`):

- Der I/O-Thread der Runtime ([I/O-Thread](#io-thread)) bedient die Sockets;
  der Zustand jedes Sockets liegt auf diesem Thread. Die Bibliothek öffnet einen
  Port mit `{spawn_driver, "tcp_inet" | "udp_inet"}` und steuert ihn mit
  `port_control/3`; der aufrufende Worker übergibt die Operation an den
  I/O-Thread und wartet auf dessen synchrone Antwort (Status-Byte 0 und ein
  Ergebnis oder 1 und ein POSIX-Grund).
- Wartende Operationen (connect, accept, recv) antworten später mit einer
  Nachricht `{clause_socket, Socket, Reply}` an ihren Aufrufer, sodass der
  Aufrufer in einem gewöhnlichen `receive` blockiert und andere Prozesse
  weiterlaufen. Ein Timeout bricht die Anfrage ab; der Abbruch selbst antwortet
  `cancelled` nach allem, was der Socket zuvor gesendet hat, sodass eine
  Antwort, die das Rennen gewonnen hat, zurückgegeben statt verloren wird.
- Socket-Nachrichten werden außerhalb des Heaps beschrieben
  (`ports/value.hpp`) und bei der Zustellung im Heap des Empfängers aufgebaut
  ([Port-Tasks](#port-tasks)). Eine angenommene Verbindung wird zu einem neuen
  Port, der dem Aufrufer von `accept` gehört und mit ihm verlinkt ist, mit dem
  Modus des lauschenden Sockets.
- `controlling_process/2` stoppt die aktive Zustellung, verschiebt die bereits
  an den alten Besitzer gesendeten Nachrichten des Sockets zum neuen und
  verbindet dann den Port neu, wie es `inet` von OTP tut; nur der Besitzer darf
  es aufrufen (`{error, not_owner}`).
- Ausgabe wird ohne Obergrenze gepuffert und auf dem I/O-Thread in Reihenfolge
  geschrieben. Das Schließen eines Ports sendet das Gepufferte und schließt dann
  die Verbindung geordnet (FIN); ein geschlossener Port antwortet jedem
  wartenden Aufrufer `{error, closed}`. Die Namensauflösung läuft auf dem
  Worker des Aufrufers, da sie blockiert.
- Socket-Ports werden wie andere Ports eingeplant ([Port-Tasks](#port-tasks)):
  Die Nachrichten eines Sockets warten in seinem Port, bis der Task des Ports
  sie zustellt.
- Adressen und Hosts: `inet:parse_address/1,2`, `parse_strict_address/1,2`,
  `parse_ipv4_address/1`, `parse_ipv4strict_address/1`,
  `parse_ipv6_address/1`, `parse_ipv6strict_address/1` (die toleranten Formen
  von OTP: kurze sowie oktale oder hexadezimale IPv4-Felder, `::`, IPv4-Enden,
  `%scope` von `fe80::` und `ff02::`), `ntoa/1` (die Schreibweise von OTP:
  kleingeschriebenes Hexadezimal, die erste längste Nullfolge als `::`),
  `is_ipv4_address/1`, `is_ipv6_address/1`, `is_ip_address/1` sind Erlang;
  `gethostname/0` (eine Socket-Operation), `getaddr/2`, `getaddrs/2` (der
  Resolver des Systems, `getaddrinfo`) und `gethostbyname/1,2` (`h_name` ist
  der angefragte Name, keine Aliasse) antworten über einen für die Anfrage
  geöffneten Socket-Port.
- Dienste, Rückwärtsauflösung und Schnittstellen (`inet:getservbyname/2`,
  `getservbyport/2`, `gethostbyaddr/1`, `getifaddrs/0,1`) sind mit `net`
  geteilte `clause_net`-Builtins
  ([Netzwerknamen](builtins.md#network-names)).
- `gen_tcp`, `gen_udp`, `inet` und `net` von Clause sind die Netzwerkschicht;
  das Modul `socket` von OTP (die Socket-NIF-API) fehlt, ebenso `prim_socket`,
  `prim_net`, `prim_inet` und `socket_registry`.

## Die Registry

`win32reg` öffnet `{spawn_driver, "clause_registry"}` unter Windows
(`runtime/src/ports/registry_windows.cpp`). Der Treiber hält den Zustand des
Registry-Treibers von OTP (den angeforderten Zugriff, den aktuellen Schlüssel
und seine Wurzel, anfangs `HKEY_CLASSES_ROOT`) und beantwortet die neun Befehle
von OTP als synchrone `port_control/3`-Operationen mit den Antworten, die der
Treiber von OTP als Port-Daten sendet: `o`, `e` und der errno-Name
(Registry-Schäden ergeben `eio`, ein gelöschter Schlüssel `einval`, andere
Windows-Fehler werden wie von der C-Runtime abgebildet), `k` und ein
Schlüsselname, `v`, der Typ, Name und die Daten (Strings ohne ihre abschließende
Null, DWORDs Big-Endian), `s` und der aktuelle Schlüssel. Auflistungen geben
jede Antwort zurück, jeweils mit ihrer 32-Bit-Größe davor. Namen und Strings
nutzen die ANSI-Codepage, wie beim Treiber von OTP.

## Nicht bereitgestellt

Linked-in-Treiber und NIFs, `erlang:open_port({spawn_driver, Name})` für
OTP-Treibernamen, Distributions-Ports, `port_call/3` auf den bereitgestellten
Treibern außer dem eigenen Protokoll der Bibliothek, ausgelastete Socket-Ports
sowie die Optionen `overlapped_io`, `parallelism` und `busy_limits_msgq`.
