---
source: docs/patterns.md
sourceCommit: 6ed3851c
sourceSha256: ef7903895b7901a6980a3cd181783486ae8672876229d35fae120e802392e989
translatedAt: 2026-10-15
---
# Patrones, cláusulas y encajes en el cuerpo

Las cabeceras de cláusulas de función, los encajes (matches) en el cuerpo, las
cláusulas de `case` y los guards de `if` son ejecutables para todos los tipos de
término admitidos ([términos](terms.md)). La legalidad y la disponibilidad se
comprueban por separado: el Erlang inválido es un error **semántico** incluso
en código inalcanzable; el código legal que necesita una funcionalidad ausente
recibe un diagnóstico de **capacidad**; un **desajuste** en tiempo de ejecución
nunca es un error del compilador.

| Contexto | Estado |
| --- | --- |
| Cabeceras de función + guards | Implementado; el agotamiento lanza `error:function_clause` |
| Encajes y secuencias en el cuerpo, `begin`/`end` | Implementado; el fallo lanza `error:{badmatch, RHS}` |
| Cláusulas de `case` + guards | Implementado; el agotamiento lanza `error:{case_clause, Value}` |
| Cláusulas de guard de `if` | Implementado; el agotamiento lanza `error:if_clause` |
| `maybe` con `?=` y cláusulas `else` | Implementado; un `?=` fallido produce su valor o selecciona una cláusula `else`, cuyo agotamiento lanza `error:{else_clause, Value}`; necesita la funcionalidad `maybe_expr` ([preprocesador](preprocessor.md)) |
| Comprehensions de listas, binaries y maps | Implementado ([más abajo](#comprehensions)) |
| `catch Expr` | Implementado; sin patrones ([ABI](abi.md#failure-channel-revision-2)) |
| Cláusulas `of` y catch de `try` | Implementado; el agotamiento de `of` lanza `error:{try_clause, Value}`, las excepciones no encajadas se relanzan y `after` se ejecuta en todos los caminos ([ABI](abi.md#failure-channel-revision-2)); `Class:Reason:Stack` vincula la [traza de pila](abi.md#stack-traces) |
| Cláusulas de fun | Capacidad (F18) |
| `receive` | Capacidad (F22/F25) |

## Comprehensions

`[T1, ..., Tn || Q1, ..., Qm]`, `<< T || Q1, ... >>` y
`#{K => V, ... || Q1, ... }` siguen a OTP 29:

- Los cualificadores se ejecutan de izquierda a derecha; cada generador itera
  sobre el resto. Las plantillas se evalúan en ese orden para cada combinación
  superviviente; varias plantillas añaden varios elementos por combinación. La
  plantilla de una comprehension de binaries debe ser un bitstring (si no,
  `error:badarg` en ese elemento); las piezas se unen en orden, incluidos los
  bytes parciales. Una comprehension de maps evalúa su (primer) valor antes que
  su clave, y una clave duplicada posterior prevalece.
- Generadores: `P <- List`, `<<Segs>> <= Bits` y `K := V <- Map`, con las formas
  estrictas `<:-` (listas, maps) y `<:=`. Un generador de bitstring encaja su
  patrón con un prefijo y continúa con el resto. Cuando uno relajado rechaza un
  elemento, salta tantos bits como describen los tamaños del patrón (valores
  ignorados, flotantes leídos como enteros, como hace OTP); cuando incluso eso
  falla, o quedan menos bits, el generador termina. Un generador de map recorre
  el map en orden de claves (OTP también recorre hasta 32 claves en orden de
  claves, excepto las claves átomo, que ordena por índice de átomo; los maps
  mayores siguen el orden de hash de OTP, que Clause no reproduce).
- Un patrón de generador vincula nombres nuevos: oculta los nombres exteriores,
  y nada de lo que vincula una comprehension es visible después de ella. Un
  generador relajado omite los elementos que su patrón rechaza; uno estricto
  lanza `error:{badmatch, E}` con el elemento de la lista, el bitstring restante
  o `{Key, Value}`.
- Un grupo zip (`P1 <- L1 && P2 <- L2`) toma un elemento de cada entrada por
  paso; sus patrones vinculan conjuntamente, por lo que un nombre repetido debe
  encajar. Un paso rechazado se omite salvo que lo rechace un patrón estricto.
  Las entradas que se agotan de forma desigual, o un rechazo estricto, lanzan
  `error:{bad_generators, {L1', L2'}}` con las entradas que quedan en ese paso
  (un generador de map muestra el iterador de OTP `{K, V, Next}`, que termina
  en `none`). Los filtros dentro de un grupo zip son errores semánticos. Cuando
  generadores relajados y estrictos de un mismo grupo comparten una variable, la
  regla de omisión puede diferir de OTP ([diferencias](differences.md)).
- Una entrada que no es un map lanza `error:{bad_generator, Input}` antes de que
  empiece un generador de map, incluso dentro de un grupo zip.
- Una entrada de lista que no es una lista, o una cola impropia, y una entrada
  de bitstring que no es un bitstring lanzan `error:{bad_generator, Tail}` una
  vez procesados los elementos anteriores.
- Un filtro que es una prueba de guard (`erl_lint:is_guard_test/3` de OTP:
  sintaxis de guard que solo llama a BIF de guard no ocultados, pruebas de tipo
  heredadas en el nivel superior) rechaza el elemento ante cualquier fallo, como
  un guard. Cualquier otro filtro debe devolver `true` o `false`; otros valores
  lanzan `error:{bad_filter, Value}` y sus excepciones se propagan.
- Un cualificador de encaje de nivel superior (`P = E`) es un error semántico
  salvo que esté activada la funcionalidad experimental `compr_assign`; su
  ejecución en ese caso no está implementada (capacidad).

Cada generador es un bucle en el cuerpo de la función cuyo cursor de entrada
(el resto de una lista o bitstring, o un map y una posición) reside en slots
de término del marco; los elementos producidos se acumulan invertidos en otro
slot de término y se convierten en la lista, el bitstring unido o el map una
sola vez al final, de modo que las entradas largas necesitan una pila nativa y
de proceso constante.

## Formas de patrón

| Forma | Regla | Rechazo |
| --- | --- | --- |
| `_` | Nunca vincula; apariciones independientes | Leer `_` es semántico |
| `Name`, `_Name`, repeticiones | Asignación única; las repeticiones exigen igualdad exacta (`1` ≠ `1.0`) | Lectura no vinculada/insegura semántica; la desigualdad no encaja |
| `P1 = P2`, paréntesis | Ambos restringen el mismo valor; no hay vínculos de clave/tamaño entre hermanos | Dependencia ilegal entre hermanos semántica |
| Átomos, enteros, caracteres, flotantes | Igualdad exacta; el cero con signo es distinto | Desajuste |
| Aritmética constante | Operadores de patrón de OTP plegados exactamente; `1 div 0` y no constantes rechazados | Semántico |
| Tuplas, listas, colas impropias, cadenas | Aridad exacta y forma cons/nil; las cadenas son listas | Desajuste |
| `"prefix" ++ Tail` | Solo prefijo de cadena literal o de lista de enteros literal | Prefijo variable semántico |
| `#{K := P}` | Solo `:=`; se permiten claves adicionales; `#{}` comprueba el tipo; las claves son expresiones de guard sobre los vínculos entrantes | `=>`, clave no vinculada semántico; clave ausente no encaja |
| Bitstrings | Tipo/tamaño/unidad validados; los segmentos anteriores pueden dimensionar los posteriores; cola sin tamaño al final | Especificador inválido semántico; datos cortos no encajan |
| Records de tupla `#r{f = P}`, `#r.f` | Expandidos a restricciones de tupla; los campos omitidos no se restringen | Record/campo desconocido semántico |
| Records nativos locales `#r{f = P}` | Record de este módulo llamado `r`, después cada campo enumerado (un campo que le falte hace fallar) | Record desconocido semántico |
| Records nativos cualificados/importados `#m:r{f = P}` | Record del módulo `m` llamado `r`; exportado cuando se enumera un campo; después cada campo | Ninguno en tiempo de compilación |
| Records anónimos `#_{f = P}` | Cualquier record nativo; exportado o definido en este módulo cuando se enumera un campo | `#_{...}` como expresión es un error |
| Llamadas, aritmética con variables, otras expresiones | No son patrones | Semántico |

## Ámbitos

Las claves de map y los tamaños de binary leen el entorno entrante, nunca los
hermanos: `#{K := V} = #{key := K}` y `<<X:N>> = <<N:8>>` no pueden vincular su
propia clave o tamaño. Dentro de un mismo binary, un tamaño puede leer segmentos
anteriores: `<<N:8, X:N>>` es legal; `{N, <<X:N>>}` necesita `N` vinculado de
antemano. La aritmética constante errónea en una clave o tamaño es legal y falla
en el momento del encaje.

La validación de binaries rechaza los segmentos de contenedor anidado/alias,
los modificadores en conflicto, los rangos de unidad erróneos, la unidad sin
tamaño para los valores por defecto entero/flotante, el tamaño/unidad UTF no
válido, las cadenas literales con tipo/tamaño y los segmentos binary sin tamaño
que no son el último.

## Ejecución

- Un plan de encaje plano por cabecera/lado izquierdo sobre los slots de
  argumento originales; los alias comparten una entrada, las primeras
  definiciones vinculan valores SSA, las repeticiones emiten pruebas de igualdad
  exacta. Las comprobaciones de forma dominan la extracción; la extracción usa
  servicios comprobados del runtime.
- Las cláusulas se ejecutan en orden de código fuente, cada una con un entorno
  nuevo que recarga los argumentos originales. Un desajuste de cabecera o un
  rechazo del guard pasan a la siguiente cláusula; los errores del cuerpo y los
  fallos de infraestructura nunca reintentan cláusulas posteriores.
- Un `case` evalúa su expresión examinada una vez y después prueba cada
  cláusula en orden con esa expresión como única entrada del plan: un desajuste
  de patrón o un rechazo del guard (incluidos los errores de guard) pasan a la
  siguiente cláusula, y el agotamiento lanza `{case_clause, Value}`. Cada
  cláusula parte de los vínculos anteriores al case; el valor del case y cada
  vínculo exportado se unen en un PHI por valor.
- Un `if` es un `case` sin expresión examinada ni patrones: cada guard de
  cláusula se prueba en orden (un error de guard rechaza la cláusula), el
  agotamiento lanza `if_clause`, y los valores y exportaciones se unen de la
  misma manera.
- `begin`/`end` ejecuta su secuencia en el ámbito contenedor y produce su
  último valor.
- Las secuencias del cuerpo se ejecutan en orden y devuelven el último valor. Un
  encaje evalúa su lado derecho una vez, vincula los nombres nuevos, comprueba
  los existentes y devuelve el lado derecho (también para `_ = RHS`). Las
  cadenas evalúan primero el lado derecho más interno.
- Los literales átomo cargan vínculos del módulo; el encaje nunca interna
  átomos.
- Las cabeceras de variables incondicionales se compilan a un IR de proyección
  compacto.

## Límites

La normalización de patrones comparte el presupuesto semántico del módulo
(1.000.000 de unidades, o 32 por expresión en módulos más grandes) (un entero
cuesta aproximadamente sus dígitos decimales);
una constante que supera el límite de enteros de 4.194.240 bits es un
`illegal pattern`, como en OTP ([términos](terms.md#integers)). Cada plan de
encaje tiene un techo de trabajo de 100.000. El analizador sintáctico limita
por separado el anidamiento a 256 (techo absoluto 512).
