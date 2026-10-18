---
source: docs/builtins.md
sourceCommit: 336caea7
sourceSha256: c5d99568a38fc1f7bc865c63163039a8c2acba8d978636c0b9290afdf0b9a637
translatedAt: 2026-10-18
---
# Builtins

Os builtins são funções que o runtime implementa em C++: as BIFs de `erlang` e
as funções de outros módulos cujas contrapartes no OTP são BIFs, NIFs ou
precisam do runtime (saída de `io`, funções de dados de `lists`, `math`,
`binary`, ...). O runtime regista-os por módulo, função e aridade; o código
gerado chega a eles diretamente, através de chamadas dinâmicas e como valores
fun.

## Que builtins existem

O catálogo da ponte `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) lista todos os
builtins que o compilador e o runtime conhecem, em grupos cujos comentários
indicam o ficheiro-fonte que os implementa:

- módulo `erlang`: as guard BIFs, os operadores como funções
  (`erlang:'+'/2`, `'++'/2`, `'--'/2`, ...), `display/1`, `halt/0,1`, as
  funções que lançam exceções, o acesso a termos, as conversões, as
  identidades de processos, os [processos](processes.md) (criação, mensagens,
  ligações, monitores, nomes registados, o dicionário do processo,
  temporizadores, introspeção, opções de spawn, aliases, nós), as
  [portas](ports.md#builtins-and-port-messages), o
  [formato externo de termos](#external-term-format), o [tempo](#time), a
  [informação do sistema](#system-information), a
  [informação de funs](funs.md#fun-information), o [hashing](#hashing) e o
  [carregamento de código](#code-loading);
- outros módulos: a saída de `io` ([io](io.md)), as funções de dados de
  [`lists`](#lists-module), [`math`](#math-module),
  [`binary`](#binary-module), [`maps` e `os`](#maps-module),
  [`ordsets`, `orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`,
  `queue` e `array`](#collections), [`base64` e `json`](#encodings),
  [`calendar`](#calendar), [`filename`](#filename), [`uri_string`](#uri-string), [`string`](#string),
  [`rand` e `random`](#random-numbers),
  [`persistent_term`](#persistent-terms), [`unicode`](#unicode-module),
  [`code`](#code-module), [`init`](#init-module),
  [`atomics`](#atomics-and-counters), [`erts_internal`](#erts-internal),
  [`unicode_util`](#unicode-util) e [`re`](#re-module);
- módulos privados por baixo do código de biblioteca Erlang: `clause_unicode`,
  `clause_re`, `clause_zlib` ([zlib](#zlib-module)) e `clause_receive`
  ([prim eval](#prim-eval)).

Se uma função de um módulo de biblioteca é um builtin, um corpo Erlang ou um
stub fica registado no seu inventário `library/<application>/<module>.terms`
([biblioteca](library.md#files)); o de `erlang` é
[erlang.terms](#erlang-module).

O índice de uma entrada é o número que o código gerado passa ao serviço da
ponte; o compilador e o runtime são compilados em conjunto, pelo que o
catálogo pode ser reordenado. Uma chamada qualificada de um builtin do
catálogo de qualquer módulo (`io:format(F, A)`) chama a ponte. Todas as outras
funções de `erlang` chegam ao
[módulo de biblioteca erlang](#erlang-module).

## Como as chamadas chegam até eles

| Código-fonte | Caminho |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Código inline ou um serviço dedicado do runtime |
| `erlang:function_exported(M, F, A)`, `A -- B` num corpo (builtins do catálogo sem serviço inline) | Entrada como numa função: `CLAUSE_builtin_frame_v1(context, index)` dá o frame do builtin, os argumentos vão nos registos ([porções](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (builtins diretos: nunca fazem trap, nunca esperam nem atuam sobre outro processo) | Chamados de imediato: `CLAUSE_builtin_call_v1(context, index, arguments)` devolve o resultado ([ABI](abi.md#runtime-services)) |
| `length(L)`, `binary_to_list(B)`, `list_to_binary(L)`, `iolist_to_binary(L)` (builtins rápidos) | `CLAUSE_builtin_call_v1` executa um caminho rápido limitado sobre as palavras dos argumentos (no máximo 256 células, elementos ou bytes, 4096 bytes de resultado); devolve 0 para entradas mais longas, outras formas e erros, e a chamada entra então no frame do builtin |
| `A ++ B` | Um `A` próprio e curto é copiado inline; caso contrário, entrada como numa função ([ABI](abi.md#frames-and-transfers)) |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externa `erlang:F/A`; o registo associa-a ao builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` em runtime | O servidor de código procura primeiro uma exportação do módulo e depois um builtin |

