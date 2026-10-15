---
source: docs/execution-model.md
sourceCommit: 6ed3851c
sourceSha256: 662633c074adf6d3159dce2c7df1099c01e46ae9c66d8589bca3e6a13daca6a2
translatedAt: 2026-10-15
---
# Modelo de execução: frames e continuações

Define a forma como as funções
Erlang geradas chamam, retornam, se suspendem e falham, a partir do momento em
que chegam a recursão, as chamadas de cauda e os processos. O step 19 implementou as
chamadas, os retornos, as chamadas de cauda e os frames
([Implementação](#implementation) lista o que ainda está em aberto); os steps
23, 24, 26 e 43 baseiam-se nele.

## Decisão

Cada processo Erlang corre na sua própria **pilha plana de frames
explícitos**, e o código gerado só passa de uma função para outra através de
**transferências de cauda garantidas** (`musttail` do LLVM). Uma chamada que
não é de cauda guarda a continuação do chamador no frame do chamador e salta
para a função chamada; um retorno salta de volta para essa continuação. A
pilha nativa fica, portanto, com uma única chamada de profundidade acima do
escalonador, seja qual for a profundidade da recursão Erlang, e um processo
pode parar em qualquer transferência e retomar mais tarde em qualquer thread.

- Uma única pilha plana por processo substitui a pilha de raízes segmentada do
  8F. Contém os cabeçalhos e os slots dos frames, cresce por deslocação e é
  endereçada como base mais deslocamento.
- Cada função que precisa de um frame é convertida para nível inferior
  (lowering) numa **entrada** e num **corpo**. O corpo começa com um `switch`
  sobre o índice de continuação do frame, pelo que uma única função LLVM
  mantém todos os blocos, junções e handlers da função.
- Os argumentos e os resultados viajam nos registos do processo `x[0..n)`
  (registos X do BEAM); cada apontador de código tem a assinatura única
  `void code(Process *)`.
- As exceções desenrolam os frames até ao frame mais interior cujo cabeçalho
  indica uma continuação de handler.

## Estado do processo

| Campo | Significado |
| --- | --- |
| `stack`, `capacity` | Um único array de palavras que pode crescer; desloca-se quando cresce |
| `frame`, `top` | Deslocamentos, em palavras, do cabeçalho do frame atual e da primeira palavra livre |
| `x[]`, `live` | Registos de argumentos/resultados; as primeiras `live` palavras são raízes numa transferência |
| `reductions` | Chamadas que restam na fatia de tempo |
| `resume_at` | Entrada na qual um processo suspenso continua |
| canal de falhas | O canal atual da revisão 2: razão, payload, stack trace, `halted` |

## Frames

Um frame é um cabeçalho fixo seguido dos slots da função (registos Y do
BEAM). Os slots são postos a zero no push, tal como os frames de raízes atuais.

| Palavra do cabeçalho | Significado |
| --- | --- |
| `previous` | Deslocamento do cabeçalho do chamador (os frames ligam-se por deslocamentos, nunca por apontadores) |
| `function` | O descritor da função |
| `resume` | Índice de continuação sobre o qual o corpo faz o switch quando o controlo regressa aqui |
| `handler` | Índice de continuação do handler ativo mais interior, 0 se não houver nenhum |

O descritor estende o atual `abi::v1::FrameDescriptor` (descritor do módulo,
slots dos átomos do módulo e da função, aridade) com os apontadores de código
da entrada e do corpo e com o número de slots. As palavras do cabeçalho não
são termos; quem percorre a pilha segue `previous` e lê o número de slots nos
descritores. Um **frame de fundo** pertencente ao runtime fica por baixo da
primeira chamada de cada processo: a continuação 1 é uma saída normal
(resultado em `x[0]`), a continuação 2 é o handler de uma exceção não
capturada.

## Operações

- **Chamada (não de cauda).** Os valores vivos já estão em slots (a regra de
  enraizamento atual). O chamador define o seu próprio `resume` com o índice
  de continuação seguinte, escreve os argumentos em `x[0..n)` e transfere para
  a entrada da função chamada. Uma chamada remota transfere para o símbolo de
  entrada exportado.
- **Entrada.** Conta uma redução (ver yield), faz push de um frame a zero
  (deslocando a pilha quando está cheia), copia `x[0..n)` para os slots,
  define `resume = 0` e transfere para o corpo.
- **Retorno.** A função chamada escreve o resultado em `x[0]`, faz pop do seu
  frame (`top = frame`, `frame = previous`) e transfere para o corpo do
  chamador, que faz o switch sobre o `resume` do chamador.
- **Chamada de cauda.** Os argumentos vão para `x[0..n)`, o chamador faz pop do seu
  próprio frame sem transferir e depois transfere para a entrada da função
  chamada. O chamador do chamador continua a ser o destino do retorno, pelo que
  a recursão de cauda corre em pilha Erlang e nativa constante. As chamadas de cauda
  locais, mútuas e remotas são o mesmo salto.
- **Yield.** Cada entrada gasta uma redução. Ao chegar a zero, regista-se em
  `resume_at` e regressa ao escalonador em vez de fazer push de um frame; os
  argumentos ficam em `x[0..arity)`, que passam a ser os únicos registos do
  processo a enraizar. Retomar repõe o orçamento e transfere para
  `resume_at`, que repete a entrada. As esperas posteriores (`receive`)
  guardam um índice de continuação do corpo em vez de uma entrada.
- **Saída.** Retornar para o frame de fundo regista uma saída normal;
  desenrolar até ele regista uma exceção não capturada. Em ambos os casos, o
  código regressa ao escalonador.
- **Propagação de exceções.** Um raise ou uma verificação de serviço falhada
  regista o erro no canal, como hoje, e indica os 8 frames mais interiores
  para o trace a partir da cadeia de frames. O desenrolador faz então pop dos
  frames cujo `handler` é 0, define `resume = handler` no primeiro frame que
  tenha um e transfere para o seu corpo. Os handlers de `catch`, `try` e
  `after` são índices de continuação; entrar numa região protegida define
  `handler` e sair dela restaura o índice envolvente, ambos conhecidos
  estaticamente dentro de uma função. Os halts e as falhas de infraestrutura
  saltam todos os handlers e desenrolam diretamente até ao frame de fundo, tal
  como hoje saltam os handlers. O handler obtém a exceção com os serviços
  atuais (`CLAUSE_catch_v1`, `CLAUSE_exception_v2`) e volta a lançá-la através
  do desenrolador.
- **Invocação pelo anfitrião.** O runtime faz push de um frame de fundo,
  carrega `x[]` e executa o ciclo do escalonador até esse frame ser atingido.
  Os serviços do runtime continuam a ser chamadas nativas comuns e nunca
  reentram no código gerado; só este ciclo do anfitrião o inicia.

Uma função que não faça nenhuma chamada que não seja de cauda e não mantenha
nenhum slot através de um safepoint pode dispensar o seu frame e retornar
diretamente para o corpo do chamador. Trata-se de uma otimização que o
compilador pode acrescentar mais tarde, não de parte do contrato.

## Visibilidade das raízes

Em cada transferência e em cada safepoint, as raízes de um processo são: todos
os slots de todos os frames da sua pilha, `x[0..live)`, e o payload, a lista
de argumentos e o termo de pilha do canal de falhas (já raízes do processo).
As palavras de passagem do resultado da pilha de raízes atual desaparecem;
`x[0]` assume o seu papel.

Os valores nunca sobrevivem a uma transferência em registos nativos ou em
valores SSA. Cada corpo recarrega o endereço do seu frame a partir de
`stack + frame` depois de entrar, e lê os valores vivos dos slots. Dentro de
uma continuação, um serviço que possa fazer push de um frame ou deslocar o
heap invalida todos os apontadores de slots e de heap mantidos em valores SSA;
a regra de recarregamento para as recolhas está fixada em
[recolha no código gerado](runtime-heap.md#collection-in-generated-code).

## Sucessora da pilha de raízes do 8F

A pilha segmentada só existe porque o código gerado mantém apontadores de
frame absolutos através das chamadas. Neste modelo, nenhum apontador de frame
sobrevive a uma transferência, pelo que a pilha passa a ser um único bloco
plano por processo:

- os cabeçalhos dos frames residem na pilha, os slots são endereçados como
  `stack + frame + header + index`;
- o bloco cresce duplicando e deslocando-se (`realloc`), nunca encolhe durante
  a execução e é separado do bloco de heap;
- o limite de 4096 frames é abandonado; as palavras da pilha contam para o
  orçamento de memória do processo, e excedê-lo é a falha documentada do
  step 20.

## Alvos

`musttail` com a assinatura uniforme `void (Process *)` é aceite por todos os
alvos exigidos em O0 e O2 (protótipo abaixo, clang 23.1.2):

| Alvo | Palavra | Resultado |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | saltos de cauda |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | saltos de cauda |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | saltos de cauda |
| `armv7-unknown-linux-gnueabihf` | 32 | saltos de cauda |

O backend indica um erro quando não consegue honrar uma chamada `musttail`,
pelo que uma compilação bem-sucedida é a garantia. Alternativa para um alvo
futuro que a rejeite: um **trampolim**. Cada código devolve o apontador de
código seguinte ao ciclo do escalonador em vez de saltar (nulo suspende); os
frames, as raízes e os índices de continuação ficam inalterados. Nenhum alvo
exigido precisa dele.

## Implementação

O step 19 (2026-10-05) implementa o modelo com estas escolhas e lacunas:

- **Duas fases.** O lowering continua a emitir a *forma nativa*: uma função
  `TermWord(context, arguments)` por função Erlang, chamadas comuns entre
  elas, uma chamada provisória `clause.frame` que nomeia os slots de termos, e
  `ret` do resultado de uma chamada em posição de cauda. `lower_frames`
  (`compiler/src/codegen/frames.cpp`) move depois cada corpo para
  `<symbol>.body`, acrescenta o prólogo (cabeçalho do frame, registos, switch
  de retoma), divide os blocos depois das chamadas que não são de cauda e dos
  safepoints das cabeças de ciclo, guarda (spill) os valores usados depois
  delas (termos em slots de termos, outras palavras em slots em bruto), eleva
  os endereços de slots constantes para o prólogo e converte as chamadas, as
  chamadas de cauda e os retornos em transferências `musttail`. A especialização de
  tipos e os pontos de teste trabalham sobre a forma nativa; o backend executa
  `lower_frames` antes da inspeção do IR e `optimize` executa-o se ainda for
  necessário.
- **Entrada e corpo.** Não existe uma função de entrada separada. A tabela de
  estado do processo acima é `abi::v1::FrameState`, no início de cada
  contexto, pelo que o código gerado faz as transferências inline (revisão 9
  da ABI): uma entrada gasta uma redução, faz push do frame zerado, copia os
  argumentos dos registos e transfere para o corpo da função chamada; uma
  entrada de cauda reutiliza primeiro o lugar do chamador; um retorno faz pop
  e transfere para o corpo do chamador. Cada caminho recorre a
  `CLAUSE_enter_v1`, `CLAUSE_tail_v1` ou `CLAUSE_return_v1` quando o heap
  pede uma recolha, o processo está em perfilagem, não resta nenhuma redução,
  a pilha tem de crescer ou atinge o seu limite, ou a função chamada é um
  builtin. A verificação de falha após uma chamada lê a palavra `failed` do
  estado. Uma chamada de cauda a si própria mantém o seu frame onde está:
  gasta uma redução, repõe as palavras de retoma e de handler do frame e a
  contagem de vivos e copia os argumentos para além dos registos, sem
  reescrever o cabeçalho nem zerar os slots (cada um contém zero ou uma
  palavra de termo que as recolhas reescrevem, e o corpo escreve um slot antes
  de o ler).
- **Parâmetros em registos** (revisão 10 da ABI). O código é
  `void(void *, TermWord x0, TermWord x1, TermWord x2)`: cada transferência
  passa os três primeiros registos X como parâmetros C, pelo que os primeiros
  argumentos de uma chamada e o resultado de um retorno ficam em registos da
  máquina. Um corpo lê os seus primeiros argumentos dos parâmetros quando
  começa e o resultado da chamada de `x0` quando é retomado; `lower_frames`
  só faz spill de qualquer deles para um slot quando está vivo através de uma
  chamada ou de um safepoint. Os caminhos de serviço guardam os parâmetros no
  array de registos antes do serviço e recarregam-nos depois. Com todos os
  corpos a partilhar um único protótipo, o LLVM transforma num ciclo uma
  chamada de cauda a si própria cujo push inline conduz de volta ao mesmo
  corpo.
- **Posições de cauda** são a última expressão do corpo de uma cláusula,
  seguida através de blocos, parênteses e corpos de cláusulas `case` e `if`.
  As chamadas em operandos de `catch`, `try`, `maybe` e `andalso`/`orelse` não
  são chamadas de cauda.
- **As exceções** retornam através de cada chamador, que verifica o canal
  depois da chamada, como antes; os índices de handler e o desenrolamento
  direto continuam a ser uma otimização. Os stack traces leem a cadeia de
  frames no momento do raise.
- **Ciclos.** Os geradores das comprehensions são ciclos dentro de um único
  corpo. Os seus cursores e o acumulador residem em slots de termos, pelo que
  nenhum valor SSA é transportado à volta de um ciclo e um ponto de retoma
  dentro dele não precisa de nada além dos spills habituais.
- **Yields** ([processos](processes.md)). Cada entrada, inline ou
  através de `CLAUSE_enter_v1` e `CLAUSE_tail_v1`, gasta uma das reduções do
  processo; quando não resta nenhuma, os serviços assumem o controlo:
  registam a função em que se entrou (`ProcessStack::resume_`, o
  `resume_at` do modelo), mantêm os seus argumentos como raízes de registos e
  devolvem código que termina a fatia de tempo, pelo que a pilha nativa se
  desenrola até ao executor, que mais tarde repete a entrada. As cabeças de
  ciclo não fazem yield. O recoletor enumera os slots de termos dos frames, os
  registos que uma suspensão mantém vivos (`ProcessStack::keep_registers`) e o
  canal de falhas ([raízes](runtime-heap.md#roots-and-safe-points)).
  As entradas de funções e as cabeças de ciclo das comprehensions são
  safepoints que fazem a recolha quando o heap o pede
  ([recolha no código gerado](runtime-heap.md#collection-in-generated-code));
  os slots de spill em bruto nunca contêm termos.
- **Sem limite.** A pilha cresce até o sistema anfitrião recusar memória, o
  que falha com `out_of_memory` (código de saída 70,
  [executáveis](executables.md)), tal como cresce um processo OTP. Um
  `StackOptions::limit_words` opcional por processo (separado do orçamento
  opcional do heap) faz falhar com `resource_limit` um push que o ultrapasse.
  Os frames ocupam hoje 4 palavras de cabeçalho mais 1-40 slots.
- **Entrada pelo anfitrião.** Um símbolo exportado mantém a assinatura nativa
  e executa a sua função acima de um frame de fundo do runtime com
  `CLAUSE_invoke_v1`; as exceções nativas lançadas pelos serviços ficam aí
  contidas.

## Alternativas comparadas

Protótipo em [tests/prototypes/execution_model](../tests/prototypes/execution_model/):
as mesmas funções Erlang (`sum/1` com recursão no corpo, `loop/2` com recursão
de cauda, `fail/1` a lançar `boom` à profundidade N, `catcher/1` a capturá-lo)
convertidas à mão de três formas. Anfitrião: Windows x64, clang 23.1.2; os
tempos são execuções únicas em O2. Executar
`python tests/prototypes/execution_model/run.py`.

| | Frames explícitos + `musttail` (escolhido) | Chamadas nativas + frames de raízes (atual) | Corrotinas LLVM (C++20) |
| --- | --- | --- | --- |
| Recursão no corpo com 1M de profundidade | ok, 17 ms; 5 palavras por frame; 17 deslocações da pilha | 80 B de pilha nativa por nível: cerca de 13 000 níveis numa thread de 1 MiB | ok, 60 ms; uma alocação no heap de 64–80 B por chamada |
| 10M chamadas de cauda | ok, 5 ms; pilha constante | em O0 cresce 80 B por chamada; em O2 só por sorte com sibling calls | sem chamadas de cauda: 1M iterações mantêm 1M frames |
| Yield / retoma | em cada entrada; dois processos intercalam-se | impossível sem uma pilha nativa por processo | transferência simétrica (ela própria `musttail`) |
| Pilha nativa à profundidade 1M | 136–144 B | cresce por nível | 144–520 B |
| Raízes visíveis para o GC | slots em frames conhecidos | slots em frames conhecidos | disposição do frame da corrotina escolhida pelo LLVM; os termos precisariam de uma segunda cópia enraizada |
| Exceções | desenrolar até ao frame do handler | verificação do canal em cada retorno | verificação do canal em cada retorno |

A variante com trampolim do modelo escolhido passa as mesmas execuções (20 ms
de recursão, 16 ms para 10M chamadas de cauda em O2). Rejeitadas:

- **Chamadas nativas com frames de raízes explícitos.** A recursão profunda
  precisa de uma pilha nativa por processo dimensionada para a chamada mais
  profunda; a suspensão precisa de troca de pilha específica de cada alvo; os
  alvos de 32 bits não conseguem reservar pilhas grandes para muitos
  processos.
- **Corrotinas LLVM.** Uma alocação por chamada, sem chamadas de cauda, frames
  opacos para o recoletor, passes de corrotinas mesmo em O0, e a
  transferência simétrica depende de qualquer forma de `musttail`.
- **Uma função LLVM por continuação** (CPS clássico). As mesmas
  transferências, mas as junções e os handlers alcançados a partir de várias
  continuações teriam de ser divididos em mais funções; o switch de retoma
  mantém o atual percurso por uma única função.

Custos aceites: um salto indireto por retorno mais um despacho por switch; os
valores vivos através das chamadas são recarregados dos slots (já lá estão
guardados); os backtraces dos depuradores nativos mostram apenas a função
atual, enquanto os stack traces Erlang provêm da cadeia de frames.

## Evidência do protótipo

`run.py` compila o modelo escolhido (`musttail` e trampolim), a base nativa e
o modelo de corrotinas para o anfitrião em O0 e O2, executa-os e compila as
funções convertidas à mão (`generated.cpp`, freestanding) para cada alvo acima
em O0 e O2, contando as chamadas `musttail` no IR e os saltos de cauda no
assembly. Resultado de 2026-10-05: PASS. Para o modelo escolhido, em ambos os
níveis: retorno (42), recursão no corpo com 1 000 000 de profundidade,
10 000 000 chamadas de cauda, um erro lançado à profundidade 100 000 capturado por um
frame de handler, o mesmo erro não capturado (frame de fundo, trace de 8
frames `fail`), e dois processos intercalados em fatias de 4000 reduções
(1002 fatias). Os 15 pontos de transferência são todos `musttail` em O0 em
todos os alvos (14 em O2 após inlining).

O corpo de `sum/1` para `i686-pc-windows-msvc` (IR em O2, nomes encurtados).
O IR de `x86_64-pc-windows-msvc` é o mesmo, com palavras `i64` e
deslocamentos duplicados.

```llvm
%2 = load ptr, ptr %0, align 4                      ; stack base
%3 = getelementptr inbounds nuw i8, ptr %0, i32 8
%4 = load i32, ptr %3, align 4                      ; current frame offset
%5 = getelementptr inbounds nuw [4 x i8], ptr %2, i32 %4
%6 = getelementptr inbounds nuw i8, ptr %5, i32 16  ; slot 0 (N)
%7 = getelementptr inbounds nuw i8, ptr %5, i32 8   ; header: resume index
%8 = load i32, ptr %7, align 4
%9 = icmp eq i32 %8, 0                              ; switch on resume
...
16:                                                 ; N > 0: call sum(N - 1)
  store i32 1, ptr %7, align 4                      ; resume = 1
  ...                                               ; x0 = N - 1
  %19 = tail call ptr @call(ptr %0, ptr @SUM)       ; push frame or park
  musttail call void %19(ptr nonnull %0)
  ret void
20:                                                 ; resume 1: x0 += N
  ...
  %24 = tail call ptr @leave(ptr %0)                ; pop, caller body
  musttail call void %24(ptr nonnull %0)
  ret void
```
