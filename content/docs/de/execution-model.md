---
source: docs/execution-model.md
sourceCommit: a8c3f8f6
sourceSha256: 20c13ce39d1763e6ec342e1ed9aaa741312fc2be68cb0e08dd005c77a126fc43
translatedAt: 2026-10-17
---
# Ausführungsmodell: Frames und Fortsetzungen

Wie erzeugte Erlang-Funktionen aufrufen, zurückkehren, sich unterbrechen und
scheitern. Das Modell wurde nach dem Prototypvergleich in
[verglichene Alternativen](#alternatives-compared) gewählt; die Seite des
erzeugten Codes in seiner ABI steht in
[Frames und Übergaben](abi.md#frames-and-transfers).

## Entscheidung

Jeder Erlang-Prozess läuft auf seinem eigenen **flachen Stack expliziter
Frames**, und erzeugter Code wechselt zwischen Funktionen nur durch
**garantierte Endübergaben** (LLVM `musttail`). Ein Nicht-Endaufruf speichert
die Fortsetzung (continuation) des Aufrufers in dessen Frame und springt zum
Aufgerufenen; eine Rückkehr springt zu dieser Fortsetzung zurück. Der native
Stack bleibt daher einen Aufruf tief über dem Scheduler, unabhängig von der
Erlang-Rekursionstiefe, und ein Prozess kann bei jeder Übergabe anhalten und
später auf einem beliebigen Thread fortfahren.

- Ein flacher Stack pro Prozess (`ProcessStack`, `process/stack`) hält
  Frame-Header und Slots, wächst durch Verschieben und wird als Basis plus
  Offset adressiert.
- Jede Funktion ist eine LLVM-Funktion, ihr **Rumpf** (body), der mit einem
  `switch` über den Fortsetzungsindex des Frames beginnt, sodass er alle
  Blöcke, Zusammenführungen und Handler der Funktion behält.
- Argumente und Ergebnisse reisen in Prozessregistern `x[]`
  (BEAM-X-Register). Jeder Code-Zeiger hat die einzige Signatur
  `abi::v1::Code`, `void(void *context, TermWord x0, ..., TermWord x5)`: Die
  ersten `abi::v1::register_arguments` (6) Register werden auch als Parameter
  übergeben, sodass die führenden Argumente eines Aufrufs und das Ergebnis
  einer Rückkehr in Maschinenregistern bleiben.
- Ein Fehlschlag kehrt durch jeden Aufrufer zurück, der nach dem Aufruf den
  Fehlerkanal prüft ([Fehlerkanal](abi.md#failure-channel-revision-2)).

## Prozesszustand

`abi::v1::FrameState` steht am Anfang jedes Kontexts, sodass erzeugter Code ihn
inline liest und aktualisiert:

| Feld | Bedeutung |
| --- | --- |
| `stack`, `top`, `limit` | Der Stack-Block (wird beim Wachsen verschoben), sein erstes freies Wort und die Wörter, die ein Push erreichen darf, ohne zu wachsen oder die Stack-Grenze zu überschreiten |
| `frame` | Wort-Offset des aktuellen Frame-Headers |
| `registers`, `live` | Die 256 Argument-/Ergebnisregister; die ersten `live` Wörter sind bei einer Übergabe Wurzeln |
| `reductions` | Verbleibende Funktionseintritte in der Zeitscheibe |
| `slow`, `failed` | Bits, die Übergaben an die Dienste schicken (`slow_collect`, `slow_profile`); ungleich null, solange der Fehlerkanal einen Fehlschlag hält |

`heap_top`/`heap_limit`, `runtime` und `self` dienen der Inline-Allokation, dem
Laden von Atomen und `self/0` ([Frames und Übergaben](abi.md#frames-and-transfers)).
Ein unterbrochener Prozess vermerkt den Eintritt, an dem er fortfährt, in
`ProcessStack::resume_`.

## Frames

Ein Frame ist ein Header aus 4 Wörtern, gefolgt von den Slots der Funktion
(BEAM-Y-Register): Term-Slots, die Wurzeln sind, dann Roh-Slots für
ausgelagerte native Werte.

| Header-Wort | Bedeutung |
| --- | --- |
| `previous` | Offset des Headers des Aufrufers (Frames verketten sich über Offsets, nie über Zeiger) |
| `function` | Der `FrameDescriptor` der Funktion |
| `resume` | Fortsetzungsindex, über den der Rumpf verzweigt, wenn die Kontrolle hierher zurückkehrt |
| `handler` | Handler-Index; immer 0, da Fehlschläge durch die Aufrufer zurückkehren |

Der Deskriptor `<symbol>.frame` nennt Modul, Funktion und Stelligkeit und hält
den Code-Zeiger des Rumpfs und die Slot-Anzahlen
([ABI](abi.md#frames-and-transfers)). Header-Wörter sind keine Terme; ein
Walker folgt `previous` und liest Slot-Anzahlen aus Deskriptoren. Ein
**Boden-Frame** (bottom frame) im Besitz der Runtime liegt unter dem ersten
Aufruf jedes Prozesses und jedes Host-Aufrufs: Die Rückkehr in ihn speichert
das Ergebnis im ersten Register und beendet den nativen Aufruf.

## Operationen

- **Aufruf (kein Endaufruf).** Werte, die nach dem Aufruf lebendig sind,
  werden in Slots ausgelagert. Der Aufrufer setzt sein eigenes `resume` auf den
  nächsten Fortsetzungsindex, legt die Argumente in die Register und übergibt
  an den Aufgerufenen. Lokale, entfernte, Fun- und dynamische Aufrufe sind
  dieselbe Übergabe; ein Fun- oder dynamischer Aufruf fragt zuerst einen
  Vorbereitungsdienst nach dem `FrameDescriptor` des Aufgerufenen
  ([Funs](funs.md#dynamic-calls)).
- **Eintritt.** Verbraucht eine Reduktion, pusht einen genullten Frame (lässt
  den Stack wachsen, wenn er voll ist), kopiert die Argumente jenseits der
  Parameter in Slots, setzt `resume = 0` und übergibt an den Rumpf des
  Aufgerufenen.
- **Rückkehr.** Der Aufgerufene übergibt das Ergebnis als `x0`, poppt seinen
  Frame (`top = frame`, `frame = previous`) und übergibt an den Rumpf des
  Aufrufers, der über das `resume` des Aufrufers verzweigt.
- **Endaufruf.** Der Aufrufer poppt seinen eigenen Frame ohne Übergabe und
  betritt dann an seiner Stelle den Aufgerufenen. Der Aufrufer des Aufrufers
  bleibt das Rückkehrziel, sodass Endrekursion mit konstantem Erlang- und
  nativem Stack läuft. Ein Endaufruf seiner selbst behält seinen Frame, wo er
  ist: Er verbraucht eine Reduktion, setzt die Fortsetzungs- und Handler-Wörter
  des Frames sowie die Anzahl lebendiger Werte zurück und kopiert die
  Argumente jenseits der Parameter, ohne den Header neu zu schreiben oder die
  Slots zu nullen; LLVM macht daraus eine Schleife. Ein Endaufruf an ein
  anderes Mitglied des Endaufrufzyklus des Aufrufers (Funktionen eines Moduls,
  die einander über Endaufrufe erreichen) behält die Verknüpfung zum Aufrufer
  und die Term-Slots, die beide Frames haben: Er schreibt den Deskriptor des
  Aufgerufenen, nullt nur die Term-Slots des Aufgerufenen jenseits derer des
  Aufrufers und überspringt die Prüfung der Stack-Grenze, wenn der Frame des
  Aufgerufenen nicht größer ist. Wie bei einem Endaufruf seiner selbst kann ein
  behaltener Slot einen Term eines früheren Mitglieds halten, bis der
  Aufgerufene ihn schreibt, sodass Speicherbereinigungen einen solchen Term
  etwas länger am Leben halten können.
- **Abgabe (yield).** Ist keine Reduktion mehr übrig, pusht ein Eintritt nicht:
  Er vermerkt sich in `ProcessStack::resume_`, behält seine Argumente als
  Register-Wurzeln (`ProcessStack::keep_registers`) und gibt Code zurück, der
  die Zeitscheibe beendet, sodass sich der native Stack bis zum Executor
  abwickelt, der später das Budget auffüllt und den Eintritt wiederholt.
  Schleifenköpfe von Comprehensions verbrauchen ebenfalls eine Reduktion und
  geben über einen Eintritt ab, wenn keine mehr übrig ist. Ein `receive`
  wartet über das Builtin `CLAUSE_wait_frame_v1`, das wie ein Aufruf betreten
  wird ([receive](processes.md#receive)).
- **Ende.** Die Rückkehr in den Boden-Frame beendet den Prozess mit seinem
  Ergebnis; ein Fehlschlag, der in ihn zurückkehrt, beendet den Prozess mit
  dem Fehlschlag.
- **Ausnahmen.** Ein Raise oder eine fehlgeschlagene Dienstprüfung vermerkt den
  Fehler im Kanal und kopiert die 8 innersten Frames der Kette für den
  Stacktrace ([Stacktraces](abi.md#stack-traces)). Jeder Aufrufer prüft nach
  dem Aufruf den Kanal und kehrt sofort zurück oder springt zum Handler-Block
  eines umgebenden `catch`, `try` oder `after` im selben Rumpf
  ([Fehlerkanal](abi.md#failure-channel-revision-2)). Halts und
  Infrastrukturfehler überspringen jeden Handler und kehren zum Boden-Frame
  zurück.
- **Host-Aufruf.** Ein exportiertes Symbol behält eine native Signatur und
  führt seine Funktion über einem Boden-Frame mit `CLAUSE_invoke_v1` aus,
  wobei es sie nach jeder Abgabe fortsetzt; native Ausnahmen, die von Diensten
  geworfen werden, werden dort aufgefangen. Runtime-Dienste bleiben gewöhnliche
  native Aufrufe und betreten erzeugten Code nie erneut.

Jeder Aufruf pusht einen Frame; Blattfunktionen lassen ihn nicht aus, sodass
jede Funktion ihren Eintrag im Stacktrace behält.

## Sichtbarkeit der Wurzeln

Bei jeder Übergabe und jedem Safepoint sind die Wurzeln eines Prozesses: die
Term-Slots aller Frames auf seinem Stack, `x[0..live)` sowie Nutzlast,
Argumentliste und Stack-Term des Fehlerkanals
([Wurzeln](runtime-heap.md#roots-and-safe-points)).

Werte überleben eine Übergabe nie in nativen Registern oder SSA-Werten, außer
den Parametern der Übergabe selbst. Jeder Rumpf lädt seine Frame-Adresse nach
dem Betreten neu aus `stack + frame` und liest lebende Werte aus Slots.
Innerhalb einer Fortsetzung macht ein Dienst, der einen Frame pushen oder den
Heap verschieben kann, jeden in SSA-Werten gehaltenen Slot-Zeiger und
Heap-Zeiger ungültig; die Neulade-Regel für Speicherbereinigungen ist in
[Neulade-Regel](runtime-heap.md#reload-rule) festgelegt.

Der Stack-Block wächst durch Verdoppeln und Verschieben, solange die
runtimeweite Grenze es erlaubt, schrumpft während der Laufzeit nie und ist vom
Heap-Block getrennt. Er hat keine Grenze für die Anzahl der Frames;
Stack-Wörter zählen zur
[Speichergrenze der Runtime](runtime-heap.md#runtime-memory-limit).

## Zielplattformen

`musttail` mit einer einheitlichen Code-Signatur wird von jeder erforderlichen
Zielplattform bei O0 und O2 akzeptiert (Prototyp unten, clang 23.1.2):

| Ziel | Wort | Ergebnis |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | Endsprünge |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | Endsprünge |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | Endsprünge |
| `armv7-unknown-linux-gnueabihf` | 32 | Endsprünge |

Das Backend meldet einen Fehler, wenn es einen `musttail`-Aufruf nicht
einhalten kann, daher ist eine erfolgreiche Kompilierung die Garantie.
Rückfallebene für eine künftige Zielplattform, die ihn ablehnt: ein
**Trampolin**, bei dem jeder Code den nächsten Code-Zeiger an die
Scheduler-Schleife zurückgibt, statt zu springen; Frames, Wurzeln und
Fortsetzungsindizes bleiben unverändert. Keine erforderliche Zielplattform
braucht es.

## Implementierung

- **Zwei Stufen.** Das Lowering erzeugt die *native Form*: eine Funktion
  `TermWord(context, arguments)` pro Erlang-Funktion, gewöhnliche Aufrufe
  zwischen ihnen, einen Platzhalter-Aufruf `clause.frame`, der die Term-Slots
  nennt, und `ret` des Ergebnisses eines Aufrufs in Endposition.
  `lower_frames` (`compiler/src/codegen/frames.cpp`) verschiebt dann jeden
  Rumpf nach `<symbol>.body`, fügt den Prolog hinzu (Frame-Header, Register,
  Resume-Switch), teilt Blöcke nach Nicht-Endaufrufen und Safepoints an
  Schleifenköpfen, lagert danach benutzte Werte aus (Terme in Term-Slots,
  andere Wörter in Roh-Slots), zieht konstante Slot-Adressen in den Prolog hoch
  und verwandelt Aufrufe, Endaufrufe und Rückkehr in `musttail`-Übergaben.
  Typspezialisierung und Test-Nahtstellen arbeiten auf der nativen Form; das
  Backend führt `lower_frames` vor der IR-Inspektion aus, und `optimize` führt
  es aus, falls noch nötig.
- **Inline-Übergaben.** Eintritte, Endeintritte und Rückkehr laufen inline auf
  `FrameState`. Jeder Pfad weicht auf `CLAUSE_enter_v1`, `CLAUSE_tail_v1` oder
  `CLAUSE_return_v1` aus, wenn der Heap eine Speicherbereinigung will, der
  Prozess profiliert wird, keine Reduktion übrig ist, der Stack wachsen muss
  oder seine Grenze erreicht oder der Aufgerufene ein Builtin ist. Die
  Fehlerprüfung nach einem Aufruf liest das Wort `failed` des Zustands. Die
  Dienstpfade speichern die Parameter vor dem Dienst in das Register-Array und
  laden sie danach neu.
- **Parameter.** Ein Rumpf liest seine führenden Argumente zu Beginn aus den
  Parametern und das Aufrufergebnis beim Fortsetzen aus `x0`; `lower_frames`
  lagert beides nur dann in einen Slot aus, wenn es über einen Aufruf oder
  Safepoint hinweg lebendig ist.
- **Endpositionen** sind der letzte Ausdruck eines Klauselrumpfs, verfolgt
  durch Blöcke, Klammern sowie Klauselrümpfe von `case`, `if` und `receive`.
  Aufrufe in Operanden von `catch`, `try`, `maybe` und `andalso`/`orelse` sind
  keine Endaufrufe.
- **Schleifen.** Generatoren von Comprehensions sind Schleifen innerhalb eines
  Rumpfs. Ihre Cursor und ihr Akkumulator liegen in Term-Slots, sodass kein
  SSA-Wert um eine Schleife herumgetragen wird und ein Fortsetzungspunkt darin
  nichts über die üblichen Auslagerungen hinaus braucht.
- **Safepoints.** Funktionseintritte und Schleifenköpfe von Comprehensions
  bereinigen, wenn der Heap es verlangt
  ([Speicherbereinigung in erzeugtem Code](runtime-heap.md#collection-in-generated-code));
  Roh-Slots für Auslagerungen halten nie Terme.
- **Keine Obergrenze.** Der Stack wächst, bis der Host Speicher verweigert, was
  mit `out_of_memory` scheitert (Exit 70,
  [ausführbare Dateien](executables.md)), so wie ein OTP-Prozess wächst. Ein
  optionales `StackOptions::limit_words` pro Prozess (getrennt vom optionalen
  Heap-Budget) lässt einen Push darüber hinaus mit `resource_limit` scheitern.

## Verglichene Alternativen

[tests/prototypes/execution_model](../tests/prototypes/execution_model/) senkt
dieselben Erlang-Funktionen (`sum/1` Rumpfrekursion, `loop/2` Endrekursion,
`fail/1` löst in Tiefe N aus, `catcher/1` fängt es ab) auf drei Arten von Hand
ab und kompiliert sie für jede obige Zielplattform bei O0 und O2
(`python tests/prototypes/execution_model/run.py`). Unter Windows x64 bei O2
führte das gewählte Modell eine Rumpfrekursion der Tiefe 1M in 17 ms mit
5 Wörtern pro Frame aus und 10M Endaufrufe mit konstantem Stack; seine
Trampolin-Variante bestand dieselben Läufe. Verworfen:

- **Native Aufrufe mit expliziten Wurzel-Frames.** Tiefe Rekursion braucht
  einen nativen Stack pro Prozess, bemessen für den tiefsten Aufruf (etwa
  13.000 Ebenen in einem Thread mit 1 MiB); Unterbrechung braucht Stack-Wechsel
  pro Zielplattform; 32-Bit-Ziele können für viele Prozesse keine großen
  Stacks reservieren.
- **LLVM-Coroutinen.** Eine Heap-Allokation pro Aufruf, keine Endaufrufe,
  Frames, deren Layout der Collector nicht sehen kann, Coroutinen-Passes selbst
  bei O0, und die symmetrische Übergabe hängt ohnehin von `musttail` ab.
- **Eine LLVM-Funktion pro Fortsetzung** (klassisches CPS). Dieselben
  Übergaben, aber Zusammenführungen und Handler, die von mehreren Fortsetzungen
  aus erreicht werden, müssten in weitere Funktionen aufgeteilt werden; der
  Resume-Switch behält einen Walker für eine einzige Funktion.

Akzeptierte Kosten: ein indirekter Sprung pro Rückkehr plus ein
Switch-Dispatch; über Aufrufe hinweg lebende Werte werden aus Slots neu
geladen; Backtraces nativer Debugger zeigen nur die aktuelle Funktion, während
Erlang-Stacktraces aus der Frame-Kette stammen ([Debugging](debugging.md)).
