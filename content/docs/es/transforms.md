---
source: docs/transforms.md
sourceCommit: 6ed3851c
sourceSha256: 2c6d8c271fd5fd640bb4c93eaff0872914f396898bfe9df527ca51055d033c11
translatedAt: 2026-10-15
---
# Parse transforms

## Uso de parse transforms

- **Requisito:** Erlang/OTP 29 instalado en el host, solo para compilar
  módulos que usan una transformación. `clau` toma `--erl PATH`; si no, `erl`
  del `PATH`; si no, en Windows, `%ProgramFiles%\Erlang OTP\bin\erl.exe`.
  `--erl none` nunca ejecuta código del host: los módulos que necesitan una
  transformación fallan.
- **Invocar una transformación** en el código fuente con
  `-compile({parse_transform, Module}).` (o dentro de una lista
  `-compile([...])`), o para todos los módulos de la orden con
  `--parse-transform Module` (repetible; estas se ejecutan primero, como
  `erlc +'{parse_transform,M}'`).
- **Los módulos de transformación** se buscan como archivos `.beam` en los
  directorios de `--transform-path` (repetible) y en los `transform_paths` del
  proyecto, después como `Module.erl` entre los fuentes del lote y los
  `source_search_paths` (compilados por el OTP del host en cada compilación,
  con los módulos a los que llaman desde allí; se aplican `ignore_dirs` e
  `ignore_modules`), y después entre los módulos de OTP (`ms_transform`,
  `qlc`).
- **Precompilar** una transformación que procede de otra biblioteca (siempre),
  o una transformación del proyecto que el compilador del host no puede
  construir con los directorios de include y las definiciones del destino:
  `erlc -o deps/lib/ebin deps/lib/src/*.erl` con el OTP del host, y después
  nombrar `deps/lib/ebin` con `--transform-path` o en `transform_paths`. El
  `.beam` debe proceder de la versión de OTP del host; un `.beam` allí
  prevalece sobre un fuente del mismo módulo.
- **Qué la ejecuta:** la compilación, `--print-ast`, `--print-source` y
  `--print-abstr` (que muestra las formas transformadas); `--parse-check`,
  `--preprocess-check` y `--print-pp` no.

```sh
clau --erl "C:/Program Files/Erlang OTP/bin/erl.exe" --transform-path ebin -o app app.erl
```

