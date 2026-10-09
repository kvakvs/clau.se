---
source: docs/builtins.md
sourceCommit: 06042fa
sourceSha256: f29dab6160d90187001e7fd8ed997c13236a315dce8c744f9d83072bfdbdaae4
translatedAt: 2026-10-09
---
# Builtins

Plano 11, step 36 (2026-10-07): a ponte de builtins de produção. Os builtins
são funções `erlang` que o runtime implementa em C++. O runtime regista-os por
módulo, função e aridade; o código gerado chega a eles diretamente, através de
chamadas dinâmicas e como valores fun.

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
- acesso a termos (step 37 do plano): `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` e os operadores de lista `'++'/2` e
  `'--'/2` (`A ++ B`, `A -- B` são rebaixados para eles);
- conversões (step 38 do plano): `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` não foi selecionado);
- saída para a consola (step 40 do plano): `io:format/1,2` e
  `io:put_chars/1`, os primeiros builtins de outro módulo ([io](io.md));
- identidades de processos (step 42 do plano): `self/0`, `make_ref/0`,
  `pid_to_list/1` e `ref_to_list/1`
  ([pids e referências](terms.md#pids-and-references));
- processos (step 43 do plano): `spawn/1,3` e `is_process_alive/1`
  ([processos](processes.md)); ligações e sinais de saída (step 48):
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([ligações](processes.md#links)); monitores (step 49):
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([monitores](processes.md#monitors)); nomes registados (step 50):
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([nomes registados](processes.md#registered-names));
- mensagens (step 45 do plano): `'!'/2` (o operador `!`) e `send/2`
  ([mensagens](processes.md#messages)).

As entradas são apenas acrescentadas: o índice de uma entrada é o número que o
código gerado passa ao serviço da ponte. Uma chamada qualificada de um builtin
do catálogo de outro módulo (`io:format(F, A)`) também chama a ponte. As
restantes funções `erlang` mantêm os seus diagnósticos:
uma chamada direta de uma desconhecida dá `unknown module erlang`;
`fun erlang:F/A` ou `fun F/A` de uma guard BIF fora do catálogo (`node/0`) e
`fun erlang:apply/2,3` indicam a capacidade `dynamic calls` indisponível.

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

## Porções

Plano 11, step 43A (2026-10-08): os builtins cujo trabalho cresce com um
argumento lista ou binary correm em porções limitadas, como as BIFs com trap
do OTP, para que um builtin demorado não impeça os outros processos de correr
([processos](processes.md)).

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

Plano 11, step 41 (2026-10-07): os builtins que verificam os seus próprios
argumentos são funções C++ com parâmetros tipados
([typed.hpp](../runtime/src/builtins/typed.hpp)),
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
