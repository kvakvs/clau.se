---
source: docs/abi.md
sourceCommit: 6ed3851c
sourceSha256: 28bc0f8706b31345a108f5bf8b8e9cc549766717aa19b28e456f94ce2b1d2009
translatedAt: 2026-10-15
---
# ABI del código generado (revisión 21)

Contrato privado entre la salida del compilador y el runtime. Es C++23 interno
del proyecto, no es compatible con BEAM ni es una FFI de propósito general. Los
objetos y el runtime deben proceder de la misma compilación; las revisiones
anteriores de los descriptores se rechazan antes de usarse.

Cabeceras: [v1.hpp](../abi/include/clause/abi/v1.hpp) (tipos de término,
contexto y función), [term.hpp](../abi/include/clause/abi/term.hpp) (códec de
enteros inmediatos), [status.hpp](../abi/include/clause/abi/status.hpp),
[builtins.hpp](../abi/include/clause/abi/builtins.hpp),
[startup.hpp](../abi/include/clause/abi/startup.hpp) (arranque del programa).

## Términos

Un término es una palabra sin signo del ancho de puntero del objetivo (32 o 64
bits). Las disposiciones se derivan del objetivo LLVM configurado, por lo que el
código entre objetivos distintos usa los anchos del objetivo.

- Enteros pequeños: los cuatro bits bajos son `0xf`; carga útil con signo de
  `word_bits - 4` bits, rango `[-2^(word_bits-5), 2^(word_bits-5)-1]`. Los
  valores mayores son bignums en el heap.
- Átomos: los seis bits bajos son `0x0b`, carga útil no reciclada y válida en
  todo el proceso. Los IDs nunca se serializan ni se usan para ordenar.
  `false`, `true`, `undefined`, `ok` y `error` son fijos: cargas útiles 0–4 en
  todo runtime (revisiones 11 y 13).
- Tupla vacía `0x2b` y nil `0x3b` exactamente; cualquier otro bit de carga útil
  es inválido.
