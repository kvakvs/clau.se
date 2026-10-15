---
source: docs/validation.md
sourceCommit: 6ed3851c
sourceSha256: 908ac8c879d3df66cb4e8e52800e07da92013325c177e1556378cadd0597b50f
translatedAt: 2026-10-15
---
# Validación

## Línea base actual

Plan 11 step 1, 2026-10-03, commit `b1a471f`, Windows x64: clang-cl 23.1.2,
LLVM SDK 23.1.2 (`/MT`, `_ITERATOR_DEBUG_LEVEL=0`), Lizard 1.24.0, clang-tidy
22.1.8, OTP fijado en `21776803ecd1` con OTP 29.1.1 / ERTS 17.1 como oráculo.

| Comprobación | Resultado |
| --- | --- |
| CTest Debug combinado desde cero | 125/125, cero omisiones (729 s en serie; 85 s con `-j 16`) |
| CTest en modo rápido (`debug-fast`) | 122 pruebas, unos 60 s |
| `check-quality` | Aprobado; Lizard CCN 10, clang-tidy sobre 258 unidades de producción |
| Pruebas opcionales de auditoría con OTP | 14/14 |
| `regenerate.py --corpus all --check` | 19/19 corpus se reproducen |
| Objetos ajenos O0/O2 | 7 objetivos inspeccionados (Linux x86/x64/ARM/AArch64, Windows x86/x64, Apple Silicon) |

## Ejecución de la puerta de calidad

