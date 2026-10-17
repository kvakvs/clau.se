---
source: docs/execution-model.md
sourceCommit: a8c3f8f6
sourceSha256: 20c13ce39d1763e6ec342e1ed9aaa741312fc2be68cb0e08dd005c77a126fc43
translatedAt: 2026-10-17
---
# Modelo de ejecución: marcos y continuaciones

Cómo las funciones Erlang generadas llaman, retornan, se suspenden y fallan. El
modelo se eligió tras la comparación de prototipos de
[alternativas comparadas](#alternatives-compared); la parte de su ABI
correspondiente al código generado está en
[marcos y transferencias](abi.md#frames-and-transfers).

## Decisión

Cada proceso Erlang se ejecuta sobre su propia **pila plana de marcos
explícitos**, y el código generado pasa de una función a otra solo mediante
**transferencias de cola garantizadas** (`musttail` de LLVM). Una llamada que no
es de cola guarda la continuación del llamante en el marco del llamante y salta
al llamado; un retorno salta de vuelta a esa continuación. Por tanto, la pila
nativa se mantiene a una sola llamada de profundidad por encima del
planificador, sea cual sea la profundidad de recursión en Erlang, y un proceso
puede detenerse en cualquier transferencia y reanudarse más tarde en cualquier
hilo.

- Una única pila plana por proceso (`ProcessStack`, `process/stack`) contiene
  las cabeceras de los marcos y sus ranuras, crece moviéndose y se direcciona
  como base más desplazamiento.
- Cada función es una función LLVM, su **cuerpo**, que empieza con un `switch`
  sobre el índice de continuación del marco, de modo que conserva todos los
  bloques, uniones y manejadores de la función.
- Los argumentos y los resultados viajan en los registros del proceso `x[]`
  (registros X de BEAM). Todo puntero a código tiene la firma única
  `abi::v1::Code`, `void(void *context, TermWord x0, ..., TermWord x5)`: los
  primeros `abi::v1::register_arguments` (6) registros también se pasan como
  parámetros, de modo que los primeros argumentos de una llamada y el resultado
  de un retorno permanecen en registros de máquina.
- Un fallo retorna a través de cada llamante, que comprueba el canal de fallos
  después de la llamada ([canal de fallos](abi.md#failure-channel-revision-2)).

## Estado del proceso

`abi::v1::FrameState` encabeza cada contexto, de modo que el código generado lo
lee y lo actualiza en línea:

| Campo | Significado |
| --- | --- |
| `stack`, `top`, `limit` | El bloque de pila (se mueve cuando crece), su primera palabra libre y las palabras que un apilamiento puede alcanzar sin crecer ni superar el límite de la pila |
| `frame` | Desplazamiento en palabras de la cabecera del marco actual |
| `registers`, `live` | Los 256 registros de argumentos/resultados; las primeras `live` palabras son raíces en una transferencia |
| `reductions` | Entradas de función que quedan en la porción de tiempo |
| `slow`, `failed` | Bits que envían las transferencias a los servicios (`slow_collect`, `slow_profile`); distinto de cero mientras el canal de fallos contiene un fallo |

`heap_top`/`heap_limit`, `runtime` y `self` sirven a la asignación en línea, a
la carga de átomos y a `self/0` ([marcos y transferencias](abi.md#frames-and-transfers)).
Un proceso suspendido registra en `ProcessStack::resume_` la entrada en la que
continúa.

## Marcos

Un marco es una cabecera de 4 palabras seguida de las ranuras de la función
(registros Y de BEAM): ranuras de términos, que son raíces, y después ranuras en
bruto para valores nativos volcados.

| Palabra de cabecera | Significado |
| --- | --- |
| `previous` | Desplazamiento de la cabecera del llamante (los marcos se enlazan por desplazamientos, nunca por punteros) |
| `function` | El `FrameDescriptor` de la función |
| `resume` | Índice de continuación sobre el que conmuta el cuerpo cuando el control vuelve aquí |
| `handler` | Índice del manejador; siempre 0, ya que los fallos retornan a través de los llamantes |

El descriptor `<symbol>.frame` nombra el módulo, la función y la aridad, y
contiene el puntero al código del cuerpo y los recuentos de ranuras
([abi](abi.md#frames-and-transfers)). Las palabras de cabecera no son términos;
un recorrido sigue `previous` y lee los recuentos de ranuras de los
descriptores. Un **marco inferior** propiedad del runtime se sitúa bajo la
primera llamada de cada proceso y de cada invocación del anfitrión: retornar a
él guarda el resultado en el primer registro y termina la llamada nativa.

## Operaciones

- **Llamada (no de cola).** Los valores vivos después de la llamada se vuelcan
  a ranuras. El llamante fija su propio `resume` al siguiente índice de
  continuación, coloca los argumentos en los registros y transfiere al llamado.
  Las llamadas locales, remotas, de fun y dinámicas son la misma transferencia;
  una llamada de fun o dinámica pide primero a un servicio de preparación el
  `FrameDescriptor` del llamado ([funs](funs.md#dynamic-calls)).
- **Entrada.** Consume una reducción, apila un marco puesto a cero (haciendo
  crecer la pila cuando está llena), copia en ranuras los argumentos que van
  más allá de los parámetros, fija `resume = 0` y transfiere al cuerpo del
  llamado.
- **Retorno.** El llamado pasa el resultado como `x0`, desapila su marco
  (`top = frame`, `frame = previous`) y transfiere al cuerpo del llamante, que
  conmuta sobre el `resume` del llamante.
- **Llamada de cola (tail call).** El llamante desapila su propio marco sin
  transferir y después entra en el llamado en su lugar. El llamante del
  llamante sigue siendo el destino del retorno, por lo que la recursión de cola
  se ejecuta con pila Erlang y nativa constantes. Una llamada de cola a sí misma
  mantiene su marco donde está: consume una reducción, restablece las palabras
  resume y handler del marco y el recuento de vivos y copia los argumentos que
  van más allá de los parámetros, sin reescribir la cabecera ni poner a cero las
  ranuras; LLVM la convierte en un bucle. Una llamada de cola a otro miembro del
  ciclo de llamadas de cola del llamante (funciones de un mismo módulo que se
  alcanzan entre sí mediante llamadas de cola) conserva el enlace al llamante y
  las ranuras de términos que tienen ambos marcos: escribe el descriptor del
  llamado, pone a cero solo las ranuras de términos del llamado que van más allá
  de las del llamante y omite la comprobación del límite de la pila cuando el
  marco del llamado no es más grande. Como en una llamada de cola a sí misma,
  una ranura conservada puede contener un término de un miembro anterior hasta
  que el llamado la escriba, por lo que las recolecciones pueden mantener vivo
  ese término un poco más de tiempo.
- **Cesión (yield).** Sin reducciones restantes, una entrada no apila: se
  registra en `ProcessStack::resume_`, conserva sus argumentos como raíces de
  registro (`ProcessStack::keep_registers`) y devuelve código que termina la
  porción de tiempo, de modo que la pila nativa se desenrolla hasta el
  ejecutor, que más tarde repone el presupuesto y repite la entrada. Las
  cabeceras de bucle de las comprehensions también consumen una reducción y
  ceden a través de una entrada cuando no queda ninguna. Un `receive` espera a
  través del builtin `CLAUSE_wait_frame_v1`, al que se entra como a una llamada
  ([receive](processes.md#receive)).
- **Salida.** Retornar al marco inferior termina el proceso con su resultado;
  un fallo que retorna a él termina el proceso con el fallo.
- **Excepciones.** Una excepción lanzada o una comprobación de servicio fallida
  registra el error en el canal y copia los 8 marcos más internos de la cadena
  para la traza de pila ([trazas de pila](abi.md#stack-traces)). Cada llamante
  comprueba el canal después de la llamada y retorna de inmediato, o salta al
  bloque manejador de un `catch`, `try` o `after` envolvente en el mismo cuerpo
  ([canal de fallos](abi.md#failure-channel-revision-2)). Las detenciones
  (halts) y los fallos de infraestructura omiten todos los manejadores y
  retornan al marco inferior.
- **Invocación del anfitrión.** Un símbolo exportado conserva una firma nativa y
  ejecuta su función por encima de un marco inferior con `CLAUSE_invoke_v1`,
  reanudándola tras cada cesión; las excepciones nativas lanzadas por los
  servicios se contienen allí. Los servicios del runtime siguen siendo llamadas
  nativas ordinarias y nunca vuelven a entrar en el código generado.

Cada llamada apila un marco; las funciones hoja no lo omiten, de modo que cada
función conserva su entrada en la traza de pila.

## Visibilidad de las raíces

En cada transferencia y en cada punto seguro, las raíces de un proceso son: las
ranuras de términos de todos los marcos de su pila, `x[0..live)` y la carga
útil, la lista de argumentos y el término de pila del canal de fallos
([raíces](runtime-heap.md#roots-and-safe-points)).

Los valores nunca sobreviven a una transferencia en registros nativos ni en
valores SSA, salvo los parámetros de la propia transferencia. Cada cuerpo
vuelve a cargar la dirección de su marco desde `stack + frame` después de
entrar, y lee los valores vivos de las ranuras. Dentro de una continuación, un
servicio que puede apilar un marco o mover el heap invalida todo puntero a
ranura y todo puntero al heap guardado en valores SSA; la regla de recarga para
las recolecciones está fijada en [regla de recarga](runtime-heap.md#reload-rule).

El bloque de pila crece duplicándose y moviéndose mientras el límite de todo el
runtime lo permita, nunca se reduce durante la ejecución y está separado del
bloque de heap. No tiene límite de número de marcos; las palabras de la pila
cuentan para el
[límite de memoria del runtime](runtime-heap.md#runtime-memory-limit).

## Destinos

`musttail` con una firma de código uniforme es aceptado por todos los destinos
requeridos en O0 y O2 (prototipo más abajo, clang 23.1.2):

| Destino | Palabra | Resultado |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | saltos de cola |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | saltos de cola |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | saltos de cola |
| `armv7-unknown-linux-gnueabihf` | 32 | saltos de cola |

El backend informa de un error cuando no puede respetar una llamada
`musttail`, de modo que una compilación correcta es la garantía. Alternativa
para un destino futuro que lo rechace: un **trampolín**, donde cada código
devuelve el siguiente puntero a código al bucle del planificador en lugar de
saltar; los marcos, las raíces y los índices de continuación no cambian.
Ningún destino requerido lo necesita.

## Implementación

- **Dos etapas.** El lowering emite la *forma nativa*: una función
  `TermWord(context, arguments)` por función Erlang, llamadas ordinarias entre
  ellas, una llamada marcadora `clause.frame` que nombra las ranuras de
  términos y `ret` del resultado de una llamada en posición de cola.
  `lower_frames` (`compiler/src/codegen/frames.cpp`) mueve después cada cuerpo
  a `<symbol>.body`, añade el prólogo (cabecera del marco, registros, switch de
  reanudación), divide los bloques tras las llamadas que no son de cola y los
  puntos seguros de cabecera de bucle, vuelca los valores usados después de
  ellos (términos a ranuras de términos, otras palabras a ranuras en bruto),
  eleva al prólogo las direcciones constantes de ranuras y convierte las
  llamadas, las llamadas de cola y los retornos en transferencias `musttail`.
  La especialización de tipos y los puntos de inyección de pruebas trabajan
  sobre la forma nativa; el backend ejecuta `lower_frames` antes de la
  inspección del IR y `optimize` lo ejecuta si todavía hace falta.
- **Transferencias en línea.** Las entradas, las entradas de cola y los
  retornos se ejecutan en línea sobre `FrameState`. Cada una recurre a
  `CLAUSE_enter_v1`, `CLAUSE_tail_v1` o `CLAUSE_return_v1` cuando el heap pide
  una recolección, el proceso está en perfilado, no quedan reducciones, la pila
  debe crecer o alcanza su límite, o el llamado es un builtin. La comprobación
  de fallos tras una llamada lee la palabra `failed` del estado. Las rutas de
  servicio guardan los parámetros en el array de registros antes del servicio y
  los vuelven a cargar después.
- **Parámetros.** Un cuerpo lee sus primeros argumentos de los parámetros
  cuando empieza y el resultado de la llamada de `x0` cuando se reanuda;
  `lower_frames` vuelca cualquiera de ellos a una ranura solo cuando está vivo a
  través de una llamada o de un punto seguro.
- **Posiciones de cola**: son la última expresión del cuerpo de una cláusula,
  siguiendo a través de bloques, paréntesis y los cuerpos de las cláusulas de
  `case`, `if` y `receive`. Las llamadas en `catch`, `try`, `maybe` y en los
  operandos de `andalso`/`orelse` no son llamadas de cola.
- **Bucles.** Los generadores de las comprehensions son bucles dentro de un
  cuerpo. Sus cursores y su acumulador residen en ranuras de términos, por lo
  que ningún valor SSA se arrastra a lo largo de un bucle y un punto de
  reanudación dentro de él no necesita nada más allá de los volcados
  habituales.
- **Puntos seguros.** Las entradas de función y las cabeceras de bucle de las
  comprehensions recolectan cuando el heap lo pide
  ([recolección en el código generado](runtime-heap.md#collection-in-generated-code));
  las ranuras de volcado en bruto nunca contienen términos.
- **Sin límite.** La pila crece hasta que el anfitrión deniega memoria, lo que
  falla con `out_of_memory` (salida 70, [ejecutables](executables.md)), igual
  que crece un proceso de OTP. Un `StackOptions::limit_words` opcional por
  proceso (separado del presupuesto opcional del heap) hace fallar con
  `resource_limit` un apilamiento que lo supere.

## Alternativas comparadas

[tests/prototypes/execution_model](../tests/prototypes/execution_model/) hace
manualmente el lowering de las mismas funciones Erlang (`sum/1` con recursión
de cuerpo, `loop/2` con recursión de cola, `fail/1` que lanza una excepción a
profundidad N, `catcher/1` que la captura) de tres maneras y las compila para
todos los destinos anteriores en O0 y O2
(`python tests/prototypes/execution_model/run.py`). En Windows x64 en O2, el
modelo elegido ejecutó una recursión de cuerpo de 1M de profundidad en 17 ms
con 5 palabras por marco y 10M de llamadas de cola con pila constante; su
variante de trampolín superó las mismas ejecuciones. Rechazadas:

- **Llamadas nativas con marcos de raíces explícitos.** La recursión profunda
  necesita una pila nativa por proceso dimensionada para la llamada más
  profunda (unos 13.000 niveles en un hilo de 1 MiB); la suspensión necesita
  cambio de pila específico de cada destino; los destinos de 32 bits no pueden
  reservar pilas grandes para muchos procesos.
- **Corrutinas de LLVM.** Una asignación en el heap por llamada, sin llamadas de
  cola, marcos cuya disposición el recolector no puede ver, pasadas de
  corrutinas incluso en O0, y la transferencia simétrica depende de todos modos
  de `musttail`.
- **Una función LLVM por continuación** (CPS clásico). Las mismas
  transferencias, pero las uniones y los manejadores alcanzados desde varias
  continuaciones tendrían que dividirse en más funciones; el switch de
  reanudación mantiene un recorrido de una sola función.

Costes aceptados: un salto indirecto por retorno más un despacho por switch;
los valores vivos a través de llamadas se vuelven a cargar desde las ranuras;
las trazas inversas del depurador nativo muestran solo la función actual,
mientras que las trazas de pila de Erlang proceden de la cadena de marcos
([depuración](debugging.md)).
