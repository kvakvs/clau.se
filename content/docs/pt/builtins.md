---
source: docs/builtins.md
sourceCommit: 6ed3851c
sourceSha256: 35d165fa6e573a993a44f0a3284aa944f79954a0af62fd2b79e6b20fe728a9d9
translatedAt: 2026-10-15
---
# Builtins

A ponte de builtins de produção. Os builtins são funções `erlang` que o
runtime implementa em C++. O runtime regista-os por módulo, função e aridade;
o código gerado chega a eles diretamente, através de chamadas dinâmicas e como
valores fun.

## Que builtins existem

O catálogo da ponte `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) lista todos os
builtins que o compilador e o runtime conhecem:

- as guard BIFs: testes de tipo (`is_atom/1` … `is_tuple/1`,
  `is_function/1,2`), `abs/1`, `bit_size/1`, `byte_size/1`, `ceil/1`,
  `element/2`, `float/1`, `floor/1`, `hd/1`, `length/1`, `map_get/2`,
  `map_size/1`, `is_map_key/2`, `max/2`, `min/2`, `round/1`, `size/1`, `tl/1`,
  `trunc/1`, `tuple_size/1`, `binary_part/2,3`;
- os operadores como funções: comparações, `not/1`, `and/2`, `or/2`,
  `xor/2`, operadores aritméticos e bit a bit (`erlang:'+'/1,2` …);
- `display/1`, `halt/0,1`, `error/1,2,3`, `exit/1`, `throw/1`, `raise/3` e
  `function_exported/3`;
- acesso a termos: `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` e os operadores de lista `'++'/2` e
  `'--'/2` (`A ++ B`, `A -- B` são rebaixados para eles);
- conversões: `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` não foi selecionado);
- saída para a consola: `io:format/1,2` e `io:put_chars/1`, os primeiros
  builtins de outro módulo ([io](io.md)); dispositivos de saída:
  `io:format/3`, `io:fwrite/1,2,3`, `io:put_chars/2`, `io:nl/0,1`;
- as funções de dados de `lists` ([módulo lists](#lists-module));
- todas as funções de `math` ([módulo math](#math-module));
- o módulo `binary` ([módulo binary](#binary-module));
- as consultas de ambiente, processo e versão de `os` e as BIFs de `maps`
  ([módulo maps](#maps-module));
- `persistent_term` ([termos persistentes](#persistent-terms));
- as conversões de `unicode` ([módulo unicode](#unicode-module));
- as consultas sobre módulos carregados do módulo `code`
  ([módulo code](#code-module));
- as respostas sobre a linha de comandos do módulo `init`
  ([módulo init](#init-module));
- `atomics`, `counters` e as funções de `erts_internal` que a stdlib chama
  ([atomics e counters](#atomics-and-counters), [erts_internal](#erts-internal));
- as tabelas de `unicode_util` ([unicode_util](#unicode-util));
- identidades de processos: `self/0`, `make_ref/0`, `pid_to_list/1`
  e `ref_to_list/1` ([pids e referências](terms.md#pids-and-references));
- processos: `spawn/1,3` e `is_process_alive/1`
  ([processos](processes.md)); ligações e sinais de saída:
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([ligações](processes.md#links)); monitores:
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([monitores](processes.md#monitors)); nomes registados:
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([nomes registados](processes.md#registered-names));
- mensagens: `'!'/2` (o operador `!`) e `send/2`
  ([mensagens](processes.md#messages));
- o dicionário do processo: `put/2`, `get/0,1`, `get_keys/0,1`, `erase/0,1`
  ([dicionário do processo](processes.md#process-dictionary));
- conversões de binaries, átomos e números: `atom_to_binary/1,2`,
  `binary_to_atom/1,2`, `binary_to_existing_atom/1,2`,
  `list_to_existing_atom/1`, `integer_to_binary/1,2`, `binary_to_integer/1,2`,
  `float_to_binary/1,2`, `binary_to_float/1`, `list_to_float/1`,
  `binary_to_list/3`, `bitstring_to_list/1`, `list_to_bitstring/1`,
  `split_binary/2`, `iolist_size/1`, `list_to_pid/1`, `list_to_ref/1`.
  Partilham as regras de texto das conversões de listas
  (`conversion_text.cpp`: nomes de átomos, dígitos, opções de floats) e os
  erros do OTP: o texto de um float precisa de dígitos de ambos os lados do
  ponto (`list_to_float("1e10")` é `badarg`), um expoente fora do intervalo é
  `badarg` e um underflow `0.0`; as codificações são `utf8`, `unicode` e
  `latin1`; correm até ao fim;
- o [formato externo de termos](#external-term-format):
  `term_to_binary/1,2`, `term_to_iovec/1,2`, `external_size/1,2`,
  `binary_to_term/1,2`;
- [tempo](#time) e valores únicos: `monotonic_time/0,1`,
  `system_time/0,1`, `time_offset/0,1`, `convert_time_unit/3`,
  `timestamp/0`, `now/0`, `unique_integer/0,1`, `localtime/0`,
  `universaltime/0`, `date/0`, `time/0`, `localtime_to_universaltime/1,2`,
  `universaltime_to_localtime/1`, `posixtime_to_universaltime/1`,
  `universaltime_to_posixtime/1`; [temporizadores](processes.md#timers):
  `start_timer/3,4`, `send_after/3,4`, `cancel_timer/1,2`, `read_timer/1,2`;
- [introspeção de processos](processes.md#introspection):
  `process_info/1,2`, `processes/0`, `group_leader/0,2`,
  `garbage_collect/0,1,2`, `yield/0`;
  [informação do sistema](#system-information): `statistics/1`,
  `system_info/1`, `memory/0,1`;
- [opções de spawn e aliases](processes.md#spawn-options):
  `spawn_opt/2..5`, `spawn_request/1..5`, `spawn_request_abandon/1`,
  `alias/0,1`, `unalias/1`, `monitor/3`, `hibernate/3`;
- [informação de funs](funs.md#fun-information), [hashing](#hashing) e MD5:
  `fun_info/1,2`, `fun_to_list/1`, `is_builtin/3`, `phash/2`, `phash2/1,2`,
  `md5/1`, `md5_init/0`, `md5_update/2`, `md5_final/1`;
- [nós](processes.md#nodes) e [carregamento de código](#code-loading):
  `nodes/0,1,2`, `is_alive/0`, `monitor_node/2,3`, `disconnect_node/1`,
  `module_loaded/1`, `loaded/0`, `pre_loaded/0`, `delete_module/1`,
  `prepare_loading/2`, `finish_loading/1`, `get_module_info/1,2`.

As entradas são apenas acrescentadas: o índice de uma entrada é o número que o
código gerado passa ao serviço da ponte. Uma chamada qualificada de um builtin
do catálogo de outro módulo (`io:format(F, A)`) também chama a ponte. Todas
as outras funções `erlang` chegam ao
[módulo de biblioteca erlang](#erlang-module).

## Como as chamadas chegam até eles

| Origem | Caminho |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Serviços inline, como antes da ponte |
| `erlang:function_exported(M, F, A)`, `setelement(I, T, V)`, `A ++ B`, `A -- B`, `length(L)` num corpo (builtins do catálogo sem serviço inline) | Entrada como numa função: `CLAUSE_builtin_frame_v1(context, index)` dá o frame do builtin, os argumentos vão nos registos ([porções](#portions)) |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externa `erlang:F/A`; o registo associa-a ao builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` em tempo de execução | O code server procura primeiro uma exportação do módulo e depois um builtin |

