---
source: docs/patterns.md
sourceCommit: 06042fa
sourceSha256: 5d4fa604cd009ece1e93b35b9f94ebc0ecf7f468356ccdc6e96a4d84c9280a97
translatedAt: 2026-10-09
---
# Muster, Klauseln und Matches im Rumpf

Köpfe von Funktionsklauseln, Matches im Rumpf, `case`-Klauseln und `if`-Guards
sind für jede zugelassene Term-Art ausführbar ([Terme](terms.md)). Zulässigkeit
und Verfügbarkeit werden getrennt geprüft: Ungültiges Erlang ist selbst in
unerreichbarem Code ein **semantischer** Fehler; zulässiger Code, der ein
fehlendes Feature braucht, erhält eine **Capability**-Diagnose; ein
**Nichtübereinstimmen** (mismatch) zur Laufzeit ist nie ein Compiler-Fehler.

| Kontext | Status |
| --- | --- |
| Funktionsköpfe + Guards | Implementiert; Erschöpfung löst `error:function_clause` aus |
| Matches und Sequenzen im Rumpf, `begin`/`end` | Implementiert; Fehlschlag löst `error:{badmatch, RHS}` aus |
| `case`-Klauseln + Guards | Implementiert; Erschöpfung löst `error:{case_clause, Value}` aus |
| `if`-Guard-Klauseln | Implementiert; Erschöpfung löst `error:if_clause` aus |
| `maybe` mit `?=` und `else`-Klauseln | Implementiert; ein fehlgeschlagenes `?=` liefert seinen Wert oder wählt eine `else`-Klausel, deren Erschöpfung `error:{else_clause, Value}` auslöst; erfordert das Feature `maybe_expr` ([Präprozessor](preprocessor.md)) |
| Listen-, Binary- und Map-Comprehensions | Implementiert ([unten](#comprehensions)) |
| `catch Expr` | Implementiert; keine Muster ([ABI](abi.md#failure-channel-revision-2)) |
| `try`-`of`- und Catch-Klauseln | Implementiert; Erschöpfung von `of` löst `error:{try_clause, Value}` aus, nicht gematchte Ausnahmen werden erneut ausgelöst, und `after` läuft auf jedem Pfad ([ABI](abi.md#failure-channel-revision-2)); `Class:Reason:Stack` bindet den [Stacktrace](abi.md#stack-traces) |
| Fun-Klauseln | Capability (F18) |
| `receive` | Capability (F22/F25) |

## Comprehensions

`[T1, ..., Tn || Q1, ..., Qm]`, `<< T || Q1, ... >>` und `#{K => V, ... || Q1, ... }`
folgen OTP 29:

- Qualifikatoren laufen von links nach rechts; jeder Generator iteriert über den
  Rest. Templates werden in dieser Reihenfolge für jede verbleibende Kombination
  ausgewertet; mehrere Templates fügen pro Kombination mehrere Elemente hinzu.
  Das Template einer Binary-Comprehension muss ein Bitstring sein (sonst
  `error:badarg` bei diesem Element); die Teile werden der Reihe nach verbunden,
  angebrochene Bytes eingeschlossen. Eine Map-Comprehension wertet ihren (ersten)
  Wert vor ihrem Schlüssel aus, und ein späterer doppelter Schlüssel gewinnt.
- Generatoren: `P <- List`, `<<Segs>> <= Bits` und `K := V <- Map`, mit den
  strikten Formen `<:-` (Listen, Maps) und `<:=`. Ein Bitstring-Generator matcht
  sein Muster gegen ein Präfix und setzt mit dem Rest fort. Weist ein lockerer
  Generator ein Element ab, überspringt er so viele Bits, wie die Größen des
  Musters beschreiben (Werte ignoriert, Gleitkommazahlen als Ganzzahlen gelesen,
  wie OTP es tut); schlägt selbst das fehl oder bleiben weniger Bits übrig, endet
  der Generator. Ein Map-Generator durchläuft die Map in Schlüsselreihenfolge
  (OTP iteriert bis zu 32 Schlüssel ebenfalls in Schlüsselreihenfolge, außer
  Atom-Schlüsseln, die es nach Atomindex ordnet; größere Maps folgen der
  Hash-Reihenfolge von OTP, die Clause nicht nachbildet).
- Ein Generatormuster bindet neue Namen: Es verdeckt äußere Namen, und nichts,
  was eine Comprehension bindet, ist nach ihr sichtbar. Ein lockerer Generator
  überspringt Elemente, die sein Muster abweist; ein strikter löst
  `error:{badmatch, E}` mit dem Listenelement, dem verbleibenden Bitstring oder
  `{Key, Value}` aus.
- Eine Zip-Gruppe (`P1 <- L1 && P2 <- L2`) nimmt pro Schritt ein Element jeder
  Eingabe; ihre Muster binden gemeinsam, sodass ein wiederholter Name matchen
  muss. Ein abgewiesener Schritt wird übersprungen, außer ein striktes Muster
  weist ihn ab. Ungleichmäßig erschöpfte Eingaben oder eine strikte Abweisung
  lösen `error:{bad_generators, {L1', L2'}}` mit den in diesem Schritt
  verbleibenden Eingaben aus (ein Map-Generator zeigt den Iterator von OTP
  `{K, V, Next}`, der mit `none` endet). Filter innerhalb einer Zip-Gruppe sind
  semantische Fehler. Teilen sich lockere und strikte Generatoren einer Gruppe
  eine Variable, kann die Überspringregel von OTP abweichen
  ([Unterschiede](differences.md)).
- Eine Eingabe, die keine Map ist, löst `error:{bad_generator, Input}` aus, bevor
  ein Map-Generator beginnt, auch innerhalb einer Zip-Gruppe.
- Eine Listeneingabe, die keine Liste ist, oder ein unechter Rest sowie eine
  Bitstring-Eingabe, die kein Bitstring ist, lösen `error:{bad_generator, Tail}`
  aus, sobald die Elemente davor abgearbeitet sind.
- Ein Filter, der ein Guard-Test ist (OTP `erl_lint:is_guard_test/3`:
  Guard-Syntax, die nur nicht verdeckte Guard-BIFs aufruft, veraltete Typtests auf
  oberster Ebene), weist das Element bei jedem Fehlschlag ab, wie ein Guard. Jeder
  andere Filter muss `true` oder `false` zurückgeben; andere Werte lösen
  `error:{bad_filter, Value}` aus, und seine Ausnahmen werden weitergereicht.
- Ein Match-Qualifikator auf oberster Ebene (`P = E`) ist ein semantischer
  Fehler, sofern das experimentelle Feature `compr_assign` nicht aktiviert ist;
  seine Ausführung ist dann nicht implementiert (Capability).

Jeder Generator ist eine Schleife im Funktionsrumpf, deren Eingabecursor (ein
Listen- oder Bitstring-Rest oder eine Map und eine Position) in Term-Slots des
Frames liegt; die erzeugten Elemente sammeln sich umgekehrt in einem weiteren
Term-Slot und werden am Ende einmal zur Liste, zum verbundenen Bitstring oder zur
Map, sodass lange Eingaben konstanten nativen Stack und Prozess-Stack brauchen.

## Musterformen

| Form | Regel | Abweisung |
| --- | --- | --- |
| `_` | Bindet nie; Vorkommen unabhängig | Lesen von `_` ist semantisch |
| `Name`, `_Name`, Wiederholungen | Einmalige Zuweisung; Wiederholungen brauchen exakte Gleichheit (`1` ≠ `1.0`) | Lesen ungebunden/unsicher ist semantisch; Ungleichheit ist Nichtübereinstimmen |
| `P1 = P2`, Klammern | Beide schränken denselben Wert ein; keine Schlüssel-/Größenbindungen zwischen Geschwistern | Unzulässige Geschwisterabhängigkeit ist semantisch |
| Atome, Ganzzahlen, Zeichen, Gleitkommazahlen | Exakte Gleichheit; vorzeichenbehaftete Null unterschieden | Nichtübereinstimmen |
| Konstante Arithmetik | Musteroperatoren von OTP exakt gefaltet; `1 div 0` und Nichtkonstanten abgewiesen | Semantisch |
| Tupel, Listen, unechte Reste, Zeichenketten | Exakte Stelligkeit und Cons/Nil-Form; Zeichenketten sind Listen | Nichtübereinstimmen |
| `"prefix" ++ Tail` | Nur literale Zeichenkette oder literale Ganzzahllisten als Präfix | Variables Präfix ist semantisch |
| `#{K := P}` | Nur `:=`; zusätzliche Schlüssel erlaubt; `#{}` prüft den Typ; Schlüssel sind Guard-Ausdrücke über eingehende Bindungen | `=>`, ungebundener Schlüssel semantisch; fehlender Schlüssel ist Nichtübereinstimmen |
| Bitstrings | Typ/Größe/Einheit validiert; frühere Segmente dürfen spätere dimensionieren; Rest ohne Größe zuletzt | Ungültiger Spezifikator semantisch; zu kurze Daten sind Nichtübereinstimmen |
| Tupel-Records `#r{f = P}`, `#r.f` | Zu Tupel-Einschränkungen expandiert; ausgelassene Felder uneingeschränkt | Unbekannter Record/unbekanntes Feld semantisch |
| Lokale native Records `#r{f = P}` | Record dieses Moduls namens `r`, dann jedes aufgeführte Feld (ein fehlendes Feld schlägt fehl) | Unbekannter Record semantisch |
| Qualifizierte/importierte native Records `#m:r{f = P}` | Record des Moduls `m` namens `r`; exportiert, wenn ein Feld aufgeführt ist; dann jedes Feld | Keine zur Compile-Zeit |
| Anonyme Records `#_{f = P}` | Jeder native Record; exportiert oder in diesem Modul definiert, wenn ein Feld aufgeführt ist | `#_{...}` als Ausdruck ist ein Fehler |
| Aufrufe, variable Arithmetik, andere Ausdrücke | Keine Muster | Semantisch |

## Gültigkeitsbereiche

Map-Schlüssel und Binary-Größen lesen die eingehende Umgebung, nie Geschwister:
`#{K := V} = #{key := K}` und `<<X:N>> = <<N:8>>` können ihren eigenen Schlüssel
bzw. ihre eigene Größe nicht binden. Innerhalb eines Binary darf eine Größe
frühere Segmente lesen: `<<N:8, X:N>>` ist zulässig; `{N, <<X:N>>}` braucht ein
zuvor gebundenes `N`. Konstante fehlerhafte Arithmetik in einem Schlüssel oder
einer Größe ist zulässig und schlägt zur Match-Zeit fehl.

Die Binary-Validierung weist Segmente mit verschachtelten Containern/Aliasen,
widersprüchliche Modifikatoren, ungültige Einheitenbereiche, Einheit ohne Größe
bei Ganzzahl-/Gleitkomma-Standards, ungültige UTF-Größe/-Einheit,
typisierte/dimensionierte literale Zeichenketten und Binary-Segmente ohne Größe,
die nicht am Ende stehen, ab.

## Ausführung

- Ein flacher Match-Plan pro Kopf/linker Seite über die ursprünglichen
  Argument-Slots; Aliase teilen sich eine Eingabe, erste Definitionen binden
  SSA-Werte, Wiederholungen erzeugen Tests auf exakte Gleichheit.
  Formprüfungen dominieren die Extraktion; die Extraktion verwendet geprüfte
  Runtime-Dienste.
- Klauseln laufen in Quelltextreihenfolge, jede mit einer frischen Umgebung, die
  die ursprünglichen Argumente neu lädt. Nichtübereinstimmen des Kopfs oder
  Abweisung durch den Guard führt zur nächsten Klausel; Fehler im Rumpf und
  Infrastrukturfehler versuchen nie spätere Klauseln.
- Ein `case` wertet seinen Prüfausdruck einmal aus und versucht dann jede
  Klausel der Reihe nach mit dem Prüfausdruck als einziger Planeingabe:
  Nichtübereinstimmen des Musters oder Abweisung durch den Guard (einschließlich
  Guard-Fehlern) führt zur nächsten Klausel, Erschöpfung löst
  `{case_clause, Value}` aus. Jede Klausel beginnt mit den Bindungen vor dem
  case; der Wert des case und jede exportierte Bindung werden in einem PHI pro
  Wert zusammengeführt.
- Ein `if` ist ein `case` ohne Prüfausdruck oder Muster: Jeder Klausel-Guard wird
  der Reihe nach versucht (ein Guard-Fehler weist die Klausel ab), Erschöpfung
  löst `if_clause` aus, und Werte und Exporte werden auf dieselbe Weise
  zusammengeführt.
- `begin`/`end` führt seine Sequenz im umschließenden Gültigkeitsbereich aus und
  liefert seinen letzten Wert.
- Sequenzen im Rumpf laufen der Reihe nach und geben den letzten Wert zurück.
  Ein Match wertet seine rechte Seite einmal aus, bindet neue Namen, prüft
  vorhandene und gibt die rechte Seite zurück (auch für `_ = RHS`). Ketten
  werten die innerste rechte Seite zuerst aus.
- Atom-Literale laden Modulbindungen; Matching interniert nie Atome.
- Unbedingte Variablenköpfe werden zu kompaktem Projektions-IR kompiliert.

## Grenzen

Die Normalisierung von Mustern teilt sich das semantische Budget des Moduls von
1.000.000 Einheiten (eine Ganzzahl kostet etwa so viel wie ihre Dezimalziffern);
eine Konstante jenseits der Ganzzahlgrenze von 4.194.240 Bit ist ein
`illegal pattern`, wie in OTP ([Terme](terms.md#integers)).
Jeder Match-Plan hat eine Obergrenze von 100.000 Arbeitseinheiten. Der Parser
begrenzt die Verschachtelung separat auf 256 (harte Obergrenze 512).
