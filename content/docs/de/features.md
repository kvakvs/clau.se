---
source: docs/features.md
sourceCommit: a8c3f8f6
sourceSha256: c542e68489672ac575517c6517e5952bc91a1aa3d15f5b5da6474cffc0302f6e
translatedAt: 2026-10-17
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
| Treiber | Nichts zurückgestellt: `executable linking` ist implementiert ([Linken](executables.md#linking)) |
| Runtime-Dienste | Siehe [zurückgestellte Runtime-Dienste](runtime.md#deferred-services) |

Heute zurückgestellte Compiler-Features, jeweils durch `codegen_placeholders`
abgedeckt:

| Feature | Beispiel, das es meldet |
| --- | --- |
| `heap expressions` | Zuweisungen in Comprehensions `compr_assign` (`[Y \|\| X <- L, Y = X]`) |
| `dynamic calls` | Ein Builtin-Fun von `apply` (`fun erlang:apply/2`) |
| `behavior-changing attributes` | `-on_load`, `-nifs`, nicht wirkungslose `-compile`-Optionen, parametrisierte Module ([akzeptierte Teilmenge](compile.md#accepted-source-subset)) |

## Regeln für Meldungen

- Der gemeinsame [Formatierer](../abi/include/clause/abi/feature_diagnostic.hpp)
  lässt unbekannten Kontext weg, maskiert Steuerbytes als `\xHH` und maskiert
  Anführungszeichen und Backslashes, sodass Kontext keine Zeilen einschleusen
  kann. UTF-8 bleibt erhalten.
- Genau eine Meldung pro fehlgeschlagener Operation, unabhängig von `--verbose`.
- Ein zurückgestelltes Feature, das der Compiler überspringen könnte, ohne zu
  ändern, was er akzeptiert, würde als Warnung gemeldet, und die Kompilierung
  liefe weiter; heute tut das keines. `codegen_placeholders` prüft eine Meldung
  pro zurückgestelltem Compiler-Feature.
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
