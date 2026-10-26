---
source: docs/builtins.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d6df02dea1e6270774c9766671b42d9c4b5af4090512da97273a2a4a3a58197f
translatedAt: 2026-10-26
---
# Builtins

Funciones que el runtime implementa en C++: BIF de `erlang` y funciones de
otros módulos cuyos equivalentes en OTP son BIF, NIF o necesitan el runtime.
Registradas por módulo, función y aridad; alcanzadas directamente, mediante
llamadas dinámicas y como funs. Los fuentes están en `runtime/src/builtins/`;
las diferencias observables respecto a OTP están en
[diferencias](differences.md).

## Qué builtins existen

- Catálogo `abi::v1::bridge_builtins`
  ([builtins.hpp](../abi/include/clause/abi/builtins.hpp)): todos los builtins
  que conocen tanto el compilador como el runtime; los comentarios de grupo
  nombran el archivo que los implementa.
- El índice de una entrada es el número que el código generado pasa al puente;
  el catálogo puede reordenarse (compilador y runtime se compilan juntos).
- Módulo `erlang`: BIF de guard, operadores como funciones, `display/1`,
  `halt/0,1`, lanzamiento de excepciones, acceso a términos, conversiones,
  procesos, puertos, formato externo de términos, tiempo, información del
  sistema, información de funs, hashing, carga de código.
- Otros módulos: una sección para cada uno a continuación; los módulos
  auxiliares privados (`clause_unicode`, `clause_re`, `clause_zlib`,
  `clause_receive`, ...) sirven al código de biblioteca Erlang.
