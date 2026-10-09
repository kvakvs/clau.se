---
source: docs/library.md
sourceCommit: 06042fa
sourceSha256: 8f2e8537bf42e4f4e23eff414105ee6bb25929992d881da864e86e3eee56eb56
translatedAt: 2026-10-09
---
# Biblioteksmoduler

Plan 11 step 39 (2026-10-07): en delmängd av OTP:s moduler `lists` och
`maps` som ägs av projektet, skriven i Erlang utifrån OTP:s dokumenterade
beteende (inte kopierad från OTP:s källkod) och kompilerad tillsammans med de
program som använder den.

## Innehåll

| Modul | Funktioner |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1` |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1` |
| [`file`](../library/stdlib/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` ovanpå fildrivrutinen ([filer](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (server för standard-indata eller en öppen fil); `format/1,2` och `put_chars/1` är inbyggda funktioner i runtimen |
| [`gen_tcp`](../library/stdlib/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` ovanpå socketportar ([socketar](ports.md#sockets-57f)) |
| [`gen_udp`](../library/stdlib/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/stdlib/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/stdlib/clause_socket.erl) | Clauses egen: protokollet för socketdrivrutinen som de tre modulerna ovan delar |
| [`os`](../library/stdlib/os.erl) | `cmd/1` ovanpå en port ([delprocesser](ports.md#subprocesses)); `type/0` och `getenv/1` är inbyggda funktioner i runtimen |

Resultat och felorsaker stämmer med OTP 29, inklusive felens form i OTP:s
Erlang-implementationer (`lists:map(F, x)` är `{case_clause, x}`,
`lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)` `badarg`) och i
dess BIF:ar (`lists:member/2`, `lists:keyfind/3`, `lists:reverse/2`,
`maps`-funktionerna: `badarg`, `{badmap, M}`, `{badkey, K}`).
`lists:member/2` matchar med `=:=`, `lists:keyfind/3` med `==`.
`lists:sort/1` är en stabil merge sort. Stackspårningar anger
biblioteksfunktionerna, inte OTP:s.

## Hur program får dem

- När en batch (positionella indata eller ett projektmål) anger en modul med
  en literal atom — `M:F(...)` med literal `M`, `fun M:F/A`, eller
  `apply(M, F, Args)` med literal `M` — som inga indata definierar, och
  `<library>/M.erl` finns, tolkar och kompilerar kompilatorn den filen in i
  batchen och upprepar sedan för de moduler som de tillagda filerna anger.
  Ett anrop `M:F(...)` av en inbyggd funktion i katalogen (`io:format/2`,
  `os:type/0`) anger ingen modul.
- `<library>` är `library/stdlib` i byggträdet, som hittas relativt till
  `clau` på samma sätt som runtime-arkivet.
- En modul i batchen med samma namn ersätter biblioteksmodulen.
- Biblioteksmoduler är vanliga batchmoduler: de länkas in i körbara filer och
  producerar, för objekt- eller IR-utdata, egna artefakter.
- En modul som endast nås genom namn under körning (`M:F(...)` där `M` är en
  variabel) läggs inte till: ett sådant anrop kastar `undef` om inte något
  annat anger modulen.
- Biblioteksfunktioner är Erlang-kod, så de kommer att lämna ifrån sig
  körningen som annan kod när schemaläggaren finns.
