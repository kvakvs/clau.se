---
source: docs/terms.md
sourceCommit: 06042fa
sourceSha256: a6c1ea20b3bdb7055c6080cff72a2a86c4cdce87eb6bd8944ffce5c709e98d66
translatedAt: 2026-10-09
---
# Term-Darstellungen

Zugelassene Arten: Atome/Booleans, beliebige Ganzzahlen, endliche binary64-
Gleitkommazahlen, Tupel, echte/unechte Listen und Zeichenketten, Maps,
Bitstrings und gewöhnliche Tupel-Records; native Records
([native Records](native-records.md)); Funs
([Funktionswerte](funs.md)); lokale Pids, Ports und Referenzen
([unten](#pids-and-references), [Ports](ports.md#identity)). Wortkodierungen
stehen in [abi.md](abi.md#terms).

## Besitz

- Zusammengesetzte Werte leben im Heap ihres Prozesses
  ([Runtime](runtime.md#process-memory)). Prozesszeiger benennen immer
  Objektanfänge. Die Zulassung prüft den Besitz: Das Wort zeigt, wortausgerichtet,
  unterhalb des oberen Endes des Heap-Blocks des Prozesses oder eines seiner
  Fragmente,
  und der Header (oder die Cons-Zelle) dort passt zu seinem Tag
  ([Zulassung](runtime-heap.md#admission)). Fremde und veraltete Wörter werden
  ohne jeden Ladezugriff abgewiesen. Art und Umfang werden aus dem Header
  dekodiert.
- Ein Host-`Term` für einen Heap-Wert ist ein rohes getaggtes Wort, gültig bis
  zur nächsten Speicherbereinigung seines Heaps
  ([Wurzeln](runtime-heap.md#roots-and-safe-points)); er hält den Heap-Speicher
  nicht fest. Nach dem Abbau des Kontexts liefert ein Zugriff `expired_context`;
  nach einer späteren Speicherbereinigung `stale_term`. Terme können immer sicher zerstört
  werden.
- Die Konstruktion validiert Kinder, reserviert, initialisiert und
  veröffentlicht dann in einem Schritt; ein Fehlschlag macht Speicher und Zähler
  rückgängig.
- `Term::from_word(word)` lässt nur besitzerunabhängige Immediates zu;
  `Term::from_word(word, context)` lässt zusätzlich Atome und Heap-Terme dieses
  Kontexts zu. Die Übergabe innerhalb desselben Heaps bewahrt die Identität.
  `copy_to`/`ProcessHeap::add` kopieren einen Graphen eines anderen Prozesses
  derselben Runtime samt seiner gemeinsamen Teile; Term-Fabriken weisen fremde
  Eingaben mit `wrong_owner` ab
  ([Kopieren zwischen Heaps](runtime-heap.md#copying-between-heaps)).
- Zellen leben, bis eine explizite Speicherbereinigung sie als unerreichbar erkennt, oder
  bis zum Abbau des Heaps.

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
- Host-Atom-Terme halten die Schreibweise fest und überleben den Abbau der
  Runtime. Ein Atom zwischen Runtimes zu bewegen heißt, `atom_utf8()` im Ziel zu
  internieren.
- Booleans sind die Atome `true`/`false`.
- Internieren und Nachschlagen sind sicher gegenüber nebenläufigen
  Scheduler-Workern ([Threads](runtime.md#threads)); eine Schreibweise behält
  ein Wort.

## Ganzzahlen

- Werte, die in die 28/60-Bit-Nutzdaten des Ziels passen, sind Immediates;
  größere sind unveränderliche Zellen mit Vorzeichen und Betrag. Null und kleine
  Werte werden immer zu Immediates normalisiert. Literale werden nicht auf die
  Host-Breite verengt.
- Generierte `+`, `-`, `*` versuchen bei zwei Immediates einen Inline-Schnellpfad
  (Berechnung in doppelter Breite mit expliziten Grenzen), andernfalls rufen
  sie den Runtime-Dienst auf.
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

- IEEE-binary64-Bits werden der Runtime als acht Bytes in Netzwerk-Bytereihenfolge
  übergeben; NaN und Unendlich werden abgewiesen. Kein Fast-Math.
- `+ - *` bleiben bei zwei Ganzzahlen exakt; jeder Gleitkomma-Operand verwendet
  binary64. `/` konvertiert immer beide. Nicht endliche Ergebnisse und Divisoren
  null → `badarith`.
- `float/1` rundet zur nächsten geraden Zahl; `round/1` rundet bei Gleichstand
  von null weg; `trunc`, `floor`, `ceil` geben beliebige Ganzzahlen zurück.
  Ungültige Operanden → `badarg`.
- Exakte Gleichheit unterscheidet `1` von `1.0` und `0.0` von `-0.0`; der
  numerische Vergleich vergleicht den exakten ganzzahligen Teil und den Bruchteil
  der Gleitkommazahl, ohne die Ganzzahl je zu runden. `min/max` geben bei
  Gleichstand den ersten Operanden zurück.

## Tupel, Listen, Zeichenketten

- Tupel: Stelligkeits-Header + Felder. Cons: Kopf- und Restwort. `{}` und `[]`
  sind Immediates. Zeichenketten sind Listen von Codepoints. Listen haben keine
  Längengrenze außer dem Speicher (ein optionales Heap-Budget eingeschlossen).
  Tupel fassen bis zu 16.777.215 Elemente (`MAX_TUPLE_ARITY`, OTPs
  `MAX_ARITYVAL`); Konstruktoren melden ein größeres als `resource_limit`,
  Builtins werden `badarg` auslösen.
- Dienste: `hd`, `tl`, `length`, `tuple_size`, `size`, einsbasiertes `element`.

## Maps

- Unveränderliche Tabellen, sortiert nach exakter Schlüsselordnung. Doppelte
  Schlüssel bei der Konstruktion behalten den letzten Wert. Die Konstruktion
  sortiert die Schlüssel (O(n log n) Vergleiche; bereits aufsteigende Schlüssel
  werden nur geprüft); Aktualisierungen fügen per binärer Suche ein. Keine
  Größen- oder Arbeitsgrenze außer dem Speicher, wie in OTP; auf 32-Bit-Zielen
  begrenzt die Wortanzahl des Headers eine Map auf 2^24 - 1 Einträge (`resource_limit`). Ganzzahl- und Gleitkommaschlüssel unterscheiden sich (auch
  `0.0` gegenüber `-0.0`, auch verschachtelt).
- Aktualisierungen mit `K := V` erfordern den Schlüssel; `K => V` fügt ein oder
  ersetzt. Aktualisierungen bereiten eine neue Tabelle vor und veröffentlichen sie
  einmal.
- Fehler im Rumpf: `{badmap, M}`, `{badkey, K}`; Guards weisen stattdessen ab.
- Dienste: `is_map`, `map_size`, `map_get`, `is_map_key`, Konstruktion,
  Aktualisierung.

## Bitstrings

- Gepackt, MSB zuerst, mit exakter Bitlänge und genulltem Padding. Bis zu 64 Bytes
  liegen inline in einem auf die Daten zugeschnittenen Heap-Binary; größere Werte
  verwenden einen gemeinsamen unveränderlichen Puffer außerhalb des Heaps, auf
  den Off-Heap-Binary-Zellen verweisen, die sich extrahierte Reste teilen. Der
  Puffer wird einmal dem erzeugenden Prozess angerechnet. Es gibt keine
  Größengrenze außer einem optionalen Heap-Budget des Prozesses;
  Ganzzahlsegmente werden geschrieben, ohne eine Ganzzahl in der Breite des
  Segments aufzubauen.
- Die Konstruktion bereitet alle Segmente vor dem Veröffentlichen vor.
  Ganzzahlsegmente werden abgeschnitten; die native Bytereihenfolge stammt aus
  dem Datenlayout des Ziels.
- Gleitkommasegmente: Breiten 16/32/64; die Konstruktion darf Unendlich kodieren,
  das Matching weist aber unendliche/NaN-Felder ab. Gleitkomma-Matches der
  Breite null extrahieren `0.0`.
- UTF-8/16/32-Segmente validieren Skalare, Surrogate und Abschneidung.
- Das Matching rückt einen expliziten Bit-Cursor nur bei Erfolg vor; `:all` als
  explizite Größe ist ungültig.
- Dienste: `is_binary`, `is_bitstring`, `bit_size`, `byte_size` (rundet auf),
  `size` (rundet ab), `binary_part/2,3`. Fehler → `badarg`.

## Records

- Gewöhnliche Records werden zu Tupeln `{Tag, Fields...}` expandiert.
  Deklarationen müssen vor der Verwendung stehen; Duplikate, unbekannte Felder,
  Vorwärts-/Selbstreferenzen und ungültige Wildcard-Felder sind Fehler.
- Die Konstruktion wertet Felder in Deklarationsreihenfolge aus: expliziter Wert,
  sonst `_ = V`-Wildcard-Standardwert, sonst deklarierter Standardwert, sonst
  `undefined`. Jeder Standardwert wird pro Verwendung separat ausgewertet.
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
- `record_info(fields | size, r)` wird zur Compile-Zeit zur Liste der Feldnamen
  oder zur Tupelgröße expandiert. Beide Argumente müssen literale Atome sein und
  `r` ein zuvor deklarierter Tupel-Record; in Guards ist es unzulässig, und ein
  lokales `record_info/2` wird als bereits definiert abgewiesen.
- Native Records: [native Records](native-records.md) (lokale, qualifizierte,
  importierte und anonyme Formen).

## Pids und Referenzen

Plan 11 step 42. `self/0` gibt die Pid des aufrufenden Prozesses zurück,
`make_ref/0` eine neue Referenz; `pid_to_list/1` und `ref_to_list/1` geben
ihren Text zurück.

- Eine Pid ist ein Immediate-Wort (niedrigste vier Bits `0x3`), das die Nummer
  des Prozesses enthält. Nummern stammen aus einer prozessweiten Sequenz und
  werden nie wiederverwendet, sodass eine Runtime ein Pid-Wort nur zulässt, wenn
  sie diese Nummer vergeben hat: ein gefälschtes Wort (nie vergeben) oder die
  Pid einer anderen Runtime ist `wrong_owner`. Die Pid eines beendeten Prozesses
  bleibt ein gültiger Term, wie in OTP. 32-Bit-Ziele haben 2^28 Nummern pro
  Programmlauf, 64-Bit-Ziele 2^60; einen Prozess darüber hinaus zu erzeugen
  schlägt mit `resource_limit` fehl.
- Ein Port (plan step 57B) ist ein Immediate-Wort (niedrigste vier Bits `0x7`),
  das seine Nummer aus einer eigenen, nie wiederverwendeten Sequenz enthält, und
  wird wie eine Pid zugelassen; er wird als `#Port<0.N>` ausgegeben und ordnet
  sich zwischen Funs und Pids ein ([Ports](ports.md#identity)).
- Eine Referenz ist eine Heap-Zelle (`reference`: Header plus eine nicht
  verfolgte 64-Bit-Nummer), die wie jeder Heap-Term zugelassen wird: nur in ihrem
  eigenen Prozess, als Host-`Term` veraltet nach einer Speicherbereinigung, zwischen
  Prozessen als Wert kopiert. Nummern stammen aus einem prozessweiten Zähler,
  sodass jede Referenz eines Programmlaufs eindeutig ist.
- Die Ausgabe folgt den lokalen Identitäten von OTP: eine Pid als `<0.N.S>`
  (N die niedrigsten 28 Bits ihrer Nummer, S der Rest), eine Referenz als
  `#Ref<0.A.B.C>` (C die niedrigsten 18 Bits ihrer Nummer, B die nächsten 32,
  A der Rest), sowohl im `~w`- als auch im Display-Stil. Pids sind nach Nummer
  geordnet, Referenzen nach Nummer, sodass spätere Referenzen eines Programms
  nach früheren eingeordnet werden.

## Vergleich und Ordnung

Iterativ ohne Arbeitsgrenze, wie in OTP: Nur der Speicher für ausstehende Paare
begrenzt einen Vergleich, Schlüsselsuchen in Maps eingeschlossen, und identische
Wörter sind ohne Durchlauf gleich. Byteausgerichtete Bitstrings vergleichen ganze
Bytes auf einmal. Ordnung: Zahlen < Atome < Referenzen < Funs < Pids < Tupel < native Records < Maps < nil < Listen <
Bitstrings (für die Ordnung untereinander siehe [Funs](funs.md#comparison-and-printing)). Atome werden nach UTF-8-Schreibweise verglichen (Codepoint-Reihenfolge); Tupel nach
Stelligkeit, dann Feldern; Maps nach Größe, dann Schlüsseln, dann Werten;
Bitstrings nach logischen Bits.

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
  Atomtabellen-Reihenfolge für Atom-Schlüssel kleiner Maps (sie variiert zwischen
  VM-Läufen) und Hash-Reihenfolge über 32 Schlüssel. Clause bildet diese
  Reihenfolge nicht nach.
- Die Darstellung ist iterativ, daher ist die Tiefe nur durch den Term begrenzt.
  Der Text ist standardmäßig auf 64 MiB begrenzt; wird das überschritten (etwa
  durch einen vielfach geteilten Teilterm), schlägt sie mit `resource_limit` fehl
  und liefert keinen Teiltext.
- Goldens: `runtime_printing` vergleicht beide Stile mit OTP
  für 9.542 Werte (alle Korpusergebnisse plus selbst verfasste Grenzfälle);
  Display-Zeilen, deren OTP-Map-Reihenfolge intern ist, werden übersprungen
  ([Fixtures](../tests/fixtures/printing/README.md)).
