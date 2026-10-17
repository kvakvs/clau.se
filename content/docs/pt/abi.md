---
source: docs/abi.md
sourceCommit: a8c3f8f6
sourceSha256: 0717f1e1336ae5419c5ef646d39a5488fd45468113ecbf7eb15897e3370b69c4
translatedAt: 2026-10-17
---
# ABI do código gerado (revisão 21)

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
  processo. Os IDs nunca são serializados nem usados para ordenação. `false`,
  `true`, `undefined`, `ok` e `error` são fixos: cargas úteis 0–4 em todos os
  runtimes.
- Tuplo vazio `0x2b` e nil `0x3b` exatamente; outros bits de carga útil são
  inválidos.
- Pids locais: quatro bits baixos `0x3`, a carga útil é o número do processo,
  admitidos apenas quando o runtime o emitiu
  ([pids e referências](terms.md#pids-and-references)).
- As palavras boxed e de lista apontam para o heap do processo proprietário e
  só são admitidas depois de o runtime provar a posse (ver [termos](terms.md)).
- Tags primárias: lista `0x1`, boxed `0x2`. Um cabeçalho guarda o seu tipo a
  partir do bit 2 e o número de palavras seguintes a partir do bit 7
  (`header_count_shift`); o tipo de um tuplo é 0. O código gerado lê elementos
  de tuplos e células cons inline apenas depois de a inferência ou um teste de
  forma dominante ter provado a célula ([provas](specialization.md#proofs)); os
  planos de correspondência testam formas de tuplos e cons inline em todos os
  níveis de otimização (uma tag boxed e depois o cabeçalho), e a igualdade
  exata compara primeiro as palavras, chamando `CLAUSE_exact_v1` apenas para
  duas palavras de lista ou boxed distintas. O runtime verifica estas
  constantes.

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
os descritores de funs numa tabela privada `<prefix>.funs`
([funs](funs.md#representation)), a área de literais só de leitura
([áreas](runtime-heap.md#areas)), as caches graváveis de átomos e de funs que o
código gerado lê inline, e a `code_convention` dos seus corpos. O registo chama
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
- As expressões de átomo que não sejam os átomos fixos leem `atom_cache` quando
  o `FrameState::runtime` do contexto é o dono da cache, caso contrário
  `CLAUSE_atom_v3`; nunca internam ([átomos](terms.md#atoms)).
- Um objeto de arranque (`clausev1_start`) lista todos os descritores num
  `StartupDescriptor` e o seu `main` nativo chama
  `CLAUSE_main_v1(argc, argv, descriptor)`, que regista todos os módulos e
  executa a entrada ([executáveis](executables.md#startup-object)).

## Canal de falhas (revisão 2)

Os erros não são codificados nos bits do termo. Após cada chamada gerada que
não seja de cauda, o chamador verifica o canal antes de usar o resultado ou de
avaliar o argumento seguinte: lê a palavra `failed` do `FrameState` do
contexto, que o runtime mantém igual a `CLAUSE_call_failed_v2(context)`. Em
caso de falha, o chamado devolve uma palavra zero inválida.

| Resultado | Transporte |
| --- | --- |
| Padrão não corresponde, rejeição pela guard | Continuação para o candidato seguinte; canal intocado |
| Cláusulas esgotadas | `error:function_clause`; `error:{case_clause, Value}` com carga útil própria para um `case`; `error:if_clause`; `error:{try_clause, Value}` para as cláusulas `of` de um try; `error:{else_clause, Value}` para as cláusulas `else` de um maybe |
| Falha de correspondência no corpo | `error:{badmatch, Value}` com carga útil própria |
| Comprehensions | `error:{bad_generator, Tail}`, `error:{bad_filter, Value}`, `error:{bad_generators, Inputs}` (`ErrorReason` 16-18); a rejeição de um gerador estrito é `{badmatch, Element}` |
| Acesso a records, argumentos inválidos, aritmética, maps | `badrecord`, `badarg`, `badarith`, `badmap`/`badkey` |
| Campo de native record em falta | `ErrorReason::badfield` (20), carga útil `{{Module, Name}, Field}` |
| Chamar um valor (`F(Args)`) | `ErrorReason::badfun` (22, carga útil o valor), `badarity` (23, carga útil `{Fun, Args}`), `undef` (24), registados por `CLAUSE_apply_v1` ([funs](funs.md)) |
| Chamadas dinâmicas (`M:F(Args)`, `apply/2,3`, `fun M:F/A` com variáveis) | `badarg` para um módulo ou função que não seja átomo, uma lista de argumentos imprópria ou uma aridade inválida; `undef` quando nenhum módulo do programa exporta a função; `badfun`/`badarity` como acima ([funs](funs.md#dynamic-calls)) |
| Construção nativa externa sem valor | `ErrorReason::novalue` (21), carga útil `{{Module, Name}, Field}` |
| Resultado inteiro acima do limite de tamanho | Resultado de serviço `ValueOutcome::system_limit` (3): uma guard rejeita, um corpo lança `error:system_limit` (`ErrorReason` 19) |
| Operando esquerdo preguiçoso inválido | `{badarg, Value}` |
| Infraestrutura (falta de memória, limites, posse, interno) | `CallError::runtime_failure` com o `Status` exato |
| `erlang:error/1,2,3`, `exit/1`, `throw/1`, `erlang:raise/3` | `raised_error`/`raised_exit`/`raised_throw`: a classe vem do ID, a carga útil própria é a razão completa |
| `erlang:halt/0,1` | `CallError::halted` com `halt_status` (e slogan) |

As razões são IDs tipados registados por `CLAUSE_raise_v2`; os três IDs
`raised_*` selecionam a classe `exit` ou `throw` (caso contrário `error`) e
transportam qualquer termo como razão. `error/2,3` lançam através de
`CLAUSE_error_v1(context, reason, args)`, que também guarda uma lista `args`
para o frame de topo da pilha. A primeira falha prevalece; as invocações
aninhadas partilham o canal. `GeneratedInvocation` é o âmbito do anfitrião:
verifica falhas pendentes antes da entrada e após o retorno, copia o resultado
ou o erro e limpa apenas na saída mais exterior (também em exceções C++).
Nenhuma exceção atravessa entradas geradas. Quem chama entradas em bruto tem de
abrir um `GeneratedInvocation`; os anfitriões normais usam
`ResolvedFunction::call`.

`catch Expr` redireciona todas as verificações de falha e lançamentos dentro de
`Expr` para um bloco de tratamento que chama `CLAUSE_catch_v1(context, slot)`.
Para uma exceção Erlang pendente, escreve o valor do catch no slot de raiz e
limpa o canal: o termo lançado, `{'EXIT', Reason}` para um exit, ou
`{'EXIT', {Reason, []}}` para um error (as razões tipadas tornam-se os seus
termos OTP, como `{badmatch, V}`; a pilha é descrita [abaixo](#stack-traces)).
Os halts e as falhas de infraestrutura permanecem pendentes, e a verificação do
próprio bloco de tratamento continua para o bloco de tratamento envolvente ou
para a saída da função. As vinculações feitas dentro de `Expr` são inseguras
depois disso, pelo que a junção apenas funde o valor.

`try Body of ... catch ... end` protege apenas `Body` da mesma forma. O seu
bloco de tratamento chama
`CLAUSE_exception_v2(context, class_slot, reason_slot, stack_slot)`, que
escreve o átomo da classe (`error`, `exit` ou `throw`), a razão e o termo do
rastreio de pilha em slots de raiz e limpa o canal (os halts e as falhas de
infraestrutura permanecem pendentes, tal como no `catch`). As cláusulas catch
fazem então corresponder `Class:Reason` com padrões e guards comuns; uma classe
omitida corresponde a `throw`, e uma variável de pilha nomeada vincula o termo
da pilha. Quando nenhuma corresponde,
`CLAUSE_reraise_v2(context, class, reason, stack)` regista novamente a exceção
com uma razão `raised_*` e a mesma pilha, que é relatada e capturada
exatamente como a original. As cláusulas `of` selecionam pelo valor do corpo e
lançam `{try_clause, Value}` (`ErrorReason::try_clause = 14`); as exceções
dentro das cláusulas `of` e dos blocos de tratamento vão para o bloco de
tratamento envolvente.

`maybe` não precisa de nenhum serviço: cada `?=` é uma correspondência comum
cuja aresta de não correspondência sai do corpo para a saída do maybe com o
valor não correspondido (já enraizado). Sem `else`, esse valor é o resultado;
caso contrário, as cláusulas `else` selecionam por ele como as cláusulas `case`
e lançam `{else_clause, Value}` (`ErrorReason::else_clause = 15`) quando
nenhuma corresponde.

As comprehensions usam os serviços existentes com algumas operações: os
elementos acumulados são invertidos pela construção `reverse`
(`ContainerConstruction::reverse = 2`, valores `{List, Tail}`), que constrói o
resultado numa única reserva de heap; os geradores de lista testam e leem
células cons inline; uma binary comprehension junta as suas partes com
`BitOperation::concat` (`{List}`) e uma map comprehension constrói o seu map
com `MapOperation::from_list` (`{Pairs}`, as chaves posteriores prevalecem). Os
geradores de map obtêm `MapOperation::entries` (11, `{Map}`) uma vez: uma
célula com as chaves e os valores nas palavras `1 + 2i` e `2 + 2i` na ordem
canónica das chaves (o próprio map clássico, ou uma cópia em forma de tuplo das
entradas de um map fora do heap que só o código gerado lê) e leem cada entrada
inline; `key_at`/`value_at` (`{Map, Position}`) mantêm-se para outros
chamadores. A entrada restante de um zip é mostrada com
`MapOperation::iterator`, a cadeia `{K, V, Next}` do OTP que termina em `none`.
`MapOperation::update_owned` (10) recebe os operandos de `update` para uma
atualização de map cuja origem o compilador provou não ser lida depois: um map
de origem fora do heap é atualizado no local e o seu stub fica consumido
(vazio). Os geradores de bitstring usam a extração de padrões comum mais um
segmento final `binary`/`all` para o resto.

`try ... after A end` acrescenta uma segunda proteção em torno do corpo e de
todas as cláusulas `of` e catch. No caminho normal, `A` é executado depois de o
valor selecionado ser enraizado, e o seu valor é descartado. O bloco de
tratamento after obtém a exceção com `CLAUSE_exception_v2`, executa uma segunda
cópia de `A` e volta a lançar com `CLAUSE_reraise_v2`; uma exceção ou falha
dentro de `A` sai, em vez disso, pelo bloco de tratamento envolvente,
substituindo a original. Os halts e as falhas de infraestrutura saltam `A`. Os
slots de raiz pertencem ao frame da função, pelo que todos os caminhos os
libertam na saída da função.

### Rastreios de pilha

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
- Uma chamada de cauda liberta o frame do chamador, pelo que, tal como no OTP,
  um chamador que terminou numa chamada de cauda não aparece no rastreio. O OTP
  também transforma em chamadas de cauda as chamadas a funções que nunca
  retornam; o Clause não.
- As entradas de pilha `{Fun, Args}` de `erlang:raise/3` são rejeitadas.

## Frames e transferências

As funções geradas são executadas em frames explícitos
([modelo de execução](execution-model.md); serviços em
[frames.hpp](../abi/include/clause/abi/frames.hpp)). Cada função tem um
descritor `<symbol>.frame` (`FrameDescriptor`: descritor do módulo, slots dos
átomos do módulo e da função, aridade, código do corpo, número de slots, número
de slots de termos; externo para funções exportadas) e um `<symbol>.body`
interno do tipo `abi::v1::Code`, `void(void *context, TermWord x0, ...)` com
`abi::v1::register_arguments` parâmetros de termo; com um runtime compilado com
Clang em x86-64 e AArch64, os corpos e todas as transferências usam a convenção
`preserve_none`, tal como `abi::v1::Code` nesses alvos: os corpos nunca
regressam normalmente, pelo que não guardam registos preservados pelo chamado;
o registo rejeita um módulo cuja `code_convention` (0 nenhuma, 1 C, 2
`preserve_none`) não seja a do runtime. Um `<symbol>` exportado mantém a
assinatura `TermWord(Context *, const TermWord *)` como entrada do anfitrião
que chama `CLAUSE_invoke_v1(context, frame, arguments)`.

- Cada contexto começa com um `abi::v1::FrameState`: bloco de pilha, topo,
  limite de push, offset do frame atual, reduções restantes, ponteiro dos
  registos, número de registos vivos, bits lentos, a palavra `failed`, as
  palavras livres do bloco de heap `[heap_top, heap_limit)`, a identidade do
  runtime que reclama as caches de átomos, a palavra do pid do contexto
  (`self`), uma palavra do alvo cada. Um corpo lê o cabeçalho do seu frame
  (`stack + frame`) e os registos a partir dele à entrada e faz um switch sobre
  a palavra de retoma do cabeçalho.
- Padrões binários (alvos de 64 bits): o teste de início, o teste de fim e os
  segmentos inteiros de largura constante em bytes inteiros até 56 bits numa
  posição alinhada ao byte leem a célula inline
  (`abi::v1::heap_binary_*_word`, `refc_*_word`: o `data_` de uma vista fora do
  heap é o primeiro byte do seu buffer); os outros segmentos e as posições não
  alinhadas chamam `CLAUSE_bits_v1`. Um sujeito `sub_binary` (`sub_*_word`) é
  lido através do seu original. Um `Rest/binary` ou `Rest/bits` final de
  unidade 1 é alocado inline por incremento como uma célula `sub_binary` de 4
  palavras do original.
- Ciclos binários: quando todas as cláusulas de uma função fazem corresponder
  um parâmetro como binary (ou o ignoram), nunca guardam o binary inteiro e só
  leem os restos que vinculam como esse parâmetro de chamadas de cauda a si
  próprias, a função recebe uma variante privada `<symbol>.loop`. O passo da
  própria função cria a célula do resto como acima e entra na variante com ela
  (um resto criado pelo serviço, que pode ser partilhado, volta antes a entrar
  na função). A variante não cria nenhuma célula de resto: cada chamada de
  cauda a si própria guarda o novo offset e o novo comprimento em bits na
  célula do parâmetro, que só este ciclo referencia, e passa a mesma célula
  adiante, pelo que um ciclo sobre um binary aloca uma única vez. A variante lê
  a vista da célula uma vez por passo, antes das suas cláusulas, e salta o
  teste de bitstring do parâmetro. A variante tem o nome e a aridade da função
  nos rastreios de pilha.
- Uma construção binária cujos bytes são todos conhecidos em tempo de
  compilação (constantes inteiras pequenas e literais de string com larguras
  constantes em bytes inteiros, no máximo 64 bytes) é uma célula binária inline
  da área de literais do módulo, como os outros literais compostos.
- `Left ++ Right` em que `Left` está escrito como uma lista própria (um literal
  de string, ou uma lista sem cauda) é construído como `[E1, ..., En | Right]`,
  como faz o compilador do OTP, sem chamar `erlang:'++'/2`. Qualquer outro
  `Left ++ Right` percorre `Left` inline (`codegen/lowering_append`): uma lista
  própria de no máximo 32 células é copiada para `Right` nas palavras livres do
  bloco de heap; um `Left` mais longo ou impróprio, ou um bloco sem espaço,
  entra no builtin, que mantém todos os erros e porções.
- Um builtin puro com argumentos literais é avaliado em tempo de compilação,
  como faz o `sys_core_fold` do OTP: `atom_to_list(Atom)` de um literal de
  átomo é a string literal desse nome, sem qualquer chamada.
- `erlang:make_tuple(N, V)` com um `N` pequeno em 1..64 aloca o tuplo por
  incremento e preenche-o com `llvm.experimental.memset.pattern` quando o heap
  tem espaço; caso contrário, corre o builtin.
- As construções binárias (alvos de 64 bits) cujos segmentos são todos inteiros
  de larguras constantes em bytes inteiros até 64 bits, no máximo 64 bytes no
  total, são alocadas inline por incremento como células `heap_binary`
  (cabeçalho, comprimento em bits, palavras de dados zeradas e depois os bytes
  de cada segmento) quando todos os valores são inteiros pequenos e o heap tem
  espaço; caso contrário, `CLAUSE_bits_v1` constrói-as. Os mesmos segmentos
  depois de um acumulador binário completo (`<<Acc/binary, ...>>`) são escritos
  no buffer do acumulador quando este é um `refc_binary` (ou um `sub_binary` de
  um) que termina, alinhado ao byte, na `refc_append_end_word` da célula com
  espaço abaixo de `refc_append_limit_word`: os bytes vão para além do fim, o
  fim avança e o resultado é um `sub_binary` de 4 palavras dessa célula.
- `+ - * /` (alvos de 64 bits) com um operando float, e `/` de quaisquer dois
  números, leem cada operando como double (um inteiro pequeno convertido, o
  valor de uma célula float lido através de um select da sua célula ou de uma
  célula substituta constante, para que nenhuma leitura dependa de um salto),
  calculam em registos e alocam por incremento a célula float de 2 palavras
  quando o resultado é finito, o divisor não é zero e o heap tem espaço; caso
  contrário, `CLAUSE_immediate_v1` lança `badarith` ou promove.
- As expressões de map sem base cujas chaves são literais de átomo ou de
  inteiro pequeno (no máximo 32 distintas) são escritas inline como células de
  map clássico, com as chaves ordenadas em tempo de compilação pela ordem exata
  dos termos e mantendo o último valor de uma chave repetida; caso contrário,
  `CLAUSE_map_v1` constrói-as.
- Os tuplos e as listas de no máximo 64 palavras são alocados inline por
  incremento em `[heap_top, heap_limit)` (cabeçalho ou células cons escritos no
  local, `heap_top` avançado), caso contrário construídos por
  `CLAUSE_construct_v1`; o resultado é enraizado como uma saída de serviço. O
  runtime contabiliza as palavras inline antes de cada operação de heap e repõe
  ambos os campos depois dela; são nulos enquanto não existe bloco de heap ou
  se aplica um orçamento de heap por processo, pelo que todas as alocações
  chegam então ao serviço ([heap](runtime-heap.md#areas)). `CLAUSE_frame_v1` e
  `CLAUSE_registers_v1` mantêm-se para outros consumidores.
- Um corpo só sai por chamadas `musttail`. As chamadas, as chamadas de cauda e
  os retornos correm inline quando podem, caso contrário o código vem de
  `CLAUSE_enter_v1` (chamada), `CLAUSE_tail_v1` (chamada de cauda) ou
  `CLAUSE_return_v1` (retorno), que mantêm o estado atualizado
  ([modelo de execução](execution-model.md#implementation)).
- Cada transferência passa os primeiros `abi::v1::register_arguments` (6)
  registos X como parâmetros C a seguir ao contexto: os argumentos iniciais de
  uma chamada, o resultado de um retorno (como `x0` do corpo do chamador), zero
  para os não usados. Os argumentos adicionais seguem no array de registos. Em
  torno de cada serviço de transferência, o código gerado guarda os parâmetros
  no array (os serviços e o coletor leem-nos aí) e volta a carregá-los depois.
  O runtime chama o código da mesma forma (`ProcessStack::run_code`), e o corpo
  do seu frame de base guarda `x0` no primeiro registo para o anfitrião.
- Uma entrada zera o frame e copia para os seus slots apenas os argumentos para
  além dos parâmetros; um corpo só mantém um argumento de parâmetro no seu slot
  quando `lower_frames` o despeja através de uma chamada ou de um safepoint. Os
  valores avaliados não são guardados de imediato: o rebaixamento (lowering)
  marca os termos calculados (metadados `clause.term`) e `lower_frames` só dá
  um slot de termo a um valor que atravessa uma chamada ou um safepoint; os
  arrays de argumentos dos serviços continuam a passar por slots de raiz. Os
  candidatos falhados limpam os seus slots. Os valores de que um corpo ainda
  precisa depois de uma chamada ou de um safepoint no início de um ciclo são
  despejados (spilled): termos para slots de termos (contados nas `roots` do
  descritor), outras palavras para slots em bruto a seguir a esses; os slots em
  bruto não são raízes.
- Um resultado passa como `x0`; as cargas úteis de erro são palavras de raiz do
  canal (`fvalue` da BEAM). Uma falha regressa ao chamador como um resultado e
  todos os chamadores verificam o canal após a chamada; a palavra do bloco de
  tratamento no cabeçalho permanece 0.
- A pilha não tem limite por omissão; um push que o anfitrião não consegue
  alocar regista `out_of_memory`, e um que ultrapasse um
  `StackOptions::limit_words` opcional por processo regista `resource_limit`
  (falhas de infraestrutura).
- Uma chamada de um valor de função passa os seus argumentos, e os valores
  capturados pela fun a seguir a eles, nos registos; `CLAUSE_apply_v1` devolve
  o `FrameDescriptor` em que a transferência entra
  ([funs](funs.md#representation)).
- Safepoints: `CLAUSE_enter_v1`/`CLAUSE_tail_v1` fazem a recolha antes de
  empilhar o frame do chamado (os seus argumentos são raízes nos registos); o
  heap define o bit `slow_collect` sempre que quer uma recolha, pelo que as
  entradas inline nunca saltam nenhuma. E `CLAUSE_safepoint_v1(context)` no
  início de cada ciclo de comprehension faz a recolha no local; o início do
  ciclo só o chama enquanto `FrameState::slow` tem `slow_collect`, gasta depois
  uma redução e, sem nenhuma restante, entra em `erlang:self/0` (a entrada
  suspende o processo), para que os ciclos longos sem chamadas partilhem o
  escalonador. Todos os outros serviços são uma secção crítica que nunca move o
  heap
  ([recolha no código gerado](runtime-heap.md#collection-in-generated-code)).

## Serviços do runtime

O código gerado chama serviços C++ verificados: `CLAUSE_exact_v1` (igualdade
exata), `CLAUSE_immediate_v1` (predicados/consultas sobre imediatos),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1` (para outros consumidores; o código
gerado testa e lê células de tuplos e cons inline), `CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`, `CLAUSE_record_v1`
(make/get/update/match/test de native records sob um `RecordCheck`; resultados
`bad_record`, `bad_field`, `no_match`), `CLAUSE_make_fun_v1` (constrói uma fun
a partir de um `FunDescriptor`). Cada um devolve sucesso, erro semântico
(`badarg`/`badarith`/...) ou falha de infraestrutura e só escreve a saída em
caso de sucesso. `CLAUSE_display_v1`
([output.hpp](../abi/include/clause/abi/output.hpp)) imprime uma linha de
`erlang:display/1` e produz `true`; não tem erro semântico. `CLAUSE_halt_v1`
nunca tem sucesso: regista um pedido de halt (`CallError::halted` com o código
de saída) ou `badarg`, pelo que o chamador desenrola. As grafias para o ligador
seguem o mangling C++ Itanium ou Microsoft do alvo.

Formas inline (`codegen/lowering_inline.cpp`): os testes de tipo (`is_atom`,
`is_integer`, `is_number`, `is_boolean`, `is_tuple`, `is_list`,
`is_bitstring`, `is_float`, `is_map`, `is_pid`, `is_port`, `is_reference`,
`is_function/1`, `is_record/1` nativo, `is_binary/1` pela palavra do
comprimento em bits) leem as tags e, depois de um teste de tag boxed, o tipo do
cabeçalho (`abi::v1::HeaderKind`); nunca chamam um serviço. As comparações de
dois imediatos (`==`, `/=`) ou de dois inteiros pequenos (`<`, `=<`, `>`,
`>=`), `element/2`, `tuple_size/1`, `hd/1`, `tl/1`, os operadores booleanos,
`band`, `bor`, `bxor`, `bsr`, `bsl` (enquanto o resultado se mantiver pequeno)
e `div`/`rem` pequenos correm inline; `self/0` lê `FrameState::self`. Correm
inline quando os seus operandos o permitem e chamam `CLAUSE_immediate_v1` caso
contrário, que mantém todos os casos de erro e de bignum. `setelement/3` de um
índice pequeno dentro de um tuplo boxed copia o tuplo para as palavras livres
do bloco de heap e substitui o slot inline; caso contrário, ou sem espaço,
entra no builtin de ponte.

`CLAUSE_builtin_frame_v1(context, builtin)`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) devolve o
`FrameDescriptor` do builtin de produção com o índice `builtin` em
`abi::v1::bridge_builtins` (apenas acrescentado); o código gerado entra nele
como numa função, com os argumentos nos registos, e os erros e as falhas vão
para o canal verificado ([builtins](builtins.md)). Um `FrameDescriptor` com
corpo nulo é um builtin: entrar nele executa o builtin sobre os registos e
regressa ao chamador, ou suspende o processo na continuação do builtin quando
este fez trap ([porções](builtins.md#portions)).

Um builtin direto (`BuiltinName::direct`: conversões puras como
`integer_to_list/1`, `atom_to_list/1`, `list_to_tuple/1`, `setelement/3`,
`phash2/1`) nunca faz trap, nunca espera nem atua sobre outro processo. O
código gerado chama-o com `CLAUSE_builtin_call_v1(context, builtin, arguments)`,
que executa o seu corpo de imediato e devolve o resultado, sem transferência de
frame, sem ponto de retoma e sem safepoint de entrada; gasta uma redução, e uma
falha vai para o canal verificado tal como a de um serviço.

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
| 9 | Cada contexto começa com `abi::v1::FrameState`; transferências inline |
| 10 | Registos X iniciais passados como parâmetros do código |
| 11 | Palavras fixas de `false` e `true` |
| 12 | Campos de heap inline `heap_top`/`heap_limit` em `FrameState` |
| 13 | `undefined`, `ok`, `error` fixos; `ModuleDescriptor::atom_cache` e `FrameState::runtime` |
| 14 | Áreas de literais dos módulos: `ModuleDescriptor::literals`, `literal_words` |
| 15 | `FrameState::self`, a palavra do pid do contexto |
| 16 | `Code` usa `preserve_none` em x86-64 e AArch64 com um runtime compilado com Clang; `ModuleDescriptor::code_convention` |
| 17 | Seis registos X como parâmetros de `Code` |
| 18 | Células `sub_binary` (`HeaderKind::sub_binary`, `sub_*_word`) e extração inline de `Rest` |
| 19 | Palavras de fim e de limite de acrescento nas células `refc_binary` (`refc_append_*_word`, 8 palavras de carga útil) e acrescentos inline |
| 20 | `MapOperation::entries` e geradores de map inline |
| 21 | `ModuleDescriptor::fun_cache` e closures inline |
| 22 | Builtins diretos: `BuiltinName::direct`, `CLAUSE_builtin_call_v1` |
