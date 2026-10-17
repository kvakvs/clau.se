---
source: docs/parser.md
sourceCommit: a8c3f8f6
sourceSha256: 86719d7cbbba9250f7167908fc08ac6735ed50c9adf31c9d0655d626a595c815
translatedAt: 2026-10-17
---
# Parser

Tolkar hela OTP 29-grammatiken från förbehandlade token till ett ägt AST.

## CLI

`clau --parse-check -I include -DDEBUG module.erl` förbehandlar och tolkar,
skriver diagnostik till stderr och ingenting till stdout vid lyckat utfall. Alla
preprocessoralternativ gäller. `--print-pp` och `--print-ast` skriver ut
expanderad källkod eller trädet från samma genomgång. Alternativ för
utdatasökväg är användningsfel i kontroll-/utskriftslägen. Indata är isolerade;
varje fel ger en felaktig slutstatus. `--` tillåter sökvägar som börjar med
`-`. Slutstatus: 0 lyckat (varningar tillåtna), 1 fel i källkod/filsystem,
2 användningsfel.

AST-texten använder objekt inom parentes, indrag med två mellanslag och fält av
formen `name=value`:

```lisp
(Function name=i arity=0 clauses=1
  clause[0]=(FunctionClause arguments=0 guard=none body=1
    body[0]=(IntegerLiteral value=42)
  )
)
```

Utskrivaren är iterativ; bortom 64 nivåer begränsar den indraget och lägger
till etiketter `[depth=N]`. AST-texten är endast till för inspektion; det finns
ingen läsare.

## API

Headerfil `clause/compiler/parser.hpp`, CMake-mål `clause_frontend`:

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

- `ast::Module` kan bara flyttas och äger former, platta nodarenor,
  källbuffertar och ögonblicksbilder av språkfunktioner (features). Flyttar
  bevarar handtag.
- Distinkta handtag `ExprId`, `PatternSyntaxId`, `TermId`, `TypeId`, `FormId`;
  kontroller av ägare/generation avvisar främmande eller inaktuella handtag.
- `module.visit(id, visitor)` skickar vidare en sluten variant. Gå igenom djupa
  träd med explicita stackar.
- `NodeSource` är ett intervall av expanderade token plus ett ankare; använd
  `extent()`/`anchor()` i stället för att anta sammanhängande fysisk stavning.
- Strömning: `ParserSession::consume(event)`,
  `parse_form(tokens, eof, features)`, sedan
  `std::move(session).finish(features)`. Kontrollera alltid
  `ParseResult::failed`; återställda former innebär inte att tolkningen
  lyckats.
- `tests/compiler/parser/consumer.cpp` är ett kompilerat exempel på ägarskap.

Grammatisk täckning: attribut och literala termer, tupel-/native records,
deklarationer av type/opaque/nominal, specs/callbacks, alla uttryck, mönster,
guards, klausuler, binaries, fun/try/maybe/receive, och list-, map- och
binary-comprehensions med OTP 29:s strikta generatorer och zip-grupper.
SSA-testannoteringar är undantagna. Lyckad syntax säger ingenting om lint,
bindningar eller kodgenerering.

## Återhämtning och gränser

Misslyckade former rullar tillbaka arenor och ursprung; senare former förblir
tillgängliga men felet kvarstår. Diagnostik bär kategori, logiska koordinater,
spår av makron/inkluderingar, närmaste omatchade öppnare och terminaler i
`Diagnostic::expected`.

Standardvärden: 1 000 000 token/form, 4 000 000 token/modul, 1 000 000 noder,
1 000 diagnostiska meddelanden (+1 meddelande om uttömning), nästling 256
(hårt tak i API:t 512), 16 000 000 arbetsenheter. Trädutskrivaren har som
standard 4 000 000 besökta objekt och kastar `std::length_error` vid
uttömning. Detta är bokföringsgränser, inte garantier för väggklocktid.
Resursuttömning stoppar sessionen.

## Belägg för kompatibilitet

- Alla 344 vanliga produktioner i `erl_parse.yrl` har uppmätta fixturvittnen;
  79 produktioner för SSA-annoteringar är undantagna
  (`tests/fixtures/parser/phase6/`).
- 43 positiva fixturer jämförs strukturellt med OTP; 183 avvisningsfixturer,
  tre fixturer för undantag i OTP:s byggare (`record_helper`, `record_extra`,
  `any_first`) och `bad.erl` täcker fel.
- Korpus av verklig källkod (valfri granskning): stdlib `lists`, `maps`,
  `sets`, `erl_scan`; compiler `beam_ssa`, `beam_asm` och fyra headerfiler, med
  mappningar via `-I`/`--app-dir`, `maybe_expr` på, `compr_assign` av och
  `-DCOMPILER_VSN='"parser-compatibility"'`.
- `parser_stress` (kedja med 12 000 operatorer), `parser_mutations_0`..`3`
  (shards om 900 seedade mutationer, seed `0x29a016`, körs två gånger) och
  `parser_hardening` begränsar beteendet.
