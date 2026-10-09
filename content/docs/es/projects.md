---
source: docs/projects.md
sourceCommit: 06042fa
sourceSha256: fede4b3ed0440e1032fd9d7e0bad11ee107bc68c2c08dfa3b1add7b9fbc880c1
translatedAt: 2026-10-09
---
# Proyectos TOML

Un manifiesto de proyecto selecciona grupos ordenados de fuentes Erlang y
configura cada destino (target) de forma independiente. Todas las acciones de
la CLI aceptan proyectos. Véase el
[ejemplo funcional](../examples/project/project.toml).

## Manifiesto (esquema 1)

```toml
schema_version = 1

[[targets]]
name = "app"
sources = ["main.erl", "src/workers/*.erl", "shared/**/*.erl"]
source_dirs = ["src/support"]
output = "build/app"
entry = "main:main"

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]

[targets.options.applications]
my_dependency = "vendor/my_dependency"
```

- Son obligatorios `schema_version = 1` y un array `targets` no vacío. Se
  rechazan las claves desconocidas, los tipos incorrectos, los nombres de destino
  duplicados y las cadenas vacías; no hay conversión de tipos. Se valida el
  manifiesto completo, incluidos los destinos no seleccionados.
- Nombres de destino: ASCII `[A-Za-z0-9_][A-Za-z0-9_.-]*` con distinción de
  mayúsculas y minúsculas, únicos. Un nombre es un destino de compilación, no una
  tripleta de LLVM.
- `sources` (archivos y patrones comodín) y `source_dirs` (búsqueda recursiva
  de `.erl`) son opcionales, pero un destino necesita al menos una entrada. Los
  archivos explícitos deben terminar en `.erl`; las cabeceras son dependencias,
  no entradas.
- Los campos de `options` son opciones tipadas opcionales del frontend.
  `defines` usa `NAME` (= `true`) o `NAME=ERLANG_LITERAL_TERM`; los duplicados
  son errores. Una funcionalidad no puede aparecer en ambas listas de
  funcionalidades.
