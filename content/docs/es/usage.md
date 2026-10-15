---
source: docs/usage.md
sourceCommit: 6ed3851c
sourceSha256: d4118cc040e610cc84df916720e96a6009b90b6a1cbfe086434dc5800fe49461
translatedAt: 2026-10-15
---
# Uso del compilador

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

En macOS, `./run-macos.sh --parse-check examples/project/src/main.erl` compila
primero y ejecuta el ejecutable más reciente, pasando todos los argumentos sin
cambios. Acepta las variables de entorno `TOOL_BUILD_DIR`, `BUILD_TYPE` y `JOBS` para
sustituir los valores por defecto.

```text
clau [options] <source.erl>...
  --project <path>        Read a TOML project instead of positional sources
  --target <name>         Select a target; repeat for more (default: all)
  --new-project <filename>  Create an annotated starter; append .toml when needed
  --preprocess-check       Check preprocessing only
  --parse-check            Preprocess and check syntax
  --print-pp               Print expanded Erlang source
  --print-ast              Print an indented syntax tree
  --print-source           Print each module as Erlang source
  --print-abstr            Print each module as OTP abstract format forms
  --parse-transform <mod>  Apply a parse transform to every module
  --transform-path <dir>   Directory of precompiled transform modules (.beam)
  --erl <path|none>        Host Erlang/OTP 29 erl that runs parse transforms
  --print-inputs           List the batch's sources, including modules added by reference; do not compile
  --print-env              Print the resolved compile environment as TOML and exit
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --print-asm              Print each module's assembly with IR and Erlang source comments
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  -g                      Emit Erlang line tables; executables keep them for debuggers
  --lto                   Link modules as bitcode with link-time optimization (LLD targets)
  --keep-exports          Keep every export of an executable callable (default: unreachable ones left out)
  --build-dir <dir>       Keep temporary files and caches below <dir> (projects default: <manifest-dir>/build)
  --no-cache              Neither read nor write build caches
  --cache-inference-in-dirs <pattern>  Cache inference results of modules in matching directories (besides OTP's)
  --verbose               Trace files and compilation phases to stderr
  --print-stage-times     Print preprocess/parse/transform time per file, compile time per batch and link time to stderr
  -I, --include <dir>      Add an include directory (last supplied searched first)
  -D, --define <name[=term]>  Define a macro (default value: true)
  --app-dir <app=dir>      Set an include_lib application directory
  --enable-feature <name>  Enable a language feature
  --disable-feature <name> Disable a language feature
  -h, --help              Show all options
  --version               Show version
  --                      Treat remaining arguments as input paths
```

Las rutas que contienen espacios y los valores de macro que contienen signos de
puntuación del shell deben ir entre comillas:

```sh
./build/debug/bin/clau --parse-check -I include '-DVERSION={1,0}' \
  --app-dir myapp=examples/project examples/project/src/main.erl
```

Los modos de comprobación no muestran nada en caso de éxito; los diagnósticos
van a stderr. Los modos de impresión escriben en stdout y pueden combinarse:
`--print-pp --print-ast` imprime el código fuente antes del árbol para cada
entrada. Añadir `--preprocess-check` no desactiva el análisis sintáctico
solicitado por `--parse-check` o `--print-ast`. Los errores pueden dejar una
salida impresa parcial.

Sin acción de comprobación/impresión, las entradas de código fuente y
`--project` ejecutan la cadena de compilación completa hasta búferes de objetos
nativos verificados en memoria. Las entradas posicionales forman un lote; cada
destino de proyecto forma su propio lote. `--emit` escribe los artefactos en
`build/aot` o en `--artifact-dir`; los proyectos añaden un nombre de destino
codificado y usan una raíz por defecto relativa al manifiesto. Los nombres de
archivo codifican la identidad del módulo. `-o PATH` enlaza las entradas
posicionales, o un destino de proyecto seleccionado, en un ejecutable con Clang
y la biblioteca del runtime (entrada:
`--entry MODULE[:FUNCTION]`, `entry` del manifiesto, o el único módulo que
exporta `main/1`). Sin `-o`, los destinos de proyecto con una clave `output` o
`entry` se enlazan en su `output` del TOML (por defecto `build/<target>`), y
solo se publican cuando todos los destinos seleccionados se han enlazado.
Véase [ejecutables](executables.md) para el contrato de entrada, argumentos y
código de salida.

```sh
clau -O2 -o demo answer.erl client.erl && ./demo
clau -O2 --emit obj answer.erl client.erl
clau --print-ir --print-optimized-ir -O2 answer.erl
clau --print-asm -O2 answer.erl
clau --print-types answer.erl client.erl
```

