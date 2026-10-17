---
source: docs/funs.md
sourceCommit: a8c3f8f6
sourceSha256: 114573ca575f133c3b45d3422218a8b98264b55c30167b405bb3008e3806c74e
translatedAt: 2026-10-17
---
# Valores de función

`fun F/A`, `fun M:F/A`, funs anónimos con variables capturadas (clausuras,
closures), funs con nombre (`fun Name(...) -> ... end`), llamadas a valores de
función (`F(Args)`) y llamadas dinámicas (`M:F(Args)`, `apply/2,3`). Los datos
provienen de los fuentes fijados de `maint-29` (`erts/emulator/beam/utils.c`
`erts_cmp`, `erl_printf_term.c`, `erl_lint`) y de pruebas sobre OTP 29.1.1.

## Valores

| Código fuente | Valor | Las llamadas entran en |
| --- | --- | --- |
| `fun f/1` | Fun local de este módulo; todo `fun f/1` de un módulo es el mismo valor | `f/1` de este módulo, exportada o no |
| `fun m:f/1` | Fun externo que designa `m:f/1`, también para el módulo actual | `m:f/1` cuando un módulo del programa la exporta |
| `fun(X) -> ... end` | Fun local que captura las variables que lee de su creador; cada evaluación construye un valor nuevo | La función generada propia del fun |
| `fun Name(X) -> ... end` | Lo mismo, con `Name` vinculado al fun dentro de sus cláusulas | La función generada propia del fun |
| `fun M:F/A` con variables | Fun externo construido al evaluarse; igual al `fun m:f/1` literal que designa | `m:f/1` cuando un módulo del programa la exporta |

- `fun F/A` debe designar una función del módulo (`function F/A undefined`) o
  un builtin autoimportado: `fun is_atom/1` es el fun externo
  `erlang:is_atom/1`. Los funs de builtins los llaman a través del
  [puente de builtins](builtins.md); un `fun erlang:F/A` literal de una función
  fuera del catálogo (`fun erlang:apply/2`) informa de que la capacidad
  `dynamic calls` no está disponible.
- `F(Args)` evalúa `F`, después los argumentos de izquierda a derecha, y luego
  comprueba el valor: algo que no es una función lanza `{badfun, F}`, otra
  aridad `{badarity, {F, Args}}` (comprobado antes que el módulo), un fun
  externo cuya función no exporta nada del programa `undef`. Una llamada en
  posición de cola es una llamada de cola, como en las funciones con nombre.
- `is_function/1,2` son verdaderas para los funs en cuerpos y guards.

## Llamadas dinámicas

- `M:F(Args)` con una variable (o cualquier expresión) como módulo o función
  evalúa el módulo, después la función y luego los argumentos de izquierda a
  derecha. Un módulo o una función que no son átomos lanzan `badarg`; una
  función que ningún módulo del programa exporta con esa aridad lanza `undef`.
  Una llamada en posición de cola es una llamada de cola.
- `apply(Fun, Args)` y `apply(M, F, Args)` (autoimportadas salvo que el módulo
  defina `apply/2,3` o suprima la importación; también `erlang:apply/2,3`)
  evalúan sus argumentos y después exigen que `Args` sea una lista propia
  (`badarg`). A continuación `apply/2` llama a `Fun` como lo hace `F(Args)`
  (`{badfun, Fun}`, `{badarity, {Fun, Args}}`); `apply/3` busca
  `M:F/length(Args)` como se describe arriba, por lo que más de 255 argumentos
  lanzan `undef`. Ambas son llamadas de cola en posición de cola y nunca son
  legales en guards.
- `fun M:F/A` con variables lanza `badarg` salvo que `M` y `F` sean átomos y
  `A` sea un entero en 0..255; la función no necesita existir hasta que se llama
  al fun.
