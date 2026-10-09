---
source: docs/semantic.md
sourceCommit: 06042fa
sourceSha256: 4a59e74a8f74a79a05ce095a1fed17c4ee5fc1249c50e25b2b78fe555376445b
translatedAt: 2026-10-09
---
# Análisis semántico

Se ejecuta después del análisis sintáctico en la compilación predeterminada y
con `--print-types`; las acciones solo sintácticas lo omiten. Los errores
detienen el lote afectado antes de LLVM; los diagnósticos conservan los orígenes
de macros/inclusiones, y las entradas posteriores se siguen diagnosticando.

## Comprobaciones de módulo y de llamadas

- La declaración de módulo es obligatoria y única; aridades de función 0..255;
  sin definiciones duplicadas; cada exportación existe y aparece una sola vez.
  Los nombres entre comillas/Unicode conservan su identidad exacta.
- Se comprueban todas las funciones, incluido el código no usado e inalcanzable.
- Las llamadas se resuelven dentro del lote por módulo/nombre/aridad. Las
  llamadas remotas (incluidas las autocualificadas) requieren exportaciones.
  Los llamados ausentes/privados y los módulos duplicados son errores.
- `fun F/A` debe nombrar una función del módulo (`function F/A undefined`);
  `fun M:F/A` y las llamadas a valores (`F(Args)`) no se resuelven en tiempo de
  compilación ([funs](funs.md)). Cada valor de fun distinto obtiene una entrada
  `Module::funs` tras el análisis de vinculaciones.
- Se aceptan la recursión propia, la mutua y la recursión entre módulos. El
  grafo de llamadas se divide en componentes fuertemente conexas (Tarjan
  iterativo) en orden de llamado antes que llamador; una componente es recursiva
  cuando tiene varios miembros o un miembro se llama a sí mismo.

## Vinculaciones

Cada vinculación tiene una identidad relativa a la función `clause[N].local[M]`.
Las apariciones son definiciones, lecturas o comprobaciones de igualdad exacta,
etiquetadas con el contexto de cabecera/guard/cuerpo. El análisis es
determinista.

- Cada cláusula parte de un entorno vacío. Los candidatos de cabecera recogen
  definiciones provisionales; los guards las leen; el cuerpo solo las ve en caso
  de éxito.
- `_` no vincula nada; `_Name` es una variable ordinaria. Un nombre repetido es
  una restricción de igualdad exacta.
- Las coincidencias en el cuerpo visitan el lado derecho antes que el izquierdo;
  las cadenas van de derecha a izquierda. Un patrón entre paréntesis `P1 = P2`
  es un alias, no una secuencia.
- Las expresiones hermanas leen los mismos nombres entrantes; sus definiciones
  se exportan después de la expresión completa. `{X = 1, X}` es una lectura no
  vinculada; `{X = 4, X = 3}` es legal y falla en tiempo de ejecución.
- Las definiciones en el lado derecho de `andalso`/`orelse` o dentro de
  `catch Expr` no son seguras después (`vtunsafe` de OTP); los nombres
  vinculados antes de un `catch` siguen siendo utilizables. Todo nombre
  vinculado dentro de un `try` no es seguro después; las cláusulas `of` ven los
  nombres del cuerpo, las cláusulas catch los ven como no seguros, y el cuerpo
  de after ve como no seguro todo nombre vinculado antes en el try. La variable
  de pila de una cláusula catch debe ser nueva (`stacktrace_bound` de OTP) y su
  guard no debe leerla (`stacktrace_guard`). Un `maybe` no exporta nada: cada
  `?=` vincula para las expresiones siguientes del cuerpo, las cláusulas `else`
  ven los nombres del cuerpo como no seguros y todo nombre vinculado dentro no
  es seguro después. Los guards nunca publican vinculaciones; las coincidencias
  en guards son errores incluso cuando son inalcanzables.
