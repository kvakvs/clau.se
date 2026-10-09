---
source: docs/compile.md
sourceCommit: 06042fa
sourceSha256: 6cf8b5c873d19e18501458078ca8c8ceb51da4da995693046af31ca5a78824b4
translatedAt: 2026-10-09
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
type/spec, `doc`/`moduledoc`, `author`, `vsn`, `copyright`, `deprecated`,
`-compile` con `{no_auto_import, ...}` u opciones `nowarn_*` que solo afectan a
advertencias (por ejemplo `nowarn_deprecated_catch`) e `-import` de BIF de guard
de `erlang`. Los demás atributos (`on_load`, parse transforms, otras opciones
de `compile`, módulos parametrizados) se rechazan. Los fuentes que empiezan por
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
- `SourceNotes` añade una anotación a una expresión, impresa como
  `Expression :: Text` (entre paréntesis salvo que sea una expresión de cuerpo
  completa; no es Erlang), y líneas de comentario encima de una forma. Los
  patrones, los guards y el lado izquierdo de un encaje no llevan ninguna.

## Opciones

| Opción | Comportamiento |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publica un artefacto por módulo |
| `--artifact-dir DIR` | Raíz de artefactos (requiere `--emit`) |
| `-o PATH` / `--output PATH` | Enlaza un ejecutable ([enlazado](executables.md#linking)); incompatible con `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Driver de Clang y archivo del runtime para `-o` |
| `--entry MODULE[:FUNCTION]` | Función/1 de entrada del ejecutable; se valida en todos los modos de compilación y añade el artefacto de arranque `clausev1_start` ([ejecutables](executables.md#startup-object)) |
| `--target-triple TRIPLE` | Máquina de destino; `--target` es la selección de destino del proyecto |
| `-O0` / `-O2` / `-Os` | Código genérico por defecto + LLVM O0 / especialización acotada + LLVM O2 / LLVM Os, sin especialización, una sección por símbolo y eliminación por el enlazador del código y los datos no referenciados |
| `--no-type-specialization` | Desactiva las variantes independientemente del orden de las opciones |
| `--print-ir` / `--print-optimized-ir` | IR verificado antes/después de las pasadas de LLVM, con las líneas del fuente Erlang como comentarios |
| `--print-types` | Cada módulo como código fuente de Erlang anotado con los tipos inferidos ([semántica](semantic.md#--print-types)); se detiene antes de LLVM |
| `--verbose` | Eventos de las fases `[pp]`, `[parse]` y `[comp]` en stderr |
| `--impldebug n[,n...]` | Salida de depuración de pasos de implementación en stderr (p. ej. `23`: resúmenes de inferencia) |

- Sin `--emit`, la compilación verifica los objetos en memoria y no escribe
  nada.
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

Otros requisitos previos: CMake ≥ 3.28, un compilador de C++23, Boost ≥ 1.90,
toml++ 3.4.0 y las herramientas de calidad. OTP solo es necesario para
auditorías opcionales y para regenerar fixtures.
