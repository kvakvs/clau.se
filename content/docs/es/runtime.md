---
source: docs/runtime.md
sourceCommit: 06042fa
sourceSha256: 6baeafe0372058547653e00c8d05e2f39a894329ac165b982d1553ad6ba2093e
translatedAt: 2026-10-09
---
# Runtime

`clause_runtime` es una biblioteca C++23 sin LLVM. Gestiona los contextos, los
heaps de los procesos, los átomos, los módulos cargados y la contabilidad del
ciclo de vida, y ejecuta los procesos Erlang en workers del planificador
([procesos](processes.md)). Todas las API son internas del proyecto; las
llamadas del anfitrión deben serializarse por runtime y no solaparse con una
ejecución del programa, cuyos workers se sincronizan entre sí
([hilos](#threads)).

## Enlazado

Se enlaza exactamente un runtime compilado para el destino mediante
`Clause::generated_program`:

```cmake
add_executable(harness harness.cpp)
target_link_libraries(harness PRIVATE Clause::generated_program)
```

Aporta el archivo, las cabeceras de la ABI y del runtime y C++23, pero no
LLVM. [link_consumer.cpp](../tests/runtime/link_consumer.cpp) muestra un ciclo
de vida completo.

## Ciclo de vida

[runtime.hpp](../runtime/include/clause/runtime/runtime.hpp):

- `Runtime::start(options)` → `std::expected<std::unique_ptr<Runtime>, Status>`.
  Valores por defecto: la versión actual de la ABI y el ancho nativo de los
  términos, `max_atoms` 2^20 (como máximo 2^26; los programas lo fijan con
  `--max-atoms`, [opciones del runtime](executables.md#runtime-options)). El
  número de contextos no está limitado. `process_heap` y `process_stack` son
  las opciones de los contextos creados por `create_context()`;
  `memory_limit_bytes` es el
  [límite opcional para todo el runtime](runtime-heap.md#runtime-memory-limit),
  que informa `memory_bytes()`. Ninguno tiene límite por defecto.
- `create_context()` o `create_context(heap_options, stack_options)` →
  `ProcessContext*` prestado, estable hasta que se destruye. Valores por
  defecto del heap: heap mínimo de 233 palabras (`min_heap_words`) y sin
  límite de memoria (`limit_bytes` = `UNLIMITED_HEAP_BYTES`; un presupuesto
  fijado es un múltiplo de palabra no menor que el heap mínimo). La pila
  tampoco tiene límite salvo que se fije `StackOptions::limit_words`.
- `destroy_context(ctx)`, `shutdown()`: shutdown devuelve `busy` mientras
  queden contextos; después tiene éxito de forma idempotente y las llamadas
  posteriores devuelven `stopped`. El destructor limpia los contextos
  restantes.
- Las identidades de contextos y runtimes no se reciclan; agotarlas produce un
  fallo. La identidad de un contexto lleva su número de pid
  ([pids](terms.md#pids-and-references)). Un puntero a contexto es un
  préstamo, no una identidad. `lifetime()` da un testigo débil que informa
  `alive() == false` antes de desmontar el heap.
- Las llamadas de ciclo de vida nunca lanzan excepciones y son silenciosas.
  Valores de estado: [abi.md](abi.md#runtime-services).

Orden de desmontaje: cerrar los registros del planificador → destruir los
contextos → liberar los registros de código → destruir el servicio del
planificador → la tabla de átomos al final. Los manejadores de funciones
resueltas mantienen vivos el código y las grafías de los átomos tras el
desmontaje del runtime, pero nunca un proceso.

## Memoria de los procesos

Cada contexto posee un `ProcessHeap`: un único bloque de heap creado por su
primera asignación, de tamaño `max(min_heap_words, request)`, más una cadena
de fragmentos de heap del mismo proceso. Las palabras solo se mueven cuando el
anfitrión llama a `collect()` en un punto seguro.

El heap sigue el diseño clásico de ERTS; [runtime-heap.md](runtime-heap.md)
es su contrato (disposición, áreas, dimensionado, admisión, raíces,
recolección).

- `allocate(words)` devuelve almacenamiento de palabras puesto a cero.
  `reserve` da una reserva solo movible con confirmación explícita y
  reversión automática. Una sola reserva a la vez por heap: primero se
  construyen los hijos y el padre se reserva al final.
- La asignación por desplazamiento (bump allocation) llena el bloque de heap;
  una petición que no cabe va al fragmento más reciente, o si no, a un
  fragmento nuevo de tamaño `max(min_heap_words, request)` (limitado por el
  presupuesto restante). Las palabras solo están alineadas a palabra. La
  reversión restablece la cima del área, elimina un fragmento (o el bloque de
  heap) creado por la reserva y restaura la contabilidad exactamente.
- Rechaza cero, el desbordamiento y el presupuesto agotado antes de publicar.
  Errores: `out_of_memory` (asignación) o `limit_exceeded` (presupuesto); el
  código generado recibe el estado exacto.
- Los binaries de más de 64 bytes viven en búferes compartidos fuera del heap.
  Cada celda del heap que hace referencia a uno guarda un `std::shared_ptr` y
  se une a la lista off-heap del proceso cuando se publica; el desmontaje
  recorre la lista y suelta esas referencias
  ([binaries off-heap](runtime-heap.md#off-heap-binaries)).
- `add(value)`/`copy_to` copian un grafo de otro proceso del mismo runtime,
  conservando su compartición y compartiendo los búferes off-heap; una copia
  fallida no cambia nada
  ([copia entre heaps](runtime-heap.md#copying-between-heaps)).
- `used_words` cuenta las palabras asignadas; `capacity_words` cuenta el
  bloque de heap y los fragmentos; `off_heap_words` cuenta los búferes a los
  que hace referencia este proceso, cada uno una vez. Las palabras de respaldo
  más las off-heap comparten el presupuesto opcional `limit_bytes`; una
  recolección conserva la mitad del presupuesto que queda libre tras los
  supervivientes, así que agotarlo significa que los datos vivos ya no caben
  ([comportamiento ante fallos](runtime-heap.md#failure-behavior)).
- Toda palabra usada se interpreta como un objeto encabezado por un header,
  una celda cons o relleno ([disposición de palabras](runtime-heap.md#word-layout));
  las palabras reservadas empiezan a cero. Las palabras de `allocate()` en
  bruto deben seguir a cero o contener objetos completos. `verify()` recorre
  el bloque de heap y todos los fragmentos y comprueba que cada ranura de
  término apunta al inicio de un objeto del mismo proceso (pruebas y
  depuración; `corrupt_heap` en caso contrario).
- `collect(roots)` copia todo lo alcanzable desde las raíces del proceso y las
  palabras raíz del anfitrión a un nuevo bloque de heap, libera el bloque
  antiguo y los fragmentos, libera los binaries off-heap muertos y reescribe
  las raíces ([recolección](runtime-heap.md#collection)). El código generado
  recolecta en las entradas de función y en las cabeceras de los bucles de
  comprehension cuando `wants_collection()`
  ([recolección en el código generado](runtime-heap.md#collection-in-generated-code)).
  Solo se ejecuta en un punto seguro (sin código generado en ejecución fuera
  de un ámbito `SafePoint`, sin ninguna reserva abierta); si no, `unsafe_point`;
  el [inventario de raíces](runtime-heap.md#roots-and-safe-points) enumera lo
  que reescribe; no poder asignar el nuevo bloque es `out_of_memory` sin
  ningún cambio.

## Servidor de código y builtins

Cada runtime posee un `CodeServer`
([code_server.hpp](../runtime/include/clause/runtime/code_server.hpp),
[callable.hpp](../runtime/include/clause/runtime/callable.hpp)):

```cpp
auto functions = std::make_unique<ModuleRegistry>();
auto added = functions->add("identity", 1,
    [](ProcessContext &, std::span<const Term> args) -> CallResult<Term> { return args.front(); });
auto loaded = context.code_server().load({"native_demo", CodeImage::linked(), std::move(functions)});
auto fn = context.code_server().resolve({.module = "native_demo", .function = "identity", .arity = 1});
```

- Un `ModuleRegistry` asocia un nombre/aridad exactos (≤ 255) a un invocable
  cuyos argumentos y resultado son todos `Term`. `load` lo congela y lo
  publica; los duplicados o los fallos no publican nada.
- `resolve` distingue entre módulo inexistente y exportación inexistente.
  `ResolvedFunction` fija la imagen del módulo; `call` comprueba la aridad,
  los argumentos y los resultados, y convierte las excepciones del anfitrión
  en fallos.
- Los cuerpos nativos deben ser síncronos y no bloqueantes, y no deben
  retener el contexto ni el span de argumentos.
- Un catálogo acotado de BIF diferidos conocidos (`self/0`, `length/1`,
  `spawn/3`, `spawn_link/3`, `send/2`, `make_ref/0`, `garbage_collect/0`,
  `apply/3` (el código generado llama a `apply/2,3` mediante los servicios de
  llamada dinámica, [funs](funs.md#dynamic-calls)), `tuple_size/1`, `+/2`)
  informa `not_implemented`; los demás nombres no registrados devuelven
  `unknown_builtin` sin aviso. Esta ruta del anfitrión no llega a los
  builtins de producción.
- Los builtins de producción viven en el `BuiltinRegistry` del servidor,
  registrados al arrancar el runtime; el código generado, las llamadas
  dinámicas y los funs llegan a ellos a través del
  [puente de builtins](builtins.md).
- `CodeServer::export_frame` encuentra el `FrameDescriptor` de una
  exportación por módulo, átomo de función y aridad; `function_frame` añade
  los builtins para las llamadas dinámicas; `external_fun` interna las
  definiciones de los funs externos construidos en tiempo de ejecución.
- `CodeServer::unload` está diferido; la carga dinámica no está soportada.

## Contabilidad del planificador

`SchedulerService` ([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp))
solo registra el ciclo de vida de los procesos; no ejecuta código.

- `register_process(context)` una vez por contexto (del mismo runtime); los
  duplicados devuelven `already_registered`. `remove_process(id)` retira un
  registro que no está en ejecución.
- `begin_dispatch` → en ejecución; `finish_dispatch` → ejecutable, en espera
  o terminado (con razón). `set_suspended` conmuta un indicador en los
  registros ejecutables o en espera. Las demás transiciones devuelven
  `invalid_transition`.
- `request_shutdown()` cierra el registro, el despacho y el control de
  suspensión; la inspección y las devoluciones siguen disponibles para el
  vaciado.
- `run` y `execute` informan `not_implemented`.

Los bocetos de diseño de workers y procesos están en
[runtime/design/](../runtime/design/) y en
`runtime/include/{scheduler,process}.hpp`. Los mensajes están implementados
([procesos](processes.md#messages)): un envío copia el mensaje en el heap del
receptor y lo añade a su buzón de señales (`runtime/include/mailbox.hpp`).

## Hilos

Los workers del planificador (plan step 56,
[workers](processes.md#workers)) ejecutan procesos en varios hilos de un
mismo runtime. Los servicios que comparten están sincronizados; todo lo demás
queda confinado al hilo que ejecuta su proceso o protegido por el mutex del
ejecutor.

- Átomos (step 54): `AtomStorage` protege ambos índices con un mutex
  compartido. Las consultas (`lookup`, `boolean`, `size`) lo comparten;
  `intern` consulta bajo el bloqueo compartido y solo una grafía nueva toma el
  bloqueo exclusivo, vuelve a comprobar y publica la entrada, de modo que
  varios `intern` concurrentes de una misma grafía obtienen una sola palabra.
  Las palabras son estables: una entrada nunca se cambia ni se elimina antes
  del desmontaje.
- Código (step 55): `CodeServer` protege sus módulos y las definiciones de
  funs externos con un mutex compartido. Las consultas (`find_module`,
  `resolve`, `atom_word`, `record_definition`, `fun_definition`,
  `export_frame`, `function_frame`, `owns`) lo comparten; `load` y la
  construcción de una nueva definición de fun externo lo toman en exclusiva,
  así que los registros concurrentes de un mismo nombre publican un solo
  módulo (los demás obtienen `duplicate_module`) y las llamadas concurrentes a
  `external_fun` obtienen una sola definición. El registro de builtins se
  llena al arrancar el runtime, antes de que se ejecute ningún worker, y
  después solo se lee.
- Fijaciones: los módulos nunca se eliminan mientras vive el runtime (la
  descarga está diferida) y el servidor se destruye después de todos los
  contextos, así que las definiciones, los marcos y las ranuras de átomos que
  ha devuelto siguen siendo válidos para cada invocación y cada celda de fun.
  Los manejadores de `ResolvedFunction` y `find_module` también conservan su
  módulo después de que desaparezca el runtime.
- Números de pid (step 56): `ProcessNumbers` emite números bajo un bloqueo
  exclusivo y admite palabras de pid bajo uno compartido.
- Memoria (step 56): la cuenta global del runtime (`RuntimeMemory`) carga y
  libera con operaciones atómicas; una carga nunca lleva la cuenta por encima
  de un límite opcional.
- E/S de puertos (steps 57C–57F): los hilos lector, escritor y vigilante del
  servicio de E/S y el hilo de sockets ([puertos](ports.md#io-thread)) solo
  tocan el estado de los procesos a través del mutex del ejecutor.
- Enlazado: en Linux el runtime añade `-pthread` para sus hilos; en Windows
  enlaza Winsock (`ws2_32`, `mswsock`) para los sockets.

## Salida estándar

`RuntimeOptions::standard_output` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
recibe los bytes de `erlang:display/1` y, más adelante, los de `standard_io`.
Por defecto escribe en el `stdout` del proceso a través de C stdio (con
búfer); un sumidero del anfitrión devuelve `false` para indicar una escritura
fallida.

`erlang:display/1` representa su argumento en
[estilo display](terms.md#printing), escribe el texto y un salto de línea en
una sola escritura y devuelve `true`. Los límites de representación y las
escrituras rechazadas se convierten en estados de infraestructura
(`resource_limit`, `output_failure`, ...) en el canal comprobado, nunca en
excepciones de Erlang.

## Arranque del programa

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) ejecuta un programa completo para el `main` generado:
comprueba la ABI de cada descriptor, arranca un runtime por defecto, registra
todos los módulos antes de cualquier código de entrada, construye argv en el
contexto de entrada, llama a la entrada y convierte el resultado en el estado
de salida de los [ejecutables](executables.md#exit-status). Los informes van a
stderr después de vaciar stdout; el contexto y el runtime se desmontan en
orden en todas las rutas. `CLAUSE_halt_v1` implementa `erlang:halt/0,1`
(`abort` llama a `std::abort`).

## Servicios diferidos

Estos informan una línea `[feature] notimpl` ([funcionalidades](features.md))
y no cambian ningún estado:

| Frontera | Error |
| --- | --- |
| `TermFactory::port` (aún sin puertos, plan step 53), `reference(ReferenceIdentity)` y `function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` sobre un BIF catalogado | `Status::not_implemented` |
