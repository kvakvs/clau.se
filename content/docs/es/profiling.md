---
source: docs/profiling.md
sourceCommit: a8c3f8f6
sourceSha256: ae0b17c50da6bb2c36a31edf31aaa901aa6c57f3e662ef6fe663d066c1d7159a
translatedAt: 2026-10-17
---
# Perfilado

`--profile FILE` (una [opción del runtime](executables.md#runtime-options),
también mediante `CLAUSE_FLAGS`) hace que un programa escriba un informe de
costes en `FILE` al terminar. No se recompila nada: todo ejecutable puede
perfilarse, y sin la opción se ejecuta, imprime y escribe archivos exactamente
igual. Un informe que no puede escribirse se notifica en stderr
(`clau: cannot write profile FILE`); el código de salida sigue siendo el del
programa.

## Atribución

El runtime atribuye los costes donde el control pasa de un marco a otro
([modelo de ejecución](execution-model.md)), sin instrumentación en el código
generado:

- **Entradas** (reducciones): cada entrada en una función Erlang mediante una
  llamada o una llamada de cola cuenta una para esa función, igual que una
  porción de tiempo cuenta reducciones.
- **Tiempo propio**: el tiempo de reloj monótono desde una transferencia
  (entrada, retorno, inicio de una porción de tiempo) hasta la siguiente
  pertenece a la función cuyo marco estaba en la cima. Los builtins y los
  servicios del runtime cuentan como tiempo de la función que los llamó; el
  tiempo en que un proceso espera o no está planificado no cuenta para nadie.
  El tiempo anterior a la primera entrada de un proceso es `(runtime)`.
- **Por proceso**: cada proceso guarda sus propios costes; se suman a los del
  programa cuando se destruye el contexto del proceso, con su pid, sus totales
  y su función más costosa.

Cada pila habilitada lee el reloj en cada transferencia (alrededor de un 8 %
más lento en un bucle denso en llamadas en Debug); las pilas deshabilitadas
pagan una bifurcación por transferencia.

## Informe

```text
Clause profile: 2 processes, 503 time slices, 0 timer clock readings
Functions by self time:
     time_us   share      entries  function
     1193261  100.0%      2000001  profile:spin/2
         204    0.0%            1  profile:main/1
         130    0.0%            1  profile:-main/1-fun-0-/1
           0    0.0%            1  profile:cold/1
Processes by time:
     time_us   share      entries  process: top function
     1193393  100.0%      2000002  <0.2.0>: profile:spin/2
         206    0.0%            2  <0.1.0>: profile:main/1
```

La primera línea también cuenta las porciones de tiempo que ejecutaron los
hilos de trabajo del planificador y las lecturas de reloj del hilo temporizador
de los tiempos de espera de receive
([rueda de temporizadores](processes.md#receive-timeouts)). Las funciones son
`module:function/arity` (los funs anónimos por sus nombres generados, cuya
aridad cuenta los valores capturados); los empates se ordenan por nombre, y
los procesos por tiempo y después por pid. Los tiempos están en microsegundos
y varían entre ejecuciones; las entradas son exactas.

## Pruebas

`linking_profiling` enlaza `tests/fixtures/linking/profile` en O0 y O2 y lo
ejecuta sin perfilado, con `--profile FILE` y con
`CLAUSE_FLAGS=--profile=FILE`: la salida es idéntica, `spin/2` ocupa el primer
puesto por tiempo propio con exactamente 2.000.001 entradas, el proceso que
gira ocupa el primer puesto, y `--profile` sin archivo falla con salida 70.
