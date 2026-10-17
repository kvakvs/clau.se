---
source: docs/processes.md
sourceCommit: a8c3f8f6
sourceSha256: c52f95bbde29faed486345896a09dfa1514cba322d235541606d955fe442ac48
translatedAt: 2026-10-17
---
# Procesos

## Ejecutor

Un runtime ejecuta sus procesos en sus hilos de trabajo del planificador
([hilos de trabajo](#workers), [modelo de ejecución](execution-model.md)). El
arranque convierte la llamada a la función de entrada en el primer proceso, el
proceso principal, y ejecuta el ejecutor hasta que este termina:

- Los procesos ejecutables esperan en la cola de ejecución FIFO (el primero en
  entrar es el primero en salir) de su hilo de trabajo
  ([hilos de trabajo](#workers)). Un hilo de trabajo ejecuta el primero durante
  una porción de tiempo de 4.000 reducciones (`CONTEXT_REDS` de OTP) y después
  lo devuelve al final de su cola, salvo que haya terminado.
- Cada entrada de función gasta una reducción: llamadas, llamadas de cola,
  llamadas a funs y dinámicas, y builtins. Si no queda ninguna, la entrada no
  ocurre: el proceso registra la función en la que iba a entrar, conserva sus
  argumentos en sus registros (siguen siendo raíces de recolección) y vuelve al
  ejecutor, que más tarde lo reanuda repitiendo la entrada
  ([modelo de ejecución](execution-model.md#operations)). Cada cabecera de
  bucle de una comprehension también gasta una, de modo que un bucle sin
  llamadas también cede el control. Los builtins cuyo trabajo crece con un
  argumento lista o binary se ejecutan por porciones y ceden el control entre
  ellas ([porciones](builtins.md#portions)).
- Cada proceso posee su heap y su pila. Los argumentos de un proceso nuevo se
  copian en su heap
  ([copia entre heaps](runtime-heap.md#copying-between-heaps)).
- Un proceso termina cuando su primera llamada retorna o lanza una excepción.
  El contexto, el heap y la pila de un proceso terminado se liberan de
  inmediato; su pid sigue siendo un término válido y `is_process_alive/1`
  devuelve false para él.
- Un proceso que espera en un `receive` no está en ninguna cola; un envío
  dirigido a él lo vuelve a encolar ([receive](#receive)).
- Cuando el proceso principal termina, el programa termina con su resultado
  ([ejecutables](executables.md)): los procesos que siguen en la cola o en
  espera se liberan sin seguir ejecutándose, igual que un escript de OTP se
  detiene cuando `main/1` retorna.
- Una señal de salida que termina el proceso principal termina el programa
  ([señales de salida](#exit-signals)).
- `erlang:halt/0,1` en cualquier proceso termina el programa con su estado. Un
  fallo del runtime en cualquier proceso (memoria agotada, un límite opcional
  superado, un error interno) termina el programa como fallo del runtime
  (salida 70). Una excepción de Erlang solo termina el proceso que la lanzó
  ([salidas](#exits)).
- Las invocaciones desde el anfitrión de funciones exportadas
  (`CLAUSE_invoke_v1`) ejecutan su función en el contexto que llama hasta el
  final, reanudándola tras cada cesión sin ejecutar otros procesos; los
  programas arrancados por `CLAUSE_main_v1` usan el ejecutor.

## Hilos de trabajo

El ejecutor ejecuta los procesos en `RuntimeOptions::schedulers` hilos de
trabajo: el hilo que arrancó el programa y un hilo más por cada hilo de trabajo
adicional. Los programas toman el número de `--schedulers N` (de 1 a 1.024,
[opciones del runtime](executables.md#runtime-options)); por defecto hay un
hilo de trabajo por procesador lógico, como `+S` de OTP.

- Cada hilo de trabajo tiene su propia cola de ejecución, como cada
  planificador de ERTS: un proceso se queda con el hilo de trabajo en el que se
  ejecutó por última vez, de modo que su heap permanece en las cachés de ese
  núcleo. Un proceso lanzado empieza en el hilo de trabajo de su padre. Los
  hilos de trabajo inactivos duermen hasta que se encola un proceso para ellos
  o hay trabajo que robar; el hilo de temporizadores encola los procesos cuyo
  tiempo de espera de receive vence
  ([tiempos de espera de receive](#receive-timeouts)).
- Los procesos migran como en ERTS, que equilibra sus colas de ejecución
  periódicamente: cada 4 porciones un hilo de trabajo compara su cola con la de
  su vecino y toma un proceso de ella cuando el vecino tiene al menos dos más.
  Un hilo de trabajo con la cola vacía roba un proceso de la cola más larga que
  tenga al menos dos, o el único proceso de un hilo de trabajo dormido, que
  ejecuta antes de que ese hilo despierte.
- Los despertares son perezosos, igual que ERTS mantiene en un mismo
  planificador los procesos que se comunican entre sí: un proceso en ejecución
  que despierta a un proceso de un hilo de trabajo dormido y vacío lo encola en
  su propio hilo de trabajo, que lo toma cuando termina su porción; solo se
  despierta a otro hilo de trabajo cuando una cola pasa a tener más de un
  proceso. Los hilos de temporizadores y de E/S, las tareas de puertos y los
  hilos de trabajo entre porciones encolan un proceso para su propio hilo de
  trabajo, o para uno inactivo cuando el suyo está ocupado.
- Un mutex del ejecutor protege las colas de ejecución, los procesos en espera,
  los temporizadores, los nombres registrados, los enlaces y monitores de todos
  los procesos y todo proceso que no esté en ejecución. El heap, la pila, el
  buzón y el canal de fallos de un proceso en ejecución pertenecen solo a su
  hilo de trabajo; el código Erlang se ejecuta sin el bloqueo.
- Los enlaces, los monitores y los nombres cambian bajo el bloqueo de
  inmediato, también para un proceso que se ejecuta en otro sitio. Un mensaje
  dirigido a un proceso que se ejecuta en otro hilo de trabajo todavía no puede
  ir a su heap: se copia en un búfer propio y se entrega, después de los anteriores ya
  almacenados, cuando termina la porción del receptor
  ([búferes de mensajes](runtime-heap.md#message-buffers)). Una señal de salida
  de `exit/2` o `exit_signal/2` dirigida a un proceso así no hace nada y su
  proceso termina su porción (`builtins::Blocked`); espera a que termine la
  porción del destino, después se ejecuta el primero y repite el builtin con
  los mismos argumentos. El destino queda retenido hasta entonces, así que el
  builtin repetido no puede volver a encontrarlo en ejecución. Un proceso que
  termina con enlaces o monitores cuyos procesos se ejecutan en otro sitio se
  finaliza del mismo modo cuando terminan sus porciones.
- Así, las señales conservan su orden: un mensaje almacenado antes de una señal
  de salida bloqueada del mismo emisor llega primero al receptor, e
  `is_process_alive/1` después de `exit(Pid, kill)` es false, como promete OTP
  para las señales del llamante.
- Un spawn enlaza o monitoriza el proceso nuevo (`spawn_link`,
  `spawn_monitor`) antes de que ningún hilo de trabajo pueda ejecutarlo. Un proceso
  lanzado puede ejecutarse antes de que su padre continúe, así que un programa
  que monitoriza o se enlaza a un proceso de vida corta después de `spawn/1`
  puede ver `noproc`, como en un OTP con varios planificadores.
- El final del proceso principal, un halt o un fallo del runtime detienen el
  programa en cuanto todos los hilos de trabajo han terminado su porción
  actual;
  después se liberan los demás procesos.
- Los servicios compartidos del runtime están sincronizados
  ([hilos](runtime.md#threads)): los átomos, el servidor de código, los números
  de pid y de puerto y la cuenta de memoria.
- La salida de distintos procesos se intercala en el orden en que ocurren sus
  escrituras. Cada llamada a `io:format` y a `erlang:display` escribe su texto
  de una vez.

Los despertares y el apagado no necesitan ningún mecanismo adicional, porque
todo cambio del estado de planificación de un proceso ocurre bajo el mutex del
ejecutor:

- Un mensaje, `'EXIT'` o `'DOWN'` para un proceso en espera lo encola en la
  misma sección crítica que lo entrega, y despierta a un hilo de trabajo como
  se ha descrito. Un proceso que sigue en la porción en la que empezó a esperar no
  puede recibir un mensaje en ese momento (sus emisores esperan a que termine
  la porción), así que la entrega siempre lo encuentra aparcado.
- Un hilo de trabajo que no encuentra ningún proceso ejecutable duerme hasta
  que otro hilo de trabajo, un envío o el hilo de temporizadores encola uno, o
  hasta el final del programa. Los hilos de trabajo nunca leen el reloj para los temporizadores; aparcar un
  proceso con un tiempo de espera anterior a todos los demás solo despierta al
  hilo de temporizadores.
- Un mensaje y el vencimiento del tiempo de espera de un mismo receive pueden
  competir: el que llegue primero encola el proceso y cancela al otro, y el
  receive toma un mensaje que llegó antes de reanudarse, como hace OTP.
- Una señal de salida dirigida a un proceso en espera, encolado, retenido o
  bloqueado lo saca de donde esté antes de finalizarlo.
- Cuando el programa termina, cada hilo de trabajo termina su porción actual y se
  detiene; `run()` retorna tras esperarlos (join), y todos los demás procesos
  que inició el ejecutor se liberan, de modo que el runtime se apaga sin que
  quede ningún contexto.
- El golden de OTP `executables_wakeups` pone esto a prueba con 1, 2, 4 y
  todos los hilos de trabajo: receptores cuyos tiempos de espera de 0–2 ms compiten con
  los mensajes de sus emisores, una cadena de 16 procesos enlazados en bucle
  activo terminada por una única señal de salida con cada miembro
  monitorizado, procesos monitorizados que terminan mientras su observador
  despierta, un programa que termina mientras los procesos giran, esperan y se
  inundan entre sí, y un halt en otro proceso.

### Tiempos de espera de receive

Los temporizadores viven en una rueda de temporizadores jerárquica con hash
(timer wheel), como los mantiene ERTS (`scheduler/timer_wheel`):

- Los ticks son milisegundos desde que arrancó el ejecutor. Seis niveles de 64
  ranuras cubren 2^36 ticks, más que el tiempo de espera más largo
  (4.294.967.295 ms). Un temporizador se sitúa en la ranura del dígito de 6
  bits más alto en el que su tick difiere del tick actual de la rueda; las
  ranuras ocupadas son mapas de bits por nivel.
- Armar (se aparca un proceso en espera) y cancelar (llega antes un mensaje,
  una señal de salida o el final del proceso) desenlazan o enlazan un nodo de
  lista intrusiva guardado con el estado de planificación del proceso: tiempo
  constante. Un plazo se convierte en el tick igual o posterior a él, de modo
  que ningún tiempo de espera se dispara antes de tiempo.
- Un hilo de temporizadores por ejecución duerme hasta la siguiente ranura
  ocupada (la primera ranura ocupada después de la actual en cualquier nivel),
  lee el reloj una vez al despertar y avanza la rueda hasta ese tick: las
  ranuras de niveles superiores alcanzadas en su inicio bajan sus
  temporizadores, y la ranura de nivel 0 se dispara. Solo se consultan las
  ranuras cuyo momento ha llegado; los procesos en espera nunca se recorren.
  Los procesos vencidos se encolan en orden de tick.
- Los hilos de trabajo comparten la rueda bajo el mutex del ejecutor. `after 0` nunca
  espera e `infinity` nunca arma un temporizador.
- `--profile` informa de las porciones de tiempo y de las lecturas del reloj
  del hilo de temporizadores ([perfilado](profiling.md)). Los temporizadores
  solo se disparan con la precisión de las esperas temporizadas del anfitrión
  (en Windows, la resolución de temporizador por defecto).
- `runtime_timer_wheel` arma 20.000 temporizadores en todos los niveles,
  cancela el 90% y avanza en pasos desiguales: cada temporizador restante se
  dispara una vez, en el primer avance que alcanza su tick, en orden de tick;
  ninguno cancelado se dispara.

## Salidas

Un proceso distinto del principal termina con una razón de salida, como en OTP
(`detail::exit_reason`, `process/exits`). Las señales de salida la llevan a los
procesos enlazados ([enlaces](#links)) y los mensajes `'DOWN'` a los que lo
monitorizan ([monitores](#monitors)); los informes de error la muestran.

| Cómo termina el proceso | Razón de salida | Informe de error |
| --- | --- | --- |
| Su primera llamada retorna | `normal` | Ninguno |
| `exit(Reason)` (también `normal`, `kill`) | `Reason` | Ninguno |
| Un error (`error/1,2,3`, `badarith`, `{badmatch, V}`, `undef`, ...) | `{Reason, Stack}` | Sí |
| Un `throw(Value)` no capturado | `{{nocatch, Value}, Stack}` | Sí |
| Lo termina una señal de salida ([señales de salida](#exit-signals)) | La razón de la señal, `killed` para `exit(Pid, kill)` | Ninguno |

Un informe de error se escribe en stderr cuando el proceso termina, después de
vaciar la salida estándar, con el formato del manejador de logger por defecto
de OTP:

```text
=ERROR REPORT==== 8-Oct-2026::03:42:15.983000 ===
Error in process <0.8.0> with exit value:
{boom,[{crash_reports,'-main/1-fun-6-',0,[]}]}

```

La cabecera lleva la hora local; la razón se presenta como lo hace `~p`. El
proceso principal no escribe ninguno: su excepción no capturada es la del
programa ([ejecutables](executables.md)).

## Mensajes

`Dest ! Msg` y `erlang:send(Dest, Msg)` evalúan primero `Dest` y devuelven
`Msg`.

| `Dest` | Efecto |
| --- | --- |
| El pid de un proceso vivo | `Msg` se copia de forma plana en el heap del receptor ([copia entre heaps](runtime-heap.md#copying-between-heaps)), como OTP copia los mensajes (uno grande, en un bloque que el receptor asume, [traspaso de mensajes](runtime-heap.md#message-buffers)), y se añade a su buzón de señales |
| El pid de un proceso que ha terminado | Nada; el envío tiene éxito |
| Un [nombre registrado](#registered-names) | Como para su pid; `badarg` cuando ningún proceso vivo tiene ese nombre |
| `{Name, nonode@nohost}` de dos átomos | Como para el pid registrado como `Name`; nada si no hay ninguno |
| `{Name, Node}` para cualquier otro nodo | Nada (no hay otros nodos) |
| Una referencia | Como para el propietario de un [alias](#aliases) activo; nada en otro caso |
| Cualquier otra cosa | `badarg` |

- Los mensajes de un mismo emisor llegan en el orden en que los envió; un envío
  a sí mismo es un mensaje como cualquier otro.
- Cada mensaje es una raíz de recolección de su receptor hasta que un receive
  lo toma ([heap del runtime](runtime-heap.md#roots-and-safe-points)).
- El buzón del receptor (`Mailbox`) mantiene un buzón de señales, al que se
  añaden los envíos, y una cola de mensajes que receive recorre desde una
  posición guardada: los mensajes llegados pasan al final de la cola cuando un
  receive los examina.
- Cuando el heap del receptor rechaza la copia (un límite opcional como
  `--max-heap`, o el anfitrión sin memoria), no se entrega nada y el proceso
  emisor falla con un fallo del runtime (salida 70), como cualquier proceso que
  supera un límite.

## Receive

`receive` selecciona entre sus cláusulas como `case`, sobre los mensajes del
buzón:

- El recorrido del buzón empieza en el mensaje más antiguo. Cada mensaje se
  compara con las cláusulas en orden (patrones y guards, que pueden leer
  ligaduras anteriores al `receive`); el primer mensaje que encaja con alguna
  cláusula se retira y se ejecuta el cuerpo de esa cláusula. Los mensajes que
  no encajan con ninguna cláusula se quedan en el buzón en su orden; el
  siguiente receive vuelve a empezar por el mensaje más antiguo.
- Cuando se han examinado todos los mensajes, el proceso espera
  (`CLAUSE_wait_frame_v1`, un builtin en el que se entra como en una llamada):
  sale de la cola de ejecución hasta que un envío le entrega un mensaje, y
  entonces el recorrido continúa con los mensajes que han llegado. Los procesos
  en espera conservan sus marcos y mensajes como raíces de recolección y
  recolectan al reanudarse
  ([procesos en espera](runtime-heap.md#waiting-and-suspended-processes)).
- Los nombres ligados en todas las cláusulas, y en el cuerpo de `after` cuando
  lo hay, se exportan después del `receive`, como en `case`; una llamada en
  posición de cola del cuerpo de una cláusula o de `after` es una llamada de
  cola, así que un bucle de servidor se ejecuta con pila constante.
- `after T -> Body`: `T` se evalúa primero, antes del recorrido. Cuando el
  receive fuera a esperar, `T` debe ser `infinity` o un entero en
  0..4294967295 (milisegundos); si no, `error:timeout_value`, tras lo cual el
  siguiente receive recorre desde el mensaje más antiguo; un mensaje que encaja
  de inmediato nunca lo comprueba, como en OTP. `after 0` ejecuta `Body` en
  cuanto se han examinado todos los mensajes. Un tiempo de espera finito
  empieza cuando el receive espera por primera vez y no lo reinician los
  mensajes que no encajan con ninguna cláusula; cuando vence, `Body` se ejecuta
  a partir de las ligaduras anteriores al receive y el siguiente receive
  recorre desde el mensaje más antiguo. Un mensaje que llega antes de que venza
  el tiempo de espera se toma. Un receive con solo `after` es una pausa (el
  modismo de `timer:sleep/1`).
- Código generado: una cabecera de bucle consulta el siguiente mensaje sin
  examinar (`peek` de `CLAUSE_receive_v1`, en una ranura raíz), la selección de
  cláusula toma un mensaje que encaja (`take`) antes de su cuerpo u omite uno
  que no encaja (`skip`) y repite el bucle; cuando no queda ningún mensaje, el
  bucle entra en la espera con el tiempo de espera, que responde `true`
  (recorrer de nuevo) o `false` (tiempo agotado: `restart` y después el cuerpo
  de `after`).
- El ejecutor mantiene un temporizador por cada proceso en espera con un tiempo
  de espera finito en una rueda de temporizadores
  ([tiempos de espera de receive](#receive-timeouts)): uno vencido vuelve a
  encolar el proceso. Los tiempos de espera se miden en un reloj monótono en
  milisegundos y nunca se disparan antes de tiempo.
- Cuando todos los procesos esperan sin tiempo de espera un mensaje que nada
  puede enviar, el programa espera para siempre, como hace OTP. Una invocación
  desde el anfitrión (`CLAUSE_invoke_v1`) que fuera a esperar falla en su lugar
  con `busy`: ningún otro proceso se ejecuta durante ella.

## Enlaces

Un enlace conecta dos procesos en ambos sentidos (`Signals` en cada contexto:
los pids enlazados en el orden de enlace y el indicador `trap_exit`).

- `link(Pid)` enlaza al llamante con un proceso vivo y devuelve `true`;
  enlazarse consigo mismo o volver a enlazarse no hace nada. Para un proceso
  que ha terminado lanza `error:noproc` o, cuando el llamante atrapa las
  salidas, devuelve `true` y envía al llamante `{'EXIT', Pid, noproc}`, como
  hace el `link/1` local de OTP.
- `unlink(Pid)` elimina el enlace en ambos lados; el enlace no tiene efecto
  después de que retorne. Devuelve `true` también cuando no había enlace.
- `spawn_link/1,3` enlazan el proceso nuevo con el llamante antes de que se
  ejecute.
- Cuando un proceso termina, cada proceso enlazado recibe una señal de salida
  con su razón de salida ([salidas](#exits)) y el enlace desaparece. Los
  procesos enlazados reciben la señal en el orden en que se crearon los
  enlaces.

## Monitores

Un monitor es unidireccional: el proceso que monitoriza lo mantiene (por
referencia, en `Signals`) y el proceso monitorizado guarda la referencia y el
pid del que monitoriza, para poder enviar el mensaje cuando termine.

- `monitor(process, Pid)` devuelve una referencia nueva. Cuando el proceso
  termina, el llamante recibe `{'DOWN', Ref, process, Pid, Reason}` con su
  razón de salida ([salidas](#exits)); para un proceso que ya ha terminado
  recibe el mensaje de inmediato con la razón `noproc`. Monitorizarse a sí
  mismo no crea nada. Cada llamada crea un monitor independiente con su propio
  mensaje; los mensajes de un mismo proceso salen en el orden en que se crearon
  los monitores.
- `demonitor(Ref)` detiene el monitor: después no llega ningún `'DOWN'` suyo.
  Devuelve `true`, también para una referencia que no es un monitor activo del
  llamante.
- `demonitor(Ref, Options)`: `info` devuelve si el monitor seguía activo;
  `flush` elimina el mensaje `{_, Ref, _, _, _}` más antiguo cuando no lo
  estaba (su `'DOWN'` ya está en el buzón), como hace OTP.
- `spawn_monitor/1,3` devuelven `{Pid, Ref}`, el monitor creado antes de que se
  ejecute el proceso nuevo.
- Un proceso que termina descarta los monitores que mantiene.
- `monitor(process, Name)` y `monitor(process, {Name, nonode@nohost})`
  monitorizan el proceso registrado como `Name` (`noproc` de inmediato si no
  hay ninguno); su `'DOWN'` nombra `{Name, nonode@nohost}` en lugar del pid.
  `{Name, Node}` para otro nodo es `badarg`.
- `monitor(port, Port | Name)` monitoriza un puerto
  ([puertos](ports.md#port-table-and-ownership)):
  `{'DOWN', Ref, port, Port, Reason}` cuando se cierra. Un pid para `port`, o
  un puerto para `process`, es `badarg`.

## Nombres registrados

El ejecutor mantiene una tabla de nombres (átomos) a pids, y cada proceso su
propio nombre (`Signals::name`).

- `register(Name, Pid)` da nombre a un proceso vivo: `badarg` para
  `undefined`, un nombre en uso, un proceso que ya tiene nombre, un proceso que
  ha terminado o un `Pid` que no es un pid. Un proceso puede registrarse a sí
  mismo.
- `unregister(Name)` libera el nombre (`badarg` cuando ningún proceso lo
  tiene); `whereis(Name)` es el pid o `undefined`; `registered()` enumera los
  nombres en el orden de la tabla de átomos (el orden de OTP tampoco está
  especificado).
- El nombre de un proceso se libera al terminar, antes de que se envíen las
  señales a sus enlaces y monitores, así que un receptor de `'DOWN'` o `'EXIT'`
  puede volver a registrar el nombre, como en OTP.

## Diccionario del proceso

`put/2`, `get/0,1`, `get_keys/0,1` y `erase/0,1` se comportan como en OTP:
`put/2` y `erase/1` devuelven el valor anterior o `undefined`, `erase/0`
devuelve todos los `{Key, Value}` y vacía el diccionario, y las claves se
comparan con igualdad exacta (`1` y `1.0` son dos claves).

- Cada proceso tiene su propio diccionario; un proceso lanzado empieza vacío.
- Las entradas son palabras del heap del proceso guardadas en
  `ProcessDictionary`
  ([process_dictionary.hpp](../runtime/include/process_dictionary.hpp)) y
  visitadas como raíces de recolección
  ([raíces](runtime-heap.md#roots-and-safe-points)); se liberan con el proceso.
- El orden de `get/0` y `get_keys/0,1` no está especificado, como en OTP. La
  búsqueda recorre las entradas linealmente; las claves inmediatas se comparan
  por palabra. `put/2`, `get/1` y `erase/1` toman y devuelven las palabras de
  las entradas tal cual, sin admitir ningún término.

## Temporizadores

`start_timer/3,4` y `send_after/3,4` (`builtins/erlang/timers.cpp`,
`scheduler/timers.cpp`) arman un temporizador en la rueda del ejecutor (la
misma que usan los [tiempos de espera de receive](#receive-timeouts)) que envía
`Msg`, o `{timeout, TimerRef, Msg}`, a un pid o a un nombre registrado cuando
se dispara.

- El mensaje se copia al iniciar el temporizador en un `MessageBuffer`
  ([búferes de mensajes](runtime-heap.md#message-buffers)), un bloque de heap
  propio del temporizador, y se vuelve a copiar en el heap del receptor cuando
  se dispara, igual que copia un envío: cualquier término, incluidos los funs
  locales, viaja sin cambios.
- Un receptor que se está ejecutando en un hilo de trabajo recibe el mensaje
  cuando termina su porción. Un nombre registrado se resuelve cuando el temporizador
  se dispara; un nombre que nadie tiene, o el pid de un proceso terminado,
  descarta el mensaje. Los temporizadores enviados a un pid se liberan cuando
  ese proceso termina.
- El tiempo es en milisegundos relativos en 0..2^49-1 o, con `{abs, true}`, un
  `erlang:monotonic_time(millisecond)` absoluto; cualquier otra cosa es
  `badarg`. Un plazo más allá del alcance de la rueda se vuelve a armar cuando
  llega esa ranura.
- `cancel_timer/1,2` y `read_timer/1,2` devuelven los milisegundos restantes o
  `false`; `{async, true}` devuelve `ok` y envía `{cancel_timer, Ref, Left}`
  (`{read_timer, ...}`), `{info, false}` devuelve `ok` sin resultado.

## Introspección

`process_info/1,2` (`builtins/erlang/introspection.cpp`,
`scheduler/introspection.cpp`) lee otro proceso bajo el bloqueo del ejecutor y
copia sus términos (mensajes, diccionario) en el heap del llamante; un proceso
que se ejecuta en otro hilo de trabajo se lee cuando termina su porción. El pid de un
proceso que no está vivo da `undefined`.

- Elementos: `registered_name` (`[]` a secas cuando no está registrado),
  `status` (`running`, `runnable`, `waiting`), `message_queue_len`,
  `messages`, `links`, `monitors`, `monitored_by`, `dictionary`, `trap_exit`,
  `group_leader`, `heap_size`, `total_heap_size`, `stack_size`, `memory`
  (palabras del heap, sus fragmentos y los binaries fuera del heap, y la pila),
  `reductions` (0), `priority` (`normal`), `error_handler`,
  `garbage_collection`. `process_info/1` los enumera desde `status` hasta
  `garbage_collection`.
- Los elementos de OTP que Clause no mantiene (`current_function`,
  `initial_call`, `current_stacktrace`, ...) lanzan `error:{notsup, Item}`; los
  elementos desconocidos son `badarg`.
- `processes/0` enumera los pids vivos en orden de creación. Un proceso lanzado
  hereda el group leader de su padre; el primer proceso es su propio group
  leader. `group_leader/2` del pid de un proceso que no está vivo es `badarg`.
- `garbage_collect/0,1,2` solicita una recolección en el siguiente safepoint
  del destino y devuelve `true` (`false` si no hay proceso vivo); con
  `{async, RequestId}` devuelve `async` y envía
  `{garbage_collect, RequestId, Result}`. `yield/0` termina la porción de
  tiempo en la siguiente entrada de función.

## Opciones de spawn

Fuentes: `builtins/erlang/spawning.cpp`, `scheduler/aliases.cpp`.

- `spawn_opt/2..5` aceptan `link`, `monitor`, `{monitor, MonitorOptions}` y las
  opciones de ajuste `{priority, P}`, `{fullsweep_after, N}`,
  `{min_heap_size, N}`, `{min_bin_vheap_size, N}`, `{max_heap_size, S}`,
  `{message_queue_data, M}`, `{async_dist, B}`; `{min_heap_size, N}` fija el
  [heap mínimo](runtime-heap.md#sizing-and-budget) del hijo, y las demás
  opciones de ajuste se comprueban y se aceptan, pero no se aplican. Un nodo
  distinto de `nonode@nohost` es `badarg`.
- `spawn_request/1..5` lanza el proceso de inmediato y envía
  `{Tag, ReqId, ok, Pid}` (`{Tag, ReqId, error, Reason}` si falla, `badopt`
  para una opción inválida) según piden `{reply_tag, Tag}` y
  `{reply, yes | no | error_only | success_only}`; con `monitor`, el
  identificador de la solicitud es la referencia del monitor.
  `spawn_request_abandon/1` devuelve `false`: la respuesta ya se ha enviado.
- `hibernate(M, F, A)` espera hasta que el buzón contiene un mensaje y después
  llama a `M:F(A...)` en lugar de la llamada; la pila se conserva, así que el
  resultado vuelve al llamante.

## Alias

Un alias es una referencia a la que se pueden enviar mensajes (`Alias ! Msg`):
`alias/0,1` (`explicit_unalias`, o `reply` para un único mensaje), o un monitor
creado con `{alias, explicit_unalias | demonitor | reply_demonitor}` de
`monitor/3` (`demonitor` termina con el monitor, `reply_demonitor` además
termina el monitor con su primer mensaje). `unalias/1` termina un alias del
llamante. Un envío a una referencia que no es un alias activo, o cuyo
propietario ha terminado, se descarta. Un alias de respuesta solo se consume
cuando se entrega su mensaje, tras cualquier espera por un propietario ocupado.
`{tag, Tag}` de `monitor/3` sustituye `'DOWN'` en el mensaje del monitor; los
monitores de puertos no aceptan opciones.

## Nodos

Un programa Clause es un único nodo no distribuido, `nonode@nohost`, y responde
como un nodo de OTP de ese tipo (`builtins/erlang/node.cpp`): `nodes/0` es
`[]`, `nodes(this | known)` es `[nonode@nohost]`, los demás tipos `[]`;
`nodes/2` da `{nonode@nohost, #{connection_id => undefined, node_type =>
this}}` para las claves solicitadas. `is_alive/0` es `false`,
`monitor_node/2,3` lanzan `error:notalive` y `disconnect_node/1` devuelve
`ignored`.

## Señales de salida

Toda señal de salida procede de un proceso en ejecución (`exit/2`,
`exit_signal/2`, `link/1`) o del final de un proceso. El ejecutor actúa sobre
ella de inmediato cuando su destino no se ejecuta en otro hilo de trabajo, y si
no, en cuanto termina la porción del destino ([hilos de trabajo](#workers),
`scheduler/signals`): un destino terminado sale de la cola de ejecución o de su
espera y se finaliza (señales a sus enlaces, su informe de error escrito, su
contexto liberado) antes de que retorne el builtin emisor. Una cadena larga de
enlaces termina proceso a proceso sin recursión.

| Señal en un proceso | Sin atrapar salidas | Atrapando salidas |
| --- | --- | --- |
| `exit(Pid, kill)`, `exit_signal(Pid, kill)` | Termina con la razón `killed` | Termina con la razón `killed` |
| Razón `normal` (de un enlace, o enviada a otro proceso) | Nada | Mensaje `{'EXIT', From, normal}` |
| `exit(self(), normal)` | Termina con la razón `normal` (peculiaridad de OTP) | Mensaje `{'EXIT', Self, normal}` |
| `exit_signal(self(), normal)` | Nada | Mensaje `{'EXIT', Self, normal}` |
| Cualquier otra razón, incluido `kill` de un enlace | Termina con esa razón | Mensaje `{'EXIT', From, Reason}` |

- `process_flag(trap_exit, Bool)` activa o desactiva la captura y devuelve el
  valor anterior (inicialmente `false`); `process_flag(min_heap_size, N)` fija
  el [heap mínimo](runtime-heap.md#sizing-and-budget) a partir de la siguiente
  recolección y devuelve el anterior.
- Un proceso terminado por una señal que se envió a sí mismo
  (`exit(self(), kill)`) se desenrolla atravesando todo `catch`, todo manejador
  de `try` y todo cuerpo de `after`: la señal no es una excepción
  (`CallError::exited` en el canal de fallos).
- `exit/2` y `exit_signal/2` devuelven `true`; dirigidas a un proceso que ha
  terminado no hacen nada. Un destino que es una referencia tampoco hace nada,
  aunque sea un [alias](#aliases) activo.
- Una señal de salida que termina el proceso principal termina el programa
  como un `exit` no capturado ([estado de salida](executables.md#exit-status)):
  la razón `normal` sale con 0.
- Cuando el heap del receptor rechaza una razón de salida o un mensaje
  `'EXIT'`, el receptor falla con un fallo del runtime (salida 70).

## Puertos

Los puertos se especifican en [puertos](ports.md): un puerto está enlazado con
quien lo abre, participa en enlaces, monitores, señales de salida y nombres
registrados como un proceso, y se comunica con su proceso conectado mediante
mensajes.

## Builtins

| Builtin | Comportamiento |
| --- | --- |
| `spawn(Fun)` | `badarg` salvo que `Fun` sea un fun; si lo es, un proceso nuevo llama a `Fun()`, lanzando `{badarity, {Fun, []}}` en ese proceso si la aridad es otra |
| `spawn(M, F, Args)` | `badarg` salvo que `M` y `F` sean átomos y `Args` una lista propia; si no, un proceso nuevo llama a `M:F(Args...)`, lanzando `undef` en ese proceso cuando ningún módulo la exporta y ningún builtin tiene ese nombre |
| `spawn_link(Fun)`, `spawn_link(M, F, Args)` | Como `spawn`, y el proceso nuevo queda enlazado con el llamante ([enlaces](#links)) |
| `is_process_alive(Pid)` | `badarg` salvo que `Pid` sea un pid; true mientras su proceso no haya terminado |
| `spawn_monitor(Fun)`, `spawn_monitor(M, F, Args)` | Como `spawn`, devolviendo `{Pid, Ref}` de un nuevo [monitor](#monitors) |
| `link(Pid)`, `unlink(Pid)` | `badarg` salvo que `Pid` sea un pid ([enlaces](#links)) |
| `monitor(process, Item)` | `badarg` para otro tipo u otro elemento; una referencia ([monitores](#monitors)); `Item` es un pid o un nombre registrado |
| `register(Name, Pid)`, `unregister(Name)`, `whereis(Name)`, `registered()` | Véase [nombres registrados](#registered-names); `Name` debe ser un átomo |
| `demonitor(Ref)`, `demonitor(Ref, Options)` | `badarg` salvo que `Ref` sea una referencia y `Options` una lista propia de `flush` e `info` |
| `exit(Dest, Reason)`, `exit_signal(Dest, Reason)` | `badarg` salvo que `Dest` sea un pid o una referencia; `true` tras la [señal de salida](#exit-signals) |
| `process_flag(trap_exit, Bool)`, `process_flag(min_heap_size, N)` | El valor anterior; `badarg` para otro indicador, un valor no booleano o un tamaño negativo o no entero |
| `erlang:send(Dest, Msg)`, `Dest ! Msg` | `Msg`, después de enviarlo ([mensajes](#messages)); `send/2` no se importa automáticamente |

El proceso nuevo se añade al final de la cola del hilo de trabajo de su padre
([hilos de trabajo](#workers)); `spawn` devuelve su pid de inmediato.
