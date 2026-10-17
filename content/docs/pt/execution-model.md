---
source: docs/execution-model.md
sourceCommit: a8c3f8f6
sourceSha256: 20c13ce39d1763e6ec342e1ed9aaa741312fc2be68cb0e08dd005c77a126fc43
translatedAt: 2026-10-17
---
# Modelo de execução: frames e continuações

Como as funções Erlang geradas chamam, retornam, se suspendem e falham. O modelo
foi escolhido após a comparação de protótipos em
[alternativas comparadas](#alternatives-compared); o lado do código gerado da sua
ABI está em [frames e transferências](abi.md#frames-and-transfers).

## Decisão

Cada processo Erlang corre na sua própria **pilha plana de frames explícitos**,
e o código gerado só passa de uma função para outra através de
**transferências de cauda garantidas** (`musttail` do LLVM). Uma chamada que não
é de cauda guarda a continuação do chamador no frame do chamador e salta para a
função chamada; um retorno salta de volta para essa continuação. A pilha nativa
fica, portanto, com uma única chamada de profundidade acima do escalonador, seja
qual for a profundidade da recursão Erlang, e um processo pode parar em qualquer
transferência e retomar mais tarde em qualquer thread.

- Uma única pilha plana por processo (`ProcessStack`, `process/stack`) contém os
  cabeçalhos e os slots dos frames, cresce por deslocação e é endereçada como
  base mais deslocamento.
- Cada função é uma única função LLVM, o seu **corpo**, que começa com um
  `switch` sobre o índice de retoma do frame, pelo que mantém todos os blocos,
  junções e handlers da função.
- Os argumentos e os resultados viajam nos registos do processo `x[]` (registos
  X do BEAM). Cada apontador de código tem a assinatura única `abi::v1::Code`,
  `void(void *context, TermWord x0, ..., TermWord x5)`: os primeiros
  `abi::v1::register_arguments` (6) registos passam também como parâmetros, pelo
  que os primeiros argumentos de uma chamada e o resultado de um retorno ficam
  em registos da máquina.
- Uma falha retorna através de cada chamador, que verifica o canal de falhas
  depois da chamada ([canal de falhas](abi.md#failure-channel-revision-2)).

## Estado do processo

`abi::v1::FrameState` está no início de cada contexto, pelo que o código gerado
o lê e atualiza inline:

| Campo | Significado |
| --- | --- |
| `stack`, `top`, `limit` | O bloco da pilha (desloca-se quando cresce), a sua primeira palavra livre e as palavras que um push pode alcançar sem crescer nem ultrapassar o limite da pilha |
| `frame` | Deslocamento, em palavras, do cabeçalho do frame atual |
| `registers`, `live` | Os 256 registos de argumentos/resultados; as primeiras `live` palavras são raízes numa transferência |
| `reductions` | Entradas de funções que restam na fatia de tempo |
| `slow`, `failed` | Bits que enviam as transferências para os serviços (`slow_collect`, `slow_profile`); diferente de zero enquanto o canal de falhas contém uma falha |

`heap_top`/`heap_limit`, `runtime` e `self` servem a alocação inline, os
carregamentos de átomos e `self/0`
([frames e transferências](abi.md#frames-and-transfers)). Um processo suspenso
regista a entrada na qual continua em `ProcessStack::resume_`.

## Frames

Um frame é um cabeçalho de 4 palavras seguido dos slots da função (registos Y do
BEAM): slots de termos, que são raízes, e depois slots em bruto para valores
nativos guardados (spilled).

| Palavra do cabeçalho | Significado |
| --- | --- |
| `previous` | Deslocamento do cabeçalho do chamador (os frames ligam-se por deslocamentos, nunca por apontadores) |
| `function` | O `FrameDescriptor` da função |
| `resume` | Índice de continuação sobre o qual o corpo faz o switch quando o controlo regressa aqui |
| `handler` | Índice de handler; sempre 0, já que as falhas retornam através dos chamadores |

O descritor `<symbol>.frame` indica o módulo, a função e a aridade e contém o
apontador de código do corpo e o número de slots
([abi](abi.md#frames-and-transfers)). As palavras do cabeçalho não são termos;
quem percorre a pilha segue `previous` e lê o número de slots nos descritores.
Um **frame de fundo** pertencente ao runtime fica por baixo da primeira chamada
de cada processo e de cada invocação pelo anfitrião: retornar para ele guarda o
resultado no primeiro registo e termina a chamada nativa.

## Operações

- **Chamada (não de cauda).** Os valores vivos depois da chamada são guardados
  em slots. O chamador define o seu próprio `resume` com o índice de continuação
  seguinte, coloca os argumentos nos registos e transfere para a função chamada.
  As chamadas locais, remotas, de funs e dinâmicas são a mesma transferência;
  uma chamada de fun ou dinâmica pede primeiro a um serviço de preparação o
  `FrameDescriptor` da função chamada ([funs](funs.md#dynamic-calls)).
- **Entrada.** Gasta uma redução, faz push de um frame a zero (fazendo crescer a
  pilha quando está cheia), copia para os slots os argumentos para além dos
  parâmetros, define `resume = 0` e transfere para o corpo da função chamada.
- **Retorno.** A função chamada passa o resultado como `x0`, faz pop do seu
  frame (`top = frame`, `frame = previous`) e transfere para o corpo do
  chamador, que faz o switch sobre o `resume` do chamador.
- **Chamada de cauda.** O chamador faz pop do seu próprio frame sem transferir
  e depois entra na função chamada no seu lugar. O chamador do chamador continua
  a ser o destino do retorno, pelo que a recursão de cauda corre em pilha Erlang
  e nativa constante. Uma chamada de cauda a si própria mantém o seu frame onde
  está: gasta uma redução, repõe as palavras de retoma e de handler do frame e a
  contagem de vivos e copia os argumentos para além dos parâmetros, sem
  reescrever o cabeçalho nem zerar os slots; o LLVM transforma-a num ciclo. Uma
  chamada de cauda a outro membro do ciclo de chamadas de cauda do chamador
  (funções de um módulo que se alcançam umas às outras através de chamadas de
  cauda) mantém a ligação ao chamador e os slots de termos que ambos os frames
  têm: escreve o descritor da função chamada, zera apenas os slots de termos da
  função chamada para além dos do chamador e salta o teste do limite da pilha
  quando o frame da função chamada não é maior. Tal como numa chamada de cauda a
  si própria, um slot mantido pode conter um termo de um membro anterior até a
  função chamada o escrever, pelo que as recolhas podem manter esse termo vivo
  um pouco mais.
- **Yield.** Sem reduções restantes, uma entrada não faz push: regista-se em
  `ProcessStack::resume_`, mantém os seus argumentos como raízes de registos
  (`ProcessStack::keep_registers`) e devolve código que termina a fatia de
  tempo, pelo que a pilha nativa se desenrola até ao executor, que mais tarde
  repõe o orçamento e repete a entrada. As cabeças de ciclo das comprehensions
  também gastam uma redução e fazem yield através de uma entrada quando não
  resta nenhuma. Um `receive` espera através do builtin `CLAUSE_wait_frame_v1`,
  no qual se entra como numa chamada ([receive](processes.md#receive)).
- **Saída.** Retornar para o frame de fundo termina o processo com o seu
  resultado; uma falha que retorna para ele termina o processo com a falha.
- **Exceções.** Um raise ou uma verificação de serviço falhada regista o erro no
  canal e copia os 8 frames mais interiores da cadeia para o stack trace
  ([stack traces](abi.md#stack-traces)). Cada chamador verifica o canal depois
  da chamada e retorna de imediato, ou salta para o bloco de handler de um
  `catch`, `try` ou `after` envolvente no mesmo corpo
  ([canal de falhas](abi.md#failure-channel-revision-2)). Os halts e as falhas
  de infraestrutura saltam todos os handlers e retornam ao frame de fundo.
- **Invocação pelo anfitrião.** Um símbolo exportado mantém uma assinatura
  nativa e executa a sua função acima de um frame de fundo com
  `CLAUSE_invoke_v1`, retomando-a após cada yield; as exceções nativas lançadas
  pelos serviços ficam aí contidas. Os serviços do runtime continuam a ser
  chamadas nativas comuns e nunca reentram no código gerado.

Cada chamada faz push de um frame; as funções folha não o dispensam, pelo que
cada função mantém a sua entrada no stack trace.

## Visibilidade das raízes

Em cada transferência e em cada safepoint, as raízes de um processo são: os
slots de termos de todos os frames da sua pilha, `x[0..live)`, e o payload, a
lista de argumentos e o termo de pilha do canal de falhas
([raízes](runtime-heap.md#roots-and-safe-points)).

Os valores nunca sobrevivem a uma transferência em registos nativos ou em
valores SSA, exceto os parâmetros da própria transferência. Cada corpo recarrega
o endereço do seu frame a partir de `stack + frame` depois de entrar, e lê os
valores vivos dos slots. Dentro de uma continuação, um serviço que possa fazer
push de um frame ou deslocar o heap invalida todos os apontadores de slots e de
heap mantidos em valores SSA; a regra de recarregamento para as recolhas está
fixada em [regra de recarregamento](runtime-heap.md#reload-rule).

O bloco da pilha cresce duplicando e deslocando-se enquanto o limite global do
runtime o permitir, nunca encolhe durante a execução e é separado do bloco de
heap. Não tem limite de número de frames; as palavras da pilha contam para o
[limite de memória do runtime](runtime-heap.md#runtime-memory-limit).

## Alvos

`musttail` com uma única assinatura de código uniforme é aceite por todos os
alvos exigidos em O0 e O2 (protótipo abaixo, clang 23.1.2):

| Alvo | Palavra | Resultado |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | saltos de cauda |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | saltos de cauda |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | saltos de cauda |
| `armv7-unknown-linux-gnueabihf` | 32 | saltos de cauda |

O backend indica um erro quando não consegue honrar uma chamada `musttail`, pelo
que uma compilação bem-sucedida é a garantia. Alternativa para um alvo futuro
que a rejeite: um **trampolim**, em que cada código devolve o apontador de
código seguinte ao ciclo do escalonador em vez de saltar; os frames, as raízes e
os índices de continuação ficam inalterados. Nenhum alvo exigido precisa dele.

## Implementação

- **Duas fases.** O lowering emite a *forma nativa*: uma função
  `TermWord(context, arguments)` por função Erlang, chamadas comuns entre elas,
  uma chamada provisória `clause.frame` que nomeia os slots de termos, e `ret`
  do resultado de uma chamada em posição de cauda. `lower_frames`
  (`compiler/src/codegen/frames.cpp`) move depois cada corpo para
  `<symbol>.body`, acrescenta o prólogo (cabeçalho do frame, registos, switch de
  retoma), divide os blocos depois das chamadas que não são de cauda e dos
  safepoints das cabeças de ciclo, guarda os valores usados depois delas (termos
  em slots de termos, outras palavras em slots em bruto), eleva os endereços de
  slots constantes para o prólogo e converte as chamadas, as chamadas de cauda e
  os retornos em transferências `musttail`. A especialização de tipos e os
  pontos de teste trabalham sobre a forma nativa; o backend executa
  `lower_frames` antes da inspeção da IR e `optimize` executa-o se ainda for
  necessário.
- **Transferências inline.** As entradas, as entradas de cauda e os retornos
  correm inline sobre `FrameState`. Cada uma recorre a `CLAUSE_enter_v1`,
  `CLAUSE_tail_v1` ou `CLAUSE_return_v1` quando o heap pede uma recolha, o
  processo está em perfilagem, não resta nenhuma redução, a pilha tem de crescer
  ou atinge o seu limite, ou a função chamada é um builtin. A verificação de
  falha após uma chamada lê a palavra `failed` do estado. Os caminhos de serviço
  guardam os parâmetros no array de registos antes do serviço e recarregam-nos
  depois.
- **Parâmetros.** Um corpo lê os seus primeiros argumentos dos parâmetros quando
  começa e o resultado da chamada de `x0` quando é retomado; `lower_frames` só
  guarda qualquer deles num slot quando está vivo através de uma chamada ou de
  um safepoint.
- **Posições de cauda** são a última expressão do corpo de uma cláusula,
  seguida através de blocos, parênteses e corpos de cláusulas de `case`, `if` e
  `receive`. As chamadas em operandos de `catch`, `try`, `maybe` e
  `andalso`/`orelse` não são chamadas de cauda.
- **Ciclos.** Os geradores das comprehensions são ciclos dentro de um único
  corpo. Os seus cursores e o acumulador residem em slots de termos, pelo que
  nenhum valor SSA é transportado à volta de um ciclo e um ponto de retoma
  dentro dele não precisa de nada além dos spills habituais.
- **Safepoints.** As entradas de funções e as cabeças de ciclo das
  comprehensions fazem a recolha quando o heap o pede
  ([recolha no código gerado](runtime-heap.md#collection-in-generated-code));
  os slots de spill em bruto nunca contêm termos.
- **Sem limite.** A pilha cresce até o anfitrião recusar memória, o que falha
  com `out_of_memory` (código de saída 70, [executáveis](executables.md)), tal
  como cresce um processo OTP. Um `StackOptions::limit_words` opcional por
  processo (separado do orçamento opcional do heap) faz falhar com
  `resource_limit` um push que o ultrapasse.

## Alternativas comparadas

[tests/prototypes/execution_model](../tests/prototypes/execution_model/)
converte à mão as mesmas funções Erlang (`sum/1` com recursão no corpo, `loop/2`
com recursão de cauda, `fail/1` a lançar à profundidade N, `catcher/1` a
capturá-lo) de três formas e compila-as para todos os alvos acima em O0 e O2
(`python tests/prototypes/execution_model/run.py`). Em Windows x64 com O2, o
modelo escolhido executou uma recursão no corpo com 1M de profundidade em 17 ms
com 5 palavras por frame e 10M chamadas de cauda em pilha constante; a sua
variante com trampolim passou as mesmas execuções. Rejeitadas:

- **Chamadas nativas com frames de raízes explícitos.** A recursão profunda
  precisa de uma pilha nativa por processo dimensionada para a chamada mais
  profunda (cerca de 13 000 níveis numa thread de 1 MiB); a suspensão precisa de
  troca de pilha específica de cada alvo; os alvos de 32 bits não conseguem
  reservar pilhas grandes para muitos processos.
- **Corrotinas LLVM.** Uma alocação no heap por chamada, sem chamadas de cauda,
  frames cuja disposição o recoletor não consegue ver, passes de corrotinas
  mesmo em O0, e a transferência simétrica depende de qualquer forma de
  `musttail`.
- **Uma função LLVM por continuação** (CPS clássico). As mesmas transferências,
  mas as junções e os handlers alcançados a partir de várias continuações teriam
  de ser divididos em mais funções; o switch de retoma mantém um percurso por
  uma única função.

Custos aceites: um salto indireto por retorno mais um despacho por switch; os
valores vivos através das chamadas são recarregados dos slots; os backtraces dos
depuradores nativos mostram apenas a função atual, enquanto os stack traces
Erlang provêm da cadeia de frames ([depuração](debugging.md)).