- Las claves de map solo leen vinculaciones entrantes; los tamaños de binary
  también leen segmentos anteriores del mismo binary (véase
  [patrones](patterns.md#scopes)).
- El escrutinio de un `case` vincula en el ámbito envolvente. Cada cláusula
  parte de ese ámbito; las definiciones de su patrón son provisionales hasta el
  guard, que solo lee. Los nombres vinculados por todas las cláusulas se
  exportan con una única identidad (las cláusulas posteriores reutilizan la
  identidad que una cláusula anterior dio al nombre); los nombres vinculados
  solo por algunas cláusulas, o no seguros en alguna, no son seguros después.
  Las exportaciones se unen de forma conservadora como en `erl_lint` de OTP
  (`icrt_export`); no se emite el aviso de OTP cuando un patrón posterior hace
  coincidir un nombre exportado. Las cláusulas de `if` siguen las mismas reglas
  con un guard y sin patrón.
- `begin`/`end` es una secuencia en el ámbito envolvente.
- Las lecturas no vinculadas, no seguras y de comodines son errores con
  ubicación. Los mensajes conservan la redacción del compilador
  (`unbound variable X`, `unsafe variable X`); el corpus de vinculaciones
  comprueba cada uno frente a la clase `unbound_var`/`unsafe_var` de OTP.
- Una comprehension evalúa cada calificador en orden en el ámbito que dejan los
  anteriores. Los patrones de los generadores vinculan nombres nuevos que ocultan
  a los externos (las lecturas dentro del patrón prefieren los nombres que ya
  vinculó); un grupo zip vincula todos sus patrones a la vez. Las plantillas leen
  como expresiones hermanas. El ámbito después de la comprehension es el de antes
  de ella: allí sus nombres no están vinculados.
- Cada cláusula de un fun anónimo parte del ámbito en el punto del fun: los
  nombres de la cabecera son nuevos y ocultan a los externos, los guards los
  leen, y nada vinculado dentro es visible después del fun. Cada definición
  externa leída dentro se registra como captura (`Function::captures`, en orden
  de definición). El nombre de un fun con nombre es una definición más con la
  que empieza cada cláusula (`Function::fun_names`); nunca se captura. Las
  variables de `fun M:F/A` son lecturas de la expresión fun
  (`Function::fun_operands`).

Los recorridos son iterativos con un presupuesto por módulo de 1,000,000
unidades de trabajo. El agotamiento o cualquier error semántico vacía las tablas
de vinculaciones y de normalización del módulo.

## Tipos y especificaciones

Un grafo de tipos privado representa todas las formas de tipo analizadas
independientemente de la disposición en tiempo de ejecución: singletons, rangos,
contenedores, roles de campos de map, productos de funciones y aplicaciones sin
resolver. Las uniones se aplanan y deduplican; `term()` es el máximo y `none()`
el mínimo. Valores predeterminados: 16,384 nodos, 16 miembros por unión, 100,000
elementos de trabajo por traducción. El agotamiento amplía a `term()` con un
indicador visible y nunca estrecha una representación.

Los metadatos declarados (`-type`, `-opaque`, `-nominal`, `-export_type`,
`-spec`, `-callback`, `-optional_callbacks`) siguen la referencia de typespecs
de OTP y el comportamiento fijado de `erl_lint`/`erl_internal`/`erl_types`:

- Los alias locales pueden ocultar nombres de tipos predefinidos. Los tipos
  remotos del lote deben estar exportados. Los tipos ausentes, los duplicados,
  los metadatos mal formados, las variables de tipo que aparecen una sola vez,
  los límites inválidos y las specs de funciones ausentes son errores. Los tipos
  externos no disponibles generan un aviso y se convierten en `term()`.
- Cada alias o sobrecarga tiene su propio ámbito de variables; los parámetros
  formales repetidos siguen la sustitución por el último argumento de OTP.
- Los alias recursivos siguen siendo referencias con nombre finitas; los cuerpos
  opacos solo se expanden en su módulo; los nombres nominales se conservan en
  todas partes, y solo la comprobación de especificaciones lee la definición de
  un tipo nominal, dentro de su módulo.
- La evaluación de constantes es exacta, limitada a 10,000 dígitos decimales por
  valor.

## Inferencia

La inferencia es independiente de los tipos declarados y nunca confía en las
specs.

- Las entradas exportadas, y las entradas de las funciones que nombra
  `fun F/A`, son términos arbitrarios. Una función a la que solo se entra
  mediante llamadas directas del lote (ni exportada ni nombrada por un fun)
  toma como entradas la unión de los hechos de los argumentos de sus puntos de
  llamada (step 58F, `semantic/types/inference_inputs`), confrontados con los
  patrones de cabecera de cada cláusula; las llamadas recursivas también
  cuentan. Las entradas empiezan en `none()` (una función a la que nada llama
  nunca se ejecuta e infiere `none()`) y crecen a lo largo de pasadas sobre el
  lote: 8 pasadas unen, las posteriores amplían como los resultados
  recursivos; las entradas que no se han estabilizado tras 16 pasadas se
  convierten en `term()` (notificadas como ampliadas).
- Los literales tienen hechos exactos (step 58B):
  los enteros de cualquier tamaño y los caracteres son singletons, los átomos
  átomos singleton, los flotantes `float()`, las cadenas listas no vacías de sus
  caracteres (`[]` para `""`), y `-`/`+` de un número literal conservan su
  hecho. Las tuplas conservan los hechos de sus elementos; los maps construidos
  con claves constantes (el hecho de un único valor: un entero, un átomo, `[]`,
  o una tupla o map de estos) conservan el hecho del valor de cada clave, una
  clave dada dos veces conserva su último valor, y cualquier otra clave produce
  `map()`. La construcción de un bitstring cuenta su tamaño: los caracteres
  literales, con tamaño y codificados en UTF, de forma exacta; un segmento UTF
  de otro valor según su codificación (UTF-8: de 8 a 32 bits por bytes); y un
  segmento `binary`/`bitstring` según el hecho de su valor o cualquier múltiplo
  de su unidad (`<<1, Rest/binary>>` es `nonempty_binary()`). Un operando que
  nunca produce un valor (`none()`) hace que la construcción sea `none()`.
- Los operadores y los builtins (step 58C, `semantic/types/inference_operators`)
  calculan su resultado a partir de los hechos de sus operandos. Los singletons
  enteros se pliegan de forma exacta hasta 4,096 bits por operando y resultado
  (incluidos los bignums; uno mayor es
  `integer()`); los demás enteros usan aritmética de intervalos para `+`, `-`,
  `*` de rangos no negativos, `band` con un operando no negativo (`X band 15`
  es `0..15`), `rem` por un divisor acotado (`X rem 10` es `-9..9`), `bnot`,
  `-` unario y `abs/1`; un operando flotante produce `float()`, uno desconocido
  `number()`, y `/` es siempre `float()`. Las comparaciones se pliegan cuando los
  valores de los operandos solo pueden compararse de una manera (átomos o
  enteros singleton, rangos enteros disjuntos, números frente a no números) y en
  otro caso son `boolean()`; `and`/`or`/`xor`/`not` y `andalso`/`orelse`
  combinan los valores de verdad que pueden tener sus operandos (el operando
  derecho de `andalso` es el resultado cuando el izquierdo es `true`). Una tabla
  da a cada builtin puente su resultado: `pid()` para `self/0` y `spawn/1,3`,
  `reference()`, `port()`, `non_neg_integer()` para los tamaños, `string()`,
  `nonempty_string()`, `binary()`, `list()`, `tuple()`, `atom()`, `boolean()`
  para las pruebas de tipo, `true`/`ok` para los builtins con efectos
  secundarios, el mensaje para `!` y `send/2`; `trunc/1` y similares conservan
  los operandos enteros; los builtins desconocidos son `term()`. Una operación
  que siempre lanza una excepción (`1 + a`, `1 div 0`, `error/1`, `exit/1`,
  `throw/1`, `halt/0,1`) es `none()`, y `erlang:raise/3` solo devuelve
  `badarg`. El plegado nunca cambia el código generado: el desbordamiento y los
  fallos siguen siendo resultados en tiempo de ejecución.
- Un cuerpo cuya expresión nunca se completa (`none()`) es `none()`; también lo
  es una llamada con un argumento así. Los caminos que lanzan excepciones no
  aportan nada a una unión, por lo que una función que siempre lanza infiere
  `none()`.
- Las funciones de identidad/proyección conservan relaciones exactas con los
  argumentos, propagadas a través de llamadas locales y remotas anidadas con
  variables nuevas en cada llamada.
- Contenedores (step 58D, `semantic/types/inference_containers`): una lista
  `[E1, ..., En | T]` une sus elementos delante del hecho de la cola (una lista
  propia cuando la cola lo es, `nonempty_improper_list(H, T)` cuando no es una
  lista, `term()` cuando es desconocida); `++`, `--`, `hd/1`, `tl/1`,
  `element/2`, `setelement/3`, `tuple_to_list/1` y `map_get/2` leen y
  reconstruyen los hechos de los elementos miembro a miembro de una unión, sin
  que aporte nada un miembro que provocaría una excepción. Una actualización de
  map conserva las claves exactas (`:=` de una clave ausente descarta ese
  miembro) y produce `map()` para un map desconocido. Los records de tupla son
  tuplas: la construcción rellena los valores predeterminados (`undefined` si no
  hay ninguno), el acceso y la actualización leen y establecen el campo de las
  tuplas que coinciden, y `#r.f` es el índice del campo. Una comprehension de
  lista es una lista posiblemente vacía de los hechos de sus plantillas, una
  comprehension de binary cualquier número de copias del tamaño de su plantilla,
  una comprehension de map `map()`.
- Funs (step 58E, `semantic/types/inference_funs`): `fun F/A` es un fun de su
  aridad que devuelve el resultado inferido de la función (el de un builtin, o
  con una aridad variable, `fun()`), `fun M:F/A` uno que devuelve `term()`, y un
  fun anónimo uno que devuelve la unión de los resultados de sus cláusulas,
  incluidos los valores capturados. Una llamada a un valor une los resultados
  de sus funs de esa aridad que seleccionan sus argumentos (step 58L; `term()`
  para un fun desconocido, `none()` cuando ningún miembro puede llamarse así).
  Un fun anónimo vinculado entero a una variable y llamado a través de ella se
  evalúa de nuevo para esa llamada con sus patrones confrontados con los
  hechos de los argumentos, hasta 4 llamadas de profundidad, y los hechos de su
  primera evaluación se restauran después
  (`Double = fun(Y) -> Y * 2 end, Double(3)` es 6).
  `apply/2,3` y las llamadas dinámicas siguen siendo `term()`. Como `fun F/A`
  puede nombrar una función inferida más tarde, las pasadas sobre el lote
  también se repiten hasta que cada uno de esos funs haya leído el resultado
  final de su función; en otro caso, una última pasada les da resultados
  `term()`.
- Las asignaciones de valor completo en el cuerpo y los alias copian el hecho
  del lado derecho (`Y = 42, Z = Y, id(Z)` infiere 42); los patrones de tupla,
  lista, map y record de tupla dan a sus variables los hechos de las partes con
  las que coinciden, en las coincidencias del cuerpo, las cláusulas de `case`
  (a partir del escrutinio), las cláusulas `of` de un `try` (a partir del valor
  de su cuerpo) y los generadores (a partir de los elementos de su entrada o de
  las claves y valores del map). Los valores no demostrados siguen siendo
  `term()` sin relaciones.
- Estrechamiento (step 58G, `semantic/types/inference_narrowing`,
  `inference_scopes`, `meet`): dentro de una cláusula de función, `case`,
  `receive` o fun, cada patrón se intersecta con el valor con el que coincide
  (una forma de literal, tupla, lista, record de tupla, map o bitstring; el
  hecho de una variable vinculada), una variable de escrutinio de `case` se
  estrecha con él, y el guard estrecha las variables que prueba. Las pruebas de
  tipo (`is_atom/1` a `atom()`, `is_boolean/1`, `is_integer/1`, `is_float/1`,
  `is_number/1`, `is_binary/1`, `is_bitstring/1`, `is_list/1` a
  `maybe_improper_list()`, `is_tuple/1`, `is_map/1`, `is_function/1,2`,
  `is_pid/1`, `is_port/1`, `is_reference/1`, `is_record/2,3` a la tupla del
  record, `is_map_key/2` su map a `map()`, y los nombres antiguos de guards) se
  intersectan con el hecho de su argumento; las comparaciones con constantes
  enteras (`<`, `=<`, `>`, `>=`, `==`, `=:=`, en cualquier lado, incluidas las
  constantes plegadas) estrechan a un rango un valor ya demostrado entero, y los
  límites de una prueba se acumulan (`10 >= X, X >= 0` es `0..10`); dos enteros
  demostrados que se comparan se estrechan mutuamente por sus límites (`X > Y`
  con `Y` en `0..5` hace que `X` sea al menos 1), y `/=`, `=/=` con una
  constante desplazan hacia dentro un límite de rango igual a ella
  (step 58H1). Un valor que puede ser un flotante u otro término no se
  estrecha. Una conjunción aplica
  cada prueba por turno, una disyunción une lo que demuestra cada alternativa, y
  `not` y las pruebas falsas no demuestran nada. Una cláusula posterior a otra
  cuyos patrones son todos variables simples y cuyo guard completo era una única
  prueba de tipo ve ese valor sin la categoría probada; después de una única
  comparación con una constante entera, el mismo valor (una variable simple de
  esta cláusula) demostrado entero ve la comparación como falsa
  (`f(N) when N >= 0 -> ...;
  f(N) when is_integer(N) -> ...`: la segunda cláusula ve `neg_integer()`). El
  operando derecho de `andalso`, la cláusula `true` de `case Test of` y lo que
  sigue a un filtro de comprehension ven la prueba como verdadera. Una
  intersección vacía hace imposible la cláusula: no aporta nada al resultado.
  Los hechos estrechados solo son válidos dentro de su cláusula u operando;
  `catch`, el operando derecho de `orelse` y cada cláusula restauran los hechos
  anteriores a ellos. Después de un `case`, `if`, `receive`, `try` o `maybe`, el
  hecho de una variable es la unión de sus hechos al final de cada cláusula que
  se completa (step 58H), de modo que `case X of forever -> ...; N when
  is_integer(N), N >= 0 -> ... end` deja `X` como
  `non_neg_integer() | forever`.
- `try` y `maybe` (step 58J1): un `try` es la unión de los valores de sus
  cláusulas `of` (el de su cuerpo si no hay `of`) y de los valores de sus
  cláusulas catch; el cuerpo de `after` no aporta nada. Las cláusulas `of`
  parten de los hechos al final del cuerpo y hacen coincidir su valor como las
  cláusulas de `case` (una cláusula imposible no aporta nada); las cláusulas
  catch y el cuerpo de `after` parten de los hechos anteriores al `try`, y un
  patrón de clase coincide con `error | exit | throw`. Un `maybe` es la unión
  del valor de su cuerpo, de los valores de sus cláusulas `else` y, sin `else`,
  de los valores en los que pueden fallar sus coincidencias `?=`: el hecho del
  valor confrontado sin la forma del patrón cuando el patrón coincide con toda
  su forma (variables nuevas usadas una vez, átomos y enteros literales, `[]`,
  tuplas de estos), y si no el hecho completo. Cada patrón `?=` se intersecta
  con su valor y publica sus variables para el resto del cuerpo; un `?=` que
  nunca puede coincidir detiene el cuerpo. Las cláusulas `else` parten de los
  hechos anteriores al `maybe` y hacen coincidir los valores fallidos unidos como
  las cláusulas de `case`. Los hechos después de un `try` unen los del final de
  su cuerpo (sin `of`) y los de cada cláusula que se completa; después de un
  `maybe`, los del final de su cuerpo, los de cada cláusula `else` que se
  completa y, sin `else`, los anteriores a él.
- Usos (step 58H, `semantic/types/inference_uses`): una operación que lanza una
  excepción salvo que un operando tenga un tipo demuestra ese tipo para la
  variable que leyó, después de que la operación retorne: la aritmética y `-`/`+`
  unarios un `number()`, `div`, `rem`, los operadores de bits y `bnot` un
  `integer()`, `and`/`or`/`xor`, `not` y el operando izquierdo de
  `andalso`/`orelse` un `boolean()`, `++` y `--` un `list()`, un valor llamado
  un fun de esa aridad, un nombre de módulo o de función variable un `atom()`,
  una actualización de map `map()`, un acceso o actualización de record de tupla
  la tupla del record, un segmento de binary su tipo (`<<X:8>>`: `integer()`) y
  su tamaño un `non_neg_integer()`, y una fila por cada comprobación de
  argumento de los builtins puente (`hd/1`, `tl/1`
  `nonempty_maybe_improper_list()`, `length/1` `list()`, `element/2`
  `pos_integer()` y `tuple()`, `map_get/2` e `is_map_key/2` `map()`,
  `atom_to_list/1` `atom()`, ...). La operación conserva su comprobación en
  tiempo de ejecución. Los nombres vinculados al mismo valor (`Y = X`, un patrón
  de `case` variable sobre un escrutinio variable) se estrechan juntos.
- Dominios de entrada y de éxito: el dominio de entrada de cada argumento es la
  unión, sobre las cláusulas de función posibles, de su hecho después de la
  cabecera y el guard (el hecho estrechado de una variable simple, y si no el
  del patrón); su dominio de éxito (step 58H) es la unión, sobre las cláusulas
  que se completan, de su hecho en su retorno normal. `--print-types` muestra el
  dominio de éxito como las entradas (`bounded(1..10) -> 1..10`,
  `inc(X) -> X + 1` como `inc(number()) -> number()`), o el dominio de entrada
  de una función que nunca retorna. Una llamada que retorna estrecha sus
  argumentos variables al dominio del llamado, excepto dentro de una componente
  recursiva que aún se está resolviendo.
- Los resultados de las cláusulas se unen de forma conservadora: una proyección
  solo sobrevive si todas las cláusulas devuelven el mismo argumento. Un `case`
  o `if` une los resultados de sus cláusulas de la misma manera; una vinculación
  definida por varias de sus cláusulas sigue siendo `term()`.
- Tipos de función (step 58K, `semantic/types/function_types`): además del
  resumen de unión anterior, una función conserva un tipo de función por cada
  cláusula posible, como las sobrecargas de un `-spec`: los hechos de los
  argumentos después de la cabecera y el guard (el hecho estrechado de una
  variable simple, y si no el del patrón) y el resultado de la cláusula
  (`none()` para una cláusula que siempre lanza una excepción; las cláusulas
  imposibles no aportan ninguno). Una cláusula cuyo cuerpo termina en un `case`
  o `if` se divide en un tipo de función por cada rama posible, con los hechos
  de los argumentos después del patrón y el guard de esa rama y el resultado de
  la rama (un nivel: un `case` anidado no se divide más). Los tipos de función
  con entradas iguales se fusionan (sus resultados se unen); a partir de 8, los
  últimos se fusionan en uno, con entradas y resultados unidos. Las componentes
  recursivas los iteran junto con los resultados, y en cada ronda se une (y
  después se amplía) el resultado de cada tipo; una componente que no converge
  conserva solo sus resúmenes de unión. El hecho de un fun anónimo conserva un
  tipo de función por cada cláusula posible (sus patrones y su guard sobre
  cualquier argumento), `fun F/A` los tipos de función de `F/A`; los funs que se
  unen conservan sus tipos de función solo cuando son iguales, y en otro caso se
  unen como un único fun de sus resultados unidos con entradas cualesquiera
  (intersectar con un fun de entradas cualesquiera, como hace el uso `F(A)`, los
  conserva). La especialización, los dominios y las comprobaciones de
  especificaciones leen el resumen de unión.
- Las llamadas seleccionan tipos de función (step 58L): una llamada a una
  función con tipos de función lee, en orden, cada tipo cuyas entradas
  intersecta cada hecho de argumento, y se detiene después de uno exacto
  (patrones de variables nuevas usadas una vez, átomos y enteros literales,
  `[]` y tuplas de estos; sin guard o solo `true` y pruebas de tipo de
  variables de argumento simples; para una rama, un argumento como escrutinio
  del `case`) cuyas entradas contienen los argumentos: no se puede entrar en
  ninguna cláusula posterior. Su resultado es la unión de los resultados de los
  tipos seleccionados, y un resultado igual a un argumento es el hecho de ese
  argumento dentro del resultado del tipo; si no se selecciona ninguno, la
  llamada es `none()` (solo puede lanzar `function_clause`). Los argumentos
  desconocidos seleccionan todos los tipos, la unión; una función sin tipos de
  función (presupuesto, componente no convergida) usa su resumen de unión.
  Después de que una llamada retorne, sus argumentos variables se estrechan al
  dominio de éxito y a las entradas unidas de los tipos seleccionados.
  Las llamadas a valores fun seleccionan de la misma manera los tipos de
  función del hecho del fun, y un fun anónimo evaluado de nuevo para una llamada
  (véase Funs) entra en sus cláusulas, aplica sus guards y sale de ellas como un
  `case`, de modo que una cláusula con la que sus argumentos no pueden coincidir
  no aporta nada (`F = fun(1) -> one; (_) -> other end, F(2)` es
  `other`). Las componentes recursivas convergen en resultados y tipos de
  función.
- Las llamadas evalúan de nuevo a su llamado (step 58M): cuando los hechos de
  los argumentos de una llamada están dentro de las entradas del llamado y son
  más estrechos en alguna, el cuerpo del llamado se evalúa de nuevo con ellos
  como entradas, como un fun anónimo vinculado, y el resultado de la llamada es
  el resultado de los tipos de función seleccionados intersectado con el de esa
  evaluación (`two_callers() -> {add_one(10), add_one(20)}` es
  `{11, 21}`); los argumentos de la llamada también se estrechan al dominio de
  éxito de esa evaluación. El resumen del llamado, sus tipos de función y los
  hechos de expresión registrados nunca cambian (la especialización solo lee
  estos). Presupuestos: 4 evaluaciones anidadas, llamados de como máximo 256
  expresiones, 4,096 unidades de trabajo por llamada de una reserva de 262,144
  por pasada sobre el lote (independiente del presupuesto propio del lote); las
  componentes recursivas nunca se evalúan de nuevo. Superado un presupuesto, la
  llamada conserva el resultado de los tipos de función seleccionados.
- Un `receive` es la unión de sus cláusulas y de su cuerpo de `after`, que un
  timeout de `infinity` nunca ejecuta.
- Una componente recursiva empieza el resultado de cada miembro en `none()` y
  vuelve a inferir todos los miembros hasta que ningún resultado cambia; cada
  ronda une el nuevo resultado con el anterior (lo amplía después de las
  primeras 8 rondas, [dominio de inferencia](#inference-domain)), y una llamada
  recursiva pendiente no aporta nada a una unión. Una función que nunca puede
  retornar sigue siendo `none()`. Una componente que no ha convergido después de
  8 rondas más 4 por miembro amplía cada miembro a `term()` (notificado como
  ampliado, igual que el agotamiento del presupuesto) y una ronda final vuelve a
  calcular los hechos de expresión; los hechos de expresión de las rondas
  anteriores se descartan, por lo que solo quedan los hechos de las suposiciones
  finales.
- Un presupuesto de trabajo compartido acota la inferencia; el agotamiento
  pierde precisión y recurre a código genérico, nunca rechaza un programa.
- Las especificaciones que contradicen la inferencia son errores (step 58I,
  `semantic/types/contracts`). Un tipo declarado se convierte en los hechos que
  contiene (o más): los tipos predefinidos por nombre (`byte()` es `0..255`,
  `timeout()` es `non_neg_integer() | infinity`, `iodata()` e `iolist()` listas
  de cualquier forma), los alias por su definición, los tipos opacos y
  nominales por su definición dentro de su módulo y como cualquier término fuera
  de él, los tipos remotos a través del lote, las variables de tipo a través de
  sus límites `when` (una sin restricciones es cualquier término), los maps y
  los records por su categoría. Una especificación contradice el código cuando
  sus hechos no comparten ningún valor con lo que demuestra la inferencia: el
  resultado inferido (salvo que sea desconocido, o `none()`: una función que
  nunca retorna encaja con cualquier resultado), el dominio de entrada de un
  argumento, o los hechos de los argumentos de una llamada frente a todas las
  sobrecargas. `none()`/`no_return()` solo admite una función que nunca retorna.
  El error nombra la función, el tipo declarado tal como se escribió y el
  inferido. Como los hechos inferidos pueden contener más valores de los que
  produce el código, solo un par disjunto es una contradicción: se acepta un
  tipo declarado más estrecho que el inferido. Las especificaciones `-callback`
  no se comprueban. El compilador de OTP no comprueba las especificaciones
  ([diferencias](differences.md#language-edge-cases)).

### Dominio de inferencia

Decisión del plan 11 step 58A (`semantic/types/lattice`). Un hecho es un
conjunto de valores que puede tener una variable o un resultado. Los hechos se
unen donde confluye el flujo de control (cláusulas, ramas) y se amplían entre
las rondas de una componente recursiva; cada presupuesto que sigue amplía de
forma correcta a un conjunto mayor, y nunca rechaza un programa. Los hechos se
imprimen como tipos de Erlang, y las categorías por sus nombres predefinidos.

| Hecho | Impresión | Unión | Presupuesto y ampliación |
| --- | --- | --- | --- |
| Nada | `none()` | Identidad | Una función que nunca retorna sigue siendo `none()` |
| Cualquier cosa | `term()` | Absorbe cualquier hecho | `dynamic()` y `any()` son `term()` |
| Enteros | `42`, `1 \| 3 \| 7` | Unión de singletons | Más de 8 singletons se convierten en su rango |
| Rango de enteros | `1..10`, `0..255` | El menor rango que contiene ambos | Un límite que se movió entre rondas pasa al siguiente umbral: uno inferior a 1, después 0, después sin límite; uno superior a -1, después sin límite |
| Enteros sin límite | `pos_integer()` (1 en adelante), `non_neg_integer()` (0 en adelante), `neg_integer()` (-1 hacia abajo), `integer()` | El menor intervalo que contiene ambos, impreso por su categoría | — |
| Flotantes | `float()` | — | — |
| Números | `number()` | Un rango o categoría de enteros unido con `float()` | Los enteros singleton con `float()` se quedan como `1 \| float()` |
| Átomos | `ok`, `error \| ok`, `boolean()` | Unión de singletons; exactamente `false` y `true` se imprimen como `boolean()` | Más de 8 singletons se convierten en `atom()` |
| Identificadores | `pid()`, `port()`, `reference()` | — | — |
| Tuplas | `{ok, 1}`, `tuple()`, `#point{x :: 0, y :: _}` | Las tuplas del mismo tamaño cuyos primeros elementos no son dos átomos distintos (su etiqueta) se unen elemento a elemento; las demás quedan como miembros separados | Más de 16 elementos se convierten en `tuple()` salvo que se conozcan todos los elementos; más de 8 formas separadas se convierten en `tuple()`. Una tupla con el nombre y el tamaño de un record de tupla visible se imprime como el record (step 58J) |
| Listas | `[]`, `[T]`, `[T, ...]`, `nonempty_improper_list(H, T)`, `[1, a]`, `[a, b \| T]` | Los elementos se unen; `[]` con una lista no vacía da una posiblemente vacía; las listas impropias unen cabezas y colas. Las listas de dos o más elementos conocidos conservan sus posiciones (step 58J; una notación de Clause, el lenguaje de tipos no tiene ninguna, con los elementos impresos con `\|` entre paréntesis): las listas posicionales de una misma longitud se unen posición a posición, y en otro caso se unen como listas simples | Una lista de `0..1114111` (`char()`) se imprime `string()` o `nonempty_string()`; una lista posiblemente vacía de `_` se imprime `list()` |
| Maps | `#{}`, `#{a := 1}`, `#{1..17 => a}`, `map()` | Los maps con las mismas claves se unen valor a valor; los maps de otras claves se unen en una única asociación de sus claves y valores unidos (`=>`: cualquier clave puede faltar, step 58J) | Más de 16 claves se unen en una única asociación |
| Funs | `fun((term()) -> 1)`, `fun()` | Los funs de una misma aridad unen sus resultados; otras aridades dan `fun()` | — |
| Bitstrings | `<<_:16>>`, `<<_:3, _:_*2>>`, `binary()` | El tamaño menor más cada diferencia de tamaños como unidad | Base y unidad 0/8, 8/8, 0/1, 1/1 se imprimen `binary()`, `nonempty_binary()`, `bitstring()`, `nonempty_bitstring()` |

- Una unión conserva un miembro por cada forma unida, en el orden de términos de
  Erlang de sus valores: números, átomos, `reference()`, funs, `port()`,
  `pid()`, tuplas, maps, `[]`, listas, bitstrings, y después los tipos con
  nombre declarados; más de 8 miembros se convierten en `term()`.
- Los contenedores se anidan como máximo 4 niveles; un hecho más profundo se
  convierte en `term()`.
- Una componente recursiva une los resultados durante 8 rondas (los ciclos de
  hasta 8 funciones convergen de forma exacta), y después los amplía. Una
  componente que no ha convergido después de 4 rondas más por miembro amplía
  cada miembro a `term()` y se notifica como ampliada, igual que un presupuesto
  agotado.
- El estrechamiento (plan steps 58G, 58H, `Lattice::meet`) es la intersección
  de los hechos, los valores que contienen ambos (o más, pero `none()` solo
  cuando no comparten ninguno): los patrones y los guards (las pruebas de tipo
  como `is_integer/1` estrechan su argumento a la categoría) estrechan dentro de
  su cláusula y establecen el dominio de entrada de una función; un uso que
  lanza una excepción salvo que su operando tenga un tipo estrecha el operando
  después de él en el camino normal. Una intersección vacía significa que el
  camino no puede ejecutarse.
- Las especificaciones nunca añaden nada a los hechos: los hechos inferidos
  provienen solo del código y nunca deciden una representación basándose en lo
  que dice una spec.

El lowering consume estos hechos. El IR generado nunca convierte un
entero en un puntero al heap; el resultado de cada servicio que puede fallar se
carga solo en su camino de éxito, y las comprobaciones de forma dominan la
extracción. Política de especialización:
[specialization.md](specialization.md).

## `--print-types`

Imprime cada módulo del lote (en orden de entrada/objetivo, con los módulos de
biblioteca después) como código fuente Erlang
([impresión de código fuente](compile.md#source-printing)) junto con lo que
encontró la inferencia de tipos. La salida va a stdout y es legible por
personas; no es Erlang ni un formato de intercambio. Los avisos permanecen en
stderr.

```erlang
%% module "branches" source="branches.erl" target="" declared=complete inferred=complete
-module(branches).
-export([mixed/1]).

%% inferred: mixed(_) -> 1..2
mixed(X) ->
    case X of
        1 ->
            1;
        _ ->
            2
    end :: 1..2.
```

- Una línea `%% module` nombra el módulo, su código fuente, el objetivo del
  proyecto y si los tipos declarados e inferidos se completaron o fueron
  ampliados por un límite.
- Las declaraciones (`-type`, `-spec`, `-callback`, records) aparecen tal como
  se escribieron.
- Encima de cada función, `%% declared: f(Inputs) -> Result` da cada sobrecarga
  de su `-spec` tal como se resolvió (con sus restricciones `when`), y
  `%% inferred: f(Inputs) -> Result` lo que encontró la inferencia, para poder
  comparar ambos. Las entradas son el dominio de éxito de cada argumento (a
  partir de `term()` para las funciones exportadas y las que nombra `fun F/A`, y
  a partir de los argumentos unidos de los llamadores para las demás
  funciones). Una función con varios tipos de función imprime una firma por
  tipo, cada una con sus propias entradas:
  `f(integer()) -> integer(); (atom()) -> string()`
  (`semantic::types::function_source`). Un `-spec` se queda junto a la función
  que lo sigue, separado de las demás formas por una línea en blanco.
- Las expresiones cuyo hecho dice más que `term()` se anotan
  `Expression :: Type` (un tipo conocido oculta una relación con un argumento,
  que solo se muestra para un valor del que no se sabe nada más): entre
  paréntesis dentro de otras expresiones, y sin ellos
  para una expresión de cuerpo completa. Los términos literales (literales, y
  tuplas, listas, maps construidos y bitstrings de literales) y las
  coincidencias no se anotan (el lado derecho de una coincidencia sí).
- Un valor que la inferencia demostró igual a uno de los argumentos de la
  función, y del que no se sabe nada más, se imprime como el nombre de ese
  argumento, una variable de tipo: la variable que le da la primera cláusula que
  vincula el argumento completo, y si no `_argumentN` (empezando en 1, también
  cuando un argumento anterior tomó el nombre). La entrada del argumento muestra
  el mismo nombre cuando es cualquier término:
  `second(_, Y) -> Y`, `keep(Acc, number()) -> Acc`. Una variable muestra solo
  su tipo; su nombre ya indica de qué argumento se trata.

### Expectativas de inferencia

`tests/fixtures/inference/*.erl` registran lo que la inferencia debería
encontrar para cada función, y lo que encuentra hoy. Cada módulo se convierte en
el CTest `inference_<module>` (`tests/compiler/inference/expectations.py`):

```erlang
%% expect: sum() -> 3
%% today: sum() -> _
sum() -> 1 + 2.
```

- `expect:` es la firma que `--print-types` debería imprimir en su línea
  `%% inferred:`; `today:`, presente mientras la inferencia se quede corta, es
  la que imprime ahora.
- La comprobación compara la salida con `today` cuando existe, y si no con
  `expect`; cada función del módulo necesita una línea `expect`. Una línea
  `today` a la que la inferencia ya ha alcanzado hace fallar la comprobación
  hasta que se elimina.
- `expectations.py <clau> <fixture> --record` reescribe las líneas `today` a
  partir de la salida actual (una acción de mantenimiento: revisar el diff).
- `values.erl` cubre literales, aritmética y comparaciones, llamadas a
  funciones locales y de otro tipo, uniones y rangos de enteros, enteros o
  flotantes, listas, cadenas, tuplas, maps con claves de átomo y de otro tipo,
  funs devueltos y aplicados, binaries, relaciones con argumentos y valores de
  `try`/`maybe`. Hoy la inferencia encuentra valores literales y construidos,
  resultados de operadores y builtins, contenedores y sus partes, funs y sus
  llamadas, entradas locales a partir de los llamadores, uniones de enteros y
  relaciones con argumentos, estrechamiento por usos y dominios de éxito (141 de
  141 funciones).
- `narrowing.erl` cubre cada prueba de tipo, guards de case, escrutinios de
  prueba verdadera, `andalso`, filtros de comprehension, patrones de
  tupla/lista/map, cláusulas comodín, guards de rango, contradicciones,
  disyunciones, la cláusula posterior a una única prueba de tipo, el
  estrechamiento después de una llamada, estrechamientos que no deben filtrarse,
  y rangos de comparación: cada operador en cualquier lado, dos variables, `=/=`
  en un límite y dentro de él, complementos, guards de case e if, un `orelse`,
  una cuenta atrás con guard, y operandos que no deben estrecharse (51 de 51).
- `base_types.erl` tiene una función por cada tipo base y predefinido del
  [lenguaje de tipos](https://www.erlang.org/doc/system/typespec.html)
  (`pid()`, `reference()`, bitstrings y binaries, rangos, `byte()`, `char()`,
  `non_neg_integer()`, `boolean()`, `string()`, `iolist()`, `mfa()`,
  `timeout()`, `no_return()`, ...): su `-spec` nombra el tipo, de modo que se
  comprueba que cada tipo predefinido se resuelve, y su cuerpo produce un valor
  de ese tipo. Las categorías se esperan con sus nombres predefinidos, y los
  conjuntos de enteros acotados como rangos. Todas las funciones alcanzan su
  tipo esperado.
- `clauses.erl` cubre los tipos de función (step 58K): pruebas de tipo y
  patrones literales por cláusula, entradas iguales fusionadas, una cláusula en
  la que los llamadores nunca entran, más cláusulas que el presupuesto, una
  función recursiva, una única cláusula, un `case` y un `if` que terminan el
  cuerpo, un `case` anidado y un `case` que no es el último, funs anónimos de
  varias cláusulas, `fun F/A`, uniones de funs iguales y de funs distintos, y
  una cláusula que siempre lanza una excepción; la selección de llamadas (step
  58L): una prueba de tipo, una primera rama exacta, argumentos desconocidos,
  ningún tipo admitido, estrechamiento después de la llamada, un argumento
  literal, un rango sobre dos cláusulas, llamadas anidadas, una función local
  con varios llamadores, un llamado recursivo, y funs de varias cláusulas
  vinculados, en una tupla, pasados a una función local y llamados con un
  argumento desconocido; y la evaluación por llamada (step 58M): resultados por
  llamada, anidamiento hasta el presupuesto de profundidad y más allá, un
  llamado que supera el presupuesto de tamaño, un llamado recursivo y
  argumentos desconocidos.

### Impresión de tipos

`semantic::types::type_source(graph, type)` (`semantic/types/printing`)
representa un tipo del grafo de tipos en la sintaxis de tipos de Erlang: `_`
para cualquier término (`term()`, escrito por `TERM_SOURCE` por brevedad; la
sintaxis de tipos lee `_` como `any()`), `none()`, átomos y
enteros, `1..5`, `{ok, T}`, `tuple()`, `[T]`, `[T, ...]`, `#{K => V, K := V}`,
`#r{f :: T}`, `<<_:B, _:_*U>>`, `fun((A) -> R)`, `A | B`. Un fun con varios
tipos de función los imprime en una notación de Clause, `fun((1) -> one; (_) ->
other)`: la sintaxis de tipos de Erlang no tiene un tipo fun sobrecargado, y una
unión de tipos fun significa otra cosa. Los enteros de una unión
se imprimen en orden de valor donde está su primer entero, y los consecutivos
como un rango (`1 | 2 | 3 | 5` se imprime `1..3 | 5`; el hecho conserva los
singletons).
Los tipos predefinidos de `erlang`
omiten su módulo; las referencias a tipos declarados conservan su nombre. Un
presupuesto de nodos acota el texto; al superarlo, y por debajo de 32 niveles de
anidamiento, aparece `...` en su lugar.

```sh
clau --print-types answer.erl client.erl
clau --print-types --project project.toml --target demo --verbose
```
