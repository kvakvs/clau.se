---
source: docs/library.md
sourceCommit: 06042fa
sourceSha256: 8f2e8537bf42e4f4e23eff414105ee6bb25929992d881da864e86e3eee56eb56
translatedAt: 2026-10-09
---
# Bibliotheksmodule

Plan 11, step 39 (2026-10-07): eine projekteigene Teilmenge der OTP-Module
`lists` und `maps`, in Erlang nach dem dokumentierten Verhalten von OTP
geschrieben (nicht aus OTP-Quelltexten kopiert) und mit den Programmen
kompiliert, die sie verwenden.

## Inhalt

| Modul | Funktionen |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1` |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1` |
| [`file`](../library/stdlib/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` über den Dateitreiber ([Dateien](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (Server der Standardeingabe oder eine geöffnete Datei); `format/1,2` und `put_chars/1` sind Runtime-Builtins |
| [`gen_tcp`](../library/stdlib/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` über Socket-Ports ([Sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/stdlib/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/stdlib/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/stdlib/clause_socket.erl) | Clauses eigenes: das Protokoll des Socket-Treibers, das die drei obigen Module gemeinsam nutzen |
| [`os`](../library/stdlib/os.erl) | `cmd/1` über einen Port ([Unterprozesse](ports.md#subprocesses)); `type/0` und `getenv/1` sind Runtime-Builtins |

Ergebnisse und Fehlergründe entsprechen OTP 29, einschließlich der
Fehlerformen der Erlang-Implementierungen von OTP (`lists:map(F, x)` ergibt
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`,
`lists:seq(1, 10, 0)` `badarg`) und seiner BIFs (`lists:member/2`,
`lists:keyfind/3`, `lists:reverse/2`, die `maps`-Funktionen: `badarg`,
`{badmap, M}`, `{badkey, K}`). `lists:member/2` vergleicht mit `=:=`,
`lists:keyfind/3` mit `==`. `lists:sort/1` ist ein stabiler Mergesort.
Stacktraces nennen die Bibliotheksfunktionen, nicht die von OTP.

## Wie Programme sie erhalten

- Nennt ein Batch (positionelle Eingaben oder ein Projektziel) ein Modul mit
  einem literalen Atom — `M:F(...)` mit literalem `M`, `fun M:F/A` oder
  `apply(M, F, Args)` mit literalem `M` —, das keine Eingabe definiert, und
  existiert `<library>/M.erl`, parst und kompiliert der Compiler diese Datei
  in den Batch und wiederholt das für die Module, die die hinzugefügten Dateien
  nennen. Ein Aufruf `M:F(...)` eines Katalog-Builtins (`io:format/2`,
  `os:type/0`) nennt kein Modul.
- `<library>` ist `library/stdlib` des Build-Baums, relativ zu `clau` gefunden
  wie das Runtime-Archiv.
- Ein Modul des Batches mit demselben Namen ersetzt das Bibliotheksmodul.
- Bibliotheksmodule sind gewöhnliche Batch-Module: Sie werden in ausführbare
  Dateien gelinkt und erzeugen bei Objekt- oder IR-Ausgabe eigene Artefakte.
- Ein Modul, das nur über Laufzeitnamen erreicht wird (`M:F(...)` mit `M` als
  Variable), wird nicht hinzugefügt: Ein solcher Aufruf löst `undef` aus, sofern
  nicht etwas anderes das Modul nennt.
- Bibliotheksfunktionen sind Erlang-Code, daher geben sie wie anderer Code ab,
  sobald der Scheduler existiert.
