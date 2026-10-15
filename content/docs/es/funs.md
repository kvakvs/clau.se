---
source: docs/funs.md
sourceCommit: 6ed3851c
sourceSha256: d6183dca6e3b3f09dea66c149577541528e02b41b04f721c8d768762926ac676
translatedAt: 2026-10-15
---
# Valores de función

`fun F/A`, `fun M:F/A`, funs anónimos con
variables capturadas (clausuras, closures), funs con nombre
(`fun Name(...) -> ... end`), llamadas a valores de función (`F(Args)`) y
llamadas dinámicas (`M:F(Args)`, `apply/2,3`). Los datos provienen de los
fuentes fijados de `maint-29` (`erts/emulator/beam/utils.c` `erts_cmp`,
`erl_printf_term.c`, `erl_lint`) y de pruebas sobre OTP 29.1.1.

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
  `erlang:is_atom/1`. Los funs de builtins las llaman a través del
  [puente de builtins](builtins.md); un builtin fuera de
  su catálogo (`fun self/0`, `fun erlang:apply/2`) informa de que la capacidad
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
  `M:F/length(Args)` como se ha descrito, de modo que más de 255 argumentos
  lanzan `undef`. Ambas son llamadas de cola en posición de cola y nunca son
  legales en guards.
- `fun M:F/A` con variables lanza `badarg` salvo que `M` y `F` sean átomos y `A`
  un entero en 0..255; la función no necesita existir hasta que se llama al
  fun.
- La búsqueda usa las tablas de exportación de los módulos del programa, que
  permanecen registradas durante toda la vida del programa, de modo que una
  función encontrada no puede desaparecer durante la llamada. Recorre los
  módulos y sus exportaciones comparando palabras de átomo; los índices de tabla
  hash son el plan step 62A. Un nombre que ningún módulo exporta se busca
  después entre las [builtins](builtins.md), de modo que
  `M:F(...)`, `apply/3` y `fun M:F/A` en tiempo de ejecución alcanzan las
  builtins de `erlang` del catálogo del puente.
- **Servicios.** `CLAUSE_call_v1(context, module, function, arity)` comprueba
  los nombres y devuelve el `FrameDescriptor` de la exportación (la revisión 8
  de la ABI lo añade a `ExportDescriptor`); los argumentos ya están en los
  registros. `CLAUSE_apply_list_v1(context, fun, list, registers)` y
  `CLAUSE_call_list_v1(context, module, function, list, registers)` copian
  primero la lista en los registros. Las tres devuelven null tras registrar el
  error, y el código generado transfiere entonces el control a través del
  marcador `clause.apply` como para `F(Args)`. `CLAUSE_make_external_fun_v1`
  construye el fun de una `FunDefinition` externa que el servidor de código crea
  una vez por cada `M:F/A` (`CodeServer::external_fun`).

## Clausuras

- Cada cláusula parte del ámbito en el punto del fun. Las variables de la
  cabecera son nombres nuevos que ocultan a los exteriores (OTP advierte); un
  nombre repetido dentro de una misma cabecera debe encajar. Los guards leen los
  nombres de la cabecera. Nada de lo que vincula un fun es visible después de
  él, y los nombres de las cláusulas case de la función contenedora no llegan a
  su interior.
- Un fun captura toda definición exterior que leen sus cabeceras, guards o
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
  vez. Cuando una cláusula lee `Name`, el código del fun construye el valor a la
  entrada a partir de sus valores capturados, de modo que es igual (`=:=`) al
  fun que se está llamando, y `Name(...)` es una llamada a fun ordinaria: en
  posición de cola es una llamada de cola y se ejecuta con pila constante.
- Un fun anónimo en el valor por defecto de un campo de record es un único fun
  para todas las construcciones que usan ese valor por defecto (OTP expande una
  copia por punto de uso).

## Representación

- **Descriptor.** Cada valor distinto que crea un módulo se compila a un
  `abi::v1::FunDescriptor` en la tabla privada `<prefix>.funs` del módulo
  ([funs.hpp](../abi/include/clause/abi/funs.hpp)): descriptor del módulo,
  slots de átomo del módulo y de la función, aridad Erlang, índice, indicador
  de externo y el `FrameDescriptor` en el que entra una llamada (null para un
  fun externo ajeno al programa). El registro los vincula a `FunDefinition`
  (`ModuleAtoms::funs`, `CodeServer::fun_definition`); el número de valores
  capturados de un fun local es la aridad de su código menos la del fun.
