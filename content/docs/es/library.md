---
source: docs/library.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: eb1d55d20683cef87e3553554a2b837e023b35acb9de58cdad1cb868ec95d0d8
translatedAt: 2026-10-26
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
| [`lists`](../library/stdlib/lists.erl) | Las funciones habituales; las funciones de datos como `sublist/2,3`, `flatten/1,2`, `sort/1`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2` son builtins del runtime; todas las funciones documentadas están implementadas ([módulo lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Todas las funciones documentadas; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... son builtins del runtime; las funciones que toman funs son Erlang ([módulo maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Todas las funciones documentadas; los recorridos de listas son builtins del runtime, las funciones que toman funs son Erlang ([colecciones](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Todas las funciones documentadas; la aritmética gregoriana como builtins del runtime, la hora local y RFC 3339 en Erlang ([calendar](builtins.md#calendar)) |
| [`proc_lib`](../library/stdlib/proc_lib.erl), [`sys`](../library/stdlib/sys.erl) | Todas las funciones documentadas: creación de procesos con ancestros y llamadas iniciales, arranques síncronos (`init_ack`, `init_fail`), etiquetas, `stop/1,3`, informes de fallos y su texto; el protocolo de mensajes del sistema y las opciones de depuración (`trace`, `log`, `statistics`, `log_to_file`, funs instaladas) con las formas de las listas de depuración de OTP |
| [`gen_server`](../library/stdlib/gen_server.erl), [`gen_statem`](../library/stdlib/gen_statem.erl), [`gen_event`](../library/stdlib/gen_event.erl), [`gen_fsm`](../library/stdlib/gen_fsm.erl), [`gen`](../library/stdlib/gen.erl) | Todas las funciones documentadas en Erlang sobre `proc_lib` y `sys`, con los mensajes de OTP (`'$gen_call'` con etiquetas de alias, `'$gen_cast'`, ...), resultados y acciones de callbacks, colecciones de identificadores de solicitudes, términos de error y textos de informes; `gen` contiene lo que comparten |
| [`supervisor`](../library/stdlib/supervisor.erl), [`supervisor_bridge`](../library/stdlib/supervisor_bridge.erl) | Todas las funciones documentadas: especificaciones de hijos y errores de OTP, estrategias, intensidad de reinicio, reglas de apagado, hijos `simple_one_for_one` y apagado automático, como un `gen_server` |
| [`logger`](../library/kernel/logger.erl), [`logger_formatter`](../library/kernel/logger_formatter.erl), [`logger_std_h`](../library/kernel/logger_std_h.erl), [`logger_filters`](../library/kernel/logger_filters.erl), [`logger_handler`](../library/kernel/logger_handler.erl) | Todas las funciones documentadas en Erlang: configuración primaria, de manejadores y de proxy con las comprobaciones y términos de error de OTP, niveles de módulos, metadatos de procesos, filtros, las macros `?LOG_*` de [`kernel/include/logger.hrl`](../library/kernel/include/logger.hrl), plantillas del formateador y la cabecera heredada, `logger_std_h` sobre dispositivos y archivos con rotación, compresión y `filesync/1`, `logger_disk_log_h` sobre registros en disco de tipo halt y wrap (ambos sobre [`clause_logger_h`](../library/kernel/clause_logger_h.erl), opciones y comprobaciones comunes de manejadores de OTP). El servidor `logger` es [`clause_logger`](../library/kernel/clause_logger.erl) de Clause, iniciado en el primer uso con el manejador predeterminado de OTP en `standard_io` (la variable de entorno `CLAUSE_LOGGER_TYPE=standard_error` lo mueve a la salida de error estándar, como hace el ejecutor de goldens para coincidir con los generados con el manejador de OTP allí); los niveles de aplicaciones necesitan `application` |
| [`disk_log`](../library/kernel/disk_log.erl), [`wrap_log_reader`](../library/kernel/wrap_log_reader.erl), [`clause_disk_log`](../library/kernel/clause_disk_log.erl), [`clause_disk_log_server`](../library/kernel/clause_disk_log_server.erl) | Todas las funciones documentadas en Erlang: registros halt, wrap y rotate, internos y externos, con los formatos de archivo de OTP (cabeceras de registros, tramas de elementos con MD5 de elementos grandes, archivos de índice y tamaño de wrap, archivos rotate), de modo que los archivos son idénticos byte a byte a los de OTP; un proceso por registro con propietarios, usuarios, notificaciones, bloqueo con solicitudes en cola, registro anticipado, caché de escritura vaciada por tamaño y temporizador, reparación, bloques de solo lectura que cuentan bytes erróneos; el servidor de registro `disk_log_server` con las tablas con nombre `disk_log_names` y `disk_log_pids`; `wrap_log_reader` sobre el mismo lector de bloques |
| [`error_logger`](../library/kernel/error_logger.erl), [`error_logger_file_h`](../library/stdlib/error_logger_file_h.erl), [`log_mf_h`](../library/stdlib/log_mf_h.erl) | Todas las funciones documentadas: mensajes e informes como eventos de registro con los metadatos `error_logger` de OTP, manejadores de informes en el gestor de eventos `error_logger` alimentado por el manejador de registro `error_logger`, `logfile/1` con el texto de informe antiguo, archivos wrap con el formato de índice y registros de OTP |
| [`pg`](../library/kernel/pg.erl), [`data_publisher`](../library/kernel/data_publisher.erl) | Todas las funciones documentadas: ámbitos como servidores `data_publisher` con las tablas ETS de OTP, incorporaciones, salidas, miembros que terminan, monitores de ámbitos y grupos; el ámbito no tiene pares |
| [`global`](../library/kernel/global.erl), [`global_group`](../library/kernel/global_group.erl) | Todas las funciones documentadas como en un nodo no distribuido: nombres (también `{global, Name}` en los behaviours), bloqueos y transacciones sobre un `global_name_server` iniciado en el primer uso; `global_group` sin grupos; se declinan el gestor de bloqueos y los componentes internos distribuidos |
| [`rpc`](../library/kernel/rpc.erl), [`erpc`](../library/kernel/erpc.erl) | Todas las funciones documentadas: las llamadas a este nodo se ejecutan en procesos creados (`rex` se inicia en el primer uso) con los resultados y errores de OTP; los demás nodos están caídos (`{badrpc, nodedown}`, `{erpc, noconnection}`) |
| [`net_adm`](../library/kernel/net_adm.erl), [`net_kernel`](../library/kernel/net_kernel.erl), [`auth`](../library/kernel/auth.erl), [`seq_trace`](../library/kernel/seq_trace.erl) | Las respuestas de OTP para un nodo que no está activo (`pang`, `ignored`, `#{started => no}`, `nocookie`); se declinan `net_kernel:start/1,2` y los componentes internos de distribución; `seq_trace` conserva el token de cada proceso sin trazar |
| [`trace`](../library/kernel/trace.erl), [`erl_tracer`](../library/erts/erl_tracer.erl) | No se admiten trazas: todas las funciones de `trace` y el trazador predeterminado de `erl_tracer` (`enabled/3`, `trace/5`) lanzan `notsup`, como las funciones de trazado de erlang ([módulo erlang](builtins.md#erlang-module)); `erl_tracer:behaviour_info/1` enumera los callbacks de OTP |
| [`error_handler`](../library/kernel/error_handler.erl) | Las funciones de llamadas no definidas, invocables directamente; el runtime lanza `undef` por sí mismo y nunca las llama; se declina `breakpoint/3` (sin intérprete) |
| [`timer`](../library/stdlib/timer.erl) | Todas las funciones documentadas sin el servidor de temporizadores de OTP: los envíos temporizados a pids locales son `erlang:send_after/3`, cada otro temporizador es un proceso propio al que se llega mediante un alias en su `TRef`; las conversiones y `now_diff/2` son builtins del runtime ([timer](builtins.md#timer)) |
| [`filelib`](../library/stdlib/filelib.erl), [`clause_filelib`](../library/stdlib/clause_filelib.erl) | Todas las funciones documentadas: comodines compilados y cotejados por builtins del runtime con las reglas, peculiaridades y errores de OTP, el recorrido de directorios, consultas, `ensure_dir/1`, `ensure_path/1`, `fold_files/5,6`, `find_file/2,3`, `find_source/1,2,3` (`source_search_rules` de kernel o valores predeterminados de OTP) y `safe_relative_path/2` en Erlang; también las formas no documentadas que toman un módulo (`file`, `erl_prim_loader` u otro), `compile_wildcard/1` (ayuda de depuración de OTP) es un stub ([filelib](builtins.md#filelib)) |
| [`file_sorter`](../library/stdlib/file_sorter.erl) | Todas las funciones documentadas en Erlang: se siguen paso a paso las secuencias ordenadas de OTP (`size` bytes ordenados en memoria), mezclas (`no_files` archivos temporales a la vez, bloques de 16 KiB, flujos ordenados por sus objetos almacenados y números de archivo) y comprobaciones, de modo que los términos que comparan iguales salen y sobreviven a `unique` como en OTP; formatos `binary_term`, `binary`, `term` y fun, `header`, `compressed` (mediante la capa gzip de `file`), `tmpdir`, funs de entrada y salida, términos de error de OTP |
| [`zip`](../library/stdlib/zip.erl) | Todas las funciones documentadas en Erlang, siguiendo la disposición de archivos de OTP byte a byte (cabeceras locales y centrales creadas por UNIX 6.1, campos adicionales de marca de tiempo extendida y uid/gid de UNIX, zip64 por encima de 4 GiB, bloques deflate de 8 KiB con vaciados completos sobre `zlib`), de modo que los archivos son iguales a los de OTP; archivos o binaries de entrada y salida mediante las funs de entrada y salida de OTP, filtros, `cwd`, `keep_old_files`, `skip_directories`, `foldl/3`, archivos `zip_open/1,2` servidos por un proceso enlazado, `t/1`, `tt/1`, términos de error de OTP; los records de [`stdlib/include/zip.hrl`](../library/stdlib/include/zip.hrl) |
| [`erl_tar`](../library/stdlib/erl_tar.erl) | Todas las funciones documentadas en Erlang, siguiendo las reglas de formato de OTP byte a byte: cabeceras USTAR, nombres largos divididos en un prefijo o trasladados a cabeceras extendidas pax (al igual que los nombres, enlaces y nombres de propietario largos o no ASCII, y los números demasiado anchos para octal), lectura de archivos v7, GNU (nombres y enlaces largos, archivos dispersos), STAR, USTAR y pax con las peculiaridades de OTP (campos en base 256, tiempos pax), `compressed` mediante la capa gzip de `file`, binaries leídos como archivos `ram`, dispositivos, funs de E/S del usuario `init/3`, `max_size`, `keep_old_files`, `files`, `cwd`, `verbose`, comprobaciones de rutas inseguras, términos de error de OTP y `format_error/1` |
| [`zstd`](../library/stdlib/zstd.erl), [`clause_zstd`](../library/stdlib/clause_zstd.erl) | Todas las funciones documentadas: compresión y descompresión de una sola vez y en flujo, parámetros, diccionarios (sin procesar o referenciados), cabeceras de tramas e identificadores de diccionarios, en Erlang sobre builtins del runtime que mantienen contextos de libzstd 1.5.7 como la NIF de OTP ([zstd](builtins.md#zstd-module)); `file:open/2` acepta `{zstd, Options}` |
| [`beam_lib`](../library/stdlib/beam_lib.erl), [`erl_abstract_code`](../library/stdlib/erl_abstract_code.erl) | Todas las funciones documentadas en Erlang, siguiendo el tratamiento de bloques de OTP: recorrido IFF con los errores de OTP, tablas de átomos en ambas codificaciones, tablas de símbolos, atributos, información de compilación, literales, información de depuración y código abstracto mediante el backend `erl_abstract_code`, documentación (records de [`kernel/include/eep48.hrl`](../library/kernel/include/eep48.hrl)), MD5 de los bloques significativos, comparación y eliminación de información de archivos, directorios y versiones, beams comprimidos con gzip, `build_module/1` y el servidor de claves criptográficas con descifrado de información de depuración (mediante `crypto`, llamado dinámicamente: se enlaza con `--with-crypto`) |
| [`io_ansi`](../library/stdlib/io_ansi.erl) | Todas las funciones documentadas en Erlang: secuencias de terminal virtual de OTP 29 como las secuencias ANSI incorporadas que OTP usa sin terminfo (las consultas terminfo responden `{error, enotsup}`), `format/1,2,3` y `render/1,2` sobre `io_lib`, `fwrite/1,2,3,4` como solicitudes `put_ansi` que representa el servidor de entrada estándar, `scan/1` y `enabled/0,1` a partir del indicador de terminal del dispositivo ([módulo io](builtins.md#io-module)) |
| [`win32reg`](../library/stdlib/win32reg.erl) | Todas las funciones documentadas: análisis de claves de OTP (raíces, rutas absolutas, relativas y `..`), clave actual, valores enteros, de cadena y binary, listados y eliminaciones sobre el driver del registro de Windows ([el registro](ports.md#the-registry)); `{error, enotsup}` en otros sistemas, como en OTP |
| [`argparse`](../library/stdlib/argparse.erl), [`clause_argparse`](../library/stdlib/clause_argparse.erl) | Todas las funciones: validación con los errores de OTP, análisis (opciones, indicadores, `nargs`, acciones, tipos con elecciones, límites y expresiones regulares, tipos personalizados, subcomandos, prefijos, valores predeterminados) con los maps de argumentos y errores de OTP, `help/1,2` con la disposición y plantillas de OTP, `run/3` con todas las formas de manejador, como builtins del runtime que piden a Erlang que llame a las funs ([argparse](builtins.md#argparse)); sin `progname`, el nombre del propio programa |
| [`escript`](../library/stdlib/escript.erl) | `create/2` y `extract/2` siguiendo la disposición de secciones y lectura de cabeceras de OTP (líneas de shebang, comentario y argumentos del emulador; cuerpos de fuente, beam y archivo mediante `zip`); `script_name/0` es la ruta del ejecutable; se declina la ejecución de escripts (`start/0,1`, `parse_file/1`) |
| [`filename`](../library/stdlib/filename.erl) | Todas las funciones documentadas según las reglas Unix y Windows de OTP para el anfitrión; los recorridos de nombres son builtins del runtime, `absname/1,2` y `basedir/2,3` (a partir de `HOME`, las variables XDG y `APPDATA`) son Erlang ([filename](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Todas las funciones documentadas como builtins del runtime: análisis de RFC 3986 con los fragmentos de error de OTP, recomposición, normalización, resolución, codificación porcentual y consultas form-urlencoded ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Todas las funciones documentadas con los iodata, errores y orden de callbacks de OTP; `decode/1`, `encode/1`, `format/1,2` y las funciones de escape de binaries son builtins del runtime, los codificadores y formateadores que toman funs y los decodificadores con callbacks son Erlang ([codificaciones](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Todas las funciones documentadas con los estados y secuencias de OTP; los algoritmos de OTP se ejecutan como builtins del runtime, los generadores de complementos en Erlang ([números aleatorios](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Todas las funciones documentadas como builtins del runtime, recorriendo chardata como el `string.erl` de OTP para conservar las formas de sus resultados ([string](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Todas las funciones documentadas como builtins del runtime ([codificaciones](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Todas las funciones documentadas sobre el record de OTP 29; las operaciones del record son builtins del runtime, los folds y mapfolds son Erlang ([colecciones](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Todas las funciones documentadas sobre las formas de árboles y colas de OTP; las operaciones sin funs son builtins del runtime ([colecciones](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Todas las funciones documentadas sobre los records de OTP (conjuntos de versión 1) y maps (versión 2); las operaciones sin funs son builtins del runtime ([colecciones](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor de entrada estándar o un archivo abierto), `fread/2,3` (una solicitud `get_until` sobre `io_lib:fread/3`), `read/1..4`, `scan_erl_exprs/1..4`, `scan_erl_form/1..4`, `parse_erl_exprs/1..4`, `parse_erl_form/1..4` (solicitudes `get_until` sobre `erl_scan:tokens/3,4`, analizadas por `erl_parse`), `request/1,2`, `requests/1,2` (el protocolo de E/S de OTP, [archivos](ports.md#standard-io-and-files)), `getopts/0,1`, `setopts/1,2`, `columns/0,1`, `rows/0,1` (tamaño de terminal sobre builtins de `clause_io`), `get_password/0,1`, `write/1,2`; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` y `nl/0,1` son builtins del runtime ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Escritores, comprobaciones, funciones de recogida, el motor de formato, el impresor con formato (`print/1,4`, `~p`, `chars_limit`) y el analizador (`fread/2,3`) como builtins del runtime con las formas de listas profundas de OTP, funs `maps_order` que ordenan claves en `clause_io_lib`; `get_until`, `format_prompt` y `write/3` son Erlang ([io_lib](builtins.md#io_lib)) |
| [`sofs`](../library/stdlib/sofs.erl), [`clause_sofs`](../library/stdlib/clause_sofs.erl) | Todas las funciones; las operaciones de datos son builtins del runtime, las funciones que toman funs y las conversiones de digraph son Erlang ([conjuntos de conjuntos](builtins.md#sets-of-sets)) |
| [`ets`](../library/stdlib/ets.erl) | Tablas, lecturas, escrituras, recorridos y actualizaciones como builtins del runtime sobre las tablas del runtime; `foldl/3`, `foldr/3`, `i/0..3` y `fun2ms/1` en Erlang; especificaciones de coincidencia (familias select, match, match_spec) como builtins sobre el intérprete del runtime, `match_spec_run/2`, `test_ms/2`, `repair_continuation/2`, `match_delete/2` e `init_table/2` en Erlang; archivos de tablas (`tab2file/2,3`, `file2tab/1,2`, `tabfile_info/1`) en Erlang sobre `file` y `clause_disk_log`; `to_dets/2` y `from_dets/2` en Erlang sobre `dets`; `table/1,2` en Erlang sobre `qlc:table/2` ([ets](builtins.md#ets)) |
| [`graph`](../library/stdlib/graph.erl) | Todas las funciones sobre el record de OTP; las consultas y recorridos son builtins del runtime, las actualizaciones son Erlang ([graph](builtins.md#graph)) |
| [`digraph`](../library/stdlib/digraph.erl), [`digraph_utils`](../library/stdlib/digraph_utils.erl) | Todas las funciones sobre el record de tres tablas de OTP; las actualizaciones y lecturas son Erlang sobre `ets`, las búsquedas de rutas y recorridos de digraph_utils son builtins del runtime que leen las tablas, `subgraph/2,3` y `condensation/1` son Erlang ([digraph](builtins.md#digraph)) |
| [`dets`](../library/stdlib/dets.erl), [`clause_dets`](../library/stdlib/clause_dets.erl) | Todas las funciones documentadas: procesos de servidor y de tabla de OTP en Erlang sobre un motor C++ del formato de archivo versión 9 de OTP, archivos idénticos byte a byte a los que escribe OTP; `table/1,2` en Erlang sobre `qlc:table/2` ([dets](builtins.md#dets)) |
| [`ms_transform`](../library/stdlib/ms_transform.erl) | Todas las funciones en Erlang sobre el formato abstracto: `parse_transform/2` traduce funs literales dadas a `ets:fun2ms/1` y `dbg:fun2ms/1` en las formas de un módulo, `transform_from_shell/3` traduce las cláusulas de una fun del shell, con las especificaciones de coincidencia, advertencias de ocultación y códigos de error de OTP. Un módulo que usa la transformación al compilar sigue ejecutando el `ms_transform` del OTP del anfitrión ([transformaciones de análisis](transforms.md)) |
| [`qlc_pt`](../library/stdlib/qlc_pt.erl), [`clause_qlc_pt`](../library/stdlib/clause_qlc_pt.erl) | La transformación de análisis qlc en tiempo de ejecución (no documentada en OTP): `transform_expression/2`, `transform_from_evaluator/2` y `parse_transform/2` como builtins del runtime con el código de consulta generado, mensajes y anotaciones de OTP; `ms_transform` se ejecuta en Erlang bajo petición ([qlc_pt](builtins.md#qlc-pt)). Los módulos compilados que incluyen `qlc.hrl` siguen usando la transformación del OTP del anfitrión ([transformaciones de análisis](transforms.md)) |
| [`qlc`](../library/stdlib/qlc.erl) | Todas las funciones en Erlang, escritas a partir de la documentación de OTP: manejadores de consultas compiladas (manejadores `qlc_lc` de OTP procedentes de la transformación), listas, tablas `table/2`, `append/1,2`, `sort/1,2` y `keysort/2,3`; evaluación con búsquedas de constantes, especificaciones de coincidencia, uniones por mezcla y por búsqueda, `cache` (`ets`, `list` con desbordamiento a archivos temporales), `unique`, ordenaciones de `file_sorter`, cursores como procesos, `info/1,2` sobre `erl_pp`, `string_to_handle/1,2,3` sobre `qlc_pt`, términos de error de OTP y `format_error/1`. Los manejadores, tablas, claves del diccionario de procesos y nombres de archivos temporales son los de OTP. [`stdlib/include/qlc.hrl`](../library/stdlib/include/qlc.hrl) nombra la transformación `qlc`, que se ejecuta en el OTP del anfitrión ([qlc](builtins.md#qlc)) |
| [`shell`](../library/stdlib/shell.erl), [`clause_shell`](../library/stdlib/clause_shell.erl), [`clause_shell_eval`](../library/stdlib/clause_shell_eval.erl), [`clause_shell_commands`](../library/stdlib/clause_shell_commands.erl), [`clause_shell_records`](../library/stdlib/clause_shell_records.erl) | Todas las funciones documentadas en Erlang, escritas a partir de la documentación de OTP: el shell interactivo en la entrada estándar ([shell interactivo](#interactive-shell)): indicadores, mensaje inicial e historial de OTP (`e/1`, `v/1`, `h/0`), vinculaciones, records (`rd`, `rr`, `rl`, `rp`, `rf`), funciones, tipos y especificaciones definidos en el indicador, informes de excepciones sobre `erl_error`, resultados impresos como los imprime OTP (profundidad 30, records), shells restringidos, `catch_exception/1` y las funciones de configuración |
| [`shell_default`](../library/stdlib/shell_default.erl), [`c`](../library/stdlib/c.erl) | Todas las funciones: comandos de `c` con la salida de OTP (`i/0`, `regs/0`, `m/0,1`, `ls/0,1`, `flush/0`, `help/0`, ...); la compilación (`c/1,2,3`, `lc/1`, `nc/1,2`), `xm/1` e `y/1,2` informan de la llamada fallida como OTP sin compiler, tools o parsetools; `h/1,2,3` no encuentran documentación en el código enlazado; los comandos `i` del depurador informan de la aplicación ausente |
| [`edlin`](../library/stdlib/edlin.erl), [`edlin_expand`](../library/stdlib/edlin_expand.erl) | `edlin:keymap/0` (mapa de teclas del editor de línea llamante; `undefined` fuera de uno); `edlin_expand:expand/1,2` en Erlang: completado de módulos, funciones (aridades de `Mod:`, `fun Mod:Fun/`), BIF, comandos del shell, funciones definidas en el shell, palabras clave, vinculaciones, nombres y campos de records, claves de maps y rutas de archivos, con las secciones y coincidencias heredadas de OTP; los argumentos de una llamada se sugieren como cabeceras `Mod:Fun/Arity` (el código enlazado no tiene especificaciones) |
| [`shell_docs`](../library/stdlib/shell_docs.erl), [`clause_shell_docs_markdown`](../library/stdlib/clause_shell_docs_markdown.erl) | Todas las funciones en Erlang, escritas a partir de la documentación de OTP: `render/2..5`, `render_type/2..5` y `render_callback/2..5` de un bloque `docs_v1` dado (`application/erlang+html`, `text/markdown` convertido como lo convierte el shell de OTP, otros formatos `text/` tal cual) con la disposición, ajuste de líneas, viñetas y estilos ANSI de OTP, `normalize/1`, `validate/1`, `supported_tags/0`; idéntico a OTP en las 51,249 representaciones de los bloques de documentación del propio OTP 29. El código enlazado no tiene bloques propios (`code:get_doc/1`) |
| [`erl_parse`](../library/stdlib/erl_parse.erl), [`clause_erl_parse`](../library/stdlib/clause_erl_parse.erl) | Todas las funciones: `parse_form/1`, `parse_exprs/1`, `parse_term/1` y `parse/1`, `parse_and_scan/1` de yecc sobre un analizador del runtime con el formato abstracto y los errores de OTP; `normalise/1`, `abstract/1,2`, `tokens/1,2` y las tablas de precedencia como builtins; los recorridos de anotaciones y `format_error/1` en Erlang ([erl_parse](builtins.md#erl-parse)) |
| [`erl_eval`](../library/stdlib/erl_eval.erl), [`clause_erl_eval`](../library/stdlib/clause_erl_eval.erl) | Todas las funciones en Erlang sobre el formato abstracto: vinculaciones como orddicts o maps, manejadores de funciones locales y no locales (los operadores, BIF y errores como llamadas a `erlang:raise/3` pasan por estos últimos), funs interpretadas con el entorno de OTP, comprehensions con generadores estrictos y zip, `maybe`, native records, `receive` sobre `prim_eval`; la coincidencia de patrones, los segmentos de sintaxis de bits y el plegado de constantes son builtins del runtime ([erl_eval](builtins.md#erl-eval)). `exprs/2` y `expr/2` comprueban un comando con `erl_lint:exprs_opt/3`; `qlc:q/1,2` de una list comprehension de consulta pasa por `qlc:transform_from_evaluator/2` con las llamadas locales ocultas, como en OTP |
| [`erl_error`](../library/stdlib/erl_error.erl) | Todas las funciones en Erlang sobre `io_lib`: `format_exception/3,4` y los formateadores internos (`format_exception/6,7,8`, `format_stacktrace/4,5`, `format_call/4,5`, `format_fun/1,2`) con las explicaciones, disposiciones, callbacks `error_info` y opciones de OTP. Las trazas de pila propias de Clause no tienen ubicaciones ni `error_info` ([diferencias](differences.md#errors-stack-traces-and-reports)), por lo que sus informes no muestran ninguno |
| [`erl_pp`](../library/stdlib/erl_pp.erl), [`clause_erl_pp`](../library/stdlib/clause_erl_pp.erl) | Todas las funciones; la impresión es un builtin del runtime ([erl_pp](builtins.md#erl-pp)): formas, atributos, tipos y especificaciones, funciones, guards y expresiones con la disposición de OTP (ancho de línea, sangría, fragmentos de cadenas, paréntesis de precedencia) y opciones; los hooks y `legalize_vars/1` se ejecutan aquí; idéntico a OTP sobre las formas de 347 fuentes y suites de OTP, y sobre 80 de ellas con cinco conjuntos de opciones, incluidos hooks |
| [`erl_lint`](../library/stdlib/erl_lint.erl), [`clause_erl_lint`](../library/stdlib/clause_erl_lint.erl) | Todas las funciones; las comprobaciones son builtins del runtime ([erl_lint](builtins.md#erl-lint)) con los errores, advertencias, opciones y orden de OTP, y los textos de `format_error/1`; se llama aquí al `behaviour_info/1` de los behaviours, e `is_guard_test/3` pregunta primero a su fun sobre las llamadas locales; idéntico a OTP sobre 481 fuentes y suites de OTP, 474 fragmentos de suites y 816 expresiones de comandos |
| [`erl_expand_records`](../library/stdlib/erl_expand_records.erl) | `module/2` es un builtin del runtime ([erl_expand_records](builtins.md#erl-expand-records)): records de tuplas expandidos a operaciones de tuplas, native records y native records importados conservados, llamadas a importaciones y BIF con su módulo asignado, pruebas guard `is_record/3` convertidas en patrones, con las opciones `dialyzer`, `expand_inits` y `[no_]strict_record_tests`; idéntico a OTP sobre las formas de 347 fuentes y suites de pruebas de OTP |
| [`epp`](../library/stdlib/epp.erl), [`clause_epp`](../library/stdlib/clause_epp.erl) | Todas las funciones en Erlang salvo las condiciones `-if`, evaluadas por un builtin ([epp](builtins.md#epp)): un servidor por fuente abierto con las formas, macros (argumentos, sobrecarga, `??Arg`, `?FUNCTION_NAME`, predefinidas y de la opción `macros`), inclusiones, condicionales, `-file`, `-feature`, `-error`/`-warning`, archivos de documentación y errores de OTP; los archivos se leen completos y se decodifican según su comentario de codificación. Idéntico a OTP sobre 1,110 llamadas a `parse_file`/`scan_file` en fuentes y suites de OTP. `-include_lib` encuentra cabeceras solo mediante la ruta de inclusión hasta `code:lib_dir/1` |
| [`erl_scan`](../library/stdlib/erl_scan.erl) | Todas las funciones: `string/1,2,3` y las reentrantes `tokens/3,4` sobre un analizador léxico del runtime con los tokens, anotaciones, opciones, callbacks y errores de OTP; accesores y `format_error/1` en Erlang ([erl_scan](builtins.md#erl-scan)) |
| [`erl_internal`](../library/stdlib/erl_internal.erl), [`erl_anno`](../library/stdlib/erl_anno.erl) | Todas las funciones como builtins del runtime: tablas de BIF, guards, pruebas de tipos y operadores, funciones predefinidas y anotaciones de OTP ([tablas del compilador](builtins.md#compiler-tables)) |
| [`records`](../library/stdlib/records.erl), [`erl_features`](../library/stdlib/erl_features.erl) | Reflexión de native records, definiciones en tiempo de ejecución y definiciones compiladas con valores predeterminados plegados ([native records](native-records.md#reflection)); funcionalidades de OTP 29 y aquellas con las que se compiló cada módulo ([tablas del compilador](builtins.md#compiler-tables)) |
| [`binary`](../library/stdlib/binary.erl) | Todas las funciones; `replace/3,4` y `list_to_bin/1` en Erlang, las demás builtins del runtime ([módulo binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Todas las funciones como builtins del runtime ([módulo math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Todas las funciones como builtins del runtime: conversiones, `bin_is_7bit/1`, marcas de orden de bytes, formas de normalización, categorías y propiedades de identificadores ([módulo unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Todas las funciones sobre tablas generadas, los recorridos de chardata como builtins del runtime ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Todas las funciones salvo `import/1`, sobre PCRE2 ([módulo re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Todas las funciones documentadas: abrir, leer, escribir, posicionar y cerrar archivos (en disco, `compressed` o en memoria con `ram`), lecturas y escrituras posicionadas, `truncate/1`, `advise/4`, `allocate/3`, lecturas y escrituras de archivos completos, `consult/1`, `eval/1,2`, `script/1,2` y sus formas `path_` con `path_open/3` (el archivo se lee completo y se decodifica según su comentario de codificación, UTF-8 por defecto, como hace `epp:set_encoding/1` en [`clause_epp`](../library/stdlib/clause_epp.erl), y después se analiza forma por forma con los resultados y errores de OTP), información de archivos y sus cambios (`write_file_info/2,3`, `change_*`), operaciones de directorios sobre el driver de archivos, `sendfile/2,5` como alternativa por bloques de OTP y `format_error/1` ([archivos](ports.md#standard-io-and-files)) |
| [`erl_posix_msg`](../library/stdlib/erl_posix_msg.erl) | Módulo interno de OTP para `file:format_error/1`: `message/1` como builtin del runtime ([mensajes POSIX](builtins.md#posix-messages)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl), [`clause_socket`](../library/kernel/clause_socket.erl), [`clause_socket_options`](../library/kernel/clause_socket_options.erl) | Sockets sobre puertos de socket, con sus opciones, estadísticas, estado y listados ([sockets](ports.md#sockets)); `inet:get_rc/0` a partir de `clause_inet_config` |
| [`socket`](../library/kernel/socket.erl) | Todas las funciones documentadas en Erlang sobre los puertos del driver de sockets ([sockets](ports.md#sockets)): manejadores `{'$socket', Ref}` mantenidos por un proceso y una tabla `clause_socket_registry` (propietarios, estados, contadores, metadatos, monitores, listados), open/bind/listen/accept/connect, send/sendto/sendmsg/sendv/sendfile/sendmmsg, recv/recvfrom/recvmsg/recvmmsg con los errores de datos parciales de OTP, `nowait` como mensajes de finalización en Windows y mensajes select en otros sistemas, `cancel/2`, nombres de opciones y errores de valores no válidos de OTP, `info/0,1`, `i/0,1,2`, `supports/0,1,2`; las llamadas SCTP lanzan `notsup` y las solicitudes de interfaces se rechazan, como OTP en Windows |
| [`gen_sctp`](../library/kernel/gen_sctp.erl) | Todas las funciones documentadas: sin SCTP, por lo que `open/0,1,2` responden `{error, eprotonosupport}` tras las comprobaciones de opciones de OTP y las demás ven un socket cerrado o ajeno; `error_string/1` tiene los textos de OTP |
| [`inet_res`](../library/kernel/inet_res.erl), [`clause_inet_config`](../library/kernel/clause_inet_config.erl) | Todas las funciones documentadas en Erlang: cliente DNS de OTP sobre `gen_udp` y `gen_tcp` (reintentos, servidores de nombres alternativos, EDNS, truncamiento sobre TCP, esperas servfail, errores de OTP, listas de búsqueda, cadenas CNAME y hostents) con mensajes codificados y decodificados por el códec DNS de `clause_net` ([nombres de red](builtins.md#network-names)); configuración del resolvedor tal como la carga OTP en un nodo no distribuido (ninguna en Windows; `resolv.conf` y el archivo hosts en otros sistemas) |
| [`net`](../library/kernel/net.erl), [`clause_net`](../library/kernel/clause_net.erl) | Todas las funciones documentadas: búsquedas de anfitriones, direcciones y servicios y listas de interfaces como builtins del runtime con los resultados de prim_net, filtros en Erlang; sin espacios de nombres de red ([nombres de red](builtins.md#network-names)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Propio de Clause: el protocolo del driver de sockets que comparten los tres módulos anteriores |
| [`os`](../library/kernel/os.erl) | `cmd/1,2` sobre un puerto con el protocolo del shell de OTP, `max_size` y `exception_on_failure`; consultas de entorno, de hora y de versión, `find_executable/1,2` y `set_signal/2` como builtins ([módulo os](builtins.md#os-module)) |
| [`code`](../library/kernel/code.erl) | Consultas de módulos cargados sin servidor de código; la ruta de código en un término persistente con los cambios de ruta de OTP, búsquedas `lib_dir`/`priv_dir`, `where_is_file/1`, `all_available/0`, `clash/0`; respuestas de carga para código enlazado ([módulo code](builtins.md#code-module)) |
| [`application`](../library/kernel/application.erl), [`application_controller`](../library/kernel/application_controller.erl) | Todas las funciones documentadas: carga, claves, entornos, arranques con dependencias y fases de arranque, paradas, permisos y tipos de reinicio con los errores e informes de OTP, sobre un controlador iniciado en el primer uso y [`clause_application_master`](../library/kernel/clause_application_master.erl) ([aplicaciones](#applications)); se declinan la gestión de versiones, el arranque del sistema y el control distribuido |
| [`erlang`](../library/erts/erlang.erl) | Stubs generados de todas las exportaciones de `erlang` de OTP 29; los builtins del catálogo tienen cuerpos de marcador de posición, `nif_error/1,2` tienen cuerpo y los demás lanzan `{not_implemented, F, A}` al llamarlos ([módulo erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Las respuestas de un sistema arrancado; `boot/1`, `restart/0,1` y `make_permanent/2` se rechazan ([módulo init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Todas las funciones como builtins del runtime ([términos persistentes](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Todas las funciones ([atomics y counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Lo que llaman `stdlib` y `kernel`; los grupos de distribución, `.beam`, emulador y proceso purgador se declinan ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Consultas de archivos sobre `file`; la carga y los archivos comprimidos se declinan ([archivos](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Todas las funciones sobre el zlib fijado ([módulo zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` sobre los pasos de un receive compilado ([prim eval](builtins.md#prim-eval)) |
| Los módulos ASN.1 de `public_key` (`'OTP-PKIX'`, `'PKIX1Explicit-2009'`, ...) y [`public_key.hrl`](../library/public_key/include/public_key.hrl) | Generados al compilar a partir de [`library/public_key/asn1/`](../library/public_key/asn1) en `library-asn1/public_key/` del árbol de compilación ([public_key](public_key.md)) |
| [`public_key`](../library/public_key/public_key.erl), [`clause_public_key_codec`](../library/public_key/clause_public_key_codec.erl), [`clause_public_key_keys`](../library/public_key/clause_public_key_keys.erl), [`clause_public_key`](../library/public_key/clause_public_key.erl) | Aplicación `public_key` (con [`public_key.app`](../library/public_key/public_key.app)): codificación DER y PEM, cifrado PEM, claves privadas PKCS #8 de todos los tipos y certificados en las formas plain y otp sobre los módulos generados ([public_key](public_key.md#functions), [clave pública](builtins.md#public-key)); claves, firmas, cifrado RSA, generación y acuerdo de claves, firma de certificados sobre `crypto` (`clause_public_key_keys`, [claves](public_key.md#keys-and-signatures)); las funciones de validación son stubs |
| [`clause_asn1`](../library/asn1/clause_asn1.erl) | El códec al que llaman los módulos que clau genera a partir de especificaciones ASN.1 ([códec ASN.1](builtins.md#asn1-codec), [ASN.1](asn1.md)); no se proporciona la aplicación `asn1` de OTP (`asn1ct`, `asn1rt_nif`) |
| [`crypto`](../library/crypto/crypto.erl), [`clause_crypto`](../library/crypto/clause_crypto.erl) | Aplicación `crypto` (con [`crypto.app`](../library/crypto/crypto.app)), sobre libcrypto de OpenSSL en el archivo del runtime criptográfico ([módulo crypto](builtins.md#crypto-module), [OpenSSL](crypto.md)): listas de algoritmos del OpenSSL enlazado (`supports/0,1`, `hash_info/1`, `info/0`, `info_lib/0`), resúmenes y estados de hash, HMAC/CMAC/Poly1305 y estados de MAC, `pbkdf2_hmac/5`, `hash_equals/2`, `exor/2`, `mod_pow/3`, cifradores y sus estados (`crypto_init/3,4`, `crypto_update/2`, `crypto_final/1`, `crypto_get_data/1`, `crypto_one_time/4,5`, `cipher_info/1`), AEAD (`crypto_one_time_aead/4,6,7`, `crypto_one_time_aead_init/4`), números aleatorios criptográficamente seguros y los complementos de `rand` `crypto`, `crypto_cache`, `crypto_aes` y `crypto_prng1`, términos de error de OTP; motores rechazados (`notsup`); modo FIPS conmutable como el de OTP, o fijado con `clau --fips`; claves públicas (`sign/4,5`, `verify/5,6`, cifrado RSA, `generate_key/2,3`, `compute_key/4`, `privkey_to_pubkey/2`: RSA, DSA, DH, ECDSA/ECDH sobre curvas con nombre y explícitas, EdDSA, X25519/X448, ML-DSA, SLH-DSA, SRP), `ec_curve/1` y `ec_curves/0` (parámetros explícitos de libcrypto enlazado), ML-KEM (`encapsulate_key/2`, `decapsulate_key/3`) |

Los resultados y las razones de error coinciden con OTP 29, incluidas las
formas de error de las implementaciones en Erlang de OTP (`lists:map(F, x)` es
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)`
`badarg`) y de sus BIF (`lists:member/2`, `lists:keyfind/3`,
`lists:reverse/2`, las funciones de `maps`: `badarg`, `{badmap, M}`,
`{badkey, K}`). `lists:member/2` compara con `=:=`, `lists:keyfind/3` con `==`.
`lists:sort/1` es un builtin estable del runtime
([comparación y orden](terms.md#comparison-and-order)). Las trazas de pila
nombran las funciones de la biblioteca, no las de OTP.

## Shell interactivo

`shell:start_interactive/0,1` inicia el shell de Erlang sobre los flujos estándar,
y `clau --shell` lo enlaza en un ejecutable del que es el punto de entrada salvo
que `--entry` nombre otro ([compilación](compile.md#options)). El proceso
`clause_shell` ocupa el lugar de `user_drv` de OTP: imprime la versión del
sistema, inicia el servidor de `shell` e inicia uno nuevo cuando un shell
termina (`exit().`). El servidor lee cada comando mediante el servidor de
entrada estándar de `io`, reimprime el indicador en cada línea adicional de un
comando, conserva el historial e inicia el evaluador, que comprueba cada
expresión con `erl_lint`, expande records y la evalúa con `erl_eval`. Los
resultados se imprimen con los records del shell mediante el impresor con
formato del runtime (`clause_io_lib:pretty/2`, [io_lib](builtins.md#io-lib)). El
fin de la entrada termina el programa con estado 0 después de
`*** Terminating erlang (nonode@nohost)`.

Los comandos llaman a módulos por nombre, por lo que un programa que inicia el
shell necesita que todas las exportaciones sean invocables: `--shell` las
conserva ([vigencia de exportaciones](executables.md#export-liveness)) y enlaza
todos los módulos de biblioteca; un programa compilado sin él solo alcanza los
módulos que nombra. Las líneas de entrada se leen tal como las entrega el
terminal, editadas por el propio terminal: no hay edición de línea con `edlin`,
teclas de historial ni completado con tabulador
([diferencias](differences.md#interactive-shell)).

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
  por aplicación de OTP (`erts`, `kernel`, `stdlib`), y después
  `library-asn1/` del árbol de compilación, los módulos que la compilación genera
  a partir de las especificaciones ASN.1 de la biblioteca
  ([public_key](public_key.md)). `-include_lib("kernel/include/logger.hrl")`,
  `file.hrl`, `eep48.hrl` e `inet.hrl` (`#hostent{}`) se resuelven a las
  cabeceras propias de la biblioteca salvo que el proyecto nombre una aplicación
  `kernel`; `stdlib/include/` `zip.hrl`, `qlc.hrl`, `ms_transform.hrl` (nombra la
  transformación, que se ejecuta en el OTP del anfitrión:
  [transformaciones](transforms.md)) y `assert.hrl`, salvo que nombre una
  `stdlib`. `assert.hrl` tiene las macros, términos de error y conmutadores
  `NOASSERT`, `NODEBUG`, `ASSERT` de OTP. No se proporcionan las cabeceras
  internas de OTP (`erl_bits.hrl`, `erl_compile.hrl`) ni las de distribución
  (`dist.hrl`, `dist_util.hrl`, `net_address.hrl`), ni tampoco `inet_sctp.hrl`
  (sin SCTP).
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
- **Marcadores de posición de builtins:** una función implementada por un
  builtin del catálogo conserva su exportación y el cuerpo
  `F(_, ...) -> clause_builtin_placeholder.`, que nunca se ejecuta: el
  registro vincula el builtin en su lugar y una llamada cualificada `M:F(...)`
  se compila al puente. Solo una llamada sin cualificar dentro del módulo
  alcanzaría el marcador, así que el módulo llama a sus propios builtins de
  forma cualificada; `library_inventory` rechaza un marcador que no nombre
  ningún builtin del catálogo, un builtin del catálogo que siga como stub
  `not_implemented` y una llamada sin cualificar a un marcador.
- **Ausente:** Clause no incluye el módulo en absoluto, posiblemente para
  siempre, y registra el motivo y qué módulos de Clause de más alto nivel ocupan
  el lugar de sus llamantes (`library/modules.terms`). Las capas de bajo nivel
  `prim_*` de archivos y sockets (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) y `socket` son los módulos
  ausentes: los programas usan en su lugar `file`, `gen_tcp`, `gen_udp`,
  `inet` y `net` de Clause y, como los módulos de Clause prevalecen sobre los de OTP
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
  `clause_unicode`, `clause_zlib`, `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`,
  `clause_features`, `clause_io_lib`, `clause_disk_log`, `clause_dets`) están junto
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

### Funciones documentadas

`library/documented.terms` enumera las funciones públicas que OTP 29 documenta
para `erts`, `kernel`, `stdlib`, `crypto` y `public_key`: `{Module, Application, Name, Arity}.` por
función cuya documentación de módulo y de función no está oculta y que no
está obsoleta, observada de los bloques de documentación del OTP del anfitrión
mediante `tests/compiler/library/observe_docs.escript` (ejecutado
explícitamente). Las exportaciones no documentadas permanecen en los
inventarios, pero pueden seguir siendo stubs.

- `library_inventory` comprueba que cada función documentada de un módulo
  proporcionado esté en su inventario y no sea un stub, excepto en los módulos
  que `library_modules.py` enumera como parciales con el paso del plan que los
  completa.
- `python tests/compiler/library/library_modules.py coverage .` imprime los
  recuentos de funciones implementadas y documentadas de cada módulo documentado.

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

`file`, `io` y `code` de OTP llaman a servidores registrados
(`file_server_2`, `code_server`, el servidor io de un líder de grupo) que la
aplicación `kernel` arranca durante el inicio. Un ejecutable de Clause no
arranca ninguno de ellos: `file` e `io` propios de Clause no necesitan servidor,
`logger` de Clause inicia su servidor en el primer uso, y un módulo de OTP que
sí lo necesita falla de la misma manera que falla en OTP sin ese servidor
(`noproc`). Por tanto, el código de OTP que llama a `code` en tiempo de ejecución
no funciona. No está previsto arrancar la aplicación `kernel` completa.

### Aplicaciones

- Las especificaciones proceden del programa, no de una ruta de código: clau
  compila cada `*.app` y `*.app.src` junto a los fuentes del lote, cada `*.app`
  del directorio `ebin` junto a ellos, y `ebin/Name.app` o `src/Name.app.src` de
  cada entrada de `[targets.options.applications]` en el módulo generado
  `clause_applications`, añadido siempre que el lote tenga
  `application_controller`. Prevalece el primer archivo con un nombre de
  aplicación. Un recurso que no enumera módulos recibe los módulos del lote
  junto a él. Los diagnósticos apuntan al archivo de recursos.
- `application:load/1` también acepta términos `{application, Name, Keys}`. Un
  nombre sin recurso da `{error, {"no such file or directory", "Name.app"}}`,
  como responde OTP para un archivo ausente.
- `kernel` (11.0.4) y `stdlib` (8.1) están cargadas y en ejecución desde el
  inicio tal como las enumera OTP 29.1.1, sin procesos maestros de aplicación;
  `kernel` tiene el entorno predeterminado de su `kernel.app`.
- Una aplicación con un módulo de arranque recibe un proceso maestro que lidera
  el grupo de sus procesos (por lo que `get_application/0`, `get_env/1` y
  `start_type/0` responden dentro de él), retransmite sus solicitudes de E/S a
  la E/S estándar y, al detenerse, ejecuta `prep_stop/1`, apaga el proceso
  superior, ejecuta `stop/1` y mata lo que queda del grupo. Una aplicación
  permanente que termina, o una transitoria que termina de forma anormal,
  detiene el programa con el mensaje de OTP y estado de salida 1.
- `logger` y `clause_logger` llegan a `application` mediante un nombre en tiempo
  de ejecución, por lo que solo los programas que usan `application` lo enlazan.

### Registro de seguimiento

El plan del proyecto programa todos los módulos documentados de `erts`,
`kernel` y `stdlib`; los programas reales (luerl primero) fijan las
prioridades. Se compila y se ejecuta, se clasifica
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
