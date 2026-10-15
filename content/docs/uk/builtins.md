---
source: docs/builtins.md
sourceCommit: 6ed3851c
sourceSha256: 35d165fa6e573a993a44f0a3284aa944f79954a0af62fd2b79e6b20fe728a9d9
translatedAt: 2026-10-15
---
# Вбудовані функції

Робочий міст вбудованих функцій (builtins).
Вбудовані функції — це функції `erlang`, які runtime реалізує мовою C++.
Runtime реєструє їх за модулем, функцією та арністю; згенерований код досягає
їх безпосередньо, через динамічні виклики та як значення fun.

## Які вбудовані функції існують

Каталог мосту `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) перелічує кожну
вбудовану функцію, яку знають і компілятор, і runtime:

- guard BIF: перевірки типів (`is_atom/1` … `is_tuple/1`, `is_function/1,2`),
  `abs/1`, `bit_size/1`, `byte_size/1`, `ceil/1`, `element/2`, `float/1`,
  `floor/1`, `hd/1`, `length/1`, `map_get/2`, `map_size/1`, `is_map_key/2`,
  `max/2`, `min/2`, `round/1`, `size/1`, `tl/1`, `trunc/1`, `tuple_size/1`,
  `binary_part/2,3`;
- оператори як функції: порівняння, `not/1`, `and/2`, `or/2`, `xor/2`,
  арифметичні та побітові оператори (`erlang:'+'/1,2` …);
- `display/1`, `halt/0,1`, `error/1,2,3`, `exit/1`, `throw/1`, `raise/3` і
  `function_exported/3`;
- доступ до термів: `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` і спискові оператори `'++'/2` та
  `'--'/2` (`A ++ B`, `A -- B` понижуються до них);
- перетворення: `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` не вибрано);
- консольний вивід: `io:format/1,2` і `io:put_chars/1`, перші
  вбудовані функції іншого модуля ([io](io.md)); пристрої виводу:
  `io:format/3`, `io:fwrite/1,2,3`, `io:put_chars/2`, `io:nl/0,1`;
- функції даних `lists` ([модуль lists](#lists-module));
- кожна функція `math` ([модуль math](#math-module));
- модуль `binary` ([модуль binary](#binary-module));
- запити `os` щодо середовища, процесу й версії та BIF `maps`
  ([модуль maps](#maps-module));
- `persistent_term` ([persistent terms](#persistent-terms));
- перетворення `unicode` ([модуль unicode](#unicode-module));
- запити модуля `code` щодо завантажених модулів ([модуль code](#code-module));
- відповіді модуля `init` щодо командного рядка ([модуль init](#init-module));
- `atomics`, `counters` і функції `erts_internal`, які викликає stdlib
  ([atomics і counters](#atomics-and-counters), [erts_internal](#erts-internal));
- таблиці `unicode_util` ([unicode_util](#unicode-util));
- ідентичності процесів: `self/0`, `make_ref/0`,
  `pid_to_list/1` і `ref_to_list/1`
  ([pid і посилання](terms.md#pids-and-references));
- процеси: `spawn/1,3` і `is_process_alive/1`
  ([процеси](processes.md)); зв'язки та сигнали виходу:
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([зв'язки](processes.md#links)); монітори:
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([монітори](processes.md#monitors)); зареєстровані імена:
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([зареєстровані імена](processes.md#registered-names));
- повідомлення: `'!'/2` (оператор `!`) і `send/2`
  ([повідомлення](processes.md#messages));
- словник процесу: `put/2`, `get/0,1`, `get_keys/0,1`, `erase/0,1`
  ([словник процесу](processes.md#process-dictionary));
- перетворення binary, атомів і чисел: `atom_to_binary/1,2`,
  `binary_to_atom/1,2`, `binary_to_existing_atom/1,2`,
  `list_to_existing_atom/1`, `integer_to_binary/1,2`, `binary_to_integer/1,2`,
  `float_to_binary/1,2`, `binary_to_float/1`, `list_to_float/1`,
  `binary_to_list/3`, `bitstring_to_list/1`, `list_to_bitstring/1`,
  `split_binary/2`, `iolist_size/1`, `list_to_pid/1`, `list_to_ref/1`. Вони
  поділяють правила тексту спискових перетворень (`conversion_text.cpp`:
  імена атомів, цифри, параметри float) і помилки OTP: текст float потребує
  цифр з обох боків крапки (`list_to_float("1e10")` дає `badarg`), експонента
  поза діапазоном — `badarg`, а антипереповнення — `0.0`; кодування — `utf8`,
  `unicode` і `latin1`; вони виконуються до кінця;
- [зовнішній формат термів](#external-term-format):
  `term_to_binary/1,2`, `term_to_iovec/1,2`, `external_size/1,2`,
  `binary_to_term/1,2`;
- [час](#time) і унікальні значення: `monotonic_time/0,1`,
  `system_time/0,1`, `time_offset/0,1`, `convert_time_unit/3`,
  `timestamp/0`, `now/0`, `unique_integer/0,1`, `localtime/0`,
  `universaltime/0`, `date/0`, `time/0`, `localtime_to_universaltime/1,2`,
  `universaltime_to_localtime/1`, `posixtime_to_universaltime/1`,
  `universaltime_to_posixtime/1`; [таймери](processes.md#timers):
  `start_timer/3,4`, `send_after/3,4`, `cancel_timer/1,2`, `read_timer/1,2`;
- [інтроспекція процесів](processes.md#introspection):
  `process_info/1,2`, `processes/0`, `group_leader/0,2`,
  `garbage_collect/0,1,2`, `yield/0`;
  [системна інформація](#system-information): `statistics/1`,
  `system_info/1`, `memory/0,1`;
- [параметри запуску та псевдоніми](processes.md#spawn-options):
  `spawn_opt/2..5`, `spawn_request/1..5`, `spawn_request_abandon/1`,
  `alias/0,1`, `unalias/1`, `monitor/3`, `hibernate/3`;
- [інформація про fun](funs.md#fun-information), [хешування](#hashing) і
  MD5: `fun_info/1,2`, `fun_to_list/1`, `is_builtin/3`,
  `phash/2`, `phash2/1,2`, `md5/1`, `md5_init/0`, `md5_update/2`,
  `md5_final/1`;
- [вузли](processes.md#nodes) і [завантаження коду](#code-loading):
  `nodes/0,1,2`, `is_alive/0`, `monitor_node/2,3`,
  `disconnect_node/1`, `module_loaded/1`, `loaded/0`, `pre_loaded/0`,
  `delete_module/1`, `prepare_loading/2`, `finish_loading/1`,
  `get_module_info/1,2`.

Записи лише дописуються в кінець: індекс запису — це число, яке згенерований
код передає сервісу мосту. Кваліфікований виклик вбудованої функції з
каталогу, що належить іншому модулю (`io:format(F, A)`), також викликає міст.
Кожна інша функція `erlang` досягає
[бібліотечного модуля erlang](#erlang-module).

## Як виклики їх досягають

| Вихідний код | Шлях |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Вбудовані сервіси, як і до появи мосту |
| `erlang:function_exported(M, F, A)`, `setelement(I, T, V)`, `A ++ B`, `A -- B`, `length(L)` у тілі (вбудовані функції каталогу без вбудованого сервісу) | Вхід як у функцію: `CLAUSE_builtin_frame_v1(context, index)` дає фрейм вбудованої функції, аргументи передаються в регістрах ([порції](#portions)) |
| `fun abs/1`, `fun erlang:'+'/2` | Зовнішній fun `erlang:F/A`; реєстрація прив'язує його до вбудованої функції |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` під час виконання | Сервер коду спершу шукає експорт модуля, потім вбудовану функцію |

