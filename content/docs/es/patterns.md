---
source: docs/patterns.md
sourceCommit: a8c3f8f6
sourceSha256: 0a7a8a1553a85de9fdbf7f86b763794ac36eb0f02510d51897f2a17be4209cac
translatedAt: 2026-10-17
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
| Cláusulas de fun | Implementado; el agotamiento lanza `error:function_clause` ([funs](funs.md#closures)) |
| Cláusulas de `receive` + guards | Implementado; los mensajes no encajados permanecen en el buzón y `after` se ejecuta al agotarse el tiempo ([procesos](processes.md#receive)) |

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
  el map en orden de claves ([diferencias](differences.md#maps)).
- El patrón de un generador vincula nombres nuevos: oculta los nombres
  exteriores, y nada de lo que vincula una comprehension es visible después de
  ella. Un generador relajado omite los elementos que su patrón rechaza; uno
  estricto lanza `error:{badmatch, E}` con el elemento de la lista, el
  bitstring restante o `{Key, Value}`.
- Un grupo zip (`P1 <- L1 && P2 <- L2`) toma un elemento de cada entrada por
  paso; sus patrones vinculan conjuntamente, por lo que un nombre repetido debe
  coincidir. Un paso rechazado se omite salvo que lo rechace un patrón estricto.
  Las entradas que se agotan de forma desigual, o un rechazo estricto, lanzan
  `error:{bad_generators, {L1', L2'}}` con las entradas que quedan en ese paso
  (un generador de map muestra el iterador de OTP `{K, V, Next}`, que termina en
  `none`). Los filtros dentro de un grupo zip son errores semánticos. Cuando los
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
  salvo que esté habilitada la funcionalidad experimental `compr_assign`;
  ejecutarlo entonces no está implementado (capacidad).

Cada generador es un bucle en el cuerpo de la función cuyo cursor de entrada (el
resto de una lista o de un bitstring, o un map y una posición) reside en ranuras
de términos del marco; los elementos producidos se acumulan invertidos en otra
ranura de término y se convierten en la lista, el bitstring unido o el map una
sola vez al final, por lo que las entradas largas necesitan una pila nativa y de
proceso constante.

## Formas de patrón

| Forma | Regla | Rechazo |
| --- | --- | --- |
| `_` | Nunca vincula; las apariciones son independientes | Leer `_` es semántico |
| `Name`, `_Name`, repeticiones | Asignación única; las repeticiones necesitan igualdad exacta (`1` ≠ `1.0`) | Lectura no vinculada/insegura semántica; la desigualdad es un desajuste |
| `P1 = P2`, paréntesis | Ambos restringen el mismo valor; sin vinculaciones de clave/tamaño entre hermanos | Dependencia ilegal entre hermanos semántica |
| Átomos, enteros, caracteres, flotantes | Igualdad exacta; el cero con signo es distinto | Desajuste |
| Aritmética constante | Operadores de patrón de OTP plegados exactamente; `1 div 0` y no constantes rechazados | Semántico |
| Tuplas, listas, colas impropias, cadenas | Aridad exacta y forma cons/nil; las cadenas son listas | Desajuste |
| `"prefix" ++ Tail` | Solo prefijo de cadena literal o de lista de enteros literal | Prefijo variable semántico |
| `#{K := P}` | Solo `:=`; se permiten claves adicionales; `#{}` comprueba el tipo; las claves son expresiones de guard sobre las vinculaciones entrantes | `=>`, clave no vinculada semántica; la clave ausente es un desajuste |
| Bitstrings | Tipo/tamaño/unidad validados; los segmentos anteriores pueden dimensionar los posteriores; la cola sin tamaño al final | Especificador no válido semántico; los datos cortos son un desajuste |
| Records de tupla `#r{f = P}`, `#r.f` | Expandidos a restricciones de tupla; los campos omitidos no se restringen | Record/campo desconocido semántico |
| Native records locales `#r{f = P}` | Record de este módulo llamado `r` y después cada campo enumerado (un campo que le falte falla) | Record desconocido semántico |
| Native records cualificados/importados `#m:r{f = P}` | Record del módulo `m` llamado `r`; exportado cuando se enumera un campo; después cada campo | Ninguno en tiempo de compilación |
| Records anónimos `#_{f = P}` | Cualquier native record; exportado o definido en este módulo cuando se enumera un campo | `#_{...}` como expresión es un error |
| Llamadas, aritmética con variables, otras expresiones | No son patrones | Semántico |

## Ámbitos

Las claves de map y los tamaños de binary leen el entorno entrante, nunca a los
hermanos: `#{K := V} = #{key := K}` y `<<X:N>> = <<N:8>>` no pueden vincular su
propia clave o tamaño. Dentro de un mismo binary, un tamaño puede leer segmentos
anteriores: `<<N:8, X:N>>` es legal; `{N, <<X:N>>}` necesita que `N` esté
vinculado de antemano. La aritmética constante incorrecta en una clave o tamaño
es legal y falla en el momento del encaje.

La validación de binaries rechaza segmentos con contenedores anidados o alias,
modificadores en conflicto, rangos de unidad incorrectos, unidad sin tamaño para
los valores por defecto de entero/flotante, tamaño/unidad UTF no válidos,
cadenas literales con tipo o tamaño y segmentos binary sin tamaño que no son
los últimos.

## Ejecución

- Un plan de encaje plano por cabecera/LHS sobre las ranuras de argumentos
  originales; los alias comparten una entrada, las primeras definiciones
  vinculan valores SSA y las repeticiones emiten pruebas de igualdad exacta.
  Las comprobaciones de forma dominan la extracción, que lee las celdas en línea
  donde puede y, si no, llama a servicios comprobados del runtime.
- Las cláusulas se ejecutan en orden de código fuente, cada una con un entorno
  nuevo que vuelve a cargar los argumentos originales. Un desajuste de cabecera
  o un rechazo del guard pasa a la siguiente cláusula; los errores del cuerpo y
  los fallos de infraestructura nunca reintentan cláusulas posteriores.
- Un `case` evalúa su expresión examinada una sola vez y después prueba cada
  cláusula en orden con ella como única entrada del plan: un desajuste de patrón
  o un rechazo del guard (incluidos los errores del guard) pasa a la siguiente
  cláusula, y el agotamiento lanza `{case_clause, Value}`. Cada cláusula parte de
  las vinculaciones anteriores al case; el valor del case y cada vinculación
  exportada se unen en un PHI por valor.
- Un `if` es un `case` sin expresión examinada ni patrones: el guard de cada
  cláusula se prueba en orden (un error del guard rechaza la cláusula), el
  agotamiento lanza `if_clause`, y los valores y las exportaciones se unen de la
  misma manera.
- `begin`/`end` ejecuta su secuencia en el ámbito envolvente y produce su último
  valor.
- Las secuencias del cuerpo se ejecutan en orden y devuelven el último valor.
  Un encaje evalúa su RHS una vez, vincula los nombres nuevos, comprueba los
  existentes y devuelve el RHS (también para `_ = RHS`). Las cadenas evalúan
  primero el RHS más interno.
- Los literales átomo cargan los enlaces del módulo; el encaje nunca interna
  átomos.
- Las cabeceras de variables incondicionales se compilan a un IR de proyección
  compacto.

## Límites

La normalización de patrones comparte el presupuesto semántico del módulo
(1.000.000 unidades, o 32 por expresión para módulos más grandes) (un entero
cuesta aproximadamente lo que sus dígitos decimales); una constante que supere
el límite de enteros de 4.194.240 bits es un `illegal pattern`, como en OTP
([términos](terms.md#integers)). Cada plan de encaje tiene un techo de 100.000
unidades de trabajo. El parser limita por separado el anidamiento a 256 (techo
absoluto 512).
