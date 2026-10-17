---
source: docs/runtime-heap.md
sourceCommit: a8c3f8f6
sourceSha256: cc0485350969c6f992d4987c8f893772eef2f3b1d7b9f3315e20c63541a45bc8
translatedAt: 2026-10-17
---
# Contrato del heap de proceso

Los heaps de proceso siguen el diseño clásico de ERTS: un bloque de heap
contiguo por proceso más fragmentos de desbordamiento, celdas autodescriptivas,
binaries grandes en búferes compartidos fuera del heap y un recolector de copia
que solo se ejecuta en puntos seguros. Esta nota es el contrato;
[runtime.md](runtime.md#process-memory) resume la API del host.

## Disposición de palabras

Un término es una palabra del destino (32 o 64 bits); las codificaciones están
en [abi.md](abi.md#terms). Cada área del heap es una secuencia de objetos que un
recorredor analiza a partir de su primera palabra:

- **Palabra de cabecera** (etiqueta primaria `00`): los bits 2–6 contienen el
  `BoxedKind`, y los bits 7 en adelante el número de palabras que siguen a la
  cabecera. Un término boxed apunta a su cabecera. El recuento abarca todas las
  palabras de prefijo, carga útil y relleno, de modo que el recorredor salta la
  carga útil no trazada sin interpretarla. Tiene 25 bits en destinos de 32 bits
  (como máximo 33.554.431 palabras) y 57 en los de 64 bits
  (`BoxHeader::MAX_COUNT`): el límite de aridad de tupla (2^24 - 1) y el mayor
  bignum (131.072 palabras en 32 bits) caben por aserción estática, los maps lo
  comprueban al construirse, y las celdas cons y las celdas de tamaño fijo no
  tienen recuentos grandes.
- **Celda cons**: dos palabras de término (cabeza, cola) sin cabecera. Un
  término de lista apunta a la cabeza. Una cabeza nunca es una cabecera porque
  ningún término tiene la etiqueta `00`.
- **Relleno**: la palabra toda a cero (tipo `tuple`, recuento 0) es un relleno
  de una palabra; el tipo `filler` con recuento n cubre n palabras más. Las
  reservas empiezan a cero, por lo que las palabras reservadas pero no usadas
  se analizan como relleno. Las tuplas no vacías siempre tienen un recuento
  distinto de cero y `{}` es un inmediato.

Ninguna celda necesita una alineación mayor que una palabra. `memory/heap_walk`
analiza un área celda por celda y `ProcessHeap::verify` comprueba un heap
completo. Las celdas contienen solo palabras y bytes, excepto el
`std::shared_ptr` del binary fuera del heap (más abajo), por lo que una celda se
mueve copiando sus palabras.

| Tipo | Palabras después de la cabecera | Palabras trazadas |
| --- | --- | --- |
| cons (sin cabecera) | 2 palabras en total | cabeza, cola |
| `tuple` | n slots de elementos | todas |
| `map` | 2n slots: claves en orden exacto de términos, cada una seguida de su valor; como máximo 32 entradas | todas |
| `tree_map` | número de entradas, palabra de edición, `map_node` raíz: 3 palabras ([árboles de maps](#map-trees)) | la raíz |
| `map_node` | entradas por debajo, palabra de edición, y después n claves y n valores (una hoja) o n hijos (una rama); nunca es un término | claves y valores, o hijos |
| `native_record` | dirección del `RecordDefinition` del runtime, y después n valores de campo en el orden de la definición | valores |
| `fun_closure` | dirección del `FunDefinition` del runtime, y después n valores capturados ([funs](funs.md)) | valores |
| `bignum` | palabra de signo, y después los limbs de la magnitud, del menos significativo al más significativo | ninguna |
| `floating` | 8 bytes: 1 palabra (64 bits) o 2 palabras (32 bits) | ninguna |
| `reference` | 8 bytes: el número de referencia ([pids y referencias](terms.md#pids-and-references)) | ninguna |
| `heap_binary` | longitud en bits, y después los bytes de datos redondeados a palabras (como máximo 64 bytes) | ninguna |
| `refc_binary` | desplazamiento en bits, longitud en bits, el primer byte del búfer (leído por el código generado), fin y límite de anexado, `std::shared_ptr` (2 palabras), enlace fuera del heap: 8 palabras | ninguna |
| `sub_binary` | desplazamiento en bits dentro del original, longitud en bits, el `heap_binary` o `refc_binary` original (nunca un sub-binary): 3 palabras | el original |
| `filler` | n palabras sin usar | ninguna |

El recuento de `map` está en palabras (entradas = recuento / 2). Los pids y los
puertos son inmediatos, admitidos frente a los números emitidos por el runtime.

## Binaries fuera del heap

Un binary de más de 64 bytes es un búfer inmutable que flota fuera de todos los
heaps de proceso, compartido mediante recuento de referencias (ProcBin y
`Binary` de BEAM).

- Su celda boxed `refc_binary` contiene un `std::shared_ptr` al búfer, un
  desplazamiento en bits y una longitud en bits. Los trozos de un binary grande
  (y los trozos de estos) son celdas `sub_binary` que nombran la celda
  original, como hacen los sub-binaries de ERTS: un trozo no toma ninguna
  referencia al búfer y mantiene vivo el original. Copiar una celda a otro
  proceso copia el `shared_ptr`
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
  `static_assert` mantiene el tamaño de la celda fijo en ocho palabras después
  de la cabecera en ambos anchos.

### Referencias handle

Una referencia handle es una referencia que además retiene un búfer fuera del
heap, igual que una referencia mágica de OTP retiene un recurso; los arrays de
`atomics` viven en ellas
([atomics y counters](builtins.md#atomics-and-counters)).

- Su celda tiene el tipo `reference` y la disposición de `refc_binary`: ocho
  palabras después de la cabecera, el número de referencia de 64 bits en las
  palabras de desplazamiento y de longitud en bits (donde lo guarda una celda
  de referencia simple), y después el `shared_ptr` y la palabra de enlace. Todo
  servicio de referencias lee solo el número, por lo que se compara, se calcula
  su hash, se imprime y se codifica como una referencia simple.
- Se enumera, se mueve, se barre, se carga y se copia exactamente igual que una
  celda de binary fuera del heap (`layout::off_heap_cell`); su búfer se libera
  cuando muere la última copia de la referencia en cualquier proceso.
- Un registro de todo el proceso asocia los números de los handles vivos con
  sus búferes (referencias débiles), de modo que `binary_to_term/1` de un
  handle codificado reconstruye un handle que comparte el búfer mientras este
  vive, y una referencia simple después. Las entradas caducadas se descartan a
  medida que crece el registro.

## Árboles de maps

Un map con más de 32 entradas (`MAP_SMALL_MAP_LIMIT` de OTP) es un stub
`tree_map` de 4 palabras que nombra la raíz de un árbol B+ persistente
(`terms/map_tree`) cuyos nodos son celdas `map_node` del mismo heap, igual que
OTP mantiene en el heap los nodos de su HAMT. Los maps más pequeños siguen
siendo celdas `map`.

- Las hojas contienen hasta 16 palabras de clave y valor en el orden exacto de
  claves; las ramas contienen hasta 16 hijos con sus primeras claves, y cada
  nodo cuenta las entradas que tiene por debajo, por lo que la búsqueda y el
  acceso por posición son O(log n). Todo nodo salvo la raíz está al menos medio
  lleno.
- Una actualización copia el camino hasta la hoja modificada (unas 35 palabras
  por nivel) y comparte todos los demás nodos con el map de origen, que
  permanece sin cambios, de modo que construir un map clave a clave cuesta
  O(n log n) en lugar de O(n^2). Primero cuenta las palabras del camino y las
  asigna una sola vez; una actualización fallida las revierte.
- Los nodos son celdas ordinarias: las recolecciones los mueven, los promueven
  y los liberan, las versiones muertas no cuestan nada, y cuentan en
  `heap_size`, no como palabras fuera del heap. Copiar un map a otro heap
  (mensajes) copia sus nodos como cualquier otra celda.
- Cada stub y cada nodo llevan una palabra de edición: el testigo de la
  actualización que los creó, por encima de un bit de hoja. Los nodos con el
  testigo propio de la actualización cambian en el sitio (una actualización de
  varias claves escribe cada nodo una sola vez). Los testigos emitidos antes de
  la última recolección no permiten cambios en el sitio, ya que la recolección
  puede haber promovido los nodos, y una copia a otro heap borra el testigo.
- Una actualización propia (`MapOperation::update_owned`) cuyo origen el
  compilador demostró que no se vuelve a leer consume el stub de origen (raíz
  `[]`, tamaño 0) y reutiliza su testigo mientras sea vigente, de modo que
  cambia en el sitio los nodos que creó la actualización del propio origen y
  copia el resto del camino. Una actualización propia fallida devuelve el árbol
  al stub. El compilador marca una actualización como propia solo cuando la
  función construyó ella misma el map de origen (`M = <map expression or
  comprehension>` en el mismo cuerpo de cláusula), no lee `M` en ningún otro
  lugar y nunca lo captura en un fun (`semantic/map_ownership`).

## Áreas

- **Heap.** Un bloque `[start, top, end)` por proceso con asignación por avance
  de puntero. Se crea con la primera asignación del proceso, con tamaño
  `max(min_heap_words, request)` para que esa solicitud siempre quepa (los
  fragmentos empiezan en el mínimo, como máximo 233 palabras, y después crecen,
  véase más abajo), y pertenece solo a ese proceso. El código generado asigna
  directamente en él tuplas, listas, flotantes y closures pequeños por avance de
  puntero mediante `FrameState::heap_top`/`heap_limit`: `HeapStorage::absorb`
  incorpora esas palabras al `top` y a `used_words_` antes de cualquier
  operación de heap (reserva, admisión, recolección, verificación, consultas de
  uso) y `expose` vuelve a mostrar las palabras libres después. La asignación
  en línea nunca crea un fragmento y queda desactivada bajo un presupuesto por
  proceso. Cuando al bloque le quedan menos de 64 palabras libres, `expose`
  muestra en su lugar el fragmento propio más reciente del proceso (nunca un
  bloque de mensaje adoptado), de modo que la asignación entre dos safepoints,
  como los retornos de una recursión en el cuerpo, sigue siendo en línea tras
  abrirse el primer fragmento (ventanas de fragmento). Sin presupuesto, cada
  fragmento nuevo es al menos tan grande como los anteriores.
- **Áreas de literales.** Los literales compuestos de cada módulo (cadenas y
  listas constantes, tuplas de constantes, flotantes, literales bignum y
  binaries constantes) los dispone el compilador como celdas de heap en una
  única variable global de solo lectura (`ModuleDescriptor::literals`),
  registrada para todo el runtime (`detail::LiteralAreas`, una instantánea
  ordenada sin bloqueos) cuando se registra el módulo. Los términos de
  cualquier proceso pueden apuntar a ellas: la admisión y `TermAccess::object`
  leen las celdas mediante `HeapStorage::readable` (heap, fragmentos y después
  literales); el recolector deja las palabras de literales tal como están
  (`owned` sigue siendo solo del heap); las copias entre heaps y hacia búferes
  de mensajes siguen apuntando a ellas (una raíz literal no necesita copia); el
  verificador las acepta. Los literales contienen solo inmediatos (solo átomos
  fijos) y palabras de otros literales.
- **Fragmentos.** Cuando una solicitud no cabe y el heap no puede moverse, va
  al fragmento más reciente si cabe allí, y si no a un nuevo fragmento con el
  tamaño necesario (como mínimo el tamaño mínimo del heap) encadenado al
  proceso. La siguiente recolección fusiona los fragmentos en el nuevo bloque
  de heap. Una reserva vive en un área; la reversión restablece el `top` de esa
  área y descarta un fragmento (o el bloque de heap) que la reserva haya
  creado. La asignación nunca mueve el heap: el desbordamiento permanece en
  fragmentos hasta el siguiente safepoint o recolección del host
  ([recolección en código generado](#collection-in-generated-code)).
- **Pila.** Los marcos generados viven en una pila plana por proceso, separada
  del heap (`ProcessStack`,
  [modelo de ejecución](execution-model.md#implementation)). No tiene límite
  por defecto; un `StackOptions::limit_words` opcional por proceso la limita
  por separado del heap.
- **Lista fuera del heap.** Como se describe arriba.
- **Área antigua.** Los objetos que sobrevivieron a dos recolecciones
  ([generaciones](#generations)); las recolecciones menores la dejan en su
  sitio, y un barrido completo la copia en el nuevo bloque y la libera.

## Dimensionamiento y presupuesto

- `min_heap_words` es el `min_heap_size` del proceso: 233 palabras por defecto
  (como ERTS), `--min-heap-size` para todos los procesos (`+hms` de ERTS),
  `{min_heap_size, N}` en `spawn_opt` o `process_flag(min_heap_size, N)` para
  uno; un ajuste se redondea hacia arriba a un tamaño de heap y nunca queda por
  debajo del valor por defecto del runtime, y `process_flag` surte efecto en la
  siguiente recolección. Como ningún bloque es menor, un proceso no recolecta
  antes de haber asignado esa cantidad de palabras.
- El heap empieza en `min_heap_words` y crece según la secuencia de tamaños de
  ERTS: 12, 38, después cada tamaño es la suma de los dos anteriores más uno
  hasta 833.026 palabras, y después en pasos del 20% (`heap_size_at_least`).
- El nuevo bloque de una recolección es el menor de esos tamaños que mantiene
  las palabras que puede recibir por debajo del 75% de él: en primer lugar
  todas las palabras usadas, ya que los datos vivos no se conocen antes de
  copiar. Un resultado con menos del 25% vivo se copia una vez más al tamaño
  que necesitan sus datos vivos; si falla la asignación de ese bloque se
  conserva el mayor. Ninguno es menor que `min_heap_words`. Ambos tamaños
  cuentan como vivas las palabras de la pila del proceso, ya que ERTS mantiene
  la pila dentro del bloque de heap.
- Con un presupuesto establecido (más abajo), un nuevo bloque contiene como
  máximo sus palabras vivas más la mitad del presupuesto que queda después de
  ellas y de los búferes fuera del heap (`block_limit`), nunca menos que
  `min_heap_words`. La otra mitad queda libre para fragmentos y nuevos búferes
  fuera del heap, de modo que la basura asignada después de una recolección
  llega al siguiente safepoint como disparador en lugar de agotar el
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
  mantiene su propio límite opcional, `StackOptions::limit_words`. Los
  programas establecen ambos límites con `--max-heap` y `--max-stack`
  ([opciones del runtime](executables.md#runtime-options)).

## Bloques de heap

Los bloques de heap, los fragmentos y las áreas antiguas provienen de
`memory/heap_blocks`. Un bloque que libera una recolección se queda con su hilo
para las siguientes recolecciones de ese hilo (igual que los carriers de ERTS
conservan memoria): un bloque nuevo toma el menor bloque en caché de al menos su
tamaño y como máximo el doble, y si no, memoria nueva. Cada hilo conserva como
máximo 8 bloques y 4M palabras (32 MB en destinos de 64 bits); los bloques de
menos de 4.096 palabras no se conservan, ya que las listas libres del heap de
C++ los sirven de forma barata. Sin esto, el espacio de destino de cada
recolección tomaba páginas nuevas del sistema operativo y pagaba un fallo de
página por cada página que tocaba, y liberar un bloque grande devolvía sus
páginas. Los bloques en caché no se cargan a ningún proceso ni a la cuenta de
todo el runtime; un hilo libera su caché cuando termina.

## Límite de memoria del runtime

- Un límite opcional para todo el runtime, `RuntimeOptions::memory_limit_bytes`
  (por defecto `UNLIMITED_HEAP_BYTES`; los programas lo establecen con
  `--max-memory`), acota la memoria de todos los procesos juntos: bloques de
  heap, fragmentos, búferes fuera del heap y capacidad de pila. OTP no tiene un
  límite así; lo más parecido es ejecutar la VM bajo un límite de memoria del
  sistema operativo, pero este hace fallar a un proceso en lugar de al nodo.
- Una cuenta por runtime (`detail::RuntimeMemory`, compartida por todos los
  almacenamientos de heap y pilas) se carga cuando se crea un bloque, un
  fragmento, un búfer fuera del heap o capacidad de pila, y se libera cuando se
  descarta; un búfer compartido por varios procesos se carga una vez y se
  libera cuando muere su última referencia. El desmontaje devuelve todas las
  cargas del proceso. `Runtime::memory_bytes()` informa del total.
- Para cada proceso, el límite actúa como un presupuesto del almacenamiento que
  posee más lo que el límite deja libre (`HeapStorage::budget`, `room`), de
  modo que el dimensionamiento anterior mantiene libre la mitad de la memoria
  libre después de cada recolección, y una solicitud que lo supere es
  `limit_exceeded` (`resource_limit`) solo para el proceso que la hace; los
  demás procesos siguen ejecutándose. La basura de otro proceso cuenta hasta
  que ese proceso recolecta.
- El espacio de destino de una recolección se carga incluso por encima del
  límite, porque sustituye a los bloques que libera al final de la misma
  recolección.
- La pila se duplica mientras el límite lo permite, y después crece solo en el
  tamaño del marco que se apila.

## Admisión

Los punteros a un heap de proceso solo los crean el compilador y el runtime
dentro de ese proceso, y siempre nombran el inicio de un objeto; no hay
punteros interiores que detectar. La admisión es una comprobación de propiedad
para las palabras que se devuelven a un proceso:

1. La dirección está alineada a palabra dentro de una de las áreas del proceso,
   por debajo de su `top`: primero se comprueba el bloque de heap, después los
   fragmentos ordenados por dirección y después las áreas de literales
   ([áreas](#areas)). Las palabras ajenas y obsoletas fallan aquí sin ninguna
   carga.
2. Una palabra boxed nombra una cabecera de un tipo admitido (no relleno); una
   palabra de lista nombra una celda cons (una palabra que no es una cabecera).

Los accesores decodifican el tipo, el recuento y la carga útil a partir de la
propia cabecera. `verify()` sigue siendo la comprobación completa de que cada
slot nombra el inicio de un objeto, para las pruebas.

## Raíces y puntos seguros

`ProcessContext::visit_roots` enumera cada palabra raíz para el recolector. En
un punto seguro, nada más retiene palabras del heap del proceso:

| Propietario | Palabras raíz | Notas |
| --- | --- | --- |
| Slots de términos del marco | Los primeros `roots` slots de cada marco de la pila | Los marcos inferiores no tienen ninguno; los índices de reanudación y de manejador son enteros |
| Slots en bruto del marco | Ninguna | Valores nativos volcados; el código generado no guarda ahí ninguna palabra del heap en un punto seguro ([regla de recarga](#reload-rule)) |
| Registros | `x[0..live)` (`ProcessStack::keep_registers`) | Los argumentos de una entrada suspendida; cada push y pop limpia `live` |
| Canal de fallos | Carga útil de error (`fvalue` de BEAM), lista de argumentos de `erlang:error/2,3`, término de la traza de pila | Se revinculan en el sitio; los marcos de traza capturados son punteros a descriptores en el código |
| Estado de trap | Las palabras de término del `TrapState` de un builtin que hace trap ([porciones](builtins.md#portions)) | Se liberan cuando el builtin termina o falla |
| Diccionario del proceso | Cada clave y cada valor | Hasta que se borran o el proceso termina |
| Buzón | Cada mensaje en la bandeja de señales y en la cola de mensajes, incluidos los mensajes `'EXIT'` y `'DOWN'` | Hasta que un receive lo toma; se reescriben en el sitio, por lo que el cursor del receive (una posición en la lista) y el plazo del timeout siguen siendo válidos |
| Raíces explícitas | El intervalo que el host pasa a `collect(roots)` | Se vuelven a leer después de la llamada |
| Lista fuera del heap | Ninguna | Los enlaces se barren y se vuelven a enlazar, no se trazan |

Ninguna celda del heap retiene una fijación. Los átomos son inmediatos y la
tabla de átomos nunca se recolecta. Las celdas de fun nombran el código a
través de su `FunDefinition` no trazado, que vive tanto como el runtime; los
módulos cargados nunca se descargan, por lo que ni los funs ni los descriptores
de traza necesitan una fijación. Los inmediatos pequeños no son raíces.

Como en el código C de ERTS, un `Term` del host es una palabra etiquetada en
bruto válida hasta el siguiente punto seguro de su heap; no fija el
almacenamiento del heap ([propiedad](terms.md#ownership)). Un `Term` solo es
válido dentro de su propio proceso; los demás procesos solo pueden leerlo.

El heap solo se mueve en un punto seguro, y nunca mientras haya una reserva
abierta:

- un `collect()` explícito del host mientras el contexto no ejecuta código
  generado;
- un `collect()` mientras el código generado en ejecución ha declarado un
  ámbito `SafePoint`, prometiendo que solo retiene palabras del heap en las
  raíces anteriores. El runtime solo abre uno en los safepoints del código
  generado de la siguiente sección.

Cualquier otra solicitud devuelve `unsafe_point` y no cambia nada, ni siquiera
el canal de fallos de una llamada generada en ejecución. La asignación nunca
mueve el heap: una solicitud que no cabe crea un fragmento.

## Búferes de mensajes

Un `MessageBuffer`
([message_buffer.hpp](../runtime/src/memory/message_buffer.hpp)) mantiene un
término fuera de todo proceso: `copy_of` copia el grafo desde el heap de su
proceso a un `HeapStorage` propio (con su propio testigo de vida, los átomos y
la cuenta de memoria del runtime, y los binaries fuera del heap compartidos y
retenidos), con la misma `GraphCopy` que usa un envío; `copy_to` lo copia al
heap de un receptor. Los inmediatos no necesitan almacenamiento. El búfer nunca
se recolecta y se libera con su último propietario; su bloque tiene
exactamente las palabras del término, sea cual sea el heap mínimo del emisor.
Lo usan los mensajes a un proceso que se ejecuta en otro hilo de trabajo
([hilos de trabajo](processes.md#workers)), los mensajes de los
temporizadores, las etiquetas de monitores y los
[términos persistentes](runtime.md#persistent-terms), por lo que nunca se
vuelven a codificar.

**Traspaso de mensajes.** Un envío cuyo mensaje ocupa al menos
`MessageBuffer::ADOPTED_WORDS` (512) palabras, contadas por un recorrido
acotado que se detiene ahí, construye el búfer antes de tomar el bloqueo del
ejecutor, de modo que el emisor no retiene ningún bloqueo mientras copia.
Después, el receptor asume el búfer en lugar de copiarlo
(`MessageBuffer::take`, `HeapStorage::adopt`), cuando el búfer no tiene otro
propietario y el receptor tiene un bloque de heap y ningún presupuesto: el
bloque se une a sus fragmentos en las mismas direcciones, las listas de
binaries fuera del heap y de maps del búfer se unen a las suyas con sus cargas,
y el búfer queda vacío. Nadie más puede alcanzar el bloque antes ni después,
así que ninguna palabra se copia dos veces. Los fragmentos adoptados solo
solicitan una recolección cuando sus palabras alcanzan las del bloque joven,
como hacen los fragmentos de mensajes de ERTS, y la siguiente recolección los
trata como datos jóvenes. Los mensajes más pequeños se copian, como antes:
resulta más barato que un fragmento para cada uno.

## Recolección en código generado

El código generado solo recolecta en unos pocos **safepoints** donde cada
término vivo ya está en una raíz. Todo lo demás, incluido cada servicio que
asigna, es una **sección crítica** que nunca mueve el heap.

### Disparadores

Un safepoint recolecta cuando el heap lo solicita (`wants_collection()`); en
otro caso cuesta una comprobación.

| Disparador | Condición en el safepoint | Equivalente en ERTS |
| --- | --- | --- |
| Heap lleno | Existe algún fragmento: una asignación no cupo en el bloque de heap desde la última recolección | El top del heap alcanza el final del heap |
| Presión de binaries fuera del heap (una recolección menor salvo que la última liberara menos de la mitad, [presión de binaries](#generations)) | Las palabras fuera del heap alcanzan el límite del heap binario virtual: 46.422 palabras al principio, después de cada recolección el doble de las palabras fuera del heap supervivientes o los supervivientes más las palabras vivas del heap, lo que sea mayor (nunca menos de 46.422), pero como máximo los supervivientes más la mitad del presupuesto que queda libre después del bloque de heap | `bin_vheap_sz` / heap binario virtual |
| `erlang:garbage_collect/0,1,2` | Una solicitud del builtin ([introspección](processes.md#introspection)), atendida en el siguiente safepoint del destino | Barrido completo explícito |

Un safepoint ejecuta una **recolección menor** salvo que toque un barrido
completo: una solicitud de `garbage_collect`, presión de binaries fuera del
heap, un presupuesto de heap o un área antigua sin espacio para las palabras
maduras ([generaciones](#generations)). El `ProcessHeap::collect` público es
siempre un barrido completo.

El nuevo bloque se dimensiona para las palabras vivas **más las palabras de
pila en uso** (ERTS mantiene la pila dentro del bloque de heap): una pila
profunda obtiene un heap mayor, de modo que una recursión larga recolecta en
proporción a su asignación en lugar de volver a recorrer toda la pila cada
pocos cientos de palabras.

### Safepoints

| Punto | Dónde | Vivo fuera de los slots de términos del marco |
| --- | --- | --- |
| Entrada de función | En `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (y por tanto en la invocación del host), antes de apilar el marco del llamado; una entrada en línea toma este camino siempre que el heap solicita una recolección | Los argumentos del llamado `x[0..arity)`, conservados como raíces (`keep_registers`) |
| Cabecera de bucle | `CLAUSE_safepoint_v1(context)` en la cabecera de cada bucle generador de una comprehension, llamado solo mientras el heap solicita una recolección | Nada |

Todo bucle de Erlang es o bien una recursión, que pasa por una entrada de
función en cada paso, o bien una comprehension, que pasa por su cabecera de
bucle, de modo que la basura entre dos safepoints está acotada por el código
lineal y los resultados de servicios individuales.

No son safepoints (secciones críticas, que siguen asignando en fragmentos):
cualquier otro servicio del runtime, incluidos los servicios de asignación,
construcción y coincidencia; `CLAUSE_return_v1`; la propagación de
excepciones; y la entrega de mensajes. Por tanto, los servicios pueden retener
palabras del heap en bruto en C++ durante toda su ejecución, y sus arrays de
entrada y sus salidas no necesitan recarga.

### Procesos en espera y suspendidos

Un proceso que no se está ejecutando nunca se recolecta: está esperando en un
receive, en cola tras una cesión (yield) o un trap, o aún no ha empezado, y
todo lo que retiene ya es una raíz (sus marcos, los registros de la entrada o
continuación en la que se reanudará, el estado de trap y sus mensajes). Los
mensajes que se le envían se copian en fragmentos de su heap. Cada entrega
despierta a un proceso en espera, y reanudarlo repite la entrada de su
continuación (el builtin de espera, una continuación de trap o la función en
la que cedió), que es un safepoint de entrada de función: lo primero que hace
un proceso reanudado es recolectar cuando su heap lo solicita. Un proceso que
espera en un receive selectivo que salta muchos mensajes recolecta, por tanto,
a medida que llegan, igual que ERTS recolecta un proceso la próxima vez que se
planifica. El golden `executables_mailbox_collection` cubre la acumulación, la
espera con timeout, la recursión profunda bajo carga de mensajes y un
consumidor que confirma 3.000 mensajes dentro de `--max-heap 65536`.

La asignación no es un safepoint (a diferencia de `test_heap` de BEAM):
requeriría que cada entrada de servicio y cada término SSA vivo a través de
cualquier asignación estuviera en una raíz, una recarga después de cada
servicio que asigna y un protocolo de reintento en cada servicio, mientras que
los dos safepoints anteriores ya acotan la basura.

### Regla de recarga

Ningún valor SSA (un valor en un registro nativo) retiene una palabra del heap
a través de un safepoint, y ningún puntero nativo atraviesa uno en absoluto (ya
es un error en `lower_frames`).

- `lower_frames` trata una llamada de safepoint en la cabecera de un bucle como
  el punto de reanudación de una llamada: divide el bloque después de la
  llamada y vuelca cada valor leído después de ella que se calculó antes. Un
  **valor de término** (una carga desde un slot de término o un registro, un
  valor almacenado en un slot de término, o un PHI de tales valores) se
  almacena después de su definición en su slot de término existente o en un
  nuevo slot de término contado en los `roots` del descriptor, y se recarga
  antes de cada uso. Las demás palabras (inmediatos pequeños, átomos, enteros
  en bruto, flags) conservan slots en bruto: una recolección nunca las cambia.
- Las llamadas vuelcan y recargan de la misma manera, los términos en slots de
  términos, de modo que el safepoint de entrada ve cada término vivo de cada
  llamador.
- La base del marco sigue siendo válida a través de un safepoint de cabecera de
  bucle, porque una recolección reescribe las palabras de la pila en el sitio y
  nunca mueve la pila; cada transferencia la vuelve a leer en el prólogo del
  cuerpo como antes.
- La optimización se ejecuta después de `lower_frames` y no puede sustituir una
  recarga por el valor SSA anterior: la dirección del marco se carga desde el
  `FrameState` del contexto, y la llamada opaca de safepoint puede escribir
  cualquier slot a través de ella ([prototipo](#prototype)).

### Comportamiento ante fallos

- Una recolección en un safepoint nunca registra un fallo. Cuando no se puede
  asignar su nuevo bloque (`out_of_memory`), el heap se queda como está y la
  ejecución continúa con fragmentos.
- **Agotamiento de memoria.** Sin límite, la memoria solo se agota cuando el
  host rechaza un bloque de heap, un fragmento, un búfer fuera del heap o el
  crecimiento de la pila: `out_of_memory`. Con un presupuesto opcional o un
  [límite para todo el runtime](#runtime-memory-limit) establecido, una
  solicitud que lo supere es `limit_exceeded`, notificado como
  `resource_limit`. Ambos son fallos de infraestructura: no se ejecuta ningún
  manejador, los marcos se deshacen hasta el marco inferior y el programa
  imprime `clau: runtime failure: entry call failed: <status>` y termina con el
  código 70 tras vaciar stdout y destruir el proceso
  ([ejecutables](executables.md#exit-status), [diferencias](differences.md)).
  Como cada recolección mantiene libre la mitad del presupuesto que queda
  después de sus supervivientes ([dimensionamiento](#sizing-and-budget),
  [disparadores](#triggers)), un presupuesto solo falla cuando el conjunto vivo
  ya no cabe o cuando el código lineal entre dos safepoints asigna más que esa
  mitad; la basura se recolecta primero.

### Implementación

- `ProcessStack::safepoint(live)` pregunta a `ProcessHeap::wants_collection()`
  (existe un fragmento, las palabras fuera del heap alcanzaron
  `binary_limit_words_` o se solicitó una recolección), conserva `x[0..live)`
  como raíces, abre un `SafePoint` y recolecta; una recolección fallida se
  ignora. `enter` (y por tanto `tail` e `invoke`) la llama con la aridad del
  llamado antes de apilar; `CLAUSE_safepoint_v1` la llama con 0.
- El lowering de comprehensions emite la comprobación de cabecera de bucle en
  la cabecera de cada bucle generador (`lowering_comprehensions`).
- `lower_frames` divide cada cuerpo después de una llamada de safepoint y
  vuelca los valores que la atraviesan como después de una llamada. Los
  argumentos llegan en registros y no se almacenan a la entrada: un argumento
  que atraviesa una llamada o un safepoint se almacena en su propio slot de
  argumento después de llegar. `home()` conserva el slot de argumento o un slot
  de término del mismo bloque cuando uno contiene el valor; en otro caso, un
  valor de término (`term_value`: cargado desde un slot de término o un
  registro, almacenado en un slot de término, o un PHI de ellos) obtiene un
  nuevo slot de término, que `place_slots` añade a los slots de términos
  iniciales antes de los slots en bruto, y cualquier otro valor obtiene un slot
  en bruto.
- `collected_size` limita el bloque a `block_limit(live)`; `shrink` también se
  ejecuta cuando el bloque supera el límite de las palabras supervivientes;
  `collect` limita `binary_limit_words_` a los supervivientes más la mitad del
  presupuesto que queda libre después del bloque.
- Cobertura: los goldens de OTP `executables_garbage_collection` (más de
  64 MiB asignados con un conjunto vivo pequeño: bucles de cola, binaries fuera
  del heap, filtros de comprehensions que asignan, recursión profunda en el
  cuerpo, una carga útil de error capturada; con ejecuciones limitadas bajo
  `--max-heap`, `--max-stack` y `--max-memory`) y `executables_heap_growth`
  (72 MB de binaries retenidos); `runtime_collection` `near_budget` y
  `shared_limit` comprueban el presupuesto y el límite para todo el runtime.

### Prototipo

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) contiene un bucle
al estilo de una comprehension en forma posterior a `lower_frames`
(`loop.ll`): un término `Y` calculado antes del bucle se almacena en un slot de
término y se recarga después del safepoint de la cabecera del bucle.
`python tests/prototypes/safepoint/run.py` lo compila para
`x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu`, `i686-pc-windows-msvc`
y `armv7-unknown-linux-gnueabihf` en O0 y O2 y comprueba que una carga de la
palabra del marco de `Y` sigue a la llamada de safepoint, de modo que el
optimizador nunca reutiliza el registro que contenía `Y`.

## Recolección

Una copia de Cheney (`memory/heap_collect`), de barrido completo o una
recolección menor ([generaciones](#generations)): primero se asigna el nuevo
bloque (un fallo es `out_of_memory` y deja el heap intacto), después se marcan
como obsoletos los `Term`s del host, se copia el objeto detrás de cada palabra
raíz y se recorre el nuevo bloque de izquierda a derecha, copiando los hijos de
cada copia. La cabecera de un objeto boxed movido se sustituye por un puntero
boxed a su copia; una celda cons movida recibe una cabeza a cero y una cola que
apunta a su copia. El reenvío preserva la compartición. Las raíces se
reescriben en el sitio, se barre la lista fuera del heap (las copias se vuelven
a enlazar en el orden de la lista y las celdas muertas se destruyen), y se
liberan el bloque antiguo y los fragmentos. Un heap que nunca se asignó no se
recolecta. `CollectionStats` informa de las palabras anteriores, las palabras
vivas, el nuevo bloque de heap, los fragmentos fusionados, la capacidad de
slots de la pila y las palabras fuera del heap.

## Generaciones

Recolección generacional, como la hace ERTS, sin su barrera de escritura:

- **Marca de nivel máximo.** Después de una recolección, todo objeto del nuevo
  bloque ha sobrevivido a una; el `top` del bloque pasa a ser la marca de nivel
  máximo (high-water mark). La siguiente recolección menor copia el bloque
  joven y los fragmentos, **promoviendo** los objetos situados por debajo de la
  marca al área antigua y el resto a un nuevo bloque joven.
- **Área antigua.** Un bloque que nunca se mueve entre barridos completos; una
  recolección menor ni lo copia ni lo recorre. Lo crea la primera recolección
  menor que promueve, con el doble de tamaño que las palabras maduras. Cuando
  no puede recibir las palabras maduras, el safepoint ejecuta en su lugar un
  barrido completo, que deja todo en el nuevo bloque por debajo de su marca de
  nivel máximo y libera el área antigua.
- **Invariante.** Un objeto inmutable solo apunta a objetos más antiguos que
  él, de modo que promover por dirección nunca deja un objeto antiguo
  apuntando a uno joven. Las escrituras en el sitio del runtime lo mantienen:
  los bucles de binaries y los binaries ampliables escriben enteros, y una
  actualización de map solo cambia en el sitio los nodos creados desde la
  última recolección. Las compilaciones de depuración comprueban después de
  cada recolección menor que ningún objeto antiguo apunta al bloque joven ni a
  un fragmento.
- **Barridos.** La lista de binaries fuera del heap conserva las celdas del
  área antigua, vuelve a enlazar las reenviadas y libera las jóvenes muertas;
  las celdas antiguas muertas esperan al siguiente barrido completo.
- **Dimensionamiento joven.** Una recolección menor conserva el tamaño del
  bloque joven, como hace ERTS, y como mínimo una octava parte del área antigua
  (ERTS). El código generado solo recolecta en safepoints, así que la
  asignación entre dos de ellos (los retornos de una recursión en el cuerpo)
  puede desbordarse mucho en fragmentos; cuando estos ocupan una cuarta parte
  del bloque o más, el siguiente bloque crece en su tamaño y no se reduce. En
  otro caso, un bloque joven de más de 8.000 palabras con menos del 25% vivo se
  copia en el triple de sus palabras vivas (la regla menor de ERTS).
- **Límite fuera del heap.** Después de una recolección menor, el límite del
  heap binario virtual cuenta solo las palabras jóvenes vivas: el área antigua
  puede contener palabras muertas, que no deben aplazar el barrido completo que
  libera los binaries antiguos muertos.
- **Presión de binaries.** Alcanzar el límite recolecta la generación joven,
  como hace el heap binario virtual de ERTS, lo que libera los binaries de las
  celdas jóvenes muertas. Cuando una recolección menor de este tipo libera
  menos de la mitad de las palabras fuera del heap, la siguiente por presión de
  binaries es un barrido completo, que también libera los binaries de las
  celdas antiguas muertas (`binary_sweep_due_`).

## Copia entre heaps

`ProcessHeap::add(value)`, o equivalentemente `value.copy_to(heap)`, devuelve un
término del heap de destino (`size_object` y `copy_struct` de BEAM). Cada celda
de origen se busca primero en el área de la anterior, y una celda cons no
necesita análisis:

- Los inmediatos y los átomos del mismo runtime no necesitan almacenamiento, y
  un término del heap de destino conserva su identidad. Un grafo de otro
  proceso del mismo runtime se copia; el grafo de otro runtime es
  `wrong_owner`, un origen caducado es `expired_context`, y un handle de origen
  anterior a la última recolección de su heap es `stale_term`. Las factorías
  siguen rechazando entradas ajenas (`ProcessHeap::retain`), por lo que solo
  una copia explícita mueve un grafo.
- Las copias son planas, como el `copy_struct` por defecto de ERTS (sin su
  variante opcional que conserva la compartición): un subtérmino se copia una
  vez por cada camino que lo alcanza, así que `{T, T}` copia `T` dos veces, y
  un término cuya compartición se duplica en cada nivel crece de forma
  exponencial, como en OTP. Un recorrido con una pila explícita (sin recursión)
  suma las palabras de cada objeto alcanzado; la copia es una única reserva de
  esa suma, en el bloque de heap o en un fragmento, rellenada por un segundo
  recorrido en el mismo orden que vuelve a leer cada celda y hace que cada slot
  apunte a la copia de su hijo. Ninguna tabla asocia los objetos de origen con
  sus copias, y solo las celdas de binaries y los stubs de maps conservan sus
  desplazamientos.
- La copia de un binary fuera del heap es una nueva celda que comparte el
  búfer; el destino retiene el búfer (cargando sus propias palabras fuera del
  heap si no retenía nada de él) antes de reservar, y solo añade la celda a la
  lista después de que se confirme la reserva.
- El origen solo se lee. Un fallo (`resource_limit` por el presupuesto del
  destino o el límite del runtime, `out_of_memory` por el host) suelta las
  retenciones de búferes y revierte la reserva, de modo que ambos heaps y todas
  las cargas quedan como antes. Una copia no posee almacenamiento del origen:
  sobrevive a la recolección y al desmontaje del origen.

## Mediciones

`runtime_heap_measurements` (CTest en modo completo; los números se imprimen,
no actúan como puerta) construye una lista de 100.000 elementos de tuplas
`{Index, Float}` mediante `TermFactory`, la recorre de vuelta mediante
accesores comprobados, recolecta con la lista como única raíz y recorre la
copia, y crea 1.000 contextos que retienen cada uno una tupla pequeña. Informa
de los tiempos de construcción y de recorrido, de las palabras de heap usadas y
de capacidad, de los bytes laterales (asignaciones del host más allá del
respaldo del heap) y de los bytes y palabras de heap por contexto.
