---
source: docs/usage.md
sourceCommit: 06042fa
sourceSha256: 69cd5cc2e8c6acc6bf67d677812a78d984940084e75d4930fbdcdf681e488435
translatedAt: 2026-10-09
---
# Uso del compilador

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

En macOS, `./run-macos.sh --parse-check examples/project/src/main.erl` compila
primero y ejecuta el ejecutable más reciente, pasando todos los argumentos sin
cambios. Acepta las variables de entorno `BUILD_DIR`, `BUILD_TYPE` y `JOBS` para
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
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  --verbose               Trace files and compilation phases to stderr
  --impldebug <n[,n...]>   Enable debug output for selected implementation steps
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
clau --print-types answer.erl client.erl
```

La inspección del IR permite ambas etapas juntas y se detiene antes de emitir
objetos. Varias instantáneas son módulos independientes; para obtener archivos
de ensamblador individuales se usa `--emit llvm-ir`. La inspección de tipos se
detiene antes de LLVM e imprime cada módulo como código fuente con las firmas
de función inferidas y anotaciones `Expression :: Type`. Acepta opciones de
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

`--impldebug 23` o `--impldebug 23,24,27` selecciona la salida de depuración
opcional de pasos de implementación con independencia de `--verbose`. Las
opciones repetidas combinan sus selecciones; los duplicados se ignoran. Los
valores son enteros decimales de 32 bits con signo, con signos `+`/`-`
opcionales y sin espacios ni miembros vacíos en la lista. Los pasos 23–27
imprimen en stderr las entradas/resultados de función inferidos y las relaciones
entre parámetros con el prefijo del paso seleccionado (por ejemplo,
`[impldebug 27]`). Son las entradas analizadas del lowering,
no un volcado del IR. Los pasos futuros pueden comprobar su propio
número; seleccionar un paso sin salida de depuración no tiene efecto. La misma
selección se aplica a las entradas posicionales y a todos los destinos de
proyecto seleccionados. Las acciones de comprobación/impresión exclusivas del
frontend no ejecutan la inferencia.

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
