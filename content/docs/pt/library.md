---
source: docs/library.md
sourceCommit: 6ed3851c
sourceSha256: 827659aa3cf1548562f97b6e8d7a37e0f230599570a6c78628cd7a72896102f9
translatedAt: 2026-10-15
---
# Módulos de biblioteca

Um subconjunto, pertencente ao projeto, dos
módulos `lists` e `maps` do OTP, escrito em Erlang a partir do comportamento
documentado do OTP (não copiado das fontes do OTP) e compilado juntamente com
os programas que o usam.

## Conteúdo

| Módulo | Funções |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1`, `foreach/2`, `mapfoldl/3`, `mapfoldr/3`, `partition/2`, `splitwith/2`; builtins do runtime `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`, `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2`, `keymember/3`, `keysearch/3`, `keydelete/3` ([módulo lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1`, `filter/2`, `map/2`, `foreach/2`, `update_with/3,4`; builtins do runtime `get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`, `without/2`, `from_keys/2` ([módulo maps](builtins.md#maps-module)) |
| [`file`](../library/kernel/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2,3`, `read_file_info/1,2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` sobre o driver de ficheiros ([ficheiros](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor da entrada padrão ou um ficheiro aberto), `request/1,2`, `requests/1,2` (o protocolo de E/S do OTP, [ficheiros](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` e `nl/0,1` são builtins do runtime ([io](io.md)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` sobre portas de socket ([sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/kernel/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/kernel/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Próprio do Clause: o protocolo do driver de sockets partilhado pelos três módulos acima |
| [`erlang`](../library/erts/erlang.erl) | Stubs gerados de todos os exports de `erlang` do OTP 29; os builtins substituem os seus, `nif_error/1,2` têm corpo, os restantes lançam `{not_implemented, F, A}` quando chamados ([módulo erlang](builtins.md#erlang-module)) |
| [`binary`](../library/stdlib/binary.erl) | Todas as funções do OTP 29: `replace/3,4` e `list_to_bin/1` em Erlang, as outras builtins do runtime ([módulo binary](builtins.md#binary-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Conversões, `bin_is_7bit/1` e marcas de ordem de bytes como builtins do runtime ([módulo unicode](builtins.md#unicode-module)); a normalização e as propriedades são stubs |
| [`math`](../library/stdlib/math.erl) | Todas as funções do OTP 29 como builtins do runtime ([módulo math](builtins.md#math-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Todas as funções do OTP 29 como builtins do runtime ([termos persistentes](builtins.md#persistent-terms)) |
| [`code`](../library/kernel/code.erl) | Consultas de módulos carregados como builtins do runtime sem code server ([módulo code](builtins.md#code-module)); os caminhos e o carregamento são stubs |
| [`os`](../library/kernel/os.erl) | `cmd/1` sobre uma porta ([subprocessos](ports.md#subprocesses)), `timestamp/0`, `system_time/0,1`, `perf_counter/0,1`, `getenv/2`; `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0` e `version/0` são builtins do runtime |

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
  com um átomo literal — `M:F(...)` com `M` literal, `fun M:F/A`,
  `apply(M, F, Args)` com `M` literal, `-behaviour(M)` ou `-import(M, ...)` —
  que nenhuma entrada define, o compilador procura `M.erl` nos diretórios de
  aplicações da biblioteca e depois nos `source_search_paths` do projeto
  ([projetos](projects.md#paths-and-discovery)), analisa e compila no lote o
  primeiro que encontrar, repetindo depois para os módulos que os ficheiros
  acrescentados nomeiam
  ([a que módulo um nome é resolvido](#which-module-a-name-resolves-to)). Uma
  chamada `M:F(...)` de um builtin do catálogo (`io:format/2`, `os:type/0`)
  não nomeia nenhum módulo.
- A biblioteca é `library/` da árvore de compilação, encontrada em relação a
  `clau` tal como o arquivo do runtime, com um diretório por aplicação OTP
  (`erts`, `kernel`, `stdlib`).
- Um módulo do lote com o mesmo nome substitui o módulo da biblioteca, com um
  aviso.
- Os módulos de biblioteca são módulos de lote comuns: são ligados aos
  executáveis e, para saída em objeto ou IR, produzem os seus próprios
  artefactos.
- Um módulo alcançado apenas através de nomes em tempo de execução
  (`M:F(...)` com `M` uma variável) não é acrescentado: essa chamada lança
  `undef`, a menos que outra coisa nomeie o módulo.
- As funções de biblioteca são código Erlang, pelo que cederão a execução
  (yield) como qualquer outro código quando o escalonador existir.

## Substituições de módulos do runtime

O step 41I do plano 11 (2026-10-12) decide como o Clause substitui os módulos
do OTP que o ERTS implementa em C (NIFs, BIFs, drivers de portas, os módulos
pré-carregados de `erts/preloaded/src`) e os módulos que o OTP gera durante a
sua compilação (`unicode_util`). O `kernel` e o `stdlib` do OTP são Erlang
simples, mas chamam esses módulos; os steps 41J e seguintes implementam este
contrato.

### Fornecido ou em falta

Tudo o que precisa do runtime e não pode ser escrito em Erlang simples é
decidido por módulo, e por grupo de funções quando um módulo mistura
responsabilidades:

- **Fornecido:** o Clause inclui o módulo com a lista de exports exata do
  OTP 29. Cada função tem um de quatro estados: `implemented` (um builtin do
  runtime ou um corpo Erlang sobre serviços do runtime existentes), `refused`
  (devolve ou lança o que os chamadores do OTP já tratam quando uma
  funcionalidade está ausente, como `{error, enotsup}`), `stub` (lança
  `error({not_implemented, F, A})` com `M:F/A` no topo da pilha, como fazem os
  [stubs de `erlang`](builtins.md#erlang-module); ainda não feito; orientação
  do utilizador de 2026-10-12) ou `declined` (um stub que fica, com uma razão
  como a distribuição ou o carregamento de código pendente do step 71 do
  plano). Um módulo começa com todas as funções como stubs, para que seja
  detetável e os seus chamadores compilem; os grupos passam depois ao estado
  decidido.
- **Em falta:** o Clause não inclui módulo nenhum, possivelmente para sempre,
  e regista porquê e que módulos do Clause de nível mais alto tomam o lugar
  dos seus chamadores. As camadas de ficheiros e de sockets `prim_*` de baixo
  nível são o caso típico: os programas usam antes `file`, `gen_tcp`,
  `gen_udp` e `inet` do Clause e, como os módulos do Clause prevalecem sobre
  os do OTP (ver abaixo), os chamadores do OTP de um módulo em falta nunca
  entram num lote. Um módulo em falta nunca recebe um stub, pelo que uma
  referência a ele é um erro em tempo de compilação, nunca uma surpresa em
  tempo de execução.

As funções triviais para o runtime são implementadas sem uma decisão
separada.

### A que módulo um nome é resolvido

O OTP é opcional na máquina do utilizador; quando presente, não pode alterar
o que uma compilação compila. Um nome de módulo é resolvido por esta ordem:

1. **Entradas explícitas:** os códigos-fonte que o utilizador lista
   (`sources`, `source_dirs`, entradas posicionais). Uma que tenha o nome de
   um módulo do Clause substitui-o, com um aviso que indica ambos os
   ficheiros.
2. **Módulos do Clause:** os módulos da biblioteca, incluindo as
   substituições fornecidas.
3. **`source_search_paths`**, tal como descrito em
   [projetos](projects.md#paths-and-discovery).

O nome de um módulo em falta está reservado: um ficheiro com o mesmo nome num
caminho de pesquisa (por exemplo `erts/preloaded/src/prim_file.erl` do OTP)
não é usado, e o diagnóstico indica que o Clause não fornece o módulo. Uma
entrada explícita pode ainda fornecê-lo, com o aviso de substituição.

`ignore_modules` aplica-se também aos módulos do Clause: um módulo do Clause
ignorado fica em falta no lote, e uma entrada explícita pode então
fornecê-lo sem aviso, uma vez que nada é substituído.

### Ficheiros

- Os módulos de biblioteca ficam em `library/<application>/`, com o nome da
  aplicação OTP a que o módulo pertence no OTP: `erts` (os equivalentes
  pré-carregados e `erlang`), `kernel` (`file`, `gen_tcp`, `gen_udp`, `inet`,
  `os` e o `clause_socket` próprio do Clause), `stdlib` (`binary`, `lists`,
  `maps`, `math`, `io`, `unicode`, `unicode_util`). A consulta da biblioteca
  procura em todos os diretórios de aplicações; um nome de módulo existe no
  máximo num deles.
- `library/modules.terms` lista todos os módulos sobre os quais o Clause
  decide: `{Module, Application, provided}.` ou
  `{Module, Application, missing, "reason"}.` O compilador lê-o para saber
  que nomes são módulos do Clause e quais estão reservados.
- Cada módulo fornecido tem um inventário `<module>.terms` ao seu lado:
  `{Name, Arity, Group, Status}.` por export do OTP 29, ordenado por nome e
  aridade, em que `Group` indica o grupo de decisão (por exemplo `stdlib`,
  `distribution`, `beam`). `erlang.terms` mantém o seu próprio formato
  (`{Name, Arity, Flags, Status}`, [módulo erlang](builtins.md#erlang-module)).
- As listas de exports são observadas a partir de um OTP 29 do anfitrião
  (`M:module_info(exports)`); nenhum código-fonte do OTP é copiado. Os
  resultados e os termos de erro das funções implementadas coincidem com o
  OTP 29; as diferenças deliberadas vão para
  [diferenças](differences.md).
- Cada módulo de biblioteca do Clause exporta a lista completa do OTP 29 para
  o seu nome, para que o código OTP compilado contra ele encontre todas as
  funções; os próprios `lists`, `maps`, `file`, `io`, `os`, `gen_tcp`,
  `gen_udp` e `inet` do Clause também recebem inventários e stubs para o que
  ainda não implementam.

### Tipos

Como os módulos do Clause prevalecem sobre os do OTP, o código OTP que nomeia
`file:filename()` ou `erlang:time_unit()` nas suas specs tem de encontrar
esses tipos nos módulos do Clause. Cada módulo fornecido cujo equivalente OTP
exporta tipos inclui `<module>.types.hrl` do seu próprio diretório: a lista
`-export_type`, depois os tipos exportados e os tipos locais e records que
eles usam, tal como o OTP os define (a documentação mostra as mesmas
definições; a documentação instalada não traz definições de tipos, pelo que
estas vêm da implementação: a informação de depuração do beam, ou o
código-fonte distribuído de um módulo pré-carregado como `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` escreve o
cabeçalho a partir do OTP do anfitrião, e `--check` compara as suas formas com
uma observação nova (CTest `library_freshness`); `library_modules.py check`
exige que cada cabeçalho seja incluído pelo seu módulo. Os tipos que os
cabeçalhos nomeiam a partir de módulos fora do programa
(`unicode:chardata()`, `calendar:datetime()`) e as uniões largas do OTP
(`file:posix()` tem mais membros do que o grafo de tipos mantém) resolvem-se
para `term()` sem aviso: os diagnósticos pertencem à biblioteca do Clause, não
ao programa do utilizador.

### Serviços do kernel no arranque

`file`, `io`, `code` e `logger` do OTP chamam servidores registados
(`file_server_2`, `code_server`, o servidor de io de um group leader,
`logger`) que a aplicação `kernel` inicia no arranque. Um executável do
Clause não inicia nenhum deles e, por decisão de 2026-10-12, continua por
agora a não iniciar nenhum: os próprios `file` e `io` do Clause não precisam
de servidor, e um módulo OTP que precise de um falha da mesma forma que falha
no OTP sem esse servidor (`noproc`). Custo: o código OTP que regista através
de `logger` ou chama `code` em tempo de execução não funciona até uma entrada
posterior do registo selecionar um conjunto mínimo de serviços para o objeto
de arranque. Arrancar toda a aplicação `kernel` não está planeado.

### Registo

O projeto luerl conduz este trabalho. Após cada step, execute

```text
clau.bat --project test-luerl --entry luerl:init
```

classifique cada erro (`unknown module`, `undefined function M:F/A`, sintaxe
ou funcionalidade não suportada, outro) e atribua cada um a um step da fase
H3 do plano 11, a outro item pendente ou a uma recusa registada. Com o stderr
da execução guardado num ficheiro,
`python tests/compiler/library/library_modules.py report FILE` imprime a
classificação em tabelas: cada módulo desconhecido com o seu número de erros,
os módulos chamadores e as funções chamadas com as aridades; as funções não
definidas por módulo; as outras mensagens com as suas contagens.

### Ferramentas

Todas ficam em `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` escreve
  `LIBRARY/APP/MODULE.terms` a partir de `MODULE:module_info(exports)` do OTP
  do anfitrião, mantendo o grupo e o estado de cada entrada já existente; um
  novo export começa como `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` escreve o ficheiro
  do módulo uma vez, com todos os exports como stubs; a partir daí o ficheiro
  é editado à mão.
- `python library_modules.py check ROOT` (CTest `library_inventory`, sem OTP)
  comunica todas as discordâncias: um módulo fornecido sem os seus ficheiros,
  um módulo em falta com um ficheiro, um inventário não listado como
  fornecido, um export ausente do inventário ou o inverso, uma entrada
  `stub`/`declined` que não é um stub que lança `undef`, uma entrada
  `implemented`/`refused` sem corpo nem builtin do catálogo.
  `library_rejects` prova-o numa biblioteca de fixture deliberadamente
  inconsistente.
- O CTest `library_freshness` (etiqueta `host_otp`) volta a observar todos os
  inventários e exige-os inalterados, depois observa, gera, verifica e compila
  um módulo novo de ponta a ponta. `library_report` executa o `clau` num
  programa de fixture e verifica as linhas do relatório.

| Módulo | Decisão (2026-10-12) | Razão ou step do plano |
| --- | --- | --- |
| `init` | fornecido; implementado exceto `boot/1`, `restart/0,1` e `make_permanent/2`, recusados | respostas de argumentos e de estado de um sistema arrancado (41L, [módulo init](builtins.md#init-module)) |
| `persistent_term` | fornecido, tudo stubs | tabela de termos global do runtime (41M) |
| `erts_internal` | fornecido; grupos `stdlib` e `counters` implementados, `get_creation/0` e `map_hashmap_children/1` recusados, os grupos `distribution`, `beam` e `emulator` declinados | 41N ([erts_internal](builtins.md#erts-internal)); sem distribuição, sem ficheiros `.beam` |
| `atomics`, `counters`, `erts_code_purger` | fornecidos; `atomics`, `counters` implementados; `purge/1`, `soft_purge/1` implementados, o processo de purga declinado | 41N ([atomics e counters](builtins.md#atomics-and-counters)); o carregamento de código espera pelo step 71 |
| `unicode_util` | fornecido, implementado (41O1, 41O2) | tabelas geradas a partir das respostas do OTP e dos dados Unicode ([unicode_util](builtins.md#unicode-util)) |
| `erl_prim_loader` | fornecido; consultas de ficheiros implementadas sobre `file`, carregamento e arquivos declinados | 41P ([ficheiros](ports.md#standard-io-and-files)); o carregamento de código espera pelo step 71 |
| `zlib` | fornecido, implementado sobre o zlib fixado (41Q) | os streams são referências handle ([módulo zlib](builtins.md#zlib-module)) |
| `prim_eval` | fornecido, implementado (41S) | `'receive'/2` sobre os passos de um receive compilado ([prim eval](builtins.md#prim-eval)) |
| `application_controller` | fornecido, tudo stubs | sobrepõe-se ao do OTP, que chama `prim_file` (o luerl nomeia-o através de `application` do OTP) |
| `lists`, `maps`, `io`, `file`, `os`, `gen_tcp`, `gen_udp`, `inet` | fornecidos, listas de exports completas do OTP 29; o que o Clause tinha continua implementado, o resto são stubs | crescem conforme o registo exigir |
| `re` | fornecido; implementado (41ZA, 41ZB) exceto `import/1`, declinado | sobre o PCRE2 fixado ([módulo re](builtins.md#re-module)); o Clause não exporta padrões |
| `prim_file`, `prim_buffer` | em falta, decidido em 41P | o `file` do Clause é a camada de ficheiros; `filelib`/`filename` do OTP correm sobre ele |
| `prim_socket`, `prim_net`, `prim_inet`, `socket_registry`, `socket`, `net` | em falta, decidido em 41R | `gen_tcp`, `gen_udp`, `inet` do Clause são a camada de rede; `gen_tcp_socket`, `gen_udp_socket`, `inet_tcp`, `inet_udp` do OTP só são alcançados a partir dos módulos do OTP sobrepostos ([sockets](ports.md#sockets-57f)) |

Camada mais recente do luerl (2026-10-12, após os steps 41K1 e 41K2, com
`NEW_STACKTRACE` definido como o `rebar.config.script` do luerl faz no OTP 21
e posteriores, e com `inet` já fora de `ignore_modules`): o alvo compila e
liga sem erros. Restam 83 avisos: 74 tipos dos `erl_parse` e `compile`
ignorados, 8 tipos de módulos OTP fora do programa nomeados por código OTP que
o alvo compila, e um alargamento por orçamento do grafo de tipos nesse
código. O executável inicia `luerl:init/0` e termina com 0. A camada seguinte
é o comportamento em tempo de execução: que stubs o luerl alcança quando
executa código Lua.

Camada de execução (2026-10-14, após as fases H3–H5): um driver que executa
35 excertos Lua através de `luerl:do` compila com 17 avisos e imprime a saída
do OTP 29 para 34 deles, `os.date` incluído. O restante, um `goto`, falha com
o `function_clause` do OTP; só os seus frames da pilha diferem, sem argumentos
nem localizações ([diferenças](differences.md)).