- `fun F/A` de um builtin auto-importado que o módulo não define nem suprime
  (`-compile({no_auto_import, ...})`) é a fun externa `erlang:F/A`, como no
  OTP: `fun abs/1 =:= fun erlang:abs/1` e é impressa como
  `fun erlang:abs/1`. `halt/0,1`, `setelement/3`, `tuple_to_list/1`,
  `list_to_tuple/1`, as conversões, os builtins de processos e os builtins de port `open_port/2`, `port_close/1`,
  `port_command/2,3`, `port_connect/2`, `port_control/3`, `port_to_list/1`, `list_to_port/1` são auto-importados como
  no OTP; `display/1`, `raise/3`, `function_exported/3`, `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3` e
  `ports/0` precisam do prefixo `erlang:` ([ports](ports.md#builtins-and-port-messages)).
- Um builtin tem um `FrameDescriptor` com corpo nulo (`BuiltinFrame`). Entrar
  nele (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) não empilha nenhum frame: o
  builtin corre sobre os registos e o seu resultado regressa ao corpo do
  chamador, pelo que um builtin em posição de cauda regressa ao chamador do
  chamador.
- Os erros são os que o rebaixamento inline lança num corpo: `badarg`,
  `badarith` para a aritmética, `system_limit`, `{badmap, M}`, `{badkey, K}`;
  `raise/3` com uma classe ou pilha inválida devolve `badarg`. Passam pelo
  canal de falhas verificado como qualquer erro de serviço.
- O acesso a termos segue as regras de `badarg` do OTP: `setelement/3` precisa
  de um índice inteiro pequeno dentro do tuplo; `make_tuple/2,3` de um tamanho
  pequeno em 0..16,777,215, e `make_tuple/3` de uma lista própria de pares
  `{Index, Value}` dentro do tamanho (os pares posteriores prevalecem);
  `list_to_tuple/1` de uma lista própria; `A ++ B` de uma lista própria `A`
  (`[] ++ B` é `B` para qualquer `B`, um `B` que não seja lista termina o
  resultado); `A -- B` de duas listas próprias, em que cada elemento de `B`
  remove o primeiro elemento exatamente igual (`=:=`) de `A`, em
  O((n + m) log m).
- As conversões seguem o OTP:
  - `list_to_atom/1` aceita uma lista própria de pontos de código (sem
    surrogates); um 256.º carácter dá `system_limit` antes de ser verificado.
    Uma tabela de átomos cheia (`--max-atoms`) para o programa como falha do
    runtime (`resource_limit`, código de saída 70).
  - `integer_to_list/2` e `list_to_integer/2` aceitam uma base pequena em
    2..36; os dígitos são impressos em maiúsculas e lidos em qualquer caixa.
    `list_to_integer` aceita um sinal opcional, salta zeros à esquerda, exige
    um dígito e lança `system_limit` para mais de 1 262 611 dígitos decimais
    significativos (ou 4 194 304 em qualquer base) depois de os seus primeiros
    dígitos serem válidos, e para um valor acima do limite de inteiros.
  - `float_to_list/1` é `"%.20e"`; as opções de `/2` aplicam-se por ordem,
    prevalecendo o último formato: `{scientific, D}` (`"%.*e"`, D negativo
    equivale a 6), `{decimals, D}` (D >= 0; fixo com o arredondamento próprio
    do OTP abaixo de 2^53 e 19 casas decimais, `compact` remove os zeros
    finais, também de um inteiro com `{decimals, 0}` acima de 2^53), `short`
    (os dígitos mais curtos que preservam o valor, com a escolha
    fixo/científico do OTP). Um texto de 256 bytes ou mais dá `badarg`.
  - `binary_to_list/1` exige um binary; `list_to_binary/1` uma lista e
    `iolist_to_binary/1` uma lista ou binary de bytes, binaries e listas
    aninhadas, cada lista terminada em `[]` ou num binary.
- `function_exported(M, F, A)` lança `badarg` a não ser que `M` e `F` sejam
  átomos e `A` um inteiro pequeno; é verdadeiro quando um módulo do programa
  exporta `M:F/A` ou quando `M:F/A` é um builtin registado.

## Módulo lists

Código-fonte: `runtime/src/builtins/lists/`. O `lists` do OTP é código Erlang
(à parte algumas BIFs), pelo que os builtins do Clause lançam o que as
cláusulas do OTP lançam:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` e
  `keydelete/3` lançam `function_clause` para um argumento que nenhuma
  cláusula do OTP aceita, e percorrem as listas de forma tão preguiçosa como o
  OTP: `sublist([a | b], 1)` é `[a]`, `nthtail(1, [a | b])` é `b`,
  `flatten/2` não verifica a sua cauda além de `is_list`.
- `keymember/3` e `keysearch/3` são BIFs no OTP: `badarg` para uma posição que
  não seja um inteiro pequeno positivo ou para uma cauda imprópria alcançada
  antes de uma correspondência.
- As chaves e a ordem comparam-se com `==` e com a ordem dos termos; de entre
  elementos que se comparam como iguais prevalece o primeiro
  (`max([1, 1.0])` é `1`, `usort([1.0, 1])` é `[1.0]`, `umerge/1,2` mantêm o
  elemento da lista anterior).
- Correm até ao fim. As funções que recebem funs (`foreach/2`, `mapfoldl/3`,
  `mapfoldr/3`, `splitwith/2`, `partition/2`, `filtermap/2`, `uniq/2`, ...)
  são Erlang em `library/stdlib/lists.erl`, porque um builtin não pode chamar
  uma fun e obter o seu resultado; o mesmo acontece com `prefix/2`,
  `suffix/2` e `uniq/1`, com as cláusulas e os guards do OTP.
- Um `function_clause` vindo de um builtin não tem frame próprio
  ([diferenças](differences.md)).

## Módulo math

Código-fonte: `runtime/src/builtins/math.cpp`. `library/stdlib/math.erl`
contém as exportações do OTP 29 como stubs; cada uma é um builtin sobre a
biblioteca C (`pi/0` e `tau/0` são constantes). Os argumentos são números
convertidos em floats: qualquer outra coisa é `badarg`, um inteiro demasiado
grande para um float `badarith`. Um resultado que não seja um float finito (um
erro de domínio como `sqrt(-1)`, `log(0)`, `acos(2)`, ou um overflow como
`pow(10, 400)`, `exp(1000)`) é `badarith`. `floor/1` e `ceil/1` devolvem
floats. Os resultados são os da biblioteca C do anfitrião, que podem diferir
dos do OTP no último bit ([diferenças](differences.md)). Em alvos de 64 bits,
o código gerado calcula inline, para uma célula float, `sqrt`, `floor`, `ceil`
(intrínsecas do LLVM) e `exp`, `log`, `log2`, `log10`, `sin`, `cos`, `pow`
(as mesmas funções da biblioteca C, chamadas sem as substituições do LLVM) de
argumentos numéricos; os outros operandos e os resultados não finitos chamam o
builtin, que lança.

## Módulo binary

Código-fonte: `runtime/src/builtins/binary/`. `library/stdlib/binary.erl`
contém as exportações do OTP 29; `replace/3,4` (incluindo uma substituição
por fun e `{insert_replaced, ...}`) e `list_to_bin/1` são Erlang sobre os
builtins, todas as outras funções são builtins:

- Os padrões são um binary não vazio, uma lista não vazia de binaries não
  vazios ou um padrão compilado. Uma correspondência é a posição mais à
  esquerda e, nela, o padrão mais longo; `matches/2,3` e `split/2,3` com
  `global` tomam correspondências sem sobreposição a partir da esquerda.
  `{scope, {Start, Length}}` limita onde as correspondências podem começar e
  terminar (um comprimento negativo conta para trás); `split/3` aceita também
  `global`, `trim` e `trim_all`.
- `compile_pattern/1` devolve `{bm, [Pattern]}` ou `{ac, Patterns}`, a forma
  própria do Clause (OTP: uma referência dentro do tuplo,
  [diferenças](differences.md)).
- `part/2,3`, `bin_to_list/2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` e
  `decode_hex/1` seguem o OTP; qualquer argumento errado (um bitstring, um
  intervalo fora do sujeito, uma opção desconhecida) é `badarg`.
- `referenced_byte_size/1` é o tamanho do próprio binary.
- Correm até ao fim.

## Módulo maps

Código-fonte: `runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` e `from_keys/2` são builtins
  com os erros do OTP: um não map é `{badmap, Map}`, uma chave em falta de
  `update/3` `{badkey, Key}`, uma lista de chaves que não seja uma lista
  própria `badarg`. As chaves correspondem exatamente (`1` e `1.0` são chaves
  diferentes). `filter/2`, `map/2`, `foreach/2` e `update_with/3,4` são Erlang
  em `library/stdlib/maps.erl`.
- `os:getenv/0` (strings `"Name=Value"`; as entradas `=C:` por unidade do
  Windows ficam de fora), `os:env/0` (pares `{Name, Value}`), `os:putenv/2`,
  `os:unsetenv/1` (`badarg` a não ser que os argumentos sejam strings e o nome
  seja não vazio e sem `=`), `os:getpid/0` e `os:version/0` são builtins;
  `os:timestamp/0`, `os:system_time/0,1`, `os:perf_counter/0,1` e
  `os:getenv/2` são Erlang sobre os builtins de tempo de `erlang` e
  `getenv/1`.

## Termos persistentes

Plan 11 step 41M2 (`runtime/src/builtins/persistent_term.cpp`) sobre a tabela
do runtime ([runtime](runtime.md#persistent-terms)). `put/2` e `put_new/2`
devolvem `ok` (`put_new/2` de uma chave guardada é `ok` para um valor
exatamente igual, caso contrário `badarg`); `get/1` de uma chave não guardada
é `badarg`, `get/2` devolve o valor por omissão; `get/0` lista todos os
`{Key, Value}`; `erase/1` indica se a chave estava guardada; `info/0` é
`#{count => N, memory => Bytes}` (as palavras das cópias guardadas). As chaves
correspondem exatamente (`1` e `1.0` diferem). Cada leitura copia o valor para
o heap do chamador.

## Módulo unicode

Código-fonte: `runtime/src/builtins/unicode/`. `library/stdlib/unicode.erl`
contém as exportações e os tipos do OTP 29; `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` e
`encoding_to_bom/1` são builtins, as funções de normalização, categoria e
identificadores continuam a ser stubs; podem agora ser escritas sobre
[unicode_util](#unicode-util) quando um programa precisar delas.

- Codificações: `latin1`, `unicode`/`utf8`, `utf16` e `utf32`, big endian por
  omissão ou `{utf16 | utf32, big | little}`; qualquer outra coisa é `badarg`
  (`encoding_to_bom/1`: `function_clause`, como no OTP).
- Chardata é um binary ou uma lista, possivelmente imprópria com uma cauda
  binary, de pontos de código, binaries na codificação de entrada e chardata
  aninhada; binaries consecutivos são descodificados como um único fluxo, pelo
  que um carácter pode estender-se por dois. Qualquer outra coisa é `badarg`.
- Um carácter que a saída não aceita (um ponto de código ou uma sequência de
  bytes inválidos, um código acima de 255 para saída `latin1`) termina a
  conversão com `{error, Converted, Rest}`; uma entrada que termina a meio de
  um carácter com `{incomplete, Converted, Rest}`. `Rest` tem a forma do OTP:
  a parte não convertida da lista mais interior encabeçada pelo elemento que
  falhou (um binary como o seu sufixo não convertido, sozinho quando termina o
  nível de topo), dentro da cauda restante de cada lista envolvente; os bytes
  inacabados trazidos de um binary vêm primeiro e, com saída `latin1`, um
  inteiro que falha é envolvido numa lista.
- `bin_is_7bit/1` é falso para tudo o que não seja um binary de bytes abaixo de
  128.

## Módulo code

Código-fonte: `runtime/src/builtins/code.cpp`. `library/kernel/code.erl`
contém as exportações e os tipos do OTP 29; não existe nenhum processo
`code_server`, e as consultas sobre módulos carregados respondem pelo programa
ligado: um módulo está carregado quando o programa o tem (código compilado ou
builtins do runtime). `ensure_loaded/1` dá `{module, M}` ou
`{error, nofile}`, `ensure_modules_loaded/1` `ok` ou
`{error, [{M, nofile}]}`, `is_loaded/1` `{file, preloaded}` ou `false`,
`which/1` `preloaded` ou `non_existing`, `module_status/1` `loaded` ou
`not_loaded`, `all_loaded/0` e `module_status/0` listam todos os módulos,
`is_sticky/1` é `false`. Um argumento de módulo que não seja um átomo é
`function_clause`. Os code paths e o carregamento continuam a ser stubs até ao
[step 71](../.agents/11-plan.md#step-71). O caminho de erro de
`io_lib:format/2` do OTP (`code:ensure_modules_loaded/1`) lança agora o
`badarg` original.

## Módulo init

Código-fonte: `runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Um
executável é um sistema iniciado sem script de arranque. O arranque
descodifica a linha de comandos uma vez (`ProgramArguments`,
`runtime/src/startup/arguments.cpp`): os argumentos a seguir às opções do
runtime são tanto o argv da entrada de aridade 1 como
`get_plain_arguments/0`. Não há flags de emulador; a única flag é `home`,
definida no arranque como o `erlexec` do OTP a define (`HOME`; no Windows
`HOMEDRIVE` e `HOMEPATH`, caso contrário `USERPROFILE`), pelo que
`get_argument(home)` é `{ok, [[Home]]}`, `get_arguments/0` é
`[{home, [Home]}]` e qualquer outra flag é `error`. `script_name/0` é o
caminho absoluto do executável com barras normais. Estas quatro são builtins;
as restantes são Erlang:

- respostas do `init` iniciado do OTP: `get_status/0` `{started, started}`,
  `notify_when_started/1` `started`, `ensure_loaded/1` `not_allowed`,
  `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (espera por
  `{init, started}`); `get_configfd/1` e `set_configfd/2` guardam os seus
  valores em `persistent_term` sob `{init, configfd, Id}`;
- `script_id/0` é `{"Clause", "29"}`;
- `stop/0,1` e `reboot/0` terminam de imediato com as regras de estado do
  OTP: um inteiro não negativo é o código de saída, uma lista de bytes o
  slogan do halt, qualquer outro argumento `badarg`;
- recusadas: `boot/1` e `restart/0,1` lançam `notsup` depois das verificações
  de argumentos do OTP (`restart/1` de uma lista que não seja `[]` nem
  `[{mode, M}]` é `badarg`), `make_permanent/2` devolve `{error, notsup}` para
  nomes válidos e `{error, badarg}` caso contrário.

## Unicode util

Código-fonte: `library/stdlib/unicode_util.erl`,
`runtime/src/builtins/unicode/`. O OTP gera `unicode_util` durante a sua
compilação (900 KB de Erlang); o Clause guarda os dados em tabelas C++ geradas
(`unicode/tables.cpp`) consultadas pelos builtins do seu módulo privado
`clause_unicode` (`table/1`, `class/1`, `cases/1`, `flags/1`,
`compose_pair/2`), e `unicode_util.erl` responde às funções do OTP sobre elas
com as formas de resultado do OTP:

- `cp/1` toma o primeiro ponto de código de chardata como o OTP faz, mantendo
  as caudas binary e achatando até mais três pontos de código de listas
  aninhadas; `{error, Rest}` em UTF-8 inválido;
- `lookup/1`, `category/1`, `get_case/1`, `spec_version/0` (`{17, 0}`),
  `pattern_whitespace/0`; `uppercase/1`, `lowercase/1`, `titlecase/1`,
  `casefold/1` mapeiam o primeiro ponto de código (`{badarg, Rest}` em UTF-8
  inválido); `is_wide/1`, `is_whitespace/1`, `is_other_id_start/1`,
  `is_other_id_continue/1`, `is_letter_not_pattern_syntax/1`;
- `gc/1`: grupos de grafemas estendidos segundo o UAX #29, com a ordem de
  regras do OTP (CR LF, caracteres de controlo, caminhos rápidos de Latin-1,
  prepend, sílabas Hangul, pares de indicadores regionais, sequências
  pictográficas estendidas e ZWJ, conjuntos índicos) e as suas formas de
  resultado: um grupo é um ponto de código ou uma lista, e o resto continua a
  ser a chardata de onde veio onde o OTP a mantém (`{error, Rest}` em UTF-8
  inválido);
- `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` normalizam o primeiro grupo:
  decomposição canónica ou de compatibilidade com Hangul algorítmico,
  ordenação canónica estável e depois composição pelos pares de composição.

`tools/unicode/generate.py` escreve as tabelas uma vez por cada atualização do
Unicode: os mapeamentos de caixa, as categorias (incluindo as categorias
vizinhas que o gerador do OTP dá a alguns pontos de código não atribuídos), as
decomposições e os predicados de propriedades vêm das respostas do OTP
anfitrião para cada ponto de código (`tools/unicode/observe.escript`), e os
dados de quebra de grafemas, emoji, índicos e de composição vêm dos ficheiros
da Unicode Character Database que o OTP 29 fixa (`lib/stdlib/uc_spec`, Unicode
17.0). Só as tabelas geradas são guardadas no repositório, com o aviso de
copyright do Unicode que a Unicode License v3 exige; as compilações normais
não precisam nem do OTP nem dos ficheiros de dados. O teste
`executables_unicode_tables` compara digests das respostas do plano 0 e de
blocos de amostra dos outros planos com os do OTP (todos os 1,1M pontos de
código coincidiam quando as tabelas foram geradas);
`executables_unicode_clusters` compara grupos e formas normais de strings
escolhidas à mão para cada regra e um varrimento com semente de 2000 strings
aleatórias.

## Módulo zlib

Código-fonte: `runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.
O runtime liga o zlib 1.3.2, a versão que o OTP 29 inclui
([zlib](compile.md#zlib)), pelo que os bytes comprimidos são iguais aos do OTP
para todos os níveis, estratégias, tamanhos de janela e flushes. Um fluxo é
uma [referência handle](runtime-heap.md#handle-references) cujo buffer contém
o `z_stream`; o seu finalizador termina uma sessão ativa quando morre a última
cópia. Os builtins privados de `clause_zlib` (`open/0`, `close/1`,
`set_controller/2`, `deflate_init/2`, `inflate_init/3`, `deflate/3`,
`inflate/2`, as chamadas de fim, reposição, parâmetros e dicionário) executam
uma operação sobre toda a sua entrada; `zlib.erl` mantém a API do OTP, os
erros de argumentos (`bad_compression_level`, `bad_windowbits`, ...), os
estados dos fluxos (`not_initialized`, `already_initialized`,
`not_on_controlling_process`, um fluxo fechado que recusa um novo init),
`eos_behavior` (`cut`, `reset`, `error`), `data_error` de `inflateEnd/1` antes
do fim de um fluxo, os dicionários (`{need_dictionary, Adler}` lançado ou
devolvido), a saída retida por `deflateParams/3` para o `deflate` seguinte, e
as funções de buffer completo `compress/1`, `uncompress/1`, `zip/1`,
`unzip/1`, `gzip/1`, `gunzip/1` (membros concatenados). Um cabeçalho gzip
indica a plataforma, tal como o zlib do OTP o escreve. `term_to_binary/2` com
`compressed` ou `{compressed, Level}` comprime como o OTP decide (para cinco
bytes a menos do que a carga útil, caso contrário sem compressão) e
`binary_to_term/1,2` descomprime entradas comprimidas.

## Módulo re

Código-fonte: `runtime/src/builtins/re/`, `library/stdlib/re.erl`. As
exportações e os tipos do OTP 29 sobre a versão do PCRE2 que o OTP inclui
([PCRE2](compile.md#pcre2)). `version/0` é a versão e a data do PCRE2 como
binary (`<<"10.47 2025-10-21">>`, como no OTP).

Um padrão compilado é o `{re_pattern, CaptureCount, Unicode, UseCRLF, Ref}` do
OTP 29, em que `Ref` é uma
[referência handle](runtime-heap.md#handle-references) que detém o
`pcre2_code`; o seu finalizador liberta o código com a última cópia, e os
processos partilham-no só para leitura. Tal como no OTP, a parte C é pequena e
o resto é Erlang:

- `clause_re:compile/2` compila um binary de regex com opções de compilação
  (`{ok, Pattern}` ou `{error, {Message,
  Offset}}` com a mensagem do PCRE2); `re:inspect/2` responde a `namelist`.
- `clause_re:run/4` é a BIF `re:run` do OTP sem os seus traps: uma
  correspondência de um sujeito binary a partir de `{offset, N}`, compilando
  primeiro uma regex textual (`{error, {compile, Reason}}` com
  `report_errors`), com todas as especificações de captura (`all`, `first`,
  `all_but_first`, `none`, `all_names`, números e nomes, nomes duplicados) e
  tipos (`index`, `list`, `binary`), `match_limit` e `match_limit_recursion`
  (`{error, match_limit}` com `report_errors`, caso contrário `nomatch`), e o
  `badarg` do OTP para opções de compilação ou outras convenções de mudança de
  linha dadas com um padrão compilado.
- `re.erl` converte chardata Unicode em UTF-8 e as capturas de volta em
  caracteres, executa correspondências `global` uma de cada vez (depois de uma
  correspondência vazia volta a tentar ancorado e não vazio, e depois avança
  um carácter, ou um par CR LF com mudanças de linha CRLF, como faz o
  `loopexec` do OTP), e implementa `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`,
  uma fun de substituição) e `split/2,3` (`{parts, N}`, `trim`, `group`,
  `{return, Type}`) com os resultados do OTP.

Os padrões exportados (`export`, `import/1`) não são fornecidos.
`executables_re_module` compara com o OTP a compilação, a correspondência, as
capturas, as correspondências globais e Unicode, replace, split e os erros de
argumentos.

## Prim eval

Código-fonte: `runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun,
Timeout)` é o receive de `erl_eval`, cujas cláusulas são uma fun: percorre a
caixa de correio a partir da mensagem mais antiga com os passos de um
[receive](processes.md#receive) compilado, os builtins privados de
`clause_receive` `peek/0` (`{message, M}` ou `none`), `skip/0`, `take/0`,
`restart/0` e `wait/1` (o builtin de espera do código compilado, com o seu
timeout e `timeout_value`). A primeira mensagem para a qual `Fun` responde
algo que não seja `nomatch` é removida e essa resposta é devolvida; `timeout`
quando `Timeout` expira. Uma exceção de `Fun` deixa todas as mensagens no
lugar. `executables_prim_eval_receive` compara com o OTP a ordem da caixa de
correio, os timeouts, uma mensagem que chega durante a espera e as exceções.

## Atomics e counters

Código-fonte: `runtime/src/builtins/atomics.cpp`. Um array `atomics` é uma
[referência handle](runtime-heap.md#handle-references) cujo buffer contém uma
palavra de sinal e os valores de 64 bits, atualizados através de
`std::atomic_ref` com operações sequencialmente consistentes; é partilhado por
todas as cópias da referência (mensagens, termos persistentes,
`binary_to_term/1` enquanto vive) e libertado com a última.

- `new/2` aceita uma aridade de 1 a 2^27 e opções `[{signed, Bool}]` (a
  última prevalece); `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`,
  `sub_get/3`, `exchange/3`, `compare_exchange/4` e `info/1` são builtins com
  o `badarg` do OTP para uma referência, um índice ou um valor inválidos. Os
  valores guardados têm de caber no array (int64 ou uint64); os incrementos
  podem ser qualquer inteiro de -2^63 a 2^64 - 1 e dão a volta. `info/1` indica
  a `memory` do OTP de 40 + 8 bytes por valor.
- `counters` é Erlang (`library/erts/counters.erl`): `{atomics, Ref}` e
  `{write_concurrency, Ref}` envolvem ambos um array de atomics com sinal,
  pelo que os counters com write concurrency são exatos em cada leitura.
  `info/1` destes últimos indica o tamanho e a memória do array.

## Erts internal

Código-fonte: `runtime/src/builtins/erts_internal.cpp`,
`library/erts/erts_internal.erl`. As funções que a `stdlib` e o `kernel` do
OTP chamam:

- os builtins `cmp_term/2` (ordem exata dos termos: um inteiro antes de um
  float igual) e `map_next/3`, o protocolo de `maps:iterator/1,2` e
  `maps:next/1`: um caminho inteiro percorre o map pela ordem das chaves e
  continua sobre as chaves restantes, um caminho de lista de chaves toma as
  suas chaves por ordem; um acumulador lista recebe todas as associações a
  partir do caminho;
- em Erlang, `list_to_integer/2` e `binary_to_integer/2` (os auxiliares de
  `string:to_integer/1` e das BIFs de conversão, `big` para além de um inteiro
  pequeno do tamanho da palavra), `map_to_tuple_keys/1` (as chaves ordenadas
  de qualquer map), `term_type/1`, as funções `counters_*` de write
  concurrency, `dynamic_node_name/0,1` sobre `persistent_term`;
- recusadas: `get_creation/0` é `undefined` (sem distribuição) e
  `map_hashmap_children/1` lança `badarg` (nenhum map tem nós hashmap);
- declinados: os grupos de distribuição, de `.beam` e internos do emulador.

`erts_code_purger:purge/1` responde `{false, false}` e `soft_purge/1` `true`,
já que o código ligado não tem código antigo; o processo purger e
`finish_after_on_load/2` esperam pelo
[step 71](../.agents/11-plan.md#step-71).

## Porções

Os builtins cujo trabalho cresce com um argumento lista ou binary correm em
porções limitadas, como as BIFs com trap do OTP, para que um builtin demorado
não impeça os outros processos de correr ([processos](processes.md)).

- Cada builtin da ponte chamado por um corpo é invocado como uma função e gasta
  uma redução. Uma porção pode fazer `WORK_PER_REDUCTION` (16) unidades de
  trabalho por redução restante na fatia de tempo (pelo menos o equivalente a
  uma redução): células de lista percorridas ou construídas, comparações,
  bytes. Paga-as a partir da fatia.
- Um builtin com trabalho por fazer faz trap: `ProcessStack::trap` designa um
  frame de continuação e coloca os termos de estado do builtin nos registos,
  que continuam a ser raízes; o estado nativo (bytes, posições de ordenação,
  palavras de termos guardadas como raízes) vive no `TrapState` da pilha do
  processo. O processo cede e retoma na continuação numa fatia posterior. As
  recolhas entre porções reescrevem os registos e as palavras de estado como as
  outras raízes.
- Os resultados, os erros e a ordem de avaliação são os mesmos que correndo
  até ao fim. Um erro encontrado tarde (uma cauda imprópria) é lançado quando o
  percurso o alcança.
- As chamadas do anfitrião (`call_builtin`) prosseguem de imediato após cada
  trap.
- `integer_to_list/1` de um inteiro pequeno, `list_to_integer/1` de uma string
  decimal curta e `atom_to_list/1` trabalham sobre palavras sem alocações
  intermédias; os outros argumentos seguem os caminhos gerais.
  `list_to_tuple/1` e `tuple_to_list/1` leem as células do seu argumento como
  palavras e constroem o resultado sem voltar a admitir os elementos, tal como
  as listas de caracteres destas conversões.
- Os percursos de listas validam a lista uma vez e leem as suas células como
  palavras, sem nenhum `Term` por célula; `Left ++ Right` copia um `Left` de no
  máximo 64 células num único passo, sem estado de porção.

| Builtin | Porções |
| --- | --- |
| `length/1` num corpo | Conta células; numa guard mantém-se o serviço inline, porque a guard BIF do OTP não faz trap |
| `A ++ B` | Recolhe os elementos de `A` e depois constrói a cópia sobre `B` a partir do fim |
| `A -- B` | Recolhe `B`, ordena-o pela ordem exata (merge sort ascendente), percorre `A` com uma pesquisa binária por elemento e depois constrói os elementos mantidos; quando nada é removido, o resultado é o próprio `A` |
| `binary_to_list/1` | Constrói a lista a partir do fim do binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Percorre a iolist em profundidade e depois cria o binary de uma vez |

Os restantes builtins correm até ao fim. Os builtins de tuplos
(`setelement/3`, `make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) fazem
como no OTP: o seu trabalho está limitado pelo limite de aridade dos tuplos.
As restantes conversões leem entradas limitadas pelos limites de átomos,
inteiros e floats. A formatação com `io:format/1,2` corre até ao fim
([diferenças](differences.md)). Os serviços inline de ciclos (a inversão final
de uma comprehension) correm até ao fim como parte do ciclo.

## Builtins tipados

Os builtins que verificam os seus próprios argumentos são funções C++ com
parâmetros tipados ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registadas com
`typed_entry<Function>(module, name)` (a aridade é o número de parâmetros).

- O adaptador admite cada palavra de argumento por ordem (uma palavra que não
  pertence a este processo é a falha que é, nunca `badarg`) e depois converte
  cada uma para o tipo do seu parâmetro; uma discordância lança `badarg` e a
  função não corre.
- Tipos de parâmetros: `Term` (qualquer termo, a alternativa genérica),
  `std::int64_t` (um inteiro pequeno), `detail::Integer` (qualquer inteiro),
  `double` (um float), `ListArgument` (uma lista própria e os seus elementos),
  `TupleArgument`, `BinaryArgument` (os bytes de um binary), `AtomArgument` (a
  sua grafia).
- Resultados: `Term`, `TermResult<Term>` (uma construção falhada é uma falha
  do runtime), `BuiltinResult<Term>` (`std::expected` com um
  `BuiltinFailure`), ou uma `Word` em bruto que a própria função publicou. Uma
  função também pode lançar `BuiltinFailure` (um erro Erlang como `badarg` ou
  `system_limit`, ou uma falha de acesso a termos); `call_builtin` converte
  qualquer outra exceção C++ em `out_of_memory` ou `internal_error`, pelo que
  nenhuma atravessa a ABI do código gerado.
- As famílias de acesso a termos, de conversão e de io, `binary_part/2` e
  `function_exported/3` são tipadas. Os restantes builtins `erlang` passam as
  suas palavras de argumento sem conversão aos serviços inline que o código
  gerado também chama, os quais as admitem; continuam a ser adaptadores
  `BuiltinBody` ao nível da palavra.

## Registo

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  pertencente ao `CodeServer`, associa módulo/função/aridade exatos a um
  `BuiltinFrame`. `add` recebe um lote de `BuiltinEntry`s e regista todos ou
  nenhum: um nome vazio, mais de 255 argumentos, uma implementação em falta ou
  um nome já registado (ou repetido no lote) rejeita o lote sem guardar nada.
- O arranque do runtime regista todas as tabelas de `production_builtins()`
  (`erlang_builtins()`, `term_access_builtins()`, `conversion_builtins()`,
  `io_builtins()`), na maioria entradas criadas por `typed_entry`,
  que em conjunto cobrem o
  catálogo; as famílias posteriores acrescentam as suas próprias tabelas.
- Um corpo lê exatamente tantas palavras de argumento quanto a sua aridade e
  regista os erros no canal verificado; as exceções do anfitrião tornam-se
  falhas `out_of_memory` ou `internal_error`.
- O caminho antigo do anfitrião `abi::v1::dispatch_builtin` (módulos nativos
  registados pelo anfitrião por nome,
  [runtime](runtime.md#code-server-and-builtins)) é separado e não foi
  alterado.

## Módulo erlang

O compilador sabe que funções `erlang` existem a partir de duas fontes
próprias, nunca a partir do código do runtime:

- `library/stdlib/erlang.terms`: as exportações de `erlang` do OTP 29 como
  `{Name, Arity, Flags, Status}` (flags `auto_import`, `guard`; estado
  `implemented`, `{planned, Step}` ou `{unavailable, Reason}`:
  `distribution`, `tracing`, `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` observa o OTP anfitrião e
  mantém os estados, que são mantidos à mão.
- `tests/compiler/builtins/generate_erlang.py` transforma-o em
  `library/stdlib/erlang.erl` (o módulo stub próprio do Clause) e
  `compiler/src/semantic/erlang_auto_imports.inc` (a lista de auto-imports do
  OTP). O CTest `builtins_erlang_inventory` verifica que ambos estão
  atualizados e que `implemented` significa um builtin do catálogo, uma função
  que o compilador trata (`apply/2,3`, `is_record/1,2,3`) ou um corpo Erlang
  real (`nif_error/1,2` lançam `error(Reason)` como os stubs do OTP);
  `builtins_erlang_freshness` (etiqueta `host_otp`) compara o inventário com o
  OTP anfitrião.

Chamadas:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` e
  `-import(erlang, ...)` de um builtin vão para o builtin, como antes.
  Qualquer outra exportação junta-se ao programa como o módulo de biblioteca
  `erlang` (compilado como `lists`); os seus stubs lançam
  `error({not_implemented, F, A})` com `erlang:F/A` no topo da pilha, apenas
  quando chamados. Um nome que o módulo não exporta é
  `undefined function erlang:F/A`.
- Uma chamada não qualificada ou `fun F/A` de um auto-import do OTP
  (`get(K)`, `fun put/2`) que o módulo não define, não importa nem suprime com
  `-compile({no_auto_import, ...})` chega a `erlang:F/A` da mesma forma.
- Os builtins são sticky: quando o módulo `erlang` se regista, o runtime salta
  todas as exportações com o nome de um builtin registado, pelo que
  `M:F(Args)` com `M = erlang` e as funs externas ficam associadas ao builtin,
  nunca a um stub.

## Formato externo de termos

Código-fonte: `erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Ambos os
sentidos partilham com o compilador o codec de
[external_term.hpp](../abi/include/clause/abi/external_term.hpp), e percorrem
os termos com pilhas explícitas, pelo que a profundidade de aninhamento não
custa pilha nativa.

- `term_to_binary/1,2` escreve os bytes do OTP para um nó não distribuído
  (`nonode@nohost`, creation 0): átomos UTF-8, `NEW_FLOAT`, `STRING_EXT` para
  listas de bytes até 65535 elementos, maps pela ordem das chaves, pids, ports
  e referências nas suas formas `NEW_PID`, `V4_PORT` e `NEWER_REFERENCE`, e
  `EXPORT_EXT` para `fun M:F/A`. Opções: `{minor_version, 0..2}` (0 escreve
  floats como texto, 0 e 1 átomos Latin-1), `deterministic`, `compressed` e
  `{compressed, 0..9}`; qualquer outra coisa é `badarg`.
- `term_to_iovec/1,2` devolve a codificação como uma lista de um binary;
  `external_size/1,2` o seu tamanho exato.
- `binary_to_term/1,2` verifica cada comprimento face à entrada antes de
  alocar, ignora os bytes a seguir ao termo e devolve `badarg` para entradas
  malformadas, texto de átomo inválido, floats não finitos, chaves de map
  repetidas e identidades de outro nó; `safe` só admite átomos existentes,
  `used` devolve `{Term, BytesRead}`. CTests: `executables_external_terms`
  (bytes do OTP) e `builtins_etf_fuzz` (as codificações mutadas são
  descodificadas ou lançam).

## Tempo

Código-fonte: `erlang/time.cpp`. O tempo monotónico é o relógio estável;
`native` e `perf_counter` são nanossegundos; as unidades são os átomos do OTP
(incluindo os plurais obsoletos) ou um inteiro positivo de partes por segundo.
`convert_time_unit/3` arredonda para baixo, como o OTP. `unique_integer/0,1`
tira valores de um único contador de todo o programa, pelo que cada valor é
positivo, único e crescente quaisquer que sejam as opções (`positive`,
`monotonic`; outras `badarg`). `now/0` é o tempo do sistema tornado
estritamente crescente. As conversões de calendário leem
`{{Y, M, D}, {H, Mi, S}}` de forma estrita (uma data ou hora inválida é
`badarg`) e usam o fuso horário local da biblioteca C.

## Informação do sistema

Código-fonte: `erlang/system.cpp`.

- `statistics/1`: `wall_clock` e `runtime` (`{Total, SinceLastCall}` em
  milissegundos), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (fatias de tempo executadas). O
  Clause não mantém contadores de reduções, de recolha de lixo nem de E/S:
  `reductions`, `exact_reductions`, `garbage_collection` e `io` indicam zeros.
- `system_info/1`: `otp_release` (`"29"`), `version` (`"17.1"`, o ERTS que o
  Clause segue), `machine` (`"Clause"`), `system_version`,
  `system_architecture`, `wordsize` e `{wordsize, internal | external}`,
  `process_count`/`process_limit`, `port_count`/`port_limit`,
  `atom_count`/`atom_limit`, `schedulers`, `schedulers_online`,
  `logical_processors*`, `thread_pool_size`, `smp_support`, `threads`,
  `build_type`, `heap_type`, `kernel_poll`, `debug_compiled`,
  `time_correction`, `time_warp_mode`, `endian`, `compat_rel`.
- `memory/0,1`: os tipos do OTP; `processes` é a conta global do runtime da
  memória dos processos, `atom` uma estimativa a partir do número de átomos,
  `binary`, `code` e `ets` são 0.
- Os outros itens são `badarg`.

## Hashing

Código-fonte: `erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` e `phash/2` calculam o hash da estrutura de um termo: termos
  exatamente iguais têm o mesmo hash em todas as execuções do programa
  (átomos pela grafia, maps pela ordem das chaves, `1` e `1.0` distintos).
  `phash2/1` está em 0..2^27-1, `phash2/2` em 0..Range-1, `phash/2` em
  1..Range; Range é 1..2^32, caso contrário `badarg`. Os valores são os do
  próprio Clause, não os do OTP.
- `md5/1` e `md5_init/0`, `md5_update/2`, `md5_final/1` dão os digests do
  RFC 1321 (os bytes do OTP) de iodata. O contexto é um binary opaco de 96
  bytes com a disposição própria do Clause; outro binary é `badarg`.

## Carregamento de código

Código-fonte: `erlang/code.cpp`. Todos os módulos estão ligados no programa e
permanecem carregados; o [step 71](../.agents/11-plan.md#step-71) decide sobre
o código dinâmico. `module_loaded/1` é verdadeiro para um módulo compilado ou
um módulo com builtins do runtime (`erlang`, `io`, `os`); `loaded/0` e
`pre_loaded/0` listam-nos todos. `delete_module/1` devolve `undefined` para um
módulo desconhecido e lança `error:notsup` para um carregado.
`prepare_loading/2` devolve `{error, badfile}` (nenhum binary é código que o
programa possa carregar) e `finish_loading/1` só aceita `[]`.
`get_module_info(M[, Item])` continua como `M:module_info(...)`.

## Organização do código-fonte

- O runtime implementa os builtins em `runtime/src/builtins/`. Um módulo
  grande tem o seu próprio subdiretório com uma unidade de tradução por
  família de builtins: o módulo `erlang` vive em
  `runtime/src/builtins/erlang/` (`core`: testes de tipo, guard BIFs,
  operadores, lançamento, `display`, `halt`, `function_exported`;
  `term_access`; `lists`: `length`, `++`, `--`; `conversions`; `processes`:
  identidades, spawning, mensagens, ligações, monitores, nomes registados;
  `ports`; `dictionary`: o
  [dicionário do processo](processes.md#process-dictionary);
  `binary_conversions` com `conversion_text`, as regras de texto que partilha
  com `conversions`; `term_encoding` e `term_decoding`: o formato externo de
  termos; `time` e `timers`; `introspection` e `system`; `spawning`;
  `fun_info`, `hashing` e `md5`; `node` e `code`).
- Cada ficheiro de família define a sua própria tabela `*_builtins()`, listada
  em `production_builtins()`. Uma nova família acrescenta um novo ficheiro e
  uma nova tabela em vez de fazer crescer uma existente; um ficheiro com mais
  de cerca de 400 linhas é dividido por família antes de crescer mais. Os
  módulos grandes posteriores seguem a mesma regra
  (`runtime/src/builtins/<module>/`).
- Os módulos pequenos (`io`, `os`) e a infraestrutura da ponte (`registry`,
  `invocation`, `bridge`, `portions`, `typed`, `text`, `float_text`,
  `output`) ficam em `runtime/src/builtins/`.
- O compilador nunca lê código-fonte do runtime: o catálogo
  `abi::v1::bridge_builtins` é a única lista que ambos os lados partilham.
  Continua a ser um único array só de acrescento; os seus comentários de grupo
  nomeiam o ficheiro que implementa.
