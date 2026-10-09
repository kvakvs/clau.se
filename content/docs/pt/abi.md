---
source: docs/abi.md
sourceCommit: 06042fa
sourceSha256: f8f56cfac2333ccc8481b962036e323d397415d2505365d432a3e26b811a54b6
translatedAt: 2026-10-09
---
# ABI do código gerado (revisão 4)

Contrato privado entre a saída do compilador e o runtime. É C++23 interno ao
projeto, não compatível com a BEAM e não é uma FFI de uso geral. Os objetos e o
runtime têm de provir da mesma compilação; revisões de descritores mais antigas
são rejeitadas antes da utilização.

Cabeçalhos: [v1.hpp](../abi/include/clause/abi/v1.hpp) (tipos de termo,
contexto e função), [term.hpp](../abi/include/clause/abi/term.hpp) (codec de
inteiros imediatos), [status.hpp](../abi/include/clause/abi/status.hpp),
[builtins.hpp](../abi/include/clause/abi/builtins.hpp),
[startup.hpp](../abi/include/clause/abi/startup.hpp) (arranque do programa).

## Termos

Um termo é uma palavra sem sinal com a largura de um ponteiro do alvo (32 ou 64
bits). As disposições derivam do alvo LLVM configurado, pelo que o código para
outro alvo usa as larguras desse alvo.

- Inteiros pequenos: quatro bits baixos `0xf`; carga útil com sinal de
  `word_bits - 4` bits, intervalo `[-2^(word_bits-5), 2^(word_bits-5)-1]`.
  Valores maiores são bignums no heap.
- Átomos: seis bits baixos `0x0b`, carga útil não reciclada, global ao
  processo. Os IDs nunca são serializados nem usados para ordenação.
- Tuplo vazio `0x2b` e nil `0x3b` exatamente; outros bits de carga útil são
  inválidos.
