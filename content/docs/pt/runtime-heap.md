---
source: docs/runtime-heap.md
sourceCommit: 06042fa
sourceSha256: b86a14bcde03a998409e7048283225de3a5f8f84ded889ba64544a4671571cbc
translatedAt: 2026-10-09
---
# Contrato do heap do processo

Os heaps dos processos seguem o desenho clássico do ERTS. Esta nota é o
contrato; o plan 11 phase C (steps 8A–8I) implementou-o, e os steps
posteriores indicados abaixo estendem-no.
[runtime.md](runtime.md#process-memory) resume a API.

## O que a phase C substituiu

| Antes da phase C | Problema | Substituição |
| --- | --- | --- |
| Uma lista de blocos (chunks) que nunca se movem | As células não podem ser compactadas nem copiadas; a capacidade só cresce | Um bloco de heap contíguo mais fragmentos, movidos por um garbage collector de cópia (8G, 8H) |
| Cada célula é um nó num índice `std::map` por processo | As palavras do heap, por si só, não são analisáveis; uma alocação no anfitrião e uma pesquisa O(log n) por célula | Células autodescritivas; admissão por intervalo próprio e cabeçalho (8C, 8D) |
| Cada célula de bitstring tem um array fixo de 64 bytes e um `shared_ptr`, libertado através de um registo de destrutores | Células grandes para dados pequenos; nada consegue mover uma célula nem encontrar as suas cópias mortas | Binaries de heap de tamanho variável e células de binaries fora do heap numa lista fora do heap por processo (8B) |
| O `Term` do anfitrião fixa o heap com `shared_ptr<HeapStorage>`; os valores mantidos pelo runtime vivem apenas em `Term`s | Nada que um garbage collector consiga encontrar ou reescrever | Modelo do ERTS: o C++ só mantém palavras em bruto entre pontos seguros; os valores mantidos pelo runtime são palavras de raiz do processo; quem chama a partir do anfitrião passa raízes explícitas a `collect()` (8E) |
| Um buffer de heap por cada frame de raiz gerado | Não há pilha do processo para percorrer | Uma pilha de frames de raiz por processo (8F) |
| Sem área de transbordo | A alocação ou cabe no orçamento ou falha | Fragmentos de heap enquanto o heap não se pode mover (8G) |

O código gerado, a sua ABI e todos os resultados observáveis dos programas
permanecem inalterados.

## Disposição das palavras

Um termo é uma palavra do alvo (32 ou 64 bits); as codificações estão em
[abi.md](abi.md#terms). Cada área do heap é uma sequência de objetos que um
percorredor analisa a partir da sua primeira palavra:

- **Palavra de cabeçalho** (etiqueta primária `00`): os bits 2–6 contêm o
  `BoxedKind`, os bits 7 e seguintes o número de palavras que se seguem ao
  cabeçalho. Um termo boxed aponta para o seu cabeçalho. A contagem abrange
  todas as palavras de prefixo, de carga útil e de enchimento, pelo que o
  percorredor salta a carga útil não rastreada sem a interpretar.
- **Célula cons**: duas palavras de termo (cabeça, cauda) sem cabeçalho. Um
  termo de lista aponta para a cabeça. Uma cabeça nunca é um cabeçalho, porque
  nenhum termo tem a etiqueta `00`.
- **Enchimento**: a palavra toda a zeros (tipo `tuple`, contagem 0) é um
  enchimento de uma palavra; o tipo `filler` com contagem n abrange mais n
  palavras. As reservas começam a zero, pelo que as palavras reservadas mas não
  usadas são analisadas como enchimento. Os tuplos não vazios têm sempre uma
  contagem diferente de zero e `{}` é um imediato.

Nenhuma célula precisa de um alinhamento mais forte do que uma palavra. `memory/heap_walk` analisa uma área célula a célula e `ProcessHeap::verify`
verifica um heap inteiro (8C). As células contêm apenas palavras e bytes,
exceto o `std::shared_ptr` do binary fora do heap (abaixo), pelo que uma célula
se move copiando as suas palavras.

| Tipo | Palavras após o cabeçalho | Palavras rastreadas |
| --- | --- | --- |
| cons (sem cabeçalho) | 2 palavras no total | cabeça, cauda |
| `tuple` | n slots de elementos | todas |
| `map` | 2n slots: chaves pela ordem exata dos termos, cada uma seguida do seu valor | todas |
| `native_record` | endereço da `RecordDefinition` do runtime, depois n valores de campos pela ordem da definição | valores |
| `fun_closure` | endereço da `FunDefinition` do runtime, depois n valores capturados ([funs](funs.md)) | valores |
| `bignum` | palavra de sinal, depois os limbs da magnitude, do menos significativo para o mais significativo | nenhuma |
| `floating` | 8 bytes: 1 palavra (64 bits) ou 2 palavras (32 bits) | nenhuma |
| `reference` | 8 bytes: o número da referência ([pids e referências](terms.md#pids-and-references)) | nenhuma |
| `heap_binary` | comprimento em bits, depois os bytes de dados arredondados para palavras (no máximo 64 bytes) | nenhuma |
| `refc_binary` | deslocamento em bits, comprimento em bits, `std::shared_ptr` (2 palavras), ligação fora do heap: 5 palavras | nenhuma |
| `filler` | n palavras não usadas | nenhuma |

A contagem de `map` é em palavras (entradas = contagem / 2). Os pids são imediatos, admitidos face aos números
emitidos pelo runtime. Os tipos ainda não admitidos (identidades externas)
seguirão as mesmas regras quando chegarem: as identidades e os descritores são
IDs de registo em palavras não rastreadas, nunca ponteiros C++ proprietários.

## Binaries fora do heap

Um binary com mais de 64 bytes é um buffer imutável que flutua fora de todos
os heaps dos processos, partilhado por contagem de referências (ProcBin e
`Binary` da BEAM).

- A sua célula boxed `refc_binary` contém um `std::shared_ptr` para o buffer,
  um deslocamento em bits e um comprimento em bits; as fatias de um binary
  grande são novas células `refc_binary` que partilham o buffer (os
  sub-binaries do ERTS não são usados). Copiar uma célula para outro processo
  copia o `shared_ptr` ([cópia entre heaps](#copying-between-heaps)),
  nunca os bytes.
- Cada célula está ligada à lista fora do heap do seu processo através da sua
  palavra de ligação. A lista é a única forma de encontrar o estado C++ destas
  células.
- Mover uma célula copia as suas outras palavras e constrói por movimento o
  `shared_ptr` na nova célula, pelo que a cópia antiga não possui nada. Após
  uma recolha, a varredura da lista volta a ligar as células movidas e destrói
  o `shared_ptr` das mortas; a destruição do processo destrói todos eles. Um
  buffer é libertado quando morre a sua última célula, em qualquer processo.
- Cada processo conta as suas células por buffer (`HeapStorage::buffers_`); um
  buffer é cobrado uma vez a cada processo que o referencia (as suas palavras
  fora do heap, o heap binário virtual do ERTS) até morrer a última célula
  desse processo para ele, e uma vez à conta global do runtime desde a criação
  até o buffer ser libertado.
- `std::shared_ptr` corresponde a dois ponteiros em todas as STL suportadas;
  um `static_assert` mantém o tamanho da célula fixo em cinco palavras após o
  cabeçalho em ambas as larguras.

## Áreas

- **Heap.** Um bloco `[start, top, end)` por processo com alocação por
  incremento (bump allocation) (8G). É criado pela primeira alocação do
  processo, com tamanho `max(min_heap_words, request)` para que esse pedido
  caiba sempre, e pertence apenas a esse processo.
- **Fragmentos.** Quando um pedido não cabe e o heap não se pode mover, vai
  para o fragmento mais recente se lá couber; caso contrário, para um novo
  fragmento dimensionado para caber (pelo menos o tamanho mínimo do heap) e
  encadeado ao processo. A recolha seguinte funde os fragmentos no novo bloco
  do heap. Uma reserva vive numa única área; a reversão repõe o topo dessa área
  e descarta um fragmento (ou o bloco do heap) que a reserva criou. A alocação
  nunca move o heap: o transbordo permanece em fragmentos até ao safepoint
  seguinte ou à recolha pelo anfitrião
  ([recolha no código gerado](#collection-in-generated-code)).
- **Pilha.** Os frames gerados (registos Y da BEAM) vivem numa pilha plana por
  processo, separada do heap (`ProcessStack`, step 19). Cada frame é um
  cabeçalho de quatro palavras (deslocamento do cabeçalho do chamador,
  descritor, retoma, bloco de tratamento) seguido de slots de termos (incluindo
  os termos despejados) e de slots de despejo em bruto; os frames
  ligam-se por deslocamentos, pelo que o
  bloco cresce por duplicação e move-se. Não tem limite por predefinição; um
  `StackOptions::limit_words` opcional por processo limita-o separadamente do
  heap ([modelo de execução](execution-model.md#implementation)).
- **Lista fora do heap.** Como acima.
- **Heap antigo.** Nenhum. A recolha geracional está adiada; os termos
  imutáveis nunca apontam de dados mais antigos para mais recentes, pelo que
  uma marca de nível máximo e um heap antigo podem ser acrescentados mais tarde
  sem alterar as células.

## Dimensionamento e orçamento

- O heap começa em `min_heap_words` (233 palavras, como no ERTS) e cresce
  segundo a sequência de tamanhos do ERTS: 12, 38, depois cada tamanho é a
  soma dos dois anteriores mais um até 833 026 palavras, e depois em passos de
  20% (`heap_size_at_least`).
- O novo bloco de uma recolha é o menor desses tamanhos que mantém as palavras
  que pode receber abaixo de 75% dele: primeiro todas as palavras usadas, pois
  os dados vivos não são conhecidos antes da cópia. Um resultado com menos de
  25% de dados vivos é copiado mais uma vez para o tamanho de que os seus dados
  vivos precisam (8H); se não for possível alocar esse bloco, mantém-se o
  maior. Nenhum dos dois é menor do que `min_heap_words`. Ambos os tamanhos
  contam as palavras da pilha do processo como vivas (step 26), já que o ERTS
  mantém a pilha dentro do bloco do heap.
- Com um orçamento definido (abaixo), um novo bloco contém no máximo as suas palavras vivas mais metade
  do orçamento que resta depois delas e dos buffers fora do heap
  (`block_limit`, step 27), nunca menos do que `min_heap_words`. A outra metade
  fica livre para fragmentos e novos buffers fora do heap, pelo que o lixo
  alocado após uma recolha chega ao safepoint seguinte como gatilho em vez de
  esgotar o orçamento. A primeira cópia é dimensionada a partir de todas as
  palavras usadas, pelo que um bloco acima do limite para as palavras que
  sobreviveram é copiado mais uma vez para o tamanho da sua política.
- Não há limite de memória por predefinição, nem por processo nem para o
  runtime: o heap cresce até o anfitrião recusar memória (`out_of_memory`),
  enquanto o dimensionamento acima o mantém perto do seu tamanho vivo. Um
  orçamento opcional por processo, `HeapOptions::limit_bytes` (predefinição
  `UNLIMITED_HEAP_BYTES`), abrange o bloco do heap, os fragmentos e os bytes
  dos buffers fora do heap que este processo referencia; excedê-lo dá
  `limit_exceeded`. Durante uma recolha, os blocos antigo e novo coexistem;
  só o novo bloco é verificado face ao orçamento, limitado ao orçamento que
  resta depois dos buffers fora do heap. A cobrança de um buffer é devolvida
  quando o processo descarta a sua última célula para ele. A pilha mantém o
  seu próprio limite opcional, `StackOptions::limit_words`. Os programas
  definem ambos os limites com `--max-heap` e `--max-stack`
  ([opções do runtime](executables.md#runtime-options)).

## Limite de memória do runtime

- Um limite opcional global do runtime, `RuntimeOptions::memory_limit_bytes`
  (predefinição `UNLIMITED_HEAP_BYTES`; os programas definem-no com
  `--max-memory`), limita a memória de todos os processos em conjunto: blocos
  de heap, fragmentos, buffers fora do heap e capacidade da pilha (step 27A). O
  OTP não tem tal limite; o mais próximo é executar a VM sob um limite de
  memória do sistema operativo, mas aqui falha um processo em vez do nó.
- Uma conta por runtime (`detail::RuntimeMemory`, partilhada por todo o
  armazenamento de heap e por todas as pilhas) é cobrada quando um bloco,
  fragmento, buffer fora do heap ou capacidade de pilha é criado e libertada
  quando este é descartado; um buffer partilhado por vários processos é
  cobrado uma vez e libertado quando morre a sua última referência
  (step 28). A destruição do processo devolve todas as suas cobranças.
  `Runtime::memory_bytes()` relata o total.
- Para cada processo, o limite funciona como um orçamento do armazenamento que
  possui mais o que o limite deixa livre (`HeapStorage::budget`, `room`), pelo
  que o dimensionamento acima mantém livre metade da memória livre após cada
  recolha, e um pedido para além disso dá `limit_exceeded` (`resource_limit`)
  apenas para o processo que o fez; os outros processos continuam a ser
  executados. O lixo de outro processo conta até esse processo fazer a recolha.
- O espaço de destino (to-space) de uma recolha é cobrado mesmo para além do
  limite, porque substitui os blocos que liberta no fim dessa mesma recolha.
- A pilha duplica enquanto o limite o permitir, e depois cresce apenas pelo
  frame que está a ser empilhado.

## Admissão

Os ponteiros para o heap de um processo só são criados pelo compilador e pelo
runtime dentro desse processo, e nomeiam sempre o início de um objeto; não há
ponteiros interiores a detetar. A admissão (8D) é uma verificação de posse das
palavras devolvidas a um processo:

1. O endereço está alinhado à palavra dentro de uma das áreas do processo,
   abaixo do seu `top`: o bloco do heap é verificado primeiro, depois os
   fragmentos ordenados por endereço. As palavras alheias e obsoletas falham
   aqui sem qualquer carregamento.
2. Uma palavra boxed nomeia um cabeçalho de um tipo admitido (não enchimento);
   uma palavra de lista nomeia uma célula cons (uma palavra que não é um
   cabeçalho).

Os acessores descodificam o tipo, a contagem e a carga útil a partir do
próprio cabeçalho. `verify()` continua a ser a verificação completa de que
cada slot nomeia o início de um objeto, para os testes.

## Raízes e pontos seguros

`ProcessContext::visit_roots` enumera todas as palavras de raiz para o garbage
collector (step 23). Num ponto seguro, nada mais contém palavras do heap do
processo:

| Proprietário | Palavras de raiz | Notas |
| --- | --- | --- |
| Slots de termos do frame | Os primeiros `roots` slots de cada frame na pilha (step 19) | Os frames de base não têm nenhum; os índices de retoma e de bloco de tratamento são inteiros |
| Slots em bruto do frame | Nenhuma | Valores nativos despejados; o código gerado não guarda aí nenhuma palavra do heap num ponto seguro (regra de recarregamento do step 24) |
| Registos | `x[0..live)` (`ProcessStack::keep_registers`) | Os argumentos de uma entrada suspensa (step 43); cada push e pop limpa `live` |
| Canal de falhas | Carga útil do erro (`fvalue` da BEAM), lista de argumentos de `erlang:error/2,3`, termo do stack trace | Reatribuídos no local; os frames do trace capturados são ponteiros de descritores para o código |
| Estado de trap | As palavras de termo do `TrapState` de um builtin que faz trap (step 43A) | Libertadas quando o builtin termina ou falha |
| Caixa de correio | Todas as mensagens na caixa de entrada de sinais e na fila de mensagens (step 45), incluindo as mensagens `'EXIT'` e `'DOWN'` | Até um receive a retirar; reescritas no local, pelo que o cursor do receive (uma posição na lista) e o prazo do timeout permanecem válidos |
| Raízes explícitas | O intervalo que o anfitrião passa a `collect(roots)` (8E) | Relidas após a chamada |
| Lista fora do heap | Nenhuma | As ligações são varridas e refeitas, não rastreadas |

Nenhuma célula do heap contém uma fixação. Os átomos são imediatos e a tabela
de átomos nunca é recolhida. As células de fun nomeiam o código através da sua
`FunDefinition` não rastreada, que vive tanto quanto o runtime; os módulos
carregados nunca são descarregados, pelo que nem as funs nem os descritores do
trace precisam de fixação. Os imediatos pequenos não são
raízes.

Tal como no código C do ERTS, um `Term` do anfitrião é uma palavra em bruto com
etiqueta, válida até ao ponto seguro seguinte do seu heap. Não fixa o
armazenamento do heap; mantém um token fraco do tempo de vida do contexto e a
contagem de recolhas do heap, pelo que o uso após a destruição relata
`expired_context` e o uso após uma recolha posterior relata um erro de termo
obsoleto. Um `Term` só é válido dentro do seu próprio processo; os outros
processos só o podem ler.

O heap só se move num ponto seguro, e nunca enquanto houver uma reserva
aberta:

- um `collect()` explícito do anfitrião enquanto o contexto não executa código
  gerado;
- um `collect()` enquanto o código gerado em execução declarou um âmbito
  `SafePoint`, prometendo que só contém palavras do heap nas raízes acima. O
  runtime só abre um nos safepoints do código gerado da secção seguinte.

Qualquer outro pedido devolve `unsafe_point` e não altera nada, nem sequer o
canal de falhas de uma chamada gerada em execução. A alocação nunca move o
heap: um pedido que não cabe cria um fragmento.

## Recolha no código gerado

Decisão do plan 11 step 24 (2026-10-06), implementada no step 26
([implementação](#implementation)). O código
gerado só faz a recolha em alguns **safepoints** onde cada termo vivo já está
numa raiz. Tudo o resto, incluindo cada serviço que aloca, é uma **secção
crítica** que nunca move o heap.

### Gatilhos

Um safepoint faz a recolha quando o heap a pede; caso contrário, custa uma
verificação.

| Gatilho | Condição no safepoint | Equivalente no ERTS |
| --- | --- | --- |
| Heap cheio | Existe algum fragmento: uma alocação não coube no bloco do heap desde a última recolha | O topo do heap atinge o fim do heap |
| Pressão dos binaries fora do heap | As palavras fora do heap atingem o limite do heap binário virtual: 46 422 palavras de início, após cada recolha o dobro das palavras fora do heap sobreviventes, nunca menos do que isso, mas no máximo os sobreviventes mais metade do orçamento deixado livre após o bloco do heap (step 27) | `bin_vheap_sz` / heap binário virtual |
| `erlang:garbage_collect/0` | Sempre; chega com as famílias de builtins (steps 36-37) como um safepoint forçado | Varredura completa explícita |

O novo bloco é dimensionado para as palavras vivas **mais as palavras da pilha
em uso** (o ERTS mantém a pilha dentro do bloco do heap): uma pilha profunda
obtém um heap maior, pelo que uma recursão longa faz a recolha em proporção à
sua alocação, em vez de voltar a percorrer toda a pilha a cada poucas centenas
de palavras.

### Safepoints

| Ponto | Onde | Vivo fora dos slots de termos do frame |
| --- | --- | --- |
| Entrada de função | Em `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (e portanto na invocação pelo anfitrião), antes de o frame do chamado ser empilhado | Os argumentos do chamado `x[0..arity)`, mantidos como raízes (`keep_registers`) |
| Início de ciclo | Uma chamada de `CLAUSE_safepoint_v1(context)` no início de cada ciclo de gerador de comprehension | Nada |

Cada ciclo Erlang é ou uma recursão, que passa por uma entrada de função em
cada passo, ou uma comprehension, que passa pelo seu início de ciclo, pelo que
o lixo entre dois safepoints é limitado por código linear e por resultados
individuais de serviços.

Não são safepoints (secções críticas, que continuam a alocar em fragmentos):
todos os outros serviços do runtime, incluindo os serviços de alocação,
construção e correspondência; `CLAUSE_return_v1`; a propagação de exceções; e,
mais tarde, a entrega de mensagens (step 45). Os serviços podem, portanto,
manter palavras do heap em bruto em C++ durante toda a sua execução, e os seus
arrays de entrada e as suas saídas não precisam de recarregamento.

### Processos em espera e suspensos

Plan step 51. Um processo que não está em execução nunca é recolhido: está à
espera num receive, em fila após uma cedência (yield) ou um trap, ou ainda não
foi iniciado, e tudo o que contém já é uma raiz (os seus frames, os registos da
entrada ou da continuação em que irá retomar, o estado de trap e as suas
mensagens). As mensagens que lhe são enviadas são copiadas para fragmentos do
seu heap. Cada entrega acorda um processo em espera, e retomá-lo repete a
entrada da sua continuação (o builtin de espera, uma continuação de trap ou a
função em que cedeu), o que é um safepoint de entrada de função: a primeira
coisa que um processo retomado faz é a recolha, quando o seu heap a pede. Um
processo à espera num receive seletivo que salta muitas mensagens faz, por
isso, a recolha à medida que elas chegam, tal como o ERTS faz a recolha de um
processo quando este é escalonado a seguir. `executables_mailbox_collection`
verifica a acumulação, a espera com timeout e a recursão profunda sob carga de
mensagens, e que um consumidor que confirma 3 000 mensagens se mantém dentro de
`--max-heap 65536`.

Rejeitado: a alocação como safepoint (`test_heap` da BEAM). Exigiria que cada
entrada de serviço e cada termo SSA vivo através de qualquer alocação estivesse
numa raiz, um recarregamento após cada serviço que aloca e um protocolo de
nova tentativa em cada serviço, enquanto os dois safepoints acima já limitam o
lixo.

### Regra de recarregamento

Nenhum valor SSA (um valor num registo nativo) contém uma palavra do heap
através de um safepoint, e nenhum ponteiro nativo atravessa nenhum (o que já é
um erro em `lower_frames`).

- `lower_frames` trata uma chamada de safepoint no início de ciclo como o ponto
  de retoma de uma chamada: divide o bloco após a chamada e despeja cada valor
  lido depois dela que tenha sido calculado antes dela. Um **valor de termo**
  (um carregamento de um slot de termo ou de um registo, um valor guardado num
  slot de termo, ou um PHI desses valores) é guardado após a sua definição no
  seu slot de termo existente ou num novo slot de termo contado nas `roots` do
  descritor, e recarregado antes de cada uso. As outras palavras (imediatos
  pequenos, átomos, inteiros em bruto, flags) mantêm slots em bruto: uma
  recolha nunca as altera.
- As chamadas despejam e recarregam da mesma forma, os termos em slots de
  termos, pelo que o safepoint de entrada vê cada termo vivo de cada chamador.
- A base do frame permanece válida através de um safepoint de início de ciclo,
  porque uma recolha reescreve as palavras da pilha no local e nunca move a
  pilha; cada transferência relê-a no prólogo do corpo, como antes.
- A otimização é executada após `lower_frames` e não pode substituir um
  recarregamento pelo valor SSA mais antigo: o endereço do frame provém de
  `CLAUSE_frame_v1`, pelo que a chamada do safepoint pode escrever em qualquer
  slot (protótipo abaixo).

### Comportamento em caso de falha

- Uma recolha num safepoint nunca regista uma falha. Quando o seu novo bloco
  não pode ser alocado (`out_of_memory`), o heap fica como está e a execução
  continua com fragmentos.
- **Esgotamento da memória** (step 27). Sem limite, a memória só se esgota
  quando o anfitrião recusa um bloco de heap, um fragmento, um buffer fora do
  heap ou o crescimento da pilha: `out_of_memory`. Com um orçamento opcional
  ou um [limite global do runtime](#runtime-memory-limit) definido, um pedido
  para além dele dá `limit_exceeded`, relatado como `resource_limit`. Ambos são
  falhas de infraestrutura: nenhum bloco de tratamento é executado, os frames
  desenrolam até ao frame de base e um programa imprime
  `clau: runtime failure: entry call failed: <status>`
  e termina com o estado 70 depois de descarregar o stdout e destruir o processo
  ([executáveis](executables.md#exit-status), [diferenças](differences.md)).
  Como cada recolha mantém livre metade do orçamento que resta após os seus
  sobreviventes ([dimensionamento](#sizing-and-budget), [gatilhos](#triggers)),
  um orçamento só falha quando o conjunto vivo deixa de caber ou quando o
  código linear entre dois safepoints aloca mais do que essa metade; o lixo é
  recolhido primeiro.

### Implementação

Step 26 (2026-10-06):

- `ProcessStack::safepoint(live)` pergunta a `ProcessHeap::wants_collection()`
  (existe um fragmento, ou as palavras fora do heap atingiram
  `binary_limit_words_`), mantém `x[0..live)` como raízes, abre um `SafePoint`
  e faz a recolha; uma recolha falhada é ignorada. `enter` (e portanto `tail`
  e `invoke`) chama-o com a aridade do chamado antes de empilhar;
  `CLAUSE_safepoint_v1` chama-o com 0.
- O rebaixamento (lowering) das comprehensions emite `CLAUSE_safepoint_v1` no
  início de cada ciclo de gerador (`lowering_comprehensions`).
- `lower_frames` divide cada corpo após uma chamada de safepoint e despeja os
  valores que a atravessam como após uma chamada. `home()` mantém o slot do
  argumento ou um slot de termo do mesmo bloco quando um deles contém o valor;
  caso contrário, um valor de termo (`term_value`: carregado de um slot de
  termo ou registo, guardado num slot de termo, ou um PHI destes) recebe um
  novo slot de termo, que `place_slots` acrescenta aos slots de termos
  iniciais, antes dos slots em bruto, e qualquer outro valor um slot em bruto.
- O golden `executables_garbage_collection` (gerado pelo OTP) aloca mais de
  64 MiB com um conjunto vivo pequeno: um ciclo de cauda que constrói uma
  string de 400 palavras por passo, 9 000 binaries fora do heap de 8 KiB, uma
  comprehension cujo filtro aloca por elemento, uma recursão no corpo com
  20 000 níveis de profundidade que mantém um termo aninhado (tuplo, lista,
  binary) por frame, e uma carga útil de erro capturada após desenrolar frames
  que alocam e mantida ao longo de um ciclo longo que aloca.

Step 27 (2026-10-06):

- `collected_size` limita o bloco a `block_limit(live)`; `shrink` também é
  executado quando o bloco excede o limite das palavras sobreviventes;
  `collect` limita `binary_limit_words_` aos sobreviventes mais metade do
  orçamento deixado livre após o bloco.
- Antes, um bloco podia ocupar todo o orçamento restante (dimensionado a partir
  das palavras usadas, incluindo o lixo) e o heap binário virtual podia
  excedê-lo assim que os sobreviventes passassem metade do orçamento, pelo que
  as alocações falhavam com lixo ainda por recolher: com o orçamento
  predefinido de então, de 64 MiB, uma execução de 64 bits que retinha 700
  binaries de 64 KiB enquanto descartava quatro por passo falhava com 68% de
  dados vivos; com os limites, cabem 1 010 (99%).
- O orçamento predefinido de heap de 64 MiB e o orçamento de pilha de 2^24
  palavras foram removidos (indicação do utilizador): ambos são opcionais por
  processo (`Runtime::create_context(HeapOptions, StackOptions)`), sem limite
  por predefinição.
- O golden `executables_heap_growth` mantém 1 100 binaries de 65 540 bytes
  (72 MB) enquanto descarta quatro por passo e imprime a contagem como o OTP.
  `runtime_collection` `near_budget` verifica ambos os limites com um orçamento
  de 10 000 palavras (bloco do heap e buffers fora do heap).

Step 27A (2026-10-06):

- Limite global do runtime e `--max-heap`, `--max-stack`, `--max-memory`
  ([limite de memória do runtime](#runtime-memory-limit)). Execuções golden
  escritas à mão voltam a provar que a memória é limitada:
  `garbage_collection` `churn` e `binaries` sob um limite do runtime de 1 MiB,
  `comprehension` sob um limite de heap de 1 MiB e `payload` sob um limite do
  runtime de 16 MiB (cada um aloca mais de 64 MiB); `tail_calls` executa ciclos
  sob uma pilha de 4 KiB e um limite de heap de 64 KiB; `deep` sob 1 MiB e
  `deep_recursion` `build` sob uma pilha de 64 KiB falham com
  `resource_limit`. O próprio `deep` precisa de cerca de 100 MiB em O0 (os
  frames vivos mantêm termos obsoletos e têm cerca de 130 palavras cada), pelo
  que não tem uma execução bem-sucedida com limite.
  `runtime_collection` `shared_limit`: dois processos sob um limite de
  40 000 palavras; o bloco do detentor para nas 28 000 palavras, o outro faz 20
  rondas de recolha de lixo perto do limite e depois falha uma lista de 16 000
  palavras com `resource_limit` enquanto o detentor continua a alocar, e a
  destruição devolve todas as cobranças.

### Protótipo

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) contém um ciclo
ao estilo de uma comprehension na forma posterior a `lower_frames`
(`loop.ll`): um termo `Y` calculado antes do ciclo é guardado num slot de termo
e recarregado após o safepoint do início de ciclo.
`python tests/prototypes/safepoint/run.py` compila-o para
`x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu` (palavras de 64 bits),
`i686-pc-windows-msvc` e `armv7-unknown-linux-gnueabihf` (palavras de 32 bits)
em O0 e O2 e verifica que um carregamento da palavra do frame de `Y` se segue à
chamada do safepoint. Os oito passam com clang 23.1.2. Em O2 (i686), o ciclo
mantém o recarregamento do slot e nunca reutiliza o registo que continha `Y`:

```text
LBB0_2:                     # loop head
    pushl  %edi
    calll  _clause_safepoint_v1
    pushl  20(%esi)         # cursor reloaded from its term slot
    ...
    pushl  24(%esi)         # accumulator
    pushl  28(%esi)         # Y reloaded from its term slot
    calll  _make
```

## Recolha

Uma cópia de Cheney com varredura completa (8H, `memory/heap_collect`): aloca
primeiro o novo bloco (a falha é `out_of_memory` e deixa o heap intacto),
depois marca os `Term`s do anfitrião como obsoletos, copia o objeto por trás de
cada palavra de raiz e percorre o novo bloco da esquerda para a direita,
copiando os filhos de cada cópia. O cabeçalho de um objeto boxed movido é
substituído por um ponteiro boxed para a sua cópia; uma célula cons movida
recebe uma cabeça a zero e uma cauda que aponta para a sua cópia. O
reencaminhamento preserva a partilha. As raízes são reescritas no local, a
lista fora do heap é varrida (cópias religadas pela ordem da lista, células
mortas destruídas), e o bloco antigo e os fragmentos são libertados. Um heap
que nunca foi alocado não é recolhido. `CollectionStats` relata as palavras
antes, as palavras vivas, o novo bloco do heap, os fragmentos fundidos, a
capacidade de slots da pilha e as palavras fora do heap.

## Cópia entre heaps

`ProcessHeap::add(value)`, ou equivalentemente `value.copy_to(heap)`, devolve
um termo do heap de destino (step 28, `size_object` e `copy_struct` da BEAM):

- Os imediatos e os átomos do mesmo runtime não precisam de armazenamento, e
  um termo do heap de destino mantém a sua identidade. Um grafo de outro
  processo do mesmo runtime é copiado; o grafo de outro runtime dá
  `wrong_owner`, uma origem expirada `expired_context`, um handle de origem
  mais antigo do que a última recolha do seu heap `stale_term`. As fábricas
  continuam a recusar entradas alheias (`ProcessHeap::retain`), pelo que só
  uma cópia explícita move um grafo.
- Um único percurso com uma pilha explícita (sem recursão) encontra cada
  objeto distinto alcançável a partir do valor, indexado pelo endereço, pelo
  que a partilha interna sobrevive: `{T, T}` copia `T` uma única vez, ao
  contrário do `copy_struct` predefinido do ERTS, que achata a partilha. A
  cópia é uma única reserva da soma das suas palavras, no bloco do heap ou num
  fragmento, preenchida pela ordem do percurso com os ponteiros reescritos para
  as cópias.
- A cópia de um binary fora do heap é uma nova célula que partilha o buffer; o
  destino detém o buffer (cobrando as suas próprias palavras fora do heap se
  ainda não detinha nenhuma parte dele) antes de reservar, e só lista a célula
  depois de a reserva ser confirmada.
- A origem é apenas lida. Uma falha (`resource_limit` para o orçamento do
  destino ou o limite do runtime, `out_of_memory` para o anfitrião) liberta as
  detenções do buffer e reverte a reserva, pelo que ambos os heaps e todas as
  cobranças ficam como antes. Uma cópia não possui nenhum armazenamento da
  origem: sobrevive à recolha e à destruição da origem.

## Medições

`runtime_heap_measurements` (CTest em modo completo; números impressos, não
usados como gate) constrói uma lista de 100 000 elementos de tuplos
`{Index, Float}` através de `TermFactory`, percorre-a de volta através de
acessores verificados e cria 1 000 contextos, cada um com um tuplo pequeno.
Desde o 8I também faz a recolha com a lista como única raiz e percorre a cópia.
Os bytes laterais são alocações no anfitrião para além do armazenamento do heap
(um índice de objetos antes do 8D, a cadeia de fragmentos desde o 8G).

| Revisão | Compilação | Construção / percurso no kernel | Palavras do heap usadas / capacidade | Bytes laterais | Bytes por contexto | Palavras do heap por contexto |
| --- | --- | --- | --- | --- | --- | --- |
| `bb09359` (lista de blocos, índice de objetos) | Windows x64 Debug, clang-cl | 264 / 81 ms | 700 000 / 704 512 | 24 002 256 (cerca de 80 por célula) | 66 217 | 8 192 |
| 8D (lista de blocos, intervalo próprio) | Windows x64 Debug, clang-cl | 185 / 147 ms | 700 000 / 704 512 | 3 440 | 66 057 | 8 192 |
| 8G (heap de 233 palavras, cerca de 3 000 fragmentos) | Windows x64 Debug, clang-cl | 219 / 174 ms | 700 000 / 706 223 | 163 878 | 2 377 | 233 |
| 8I, antes da recolha | Windows x64 Debug, clang-cl | 216 / 173 ms | 700 000 / 706 223 | 163 878 | 2 377 | 233 |
| 8I, após uma recolha | Windows x64 Debug, clang-cl | recolha 56 ms / percurso 72 ms | 700 000 / 999 631 | 0 | — | — |

Face à base `bb09359`: os metadados laterais por célula desapareceram (de
24 MB para nada após a recolha), um contexto precisa de 2,4 KB e 233 palavras
do heap em vez de 66 KB e 8 192 palavras, a construção é cerca de 20% mais
rápida e o percurso é mais lento até uma recolha fundir os fragmentos (a
admissão em fragmentos é uma pesquisa binária sobre cerca de 3 000
intervalos); após uma recolha, o percurso demora 72 ms. Um conjunto vivo de
700 000 palavras é recolhido em cerca de 56 ms num bloco de 999 631 palavras,
o tamanho do ERTS que o mantém abaixo de 75%.
