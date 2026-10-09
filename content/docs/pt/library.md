---
source: docs/library.md
sourceCommit: 06042fa
sourceSha256: 8f2e8537bf42e4f4e23eff414105ee6bb25929992d881da864e86e3eee56eb56
translatedAt: 2026-10-09
---
# Módulos de biblioteca

Plano 11, step 39 (2026-10-07): um subconjunto, pertencente ao projeto, dos
módulos `lists` e `maps` do OTP, escrito em Erlang a partir do comportamento
documentado do OTP (não copiado das fontes do OTP) e compilado juntamente com
os programas que o usam.

## Conteúdo

| Módulo | Funções |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1` |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1` |
| [`file`](../library/stdlib/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` sobre o driver de ficheiros ([ficheiros](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor da entrada padrão ou um ficheiro aberto); `format/1,2` e `put_chars/1` são builtins do runtime |
| [`gen_tcp`](../library/stdlib/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` sobre portas de socket ([sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/stdlib/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/stdlib/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/stdlib/clause_socket.erl) | Próprio do Clause: o protocolo do driver de sockets partilhado pelos três módulos acima |
| [`os`](../library/stdlib/os.erl) | `cmd/1` sobre uma porta ([subprocessos](ports.md#subprocesses)); `type/0` e `getenv/1` são builtins do runtime |

Os resultados e as razões de erro coincidem com o OTP 29, incluindo as formas
de erro das implementações em Erlang do OTP (`lists:map(F, x)` dá
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)`
`badarg`) e dos seus BIFs (`lists:member/2`, `lists:keyfind/3`,
`lists:reverse/2`, as funções de `maps`: `badarg`, `{badmap, M}`,
`{badkey, K}`). `lists:member/2` compara com `=:=`, `lists:keyfind/3` com `==`.
`lists:sort/1` é uma ordenação por fusão (merge sort) estável. Os stack traces
indicam as funções da biblioteca, não as do OTP.

## Como os programas os obtêm

- Quando um lote (entradas posicionais ou um alvo de projeto) nomeia um módulo
  com um átomo literal — `M:F(...)` com `M` literal, `fun M:F/A`, ou
  `apply(M, F, Args)` com `M` literal — que nenhuma entrada define, e
  `<library>/M.erl` existe, o compilador analisa e compila esse ficheiro no
  lote, repetindo depois para os módulos que os ficheiros acrescentados
  nomeiam. Uma chamada `M:F(...)` de um builtin do catálogo (`io:format/2`,
  `os:type/0`) não nomeia nenhum módulo.
- `<library>` é `library/stdlib` da árvore de compilação, encontrado em relação
  a `clau` tal como o arquivo do runtime.
- Um módulo do lote com o mesmo nome substitui o módulo da biblioteca.
- Os módulos de biblioteca são módulos de lote comuns: são ligados aos
  executáveis e, para saída em objeto ou IR, produzem os seus próprios
  artefactos.
- Um módulo alcançado apenas através de nomes em tempo de execução
  (`M:F(...)` com `M` uma variável) não é acrescentado: essa chamada lança
  `undef`, a menos que outra coisa nomeie o módulo.
- As funções de biblioteca são código Erlang, pelo que cederão a execução
  (yield) como qualquer outro código quando o escalonador existir.
