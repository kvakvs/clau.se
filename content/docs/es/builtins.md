---
source: docs/builtins.md
sourceCommit: 6ed3851c
sourceSha256: 35d165fa6e573a993a44f0a3284aa944f79954a0af62fd2b79e6b20fe728a9d9
translatedAt: 2026-10-15
---
# Builtins

El puente de producción para builtins. Los builtins son
funciones de `erlang` que el runtime implementa en C++. El runtime los registra
por módulo, función y aridad; el código generado los alcanza directamente,
mediante llamadas dinámicas y como valores fun.

## Qué builtins existen

El catálogo del puente `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) enumera todos los
builtins que conocen tanto el compilador como el runtime:

- los BIF de guard: pruebas de tipo (`is_atom/1` … `is_tuple/1`,
  `is_function/1,2`), `abs/1`, `bit_size/1`, `byte_size/1`, `ceil/1`,
  `element/2`, `float/1`, `floor/1`, `hd/1`, `length/1`, `map_get/2`,
  `map_size/1`, `is_map_key/2`, `max/2`, `min/2`, `round/1`, `size/1`, `tl/1`,
  `trunc/1`, `tuple_size/1`, `binary_part/2,3`;
- los operadores como funciones: comparaciones, `not/1`, `and/2`, `or/2`,
  `xor/2`, operadores aritméticos y bit a bit (`erlang:'+'/1,2` …);
- `display/1`, `halt/0,1`, `error/1,2,3`, `exit/1`, `throw/1`, `raise/3` y
  `function_exported/3`;
- acceso a términos: `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` y los operadores de listas `'++'/2` y
  `'--'/2` (`A ++ B`, `A -- B` se traducen a ellos en el lowering);
- conversiones: `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` no está seleccionada);
- salida por consola: `io:format/1,2` e `io:put_chars/1`, los
  primeros builtins de otro módulo ([io](io.md)); dispositivos de salida:
  `io:format/3`, `io:fwrite/1,2,3`, `io:put_chars/2`, `io:nl/0,1`;
- las funciones de datos de `lists` ([módulo lists](#lists-module));
- todas las funciones de `math` ([módulo math](#math-module));
- el módulo `binary` ([módulo binary](#binary-module));
- las consultas de entorno, proceso y versión de `os` y los BIF de `maps`
  ([módulo maps](#maps-module));
- `persistent_term` ([términos persistentes](#persistent-terms));
- las conversiones de `unicode` ([módulo unicode](#unicode-module));
- las consultas de módulos cargados del módulo `code`
  ([módulo code](#code-module));
- las respuestas sobre la línea de órdenes del módulo `init`
  ([módulo init](#init-module));
- `atomics`, `counters` y las funciones de `erts_internal` que llama stdlib
  ([atomics y counters](#atomics-and-counters),
  [erts_internal](#erts-internal));
- las tablas de `unicode_util` ([unicode_util](#unicode-util));
- identidades de procesos: `self/0`, `make_ref/0`,
  `pid_to_list/1` y `ref_to_list/1`
  ([pids y referencias](terms.md#pids-and-references));
- procesos: `spawn/1,3` e `is_process_alive/1`
  ([procesos](processes.md)); enlaces y señales de salida:
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([enlaces](processes.md#links)); monitores:
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([monitores](processes.md#monitors)); nombres registrados:
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([nombres registrados](processes.md#registered-names));
- mensajes: `'!'/2` (el operador `!`) y `send/2`
  ([mensajes](processes.md#messages));
- el diccionario del proceso: `put/2`, `get/0,1`, `get_keys/0,1`,
  `erase/0,1` ([diccionario del proceso](processes.md#process-dictionary));
- conversiones de binaries, átomos y números: `atom_to_binary/1,2`,
  `binary_to_atom/1,2`, `binary_to_existing_atom/1,2`,
  `list_to_existing_atom/1`, `integer_to_binary/1,2`, `binary_to_integer/1,2`,
  `float_to_binary/1,2`, `binary_to_float/1`, `list_to_float/1`,
  `binary_to_list/3`, `bitstring_to_list/1`, `list_to_bitstring/1`,
  `split_binary/2`, `iolist_size/1`, `list_to_pid/1`, `list_to_ref/1`.
  Comparten las reglas de texto de las conversiones de listas
  (`conversion_text.cpp`: nombres de átomos, dígitos, opciones de flotantes) y
  los errores de OTP: el texto de un flotante necesita dígitos a ambos lados
  del punto (`list_to_float("1e10")` es `badarg`), un exponente fuera de rango
  es `badarg` y un desbordamiento por abajo `0.0`; las codificaciones son
  `utf8`, `unicode` y `latin1`; se ejecutan hasta el final;
- el [formato externo de términos](#external-term-format):
  `term_to_binary/1,2`, `term_to_iovec/1,2`, `external_size/1,2`,
  `binary_to_term/1,2`;
- el [tiempo](#time) y los valores únicos: `monotonic_time/0,1`,
  `system_time/0,1`, `time_offset/0,1`, `convert_time_unit/3`,
  `timestamp/0`, `now/0`, `unique_integer/0,1`, `localtime/0`,
  `universaltime/0`, `date/0`, `time/0`, `localtime_to_universaltime/1,2`,
  `universaltime_to_localtime/1`, `posixtime_to_universaltime/1`,
  `universaltime_to_posixtime/1`; [temporizadores](processes.md#timers):
  `start_timer/3,4`, `send_after/3,4`, `cancel_timer/1,2`, `read_timer/1,2`;
- [introspección de procesos](processes.md#introspection):
  `process_info/1,2`, `processes/0`, `group_leader/0,2`,
  `garbage_collect/0,1,2`, `yield/0`;
  [información del sistema](#system-information): `statistics/1`,
  `system_info/1`, `memory/0,1`;
- [opciones de spawn y alias](processes.md#spawn-options):
  `spawn_opt/2..5`, `spawn_request/1..5`, `spawn_request_abandon/1`,
  `alias/0,1`, `unalias/1`, `monitor/3`, `hibernate/3`;
- [información de funs](funs.md#fun-information), [hashing](#hashing) y MD5:
  `fun_info/1,2`, `fun_to_list/1`, `is_builtin/3`, `phash/2`, `phash2/1,2`,
  `md5/1`, `md5_init/0`, `md5_update/2`, `md5_final/1`;
- [nodos](processes.md#nodes) y [carga de código](#code-loading):
  `nodes/0,1,2`, `is_alive/0`, `monitor_node/2,3`, `disconnect_node/1`,
  `module_loaded/1`, `loaded/0`, `pre_loaded/0`, `delete_module/1`,
  `prepare_loading/2`, `finish_loading/1`, `get_module_info/1,2`.

Las entradas solo se añaden al final: el índice de una entrada es el número que
el código generado pasa al servicio del puente. Una llamada cualificada a un
builtin del catálogo de otro módulo (`io:format(F, A)`) también llama
al puente. Todas las demás funciones de `erlang` llegan al
[módulo de biblioteca erlang](#erlang-module).

## Cómo los alcanzan las llamadas

| Código fuente | Vía |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Servicios en línea, como antes del puente |
| `erlang:function_exported(M, F, A)`, `setelement(I, T, V)`, `A ++ B`, `A -- B`, `length(L)` en un cuerpo (builtins del catálogo sin servicio en línea) | Se entra en ellos como en una función: `CLAUSE_builtin_frame_v1(context, index)` da el marco del builtin y los argumentos van en los registros ([porciones](#portions)) |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externo `erlang:F/A`; el registro lo vincula al builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` en tiempo de ejecución | El servidor de código busca primero una exportación del módulo y después un builtin |

