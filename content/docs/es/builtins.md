---
source: docs/builtins.md
sourceCommit: 06042fa
sourceSha256: f29dab6160d90187001e7fd8ed997c13236a315dce8c744f9d83072bfdbdaae4
translatedAt: 2026-10-09
---
# Builtins

Plan 11 step 36 (2026-10-07): el puente de producción para builtins. Los
builtins son funciones de `erlang` que el runtime implementa en C++. El runtime
los registra por módulo, función y aridad; el código generado los alcanza
directamente, mediante llamadas dinámicas y como valores fun.

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
- acceso a términos (plan step 37): `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` y los operadores de listas `'++'/2` y
  `'--'/2` (`A ++ B`, `A -- B` se traducen a ellos en el lowering);
- conversiones (plan step 38): `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` no está seleccionada);
- salida por consola (plan step 40): `io:format/1,2` e `io:put_chars/1`, los
  primeros builtins de otro módulo ([io](io.md));
- identidades de procesos (plan step 42): `self/0`, `make_ref/0`,
  `pid_to_list/1` y `ref_to_list/1`
  ([pids y referencias](terms.md#pids-and-references));
- procesos (plan step 43): `spawn/1,3` e `is_process_alive/1`
  ([procesos](processes.md)); enlaces y señales de salida (step 48):
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([enlaces](processes.md#links)); monitores (step 49):
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([monitores](processes.md#monitors)); nombres registrados (step 50):
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([nombres registrados](processes.md#registered-names));
- mensajes (plan step 45): `'!'/2` (el operador `!`) y `send/2`
  ([mensajes](processes.md#messages)).

Las entradas solo se añaden al final: el índice de una entrada es el número que
el código generado pasa al servicio del puente. Una llamada cualificada a un
builtin del catálogo de otro módulo (`io:format(F, A)`) también llama
al puente. Las demás funciones de `erlang` mantienen sus diagnósticos: una
llamada directa a una desconocida es `unknown module erlang`; `fun erlang:F/A`
o `fun F/A` de un BIF de guard fuera del catálogo (`node/0`) y
`fun erlang:apply/2,3` informan de que la capacidad `dynamic calls` no está
disponible.

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

## Porciones

Plan 11 step 43A (2026-10-08): los builtins cuyo trabajo crece con
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

Plan 11 step 41 (2026-10-07): los builtins que comprueban sus
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
