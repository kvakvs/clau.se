---
source: docs/ports.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 0b9c882a696b24690dffccf55456c63d826a600ed7e2be286259a5df3eb6bf57
translatedAt: 2026-10-26
---
# Portas

Os programas obtêm portas tal como o OTP as define, e a E/S externa passa por
elas. A tabela de portas, as regras de saída e as tarefas de portas estão em
`runtime/src/scheduler/ports.cpp`, os builtins em
`runtime/src/builtins/erlang/ports.cpp`, os drivers e a thread de E/S em
`runtime/src/ports/`. Goldens OTP: `executables_port_identities`,
`executables_port_input`, `executables_port_spawn`, `executables_file_io`,
`executables_sockets`, `executables_many_ports`, `executables_port_fairness`,
`executables_busy_ports`, `executables_slow_owner`; teste do runtime
`runtime_port_io`.

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
- A identidade de uma porta fechada continua válida: `is_port/1` continua a ser
  true, `port_info/1,2` respondem `undefined` e os envios para ela são
  descartados.
- As portas são imediatas, pelo que a cópia, a recolha e as mensagens não
  precisam de nada de novo.

## Tabela de portas e propriedade

- Cada runtime mantém uma tabela de portas (número → porta) no seu executor,
  protegida pelo mutex do executor tal como as ligações e os nomes dos
  processos ([workers](processes.md#workers)).
- Uma porta regista o seu driver, o seu processo conectado (quem a abriu,
  alterado por `port_connect/2` ou `{Pid, {connect, New}}`), as suas ligações,
  os monitores mantidos sobre ela, um nome registado opcional, as suas opções e
  os seus contadores de bytes de entrada/saída.
- `open_port/2` liga a nova porta a quem a abriu. Quando o processo conectado
  termina, a sua porta fecha; uma porta que fecha envia sinais de saída às suas
  ligações e mensagens `'DOWN'` aos seus monitores com a sua razão (`normal`
  para um fecho que não seja um erro, caso contrário um átomo POSIX como
  `epipe`).
- Um sinal de saída que chegue a uma porta fecha-a com a sua razão (`kill` de
  `exit/2` como `killed`), exceto `normal` através de uma ligação de um
  processo que não seja o conectado, que apenas remove a ligação.
  `exit(Port, normal)` fecha a porta. Um processo conectado que tenha desfeito
  a ligação deixa a sua porta aberta quando termina.
- Uma mensagem de pedido de um processo que não seja o conectado, ou uma
  mensagem mal formada, envia ao processo conectado um sinal de saída `badsig`
  vindo da porta; a porta continua aberta.
- Os sinais de saída e as mensagens de uma porta para um processo em execução
  noutro worker esperam que a fatia de tempo desse processo termine (contêm
  apenas átomos, pids e portas); um `exit(Port, Reason)` com um termo de razão
  no heap do remetente faz o builtin correr de novo até que nenhum processo
  ligado ou monitorizador esteja a correr noutro lado, tal como para os sinais
  de processos ([workers](processes.md#workers)).
- As portas aceitam nomes registados (`register/2`) e `monitor(port, Port)`;
  `link/1` e `unlink/1` aceitam-nas.

## Builtins e mensagens de portas

- `is_port/1` (true para portas), `port_to_list/1`, `list_to_port/1`,
  `ports/0`.
- `port_info/1,2`: `name`, `links`, `id`, `connected`, `input`, `output`,
  `os_pid`, `monitors`, `monitored_by`, `registered_name`, `queue_size`
  ([portas ocupadas](#busy-ports)).
- `port_close/1`, `port_connect/2`, `port_command/2,3`; as mensagens
  `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}`.
- `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` sobre portas;
  `register/2` de uma porta.
- `port_control/3`, `port_call/3`: `badarg` para drivers sem controlo; os
  drivers `file` e de sockets são controlados por `port_control/3`.
- `open_port({fd, In, Out}, Opts)`, `open_port({spawn, Command}, Opts)`,
  `open_port({spawn_executable, File}, Opts)` e os drivers internos da
  biblioteca do projeto (`file`, sockets).

Os erros seguem o OTP: `badarg` para uma porta fechada ou inválida e para
argumentos inválidos, e a razão POSIX (`enoent`, `eacces`) como `error` para
uma abertura que falhe.

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
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Portas spawn ([subprocessos](#subprocesses)) |
| `{busy_limits_port, {Low, High} \| disabled}` | Bytes de saída em fila que tornam a porta ocupada ([portas ocupadas](#busy-ports)) |

Sem `eof`, o fim da entrada fecha a porta com a razão `normal`, depois da
mensagem `exit_status` quando esta tiver sido pedida. As opções desconhecidas
dão `badarg`.

## Drivers

Um driver é um objeto C++ por trás de uma porta (`runtime/src/ports/`): abre o
recurso, aceita saída (`port_command`), responde a `port_control/3` quando
suporta controlo, indica a entrada e os erros como eventos e fecha. Drivers:

- `fd`: descritores existentes, saída escrita de forma síncrona, entrada
  através da thread de E/S.
- `spawn`: um programa filho com o seu stdin e stdout como pipes
  ([subprocessos](#subprocesses)).
- `file`: um ficheiro aberto do módulo `file` da biblioteca do projeto; as suas
  operações são chamadas síncronas a `port_control/3` que podem bloquear o
  worker que executa o chamador durante a E/S de disco, como fazem os
  escalonadores dirty de E/S do OTP ([ficheiros](#standard-io-and-files)).
- `tcp_inet`, `udp_inet`: sockets de `gen_tcp`, `gen_udp` e `inet` da
  biblioteca do projeto sobre Boost.Asio; os connects, accepts e receives são
  assíncronos ([sockets](#sockets)).
- `clause_registry` (Windows): o registo de `win32reg`
  ([o registo](#the-registry)).

Os drivers internos de `file`, dos sockets e do registo são abertos com
`{spawn_driver, Name}` sob nomes do Clause, e as suas operações de
`port_control/3` são um protocolo do Clause: os programas usam os módulos da
biblioteca, não os protocolos `prim_inet`/`efile` do OTP.

## Thread de E/S

Uma thread de E/S por runtime (`detail::Reactor`,
`runtime/src/ports/reactor.hpp`) executa um `io_context` do Boost.Asio: uma I/O
completion port no Windows, `epoll` no Linux, `kqueue` no macOS. A primeira
porta que precisa dela inicia-a; serve todos os tipos de portas, pelo que uma
porta não custa uma thread própria:

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
- Sockets ([sockets](#sockets)).
- Exceção: um handle de entrada `fd` no Windows (uma consola ou uma pipe
  anónima herdada) não pode ser sobreposto, pelo que é lido por uma thread
  bloqueante própria, como fazem o libuv e o ERTS; fechar a porta cancela a
  leitura (`CancelSynchronousIo`) e liberta a thread.

`runtime/src/ports/io*.cpp` contêm a E/S das portas (`detail::IoService`): os
seus métodos apenas publicam trabalho na thread de E/S, onde reside todo o
estado de E/S. A thread de E/S entrega a entrada tal como foi lida: bytes em
bruto, o fim da entrada, um erro de leitura, o código de saída de um programa.
Os eventos de sockets (mensagens, ligações aceites) são entregues da mesma
forma.

O protótipo `tests/prototypes/poller/` (`run.py --wsl`) mostra o despertar no
Windows (completion port) e no Linux em WSL (`poll()`): uma thread do
escalonador inativa acorda 9–91 µs após a entrada, e o encerramento para a
thread de E/S sem entrada.

No fim do programa, todas as portas são fechadas (os programas filhos veem o
fim da entrada; não são mortos, como no OTP) e a thread de E/S para: é juntada
(join) fora do mutex do executor, porque uma entrega em curso o obtém; um
leitor `fd` do Windows bloqueado numa leitura que não pode ser cancelada é
desanexado e não entrega mais nada.

## Tarefas de portas

Uma porta é escalonada como um processo: o que a thread de E/S entrega espera
na porta, e a porta espera na fila de portas do executor até um worker do
escalonador executar a sua tarefa.

- Os workers alternam entre uma tarefa de porta e uma fatia de tempo de
  processo enquanto ambas as filas tiverem trabalho, pelo que uma porta que
  inunde de entrada não pode deixar os processos à fome, nem os processos as
  portas; um worker inativo pega no que estiver na fila.
- Uma tarefa corre sob o mutex do executor durante `PORT_TASK_REDUCTIONS` (as
  4000 de uma fatia de tempo): cada mensagem que entrega custa 100 reduções
  mais uma por cada 64 bytes que transporta. Uma porta com trabalho restante é
  colocada de novo no fim da fila.
- A tarefa enquadra a entrada (`InputDecoder`): a entrada em fluxo chega nos
  blocos que as leituras devolvem; `{packet, N}` retém os bytes até ter chegado
  um pacote inteiro (um pacote incompleto no fim da entrada é descartado, como
  no OTP); `{line, L}` divide em `\n`, envia uma linha com mais de `L` como
  pedaços `{noeol, Part}` e um fim sem terminador como `{noeol, Rest}`.
  `port_info(P, input)` conta cada byte lido, incluindo mudanças de linha e
  cabeçalhos de pacotes, no momento em que é lido.
- O fim da entrada envia `{Port, eof}` com a opção `eof`, caso contrário fecha
  a porta com a razão `normal`; um erro de leitura fecha-a com `eio`.
- Uma mensagem passa a ser uma mensagem para o seu processo de imediato quando
  esse processo não está a correr num worker (acordando-o como qualquer
  mensagem), caso contrário quando a sua fatia de tempo termina, pelo que o
  heap de um processo em execução nunca é tocado por outra thread.
- Os comandos, fechos, connects e sinais de saída enviados a uma porta atuam de
  imediato no worker do remetente, como faz o ERTS para uma porta que não está
  ocupada: uma porta `fd` escreve a sua saída de imediato no worker do
  chamador; os drivers de pipes e de sockets põem a saída em fila e deixam a
  thread de E/S escrevê-la; uma porta ocupada suspende o remetente
  ([portas ocupadas](#busy-ports)).

## Portas ocupadas

A saída que um driver põe em fila para a thread de E/S (pipes de programas
lançados) conta para os limites de ocupação da porta, o `busy_limits_port` do
OTP (por omissão: alto 8192 bytes, baixo 4096;
`{busy_limits_port, {Low, High}}` ou `disabled` como opção de `open_port/2`,
limites de pelo menos 1, um limite baixo acima do alto é reduzido a este):

- Uma escrita que leve a saída em fila ao limite alto ou acima continua a sair
  e torna a porta ocupada; esta continua ocupada até a thread de E/S ter
  escrito o suficiente para que fique em fila menos do que o limite baixo.
- `port_command/2` e `Port ! {Pid, {command, Data}}` para uma porta ocupada
  suspendem o remetente, que não escreve nada; assim que a porta deixa de estar
  ocupada, ou fecha, o remetente executa de novo o seu builtin (uma porta
  fechada dá então `badarg`, como no OTP). Um processo suspenso continua a
  receber sinais de saída.
- `port_command/3` com `nosuspend` devolve `false` para uma porta ocupada e não
  escreve nada; `force` lança `notsup`, já que os drivers spawn e `fd` do OTP
  não o permitem.
- `port_info(P, queue_size)` é a saída em fila ainda não escrita.
- As portas `fd` escrevem de imediato e a saída dos sockets passa por
  `port_control/3`, pelo que nenhuma delas fica alguma vez ocupada.

Uma porta também limita a entrada que retém:

- Quando mais de 64 KiB de entrada em bruto esperam pela tarefa da porta, a
  thread de E/S deixa de ler da porta (um programa que lhe escreva bloqueia
  então, como numa pipe cheia) até a tarefa a ter reduzido abaixo de 32 KiB.
- Enquanto o processo conectado puder correr (está a correr ou em fila, não à
  espera num `receive`, suspenso ou bloqueado) e já tiver 1024 mensagens (ou
  tiver outros tantos sinais de porta à espera do fim da sua fatia de tempo), a
  tarefa da porta não entrega mais nada até a fatia desse processo ter
  terminado. Um processo à espera num `receive` recebe sempre a entrada, pelo
  que um receive de uma mensagem posterior da porta não pode esperar para
  sempre.

## Subprocessos

`open_port({spawn, Command}, Options)` e
`open_port({spawn_executable, File}, Options)` iniciam um programa cujo stdin e
stdout são pipes da porta:

- `{spawn, Command}`: no Linux e no macOS, `/bin/sh -c Command`; no Windows,
  `CreateProcessW` com `Command` como linha de comandos (encontra o programa no
  caminho de pesquisa). `{spawn_executable, File}` executa `File` sem shell,
  com argv[0] `{arg0, A}` (por omissão `File`) e `{args, List}`; no Windows, os
  argumentos são postos entre aspas segundo as regras de `CommandLineToArgvW`.
- `{env, [{Name, Value | false}]}` define ou remove variáveis do filho,
  `{cd, Dir}` o seu diretório, `stderr_to_stdout` junta o stderr à porta; caso
  contrário, o filho partilha o stderr do programa. Só `in` não abre nenhuma
  pipe de stdin e só `out` nenhuma pipe de stdout (em vez disso, o dispositivo
  nulo); com ambos ou nenhum, a porta tem as duas, como no OTP. `hide` e
  `overlapped_io` não têm efeito.
- Um programa que não possa ser iniciado lança `error:Reason` com a razão POSIX
  (`enoent`, `eacces`, `enoexec`); nomes e opções inválidos lançam `badarg`.
- A saída é posta em fila e escrita pela thread de E/S, com os limites de
  ocupação da porta ([portas ocupadas](#busy-ports)); fechar a porta deixa-a
  terminar o que está em fila e depois fecha o stdin do programa. O programa
  nunca é morto; normalmente termina no fim da entrada.
- A opção `exit_status` envia `{Port, {exit_status, S}}` assim que o programa
  tiver saído (o seu código de saída; no Linux e no macOS, 128 mais o sinal
  para um programa terminado por um sinal) e antes de `{Port, eof}` ou do fecho
  no fim da entrada; uma porta que não lê nada indica-o quando o programa sai e
  depois fecha.
- `port_info(P, os_pid)` é o id de processo do programa; `name` é o comando ou
  o ficheiro.
- O `os:cmd/1` da biblioteca executa `Command` com `COMSPEC /c` no Windows
  (`cmd` quando não está definido) ou `/bin/sh -c`, recolhe o stdout e o stderr
  até o programa os fechar e devolve os bytes como uma lista; `os:type/0` é
  `{win32, nt}`, `{unix, linux}` ou `{unix, darwin}`; `os:getenv/1` devolve uma
  string ou `false`.

## E/S padrão e ficheiros

- `io:format`, `io:put_chars` e `erlang:display` escrevem diretamente na saída
  padrão ([io](io.md)). A entrada padrão é lida por um único processo servidor
  da biblioteca, registado como `clause_stdin` e iniciado na primeira
  utilização, que detém uma porta `{fd, 0, 1}`: `io:get_line/1,2` escreve o
  prompt e depois devolve a linha seguinte com a sua mudança de linha, o resto
  da entrada sem ela no fim, e depois `eof`; `io:get_chars/2,3` devolve até `N`
  carateres e depois `eof`. Os pedidos de vários processos são respondidos por
  ordem de chegada. A entrada é descodificada de UTF-8 para carateres, como o
  OTP lê o seu terminal; o servidor mantém as opções `standard_io` do OTP sem
  shell (`binary`, `encoding`, `echo`, `log`; `io:getopts/0,1`,
  `io:setopts/1,2`): o modo binary devolve binaries, `echo` escreve a entrada
  consumida na saída padrão, `get_password` é `{error, enotsup}` sem shell,
  como no OTP.
- Os servidores de ficheiros respondem a `getopts` e `setopts` como o servidor
  de E/S de ficheiros do OTP (`binary`/`list` e `encoding`; `file:open/2` aceita
  `{encoding, E}`): os pedidos de E/S (`io:get_line`, `get_chars`, `put_chars`,
  `get_until`) codificam e descodificam a codificação do dispositivo, e
  `file:read/2`, `read_line/1` num ficheiro codificado respondem como pedidos
  latin1 `get_chars`/`get_line` (`no_translation` acima de 255, o que para o
  servidor). A saída de `io:format/3`, `io:put_chars/2`, `io:nl/1` para qualquer
  pid é um pedido `put_chars` do protocolo de E/S.
- O módulo `file` da biblioteca controla o driver de ficheiros do runtime,
  `{spawn_driver, "clause_file"}`, com `port_control/3`. As suas operações
  (`ports/file.cpp`: open, read, write, position, read_line, sync, close, e as
  operações sobre caminhos read_file, write_file, delete, rename, list_dir,
  make_dir, del_dir e read_file_info, `ports/file_info.cpp`; get_cwd, set_cwd,
  read_link, read_link_info, make_link e make_symlink, `ports/file_paths.cpp`)
  são chamadas de sistema síncronas no worker do chamador, fora do mutex do
  executor; as suas respostas começam com um byte de estado (0 ok, 1 erro e a
  sua razão POSIX, 2 fim de ficheiro). O protocolo é próprio do Clause.
  read_line lê 64 KB à frente e devolve as linhas a partir desse buffer;
  qualquer outra operação sobre o ficheiro recua primeiro sobre os bytes que
  ainda não devolveu, pelo que as posições se mantêm exatas.
- As operações sobre caminhos fazem as chamadas de sistema do OTP e nada mais:
  o estado de um caminho só é lido depois de uma abertura ou eliminação falhar
  (para responder `eisdir` ou `eperm`), delete remove a ligação a um ficheiro
  e nunca remove um diretório, e read_file lê um ficheiro até ao tamanho
  indicado pelo seu descritor, como no OTP, sem leituras para detetar o fim.
- `port_control/3` entrega um binary ou `[]` ao driver no próprio local (os
  outros iodata são primeiro achatados), e uma resposta torna-se o binary do
  resultado sem cópia: as respostas são `ByteBuffer`s
  (`runtime/include/byte_buffer.hpp`), vetores de bytes que crescem sem serem
  zerados, pelo que uma leitura preenche os bytes da sua resposta uma só vez.
- `file:open/2` devolve o pid de um servidor de E/S que detém uma porta de
  ficheiro e fecha quando quem o abriu termina, como no OTP (no Windows, o
  ficheiro é partilhado para leitura, escrita e eliminação, como o OTP o abre,
  pelo que um ficheiro aberto pode ser eliminado ou renomeado) (modos `read`,
  `write`, `append`, `exclusive`, `binary`, `raw`; os outros modos são ignorados,
  como o OTP ignora as opções que não usa; `write` trunca, a menos que `append`
  também seja dado).
- `file:write_file/3` abre com os seus modos mais `binary` e `write`;
  `file:read_file_info/1,2` devolvem o `#file_info{}` do OTP a partir do estado
  do caminho (seguindo as ligações), com os tempos como data e hora locais ou
  universais ou segundos POSIX (`{time, local | universal | posix}`; `raw` é
  aceite). No Windows, `inode`, `uid` e `gid` são 0 e `major_device` é o número
  da unidade, tal como o OTP os comunica. `read/2`, `read_line/1`, `write/2`,
  `position/2` e `io:get_line/2`, `io:get_chars/3` sobre ele são pedidos a esse
  servidor; depois de `close/1`, os pedidos devolvem `{error, terminated}` e
  `close/1` continua a dar `ok`.
- E/S posicionada e alterações de ficheiros: `pread/2,3` e `pwrite/2,3`
  posicionam e depois leem ou escrevem num servidor de ficheiros (`cur`
  continua a leitura, a posição avança), como faz o servidor do OTP; um ficheiro
  `raw` só aceita deslocamentos inteiros (`badarg` caso contrário) e mantém a
  sua posição. `truncate/1` corta na posição; `advise/4` aceita os átomos de
  aconselhamento do OTP (`posix_fadvise` no Linux, ignorado nos outros sistemas,
  como no OTP); `allocate/3` reserva espaço (`fallocate`, `F_PREALLOCATE` no
  macOS, `{error, enotsup}` no Windows), verificando primeiro os argumentos
  (`badarg` para valores não numéricos, `einval` para negativos e números de
  vírgula flutuante). Como o servidor de ficheiros do OTP, um servidor cuja
  escrita, escrita posicionada, sync, truncate ou advise falhe responde com o
  erro e termina, pelo que os pedidos posteriores recebem `{error, terminated}`;
  um ficheiro raw continua. `write_file_info/2,3` e `change_mode/2`,
  `change_owner/2,3`, `change_group/2`, `change_time/2,3` alteram o proprietário,
  as permissões e os tempos pela ordem de prim_file (Windows: proprietários
  ignorados, apenas o atributo de só de leitura a partir do bit de escrita do
  proprietário, e o tempo de criação também é definido). `sendfile/2,5` leem
  um ficheiro raw em blocos (no máximo 1 MiB, `chunk_size`) e enviam-nos com
  `gen_tcp:send/2` ou a fun indicada, a alternativa do OTP: o Clause não tem
  sendfile nativo. `format_error/1` dá os textos do OTP, os POSIX a partir de
  `erl_posix_msg:message/1`.
- Linhas e leituras falhadas: `read_line/1` e `io:get_line` leem um final CRLF
  como LF (a posição conta o CR), como no OTP; um servidor de ficheiros cuja
  leitura falhe responde com o erro e termina, e um cuja leitura de linha
  falhe termina sem resposta (o chamador recebe `{error, terminated}`), como
  no OTP.
- `compressed` e `compressed_one`: a escrita passa por um fluxo gzip deflate
  (zlib, window bits 31) finalizado no fecho, também quando o servidor para ou
  quem o abriu termina; a leitura descomprime um ficheiro que comece com os
  bytes mágicos de gzip (`compressed` lê membros concatenados como um só,
  `compressed_one` para após o primeiro) e lê qualquer outro ficheiro tal como
  está. As posições contam bytes descomprimidos: avançam lendo ou escrevendo
  zeros, recuam apenas na leitura (de novo desde o início), `eof` é `einval`.
  Ler um ficheiro aberto para escrita ou escrever num aberto para leitura dá
  `ebadf`; `allocate/3` e, em ficheiros raw, a E/S posicionada dão `enotsup`;
  um servidor de ficheiros para após `truncate`, `advise` e `sync` (`enotsup`),
  como no OTP. Ler e escrever ao mesmo tempo ou acrescentar dá `{error, einval}`.
- `{zstd, Options}`: como `compressed`, através de um contexto zstd criado com
  `Options` (`{error, badarg}` quando as recusa): cada escrita é um frame
  próprio e o fecho acrescenta um vazio, como escreve a camada do OTP; a
  leitura descomprime os frames lidos em blocos de 8 KiB.
- `ram`: o ficheiro é o seu conteúdo iodata em memória, servido por um processo
  como os outros ficheiros e fechado com quem o abriu; apenas os modos `read`,
  `write` e `binary` (`read` quando nenhum é dado, qualquer outro `badarg`,
  `raw` com `ram` lança `badarg`). Leituras, escritas, posições, `pread`/`pwrite`
  (mantendo a posição), `truncate`, `sync`, `advise` e `allocate` respondem como
  o driver de ficheiros ram do OTP: escritas após o fim preenchem o intervalo
  com zeros, deslocamentos e tamanhos superiores a 32 bits com sinal dão
  `einval`, escrever num ficheiro só de leitura dá `ebadf`, truncá-lo `eacces`.
- O protocolo de E/S do OTP: o servidor da entrada padrão e o servidor de cada
  ficheiro aberto respondem a `{io_request, From, ReplyAs, Request}` com
  `{io_reply, ReplyAs, Reply}`, que `io:request/1,2` e `io:requests/1,2`
  enviam (`standard_io` e `user` designam o servidor da entrada padrão, outro
  átomo um processo registado; `{error, arguments}` quando não está registado,
  `{error, calling_self}` para o próprio chamador). Pedidos: `get_until`
  (`M:F(Cont, Chars | eof, Extra...)` a partir de `Cont = []`, alimentado com o
  que está em buffer ou com blocos de 4 KiB do ficheiro até
  `{done, Result, Rest}`; `Rest` é lido de novo pelo pedido seguinte: mantido
  no buffer ou, num ficheiro, a posição recua sobre ele), `get_line`,
  `get_chars`, `put_chars` (carateres ou `M:F(A)`), as formas antigas sem
  codificação (latin1) e `{requests, List}` (por ordem, parando no primeiro
  `{error, _}`). Os carateres são bytes, como acima; um ficheiro em modo binary
  devolve como binary um resultado de lista de `get_until`. Os outros recebem
  `{error, {request, Request}}`. Uma função `get_until` ou `put_chars` que
  falhe faz o servidor de um ficheiro responder `{error, Function}` e sair com
  a falha, como faz o do OTP; quem abriu continua vivo (o servidor de ficheiros
  do OTP não está ligado a ele). Os pedidos de entrada na entrada padrão
  escrevem o seu prompt.
- Diretórios, ligações e cópias: `get_cwd/0` escreve o diretório atual como o
  OTP (barras normais, letra de unidade em minúscula), `get_cwd/1` recebe uma
  unidade do Windows (`enotsup` nos outros sistemas); `set_cwd/1` altera-o para
  todo o programa; `read_link/1`, `read_link_all/1` (`einval` para um caminho
  que não é uma ligação), `read_link_info/1,2` (o estado da própria ligação
  final: `lstat` POSIX, no Windows os campos do destino com o tipo `symlink`),
  `make_link/2`, `make_symlink/2` (exige um privilégio no Windows: `eperm`,
  como no OTP), `list_dir_all/1`, `del_dir_r/1`, `copy/2,3` (nomes,
  `{Name, Modes}` ou ficheiros abertos; `{ok, BytesCopied}`),
  `raw_read_file_info/1`, `read_file/2`, `delete/2`, `native_name_encoding/0`
  (`utf8`). `del_dir/1` responde `enoent` para um caminho em falta e `enotdir`
  para um ficheiro.
- O `file` do Clause é a camada de ficheiros; `filelib` e `filename` do Clause
  correm sobre ele (`filelib:fold_files/5` usa `re`); `erl_prim_loader` é
  fornecido sobre `file` com as respostas `error` simples do OTP e um caminho
  do carregador `["."]` (`set_path/1`), com as suas funções de carregamento e
  de arquivos recusadas; `prim_file` e `prim_buffer` continuam em falta, pelo
  que os chamadores `raw_file_io*` do OTP nunca entram num programa.
- Os erros seguem o OTP: `{error, enoent}`, `eexist`, `eisdir` (um diretório
  aberto ou lido como ficheiro), `einval` (uma posição negativa;
  `badarg` para um valor que não seja uma posição), `ebadf` (ler
  um ficheiro só de escrita ou escrever num só de leitura), `badarg` para nomes
  e dados inválidos. Os nomes de ficheiros são strings, binaries ou átomos,
  codificados em UTF-8.

## Sockets

Um socket é uma porta, como no backend `inet_drv` do OTP: `is_port(Socket)` é
true e as mensagens em modo ativo são `{tcp, Socket, Data}`,
`{tcp_closed, Socket}`, `{tcp_error, Socket, Reason}`,
`{udp, Socket, Address, Port, Data}`. O subconjunto:
`gen_tcp:connect/2,3,4` (um anfitrião e uma porta, ou um map de endereço de
socket), `listen/2`, `accept/1,2`, `send/2`, `recv/2,3`, `close/1`,
`controlling_process/2`, `shutdown/2`; `gen_udp:open/1,2`, `connect/2,3`,
`send/2,3,4,5` (as formas de destino e os dados auxiliares do OTP), `recv/2,3`,
`close/1`; `inet:setopts/2`, `getopts/2`, `getstat/1,2`, `info/1`, `i/0,1,2`,
`monitor/1`, `cancel_monitor/1`, `port/1`, `peername/1`, `peernames/1,2`,
`sockname/1`, `socknames/1,2`; modos `{active, true | false | once}`,
`binary`/`list` (`{mode, M}`), `{packet, 0 | 1 | 2 | 4 | raw}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6`; endereços IPv4 e IPv6
como tuplos, nomes de anfitrião como strings ou átomos (incluindo `loopback`).

As opções para além do modo de dados (`ports/socket_options.cpp`,
`library/kernel/clause_socket_options.erl`) são records do driver com um código
e um valor, dadas quando um socket abre (definidas antes de se associar ou
conectar) ou por `setopts/2`; todas as opções de uma chamada `setopts/2` são
verificadas antes de qualquer uma ser definida. As opções do sistema
(`reuseaddr`, `keepalive`, `dontroute`, `linger`, `broadcast`, `sndbuf`, `recbuf`,
`nodelay`, `tos`, `tclass`, `ipv6_v6only`, `multicast_ttl`, `multicast_loop`,
`multicast_if`, `add_membership`, `drop_membership`, `exclusiveaddruse` no
Windows, `priority` e `reuseport` onde o sistema as tem) vão para `setsockopt`
e são lidas com `getsockopt`; as opções que o `inet_drv` do OTP mantém
internamente (`buffer`, `header`, `deliver`, `exit_on_close`, `send_timeout`,
limiares, `packet_size`, ...) são mantidas com os valores por omissão de
inet_drv e não são aplicadas ([diferenças](differences.md)). Como no inet_drv,
um buffer de receção aumenta `buffer` até este ser definido, e `getopts/2`
omite as opções que um tipo de socket não tem (`broadcast` de um socket TCP,
`nodelay` de um UDP, `tclass` de IPv4) e recusa as desconhecidas com
`{error, einval}`. Uma ligação aceite herda as opções do seu socket de escuta.
`send/5` com dados auxiliares define `tos`, `tclass` ou `ttl` apenas para esse
datagrama; no Windows dá `{error, einval}`, como no OTP.

Cada socket conta o seu tráfego como o inet_drv para `getstat/1,2`: os pacotes
recebidos são leituras (TCP) ou datagramas, os pacotes enviados são chamadas
`send` (com o seu cabeçalho de pacote) ou datagramas, com as médias acumuladas
do inet_drv; `send_pend` é a saída em fila ainda não escrita. `getstatus` dá os
indicadores de estado do inet_drv (`open`, `connected`, `connecting`, `listen`,
`accepting`), que `info/1` e `i/0,1,2` imprimem com os nomes e a coluna de módulo
do OTP (`inet_tcp`, `inet6_udp`, ...). As consultas a um socket fechado
respondem `{error, einval}`, como no OTP.

O módulo `socket` (`library/kernel/socket.erl`) usa as mesmas portas de driver
em modo binary passivo. Um socket de fluxo pode ser associado antes de escutar
ou conectar (a operação 22 abre e associa o socket do sistema, que `listen`
transforma no aceitador ou `connect` conecta); um socket de datagramas é
associado por `udp_open`, implicitamente no seu primeiro envio. O fim de uma
ligação responde a todos os `recv` em espera (também a um que peça mais bytes
do que os restantes). `socket` mantém no seu próprio buffer os bytes que um
recv não consumiu, pelo que `recv/2,3,4` dá os resultados do OTP
`{error, {timeout, Data}}` e `{error, {closed, Data}}`.

Implementação (`runtime/src/ports/sockets.cpp`):

- A thread de E/S do runtime ([thread de E/S](#io-thread)) serve os sockets; o
  estado de cada socket reside nessa thread. A biblioteca abre uma porta com
  `{spawn_driver, "tcp_inet" | "udp_inet"}` e controla-a com `port_control/3`;
  o worker chamador publica a operação na thread de E/S e espera pela sua
  resposta síncrona (byte de estado 0 e um resultado, ou 1 e uma razão POSIX).
- As operações que esperam (connect, accept, recv) respondem mais tarde com uma
  mensagem `{clause_socket, Socket, Reply}` ao seu chamador, pelo que o
  chamador bloqueia num `receive` comum e os outros processos continuam a
  correr. Um timeout cancela o pedido; o próprio cancelamento responde
  `cancelled` depois de tudo o que o socket tenha enviado antes, pelo que uma
  resposta que tenha ganho a corrida é devolvida em vez de perdida.
- As mensagens de sockets são descritas fora do heap (`ports/value.hpp`) e
  construídas no heap do recetor quando entregues
  ([tarefas de portas](#port-tasks)). Uma ligação aceite torna-se uma nova
  porta detida pelo chamador de `accept` e ligada a ele, com o modo do socket
  de escuta.
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
- Endereços e anfitriões: `inet:parse_address/1,2`,
  `parse_strict_address/1,2`, `parse_ipv4_address/1`,
  `parse_ipv4strict_address/1`, `parse_ipv6_address/1`,
  `parse_ipv6strict_address/1` (as formas relaxadas do OTP: campos IPv4 curtos
  e octais ou hexadecimais, `::`, caudas IPv4, `%scope` de `fe80::` e
  `ff02::`), `ntoa/1` (a grafia do OTP: hexadecimal em minúsculas, a primeira
  sequência de zeros mais longa como `::`), `is_ipv4_address/1`,
  `is_ipv6_address/1`, `is_ip_address/1` são Erlang; `gethostname/0` (uma
  operação de socket), `getaddr/2`, `getaddrs/2` (o resolvedor do sistema,
  `getaddrinfo`) e `gethostbyname/1,2` (`h_name` é o nome pedido, sem aliases)
  respondem através de uma porta de socket aberta para a consulta.
- Serviços, pesquisas inversas e interfaces (`inet:getservbyname/2`,
  `getservbyport/2`, `gethostbyaddr/1`, `getifaddrs/0,1`) são builtins de
  `clause_net` partilhados com `net` ([nomes de rede](builtins.md#network-names)).
- `gen_tcp`, `gen_udp`, `inet` e `net` do Clause são a camada de rede; o módulo
  `socket` do OTP (a API NIF de sockets) está em falta, tal como `prim_socket`,
  `prim_net`, `prim_inet` e `socket_registry`.

## O registo

`win32reg` abre `{spawn_driver, "clause_registry"}` no Windows
(`runtime/src/ports/registry_windows.cpp`). O driver mantém o estado do driver
de registo do OTP (o acesso pedido, a chave atual e a sua raiz, inicialmente
`HKEY_CLASSES_ROOT`) e responde aos nove comandos do OTP como operações
síncronas de `port_control/3` com as respostas que o driver do OTP envia como
dados da porta: `o`, `e` e o nome errno (danos no registo dão `eio`, uma chave
eliminada `einval`, os outros erros do Windows conforme o mapeamento do runtime
de C), `k` e um nome de chave, `v`, o tipo, nome e dados (strings sem o zero
final, DWORDs big-endian), `s` e a chave atual. As listagens devolvem todas as
respostas, cada uma precedida pelo seu tamanho de 32 bits. Os nomes e as
strings usam a página de códigos ANSI, como no driver do OTP.

## Não fornecido

Drivers linked-in e NIFs, `erlang:open_port({spawn_driver, Name})` para nomes
de drivers do OTP, portas de distribuição, `port_call/3` sobre os drivers
fornecidos para além do protocolo próprio da biblioteca, portas de sockets
ocupadas, e as opções `overlapped_io`, `parallelism` e `busy_limits_msgq`.