- Pids locales: los cuatro bits bajos son `0x3`, la carga útil es el número de
  proceso, y se admiten solo cuando los emitió el runtime
  ([pids y referencias](terms.md#pids-and-references)).
- Las palabras boxed y de lista apuntan al heap del proceso propietario y se
  admiten solo después de que el runtime demuestre la propiedad (véase
  [términos](terms.md)).
- Etiquetas primarias: lista `0x1`, boxed `0x2`. Una cabecera guarda su tipo a
  partir del bit 2 y el número de palabras siguientes a partir del bit 7
  (`header_count_shift`); el tipo de una tupla es 0. El código generado lee
  elementos de tupla y celdas cons en línea solo después de que la inferencia o
  una prueba de forma dominante haya demostrado la celda
  ([pruebas](specialization.md#proofs)); los planes de coincidencia prueban las
  formas de tupla y cons en línea en todos los niveles de optimización (una
  etiqueta boxed y después la cabecera), y la igualdad exacta compara primero
  las palabras y llama a `CLAUSE_exact_v1` solo para dos palabras de lista o
  boxed distintas. El runtime verifica estas constantes.

## Funciones y símbolos

Firma de entrada (convención de llamada nativa de C, no requiere enlace C):

```cpp
TermWord function(ProcessContext *context, const TermWord *arguments);
```

Los argumentos son un array prestado y alineado a palabra, en el orden del
código fuente (nulo con aridad 0). El contexto está vivo y se pasa sin cambios a
través de las llamadas. Una palabra devuelta solo es utilizable después de
comprobar el canal de fallos.

Símbolos: `clausev1_<hex module>_<hex function>_<arity>`, hexadecimal en
minúsculas de los bytes UTF-8, aridad decimal canónica; reversibles e
independientes del host. Las entradas exportadas son externas y las demás,
internas.

## Registro de módulos

Cada módulo emite `clausev1_<hex module>__0.descriptor` y `.register`. El
descriptor contiene la versión de la ABI, el ancho de término, la tabla de
exportaciones (nombre, aridad, entrada del host y el `FrameDescriptor` en el que
entran las llamadas dinámicas), las grafías de los átomos (pares de
puntero/tamaño UTF-8), los descriptores de native record (slots de átomos de
módulo, nombre y campos, flag de exportación;
[native records](native-records.md#representation)) en una tabla externa
`<prefix>.records` a la que hacen referencia otros módulos de un lote, y los
descriptores de funs en una tabla privada `<prefix>.funs`
([funs](funs.md#representation)). El registro llama a
`CLAUSE_register_module_v4(Runtime*)`, que valida la versión/ancho y todas las
exportaciones, interna los átomos, construye un registro congelado y lo publica
junto con la imagen de código en una sola transacción. Los módulos duplicados
nunca reemplazan código; cualquier fallo no publica nada (los átomos ya
internados permanecen en la tabla acotada).

- Se debe llamar a `.register` explícitamente antes de resolver exportaciones.
  No hay constructores globales; quienes usen archivos estáticos deben
  referenciar las entradas de registro.
- `llvm.used` conserva los descriptores y las entradas; enlazar sin el runtime
  falla por el símbolo de servicio ausente.
- La dirección del descriptor es la clave de vinculación de átomos; su imagen
  debe permanecer mapeada durante la vida del módulo. Cada runtime tiene sus
  propias vinculaciones para la misma imagen.
- Las expresiones de átomo leen los slots mediante `CLAUSE_atom_v3`; nunca
  internan.
- Un objeto de arranque (`clausev1_start`) enumera todos los descriptores en un
  `StartupDescriptor` y su `main` nativo llama a
  `CLAUSE_main_v1(argc, argv, descriptor)`, que registra todos los módulos y
  ejecuta la entrada ([ejecutables](executables.md#startup-object)).

## Canal de fallos (revisión 2)

Los errores no se codifican en los bits del término. Después de cada llamada
generada que no es de cola, el llamador comprueba el canal antes de usar el
resultado o de evaluar el siguiente argumento: lee la palabra `failed` del
`FrameState` del contexto, que el runtime mantiene igual a
`CLAUSE_call_failed_v2(context)`. En caso de fallo, el llamado devuelve una
palabra cero inválida.

| Resultado | Transporte |
| --- | --- |
| Patrón que no coincide, rechazo de guard | Continuación al siguiente candidato; canal intacto |
| Cláusulas agotadas | `error:function_clause`; `error:{case_clause, Value}` con carga útil propia para un `case`; `error:if_clause`; `error:{try_clause, Value}` para las cláusulas `of` de un try; `error:{else_clause, Value}` para las cláusulas `else` de un maybe |
| Fallo de coincidencia en el cuerpo | `error:{badmatch, Value}` con carga útil propia |
| Comprehensions | `error:{bad_generator, Tail}`, `error:{bad_filter, Value}`, `error:{bad_generators, Inputs}` (`ErrorReason` 16-18); el rechazo de un generador estricto es `{badmatch, Element}` |
| Acceso a records, argumentos incorrectos, aritmética, maps | `badrecord`, `badarg`, `badarith`, `badmap`/`badkey` |
| Campo ausente en un native record | `ErrorReason::badfield` (20), carga útil `{{Module, Name}, Field}` |
| Llamada a un valor (`F(Args)`) | `ErrorReason::badfun` (22, la carga útil es el valor), `badarity` (23, carga útil `{Fun, Args}`), `undef` (24), registrados por `CLAUSE_apply_v1` ([funs](funs.md)) |
| Llamadas dinámicas (`M:F(Args)`, `apply/2,3`, `fun M:F/A` con variables) | `badarg` para un módulo o función que no es un átomo, una lista de argumentos impropia o una aridad inválida; `undef` cuando ningún módulo del programa exporta la función; `badfun`/`badarity` como arriba ([funs](funs.md#dynamic-calls)) |
| Construcción nativa externa sin un valor | `ErrorReason::novalue` (21), carga útil `{{Module, Name}, Field}` |
| Resultado entero que supera el límite de tamaño | Resultado de servicio `ValueOutcome::system_limit` (3): un guard rechaza, un cuerpo lanza `error:system_limit` (`ErrorReason` 19) |
| Operando izquierdo perezoso inválido | `{badarg, Value}` |
| Infraestructura (OOM, límites, propiedad, interno) | `CallError::runtime_failure` con el `Status` exacto |
| `erlang:error/1,2,3`, `exit/1`, `throw/1`, `erlang:raise/3` | `raised_error`/`raised_exit`/`raised_throw`: la clase viene del ID, la carga útil propia es el motivo completo |
| `erlang:halt/0,1` | `CallError::halted` con `halt_status` (y eslogan) |

Los motivos son IDs tipados registrados por `CLAUSE_raise_v2`; los tres IDs
`raised_*` seleccionan la clase `exit` o `throw` (en otro caso `error`) y
llevan cualquier término como motivo. `error/2,3` lanzan a través de
`CLAUSE_error_v1(context, reason, args)`, que además conserva una lista `args`
para el marco superior de la pila. Gana el primer fallo; las invocaciones
anidadas comparten
el canal. `GeneratedInvocation` es el ámbito del host: comprueba los fallos
pendientes antes de la entrada y después del retorno, copia el resultado o el
error y limpia solo en la salida más externa (también ante excepciones de C++).
Ninguna excepción atraviesa las entradas generadas. Quienes llamen a entradas en
bruto deben abrir un `GeneratedInvocation`; los hosts normales usan
`ResolvedFunction::call`.

`catch Expr` redirige toda comprobación de fallo y todo lanzamiento dentro de
`Expr` a un bloque manejador que llama a `CLAUSE_catch_v1(context, slot)`. Para
una excepción de Erlang pendiente, escribe el valor del catch en el slot raíz y
limpia el canal: el término lanzado, `{'EXIT', Reason}` para un exit, o
`{'EXIT', {Reason, []}}` para un error (los motivos tipados se convierten en sus
términos de OTP, como `{badmatch, V}`; la pila se describe
[más abajo](#stack-traces)). Los halts y los fallos de infraestructura siguen
pendientes, y la propia comprobación del manejador continúa hacia el manejador
envolvente o la salida de la función. Las vinculaciones hechas dentro de `Expr`
no son seguras después, por lo que la unión solo combina el valor.

`try Body of ... catch ... end` protege solo `Body` de la misma manera. Su
manejador llama a
`CLAUSE_exception_v2(context, class_slot, reason_slot, stack_slot)`, que escribe
el átomo de clase (`error`, `exit` o `throw`), el motivo y el término de la traza
de pila en slots raíz y limpia el canal (los halts y los fallos de
infraestructura siguen pendientes, como con
`catch`). Las cláusulas catch hacen coincidir entonces `Class:Reason` con
patrones y guards ordinarios; una clase omitida coincide con `throw`, y una
variable de pila con nombre se vincula al término de pila. Cuando ninguna
coincide, `CLAUSE_reraise_v2(context, class, reason,
stack)` registra de nuevo la excepción con un motivo `raised_*` y la misma pila,
que se notifica y se captura exactamente igual que la original.
Las cláusulas `of` seleccionan sobre el valor del cuerpo y lanzan
`{try_clause, Value}` (`ErrorReason::try_clause = 14`); las excepciones dentro
de las cláusulas `of` y de los manejadores van al manejador envolvente.

`maybe` no necesita ningún servicio: cada `?=` es una coincidencia ordinaria
cuya arista de no coincidencia sale del cuerpo hacia la salida del maybe con el
valor no coincidente (ya enraizado). Sin `else`, ese valor es el resultado; en
otro caso, las cláusulas `else` seleccionan sobre él como las cláusulas de
`case` y lanzan `{else_clause, Value}` (`ErrorReason::else_clause = 15`) cuando
ninguna coincide.

Las comprehensions usan los servicios existentes con unas pocas operaciones: los
elementos acumulados se invierten mediante la construcción `reverse`
(`ContainerConstruction::reverse = 2`, valores `{List, Tail}`), que construye el
resultado en una sola reserva de heap; los generadores de lista prueban y leen
las celdas cons en línea; una comprehension
de binary une sus piezas con `BitOperation::concat` (`{List}`) y una
comprehension de map construye su map con `MapOperation::from_list` (`{Pairs}`,
las claves posteriores ganan). Los generadores de map toman
`MapOperation::entries` (11, `{Map}`) una sola vez: una celda con las claves y
los valores en las palabras `1 + 2i` y `2 + 2i` en el orden canónico de claves
(un map clásico en sí, o una copia con forma de tupla de las entradas de un map
fuera del heap que solo lee el código generado) y leen cada entrada en línea;
`key_at`/`value_at` (`{Map, Position}`) se mantienen para otros llamadores. La
entrada restante de un zip se muestra con `MapOperation::iterator`, la cadena
`{K, V, Next}` de OTP que termina en `none`.
`MapOperation::update_owned` (10) toma los operandos de
`update` para una actualización de map cuyo origen el compilador demostró que no
se vuelve a leer: un map de origen fuera del heap se actualiza en el sitio y su
stub queda consumido (vacío).
Los generadores de bitstring usan la extracción de patrones ordinaria más un
segmento final `binary`/`all` para el resto.

`try ... after A end` añade una segunda protección alrededor del cuerpo y de
todas las cláusulas `of` y catch. En el camino normal, `A` se ejecuta después de
enraizar el valor seleccionado y su valor se descarta. El manejador de after
toma la excepción con `CLAUSE_exception_v2`, ejecuta una segunda copia de `A` y
vuelve a lanzar con `CLAUSE_reraise_v2`; una excepción o un fallo dentro de `A`
sale en cambio por el manejador envolvente, sustituyendo a la original. Los
halts y los fallos de infraestructura omiten `A`. Los slots raíz pertenecen al
marco de la función, por lo que todos los caminos los liberan en la salida de la
función.

### Trazas de pila

Cada marco raíz nombra su función generada con un `abi::v1::FrameDescriptor`
privado (descriptor de módulo, slots de átomos de nombre de módulo y de función,
aridad). Cuando se registra una excepción de Erlang, el canal copia los 8 marcos
con nombre más internos (el `backtrace_depth` predeterminado de BEAM); el
término `[{Module, Function, Arity, []}, ...]` solo se construye cuando un
manejador, un `catch` o un informe lo solicita. El marco superior muestra la
lista de argumentos de `error/2,3` en lugar de la aridad cuando ese argumento es
una lista.

`erlang:raise(Class, Reason, Stack)` (`CLAUSE_reraise_v2`) acepta las pilas que
acepta BEAM: una lista propia de `{M, F, A}` (completados con una ubicación
`[]`) o `{M, F, A, Location}` con `M`, `F` átomos y una lista `Location`,
recortada a 8 entradas; la pila se conserva entonces tal como se da y ya no se
capturan marcos. Una clase o pila inválida no registra nada y la llamada se
evalúa como `badarg`, igual que en OTP. `erlang:get_stacktrace/0` se rechaza con
el texto de lint "removed" de OTP 29.

Diferencias respecto a OTP, todas visibles solo en el término de pila:

- Las ubicaciones son siempre `[]` (OTP añade `{file, F}`, `{line, L}`), y las
  opciones de `error/3` no añaden `error_info`.
- Un marco superior de `function_clause` muestra la aridad, no la lista de
  argumentos.
- Ningún marco nombra un BIF u operador que falla (OTP añade
  `{erlang, '+', Args, [{error_info, ...}]}`), y no aparece nada por debajo de
  la función de entrada.
- Una llamada de cola libera el marco del llamador, por lo que, como en OTP, un
  llamador que terminó en una llamada de cola no aparece en la traza. OTP
  también convierte en llamadas de cola las llamadas a funciones que nunca
  retornan; Clause no.
- Las entradas de pila `{Fun, Args}` de `erlang:raise/3` todavía se rechazan.

## Marcos y transferencias

Las funciones generadas se ejecutan sobre marcos explícitos
([modelo de ejecución](execution-model.md), step 19; servicios en
[frames.hpp](../abi/include/clause/abi/frames.hpp)).
Cada función tiene un descriptor `<symbol>.frame` (`FrameDescriptor`:
descriptor de módulo, slots de átomos de módulo y de función, aridad, código del
cuerpo, número de slots, número de slots de términos; externo para las funciones
exportadas) y un `<symbol>.body` interno de tipo `abi::v1::Code`,
`void(void *context, TermWord x0, TermWord x1, TermWord x2)` (revisión 10); con
un runtime compilado con Clang en x86-64 y AArch64, los cuerpos y todas las
transferencias usan la convención `preserve_none`, como hace allí
`abi::v1::Code` (revisión 16): los cuerpos nunca retornan de forma normal, por
lo que no guardan registros preservados por el llamado; el registro rechaza un
módulo cuyo `code_convention` (0 ninguna, 1 C, 2 `preserve_none`) no es el del
runtime. Un `<symbol>` exportado conserva la firma `TermWord(Context *,
const TermWord *)` como entrada del host que llama a
`CLAUSE_invoke_v1(context, frame, arguments)`.

- Todo contexto empieza con un `abi::v1::FrameState` (revisión 9): bloque de
  pila, cima, límite de push, desplazamiento del marco actual, reducciones
  restantes, puntero de registros, número de registros vivos, bits lentos, la
  palabra de fallo y (revisión 12) las palabras libres del bloque de heap
  `[heap_top, heap_limit)`, una palabra del objetivo cada uno. Un cuerpo lee la
  cabecera de su marco (`stack + frame`) y los registros desde ahí a la entrada
  y hace un switch sobre la palabra de reanudación de la cabecera.
- Patrones de binary (objetivos de 64 bits): la prueba de inicio, la prueba de
  fin y los segmentos enteros de un ancho constante de bytes completos de hasta
  56 bits en una posición alineada a byte leen la celda en línea
  (`abi::v1::heap_binary_*_word`, `refc_*_word`: el `data_` de una vista fuera
  del heap es el primer byte de su búfer); los demás segmentos y las posiciones
  no alineadas llaman a `CLAUSE_bits_v1`. Un sujeto `sub_binary`
  (`sub_*_word`) se lee a través de su original. Un `Rest/binary` o
  `Rest/bits` final de unidad 1 se asigna en línea por incremento de puntero
  como una celda `sub_binary` de 4 palabras del original.
- Una construcción de binary cuyos bytes se conocen todos en tiempo de
  compilación (constantes enteras pequeñas y literales de cadena con anchos
  constantes de bytes completos, como máximo 64 bytes) es una celda de binary
  en línea del área de literales del módulo, como los demás literales
  compuestos.
- `Left ++ Right`, donde `Left` está escrito como una lista propia (un literal
  de cadena o una lista sin cola), se construye como `[E1, ..., En | Right]`,
  igual que hace el compilador de OTP, sin llamar a `erlang:'++'/2`.
- `erlang:make_tuple(N, V)` con un `N` pequeño en 1..64 asigna la tupla por
  incremento de puntero y la rellena con `llvm.experimental.memset.pattern`
  cuando el heap tiene espacio; en otro caso se ejecuta el builtin.
- Las construcciones de binary (objetivos de 64 bits) cuyos segmentos son todos
  enteros de anchos constantes de bytes completos de hasta 64 bits, con un
  total de 64 bytes como máximo, se asignan en línea por incremento de puntero
  como celdas `heap_binary` (cabecera, longitud en bits, palabras de datos a
  cero y después los bytes de cada segmento) cuando todos los valores son
  enteros pequeños y el heap tiene espacio; en otro caso las construye
  `CLAUSE_bits_v1`. Los mismos segmentos tras un acumulador de binary completo
  (`<<Acc/binary, ...>>`) se escriben en el búfer del acumulador cuando este es
  un `refc_binary` (o un `sub_binary` de uno) que termina, alineado a byte, en
  la `refc_append_end_word` de la celda con espacio por debajo de
  `refc_append_limit_word`: los bytes van tras el final, el final avanza y el
  resultado es un `sub_binary` de 4 palabras de esa celda.
- `+ - * /` (objetivos de 64 bits) con un operando flotante, y `/` de dos
  números cualesquiera, leen cada operando como un double (un entero pequeño
  convertido, el valor de una celda flotante leído mediante un select de su
  celda o de una celda sustituta constante, de modo que ninguna carga depende
  de una bifurcación), calculan en registros y asignan por incremento de
  puntero la celda flotante de 2 palabras cuando el resultado es finito, el
  divisor no es cero y el heap tiene espacio; en otro caso
  `CLAUSE_immediate_v1` lanza `badarith` o promociona.
- Las expresiones de map sin base cuyas claves son literales de átomo o de
  entero pequeño (como máximo 32 distintas) se escriben en línea como celdas de
  map clásico, con las claves ordenadas en tiempo de compilación en el orden
  exacto de términos y conservando el último valor de una clave repetida; en
  otro caso las construye `CLAUSE_map_v1`.
- Las tuplas y listas de como máximo 64 palabras se asignan en línea por
  incremento de puntero en `[heap_top, heap_limit)` (cabecera o celdas cons
  escritas en el sitio, `heap_top` avanzado); si no, las construye
  `CLAUSE_construct_v1`; el resultado se enraíza como la salida de un servicio.
  El runtime incorpora las palabras en línea a su contabilidad antes de cada
  operación de heap y reinicia ambos campos después; son nulos mientras no
  existe bloque de heap o se aplica un presupuesto de heap por proceso, de modo
  que entonces toda asignación llega al servicio
  ([heap](runtime-heap.md#areas)).
  `CLAUSE_frame_v1` y `CLAUSE_registers_v1` se mantienen para otros usos.
- Un cuerpo solo sale mediante llamadas `musttail`. Las llamadas, las llamadas
  de cola y los retornos se ejecutan en línea cuando pueden: una entrada gasta
  una reducción, apila el marco a cero y copia ella misma los argumentos, salvo
  que el heap quiera una recolección, el proceso esté perfilando, no queden
  reducciones, el push supere el límite o el llamado sea un builtin (cuerpo
  nulo); un retorno desapila en línea salvo que el proceso esté perfilando. En
  otro caso el código procede de `CLAUSE_enter_v1` (llamada), `CLAUSE_tail_v1`
  (llamada de cola) o `CLAUSE_return_v1` (retorno), que mantienen el estado
  actualizado.
- Toda transferencia pasa los primeros `abi::v1::register_arguments` (6 desde
  la revisión 17) registros X como parámetros C después del contexto: los
  argumentos iniciales de una llamada, el resultado de un retorno (como `x0`
  del cuerpo del llamador), cero para los no usados. Los argumentos restantes
  viajan en el array de registros. Alrededor de cada servicio de transferencia,
  el código generado almacena los parámetros en el array (los servicios y el
  recolector los leen allí) y los vuelve a cargar después. El runtime llama al
  código de la misma manera (`ProcessStack::run_code`), y el cuerpo de su marco
  inferior almacena `x0` en el primer registro para el host.
- Una entrada pone el marco a cero y copia en sus slots solo los argumentos que
  van después de los parámetros; un cuerpo mantiene un argumento de parámetro
  en su slot solo donde `lower_frames` lo vuelca a través de una llamada o un
  safepoint. Los valores evaluados no se almacenan de forma anticipada: el
  lowering marca los términos calculados (metadatos
  `clause.term`) y `lower_frames` da un slot de término solo a un valor que
  cruza una llamada o un safepoint; los arrays de argumentos de los servicios
  siguen pasando por slots raíz. Los candidatos que fallan limpian sus slots.
  Los valores que un cuerpo todavía necesita después de una llamada o de un
  safepoint en la cabecera de un bucle se vuelcan: los términos a slots de
  términos (contados en los `roots` del descriptor), las demás palabras a slots
  en bruto situados después; los slots en bruto no son raíces.
- Un resultado se pasa como `x0`; las cargas útiles de error son palabras raíz
  del canal (`fvalue` de BEAM). Un fallo vuelve al llamador como un resultado y
  todo llamador comprueba el canal después de la llamada; la palabra de
  manejador de la cabecera permanece en 0.
- La pila no tiene límite por defecto; un push que el host no puede asignar
  registra `out_of_memory`, y uno que supera un
  `StackOptions::limit_words` opcional por proceso registra `resource_limit`
  (fallos de infraestructura).
- Una llamada a un valor de función pasa sus argumentos, y después los valores
  capturados del fun, en los registros; `CLAUSE_apply_v1` devuelve el
  `FrameDescriptor` en el que entra la transferencia
  ([funs](funs.md#representation)).
- Safepoints: `CLAUSE_enter_v1`/`CLAUSE_tail_v1` recolectan antes de apilar el
  marco del llamado (sus argumentos son raíces en registros); el heap activa el
  bit `slow_collect` siempre que quiere una recolección, por lo que las
  entradas en línea nunca se saltan una. Y
  `CLAUSE_safepoint_v1(context)` en cada cabecera de bucle de una comprehension
  recolecta en el sitio; la cabecera lo llama solo mientras `FrameState::slow`
  tiene `slow_collect`, después gasta una reducción y, si no queda ninguna,
  entra en `erlang:self/0` (la entrada suspende el proceso), de modo que los
  bucles largos sin llamadas comparten el planificador. Todos los demás
  servicios son secciones críticas que nunca mueven el heap
  ([recolección en código generado](runtime-heap.md#collection-in-generated-code)).

## Servicios del runtime

El código generado llama a servicios C++ comprobados: `CLAUSE_exact_v1`
(igualdad exacta), `CLAUSE_immediate_v1` (predicados/consultas de inmediatos),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1` (el código generado ya no lo llama:
las formas y los campos de tupla y cons se prueban y se leen en línea),
`CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`,
`CLAUSE_record_v1` (make/get/update/match/test de native records bajo un
`RecordCheck`; resultados `bad_record`, `bad_field`, `no_match`),
`CLAUSE_make_fun_v1` (construye un fun a partir de un `FunDescriptor`). Cada uno
devuelve éxito, error semántico (`badarg`/`badarith`/...) o fallo de
infraestructura y escribe la salida solo en caso de éxito. `CLAUSE_display_v1`
([output.hpp](../abi/include/clause/abi/output.hpp))
imprime una línea de `erlang:display/1` y produce `true`; no tiene error
semántico. `CLAUSE_halt_v1` nunca tiene éxito: registra una solicitud de halt
(`CallError::halted` con el código de salida) o `badarg`, de modo que el llamador
deshace la pila. Las grafías del enlazador siguen el mangling de C++ Itanium o
Microsoft del objetivo.

Formas en línea (`codegen/lowering_inline.cpp`): las pruebas de tipo
(`is_atom`, `is_integer`, `is_number`, `is_boolean`, `is_tuple`, `is_list`,
`is_bitstring`, `is_float`, `is_map`, `is_pid`, `is_port`, `is_reference`,
`is_function/1`, `is_record/1` nativo, `is_binary/1` mediante la palabra de
longitud en bits) leen las etiquetas y, tras una prueba de etiqueta boxed, el
tipo de cabecera (`abi::v1::HeaderKind`); nunca llaman a un servicio. Las
comparaciones de dos inmediatos (`==`, `/=`) o de dos enteros pequeños (`<`,
`=<`, `>`, `>=`), `element/2`, `tuple_size/1`, `hd/1`, `tl/1`, los operadores
booleanos, `band`, `bor`, `bxor`, `bsr`, `bsl` (mientras el resultado siga
siendo pequeño) y `div`/`rem` pequeños se ejecutan en línea; `self/0` lee
`FrameState::self`. Se ejecutan en línea donde sus operandos lo permiten y, en
otro caso, llaman a `CLAUSE_immediate_v1`, que conserva todos los casos de
error y de bignum. `setelement/3` con un índice pequeño dentro de una tupla
boxed copia la tupla en las palabras libres del bloque de heap y reemplaza el
slot en línea; en otro caso, o sin espacio, entra en el builtin puente.

`CLAUSE_builtin_frame_v1(context, builtin)`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp))
devuelve el `FrameDescriptor` del builtin de producción con índice `builtin` en
`abi::v1::bridge_builtins` (solo se añade al final); el código generado entra en
él como en una función con los argumentos en los registros, y los errores y
fallos van al canal comprobado ([builtins](builtins.md)). Un `FrameDescriptor`
con cuerpo nulo es un builtin: entrar en él ejecuta el builtin sobre los
registros y vuelve al llamador, o suspende el proceso en la continuación del
builtin cuando este hizo un trap ([porciones](builtins.md#portions)).

`abi::v1::dispatch_builtin` llama a builtins registrados por el host mediante
los bytes de módulo/función, el array de argumentos y la aridad, y devuelve un
`Status`; la salida se escribe solo en caso de éxito.

| Status | Valor | Significado |
| --- | ---: | --- |
| `ok` | 0 | Éxito |
| `not_implemented` | 1 | Característica diferida conocida, notificada una vez |
| `invalid_argument` | 2 | Entrada inválida |
| `diagnostic_failure` | 3 | Falló la entrega del informe |
| `out_of_memory` | 4 | Falló la asignación, estado revertido |
| `busy` | 5 | Contextos vivos o despacho en ejecución |
| `wrong_owner` | 6 | El objeto pertenece a otro runtime/contexto |
| `resource_limit` | 7 | Límite o presupuesto agotado |
| `stopped` | 8 | El propietario se ha cerrado |
| `abi_mismatch` | 9 | La versión o el ancho de término difieren |
| `internal_error` | 10 | Fallo inesperado contenido |
| `unknown_builtin` | 11 | Firma no registrada ni catalogada |
| `erlang_error` | 12 | Error estructurado de Erlang registrado |
| `output_failure` | 13 | La salida estándar rechazó una escritura |

## Revisiones

| Revisión | Cambio |
| --- | --- |
| 1 | Descriptores y entradas iniciales |
| 2 | Canal de fallos comprobado |
| 3 | Grafías y slots de átomos en los descriptores |
| 4 | Ámbitos de raíces generados obligatorios |
| 5 | Marcos de proceso explícitos y transferencias |
| 6 | Descriptores de native record en los descriptores de módulo, `CLAUSE_record_v1` |
| 7 | Descriptores de funs en los descriptores de módulo, `CLAUSE_make_fun_v1`, `CLAUSE_apply_v1` |
| 8 | Los descriptores de exportación nombran su `FrameDescriptor`; servicios de llamada dinámica `CLAUSE_call_v1`, `CLAUSE_apply_list_v1`, `CLAUSE_call_list_v1`, `CLAUSE_make_external_fun_v1` |
| 9 | Todo contexto empieza con `abi::v1::FrameState`; transferencias en línea |
| 10 | Los registros X iniciales se pasan como parámetros del código |
| 11 | Palabras fijas de `false` y `true` |
| 12 | Campos de heap en línea `heap_top`/`heap_limit` en `FrameState` |
| 13 | `undefined`, `ok`, `error` fijos; `ModuleDescriptor::atom_cache` y `FrameState::runtime` |
| 14 | Áreas de literales del módulo: `ModuleDescriptor::literals`, `literal_words` |
| 15 | `FrameState::self`, la palabra pid del contexto |
| 16 | `Code` usa `preserve_none` en x86-64 y AArch64 con un runtime compilado con Clang; `ModuleDescriptor::code_convention` |
| 17 | Seis registros X como parámetros de `Code` (`register_arguments`) |
| 18 | Celdas `sub_binary` (`HeaderKind::sub_binary`, `sub_*_word`) y extracción en línea de `Rest` |
| 19 | Palabras de fin y límite de anexado en las celdas `refc_binary` (`refc_append_*_word`, 8 palabras de carga útil) y anexados en línea |
| 20 | `MapOperation::entries` y generadores de map en línea |
| 21 | `ModuleDescriptor::fun_cache` y clausuras en línea |