- `fun F/A` de um builtin auto-importado que o módulo não define nem suprime
  (`-compile({no_auto_import, ...})`) é a fun externa `erlang:F/A`, como no
  OTP: `fun abs/1 =:= fun erlang:abs/1` e é impressa como
  `fun erlang:abs/1`. As auto-importações são as do OTP (flag `auto_import`
  em [erlang.terms](#erlang-module)); outras, como `display/1`, `raise/3`,
  `function_exported/3`, `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3`
  e `ports/0`, precisam do prefixo `erlang:`.
- Um builtin tem um `FrameDescriptor` com corpo nulo (`BuiltinFrame`).
  Entrar nele (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) não empilha nenhum frame:
  o builtin executa sobre os registos e o seu resultado regressa ao corpo do
  chamador, pelo que um builtin em posição de cauda regressa ao chamador do
  chamador.
- Os erros são os que o rebaixamento inline lança num corpo: `badarg`,
  `badarith` para a aritmética, `system_limit`, `{badmap, M}`, `{badkey, K}`;
  `raise/3` com uma classe ou pilha inválida devolve `badarg`. Passam pelo
  canal de falhas verificado, como todos os erros de serviços.
- O acesso a termos segue as regras de `badarg` do OTP: `setelement/3`
  precisa de um índice inteiro pequeno dentro do tuplo; `make_tuple/2,3` de um
  tamanho pequeno em 0..16 777 215, e `make_tuple/3` de uma lista própria de
  pares `{Index, Value}` dentro do tamanho (os pares posteriores ganham);
  `list_to_tuple/1` de uma lista própria; `A ++ B` de uma lista própria `A`
  (`[] ++ B` é `B` para qualquer `B`, um `B` que não seja lista termina o
  resultado); `A -- B` de duas listas próprias, em que cada elemento de `B`
  remove o primeiro elemento exatamente igual (`=:=`) de `A`, em
  O((n + m) log m).
- As conversões seguem o OTP:
  - `list_to_atom/1` recebe uma lista própria de pontos de código (sem
    surrogates); um 256.º carácter dá `system_limit` antes de ser verificado.
    Uma tabela de átomos cheia (`--max-atoms`) para o programa como falha do
    runtime (`resource_limit`, código de saída 70).
  - `integer_to_list/2` e `list_to_integer/2` recebem uma base pequena em
    2..36; os dígitos são impressos em maiúsculas e lidos em qualquer caixa.
    `list_to_integer` aceita um sinal opcional, salta os zeros à esquerda,
    precisa de um dígito e lança `system_limit` para mais de 1 262 611 dígitos
    decimais significativos (ou 4 194 304 em qualquer base) depois de os
    primeiros dígitos serem válidos, e para um valor acima do limite dos
    inteiros.
  - `float_to_list/1` é `"%.20e"`; as opções de `/2` aplicam-se por ordem,
    ganhando o último formato: `{scientific, D}` (`"%.*e"`, D negativo é 6),
    `{decimals, D}` (D >= 0; fixo com o arredondamento próprio do OTP abaixo
    de 2^53 e 19 casas decimais, `compact` remove os zeros finais, também de
    um inteiro com `{decimals, 0}` acima de 2^53), `short` (os dígitos de
    ida e volta mais curtos, na escolha fixo/científico do OTP). Um texto de
    256 bytes ou mais é `badarg`.
  - `binary_to_list/1` precisa de um binary; `list_to_binary/1` de uma lista e
    `iolist_to_binary/1` de uma lista ou binary de bytes, binaries e listas
    aninhadas, terminando cada lista em `[]` ou num binary.
  - Os gémeos binary (`atom_to_binary/1,2`, `binary_to_integer/1,2`,
    `float_to_binary/1,2`, `list_to_float/1`, ...) partilham estas regras de
    texto (`erlang/conversion_text.cpp`): o texto de um float precisa de
    dígitos em ambos os lados do ponto (`list_to_float("1e10")` é `badarg`),
    um expoente fora do intervalo é `badarg` e um underflow é `0.0`; as
    codificações são `utf8`, `unicode` e `latin1`.
- `function_exported(M, F, A)` lança `badarg` a menos que `M` e `F` sejam
  átomos e `A` um inteiro pequeno; é verdadeiro quando um módulo do programa
  exporta `M:F/A` ou `M:F/A` é um builtin registado.

## Porções

Os builtins cujo trabalho cresce com um argumento lista ou binary executam em
porções limitadas, como as BIFs com trap do OTP, para que um builtin demorado
não impeça outros processos de executar ([processos](processes.md)).

- Cada builtin da ponte chamado por um corpo é invocado como uma função e gasta
  uma redução. Uma porção pode fazer `WORK_PER_REDUCTION` (16) unidades de
  trabalho por cada redução que resta na fatia de tempo (pelo menos o
  equivalente a uma redução): células de lista percorridas ou construídas,
  comparações, bytes. Paga-as com a fatia.
- Um builtin com trabalho por fazer faz trap: `ProcessStack::trap` designa um
  frame de continuação e coloca os termos de estado do builtin nos registos,
  que continuam a ser raízes; o estado nativo (bytes, posições de ordenação,
  palavras de termos guardadas como raízes) vive no `TrapState` da pilha do
  processo. O processo cede e retoma na continuação numa fatia posterior. As
  recolhas entre porções reescrevem os registos e as palavras de estado como
  as outras raízes.
- Um builtin pode também continuar numa exportação Erlang: a saída de `io`
  para um dispositivo que é um processo faz trap para `file:write/2`
  ([io](io.md#calls)).
- Os resultados, os erros e a ordem de avaliação são os mesmos que numa
  execução até ao fim. Um erro encontrado tarde (uma cauda imprópria) é
  lançado quando o percurso lá chega.
- As chamadas do anfitrião (`call_builtin`) continuam cada trap de imediato.
- Os percursos de listas validam a lista uma vez e leem as suas células como
  palavras. As entradas pequenas seguem caminhos rápidos ao nível das palavras
  sem estado de porção: `Left ++ Right` com no máximo 64 células em `Left`,
  `integer_to_list/1` de um inteiro pequeno, `list_to_integer/1` de uma string
  decimal curta, `atom_to_list/1`, `list_to_tuple/1` e `tuple_to_list/1`.

| Builtin | Porções |
| --- | --- |
| `length/1` num corpo | Conta células; numa guard mantém-se o serviço inline, porque a guard BIF do OTP não faz trap |
| `A ++ B` | Recolhe os elementos de `A` e depois constrói a cópia sobre `B` a partir do seu fim |
| `A -- B` | Recolhe `B`, ordena-o pela ordem exata (merge sort ascendente), percorre `A` com uma pesquisa binária por elemento e depois constrói os elementos mantidos; quando nada é removido, o resultado é o próprio `A` |
| `binary_to_list/1` | Constrói a lista a partir do fim do binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Percorre a iolist em profundidade e depois cria o binary de uma só vez |

Os outros builtins executam até ao fim. Os builtins de tuplos (`setelement/3`,
`make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) fazem como no OTP: o
seu trabalho é limitado pelo limite de aridade dos tuplos. As restantes
conversões leem entradas limitadas pelos limites de átomos, inteiros e floats.
A formatação com `io:format/1,2` executa até ao fim
([diferenças](differences.md)). Os serviços inline de ciclos (a inversão final
de uma comprehension) executam até ao fim como parte do ciclo.

## Builtins tipados

Os builtins que verificam os seus próprios argumentos são funções C++ com
parâmetros tipados ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registadas com
`typed_entry<Function>(module, name)` (a aridade é o número de parâmetros).

- O adaptador admite cada palavra de argumento por ordem (uma palavra que este
  processo não detém é a falha que é, nunca `badarg`) e depois converte cada
  uma no tipo do seu parâmetro (`Term`, um inteiro pequeno ou qualquer
  inteiro, `double`, argumentos lista, tuplo, binary, átomo, map ou pid local;
  ver `typed.hpp`); uma discordância lança `badarg` e a função não executa.
  `Named<Role>` é qualquer termo sob um tipo de papel próprio
  (`collections::Key`, `Value`, `List`, ...), pelo que um builtin com vários
  parâmetros de termo não pode ter dois trocados; o builtin verifica o termo.
- Uma função devolve um termo, um `BuiltinResult` (`std::expected` com um
  `BuiltinFailure`) ou uma `Word` em bruto que ela própria publicou, ou lança
  `BuiltinFailure` (um erro Erlang ou uma falha de acesso a termos);
  `call_builtin` converte qualquer outra exceção C++ em `out_of_memory` ou
  `internal_error`, pelo que nenhuma atravessa a ABI do código gerado.
- A maioria das famílias é tipada. As guard BIFs e os operadores
  (`erlang/core.cpp`), os builtins de listas com trap e alguns outros são
  adaptadores `BuiltinBody` ao nível das palavras, que passam as suas palavras
  de argumento aos serviços inline que o código gerado também chama. As
  conversões frequentes leem as células dos argumentos no local
  (`TermAccess::trusted`) em vez de admitir `Term`s: `tuple_to_list/1`,
  `phash2/1` (listas, tuplos e inteiros pequenos), e `list_to_atom/1`,
  `list_to_integer/1` de strings ASCII curtas, e `binary:part/2,3`, um builtin
  direto cujo resultado curto é escrito diretamente em palavras do heap
  (argumentos de builtin ao nível das palavras).

## Registo

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  detido pelo `CodeServer`, associa módulo/função/aridade exatos a um
  `BuiltinFrame`. `add` recebe um lote de `BuiltinEntry` e regista tudo ou
  nada: um nome vazio, mais de 255 argumentos, uma implementação em falta ou
  um nome já registado (ou repetido no lote) rejeita o lote sem nada guardar.
- O arranque do runtime regista todas as tabelas de famílias de
  `production_builtins()` (`builtins/registry.cpp`), que em conjunto cobrem o
  catálogo.
- Os builtins são persistentes (sticky): quando um módulo se regista, o
  servidor de código salta todas as exportações com o nome de um builtin
  registado, pelo que `M:F(Args)`, `apply/3` e as funs externas se associam ao
  builtin, nunca a um corpo `clause_builtin_placeholder` de um módulo de
  biblioteca ([marcadores de posição](library.md#provided-or-missing)) nem a uma
  função do utilizador com o mesmo nome.
- Um corpo lê exatamente a sua aridade de palavras de argumento e regista os
  erros no canal verificado; as exceções do anfitrião tornam-se falhas
  `out_of_memory` ou `internal_error`.
- O caminho do anfitrião `abi::v1::dispatch_builtin` (módulos nativos
  registados pelo anfitrião por nome,
  [runtime](runtime.md#code-server-and-builtins)) é separado.

## Organização do código-fonte

- O runtime implementa os builtins em `runtime/src/builtins/`. Um módulo
  grande tem o seu próprio subdiretório com uma unidade de tradução por
  família de builtins (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`,
  `zlib/`); os módulos pequenos e a infraestrutura da ponte (`registry`,
  `bridge`, `portions`, `typed`, formatação de texto e de floats) são ficheiros
  únicos.
- Cada ficheiro de família define a sua própria tabela `*_builtins()`, listada
  em `production_builtins()`. Uma família nova acrescenta um ficheiro e uma
  tabela novos em vez de aumentar um existente; um ficheiro com mais de cerca
  de 400 linhas é dividido por família antes de crescer mais.
- O compilador nunca lê código-fonte do runtime: o catálogo
  `abi::v1::bridge_builtins` é a única lista que ambos os lados partilham; os
  comentários dos seus grupos indicam o ficheiro que os implementa.

## Módulo erlang

O compilador sabe que funções de `erlang` existem a partir de duas fontes
próprias, nunca a partir de código do runtime:

- `library/erts/erlang.terms`: as exportações de `erlang` do OTP 29 como
  `{Name, Arity, Flags, Status}` (flags `auto_import`, `guard`; estado
  `implemented` ou `{unavailable, Reason}`: `distribution`, `tracing`,
  `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` observa o OTP do anfitrião
  e mantém os estados, que são mantidos à mão.
- `tests/compiler/builtins/generate_erlang.py` converte-o em
  `library/erts/erlang.erl` (o módulo stub próprio do Clause, um corpo de
  marcador de posição para cada builtin do catálogo) e
  `compiler/src/semantic/erlang_auto_imports.inc` (a lista de auto-importações
  do OTP). O CTest `builtins_erlang_inventory` verifica que ambos estão
  atualizados e que `implemented` significa um builtin do catálogo, uma função
  que o compilador trata (`apply/2,3`, `is_record/1,2,3`) ou um corpo Erlang
  real (`nif_error/1,2` lançam `error(Reason)` como os stubs do OTP);
  `builtins_erlang_freshness` (etiqueta `host_otp`) compara o inventário com o
  OTP do anfitrião.

Chamadas:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` e
  `-import(erlang, ...)` de um builtin vão para o builtin. Qualquer outra
  exportação junta-se ao programa como o módulo de biblioteca `erlang`; os
  seus stubs lançam `error({not_implemented, F, A})` com `erlang:F/A` no topo
  da pilha, apenas quando chamados. Um nome que o módulo não exporta dá
  `undefined function erlang:F/A`.
- Uma chamada não qualificada ou `fun F/A` de uma auto-importação do OTP
  (`get(K)`, `fun put/2`) que o módulo não define, não importa nem suprime com
  `-compile({no_auto_import, ...})` chega a `erlang:F/A` da mesma forma.

## Formato externo de termos

`erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Ambos os sentidos
partilham o codec de
[external_term.hpp](../abi/include/clause/abi/external_term.hpp) com o
compilador e percorrem os termos com pilhas explícitas, pelo que a
profundidade de aninhamento não custa pilha nativa. O codificador lê as
células do seu argumento validado no local (`TermAccess::trusted`, sem
pesquisa de endereço por célula); o descodificador recolhe os filhos numa
única pilha partilhada e escreve tuplos, listas e strings diretamente em
palavras do heap que reclama uma vez por contentor (`TermAccess::claim`).

- `term_to_binary/1,2` escreve os bytes do OTP para um nó não distribuído
  (`nonode@nohost`, criação 0): átomos UTF-8, `NEW_FLOAT`, `STRING_EXT` para
  listas de bytes até 65535 elementos, maps por ordem das chaves, pids, portas
  e referências nas suas formas `NEW_PID`, `V4_PORT` e `NEWER_REFERENCE`, e
  `EXPORT_EXT` para `fun M:F/A`; uma fun local ou um native record dá
  `error:notsup`. Opções: `{minor_version, 0..2}` (0 escreve floats como
  texto, 0 e 1 átomos Latin-1), `deterministic`, `compressed` e
  `{compressed, 0..9}` ([zlib](#zlib-module)); qualquer outra coisa é
  `badarg`.
- `term_to_iovec/1,2` devolve a codificação como uma lista de um binary;
  `external_size/1,2` o seu tamanho exato.
- `binary_to_term/1,2` verifica cada comprimento em relação à entrada antes de
  alocar, ignora os bytes depois do termo, descomprime a entrada comprimida e
  devolve `badarg` para entradas malformadas, texto de átomo inválido, floats
  não finitos, chaves de map repetidas e identidades de outro nó; `safe`
  admite apenas átomos existentes, `used` devolve `{Term, BytesRead}`. CTests:
  `executables_external_terms` (bytes do OTP) e `builtins_etf_fuzz`
  (codificações mutadas são descodificadas ou lançam uma exceção).

## Tempo

`erlang/time.cpp`. O tempo monótono é o relógio estável (steady clock);
`native` e `perf_counter` são nanossegundos; as unidades são os átomos do OTP
(incluindo os plurais obsoletos) ou um inteiro positivo de partes por segundo.
`convert_time_unit/3` arredonda para baixo, como o OTP. `unique_integer/0,1`
obtém valores de um único contador de todo o programa, pelo que cada valor é
positivo, único e crescente quaisquer que sejam as opções (`positive`,
`monotonic`; outras dão `badarg`). `now/0` é o tempo do sistema tornado
estritamente crescente. As conversões de calendário leem
`{{Y, M, D}, {H, Mi, S}}` de forma estrita (uma data ou hora inválida é
`badarg`) e usam o fuso horário local da biblioteca C. Temporizadores:
[processos](processes.md#timers).

## Informação do sistema

`erlang/system.cpp`.

- `statistics/1`: `wall_clock` e `runtime` (`{Total, SinceLastCall}` em
  milissegundos), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (fatias de tempo executadas). O
  Clause não mantém contadores de reduções, de recolha de lixo nem de E/S:
  `reductions`, `exact_reductions`, `garbage_collection` e `io` devolvem
  zeros.
- `system_info/1`: os itens da release e da compilação (`otp_release` `"29"`,
  `version` `"17.1"`, o ERTS que o Clause segue, `machine` `"Clause"`,
  `system_version`, `system_architecture`, `wordsize`, `endian`, ...), as
  contagens e limites de processos, portas e átomos, as contagens de
  escalonadores e processadores e as respostas fixas do emulador
  (`smp_support`, `threads`, `time_warp_mode`, ...); a lista completa está em
  `system.cpp`.
- `memory/0,1`: os tipos do OTP; `processes` é a contabilidade de memória dos
  processos de todo o runtime, `atom` uma estimativa a partir do número de
  átomos, `binary`, `code` e `ets` são 0.
- Os outros itens são `badarg`.

## Hashing

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` é o `make_hash2` do OTP e `phash/2` o seu `make_hash`,
  percorrendo células de listas e tuplos no local: átomos (pelo hash do OTP da
  sua grafia), inteiros, floats, binaries e bitstrings, listas, tuplos e maps
  (independentemente da ordem) produzem os valores de hash do OTP, pelo que
  `dict` e `sets` da versão 1 dispõem os seus buckets como o OTP. Os pids,
  ports e referências usam os números do Clause, as funs o módulo, aridade ou
  índice e capturas, os native records os valores dos campos
  ([diferenças](differences.md)). `phash2/1` está em 0..2^27-1, `phash2/2`
  em 0..Range-1, `phash/2` em 1..Range; Range está em 1..2^32, caso
  contrário `badarg`.
- `md5/1` e `md5_init/0`, `md5_update/2`, `md5_final/1` dão os resumos do
  RFC 1321 (os bytes do OTP) de iodata. O contexto é um binary opaco de 96
  bytes com a disposição própria do Clause; outro binary é `badarg`.

## Carregamento de código

`erlang/code.cpp`. Cada módulo é ligado ao programa e mantém-se carregado; o
código dinâmico é adiado.
`module_loaded/1` é verdadeiro para um módulo compilado ou um módulo com
builtins do runtime (`erlang`, `io`, `os`, ...); `loaded/0` e `pre_loaded/0`
listam-nos todos. `delete_module/1` devolve `undefined` para um módulo
desconhecido e lança `error:notsup` para um carregado. `prepare_loading/2`
devolve `{error, badfile}` (nenhum binary é código que o programa possa
carregar) e `finish_loading/1` só aceita `[]`. `get_module_info(M[, Item])`
continua como `M:module_info(...)`.

## Módulo lists

`runtime/src/builtins/lists/`. O `lists` do OTP é código Erlang (à parte
algumas BIFs), pelo que os builtins do Clause lançam o que as cláusulas do OTP
lançam:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `flatlength/1`, `delete/2`, `concat/1`, `max/1`,
  `min/1`, `usort/1`, `umerge/1,2`, `merge/1,2`, `merge3/3`, `umerge3/3`,
  `keymerge/3`, `ukeymerge/3`, `ukeysort/2`, `keydelete/3`, `keyreplace/4`,
  `keystore/4`, `keytake/3`, `zip/2,3`, `zip3/3,4`, `unzip/1`, `unzip3/1` e
  `enumerate/1,2,3` lançam `function_clause` para um argumento que nenhuma
  cláusula do OTP aceita, e percorrem as listas de forma tão preguiçosa como o
  OTP: `sublist([a | b], 1)` é `[a]`, `nthtail(1, [a | b])` é `b`,
  `flatten/2` não verifica a sua cauda além de `is_list`, uma fusão devolve a
  outra lista tal como está quando uma é `[]` e lança `badarg` para um resto
  impróprio que concatena, e uma fusão por chave lança `badarg` para um
  elemento que não seja um tuplo com o tamanho da chave, como `element/2`.
- `zipwith/3,4` e `zipwith3/4,5` são Erlang sobre os builtins `zip`, que
  emparelham primeiro os elementos; `flatmap/2`, `keymap/3`, `search/2`,
  `umerge/3` e `usort/2` também são Erlang. Dentro de `lists.erl`, um builtin
  é chamado de forma qualificada (`lists:zip(...)`): uma chamada local
  chegaria ao seu marcador de posição. As funções não documentadas `rmerge/2,3`,
  `rmerge3/3`, `rumerge/2,3`, `rumerge3/3`, `rkeymerge/3` e `rukeymerge/3`
  (auxiliares de ordenação do OTP) mantêm-se stubs.
- `keymember/3` e `keysearch/3` são BIFs no OTP: `badarg` para uma posição que
  não seja um inteiro pequeno positivo ou para uma cauda imprópria alcançada
  antes de uma correspondência.
- As chaves e a ordem comparam-se com `==` e a ordem dos termos; dos elementos
  que se comparam como iguais ganha o primeiro (`max([1, 1.0])` é `1`,
  `usort([1.0, 1])` é `[1.0]`, `umerge/1,2` mantêm o elemento da lista
  anterior).
- Executam até ao fim. As funções que recebem funs (`foreach/2`,
  `mapfoldl/3`, `splitwith/2`, `filtermap/2`, `uniq/2`, ...) são Erlang em
  `library/stdlib/lists.erl`, porque um builtin não pode chamar uma fun e
  receber o seu resultado de volta; o mesmo acontece com as outras funções
  implementadas, com as cláusulas e guards do OTP.
- Um `function_clause` vindo de um builtin não tem frame próprio
  ([diferenças](differences.md)).

## Módulo math

`runtime/src/builtins/math.cpp`. Todas as funções de `math` do OTP 29 são
builtins sobre a biblioteca C (`pi/0` e `tau/0` são constantes). Os argumentos
são números convertidos em floats: qualquer outra coisa é `badarg`, um inteiro
demasiado grande para um float `badarith`. Um resultado que não seja um float
finito (um erro de domínio como `sqrt(-1)`, `log(0)`, `acos(2)`, ou um
overflow como `pow(10, 400)`, `exp(1000)`) é `badarith`. `floor/1` e `ceil/1`
devolvem floats. Os resultados são os da biblioteca C do anfitrião, que podem
diferir dos do OTP no último bit ([diferenças](differences.md)). Em alvos de
64 bits, o código gerado calcula `sqrt`, `floor`, `ceil` (intrínsecos do LLVM)
e `exp`, `log`, `log2`, `log10`, `sin`, `cos`, `pow` (as mesmas funções da
biblioteca C, chamadas sem as substituições do LLVM) de argumentos numéricos
inline numa célula float; os outros operandos e os resultados não finitos
chamam o builtin, que lança a exceção.

## Módulo binary

`runtime/src/builtins/binary/`. `replace/3,4` (incluindo uma substituição por
fun e `{insert_replaced, ...}`) e `list_to_bin/1` são Erlang em
`library/stdlib/binary.erl` sobre os builtins; todas as outras funções são
builtins:

- Os padrões são um binary não vazio, uma lista não vazia de binaries não
  vazios ou um padrão compilado. Uma correspondência é a posição mais à
  esquerda e, nela, o padrão mais longo; `matches/2,3` e `split/2,3` com
  `global` tomam correspondências sem sobreposição a partir da esquerda.
  `{scope, {Start, Length}}` limita onde as correspondências podem começar e
  terminar (um comprimento negativo conta para trás); `split/3` aceita também
  `global`, `trim` e `trim_all`.
- `compile_pattern/1` devolve `{bm, [Pattern]}` ou `{ac, Patterns}`, uma forma
  própria do Clause (no OTP: uma referência dentro do tuplo,
  [diferenças](differences.md)).
- `part/2,3`, `bin_to_list/1,2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` e
  `decode_hex/1` seguem o OTP; qualquer argumento errado (um bitstring, um
  intervalo fora do sujeito, uma opção desconhecida) é `badarg`.
- `referenced_byte_size/1` é o tamanho do próprio binary.
- Executam até ao fim.

## Módulo maps

`runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- Todas as funções documentadas de `maps` funcionam. `maps:get/3`, `is_key/2`,
  `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`,
  `without/2`, `from_keys/2`, `intersect/2` e `is_iterator_valid/1` são builtins com
  os erros do OTP: algo que não seja um map é `{badmap, Map}`, uma chave em
  falta em `update/3` é `{badkey, Key}`, uma lista de chaves que não seja uma
  lista própria é `badarg`. As chaves correspondem exatamente (`1` e `1.0` são
  chaves diferentes).
- As funções que recebem funs são Erlang em `library/stdlib/maps.erl`:
  `filter/2`, `filtermap/2`, `map/2`, `fold/3` e `foreach/2` recebem um map ou
  um iterador (qualquer outra coisa é `{badmap, MapOrIter}`),
  `intersect_with/3` combina sobre `intersect/2` e `merge_with/3` sobre
  `merge/2`. `groups_from_list/2,3` chamam as funs começando pelo último
  elemento, como faz o OTP, e o builtin privado `clause_maps:groups/1` agrupa
  os pares `{Key, Value}`. Os iteradores (`iterator/1,2`, `next/1`) usam
  [`erts_internal:map_next/3`](#erts-internal).
- Os cursores de maps (`runtime/src/terms/map_cursor.hpp`) percorrem da mesma
  forma uma célula de map plana e uma árvore de map, como palavras por ordem
  das chaves, sem nenhum `Term` por entrada. O builtin privado
  `clause_maps:entries/1` devolve `{K1, V1, K2, V2, ...}` a partir de um
  cursor, pelo que `maps:fold/3` lê as associações no local com `element/2` em
  vez de construir uma lista de pares; `map_next/3` também avança com um.
- `os:type/0`, `os:getenv/0,1` (`getenv/0`: strings `"Name=Value"`; as
  entradas `=C:` por unidade do Windows são omitidas), `os:env/0` (pares
  `{Name, Value}`), `os:putenv/2`, `os:unsetenv/1` (`badarg` a menos que os
  argumentos sejam strings e o nome seja não vazio e sem `=`), `os:getpid/0`
  e `os:version/0` são builtins; `os:timestamp/0`, `os:system_time/0,1`,
  `os:perf_counter/0,1` e `os:getenv/2` são Erlang sobre os builtins de tempo
  de `erlang` e `getenv/1`; `os:cmd/1` executa sobre uma porta
  ([subprocessos](ports.md#subprocesses)).

## Coleções

`runtime/src/builtins/collections/`: `ordsets`,
`orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue` e
`array`, todas as funções documentadas.

- Os percursos de listas são builtins: pertença, inserção, remoção e álgebra
  de conjuntos de `ordsets` (`union/2`, `intersection/1,2`, `subtract/2`,
  `is_subset/2`, `is_disjoint/2`, `is_set/1`); pesquisas e atualizações sem
  funs de `orddict` (`store/3`, `append/3`, `append_list/3`,
  `update_counter/3`, `take/2`, `from_list/1`, ...); todas as funções de
  `proplists` exceto `property/1,2`, `get_value/2`, `normalize/2`, `to_map/2`
  e `from_map/1`, que são código de ligação Erlang em `library/stdlib/`.
- As funções que recebem funs (`ordsets:fold/3`, `filter/2`, `map/2`,
  `filtermap/2`, `orddict:update/3,4`, `fold/3`, `map/2`, `filter/2`,
  `merge/3`) são Erlang.
- Cada builtin percorre as suas listas como as cláusulas do OTP, pelo que os
  resultados e erros coincidem para qualquer entrada: os elementos e chaves
  comparam-se com `<` e `==` (de `1` e `1.0` mantém-se o representante que o
  OTP mantém, incluindo depois de `union/2` trocar os conjuntos), um resto
  que o OTP devolve sem verificar (`ordsets:union([], X)` é `X`) é devolvido
  tal como está, uma forma que nenhuma cláusula aceita é `function_clause`,
  uma entrada que não seja lista numa comprehension é `{bad_generator, Rest}`,
  `Old ++ New` com `Old` impróprio é `badarg` e `update_counter/3` com um
  valor que não seja número é `badarith`. As chaves de `proplists`
  correspondem com `=:=`.
- `proplists:get_keys/1` lista as chaves pela ordem das chaves de um map, como
  faz o conjunto de chaves do OTP ([diferenças](differences.md)).
- `dict` e `sets`: um dict e um conjunto da versão 1 são os records do OTP
  sobre uma tabela de hash linear (`collections/linear_hash.cpp`), segmentos
  de 16 listas de buckets com slots de `erlang:phash/2`, expandidos e
  contraídos exatamente como no OTP, pelo que os records, `to_list/1` e as
  ordens dos folds são iguais aos do OTP. Um conjunto da versão 2 (por omissão)
  é um map com valores `[]`; dois maps intersectam-se e subtraem-se com os
  valores do OTP (os valores do próprio map quando são mantidas chaves
  suficientes, caso contrário `[]`). As pesquisas e atualizações de um dict,
  as operações de `sets` sem funs, `new/0` e `from_list/1` são builtins;
  `update`, `fold`, `map`, `filter`, `merge` e `sets:new/1`, `from_list/2`,
  `fold`, `filter`, `map`, `filtermap` são Erlang, as baseadas em hash sobre
  os builtins privados `clause_hashed:entries/1` (ordem de armazenamento),
  `with_values/2` e `keep/2`. Um termo que não seja dict lança
  `{badrecord, Term}` (`size/1`, `is_empty/1` lançam `function_clause`), um
  que não seja conjunto lança `function_clause`.
- `gb_trees` e `gb_sets` partilham um motor de árvores equilibradas
  (`collections/balanced_tree.cpp`): a inserção verifica a regra de peso de
  Andersson ao regressar e reconstrói uma subárvore a partir das entradas
  ordenadas como faz o OTP, a remoção promove o menor nó do lado maior, e a
  união, interseção e diferença de `gb_sets` fundem as listas ordenadas ou
  inserem e pesquisam segundo a regra de tamanho do OTP (`N2 < 10` ou
  `N2 < N1 * round(1.46 ln N2)`), construindo árvores fundidas mais pesadas à
  direita como `balance_revlist` do OTP, pelo que cada árvore é igual à do
  OTP. `map`, `fold`, `filter`, `filtermap` e as constantes são Erlang.
- `queue`: o `{Rear, Front}` do OTP; cada operação move elementos entre as
  listas como no OTP (um lado com um elemento move-se, uma lista isolada
  divide-se a meio), pelo que as filas são iguais às do OTP. Um termo que não
  seja um par de listas é `badarg`, `get`, `drop`, `head` de uma fila vazia
  dão o erro `empty`. As funções que recebem funs e os nomes de Okasaki são Erlang.
- `array`: o record `#array{}` do OTP 29, uma árvore de tuplos de folhas de
  16 entradas (`[]` para uma subárvore vazia) com uma folha em cache e um
  deslocamento zero; `set`, `append`, `shift`, `prepend`, `slice`, `reset`,
  `resize` e os construtores (`from_list`, `from_orddict` com os seus
  marcadores de lacunas, `from`) alteram o record exatamente como o OTP. Os
  folds e mapfolds são Erlang sobre os builtins privados
  `clause_array:values/3`, `sparse/3` e `replace/4`, o último reconstruindo um
  intervalo mapeado como os mapfolds do OTP (subárvores vazias desdobradas salvo
  se o map for esparso) e lendo a cache de novo.

## Codificações

`runtime/src/builtins/encoding/`.

- `base64`: todas as funções documentadas são builtins. A codificação recebe
  um binary ou uma lista de inteiros (com a aritmética do OTP: `badarith` para
  um valor não inteiro, `badarg` para além da tabela do alfabeto); a
  descodificação percorre a entrada como as máquinas de estados do OTP, pelo
  que os erros coincidem para qualquer entrada: os espaços em branco são
  ignorados, uma entrada que termina após um carater de um grupo é
  `function_clause`, após dois ou três é `missing_padding` salvo com
  `padding => false`, um carater fora do alfabeto é `badarg` quando o seu
  grupo é construído (`badarith` dentro dos deslocamentos do OTP), tudo exceto
  espaços em branco após o preenchimento é `{case_clause, Symbol}`.
  `mime_decode` ignora todos os carateres fora do alfabeto e os dados após um
  `=` mal colocado.
- `json` (`encoding/json.cpp`): `decode/1` é um builtin que percorre os
  estados do descodificador do OTP sobre uma pilha explícita de contentores
  abertos, pelo que os valores (um objeto mantém o primeiro valor de uma
  chave), o resto após o valor e os erros coincidem: `unexpected_end` onde
  mais entrada poderia completar o texto, `{invalid_byte, Byte}` no byte que
  o OTP rejeita (para um literal cortado, o byte após o primeiro),
  `{unexpected_sequence, Bytes}` para um escape `\u` inválido ou um float
  que `binary_to_float/1` rejeita. `encode_binary/1` e
  `encode_binary_escape_all/1` são builtins que constroem os iodata aninhados
  do OTP, tal como os caminhos por omissão `encode/1` e `format/1,2`
  (`encoding/json_encode.cpp`, através de `clause_json:encode/1` e
  `format/2`); para além de 256 níveis de aninhamento, ou para opções de
  formatação que não sejam inteiros pequenos não negativos, respondem
  `fallback` e `json.erl` constrói os mesmos iodata. Os codificadores e
  formatadores que recebem funs e os descodificadores com callbacks
  `decode/3`, `decode_start/3`, `decode_continue/2` são Erlang; os
  descodificadores percorrem os estados do OTP sobre os analisadores privados
  `clause_json:string/2` e `number/2`, pelo que os callbacks correm pela ordem
  do OTP e os estados de continuação são os tuplos do OTP.

## Filename

`runtime/src/builtins/filename/`.

- `flatten/1`, `join/1,2`, `absname_join/2`, `append/2`, `basename/1,2`,
  `dirname/1`, `extension/1`, `rootname/1,2`, `split/1`, `pathtype/1`,
  `nativename/1` e `validate/1` são builtins que seguem as cláusulas do OTP
  para a família do anfitrião: Unix `/`, ou Windows `/` e `\`, letras de
  unidade (uma maiúscula passa a minúscula com `join` e `split`) e nomes de
  rede `//`. As listas são percorridas como as cláusulas do OTP as abrem
  (listas aninhadas e átomos onde uma cláusula os abre, `List ++ Rest`
  lançando `badarg` para uma lista imprópria), pelo que os resultados mantêm
  as formas do OTP: os elementos do nome, binaries mantidos como elementos por
  `flatten/1`, sublistas e sub-binaries, e o `function_clause` do OTP onde
  uma cláusula encontra algo que não é um carater.
- `absname/1,2` (o diretório atual e o de cada unidade) e `basedir/2,3` (o
  ambiente) são Erlang sobre eles.

## String

`runtime/src/builtins/string/`: todas as funções de `string`.

- Os percursos seguem `string.erl` cláusula a cláusula sobre
  `unicode_util:cp/1` e `gc/1`, que `unicode/code_points.cpp` porta para
  termos com as formas do OTP: listas aninhadas abertas até onde o OTP as abre
  (até mais três pontos de código aplanados após o primeiro), binaries mantidos
  como fatias que partilham o buffer, `{error, Rest}` em UTF-8 inválido.
  Assim, `trim`, `take`, `lexemes`, `split`, `find`, `slice` e `prefix`
  devolvem caudas da entrada, sub-binaries e as listas mistas que o OTP constrói
  (`[Keep | Cont]`, `[Token, Bin]`, o aninhamento de `stack/2`), e lançam os
  erros do OTP (`{badarg, Rest}`, `function_clause`, `case_clause` e
  `badmatch` onde as cláusulas encontram uma resposta inesperada, `badarg` de
  `binary:compile_pattern([])` quando `nth_lexeme/3` compila um conjunto vazio
  de separadores).
- Os percursos finais (`trim/3`, `take/4` com `trailing`), recursivos no corpo
  no OTP, correm como ciclos que registam um frame por passo e reduzem os frames
  no fim, pelo que strings longas não podem esgotar a pilha C++.
- `uppercase/1`, `lowercase/1`, `casefold/1` devolvem a própria entrada quando
  nenhum carater muda, como faz o OTP; `titlecase/1` mapeia o primeiro ponto
  de código. `equal/4` normaliza através de `unicode/normalize.cpp`, a
  transposição de `nfc/nfd/nfkc/nfkd` de `unicode_util` (tabelas de
  decomposição, ordenação canónica, composição por pares, jamo Hangul), e
  volta a verificar restos idênticos a cada passo como a cláusula
  `equal_nocase(A, A)` do OTP.
- `to_integer/1` e `to_float/1` obtêm os carateres do número com `take/2` e
  analisam-nos como `string:list_to_integer/1` (o `{Int, Rest}` de erts com
  `no_integer`, `not_a_list`, `system_limit`) e `list_to_float/1` (sintaxe
  de floats do Erlang, vírgula permitida como ponto, expoente apenas com
  dígitos); qualquer erro interno é `{error, badarg}`.
- A API Latin-1 (`len`, `chr`, `tokens`, `strip`, `left`, `centre`, ...) é
  transposta com os seus erros: `function_clause` onde uma cláusula percorre
  até `[]`, `badarg` de `erlang:length/1`, `++` e `lists:reverse/2`.
- `jaro_similarity/2` faz corresponder clusters de grafemas dentro da distância
  do OTP e conta transposições pela ordem do OTP.

## String URI

`runtime/src/builtins/uri/`.

- `parse/1` é um percorredor da gramática RFC 3986 conduzido por uma tabela
  de delimitadores, mantendo a ordem do OTP para que as respostas incluam onde
  o analisador do OTP parou: primeiro um URI com esquema (uma falha após os
  dois pontos do esquema é definitiva), caso contrário uma referência
  relativa; `userinfo@host` quando o percurso de userinfo tem êxito, caso
  contrário a autoridade como anfitrião; um anfitrião de dígitos que não seja
  um endereço IPv4 estrito é percorrido de novo como nome registado;
  `{error,
  invalid_uri, Fragment}` com o fragmento do OTP. Os anfitriões são
  verificados com as formas IPv4 e IPv6 estritas de `inet`.
- `recompose/1`, `normalize/1,2` e `resolve/2,3` trabalham sobre os
  componentes do map como `uri_string.erl`: a forma de lista ou binary de
  cada componente decide a do resultado, as respostas `{error, ...}` do OTP
  são devolvidas ou lançadas por error ou throw onde as do OTP o são, e
  `resolve` funde um caminho relativo após a última barra do caminho base
  (um percurso de grafemas, como `string:split/3` do OTP).
- `percent_decode/1`, `quote/1,2`, `unquote/1`, `transcode/2`,
  `compose_query/1,2`, `dissect_query/1` e as classes de carateres seguem
  os percursos de bytes do OTP, incluindo erros lançados para um binary e
  devolvidos para uma lista, referências numéricas HTML e `+` em consultas de
  formulários.
- `unicode/graphemes.cpp` segmenta pontos de código em clusters de grafemas
  pelas regras de `unicode_util:gc/1` para os builtins que precisam dos seus limites.

## Números aleatórios

`runtime/src/builtins/rand/`.

- `rand`: os estados são o `{AlgHandler, AlgState}` do OTP com os maps de
  handlers do OTP (as suas funs são as do próprio `rand`) e as disposições de
  estado do OTP, pelo que as sementes exportadas, sequências e estados após
  saltos são iguais aos do OTP para todos os algoritmos (`exsss`, `exro928ss`,
  `exrop`, `exs1024s`, `exsp` e os obsoletos `exs64`, `exsplus`, `exs1024`,
  e `dummy`). Para um handler igual ao do OTP, os builtins privados
  `clause_rand:seed/2`, `next/2`, `uniform/2,3`, `uniform_real/2`, `bytes/3`,
  `normal/2`, `shuffle/3` e `jump/2` fazem o trabalho em C++: inicialização
  da semente (SplitMix64, listas, hashes de tuplos de 3 elementos e erros de
  sementes do OTP), intervalos para além dos bits do gerador, floats densos,
  bytes, o zigurate normal e o fluxo de bits do baralhamento. Qualquer outro
  handler é um plug-in: `rand.erl` executa os algoritmos genéricos do OTP
  sobre as suas funs.
- `splitmix64_next/1`, `exsp_next/1`, `exsp_jump/1` e as funções `mwc59` são
  builtins; `mwc59_seed/0` calcula o hash da semente por omissão de `rand`.
- `tools/rand/observe.escript` observa as constantes do OTP através da API
  de plug-ins de `rand`: as larguras das faixas do zigurate (produtos do
  caminho rápido) e os limites (onde as palavras de uma faixa chegam ao
  caminho lento), e os estados após saltos, a partir dos quais
  `tools/rand/generate.py` resolve cada polinómio de salto sobre GF(2)
  (verificado num segundo estado) e escreve `tables.cpp`; as alturas das
  faixas são calculadas com alta precisão
  ([diferenças](differences.md#random-numbers)).
- `random` (obsoleto): `uniform_s/1` é um builtin do gerador Wichmann-Hill;
  as funções de sementes e do dicionário do processo são Erlang.

## Calendar

`runtime/src/builtins/calendar.cpp`.

- A aritmética gregoriana é feita por builtins sobre inteiros de qualquer
  tamanho com `div` e `rem` truncados do Erlang, pelas fórmulas de eras do
  OTP: `date_to_gregorian_days/1,3`, `gregorian_days_to_date/1`,
  `datetime_to_gregorian_seconds/1`, `gregorian_seconds_to_datetime/1`,
  `day_of_the_week/1,3`, `is_leap_year/1`, `last_day_of_the_month/2`,
  `valid_date/1,3`, `seconds_to_time/1`, `seconds_to_daystime/1`,
  `time_to_seconds/1`, `time_difference/2`, `iso_week_number/1`. Uma forma
  que as cláusulas do OTP rejeitam é `function_clause`, um valor não inteiro
  com que calcula é `badarith`; as datas fora do intervalo são calculadas como
  o OTP as calcula.
- A hora local e universal, o tempo do sistema e a análise e formatação RFC
  3339 são Erlang em `library/stdlib/calendar.erl` sobre os builtins de tempo
  de `erlang` e `proplists`, com os erros do OTP
  (`{badarg, [Arg, Options]}` fora do intervalo, `{badmatch, _}` e
  `{case_clause, _}` para um deslocamento malformado).

## Termos persistentes

`runtime/src/builtins/persistent_term.cpp`, sobre a tabela do runtime
([runtime](runtime.md#persistent-terms)). `put/2` e `put_new/2` devolvem `ok`
(`put_new/2` de uma chave guardada é `ok` para um valor exatamente igual,
caso contrário `badarg`); `get/1` de uma chave não guardada é `badarg`,
`get/2` devolve o valor por omissão; `get/0` lista todos os `{Key, Value}`;
`erase/1` indica se a chave estava guardada; `info/0` é
`#{count => N, memory => Bytes}` (as palavras das cópias guardadas). As chaves
correspondem exatamente (`1` e `1.0` diferem). As leituras devolvem o termo
guardado no local, sem cópia.

## Módulo unicode

`runtime/src/builtins/unicode/`. Todas as funções são builtins:
`characters_to_binary/1,2,3`, `characters_to_list/1,2` (também sob os nomes
internos do OTP `characters_to_binary_int/2` e `characters_to_list_int/2`),
`bin_is_7bit/1`, `bom_to_encoding/1`, `encoding_to_bom/1`, e
(`unicode/forms.cpp`) as formas de normalização, `category/1`,
`is_whitespace/1`, `is_id_start/1` e `is_id_continue/1`.

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
  um carácter, com `{incomplete, Converted, Rest}`. `Rest` tem a forma do OTP:
  a parte não convertida da lista mais interior encabeçada pelo elemento que
  falha (um binary como o seu sufixo não convertido, sozinho quando termina o
  nível superior), dentro da cauda restante de cada lista envolvente; os
  bytes inacabados transportados de um binary vêm primeiro e, com saída
  `latin1`, um inteiro que falha é envolvido numa lista.
- `bin_is_7bit/1` é falso para tudo o que não seja um binary de bytes abaixo
  de 128.
- `characters_to_nfc_list/1` e as funções irmãs executam o ciclo do OTP sobre
  as formas normais de `unicode_util`: os pontos de código como lista ou
  binary UTF-8, `{error, Converted, Rest}` em UTF-8 inválido e `badarg` para
  qualquer outra coisa. As funções de propriedades recebem um ponto de código
  (caso contrário `badarg`) e mantêm os atalhos do OTP: `is_whitespace/1` é
  falso abaixo de 5001 fora da sua lista ASCII e Latin-1, e os testes de
  identificadores decidem ASCII diretamente e o resto por categoria,
  Other_ID_Start, Other_ID_Continue e sintaxe de padrões.

## Módulo code

`runtime/src/builtins/code.cpp`. Não existe nenhum processo `code_server`; as
consultas sobre módulos carregados respondem pelo programa ligado: um módulo
está carregado quando o programa o tem (código compilado ou builtins do
runtime). `ensure_loaded/1` dá `{module, M}` ou `{error, nofile}`,
`ensure_modules_loaded/1` `ok` ou `{error, [{M, nofile}]}`, `is_loaded/1`
`{file, preloaded}` ou `false`, `which/1` `preloaded` ou `non_existing`,
`module_status/1` `loaded` ou `not_loaded`, `all_loaded/0` e
`module_status/0` listam todos os módulos, `is_sticky/1` é `false`. Um
argumento de módulo que não seja um átomo é `function_clause`. O caminho de
erro de `io_lib:format/2` do OTP, que chama `code:ensure_modules_loaded/1`,
lança assim o `badarg` original. Os caminhos de código e o carregamento são
stubs.

## Módulo init

`runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Um executável é um
sistema iniciado sem script de arranque. O arranque descodifica a linha de
comandos uma vez (`ProgramArguments`, `runtime/src/startup/arguments.cpp`):
os argumentos depois das opções do runtime são simultaneamente o argv da
entrada de aridade 1 e `get_plain_arguments/0`. Não há flags do emulador; a
única flag é `home`, definida no arranque tal como o `erlexec` do OTP a define
(`HOME`; no Windows `HOMEDRIVE` e `HOMEPATH`, caso contrário `USERPROFILE`),
pelo que `get_argument(home)` é `{ok, [[Home]]}`, `get_arguments/0` é
`[{home, [Home]}]` e todas as outras flags são `error`. `script_name/0` é o
caminho absoluto do executável com barras normais. Estes quatro são builtins;
os restantes são Erlang:

- respostas do `init` iniciado do OTP: `get_status/0` `{started, started}`,
  `notify_when_started/1` `started`, `ensure_loaded/1` `not_allowed`,
  `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (espera por
  `{init, started}`); `get_configfd/1` e `set_configfd/2` guardam os seus
  valores em `persistent_term` sob `{init, configfd, Id}`;
- `script_id/0` é `{"Clause", "29"}`;
- `stop/0,1` e `reboot/0` param de imediato com as regras de estado do OTP: um
  inteiro não negativo é o código de saída, uma lista de bytes o slogan de
  paragem, qualquer outro argumento `badarg`;
- recusados: `boot/1` e `restart/0,1` lançam `notsup` depois das verificações
  de argumentos do OTP (`restart/1` de uma lista que não seja `[]` nem
  `[{mode, M}]` é `badarg`), `make_permanent/2` devolve `{error, notsup}` para
  nomes válidos e `{error, badarg}` caso contrário.

## Atomics e contadores

`runtime/src/builtins/atomics.cpp`. Um array `atomics` é uma
[referência handle](runtime-heap.md#handle-references) cujo buffer contém uma
palavra de sinal e os valores de 64 bits, atualizados através de
`std::atomic_ref` com operações sequencialmente consistentes; é partilhado
por todas as cópias da referência (mensagens, termos persistentes,
`binary_to_term/1` enquanto existir) e libertado com a última.

- `new/2` recebe uma aridade de 1 a 2^27 e opções `[{signed, Bool}]` (ganha a
  última); `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`, `sub_get/3`,
  `exchange/3`, `compare_exchange/4` e `info/1` são builtins com o `badarg` do
  OTP para uma referência, índice ou valor inválidos. Os valores guardados têm
  de caber no array (int64 ou uint64); os incrementos podem ser qualquer
  inteiro de -2^63 a 2^64 - 1 e dão a volta. `info/1` comunica a `memory` do
  OTP de 40 + 8 bytes por valor.
- `counters` é Erlang (`library/erts/counters.erl`): `{atomics, Ref}` e
  `{write_concurrency, Ref}` envolvem ambos um array atomics com sinal, pelo
  que os contadores write-concurrency são exatos em cada leitura. `info/1`
  destes últimos comunica o tamanho e a memória do array.

## Erts internal

`runtime/src/builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`.
As funções que o `stdlib` e o `kernel` do OTP chamam:

- os builtins `cmp_term/2` (ordem exata dos termos: um inteiro antes de um
  float igual) e `map_next/3`, o protocolo de `maps:iterator/1,2` e
  `maps:next/1`: um caminho inteiro percorre o map por ordem das chaves e
  continua sobre as chaves restantes, um caminho lista de chaves toma as suas
  chaves por ordem; um acumulador lista recebe todas as associações a partir
  do caminho;
- em Erlang, `list_to_integer/2` e `binary_to_integer/2` (os auxiliares de
  `string:to_integer/1` e das BIFs de conversão, `big` para lá de um inteiro
  pequeno do tamanho da palavra), `map_to_tuple_keys/1` (as chaves ordenadas
  de qualquer map), `term_type/1`, as funções `counters_*` write-concurrency,
  `dynamic_node_name/0,1` sobre `persistent_term`;
- recusados: `get_creation/0` é `undefined` (sem distribuição) e
  `map_hashmap_children/1` lança `badarg` (nenhum map tem nós hashmap);
- declinados: os grupos de distribuição, de `.beam` e internos do emulador.

`erts_code_purger:purge/1` responde `{false, false}` e `soft_purge/1`
`true`, já que o código ligado não tem código antigo; o processo purger e
`finish_after_on_load/2` são declinados.

## Unicode util

`library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`. O OTP
gera o `unicode_util` durante a sua compilação (900 KB de Erlang); o Clause
mantém os dados em tabelas C++ geradas (`unicode/tables.cpp`) consultadas
pelos builtins do seu módulo privado `clause_unicode`, e `unicode_util.erl`
responde a todas as funções do OTP sobre elas com as formas de resultado do
OTP (`{error, Rest}` ou `{badarg, Rest}` em UTF-8 inválido). Os percursos de
chardata são builtins: `cp/1` (`unicode/code_points.cpp`) abre listas aninhadas
até onde o OTP as abre e mantém o resto de um binary como uma fatia dele;
`gc/1` divide os clusters de grafemas estendidos segundo o UAX #29, pela ordem
das regras do OTP; `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1`
(`unicode/normalize.cpp`) normalizam o primeiro cluster, mantendo `nfkc/1`
uma lista onde a decomposição tinha vários pontos de código, como faz
`compose_compat_0` do OTP; `uppercase/1`, `lowercase/1`, `titlecase/1` e
`casefold/1` mapeiam o primeiro ponto de código. `spec_version/0` é `{17, 0}`.

`tools/unicode/generate.py` escreve as tabelas uma vez por cada atualização do
Unicode: os mapeamentos de caixa, as categorias, as decomposições e os
predicados de propriedades a partir das respostas do OTP do anfitrião para
cada ponto de código (`tools/unicode/observe.escript`), e os dados de quebra de
grafemas, emoji, índicos e de composição a partir dos ficheiros da Unicode
Character Database que o OTP 29 fixa (Unicode 17.0). Só as tabelas geradas
são registadas no repositório, com o aviso que a Unicode License v3 exige; as
compilações não precisam nem do OTP nem dos ficheiros de dados.
`executables_unicode_tables` e `executables_unicode_clusters` comparam as
respostas, os clusters e as formas normais com os do OTP,
`executables_unicode_forms` as formas e propriedades de `unicode`.

## io_lib

`library/stdlib/io_lib.erl`, `runtime/src/builtins/io_lib/`. Os resultados são
as listas profundas de carateres do OTP, aninhadas exatamente como `io_lib` e
`io_lib_format` as constroem: o texto é primeiro construído como células de
uma arena C++ (`io_lib/deep.cpp`), depois torna-se um termo (`io_lib`) ou
carateres planos (`io:format/1,2,3`, que executa o mesmo motor).

- Escritores (`io_lib/write.cpp`): `write/1,2,5` seguem `write1/4` com limites
  de profundidade (`[...]`, `|...`, `,...`), átomos por codificação (`latin1`
  escapa carateres fora de Latin-1), maps pela ordem das chaves do Clause,
  `ordered` ou `reversed`; `write_bin/5` indica os tamanhos do OTP,
  incluindo as peculiaridades. `write_string/1,2` e as suas formas Latin-1 e
  `as_latin1`, `write_char/1` e afins, `write_atom/1`, `quote_atom/2`,
  `write_binary/3` e as formas binary escapam como `string_char/4` e
  `needs_escape/2`.
- Motor de formatação (`io_lib/format_scan.cpp`, `format_build.cpp`): `scan`
  transforma o formato em literais e maps `format_spec()` (`scan_format/2`,
  `unscan_format/1`, `build_text/1,2`); `build_small` aplana os controlos
  pequenos (`~e ~f ~g ~b ~B ~x ~X ~+ ~# ~c ~~ ~n ~i`, `~s` de um átomo)
  para o resultado; `build_limited` partilha `chars_limit` entre
  `~w ~W ~s ~p ~P` e escreve-os através de `string/6`, `term/6` e do
  preenchimento equilibrado de `chars/2`. `~e`, `~f`, `~g` arredondam os
  21 dígitos de `float_to_list/1` como `float_man/3` (`format_float.cpp`).
  Os erros internos são `badarg`, como os torna o catch de `io_lib`;
  `unscan_format/1` lança os seus próprios. `bformat/2,3` e `bfwrite/2,3`
  são o mesmo texto em UTF-8.
- Verificações e auxiliares: `char_list/1`, `deep_char_list/1`, as
  verificações de imprimibilidade (`printable_list/1` é Latin-1:
  `io:printable_range/0` é `latin1`), `chars_length/1`, `indentation/2` (com
  os deslocamentos binários do OTP após uma tabulação), `limit_term/2`,
  `nl/0`, e os estados do servidor de E/S `collect_chars/1,3,4`,
  `collect_chars_eager/4`, `collect_line/1,3,4`, `collect_line_no_eol/4`
  (`io_lib/collect.cpp`).
- Formatador de apresentação (`io_lib/pretty*.cpp`): o `io_lib_pretty` do
  OTP para `print/1,4`, `~p`/`~P` (profundidade e `chars_limit`),
  `write/2,5`, `bwrite/2` e `write_bin/5` com `chars_limit` acima de 0, e
  relatórios de falha. `print_length/7` constrói o formato intermédio numa
  arena (cada valor com o seu comprimento numa linha, pontos que indicam o que
  imprimir mais fundo); `intermediate/7` aprofunda-o dentro de `chars_limit`
  (`expand/3`, `find_upper`, `search_depth`); `cind/7` escolhe a indentação
  das etiquetas e `pp/8` quebra linhas nas formas de listas profundas do OTP.
  `bformat/2,3` dispõem `~p` como `print_bin/2`, com as suas quebras de
  linha binárias, tamanho e coluna.
- Erlang: `get_until/1,3,4` (aplica o analisador do chamador),
  `format_prompt/1,2` e `write/3`. Stub: `fread/2,3`.
- Os contentores aninhados a mais de 256 níveis lançam `system_limit`, e as
  funs de comparação de `maps_order` são `badarg`
  ([diferenças](differences.md#io)). `executables_io_lib_text` compara as
  formas de cada função com as do OTP, `executables_pretty_print` o
  formatador de apresentação.

## Módulo zlib

`runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. O runtime
liga o zlib 1.3.2, a release que o OTP 29 inclui ([zlib](compile.md#zlib)),
pelo que os bytes comprimidos são iguais aos do OTP para todos os níveis,
estratégias, tamanhos de janela e flushes. Um fluxo é uma
[referência handle](runtime-heap.md#handle-references) cujo buffer contém o
`z_stream`; o seu finalizador termina uma sessão ativa quando a última cópia
desaparece. Os builtins privados `clause_zlib` (chamadas de abertura, fecho,
controlador, inicialização, deflate, inflate, fim, reposição, parâmetros e
dicionário) executam uma operação sobre toda a sua entrada; `zlib.erl` mantém
a API do OTP, os erros de argumentos (`bad_compression_level`,
`bad_windowbits`, ...), os estados do fluxo (`not_initialized`,
`already_initialized`, `not_on_controlling_process`), `eos_behavior`, os
dicionários (`{need_dictionary, Adler}`) e as funções de buffer completo
`compress/1`, `zip/1`, `gzip/1` e as suas inversas (membros gzip
concatenados). Um cabeçalho gzip indica a plataforma, tal como o zlib do OTP
o escreve. `term_to_binary/2` com `compressed` ou `{compressed, Level}`
comprime como o OTP decide (em cinco bytes a menos do que a carga útil, caso
contrário sem compressão).

## Módulo re

`runtime/src/builtins/re/`, `library/stdlib/re.erl`: as exportações e os tipos
do OTP 29 sobre a release do PCRE2 que o OTP inclui ([PCRE2](compile.md#pcre2)).
`version/0` é a versão e a data do PCRE2 como binary
(`<<"10.47 2025-10-21">>`, como no OTP).

Um padrão compilado é o `{re_pattern, CaptureCount, Unicode, UseCRLF, Ref}`
do OTP 29, em que `Ref` é uma
[referência handle](runtime-heap.md#handle-references) que detém o
`pcre2_code`; o seu finalizador liberta o código com a última cópia, e os
processos partilham-no só para leitura. Como no OTP, o lado C é pequeno e o
resto é Erlang:

- `clause_re:compile/2` compila um binary de regex com opções de compilação
  (`{ok, Pattern}` ou `{error, {Message, Offset}}` com a mensagem do PCRE2);
  `re:inspect/2` responde a `namelist`.
- `clause_re:run/4` é a BIF `re:run` do OTP sem os seus traps: uma
  correspondência de um sujeito binary a partir de `{offset, N}`, compilando
  primeiro uma regex textual, com todas as especificações e tipos de captura,
  `match_limit` e `match_limit_recursion`, e os erros do OTP (resultados de
  `report_errors`, `badarg` para opções de compilação ou outras convenções de
  mudança de linha dadas com um padrão compilado).
- `re.erl` converte chardata Unicode em UTF-8 e as capturas de volta em
  caracteres, executa as correspondências `global` uma de cada vez (depois de
  uma correspondência vazia, tenta de novo ancorada e não vazia e depois
  avança um carácter, ou um par CR LF com mudanças de linha CRLF, como faz o
  `loopexec` do OTP), e implementa `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`,
  uma fun de substituição) e `split/2,3` (`{parts, N}`, `trim`, `group`,
  `{return, Type}`) com os resultados do OTP.

Os padrões exportados (`export`, `import/1`) não são fornecidos.
`executables_re_module` compara com o OTP a compilação, as correspondências,
as capturas, as correspondências globais e Unicode, a substituição, a divisão
e os erros de argumentos.

## Prim eval

`runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun, Timeout)` é o receive do `erl_eval`, cujas cláusulas
são uma fun: percorre a caixa de correio a partir da mensagem mais antiga com
os passos de um [receive](processes.md#receive) compilado, os builtins
privados `clause_receive` `peek/0` (`{message, M}` ou `none`), `skip/0`,
`take/0`, `restart/0` e `wait/1` (o builtin de espera do código compilado, com
o seu tempo limite e `timeout_value`). A primeira mensagem para a qual `Fun`
responde algo diferente de `nomatch` é removida e essa resposta é devolvida;
`timeout` quando `Timeout` expira. Uma exceção vinda de `Fun` deixa todas as
mensagens no lugar.
`executables_prim_eval_receive` compara com o OTP a ordem da caixa de correio,
os tempos limite, uma mensagem que chega durante a espera e as exceções.
