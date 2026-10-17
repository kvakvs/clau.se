---
source: docs/usage.md
sourceCommit: a8c3f8f6
sourceSha256: 06562916f7abbce822d9a5ca87d42cc0b3306de611e06ebce33ca5b2bd10d101
translatedAt: 2026-10-17
---
# Uso del compilador

Para construir un programa a partir de los fuentes: la entrada es el único
módulo que exporta `main/1`, que recibe los argumentos de la línea de órdenes
como cadenas:

```sh
clau -O2 -o demo examples/compile/answer.erl examples/compile/client.erl
./demo
clau -o app --entry app:start src/*.erl     # app:start/1, else app:start/0
```

En Windows, `-o` añade `.exe` cuando la ruta no tiene extensión. Sin `-o`, las
entradas posicionales se compilan en memoria y solo informan de diagnósticos.
Véanse [ejecutables](executables.md) para la selección de la entrada, los
argumentos, el código de salida y el enlazado, y
[el ejemplo de módulo compilado](../examples/compile/) para un host en C++ que
enlaza por sí mismo los objetos emitidos.

Los proyectos describen destinos en TOML; cada destino con una clave `output` o
`entry` se enlaza en su salida (por defecto `build/<target>`), y las salidas
solo se reemplazan después de que todos los destinos seleccionados hayan
terminado con éxito:

```sh
clau --new-project myapp                        # writes an annotated myapp.toml
clau --project myapp.toml                       # build every target
clau --project examples/project/project.toml --target app --parse-check
```

Véase [proyectos](projects.md) para el manifiesto, el descubrimiento de
fuentes, los fuentes ignorados, los directorios de compilación y las cachés.

Opciones comunes (`clau --help` las enumera todas):

| Opción | Propósito |
| --- | --- |
| `-o, --output PATH`, `--entry M[:F[/A]]` | Enlazar un ejecutable y elegir su entrada |
| `--project PATH`, `--target NAME` | Construir un proyecto TOML, o los destinos seleccionados |
| `-O0`, `-O2`, `-Os`, `--no-type-specialization` | Optimización (O0 por defecto; O2 añade especialización por tipos) |
| `-g`, `--lto`, `--keep-exports` | Tablas de líneas de depuración, optimización en tiempo de enlazado, conservar exportaciones inalcanzables |
| `-I DIR`, `-D NAME[=TERM]`, `--app-dir APP=DIR` | Rutas de include, macros, raíces de `include_lib` |
| `--enable-feature F`, `--disable-feature F` | Funcionalidades del lenguaje de OTP |
| `--parse-transform M`, `--transform-path DIR`, `--erl PATH\|none` | Parse transforms y el OTP del host que los ejecuta |
| `--emit obj\|llvm-ir\|llvm-bc`, `--artifact-dir DIR` | Escribir un artefacto por módulo (raíz por defecto `build/aot`) |
| `--target-triple TRIPLE`, `--linker PATH`, `--runtime-library PATH` | Destino, controlador de enlazado y archivo del runtime |
| `--build-dir DIR`, `--no-cache`, `--cache-inference-in-dirs PAT` | Archivos temporales y cachés de compilación |
| `--verbose`, `--print-stage-times` | Trazar las fases; medir el tiempo de cada etapa en stderr |

Las acciones de inspección imprimen en stdout y no compilan ejecutables:

| Opción | Imprime |
| --- | --- |
| `--preprocess-check`, `--parse-check` | Nada; solo diagnósticos |
| `--print-pp`, `--print-ast`, `--print-source`, `--print-abstr` | Fuente preprocesado, árbol sintáctico, fuente, formato abstracto de OTP |
| `--print-inputs` | Todos los fuentes del lote, incluidos los módulos de biblioteca añadidos por referencia |
| `--print-env` | El entorno de compilación resuelto como TOML |
| `--print-types` | El fuente anotado con los tipos inferidos |
| `--print-ir`, `--print-optimized-ir`, `--print-asm` | IR antes/después de la optimización de LLVM, ensamblador con comentarios de IR y de Erlang |

`clau` termina con 0 en caso de éxito (incluidas las advertencias), 1 para
errores de código fuente o de proyecto y 2 para errores de uso. Detalles:
[compilación](compile.md), [preprocesado](preprocessor.md),
[analizador sintáctico](parser.md).

Los parse transforms (`-compile({parse_transform, M})`) se ejecutan en un
Erlang/OTP 29 instalado en el host (`erl` en el `PATH`, o `--erl`), como haría
`erlc`; solo la compilación necesita OTP, nunca el ejecutable. Los transforms
distintos de los propios de OTP deben compilarse antes a `.beam`
([parse transforms](transforms.md)).

### Opciones del runtime

Los programas leen las opciones del runtime de la variable de entorno
`CLAUSE_FLAGS` y de los argumentos iniciales de la línea de órdenes, hasta el
primer argumento de otro tipo o `--`:

```sh
./demo --schedulers 4 --max-heap 100000000 -- arg1 arg2
```

`--schedulers N`, `--max-atoms N`, `--max-heap BYTES`, `--max-stack BYTES`,
`--max-memory BYTES` y `--profile FILE` se describen en
[opciones del runtime](executables.md#runtime-options).
