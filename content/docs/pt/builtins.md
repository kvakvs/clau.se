---
source: docs/builtins.md
sourceCommit: a8c3f8f6
sourceSha256: c5b5b3ed022c6da6d2e2862ed0b124314e7f7a5b8cfdfcc5b3a787b4b99841fb
translatedAt: 2026-10-17
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
| `erlang:function_exported(M, F, A)`, `A -- B`, `length(L)` num corpo (builtins do catálogo sem serviço inline) | Entrada como numa função: `CLAUSE_builtin_frame_v1(context, index)` dá o frame do builtin, os argumentos vão nos registos ([porções](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (builtins diretos: nunca fazem trap, nunca esperam nem atuam sobre outro processo) | Chamados de imediato: `CLAUSE_builtin_call_v1(context, index, arguments)` devolve o resultado ([ABI](abi.md#runtime-services)) |
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
- Uma função devolve um termo, um `BuiltinResult` (`std::expected` com um
  `BuiltinFailure`) ou uma `Word` em bruto que ela própria publicou, ou lança
  `BuiltinFailure` (um erro Erlang ou uma falha de acesso a termos);
  `call_builtin` converte qualquer outra exceção C++ em `out_of_memory` ou
  `internal_error`, pelo que nenhuma atravessa a ABI do código gerado.
- A maioria das famílias é tipada. As guard BIFs e os operadores
  (`erlang/core.cpp`), os builtins de listas com trap e alguns outros são
  adaptadores `BuiltinBody` ao nível das palavras, que passam as suas palavras
  de argumento aos serviços inline que o código gerado também chama.

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
  builtin, nunca a um stub de biblioteca nem a uma função do utilizador com o
  mesmo nome.
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
  `library/erts/erlang.erl` (o módulo stub próprio do Clause) e
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

- `phash2/1,2` e `phash/2` calculam o hash da estrutura de um termo: termos
  exatamente iguais têm o mesmo hash em todas as execuções do programa
  (átomos pela grafia, maps por ordem das chaves, `1` e `1.0` distintos).
  `phash2/1` está em 0..2^27-1, `phash2/2` em 0..Range-1, `phash/2` em
  1..Range; Range está em 1..2^32, caso contrário `badarg`. Os valores são os
  do próprio Clause, não os do OTP.
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
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` e
  `keydelete/3` lançam `function_clause` para um argumento que nenhuma
  cláusula do OTP aceita, e percorrem as listas de forma tão preguiçosa como o
  OTP: `sublist([a | b], 1)` é `[a]`, `nthtail(1, [a | b])` é `b`,
  `flatten/2` não verifica a sua cauda além de `is_list`.
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

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` e `from_keys/2` são builtins com
  os erros do OTP: algo que não seja um map é `{badmap, Map}`, uma chave em
  falta em `update/3` é `{badkey, Key}`, uma lista de chaves que não seja uma
  lista própria é `badarg`. As chaves correspondem exatamente (`1` e `1.0` são
  chaves diferentes). As outras funções implementadas (`filter/2`, `map/2`,
  `fold/3`, `iterator/1,2`, `next/1`, ...) são Erlang em
  `library/stdlib/maps.erl`; os iteradores usam
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

## Termos persistentes

`runtime/src/builtins/persistent_term.cpp`, sobre a tabela do runtime
([runtime](runtime.md#persistent-terms)). `put/2` e `put_new/2` devolvem `ok`
(`put_new/2` de uma chave guardada é `ok` para um valor exatamente igual,
caso contrário `badarg`); `get/1` de uma chave não guardada é `badarg`,
`get/2` devolve o valor por omissão; `get/0` lista todos os `{Key, Value}`;
`erase/1` indica se a chave estava guardada; `info/0` é
`#{count => N, memory => Bytes}` (as palavras das cópias guardadas). As chaves
correspondem exatamente (`1` e `1.0` diferem). Cada leitura copia o valor para
o heap do chamador.

## Módulo unicode

`runtime/src/builtins/unicode/`. `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` e
`encoding_to_bom/1` são builtins; as funções de normalização, de categorias e
de identificadores de `library/stdlib/unicode.erl` são stubs.

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
OTP (`{error, Rest}` ou `{badarg, Rest}` em UTF-8 inválido). `gc/1` divide os
clusters de grafemas estendidos segundo o UAX #29, pela ordem das regras do
OTP; `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` normalizam o primeiro cluster;
`spec_version/0` é `{17, 0}`.

`tools/unicode/generate.py` escreve as tabelas uma vez por cada atualização do
Unicode: os mapeamentos de caixa, as categorias, as decomposições e os
predicados de propriedades a partir das respostas do OTP do anfitrião para
cada ponto de código (`tools/unicode/observe.escript`), e os dados de quebra de
grafemas, emoji, índicos e de composição a partir dos ficheiros da Unicode
Character Database que o OTP 29 fixa (Unicode 17.0). Só as tabelas geradas
são registadas no repositório, com o aviso que a Unicode License v3 exige; as
compilações não precisam nem do OTP nem dos ficheiros de dados.
`executables_unicode_tables` e `executables_unicode_clusters` comparam as
respostas, os clusters e as formas normais com os do OTP.

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
