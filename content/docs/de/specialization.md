---
source: docs/specialization.md
sourceCommit: 06042fa
sourceSha256: 2c39d48470df1d080597dde6ad170daf6c6a24e35d3a42c166a0c9dcf90dee23
translatedAt: 2026-10-09
---
# Typspezialisierung

Der Geschwindigkeitsmodus (`-O2`) darf eine Funktion in
Repräsentationsvarianten klonen, die durch Tag-Prüfungen zur Laufzeit geschützt
sind. `-O0` und `--no-type-specialization` erzeugen nur generischen Code.

## Richtlinie

- Profile stammen aus inferierten Fakten der Aufrufstellen. Heute beweisen nur
  exakte, im Ziel darstellbare Ganzzahl-Singletons ein Argument als kleine
  Ganzzahl. Specs, breites `integer()`, Unions und Unbekanntes bleiben
  generisch.
- Eine Variante ist nur gerechtfertigt, wenn sie eine implementierte Prüfung
  entfernt: einen exakten Vergleich des unteren Tags beim Laden eines Arguments
  im Eintrittsblock, vor Seiteneffekten.
- Grenzen: 3 Varianten pro Funktion, 32 pro Modul, 128 pro Ziel. Das
  geschätzte und dann tatsächliche Wachstum (Klon + Guards + Dispatch +
  Fallback) muss innerhalb des Zweifachen der generischen Befehlsanzahl pro
  Funktion und Modul bleiben.
- Generische Rümpfe werden immer behalten. Entwürfe über dem Budget werden
  stillschweigend verworfen; das Programm scheitert nie wegen der
  Spezialisierung.
- Die Auswahl ist deterministisch (Reihenfolge nach Modul, Symbol, Profil).

## Lowering

Klonen/Vereinfachen durch LLVM ersetzt bewiesene Prüfungen innerhalb des Klons.
Ein begrenzter Dispatcher testet jedes eingeschränkte Tag und leitet Kontext
und Argumente an eine Variante oder den generischen Rumpf weiter; das
öffentliche Symbol und das ABI ändern sich nicht. Es werden weder ungeprüftes
Unboxing noch Annahmen aus Specs noch Fast-Math-Flags eingeführt.

## Aktuelle Wirkung

Die derzeitige Quelltext-Teilmenge hat keine entfernbaren
Repräsentationsprüfungen, daher erhält echter Erlang-Quelltext selbst bei O2
keine Varianten; eine Identität zu spezialisieren würde nur den Code
vergrößern. Gezielte LLVM-Fixtures fügen wiederholte Tag-Prüfungen ein, um
Treffer, Fallbacks und das Zurückrollen bei Wachstum mit nativer Ausführung zu
erproben.

`codegen_measurements` schreibt `measurements/<config>/measurements.json` in
das Build-Verzeichnis der Codegen-Tests (Kompilierzeit, IR-/Objektbytes,
Varianten, native Laufzeit). Zeiten sind beschreibend, nie Schwellenwerte.
Beispiel Windows x64 / LLVM 23.1.2 (2026-09-29): Quelltext-Arbeitslast 232.876
IR- / 40.498 Objektbytes bei O0 und 204.408 / 35.886 bei beiden
O2-Richtlinien, keine Varianten; das synthetische Fixture fügte einer Funktion
mit 55 Befehlen für eine akzeptierte Variante 30 Befehle hinzu.
