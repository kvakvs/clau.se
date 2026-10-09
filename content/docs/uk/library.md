---
source: docs/library.md
sourceCommit: 06042fa
sourceSha256: 8f2e8537bf42e4f4e23eff414105ee6bb25929992d881da864e86e3eee56eb56
translatedAt: 2026-10-09
---
# Модулі бібліотеки

План 11, крок 39 (2026-10-07): власна підмножина проєкту з модулів OTP
`lists` і `maps`, написана на Erlang за документованою поведінкою OTP (не
скопійована з вихідних кодів OTP) і скомпільована разом із програмами, що її
використовують.

## Вміст

| Модуль | Функції |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1` |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1` |
| [`file`](../library/stdlib/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` поверх файлового драйвера ([файли](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (сервер стандартного вводу або відкритий файл); `format/1,2` і `put_chars/1` є вбудованими функціями runtime |
| [`gen_tcp`](../library/stdlib/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` поверх портів-сокетів ([сокети](ports.md#sockets-57f)) |
| [`gen_udp`](../library/stdlib/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/stdlib/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/stdlib/clause_socket.erl) | Власний модуль Clause: протокол драйвера сокетів, спільний для трьох модулів вище |
| [`os`](../library/stdlib/os.erl) | `cmd/1` через порт ([підпроцеси](ports.md#subprocesses)); `type/0` і `getenv/1` є вбудованими функціями runtime |

Результати й причини помилок збігаються з OTP 29, включно з формою помилок
реалізацій OTP на Erlang (`lists:map(F, x)` дає `{case_clause, x}`,
`lists:nth(0, L)` — `function_clause`, `lists:seq(1, 10, 0)` — `badarg`) і
його BIF (`lists:member/2`, `lists:keyfind/3`, `lists:reverse/2`, функції
`maps`: `badarg`, `{badmap, M}`, `{badkey, K}`). `lists:member/2` порівнює
через `=:=`, `lists:keyfind/3` — через `==`. `lists:sort/1` — це стабільне
сортування злиттям. Трасування стека називають функції бібліотеки, а не OTP.

## Як програми їх отримують

- Коли пакет (batch; позиційні вхідні файли або одна ціль проєкту) називає
  модуль літеральним атомом — `M:F(...)` з літеральним `M`, `fun M:F/A` або
  `apply(M, F, Args)` з літеральним `M`, — який не визначено в жодному
  вхідному файлі, і існує `<library>/M.erl`, компілятор розбирає й компілює
  цей файл у пакет, а потім повторює це для модулів, які називають додані
  файли. Виклик `M:F(...)` вбудованої функції каталогу (`io:format/2`,
  `os:type/0`) не називає модуля.
- `<library>` — це `library/stdlib` дерева збірки, що знаходиться відносно
  `clau`, як і архів runtime.
- Модуль пакета з тим самим ім'ям замінює модуль бібліотеки.
- Модулі бібліотеки — звичайні модулі пакета: вони компонуються у виконувані
  файли, а для виводу об'єктних файлів чи IR створюють власні артефакти.
- Модуль, до якого звертаються лише через імена під час виконання
  (`M:F(...)` зі змінною `M`), не додається: такий виклик породжує `undef`,
  якщо щось інше не називає цей модуль.
- Функції бібліотеки — це код на Erlang, тож вони поступатимуться процесором
  (yield), як і інший код, щойно з'явиться планувальник.
