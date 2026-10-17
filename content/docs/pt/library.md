---
source: docs/library.md
sourceCommit: a8c3f8f6
sourceSha256: f657ad1632b57e9c9b11ad04f870350112a7cac942b10e5483e1aa26d1c79fc7
translatedAt: 2026-10-17
---
# Módulos de biblioteca

O Clause inclui as suas próprias versões dos módulos do OTP que os programas
chamam, escritas em Erlang a partir do comportamento documentado do OTP (não
copiadas das fontes do OTP) sobre [builtins](builtins.md) do runtime, e
compila-as juntamente com os programas que as usam.

## Conteúdo

Cada módulo fornecido exporta a lista completa do OTP 29 para o seu nome; o seu
inventário `<module>.terms` ([ficheiros](#files)) regista que funções estão
implementadas e quais são stubs.

| Módulo | Conteúdo |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | As funções habituais; funções de dados como `sublist/2,3`, `flatten/1,2`, `usort/1`, `keymember/3` são builtins do runtime ([módulo lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | As funções habituais e os iteradores; `get/3`, `merge/2`, `update/3`, `with/2`, ... são builtins do runtime ([módulo maps](builtins.md#maps-module)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor da entrada padrão ou um ficheiro aberto), `request/1,2`, `requests/1,2` (o protocolo de E/S do OTP, [ficheiros](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` e `nl/0,1` são builtins do runtime ([io](io.md)) |
| [`binary`](../library/stdlib/binary.erl) | Todas as funções; `replace/3,4` e `list_to_bin/1` em Erlang, as outras builtins do runtime ([módulo binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Todas as funções como builtins do runtime ([módulo math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Conversões, `bin_is_7bit/1` e marcas de ordem de bytes como builtins do runtime ([módulo unicode](builtins.md#unicode-module)); a normalização e as propriedades são stubs |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Todas as funções sobre tabelas geradas ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Todas as funções exceto `import/1`, sobre o PCRE2 ([módulo re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Abrir, ler, escrever, posicionar e fechar ficheiros, leituras e escritas de ficheiros inteiros, informação de ficheiros e operações sobre diretórios, sobre o driver de ficheiros ([ficheiros](ports.md#standard-io-and-files)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl) | Sockets sobre portas de socket ([sockets](ports.md#sockets)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Próprio do Clause: o protocolo do driver de sockets partilhado pelos três módulos acima |
| [`os`](../library/kernel/os.erl) | `cmd/1` sobre uma porta, consultas de ambiente, de tempo e de versão ([módulo maps](builtins.md#maps-module)) |
| [`code`](../library/kernel/code.erl) | Consultas de módulos carregados sem code server ([módulo code](builtins.md#code-module)); os caminhos e o carregamento são stubs |
| [`application_controller`](../library/kernel/application_controller.erl) | Tudo stubs; sobrepõe-se ao do OTP, que chama `prim_file` (o luerl alcança-o através de `application` do OTP) |
| [`erlang`](../library/erts/erlang.erl) | Stubs gerados de todos os exports de `erlang` do OTP 29; os builtins substituem os seus, `nif_error/1,2` têm corpo, os restantes lançam `{not_implemented, F, A}` quando chamados ([módulo erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | As respostas de um sistema arrancado; `boot/1`, `restart/0,1` e `make_permanent/2` recusados ([módulo init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Todas as funções como builtins do runtime ([termos persistentes](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Todas as funções ([atomics e counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | O que `stdlib` e `kernel` chamam; os grupos de distribuição, `.beam`, emulador e processo de purga declinados ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Consultas de ficheiros sobre `file`; carregamento e arquivos declinados ([ficheiros](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Todas as funções sobre o zlib fixado ([módulo zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` sobre os passos de um receive compilado ([prim eval](builtins.md#prim-eval)) |

Os resultados e as razões de erro coincidem com o OTP 29, incluindo as formas de
erro das implementações em Erlang do OTP (`lists:map(F, x)` dá
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)`
`badarg`) e dos seus BIFs (`lists:member/2`, `lists:keyfind/3`,
`lists:reverse/2`, as funções de `maps`: `badarg`, `{badmap, M}`,
`{badkey, K}`). `lists:member/2` compara com `=:=`, `lists:keyfind/3` com `==`.
`lists:sort/1` é uma ordenação por fusão (merge sort) estável cujas passagens
alternam sequências ascendentes e descendentes, pelo que nenhuma fusão inverte
uma sequência. Os stack traces indicam as funções da biblioteca, não as do OTP.

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
  chamada `M:F(...)` de um builtin do catálogo (`io:format/2`, `os:type/0`) não
  nomeia nenhum módulo. `--print-inputs` lista as entradas que isto acrescenta.
- A biblioteca é `library/` da árvore de compilação, encontrada em relação a
  `clau` tal como o arquivo do runtime, com um diretório por aplicação OTP
  (`erts`, `kernel`, `stdlib`).
- Um módulo do lote com o mesmo nome substitui o módulo da biblioteca, com um
  aviso; os builtins do catálogo com esse nome continuam a prevalecer
  ([registo](builtins.md#registration)).
- Os módulos de biblioteca são módulos de lote comuns: são ligados aos
  executáveis e, para saída em objeto ou IR, produzem os seus próprios
  artefactos. São código Erlang, pelo que cedem a execução (yield) como qualquer
  outro código.
- Um módulo alcançado apenas através de nomes em tempo de execução (`M:F(...)`
  com `M` uma variável) não é acrescentado: essa chamada lança `undef`, a menos
  que outra coisa nomeie o módulo.

## Substituições de módulos do runtime

O Clause substitui os módulos do OTP que o ERTS implementa em C (NIFs, BIFs,
drivers de portas, os módulos pré-carregados de `erts/preloaded/src`) e os
módulos que o OTP gera durante a sua compilação (`unicode_util`). O `kernel` e o
`stdlib` do OTP são Erlang simples, mas chamam esses módulos.

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
  [stubs de `erlang`](builtins.md#erlang-module); ainda não feito) ou
  `declined` (um stub que fica, com uma razão como a distribuição ou o
  carregamento de código). Um módulo novo começa com todas as funções como
  stubs, para que seja detetável e os seus chamadores compilem; os grupos passam
  depois ao estado decidido.
- **Em falta:** o Clause não inclui módulo nenhum, possivelmente para sempre, e
  regista porquê e que módulos do Clause de nível mais alto tomam o lugar dos
  seus chamadores (`library/modules.terms`). As camadas de ficheiros e de
  sockets `prim_*` de baixo nível (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) e `socket`, `net` são os módulos
  em falta: os programas usam antes `file`, `gen_tcp`, `gen_udp` e `inet` do
  Clause e, como os módulos do Clause prevalecem sobre os do OTP (ver abaixo),
  os chamadores do OTP de um módulo em falta (`gen_tcp_socket`, `inet_tcp`, ...
  do OTP) nunca entram num lote. Um módulo em falta nunca recebe um stub, pelo
  que uma referência a ele é um erro em tempo de compilação, nunca uma surpresa
  em tempo de execução.

As funções triviais para o runtime são implementadas sem uma decisão separada.

### A que módulo um nome é resolvido

O OTP é opcional na máquina do utilizador; quando presente, não pode alterar o
que uma compilação compila. Um nome de módulo é resolvido por esta ordem:

1. **Entradas explícitas:** os códigos-fonte que o utilizador lista (`sources`,
   `source_dirs`, entradas posicionais). Uma que tenha o nome de um módulo do
   Clause substitui-o, com um aviso que indica ambos os ficheiros.
2. **Módulos do Clause:** os módulos da biblioteca, incluindo as substituições
   fornecidas.
3. **`source_search_paths`**, tal como descrito em
   [projetos](projects.md#paths-and-discovery).

O nome de um módulo em falta está reservado: um ficheiro com o mesmo nome num
caminho de pesquisa (por exemplo `erts/preloaded/src/prim_file.erl` do OTP) não
é usado, e o diagnóstico indica que o Clause não fornece o módulo. Uma entrada
explícita pode ainda fornecê-lo, com o aviso de substituição.

`ignore_modules` aplica-se também aos módulos do Clause: um módulo do Clause
ignorado fica em falta no lote, e uma entrada explícita pode então fornecê-lo
sem aviso, uma vez que nada é substituído.

### Ficheiros

- Os módulos de biblioteca ficam em `library/<application>/`, com o nome da
  aplicação OTP a que o módulo pertence no OTP: `erts` (os equivalentes
  pré-carregados e `erlang`), `kernel`, `stdlib`. Os módulos auxiliares privados
  do Clause (`clause_socket`, `clause_re`, `clause_unicode`, `clause_zlib`,
  `clause_receive`, `clause_maps`) ficam ao lado dos módulos que servem. A
  consulta da biblioteca procura em todos os diretórios de aplicações; um nome
  de módulo existe no máximo num deles.
- `library/modules.terms` lista todos os módulos sobre os quais o Clause decide:
  `{Module, Application, provided}.` ou
  `{Module, Application, missing, "reason"}.` O compilador lê-o para saber que
  nomes são módulos do Clause e quais estão reservados.
- Cada módulo fornecido tem um inventário `<module>.terms` ao seu lado:
  `{Name, Arity, Group, Status}.` por export do OTP 29, ordenado por nome e
  aridade, em que `Group` indica o grupo de decisão (por exemplo `stdlib`,
  `distribution`, `beam`). `erlang.terms` mantém o seu próprio formato
  (`{Name, Arity, Flags, Status}`, [módulo erlang](builtins.md#erlang-module)).
- As listas de exports são observadas a partir de um OTP 29 do anfitrião
  (`M:module_info(exports)`); nenhum código-fonte do OTP é copiado. Os
  resultados e os termos de erro das funções implementadas coincidem com o
  OTP 29; as diferenças deliberadas vão para [diferenças](differences.md).

### Tipos

Como os módulos do Clause prevalecem sobre os do OTP, o código OTP que nomeia
`file:filename()` ou `erlang:time_unit()` nas suas specs tem de encontrar esses
tipos nos módulos do Clause. Cada módulo fornecido cujo equivalente OTP exporta
tipos inclui `<module>.types.hrl` do seu próprio diretório: a lista
`-export_type`, depois os tipos exportados e os tipos locais e records que eles
usam, tal como o OTP os define (a documentação mostra as mesmas definições; a
documentação instalada não traz definições de tipos, pelo que estas vêm da
implementação: a informação de depuração do beam, ou o código-fonte distribuído
de um módulo pré-carregado como `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` escreve o
cabeçalho a partir do OTP do anfitrião, e `--check` compara as suas formas com
uma observação nova (CTest `library_freshness`); `library_modules.py check`
exige que cada cabeçalho seja incluído pelo seu módulo. Os tipos que os
cabeçalhos nomeiam a partir de módulos fora do programa (`unicode:chardata()`,
`calendar:datetime()`) e as uniões largas do OTP (`file:posix()` tem mais
membros do que o grafo de tipos mantém) resolvem-se para `term()` sem aviso: os
diagnósticos pertencem à biblioteca do Clause, não ao programa do utilizador.

### Serviços do kernel no arranque

`file`, `io`, `code` e `logger` do OTP chamam servidores registados
(`file_server_2`, `code_server`, o servidor de io de um group leader, `logger`)
que a aplicação `kernel` inicia no arranque. Um executável do Clause não inicia
nenhum deles: os próprios `file` e `io` do Clause não precisam de servidor, e um
módulo OTP que precise de um falha da mesma forma que falha no OTP sem esse
servidor (`noproc`). O código OTP que regista através de `logger` ou chama
`code` em tempo de execução não funciona, portanto. Arrancar toda a aplicação
`kernel` não está planeado.

### Registo

Os programas reais conduzem este trabalho; o projeto luerl é o condutor atual
([21-lib](../.agents/21-lib.md)). Compile-o e execute-o, classifique cada erro
(`unknown module`, `undefined function M:F/A`, sintaxe ou funcionalidade não
suportada, outro) e atribua cada um a um passo do plano, a outro item pendente
ou a uma recusa registada. Com o stderr da execução guardado num ficheiro,
`python tests/compiler/library/library_modules.py report FILE` imprime a
classificação em tabelas: cada módulo desconhecido com o seu número de erros, os
módulos chamadores e as funções chamadas com as aridades; as funções não
definidas por módulo; as outras mensagens com as suas contagens.

### Ferramentas

Todas ficam em `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` escreve
  `LIBRARY/APP/MODULE.terms` a partir de `MODULE:module_info(exports)` do OTP
  do anfitrião, mantendo o grupo e o estado de cada entrada já existente; um
  novo export começa como `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` escreve o ficheiro do
  módulo uma vez, com todos os exports como stubs; a partir daí o ficheiro é
  editado à mão.
- `python library_modules.py check ROOT` (CTest `library_inventory`, sem OTP)
  comunica todas as discordâncias: um módulo fornecido sem os seus ficheiros, um
  módulo em falta com um ficheiro, um inventário não listado como fornecido, um
  export ausente do inventário ou o inverso, uma entrada `stub`/`declined` que
  não é um stub `not_implemented`, uma entrada `implemented`/`refused` sem corpo
  nem builtin do catálogo.
  `library_rejects` prova-o numa biblioteca de fixture deliberadamente
  inconsistente.
- O CTest `library_freshness` (etiquetas `host_otp`, `full_only`) volta a
  observar todos os inventários e exige-os inalterados, depois observa, gera,
  verifica e compila um módulo novo de ponta a ponta. `library_report` executa o
  `clau` num programa de fixture e verifica as linhas do relatório.
