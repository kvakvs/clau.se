---
source: docs/ports.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 0b9c882a696b24690dffccf55456c63d826a600ed7e2be286259a5df3eb6bf57
translatedAt: 2026-10-26
---
# Puertos

Los programas obtienen puertos tal como los define OTP, y la E/S externa pasa
por ellos. La tabla de puertos, las reglas de salida y las tareas de puerto
están en `runtime/src/scheduler/ports.cpp`, los builtins en
`runtime/src/builtins/erlang/ports.cpp`, y los drivers y el hilo de E/S en
`runtime/src/ports/`. Goldens de OTP: `executables_port_identities`,
`executables_port_input`, `executables_port_spawn`, `executables_file_io`,
`executables_sockets`, `executables_many_ports`, `executables_port_fairness`,
`executables_busy_ports`, `executables_slow_owner`; prueba del runtime
`runtime_port_io`.

## Identidad

- Un puerto es una palabra inmediata: etiqueta `0x7` (`TermKind2::port` bajo la
  etiqueta primaria `see_termkind2`, junto al `0x3` de los pids), con carga útil
  un número de puerto de una secuencia única para todo el proceso del sistema
  que nunca se reutiliza, como los números de pid
  ([pids](terms.md#pids-and-references)). Un runtime solo admite los números que
  ha emitido; las palabras de puerto falsificadas o ajenas se rechazan.
- Impresión: `#Port<0.N>`; `port_to_list/1` da ese texto y `list_to_port/1` lo
  analiza (badarg para cualquier otra cosa).
- Orden: números < átomos < referencias < funs < puertos < pids < tuplas, como
  en OTP; los puertos se comparan por número.
- La identidad de un puerto cerrado sigue siendo válida: `is_port/1` sigue
  siendo true, `port_info/1,2` responden `undefined` y los envíos dirigidos a él
  se descartan.
- Los puertos son inmediatos, así que la copia, la recolección y los mensajes no
  necesitan nada nuevo.

## Tabla de puertos y propiedad

- Cada runtime mantiene una tabla de puertos (número → puerto) en su ejecutor,
  protegida por el mutex del ejecutor como los enlaces y los nombres de los
  procesos ([hilos de trabajo](processes.md#workers)).
- Un puerto registra su driver, su proceso conectado (quien lo abrió, cambiado
  por `port_connect/2` o `{Pid, {connect, New}}`), sus enlaces, los monitores
  que hay sobre él, un nombre registrado opcional, sus opciones y sus contadores
  de bytes de entrada/salida.
- `open_port/2` enlaza el puerto nuevo con quien lo abre. Cuando el proceso
  conectado termina, su puerto se cierra; un puerto que se cierra envía señales
  de salida a sus enlaces y mensajes `'DOWN'` a sus monitores con su razón
  (`normal` para un cierre que no es un error; si no, un átomo POSIX como
  `epipe`).
- Una señal de salida que llega a un puerto lo cierra con su razón (`kill` de
  `exit/2` como `killed`), excepto `normal` a través de un enlace desde un
  proceso distinto del conectado, que solo elimina el enlace.
  `exit(Port, normal)` cierra el puerto. Un proceso conectado que se ha
  desenlazado deja su puerto abierto al terminar.
- Un mensaje de petición de un proceso distinto del conectado, o un mensaje mal
  formado, envía al proceso conectado una señal de salida `badsig` desde el
  puerto; el puerto sigue abierto.
- Las señales de salida y los mensajes de un puerto dirigidos a un proceso que
  se ejecuta en otro hilo de trabajo esperan a que termine la porción de tiempo
  de ese proceso (solo contienen átomos, pids y puertos); un
  `exit(Port, Reason)` con un término de razón en el heap del emisor hace que el
  builtin se vuelva a ejecutar hasta que ningún proceso enlazado o que
  monitoriza se ejecute en otro sitio, como con las señales de procesos
  ([hilos de trabajo](processes.md#workers)).
- Los puertos admiten nombres registrados (`register/2`) y `monitor(port, Port)`;
  `link/1` y `unlink/1` los aceptan.

## Builtins y mensajes de puerto

- `is_port/1` (true para puertos), `port_to_list/1`, `list_to_port/1`,
  `ports/0`.
- `port_info/1,2`: `name`, `links`, `id`, `connected`, `input`, `output`,
  `os_pid`, `monitors`, `monitored_by`, `registered_name`, `queue_size`
  ([puertos ocupados](#busy-ports)).
- `port_close/1`, `port_connect/2`, `port_command/2,3`; los mensajes
  `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}`.
- `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` sobre puertos;
  `register/2` de un puerto.
- `port_control/3`, `port_call/3`: `badarg` para drivers sin control; los
  drivers `file` y de sockets se manejan mediante `port_control/3`.
- `open_port({fd, In, Out}, Opts)`, `open_port({spawn, Command}, Opts)`,
  `open_port({spawn_executable, File}, Opts)` y los drivers internos de la
  biblioteca del proyecto (`file`, sockets).

Los errores siguen a OTP: `badarg` para un puerto cerrado o no válido y para
argumentos incorrectos, y la razón POSIX (`enoent`, `eacces`) como `error` para
una apertura que falla.

Los mensajes de un puerto van a su proceso conectado: `{Port, {data, Data}}`,
`{Port, eof}` (opción `eof`), `{Port, {exit_status, Status}}` (opción
`exit_status`), `{Port, closed}` (tras `{Pid, close}`), `{Port, connected}` (al
propietario anterior tras un connect).

## Modos de datos y opciones

| Opción | Efecto |
| --- | --- |
| `stream` (por defecto), `{packet, N}` (N = 1, 2, 4) | Los bytes según llegan, o mensajes delimitados por una longitud big-endian de N bytes que también recibe la salida |
| `{line, L}` | `{eol, Line}` por línea, `{noeol, Part}` para las partes de más de `L` o un final sin terminador |
| `binary` | Los datos como binaries en lugar de listas de bytes |
| `eof` | `{Port, eof}` al final de la entrada; el puerto sigue abierto hasta que se cierra |
| `exit_status` | `{Port, {exit_status, S}}` cuando el programa sale (puertos spawn) |
| `use_stdio` (por defecto), `nouse_stdio`, `stderr_to_stdout`, `in`, `out`, `hide` | Como en OTP (`hide` no tiene efecto) |
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Puertos spawn ([subprocesos](#subprocesses)) |
| `{busy_limits_port, {Low, High} \| disabled}` | Bytes de salida encolados que hacen que el puerto esté ocupado ([puertos ocupados](#busy-ports)) |

Sin `eof`, el final de la entrada cierra el puerto con la razón `normal`,
después del mensaje `exit_status` cuando se ha pedido. Las opciones desconocidas
son `badarg`.

## Drivers

Un driver es un objeto C++ detrás de un puerto (`runtime/src/ports/`): abre el
recurso, acepta la salida (`port_command`), responde a `port_control/3` cuando
admite control, informa de la entrada y de los errores como eventos y se cierra.
Drivers:

- `fd`: descriptores existentes, salida escrita de forma síncrona, entrada a
  través del hilo de E/S.
- `spawn`: un programa hijo con su stdin y su stdout como tuberías
  ([subprocesos](#subprocesses)).
- `file`: un archivo abierto del módulo `file` de la biblioteca del proyecto;
  sus operaciones son llamadas síncronas a `port_control/3` que pueden bloquear
  al hilo de trabajo que ejecuta al llamante mientras dura la E/S de disco, como
  hacen los planificadores de E/S sucia (dirty I/O) de OTP
  ([archivos](#standard-io-and-files)).
- `tcp_inet`, `udp_inet`: sockets de `gen_tcp`, `gen_udp` e `inet` de la
  biblioteca del proyecto sobre Boost.Asio; las conexiones, las aceptaciones y
  las recepciones son asíncronas ([sockets](#sockets)).

- `clause_registry` (Windows): el registro de `win32reg`
  ([el registro](#the-registry)).

Los drivers internos de `file`, de los sockets y del registro se abren con
`{spawn_driver, Name}` bajo nombres de Clause, y sus operaciones de
`port_control/3` son un protocolo de Clause: los programas usan los módulos de
la biblioteca, no los protocolos `prim_inet`/`efile` de OTP.

## Hilo de E/S

Un hilo de E/S por runtime (`detail::Reactor`, `runtime/src/ports/reactor.hpp`)
ejecuta un `io_context` de Boost.Asio: un puerto de finalización de E/S (I/O
completion port) en Windows, `epoll` en Linux, `kqueue` en macOS. El primer
puerto que lo necesita lo arranca; sirve a todos los tipos de puerto, así que un
puerto no cuesta ningún hilo propio:

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
- Sockets ([sockets](#sockets)).
- Excepción: un manejador de entrada `fd` en Windows (una consola o una tubería
  anónima heredada) no puede ser superpuesto, así que lo lee un hilo bloqueante
  propio, como hacen libuv y ERTS; cerrar el puerto cancela la lectura
  (`CancelSynchronousIo`) y deja terminar el hilo.

`runtime/src/ports/io*.cpp` contienen la E/S de puertos (`detail::IoService`):
sus métodos solo envían trabajo al hilo de E/S, donde vive todo el estado de
E/S. El hilo de E/S entrega la entrada tal como se leyó: bytes en bruto, el
final de la entrada, un error de lectura, el estado de salida de un programa.
Los eventos de sockets (mensajes, conexiones aceptadas) se entregan del mismo
modo.

El prototipo `tests/prototypes/poller/` (`run.py --wsl`) muestra el despertar en
Windows (puerto de finalización) y en Linux bajo WSL (`poll()`): un hilo
planificador inactivo despierta 9–91 µs después de la entrada, y el apagado
detiene el hilo de E/S sin entrada.

Al final del programa se cierran todos los puertos (los programas hijos ven el
final de la entrada; no se matan, como en OTP) y el hilo de E/S se detiene: se
espera (join) fuera del mutex del ejecutor, porque una entrega en curso lo toma;
un lector `fd` de Windows bloqueado en una lectura que no se puede cancelar se
desacopla y ya no entrega nada más.

## Tareas de puerto

Un puerto se planifica como un proceso: lo que entrega el hilo de E/S espera en
el puerto, y el puerto espera en la cola de puertos del ejecutor hasta que un
hilo de trabajo del planificador ejecuta su tarea.

- Los hilos de trabajo toman alternativamente una tarea de puerto y una porción
  de tiempo de proceso mientras ambas colas tienen trabajo, así que un puerto
  que inunda de entrada no puede dejar sin servicio a los procesos, ni los
  procesos a los puertos; un hilo de trabajo inactivo toma lo que esté
  encolado.
- Una tarea se ejecuta bajo el mutex del ejecutor durante
  `PORT_TASK_REDUCTIONS` (las 4.000 de una porción de tiempo): cada mensaje que
  entrega cuesta 100 reducciones más una por cada 64 bytes que lleva. Un puerto
  al que le queda trabajo se vuelve a encolar al final.
- La tarea delimita la entrada (`InputDecoder`): la entrada de flujo llega en
  los trozos que devuelven las lecturas; `{packet, N}` retiene los bytes hasta
  que ha llegado un paquete completo (un paquete incompleto al final de la
  entrada se descarta, como en OTP); `{line, L}` divide en `\n`, envía una línea
  de más de `L` como trozos `{noeol, Part}` y un final sin terminador como
  `{noeol, Rest}`. `port_info(P, input)` cuenta cada byte leído, incluidos los
  saltos de línea y las cabeceras de paquete, en el momento en que se lee.
- El final de la entrada envía `{Port, eof}` con la opción `eof`; si no, cierra
  el puerto con la razón `normal`; un error de lectura lo cierra con `eio`.
- Un mensaje se convierte en un mensaje a su proceso de inmediato cuando ese
  proceso no se está ejecutando en un hilo de trabajo (despertándolo como
  cualquier mensaje), y si no, cuando termina su porción de tiempo, así que otro
  hilo nunca toca el heap de un proceso en ejecución.
- Los comandos, cierres, conexiones y señales de salida enviados a un puerto
  actúan de inmediato en el hilo de trabajo del emisor, como hace ERTS para un
  puerto que no está ocupado: un puerto `fd` escribe su salida de inmediato en
  el hilo de trabajo del llamante; los drivers de tuberías y de sockets encolan
  la salida y dejan que la escriba el hilo de E/S; un puerto ocupado suspende al
  emisor ([puertos ocupados](#busy-ports)).

## Puertos ocupados

La salida que un driver encola para el hilo de E/S (las tuberías de los
programas lanzados) cuenta para los límites de ocupación del puerto, el
`busy_limits_port` de OTP (por defecto: alto 8.192 bytes, bajo 4.096;
`{busy_limits_port, {Low, High}}` o `disabled` como opción de `open_port/2`,
límites de al menos 1, y un límite bajo superior al alto se rebaja a este):

- Una escritura que lleva la salida encolada hasta el límite alto o por encima
  sigue saliendo y deja el puerto ocupado; sigue ocupado hasta que el hilo de
  E/S ha escrito lo suficiente para que quede encolado menos del límite bajo.
- `port_command/2` y `Port ! {Pid, {command, Data}}` dirigidos a un puerto
  ocupado suspenden al emisor, que no escribe nada; en cuanto el puerto deja de
  estar ocupado, o se cierra, el emisor vuelve a ejecutar su builtin (un puerto
  cerrado da entonces `badarg`, como en OTP). Un proceso suspendido sigue
  recibiendo señales de salida.
- `port_command/3` con `nosuspend` devuelve `false` para un puerto ocupado y no
  escribe nada; `force` lanza `notsup`, ya que los drivers spawn y `fd` de OTP
  no lo permiten.
- `port_info(P, queue_size)` es la salida encolada y aún no escrita.
- Los puertos `fd` escriben de inmediato y la salida de los sockets pasa por
  `port_control/3`, así que ninguno de los dos está nunca ocupado.

Un puerto también acota la entrada que retiene:

- Cuando más de 64 KiB de entrada en bruto esperan a la tarea del puerto, el
  hilo de E/S deja de leer el puerto (un programa que escribe en él se bloquea
  entonces, como con una tubería llena) hasta que la tarea la ha reducido por
  debajo de 32 KiB.
- Mientras el proceso conectado puede ejecutarse (está en ejecución o encolado,
  no esperando en un `receive`, suspendido ni bloqueado) y ya tiene 1.024
  mensajes (o tiene esa cantidad de señales de puerto esperando a que termine su
  porción de tiempo), la tarea del puerto no entrega nada más hasta que haya
  terminado la porción de ese proceso. Un proceso que espera en un `receive`
  siempre recibe la entrada, así que un receive de un mensaje posterior del
  puerto no puede esperar para siempre.

## Subprocesos

`open_port({spawn, Command}, Options)` y
`open_port({spawn_executable, File}, Options)` arrancan un programa cuyos stdin
y stdout son tuberías del puerto:

- `{spawn, Command}`: en Linux y macOS, `/bin/sh -c Command`; en Windows,
  `CreateProcessW` con `Command` como línea de órdenes (encuentra el programa en
  la ruta de búsqueda). `{spawn_executable, File}` ejecuta `File` sin shell, con
  argv[0] `{arg0, A}` (por defecto `File`) y `{args, List}`; en Windows los
  argumentos se entrecomillan según las reglas de `CommandLineToArgvW`.
- `{env, [{Name, Value | false}]}` fija o elimina variables del hijo,
  `{cd, Dir}` su directorio, `stderr_to_stdout` une stderr al puerto; en caso
  contrario, el hijo comparte el stderr del programa. `in` solo no abre tubería
  stdin y `out` solo no abre tubería stdout (en su lugar, el dispositivo nulo);
  con ambas opciones o con ninguna, el puerto tiene las dos, como en OTP.
  `hide` y `overlapped_io` no tienen efecto.
- Un programa que no se puede arrancar lanza `error:Reason` con la razón POSIX
  (`enoent`, `eacces`, `enoexec`); los nombres y las opciones incorrectos lanzan
  `badarg`.
- La salida se encola y la escribe el hilo de E/S, con los límites de ocupación
  del puerto ([puertos ocupados](#busy-ports)); cerrar el puerto le deja
  terminar lo encolado y después cierra el stdin del programa. El programa nunca
  se mata; normalmente termina al final de la entrada.
- La opción `exit_status` envía `{Port, {exit_status, S}}` una vez que el
  programa ha salido (su código de salida; en Linux y macOS, 128 más la señal
  para un programa terminado por una señal) y antes de `{Port, eof}` o del
  cierre al final de la entrada; un puerto que no lee nada lo notifica cuando el
  programa sale y después se cierra.
- `port_info(P, os_pid)` es el identificador de proceso del programa; `name` es
  el comando o el archivo.
- El `os:cmd/1` de la biblioteca ejecuta `Command` con `COMSPEC /c` en Windows
  (`cmd` si no está definida) o con `/bin/sh -c`, recoge stdout y stderr hasta
  que el programa los cierra y devuelve los bytes como una lista; `os:type/0` es
  `{win32, nt}`, `{unix, linux}` o `{unix, darwin}`; `os:getenv/1` devuelve una
  cadena o `false`.

## E/S estándar y archivos

- `io:format`, `io:put_chars` y `erlang:display` escriben directamente en la
  salida estándar ([io](io.md)). La entrada estándar la lee un único proceso
  servidor de la biblioteca, registrado como `clause_stdin` y arrancado en el
  primer uso, que posee un puerto `{fd, 0, 1}`: `io:get_line/1,2` escribe el
  indicador (prompt) y después devuelve la siguiente línea con su salto de
  línea, el resto de la entrada sin él al final, y después `eof`;
  `io:get_chars/2,3` devuelve hasta `N` caracteres y después `eof`. Las
  peticiones de varios procesos se responden en orden de llegada. La entrada se
  decodifica de UTF-8 a caracteres, como OTP lee su terminal; el servidor conserva
  las opciones de `standard_io` sin shell de OTP (`binary`, `encoding`, `echo`,
  `log`; `io:getopts/0,1`, `io:setopts/1,2`): el modo binario devuelve binaries,
  `echo` escribe la entrada consumida en la salida estándar y `get_password` es
  `{error, enotsup}` sin shell, como en OTP.
- Los servidores de archivos responden a `getopts` y `setopts` como el servidor
  de E/S de archivos de OTP (`binary`/`list` y `encoding`; `file:open/2` acepta
  `{encoding, E}`): las peticiones de E/S (`io:get_line`, `get_chars`,
  `put_chars`, `get_until`) codifican y decodifican la codificación del
  dispositivo, y `file:read/2`, `read_line/1` sobre un archivo codificado
  responden como peticiones latin1 `get_chars`/`get_line` (`no_translation` por
  encima de 255, que detiene el servidor). La salida de `io:format/3`,
  `io:put_chars/2`, `io:nl/1` a cualquier pid es una petición `put_chars` del
  protocolo de E/S.
- El módulo `file` de la biblioteca maneja el driver de archivos del runtime,
  `{spawn_driver, "clause_file"}`, con `port_control/3`. Sus operaciones
  (`ports/file.cpp`: open, read, write, position, read_line, sync, close, y las
  operaciones sobre rutas read_file, write_file, delete, rename, list_dir,
  make_dir, del_dir y read_file_info, `ports/file_info.cpp`; get_cwd, set_cwd,
  read_link, read_link_info, make_link y make_symlink, `ports/file_paths.cpp`)
  son llamadas síncronas al sistema en el hilo de trabajo del llamante, fuera
  del mutex del ejecutor; sus respuestas empiezan con un byte de estado (0 ok, 1
  error y su razón POSIX, 2 fin de archivo). El protocolo es propio de Clause.
  read_line lee 64 KB por adelantado y devuelve líneas de ese búfer; cualquier
  otra operación sobre el archivo retrocede primero sobre los bytes que no ha
  devuelto, de modo que las posiciones siguen siendo exactas.
- Las operaciones sobre rutas hacen las llamadas al sistema de OTP y nada más:
  el estado de una ruta se lee solo cuando falla una apertura o eliminación
  (para responder `eisdir` o `eperm`), delete desenlaza un archivo y nunca
  elimina un directorio, y read_file lee un archivo hasta el tamaño que indica
  su descriptor, como OTP, sin lecturas para sondear su final.
- `port_control/3` entrega un binary o `[]` al driver en su ubicación original
  (los demás iodata se aplanan primero), y la respuesta se convierte en el
  binary de resultado sin copiarse: las respuestas son `ByteBuffer`s
  (`runtime/include/byte_buffer.hpp`), vectores de bytes que crecen sin ponerse
  a cero, de modo que una lectura rellena los bytes de su respuesta una sola vez.
- `file:open/2` devuelve el pid de un servidor de E/S que posee un puerto de
  archivo y se cierra cuando termina quien lo abre, como en OTP (en Windows el
  archivo se comparte para lectura, escritura y eliminación, como lo abre OTP,
  por lo que un archivo abierto se puede eliminar o renombrar) (modos `read`,
  `write`, `append`, `exclusive`, `binary`, `raw`; los demás modos se ignoran,
  como OTP ignora las opciones que no usa; `write` trunca salvo que también se
  indique `append`).
- `file:write_file/3` abre con sus modos más `binary` y `write`;
  `file:read_file_info/1,2` devuelven el `#file_info{}` de OTP a partir del
  estado de la ruta (siguiendo los enlaces), con las horas como fecha y hora
  local o universal o como segundos POSIX (`{time, local | universal | posix}`;
  se acepta `raw`). En Windows, `inode`, `uid` y `gid` son 0 y `major_device` es
  el número de unidad, como los informa OTP. `read/2`, `read_line/1`,
  `write/2`, `position/2` e `io:get_line/2`, `io:get_chars/3` sobre él son
  peticiones a ese servidor; después de `close/1` las peticiones devuelven
  `{error, terminated}` y `close/1` sigue devolviendo `ok`.
- E/S posicionada y cambios en archivos: `pread/2,3` y `pwrite/2,3` posicionan y
  después leen o escriben en un servidor de archivos (`cur` continúa leyendo,
  la posición se mueve), como hace el servidor de OTP; un archivo `raw` solo
  acepta desplazamientos enteros (`badarg` en otro caso) y conserva su posición.
  `truncate/1` corta en la posición; `advise/4` acepta los átomos de consejo de
  OTP (`posix_fadvise` en Linux, ignorado en los demás sistemas, como en OTP);
  `allocate/3` reserva espacio (`fallocate`, `F_PREALLOCATE` en macOS,
  `{error, enotsup}` en Windows), tras comprobar sus argumentos (`badarg` para
  valores no numéricos, `einval` para negativos y flotantes). Como el servidor
  de archivos de OTP, un servidor cuya escritura, escritura posicionada,
  sincronización, truncamiento o consejo falla responde con el error y termina,
  por lo que las peticiones posteriores reciben `{error, terminated}`; un
  archivo raw continúa. `write_file_info/2,3` y `change_mode/2`,
  `change_owner/2,3`, `change_group/2`, `change_time/2,3` cambian propietario,
  permisos y tiempos en el orden de prim_file (Windows: se ignoran los
  propietarios, solo se toma el atributo de solo lectura del bit de escritura
  del propietario, y también se fija la hora de creación). `sendfile/2,5` leen
  un archivo raw en bloques (como máximo 1 MiB, `chunk_size`) y los envían con
  `gen_tcp:send/2` o la fun indicada, la alternativa de OTP: Clause no tiene
  sendfile nativo. `format_error/1` proporciona los textos de OTP, los POSIX
  mediante `erl_posix_msg:message/1`.
- Líneas y lecturas fallidas: `read_line/1` e `io:get_line` leen un final CRLF
  como LF (la posición cuenta el CR), como OTP; un servidor de archivos cuya
  lectura falla responde con el error y termina, y uno cuya lectura de línea
  falla termina sin responder (el llamante recibe `{error, terminated}`), como
  el de OTP.
- `compressed` y `compressed_one`: la escritura pasa por un flujo gzip deflate
  (zlib, bits de ventana 31) que finaliza al cerrar, también cuando el servidor
  se detiene o termina quien lo abrió; la lectura descomprime un archivo que
  empieza con los bytes mágicos de gzip (`compressed` lee miembros concatenados
  como uno solo, `compressed_one` se detiene tras el primero) y lee cualquier
  otro archivo tal cual. Las posiciones cuentan bytes sin comprimir: se avanza
  leyendo o escribiendo ceros, se retrocede solo al leer (desde el principio
  otra vez), `eof` es `einval`. Leer un archivo abierto para escritura o escribir
  uno abierto para lectura es `ebadf`; `allocate/3` y, en archivos raw, la E/S
  posicionada son `enotsup`; un servidor de archivos se detiene tras `truncate`,
  `advise` y `sync` (`enotsup`), como el de OTP. Leer y escribir a la vez o
  añadir al final es `{error, einval}`.
- `{zstd, Options}`: como `compressed`, mediante un contexto zstd creado con
  `Options` (`{error, badarg}` cuando las rechaza): cada escritura es una trama
  propia y el cierre añade una vacía, como escribe la capa de OTP; la lectura
  descomprime las tramas leídas en bloques de 8 KiB.
- `ram`: el archivo es su contenido iodata en memoria, servido por un proceso
  como los demás archivos y cerrado con quien lo abre; solo admite los modos
  `read`, `write` y `binary` (`read` cuando no se indica ninguno, cualquier otro
  es `badarg`, `raw` con `ram` lanza `badarg`). Las lecturas, escrituras,
  posiciones, `pread`/`pwrite` (conservando la posición), `truncate`, `sync`,
  `advise` y `allocate` responden como el driver de archivos ram de OTP: las
  escrituras más allá del final rellenan el hueco con ceros, los desplazamientos
  y tamaños que exceden 32 bits con signo son `einval`, escribir en un archivo
  de solo lectura es `ebadf` y truncarlo, `eacces`.
- El protocolo de E/S de OTP: el servidor de la entrada estándar y el servidor
  de cada archivo abierto responden a `{io_request, From, ReplyAs, Request}` con
  `{io_reply, ReplyAs, Reply}`, que envían `io:request/1,2` e
  `io:requests/1,2` (`standard_io` y `user` designan el servidor de la entrada
  estándar, otro átomo un proceso registrado; `{error, arguments}` cuando no
  está registrado, `{error, calling_self}` para el propio llamante). Peticiones:
  `get_until` (`M:F(Cont, Chars | eof, Extra...)` desde `Cont = []`, alimentada
  con lo que hay en el búfer o con bloques de 4 KiB del archivo hasta
  `{done, Result, Rest}`; `Rest` lo vuelve a leer la siguiente petición: se
  conserva en el búfer o, para un archivo, la posición retrocede sobre él),
  `get_line`, `get_chars`, `put_chars` (caracteres o `M:F(A)`), las formas
  antiguas sin codificación (latin1) y `{requests, List}` (en orden,
  deteniéndose en el primer `{error, _}`). Los caracteres son bytes, como
  arriba; un archivo en modo binario devuelve como binary un resultado de lista
  de `get_until`. Las demás reciben `{error, {request, Request}}`. Una función de
  `get_until` o `put_chars` que falla hace que el servidor del archivo responda
  `{error, Function}` y termine con el fallo, como hace el de OTP; quien abrió el
  archivo sigue vivo (el servidor de archivos de OTP no está enlazado con él).
  Las peticiones de entrada sobre la entrada estándar escriben su indicador.
- Directorios, enlaces y copias: `get_cwd/0` escribe el directorio actual como
  lo hace OTP (barras normales, letra de unidad en minúscula), `get_cwd/1` toma
  una unidad de Windows (`enotsup` en otros sistemas); `set_cwd/1` lo cambia
  para todo el programa; `read_link/1`, `read_link_all/1` (`einval` para una
  ruta que no es un enlace), `read_link_info/1,2` (el estado propio de un enlace
  final: `lstat` de POSIX, en Windows los campos del destino con tipo
  `symlink`), `make_link/2`, `make_symlink/2` (en Windows necesita un
  privilegio: `eperm`, como OTP), `list_dir_all/1`, `del_dir_r/1`, `copy/2,3`
  (nombres, `{Name, Modes}` o archivos abiertos; `{ok, BytesCopied}`),
  `raw_read_file_info/1`, `read_file/2`, `delete/2`, `native_name_encoding/0`
  (`utf8`). `del_dir/1` responde `enoent` para una ruta inexistente y `enotdir`
  para un archivo.
- El `file` de Clause es la capa de archivos; `filelib` y `filename` de Clause
  se ejecutan sobre ella (`filelib:fold_files/5` usa `re`);
  `erl_prim_loader` se proporciona sobre `file` con las respuestas `error`
  escuetas de OTP y una ruta de carga `["."]` (`set_path/1`), y sus funciones de
  carga y de archivos comprimidos se rechazan;
  `prim_file` y `prim_buffer` siguen ausentes, por lo que los llamantes de
  `raw_file_io*` de OTP nunca entran en un programa.
- Los errores siguen a OTP: `{error, enoent}`, `eexist`, `eisdir` (un directorio
  abierto o leído como archivo), `einval` (una posición negativa; `badarg` para
  un valor que no es una ubicación), `ebadf` (leer
  un archivo de solo escritura o escribir uno de solo lectura), `badarg` para
  nombres y datos incorrectos. Los nombres de archivo son cadenas, binaries o
  átomos, codificados como UTF-8.

## Sockets

Un socket es un puerto, como con el backend `inet_drv` de OTP: `is_port(Socket)`
es true y los mensajes en modo activo son `{tcp, Socket, Data}`,
`{tcp_closed, Socket}`, `{tcp_error, Socket, Reason}`,
`{udp, Socket, Address, Port, Data}`. El subconjunto:
`gen_tcp:connect/2,3,4` (un host y un puerto, o un map de dirección de socket),
`listen/2`, `accept/1,2`, `send/2`, `recv/2,3`, `close/1`,
`controlling_process/2`, `shutdown/2`; `gen_udp:open/1,2`, `connect/2,3`,
`send/2,3,4,5` (formas de destino y datos auxiliares de OTP), `recv/2,3`,
`close/1`; `inet:setopts/2`, `getopts/2`, `getstat/1,2`, `info/1`, `i/0,1,2`,
`monitor/1`, `cancel_monitor/1`, `port/1`, `peername/1`, `peernames/1,2`,
`sockname/1`, `socknames/1,2`; los modos `{active, true | false | once}`,
`binary`/`list` (`{mode, M}`), `{packet, 0 | 1 | 2 | 4 | raw}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6`;
direcciones IPv4 e IPv6 como tuplas, nombres de host como cadenas o átomos
(incluido `loopback`).

Las opciones aparte del modo de datos (`ports/socket_options.cpp`,
`library/kernel/clause_socket_options.erl`) son records del driver con un código
y un valor, indicados al abrir un socket (se fijan antes de vincularlo o
conectarlo) o mediante `setopts/2`; todas las opciones de una llamada a
`setopts/2` se comprueban antes de fijar ninguna. Las opciones del sistema
(`reuseaddr`, `keepalive`, `dontroute`, `linger`, `broadcast`, `sndbuf`,
`recbuf`, `nodelay`, `tos`, `tclass`, `ipv6_v6only`, `multicast_ttl`,
`multicast_loop`, `multicast_if`, `add_membership`, `drop_membership`,
`exclusiveaddruse` en Windows, `priority` y `reuseport` donde el sistema las
ofrece) pasan a `setsockopt` y se consultan con `getsockopt`; las opciones que
el propio `inet_drv` de OTP conserva (`buffer`, `header`, `deliver`,
`exit_on_close`, `send_timeout`, marcas de agua, `packet_size`, ...) se
conservan con los valores predeterminados de inet_drv y no se aplican
([diferencias](differences.md)). Como en inet_drv, un búfer de recepción aumenta
`buffer` hasta que este se fija, y `getopts/2` omite las opciones de las que
carece un tipo de socket (`broadcast` de un socket TCP, `nodelay` de uno UDP,
`tclass` de IPv4) y rechaza las desconocidas con `{error, einval}`. Una conexión
aceptada hereda las opciones de su socket de escucha. `send/5` con datos
auxiliares fija `tos`, `tclass` o `ttl` solo para ese datagrama; en Windows es
`{error, einval}`, como en OTP.

Cada socket cuenta su tráfico como inet_drv para `getstat/1,2`: los paquetes
recibidos son lecturas (TCP) o datagramas, los enviados son llamadas a `send`
(con su cabecera de paquete) o datagramas, con las medias acumuladas de
inet_drv; `send_pend` es la salida encolada y aún no escrita. `getstatus`
proporciona los indicadores de estado de inet_drv (`open`, `connected`,
`connecting`, `listen`, `accepting`), que `info/1` e `i/0,1,2` imprimen con los
nombres y la columna de módulo de OTP (`inet_tcp`, `inet6_udp`, ...). Las
consultas a un socket cerrado responden `{error, einval}`, como OTP.

El módulo `socket` (`library/kernel/socket.erl`) usa los mismos puertos de
driver en modo binario pasivo. Un socket de flujo se puede vincular antes de
escuchar o conectarse (la operación 22 abre y vincula el socket del sistema,
que `listen` convierte en el receptor de conexiones o `connect` conecta); un
socket de datagramas se vincula mediante `udp_open`, implícitamente en su primer
envío. El final de una conexión responde a todos los `recv` en espera (también
a los que piden más bytes de los que quedan). `socket` conserva los bytes que
un recv no tomó en su propio búfer, por lo que `recv/2,3,4` proporciona
`{error, {timeout, Data}}` y `{error, {closed, Data}}` de OTP.

Implementación (`runtime/src/ports/sockets.cpp`):

- El hilo de E/S del runtime ([hilo de E/S](#io-thread)) sirve a los sockets; el
  estado de cada socket vive en ese hilo. La biblioteca abre un puerto con
  `{spawn_driver, "tcp_inet" | "udp_inet"}` y lo maneja con `port_control/3`; el
  hilo de trabajo que llama envía la operación al hilo de E/S y espera su
  respuesta síncrona (byte de estado 0 y un resultado, o 1 y una razón POSIX).
- Las operaciones que esperan (connect, accept, recv) responden más tarde con un
  mensaje `{clause_socket, Socket, Reply}` a su llamante, así que el llamante se
  bloquea en un `receive` ordinario y los demás procesos siguen ejecutándose. Un
  tiempo de espera cancela la petición; la propia cancelación responde
  `cancelled` después de todo lo que el socket haya enviado antes, de modo que
  una respuesta que ganó la carrera se devuelve en lugar de perderse.
- Los mensajes de socket se describen fuera del heap (`ports/value.hpp`) y se
  construyen en el heap del receptor al entregarse
  ([tareas de puerto](#port-tasks)). Una conexión aceptada se convierte en un
  puerto nuevo cuyo propietario es el llamante de `accept`, enlazado con él, y
  con el modo del socket de escucha.
- `controlling_process/2` detiene la entrega activa, traslada al nuevo
  propietario los mensajes del socket ya enviados al antiguo y después reconecta
  el puerto, como hace `inet` de OTP; solo el propietario puede llamarlo
  (`{error, not_owner}`).
- La salida se encola sin límite y se escribe en orden en el hilo de E/S. Cerrar
  un puerto envía lo encolado y después cierra la conexión de forma ordenada
  (FIN); un puerto cerrado responde `{error, closed}` a cada llamante en espera.
  La resolución de nombres se ejecuta en el hilo de trabajo del llamante, ya que
  bloquea.
- Los puertos de socket se planifican como los demás puertos
  ([tareas de puerto](#port-tasks)): los mensajes de un socket esperan en su
  puerto hasta que la tarea del puerto los entrega.
- Direcciones y hosts: `inet:parse_address/1,2`, `parse_strict_address/1,2`,
  `parse_ipv4_address/1`, `parse_ipv4strict_address/1`,
  `parse_ipv6_address/1`, `parse_ipv6strict_address/1` (las formas relajadas de
  OTP: campos IPv4 cortos y octales o hexadecimales, `::`, colas IPv4, `%scope`
  de `fe80::` y `ff02::`), `ntoa/1` (la grafía de OTP: hexadecimal en
  minúsculas, la primera secuencia de ceros más larga como `::`),
  `is_ipv4_address/1`, `is_ipv6_address/1`, `is_ip_address/1` son Erlang;
  `gethostname/0` (una operación de socket), `getaddr/2`, `getaddrs/2` (el
  resolutor del sistema, `getaddrinfo`) y `gethostbyname/1,2` (`h_name` es el
  nombre consultado, sin alias) responden mediante un puerto de socket abierto
  para la consulta.
- Los servicios, las consultas inversas y las interfaces (`inet:getservbyname/2`,
  `getservbyport/2`, `gethostbyaddr/1`, `getifaddrs/0,1`) son builtins de
  `clause_net` compartidos con `net` ([nombres de red](builtins.md#network-names)).
- `gen_tcp`, `gen_udp`, `inet` y `net` de Clause son la capa de red; el módulo
  `socket` de OTP (la API NIF de sockets) no existe, como tampoco
  `prim_socket`, `prim_net`, `prim_inet` ni `socket_registry`.

## El registro

`win32reg` abre `{spawn_driver, "clause_registry"}` en Windows
(`runtime/src/ports/registry_windows.cpp`). El driver conserva el estado del
driver del registro de OTP (el acceso solicitado, la clave actual y su raíz,
inicialmente `HKEY_CLASSES_ROOT`) y responde a los nueve comandos de OTP como
operaciones síncronas de `port_control/3` con las respuestas que el driver de
OTP envía como datos de puerto: `o`, `e` y el nombre errno (los daños del
registro son `eio`, una clave eliminada `einval`, los demás errores de Windows
como los asigna el runtime de C), `k` y un nombre de clave, `v`, el tipo, el
nombre y los datos (cadenas sin su cero final, DWORDs big-endian), `s` y la clave
actual. Los listados devuelven todas las respuestas, cada una precedida por su
tamaño de 32 bits. Los nombres y las cadenas usan la página de códigos ANSI,
como el driver de OTP.

## No proporcionado

Los drivers enlazados (linked-in drivers) y los NIF,
`erlang:open_port({spawn_driver, Name})` para nombres de drivers de OTP, los
puertos de distribución, `port_call/3` sobre los drivers proporcionados fuera
del protocolo propio de la biblioteca, los puertos de socket ocupados, y las
opciones `overlapped_io`, `parallelism` y `busy_limits_msgq`.
