---
source: docs/projects.md
sourceCommit: a8c3f8f6
sourceSha256: b1c98a208a0a72f7ad5b20a2915eb2b39a4142cc65314491f83b019398b3b85a
translatedAt: 2026-10-17
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
build_dir = "build"

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]
ignore_dirs = ["src/legacy", "deps/*/test"]
ignore_modules = ["telemetry", "*_SUITE"]
keep_exports = false
cache_inference_in_dirs = ["deps/*"]

[targets.options.applications]
my_dependency = "vendor/my_dependency"
```

- Son obligatorios `schema_version = 1` y un array `targets` no vacío. Se
  rechazan las claves desconocidas, los tipos incorrectos, los nombres de
  destino duplicados y las cadenas vacías; no hay conversión de tipos. Se valida
  el manifiesto completo, incluidos los destinos no seleccionados.
- Nombres de destino: ASCII `[A-Za-z0-9_][A-Za-z0-9_.-]*` con distinción de
  mayúsculas y minúsculas, únicos. Un nombre es un destino de compilación, no
  una tripleta de LLVM.
- `sources` (archivos y patrones comodín) y `source_dirs` (búsqueda recursiva
  de `.erl` y `.abstr`) son opcionales, pero un destino necesita al menos una
  entrada. Los archivos explícitos deben terminar en `.erl`, o en `.abstr` para
  formas en formato abstracto ([transformaciones](transforms.md#interchange));
  las cabeceras son dependencias, no entradas.
- `parse_transforms` (nombres de módulo) y `transform_paths` (directorios o
  patrones de archivos `.beam` precompilados) en `options` aplican parse
  transforms a los módulos del destino
  ([transformaciones](transforms.md#options)).
- `ignore_dirs` (rutas) e `ignore_modules` (nombres de módulo), ambos con
  comodines, en `options` dejan fuentes fuera de la compilación
  ([fuentes ignorados](#ignored-sources)).
- `keep_exports = true` en `options` mantiene invocables todas las
  exportaciones del ejecutable del destino, como hace `--keep-exports` para
  cada destino seleccionado
  ([vida de las exportaciones](executables.md#export-liveness)). Debe ser un
  booleano.
- `cache_inference_in_dirs` (comodines de directorio) en `options` añade
  directorios cuyos módulos conservan sus resultados de inferencia en la caché
  de compilación ([caché de inferencia](#inference-cache)).
- Los campos de `options` son opciones tipadas opcionales del frontend.
  `defines` usa `NAME` (= `true`) o `NAME=ERLANG_LITERAL_TERM`; los duplicados
  son errores. Una funcionalidad no puede aparecer en ambas listas de
  funcionalidades.
- `entry` (opcional) selecciona la entrada del ejecutable
  `MODULE[:FUNCTION[/ARITY]]`; véase
  [ejecutables](executables.md#entry-selection). El `--entry` de la CLI la
  sustituye para un único destino seleccionado.
- `build_dir` (opcional) es el
  [directorio de compilación](#build-directory) del destino, por defecto
  `<manifest-dir>/build`.
- `output` es el destino del ejecutable, por defecto
  `<manifest-dir>/build/<target>` (`.exe` en Windows). Un destino con `output` o
  `entry` es un destino ejecutable ([ejecutables](#executables)); `--emit` y los
  modos de comprobación/impresión ignoran las salidas de ambas claves.
- No soportado: valores por defecto en la raíz, herencia, dependencias entre
  destinos, importaciones, perfiles, paquetes, vigilancia de cambios,
  compilaciones en paralelo. Los campos solo se añaden junto con su
  comportamiento.

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
  seleccionados. Las rutas relativas de la CLI mantienen su significado
  respecto al directorio de invocación; las rutas del manifiesto son relativas
  al manifiesto.
- Sin `--emit` ni una acción de comprobación/impresión, los destinos
  ejecutables se enlazan en sus salidas ([ejecutables](#executables)); los
  demás destinos se compilan en memoria.
- `-o/--output` enlaza el destino en esa ruta en lugar de su `output`
  ([enlazado](executables.md#linking)); requiere exactamente un destino
  seleccionado.
- `--verbose` traza en stderr los archivos/includes `[pp]` y los fuentes
  `[parse]`.
- `--print-inputs` ejecuta cada destino seleccionado hasta la compilación:
  preprocesa y analiza los fuentes tras la [búsqueda](#paths-and-discovery) y
  después añade los módulos que estos nombran desde la biblioteca y
  `source_search_paths`, como hace una compilación. Imprime los fuentes del
  destino (rutas absolutas), uno por línea, y después cada fuente añadido como
  `<path> (referenced at <file>:<line>)`, el primer lugar del módulo que lo
  referencia donde se nombra; los fuentes añadidos se exploran a su vez. No se
  compila nada. Con varios destinos, cada lista sigue a una línea
  `[target <name>]`. Las entradas posicionales se imprimen tal como se dan. Los
  diagnósticos van a stderr; un error de análisis detiene la adición de módulos
  referenciados y termina con código 1. Sustituye a las demás acciones de
  comprobación/impresión y, como ellas, es incompatible con `-o`, `--entry` y
  los conmutadores de compilación.
- `--print-env` imprime la invocación completa como TOML: una tabla
  `[[targets]]` por destino seleccionado con sus fuentes resueltos, sus
  directorios de búsqueda/inclusión y sus opciones efectivas
  ([informe del entorno](compile.md#environment-report)).
- Código de salida 2: errores de uso y destinos desconocidos. Código 1: fallos
  de manifiesto, de búsqueda, del frontend o de creación. Código 0: éxito (se
  permiten advertencias).

Cada destino seleccionado es un lote de compilación independiente con sus
propias sesiones de preprocesado. La planificación (decodificar, seleccionar,
buscar, comprobar colisiones de salida) termina antes de procesar ningún
fuente; después la ejecución procesa los destinos/archivos en orden y retiene
los fallos. La salida de contenido va a stdout en orden de destino/archivo sin
encabezados (salvo las líneas de destino de `--print-inputs`); el contexto y
los diagnósticos van a stderr. Un destino con diagnósticos se nombra una sola
vez, en una línea `<manifest> [target <name>]:` antes del primero; los propios
diagnósticos (`error: file:line:col: message`) no llevan prefijo de
herramienta ni de destino.

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
  `output` (relativo al manifiesto); si no, `<manifest-dir>/build/<target>`.
  Los destinos Windows añaden `.exe` a un nombre sin extensión. Los directorios
  que faltan de las salidas del manifiesto se crean; un directorio `-o`
  explícito debe existir.
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
  `sources = []`, `source_dirs = ["src"]`, listas de opciones vacías y la
  salida por defecto de la plataforma. Se decodifica de inmediato; el usuario
  añade los fuentes bajo `src`.

## Directorio de compilación

Cada destino de proyecto tiene un directorio de compilación donde Clause guarda
sus propios archivos temporales y sus cachés: el `build_dir` del destino,
relativo al manifiesto, por defecto `<manifest-dir>/build`. `--build-dir DIR`
(relativo a la invocación) lo sustituye para todos los destinos seleccionados.
Las entradas posicionales no tienen ninguno salvo que se indique `--build-dir`.

- Los archivos temporales van bajo `<build_dir>/tmp`: los espacios de trabajo
  del cargador de parse transforms ([transformaciones](transforms.md#loader)).
  Cada ejecución elimina los suyos; puede quedar un `tmp` vacío. Sin directorio
  de compilación van al directorio temporal del sistema.
- La preparación del enlazado (`.clause-link-*`) permanece junto a la salida
  del ejecutable, porque el renombrado final debe quedarse en el volumen de la
  salida ([enlazado](executables.md#linking)).
- Los modos de comprobación e impresión (`--parse-check`, `--print-ast`, ...)
  no escriben nada fuera del directorio de compilación; las comprobaciones
  posicionales sin `--build-dir` no escriben ningún archivo.
- `--print-env` imprime el `build_dir` de cada destino (`""` cuando no hay
  ninguno).

### Cachés de compilación

Los resultados que merece la pena conservar entre ejecuciones viven bajo
`<build_dir>/cache`; `--no-cache` ni los lee ni los escribe. Son las respuestas
del cargador de parse transforms y la lista de módulos sticky del OTP
anfitrión, de modo que una compilación en caliente no arranca ningún `erl`
anfitrión para los módulos cuyas entradas de transformación no han cambiado,
el [resultado de compilación](compile.md#compile-cache) de cada lote y los
[resultados de inferencia](#inference-cache) de los módulos de los directorios
configurados.

- **Interfaz.** Los llamadores usan un único almacén interno del proyecto
  (`compiler/src/cache/
  store.hpp`): `get`/`put` por directorio de entrada, nombre de archivo, tipo
  de resultado y clave, además de `invalidate` y `prune`; nunca ven rutas. Un
  valor es la versión de formato del llamador y una lista de partes con nombre
  (una ejecución de transformación: `reply` y `output`; un resultado de
  compilación: `failed`, cada `diagnostic` y, con salidas, `triple`,
  `extension` y una parte por objeto de módulo), de modo que ningún llamador
  necesita un códec propio. Un `get` con otra versión de formato es un fallo de
  caché. Toda operación es segura desde varios hilos a la vez.
- **Disposición.** `cache/v2/cache.db` es una base de datos SQLite 3.54: tabla
  `entries` (directorio de entrada, archivo, tipo, clave, formato, último uso;
  única por dirección) y tabla `parts` (entrada, orden, nombre, tamaño, suma de
  comprobación xxh3-64, y los bytes o el nombre de un archivo blob). Las partes
  mayores de 256 KB viven en `cache/v2/blobs/<xxh3-128 of the bytes>`, de modo
  que las partes iguales (los objetos idénticos de un lote compilado con dos
  conjuntos de opciones) se almacenan una sola vez; 256 KB es el punto en el que
  las lecturas medidas dejan de favorecer a la base de datos y las escrituras
  empiezan a favorecer a los archivos (`cache_store bench` en
  `tests/compiler/cache`). Un archivo blob se escribe como archivo temporal y
  se renombra antes de que se confirme la fila que lo nombra, de modo que una
  fila nunca nombra un archivo incompleto; un fallo en medio solo deja un
  archivo huérfano.
- **Claves.** Una clave es el hash de contenido de 128 bits de todo aquello de
  lo que depende el resultado, nunca una marca de tiempo: la versión y el
  ejecutable de `clau` (ruta, tamaño, fecha de modificación, de modo que un
  `clau` recompilado falla en la caché), el tipo de resultado y, para una
  ejecución de transformación, la solicitud enviada a `erl` (las formas
  preprocesadas del módulo y sus opciones de compilación: directorios de
  inclusión, defines, funcionalidades), la versión del OTP anfitrión (`erl` y
  los archivos `releases/*/OTP_VERSION` junto a él), cada fuente de
  transformación del proyecto compilado para la ejecución con los archivos que
  incluye, y cada `.beam` de las rutas de código de las transformaciones. La
  versión de formato del almacén es el directorio `v<format>`; la versión de
  formato propia de un valor se guarda en su fila. Como la clave cubre las
  formas preprocesadas, un cambio en una cabecera, un define o una
  funcionalidad, o una cabecera nueva que oculta una incluida, provoca fallos
  de caché exactamente en los módulos cuyas formas u opciones cambian; los
  defines y las funcionalidades son opciones de compilación que ve toda
  transformación, así que provocan fallos en todos los módulos transformados;
  un `.beam` modificado provoca fallos en todos los módulos cuyas
  transformaciones se ejecutan con esa ruta de código.
- **Concurrencia.** La base de datos funciona en modo de registro de escritura
  anticipada (write-ahead log) con `synchronous=NORMAL`: los lectores se
  ejecutan junto a un escritor, y los escritores (una transacción por `put`) se
  esperan entre sí hasta 30 s. Varios procesos `clau` que comparten un
  directorio de compilación conservan todas las entradas. Dentro de un proceso,
  un mutex serializa los hilos que comparten un almacén.
- **Daños.** Las partes llevan tamaños y sumas de comprobación, y los archivos
  blob se comprueban frente a sus nombres: una parte dañada o un archivo blob
  ausente es un fallo de caché (`damaged entry`) y su entrada se descarta. Un
  `cache.db` basura, truncado o ajeno (SQLite lo notifica como corrupto o como
  no base de datos, o su application id o versión de esquema difieren) se
  renombra a `cache.db.damaged` y se crea de nuevo; cuando eso no es posible,
  la ejecución continúa sin caché. Nada de esto es un error, y `--verbose` lo
  anota como `[cache] ...`.
- **Sistemas de archivos de red.** El registro de escritura anticipada necesita
  memoria compartida entre procesos, que los sistemas de archivos de red no
  proporcionan. Cuando SQLite no puede entrar en modo WAL, el almacén usa su
  diario de reversión (rollback journal; los lectores esperan entonces a un
  escritor) y `--verbose` lo indica una vez; cuando ningún modo de diario
  funciona, la ejecución continúa sin caché.
- **Poda.** Al final de una ejecución que escribió en un almacén, se eliminan
  las entradas no usadas en 30 días, después los archivos blob que ninguna
  entrada nombra (una vez que tienen más de 10 minutos, para que sobreviva el
  archivo nuevo de un escritor concurrente), y las páginas liberadas se
  devuelven al sistema de archivos (vacuum incremental). Cada ejecución elimina
  un árbol `cache/v1` sobrante del antiguo backend de archivos.
- **Observabilidad.** `--print-stage-times` marca las etapas reutilizadas
  (`[time] transform src/a.erl: 7.254 ms (cached)`); `--verbose` imprime
  `[cache] hit|miss <kind> <file>` con el motivo de un fallo de caché
  (`no entry`, `inputs changed`, `damaged entry`). Los diagnósticos y la salida
  de las transformaciones son los mismos con y sin acierto: se almacenan con la
  entrada.
- **Sin caché:** el preprocesado y el análisis sintáctico (cargar un resultado
  en caché a través de las formas abstractas, `transforms/import`, resultó más
  lento en las mediciones que volver a analizar), y las exploraciones de
  directorios: la planificación está dominada por la apertura e identificación
  de cada fuente, que una caché de exploración no puede evitar.

### Caché de inferencia

Los módulos de biblioteca (los fuentes de `stdlib`, `kernel`, `compiler` y
`syntax_tools` de OTP encontrados a través de `source_search_paths`, y la
[biblioteca](library.md) propia de Clause) rara vez cambian, por lo que los
módulos de los directorios configurados conservan sus resultados de inferencia
de tipos en la caché de compilación, por módulo, y las compilaciones
posteriores los reutilizan en lugar de volver a inferirlos.

- Directorios: los patrones implícitos de aplicaciones de OTP `*/stdlib`,
  `*/stdlib-*`, `*/kernel`, `*/kernel-*`, `*/compiler`, `*/compiler-*`,
  `*/syntax_tools` y `*/syntax_tools-*`, después el `cache_inference_in_dirs`
  del destino y después cada `--cache-inference-in-dirs PATTERN` (repetible;
  también para entradas posicionales). Los patrones usan los
  [comodines](#paths-and-discovery) de `sources`; se aceptan los separadores de
  Windows.
- Un módulo queda cubierto cuando un directorio que contiene su fuente encaja
  con un patrón. Un patrón relativo encaja con los directorios finales de
  cualquier ruta, no con rutas bajo el directorio del manifiesto: `*/stdlib`
  cubre `/usr/lib/erlang/lib/stdlib/src/lists.erl` y
  `references/otp/lib/stdlib/src/lists.erl`, mientras que un
  `.../lib/stdlib-7.0/src/lists.erl` instalado necesita `*/stdlib-*`. Un patrón
  absoluto encaja con la ruta completa del directorio
  (`C:/Program Files/Erlang OTP/lib/*`). El encaje es léxico y distingue
  mayúsculas y minúsculas. Los patrones implícitos cubren también un directorio
  propio del proyecto con uno de esos nombres (`apps/compiler`), lo que solo
  almacena más entradas: la reutilización es correcta para cualquier módulo.
- `--print-env` imprime la lista efectiva como `cache_inference_in_dirs`, con
  los patrones implícitos primero. Una construcción no soportada (`[`, `{`,
  `!`) es un error de manifiesto, o un error de uso (código 2) en la línea de
  órdenes.
- La reutilización necesita un directorio de compilación (todo destino de
  proyecto; entradas posicionales con `--build-dir`) y se desactiva con
  `--no-cache`. Funciona para toda acción que analiza (compilación,
  ejecutables, `--print-types`, inspecciones del IR), también cuando la
  [caché de compilación](compile.md#compile-cache) del lote falla.
- Clave: la identidad de `clau`, la huella del módulo y las de todos los
  módulos del lote que nombran sus átomos, de forma transitiva (llamadas
  remotas, `fun M:F/A`, `apply`, cualquier átomo que sea un nombre de módulo);
  véase [semántica: caché de inferencia](semantic.md#inference-cache) para
  saber por qué solo de eso dependen sus hechos. Editar un módulo de usuario
  conserva por tanto los aciertos de la biblioteca salvo que un módulo de
  biblioteca lo nombre; editar un módulo de biblioteca provoca un fallo en él y
  en todo módulo cubierto que lo alcanza.
- Las entradas se guardan por directorio de fuentes, archivo y destino de
  proyecto (tipo `inference@<target>`, `inference@positional`); un valor es una
  parte `results` (`semantic/types/inference_store`: nodos del grafo,
  resúmenes y entradas locales por función, hechos de expresiones por posición
  sintáctica). Los resultados guardados por una compilación con más funciones
  vivas (por ejemplo `--print-types`) sirven a un ejecutable que conserva
  menos.
- `--verbose` imprime `[cache] hit|miss inference <file>` por módulo cubierto
  (motivos de fallo: `no entry`, `inputs changed`, `damaged entry`,
  `results do not fit` para resultados guardados a los que les falta una
  función que ahora está viva); `--print-stage-times` imprime las fases
  `inference-cache` (con `N of M covered modules reused`) e
  `inference-store`.

## Rutas y búsqueda

- La ruta del proyecto se resuelve respecto al directorio de invocación; el
  padre léxico del manifiesto es la base de todas las rutas del manifiesto
  (incluso a través de un enlace simbólico). Las rutas absolutas siguen siendo
  absolutas; se permite `..`. No hay expansión de shell, de entorno ni de
  tilde. Para rutas de Windows se usa `/` o cadenas literales de TOML.
- Los fuentes relativos literales prueban primero la base y después
  `source_search_paths` en orden. Un candidato existente pero ilegible es un
  error. Las rutas de búsqueda no enumeran módulos ni afectan a los includes.
- Cuando los fuentes del destino nombran un módulo que ninguno de ellos define
  (una llamada remota, `fun M:F/A`, `apply` con un módulo literal,
  `-behaviour` o `-import`), se busca `Module.erl` primero en la
  [biblioteca](library.md#how-programs-get-them) de Clause y después en las
  rutas de búsqueda en orden (un OTP instalado nunca sustituye a un módulo de
  Clause, y un módulo que Clause registra como ausente nunca se toma de una
  ruta de búsqueda:
  [resolución](library.md#which-module-a-name-resolves-to)); un archivo
  encontrado se une al destino como un fuente enumerado, y sus propias
  referencias se resuelven de la misma manera. Un fuente enumerado con el
  nombre de un módulo de Clause lo sustituye, con una advertencia.
- Comodines: `*` y `?` dentro de un componente, `**` como componente completo.
  Se rechazan corchetes, llaves, negación y escapes. El encaje distingue
  mayúsculas y minúsculas; `?` es un escalar Unicode de un nombre UTF-8 válido.
- Se incluyen las entradas ocultas; los enlaces simbólicos a directorios
  descubiertos se omiten (las raíces explícitas pueden ser enlaces simbólicos);
  los enlaces simbólicos a archivos se siguen.
- Orden: las entradas de `sources` en orden, las coincidencias de cada patrón
  ordenadas por los bytes UTF-8 de la ruta, y después cada expansión de
  `source_dirs` ordenada de la misma manera. Los literales ausentes, los
  patrones sin coincidencias y los destinos vacíos son errores.
- La deduplicación dentro de un destino usa la identidad del sistema de
  archivos (enlaces simbólicos, enlaces duros, alias por mayúsculas), y
  conserva la primera grafía. Un mismo archivo en dos destinos se compila dos
  veces porque las opciones pueden diferir.
- Solo los destinos seleccionados acceden al sistema de archivos.

### Índice de directorios

Las búsquedas por nombre no prueban cada directorio candidato. Un único índice
por invocación de `clau`, compartido por todos los destinos, guarda los nombres
de las entradas de cada directorio explorado: se enumera una vez, de forma no
recursiva, cuando una búsqueda lo necesita por primera vez, o lo registran los
recorridos recursivos que expanden `**` en `sources`, `source_dirs`,
`source_search_paths`, `include_dirs` y `transform_paths`, de modo que ningún
directorio se enumera dos veces. Responde a los fallos de la búsqueda de
módulos (la biblioteca y después `source_search_paths`), a los fuentes de
transformaciones, a los `sources` literales encontrados a través de
`source_search_paths` y a la resolución de includes (el directorio del archivo
que incluye, el directorio de trabajo, los directorios de inclusión en orden y
después las aplicaciones de `include_lib`); un candidato que contiene el índice
se sigue abriendo o comprobando como antes, por lo que la precedencia,
`ignore_dirs` y los informes de error no cambian. Los nombres de include con
partes de directorio (`sub/x.hrl`) se buscan en el directorio que nombran; los
nombres con pasos `..`, los nombres absolutos, los directorios relativos y las
enumeraciones que fallan se prueban como antes.

- Las claves de nombre de archivo pliegan las mayúsculas ASCII en Windows y
  macOS, cuyos volúmenes ignoran por defecto la diferencia entre mayúsculas y
  minúsculas, de modo que `Foo.hrl` sigue encontrando `foo.hrl`; en los demás
  sistemas las claves son exactas. Los nombres que el plegado no puede
  emparejar con exactitud (allí los nombres no ASCII y, en Windows, los nombres
  que terminan en `.` o en un espacio o que contienen `~`, que pueden ser
  nombres cortos 8.3) se prueban.
- El índice es una instantánea de una invocación: los archivos que aparecen
  mientras `clau` se ejecuta (preparación del enlazado, salidas) nunca son
  entradas de búsqueda.
- `--verbose` termina con
  `[index] listed=N walked=N lookups=N misses=N probes=N` (directorios
  enumerados bajo demanda, enumeraciones registradas por recorridos, búsquedas
  que respondió el índice y los fallos entre ellas, búsquedas que quedaron para
  una prueba).

## Fuentes ignorados

`ignore_dirs` e `ignore_modules` mantienen fuentes fuera de un destino sin
quitarlos del árbol, por ejemplo pruebas incluidas de terceros, código heredado
o módulos que solo importan con OTP. Un fuente ignorado se omite en silencio:
nunca se lee, analiza, compila ni enlaza, por lo que puede incluso contener
errores de sintaxis.

- `ignore_dirs`: rutas relativas al manifiesto (o absolutas) con los
  [comodines](#paths-and-discovery) de `sources`. Un fuente se ignora cuando su
  ruta, o un directorio que lo contiene, encaja: `src/legacy`, `deps/*/test`,
  `**/test` (cualquier directorio `test`), `src/*_SUITE.erl`. El encaje es
  léxico; un patrón no tiene por qué encajar con nada.
- `ignore_modules`: nombres de módulo, o patrones de nombre con `*` y `?` que
  se comparan con el nombre completo (`*_SUITE`, `legacy_*`, `prim_???`). Un
  fuente llamado `<Module>.erl` (o `.abstr`) se ignora cuando una entrada
  encaja con `<Module>`, y un módulo referenciado que encaja nunca se busca.
  Esto incluye los
  [módulos de biblioteca](library.md#which-module-a-name-resolves-to) de
  Clause.
- Un fuente que `sources` enumera literalmente (sin comodín) nunca se ignora:
  las reglas no tienen efecto sobre él, y la compilación advierte
  `listed in sources but matched by ignore_modules or ignore_dirs; ignoring it has no effect`.
  Las coincidencias de comodines y `source_dirs` se ignoran como se ha
  descrito.
- Ambos se aplican a `sources`, `source_dirs`, los fuentes literales
  encontrados a través de `source_search_paths`, la
  [búsqueda de módulos](#paths-and-discovery) en `source_search_paths` y en la
  biblioteca, y la búsqueda de
  [fuentes de parse transforms](transforms.md#transform-modules). Una búsqueda
  pasa por alto un `Module.erl` ignorado y sigue buscando en los directorios
  posteriores.
- Un módulo se ignora cuando `ignore_modules` lo nombra, o cuando ningún fuente
  del lote lo define y los únicos fuentes encontrados para él se ignoraron (por
  búsqueda, u omitidos de los fuentes del destino, por nombre de archivo). Un
  módulo definido por un fuente compilado nunca se ignora.
- Las referencias a un módulo ignorado (`M:F(...)`, `-import`, `fun M:F/A`,
  `apply(M, F, [...])` con nombres literales) llegan a un módulo de reemplazo
  generado `M` que exporta cada función nombrada de esta forma; cada una
  devuelve `{module_ignored, M}` en lugar de ejecutarse. Una función que el
  lote nunca nombra literalmente sigue siendo `undef` para las llamadas
  dinámicas. Un tipo de un módulo ignorado nombrado en un spec o un tipo
  (`helper:result()`) advierte
  `attempt to import a type from a module ignored in project settings: helper:result`
  y se trata como `term()`. `-behaviour(M)` con un `M` ignorado advierte
  `behaviour M undefined`.
- `--print-inputs` enumera cada módulo referenciado ignorado después de los
  fuentes añadidos como `ignored module <name> (referenced at <file>:<line>)`;
  `--print-env` imprime ambas claves.

```toml
[targets.options]
source_search_paths = ["deps/**"]
ignore_dirs = ["deps/*/test", "src/legacy"]
ignore_modules = ["telemetry", "*_SUITE"]
```

## Opciones efectivas

| Ajuste | Combinación de manifiesto y CLI |
| --- | --- |
| `include_dirs` | Orden del manifiesto, después de `-I` de la CLI (el último `-I` de la CLI se busca primero); una entrada con comodines (`deps/*/include`, `apps/**/include`) se expande en su sitio a los directorios existentes con los que encaja, ordenados por los bytes UTF-8 de la ruta (`**` también encaja con ninguno, los enlaces simbólicos a directorios se omiten); un patrón sin coincidencias es un error |
| `source_search_paths` | Raíces de reserva para los fuentes literales y para los módulos que el destino nombra pero no enumera; los patrones se expanden como en `include_dirs` (sin coincidencias: `unmatched source search path pattern`) |
| `defines` | Primero el manifiesto, después la CLI; los duplicados entre ambos son errores |
| `applications` | Map del manifiesto; las entradas de la CLI reemplazan los nombres coincidentes |
| Listas de funcionalidades | Ajustes del manifiesto, después los cambios ordenados de la CLI; prevalece la CLI |
| `output` | Por destino, solo destinos ejecutables; `-o` de la CLI lo sustituye para un único destino seleccionado |
| `entry` | Por destino; `--entry` de la CLI lo sustituye para un único destino seleccionado |
| `cache_inference_in_dirs` | Patrones implícitos de OTP, después los del manifiesto y después `--cache-inference-in-dirs` de la CLI ([caché de inferencia](#inference-cache)) |

## Dependencia de compilación

toml++ 3.4.0 (MIT), privado del compilador, solo cabeceras, con excepciones y
con la sintaxis no publicada desactivada. SHA-256 del archivo
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS: se detecta `brew install tomlplusplus` (fórmula 3.4.0).
- Windows: CMake descarga y verifica la versión publicada en `thirdparty/`.
- En otros sistemas: instalarlo, extraerlo en `thirdparty/tomlplusplus-3.4.0` o
  pasar `-DCLAUSE_TOML_ROOT=<path>` (tiene prioridad y desactiva la descarga).
- Las compilaciones solo del runtime no lo buscan.

La [caché de compilación](#build-caches) usa la amalgamación de SQLite 3.54.0
(dominio público), compilada solo en la biblioteca de caché del compilador
(`clause_sqlite`, sin los flags de advertencias del proyecto). CMake descarga
`https://www.sqlite.org/2026/sqlite-amalgamation-3540000.zip` en
`thirdparty/` en todos los anfitriones y verifica su SHA-256
`68e913b0fe8ec6b4e5f391c594a28872884e80d6cd042a1e50c957be46b5aa4d`;
`-DCLAUSE_SQLITE_ROOT=<directory with sqlite3.c and sqlite3.h>` tiene
prioridad y desactiva la descarga.

## Límites

Tamaño del manifiesto 1 MiB; como máximo 1.024 destinos y 100.000 nodos TOML.
Cada expansión de fuentes permite 100.000 entradas visitadas, 128 niveles de
directorio y 16.000.000 de transiciones de comodines. El agotamiento es un
error explícito; son límites de trabajo, no plazos de E/S.
