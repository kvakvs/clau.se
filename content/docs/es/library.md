---
source: docs/library.md
sourceCommit: 6ed3851c
sourceSha256: 827659aa3cf1548562f97b6e8d7a37e0f230599570a6c78628cd7a72896102f9
translatedAt: 2026-10-15
---
# Módulos de biblioteca

Un subconjunto propio del proyecto de los módulos `lists` y `maps` de OTP,
escrito en Erlang a partir del comportamiento documentado de OTP (no copiado
de los fuentes de OTP) y compilado junto con los programas que lo usan.

## Contenido

| Módulo | Funciones |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1`, `foreach/2`, `mapfoldl/3`, `mapfoldr/3`, `partition/2`, `splitwith/2`; builtins del runtime `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`, `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2`, `keymember/3`, `keysearch/3`, `keydelete/3` ([módulo lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1`, `filter/2`, `map/2`, `foreach/2`, `update_with/3,4`; builtins del runtime `get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`, `without/2`, `from_keys/2` ([módulo maps](builtins.md#maps-module)) |
| [`file`](../library/kernel/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2,3`, `read_file_info/1,2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` sobre el driver de archivos ([archivos](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor de entrada estándar o un archivo abierto), `request/1,2`, `requests/1,2` (el protocolo de E/S de OTP, [archivos](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` y `nl/0,1` son builtins del runtime ([io](io.md)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` sobre puertos de socket ([sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/kernel/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/kernel/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Propio de Clause: el protocolo del driver de sockets que comparten los tres módulos anteriores |
| [`erlang`](../library/erts/erlang.erl) | Stubs generados de todas las exportaciones de `erlang` de OTP 29; los builtins sustituyen los suyos, `nif_error/1,2` tienen cuerpo y los demás lanzan `{not_implemented, F, A}` al llamarlos ([módulo erlang](builtins.md#erlang-module)) |
| [`binary`](../library/stdlib/binary.erl) | Todas las funciones de OTP 29: `replace/3,4` y `list_to_bin/1` en Erlang, las demás builtins del runtime ([módulo binary](builtins.md#binary-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Conversiones, `bin_is_7bit/1` y marcas de orden de bytes como builtins del runtime ([módulo unicode](builtins.md#unicode-module)); la normalización y las propiedades son stubs |
| [`math`](../library/stdlib/math.erl) | Todas las funciones de OTP 29 como builtins del runtime ([módulo math](builtins.md#math-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Todas las funciones de OTP 29 como builtins del runtime ([términos persistentes](builtins.md#persistent-terms)) |
| [`code`](../library/kernel/code.erl) | Consultas de módulos cargados como builtins del runtime sin servidor de código ([módulo code](builtins.md#code-module)); las rutas y la carga son stubs |
| [`os`](../library/kernel/os.erl) | `cmd/1` sobre un puerto ([subprocesos](ports.md#subprocesses)), `timestamp/0`, `system_time/0,1`, `perf_counter/0,1`, `getenv/2`; `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0` y `version/0` son builtins del runtime |

Los resultados y las razones de error coinciden con OTP 29, incluidas las
formas de error de las implementaciones en Erlang de OTP (`lists:map(F, x)` es
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)`
`badarg`) y de sus BIF (`lists:member/2`, `lists:keyfind/3`,
`lists:reverse/2`, las funciones de `maps`: `badarg`, `{badmap, M}`,
`{badkey, K}`). `lists:member/2` compara con `=:=`, `lists:keyfind/3` con
`==`. `lists:sort/1` es una ordenación por mezcla (merge sort) estable. Las
trazas de pila nombran las funciones de la biblioteca, no las de OTP.

## Cómo los obtienen los programas

- Cuando un lote (entradas posicionales o un objetivo de proyecto) nombra un
  módulo con un átomo literal — `M:F(...)` con `M` literal, `fun M:F/A`,
  `apply(M, F, Args)` con `M` literal, `-behaviour(M)` o `-import(M, ...)` —
  que ninguna entrada define, el compilador busca `M.erl` en los directorios
  de aplicaciones de la biblioteca y después en los `source_search_paths` del
  proyecto ([proyectos](projects.md#paths-and-discovery)), analiza y compila
  dentro del lote el primero que encuentra, y luego repite el proceso con los
  módulos que nombran los archivos añadidos
  ([a qué módulo se resuelve un nombre](#which-module-a-name-resolves-to)). Una
  llamada `M:F(...)` a un builtin del catálogo (`io:format/2`, `os:type/0`) no
  nombra ningún módulo.
- La biblioteca es `library/` del árbol de compilación, que se localiza de
  forma relativa a `clau`, igual que el archivo del runtime, con un directorio
  por aplicación de OTP (`erts`, `kernel`, `stdlib`).
- Un módulo del lote con el mismo nombre sustituye al módulo de biblioteca, con
  una advertencia.
- Los módulos de biblioteca son módulos ordinarios del lote: se enlazan en los
  ejecutables y, con salida de objeto o de IR, producen sus propios artefactos.
- Un módulo al que solo se llega mediante nombres en tiempo de ejecución
  (`M:F(...)` con `M` una variable) no se añade: esa llamada lanza `undef` a
  menos que otra cosa nombre el módulo.
- Las funciones de biblioteca son código Erlang, así que cederán el control
  (yield) como el resto del código cuando exista el planificador.

## Sustitutos de módulos del runtime

El plan 11 step 41I (2026-10-12) decide cómo sustituye Clause a los módulos de
OTP que ERTS implementa en C (NIF, BIF, drivers de puerto, los módulos
precargados de `erts/preloaded/src`) y a los módulos que OTP genera durante su
compilación (`unicode_util`). `kernel` y `stdlib` de OTP son Erlang puro, pero
llaman a esos módulos; los steps 41J en adelante implementan este contrato.

### Proporcionado o ausente

Todo lo que necesita el runtime y no puede escribirse en Erlang puro se decide
por módulo, y por grupo de funciones cuando un módulo mezcla aspectos:

- **Proporcionado:** Clause incluye el módulo con la lista de exportaciones
  exacta de OTP 29. Cada función tiene uno de cuatro estados: `implemented`
  (un builtin del runtime o un cuerpo en Erlang sobre servicios existentes del
  runtime), `refused` (devuelve o lanza lo que los llamantes de OTP ya manejan
  cuando falta una característica, como `{error, enotsup}`), `stub` (lanza
  `error({not_implemented, F, A})` con `M:F/A` en la cima de la pila, como
  hacen los [stubs de `erlang`](builtins.md#erlang-module); aún no hecho;
  indicación del usuario 2026-10-12) o `declined` (un stub que se queda, con
  una razón como la distribución o la carga de código pendiente del plan step
  71). Un módulo empieza con todas sus funciones como stubs, de modo que se
  puede descubrir y sus llamantes compilan; después los grupos pasan a su
  estado decidido.
- **Ausente:** Clause no incluye el módulo en absoluto, quizá para siempre, y
  registra por qué y qué módulos de Clause de más alto nivel ocupan el lugar
  de sus llamantes. Las capas de archivos y sockets `prim_*` de bajo nivel son
  el caso típico: los programas usan en su lugar `file`, `gen_tcp`, `gen_udp`
  e `inet` de Clause, y como los módulos de Clause prevalecen sobre los de OTP
  (véase abajo), los llamantes de OTP de un módulo ausente nunca entran en un
  lote. Un módulo ausente nunca recibe un stub, así que una referencia a él es
  un error en tiempo de compilación, nunca una sorpresa en tiempo de ejecución.

Las funciones triviales para el runtime se implementan sin una decisión
aparte.

### A qué módulo se resuelve un nombre

OTP es opcional en la máquina del usuario; cuando está presente, no debe
cambiar lo que compila una compilación. Un nombre de módulo se resuelve en
este orden:

1. **Entradas explícitas:** los fuentes que enumera el usuario (`sources`,
   `source_dirs`, entradas posicionales). Una que tenga el nombre de un módulo
   de Clause lo sustituye, con una advertencia que nombra ambos archivos.
2. **Módulos de Clause:** los módulos de biblioteca, incluidos los sustitutos
   proporcionados.
3. **`source_search_paths`**, como se describe en
   [proyectos](projects.md#paths-and-discovery).

El nombre de un módulo ausente está reservado: no se usa un archivo con el
mismo nombre en una ruta de búsqueda (por ejemplo
`erts/preloaded/src/prim_file.erl` de OTP), y el diagnóstico indica que Clause
no proporciona el módulo. Una entrada explícita aún puede proporcionarlo, con
la advertencia de sustitución.

`ignore_modules` se aplica también a los módulos de Clause: un módulo de
Clause ignorado falta en el lote, y entonces una entrada explícita puede
proporcionarlo sin advertencia, ya que no se sustituye nada.

### Archivos

- Los módulos de biblioteca viven en `library/<application>/`, con el nombre
  de la aplicación de OTP propietaria del módulo en OTP: `erts` (homólogos de
  los precargados y `erlang`), `kernel` (`file`, `gen_tcp`, `gen_udp`, `inet`,
  `os`, y el propio `clause_socket` de Clause), `stdlib` (`binary`, `lists`,
  `maps`, `math`, `io`, `unicode`, `unicode_util`). La búsqueda en la
  biblioteca recorre todos los directorios de aplicaciones; un nombre de
  módulo existe como mucho en uno de ellos.
- `library/modules.terms` enumera todos los módulos sobre los que decide
  Clause: `{Module, Application, provided}.` o
  `{Module, Application, missing, "reason"}.` El compilador lo lee para saber
  qué nombres son módulos de Clause y cuáles están reservados.
- Cada módulo proporcionado tiene junto a él un inventario `<module>.terms`:
  `{Name, Arity, Group, Status}.` por cada exportación de OTP 29, ordenado por
  nombre y aridad, donde `Group` nombra el grupo de decisión (por ejemplo
  `stdlib`, `distribution`, `beam`). `erlang.terms` mantiene su propio formato
  (`{Name, Arity, Flags, Status}`, [módulo erlang](builtins.md#erlang-module)).
- Las listas de exportaciones se observan a partir de un OTP 29 del host
  (`M:module_info(exports)`); no se copia ningún fuente de OTP. Los resultados
  y los términos de error de las funciones implementadas coinciden con OTP 29;
  las diferencias deliberadas van a [diferencias](differences.md).
- Todo módulo de biblioteca de Clause exporta la lista completa de OTP 29 para
  su nombre, de modo que el código de OTP compilado contra él encuentra todas
  las funciones; `lists`, `maps`, `file`, `io`, `os`, `gen_tcp`, `gen_udp` e
  `inet` propios de Clause también reciben inventarios y stubs para lo que aún
  no implementan.

### Tipos

Como los módulos de Clause prevalecen sobre los de OTP, el código de OTP que
nombra `file:filename()` o `erlang:time_unit()` en sus specs debe encontrar
esos tipos en los módulos de Clause. Todo módulo proporcionado cuyo homólogo de
OTP exporta tipos incluye `<module>.types.hrl` de su propio directorio: la
lista `-export_type` y después los tipos exportados y los tipos y records
locales que usan, tal como los define OTP (la documentación muestra las mismas
definiciones; la documentación instalada no incluye definiciones de tipos, así
que provienen de la implementación: la información de depuración del beam, o
el fuente distribuido de un módulo precargado como `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` escribe la
cabecera a partir del OTP del host, y `--check` compara sus formas con una
observación nueva (CTest `library_freshness`); `library_modules.py check` exige
que cada cabecera la incluya su módulo. Los tipos que las cabeceras nombran de
módulos ajenos al programa (`unicode:chardata()`, `calendar:datetime()`) y las
uniones amplias de OTP (`file:posix()` tiene más miembros de los que conserva
el grafo de tipos) se resuelven a `term()` sin advertencia: los diagnósticos
pertenecen a la biblioteca de Clause, no al programa del usuario.

### Servicios de kernel al arrancar

`file`, `io`, `code` y `logger` de OTP llaman a servidores registrados
(`file_server_2`, `code_server`, el servidor de E/S de un group leader,
`logger`) que la aplicación `kernel` arranca al iniciar. Un ejecutable de
Clause no arranca ninguno de ellos, y se decidió el 2026-10-12 que por ahora
siga sin arrancar ninguno: `file` e `io` propios de Clause no necesitan
servidor, y un módulo de OTP que sí lo necesita falla del mismo modo que
fallaría en OTP sin ese servidor (`noproc`). Coste: el código de OTP que
registra mediante `logger` o llama a `code` en tiempo de ejecución no funciona
hasta que una entrada posterior del registro seleccione un conjunto mínimo de
servicios para el objeto de arranque. No está previsto arrancar la aplicación
`kernel` completa.

### Registro

El proyecto luerl impulsa este trabajo. Tras cada paso, se ejecuta

```text
clau.bat --project test-luerl --entry luerl:init
```

se clasifica cada error (`unknown module`, `undefined function M:F/A`, sintaxis
o característica no soportada, otro) y se asigna cada uno a un step de la
phase H3 del plan 11, a otro elemento pendiente o a un rechazo registrado. Con
el stderr de la ejecución guardado en un archivo,
`python tests/compiler/library/library_modules.py report FILE` imprime la
clasificación como tablas: cada módulo desconocido con su número de errores,
los módulos llamantes y las funciones llamadas con sus aridades; las funciones
no definidas por módulo; los demás mensajes con sus recuentos.

### Herramientas

Todas viven en `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` escribe
  `LIBRARY/APP/MODULE.terms` a partir de `MODULE:module_info(exports)` del OTP
  del host, conservando el grupo y el estado de cada entrada ya existente; una
  exportación nueva empieza como `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` escribe el archivo
  del módulo una vez, con todas las exportaciones como stubs; a partir de ahí
  el archivo se edita a mano.
- `python library_modules.py check ROOT` (CTest `library_inventory`, sin OTP)
  informa de cada discrepancia: un módulo proporcionado sin sus archivos, un
  módulo ausente con un archivo, un inventario no listado como proporcionado,
  una exportación que no está en el inventario o al revés, una entrada
  `stub`/`declined` que no es un stub que lanza `undef`, una entrada
  `implemented`/`refused` sin cuerpo ni builtin del catálogo.
  `library_rejects` lo demuestra sobre una biblioteca de fixture
  deliberadamente incoherente.
- CTest `library_freshness` (etiqueta `host_otp`) vuelve a observar cada
  inventario y exige que no haya cambiado; después observa, genera, comprueba
  y compila un módulo nuevo de principio a fin. `library_report` ejecuta
  `clau` sobre un programa de fixture y comprueba las filas del informe.

| Módulo | Decisión (2026-10-12) | Razón o step del plan |
| --- | --- | --- |
| `init` | proporcionado; implementado salvo `boot/1`, `restart/0,1` y `make_permanent/2`, rechazados | respuestas de argumentos y estado de un sistema arrancado (41L, [módulo init](builtins.md#init-module)) |
| `persistent_term` | proporcionado, todo stubs | tabla de términos global del runtime (41M) |
| `erts_internal` | proporcionado; grupos `stdlib` y `counters` implementados, `get_creation/0` y `map_hashmap_children/1` rechazados, los grupos `distribution`, `beam` y `emulator` declinados | 41N ([erts_internal](builtins.md#erts-internal)); sin distribución, sin archivos `.beam` |
| `atomics`, `counters`, `erts_code_purger` | proporcionados; `atomics`, `counters` implementados; `purge/1`, `soft_purge/1` implementados, el proceso purgador declinado | 41N ([atomics y counters](builtins.md#atomics-and-counters)); la carga de código espera al step 71 |
| `unicode_util` | proporcionado, implementado (41O1, 41O2) | tablas generadas a partir de las respuestas de OTP y los datos de Unicode ([unicode_util](builtins.md#unicode-util)) |
| `erl_prim_loader` | proporcionado; consultas de archivos implementadas sobre `file`, carga y archivos comprimidos declinados | 41P ([archivos](ports.md#standard-io-and-files)); la carga de código espera al step 71 |
| `zlib` | proporcionado, implementado sobre la zlib fijada (41Q) | los flujos son referencias de manejador ([módulo zlib](builtins.md#zlib-module)) |
| `prim_eval` | proporcionado, implementado (41S) | `'receive'/2` sobre los pasos de un receive compilado ([prim eval](builtins.md#prim-eval)) |
| `application_controller` | proporcionado, todo stubs | oculta el de OTP, que llama a `prim_file` (luerl lo nombra a través de `application` de OTP) |
| `lists`, `maps`, `io`, `file`, `os`, `gen_tcp`, `gen_udp`, `inet` | proporcionados, con las listas de exportaciones completas de OTP 29; lo que Clause tenía sigue implementado, el resto son stubs | crecen según lo exija el registro |
| `re` | proporcionado; implementado (41ZA, 41ZB) salvo `import/1`, declinado | sobre la PCRE2 fijada ([módulo re](builtins.md#re-module)); Clause no exporta patrones |
| `prim_file`, `prim_buffer` | ausentes, decidido en 41P | `file` de Clause es la capa de archivos; `filelib`/`filename` de OTP se ejecutan sobre ella |
| `prim_socket`, `prim_net`, `prim_inet`, `socket_registry`, `socket`, `net` | ausentes, decidido en 41R | `gen_tcp`, `gen_udp`, `inet` de Clause son la capa de red; a `gen_tcp_socket`, `gen_udp_socket`, `inet_tcp`, `inet_udp` de OTP solo se llega desde los módulos ocultados de OTP ([sockets](ports.md#sockets-57f)) |

Última capa de luerl (2026-10-12, tras los steps 41K1 y 41K2, con
`NEW_STACKTRACE` definido como hace el `rebar.config.script` de luerl en OTP 21
y posteriores, e `inet` ya no en `ignore_modules`): el destino compila y enlaza
sin ningún error. Quedan 83 advertencias: 74 tipos de los `erl_parse` y
`compile` ignorados, 8 tipos de módulos de OTP ajenos al programa nombrados por
código de OTP que compila el destino, y una ampliación por presupuesto del
grafo de tipos en ese código. El ejecutable arranca `luerl:init/0` y termina
con 0. La siguiente capa es el comportamiento en tiempo de ejecución: qué
stubs alcanza luerl cuando ejecuta código Lua.

Capa de tiempo de ejecución (2026-10-14, tras las phases H3–H5): un driver que
ejecuta 35 fragmentos de Lua mediante `luerl:do` se compila con 17
advertencias e imprime la salida de OTP 29 para 34 de ellos, incluido
`os.date`. El otro, un `goto`, falla con el `function_clause` de OTP; solo
difieren sus marcos de pila, sin argumentos ni ubicaciones
([diferencias](differences.md)).
