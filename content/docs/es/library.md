---
source: docs/library.md
sourceCommit: a8c3f8f6
sourceSha256: f657ad1632b57e9c9b11ad04f870350112a7cac942b10e5483e1aa26d1c79fc7
translatedAt: 2026-10-17
---
# Módulos de biblioteca

Clause incluye sus propias versiones de los módulos de OTP a los que llaman los
programas, escritas en Erlang a partir del comportamiento documentado de OTP (no
copiadas de los fuentes de OTP) sobre los [builtins](builtins.md) del runtime,
y las compila junto con los programas que las usan.

## Contenido

Cada módulo proporcionado exporta la lista completa de OTP 29 para su nombre;
su inventario `<module>.terms` ([archivos](#files)) registra qué funciones
están implementadas y cuáles son stubs.

| Módulo | Contenido |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | Las funciones habituales; las funciones de datos como `sublist/2,3`, `flatten/1,2`, `usort/1`, `keymember/3` son builtins del runtime ([módulo lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Las funciones habituales y los iteradores; `get/3`, `merge/2`, `update/3`, `with/2`, ... son builtins del runtime ([módulo maps](builtins.md#maps-module)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor de entrada estándar o un archivo abierto), `request/1,2`, `requests/1,2` (el protocolo de E/S de OTP, [archivos](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` y `nl/0,1` son builtins del runtime ([io](io.md)) |
| [`binary`](../library/stdlib/binary.erl) | Todas las funciones; `replace/3,4` y `list_to_bin/1` en Erlang, las demás builtins del runtime ([módulo binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Todas las funciones como builtins del runtime ([módulo math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Conversiones, `bin_is_7bit/1` y marcas de orden de bytes como builtins del runtime ([módulo unicode](builtins.md#unicode-module)); la normalización y las propiedades son stubs |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Todas las funciones sobre tablas generadas ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Todas las funciones salvo `import/1`, sobre PCRE2 ([módulo re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Abrir, leer, escribir, posicionar y cerrar archivos, lecturas y escrituras de archivos completos, información de archivos y operaciones de directorios sobre el driver de archivos ([archivos](ports.md#standard-io-and-files)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl) | Sockets sobre puertos de socket ([sockets](ports.md#sockets)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Propio de Clause: el protocolo del driver de sockets que comparten los tres módulos anteriores |
| [`os`](../library/kernel/os.erl) | `cmd/1` sobre un puerto, consultas de entorno, de hora y de versión ([módulo maps](builtins.md#maps-module)) |
| [`code`](../library/kernel/code.erl) | Consultas de módulos cargados sin servidor de código ([módulo code](builtins.md#code-module)); las rutas y la carga son stubs |
| [`application_controller`](../library/kernel/application_controller.erl) | Todo stubs; oculta el de OTP, que llama a `prim_file` (luerl llega a él a través de `application` de OTP) |
| [`erlang`](../library/erts/erlang.erl) | Stubs generados de todas las exportaciones de `erlang` de OTP 29; los builtins sustituyen los suyos, `nif_error/1,2` tienen cuerpo y los demás lanzan `{not_implemented, F, A}` al llamarlos ([módulo erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Las respuestas de un sistema arrancado; `boot/1`, `restart/0,1` y `make_permanent/2` se rechazan ([módulo init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Todas las funciones como builtins del runtime ([términos persistentes](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Todas las funciones ([atomics y counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Lo que llaman `stdlib` y `kernel`; los grupos de distribución, `.beam`, emulador y proceso purgador se declinan ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Consultas de archivos sobre `file`; la carga y los archivos comprimidos se declinan ([archivos](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Todas las funciones sobre el zlib fijado ([módulo zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` sobre los pasos de un receive compilado ([prim eval](builtins.md#prim-eval)) |

Los resultados y las razones de error coinciden con OTP 29, incluidas las
formas de error de las implementaciones en Erlang de OTP (`lists:map(F, x)` es
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)`
`badarg`) y de sus BIF (`lists:member/2`, `lists:keyfind/3`,
`lists:reverse/2`, las funciones de `maps`: `badarg`, `{badmap, M}`,
`{badkey, K}`). `lists:member/2` compara con `=:=`, `lists:keyfind/3` con `==`.
`lists:sort/1` es una ordenación por mezcla (merge sort) estable cuyas pasadas
alternan tramos ascendentes y descendentes, de modo que ninguna mezcla invierte
un tramo. Las trazas de pila nombran las funciones de la biblioteca, no las de
OTP.

## Cómo los obtienen los programas

- Cuando un lote (entradas posicionales o un destino de proyecto) nombra un
  módulo con un átomo literal — `M:F(...)` con `M` literal, `fun M:F/A`,
  `apply(M, F, Args)` con `M` literal, `-behaviour(M)` o `-import(M, ...)` —
  que ninguna entrada define, el compilador busca `M.erl` en los directorios de
  aplicaciones de la biblioteca y después en los `source_search_paths` del
  proyecto ([proyectos](projects.md#paths-and-discovery)), analiza y compila
  dentro del lote el primero que encuentra, y luego repite el proceso con los
  módulos que nombran los archivos añadidos
  ([a qué módulo se resuelve un nombre](#which-module-a-name-resolves-to)). Una
  llamada `M:F(...)` a un builtin del catálogo (`io:format/2`, `os:type/0`) no
  nombra ningún módulo. `--print-inputs` enumera las entradas que esto añade.
- La biblioteca es `library/` del árbol de compilación, que se localiza de
  forma relativa a `clau`, igual que el archivo del runtime, con un directorio
  por aplicación de OTP (`erts`, `kernel`, `stdlib`).
- Un módulo del lote con el mismo nombre sustituye al módulo de biblioteca, con
  una advertencia; los builtins del catálogo con ese nombre siguen prevaleciendo
  ([registro](builtins.md#registration)).
- Los módulos de biblioteca son módulos ordinarios del lote: se enlazan en los
  ejecutables y, para la salida de objetos o de IR, producen sus propios
  artefactos. Son código Erlang, por lo que ceden el control como el resto del
  código.
- Un módulo alcanzado solo mediante nombres en tiempo de ejecución (`M:F(...)`
  con `M` una variable) no se añade: esa llamada lanza `undef` salvo que otra
  cosa nombre el módulo.

## Sustitutos de módulos del runtime

Clause sustituye a los módulos de OTP que ERTS implementa en C (NIF, BIF,
drivers de puertos, los módulos precargados de `erts/preloaded/src`) y a los
módulos que OTP genera durante su compilación (`unicode_util`). Los módulos
`kernel` y `stdlib` de OTP son Erlang normal, pero llaman a esos módulos.

### Proporcionados o ausentes

Todo lo que necesita el runtime y no puede escribirse en Erlang normal se
decide por módulo, y por grupo de funciones cuando un módulo mezcla
responsabilidades:

- **Proporcionado:** Clause incluye el módulo con la lista exacta de
  exportaciones de OTP 29. Cada función tiene uno de cuatro estados:
  `implemented` (un builtin del runtime o un cuerpo Erlang sobre servicios del
  runtime existentes), `refused` (devuelve o lanza lo que los llamantes de OTP
  ya manejan cuando falta una funcionalidad, como `{error, enotsup}`), `stub`
  (lanza `error({not_implemented, F, A})` con `M:F/A` en la cima de la pila,
  como hacen los [stubs de `erlang`](builtins.md#erlang-module); todavía no
  hecho) o `declined` (un stub que se queda, con un motivo como la distribución
  o la carga de código). Un módulo nuevo empieza con todas sus funciones como
  stubs, de modo que se puede descubrir y sus llamantes compilan; después los
  grupos pasan al estado decidido.
- **Ausente:** Clause no incluye el módulo en absoluto, posiblemente para
  siempre, y registra el motivo y qué módulos de Clause de más alto nivel ocupan
  el lugar de sus llamantes (`library/modules.terms`). Las capas de bajo nivel
  `prim_*` de archivos y sockets (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) y `socket`, `net` son los módulos
  ausentes: los programas usan en su lugar `file`, `gen_tcp`, `gen_udp` e
  `inet` de Clause y, como los módulos de Clause prevalecen sobre los de OTP
  (véase más abajo), los llamantes de OTP de un módulo ausente
  (`gen_tcp_socket`, `inet_tcp`, ... de OTP) nunca entran en un lote. Un módulo
  ausente nunca recibe un stub, por lo que una referencia a él es un error en
  tiempo de compilación, nunca una sorpresa en tiempo de ejecución.

Las funciones triviales para el runtime se implementan sin una decisión aparte.

### A qué módulo se resuelve un nombre

OTP es opcional en la máquina del usuario; cuando está presente, no debe
cambiar lo que compila una compilación. Un nombre de módulo se resuelve en este
orden:

1. **Entradas explícitas:** los fuentes que enumera el usuario (`sources`,
   `source_dirs`, entradas posicionales). Uno que tenga el nombre de un módulo
   de Clause lo sustituye, con una advertencia que nombra ambos archivos.
2. **Módulos de Clause:** los módulos de biblioteca, incluidos los sustitutos
   proporcionados.
3. **`source_search_paths`**, tal como se describe en
   [proyectos](projects.md#paths-and-discovery).

El nombre de un módulo ausente está reservado: un archivo con el mismo nombre en
una ruta de búsqueda (por ejemplo `erts/preloaded/src/prim_file.erl` de OTP) no
se usa, y el diagnóstico indica que Clause no proporciona el módulo. Una
entrada explícita todavía puede proporcionarlo, con la advertencia de
sustitución.

`ignore_modules` también se aplica a los módulos de Clause: un módulo de Clause
ignorado está ausente del lote, y una entrada explícita puede entonces
proporcionarlo sin advertencia, ya que no se sustituye nada.

### Archivos

- Los módulos de biblioteca residen en `library/<application>/`, con el nombre
  de la aplicación de OTP a la que pertenece el módulo en OTP: `erts`
  (contrapartes de los precargados y `erlang`), `kernel`, `stdlib`. Los módulos
  auxiliares privados de Clause (`clause_socket`, `clause_re`,
  `clause_unicode`, `clause_zlib`, `clause_receive`, `clause_maps`) están junto
  a los módulos a los que sirven. La búsqueda en la biblioteca recorre todos
  los directorios de aplicaciones; un nombre de módulo existe como mucho en uno
  de ellos.
- `library/modules.terms` enumera todos los módulos sobre los que decide
  Clause: `{Module, Application, provided}.` o
  `{Module, Application, missing, "reason"}.` El compilador lo lee para saber
  qué nombres son módulos de Clause y cuáles están reservados.
- Cada módulo proporcionado tiene junto a él un inventario `<module>.terms`:
  `{Name, Arity, Group, Status}.` por cada exportación de OTP 29, ordenado por
  nombre y aridad, donde `Group` nombra el grupo de decisión (por ejemplo
  `stdlib`, `distribution`, `beam`). `erlang.terms` mantiene su propio formato
  (`{Name, Arity, Flags, Status}`, [módulo erlang](builtins.md#erlang-module)).
- Las listas de exportaciones se observan desde un OTP 29 del anfitrión
  (`M:module_info(exports)`); no se copia ningún fuente de OTP. Los resultados y
  los términos de error de las funciones implementadas coinciden con OTP 29;
  las diferencias deliberadas van a [diferencias](differences.md).

### Tipos

Como los módulos de Clause prevalecen sobre los de OTP, el código de OTP que
nombra `file:filename()` o `erlang:time_unit()` en sus specs debe encontrar
esos tipos en los módulos de Clause. Cada módulo proporcionado cuya contraparte
de OTP exporta tipos incluye `<module>.types.hrl` de su propio directorio: la
lista `-export_type` y después los tipos exportados y los tipos y records
locales que usan, tal como los define OTP (la documentación muestra las mismas
definiciones; la documentación instalada no contiene definiciones de tipos, por
lo que proceden de la implementación: la información de depuración del beam, o
el fuente incluido de un módulo precargado como `erlang`).
`escript tests/compiler/library/observe_types.escript LIBRARY APP MODULE`
escribe la cabecera a partir del OTP del anfitrión, y `--check` compara sus
formas con una observación nueva (CTest `library_freshness`);
`library_modules.py check` exige que cada cabecera esté incluida por su módulo.
Los tipos que las cabeceras nombran de módulos ajenos al programa
(`unicode:chardata()`, `calendar:datetime()`) y las uniones amplias de OTP
(`file:posix()` tiene más miembros de los que conserva el grafo de tipos) se
resuelven a `term()` sin advertencia: los diagnósticos corresponden a la
biblioteca de Clause, no al programa del usuario.

### Servicios de kernel al arrancar

`file`, `io`, `code` y `logger` de OTP llaman a servidores registrados
(`file_server_2`, `code_server`, el servidor io de un líder de grupo,
`logger`) que la aplicación `kernel` arranca durante el inicio. Un ejecutable
de Clause no arranca ninguno de ellos: `file` e `io` propios de Clause no
necesitan servidor, y un módulo de OTP que sí lo necesita falla de la misma
manera que falla en OTP sin ese servidor (`noproc`). Por tanto, el código de
OTP que registra a través de `logger` o llama a `code` en tiempo de ejecución
no funciona. No está previsto arrancar la aplicación `kernel` completa.

### Registro de seguimiento

Los programas reales impulsan este trabajo; el proyecto luerl es el impulsor
actual ([21-lib](../.agents/21-lib.md)). Se compila y se ejecuta, se clasifica
cada error (`unknown module`, `undefined function M:F/A`, sintaxis o
funcionalidad no admitida, otros) y se asigna cada uno a un paso del plan, a
otro elemento pendiente o a un rechazo registrado. Con el stderr de la
ejecución guardado en un archivo,
`python tests/compiler/library/library_modules.py report FILE` imprime la
clasificación como tablas: cada módulo desconocido con su recuento de errores,
los módulos que lo llaman y las funciones llamadas con sus aridades; las
funciones no definidas por módulo; y los demás mensajes con sus recuentos.

### Herramientas

Todas residen en `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` escribe
  `LIBRARY/APP/MODULE.terms` a partir de `MODULE:module_info(exports)` del OTP
  del anfitrión, conservando el grupo y el estado de cada entrada ya existente;
  una exportación nueva empieza como `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` escribe el archivo
  del módulo una sola vez, con todas las exportaciones como stubs; a partir de
  entonces el archivo se edita a mano.
- `python library_modules.py check ROOT` (CTest `library_inventory`, sin OTP)
  informa de cada discrepancia: un módulo proporcionado sin sus archivos, un
  módulo ausente con un archivo, un inventario no listado como proporcionado,
  una exportación que no está en el inventario o al revés, una entrada
  `stub`/`declined` que no es un stub `not_implemented`, una entrada
  `implemented`/`refused` sin cuerpo ni builtin del catálogo.
  `library_rejects` lo demuestra con una biblioteca de fixtures deliberadamente
  inconsistente.
- El CTest `library_freshness` (etiquetas `host_otp`, `full_only`) vuelve a
  observar cada inventario y exige que no haya cambiado; después observa,
  genera, comprueba y compila un módulo nuevo de principio a fin.
  `library_report` ejecuta `clau` sobre un programa de fixture y comprueba las
  filas del informe.
