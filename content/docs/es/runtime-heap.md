---
source: docs/runtime-heap.md
sourceCommit: 06042fa
sourceSha256: b86a14bcde03a998409e7048283225de3a5f8f84ded889ba64544a4671571cbc
translatedAt: 2026-10-09
---
# Contrato del heap de proceso

Los heaps de proceso siguen el diseño clásico de ERTS. Esta nota es el contrato;
el plan 11 phase C (steps 8A–8I) lo implementó, y los pasos posteriores
mencionados a continuación lo amplían.
[runtime.md](runtime.md#process-memory) resume la API.

## Qué sustituyó la phase C

| Antes de la phase C | Problema | Sustitución |
| --- | --- | --- |
| Una lista de bloques que nunca se mueven | Las celdas no se pueden compactar ni copiar; la capacidad solo crece | Un único bloque de heap contiguo más fragmentos, movido por un recolector de copia (8G, 8H) |
| Cada celda es un nodo en un índice `std::map` por proceso | Las palabras del heap por sí solas no se pueden analizar; una asignación del host y una búsqueda O(log n) por celda | Celdas autodescriptivas; admisión por rango propio y cabecera (8C, 8D) |
| Cada celda de bitstring tiene un array fijo de 64 bytes y un `shared_ptr`, liberados mediante un registro de destructores | Celdas grandes para datos pequeños; nada puede mover una celda ni encontrar sus copias muertas | Binaries de heap de tamaño variable y celdas de binary fuera del heap en una lista fuera del heap por proceso (8B) |
| El `Term` del host fija el heap con `shared_ptr<HeapStorage>`; los valores retenidos por el runtime viven solo en `Term`s | Nada que un recolector pueda encontrar o reescribir | Modelo de ERTS: C++ retiene palabras en bruto solo entre puntos seguros; los valores retenidos por el runtime son palabras raíz del proceso; quienes llaman desde el host pasan raíces explícitas a `collect()` (8E) |
| Un búfer de heap por cada marco raíz generado | No hay pila de proceso que recorrer | Una pila de marcos raíz por proceso (8F) |
| Sin área de desbordamiento | La asignación cabe en el presupuesto o falla | Fragmentos de heap mientras el heap no debe moverse (8G) |

El código generado, su ABI y todo resultado observable del programa permanecen
sin cambios.

## Disposición de palabras

Un término es una palabra del objetivo (32 o 64 bits); las codificaciones están
en [abi.md](abi.md#terms). Cada área del heap es una secuencia de objetos que un
recorredor analiza a partir de su primera palabra:

- **Palabra de cabecera** (etiqueta primaria `00`): los bits 2–6 contienen el
  `BoxedKind`, y los bits 7 en adelante el número de palabras que siguen a la
  cabecera. Un término boxed apunta a su cabecera. El recuento abarca todas las
  palabras de prefijo, carga útil y relleno, de modo que el recorredor salta la
  carga útil no trazada sin interpretarla.
- **Celda cons**: dos palabras de término (cabeza, cola) sin cabecera. Un
  término de lista apunta a la cabeza. Una cabeza nunca es una cabecera porque
  ningún término tiene la etiqueta `00`.
- **Relleno**: la palabra toda a cero (tipo `tuple`, recuento 0) es un relleno
  de una palabra; el tipo `filler` con recuento n cubre n palabras más. Las
  reservas empiezan a cero, por lo que las palabras reservadas pero no usadas se
  analizan como relleno. Las tuplas no vacías siempre tienen un recuento
  distinto de cero y `{}` es un inmediato.

Ninguna celda necesita una alineación mayor que una palabra. `memory/heap_walk`
analiza un área celda por celda y `ProcessHeap::verify`
comprueba un heap completo (8C). Las celdas contienen solo palabras y bytes,
excepto el `std::shared_ptr` del binary fuera del heap (más abajo), por lo que
una celda se mueve copiando sus palabras.

| Tipo | Palabras después de la cabecera | Palabras trazadas |
| --- | --- | --- |
| cons (sin cabecera) | 2 palabras en total | cabeza, cola |
| `tuple` | n slots de elementos | todas |
| `map` | 2n slots: claves en orden exacto de términos, cada una seguida de su valor | todas |
| `native_record` | dirección del `RecordDefinition` del runtime, y después n valores de campo en el orden de la definición | valores |
| `fun_closure` | dirección del `FunDefinition` del runtime, y después n valores capturados ([funs](funs.md)) | valores |
| `bignum` | palabra de signo, y después los limbs de la magnitud, del menos significativo al más significativo | ninguna |
| `floating` | 8 bytes: 1 palabra (64 bits) o 2 palabras (32 bits) | ninguna |
| `reference` | 8 bytes: el número de referencia ([pids y referencias](terms.md#pids-and-references)) | ninguna |
| `heap_binary` | longitud en bits, y después los bytes de datos redondeados a palabras (como máximo 64 bytes) | ninguna |
| `refc_binary` | desplazamiento en bits, longitud en bits, `std::shared_ptr` (2 palabras), enlace fuera del heap: 5 palabras | ninguna |
| `filler` | n palabras sin usar | ninguna |

El recuento de `map` está en palabras (entradas = recuento / 2). Los pids son
inmediatos, admitidos frente a los números emitidos por el runtime. Los tipos
aún no admitidos (identidades externas) seguirán las
mismas reglas cuando lleguen: las identidades y los descriptores son IDs de
registro en palabras no trazadas, nunca punteros C++ propietarios.

## Binaries fuera del heap

Un binary de más de 64 bytes es un búfer inmutable que flota fuera de todos los
heaps de proceso, compartido mediante recuento de referencias (ProcBin y
`Binary` de BEAM).

- Su celda boxed `refc_binary` contiene un `std::shared_ptr` al búfer, un
  desplazamiento en bits y una longitud en bits; los trozos de un binary grande
  son nuevas celdas `refc_binary` que comparten el búfer (no se usan los
  sub-binaries de ERTS). Copiar una celda a otro proceso copia el `shared_ptr`
  ([copia entre heaps](#copying-between-heaps)), nunca los bytes.
- Cada celda está enlazada a la lista fuera del heap de su proceso mediante su
  palabra de enlace. La lista es la única forma de encontrar el estado C++ de
  estas celdas.
- Mover una celda copia sus otras palabras y construye por movimiento el
  `shared_ptr` en la nueva celda, de modo que la copia antigua no posee nada.
  Tras una recolección, el barrido de la lista vuelve a enlazar las celdas
  movidas y destruye el `shared_ptr` de las muertas; el desmontaje las destruye
  todas. Un búfer se libera cuando muere su última celda, en cualquier proceso.
- Cada proceso cuenta sus celdas por búfer (`HeapStorage::buffers_`); un búfer
  se carga una vez a cada proceso que lo referencia (sus palabras fuera del
  heap, el heap binario virtual de ERTS) hasta que muere la última celda de ese
  proceso para él, y una vez a la cuenta de todo el runtime desde su creación
  hasta que el búfer se libera.
- `std::shared_ptr` son dos punteros en todas las STL soportadas; un
  `static_assert` mantiene el tamaño de la celda fijo en cinco palabras después
  de la cabecera en ambos anchos.

## Áreas

- **Heap.** Un bloque `[start, top, end)` por proceso con asignación por avance
  de puntero (8G). Se crea con la primera asignación del proceso, con tamaño
  `max(min_heap_words, request)` para que esa solicitud siempre quepa, y
  pertenece solo a ese proceso.
- **Fragmentos.** Cuando una solicitud no cabe y el heap no puede moverse, va
  al fragmento más reciente si cabe allí, y si no a un nuevo fragmento con el
  tamaño necesario (como mínimo el tamaño mínimo del heap) encadenado al
  proceso. La siguiente recolección fusiona los fragmentos en el nuevo bloque de
  heap. Una reserva vive en un área; la reversión restablece el `top` de esa
  área y descarta un fragmento (o el bloque de heap) que la reserva haya creado.
  La asignación nunca mueve el heap: el desbordamiento permanece en fragmentos
  hasta el siguiente safepoint o recolección del host
  ([recolección en código generado](#collection-in-generated-code)).
- **Pila.** Los marcos generados (registros Y de BEAM) viven en una pila plana
  por proceso, separada del heap (`ProcessStack`, step 19). Cada marco es una
  cabecera de cuatro palabras (desplazamiento de la cabecera del llamador,
  descriptor, reanudación, manejador) seguida de slots de términos (incluidos
  los términos volcados) y slots de volcado en bruto; los marcos
  se enlazan mediante desplazamientos, por lo que el
  bloque crece duplicándose y se mueve. No tiene límite por defecto; un
  `StackOptions::limit_words` opcional por proceso la limita por separado del
  heap ([modelo de ejecución](execution-model.md#implementation)).
- **Lista fuera del heap.** Como se describe arriba.
- **Heap antiguo.** Ninguno. La recolección generacional se ha aplazado; los
  términos inmutables nunca apuntan de datos más antiguos a más nuevos, por lo
  que más adelante se podrán añadir una marca de nivel máximo y un heap antiguo
  sin cambiar las celdas.

## Dimensionamiento y presupuesto

- El heap empieza en `min_heap_words` (233 palabras, como ERTS) y crece según la
  secuencia de tamaños de ERTS: 12, 38, después cada tamaño es la suma de los
  dos anteriores más uno hasta 833,026 palabras, y después en pasos del 20%
  (`heap_size_at_least`).
- El nuevo bloque de una recolección es el menor de esos tamaños que mantiene
  las palabras que puede recibir por debajo del 75% de él: en primer lugar
  todas las palabras usadas, ya que los datos vivos no se conocen antes de
  copiar. Un resultado con menos del 25% vivo se copia una vez más al tamaño que
  necesitan sus datos vivos (8H); si falla la asignación de ese bloque se
  conserva el mayor. Ninguno es menor que `min_heap_words`. Ambos tamaños
  cuentan como vivas las palabras de la pila del proceso (step 26), ya que ERTS
  mantiene la pila dentro del bloque de heap.
- Con un presupuesto establecido (más abajo), un nuevo bloque contiene como
  máximo sus palabras vivas más la mitad del presupuesto que queda después de
  ellas y de los búferes fuera del heap (`block_limit`, step 27), nunca menos
  que `min_heap_words`. La otra mitad queda libre para fragmentos y nuevos
  búferes fuera del heap, de modo que la basura asignada después de una
  recolección llega al siguiente safepoint como disparador en lugar de agotar el
  presupuesto. La primera copia se dimensiona a partir de todas las palabras
  usadas, por lo que un bloque que supera el límite para las palabras que
  sobrevivieron se copia una vez más a su tamaño según la política.
- No hay límite de memoria por defecto, ni por proceso ni para el runtime: el
  heap crece hasta que el host rechaza memoria (`out_of_memory`), mientras que
  el dimensionamiento anterior lo mantiene cerca de su tamaño vivo. Un
  presupuesto opcional por proceso, `HeapOptions::limit_bytes` (por defecto
  `UNLIMITED_HEAP_BYTES`), cubre el bloque de heap, los fragmentos y los bytes
  de los búferes fuera del heap que este proceso referencia; superarlo es
  `limit_exceeded`. Durante una recolección coexisten el bloque antiguo y el
  nuevo; solo el nuevo se comprueba frente al presupuesto, limitado al
  presupuesto que queda después de los búferes fuera del heap. La carga de un
  búfer se devuelve cuando el proceso descarta su última celda para él. La pila
  mantiene su propio límite opcional, `StackOptions::limit_words`. Los programas
  establecen ambos límites con `--max-heap` y `--max-stack`
  ([opciones del runtime](executables.md#runtime-options)).

## Límite de memoria del runtime

- Un límite opcional para todo el runtime, `RuntimeOptions::memory_limit_bytes`
  (por defecto `UNLIMITED_HEAP_BYTES`; los programas lo establecen con
  `--max-memory`), acota la memoria de todos los procesos juntos: bloques de
  heap, fragmentos, búferes fuera del heap y capacidad de pila (step 27A). OTP
  no tiene un límite así; lo más parecido es ejecutar la VM bajo un límite de
  memoria del sistema operativo, pero este hace fallar a un proceso en lugar de
  al nodo.
- Una cuenta por runtime (`detail::RuntimeMemory`, compartida por todos los
  almacenamientos de heap y pilas) se carga cuando se crea un bloque, un
  fragmento, un búfer fuera del heap o capacidad de pila, y se libera cuando se
  descarta; un búfer compartido por varios procesos se carga una vez y se libera
  cuando muere su última referencia (step 28). El desmontaje devuelve todas las
  cargas del proceso. `Runtime::memory_bytes()` informa del total.
- Para cada proceso, el límite actúa como un presupuesto del almacenamiento que
  posee más lo que el límite deja libre (`HeapStorage::budget`, `room`), de modo
  que el dimensionamiento anterior mantiene libre la mitad de la memoria libre
  después de cada recolección, y una solicitud que lo supere es
  `limit_exceeded` (`resource_limit`) solo para el proceso que la hace; los
  demás procesos siguen ejecutándose. La basura de otro proceso cuenta hasta que
  ese proceso recolecta.
- El espacio de destino de una recolección se carga incluso por encima del
  límite, porque sustituye a los bloques que libera al final de la misma
  recolección.
- La pila se duplica mientras el límite lo permite, y después crece solo en el
  tamaño del marco que se apila.

## Admisión

Los punteros a un heap de proceso solo los crean el compilador y el runtime
dentro de ese proceso, y siempre nombran el inicio de un objeto; no hay punteros
interiores que detectar. La admisión (8D) es una comprobación de propiedad para
las palabras que se devuelven a un proceso:

1. La dirección está alineada a palabra dentro de una de las áreas del proceso,
   por debajo de su `top`: primero se comprueba el bloque de heap y después los
   fragmentos ordenados por dirección. Las palabras ajenas y obsoletas fallan
   aquí sin ninguna carga.
2. Una palabra boxed nombra una cabecera de un tipo admitido (no relleno); una
   palabra de lista nombra una celda cons (una palabra que no es una cabecera).

Los accesores decodifican el tipo, el recuento y la carga útil a partir de la
propia cabecera. `verify()` sigue siendo la comprobación completa de que cada
slot nombra el inicio de un objeto, para las pruebas.

## Raíces y puntos seguros

`ProcessContext::visit_roots` enumera cada palabra raíz para el recolector
(step 23). En un punto seguro, nada más retiene palabras del heap del proceso:

| Propietario | Palabras raíz | Notas |
| --- | --- | --- |
| Slots de términos del marco | Los primeros `roots` slots de cada marco de la pila (step 19) | Los marcos inferiores no tienen ninguno; los índices de reanudación y de manejador son enteros |
| Slots en bruto del marco | Ninguna | Valores nativos volcados; el código generado no guarda ahí ninguna palabra del heap en un punto seguro (regla de recarga del step 24) |
| Registros | `x[0..live)` (`ProcessStack::keep_registers`) | Los argumentos de una entrada suspendida (step 43); cada push y pop limpia `live` |
| Canal de fallos | Carga útil de error (`fvalue` de BEAM), lista de argumentos de `erlang:error/2,3`, término de la traza de pila | Se revinculan en el sitio; los marcos de traza capturados son punteros a descriptores en el código |
| Estado de trap | Las palabras de término del `TrapState` de un builtin que hace trap (step 43A) | Se liberan cuando el builtin termina o falla |
| Buzón | Cada mensaje en la bandeja de señales y en la cola de mensajes (step 45), incluidos los mensajes `'EXIT'` y `'DOWN'` | Hasta que un receive lo toma; se reescriben en el sitio, por lo que el cursor del receive (una posición en la lista) y el plazo del timeout siguen siendo válidos |
| Raíces explícitas | El intervalo que el host pasa a `collect(roots)` (8E) | Se vuelven a leer después de la llamada |
| Lista fuera del heap | Ninguna | Los enlaces se barren y se vuelven a enlazar, no se trazan |

Ninguna celda del heap retiene una fijación. Los átomos son inmediatos y la
tabla de átomos nunca se recolecta. Las celdas de fun nombran el código a través
de su `FunDefinition` no trazado, que vive tanto como el runtime; los módulos
cargados nunca se descargan, por lo que ni los funs ni los descriptores de traza
necesitan una fijación. Los inmediatos pequeños no son
raíces.

Como en el código C de ERTS, un `Term` del host es una palabra etiquetada en
bruto válida hasta el siguiente punto seguro de su heap. No fija el
almacenamiento del heap; conserva un testigo débil de la vida del contexto y el
recuento de recolecciones del heap, de modo que el uso tras el desmontaje
informa de `expired_context` y el uso tras una recolección posterior informa de
un error de término obsoleto. Un `Term` solo es válido dentro de su propio
proceso; los demás procesos solo pueden leerlo.

El heap solo se mueve en un punto seguro, y nunca mientras haya una reserva
abierta:

- un `collect()` explícito del host mientras el contexto no ejecuta código
  generado;
- un `collect()` mientras el código generado en ejecución ha declarado un ámbito
  `SafePoint`, prometiendo que solo retiene palabras del heap en las raíces
  anteriores. El runtime solo abre uno en los safepoints del código generado de
  la siguiente sección.

Cualquier otra solicitud devuelve `unsafe_point` y no cambia nada, ni siquiera
el canal de fallos de una llamada generada en ejecución. La asignación nunca
mueve el heap: una solicitud que no cabe crea un fragmento.

## Recolección en código generado

Decisión del plan 11 step 24 (2026-10-06), implementada en el step 26
([implementación](#implementation)). El código
generado solo recolecta en unos pocos **safepoints** donde cada término vivo ya
está en una raíz. Todo lo demás, incluido cada servicio que asigna, es una
**sección crítica** que nunca mueve el heap.

### Disparadores

Un safepoint recolecta cuando el heap lo solicita; en otro caso cuesta una
comprobación.

| Disparador | Condición en el safepoint | Equivalente en ERTS |
| --- | --- | --- |
| Heap lleno | Existe algún fragmento: una asignación no cupo en el bloque de heap desde la última recolección | El top del heap alcanza el final del heap |
| Presión de binaries fuera del heap | Las palabras fuera del heap alcanzan el límite del heap binario virtual: 46,422 palabras al principio, después de cada recolección el doble de las palabras fuera del heap supervivientes, nunca menos que eso, pero como máximo los supervivientes más la mitad del presupuesto que queda libre después del bloque de heap (step 27) | `bin_vheap_sz` / heap binario virtual |
| `erlang:garbage_collect/0` | Siempre; llega con las familias de builtins (steps 36-37) como safepoint forzado | Barrido completo explícito |

El nuevo bloque se dimensiona para las palabras vivas **más las palabras de pila
en uso** (ERTS mantiene la pila dentro del bloque de heap): una pila profunda
obtiene un heap mayor, de modo que una recursión larga recolecta en proporción a
su asignación en lugar de volver a recorrer toda la pila cada pocos cientos de
palabras.

### Safepoints

| Punto | Dónde | Vivo fuera de los slots de términos del marco |
| --- | --- | --- |
| Entrada de función | En `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (y por tanto en la invocación del host), antes de apilar el marco del llamado | Los argumentos del llamado `x[0..arity)`, conservados como raíces (`keep_registers`) |
| Cabecera de bucle | Una llamada a `CLAUSE_safepoint_v1(context)` en la cabecera de cada bucle generador de una comprehension | Nada |

Todo bucle de Erlang es o bien una recursión, que pasa por una entrada de
función en cada paso, o bien una comprehension, que pasa por su cabecera de
bucle, de modo que la basura entre dos safepoints está acotada por el código
lineal y los resultados de servicios individuales.

No son safepoints (secciones críticas, que siguen asignando en fragmentos):
cualquier otro servicio del runtime, incluidos los servicios de asignación,
construcción y coincidencia; `CLAUSE_return_v1`; la propagación de excepciones;
y la posterior entrega de mensajes (step 45). Por tanto, los servicios pueden
retener palabras del heap en bruto en C++ durante toda su ejecución, y sus
arrays de entrada y sus salidas no necesitan recarga.

### Procesos en espera y suspendidos

Plan step 51. Un proceso que no se está ejecutando nunca se recolecta: está
esperando en un receive, en cola tras una cesión (yield) o un trap, o aún no ha
empezado, y todo lo que retiene ya es una raíz (sus marcos, los registros de la
entrada o continuación en la que se reanudará, el estado de trap y sus
mensajes). Los mensajes que se le envían se copian en fragmentos de su heap.
Cada entrega despierta a un proceso en espera, y reanudarlo repite la entrada de
su continuación (el builtin de espera, una continuación de trap o la función en
la que cedió), que es un safepoint de entrada de función: lo primero que hace un
proceso reanudado es recolectar cuando su heap lo solicita. Un proceso que
espera en un receive selectivo que salta muchos mensajes recolecta, por tanto, a
medida que llegan, igual que ERTS recolecta un proceso la próxima vez que se
planifica. `executables_mailbox_collection` comprueba la acumulación, la espera
con timeout y la recursión profunda bajo carga de mensajes, y que un consumidor
que confirma 3,000 mensajes se mantiene dentro de `--max-heap 65536`.

Descartado: la asignación como safepoint (`test_heap` de BEAM). Requeriría que
cada entrada de servicio y cada término SSA vivo a través de cualquier
asignación estuviera en una raíz, una recarga después de cada servicio que
asigna y un protocolo de reintento en cada servicio, mientras que los dos
safepoints anteriores ya acotan la basura.

### Regla de recarga

Ningún valor SSA (un valor en un registro nativo) retiene una palabra del heap a
través de un safepoint, y ningún puntero nativo atraviesa uno en absoluto (ya es
un error en `lower_frames`).

- `lower_frames` trata una llamada de safepoint en la cabecera de un bucle como
  el punto de reanudación de una llamada: divide el bloque después de la llamada
  y vuelca cada valor leído después de ella que se calculó antes. Un **valor de
  término** (una carga desde un slot de término o un registro, un valor
  almacenado en un slot de término, o un PHI de tales valores) se almacena
  después de su definición en su slot de término existente o en un nuevo slot
  de término contado en los `roots` del descriptor, y se recarga antes de cada
  uso. Las demás palabras (inmediatos pequeños, átomos, enteros en bruto, flags)
  conservan slots en bruto: una recolección nunca las cambia.
- Las llamadas vuelcan y recargan de la misma manera, los términos en slots de
  términos, de modo que el safepoint de entrada ve cada término vivo de cada
  llamador.
- La base del marco sigue siendo válida a través de un safepoint de cabecera de
  bucle, porque una recolección reescribe las palabras de la pila en el sitio y
  nunca mueve la pila; cada transferencia la vuelve a leer en el prólogo del
  cuerpo como antes.
- La optimización se ejecuta después de `lower_frames` y no puede sustituir una
  recarga por el valor SSA anterior: la dirección del marco proviene de
  `CLAUSE_frame_v1`, por lo que la llamada de safepoint puede escribir cualquier
  slot (prototipo más abajo).

### Comportamiento ante fallos

- Una recolección en un safepoint nunca registra un fallo. Cuando no se puede
  asignar su nuevo bloque (`out_of_memory`), el heap se queda como está y la
  ejecución continúa con fragmentos.
- **Agotamiento de memoria** (step 27). Sin límite, la memoria solo se agota
  cuando el host rechaza un bloque de heap, un fragmento, un búfer fuera del
  heap o el crecimiento de la pila: `out_of_memory`. Con un presupuesto opcional
  o un [límite para todo el runtime](#runtime-memory-limit) establecido, una
  solicitud que lo supere es `limit_exceeded`, notificado como
  `resource_limit`. Ambos son fallos de infraestructura: no se ejecuta ningún
  manejador, los marcos se deshacen hasta el marco inferior y el programa
  imprime `clau: runtime failure: entry call failed: <status>`
  y termina con el código 70 tras vaciar stdout y destruir el proceso
  ([ejecutables](executables.md#exit-status), [diferencias](differences.md)).
  Como cada recolección mantiene libre la mitad del presupuesto que queda
  después de sus supervivientes
  ([dimensionamiento](#sizing-and-budget), [disparadores](#triggers)), un
  presupuesto solo falla cuando el conjunto vivo ya no cabe o cuando el código
  lineal entre dos safepoints asigna más que esa mitad; la basura se recolecta
  primero.

### Implementación

Step 26 (2026-10-06):

- `ProcessStack::safepoint(live)` pregunta a `ProcessHeap::wants_collection()`
  (existe un fragmento, o las palabras fuera del heap alcanzaron
  `binary_limit_words_`), conserva `x[0..live)` como raíces, abre un
  `SafePoint` y recolecta; una recolección fallida se ignora. `enter` (y por
  tanto `tail` e `invoke`) la llama con la aridad del llamado antes de apilar;
  `CLAUSE_safepoint_v1` la llama con 0.
- El lowering de comprehensions emite `CLAUSE_safepoint_v1` en la cabecera de
  cada bucle generador (`lowering_comprehensions`).
- `lower_frames` divide cada cuerpo después de una llamada de safepoint y
  vuelca los valores que la atraviesan como después de una llamada. `home()`
  conserva el slot de argumento o un slot de término del mismo bloque cuando
  uno contiene el valor; en otro caso, un valor de término (`term_value`:
  cargado desde un slot de término o un registro, almacenado en un slot de
  término, o un PHI de ellos) obtiene un nuevo slot de término, que
  `place_slots` añade a los slots de términos iniciales antes de los slots en
  bruto, y cualquier otro valor obtiene un slot en bruto.
- El golden `executables_garbage_collection` (generado con OTP) asigna más de
  64 MiB con un conjunto vivo pequeño: un bucle de cola que construye una
  cadena de 400 palabras por paso, 9,000 binaries fuera del heap de 8 KiB, una
  comprehension cuyo filtro asigna por elemento, una recursión en el cuerpo de
  20,000 niveles que conserva un término anidado (tupla, lista, binary) por
  marco, y una carga útil de error capturada tras deshacer marcos que asignan y
  conservada a lo largo de un bucle largo que asigna.

Step 27 (2026-10-06):

- `collected_size` limita el bloque a `block_limit(live)`; `shrink` también se
  ejecuta cuando el bloque supera el límite de las palabras supervivientes;
  `collect` limita `binary_limit_words_` a los supervivientes más la mitad del
  presupuesto que queda libre después del bloque.
- Antes, un bloque podía ocupar todo el presupuesto restante (dimensionado a
  partir de las palabras usadas, incluida la basura) y el heap binario virtual
  podía superarlo una vez que los supervivientes pasaban de la mitad del
  presupuesto, de modo que las asignaciones fallaban con basura aún sin
  recolectar: con el presupuesto de 64 MiB entonces predeterminado, una
  ejecución de 64 bits que retenía 700 binaries de 64 KiB mientras descartaba
  cuatro por paso fallaba con un 68% vivo; con los límites, caben 1,010 (99%).
- Se eliminaron el presupuesto de heap predeterminado de 64 MiB y el presupuesto
  de pila de 2^24 palabras (por indicación del usuario): ambos son opcionales
  por proceso (`Runtime::create_context(HeapOptions, StackOptions)`), sin límite
  por defecto.
- El golden `executables_heap_growth` conserva 1,100 binaries de 65,540 bytes
  (72 MB) mientras descarta cuatro por paso e imprime el recuento como lo hace
  OTP. `runtime_collection` `near_budget` comprueba ambos límites con un
  presupuesto de 10,000 palabras (bloque de heap y búferes fuera del heap).

Step 27A (2026-10-06):

- Límite para todo el runtime y `--max-heap`, `--max-stack`, `--max-memory`
  ([límite de memoria del runtime](#runtime-memory-limit)). Ejecuciones golden
  escritas a mano demuestran de nuevo una memoria acotada:
  `garbage_collection` `churn` y `binaries` bajo un límite de runtime de 1 MiB,
  `comprehension` bajo un límite de heap de 1 MiB y `payload` bajo un límite de
  runtime de 16 MiB (cada una asigna más de 64 MiB); los bucles de `tail_calls`
  bajo un límite de pila de 4 KiB y de heap de 64 KiB; `deep` bajo 1 MiB y
  `deep_recursion` `build` bajo una pila de 64 KiB fallan con
  `resource_limit`. El propio `deep` necesita unos 100 MiB en O0 (los marcos
  vivos conservan términos obsoletos y ocupan unas 130 palabras cada uno), por
  lo que no tiene una ejecución con límite que tenga éxito.
  `runtime_collection` `shared_limit`: dos procesos bajo un límite de 40,000
  palabras; el bloque del proceso que retiene se detiene en 28,000 palabras, el
  otro recolecta 20 rondas de basura cerca del límite y después falla una lista
  de 16,000 palabras con `resource_limit` mientras el que retiene sigue
  asignando, y el desmontaje devuelve todas las cargas.

### Prototipo

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) contiene un bucle
al estilo de una comprehension en forma posterior a `lower_frames` (`loop.ll`):
un término `Y` calculado antes del bucle se almacena en un slot de término y se
recarga después del safepoint de la cabecera del bucle.
`python tests/prototypes/safepoint/run.py` lo compila para
`x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu` (palabras de 64 bits),
`i686-pc-windows-msvc` y `armv7-unknown-linux-gnueabihf` (palabras de 32 bits)
en O0 y O2 y comprueba que una carga de la palabra del marco de `Y` sigue a la
llamada de safepoint. Las ocho pasan con clang 23.1.2. En O2 (i686) el bucle
conserva la recarga del slot y nunca reutiliza el registro que contenía `Y`:

```text
LBB0_2:                     # loop head
    pushl  %edi
    calll  _clause_safepoint_v1
    pushl  20(%esi)         # cursor reloaded from its term slot
    ...
    pushl  24(%esi)         # accumulator
    pushl  28(%esi)         # Y reloaded from its term slot
    calll  _make
```

## Recolección

Una copia de Cheney de barrido completo (8H, `memory/heap_collect`): primero se
asigna el nuevo bloque (un fallo es `out_of_memory` y deja el heap intacto),
después se marcan como obsoletos los `Term`s del host, se copia el objeto
detrás de cada palabra raíz y se recorre el nuevo bloque de izquierda a derecha,
copiando los hijos de cada copia. La cabecera de un objeto boxed movido se
sustituye por un puntero boxed a su copia; una celda cons movida recibe una
cabeza a cero y una cola que apunta a su copia. El reenvío preserva la
compartición. Las raíces se reescriben en el sitio, se barre la lista fuera del
heap (las copias se vuelven a enlazar en el orden de la lista y las celdas
muertas se destruyen), y se liberan el bloque antiguo y los fragmentos. Un heap
que nunca se asignó no se recolecta. `CollectionStats` informa de las palabras
anteriores, las palabras vivas, el nuevo bloque de heap, los fragmentos
fusionados, la capacidad de slots de la pila y las palabras fuera del heap.

## Copia entre heaps

`ProcessHeap::add(value)`, o equivalentemente `value.copy_to(heap)`, devuelve un
término del heap de destino (step 28, `size_object` y `copy_struct` de BEAM):

- Los inmediatos y los átomos del mismo runtime no necesitan almacenamiento, y
  un término del heap de destino conserva su identidad. Un grafo de otro proceso
  del mismo runtime se copia; el grafo de otro runtime es `wrong_owner`, un
  origen caducado es `expired_context`, y un handle de origen anterior a la
  última recolección de su heap es `stale_term`. Las factorías siguen
  rechazando entradas ajenas (`ProcessHeap::retain`), por lo que solo una copia
  explícita mueve un grafo.
- Un único recorrido con una pila explícita (sin recursión) encuentra cada
  objeto distinto alcanzable desde el valor, indexado por dirección, de modo que
  la compartición interna se conserva: `{T, T}` copia `T` una sola vez, a
  diferencia del `copy_struct` predeterminado de ERTS, que aplana la
  compartición. La copia es una única reserva de la suma de sus palabras, en el
  bloque de heap o en un fragmento, rellenada en el orden del recorrido con los
  punteros reescritos hacia las copias.
- La copia de un binary fuera del heap es una nueva celda que comparte el búfer;
  el destino retiene el búfer (cargando sus propias palabras fuera del heap si
  no retenía nada de él) antes de reservar, y solo añade la celda a la lista
  después de que se confirme la reserva.
- El origen solo se lee. Un fallo (`resource_limit` por el presupuesto del
  destino o el límite del runtime, `out_of_memory` por el host) suelta las
  retenciones de búferes y revierte la reserva, de modo que ambos heaps y todas
  las cargas quedan como antes. Una copia no posee almacenamiento del origen:
  sobrevive a la recolección y al desmontaje del origen.

## Mediciones

`runtime_heap_measurements` (CTest en modo completo; los números se imprimen,
no actúan como puerta) construye una lista de 100,000 elementos de tuplas
`{Index, Float}` mediante `TermFactory`, la recorre de vuelta mediante accesores
comprobados y crea 1,000 contextos que retienen cada uno una tupla pequeña.
Desde 8I también recolecta con la lista como única raíz y recorre la copia. Los
bytes laterales son asignaciones del host más allá del respaldo del heap (un
índice de objetos antes de 8D, la cadena de fragmentos desde 8G).

| Revisión | Compilación | Construcción del kernel / recorrido | Palabras de heap usadas / capacidad | Bytes laterales | Bytes por contexto | Palabras de heap por contexto |
| --- | --- | --- | --- | --- | --- | --- |
| `bb09359` (lista de bloques, índice de objetos) | Windows x64 Debug, clang-cl | 264 / 81 ms | 700,000 / 704,512 | 24,002,256 (unos 80 por celda) | 66,217 | 8,192 |
| 8D (lista de bloques, rango propio) | Windows x64 Debug, clang-cl | 185 / 147 ms | 700,000 / 704,512 | 3,440 | 66,057 | 8,192 |
| 8G (heap de 233 palabras, unos 3,000 fragmentos) | Windows x64 Debug, clang-cl | 219 / 174 ms | 700,000 / 706,223 | 163,878 | 2,377 | 233 |
| 8I, antes de la recolección | Windows x64 Debug, clang-cl | 216 / 173 ms | 700,000 / 706,223 | 163,878 | 2,377 | 233 |
| 8I, después de una recolección | Windows x64 Debug, clang-cl | recolección 56 ms / recorrido 72 ms | 700,000 / 999,631 | 0 | — | — |

Frente a la línea base `bb09359`: los metadatos laterales por celda han
desaparecido (de 24 MB a ninguno una vez recolectado), un contexto necesita
2.4 KB y 233 palabras de heap en lugar de 66 KB y 8,192 palabras, la
construcción es aproximadamente un 20% más rápida, y el recorrido es más lento
hasta que una recolección fusiona los fragmentos (la admisión de fragmentos es
una búsqueda binaria sobre unos 3,000 rangos); después de una, el recorrido
tarda 72 ms. Un conjunto vivo de 700,000 palabras se recolecta en unos 56 ms en
un bloque de 999,631 palabras, el tamaño de ERTS que lo mantiene por debajo del
75%.
