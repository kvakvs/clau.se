---
source: docs/builtins.md
sourceCommit: 336caea7
sourceSha256: c5d99568a38fc1f7bc865c63163039a8c2acba8d978636c0b9290afdf0b9a637
translatedAt: 2026-10-18
---
# Builtins

Los builtins son funciones que el runtime implementa en C++: los BIF de
`erlang` y las funciones de otros módulos cuyos equivalentes en OTP son BIF,
NIF o necesitan el runtime (salida de `io`, funciones de datos de `lists`,
`math`, `binary`, ...). El runtime los registra por módulo, función y aridad;
el código generado los alcanza directamente, mediante llamadas dinámicas y
como valores fun.

## Qué builtins existen

El catálogo del puente `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) enumera todos los
builtins que conocen tanto el compilador como el runtime, en grupos cuyos
comentarios nombran el archivo fuente que los implementa:

- módulo `erlang`: los BIF de guard, los operadores como funciones
  (`erlang:'+'/2`, `'++'/2`, `'--'/2`, ...), `display/1`, `halt/0,1`, las
  funciones que lanzan excepciones, el acceso a términos, las conversiones,
  las identidades de procesos, los [procesos](processes.md) (creación,
  mensajes, enlaces, monitores, nombres registrados, el diccionario del
  proceso, temporizadores, introspección, opciones de spawn, alias, nodos),
  los [puertos](ports.md#builtins-and-port-messages), el
  [formato externo de términos](#external-term-format), el [tiempo](#time),
  la [información del sistema](#system-information), la
  [información de funs](funs.md#fun-information), el [hashing](#hashing) y la
  [carga de código](#code-loading);
- otros módulos: salida de `io` ([io](io.md)), las funciones de datos de
  [`lists`](#lists-module), [`math`](#math-module),
  [`binary`](#binary-module), [`maps` y `os`](#maps-module),
  [`ordsets`, `orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`,
  `queue` y `array`](#collections), [`base64` y `json`](#encodings),
  [`calendar`](#calendar), [`filename`](#filename), [`uri_string`](#uri-string), [`string`](#string),
  [`rand` y `random`](#random-numbers),
  [`persistent_term`](#persistent-terms), [`unicode`](#unicode-module),
  [`code`](#code-module), [`init`](#init-module),
  [`atomics`](#atomics-and-counters), [`erts_internal`](#erts-internal),
  [`unicode_util`](#unicode-util) y [`re`](#re-module);
- módulos privados bajo el código de biblioteca Erlang: `clause_unicode`,
  `clause_re`, `clause_zlib` ([zlib](#zlib-module)) y `clause_receive`
  ([prim eval](#prim-eval)).

Qué función de un módulo de biblioteca es un builtin, un cuerpo Erlang o un
stub queda registrado en su inventario `library/<application>/<module>.terms`
([biblioteca](library.md#files)); el de `erlang` es
[erlang.terms](#erlang-module).

El índice de una entrada es el número que el código generado pasa al servicio
del puente; el compilador y el runtime se compilan juntos, así que el catálogo
puede reordenarse. Una llamada cualificada a un builtin del catálogo de
cualquier módulo (`io:format(F, A)`) llama al puente. Todas las demás funciones
de `erlang` llegan al [módulo de biblioteca erlang](#erlang-module).

## Cómo los alcanzan las llamadas

| Código fuente | Vía |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Código en línea o un servicio dedicado del runtime |
| `erlang:function_exported(M, F, A)`, `A -- B` en un cuerpo (builtins del catálogo sin servicio en línea) | Se entra en ellos como en una función: `CLAUSE_builtin_frame_v1(context, index)` da el marco del builtin y los argumentos van en los registros ([porciones](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (builtins directos: nunca hacen trap, esperan ni actúan sobre otro proceso) | Se llaman de inmediato: `CLAUSE_builtin_call_v1(context, index, arguments)` devuelve el resultado ([ABI](abi.md#runtime-services)) |
| `length(L)`, `binary_to_list(B)`, `list_to_binary(L)`, `iolist_to_binary(L)` (builtins rápidos) | `CLAUSE_builtin_call_v1` ejecuta una vía rápida acotada sobre las palabras de argumento (como máximo 256 celdas, elementos o bytes, 4096 bytes de resultado); devuelve 0 para entradas más largas, otras formas y errores, y la llamada entra entonces en el marco del builtin |
| `A ++ B` | Un `A` propio y corto se copia en línea; en otro caso se entra como en una función ([ABI](abi.md#frames-and-transfers)) |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externo `erlang:F/A`; el registro lo vincula al builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` en tiempo de ejecución | El servidor de código busca primero una exportación del módulo y después un builtin |

