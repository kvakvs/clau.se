---
source: docs/ports.md
sourceCommit: 06042fa
sourceSha256: ffc81af5614a310568c39bb585031013ebcf0a5b801da59a58e2b7fa8ef0fa3c
translatedAt: 2026-10-09
---
# Portas

Decisão do plano 11, step 57A (2026-10-08). Substitui a decisão do step 53
(sem portas, [processos](processes.md#ports)): os programas obtêm portas tal
como o OTP as define, e a E/S externa passa por elas. Os steps 57B–57F
implementam-na; cada secção indica o seu step. Este contrato fixa a
representação, o modelo de drivers e a thread de E/S antes de qualquer
código-fonte poder abrir uma porta.

Implementado: as identidades, a tabela de portas, os builtins e as mensagens
de portas, as ligações, os monitores, os nomes e os sinais de saída das
portas, e as portas `fd` só de saída (step 57B,
`runtime/src/scheduler/ports.cpp`, `runtime/src/builtins/ports.cpp`,
`runtime/src/ports/`; golden OTP `executables_port_identities`); a thread de
E/S e a entrada de portas `fd` com enquadramento em fluxo, por pacotes e por
linhas (step 57C, `runtime/src/ports/io*.cpp`; golden OTP
`executables_port_input`); as portas de subprocessos, `os:type/0`,
`os:getenv/1` e `os:cmd/1` (step 57D, `runtime/src/ports/spawn*.cpp`,
`library/stdlib/os.erl`; golden OTP `executables_port_spawn`); o driver de
ficheiros, o subconjunto `file` da biblioteca e a entrada padrão através de
`io:get_line`/`io:get_chars` (step 57E, `runtime/src/ports/file.cpp`,
`library/stdlib/{file,io}.erl`; golden OTP `executables_file_io`); os sockets
(step 57F, golden OTP `executables_sockets`); uma única thread de E/S
orientada a eventos para todos os tipos de portas (step 57G1,
`runtime/src/ports/reactor.cpp`; golden OTP `executables_many_ports`, teste do
runtime `runtime_port_io`); as tarefas de portas nos workers do escalonador
(step 57G2, `runtime/src/scheduler/ports.cpp`; golden OTP
`executables_port_fairness`); as portas ocupadas e a entrada limitada
(step 57G3; goldens OTP `executables_busy_ports`, `executables_slow_owner`).

## Identidade

- Uma porta é uma palavra imediata: etiqueta `0x7` (`TermKind2::port` sob a
  etiqueta primária `see_termkind2`, ao lado do `0x3` dos pids), com payload
  igual a um número de porta de uma sequência única por processo do sistema,
  nunca reutilizada, como os números de pid
  ([pids](terms.md#pids-and-references)). Um runtime só admite os números que
  emitiu; as palavras de porta forjadas ou estrangeiras são rejeitadas.
- Impressão: `#Port<0.N>`; `port_to_list/1` dá esse texto e `list_to_port/1`
  interpreta-o (badarg para qualquer outra coisa).
- Ordem: números < átomos < referências < funs < portas < pids < tuplos, como
  no OTP; as portas comparam-se pelo número.
- A identidade de uma porta fechada continua válida: `is_port/1` continua a
  ser true, `port_info/1,2` respondem `undefined` e os envios para ela são
  descartados.
- As portas são imediatas, pelo que a cópia, a recolha e as mensagens não
  precisam de nada de novo.

## Tabela de portas e propriedade

- Cada runtime mantém uma tabela de portas (número → porta) no seu executor,
  protegida pelo mutex do executor tal como as ligações e os nomes dos
  processos ([workers](processes.md#workers)).
- Uma porta regista o seu driver, o seu processo conectado (quem a abriu,
  alterado por `port_connect/2` ou `{Pid, {connect, New}}`), as suas ligações,
  os monitores mantidos sobre ela, um nome registado opcional, as suas opções
  e os seus contadores de bytes de entrada/saída.
- `open_port/2` liga a nova porta a quem a abriu. Quando o processo conectado
  termina, a sua porta fecha; uma porta que fecha envia sinais de saída às
  suas ligações e mensagens `'DOWN'` aos seus monitores com a sua razão
  (`normal` para um fecho que não seja um erro, caso contrário um átomo POSIX
  como `epipe`).
- Um sinal de saída que chegue a uma porta fecha-a com a sua razão (`kill` de
  `exit/2` como `killed`), exceto `normal` através de uma ligação de um
  processo que não seja o conectado, que apenas remove a ligação.
  `exit(Port, normal)` fecha a porta. Um processo conectado que tenha desfeito
  a ligação deixa a sua porta aberta quando termina.
- Uma mensagem de pedido de um processo que não seja o conectado, ou uma
  mensagem mal formada, envia ao processo conectado um sinal de saída
  `badsig` vindo da porta; a porta continua aberta.
- Os sinais de saída e as mensagens de uma porta para um processo em execução
  noutro worker esperam que a fatia de tempo desse processo termine (contêm
  apenas átomos, pids e portas); um `exit(Port, Reason)` com um termo de razão
  no heap do remetente faz o builtin correr de novo até que nenhum processo
  ligado ou monitorizador esteja a correr noutro lado, tal como para os sinais
  de processos ([workers](processes.md#workers)).
- As portas aceitam nomes registados (`register/2`) e `monitor(port, Port)`;
  `link/1` e `unlink/1` aceitam-nas.

## Builtins e mensagens de portas

| Builtin ou mensagem | Step |
| --- | --- |
| `is_port/1` true para portas, `port_to_list/1`, `list_to_port/1`, `ports/0` | 57B |
| `port_info/1,2` (`name`, `links`, `id`, `connected`, `input`, `output`, `os_pid`, `monitors`, `monitored_by`, `registered_name`) | 57B |
| `port_close/1`, `port_connect/2`, `port_command/2,3` | 57B |
| `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}` | 57B |
| `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` sobre portas; `register/2` de uma porta | 57B |
| `port_control/3`, `port_call/3` | 57B (badarg para drivers sem controlo); usados pelos drivers de 57E/57F |
| `open_port({fd, In, Out}, Opts)` | 57B saída; entrada a partir de 57C |
| `open_port({spawn, Command} \| {spawn_executable, File}, Opts)` | 57D |
| Drivers internos da biblioteca do projeto (`file`, sockets) | 57E, 57F |

Os builtins substituem os diagnósticos `[ports] notimpl` do step 53; a
funcionalidade `ports` passa a estar implementada em 57B. Os erros seguem o
OTP: `badarg` para uma porta fechada ou inválida e para argumentos inválidos,
e a razão POSIX (`enoent`, `eacces`) como `error` para uma abertura que falhe.

As mensagens de uma porta vão para o seu processo conectado:
`{Port, {data, Data}}`, `{Port, eof}` (opção `eof`),
`{Port, {exit_status, Status}}` (opção `exit_status`), `{Port, closed}`
(depois de `{Pid, close}`), `{Port, connected}` (para o antigo dono depois de
um connect).

## Modos de dados e opções

| Opção | Efeito |
| --- | --- |
| `stream` (por omissão), `{packet, N}` (N = 1, 2, 4) | Bytes tal como chegam, ou mensagens enquadradas por um comprimento big-endian de N bytes, que a saída também recebe |
| `{line, L}` | `{eol, Line}` por linha, `{noeol, Part}` para partes com mais de `L` ou para um fim sem terminador |
| `binary` | Dados como binaries em vez de listas de bytes |
| `eof` | `{Port, eof}` no fim da entrada; a porta continua aberta até ser fechada |
| `exit_status` | `{Port, {exit_status, S}}` quando o programa sai (portas spawn) |
| `use_stdio` (por omissão), `nouse_stdio`, `stderr_to_stdout`, `in`, `out`, `hide` | Como no OTP (`hide` não tem efeito) |
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Portas spawn (57D) |
| `{busy_limits_port, {Low, High} \| disabled}` | Bytes de saída em fila que tornam a porta ocupada ([portas ocupadas](#busy-ports), 57G3) |

Sem `eof`, o fim da entrada fecha a porta com a razão `normal`, depois da
mensagem `exit_status` quando esta tiver sido pedida. As opções desconhecidas
dão `badarg`.

## Drivers

Um driver é um objeto C++ por trás de uma porta (`runtime/src/ports/`): abre o
recurso, aceita saída (`port_command`), responde a `port_control/3` quando
suporta controlo, indica a entrada e os erros como eventos e fecha. Drivers:

- `fd`: descritores existentes, saída escrita de forma síncrona (57B),
  entrada através da thread de E/S (57C).
- `spawn`: um programa filho com o seu stdin e stdout como pipes (57D).
- `file`: um ficheiro aberto do módulo `file` da biblioteca do projeto; as
  suas operações são chamadas síncronas a `port_control/3` que podem bloquear
  o worker que executa o chamador durante a E/S de disco, como fazem os
  escalonadores dirty de E/S do OTP (57E).
- `tcp_inet`, `udp_inet`: sockets de `gen_tcp`, `gen_udp` e `inet` da
  biblioteca do projeto sobre Boost.Asio; os connects, accepts e receives são
  assíncronos (57F, [sockets](#sockets-57f)).

Os drivers internos de `file` e dos sockets são abertos com
`{spawn_driver, Name}` sob nomes do Clause, e as suas operações de
`port_control/3` são um protocolo do Clause: os programas usam os módulos da
biblioteca, não os protocolos `prim_inet`/`efile` do OTP.

## Thread de E/S

Uma thread de E/S por runtime (`detail::Reactor`,
`runtime/src/ports/reactor.hpp`, step 57G1) executa um `io_context` do
Boost.Asio: uma I/O completion port no Windows, `epoll` no Linux, `kqueue` no
macOS. A primeira porta que precisa dela inicia-a; serve todos os tipos de
portas, pelo que uma porta não custa uma thread própria:

- Pipes de programas lançados: named pipes sobrepostas (overlapped) no Windows
  (`windows::stream_handle`; as pipes anónimas não podem ser sobrepostas),
  pipes simples nos outros sistemas (`posix::stream_descriptor`). A saída é
  posta em fila e escrita por ordem através de escritas assíncronas.
- Entrada `fd` no Linux e no macOS: a thread espera até o descritor estar
  legível e depois um único `read()` obtém o que lá estiver, pelo que os
  descritores do próprio programa mantêm o seu modo bloqueante; um ficheiro
  regular, pelo qual não é possível esperar, é lido de imediato.
- Saídas de programas: no Windows, o conjunto de threads de espera do sistema
  (`RegisterWaitForSingleObject`, como usa o `object_handle` do Asio) espera
  pelo handle do processo e a saída é indicada na thread de E/S; no Linux e no
  macOS, um handler de `SIGCHLD` (`signal_set`) e `waitpid(WNOHANG)` recolhem
  todos os programas vigiados, também depois de a sua porta ter fechado.
- Sockets ([sockets](#sockets-57f)).
- Exceção: um handle de entrada `fd` no Windows (uma consola ou uma pipe
  anónima herdada) não pode ser sobreposto, pelo que é lido por uma thread
  bloqueante própria, como fazem o libuv e o ERTS; fechar a porta cancela a
  leitura (`CancelSynchronousIo`) e liberta a thread.

`runtime/src/ports/io*.cpp` contêm a E/S das portas (`detail::IoService`): os
seus métodos apenas publicam trabalho na thread de E/S, onde reside todo o
estado de E/S.

- A thread de E/S entrega a entrada tal como foi lida: bytes em bruto, o fim
  da entrada, um erro de leitura, o código de saída de um programa. Os eventos
  de sockets (mensagens, ligações aceites) são entregues da mesma forma.

## Tarefas de portas

Step 57G2. Uma porta é escalonada como um processo: o que a thread de E/S
entrega espera na porta, e a porta espera na fila de portas do executor até
um worker do escalonador executar a sua tarefa.

- Os workers alternam entre uma tarefa de porta e uma fatia de tempo de
  processo enquanto ambas as filas tiverem trabalho, pelo que uma porta que
  inunde de entrada não pode deixar os processos à fome, nem os processos as
  portas; um worker inativo pega no que estiver na fila.
- Uma tarefa corre sob o mutex do executor durante `PORT_TASK_REDUCTIONS` (as
  4000 de uma fatia de tempo): cada mensagem que entrega custa 100 reduções
  mais uma por cada 64 bytes que transporta. Uma porta com trabalho restante é
  colocada de novo no fim da fila.
- A tarefa enquadra a entrada (`InputDecoder`): a entrada em fluxo chega nos
  blocos que as leituras devolvem; `{packet, N}` retém os bytes até ter
  chegado um pacote inteiro (um pacote incompleto no fim da entrada é
  descartado, como no OTP); `{line, L}` divide em `\n`, envia uma linha com
  mais de `L` como pedaços `{noeol, Part}` e um fim sem terminador como
  `{noeol, Rest}`. `port_info(P, input)` conta cada byte lido, incluindo
  mudanças de linha e cabeçalhos de pacotes, no momento em que é lido.
- O fim da entrada envia `{Port, eof}` com a opção `eof`, caso contrário fecha
  a porta com a razão `normal`; um erro de leitura fecha-a com `eio`.
- Uma mensagem passa a ser uma mensagem para o seu processo de imediato quando
  esse processo não está a correr num worker (acordando-o como qualquer
  mensagem), caso contrário quando a sua fatia de tempo termina, pelo que o
  heap de um processo em execução nunca é tocado por outra thread.
- Os comandos, fechos, connects e sinais de saída enviados a uma porta atuam
  de imediato no worker do remetente, como faz o ERTS para uma porta que não
  está ocupada: uma porta `fd` escreve a sua saída de imediato no worker do
  chamador; os drivers de pipes e de sockets põem a saída em fila e deixam a
  thread de E/S escrevê-la (57D, 57F, 57G1); uma porta ocupada suspende o
  remetente ([portas ocupadas](#busy-ports)).

O protótipo `tests/prototypes/poller/` (`run.py --wsl`) mostra o despertar no
Windows (completion port) e no Linux em WSL (`poll()`): uma thread do
escalonador inativa acorda 9–91 µs após a entrada, e o encerramento para a
thread de E/S sem entrada.

No fim do programa, todas as portas são fechadas (os programas filhos veem o
fim da entrada; não são mortos, como no OTP) e a thread de E/S para: é
juntada (join) fora do mutex do executor, porque uma entrega em curso o
obtém; um leitor `fd` do Windows bloqueado numa leitura que não pode ser
cancelada é desanexado e não entrega mais nada.

## Portas ocupadas

Step 57G3. A saída que um driver põe em fila para a thread de E/S (pipes de
programas lançados) conta para os limites de ocupação da porta, o
`busy_limits_port` do OTP (por omissão: alto 8192 bytes, baixo 4096;
`{busy_limits_port, {Low, High}}` ou `disabled` como opção de `open_port/2`,
limites de pelo menos 1, um limite baixo acima do alto é reduzido a este):

- Uma escrita que leve a saída em fila ao limite alto ou acima continua a
  sair e torna a porta ocupada; esta continua ocupada até a thread de E/S ter
  escrito o suficiente para que fique em fila menos do que o limite baixo.
- `port_command/2` e `Port ! {Pid, {command, Data}}` para uma porta ocupada
  suspendem o remetente, que não escreve nada; assim que a porta deixa de
  estar ocupada, ou fecha, o remetente executa de novo o seu builtin (uma
  porta fechada dá então `badarg`, como no OTP). Um processo suspenso continua
  a receber sinais de saída.
- `port_command/3` com `nosuspend` devolve `false` para uma porta ocupada e
  não escreve nada; `force` lança `notsup`, já que os drivers spawn e `fd` do
  OTP não o permitem.
- `port_info(P, queue_size)` é a saída em fila ainda não escrita.
- As portas `fd` escrevem de imediato e a saída dos sockets passa por
  `port_control/3`, pelo que nenhuma delas fica alguma vez ocupada.

Uma porta também limita a entrada que retém:

- Quando mais de 64 KiB de entrada em bruto esperam pela tarefa da porta, a
  thread de E/S deixa de ler da porta (um programa que lhe escreva bloqueia
  então, como numa pipe cheia) até a tarefa a ter reduzido abaixo de 32 KiB.
- Enquanto o processo conectado puder correr (está a correr ou em fila, não à
  espera num `receive`, suspenso ou bloqueado) e já tiver 1024 mensagens (ou
  tiver outros tantos sinais de porta à espera do fim da sua fatia de tempo),
  a tarefa da porta não entrega mais nada até a fatia desse processo ter
  terminado. Um processo à espera num `receive` recebe sempre a entrada, pelo
  que um receive de uma mensagem posterior da porta não pode esperar para
  sempre.

## Subprocessos

Step 57D. `open_port({spawn, Command}, Options)` e
`open_port({spawn_executable, File}, Options)` iniciam um programa cujo stdin
e stdout são pipes da porta:

- `{spawn, Command}`: no Linux e no macOS, `/bin/sh -c Command`; no Windows,
  `CreateProcessW` com `Command` como linha de comandos (encontra o programa
  no caminho de pesquisa). `{spawn_executable, File}` executa `File` sem
  shell, com argv[0] `{arg0, A}` (por omissão `File`) e `{args, List}`; no
  Windows, os argumentos são postos entre aspas segundo as regras de
  `CommandLineToArgvW`.
- `{env, [{Name, Value | false}]}` define ou remove variáveis do filho,
  `{cd, Dir}` o seu diretório, `stderr_to_stdout` junta o stderr à porta;
  caso contrário, o filho partilha o stderr do programa. `in` não abre nenhuma
  pipe de stdin e `out` nenhuma pipe de stdout (em vez disso, o dispositivo
  nulo). `hide` e `overlapped_io` não têm efeito.
- Um programa que não possa ser iniciado lança `error:Reason` com a razão
  POSIX (`enoent`, `eacces`, `enoexec`); nomes e opções inválidos lançam
  `badarg`.
- A saída é posta em fila e escrita pela thread de E/S, com os limites de
  ocupação da porta ([portas ocupadas](#busy-ports)); fechar a porta deixa-a
  terminar o que está em fila e depois fecha o stdin do programa. O programa
  nunca é morto; normalmente termina no fim da entrada.
- A opção `exit_status` envia `{Port, {exit_status, S}}` assim que o programa
  tiver saído (o seu código de saída; no Linux e no macOS, 128 mais o sinal
  para um programa terminado por um sinal) e antes de `{Port, eof}` ou do
  fecho no fim da entrada; uma porta que não lê nada indica-o quando o
  programa sai e depois fecha.
- `port_info(P, os_pid)` é o id de processo do programa; `name` é o comando ou
  o ficheiro.
- O `os:cmd/1` da biblioteca executa `Command` com `COMSPEC /c` no Windows
  (`cmd` quando não está definido) ou `/bin/sh -c`, recolhe o stdout e o
  stderr até o programa os fechar e devolve os bytes como uma lista;
  `os:type/0` é `{win32, nt}`, `{unix, linux}` ou `{unix, darwin}`;
  `os:getenv/1` devolve uma string ou `false`.

## E/S padrão e ficheiros

Step 57E.

- `io:format`, `io:put_chars` e `erlang:display` continuam a escrever
  diretamente na saída padrão ([io](io.md)). A entrada padrão é lida por um
  único processo servidor da biblioteca, registado como `clause_stdin` e
  iniciado na primeira utilização, que detém uma porta `{fd, 0, 1}`:
  `io:get_line/1,2` escreve o prompt e depois devolve a linha seguinte com a
  sua mudança de linha, o resto da entrada sem ela no fim, e depois `eof`;
  `io:get_chars/2,3` devolve até `N` carateres e depois `eof`. Os pedidos de
  vários processos são respondidos por ordem de chegada. A entrada é
  devolvida como bytes (um elemento da lista por byte).
- O módulo `file` da biblioteca controla o driver de ficheiros do runtime,
  `{spawn_driver, "clause_file"}`, com `port_control/3`. As suas operações
  (`ports/file.cpp`: open, read, write, position, read_line, close, e as
  operações sobre caminhos read_file, write_file, delete, rename, list_dir,
  make_dir, del_dir) são chamadas de sistema síncronas no worker do chamador,
  fora do mutex do executor; as suas respostas começam com um byte de estado
  (0 ok, 1 erro e a sua razão POSIX, 2 fim de ficheiro). O protocolo é próprio
  do Clause.
- `file:open/2` devolve o pid de um servidor de E/S que detém uma porta de
  ficheiro e está ligado a quem o abriu (modos `read`, `write`, `append`,
  `exclusive`, `binary`; os outros modos são ignorados, como o OTP ignora as
  opções que não usa). `read/2`, `read_line/1`, `write/2`, `position/2` e
  `io:get_line/2`, `io:get_chars/3` sobre ele são pedidos a esse servidor;
  depois de `close/1`, os pedidos devolvem `{error, terminated}` e `close/1`
  continua a dar `ok`.
- Os erros seguem o OTP: `{error, enoent}`, `eexist`, `eisdir` (um diretório
  aberto ou lido como ficheiro), `einval` (uma posição negativa), `ebadf`
  (ler um ficheiro só de escrita ou escrever num só de leitura), `badarg` para
  nomes e dados inválidos. Os nomes de ficheiros são strings, binaries ou
  átomos, codificados em UTF-8.
- Um módulo referenciado pelo programa que seja um builtin do catálogo
  (`io:format`) já não arrasta para o programa o módulo da biblioteca com esse
  nome; só uma chamada de uma das suas funções Erlang o faz.

## Sockets (57F)

Um socket é uma porta, como no backend `inet_drv` do OTP: `is_port(Socket)` é
true e as mensagens em modo ativo são `{tcp, Socket, Data}`,
`{tcp_closed, Socket}`, `{tcp_error, Socket, Reason}`,
`{udp, Socket, Address, Port, Data}`. O subconjunto: `gen_tcp:connect/3,4`,
`listen/2`, `accept/1,2`, `send/2`, `recv/2,3`, `close/1`,
`controlling_process/2`, `shutdown/2`; `gen_udp:open/1,2`, `send/4`,
`recv/2,3`, `close/1`; `inet:setopts/2`, `inet:port/1`, `inet:peername/1`,
`inet:sockname/1`; modos `{active, true | false | once}`, `binary`/`list`,
`{packet, 0 | 1 | 2 | 4 | raw}`, `{reuseaddr, Bool}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6`; endereços IPv4 e IPv6
como tuplos, nomes de anfitrião como strings ou átomos (incluindo
`loopback`). As opções de afinação `nodelay`, `keepalive`, `send_timeout`,
`send_timeout_close`, `delay_send` e `exit_on_close` são aceites e não
aplicadas; qualquer outra opção dá `exit(badarg)`, como para uma opção
inválida no OTP.

Implementação (`runtime/src/ports/sockets.cpp`):

- A thread de E/S do runtime ([thread de E/S](#io-thread)) serve os sockets;
  o estado de cada socket reside nessa thread. A biblioteca abre uma porta com
  `{spawn_driver, "tcp_inet" | "udp_inet"}` e controla-a com
  `port_control/3`; o worker chamador publica a operação na thread de E/S e
  espera pela sua resposta síncrona (byte de estado 0 e um resultado, ou 1 e
  uma razão POSIX).
- As operações que esperam (connect, accept, recv) respondem mais tarde com
  uma mensagem `{clause_socket, Socket, Reply}` ao seu chamador, pelo que o
  chamador bloqueia num `receive` comum e os outros processos continuam a
  correr. Um timeout cancela o pedido; o próprio cancelamento responde
  `cancelled` depois de tudo o que o socket tenha enviado antes, pelo que uma
  resposta que tenha ganho a corrida é devolvida em vez de perdida.
- As mensagens de sockets são descritas fora do heap (`ports/value.hpp`) e
  construídas no heap do recetor quando entregues, segundo as regras do
  executor da [thread de E/S](#io-thread). Uma ligação aceite torna-se uma
  nova porta detida pelo chamador de `accept` e ligada a ele, com o modo do
  socket de escuta.
- `controlling_process/2` para a entrega ativa, move as mensagens do socket já
  enviadas ao antigo dono para o novo e depois volta a conectar a porta, como
  faz o `inet` do OTP; só o dono a pode chamar (`{error, not_owner}`).
- A saída é posta em fila sem limite e escrita por ordem na thread de E/S.
  Fechar uma porta envia o que está em fila e depois fecha a ligação de forma
  ordenada (FIN); uma porta fechada responde `{error, closed}` a todos os
  chamadores em espera. A resolução de nomes corre no worker do chamador, uma
  vez que bloqueia.
- As portas de sockets são escalonadas como as outras portas
  ([tarefas de portas](#port-tasks)): as mensagens de um socket esperam na sua
  porta até a tarefa da porta as entregar.

## Não fornecido

Drivers linked-in e NIFs, `erlang:open_port({spawn_driver, Name})` para nomes
de drivers do OTP, portas de distribuição, `port_call/3` sobre os drivers
fornecidos para além do protocolo próprio da biblioteca, portas de sockets
ocupadas, e as opções `overlapped_io`, `parallelism` e `busy_limits_msgq`.