Desde un shell de desarrollador x64 de Visual Studio con `C:\Program Files\LLVM\bin`
en `PATH` (la selección automática del SDK reutiliza `thirdparty/`):

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files + dependents
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` ejecuta los corpus golden en O0 con driver posicional
  más el proyecto en O2 sin especialización, ejecuta las mutaciones una sola vez
  y omite las pruebas `full_only`. El modo completo (predeterminado) ejecuta
  todas las combinaciones de driver y política.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multiplica los límites por ejecución del
  ejecutor de goldens (60 s) y del ejecutor de casos semánticos (15 s) para
  compilaciones instrumentadas.
- `check-quality`, `make format` y `make-format.bat` cubren los archivos
  modificados desde `HEAD` más los archivos no rastreados; `cmake/quality_scope.py`
  añade las unidades de traducción que incluyen una cabecera modificada. Los
  cambios en `.clang-tidy`, `cmake/` o en el CMake de producción seleccionan
  todo.
- Los programas de prueba no llevan información de depuración (sin PDB); se
  configura con `-DCLAUSE_TEST_DEBUG_INFO=ON` para recompilarlos para un
  depurador. Los consumidores nativos anidados enlazan el runtime de la
  compilación padre a través de `ClauseRuntimeTargets.cmake` en lugar de
  compilarlo de nuevo; solo `runtime_link` compila el runtime de forma
  independiente.
- Los umbrales y las supresiones nunca se elevan para superar la puerta. Hay
  configuradas dos excepciones de terceros (plan 11 steps 63-64, decisión del
  usuario): `cmake/tidy_filter.py` descarta los informes del analizador
  estático ubicados en cabeceras de Boost (falsos positivos del almacenamiento
  de limbs de Boost.Multiprecision en Linux que reescribir el código llamante
  solo desplaza) y los cuenta en la salida, y `bugprone-exception-escape`
  ignora `bad_array_new_length` (los constructores de movimiento de map/set de
  MSVC asignan memoria; de todos modos, un fallo de asignación es fatal).
- clang-tidy comprueba las cabeceras del proyecto en todos los anfitriones: el
  filtro de cabeceras acepta los separadores `/` y `\` (las rutas de Windows
  nunca coincidían antes del step 63).

### Linux

La misma puerta se ejecuta en Linux con el SDK de LLVM 23.1.2 para Linux
fijado como compilador del anfitrión (`CC`/`CXX` de su `bin/`), la libstdc++
del sistema, Ninja y CMake 3.28 o posterior. Boost 1.90 y toml++ 3.4.0
provienen de paquetes instalados o se extraen en `thirdparty/`
(`boost_1_90_0/`, `tomlplusplus-3.4.0/`); solo Windows los descarga. El
`ld.lld` del archivo de la versión enlaza ICU 70 (Ubuntu 22.04) y su `lldb`
enlaza Python 3.14; en anfitriones sin ellos, `linking_lto` necesita ICU 70 en
`LD_LIBRARY_PATH`, y `linking_debugger` usa GDB.

```sh
cmake --preset debug --fresh -G Ninja -DBUILD_TESTING=ON
cmake --build build/debug
ctest --preset debug -j 16
```

`check-quality` (Lizard, clang-tidy) se ejecuta solo en el anfitrión de
desarrollo Windows; los demás anfitriones compilan y ejecutan las pruebas. El
step 63 lo ejecutó una vez en Linux, lo que encontró lo que la ejecución en
Windows no podía ver (fuentes solo POSIX, `std::optional` de libstdc++), y lo
dejó limpio.

### Otros destinos

Los destinos de 32 bits y ARM se comprueban sin un compilador construido para
ellos (no existe SDK de LLVM para esos anfitriones):

- Una compilación solo del runtime
  (`-DCLAUSE_BUILD_COMPILER=OFF -DBUILD_TESTING=ON`) para el destino ejecuta
  allí las pruebas del runtime y de la ABI: de forma nativa, en un userland del
  destino (chroot) o mediante el emulador del anfitrión (qemu binfmt).
- `tests/compiler/executables/cross.py` ejecuta todos los goldens de
  ejecutables y fixtures de programas con el `clau` de este anfitrión,
  `--target-triple`, el archivo del runtime de esa compilación y un `--linker`
  que llega a las bibliotecas del destino (`run.py --target-option` los
  transmite).

## Fixtures y procedencia

- Las compilaciones y pruebas normales no necesitan OTP ni su checkout de código
  fuente. Los goldens se generaron una vez a partir de OTP y se incluyen en el
  repositorio con hashes; las comprobaciones de hash se ejecutan antes de usar
  cualquier fixture.
- Diecinueve corpus de patrones/guards contienen 67,748 valores/errores nativos
  esperados y 106 filas de aceptación semántica. Cada corpus nativo ejecuta los
  drivers posicional y de proyecto en O0/O2 con especialización activada y
  desactivada, con llamadas locales y remotas.
- Las entradas Erlang incluidas en el repositorio son de autoría local
  (`tests/fixtures/patternmatch/fragments/`, preprocesador `semantic/headers/`).
  Una auditoría del 2026-10-03 eliminó todos los archivos copiados de OTP; una
  comparación con ventanas de 60 tokens contra 4,150 archivos Erlang y 1,190
  archivos C/C++ de OTP no encontró ninguna coincidencia restante salvo una
  tupla de enteros generada. `fixture_sources` impone el aislamiento.
- Seis fixtures de programas objetivo final (`tests/fixtures/programs/`)
  contienen goldens de stdout/código de salida de OTP y los diagnósticos
  de compilación actuales; `programs_compile` los comprueba sin OTP y
  `tests/compiler/programs/regenerate.py --check` los reproduce con OTP
  ([mapa de fixtures](../tests/fixtures/programs/README.md)).
- Los goldens de impresión de términos (`tests/fixtures/printing/`)
  contienen el texto de `~w` y `erlang:display/1` de OTP para 9,542
  valores más el stdout de OTP de llamadas display compiladas;
  `tests/compiler/printing/regenerate.py --check` los reproduce
  ([notas de fixtures](../tests/fixtures/printing/README.md)).
- Los casos golden de ejecutables (`tests/fixtures/executables/`)
  son directorios de código fuente más un `golden.json` con el
  stdout/código de salida de OTP y un patrón de stderr escrito a mano;
  `tests/compiler/executables/run.py` enlaza y ejecuta cada uno bajo la matriz
  de política/driver (CTest `executables_<case>`), y `regenerate.py --check`
  los reproduce con OTP
  ([notas de casos](../tests/fixtures/executables/README.md)).
- La regeneración y las auditorías en vivo son explícitas:
  `-DCLAUSE_OTP_AUDITS=ON` y `tests/compiler/patternmatch/regenerate.py`
  ([instrucciones](../tests/fixtures/patternmatch/generated/README.md)).
  Nada actualiza los goldens ni la versión fijada de forma silenciosa.

## Diseño de las pruebas

El comportamiento se prueba mediante la CLI real, los objetos emitidos, los
consumidores nativos enlazados y los goldens de OTP. Las pruebas unitarias
focalizadas se mantienen solo donde el código fuente no puede alcanzar el
estado, cada una con su propósito indicado en la prueba:

- Presupuestos inyectados y fallos de asignación/E/S (`project_limits`,
  `project_creation_failure`, `codegen_limits`, `codegen_write_failure`,
  `runtime_lifecycle_failure`, puntos de inyección de fallos en llamadas
  generadas).
- Propiedad privada, handles inválidos/obsoletos e invariantes de reversión en
  el analizador sintáctico, el grafo de tipos semántico y el backend.
- Validación de palabras en bruto y límites de términos de 32/64 bits
  (`runtime_immediate`, `runtime_term_tag`, `abi_integers`).
- Fallos del receptor de diagnósticos y la instantánea de IDs de
  características estables.

Los casos que dependen de capacidades del sistema de archivos (enlaces, alias por
mayúsculas/minúsculas) informan de omisiones por caso; nunca sustituyen a la
aprobación de una prueba completa.

## Estado de plataformas y sanitizers

- Ejecución nativa de código generado: Windows x64; Linux x86-64. Los
  resultados de 32 bits y ARM están en el historial.
- Apple Silicon: pendiente.
- ASan, UBSan y LeakSanitizer para el compilador y el runtime: Linux x86-64,
  una única configuración Debug combinada
  (`-fsanitize=address,undefined -fno-sanitize=vptr -fno-sanitize-recover=undefined`),
  CTest completo con `CLAUSE_TEST_TIMEOUT_SCALE=10` (el código instrumentado
  se ejecuta varias veces más lento): ningún informe de los sanitizers. El
  compilador, el runtime y los programas de prueba están instrumentados; los
  programas que enlaza `clau` toman el runtime del sanitizer de un envoltorio
  de `clang++` en `PATH`, y su código generado no está instrumentado. Las
  cuatro pruebas de rechazo del anfitrión inyectado (`codegen_failure_*`,
  `runtime_lifecycle_failure`, `runtime_memory`) quedan fuera del alcance de
  ASan: su `operator new` aborta ante un tamaño imposible en lugar de lanzar
  una excepción.
- ThreadSanitizer: Linux x86-64, el mismo alcance de instrumentación con
  `-fsanitize=thread`; el CTest completo y las pruebas de concurrencia cinco
  veces cada una no informan de ninguna carrera tras la corrección del orden de
  bloqueo de `Executor::clear`. También quedan fuera del alcance las dos
  pruebas que sustituyen `operator new`.
- En Windows, el SDK de LLVM precompilado sigue entrando en conflicto con el
  código instrumentado (`annotate_string` 0 frente a 1).
- ASan solo para el runtime pasa en Windows con sondas Release,
  `/EHsc /fsanitize=address`, `/MT`, la biblioteca de importación de ASan de
  Clang y el thunk de runtime estático, y la DLL de ASan en `PATH`.
- Las ejecuciones históricas en macOS arm64 (2026-09-19/20) superaron las
  compilaciones Debug completa, C++26, ASan+UBSan, solo compilador y solo
  runtime para las etapas del analizador sintáctico y de proyectos; son
  anteriores al backend.

## Benchmarks

Comparación manual de rendimiento con Erlang/OTP. Nunca forma parte de CTest,
de la puerta de commit ni de `check-quality`, y solo ella necesita un
Erlang/OTP en el anfitrión; los resultados son evidencia específica del
anfitrión, no resultados de la puerta.

```powershell
make-benchmark.bat                         # Windows; set JOBS=N to cap parallel builds
make-benchmark.bat --repeat 9 --only bench_gc,bench_msg
make benchmark BENCH_ARGS="--baseline HEAD~5"   # other hosts
```

- Ambos configuran y compilan un `clau` y un runtime Release en `build/bench`
  y después ejecutan `benchmarks/run.py` (`--help` enumera sus opciones).
- Programas: `benchmarks/bench_*.erl` con `bench_util.erl`, compilados sin
  cambios por `erlc` y `clau -O2`. Cada uno cronometra sus kernels con
  `erlang:monotonic_time/1` tras una llamada de calentamiento e imprime
  `BENCH <name> <nanoseconds>`: generación de datos, procesamiento de datos,
  recolección de basura, paso de mensajes, E/S de archivos (en un directorio de
  trabajo temporal vacío) y sockets de loopback.
- Sistemas, en el mismo anfitrión en una sola ejecución, intercalados: OTP con
  su variante por defecto (JIT), OTP `-emu_flavor emu` cuando está instalado
  (el instalador de Windows solo incluye el JIT, así que esas columnas indican
  `n/a`), Clause HEAD en O2 y con `--lto`, y un commit anterior de Clause (por
  defecto: el commit más reciente con al menos un día más de antigüedad que
  HEAD; `--baseline REV`, `--no-baseline`) compilado en un worktree en caché
  bajo `build/bench-base/<hash>` que comparte `thirdparty/`.
- Informe: por kernel, la mediana de `--repeat` ejecuciones (5 por defecto) en
  milisegundos con seis decimales y su dispersión, la variación de Clause O2
  frente a cada sistema (`+N%`: Clause es más rápido, el otro tarda un N% más;
  `-N%`: Clause tarda un N% más; `(Fx)` la razón de tiempos) con una media
  geométrica, `--lto` frente a OTP y O2, los tiempos de reloj de los programas
  incluido el arranque, los fallos y los tiempos agotados (`--timeout`, 600 s
  por ejecución). Los recuentos de iteraciones mantienen una ejecución por
  defecto por debajo de 10 minutos; Clause, el sistema más lento, fija los
  tamaños, así que algunos kernels de OTP duran solo unos milisegundos.
- Historial: `benchmarks/history/<host>.json` guarda un registro por día de
  ejecución (fecha de ejecución, hash y fecha de commit de HEAD, medianas de
  Clause, OTP y la línea base), `benchmarks/history/reports/<host>/<day>-<hash>.txt`
  los informes de texto; una nueva ejecución el mismo día sustituye ambos. Se
  eliminan los registros e informes de ejecuciones de más de 183 días antes
  del más reciente; una ejecución con cambios de código fuente sin confirmar se
  informa pero no se registra. El directorio del historial está en gitignore:
  permanece en el anfitrión que lo ejecutó.
- Listados: con `--listings`, antes de medir, una ejecución escribe los
  listados de [`--print-asm`](compile.md#assembly-listings) y `--print-ir` de
  cada programa (con `bench_util`, `--entry <program>` para que el código de
  biblioteca inalcanzable se omita como en el ejecutable) junto a los informes
  como `<program>.debug.asm` / `<program>.debug.ll` (`-O0`) y
  `<program>.release.asm` / `<program>.release.ll` (`-O2`, el código que
  ejecuta la columna `clause-o2`), sustituyendo los listados de la ejecución
  anterior, incluidos `--no-history` y los cambios sin confirmar.
  `--print-ir` es el IR antes de la cadena de LLVM; los comentarios del
  ensamblador citan el IR posterior. Un programa que no compila pierde sus
  listados obsoletos.

## Historial

Condensado a partir de los antiguos registros por paso (originales en el
historial de Git hasta el commit `2777c98`). Salvo indicación en contrario:
Windows x64, LLVM 23.1.2, versión fijada `21776803ecd1`, OTP 29.1.1 / ERTS 17.1
como oráculo. Los recuentos de pruebas son ejecuciones completas de CTest
aprobadas con cero omisiones.

| Fecha | Hito | Pruebas | Unidades de calidad | Notas |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Analizador sintáctico, fase VI (macOS arm64, OTP 29.1 `751f87b7`, oráculo 29.0.5) | 46 | todas | 344/344 producciones verificadas; corpus de 10 archivos |
| 2026-09-20 | Proyectos (macOS arm64) | 64 | todas | Debug, solo compilador, ASan+UBSan |
| 2026-09-28 | Migración de pruebas a flujos de trabajo con la CLI | 74/75 | — | Línea base 78/93; desbordamiento de pila en `parser_hardening` corregido después con una pila de 8 MiB |
| 2026-09-28 | Reparación de la puerta en Windows | 75 | todas | Lizard + clang-tidy sin avisos |
| 2026-09-29 | Hito del compilador, pasos 1–46 | 103 | 182 | Solo compilador 80, solo runtime 16, ASan del runtime 16 |
| 2026-10-01 | PG1 matriz semántica y evidencia | 104 | — | Hashes del código fuente fijados |
| 2026-10-01 | PG2 canal de fallos | 108 | — | ABI rev 2 |
| 2026-10-01 | PG3 átomos | 109 | 189 | ABI rev 3 |
| 2026-10-01 | PG4 vinculaciones con ámbito | 111 | 191 | 26 casos de legalidad |
| 2026-10-02 | PG5 semántica de patrones | 113 | 196 | 92 módulos de legalidad |
| 2026-10-02 | PG6 coincidencia de inmediatos | 114 | 199 | 34 llamadas |
| 2026-10-02 | PG7 guards de inmediatos | 119 | 205 | 1,689 llamadas |
| 2026-10-02 | PG8 flujo de control de guards | 120 | 207 | 2,075 llamadas |
| 2026-10-02 | PG9 cláusulas ordenadas | 121 | 208 | 1,020 llamadas |
| 2026-10-02 | PG10 coincidencias en el cuerpo | 122 | 209 | 1,666 llamadas |
| 2026-10-02 | PG11 heap estable y raíces | 123 | 213 | ABI rev 4 |
| 2026-10-02 | PG12 tuplas/listas/cadenas | 125 | 221 | 4,801 llamadas |
| 2026-10-02 | PG13 enteros arbitrarios | 127 | 231 | 16,065 llamadas |
| 2026-10-02 | PG14 flotantes | 129 | 238 | 14,436 llamadas |
| 2026-10-02 | PG15 maps | 131 | 244 | 8,010 llamadas |
| 2026-10-02 | PG15a goldens sin OTP | 118 | 244 | 14 corpus, 49,959 valores; auditorías opcionales |
| 2026-10-02 | PG16 bitstrings | 120 | 253 | 8,826 llamadas |
| 2026-10-03 | PG17 records como tuplas | 121 | 257 | 1,025 resultados, 29 casos semánticos |
| 2026-10-03 | PG18 catálogo de guards | 122 | 257 | 81 filas, 5,033 resultados |
| 2026-10-03 | PG19 hechos de vinculación | 123 | 258 | 822 resultados, 976 comprobaciones de dominancia |
| 2026-10-03 | PG20 cierre | 124 | 258 | 19 corpus, 67,634 valores, 1,969 resultados sembrados |
| 2026-10-03 | Auditoría del código fuente de OTP | 125 | 258 | Archivos copiados de OTP sustituidos por fragmentos locales |
| 2026-10-03 | Plan 11 step 1, línea base | 125 | 258 | Véase la línea base actual |
| 2026-10-03 | Plan 11 step 2, fixtures de programas | 126 | 258 | Seis goldens de OTP; modo rápido 123 pruebas; completo `-j 16` 83 s |
| 2026-10-03 | Plan 11 step 4, impresión de términos | 128 rápido | 265 | 9,542 goldens de `~w`/display; 154 llamadas display compiladas en todas las políticas; clang-tidy ejecutado con un solo trabajo (las ejecuciones concurrentes hacían fallar la herramienta en unidades sin cambios) |
| 2026-10-04 | Plan 11 step 8, ejecutor de ejecutables (phase B cerrada) | 138 (135 rápido) | 272 | Casos `demo`, `exits` bajo ocho combinaciones de política/driver; completo `-j 16` 235 s |
| 2026-10-04 | Plan 11 step 8I, heap clásico (phase C cerrada) | 144 (140 rápido) | 276 | Completo `-j 16` 370 s: 143/144, `codegen_dependency` agotó el tiempo a los 120 s bajo carga y pasó por sí solo en 29 s; Lizard-all 0 avisos; tidy-all pasó con un trabajo tras una salida silenciosa de la herramienta con dos trabajos |
| 2026-10-04 | Plan 11 step 9, `case` y `begin` | 146 (142 rápido) | 114 modificadas | Rápido 142/142; pruebas afectadas 7/7 en modo completo; Lizard 0 avisos; tidy pasó con un trabajo tras una salida silenciosa con dos trabajos |
| 2026-10-05 | Plan 11 step 10, `if` | 147 (143 rápido) | 114 modificadas | Rápido 143/143; pruebas afectadas 8/8 en modo completo; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 11, excepciones lanzadas desde el código fuente | 148 (144 rápido) | 124 modificadas | Rápido 144/144; pruebas afectadas 22/22 en modo completo; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 12, `catch Expr` | 149 (145 rápido) | 277 | Rápido 145/145; pruebas afectadas 25/25 en modo completo; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 13, `try ... of ... catch` | 150 (146 rápido) | 189 modificadas | Rápido 146/146; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 14, `try ... after` | 153 (149 rápido) | 2 modificadas | Rápido 149/149; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 15, trazas de pila y `raise/3` | 154 (150 rápido) | 129 modificadas | Rápido 150/150; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 16, `maybe` (phase D cerrada) | 155 (151 rápido) | 277 | Rápido 151/151; completo `-j 16` 155/155 en 259 s; Lizard-all 0 avisos; tidy-all pasó |
| 2026-10-05 | Plan 11 step 18, grafos de llamadas recursivas | 156 (152 rápido) | 91 modificadas | Rápido 152/152; pruebas afectadas 13/13 en modo completo; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 19, marcos explícitos y llamadas de cola | 157 (153 rápido) | 278 | CTest rápido y completo aprobados (con el caso del step 20: 154/154, 158/158); configuración con clang-cl; Lizard 0 avisos; tidy pasó |
| 2026-10-05 | Plan 11 step 20, recursión profunda en el cuerpo y presupuesto de pila | 158 (154 rápido) | 278 | Rápido 154/154; completo 158/158; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 21, comprehensions de listas | 159 (155 rápido) | modificadas | Rápido 155/155; pruebas afectadas en modo completo; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 22, comprehensions de binaries y maps (phase E cerrada) | 160 (156 rápido) | todas | Rápido 156/156; completo `-j 12` 160/160 en 275 s; Lizard-all 0 avisos; tidy-all pasó tras corregir cuatro hallazgos en código nuevo |
| 2026-10-06 | Plan 11 step 23, inventario de raíces, `SafePoint`, registros vivos | 160 (156 rápido) | 50 modificadas | Rápido 156/156; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 26, recolección desde código generado | 161 (157 rápido) | 63 modificadas | Rápido 157/157; completo `-j 12` 161/161 en 107 s; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 27, agotamiento del heap tras la recolección | 162 (158 rápido) | 50 modificadas | Rápido 158/158; completo `-j 12` 162/162 en 108 s; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 27, corrección: sin límites de memoria predeterminados | 162 (158 rápido) | 50 modificadas | Completo `-j 12` 158/162 en 120 s, 4 `codegen_failure_*` corregidas esperando `out_of_memory`, después 10/10 afectadas; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 27, seguimiento: sin límites de binaries ni de número de procesos, `--max-atoms` | 164 (160 rápido) | 281 | Rápido 160/160; completo `-j 12` 164/164 en 105 s; Lizard 0 avisos; tidy-all pasó |
| 2026-10-06 | Plan 11 step 28, copias de grafos entre heaps, búferes compartidos fuera del heap | 166 (162 rápido) | 71 modificadas | Rápido 162/162; completo `-j 12` 166/166 en 130 s; Lizard 0 avisos; tidy pasó |
| 2026-10-07 | Plan 11 step 29, actualizaciones de records | 167 (163 rápido) | 38 modificadas | Rápido 163/163; Lizard 0 avisos; tidy pasó; el corpus de records se reproduce con OTP |
| 2026-10-07 | Plan 11 step 30, `record_info/2` | 168 (164 rápido) | 42 modificadas | Rápido 164/164; completo `-j 12` 168/168 en 119 s; Lizard 0 avisos; tidy pasó |
| 2026-10-07 | Plan 11 step 31B, celdas de native record y `CLAUSE_record_v1` (ABI 6) | 169 (165 rápido) | 283 modificadas | Rápido 165/165; completo `-j 12` 169/169 en 122 s; Lizard 0 avisos; tidy pasó tras dos correcciones |
| 2026-10-07 | Plan 11 step 31C, native records locales | 170 (166 rápido) | 285 modificadas | Rápido 166/166; completo `-j 12` 170/170 en 146 s; Lizard y tidy pasaron tras correcciones de complejidad |
| 2026-10-07 | Plan 11 step 31D, native records cualificados e importados | 171 (167 rápido) | 124 modificadas | Rápido 167/167; completo `-j 12` 171/171 en 129 s; Lizard 0 avisos; tidy pasó tras tres correcciones |
| 2026-10-07 | Plan 11 step 31E, native records anónimos (step 31 cerrado) | 172 (168 rápido) | 33 modificadas | Rápido 168/168; completo `-j 12` 172/172 en 124 s; Lizard 0 avisos; tidy pasó tras una corrección |
| 2026-10-07 | Plan 11 step 32, valores de función `fun F/A`, `fun M:F/A` (ABI 7) | 173 (169 rápido) | 289 modificadas | Rápido 169/169; completo `-j 12` 173/173 en 122 s; Lizard y tidy pasaron tras correcciones de complejidad |
| 2026-10-07 | Plan 11 step 33, clausuras con variables capturadas | 175 (171 rápido) | 134 modificadas | Rápido 171/171; completo `-j 12` 175/175 en 126 s; Lizard y tidy pasaron tras correcciones de complejidad |
| 2026-10-07 | Plan 11 step 34, funs con nombre | 176 (172 rápido) | 132 modificadas | Rápido 172/172; completo `-j 12` 176/176 en 152 s; Lizard 0 avisos; tidy pasó |
| 2026-10-07 | Plan 11 step 35, llamadas dinámicas `M:F(Args)`, `apply/2,3`, `fun M:F/A` en tiempo de ejecución (ABI 8) | 177 (173 rápido) | 290 (configuración del analizador modificada) | Rápido 173/173; completo `-j 12` 177/177 en 142 s; Lizard 0 avisos y tidy pasó tras una corrección de complejidad y tres de tidy |
| 2026-10-09 | Plan 11 step 63, Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, clang del SDK de LLVM 23.1.2, libstdc++ 14, GDB 16.2) | 235 | 338 | CTest completo 235/235 en 161 s; Lizard y clang-tidy limpios (7 informes del analizador en cabeceras de Boost ignorados); puerta de Windows 235/235 con las cabeceras comprobadas |
| 2026-10-09 | Plan 11 step 64, 32 bits: Windows x86 (WoW64, clang-cl) y Linux i386 (chroot de Debian 13, clang 19) | 42 + 65 goldens | — | Pruebas del runtime/ABI 42/42 de forma nativa en ambos; goldens de `cross.py` 65/65 en ambos (se omiten las ejecuciones solo de 64 bits de `integer_limit`) |
| 2026-10-09 | Plan 11 step 65, Linux arm64 y armhf (sysroots de Debian 13, qemu-user 9.2) | 42 + 65 goldens | — | Pruebas del runtime/ABI 42/42 en cada uno; goldens 64/65 en cada uno (`port_spawn` `enoent`: carencia de `posix_spawn` en qemu), límite de ejecución 900 s |
| 2026-10-10 | Plan 11 step 67, ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Ningún informe de los sanitizers; cuatro pruebas de rechazo del anfitrión inyectado fuera del alcance de ASan; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Plan 11 step 68, ThreadSanitizer (Linux x86-64) | 233 | — | Corregida una inversión del orden de bloqueo (`Executor::clear`); después ningún informe en el CTest completo ni en 15 pruebas de concurrencia x5 |
| 2026-10-10 | Plan 11 step 65A, `-behaviour`/`-behavior` y `behaviour_info/1` generado | 234 (rápido) | 342 | Configuración desde cero; rápido 234/234; Lizard 0 avisos; tidy pasó tras una corrección (inicialización estática que lanza); nuevos `lint_diagnostics` (8 casos generados con OTP) y `executables_behaviours`; `--check` de OTP reproduce 60 goldens de ejecutables y 8 de lint; goldens de programas regenerados solo por el cambio de hash del oráculo |
| 2026-10-10 | Plan 11 step 65B, `module_info/0,1` y atributos informativos | 235 (rápido) | 344 | Configuración desde cero; rápido 235/235; Lizard 0 avisos; tidy pasó tras dividir `parse_and_print`; los nuevos `executables_module_info` y los casos de lint `module_info_defined`, `exports_repeated` se reproducen con OTP 29.1.1 |
| 2026-10-10 | Plan 11 step 65C, importaciones, indicaciones de compilación, rechazos de atributos con nombre | 236 (rápido) | — | Véase la evidencia del plan 65C; `executables_imports` y tres casos de lint de importaciones se reproducen con OTP 29.1.1 |
| 2026-10-06 | Plan 11 step 27E, límite de enteros grandes de ERTS, `error:system_limit` | 165 (161 rápido) | 157 modificadas | Rápido 161/161; completo `-j 12` 165/165 en 130 s; Lizard 0 avisos; tidy pasó; 21 goldens de ejecutables se reproducen con OTP |
| 2026-10-06 | Plan 11 step 27D, sin límites de tamaño de map ni de trabajo con claves | 164 (160 rápido) | 13 modificadas | Rápido 160/160; completo `-j 12` 164/164 en 115 s; tras una corrección de tidy en `bit_order`, pasan 35 pruebas afectadas; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 27C, límite de aridad de tupla 16,777,215 | 164 (160 rápido) | 51 modificadas | Rápido 160/160; completo `-j 12` 164/164 en 121 s; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 27B, sin límites de longitud de lista ni de trabajo de comparación | 164 (160 rápido) | 4 modificadas | Rápido 160/160; completo `-j 12` 164/164 en 125 s; Lizard 0 avisos; tidy pasó |
| 2026-10-06 | Plan 11 step 27A, límite de memoria de todo el runtime y `--max-heap/stack/memory` | 164 (160 rápido) | 49 modificadas | Rápido 160/160; completo `-j 12` 164/164 en 118 s; tras una corrección de tidy en `ProcessStack::grow`, pasan 42 pruebas afectadas; Lizard 0 avisos; tidy pasó |

PG = paso del plan de patrones/guards (archivado en `.agents/00-finished.md`).
