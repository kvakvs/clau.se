---
source: docs/parser.md
sourceCommit: 06042fa
sourceSha256: 620d520afbba7b5b1d96dcbf60cf55b23bfb6a23153437fd25ee82c424a2afc1
translatedAt: 2026-10-09
---
# Parser

Parst die vollständige OTP-29-Grammatik aus vorverarbeiteten Tokens in einen
besitzenden AST.

## CLI

`clau --parse-check -I include -DDEBUG module.erl` führt Präprozessor und Parser
aus, schreibt Diagnosen nach stderr und bei Erfolg nichts nach stdout. Alle
Präprozessoroptionen gelten. `--print-pp` und `--print-ast` geben den
expandierten Quelltext oder den Baum aus demselben Durchlauf aus. Optionen für
Ausgabepfade sind in Prüf-/Ausgabemodi Verwendungsfehler. Eingaben sind
voneinander isoliert; jeder Fehlschlag sorgt für einen fehlschlagenden
Exit-Code. `--` erlaubt Pfade, die mit `-` beginnen. Exit-Codes: 0 Erfolg
(Warnungen erlaubt), 1 Quell-/Dateisystemfehler, 2 Verwendungsfehler.

Der AST-Text verwendet geklammerte Objekte, Einrückung um zwei Leerzeichen und
Felder der Form `name=value`:

```lisp
(Function name=i arity=0 clauses=1
  clause[0]=(FunctionClause arguments=0 guard=none body=1
    body[0]=(IntegerLiteral value=42)
  )
)
```

Der Printer arbeitet iterativ; ab 64 Ebenen begrenzt er die Einrückung und fügt
Beschriftungen `[depth=N]` hinzu. Der AST-Text dient nur der Inspektion; es gibt
keinen Leser dafür.

## API

Header `clause/compiler/parser.hpp`, CMake-Ziel `clause_frontend`:

```cpp
clause::ParseResult load(const std::filesystem::path &path) {
    clause::SourceManager sources;
    clause::PreprocessorSession pp(sources.read(path));
    return clause::parse_module(pp);
}
auto result = load("module.erl"); // Sources and session are gone; AST owns its data.
for (const auto &id : result.module.forms()) {
    const auto &origin = result.module.anchor(result.module.form(id).source);
}
```

- `ast::Module` ist nur verschiebbar (move-only) und besitzt Formen, flache
  Knoten-Arenen, Quellpuffer und Feature-Snapshots. Verschiebungen erhalten
  Handles.
- Getrennte Handles `ExprId`, `PatternSyntaxId`, `TermId`, `TypeId`, `FormId`;
  Besitzer- und Generationsprüfungen weisen fremde oder veraltete Handles ab.
- `module.visit(id, visitor)` verteilt über eine geschlossene Variante. Tiefe
  Bäume mit expliziten Stacks durchlaufen.
- `NodeSource` ist ein Bereich expandierter Tokens plus Anker;
  `extent()`/`anchor()` verwenden, statt eine zusammenhängende physische
  Schreibweise anzunehmen.
- Streaming: `ParserSession::consume(event)`, `parse_form(tokens, eof, features)`,
  dann `std::move(session).finish(features)`. Immer
  `ParseResult::failed` prüfen; wiederhergestellte Formen bedeuten keinen
  Erfolg.
- `tests/compiler/parser/consumer.cpp` ist ein kompiliertes Beispiel für den
  Besitz.

Grammatikabdeckung: Attribute und literale Terme, Tupel-/native Records,
Type/Opaque/Nominal-Deklarationen, Specs/Callbacks, alle Ausdrücke, Muster,
Guards, Klauseln, Binaries, fun/try/maybe/receive sowie Listen-, Map- und
Binary-Comprehensions mit den strikten Generatoren und Zip-Gruppen von OTP 29.
SSA-Testannotationen sind ausgeschlossen. Erfolg bei der Syntax sagt nichts über
Lint, Bindungen oder Codegenerierung aus.

## Wiederherstellung und Grenzen

Fehlgeschlagene Formen setzen Arenen und Herkunftsangaben zurück; spätere Formen
bleiben verfügbar, aber der Fehlschlag bleibt bestehen. Diagnosen enthalten
Kategorie, logische Koordinaten, Makro-/Include-Trace, die nächste nicht
geschlossene öffnende Klammer und `Diagnostic::expected`-Terminale.

Standards: 1.000.000 Tokens/Form, 4.000.000 Tokens/Modul, 1.000.000 Knoten,
1.000 Diagnosen (+1 Erschöpfungsmeldung), Verschachtelung 256 (harte
API-Obergrenze 512), 16.000.000 Arbeitseinheiten. Der Baum-Printer hat
standardmäßig 4.000.000 besuchte Objekte und wirft bei Erschöpfung
`std::length_error`. Dies sind Abrechnungsgrenzen, keine Garantien für die
Laufzeit. Ressourcenerschöpfung beendet die Sitzung.

## Nachweise der Kompatibilität

- Alle 344 gewöhnlichen Produktionen von `erl_parse.yrl` haben gemessene
  Fixture-Belege; 79 Produktionen für SSA-Annotationen sind ausgeschlossen
  (`tests/fixtures/parser/phase6/`).
- 43 positive Fixtures werden strukturell mit OTP verglichen; 183
  Abweisungs-Fixtures, drei Fixtures für Builder-Ausnahmen von OTP
  (`record_helper`, `record_extra`, `any_first`) und `bad.erl` decken Fehler ab.
- Korpus aus echtem Quelltext (optionales Audit): stdlib `lists`, `maps`,
  `sets`, `erl_scan`; compiler `beam_ssa`, `beam_asm` und vier Header, mit
  `-I`/`--app-dir`-Zuordnungen, `maybe_expr` an, `compr_assign` aus und
  `-DCOMPILER_VSN='"parser-compatibility"'`.
- `parser_stress` (Kette aus 12.000 Operatoren), `parser_mutations_0`..`3`
  (Shards von 900 geseedeten Mutationen, Seed `0x29a016`, zweimal ausgeführt)
  und `parser_hardening` begrenzen das Verhalten.
