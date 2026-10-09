---
source: docs/features.md
sourceCommit: 06042fa
sourceSha256: a01c524098c785a3c361908d8a6a5221ef5182bf96ee3780a02e2e2a1efd0e2b
translatedAt: 2026-10-09
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
