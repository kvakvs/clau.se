---
source: docs/ports.md
sourceCommit: 06042fa
sourceSha256: ffc81af5614a310568c39bb585031013ebcf0a5b801da59a58e2b7fa8ef0fa3c
translatedAt: 2026-10-09
---
# Puertos

Decisión del plan 11 step 57A (2026-10-08). Sustituye la decisión del step 53
(sin puertos, [procesos](processes.md#ports)): los programas obtienen puertos
tal como los define OTP, y la E/S externa pasa por ellos. Los steps 57B–57F
la implementan; cada sección nombra su step. Este contrato fija la
representación, el modelo de drivers y el hilo de E/S antes de que ningún
código fuente pueda abrir un puerto.

Implementado: las identidades, la tabla de puertos, los builtins y mensajes
de puertos, los enlaces, monitores, nombres y señales de salida de los
puertos, y los puertos `fd` de solo salida (step 57B,
`runtime/src/scheduler/ports.cpp`, `runtime/src/builtins/ports.cpp`,
`runtime/src/ports/`; golden de OTP `executables_port_identities`); el hilo
de E/S y la entrada de puertos `fd` con delimitación por flujo, por paquetes y
por líneas (step 57C, `runtime/src/ports/io*.cpp`; golden de OTP
`executables_port_input`); los puertos de subprocesos, `os:type/0`,
`os:getenv/1` y `os:cmd/1` (step 57D, `runtime/src/ports/spawn*.cpp`,
`library/stdlib/os.erl`; golden de OTP `executables_port_spawn`); el driver
de archivos, el subconjunto `file` de la biblioteca y la entrada estándar
mediante `io:get_line`/`io:get_chars` (step 57E, `runtime/src/ports/file.cpp`,
`library/stdlib/{file,io}.erl`; golden de OTP `executables_file_io`); los
sockets (step 57F, golden de OTP `executables_sockets`); un único hilo de E/S
dirigido por eventos para todos los tipos de puerto (step 57G1,
`runtime/src/ports/reactor.cpp`; golden de OTP `executables_many_ports`,
prueba del runtime `runtime_port_io`); las tareas de puerto en los workers
del planificador (step 57G2, `runtime/src/scheduler/ports.cpp`; golden de OTP
`executables_port_fairness`); los puertos ocupados y la entrada acotada (step
57G3; goldens de OTP `executables_busy_ports`, `executables_slow_owner`).

## Identidad

- Un puerto es una palabra inmediata: etiqueta `0x7` (`TermKind2::port` bajo
  la etiqueta primaria `see_termkind2`, junto al `0x3` de los pids), con
  carga útil un número de puerto de una secuencia única para todo el proceso
  del sistema que nunca se reutiliza, como los números de pid
  ([pids](terms.md#pids-and-references)). Un runtime solo admite los números
  que ha emitido; las palabras de puerto falsificadas o ajenas se rechazan.
- Impresión: `#Port<0.N>`; `port_to_list/1` da ese texto y `list_to_port/1`
  lo analiza (badarg para cualquier otra cosa).
- Orden: números < átomos < referencias < funs < puertos < pids < tuplas,
  como en OTP; los puertos se comparan por número.
- La identidad de un puerto cerrado sigue siendo válida: `is_port/1` sigue
  siendo true, `port_info/1,2` responden `undefined` y los envíos dirigidos a
  él se descartan.
- Los puertos son inmediatos, así que la copia, la recolección y los
  mensajes no necesitan nada nuevo.

## Tabla de puertos y propiedad

- Cada runtime mantiene una tabla de puertos (número → puerto) en su
  ejecutor, protegida por el mutex del ejecutor como los enlaces y los
  nombres de los procesos ([workers](processes.md#workers)).
- Un puerto registra su driver, su proceso conectado (quien lo abrió,
  cambiado por `port_connect/2` o `{Pid, {connect, New}}`), sus enlaces, los
  monitores que hay sobre él, un nombre registrado opcional, sus opciones y
  sus contadores de bytes de entrada/salida.
- `open_port/2` enlaza el puerto nuevo con quien lo abre. Cuando el proceso
  conectado termina, su puerto se cierra; un puerto que se cierra envía
  señales de salida a sus enlaces y mensajes `'DOWN'` a sus monitores con su
  razón (`normal` para un cierre que no es un error; si no, un átomo POSIX
  como `epipe`).
- Una señal de salida que llega a un puerto lo cierra con su razón (`kill`
  de `exit/2` como `killed`), excepto `normal` a través de un enlace desde un
  proceso distinto del conectado, que solo elimina el enlace.
  `exit(Port, normal)` cierra el puerto. Un proceso conectado que se ha
  desenlazado deja su puerto abierto al terminar.
- Un mensaje de petición de un proceso distinto del conectado, o un mensaje
  mal formado, envía al proceso conectado una señal de salida `badsig` desde
  el puerto; el puerto sigue abierto.
- Las señales de salida y los mensajes de un puerto dirigidos a un proceso
  que se ejecuta en otro worker esperan a que termine la porción de tiempo de
  ese proceso (solo contienen átomos, pids y puertos); un
  `exit(Port, Reason)` con un término de razón en el heap del emisor hace que
  el builtin se vuelva a ejecutar hasta que ningún proceso enlazado o que
  monitoriza se ejecute en otro sitio, como con las señales de procesos
  ([workers](processes.md#workers)).
- Los puertos admiten nombres registrados (`register/2`) y
  `monitor(port, Port)`; `link/1` y `unlink/1` los aceptan.

## Builtins y mensajes de puerto

| Builtin o mensaje | Step |
| --- | --- |
| `is_port/1` true para puertos, `port_to_list/1`, `list_to_port/1`, `ports/0` | 57B |
| `port_info/1,2` (`name`, `links`, `id`, `connected`, `input`, `output`, `os_pid`, `monitors`, `monitored_by`, `registered_name`) | 57B |
| `port_close/1`, `port_connect/2`, `port_command/2,3` | 57B |
| `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}` | 57B |
| `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` sobre puertos; `register/2` de un puerto | 57B |
| `port_control/3`, `port_call/3` | 57B (badarg para drivers sin control); usados por los drivers de 57E/57F |
| `open_port({fd, In, Out}, Opts)` | 57B salida; entrada desde 57C |
| `open_port({spawn, Command} \| {spawn_executable, File}, Opts)` | 57D |
| Drivers internos de la biblioteca del proyecto (`file`, sockets) | 57E, 57F |

Los builtins sustituyen los diagnósticos `[ports] notimpl` del step 53; la
funcionalidad `ports` pasa a estar implementada en 57B. Los errores siguen a
OTP: `badarg` para un puerto cerrado o no válido y para argumentos
incorrectos, y la razón POSIX (`enoent`, `eacces`) como `error` para una
apertura que falla.

Los mensajes de un puerto van a su proceso conectado:
`{Port, {data, Data}}`, `{Port, eof}` (opción `eof`),
`{Port, {exit_status, Status}}` (opción `exit_status`), `{Port, closed}`
(tras `{Pid, close}`), `{Port, connected}` (al propietario anterior tras un
connect).

## Modos de datos y opciones

| Opción | Efecto |
| --- | --- |
| `stream` (por defecto), `{packet, N}` (N = 1, 2, 4) | Los bytes según llegan, o mensajes delimitados por una longitud big-endian de N bytes que también recibe la salida |
| `{line, L}` | `{eol, Line}` por línea, `{noeol, Part}` para las partes de más de `L` o un final sin terminador |
| `binary` | Los datos como binaries en lugar de listas de bytes |
| `eof` | `{Port, eof}` al final de la entrada; el puerto sigue abierto hasta que se cierra |
| `exit_status` | `{Port, {exit_status, S}}` cuando el programa sale (puertos spawn) |
| `use_stdio` (por defecto), `nouse_stdio`, `stderr_to_stdout`, `in`, `out`, `hide` | Como en OTP (`hide` no tiene efecto) |
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Puertos spawn (57D) |
| `{busy_limits_port, {Low, High} \| disabled}` | Bytes de salida encolados que hacen que el puerto esté ocupado ([puertos ocupados](#busy-ports), 57G3) |

Sin `eof`, el final de la entrada cierra el puerto con la razón `normal`,
después del mensaje `exit_status` cuando se ha pedido. Las opciones
desconocidas son `badarg`.

## Drivers

Un driver es un objeto C++ detrás de un puerto (`runtime/src/ports/`): abre
el recurso, acepta la salida (`port_command`), responde a `port_control/3`
cuando admite control, informa de la entrada y de los errores como eventos y
se cierra. Drivers:

- `fd`: descriptores existentes, salida escrita de forma síncrona (57B),
  entrada a través del hilo de E/S (57C).
- `spawn`: un programa hijo con su stdin y su stdout como tuberías (57D).
- `file`: un archivo abierto del módulo `file` de la biblioteca del
  proyecto; sus operaciones son llamadas síncronas a `port_control/3` que
  pueden bloquear al worker que ejecuta al llamante mientras dura la E/S de
  disco, como hacen los planificadores de E/S sucia (dirty I/O) de OTP (57E).
- `tcp_inet`, `udp_inet`: sockets de `gen_tcp`, `gen_udp` e `inet` de la
  biblioteca del proyecto sobre Boost.Asio; las conexiones, las aceptaciones
  y las recepciones son asíncronas (57F, [sockets](#sockets-57f)).

Los drivers internos de `file` y de los sockets se abren con
`{spawn_driver, Name}` bajo nombres de Clause, y sus operaciones de
`port_control/3` son un protocolo de Clause: los programas usan los módulos
de la biblioteca, no los protocolos `prim_inet`/`efile` de OTP.

## Hilo de E/S

Un hilo de E/S por runtime (`detail::Reactor`,
`runtime/src/ports/reactor.hpp`, step 57G1) ejecuta un `io_context` de
Boost.Asio: un puerto de finalización de E/S (I/O completion port) en
Windows, `epoll` en Linux, `kqueue` en macOS. El primer puerto que lo
necesita lo arranca; sirve a todos los tipos de puerto, así que un puerto no
cuesta ningún hilo propio:

- Tuberías de los programas lanzados: tuberías con nombre superpuestas
  (overlapped) en Windows (`windows::stream_handle`; las tuberías anónimas no
  pueden ser superpuestas), tuberías normales en los demás sistemas
  (`posix::stream_descriptor`). La salida se encola y se escribe en orden
  mediante escrituras asíncronas.
- Entrada `fd` en Linux y macOS: el hilo espera hasta que el descriptor es
  legible y después un único `read()` toma lo que haya, de modo que los
  descriptores propios del programa conservan su modo bloqueante; un archivo
  regular, que no se puede esperar, se lee de inmediato.
- Salidas de programas: en Windows, el pool de hilos de espera del sistema
  (`RegisterWaitForSingleObject`, como usa `object_handle` de Asio) espera al
  manejador del proceso y la salida se notifica en el hilo de E/S; en Linux y
  macOS, un manejador de `SIGCHLD` (`signal_set`) y `waitpid(WNOHANG)` recogen
  cada programa vigilado, también después de que su puerto se haya cerrado.
- Sockets ([sockets](#sockets-57f)).
- Excepción: un manejador de entrada `fd` en Windows (una consola o una
  tubería anónima heredada) no puede ser superpuesto, así que lo lee un hilo
  bloqueante propio, como hacen libuv y ERTS; cerrar el puerto cancela la
  lectura (`CancelSynchronousIo`) y deja terminar el hilo.

`runtime/src/ports/io*.cpp` contienen la E/S de puertos (`detail::IoService`):
sus métodos solo envían trabajo al hilo de E/S, donde vive todo el estado de
E/S.

- El hilo de E/S entrega la entrada tal como se leyó: bytes en bruto, el
  final de la entrada, un error de lectura, el estado de salida de un
  programa. Los eventos de sockets (mensajes, conexiones aceptadas) se
  entregan del mismo modo.

## Tareas de puerto

Step 57G2. Un puerto se planifica como un proceso: lo que entrega el hilo de
E/S espera en el puerto, y el puerto espera en la cola de puertos del
ejecutor hasta que un worker del planificador ejecuta su tarea.

- Los workers toman alternativamente una tarea de puerto y una porción de
  tiempo de proceso mientras ambas colas tienen trabajo, así que un puerto que
  inunda de entrada no puede dejar sin servicio a los procesos, ni los
  procesos a los puertos; un worker inactivo toma lo que esté encolado.
- Una tarea se ejecuta bajo el mutex del ejecutor durante
  `PORT_TASK_REDUCTIONS` (las 4.000 de una porción de tiempo): cada mensaje
  que entrega cuesta 100 reducciones más una por cada 64 bytes que lleva. Un
  puerto al que le queda trabajo se vuelve a encolar al final.
- La tarea delimita la entrada (`InputDecoder`): la entrada de flujo llega en
  los trozos que devuelven las lecturas; `{packet, N}` retiene los bytes
  hasta que ha llegado un paquete completo (un paquete incompleto al final de
  la entrada se descarta, como en OTP); `{line, L}` divide en `\n`, envía una
  línea de más de `L` como trozos `{noeol, Part}` y un final sin terminador
  como `{noeol, Rest}`. `port_info(P, input)` cuenta cada byte leído,
  incluidos los saltos de línea y las cabeceras de paquete, en el momento en
  que se lee.
- El final de la entrada envía `{Port, eof}` con la opción `eof`; si no,
  cierra el puerto con la razón `normal`; un error de lectura lo cierra con
  `eio`.
- Un mensaje se convierte en un mensaje a su proceso de inmediato cuando ese
  proceso no se está ejecutando en un worker (despertándolo como cualquier
  mensaje), y si no, cuando termina su porción de tiempo, así que otro hilo
  nunca toca el heap de un proceso en ejecución.
- Los comandos, cierres, conexiones y señales de salida enviados a un puerto
  actúan de inmediato en el worker del emisor, como hace ERTS para un puerto
  que no está ocupado: un puerto `fd` escribe su salida de inmediato en el
  worker del llamante; los drivers de tuberías y de sockets encolan la salida
  y dejan que la escriba el hilo de E/S (57D, 57F, 57G1); un puerto ocupado
  suspende al emisor ([puertos ocupados](#busy-ports)).

El prototipo `tests/prototypes/poller/` (`run.py --wsl`) muestra el
despertar en Windows (puerto de finalización) y en Linux bajo WSL (`poll()`):
un hilo planificador inactivo despierta 9–91 µs después de la entrada, y el
apagado detiene el hilo de E/S sin entrada.

Al final del programa se cierran todos los puertos (los programas hijos ven
el final de la entrada; no se matan, como en OTP) y el hilo de E/S se
detiene: se espera (join) fuera del mutex del ejecutor, porque una entrega en
curso lo toma; un lector `fd` de Windows bloqueado en una lectura que no se
puede cancelar se desacopla y ya no entrega nada más.

## Puertos ocupados

Step 57G3. La salida que un driver encola para el hilo de E/S (las tuberías
de los programas lanzados) cuenta para los límites de ocupación del puerto,
el `busy_limits_port` de OTP (por defecto: alto 8.192 bytes, bajo 4.096;
`{busy_limits_port, {Low, High}}` o `disabled` como opción de `open_port/2`,
límites de al menos 1, y un límite bajo superior al alto se rebaja a este):

- Una escritura que lleva la salida encolada hasta el límite alto o por
  encima sigue saliendo y deja el puerto ocupado; sigue ocupado hasta que el
  hilo de E/S ha escrito lo suficiente para que quede encolado menos del
  límite bajo.
- `port_command/2` y `Port ! {Pid, {command, Data}}` dirigidos a un puerto
  ocupado suspenden al emisor, que no escribe nada; en cuanto el puerto deja
  de estar ocupado, o se cierra, el emisor vuelve a ejecutar su builtin (un
  puerto cerrado da entonces `badarg`, como en OTP). Un proceso suspendido
  sigue recibiendo señales de salida.
- `port_command/3` con `nosuspend` devuelve `false` para un puerto ocupado y
  no escribe nada; `force` lanza `notsup`, ya que los drivers spawn y `fd` de
  OTP no lo permiten.
- `port_info(P, queue_size)` es la salida encolada y aún no escrita.
- Los puertos `fd` escriben de inmediato y la salida de los sockets pasa por
  `port_control/3`, así que ninguno de los dos está nunca ocupado.

Un puerto también acota la entrada que retiene:

- Cuando más de 64 KiB de entrada en bruto esperan a la tarea del puerto, el
  hilo de E/S deja de leer el puerto (un programa que escribe en él se
  bloquea entonces, como con una tubería llena) hasta que la tarea la ha
  reducido por debajo de 32 KiB.
- Mientras el proceso conectado puede ejecutarse (está en ejecución o
  encolado, no esperando en un `receive`, suspendido ni bloqueado) y ya tiene
  1.024 mensajes (o tiene esa cantidad de señales de puerto esperando a que
  termine su porción de tiempo), la tarea del puerto no entrega nada más
  hasta que haya terminado la porción de ese proceso. Un proceso que espera
  en un `receive` siempre recibe la entrada, así que un receive de un mensaje
  posterior del puerto no puede esperar para siempre.

## Subprocesos

Step 57D. `open_port({spawn, Command}, Options)` y
`open_port({spawn_executable, File}, Options)` arrancan un programa cuyos
stdin y stdout son tuberías del puerto:

- `{spawn, Command}`: en Linux y macOS, `/bin/sh -c Command`; en Windows,
  `CreateProcessW` con `Command` como línea de órdenes (encuentra el programa
  en la ruta de búsqueda). `{spawn_executable, File}` ejecuta `File` sin
  shell, con argv[0] `{arg0, A}` (por defecto `File`) y `{args, List}`; en
  Windows los argumentos se entrecomillan según las reglas de
  `CommandLineToArgvW`.
- `{env, [{Name, Value | false}]}` fija o elimina variables del hijo,
  `{cd, Dir}` su directorio, `stderr_to_stdout` une stderr al puerto; en caso
  contrario, el hijo comparte el stderr del programa. `in` no abre tubería
  stdin y `out` no abre tubería stdout (en su lugar, el dispositivo nulo).
  `hide` y `overlapped_io` no tienen efecto.
- Un programa que no se puede arrancar lanza `error:Reason` con la razón
  POSIX (`enoent`, `eacces`, `enoexec`); los nombres y las opciones
  incorrectos lanzan `badarg`.
- La salida se encola y la escribe el hilo de E/S, con los límites de
  ocupación del puerto ([puertos ocupados](#busy-ports)); cerrar el puerto le
  deja terminar lo encolado y después cierra el stdin del programa. El
  programa nunca se mata; normalmente termina al final de la entrada.
- La opción `exit_status` envía `{Port, {exit_status, S}}` una vez que el
  programa ha salido (su código de salida; en Linux y macOS, 128 más la señal
  para un programa terminado por una señal) y antes de `{Port, eof}` o del
  cierre al final de la entrada; un puerto que no lee nada lo notifica cuando
  el programa sale y después se cierra.
- `port_info(P, os_pid)` es el identificador de proceso del programa; `name`
  es el comando o el archivo.
- El `os:cmd/1` de la biblioteca ejecuta `Command` con `COMSPEC /c` en
  Windows (`cmd` si no está definida) o con `/bin/sh -c`, recoge stdout y
  stderr hasta que el programa los cierra y devuelve los bytes como una
  lista; `os:type/0` es `{win32, nt}`, `{unix, linux}` o `{unix, darwin}`;
  `os:getenv/1` devuelve una cadena o `false`.

## E/S estándar y archivos

Step 57E.

- `io:format`, `io:put_chars` y `erlang:display` siguen escribiendo
  directamente en la salida estándar ([io](io.md)). La entrada estándar la
  lee un único proceso servidor de la biblioteca, registrado como
  `clause_stdin` y arrancado en el primer uso, que posee un puerto
  `{fd, 0, 1}`: `io:get_line/1,2` escribe el indicador (prompt) y después
  devuelve la siguiente línea con su salto de línea, el resto de la entrada
  sin él al final, y después `eof`; `io:get_chars/2,3` devuelve hasta `N`
  caracteres y después `eof`. Las peticiones de varios procesos se responden
  en orden de llegada. La entrada se devuelve como bytes (un elemento de
  lista por byte).
- El módulo `file` de la biblioteca maneja el driver de archivos del
  runtime, `{spawn_driver, "clause_file"}`, con `port_control/3`. Sus
  operaciones (`ports/file.cpp`: open, read, write, position, read_line,
  close, y las operaciones sobre rutas read_file, write_file, delete, rename,
  list_dir, make_dir, del_dir) son llamadas síncronas al sistema en el worker
  del llamante, fuera del mutex del ejecutor; sus respuestas empiezan con un
  byte de estado (0 ok, 1 error y su razón POSIX, 2 fin de archivo). El
  protocolo es propio de Clause.
- `file:open/2` devuelve el pid de un servidor de E/S que posee un puerto de
  archivo y está enlazado con quien lo abre (modos `read`, `write`, `append`,
  `exclusive`, `binary`; los demás modos se ignoran, como OTP ignora las
  opciones que no usa). `read/2`, `read_line/1`, `write/2`, `position/2` e
  `io:get_line/2`, `io:get_chars/3` sobre él son peticiones a ese servidor;
  después de `close/1` las peticiones devuelven `{error, terminated}` y
  `close/1` sigue devolviendo `ok`.
- Los errores siguen a OTP: `{error, enoent}`, `eexist`, `eisdir` (un
  directorio abierto o leído como archivo), `einval` (una posición negativa),
  `ebadf` (leer un archivo de solo escritura o escribir uno de solo lectura),
  `badarg` para nombres y datos incorrectos. Los nombres de archivo son
  cadenas, binaries o átomos, codificados como UTF-8.
- Un módulo referenciado por el programa que es un builtin del catálogo
  (`io:format`) ya no arrastra al programa el módulo de biblioteca de ese
  nombre; solo lo hace una llamada a una de sus funciones Erlang.

## Sockets (57F)

Un socket es un puerto, como con el backend `inet_drv` de OTP:
`is_port(Socket)` es true y los mensajes en modo activo son
`{tcp, Socket, Data}`, `{tcp_closed, Socket}`,
`{tcp_error, Socket, Reason}`, `{udp, Socket, Address, Port, Data}`. El
subconjunto: `gen_tcp:connect/3,4`, `listen/2`, `accept/1,2`, `send/2`,
`recv/2,3`, `close/1`, `controlling_process/2`, `shutdown/2`;
`gen_udp:open/1,2`, `send/4`, `recv/2,3`, `close/1`; `inet:setopts/2`,
`inet:port/1`, `inet:peername/1`, `inet:sockname/1`; los modos
`{active, true | false | once}`, `binary`/`list`,
`{packet, 0 | 1 | 2 | 4 | raw}`, `{reuseaddr, Bool}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6`; direcciones IPv4 e IPv6
como tuplas, nombres de host como cadenas o átomos (incluido `loopback`). Las
opciones de ajuste `nodelay`, `keepalive`, `send_timeout`,
`send_timeout_close`, `delay_send` y `exit_on_close` se aceptan pero no se
aplican; cualquier otra opción es `exit(badarg)`, como una opción no válida
en OTP.

Implementación (`runtime/src/ports/sockets.cpp`):

- El hilo de E/S del runtime ([hilo de E/S](#io-thread)) sirve a los
  sockets; el estado de cada socket vive en ese hilo. La biblioteca abre un
  puerto con `{spawn_driver, "tcp_inet" | "udp_inet"}` y lo maneja con
  `port_control/3`; el worker que llama envía la operación al hilo de E/S y
  espera su respuesta síncrona (byte de estado 0 y un resultado, o 1 y una
  razón POSIX).
- Las operaciones que esperan (connect, accept, recv) responden más tarde
  con un mensaje `{clause_socket, Socket, Reply}` a su llamante, así que el
  llamante se bloquea en un `receive` ordinario y los demás procesos siguen
  ejecutándose. Un tiempo de espera cancela la petición; la propia
  cancelación responde `cancelled` después de todo lo que el socket haya
  enviado antes, de modo que una respuesta que ganó la carrera se devuelve en
  lugar de perderse.
- Los mensajes de socket se describen fuera del heap (`ports/value.hpp`) y se
  construyen en el heap del receptor al entregarse, según las reglas del
  ejecutor de [hilo de E/S](#io-thread). Una conexión aceptada se convierte en
  un puerto nuevo cuyo propietario es el llamante de `accept`, enlazado con
  él, y con el modo del socket de escucha.
- `controlling_process/2` detiene la entrega activa, traslada al nuevo
  propietario los mensajes del socket ya enviados al antiguo y después
  reconecta el puerto, como hace `inet` de OTP; solo el propietario puede
  llamarlo (`{error, not_owner}`).
- La salida se encola sin límite y se escribe en orden en el hilo de E/S.
  Cerrar un puerto envía lo encolado y después cierra la conexión de forma
  ordenada (FIN); un puerto cerrado responde `{error, closed}` a cada
  llamante en espera. La resolución de nombres se ejecuta en el worker del
  llamante, ya que bloquea.
- Los puertos de socket se planifican como los demás puertos
  ([tareas de puerto](#port-tasks)): los mensajes de un socket esperan en su
  puerto hasta que la tarea del puerto los entrega.

## No proporcionado

Los drivers enlazados (linked-in drivers) y los NIF,
`erlang:open_port({spawn_driver, Name})` para nombres de drivers de OTP, los
puertos de distribución, `port_call/3` sobre los drivers proporcionados
fuera del protocolo propio de la biblioteca, los puertos de socket ocupados,
y las opciones `overlapped_io`, `parallelism` y `busy_limits_msgq`.