- `fun F/A` для автоімпортованої вбудованої функції, яку модуль не визначає і
  не приглушує (`-compile({no_auto_import, ...})`), — це зовнішній fun
  `erlang:F/A`, як в OTP: `fun abs/1 =:= fun erlang:abs/1`, і він друкується як
  `fun erlang:abs/1`. `halt/0,1`, `setelement/3`, `tuple_to_list/1`,
  `list_to_tuple/1`, перетворення, вбудовані функції процесів і вбудовані
  функції портів `open_port/2`, `port_close/1`, `port_command/2,3`,
  `port_connect/2`, `port_control/3`, `port_to_list/1`, `list_to_port/1`
  автоімпортуються, як в OTP; `display/1`, `raise/3`, `function_exported/3`,
  `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3` і `ports/0` потребують
  префікса `erlang:` ([порти](ports.md#builtins-and-port-messages)).
- Вбудована функція має `FrameDescriptor` з порожнім (null) тілом
  (`BuiltinFrame`). Вхід у неї (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) не додає
  фрейму: вбудована функція працює з регістрами, а її результат повертається в
  тіло викликача, тож вбудована функція у хвостовій позиції повертає керування
  викликачеві викликача.
- Помилки ті самі, що їх викликає вбудоване пониження в тілі: `badarg`,
  `badarith` для арифметики, `system_limit`, `{badmap, M}`, `{badkey, K}`;
  `raise/3` з недійсним класом або стеком повертає `badarg`. Вони проходять
  через перевірений канал невдач, як і кожна помилка сервісу.
- Доступ до термів дотримується правил `badarg` з OTP: `setelement/3` потребує
  малого цілого індексу в межах кортежу; `make_tuple/2,3` — малого розміру в
  діапазоні 0..16 777 215, а `make_tuple/3` — правильного списку пар
  `{Index, Value}` у межах розміру (пізніші пари мають перевагу);
  `list_to_tuple/1` — правильного списку; `A ++ B` — правильного списку `A`
  (`[] ++ B` дає `B` для будь-якого `B`, не-список `B` завершує результат);
  `A -- B` — двох правильних списків, де кожен елемент `B` вилучає перший точно
  рівний (`=:=`) елемент `A`, за O((n + m) log m).
- Перетворення дотримуються OTP:
  - `list_to_atom/1` приймає правильний список кодових точок (без сурогатів);
    256-й символ дає `system_limit` ще до перевірки. Заповнена таблиця атомів
    (`--max-atoms`) зупиняє програму як невдача runtime (`resource_limit`, код
    виходу 70).
  - `integer_to_list/2` і `list_to_integer/2` приймають малу основу в діапазоні
    2..36; цифри друкуються у верхньому регістрі й розбираються в будь-якому.
    `list_to_integer` приймає один необов'язковий знак, пропускає початкові
    нулі, потребує хоча б однієї цифри і викликає `system_limit` для понад
    1 262 611 значущих десяткових цифр (або 4 194 304 у будь-якій основі),
    щойно його перші цифри дійсні, а також для значення понад межу цілих чисел.
  - `float_to_list/1` — це `"%.20e"`; параметри `/2` застосовуються по порядку,
    і перемагає останній формат: `{scientific, D}` (`"%.*e"`, від'ємне D дає 6),
    `{decimals, D}` (D >= 0; фіксований формат із власним округленням OTP
    нижче 2^53 і 19 десяткових знаків, `compact` обрізає кінцеві нулі, також
    для цілого числа з `{decimals, 0}` понад 2^53), `short` (найкоротші цифри
    для точного відновлення з вибором OTP між фіксованим і науковим форматом).
    Текст завдовжки 256 байтів або більше дає `badarg`.
  - `binary_to_list/1` потребує binary; `list_to_binary/1` — списку, а
    `iolist_to_binary/1` — списку або binary з байтів, binary і вкладених
    списків, кожен з яких закінчується `[]` або binary.
- `function_exported(M, F, A)` викликає `badarg`, якщо `M` і `F` не атоми або
  `A` не мале ціле число; вона істинна, коли модуль програми експортує `M:F/A`
  або `M:F/A` є зареєстрованою вбудованою функцією.

## Модуль lists

Джерело: `runtime/src/builtins/lists/`. `lists` в OTP — це код Erlang (крім
кількох BIF), тож вбудовані функції Clause викликають те, що викликають
клаузи OTP:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` і
  `keydelete/3` викликають `function_clause` для аргументу, якого не приймає
  жодна клауза OTP, і обходять списки так само ліниво, як OTP:
  `sublist([a | b], 1)` дає `[a]`, `nthtail(1, [a | b])` дає `b`, `flatten/2`
  не перевіряє свій хвіст далі за `is_list`.
- `keymember/3` і `keysearch/3` в OTP є BIF: `badarg` для позиції, що не є
  додатним малим цілим, або для неправильного хвоста, досягнутого до збігу.
- Ключі та порядок порівнюються через `==` і порядок термів; з рівних при
  порівнянні елементів перемагає перший (`max([1, 1.0])` дає `1`,
  `usort([1.0, 1])` дає `[1.0]`, `umerge/1,2` зберігають елемент ранішого
  списку).
- Вони виконуються до кінця. Функції, що приймають fun (`foreach/2`,
  `mapfoldl/3`, `mapfoldr/3`, `splitwith/2`, `partition/2`, `filtermap/2`,
  `uniq/2`, ...), написані на Erlang у `library/stdlib/lists.erl`, бо вбудована
  функція не може викликати fun і отримати його результат; так само
  `prefix/2`, `suffix/2` і `uniq/1`, з клаузами та guards OTP.
- `function_clause` з вбудованої функції не має власного фрейму
  ([відмінності](differences.md)).

## Модуль math

Джерело: `runtime/src/builtins/math.cpp`. `library/stdlib/math.erl` містить
експорти OTP 29 як заглушки; кожен із них — вбудована функція поверх
бібліотеки C (`pi/0` і `tau/0` — константи). Аргументи — числа, перетворені
на float: будь-що інше дає `badarg`, ціле число, завелике для float, —
`badarith`. Результат, що не є скінченним float (помилка області визначення,
як-от `sqrt(-1)`, `log(0)`, `acos(2)`, або переповнення, як-от
`pow(10, 400)`, `exp(1000)`), дає `badarith`. `floor/1` і `ceil/1`
повертають float. Результати — ті, що дає бібліотека C хоста, і можуть
відрізнятися від OTP в останньому біті ([відмінності](differences.md)). На
64-бітних цілях згенерований код обчислює `sqrt`, `floor`, `ceil` (інтринсики
LLVM) і `exp`, `log`, `log2`, `log10`, `sin`, `cos`, `pow` (ті самі функції
бібліотеки C, викликані без підстановок LLVM) для числових аргументів inline
у комірку float; інші операнди та нескінченні результати викликають
вбудовану функцію, яка генерує виняток.

## Модуль binary

Джерело: `runtime/src/builtins/binary/`. `library/stdlib/binary.erl` містить
експорти OTP 29; `replace/3,4` (включно із заміною через fun і
`{insert_replaced, ...}`) і `list_to_bin/1` написані на Erlang поверх
вбудованих функцій, кожна інша функція — вбудована:

- Шаблони — це непорожній binary, непорожній список непорожніх binary або
  скомпільований шаблон. Збіг — це крайня ліва позиція, а в ній найдовший
  шаблон; `matches/2,3` і `split/2,3` з `global` беруть неперекривні збіги
  зліва. `{scope, {Start, Length}}` обмежує, де збіги можуть починатися й
  закінчуватися (від'ємна довжина лічить назад); `split/3` також приймає
  `global`, `trim` і `trim_all`.
- `compile_pattern/1` повертає `{bm, [Pattern]}` або `{ac, Patterns}` —
  власну форму Clause (OTP: посилання всередині кортежу,
  [відмінності](differences.md)).
- `part/2,3`, `bin_to_list/2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` і
  `decode_hex/1` дотримуються OTP; кожен неправильний аргумент (bitstring,
  діапазон поза суб'єктом, невідомий параметр) дає `badarg`.
- `referenced_byte_size/1` — це власний розмір binary.
- Вони виконуються до кінця.

## Модуль maps

Джерело: `runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` і `from_keys/2` — вбудовані
  функції з помилками OTP: не-map дає `{badmap, Map}`, відсутній ключ
  `update/3` — `{badkey, Key}`, список ключів, що не є правильним списком, —
  `badarg`. Ключі зіставляються точно (`1` і `1.0` — різні ключі).
  `filter/2`, `map/2`, `foreach/2` і `update_with/3,4` написані на Erlang у
  `library/stdlib/maps.erl`.
- `os:getenv/0` (рядки `"Name=Value"`; записи Windows для окремих дисків
  `=C:` пропускаються), `os:env/0` (пари `{Name, Value}`), `os:putenv/2`,
  `os:unsetenv/1` (`badarg`, якщо аргументи не рядки або ім'я порожнє чи
  містить `=`), `os:getpid/0` і `os:version/0` — вбудовані функції;
  `os:timestamp/0`, `os:system_time/0,1`, `os:perf_counter/0,1` і
  `os:getenv/2` написані на Erlang поверх вбудованих функцій часу `erlang` і
  `getenv/1`.

## Persistent terms

Plan 11 step 41M2 (`runtime/src/builtins/persistent_term.cpp`) поверх
таблиці runtime ([runtime](runtime.md#persistent-terms)). `put/2` і
`put_new/2` повертають `ok` (`put_new/2` для збереженого ключа дає `ok` для
точно рівного значення, інакше `badarg`); `get/1` для незбереженого ключа дає
`badarg`, `get/2` повертає значення за замовчуванням; `get/0` перелічує кожну
пару `{Key, Value}`; `erase/1` повідомляє, чи ключ був збережений; `info/0`
дає `#{count => N, memory => Bytes}` (слова збережених копій). Ключі
зіставляються точно (`1` і `1.0` різні). Кожне читання копіює значення в купу
того, хто викликає.

## Модуль unicode

Джерело: `runtime/src/builtins/unicode/`. `library/stdlib/unicode.erl`
містить експорти й типи OTP 29; `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` і
`encoding_to_bom/1` — вбудовані функції, функції нормалізації, категорій та
ідентифікаторів лишаються заглушками; тепер їх можна написати поверх
[unicode_util](#unicode-util), коли вони потрібні програмі.

- Кодування: `latin1`, `unicode`/`utf8`, `utf16` і `utf32`, за замовчуванням
  big endian або `{utf16 | utf32, big | little}`; будь-що інше дає `badarg`
  (`encoding_to_bom/1`: `function_clause`, як в OTP).
- Chardata — це binary або список, можливо неправильний з хвостом-binary, з
  кодових точок, binary у вхідному кодуванні та вкладених chardata; послідовні
  binary декодуються як один потік, тож символ може охоплювати два.
  Будь-що інше дає `badarg`.
- Символ, якого вивід не може прийняти (недійсна кодова точка або
  послідовність байтів, код понад 255 для виводу `latin1`), завершує
  перетворення з `{error, Converted, Rest}`; вхідні дані, що закінчуються
  всередині символу, — з `{incomplete, Converted, Rest}`. `Rest` має форму
  OTP: неперетворена частина найглибшого списку, на чолі якої стоїть елемент,
  що спричинив збій (binary — як його неперетворений суфікс, окремо, коли він
  завершує верхній рівень), усередині залишку хвоста кожного охопного
  списку; незавершені байти, перенесені з binary, ідуть першими, а з виводом
  `latin1` ціле число, що спричинило збій, загортається в список.
- `bin_is_7bit/1` хибна для будь-чого, крім binary з байтів нижче 128.

## Модуль code

Джерело: `runtime/src/builtins/code.cpp`. `library/kernel/code.erl` містить
експорти й типи OTP 29; процесу `code_server` немає, а запити щодо
завантажених модулів відповідають для скомпонованої програми: модуль
завантажено, коли програма його має (скомпільований код або вбудовані функції
runtime). `ensure_loaded/1` дає `{module, M}` або `{error, nofile}`,
`ensure_modules_loaded/1` — `ok` або `{error, [{M, nofile}]}`, `is_loaded/1` —
`{file, preloaded}` або `false`, `which/1` — `preloaded` або `non_existing`,
`module_status/1` — `loaded` або `not_loaded`, `all_loaded/0` і
`module_status/0` перелічують кожен модуль, `is_sticky/1` дає `false`.
Аргумент-модуль, що не є атомом, дає `function_clause`. Шляхи коду та
завантаження лишаються заглушками до [step 71](../.agents/11-plan.md#step-71).
Шлях помилки `io_lib:format/2` з OTP (`code:ensure_modules_loaded/1`) тепер
генерує початковий `badarg`.

## Модуль init

Джерело: `runtime/src/builtins/init.cpp`, `library/erts/init.erl`.
Виконуваний файл — це запущена система без скрипту завантаження. Під час
запуску командний рядок декодується один раз (`ProgramArguments`,
`runtime/src/startup/arguments.cpp`): аргументи після параметрів runtime є
водночас argv вхідної функції арності 1 і `get_plain_arguments/0`. Прапорців
емулятора немає; єдиний прапорець — `home`, що встановлюється під час
запуску так, як його встановлює `erlexec` в OTP (`HOME`; у Windows
`HOMEDRIVE` і `HOMEPATH`, інакше `USERPROFILE`), тож `get_argument(home)` дає
`{ok, [[Home]]}`, `get_arguments/0` — `[{home, [Home]}]`, а кожен інший
прапорець — `error`. `script_name/0` — абсолютний шлях до виконуваного файлу
з прямими скісними рисками. Ці чотири — вбудовані функції; решта написані на
Erlang:

- відповіді запущеного `init` з OTP: `get_status/0` `{started, started}`,
  `notify_when_started/1` `started`, `ensure_loaded/1` `not_allowed`,
  `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (чекає на
  `{init, started}`); `get_configfd/1` і `set_configfd/2` зберігають свої
  значення в `persistent_term` під `{init, configfd, Id}`;
- `script_id/0` дає `{"Clause", "29"}`;
- `stop/0,1` і `reboot/0` зупиняють роботу одразу за правилами статусу OTP:
  невід'ємне ціле — код виходу, список байтів — гасло зупинки, будь-який
  інший аргумент — `badarg`;
- відхиляються: `boot/1` і `restart/0,1` генерують `notsup` після перевірок
  аргументів OTP (`restart/1` для списку, що не є `[]` чи `[{mode, M}]`, дає
  `badarg`), `make_permanent/2` повертає `{error, notsup}` для дійсних імен і
  `{error, badarg}` в іншому разі.

## Unicode util

Джерело: `library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`.
OTP генерує `unicode_util` під час збирання (900 KB коду Erlang); Clause
тримає дані в згенерованих таблицях C++ (`unicode/tables.cpp`), до яких
звертаються вбудовані функції його приватного модуля `clause_unicode`
(`table/1`, `class/1`, `cases/1`, `flags/1`, `compose_pair/2`), а
`unicode_util.erl` відповідає на функції OTP поверх них із формами
результатів OTP:

- `cp/1` бере першу кодову точку chardata так, як це робить OTP, зберігаючи
  хвости-binary і сплощуючи до трьох наступних кодових точок вкладених
  списків; `{error, Rest}` на недійсному UTF-8;
- `lookup/1`, `category/1`, `get_case/1`, `spec_version/0` (`{17, 0}`),
  `pattern_whitespace/0`; `uppercase/1`, `lowercase/1`, `titlecase/1`,
  `casefold/1` відображають першу кодову точку (`{badarg, Rest}` на
  недійсному UTF-8); `is_wide/1`, `is_whitespace/1`, `is_other_id_start/1`,
  `is_other_id_continue/1`, `is_letter_not_pattern_syntax/1`;
- `gc/1`: розширені кластери графем за UAX #29, з порядком правил OTP (CR LF,
  керувальні символи, швидкі шляхи Latin-1, prepend, склади хангиль, пари
  регіональних індикаторів, розширені піктографічні та ZWJ-послідовності,
  індійські кон'юнкти) і його формами результатів: кластер — це кодова точка
  або список, а решта лишається тими chardata, з яких вона походить, там, де
  їх зберігає OTP (`{error, Rest}` на недійсному UTF-8);
- `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` нормалізують перший кластер:
  канонічна або сумісна декомпозиція з алгоритмічним хангилем, стабільне
  канонічне впорядкування, потім композиція за парами композиції.

`tools/unicode/generate.py` записує таблиці один раз на кожне оновлення
Unicode: відображення регістру, категорії (включно з сусідніми категоріями,
які генератор OTP дає деяким непризначеним кодовим точкам), декомпозиції та
предикати властивостей беруться з відповідей OTP хоста для кожної кодової
точки (`tools/unicode/observe.escript`), а дані розривів графем, емодзі,
індійських письмен і композиції — з файлів Unicode Character Database, які
фіксує OTP 29 (`lib/stdlib/uc_spec`, Unicode 17.0). Комітяться лише
згенеровані таблиці, з повідомленням про авторські права Unicode, якого
вимагає Unicode License v3; звичайні збирання не потребують ні OTP, ні файлів
даних. Тест `executables_unicode_tables` порівнює дайджести відповідей для
площини 0 і вибіркових блоків інших площин з OTP (під час генерації таблиць
збіглися всі 1.1M кодових точок); `executables_unicode_clusters` порівнює
кластери та нормальні форми вручну дібраних рядків для кожного правила і
відтворюваний прогін 2000 випадкових рядків.

## Модуль zlib

Джерело: `runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.
Runtime компонується із zlib 1.3.2, випуском, який постачає OTP 29
([zlib](compile.md#zlib)), тож стиснені байти збігаються з OTP для кожного
рівня, стратегії, розміру вікна та flush. Потік — це
[посилання-дескриптор](runtime-heap.md#handle-references), буфер якого
містить `z_stream`; його фіналізатор завершує активний сеанс, коли помирає
остання копія. Приватні вбудовані функції `clause_zlib` (`open/0`,
`close/1`, `set_controller/2`, `deflate_init/2`, `inflate_init/3`,
`deflate/3`, `inflate/2`, виклики завершення, скидання, параметрів і
словника) виконують одну операцію над усіма своїми вхідними даними;
`zlib.erl` зберігає API OTP, помилки аргументів (`bad_compression_level`,
`bad_windowbits`, ...), стани потоку (`not_initialized`,
`already_initialized`, `not_on_controlling_process`, закритий потік, що
відмовляє в новій ініціалізації), `eos_behavior` (`cut`, `reset`, `error`),
`data_error` від `inflateEnd/1` до кінця потоку, словники
(`{need_dictionary, Adler}` генерується або повертається), вивід, збережений
`deflateParams/3` для наступного `deflate`, і функції над цілим буфером
`compress/1`, `uncompress/1`, `zip/1`, `unzip/1`, `gzip/1`, `gunzip/1`
(з'єднані члени). Заголовок gzip називає платформу так, як його записує zlib
OTP. `term_to_binary/2` з `compressed` або `{compressed, Level}` стискає так,
як вирішує OTP (до розміру на п'ять байтів меншого за корисне навантаження,
інакше без стиснення), а `binary_to_term/1,2` розпаковує стиснені вхідні
дані.

## Модуль re

Джерело: `runtime/src/builtins/re/`, `library/stdlib/re.erl`. Експорти й
типи OTP 29 поверх випуску PCRE2, який постачає OTP
([PCRE2](compile.md#pcre2)). `version/0` — версія і дата PCRE2 як binary
(`<<"10.47 2025-10-21">>`, як в OTP).

Скомпільований шаблон — це
`{re_pattern, CaptureCount, Unicode, UseCRLF, Ref}` з OTP 29, де `Ref` —
[посилання-дескриптор](runtime-heap.md#handle-references), що володіє
`pcre2_code`; його фіналізатор звільняє код разом з останньою копією, а
процеси спільно використовують його лише для читання. Як і в OTP, частина на
C невелика, а решта написана на Erlang:

- `clause_re:compile/2` компілює binary регулярного виразу з параметрами
  компіляції (`{ok, Pattern}` або `{error, {Message,
  Offset}}` з повідомленням PCRE2); `re:inspect/2` відповідає на `namelist`.
- `clause_re:run/4` — це BIF `re:run` з OTP без його переривань: одне
  зіставлення binary-суб'єкта з `{offset, N}`, спершу компілюючи текстовий
  регулярний вираз (`{error, {compile, Reason}}` з `report_errors`), з
  кожною специфікацією захоплення (`all`, `first`, `all_but_first`, `none`,
  `all_names`, номери та імена, дубльовані імена) і типом (`index`, `list`,
  `binary`), `match_limit` і `match_limit_recursion`
  (`{error, match_limit}` з `report_errors`, інакше `nomatch`) і `badarg` з
  OTP для параметрів компіляції чи інших угод про новий рядок, заданих разом
  зі скомпільованим шаблоном.
- `re.erl` перетворює Unicode chardata на UTF-8, а захоплення назад на
  символи, виконує `global`-зіставлення по одному (після порожнього збігу
  повторює спробу з прив'язкою і непорожнім збігом, потім просувається на
  один символ або на пару CR LF з новими рядками CRLF, як це робить
  `loopexec` в OTP) і реалізує `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`, fun
  заміни) та `split/2,3` (`{parts, N}`, `trim`, `group`, `{return, Type}`) з
  результатами OTP.

Експортовані шаблони (`export`, `import/1`) не надаються.
`executables_re_module` порівнює компіляцію, зіставлення, захоплення,
глобальні та Unicode-зіставлення, replace, split і помилки аргументів з OTP.

## Prim eval

Джерело: `runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun,
Timeout)` — це receive з `erl_eval`, клаузи якого є fun: він переглядає
поштову скриньку з найстарішого повідомлення кроками скомпільованого
[receive](processes.md#receive), приватними вбудованими функціями
`clause_receive` `peek/0` (`{message, M}` або `none`), `skip/0`, `take/0`,
`restart/0` і `wait/1` (вбудована функція очікування скомпільованого коду з
її тайм-аутом і `timeout_value`). Перше повідомлення, для якого `Fun`
відповідає будь-чим, крім `nomatch`, вилучається, і ця відповідь
повертається; `timeout`, коли спливає `Timeout`. Виняток із `Fun` лишає
кожне повідомлення на місці. `executables_prim_eval_receive` порівнює з OTP
порядок поштової скриньки, тайм-аути, повідомлення, що надходить під час
очікування, і винятки.

## Atomics і counters

Джерело: `runtime/src/builtins/atomics.cpp`. Масив `atomics` — це
[посилання-дескриптор](runtime-heap.md#handle-references), буфер якого
містить слово знаковості та 64-бітні значення, що оновлюються через
`std::atomic_ref` послідовно узгодженими операціями; він спільний для
кожної копії посилання (повідомлення, persistent terms, `binary_to_term/1`,
поки воно живе) і звільняється разом з останньою.

- `new/2` приймає арність від 1 до 2^27 і параметри `[{signed, Bool}]`
  (перемагає останній); `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`,
  `sub_get/3`, `exchange/3`, `compare_exchange/4` і `info/1` — вбудовані
  функції з `badarg` OTP для поганого посилання, індексу чи значення.
  Збережені значення мають уміщатися в масив (int64 або uint64); прирости
  можуть бути будь-яким цілим від -2^63 до 2^64 - 1 і переходять через межу
  по колу. `info/1` повідомляє `memory` з OTP: 40 + 8 байтів на значення.
- `counters` написано на Erlang (`library/erts/counters.erl`):
  `{atomics, Ref}` і `{write_concurrency, Ref}` обидва загортають знаковий
  масив atomics, тож лічильники write-concurrency точні при кожному читанні.
  `info/1` для останніх повідомляє розмір і пам'ять масиву.

## Erts internal

Джерело: `runtime/src/builtins/erts_internal.cpp`,
`library/erts/erts_internal.erl`. Функції, які викликають `stdlib` і
`kernel` з OTP:

- вбудовані функції `cmp_term/2` (точний порядок термів: ціле число перед
  рівним float) і `map_next/3`, протокол `maps:iterator/1,2` і
  `maps:next/1`: шлях-ціле обходить map у порядку ключів і продовжує по
  решті ключів, шлях-список ключів бере свої ключі по порядку; накопичувач-
  список отримує кожну асоціацію від шляху далі;
- на Erlang: `list_to_integer/2` і `binary_to_integer/2` (допоміжні функції
  `string:to_integer/1` і BIF перетворень, `big` понад мале ціле розміру
  слова), `map_to_tuple_keys/1` (відсортовані ключі будь-якого map),
  `term_type/1`, функції write-concurrency `counters_*`,
  `dynamic_node_name/0,1` поверх `persistent_term`;
- відхиляються: `get_creation/0` дає `undefined` (немає розподіленості), а
  `map_hashmap_children/1` генерує `badarg` (жоден map не має вузлів
  hashmap);
- не реалізуються: групи розподіленості, `.beam` і внутрішніх функцій
  емулятора.

`erts_code_purger:purge/1` відповідає `{false, false}`, а `soft_purge/1` —
`true`, бо скомпонований код не має старого коду; процес очищення і
`finish_after_on_load/2` чекають на [step 71](../.agents/11-plan.md#step-71).

## Порції

Вбудовані функції, робота яких зростає зі
списковим або binary аргументом, виконуються обмеженими порціями, як
переривані (trapping) BIF в OTP, тож довга вбудована функція не може завадити
виконанню інших процесів ([процеси](processes.md)).

- Кожна вбудована функція мосту, яку викликає тіло, викликається як функція і
  витрачає одну редукцію. Порція може виконати `WORK_PER_REDUCTION` (16) одиниць
  роботи на кожну редукцію, що лишилася в кванті часу (щонайменше обсяг однієї
  редукції): пройдені або побудовані комірки списку, порівняння, байти. Вона
  оплачує їх із кванта.
- Вбудована функція, у якої лишилася робота, переривається: `ProcessStack::trap`
  називає фрейм продовження і кладе терми стану вбудованої функції в регістри,
  які лишаються коренями; нативний стан (байти, позиції сортування, слова термів,
  що зберігаються як корені) живе в `TrapState` стека процесу. Процес
  поступається виконанням і відновлюється в продовженні в пізнішому кванті.
  Збирання сміття між порціями переписують регістри і слова стану, як і інші
  корені.
- Результати, помилки й порядок обчислення такі самі, як при виконанні до
  кінця. Помилка, виявлена пізно (неправильний хвіст), викликається, коли обхід
  до неї доходить.
- Виклики з хоста (`call_builtin`) одразу продовжують кожне переривання.
- `integer_to_list/1` для малого цілого, `list_to_integer/1` для короткого
  десяткового рядка і `atom_to_list/1` працюють зі словами без проміжних
  виділень пам'яті; інші аргументи йдуть загальними шляхами.
  `list_to_tuple/1` і `tuple_to_list/1` читають комірки свого аргументу як
  слова й будують результат без повторного допуску елементів, як і списки
  символів цих перетворень.
- Обходи списків перевіряють список один раз і читають його комірки як
  слова, без `Term` на кожну комірку; `Left ++ Right` копіює `Left` щонайбільше
  з 64 комірок за один крок без стану порцій.

| Вбудована функція | Порції |
| --- | --- |
| `length/1` у тілі | Лічить комірки; у guard лишається вбудованим сервісом, бо guard BIF в OTP не переривається |
| `A ++ B` | Збирає елементи `A`, потім будує копію поверх `B` з її кінця |
| `A -- B` | Збирає `B`, сортує за точним порядком (висхідне сортування злиттям), переглядає `A` з двійковим пошуком для кожного елемента, потім будує збережені елементи; якщо нічого не вилучено, результатом є сам `A` |
| `binary_to_list/1` | Будує список із кінця binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Обходить iolist у глибину, потім створює binary одразу |

Інші вбудовані функції виконуються до кінця. Кортежні вбудовані функції
(`setelement/3`, `make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`)
поводяться як в OTP: їхню роботу обмежує межа арності кортежу. Решта
перетворень читає вхідні дані, обмежені межами атомів, цілих чисел і чисел із
рухомою комою. Форматування через `io:format/1,2` виконується до кінця
([відмінності](differences.md)). Вбудовані сервіси циклів (кінцеве обертання
списку в comprehension) виконуються до кінця як частина циклу.

## Типізовані вбудовані функції

Вбудовані функції, що самі перевіряють свої
аргументи, — це функції C++ із типізованими параметрами
([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, зареєстровані через
`typed_entry<Function>(module, name)` (арність дорівнює кількості параметрів).

- Адаптер допускає кожне слово аргументу по порядку (слово, яким цей процес не
  володіє, дає відповідну невдачу, а не `badarg`), потім перетворює кожне на
  тип свого параметра; невідповідність викликає `badarg`, і функція не
  виконується.
- Типи параметрів: `Term` (будь-який терм, загальний запасний варіант),
  `std::int64_t` (мале ціле число), `detail::Integer` (будь-яке ціле число),
  `double` (число з рухомою комою), `ListArgument` (правильний список і його
  елементи), `TupleArgument`, `BinaryArgument` (байти binary), `AtomArgument`
  (його написання).
- Результати: `Term`, `TermResult<Term>` (невдале конструювання є невдачею
  runtime), `BuiltinResult<Term>` (`std::expected` з `BuiltinFailure`) або
  сире `Word`, яке функція опублікувала сама. Функція також може кинути
  `BuiltinFailure` (помилку Erlang, як-от `badarg` чи `system_limit`, або
  невдачу доступу до терма); `call_builtin` перетворює кожен інший виняток C++
  на `out_of_memory` або `internal_error`, тож жоден не перетинає ABI
  згенерованого коду.
- Родини доступу до термів, перетворень і io, `binary_part/2` і
  `function_exported/3` типізовані. Інші вбудовані функції `erlang` передають
  свої слова аргументів без перетворення до вбудованих сервісів, які викликає
  й згенерований код і які їх допускають; вони лишаються адаптерами
  `BuiltinBody` на рівні слів.

## Реєстрація

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  яким володіє `CodeServer`, відображає точні модуль/функцію/арність на
  `BuiltinFrame`. `add` приймає пакет `BuiltinEntry` і реєструє або всі, або
  жодного: порожня назва, понад 255 аргументів, відсутня реалізація або назва,
  яку вже зареєстровано (або повторено в пакеті), відхиляє пакет, нічого не
  зберігаючи.
- Під час старту runtime реєструє кожну таблицю з `production_builtins()`
  (`erlang_builtins()`, `term_access_builtins()`, `conversion_builtins()`,
  `io_builtins()`), більшість записів яких створено через `typed_entry`,
  і які разом покривають
  каталог; пізніші родини додають власні таблиці.
- Тіло читає рівно стільки слів аргументів, скільки становить його арність, і
  записує помилки в перевірений канал; винятки хоста стають невдачами
  `out_of_memory` або `internal_error`.
- Старіший шлях хоста `abi::v1::dispatch_builtin` (нативні модулі,
  зареєстровані хостом за назвою, [runtime](runtime.md#code-server-and-builtins))
  є окремим і не змінився.

## Модуль erlang

Компілятор знає, які функції `erlang` існують, із двох власних джерел, ніколи
не з коду runtime:

- `library/stdlib/erlang.terms`: експорти `erlang` з OTP 29 у вигляді
  `{Name, Arity, Flags, Status}` (прапорці `auto_import`, `guard`; статус
  `implemented`, `{planned, Step}` або `{unavailable, Reason}`:
  `distribution`, `tracing`, `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` спостерігає OTP хоста і
  зберігає статуси, які ведуться вручну.
- `tests/compiler/builtins/generate_erlang.py` перетворює його на
  `library/stdlib/erlang.erl` (власний модуль-заглушку Clause) і
  `compiler/src/semantic/erlang_auto_imports.inc` (список автоімпорту OTP).
  CTest `builtins_erlang_inventory` перевіряє, що обидва актуальні і що
  `implemented` означає вбудовану функцію каталогу, функцію, яку обробляє
  компілятор (`apply/2,3`, `is_record/1,2,3`), або справжнє тіло на Erlang
  (`nif_error/1,2` генерують `error(Reason)`, як заглушки OTP);
  `builtins_erlang_freshness` (мітка `host_otp`) порівнює перелік з OTP хоста.

Виклики:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` і
  `-import(erlang, ...)` вбудованої функції йдуть до вбудованої функції, як і
  раніше. Будь-який інший експорт приєднується до програми як бібліотечний
  модуль `erlang` (компілюється, як `lists`); його заглушки генерують
  `error({not_implemented, F, A})` з `erlang:F/A` на вершині стека, лише коли
  їх викликають. Ім'я, яке модуль не експортує, дає
  `undefined function erlang:F/A`.
- Некваліфікований виклик або `fun F/A` автоімпорту OTP (`get(K)`,
  `fun put/2`), який модуль не визначає, не імпортує і не приглушує через
  `-compile({no_auto_import, ...})`, так само досягає `erlang:F/A`.
- Вбудовані функції «липкі» (sticky): коли реєструється модуль `erlang`,
  runtime пропускає кожен експорт, ім'я якого має зареєстрована вбудована
  функція, тож `M:F(Args)` з `M = erlang` і зовнішні fun прив'язуються до
  вбудованої функції, ніколи до заглушки.

## Зовнішній формат термів

Джерело: `erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Обидва
напрямки поділяють із компілятором кодек
[external_term.hpp](../abi/include/clause/abi/external_term.hpp) і
обходять терми з явними стеками, тож глибина вкладеності не коштує нативного
стека.

- `term_to_binary/1,2` записує байти OTP для нерозподіленого вузла
  (`nonode@nohost`, creation 0): атоми UTF-8, `NEW_FLOAT`, `STRING_EXT` для
  списків байтів до 65535 елементів, map у порядку ключів, pid, порти й
  посилання в їхніх формах `NEW_PID`, `V4_PORT` і `NEWER_REFERENCE`, а також
  `EXPORT_EXT` для `fun M:F/A`. Параметри: `{minor_version, 0..2}` (0 записує
  float текстом, 0 і 1 — атоми Latin-1), `deterministic`, `compressed` і
  `{compressed, 0..9}`; будь-що інше дає `badarg`.
- `term_to_iovec/1,2` повертає кодування як список з одного binary;
  `external_size/1,2` — його точний розмір.
- `binary_to_term/1,2` перевіряє кожну довжину щодо вхідних даних перед
  виділенням пам'яті, ігнорує байти після терма і повертає `badarg` для
  некоректних вхідних даних, недійсного тексту атома, нескінченних float,
  повторених ключів map та ідентичностей іншого вузла; `safe` допускає лише
  наявні атоми, `used` повертає `{Term, BytesRead}`. CTests:
  `executables_external_terms` (байти OTP) і `builtins_etf_fuzz` (змінені
  кодування декодуються або генерують виняток).

## Час

Джерело: `erlang/time.cpp`. Монотонний час — це стабільний годинник
(steady clock); `native` і `perf_counter` — наносекунди; одиниці — атоми OTP
(включно із застарілими у множині) або додатне ціле число частин на секунду.
`convert_time_unit/3` округлює вниз, як OTP. `unique_integer/0,1` бере
значення з одного лічильника на всю програму, тож кожне значення додатне,
унікальне і зростає незалежно від параметрів (`positive`, `monotonic`; інші —
`badarg`). `now/0` — це системний час, зроблений строго зростаючим.
Календарні перетворення читають `{{Y, M, D}, {H, Mi, S}}` строго (недійсна
дата чи час дає `badarg`) і використовують місцевий часовий пояс бібліотеки
C.

## Системна інформація

Джерело: `erlang/system.cpp`.

- `statistics/1`: `wall_clock` і `runtime` (`{Total, SinceLastCall}` у
  мілісекундах), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (виконані кванти часу). Clause не
  веде лічильників редукцій, збирання сміття чи вводу-виводу: `reductions`,
  `exact_reductions`, `garbage_collection` і `io` повідомляють нулі.
- `system_info/1`: `otp_release` (`"29"`), `version` (`"17.1"`, ERTS, якому
  слідує Clause), `machine` (`"Clause"`), `system_version`,
  `system_architecture`, `wordsize` і `{wordsize, internal | external}`,
  `process_count`/`process_limit`, `port_count`/`port_limit`,
  `atom_count`/`atom_limit`, `schedulers`, `schedulers_online`,
  `logical_processors*`, `thread_pool_size`, `smp_support`, `threads`,
  `build_type`, `heap_type`, `kernel_poll`, `debug_compiled`,
  `time_correction`, `time_warp_mode`, `endian`, `compat_rel`.
- `memory/0,1`: типи OTP; `processes` — загальний для runtime рахунок пам'яті
  процесів, `atom` — оцінка за кількістю атомів, `binary`, `code` і `ets`
  дорівнюють 0.
- Інші елементи дають `badarg`.

## Хешування

Джерело: `erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` і `phash/2` хешують структуру терма: точно рівні терми
  хешуються однаково в кожному запуску програми (атоми — за написанням, map —
  у порядку ключів, `1` і `1.0` окремо). `phash2/1` лежить у 0..2^27-1,
  `phash2/2` — у 0..Range-1, `phash/2` — у 1..Range; Range — 1..2^32, інакше
  `badarg`. Значення власні для Clause, не такі, як в OTP.
- `md5/1` і `md5_init/0`, `md5_update/2`, `md5_final/1` дають дайджести RFC
  1321 (байти OTP) для iodata. Контекст — непрозорий 96-байтовий binary
  власного розміщення Clause; інший binary дає `badarg`.

## Завантаження коду

Джерело: `erlang/code.cpp`. Кожен модуль скомпоновано в програму, і він
лишається завантаженим; [step 71](../.agents/11-plan.md#step-71) вирішує
щодо динамічного коду. `module_loaded/1` істинна для скомпільованого модуля
або модуля з вбудованими функціями runtime (`erlang`, `io`, `os`); `loaded/0`
і `pre_loaded/0` перелічують їх усі. `delete_module/1` повертає `undefined`
для невідомого модуля і генерує `error:notsup` для завантаженого.
`prepare_loading/2` повертає `{error, badfile}` (жоден binary не є кодом,
який програма може завантажити), а `finish_loading/1` приймає лише `[]`.
`get_module_info(M[, Item])` продовжується як `M:module_info(...)`.

## Розміщення вихідного коду

- Runtime реалізує вбудовані функції в `runtime/src/builtins/`. Великий
  модуль отримує власний підкаталог з однією одиницею трансляції на кожну
  родину вбудованих функцій: модуль `erlang` живе в
  `runtime/src/builtins/erlang/` (`core`: перевірки типів, guard BIF,
  оператори, генерування винятків, `display`, `halt`, `function_exported`;
  `term_access`; `lists`: `length`, `++`, `--`; `conversions`; `processes`:
  ідентичності, запуск, повідомлення, зв'язки, монітори, зареєстровані імена;
  `ports`; `dictionary`: [словник процесу](processes.md#process-dictionary);
  `binary_conversions` з `conversion_text` — правилами тексту, які він
  поділяє з `conversions`; `term_encoding` і `term_decoding`: зовнішній
  формат термів; `time` і `timers`; `introspection` і `system`; `spawning`;
  `fun_info`, `hashing` і `md5`; `node` і `code`).
- Кожен файл родини визначає власну таблицю `*_builtins()`, перелічену в
  `production_builtins()`. Нова родина додає новий файл і таблицю замість
  розширення наявних; файл понад приблизно 400 рядків розділяється за
  родинами, перш ніж рости далі. Пізніші великі модулі дотримуються того
  самого правила (`runtime/src/builtins/<module>/`).
- Малі модулі (`io`, `os`) та інфраструктура мосту (`registry`,
  `invocation`, `bridge`, `portions`, `typed`, `text`, `float_text`,
  `output`) лишаються в `runtime/src/builtins/`.
- Компілятор ніколи не читає вихідний код runtime: каталог
  `abi::v1::bridge_builtins` — єдиний список, який поділяють обидві сторони.
  Він лишається одним масивом лише з дописуванням у кінець; його групові
  коментарі називають файл реалізації.
