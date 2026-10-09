---
source: docs/differences.md
sourceCommit: 06042fa
sourceSha256: b5d1cfc31fec7aaf6e6c4ca75f9056df534ca608a2c93e97a44e6c5e00a1109b
translatedAt: 2026-10-09
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
| Impresión de maps (`erlang:display/1`, `~w`, `~p`) | Orden de la disposición interna (orden de la tabla de átomos para claves átomo, orden de hash por encima de 32 claves) | Orden de claves del map, como `~kw` de OTP | [términos](terms.md#printing) |
| Impresión de records nativos (`erlang:display/1`) | Campos en el orden de índice de la tabla de átomos | Orden de definición, como `~w` | [records nativos](native-records.md#printing-and-order) |
| `==` entre records nativos cuyos campos solo difieren como entero/flotante | El compilador puede plegarlo a `=:=` (false) | Comparación numérica (true) | [records nativos](native-records.md#printing-and-order) |
| Impresión de funs locales (`#Fun<M.Index.Uniq>`) | Índice según la numeración de lambdas del compilador, `Uniq` un hash del código del módulo | Índice de los funs locales del módulo en orden de código fuente, `Uniq` siempre 0 | [funs](funs.md#comparison-and-printing) |
| Orden de dos funs locales de un mismo módulo | Según el índice de OTP | Según el índice en orden de código fuente, por lo que funs de funciones distintas pueden ordenarse de otro modo | [funs](funs.md#comparison-and-printing) |
| Nombres de funs anónimos en trazas de pila (`-f/1-fun-N-`) | `N` según la numeración del compilador | `N` cuenta los funs de `f/1` en orden de código fuente | [funs](funs.md#closures) |
| Un fun anónimo en el valor por defecto de un campo de record | Cada punto de construcción expande su propia copia: los funs de dos puntos distintos no son iguales | Un único fun para el valor por defecto: los funs de cualquier punto de construcción son iguales | [funs](funs.md#closures) |
| Orden de los valores capturados de funs creados dentro de comprehensions | Variables libres de la función generada para la comprehension | Orden de definición en la función contenedora; solo visible al comparar dos de esos funs | [funs](funs.md#closures) |

## Pids, referencias y procesos

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Números de pid | El primer proceso de usuario es aproximadamente `<0.80.0>`; los números se reutilizan cuando la tabla de pids da la vuelta | El primer proceso es `<0.1.0>`; los números provienen de una única secuencia y nunca se reutilizan | [términos](terms.md#pids-and-references) |
| Código tras `spawn(Fun)` de un fun de otra aridad | El análisis de tipos del compilador puede considerar inalcanzable el código posterior a la llamada y eliminarlo, de modo que el llamador devuelve el pid de inmediato | El llamador continúa; solo el nuevo proceso falla con `{badarity, {Fun, []}}` | [procesos](processes.md#builtins) |
| Formateo de un término grande (`io:format/1,2`) | Se ejecuta en código Erlang (`io_lib`) y en el group leader, por lo que el proceso puede ser desalojado durante el formateo | Se ejecuta hasta el final en una sola llamada a un builtin; los demás procesos esperan | [builtins](builtins.md#portions) |
| Flags de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` y otros | Solo `trap_exit`; cualquier otro flag lanza `badarg` | [procesos](processes.md#builtins) |
| Orden de los informes de error de procesos que fallan al mismo tiempo | Orden del logger | El orden en que sus workers los terminan | [procesos](processes.md#workers) |
| Señales a un proceso que se ejecuta en otro planificador | Se encolan en su cola de señales y se procesan después, mientras el emisor continúa | El emisor espera a que termine la porción de tiempo del destino y luego actúa de inmediato; solo observable como diferencia de tiempos | [procesos](processes.md#workers) |
| `list_to_port/1` de un número nunca emitido | Devuelve un término de puerto | `badarg`: solo se admiten los puertos que este programa abrió | [puertos](ports.md#identity) |
| Valores de `port_info/1,2` | `id` es un índice de tabla; `memory`, `queue_size`, `locking` describen el driver | `id` es el número de puerto; `memory` y `queue_size` valen 0; `locking` es `port_level` | [puertos](ports.md#builtins-and-port-messages) |
| Escritura en un archivo abierto solo para lectura | `{error, eacces}` en Windows, `{error, ebadf}` en los demás sistemas | `{error, ebadf}` en todas partes | [puertos](ports.md#standard-io-and-files) |
| `io:get_line`, `io:get_chars` y `file:read/2` en modo lista con entrada no ASCII | Caracteres decodificados según la codificación del dispositivo | Un elemento de lista por byte | [puertos](ports.md#standard-io-and-files) |
| Resultado de `os:cmd/1` | Caracteres Unicode decodificados de la salida | Los bytes de la salida | [puertos](ports.md#subprocesses) |
| Argumentos vacíos de `{spawn_executable, F}` en Windows | Se descartan de la línea de órdenes | Se pasan como `""` | [puertos](ports.md#subprocesses) |
| `{exit_status, S}` y `eof` de un programa lanzado | Orden no especificado, `exit_status` puede llegar antes de los últimos datos | Después de todos los datos, antes de `eof` | [puertos](ports.md#subprocesses) |
| Puertos ocupados | Un puerto con demasiada salida encolada suspende a los emisores; `force` de `port_command/3` funciona en los drivers que lo permiten | La salida nunca suspende; `force` lanza `notsup` en todos los drivers | [puertos](ports.md#io-thread) |
| `{active, N}` de sockets | Un entero `N` cuenta mensajes antes de `{tcp_passive, S}` | `exit(badarg)`; solo `true`, `false` y `once` | [puertos](ports.md#sockets-57f) |
| Opciones de ajuste de sockets (`nodelay`, `keepalive`, `send_timeout`, `delay_send`, búferes) | Se aplican; otras opciones de `inet` (`header`, `{packet, line}`, `http`, ...) funcionan | Las opciones de ajuste enumeradas se aceptan pero no se aplican; las demás opciones dan `exit(badarg)` | [puertos](ports.md#sockets-57f) |
| Motivos de error de sockets | Todo motivo POSIX que informe el sistema | Los habituales (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); los demás son `eio` | [puertos](ports.md#sockets-57f) |
| Entrada de puerto mientras el proceso conectado retiene 1.024 mensajes y puede ejecutarse | Sigue leyendo y entregando | Deja de entregar hasta que termina la porción de tiempo del proceso; por encima de 64 KiB retenidos, deja de leer, de modo que el programa que escribe se bloquea | [puertos](ports.md#busy-ports) |
| `gen_tcp:close/1` con salida encolada | Espera, hasta el valor de `linger`/`send_timeout`, a que la salida se envíe | Retorna de inmediato; el hilo de E/S envía la salida encolada y después cierra | [puertos](ports.md#sockets-57f) |
| Tipos de `monitor/2` | `process`, `port`, `time_offset` | `process` y `port`; `time_offset` lanza `badarg` (no hay cambios de desfase horario) | [procesos](processes.md#monitors) |
| `exit/2`, `exit_signal/2` a una referencia | Envía al alias del proceso, si la referencia es un alias activo | Nada (no hay alias) | [procesos](processes.md#exit-signals) |
| Números de referencia | Combinan un identificador de planificador y contadores por planificador (`#Ref<0.178111994.4235460610.214105>`) | Un único contador para todo el programa (`#Ref<0.0.0.1>`), por lo que las referencias se ordenan por creación | [términos](terms.md#pids-and-references) |

## Errores, trazas de pila e informes

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Ubicaciones en trazas de pila | `[{file, F}, {line, L}]`, `error_info` para `error/3` | Siempre `[]`; sin `error_info` | [ABI](abi.md#stack-traces) |
| Marco superior de `function_clause` | Lista de argumentos | Aridad | [ABI](abi.md#stack-traces) |
| Marco superior de `undef` | `{M, F, Args, []}` de la función inexistente | El marco de la función que llama | [funs](funs.md#dynamic-calls) |
| Marcos de BIF/operadores que fallan | Presentes (`{erlang, '+', Args, ...}`) | Ausentes; nada por debajo de la función de entrada | [ABI](abi.md#stack-traces) |
| Tabla de átomos llena (`list_to_atom/1`) | El emulador aborta (`no more index entries in atom_tab`) y escribe un volcado de memoria (crash dump) | `clau: runtime failure: entry call failed: resource_limit`, código de salida 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` con caracteres por encima de 255 | Sus primeros dígitos usan solo el byte bajo de cada carácter (`[16#131]` es 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` de un BIF | Verdadero para todo BIF del emulador | Verdadero solo para los builtins que proporciona este runtime | [builtins](builtins.md#how-calls-reach-them) |
| Informes de error de procesos que han fallado | Se envían al logger y su manejador por defecto los escribe más tarde (en la salida estándar con `erl`, a menudo se pierden cuando un escript termina antes) | Se escriben en stderr cuando el proceso termina, antes de cualquier salida posterior | [procesos](processes.md#exits) |
| Llamadas a funciones que nunca retornan | Compiladas como llamadas de cola (el llamador no aparece en la traza) | Llamadas ordinarias (el llamador aparece) | [ABI](abi.md#stack-traces) |
| Memoria del sistema agotada | El emulador informa de que no puede reservar memoria, escribe un volcado de memoria y se detiene | `clau: runtime failure: entry call failed: out_of_memory`, código de salida 70, sin volcado | [heap del runtime](runtime-heap.md#failure-behavior) |
| Límite de memoria por proceso | `max_heap_size` (en palabras, heap y pila) mata el proceso con motivo `killed` y registra un informe de error | `--max-heap` / `--max-stack` (bytes) y `--max-memory`, global para todo el runtime, hacen fallar al proceso solicitante como `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, código de salida 70 | [heap del runtime](runtime-heap.md#runtime-memory-limit) |
| Argumentos del programa | `escript` pasa todos los argumentos a `main/1`; los flags del emulador (`+t`) provienen de `%%!` o de `ERL_FLAGS` | Las opciones iniciales del runtime (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) se extraen primero; `CLAUSE_FLAGS` contiene las mismas opciones | [ejecutables](executables.md#runtime-options) |
| Excepción no capturada en un módulo de entrada ordinario | `escript` termina con código 127 | Termina con código 1 y una línea `uncaught exception <class>: <reason>` (los fuentes escript mantienen 127) | [ejecutables](executables.md) |
| Diagnósticos del compilador | Redacción de `erl_lint` (`variable 'X' is unbound`) y advertencias | Redacción propia (`unbound variable X`); las advertencias de lint de OTP en su mayoría no se emiten (tampoco las de campos desconocidos de records nativos en accesos, actualizaciones y patrones) | [semántica](semantic.md#bindings) |

## Casos límite del lenguaje

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Segmento entero más ancho que el límite de enteros, con un valor que lo supera (`<<V:4194241>>` todo unos) | El JIT de x86 encaja con un término inválido; usarlo bloquea la VM | No encaja | [términos](terms.md#integers) |
| Grupo zip cuyos generadores relajados y estrictos comparten una variable | La prueba de omisión mantiene las variables de los patrones estrictos en los patrones relajados | Un paso rechazado se omite siempre que los patrones estrictos encajen por sí solos | [patrones](patterns.md#comprehensions) |
| Llamada a un fun externo, `M:F(Args)` o `apply/3` de un módulo ajeno al programa | Carga el módulo desde la ruta de código, `undef` si no existe | `undef`; los módulos de biblioteca solo se incorporan al programa cuando este los nombra con un átomo literal | [funs](funs.md#dynamic-calls), [biblioteca](library.md#how-programs-get-them) |
| `lists` y `maps` | Los módulos completos; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` siguen el orden interno del map (orden de la tabla de átomos para claves átomo, orden de hash por encima de 32 claves) | El [subconjunto de la biblioteca](library.md); las funciones de map siguen el orden de claves | [biblioteca](library.md) |
| Archivos sin `#!` pasados como escripts | `escript file.erl` omite la primera línea | Se compilan como módulos ordinarios | [ejecutables](executables.md) |
| Escripts de beam precompilado y de archivo | Se ejecutan | No soportados | [ejecutables](executables.md) |
| Un `-spec` cuyos tipos no comparten ningún valor con el resultado inferido, el dominio de entrada o los argumentos de una llamada | Compila; Dialyzer puede advertir | Error de compilación que nombra los tipos declarado e inferido | [análisis semántico](semantic.md#inference) |

## io

| Diferencia | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Secuencias de control `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, modificador `K` | Se formatean | `badarg` | [io](io.md#formats) |
| `~p` de contenedores anidados a más de 256 niveles | Se imprimen | `system_limit` | [io](io.md#pretty-printing-p) |
| Anchos de campo y precisión de `~ts` con caracteres combinables o `\r\n` | Cuentan clústeres de grafemas | Cuentan puntos de código | [io](io.md#formats) |
| Precisión o número de relleno negativos (`~.*c` con -1) | Bucle infinito | `badarg` | [io](io.md#formats) |
| Funciones de `io` distintas de `format/1,2`, `put_chars/1` | Existen | `unknown module io` | [io](io.md#calls) |
