---
source: docs/processes.md
sourceCommit: 06042fa
sourceSha256: 9add4b7c491f5fe2b819ab08fada089a098afd08cd71b803a8c87cab16f57892
translatedAt: 2026-10-09
---
# Prozesse

Plan 11, step 43 (2026-10-08): gestartete Prozesse auf einem kooperativen
Executor; step 44: Exit-Gründe und Fehlerberichte; step 45: Senden von
Nachrichten; step 46: selektives Empfangen; step 47: Empfangs-Timeouts;
step 48: Links und Exit-Signale; step 49: Monitore; step 50: registrierte
Namen; step 53: Ports (keine); step 56: Scheduler-Worker; step 57:
Aufwecken über Worker hinweg und Herunterfahren.

## Executor

Eine Runtime führt ihre Prozesse auf ihren Scheduler-Workern aus
([Worker](#workers), [Ausführungsmodell](execution-model.md)). Beim Start wird
der Aufruf der Einstiegsfunktion zum ersten Prozess, dem Hauptprozess, und
der Executor läuft, bis dieser endet:

- Lauffähige Prozesse warten in einer einzigen First-in-first-out-Warteschlange.
  Ein Worker führt den ersten für eine Zeitscheibe von 4.000 Reduktionen aus
  (`CONTEXT_REDS` von OTP) und stellt ihn dann wieder ans Ende der
  Warteschlange, sofern er nicht geendet hat.
- Jeder Funktionseintritt verbraucht eine Reduktion: Aufrufe, Endaufrufe,
  fun- und dynamische Aufrufe sowie Builtins. Ist keine mehr übrig, findet der
  Eintritt nicht statt: Der Prozess merkt sich die Funktion, die er gerade
  betreten wollte, behält ihre Argumente in seinen Registern (sie bleiben
  Wurzeln der Speicherbereinigung) und kehrt zum Executor zurück, der ihn
  später fortsetzt, indem er den Eintritt wiederholt. Eine Schleife, die keinen
  Aufruf macht (eine comprehension über eine Liste ohne Aufrufe in ihrem
  Rumpf), läuft bis zu ihrem Ende, bevor der Prozess abgeben kann. Builtins,
  deren Arbeit mit einem Listen- oder binary-Argument wächst, laufen in
  Portionen und geben zwischen ihnen ab ([Portionen](builtins.md#portions)).
- Jeder Prozess besitzt seinen Heap und Stack. Argumente eines neuen Prozesses
  werden in seinen Heap kopiert
  ([Kopieren zwischen Heaps](runtime-heap.md#copying-between-heaps)).
- Ein Prozess endet, wenn sein erster Aufruf zurückkehrt oder eine Ausnahme
  auslöst. Kontext, Heap und Stack eines beendeten Prozesses werden sofort
  freigegeben; seine Pid bleibt ein gültiger Term, und `is_process_alive/1`
  gibt für sie false zurück.
- Ein Prozess, der in einem `receive` wartet, ist nicht in der Warteschlange;
  eine Sendung an ihn stellt ihn wieder ans Ende ([Receive](#receive)).
- Endet der Hauptprozess, endet das Programm mit seinem Ergebnis
  ([ausführbare Dateien](executables.md)): Noch eingereihte oder wartende
  Prozesse werden freigegeben, ohne weiterzulaufen, so wie ein OTP-escript
  anhält, wenn `main/1` zurückkehrt.
- Ein Exit-Signal, das den Hauptprozess beendet, beendet das Programm
  ([Exit-Signale](#exit-signals)).
- `erlang:halt/0,1` in einem beliebigen Prozess beendet das Programm mit
  dessen Status. Ein Runtime-Fehler in einem beliebigen Prozess (Speicher
  erschöpft, eine optionale Obergrenze überschritten, ein interner Fehler)
  beendet das Programm als Runtime-Fehler (Exit 70). Eine Erlang-Ausnahme
  beendet nur den Prozess, der sie ausgelöst hat ([Exits](#exits)).
- Host-Aufrufe exportierter Funktionen (`CLAUSE_invoke_v1`) führen ihre
  Funktion im aufrufenden Kontext bis zum Ende aus und setzen sie nach jeder
  Abgabe fort, ohne andere Prozesse laufen zu lassen; durch `CLAUSE_main_v1`
  gestartete Programme nutzen den Executor.

## Worker

Plan-Step 56 (2026-10-08). Der Executor führt Prozesse auf
`RuntimeOptions::schedulers` Worker-Threads aus: dem Thread, der das Programm
gestartet hat, und je einem weiteren Thread pro zusätzlichem Worker. Programme
übernehmen die Anzahl aus `--schedulers N` (1 bis 1.024,
[Runtime-Optionen](executables.md#runtime-options)); Standard ist ein Worker
pro logischem Prozessor, wie bei `+S` von OTP.

- Jeder Worker nimmt den ersten Prozess aus der einen gemeinsamen
  Warteschlange (die dokumentierte Alternative zu Warteschlangen pro Worker mit
  Work-Stealing: Eine Warteschlange bewahrt die First-in-first-out-Reihenfolge
  von OTP und braucht kein Stealing). Untätige Worker schlafen, bis ein Prozess
  eingereiht wird oder der früheste Empfangs-Timeout abläuft.
- Ein Executor-Mutex schützt die Warteschlange, die wartenden Prozesse, die
  Timer, die registrierten Namen, die Links und Monitore jedes Prozesses und
  jeden Prozess, der nicht läuft. Heap, Stack, Mailbox und Fehlerkanal eines
  laufenden Prozesses gehören allein seinem Worker; Erlang-Code läuft ohne die
  Sperre.
- Links, Monitore und Namen ändern sich sofort unter der Sperre, auch für einen
  Prozess, der anderswo läuft. Eine Sendung oder ein Exit-Signal von `exit/2`
  oder `exit_signal/2` an einen Prozess, der auf einem anderen Worker läuft,
  kann dessen Heap nicht berühren: Das Builtin tut nichts, und sein Prozess
  beendet seine Zeitscheibe (`builtins::Blocked`); er wartet, bis die
  Zeitscheibe des Ziels endet, läuft dann als Erster und wiederholt das Builtin
  mit denselben Argumenten. Das Ziel wird bis dahin festgehalten, sodass das
  wiederholte Builtin es nicht erneut laufend vorfinden kann. Ein Prozess, der
  mit Links oder Monitoren endet, deren Prozesse anderswo laufen, wird ebenso
  abgeschlossen, sobald deren Zeitscheiben enden.
- Nachrichten und Exit-Signale wirken also weiterhin, wenn sie gesendet werden:
  Eine Sendung kehrt zurück, nachdem die Nachricht in der Mailbox des
  Empfängers ist, und `is_process_alive/1` nach `exit(Pid, kill)` ist false,
  wie OTP es für Signale vom Aufrufer zusagt.
- Ein Spawn verlinkt oder überwacht den neuen Prozess (`spawn_link`,
  `spawn_monitor`), bevor irgendein Worker ihn ausführen kann. Ein gestarteter
  Prozess kann laufen, bevor sein Elternprozess weitermacht, daher kann ein
  Programm, das nach `spawn/1` einen kurzlebigen Prozess überwacht oder sich
  mit ihm verlinkt, `noproc` sehen, wie in einem OTP mit mehreren Schedulern.
- Das Ende des Hauptprozesses, ein Halt oder ein Runtime-Fehler stoppt das
  Programm, sobald jeder Worker seine aktuelle Zeitscheibe beendet hat; dann
  werden die anderen Prozesse freigegeben.
- Gemeinsame Runtime-Dienste sind synchronisiert ([Threads](runtime.md#threads)):
  Atome, der Code-Server, Pid-Nummern und das Speicherkonto.
- Die Ausgaben verschiedener Prozesse verschränken sich in der Reihenfolge, in
  der ihre Schreibvorgänge geschehen. Jeder Aufruf von `io:format` und
  `erlang:display` schreibt seinen Text sofort.

Aufwecken und Herunterfahren (Plan-Step 57) brauchen keinen weiteren
Mechanismus, weil jede Änderung am Scheduling-Zustand eines Prozesses unter dem
Executor-Mutex geschieht:

- Eine Nachricht, `'EXIT'` oder `'DOWN'` für einen wartenden Prozess reiht ihn
  im selben kritischen Abschnitt ein, der sie zustellt, und weckt einen
  untätigen Worker. Ein Prozess, der sich noch in der Zeitscheibe befindet, in
  der er zu warten begann, kann dann keine Nachricht erhalten (seine Sender
  warten auf das Ende der Zeitscheibe), daher findet die Zustellung ihn immer
  geparkt vor.
- Ein Worker, der keinen lauffähigen Prozess findet, schläft, bis ein anderer
  Worker einen einreiht, bis zum frühesten Empfangs-Timeout oder bis zum Ende
  des Programms; das Parken eines Prozesses mit Timeout weckt jeden untätigen
  Worker, damit sie auf die neue Frist warten. Beschäftigte Worker prüfen die
  Timer vor jeder Zeitscheibe.
- Eine Nachricht und ein ablaufender Timeout desselben receive können
  konkurrieren: Was zuerst kommt, reiht den Prozess ein und hebt das andere
  auf, und das receive nimmt eine Nachricht, die vor seiner Fortsetzung
  angekommen ist, wie bei OTP.
- Ein Exit-Signal an einen wartenden, eingereihten, festgehaltenen oder
  blockierten Prozess holt ihn aus seinem jeweiligen Zustand, bevor er
  abgeschlossen wird.
- Endet das Programm, beendet jeder Worker seine aktuelle Zeitscheibe und
  stoppt; `run()` kehrt zurück, nachdem es sie gejoint hat, und jeder andere vom
  Executor gestartete Prozess wird freigegeben, sodass die Runtime ohne
  verbleibenden Kontext herunterfährt.
- Das OTP-Golden `executables_wakeups` testet dies unter Last mit 1, 2, 4 und
  allen Workern: Empfänger, deren Timeouts von 0–2 ms mit den Nachrichten ihrer
  Sender konkurrieren, eine Kette von 16 verlinkten, rotierenden Prozessen, die
  ein einziges Exit-Signal beendet, wobei jedes Glied überwacht wird,
  überwachte Prozesse, die enden, während ihr Beobachter aufwacht, ein
  Programm, das endet, während Prozesse rotieren, warten und einander fluten,
  und ein Halt in einem anderen Prozess.

## Exits

Ein Prozess außer dem Hauptprozess endet mit einem Exit-Grund, wie in OTP
(`detail::exit_reason`, `process/exits`). Exit-Signale tragen ihn zu
verlinkten Prozessen ([Links](#links)) und `'DOWN'`-Nachrichten zu
überwachenden ([Monitore](#monitors)); Fehlerberichte zeigen ihn.

| Wie der Prozess endet | Exit-Grund | Fehlerbericht |
| --- | --- | --- |
| Sein erster Aufruf kehrt zurück | `normal` | Keiner |
| `exit(Reason)` (auch `normal`, `kill`) | `Reason` | Keiner |
| Ein Fehler (`error/1,2,3`, `badarith`, `{badmatch, V}`, `undef`, ...) | `{Reason, Stack}` | Ja |
| Ein nicht abgefangenes `throw(Value)` | `{{nocatch, Value}, Stack}` | Ja |
| Ein Exit-Signal beendet ihn ([Exit-Signale](#exit-signals)) | Der Grund des Signals, `killed` für `exit(Pid, kill)` | Keiner |

Ein Fehlerbericht wird auf stderr geschrieben, wenn der Prozess endet, nach
dem Leeren der Standardausgabe, im Format des Standard-Logger-Handlers von
OTP:

```text
=ERROR REPORT==== 8-Oct-2026::03:42:15.983000 ===
Error in process <0.8.0> with exit value:
{boom,[{crash_reports,'-main/1-fun-6-',0,[]}]}

```

Der Kopf enthält die Ortszeit; der Grund wird so gesetzt, wie `~p` es tut. Der
Hauptprozess schreibt keinen: Seine nicht abgefangene Ausnahme ist die des
Programms ([ausführbare Dateien](executables.md)).

## Nachrichten

`Dest ! Msg` und `erlang:send(Dest, Msg)` (Plan-Step 45) werten zuerst `Dest`
aus und geben `Msg` zurück.

| `Dest` | Wirkung |
| --- | --- |
| Eine Pid eines lebenden Prozesses | `Msg` wird in den Heap des Empfängers kopiert ([Kopieren zwischen Heaps](runtime-heap.md#copying-between-heaps)), unter Erhalt seiner gemeinsamen Teile, und an seinen Signal-Eingang angehängt |
| Eine Pid eines beendeten Prozesses | Nichts; die Sendung gelingt |
| Ein [registrierter Name](#registered-names) | Wie für seine Pid; `badarg`, wenn kein lebender Prozess den Namen hat |
| `{Name, nonode@nohost}` aus zwei Atomen | Wie für die als `Name` registrierte Pid; nichts, wenn es keine gibt |
| `{Name, Node}` für jeden anderen Knoten | Nichts (es gibt keine anderen Knoten) |
| Alles andere | `badarg` |

- Nachrichten eines Senders kommen in der Reihenfolge an, in der er sie
  gesendet hat; eine Sendung an sich selbst ist eine Nachricht wie jede andere.
- Jede Nachricht ist eine Wurzel der Speicherbereinigung ihres Empfängers, bis
  ein receive sie nimmt
  ([Runtime-Heap](runtime-heap.md#roots-and-safe-points)).
- Die Mailbox des Empfängers (`Mailbox`) führt einen Signal-Eingang, an den
  Sendungen anhängen, und eine Nachrichtenwarteschlange, die receive ab einer
  gespeicherten Position durchsucht: Angekommene Nachrichten wandern hinter die
  Warteschlange, wenn ein receive sie untersucht.
- Verweigert der Heap des Empfängers die Kopie (eine optionale Obergrenze wie
  `--max-heap` oder kein Speicher mehr im Host), wird nichts zugestellt, und
  der sendende Prozess scheitert als Runtime-Fehler (Exit 70), wie jeder
  Prozess, der eine Obergrenze überschreitet.

## Receive

`receive` (Plan-Steps 46–47) wählt wie `case` unter seinen Klauseln aus,
über die Nachrichten der Mailbox:

- Die Suche in der Mailbox beginnt bei der ältesten Nachricht. Jede Nachricht
  wird der Reihe nach gegen die Klauseln gematcht (Muster und guards, die
  Bindungen von vor dem `receive` lesen dürfen); die erste Nachricht, die
  irgendeine Klausel matcht, wird entfernt, und der Rumpf dieser Klausel läuft.
  Nachrichten, die keine Klausel matcht, bleiben in ihrer Reihenfolge in der
  Mailbox; das nächste receive beginnt wieder bei der ältesten Nachricht.
- Wurde jede Nachricht untersucht, wartet der Prozess
  (`CLAUSE_wait_frame_v1`, ein Builtin, das wie ein Aufruf betreten wird): Er
  verlässt die Run-Queue, bis eine Sendung ihm eine Nachricht zustellt, dann
  geht die Suche mit den angekommenen Nachrichten weiter. Wartende Prozesse
  behalten ihre Frames und Nachrichten als Wurzeln der Speicherbereinigung und
  bereinigen bei der Fortsetzung
  ([wartende Prozesse](runtime-heap.md#waiting-and-suspended-processes)).
- Namen, die in jeder Klausel gebunden werden, und im `after`-Rumpf, falls es
  einen gibt, werden nach dem `receive` exportiert, wie bei `case`; ein Aufruf
  in Endposition eines Klausel- oder `after`-Rumpfs ist ein Endaufruf, sodass
  eine Server-Schleife mit konstantem Stack läuft.
- `after T -> Body`: `T` wird zuerst ausgewertet, vor der Suche. Würde das
  receive warten, muss `T` `infinity` oder eine Ganzzahl in 0..4294967295
  (Millisekunden) sein, sonst `error:timeout_value`; eine Nachricht, die sofort
  matcht, prüft ihn nie, wie in OTP. `after 0` führt `Body` aus, sobald jede
  Nachricht untersucht wurde. Ein endlicher Timeout beginnt, wenn das receive
  zum ersten Mal wartet, und wird durch Nachrichten, die keine Klausel matchen,
  nicht neu gestartet; läuft er ab, läuft `Body` mit den Bindungen von vor dem
  receive, und das nächste receive sucht ab der ältesten Nachricht. Eine
  Nachricht, die vor Ablauf des Timeouts ankommt, wird genommen. Ein receive
  nur mit `after` ist ein Schlafen (das Idiom von `timer:sleep/1`).
- Erzeugter Code: Ein Schleifenkopf schaut auf die nächste nicht untersuchte
  Nachricht (`CLAUSE_receive_v1` `peek`, in einen Wurzel-Slot), die
  Klauselauswahl nimmt eine gematchte Nachricht (`take`) vor ihrem Rumpf oder
  überspringt eine nicht gematchte (`skip`) und läuft weiter; ist keine
  Nachricht mehr übrig, betritt die Schleife das Warten mit dem Timeout, das
  `true` (erneut suchen) oder `false` (Timeout abgelaufen: `restart`, dann der
  `after`-Rumpf) antwortet.
- Der Executor führt einen Timer pro wartendem Prozess mit endlichem Timeout:
  Ein abgelaufener stellt den Prozess zurück in die Warteschlange, und wenn
  kein Prozess laufen kann, schläft der Executor bis zum frühesten Timer.
  Timeouts werden auf einer monotonen Uhr in Millisekunden gemessen und lösen
  nie zu früh aus.
- Wartet jeder Prozess ohne Timeout auf eine Nachricht, die nichts senden kann,
  wartet das Programm ewig, wie bei OTP. Ein Host-Aufruf (`CLAUSE_invoke_v1`),
  der warten würde, scheitert stattdessen mit `busy`: Während ihm läuft kein
  anderer Prozess.

## Links

Plan-Step 48. Ein Link verbindet zwei Prozesse in beide Richtungen (`Signals`
in jedem Kontext: die verlinkten Pids in Link-Reihenfolge und das Flag
`trap_exit`).

- `link(Pid)` verlinkt den Aufrufer mit einem lebenden Prozess und gibt `true`
  zurück; ein Link mit sich selbst oder ein erneuter Link tut nichts. Für einen
  beendeten Prozess löst es `error:noproc` aus oder gibt, wenn der Aufrufer
  Exits abfängt, `true` zurück und sendet dem Aufrufer
  `{'EXIT', Pid, noproc}`, wie es das lokale `link/1` von OTP tut.
- `unlink(Pid)` entfernt den Link auf beiden Seiten; der Link hat nach der
  Rückkehr keine Wirkung mehr. Auch `true`, wenn es keinen Link gab.
- `spawn_link/1,3` verlinken den neuen Prozess mit dem Aufrufer, bevor er
  läuft.
- Endet ein Prozess, erhält jeder verlinkte Prozess ein Exit-Signal mit seinem
  Exit-Grund ([Exits](#exits)), und der Link ist weg. Verlinkte Prozesse werden
  in der Reihenfolge signalisiert, in der die Links entstanden.

## Monitore

Plan-Step 49. Ein Monitor ist einseitig: Der überwachende Prozess hält ihn
(per Referenz, in `Signals`), und der überwachte Prozess bewahrt die Referenz
und die überwachende Pid, damit er die Nachricht senden kann, wenn er endet.

- `monitor(process, Pid)` gibt eine neue Referenz zurück. Endet der Prozess,
  erhält der Aufrufer `{'DOWN', Ref, process, Pid, Reason}` mit dessen
  Exit-Grund ([Exits](#exits)); für einen bereits beendeten Prozess erhält er
  die Nachricht sofort mit Grund `noproc`. Sich selbst zu überwachen erzeugt
  nichts. Jeder Aufruf erzeugt einen eigenen Monitor mit eigener Nachricht; die
  Nachrichten eines Prozesses gehen in der Reihenfolge hinaus, in der die
  Monitore entstanden.
- `demonitor(Ref)` stoppt den Monitor: Danach kommt kein `'DOWN'` von ihm an.
  Es gibt `true` zurück, auch für eine Referenz, die kein aktiver Monitor des
  Aufrufers ist.
- `demonitor(Ref, Options)`: `info` gibt zurück, ob der Monitor noch aktiv war;
  `flush` entfernt die älteste Nachricht `{_, Ref, _, _, _}`, wenn er es nicht
  war (sein `'DOWN'` ist schon in der Mailbox), wie OTP es tut.
- `spawn_monitor/1,3` geben `{Pid, Ref}` zurück, den Monitor, der vor dem
  Lauf des neuen Prozesses erzeugt wurde.
- Ein Prozess, der endet, verwirft die Monitore, die er hält.
- `monitor(process, Name)` und `monitor(process, {Name, nonode@nohost})`
  überwachen den als `Name` registrierten Prozess (sofort `noproc`, wenn es
  keinen gibt); sein `'DOWN'` nennt `{Name, nonode@nohost}` statt der Pid.
  `{Name, Node}` für einen anderen Knoten ist `badarg`.
- `monitor(port, Port | Name)` überwacht einen Port ([Ports](ports.md#port-table-and-ownership)):
  `{'DOWN', Ref, port, Port, Reason}`, wenn er sich schließt. Eine Pid für
  `port` oder ein Port für `process` ist `badarg`.

## Registrierte Namen

Plan-Step 50. Der Executor führt eine Tabelle von Namen (Atomen) zu Pids, und
jeder Prozess seinen eigenen Namen (`Signals::name`).

- `register(Name, Pid)` benennt einen lebenden Prozess: `badarg` für
  `undefined`, einen vergebenen Namen, einen Prozess, der schon einen Namen
  hat, einen beendeten Prozess oder ein `Pid`, das keine Pid ist. Ein Prozess
  darf sich selbst registrieren.
- `unregister(Name)` gibt den Namen frei (`badarg`, wenn kein Prozess ihn hat);
  `whereis(Name)` ist die Pid oder `undefined`; `registered()` listet die Namen
  in Reihenfolge der Atomtabelle (die Reihenfolge von OTP ist ebenfalls
  unspezifiziert).
- Der Name eines Prozesses wird freigegeben, wenn er endet, bevor seine Links
  und Monitore signalisiert werden, sodass ein Empfänger von `'DOWN'` oder
  `'EXIT'` den Namen erneut registrieren kann, wie in OTP.

## Exit-Signale

Jedes Exit-Signal kommt von einem laufenden Prozess (`exit/2`,
`exit_signal/2`, `link/1`) oder vom Ende eines Prozesses. Der Executor
verarbeitet es sofort, wenn sein Ziel nicht auf einem anderen Worker läuft,
sonst sobald die Zeitscheibe des Ziels geendet hat ([Worker](#workers),
`scheduler/signals`): Ein beendetes Ziel verlässt die Run-Queue oder sein
Warten und wird abgeschlossen (seine Links signalisiert, sein Fehlerbericht
geschrieben, sein Kontext freigegeben), bevor das sendende Builtin zurückkehrt.
Eine lange verlinkte Kette endet Prozess für Prozess ohne Rekursion.

| Signal an einem Prozess | Fängt Exits nicht ab | Fängt Exits ab |
| --- | --- | --- |
| `exit(Pid, kill)`, `exit_signal(Pid, kill)` | Endet mit Grund `killed` | Endet mit Grund `killed` |
| Grund `normal` (von einem Link oder an einen anderen Prozess gesendet) | Nichts | Nachricht `{'EXIT', From, normal}` |
| `exit(self(), normal)` | Endet mit Grund `normal` (Eigenheit von OTP) | Nachricht `{'EXIT', Self, normal}` |
| `exit_signal(self(), normal)` | Nichts | Nachricht `{'EXIT', Self, normal}` |
| Jeder andere Grund, einschließlich `kill` von einem Link | Endet mit diesem Grund | Nachricht `{'EXIT', From, Reason}` |

- `process_flag(trap_exit, Bool)` setzt das Abfangen und gibt die vorherige
  Einstellung zurück (anfangs `false`).
- Ein Prozess, der durch ein Signal endet, das er sich selbst gesendet hat
  (`exit(self(), kill)`), wickelt sich an jedem `catch`, jedem `try`-Handler und
  jedem `after`-Rumpf vorbei ab: Das Signal ist keine Ausnahme
  (`CallError::exited` im Fehlerkanal).
- `exit/2` und `exit_signal/2` geben `true` zurück; an einen beendeten Prozess
  tun sie nichts. Ein Referenz-Ziel tut ebenfalls nichts (es gibt keine
  Prozess-Aliase).
- Ein Exit-Signal, das den Hauptprozess beendet, beendet das Programm wie ein
  nicht abgefangenes `exit` ([Exit-Status](executables.md#exit-status)): Grund
  `normal` endet mit 0.
- Verweigert der Heap des Empfängers einen Exit-Grund oder eine
  `'EXIT'`-Nachricht, scheitert der Empfänger als Runtime-Fehler (Exit 70).

## Ports

Ports (Plan-Steps 57A–57F) sind in [Ports](ports.md) spezifiziert: Ein Port
ist mit seinem Öffner verlinkt, nimmt wie ein Prozess an Links, Monitoren,
Exit-Signalen und registrierten Namen teil und spricht mit seinem verbundenen
Prozess über Nachrichten. Step 57B stellt Identitäten, die Port-Tabelle, die
Port-Builtins und reine Ausgabe-Ports `{fd, In, Out}` bereit.

## Builtins

| Builtin | Verhalten |
| --- | --- |
| `spawn(Fun)` | `badarg`, außer `Fun` ist ein fun; sonst ruft ein neuer Prozess `Fun()` auf und löst in diesem Prozess bei anderer Stelligkeit `{badarity, {Fun, []}}` aus |
| `spawn(M, F, Args)` | `badarg`, außer `M` und `F` sind Atome und `Args` eine echte Liste; sonst ruft ein neuer Prozess `M:F(Args...)` auf und löst in diesem Prozess `undef` aus, wenn kein Modul sie exportiert und kein Builtin diesen Namen hat |
| `spawn_link(Fun)`, `spawn_link(M, F, Args)` | Wie `spawn`, und der neue Prozess wird mit dem Aufrufer verlinkt ([Links](#links)) |
| `is_process_alive(Pid)` | `badarg`, außer `Pid` ist eine Pid; wahr, solange ihr Prozess nicht geendet hat |
| `spawn_monitor(Fun)`, `spawn_monitor(M, F, Args)` | Wie `spawn`, gibt `{Pid, Ref}` eines neuen [Monitors](#monitors) zurück |
| `link(Pid)`, `unlink(Pid)` | `badarg`, außer `Pid` ist eine Pid ([Links](#links)) |
| `monitor(process, Item)` | `badarg` für einen anderen Typ oder ein anderes Element; eine Referenz ([Monitore](#monitors)); `Item` ist eine Pid oder ein registrierter Name |
| `register(Name, Pid)`, `unregister(Name)`, `whereis(Name)`, `registered()` | Siehe [registrierte Namen](#registered-names); `Name` muss ein Atom sein |
| `demonitor(Ref)`, `demonitor(Ref, Options)` | `badarg`, außer `Ref` ist eine Referenz und `Options` eine echte Liste aus `flush` und `info` |
| `exit(Dest, Reason)`, `exit_signal(Dest, Reason)` | `badarg`, außer `Dest` ist eine Pid oder Referenz; `true` nach dem [Exit-Signal](#exit-signals) |
| `process_flag(trap_exit, Bool)` | Die vorherige Einstellung; `badarg` für ein anderes Flag oder einen Nicht-Boolean |
| `erlang:send(Dest, Msg)`, `Dest ! Msg` | `Msg`, nach dem Senden ([Nachrichten](#messages)); `send/2` wird nicht automatisch importiert |

Der neue Prozess wird hinter jedem lauffähigen Prozess eingereiht; `spawn` gibt
seine Pid sofort zurück.
