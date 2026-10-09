---
source: docs/runtime-heap.md
sourceCommit: 06042fa
sourceSha256: b86a14bcde03a998409e7048283225de3a5f8f84ded889ba64544a4671571cbc
translatedAt: 2026-10-09
---
# Vertrag des Prozess-Heaps

Prozess-Heaps folgen dem klassischen ERTS-Design. Diese Notiz ist der Vertrag;
Plan 11 phase C (steps 8A–8I) hat ihn umgesetzt, und spätere, unten genannte
Schritte erweitern ihn. [runtime.md](runtime.md#process-memory) fasst die API
zusammen.

## Was phase C ersetzt hat

| Vor phase C | Problem | Ersatz |
| --- | --- | --- |
| Eine Liste von Chunks, die sich nie bewegen | Zellen können weder kompaktiert noch kopiert werden; die Kapazität wächst nur | Ein zusammenhängender Heap-Block plus Fragmente, verschoben durch eine kopierende Speicherbereinigung (8G, 8H) |
| Jede Zelle ist ein Knoten in einem prozesseigenen `std::map`-Index | Heap-Wörter allein sind nicht parsebar; eine Host-Allokation und ein O(log n)-Lookup pro Zelle | Selbstbeschreibende Zellen; Zulassung über eigenen Bereich und Header (8C, 8D) |
| Jede bitstring-Zelle hat ein festes 64-Byte-Array und einen `shared_ptr`, freigegeben über eine Destruktor-Registry | Große Zellen für kleine Daten; nichts kann eine Zelle verschieben oder ihre toten Kopien finden | Heap-binaries variabler Größe und Off-Heap-binary-Zellen auf einer prozesseigenen Off-Heap-Liste (8B) |
| Ein Host-`Term` pinnt den Heap mit `shared_ptr<HeapStorage>`; von der Runtime gehaltene Werte leben nur in `Term`s | Nichts, was eine Speicherbereinigung finden oder umschreiben kann | ERTS-Modell: C++ hält rohe Wörter nur zwischen Safepoints; von der Runtime gehaltene Werte sind Wurzelwörter des Prozesses; Host-Aufrufer übergeben explizite Wurzeln an `collect()` (8E) |
| Ein Heap-Puffer pro erzeugtem Wurzel-Frame | Kein Prozess-Stack zum Durchsuchen | Ein Stack von Wurzel-Frames pro Prozess (8F) |
| Kein Überlaufbereich | Eine Allokation passt entweder ins Budget oder schlägt fehl | Heap-Fragmente, solange sich der Heap nicht bewegen darf (8G) |

Erzeugter Code, sein ABI und jedes beobachtbare Programmergebnis bleiben
unverändert.

## Wortlayout

Ein Term ist ein Zielwort (32 oder 64 Bits); die Kodierungen stehen in
[abi.md](abi.md#terms). Jeder Heap-Bereich ist eine Folge von Objekten, die ein
Walker ab ihrem ersten Wort parst:

- **Header-Wort** (primärer Tag `00`): Bits 2–6 enthalten die `BoxedKind`, Bits
  ab 7 die Anzahl der Wörter, die dem Header folgen. Ein geboxter Term zeigt
  auf seinen Header. Die Anzahl umfasst jedes Präfix-, Nutzdaten- und
  Füllwort, sodass der Walker nicht verfolgte Nutzdaten überspringt, ohne sie
  zu interpretieren.
- **cons-Zelle**: zwei Termwörter (Kopf, Tail) ohne Header. Ein Listenterm
  zeigt auf den Kopf. Ein Kopf ist nie ein Header, weil kein Term den Tag `00`
  hat.
- **Füllzelle**: das Wort aus lauter Nullen (Art `tuple`, Anzahl 0) ist eine
  Füllzelle von einem Wort; die Art `filler` mit Anzahl n deckt n weitere
  Wörter ab. Reservierungen beginnen genullt, sodass reservierte, aber
  ungenutzte Wörter als Füllzellen geparst werden. Nichtleere Tupel haben immer
  eine Anzahl ungleich null, und `{}` ist ein Immediate.

Keine Zelle braucht eine stärkere Ausrichtung als ein Wort. `memory/heap_walk`
parst einen Bereich Zelle für Zelle, und `ProcessHeap::verify` prüft einen
ganzen Heap (8C). Zellen enthalten nur Wörter und Bytes, außer dem
`std::shared_ptr` des Off-Heap-binarys (unten), sodass eine Zelle durch Kopieren
ihrer Wörter verschoben wird.

| Art | Wörter nach dem Header | Verfolgte Wörter |
| --- | --- | --- |
| cons (kein Header) | insgesamt 2 Wörter | Kopf, Tail |
| `tuple` | n Elementplätze | alle |
| `map` | 2n Plätze: Schlüssel in exakter Termordnung, jeweils gefolgt von ihrem Wert | alle |
| `native_record` | Adresse der `RecordDefinition` der Runtime, dann n Feldwerte in Definitionsreihenfolge | Werte |
| `fun_closure` | Adresse der `FunDefinition` der Runtime, dann n erfasste Werte ([Funs](funs.md)) | Werte |
| `bignum` | Vorzeichenwort, dann Betragsglieder (limbs), niederwertigstes zuerst | keine |
| `floating` | 8 Bytes: 1 Wort (64 Bit) oder 2 Wörter (32 Bit) | keine |
| `reference` | 8 Bytes: die Referenznummer ([Pids und Referenzen](terms.md#pids-and-references)) | keine |
| `heap_binary` | Bitlänge, dann Datenbytes, auf Wörter aufgerundet (höchstens 64 Bytes) | keine |
| `refc_binary` | Bit-Offset, Bitlänge, `std::shared_ptr` (2 Wörter), Off-Heap-Verknüpfung: 5 Wörter | keine |
| `filler` | n ungenutzte Wörter | keine |

Die Anzahl bei `map` ist in Wörtern angegeben (Einträge = Anzahl / 2). Pids sind
Immediates und werden gegen die von der Runtime vergebenen Nummern zugelassen.
Noch nicht zugelassene Arten (externe Identitäten) folgen denselben Regeln,
sobald sie hinzukommen: Identitäten und Deskriptoren sind Registry-IDs in nicht
verfolgten Wörtern, nie besitzende C++-Zeiger.

## Off-Heap-binaries

Ein binary größer als 64 Bytes ist ein unveränderlicher Puffer, der außerhalb
jedes Prozess-Heaps liegt und per Referenzzählung geteilt wird (BEAM ProcBin und
`Binary`).

- Seine geboxte `refc_binary`-Zelle enthält einen `std::shared_ptr` auf den
  Puffer, einen Bit-Offset und eine Bitlänge; Ausschnitte eines großen binarys
  sind neue `refc_binary`-Zellen, die den Puffer teilen (ERTS-Sub-binaries
  werden nicht verwendet). Das Kopieren einer Zelle in einen anderen Prozess
  kopiert den `shared_ptr` ([Kopieren zwischen Heaps](#copying-between-heaps)),
  nie die Bytes.
- Jede Zelle ist über ihr Verknüpfungswort in die Off-Heap-Liste ihres
  Prozesses eingehängt. Die Liste ist der einzige Weg, den C++-Zustand dieser
  Zellen zu finden.
- Das Verschieben einer Zelle kopiert ihre übrigen Wörter und
  move-konstruiert den `shared_ptr` in die neue Zelle, sodass die alte Kopie
  nichts besitzt. Nach einer Bereinigung hängt der Listendurchlauf verschobene
  Zellen neu ein und zerstört den `shared_ptr` toter Zellen; der Abbau
  (teardown) zerstört alle. Ein Puffer wird freigegeben, wenn seine letzte
  Zelle, in welchem Prozess auch immer, stirbt.
- Jeder Prozess zählt seine Zellen pro Puffer (`HeapStorage::buffers_`); ein
  Puffer wird jedem Prozess, der ihn referenziert, einmal angerechnet (seine
  Off-Heap-Wörter, der virtuelle Binary-Heap von ERTS), bis die letzte Zelle
  dieses Prozesses dafür stirbt, und einmal dem runtime-weiten Konto von der
  Erzeugung bis zur Freigabe des Puffers.
- `std::shared_ptr` besteht in jeder unterstützten STL aus zwei Zeigern; ein
  `static_assert` hält die Zellgröße bei beiden Wortbreiten auf fünf Wörtern
  nach dem Header fest.

## Bereiche

- **Heap.** Ein Block `[start, top, end)` pro Prozess mit Bump-Allokation (8G).
  Er wird durch die erste Allokation des Prozesses erzeugt, mit der Größe
  `max(min_heap_words, request)`, damit diese Anforderung immer passt, und
  gehört allein diesem Prozess.
- **Fragmente.** Wenn eine Anforderung nicht passt und sich der Heap nicht
  bewegen darf, geht sie in das neueste Fragment, falls sie dort passt, sonst
  in ein neues, passend dimensioniertes Fragment (mindestens die minimale
  Heap-Größe), das an den Prozess angehängt wird. Die nächste Bereinigung führt
  die Fragmente im neuen Heap-Block zusammen. Eine Reservierung liegt in einem
  Bereich; ein Rollback setzt den `top` dieses Bereichs zurück und verwirft ein
  Fragment (oder den Heap-Block), das die Reservierung erzeugt hat. Eine
  Allokation bewegt den Heap nie: Überlauf bleibt in Fragmenten bis zum
  nächsten Safepoint oder zur nächsten Host-Bereinigung
  ([Bereinigung in erzeugtem Code](#collection-in-generated-code)).
- **Stack.** Erzeugte Frames (BEAM-Y-Register) liegen auf einem flachen Stack
  pro Prozess, getrennt vom Heap (`ProcessStack`, step 19). Jeder Frame ist ein
  Header aus vier Wörtern (Header-Offset des Aufrufers, Deskriptor,
  Fortsetzung, Handler), gefolgt von Termplätzen (ausgelagerte Terme
  eingeschlossen) und rohen Auslagerungsplätzen (spill slots); Frames sind über
  Offsets verknüpft, sodass der Block durch Verdopplung wächst und sich
  bewegt. Standardmäßig hat er keine Obergrenze; ein optionales prozesseigenes
  `StackOptions::limit_words` begrenzt ihn getrennt vom Heap
  ([Ausführungsmodell](execution-model.md#implementation)).
- **Off-Heap-Liste.** Wie oben.
- **Alter Heap.** Keiner. Generationelle Bereinigung ist zurückgestellt;
  unveränderliche Terme zeigen nie von älteren auf neuere Daten, sodass eine
  Hochwassermarke und ein alter Heap später hinzugefügt werden können, ohne
  Zellen zu ändern.

## Dimensionierung und Budget

- Der Heap beginnt bei `min_heap_words` (233 Wörter, wie ERTS) und wächst
  entlang der ERTS-Größenfolge: 12, 38, dann ist jede Größe die Summe der
  beiden vorherigen plus eins bis 833.026 Wörter, danach Schritte von 20 %
  (`heap_size_at_least`).
- Der neue Block einer Bereinigung ist die kleinste solche Größe, bei der die
  Wörter, die er aufnehmen kann, unter 75 % davon bleiben: zunächst alle
  benutzten Wörter, da lebende Daten vor dem Kopieren nicht bekannt sind. Ein
  Ergebnis mit weniger als 25 % lebenden Daten wird noch einmal in die Größe
  kopiert, die seine lebenden Daten brauchen (8H); scheitert die Allokation
  dieses Blocks, bleibt der größere erhalten. Keiner ist kleiner als
  `min_heap_words`. Beide Größen zählen die Wörter des Prozess-Stacks als
  lebend (step 26), da ERTS den Stack innerhalb des Heap-Blocks hält.
- Mit gesetztem Budget (unten) enthält ein neuer Block höchstens seine
  lebenden Wörter plus die Hälfte des Budgets, das nach ihnen und den
  Off-Heap-Puffern übrig bleibt (`block_limit`, step 27), nie weniger als
  `min_heap_words`. Die andere Hälfte bleibt frei für Fragmente und neue
  Off-Heap-Puffer, sodass nach einer Bereinigung allozierter Müll den nächsten
  Safepoint als Auslöser erreicht, statt das Budget zu erschöpfen. Die erste
  Kopie wird aus allen benutzten Wörtern dimensioniert, sodass ein Block über
  dem Limit für die überlebenden Wörter noch einmal in seine
  Richtliniengröße kopiert wird.
- Standardmäßig gibt es keine Speicherobergrenze, weder pro Prozess noch für
  die Runtime: der Heap wächst, bis der Host Speicher verweigert
  (`out_of_memory`), während die obige Dimensionierung ihn nahe seiner
  lebenden Größe hält. Ein optionales prozesseigenes Budget,
  `HeapOptions::limit_bytes` (Standard `UNLIMITED_HEAP_BYTES`), umfasst den
  Heap-Block, die Fragmente und die Bytes der Off-Heap-Puffer, die dieser
  Prozess referenziert; eine Überschreitung ist `limit_exceeded`. Während einer
  Bereinigung existieren alter und neuer Block nebeneinander; nur der neue
  Block wird gegen das Budget geprüft, begrenzt auf das nach den
  Off-Heap-Puffern verbleibende Budget. Die Anrechnung eines Puffers wird
  zurückgegeben, wenn der Prozess seine letzte Zelle dafür verwirft. Der Stack
  behält seine eigene optionale Obergrenze, `StackOptions::limit_words`.
  Programme setzen beide Obergrenzen mit `--max-heap` und `--max-stack`
  ([Runtime-Optionen](executables.md#runtime-options)).

## Runtime-Speicherlimit

- Ein optionales runtime-weites Limit, `RuntimeOptions::memory_limit_bytes`
  (Standard `UNLIMITED_HEAP_BYTES`; Programme setzen es mit `--max-memory`),
  begrenzt den Speicher aller Prozesse zusammen: Heap-Blöcke, Fragmente,
  Off-Heap-Puffer und Stack-Kapazität (step 27A). OTP hat kein solches Limit;
  am nächsten kommt dem das Ausführen der VM unter einem Speicherlimit des
  Betriebssystems, aber hier scheitert ein Prozess statt des Knotens.
- Ein Konto pro Runtime (`detail::RuntimeMemory`, geteilt von jedem
  Heap-Speicher und Stack) wird belastet, wenn ein Block, ein Fragment, ein
  Off-Heap-Puffer oder Stack-Kapazität erzeugt wird, und entlastet, wenn er
  verworfen wird; ein von mehreren Prozessen geteilter Puffer wird einmal
  belastet und entlastet, wenn seine letzte Referenz stirbt (step 28). Der
  Abbau gibt jede Belastung des Prozesses zurück. `Runtime::memory_bytes()`
  meldet die Summe.
- Für jeden Prozess wirkt das Limit als Budget aus dem Speicher, den er
  besitzt, plus dem, was das Limit übrig lässt (`HeapStorage::budget`,
  `room`), sodass die obige Dimensionierung nach jeder Bereinigung die Hälfte
  des freien Speichers frei hält, und eine Anforderung darüber hinaus ist
  `limit_exceeded` (`resource_limit`) nur für den anfordernden Prozess; andere
  Prozesse laufen weiter. Der Müll eines anderen Prozesses zählt, bis dieser
  Prozess bereinigt.
- Der Zielbereich (to-space) einer Bereinigung wird auch über das Limit hinaus
  angerechnet, weil er die Blöcke ersetzt, die er am Ende derselben
  Bereinigung freigibt.
- Der Stack verdoppelt sich, solange das Limit es erlaubt, und wächst danach
  nur um den Frame, der gerade abgelegt wird.

## Zulassung

Zeiger in einen Prozess-Heap werden nur vom Compiler und von der Runtime
innerhalb dieses Prozesses erzeugt und benennen immer einen Objektanfang; es
gibt keine inneren Zeiger zu erkennen. Die Zulassung (admission) (8D) ist eine
Besitzprüfung für Wörter, die an einen Prozess zurückgegeben werden:

1. Die Adresse ist wortausgerichtet innerhalb eines der Bereiche des Prozesses,
   unterhalb seines `top`: zuerst wird der Heap-Block geprüft, dann die nach
   Adresse sortierten Fragmente. Fremde und veraltete Wörter scheitern hier
   ohne jeden Ladezugriff.
2. Ein geboxtes Wort benennt einen Header einer zugelassenen Art (keine
   Füllzelle); ein Listenwort benennt eine cons-Zelle (ein Wort, das kein
   Header ist).

Zugriffsfunktionen dekodieren Art, Anzahl und Nutzdaten aus dem Header selbst.
`verify()` bleibt für Tests die vollständige Prüfung, dass jeder Platz einen
Objektanfang benennt.

## Wurzeln und Safepoints

`ProcessContext::visit_roots` zählt jedes Wurzelwort für die
Speicherbereinigung auf (step 23). An einem Safepoint hält nichts anderes
Heap-Wörter des Prozesses:

| Besitzer | Wurzelwörter | Anmerkungen |
| --- | --- | --- |
| Termplätze der Frames | Die ersten `roots` Plätze jedes Frames auf dem Stack (step 19) | Unterste Frames haben keine; Fortsetzungs- und Handler-Indizes sind Ganzzahlen |
| Rohe Frame-Plätze | Keine | Ausgelagerte native Werte; erzeugter Code hält dort an einem Safepoint kein Heap-Wort (Neuladeregel von step 24) |
| Register | `x[0..live)` (`ProcessStack::keep_registers`) | Die Argumente eines suspendierten Eintritts (step 43); jedes Push und Pop leert `live` |
| Fehlerkanal | Fehler-Nutzdaten (BEAM `fvalue`), Argumentliste von `erlang:error/2,3`, Stacktrace-Term | Werden an Ort und Stelle neu gebunden; erfasste Trace-Frames sind Deskriptorzeiger in den Code |
| Trap-Zustand | Die Termwörter des `TrapState` eines trappenden Builtins (step 43A) | Freigegeben, wenn das Builtin endet oder scheitert |
| Mailbox | Jede Nachricht im Signal-Posteingang und in der Nachrichtenwarteschlange (step 45), einschließlich `'EXIT'`- und `'DOWN'`-Nachrichten | Bis ein receive sie entnimmt; an Ort und Stelle umgeschrieben, sodass der receive-Cursor (eine Listenposition) und die Timeout-Frist gültig bleiben |
| Explizite Wurzeln | Der Bereich, den ein Host an `collect(roots)` übergibt (8E) | Nach dem Aufruf zurückgelesen |
| Off-Heap-Liste | Keine | Verknüpfungen werden durchlaufen und neu eingehängt, nicht verfolgt |

Keine Heap-Zelle hält einen Pin. Atome sind Immediates, und die Atomtabelle wird
nie bereinigt. Fun-Zellen benennen Code über ihre nicht verfolgte
`FunDefinition`, die so lange lebt wie die Runtime; geladene Module werden nie
entladen, daher brauchen weder funs noch Trace-Deskriptoren einen Pin. Kleine
Immediates sind keine Wurzeln.

Wie im C-Code von ERTS ist ein Host-`Term` ein rohes getaggtes Wort, gültig bis
zum nächsten Safepoint seines Heaps. Er pinnt keinen Heap-Speicher; er hält ein
schwaches Lebensdauer-Token des Kontexts und den Bereinigungszähler des Heaps,
sodass eine Verwendung nach dem Abbau `expired_context` meldet und eine
Verwendung nach einer späteren Bereinigung einen Fehler wegen veraltetem Term.
Ein `Term` ist nur innerhalb seines eigenen Prozesses gültig; andere Prozesse
dürfen ihn nur lesen.

Der Heap bewegt sich nur an einem Safepoint und nie, während eine Reservierung
offen ist:

- ein explizites Host-`collect()`, während der Kontext keinen erzeugten Code
  ausführt;
- ein `collect()`, während laufender erzeugter Code einen
  `SafePoint`-Gültigkeitsbereich deklariert hat und damit zusichert, dass er
  Heap-Wörter nur in den obigen Wurzeln hält. Die Runtime öffnet einen solchen
  nur an den Safepoints im erzeugten Code aus dem nächsten Abschnitt.

Jede andere Anforderung liefert `unsafe_point` und ändert nichts, nicht einmal
den Fehlerkanal eines laufenden erzeugten Aufrufs. Eine Allokation bewegt den
Heap nie: eine Anforderung, die nicht passt, erzeugt ein Fragment.

## Bereinigung in erzeugtem Code

Entscheidung von Plan 11 step 24 (2026-10-06), umgesetzt in step 26
([Implementierung](#implementation)). Erzeugter Code bereinigt nur an wenigen
**Safepoints**, an denen jeder lebende Term bereits in einer Wurzel liegt.
Alles andere, einschließlich jedes allozierenden Service, ist ein **kritischer
Abschnitt**, der den Heap nie bewegt.

### Auslöser

Ein Safepoint bereinigt, wenn der Heap danach verlangt; andernfalls kostet er
eine Prüfung.

| Auslöser | Bedingung am Safepoint | Gegenstück in ERTS |
| --- | --- | --- |
| Heap voll | Es existiert ein Fragment: seit der letzten Bereinigung passte eine Allokation nicht in den Heap-Block | Heap-Top erreicht das Heap-Ende |
| Druck durch Off-Heap-binaries | Off-Heap-Wörter erreichen das Limit des virtuellen Binary-Heaps: anfangs 46.422 Wörter, nach jeder Bereinigung das Doppelte der überlebenden Off-Heap-Wörter, nie weniger als dieses, aber höchstens die Überlebenden plus die Hälfte des nach dem Heap-Block frei verbleibenden Budgets (step 27) | `bin_vheap_sz` / virtueller Binary-Heap |
| `erlang:garbage_collect/0` | Immer; kommt mit den Builtin-Familien (steps 36-37) als erzwungener Safepoint | Expliziter vollständiger Durchlauf |

Der neue Block wird für die lebenden Wörter **plus die benutzten Stack-Wörter**
dimensioniert (ERTS hält den Stack innerhalb des Heap-Blocks): ein tiefer Stack
bekommt einen größeren Heap, sodass eine lange Rekursion proportional zu ihrer
Allokation bereinigt, statt alle paar hundert Wörter den ganzen Stack erneut zu
durchsuchen.

### Safepoints

| Punkt | Wo | Lebend außerhalb der Termplätze der Frames |
| --- | --- | --- |
| Funktionseintritt | In `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (und damit beim Host-Aufruf), bevor der Frame des Aufgerufenen abgelegt wird | Die Argumente des Aufgerufenen `x[0..arity)`, als Wurzeln gehalten (`keep_registers`) |
| Schleifenkopf | Ein Aufruf von `CLAUSE_safepoint_v1(context)` am Kopf jeder Generatorschleife einer comprehension | Nichts |

Jede Erlang-Schleife ist entweder eine Rekursion, die pro Schritt einen
Funktionseintritt passiert, oder eine comprehension, die ihren Schleifenkopf
passiert, sodass der Müll zwischen zwei Safepoints durch geradlinigen Code und
einzelne Service-Ergebnisse begrenzt ist.

Keine Safepoints (kritische Abschnitte, die weiter in Fragmente allozieren):
jeder andere Runtime-Service, einschließlich Allokations-, Konstruktions- und
Matching-Services; `CLAUSE_return_v1`; Ausnahmeweitergabe; und später die
Nachrichtenzustellung (step 45). Services dürfen daher während ihres gesamten
Laufs rohe Heap-Wörter in C++ halten, und ihre Eingabearrays und Ausgaben
müssen nicht neu geladen werden.

### Wartende und suspendierte Prozesse

Plan step 51. Ein Prozess, der nicht läuft, wird nie bereinigt: er wartet in
einem receive, ist nach einem Yield oder Trap eingereiht oder noch nicht
gestartet, und alles, was er hält, ist bereits eine Wurzel (seine Frames, die
Register des Eintritts oder der Fortsetzung, an dem bzw. der er fortfährt, der
Trap-Zustand und seine Nachrichten). An ihn gesendete Nachrichten werden in
Fragmente seines Heaps kopiert. Jede Zustellung weckt einen wartenden Prozess,
und seine Fortsetzung wiederholt den Eintritt seiner Fortsetzung (das
Warte-Builtin, eine Trap-Fortsetzung oder die Funktion, an der er per Yield
abgegeben hat), was ein Safepoint beim Funktionseintritt ist: das Erste, was
ein fortgesetzter Prozess tut, ist zu bereinigen, wenn sein Heap danach
verlangt. Ein Prozess, der in einem selektiven receive wartet, das viele
Nachrichten überspringt, bereinigt daher, während sie eintreffen, so wie ERTS
einen Prozess bereinigt, wenn er das nächste Mal eingeplant wird.
`executables_mailbox_collection` prüft Horten, Warten mit Timeout und tiefe
Rekursion unter Nachrichtenlast sowie, dass ein Konsument, der 3.000
Nachrichten bestätigt, innerhalb von `--max-heap 65536` bleibt.

Verworfen: Allokation als Safepoint (BEAM `test_heap`). Sie würde erfordern,
dass jede Service-Eingabe und jeder über eine Allokation hinweg lebende
SSA-Term in einer Wurzel liegt, ein Neuladen nach jedem allozierenden Service
und ein Wiederholungsprotokoll in jedem Service, während die beiden obigen
Safepoints den Müll bereits begrenzen.

### Neuladeregel

Kein SSA-Wert (ein Wert in einem nativen Register) hält ein Heap-Wort über
einen Safepoint hinweg, und kein nativer Zeiger überquert überhaupt einen
(bereits ein Fehler in `lower_frames`).

- `lower_frames` behandelt einen Safepoint-Aufruf am Schleifenkopf wie den
  Fortsetzungspunkt eines Aufrufs: es teilt den Block nach dem Aufruf und
  lagert jeden Wert aus (spill), der danach gelesen und davor berechnet wird.
  Ein **Termwert** (ein Ladezugriff aus einem Termplatz oder einem Register,
  ein in einen Termplatz gespeicherter Wert oder ein PHI solcher Werte) wird
  nach seiner Definition in seinen bestehenden Termplatz oder einen neuen, im
  `roots` des Deskriptors gezählten Termplatz gespeichert und vor jeder
  Verwendung neu geladen. Andere Wörter (kleine Immediates, Atome, rohe
  Ganzzahlen, Flags) behalten rohe Plätze: eine Bereinigung ändert sie nie.
- Aufrufe lagern auf dieselbe Weise aus und laden neu, Terme in Termplätze,
  sodass der Safepoint beim Eintritt jeden lebenden Term jedes Aufrufers sieht.
- Die Frame-Basis bleibt über einen Safepoint am Schleifenkopf hinweg gültig,
  weil eine Bereinigung Stack-Wörter an Ort und Stelle umschreibt und den Stack
  nie bewegt; jede Übergabe liest sie wie zuvor im Prolog des Rumpfes neu.
- Die Optimierung läuft nach `lower_frames` und kann ein Neuladen nicht durch
  den älteren SSA-Wert ersetzen: die Frame-Adresse stammt aus
  `CLAUSE_frame_v1`, daher darf der Safepoint-Aufruf jeden Platz schreiben
  (Prototyp unten).

### Fehlerverhalten

- Eine Bereinigung an einem Safepoint verzeichnet nie einen Fehler. Kann ihr
  neuer Block nicht alloziert werden (`out_of_memory`), bleibt der Heap, wie er
  ist, und die Ausführung fährt mit Fragmenten fort.
- **Speichererschöpfung** (step 27). Ohne Obergrenze geht der Speicher nur aus,
  wenn der Host einen Heap-Block, ein Fragment, einen Off-Heap-Puffer oder
  Stack-Wachstum verweigert: `out_of_memory`. Mit gesetztem optionalem Budget
  oder [runtime-weitem Limit](#runtime-memory-limit) ist eine Anforderung
  darüber hinaus `limit_exceeded`, gemeldet als `resource_limit`. Beides sind
  Infrastrukturfehler: kein Handler läuft, die Frames werden bis zum untersten
  Frame abgewickelt, und ein Programm gibt
  `clau: runtime failure: entry call failed: <status>` aus und endet mit Status
  70, nachdem stdout geleert und der Prozess zerstört wurde
  ([ausführbare Dateien](executables.md#exit-status),
  [Unterschiede](differences.md)). Da jede Bereinigung die Hälfte des nach
  ihren Überlebenden verbleibenden Budgets frei hält
  ([Dimensionierung](#sizing-and-budget), [Auslöser](#triggers)), scheitert ein
  Budget nur, wenn die lebende Menge nicht mehr passt oder wenn geradliniger
  Code zwischen zwei Safepoints mehr als diese Hälfte alloziert; Müll wird
  zuerst bereinigt.

### Implementierung

Step 26 (2026-10-06):

- `ProcessStack::safepoint(live)` fragt `ProcessHeap::wants_collection()` (ein
  Fragment existiert, oder Off-Heap-Wörter haben `binary_limit_words_`
  erreicht), hält `x[0..live)` als Wurzeln, öffnet einen `SafePoint` und
  bereinigt; eine gescheiterte Bereinigung wird ignoriert. `enter` (und damit
  `tail` und `invoke`) ruft es vor dem Ablegen mit der Stelligkeit des
  Aufgerufenen auf; `CLAUSE_safepoint_v1` ruft es mit 0 auf.
- Das Lowering von comprehensions erzeugt `CLAUSE_safepoint_v1` am Kopf jeder
  Generatorschleife (`lowering_comprehensions`).
- `lower_frames` teilt jeden Rumpf nach einem Safepoint-Aufruf und lagert
  überquerende Werte aus wie nach einem Aufruf. `home()` behält den
  Argumentplatz oder einen Termplatz desselben Blocks, wenn einer den Wert
  enthält; andernfalls bekommt ein Termwert (`term_value`: aus einem Termplatz
  oder Register geladen, in einen Termplatz gespeichert oder ein PHI davon)
  einen neuen Termplatz, den `place_slots` an die führenden Termplätze vor den
  rohen Plätzen anhängt, und jeder andere Wert einen rohen Platz.
- Der Golden-Test `executables_garbage_collection` (von OTP erzeugt) alloziert
  mehr als 64 MiB bei kleiner lebender Menge: eine Tail-Schleife, die pro
  Schritt einen String von 400 Wörtern baut, 9.000 Off-Heap-binaries zu 8 KiB,
  eine comprehension, deren Filter pro Element alloziert, eine Rumpfrekursion
  der Tiefe 20.000, die pro Frame einen verschachtelten Term (Tupel, Liste,
  binary) hält, und Fehler-Nutzdaten, die nach dem Abwickeln allozierender
  Frames gefangen und durch eine lange allozierende Schleife hindurch gehalten
  werden.

Step 27 (2026-10-06):

- `collected_size` begrenzt den Block auf `block_limit(live)`; `shrink` läuft
  auch, wenn der Block das Limit der überlebenden Wörter überschreitet;
  `collect` begrenzt `binary_limit_words_` auf die Überlebenden plus die Hälfte
  des nach dem Block frei verbleibenden Budgets.
- Zuvor konnte ein Block das gesamte verbleibende Budget beanspruchen (aus den
  benutzten Wörtern einschließlich Müll dimensioniert), und der virtuelle
  Binary-Heap konnte es überschreiten, sobald die Überlebenden die Hälfte des
  Budgets überschritten, sodass Allokationen scheiterten, während Müll noch
  unbereinigt war: unter dem damaligen Standardbudget von 64 MiB scheiterte ein
  64-Bit-Lauf, der 700 binaries zu 64 KiB behielt und pro Schritt vier
  verwarf, bei 68 % lebenden Daten; mit den Obergrenzen passen 1.010 (99 %).
- Das Standard-Heap-Budget von 64 MiB und das Stack-Budget von 2^24 Wörtern
  wurden entfernt (Vorgabe des Nutzers): beide sind pro Prozess optional
  zuschaltbar (`Runtime::create_context(HeapOptions, StackOptions)`) und
  standardmäßig unbegrenzt.
- Der Golden-Test `executables_heap_growth` behält 1.100 binaries zu 65.540
  Bytes (72 MB), während er pro Schritt vier verwirft, und gibt die Anzahl wie
  OTP aus. `runtime_collection` `near_budget` prüft beide Obergrenzen mit einem
  Budget von 10.000 Wörtern (Heap-Block und Off-Heap-Puffer).

Step 27A (2026-10-06):

- Runtime-weites Limit und `--max-heap`, `--max-stack`, `--max-memory`
  ([Runtime-Speicherlimit](#runtime-memory-limit)). Selbst verfasste
  Golden-Läufe belegen wieder begrenzten Speicher: `garbage_collection`
  `churn` und `binaries` unter einem Runtime-Limit von 1 MiB, `comprehension`
  unter einer Heap-Obergrenze von 1 MiB und `payload` unter einem
  Runtime-Limit von 16 MiB (jeder alloziert mehr als 64 MiB); `tail_calls`
  läuft in Schleifen unter einem Stack von 4 KiB und einer Heap-Obergrenze von
  64 KiB; `deep` unter 1 MiB und `deep_recursion` `build` unter einem Stack von
  64 KiB scheitern mit `resource_limit`. `deep` selbst braucht bei O0 etwa
  100 MiB (lebende Frames halten veraltete Terme und sind je etwa 130 Wörter
  groß), daher hat es keinen erfolgreichen Lauf mit Obergrenze.
  `runtime_collection` `shared_limit`: zwei Prozesse unter einem Limit von
  40.000 Wörtern; der Block des Halters stoppt bei 28.000 Wörtern, der andere
  bereinigt 20 Runden Müll nahe dem Limit, scheitert dann an einer Liste von
  16.000 Wörtern mit `resource_limit`, während der Halter weiter alloziert,
  und der Abbau gibt jede Belastung zurück.

### Prototyp

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) enthält eine
Schleife im Stil einer comprehension in der Form nach `lower_frames`
(`loop.ll`): ein vor der Schleife berechneter Term `Y` wird in einen Termplatz
gespeichert und nach dem Safepoint am Schleifenkopf neu geladen.
`python tests/prototypes/safepoint/run.py` kompiliert ihn für
`x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu` (64-Bit-Wörter),
`i686-pc-windows-msvc` und `armv7-unknown-linux-gnueabihf` (32-Bit-Wörter) bei
O0 und O2 und prüft, dass auf den Safepoint-Aufruf ein Ladezugriff auf das
Frame-Wort von `Y` folgt. Alle acht bestehen mit clang 23.1.2. Bei O2 (i686)
behält die Schleife das Neuladen aus dem Platz bei und verwendet nie das
Register wieder, das `Y` enthielt:

```text
LBB0_2:                     # loop head
    pushl  %edi
    calll  _clause_safepoint_v1
    pushl  20(%esi)         # cursor reloaded from its term slot
    ...
    pushl  24(%esi)         # accumulator
    pushl  28(%esi)         # Y reloaded from its term slot
    calll  _make
```

## Speicherbereinigung

Eine Cheney-Kopie mit vollständigem Durchlauf (8H, `memory/heap_collect`):
zuerst wird der neue Block alloziert (ein Fehlschlag ist `out_of_memory` und
lässt den Heap unberührt), dann werden Host-`Term`s als veraltet markiert, das
Objekt hinter jedem Wurzelwort kopiert und der neue Block von links nach rechts
durchsucht, wobei die Kinder jeder Kopie kopiert werden. Der Header eines
verschobenen geboxten Objekts wird durch einen geboxten Zeiger auf seine Kopie
ersetzt; eine verschobene cons-Zelle bekommt einen Null-Kopf und einen Tail,
der auf ihre Kopie zeigt. Die Weiterleitung erhält geteilte Strukturen.
Wurzeln werden an Ort und Stelle umgeschrieben, die Off-Heap-Liste wird
durchlaufen (Kopien in Listenreihenfolge neu eingehängt, tote Zellen
zerstört), und der alte Block und die Fragmente werden freigegeben. Ein Heap,
der nie alloziert wurde, wird nicht bereinigt. `CollectionStats` meldet die
Wörter davor, die lebenden Wörter, den neuen Heap-Block, die
zusammengeführten Fragmente, die Kapazität der Stack-Plätze und die
Off-Heap-Wörter.

## Kopieren zwischen Heaps

`ProcessHeap::add(value)`, gleichbedeutend `value.copy_to(heap)`, liefert einen
Term des Ziel-Heaps (step 28, BEAM `size_object` und `copy_struct`):

- Immediates und Atome derselben Runtime brauchen keinen Speicher, und ein Term
  des Ziel-Heaps behält seine Identität. Ein Graph eines anderen Prozesses
  derselben Runtime wird kopiert; der Graph einer anderen Runtime ist
  `wrong_owner`, eine abgelaufene Quelle `expired_context`, ein Quell-Handle,
  das älter als die letzte Bereinigung seines Heaps ist, `stale_term`.
  Fabriken weisen fremde Eingaben weiterhin zurück (`ProcessHeap::retain`),
  sodass nur eine explizite Kopie einen Graphen bewegt.
- Ein Durchlauf mit explizitem Stack (ohne Rekursion) findet jedes vom Wert aus
  erreichbare verschiedene Objekt, nach Adresse geschlüsselt, sodass interne
  Teilung erhalten bleibt: `{T, T}` kopiert `T` einmal, anders als ERTS'
  standardmäßiges `copy_struct`, das geteilte Strukturen abflacht. Die Kopie
  ist eine Reservierung der Summe ihrer Wörter, im Heap-Block oder in einem
  Fragment, gefüllt in Durchlaufreihenfolge mit auf die Kopien umgeschriebenen
  Zeigern.
- Die Kopie eines Off-Heap-binarys ist eine neue Zelle, die den Puffer teilt;
  das Ziel hält den Puffer (und belastet seine eigenen Off-Heap-Wörter, falls
  es nichts davon hielt), bevor es reserviert, und listet die Zelle erst,
  nachdem die Reservierung festgeschrieben ist.
- Die Quelle wird nur gelesen. Ein Fehlschlag (`resource_limit` für das Budget
  oder das Runtime-Limit des Ziels, `out_of_memory` für den Host) gibt die
  gehaltenen Puffer auf und rollt die Reservierung zurück, sodass beide Heaps
  und jede Belastung wie zuvor sind. Eine Kopie besitzt keinen Speicher der
  Quelle: sie überlebt die Bereinigung und den Abbau der Quelle.

## Messungen

`runtime_heap_measurements` (CTest im Vollmodus; Zahlen werden ausgegeben,
nicht geprüft) baut über `TermFactory` eine Liste von 100.000 Elementen aus
`{Index, Float}`-Tupeln, durchläuft sie über geprüfte Zugriffsfunktionen und
erzeugt 1.000 Kontexte, die je ein kleines Tupel halten. Seit 8I bereinigt er
außerdem mit der Liste als einziger Wurzel und durchläuft die Kopie.
Nebenbytes sind Host-Allokationen über den Heap-Speicher hinaus (vor 8D ein
Objektindex, seit 8G die Fragmentkette).

| Revision | Build | Kernel-Aufbau / Durchlauf | Heap belegt / Kapazität in Wörtern | Nebenbytes | Bytes pro Kontext | Heap-Wörter pro Kontext |
| --- | --- | --- | --- | --- | --- | --- |
| `bb09359` (Chunk-Liste, Objektindex) | Windows x64 Debug, clang-cl | 264 / 81 ms | 700.000 / 704.512 | 24.002.256 (etwa 80 pro Zelle) | 66.217 | 8.192 |
| 8D (Chunk-Liste, eigener Bereich) | Windows x64 Debug, clang-cl | 185 / 147 ms | 700.000 / 704.512 | 3.440 | 66.057 | 8.192 |
| 8G (Heap mit 233 Wörtern, etwa 3.000 Fragmente) | Windows x64 Debug, clang-cl | 219 / 174 ms | 700.000 / 706.223 | 163.878 | 2.377 | 233 |
| 8I, vor der Bereinigung | Windows x64 Debug, clang-cl | 216 / 173 ms | 700.000 / 706.223 | 163.878 | 2.377 | 233 |
| 8I, nach einer Bereinigung | Windows x64 Debug, clang-cl | Bereinigung 56 ms / Durchlauf 72 ms | 700.000 / 999.631 | 0 | — | — |

Gegenüber der Basis `bb09359`: die Nebenmetadaten pro Zelle sind
verschwunden (von 24 MB auf null nach einer Bereinigung), ein Kontext braucht
2,4 KB und 233 Heap-Wörter statt 66 KB und 8.192 Wörtern, der Aufbau ist etwa
20 % schneller, und der Durchlauf ist langsamer, bis eine Bereinigung die
Fragmente zusammenführt (die Fragmentzulassung ist eine binäre Suche über etwa
3.000 Bereiche); danach dauert der Durchlauf 72 ms. Eine lebende Menge von
700.000 Wörtern wird in etwa 56 ms in einen Block von 999.631 Wörtern
bereinigt, die ERTS-Größe, die sie unter 75 % hält.
