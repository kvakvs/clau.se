---
source: docs/preprocessor.md
sourceCommit: 06042fa
sourceSha256: 08b6bf1b734adf5fc6f8aef3972fd56c8f9d20c1a688610c989862794900cd67
translatedAt: 2026-10-09
---
# Pré-processador

Reimplementação nativa em C++ do `epp` do OTP para o código-fonte fixado
`maint-29`. O Boost.Parser trata as regras de caracteres; os metadados
partilhados do compilador fornecem a precedência dos operadores. Os tokens
expandidos nunca são convertidos de volta em texto de código-fonte.

`PreprocessorSession` devolve as formas expandidas (incluindo os atributos
`-file` implícitos), diagnósticos estruturados e instantâneos imutáveis de
features por forma; `features()` expõe o estado final da sessão ao parser.
Esta é uma interface interna, não um formato público de fase.
`DirectiveReader` é a API mais antiga, só de sintaxe.

## Comportamento suportado

- Macros de objeto e sobrecarregadas por aridade, substituição em bruto,
  argumentos com blocos/funs aninhados, conversão em string com a grafia
  canónica dos tokens do OTP, redefinição, remoção de definição e diagnósticos
  de ciclos de dependência.
- Aninhamento de condicionais com efeitos e erros saltados, diagnósticos de
  EOF.
- `-include`/`-include_lib`, prefixos de caminho com variáveis de ambiente,
  recursão protegida.
- `?MODULE`, `?BASE_MODULE` (e as formas `_STRING`), `?FILE`, `?LINE`,
  `?FUNCTION_NAME`/`?FUNCTION_ARITY`, `?FEATURE_AVAILABLE`/`?FEATURE_ENABLED`,
  `?OTP_RELEASE` (29) e `?MACHINE` (`'BEAM'`, apenas para compatibilidade de
  código-fonte).
- Avaliação de guards em `-if`/`-elif` com inteiros arbitrários e o catálogo
  de guard BIFs do OTP; não são executadas chamadas arbitrárias.
- Features do OTP 29.1: `maybe_expr` (ativada por omissão, controla
  `maybe`/`else`) e `compr_assign` (experimental, desativada). Um `all` inicial
  seleciona ambas; `-feature(all, ...)` no código-fonte é inválido, como no
  epp. Outros nomes são erros.

## Políticas de compatibilidade

- Pesquisa de includes: diretório do ficheiro atual, diretório de trabalho e
  depois os caminhos de include pela ordem da API. A CLI inverte os `-I`
  repetidos para corresponder ao `erlc`. Os caminhos absolutos dispensam a
  pesquisa. `include_lib` tenta os caminhos comuns e depois os diretórios de
  aplicações indicados explicitamente; sem code server nem adivinhação de
  versões.
- Os prefixos de caminho `$VAR` usam um resolvedor injetado; as variáveis não
  definidas ficam literais. Os operandos de include não são expandidos como
  macros. Os ficheiros são descodificados como UTF-8 ou Latin-1 declarado;
  aplicam-se as regras de caminhos do anfitrião, independentemente do CPU
  alvo.
- Os includes partilham o estado de macros/features/módulo; cada ficheiro tem
  a sua própria pilha de condicionais e o seu mapeamento lógico de ficheiros.
- As condições validam todos os ramos antes da avaliação em curto-circuito.
  Sintaxe inválida é um erro; variáveis não associadas, resultados não
  booleanos e exceções de avaliação selecionam falso. O acesso a campos/índices
  de records em condições falha; um acesso a record não selecionado em
  curto-circuito é válido.
- A construção de records numa condição recebe um diagnóstico controlado
  (`record construction requires record expansion`); o epp do OTP 29.1 falha
  nesse caso.
- Os valores iniciais de `-D` são termos literais normalizados em tokens,
  incluindo binaries e funs externas que `erl_parse:tokens/1` não consegue
  representar.
- `self()` é um pid sintético estável e `node()` é `nonode@nohost`.
- Um LF imediatamente a seguir ao ponto final de um include avança a linha de
  `-file` devolvida; espaço, comentário e CRLF seguem o `scan_dot` de um
  carácter do OTP.

## Limites e diagnósticos

Valores por omissão (configuráveis através de `PreprocessorLimits`): 256
níveis de expansão e 1 000 000 de tokens produzidos por forma, profundidade de
include 64, aninhamento de expressões 256, mais limites fixos de 4 194 240
bits para inteiros (o limite do OTP em anfitriões de 64 bits) e 1 000 000 de
bits para valores bitstring. O esgotamento é um
diagnóstico de recursos, nunca uma condição falsa silenciosa.

Os diagnósticos incluem uma categoria estável, a gravidade, intervalos
físicos, coordenadas lógicas opcionais e intervalos de macros/includes
relacionados. Os avisos não provocam falha; os erros registam a falha enquanto
a recuperação continua no limite da forma seguinte.

## Testes

Os goldens de tokens (`semantic/*.erl.tokens`) registam os tipos de tokens do
epp, os valores descodificados (floats como bits binary64) e a ordem dos
diagnósticos; a formulação não tem de ser igual à do OTP. Os fragmentos locais
`semantic/headers/*.hrl` substituem os cabeçalhos do OTP antes copiados.
`preprocessor_workflow` cobre árvores de includes reais, a ordem das opções, o
ambiente, Latin-1 e casos de condições através da CLI.
