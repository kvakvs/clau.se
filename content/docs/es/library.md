---
source: docs/library.md
sourceCommit: 06042fa
sourceSha256: 8f2e8537bf42e4f4e23eff414105ee6bb25929992d881da864e86e3eee56eb56
translatedAt: 2026-10-09
---
# Módulos de biblioteca

Plan 11 step 39 (2026-10-07): un subconjunto propio del proyecto de los
módulos `lists` y `maps` de OTP, escrito en Erlang a partir del comportamiento
documentado de OTP (no copiado de los fuentes de OTP) y compilado junto con
los programas que lo usan.

## Contenido

| Módulo | Funciones |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1` |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1` |
| [`file`](../library/stdlib/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` sobre el driver de archivos ([archivos](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor de entrada estándar o un archivo abierto); `format/1,2` y `put_chars/1` son builtins del runtime |
| [`gen_tcp`](../library/stdlib/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` sobre puertos de socket ([sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/stdlib/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/stdlib/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/stdlib/clause_socket.erl) | Propio de Clause: el protocolo del driver de sockets que comparten los tres módulos anteriores |
| [`os`](../library/stdlib/os.erl) | `cmd/1` sobre un puerto ([subprocesos](ports.md#subprocesses)); `type/0` y `getenv/1` son builtins del runtime |

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
  módulo con un átomo literal — `M:F(...)` con `M` literal, `fun M:F/A`, o
  `apply(M, F, Args)` con `M` literal — que ninguna entrada define, y existe
  `<library>/M.erl`, el compilador analiza y compila ese archivo dentro del
  lote, y luego repite el proceso con los módulos que nombran los archivos
  añadidos. Una llamada `M:F(...)` a un builtin del catálogo (`io:format/2`,
  `os:type/0`) no nombra ningún módulo.
- `<library>` es `library/stdlib` del árbol de compilación, que se localiza
  de forma relativa a `clau`, igual que el archivo del runtime.
- Un módulo del lote con el mismo nombre sustituye al módulo de biblioteca.
- Los módulos de biblioteca son módulos ordinarios del lote: se enlazan en los
  ejecutables y, con salida de objeto o de IR, producen sus propios artefactos.
- Un módulo al que solo se llega mediante nombres en tiempo de ejecución
  (`M:F(...)` con `M` una variable) no se añade: esa llamada lanza `undef` a
  menos que otra cosa nombre el módulo.
- Las funciones de biblioteca son código Erlang, así que cederán el control
  (yield) como el resto del código cuando exista el planificador.
