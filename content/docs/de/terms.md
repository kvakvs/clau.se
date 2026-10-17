---
source: docs/terms.md
sourceCommit: a8c3f8f6
sourceSha256: ceb9d797b2321fa19ef5f072328d39fd9fca241aa41e24f7a8fceea9ff69a78b
translatedAt: 2026-10-17
---
# Term-Darstellungen

Zugelassene Arten: Atome/Booleans, beliebige Ganzzahlen, endliche
binary64-Gleitkommazahlen, Tupel, echte/unechte Listen und Zeichenketten, Maps,
Bitstrings und gewöhnliche Tupel-Records; native Records
([native Records](native-records.md)); Funs
([Funktionswerte](funs.md)); lokale Pids, Ports und Referenzen
([unten](#pids-and-references), [Ports](ports.md#identity)). Wortkodierungen
stehen in [abi.md](abi.md#terms).

## Besitz

- Zusammengesetzte Werte leben im Heap ihres Prozesses
  ([Heap-Vertrag](runtime-heap.md)) oder im schreibgeschützten Literalbereich
  eines Moduls ([Bereiche](runtime-heap.md#areas)). Prozesszeiger benennen
  immer Objektanfänge. Die Zulassung prüft den besessenen Bereich und die Form
  des Headers und weist fremde und veraltete Wörter ab
  ([Zulassung](runtime-heap.md#admission)); Art und Umfang werden aus dem
  Header dekodiert.
- Ein Host-`Term` für einen Heap-Wert ist ein rohes getaggtes Wort, gültig bis
  zur nächsten Speicherbereinigung seines Heaps
  ([Wurzeln](runtime-heap.md#roots-and-safe-points)); er hält den Heap-Speicher
  nicht fest. Nach dem Abbau des Kontexts liefert ein Zugriff
  `expired_context`; nach einer späteren Speicherbereinigung `stale_term`.
  Terme können immer sicher zerstört werden. Die Abbauprüfung liest das
  Lebensdauer-Token des Kontexts, ohne ihn zu sperren: Ein Kontext und seine
  Terme werden jeweils von einem Thread verwendet.
- Die Konstruktion validiert Kinder, reserviert, initialisiert und
  veröffentlicht dann in einem Schritt; ein Fehlschlag macht Speicher und
  Zähler rückgängig.
- `Term::from_word(word)` lässt nur besitzerunabhängige Immediates zu;
  `Term::from_word(word, context)` lässt zusätzlich Atome und Heap-Terme dieses
  Kontexts zu. Die Übergabe innerhalb desselben Heaps bewahrt die Identität.
  `copy_to`/`ProcessHeap::add` kopieren einen Graphen eines anderen Prozesses
  derselben Runtime samt seiner gemeinsamen Teile; Term-Fabriken weisen fremde
  Eingaben mit `wrong_owner` ab
  ([Kopieren zwischen Heaps](runtime-heap.md#copying-between-heaps)).
- Zellen leben, bis eine Speicherbereinigung sie als unerreichbar erkennt, oder
  bis zum Abbau des Heaps ([Speicherbereinigung](runtime-heap.md#collection)).

## Atome

- Pro Runtime eine `AtomStorage`, verzögert interniert nach exakter
  UTF-8-Schreibweise, ohne Normalisierung oder Verdrängung.
  `RuntimeOptions::max_atoms` 1..2^26, Standard 2^20; Modul- und Exportnamen
  zählen mit. Bereits vorhandene Schreibweisen gelingen auch bei voller
  Kapazität.
- Bis zu 255 Unicode-Skalare; leere Atome, NUL und Zeichen aus den
  Zusatzebenen sind erlaubt; fehlerhaftes/überlanges/Surrogat-UTF-8 wird
  abgewiesen.
- Nutzdaten stammen aus einem prozessweiten Zähler, sodass das Atomwort einer
  fremden Runtime erkennbar ist. 32-Bit-Prozesse haben insgesamt 2^26
  Identitäten über ihre gesamte Lebensdauer.
- Das Zulassen eines Atomworts liest einen sperrfreien Index nach Atomnummer
  (die festen Atome direkt, dann Blöcke von 4.096 Einträgen, die einmal unter
  der Internierungssperre veröffentlicht werden); Nummern jenseits von 2^24
  weichen auf die gesperrte Tabelle aus.
- Host-Atom-Terme halten die Schreibweise fest und überleben den Abbau der
  Runtime. Ein Atom zwischen Runtimes zu bewegen heißt, `atom_utf8()` im Ziel
  zu internieren.
- Booleans sind die Atome `true`/`false`. Die festen Atome `false`, `true`,
  `undefined`, `ok` und `error` (`abi::v1::fixed_atom_spellings`) haben in
  jeder Runtime die Wörter der Atomnummern 0–4, werden mit dem Speicher
  angelegt, ohne Sperre gefunden und weder von `size()` noch gegen
  `max_atoms` gezählt; erzeugter Code verwendet sie als Konstanten. Jedes
  andere Atomwort ist privat für die Runtime.
- Zusammengesetzte Literale aus Konstanten (Zeichenketten, Listen und Tupel aus
  Immediates und anderen Literalen, Gleitkommazahlen, Bignums) sind Zellen des
  Literalbereichs des Moduls, zur Kompilierzeit gebaut und gemeinsam genutzt
  ([Literalbereiche](runtime-heap.md#areas)); Ganzzahlliterale im kleinen
  Bereich sind Immediates.
- Andere Atomliterale werden aus dem Atom-Cache des Moduls geladen
  (`ModuleDescriptor::atom_cache`: die Identität der beanspruchenden Runtime,
  dann ein Wort pro Slot), den die erste Runtime füllt, die das Modul
  registriert; ein Kontext, dessen `FrameState::runtime` dem Anspruch
  entspricht, liest ihn ohne Aufruf, jeder andere ruft `CLAUSE_atom_v3` auf.
  Der Anspruch wird zurückgegeben, wenn der Code-Server der Runtime das Modul
  freigibt.
- Internieren und Nachschlagen sind sicher gegenüber nebenläufigen
  Scheduler-Workern ([Threads](runtime.md#threads)); eine Schreibweise behält
  ein Wort.

## Ganzzahlen

- Werte, die in die 28/60-Bit-Nutzdaten des Ziels passen, sind Immediates;
  größere sind unveränderliche Zellen mit Vorzeichen und Betrag. Null und kleine
  Werte werden immer zu Immediates normalisiert. Literale werden nicht auf die
  Host-Breite verengt.
- Bei `-O2` überspringen Operanden, die die Inferenz als klein beweist, ihre
  Tag-Prüfungen, und ein bewiesener Ergebnisbereich überspringt auch die
  Überlaufprüfung und den Rückfallpfad ([Beweise](specialization.md#proofs)).
- Erzeugte `+`, `-`, `*` versuchen bei zwei Immediates einen
  Inline-Schnellpfad, andernfalls rufen sie den Runtime-Dienst auf: `+` und `-`
  addieren oder subtrahieren die getaggten Wörter direkt (`a + (b ^ 15)`) und
  weichen aus, wenn das Wort überläuft, was genau dann geschieht, wenn das
  Ergebnis den kleinen Bereich verlässt; `*` rechnet in doppelter Breite mit
  expliziten Grenzen. Ebenso `band`, `bor`, `bxor`, `bsr`, `div`, `rem` und
  Vergleiche zweier kleiner Ganzzahlen
  ([Inline-Formen](abi.md#runtime-services)).
- `div` schneidet in Richtung null ab; `rem` übernimmt das Vorzeichen des
  Dividenden; bitweise Operationen verwenden unendliches Zweierkomplement;
  negative Verschiebungsweiten kehren die Richtung um; riesige
  Rechtsverschiebungen sättigen auf 0 oder -1.
- Fehler: falsche Operanden und Divisor null → `badarith`; `abs/1` → `badarg`.
- Grenzen: wie in ERTS ein Betrag von höchstens `BIG_ARITY_MAX` Wörtern:
  4.194.240 Bit auf 64-Bit-Zielen (65.535 Wörter), 4.194.272 auf 32-Bit
  (131.071 Wörter); der Dezimaltext folgt daraus (1.262.593 bzw. 1.262.602
  Ziffern). Ein größeres arithmetisches Ergebnis löst in einem Rumpf
  `error:system_limit` aus (`ValueOutcome::system_limit`,
  [ABI](abi.md#failure-channel-revision-2)) und lässt einen Guard fehlschlagen;
  ein Ganzzahlsegment, das einen größeren Wert extrahiert, matcht nicht. Der
  Compiler weist ein Literal über 4.194.240 Bit ab (`illegal integer`, wie der
  Scanner von OTP) und ebenso ein konstantes Muster darüber (`illegal pattern`).

## Gleitkommazahlen

- IEEE-binary64-Bits werden der Runtime als acht Bytes in
  Netzwerk-Bytereihenfolge übergeben; NaN und Unendlich werden abgewiesen. Kein
  Fast-Math.
- `+ - *` bleiben bei zwei Ganzzahlen exakt; jeder Gleitkomma-Operand verwendet
  binary64. `/` konvertiert immer beide. Nicht endliche Ergebnisse und Divisoren
  null → `badarith`.
- `float/1` rundet zur nächsten geraden Zahl; `round/1` rundet bei Gleichstand
  von null weg; `trunc`, `floor`, `ceil` geben beliebige Ganzzahlen zurück.
  Ungültige Operanden → `badarg`.
- Exakte Gleichheit unterscheidet `1` von `1.0` und `0.0` von `-0.0`; der
  numerische Vergleich vergleicht den exakten ganzzahligen Teil und den
  Bruchteil der Gleitkommazahl, ohne die Ganzzahl je zu runden. `min/max` geben
  bei Gleichstand den ersten Operanden zurück.

## Tupel, Listen, Zeichenketten

- Tupel: Stelligkeits-Header + Felder. Cons: Kopf- und Restwort. `{}` und `[]`
  sind Immediates. Zeichenketten sind Listen von Codepoints. Listen haben keine
  Längengrenze außer dem Speicher (ein optionales Heap-Budget eingeschlossen).
  Tupel fassen bis zu 16.777.215 Elemente (`MAX_TUPLE_ARITY`, `MAX_ARITYVAL`
  von OTP); Konstruktoren melden ein größeres als `resource_limit`; Builtins
  (`make_tuple`, `list_to_tuple/1`) lösen `badarg` aus.
- Dienste: `hd`, `tl`, `length`, `tuple_size`, `size`, einsbasiertes `element`.

## Maps

- Unveränderliche Tabellen, sortiert nach exakter Schlüsselordnung. Doppelte
  Schlüssel bei der Konstruktion behalten den letzten Wert. Die Konstruktion
  sortiert die Schlüssel (O(n log n) Vergleiche; bereits aufsteigende Schlüssel
  werden nur geprüft). Bis zu 32 Einträgen ist eine Map eine Heap-Zelle, und
  eine Aktualisierung fügt per binärer Suche in eine Kopie ein; darüber ist sie
  ein B+-Baum aus Heap-Zellen, aktualisiert durch Pfadkopie in O(log n)
  ([Map-Bäume](runtime-heap.md#map-trees)). Keine Größen- oder Arbeitsgrenze
  außer dem Speicher, wie in OTP. Ganzzahl- und Gleitkommaschlüssel
  unterscheiden sich (auch `0.0` gegenüber `-0.0`, auch verschachtelt).
- Aktualisierungen mit `K := V` erfordern den Schlüssel; `K => V` fügt ein oder
  ersetzt. Aktualisierungen bereiten eine neue Tabelle vor und veröffentlichen
  sie einmal.
- Fehler im Rumpf: `{badmap, M}`, `{badkey, K}`; Guards weisen stattdessen ab.
- Dienste: `is_map`, `map_size`, `map_get`, `is_map_key`, Konstruktion,
  Aktualisierung.

## Bitstrings

- Gepackt, MSB zuerst, mit exakter Bitlänge und genulltem Padding. Bis zu
  64 Bytes liegen inline in einem auf die Daten zugeschnittenen Heap-Binary;
  größere Werte verwenden einen gemeinsamen unveränderlichen Puffer außerhalb
  des Heaps, und Ausschnitte sind Sub-Binary-Zellen ihres Originals
  ([Binaries außerhalb des Heaps](runtime-heap.md#off-heap-binaries)). Es gibt
  keine Größengrenze außer einem optionalen Heap-Budget des Prozesses;
  Ganzzahlsegmente werden geschrieben, ohne eine Ganzzahl in der Breite des
  Segments aufzubauen.
- Die Konstruktion bereitet alle Segmente vor dem Veröffentlichen vor.
  Ganzzahlsegmente werden abgeschnitten; die native Bytereihenfolge stammt aus
  dem Datenlayout des Ziels. Ein Ganzzahlsegment eines kleinen Werts mit einer
  Breite von höchstens 64 Bit wird aus seinem Maschinenwort geschrieben (an
  einer Bytegrenze ganze Bytes auf einmal); andere nehmen den Pfad mit
  Mehrfachpräzision. Erzeugter Code baut kleine Konstruktionen konstanter
  Breite inline ([Frames und Übergaben](abi.md#frames-and-transfers)).
- Anhängen, wie bei den beschreibbaren Binaries von OTP: Eine Konstruktion,
  die mit einem ganzen Binary beginnt (`<<Acc/binary, ...>>`), baut ihr
  Ergebnis in einem Puffer mit Reserveplatz (doppelte Größe, mindestens
  256 Bytes), dessen Off-Heap-Zelle im erzeugenden Prozess die belegten Bits
  und die Kapazität vermerkt (null in jeder anderen Zelle, Kopien
  eingeschlossen). Ein späteres Anhängen, dessen Akkumulator-Ansicht genau dort
  endet, schreibt die neuen Bytes in den Reserveplatz, den keine Ansicht
  abdeckt, und gibt eine längere Ansicht desselben Puffers zurück: ein
  Sub-Binary der eigenen Off-Heap-Zelle des Puffers, das über die Bits dieser
  Zelle hinausreichen darf. Jeder andere Akkumulator (eine ältere Ansicht, die
  eines anderen Prozesses, eine nicht ausgerichtete, ein voller Puffer) wird in
  einen neuen, verdoppelten Puffer kopiert. Andere Ansichten des Puffers ändern
  sich nie.
- Gleitkommasegmente: Breiten 16/32/64; die Konstruktion darf Unendlich
  kodieren, das Matching weist aber unendliche/NaN-Felder ab.
  Gleitkomma-Matches der Breite null extrahieren `0.0`.
- UTF-8/16/32-Segmente validieren Skalare, Surrogate und Abschneidung.
- Das Matching rückt einen expliziten Bit-Cursor nur bei Erfolg vor; `:all` als
  explizite Größe ist ungültig.
- Dienste: `is_binary`, `is_bitstring`, `bit_size`, `byte_size` (rundet auf),
  `size` (rundet ab), `binary_part/2,3`. Fehler → `badarg`.

## Records

- Gewöhnliche Records werden zu Tupeln `{Tag, Fields...}` expandiert.
  Deklarationen müssen vor der Verwendung stehen; Duplikate, unbekannte Felder,
  Vorwärts-/Selbstreferenzen und ungültige Wildcard-Felder sind Fehler.
- Die Konstruktion wertet Felder in Deklarationsreihenfolge aus: expliziter
  Wert, sonst `_ = V`-Wildcard-Standardwert, sonst deklarierter Standardwert,
  sonst `undefined`. Jeder Standardwert wird pro Verwendung separat
  ausgewertet.
- Muster prüfen Stelligkeit und Tag, dann nur die aufgeführten Felder. `#r.f`
  ist der einsbasierte Index (Tag an Position 1).
- Feldzugriff prüft Stelligkeit und Tag; ein Fehlschlag ist `{badrecord, V}` in
  Rümpfen und eine Abweisung in Guards.
- `is_record(V, r)` verwendet die deklarierte Stelligkeit. `is_record/3` braucht
  ein Atom-Tag und eine ganzzahlige Stelligkeit (nicht positiv → false; falsche
  Typen → `badarg`); ein Atom als drittes Argument ist die Abfrage für native
  Records und gibt false zurück. Guards erfordern literale Argumente.
- Die Aktualisierung `Expr#r{f = V, ...}` wertet die neuen Werte in
  Quelltextreihenfolge aus, dann `Expr`, prüft dann Stelligkeit und Tag
  (`{badrecord, Value}` bei Abweichung, auch für `Expr#r{}`) und baut ein neues
  Tupel; die übrigen Felder werden kopiert. `_ = V` wird in Aktualisierungen
  abgewiesen; Aktualisierungen sind in Mustern und Guards unzulässig.
- `record_info(fields | size, r)` wird zur Kompilierzeit zur Liste der
  Feldnamen oder zur Tupelgröße expandiert. Beide Argumente müssen literale
  Atome sein und `r` ein zuvor deklarierter Tupel-Record; in Guards ist es
  unzulässig, und ein lokales `record_info/2` wird als bereits definiert
  abgewiesen.
- Native Records: [native Records](native-records.md) (lokale, qualifizierte,
  importierte und anonyme Formen).

## Pids und Referenzen

`self/0` gibt die Pid des aufrufenden Prozesses zurück, `make_ref/0` eine neue
Referenz; `pid_to_list/1` und `ref_to_list/1` geben ihren Text zurück.

- Eine Pid ist ein Immediate-Wort (niedrigste vier Bits `0x3`), das die Nummer
  des Prozesses enthält. Nummern stammen aus einer prozessweiten Sequenz und
  werden nie wiederverwendet, sodass eine Runtime ein Pid-Wort nur zulässt,
  wenn sie diese Nummer vergeben hat: Ein gefälschtes Wort (nie vergeben) oder
  die Pid einer anderen Runtime ist `wrong_owner`. Die Pid eines beendeten
  Prozesses bleibt ein gültiger Term, wie in OTP. 32-Bit-Ziele haben 2^28
  Nummern pro Programmlauf, 64-Bit-Ziele 2^60; einen Prozess darüber hinaus zu
  erzeugen schlägt mit `resource_limit` fehl.
- Ein Port ist ein Immediate-Wort (niedrigste vier Bits `0x7`), das seine
  Nummer aus einer eigenen, nie wiederverwendeten Sequenz enthält, und wird wie
  eine Pid zugelassen; er wird als `#Port<0.N>` ausgegeben und ordnet sich
  zwischen Funs und Pids ein ([Ports](ports.md#identity)).
- Eine Referenz ist eine Heap-Zelle (`reference`: Header plus eine nicht
  verfolgte 64-Bit-Nummer), die wie jeder Heap-Term zugelassen wird: nur in
  ihrem eigenen Prozess, als Host-`Term` veraltet nach einer
  Speicherbereinigung, zwischen Prozessen als Wert kopiert. Nummern stammen aus
  einem prozessweiten Zähler, sodass jede Referenz eines Programmlaufs
  eindeutig ist.
- Eine Handle-Referenz (eine magic reference von OTP) ist eine Referenzzelle,
  die zusätzlich einen Puffer außerhalb des Heaps hält; sie ist für jeden
  Dienst dieselbe Referenz und teilt ihren Puffer mit jeder Kopie
  ([Handle-Referenzen](runtime-heap.md#handle-references)).
- Die Ausgabe folgt den lokalen Identitäten von OTP: eine Pid als `<0.N.S>`
  (N die niedrigsten 28 Bits ihrer Nummer, S der Rest), eine Referenz als
  `#Ref<0.A.B.C>` (C die niedrigsten 18 Bits ihrer Nummer, B die nächsten 32,
  A der Rest), sowohl im `~w`- als auch im Display-Stil. Pids sind nach Nummer
  geordnet, Referenzen nach Nummer, sodass spätere Referenzen eines Programms
  nach früheren eingeordnet werden.

## Vergleich und Ordnung

Iterativ ohne Arbeitsgrenze, wie in OTP: Nur der Speicher für ausstehende Paare
begrenzt einen Vergleich, Schlüsselsuchen in Maps eingeschlossen, und
identische Wörter sind ohne Durchlauf gleich. Byteausgerichtete Bitstrings
vergleichen ganze Bytes auf einmal. Ordnung: Zahlen < Atome < Referenzen <
Funs < Ports < Pids < Tupel < native Records < Maps < nil < Listen < Bitstrings
(zur Ordnung der [Funs](funs.md#comparison-and-printing) untereinander).
Atome werden nach UTF-8-Schreibweise verglichen (Codepoint-Reihenfolge); Tupel
nach Stelligkeit, dann Feldern; Maps nach Größe, dann Schlüsseln, dann Werten;
Bitstrings nach logischen Bits. Zwei kleine Ganzzahlen, zwei Gleitkommazahlen
oder zwei ganzbytige Binaries werden direkt aus ihren Wörtern oder Zellen
geordnet (`detail::word_order`), ohne Zulassung als Term.

## Ausgabe

`format_term` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
stellt jeden zugelassenen Term in einem von zwei OTP-Stilen dar. Ganzzahlen,
Tupel (Records sind Tupel) und Verschachtelung sehen in beiden gleich aus.

| | `~w` (`TermStyle::write`) | `erlang:display/1` (`TermStyle::display`) |
| --- | --- | --- |
| Atome | In Anführungszeichen, außer ein Latin-1-Kleinbuchstabe steht am Anfang und Namenszeichen (mit `@`) folgen; reservierte Wörter und `maybe`/`else` stehen in Anführungszeichen; jenseits von Latin-1 als `\x{H}` maskiert | In Anführungszeichen, außer ein Latin-1-Kleinbuchstabe steht am Anfang und alphanumerische Zeichen oder `_` folgen; für reservierte Wörter und `@` gilt keine Sonderregel; UTF-8 bleibt erhalten |
| Gleitkommazahlen | Kürzeste verlustfreie Darstellung im OTP-Layout: `0.1`, `100.0`, `1.0e16`, `1.5e-7` | C `%.6e`: `1.500000e+00` |
| Listen | Elemente: `[104,105]`, `[1,2\|3]` | Eine flache Liste druckbarer Latin-1-Bytes wird als `"hi"` ausgegeben (rohe Bytes; nur `\n` und `"` maskiert) |
| Bitstrings | `<<1,2,5:3>>` | Ein druckbares ASCII-Binary wird als `<<"hi">>` ausgegeben, andere wie `~w` |
| Maps | `#{k => v,k2 => v2}` | `#{k=>v,k2=>v2}` |

- Maps werden in Reihenfolge der Map-Schlüssel ausgegeben
  (`maps:iterator(M, ordered)`, wie OTP `~kw`). Das Standard-`~w` von OTP und
  `erlang:display/1` folgen stattdessen dem internen Layout:
  Atomtabellen-Reihenfolge für Atom-Schlüssel kleiner Maps (sie variiert
  zwischen VM-Läufen) und Hash-Reihenfolge über 32 Schlüssel. Clause bildet
  diese Reihenfolge nicht nach.
- Die Darstellung ist iterativ, daher ist die Tiefe nur durch den Term
  begrenzt. Der Text ist standardmäßig auf 64 MiB begrenzt; wird das
  überschritten (etwa durch einen vielfach geteilten Teilterm), schlägt sie mit
  `resource_limit` fehl und liefert keinen Teiltext.
- Goldens: `runtime_printing` vergleicht beide Stile mit OTP (alle
  Korpusergebnisse plus selbst verfasste Grenzfälle); Display-Zeilen, deren
  OTP-Map-Reihenfolge intern ist, werden übersprungen
  ([Fixtures](../tests/fixtures/printing/README.md)).
