---
source: docs/validation.md
sourceCommit: 336caea7
sourceSha256: b00092bc767953e496774561feaef35ac500b4db73b4344eafd6dda372c90e24
translatedAt: 2026-10-18
---
# Validación

## Línea base actual

Últimas puertas registradas en el anfitrión de desarrollo Windows x64 (clang-cl
y LLVM SDK 23.1.2, `/MT`, `_ITERATOR_DEBUG_LEVEL=0`); los pasos posteriores
registran las suyas en `.agents/00-finished.md`:

| Comprobación | Resultado |
| --- | --- |
| CTest Debug combinado desde cero (2026-10-14) | 299/300 aprobadas; el fallo es el conocido límite de tamaño de IR de `codegen_measurements`; `codegen_resource_cli` está desactivada |
| `check-quality-all` (misma ejecución) | Limpio; Lizard CCN 10 |
| Pruebas opcionales de auditoría con OTP (2026-10-14, fijado en `d199a49a01a2`, oráculo OTP 29.1.1) | 17/17 |
| `regenerate.py --corpus all --check` (igual) | 19/19 corpus se reproducen |

## Ejecución de la puerta de calidad

Desde un shell de desarrollador x64 de Visual Studio con
`C:\Program Files\LLVM\bin` en `PATH` (la selección automática del SDK
reutiliza `thirdparty/`):

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files, one unit per header
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` ejecuta los corpus golden en O0 con driver posicional
  más el proyecto en O2 sin especialización, ejecuta las mutaciones una sola vez
  y omite las pruebas `full_only` (proyectos consumidores separados como
  `runtime_generated_link`, las mediciones, la auditoría `library_freshness`
  con el OTP del anfitrión y los flujos de trabajo lentos `linking_lto`,
  `linking_exports`, `linking_compile_cache`, `programs_compile` y
  `transforms_cache`). El modo completo (predeterminado) ejecuta todas las
  combinaciones de driver y política.
- Las pruebas largas dirigidas por un script de Python o CMake llevan un `COST`
  fijo de CTest: CTest aprende el coste de un envoltorio a partir de su propio
  tiempo de CPU, pequeño, y las iniciaría las últimas.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multiplica los límites por ejecución del
  ejecutor de goldens (60 s) y del ejecutor de casos semánticos (15 s) para
  compilaciones instrumentadas.
- `check-quality`, `make format` y `make-format.bat` cubren los archivos
  modificados desde `HEAD` más los archivos no rastreados; `cmake/quality_scope.py`
  añade, por cada cabecera modificada, una unidad de traducción que la incluye
  (su propio fuente o, en su defecto, su primer usuario, a partir de los datos
  de dependencias de Ninja de cualquier configuración; los demás dependientes
  de la cabecera quedan para `check-quality-all` en la puerta completa) y, para
  clang-tidy, las unidades cuyo comando de compilación difiere del que registró
  la última ejecución aprobada (`build/debug/quality/tidy-commands.json`), de
  modo que una edición de una regla de compilación vuelve a comprobar solo las
  unidades que cambia. Los cambios en `.clang-tidy` o en los scripts de tidy
  seleccionan todo, al igual que las ediciones de reglas de compilación antes de
  la primera ejecución registrada.
- `CLAUSE_OPTIMIZED_COMPILER` (ON por defecto) compila `clau` y las bibliotecas
  del compilador optimizados también en las compilaciones Debug, conservando su
  información de depuración y los presupuestos de inferencia de Debug; las
  pruebas pasan la mayor parte de su tiempo en `clau`. Cuando hay que recorrer
  paso a paso un fallo del compilador, se configura con
  `-DCLAUSE_OPTIMIZED_COMPILER=OFF`, se recompila y se vuelve a ejecutar la
  prueba que falla.
- Los programas de prueba no llevan información de depuración (sin PDB); se
  configura con `-DCLAUSE_TEST_DEBUG_INFO=ON` para recompilarlos para un
  depurador. Los consumidores nativos anidados enlazan el runtime de la
  compilación padre a través de `ClauseRuntimeTargets.cmake` en lugar de
  compilarlo de nuevo; solo `runtime_link` compila el runtime de forma
  independiente.
- Los umbrales y las supresiones nunca se elevan para superar la puerta. Hay
  configuradas dos excepciones de terceros (decisión del usuario):
  `cmake/tidy_filter.py` descarta los informes del analizador estático ubicados
  en cabeceras de Boost (falsos positivos del almacenamiento de limbs de
  Boost.Multiprecision en Linux que reescribir el código llamante solo desplaza)
  y los cuenta en la salida, y `bugprone-exception-escape` ignora
  `bad_array_new_length` (los constructores de movimiento de map/set de MSVC
  asignan memoria; de todos modos, un fallo de asignación es fatal).
- clang-tidy comprueba las cabeceras del proyecto en todos los anfitriones: el
  filtro de cabeceras acepta los separadores `/` y `\`.

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
desarrollo Windows; los demás anfitriones compilan y ejecutan las pruebas (una
vez quedó limpio en Linux, véase el [historial](#history)).

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
- Diecinueve corpus de patrones/guards contienen 67.748 valores/errores nativos
  esperados y 106 filas de aceptación semántica. Cada corpus nativo ejecuta los
  drivers posicional y de proyecto en O0/O2 con especialización activada y
  desactivada, con llamadas locales y remotas.
- Las entradas Erlang incluidas en el repositorio son de autoría local
  (`tests/fixtures/patternmatch/fragments/`, preprocesador `semantic/headers/`);
  `fixture_sources` impone el aislamiento respecto a las fuentes de OTP.
- Seis fixtures de programas de objetivo final (`tests/fixtures/programs/`)
  contienen goldens de stdout/estado de salida de OTP y sus diagnósticos de
  compilación; `programs_compile` los comprueba sin OTP y
  `tests/compiler/programs/regenerate.py --check` los reproduce con OTP
  ([mapa de fixtures](../tests/fixtures/programs/README.md)).
- Los goldens de impresión de términos (`tests/fixtures/printing/`) contienen
  el texto de `~w` y de `erlang:display/1` de OTP para 9.542 valores, además del
  stdout de OTP de llamadas a display compiladas;
  `tests/compiler/printing/regenerate.py --check` los reproduce
  ([notas de fixtures](../tests/fixtures/printing/README.md)).
- Los casos golden de ejecutables (`tests/fixtures/executables/`) son
  directorios de código fuente más un `golden.json` con el stdout/estado de
  salida de OTP y un patrón de stderr de autoría propia;
  `tests/compiler/executables/run.py` enlaza y ejecuta cada uno bajo la matriz
  de política/driver (CTest `executables_<case>`), y `regenerate.py --check`
  los reproduce con OTP ([notas de casos](../tests/fixtures/executables/README.md)).
- La regeneración y las auditorías en vivo son explícitas:
  `-DCLAUSE_OTP_AUDITS=ON` y `tests/compiler/patternmatch/regenerate.py`
  ([instrucciones](../tests/fixtures/patternmatch/generated/README.md)). Nada
  actualiza los goldens ni la versión fijada de forma silenciosa.

## Diseño de las pruebas

El comportamiento se prueba a través de la CLI real, los objetos emitidos, los
consumidores nativos enlazados y los goldens de OTP. Las pruebas unitarias
focalizadas permanecen solo donde el código fuente no puede alcanzar el estado,
cada una con su propósito indicado en la prueba:

- Presupuestos inyectados y fallos de asignación/E/S (`project_limits`,
  `project_creation_failure`, `codegen_limits`, `codegen_write_failure`,
  `runtime_lifecycle_failure`, puntos de inyección de fallos en llamadas
  generadas).
- Propiedad privada, handles no válidos u obsoletos e invariantes de reversión
  en el parser, el grafo de tipos semántico y el backend.
- Validación de palabras en bruto y límites de términos de 32/64 bits
  (`runtime_immediate`, `runtime_term_tag`, `abi_integers`).
- Fallos del receptor de diagnósticos y la instantánea de ID de funcionalidades
  estables.

Los casos de capacidades del sistema de archivos (enlaces, alias por mayúsculas
y minúsculas) informan de omisiones por caso; nunca sustituyen a la aprobación
de una prueba completa.

## Estado de plataformas y sanitizers

- Ejecución de código nativo generado: Windows x64; Linux x86-64. Los
  resultados de 32 bits y ARM (pruebas del runtime y goldens enlazados de forma
  cruzada) están en el historial.
- Apple Silicon: no validado desde que existe el backend.
- ASan, UBSan y LeakSanitizer del compilador y del runtime: Linux x86-64, una
  configuración Debug combinada
  (`-fsanitize=address,undefined -fno-sanitize=vptr -fno-sanitize-recover=undefined`),
  CTest completo con `CLAUSE_TEST_TIMEOUT_SCALE=10` (el código instrumentado se
  ejecuta varias veces más lento): ningún informe de sanitizer. El compilador,
  el runtime y los programas de prueba están instrumentados; los programas que
  `clau` enlaza toman el runtime del sanitizer de un envoltorio `clang++` en
  `PATH`, y su código generado no está instrumentado. Las cuatro pruebas de
  rechazo inyectado del anfitrión (`codegen_failure_*`,
  `runtime_lifecycle_failure`, `runtime_memory`) quedan fuera del alcance de
  ASan: su `operator new` aborta ante un tamaño imposible en lugar de lanzar
  una excepción.
- ThreadSanitizer: Linux x86-64, el mismo alcance de instrumentación con
  `-fsanitize=thread`; el CTest completo y las pruebas de concurrencia, cinco
  veces cada uno, no informan de ninguna condición de carrera. También quedan
  fuera del alcance: las dos pruebas que reemplazan `operator new`.
- En Windows, el SDK de LLVM precompilado sigue siendo incompatible con el
  código instrumentado (`annotate_string` 0 frente a 1).
- ASan solo del runtime se aprueba en Windows con sondas Release,
  `/EHsc /fsanitize=address`, `/MT`, la biblioteca de importación de ASan de
  Clang y el thunk de runtime estático, y la DLL de ASan en `PATH`.
- Las ejecuciones históricas en macOS arm64 (2026-09-19/20) aprobaron
  compilaciones Debug completas, C++26, ASan+UBSan, solo compilador y solo
  runtime para las etapas del parser y de proyectos; son anteriores al backend.

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

- Ambos configuran y compilan un `clau` y un runtime Release en `build/bench`, y
  después ejecutan `benchmarks/run.py` (`--help` enumera sus opciones).
- Programas: `benchmarks/bench_*.erl` con `bench_util.erl`, compilados sin
  cambios por `erlc` y `clau -O2`. Cada uno cronometra sus núcleos con
  `erlang:monotonic_time/1` tras una llamada de calentamiento e imprime
  `BENCH <name> <nanoseconds>`: generación de datos, procesamiento de datos,
  recolección de basura, paso de mensajes, E/S de archivos (en un directorio de
  trabajo temporal vacío) y sockets de loopback.
- Sistemas, en el mismo anfitrión en una sola ejecución, intercalados: OTP con
  su variante predeterminada (JIT), OTP `-emu_flavor emu` cuando está instalado
  (el instalador de Windows solo incluye el JIT, por lo que esas columnas
  muestran `n/a`), Clause HEAD en O2 y con `--lto`, y un commit anterior de
  Clause (por defecto: el commit más reciente con al menos un día de antigüedad
  respecto a HEAD; `--baseline REV`, `--no-baseline`) compilado en un worktree
  en caché bajo `build/bench-base/<hash>` que comparte `thirdparty/`.
- Informe: por núcleo, la mediana de `--repeat` ejecuciones (5 por defecto) en
  milisegundos con seis decimales y su dispersión, el cambio de Clause O2
  respecto a cada sistema (`+N%`: Clause es más rápido, el otro tarda un N% más;
  `-N%`: Clause tarda un N% más; `(Fx)` la razón de tiempos) con una media
  geométrica, `--lto` frente a OTP y O2, tiempos de reloj de los programas
  incluido el arranque, tamaños de ejecutables, fallos y agotamientos de tiempo (`--timeout`, 600 s por
  ejecución). Los recuentos de iteraciones mantienen una ejecución
  predeterminada por debajo de 10 minutos; Clause, el sistema más lento, fija
  los tamaños, por lo que algunos núcleos de OTP duran solo unos pocos
  milisegundos.
- Tamaños de ejecutables, en bytes: cada programa en `-O2`, con `--lto` y en
  `-O0` (una compilación adicional que solo se mide, nunca se ejecuta; ambas se
  omiten con `--no-lto`) y la línea base en `-O2`, con una fila de totales y los
  cambios O2 frente a O0, `--lto` frente a O2, `--lto` frente a O0 y O2 frente a
  la línea base (`-N%` menor); y `clau` en HEAD y en la línea base. El historial
  los guarda como `sizes_bytes` (`programs`: programa → columna → bytes,
  `clau`: `head`/`baseline` → bytes; `null` cuando falla una compilación).
- Historial: `benchmarks/history/<host>.json` guarda un registro por día de
  ejecución (fecha de ejecución, hash y fecha del commit de HEAD, medianas de
  Clause, OTP y la línea base, tamaños), y
  `benchmarks/history/reports/<host>/<day>-<hash>.txt` los informes de texto;
  una nueva ejecución el mismo día reemplaza ambos. Se eliminan los registros e
  informes ejecutados más de 183 días antes del más reciente; una ejecución con
  cambios de código fuente sin confirmar se informa pero no se registra. El
  directorio de historial está en gitignore: permanece en el anfitrión que lo
  ejecutó.
- Listados: con `--listings`, antes de medir, una ejecución escribe los
  listados [`--print-asm`](compile.md#assembly-listings) y `--print-ir` de cada
  programa (con `bench_util`, `--entry <program>` para que el código de
  biblioteca inalcanzable quede fuera como en el ejecutable) junto a los
  informes como `<program>.debug.asm` / `<program>.debug.ll` (`-O0`) y
  `<program>.release.asm` / `<program>.release.ll` (`-O2`, el código que ejecuta
  la columna `clause-o2`), reemplazando los listados de la ejecución anterior,
  incluidos `--no-history` y los cambios sin confirmar. `--print-ir` es el IR
  antes del pipeline de LLVM; los comentarios del ensamblador citan el IR
  después de él. Un programa que no compila pierde sus listados obsoletos.

## Historial

Condensado a partir de los antiguos registros por paso (originales en el
historial de Git hasta el commit `2777c98`). Salvo indicación: Windows x64,
LLVM 23.1.2, OTP fijado en `21776803ecd1`, oráculo OTP 29.1.1 / ERTS 17.1. Los
recuentos de pruebas son aprobaciones completas de CTest sin omisiones.

| Fecha | Hito | Pruebas | Unidades de calidad | Notas |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Fase VI del parser (macOS arm64, OTP 29.1 `751f87b7`, oráculo 29.0.5) | 46 | todas | 344/344 producciones atestiguadas; corpus de 10 archivos |
| 2026-09-20 | Proyectos (macOS arm64) | 64 | todas | Debug, solo compilador, ASan+UBSan |
| 2026-09-28 | Migración de pruebas a flujos de trabajo de la CLI; reparación de la puerta en Windows | 75 | todas | Desbordamiento de pila de `parser_hardening` corregido con una pila de 8 MiB; Lizard + clang-tidy limpios |
| 2026-09-29 | Hito del compilador, steps 1–46 | 103 | 182 | Solo compilador 80, solo runtime 16, ASan del runtime 16 |
| 2026-10-01 – 10-03 | Plan de patrones/guards PG1–PG20 | 104–131 | 189–258 | Revisiones de la ABI 2–4; PG15a hizo los goldens independientes de OTP (auditorías opcionales, 131 → 118 pruebas); cerrado con 19 corpus, 67.634 valores, 1.969 resultados sembrados |
| 2026-10-03 | Auditoría de fuentes de OTP | 125 | 258 | Archivos copiados de OTP reemplazados por fragmentos locales; una comparación con ventanas de 60 tokens contra 4.150 archivos Erlang y 1.190 archivos C/C++ de OTP no encontró coincidencias salvo una tupla de enteros generada |
| 2026-10-03 | Línea base del plan 11 step 1 (commit `b1a471f`, fijado en `21776803ecd1`, Lizard 1.24.0, clang-tidy 22.1.8) | 125 (122 rápidas) | 258 | Completo 729 s en serie, 85 s con `-j 16`; 14/14 auditorías; 19/19 corpus; objetos ajenos O0/O2 inspeccionados para 7 destinos |
| 2026-10-03 | Steps 2, 4: fixtures de programas, impresión de términos | 126–128 | 265 | Seis goldens de programas de OTP; 9.542 goldens de `~w`/display |
| 2026-10-04 | Steps 8, 8I: ejecutor de ejecutables, heap clásico (phases B, C cerradas) | 138–144 | 272–276 | Completo con `-j 16` 235–370 s |
| 2026-10-04 – 10-05 | Steps 9–20: `case`, `if`, excepciones lanzadas, `catch`, `try`, trazas de pila, `maybe` (phase D cerrada), recursión, marcos y llamadas de cola | 146–158 | 277–278 | Pruebas rápidas y pruebas afectadas en modo completo por paso; completo con `-j 16` 155/155 en 259 s en la phase D |
| 2026-10-06 | Steps 21–28: comprehensions (phase E cerrada), raíces y recolección, límites de memoria y de términos (27A–27E), copias de grafos | 159–166 | 278–281 | Completo con `-j 12` 105–275 s; el step 27 eliminó los límites de memoria predeterminados |
| 2026-10-07 | Steps 29–35: records, native records (ABI 6), funs (ABI 7), clausuras, funs con nombre, llamadas dinámicas (ABI 8) | 167–177 | 283–290 | Completo con `-j 12` 119–152 s |
| 2026-10-09 | Step 63 Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, clang del SDK de LLVM 23.1.2, libstdc++ 14, GDB 16.2) | 235 | 338 | CTest completo 235/235 en 161 s; Lizard y clang-tidy limpios en Linux (7 informes del analizador en cabeceras de Boost ignorados); puerta de Windows 235/235 con cabeceras comprobadas |
| 2026-10-09 | Step 64 32 bits: Windows x86 (WoW64, clang-cl) y Linux i386 (chroot de Debian 13, clang 19) | 42 + 65 goldens | — | Pruebas del runtime/ABI 42/42 de forma nativa en ambos; goldens de `cross.py` 65/65 en ambos (omitidas las ejecuciones de `integer_limit` solo para 64 bits) |
| 2026-10-09 | Step 65 Linux arm64 y armhf (sysroots de Debian 13, qemu-user 9.2) | 42 + 65 goldens | — | Pruebas del runtime/ABI 42/42 en cada uno; goldens 64/65 en cada uno (`port_spawn` `enoent`: carencia de `posix_spawn` en qemu), límite de ejecución 900 s |
| 2026-10-10 | Step 67 ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Ningún informe de sanitizer; cuatro pruebas de rechazo inyectado del anfitrión fuera del alcance de ASan; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Step 68 ThreadSanitizer (Linux x86-64) | 233 | — | Una inversión del orden de bloqueos corregida (`Executor::clear`); después ningún informe en el CTest completo ni en 15 pruebas de concurrencia x5 |
| 2026-10-10 | Steps 65A–65C: behaviours, `module_info/0,1`, imports | 234–236 rápidas | 342–344 | Los goldens de lint y de ejecutables se reproducen con OTP 29.1.1 |
| 2026-10-11 | Steps 73A–73G parse transforms | 242/243 rápidas | — | Fallo conocido de `codegen_resource_cli`, desactivada desde entonces |
| 2026-10-12 | Steps 62D1–62E directorio de compilación y cachés | 263/264 | todas | CTest completo, fallo conocido de `codegen_resource_cli`; `check-quality-all` limpio |
| 2026-10-13 | Steps 58U–58W caché de inferencia | 278/279 | todas | CTest completo, fallo conocido de `codegen_measurements`; `check-quality-all` limpio |
| 2026-10-14 | Step 41S `prim_eval` y la nueva ejecución de luerl (H3 cerrado) | 299/300 | todas | Véase la línea base actual |
| 2026-10-17 | Plan 20 OPTM.2 (Term de una palabra, términos persistentes en su sitio y recuperados) y OPTM.3 (accesores sin comprobaciones) | 330/332 | todas | CTest completo: fallo conocido de `codegen_measurements`, y `library_freshness` (OTP del anfitrión) todavía espera los cuerpos de stub `not_implemented` que `b0e62a38` reemplazó; `check-quality-all` limpio |

PG = paso del plan de patrones/guards; los registros de pasos del plan 11 están
archivados en `.agents/00-finished.md`.
