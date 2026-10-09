---
source: docs/execution-model.md
sourceCommit: 06042fa
sourceSha256: 4496f092872f90d6a3fb46c26f67950a76fa663502d4f2c80d8be45d55c8a599
translatedAt: 2026-10-09
---
# Modelo de ejecución: marcos y continuaciones

Decisión del plan 11 step 17 (2026-10-05). Fija cómo las funciones Erlang
generadas llaman, retornan, se suspenden y fallan una vez que llegan la
recursión, las llamadas de cola (tail calls) y los procesos. El step 19
implementó las llamadas, los retornos, las llamadas de cola y los marcos
([Implementación](#implementation) enumera lo que sigue abierto); los steps
23, 24, 26 y 43 se apoyan en él.

## Decisión

Cada proceso Erlang se ejecuta sobre su propia **pila plana de marcos
explícitos**, y el código generado pasa de una función a otra solo mediante
**transferencias de cola garantizadas** (`musttail` de LLVM). Una llamada que
no es de cola guarda la continuación del llamante en el marco del llamante y
salta al llamado; un retorno salta de vuelta a esa continuación. Por tanto, la
pila nativa se mantiene a una sola llamada de profundidad por encima del
planificador, sea cual sea la profundidad de recursión en Erlang, y un proceso
puede detenerse en cualquier transferencia y reanudarse más tarde en cualquier
hilo.

- Una pila plana por proceso sustituye a la pila de raíces segmentada de 8F.
  Contiene las cabeceras de los marcos y sus ranuras, crece moviéndose y se
  direcciona como base más desplazamiento.
- Cada función que necesita un marco se traduce en el lowering a una
  **entrada** y un **cuerpo**. El cuerpo empieza con un `switch` sobre el
  índice de continuación del marco, de modo que una sola función LLVM
  conserva todos los bloques, uniones y manejadores de la función.
- Los argumentos y los resultados viajan en los registros del proceso
  `x[0..n)` (registros X de BEAM); todo puntero a código tiene la firma única
  `void code(Process *)`.
- Las excepciones desenrollan marcos hasta el marco más interno cuya cabecera
  nombra una continuación manejadora.

## Estado del proceso

| Campo | Significado |
| --- | --- |
| `stack`, `capacity` | Un único array de palabras ampliable; se mueve cuando crece |
| `frame`, `top` | Desplazamientos en palabras de la cabecera del marco actual y de la primera palabra libre |
| `x[]`, `live` | Registros de argumentos/resultados; las primeras `live` palabras son raíces en una transferencia |
| `reductions` | Llamadas que quedan en la porción de tiempo |
| `resume_at` | Entrada en la que continúa un proceso suspendido |
| canal de fallos | El canal actual de la revisión 2: razón, carga útil, traza de pila, `halted` |

## Marcos

Un marco es una cabecera fija seguida de las ranuras de la función (registros
Y de BEAM). Las ranuras se ponen a cero al apilarse, como ocurre hoy con los
marcos de raíces.

| Palabra de cabecera | Significado |
| --- | --- |
| `previous` | Desplazamiento de la cabecera del llamante (los marcos se enlazan por desplazamientos, nunca por punteros) |
| `function` | El descriptor de la función |
| `resume` | Índice de continuación sobre el que conmuta el cuerpo cuando el control vuelve aquí |
| `handler` | Índice de continuación del manejador activo más interno, 0 si no hay ninguno |

El descriptor amplía el actual `abi::v1::FrameDescriptor` (descriptor de
módulo, ranuras de átomo de módulo y de función, aridad) con los punteros a
código de la entrada y del cuerpo y el número de ranuras. Las palabras de
cabecera no son términos; un recorredor sigue `previous` y lee el número de
ranuras de los descriptores. Un **marco inferior** propiedad del runtime está
debajo de la primera llamada de cada proceso: la continuación 1 es una salida
normal (resultado en `x[0]`) y la continuación 2 es el manejador de una
excepción no capturada.

## Operaciones

- **Llamada (no de cola).** Los valores vivos ya están en ranuras (la regla de
  enraizamiento actual). El llamante fija su propio `resume` al siguiente
  índice de continuación, escribe los argumentos en `x[0..n)` y transfiere a
  la entrada del llamado. Una llamada remota transfiere al símbolo de entrada
  exportado.
- **Entrada.** Cuenta una reducción (véase la cesión), apila un marco puesto a
  cero (moviendo la pila cuando está llena), copia `x[0..n)` en las ranuras,
  fija `resume = 0` y transfiere al cuerpo.
- **Retorno.** El llamado escribe el resultado en `x[0]`, desapila su marco
  (`top = frame`, `frame = previous`) y transfiere al cuerpo del llamante, que
  conmuta sobre el `resume` del llamante.
- **Llamada de cola.** Los argumentos van a `x[0..n)`, el llamante desapila su
  propio marco sin transferir y después transfiere a la entrada del llamado.
  El llamante del llamante sigue siendo el destino del retorno, así que la
  recursión de cola se ejecuta con pila Erlang y nativa constantes. Las
  llamadas de cola locales, mutuas y remotas son el mismo salto.
- **Cesión (yield).** Cada entrada gasta una reducción. Al llegar a cero se
  registra a sí misma en `resume_at` y vuelve al planificador en lugar de
  apilar un marco; los argumentos se quedan en `x[0..arity)`, que pasan a ser
  los únicos registros del proceso que hay que enraizar. Al reanudar se
  rellena el presupuesto y se transfiere a `resume_at`, que repite la entrada.
  Las esperas posteriores (`receive`, step 46) guardan un índice de
  continuación del cuerpo en lugar de una entrada.
- **Salida.** Retornar al marco inferior registra una salida normal;
  desenrollar hasta él registra una excepción no capturada. En ambos casos el
  código vuelve al planificador.
- **Propagación de excepciones.** Un raise o una comprobación de servicio
  fallida registra el error en el canal como hoy y nombra para la traza los 8
  marcos más internos de la cadena de marcos. Después, el desenrollador
  desapila los marcos cuyo `handler` es 0, fija `resume = handler` en el
  primer marco que tenga uno y transfiere a su cuerpo. Los manejadores de
  `catch`, `try` y `after` son índices de continuación; entrar en una región
  protegida fija `handler` y salir de ella restaura el índice envolvente,
  ambos conocidos estáticamente dentro de una función. Los halts y los fallos
  de infraestructura se saltan todos los manejadores y desenrollan
  directamente hasta el marco inferior, igual que hoy se saltan los
  manejadores. El manejador recoge la excepción con los servicios actuales
  (`CLAUSE_catch_v1`, `CLAUSE_exception_v2`) y la relanza a través del
  desenrollador.
- **Invocación desde el anfitrión.** El runtime apila un marco inferior, carga
  `x[]` y ejecuta el bucle del planificador hasta alcanzar ese marco. Los
  servicios del runtime siguen siendo llamadas nativas ordinarias y nunca
  vuelven a entrar en el código generado; solo este bucle del anfitrión lo
  inicia.

Una función que no hace ninguna llamada que no sea de cola y no conserva
ninguna ranura a través de un punto seguro puede omitir su marco y retornar
directamente al cuerpo de su llamante. Es una optimización que el compilador
puede añadir más adelante, no parte del contrato.

## Visibilidad de las raíces

En cada transferencia y en cada punto seguro, las raíces de un proceso son:
todas las ranuras de todos los marcos de su pila, `x[0..live)` y la carga
útil, la lista de argumentos y el término de pila del canal de fallos (que ya
son raíces del proceso). Las palabras de entrega de resultados de la pila de
raíces actual desaparecen; `x[0]` asume su papel.

Los valores nunca sobreviven a una transferencia en registros nativos ni en
valores SSA. Cada cuerpo recarga la dirección de su marco desde
`stack + frame` tras entrar, y lee los valores vivos de las ranuras. Dentro de
una continuación, un servicio que puede apilar un marco o mover el heap
invalida todo puntero a ranura y todo puntero al heap guardados en valores
SSA; la regla de recarga para las recolecciones se fija en
[recolección en el código generado](runtime-heap.md#collection-in-generated-code).

## Sucesor de la pila de raíces de 8F

La pila segmentada existe solo porque el código generado mantiene punteros
absolutos a marcos a través de las llamadas. Con este modelo ningún puntero a
marco sobrevive a una transferencia, así que la pila pasa a ser un único
bloque plano por proceso:

- las cabeceras de los marcos viven en la pila, y las ranuras se direccionan
  como `stack + frame + header + index`;
- el bloque crece duplicándose y moviéndose (`realloc`), nunca se reduce
  durante la ejecución y está separado del bloque de heap;
- se elimina el límite de 4.096 marcos; las palabras de pila cuentan para el
  presupuesto de memoria del proceso, y superarlo es el fallo documentado del
  step 20.

## Destinos

`musttail` con la firma uniforme `void (Process *)` es aceptado por todos los
destinos requeridos en O0 y O2 (prototipo más abajo, clang 23.1.2):

| Destino | Palabra | Resultado |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | saltos de cola |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | saltos de cola |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | saltos de cola |
| `armv7-unknown-linux-gnueabihf` | 32 | saltos de cola |

El backend informa un error cuando no puede respetar una llamada `musttail`,
así que una compilación correcta es la garantía. Alternativa para un futuro
destino que la rechace: un **trampolín**. Cada código devuelve el siguiente
puntero a código al bucle del planificador en lugar de saltar (null
suspende); los marcos, las raíces y los índices de continuación no cambian.
Ningún destino requerido lo necesita.

## Implementación

El step 19 (2026-10-05) implementa el modelo con estas decisiones y
carencias:

- **Dos etapas.** El lowering sigue emitiendo *forma nativa*: una
  función `TermWord(context, arguments)` por cada función Erlang, llamadas
  ordinarias entre ellas, una llamada provisional `clause.frame` que nombra
  las ranuras de términos, y `ret` del resultado de una llamada en posición de
  cola. Después, `lower_frames` (`compiler/src/codegen/frames.cpp`) mueve cada
  cuerpo a `<symbol>.body`, añade el prólogo (cabecera del marco, registros,
  switch de reanudación), divide los bloques tras las llamadas que no son de
  cola y los puntos seguros de las cabeceras de bucle, vuelca los valores
  usados después de ellos (términos a ranuras de términos, otras palabras a
  ranuras en bruto), eleva al prólogo las direcciones constantes de las
  ranuras, y convierte las llamadas, las llamadas de cola y los retornos en
  transferencias `musttail`. La especialización de tipos y los puntos de
  prueba trabajan sobre la forma nativa; el backend ejecuta `lower_frames`
  antes de la inspección de la IR y `optimize` lo ejecuta si aún hace falta.
- **Entrada y cuerpo.** No hay una función de entrada separada: el llamante
  llama a `CLAUSE_enter_v1(context, callee.frame)`, que apila el marco, copia
  los argumentos y devuelve el cuerpo del llamado. Una llamada de cola usa
  `CLAUSE_tail_v1`, que primero libera el marco del llamante.
- **Las posiciones de cola** son la última expresión del cuerpo de una
  cláusula, seguida a través de bloques, paréntesis y cuerpos de cláusulas de
  `case` e `if`. Las llamadas dentro de `catch`, `try`, `maybe` y de los
  operandos de `andalso`/`orelse` no son llamadas de cola.
- **Las excepciones** retornan a través de cada llamante, que comprueba el
  canal después de la llamada como antes; los índices de manejador y el
  desenrollado directo siguen siendo una optimización. Las trazas de pila leen
  la cadena de marcos en el momento del raise.
- **Bucles.** Los generadores de las comprehensions son bucles dentro de un
  mismo cuerpo. Sus cursores y su acumulador viven en ranuras de términos, así
  que ningún valor SSA da la vuelta a un bucle y un punto de reanudación
  dentro de él no necesita nada más que los volcados habituales.
- **Cesiones** (step 43, [procesos](processes.md)). `CLAUSE_enter_v1` y
  `CLAUSE_tail_v1` gastan una de las reducciones del proceso; si no queda
  ninguna, registran la función en la que se entra
  (`ProcessStack::resume_`, el `resume_at` del modelo), conservan sus
  argumentos como raíces de registro y devuelven un código que termina la
  porción de tiempo, de modo que la pila nativa se desenrolla hasta el
  ejecutor, que más tarde repite la entrada. Las cabeceras de bucle no ceden
  el control. El recolector enumera las ranuras de términos de los marcos, los
  registros que una suspensión mantiene vivos
  (`ProcessStack::keep_registers`) y el canal de fallos (step 23,
  [raíces](runtime-heap.md#roots-and-safe-points)). Las entradas de función y
  las cabeceras de los bucles de comprehension son puntos seguros que
  recolectan cuando el heap lo pide (step 26,
  [recolección en el código generado](runtime-heap.md#collection-in-generated-code));
  las ranuras de volcado en bruto nunca contienen términos.
- **Sin límite.** La pila crece hasta que el anfitrión rechaza la memoria, lo
  que falla con `out_of_memory` (salida 70, [ejecutables](executables.md)),
  igual que crece un proceso de OTP. Un `StackOptions::limit_words` opcional
  por proceso (separado del presupuesto opcional del heap) hace fallar con
  `resource_limit` un apilamiento que lo supere. Hoy los marcos ocupan 4
  palabras de cabecera más 1-40 ranuras.
- **Entrada desde el anfitrión.** Un símbolo exportado conserva la firma
  nativa y ejecuta su función sobre un marco inferior del runtime con
  `CLAUSE_invoke_v1`; las excepciones nativas lanzadas por los servicios
  quedan contenidas ahí.

## Alternativas comparadas

Prototipo en [tests/prototypes/execution_model](../tests/prototypes/execution_model/):
las mismas funciones Erlang (`sum/1` con recursión de cuerpo, `loop/2` con
recursión de cola, `fail/1` que lanza `boom` a profundidad N, `catcher/1` que
la captura) con lowering hecho a mano de tres maneras. Anfitrión:
Windows x64, clang 23.1.2; los tiempos son ejecuciones únicas en O2. Ejecutar
`python tests/prototypes/execution_model/run.py`.

| | Marcos explícitos + `musttail` (elegido) | Llamadas nativas + marcos de raíces (actual) | Corrutinas de LLVM (C++20) |
| --- | --- | --- | --- |
| Recursión de cuerpo de 1M de profundidad | ok, 17 ms; 5 palabras por marco; 17 movimientos de pila | 80 B de pila nativa por nivel: unos 13.000 niveles en un hilo de 1 MiB | ok, 60 ms; una asignación de heap de 64–80 B por llamada |
| 10M de llamadas de cola | ok, 5 ms; pila constante | O0 crece 80 B por llamada; O2 solo por suerte con las sibling calls | sin llamadas de cola: 1M de iteraciones mantienen 1M de marcos |
| Cesión / reanudación | en cada entrada; dos procesos se intercalan | imposible sin una pila nativa por proceso | transferencia simétrica (que a su vez es `musttail`) |
| Pila nativa a profundidad 1M | 136–144 B | crece en cada nivel | 144–520 B |
| Raíces visibles para el GC | ranuras en marcos conocidos | ranuras en marcos conocidos | disposición del marco de la corrutina elegida por LLVM; los términos necesitarían una segunda copia enraizada |
| Excepciones | desenrollado hasta el marco manejador | comprobación del canal en cada retorno | comprobación del canal en cada retorno |

La variante con trampolín del modelo elegido supera las mismas ejecuciones
(20 ms de recursión, 16 ms para 10M de llamadas de cola en O2). Descartadas:

- **Llamadas nativas con marcos de raíces explícitos.** La recursión profunda
  necesita una pila nativa por proceso dimensionada para la llamada más
  profunda; la suspensión necesita cambio de pila específico de cada destino;
  los destinos de 32 bits no pueden reservar pilas grandes para muchos
  procesos.
- **Corrutinas de LLVM.** Una asignación por llamada, sin llamadas de cola,
  marcos opacos para el recolector, pases de corrutinas incluso en O0, y la
  transferencia simétrica depende de `musttail` de todos modos.
- **Una función LLVM por continuación** (CPS clásico). Las mismas
  transferencias, pero las uniones y los manejadores alcanzados desde varias
  continuaciones tendrían que dividirse en más funciones; el switch de
  reanudación conserva el recorredor actual de una sola función.

Costes aceptados: un salto indirecto por retorno más un despacho por switch;
los valores vivos a través de las llamadas se recargan desde las ranuras (ya
están guardados ahí); las trazas inversas del depurador nativo solo muestran
la función actual, mientras que las trazas de pila de Erlang salen de la
cadena de marcos.

## Evidencia del prototipo

`run.py` construye el modelo elegido (`musttail` y trampolín), la línea base
nativa y el modelo de corrutinas para el anfitrión en O0 y O2, los ejecuta, y
compila las funciones con lowering hecho a mano (`generated.cpp`,
freestanding) para cada destino anterior en O0 y O2, contando las
llamadas `musttail` en la IR y los saltos de cola en el ensamblador.
Resultado del 2026-10-05: PASS. Para el modelo elegido en ambos niveles:
retorno (42), recursión de cuerpo de 1.000.000 de profundidad, 10.000.000 de llamadas de cola, un error lanzado a
profundidad 100.000 capturado por un marco manejador, el mismo error sin
capturar (marco inferior, traza de 8 marcos `fail`), y dos procesos que se
intercalan en porciones de 4.000 reducciones (1.002 porciones). Los 15 puntos
de transferencia son `musttail` en O0 en todos los destinos (14 en O2 tras el
inlining).

El cuerpo de `sum/1` para `i686-pc-windows-msvc` (IR en O2, nombres
abreviados). La IR de `x86_64-pc-windows-msvc` es la misma con palabras `i64`
y desplazamientos duplicados.

```llvm
%2 = load ptr, ptr %0, align 4                      ; stack base
%3 = getelementptr inbounds nuw i8, ptr %0, i32 8
%4 = load i32, ptr %3, align 4                      ; current frame offset
%5 = getelementptr inbounds nuw [4 x i8], ptr %2, i32 %4
%6 = getelementptr inbounds nuw i8, ptr %5, i32 16  ; slot 0 (N)
%7 = getelementptr inbounds nuw i8, ptr %5, i32 8   ; header: resume index
%8 = load i32, ptr %7, align 4
%9 = icmp eq i32 %8, 0                              ; switch on resume
...
16:                                                 ; N > 0: call sum(N - 1)
  store i32 1, ptr %7, align 4                      ; resume = 1
  ...                                               ; x0 = N - 1
  %19 = tail call ptr @call(ptr %0, ptr @SUM)       ; push frame or park
  musttail call void %19(ptr nonnull %0)
  ret void
20:                                                 ; resume 1: x0 += N
  ...
  %24 = tail call ptr @leave(ptr %0)                ; pop, caller body
  musttail call void %24(ptr nonnull %0)
  ret void
```
