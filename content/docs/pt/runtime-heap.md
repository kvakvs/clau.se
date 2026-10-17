---
source: docs/runtime-heap.md
sourceCommit: a8c3f8f6
sourceSha256: cc0485350969c6f992d4987c8f893772eef2f3b1d7b9f3315e20c63541a45bc8
translatedAt: 2026-10-17
---
# Contrato do heap do processo

Os heaps dos processos seguem o desenho clássico do ERTS: um bloco de heap
contíguo por processo mais fragmentos de transbordo, células autodescritivas,
binaries grandes em buffers partilhados fora do heap e um garbage collector de
cópia que só corre em pontos seguros. Esta nota é o contrato;
[runtime.md](runtime.md#process-memory) resume a API do anfitrião.

## Disposição das palavras

Um termo é uma palavra do alvo (32 ou 64 bits); as codificações estão em
[abi.md](abi.md#terms). Cada área do heap é uma sequência de objetos que um
percorredor analisa a partir da sua primeira palavra:

- **Palavra de cabeçalho** (etiqueta primária `00`): os bits 2–6 contêm o
  `BoxedKind`, os bits 7 e seguintes o número de palavras que se seguem ao
  cabeçalho. Um termo boxed aponta para o seu cabeçalho. A contagem abrange
  todas as palavras de prefixo, de carga útil e de enchimento, pelo que o
  percorredor salta a carga útil não rastreada sem a interpretar. Tem 25 bits
  em alvos de 32 bits (no máximo 33 554 431 palavras) e 57 em alvos de 64 bits
  (`BoxHeader::MAX_COUNT`): o limite de aridade dos tuplos (2^24 - 1) e o maior
  bignum (131 072 palavras em 32 bits) cabem por asserção estática, os maps
  verificam-no quando são construídos, e as células cons e as células de
  tamanho fixo não têm contagens grandes.
- **Célula cons**: duas palavras de termo (cabeça, cauda) sem cabeçalho. Um
  termo de lista aponta para a cabeça. Uma cabeça nunca é um cabeçalho, porque
  nenhum termo tem a etiqueta `00`.
- **Enchimento**: a palavra toda a zeros (tipo `tuple`, contagem 0) é um
  enchimento de uma palavra; o tipo `filler` com contagem n abrange mais n
  palavras. As reservas começam a zero, pelo que as palavras reservadas mas não
  usadas são analisadas como enchimento. Os tuplos não vazios têm sempre uma
  contagem diferente de zero e `{}` é um imediato.

Nenhuma célula precisa de um alinhamento mais forte do que uma palavra.
`memory/heap_walk` analisa uma área célula a célula e `ProcessHeap::verify`
verifica um heap inteiro. As células contêm apenas palavras e bytes, exceto o
`std::shared_ptr` do binary fora do heap (abaixo), pelo que uma célula se move
copiando as suas palavras.

| Tipo | Palavras após o cabeçalho | Palavras rastreadas |
| --- | --- | --- |
| cons (sem cabeçalho) | 2 palavras no total | cabeça, cauda |
| `tuple` | n slots de elementos | todas |
| `map` | 2n slots: chaves pela ordem exata dos termos, cada uma seguida do seu valor; no máximo 32 entradas | todas |
| `tree_map` | número de entradas, palavra de edição, `map_node` raiz: 3 palavras ([árvores de maps](#map-trees)) | a raiz |
| `map_node` | entradas abaixo, palavra de edição, depois n chaves e n valores (uma folha) ou n filhos (um ramo); nunca é um termo | chaves e valores ou filhos |
| `native_record` | endereço da `RecordDefinition` do runtime, depois n valores de campos pela ordem da definição | valores |
| `fun_closure` | endereço da `FunDefinition` do runtime, depois n valores capturados ([funs](funs.md)) | valores |
| `bignum` | palavra de sinal, depois os limbs da magnitude, do menos significativo para o mais significativo | nenhuma |
| `floating` | 8 bytes: 1 palavra (64 bits) ou 2 palavras (32 bits) | nenhuma |
| `reference` | 8 bytes: o número da referência ([pids e referências](terms.md#pids-and-references)) | nenhuma |
| `heap_binary` | comprimento em bits, depois os bytes de dados arredondados para palavras (no máximo 64 bytes) | nenhuma |
| `refc_binary` | deslocamento em bits, comprimento em bits, o primeiro byte do buffer (lido pelo código gerado), fim e limite de acrescento, `std::shared_ptr` (2 palavras), ligação fora do heap: 8 palavras | nenhuma |
| `sub_binary` | deslocamento em bits no original, comprimento em bits, o `heap_binary` ou `refc_binary` original (nunca um sub-binary): 3 palavras | o original |
| `filler` | n palavras não usadas | nenhuma |

A contagem de `map` é em palavras (entradas = contagem / 2). Os pids e as
portas são imediatos, admitidos face aos números emitidos pelo runtime.

## Binaries fora do heap

Um binary com mais de 64 bytes é um buffer imutável que flutua fora de todos os
heaps dos processos, partilhado por contagem de referências (ProcBin e `Binary`
da BEAM).

- A sua célula boxed `refc_binary` contém um `std::shared_ptr` para o buffer,
  um deslocamento em bits e um comprimento em bits. As fatias de um binary
  grande (e as fatias dessas) são células `sub_binary` que nomeiam a célula
  original, como fazem os sub-binaries do ERTS: uma fatia não toma nenhuma
  referência ao buffer e mantém o original vivo. Copiar uma célula para outro
  processo copia o `shared_ptr`
  ([cópia entre heaps](#copying-between-heaps)), nunca os bytes.
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
- `std::shared_ptr` corresponde a dois ponteiros em todas as STL suportadas; um
  `static_assert` mantém o tamanho da célula fixo em oito palavras após o
  cabeçalho em ambas as larguras.

### Referências handle

Uma referência handle é uma referência que também detém um buffer fora do heap,
tal como uma referência mágica do OTP detém um recurso; os arrays de `atomics`
vivem nelas ([atomics e counters](builtins.md#atomics-and-counters)).

- A sua célula tem o tipo `reference` e a disposição de `refc_binary`: oito
  palavras após o cabeçalho, o número de 64 bits da referência nas palavras de
  deslocamento e de comprimento em bits (onde uma célula de referência simples
  o guarda), depois o `shared_ptr` e a palavra de ligação. Todos os serviços de
  referências leem apenas o número, pelo que se compara, calcula o hash,
  imprime e codifica como uma referência simples.
- É listada, movida, varrida, cobrada e copiada exatamente como uma célula de
  binary fora do heap (`layout::off_heap_cell`); o seu buffer é libertado
  quando morre a última cópia da referência em qualquer processo.
- Um registo global ao processo associa os números dos handles vivos aos seus
  buffers (referências fracas), pelo que `binary_to_term/1` de um handle
  codificado reconstrói um handle que partilha o buffer enquanto este vive, e
  uma referência simples depois. As entradas expiradas são descartadas à medida
  que o registo cresce.

## Árvores de maps

Um map com mais de 32 entradas (`MAP_SMALL_MAP_LIMIT` do OTP) é um stub
`tree_map` de 4 palavras que nomeia a raiz de uma árvore B+ persistente
(`terms/map_tree`) cujos nós são células `map_node` do mesmo heap, tal como o
OTP mantém os nós da sua HAMT no heap. Os maps mais pequenos continuam a ser
células `map`.

- As folhas contêm até 16 palavras de chaves e valores pela ordem exata das
  chaves; os ramos contêm até 16 filhos com as suas primeiras chaves, e cada nó
  conta as entradas abaixo dele, pelo que a pesquisa e o acesso por posição são
  O(log n). Todos os nós, exceto a raiz, estão pelo menos meio cheios.
- Uma atualização copia o caminho até à folha alterada (cerca de 35 palavras
  por nível) e partilha todos os outros nós com o map de origem, que fica
  inalterado, pelo que construir um map chave a chave custa O(n log n) em vez
  de O(n^2). Conta primeiro as palavras do caminho e aloca-as de uma só vez;
  uma atualização falhada reverte-as.
- Os nós são células comuns: as recolhas movem-nos, promovem-nos e
  libertam-nos, as versões mortas não custam nada, e contam em `heap_size`, não
  como palavras fora do heap. Copiar um map para outro heap (mensagens) copia
  os seus nós como quaisquer células.
- Cada stub e cada nó leva uma palavra de edição: o token da atualização que o
  criou, acima de um bit de folha. Os nós com o token da própria atualização
  mudam no local (uma atualização de várias chaves escreve cada nó uma vez). Os
  tokens emitidos antes da última recolha não permitem nenhuma alteração no
  local, já que a recolha pode ter promovido os nós, e uma cópia para outro
  heap limpa o token.
- Uma atualização própria (`MapOperation::update_owned`) cuja origem o
  compilador provou não ser lida depois consome o stub de origem (raiz `[]`,
  tamanho 0) e reutiliza o seu token enquanto este for atual, pelo que altera
  no local os nós que a própria atualização da origem criou e copia o resto do
  caminho. Uma atualização própria falhada devolve a árvore ao stub. O
  compilador só marca uma atualização como própria quando a função construiu
  ela mesma o map de origem (`M = <map expression or
  comprehension>` no mesmo corpo de cláusula), não lê `M` em mais lado nenhum e
  nunca o captura numa fun (`semantic/map_ownership`).

## Áreas

- **Heap.** Um bloco `[start, top, end)` por processo com alocação por
  incremento (bump allocation). É criado pela primeira alocação do processo,
  com tamanho `max(min_heap_words, request)` para que esse pedido caiba sempre
  (os fragmentos começam no mínimo, no máximo 233 palavras, e depois crescem,
  abaixo), e pertence apenas a esse processo. O código gerado aloca nele
  tuplos, listas, floats e closures pequenos diretamente por incremento através
  de `FrameState::heap_top`/`heap_limit`: `HeapStorage::absorb` incorpora essas
  palavras no topo e em `used_words_` antes de qualquer operação de heap
  (reserva, admissão, recolha, verificação, consultas de utilização) e `expose`
  volta a mostrar as palavras livres depois dela. A alocação inline nunca cria
  um fragmento e fica desligada sob um orçamento por processo. Quando o bloco
  tem menos de 64 palavras livres, `expose` mostra em vez dele o fragmento
  próprio mais recente do processo (nunca um bloco de mensagem adotado), pelo
  que a alocação entre dois safepoints, como os retornos de uma recursão no
  corpo, continua inline depois de abrir o primeiro fragmento (janelas de
  fragmentos). Sem orçamento, cada novo fragmento é pelo menos tão grande como
  os fragmentos anteriores.
- **Áreas de literais.** Os literais compostos de cada módulo — strings e
  listas constantes, tuplos de constantes, floats, literais bignum e binaries
  constantes — são dispostos pelo compilador como células de heap numa única
  variável global só de leitura (`ModuleDescriptor::literals`), registada a
  nível global do runtime (`detail::LiteralAreas`, um instantâneo ordenado sem
  locks) quando o módulo é registado. Os termos de qualquer processo podem
  apontar para elas: a admissão e `TermAccess::object` leem as células através
  de `HeapStorage::readable` (heap, fragmentos, depois literais); o garbage
  collector deixa as palavras de literais como estão (`owned` continua a
  abranger apenas o heap); as cópias entre heaps e para buffers de mensagens
  continuam a apontar para elas (uma raiz literal não precisa de cópia); o
  verificador aceita-as. Os literais contêm apenas imediatos (apenas átomos
  fixos) e palavras de outros literais.
- **Fragmentos.** Quando um pedido não cabe e o heap não se pode mover, vai
  para o fragmento mais recente se lá couber; caso contrário, para um novo
  fragmento dimensionado para caber (pelo menos o tamanho mínimo do heap) e
  encadeado ao processo. A recolha seguinte funde os fragmentos no novo bloco
  do heap. Uma reserva vive numa única área; a reversão repõe o topo dessa área
  e descarta um fragmento (ou o bloco do heap) que a reserva criou. A alocação
  nunca move o heap: o transbordo permanece em fragmentos até ao safepoint
  seguinte ou à recolha pelo anfitrião
  ([recolha no código gerado](#collection-in-generated-code)).
- **Pilha.** Os frames gerados vivem numa pilha plana por processo, separada do
  heap (`ProcessStack`, [modelo de execução](execution-model.md#implementation)).
  Não tem limite por omissão; um `StackOptions::limit_words` opcional por
  processo limita-a separadamente do heap.
- **Lista fora do heap.** Como acima.
- **Área antiga.** Objetos que sobreviveram a duas recolhas
  ([gerações](#generations)); as recolhas menores deixam-na no lugar, uma
  varredura completa copia-a para o novo bloco e liberta-a.

## Dimensionamento e orçamento

- `min_heap_words` é o `min_heap_size` do processo: 233 palavras por omissão
  (como no ERTS), `--min-heap-size` para todos os processos (`+hms` do ERTS),
  `{min_heap_size, N}` em `spawn_opt` ou `process_flag(min_heap_size, N)` para
  um só; uma definição é arredondada para cima para um tamanho de heap e nunca
  fica abaixo do valor por omissão do runtime, e `process_flag` tem efeito na
  recolha seguinte. Como nenhum bloco é menor, um processo não faz a recolha
  antes de ter alocado esse número de palavras.
- O heap começa em `min_heap_words` e cresce segundo a sequência de tamanhos do
  ERTS: 12, 38, depois cada tamanho é a soma dos dois anteriores mais um até
  833 026 palavras, e depois em passos de 20% (`heap_size_at_least`).
- O novo bloco de uma recolha é o menor desses tamanhos que mantém as palavras
  que pode receber abaixo de 75% dele: primeiro todas as palavras usadas, pois
  os dados vivos não são conhecidos antes da cópia. Um resultado com menos de
  25% de dados vivos é copiado mais uma vez para o tamanho de que os seus dados
  vivos precisam; se não for possível alocar esse bloco, mantém-se o maior.
  Nenhum dos dois é menor do que `min_heap_words`. Ambos os tamanhos contam as
  palavras da pilha do processo como vivas, já que o ERTS mantém a pilha dentro
  do bloco do heap.
- Com um orçamento definido (abaixo), um novo bloco contém no máximo as suas
  palavras vivas mais metade do orçamento que resta depois delas e dos buffers
  fora do heap (`block_limit`), nunca menos do que `min_heap_words`. A outra
  metade fica livre para fragmentos e novos buffers fora do heap, pelo que o
  lixo alocado após uma recolha chega ao safepoint seguinte como gatilho em vez
  de esgotar o orçamento. A primeira cópia é dimensionada a partir de todas as
  palavras usadas, pelo que um bloco acima do limite para as palavras que
  sobreviveram é copiado mais uma vez para o tamanho da sua política.
- Não há limite de memória por omissão, nem por processo nem para o runtime: o
  heap cresce até o anfitrião recusar memória (`out_of_memory`), enquanto o
  dimensionamento acima o mantém perto do seu tamanho vivo. Um orçamento
  opcional por processo, `HeapOptions::limit_bytes` (por omissão
  `UNLIMITED_HEAP_BYTES`), abrange o bloco do heap, os fragmentos e os bytes
  dos buffers fora do heap que este processo referencia; excedê-lo dá
  `limit_exceeded`. Durante uma recolha, os blocos antigo e novo coexistem; só
  o novo bloco é verificado face ao orçamento, limitado ao orçamento que resta
  depois dos buffers fora do heap. A cobrança de um buffer é devolvida quando o
  processo descarta a sua última célula para ele. A pilha mantém o seu próprio
  limite opcional, `StackOptions::limit_words`. Os programas definem ambos os
  limites com `--max-heap` e `--max-stack`
  ([opções do runtime](executables.md#runtime-options)).

## Blocos de heap

Os blocos de heap, os fragmentos e as áreas antigas provêm de
`memory/heap_blocks`. Um bloco que uma recolha liberta fica com a sua thread
para as recolhas seguintes dessa thread (tal como os carriers do ERTS guardam
memória): um novo bloco usa o menor bloco em cache com pelo menos o seu tamanho
e no máximo o dobro, ou então memória nova. Cada thread guarda no máximo 8
blocos e 4M palavras (32 MB em alvos de 64 bits); os blocos com menos de 4096
palavras não são guardados, já que as listas livres do heap C++ os servem a
baixo custo. Sem isto, o espaço de destino (to-space) de cada recolha obtinha
páginas novas do sistema operativo e pagava uma falta de página por cada página
em que tocava, e libertar um bloco grande devolvia as suas páginas. Os blocos
em cache não são cobrados a nenhum processo nem à conta global do runtime; uma
thread liberta a sua cache quando termina.

## Limite de memória do runtime

- Um limite opcional global do runtime, `RuntimeOptions::memory_limit_bytes`
  (por omissão `UNLIMITED_HEAP_BYTES`; os programas definem-no com
  `--max-memory`), limita a memória de todos os processos em conjunto: blocos
  de heap, fragmentos, buffers fora do heap e capacidade da pilha. O OTP não
  tem tal limite; o mais próximo é executar a VM sob um limite de memória do
  sistema operativo, mas aqui falha um processo em vez do nó.
- Uma conta por runtime (`detail::RuntimeMemory`, partilhada por todo o
  armazenamento de heap e por todas as pilhas) é cobrada quando um bloco,
  fragmento, buffer fora do heap ou capacidade de pilha é criado e libertada
  quando este é descartado; um buffer partilhado por vários processos é cobrado
  uma vez e libertado quando morre a sua última referência. A destruição do
  processo devolve todas as suas cobranças. `Runtime::memory_bytes()` indica o
  total.
- Para cada processo, o limite funciona como um orçamento do armazenamento que
  possui mais o que o limite deixa livre (`HeapStorage::budget`, `room`), pelo
  que o dimensionamento acima mantém livre metade da memória livre após cada
  recolha, e um pedido para além disso dá `limit_exceeded` (`resource_limit`)
  apenas para o processo que o fez; os outros processos continuam a correr. O
  lixo de outro processo conta até esse processo fazer a recolha.
- O espaço de destino (to-space) de uma recolha é cobrado mesmo para além do
  limite, porque substitui os blocos que liberta no fim dessa mesma recolha.
- A pilha duplica enquanto o limite o permitir, e depois cresce apenas pelo
  frame que está a ser empilhado.

## Admissão

Os ponteiros para o heap de um processo só são criados pelo compilador e pelo
runtime dentro desse processo, e nomeiam sempre o início de um objeto; não há
ponteiros interiores a detetar. A admissão é uma verificação de posse das
palavras devolvidas a um processo:

1. O endereço está alinhado à palavra dentro de uma das áreas do processo,
   abaixo do seu `top`: o bloco do heap é verificado primeiro, depois os
   fragmentos ordenados por endereço, depois as áreas de literais
   ([áreas](#areas)). As palavras alheias e obsoletas falham aqui sem qualquer
   carregamento.
2. Uma palavra boxed nomeia um cabeçalho de um tipo admitido (não enchimento);
   uma palavra de lista nomeia uma célula cons (uma palavra que não é um
   cabeçalho).

Os acessores descodificam o tipo, a contagem e a carga útil a partir do próprio
cabeçalho. `verify()` continua a ser a verificação completa de que cada slot
nomeia o início de um objeto, para os testes.

## Raízes e pontos seguros

`ProcessContext::visit_roots` enumera todas as palavras de raiz para o garbage
collector. Num ponto seguro, nada mais contém palavras do heap do processo:

| Proprietário | Palavras de raiz | Notas |
| --- | --- | --- |
| Slots de termos do frame | Os primeiros `roots` slots de cada frame na pilha | Os frames de base não têm nenhum; os índices de retoma e de bloco de tratamento são inteiros |
| Slots em bruto do frame | Nenhuma | Valores nativos despejados; o código gerado não guarda aí nenhuma palavra do heap num ponto seguro ([regra de recarga](#reload-rule)) |
| Registos | `x[0..live)` (`ProcessStack::keep_registers`) | Os argumentos de uma entrada suspensa; cada push e pop limpa `live` |
| Canal de falhas | Carga útil do erro (`fvalue` da BEAM), lista de argumentos de `erlang:error/2,3`, termo do stack trace | Reatribuídos no local; os frames do trace capturados são ponteiros de descritores para o código |
| Estado de trap | As palavras de termo do `TrapState` de um builtin que faz trap ([porções](builtins.md#portions)) | Libertadas quando o builtin termina ou falha |
| Dicionário do processo | Todas as chaves e valores | Até serem apagados ou o processo terminar |
| Caixa de correio | Todas as mensagens na caixa de entrada de sinais e na fila de mensagens, incluindo as mensagens `'EXIT'` e `'DOWN'` | Até um receive a retirar; reescritas no local, pelo que o cursor do receive (uma posição na lista) e o prazo do timeout permanecem válidos |
| Raízes explícitas | O intervalo que o anfitrião passa a `collect(roots)` | Relidas após a chamada |
| Lista fora do heap | Nenhuma | As ligações são varridas e refeitas, não rastreadas |

Nenhuma célula do heap contém uma fixação. Os átomos são imediatos e a tabela
de átomos nunca é recolhida. As células de fun nomeiam o código através da sua
`FunDefinition` não rastreada, que vive tanto quanto o runtime; os módulos
carregados nunca são descarregados, pelo que nem as funs nem os descritores do
trace precisam de fixação. Os imediatos pequenos não são raízes.

Tal como no código C do ERTS, um `Term` do anfitrião é uma palavra em bruto com
etiqueta, válida até ao ponto seguro seguinte do seu heap; não fixa o
armazenamento do heap ([posse](terms.md#ownership)). Um `Term` só é válido
dentro do seu próprio processo; os outros processos só o podem ler.

O heap só se move num ponto seguro, e nunca enquanto houver uma reserva aberta:

- um `collect()` explícito do anfitrião enquanto o contexto não executa código
  gerado;
- um `collect()` enquanto o código gerado em execução declarou um âmbito
  `SafePoint`, prometendo que só contém palavras do heap nas raízes acima. O
  runtime só abre um nos safepoints do código gerado da secção seguinte.

Qualquer outro pedido devolve `unsafe_point` e não altera nada, nem sequer o
canal de falhas de uma chamada gerada em execução. A alocação nunca move o
heap: um pedido que não cabe cria um fragmento.

## Buffers de mensagens

Um `MessageBuffer`
([message_buffer.hpp](../runtime/src/memory/message_buffer.hpp)) mantém um
termo fora de todos os processos: `copy_of` copia o grafo do heap do seu
processo para um `HeapStorage` próprio (com o seu próprio token de tempo de
vida, os átomos e a conta de memória do runtime, e os binaries fora do heap
partilhados e detidos), com o mesmo `GraphCopy` que um envio usa; `copy_to`
copia-o para o heap de um recetor. Os imediatos não precisam de armazenamento.
O buffer nunca é recolhido e é libertado com o seu último proprietário; o seu
bloco tem exatamente as palavras do termo, seja qual for o heap mínimo do
remetente. As mensagens para um processo em execução noutro worker
([workers](processes.md#workers)), as mensagens dos temporizadores, as
etiquetas de monitores e os [termos persistentes](runtime.md#persistent-terms)
usam-no, pelo que nunca são recodificados.

**Entrega de mensagens.** Um envio cuja mensagem ocupa pelo menos
`MessageBuffer::ADOPTED_WORDS` (512) palavras, contadas por um percurso
limitado que para aí, constrói o buffer antes de obter o bloqueio do executor,
pelo que o remetente não detém nenhum bloqueio durante a cópia. O recetor toma
então posse do buffer em vez de o copiar (`MessageBuffer::take`,
`HeapStorage::adopt`), quando o buffer não tem outro proprietário e o recetor
tem um bloco de heap e nenhum orçamento: o bloco junta-se aos seus fragmentos
nos mesmos endereços, as listas de binaries fora do heap e de maps do buffer
juntam-se às suas com as respetivas cobranças, e o buffer fica vazio. Ninguém
mais pode alcançar o bloco antes ou depois, pelo que nenhuma palavra é copiada
duas vezes. Os fragmentos adotados só pedem uma recolha quando as suas palavras
atingem as do bloco jovem, como fazem os fragmentos de mensagens do ERTS, e a
recolha seguinte trata-os como dados jovens. As mensagens mais pequenas são
copiadas, como antes: é mais barato do que um fragmento para cada uma.

## Recolha no código gerado

O código gerado só faz a recolha em alguns **safepoints** onde cada termo vivo
já está numa raiz. Tudo o resto, incluindo cada serviço que aloca, é uma
**secção crítica** que nunca move o heap.

### Gatilhos

Um safepoint faz a recolha quando o heap a pede (`wants_collection()`); caso
contrário, custa uma verificação.

| Gatilho | Condição no safepoint | Equivalente no ERTS |
| --- | --- | --- |
| Heap cheio | Existe algum fragmento: uma alocação não coube no bloco do heap desde a última recolha | O topo do heap atinge o fim do heap |
| Pressão dos binaries fora do heap (uma recolha menor, a não ser que a última tenha libertado menos de metade, [pressão dos binaries](#generations)) | As palavras fora do heap atingem o limite do heap binário virtual: 46 422 palavras de início, após cada recolha o dobro das palavras fora do heap sobreviventes ou os sobreviventes mais as palavras vivas do heap, o que for maior (nunca menos de 46 422), mas no máximo os sobreviventes mais metade do orçamento deixado livre após o bloco do heap | `bin_vheap_sz` / heap binário virtual |
| `erlang:garbage_collect/0,1,2` | Um pedido do builtin ([introspeção](processes.md#introspection)), atendido no safepoint seguinte do destino | Varredura completa explícita |

Um safepoint executa uma **recolha menor**, a não ser que seja devida uma
varredura completa: um pedido de `garbage_collect`, pressão dos binaries fora
do heap, um orçamento de heap, ou uma área antiga sem espaço para as palavras
maduras ([gerações](#generations)). O `ProcessHeap::collect` público é sempre
uma varredura completa.

O novo bloco é dimensionado para as palavras vivas **mais as palavras da pilha
em uso** (o ERTS mantém a pilha dentro do bloco do heap): uma pilha profunda
obtém um heap maior, pelo que uma recursão longa faz a recolha em proporção à
sua alocação, em vez de voltar a percorrer toda a pilha a cada poucas centenas
de palavras.

### Safepoints

| Ponto | Onde | Vivo fora dos slots de termos do frame |
| --- | --- | --- |
| Entrada de função | Em `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (e portanto na invocação pelo anfitrião), antes de o frame do chamado ser empilhado; uma entrada inline segue este caminho sempre que o heap pede uma recolha | Os argumentos do chamado `x[0..arity)`, mantidos como raízes (`keep_registers`) |
| Início de ciclo | `CLAUSE_safepoint_v1(context)` no início de cada ciclo de gerador de comprehension, chamado apenas enquanto o heap pede uma recolha | Nada |

Cada ciclo Erlang é ou uma recursão, que passa por uma entrada de função em
cada passo, ou uma comprehension, que passa pelo seu início de ciclo, pelo que
o lixo entre dois safepoints é limitado por código linear e por resultados
individuais de serviços.

Não são safepoints (secções críticas, que continuam a alocar em fragmentos):
todos os outros serviços do runtime, incluindo os serviços de alocação,
construção e correspondência; `CLAUSE_return_v1`; a propagação de exceções; e
a entrega de mensagens. Os serviços podem, portanto, manter palavras do heap em
bruto em C++ durante toda a sua execução, e os seus arrays de entrada e as suas
saídas não precisam de recarga.

### Processos em espera e suspensos

Um processo que não está em execução nunca é recolhido: está à espera num
receive, em fila após uma cedência (yield) ou um trap, ou ainda não foi
iniciado, e tudo o que contém já é uma raiz (os seus frames, os registos da
entrada ou da continuação em que irá retomar, o estado de trap e as suas
mensagens). As mensagens que lhe são enviadas são copiadas para fragmentos do
seu heap. Cada entrega acorda um processo em espera, e retomá-lo repete a
entrada da sua continuação (o builtin de espera, uma continuação de trap ou a
função em que cedeu), o que é um safepoint de entrada de função: a primeira
coisa que um processo retomado faz é a recolha, quando o seu heap a pede. Um
processo à espera num receive seletivo que salta muitas mensagens faz, por
isso, a recolha à medida que elas chegam, tal como o ERTS faz a recolha de um
processo quando este é escalonado a seguir. O golden
`executables_mailbox_collection` cobre a acumulação, a espera com timeout, a
recursão profunda sob carga de mensagens e um consumidor que confirma 3000
mensagens dentro de `--max-heap 65536`.

A alocação não é um safepoint (ao contrário do `test_heap` da BEAM): isso
exigiria que cada entrada de serviço e cada termo SSA vivo através de qualquer
alocação estivesse numa raiz, uma recarga após cada serviço que aloca e um
protocolo de nova tentativa em cada serviço, enquanto os dois safepoints acima
já limitam o lixo.

### Regra de recarga

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
- A otimização é executada após `lower_frames` e não pode substituir uma
  recarga pelo valor SSA mais antigo: o endereço do frame é carregado do
  `FrameState` do contexto, e a chamada opaca do safepoint pode escrever em
  qualquer slot através dele ([protótipo](#prototype)).

### Comportamento em caso de falha

- Uma recolha num safepoint nunca regista uma falha. Quando o seu novo bloco
  não pode ser alocado (`out_of_memory`), o heap fica como está e a execução
  continua com fragmentos.
- **Esgotamento da memória.** Sem limite, a memória só se esgota quando o
  anfitrião recusa um bloco de heap, um fragmento, um buffer fora do heap ou o
  crescimento da pilha: `out_of_memory`. Com um orçamento opcional ou um
  [limite global do runtime](#runtime-memory-limit) definido, um pedido para
  além dele dá `limit_exceeded`, comunicado como `resource_limit`. Ambos são
  falhas de infraestrutura: nenhum bloco de tratamento é executado, os frames
  desenrolam até ao frame de base e um programa imprime
  `clau: runtime failure: entry call failed: <status>` e termina com o código
  70 depois de despejar o stdout e destruir o processo
  ([executáveis](executables.md#exit-status), [diferenças](differences.md)).
  Como cada recolha mantém livre metade do orçamento que resta após os seus
  sobreviventes ([dimensionamento](#sizing-and-budget), [gatilhos](#triggers)),
  um orçamento só falha quando o conjunto vivo deixa de caber ou quando o
  código linear entre dois safepoints aloca mais do que essa metade; o lixo é
  recolhido primeiro.

### Implementação

- `ProcessStack::safepoint(live)` pergunta a `ProcessHeap::wants_collection()`
  (existe um fragmento, as palavras fora do heap atingiram
  `binary_limit_words_`, ou foi pedida uma recolha), mantém `x[0..live)` como
  raízes, abre um `SafePoint` e faz a recolha; uma recolha falhada é ignorada.
  `enter` (e portanto `tail` e `invoke`) chama-o com a aridade do chamado antes
  de empilhar; `CLAUSE_safepoint_v1` chama-o com 0.
- O rebaixamento (lowering) das comprehensions emite a verificação de início de
  ciclo no início de cada ciclo de gerador (`lowering_comprehensions`).
- `lower_frames` divide cada corpo após uma chamada de safepoint e despeja os
  valores que a atravessam como após uma chamada. Os argumentos chegam em
  registos e não são guardados à entrada: um argumento que atravessa uma
  chamada ou um safepoint é guardado no seu próprio slot de argumento depois de
  chegar. `home()` mantém o slot do argumento ou um slot de termo do mesmo
  bloco quando um deles contém o valor; caso contrário, um valor de termo
  (`term_value`: carregado de um slot de termo ou registo, guardado num slot de
  termo, ou um PHI destes) recebe um novo slot de termo, que `place_slots`
  acrescenta aos slots de termos iniciais, antes dos slots em bruto, e qualquer
  outro valor um slot em bruto.
- `collected_size` limita o bloco a `block_limit(live)`; `shrink` também é
  executado quando o bloco excede o limite das palavras sobreviventes;
  `collect` limita `binary_limit_words_` aos sobreviventes mais metade do
  orçamento deixado livre após o bloco.
- Cobertura: os goldens OTP `executables_garbage_collection` (mais de 64 MiB
  alocados com um conjunto vivo pequeno: ciclos de cauda, binaries fora do
  heap, filtros de comprehension que alocam, recursão profunda no corpo, uma
  carga útil de erro capturada; com execuções limitadas sob `--max-heap`,
  `--max-stack` e `--max-memory`) e `executables_heap_growth` (72 MB de
  binaries retidos); `runtime_collection` `near_budget` e `shared_limit`
  verificam o orçamento e o limite global do runtime.

### Protótipo

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) contém um ciclo ao
estilo de uma comprehension na forma posterior a `lower_frames` (`loop.ll`): um
termo `Y` calculado antes do ciclo é guardado num slot de termo e recarregado
após o safepoint do início de ciclo. `python tests/prototypes/safepoint/run.py`
compila-o para `x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu`,
`i686-pc-windows-msvc` e `armv7-unknown-linux-gnueabihf` em O0 e O2 e verifica
que um carregamento da palavra do frame de `Y` se segue à chamada do
safepoint, pelo que o otimizador nunca reutiliza o registo que continha `Y`.

## Recolha

Uma cópia de Cheney (`memory/heap_collect`), uma varredura completa ou uma
recolha menor ([gerações](#generations)): aloca primeiro o novo bloco (a falha
é `out_of_memory` e deixa o heap intacto), depois marca os `Term`s do
anfitrião como obsoletos, copia o objeto por trás de cada palavra de raiz e
percorre o novo bloco da esquerda para a direita, copiando os filhos de cada
cópia. O cabeçalho de um objeto boxed movido é substituído por um ponteiro
boxed para a sua cópia; uma célula cons movida recebe uma cabeça a zero e uma
cauda que aponta para a sua cópia. O reencaminhamento preserva a partilha. As
raízes são reescritas no local, a lista fora do heap é varrida (cópias
religadas pela ordem da lista, células mortas destruídas), e o bloco antigo e
os fragmentos são libertados. Um heap que nunca foi alocado não é recolhido.
`CollectionStats` indica as palavras antes, as palavras vivas, o novo bloco do
heap, os fragmentos fundidos, a capacidade de slots da pilha e as palavras fora
do heap.

## Gerações

Recolha geracional, como a faz o ERTS, sem a sua barreira de escrita:

- **Marca de nível máximo (high-water mark).** Após uma recolha, cada objeto
  no novo bloco sobreviveu a uma; o topo do bloco torna-se a marca de nível
  máximo. A recolha menor seguinte copia o bloco jovem e os fragmentos,
  **promovendo** os objetos abaixo da marca para a área antiga e os restantes
  para um novo bloco jovem.
- **Área antiga.** Um bloco que nunca se move entre varreduras completas; uma
  recolha menor não o copia nem o percorre. É criado pela primeira recolha
  menor que promove, com o dobro do tamanho das palavras maduras. Quando não
  consegue receber as palavras maduras, o safepoint executa em vez disso uma
  varredura completa, que deixa tudo no novo bloco abaixo da sua marca de nível
  máximo e liberta a área antiga.
- **Invariante.** Um objeto imutável só aponta para objetos mais antigos do
  que ele, pelo que promover por endereço nunca deixa um objeto antigo a
  apontar para um jovem. As escritas no local do runtime mantêm-no: os ciclos
  de binaries e os binaries com acrescento escrevem inteiros, e uma atualização
  de map só altera no local nós criados desde a última recolha. As compilações
  de depuração verificam após cada recolha menor que nenhum objeto antigo
  aponta para o bloco jovem ou para um fragmento.
- **Varreduras.** A lista de binaries fora do heap mantém as células da área
  antiga, volta a ligar as reencaminhadas e liberta as jovens mortas; as
  células antigas mortas esperam pela varredura completa seguinte.
- **Dimensionamento jovem.** Uma recolha menor mantém o tamanho do bloco jovem,
  como faz o ERTS, e pelo menos um oitavo da área antiga (ERTS). O código
  gerado só faz a recolha em safepoints, pelo que a alocação entre dois deles
  (os retornos de uma recursão no corpo) pode transbordar muito para
  fragmentos; quando estes contêm um quarto do bloco ou mais, o bloco seguinte
  cresce na mesma medida e não é reduzido. Caso contrário, um bloco jovem com
  mais de 8000 palavras e menos de 25% de dados vivos é copiado para o triplo
  das suas palavras vivas (a regra menor do ERTS).
- **Limite fora do heap.** Após uma recolha menor, o limite do heap binário
  virtual conta apenas as palavras jovens vivas: a área antiga pode conter
  palavras mortas, que não podem adiar a varredura completa que liberta os
  binaries antigos mortos.
- **Pressão dos binaries.** Atingir o limite recolhe a geração jovem, como faz
  o heap binário virtual do ERTS, o que liberta os binaries das células jovens
  mortas. Quando uma recolha menor deste tipo liberta menos de metade das
  palavras fora do heap, a seguinte por pressão dos binaries é uma varredura
  completa, que liberta também os binaries das células antigas mortas
  (`binary_sweep_due_`).

## Cópia entre heaps

`ProcessHeap::add(value)`, ou equivalentemente `value.copy_to(heap)`, devolve
um termo do heap de destino (`size_object` e `copy_struct` da BEAM). Cada
célula de origem é procurada primeiro na área da anterior, e uma célula cons
não precisa de análise:

- Os imediatos e os átomos do mesmo runtime não precisam de armazenamento, e um
  termo do heap de destino mantém a sua identidade. Um grafo de outro processo
  do mesmo runtime é copiado; o grafo de outro runtime dá `wrong_owner`, uma
  origem expirada `expired_context`, um handle de origem mais antigo do que a
  última recolha do seu heap `stale_term`. As fábricas continuam a recusar
  entradas alheias (`ProcessHeap::retain`), pelo que só uma cópia explícita
  move um grafo.
- As cópias são planas, como o `copy_struct` por omissão do ERTS (sem a sua
  variante opcional que preserva a partilha): um subtermo é copiado uma vez por
  cada caminho que o alcança, pelo que `{T, T}` copia `T` duas vezes, e um
  termo cuja partilha duplica em cada nível cresce exponencialmente, como no
  OTP. Um único percurso com uma pilha explícita (sem recursão) soma as
  palavras de cada objeto alcançado; a cópia é uma única reserva dessa soma, no
  bloco do heap ou num fragmento, preenchida por um segundo percurso pela mesma
  ordem que lê de novo cada célula e aponta cada slot para a cópia do seu
  filho. Nenhuma tabela associa os objetos de origem às cópias, e só as células
  de binaries e os stubs de maps mantêm os seus deslocamentos.
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
acessores verificados, faz a recolha com a lista como única raiz e percorre a
cópia, e cria 1000 contextos, cada um com um tuplo pequeno. Indica os tempos de
construção e de percurso, as palavras do heap usadas e de capacidade, os bytes
laterais (alocações no anfitrião para além do armazenamento do heap) e os bytes
e palavras do heap por contexto.
