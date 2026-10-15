---
source: docs/features.md
sourceCommit: 6ed3851c
sourceSha256: bdb726e4ca520adf0644572e0d808482745802ff3316d535cdb5ea6178e5a0a8
translatedAt: 2026-10-15
---
# Meldung zurückgestellter Features

Zulässiges Erlang, das ein nicht implementiertes Feature braucht, schlägt mit
genau einer expliziten Meldung fehl, die sich von gewöhnlichen Fehlern wegen
ungültiger Eingabe unterscheidet. Ein unterstützter generischer Rückfall (zum
Beispiel eine übersprungene Spezialisierung) ist still und kein Fehlschlag.

```text
[pattern matching] notimpl: src/example.erl:12:5 [module="example"] [target="native"] [operation="match argument"]
```

## Katalog

[features.hpp](../abi/include/clause/abi/features.hpp) vergibt stabile, nie
wiederverwendete IDs und Diagnosenamen, mit Zuständigem und Status pro Eintrag.
Einen Eintrag zurückziehen oder verfeinern, wenn sein Feature umgesetzt ist;
seine ID bleibt reserviert.

| Zuständig | Wo gemeldet wird |
| --- | --- |
| Semantische Analyse des Compilers | Capability-Prüfungen über jede Funktion, auch ungenutzten Code |
| Lowering im Compiler | Defensive Abweisung an erreichten Operationen; verwirft bereitgestellte Artefakte |
| Treiber | `-o/--output` [linkt](executables.md#linking) positionale Eingaben oder ein Projektziel; Projekt-Builds linken jedes ausführbare Ziel zu seinem Manifest-[`output`](projects.md#executables) |
| Runtime-Dienste | Siehe [zurückgestellte Runtime-Dienste](runtime.md#deferred-services) |

## Regeln für Meldungen

- Der gemeinsame [Formatierer](../abi/include/clause/abi/feature_diagnostic.hpp)
  lässt unbekannten Kontext weg, maskiert Steuerbytes als `\xHH` und maskiert
  Anführungszeichen und Backslashes, sodass Kontext keine Zeilen einschleusen
  kann. UTF-8 bleibt erhalten.
- Genau eine Meldung pro fehlgeschlagener Operation, unabhängig von `--verbose`.
- Ein zurückgestelltes Feature, das der Compiler überspringen könnte, ohne zu
  ändern, was er akzeptiert, würde als Warnung gemeldet, und die Kompilierung
  liefe weiter; heute tut das keines (`parse transforms` tat es, bis plan step
  73F sie anwendete, siehe [Transforms](transforms.md)). `codegen_placeholders`
  prüft eine Meldung pro zurückgestelltem Compiler-Feature.
- Compiler: [reject_feature](../compiler/src/codegen/features.hpp) meldet den
  ersten Fehlschlag eines Batches, hält den Fehlschlag fest, verwirft
  bereitgestellte Ausgaben und markiert die Diagnose als `reported`, damit
  Treiber sie nicht erneut ausgeben.
- Runtime: [FeatureFailure](../runtime/include/clause/runtime/features.hpp)
  meldet einmal pro Operation über eine geliehene Senke (null → stderr). Spätere
  Aufrufe geben den festgehaltenen Status zurück. Fehler der Senke oder beim
  Formatieren werden zu `diagnostic_failure`; Ausnahmen werden abgefangen.
- Aufrufer reichen den Fehlschlag weiter, ohne ihn erneut zu melden; ein Host
  sollte mit einem Exit-Code ungleich null enden und normal abbauen.
