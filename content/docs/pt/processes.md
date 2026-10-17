---
source: docs/processes.md
sourceCommit: a8c3f8f6
sourceSha256: c52f95bbde29faed486345896a09dfa1514cba322d235541606d955fe442ac48
translatedAt: 2026-10-17
---
# Processos

## Executor

Um runtime executa os seus processos nos seus workers do escalonador
([workers](#workers), [modelo de execução](execution-model.md)). O arranque faz
da chamada da função de entrada o primeiro processo, o processo principal, e
executa o executor até este terminar:

- Os processos executáveis esperam na fila de execução FIFO (o primeiro a
  entrar é o primeiro a sair) do seu worker ([workers](#workers)). Um worker
  executa o primeiro durante uma fatia de tempo de 4000 reduções (o
  `CONTEXT_REDS` do OTP) e depois coloca-o de novo no fim da sua fila, a menos
  que tenha terminado.
- Cada entrada numa função gasta uma redução: chamadas, chamadas de cauda,
  chamadas de funs e dinâmicas, e builtins. Quando não resta nenhuma, a entrada
  não acontece: o processo regista a função em que estava a entrar, mantém os
  seus argumentos nos seus registos (continuam a ser raízes de recolha) e
  regressa ao executor, que mais tarde o retoma repetindo a entrada
  ([modelo de execução](execution-model.md#operations)). Cada cabeça de ciclo
  de uma comprehension também gasta uma, pelo que um ciclo sem chamadas também
  cede a execução (yield). Os builtins cujo trabalho cresce com um argumento
  lista ou binary correm em porções e cedem a execução entre elas
  ([porções](builtins.md#portions)).
- Cada processo detém o seu heap e a sua pilha. Os argumentos de um novo
  processo são copiados para o seu heap
  ([cópia entre heaps](runtime-heap.md#copying-between-heaps)).
- Um processo termina quando a sua primeira chamada retorna ou lança uma
  exceção. O contexto, o heap e a pilha de um processo terminado são libertados
  de imediato; o seu pid continua a ser um termo válido e `is_process_alive/1`
  devolve false para ele.
- Um processo à espera num `receive` não está em nenhuma fila; um envio para
  ele coloca-o de novo numa fila ([receive](#receive)).
- Quando o processo principal termina, o programa termina com o seu resultado
  ([executáveis](executables.md)): os processos ainda em fila ou em espera são
  libertados sem continuarem a correr, tal como um escript OTP para quando
  `main/1` retorna.
- Um sinal de saída que termine o processo principal termina o programa
  ([sinais de saída](#exit-signals)).
- `erlang:halt/0,1` em qualquer processo termina o programa com o seu código.
  Uma falha do runtime em qualquer processo (memória esgotada, um limite
  opcional excedido, um erro interno) termina o programa como falha do runtime
  (código de saída 70). Uma exceção Erlang termina apenas o processo que a
  lançou ([saídas](#exits)).
- As invocações pelo anfitrião de funções exportadas (`CLAUSE_invoke_v1`)
  executam a sua função no contexto chamador até ao fim, retomando-a depois de
  cada yield sem executar outros processos; os programas iniciados por
  `CLAUSE_main_v1` usam o executor.

## Workers

O executor executa processos em `RuntimeOptions::schedulers` threads de
trabalho (worker threads): a thread que iniciou o programa e mais uma thread
por cada worker adicional. Os programas obtêm o número a partir de
`--schedulers N` (de 1 a 1024,
[opções do runtime](executables.md#runtime-options)); por omissão, um worker
por processador lógico, como o `+S` do OTP.

- Cada worker tem a sua própria fila de execução, como cada escalonador do
  ERTS: um processo fica com o worker em que correu pela última vez, pelo que o
  seu heap permanece nas caches desse núcleo. Um processo lançado começa no
  worker do seu pai. Os workers inativos dormem até um processo entrar na sua
  fila ou haver trabalho para roubar; a thread dos temporizadores coloca na
  fila os processos cujo timeout de receive expira
  ([timeouts de receive](#receive-timeouts)).
- Os processos migram como no ERTS, que equilibra periodicamente as suas filas
  de execução: a cada 4 fatias, um worker compara a sua fila com a do vizinho e
  retira-lhe um processo quando o vizinho tem pelo menos mais dois. Um worker
  com a fila vazia rouba um processo da fila mais longa que tenha pelo menos
  dois, ou o único processo de um worker adormecido, que executa antes de esse
  worker acordar.
- Os despertares são preguiçosos, tal como o ERTS mantém num só escalonador os
  processos que comunicam entre si: um processo em execução que acorde um
  processo de um worker adormecido e com a fila vazia coloca-o na fila do seu
  próprio worker, que o retira quando a sua fatia termina; outro worker só é
  acordado quando uma fila passa a ter mais de um processo. A thread dos
  temporizadores e a de E/S, as tarefas de portas e os workers entre fatias
  colocam um processo na fila do seu próprio worker, ou na de um worker inativo
  quando o seu está ocupado.
- Um único mutex do executor protege as filas de execução, os processos em
  espera, os temporizadores, os nomes registados, as ligações e os monitores de
  todos os processos, e todos os processos que não estão a correr. O heap, a
  pilha, a caixa de correio e o canal de falhas de um processo em execução
  pertencem apenas ao seu worker; o código Erlang corre sem o bloqueio.
- As ligações, os monitores e os nomes mudam de imediato sob o bloqueio, também
  para um processo que esteja a correr noutro lado. Uma mensagem para um
  processo em execução noutro worker ainda não pode entrar no seu heap: é
  copiada para um buffer próprio e entregue, depois das mensagens em buffer
  anteriores, quando a fatia do recetor termina
  ([buffers de mensagens](runtime-heap.md#message-buffers)). Um sinal de saída
  de `exit/2` ou `exit_signal/2` para um processo assim não faz nada e o seu
  processo termina a fatia (`builtins::Blocked`); espera até que a fatia do
  destino termine, depois corre primeiro e repete o builtin com os mesmos
  argumentos. O destino fica retido até lá, pelo que o builtin repetido não o
  pode encontrar de novo em execução. Um processo que termine com ligações ou
  monitores cujos processos correm noutro lado é finalizado da mesma forma
  quando as fatias destes terminam.
- Assim, os sinais mantêm a sua ordem: uma mensagem colocada em buffer antes de
  um sinal de saída bloqueado do mesmo remetente chega primeiro ao recetor, e
  `is_process_alive/1` depois de `exit(Pid, kill)` é false, como o OTP promete
  para os sinais do chamador.
- Um spawn liga ou monitoriza o novo processo (`spawn_link`, `spawn_monitor`)
  antes de qualquer worker o poder executar. Um processo lançado pode correr
  antes de o seu pai prosseguir, pelo que um programa que monitorize ou se
  ligue a um processo de vida curta depois de `spawn/1` pode ver `noproc`, como
  num OTP com vários escalonadores.
- O fim do processo principal, um halt ou uma falha do runtime param o programa
  logo que todos os workers tenham terminado a sua fatia atual; em seguida, os
  outros processos são libertados.
- Os serviços partilhados do runtime são sincronizados
  ([threads](runtime.md#threads)): os átomos, o servidor de código, os números
  de pid e de porta e a conta de memória.
- A saída de processos diferentes intercala-se pela ordem em que as escritas
  acontecem. Cada chamada a `io:format` e `erlang:display` escreve o seu texto
  de uma só vez.

Os despertares e o encerramento não precisam de mais nenhum mecanismo, porque
todas as mudanças do estado de escalonamento de um processo acontecem sob o
mutex do executor:

- Uma mensagem, `'EXIT'` ou `'DOWN'` para um processo em espera coloca-o na
  fila na mesma secção crítica que a entrega, acordando um worker como acima.
  Um processo que ainda esteja na fatia em que começou a esperar não pode
  receber uma mensagem nesse momento (os seus remetentes esperam que a fatia
  termine), pelo que a entrega o encontra sempre estacionado.
- Um worker que não encontre nenhum processo executável dorme até outro worker,
  um envio ou a thread dos temporizadores colocar um na fila, ou até o programa
  terminar. Os workers nunca leem o relógio para os temporizadores; estacionar
  um processo com um timeout anterior a todos os outros acorda apenas a thread
  dos temporizadores.
- Uma mensagem e um timeout a expirar do mesmo receive podem concorrer: o que
  chegar primeiro coloca o processo na fila e cancela o outro, e o receive
  aceita uma mensagem que tenha chegado antes de ele retomar, como faz o do
  OTP.
- Um sinal de saída para um processo em espera, em fila, retido ou bloqueado
  retira-o de onde quer que esteja antes de ser finalizado.
- Quando o programa termina, cada worker termina a sua fatia atual e para;
  `run()` retorna depois de os juntar (join), e todos os outros processos que o
  executor iniciou são libertados, pelo que o runtime encerra sem nenhum
  contexto restante.
- O golden OTP `executables_wakeups` testa isto sob carga com 1, 2, 4 e todos
  os workers: recetores cujos timeouts de 0–2 ms concorrem com as mensagens dos
  seus remetentes, uma cadeia de 16 processos ligados em ciclo ativo terminada
  por um único sinal de saída com todos os membros monitorizados, processos
  monitorizados a terminar enquanto o seu observador acorda, um programa a
  terminar enquanto os processos correm em ciclo, esperam e se inundam
  mutuamente, e um halt noutro processo.

### Timeouts de receive

Os temporizadores vivem numa roda de temporizadores hierárquica com hash
(hierarchical hashed timer wheel), tal como o ERTS os mantém
(`scheduler/timer_wheel`):

- Os ticks são milissegundos desde o arranque do executor. Seis níveis de 64
  slots cobrem 2^36 ticks, mais do que o timeout mais longo (4 294 967 295 ms).
  Um temporizador fica no slot do dígito de 6 bits mais alto em que o seu tick
  difere do tick atual da roda; os slots ocupados são bitmaps por nível.
- Armar (um processo em espera é estacionado) e cancelar (uma mensagem, um
  sinal de saída ou o fim do processo chega primeiro) desligam ou ligam um nó
  de lista intrusiva guardado com o estado de escalonamento do processo: tempo
  constante. Um prazo torna-se o tick igual ou posterior a ele, pelo que nenhum
  timeout dispara antes do tempo.
- Uma thread de temporizadores por execução dorme até ao próximo slot ocupado
  (o primeiro slot ocupado depois do atual em qualquer nível), lê o relógio uma
  vez quando acorda e avança a roda até esse tick: os slots de níveis
  superiores alcançados no seu início descem os seus temporizadores, e o slot
  do nível 0 dispara. Só são consultados os slots cuja hora chegou; os
  processos em espera nunca são percorridos. Os processos expirados são
  colocados na fila pela ordem dos ticks.
- A roda é partilhada pelos workers sob o mutex do executor. `after 0` nunca
  espera e `infinity` nunca arma um temporizador.
- `--profile` indica as fatias de tempo e as leituras do relógio da thread dos
  temporizadores ([profiling](profiling.md)). Os temporizadores só disparam com
  a precisão das esperas temporizadas do anfitrião (no Windows, a resolução do
  temporizador por omissão).
- `runtime_timer_wheel` arma 20 000 temporizadores em todos os níveis, cancela
  90% e avança em passos irregulares: cada temporizador restante dispara uma
  vez, no primeiro avanço que alcança o seu tick, pela ordem dos ticks; nenhum
  cancelado dispara.

## Saídas

Um processo que não seja o principal termina com uma razão de saída, como no
OTP (`detail::exit_reason`, `process/exits`). Os sinais de saída levam-na aos
processos ligados ([ligações](#links)) e as mensagens `'DOWN'` aos que o
monitorizam ([monitores](#monitors)); os relatórios de erro mostram-na.

| Como o processo termina | Razão de saída | Relatório de erro |
| --- | --- | --- |
| A sua primeira chamada retorna | `normal` | Nenhum |
| `exit(Reason)` (também `normal`, `kill`) | `Reason` | Nenhum |
| Um erro (`error/1,2,3`, `badarith`, `{badmatch, V}`, `undef`, ...) | `{Reason, Stack}` | Sim |
| Um `throw(Value)` não capturado | `{{nocatch, Value}, Stack}` | Sim |
| Um sinal de saída termina-o ([sinais de saída](#exit-signals)) | A razão do sinal, `killed` para `exit(Pid, kill)` | Nenhum |

Um relatório de erro é escrito no stderr quando o processo termina, depois de
esvaziar a saída padrão, no formato do handler de logger por omissão do OTP:

```text
=ERROR REPORT==== 8-Oct-2026::03:42:15.983000 ===
Error in process <0.8.0> with exit value:
{boom,[{crash_reports,'-main/1-fun-6-',0,[]}]}

```

O cabeçalho tem a hora local; a razão é disposta como faz `~p`. O processo
principal não escreve nenhum: a sua exceção não capturada é a do programa
([executáveis](executables.md)).

## Mensagens

`Dest ! Msg` e `erlang:send(Dest, Msg)` avaliam primeiro `Dest` e devolvem
`Msg`.

| `Dest` | Efeito |
| --- | --- |
| Um pid de um processo vivo | `Msg` é copiada de forma plana para o heap do recetor ([cópia entre heaps](runtime-heap.md#copying-between-heaps)), como o OTP copia as mensagens, uma grande para um bloco de que o recetor toma posse ([entrega de mensagens](runtime-heap.md#message-buffers)), e acrescentada à sua caixa de entrada de sinais |
| Um pid de um processo que terminou | Nada; o envio tem sucesso |
| Um [nome registado](#registered-names) | Como para o seu pid; `badarg` quando nenhum processo vivo tem o nome |
| `{Name, nonode@nohost}` de dois átomos | Como para o pid registado como `Name`; nada quando não existe nenhum |
| `{Name, Node}` para qualquer outro nó | Nada (não existem outros nós) |
| Uma referência | Como para o dono de um [alias](#aliases) ativo; nada caso contrário |
| Qualquer outra coisa | `badarg` |

- As mensagens de um remetente chegam pela ordem em que ele as enviou; um envio
  para si próprio é uma mensagem como qualquer outra.
- Cada mensagem é uma raiz de recolha do seu recetor até um receive a aceitar
  ([heap do runtime](runtime-heap.md#roots-and-safe-points)).
- A caixa de correio do recetor (`Mailbox`) mantém uma caixa de entrada de
  sinais, à qual os envios acrescentam, e uma fila de mensagens que o receive
  percorre a partir de uma posição guardada: as mensagens chegadas passam para
  trás da fila quando um receive as examina.
- Quando o heap do recetor recusa a cópia (um limite opcional como
  `--max-heap`, ou o anfitrião sem memória), nada é entregue e o processo
  remetente falha como falha do runtime (código de saída 70), como qualquer
  processo que exceda um limite.

## Receive

`receive` seleciona entre as suas cláusulas como `case`, sobre as mensagens da
caixa de correio:

- O percurso da caixa de correio começa na mensagem mais antiga. Cada mensagem
  é comparada com as cláusulas por ordem (padrões e guards, que podem ler
  associações de variáveis de antes do `receive`); a primeira mensagem que
  alguma cláusula aceita é removida e o corpo dessa cláusula é executado. As
  mensagens que nenhuma cláusula aceita ficam na caixa de correio pela sua
  ordem; o receive seguinte começa de novo na mensagem mais antiga.
- Quando todas as mensagens foram examinadas, o processo espera
  (`CLAUSE_wait_frame_v1`, um builtin em que se entra como numa chamada): sai
  da fila de execução até um envio lhe entregar uma mensagem, e então o
  percurso continua com as mensagens chegadas. Os processos em espera mantêm os
  seus frames e mensagens como raízes de recolha e fazem a recolha quando são
  retomados
  ([processos em espera](runtime-heap.md#waiting-and-suspended-processes)).
- Os nomes associados em todas as cláusulas, e no corpo de `after` quando
  existe, são exportados depois do `receive`, como para `case`; uma chamada em
  posição de cauda no corpo de uma cláusula ou de `after` é uma chamada de
  cauda, pelo que um ciclo de servidor corre em pilha constante.
- `after T -> Body`: `T` é avaliado primeiro, antes do percurso. Quando o
  receive fosse esperar, `T` tem de ser `infinity` ou um inteiro em
  0..4294967295 (milissegundos), caso contrário `error:timeout_value`, após o
  que o receive seguinte percorre a partir da mensagem mais antiga; uma
  mensagem que é aceite de imediato nunca o verifica, como no OTP. `after 0`
  executa `Body` assim que todas as mensagens tenham sido examinadas. Um
  timeout finito começa quando o receive espera pela primeira vez e não é
  reiniciado por mensagens que não correspondem a nenhuma cláusula; quando
  expira, `Body` é executado a partir das associações de variáveis anteriores
  ao receive e o receive seguinte percorre a partir da mensagem mais antiga.
  Uma mensagem que chegue antes de o timeout expirar é aceite. Um receive só
  com `after` é uma pausa (o idioma de `timer:sleep/1`).
- Código gerado: uma cabeça de ciclo espreita a mensagem seguinte ainda não
  examinada (`CLAUSE_receive_v1` `peek`, para um slot de raiz), a seleção de
  cláusulas aceita uma mensagem correspondente (`take`) antes do seu corpo ou
  salta uma não correspondente (`skip`) e repete o ciclo; sem mensagens
  restantes, o ciclo entra na espera com o timeout, que responde `true`
  (percorrer de novo) ou `false` (timeout expirado: `restart`, depois o corpo
  de `after`).
- O executor mantém um temporizador por cada processo em espera com um timeout
  finito numa roda de temporizadores
  ([timeouts de receive](#receive-timeouts)): um que expire coloca o processo
  de novo na fila. Os timeouts são medidos num relógio monotónico em
  milissegundos e nunca disparam antes do tempo.
- Quando todos os processos esperam sem timeout por uma mensagem que nada pode
  enviar, o programa espera para sempre, como faz o do OTP. Uma invocação pelo
  anfitrião (`CLAUSE_invoke_v1`) que fosse esperar falha antes com `busy`:
  nenhum outro processo corre durante ela.

## Ligações

Uma ligação (link) liga dois processos nos dois sentidos (`Signals` em cada
contexto: os pids ligados por ordem de ligação e o indicador `trap_exit`).

- `link(Pid)` liga o chamador a um processo vivo e devolve `true`; ligar-se a
  si próprio ou ligar de novo não faz nada. Para um processo que terminou,
  lança `error:noproc` ou, quando o chamador captura saídas, devolve `true` e
  envia ao chamador `{'EXIT', Pid, noproc}`, como faz o `link/1` local do OTP.
- `unlink(Pid)` remove a ligação de ambos os lados; a ligação não tem efeito
  depois de retornar. Devolve `true` também quando não havia ligação.
- `spawn_link/1,3` ligam o novo processo ao chamador antes de ele correr.
- Quando um processo termina, cada processo ligado recebe um sinal de saída com
  a sua razão de saída ([saídas](#exits)) e a ligação desaparece. Os processos
  ligados são sinalizados pela ordem em que as ligações foram feitas.

## Monitores

Um monitor é unidirecional: o processo que monitoriza detém-no (por referência,
em `Signals`) e o processo monitorizado guarda a referência e o pid do
monitorizador, para poder enviar a mensagem quando terminar.

- `monitor(process, Pid)` devolve uma nova referência. Quando o processo
  termina, o chamador recebe `{'DOWN', Ref, process, Pid, Reason}` com a sua
  razão de saída ([saídas](#exits)); para um processo que já terminou, recebe a
  mensagem de imediato com a razão `noproc`. Monitorizar-se a si próprio não
  cria nada. Cada chamada cria um monitor separado com a sua própria mensagem;
  as mensagens de um processo saem pela ordem em que os monitores foram
  criados.
- `demonitor(Ref)` para o monitor: depois disso não chega nenhum `'DOWN'` dele.
  Devolve `true`, também para uma referência que não seja um monitor ativo do
  chamador.
- `demonitor(Ref, Options)`: `info` devolve se o monitor ainda estava ativo;
  `flush` remove a mensagem `{_, Ref, _, _, _}` mais antiga quando não estava
  (o seu `'DOWN'` já está na caixa de correio), como faz o OTP.
- `spawn_monitor/1,3` devolvem `{Pid, Ref}`, sendo o monitor criado antes de o
  novo processo correr.
- Um processo que termina descarta os monitores que detém.
- `monitor(process, Name)` e `monitor(process, {Name, nonode@nohost})`
  monitorizam o processo registado como `Name` (`noproc` de imediato quando não
  existe nenhum); o seu `'DOWN'` indica `{Name, nonode@nohost}` em vez do pid.
  `{Name, Node}` para outro nó dá `badarg`.
- `monitor(port, Port | Name)` monitoriza uma porta
  ([portas](ports.md#port-table-and-ownership)):
  `{'DOWN', Ref, port, Port, Reason}` quando ela fecha. Um pid para `port`, ou
  uma porta para `process`, dá `badarg`.

## Nomes registados

O executor mantém uma tabela de nomes (átomos) para pids, e cada processo o seu
próprio nome (`Signals::name`).

- `register(Name, Pid)` dá um nome a um processo vivo: `badarg` para
  `undefined`, um nome em uso, um processo que já tem nome, um processo que
  terminou, ou um `Pid` que não seja um pid. Um processo pode registar-se a si
  próprio.
- `unregister(Name)` liberta o nome (`badarg` quando nenhum processo o tem);
  `whereis(Name)` é o pid ou `undefined`; `registered()` lista os nomes pela
  ordem da tabela de átomos (a ordem do OTP também não é especificada).
- O nome de um processo é libertado quando ele termina, antes de as suas
  ligações e monitores serem sinalizados, pelo que um recetor de `'DOWN'` ou
  `'EXIT'` pode registar o nome de novo, como no OTP.

## Dicionário do processo

`put/2`, `get/0,1`, `get_keys/0,1` e `erase/0,1` comportam-se como no OTP:
`put/2` e `erase/1` devolvem o valor anterior ou `undefined`, `erase/0` devolve
todos os `{Key, Value}` e esvazia o dicionário, e as chaves correspondem por
igualdade exata (`1` e `1.0` são duas chaves).

- Cada processo tem o seu próprio dicionário; um processo lançado começa vazio.
- As entradas são palavras do heap do processo mantidas em `ProcessDictionary`
  ([process_dictionary.hpp](../runtime/include/process_dictionary.hpp)) e
  visitadas como raízes de recolha
  ([raízes](runtime-heap.md#roots-and-safe-points)); são libertadas com o
  processo.
- A ordem de `get/0` e `get_keys/0,1` não é especificada, como no OTP. A
  pesquisa percorre as entradas linearmente; as chaves imediatas comparam-se
  pela palavra. `put/2`, `get/1` e `erase/1` recebem e devolvem as palavras das
  entradas tal como estão, sem admitir nenhum termo.

## Temporizadores

`start_timer/3,4` e `send_after/3,4` (`builtins/erlang/timers.cpp`,
`scheduler/timers.cpp`) armam um temporizador na roda do executor (a mesma que
os [timeouts de receive](#receive-timeouts) usam) que envia `Msg`, ou
`{timeout, TimerRef, Msg}`, para um pid ou nome registado quando dispara.

- A mensagem é copiada quando o temporizador arranca para um `MessageBuffer`
  ([buffers de mensagens](runtime-heap.md#message-buffers)), um bloco de heap
  próprio do temporizador, e copiada de novo para o heap do recetor quando
  dispara, como copia um envio: qualquer termo, incluindo funs locais, viaja
  inalterado.
- Um recetor em execução num worker recebe a mensagem quando a sua fatia
  termina. Um nome registado é resolvido quando o temporizador dispara; um nome
  que ninguém detém, ou o pid de um processo terminado, descarta a mensagem. Os
  temporizadores enviados a um pid são libertados quando esse processo termina.
- O tempo são milissegundos relativos em 0..2^49-1, ou, com `{abs, true}`, um
  `erlang:monotonic_time(millisecond)` absoluto; qualquer outra coisa é
  `badarg`. Um prazo para além do alcance da roda é armado de novo quando esse
  slot chega.
- `cancel_timer/1,2` e `read_timer/1,2` devolvem os milissegundos restantes ou
  `false`; `{async, true}` devolve `ok` e envia `{cancel_timer, Ref, Left}`
  (`{read_timer, ...}`), `{info, false}` devolve `ok` sem resultado.

## Introspeção

`process_info/1,2` (`builtins/erlang/introspection.cpp`,
`scheduler/introspection.cpp`) lê outro processo sob o bloqueio do executor e
copia os seus termos (mensagens, dicionário) para o heap do chamador; um
processo em execução noutro worker é lido quando a sua fatia termina. Um pid
sem processo vivo dá `undefined`.

- Itens: `registered_name` (`[]` sozinho quando não registado), `status`
  (`running`, `runnable`, `waiting`), `message_queue_len`, `messages`, `links`,
  `monitors`, `monitored_by`, `dictionary`, `trap_exit`, `group_leader`,
  `heap_size`, `total_heap_size`, `stack_size`, `memory` (palavras do heap, dos
  seus fragmentos e binaries fora do heap, e da pilha), `reductions` (0),
  `priority` (`normal`), `error_handler`, `garbage_collection`.
  `process_info/1` lista-os de `status` a `garbage_collection`.
- Os itens do OTP que o Clause não mantém (`current_function`, `initial_call`,
  `current_stacktrace`, ...) lançam `error:{notsup, Item}`; os itens
  desconhecidos são `badarg`.
- `processes/0` lista os pids vivos por ordem de criação. Um processo lançado
  herda o group leader do seu pai; o primeiro processo é o seu próprio líder.
  `group_leader/2` de um pid sem processo vivo é `badarg`.
- `garbage_collect/0,1,2` pede uma recolha no próximo safepoint do destino e
  devolve `true` (`false` sem processo vivo); com `{async, RequestId}` devolve
  `async` e envia `{garbage_collect, RequestId, Result}`. `yield/0` termina a
  fatia de tempo na entrada de função seguinte.

## Opções de spawn

Código-fonte: `builtins/erlang/spawning.cpp`, `scheduler/aliases.cpp`.

- `spawn_opt/2..5` aceitam `link`, `monitor`, `{monitor, MonitorOptions}` e as
  opções de afinação `{priority, P}`, `{fullsweep_after, N}`,
  `{min_heap_size, N}`, `{min_bin_vheap_size, N}`, `{max_heap_size, S}`,
  `{message_queue_data, M}`, `{async_dist, B}`; `{min_heap_size, N}` define o
  [heap mínimo](runtime-heap.md#sizing-and-budget) do filho, e as outras opções
  de afinação são verificadas e aceites, não aplicadas. Um nó que não seja
  `nonode@nohost` é `badarg`.
- `spawn_request/1..5` lança de imediato e envia `{Tag, ReqId, ok, Pid}`
  (`{Tag, ReqId, error, Reason}` em caso de falha, `badopt` para uma opção
  inválida) conforme pedem `{reply_tag, Tag}` e
  `{reply, yes | no | error_only | success_only}`; com `monitor`, o id do
  pedido é a referência do monitor. `spawn_request_abandon/1` devolve `false`:
  a resposta já foi enviada.
- `hibernate(M, F, A)` espera até a caixa de correio conter uma mensagem e
  depois chama `M:F(A...)` em vez da chamada; a pilha é mantida, pelo que o
  resultado regressa ao chamador.

## Aliases

Um alias é uma referência para a qual se podem enviar mensagens
(`Alias ! Msg`): `alias/0,1` (`explicit_unalias`, ou `reply` para uma
mensagem), ou um monitor criado com
`{alias, explicit_unalias | demonitor | reply_demonitor}` de `monitor/3`
(`demonitor` termina com o monitor, `reply_demonitor` também termina o monitor
na sua primeira mensagem). `unalias/1` termina um alias do chamador. Um envio
para uma referência que não é um alias ativo, ou cujo dono terminou, é
descartado. Um alias `reply` só é consumido quando a sua mensagem é entregue,
depois de qualquer espera por um dono ocupado. `{tag, Tag}` de `monitor/3`
substitui `'DOWN'` na mensagem do monitor; os monitores de portas não aceitam
opções.

## Nós

Um programa Clause é um único nó não distribuído, `nonode@nohost`, e responde
como um nó OTP desse tipo (`builtins/erlang/node.cpp`): `nodes/0` é `[]`,
`nodes(this | known)` `[nonode@nohost]`, os outros tipos `[]`; `nodes/2` dá
`{nonode@nohost, #{connection_id => undefined, node_type =>
this}}` para as chaves pedidas. `is_alive/0` é `false`, `monitor_node/2,3`
lançam `error:notalive` e `disconnect_node/1` devolve `ignored`.

## Sinais de saída

Cada sinal de saída provém de um processo em execução (`exit/2`,
`exit_signal/2`, `link/1`) ou do fim de um processo. O executor atua sobre ele
de imediato quando o seu destino não está a correr noutro worker, caso
contrário quando a fatia do destino tiver terminado ([workers](#workers),
`scheduler/signals`): um destino terminado sai da fila de execução ou da sua
espera e é finalizado (as suas ligações sinalizadas, o seu relatório de erro
escrito, o seu contexto libertado) antes de o builtin que enviou retornar. Uma
cadeia longa de ligações termina processo a processo, sem recursão.

| Sinal num processo | Sem capturar saídas | A capturar saídas |
| --- | --- | --- |
| `exit(Pid, kill)`, `exit_signal(Pid, kill)` | Termina com a razão `killed` | Termina com a razão `killed` |
| Razão `normal` (de uma ligação, ou enviada a outro processo) | Nada | Mensagem `{'EXIT', From, normal}` |
| `exit(self(), normal)` | Termina com a razão `normal` (peculiaridade do OTP) | Mensagem `{'EXIT', Self, normal}` |
| `exit_signal(self(), normal)` | Nada | Mensagem `{'EXIT', Self, normal}` |
| Qualquer outra razão, incluindo `kill` de uma ligação | Termina com essa razão | Mensagem `{'EXIT', From, Reason}` |

- `process_flag(trap_exit, Bool)` define a captura e devolve a definição
  anterior (inicialmente `false`); `process_flag(min_heap_size, N)` define o
  [heap mínimo](runtime-heap.md#sizing-and-budget) a partir da recolha seguinte
  e devolve o anterior.
- Um processo terminado por um sinal que enviou a si próprio
  (`exit(self(), kill)`) desenrola-se para além de todos os `catch`, handlers
  de `try` e corpos de `after`: o sinal não é uma exceção (`CallError::exited`
  no canal de falhas).
- `exit/2` e `exit_signal/2` devolvem `true`; para um processo que terminou não
  fazem nada. Um destino que seja uma referência também não faz nada, mesmo um
  [alias](#aliases) ativo.
- Um sinal de saída que termine o processo principal termina o programa como um
  `exit` não capturado ([código de saída](executables.md#exit-status)): a razão
  `normal` sai com 0.
- Quando o heap do recetor recusa uma razão de saída ou uma mensagem `'EXIT'`,
  o recetor falha como falha do runtime (código de saída 70).

## Portas

As portas estão especificadas em [portas](ports.md): uma porta está ligada a
quem a abriu, participa em ligações, monitores, sinais de saída e nomes
registados como um processo, e comunica com o seu processo conectado através
de mensagens.

## Builtins

| Builtin | Comportamento |
| --- | --- |
| `spawn(Fun)` | `badarg` a menos que `Fun` seja um fun; caso contrário, um novo processo chama `Fun()`, lançando `{badarity, {Fun, []}}` nesse processo para outra aridade |
| `spawn(M, F, Args)` | `badarg` a menos que `M` e `F` sejam átomos e `Args` uma lista própria; caso contrário, um novo processo chama `M:F(Args...)`, lançando `undef` nesse processo quando nenhum módulo a exporta e nenhum builtin tem esse nome |
| `spawn_link(Fun)`, `spawn_link(M, F, Args)` | Como `spawn`, e o novo processo é ligado ao chamador ([ligações](#links)) |
| `is_process_alive(Pid)` | `badarg` a menos que `Pid` seja um pid; true enquanto o seu processo não tiver terminado |
| `spawn_monitor(Fun)`, `spawn_monitor(M, F, Args)` | Como `spawn`, devolvendo `{Pid, Ref}` de um novo [monitor](#monitors) |
| `link(Pid)`, `unlink(Pid)` | `badarg` a menos que `Pid` seja um pid ([ligações](#links)) |
| `monitor(process, Item)` | `badarg` para outro tipo ou item; uma referência ([monitores](#monitors)); `Item` é um pid ou um nome registado |
| `register(Name, Pid)`, `unregister(Name)`, `whereis(Name)`, `registered()` | Ver [nomes registados](#registered-names); `Name` tem de ser um átomo |
| `demonitor(Ref)`, `demonitor(Ref, Options)` | `badarg` a menos que `Ref` seja uma referência e `Options` uma lista própria de `flush` e `info` |
| `exit(Dest, Reason)`, `exit_signal(Dest, Reason)` | `badarg` a menos que `Dest` seja um pid ou uma referência; `true` depois do [sinal de saída](#exit-signals) |
| `process_flag(trap_exit, Bool)`, `process_flag(min_heap_size, N)` | A definição anterior; `badarg` para outro indicador, um não booleano ou um tamanho negativo ou não inteiro |
| `erlang:send(Dest, Msg)`, `Dest ! Msg` | `Msg`, depois de a enviar ([mensagens](#messages)); `send/2` não é importado automaticamente |

O novo processo junta-se ao fim da fila do worker do seu pai
([workers](#workers)); `spawn` devolve o seu pid de imediato.
