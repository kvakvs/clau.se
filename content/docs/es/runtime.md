---
source: docs/runtime.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 2cf400ead0e2884a583331bb170855aa26c0961dcb974a1e54e32894bebbdbcf
translatedAt: 2026-10-26
---
# Runtime

`clause_runtime` es una biblioteca C++23 sin LLVM. Gestiona los contextos, los
heaps de los procesos, los átomos, los módulos cargados y la contabilidad del
ciclo de vida, y ejecuta los procesos Erlang en hilos de trabajo del
planificador ([procesos](processes.md)). Todas las API son internas del
proyecto; las llamadas del anfitrión deben serializarse por runtime y no
solaparse con una ejecución del programa, cuyos hilos de trabajo se sincronizan
entre sí ([hilos](#threads)).

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
planificador → la tabla de átomos al final. Los handles de funciones resueltas
mantienen vivo el código tras el desmontaje del runtime, pero las palabras de
sus ranuras de átomos no fijan ninguna grafía. El almacenamiento de átomos
retira sus ranuras globales antes de liberar los registros; acceder a la
grafía mediante un Term de átomo no fijo que sobreviva informa de
`expired_context`.

## Memoria de los procesos

Cada contexto posee un `ProcessHeap`
([process_heap.hpp](../runtime/include/process_heap.hpp)); su disposición,
áreas, dimensionado, admisión, raíces y recolección se especifican en
[runtime-heap.md](runtime-heap.md). La API del anfitrión:

- `allocate(words)` devuelve almacenamiento de palabras puesto a cero.
  `reserve` da una reserva de solo movimiento con confirmación explícita y
  reversión automática. Una reserva a la vez por heap: primero se construyen
  los hijos y el padre se reserva al final. Las palabras de `allocate()` en
  bruto deben permanecer a cero o contener objetos completos
  ([disposición de palabras](runtime-heap.md#word-layout)).
- El cero, el desbordamiento y un presupuesto agotado se rechazan antes de
  publicar: `out_of_memory` (asignación) o `limit_exceeded` (presupuesto); el
  código generado recibe el estado exacto
  ([comportamiento ante fallos](runtime-heap.md#failure-behavior)).
- `add(value)`/`copy_to` copian un grafo de otro proceso del mismo runtime
  ([copia entre heaps](runtime-heap.md#copying-between-heaps)).
- `used_words` cuenta las palabras asignadas, `capacity_words` el bloque de
  heap y los fragmentos, y `off_heap_words` los búferes fuera del heap a los que
  hace referencia este proceso, cada uno una sola vez
  ([dimensionado y presupuesto](runtime-heap.md#sizing-and-budget)).
- `verify()` recorre el bloque de heap y cada fragmento y comprueba que cada
  ranura de término apunte al inicio de un objeto del mismo proceso (pruebas y
  depuración; `corrupt_heap` en caso contrario).
- `collect(roots)` copia todo lo alcanzable desde las raíces del proceso y las
  palabras raíz del anfitrión a un nuevo bloque de heap
  ([recolección](runtime-heap.md#collection)). Solo se ejecuta en un punto
  seguro; si no, `unsafe_point`
  ([raíces y puntos seguros](runtime-heap.md#roots-and-safe-points)); el código
  generado recolecta en sus propios puntos seguros
  ([recolección en el código generado](runtime-heap.md#collection-in-generated-code)).
  Los Terms del anfitrión son valores de una palabra sin raíz; se reconstruyen
  a partir de las raíces reescritas tras la recolección. No tienen
  comprobaciones de vida ni de obsolescencia y no pueden leerse tras la
  recolección o la salida del proceso. Las factorías y las reservas conservan
  sus propios testigos de vida y siguen informando de `expired_context`.

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

- Un `ModuleRegistry` asigna un nombre/aridad exactos (≤ 255) a un único
  invocable todo-`Term`. `load` lo congela y lo publica; los duplicados o los
  fallos no publican nada.
- El registro también indexa en tablas hash los enlaces de los módulos
  generados: los descriptores de módulos, de records y de funs con sus enlaces y
  definiciones, y las palabras de átomo de `Module:Function/Arity` con los
  marcos de exportación. Por tanto, las llamadas dinámicas, `apply/3`, los
  `fun M:F/A` en tiempo de ejecución y las búsquedas de descriptores toman un
  tiempo esperado constante respecto al número de módulos y exportaciones. Los
  índices se construyen dentro del registro: un módulo rechazado no añade
  ninguna entrada, y solo cambian bajo el bloqueo exclusivo del servidor.
- `resolve` distingue entre módulo inexistente y exportación inexistente.
  `ResolvedFunction` fija la imagen del módulo; `call` comprueba la aridad, los
  argumentos y los resultados, y convierte las excepciones del anfitrión en
  fallos.
- Los cuerpos nativos deben ser síncronos y no bloqueantes, y no deben retener
  el contexto ni el span de argumentos.
- Un catálogo acotado de BIF diferidos conocidos (`self/0`, `length/1`,
  `spawn/3`, `spawn_link/3`, `send/2`, `make_ref/0`, `garbage_collect/0`,
  `apply/3` (el código generado llama en cambio a `apply/2,3` a través de los
  servicios de llamada dinámica, [funs](funs.md#dynamic-calls)),
  `tuple_size/1`, `+/2`) informa `not_implemented`; los demás nombres no
  registrados devuelven `unknown_builtin` de forma silenciosa. Esta ruta del
  anfitrión no llega a los builtins de producción.
- Los builtins de producción residen en el `BuiltinRegistry` del servidor,
  registrados al arrancar el runtime; el código generado, las llamadas
  dinámicas y los funs llegan a ellos a través del
  [puente de builtins](builtins.md).
- `CodeServer::export_frame` encuentra el `FrameDescriptor` de una exportación
  por módulo, átomo de función y aridad; `function_frame` añade los builtins
  para las llamadas dinámicas; `external_fun` interna las definiciones de los
  funs externos construidos en tiempo de ejecución.
- Los módulos nunca se descargan; `CodeServer::unload` está diferido y no se
  admite la carga dinámica.

## Términos persistentes

Una tabla por runtime (`memory/persistent_terms`), propiedad de `Runtime::Impl`
y accesible mediante `ProcessContext::persistent_terms()`, guarda los términos
de `persistent_term` ([builtins](builtins.md#persistent-terms)).

- Cada clave y valor se copia en un área propia del rango de términos
  persistentes del runtime (`memory/persistent_region`): una reserva de
  direcciones (64 GiB de espacio de direcciones en anfitriones de 64 bits,
  256 MiB en los de 32 bits) cuyas páginas se confirman al asignar áreas, de
  modo que una comparación de rango basta para saber si una palabra designa
  un término persistente. Las copias solo comparten literales de módulo, por
  lo que cada área es independiente; sus binaries comparten sus búferes.
- Las entradas son palabras raíz que se encuentran por un hash de la clave
  (los builtins usan el hash de términos de `phash2`) y por igualdad exacta,
  comparada en su sitio.
- Una lectura devuelve la palabra almacenada en su sitio, como los términos
  persistentes literales de OTP: cualquier proceso puede retenerla; las
  recolecciones no la modifican y la admisión la acepta como un literal. Los
  envíos a otros procesos, los búferes de mensajes y los nuevos términos
  persistentes copian las palabras persistentes (un envío recorre su mensaje
  una vez, antes del bloqueo del ejecutor, de modo que no pueda compartir un
  área que podría retirarse entretanto).
- **Recuperación.** El área de un valor reemplazado o borrado se retira bajo
  una nueva época. Desde entonces toda copia copia sus palabras, y cada
  proceso registrado cuando se retiró copia los objetos en retirada que
  retiene a su propio heap durante un barrido completo de evacuación
  (`Copier` con la región, cada objeto una vez, los búferes de binary retenidos
  antes del barrido): un proceso en ejecución o en cola al inicio de su
  siguiente turno, uno aparcado de inmediato, mediante el put o erase que lo
  retiró (`Executor::evacuate_parked`, bajo el bloqueo del ejecutor). Una vez
  que todos esos procesos lo han hecho o han terminado, se libera el área.
  `info/0` cuenta solo las entradas actuales.
- Un bloqueo compartido sirve a los lectores en cualquier número de hilos de
  trabajo; put y erase lo toman en exclusiva (las copias se hacen antes). El
  CTest `runtime_persistent_terms` cubre valores que sobreviven a su escritor,
  lecturas en su sitio a través de recolecciones y entre procesos, valores
  reemplazados y borrados retenidos por lectores, lectores y escritores
  concurrentes y recuperación (copias en retirada, evacuación, áreas y cargos
  liberados).

## Tablas ETS

Un registro por runtime (`ets/tables`), propiedad de `Runtime::Impl` y accesible
mediante `ProcessContext::ets_tables()`, guarda las tablas de `ets`
([builtins](builtins.md#ets)).

- **Objetos.** Cada objeto almacenado (y los datos de un heredero) es un
  `DetachedTerm` (`memory/detached_term`): una copia plana en un bloque propio,
  realizada por la copia de grafos, fuera de todos los heaps. Los literales de
  módulo siguen compartidos; los términos persistentes se copian, porque sus
  áreas pueden retirarse; las celdas de binary comparten sus búferes. Los
  bloques nunca se mueven ni pertenecen a ningún proceso, por lo que los
  lectores los comparan y calculan su hash en su sitio y los copian a su propio
  heap. Sus palabras se cargan a la cuenta de memoria del runtime.
- **Índices** (`ets/index`). Las tablas `set`, `bag` y `duplicate_bag` usan un
  índice hash: un array de cubetas de tamaño potencia de dos, cada una con un
  vector pequeño de entradas (una por clave, con sus objetos en orden de
  inserción), que duplica su tamaño por encima de dos claves por cubeta y lo
  reduce a la mitad por debajo de una por cada ocho. Las claves se encuentran
  mediante la dispersión de 64 bits de su hash `phash2` y la igualdad exacta.
  Las tablas `ordered_set` usan un `std::set` con un nodo por clave en orden
  de términos, donde las claves que se comparan iguales (`1`, `1.0`) son una
  sola clave; reemplazar un objeto conserva su nodo.
- **Partes y bloqueos** (`ets/table`). Una tabla hash con `write_concurrency`
  (`true` o `auto`) divide sus claves en 64 partes según los bits altos del
  hash, cada una con un índice y su propio `shared_mutex`; cualquier otra
  tabla tiene una parte. Las operaciones sobre una sola clave comparten el
  bloqueo de la tabla y las de tabla completa lo toman en exclusiva (listas de
  objetos, `delete_all_objects/1`, fijación, eliminación), de modo que insertar
  una lista es atómico y aislado como en OTP. Las lecturas copian los objetos
  mientras mantienen el bloqueo compartido de su parte.
- **Recorridos y fijación.** Una tabla hash se recorre parte por parte y cubeta
  por cubeta, tanto hacia atrás como hacia delante; `next/2` desde una clave
  que no contiene produce `badarg`. Mientras la tabla está fijada
  (`safe_fixtable/2`, `foldl/3`), sus índices nunca cambian de tamaño, una clave
  eliminada permanece como una marca de borrado que retiene un objeto para su
  clave, y las claves nuevas se añaden al final de su cubeta, de modo que un
  recorrido ve una vez cada clave que permaneció. La última liberación de la
  fijación elimina las marcas y redimensiona los índices. Un ordered_set se
  recorre desde cualquier clave hasta la más cercana.
- **Registro.** Tablas por número identificador (una referencia ordinaria de la
  secuencia del programa) y por nombre, y las tablas que cada proceso posee o
  fija. El fin de un proceso (`Executor::release_tables`, bajo el bloqueo del
  ejecutor antes de señalar enlaces y monitores) libera sus fijaciones y
  transfiere cada tabla que poseía a un heredero vivo distinto de sí mismo,
  que recibe `{'ETS-TRANSFER', Table, From, HeirData}` (ningún mensaje para un
  heredero establecido sin datos), o la elimina. Orden de bloqueos: el del
  ejecutor, el del registro y el de una tabla; los builtins nunca toman el
  bloqueo del ejecutor mientras mantienen un bloqueo ETS, y `give_away/3`
  envía su mensaje después de liberarlos.
- **Porciones**. `tab2list/1` y las selecciones de todos los objetos
  (`select/2`, `select_reverse/2`, `match/2`, `match_object/2`,
  `select_count/2`) recorren la tabla con tantos objetos por porción como
  permita el presupuesto del proceso y después ceden mediante una trampa
  (`builtins/ets/table_walks.cpp`); el proceso que recorre una tabla hash la
  fija desde su primera trampa hasta el final, como hace OTP, de modo que sus
  ranuras permanecen en su sitio. `delete_all_objects/1` y `delete/1` vacían o
  eliminan la tabla de una vez extrayendo sus índices (`Table::empty`,
  `Table::destroy`), y después liberan los objetos antiguos por porciones
  (`builtins/ets/disposal.cpp`, `Index::shed`); una tabla hash fijada se vacía
  en su sitio y conserva sus marcas de borrado. Las tablas que deja un
  propietario terminado las libera el hilo de trabajo después de liberar el
  bloqueo del ejecutor. `select_delete/2` y `select_replace/2` siguen
  ejecutándose de una vez.
- **Contadores en su sitio.** `update_counter/3,4` sobre una clave cuyo objeto
  es la copia propia de la tabla y cuyos contadores siguen siendo enteros
  pequeños cambia los campos almacenados en su sitio, bajo el bloqueo de la
  parte, como hace OTP; un bignum, un objeto literal de módulo o un objeto por
  defecto toma la ruta general, que almacena una copia nueva.
- El CTest `executables_ets_concurrency` cubre contadores, inserciones y
  recorridos desde muchos procesos con uno y cuatro hilos de trabajo, y el fin
  de propietarios de muchas tablas; `executables_ets_portions` muestra otros
  procesos ejecutándose durante operaciones largas con un solo hilo de trabajo.
- **Selecciones** ([especificaciones de coincidencia](#match-specifications)).
  Una selección de tabla completa lee cada parte bajo sus bloqueos; una cuyos
  patrones de cabecera vinculan todos la clave busca las claves. Una selección
  por bloques recorre una tabla hash ranura por ranura (cada ranura bajo el
  bloqueo de su parte) y un ordered_set por claves desde la última, por lo que
  una continuación designa una ranura o una clave. `select_delete/2` y
  `select_replace/2` modifican cada parte bajo su propio bloqueo (`Index::edit`);
  una tabla hash fijada conserva entretanto las marcas de las claves eliminadas.

## Especificaciones de coincidencia

`runtime/src/match_spec/` compila y ejecuta especificaciones de coincidencia
como hace `erl_db_util.c` de OTP, para `ets` y `erlang:match_spec_test/3`
([builtins](builtins.md#ets)).

- **Programas.** `compile` convierte una especificación en un `Program`: por
  cláusula, un patrón de cabecera, expresiones de guard y de cuerpo sobre
  ranuras de variables numeradas, y las variables que vincula la cabecera
  (`'$$'`). Las constantes se pliegan como en OTP (`{{...}}` y `{const, X}` en
  valores; un map constante conserva sus claves tal como están escritas) y se
  guardan como copias `DetachedTerm`, de modo que un programa no pertenece a
  ningún proceso. Dos dialectos: `table` (ets) y `trace` (las cabeceras son
  listas de argumentos, una lista que termina en `'_'` coincide con un prefijo,
  `'$N'` o `'_'` con la lista completa; los cuerpos pueden ejecutar acciones
  de traza).
- **Comprobaciones.** El compilador aplica las comprobaciones de OTP en su
  mismo orden y, al realizar el análisis de lint (`erlang:match_spec_test/3`),
  da los mensajes de OTP para la primera cláusula que tenga alguno, compilando
  los operandos de llamadas y tuplas del último al primero como hace OTP; un
  mensaje se corta a los 99 bytes como lo corta el búfer de OTP. Las funciones
  de guard son las de la tabla de OTP (`match_spec/functions.cpp`), con los
  contextos en que se puede llamar a cada una; anidar más de 1000 niveles
  produce `system_limit`.
- **Ejecución** (`match_spec/run.cpp`). Las cláusulas se prueban en orden. Una
  cabecera vincula partes del objeto en su sitio (igualdad exacta para
  constantes y variables repetidas, maps que contienen al menos las claves del
  patrón); los guards las leen en su sitio y deben dar exactamente `true`; un
  cuerpo copia cada valor que produce al heap del llamante. Una función de
  guard que lanza una excepción hace fallar la cláusula; en un cuerpo produce
  `'EXIT'` en su lugar y el cuerpo continúa, como también hacen `and`, `or`,
  `andalso` y `orelse` sobre un término que no es booleano. La mayoría de las
  funciones de guard son las operaciones sobre términos del servicio de
  inmediatos (`terms/immediate_terms.hpp`).
- **Especificaciones compiladas**: son referencias handle que contienen el
  programa (`match_spec/handles.cpp`), por lo que sobreviven a
  `term_to_binary/1` dentro del programa como las magic references de OTP 20+.

## Contabilidad del planificador

`SchedulerService`
([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp)) es un
registro del ciclo de vida de los procesos orientado al anfitrión; no ejecuta
código. Los programas se ejecutan en el ejecutor
([procesos](processes.md#executor)), que no lo usa.

- `register_process(context)` una vez por contexto (del mismo runtime); los
  duplicados devuelven `already_registered`. `remove_process(id)` retira un
  registro que no está en ejecución.
- `begin_dispatch` → en ejecución; `finish_dispatch` → ejecutable, en espera o
  terminado (con motivo). `set_suspended` conmuta un indicador en los registros
  ejecutables o en espera. Las demás transiciones devuelven
  `invalid_transition`.
- `request_shutdown()` cierra el registro, el despacho y el control de
  suspensión; la inspección y las devoluciones siguen disponibles para el
  vaciado.
- `run` y `execute` informan `not_implemented`.

## Hilos

Los hilos de trabajo del planificador
([hilos de trabajo](processes.md#workers)) ejecutan procesos en varios hilos
de un mismo runtime. Los servicios que comparten están sincronizados; todo lo
demás queda confinado al hilo que ejecuta su proceso o protegido por el mutex
del ejecutor.

- Átomos: `AtomStorage` protege su map de grafías y sus registros propios con
  un mutex compartido. `existing` y `size` lo comparten; `intern` busca primero
  bajo el bloqueo compartido y después toma el bloqueo exclusivo para una
  grafía nueva y vuelve a comprobar, de modo que internados concurrentes
  obtienen una sola palabra. La publicación usa `detail::atom_table`, global
  al proceso del sistema; la admisión y las lecturas de grafías usan su índice
  numérico sin bloqueos (`lookup` también comprueba el propietario del
  registro). Los átomos fijos no necesitan bloqueo. Los registros permanecen
  sin cambios hasta que el desmontaje retira sus ranuras
  ([átomos](terms.md#atoms)).
- Código: `CodeServer` protege sus módulos y las definiciones de funs externos
  con un mutex compartido. Las búsquedas (`find_module`, `resolve`,
  `atom_word`, `record_definition`, `fun_definition`, `export_frame`,
  `function_frame`, `owns`) lo comparten; `load` y la construcción de una nueva
  definición de fun externo lo toman en exclusiva, de modo que registros
  concurrentes de un mismo nombre publican un solo módulo (los demás obtienen
  `duplicate_module`) y llamadas concurrentes a `external_fun` obtienen una sola
  definición. El registro de builtins se rellena al arrancar el runtime, antes
  de que se ejecute ningún hilo de trabajo, y después solo se lee.
- Fijaciones: los módulos nunca se eliminan mientras vive el runtime y el
  servidor se destruye después de todos los contextos, por lo que las
  definiciones, los marcos y las ranuras de átomos que devolvió siguen siendo
  válidos para cada invocación y cada celda de fun. Los handles de
  `ResolvedFunction` y `find_module` también conservan su módulo después de que
  el runtime haya desaparecido; sus ranuras de átomos retienen palabras, no
  fijaciones de grafías.
- Números de pid y de puerto: `IdentityNumbers` emite números bajo un bloqueo
  exclusivo y admite palabras de pid y de puerto bajo uno compartido.
- Memoria: la cuenta de todo el runtime (`RuntimeMemory`) carga y libera con
  operaciones atómicas; un cargo nunca lleva la cuenta más allá de un límite
  opcional.
- Otros hilos: el hilo del temporizador
  ([tiempos de espera de receive](processes.md#receive-timeouts)), el hilo de
  E/S y, en Windows, el hilo lector de una entrada `fd`
  ([hilo de E/S](ports.md#io-thread)) solo tocan el estado de los procesos a
  través del mutex del ejecutor.
- Enlazado: en Linux el runtime añade `-pthread` para sus hilos; en Windows
  enlaza Winsock (`ws2_32`, `mswsock`) para los sockets.

## Salida estándar

`RuntimeOptions::standard_output`
([output.hpp](../runtime/include/clause/runtime/output.hpp)) recibe la salida de
`erlang:display/1` y de `io` hacia la salida estándar ([io](io.md)). La
implementación por defecto escribe en el `stdout` del proceso mediante stdio de
C (con búfer); un receptor del anfitrión devuelve `false` para informar de una
escritura fallida.

`erlang:display/1` representa su argumento en
[estilo display](terms.md#printing), escribe el texto y un salto de línea en una
sola escritura y devuelve `true`. Los límites de representación y las
escrituras rechazadas se convierten en estados de infraestructura
(`resource_limit`, `output_failure`, ...) en el canal comprobado, nunca en
excepciones de Erlang.

## Arranque del programa

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) ejecuta un programa completo para el `main` generado
([ejecutables](executables.md)): comprueba la ABI de cada descriptor, arranca un
runtime, registra todos los módulos antes de cualquier código de entrada,
construye argv en el contexto de entrada, ejecuta la entrada en el ejecutor y
asigna el resultado al [estado de salida](executables.md#exit-status). Los
informes van a stderr después de vaciar stdout; el contexto y el runtime se
desmontan en orden en todas las rutas. `CLAUSE_halt_v1` implementa
`erlang:halt/0,1` (`abort` llama a `std::abort`).

## Servicios diferidos

Estos informan una línea `[feature] notimpl` ([funcionalidades](features.md)) y
no cambian ningún estado:

| Límite | Error |
| --- | --- |
| `TermFactory::function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` en un BIF catalogado | `Status::not_implemented` |