- La búsqueda usa los índices hash del servidor de código sobre las
  exportaciones del programa ([runtime](runtime.md#code-server-and-builtins)),
  que permanecen registradas durante toda la vida del programa, de modo que una
  función encontrada no puede desaparecer durante la llamada. Un nombre que
  ningún módulo exporta se busca después entre los [builtins](builtins.md), de
  modo que `M:F(...)`, `apply/3` y `fun M:F/A` en tiempo de ejecución llegan a
  los builtins del catálogo del puente.
- **Servicios.** `CLAUSE_call_v1(context, module, function, arity)` comprueba
  los nombres y devuelve el `FrameDescriptor` de la exportación (a partir de su
  `ExportDescriptor`); los argumentos ya están en los registros.
  `CLAUSE_apply_list_v1(context, fun, list, registers)` y
  `CLAUSE_call_list_v1(context, module, function, list, registers)` copian
  primero la lista en los registros. Los tres devuelven null tras registrar el
  error, y el código generado transfiere entonces a través del marcador
  `clause.apply` como para `F(Args)`. `CLAUSE_make_external_fun_v1` construye el
  fun de una `FunDefinition` externa que el servidor de código crea una sola vez
  por `M:F/A` (`CodeServer::external_fun`).

## Clausuras

- Cada cláusula parte del ámbito en el que está el fun. Las variables de la
  cabecera son nombres nuevos que ocultan a los exteriores (OTP advierte); un
  nombre repetido dentro de una misma cabecera debe coincidir. Los guards leen
  los nombres de la cabecera. Nada de lo que vincula un fun es visible después
  de él, y los nombres de las cláusulas case de la función envolvente no llegan
  a su interior.
- Un fun captura cada definición exterior que leen sus cabeceras, guards o
  cuerpos (incluidos los funs anidados), en orden de definición, igual que OTP
  ordena las variables libres de una función. Los valores capturados se copian
  en la celda del fun cuando se evalúa la expresión fun, de modo que sobreviven
  al retorno del creador y a las recolecciones, y se copian con el fun.
- El código es una función privada `-f/A-fun-N-` (N cuenta los funs de `f/A` en
  orden de código fuente) que toma los argumentos del fun y después sus valores
  capturados; las trazas de pila muestran ese nombre con la aridad combinada,
  como las de OTP. Si ninguna cláusula encaja, se lanza `function_clause`.
- Los argumentos más los valores capturados están limitados a 255.
- Las cláusulas de un fun con nombre ven `Name` como el propio fun: un nombre
  nuevo que oculta a uno exterior (OTP advierte), nunca capturado y no visible
  después del fun. Una variable de cabecera con el mismo nombre lo oculta a su
  vez. Cuando una cláusula lee `Name`, el código del fun construye el valor al
  entrar a partir de sus valores capturados, de modo que es igual (`=:=`) al fun
  que se está llamando, y `Name(...)` es una llamada a fun ordinaria: en
  posición de cola es una llamada de cola y se ejecuta con pila constante.
- Un fun anónimo en el valor por defecto de un campo de record es un único fun
  para cada construcción que usa el valor por defecto (OTP expande una copia
  por punto de uso).

## Representación

- **Descriptor.** Cada valor distinto que crea un módulo se compila a un
  `abi::v1::FunDescriptor` en la tabla privada `<prefix>.funs` del módulo
  ([funs.hpp](../abi/include/clause/abi/funs.hpp)): descriptor del módulo,
  ranuras de átomo del módulo y de la función, aridad Erlang, índice, indicador
  de externo y el `FrameDescriptor` en el que entra una llamada (null para un
  fun externo ajeno al programa). El registro los vincula a `FunDefinition`
  (`ModuleAtoms::funs`, `CodeServer::fun_definition`); el número de valores
  capturados de un fun local es la aridad de su código menos la del fun.
- **Celda.** Tipo en caja `fun_closure`: cabecera (recuento `1 + n`), un
  `const FunDefinition *` no rastreado y después `n` valores capturados. El
  recorrido, la recolección, la copia y la verificación omiten la palabra de la
  definición, como en los native records.
- **Servicios.** `CLAUSE_make_fun_v1(context, descriptor, captures, count,
  output)` construye un fun. `CLAUSE_apply_v1(context, fun, arity, arguments)`
  comprueba un valor llamado, registra los errores anteriores en el canal de
  fallos (`ErrorReason` 22-24) y, en caso contrario, añade los valores
  capturados después de los argumentos y devuelve el `FrameDescriptor` en el
  que entrar.
- **Clausuras en línea.** El runtime que reclama la caché de átomos de un
  módulo también rellena `ModuleDescriptor::fun_cache` con la dirección de la
  definición de cada fun; mientras la reclamación sea suya, el código generado
  asigna él mismo la celda del fun por incremento de puntero (cabecera,
  definición, valores capturados) y solo llama a `CLAUSE_make_fun_v1` cuando no
  hay espacio en el heap o en otro runtime. `CLAUSE_apply_v1` y
  `CLAUSE_apply_list_v1` leen un fun de la aridad correcta (y la lista de
  argumentos) directamente de sus celdas antes de la ruta comprobada que informa
  de los errores.
- **Llamadas.** La forma nativa pasa los argumentos en un array de palabras y
  llama al marcador `clause.apply` con el descriptor; `lower_frames` convierte el
  array en los registros del proceso y el marcador en una entrada o, en posición
  de cola, en una transferencia de cola
  ([modelo de ejecución](execution-model.md#implementation)).

## Comparación e impresión

- Los funs se ordenan después de las referencias y antes de los puertos
  ([orden de términos](terms.md#comparison-and-order)).
- Los funs locales se ordenan antes que los funs externos. Los funs locales se
  comparan por módulo, después por índice y después por los valores capturados
  en orden (`==` los compara con `==`); los funs externos por módulo, función y
  aridad. Descriptores iguales dan valores iguales, de modo que
  `fun f/1 =:= fun f/1`.
- `erlang:display/1`, `~w` y los informes de excepciones no capturadas imprimen
  un fun externo como `fun m:f/1` (con los átomos entre comillas como hace el
  emulador) y un fun local como `#Fun<m.Index.0>`.

## Diferencias

La numeración, la impresión y el orden de los funs, el orden de captura en las
comprehensions, las trazas de pila de `undef` y las llamadas a módulos ajenos al
programa difieren de OTP tal como se recoge en [diferencias](differences.md).

## Información de funs

`runtime/src/builtins/erlang/fun_info.cpp`. `erlang:fun_info/1` enumera los
elementos de OTP en el orden de OTP: para un fun local `pid`, `module`,
`new_index`, `new_uniq`, `index`, `uniq`, `name` (`-F/A-fun-N-` para un fun
anónimo), `arity`, `env` (los valores capturados) y `type`; para
`fun M:F/A` `module`, `name`, `arity`, `env` (`[]`) y `type`. `fun_info/2`
devuelve un `{Item, Value}`; un elemento desconocido es `badarg`. `pid` es
`undefined`, `new_uniq` el MD5 del nombre del módulo y `uniq` sus primeros 24
bits, por lo que difieren de los de OTP. `fun_to_list/1` es el texto de `~w`.
`is_builtin/3` es verdadero para los builtins del runtime y
`erlang:apply/2,3`.
