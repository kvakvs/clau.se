---
source: docs/differences.md
sourceCommit: 336caea7
sourceSha256: 13b6b1fdfa7e9d5bd89113388e71d62567ddd4ab43cf8621051655c3f31fe56b
translatedAt: 2026-10-18
---
# Diferencias con Erlang/OTP

Comportamiento observable en el que Clause difiere a sabiendas de la versión
fijada OTP 29 (`maint-29`, véase [otp-reference.md](otp-reference.md)). Cada
entrada enlaza con el contrato al que pertenece. Una entrada se elimina cuando
la diferencia se corrige. Las funcionalidades aún no implementadas (notificadas
como `notimpl`) no se enumeran aquí; véanse [features.md](features.md) y el
plan.

## Maps

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Orden del generador de map (`K := V <- M`) | Los maps planos (hasta 32 claves) se recorren en orden de clave, pero las claves átomo en el orden de la tabla de átomos, que varía entre ejecuciones de la VM; los maps mayores en orden de hash | Siempre el orden canónico de claves (orden de términos) | [patrones](patterns.md#comprehensions) |
| Contenido de `bad_generators` de un generador de map en un grupo zip | Su iterador: cadena `{K, V, Next}` que termina en `none`, en el orden de OTP | La misma cadena, construida en el orden canónico de claves | [patrones](patterns.md#comprehensions) |
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3`, el orden de ejecución de los funs de `maps` (`intersect_with/3`, `merge_with/3`, ...), `proplists:get_keys/1`, `sets` de versión 2 (`to_list/1`, `fold/3`) | Orden interno (orden de la tabla de átomos para claves átomo, orden de hash por encima de 32 claves); un iterador es una posición o una cadena `{K, V, Next}` | Orden canónico de claves; un iterador continúa sobre una lista de claves | [builtins](builtins.md#erts-internal) |
| Impresión de maps (`erlang:display/1`, `~w`, `~p`) | Orden de la disposición interna (orden de la tabla de átomos para claves átomo, orden de hash por encima de 32 claves) | Orden de claves del map, como `~kw` de OTP | [términos](terms.md#printing) |
| Orden de `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` y de los miembros que escribe `json:encode/1` | El orden interno del map (orden de la tabla de átomos para claves átomo, orden de hash por encima de 32 claves) | Orden de claves | [biblioteca](library.md) |
| Impresión de native records (`erlang:display/1`) | Campos en el orden de índice de la tabla de átomos | Orden de definición, como `~w` | [native records](native-records.md#printing-and-order) |
| `==` entre native records cuyos campos solo difieren como entero/flotante | El compilador puede plegarlo a `=:=` (false) | Comparación numérica (true) | [native records](native-records.md#printing-and-order) |
| Construcción externa de un native record de un módulo que no está cargado | Falla hasta que se carga el módulo que lo define | Todos los módulos del lote se cargan al arrancar; un módulo fuera del lote siempre falla | [native records](native-records.md#differences-kept) |
| Impresión de funs locales (`#Fun<M.Index.Uniq>`) | Índice según la numeración de lambdas del compilador, `Uniq` un hash del código del módulo | Índice de los funs locales del módulo en orden de código fuente, `Uniq` siempre 0 | [funs](funs.md#comparison-and-printing) |
| Orden de dos funs locales de un mismo módulo | Según el índice de OTP | Según el índice en orden de código fuente, por lo que funs de funciones distintas pueden ordenarse de otro modo | [funs](funs.md#comparison-and-printing) |
| Nombres de funs anónimos en trazas de pila (`-f/1-fun-N-`) | `N` según la numeración del compilador | `N` cuenta los funs de `f/1` en orden de código fuente | [funs](funs.md#closures) |
| Un fun anónimo en el valor por defecto de un campo de record | Cada punto de construcción expande su propia copia: los funs de dos puntos distintos no son iguales | Un único fun para el valor por defecto: los funs de cualquier punto de construcción son iguales | [funs](funs.md#closures) |
| Orden de los valores capturados de funs creados dentro de comprehensions | Variables libres de la función generada para la comprehension | Orden de definición en la función contenedora; solo visible al comparar dos de esos funs | [funs](funs.md#closures) |

## Pids, referencias y procesos

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Números de pid | El primer proceso de usuario es aproximadamente `<0.80.0>`; los números se reutilizan cuando la tabla de pids da la vuelta | El primer proceso es `<0.1.0>`; los números provienen de una única secuencia y nunca se reutilizan | [términos](terms.md#pids-and-references) |
| Código tras `spawn(Fun)` de un fun de otra aridad | El análisis de tipos del compilador puede considerar inalcanzable el código posterior a la llamada y eliminarlo, de modo que el llamante devuelve el pid de inmediato | El llamante continúa; solo el nuevo proceso falla con `{badarity, {Fun, []}}` | [procesos](processes.md#builtins) |
| Pila de un `function_clause` lanzado por un builtin de `lists` (`lists:sublist/2`, `lists:max/1`, ...) | El marco superior es la función Erlang, a menudo una auxiliar interna (`lists:sublist_2/2`), con sus argumentos | El llamante está arriba: los builtins no apilan ningún marco | [builtins](builtins.md#lists-module) |
| Último bit de los resultados de `math` (`math:erfc(1)`, ...) | La biblioteca C con la que se compiló OTP | La biblioteca C que enlazan los programas Clause (Windows: `0.15729920705028513` para `erfc(1)`, OTP `0.1572992070502851`) | [builtins](builtins.md#math-module) |
| Resultado de `binary:compile_pattern/1` | `{bm, Ref}` o `{ac, Ref}` con una referencia opaca | `{bm, [Pattern]}` o `{ac, Patterns}` | [builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` de un sub-binary | El tamaño del binary al que hace referencia | Su propio tamaño | [builtins](builtins.md#binary-module) |
| Memoria de términos persistentes reemplazados o borrados | Recuperada por un proceso recolector de áreas de literales que hace que cada proceso copie el valor fuera de ellas, en segundo plano | Cada proceso lo copia fuera en su siguiente turno (los aparcados de inmediato, mediante `put`/`erase`), y después se libera el área; sin proceso recolector | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` y `get/0` | Incluyen los términos que `kernel` y `stdlib` de OTP almacenan durante el arranque (26 en OTP 29) | Solo los términos propios del programa | [builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` de un módulo compilado | El archivo `.beam` desde el que se cargó | `preloaded`: todo módulo está enlazado en el ejecutable | [builtins](builtins.md#code-module) |
| `init:get_arguments/0`, `init:get_argument/1` | Los flags del emulador: `root`, `bindir`, `progname`, `home` y cada `-Flag` de la línea de órdenes | Solo `home`; un ejecutable no tiene flags de emulador | [builtins](builtins.md#init-module) |
| `init:script_name/0`, `init:script_id/0` | La ruta del script de arranque y `{"Erlang/OTP", "29"}` | La ruta absoluta del ejecutable y `{"Clause", "29"}` | [builtins](builtins.md#init-module) |
| `init:get_status/0`, `init:ensure_loaded/1` en la entrada | `{starting, started}` y carga de código mientras se ejecuta código de `escript`, `-s` o `-eval` durante el arranque; `{started, started}` y `not_allowed` una vez arrancado | Siempre las respuestas de sistema arrancado | [builtins](builtins.md#init-module) |
| `init:stop/0,1`, `init:reboot/0` | Devuelven `ok`; después `init` detiene las aplicaciones y termina, mientras el llamante sigue ejecutándose | Terminan de inmediato; la llamada nunca retorna | [builtins](builtins.md#init-module) |
| `init:get_argument(home)` en Windows sin `HOMEDRIVE`/`HOMEPATH` | La carpeta de perfil del shell | `USERPROFILE`, normalmente la misma carpeta | [builtins](builtins.md#init-module) |
| `erlang:halt(Slogan)`, `init:stop(Slogan)` | Imprime el eslogan, escribe `erl_crash.dump` en el directorio actual y lo indica en stderr; código de salida 1 | Imprime el eslogan en stderr, no escribe volcado de memoria; código de salida 1 | [ejecutables](executables.md) |
| `init:restart/0,1`, `init:boot/1`, `init:make_permanent/2` | Reinician el sistema en el mismo nodo, lo arrancan o fijan el script de arranque del siguiente reinicio | Rechazadas: error `notsup`, `{error, notsup}` de `make_permanent/2` | [builtins](builtins.md#init-module) |
| Aridad de `atomics:new/2` | Cualquier entero positivo que el asignador pueda atender; uno enorme termina el nodo con un volcado de memoria | De 1 a 2^27; si no, `badarg` | [builtins](builtins.md#atomics-and-counters) |
| `counters` con `write_concurrency` | Contadores por planificador sumados al leer; la memoria de `info/1` crece con el número de planificadores | Un único array de atomics; la memoria de `info/1` es la del array | [builtins](builtins.md#atomics-and-counters) |
| `erts_internal:term_type/1` | La representación interna: `flatmap` o `hashmap`, `heap_binary`, `refc_binary` o `sub_binary`, ... | Todo map es `flatmap`, todo bitstring `sub_binary` | [builtins](builtins.md#erts-internal) |
| `erl_prim_loader:get_path/0` | La ruta de código del arranque | `["."]` hasta `set_path/1` | [puertos](ports.md#standard-io-and-files) |
| `file:read_link_info/1,2` de un enlace simbólico en Windows | Los datos de reparse point propios del enlace | El tamaño y las fechas del destino con tipo `symlink` | [puertos](ports.md#standard-io-and-files) |
| `inet:gethostbyname/1,2` | El nombre canónico y los alias del resolutor (`inet_res`, archivo hosts, nativo) | El nombre solicitado y ningún alias; direcciones del resolutor del sistema | [puertos](ports.md#sockets) |
| Módulos `socket`, `net` | La API NIF de sockets | Ausentes: una referencia es un error de compilación; úsense `gen_tcp`, `gen_udp`, `inet` | [biblioteca](library.md) |
| Listas de salida de `zlib` | Un binary por bloque interno, anidados donde un flujo terminó y se reinició | Un binary por llamada, `[]` cuando no hay ninguno; los bytes son los de OTP | [builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` y llamadas largas a `zlib` | Retornan tras una cantidad acotada de salida (`{continue, Output}`) y ceden el control | Descomprimen toda la entrada encolada en una llamada (`{finished, Output}`); una llamada larga retiene su hilo de planificador | [builtins](builtins.md#zlib-module) |
| Coincidencias largas de `re` | `re:run/3` y el bucle global ceden el control tras una cantidad acotada de trabajo | Una coincidencia se ejecuta hasta el final y retiene su hilo de planificador; una ejecución global solo cede entre coincidencias | [builtins](builtins.md#re-module) |
| `re:compile/2` con `export`, `re:import/1` | Un patrón exportado `{re_exported_pattern, ...}` que otro nodo importa | `export` es `badarg`; `import/1` lanza `{not_implemented, import, 1}` | [builtins](builtins.md#re-module) |
| Errores de argumentos de `re` | `badarg` lanzado desde `re:run/3` (o `replace`, `split`) con los argumentos del llamante y `error_info` | `badarg` lanzado desde la auxiliar de `re` que rechazó el argumento, con los argumentos de esa auxiliar | [builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` para los módulos de `kernel`, `stdlib` y `compiler` | Siempre `false` | [builtins](builtins.md#code-module) |
| Salida a un dispositivo de archivo (`io:format(File, ...)`) | Los caracteres se codifican según la codificación del archivo (`latin1` por defecto: los caracteres por encima de 255 son un error) | Siempre bytes UTF-8 | [io](io.md#calls) |
| Formateo de un término grande (`io:format/1,2`) | Se ejecuta en código Erlang (`io_lib`) y en el group leader, por lo que el proceso puede ser desalojado durante el formateo | Se ejecuta hasta el final en una sola llamada a un builtin; los demás procesos esperan | [builtins](builtins.md#portions) |
| Flags de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` y otros | Solo `trap_exit` y `min_heap_size`; cualquier otro flag lanza `badarg` | [procesos](processes.md#builtins) |
| Orden de los informes de error de procesos que fallan al mismo tiempo | Orden del logger | El orden en que sus hilos de trabajo los terminan | [procesos](processes.md#workers) |
| Señales de salida (`exit/2`, `exit_signal/2`) a un proceso que se ejecuta en otro planificador | Se encolan en su cola de señales y se procesan después, mientras el emisor continúa | El emisor espera a que termine la porción de tiempo del destino y luego actúa de inmediato; solo observable como diferencia de tiempos (los mensajes se almacenan en búfer y el emisor continúa) | [procesos](processes.md#workers) |
| `term_to_binary/1` de un fun local o de un native record | Se codifica (`NEW_FUN_EXT`, ...) | `error:notsup`; `fun M:F/A` sí se codifica | [builtins](builtins.md#external-term-format) |
| `term_to_binary/1` de un map con más de 32 claves | Orden de hash salvo con `deterministic` | Siempre orden de claves (los bytes de `deterministic`) | [builtins](builtins.md#external-term-format) |
| `binary_to_term/1` del pid, puerto o referencia de otro nodo; opción `local` de `term_to_binary/2` | Identidades externas; codificación `LOCAL_EXT` | `badarg` | [builtins](builtins.md#external-term-format) |
| Límite de tiempo de los temporizadores | Depende de la unidad de tiempo nativa (unos 2^49.7 ms en Windows) | Tiempo relativo 0..2^49-1 ms en todas las plataformas | [procesos](processes.md#timers) |
| `unique_integer/0,1` sin `positive` | Puede ser negativo | Siempre positivo y creciente | [builtins](builtins.md#time) |
| Elementos `current_function`, `initial_call`, `current_stacktrace`, ... de `process_info/2` | Se informan | `error:{notsup, Item}`; `process_info/1` los omite | [procesos](processes.md#introspection) |
| `reductions` de `process_info/2`; `reductions`, `garbage_collection`, `io` de `statistics/1` | Se cuentan | 0 (no se llevan) | [builtins](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Recolecta antes de retornar | Recolecta en el siguiente punto seguro (safepoint) del destino | [procesos](processes.md#introspection) |
| `erlang:system_info(machine)` | `"BEAM"` | `"Clause"` | [builtins](builtins.md#system-information) |
| Opciones de ajuste de `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Se aplican | Se comprueban y se aceptan, pero no se aplican | [procesos](processes.md#spawn-options) |
| `hibernate/3` | Descarta la pila; el proceso termina cuando `M:F` retorna | Conserva la pila; el resultado de `M:F` vuelve al llamante de `hibernate/3` | [procesos](processes.md#spawn-options) |
| `monitor(port, Item, Options)` con opciones | Se acepta | `badarg` | [procesos](processes.md#aliases) |
| `spawn_request_abandon/1` | `true` mientras la respuesta está pendiente | Siempre `false`: la respuesta se envía antes de que `spawn_request` retorne | [procesos](processes.md#spawn-options) |
| Último bit de `math:log2/1` (Windows) | La compilación de OTP para Windows divide `log(X)` entre `log(2)` (`math:log2(1.0e308)` es `1023.1538532253077`) | El `log2` de la biblioteca C (`1023.1538532253076`) | [builtins](builtins.md#math-module) |
| `phash/2`, `phash2/1,2` de pids, puertos, referencias, funs y native records | Hashes de los números de proceso, puerto y referencia de OTP, del índice y número único de un fun, del hash de definición de un record | Hashes de los números de Clause, del módulo, aridad o índice y capturas de un fun, de los valores de campo de un record; cualquier otro término tiene el hash de OTP | [builtins](builtins.md#hashing) |
| `dict:fold/3`, `map/2`, `filter/2` con algo que no es un fun | `function_clause`, o `{badfun, F}` cuando el primer bucket que visita OTP contiene una entrada | `function_clause` | [builtins](builtins.md#collections) |
| `erlang:is_builtin/3` de `lists:reverse/2` y otras funciones de biblioteca implementadas en C | `true` | `false`: solo los builtins del runtime y `apply/2,3` | [funs](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` de `fun_info/1,2` de un fun local | Pid del creador, sumas de comprobación del compilador | `undefined`, MD5 del nombre del módulo | [funs](funs.md#fun-information) |
| Contexto de `md5_init/0` | El estado de 92 bytes de OTP | El estado de 96 bytes de Clause; los resúmenes son iguales | [builtins](builtins.md#hashing) |
| `erlang:delete_module/1` de un módulo cargado | Convierte su código en antiguo (`true`) | `error:notsup`: el código enlazado permanece | [builtins](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Prepara un binary BEAM válido | Siempre `{error, badfile}` | [builtins](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | Los módulos de arranque precargados | Todos los módulos del programa | [builtins](builtins.md#code-loading) |
| `list_to_pid/1` de un número nunca emitido | Devuelve un término pid | `badarg`: solo se admiten los pids que este programa creó | [términos](terms.md#pids-and-references) |
| `list_to_port/1` de un número nunca emitido | Devuelve un término de puerto | `badarg`: solo se admiten los puertos que este programa abrió | [puertos](ports.md#identity) |
| Valores de `port_info/1,2` | `id` es un índice de tabla; `memory`, `queue_size`, `locking` describen el driver | `id` es el número de puerto; `memory` y `queue_size` valen 0; `locking` es `port_level` | [puertos](ports.md#builtins-and-port-messages) |
| Escritura en un archivo abierto solo para lectura | `{error, eacces}` en Windows, `{error, ebadf}` en los demás sistemas | `{error, ebadf}` en todas partes | [puertos](ports.md#standard-io-and-files) |
| `io:get_line`, `io:get_chars` y `file:read/2` en modo lista con entrada no ASCII | Caracteres decodificados según la codificación del dispositivo | Un elemento de lista por byte | [puertos](ports.md#standard-io-and-files) |
| Resultado de `os:cmd/1` | Caracteres Unicode decodificados de la salida | Los bytes de la salida | [puertos](ports.md#subprocesses) |
| Argumentos vacíos de `{spawn_executable, F}` en Windows | Se descartan de la línea de órdenes | Se pasan como `""` | [puertos](ports.md#subprocesses) |
| `{exit_status, S}` y `eof` de un programa lanzado | Orden no especificado, `exit_status` puede llegar antes de los últimos datos | Después de todos los datos, antes de `eof` | [puertos](ports.md#subprocesses) |
| Puertos ocupados | Un puerto con demasiada salida encolada suspende a los emisores, incluidos los puertos de socket; `force` de `port_command/3` funciona en los drivers que lo permiten | Solo se ocupan los puertos de programas lanzados; los puertos `fd` y de socket nunca; `force` lanza `notsup` en todos los drivers | [puertos](ports.md#busy-ports) |
| `{active, N}` de sockets | Un entero `N` cuenta mensajes antes de `{tcp_passive, S}` | `exit(badarg)`; solo `true`, `false` y `once` | [puertos](ports.md#sockets) |
| Opciones de ajuste de sockets (`nodelay`, `keepalive`, `send_timeout`, `delay_send`, búferes) | Se aplican; otras opciones de `inet` (`header`, `{packet, line}`, `http`, ...) funcionan | Las opciones de ajuste enumeradas se aceptan pero no se aplican; las demás opciones dan `exit(badarg)` | [puertos](ports.md#sockets) |
| Motivos de error de sockets | Todo motivo POSIX que informe el sistema | Los habituales (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); los demás son `eio` | [puertos](ports.md#sockets) |
| Entrada de puerto mientras el proceso conectado retiene 1.024 mensajes y puede ejecutarse | Sigue leyendo y entregando | Deja de entregar hasta que termina la porción de tiempo del proceso; por encima de 64 KiB retenidos, deja de leer, de modo que el programa que escribe se bloquea | [puertos](ports.md#busy-ports) |
| `gen_tcp:close/1` con salida encolada | Espera, hasta el valor de `linger`/`send_timeout`, a que la salida se envíe | Retorna de inmediato; el hilo de E/S envía la salida encolada y después cierra | [puertos](ports.md#sockets) |
| Tipos de `monitor/2` | `process`, `port`, `time_offset` | `process` y `port`; `time_offset` lanza `badarg` (no hay cambios de desfase horario) | [procesos](processes.md#monitors) |
| `exit/2`, `exit_signal/2` a una referencia | Envía al alias del proceso, si la referencia es un alias activo | Nada: las señales de salida nunca van a los alias | [procesos](processes.md#exit-signals) |
| Números de referencia | Combinan un identificador de planificador y contadores por planificador (`#Ref<0.178111994.4235460610.214105>`) | Un único contador para todo el programa (`#Ref<0.0.0.1>`), por lo que las referencias se ordenan por creación | [términos](terms.md#pids-and-references) |

## Errores, trazas de pila e informes

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Ubicaciones en trazas de pila | `[{file, F}, {line, L}]`, `error_info` para `error/3` | Siempre `[]`; sin `error_info` | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` con entradas de pila `{Fun, Args}` | Se aceptan | Se rechazan | [ABI](abi.md#stack-traces) |
| Marco superior de `function_clause` | Lista de argumentos | Aridad | [ABI](abi.md#stack-traces) |
| Marco superior de `undef` | `{M, F, Args, []}` de la función inexistente | El marco de la función que llama | [funs](funs.md#dynamic-calls) |
| Llamada dinámica a una exportación que un ejecutable no puede alcanzar (su módulo solo se nombra a través de una traza de pila, una excepción o un mensaje externo al programa) | La llama | `undef`, salvo si se compiló con `--keep-exports`; `function_exported/3` y `module_info(exports)` la siguen enumerando | [ejecutables](executables.md#export-liveness) |
| Marcos de BIF/operadores que fallan | Presentes (`{erlang, '+', Args, ...}`) | Ausentes; nada por debajo de la función de entrada | [ABI](abi.md#stack-traces) |
| Tabla de átomos llena (`list_to_atom/1`) | El emulador aborta (`no more index entries in atom_tab`) y escribe un volcado de memoria (crash dump) | `clau: runtime failure: entry call failed: resource_limit`, código de salida 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` con caracteres por encima de 255 | Sus primeros dígitos usan solo el byte bajo de cada carácter (`[16#131]` es 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` de un BIF | Verdadero para todo BIF del emulador | Verdadero solo para los builtins que proporciona este runtime | [builtins](builtins.md#how-calls-reach-them) |
| Informes de error de procesos que han fallado | Se envían al logger y su manejador por defecto los escribe más tarde (en la salida estándar con `erl`, a menudo se pierden cuando un escript termina antes) | Se escriben en stderr cuando el proceso termina, antes de cualquier salida posterior | [procesos](processes.md#exits) |
| Llamadas a funciones que nunca retornan | Compiladas como llamadas de cola (el llamante no aparece en la traza) | Llamadas ordinarias (el llamante aparece) | [ABI](abi.md#stack-traces) |
| Memoria del anfitrión agotada | El emulador informa de que no puede reservar memoria, escribe un volcado de memoria y se detiene | `clau: runtime failure: entry call failed: out_of_memory`, código de salida 70, sin volcado | [heap del runtime](runtime-heap.md#failure-behavior) |
| Almacenamiento de maps de más de 32 claves | Un HAMT en el heap de nodos hash de 16 ramas | Un árbol B+ en el heap de hasta 16 entradas por nodo en orden de claves; los tamaños de heap de los maps grandes difieren de los de OTP | [heap del runtime](runtime-heap.md#map-trees) |
| Límite de memoria por proceso | `max_heap_size` (en palabras, heap y pila) mata el proceso con motivo `killed` y registra un informe de error | `--max-heap` / `--max-stack` (bytes) y `--max-memory`, global para todo el runtime, hacen fallar al proceso solicitante como `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, código de salida 70 | [heap del runtime](runtime-heap.md#runtime-memory-limit) |
| Argumentos del programa | `escript` pasa todos los argumentos a `main/1`; los flags del emulador (`+t`) provienen de `%%!` o de `ERL_FLAGS` | Las opciones iniciales del runtime (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) se extraen primero; `CLAUSE_FLAGS` contiene las mismas opciones | [ejecutables](executables.md#runtime-options) |
| Excepción no capturada en un módulo de entrada ordinario | `escript` termina con código 127 | Termina con código 1 y una línea `uncaught exception <class>: <reason>` (los fuentes escript mantienen 127) | [ejecutables](executables.md) |
| Diagnósticos del compilador | Redacción de `erl_lint` (`variable 'X' is unbound`) y advertencias | Redacción propia (`unbound variable X`); las advertencias de lint de OTP en su mayoría no se emiten (tampoco las de native records: campos desconocidos en accesos, actualizaciones y patrones, construcción cualificada con el propio módulo sin valores, records no usados o definidos en cabeceras; un patrón posterior que coincide con un nombre exportado desde una rama) | [semántica](semantic.md#bindings) |
| Módulo de behaviour con un `behaviour_info/1` escrito a mano | Lo llama al compilar los módulos que lo usan y advierte de callbacks ausentes, mal definidos u obsoletos | No se evalúa: los callbacks de quienes lo usan no se comprueban | [semántica](semantic.md#behaviours) |
| Módulos de behaviour fuera del lote (`gen_server`, `supervisor`, ...) | Se cargan desde la ruta de código; sus callbacks se comprueban | Advertencia `behaviour M undefined` | [semántica](semantic.md#behaviours) |
| `-behaviour` con un valor que no es un átomo | La advertencia imprime el término con `~w` (`behaviour [115,116,114] undefined`) | Imprime el texto fuente del atributo (`behaviour "str" undefined`); el error es el mismo | [semántica](semantic.md#behaviours) |
| `module_info(md5)` y el `vsn` que OTP deriva de él | MD5 del código BEAM compilado | MD5 del código fuente impreso del módulo; el entero `vsn` derivado difiere en consecuencia | [semántica](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` de la aplicación compiler de OTP, `options` que se le pasaron | La versión de Clause; `options` siempre `[]` | [semántica](semantic.md#predefined-functions) |
| `module_info(functions)` | También enumera las funciones que OTP genera para los funs (`'-f/0-fun-0-'/0`) | Solo las funciones del código fuente y las predefinidas | [semántica](semantic.md#predefined-functions) |
| `-nominal` en `module_info(attributes)` | Se conserva como `{nominal,[{Name,AbstractType,Params}]}` en formato abstracto | Se omite | [semántica](semantic.md#predefined-functions) |
| Una función de un módulo de biblioteca de Clause que Clause no ha implementado (un BIF de `erlang`, `lists:rmerge/2`, ...) | Se ejecuta | Compila; lanza `error({not_implemented, F, A})` al llamarla, con `M:F/A` en la cima de la pila ([estados](../library/modules.terms)) | [biblioteca](library.md#provided-or-missing), [builtins](builtins.md#erlang-module) |
| Importación de un módulo fuera del lote | Compila; la llamada lanza `undef` en tiempo de ejecución si falta el módulo | Error de compilación `unknown module M` cuando se llama a la importación (las importaciones no usadas no necesitan el módulo) | [semántica](semantic.md#imports) |
| Advertencia `import directive overrides auto-imported BIF` | Para todo BIF autoimportado de `erl_internal:bif/2` | Solo para los BIF autoimportados que Clause implementa | [semántica](semantic.md#imports) |

## Casos límite del lenguaje

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Segmento entero más ancho que el límite de enteros, con un valor que lo supera (`<<V:4194241>>` todo unos) | El JIT de x86 encaja con un término inválido; usarlo bloquea la VM | No encaja | [términos](terms.md#integers) |
| Grupo zip cuyos generadores relajados y estrictos comparten una variable | La prueba de omisión mantiene las variables de los patrones estrictos en los patrones relajados | Un paso rechazado se omite siempre que los patrones estrictos encajen por sí solos | [patrones](patterns.md#comprehensions) |
| Llamada a un fun externo, `M:F(Args)` o `apply/3` de un módulo ajeno al programa | Carga el módulo desde la ruta de código, `undef` si no existe | `undef`; los módulos de biblioteca solo se incorporan al programa cuando este los nombra con un átomo literal | [funs](funs.md#dynamic-calls), [biblioteca](library.md#how-programs-get-them) |
| Archivos sin `#!` pasados como escripts | `escript file.erl` omite la primera línea | Se compilan como módulos ordinarios | [ejecutables](executables.md) |
| Escripts de beam precompilado y de archivo | Se ejecutan | No soportados | [ejecutables](executables.md) |
| Nombre de módulo de un escript sin `-module` | `<name>__escript` más un sufijo de marca de tiempo/único | `<name>__escript`, determinista | [ejecutables](executables.md#escripts) |
| `include_lib` de una aplicación presente en varios directorios `<app>-<version>` | La ruta de código contiene una sola versión (el arranque elige la más alta); sin diagnóstico | La versión más alta dentro de cada directorio buscado, con una advertencia por ejecución que las enumera | [preprocesador](preprocessor.md#compatibility-policies) |
| Un `-spec` cuyos tipos no comparten ningún valor con el resultado inferido, el dominio de entrada o los argumentos de una llamada | Compila; Dialyzer puede advertir | Un dominio de entrada de argumentos contradicho es un error de compilación que nombra los tipos declarado e inferido; un resultado o una llamada contradichos son una advertencia, y se usan los tipos inferidos | [análisis semántico](semantic.md#inference) |

## io

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Funs de comparación de `maps_order` (`~K` con un fun, opción de `io_lib:write/2`) | Maps ordenados por el fun | `badarg` cuando se escribe un map | [io_lib](builtins.md#io_lib) |
| `~p`, `~w` y escritores de `io_lib` de contenedores anidados a más de 256 niveles | Se imprimen | `system_limit` | [io](io.md#pretty-printing-p) |
| `io_lib:print/4` con una columna o longitud de línea que no es un entero | Depende del término: se imprime (los guards fallan silenciosamente), `function_clause` o `badarith` | `badarith` para cualquier término contenedor | [io_lib](builtins.md#io_lib) |
| Precisión o número de relleno negativos (`~.*c` con -1) | Bucle infinito | `badarg` | [io](io.md#formats) |

## Números aleatorios

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Alturas de las franjas del zigurat normal de `rand` | Constantes tabuladas | Calculadas al double más cercano a partir de las constantes del zigurat; una altura puede diferir en su último bit, lo que cambia una aceptación de la vía lenta solo para una extracción dentro de ese bit del límite (probabilidad cercana a 2^-53 por extracción de la vía lenta). Los anchos y límites de las franjas se observan de OTP y son iguales | [builtins](builtins.md#random-numbers) |

## Parse transforms

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Nombre en el atributo `file` de un archivo incluido (`--print-abstr`, entrada de la transformación) | El directorio de inclusión unido al nombre, tal como se encontró (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | La ruta relativa al directorio de trabajo cuando el archivo está dentro de él; si no, la ruta absoluta | [transformaciones](transforms.md#interchange) |
| Anotaciones `generated` de formas importadas (entradas `.abstr`, salida de la transformación) | `erl_lint` y el compilador omiten algunas advertencias para el código generado | Se ignoran: el código se comprueba como el código fuente | [transformaciones](transforms.md#importing-forms) |
| Formas `{error, {Location, Module, Descriptor}}` en código importado | Se formatean con `Module:format_error/1` | El texto del término del descriptor; formatearlo requiere OTP | [transformaciones](transforms.md#importing-forms) |
| Un módulo con errores de preprocesador o de análisis sintáctico que nombra una parse transform | La transformación se ejecuta y recibe los errores como formas `{error, E}`; `erl_lint` los notifica después | Los errores se notifican y la transformación no se ejecuta | [transformaciones](transforms.md#clause-pipeline) |
| Opciones de compilación que recibe una transformación | La lista completa de opciones de erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (el directorio de trabajo), `{i, _}`, `{d, ...}` y `{parse_transform, _}` | [transformaciones](transforms.md#otp-behavior) |
