---
source: docs/specialization.md
sourceCommit: 6ed3851c
sourceSha256: 896b741de11f8f1f7f9098670798d1de273c0e4be02cb7ebfadca90e184b0e36
translatedAt: 2026-10-15
---
# Typspezialisierung

Der Geschwindigkeitsmodus (`-O2`) verwendet [inferierte Fakten](semantic.md#inference),
um Prüfungen zur Laufzeit zu entfernen (Beweise), und darf eine Funktion in
Repräsentationsvarianten klonen, die durch Tag-Prüfungen zur Laufzeit geschützt
sind. `-O0` und `--no-type-specialization` erzeugen nur generischen Code: Jede
Prüfung bleibt, jeder Zugriff auf zusammengesetzte Werte geht über seinen
Runtime-Dienst.

## Beweise

Ein Beweis stammt nur aus Fakten, die immer gelten, wenn der Code läuft:

- die Fakten der Argumente einer lokalen Funktion, vereinigt über alle ihre
  Aufrufer (`Inference::inputs`; exportierte Funktionen und Funktionen, die
  `fun F/A` nennt, haben keine);
- der erfasste Fakt eines Ausdrucks (der Fakt eines Operanden wird erfasst,
  bevor die Operation, die ihn verwendet, ihn einengt);
- ein Formtest früher im selben Match-Plan: Plan-Knoten laufen in einer Reihe,
  daher dominiert ein bestandener Tupel- oder Cons-Test jeden späteren Knoten.

Spezifikationen beweisen nie etwas. `term()` und `none()` (Code, den die
Inferenz als unerreichbar erkannt hat) beweisen nichts; Rümpfe anonymer Funs
erhalten keine Beweise.

| Operation | Bewiesen durch | Erzeugter Code |
| --- | --- | --- |
| `+ - *` | beide Operanden Bereiche kleiner Ganzzahlen, Ergebnisbereich innerhalb der Immediate-Nutzdaten | Dekodieren, Rechnen und Kodieren inline; kein Tag, kein Überlauf, kein Rückfallpfad |
| `+ - *` | ein oder beide Operanden Bereiche kleiner Ganzzahlen | die bewiesenen Tag-Tests entfallen; Überlaufprüfung und Rückfall auf den Dienst bleiben |
| Tupelmuster | Fakt des Arguments oder des geprüften Werts: exakte Tupel mit der Stelligkeit des Musters | Formtest entfernt (unbewiesen: inline getestet) |
| Tupelelement | ein Formtest oder Fakt, der das Tupel beweist | Inline-Laden des Elements |
| Listenmuster | Fakt: sicher eine Cons-Zelle | Formtest entfernt (sonst ein Test des primären Tags auf jeder Ebene) |
| Kopf, Rest | ein Cons-Test oder Fakt, der die Zelle beweist | Inline-Laden |
| exaktes Literal `[]`, `{}`, kleine Ganzzahl, Atom | immer (auf jeder Ebene seit OPT0.2A) | Wortvergleich: gleiche Immediates sind ein Wort |
| Listengenerator | Fakt der Generatoreingabe: eine echte Liste | Cons-Test und Zellenlesen inline in jeder Iteration |

Fakten erreichen Muster von Funktionsköpfen (über Aufrufer vereinigte
Argumente), Matches im Rumpf (die rechte Seite) und case/try-Klauseln (der
geprüfte Wert oder der Wert des try-Rumpfs); Element-, Kopf- und Rest-Fakten
folgen Extraktionen. Ein Inline-Lesen wird wie eine Dienstausgabe in einem
Wurzel-Slot gespeichert, sodass das Frame-Lowering es über Safepoints hinweg als
Term behält ([Neulade-Regel](runtime-heap.md#reload-rule)). Die einzigen
Zeigerumwandlungen in erzeugtem Code sind diese bewiesenen Lesevorgänge und das
Laden der Header bei Inline-Formtests von Tupeln (`proven.cell`).
Layout-Konstanten stammen aus [`abi/term.hpp`](abi.md#terms); die Runtime
prüft sie per Assertion gegen ihre privaten Zellen-Layouts.

## Varianten

- Profile stammen aus Fakten der Aufrufstellen: Ein Argument, dessen Fakt nur
  kleine Ganzzahlen enthält (Singletons oder Bereiche), beweist ein Argument
  als kleine Ganzzahl. Specs, breites `integer()`, Unions mit anderen Arten und
  Unbekanntes bleiben generisch.
- Eine Variante ist nur gerechtfertigt, wenn sie eine implementierte Prüfung
  entfernt: einen exakten Vergleich des unteren Tags eines Argumentworts an
  beliebiger Stelle im Rumpf (das Argument-Array wird nie beschrieben, und eine
  Speicherbereinigung ändert nie eine kleine Ganzzahl).
- Grenzen: 3 Varianten pro Funktion, 32 pro Modul, 128 pro Ziel. Das
  geschätzte und dann tatsächliche Wachstum (Klon + Guards + Dispatch +
  Fallback) muss innerhalb des Zweifachen der generischen Befehlsanzahl pro
  Funktion und Modul bleiben.
- Generische Rümpfe werden immer behalten. Entwürfe über dem Budget werden
  stillschweigend verworfen; das Programm scheitert nie wegen der
  Spezialisierung.
- Die Auswahl ist deterministisch (Reihenfolge nach Modul, Symbol, Profil).

Klonen/Vereinfachen durch LLVM ersetzt bewiesene Prüfungen innerhalb des Klons.
Ein begrenzter Dispatcher testet jedes eingeschränkte Tag und leitet Kontext
und Argumente an eine Variante oder den generischen Rumpf weiter; das
öffentliche Symbol und das ABI ändern sich nicht. Es werden weder Annahmen aus
Specs noch Fast-Math-Flags eingeführt.

## Aktuelle Wirkung

Beweise wirken auf echten Quelltext: Lokale Funktionen, deren Aufrufer kleine
Ganzzahlen, Tupel und Listen übergeben, verlieren ihre Tag-, Form- und
Dienstprüfungen
([`proofs`](../tests/fixtures/executables/proofs/proofs.erl), geprüft von
CTest `codegen_proofs` und ausgeführt als Executable-Golden
`executables_proofs`). Eine Variante muss mehr Befehle einsparen, als ihr
Dispatch kostet; ein entfernter Tag-Test eines Arguments schafft das selten,
daher werden Varianten aus Quelltext meist geplant und dann von der
Wachstumsgrenze abgewiesen. Gezielte LLVM-Fixtures fügen wiederholte
Tag-Prüfungen ein, um Treffer, Fallbacks und das Zurückrollen bei Wachstum mit
nativer Ausführung zu erproben.

Executable-Goldens laufen im vollständigen Modus unter jeder Richtlinie; der
schnelle Modus führt `-O0` (generisch) und `-O2` mit Spezialisierung (Beweise)
aus.

`codegen_measurements` schreibt `measurements/<config>/measurements.json` in
das Build-Verzeichnis der Codegen-Tests (Kompilierzeit, IR-/Objektbytes,
Varianten, bewiesene Lesevorgänge, native Laufzeit). Zeiten sind beschreibend,
nie Schwellenwerte. Beispiel Windows x64 / LLVM 23.1.2 (2026-09-29, vor den
Beweisen): Quelltext-Arbeitslast 232.876 IR- / 40.498 Objektbytes bei O0 und
204.408 / 35.886 bei beiden O2-Richtlinien, keine Varianten; das synthetische
Fixture fügte einer Funktion mit 55 Befehlen für eine akzeptierte Variante
30 Befehle hinzu.
