---
source: docs/execution-model.md
sourceCommit: 6ed3851c
sourceSha256: 662633c074adf6d3159dce2c7df1099c01e46ae9c66d8589bca3e6a13daca6a2
translatedAt: 2026-10-15
---
# Ausführungsmodell: Frames und Fortsetzungen

Sie legt fest, wie erzeugte
Erlang-Funktionen aufrufen, zurückkehren, sich unterbrechen und scheitern,
sobald Rekursion, Endaufrufe und Prozesse hinzukommen. Step 19 hat Aufrufe,
Rückkehr, Endaufrufe und Frames umgesetzt ([Implementierung](#implementation)
listet, was noch offen ist); die Steps 23, 24, 26 und 43 bauen darauf auf.

## Entscheidung

Jeder Erlang-Prozess läuft auf seinem eigenen **flachen Stack expliziter
Frames**, und erzeugter Code wechselt zwischen Funktionen nur durch
**garantierte Endübergaben** (LLVM `musttail`). Ein Nicht-Endaufruf speichert
die Fortsetzung (continuation) des Aufrufers in dessen Frame und springt zum
Aufgerufenen; eine Rückkehr springt zu dieser Fortsetzung zurück. Der native
Stack bleibt daher einen Aufruf tief über dem Scheduler, unabhängig von der
Erlang-Rekursionstiefe, und ein Prozess kann bei jeder Übergabe anhalten und
später auf einem beliebigen Thread fortfahren.

- Ein flacher Stack pro Prozess ersetzt den segmentierten Wurzel-Stack aus 8F.
  Er hält Frame-Header und Slots, wächst durch Verschieben und wird als Basis
  plus Offset adressiert.
- Jede Funktion, die einen Frame braucht, wird zu einem **Eintritt** (entry)
  und einem **Rumpf** (body) abgesenkt. Der Rumpf beginnt mit einem `switch`
  über den Fortsetzungsindex des Frames, sodass eine LLVM-Funktion alle Blöcke,
  Zusammenführungen und Handler der Funktion behält.
- Argumente und Ergebnisse reisen in Prozessregistern `x[0..n)` (BEAM-X-Register);
  jeder Code-Zeiger hat die einzige Signatur `void code(Process *)`.
- Ausnahmen wickeln Frames bis zum innersten Frame ab, dessen Header eine
  Handler-Fortsetzung nennt.

## Prozesszustand

| Feld | Bedeutung |
| --- | --- |
| `stack`, `capacity` | Ein wachsendes Wort-Array; wird beim Wachsen verschoben |
| `frame`, `top` | Wort-Offsets des aktuellen Frame-Headers und des ersten freien Worts |
| `x[]`, `live` | Argument-/Ergebnisregister; die ersten `live` Wörter sind bei einer Übergabe Wurzeln |
| `reductions` | Verbleibende Aufrufe in der Zeitscheibe |
| `resume_at` | Eintritt, an dem ein unterbrochener Prozess fortfährt |
| Fehlerkanal | Der heutige Kanal der Revision 2: Grund, Nutzlast, Stacktrace, `halted` |

## Frames

Ein Frame ist ein fester Header, gefolgt von den Slots der Funktion
(BEAM-Y-Register). Slots werden beim Push auf null gesetzt, wie heute
Wurzel-Frames.

| Header-Wort | Bedeutung |
| --- | --- |
| `previous` | Offset des Headers des Aufrufers (Frames verketten sich über Offsets, nie über Zeiger) |
| `function` | Der Deskriptor der Funktion |
| `resume` | Fortsetzungsindex, über den der Rumpf verzweigt, wenn die Kontrolle hierher zurückkehrt |
| `handler` | Fortsetzungsindex des innersten aktiven Handlers, 0 wenn keiner |

Der Deskriptor erweitert das heutige `abi::v1::FrameDescriptor`
(Moduldeskriptor, Slots für Modul- und Funktionsatom, Stelligkeit) um die
Code-Zeiger für Eintritt und Rumpf sowie die Slot-Anzahl. Header-Wörter sind
keine Terme; ein Walker folgt `previous` und liest Slot-Anzahlen aus
Deskriptoren. Ein **Boden-Frame** (bottom frame) im Besitz der Runtime liegt
unter dem ersten Aufruf jedes Prozesses: Fortsetzung 1 ist ein normales Ende
(Ergebnis in `x[0]`), Fortsetzung 2 der Handler für eine nicht abgefangene
Ausnahme.

## Operationen

- **Aufruf (kein Endaufruf).** Lebende Werte liegen bereits in Slots (heutige
  Wurzelregel). Der Aufrufer setzt sein eigenes `resume` auf den nächsten
  Fortsetzungsindex, schreibt die Argumente nach `x[0..n)` und übergibt an den
  Eintritt des Aufgerufenen. Ein entfernter Aufruf übergibt an das exportierte
  Eintrittssymbol.
- **Eintritt.** Zählt eine Reduktion (siehe Abgabe), pusht einen genullten
  Frame (verschiebt den Stack, wenn er voll ist), kopiert `x[0..n)` in Slots,
  setzt `resume = 0` und übergibt an den Rumpf.
- **Rückkehr.** Der Aufgerufene schreibt das Ergebnis nach `x[0]`, poppt seinen
  Frame (`top = frame`, `frame = previous`) und übergibt an den Rumpf des
  Aufrufers, der über das `resume` des Aufrufers verzweigt.
- **Endaufruf.** Argumente gehen nach `x[0..n)`, der Aufrufer poppt seinen
  eigenen Frame ohne Übergabe und übergibt dann an den Eintritt des
  Aufgerufenen. Der Aufrufer des Aufrufers bleibt das Rückkehrziel, sodass
  Endrekursion mit konstantem Erlang- und nativem Stack läuft. Lokale,
  wechselseitige und entfernte Endaufrufe sind derselbe Sprung.
- **Abgabe (yield).** Jeder Eintritt verbraucht eine Reduktion. Bei null
  vermerkt er sich in `resume_at` und kehrt zum Scheduler zurück, statt einen
  Frame zu pushen; die Argumente bleiben in `x[0..arity)`, die dann die einzigen
  zu wurzelnden Register des Prozesses sind. Das Fortsetzen füllt das Budget
  auf und übergibt an `resume_at`, was den Eintritt wiederholt. Spätere
  Wartevorgänge (`receive`) speichern statt eines Eintritts einen
  Fortsetzungsindex des Rumpfs.
- **Ende.** Die Rückkehr in den Boden-Frame vermerkt ein normales Ende; das
  Abwickeln in ihn vermerkt eine nicht abgefangene Ausnahme. In beiden Fällen
  kehrt der Code zum Scheduler zurück.
- **Ausnahmeweitergabe.** Ein Raise oder eine fehlgeschlagene Dienstprüfung
  vermerkt den Fehler wie heute im Kanal und nennt für den Trace die innersten
  8 Frames aus der Frame-Kette. Der Abwickler poppt dann Frames, deren
  `handler` 0 ist, setzt `resume = handler` im ersten Frame, der einen hat, und
  übergibt an dessen Rumpf. Handler von `catch`, `try` und `after` sind
  Fortsetzungsindizes; das Betreten eines geschützten Bereichs setzt `handler`,
  und das Verlassen stellt den umgebenden Index wieder her, beides statisch
  innerhalb einer Funktion bekannt. Halts und Infrastrukturfehler überspringen
  jeden Handler und wickeln direkt bis zum Boden-Frame ab, so wie sie heute
  Handler überspringen. Der Handler nimmt die Ausnahme mit den heutigen
  Diensten (`CLAUSE_catch_v1`, `CLAUSE_exception_v2`) entgegen und löst sie
  über den Abwickler erneut aus.
- **Host-Aufruf.** Die Runtime pusht einen Boden-Frame, lädt `x[]` und führt
  die Scheduler-Schleife aus, bis dieser Frame erreicht ist. Runtime-Dienste
  bleiben gewöhnliche native Aufrufe und betreten erzeugten Code nie erneut;
  nur diese Host-Schleife startet ihn.

Eine Funktion, die keinen Nicht-Endaufruf macht und keinen Slot über einen
Safepoint hinweg behält, darf ihren Frame auslassen und direkt zum Rumpf ihres
Aufrufers zurückkehren. Das ist eine Optimierung, die der Compiler später
hinzufügen kann, kein Teil des Vertrags.

## Sichtbarkeit der Wurzeln

Bei jeder Übergabe und jedem Safepoint sind die Wurzeln eines Prozesses: alle
Slots aller Frames auf seinem Stack, `x[0..live)` sowie Nutzlast,
Argumentliste und Stack-Term des Fehlerkanals (bereits Prozesswurzeln). Die
Wörter zur Ergebnisübergabe des heutigen Wurzel-Stacks entfallen; `x[0]`
übernimmt ihre Rolle.

Werte überleben eine Übergabe nie in nativen Registern oder SSA-Werten. Jeder
Rumpf lädt seine Frame-Adresse nach dem Betreten neu aus `stack + frame` und
liest lebende Werte aus Slots. Innerhalb einer Fortsetzung macht ein Dienst,
der einen Frame pushen oder den Heap verschieben kann, jeden in SSA-Werten
gehaltenen Slot-Zeiger und Heap-Zeiger ungültig; die Neulade-Regel für
Speicherbereinigungen ist in
[Speicherbereinigung in erzeugtem Code](runtime-heap.md#collection-in-generated-code)
festgelegt.

## Nachfolger des Wurzel-Stacks aus 8F

Der segmentierte Stack existiert nur, weil erzeugter Code absolute
Frame-Zeiger über Aufrufe hinweg hält. In diesem Modell überlebt kein
Frame-Zeiger eine Übergabe, daher wird der Stack zu einem flachen Block pro
Prozess:

- Frame-Header liegen im Stack, Slots werden als
  `stack + frame + header + index` adressiert;
- der Block wächst durch Verdoppeln und Verschieben (`realloc`), schrumpft
  während der Laufzeit nie und ist vom Heap-Block getrennt;
- die Grenze von 4.096 Frames entfällt; Stack-Wörter zählen zum
  Speicherbudget des Prozesses, und dessen Überschreiten ist der dokumentierte
  Fehler aus step 20.

## Zielplattformen

`musttail` mit der einheitlichen Signatur `void (Process *)` wird von jeder
erforderlichen Zielplattform bei O0 und O2 akzeptiert (Prototyp unten,
clang 23.1.2):

| Ziel | Wort | Ergebnis |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | Endsprünge |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | Endsprünge |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | Endsprünge |
| `armv7-unknown-linux-gnueabihf` | 32 | Endsprünge |

Das Backend meldet einen Fehler, wenn es einen `musttail`-Aufruf nicht
einhalten kann, daher ist eine erfolgreiche Kompilierung die Garantie.
Rückfallebene für eine künftige Zielplattform, die ihn ablehnt: ein
**Trampolin**. Jeder Code gibt den nächsten Code-Zeiger an die
Scheduler-Schleife zurück, statt zu springen (null unterbricht); Frames,
Wurzeln und Fortsetzungsindizes bleiben unverändert. Keine erforderliche
Zielplattform braucht es.

## Implementierung

Step 19 (2026-10-05) setzt das Modell mit diesen Entscheidungen und Lücken
um:

- **Zwei Stufen.** Das Lowering erzeugt weiterhin die *native Form*:
  eine Funktion `TermWord(context, arguments)` pro Erlang-Funktion,
  gewöhnliche Aufrufe zwischen ihnen, einen Platzhalter-Aufruf `clause.frame`,
  der die Term-Slots nennt, und `ret` des Ergebnisses eines Aufrufs in
  Endposition. `lower_frames` (`compiler/src/codegen/frames.cpp`) verschiebt
  dann jeden Rumpf nach `<symbol>.body`, fügt den Prolog hinzu (Frame-Header,
  Register, Resume-Switch), teilt Blöcke nach Nicht-Endaufrufen und
  Safepoints an Schleifenköpfen, lagert danach benutzte Werte aus (Terme in
  Term-Slots, andere Wörter in Roh-Slots), zieht konstante Slot-Adressen in
  den Prolog hoch und verwandelt Aufrufe, Endaufrufe und Rückkehr in
  `musttail`-Übergaben. Typspezialisierung und Test-Nahtstellen arbeiten auf
  der nativen Form; das Backend führt `lower_frames` vor der IR-Inspektion aus,
  und `optimize` führt es aus, falls noch nötig.
- **Eintritt und Rumpf.** Es gibt keine separate Eintrittsfunktion. Die
  obige Zustandstabelle des Prozesses ist `abi::v1::FrameState` am Anfang jedes
  Kontexts, sodass erzeugter Code inline übergibt (ABI-Revision 9): Ein
  Eintritt verbraucht eine Reduktion, pusht den genullten Frame, kopiert die
  Argumente aus den Registern und übergibt an den Rumpf des Aufgerufenen; ein
  Endeintritt verwendet zuerst den Platz des Aufrufers wieder; eine Rückkehr
  poppt und übergibt an den Rumpf des Aufrufers. Jeder Pfad weicht auf
  `CLAUSE_enter_v1`, `CLAUSE_tail_v1` oder `CLAUSE_return_v1` aus, wenn der
  Heap eine Speicherbereinigung will, der Prozess profiliert wird, keine
  Reduktion übrig ist, der Stack wachsen muss oder seine Grenze erreicht oder
  der Aufgerufene ein Builtin ist. Die Fehlerprüfung nach einem Aufruf liest
  das Wort `failed` des Zustands. Ein Endaufruf seiner selbst behält seinen
  Frame, wo er ist: Er verbraucht eine Reduktion, setzt die Fortsetzungs- und
  Handler-Wörter des Frames sowie die Anzahl lebendiger Werte zurück und
  kopiert die Argumente über die Register hinaus, ohne den Header neu zu
  schreiben oder die Slots zu nullen (jeder hält null oder ein Term-Wort, das
  Speicherbereinigungen umschreiben, und der Rumpf schreibt einen Slot, bevor
  er ihn liest).
- **Register-Parameter** (ABI-Revision 10). Code ist
  `void(void *, TermWord x0, TermWord x1, TermWord x2)`: Jede Übergabe reicht
  die ersten drei X-Register als C-Parameter weiter, sodass die führenden
  Argumente eines Aufrufs und das Ergebnis einer Rückkehr in
  Maschinenregistern bleiben. Ein Rumpf liest seine führenden Argumente zu
  Beginn aus den Parametern und das Aufrufergebnis beim Fortsetzen aus `x0`;
  `lower_frames` lagert beides nur dann in einen Slot aus, wenn es über einen
  Aufruf oder Safepoint hinweg lebendig ist. Die Dienstpfade speichern die
  Parameter vor dem Dienst in das Register-Array und laden sie danach neu. Da
  jeder Rumpf denselben Prototyp teilt, macht LLVM aus einem Endaufruf seiner
  selbst, dessen Inline-Push in denselben Rumpf zurückführt, eine Schleife.
- **Endpositionen** sind der letzte Ausdruck eines Klauselrumpfs, verfolgt
  durch Blöcke, Klammern sowie Klauselrümpfe von `case` und `if`. Aufrufe in
  Operanden von `catch`, `try`, `maybe` und `andalso`/`orelse` sind keine
  Endaufrufe.
- **Ausnahmen** kehren durch jeden Aufrufer zurück, der wie bisher nach dem
  Aufruf den Kanal prüft; Handler-Indizes und direktes Abwickeln bleiben eine
  Optimierung. Stacktraces lesen die Frame-Kette zum Zeitpunkt des Raise.
- **Schleifen.** Generatoren von comprehensions sind Schleifen innerhalb eines
  Rumpfs. Ihre Cursor und ihr Akkumulator liegen in Term-Slots, sodass kein
  SSA-Wert um eine Schleife herumgetragen wird und ein Fortsetzungspunkt darin
  nichts über die üblichen Auslagerungen hinaus braucht.
- **Abgaben** ([Prozesse](processes.md)). Jeder Eintritt, inline oder über
  `CLAUSE_enter_v1` und `CLAUSE_tail_v1`, verbraucht eine der Reduktionen des
  Prozesses; ist keine mehr übrig, übernehmen die Dienste: Sie vermerken die betretene Funktion
  (`ProcessStack::resume_`, das `resume_at` des Modells), behalten ihre
  Argumente als Register-Wurzeln und geben Code zurück, der die Zeitscheibe
  beendet, sodass sich der native Stack bis zum Executor abwickelt, der später
  den Eintritt wiederholt. Schleifenköpfe geben nicht ab. Der Collector zählt Frame-Term-Slots, die Register, die eine
  Unterbrechung lebendig hält (`ProcessStack::keep_registers`), und den
  Fehlerkanal auf ([Wurzeln](runtime-heap.md#roots-and-safe-points)).
  Funktionseintritte und Schleifenköpfe von comprehensions sind Safepoints, die
  bereinigen, wenn der Heap es verlangt
  ([Speicherbereinigung in erzeugtem Code](runtime-heap.md#collection-in-generated-code));
  Roh-Slots für Auslagerungen halten nie Terme.
- **Keine Obergrenze.** Der Stack wächst, bis der Host Speicher verweigert, was
  mit `out_of_memory` scheitert (Exit 70, [ausführbare Dateien](executables.md)),
  so wie ein OTP-Prozess wächst. Ein optionales `StackOptions::limit_words` pro
  Prozess (getrennt vom optionalen Heap-Budget) lässt einen Push darüber
  hinaus mit `resource_limit` scheitern. Frames belegen heute 4 Header-Wörter
  plus 1–40 Slots.
- **Host-Eintritt.** Ein exportiertes Symbol behält die native Signatur und
  führt seine Funktion über einem Boden-Frame der Runtime mit
  `CLAUSE_invoke_v1` aus; native Ausnahmen, die von Diensten geworfen werden,
  werden dort aufgefangen.

## Verglichene Alternativen

Prototyp in [tests/prototypes/execution_model](../tests/prototypes/execution_model/):
dieselben Erlang-Funktionen (`sum/1` Rumpfrekursion, `loop/2` Endrekursion,
`fail/1` löst `boom` in Tiefe N aus, `catcher/1` fängt es ab) auf drei Arten
von Hand abgesenkt. Host: Windows x64, clang 23.1.2; Zeiten sind Einzelläufe
bei O2. Ausführen mit `python tests/prototypes/execution_model/run.py`.

| | Explizite Frames + `musttail` (gewählt) | Native Aufrufe + Wurzel-Frames (heute) | LLVM-Coroutinen (C++20) |
| --- | --- | --- | --- |
| Rumpfrekursion mit Tiefe 1M | ok, 17 ms; 5 Wörter pro Frame; 17 Stack-Verschiebungen | 80 B nativer Stack pro Ebene: etwa 13.000 Ebenen in einem Thread mit 1 MiB | ok, 60 ms; eine Heap-Allokation von 64–80 B pro Aufruf |
| 10M Endaufrufe | ok, 5 ms; konstanter Stack | O0 wächst um 80 B pro Aufruf; O2 nur durch Glück mit Sibling-Calls | keine Endaufrufe: 1M Iterationen behalten 1M Frames |
| Abgabe / Fortsetzung | jeder Eintritt; zwei Prozesse verschränken sich | unmöglich ohne nativen Stack pro Prozess | symmetrische Übergabe (selbst `musttail`) |
| Nativer Stack bei Tiefe 1M | 136–144 B | wächst pro Ebene | 144–520 B |
| Für die GC sichtbare Wurzeln | Slots in bekannten Frames | Slots in bekannten Frames | Coroutinen-Frame-Layout von LLVM gewählt; Terme bräuchten eine zweite gewurzelte Kopie |
| Ausnahmen | Abwickeln bis zum Handler-Frame | Kanalprüfung pro Rückkehr | Kanalprüfung pro Rückkehr |

Die Trampolin-Variante des gewählten Modells besteht dieselben Läufe (20 ms
Rekursion, 16 ms für 10M Endaufrufe bei O2). Verworfen:

- **Native Aufrufe mit expliziten Wurzel-Frames.** Tiefe Rekursion braucht
  einen nativen Stack pro Prozess, bemessen für den tiefsten Aufruf;
  Unterbrechung braucht Stack-Wechsel pro Zielplattform; 32-Bit-Ziele können
  für viele Prozesse keine großen Stacks reservieren.
- **LLVM-Coroutinen.** Eine Allokation pro Aufruf, keine Endaufrufe,
  undurchsichtige Frames für den Collector, Coroutinen-Passes selbst bei O0,
  und die symmetrische Übergabe hängt ohnehin von `musttail` ab.
- **Eine LLVM-Funktion pro Fortsetzung** (klassisches CPS). Dieselben
  Übergaben, aber Zusammenführungen und Handler, die von mehreren Fortsetzungen
  aus erreicht werden, müssten in weitere Funktionen aufgeteilt werden; der
  Resume-Switch behält den heutigen Walker für eine einzige Funktion.

Akzeptierte Kosten: ein indirekter Sprung pro Rückkehr plus ein
Switch-Dispatch; über Aufrufe hinweg lebende Werte werden aus Slots neu geladen
(dort sind sie ohnehin gespeichert); Backtraces nativer Debugger zeigen nur die
aktuelle Funktion, während Erlang-Stacktraces aus der Frame-Kette stammen.

## Belege aus dem Prototyp

`run.py` baut das gewählte Modell (`musttail` und Trampolin), die native
Basislinie und das Coroutinen-Modell für den Host bei O0 und O2, führt sie aus
und kompiliert die von Hand abgesenkten Funktionen (`generated.cpp`,
freestanding) für jede obige Zielplattform bei O0 und O2, wobei es
`musttail`-Aufrufe in der IR und Endsprünge in der Assembly zählt. Ergebnis vom
2026-10-05: PASS. Für das gewählte Modell auf beiden Stufen: Rückkehr (42),
Rumpfrekursion mit Tiefe 1.000.000, 10.000.000 Endaufrufe, ein in Tiefe
100.000 ausgelöster Fehler, den ein Handler-Frame abfängt, derselbe Fehler
nicht abgefangen (Boden-Frame, Trace aus 8 `fail`-Frames) und zwei Prozesse,
die sich in Zeitscheiben zu 4.000 Reduktionen verschränken (1.002
Zeitscheiben). Alle 15 Übergabestellen sind bei O0 auf jeder Zielplattform
`musttail` (14 bei O2 nach Inlining).

Der Rumpf von `sum/1` für `i686-pc-windows-msvc` (O2-IR, Namen gekürzt). Die
IR für `x86_64-pc-windows-msvc` ist dieselbe mit `i64`-Wörtern und doppelten
Offsets.

```llvm
%2 = load ptr, ptr %0, align 4                      ; stack base
%3 = getelementptr inbounds nuw i8, ptr %0, i32 8
%4 = load i32, ptr %3, align 4                      ; current frame offset
%5 = getelementptr inbounds nuw [4 x i8], ptr %2, i32 %4
%6 = getelementptr inbounds nuw i8, ptr %5, i32 16  ; slot 0 (N)
%7 = getelementptr inbounds nuw i8, ptr %5, i32 8   ; header: resume index
%8 = load i32, ptr %7, align 4
%9 = icmp eq i32 %8, 0                              ; switch on resume
...
16:                                                 ; N > 0: call sum(N - 1)
  store i32 1, ptr %7, align 4                      ; resume = 1
  ...                                               ; x0 = N - 1
  %19 = tail call ptr @call(ptr %0, ptr @SUM)       ; push frame or park
  musttail call void %19(ptr nonnull %0)
  ret void
20:                                                 ; resume 1: x0 += N
  ...
  %24 = tail call ptr @leave(ptr %0)                ; pop, caller body
  musttail call void %24(ptr nonnull %0)
  ret void
```
