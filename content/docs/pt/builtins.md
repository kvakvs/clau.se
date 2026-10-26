---
source: docs/builtins.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d6df02dea1e6270774c9766671b42d9c4b5af4090512da97273a2a4a3a58197f
translatedAt: 2026-10-26
---
# Builtins

Funções que o runtime implementa em C++: BIFs de `erlang` e funções de outros
módulos cujas contrapartes no OTP são BIFs, NIFs ou precisam do runtime.
Registadas por módulo, função e aridade; chamadas diretamente, por chamadas
dinâmicas e como funs. O código-fonte está em `runtime/src/builtins/`; as
diferenças observáveis face ao OTP estão em [diferenças](differences.md).

## Que builtins existem

- Catálogo `abi::v1::bridge_builtins`
  ([builtins.hpp](../abi/include/clause/abi/builtins.hpp)): todos os builtins que
  o compilador e o runtime conhecem; os comentários dos grupos indicam o
  ficheiro que os implementa.
- O índice de uma entrada é o número que o código gerado passa à ponte; o
  catálogo pode ser reordenado (compilador e runtime compilam em conjunto).
- Módulo `erlang`: guard BIFs, operadores como funções, `display/1`, `halt/0,1`,
  lançamento de exceções, acesso a termos, conversões, processos, portas,
  formato externo de termos, tempo, informação do sistema, informação de funs,
  hashing, carregamento de código.
- Outros módulos: uma secção para cada um abaixo; módulos auxiliares privados
  (`clause_unicode`, `clause_re`, `clause_zlib`, `clause_receive`, ...) servem
  o código de biblioteca Erlang.
