---
source: docs/processes.md
sourceCommit: 06042fa
sourceSha256: 9add4b7c491f5fe2b819ab08fada089a098afd08cd71b803a8c87cab16f57892
translatedAt: 2026-10-09
---
# Procesos

Plan 11 step 43 (2026-10-08): procesos lanzados (spawn) sobre un ejecutor
cooperativo; step 44: razones de salida e informes de error; step 45: envío
de mensajes; step 46: receive selectivo; step 47: tiempos de espera de
receive; step 48: enlaces (links) y señales de salida; step 49: monitores;
step 50: nombres registrados; step 53: puertos (ninguno); step 56: workers del
planificador; step 57: despertares entre workers y apagado.

## Ejecutor

Un runtime ejecuta sus procesos en sus workers del planificador
([workers](#workers), [modelo de ejecución](execution-model.md)). El arranque
convierte la llamada a la función de entrada en el primer proceso, el proceso
principal, y ejecuta el ejecutor hasta que este termina:

- Los procesos ejecutables esperan en una única cola FIFO (el primero en
  entrar es el primero en salir). Un worker ejecuta el primero durante una
  porción de tiempo de 4.000 reducciones (`CONTEXT_REDS` de OTP) y después lo
  devuelve al final de la cola, salvo que haya terminado.
- Cada entrada de función gasta una reducción: llamadas, llamadas de cola,
  llamadas a funs y dinámicas, y builtins. Si no queda ninguna, la entrada no
  ocurre: el proceso registra la función en la que iba a entrar, conserva sus
  argumentos en sus registros (siguen siendo raíces de recolección) y vuelve
  al ejecutor, que más tarde lo reanuda repitiendo la entrada. Un bucle que no
  hace ninguna llamada (una comprehension sobre una lista sin llamadas en su
  cuerpo) se ejecuta hasta el final antes de que el proceso pueda ceder el
  control. Los builtins cuyo trabajo crece con un argumento lista o binary se
  ejecutan por porciones y ceden el control entre ellas
  ([porciones](builtins.md#portions)).
- Cada proceso posee su heap y su pila. Los argumentos de un proceso nuevo se
  copian en su heap ([copia entre heaps](runtime-heap.md#copying-between-heaps)).
- Un proceso termina cuando su primera llamada retorna o lanza una excepción.
  El contexto, el heap y la pila de un proceso terminado se liberan de
  inmediato; su pid sigue siendo un término válido y `is_process_alive/1`
  devuelve false para él.
- Un proceso que espera en un `receive` no está en la cola; un envío dirigido
  a él lo devuelve al final ([receive](#receive)).
- Cuando el proceso principal termina, el programa termina con su resultado
  ([ejecutables](executables.md)): los procesos que siguen en la cola o en
  espera se liberan sin seguir ejecutándose, igual que un escript de OTP se
  detiene cuando `main/1` retorna.
- Una señal de salida que termina el proceso principal termina el programa
  ([señales de salida](#exit-signals)).
- `erlang:halt/0,1` en cualquier proceso termina el programa con su estado.
  Un fallo del runtime en cualquier proceso (memoria agotada, un límite
  opcional superado, un error interno) termina el programa como fallo del
  runtime (salida 70). Una excepción de Erlang solo termina el proceso que la
  lanzó ([salidas](#exits)).
- Las invocaciones desde el anfitrión de funciones exportadas
  (`CLAUSE_invoke_v1`) ejecutan su función en el contexto que llama hasta el
  final, reanudándola tras cada cesión sin ejecutar otros procesos; los
  programas arrancados por `CLAUSE_main_v1` usan el ejecutor.

## Workers

Plan step 56 (2026-10-08). El ejecutor ejecuta los procesos en
`RuntimeOptions::schedulers` hilos worker: el hilo que arrancó el programa y
un hilo más por cada worker adicional. Los programas toman el número de
`--schedulers N` (de 1 a 1.024,
[opciones del runtime](executables.md#runtime-options)); por defecto hay un
worker por procesador lógico, como `+S` de OTP.

- Cada worker toma el primer proceso de la única cola compartida (la
  alternativa documentada a las colas por worker con robo de trabajo (work
  stealing): una sola cola conserva el orden FIFO de OTP y no necesita robo).
  Los workers inactivos duermen hasta que se encola un proceso o vence el
  tiempo de espera de receive más próximo.
- Un mutex del ejecutor protege la cola, los procesos en espera, los
  temporizadores, los nombres registrados, los enlaces y monitores de todos
  los procesos y todo proceso que no esté en ejecución. El heap, la pila, el
  buzón y el canal de fallos de un proceso en ejecución pertenecen solo a su
  worker; el código Erlang se ejecuta sin el bloqueo.
- Los enlaces, los monitores y los nombres cambian bajo el bloqueo de
  inmediato, también para un proceso que se ejecuta en otro sitio. Un envío, o
  una señal de salida de `exit/2` o `exit_signal/2`, dirigido a un proceso que
  se ejecuta en otro worker no puede tocar su heap: el builtin no hace nada y
  su proceso termina su porción (`builtins::Blocked`); espera a que termine la
  porción del destino, después se ejecuta el primero y repite el builtin con
  los mismos argumentos. El destino queda retenido hasta entonces, así que el
  builtin repetido no puede volver a encontrarlo en ejecución. Un proceso que
  termina con enlaces o monitores cuyos procesos se ejecutan en otro sitio se
  finaliza del mismo modo cuando terminan sus porciones.
- Así, los mensajes y las señales de salida siguen surtiendo efecto en el
  momento en que se envían: un envío retorna cuando el mensaje ya está en el
  buzón del receptor, e `is_process_alive/1` después de `exit(Pid, kill)` es
  false, como promete OTP para las señales del llamante.
- Un spawn enlaza o monitoriza el proceso nuevo (`spawn_link`,
  `spawn_monitor`) antes de que ningún worker pueda ejecutarlo. Un proceso
  lanzado puede ejecutarse antes de que su padre continúe, así que un programa
  que monitoriza o se enlaza a un proceso de vida corta después de `spawn/1`
  puede ver `noproc`, como en un OTP con varios planificadores.
- El final del proceso principal, un halt o un fallo del runtime detienen el
  programa en cuanto todos los workers han terminado su porción actual;
  después se liberan los demás procesos.
- Los servicios compartidos del runtime están sincronizados
  ([hilos](runtime.md#threads)): los átomos, el servidor de código, los
  números de pid y la cuenta de memoria.
- La salida de distintos procesos se intercala en el orden en que ocurren sus
  escrituras. Cada llamada a `io:format` y a `erlang:display` escribe su texto
  de una vez.

Los despertares y el apagado (plan step 57) no necesitan ningún mecanismo
adicional, porque todo cambio del estado de planificación de un proceso
ocurre bajo el mutex del ejecutor:

- Un mensaje, `'EXIT'` o `'DOWN'` para un proceso en espera lo encola en la
  misma sección crítica que lo entrega, y despierta a un worker inactivo. Un
  proceso que sigue en la porción en la que empezó a esperar no puede recibir
  un mensaje en ese momento (sus emisores esperan a que termine la porción),
  así que la entrega siempre lo encuentra aparcado.
- Un worker que no encuentra ningún proceso ejecutable duerme hasta que otro
  worker encola uno, hasta el tiempo de espera de receive más próximo o hasta
  el final del programa; aparcar un proceso con un tiempo de espera despierta
  a todos los workers inactivos para que esperen al nuevo plazo. Los workers
  ocupados comprueban los temporizadores antes de cada porción.
- Un mensaje y el vencimiento del tiempo de espera de un mismo receive pueden
  competir: el que llegue primero encola el proceso y cancela al otro, y el
  receive toma un mensaje que llegó antes de reanudarse, como hace OTP.
- Una señal de salida dirigida a un proceso en espera, encolado, retenido o
  bloqueado lo saca de donde esté antes de finalizarlo.
- Cuando el programa termina, cada worker termina su porción actual y se
  detiene; `run()` retorna tras esperarlos (join), y todos los demás procesos
  que inició el ejecutor se liberan, de modo que el runtime se apaga sin que
  quede ningún contexto.
- El golden de OTP `executables_wakeups` pone esto a prueba con 1, 2, 4 y
  todos los workers: receptores cuyos tiempos de espera de 0–2 ms compiten con
  los mensajes de sus emisores, una cadena de 16 procesos enlazados en bucle
  activo terminada por una única señal de salida con cada miembro
  monitorizado, procesos monitorizados que terminan mientras su observador
  despierta, un programa que termina mientras los procesos giran, esperan y
  se inundan entre sí, y un halt en otro proceso.

## Salidas

Un proceso distinto del principal termina con una razón de salida, como en
OTP (`detail::exit_reason`, `process/exits`). Las señales de salida la llevan
a los procesos enlazados ([enlaces](#links)) y los mensajes `'DOWN'` a los
que lo monitorizan ([monitores](#monitors)); los informes de error la
muestran.

| Cómo termina el proceso | Razón de salida | Informe de error |
| --- | --- | --- |
| Su primera llamada retorna | `normal` | Ninguno |
| `exit(Reason)` (también `normal`, `kill`) | `Reason` | Ninguno |
| Un error (`error/1,2,3`, `badarith`, `{badmatch, V}`, `undef`, ...) | `{Reason, Stack}` | Sí |
| Un `throw(Value)` no capturado | `{{nocatch, Value}, Stack}` | Sí |
| Lo termina una señal de salida ([señales de salida](#exit-signals)) | La razón de la señal, `killed` para `exit(Pid, kill)` | Ninguno |

Un informe de error se escribe en stderr cuando el proceso termina, después
de vaciar la salida estándar, con el formato del manejador de logger por
defecto de OTP:

```text
=ERROR REPORT==== 8-Oct-2026::03:42:15.983000 ===
Error in process <0.8.0> with exit value:
{boom,[{crash_reports,'-main/1-fun-6-',0,[]}]}

```

La cabecera lleva la hora local; la razón se presenta como lo hace `~p`. El
proceso principal no escribe ninguno: su excepción no capturada es la del
programa ([ejecutables](executables.md)).

## Mensajes

`Dest ! Msg` y `erlang:send(Dest, Msg)` (plan step 45) evalúan primero
`Dest` y devuelven `Msg`.

| `Dest` | Efecto |
| --- | --- |
| El pid de un proceso vivo | `Msg` se copia en el heap del receptor ([copia entre heaps](runtime-heap.md#copying-between-heaps)), conservando su compartición, y se añade a su buzón de señales |
| El pid de un proceso que ha terminado | Nada; el envío tiene éxito |
| Un [nombre registrado](#registered-names) | Como para su pid; `badarg` cuando ningún proceso vivo tiene ese nombre |
| `{Name, nonode@nohost}` de dos átomos | Como para el pid registrado como `Name`; nada si no hay ninguno |
| `{Name, Node}` para cualquier otro nodo | Nada (no hay otros nodos) |
| Cualquier otra cosa | `badarg` |

- Los mensajes de un mismo emisor llegan en el orden en que los envió; un
  envío a sí mismo es un mensaje como cualquier otro.
- Cada mensaje es una raíz de recolección de su receptor hasta que un receive
  lo toma ([heap del runtime](runtime-heap.md#roots-and-safe-points)).
- El buzón del receptor (`Mailbox`) mantiene un buzón de señales, al que se
  añaden los envíos, y una cola de mensajes que receive recorre desde una
  posición guardada: los mensajes llegados pasan al final de la cola cuando un
  receive los examina.
- Cuando el heap del receptor rechaza la copia (un límite opcional como
  `--max-heap`, o el anfitrión sin memoria), no se entrega nada y el proceso
  emisor falla con un fallo del runtime (salida 70), como cualquier proceso
  que supera un límite.

## Receive

`receive` (plan steps 46–47) selecciona entre sus cláusulas como `case`,
sobre los mensajes del buzón:

- El recorrido del buzón empieza en el mensaje más antiguo. Cada mensaje se
  compara con las cláusulas en orden (patrones y guards, que pueden leer
  ligaduras anteriores al `receive`); el primer mensaje que encaja con alguna
  cláusula se retira y se ejecuta el cuerpo de esa cláusula. Los mensajes que
  no encajan con ninguna cláusula se quedan en el buzón en su orden; el
  siguiente receive vuelve a empezar por el mensaje más antiguo.
- Cuando se han examinado todos los mensajes, el proceso espera
  (`CLAUSE_wait_frame_v1`, un builtin en el que se entra como en una
  llamada): sale de la cola de ejecución hasta que un envío le entrega un
  mensaje, y entonces el recorrido continúa con los mensajes que han llegado.
  Los procesos en espera conservan sus marcos y mensajes como raíces de
  recolección y recolectan al reanudarse
  ([procesos en espera](runtime-heap.md#waiting-and-suspended-processes)).
- Los nombres ligados en todas las cláusulas, y en el cuerpo de `after` cuando
  lo hay, se exportan después del `receive`, como en `case`; una llamada en
  posición de cola del cuerpo de una cláusula o de `after` es una llamada de
  cola, así que un bucle de servidor se ejecuta con pila constante.
- `after T -> Body`: `T` se evalúa primero, antes del recorrido. Cuando el
  receive fuera a esperar, `T` debe ser `infinity` o un entero en
  0..4294967295 (milisegundos); si no, `error:timeout_value`; un mensaje que
  encaja de inmediato nunca lo comprueba, como en OTP. `after 0` ejecuta
  `Body` en cuanto se han examinado todos los mensajes. Un tiempo de espera
  finito empieza cuando el receive espera por primera vez y no lo reinician
  los mensajes que no encajan con ninguna cláusula; cuando vence, `Body` se
  ejecuta a partir de las ligaduras anteriores al receive y el siguiente
  receive recorre desde el mensaje más antiguo. Un mensaje que llega antes de
  que venza el tiempo de espera se toma. Un receive con solo `after` es una
  pausa (el modismo de `timer:sleep/1`).
- Código generado: una cabecera de bucle consulta el siguiente mensaje sin
  examinar (`peek` de `CLAUSE_receive_v1`, en una ranura raíz), la selección
  de cláusula toma un mensaje que encaja (`take`) antes de su cuerpo u omite
  uno que no encaja (`skip`) y repite el bucle; cuando no queda ningún
  mensaje, el bucle entra en la espera con el tiempo de espera, que responde
  `true` (recorrer de nuevo) o `false` (tiempo agotado: `restart` y después
  el cuerpo de `after`).
- El ejecutor mantiene un temporizador por cada proceso en espera con un
  tiempo de espera finito: uno vencido devuelve el proceso a la cola, y
  cuando ningún proceso puede ejecutarse el ejecutor duerme hasta el
  temporizador más próximo. Los tiempos de espera se miden en un reloj
  monótono en milisegundos y nunca se disparan antes de tiempo.
- Cuando todos los procesos esperan sin tiempo de espera un mensaje que nada
  puede enviar, el programa espera para siempre, como hace OTP. Una
  invocación desde el anfitrión (`CLAUSE_invoke_v1`) que fuera a esperar
  falla en su lugar con `busy`: ningún otro proceso se ejecuta durante ella.

## Enlaces

Plan step 48. Un enlace conecta dos procesos en ambos sentidos (`Signals` en
cada contexto: los pids enlazados en el orden de enlace y el indicador
`trap_exit`).

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

Plan step 49. Un monitor es unidireccional: el proceso que monitoriza lo
mantiene (por referencia, en `Signals`) y el proceso monitorizado guarda la
referencia y el pid del que monitoriza, para poder enviar el mensaje cuando
termine.

- `monitor(process, Pid)` devuelve una referencia nueva. Cuando el proceso
  termina, el llamante recibe `{'DOWN', Ref, process, Pid, Reason}` con su
  razón de salida ([salidas](#exits)); para un proceso que ya ha terminado
  recibe el mensaje de inmediato con la razón `noproc`. Monitorizarse a sí
  mismo no crea nada. Cada llamada crea un monitor independiente con su propio
  mensaje; los mensajes de un mismo proceso salen en el orden en que se
  crearon los monitores.
- `demonitor(Ref)` detiene el monitor: después no llega ningún `'DOWN'` suyo.
  Devuelve `true`, también para una referencia que no es un monitor activo
  del llamante.
- `demonitor(Ref, Options)`: `info` devuelve si el monitor seguía activo;
  `flush` elimina el mensaje `{_, Ref, _, _, _}` más antiguo cuando no lo
  estaba (su `'DOWN'` ya está en el buzón), como hace OTP.
- `spawn_monitor/1,3` devuelven `{Pid, Ref}`, el monitor creado antes de que
  se ejecute el proceso nuevo.
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

Plan step 50. El ejecutor mantiene una tabla de nombres (átomos) a pids, y
cada proceso su propio nombre (`Signals::name`).

- `register(Name, Pid)` da nombre a un proceso vivo: `badarg` para
  `undefined`, un nombre en uso, un proceso que ya tiene nombre, un proceso
  que ha terminado o un `Pid` que no es un pid. Un proceso puede registrarse
  a sí mismo.
- `unregister(Name)` libera el nombre (`badarg` cuando ningún proceso lo
  tiene); `whereis(Name)` es el pid o `undefined`; `registered()` enumera los
  nombres en el orden de la tabla de átomos (el orden de OTP tampoco está
  especificado).
- El nombre de un proceso se libera al terminar, antes de que se envíen las
  señales a sus enlaces y monitores, así que un receptor de `'DOWN'` o
  `'EXIT'` puede volver a registrar el nombre, como en OTP.

## Señales de salida

Toda señal de salida procede de un proceso en ejecución (`exit/2`,
`exit_signal/2`, `link/1`) o del final de un proceso. El ejecutor actúa sobre
ella de inmediato cuando su destino no se ejecuta en otro worker, y si no, en
cuanto termina la porción del destino ([workers](#workers),
`scheduler/signals`): un destino terminado sale de la cola de ejecución o de
su espera y se finaliza (señales a sus enlaces, su informe de error escrito,
su contexto liberado) antes de que retorne el builtin emisor. Una cadena larga
de enlaces termina proceso a proceso sin recursión.

| Señal en un proceso | Sin atrapar salidas | Atrapando salidas |
| --- | --- | --- |
| `exit(Pid, kill)`, `exit_signal(Pid, kill)` | Termina con la razón `killed` | Termina con la razón `killed` |
| Razón `normal` (de un enlace, o enviada a otro proceso) | Nada | Mensaje `{'EXIT', From, normal}` |
| `exit(self(), normal)` | Termina con la razón `normal` (peculiaridad de OTP) | Mensaje `{'EXIT', Self, normal}` |
| `exit_signal(self(), normal)` | Nada | Mensaje `{'EXIT', Self, normal}` |
| Cualquier otra razón, incluido `kill` de un enlace | Termina con esa razón | Mensaje `{'EXIT', From, Reason}` |

- `process_flag(trap_exit, Bool)` activa o desactiva la captura y devuelve el
  valor anterior (inicialmente `false`).
- Un proceso terminado por una señal que se envió a sí mismo
  (`exit(self(), kill)`) se desenrolla atravesando todo `catch`, todo
  manejador de `try` y todo cuerpo de `after`: la señal no es una excepción
  (`CallError::exited` en el canal de fallos).
- `exit/2` y `exit_signal/2` devuelven `true`; dirigidas a un proceso que ha
  terminado no hacen nada. Un destino que es una referencia tampoco hace nada
  (no hay alias de procesos).
- Una señal de salida que termina el proceso principal termina el programa
  como un `exit` no capturado ([estado de salida](executables.md#exit-status)):
  la razón `normal` sale con 0.
- Cuando el heap del receptor rechaza una razón de salida o un mensaje
  `'EXIT'`, el receptor falla con un fallo del runtime (salida 70).

## Puertos

Los puertos (plan steps 57A–57F) se especifican en [puertos](ports.md): un
puerto está enlazado con quien lo abre, participa en enlaces, monitores,
señales de salida y nombres registrados como un proceso, y se comunica con su
proceso conectado mediante mensajes. El step 57B proporciona las
identidades, la tabla de puertos, los builtins de puertos y los puertos
`{fd, In, Out}` de solo salida.

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
| `process_flag(trap_exit, Bool)` | El valor anterior; `badarg` para otro indicador o un valor no booleano |
| `erlang:send(Dest, Msg)`, `Dest ! Msg` | `Msg`, después de enviarlo ([mensajes](#messages)); `send/2` no se importa automáticamente |

El proceso nuevo se encola detrás de todos los procesos ejecutables; `spawn`
devuelve su pid de inmediato.