Clause aplica `{parse_transform, Module}` como lo hace `erlc`. Exporta el
módulo analizado como formas del
[formato abstracto](https://www.erlang.org/doc/apps/erts/absform.html) de OTP,
ejecuta el módulo de transformación en un Erlang/OTP 29 instalado en el host,
importa las formas devueltas como la nueva sintaxis del módulo y compila eso.
OTP solo se necesita mientras se compila un módulo que usa una
transformación; los programas generados nunca lo necesitan. Decidido en el
plan step 73A; implementado por los steps 73B–73G
(`compiler/src/transforms/`).

## Comportamiento de OTP

A partir de `lib/compiler/src/compile.erl` fijado (`transform_module`,
`foldl_transform`, `maybe_strip_columns`) y observado con OTP 29.1.1:

- Las transformaciones se ejecutan como la primera pasada estándar: después
  de `epp` y del análisis sintáctico, antes de `erl_lint` y antes de que
  `erl_internal` añada `module_info/0,1` y `behaviour_info/1`.
- La lista de transformaciones es cada `{parse_transform, M}` de las opciones
  de compilación (`erlc +'{parse_transform,m}'`) y después de los atributos
  `-compile` en orden de formas. Una transformación nombrada dos veces se
  ejecuta dos veces. Antes de que se ejecute la primera, esas opciones se
  eliminan de las formas: un atributo `-compile` que solo contiene la opción
  desaparece, y una lista pierde el elemento.
- `M` debe cargarse (`code:ensure_loaded/1`) y exportar `parse_transform/2`;
  si no, se produce el error `undefined parse transform 'M'` (sin ubicación).
- `M:parse_transform(Forms, Options)` recibe las formas y las opciones de
  compilación (no las opciones `-compile` del fuente): `{features, Enabled}`,
  `report_warnings`, `report_errors`, `{cwd, Dir}`, `{outdir, Dir}`,
  `{i, Dir}` por directorio de include, `{d, Name[, Value]}` por definición,
  más cualquier `{parse_transform, M}` dado como opción.
- Devuelve `Forms`, `{warning, Forms, Warnings}` o
  `{error, Errors, Warnings}`, donde cada lista es
  `[{File, [{Location, Module, Descriptor}]}]` formateada por
  `Module:format_error(Descriptor)`. Una excepción es el error
  `error in parse transform 'M': ...` (`compile:format_error/1` de
  `{parse_transform, M, {Class, Reason, Stack}}`). La siguiente transformación
  recibe las formas de la anterior; el primer error detiene la cadena.
- `M:parse_transform_info/0` que devuelve `#{error_location => line}`, o la
  opción de compilación `{error_location, line}`, elimina las columnas de las
  formas antes de que se ejecute `M` y de las formas finales.
- Las formas llevan anotaciones `{Line, Column}`. `epp` añade primero
  `{attribute, {1,1}, file, {File, 1}}`, lo mismo para cada archivo incluido
  cuando empieza, y `{attribute, {L,1}, file, {File, L}}` cuando el archivo
  que incluye continúa en la línea `L`, la línea siguiente a su `-include`.
  Las definiciones de macros y otras directivas no dejan ninguna forma. La
  lista termina con `{eof, Location}`, el final del archivo principal. Los
  errores del preprocesador y del análisis sintáctico permanecen en la lista
  como formas `{error, E}` y `erl_lint` los informa tras las transformaciones.
- Formas de OTP 29 que `absform.md` no enumera: `{attribute, A, native_record,
  {Name, Fields}}`; nombres de record `{Module, Name}` (cualificados) y `[]`
  (`#_`) en expresiones `record`/`record_field`; `{type, A, record, [{tuple, A,
  [Module, Name]} | Fields]}` para los tipos de record cualificados; los
  calificadores de comprehension `{zip, A, Qualifiers}`; `{mc, ...}`,
  `m_generate` y los generadores `_strict`.
- `erlc +to_abstr` escribe las formas tras las transformaciones (y
  `erl_lint`) en `File.abstr`, un término `~p.` por forma; `erlc File.abstr`
  (`compile:file(F, [from_abstr])`) compila un archivo así sin preprocesador
  ni analizador sintáctico.

## Cadena de Clause

1. Preprocesar y analizar el módulo. Los errores del preprocesador o del
   análisis sintáctico se detienen aquí; las transformaciones no se ejecutan
   sobre un módulo con errores (difiere de OTP, que pasa los errores como
   formas).
2. Reunir las transformaciones en el orden de OTP: las opciones
   `--parse-transform` y los `parse_transforms` del proyecto y después los
   atributos `-compile`. Un módulo sin ninguna omite el resto y nunca arranca
   OTP.
3. Eliminar esas opciones de las formas y exportarlas: anotaciones
   `{Line, Column}` tal como las asigna `erl_parse`, los atributos `file` de
   `epp` y `eof`. Las funciones predefinidas aún no forman parte de las
   formas.
4. Ejecutar el [cargador](#loader) una vez para el módulo.
5. Importar las formas devueltas convirtiéndolas en tokens ubicados en sus
   anotaciones y analizándolos con el analizador sintáctico de Clause; un
   atributo `file` cambia el archivo de las formas siguientes como en
   `erl_lint`.
6. Añadir las funciones predefinidas y después ejecutar lint, analizar y
   compilar como de costumbre.

Las transformaciones se ejecutan cuando se compila un módulo y para
`--print-ast`, `--print-source` y `--print-abstr`, que imprimen el módulo
transformado. `--preprocess-check`, `--parse-check` y `--print-pp` no las
ejecutan.

## Intercambio

- `clau` y el cargador intercambian archivos en External Term Format
  (`term_to_binary`, versión 131, sin comprimir): flotantes exactos, átomos
  UTF-8, enteros grandes y ningún análisis de texto en Erlang. El formato en
  sí (etiquetas, disposiciones, comprobaciones de límites) vive una sola vez
  en `abi/include/clause/abi/external_term.hpp`, independiente de cualquier
  representación de términos, de modo que los futuros `term_to_binary/1`,
  `binary_to_term/1` y la distribución del runtime lo reutilicen. El modelo de
  términos del compilador de Clause contiene átomos, enteros, flotantes,
  listas propias e impropias, tuplas, maps y bitstrings; los pids, puertos,
  referencias y funs se rechazan con un diagnóstico.
- El texto `.abstr` es la sintaxis de
  [`file:consult/1`](https://www.erlang.org/doc/apps/kernel/file.html#consult/1):
  un término por forma, cada uno terminado en `.`. `--print-abstr` imprime en
  stdout las formas de cada módulo tras las transformaciones en esa sintaxis,
  una forma por línea; un archivo de entrada `.abstr` se compila como
  `erlc File.abstr`. Clause escribe texto canónico, no la disposición `~p` de
  OTP; lo que importa es que los términos sean iguales. Las formas son iguales
  a `epp:parse_file(F, [{location, {1, 1}}])` para cada construcción de
  `tests/fixtures/transforms/abstract/`, incluidos los atributos `file` de
  `epp` (un `-file` explícito se anota
  `[{generated, true}, {location, L}]`) y un `eof` contado desde el último
  `-file` del archivo principal.

## Importación de formas

Las formas devueltas, y las entradas `.abstr` (posicionales o `sources` del
proyecto), se convierten en tokens ubicados en sus anotaciones y pasan por el
analizador sintáctico de Clause, de modo que reciben las mismas comprobaciones
de sintaxis que el código fuente; la precedencia de los operadores decide
dónde se añaden paréntesis. Se aceptan `{Line, Column}`, un `Line` aislado
(mostrado como `file:line:`) y listas de propiedades con `location` y `file`;
`generated` se ignora. Un atributo file cambia el archivo de las formas
siguientes; cuando ese archivo existe, el código importado conserva sus líneas
de depuración y sus comentarios de fuente. Las formas mal formadas son errores
en su anotación (`unknown expression bogus`, `expected {Name, Arity}`,
`invalid annotation`) y el módulo falla; las formas `{error, _}`/`{warning, _}`
de OTP se informan con su descriptor, que necesita OTP para formatearse.
Importar un módulo exportado y volver a exportarlo da las mismas formas.

## OTP del host

- `erl` se busca en este orden: `--erl PATH`, `erl` del `PATH` y después, en
  Windows, `%ProgramFiles%\Erlang OTP\bin\erl.exe`. No encontrarlo cuando un
  módulo necesita una transformación es un error que nombra la transformación
  y el módulo; no hay alternativa que omita las transformaciones.
- El host debe ejecutar OTP 29 (`erlang:system_info(otp_release)`); otra
  versión es un error.
- El [cargador](#loader) se ejecuta como
  `erl -noshell -noinput -pa Dir ... -eval ...` (con los directorios de la
  ruta de código convertidos en absolutos) con un límite de tiempo de 600 s.
  Su stdout y su stderr (incluida la salida `io:format` de la transformación)
  se copian al stderr de `clau` cuando termina. Un cargador que termina sin
  escribir una respuesta, agota el tiempo o no puede arrancar es un error.
- Una transformación ejecuta código arbitrario con los permisos del usuario,
  exactamente como lo haría con `erlc`.

## Cargador

`compiler/src/transforms/loader/clause_transform_loader.erl` es propio del
proyecto y está incrustado en `clau`. Cada ejecución lo escribe junto con la
petición en un directorio temporal nuevo, `clause-transform-*` bajo
`<build_dir>/tmp` ([directorio de compilación](projects.md#build-directory))
o, para entradas posicionales sin `--build-dir`, el directorio temporal del
sistema, que se elimina tras la ejecución; `erl` compila y carga el cargador
en memoria. La petición contiene las formas, las opciones, la lista de
transformaciones, el nombre de archivo del módulo y los fuentes de
transformaciones del proyecto que hay que compilar. Con un directorio de
compilación, la respuesta y la salida del cargador se conservan en la
[caché de compilación](projects.md#build-caches) y se reutilizan mientras la
petición y todo aquello de lo que depende no cambien; la lista de módulos
sticky del host se conserva del mismo modo. El cargador:

1. comprueba la versión de OTP;
2. compila en memoria los fuentes de transformaciones del proyecto pedidos y
   los carga;
3. para cada transformación: la carga, elimina las columnas según pida
   `parse_transform_info/0`, llama a `parse_transform/2` y formatea las
   advertencias y los errores como `{File, Location, Text}` con
   `Module:format_error/1`;
4. escribe `{ok, Forms, Warnings}` o `{error, Errors, Warnings}` y se detiene.

## Módulos de transformación

Un módulo de transformación se busca en este orden:

1. **Archivos `.beam` precompilados** en los directorios de
   `--transform-path DIR` (repetible) y de la opción de proyecto
   `transform_paths`, que van en la ruta de código del cargador antes que los
   de OTP. Es la única manera de usar una transformación que procede de una
   biblioteca de dependencias: primero se compila esa biblioteca con el OTP
   del host (por ejemplo `erlc -o deps/lib/ebin deps/lib/src/*.erl`); Clause
   nunca compila dependencias. El `.beam` debe proceder de la versión mayor de
   OTP del host.
2. **Los fuentes del proyecto actual**: un `Module.erl` en el lote o en sus
   `source_search_paths`, compilado por el cargador en memoria con los
   directorios de include y las definiciones del destino en cada ejecución,
   junto con los módulos del proyecto a los que llama por nombre (encontrados
   del mismo modo). La búsqueda pasa por alto los fuentes que `ignore_dirs` o
   `ignore_modules` excluyen, como hace la
   [búsqueda de módulos](projects.md#ignored-sources). Clause busca estos
   fuentes una vez por lote y los conserva en memoria; el cargador sigue
   compilándolos para cada módulo sobre el que se ejecuta la transformación,
   así que conviene precompilar una transformación grande para ahorrar ese
   tiempo. Los módulos que el host carga desde sus directorios sticky
   (`kernel`, `stdlib`, `compiler`, como `ms_transform` o `qlc_pt` cuando los
   fuentes de OTP están en una ruta de búsqueda) no pueden recargarse, así que
   se usan los propios módulos del host: sus fuentes, y los módulos a los que
   solo ellos llaman, no se buscan ni se compilan. Clause pregunta al `erl`
   del host por estos módulos una vez por invocación.
3. **Los propios módulos de OTP** (`ms_transform`, `qlc`) de la ruta de
   código del host. OTP incluye `erl_id_trans` solo como fuente de ejemplo, no
   como módulo. Sus cabeceras se resuelven como cualquier `include_lib`
   ([preprocesador](preprocessor.md#compatibility-policies)): se asocia la
   aplicación, como en
   `--app-dir "stdlib=C:/Program Files/Erlang OTP/lib/stdlib-8.1"` para
   `include_lib("stdlib/include/ms_transform.hrl")`, o se nombra la
   transformación directamente con `-compile({parse_transform, ms_transform})`.

Compilar una transformación del proyecto puede fallar donde su compilación
real tiene éxito: cabeceras de dependencias, una transformación de la
transformación o macros que solo define otra herramienta de compilación.
Clause informa entonces de los mensajes del compilador sobre el fuente de la
transformación con la indicación de precompilarla en un `.beam` con el OTP del
host y pasar su directorio con `--transform-path`. Clause también compila una
transformación del proyecto como módulo ordinario cuando forma parte del lote;
sus propias llamadas (`erl_syntax`, `erl_parse`, ...) pueden entonces
necesitar módulos de biblioteca que Clause no incluye, así que conviene dejar
las transformaciones fuera de los `sources` de un destino cuando solo la
transformación los necesita.

## Diagnósticos

| Situación | Mensaje |
| --- | --- |
| Sin OTP en el host | `File: parse transform 'M' needs Erlang/OTP 29 on the host; pass --erl` |
| `--erl` no nombra ningún ejecutable | `File: erl not found: PATH` |
| Versión de OTP incorrecta | `parse transforms need Erlang/OTP 29 on the host, found N` |
| Transformación no encontrada | `File: undefined parse transform 'M'` (texto de OTP) |
| La transformación lanzó una excepción | `File: error in parse transform 'M': ...` (texto de OTP) |
| Advertencia o error de la transformación | `File:Line:Column: Text` tal como se devuelve |
| El fuente de la transformación no compila | sus mensajes y después la indicación de precompilar |
| Una ruta de transformaciones no existe | `File: parse transform path is not a directory: DIR` |
| Un `.beam` de una ruta de transformaciones no se carga | `File: cannot load parse transform 'M' from PATH: Reason` |
| El cargador falló, agotó el tiempo o no escribió respuesta | `parse transform loader failed: ...` |
| Formas devueltas no válidas | el diagnóstico del analizador sintáctico en la ubicación de la forma |

## Opciones

| CLI | Proyecto (`[targets.options]`) | Significado |
| --- | --- | --- |
| `--parse-transform M` | `parse_transforms = ["m"]` | Aplica `M` a todos los módulos, antes de sus propias transformaciones de `-compile` (primero las de la CLI) |
| `--transform-path DIR` | `transform_paths = ["deps/*/ebin"]` | Ruta de código para los archivos `.beam` de transformaciones precompiladas; patrones como en `source_search_paths` |
| `--erl PATH` o `none` | — | Ejecutable `erl` del host; `none` nunca ejecuta código del host |
| `--print-abstr` | — | Imprime las formas tras las transformaciones en lugar de compilar |

Un proyecto que usa su propia transformación y una precompilada procedente de
una dependencia:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[targets.options]
source_search_paths = ["transforms"]  # transforms/pt_rewrite.erl, compiled for each build
parse_transforms = ["pt_dep"]         # applied to every module of the target
transform_paths = ["deps/*/ebin"]     # deps/ptdep/ebin/pt_dep.beam, built with erlc first
```

Conviene dejar los módulos de transformación fuera de los `sources` de un
destino cuando el programa no los llama: como módulos ordinarios, Clause
también los compilaría, y sus llamadas a `erl_parse` o `erl_syntax` necesitan
módulos que Clause no incluye.