- Pids locais: quatro bits baixos `0x3`, a carga útil é o número do processo,
  admitidos apenas quando o runtime o emitiu
  ([pids e referências](terms.md#pids-and-references)).
- As palavras boxed e de lista apontam para o heap do processo proprietário e
  só são admitidas depois de o runtime provar a posse (ver [termos](terms.md)).

## Funções e símbolos

Assinatura de entrada (convenção de chamada C nativa, sem exigir ligação C):

```cpp
TermWord function(ProcessContext *context, const TermWord *arguments);
```

Os argumentos são um array emprestado, alinhado à palavra, pela ordem do
código-fonte (nulo com aridade 0). O contexto está vivo e é passado inalterado
através das chamadas. Uma palavra devolvida só é utilizável depois de verificar
o canal de falhas.

Símbolos: `clausev1_<hex module>_<hex function>_<arity>`, hexadecimal em
minúsculas dos bytes UTF-8, aridade decimal canónica; reversíveis e
independentes do anfitrião. As entradas exportadas são externas, as restantes
internas.

## Registo de módulos

Cada módulo emite `clausev1_<hex module>__0.descriptor` e `.register`. O
descritor contém a versão da ABI, a largura do termo, a tabela de exportações
(nome, aridade, entrada do anfitrião e o `FrameDescriptor` em que entram as
chamadas dinâmicas), as grafias dos átomos (pares ponteiro/tamanho UTF-8), os
descritores de native records (slots de átomos do módulo, do nome e dos campos,
flag de exportação; [native records](native-records.md#representation)) numa
tabela externa `<prefix>.records` que os outros módulos de um lote referenciam,
e os descritores de funs numa tabela privada `<prefix>.funs` ([funs](funs.md#representation)). O registo chama
`CLAUSE_register_module_v4(Runtime*)`, que valida a versão/largura e todas as
exportações, interna os átomos, constrói um registo congelado e publica-o
juntamente com a imagem do código numa única transação. Módulos duplicados
nunca substituem código; qualquer falha não publica nada (os átomos já
internados permanecem na tabela limitada).

- Chame `.register` explicitamente antes de resolver exportações. Não há
  construtores globais; os utilizadores de arquivos estáticos têm de
  referenciar as entradas de registo.
- `llvm.used` mantém os descritores e as entradas; ligar sem o runtime falha
  devido ao símbolo de serviço em falta.
- O endereço do descritor é a chave de vinculação dos átomos; a sua imagem tem
  de permanecer mapeada durante a vida do módulo. Cada runtime tem as suas
  próprias vinculações para a mesma imagem.
- As expressões de átomo leem slots através de `CLAUSE_atom_v3`; nunca
  internam.
- Um objeto de arranque (`clausev1_start`) lista todos os descritores num
  `StartupDescriptor` e o seu `main` nativo chama
  `CLAUSE_main_v1(argc, argv, descriptor)`, que regista todos os módulos
  e executa a entrada ([executáveis](executables.md#startup-object)).

## Canal de falhas (revisão 2)

Os erros não são codificados nos bits do termo. Após cada chamada gerada que
não seja de cauda, o chamador verifica `CLAUSE_call_failed_v2(context)` antes de
usar o resultado ou de avaliar o argumento seguinte. Em caso de falha, o chamado
devolve uma palavra zero inválida.

| Resultado | Transporte |
| --- | --- |
| Padrão não corresponde, rejeição pelo guard | Continuação para o candidato seguinte; canal intocado |
| Cláusulas esgotadas | `error:function_clause`; `error:{case_clause, Value}` com carga útil própria para um `case`; `error:if_clause`; `error:{try_clause, Value}` para as cláusulas `of` de um try; `error:{else_clause, Value}` para as cláusulas `else` de um maybe |
| Falha de correspondência no corpo | `error:{badmatch, Value}` com carga útil própria |
| Comprehensions | `error:{bad_generator, Tail}`, `error:{bad_filter, Value}`, `error:{bad_generators, Inputs}` (`ErrorReason` 16-18); a rejeição de um gerador estrito é `{badmatch, Element}` |
| Acesso a records, argumentos inválidos, aritmética, maps | `badrecord`, `badarg`, `badarith`, `badmap`/`badkey` |
| Campo de native record em falta | `ErrorReason::badfield` (20), carga útil `{{Module, Name}, Field}` |
| Chamar um valor (`F(Args)`) | `ErrorReason::badfun` (22, carga útil o valor), `badarity` (23, carga útil `{Fun, Args}`), `undef` (24), registados por `CLAUSE_apply_v1` ([funs](funs.md)) |
| Chamadas dinâmicas (`M:F(Args)`, `apply/2,3`, `fun M:F/A` com variáveis) | `badarg` para um módulo ou função que não seja átomo, uma lista de argumentos imprópria ou uma aridade inválida; `undef` quando nenhum módulo do programa exporta a função; `badfun`/`badarity` como acima ([funs](funs.md#dynamic-calls)) |
| Construção nativa externa sem valor | `ErrorReason::novalue` (21), carga útil `{{Module, Name}, Field}` |
| Resultado inteiro acima do limite de tamanho | Resultado de serviço `ValueOutcome::system_limit` (3): um guard rejeita, um corpo lança `error:system_limit` (`ErrorReason` 19) |
| Operando esquerdo preguiçoso inválido | `{badarg, Value}` |
| Infraestrutura (falta de memória, limites, posse, interno) | `CallError::runtime_failure` com o `Status` exato |
| `erlang:error/1,2,3`, `exit/1`, `throw/1`, `erlang:raise/3` | `raised_error`/`raised_exit`/`raised_throw`: a classe vem do ID, a carga útil própria é a razão completa |
| `erlang:halt/0,1` | `CallError::halted` com `halt_status` (e slogan) |

As razões são IDs tipados registados por `CLAUSE_raise_v2`; os três IDs
`raised_*` selecionam a classe `exit` ou `throw` (caso contrário `error`) e
transportam qualquer termo como razão. `error/2,3` lançam através de
`CLAUSE_error_v1(context, reason, args)`, que também guarda uma lista `args`
para o frame de topo da pilha. A primeira falha prevalece; as invocações
aninhadas partilham
o canal. `GeneratedInvocation` é o âmbito do anfitrião: verifica falhas
pendentes antes da entrada e após o retorno, copia o resultado ou o erro e
limpa apenas na saída mais exterior (também em exceções C++). Nenhuma exceção
atravessa entradas geradas. Quem chama entradas em bruto tem de abrir um
`GeneratedInvocation`; os anfitriões normais usam `ResolvedFunction::call`.

`catch Expr` redireciona todas as verificações de falha e lançamentos dentro de
`Expr` para um bloco de tratamento que chama `CLAUSE_catch_v1(context, slot)`.
Para uma exceção Erlang pendente, escreve o valor do catch no slot de raiz e
limpa o canal: o termo lançado, `{'EXIT', Reason}` para um exit, ou
`{'EXIT', {Reason, []}}` para um error (as razões tipadas tornam-se os seus
termos OTP, como `{badmatch, V}`; a pilha é descrita [abaixo](#stack-traces)).
Os halts e as falhas de infraestrutura permanecem
pendentes, e a verificação do próprio bloco de tratamento continua para o
bloco de tratamento envolvente ou para a saída da função. As vinculações feitas
dentro de `Expr` são inseguras depois disso, pelo que a junção apenas funde o
valor.

`try Body of ... catch ... end` protege apenas `Body` da mesma forma. O seu
bloco de tratamento chama
`CLAUSE_exception_v2(context, class_slot, reason_slot, stack_slot)`, que
escreve o átomo da classe (`error`, `exit` ou `throw`), a razão e o termo do
stack trace em slots de raiz e limpa o canal (os halts e as falhas de infraestrutura permanecem pendentes, tal como no
`catch`). As cláusulas catch fazem então corresponder `Class:Reason` com
padrões e guards comuns; uma classe omitida corresponde a `throw`, e uma
variável de pilha nomeada vincula o termo da pilha. Quando nenhuma corresponde,
`CLAUSE_reraise_v2(context, class, reason,
stack)` regista novamente a exceção com uma razão `raised_*` e a mesma pilha,
que é relatada e capturada exatamente como a original.
As cláusulas `of` selecionam pelo valor do corpo e lançam `{try_clause, Value}`
(`ErrorReason::try_clause = 14`); as exceções dentro das cláusulas `of` e dos
blocos de tratamento vão para o bloco de tratamento envolvente.

`maybe` não precisa de nenhum serviço: cada `?=` é uma correspondência comum
cuja aresta de não correspondência sai do corpo para a saída do maybe com o
valor não correspondido (já enraizado). Sem `else`, esse valor é o resultado;
caso contrário, as cláusulas `else` selecionam por ele como as cláusulas
`case` e lançam `{else_clause, Value}`
(`ErrorReason::else_clause = 15`) quando nenhuma corresponde.

As comprehensions usam os serviços existentes com algumas operações: os
elementos acumulados são invertidos pela construção `reverse`
(`ContainerConstruction::reverse = 2`, valores `{List, Tail}`); uma binary
comprehension junta as suas partes com `BitOperation::concat` (`{List}`) e uma
map comprehension constrói o seu map com `MapOperation::from_list` (`{Pairs}`,
as chaves posteriores prevalecem). Os geradores de map leem
`MapOperation::key_at`/`value_at` (`{Map, Position}` na ordem canónica das
chaves) e mostram a entrada restante de um zip com `MapOperation::iterator`, a
cadeia `{K, V, Next}` do OTP que termina em `none`. Os geradores de bitstring
usam a extração de padrões comum mais um segmento final `binary`/`all` para o
resto.

`try ... after A end` acrescenta uma segunda proteção em torno do corpo e de
todas as cláusulas `of` e catch. No caminho normal, `A` é executado depois de o
valor selecionado ser enraizado, e o seu valor é descartado. O bloco de
tratamento after obtém a exceção com `CLAUSE_exception_v2`, executa uma segunda
cópia de `A` e volta a lançar com `CLAUSE_reraise_v2`; uma exceção ou falha
dentro de `A` sai, em vez disso, pelo bloco de tratamento envolvente,
substituindo a original. Os halts e as falhas de infraestrutura saltam `A`. Os
slots de raiz pertencem ao frame da função, pelo que todos os caminhos os
libertam na saída da função.

### Stack traces

Cada frame de raiz nomeia a sua função gerada com um
`abi::v1::FrameDescriptor` privado (descritor do módulo, slots dos átomos do
nome do módulo e da função, aridade). Quando uma exceção Erlang é registada, o
canal copia os 8 frames nomeados mais interiores (o `backtrace_depth`
predefinido da BEAM); o termo `[{Module, Function, Arity, []}, ...]` só é
construído quando um bloco de tratamento, um `catch` ou um relatório o pede. O
frame de topo mostra a lista de argumentos de `error/2,3` em vez da aridade
quando esse argumento é uma lista.

`erlang:raise(Class, Reason, Stack)` (`CLAUSE_reraise_v2`) aceita as pilhas que
a BEAM aceita: uma lista própria de `{M, F, A}` (completada com uma localização
`[]`) ou `{M, F, A, Location}` com `M`, `F` átomos e uma lista `Location`,
cortada a 8 entradas; a pilha é então mantida tal como foi dada e os frames
deixam de ser capturados. Uma classe ou pilha inválida não regista nada e a
chamada avalia para `badarg`, como no OTP. `erlang:get_stacktrace/0` é
rejeitado com o texto de lint "removed" do OTP 29.

Diferenças em relação ao OTP, todas visíveis apenas no termo da pilha:

- As localizações são sempre `[]` (o OTP acrescenta `{file, F}`, `{line, L}`),
  e as opções de `error/3` não acrescentam `error_info`.
- Um frame de topo de `function_clause` mostra a aridade, não a lista de
  argumentos.
- Nenhum frame nomeia uma BIF ou um operador que falhou (o OTP acrescenta
  `{erlang, '+', Args, [{error_info, ...}]}`), e nada abaixo da função de
  entrada aparece.
- Uma chamada de cauda liberta o frame do chamador (step 19), pelo que, tal
  como no OTP, um chamador que terminou numa chamada de cauda não aparece no
  trace. O OTP também transforma em chamadas de cauda as chamadas a funções que
  nunca retornam; o Clause não.
- As entradas de pilha `{Fun, Args}` de `erlang:raise/3` continuam a ser
  rejeitadas.

## Frames e transferências

As funções geradas são executadas em frames explícitos
([modelo de execução](execution-model.md),
step 19; serviços em [frames.hpp](../abi/include/clause/abi/frames.hpp)).
Cada função tem um descritor `<symbol>.frame` (`FrameDescriptor`: descritor do
módulo, slots dos átomos do módulo e da função, aridade, código do corpo,
número de slots, número de slots de termos; externo para funções exportadas) e
um `<symbol>.body` interno do tipo `void(void *context)`. Um `<symbol>`
exportado mantém a assinatura `TermWord(Context *,
const TermWord *)` como entrada do anfitrião que chama
`CLAUSE_invoke_v1(context, frame, arguments)`.

- Um corpo lê o cabeçalho do seu frame (`CLAUSE_frame_v1`) e os registos
  (`CLAUSE_registers_v1`) à entrada e faz um switch sobre a palavra de retoma
  do cabeçalho. Só sai por chamadas `musttail` do código que
  `CLAUSE_enter_v1` (chamada), `CLAUSE_tail_v1` (chamada de cauda) ou
  `CLAUSE_return_v1` (retorno) devolvem.
- Os argumentos ocupam os primeiros slots do frame; cada valor avaliado é
  guardado num slot de termo antes da expressão ou chamada seguinte. Os
  candidatos falhados limpam os seus slots. Os valores de que um corpo ainda
  precisa depois de uma chamada ou de um safepoint no início de um ciclo são
  despejados (spilled): termos para slots de termos (contados nas `roots` do
  descritor), outras palavras para slots em bruto a seguir a esses; os slots em
  bruto não são raízes.
- Um resultado passa no registo 0; as cargas úteis de erro são palavras de raiz
  do canal (`fvalue` da BEAM). Uma falha regressa ao chamador como um resultado
  e todos os chamadores verificam o canal após a chamada; a palavra do bloco de
  tratamento no cabeçalho permanece 0.
- A pilha não tem limite por predefinição; um push que o anfitrião não consegue
  alocar regista `out_of_memory`, e um que ultrapasse um
  `StackOptions::limit_words` opcional por processo regista `resource_limit`
  (falhas de infraestrutura).
- Uma chamada de um valor de função passa os seus argumentos, e os valores
  capturados pela fun a seguir a eles, nos registos; `CLAUSE_apply_v1` devolve
  o `FrameDescriptor` em que a transferência entra
  ([funs](funs.md#representation)).
- Safepoints: `CLAUSE_enter_v1`/`CLAUSE_tail_v1` fazem a recolha antes de
  empilhar o frame do chamado (os seus argumentos são raízes nos registos), e
  `CLAUSE_safepoint_v1(context)` no início de cada ciclo de comprehension
  faz a recolha no local, quando o heap o pede. Todos os outros serviços são
  uma secção crítica que nunca move o heap
  ([recolha no código gerado](runtime-heap.md#collection-in-generated-code)).

## Serviços do runtime

O código gerado chama serviços C++ verificados: `CLAUSE_exact_v1` (igualdade
exata), `CLAUSE_immediate_v1` (predicados/consultas sobre imediatos),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1`, `CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`,
`CLAUSE_record_v1` (make/get/update/match/test de native records sob um
`RecordCheck`; resultados `bad_record`, `bad_field`, `no_match`),
`CLAUSE_make_fun_v1` (constrói uma fun a partir de um `FunDescriptor`). Cada um
devolve sucesso, erro semântico (`badarg`/`badarith`/...) ou falha de
infraestrutura e só escreve a saída em caso de sucesso. `CLAUSE_display_v1` ([output.hpp](../abi/include/clause/abi/output.hpp))
imprime uma linha de `erlang:display/1` e produz `true`; não tem erro
semântico. `CLAUSE_halt_v1` nunca tem sucesso: regista um pedido de halt
(`CallError::halted` com o estado de saída) ou `badarg`, pelo que o chamador
desenrola. As grafias para o linker seguem o mangling C++ Itanium ou Microsoft
do alvo.

`CLAUSE_builtin_frame_v1(context, builtin)` ([builtins.hpp](../abi/include/clause/abi/builtins.hpp))
devolve o `FrameDescriptor` do builtin de produção com o índice `builtin` em
`abi::v1::bridge_builtins` (apenas acrescentado); o código gerado entra nele
como numa função, com os argumentos nos registos, e os erros e as falhas vão
para o canal verificado ([builtins](builtins.md)). Um `FrameDescriptor` com
corpo nulo é um builtin: entrar nele executa o builtin sobre os registos e
regressa ao chamador, ou suspende o processo na continuação do builtin quando
este fez trap ([porções](builtins.md#portions)).

`abi::v1::dispatch_builtin` chama builtins registados pelo anfitrião através
dos bytes do módulo/função, do array de argumentos e da aridade, devolvendo um
`Status`; a saída só é escrita em caso de sucesso.

| Status | Valor | Significado |
| --- | ---: | --- |
| `ok` | 0 | Sucesso |
| `not_implemented` | 1 | Funcionalidade adiada conhecida, relatada uma vez |
| `invalid_argument` | 2 | Entrada inválida |
| `diagnostic_failure` | 3 | A entrega do relatório falhou |
| `out_of_memory` | 4 | A alocação falhou, estado revertido |
| `busy` | 5 | Contextos vivos ou despacho em execução |
| `wrong_owner` | 6 | O objeto pertence a outro runtime/contexto |
| `resource_limit` | 7 | Limite ou orçamento esgotado |
| `stopped` | 8 | O proprietário foi encerrado |
| `abi_mismatch` | 9 | A versão ou a largura do termo difere |
| `internal_error` | 10 | Falha inesperada contida |
| `unknown_builtin` | 11 | Assinatura não registada nem catalogada |
| `erlang_error` | 12 | Erro Erlang estruturado registado |
| `output_failure` | 13 | A saída padrão rejeitou uma escrita |

## Revisões

| Revisão | Alteração |
| --- | --- |
| 1 | Descritores e entradas iniciais |
| 2 | Canal de falhas verificado |
| 3 | Grafias e slots dos átomos nos descritores |
| 4 | Âmbitos de raiz gerados obrigatórios |
| 5 | Frames de processo e transferências explícitos |
| 6 | Descritores de native records nos descritores de módulo, `CLAUSE_record_v1` |
| 7 | Descritores de funs nos descritores de módulo, `CLAUSE_make_fun_v1`, `CLAUSE_apply_v1` |
| 8 | Os descritores de exportação nomeiam o seu `FrameDescriptor`; serviços de chamada dinâmica `CLAUSE_call_v1`, `CLAUSE_apply_list_v1`, `CLAUSE_call_list_v1`, `CLAUSE_make_external_fun_v1` |