- `fun F/A` de un builtin autoimportado que el módulo ni define ni
  suprime (`-compile({no_auto_import, ...})`) es el fun externo `erlang:F/A`,
  como en OTP: `fun abs/1 =:= fun erlang:abs/1` y se imprime como
  `fun erlang:abs/1`. `halt/0,1`, `setelement/3`, `tuple_to_list/1`,
  `list_to_tuple/1`, las conversiones, los builtins de procesos y
  los de puertos `open_port/2`, `port_close/1`, `port_command/2,3`,
  `port_connect/2`, `port_control/3`, `port_to_list/1`, `list_to_port/1` se
  autoimportan como en OTP; `display/1`, `raise/3`, `function_exported/3`,
  `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3` y `ports/0` necesitan el
  prefijo `erlang:` ([puertos](ports.md#builtins-and-port-messages)).
- Un builtin tiene un `FrameDescriptor` con cuerpo nulo
  (`BuiltinFrame`). Entrar en él (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) no
  apila ningún marco: el builtin se ejecuta sobre los registros y su
  resultado vuelve al cuerpo del llamador, de modo que un builtin en
  posición de cola retorna al llamador del llamador.
- Los errores son los que lanza el lowering en línea en un cuerpo: `badarg`,
  `badarith` para la aritmética, `system_limit`, `{badmap, M}`, `{badkey, K}`;
  `raise/3` con una clase o pila no válidas devuelve `badarg`. Pasan por el
  canal de fallos comprobado como cualquier error de servicio.
- El acceso a términos sigue las reglas de `badarg` de OTP: `setelement/3`
  necesita un índice entero pequeño dentro de la tupla; `make_tuple/2,3` un
  tamaño pequeño en 0..16.777.215, y `make_tuple/3` una lista propia de pares
  `{Index, Value}` dentro del tamaño (los pares posteriores prevalecen);
  `list_to_tuple/1` una lista propia; `A ++ B` una lista propia `A`
  (`[] ++ B` es `B` para cualquier `B`, un `B` que no es lista termina el
  resultado); `A -- B` dos listas propias, donde cada elemento de `B` elimina
  el primer elemento exactamente igual (`=:=`) de `A`, en O((n + m) log m).
- Las conversiones siguen a OTP:
  - `list_to_atom/1` toma una lista propia de puntos de código (sin
    sustitutos); un carácter número 256 es `system_limit` antes de
    comprobarlo. Una tabla de átomos llena (`--max-atoms`) detiene el programa
    como fallo del runtime (`resource_limit`, código de salida
    70).
  - `integer_to_list/2` y `list_to_integer/2` toman una base pequeña en 2..36;
    los dígitos se imprimen en mayúsculas y se analizan en cualquiera de las
    dos. `list_to_integer` acepta un signo opcional, omite los ceros a la
    izquierda, necesita un dígito y lanza `system_limit` para más de 1.262.611
    dígitos decimales significativos (o 4.194.304 en cualquier base) una vez
    que sus primeros dígitos son válidos, y para un valor que supera el límite
    de enteros.
  - `float_to_list/1` es `"%.20e"`; las opciones de `/2` se aplican en orden y
    prevalece el último formato: `{scientific, D}` (`"%.*e"`, una D negativa es
    6), `{decimals, D}` (D >= 0; notación fija con el redondeo propio de OTP por
    debajo de 2^53 y 19 decimales; `compact` elimina los ceros finales, también
    de un entero con `{decimals, 0}` por encima de 2^53), `short` (los dígitos
    de ida y vuelta más cortos en la elección fija/científica de OTP). Un texto
    de 256 bytes o más es `badarg`.
  - `binary_to_list/1` necesita un binary; `list_to_binary/1` una lista e
    `iolist_to_binary/1` una lista o un binary de bytes, binaries y listas
    anidadas, cada lista terminada en `[]` o en un binary.
- `function_exported(M, F, A)` lanza `badarg` salvo que `M` y `F` sean átomos y
  `A` un entero pequeño; es verdadero cuando un módulo del programa exporta
  `M:F/A` o `M:F/A` es un builtin registrado.

## Módulo lists

Fuente: `runtime/src/builtins/lists/`. El `lists` de OTP es código Erlang
(salvo unos pocos BIF), así que los builtins de Clause lanzan lo que lanzan las
cláusulas de OTP:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` y
  `keydelete/3` lanzan `function_clause` para un argumento que ninguna
  cláusula de OTP acepta, y recorren las listas de forma tan perezosa como OTP:
  `sublist([a | b], 1)` es `[a]`, `nthtail(1, [a | b])` es `b`, `flatten/2` no
  comprueba su cola más allá de `is_list`.
- `keymember/3` y `keysearch/3` son BIF en OTP: `badarg` para una posición que
  no es un entero pequeño positivo o para una cola impropia alcanzada antes de
  una coincidencia.
- Las claves y el orden se comparan con `==` y el orden de términos; entre
  elementos que se comparan como iguales gana el primero (`max([1, 1.0])` es
  `1`, `usort([1.0, 1])` es `[1.0]`, `umerge/1,2` conservan el elemento de la
  lista anterior).
- Se ejecutan hasta el final. Las funciones que toman funs (`foreach/2`,
  `mapfoldl/3`, `mapfoldr/3`, `splitwith/2`, `partition/2`, `filtermap/2`,
  `uniq/2`, ...) son Erlang en `library/stdlib/lists.erl`, porque un builtin no
  puede llamar a un fun y recibir su resultado; también lo son `prefix/2`,
  `suffix/2` y `uniq/1`, con las cláusulas y guards de OTP.
- Un `function_clause` de un builtin no tiene marco propio
  ([diferencias](differences.md)).

## Módulo math

Fuente: `runtime/src/builtins/math.cpp`. `library/stdlib/math.erl` contiene
las exportaciones de OTP 29 como stubs; cada una es un builtin sobre la
biblioteca C (`pi/0` y `tau/0` son constantes). Los argumentos son números
convertidos a flotantes: cualquier otra cosa es `badarg`, y un entero demasiado
grande para un flotante `badarith`. Un resultado que no es un flotante finito
(un error de dominio como `sqrt(-1)`, `log(0)`, `acos(2)`, o un desbordamiento
como `pow(10, 400)`, `exp(1000)`) es `badarith`. `floor/1` y `ceil/1` devuelven
flotantes. Los resultados son los de la biblioteca C del anfitrión, que pueden
diferir de los de OTP en el último bit ([diferencias](differences.md)). En
objetivos de 64 bits el código generado calcula en línea, en una celda
flotante, `sqrt`, `floor`, `ceil` (intrínsecos de LLVM) y `exp`, `log`,
`log2`, `log10`, `sin`, `cos`, `pow` (las mismas funciones de la biblioteca C,
llamadas sin las sustituciones de LLVM) de argumentos numéricos; los demás
operandos y los resultados no finitos llaman al builtin, que lanza el error.

## Módulo binary

Fuente: `runtime/src/builtins/binary/`. `library/stdlib/binary.erl` contiene
las exportaciones de OTP 29; `replace/3,4` (incluido un reemplazo mediante fun
y `{insert_replaced, ...}`) y `list_to_bin/1` son Erlang sobre los builtins, y
todas las demás funciones son builtins:

- Los patrones son un binary no vacío, una lista no vacía de binaries no
  vacíos o un patrón compilado. Una coincidencia es la posición más a la
  izquierda y, en ella, el patrón más largo; `matches/2,3` y `split/2,3` con
  `global` toman coincidencias no solapadas desde la izquierda.
  `{scope, {Start, Length}}` limita dónde pueden empezar y terminar las
  coincidencias (una longitud negativa cuenta hacia atrás); `split/3` acepta
  también `global`, `trim` y `trim_all`.
- `compile_pattern/1` devuelve `{bm, [Pattern]}` o `{ac, Patterns}`, la forma
  propia de Clause (OTP: una referencia dentro de la tupla,
  [diferencias](differences.md)).
- `part/2,3`, `bin_to_list/2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` y
  `decode_hex/1` siguen a OTP; todo argumento incorrecto (un bitstring, un
  rango fuera del sujeto, una opción desconocida) es `badarg`.
- `referenced_byte_size/1` es el tamaño propio del binary.
- Se ejecutan hasta el final.

## Módulo maps

Fuente: `runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` y `from_keys/2` son builtins con
  los errores de OTP: algo que no es un map es `{badmap, Map}`, una clave
  ausente en `update/3` `{badkey, Key}`, una lista de claves que no es una
  lista propia `badarg`. Las claves se comparan de forma exacta (`1` y `1.0`
  son claves distintas). `filter/2`, `map/2`, `foreach/2` y
  `update_with/3,4` son Erlang en `library/stdlib/maps.erl`.
- `os:getenv/0` (cadenas `"Name=Value"`; se omiten las entradas `=C:` por
  unidad de Windows), `os:env/0` (pares `{Name, Value}`), `os:putenv/2`,
  `os:unsetenv/1` (`badarg` salvo que los argumentos sean cadenas y el nombre
  no esté vacío ni contenga `=`), `os:getpid/0` y `os:version/0` son builtins;
  `os:timestamp/0`, `os:system_time/0,1`, `os:perf_counter/0,1` y
  `os:getenv/2` son Erlang sobre los builtins de tiempo de `erlang` y
  `getenv/1`.

## Términos persistentes

Plan 11 step 41M2 (`runtime/src/builtins/persistent_term.cpp`) sobre la tabla
del runtime ([runtime](runtime.md#persistent-terms)). `put/2` y `put_new/2`
devuelven `ok` (`put_new/2` de una clave almacenada es `ok` para un valor
exactamente igual y, si no, `badarg`); `get/1` de una clave no almacenada es
`badarg`, `get/2` devuelve el valor por defecto; `get/0` enumera todos los
`{Key, Value}`; `erase/1` indica si la clave estaba almacenada; `info/0` es
`#{count => N, memory => Bytes}` (las palabras de las copias almacenadas). Las
claves se comparan de forma exacta (`1` y `1.0` difieren). Cada lectura copia
el valor en el heap del llamador.

## Módulo unicode

Fuente: `runtime/src/builtins/unicode/`. `library/stdlib/unicode.erl` contiene
las exportaciones y los tipos de OTP 29; `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` y
`encoding_to_bom/1` son builtins, y las funciones de normalización, categoría
e identificadores siguen siendo stubs; ahora pueden escribirse sobre
[unicode_util](#unicode-util) cuando un programa las necesite.

- Codificaciones: `latin1`, `unicode`/`utf8`, `utf16` y `utf32`, big endian por
  defecto o `{utf16 | utf32, big | little}`; cualquier otra cosa es `badarg`
  (`encoding_to_bom/1`: `function_clause`, como OTP).
- Los chardata son un binary o una lista, posiblemente impropia con una cola
  binary, de puntos de código, binaries en la codificación de entrada y
  chardata anidados; los binaries consecutivos se decodifican como un único
  flujo, por lo que un carácter puede abarcar dos. Cualquier otra cosa es
  `badarg`.
- Un carácter que la salida no admite (un punto de código o una secuencia de
  bytes inválidos, un código por encima de 255 para la salida `latin1`)
  termina la conversión con `{error, Converted, Rest}`; una entrada que termina
  dentro de un carácter, con `{incomplete, Converted, Rest}`. `Rest` tiene la
  forma de OTP: la parte no convertida de la lista más interna encabezada por
  el elemento que falla (un binary como su sufijo no convertido, solo cuando
  termina el nivel superior), dentro de la cola restante de cada lista
  contenedora; los bytes inacabados arrastrados de un binary van primero, y con
  la salida `latin1` un entero que falla se envuelve en una lista.
- `bin_is_7bit/1` es falso para cualquier cosa que no sea un binary de bytes
  por debajo de 128.

## Módulo code

Fuente: `runtime/src/builtins/code.cpp`. `library/kernel/code.erl` contiene las
exportaciones y los tipos de OTP 29; no existe ningún proceso `code_server`, y
las consultas sobre módulos cargados responden por el programa enlazado: un
módulo está cargado cuando el programa lo tiene (código compilado o builtins
del runtime). `ensure_loaded/1` da `{module, M}` o `{error, nofile}`,
`ensure_modules_loaded/1` `ok` o `{error, [{M, nofile}]}`, `is_loaded/1`
`{file, preloaded}` o `false`, `which/1` `preloaded` o `non_existing`,
`module_status/1` `loaded` o `not_loaded`, `all_loaded/0` y `module_status/0`
enumeran todos los módulos, `is_sticky/1` es `false`. Un argumento de módulo
que no es un átomo es `function_clause`. Las rutas de código y la carga siguen
siendo stubs hasta el [step 71](../.agents/11-plan.md#step-71). La vía de error
de `io_lib:format/2` de OTP (`code:ensure_modules_loaded/1`) lanza ahora el
`badarg` original.

## Módulo init

Fuente: `runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Un ejecutable
es un sistema arrancado sin script de arranque. El arranque decodifica la línea
de órdenes una vez (`ProgramArguments`, `runtime/src/startup/arguments.cpp`):
los argumentos posteriores a las opciones del runtime son a la vez el argv de
la entrada de aridad 1 y `get_plain_arguments/0`. No hay flags de emulador; el
único flag es `home`, fijado en el arranque como lo fija `erlexec` de OTP
(`HOME`; en Windows `HOMEDRIVE` y `HOMEPATH` y, si no, `USERPROFILE`), de modo
que `get_argument(home)` es `{ok, [[Home]]}`, `get_arguments/0` es
`[{home, [Home]}]` y cualquier otro flag es `error`. `script_name/0` es la ruta
absoluta del ejecutable con barras normales. Estos cuatro son builtins; el
resto son Erlang:

- respuestas del `init` de OTP ya arrancado: `get_status/0`
  `{started, started}`, `notify_when_started/1` `started`, `ensure_loaded/1`
  `not_allowed`, `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (espera
  `{init, started}`); `get_configfd/1` y `set_configfd/2` guardan sus valores
  en `persistent_term` bajo `{init, configfd, Id}`;
- `script_id/0` es `{"Clause", "29"}`;
- `stop/0,1` y `reboot/0` terminan de inmediato con las reglas de estado de
  OTP: un entero no negativo es el código de salida, una lista de bytes el
  eslogan de halt y cualquier otro argumento `badarg`;
- rechazadas: `boot/1` y `restart/0,1` lanzan `notsup` tras las comprobaciones
  de argumentos de OTP (`restart/1` de una lista que no es `[]` ni
  `[{mode, M}]` es `badarg`), `make_permanent/2` devuelve `{error, notsup}`
  para nombres válidos y `{error, badarg}` en otro caso.

## Unicode util

Fuente: `library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`. OTP
genera `unicode_util` durante su compilación (900 KB de Erlang); Clause guarda
los datos en tablas C++ generadas (`unicode/tables.cpp`) que consultan los
builtins de su módulo privado `clause_unicode` (`table/1`, `class/1`,
`cases/1`, `flags/1`, `compose_pair/2`), y `unicode_util.erl` responde a las
funciones de OTP sobre ellas con las formas de resultado de OTP:

- `cp/1` toma el primer punto de código de unos chardata como hace OTP,
  conservando las colas binary y aplanando hasta tres puntos de código más de
  listas anidadas; `{error, Rest}` ante UTF-8 inválido;
- `lookup/1`, `category/1`, `get_case/1`, `spec_version/0` (`{17, 0}`),
  `pattern_whitespace/0`; `uppercase/1`, `lowercase/1`, `titlecase/1`,
  `casefold/1` transforman el primer punto de código (`{badarg, Rest}` ante
  UTF-8 inválido); `is_wide/1`, `is_whitespace/1`, `is_other_id_start/1`,
  `is_other_id_continue/1`, `is_letter_not_pattern_syntax/1`;
- `gc/1`: clústeres de grafemas extendidos según UAX #29, con el orden de
  reglas de OTP (CR LF, controles, vías rápidas de Latin-1, prepend, sílabas
  Hangul, pares de indicadores regionales, secuencias pictográficas extendidas
  y ZWJ, conjuntos índicos) y sus formas de resultado: un clúster es un punto
  de código o una lista, y el resto sigue siendo los chardata de los que
  procede allí donde OTP los conserva (`{error, Rest}` ante UTF-8 inválido);
- `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` normalizan el primer clúster:
  descomposición canónica o de compatibilidad con Hangul algorítmico,
  ordenación canónica estable y después composición mediante los pares de
  composición.

`tools/unicode/generate.py` escribe las tablas una vez por actualización de
Unicode: las correspondencias de mayúsculas y minúsculas, las categorías
(incluidas las categorías vecinas que el generador de OTP da a algunos puntos
de código sin asignar), las descomposiciones y los predicados de propiedades
proceden de las respuestas del OTP anfitrión para cada punto de código
(`tools/unicode/observe.escript`), y los datos de rotura de grafemas, emoji,
índicos y de composición de los archivos de la Unicode Character Database que
fija OTP 29 (`lib/stdlib/uc_spec`, Unicode 17.0). Solo se versionan las tablas
generadas, con el aviso de copyright de Unicode que exige la Unicode License
v3; las compilaciones normales no necesitan ni OTP ni los archivos de datos. La
prueba `executables_unicode_tables` compara resúmenes de las respuestas del
plano 0 y de bloques de muestra de los demás planos con los de OTP (los 1,1 M
de puntos de código coincidieron cuando se generaron las tablas);
`executables_unicode_clusters` compara clústeres y formas normales de cadenas
escogidas a mano para cada regla y un barrido con semilla de 2000 cadenas
aleatorias.

## Módulo zlib

Fuente: `runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. El
runtime enlaza zlib 1.3.2, la versión que incluye OTP 29
([zlib](compile.md#zlib)), por lo que los bytes comprimidos son iguales a los
de OTP para todo nivel, estrategia, tamaño de ventana y flush. Un flujo es una
[referencia handle](runtime-heap.md#handle-references) cuyo búfer contiene el
`z_stream`; su finalizador termina una sesión activa cuando muere la última
copia. Los builtins privados de `clause_zlib` (`open/0`, `close/1`,
`set_controller/2`, `deflate_init/2`, `inflate_init/3`, `deflate/3`,
`inflate/2`, las llamadas de fin, reinicio, parámetros y diccionario) ejecutan
una operación sobre toda su entrada; `zlib.erl` conserva la API de OTP, los
errores de argumentos (`bad_compression_level`, `bad_windowbits`, ...), los
estados del flujo (`not_initialized`, `already_initialized`,
`not_on_controlling_process`, un flujo cerrado que rechaza una nueva
inicialización), `eos_behavior` (`cut`, `reset`, `error`), `data_error` de
`inflateEnd/1` antes del final de un flujo, los diccionarios
(`{need_dictionary, Adler}` lanzado o devuelto), la salida retenida por
`deflateParams/3` para el siguiente `deflate`, y las funciones de búfer
completo `compress/1`, `uncompress/1`, `zip/1`, `unzip/1`, `gzip/1`,
`gunzip/1` (miembros concatenados). Una cabecera gzip nombra la plataforma,
como la escribe el zlib de OTP. `term_to_binary/2` con `compressed` o
`{compressed, Level}` comprime según decide OTP (en cinco bytes menos que la
carga útil o, si no, sin comprimir) y `binary_to_term/1,2` descomprime la
entrada comprimida.

## Módulo re

Fuente: `runtime/src/builtins/re/`, `library/stdlib/re.erl`. Las exportaciones
y los tipos de OTP 29 sobre la versión de PCRE2 que incluye OTP
([PCRE2](compile.md#pcre2)). `version/0` es la versión y la fecha de PCRE2
como binary (`<<"10.47 2025-10-21">>`, como en OTP).

Un patrón compilado es el `{re_pattern, CaptureCount, Unicode, UseCRLF, Ref}`
de OTP 29, donde `Ref` es una
[referencia handle](runtime-heap.md#handle-references) que posee el
`pcre2_code`; su finalizador libera el código con la última copia, y los
procesos lo comparten en solo lectura. Como en OTP, la parte en C es pequeña y
el resto es Erlang:

- `clause_re:compile/2` compila un binary de expresión regular con opciones de
  compilación (`{ok, Pattern}` o `{error, {Message,
  Offset}}` con el mensaje de PCRE2); `re:inspect/2` responde a `namelist`.
- `clause_re:run/4` es el BIF `re:run` de OTP sin sus traps: una coincidencia
  de un sujeto binary desde `{offset, N}`, compilando antes una expresión
  regular textual (`{error, {compile, Reason}}` con `report_errors`), con toda
  especificación de captura (`all`, `first`, `all_but_first`, `none`,
  `all_names`, números y nombres, nombres duplicados) y todo tipo (`index`,
  `list`, `binary`), `match_limit` y `match_limit_recursion`
  (`{error, match_limit}` con `report_errors` y, si no, `nomatch`), y el
  `badarg` de OTP para opciones de compilación u otras convenciones de salto
  de línea dadas con un patrón compilado.
- `re.erl` convierte los chardata Unicode a UTF-8 y las capturas de vuelta a
  caracteres, ejecuta las coincidencias `global` de una en una (tras una
  coincidencia vacía reintenta anclada y no vacía, y después avanza un
  carácter, o un par CR LF con saltos de línea CRLF, como hace el `loopexec`
  de OTP), e implementa `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`, un fun de
  reemplazo) y `split/2,3` (`{parts, N}`, `trim`, `group`, `{return, Type}`)
  con los resultados de OTP.

Los patrones exportados (`export`, `import/1`) no se proporcionan.
`executables_re_module` compara con OTP la compilación, las coincidencias, las
capturas, las coincidencias globales y Unicode, replace, split y los errores
de argumentos.

## Prim eval

Fuente: `runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun,
Timeout)` es el receive de `erl_eval`, cuyas cláusulas son un fun: recorre el
buzón desde el mensaje más antiguo con los pasos de un
[receive](processes.md#receive) compilado, los builtins privados de
`clause_receive` `peek/0` (`{message, M}` o `none`), `skip/0`, `take/0`,
`restart/0` y `wait/1` (el builtin de espera del código compilado, con su
timeout y `timeout_value`). El primer mensaje para el que `Fun` responde algo
distinto de `nomatch` se retira y se devuelve esa respuesta; `timeout` cuando
vence `Timeout`. Una excepción de `Fun` deja todos los mensajes en su sitio.
`executables_prim_eval_receive` compara con OTP el orden del buzón, los
timeouts, un mensaje que llega durante la espera y las excepciones.

## Atomics y counters

Fuente: `runtime/src/builtins/atomics.cpp`. Un array de `atomics` es una
[referencia handle](runtime-heap.md#handle-references) cuyo búfer contiene una
palabra de signo y los valores de 64 bits, actualizados mediante
`std::atomic_ref` con operaciones secuencialmente consistentes; lo comparten
todas las copias de la referencia (mensajes, términos persistentes,
`binary_to_term/1` mientras vive) y se libera con la última.

- `new/2` toma una aridad de 1 a 2^27 y opciones `[{signed, Bool}]` (gana la
  última); `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`, `sub_get/3`,
  `exchange/3`, `compare_exchange/4` e `info/1` son builtins con el `badarg`
  de OTP para una referencia, un índice o un valor incorrectos. Los valores
  almacenados deben caber en el array (int64 o uint64); los incrementos pueden
  ser cualquier entero de -2^63 a 2^64 - 1 y dan la vuelta. `info/1` informa
  del `memory` de OTP de 40 + 8 bytes por valor.
- `counters` es Erlang (`library/erts/counters.erl`): `{atomics, Ref}` y
  `{write_concurrency, Ref}` envuelven ambos un array de atomics con signo, de
  modo que los counters con write-concurrency son exactos en cada lectura.
  `info/1` de estos últimos informa del tamaño y la memoria del array.

## Erts internal

Fuente: `runtime/src/builtins/erts_internal.cpp`,
`library/erts/erts_internal.erl`. Las funciones que llaman `stdlib` y `kernel`
de OTP:

- los builtins `cmp_term/2` (orden exacto de términos: un entero antes de un
  flotante igual) y `map_next/3`, el protocolo de `maps:iterator/1,2` y
  `maps:next/1`: una ruta entera recorre el map en orden de claves y continúa
  sobre las claves restantes, una ruta de lista de claves toma sus claves en
  orden; un acumulador de lista recibe todas las asociaciones a partir de la
  ruta;
- en Erlang, `list_to_integer/2` y `binary_to_integer/2` (las auxiliares de
  `string:to_integer/1` y de los BIF de conversión, `big` más allá de un
  entero pequeño del tamaño de palabra), `map_to_tuple_keys/1` (las claves
  ordenadas de cualquier map), `term_type/1`, las funciones `counters_*` de
  write-concurrency, `dynamic_node_name/0,1` sobre `persistent_term`;
- rechazadas: `get_creation/0` es `undefined` (sin distribución) y
  `map_hashmap_children/1` lanza `badarg` (ningún map tiene nodos hashmap);
- descartados: los grupos de distribución, de `.beam` y los internos del
  emulador.

`erts_code_purger:purge/1` responde `{false, false}` y `soft_purge/1` `true`,
ya que el código enlazado no tiene código antiguo; el proceso purger y
`finish_after_on_load/2` esperan al [step 71](../.agents/11-plan.md#step-71).

## Porciones

Los builtins cuyo trabajo crece con
un argumento lista o binary se ejecutan en porciones acotadas, como los BIF de
OTP que hacen trap, de modo que un builtin largo no puede impedir que
otros procesos se ejecuten ([procesos](processes.md)).

- Se entra en cada builtin del puente que llama un cuerpo como en una
  función, y consume una reducción. Una porción puede hacer
  `WORK_PER_REDUCTION` (16) unidades de trabajo por cada reducción que quede en
  la porción de tiempo (al menos el equivalente a una reducción): celdas de
  lista recorridas o construidas, comparaciones, bytes. Las paga con cargo a la
  porción de tiempo.
- Un builtin con trabajo pendiente hace trap: `ProcessStack::trap`
  designa un marco de continuación y coloca los términos de estado del
  builtin en los registros, que siguen siendo raíces; el estado
  nativo (bytes, posiciones de ordenación, palabras de términos conservadas
  como raíces) reside en el `TrapState` de la pila del proceso. El proceso cede
  el control y se reanuda en la continuación en una porción de tiempo
  posterior. Las recolecciones entre porciones reescriben los registros y las
  palabras de estado como las demás raíces.
- Los resultados, errores y el orden de evaluación son los mismos que al
  ejecutarse hasta el final. Un error encontrado tarde (una cola impropia) se
  lanza cuando el recorrido llega a él.
- Las llamadas del anfitrión (`call_builtin`) continúan cada trap de inmediato.
- `integer_to_list/1` de un entero pequeño, `list_to_integer/1` de una cadena
  decimal corta y `atom_to_list/1` trabajan sobre palabras sin asignaciones
  intermedias; los demás argumentos siguen las vías generales.
  `list_to_tuple/1` y `tuple_to_list/1` leen las celdas de su argumento como
  palabras y construyen el resultado sin volver a admitir los elementos, igual
  que las listas de caracteres de estas conversiones.
- Los recorridos de listas validan la lista una vez y leen sus celdas como
  palabras, sin un `Term` por celda; `Left ++ Right` copia un `Left` de como
  máximo 64 celdas en un solo paso sin estado de porción.

| Builtin | Porciones |
| --- | --- |
| `length/1` en un cuerpo | Cuenta celdas; en un guard sigue siendo el servicio en línea, ya que el BIF de guard de OTP no hace trap |
| `A ++ B` | Recoge los elementos de `A` y después construye la copia sobre `B` desde su final |
| `A -- B` | Recoge `B`, lo ordena por orden exacto (ordenación por mezcla ascendente), recorre `A` con una búsqueda binaria por elemento y después construye los elementos conservados; cuando no se elimina nada, el resultado es el propio `A` |
| `binary_to_list/1` | Construye la lista desde el final del binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Recorre la iolist en profundidad y después crea el binary de una vez |

Los demás builtins se ejecutan hasta el final. Los builtins de tuplas
(`setelement/3`, `make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`)
se comportan como en OTP: su trabajo está acotado por el
límite de aridad de tuplas. Las conversiones restantes leen entradas acotadas
por los límites de átomos, enteros y flotantes. El formateo con
`io:format/1,2` se ejecuta hasta el final ([diferencias](differences.md)). Los
servicios en línea de los bucles (la inversión final de una comprehension) se
ejecutan hasta el final como parte del bucle.

## Builtins tipados

Los builtins que comprueban sus
propios argumentos son funciones C++ con parámetros tipados
([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registrados con
`typed_entry<Function>(module, name)` (la aridad es el número de parámetros).

- El adaptador admite cada palabra de argumento en orden (una palabra que este
  proceso no posee es el fallo que corresponde, nunca `badarg`) y después
  convierte cada una a su tipo de parámetro; una discrepancia lanza `badarg` y
  la función no se ejecuta.
- Tipos de parámetro: `Term` (cualquier término, la alternativa genérica),
  `std::int64_t` (un entero pequeño), `detail::Integer` (cualquier entero),
  `double` (un flotante), `ListArgument` (una lista propia y sus elementos),
  `TupleArgument`, `BinaryArgument` (los bytes de un binary), `AtomArgument`
  (su grafía).
- Resultados: `Term`, `TermResult<Term>` (una construcción fallida es un fallo
  del runtime), `BuiltinResult<Term>` (`std::expected` con un
  `BuiltinFailure`), o una `Word` en bruto que la propia función ha publicado.
  Una función también puede lanzar `BuiltinFailure` (un error de Erlang como
  `badarg` o `system_limit`, o un fallo de acceso a términos); `call_builtin`
  convierte cualquier otra excepción de C++ en `out_of_memory` o
  `internal_error`, de modo que ninguna cruza la ABI del código generado.
- Las familias de acceso a términos, conversión e io, `binary_part/2` y
  `function_exported/3` son tipados. Los demás builtins de `erlang`
  pasan sus palabras de argumento sin convertir a los servicios en línea que
  también llama el código generado, que las admiten; siguen siendo adaptadores
  `BuiltinBody` a nivel de palabra.

## Registro

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  propiedad del `CodeServer`, asocia módulo/función/aridad exactos a un
  `BuiltinFrame`. `add` toma un lote de `BuiltinEntry` y registra todos o
  ninguno: un nombre vacío, más de 255 argumentos, una implementación ausente o
  un nombre ya registrado (o repetido en el lote) rechazan el lote sin
  conservar nada.
- El arranque del runtime registra todas las tablas de
  `production_builtins()` (`erlang_builtins()`, `term_access_builtins()`,
  `conversion_builtins()`, `io_builtins()`), con la mayoría de las entradas
  creadas por `typed_entry`, que en conjunto cubren el catálogo; las familias
  posteriores añaden sus propias tablas.
- Un cuerpo lee exactamente tantas palabras de argumento como su aridad y
  registra los errores en el canal comprobado; las excepciones del anfitrión se
  convierten en fallos `out_of_memory` o `internal_error`.
- La vía anterior del anfitrión `abi::v1::dispatch_builtin` (módulos nativos
  registrados por el anfitrión por nombre,
  [runtime](runtime.md#code-server-and-builtins)) es independiente
  y no cambia.

## Módulo erlang

El compilador sabe qué funciones de `erlang` existen a partir de dos fuentes
propias, nunca a partir del código del runtime:

- `library/stdlib/erlang.terms`: las exportaciones de `erlang` de OTP 29 como
  `{Name, Arity, Flags, Status}` (flags `auto_import`, `guard`; estado
  `implemented`, `{planned, Step}` o `{unavailable, Reason}`: `distribution`,
  `tracing`, `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` observa el OTP anfitrión y
  conserva los estados, que se mantienen a mano.
- `tests/compiler/builtins/generate_erlang.py` lo convierte en
  `library/stdlib/erlang.erl` (el módulo de stubs propio de Clause) y
  `compiler/src/semantic/erlang_auto_imports.inc` (la lista de autoimportación
  de OTP). La prueba CTest `builtins_erlang_inventory` comprueba que ambos
  están al día y que `implemented` significa un builtin del catálogo, una
  función que maneja el compilador (`apply/2,3`, `is_record/1,2,3`) o un
  cuerpo Erlang real (`nif_error/1,2` lanzan `error(Reason)` como los stubs de
  OTP); `builtins_erlang_freshness` (etiqueta `host_otp`) compara el
  inventario con el OTP anfitrión.

Llamadas:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` e
  `-import(erlang, ...)` de un builtin van al builtin, como antes. Cualquier
  otra exportación se une al programa como el módulo de biblioteca `erlang`
  (compilado como `lists`); sus stubs lanzan
  `error({not_implemented, F, A})` con `erlang:F/A` en la cima de la pila, solo
  cuando se llaman. Un nombre que el módulo no exporta es
  `undefined function erlang:F/A`.
- Una llamada no cualificada o un `fun F/A` de una autoimportación de OTP
  (`get(K)`, `fun put/2`) que el módulo ni define, ni importa, ni suprime con
  `-compile({no_auto_import, ...})` llega a `erlang:F/A` de la misma manera.
- Los builtins son sticky: cuando se registra el módulo `erlang`, el runtime
  omite toda exportación que tenga el nombre de un builtin registrado, de modo
  que `M:F(Args)` con `M = erlang` y los funs externos se vinculan al builtin,
  nunca a un stub.

## Formato externo de términos

Fuente: `erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Ambas
direcciones comparten con el compilador el códec de
[external_term.hpp](../abi/include/clause/abi/external_term.hpp), y recorren
los términos con pilas explícitas, de modo que la profundidad de anidamiento no
cuesta pila nativa.

- `term_to_binary/1,2` escribe los bytes de OTP para un nodo no distribuido
  (`nonode@nohost`, creation 0): átomos UTF-8, `NEW_FLOAT`, `STRING_EXT` para
  listas de bytes de hasta 65535 elementos, maps en orden de claves, pids,
  puertos y referencias en sus formas `NEW_PID`, `V4_PORT` y
  `NEWER_REFERENCE`, y `EXPORT_EXT` para `fun M:F/A`. Opciones:
  `{minor_version, 0..2}` (0 escribe flotantes como texto, 0 y 1 átomos
  Latin-1), `deterministic`, `compressed` y `{compressed, 0..9}`; cualquier
  otra cosa es `badarg`.
- `term_to_iovec/1,2` devuelve la codificación como una lista de un binary;
  `external_size/1,2` su tamaño exacto.
- `binary_to_term/1,2` comprueba cada longitud frente a la entrada antes de
  asignar, ignora los bytes posteriores al término y devuelve `badarg` para
  una entrada mal formada, texto de átomo inválido, flotantes no finitos,
  claves de map repetidas e identidades de otro nodo; `safe` solo admite
  átomos existentes, `used` devuelve `{Term, BytesRead}`. CTests:
  `executables_external_terms` (bytes de OTP) y `builtins_etf_fuzz` (las
  codificaciones mutadas se decodifican o lanzan un error).

## Tiempo

Fuente: `erlang/time.cpp`. El tiempo monótono es el reloj estable; `native` y
`perf_counter` son nanosegundos; las unidades son los átomos de OTP (incluidos
los plurales obsoletos) o un entero positivo de partes por segundo.
`convert_time_unit/3` redondea hacia abajo, como OTP. `unique_integer/0,1`
toma valores de un único contador para todo el programa, de modo que todo
valor es positivo, único y creciente sean cuales sean las opciones
(`positive`, `monotonic`; las demás `badarg`). `now/0` es el tiempo del
sistema hecho estrictamente creciente. Las conversiones de calendario leen
`{{Y, M, D}, {H, Mi, S}}` de forma estricta (una fecha u hora inválida es
`badarg`) y usan la zona horaria local de la biblioteca C.

## Información del sistema

Fuente: `erlang/system.cpp`.

- `statistics/1`: `wall_clock` y `runtime` (`{Total, SinceLastCall}` en
  milisegundos), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (porciones de tiempo ejecutadas).
  Clause no lleva contadores de reducciones, de recolección de basura ni de
  E/S: `reductions`, `exact_reductions`, `garbage_collection` e `io` informan
  de ceros.
- `system_info/1`: `otp_release` (`"29"`), `version` (`"17.1"`, el ERTS al que
  sigue Clause), `machine` (`"Clause"`), `system_version`,
  `system_architecture`, `wordsize` y `{wordsize, internal | external}`,
  `process_count`/`process_limit`, `port_count`/`port_limit`,
  `atom_count`/`atom_limit`, `schedulers`, `schedulers_online`,
  `logical_processors*`, `thread_pool_size`, `smp_support`, `threads`,
  `build_type`, `heap_type`, `kernel_poll`, `debug_compiled`,
  `time_correction`, `time_warp_mode`, `endian`, `compat_rel`.
- `memory/0,1`: los tipos de OTP; `processes` es la cuenta de memoria de
  procesos de todo el runtime, `atom` una estimación a partir del número de
  átomos, y `binary`, `code` y `ets` valen 0.
- Los demás elementos son `badarg`.

## Hashing

Fuente: `erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` y `phash/2` calculan el hash de la estructura de un término:
  los términos exactamente iguales tienen el mismo hash en toda ejecución del
  programa (los átomos por su grafía, los maps en orden de claves, `1` y `1.0`
  por separado). `phash2/1` está en 0..2^27-1, `phash2/2` en 0..Range-1,
  `phash/2` en 1..Range; Range es 1..2^32 y, si no, `badarg`. Los valores son
  propios de Clause, no los de OTP.
- `md5/1` y `md5_init/0`, `md5_update/2`, `md5_final/1` dan los resúmenes de
  RFC 1321 (los bytes de OTP) de iodata. El contexto es un binary opaco de 96
  bytes con la disposición propia de Clause; otro binary es `badarg`.

## Carga de código

Fuente: `erlang/code.cpp`. Todo módulo está enlazado en el programa y
permanece cargado; el [step 71](../.agents/11-plan.md#step-71) decide sobre el
código dinámico. `module_loaded/1` es verdadero para un módulo compilado o un
módulo con builtins del runtime (`erlang`, `io`, `os`); `loaded/0` y
`pre_loaded/0` los enumeran todos. `delete_module/1` devuelve `undefined` para
un módulo desconocido y lanza `error:notsup` para uno cargado.
`prepare_loading/2` devuelve `{error, badfile}` (ningún binary es código que el
programa pueda cargar) y `finish_loading/1` solo acepta `[]`.
`get_module_info(M[, Item])` continúa como `M:module_info(...)`.

## Organización del código fuente

- El runtime implementa los builtins en `runtime/src/builtins/`. Un módulo
  grande tiene su propio subdirectorio con una unidad de traducción por familia
  de builtins: el módulo `erlang` vive en `runtime/src/builtins/erlang/`
  (`core`: pruebas de tipo, BIF de guard, operadores, lanzamiento de
  excepciones, `display`, `halt`, `function_exported`; `term_access`; `lists`:
  `length`, `++`, `--`; `conversions`; `processes`: identidades, spawn,
  mensajes, enlaces, monitores, nombres registrados; `ports`; `dictionary`: el
  [diccionario del proceso](processes.md#process-dictionary);
  `binary_conversions` con `conversion_text`, las reglas de texto que comparte
  con `conversions`; `term_encoding` y `term_decoding`: el formato externo de
  términos; `time` y `timers`; `introspection` y `system`; `spawning`;
  `fun_info`, `hashing` y `md5`; `node` y `code`).
- Cada archivo de familia define su propia tabla `*_builtins()`, enumerada en
  `production_builtins()`. Una familia nueva añade un archivo y una tabla
  nuevos en lugar de hacer crecer uno existente; un archivo que supera unas 400
  líneas se divide por familias antes de seguir creciendo. Los módulos grandes
  posteriores siguen la misma regla (`runtime/src/builtins/<module>/`).
- Los módulos pequeños (`io`, `os`) y la infraestructura del puente
  (`registry`, `invocation`, `bridge`, `portions`, `typed`, `text`,
  `float_text`, `output`) permanecen en `runtime/src/builtins/`.
- El compilador nunca lee los fuentes del runtime: el catálogo
  `abi::v1::bridge_builtins` es la única lista que comparten ambas partes.
  Sigue siendo un único array de solo anexado; sus comentarios de grupo nombran
  el archivo que lo implementa.