- El estado por función (builtin, cuerpo Erlang, stub) está en
  `library/<application>/<module>.terms` ([biblioteca](library.md#files)).
- Una llamada cualificada a un builtin del catálogo llama al puente; cualquier
  otra función de `erlang` llega al [módulo erlang de biblioteca](#erlang-module).

## Cómo los alcanzan las llamadas

| Código fuente | Ruta |
| --- | --- |
| `abs(X)`, `X + Y`, `display`, `halt`, `error` | Código en línea o un servicio dedicado |
| Builtins del catálogo sin servicio en línea (`A -- B`, ...) | Se entra como en una función: `CLAUSE_builtin_frame_v1`, argumentos en registros |
| Builtins directos (nunca hacen trap, esperan ni acceden a otro proceso) | `CLAUSE_builtin_call_v1` devuelve el resultado |
| Builtins rápidos (`length`, `binary_to_list`, `list_to_binary`, `iolist_to_binary`) | Ruta rápida acotada (256 celdas, 4096 bytes de resultado); si no, se entra en el marco |
| `A ++ B` | Un `A` propio corto se copia en línea; si no, se entra |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externo `erlang:F/A` vinculado al builtin |
| `M:F(Args)`, `apply/3`, `fun M:F/A` en tiempo de ejecución | Primero la exportación del módulo, después el builtin |

- `fun F/A` de una autoimportación que el módulo ni define ni suprime es
  `fun erlang:F/A`, como en OTP. Las funciones no autoimportadas (`display/1`,
  `raise/3`, `make_tuple/2,3`, ...) necesitan el prefijo `erlang:`.
- Un marco de builtin tiene cuerpo nulo: entrar no apila ningún marco, por lo
  que una llamada de cola retorna al llamante del llamante.
- Los errores (`badarg`, `badarith`, `system_limit`, `{badmap, M}`,
  `{badkey, K}`) usan el canal de fallos comprobado.
- El acceso a términos y las conversiones siguen las reglas `badarg` de OTP:
  - `setelement/3`: índice pequeño dentro de la tupla; `make_tuple/2,3`: tamaño
    0..16,777,215; `A ++ B`: `A` propio; `A -- B`: listas propias, `=:=`,
    O((n + m) log m).
  - `list_to_atom/1`: el carácter 256 provoca `system_limit`; una tabla de
    átomos llena (`--max-atoms`) termina con código 70.
  - `integer_to_list/2`, `list_to_integer/2`: base 2..36; `system_limit` por
    encima de 1,262,611 dígitos decimales.
  - `float_to_list/1,2`: formatos de OTP (`scientific`, `decimals`, `compact`,
    `short`); un texto de 256 bytes o más provoca `badarg`.
  - Las variantes binary comparten las reglas de texto
    (`erlang/conversion_text.cpp`); el texto de flotantes necesita dígitos a
    ambos lados del punto.
- `function_exported/3`: verdadero para una exportación del programa o un
  builtin registrado.

## Porciones

Los builtins cuyo trabajo crece con una lista o un binary se ejecutan en
porciones acotadas, como los BIF de OTP que hacen trapping.

- Cada entrada en un builtin consume una reducción; una porción realiza
  `WORK_PER_REDUCTION` (16) unidades por reducción restante en el turno.
- Si queda trabajo: `ProcessStack::trap` designa una continuación; los términos
  de estado permanecen en registros (raíces), el estado nativo en `TrapState`.
  El proceso cede la ejecución y se reanuda más tarde.
- Pueden continuar en una exportación Erlang (`io` a un dispositivo de proceso
  hace trap hacia `file:write/2`).
- Resultados, errores y orden equivalen a ejecutar hasta el final. Las llamadas
  del anfitrión (`call_builtin`) completan todos los traps de una vez.
- Las entradas pequeñas toman rutas rápidas a nivel de palabra (`++` con
  ≤ 64 celdas, `integer_to_list`, `list_to_integer`, `atom_to_list` cortos,
  conversiones de tuplas).
- Hacen trapping: `length/1` en un cuerpo (en guard sigue en línea), `++`,
  `--`, `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`.
- Todo lo demás, incluidos `io:format` y los builtins de tuplas, se ejecuta
  hasta el final.

## Builtins tipados

- Funciones C++ `Result F(ProcessContext &, Parameters...)` registradas con
  `typed_entry<F>(module, name)`
  ([typed.hpp](../runtime/src/builtins/typed.hpp)).
- El adaptador admite palabras de argumentos y las convierte a los tipos de
  parámetros; una incompatibilidad provoca `badarg` antes de ejecutar el
  cuerpo. `Named<Role>` impide intercambiar parámetros de términos.
- Devuelven un término, `BuiltinResult` o `Word` sin procesar, o lanzan
  `BuiltinFailure`; otras excepciones C++ se convierten en `out_of_memory` o
  `internal_error`.
- Los BIF de guard, operadores y builtins de listas que hacen trapping son
  adaptadores `BuiltinBody` a nivel de palabra; las conversiones frecuentes
  leen las celdas en el sitio (`TermAccess::trusted`).

## Registro

- `BuiltinRegistry`
  ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  propiedad de `CodeServer`, asocia módulo/función/aridad a un `BuiltinFrame`;
  `add` registra un lote entero o no registra nada.
- El arranque registra cada tabla de `production_builtins()`
  (`builtins/registry.cpp`), después las de las extensiones del runtime que
  enumera el descriptor de arranque (`RuntimeOptions::extensions`): la del
  archivo de biblioteca crypto cuando el programa lo enlaza
  ([módulo crypto](#crypto-module)).
- Persistencia: se omiten las exportaciones de módulos con nombre de builtin,
  por lo que las llamadas nunca llegan a un cuerpo `clause_builtin_placeholder`
  ni a una función del usuario con el mismo nombre.
- La ruta del anfitrión `abi::v1::dispatch_builtin` es independiente
  ([runtime](runtime.md#code-server-and-builtins)).

## Organización del código fuente

- Los módulos grandes tienen un subdirectorio con un archivo por familia
  (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`, `zlib/`, ...); los
  pequeños son archivos únicos.
- Cada archivo de familia define una tabla `*_builtins()` enumerada en
  `production_builtins()`. Nueva familia = nuevo archivo; dividir los archivos
  que superen unas 400 líneas.
- El compilador nunca lee fuentes del runtime; el catálogo es la lista
  compartida.

## Módulo erlang

- `library/erts/erlang.terms`: exportaciones de OTP 29 como
  `{Name, Arity, Flags, Status}` (flags `auto_import`, `guard`; estado
  `implemented` o `{unavailable, Reason}`), con estados mantenidos a mano.
- `tests/compiler/builtins/generate_erlang.py` escribe
  `library/erts/erlang.erl` (stubs) y
  `compiler/src/semantic/erlang_auto_imports.inc`. CTests
  `builtins_erlang_inventory` (actual) y `builtins_erlang_freshness` (OTP del
  anfitrión).
- Los builtins tienen prioridad para `erlang:F(...)`, `fun erlang:F/A`,
  `apply` e importaciones; otras exportaciones lanzan
  `{not_implemented, F, A}` al llamarlas, las de trazado
  (`{unavailable, tracing}`: `trace*`, `system_monitor`, `system_profile`,
  `seq_trace*`, `dt_*`) `notsup`; los nombres desconocidos son
  `undefined function`.
- Extras (`executables_erlang_gaps`, `_packet_decoding`, `_suspension`):
  - `adler32`, `crc32` y `*_combine` sobre la versión fijada de zlib;
    `iolist_to_iovec/1`.
  - `append_element/2`, `insert_element/3`, `delete_element/2`.
  - Cookies como en un nodo no activo; `halt/2` como `halt/1`.
  - `send/3`, `spawn/2,4` y similares ([procesos](processes.md#builtins)).
  - `decode_packet/3`: todos los tipos de paquete y opciones de OTP, términos
    http de OTP.
  - `suspend_process/1,2`, `resume_process/1`, `process_display/2`.

## Formato externo de términos

`erlang/term_encoding.cpp`, `term_decoding.cpp`; códec compartido con el
compilador ([external_term.hpp](../abi/include/clause/abi/external_term.hpp)),
pilas explícitas.

- `term_to_binary/1,2`: bytes de OTP para `nonode@nohost`; opciones
  `minor_version`, `deterministic`, `compressed`; los funs locales y native
  records son `notsup`.
- `term_to_iovec/1,2`, `external_size/1,2`.
- `binary_to_term/1,2`: longitudes comprobadas antes de asignar memoria;
  `safe`, `used`; una entrada mal formada o identidades ajenas provocan
  `badarg`.
- Las pilas del códec y los bytes codificados de `term_to_binary` son búferes
  por hilo conservados entre llamadas (hasta 1 MB cada uno,
  `builtins/scratch.hpp`), de modo que un término grande no necesita páginas
  nuevas en cada llamada; los enteros pequeños evitan la ruta general de
  elementos en ambos sentidos.
- CTests `executables_external_terms`, `builtins_etf_fuzz`.

## Tiempo

`erlang/time.cpp`.

- El tiempo monotónico es el reloj estable; `native` son nanosegundos; átomos
  de unidad de OTP o enteros de partes por segundo.
- `convert_time_unit/3` redondea hacia abajo; `unique_integer/0,1` usa un único
  contador creciente; `now/0` es estrictamente creciente.
- Las conversiones de calendario son estrictas y usan la zona local de la
  biblioteca C.
- Temporizadores: [procesos](processes.md#timers).

## Información del sistema

`erlang/system.cpp`, `erlang/system_flags.cpp`.

- `statistics/1`: `wall_clock`, `runtime`, colas de ejecución,
  `context_switches`; los contadores de reducciones, GC y E/S devuelven ceros.
- `system_info/1`: `otp_release` `"29"`, `version` `"17.1"`, `machine`
  `"Clause"`, recuentos, límites, respuestas fijas del emulador; lista completa
  en `system.cpp`.
- `memory/0,1`: tipos de OTP; `binary`, `code`, `ets` son 0.
- `system_flag/2`: `backtrace_depth` (≤ 64) y `min_heap_size` tienen efecto;
  la mayoría de los demás se releen sin efecto; `cpu_topology`, `erts_alloc`,
  ... provocan `badarg`.

## Hashing

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2`, `phash/2`: valores de OTP para átomos, números, binaries,
  listas, tuplas, maps; pids, puertos, referencias y funs usan el hashing
  propio de Clause.
- `md5/1` y `md5_init/update/final`: RFC 1321; el contexto es un binary de
  96 bytes propio de Clause.

## Carga de código

`erlang/code.cpp`. Todos los módulos se enlazan y permanecen cargados; el
código dinámico queda aplazado.

- `module_loaded/1`, `loaded/0`, `pre_loaded/0` abarcan los módulos compilados
  y builtin.
- `delete_module/1` de un módulo cargado es `notsup`; `prepare_loading/2` es
  `{error, badfile}`.

## Módulo lists

`builtins/lists/`. El `lists` de OTP es Erlang, por lo que los builtins lanzan
lo que lanzan sus cláusulas.

- Los recorridos (`sublist`, `flatten`, mezclas, `key*`, `zip`, `sort`,
  `usort`, ...) lanzan `function_clause` como OTP y mantienen la misma
  evaluación perezosa (`sublist([a | b], 1)` es `[a]`).
- `keymember/3`, `keysearch/3` son BIF: reglas `badarg`.
- Elementos iguales: gana el primero (`max([1, 1.0])` es `1`).
- Las funciones que toman funs y el resto son Erlang en
  `library/stdlib/lists.erl`; dentro se llama a los builtins de forma
  cualificada.
- El `function_clause` de un builtin no tiene marco propio.

## Módulo math

`builtins/math.cpp`.

- Todas las funciones de OTP 29 sobre la biblioteca C; valores no numéricos
  provocan `badarg`, resultados no finitos `badarith`.
- La generación de código de 64 bits inserta en línea `sqrt`, `floor`, `ceil`,
  `exp`, `log*`, `sin`, `cos`, `pow` sobre números, conservando valores double
  sin empaquetar.

## Módulo binary

`builtins/binary/`; `replace/3,4` y `list_to_bin/1` son Erlang.

- Patrones: binary, lista de binaries o compilados; coincidencia más a la
  izquierda y después la más larga; `scope`, `global`, `trim`, `trim_all`.
- `compile_pattern/1` devuelve `{bm, ...}` o `{ac, ...}` sin referencia.
- Las demás funciones siguen OTP; argumentos erróneos provocan `badarg`;
  `referenced_byte_size/1` es el tamaño del propio binary.

## Módulo maps

`builtins/maps.cpp`, `builtins/os.cpp`.

- Todas las funciones documentadas de `maps`; las principales son builtins con
  los errores de OTP; las claves coinciden exactamente.
- Las funciones que toman funs son Erlang en `maps.erl`; los iteradores usan
  [`erts_internal:map_next/3`](#erts-internal).
- Los cursores de maps recorren maps planos y de árbol en orden de claves;
  `clause_maps:entries/1` alimenta `maps:fold/3`.
- `os`: `type`, `getenv`, `env`, `putenv`, `unsetenv`, `getpid`, `version`
  son builtins; las funciones de tiempo son Erlang; `os:cmd/1` usa un puerto.

## Colecciones

`builtins/collections/`: todas las funciones documentadas de `ordsets`,
`orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue`, `array`.

- Los recorridos de listas son builtins; las funciones que toman funs son
  Erlang.
- Cada builtin recorre como las cláusulas de OTP: mismos resultados y mismos
  errores para cualquier entrada.
- `dict`, `sets` versión 1: records de hash lineal de OTP (misma disposición y
  orden). Los conjuntos de versión 2 son maps.
- `gb_trees`, `gb_sets`: motor compartido de árboles equilibrados; árboles
  iguales a los de OTP.
- `queue`: movimientos `{Rear, Front}` de OTP; colas iguales a las de OTP.
- `array`: record `#array{}` de OTP 29, modificado exactamente como en OTP.

## Conjuntos de conjuntos

- `sofs` (`builtins/sofs/`, `executables_sofs_sets`): records de OTP sobre
  listas ordenadas; álgebra, relaciones y familias son builtins, las funciones
  que toman funs son Erlang.

## Grafo

- `graph` (`builtins/graph/`, `executables_graph_module`): `#graph{}` de OTP;
  recorridos y caminos son builtins con pilas explícitas, las actualizaciones
  son Erlang.

## Grafo dirigido

- `digraph`, `digraph_utils` (`builtins/digraph/`,
  `executables_digraph_tables`): las tres tablas ETS de OTP; actualizaciones en
  Erlang sobre `ets`; búsquedas de caminos y recorridos son builtins que leen
  las tablas en el sitio.

## ETS

`builtins/ets/` sobre las tablas del runtime ([runtime](runtime.md#ets-tables)).

- Builtins: ciclo de vida de tablas, inserción/búsqueda/borrado, recorridos,
  contadores, `info`; plegados, `i/0..3`, `fun2ms/1` en Erlang.
- Opciones y derechos de acceso como OTP; todos los fallos son `badarg`.
- Especificaciones de coincidencia
  ([runtime](runtime.md#match-specifications)): `select*`, `match*`,
  `match_spec_*`, `erlang:match_spec_test/3`; resultados en orden de recorrido,
  continuaciones con la forma de OTP.
- Archivos de tablas: `tab2file`, `file2tab`, `tabfile_info` leen y escriben el
  formato disk_log de OTP en ambos sentidos.
- `to_dets/2`, `from_dets/2` sobre `dets`; `table/1,2` en Erlang sobre
  `qlc:table/2` (select/3 por defecto, `first_next`, `last_prev`, `{select, MS}`),
  buscando claves con `==` en un `ordered_set`, si no con `=:=`.
- Los CTests `executables_ets_*` ejecutan los casos de referencia de OTP.

## Dets

`dets.erl` sobre `clause_dets` (`builtins/dets/`): formato de archivo versión 9
de OTP idéntico byte a byte, mismos órdenes en los archivos.

- Motor (C++): cabecera, listas libres buddy, hashing lineal, vaciado de caché
  de escritura, exploraciones, disposiciones masivas.
- Procesos (Erlang): servidor `dets` con las tablas de registro de OTP; un
  proceso por tabla que mantiene el identificador de archivo, caché,
  fijaciones y temporizadores.
- Reparaciones y errores al abrir como OTP; los funs se ejecutan donde los
  ejecuta OTP.
- `table/1,2` en Erlang sobre `qlc:table/2` (select/3 por defecto,
  `first_next`, `{select, MS}`); los auxiliares no documentados son stubs.
- CTest `executables_dets_tables` compara con OTP, incluidos los MD5 de
  archivos.

## Codificaciones

`builtins/encoding/`.

- `base64`: todas las funciones son builtins; los errores de decodificación
  coinciden con las máquinas de estados de OTP.
- `json`: `decode/1`, `encode/1`, `format/1,2` y los codificadores de binary
  son builtins (recurren a Erlang por encima de 256 niveles de anidamiento);
  los decodificadores con callbacks y codificadores que toman funs son Erlang
  sobre analizadores de `clause_json`.

## Mensajes POSIX

`builtins/erl_posix_msg.cpp`, `library/stdlib/erl_posix_msg.erl`.

- `erl_posix_msg:message/1` (módulo interno de OTP que necesita
  `file:format_error/1`): el texto en inglés de un motivo POSIX de una tabla
  observada en OTP 29, `"unknown POSIX error: "` y el nombre para otro átomo,
  `badarg` para un valor que no sea un átomo.

## Nombres de red

`builtins/net/`, `library/kernel/clause_net.erl`, `library/kernel/net.erl`.

- `clause_net:gethostname/0`, `getaddrinfo/2`, `getnameinfo/4`,
  `getservbyname/2`, `getservbyport/2` llaman a las funciones del sistema y
  responden como `prim_net` de OTP: información de direcciones como maps de
  `family`, `socktype`, `protocol` y una dirección de socket, nombres de error
  de prim_net (`eservice`, `enodata`, ...), `{error, einval}` para un servicio
  desconocido. `net` comprueba los argumentos con los guards de OTP y pasa el
  texto como binaries UTF-8.
- `clause_net:inet_getifaddrs/0` enumera interfaces como hace `inet_drv` de OTP
  para `inet:getifaddrs/0` (en Windows a partir de `GetAdaptersAddresses` y
  `GetIfEntry` con sus reglas de flags, prefijos y máscaras por clase; en otros
  sistemas desde `getifaddrs(3)`, fusionadas por nombre y flags como en
  `prim_inet`). `clause_net:getifaddrs/0` las enumera como
  `net:getifaddrs(all)` (Windows: entradas de paquetes y flags ordenados del
  módulo `net` de OTP; en otros sistemas maps de prim_net con direcciones de
  paquetes o de enlace); `net` las filtra por familia, flags o fun.
  `if_names/0` es la lista de índices y nombres en la que buscan tanto
  `net:if_index2name/1` como `if_name2index/1`.
- `inet:getservbyname/2`, `getservbyport/2` y `gethostbyaddr/1` (un
  `getnameinfo` con `NI_NAMEREQD`) usan los mismos builtins; los espacios de
  nombres de red responden `{error, enotsup}` ([diferencias](differences.md)).
- `clause_net:dns_decode/1` y `dns_encode/1` (`builtins/net/dns.cpp`) son el
  códec de mensajes DNS de inet_res: tuplas `#dns_rec{}`, `#dns_header{}`,
  `#dns_query{}`, `#dns_rr{}`, `#dns_rr_opt{}` y `#dns_rr_tsig{}` de OTP con
  los valores de inet_dns (tipos, clases y códigos de operación simbólicos,
  etiquetas de nombres escapadas, LOC en grados y metros) y sus reglas
  `formerr` (punteros de compresión hacia atrás más allá de la cabecera,
  nombres de menos de 255 bytes, secciones truncadas solo con el bit TC); la
  codificación comprime los nombres.

## Nombres de archivo

`builtins/filename/`.

- Las funciones de rutas son builtins que siguen las cláusulas de OTP para la
  familia del anfitrión (Unix o unidades y nombres `//` de Windows); formas de
  resultado y errores de OTP.
- `absname/1,2`, `basedir/2,3` son Erlang.

## Filelib

`builtins/filelib.cpp`, `library/stdlib/filelib.erl`, `library/stdlib/clause_filelib.erl`.

- `clause_filelib:escape/1` representa `@` y `\` de modo que
  `filename:split/1` conserve los escapes; `compile_part/1` compila una parte
  de un patrón dividido (`?`, `*`, `**`, conjuntos de caracteres con rangos,
  alternativas `{...}` que incorporan el resto de su parte) con las
  peculiaridades de OTP (`**` solo como parte completa, `]` al principio o
  como extremo inferior de un rango, `{badpattern, missing_delimiter}`, un
  `case_clause` para alternativas anidadas); `matches/3` y `match/2` filtran
  entradas de directorio.
- El recorrido (prefijos literales, `..`, `**`, comprobaciones de existencia)
  es Erlang sobre `file` y `filename`, por lo que los resultados son los de
  OTP, ordenados.

## Argparse

`builtins/argparse/`, `library/stdlib/argparse.erl`,
`library/stdlib/clause_argparse.erl`.

- `clause_argparse:validate/3` comprueba un comando como `validate/2` de OTP,
  en el orden de OTP, y devuelve el primer campo no válido para que
  `argparse.erl` lance el error.
- `parse/6` es el analizador de OTP como bucle: formas largas (`--name=value`),
  formas cortas, flags combinados, valores adjuntos, números negativos,
  `nargs`, acciones, tipos, subcomandos, valores por defecto; errores lanzados
  y maps de argumentos de OTP.
- `help/4` construye las listas de ayuda de OTP (ajuste de líneas de uso,
  secciones, plantillas) mediante los builtins de `io_lib`, `string` y
  `unicode`, por lo que las formas son iguales a las de OTP.
- Los funs se llaman desde `argparse.erl`: un builtin devuelve una petición
  (`{custom, Fun, Arg}`, `{re, Arg, Re[, Options]}`, `{describe, Fun}`) y se
  llama de nuevo con las respuestas acumuladas, repitiendo su recorrido; cada
  fun se ejecuta una vez, en el orden de OTP.
- `run/3`, los manejadores y `format_error/1,2` son Erlang.

## Qlc pt

`builtins/qlc_pt/`, `library/stdlib/qlc_pt.erl`,
`library/stdlib/clause_qlc_pt.erl`: la transformación sintáctica de qlc en
tiempo de ejecución, para `qlc:string_to_handle/1,2,3` y `qlc:q/1,2` en código
evaluado. Los módulos compilados con `qlc.hrl` siguen recibiendo la
transformación del OTP del anfitrión
([transformaciones sintácticas](transforms.md)).

- `clause_qlc_pt:transform_expression/4` y `parse_transform/4` siguen
  `qlc_pt.erl` función por función: NodeInfo (anotaciones únicas y lo que las
  comprobaciones registran en cada nodo, conservado por número de ranura desde
  1 como en OTP), `no_shadows`, las pasadas de lint que encuentran variables
  introducidas y de generadores, marcos de records `#bind{}` para columnas
  constantes y de unión, omisión de filtros, especificaciones de coincidencia,
  generadores de unión, el fun de estado generado, `Qdata`, `CodeF`
  (`term_to_binary(_, [compressed])` del código original) y el fun de opciones.
  Los datos intermedios son términos Erlang con la forma de OTP, por lo que
  las ordenaciones siguen el orden de términos; las variables generadas son
  referencias como `make_ref/0` de OTP.
- Los mensajes proceden del `erl_lint` de C++ (`Lint`), la ruta que toma
  `qlc_pt` de OTP cuando el compilador no está disponible; un fallo de lint
  sobre las formas que construye es el error interno del compilador, como lo
  comunica el compilador de OTP. Los records se expanden mediante
  `erl_expand_records` de C++, las pruebas de guard mediante `is_guard_test/3`.
- Las especificaciones de coincidencia ejecutan `ms_transform` en Erlang: el
  builtin devuelve `{try_ms, Forms}`, `qlc_pt.erl` responde con el resultado
  de `try_ms/4` y llama de nuevo al builtin con las respuestas acumuladas,
  repitiendo su recorrido; el resultado es `{done, Result, Transformed}` (un
  módulo transformado eleva la profundidad de la traza a 500, como hace la
  transformación de OTP).

## Qlc

`library/stdlib/qlc.erl`: todas las funciones en Erlang, ya que la evaluación
llama a los funs de la consulta. Escrito a partir de la documentación de OTP;
los algoritmos son los de OTP donde los revelan las respuestas, su orden o
`info/1,2`.

- Los identificadores conservan las tuplas de OTP (`{qlc_handle, H}` con
  `qlc_lc`, `qlc_table`, `qlc_append`, `qlc_sort`; `{qlc_cursor, {Pid, Owner}}`);
  las consultas compiladas son el `{qlc_lc, Fun, Opt}` de la transformación
  con datos `qlc_v1` o `simple_v1`.
- Preparación: búsquedas por la clave o el índice con menos claves
  (`max_lookup`), especificaciones de coincidencia para funs unarios de
  recorrido y listas, preferencia de uniones por búsqueda frente a uniones
  por mezcla, entradas de uniones por mezcla ordenadas salvo si ya se sabe
  que lo están, consultas simples para `cache` y `unique`, combinadas, y
  nunca para el primer generador.
- Evaluación: las respuestas son listas que terminan en `[]` o un fun de
  continuación. `cache` usa tablas `ets` (`qlc`, privadas) o una lista
  guardada bajo `{Ref, '$_qlc_cache_tmpfiles_'}`, trasladada a un archivo
  temporal al superar `max_list_size`; las uniones por mezcla ponen en un
  archivo las clases grandes de claves iguales
  (`'$_qlc_merge_join_tmpfiles_'`); las ordenaciones ejecutan `file_sorter`
  cuando las respuestas superan `size`. Los archivos temporales son
  `qlc_<node>_<os pid>_<unique>` en `tmpdir` o el directorio de trabajo;
  `tmpdir_usage` informa mediante `error_logger`.
- Los errores encontrados por la evaluación (respuesta que no sea una lista
  de un fun de recorrido o búsqueda, errores de archivo, `{tmpdir_usage, _}`)
  se lanzan con una etiqueta interna y los devuelven `eval/2`, `fold/4`,
  `info/2` y los cursores, como OTP devuelve los errores que lanza su
  `throw_error/1`.
- `info/1,2` imprime la consulta preparada con `erl_pp:expr/3`, las
  descripciones de tablas mediante sus funs de formato (cadenas analizadas
  por `erl_eval:extended_parse_exprs/1`).
- `string_to_handle/1,2,3` y `qlc:q/1,2` de `erl_eval` ejecutan el
  [`qlc_pt`](#qlc-pt) de Clause; `ets:table/1,2`, `dets:table/1,2` y
  `erl_eval` alcanzan `qlc` mediante un nombre en tiempo de ejecución, de modo
  que solo lo enlazan los programas que nombran `qlc`.
- CTest `executables_qlc_queries` compara con OTP: su módulo de consultas se
  compila desde `qlc_queries.abstr`, las formas tras la transformación de OTP,
  por lo que la prueba no necesita OTP del anfitrión
  ([casos de ejecutables](../tests/fixtures/executables/README.md)).

## Cadenas

`builtins/string/`: todas las funciones de `string`.

- Los recorridos siguen `string.erl` sobre `unicode_util:cp/1`, `gc/1`: colas,
  sub-binaries, listas mixtas y errores de OTP.
- Los recorridos desde el final usan bucles en lugar de recursión.
- Las funciones de mayúsculas y minúsculas devuelven la entrada cuando nada
  cambia; `equal/4` normaliza mediante `unicode/normalize.cpp`.
- `to_integer/1`, `to_float/1`, API Latin-1, `jaro_similarity/2` como OTP.

## Cadena URI

`builtins/uri/`.

- `parse/1`: un único recorrido RFC 3986 en el orden de OTP, fragmentos de
  error de OTP.
- `recompose`, `normalize`, `resolve`, `percent_decode`, `quote` y las
  funciones de consultas siguen los recorridos y estilos de error de OTP.
- `unicode/graphemes.cpp` segmenta clústeres para los builtins que los
  necesitan.

## Números aleatorios

`builtins/rand/`.

- `rand`: estados y manejadores de OTP; cada algoritmo da las secuencias de
  OTP. Los manejadores conocidos se ejecutan en C++ (`clause_rand:*`); los
  demás ejecutan el Erlang genérico de OTP.
- `splitmix64_next/1`, `exsp_*`, `mwc59*` son builtins.
- `tools/rand/` observa las constantes de OTP y genera `tables.cpp`.
- `random`: `uniform_s/1` es builtin, el resto Erlang.

## Calendario

`builtins/calendar.cpp`.

- Builtins de aritmética gregoriana sobre enteros cualesquiera, fórmulas y
  errores de OTP.
- La hora local/universal y RFC 3339 son Erlang en `calendar.erl`.

## Temporizador

`builtins/timer.cpp`.

- `seconds/1`, `minutes/1`, `hours/1`, `hms/3` y `now_diff/2` como aritmética
  Erlang sobre números cualesquiera: `badarith` para valores no numéricos,
  `function_clause` para un argumento de `now_diff/2` que no sea una tupla de
  tres elementos.
- Los temporizadores son Erlang en `timer.erl`, sin `timer_server`: los envíos
  a un pid local usan `erlang:send_after/3`; cualquier otro temporizador de un
  solo disparo o de intervalo es un proceso que crea un alias, que lleva su
  `TRef` y al que envía `cancel/1`. Un temporizador de intervalo monitoriza el
  proceso para el que trabaja y termina con él; `apply_repeatedly` espera a
  que termine cada acción antes del siguiente pulso.

## Términos persistentes

`builtins/persistent_term.cpp` sobre la tabla del runtime
([runtime](runtime.md#persistent-terms)).

- `put/2`, `put_new/2`, `get/0,1,2`, `erase/1`, `info/0` con los resultados de
  OTP; las claves coinciden exactamente; las lecturas devuelven el término
  almacenado sin copia.

## Módulo unicode

`builtins/unicode/`: todas las funciones son builtins.

- Codificaciones `latin1`, `utf8`, `utf16`, `utf32` (con orden de bytes); en
  otro caso `badarg`.
- Chardata: binaries, puntos de código, listas anidadas; los binaries
  consecutivos son un único flujo.
- Los fallos dan `{error | incomplete, Converted, Rest}` con la forma de
  `Rest` de OTP.
- Las formas normales, `category/1`, `is_whitespace/1`, `is_id_*` mantienen
  los atajos de OTP.

## Módulo code

`builtins/code.cpp`. Sin proceso `code_server`; las respuestas describen el
programa enlazado.

- `ensure_loaded/1`, `is_loaded/1` (`{file, preloaded}`), `which/1`
  (`preloaded`), `all_loaded/0`, `module_status/0,1`; `is_sticky/1` `false`.
- Ruta de código (`library/kernel/code.erl`): un término persistente
  construido en el primer uso como lo construye el servidor de código
  interactivo de OTP: directorios `ebin` de aplicaciones de `ERL_LIBS`, la
  versión más reciente de cada aplicación en `lib_dir()`, después `"."`.
  `root_dir/0` es el directorio del ejecutable. Los cambios de ruta normalizan
  y comprueban directorios como OTP; `lib_dir/1`, `priv_dir/1` y
  `compiler_dir/0` designan el primer directorio de ruta
  `.../Name[-Vsn][/ebin]`.
- Respuestas de carga para código enlazado: el código objeto encontrado en la
  ruta da el `{error, badfile}` de `erlang:prepare_loading/2`, el código que
  falta `nofile`; `purge/1` `false`, `soft_purge/1` `true`, `delete/1`
  `false`; `get_doc/1` `{error, missing}`; sin soporte de cobertura.

## Módulo io

`builtins/terminal.cpp`, `library/stdlib/clause_io.erl`.

- `clause_io:isatty/1` (`stdin`, `stdout`, `stderr`): una consola en Windows,
  `isatty(3)` en otros sistemas; `window_size/1`: `{Columns, Rows}` de un
  terminal (`GetConsoleScreenBufferInfo`, `TIOCGWINSZ`), si no
  `{error, enotsup}`.
- Responden a los flags de terminal de `io:getopts/0,1`, `io:columns/0,1`,
  `io:rows/0,1` e `io_ansi:enabled/0,1`.
- El servidor de entrada estándar (`io.erl`) lee líneas como el grupo de OTP:
  una petición `get_until` (`io:read/1,2`, `io:scan_erl_exprs/1..4`, los
  comandos del intérprete interactivo) toma una línea cada vez y vuelve a
  escribir su indicador antes de cada línea adicional, y un final de línea
  CRLF se lee como LF.

## Módulo os

`builtins/os.cpp`, `library/kernel/os.erl`.

- `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0`,
  `version/0` son builtins.
- `cmd/1,2`: Erlang sobre un puerto spawn con el protocolo de OTP: Windows
  ejecuta `COMSPEC /c Command`; en otros sistemas `/bin/sh -s unix:cmd` lee
  el comando y escribe `^D` (y el estado de salida) al final. `max_size`,
  `exception_on_failure`, salida UTF-8 decodificada a caracteres.
- `find_executable/2` (builtin): búsqueda de OTP sobre elementos de `PATH`
  (Windows: primero el directorio actual, `.exe`, `.com`, `.cmd`, `.bat`).
- `set_signal/2` (builtin): `badarg` en Windows como OTP; en otros sistemas
  `sigaction`; una señal manejada actúa como el `erl_signal_handler`
  predeterminado de OTP.

## Módulo init

`builtins/init.cpp`, `library/erts/init.erl`. Un sistema arrancado sin script
de arranque.

- Línea de órdenes decodificada una sola vez (`startup/arguments.cpp`): los
  argumentos simples alimentan el argv de la entrada y `get_plain_arguments/0`.
- El único flag es `home`; `script_name/0` es la ruta del ejecutable.
- Las demás funciones son Erlang con las respuestas del sistema arrancado de
  OTP; `script_id/0` es `{"Clause", "29"}`.
- `stop/0,1`, `reboot/0` detienen de inmediato; `boot/1`, `restart/0,1`,
  `make_permanent/2` se rechazan con `notsup`.

## Atomics y counters

`builtins/atomics.cpp`.

- El array `atomics` es una
  [referencia de handle](runtime-heap.md#handle-references) sobre valores
  `std::atomic_ref`; aridad 1..2^27; reglas `badarg` de OTP e `info/1`.
- `counters` es Erlang sobre un array atomics con signo; los contadores de
  concurrencia de escritura son exactos.

## Erts internal

`builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`: las funciones
que llaman `stdlib` y `kernel`.

- Builtins `cmp_term/2` y `map_next/3` (iteradores de map, orden de claves).
- Erlang: `list_to_integer/2`, `binary_to_integer/2`, `map_to_tuple_keys/1`,
  `term_type/1`, contadores, `dynamic_node_name`.
- `get_creation/0` `undefined`; grupos de distribución y `.beam` declinados.
- `erts_code_purger`: nada que purgar.

## Unicode util

`unicode_util.erl` sobre builtins de `clause_unicode` y tablas generadas
(`unicode/tables.cpp`).

- `cp/1`, `gc/1` (UAX #29), `nfd/nfc/nfkd/nfkc`, correspondencias de
  mayúsculas y minúsculas con las formas de OTP; `spec_version/0` `{17, 0}`.
- `tools/unicode/generate.py` construye las tablas a partir de respuestas del
  OTP del anfitrión y datos Unicode 17.0; las compilaciones no necesitan
  ninguno de los dos.
- CTests `executables_unicode_tables`, `_clusters`, `_forms`.

## io_lib

`io_lib.erl`, `builtins/io_lib/`. Listas profundas de caracteres de OTP
construidas en un área de memoria de C++; `io:format` usa el mismo motor.

- Escritores (`write.cpp`): `write`, `write_string`, `write_atom`, ... escapan
  y limitan como OTP.
- Motor de formato (`format_scan.cpp`, `format_build.cpp`): todos los
  controles, `chars_limit`, redondeo de flotantes de OTP; errores `badarg`.
- Impresor con formato (`pretty*.cpp`): disposiciones de `io_lib_pretty` de
  OTP. `clause_io_lib:pretty/2` es `io_lib_pretty:print/2` para el intérprete
  interactivo: `column`, `line_length`, `depth`, `line_max_chars`, `strings`,
  `encoding` y `records`, las definiciones `[{Name, [Field]}]` que devolvería
  un `record_print_fun`, de modo que las tuplas de nombre y tamaño conocidos
  se imprimen como `#Name{Field = Value, ...}` con la disposición de OTP.
  CTest `executables_shell_session`.
- Analizador (`fread.cpp`): controles y continuaciones de `fread/2,3`.
- Recolectores (`collect.cpp`), comprobaciones de imprimibilidad,
  `indentation/2`.
- Funs de `maps_order`: el builtin registra los maps y continúa en
  `clause_io_lib:sort_maps/6`, ejecutándose de nuevo con claves ordenadas.
- El anidamiento superior a 256 provoca `system_limit`. CTests
  `executables_io_lib_text`, `_pretty_print`, `_fread_scanning`.

## Tablas del compilador

`builtins/front_end/`.

- `erl_internal`: tablas de BIF y guards de `erlang.terms`; tablas de tipos y
  operadores; `add_predefined_functions/1`.
- `erl_anno`: formas y errores de OTP.
- `erl_features`: respuestas del compilador de Clause; `used/1` lee
  descriptores o bloques `Meta` de `.beam`.
- `records`: véase [native records](native-records.md#reflection).
- CTests `executables_compiler_tables`, `_records_reflection`.

## Erl scan

`erl_scan.erl` sobre `clause_erl_scan:scan/6` (`front_end/scanner*.cpp`), su
propio analizador léxico que sigue `scan1/5` de OTP.

- Tokens, anotaciones, sigilos, cadenas con comillas triples, errores y restos
  de OTP.
- Los callbacks `reserved_word_fun`, `text_fun` se ejecutan en Erlang en orden
  de tokens.
- Las continuaciones de `tokens/3,4` vuelven a analizar el token incompleto.
- CTest `executables_erl_scan_tokens`.

## Erl parse

`erl_parse.erl` sobre `clause_erl_parse:parse/1` (`front_end/parser*.cpp`), un
analizador de descenso recursivo de la gramática de OTP.

- Formato abstracto y comportamiento de errores LALR de OTP (token de parada,
  orden de errores de acción frente a errores de sintaxis).
- `first_anno/1`, `last_anno/1` siguen el orden de `map_anno/2`.
- `normalise/1`, `abstract/1,2`, `tokens/1,2` son builtins; los recorridos de
  anotaciones con funs son Erlang.
- CTest `executables_erl_parse_forms`.

## Erl eval

`erl_eval.erl` interpreta el formato abstracto en Erlang; los builtins de
`clause_erl_eval` manejan segmentos de sintaxis de bits
(`front_end/erl_eval.cpp`) y coincidencia de patrones
(`front_end/eval_match.cpp`), y `erl_eval:partial_eval/1` e `is_constant_expr/1`
también son builtins.

- `clause_erl_eval:match/4` es `match1/5`: literales, variables, listas,
  tuplas, maps, native records, prefijos `"abc" ++ T`, constantes de
  operadores y patrones binary, que dan `{match, Bindings}`, `nomatch` o
  `invalid` (lanzado como `{illegal_pattern, Pattern}` por `erl_eval.erl`).
  Las claves de maps y tamaños de segmentos son expresiones guard evaluadas
  sobre las vinculaciones exteriores (`front_end/guard_eval.cpp`, compartido
  con `-if` de `epp`); las vinculaciones se leen y almacenan como `orddict` o
  un map, como hace OTP, incluida una lista sin ordenar.
- `clause_erl_eval:bits_gen/4` toma el patrón de un generador binary del
  principio de los bits; el bucle del evaluador, los guards (llaman al
  manejador no local) y los recorridos de comprehensions siguen en Erlang.

- `bit_type/2` resuelve los especificadores de un `bin_element` con los
  valores por defecto y errores de `erl_bits` (`front_end/bit_types.cpp`,
  compartido con `normalise/1`); `bit_segment/3` construye un segmento
  (`badarg`, `system_limit`), `bit_take/3` toma uno del principio de un
  bitstring (`nomatch`).
- Los funs creados por el evaluador son clausuras sobre el entorno
  `{Anno, Bindings, Lf, Ef, UsedVars, Clauses}` de OTP, por lo que `fun_data/1`
  y `erlang:fun_info/2` responden como en OTP; `fun M:F/A` con partes en
  tiempo de ejecución usa `erlang:make_fun/3`.
- `exprs/2`, `expr/2` y `check_command/2` comprueban comandos con
  `erl_lint:exprs_opt/3` como hace OTP.
- CTest `executables_erl_eval_exprs`.

## Erl lint

Las comprobaciones de `erl_lint` son builtins (`front_end/lint*.cpp`)
escritos siguiendo el `erl_lint` de OTP cláusula por cláusula;
`erl_lint.erl` conserva lo que llama a funs u otros módulos.

- Un objeto `Lint` contiene el estado `#lint{}` de OTP; las tablas de
  variables son vectores ordenados por nombre (orddicts de OTP), los conjuntos
  y maps que OTP mantiene en orden de términos son contenedores ordenados,
  por lo que los errores conservan el orden de inserción y las advertencias
  se ordenan como en `return_status/1`.
- `module/1,2,3` pasan por `clause_erl_lint:module/4` con las respuestas de
  `behaviour_info/1` de los comportamientos consultadas en Erlang
  ([diferencias](differences.md#erl_lint)); `format_error/1` da formato a la
  respuesta de `clause_erl_lint:format_spec/1` (incluidas las partes anidadas
  de `io_lib:format/2`), por lo que los resultados son iguales a los términos
  de OTP.
- Las obsolescencias proceden de las tablas `otp_internal` de OTP
  (`front_end/otp_obsolete.inc`, generado por
  `tests/compiler/library/generate_obsolete.escript`).
- `erl_eval:partial_eval/1` y `erl_bits:set_bit_type/2` usados por las
  comprobaciones son C++ (`lint_eval.cpp`, `bit_types.cpp`).
- CTest `executables_erl_lint_checks`.

## Erl pp

La impresión de `erl_pp` es un builtin (`front_end/pp*.cpp`),
`clause_erl_pp:print/2`, portado de las dos pasadas del módulo Erlang anterior;
`erl_pp.erl` conserva los hooks y `legalize_vars/1`.

- La primera pasada convierte una forma en elementos de disposición en un área
  de memoria (`pp_items`, `pp_exprs`, `pp_forms`, `pp_types`); la segunda los
  dispone según el ancho de línea (`pp_layout`), escribiendo átomos, cadenas,
  caracteres y valores mediante los escritores C++ de `io_lib`.
- Una forma que solo puede imprimir el hook detiene la disposición con
  `{hook, Expr, Column, Precedence}`; `erl_pp.erl` llama al hook e imprime de
  nuevo con las respuestas acumuladas, de modo que cada hook se ejecuta una
  vez, en el orden de OTP.
- Las precedencias y `erl_parse:abstract/2` proceden de `erl_parse.cpp`.
- CTest `executables_erl_pp_forms`.

## Epp

Las condiciones `-if` y `-elif` de `epp` las evalúa un builtin,
`clause_epp:eval_if/1` (`front_end/epp_eval.cpp`), para que un programa que
preprocesa archivos no enlace `erl_eval`.

- Evalúa la expresión guard como hace `erl_eval:exprs/3` sin vinculaciones:
  literales, listas, tuplas, maps y actualizaciones de maps, binaries
  (segmentos mediante los builtins de bits de `clause_erl_eval`), operadores
  con `andalso`/`orelse` que dan el valor de su lado derecho, y llamadas a BIF
  de guard (locales autoimportados o `erlang:`) mediante la tabla de guards de
  especificaciones de coincidencia.
- Cualquier error (variables sin vincular, records sin definir, un BIF que
  lanza una excepción, una llamada local) hace falsa la condición, pues `epp`
  lo captura.
- `epp`, `file` y `erl_features` se compilan con
  [vivacidad estricta](compile.md#strict-liveness).

## Erl expand records

`erl_expand_records:module/2` es un builtin (`front_end/expand_records.cpp`):
la expansión recorre formas en C++ en lugar de un gran despacho de cláusulas
Erlang, de modo que los programas que lo llaman no compilan código adicional.

- Orden de recorrido de OTP (segmentos binary del último al primero, lado
  derecho de la coincidencia primero) y numeración `recN`; las pruebas de
  guard `is_record/3` se convierten en patrones.
- Los filtros de comprehensions son pruebas de guard según las reglas de
  `erl_lint` (`front_end/guard_tests.cpp`, con los records del módulo y sus
  funciones locales o importadas).
- Opciones `dialyzer`, `expand_inits`, `[no_]strict_record_tests`, también
  desde atributos `-compile`.
- CTest `executables_erl_expand_records_forms`.

## Módulo zlib

`builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.

- Enlaza zlib 1.3.2 como OTP 29 ([zlib](compile.md#zlib)): mismos bytes.
- Un flujo es una referencia de handle propietaria de `z_stream`; los
  builtins de `clause_zlib` ejecutan una operación sobre toda la entrada.
- `zlib.erl` conserva la API, errores, estados y auxiliares de búfer completo
  de OTP.
- La compresión de `term_to_binary` sigue la regla de tamaño de OTP.

## Módulo zstd

`builtins/zstd/contexts.cpp`, `library/stdlib/zstd.erl`.

- Enlaza zstd 1.5.7 como OTP 29 ([zstd](compile.md#zstd)): mismas tramas.
- Los contextos y diccionarios son referencias de handle propietarias de los
  de libzstd; un contexto que referencia un diccionario lo mantiene vivo. Los
  builtins de `clause_zstd` reflejan el NIF de OTP: fragmentos de salida de
  `ZSTD_CStreamOutSize()` / `ZSTD_DStreamOutSize()` (una trama que declara un
  tamaño menor se descomprime en un único fragmento de ese tamaño), resultados
  `{continue, Rest, Out}`, `{flush, Out}` y `{done, Out}`, comprobaciones del
  propietario (`not_on_controlling_process`), errores
  `{badarg, {invalid_key | invalid_value, Term}}` y `{zstd_error, Name}`,
  booleanos releídos como `false`, tal como los lee el NIF de OTP.
- `zstd.erl` conserva el manejo de iodata, flujos y tramas de OTP.

## Códec ASN.1

`builtins/asn1/` en `clause_runtime`, `library/asn1/clause_asn1.erl`
([ASN.1](asn1.md)).

- `clause_asn1:encode/3` y `decode/3` toman el término de esquema del módulo
  generado, el nombre del tipo y el valor o los bytes (un binary o iolist);
  `decode/3` devuelve `{Value, Rest}`. Interpretan el esquema como el código
  BER generado por asn1ct y `asn1rtt_ber`, y fallan con los mismos motivos de
  `exit`/`error`, que el envoltorio generado convierte en
  `{error, {asn1, Reason}}`.
- Los TLV se analizan como los analiza `asn1rt_nif` (`tlv.cpp`: sus posiciones
  de error, límites de dos bytes para etiquetas y cuatro para longitudes);
  `ber_decode.cpp`, `ber_constructed.cpp`, `ber_encode.cpp` y
  `ber_encode_constructed.cpp` contienen los tipos primitivos y construidos,
  `values.cpp` las comparaciones de INTEGER, REAL y `DEFAULT` de DER,
  `legacy.cpp` las formas antiguas de `BIT STRING`.
- PER (`per.hpp`): `per_bits.cpp` contiene campos de bits, determinantes de
  longitud, números enteros y cadenas con su alineación y fragmentos;
  `per_encode.cpp`/`per_decode.cpp` los tipos primitivos;
  `per_encode_constructed.cpp`/`per_decode_constructed.cpp` secuencias,
  adiciones de extensión, elecciones y tipos abiertos; `per_strings.cpp`
  valores `BIT STRING`. Una decodificación PER toma un binary y devuelve los
  bits que quedan sin leer.

## Clave pública

`builtins/public_key/` en `clause_runtime`,
`library/public_key/clause_public_key.erl` ([public_key](public_key.md)):
los recorridos de records y tablas de `pubkey_translation` y
`pubkey_cert_records` de OTP, que llama `clause_public_key_codec`.

- `translate(decode | encode, Term)` (`translate.cpp`) recorre un término como
  `pubkey_translation:decode/1` y `encode/1`: los records
  `SubjectPublicKeyInfo_algorithm`, `DSA-Params`, `DSA-Sig-Value`,
  `OTPExtension`, `SingleAttribute`, `OneAsymmetricKey` (versión `v1`) y
  `EncryptionAlgorithmIdentifier` de los módulos generados se convierten en
  los que documenta `public_key.hrl`, y viceversa; una lista impropia falla con
  `bad_generator` como la comprehension.
- `oid_name(Table, Oid)` y `name_oid(Table, Name)` (`tables.cpp`, filas en
  `tables.inc`) consultan las tablas `public_key_algorithm` (el tipo de clave
  de un algoritmo), `curve_type`, `named_curve`, `ml_dsa`, `ml_kem`,
  `slh_dsa` y `extension` (el tipo de una extensión); `undefined` cuando la
  tabla no tiene fila, `badarg` para otra tabla.
- `asn1_module(Type)` designa el módulo generado que usan `der_decode/2` y
  `der_encode/2` para un tipo (`public_key:get_asn1_module/1`), `undefined`
  para un tipo que no pertenece a ninguno.

## Módulo crypto

`builtins/crypto/` en el archivo de biblioteca independiente
`clause_runtime_crypto`, `library/crypto/crypto.erl` y `clause_crypto.erl`.

- Enlaza libcrypto de OpenSSL ≥ 3.1.2 (versión fijada 4.1.0,
  [OpenSSL](crypto.md)); solo los programas que llaman a `crypto` (o pasan
  `--with-crypto`) enlazan el archivo de biblioteca, cuya entrada
  `CLAUSE_crypto_extension_v1` enumera el descriptor de arranque.
- `algorithms.cpp` conserva las tablas de nombres de OTP (resúmenes, cifrados,
  MAC, tipos de claves, curvas, KEM) con sus nombres de obtención de OpenSSL;
  la primera llamada a `crypto` carga los proveedores predeterminado, base y
  heredado y obtiene cada resumen, cifrado y MAC, como hace el NIF de OTP al
  cargarse; las curvas se prueban (generando una clave en cada una) en el
  primer `supports(curves)`. `supports/0,1`, `hash_info/1`, `info/0` e
  `info_lib/0` informan de lo que tiene la libcrypto enlazada.
- Los estados de hash son referencias de handle propietarias de un
  `EVP_MD_CTX`; `hash_update/2` devuelve un estado nuevo sobre una copia, como
  el de OTP. Los estados MAC poseen un `EVP_MAC_CTX` que `mac_update/2`
  avanza en el sitio. `crypto.erl` suministra los textos de más de 20000 bytes
  por partes, como hace OTP, para que ninguna llamada a un builtin dure mucho.
- Los errores son los errores del NIF de OTP:
  `{badarg | notsup | error, #{c_file_name, c_file_line_num, c_function_arg_num}, Description}`,
  que `crypto.erl` convierte en `{Class, {File, Line}, Description}` con
  `error_info` (`?nif_call`); descripciones y comprobaciones siguen el orden
  de OTP, el archivo y la línea son los de Clause.
- Los motores responden como un OTP cuyo OpenSSL no admite motores (`notsup`;
  OpenSSL 4 no los tiene).
- Los cifrados (`cipher.cpp`) siguen `api_ng.c` de OTP: los estados de
  `crypto_init/4` poseen un `EVP_CIPHER_CTX` protegido por un bloqueo que
  `crypto_update/2` avanza en el sitio; `crypto_final/1` rellena según las
  opciones (`undefined`, `none`, `zero`, `random`, `pkcs_padding` de OTP);
  `crypto_one_time/5` ejecuta un estado temporal. `crypto.erl` suministra a
  `crypto_update/2` los textos de más de 20000 bytes por partes. AEAD
  (`aead.cpp`) sigue `aead.c` para GCM, CCM y ChaCha20-Poly1305; una etiqueta
  errónea se descifra como `error`. `crypto.erl` ejecuta los generadores
  `rand` `crypto_aes` y `crypto_prng1` como los de OTP, sobre los builtins
  `exro928_*` y `seed58/2` de `rand`.
- FIPS (`fips.cpp`): cada entrada de tabla conserva una segunda obtención
  `fips=yes`, usada en modo FIPS; una entrada sin ella está prohibida en ese
  modo (`*_FORBIDDEN_IN_FIPS` de OTP), sale de `supports/1` y lanza las
  descripciones `notsup` de OTP. `enable_fips_mode/1` cambia las propiedades
  predeterminadas de OpenSSL; los programas compilados con `--fips` enlazan la
  entrada `CLAUSE_crypto_fips_extension_v1` del archivo de biblioteca, cuyo
  hook de inicio carga el proveedor junto al ejecutable ([FIPS](crypto.md#fips)).
- Las claves públicas siguen `pkey.c`, `rsa.c`, `dss.c`, `eddsa.c`, `ec.c`,
  `ecdh.c`, `dh.c`, `evp.c` y `srp.c` de OTP: `crypto.erl` convierte enteros
  en binaries (`format_pkey`, `nif_curve_params`) y los builtins construyen
  claves OpenSSL con las mismas listas `OSSL_PARAM` que construyen los NIF de
  OTP (`params.cpp`, números grandes en orden de bytes nativo), con las
  comprobaciones, descripciones y números de argumento de OTP. `pkey.cpp`:
  `sign/4,5`, `verify/5,6` (RSA con PKCS #1, PSS, X9.31 y sin relleno, DSA,
  ECDSA, EdDSA, ML-DSA, SLH-DSA; `{digest, Digest}`), RSA
  `public_encrypt/4` y sus tres variantes (PKCS #1, OAEP con sus resúmenes y
  etiqueta, sin relleno), `privkey_to_pubkey/2`. `keys.cpp`: generación de
  claves RSA, DH, X25519/X448, Ed25519/Ed448, ML-DSA, SLH-DSA y ML-KEM,
  acuerdo DH y X25519/X448, `encapsulate_key/2`, `decapsulate_key/3`.
  `curves.cpp`: claves y acuerdo ECDH sobre curvas con nombre o explícitas,
  reintentados con parámetros explícitos cuando OpenSSL no conoce el nombre
  de OTP (como `retry_without_name` de OTP), y `ec_curve/1`, cuyos parámetros
  explícitos proceden de las curvas incorporadas de la libcrypto enlazada en
  lugar de la tabla `crypto_ec_curves` de OTP (términos idénticos byte a byte).
  `srp.cpp`: fórmulas de números grandes de SRP; `crypto.erl` conserva el
  multiplicador y mezclador de OTP. Se mantienen las peculiaridades de OTP:
  `sign(dss, none, ...)` falla con `"Bad digest type"`,
  `generate_key(dh, ...)` ignora una clave privada dada, y un exponente público
  RSA de varios bytes llega a OpenSSL en orden de bytes nativo.

## Módulo re

`builtins/re/`, `re.erl` sobre la versión incluida de PCRE2
([PCRE2](compile.md#pcre2)).

- Patrón compilado: `{re_pattern, ...}` de OTP 29 con una referencia de handle.
- `clause_re:compile/2`, `clause_re:run/4` (una coincidencia, todas las opciones
  de captura, errores de OTP).
- `re.erl`: conversión de chardata, bucle `global`, `replace`, `split`.
- No se proporcionan `export`/`import/1`. CTest `executables_re_module`.

## Prim eval

`process/receive.cpp`, `library/erts/prim_eval.erl`.

- `prim_eval:'receive'/2` recorre el buzón con los builtins de `clause_receive`
  (`peek`, `skip`, `take`, `restart`, `wait`); gana la primera respuesta
  distinta de `nomatch`.
- CTest `executables_prim_eval_receive`.
