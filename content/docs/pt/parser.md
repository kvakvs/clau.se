---
source: docs/parser.md
sourceCommit: 6ed3851c
sourceSha256: 620d520afbba7b5b1d96dcbf60cf55b23bfb6a23153437fd25ee82c424a2afc1
translatedAt: 2026-10-15
---
# Parser

Analisa a gramática completa do OTP 29 a partir de tokens pré-processados para
uma AST com posse própria dos dados.

## CLI

`clau --parse-check -I include -DDEBUG module.erl` pré-processa e analisa,
escrevendo os diagnósticos em stderr e nada em stdout em caso de sucesso.
Aplicam-se todas as opções de pré-processamento. `--print-pp` e `--print-ast`
imprimem o código-fonte expandido ou a árvore da mesma passagem. As opções de
caminho de saída são erros de utilização nos modos de verificação/impressão.
As entradas são isoladas; qualquer falha mantém um código de saída de falha.
`--` permite caminhos que começam por `-`. Códigos de saída: 0 sucesso (avisos
permitidos), 1 falha de código-fonte/sistema de ficheiros, 2 erro de
utilização.

O texto da AST usa objetos entre parênteses, indentação de dois espaços e
campos `name=value`:

```lisp
(Function name=i arity=0 clauses=1
  clause[0]=(FunctionClause arguments=0 guard=none body=1
    body[0]=(IntegerLiteral value=42)
  )
)
```

O impressor é iterativo; acima de 64 níveis limita a indentação e acrescenta
etiquetas `[depth=N]`. O texto da AST serve apenas para inspeção; não existe
leitor.

## API

Cabeçalho `clause/compiler/parser.hpp`, alvo CMake `clause_frontend`:

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

- `ast::Module` só pode ser movido e detém as formas, as arenas planas de nós,
  os buffers de código-fonte e os instantâneos de features. Os movimentos
  preservam os handles.
- Handles distintos `ExprId`, `PatternSyntaxId`, `TermId`, `TypeId`,
  `FormId`; as verificações de dono/geração rejeitam handles alheios ou
  obsoletos.
- `module.visit(id, visitor)` despacha uma variante fechada. Percorra árvores
  profundas com pilhas explícitas.
- `NodeSource` é um intervalo de tokens expandidos mais uma âncora; use
  `extent()`/`anchor()` em vez de presumir uma grafia física contígua.
- Streaming: `ParserSession::consume(event)`,
  `parse_form(tokens, eof, features)` e depois
  `std::move(session).finish(features)`. Verifique sempre
  `ParseResult::failed`; formas recuperadas não implicam sucesso.
- `tests/compiler/parser/consumer.cpp` é um exemplo compilado de posse.

Cobertura da gramática: atributos e termos literais, records em tuplo/nativos,
declarações type/opaque/nominal, specs/callbacks, todas as expressões,
padrões, guards, cláusulas, binaries, fun/try/maybe/receive e comprehensions
de lista/map/binary com os geradores estritos e os grupos zip do OTP 29. As
anotações de teste SSA estão excluídas. O sucesso sintático não implica nada
quanto a lint, associações ou geração de código.

## Recuperação e limites

As formas falhadas revertem as arenas e as origens; as formas posteriores
continuam disponíveis, mas a falha persiste. Os diagnósticos incluem a
categoria, as coordenadas lógicas, o rastreio de macros/includes, o delimitador
de abertura sem par mais próximo e os terminais `Diagnostic::expected`.

Valores por omissão: 1 000 000 de tokens/forma, 4 000 000 de tokens/módulo,
1 000 000 de nós, 1000 diagnósticos (+1 mensagem de esgotamento), aninhamento
256 (teto absoluto da API 512), 16 000 000 de unidades de trabalho. O
impressor da árvore tem por omissão 4 000 000 de objetos visitados e lança
`std::length_error` quando se esgota. São limites de contabilização, não
garantias de tempo real. O esgotamento de recursos interrompe a sessão.

## Evidência de compatibilidade

- Todas as 344 produções comuns de `erl_parse.yrl` têm fixtures testemunha
  medidas; as 79 produções de anotações SSA estão excluídas
  (`tests/fixtures/parser/phase6/`).
- 43 fixtures positivas comparam-se estruturalmente com o OTP; 183 fixtures de
  rejeição, três fixtures de exceções do builder do OTP (`record_helper`,
  `record_extra`, `any_first`) e `bad.erl` cobrem os erros.
- Corpus de código-fonte real (auditoria opcional): `lists`, `maps`, `sets`,
  `erl_scan` da stdlib; `beam_ssa`, `beam_asm` e quatro cabeçalhos do
  compilador, usando mapeamentos `-I`/`--app-dir`, `maybe_expr` ativado,
  `compr_assign` desativado e `-DCOMPILER_VSN='"parser-compatibility"'`.
- `parser_stress` (cadeia de 12 000 operadores), `parser_mutations_0`..`3`
  (fragmentos de 900 mutações com semente, semente `0x29a016`, executados duas
  vezes) e `parser_hardening` delimitam o comportamento.
