---
source: docs/compile.md
sourceCommit: 6ed3851c
sourceSha256: 3702a6fe367aab0776ef6b6345f19e09f34fcd9bd96ff7e67047a19b92c95805
translatedAt: 2026-10-15
---
# Compilación

`clau` compila módulos de Erlang/OTP 29 mediante LLVM a IR verificado, bitcode
u objetos nativos. `-o/--output` enlaza las entradas posicionales (o un destino
de proyecto seleccionado), su objeto de arranque de [entrada](executables.md) y
el runtime en un ejecutable ([enlazado](executables.md#linking));
las compilaciones de proyectos enlazan los destinos ejecutables en las salidas
de su manifiesto ([proyectos](projects.md#executables)). Los objetos emitidos
también pueden ejecutarse mediante un arnés de C++ enlazado con el runtime
(véase el ejemplo más abajo).

## Subconjunto de código fuente aceptado

Módulos con nombre, con exportaciones y cláusulas de función ordenadas. Las
cabeceras y los encajes del cuerpo aceptan variables, `_`, alias, nombres
repetidos y patrones sobre átomos, enteros arbitrarios, flotantes finitos,
tuplas, listas/cadenas, maps, bitstrings y records ordinarios de tupla. Los
cuerpos son secuencias de encajes, constructores, operadores/BIF de guard
comprobados, `erlang:display/1` ([impresión](terms.md#printing)), `halt/0,1`
([código de salida](executables.md#exit-status)), las funciones que lanzan
excepciones `error/1,2,3`, `exit/1`, `throw/1` y `erlang:raise/3`
([ABI](abi.md#failure-channel-revision-2)), las demás
[builtins del puente](builtins.md) (`erlang:function_exported/3`)
y funs de builtins, `case`/`if`, `catch Expr`,
`try ... of ... catch Class:Reason:Stack ... after` con
[trazas de pila](abi.md#stack-traces), `maybe ... else ... end`, comprehensions
de listas, de binaries y de maps ([patrones](patterns.md#comprehensions)) y
llamadas directas locales o remotas literales dentro del lote, incluida la
recursión propia, mutua y entre módulos sobre marcos de proceso explícitos con
llamadas de cola propias
([modelo de ejecución](execution-model.md#implementation)); la recursión de
cuerpo está acotada por la pila del proceso (sin límite por defecto), no por la
pila nativa. Los guards admiten el catálogo admitido completo. Véanse
[patrones](patterns.md), [guards](guards.md) y [términos](terms.md).

Los valores de función `fun F/A`, `fun M:F/A`, los funs anónimos y con nombre
con variables capturadas, las llamadas a funs y las llamadas dinámicas
(`M:F(...)`, `apply/2,3`) se ejecutan ([funs](funs.md)). Se rechazan con
diagnósticos incluso en funciones no usadas: `receive`, funs de builtins,
procesos y mensajería. Atributos aceptados: `module`, `export`, `file`,
`record` de tupla y nativo, `export_record`, `import_record`, formas
type/spec, `doc`/`moduledoc`, `behaviour`/`behavior`
([behaviours](semantic.md#behaviours)), cualquier atributo informativo (`vsn`,
`author`, `copyright`, `deprecated`, `dialyzer`, `-name(Term)` definido por el
usuario; se conservan para
[`module_info(attributes)`](semantic.md#predefined-functions)),
`-import(Module, [F/A, ...])` ([importaciones](semantic.md#imports)) y
`-compile` con opciones que no cambian nada de lo que emite Clause:
`{no_auto_import, ...}`, opciones de advertencias (`nowarn_*`, `warn_*`,
`{nowarn_unused_function, [...]}`) e indicaciones de optimización, depuración
e informes (`inline`, `{inline, [F/A]}`, `{inline_size, N}`,
`{inline_effort, N}`, `inline_list_funcs`, `debug_info`, `deterministic`,
`report*`, `verbose`, ...). `{parse_transform, Module}` ejecuta la
transformación en el Erlang/OTP del host antes del análisis
([parse transforms](transforms.md)). `on_load`, `nifs`, `export_all`, otras
opciones de `compile` y los módulos parametrizados se rechazan; el diagnóstico
los nombra, por ejemplo
`[behavior-changing attributes] notimpl [module="m" operation="-compile option export_all"]`.
Todo módulo recibe `module_info/0,1`. Los fuentes que empiezan por
`#!` siguen las [reglas de escript](executables.md#escripts) (módulo implícito y
exportación de `main/1`, `-mode` aceptado). Las formas type/spec se analizan
pero nunca cambian el código generado. Los modos solo sintácticos
(`--parse-check`, `--print-ast`, `--print-source`, ...) aceptan la gramática
completa.

## Ejecutar el ejemplo de módulos compilados

`client:main/1` convierte el ejemplo en un programa:

```sh
./build/debug/bin/clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo     # prints 42, -7 and {record,map,binary,list,integer,other}
```

Los mismos módulos también se ejecutan mediante un arnés de C++. Desde un
Developer PowerShell de Windows x64 con el compilador ya construido:

```powershell
$tool = './build/debug/bin/clau.exe'
& $tool -O0 --emit obj --artifact-dir build/example-aot examples/compile/answer.erl examples/compile/client.erl
cmake -S examples/compile -B build/example-native -G Ninja -DCMAKE_CXX_COMPILER=clang-cl -DCMAKE_BUILD_TYPE=Debug "-DGENERATED_DIR:PATH=$((Resolve-Path build/example-aot).Path)"
cmake --build build/example-native
./build/example-native/bin/Debug/compiled_modules.exe
```

Imprime `42`, `-7`, `record`, `map`, `binary`, `list`, `integer`, `other`, uno
por línea. El arnés registra los módulos explícitamente, crea un contexto y
decodifica los resultados; es un anfitrión de ejemplo, no un punto de entrada
de producción. En Unix se usan `build/debug/bin/clau`, `clang++` y
`-DGENERATED_DIR="$PWD/build/example-aot"` (las ejecuciones nativas allí aún no
están validadas).

Otras acciones sobre los mismos fuentes:

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

## Impresión del formato abstracto

`--print-abstr` (una acción del frontend) imprime cada módulo analizado como
las formas del [formato abstracto](https://www.erlang.org/doc/apps/erts/absform.html)
de OTP que `epp` entregaría a un parse transform, un término de
`file:consult/1` por línea, los mismos términos que escribe `erlc +to_abstr`
([transforms](transforms.md)).

## Impresión del código fuente

`--print-source` (una acción del frontend, como `--print-ast`) imprime cada
módulo analizado como código fuente de Erlang; `--print-types` imprime el mismo
texto con anotaciones de tipos. El impresor (`print_source`,
`expression_source`, `type_source` en `printing.hpp`;
`compiler/src/printing/source_*`) es reutilizable:

- Las formas se suceden en orden de código fuente, con una línea en blanco
  alrededor de cada función; se omite la forma `-file` que el preprocesador
  añade antes de un módulo, y se conservan las que rodean a los archivos
  incluidos.
- El texto es la sintaxis analizada: las macros se expanden, los includes se
  insertan en línea, y los comentarios, la grafía original y la disposición
  desaparecen. Las cláusulas y las expresiones de bloque (`case`, `if`,
  `receive`, `try`, `maybe`, `begin`, funs de más de una línea) ocupan líneas
  sangradas a cuatro columnas; todo lo demás va en una sola línea. Los
  paréntesis provienen solo de las agrupaciones del propio fuente.
- El texto impreso se analiza de nuevo al mismo árbol sintáctico, y volver a
  imprimirlo da el mismo texto (CTest `printing_source` sobre los fixtures
  analizables).
- `SourceNotes` añade una nota a una expresión, impresa como un comentario
  final `% Text` tras la puntuación de la línea donde termina la expresión, y
  líneas de comentario encima de una forma. Solo las expresiones de línea
  completa llevan notas (expresiones de cuerpo y el valor examinado de un
  `case`; una por línea, la más externa), de modo que las expresiones anidadas
  largas siguen siendo legibles y el texto sigue siendo Erlang. Los patrones y
  los guards no llevan ninguna.

## Opciones

| Opción | Comportamiento |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publica un artefacto por módulo |
| `--artifact-dir DIR` | Raíz de artefactos (requiere `--emit`) |
| `-o PATH` / `--output PATH` | Enlaza un ejecutable ([enlazado](executables.md#linking)); incompatible con `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Driver de Clang y archivo del runtime para `-o` |
| `--no-cache` | No lee ni escribe las [cachés de compilación](projects.md#build-caches) |
| `--cache-inference-in-dirs PATTERN` | Repetible: los módulos de los directorios que coinciden conservan sus resultados de inferencia en la caché de compilación, además de los directorios implícitos de aplicaciones de OTP ([caché de inferencia](projects.md#inference-cache)) |
| `--build-dir DIR` | Dónde guarda Clause los archivos temporales (bajo `DIR/tmp`); sustituye el `build_dir` de cada destino de proyecto seleccionado; las entradas posicionales no tienen ninguno sin esta opción ([directorio de compilación](projects.md#build-directory)) |
| `--entry MODULE[:FUNCTION]` | Función/1 de entrada del ejecutable; se valida en todos los modos de compilación y añade el artefacto de arranque `clausev1_start` ([ejecutables](executables.md#startup-object)); las inspecciones de IR y de ensamblador omiten entonces lo que no puede alcanzar ([vivacidad de las exportaciones](executables.md#export-liveness)) |
| `--target-triple TRIPLE` | Máquina de destino; `--target` es la selección de destino del proyecto |
| `-O0` / `-O2` / `-Os` | Código genérico por defecto + LLVM O0 / especialización acotada + LLVM O2 / LLVM Os, sin especialización, una sección por símbolo y eliminación por el enlazador del código y los datos no referenciados |
| `--no-type-specialization` | Desactiva las variantes independientemente del orden de las opciones |
| `--lto` | Enlaza los módulos como bitcode con la optimización en tiempo de enlazado de LLD (destinos Windows MSVC y ELF; necesita `-o` o una compilación de proyecto que enlace) ([enlazado](executables.md#linking)) |
| `--keep-exports` | Mantiene invocables todas las exportaciones de un ejecutable en lugar de omitir las que no puede alcanzar; necesita `-o`, una compilación de proyecto que enlace o una inspección de IR/ensamblador ([vivacidad de las exportaciones](executables.md#export-liveness)) |
| `-g` | Tablas de líneas de Erlang en los objetos y en los ejecutables enlazados (CodeView/PDB en destinos MSVC, DWARF en los demás) ([depuración](debugging.md)) |
| `--print-ir` / `--print-optimized-ir` | IR verificado antes/después de las pasadas de LLVM, con las líneas del fuente Erlang como comentarios |
| `--print-asm` | El ensamblador del destino de cada módulo tras la cadena seleccionada, con cada tramo de código máquina comentado con la instrucción del IR y la línea de Erlang de la que procede ([listados de ensamblador](#assembly-listings)) |
| `--print-types` | Cada módulo como código fuente de Erlang anotado con los tipos inferidos ([semántica](semantic.md#--print-types)); se detiene antes de LLVM |
| `--verbose` | Eventos de las fases `[pp]`, `[parse]` y `[comp]` en stderr y después el resumen del [índice de directorios](projects.md#directory-index) `[index] ...` |
| `--print-stage-times` | `[time] <stage> <subject>: <ms> ms` en stderr: `plan` por manifiesto de proyecto (cargarlo y expandir los patrones de cada destino seleccionado), `preprocess`, `parse` y `transform` (módulos con parse transforms) por archivo fuente, `compile` por lote (número de módulos, destino del proyecto), `link` por ejecutable; ` (cached)` sigue a una etapa que reutilizó un resultado [en caché](projects.md#build-caches). Antes del total `compile` de un lote aparecen sus fases con el mismo sujeto: `index`, `calls`, `liveness` (ejecutables e inspecciones con entrada), `declared-types`, `inference-cache` (con `N of M covered modules reused`, [caché de inferencia](projects.md#inference-cache)), `inference`, `inference-store`, `contracts`, `lower`, `optimize`, `emit` (las que se ejecutaron). Tras `inference`: líneas `inference pass N` con los pasos de trabajo de la pasada sobre el presupuesto de trabajo de la inferencia (`N of BUDGET work steps`) y cómo terminó (`inputs changed`, `fun results changed`, `settled`, o la pasada final tras pasadas sin estabilizar), nombrando la función en ejecución cuando se agotó el presupuesto; después `inference slowest <module>:<function>/<arity>` para las 10 funciones (los grupos recursivos nombran un miembro `and N more`) que más tardaron en el conjunto de las pasadas, con sus pasos de trabajo y la parte de ese trabajo respecto al presupuesto de las pasadas que las ejecutaron (`877450 work steps, 43.9% of 10 passes of 200000 budget`), y `widened to term()` cuando un presupuesto amplió uno de sus hechos; después `inference rounds <module>:<function>/<arity> and N more` para los 10 grupos recursivos más lentos: resoluciones en el conjunto de las pasadas, rondas ejecutadas frente al tope por resolución (8 + 4 por miembro), resoluciones que alcanzaron el tope o gastaron su octava parte del presupuesto de la pasada (todos los miembros ampliados a `term()`), resoluciones que se abandonaron de inmediato porque una pasada anterior lo hizo (`remembered`) o terminaron con el presupuesto de la pasada agotado, recorridos de miembros (y los omitidos porque nada de lo que leen cambió) y la parte que cambió un resumen (creció, cambiaron entradas de tipo función o volvió a uno de los últimos 4 resúmenes del miembro), y los miembros cambiados por ronda de la última resolución en diez grupos de rondas. Una compilación en caché no imprime fases |
| `--print-env` | Imprime en stdout el entorno de compilación resuelto como TOML y termina sin procesar fuentes ([informe del entorno](#environment-report)) |
| `--print-inputs` | Preprocesa y analiza las entradas, añade los módulos que nombran como hace la compilación y después enumera en stdout cada fuente del lote y se detiene antes de la compilación ([proyectos](projects.md#cli-and-target-selection)) |

- Sin `--emit`, la compilación verifica los objetos en memoria y no escribe
  nada fuera del [directorio de compilación](projects.md#build-directory).
- Las entradas posicionales forman un lote; cada destino de proyecto es su
  propio lote.
- Raíces de artefactos: `build/aot` (posicionales) o `build/aot/<hex-target>`
  bajo el directorio del manifiesto. Las raíces explícitas son relativas a la
  invocación.
- Los nombres son hexadecimal reversible: `answer` →
  `clausev1_616e73776572__0.obj` (`.o` para ELF/Mach-O, `.ll`, `.bc`); el
  objeto de arranque es `clausev1_start.obj`.
- Todos los lotes se compilan y preparan antes de la publicación. Los fallos no
  publican nada y conservan las salidas anteriores; el reemplazo es atómico por
  archivo, no por lote.
- `--emit` es incompatible con `-o`; las opciones de compilación son
  incompatibles con las acciones exclusivas del frontend y con `--new-project`.
  `--print-types` rechaza las opciones de destino y de optimización.
- Las instantáneas de IR son ensamblador de LLVM; varias instantáneas se separan
  con cabeceras de comentario escapadas y no forman un único módulo analizable.
  Para la entrada de herramientas se usa `--emit llvm-ir`. Los comentarios de
  líneas de código fuente muestran el texto original (macros sin expandir) y
  sobreviven a la optimización mediante las ubicaciones de depuración.

## Listados de ensamblador

`--print-asm` ejecuta la cadena seleccionada (como hace `--print-optimized-ir`)
y después imprime el ensamblador de cada módulo de entrada desde la misma
máquina de destino que escribe los objetos, un módulo cada vez. Los
comentarios usan el marcador del destino (`#` en x86, `//` en AArch64 ELF, `;`
en Apple, `@` en ARM):

```
# erlang answer.erl:3: value() -> 42.
#     ir store i64 687, ptr %frame.slots, align 8
	movq	$687, 32(%r15,%r12,8)
#     ir br i1 %4, label %return.inline, label %return.service
```

- Un comentario `ir` abre cada tramo de instrucciones seleccionadas a partir de
  una instrucción del IR, escrita como la imprime `--print-optimized-ir` (la
  misma numeración de valores, `switch` plegado en una línea, sin `!dbg`). El
  código movido o fusionado entre instrucciones repite u omite comentarios
  según indique la tabla de líneas.
- Un comentario `erlang` nombra el archivo físico, la línea y el texto, como
  los comentarios de fuente del IR, cuando la línea cambia dentro de una
  función. Las instrucciones que el lowering no ubicó en ninguna parte
  (envoltorios, preparación de marcos) no tienen ninguno.
- El listado compila una copia cuya tabla de líneas numera instrucciones del
  IR en lugar de líneas de Erlang; se omiten las directivas, las secciones de
  depuración y las etiquetas de esa tabla de líneas. Reensamblado, da el
  objeto que escribe `--emit obj`.
- Con otras inspecciones, cada módulo imprime `before`, `after` y `assembly`
  por turnos, cada uno tras una cabecera (`stage=assembly`). Como la
  inspección del IR, rechaza `--emit`, `--artifact-dir`, `--output` y
  `--print-types`. Los listados de x86 usan la sintaxis de AT&T.
- Con `--entry`, las inspecciones de IR y de ensamblador omiten las funciones
  que la entrada no puede alcanzar, como hace el ejecutable (`--keep-exports`
  las conserva).

## Informe del entorno

`--print-env` valida toda la línea de órdenes (conflictos, entradas
posicionales legibles, planificación del proyecto) y después imprime lo que
usaría esa orden como un documento TOML en stdout, termina con 0 y no lee
ningún fuente. Las rutas son absolutas, con `/`.

```toml
# clau compile environment (--print-env)
command = ["clau", "--print-env", "-O2", "-o", "app", "main.erl"]  # as given
actions = ["link"]          # see below
working_directory = "/work"

[[targets]]                 # one per selected project target; one for positional inputs
name = "app"                # project targets only
project = "/work/project.toml"
sources = ["/work/src/main.erl"]           # globs and search paths resolved
library_directory = "/clau/library"     # application dirs, searched before source_search_paths
build_dir = "/work/build"   # "" for positional inputs without --build-dir
entry = "main:main"         # or "auto" when linking without --entry
output = "/work/app"        # linking only: final name (".exe" on Windows)
linker = "/usr/bin/clang++" # linking only; "" when none is found
runtime_library = "/clau/lib/libclause_runtime.a"

[targets.options]           # manifest option names
source_search_paths = []    # directories, patterns expanded
include_dirs = []           # search order, patterns expanded
defines = []
applications = { "stdlib" = "/otp/lib/stdlib" }  # last mapping wins
enabled_features = ["maybe_expr"]                # OTP defaults plus changes

[targets.backend]
target_triple = "x86_64-unknown-linux-gnu"  # host when not given
optimization = "O2"
type_specialization = true  # O2 without --no-type-specialization
debug_info = false
lto = false
keep_exports = false        # --keep-exports or the project option
emit = "none"               # or obj, llvm-ir, llvm-bc
artifact_dir = "/work/build/aot"
```

(Los arrays imprimen un elemento por línea.) `actions` enumera las acciones del
frontend (`print-pp`, `parse-check`, `print-ast`, `print-source`,
`print-abstr`, si no `preprocess-check`; `print-inputs` las sustituye por sí
sola), si no las inspecciones (`print-types`, `print-ir`,
`print-optimized-ir`, `print-asm`), si no `emit`, `link` (`-o`) o `compile`.
En una compilación de proyecto, los destinos con un `output` también enlazan.
Los módulos encontrados más tarde por nombre (mediante `source_search_paths` o
la biblioteca) no se enumeran: encontrarlos requiere el análisis sintáctico
(eso lo hace `--print-inputs`). `--print-env` no puede combinarse con
`--new-project`.

## Caché de compilación

Un lote con directorio de compilación (cada destino de proyecto, las entradas
posicionales con `--build-dir`) guarda el resultado de su compilación en la
[caché de compilación](projects.md#build-caches): los diagnósticos en orden, el
fallo y, cuando un ejecutable o `--emit` los necesitan, los objetos (o el
bitcode) de cada módulo y del módulo de arranque. Una compilación posterior
del mismo lote con las mismas opciones reproduce los diagnósticos y enlaza o
publica los objetos conservados exactamente igual que los nuevos;
`--print-stage-times` muestra entonces `[time] compile ... (cached)`.
`--print-ir`, `--print-optimized-ir`, `--print-asm` y `--print-types` siempre
recalculan, y `--no-cache` ni lee ni escribe.

- **Unidad de reutilización: el lote completo.** El análisis, la inferencia de
  tipos, los presupuestos de especialización (por destino), la vivacidad de
  las exportaciones y el módulo de arranque abarcan todos los módulos, así que
  el objeto de un módulo depende de hechos de otros (tipos de los llamados,
  records, behaviours, qué funciones siguen vivas). Hoy esos hechos no tienen
  una forma canónica que se pueda resumir con un hash por módulo, por lo que
  no se podría demostrar que una clave por módulo sea correcta; cualquier
  cambio en cualquier módulo del lote recompila el lote. Solo los resultados
  de la inferencia se conservan por módulo para los directorios de biblioteca
  cubiertos ([caché de inferencia](projects.md#inference-cache)), de modo que
  esa recompilación los reutiliza.
- **Clave.** La versión de `clau` y la identidad del ejecutable; la ruta y la
  huella de cada entrada (cada archivo que el frontend leyó para ella, ruta y
  bytes, en orden: el fuente, sus includes y archivos `include_lib`, y la
  respuesta de sus parse transforms; las opciones de preprocesado; el texto
  generado de los marcadores de posición), las formas predefinidas y el estado
  de escript; la tripleta resuelta, el nivel de optimización, `--emit`,
  `--no-type-specialization`, `-g`, `--lto`, `--keep-exports`, si se enlaza un
  ejecutable, la selección de la entrada y el destino del proyecto. Las
  entradas de un mismo destino con otras opciones se conservan una junto a
  otra.
- **Almacenamiento.** Cada salida es una parte propia, de modo que un objeto
  mayor que el límite en línea del almacén se convierte en un archivo blob
  direccionado por contenido, compartido cuando dos conjuntos de opciones
  producen objetos idénticos.

## Backend

- Un contexto de LLVM y una máquina de destino por lote. La tripleta del
  anfitrión usa la CPU y las características del anfitrión; las tripletas
  ajenas usan la CPU genérica. PIC, modelo de código pequeño.
- Backends: X86, ARM, AArch64 (intersección con el SDK). Los backends
  desconocidos o ausentes fallan; no hay alternativa al anfitrión.
- La verificación se ejecuta antes y después de la optimización; comprueba la
  validez del IR, no la corrección del Erlang.
- Presupuestos por destino: 1.024 módulos, 250.000 nodos AST por módulo,
  1.000.000 por lote. Salida serializada: 64 MiB por módulo, 256 MiB por lote.
  Superar un presupuesto es un diagnóstico de recursos ordinario.

## SDK de LLVM

LLVM estable **23.1.x**, como mínimo 23.1.1. LLVM es una dependencia del
anfitrión: la arquitectura, la biblioteca estándar de C++ y el CRT de Windows
deben coincidir con los de la herramienta del compilador. El código del
proyecto mantiene excepciones/RTTI; ninguna excepción puede propagarse a través
de LLVM. El runtime nunca usa LLVM.

- La detección busca en los prefijos estándar (`/usr`, `/usr/local`,
  `/opt/homebrew`, `/opt/local`, `/opt/llvm`, Linuxbrew,
  `/Library/Developer/Toolchains`, Program Files en Windows), incluidas las
  disposiciones con versión. Los árboles de compilación se rechazan.
- `LLVM_DIR` selecciona un SDK explícitamente; las selecciones no válidas
  fallan sin alternativa.
- Si no se encuentra ninguno, CMake descarga el archivo fijado **23.1.2**
  (con comprobación SHA-256) en `thirdparty/` para Windows x64/ARM64, Linux
  x64/ARM64 o macOS ARM64. `CLAUSE_DOWNLOAD_LLVM=OFF` desactiva las descargas.
- Una prueba de enlazado en tiempo de configuración comprueba la compatibilidad
  de ABI.

Configuración de referencia en Windows x64 (2026-09-29): clang-cl 23.1.2 del
anfitrión en `C:/Program Files/LLVM/bin`, SDK
`thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`, herramientas x64 de
Visual Studio 18, Windows SDK 10.0.26100.0, Ninja, `/MT`,
`_ITERATOR_DEBUG_LEVEL=0`. La selección automática aplica `/MT` y los ajustes
de iteradores; un `LLVM_DIR` explícito no lo hace, y entonces la prueba de
enlazado falla.

Referencia histórica de macOS: `llvm` 23.1.1_1 de Homebrew (arm64,
`libLLVM.23.1.dylib` compartida, aserciones desactivadas) con AppleClang 21.

## PCRE2

Los builtins `re` del runtime usan PCRE2 **10.47**, la versión que incluye OTP
29 (`erts/emulator/pcre/vendor.info`), de modo que la sintaxis de patrones, las
opciones y las capturas se comportan como en OTP: unidades de código de 8 bits,
soporte de Unicode, sin JIT, `pcre2_match` estándar (no se traslada el parche
de cesión de OTP). PCRE2 tiene licencia BSD-3-Clause con la excepción de PCRE2
para binarios compilados; no se incluye en el repositorio ningún archivo de
PCRE2. CMake (`cmake/Pcre2Dependencies.cmake`) lo resuelve en este orden:

1. `-DCLAUSE_PCRE2_ROOT=<source directory>` tiene prioridad (sin descarga); la
   versión de su `configure.ac` debe ser 10.47.
2. Un PCRE2 instalado de al menos 10.47 (`CLAUSE_PCRE2_SYSTEM=ON`, por
   defecto): el paquete de CMake
   (`find_package(pcre2 CONFIG COMPONENTS 8BIT)`, con preferencia por las
   bibliotecas estáticas) o, si no, `libpcre2-8` de pkg-config, con preferencia
   por una `libpcre2-8.a` estática frente a la biblioteca compartida.
3. La versión fijada, descargada en `thirdparty/pcre2-10.47` y verificada
   (`pcre2-10.47.tar.bz2`, SHA-256
   `47fe8c99461250d42f89e6e8fdaeba9da057855d06eb7fc08d9ca03fd08d7bc7`);
   `-DCLAUSE_DOWNLOAD_PCRE2=OFF` desactiva la descarga.

Un directorio de fuentes (1 o 3) construye la biblioteca de objetos
`clause_pcre2` a partir de los archivos `.c` enumerados con los
`config.h.generic`, `pcre2.h.generic` y `pcre2_chartables.c.dist`
distribuidos, copiados en el árbol de compilación (sin paso de generación, sin
las opciones de advertencia del proyecto, fuera de clang-tidy y Lizard), y sus
objetos se añaden al propio `clause_runtime`: el archivo es autosuficiente y
todo consumidor (los enlazados de `clau`, los programas de prueba anidados,
`runtime_link`, `examples/compile`) obtiene PCRE2 con él. Una biblioteca
instalada, en cambio, se convierte en una entrada adicional del enlazador
registrada en `clause_runtime.link` junto al archivo (una entrada por línea),
que `clau` añade a cada enlazado; una biblioteca compartida hace que los
ejecutables dependan de ella en tiempo de ejecución. Por plataforma: Windows
usa la descarga (en la práctica no se busca ningún PCRE2 del sistema); Linux y
macOS usan un PCRE2 10.47 o posterior instalado cuando existe y, si no, la
descarga. Por ahora siempre se enlaza en el runtime (decidido el 2026-10-14);
enlazarlo solo en los programas que llaman a `re`, o como biblioteca cargada
dinámicamente, queda diferido.

## zlib

El módulo zlib del runtime y los términos externos comprimidos usan zlib
**1.3.2**, la versión que incluye OTP 29 (`erts/emulator/zlib/vendor.info`), de
modo que los bytes comprimidos son iguales a los de OTP. CMake compila sus
fuentes de biblioteca (`cmake/ZlibDependencies.cmake`,
`clause_add_runtime_zlib`) en la biblioteca de objetos `clause_runtime_zlib`,
cuyos objetos se unen a `clause_runtime` como los de PCRE2;
`-DCLAUSE_RUNTIME_ZLIB_ROOT=<source directory>` tiene prioridad y, si no, la
versión se descarga en `thirdparty/zlib-1.3.2` y se verifica (SHA-256
`bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16`) en todos
los anfitriones. La licencia de zlib es la licencia zlib. El LLVM del
compilador conserva su propia zlib; ambas nunca coinciden en un mismo binario.

Otros requisitos previos: CMake ≥ 3.28, un compilador de C++23, Boost ≥ 1.90,
toml++ 3.4.0 y las herramientas de calidad. OTP solo es necesario para
auditorías opcionales y para regenerar fixtures.