- `entry` (opcional) selecciona la entrada del ejecutable `MODULE[:FUNCTION]`;
  véase [ejecutables](executables.md#entry-selection). El `--entry` de la CLI la
  sustituye para un único destino seleccionado.
- `output` es el destino del ejecutable, por defecto
  `<manifest-dir>/build/<target>` (`.exe` en Windows). Un destino con `output` o
  `entry` es un destino ejecutable ([ejecutables](#executables)); `--emit` y los
  modos de comprobación/impresión ignoran las salidas de ambas claves.
- Aún no soportado: valores por defecto en la raíz, herencia, dependencias entre
  destinos, importaciones, perfiles, exclusiones, paquetes, vigilancia de
  cambios, caché, compilaciones en paralelo. Los campos solo se añaden junto con
  su comportamiento.

## CLI y selección de destinos

```text
clau [options] <source.erl>...
clau [options] --project <path> [--target <name>]...
clau --new-project <filename>
```

- Los fuentes posicionales y `--project` son mutuamente excluyentes. Un solo
  `--project`, cualquier número de `--target`, en cualquier orden.
- Sin `--target`: todos los destinos en el orden del manifiesto. Los selectores
  conservan su orden y su primera aparición. Los nombres desconocidos fallan
  antes de cualquier trabajo del frontend y enumeran los nombres disponibles.
- `--project test1` carga `test1.toml` cuando `test1` no existe.
- Las opciones de frontend de la CLI se aplican a todos los destinos
  seleccionados. Las rutas relativas de la CLI mantienen su significado respecto
  al directorio de invocación; las rutas del manifiesto son relativas al
  manifiesto.
- Sin `--emit` ni una acción de comprobación/impresión, los destinos ejecutables
  se enlazan en sus salidas ([ejecutables](#executables)); los demás destinos se
  compilan en memoria.
- `-o/--output` enlaza el destino en esa ruta en lugar de su `output`
  ([enlazado](executables.md#linking)); requiere exactamente un destino
  seleccionado.
- `--verbose` traza en stderr los archivos/includes `[pp]` y los fuentes
  `[parse]`.
- Código de salida 2: errores de uso y destinos desconocidos. Código 1: fallos
  de manifiesto, de búsqueda, del frontend o de creación. Código 0: éxito (se
  permiten advertencias).

Cada destino seleccionado es un lote de compilación independiente con sus
propias sesiones de preprocesado. La planificación (decodificar, seleccionar,
buscar, comprobar colisiones de salida) termina antes de procesar ningún fuente;
después la ejecución procesa los destinos/archivos en orden y retiene los
fallos. La salida de contenido va a stdout en orden de destino/archivo sin
encabezados; el contexto y los diagnósticos van a stderr.

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target tests --target app
```

## Ejecutables

`clau --project FILE [--target T]...` (sin `--emit` ni acción de
comprobación/impresión) enlaza cada destino seleccionado que tenga una clave
`output` o `entry`, o al que se dirijan `-o`/`--entry` de la CLI, en un
ejecutable por destino:

- Destino del archivo: `-o` de la CLI (relativo a la invocación); si no,
  `output` (relativo al manifiesto); si no, `<manifest-dir>/build/<target>`. Los
  destinos Windows añaden `.exe` a un nombre sin extensión. Los directorios que
  faltan de las salidas del manifiesto se crean; un directorio `-o` explícito
  debe existir.
- Entrada: `--entry` de la CLI, `entry` del manifiesto o, si no, detección
  ([selección de la entrada](executables.md#entry-selection)).
- Los destinos sin `output`, `entry`, `-o` ni `--entry` son bibliotecas: se
  compilan en memoria y no escriben nada, aunque un módulo exporte `main/1`.
- La planificación rechaza los destinos seleccionados con el mismo destino de
  archivo; las salidas que solo coinciden tras añadir `.exe` se rechazan antes
  de la publicación. Una salida no debe coincidir con un fuente seleccionado ni
  con el manifiesto.
- Cada destino se compila y enlaza en su propio directorio de preparación. Las
  salidas solo se reemplazan cuando todos los destinos seleccionados han tenido
  éxito, en orden de destino; cualquier fallo deja intactas todas las salidas
  existentes. Un fallo al reemplazar una salida posterior puede dejar las
  anteriores ya reemplazadas.
- `--linker` y `--runtime-library` se aplican a todos los destinos enlazados
  ([enlazado](executables.md#linking)).

```sh
./build/debug/bin/clau --project tests/fixtures/linking/project/project.toml
```

## Crear un proyecto

`--new-project <filename>` escribe un manifiesto comentado y nada más.

- Añade `.toml` salvo que el nombre ya termine en `.toml` (sin distinguir
  mayúsculas y minúsculas en ASCII): `demo` → `demo.toml`, `demo.config` →
  `demo.config.toml`.
- Rechaza los nombres vacíos o con forma de directorio, la repetición y
  cualquier combinación con fuentes, `--project`, `--target`, `-o`, modos de
  comprobación/impresión u opciones del frontend.
- El directorio padre debe existir. Nunca sobrescribe (creación exclusiva);
  elimina su propio archivo parcial si falla la escritura. Imprime la ruta
  creada en caso de éxito.
- El contenido es UTF-8/LF determinista con comentarios: un destino `app`,
  `sources = []`, `source_dirs = ["src"]`, listas de opciones vacías y la salida
  por defecto de la plataforma. Se decodifica de inmediato; el usuario añade los
  fuentes bajo `src`.

## Rutas y búsqueda

- La ruta del proyecto se resuelve respecto al directorio de invocación; el
  padre léxico del manifiesto es la base de todas las rutas del manifiesto
  (incluso a través de un enlace simbólico). Las rutas absolutas siguen siendo
  absolutas; se permite `..`. No hay expansión de shell, de entorno ni de
  tilde. Para rutas de Windows se usa `/` o cadenas literales de TOML.
- Los fuentes relativos literales prueban primero la base y después
  `source_search_paths` en orden. Un candidato existente pero ilegible es un
  error. Las rutas de búsqueda solo localizan archivos enumerados; no enumeran
  módulos ni afectan a los includes.
- Comodines: `*` y `?` dentro de un componente, `**` como componente completo.
  Se rechazan corchetes, llaves, negación y escapes. El encaje distingue
  mayúsculas y minúsculas; `?` es un escalar Unicode de un nombre UTF-8 válido.
- Se incluyen las entradas ocultas; los enlaces simbólicos a directorios
  descubiertos se omiten (las raíces explícitas pueden ser enlaces simbólicos);
  los enlaces simbólicos a archivos se siguen.
- Orden: las entradas de `sources` en orden, las coincidencias de cada patrón
  ordenadas por los bytes UTF-8 de la ruta, y después cada expansión de
  `source_dirs` ordenada de la misma manera. Los literales ausentes, los patrones
  sin coincidencias y los destinos vacíos son errores.
- La deduplicación dentro de un destino usa la identidad del sistema de
  archivos (enlaces simbólicos, enlaces duros, alias por mayúsculas), y conserva
  la primera grafía. Un mismo archivo en dos destinos se compila dos veces porque
  las opciones pueden diferir.
- Solo los destinos seleccionados acceden al sistema de archivos.

## Opciones efectivas

| Ajuste | Combinación de manifiesto y CLI |
| --- | --- |
| `include_dirs` | Orden del manifiesto, después de `-I` de la CLI (el último `-I` de la CLI se busca primero) |
| `source_search_paths` | Solo búsqueda de fuentes del proyecto |
| `defines` | Primero el manifiesto, después la CLI; los duplicados entre ambos son errores |
| `applications` | Map del manifiesto; las entradas de la CLI reemplazan los nombres coincidentes |
| Listas de funcionalidades | Ajustes del manifiesto, después los cambios ordenados de la CLI; prevalece la CLI |
| `output` | Por destino, solo destinos ejecutables; `-o` de la CLI lo sustituye para un único destino seleccionado |
| `entry` | Por destino; `--entry` de la CLI lo sustituye para un único destino seleccionado |

## Dependencia de compilación

toml++ 3.4.0 (MIT), privado del compilador, solo cabeceras, con excepciones y
con la sintaxis no publicada desactivada. SHA-256 del archivo
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS: se detecta `brew install tomlplusplus` (fórmula 3.4.0).
- Windows: CMake descarga y verifica la versión publicada en `thirdparty/`.
- En otros sistemas: instalarlo, extraerlo en `thirdparty/tomlplusplus-3.4.0` o
  pasar `-DCLAUSE_TOML_ROOT=<path>` (tiene prioridad y desactiva la descarga).
- Las compilaciones solo del runtime no lo buscan.

## Límites

Tamaño del manifiesto 1 MiB; como máximo 1.024 destinos y 100.000 nodos TOML.
Cada expansión de fuentes permite 100.000 entradas visitadas, 128 niveles de
directorio y 16.000.000 de transiciones de comodines. El agotamiento es un error
explícito; son límites de trabajo, no plazos de E/S.
