---
source: docs/differences.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d23f82e2b75a7d8717057d09d1a6e30555fb75f81b5e810be0aaa9fc83a5b22c
translatedAt: 2026-10-26
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
| Orden de `digraph:vertices/1`, `edges/1`, `source_vertices/1`, `sink_vertices/1` y de las ordenaciones y componentes de `digraph_utils` que parten de esas listas | Orden hash de las tablas de vértices y aristas | Orden hash de Clause ([ETS](#ets)); las rutas y listas de vecinos siguen la inserción de aristas en ambos | [builtins](builtins.md#digraph) |
| Orden de `maps:keys/1`, `values/1`, `to_list/1`, `fold/3`, de los miembros que escribe `json:encode/1`, de los campos que `erl_parse:abstract/1,2` asigna a un map y de las listas de vértices y recorridos de `graph` | Orden interno del map (orden de la tabla de átomos para claves átomo, orden hash por encima de 32 claves) | Orden de claves | [biblioteca](library.md) |
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
| Temporizadores únicos y periódicos de `timer` distintos de los envíos a pids locales | Los ejecuta el proceso `timer_server`, iniciado bajo `kernel_sup` en el primer uso; las señales de `exit_after/2,3` proceden de él | Sin servidor de temporizadores: cada temporizador tiene su propio proceso, que envía la señal de `exit_after`; `cancel/1` retorna antes de que ese proceso haya visto la cancelación | [builtins](builtins.md#timer) |
| Números de pid | El primer proceso de usuario es aproximadamente `<0.80.0>`; los números se reutilizan cuando la tabla de pids da la vuelta | El primer proceso es `<0.1.0>`; los números provienen de una única secuencia y nunca se reutilizan | [términos](terms.md#pids-and-references) |
| Código tras `spawn(Fun)` de un fun de otra aridad | El análisis de tipos del compilador puede considerar inalcanzable el código posterior a la llamada y eliminarlo, de modo que el llamante devuelve el pid de inmediato | El llamante continúa; solo el nuevo proceso falla con `{badarity, {Fun, []}}` | [procesos](processes.md#builtins) |
| Pila de un `function_clause` lanzado por un builtin de `lists` (`lists:sublist/2`, `lists:max/1`, ...) | El marco superior es la función Erlang, a menudo una auxiliar interna (`lists:sublist_2/2`), con sus argumentos | El llamante está arriba: los builtins no apilan ningún marco | [builtins](builtins.md#lists-module) |
| Último bit de los resultados de `math` (`math:erfc(1)`, ...) | La biblioteca C con la que se compiló OTP | La biblioteca C que enlazan los programas Clause (Windows: `0.15729920705028513` para `erfc(1)`, OTP `0.1572992070502851`) | [builtins](builtins.md#math-module) |
| Resultado de `binary:compile_pattern/1` | `{bm, Ref}` o `{ac, Ref}` con una referencia opaca | `{bm, [Pattern]}` o `{ac, Patterns}` | [builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` de un sub-binary | El tamaño del binary al que hace referencia | Su propio tamaño | [builtins](builtins.md#binary-module) |
| Memoria de términos persistentes reemplazados o borrados | Recuperada por un proceso recolector de áreas de literales que hace que cada proceso copie el valor fuera de ellas, en segundo plano | Cada proceso lo copia fuera en su siguiente turno (los aparcados de inmediato, mediante `put`/`erase`), y después se libera el área; sin proceso recolector | [runtime](runtime.md#persistent-terms) |
| Términos persistentes enviados en mensajes | Siguen compartidos, como los literales: el heap del receptor no crece | Se copian al heap del receptor como cualquier otro término | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` y `get/0` | Incluyen los términos que `kernel` y `stdlib` de OTP almacenan durante el arranque (26 en OTP 29) | Solo los términos propios del programa | [builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` de un módulo compilado | El archivo `.beam` desde el que se cargó | `preloaded`: todo módulo está enlazado en el ejecutable | [builtins](builtins.md#code-module) |
| Opción `priority` de `send/3`, `link/2`, `exit/3`, `exit_signal/3` | Los mensajes y señales prioritarios adelantan a los ordinarios | Se acepta; se entregan como mensajes y señales ordinarios | [procesos](processes.md#builtins) |
| `spawn/2,4`, `spawn_link/2,4`, `spawn_monitor/2,4` que nombran otro nodo | Se registra una advertencia `** Can not start ... on Node **` | No se imprime nada; el pid inútil sigue terminando con `noconnection` | [procesos](processes.md#builtins) |
| Flags de `system_flag/2` distintos de `backtrace_depth` y `min_heap_size` (`fullsweep_after`, `schedulers_online`, `multi_scheduling`, `max_heap_size`, ...) | Modifican el emulador | Se comprueban y se pueden consultar sin efecto; `system_logger` empieza como `undefined` (sin proceso de registro); `cpu_topology`, `erts_alloc`, `scheduler_bind_type` dan `badarg` | [builtins](builtins.md#system-information) |
| Temporizadores de un proceso suspendido (`receive ... after`, `send_after/3` y `start_timer/3` a su pid) | Se suspenden con el proceso hasta que se reanuda (OTP 28, 29) | Siguen funcionando: un tiempo de espera que vence durante la suspensión se atiende al reanudar el proceso; un mensaje de temporizador espera en su buzón | [procesos](processes.md#suspending-processes) |
| Salida de `process_display/2` | Volcado de pila de OTP con direcciones y posiciones de pila | Un `Module:Function/Arity` por marco | [procesos](processes.md#builtins) |
| `process_flag(save_calls, N)` | Guarda las últimas N llamadas para `process_info(Pid, last_calls)` | Se conserva y se puede consultar; no se guardan llamadas | [procesos](processes.md#builtins) |
| `adler32_combine/3`, `crc32_combine/3` con un segundo tamaño superior a 2^31 - 1 en Windows | Se combinan | `badarg` (`z_off_t` de zlib tiene 32 bits allí) | [builtins](builtins.md#erlang-module) |
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
| Módulo `socket` | La API NIF de sockets | Ausente: una referencia es un error de compilación; se usan `gen_tcp`, `gen_udp`, `inet` | [biblioteca](library.md) |
| `net:getifaddrs/1,2` con un espacio de nombres, `inet:getifaddrs([{netns, _}])` | `net` se llama a sí mismo sin fin (OTP 29); `inet` lee el espacio de nombres en Linux | `{error, enotsup}` | [builtins](builtins.md#network-names) |
| Listas de salida de `zlib` | Un binary por bloque interno, anidados donde un flujo terminó y se reinició | Un binary por llamada, `[]` cuando no hay ninguno; los bytes son los de OTP | [builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` y llamadas largas a `zlib` | Retornan tras una cantidad acotada de salida (`{continue, Output}`) y ceden el control | Descomprimen toda la entrada encolada en una llamada (`{finished, Output}`); una llamada larga retiene su hilo de planificador | [builtins](builtins.md#zlib-module) |
| Coincidencias largas de `re` | `re:run/3` y el bucle global ceden el control tras una cantidad acotada de trabajo | Una coincidencia se ejecuta hasta el final y retiene su hilo de planificador; una ejecución global solo cede entre coincidencias | [builtins](builtins.md#re-module) |
| `re:compile/2` con `export`, `re:import/1` | Un patrón exportado `{re_exported_pattern, ...}` que otro nodo importa | `export` es `badarg`; `import/1` lanza `{not_implemented, import, 1}` | [builtins](builtins.md#re-module) |
| Errores de argumentos de `re` | `badarg` lanzado desde `re:run/3` (o `replace`, `split`) con los argumentos del llamante y `error_info` | `badarg` lanzado desde la auxiliar de `re` que rechazó el argumento, con los argumentos de esa auxiliar | [builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` para módulos de `kernel`, `stdlib` y `compiler`, y para los módulos de los directorios nombrados por `code:stick_dir/1` | Siempre `false`; `stick_dir/1` solo comprueba que se puede listar el directorio | [builtins](builtins.md#code-module) |
| `code:root_dir/0` y la ruta de código inicial | Directorio de instalación de OTP; la ruta contiene sus directorios `lib/*/ebin` | Directorio del ejecutable; la ruta contiene los directorios `ebin` de `lib/` junto a él y de `ERL_LIBS`, y después `"."` | [builtins](builtins.md#code-module) |
| `code:load_file/1`, `load_abs/1`, `load_binary/3`, `atomic_load/1`, `prepare_loading/1` con código objeto válido | Cargan el módulo | `{error, badfile}`: todos los módulos se enlazan en el ejecutable (D01) | [builtins](builtins.md#code-module) |
| `code:coverage_support/0` y las funciones de cobertura | `true` con el JIT; modos y contadores de cobertura | `false`; las demás lanzan `badarg`, como OTP sin soporte de cobertura | [builtins](builtins.md#code-module) |
| `code:get_doc/1` de un módulo que tiene el programa | Su bloque de documentación EEP 48 | `{error, missing}`: los ejecutables no incorporan documentación | [builtins](builtins.md#code-module) |
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
| `erlang:system_info(machine)` y, por tanto, `?MACHINE` de `epp` y la macro que nombra | `"BEAM"`, `'BEAM'` | `"Clause"`, `'Clause'` | [builtins](builtins.md#system-information) |
| `erlang:system_info(schedulers)` de un programa iniciado con una máscara de afinidad (`start /affinity`, `taskset`) | Un planificador por procesador lógico del anfitrión (32 con una máscara de 7 CPU), `schedulers_online` uno por CPU de la máscara | Ambos uno por CPU de la máscara: Clause inicia solo los hilos de trabajo activos | [procesos](processes.md#workers) |
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
| Puerto de `win32reg` | El puerto enlazado `registry__drv__` (`{spawn, "registry__drv__ rw"}`), que responde a órdenes con mensajes de puerto | El driver `clause_registry` (`{spawn_driver, ...}`), que da las mismas respuestas mediante `port_control/3`; `port_info/2` lo nombra `clause_registry` | [puertos](ports.md#the-registry) |
| Nombre del programa de `argparse` sin la opción `progname` | El `progname` del emulador (`erl`) | El nombre del ejecutable sin extensión (`init` no tiene `progname`) | [biblioteca](library.md) |
| Marco superior de la pila de un error de validación de órdenes de `argparse` | La función que valida (`argparse:validate_command/2`, `validate_option/2`, un fun dentro de ellas) con `[Entity]` | `argparse:validate/2` con `[Entity]` | [builtins](builtins.md#argparse) |
| `escript:script_name/0` | La ruta del escript, el primer argumento ordinario | La ruta del ejecutable: un programa Clause es su propio script | [biblioteca](library.md) |
| `escript:extract/2` con `compile_source` | El código fuente compilado a un beam | `{error, {compile, ...}}`: los programas Clause no tienen compilador | [biblioteca](library.md) |
| `erl_abstract_code:debug_info(core_v1, ...)` (Core Erlang de beam_lib) | Core Erlang del compilador | `{error, failed_conversion}`: los programas Clause no tienen compilador | [biblioteca](library.md) |
| `zstd:get_frame_header/1` de una cabecera de trama truncada | Los campos de memoria sin inicializar | Los campos a cero (`'ZSTD_frame'`, tamaños 0) | [builtins](builtins.md#zstd-module) |
| `file:open/2` con `raw` o `ram` | Un record `#file_descriptor{}` atendido en el llamante (`is_pid/1` falso); las peticiones `io` sobre él fallan; un archivo `ram` no tiene `read_line/1` (`undef`) y uno cerrado responde `{error, einval}` | Un pid de servidor de archivos como los demás; la E/S posicionada y `sendfile/5` responden como para los archivos raw de OTP; un archivo `ram` responde a `read_line/1` y a las peticiones de E/S con `{error, enotsup}`, y con `{error, terminated}` una vez cerrado | [puertos](ports.md#standard-io-and-files) |
| `file:truncate/1` en un archivo abierto solo para lectura | El error de la plataforma (`eacces` en Windows, `einval` en los demás sistemas) | El error del runtime de C para el descriptor (`ebadf` o `einval`); el servidor se detiene como el de OTP | [puertos](ports.md#standard-io-and-files) |
| Archivos abiertos o configurados como `{utf16, _}` o `{utf32, _}` | Líneas y caracteres decodificados en esa codificación | Las líneas terminan en un byte 10 antes de decodificarse | [puertos](ports.md#standard-io-and-files) |
| Secuencias de `io_ansi` en Linux y macOS | De la base de datos terminfo de `TERM` cuando tiene la capacidad (`setaf`, `sgr0`, ...); `tput/1,2`, `tigetnum/1`, `tigetflag/1`, `tinfo/0` la leen | Las secuencias ANSI integradas que OTP usa sin terminfo (como OTP en Windows); `tigetnum/1`, `tigetflag/1`, `tinfo/0` responden `{error, enotsup}`, `tput/1,2` lanzan `{enotsup, Capability}`; `enabled/0,1` requiere un `TERM` distinto de `dumb` | [biblioteca](library.md#contents) |
| `io_ansi:scan/1` y `tput/1,2` en Windows | Fallan con `try_clause` ante el `{error, enotsup}` de terminfo | `scan/1` reconoce las secuencias integradas; `tput/1,2` lanzan `{enotsup, Capability}` | [biblioteca](library.md#contents) |
| `socket` en Windows: `recvmsg`, `sendmsg`, `sendfile`, `sendmmsg`, `recvmmsg` | Lanzan `notsup` | Funcionan como en Linux y macOS | [biblioteca](library.md#contents) |
| `socket` en Windows: un datagrama más largo que la longitud de `recv` | `{error, {completion_status, ...more_data...}}` | El datagrama truncado, como en los demás sistemas | [biblioteca](library.md#contents) |
| `socket` en Linux y macOS: `ioctl/2,3,4`, `getopt_native/3`, `setopt_native/3`, `open/1,2` de un descriptor, dominio `local`, SCTP | Soportados | Rechazados como los rechaza OTP en Windows (`{error, {invalid, ...}}`, `notsup`); `local` da `{error, eafnosupport}` | [biblioteca](library.md#contents) |
| `socket:info/1`, `i/0,1,2` | Los contadores y estados del NIF, `fd` es el descriptor | Contadores de las llamadas realizadas, estados según los sigue el módulo; `Fd` es el número de puerto | [biblioteca](library.md#contents) |
| Respuestas de `inet_res` | Las respuestas de `gethostbyname`, `getbyname` y `gethostbyaddr` se almacenan en caché por TTL en `inet_db`; una consulta en caché puede enumerar las direcciones en otro orden | No se almacena nada en caché: cada consulta pregunta a los servidores de nombres | [biblioteca](library.md#contents) |
| Configuración del resolutor en Linux y macOS | `inet_db` también lee archivos `host.conf`/`nsswitch.conf` e `inetrc`, sigue los cambios de `resolv.conf` y en Linux deriva el dominio del nombre del anfitrión | Las líneas `nameserver`, `domain` y `search` de `resolv.conf` y el archivo hosts, leídos una vez | [biblioteca](library.md#contents) |
| `os:set_signal(Signal, handle)` (Linux, macOS) | La señal se envía a `erl_signal_server`, cuyo manejador por defecto detiene el sistema con `sigterm` y lo termina con `sigusr1` y `sigquit` | Sin `erl_signal_server`: `sigterm` y `sigquit` terminan con código 0, `sigusr1` con código 1, las demás se descartan; sin `set_signal`, `SIGTERM` conserva la acción por defecto del sistema | [puertos](ports.md#subprocesses) |
| Argumentos vacíos de `{spawn_executable, F}` en Windows | Se descartan de la línea de órdenes | Se pasan como `""` | [puertos](ports.md#subprocesses) |
| `{exit_status, S}` y `eof` de un programa lanzado | Orden no especificado, `exit_status` puede llegar antes de los últimos datos | Después de todos los datos, antes de `eof` | [puertos](ports.md#subprocesses) |
| Puertos ocupados | Un puerto con demasiada salida encolada suspende a los emisores, incluidos los puertos de socket; `force` de `port_command/3` funciona en los drivers que lo permiten | Solo se ocupan los puertos de programas lanzados; los puertos `fd` y de socket nunca; `force` lanza `notsup` en todos los drivers | [puertos](ports.md#busy-ports) |
| `{active, N}` de sockets | Un entero `N` cuenta mensajes antes de `{tcp_passive, S}` | `exit(badarg)`; solo `true`, `false` y `once` | [puertos](ports.md#sockets) |
| Opciones de socket del propio `inet_drv` (`header`, `deliver`, `exit_on_close`, `send_timeout`, `send_timeout_close`, `delay_send`, marcas de agua, `packet_size`, `show_econnreset`, `buffer`, `read_packets`, `recvtos`, `recvttl`, `line_delimiter`) | Se aplican | Se conservan y `getopts/2` las informa con los valores por defecto de OTP, sin aplicarse; las opciones del sistema (`nodelay`, `keepalive`, `linger`, búferes, `tos`, multicast, ...) se aplican | [puertos](ports.md#sockets) |
| Otras opciones de socket (`{packet, line \| http \| ...}`, `{raw, ...}`, `bind_to_device`, `netns`) | Funcionan | `exit(badarg)` al abrir, `{error, einval}` desde `setopts/2` y `getopts/2` | [puertos](ports.md#sockets) |
| `inet:getopts(S, [multicast_if])` en Windows | Lee memoria sin inicializar para un socket TCP, y la dirección comodín después de que un socket UDP haya establecido una | El valor del sistema; la dirección comodín cuando el socket no tiene ninguna | [puertos](ports.md#sockets) |
| `port_info(Socket, input \| output)`, `input` y `output` de `inet:info/1` | Los bytes de las órdenes y respuestas del driver | 0: el tráfico de sockets solo lo cuenta `inet:getstat/1,2` | [puertos](ports.md#sockets) |
| Motivos de error de sockets | Todo motivo POSIX que informe el sistema | Los habituales (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); los demás son `eio` | [puertos](ports.md#sockets) |
| Entrada de puerto mientras el proceso conectado retiene 1.024 mensajes y puede ejecutarse | Sigue leyendo y entregando | Deja de entregar hasta que termina la porción de tiempo del proceso; por encima de 64 KiB retenidos, deja de leer, de modo que el programa que escribe se bloquea | [puertos](ports.md#busy-ports) |
| `gen_tcp:close/1` con salida encolada | Espera, hasta el valor de `linger`/`send_timeout`, a que la salida se envíe | Retorna de inmediato; el hilo de E/S envía la salida encolada y después cierra | [puertos](ports.md#sockets) |
| Tipos de `monitor/2` | `process`, `port`, `time_offset` | `process` y `port`; `time_offset` lanza `badarg` (no hay cambios de desfase horario) | [procesos](processes.md#monitors) |
| `exit/2`, `exit_signal/2` a una referencia | Envía al alias del proceso, si la referencia es un alias activo | Nada: las señales de salida nunca van a los alias | [procesos](processes.md#exit-signals) |
| Números de referencia | Combinan un identificador de planificador y contadores por planificador (`#Ref<0.178111994.4235460610.214105>`) | Un único contador para todo el programa (`#Ref<0.0.0.1>`), por lo que las referencias se ordenan por creación | [términos](terms.md#pids-and-references) |

## Errores, trazas de pila e informes

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Ubicaciones en trazas de pila | `[{file, F}, {line, L}]`, `error_info` para `error/3` | Siempre `[]`; sin `error_info`, por lo que `erl_error:format_exception/3,4` no muestra ubicaciones ni líneas `*** argument` para ellos | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` con entradas de pila `{Fun, Args}` | Se aceptan | Se rechazan | [ABI](abi.md#stack-traces) |
| Marco superior de `function_clause` | Lista de argumentos | Aridad | [ABI](abi.md#stack-traces) |
| Marco superior de `undef` de una llamada `M:F(A1, ..., An)` | `{M, F, [A1, ..., An], []}` | `{M, F, N, []}`: la aridad en lugar de los argumentos (`apply/3` y las llamadas a funs muestran los argumentos) | [funs](funs.md#dynamic-calls) |
| Llamada dinámica a una exportación que un ejecutable no puede alcanzar (su módulo solo se nombra a través de una traza de pila, una excepción o un mensaje externo al programa) | La llama | `undef`, salvo si se compiló con `--keep-exports`; `function_exported/3` y `module_info(exports)` la siguen enumerando | [ejecutables](executables.md#export-liveness) |
| Marcos de BIF/operadores que fallan | Presentes (`{erlang, '+', Args, ...}`) | Ausentes; nada por debajo de la función de entrada | [ABI](abi.md#stack-traces) |
| Tabla de átomos llena (`list_to_atom/1`) | El emulador aborta (`no more index entries in atom_tab`) y escribe un volcado de memoria (crash dump) | `clau: runtime failure: entry call failed: resource_limit`, código de salida 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` con caracteres por encima de 255 | Sus primeros dígitos usan solo el byte bajo de cada carácter (`[16#131]` es 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` de un BIF | Verdadero para todo BIF del emulador | Verdadero solo para los builtins que proporciona este runtime | [builtins](builtins.md#how-calls-reach-them) |
| Informes de error de procesos que han fallado | Se envían al logger y su manejador por defecto los escribe más tarde (en la salida estándar con `erl`, a menudo se pierden cuando un escript termina antes) | Se escriben en stderr cuando el proceso termina, antes de cualquier salida posterior; no son eventos de `logger`, por lo que los manejadores y filtros no los ven | [procesos](processes.md#exits) |
| Llamadas a funciones que nunca retornan | Compiladas como llamadas de cola (el llamante no aparece en la traza) | Llamadas ordinarias (el llamante aparece) | [ABI](abi.md#stack-traces) |
| Excepciones dentro de un fun anónimo conocido en `-O2` (`F = fun ... end, F(X)`, `lists:map(fun ... end, L)` y los demás bucles de listas, `maps:fold(fun ... end, A, M)`) | Marcos del fun (`-f/1-fun-0-`) y de los helpers de `lists` y `maps` (`lists:map_1/2`) | El cuerpo del fun se ejecuta integrado en el llamante: esos marcos faltan, y una cola de lista impropia de `map/2`, `foldl/3`, `all/2`, `any/2`, `flatmap/2` lanza `function_clause` con el llamante en la cima | [funs](funs.md#inlined-funs) |
| Memoria del anfitrión agotada | El emulador informa de que no puede reservar memoria, escribe un volcado de memoria y se detiene | `clau: runtime failure: entry call failed: out_of_memory`, código de salida 70, sin volcado | [heap del runtime](runtime-heap.md#failure-behavior) |
| Almacenamiento de maps de más de 32 claves | Un HAMT en el heap de nodos hash de 16 ramas | Un árbol B+ en el heap de hasta 16 entradas por nodo en orden de claves; los tamaños de heap de los maps grandes difieren de los de OTP | [heap del runtime](runtime-heap.md#map-trees) |
| Límite de memoria por proceso | `max_heap_size` (en palabras, heap y pila) mata el proceso con motivo `killed` y registra un informe de error | `--max-heap` / `--max-stack` (bytes) y `--max-memory`, global para todo el runtime, hacen fallar al proceso solicitante como `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, código de salida 70 | [heap del runtime](runtime-heap.md#runtime-memory-limit) |
| Argumentos del programa | `escript` pasa todos los argumentos a `main/1`; los flags del emulador (`+t`) provienen de `%%!` o de `ERL_FLAGS` | Las opciones iniciales del runtime (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) se extraen primero; `CLAUSE_FLAGS` contiene las mismas opciones | [ejecutables](executables.md#runtime-options) |
| Excepción no capturada en un módulo de entrada ordinario | `escript` termina con código 127 | Termina con código 1 y una línea `uncaught exception <class>: <reason>` (los fuentes escript mantienen 127) | [ejecutables](executables.md) |
| Diagnósticos del compilador | Redacción de `erl_lint` (`variable 'X' is unbound`) y advertencias | Redacción propia (`unbound variable X`); las advertencias de lint de OTP en su mayoría no se emiten (tampoco las de native records: campos desconocidos en accesos, actualizaciones y patrones, construcción cualificada con el propio módulo sin valores, records no usados o definidos en cabeceras; un patrón posterior que coincide con un nombre exportado desde una rama) | [semántica](semantic.md#bindings) |
| Módulo de behaviour con un `behaviour_info/1` escrito a mano | Lo llama al compilar los módulos que lo usan y advierte de callbacks ausentes, mal definidos u obsoletos | No se evalúa: los callbacks de quienes lo usan no se comprueban | [semántica](semantic.md#behaviours) |
| Módulos de behaviour que no están ni en el lote ni en la biblioteca de Clause (`application`, ...) | Se cargan desde la ruta de código; sus callbacks se comprueban | Advertencia `behaviour M undefined` | [semántica](semantic.md#behaviours) |
| Manejador por defecto de `logger` | `logger_std_h` escribe de forma asíncrona con protección contra sobrecarga (modos de sincronización, descarte y vaciado, límites de ráfagas, terminación por sobrecarga) | También en `standard_io` (`standard_error` con `CLAUSE_LOGGER_TYPE=standard_error`), pero cada evento se escribe antes de que retorne la llamada de registro; las opciones de sobrecarga se comprueban y conservan sin efecto | [biblioteca](library.md) |
| Procesos de los manejadores de `logger_std_h` | Supervisados por `logger_sup`, reiniciados tras `overload_kill_restart_after` | Enlazados al servidor `logger`; se elimina un manejador cuyo proceso muere | [biblioteca](library.md) |
| `net_adm:names/0,1` | Consulta a epmd: `{ok, Names}` cuando hay un epmd en el anfitrión | `{error, address}`: Clause no tiene cliente epmd | [biblioteca](library.md) |
| `net_kernel:start/1,2` | Inicia la distribución, o da el error de OTP cuando no puede | No disponible (`not_implemented`) | [biblioteca](library.md) |
| Trazado: `erlang:trace/3`, `trace_pattern/2,3`, `trace_info/2`, `trace_delivered/1`, `system_monitor/0,1,2`, `system_profile/0,2`, `seq_trace/2`, `seq_trace_info/1`, `seq_trace_print/1,2`, `dt_*`, el módulo `trace`, `erl_tracer:enabled/3`, `trace/5` | Trazan | `error:notsup` | [builtins](builtins.md#erlang-module) |
| Tokens de `seq_trace` | Se transmiten con los mensajes; los números de serie los cuentan; un trazador del sistema recibe mensajes de traza | Se conservan solo por proceso: no se transmiten, los números de serie permanecen como se establecieron, sin mensajes de traza | [biblioteca](library.md) |
| Ámbitos de `pg` y `global` | Se replican entre nodos conectados; `pg` monitoriza nodos mediante `net_kernel` | Un nodo, sin pares ni monitorización de nodos | [biblioteca](library.md) |
| Recursos de aplicación | Archivos `.app` encontrados en la ruta de código al cargarse; `sys.config`, `-config` y los argumentos `-App Key Value` establecen los entornos | Compilados en el ejecutable a partir de los archivos de recursos de la compilación; cambiarlos requiere recompilar; sin archivos ni argumentos de configuración | [biblioteca](library.md#applications) |
| Aplicaciones `kernel` y `stdlib` | Iniciadas por el arranque; `kernel` tiene un maestro y un supervisor superior | Cargadas y en ejecución sin maestros: `get_supervisor(kernel)` es `undefined`, `info/0` las enumera en ejecución como `undefined` | [biblioteca](library.md#applications) |
| `application:ensure_all_started/3` con `concurrent` | Inicia a la vez aplicaciones independientes; la lista sigue el orden de finalización | Las inicia una tras otra, primero las dependencias | [biblioteca](library.md#applications) |
| `application:takeover/2` | Espera al controlador de aplicaciones distribuidas | Termina con `noproc` (sin `dist_ac`), como hace `load/2` con nodos en ambos | [biblioteca](library.md#applications) |
| Peticiones de E/S a un maestro de aplicación | Se retransmiten al líder de grupo bajo el que se inició la aplicación | Se responden en la E/S estándar | [biblioteca](library.md#applications) |
| `erlang:process_flag(error_handler, Module)` | El runtime llama a `Module:undefined_function/3` y `undefined_lambda/3` para llamadas no definidas | `badarg`; `process_info/2` siempre informa `error_handler`, y las llamadas no definidas lanzan `undef` directamente ([`error_handler`](library.md) solo se puede llamar) | [biblioteca](library.md) |
| Detalles de informes de fallos (`proc_lib`) | Texto de excepción de `erl_error` con información de error ampliada; vecinos con `current_function`, `initial_call` y `current_stacktrace`; `reductions` reales | Línea de clase de la excepción y marcos de pila sin información de error ampliada; vecinos sin esos elementos; `reductions` 0 | [biblioteca](library.md) |
| `client_info` de los informes de error de `gen_server`, `gen_statem` y `gen_fsm` | El `current_stacktrace` del proceso que llama | `[]`: Clause no conserva la pila actual de otro proceso | [biblioteca](library.md) |
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

## ETS

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Orden de `first/1`, `next/2`, `tab2list/1`, `foldl/3` e `i/1` en tablas `set`, `bag` y `duplicate_bag`, y qué numera `slot/2` | Posiciones hash lineales visitadas bloqueo por bloqueo; el orden cambia al crecer la tabla | Partes, después cubetas en orden, después claves en orden de inserción dentro de una cubeta; una posición es una cubeta | [runtime](runtime.md#ets-tables) |
| `ets:all/0` | Incluye las tablas de `kernel` y `stdlib` de OTP; orden de las respuestas de los planificadores | Solo las tablas del programa, sin un orden particular | [builtins](builtins.md#ets) |
| `info/2` `memory` | Palabras reservadas de la tabla y sus objetos | Palabras de los objetos almacenados más los costes adicionales propios de Clause | [builtins](builtins.md#ets) |
| `{write_concurrency, auto}` | El número de bloqueos se adapta a la contención (64 a 8192) | 64 partes fijas, como para `true`; `stats` informa 64 bloqueos | [runtime](runtime.md#ets-tables) |
| `compressed` | Almacena los elementos distintos de la clave en formato externo | Se acepta y se informa; los objetos se almacenan tal como están | [builtins](builtins.md#ets) |
| `info/2` `stats` de un `ordered_set` con `write_concurrency`; `data`; `binary` | Árbol CA `{RouteNodes, BaseNodes, MaxDepth}`; imprime la tabla; los binaries de la tabla fuera del heap | `false`; `true` sin imprimir; `[]` | [builtins](builtins.md#ets) |
| `badarg` de un builtin de `ets` | Incluye `error_info` con una causa (`id`, `access`, `type`, ...) | Solo `badarg` | [builtins](builtins.md#ets) |
| Orden de los resultados de `select`, `match` y `match_object` en tablas hash, y qué resultados contiene cada bloque de `select/3` | Los resultados de cada paso del recorrido se anteponen a la lista, los más recientes primero; posiciones hash lineales | Orden de recorrido de las partes y cubetas de Clause; cada bloque contiene los primeros `Limit` resultados reunidos | [builtins](builtins.md#ets) |
| `select_delete/2`, `select_replace/2` sobre una tabla entera | Ceden cada 1000 objetos (la tabla permanece fijada entretanto) | Se ejecutan de una vez, cada parte bajo su bloqueo | [runtime](runtime.md#ets-tables) |
| Especificaciones de coincidencia que nombran una variable numerada 25 o superior | Renumera todos los átomos `'$N'` de la especificación, incluso dentro de `{const, ...}` (por lo que `{const, '$30'}` da `'$0'`) | Las variables conservan sus números; `{const, '$30'}` da `'$30'` | [runtime](runtime.md#match-specifications) |
| Guards y cuerpos de especificaciones de coincidencia anidados a más de 1000 niveles | Compilan hasta que queda poca pila de C (`system_limit`) | `system_limit` | [runtime](runtime.md#match-specifications) |
| Acciones de traza en `erlang:match_spec_test/3`: `enable_trace`, `disable_trace`, `trace` con flags válidos | Cambian los flags de traza del llamante (29.1.1 falla sin trazador) | `true` tras comprobar los flags (y que un argumento pid está vivo); nada cambia | [builtins](builtins.md#ets) |
| `ets:tab2file/2,3` y `file2tab/1,2` | Mediante un proceso disk_log nombrado con una referencia nueva | Se escriben y leen directamente con `file` | [builtins](builtins.md#ets) |
| `{process_dump}` y `{current_stacktrace}` en `erlang:match_spec_test/3` | El texto del volcado del proceso; su traza de pila | `<<>>`; `[]` | [builtins](builtins.md#ets) |

## dets

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Peticiones que esperan juntas en una tabla | Las consultas, inserciones y eliminaciones encoladas a la vez comparten una actualización de caché; las consultas se responden antes de las escrituras; una tabla fijada hace que algunos escritores duerman 1 ms | Cada petición por turno, en orden de llegada | [builtins](builtins.md#dets) |
| Operaciones largas de dets (reparaciones, `init_table/2,3`, compactaciones, vaciados de una caché grande) | Código Erlang, interrumpido por reducciones | Una llamada a builtin cada una; el hilo de trabajo de la tabla no ejecuta nada más entretanto | [builtins](builtins.md#dets) |
| Procesos de `dets` | El servidor `dets` y `dets_sup` bajo `kernel_safe_sup`, las tablas bajo `dets_sup` | Un servidor `dets` iniciado en el primer uso, sin supervisión; procesos de tabla enlazados a él | [builtins](builtins.md#dets) |
| Orden de `dets:all/0` | Orden ETS del registro | Orden ETS de Clause ([ETS](#ets)) | [builtins](builtins.md#dets) |
| Informes | Una reparación se registra en nivel info; `verbose/0,1` y `DETS_DEBUG` registran más; un fallo interno es `{dets_bug, ...}` | No se registra nada | [builtins](builtins.md#dets) |

## io

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| `~p`, `~w` y escritores de `io_lib` de contenedores anidados a más de 256 niveles | Se imprimen | `system_limit` | [io](io.md#pretty-printing-p) |
| `io_lib:print/4` con una columna o longitud de línea que no es un entero | Depende del término: se imprime (los guards fallan silenciosamente), `function_clause` o `badarith` | `badarith` para cualquier término contenedor | [io_lib](builtins.md#io_lib) |
| Precisión o número de relleno negativos (`~.*c` con -1) | Bucle infinito | `badarg` | [io](io.md#formats) |

## erl_scan

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Ubicación de una continuación de `tokens/3,4` (`continuation_location/1`, sin documentar) | Donde se detuvo el escáner, dentro del token sin terminar | El inicio del token sin terminar, que se vuelve a escanear con los caracteres siguientes | [erl_scan](builtins.md#erl-scan) |
| `{compiler_internal, [ssa_checks]}` | Escanea los comentarios de comprobación `%ssa%` como tokens | Se ignora: siguen siendo comentarios | [erl_scan](builtins.md#erl-scan) |
| Un flotante con base (`16#1.8#e1`, base distinta de 10) cuyos dígitos superan 53 bits | La mantisa convertida como ERTS convierte los enteros grandes | Se acumula en un double; el último bit puede diferir | [erl_scan](builtins.md#erl-scan) |
| Un elemento de lista que no es un carácter dentro de una cadena, átomo entre comillas o escape | `function_clause`, `case_clause` o `if_clause`, según la cláusula | `function_clause` | [erl_scan](builtins.md#erl-scan) |

## erl_parse

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Tokens `'%ssa%'` (cláusulas de comprobación SSA de las pruebas del compilador de OTP) | Se analizan como cláusulas `ssa_check_when` | Error de sintaxis; `erl_scan` nunca produce el token | [erl_parse](builtins.md#erl-parse) |

## erl_eval

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Traza de pila de un error que lanza el evaluador (`{badmatch, V}`, `undef` de una llamada local, ...) | La pila actual del proceso evaluador (`process_info/2` `current_stacktrace`) | La pila en el `throw` del evaluador que la recoge, en marcos de Clause | [erl_eval](builtins.md#erl-eval) |

## erl_lint

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Behaviours nombrados por `-behaviour` | Cualquier módulo de la ruta de código responde a `behaviour_info/1` | Solo responden los módulos enlazados en el programa; otro da `undefined_behaviour` | [erl_lint](builtins.md#erl-lint) |
| Orden de varios errores encontrados en un recorrido de map (variables de tipo de una sola aparición de un tipo, especificaciones sin función, comprobaciones de callbacks) | Orden interno del map (átomos por índice) | Orden de términos | [erl_lint](builtins.md#erl-lint) |
| `erlang:is_builtin/3` para entradas `-deprecated`, `-removed` y `-unsafe` que no se exportan | La tabla de BIF de OTP | Los builtins del runtime, que incluyen funciones nativas de biblioteca | [erl_lint](builtins.md#erl-lint) |
| `is_guard_expr/1` de una construcción de record | Lanza `case_clause` | Responde si los campos son expresiones de guard | [erl_lint](builtins.md#erl-lint) |

## epp

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| `-include_lib("App/...")` fuera de la ruta de inclusión | Se encuentra en `code:lib_dir(App)`, que conoce las aplicaciones de OTP | Se encuentra en `code:lib_dir(App)` de la ruta de código de Clause, que no tiene aplicaciones de OTP salvo si se añaden | [biblioteca](library.md#contents) |

## erl_pp

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Forma de los caracteres que devuelve `erl_pp` | Listas de caracteres profundamente anidadas | Una lista plana de caracteres; la salida aplanada es igual | [builtins](builtins.md#erl-pp) |

## qlc

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Traza de pila de una excepción lanzada en un proceso de cursor, cuando `next_answers/1,2` la vuelve a lanzar | La traza de pila del cursor seguida del `process_info(self(), current_stacktrace)` del propietario | Seguida de la traza de pila de una excepción capturada en el propietario (Clause no tiene el elemento `current_stacktrace`) | [qlc](builtins.md#qlc) |
| `qlc:q/1,2` en `erl_eval`, `ets:table/1,2`, `dets:table/1,2` en un programa que nunca nombra `qlc` | `qlc` siempre está cargado | `undef` para `qlc`: acceden a él por un nombre en tiempo de ejecución, por lo que solo los programas que nombran `qlc` (lo hace cualquier módulo que incluya `qlc.hrl`) lo enlazan | [biblioteca](library.md#how-programs-get-them) |
| Números de anotación en el código de consultas compiladas (`info/2` con `{format, abstract_code}`) | La transformación de OTP numera las anotaciones alrededor de cada entero del módulo, incluidos los caracteres de la ruta de `qlc.hrl` en su atributo `file` | La misma transformación, pero el `qlc.hrl` de Clause tiene otra ruta, por lo que los números tras la primera consulta pueden diferir; el código es igual en lo demás | [qlc](builtins.md#qlc) |

## qlc_pt

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Mensajes de `qlc_pt:parse_transform/2` en tiempo de ejecución | De `compile:noenv_forms/2` (`strong_validation`): `erl_lint` más las pasadas centrales del compilador, como las advertencias de `sys_core_fold` | Solo de `erl_lint`, como hace `qlc_pt` de OTP cuando el compilador no está disponible | [qlc_pt](builtins.md#qlc-pt) |

## Intérprete interactivo

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Edición de líneas en un terminal | `edlin`: teclas de cursor, historial de líneas, búsqueda, autocompletado con tabulador mediante `edlin_expand`, el indicador multilínea `..>` | La edición de líneas propia del terminal (modo procesado); las líneas se leen como las entrega el terminal, con el mismo indicador para cada línea adicional de una orden, como hace OTP para la entrada por tubería | [biblioteca](library.md#interactive-shell) |
| Control de trabajos | Ctrl+G abre el menú JCL (intérpretes nuevos, conectados, interrumpidos y terminados) | Ninguno; el encabezado y la indicación de órdenes lentas siguen nombrando Ctrl+G como los imprime OTP | [biblioteca](library.md#interactive-shell) |
| `exit().` cuando el intérprete lee entrada por tubería | Se inicia un nuevo intérprete y no lee nada más | Se inicia un nuevo intérprete y lee el resto de la entrada | [biblioteca](library.md#interactive-shell) |
| Programas que inician el intérprete sin `--shell` | Se puede llamar a cualquier módulo de la ruta de código | Solo a los módulos que enlaza el programa; sin `--keep-exports`, las llamadas dinámicas solo llegan a exportaciones que el programa puede alcanzar | [biblioteca](library.md#interactive-shell) |
| Records de módulos compilados (`rr(Module)`, `shell_default` y `user_default` al inicio) | Se leen de la información de depuración o del código fuente del módulo | `{error, nofile}`: el código enlazado no conserva código abstracto; `rr/1,2,3` de archivos fuente y `.beam` los leen | [biblioteca](library.md#interactive-shell) |
| `save_module/1` | Escribe el módulo y lo compila con `c:c/1` | Solo escribe el módulo (sin compilador) | [biblioteca](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` dentro de una llamada o del valor de un campo de record | Cabeceras de función y tipos de argumentos de la especificación de la función (`lists:seq(From, To)`), átomos y tipos que permite la especificación | Cabeceras `Mod:Fun/Arity` de las aridades exportadas, sin sugerencias de tipos: el código enlazado no conserva especificaciones | [biblioteca](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` de funciones y módulos | Funciones agrupadas por los grupos de la documentación; módulos de la ruta de código | Un grupo `Functions` (sin documentación); los módulos del programa | [biblioteca](library.md#interactive-shell) |
| Columnas de `c:i/0,1`, `c:ni/0`, `c:regs/0` | La llamada inicial y función actual de cada proceso | La llamada inicial de `proc_lib` o `undefined`; la función actual `undefined` (sin elemento `current_function`) | [biblioteca](library.md#interactive-shell) |

## Números aleatorios

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Alturas de las franjas del zigurat normal de `rand` | Constantes tabuladas | Calculadas al double más cercano a partir de las constantes del zigurat; una altura puede diferir en su último bit, lo que cambia una aceptación de la vía lenta solo para una extracción dentro de ese bit del límite (probabilidad cercana a 2^-53 por extracción de la vía lenta). Los anchos y límites de las franjas se observan de OTP y son iguales | [builtins](builtins.md#random-numbers) |

## crypto

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Orden de `crypto:supports(ciphers)` | La tabla del NIF ordenada por índice de átomo, que varía entre ejecuciones de la VM, y después los alias | Orden de la tabla de OTP y después los alias | [builtins](builtins.md#crypto-module) |
| `{File, Line}` de los errores de `crypto` `{badarg \| notsup \| error, {File, Line}, Description}` | Archivo fuente C y línea de OTP (`{"hash.c", 111}`) | Archivo fuente C++ y línea de Clause (`{"hash.cpp", 63}`); la clase y descripción son las de OTP | [builtins](builtins.md#crypto-module) |
| `link_type` de `crypto:info/0` | Cómo enlazó OTP libcrypto (normalmente `dynamic`) | Siempre `static`, también cuando se enlaza una libcrypto compartida instalada | [OpenSSL](crypto.md) |
| Cálculos largos de `pbkdf2_hmac/5` (más de 100 iteraciones o 64 bytes) | Se ejecutan en un planificador de CPU para operaciones sucias | Se ejecutan en el hilo de trabajo del planificador del proceso que llama, que no ejecuta ningún otro proceso entretanto | [builtins](builtins.md#crypto-module) |
| `modules` de la aplicación `crypto` | `[crypto, crypto_ec_curves]` | `[crypto]` | [biblioteca](library.md) |
| Textos largos de `crypto_one_time/4,5` y `crypto_one_time_aead/4,6,7` (más de 20000 bytes) | Se ejecutan en un planificador de CPU para operaciones sucias | Se ejecutan en el hilo de trabajo del planificador del proceso que llama, que no ejecuta ningún otro proceso entretanto | [builtins](builtins.md#crypto-module) |
| La variable de aplicación `fips_mode` de `crypto` | Se lee al cargar el módulo `crypto`: `true` activa el modo FIPS | No se lee (Clause no tiene `on_load` y los programas no tienen `sys.config`): se usa `crypto:enable_fips_mode/1` o `clau --fips` | [crypto](crypto.md#fips) |
| `crypto:info_fips/0` sin un proveedor FIPS que se pueda cargar | `not_enabled` cuando OTP se compiló con soporte FIPS, `not_supported` en otro caso | `not_supported` | [crypto](crypto.md#fips) |
| Cuándo se carga la aplicación `crypto` | Cuando se carga el módulo `crypto` (su `on_load`) | Cuando un generador `crypto_cache`, `crypto_aes` o `crypto_prng1` lee por primera vez `rand_cache_size` | [biblioteca](library.md) |
| Generación de claves RSA (`crypto:generate_key(rsa, ...)`) y firmas SLH-DSA | Se ejecutan en un planificador de CPU para operaciones sucias | Se ejecutan en el hilo de trabajo del planificador del proceso que llama, que no ejecuta ningún otro proceso entretanto | [builtins](builtins.md#crypto-module) |
| La opción `rsa_sslv23_padding` de `crypto:public_encrypt/4` y funciones afines | Se acepta cuando OTP se compila con un OpenSSL que tiene relleno SSLv23 (1.1, 3.x) | `"Bad padding type in option rsa_padding"`, como OTP compilado con OpenSSL 4 | [builtins](builtins.md#crypto-module) |
| `crypto:ec_curve/1` de una curva que falta en la libcrypto enlazada (un OpenSSL compilado sin curvas binarias) | Los parámetros de `crypto_ec_curves` | `error:function_clause`, como para una curva desconocida: los parámetros proceden de las curvas integradas de libcrypto | [builtins](builtins.md#crypto-module) |
| Descifrado de información de depuración de `beam_lib` en un programa que no llama a `crypto` | `crypto` siempre está presente | `key_missing_or_invalid` salvo si el programa enlaza `crypto` (`--with-crypto`), ya que `beam_lib` lo llama dinámicamente | [biblioteca](library.md) |

## ASN.1

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Pila en `{error, {asn1, {Reason, Stack}}}` | Marcos de las funciones generadas `enc_*`/`dec_*` y de `asn1rtt_*` | Marcos de `Module:encode/2` o `decode/2` y del builtin del códec | [asn1](asn1.md#generated-modules) |
| Funciones de un módulo generado | También exporta `enc_Type/1,2`, `dec_Type/1,2` y las demás funciones por tipo que genera asn1ct | Solo `encode/2`, `decode/2`, `info/0`, las funciones de opciones y las funciones de valores | [asn1](asn1.md#generated-modules) |
| Un `CHOICE` cuyo cuerpo empieza con `...` (sin alternativas raíz) | asn1ct informa de un error de sintaxis | Se acepta | [asn1](asn1.md#coverage) |
| Macros y funciones de valores que nombran otro valor dentro de un tipo abierto (`mgf1SHA1`, `rSASSA-PSS-Default-Identifier` de PKCS-1) | asn1ct deja `{'Externalvaluereference', Line, Module, Name}` en lugar del valor | El valor referenciado | [asn1](asn1.md#generated-modules) |
| Un error en tiempo de ejecución (no de ASN.1) mientras `public_key` decodifica o codifica un valor de extensión | Se lanza en cuanto ocurre, en su mayoría de clase `error`, desde la función generada `dec_ext-*`/`enc_ext-*` | `exit({error, {asn1, Reason}})`: el valor pasa por `decode/2` o `encode/2` del módulo generado, que envuelve todos los fallos | [public_key](public_key.md#functions) |
| Los grupos Diffie-Hellman por defecto de `public_key:dh_gex_group/4` | Los grupos que generó OTP (`lib/public_key/priv/moduli`), 60–81 por tamaño | Ocho por tamaño del archivo de módulos de OpenSSH; los mismos tamaños (2047 a 8191) | [public_key](public_key.md#keys-and-signatures) |
| Marcos de una excepción de `public_key` | `public_key`, `pubkey_pem`, `pubkey_pbe`, `pubkey_cert_records`, `pubkey_cert`, `pubkey_ssh` | `public_key`, `clause_public_key_codec` y `clause_public_key_keys` | [public_key](public_key.md#functions) |

## Parse transforms

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Nombre en el atributo `file` de un archivo incluido (`--print-abstr`, entrada de la transformación) | El directorio de inclusión unido al nombre, tal como se encontró (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | La ruta relativa al directorio de trabajo cuando el archivo está dentro de él; si no, la ruta absoluta | [transformaciones](transforms.md#interchange) |
| Anotaciones de línea 0 de formas importadas (código generado, como el de la transformación `qlc`) | Una línea válida: el código no tiene línea fuente | El código ocupa el lugar del nodo importado antes que él | [transformaciones](transforms.md#importing-forms) |
| Anotaciones `generated` de formas importadas (entradas `.abstr`, salida de la transformación) | `erl_lint` y el compilador omiten algunas advertencias para el código generado | Se ignoran: el código se comprueba como el código fuente | [transformaciones](transforms.md#importing-forms) |
| Formas `{error, {Location, Module, Descriptor}}` en código importado | Se formatean con `Module:format_error/1` | El texto del término del descriptor; formatearlo requiere OTP | [transformaciones](transforms.md#importing-forms) |
| Un módulo con errores de preprocesador o de análisis sintáctico que nombra una parse transform | La transformación se ejecuta y recibe los errores como formas `{error, E}`; `erl_lint` los notifica después | Los errores se notifican y la transformación no se ejecuta | [transformaciones](transforms.md#clause-pipeline) |
| Opciones de compilación que recibe una transformación | La lista completa de opciones de erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (el directorio de trabajo), `{i, _}`, `{d, ...}` y `{parse_transform, _}` | [transformaciones](transforms.md#otp-behavior) |