- `fun F/A` de un builtin autoimportado que el módulo ni define ni suprime
  (`-compile({no_auto_import, ...})`) es el fun externo `erlang:F/A`, como en
  OTP: `fun abs/1 =:= fun erlang:abs/1` y se imprime como `fun erlang:abs/1`.
  Las autoimportaciones son las de OTP (flag `auto_import` en
  [erlang.terms](#erlang-module)); otras, como `display/1`, `raise/3`,
  `function_exported/3`, `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3`
  y `ports/0`, necesitan el prefijo `erlang:`.
- Un builtin tiene un `FrameDescriptor` con cuerpo nulo (`BuiltinFrame`).
  Entrar en él (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) no apila ningún marco: el
  builtin se ejecuta sobre los registros y su resultado vuelve al cuerpo del
  llamador, así que un builtin en posición de cola vuelve al llamador del
  llamador.
- Los errores son los que el lowering en línea lanza en un cuerpo: `badarg`,
  `badarith` para la aritmética, `system_limit`, `{badmap, M}`, `{badkey, K}`;
  `raise/3` con una clase o una pila no válidas devuelve `badarg`. Pasan por el
  canal de fallos comprobado como cualquier error de servicio.
- El acceso a términos sigue las reglas de `badarg` de OTP: `setelement/3`
  necesita un índice entero pequeño dentro de la tupla; `make_tuple/2,3` un
  tamaño pequeño en 0..16.777.215, y `make_tuple/3` una lista propia de pares
  `{Index, Value}` dentro del tamaño (ganan los pares posteriores);
  `list_to_tuple/1` una lista propia; `A ++ B` una lista propia `A`
  (`[] ++ B` es `B` para cualquier `B`, un `B` que no es lista cierra el
  resultado); `A -- B` dos listas propias, donde cada elemento de `B` elimina
  el primer elemento exactamente igual (`=:=`) de `A`, en O((n + m) log m).
- Las conversiones siguen a OTP:
  - `list_to_atom/1` toma una lista propia de puntos de código (sin
    sustitutos); un carácter número 256 es `system_limit` antes de
    comprobarse. Una tabla de átomos llena (`--max-atoms`) detiene el programa
    como fallo del runtime (`resource_limit`, salida 70).
  - `integer_to_list/2` y `list_to_integer/2` toman una base pequeña en
    2..36; los dígitos se imprimen en mayúsculas y se analizan en cualquiera
    de los dos casos. `list_to_integer` acepta un signo opcional, omite los
    ceros iniciales, necesita un dígito y lanza `system_limit` para más de
    1.262.611 dígitos decimales significativos (o 4.194.304 en cualquier base)
    una vez que sus primeros dígitos son válidos, y para un valor que supera
    el límite de los enteros.
  - `float_to_list/1` es `"%.20e"`; las opciones de `/2` se aplican en orden y
    gana el último formato: `{scientific, D}` (`"%.*e"`, un D negativo es 6),
    `{decimals, D}` (D >= 0; fijo con el redondeo propio de OTP por debajo de
    2^53 y 19 decimales; `compact` recorta los ceros finales, también de un
    entero con `{decimals, 0}` por encima de 2^53), `short` (los dígitos más
    cortos que permiten ida y vuelta, con la elección fija/científica de OTP).
    Un texto de 256 bytes o más es `badarg`.
  - `binary_to_list/1` necesita un binary; `list_to_binary/1` una lista e
    `iolist_to_binary/1` una lista o un binary de bytes, binaries y listas
    anidadas, cada lista terminada en `[]` o en un binary.
  - Las variantes binarias (`atom_to_binary/1,2`, `binary_to_integer/1,2`,
    `float_to_binary/1,2`, `list_to_float/1`, ...) comparten estas reglas de
    texto (`erlang/conversion_text.cpp`): el texto de un flotante necesita
    dígitos a ambos lados del punto (`list_to_float("1e10")` es `badarg`), un
    exponente fuera de rango es `badarg` y un desbordamiento por abajo `0.0`;
    las codificaciones son `utf8`, `unicode` y `latin1`.
- `function_exported(M, F, A)` lanza `badarg` salvo que `M` y `F` sean átomos
  y `A` un entero pequeño; es verdadero cuando un módulo del programa exporta
  `M:F/A` o `M:F/A` es un builtin registrado.

## Porciones

Los builtins cuyo trabajo crece con un argumento lista o binary se ejecutan en
porciones acotadas, como los BIF de OTP que hacen trap, de modo que un builtin
largo no puede impedir que se ejecuten otros procesos
([procesos](processes.md)).

- Se entra en cada builtin del puente que llama un cuerpo como en una función,
  y gasta una reducción. Una porción puede hacer `WORK_PER_REDUCTION` (16)
  unidades de trabajo por reducción que quede en la porción de tiempo (al
  menos el equivalente a una reducción): celdas de lista recorridas o
  construidas, comparaciones, bytes. Las paga de la porción de tiempo.
- Un builtin al que le queda trabajo hace trap: `ProcessStack::trap` nombra un
  marco de continuación y pone los términos de estado del builtin en los
  registros, que siguen siendo raíces; el estado nativo (bytes, posiciones de
  ordenación, palabras de términos mantenidas como raíces) vive en el
  `TrapState` de la pila del proceso. El proceso cede y se reanuda en la
  continuación en una porción posterior. Las recolecciones entre porciones
  reescriben los registros y las palabras de estado como las demás raíces.
- Un builtin también puede continuar en una exportación Erlang: la salida de
  `io` a un dispositivo que es un proceso hace trap hacia `file:write/2`
  ([io](io.md#calls)).
- Los resultados, los errores y el orden de evaluación son los mismos que al
  ejecutar hasta el final. Un error encontrado tarde (una cola impropia) se
  lanza cuando el recorrido llega a él.
- Las llamadas del anfitrión (`call_builtin`) continúan cada trap de
  inmediato.
- Los recorridos de listas validan la lista una vez y leen sus celdas como
  palabras. Las entradas pequeñas toman caminos rápidos a nivel de palabra sin
  estado de porción: `Left ++ Right` con como mucho 64 celdas en `Left`,
  `integer_to_list/1` de un entero pequeño, `list_to_integer/1` de una cadena
  decimal corta, `atom_to_list/1`, `list_to_tuple/1` y `tuple_to_list/1`.

| Builtin | Porciones |
| --- | --- |
| `length/1` en un cuerpo | Cuenta celdas; en un guard sigue siendo el servicio en línea, ya que el BIF de guard de OTP no hace trap |
| `A ++ B` | Recoge los elementos de `A` y después construye la copia sobre `B` desde su final |
| `A -- B` | Recoge `B`, lo ordena por orden exacto (ordenación por mezcla ascendente), recorre `A` con una búsqueda binaria por elemento y después construye los elementos conservados; cuando no se elimina nada, el resultado es el propio `A` |
| `binary_to_list/1` | Construye la lista desde el final del binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Recorre la iolist en profundidad y después crea el binary de una vez |

Los demás builtins se ejecutan hasta el final. Los builtins de tuplas
(`setelement/3`, `make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) hacen
como en OTP: su trabajo está acotado por el límite de aridad de las tuplas.
Las conversiones restantes leen entradas acotadas por los límites de átomos,
enteros y flotantes. El formateo con `io:format/1,2` se ejecuta hasta el final
([diferencias](differences.md)). Los servicios en línea de los bucles (la
inversión final de una comprehension) se ejecutan hasta el final como parte
del bucle.

## Builtins tipados

Los builtins que comprueban sus propios argumentos son funciones C++ con
parámetros tipados ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registradas con
`typed_entry<Function>(module, name)` (la aridad es el número de parámetros).

- El adaptador admite cada palabra de argumento en orden (una palabra que este
  proceso no posee es el fallo que es, nunca `badarg`) y después convierte cada
  una a su tipo de parámetro (`Term`, un entero pequeño o cualquiera,
  `double`, argumentos lista, tupla, binary, átomo, map o pid local; véase
  `typed.hpp`); una discordancia lanza `badarg` y la función no se ejecuta.
  `Named<Role>` es cualquier término bajo un tipo de rol propio
  (`collections::Key`, `Value`, `List`, ...), de modo que no puedan
  intercambiarse dos parámetros de término de un builtin; el builtin comprueba
  el término.
- Una función devuelve un término, un `BuiltinResult` (`std::expected` con un
  `BuiltinFailure`) o una `Word` cruda que ha publicado ella misma, o lanza
  `BuiltinFailure` (un error de Erlang o un fallo de acceso a términos);
  `call_builtin` convierte cualquier otra excepción de C++ en `out_of_memory`
  o `internal_error`, de modo que ninguna cruza la ABI del código generado.
- La mayoría de las familias son tipadas. Los BIF de guard y los operadores
  (`erlang/core.cpp`), los builtins de listas que hacen trap y algunos otros
  son adaptadores `BuiltinBody` a nivel de palabra, que pasan sus palabras de
  argumento a los servicios en línea a los que también llama el código
  generado. Las conversiones frecuentes leen las celdas de sus argumentos en
  su sitio (`TermAccess::trusted`) en lugar de admitir `Term`s:
  `tuple_to_list/1`, `phash2/1` (listas, tuplas y enteros pequeños),
  `list_to_atom/1` y `list_to_integer/1` de cadenas ASCII cortas, y
  `binary:part/2,3`, un builtin directo cuyo resultado corto se escribe
  directamente en palabras del heap (argumentos de builtin a nivel de palabra).

## Registro

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  propiedad del `CodeServer`, asocia módulo/función/aridad exactos a un
  `BuiltinFrame`. `add` toma un lote de `BuiltinEntry` y registra todos o
  ninguno: un nombre vacío, más de 255 argumentos, una implementación ausente
  o un nombre ya registrado (o repetido en el lote) rechazan el lote sin
  conservar nada.
- El arranque del runtime registra todas las tablas de familias de
  `production_builtins()` (`builtins/registry.cpp`), que juntas cubren el
  catálogo.
- Los builtins son persistentes (sticky): cuando se registra un módulo, el
  servidor de código omite toda exportación que tenga el nombre de un builtin
  registrado, de modo que `M:F(Args)`, `apply/3` y los funs externos se
  vinculan al builtin, nunca al cuerpo `clause_builtin_placeholder` de un
  módulo de biblioteca ([marcadores](library.md#provided-or-missing)) ni a una
  función de usuario con el mismo nombre.
- Un cuerpo lee exactamente tantas palabras de argumento como su aridad y
  registra los errores en el canal comprobado; las excepciones del anfitrión
  se convierten en fallos `out_of_memory` o `internal_error`.
- La vía del anfitrión `abi::v1::dispatch_builtin` (módulos nativos
  registrados por el anfitrión por nombre,
  [runtime](runtime.md#code-server-and-builtins)) es independiente.

## Organización del código fuente

- El runtime implementa los builtins en `runtime/src/builtins/`. Un módulo
  grande tiene su propio subdirectorio con una unidad de traducción por
  familia de builtins (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`,
  `zlib/`); los módulos pequeños y la infraestructura del puente (`registry`,
  `bridge`, `portions`, `typed`, formateo de texto y de flotantes) son
  archivos únicos.
- Cada archivo de familia define su propia tabla `*_builtins()`, enumerada en
  `production_builtins()`. Una familia nueva añade un archivo y una tabla
  nuevos en lugar de ampliar uno existente; un archivo de más de unas 400
  líneas se divide por familias antes de seguir creciendo.
- El compilador nunca lee los fuentes del runtime: el catálogo
  `abi::v1::bridge_builtins` es la única lista que comparten ambos lados; sus
  comentarios de grupo nombran el archivo que los implementa.

## Módulo erlang

El compilador sabe qué funciones de `erlang` existen a partir de dos fuentes
propias, nunca del código del runtime:

- `library/erts/erlang.terms`: las exportaciones de `erlang` de OTP 29 como
  `{Name, Arity, Flags, Status}` (flags `auto_import`, `guard`; estado
  `implemented` o `{unavailable, Reason}`: `distribution`, `tracing`,
  `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` observa el OTP del
  anfitrión y conserva los estados, que se mantienen a mano.
- `tests/compiler/builtins/generate_erlang.py` lo convierte en
  `library/erts/erlang.erl` (el módulo de stubs propio de Clause, con un cuerpo
  de marcador de posición por builtin del catálogo) y en
  `compiler/src/semantic/erlang_auto_imports.inc` (la lista de
  autoimportaciones de OTP). La prueba de CTest `builtins_erlang_inventory`
  comprueba que ambos están al día y que `implemented` significa un builtin
  del catálogo, una función que maneja el compilador (`apply/2,3`,
  `is_record/1,2,3`) o un cuerpo Erlang real (`nif_error/1,2` lanzan
  `error(Reason)` como los stubs de OTP); `builtins_erlang_freshness`
  (etiqueta `host_otp`) compara el inventario con el OTP del anfitrión.

Llamadas:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` e
  `-import(erlang, ...)` de un builtin van al builtin. Cualquier otra
  exportación se une al programa como el módulo de biblioteca `erlang`; sus
  stubs lanzan `error({not_implemented, F, A})` con `erlang:F/A` en la cima de
  la pila, solo cuando se llaman. Un nombre que el módulo no exporta es
  `undefined function erlang:F/A`.
- Una llamada no cualificada o un `fun F/A` de una autoimportación de OTP
  (`get(K)`, `fun put/2`) que el módulo ni define, ni importa, ni suprime con
  `-compile({no_auto_import, ...})` llega a `erlang:F/A` de la misma manera.

## Formato externo de términos

`erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Ambas direcciones
comparten el códec de
[external_term.hpp](../abi/include/clause/abi/external_term.hpp) con el
compilador y recorren los términos con pilas explícitas, de modo que la
profundidad de anidamiento no consume pila nativa. El codificador lee las
celdas de su argumento validado en su sitio (`TermAccess::trusted`, sin
búsqueda de dirección por celda); el decodificador recoge los hijos en una
única pila compartida y escribe tuplas, listas y cadenas directamente en
palabras del heap que reclama una vez por contenedor (`TermAccess::claim`).

- `term_to_binary/1,2` escribe los bytes de OTP para un nodo no distribuido
  (`nonode@nohost`, creación 0): átomos UTF-8, `NEW_FLOAT`, `STRING_EXT` para
  listas de bytes de hasta 65535 elementos, maps en orden de claves, pids,
  puertos y referencias en sus formas `NEW_PID`, `V4_PORT` y
  `NEWER_REFERENCE`, y `EXPORT_EXT` para `fun M:F/A`; un fun local o un record
  nativo es `error:notsup`. Opciones: `{minor_version, 0..2}` (0 escribe los
  flotantes como texto, 0 y 1 átomos Latin-1), `deterministic`, `compressed`
  y `{compressed, 0..9}` ([zlib](#zlib-module)); cualquier otra cosa es
  `badarg`.
- `term_to_iovec/1,2` devuelve la codificación como una lista de un binary;
  `external_size/1,2`, su tamaño exacto.
- `binary_to_term/1,2` comprueba cada longitud frente a la entrada antes de
  reservar memoria, ignora los bytes posteriores al término, descomprime la
  entrada comprimida y devuelve `badarg` para entradas mal formadas, texto de
  átomo no válido, flotantes no finitos, claves de map repetidas e
  identidades de otro nodo; `safe` admite solo átomos existentes, `used`
  devuelve `{Term, BytesRead}`. Pruebas de CTest:
  `executables_external_terms` (bytes de OTP) y `builtins_etf_fuzz` (las
  codificaciones mutadas se decodifican o lanzan una excepción).

## Tiempo

`erlang/time.cpp`. El tiempo monótono es el reloj estable; `native` y
`perf_counter` son nanosegundos; las unidades son los átomos de OTP (incluidos
los plurales obsoletos) o un entero positivo de partes por segundo.
`convert_time_unit/3` redondea hacia abajo, como OTP. `unique_integer/0,1`
toma valores de un único contador de todo el programa, de modo que cada valor
es positivo, único y creciente sean cuales sean las opciones (`positive`,
`monotonic`; otras, `badarg`). `now/0` es el tiempo del sistema hecho
estrictamente creciente. Las conversiones de calendario leen
`{{Y, M, D}, {H, Mi, S}}` de forma estricta (una fecha u hora no válidas son
`badarg`) y usan la zona horaria local de la biblioteca de C. Temporizadores:
[procesos](processes.md#timers).

## Información del sistema

`erlang/system.cpp`.

- `statistics/1`: `wall_clock` y `runtime` (`{Total, SinceLastCall}` en
  milisegundos), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (porciones de tiempo ejecutadas).
  Clause no mantiene contadores de reducciones, de recolección de basura ni de
  E/S: `reductions`, `exact_reductions`, `garbage_collection` e `io` informan
  ceros.
- `system_info/1`: los elementos de versión y compilación (`otp_release`
  `"29"`, `version` `"17.1"`, el ERTS al que sigue Clause, `machine`
  `"Clause"`, `system_version`, `system_architecture`, `wordsize`, `endian`,
  ...), recuentos y límites de procesos, puertos y átomos, recuentos de
  planificadores y procesadores y las respuestas fijas del emulador
  (`smp_support`, `threads`, `time_warp_mode`, ...); la lista completa está en
  `system.cpp`.
- `memory/0,1`: los tipos de OTP; `processes` es la contabilidad de memoria de
  procesos de todo el runtime, `atom` una estimación a partir del número de
  átomos, y `binary`, `code` y `ets` son 0.
- Los demás elementos son `badarg`.

## Hashing

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` es `make_hash2` de OTP y `phash/2` su `make_hash`, recorriendo
  las celdas de listas y tuplas en su sitio: átomos (por el hash de OTP de su
  grafía), enteros, flotantes, binaries y bitstrings, listas, tuplas y maps
  (independientemente del orden) tienen los hashes de OTP, de modo que `dict`
  y `sets` de versión 1 distribuyen sus buckets como OTP. Los pids, puertos y
  referencias usan los números de Clause, los funs el módulo, aridad o índice
  y capturas, los native records los valores de campo
  ([diferencias](differences.md)). `phash2/1` está en 0..2^27-1, `phash2/2`
  en 0..Range-1, `phash/2` en 1..Range; Range está en 1..2^32, si no `badarg`.
- `md5/1` y `md5_init/0`, `md5_update/2`, `md5_final/1` dan los resúmenes de
  RFC 1321 (los bytes de OTP) de iodata. El contexto es un binary opaco de 96
  bytes con una disposición propia de Clause; cualquier otro binary es
  `badarg`.

## Carga de código

`erlang/code.cpp`. Cada módulo se enlaza en el programa y permanece cargado;
el código dinámico queda diferido.
`module_loaded/1` es verdadero para un módulo compilado o un módulo con
builtins del runtime (`erlang`, `io`, `os`, ...); `loaded/0` y `pre_loaded/0`
los enumeran todos. `delete_module/1` devuelve `undefined` para un módulo
desconocido y lanza `error:notsup` para uno cargado. `prepare_loading/2`
devuelve `{error, badfile}` (ningún binary es código que el programa pueda
cargar) y `finish_loading/1` solo acepta `[]`. `get_module_info(M[, Item])`
continúa como `M:module_info(...)`.

## Módulo lists

`runtime/src/builtins/lists/`. El `lists` de OTP es código Erlang (salvo unos
pocos BIF), así que los builtins de Clause lanzan lo que lanzan las cláusulas
de OTP:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `flatlength/1`, `delete/2`, `concat/1`, `max/1`,
  `min/1`, `usort/1`, `umerge/1,2`, `merge/1,2`, `merge3/3`, `umerge3/3`,
  `keymerge/3`, `ukeymerge/3`, `ukeysort/2`, `keydelete/3`, `keyreplace/4`,
  `keystore/4`, `keytake/3`, `zip/2,3`, `zip3/3,4`, `unzip/1`, `unzip3/1` y
  `enumerate/1,2,3` lanzan `function_clause` para un argumento que ninguna
  cláusula de OTP acepta, y recorren las listas de forma tan perezosa como
  OTP: `sublist([a | b], 1)` es `[a]`, `nthtail(1, [a | b])` es `b`,
  `flatten/2` no comprueba su cola más allá de `is_list`, una mezcla devuelve
  la otra lista tal cual cuando una es `[]` y lanza `badarg` para un resto
  impropio que añade, y una mezcla por claves lanza `badarg` para un elemento
  que no sea una tupla del tamaño de la clave, como `element/2`.
- `zipwith/3,4` y `zipwith3/4,5` son Erlang sobre los builtins `zip`, que
  primero emparejan los elementos; `flatmap/2`, `keymap/3`, `search/2`,
  `umerge/3` y `usort/2` también son Erlang. Dentro de `lists.erl` se llama a
  un builtin de forma cualificada (`lists:zip(...)`): una llamada local
  alcanzaría su marcador de posición. Las funciones no documentadas
  `rmerge/2,3`, `rmerge3/3`, `rumerge/2,3`, `rumerge3/3`, `rkeymerge/3` y
  `rukeymerge/3` (auxiliares de ordenación de OTP) siguen siendo stubs.
- `keymember/3` y `keysearch/3` son BIF en OTP: `badarg` para una posición que
  no es un entero pequeño positivo o para una cola impropia alcanzada antes de
  una coincidencia.
- Las claves y el orden se comparan con `==` y el orden de términos; de los
  elementos que se comparan como iguales gana el primero (`max([1, 1.0])` es
  `1`, `usort([1.0, 1])` es `[1.0]`, `umerge/1,2` conservan el elemento de la
  lista anterior).
- Se ejecutan hasta el final. Las funciones que toman funs (`foreach/2`,
  `mapfoldl/3`, `splitwith/2`, `filtermap/2`, `uniq/2`, ...) son Erlang en
  `library/stdlib/lists.erl`, porque un builtin no puede llamar a un fun y
  recuperar su resultado; también lo son las demás funciones implementadas,
  con las cláusulas y los guards de OTP.
- Un `function_clause` procedente de un builtin no tiene marco propio
  ([diferencias](differences.md)).

## Módulo math

`runtime/src/builtins/math.cpp`. Todas las funciones de `math` de OTP 29 son
builtins sobre la biblioteca de C (`pi/0` y `tau/0` son constantes). Los
argumentos son números convertidos a flotantes: cualquier otra cosa es
`badarg`, y un entero demasiado grande para un flotante, `badarith`. Un
resultado que no es un flotante finito (un error de dominio como `sqrt(-1)`,
`log(0)`, `acos(2)`, o un desbordamiento como `pow(10, 400)`, `exp(1000)`) es
`badarith`. `floor/1` y `ceil/1` devuelven flotantes. Los resultados son los
de la biblioteca de C del anfitrión, que pueden diferir de los de OTP en el
último bit ([diferencias](differences.md)). En destinos de 64 bits, el código
generado calcula en línea, en una celda de flotante, `sqrt`, `floor`, `ceil`
(intrínsecos de LLVM) y `exp`, `log`, `log2`, `log10`, `sin`, `cos`, `pow`
(las mismas funciones de la biblioteca de C, llamadas sin las sustituciones de
LLVM) de argumentos numéricos; los demás operandos y los resultados no finitos
llaman al builtin, que lanza la excepción.

## Módulo binary

`runtime/src/builtins/binary/`. `replace/3,4` (incluido un fun de reemplazo y
`{insert_replaced, ...}`) y `list_to_bin/1` son Erlang en
`library/stdlib/binary.erl` sobre los builtins; todas las demás funciones son
builtins:

- Los patrones son un binary no vacío, una lista no vacía de binaries no
  vacíos o un patrón compilado. Una coincidencia es la posición más a la
  izquierda y, en ella, el patrón más largo; `matches/2,3` y `split/2,3` con
  `global` toman coincidencias no solapadas desde la izquierda.
  `{scope, {Start, Length}}` limita dónde pueden empezar y terminar las
  coincidencias (una longitud negativa cuenta hacia atrás); `split/3` también
  acepta `global`, `trim` y `trim_all`.
- `compile_pattern/1` devuelve `{bm, [Pattern]}` o `{ac, Patterns}`, una forma
  propia de Clause (OTP: una referencia dentro de la tupla,
  [diferencias](differences.md)).
- `part/2,3`, `bin_to_list/1,2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` y
  `decode_hex/1` siguen a OTP; todo argumento erróneo (un bitstring, un rango
  fuera del sujeto, una opción desconocida) es `badarg`.
- `referenced_byte_size/1` es el tamaño propio del binary.
- Se ejecutan hasta el final.

## Módulo maps

`runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- Todas las funciones documentadas de `maps` funcionan. `maps:get/3`,
  `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`,
  `with/2`, `without/2`, `from_keys/2`, `intersect/2` e `is_iterator_valid/1`
  son builtins con los errores de OTP: algo que no es un map es
  `{badmap, Map}`, una clave ausente en `update/3` es `{badkey, Key}`, una
  lista de claves que no es una lista propia es `badarg`. Las claves coinciden
  exactamente (`1` y `1.0` son claves distintas).
- Las funciones que toman funs son Erlang en `library/stdlib/maps.erl`:
  `filter/2`, `filtermap/2`, `map/2`, `fold/3` y `foreach/2` toman un map o un
  iterador (cualquier otra cosa es `{badmap, MapOrIter}`), `intersect_with/3`
  combina sobre `intersect/2` y `merge_with/3` sobre `merge/2`.
  `groups_from_list/2,3` llaman a los funs empezando por el último elemento,
  como OTP, y el builtin privado `clause_maps:groups/1` agrupa los pares
  `{Key, Value}`. Los iteradores (`iterator/1,2`, `next/1`) usan
  [`erts_internal:map_next/3`](#erts-internal).
- Los cursores de map (`runtime/src/terms/map_cursor.hpp`) recorren por igual
  una celda de map plano y un árbol de map, como palabras en orden de claves,
  sin un `Term` por entrada. El builtin privado `clause_maps:entries/1`
  devuelve `{K1, V1, K2, V2, ...}` a partir de uno, de modo que `maps:fold/3`
  lee las asociaciones en su sitio con `element/2` en lugar de construir una
  lista de pares; `map_next/3` también avanza con uno.
- `os:type/0`, `os:getenv/0,1` (`getenv/0`: cadenas `"Name=Value"`; las
  entradas `=C:` por unidad de Windows se omiten), `os:env/0` (pares
  `{Name, Value}`), `os:putenv/2`, `os:unsetenv/1` (`badarg` salvo que los
  argumentos sean cadenas y el nombre no esté vacío y no contenga `=`),
  `os:getpid/0` y `os:version/0` son builtins; `os:timestamp/0`,
  `os:system_time/0,1`, `os:perf_counter/0,1` y `os:getenv/2` son Erlang sobre
  los builtins de tiempo de `erlang` y `getenv/1`; `os:cmd/1` se ejecuta sobre
  un puerto ([subprocesos](ports.md#subprocesses)).

## Colecciones

`runtime/src/builtins/collections/`: `ordsets`,
`orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue` y
`array`, todas las funciones documentadas.

- Los recorridos de listas son builtins: pertenencia, inserción, eliminación
  y álgebra de conjuntos de `ordsets` (`union/2`, `intersection/1,2`,
  `subtract/2`, `is_subset/2`, `is_disjoint/2`, `is_set/1`); búsquedas y
  actualizaciones de `orddict` sin funs (`store/3`, `append/3`, `append_list/3`,
  `update_counter/3`, `take/2`, `from_list/1`, ...); todas las funciones de
  `proplists` salvo `property/1,2`, `get_value/2`, `normalize/2`, `to_map/2` y
  `from_map/1`, que son código de enlace Erlang en `library/stdlib/`.
- Las funciones que toman funs (`ordsets:fold/3`, `filter/2`, `map/2`,
  `filtermap/2`, `orddict:update/3,4`, `fold/3`, `map/2`, `filter/2`,
  `merge/3`) son Erlang.
- Cada builtin recorre sus listas como las cláusulas de OTP, por lo que los
  resultados y errores coinciden para cualquier entrada: los elementos y las
  claves se comparan con `<` y `==` (de `1` y `1.0` se conserva el
  representante que conserva OTP, incluso después de que `union/2`
  intercambie sus conjuntos), un resto que OTP devuelve sin comprobar
  (`ordsets:union([], X)` es `X`) se devuelve tal cual, una forma que ninguna
  cláusula acepta es `function_clause`, una entrada de comprehension que no
  sea lista es `{bad_generator, Rest}`, `Old ++ New` con un `Old` impropio
  es `badarg` y `update_counter/3` de algo que no sea un número es `badarith`.
  Las claves de `proplists` coinciden con `=:=`.
- `proplists:get_keys/1` enumera las claves en el orden de claves de un map,
  como el conjunto de claves de OTP ([diferencias](differences.md)).
- `dict` y `sets`: un dict y un conjunto de versión 1 son los records de OTP
  sobre una tabla hash lineal (`collections/linear_hash.cpp`), segmentos de
  listas de 16 buckets con ranuras de `erlang:phash/2`, ampliados y reducidos
  exactamente como en OTP, de modo que los records, `to_list/1` y los órdenes
  de fold son iguales a los de OTP. Un conjunto de versión 2 (la predeterminada)
  es un map con valores `[]`; dos maps se intersecan y restan con los valores
  de OTP (los valores propios de un map cuando se conservan suficientes claves,
  si no `[]`). Las búsquedas y actualizaciones de un dict, las operaciones de
  `sets` sin funs, `new/0` y `from_list/1` son builtins; `update`, `fold`,
  `map`, `filter`, `merge` y `sets:new/1`, `from_list/2`, `fold`, `filter`,
  `map`, `filtermap` son Erlang, las que usan hash sobre los builtins privados
  `clause_hashed:entries/1` (orden de almacenamiento), `with_values/2` y
  `keep/2`. Un término que no sea un dict lanza `{badrecord, Term}` (`size/1`,
  `is_empty/1` lanzan `function_clause`), uno que no sea un conjunto lanza
  `function_clause`.
- `gb_trees` y `gb_sets` comparten un motor de árboles equilibrados
  (`collections/balanced_tree.cpp`): la inserción comprueba la regla de peso
  de Andersson al volver a subir y reconstruye un subárbol a partir de sus
  entradas ordenadas como OTP, la eliminación eleva el nodo más pequeño del
  lado mayor, y la unión, intersección y diferencia de `gb_sets` mezclan las
  listas ordenadas o insertan y buscan según la regla de tamaños de OTP
  (`N2 < 10` o `N2 < N1 * round(1.46 ln N2)`), construyendo árboles mezclados
  con más peso a la derecha como `balance_revlist` de OTP, de modo que cada
  árbol es igual al de OTP. `map`, `fold`, `filter`, `filtermap` y las
  constantes son Erlang.
- `queue`: el `{Rear, Front}` de OTP; cada operación mueve elementos entre las
  listas como OTP (se mueve un lado de un elemento, una lista que queda sola
  se divide por la mitad), de modo que las colas son iguales a las de OTP. Un
  término que no sea un par de listas es `badarg`, y `get`, `drop`, `head` de
  una cola vacía dan el error `empty`. Las funciones que toman funs y los
  nombres de Okasaki son Erlang.
- `array`: el record `#array{}` de OTP 29, un árbol de tuplas de hojas de
  16 entradas (`[]` para un subárbol vacío) con una hoja en caché y un
  desplazamiento cero; `set`, `append`, `shift`, `prepend`, `slice`, `reset`,
  `resize` y los constructores (`from_list`, `from_orddict` con sus marcadores
  de huecos, `from`) cambian el record exactamente como OTP. Los folds y
  mapfolds son Erlang sobre los builtins privados `clause_array:values/3`,
  `sparse/3` y `replace/4`; el último reconstruye un rango transformado como
  los mapfolds de OTP (desplegando subárboles vacíos salvo que el map sea
  disperso) y vuelve a leer la caché.

## Codificaciones

`runtime/src/builtins/encoding/`.

- `base64`: todas las funciones documentadas son builtins. La codificación
  toma un binary o una lista de enteros (con la aritmética de OTP sobre ellos:
  `badarith` para algo que no sea entero, `badarg` fuera de la tabla del
  alfabeto); la decodificación recorre la entrada como las máquinas de estados
  de OTP, por lo que los errores coinciden para cualquier entrada: se omiten
  los espacios en blanco, una entrada que termina tras un carácter de un
  grupo es `function_clause`, tras dos o tres es `missing_padding` salvo con
  `padding => false`, un carácter fuera del alfabeto es `badarg` cuando se
  construye su grupo (`badarith` dentro de los desplazamientos de OTP),
  cualquier cosa que no sea espacio en blanco tras el relleno es
  `{case_clause, Symbol}`. `mime_decode` omite cualquier carácter fuera del
  alfabeto y los datos tras un `=` mal colocado.
- `json` (`encoding/json.cpp`): `decode/1` es un builtin que recorre los estados
  del decodificador de OTP sobre una pila explícita de contenedores abiertos,
  por lo que coinciden los valores (un objeto conserva el primer valor de una
  clave), el resto tras el valor y los errores: `unexpected_end` donde más
  entrada podría completar el texto, `{invalid_byte, Byte}` en el byte que
  OTP rechaza (para un literal cortado, el byte tras el primero),
  `{unexpected_sequence, Bytes}` para un escape `\u` incorrecto o un flotante
  que `binary_to_float/1` rechaza. `encode_binary/1` y
  `encode_binary_escape_all/1` son builtins que construyen los iodata anidados
  de OTP, y también lo son las vías predeterminadas `encode/1` y `format/1,2`
  (`encoding/json_encode.cpp`, mediante `clause_json:encode/1` y `format/2`);
  más allá de 256 niveles de anidamiento, o para opciones de formato distintas
  de enteros pequeños no negativos, responden `fallback` y `json.erl`
  construye los mismos iodata. Los codificadores y formateadores que toman
  funs y los decodificadores con callbacks `decode/3`, `decode_start/3`,
  `decode_continue/2` son Erlang; los decodificadores recorren los estados de
  OTP sobre los analizadores privados `clause_json:string/2` y `number/2`, por
  lo que los callbacks se ejecutan en el orden de OTP y los estados de
  continuación son las tuplas de OTP.

## Nombres de archivo

`runtime/src/builtins/filename/`.

- `flatten/1`, `join/1,2`, `absname_join/2`, `append/2`, `basename/1,2`,
  `dirname/1`, `extension/1`, `rootname/1,2`, `split/1`, `pathtype/1`,
  `nativename/1` y `validate/1` son builtins que siguen las cláusulas de OTP
  para la familia del anfitrión: Unix `/`, o Windows `/` y `\`, letras de
  unidad (una mayúscula pasa a minúscula con `join` y `split`) y nombres de
  red `//`. Las listas se recorren a medida que las cláusulas de OTP las abren
  (listas anidadas y átomos donde una cláusula los abre, `List ++ Rest`
  lanzando `badarg` para una impropia), por lo que los resultados conservan
  las formas de OTP: los elementos del nombre, los binaries conservados como
  elementos por `flatten/1`, sublistas y sub-binaries, y el `function_clause`
  de OTP donde una cláusula encuentra algo que no sea un carácter.
- `absname/1,2` (el directorio actual y el propio de una unidad) y
  `basedir/2,3` (el entorno) son Erlang sobre ellos.

## Cadenas

`runtime/src/builtins/string/`: todas las funciones de `string`.

- Los recorridos siguen `string.erl` cláusula por cláusula sobre
  `unicode_util:cp/1` y `gc/1`, que `unicode/code_points.cpp` adapta a términos
  con las formas de OTP: listas anidadas abiertas hasta donde las abre OTP
  (hasta tres puntos de código más aplanados tras el primero), binaries
  conservados como porciones que comparten su búfer, `{error, Rest}` ante
  UTF-8 no válido. Así, `trim`, `take`, `lexemes`, `split`, `find`, `slice` y
  `prefix` devuelven colas de la entrada, sub-binaries y las listas mixtas que
  construye OTP (`[Keep | Cont]`, `[Token, Bin]`, el anidamiento de `stack/2`),
  y lanzan los errores de OTP (`{badarg, Rest}`, `function_clause`,
  `case_clause` y `badmatch` donde sus cláusulas encuentran una respuesta
  inesperada, `badarg` de `binary:compile_pattern([])` cuando `nth_lexeme/3`
  compila un conjunto vacío de separadores).
- Los recorridos finales (`trim/3`, `take/4` con `trailing`), recursivos en el
  cuerpo en OTP, se ejecutan como bucles que registran un marco por paso y
  pliegan los marcos al final, de modo que las cadenas largas no puedan
  desbordar la pila de C++.
- `uppercase/1`, `lowercase/1`, `casefold/1` devuelven la propia entrada cuando
  no cambia ningún carácter, como OTP; `titlecase/1` transforma el primer
  punto de código. `equal/4` normaliza mediante `unicode/normalize.cpp`, la
  adaptación de `nfc/nfd/nfkc/nfkd` de `unicode_util` (tablas de
  descomposición, orden canónico, composición por pares, jamo de Hangul), y
  vuelve a comprobar los restos idénticos en cada paso como la cláusula
  `equal_nocase(A, A)` de OTP.
- `to_integer/1` y `to_float/1` toman los caracteres del número con `take/2` y
  los analizan como `string:list_to_integer/1` (`{Int, Rest}` de erts con
  `no_integer`, `not_a_list`, `system_limit`) y `list_to_float/1` (sintaxis de
  flotantes de Erlang, una coma permitida como punto, un exponente solo con
  dígitos); cualquier error interno es `{error, badarg}`.
- La API Latin-1 (`len`, `chr`, `tokens`, `strip`, `left`, `centre`, ...) se
  adapta con sus errores: `function_clause` donde una cláusula recorre hasta
  `[]`, `badarg` de `erlang:length/1`, `++` y `lists:reverse/2`.
- `jaro_similarity/2` empareja clústeres de grafemas dentro de la distancia de
  OTP y cuenta transposiciones en el orden de OTP.

## Cadena URI

`runtime/src/builtins/uri/`.

- `parse/1` es un único recorrido de la gramática de RFC 3986 dirigido por una
  tabla de delimitadores, conservando el orden de OTP para que sus respuestas
  incluyan dónde se detuvo el analizador de OTP: primero una URI con esquema
  (un fallo tras los dos puntos del esquema es definitivo), si no una
  referencia relativa; `userinfo@host` cuando el recorrido de userinfo tiene
  éxito, si no la autoridad como anfitrión; un anfitrión de dígitos que no sea
  una dirección IPv4 estricta recorrido de nuevo como nombre registrado;
  `{error, invalid_uri, Fragment}` con el fragmento de OTP. Los anfitriones
  se comprueban con las formas estrictas IPv4 e IPv6 de `inet`.
- `recompose/1`, `normalize/1,2` y `resolve/2,3` trabajan sobre los componentes
  del map como `uri_string.erl`: la forma de lista o binary de cada componente
  decide la del resultado, las respuestas `{error, ...}` de OTP se devuelven,
  lanzan como error o lanzan donde lo hace OTP, y `resolve` combina una ruta
  relativa tras la última barra de la ruta base (un recorrido por grafemas,
  como `string:split/3` de OTP).
- `percent_decode/1`, `quote/1,2`, `unquote/1`, `transcode/2`,
  `compose_query/1,2`, `dissect_query/1` y las clases de caracteres siguen los
  recorridos de bytes de OTP, incluidos los errores de un binary lanzados y
  los de una lista devueltos, las referencias numéricas HTML y `+` en consultas
  de formularios.
- `unicode/graphemes.cpp` divide los puntos de código en clústeres de grafemas
  según las reglas de `unicode_util:gc/1` para los builtins que necesitan
  límites de clústeres.

## Números aleatorios

`runtime/src/builtins/rand/`.

- `rand`: los estados son el `{AlgHandler, AlgState}` de OTP con los maps de
  manejador de OTP (sus funs son los propios de `rand`) y las disposiciones de
  estado de OTP, por lo que las semillas exportadas, las secuencias y los
  estados tras saltos son iguales a los de OTP para cada algoritmo (`exsss`,
  `exro928ss`, `exrop`, `exs1024s`, `exsp` y los obsoletos `exs64`, `exsplus`,
  `exs1024`, y `dummy`). Para un manejador igual al propio de OTP, los builtins
  privados `clause_rand:seed/2`, `next/2`, `uniform/2,3`, `uniform_real/2`,
  `bytes/3`, `normal/2`, `shuffle/3` y `jump/2` hacen el trabajo en C++:
  inicialización de semillas (SplitMix64, listas, hashes de tuplas de 3
  elementos y errores de semillas de OTP), rangos que superan los bits del
  generador, flotantes densos, bytes, el zigurat normal y el flujo de bits de
  la mezcla. Cualquier otro manejador es un complemento: `rand.erl` ejecuta
  los algoritmos genéricos de OTP sobre sus funs.
- `splitmix64_next/1`, `exsp_next/1`, `exsp_jump/1` y las funciones `mwc59`
  son builtins; `mwc59_seed/0` calcula el hash de la semilla predeterminada de
  `rand`.
- `tools/rand/observe.escript` observa las constantes de OTP mediante la API
  de complementos de `rand`: los anchos de las franjas del zigurat (productos
  de la vía rápida) y sus límites (donde las palabras de una franja alcanzan
  la vía lenta), y los estados tras saltos, a partir de los cuales
  `tools/rand/generate.py` resuelve cada polinomio de salto sobre GF(2)
  (comprobado en un segundo estado) y escribe `tables.cpp`; las alturas de las
  franjas se calculan con alta precisión
  ([diferencias](differences.md#random-numbers)).
- `random` (obsoleto): `uniform_s/1` es un builtin del generador Wichmann-Hill;
  las funciones de inicialización de semillas y del diccionario del proceso
  son Erlang.

## Calendario

`runtime/src/builtins/calendar.cpp`.

- La aritmética gregoriana son builtins sobre enteros de cualquier tamaño con
  `div` y `rem` truncados de Erlang, según las fórmulas de eras de OTP:
  `date_to_gregorian_days/1,3`, `gregorian_days_to_date/1`,
  `datetime_to_gregorian_seconds/1`, `gregorian_seconds_to_datetime/1`,
  `day_of_the_week/1,3`, `is_leap_year/1`, `last_day_of_the_month/2`,
  `valid_date/1,3`, `seconds_to_time/1`, `seconds_to_daystime/1`,
  `time_to_seconds/1`, `time_difference/2`, `iso_week_number/1`. Una forma que
  las cláusulas de OTP rechazan es `function_clause`, algo que no sea entero
  con lo que calcula es `badarith`; las fechas fuera de rango se calculan
  como las calcula OTP.
- La hora local y universal, la hora del sistema y el análisis y formato de
  RFC 3339 son Erlang en `library/stdlib/calendar.erl` sobre los builtins de
  tiempo de `erlang` y `proplists`, con los errores de OTP
  (`{badarg, [Arg, Options]}` fuera de rango, `{badmatch, _}` y
  `{case_clause, _}` para un desplazamiento mal formado).

## Términos persistentes

`runtime/src/builtins/persistent_term.cpp`, sobre la tabla del runtime
([runtime](runtime.md#persistent-terms)). `put/2` y `put_new/2` devuelven `ok`
(`put_new/2` de una clave almacenada es `ok` para un valor exactamente igual,
si no `badarg`); `get/1` de una clave no almacenada es `badarg`, `get/2`
devuelve el valor por defecto; `get/0` enumera cada `{Key, Value}`; `erase/1`
indica si la clave estaba almacenada; `info/0` es
`#{count => N, memory => Bytes}` (las palabras de las copias almacenadas). Las
claves coinciden exactamente (`1` y `1.0` difieren). Las lecturas devuelven
el término almacenado en su sitio, sin copia.

## Módulo unicode

`runtime/src/builtins/unicode/`. Todas las funciones son builtins:
`characters_to_binary/1,2,3`, `characters_to_list/1,2` (también bajo los nombres
internos de OTP `characters_to_binary_int/2` y `characters_to_list_int/2`),
`bin_is_7bit/1`, `bom_to_encoding/1`, `encoding_to_bom/1` y
(`unicode/forms.cpp`) las formas de normalización, `category/1`,
`is_whitespace/1`, `is_id_start/1` e `is_id_continue/1`.

- Codificaciones: `latin1`, `unicode`/`utf8`, `utf16` y `utf32`, big endian
  por defecto o `{utf16 | utf32, big | little}`; cualquier otra cosa es
  `badarg` (`encoding_to_bom/1`: `function_clause`, como OTP).
- Chardata es un binary o una lista, posiblemente impropia con una cola
  binary, de puntos de código, binaries en la codificación de entrada y
  chardata anidados; los binaries consecutivos se decodifican como un único
  flujo, así que un carácter puede abarcar dos. Cualquier otra cosa es
  `badarg`.
- Un carácter que la salida no puede aceptar (un punto de código o una
  secuencia de bytes no válidos, un código por encima de 255 para la salida
  `latin1`) termina la conversión con `{error, Converted, Rest}`; una entrada
  que termina dentro de un carácter, con `{incomplete, Converted, Rest}`.
  `Rest` tiene la forma de OTP: la parte no convertida de la lista más interna
  encabezada por el elemento que falla (un binary como su sufijo no
  convertido, solo cuando cierra el nivel superior), dentro de la cola
  restante de cada lista que la contiene; los bytes inacabados arrastrados
  desde un binary van primero, y con salida `latin1` un entero que falla se
  envuelve en una lista.
- `bin_is_7bit/1` es falso para cualquier cosa que no sea un binary de bytes
  inferiores a 128.
- `characters_to_nfc_list/1` y sus funciones hermanas ejecutan el bucle de OTP
  sobre las formas normales de `unicode_util`: los puntos de código como lista
  o binary UTF-8, `{error, Converted, Rest}` ante UTF-8 no válido y `badarg`
  para cualquier otra cosa. Las funciones de propiedades toman un punto de
  código (si no, `badarg`) y conservan los atajos de OTP: `is_whitespace/1` es
  falso por debajo de 5001 fuera de su lista ASCII y Latin-1, y las pruebas de
  identificadores deciden ASCII directamente y el resto por categoría,
  Other_ID_Start, Other_ID_Continue y sintaxis de patrones.

## Módulo code

`runtime/src/builtins/code.cpp`. No existe ningún proceso `code_server`; las
consultas sobre módulos cargados responden para el programa enlazado: un
módulo está cargado cuando el programa lo tiene (código compilado o builtins
del runtime). `ensure_loaded/1` da `{module, M}` o `{error, nofile}`,
`ensure_modules_loaded/1` da `ok` o `{error, [{M, nofile}]}`, `is_loaded/1`
da `{file, preloaded}` o `false`, `which/1` da `preloaded` o `non_existing`,
`module_status/1` da `loaded` o `not_loaded`, `all_loaded/0` y
`module_status/0` enumeran todos los módulos, `is_sticky/1` es `false`. Un
argumento de módulo que no es un átomo es `function_clause`. Por eso, la vía
de error de `io_lib:format/2` de OTP, que llama a
`code:ensure_modules_loaded/1`, lanza el `badarg` original. Las rutas de
código y la carga son stubs.

## Módulo init

`runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Un ejecutable es un
sistema arrancado sin script de arranque. El arranque decodifica la línea de
órdenes una vez (`ProgramArguments`, `runtime/src/startup/arguments.cpp`): los
argumentos posteriores a las opciones del runtime son tanto el argv de la
entrada de aridad 1 como `get_plain_arguments/0`. No hay flags del emulador; el
único flag es `home`, fijado al arrancar igual que lo fija `erlexec` de OTP
(`HOME`; en Windows `HOMEDRIVE` y `HOMEPATH`, si no `USERPROFILE`), de modo
que `get_argument(home)` es `{ok, [[Home]]}`, `get_arguments/0` es
`[{home, [Home]}]` y cualquier otro flag es `error`. `script_name/0` es la
ruta absoluta del ejecutable con barras normales. Estas cuatro son builtins;
el resto son Erlang:

- respuestas del `init` arrancado de OTP: `get_status/0` da
  `{started, started}`, `notify_when_started/1` da `started`,
  `ensure_loaded/1` da `not_allowed`, `fetch_loaded/0` da `[]`,
  `objfile_extension/0` da `".beam"`, `archive_extension/0` da `".ez"`,
  `code_path_choice/0` da `strict`, `run_on_load_handlers/0` da `ok`,
  `wait_until_started/0` (espera a `{init, started}`); `get_configfd/1` y
  `set_configfd/2` guardan sus valores en `persistent_term` bajo
  `{init, configfd, Id}`;
- `script_id/0` es `{"Clause", "29"}`;
- `stop/0,1` y `reboot/0` detienen el programa de inmediato con las reglas de
  estado de OTP: un entero no negativo es el código de salida, una lista de
  bytes el eslogan de detención, cualquier otro argumento `badarg`;
- rechazadas: `boot/1` y `restart/0,1` lanzan `notsup` tras las
  comprobaciones de argumentos de OTP (`restart/1` de una lista que no es
  `[]` ni `[{mode, M}]` es `badarg`), `make_permanent/2` devuelve
  `{error, notsup}` para nombres válidos y `{error, badarg}` en otro caso.

## Atomics y counters

`runtime/src/builtins/atomics.cpp`. Un array `atomics` es una
[referencia de handle](runtime-heap.md#handle-references) cuyo búfer contiene
una palabra de signo y los valores de 64 bits, actualizados mediante
`std::atomic_ref` con operaciones secuencialmente consistentes; lo comparten
todas las copias de la referencia (mensajes, términos persistentes,
`binary_to_term/1` mientras vive) y se libera con la última.

- `new/2` toma una aridad de 1 a 2^27 y opciones `[{signed, Bool}]` (gana la
  última); `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`, `sub_get/3`,
  `exchange/3`, `compare_exchange/4` e `info/1` son builtins con el `badarg`
  de OTP para una referencia, un índice o un valor erróneos. Los valores
  almacenados deben caber en el array (int64 o uint64); los incrementos
  pueden ser cualquier entero de -2^63 a 2^64 - 1 y dan la vuelta. `info/1`
  informa la `memory` de OTP de 40 + 8 bytes por valor.
- `counters` es Erlang (`library/erts/counters.erl`): `{atomics, Ref}` y
  `{write_concurrency, Ref}` envuelven ambos un array atomics con signo, de
  modo que los contadores de concurrencia de escritura son exactos en cada
  lectura. `info/1` de estos últimos informa el tamaño y la memoria del array.

## Erts internal

`runtime/src/builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`.
Las funciones a las que llaman `stdlib` y `kernel` de OTP:

- los builtins `cmp_term/2` (orden exacto de términos: un entero antes que un
  flotante igual) y `map_next/3`, el protocolo de `maps:iterator/1,2` y
  `maps:next/1`: una ruta entera recorre el map en orden de claves y continúa
  por las claves restantes, una ruta de lista de claves toma sus claves en
  orden; un acumulador de lista recibe cada asociación a partir de la ruta;
- en Erlang, `list_to_integer/2` y `binary_to_integer/2` (las funciones
  auxiliares de `string:to_integer/1` y de los BIF de conversión, `big` más
  allá de un entero pequeño del tamaño de palabra), `map_to_tuple_keys/1` (las
  claves ordenadas de cualquier map), `term_type/1`, las funciones
  `counters_*` de concurrencia de escritura, `dynamic_node_name/0,1` sobre
  `persistent_term`;
- rechazadas: `get_creation/0` es `undefined` (sin distribución) y
  `map_hashmap_children/1` lanza `badarg` (ningún map tiene nodos hashmap);
- declinados: los grupos de distribución, de `.beam` y de internos del
  emulador.

`erts_code_purger:purge/1` responde `{false, false}` y `soft_purge/1`, `true`,
ya que el código enlazado no tiene código antiguo; el proceso purgador y
`finish_after_on_load/2` están declinados.

## Unicode util

`library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`. OTP genera
`unicode_util` durante su compilación (900 KB de Erlang); Clause guarda los
datos en tablas C++ generadas (`unicode/tables.cpp`) consultadas por los
builtins de su módulo privado `clause_unicode`, y `unicode_util.erl` responde a
todas las funciones de OTP sobre ellas con las formas de resultado de OTP
(`{error, Rest}` o `{badarg, Rest}` ante UTF-8 no válido). Los recorridos de
chardata son builtins: `cp/1` (`unicode/code_points.cpp`) abre listas anidadas
hasta donde lo hace OTP y conserva el resto de un binary como una porción de
este; `gc/1` divide los clústeres de grafemas extendidos según UAX #29 en el
orden de reglas de OTP; `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1`
(`unicode/normalize.cpp`) normalizan el primer clúster, y `nfkc/1` conserva
una lista donde su descomposición tenía varios puntos de código, como
`compose_compat_0` de OTP; `uppercase/1`, `lowercase/1`, `titlecase/1` y
`casefold/1` transforman el primer punto de código. `spec_version/0` es
`{17, 0}`.

`tools/unicode/generate.py` escribe las tablas una vez por actualización de
Unicode: las correspondencias de mayúsculas y minúsculas, las categorías, las
descomposiciones y los predicados de propiedades a partir de las respuestas
del OTP del anfitrión para cada punto de código
(`tools/unicode/observe.escript`), y los datos de rupturas de grafemas, emoji,
índicos y de composición a partir de los archivos de la Unicode Character
Database que fija OTP 29 (Unicode 17.0). Solo se confirman en el repositorio
las tablas generadas, con el aviso que exige la Unicode License v3; las
compilaciones no necesitan ni OTP ni los archivos de datos.
`executables_unicode_tables` y `executables_unicode_clusters` comparan
respuestas, clústeres y formas normales con los de OTP, y
`executables_unicode_forms` las formas y propiedades de `unicode`.

## io_lib

`library/stdlib/io_lib.erl`, `runtime/src/builtins/io_lib/`. Los resultados son
las listas profundas de caracteres de OTP, anidadas exactamente como las
construyen `io_lib`, `io_lib_format`: el texto se construye primero como
celdas de un área de memoria de C++ (`io_lib/deep.cpp`) y después se convierte
en un término (`io_lib`) o en caracteres planos (`io:format/1,2,3`, que
ejecuta el mismo motor).

- Escritores (`io_lib/write.cpp`): `write/1,2,5` siguen `write1/4` con límites
  de profundidad (`[...]`, `|...`, `,...`), átomos según la codificación
  (`latin1` escapa los caracteres fuera de Latin-1), maps en el orden de
  claves de Clause, `ordered` o `reversed`; `write_bin/5` informa de los
  tamaños de OTP, incluidas sus peculiaridades. `write_string/1,2` y sus
  formas Latin-1 y `as_latin1`, `write_char/1` y afines, `write_atom/1`,
  `quote_atom/2`, `write_binary/3` y las formas binary escapan como
  `string_char/4` y `needs_escape/2`.
- Motor de formato (`io_lib/format_scan.cpp`, `format_build.cpp`): `scan`
  convierte el formato en literales y maps `format_spec()` (`scan_format/2`,
  `unscan_format/1`, `build_text/1,2`); `build_small` aplana los controles
  pequeños (`~e ~f ~g ~b ~B ~x ~X ~+ ~# ~c ~~ ~n ~i`, `~s` de un átomo) en
  el resultado; `build_limited` reparte `chars_limit` entre `~w ~W ~s ~p ~P`
  y los escribe mediante `string/6`, `term/6` y el relleno equilibrado de
  `chars/2`. `~e`, `~f`, `~g` redondean los 21 dígitos de `float_to_list/1`
  como `float_man/3` (`format_float.cpp`). Los errores internos son `badarg`,
  como los convierte el catch de `io_lib`; `unscan_format/1` lanza los suyos.
  `bformat/2,3` y `bfwrite/2,3` son el mismo texto como UTF-8.
- Comprobaciones y auxiliares: `char_list/1`, `deep_char_list/1`, las
  comprobaciones de imprimibilidad (`printable_list/1` es Latin-1:
  `io:printable_range/0` es `latin1`), `chars_length/1`, `indentation/2` (con
  los desplazamientos de binary de OTP tras un tabulador), `limit_term/2`,
  `nl/0` y los estados del servidor de E/S `collect_chars/1,3,4`,
  `collect_chars_eager/4`, `collect_line/1,3,4`, `collect_line_no_eol/4`
  (`io_lib/collect.cpp`).
- Impresor con formato (`io_lib/pretty*.cpp`): el `io_lib_pretty` de OTP para
  `print/1,4`, `~p`/`~P` (profundidad y `chars_limit`), `write/2,5`,
  `bwrite/2` y `write_bin/5` con `chars_limit` mayor que 0, e informes de
  fallos. `print_length/7` construye el formato intermedio en un área de
  memoria (cada valor con su longitud en una línea, los puntos contienen qué
  imprimir a más profundidad); `intermediate/7` lo profundiza dentro de
  `chars_limit` (`expand/3`, `find_upper`, `search_depth`); `cind/7` elige el
  sangrado de la etiqueta y `pp/8` parte las líneas con las formas de listas
  profundas de OTP. `bformat/2,3` dispone `~p` como `print_bin/2`, con sus
  saltos de línea de binary, tamaño y columna.
- Erlang: `get_until/1,3,4` (aplica el analizador del llamante),
  `format_prompt/1,2` y `write/3`. Stub: `fread/2,3`.
- Los contenedores anidados a más de 256 niveles lanzan `system_limit`, y los
  funs de comparación de `maps_order` son `badarg`
  ([diferencias](differences.md#io)). `executables_io_lib_text` compara las
  formas de cada función con las de OTP, y `executables_pretty_print` las del
  impresor con formato.

## Módulo zlib

`runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. El runtime
enlaza zlib 1.3.2, la versión que incluye OTP 29 ([zlib](compile.md#zlib)),
de modo que los bytes comprimidos son iguales a los de OTP para cada nivel,
estrategia, tamaño de ventana y flush. Un flujo es una
[referencia de handle](runtime-heap.md#handle-references) cuyo búfer contiene
el `z_stream`; su finalizador termina una sesión activa cuando muere la última
copia. Los builtins privados de `clause_zlib` (apertura, cierre, controlador,
inicialización, deflate, inflate, fin, reinicio, llamadas de parámetros y de
diccionario) ejecutan una operación sobre toda su entrada; `zlib.erl`
conserva la API de OTP, los errores de argumentos (`bad_compression_level`,
`bad_windowbits`, ...), los estados del flujo (`not_initialized`,
`already_initialized`, `not_on_controlling_process`), `eos_behavior`, los
diccionarios (`{need_dictionary, Adler}`) y las funciones de búfer completo
`compress/1`, `zip/1`, `gzip/1` y sus inversas (miembros gzip concatenados).
Una cabecera gzip nombra la plataforma, como la escribe el zlib de OTP.
`term_to_binary/2` con `compressed` o `{compressed, Level}` comprime como
decide OTP (en cinco bytes menos que la carga útil; si no, sin comprimir).

## Módulo re

`runtime/src/builtins/re/`, `library/stdlib/re.erl`: las exportaciones y los
tipos de OTP 29 sobre la versión de PCRE2 que incluye OTP
([PCRE2](compile.md#pcre2)). `version/0` es la versión y la fecha de PCRE2
como un binary (`<<"10.47 2025-10-21">>`, como en OTP).

Un patrón compilado es el `{re_pattern, CaptureCount, Unicode, UseCRLF,
Ref}` de OTP 29, donde `Ref` es una
[referencia de handle](runtime-heap.md#handle-references) propietaria del
`pcre2_code`; su finalizador libera el código con la última copia, y los
procesos lo comparten en solo lectura. Como en OTP, la parte en C es pequeña y
el resto es Erlang:

- `clause_re:compile/2` compila un binary de expresión regular con opciones
  de compilación (`{ok, Pattern}` o `{error, {Message, Offset}}` con el
  mensaje de PCRE2); `re:inspect/2` responde a `namelist`.
- `clause_re:run/4` es el BIF `re:run` de OTP sin sus traps: una coincidencia
  sobre un sujeto binary desde `{offset, N}`, compilando antes una expresión
  regular textual, con todas las especificaciones y tipos de captura,
  `match_limit` y `match_limit_recursion`, y los errores de OTP (resultados de
  `report_errors`, `badarg` para opciones de compilación u otras convenciones
  de salto de línea indicadas con un patrón compilado).
- `re.erl` convierte chardata Unicode a UTF-8 y las capturas de vuelta a
  caracteres, ejecuta las coincidencias `global` de una en una (tras una
  coincidencia vacía reintenta anclada y no vacía, y después avanza un
  carácter, o un par CR LF con saltos de línea CRLF, como hace `loopexec` de
  OTP), e implementa `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`, un fun de
  reemplazo) y `split/2,3` (`{parts, N}`, `trim`, `group`, `{return, Type}`)
  con los resultados de OTP.

Los patrones exportados (`export`, `import/1`) no se proporcionan.
`executables_re_module` compara con OTP la compilación, las coincidencias, las
capturas, las coincidencias globales y Unicode, el reemplazo, la división y
los errores de argumentos.

## Prim eval

`runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun, Timeout)` es el receive de `erl_eval`, cuyas
cláusulas son un fun: recorre el buzón desde el mensaje más antiguo con los
pasos de un [receive](processes.md#receive) compilado, los builtins privados
de `clause_receive` `peek/0` (`{message, M}` o `none`), `skip/0`, `take/0`,
`restart/0` y `wait/1` (el builtin de espera del código compilado, con su
tiempo de espera y `timeout_value`). El primer mensaje para el que `Fun`
responde algo distinto de `nomatch` se elimina y se devuelve esa respuesta;
`timeout` cuando vence `Timeout`. Una excepción de `Fun` deja todos los
mensajes en su sitio.
`executables_prim_eval_receive` compara con OTP el orden del buzón, los
tiempos de espera, un mensaje que llega durante la espera y las excepciones.