La inspección del IR permite ambas etapas juntas y se detiene antes de emitir
objetos. Varias instantáneas son módulos independientes; para obtener archivos
de ensamblador individuales se usa `--emit llvm-ir`. `--print-asm` imprime el
ensamblador del destino de cada módulo con cada tramo de instrucciones
comentado con la instrucción del IR y la línea de Erlang de la que procede
([listados de ensamblador](compile.md#assembly-listings)). La inspección de
tipos se detiene antes de LLVM e imprime cada módulo como código fuente con las
firmas de función inferidas y comentarios finales `% Type` en la expresión más
externa de cada línea. Acepta opciones de
preprocesado, de proyecto y de nivel de detalle, pero rechaza otras acciones,
destinos de salida y la política del backend. Véanse las
[opciones de compilación](compile.md).

`--verbose` imprime `[pp] <filename>` para los archivos fuente y los includes
del preprocesador resueltos, y `[parse] <filename>` cuando cada fuente entra en
el analizador sintáctico. Los includes anidados y de biblioteca se trazan a
medida que se cargan; los includes inactivos se omiten. El analizador consume
los tokens expandidos de forma incremental, por lo que su traza puede preceder a
las trazas de los includes. `[comp]` añade las fases semánticas y del backend y
las decisiones de especialización acotada a medida que empiezan. La traza va a
stderr en todos los modos, incluidos los proyectos.

`--print-stage-times` imprime `[time] <stage> <subject>: <milliseconds> ms` en
stderr a medida que termina cada etapa: `preprocess` (lectura y preprocesado),
`parse` y, para los módulos que usan parse transforms, `transform` (la
ejecución del `erl` del host y la importación de sus formas) por archivo
fuente, `compile` (desde el análisis hasta la emisión de objetos) una vez por
lote, indicando su número de módulos y el destino del proyecto, y `link` por
ejecutable, indicando su ruta final. El analizador sintáctico extrae las formas
del preprocesador, por lo que los dos tiempos por archivo se miden por separado
mientras se intercalan.

Códigos de salida: **0** en caso de éxito (incluidas las advertencias), **1**
para errores de código fuente/proyecto, **2** para errores de uso o nombres de
destino desconocidos. Cada entrada tiene un estado de preprocesado
independiente; cualquier error de código fuente hace que falle el comando en su
conjunto.

Las comprobaciones de sintaxis no validan la semántica ni ejecutan parse
transforms. Los modos de comprobación/impresión no crean archivos de salida y
rechazan `-o`/`--output`. La compilación por defecto sin `-o` no escribe ningún
ejecutable.

Para más detalles, véanse [preprocesado](preprocessor.md),
[uso del analizador sintáctico](parser.md) y
[estado de la validación](validation.md).

## Proyectos

Para ejecutar el ejemplo incluido de dos destinos:

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target app
./build/debug/bin/clau --preprocess-check --project examples/project/project.toml --target tests --target app
```

Para crear un proyecto comentado en un directorio existente:

```sh
mkdir -p build/project-demo
./build/debug/bin/clau --new-project build/project-demo/demo
mkdir -p build/project-demo/src
cp examples/project/src/main.erl build/project-demo/src/main.erl
./build/debug/bin/clau --parse-check --project build/project-demo/demo.toml
```

La creación escribe solo el archivo TOML solicitado y rechaza los destinos
existentes. La plantilla inicial contiene un destino `app` que usa `src`, con
todas las opciones del frontend en sus valores por defecto. Hay que añadir
archivos fuente antes de comprobarlo.

Las rutas del manifiesto son relativas al archivo TOML; las rutas de la CLI son
relativas al directorio de invocación. Por defecto se ejecutan todos los
destinos. Repitiendo `--target` se elige un subconjunto ordenado; las
selecciones repetidas se ejecutan una vez. `sources` admite nombres de archivo
literales y patrones `*`, `?`, `**`; `source_dirs` busca recursivamente
archivos `.erl`. Las rutas de búsqueda de fuentes solo localizan archivos
enumerados explícitamente. Las rutas de include de la CLI tienen prioridad, las
raíces de aplicación de la CLI reemplazan los nombres coincidentes, los ajustes
de funcionalidades de la CLI se aplican en último lugar y las definiciones de
macro duplicadas siguen siendo errores.

Véase [formato y flujos de trabajo de proyectos](projects.md). Los proyectos
admiten todas las acciones de la CLI; la generación de ejecutables sigue sin
implementarse.

El [catálogo de guards admitido](guards.md) incluye `is_integer/3` comprobado,
llamadas cualificadas y pruebas heredadas de nivel superior; las identidades de
proceso/nodo y de record nativo mantienen diagnósticos de capacidad explícitos.