- O estado por função (builtin, corpo Erlang, stub) está em
  `library/<application>/<module>.terms` ([biblioteca](library.md#files)).
- Uma chamada qualificada de um builtin do catálogo chama a ponte; qualquer
  outra função de `erlang` chega ao [módulo de biblioteca erlang](#erlang-module).

## Como as chamadas chegam até eles

| Código-fonte | Caminho |
| --- | --- |
| `abs(X)`, `X + Y`, `display`, `halt`, `error` | Código inline ou um serviço dedicado |
| Builtins do catálogo sem serviço inline (`A -- B`, ...) | Entrada como numa função: `CLAUSE_builtin_frame_v1`, argumentos nos registos |
| Builtins diretos (nunca fazem trap, esperam ou atuam sobre outro processo) | `CLAUSE_builtin_call_v1` devolve o resultado |
| Builtins rápidos (`length`, `binary_to_list`, `list_to_binary`, `iolist_to_binary`) | Caminho rápido limitado (256 células, 4096 bytes de resultado); caso contrário, entrada no frame |
| `A ++ B` | Um `A` próprio e curto é copiado inline; caso contrário, entrada |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externa `erlang:F/A` associada ao builtin |
| `M:F(Args)`, `apply/3`, `fun M:F/A` em runtime | Primeiro a exportação do módulo, depois o builtin |

- `fun F/A` de uma auto-importação que o módulo não define nem suprime é
  `fun erlang:F/A`, como no OTP. As não auto-importadas (`display/1`, `raise/3`,
  `make_tuple/2,3`, ...) precisam do prefixo `erlang:`.
- Um frame de builtin tem corpo nulo: entrar não empilha nenhum frame, pelo
  que uma chamada de cauda regressa ao chamador do chamador.
- Os erros (`badarg`, `badarith`, `system_limit`, `{badmap, M}`, `{badkey, K}`)
  usam o canal de falhas verificado.
- O acesso a termos e as conversões seguem as regras de `badarg` do OTP:
  - `setelement/3`: índice pequeno no tuplo; `make_tuple/2,3`: tamanho
    0..16,777,215; `A ++ B`: `A` próprio; `A -- B`: listas próprias, `=:=`,
    O((n + m) log m).
  - `list_to_atom/1`: o 256.º carácter dá `system_limit`; a tabela de átomos
    cheia (`--max-atoms`) termina com código 70.
  - `integer_to_list/2`, `list_to_integer/2`: base 2..36; `system_limit` acima
    de 1,262,611 dígitos decimais.
  - `float_to_list/1,2`: formatos do OTP (`scientific`, `decimals`, `compact`,
    `short`); 256+ bytes de texto dão `badarg`.
  - As versões binary partilham as regras de texto
    (`erlang/conversion_text.cpp`); o texto de um número de vírgula flutuante
    precisa de dígitos de ambos os lados do ponto.
- `function_exported/3`: verdadeiro para uma exportação do programa ou um
  builtin registado.

## Porções

Os builtins cujo trabalho cresce com uma lista ou binary executam em porções
limitadas, como as BIFs com trap do OTP.

- Cada builtin em que se entra gasta uma redução; uma porção faz
  `WORK_PER_REDUCTION` (16) unidades por redução restante na fatia.
- Trabalho restante: `ProcessStack::trap` designa uma continuação; os termos de
  estado ficam nos registos (raízes), o estado nativo em `TrapState`. O
  processo cede e retoma mais tarde.
- Pode continuar numa exportação Erlang (`io` para um dispositivo de processo
  faz trap para `file:write/2`).
- Resultados, erros e ordem iguais aos da execução até ao fim. As chamadas do
  anfitrião (`call_builtin`) concluem cada trap de imediato.
- Entradas pequenas seguem caminhos rápidos ao nível da palavra (`++` com
  ≤ 64 células, `integer_to_list`, `list_to_integer`, `atom_to_list` curtos,
  conversões de tuplos).
- Com trap: `length/1` num corpo (em guard mantém-se inline), `++`, `--`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`.
- Tudo o resto, incluindo `io:format` e builtins de tuplos, executa até ao fim.

## Builtins tipados

- Funções C++ `Result F(ProcessContext &, Parameters...)` registadas com
  `typed_entry<F>(module, name)`
  ([typed.hpp](../runtime/src/builtins/typed.hpp)).
- O adaptador aceita palavras de argumentos e converte para os tipos dos
  parâmetros; uma incompatibilidade dá `badarg` antes de executar o corpo.
  `Named<Role>` impede a troca de parâmetros de termos.
- Devolvem um termo, `BuiltinResult` ou `Word` em bruto, ou lançam
  `BuiltinFailure`; outras exceções C++ tornam-se `out_of_memory` ou
  `internal_error`.
- Guard BIFs, operadores e builtins de listas com trap são adaptadores
  `BuiltinBody` ao nível da palavra; conversões frequentes leem as células
  diretamente (`TermAccess::trusted`).

## Registo

- `BuiltinRegistry`
  ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  pertencente a `CodeServer`, associa módulo/função/aridade a um
  `BuiltinFrame`; `add` regista um lote por inteiro ou não regista nada.
- O arranque regista todas as tabelas de `production_builtins()`
  (`builtins/registry.cpp`), depois as das extensões do runtime listadas pelo
  descritor de arranque (`RuntimeOptions::extensions`): a do arquivo crypto
  quando o programa o liga ([módulo crypto](#crypto-module)).
- Fixos: as exportações de módulos com o nome de um builtin são ignoradas,
  pelo que as chamadas nunca chegam a um corpo `clause_builtin_placeholder`
  nem a uma função do utilizador com o mesmo nome.
- O caminho do anfitrião `abi::v1::dispatch_builtin` é separado
  ([runtime](runtime.md#code-server-and-builtins)).

## Organização do código-fonte

- Os módulos grandes têm um subdiretório com um ficheiro por família
  (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`, `zlib/`, ...); os pequenos
  ocupam um só ficheiro.
- Cada ficheiro de família define uma tabela `*_builtins()` listada em
  `production_builtins()`. Nova família = novo ficheiro; dividir ficheiros com
  mais de ~400 linhas.
- O compilador nunca lê o código-fonte do runtime; o catálogo é a lista comum.

## Módulo erlang

- `library/erts/erlang.terms`: exportações do OTP 29 como
  `{Name, Arity, Flags, Status}` (flags `auto_import`, `guard`; estado
  `implemented` ou `{unavailable, Reason}`), estados mantidos à mão.
- `tests/compiler/builtins/generate_erlang.py` escreve `library/erts/erlang.erl`
  (stubs) e `compiler/src/semantic/erlang_auto_imports.inc`. CTests
  `builtins_erlang_inventory` (atual) e `builtins_erlang_freshness` (OTP do
  anfitrião).
- Os builtins prevalecem em `erlang:F(...)`, `fun erlang:F/A`, `apply` e
  importações; outras exportações lançam `{not_implemented, F, A}` quando
  chamadas, as de rastreio (`{unavailable, tracing}`: `trace*`, `system_monitor`,
  `system_profile`, `seq_trace*`, `dt_*`) lançam `notsup`; nomes desconhecidos
  dão `undefined function`.
- Extras (`executables_erlang_gaps`, `_packet_decoding`, `_suspension`):
  - `adler32`, `crc32` e `*_combine` sobre zlib fixado; `iolist_to_iovec/1`.
  - `append_element/2`, `insert_element/3`, `delete_element/2`.
  - Cookies como num nó não ativo; `halt/2` como `halt/1`.
  - `send/3`, `spawn/2,4` e afins ([processos](processes.md#builtins)).
  - `decode_packet/3`: todos os tipos de pacote e opções do OTP, termos http
    do OTP.
  - `suspend_process/1,2`, `resume_process/1`, `process_display/2`.

## Formato externo de termos

`erlang/term_encoding.cpp`, `term_decoding.cpp`; codec partilhado com o
compilador ([external_term.hpp](../abi/include/clause/abi/external_term.hpp)),
pilhas explícitas.

- `term_to_binary/1,2`: bytes do OTP para `nonode@nohost`; opções
  `minor_version`, `deterministic`, `compressed`; funs locais e native records
  dão `notsup`.
- `term_to_iovec/1,2`, `external_size/1,2`.
- `binary_to_term/1,2`: comprimentos verificados antes de alocar; `safe`, `used`;
  entradas malformadas ou identidades externas dão `badarg`.
- As pilhas do codec e os bytes codificados de `term_to_binary` são buffers
  por thread mantidos entre chamadas (até 1 MB cada, `builtins/scratch.hpp`),
  pelo que um termo grande não exige páginas novas a cada chamada; inteiros
  pequenos saltam o caminho geral de itens em ambos os sentidos.
- CTests `executables_external_terms`, `builtins_etf_fuzz`.

## Tempo

`erlang/time.cpp`.

- O tempo monotónico usa o relógio estável; `native` são nanossegundos; átomos
  de unidades do OTP ou inteiros de partes por segundo.
- `convert_time_unit/3` arredonda para baixo; `unique_integer/0,1` usa um
  contador crescente; `now/0` é estritamente crescente.
- As conversões de calendário são estritas e usam o fuso local da biblioteca C.
- Temporizadores: [processos](processes.md#timers).

## Informação do sistema

`erlang/system.cpp`, `erlang/system_flags.cpp`.

- `statistics/1`: `wall_clock`, `runtime`, filas de execução,
  `context_switches`; contadores de reduções, GC e E/S indicam zeros.
- `system_info/1`: `otp_release` `"29"`, `version` `"17.1"`, `machine`
  `"Clause"`, contagens, limites, respostas fixas do emulador; lista completa
  em `system.cpp`.
- `memory/0,1`: tipos do OTP; `binary`, `code`, `ets` são 0.
- `system_flag/2`: `backtrace_depth` (≤ 64) e `min_heap_size` atuam; a maioria
  dos restantes é lida sem efeito; `cpu_topology`, `erts_alloc`, ... dão
  `badarg`.

## Hashing

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2`, `phash/2`: valores do OTP para átomos, números, binaries,
  listas, tuplos, maps; pids, portas, refs e funs usam o hashing do Clause.
- `md5/1` e `md5_init/update/final`: RFC 1321; o contexto é um binary próprio
  do Clause de 96 bytes.

## Carregamento de código

`erlang/code.cpp`. Todos os módulos são ligados e ficam carregados; o código
dinâmico fica para mais tarde.

- `module_loaded/1`, `loaded/0`, `pre_loaded/0` abrangem módulos compilados e
  de builtins.
- `delete_module/1` de um módulo carregado dá `notsup`; `prepare_loading/2`
  dá `{error, badfile}`.

## Módulo lists

`builtins/lists/`. O `lists` do OTP é Erlang, pelo que os builtins lançam o
que as suas cláusulas lançam.

- Os percursos (`sublist`, `flatten`, fusões, `key*`, `zip`, `sort`, `usort`,
  ...) lançam `function_clause` como o OTP e mantêm a mesma avaliação preguiçosa
  (`sublist([a | b], 1)` dá `[a]`).
- `keymember/3`, `keysearch/3` são BIFs: regras de `badarg`.
- Elementos iguais: ganha o primeiro (`max([1, 1.0])` dá `1`).
- As funções que recebem funs e as restantes são Erlang em
  `library/stdlib/lists.erl`; aí os builtins são chamados de forma qualificada.
- O `function_clause` de um builtin não tem frame próprio.

## Módulo math

`builtins/math.cpp`.

- Todas as funções do OTP 29 sobre a biblioteca C; não números dão `badarg`,
  resultados não finitos dão `badarith`.
- A geração de código de 64 bits expande inline `sqrt`, `floor`, `ceil`, `exp`,
  `log*`, `sin`, `cos`, `pow` sobre números, mantendo doubles em bruto.

## Módulo binary

`builtins/binary/`; `replace/3,4` e `list_to_bin/1` são Erlang.

- Padrões: binary, lista de binaries ou compilado; correspondência mais à
  esquerda, depois a mais longa; `scope`, `global`, `trim`, `trim_all`.
- `compile_pattern/1` devolve `{bm, ...}` ou `{ac, ...}` sem referência.
- As outras funções seguem o OTP; argumentos errados dão `badarg`;
  `referenced_byte_size/1` é o tamanho do próprio binary.

## Módulo maps

`builtins/maps.cpp`, `builtins/os.cpp`.

- Todas as funções documentadas de `maps`; as principais são builtins com os
  erros do OTP; as chaves correspondem exatamente.
- As funções que recebem funs são Erlang em `maps.erl`; os iteradores usam
  [`erts_internal:map_next/3`](#erts-internal).
- Os cursores de maps percorrem maps planos e em árvore por ordem de chave;
  `clause_maps:entries/1` alimenta `maps:fold/3`.
- `os`: `type`, `getenv`, `env`, `putenv`, `unsetenv`, `getpid`, `version` são
  builtins; as funções de tempo são Erlang; `os:cmd/1` usa uma porta.

## Coleções

`builtins/collections/`: todas as funções documentadas de `ordsets`, `orddict`,
`proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue`, `array`.

- Os percursos de listas são builtins; as funções que recebem funs são Erlang.
- Cada builtin percorre como as cláusulas do OTP: mesmos resultados, mesmos
  erros para qualquer entrada.
- `dict`, `sets` versão 1: records de hash linear do OTP (mesma disposição e
  ordem). Os conjuntos da versão 2 são maps.
- `gb_trees`, `gb_sets`: motor comum de árvores equilibradas; árvores iguais
  às do OTP.
- `queue`: movimentos de `{Rear, Front}` do OTP; filas iguais às do OTP.
- `array`: record `#array{}` do OTP 29, alterado exatamente como no OTP.

## Conjuntos de conjuntos

- `sofs` (`builtins/sofs/`, `executables_sofs_sets`): records do OTP sobre
  listas ordenadas; álgebra, relações e famílias são builtins, as funções que
  recebem funs são Erlang.

## Grafo

- `graph` (`builtins/graph/`, `executables_graph_module`): `#graph{}` do OTP;
  percursos e caminhos são builtins com pilhas explícitas, atualizações são
  Erlang.

## Dígrafo

- `digraph`, `digraph_utils` (`builtins/digraph/`,
  `executables_digraph_tables`): três tabelas ETS do OTP; atualizações Erlang
  sobre `ets`; pesquisas de caminhos e percursos são builtins que leem as
  tabelas diretamente.

## ETS

`builtins/ets/` sobre as tabelas do runtime ([runtime](runtime.md#ets-tables)).

- Builtins: ciclo de vida das tabelas, inserção/pesquisa/eliminação, percursos,
  contadores, `info`; reduções, `i/0..3`, `fun2ms/1` são Erlang.
- Opções e direitos de acesso como no OTP; todas as falhas dão `badarg`.
- Especificações de correspondência
  ([runtime](runtime.md#match-specifications)): `select*`, `match*`,
  `match_spec_*`, `erlang:match_spec_test/3`; resultados por ordem de percurso,
  continuações com a forma do OTP.
- Ficheiros de tabelas: `tab2file`, `file2tab`, `tabfile_info` leem e escrevem
  o formato disk_log do OTP em ambos os sentidos.
- `to_dets/2`, `from_dets/2` sobre `dets`; `table/1,2` em Erlang sobre
  `qlc:table/2` (select/3 por omissão, `first_next`, `last_prev`, `{select, MS}`),
  procurando chaves com `==` num `ordered_set`, caso contrário com `=:=`.
- Os CTests `executables_ets_*` executam os resultados de referência do OTP.

## Dets

`dets.erl` sobre `clause_dets` (`builtins/dets/`): formato de ficheiro versão 9
do OTP byte a byte, mesmas ordens nos ficheiros.

- Motor (C++): cabeçalho, listas livres buddy, hashing linear, descarga da
  cache de escrita, varrimentos, disposições em bloco.
- Processos (Erlang): servidor `dets` com as tabelas de registo do OTP; um
  processo por tabela com identificador de ficheiro, cache, fixações e
  temporizadores.
- Reparações e erros de abertura como no OTP; as funs executam onde o OTP as
  executa.
- `table/1,2` em Erlang sobre `qlc:table/2` (select/3 por omissão, `first_next`,
  `{select, MS}`); auxiliares não documentados são stubs.
- O CTest `executables_dets_tables` compara com o OTP, incluindo MD5s dos
  ficheiros.

## Codificações

`builtins/encoding/`.

- `base64`: todas as funções são builtins; os erros de descodificação coincidem
  com as máquinas de estados do OTP.
- `json`: `decode/1`, `encode/1`, `format/1,2` e codificadores de binaries são
  builtins (recurso a Erlang acima de 256 níveis de aninhamento);
  descodificadores com callbacks e codificadores que recebem funs são Erlang
  sobre analisadores de `clause_json`.

## Mensagens POSIX

`builtins/erl_posix_msg.cpp`, `library/stdlib/erl_posix_msg.erl`.

- `erl_posix_msg:message/1` (módulo interno do OTP de que `file:format_error/1`
  precisa): texto inglês de um motivo POSIX de uma tabela observada no OTP 29,
  `"unknown POSIX error: "` e o nome para outro átomo, `badarg` para um valor
  que não seja átomo.

## Nomes de rede

`builtins/net/`, `library/kernel/clause_net.erl`, `library/kernel/net.erl`.

- `clause_net:gethostname/0`, `getaddrinfo/2`, `getnameinfo/4`,
  `getservbyname/2`, `getservbyport/2` chamam as funções do sistema e respondem
  como `prim_net` do OTP: informações de endereços como maps de `family`,
  `socktype`, `protocol` e um endereço de socket, nomes de erros de prim_net
  (`eservice`, `enodata`, ...), `{error, einval}` para um serviço desconhecido.
  `net` verifica os argumentos com as guards do OTP e passa texto como binaries
  UTF-8.
- `clause_net:inet_getifaddrs/0` lista interfaces como `inet_drv` do OTP para
  `inet:getifaddrs/0` (no Windows a partir de `GetAdaptersAddresses` e
  `GetIfEntry` com as suas regras de flags, prefixos e máscaras de rede por
  classes; noutros sistemas a partir de `getifaddrs(3)`, agregadas por nome e
  flags como em `prim_inet`). `clause_net:getifaddrs/0` lista-as como
  `net:getifaddrs(all)` (Windows: entradas de pacotes e flags ordenadas do
  módulo `net` do OTP; noutros sistemas maps de prim_net com endereços de
  pacotes ou de ligação); `net` filtra-as por família, flags ou fun.
  `if_names/0` é a lista de índices e nomes que `net:if_index2name/1` e
  `if_name2index/1` pesquisam.
- `inet:getservbyname/2`, `getservbyport/2` e `gethostbyaddr/1` (um
  `getnameinfo` com `NI_NAMEREQD`) usam os mesmos builtins; os espaços de nomes
  de rede respondem `{error, enotsup}` ([diferenças](differences.md)).
- `clause_net:dns_decode/1` e `dns_encode/1` (`builtins/net/dns.cpp`) são o
  codec de mensagens DNS de inet_res: tuplos `#dns_rec{}`, `#dns_header{}`,
  `#dns_query{}`, `#dns_rr{}`, `#dns_rr_opt{}` e `#dns_rr_tsig{}` do OTP com
  os valores de inet_dns (tipos, classes e códigos de operação simbólicos,
  etiquetas de nomes com escapes, LOC em graus e metros) e as suas regras de
  `formerr` (ponteiros de compressão para trás além do cabeçalho, nomes abaixo
  de 255 bytes, secções truncadas apenas com o bit TC); a codificação comprime
  nomes.

## Filename

`builtins/filename/`.

- As funções de caminhos são builtins que seguem as cláusulas do OTP para a
  família do anfitrião (Unix ou unidades Windows e nomes `//`); formas dos
  resultados e erros do OTP.
- `absname/1,2`, `basedir/2,3` são Erlang.

## Filelib

`builtins/filelib.cpp`, `library/stdlib/filelib.erl`, `library/stdlib/clause_filelib.erl`.

- `clause_filelib:escape/1` representa `@` e `\` de forma que
  `filename:split/1` preserve os escapes; `compile_part/1` compila uma parte de
  um padrão dividido (`?`, `*`, `**`, conjuntos de caracteres com intervalos,
  alternativas `{...}` que incorporam o resto da sua parte) com as
  particularidades do OTP (`**` só como parte inteira, `]` no início ou como
  limite inferior de um intervalo, `{badpattern, missing_delimiter}`, um
  `case_clause` para alternativas aninhadas); `matches/3` e `match/2` filtram
  entradas de diretórios.
- O percurso (prefixos literais, `..`, `**`, verificações de existência) é
  Erlang sobre `file` e `filename`, pelo que os resultados são os do OTP,
  ordenados.

## Argparse

`builtins/argparse/`, `library/stdlib/argparse.erl`,
`library/stdlib/clause_argparse.erl`.

- `clause_argparse:validate/3` verifica um comando como `validate/2` do OTP,
  pela ordem do OTP, e devolve o primeiro campo inválido para `argparse.erl`
  lançar o erro.
- `parse/6` é o analisador do OTP num ciclo: formas longas (`--name=value`),
  formas curtas, flags combinadas, valores anexados, números negativos,
  `nargs`, ações, tipos, subcomandos, valores por omissão; erros lançados e
  maps de argumentos do OTP.
- `help/4` constrói as listas de ajuda do OTP (quebra de linhas de utilização,
  secções, modelos) através dos builtins de `io_lib`, `string` e `unicode`,
  pelo que as formas são iguais às do OTP.
- As funs são chamadas por `argparse.erl`: um builtin devolve um pedido
  (`{custom, Fun, Arg}`, `{re, Arg, Re[, Options]}`, `{describe, Fun}`) e é
  chamado novamente com as respostas obtidas, repetindo o percurso; cada fun
  executa uma vez, pela ordem do OTP.
- `run/3`, os tratadores e `format_error/1,2` são Erlang.

## Qlc pt

`builtins/qlc_pt/`, `library/stdlib/qlc_pt.erl`,
`library/stdlib/clause_qlc_pt.erl`: a transformação de análise de qlc em tempo
de execução, para `qlc:string_to_handle/1,2,3` e `qlc:q/1,2` em código
avaliado. Os módulos compilados com `qlc.hrl` continuam a receber a
transformação do OTP do anfitrião
([transformações de análise](transforms.md)).

- `clause_qlc_pt:transform_expression/4` e `parse_transform/4` seguem
  `qlc_pt.erl` função a função: NodeInfo (anotações únicas e o que as
  verificações registam em cada nó, guardado por número de posição a partir de
  1 como no OTP), `no_shadows`, as análises lint que encontram variáveis
  introduzidas e de geradores, frames de records `#bind{}` para colunas
  constantes e de junção, omissão de filtros, especificações de
  correspondência, geradores de junção, a fun de estado gerada, `Qdata`, `CodeF`
  (`term_to_binary(_, [compressed])` do código original) e a fun de opções.
  Os dados intermédios são termos Erlang com a forma do OTP, pelo que as
  ordenações seguem a ordem dos termos; as variáveis geradas são referências
  como em `make_ref/0` do OTP.
- As mensagens vêm do `erl_lint` em C++ (`Lint`), o caminho que `qlc_pt` do
  OTP segue quando o compilador não está disponível; uma falha de lint nas
  formas que constrói é um erro interno do compilador, como o compilador do
  OTP o apresenta. Os records são expandidos pelo `erl_expand_records` em C++,
  os testes de guard por `is_guard_test/3`.
- As especificações de correspondência executam `ms_transform` em Erlang: o
  builtin devolve `{try_ms, Forms}`, `qlc_pt.erl` responde com o resultado de
  `try_ms/4` e chama novamente o builtin com as respostas obtidas, repetindo o
  percurso; o resultado é `{done, Result, Transformed}` (um módulo transformado
  aumenta a profundidade do rasto de pilha para 500, como a transformação do OTP).

## Qlc

`library/stdlib/qlc.erl`: todas as funções em Erlang, pois a avaliação chama as
funs da consulta. Escrito a partir da documentação do OTP; os algoritmos são
os do OTP onde as respostas, a sua ordem ou `info/1,2` os revelam.

- Os identificadores mantêm os tuplos do OTP (`{qlc_handle, H}` com `qlc_lc`,
  `qlc_table`, `qlc_append`, `qlc_sort`; `{qlc_cursor, {Pid, Owner}}`); as
  consultas compiladas são o `{qlc_lc, Fun, Opt}` da transformação com dados
  `qlc_v1` ou `simple_v1`.
- Preparação: pesquisas pela chave ou pelo índice com menos chaves
  (`max_lookup`), especificações de correspondência para funs de percurso
  unárias e listas, preferência por junções de pesquisa face a junções por
  fusão, entradas de junções por fusão ordenadas salvo se já conhecidas como
  ordenadas, consultas simples para `cache` e `unique`, combinadas, e nunca
  para o primeiro gerador.
- Avaliação: as respostas são listas terminadas em `[]` ou numa fun de
  continuação. `cache` usa tabelas `ets` (`qlc`, privadas) ou uma lista
  guardada em `{Ref, '$_qlc_cache_tmpfiles_'}`, movida para um ficheiro
  temporário acima de `max_list_size`; as junções por fusão colocam classes
  grandes de chaves iguais num ficheiro (`'$_qlc_merge_join_tmpfiles_'`);
  as ordenações executam `file_sorter` quando as respostas excedem `size`.
  Os ficheiros temporários são `qlc_<node>_<os pid>_<unique>` em `tmpdir` ou
  no diretório de trabalho; `tmpdir_usage` comunica através de `error_logger`.
- Os erros encontrados pela avaliação (resposta que não seja lista de uma fun
  de percurso ou pesquisa, erros de ficheiros, `{tmpdir_usage, _}`) são
  lançados com uma etiqueta interna e devolvidos por `eval/2`, `fold/4`,
  `info/2` e cursores, como o OTP devolve os erros que `throw_error/1` lança.
- `info/1,2` imprime a consulta preparada com `erl_pp:expr/3`, descrições de
  tabelas através das suas funs de formatação (cadeias analisadas por
  `erl_eval:extended_parse_exprs/1`).
- `string_to_handle/1,2,3` e `qlc:q/1,2` de `erl_eval` executam o
  [`qlc_pt`](#qlc-pt) do Clause; `ets:table/1,2`, `dets:table/1,2` e
  `erl_eval` chegam a `qlc` por um nome em runtime, pelo que só os programas
  que nomeiam `qlc` o ligam.
- O CTest `executables_qlc_queries` compara com o OTP: o seu módulo de
  consultas compila a partir de `qlc_queries.abstr`, as formas após a
  transformação do OTP, pelo que o teste não precisa do OTP do anfitrião
  ([casos executáveis](../tests/fixtures/executables/README.md)).

## String

`builtins/string/`: todas as funções de `string`.

- Os percursos seguem `string.erl` sobre `unicode_util:cp/1`, `gc/1`: caudas,
  sub-binaries, listas mistas e erros do OTP.
- Os percursos a partir do fim usam ciclos em vez de recursão.
- As funções de maiúsculas/minúsculas devolvem a entrada quando nada muda;
  `equal/4` normaliza através de `unicode/normalize.cpp`.
- `to_integer/1`, `to_float/1`, API Latin-1, `jaro_similarity/2` como no OTP.

## String URI

`builtins/uri/`.

- `parse/1`: um percurso RFC 3986 pela ordem do OTP, fragmentos de erro do OTP.
- `recompose`, `normalize`, `resolve`, `percent_decode`, `quote` e funções de
  consulta seguem os percursos e estilos de erro do OTP.
- `unicode/graphemes.cpp` segmenta grupos para os builtins que deles precisam.

## Números aleatórios

`builtins/rand/`.

- `rand`: estados e tratadores do OTP; todos os algoritmos dão as sequências
  do OTP. Os tratadores conhecidos executam em C++ (`clause_rand:*`); os
  restantes executam o Erlang genérico do OTP.
- `splitmix64_next/1`, `exsp_*`, `mwc59*` são builtins.
- `tools/rand/` observa constantes do OTP e gera `tables.cpp`.
- `random`: `uniform_s/1` é builtin, o resto é Erlang.

## Calendar

`builtins/calendar.cpp`.

- Builtins de aritmética gregoriana sobre quaisquer inteiros, fórmulas e erros
  do OTP.
- Hora local/universal e RFC 3339 são Erlang em `calendar.erl`.

## Timer

`builtins/timer.cpp`.

- `seconds/1`, `minutes/1`, `hours/1`, `hms/3` e `now_diff/2` como aritmética
  Erlang sobre quaisquer números: `badarith` para um valor não numérico,
  `function_clause` para um argumento de `now_diff/2` que não seja um tuplo de
  3 elementos.
- Os temporizadores são Erlang em `timer.erl`, sem `timer_server`: os envios
  para um pid local usam `erlang:send_after/3`; qualquer outro temporizador
  único ou periódico é um processo que cria um alias, transportado pelo seu
  `TRef` e para o qual `cancel/1` envia. Um temporizador periódico monitoriza
  o processo para o qual trabalha e termina com ele; `apply_repeatedly` espera
  que cada ação termine antes do próximo disparo.

## Termos persistentes

`builtins/persistent_term.cpp` sobre a tabela do runtime
([runtime](runtime.md#persistent-terms)).

- `put/2`, `put_new/2`, `get/0,1,2`, `erase/1`, `info/0` com os resultados do
  OTP; as chaves correspondem exatamente; as leituras devolvem o termo
  guardado sem cópia.

## Módulo unicode

`builtins/unicode/`: todas as funções são builtins.

- Codificações `latin1`, `utf8`, `utf16`, `utf32` (com ordem dos bytes);
  caso contrário, `badarg`.
- Chardata: binaries, pontos de código, listas aninhadas; binaries
  consecutivos formam um só fluxo.
- As falhas dão `{error | incomplete, Converted, Rest}` com a forma de `Rest`
  do OTP.
- Formas normais, `category/1`, `is_whitespace/1`, `is_id_*` mantêm os atalhos
  do OTP.

## Módulo code

`builtins/code.cpp`. Sem processo `code_server`; as respostas descrevem o
programa ligado.

- `ensure_loaded/1`, `is_loaded/1` (`{file, preloaded}`), `which/1`
  (`preloaded`), `all_loaded/0`, `module_status/0,1`; `is_sticky/1` dá `false`.
- Caminho de código (`library/kernel/code.erl`): um termo persistente
  construído na primeira utilização como o servidor de código interativo do
  OTP o constrói: diretórios `ebin` de aplicações de `ERL_LIBS`, a versão mais
  recente de cada aplicação em `lib_dir()`, depois `"."`. `root_dir/0` é o
  diretório do executável. As alterações do caminho normalizam e verificam
  diretórios como no OTP; `lib_dir/1`, `priv_dir/1` e `compiler_dir/0` indicam
  o primeiro diretório do caminho `.../Name[-Vsn][/ebin]`.
- Respostas de carregamento para código ligado: código objeto encontrado no
  caminho dá `{error, badfile}` de `erlang:prepare_loading/2`, código em falta
  dá `nofile`; `purge/1` dá `false`, `soft_purge/1` dá `true`, `delete/1` dá
  `false`; `get_doc/1` dá `{error, missing}`; sem suporte de cobertura.

## Módulo io

`builtins/terminal.cpp`, `library/stdlib/clause_io.erl`.

- `clause_io:isatty/1` (`stdin`, `stdout`, `stderr`): uma consola no Windows,
  `isatty(3)` noutros sistemas; `window_size/1`: `{Columns, Rows}` de um
  terminal (`GetConsoleScreenBufferInfo`, `TIOCGWINSZ`), caso contrário
  `{error, enotsup}`.
- Respondem às flags de terminal de `io:getopts/0,1`, a `io:columns/0,1`,
  `io:rows/0,1` e `io_ansi:enabled/0,1`.
- O servidor de entrada padrão (`io.erl`) lê linhas como o grupo do OTP: um
  pedido `get_until` (`io:read/1,2`, `io:scan_erl_exprs/1..4`, os comandos da
  shell) recebe uma linha de cada vez e escreve novamente o pedido de entrada
  antes de cada linha adicional, e um fim de linha CRLF é lido como LF.

## Módulo os

`builtins/os.cpp`, `library/kernel/os.erl`.

- `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0`,
  `version/0` são builtins.
- `cmd/1,2`: Erlang sobre uma porta de criação de processo com o protocolo do
  OTP: o Windows executa `COMSPEC /c Command`; noutros sistemas
  `/bin/sh -s unix:cmd` lê o comando e emite `^D` (e o estado de saída) no
  fim. `max_size`, `exception_on_failure`, saída UTF-8 descodificada para
  caracteres.
- `find_executable/2` (builtin): pesquisa do OTP nos elementos de `PATH`
  (Windows: primeiro o diretório atual, `.exe`, `.com`, `.cmd`, `.bat`).
- `set_signal/2` (builtin): `badarg` no Windows como no OTP; noutros sistemas
  `sigaction`; um sinal tratado atua como o `erl_signal_handler` padrão do OTP.

## Módulo init

`builtins/init.cpp`, `library/erts/init.erl`. Um sistema iniciado sem um
script de arranque.

- Linha de comandos descodificada uma vez (`startup/arguments.cpp`): os
  argumentos simples alimentam o argv da entrada e `get_plain_arguments/0`.
- A única flag é `home`; `script_name/0` é o caminho do executável.
- As outras funções são Erlang com as respostas do OTP já iniciado;
  `script_id/0` é `{"Clause", "29"}`.
- `stop/0,1`, `reboot/0` terminam de imediato; `boot/1`, `restart/0,1`,
  `make_permanent/2` são recusados com `notsup`.

## Atomics e contadores

`builtins/atomics.cpp`.

- O array de `atomics` é uma
  [referência de identificador](runtime-heap.md#handle-references) sobre valores
  `std::atomic_ref`; aridade 1..2^27; regras de `badarg` e `info/1` do OTP.
- `counters` é Erlang sobre um array de atomics com sinal; os contadores de
  escrita concorrente são exatos.

## Erts internal

`builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`: as funções
que `stdlib` e `kernel` chamam.

- Builtins `cmp_term/2` e `map_next/3` (iteradores de maps, ordem das chaves).
- Erlang: `list_to_integer/2`, `binary_to_integer/2`, `map_to_tuple_keys/1`,
  `term_type/1`, contadores, `dynamic_node_name`.
- `get_creation/0` dá `undefined`; grupos de distribuição e `.beam` recusados.
- `erts_code_purger`: nada a purgar.

## Unicode util

`unicode_util.erl` sobre builtins de `clause_unicode` e tabelas geradas
(`unicode/tables.cpp`).

- `cp/1`, `gc/1` (UAX #29), `nfd/nfc/nfkd/nfkc`, conversões de
  maiúsculas/minúsculas com as formas do OTP; `spec_version/0` dá `{17, 0}`.
- `tools/unicode/generate.py` constrói tabelas a partir de respostas do OTP do
  anfitrião e dados Unicode 17.0; as compilações não precisam de nenhum deles.
- CTests `executables_unicode_tables`, `_clusters`, `_forms`.

## io_lib

`io_lib.erl`, `builtins/io_lib/`. Listas profundas de caracteres do OTP
construídas numa arena C++; `io:format` usa o mesmo motor.

- Escritores (`write.cpp`): `write`, `write_string`, `write_atom`, ... aplicam
  escapes e limites como no OTP.
- Motor de formatação (`format_scan.cpp`, `format_build.cpp`): todos os
  controlos, `chars_limit`, arredondamento de vírgula flutuante do OTP; erros
  `badarg`.
- Impressão formatada (`pretty*.cpp`): disposições de `io_lib_pretty` do OTP.
  `clause_io_lib:pretty/2` é `io_lib_pretty:print/2` para a shell: `column`,
  `line_length`, `depth`, `line_max_chars`, `strings`, `encoding` e `records`,
  as definições `[{Name, [Field]}]` que uma `record_print_fun` devolveria,
  pelo que tuplos com nome e tamanho conhecidos são impressos como
  `#Name{Field = Value, ...}` com a disposição do OTP. CTest
  `executables_shell_session`.
- Analisador (`fread.cpp`): controlos e continuações de `fread/2,3`.
- Coletores (`collect.cpp`), verificações de caracteres imprimíveis,
  `indentation/2`.
- Funs de `maps_order`: o builtin regista maps e continua em
  `clause_io_lib:sort_maps/6`, executando novamente com chaves ordenadas.
- Aninhamento acima de 256 dá `system_limit`. CTests `executables_io_lib_text`,
  `_pretty_print`, `_fread_scanning`.

## Tabelas do compilador

`builtins/front_end/`.

- `erl_internal`: tabelas de BIFs e guards de `erlang.terms`; tabelas de tipos
  e operadores; `add_predefined_functions/1`.
- `erl_anno`: formas e erros do OTP.
- `erl_features`: respostas do compilador do Clause; `used/1` lê descritores
  ou blocos `Meta` de `.beam`.
- `records`: ver [native records](native-records.md#reflection).
- CTests `executables_compiler_tables`, `_records_reflection`.

## Erl scan

`erl_scan.erl` sobre `clause_erl_scan:scan/6` (`front_end/scanner*.cpp`), um
analisador léxico próprio que segue `scan1/5` do OTP.

- Tokens, anotações, sigilos, cadeias com aspas triplas, erros e restos do OTP.
- Callbacks `reserved_word_fun`, `text_fun` executam em Erlang por ordem de
  token.
- As continuações de `tokens/3,4` voltam a analisar o token inacabado.
- CTest `executables_erl_scan_tokens`.

## Erl parse

`erl_parse.erl` sobre `clause_erl_parse:parse/1` (`front_end/parser*.cpp`), um
analisador de descida recursiva da gramática do OTP.

- Formato abstrato e comportamento de erros LALR do OTP (token de paragem,
  ordem dos erros de ação face aos de sintaxe).
- `first_anno/1`, `last_anno/1` seguem a ordem de `map_anno/2`.
- `normalise/1`, `abstract/1,2`, `tokens/1,2` são builtins; percursos de
  anotações com funs são Erlang.
- CTest `executables_erl_parse_forms`.

## Erl eval

`erl_eval.erl` interpreta o formato abstrato em Erlang; builtins de
`clause_erl_eval` tratam segmentos de sintaxe de bits (`front_end/erl_eval.cpp`)
e correspondência de padrões (`front_end/eval_match.cpp`), e
`erl_eval:partial_eval/1` e `is_constant_expr/1` também são builtins.

- `clause_erl_eval:match/4` é `match1/5`: literais, variáveis, listas, tuplos,
  maps, native records, prefixos `"abc" ++ T`, constantes de operadores e
  padrões binary, dando `{match, Bindings}`, `nomatch` ou `invalid` (lançado
  como `{illegal_pattern, Pattern}` por `erl_eval.erl`). As chaves de maps e
  tamanhos de segmentos são expressões de guard avaliadas sobre as associações
  exteriores (`front_end/guard_eval.cpp`, partilhado com `-if` de `epp`);
  as associações são lidas e guardadas como `orddict` ou um map, como no OTP,
  incluindo uma lista não ordenada.
- `clause_erl_eval:bits_gen/4` retira o padrão de um gerador binary do início
  dos bits; o ciclo do avaliador, as guards (chamam o tratador não local) e os
  percursos de comprehensions mantêm-se em Erlang.

- `bit_type/2` resolve os especificadores de um `bin_element` com os valores
  por omissão e erros de `erl_bits` (`front_end/bit_types.cpp`, partilhado com
  `normalise/1`); `bit_segment/3` constrói um segmento (`badarg`,
  `system_limit`), `bit_take/3` retira um do início de um bitstring (`nomatch`).
- As funs criadas pelo avaliador são closures sobre o ambiente
  `{Anno, Bindings, Lf, Ef, UsedVars, Clauses}` do OTP, pelo que `fun_data/1`
  e `erlang:fun_info/2` respondem como no OTP; `fun M:F/A` com partes em
  runtime usa `erlang:make_fun/3`.
- `exprs/2`, `expr/2` e `check_command/2` verificam comandos com
  `erl_lint:exprs_opt/3` como no OTP.
- CTest `executables_erl_eval_exprs`.

## Erl lint

As verificações de `erl_lint` são builtins (`front_end/lint*.cpp`) escritos a
partir de `erl_lint` do OTP cláusula a cláusula; `erl_lint.erl` mantém o que
chama funs ou outros módulos.

- Um objeto `Lint` contém o estado `#lint{}` do OTP; as tabelas de variáveis
  são vetores ordenados por nome (orddicts do OTP), os conjuntos e maps que o
  OTP mantém por ordem de termos são contentores ordenados, pelo que os erros
  mantêm a ordem de inserção e os avisos são ordenados como em `return_status/1`.
- `module/1,2,3` passam por `clause_erl_lint:module/4` com as respostas de
  `behaviour_info/1` dos behaviours procuradas em Erlang
  ([diferenças](differences.md#erl_lint)); `format_error/1` formata a resposta
  de `clause_erl_lint:format_spec/1` (incluindo partes aninhadas de
  `io_lib:format/2`), pelo que os resultados são iguais aos termos do OTP.
- As depreciações vêm das tabelas `otp_internal` do OTP
  (`front_end/otp_obsolete.inc`, gerado por
  `tests/compiler/library/generate_obsolete.escript`).
- `erl_eval:partial_eval/1` e `erl_bits:set_bit_type/2` usados pelas
  verificações são C++ (`lint_eval.cpp`, `bit_types.cpp`).
- CTest `executables_erl_lint_checks`.

## Erl pp

A impressão de `erl_pp` é um builtin (`front_end/pp*.cpp`),
`clause_erl_pp:print/2`, portado das duas passagens do módulo Erlang anterior;
`erl_pp.erl` mantém os hooks e `legalize_vars/1`.

- A primeira passagem transforma uma forma em itens de disposição numa arena
  (`pp_items`, `pp_exprs`, `pp_forms`, `pp_types`); a segunda dispõe-os segundo
  a largura da linha (`pp_layout`), escrevendo átomos, cadeias, caracteres e
  valores através dos escritores C++ de `io_lib`.
- Uma forma que só o hook pode imprimir interrompe a disposição com
  `{hook, Expr, Column, Precedence}`; `erl_pp.erl` chama o hook e imprime
  novamente com as respostas obtidas, pelo que cada hook executa uma vez,
  pela ordem do OTP.
- As precedências e `erl_parse:abstract/2` vêm de `erl_parse.cpp`.
- CTest `executables_erl_pp_forms`.

## Epp

As condições `-if` e `-elif` de `epp` são avaliadas por um builtin,
`clause_epp:eval_if/1` (`front_end/epp_eval.cpp`), pelo que um programa que
pré-processa ficheiros não liga `erl_eval`.

- Avalia a expressão de guard como `erl_eval:exprs/3` sem associações:
  literais, listas, tuplos, maps e atualizações de maps, binaries (segmentos
  através dos builtins de bits de `clause_erl_eval`), operadores com
  `andalso`/`orelse` a devolverem o valor do lado direito, e chamadas de guard
  BIFs (locais auto-importadas ou `erlang:`) através da tabela de guards das
  especificações de correspondência.
- Qualquer erro (variáveis não associadas, records indefinidos, uma BIF que
  lança uma exceção, uma chamada local) torna a condição falsa, pois `epp`
  apanha-o.
- `epp`, `file` e `erl_features` são compilados com
  [vivacidade estrita](compile.md#strict-liveness).

## Erl expand records

`erl_expand_records:module/2` é um builtin (`front_end/expand_records.cpp`):
a expansão percorre formas em C++ em vez de um grande despacho de cláusulas
Erlang, pelo que os programas que a chamam não compilam código adicional.

- Ordem de percurso do OTP (segmentos binary do último para o primeiro, lado
  direito da correspondência primeiro) e numeração `recN`; testes de guard
  `is_record/3` tornam-se padrões.
- Os filtros de comprehensions são testes de guard segundo as regras de
  `erl_lint` (`front_end/guard_tests.cpp`, com os records do módulo e funções
  locais ou importadas).
- Opções `dialyzer`, `expand_inits`, `[no_]strict_record_tests`, também a partir
  de atributos `-compile`.
- CTest `executables_erl_expand_records_forms`.

## Módulo zlib

`builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.

- Liga zlib 1.3.2 como o OTP 29 ([zlib](compile.md#zlib)): mesmos bytes.
- O fluxo é uma referência de identificador que possui `z_stream`; os builtins
  de `clause_zlib` executam uma operação sobre toda a entrada.
- `zlib.erl` mantém a API, os erros, os estados e os auxiliares de buffer
  completo do OTP.
- A compressão de `term_to_binary` segue a regra de tamanho do OTP.

## Módulo zstd

`builtins/zstd/contexts.cpp`, `library/stdlib/zstd.erl`.

- Liga zstd 1.5.7 como o OTP 29 ([zstd](compile.md#zstd)): mesmos frames.
- Contextos e dicionários são referências de identificador que possuem os de
  libzstd; um contexto que referencia um dicionário mantém-no vivo. Os builtins
  de `clause_zstd` refletem a NIF do OTP: blocos de saída de
  `ZSTD_CStreamOutSize()` / `ZSTD_DStreamOutSize()` (um frame que indique um
  tamanho menor é descomprimido num único bloco desse tamanho), resultados
  `{continue, Rest, Out}`, `{flush, Out}` e `{done, Out}`, verificações de
  proprietário (`not_on_controlling_process`), erros
  `{badarg, {invalid_key | invalid_value, Term}}` e `{zstd_error, Name}`,
  booleanos lidos como `false` tal como a NIF do OTP os lê.
- `zstd.erl` mantém o tratamento de iodata, fluxos e frames do OTP.

## Codec ASN.1

`builtins/asn1/` em `clause_runtime`, `library/asn1/clause_asn1.erl`
([ASN.1](asn1.md)).

- `clause_asn1:encode/3` e `decode/3` recebem o termo de esquema do módulo
  gerado, o nome do tipo e o valor ou bytes (um binary ou iolist); `decode/3`
  devolve `{Value, Rest}`. Interpretam o esquema como o código BER gerado por
  asn1ct e `asn1rtt_ber`, e falham com os mesmos motivos de `exit`/`error`,
  que o invólucro gerado transforma em `{error, {asn1, Reason}}`.
- Os TLVs são analisados como em `asn1rt_nif` (`tlv.cpp`: as suas posições de
  erro, limites de dois bytes para etiquetas e quatro bytes para comprimentos);
  `ber_decode.cpp`, `ber_constructed.cpp`, `ber_encode.cpp` e
  `ber_encode_constructed.cpp` contêm os tipos primitivos e construídos,
  `values.cpp` as comparações de INTEGER, REAL e DER `DEFAULT`, `legacy.cpp`
  as formas antigas de `BIT STRING`.
- PER (`per.hpp`): `per_bits.cpp` contém campos de bits, determinantes de
  comprimento, números inteiros e cadeias com o seu alinhamento e fragmentos;
  `per_encode.cpp`/`per_decode.cpp` os tipos primitivos;
  `per_encode_constructed.cpp`/`per_decode_constructed.cpp` sequências, adições
  de extensão, escolhas e tipos abertos; `per_strings.cpp` valores
  `BIT STRING`. Uma descodificação PER recebe um binary e devolve os bits por
  ler.

## Chave pública

`builtins/public_key/` em `clause_runtime`,
`library/public_key/clause_public_key.erl` ([public_key](public_key.md)):
os percursos de records e tabelas de `pubkey_translation` e
`pubkey_cert_records` do OTP, que `clause_public_key_codec` chama.

- `translate(decode | encode, Term)` (`translate.cpp`) percorre um termo como
  `pubkey_translation:decode/1` e `encode/1`: os records
  `SubjectPublicKeyInfo_algorithm`, `DSA-Params`, `DSA-Sig-Value`,
  `OTPExtension`, `SingleAttribute`, `OneAsymmetricKey` (versão `v1`) e
  `EncryptionAlgorithmIdentifier` dos módulos gerados tornam-se os que
  `public_key.hrl` documenta, e vice-versa; uma lista imprópria falha com
  `bad_generator` como a comprehension.
- `oid_name(Table, Oid)` e `name_oid(Table, Name)` (`tables.cpp`, linhas em
  `tables.inc`) pesquisam as tabelas `public_key_algorithm` (o tipo de chave de
  um algoritmo), `curve_type`, `named_curve`, `ml_dsa`, `ml_kem`, `slh_dsa` e
  `extension` (o tipo de uma extensão); `undefined` quando a tabela não tem
  linha, `badarg` para outra tabela.
- `asn1_module(Type)` indica o módulo gerado que `der_decode/2` e
  `der_encode/2` usam para um tipo (`public_key:get_asn1_module/1`),
  `undefined` para um tipo sem módulo.

## Módulo crypto

`builtins/crypto/` no arquivo separado `clause_runtime_crypto`,
`library/crypto/crypto.erl` e `clause_crypto.erl`.

- Liga libcrypto de OpenSSL ≥ 3.1.2 (versão fixada 4.1.0,
  [OpenSSL](crypto.md)); só os programas que chamam `crypto` (ou passam
  `--with-crypto`) ligam o arquivo, cuja entrada `CLAUSE_crypto_extension_v1`
  é listada pelo descritor de arranque.
- `algorithms.cpp` mantém as tabelas de nomes do OTP (resumos, cifras, MACs,
  tipos de chave, curvas, KEMs) com os nomes de obtenção do OpenSSL; a primeira
  chamada a `crypto` carrega os fornecedores default, base e legacy e obtém
  todos os resumos, cifras e MACs, como a NIF do OTP ao carregar; as curvas são
  sondadas (uma chave gerada em cada uma) no primeiro `supports(curves)`.
  `supports/0,1`, `hash_info/1`, `info/0` e `info_lib/0` indicam o que a
  libcrypto ligada disponibiliza.
- Os estados de hash são referências de identificador que possuem um
  `EVP_MD_CTX`; `hash_update/2` devolve um novo estado sobre uma cópia, como no
  OTP. Os estados MAC possuem um `EVP_MAC_CTX` que `mac_update/2` avança
  diretamente. `crypto.erl` fornece textos com mais de 20000 bytes em partes,
  como o OTP, pelo que nenhuma chamada de builtin demora muito.
- Os erros são os das NIFs do OTP:
  `{badarg | notsup | error, #{c_file_name, c_file_line_num, c_function_arg_num}, Description}`,
  que `crypto.erl` transforma em `{Class, {File, Line}, Description}` com
  `error_info` (`?nif_call`); as descrições e verificações seguem a ordem do
  OTP, o ficheiro e a linha são os do Clause.
- Os motores respondem como um OTP cujo OpenSSL não suporta motores
  (`notsup`; OpenSSL 4 não os tem).
- As cifras (`cipher.cpp`) seguem `api_ng.c` do OTP: os estados de
  `crypto_init/4` possuem um `EVP_CIPHER_CTX` protegido por um bloqueio que
  `crypto_update/2` avança diretamente; `crypto_final/1` preenche conforme as
  opções (`undefined`, `none`, `zero`, `random`, `pkcs_padding` do OTP);
  `crypto_one_time/5` executa um estado temporário. `crypto.erl` fornece a
  `crypto_update/2` textos com mais de 20000 bytes em partes. AEAD (`aead.cpp`)
  segue `aead.c` para GCM, CCM e ChaCha20-Poly1305; uma etiqueta errada
  descifra para `error`. `crypto.erl` executa os geradores `rand` `crypto_aes`
  e `crypto_prng1` como no OTP, sobre os builtins `exro928_*` e `seed58/2` de
  `rand`.
- FIPS (`fips.cpp`): cada entrada da tabela mantém uma segunda obtenção
  `fips=yes`, usada no modo FIPS; uma entrada sem ela é aí proibida
  (`*_FORBIDDEN_IN_FIPS` do OTP), sai de `supports/1` e lança as descrições de
  `notsup` do OTP. `enable_fips_mode/1` muda as propriedades predefinidas do
  OpenSSL; os programas compilados com `--fips` ligam a entrada
  `CLAUSE_crypto_fips_extension_v1` do arquivo, cujo hook de arranque carrega o
  fornecedor junto do executável ([FIPS](crypto.md#fips)).
- As chaves públicas seguem `pkey.c`, `rsa.c`, `dss.c`, `eddsa.c`, `ec.c`,
  `ecdh.c`, `dh.c`, `evp.c` e `srp.c` do OTP: `crypto.erl` transforma inteiros
  em binaries (`format_pkey`, `nif_curve_params`) e os builtins constroem
  chaves OpenSSL a partir das mesmas listas `OSSL_PARAM` que as NIFs do OTP
  constroem (`params.cpp`, números grandes na ordem nativa), com as
  verificações, descrições e números de argumentos do OTP. `pkey.cpp`:
  `sign/4,5`, `verify/5,6` (RSA com PKCS #1, PSS, X9.31 e sem preenchimento,
  DSA, ECDSA, EdDSA, ML-DSA, SLH-DSA; `{digest, Digest}`),
  `public_encrypt/4` de RSA e as suas três funções irmãs (PKCS #1, OAEP com os
  seus resumos e etiqueta, sem preenchimento), `privkey_to_pubkey/2`.
  `keys.cpp`: geração de chaves RSA, DH, X25519/X448, Ed25519/Ed448, ML-DSA,
  SLH-DSA e ML-KEM, acordo DH e X25519/X448, `encapsulate_key/2`,
  `decapsulate_key/3`. `curves.cpp`: chaves e acordo ECDH em curvas com nome ou
  explícitas, repetidos com parâmetros explícitos quando o OpenSSL não conhece
  o nome do OTP (como `retry_without_name` do OTP), e `ec_curve/1`, cujos
  parâmetros explícitos vêm das curvas integradas na libcrypto ligada em vez
  da tabela `crypto_ec_curves` do OTP (os mesmos termos byte a byte).
  `srp.cpp`: fórmulas de números grandes de SRP; `crypto.erl` mantém o
  multiplicador e o misturador do OTP. As particularidades do OTP são mantidas:
  `sign(dss, none, ...)` falha com `"Bad digest type"`, `generate_key(dh, ...)`
  ignora uma chave privada fornecida, e um expoente público RSA de vários
  bytes chega ao OpenSSL na ordem de bytes nativa.

## Módulo re

`builtins/re/`, `re.erl` sobre o PCRE2 incluído ([PCRE2](compile.md#pcre2)).

- Padrão compilado: `{re_pattern, ...}` do OTP 29 com uma referência de
  identificador.
- `clause_re:compile/2`, `clause_re:run/4` (uma correspondência, todas as
  opções de captura, erros do OTP).
- `re.erl`: conversão de chardata, ciclo `global`, `replace`, `split`.
- `export`/`import/1` não disponibilizados. CTest `executables_re_module`.

## Prim eval

`process/receive.cpp`, `library/erts/prim_eval.erl`.

- `prim_eval:'receive'/2` percorre a caixa de correio com builtins de
  `clause_receive` (`peek`, `skip`, `take`, `restart`, `wait`); ganha a primeira
  resposta diferente de `nomatch`.
- CTest `executables_prim_eval_receive`.
