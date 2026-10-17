---
source: docs/runtime-heap.md
sourceCommit: a8c3f8f6
sourceSha256: cc0485350969c6f992d4987c8f893772eef2f3b1d7b9f3315e20c63541a45bc8
translatedAt: 2026-10-17
---
# Vertrag des Prozess-Heaps

Prozess-Heaps folgen dem klassischen ERTS-Design: ein zusammenhängender
Heap-Block pro Prozess plus Überlauffragmente, selbstbeschreibende Zellen,
große Binaries in geteilten Puffern außerhalb des Heaps und eine kopierende
Speicherbereinigung, die nur an Safepoints läuft. Diese Notiz ist der Vertrag;
[runtime.md](runtime.md#process-memory) fasst die Host-API zusammen.

## Wortlayout

Ein Term ist ein Zielwort (32 oder 64 Bits); die Kodierungen stehen in
[abi.md](abi.md#terms). Jeder Heap-Bereich ist eine Folge von Objekten, die ein
Walker ab ihrem ersten Wort parst:

- **Header-Wort** (primärer Tag `00`): Bits 2–6 enthalten die `BoxedKind`, Bits
  ab 7 die Anzahl der Wörter, die dem Header folgen. Ein geboxter Term zeigt
  auf seinen Header. Die Anzahl umfasst jedes Präfix-, Nutzdaten- und
  Füllwort, sodass der Walker nicht verfolgte Nutzdaten überspringt, ohne sie
  zu interpretieren. Sie hat 25 Bits auf 32-Bit-Zielen (höchstens 33.554.431
  Wörter) und 57 auf 64-Bit-Zielen (`BoxHeader::MAX_COUNT`): Die Grenze der
  Tupelstelligkeit (2^24 - 1) und das größte Bignum (131.072 Wörter auf 32 Bit)
  passen laut statischer Assertion, Maps prüfen sie beim Aufbau, und
  Cons-Zellen und Zellen fester Größe haben keine große Anzahl.
- **Cons-Zelle**: zwei Termwörter (Kopf, Rest) ohne Header. Ein Listenterm
  zeigt auf den Kopf. Ein Kopf ist nie ein Header, weil kein Term den Tag `00`
  hat.
- **Füllzelle**: Das Wort aus lauter Nullen (Art `tuple`, Anzahl 0) ist eine
  Füllzelle von einem Wort; die Art `filler` mit Anzahl n deckt n weitere
  Wörter ab. Reservierungen beginnen genullt, sodass reservierte, aber
  ungenutzte Wörter als Füllzellen geparst werden. Nichtleere Tupel haben immer
  eine Anzahl ungleich null, und `{}` ist ein Immediate.

Keine Zelle braucht eine stärkere Ausrichtung als ein Wort. `memory/heap_walk`
parst einen Bereich Zelle für Zelle, und `ProcessHeap::verify` prüft einen
ganzen Heap. Zellen enthalten nur Wörter und Bytes, außer dem
`std::shared_ptr` des Off-Heap-Binarys (unten), sodass eine Zelle durch
Kopieren ihrer Wörter verschoben wird.

| Art | Wörter nach dem Header | Verfolgte Wörter |
| --- | --- | --- |
| Cons (kein Header) | insgesamt 2 Wörter | Kopf, Rest |
| `tuple` | n Elementplätze | alle |
| `map` | 2n Plätze: Schlüssel in exakter Termordnung, jeweils gefolgt von ihrem Wert; höchstens 32 Einträge | alle |
| `tree_map` | Anzahl der Einträge, Bearbeitungswort, Wurzel-`map_node`: 3 Wörter ([Map-Bäume](#map-trees)) | die Wurzel |
| `map_node` | Einträge darunter, Bearbeitungswort, dann n Schlüssel und n Werte (ein Blatt) oder n Kinder (eine Verzweigung); nie ein Term | Schlüssel und Werte oder Kinder |
| `native_record` | Adresse der `RecordDefinition` der Runtime, dann n Feldwerte in Definitionsreihenfolge | Werte |
| `fun_closure` | Adresse der `FunDefinition` der Runtime, dann n erfasste Werte ([Funs](funs.md)) | Werte |
| `bignum` | Vorzeichenwort, dann Betragsglieder (limbs), niederwertigstes zuerst | keine |
| `floating` | 8 Bytes: 1 Wort (64 Bit) oder 2 Wörter (32 Bit) | keine |
| `reference` | 8 Bytes: die Referenznummer ([Pids und Referenzen](terms.md#pids-and-references)) | keine |
| `heap_binary` | Bitlänge, dann Datenbytes, auf Wörter aufgerundet (höchstens 64 Bytes) | keine |
| `refc_binary` | Bit-Offset, Bitlänge, das erste Byte des Puffers (von erzeugtem Code gelesen), Anhängeende und -grenze, `std::shared_ptr` (2 Wörter), Off-Heap-Verknüpfung: 8 Wörter | keine |
| `sub_binary` | Bit-Offset in das Original, Bitlänge, das ursprüngliche `heap_binary` oder `refc_binary` (nie ein Sub-Binary): 3 Wörter | das Original |
| `filler` | n ungenutzte Wörter | keine |

Die Anzahl bei `map` ist in Wörtern angegeben (Einträge = Anzahl / 2). Pids und
Ports sind Immediates und werden gegen die von der Runtime vergebenen Nummern
zugelassen.

## Off-Heap-Binaries

Ein Binary größer als 64 Bytes ist ein unveränderlicher Puffer, der außerhalb
jedes Prozess-Heaps liegt und per Referenzzählung geteilt wird (BEAM ProcBin und
`Binary`).

- Seine geboxte `refc_binary`-Zelle enthält einen `std::shared_ptr` auf den
  Puffer, einen Bit-Offset und eine Bitlänge. Ausschnitte eines großen Binarys
  (und Ausschnitte davon) sind `sub_binary`-Zellen, die die ursprüngliche Zelle
  benennen, wie es ERTS-Sub-Binaries tun: Ein Ausschnitt nimmt keine
  Pufferreferenz und hält das Original am Leben. Das Kopieren einer Zelle in
  einen anderen Prozess kopiert den `shared_ptr`
  ([Kopieren zwischen Heaps](#copying-between-heaps)), nie die Bytes.
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
  `static_assert` hält die Zellgröße bei beiden Wortbreiten auf acht Wörtern
  nach dem Header fest.

### Handle-Referenzen

Eine Handle-Referenz ist eine Referenz, die zusätzlich einen Off-Heap-Puffer
hält, so wie eine magische Referenz in OTP eine Ressource hält;
`atomics`-Arrays leben darin
([atomics und counters](builtins.md#atomics-and-counters)).

- Ihre Zelle hat die Art `reference` und das Layout von `refc_binary`: acht
  Wörter nach dem Header, die 64-Bit-Referenznummer in den Wörtern für Offset
  und Bitlänge (wo eine einfache Referenzzelle sie hält), dann der `shared_ptr`
  und das Verknüpfungswort. Jeder Referenzdienst liest nur die Nummer, daher
  wird sie wie eine einfache Referenz verglichen, gehasht, ausgegeben und
  kodiert.
- Sie wird genau wie eine Off-Heap-Binary-Zelle gelistet, verschoben,
  durchlaufen, angerechnet und kopiert (`layout::off_heap_cell`); ihr Puffer
  wird freigegeben, wenn die letzte Kopie der Referenz in irgendeinem Prozess
  stirbt.
- Eine prozessweite Registry bildet die Nummern lebender Handles auf ihre
  Puffer ab (schwache Referenzen), sodass `binary_to_term/1` eines kodierten
  Handles ein Handle neu aufbaut, das den Puffer teilt, solange er lebt, und
  danach eine einfache Referenz. Abgelaufene Einträge werden verworfen, während
  die Registry wächst.

## Map-Bäume

Eine Map mit mehr als 32 Einträgen (`MAP_SMALL_MAP_LIMIT` von OTP) ist ein
4-Wort-Stub `tree_map`, der die Wurzel eines persistenten B+-Baums benennt
(`terms/map_tree`), dessen Knoten `map_node`-Zellen desselben Heaps sind, so
wie OTP seine HAMT-Knoten auf dem Heap hält. Kleinere Maps bleiben
`map`-Zellen.

- Blätter halten bis zu 16 Schlüssel- und Wertwörter in exakter
  Schlüsselreihenfolge; Verzweigungen halten bis zu 16 Kinder mit ihren ersten
  Schlüsseln, und jeder Knoten zählt die Einträge unter sich, sodass Lookup und
  Zugriff nach Position O(log n) sind. Jeder Knoten außer der Wurzel ist
  mindestens halb voll.
- Eine Aktualisierung kopiert den Pfad zum geänderten Blatt (etwa 35 Wörter pro
  Ebene) und teilt jeden anderen Knoten mit der Quell-Map, die unverändert
  bleibt, sodass der Aufbau einer Map Schlüssel für Schlüssel O(n log n) statt
  O(n^2) kostet. Sie zählt zuerst die Wörter des Pfads und alloziert sie auf
  einmal; eine gescheiterte Aktualisierung rollt sie zurück.
- Knoten sind gewöhnliche Zellen: Bereinigungen verschieben, befördern und
  geben sie frei, tote Versionen kosten nichts, und sie zählen in
  `heap_size`, nicht als Off-Heap-Wörter. Das Kopieren einer Map in einen
  anderen Heap (Nachrichten) kopiert ihre Knoten wie beliebige Zellen.
- Jeder Stub und jeder Knoten trägt ein Bearbeitungswort: das Token der
  Aktualisierung, die ihn erzeugt hat, oberhalb eines Blatt-Bits. Knoten mit
  dem eigenen Token der Aktualisierung ändern sich an Ort und Stelle (eine
  Aktualisierung mehrerer Schlüssel schreibt jeden Knoten einmal). Vor der
  letzten Bereinigung ausgegebene Tokens erlauben keine Änderung an Ort und
  Stelle, da die Bereinigung die Knoten befördert haben kann, und eine Kopie in
  einen anderen Heap löscht das Token.
- Eine besitzende Aktualisierung (`MapOperation::update_owned`), deren Quelle
  laut Nachweis des Compilers danach nicht mehr gelesen wird, verbraucht den
  Quell-Stub (Wurzel `[]`, Größe 0) und verwendet sein Token wieder, solange es
  aktuell ist, sodass sie die Knoten, die die eigene Aktualisierung der Quelle
  erzeugt hat, an Ort und Stelle ändert und den Rest des Pfads kopiert. Eine
  gescheiterte besitzende Aktualisierung gibt dem Stub den Baum zurück. Der
  Compiler markiert eine Aktualisierung nur dann als besitzend, wenn die
  Funktion die Quell-Map selbst gebaut hat (`M = <map expression or
  comprehension>` im selben Klauselrumpf), `M` nirgends sonst liest und nie in
  einer Fun erfasst (`semantic/map_ownership`).

## Bereiche

- **Heap.** Ein Block `[start, top, end)` pro Prozess mit Bump-Allokation. Er
  wird durch die erste Allokation des Prozesses erzeugt, mit der Größe
  `max(min_heap_words, request)`, damit diese Anforderung immer passt
  (Fragmente beginnen beim Minimum, höchstens 233 Wörter, und wachsen dann,
  siehe unten), und gehört allein diesem Prozess. Erzeugter Code legt darin
  kleine Tupel, Listen, Gleitkommazahlen und Closures direkt über
  `FrameState::heap_top`/`heap_limit` per Bump-Allokation an:
  `HeapStorage::absorb` übernimmt diese Wörter vor jeder Heap-Operation
  (Reservierung, Zulassung, Bereinigung, Verifikation, Nutzungsabfragen) in den
  `top` und `used_words_`, und `expose` zeigt die freien Wörter danach wieder.
  Inline-Allokation erzeugt nie ein Fragment und bleibt unter einem
  prozesseigenen Budget aus. Sobald der Block weniger als 64 freie Wörter hat,
  zeigt `expose` stattdessen das neueste eigene Fragment des Prozesses (nie
  einen übernommenen Nachrichtenblock), sodass die Allokation zwischen zwei
  Safepoints, etwa bei den Rückkehrpunkten einer Rumpfrekursion, inline bleibt,
  nachdem sich das erste Fragment öffnet (Fragmentfenster). Ohne Budget ist
  jedes neue Fragment mindestens so groß wie die Fragmente davor.
- **Literalbereiche.** Die zusammengesetzten Literale jedes Moduls — Strings
  und konstante Listen, Tupel aus Konstanten, Gleitkommazahlen,
  Bignum-Literale und konstante Binaries — werden vom Compiler als Heap-Zellen
  in einer schreibgeschützten globalen Variablen
  (`ModuleDescriptor::literals`) angelegt und bei der Registrierung des Moduls
  runtime-weit registriert (`detail::LiteralAreas`, ein sperrfreier sortierter
  Schnappschuss). Terme jedes Prozesses dürfen darauf zeigen: Die Zulassung und
  `TermAccess::object` lesen Zellen über `HeapStorage::readable` (Heap,
  Fragmente, dann Literale); die Speicherbereinigung lässt Literalwörter, wie
  sie sind (`owned` bleibt nur für den Heap); Kopien zwischen Heaps und in
  Nachrichtenpuffer zeigen weiter darauf (eine Literalwurzel braucht keine
  Kopie); der Verifizierer akzeptiert sie. Literale halten nur Immediates (nur
  feste Atome) und Wörter anderer Literale.
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
- **Stack.** Erzeugte Frames liegen auf einem flachen Stack pro Prozess,
  getrennt vom Heap (`ProcessStack`,
  [Ausführungsmodell](execution-model.md#implementation)). Standardmäßig hat er
  keine Obergrenze; ein optionales prozesseigenes `StackOptions::limit_words`
  begrenzt ihn getrennt vom Heap.
- **Off-Heap-Liste.** Wie oben.
- **Alter Bereich.** Objekte, die zwei Bereinigungen überlebt haben
  ([Generationen](#generations)); kleine Bereinigungen lassen ihn, wo er ist,
  ein vollständiger Durchlauf kopiert ihn in den neuen Block und gibt ihn frei.

## Dimensionierung und Budget

- `min_heap_words` ist die `min_heap_size` des Prozesses: standardmäßig 233
  Wörter (wie ERTS), `--min-heap-size` für jeden Prozess (ERTS `+hms`),
  `{min_heap_size, N}` in `spawn_opt` oder `process_flag(min_heap_size, N)` für
  einen einzelnen; eine Einstellung wird auf eine Heap-Größe aufgerundet und
  liegt nie unter dem Standard der Runtime, und `process_flag` wirkt ab der
  nächsten Bereinigung. Da kein Block kleiner ist, bereinigt ein Prozess nicht,
  bevor er so viele Wörter alloziert hat.
- Der Heap beginnt bei `min_heap_words` und wächst entlang der
  ERTS-Größenfolge: 12, 38, dann ist jede Größe die Summe der beiden vorherigen
  plus eins bis 833.026 Wörter, danach Schritte von 20 %
  (`heap_size_at_least`).
- Der neue Block einer Bereinigung ist die kleinste solche Größe, bei der die
  Wörter, die er aufnehmen kann, unter 75 % davon bleiben: zunächst alle
  benutzten Wörter, da lebende Daten vor dem Kopieren nicht bekannt sind. Ein
  Ergebnis mit weniger als 25 % lebenden Daten wird noch einmal in die Größe
  kopiert, die seine lebenden Daten brauchen; scheitert die Allokation dieses
  Blocks, bleibt der größere erhalten. Keiner ist kleiner als
  `min_heap_words`. Beide Größen zählen die Wörter des Prozess-Stacks als
  lebend, da ERTS den Stack innerhalb des Heap-Blocks hält.
- Mit gesetztem Budget (unten) enthält ein neuer Block höchstens seine
  lebenden Wörter plus die Hälfte des Budgets, das nach ihnen und den
  Off-Heap-Puffern übrig bleibt (`block_limit`), nie weniger als
  `min_heap_words`. Die andere Hälfte bleibt frei für Fragmente und neue
  Off-Heap-Puffer, sodass nach einer Bereinigung allozierter Müll den nächsten
  Safepoint als Auslöser erreicht, statt das Budget zu erschöpfen. Die erste
  Kopie wird aus allen benutzten Wörtern dimensioniert, sodass ein Block über
  dem Limit für die überlebenden Wörter noch einmal in seine Richtliniengröße
  kopiert wird.
- Standardmäßig gibt es keine Speicherobergrenze, weder pro Prozess noch für
  die Runtime: Der Heap wächst, bis der Host Speicher verweigert
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

## Heap-Blöcke

Heap-Blöcke, Fragmente und alte Bereiche stammen aus `memory/heap_blocks`. Ein
Block, den eine Bereinigung freigibt, bleibt für die nächsten Bereinigungen
dieses Threads bei seinem Thread (so wie die Carrier von ERTS Speicher
behalten): Ein neuer Block nimmt den kleinsten zwischengespeicherten Block, der
mindestens seine Größe und höchstens das Doppelte davon hat, sonst frischen
Speicher. Jeder Thread behält höchstens 8 Blöcke und 4M Wörter (32 MB auf
64-Bit-Zielen); Blöcke unter 4.096 Wörtern werden nicht behalten, da die
Freilisten des C++-Heaps sie günstig bedienen. Ohne dies nahm der Zielbereich
(to-space) jeder Bereinigung frische Seiten vom Betriebssystem und zahlte einen
Seitenfehler pro berührter Seite, und das Freigeben eines großen Blocks gab
seine Seiten zurück. Zwischengespeicherte Blöcke werden keinem Prozess und
nicht dem runtime-weiten Konto angerechnet; ein Thread gibt seinen Cache frei,
wenn er endet.

## Runtime-Speicherlimit

- Ein optionales runtime-weites Limit, `RuntimeOptions::memory_limit_bytes`
  (Standard `UNLIMITED_HEAP_BYTES`; Programme setzen es mit `--max-memory`),
  begrenzt den Speicher aller Prozesse zusammen: Heap-Blöcke, Fragmente,
  Off-Heap-Puffer und Stack-Kapazität. OTP hat kein solches Limit; am nächsten
  kommt dem das Ausführen der VM unter einem Speicherlimit des
  Betriebssystems, aber hier scheitert ein Prozess statt des Knotens.
- Ein Konto pro Runtime (`detail::RuntimeMemory`, geteilt von jedem
  Heap-Speicher und Stack) wird belastet, wenn ein Block, ein Fragment, ein
  Off-Heap-Puffer oder Stack-Kapazität erzeugt wird, und entlastet, wenn er
  verworfen wird; ein von mehreren Prozessen geteilter Puffer wird einmal
  belastet und entlastet, wenn seine letzte Referenz stirbt. Der Abbau gibt
  jede Belastung des Prozesses zurück. `Runtime::memory_bytes()` meldet die
  Summe.
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
gibt keine inneren Zeiger zu erkennen. Die Zulassung (admission) ist eine
Besitzprüfung für Wörter, die an einen Prozess zurückgegeben werden:

1. Die Adresse ist wortausgerichtet innerhalb eines der Bereiche des Prozesses,
   unterhalb seines `top`: Zuerst wird der Heap-Block geprüft, dann die nach
   Adresse sortierten Fragmente, dann die Literalbereiche
   ([Bereiche](#areas)). Fremde und veraltete Wörter scheitern hier ohne jeden
   Ladezugriff.
2. Ein geboxtes Wort benennt einen Header einer zugelassenen Art (keine
   Füllzelle); ein Listenwort benennt eine Cons-Zelle (ein Wort, das kein
   Header ist).

Zugriffsfunktionen dekodieren Art, Anzahl und Nutzdaten aus dem Header selbst.
`verify()` bleibt für Tests die vollständige Prüfung, dass jeder Platz einen
Objektanfang benennt.

## Wurzeln und Safepoints

`ProcessContext::visit_roots` zählt jedes Wurzelwort für die
Speicherbereinigung auf. An einem Safepoint hält nichts anderes Heap-Wörter
des Prozesses:

| Besitzer | Wurzelwörter | Anmerkungen |
| --- | --- | --- |
| Termplätze der Frames | Die ersten `roots` Plätze jedes Frames auf dem Stack | Unterste Frames haben keine; Fortsetzungs- und Handler-Indizes sind Ganzzahlen |
| Rohe Frame-Plätze | Keine | Ausgelagerte native Werte; erzeugter Code hält dort an einem Safepoint kein Heap-Wort ([Neuladeregel](#reload-rule)) |
| Register | `x[0..live)` (`ProcessStack::keep_registers`) | Die Argumente eines suspendierten Eintritts; jedes Push und Pop leert `live` |
| Fehlerkanal | Fehler-Nutzdaten (BEAM `fvalue`), Argumentliste von `erlang:error/2,3`, Stacktrace-Term | Werden an Ort und Stelle neu gebunden; erfasste Trace-Frames sind Deskriptorzeiger in den Code |
| Trap-Zustand | Die Termwörter des `TrapState` eines trappenden Builtins ([Portionen](builtins.md#portions)) | Freigegeben, wenn das Builtin endet oder scheitert |
| Prozess-Dictionary | Jeder Schlüssel und Wert | Bis zum Löschen oder Ende des Prozesses |
| Mailbox | Jede Nachricht im Signal-Eingang und in der Nachrichtenwarteschlange, einschließlich `'EXIT'`- und `'DOWN'`-Nachrichten | Bis ein receive sie entnimmt; an Ort und Stelle umgeschrieben, sodass der receive-Cursor (eine Listenposition) und die Timeout-Frist gültig bleiben |
| Explizite Wurzeln | Der Bereich, den ein Host an `collect(roots)` übergibt | Nach dem Aufruf zurückgelesen |
| Off-Heap-Liste | Keine | Verknüpfungen werden durchlaufen und neu eingehängt, nicht verfolgt |

Keine Heap-Zelle hält einen Pin. Atome sind Immediates, und die Atomtabelle wird
nie bereinigt. Fun-Zellen benennen Code über ihre nicht verfolgte
`FunDefinition`, die so lange lebt wie die Runtime; geladene Module werden nie
entladen, daher brauchen weder Funs noch Trace-Deskriptoren einen Pin. Kleine
Immediates sind keine Wurzeln.

Wie im C-Code von ERTS ist ein Host-`Term` ein rohes getaggtes Wort, gültig bis
zum nächsten Safepoint seines Heaps; er pinnt keinen Heap-Speicher
([Besitz](terms.md#ownership)). Ein `Term` ist nur innerhalb seines eigenen
Prozesses gültig; andere Prozesse dürfen ihn nur lesen.

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
Heap nie: Eine Anforderung, die nicht passt, erzeugt ein Fragment.

## Nachrichtenpuffer

Ein `MessageBuffer`
([message_buffer.hpp](../runtime/src/memory/message_buffer.hpp)) hält einen
Term außerhalb jedes Prozesses: `copy_of` kopiert den Graphen aus seinem
Prozess-Heap in einen eigenen `HeapStorage` (eigenes Lebensdauer-Token, die
Atome und das Speicherkonto der Runtime, Off-Heap-Binaries geteilt und
gehalten), mit derselben `GraphCopy`, die ein Senden verwendet; `copy_to`
kopiert ihn in den Heap eines Empfängers. Immediates brauchen keinen Speicher.
Der Puffer wird nie bereinigt und mit seinem letzten Besitzer freigegeben; sein
Block umfasst genau die Wörter des Terms, unabhängig vom Mindest-Heap des
Senders. Nachrichten an einen Prozess, der auf einem anderen Worker läuft
([Worker](processes.md#workers)), Timer-Nachrichten, Monitor-Tags und
[persistente Terme](runtime.md#persistent-terms) verwenden ihn, sodass sie nie
neu kodiert werden.

**Nachrichtenübergabe.** Ein Senden, dessen Nachricht mindestens
`MessageBuffer::ADOPTED_WORDS` (512) Wörter umfasst, gezählt durch einen
begrenzten Durchlauf, der dort stoppt, baut den Puffer, bevor es die Sperre des
Executors nimmt, sodass der Sender beim Kopieren keine Sperre hält. Der
Empfänger übernimmt den Puffer dann, statt ihn zu kopieren
(`MessageBuffer::take`, `HeapStorage::adopt`), wenn der Puffer keinen anderen
Besitzer hat und der Empfänger einen Heap-Block und kein Budget hat: Der Block
kommt an denselben Adressen zu seinen Fragmenten, die Off-Heap-Binary- und
Map-Listen des Puffers kommen samt ihrer Anrechnungen zu seinen eigenen, und
der Puffer bleibt leer zurück. Niemand sonst kann den Block vorher oder nachher
erreichen, daher wird kein Wort zweimal kopiert. Übernommene Fragmente fordern
erst dann eine Bereinigung an, wenn ihre Wörter die des jungen Blocks
erreichen, wie es die Nachrichtenfragmente von ERTS tun, und die nächste
Bereinigung behandelt sie als junge Daten. Kleinere Nachrichten werden wie
bisher kopiert: günstiger als je ein Fragment.

## Bereinigung in erzeugtem Code

Erzeugter Code bereinigt nur an wenigen **Safepoints**, an denen jeder lebende
Term bereits in einer Wurzel liegt. Alles andere, einschließlich jedes
allozierenden Dienstes, ist ein **kritischer Abschnitt**, der den Heap nie
bewegt.

### Auslöser

Ein Safepoint bereinigt, wenn der Heap danach verlangt
(`wants_collection()`); andernfalls kostet er eine Prüfung.

| Auslöser | Bedingung am Safepoint | Gegenstück in ERTS |
| --- | --- | --- |
| Heap voll | Es existiert ein Fragment: Seit der letzten Bereinigung passte eine Allokation nicht in den Heap-Block | Heap-Top erreicht das Heap-Ende |
| Druck durch Off-Heap-Binaries (eine kleine Bereinigung, außer die letzte hat weniger als die Hälfte freigegeben, [Binary-Druck](#generations)) | Off-Heap-Wörter erreichen das Limit des virtuellen Binary-Heaps: anfangs 46.422 Wörter, nach jeder Bereinigung das Doppelte der überlebenden Off-Heap-Wörter oder die Überlebenden plus die lebenden Heap-Wörter, je nachdem, was größer ist (nie weniger als 46.422), aber höchstens die Überlebenden plus die Hälfte des nach dem Heap-Block frei verbleibenden Budgets | `bin_vheap_sz` / virtueller Binary-Heap |
| `erlang:garbage_collect/0,1,2` | Eine Anforderung des Builtins ([Introspektion](processes.md#introspection)), ausgeführt am nächsten Safepoint des Ziels | Expliziter vollständiger Durchlauf |

Ein Safepoint führt eine **kleine Bereinigung** (minor collection) aus, außer
ein vollständiger Durchlauf ist fällig: eine `garbage_collect`-Anforderung,
Druck durch Off-Heap-Binaries, ein Heap-Budget oder ein alter Bereich ohne
Platz für die reifen Wörter ([Generationen](#generations)). Das öffentliche
`ProcessHeap::collect` ist immer ein vollständiger Durchlauf.

Der neue Block wird für die lebenden Wörter **plus die benutzten Stack-Wörter**
dimensioniert (ERTS hält den Stack innerhalb des Heap-Blocks): Ein tiefer Stack
bekommt einen größeren Heap, sodass eine lange Rekursion proportional zu ihrer
Allokation bereinigt, statt alle paar hundert Wörter den ganzen Stack erneut zu
durchsuchen.

### Safepoints

| Punkt | Wo | Lebend außerhalb der Termplätze der Frames |
| --- | --- | --- |
| Funktionseintritt | In `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (und damit beim Host-Aufruf), bevor der Frame des Aufgerufenen abgelegt wird; ein Inline-Eintritt nimmt diesen Weg, wann immer der Heap eine Bereinigung will | Die Argumente des Aufgerufenen `x[0..arity)`, als Wurzeln gehalten (`keep_registers`) |
| Schleifenkopf | `CLAUSE_safepoint_v1(context)` am Kopf jeder Generatorschleife einer Comprehension, nur aufgerufen, solange der Heap eine Bereinigung will | Nichts |

Jede Erlang-Schleife ist entweder eine Rekursion, die pro Schritt einen
Funktionseintritt passiert, oder eine Comprehension, die ihren Schleifenkopf
passiert, sodass der Müll zwischen zwei Safepoints durch geradlinigen Code und
einzelne Dienstergebnisse begrenzt ist.

Keine Safepoints (kritische Abschnitte, die weiter in Fragmente allozieren):
jeder andere Runtime-Dienst, einschließlich Allokations-, Konstruktions- und
Matching-Diensten; `CLAUSE_return_v1`; Ausnahmeweitergabe; und
Nachrichtenzustellung. Dienste dürfen daher während ihres gesamten Laufs rohe
Heap-Wörter in C++ halten, und ihre Eingabearrays und Ausgaben müssen nicht
neu geladen werden.

### Wartende und suspendierte Prozesse

Ein Prozess, der nicht läuft, wird nie bereinigt: Er wartet in einem receive,
ist nach einem Yield oder Trap eingereiht oder noch nicht gestartet, und alles,
was er hält, ist bereits eine Wurzel (seine Frames, die Register des Eintritts
oder der Fortsetzung, an dem bzw. der er fortfährt, der Trap-Zustand und seine
Nachrichten). An ihn gesendete Nachrichten werden in Fragmente seines Heaps
kopiert. Jede Zustellung weckt einen wartenden Prozess, und seine Fortsetzung
wiederholt den Eintritt seiner Fortsetzung (das Warte-Builtin, eine
Trap-Fortsetzung oder die Funktion, an der er per Yield abgegeben hat), was ein
Safepoint beim Funktionseintritt ist: Das Erste, was ein fortgesetzter Prozess
tut, ist zu bereinigen, wenn sein Heap danach verlangt. Ein Prozess, der in
einem selektiven receive wartet, das viele Nachrichten überspringt, bereinigt
daher, während sie eintreffen, so wie ERTS einen Prozess bereinigt, wenn er das
nächste Mal eingeplant wird. Das Golden `executables_mailbox_collection` deckt
Horten, Warten mit Timeout, tiefe Rekursion unter Nachrichtenlast und einen
Konsumenten ab, der 3.000 Nachrichten innerhalb von `--max-heap 65536`
bestätigt.

Allokation ist kein Safepoint (anders als `test_heap` von BEAM): Das würde
erfordern, dass jede Diensteingabe und jeder über eine Allokation hinweg
lebende SSA-Term in einer Wurzel liegt, ein Neuladen nach jedem allozierenden
Dienst und ein Wiederholungsprotokoll in jedem Dienst, während die beiden
obigen Safepoints den Müll bereits begrenzen.

### Neuladeregel

Kein SSA-Wert (ein Wert in einem nativen Register) hält ein Heap-Wort über
einen Safepoint hinweg, und kein nativer Zeiger überquert überhaupt einen
(bereits ein Fehler in `lower_frames`).

- `lower_frames` behandelt einen Safepoint-Aufruf am Schleifenkopf wie den
  Fortsetzungspunkt eines Aufrufs: Es teilt den Block nach dem Aufruf und
  lagert jeden Wert aus (spill), der danach gelesen und davor berechnet wird.
  Ein **Termwert** (ein Ladezugriff aus einem Termplatz oder einem Register,
  ein in einen Termplatz gespeicherter Wert oder ein PHI solcher Werte) wird
  nach seiner Definition in seinen bestehenden Termplatz oder einen neuen, in
  `roots` des Deskriptors gezählten Termplatz gespeichert und vor jeder
  Verwendung neu geladen. Andere Wörter (kleine Immediates, Atome, rohe
  Ganzzahlen, Flags) behalten rohe Plätze: Eine Bereinigung ändert sie nie.
- Aufrufe lagern auf dieselbe Weise aus und laden neu, Terme in Termplätze,
  sodass der Safepoint beim Eintritt jeden lebenden Term jedes Aufrufers sieht.
- Die Frame-Basis bleibt über einen Safepoint am Schleifenkopf hinweg gültig,
  weil eine Bereinigung Stack-Wörter an Ort und Stelle umschreibt und den Stack
  nie bewegt; jede Übergabe liest sie wie zuvor im Prolog des Rumpfes neu.
- Die Optimierung läuft nach `lower_frames` und kann ein Neuladen nicht durch
  den älteren SSA-Wert ersetzen: Die Frame-Adresse wird aus dem `FrameState`
  des Kontexts geladen, und der opake Safepoint-Aufruf darf darüber jeden Platz
  schreiben ([Prototyp](#prototype)).

### Fehlerverhalten

- Eine Bereinigung an einem Safepoint verzeichnet nie einen Fehler. Kann ihr
  neuer Block nicht alloziert werden (`out_of_memory`), bleibt der Heap, wie er
  ist, und die Ausführung fährt mit Fragmenten fort.
- **Speichererschöpfung.** Ohne Obergrenze geht der Speicher nur aus, wenn der
  Host einen Heap-Block, ein Fragment, einen Off-Heap-Puffer oder
  Stack-Wachstum verweigert: `out_of_memory`. Mit gesetztem optionalem Budget
  oder [runtime-weitem Limit](#runtime-memory-limit) ist eine Anforderung
  darüber hinaus `limit_exceeded`, gemeldet als `resource_limit`. Beides sind
  Infrastrukturfehler: Kein Handler läuft, die Frames werden bis zum untersten
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

- `ProcessStack::safepoint(live)` fragt `ProcessHeap::wants_collection()` (ein
  Fragment existiert, Off-Heap-Wörter haben `binary_limit_words_` erreicht oder
  eine Bereinigung wurde angefordert), hält `x[0..live)` als Wurzeln, öffnet
  einen `SafePoint` und bereinigt; eine gescheiterte Bereinigung wird
  ignoriert. `enter` (und damit `tail` und `invoke`) ruft es vor dem Ablegen
  mit der Stelligkeit des Aufgerufenen auf; `CLAUSE_safepoint_v1` ruft es mit 0
  auf.
- Das Lowering von Comprehensions erzeugt die Prüfung am Schleifenkopf am Kopf
  jeder Generatorschleife (`lowering_comprehensions`).
- `lower_frames` teilt jeden Rumpf nach einem Safepoint-Aufruf und lagert
  überquerende Werte aus wie nach einem Aufruf. Argumente kommen in Registern
  an und werden beim Eintritt nicht gespeichert: Ein Argument, das einen Aufruf
  oder Safepoint überquert, wird nach seiner Ankunft in seinen eigenen
  Argumentplatz gespeichert. `home()` behält den Argumentplatz oder einen
  Termplatz desselben Blocks, wenn einer den Wert enthält; andernfalls bekommt
  ein Termwert (`term_value`: aus einem Termplatz oder Register geladen, in
  einen Termplatz gespeichert oder ein PHI davon) einen neuen Termplatz, den
  `place_slots` an die führenden Termplätze vor den rohen Plätzen anhängt, und
  jeder andere Wert einen rohen Platz.
- `collected_size` begrenzt den Block auf `block_limit(live)`; `shrink` läuft
  auch, wenn der Block das Limit der überlebenden Wörter überschreitet;
  `collect` begrenzt `binary_limit_words_` auf die Überlebenden plus die Hälfte
  des nach dem Block frei verbleibenden Budgets.
- Abdeckung: die OTP-Goldens `executables_garbage_collection` (mehr als 64 MiB
  alloziert bei kleiner lebender Menge: Endaufruf-Schleifen,
  Off-Heap-Binaries, allozierende Filter von Comprehensions, tiefe
  Rumpfrekursion, gefangene Fehler-Nutzdaten; mit begrenzten Läufen unter
  `--max-heap`, `--max-stack` und `--max-memory`) und
  `executables_heap_growth` (72 MB behaltene Binaries); `runtime_collection`
  `near_budget` und `shared_limit` prüfen das Budget und das runtime-weite
  Limit.

### Prototyp

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) enthält eine
Schleife im Stil einer Comprehension in der Form nach `lower_frames`
(`loop.ll`): Ein vor der Schleife berechneter Term `Y` wird in einen Termplatz
gespeichert und nach dem Safepoint am Schleifenkopf neu geladen.
`python tests/prototypes/safepoint/run.py` kompiliert ihn für
`x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu`, `i686-pc-windows-msvc`
und `armv7-unknown-linux-gnueabihf` bei O0 und O2 und prüft, dass auf den
Safepoint-Aufruf ein Ladezugriff auf das Frame-Wort von `Y` folgt, sodass der
Optimierer nie das Register wiederverwendet, das `Y` enthielt.

## Speicherbereinigung

Eine Cheney-Kopie (`memory/heap_collect`), ein vollständiger Durchlauf oder eine
kleine Bereinigung ([Generationen](#generations)): Zuerst wird der neue Block
alloziert (ein Fehlschlag ist `out_of_memory` und lässt den Heap unberührt),
dann werden Host-`Term`s als veraltet markiert, das Objekt hinter jedem
Wurzelwort kopiert und der neue Block von links nach rechts durchsucht, wobei
die Kinder jeder Kopie kopiert werden. Der Header eines verschobenen geboxten
Objekts wird durch einen geboxten Zeiger auf seine Kopie ersetzt; eine
verschobene Cons-Zelle bekommt einen Null-Kopf und einen Rest, der auf ihre
Kopie zeigt. Die Weiterleitung erhält geteilte Strukturen. Wurzeln werden an
Ort und Stelle umgeschrieben, die Off-Heap-Liste wird durchlaufen (Kopien in
Listenreihenfolge neu eingehängt, tote Zellen zerstört), und der alte Block und
die Fragmente werden freigegeben. Ein Heap, der nie alloziert wurde, wird nicht
bereinigt. `CollectionStats` meldet die Wörter davor, die lebenden Wörter, den
neuen Heap-Block, die zusammengeführten Fragmente, die Kapazität der
Stack-Plätze und die Off-Heap-Wörter.

## Generationen

Generationelle Bereinigung, wie ERTS sie durchführt, ohne deren Schreibbarriere:

- **Hochwassermarke.** Nach einer Bereinigung hat jedes Objekt im neuen Block
  eine überlebt; der `top` des Blocks wird zur Hochwassermarke. Die nächste
  kleine Bereinigung kopiert den jungen Block und die Fragmente, wobei sie
  Objekte unterhalb der Marke in den alten Bereich **befördert** und den Rest in
  einen neuen jungen Block.
- **Alter Bereich.** Ein Block, der sich zwischen vollständigen Durchläufen nie
  bewegt; eine kleine Bereinigung kopiert und durchsucht ihn weder. Er wird von
  der ersten kleinen Bereinigung erzeugt, die befördert, mit der doppelten
  Größe der reifen Wörter. Kann er die reifen Wörter nicht aufnehmen, führt der
  Safepoint stattdessen einen vollständigen Durchlauf aus, der alles im neuen
  Block unterhalb seiner Hochwassermarke lässt und den alten Bereich freigibt.
- **Invariante.** Ein unveränderliches Objekt zeigt nur auf Objekte, die älter
  sind als es selbst, daher lässt das Befördern nach Adresse nie ein altes
  Objekt auf ein junges zeigen. Die Schreibvorgänge der Runtime an Ort und
  Stelle wahren das: Binary-Schleifen und anhängbare Binaries schreiben
  Ganzzahlen, und eine Map-Aktualisierung ändert an Ort und Stelle nur Knoten,
  die seit der letzten Bereinigung erzeugt wurden. Debug-Builds prüfen nach
  jeder kleinen Bereinigung, dass kein altes Objekt in den jungen Block oder
  ein Fragment zeigt.
- **Durchläufe.** Die Off-Heap-Binary-Liste behält Zellen des alten Bereichs,
  hängt weitergeleitete neu ein und gibt tote junge frei; tote alte Zellen
  warten auf den nächsten vollständigen Durchlauf.
- **Dimensionierung des jungen Blocks.** Eine kleine Bereinigung behält die
  Größe des jungen Blocks bei, wie ERTS, und mindestens ein Achtel des alten
  Bereichs (ERTS). Erzeugter Code bereinigt nur an Safepoints, daher kann die
  Allokation zwischen zwei davon (die Rückkehrpunkte einer Rumpfrekursion) weit
  in Fragmente überlaufen; halten diese ein Viertel des Blocks oder mehr,
  wächst der nächste Block um sie und wird nicht verkleinert. Andernfalls wird
  ein junger Block über 8.000 Wörtern mit weniger als 25 % lebenden Daten in
  das Dreifache seiner lebenden Wörter kopiert (die Regel von ERTS für kleine
  Bereinigungen).
- **Off-Heap-Limit.** Nach einer kleinen Bereinigung zählt das Limit des
  virtuellen Binary-Heaps nur die jungen lebenden Wörter: Der alte Bereich kann
  tote Wörter enthalten, die den vollständigen Durchlauf, der tote alte
  Binaries freigibt, nicht hinauszögern dürfen.
- **Binary-Druck.** Das Erreichen des Limits bereinigt die junge Generation,
  wie es der virtuelle Binary-Heap von ERTS tut, was die Binaries toter junger
  Zellen freigibt. Gibt eine solche kleine Bereinigung weniger als die Hälfte
  der Off-Heap-Wörter frei, ist die nächste wegen Binary-Druck ein
  vollständiger Durchlauf, der auch die Binaries toter alter Zellen freigibt
  (`binary_sweep_due_`).

## Kopieren zwischen Heaps

`ProcessHeap::add(value)`, gleichbedeutend `value.copy_to(heap)`, liefert einen
Term des Ziel-Heaps (BEAM `size_object` und `copy_struct`). Jede Quellzelle
wird zuerst im Bereich der vorherigen gesucht, und eine Cons-Zelle muss nicht
geparst werden:

- Immediates und Atome derselben Runtime brauchen keinen Speicher, und ein Term
  des Ziel-Heaps behält seine Identität. Ein Graph eines anderen Prozesses
  derselben Runtime wird kopiert; der Graph einer anderen Runtime ist
  `wrong_owner`, eine abgelaufene Quelle `expired_context`, ein Quell-Handle,
  das älter als die letzte Bereinigung seines Heaps ist, `stale_term`.
  Fabriken weisen fremde Eingaben weiterhin zurück (`ProcessHeap::retain`),
  sodass nur eine explizite Kopie einen Graphen bewegt.
- Kopien sind flach, wie das standardmäßige `copy_struct` von ERTS (ohne seine
  optionale Variante, die Teilung erhält): Ein Teilterm wird pro Erreichen
  einmal kopiert, sodass `{T, T}` `T` zweimal kopiert, und ein Term, dessen
  Teilung sich auf jeder Ebene verdoppelt, wächst exponentiell, wie bei OTP. Ein
  Durchlauf mit explizitem Stack (ohne Rekursion) summiert die Wörter jedes
  erreichten Objekts; die Kopie ist eine Reservierung dieser Summe, im
  Heap-Block oder in einem Fragment, gefüllt durch einen zweiten Durchlauf in
  derselben Reihenfolge, der jede Zelle erneut liest und jeden Platz auf die
  Kopie seines Kindes zeigen lässt. Keine Tabelle bildet Quellobjekte auf
  Kopien ab, und nur Binary-Zellen und Map-Stubs behalten ihre Offsets.
- Die Kopie eines Off-Heap-Binarys ist eine neue Zelle, die den Puffer teilt;
  das Ziel hält den Puffer (und belastet seine eigenen Off-Heap-Wörter, falls
  es nichts davon hielt), bevor es reserviert, und listet die Zelle erst,
  nachdem die Reservierung festgeschrieben ist.
- Die Quelle wird nur gelesen. Ein Fehlschlag (`resource_limit` für das Budget
  oder das Runtime-Limit des Ziels, `out_of_memory` für den Host) gibt die
  gehaltenen Puffer auf und rollt die Reservierung zurück, sodass beide Heaps
  und jede Belastung wie zuvor sind. Eine Kopie besitzt keinen Speicher der
  Quelle: Sie überlebt die Bereinigung und den Abbau der Quelle.

## Messungen

`runtime_heap_measurements` (CTest im Vollmodus; Zahlen werden ausgegeben,
nicht geprüft) baut über `TermFactory` eine Liste von 100.000 Elementen aus
`{Index, Float}`-Tupeln, durchläuft sie über geprüfte Zugriffsfunktionen,
bereinigt mit der Liste als einziger Wurzel und durchläuft die Kopie und
erzeugt 1.000 Kontexte, die je ein kleines Tupel halten. Er meldet Aufbau- und
Durchlaufzeiten, belegte Heap-Wörter und Kapazität in Wörtern, Nebenbytes
(Host-Allokationen über den Heap-Speicher hinaus) sowie Bytes und Heap-Wörter
pro Kontext.