- **Celda.** Tipo encapsulado `fun_closure`: cabecera (recuento `1 + n`), un
  `const FunDefinition *` no rastreado y después `n` valores capturados. El
  recorrido, la recolección, la copia y la verificación omiten la palabra de
  definición, como en los records nativos.
- **Servicios.** `CLAUSE_make_fun_v1(context, descriptor, captures, count,
  output)` construye un fun. `CLAUSE_apply_v1(context, fun, arity, arguments)`
  comprueba un valor llamado, registra los errores anteriores en el canal de
  fallos (`ErrorReason` 22-24) y, en otro caso, añade los valores capturados
  tras los argumentos y devuelve el `FrameDescriptor` en el que entrar.
- **Closures en línea** (ABI 21). El runtime que reclama la caché de átomos de
  un módulo también rellena `ModuleDescriptor::fun_cache` con la dirección de
  la definición de cada fun; mientras la reclamación sea suya, el código
  generado asigna por desplazamiento (bump allocation) la celda del fun
  (cabecera, definición, valores capturados) por sí mismo y llama a
  `CLAUSE_make_fun_v1` solo cuando no hay espacio en el heap o en otro runtime.
  `CLAUSE_apply_v1` y `CLAUSE_apply_list_v1` leen un fun de la aridad correcta
  (y la lista de argumentos) directamente de sus celdas antes de la ruta
  comprobada que informa de los errores.
- **Llamadas.** La forma nativa pasa los argumentos en un array de palabras y
  llama al marcador `clause.apply` con el descriptor; `lower_frames` convierte
  el array en los registros del proceso y el marcador en una transferencia a
  través de `CLAUSE_enter_v1` o, en posición de cola, `CLAUSE_tail_v1`.

## Comparación e impresión

- Orden de términos: número < átomo < fun < tupla < record nativo < map < nil <
  lista < bitstring (las referencias, los puertos y los pids, que en OTP se
  sitúan entre los átomos y las tuplas, aún no existen).
- Los funs locales se ordenan antes que los externos. Los funs locales se
  comparan por módulo, después por índice y luego por los valores capturados en
  orden (`==` los compara con `==`); los externos por módulo, función y aridad.
  Descriptores iguales dan valores iguales, de modo que `fun f/1 =:= fun f/1`.
- `erlang:display/1`, `~w` y los informes de excepciones no capturadas imprimen
  un fun externo como `fun m:f/1` (con los átomos entre comillas como hace el
  emulador) y un fun local como `#Fun<m.Index.0>`.

## Diferencias

Registradas en [diferencias](differences.md):

- Un fun local se imprime `#Fun<m.Index.0>`: el índice de OTP sigue la
  numeración de lambdas de su compilador y su tercera parte es un hash del
  código del módulo. Clause numera los funs locales en orden de código fuente,
  por lo que el orden de dos funs locales de funciones distintas de un módulo
  también puede diferir.
- Llamar a un fun externo de un módulo ajeno al programa lanza `undef`; OTP
  intentaría antes cargar el módulo desde la ruta de código. Lo mismo vale para
  `M:F(Args)` y `apply/3`.
- Una traza de pila de `undef` empieza con el marco del llamador; la de OTP
  empieza con `{M, F, Args, []}` de la función inexistente.
- Los nombres de los funs anónimos (`-f/1-fun-0-`, visibles en las trazas de
  pila) cuentan los funs en orden de código fuente; el compilador de OTP los
  numera en su propio orden. Los funs creados dentro de comprehensions también
  pueden capturar sus valores en un orden distinto al de OTP, lo que solo se
  aprecia al comparar dos de esos funs.

## Información de funs

Fuente: `builtins/erlang/fun_info.cpp`. `erlang:fun_info/1` enumera los
elementos de OTP en el orden de OTP: para un fun local `pid`, `module`,
`new_index`, `new_uniq`, `index`, `uniq`, `name` (`-F/A-fun-N-` para un fun
anónimo), `arity`, `env` (los valores capturados) y `type`; para
`fun M:F/A` `module`, `name`, `arity`, `env` (`[]`) y `type`.
`fun_info/2` devuelve un `{Item, Value}`; un elemento desconocido es `badarg`.
`pid` es `undefined`, `new_uniq` el MD5 del nombre del módulo y `uniq` sus
primeros 24 bits, por lo que difieren de los de OTP. `fun_to_list/1` es el
texto `~w`. `is_builtin/3` es verdadero para los builtins del runtime y para
`erlang:apply/2,3`.
