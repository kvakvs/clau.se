---
source: docs/builtins.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d6df02dea1e6270774c9766671b42d9c4b5af4090512da97273a2a4a3a58197f
translatedAt: 2026-10-26
---

# Вбудовані функції

Функції, які runtime реалізує мовою C++: BIF модуля `erlang` і функції інших
модулів, чиї відповідники в OTP є BIF, NIF або потребують runtime.
Реєструються за модулем, функцією та арністю; доступні безпосередньо, через
динамічні виклики та як fun. Вихідний код міститься в `runtime/src/builtins/`;
спостережувані відмінності від OTP описано у [відмінностях](differences.md).

## Які вбудовані функції існують

- Каталог `abi::v1::bridge_builtins`
  ([builtins.hpp](../abi/include/clause/abi/builtins.hpp)): кожна вбудована
  функція, яку знають і компілятор, і runtime; коментарі груп називають файл
  реалізації.
- Індекс запису — це число, яке згенерований код передає мосту; каталог можна
  переупорядковувати (компілятор і runtime збираються разом).
- Модуль `erlang`: guard BIF, оператори як функції, `display/1`, `halt/0,1`,
  генерування винятків, доступ до термів, перетворення, процеси, порти,
  зовнішній формат термів, час, системна інформація, інформація про fun,
  хешування, завантаження коду.
- Інші модулі: кожному присвячено розділ нижче; приватні допоміжні модулі
  (`clause_unicode`, `clause_re`, `clause_zlib`, `clause_receive`, ...)
  обслуговують бібліотечний код Erlang.
- Стан кожної функції (вбудована, тіло на Erlang, заглушка) записано в
  `library/<application>/<module>.terms` ([бібліотека](library.md#files)).
- Кваліфікований виклик вбудованої функції з каталогу викликає міст; кожна
  інша функція `erlang` потрапляє до
  [бібліотечного модуля erlang](#erlang-module).

## Як до них доходять виклики

| Джерело | Шлях |
| --- | --- |
| `abs(X)`, `X + Y`, `display`, `halt`, `error` | Вбудований у код фрагмент або окрема служба |
| Вбудовані функції каталогу без вбудованої служби (`A -- B`, ...) | Вхід як у функцію: `CLAUSE_builtin_frame_v1`, аргументи в регістрах |
| Прямі вбудовані функції (ніколи не перехоплюють керування, не чекають і не діють на інший процес) | `CLAUSE_builtin_call_v1` повертає результат |
| Швидкі вбудовані функції (`length`, `binary_to_list`, `list_to_binary`, `iolist_to_binary`) | Обмежений швидкий шлях (256 комірок, 4096 байтів результату); інакше вхід у фрейм |
| `A ++ B` | Короткий правильний `A` копіюється вбудованим кодом; інакше вхід як у функцію |
| `fun abs/1`, `fun erlang:'+'/2` | Зовнішній fun `erlang:F/A`, прив’язаний до вбудованої функції |
| `M:F(Args)`, `apply/3`, `fun M:F/A` під час виконання | Спершу експорт модуля, потім вбудована функція |

- `fun F/A` автоімпорту, який модуль не визначає й не приховує, — це
  `fun erlang:F/A`, як в OTP. Неавтоімпортовані функції (`display/1`,
  `raise/3`, `make_tuple/2,3`, ...) потребують префікса `erlang:`.
- Фрейм вбудованої функції має нульове тіло: вхід не кладе фрейм у стек, тож
  хвостовий виклик повертає керування викликачеві викликача.
- Помилки (`badarg`, `badarith`, `system_limit`, `{badmap, M}`, `{badkey, K}`)
  використовують перевірений канал збоїв.
- Доступ до термів і перетворення слідують правилам `badarg` з OTP:
  - `setelement/3`: малий індекс у межах кортежу; `make_tuple/2,3`: розмір
    0..16,777,215; `A ++ B`: правильний `A`; `A -- B`: правильні списки,
    `=:=`, O((n + m) log m).
  - `list_to_atom/1`: 256-й символ дає `system_limit`; заповнена таблиця
    атомів (`--max-atoms`) завершує програму з кодом 70.
  - `integer_to_list/2`, `list_to_integer/2`: основа 2..36; `system_limit`
    після 1,262,611 десяткових цифр.
  - `float_to_list/1,2`: формати OTP (`scientific`, `decimals`, `compact`,
    `short`); текст на 256+ байтів дає `badarg`.
  - Двійникові функції для binary поділяють правила тексту
    (`erlang/conversion_text.cpp`); текст числа з плаваючою комою потребує
    цифр з обох боків крапки.
- `function_exported/3`: істинне для експорту програми або зареєстрованої
  вбудованої функції.

## Порції

Вбудовані функції, чия робота зростає зі списком або binary, виконуються
обмеженими порціями, як BIF з перехопленням в OTP.

- Кожен вхід у вбудовану функцію витрачає редукцію; порція виконує
  `WORK_PER_REDUCTION` (16) одиниць на кожну редукцію, що залишилася в кванті.
- Якщо робота залишилася: `ProcessStack::trap` називає продовження; терми
  стану залишаються в регістрах (корені), нативний стан — у `TrapState`.
  Процес поступається керуванням і відновлюється пізніше.
- Можливе продовження в експорті Erlang (`io` на пристрій-процес
  перехоплюється в `file:write/2`).
- Результати, помилки й порядок такі самі, як при виконанні до кінця.
  Виклики з хоста (`call_builtin`) завершують кожне перехоплення одразу.
- Малі вхідні дані йдуть швидкими шляхами на рівні слів (`++` з ≤ 64
  комірками, короткі `integer_to_list`, `list_to_integer`, `atom_to_list`,
  перетворення кортежів).
- З перехопленням: `length/1` у тілі (у guard залишається вбудованою), `++`,
  `--`, `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`.
- Усе інше, зокрема `io:format` і вбудовані функції кортежів, виконується до
  кінця.

## Типізовані вбудовані функції

- Функції C++ `Result F(ProcessContext &, Parameters...)`, зареєстровані
  через `typed_entry<F>(module, name)`
  ([typed.hpp](../runtime/src/builtins/typed.hpp)).
- Адаптер допускає слова аргументів, перетворює їх на типи параметрів;
  невідповідність дає `badarg` до виконання тіла. `Named<Role>` запобігає
  перестановці параметрів-термів.
- Повертають терм, `BuiltinResult` або сире `Word` чи кидають
  `BuiltinFailure`; інші винятки C++ стають `out_of_memory` або
  `internal_error`.
- Guard BIF, оператори та вбудовані функції списків із перехопленням —
  адаптери `BuiltinBody` на рівні слів; часті перетворення читають комірки на
  місці (`TermAccess::trusted`).

## Реєстрація

- `BuiltinRegistry`
  ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  яким володіє `CodeServer`, відображає модуль/функцію/арність на
  `BuiltinFrame`; `add` реєструє пакет цілком або не реєструє нічого.
- Запуск реєструє кожну таблицю `production_builtins()`
  (`builtins/registry.cpp`), потім таблиці розширень runtime, перелічених у
  дескрипторі запуску (`RuntimeOptions::extensions`): таблицю архіву crypto,
  коли програма його компонуватиме ([модуль crypto](#crypto-module)).
- Закріплення: експорти модулів з іменами вбудованих функцій пропускаються,
  тож виклики ніколи не досягають тіла `clause_builtin_placeholder` або
  однойменної функції користувача.
- Шлях хоста `abi::v1::dispatch_builtin` окремий
  ([runtime](runtime.md#code-server-and-builtins)).

## Структура вихідного коду

- Великі модулі отримують підкаталог з одним файлом на сімейство (`erlang/`,
  `lists/`, `binary/`, `unicode/`, `re/`, `zlib/`, ...); малі — окремі файли.
- Кожен файл сімейства визначає таблицю `*_builtins()`, перелічену в
  `production_builtins()`. Нове сімейство = новий файл; файли понад ~400
  рядків розділяються.
- Компілятор ніколи не читає вихідний код runtime; каталог — спільний список.

## Модуль erlang

- `library/erts/erlang.terms`: експорти OTP 29 як `{Name, Arity, Flags, Status}`
  (прапорці `auto_import`, `guard`; стан `implemented` або
  `{unavailable, Reason}`), стани підтримуються вручну.
- `tests/compiler/builtins/generate_erlang.py` записує
  `library/erts/erlang.erl` (заглушки) і
  `compiler/src/semantic/erlang_auto_imports.inc`. CTest
  `builtins_erlang_inventory` (поточний) і `builtins_erlang_freshness` (OTP
  хоста).
- Вбудовані функції мають перевагу для `erlang:F(...)`, `fun erlang:F/A`,
  `apply` та імпортів; інші експорти генерують `{not_implemented, F, A}` при
  виклику, а функції трасування (`{unavailable, tracing}`: `trace*`,
  `system_monitor`, `system_profile`, `seq_trace*`, `dt_*`) — `notsup`;
  невідомі імена — `undefined function`.
- Доповнення (`executables_erlang_gaps`, `_packet_decoding`, `_suspension`):
  - `adler32`, `crc32` і `*_combine` над зафіксованою zlib; `iolist_to_iovec/1`.
  - `append_element/2`, `insert_element/3`, `delete_element/2`.
  - Cookie як на неактивному вузлі; `halt/2` як `halt/1`.
  - `send/3`, `spawn/2,4` та споріднені ([процеси](processes.md#builtins)).
  - `decode_packet/3`: кожен тип пакета й параметр OTP, терми http з OTP.
  - `suspend_process/1,2`, `resume_process/1`, `process_display/2`.

## Зовнішній формат термів

`erlang/term_encoding.cpp`, `term_decoding.cpp`; кодек спільний із
компілятором ([external_term.hpp](../abi/include/clause/abi/external_term.hpp)),
явні стеки.

- `term_to_binary/1,2`: байти OTP для `nonode@nohost`; параметри
  `minor_version`, `deterministic`, `compressed`; локальні fun і native records
  дають `notsup`.
- `term_to_iovec/1,2`, `external_size/1,2`.
- `binary_to_term/1,2`: довжини перевіряються до виділення пам’яті; `safe`,
  `used`; некоректні вхідні дані чи чужі ідентичності дають `badarg`.
- Стеки кодека та закодовані байти `term_to_binary` — буфери кожного потоку,
  збережені між викликами (до 1 MB кожен, `builtins/scratch.hpp`), тож великий
  терм не потребує нових сторінок при кожному виклику; малі цілі числа
  оминають загальний шлях елемента в обидва боки.
- CTest `executables_external_terms`, `builtins_etf_fuzz`.

## Час

`erlang/time.cpp`.

- Монотонний час — сталий годинник; `native` — наносекунди; атоми одиниць OTP
  або цілі числа частин за секунду.
- `convert_time_unit/3` округлює вниз; `unique_integer/0,1` — один зростальний
  лічильник; `now/0` строго зростає.
- Календарні перетворення суворі й використовують локальний пояс бібліотеки C.
- Таймери: [процеси](processes.md#timers).

## Системна інформація

`erlang/system.cpp`, `erlang/system_flags.cpp`.

- `statistics/1`: `wall_clock`, `runtime`, черги виконання, `context_switches`;
  лічильники редукцій, збирання сміття й введення-виведення повідомляють нулі.
- `system_info/1`: `otp_release` `"29"`, `version` `"17.1"`, `machine`
  `"Clause"`, кількості, ліміти, сталі відповіді емулятора; повний список у
  `system.cpp`.
- `memory/0,1`: типи OTP; `binary`, `code`, `ets` дорівнюють 0.
- `system_flag/2`: діють `backtrace_depth` (≤ 64) і `min_heap_size`; більшість
  інших зчитуються без впливу; `cpu_topology`, `erts_alloc`, ... дають `badarg`.

## Хешування

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2`, `phash/2`: значення OTP для атомів, чисел, binaries, списків,
  кортежів, maps; pid, порти, посилання, fun хешуються власним способом Clause.
- `md5/1` і `md5_init/update/final`: RFC 1321; контекст — власний 96-байтовий
  binary Clause.

## Завантаження коду

`erlang/code.cpp`. Кожен модуль скомпонований і залишається завантаженим;
динамічний код відкладено.

- `module_loaded/1`, `loaded/0`, `pre_loaded/0` охоплюють скомпільовані та
  вбудовані модулі.
- `delete_module/1` завантаженого модуля дає `notsup`; `prepare_loading/2` —
  `{error, badfile}`.

## Модуль lists

`builtins/lists/`. `lists` OTP написаний на Erlang, тож вбудовані функції
генерують те, що генерують його клаузи.

- Обходи (`sublist`, `flatten`, злиття, `key*`, `zip`, `sort`, `usort`, ...)
  генерують `function_clause`, як OTP, і залишаються такими ж лінивими
  (`sublist([a | b], 1)` дає `[a]`).
- `keymember/3`, `keysearch/3` — BIF: правила `badarg`.
- Рівні елементи: перший перемагає (`max([1, 1.0])` дає `1`).
- Функції, що приймають fun, і решта написані на Erlang у
  `library/stdlib/lists.erl`; усередині нього вбудовані функції викликаються
  кваліфіковано.
- `function_clause` вбудованої функції не має власного фрейму.

## Модуль math

`builtins/math.cpp`.

- Кожна функція OTP 29 над бібліотекою C; нечислові значення дають `badarg`,
  нескінченні або невизначені результати — `badarith`.
- 64-бітова генерація коду вбудовує `sqrt`, `floor`, `ceil`, `exp`, `log*`,
  `sin`, `cos`, `pow` для чисел, зберігаючи сирі double.

## Модуль binary

`builtins/binary/`; `replace/3,4` і `list_to_bin/1` написані на Erlang.

- Шаблони: binary, список binaries або скомпільований; найлівіший, потім
  найдовший збіг; `scope`, `global`, `trim`, `trim_all`.
- `compile_pattern/1` повертає `{bm, ...}` або `{ac, ...}` без посилання.
- Інші функції слідують OTP; неправильні аргументи дають `badarg`;
  `referenced_byte_size/1` — власний розмір binary.

## Модуль maps

`builtins/maps.cpp`, `builtins/os.cpp`.

- Кожна задокументована функція `maps`; основні — вбудовані з помилками OTP;
  ключі зіставляються точно.
- Функції, що приймають fun, написані на Erlang у `maps.erl`; ітератори
  використовують [`erts_internal:map_next/3`](#erts-internal).
- Курсори map обходять плоскі й деревоподібні maps у порядку ключів;
  `clause_maps:entries/1` постачає дані для `maps:fold/3`.
- `os`: `type`, `getenv`, `env`, `putenv`, `unsetenv`, `getpid`, `version` —
  вбудовані; функції часу написані на Erlang; `os:cmd/1` використовує порт.

## Колекції

`builtins/collections/`: кожна задокументована функція `ordsets`, `orddict`,
`proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue`, `array`.

- Обходи списків — вбудовані; функції, що приймають fun, написані на Erlang.
- Кожна вбудована функція обходить дані, як клаузи OTP: ті самі результати й
  помилки для будь-яких вхідних даних.
- `dict`, `sets` версії 1: records лінійного хешування OTP (те саме подання й
  порядок). Множини версії 2 — maps.
- `gb_trees`, `gb_sets`: спільний рушій збалансованих дерев; дерева рівні OTP.
- `queue`: переміщення OTP `{Rear, Front}`; черги рівні OTP.
- `array`: record `#array{}` з OTP 29, змінюється точно як в OTP.

## Множини множин

- `sofs` (`builtins/sofs/`, `executables_sofs_sets`): records OTP над
  відсортованими списками; алгебра, відношення й сімейства — вбудовані функції,
  функції, що приймають fun, написані на Erlang.

## Граф

- `graph` (`builtins/graph/`, `executables_graph_module`): `#graph{}` з OTP;
  обходи й шляхи — вбудовані функції з явними стеками, оновлення — на Erlang.

## Digraph

- `digraph`, `digraph_utils` (`builtins/digraph/`,
  `executables_digraph_tables`): три таблиці ETS з OTP; оновлення на Erlang
  через `ets`; пошуки шляхів та обходи — вбудовані функції, що читають таблиці
  на місці.

## ETS

`builtins/ets/` над таблицями runtime ([runtime](runtime.md#ets-tables)).

- Вбудовані функції: життєвий цикл таблиці, вставлення/пошук/видалення,
  обходи, лічильники, `info`; згортання, `i/0..3`, `fun2ms/1` — на Erlang.
- Параметри й права доступу як в OTP; кожен збій дає `badarg`.
- Специфікації зіставлення ([runtime](runtime.md#match-specifications)):
  `select*`, `match*`, `match_spec_*`, `erlang:match_spec_test/3`; результати
  в порядку обходу, продовження форми OTP.
- Файли таблиць: `tab2file`, `file2tab`, `tabfile_info` читають і записують
  формат disk_log з OTP в обидва боки.
- `to_dets/2`, `from_dets/2` через `dets`; `table/1,2` на Erlang через
  `qlc:table/2` (типово select/3, `first_next`, `last_prev`, `{select, MS}`),
  пошук ключів через `==` в `ordered_set`, інакше `=:=`.
- CTest `executables_ets_*` виконують еталонні перевірки OTP.

## Dets

`dets.erl` через `clause_dets` (`builtins/dets/`): формат файлів версії 9 з
OTP байт у байт, той самий порядок у файлах.

- Рушій (C++): заголовок, списки вільних блоків buddy, лінійне хешування,
  скидання кешу запису, сканування, подання для масових операцій.
- Процеси (Erlang): сервер `dets` з реєстровими таблицями OTP; один процес на
  таблицю, що зберігає дескриптор файлу, кеш, фіксації, таймери.
- Відновлення при відкритті й помилки як в OTP; fun виконуються там, де в OTP.
- `table/1,2` на Erlang через `qlc:table/2` (типово select/3, `first_next`,
  `{select, MS}`); незадокументовані допоміжні функції — заглушки.
- CTest `executables_dets_tables` порівнює з OTP, включно з MD5 файлів.

## Кодування

`builtins/encoding/`.

- `base64`: кожна функція вбудована; помилки декодування відповідають
  автоматам станів OTP.
- `json`: `decode/1`, `encode/1`, `format/1,2` і кодувальники binary —
  вбудовані (перехід до Erlang після 256 рівнів вкладеності); декодувальники
  зі зворотними викликами й кодувальники, що приймають fun, — на Erlang через
  сканери `clause_json`.

## Повідомлення POSIX

`builtins/erl_posix_msg.cpp`, `library/stdlib/erl_posix_msg.erl`.

- `erl_posix_msg:message/1` (внутрішній модуль OTP, потрібний
  `file:format_error/1`): англійський текст причини POSIX з таблиці,
  спостереженої на OTP 29, `"unknown POSIX error: "` та ім’я для іншого атома,
  `badarg` для не-атома.

## Мережеві імена

`builtins/net/`, `library/kernel/clause_net.erl`, `library/kernel/net.erl`.

- `clause_net:gethostname/0`, `getaddrinfo/2`, `getnameinfo/4`,
  `getservbyname/2`, `getservbyport/2` викликають системні функції та
  відповідають як `prim_net` з OTP: відомості про адреси як maps з `family`,
  `socktype`, `protocol` і адресою сокета, імена помилок prim_net (`eservice`,
  `enodata`, ...), `{error, einval}` для невідомої служби. `net` перевіряє
  аргументи через guard OTP і передає текст як binaries UTF-8.
- `clause_net:inet_getifaddrs/0` перелічує інтерфейси, як `inet_drv` з OTP
  для `inet:getifaddrs/0` (на Windows із `GetAdaptersAddresses` і
  `GetIfEntry` з його правилами прапорців, префіксів і класових масок мережі;
  деінде з `getifaddrs(3)`, об’єднані за іменем і прапорцями як у `prim_inet`).
  `clause_net:getifaddrs/0` перелічує їх як `net:getifaddrs(all)` (Windows:
  пакетні записи й відсортовані прапорці модуля `net` з OTP; деінде maps
  prim_net з пакетними або канальними адресами); `net` фільтрує їх за
  сімейством, прапорцями або fun. `if_names/0` — список індексів та імен,
  у якому шукають і `net:if_index2name/1`, і `if_name2index/1`.
- `inet:getservbyname/2`, `getservbyport/2` і `gethostbyaddr/1`
  (`getnameinfo` з `NI_NAMEREQD`) використовують ті самі вбудовані функції;
  мережеві простори імен відповідають `{error, enotsup}`
  ([відмінності](differences.md)).
- `clause_net:dns_decode/1` і `dns_encode/1` (`builtins/net/dns.cpp`) — кодек
  повідомлень DNS для inet_res: кортежі OTP `#dns_rec{}`, `#dns_header{}`,
  `#dns_query{}`, `#dns_rr{}`, `#dns_rr_opt{}` і `#dns_rr_tsig{}` зі
  значеннями inet_dns (символьні типи, класи й коди операцій, екрановані мітки
  імен, LOC у градусах і метрах) та його правилами `formerr` (вказівники
  стиснення назад за заголовок, імена до 255 байтів, обрізані секції лише з
  бітом TC); кодування стискає імена.

## Імена файлів

`builtins/filename/`.

- Функції шляхів — вбудовані, слідують клаузам OTP для сімейства хоста (Unix
  або диски Windows та імена `//`); форми результатів і помилки OTP.
- `absname/1,2`, `basedir/2,3` написані на Erlang.

## Filelib

`builtins/filelib.cpp`, `library/stdlib/filelib.erl`, `library/stdlib/clause_filelib.erl`.

- `clause_filelib:escape/1` записує `@` і `\` так, щоб `filename:split/1`
  зберігав екранування; `compile_part/1` компілює одну частину розділеного
  шаблону (`?`, `*`, `**`, набори символів з діапазонами, альтернативи `{...}`
  з приєднанням решти їхньої частини) з особливостями OTP (`**` лише як ціла
  частина, `]` на початку або як нижня межа діапазону,
  `{badpattern, missing_delimiter}`, `case_clause` для вкладених
  альтернатив); `matches/3` і `match/2` фільтрують записи каталогу.
- Обхід (буквальні префікси, `..`, `**`, перевірки існування) написано на
  Erlang через `file` і `filename`, тож результати такі, як в OTP, відсортовані.

## Argparse

`builtins/argparse/`, `library/stdlib/argparse.erl`,
`library/stdlib/clause_argparse.erl`.

- `clause_argparse:validate/3` перевіряє команду, як `validate/2` з OTP, у
  порядку OTP, і повертає перше некоректне поле, щоб `argparse.erl` генерував
  помилку.
- `parse/6` — парсер OTP у формі циклу: довгі форми (`--name=value`), короткі
  форми, поєднані прапорці, приєднані значення, від’ємні числа, `nargs`, дії,
  типи, підкоманди, типові значення; кинуті помилки й maps аргументів як в OTP.
- `help/4` будує списки довідки OTP (перенесення рядків використання,
  розділи, шаблони) через вбудовані функції `io_lib`, `string` і `unicode`,
  тож форми рівні OTP.
- Fun викликаються з `argparse.erl`: вбудована функція повертає запит
  (`{custom, Fun, Arg}`, `{re, Arg, Re[, Options]}`, `{describe, Fun}`) і
  викликається знову з накопиченими відповідями, повторюючи обхід; кожен fun
  виконується один раз, у порядку OTP.
- `run/3`, обробники та `format_error/1,2` написані на Erlang.

## Qlc pt

`builtins/qlc_pt/`, `library/stdlib/qlc_pt.erl`,
`library/stdlib/clause_qlc_pt.erl`: перетворення синтаксичного дерева qlc під
час виконання, для `qlc:string_to_handle/1,2,3` і `qlc:q/1,2` в
інтерпретованому коді. Модулі, скомпільовані з `qlc.hrl`, як і раніше
отримують перетворення OTP хоста
([перетворення синтаксичного дерева](transforms.md)).

- `clause_qlc_pt:transform_expression/4` і `parse_transform/4` слідують
  `qlc_pt.erl` функція за функцією: NodeInfo (унікальні анотації та відомості
  перевірок про кожен вузол, збережені за номером слота від 1, як в OTP),
  `no_shadows`, проходи lint, що знаходять введені змінні й змінні
  генераторів, фрейми records `#bind{}` для сталих стовпців і стовпців
  з’єднання, пропускання фільтрів, специфікації зіставлення, генератори
  з’єднання, згенерований fun стану, `Qdata`, `CodeF`
  (`term_to_binary(_, [compressed])` початкового коду) і fun параметрів.
  Проміжні дані — терми Erlang форми OTP, тож сортування слідує порядку
  термів; згенеровані змінні — посилання, як `make_ref/0` з OTP.
- Повідомлення надходять від `erl_lint` на C++ (`Lint`), шляхом, який
  `qlc_pt` з OTP використовує за відсутності компілятора; аварія lint на
  побудованих формах — внутрішня помилка компілятора, як її повідомляє
  компілятор OTP. Records розгортає `erl_expand_records` на C++, перевірки
  guard — `is_guard_test/3`.
- Специфікації зіставлення виконують `ms_transform` на Erlang: вбудована
  функція повертає `{try_ms, Forms}`, `qlc_pt.erl` відповідає результатом
  `try_ms/4` і викликає вбудовану функцію знову з накопиченими відповідями,
  повторюючи обхід; результат — `{done, Result, Transformed}` (перетворений
  модуль підвищує глибину зворотного трасування до 500, як перетворення OTP).

## Qlc

`library/stdlib/qlc.erl`: кожна функція на Erlang, оскільки обчислення
викликає fun запиту. Написано за документацією OTP; алгоритми взято з OTP
там, де їх видно з відповідей, їхнього порядку або `info/1,2`.

- Дескриптори зберігають кортежі OTP (`{qlc_handle, H}` з `qlc_lc`,
  `qlc_table`, `qlc_append`, `qlc_sort`; `{qlc_cursor, {Pid, Owner}}`);
  скомпільовані запити — `{qlc_lc, Fun, Opt}` перетворення з даними `qlc_v1`
  або `simple_v1`.
- Підготовка: пошуки за ключем або індексом із найменшою кількістю ключів
  (`max_lookup`), специфікації зіставлення для унарних fun обходу й списків,
  перевага з’єднань пошуком над з’єднаннями злиттям, сортування входів
  з’єднання злиттям, якщо вони ще не відсортовані, прості запити для `cache`
  і `unique`, об’єднані й ніколи не для першого генератора.
- Обчислення: відповіді — списки, що закінчуються на `[]` або fun
  продовження. `cache` використовує таблиці `ets` (`qlc`, приватні) або
  список під `{Ref, '$_qlc_cache_tmpfiles_'}`, перенесений у тимчасовий файл
  після `max_list_size`; з’єднання злиттям розміщують великі класи рівних
  ключів у файлі (`'$_qlc_merge_join_tmpfiles_'`); сортування запускає
  `file_sorter`, коли відповіді перевищують `size`. Тимчасові файли —
  `qlc_<node>_<os pid>_<unique>` у `tmpdir` або робочому каталозі;
  `tmpdir_usage` повідомляє через `error_logger`.
- Помилки, знайдені при обчисленні (відповідь fun обходу чи пошуку, що не є
  списком, файлові помилки, `{tmpdir_usage, _}`), кидаються з внутрішньою
  міткою й повертаються з `eval/2`, `fold/4`, `info/2` і курсорів, як OTP
  повертає помилки, кинуті його `throw_error/1`.
- `info/1,2` друкує підготовлений запит через `erl_pp:expr/3`, описи таблиць
  через їхні fun форматування (рядки розбирає `erl_eval:extended_parse_exprs/1`).
- `string_to_handle/1,2,3` і `qlc:q/1,2` з `erl_eval` запускають
  [`qlc_pt`](#qlc-pt) Clause; `ets:table/1,2`, `dets:table/1,2` і `erl_eval`
  звертаються до `qlc` за іменем під час виконання, тож лише програми, що
  називають `qlc`, компонують його.
- CTest `executables_qlc_queries` порівнює з OTP: його модуль запитів
  компілюється з `qlc_queries.abstr`, форм після перетворення OTP, тож тест
  не потребує OTP хоста
  ([виконувані приклади](../tests/fixtures/executables/README.md)).

## Рядки

`builtins/string/`: кожна функція `string`.

- Обходи слідують `string.erl` через `unicode_util:cp/1`, `gc/1`: хвости,
  підбінарні значення, змішані списки й помилки OTP.
- Обходи з кінця використовують цикл замість рекурсії.
- Функції регістру повертають вхідні дані, коли нічого не змінюється;
  `equal/4` нормалізує через `unicode/normalize.cpp`.
- `to_integer/1`, `to_float/1`, API Latin-1, `jaro_similarity/2` як в OTP.

## Рядок URI

`builtins/uri/`.

- `parse/1`: один обхідник RFC 3986 у порядку OTP, фрагменти помилок OTP.
- `recompose`, `normalize`, `resolve`, `percent_decode`, `quote`, функції
  запитів слідують обходам і стилям помилок OTP.
- `unicode/graphemes.cpp` сегментує кластери для вбудованих функцій, що їх
  потребують.

## Випадкові числа

`builtins/rand/`.

- `rand`: стани й обробники OTP; кожен алгоритм дає послідовності OTP.
  Відомі обробники виконуються на C++ (`clause_rand:*`); інші виконують
  узагальнений Erlang-код OTP.
- `splitmix64_next/1`, `exsp_*`, `mwc59*` — вбудовані функції.
- `tools/rand/` спостерігає сталі OTP і генерує `tables.cpp`.
- `random`: `uniform_s/1` вбудована, решта на Erlang.

## Календар

`builtins/calendar.cpp`.

- Вбудовані функції григоріанської арифметики над довільними цілими числами,
  формули й помилки OTP.
- Локальний/універсальний час і RFC 3339 написані на Erlang у `calendar.erl`.

## Таймер

`builtins/timer.cpp`.

- `seconds/1`, `minutes/1`, `hours/1`, `hms/3` і `now_diff/2` як арифметика
  Erlang над будь-якими числами: `badarith` для нечислового значення,
  `function_clause` для аргументу `now_diff/2`, що не є кортежем із 3 елементів.
- Таймери написані на Erlang у `timer.erl`, без `timer_server`: надсилання
  локальному pid використовує `erlang:send_after/3`; будь-який інший
  одноразовий або періодичний таймер — процес, що створює псевдонім, який
  містить його `TRef` і якому надсилає `cancel/1`. Періодичний таймер
  відстежує процес, для якого працює, і завершується разом із ним;
  `apply_repeatedly` чекає завершення кожної дії до наступного такту.

## Persistent terms

`builtins/persistent_term.cpp` над таблицею runtime
([runtime](runtime.md#persistent-terms)).

- `put/2`, `put_new/2`, `get/0,1,2`, `erase/1`, `info/0` з результатами OTP;
  ключі зіставляються точно; читання повертають збережений терм без копії.

## Модуль unicode

`builtins/unicode/`: кожна функція вбудована.

- Кодування `latin1`, `utf8`, `utf16`, `utf32` (з порядком байтів); інакше
  `badarg`.
- Chardata: binaries, кодові точки, вкладені списки; послідовні binaries —
  один потік.
- Збої дають `{error | incomplete, Converted, Rest}` з формою `Rest` з OTP.
- Нормальні форми, `category/1`, `is_whitespace/1`, `is_id_*` зберігають
  скорочені шляхи OTP.

## Модуль code

`builtins/code.cpp`. Без процесу `code_server`; відповіді описують
скомпоновану програму.

- `ensure_loaded/1`, `is_loaded/1` (`{file, preloaded}`), `which/1`
  (`preloaded`), `all_loaded/0`, `module_status/0,1`; `is_sticky/1` дає `false`.
- Шлях коду (`library/kernel/code.erl`): persistent term, побудований при
  першому використанні, як його будує інтерактивний сервер коду OTP:
  каталоги `ebin` застосунків з `ERL_LIBS`, найновіша версія кожного
  застосунку в `lib_dir()`, потім `"."`. `root_dir/0` — каталог виконуваного
  файлу. Зміни шляху нормалізують і перевіряють каталоги, як OTP; `lib_dir/1`,
  `priv_dir/1` і `compiler_dir/0` називають перший каталог шляху
  `.../Name[-Vsn][/ebin]`.
- Відповіді завантаження для скомпонованого коду: об’єктний код на шляху дає
  `{error, badfile}` з `erlang:prepare_loading/2`, відсутній код — `nofile`;
  `purge/1` дає `false`, `soft_purge/1` — `true`, `delete/1` — `false`;
  `get_doc/1` — `{error, missing}`; без підтримки покриття.

## Модуль io

`builtins/terminal.cpp`, `library/stdlib/clause_io.erl`.

- `clause_io:isatty/1` (`stdin`, `stdout`, `stderr`): консоль на Windows,
  `isatty(3)` деінде; `window_size/1`: `{Columns, Rows}` термінала
  (`GetConsoleScreenBufferInfo`, `TIOCGWINSZ`), інакше `{error, enotsup}`.
- Вони відповідають на прапорці термінала `io:getopts/0,1`, `io:columns/0,1`,
  `io:rows/0,1` і `io_ansi:enabled/0,1`.
- Сервер стандартного вводу (`io.erl`) читає рядки, як group з OTP: запит
  `get_until` (`io:read/1,2`, `io:scan_erl_exprs/1..4`, команди оболонки)
  бере по одному рядку й знову пише запрошення перед кожним наступним рядком,
  а кінець рядка CRLF читається як LF.

## Модуль os

`builtins/os.cpp`, `library/kernel/os.erl`.

- `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0`,
  `version/0` — вбудовані функції.
- `cmd/1,2`: Erlang через порт породження з протоколом OTP: Windows запускає
  `COMSPEC /c Command`; деінде `/bin/sh -s unix:cmd` читає команду й
  виводить `^D` (та код завершення) наприкінці. `max_size`,
  `exception_on_failure`, вивід UTF-8 декодується в символи.
- `find_executable/2` (вбудована): пошук OTP по елементах `PATH` (Windows:
  спершу поточний каталог, `.exe`, `.com`, `.cmd`, `.bat`).
- `set_signal/2` (вбудована): `badarg` на Windows, як в OTP; деінде
  `sigaction`; оброблений сигнал діє як типовий `erl_signal_handler` з OTP.

## Модуль init

`builtins/init.cpp`, `library/erts/init.erl`. Запущена система без сценарію
завантаження.

- Командний рядок декодується один раз (`startup/arguments.cpp`): звичайні
  аргументи передаються до argv точки входу й `get_plain_arguments/0`.
- Єдиний прапорець — `home`; `script_name/0` — шлях виконуваного файлу.
- Інші функції написані на Erlang з відповідями запущеної системи OTP;
  `script_id/0` дає `{"Clause", "29"}`.
- `stop/0,1`, `reboot/0` зупиняють одразу; `boot/1`, `restart/0,1`,
  `make_permanent/2` відхиляються з `notsup`.

## Atomics і counters

`builtins/atomics.cpp`.

- Масив `atomics` — [посилання-дескриптор](runtime-heap.md#handle-references)
  над значеннями `std::atomic_ref`; арність 1..2^27; правила `badarg` та
  `info/1` з OTP.
- `counters` написаний на Erlang над знаковим масивом atomics; лічильники з
  конкурентним записом точні.

## Erts internal

`builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`: функції, які
викликають `stdlib` і `kernel`.

- Вбудовані `cmp_term/2` і `map_next/3` (ітератори map, порядок ключів).
- Erlang: `list_to_integer/2`, `binary_to_integer/2`, `map_to_tuple_keys/1`,
  `term_type/1`, лічильники, `dynamic_node_name`.
- `get_creation/0` дає `undefined`; групи розподіленого виконання та `.beam`
  відхиляються.
- `erts_code_purger`: нічого очищувати.

## Unicode util

`unicode_util.erl` через вбудовані функції `clause_unicode` і згенеровані
таблиці (`unicode/tables.cpp`).

- `cp/1`, `gc/1` (UAX #29), `nfd/nfc/nfkd/nfkc`, перетворення регістру з
  формами OTP; `spec_version/0` дає `{17, 0}`.
- `tools/unicode/generate.py` будує таблиці з відповідей OTP хоста й даних
  Unicode 17.0; для збірки не потрібне ні те, ні інше.
- CTest `executables_unicode_tables`, `_clusters`, `_forms`.

## io_lib

`io_lib.erl`, `builtins/io_lib/`. Глибокі списки символів OTP, побудовані в
арені C++; `io:format` використовує той самий рушій.

- Засоби запису (`write.cpp`): `write`, `write_string`, `write_atom`, ...
  екранують і обмежують, як OTP.
- Рушій форматування (`format_scan.cpp`, `format_build.cpp`): усі керівні
  послідовності, `chars_limit`, округлення чисел з плаваючою комою як в OTP;
  помилки `badarg`.
- Засіб гарного друку (`pretty*.cpp`): компонування `io_lib_pretty` з OTP.
  `clause_io_lib:pretty/2` — це `io_lib_pretty:print/2` для оболонки:
  `column`, `line_length`, `depth`, `line_max_chars`, `strings`, `encoding` і
  `records`, визначення `[{Name, [Field]}]`, які повернув би
  `record_print_fun`, тож кортежі відомого імені й розміру друкуються як
  `#Name{Field = Value, ...}` з компонуванням OTP. CTest
  `executables_shell_session`.
- Сканер (`fread.cpp`): керівні послідовності й продовження `fread/2,3`.
- Збирачі (`collect.cpp`), перевірки придатності до друку, `indentation/2`.
- Fun `maps_order`: вбудована функція фіксує maps і продовжується в
  `clause_io_lib:sort_maps/6`, повторюючи виконання з відсортованими ключами.
- Вкладеність понад 256 дає `system_limit`. CTest `executables_io_lib_text`,
  `_pretty_print`, `_fread_scanning`.

## Таблиці компілятора

`builtins/front_end/`.

- `erl_internal`: таблиці BIF і guard з `erlang.terms`; таблиці типів та
  операторів; `add_predefined_functions/1`.
- `erl_anno`: форми й помилки OTP.
- `erl_features`: відповіді компілятора Clause; `used/1` читає дескриптори або
  блоки `Meta` з `.beam`.
- `records`: див. [native records](native-records.md#reflection).
- CTest `executables_compiler_tables`, `_records_reflection`.

## Erl scan

`erl_scan.erl` через `clause_erl_scan:scan/6` (`front_end/scanner*.cpp`),
власний сканер, що слідує `scan1/5` з OTP.

- Токени, анотації, сигіли, рядки в потрійних лапках, помилки й залишки OTP.
- Зворотні виклики `reserved_word_fun`, `text_fun` виконуються на Erlang у
  порядку токенів.
- Продовження `tokens/3,4` повторно сканують незавершений токен.
- CTest `executables_erl_scan_tokens`.

## Erl parse

`erl_parse.erl` через `clause_erl_parse:parse/1` (`front_end/parser*.cpp`),
парсер рекурсивного спуску для граматики OTP.

- Абстрактний формат OTP і поведінка помилок LALR (токен зупинки, порядок
  помилок дії та синтаксису).
- `first_anno/1`, `last_anno/1` слідують порядку `map_anno/2`.
- `normalise/1`, `abstract/1,2`, `tokens/1,2` — вбудовані; обходи анотацій з
  fun — на Erlang.
- CTest `executables_erl_parse_forms`.

## Erl eval

`erl_eval.erl` інтерпретує абстрактний формат на Erlang; вбудовані функції
`clause_erl_eval` обробляють сегменти бітового синтаксису
(`front_end/erl_eval.cpp`) і зіставлення зі зразком
(`front_end/eval_match.cpp`), а `erl_eval:partial_eval/1` та
`is_constant_expr/1` також є вбудованими функціями.

- `clause_erl_eval:match/4` — це `match1/5`: літерали, змінні, списки,
  кортежі, maps, native records, префікси `"abc" ++ T`, операторні сталі й
  зразки binary, що дають `{match, Bindings}`, `nomatch` або `invalid`
  (генерується як `{illegal_pattern, Pattern}` у `erl_eval.erl`). Ключі map
  і розміри сегментів — вирази guard, обчислювані над зовнішніми
  зв’язуваннями (`front_end/guard_eval.cpp`, спільний з `-if` з `epp`);
  зв’язування читаються й зберігаються як `orddict` або map, як в OTP,
  включно з невідсортованим списком.
- `clause_erl_eval:bits_gen/4` бере зразок генератора binary з початку бітів;
  цикл інтерпретатора, guard (вони викликають нелокальний обробник) та обходи
  comprehension залишаються на Erlang.

- `bit_type/2` визначає специфікатори `bin_element` з типовими значеннями й
  помилками `erl_bits` (`front_end/bit_types.cpp`, спільний з `normalise/1`);
  `bit_segment/3` будує один сегмент (`badarg`, `system_limit`), `bit_take/3`
  бере один з початку bitstring (`nomatch`).
- Fun, створені інтерпретатором, — замикання над середовищем OTP
  `{Anno, Bindings, Lf, Ef, UsedVars, Clauses}`, тож `fun_data/1` і
  `erlang:fun_info/2` відповідають як в OTP; `fun M:F/A` з частинами,
  визначеними під час виконання, використовує `erlang:make_fun/3`.
- `exprs/2`, `expr/2` і `check_command/2` перевіряють команди через
  `erl_lint:exprs_opt/3`, як OTP.
- CTest `executables_erl_eval_exprs`.

## Erl lint

Перевірки `erl_lint` — вбудовані функції (`front_end/lint*.cpp`), написані за
`erl_lint` з OTP клауза за клаузою; `erl_lint.erl` зберігає те, що викликає
fun або інші модулі.

- Один об’єкт `Lint` містить стан `#lint{}` з OTP; таблиці змінних — вектори,
  відсортовані за іменем (orddict з OTP), множини й maps, які OTP зберігає в
  порядку термів, — упорядковані контейнери, тож помилки зберігають порядок
  вставлення, а попередження сортуються як у `return_status/1`.
- `module/1,2,3` проходять через `clause_erl_lint:module/4` з відповідями
  `behaviour_info/1` поведінок, знайденими на Erlang
  ([відмінності](differences.md#erl_lint)); `format_error/1` форматує
  відповідь `clause_erl_lint:format_spec/1` (включно з вкладеними частинами
  `io_lib:format/2`), тож результати рівні термам OTP.
- Застарілі елементи походять із таблиць `otp_internal` з OTP
  (`front_end/otp_obsolete.inc`, згенеровано через
  `tests/compiler/library/generate_obsolete.escript`).
- `erl_eval:partial_eval/1` і `erl_bits:set_bit_type/2`, які використовують
  перевірки, — на C++ (`lint_eval.cpp`, `bit_types.cpp`).
- CTest `executables_erl_lint_checks`.

## Erl pp

Друк `erl_pp` — вбудована функція (`front_end/pp*.cpp`),
`clause_erl_pp:print/2`, перенесена з двох проходів попереднього модуля на
Erlang; `erl_pp.erl` зберігає гачки й `legalize_vars/1`.

- Перший прохід перетворює форму на елементи компонування в арені
  (`pp_items`, `pp_exprs`, `pp_forms`, `pp_types`); другий розташовує їх
  відповідно до ширини рядка (`pp_layout`), записуючи атоми, рядки, символи й
  значення через засоби запису `io_lib` на C++.
- Форма, яку може надрукувати лише гачок, зупиняє компонування з
  `{hook, Expr, Column, Precedence}`; `erl_pp.erl` викликає гачок і друкує
  знову з накопиченими відповідями, тож кожен гачок виконується один раз, у
  порядку OTP.
- Пріоритети та `erl_parse:abstract/2` походять із `erl_parse.cpp`.
- CTest `executables_erl_pp_forms`.

## Epp

Умови `-if` і `-elif` з `epp` обчислює вбудована функція
`clause_epp:eval_if/1` (`front_end/epp_eval.cpp`), тож програма, яка виконує
попередню обробку файлів, не компонує `erl_eval`.

- Вона обчислює вираз guard, як `erl_eval:exprs/3` без зв’язувань: літерали,
  списки, кортежі, maps та оновлення map, binaries (сегменти через бітові
  вбудовані функції `clause_erl_eval`), оператори з `andalso`/`orelse`, що
  дають значення правої частини, і виклики guard BIF (локальні
  автоімпортовані або `erlang:`) через таблицю guard специфікацій зіставлення.
- Будь-яка помилка (незв’язані змінні, невизначені records, BIF, що генерує
  помилку, локальний виклик) робить умову хибною, оскільки `epp` перехоплює її.
- `epp`, `file` і `erl_features` скомпільовані зі
  [суворою живістю](compile.md#strict-liveness).

## Erl expand records

`erl_expand_records:module/2` — вбудована функція
(`front_end/expand_records.cpp`): розгортання обходить форми на C++ замість
великої диспетчеризації клауз Erlang, тож програми, які її викликають, не
компілюють додаткового коду.

- Порядок обходу OTP (сегменти binary від останнього до першого, спершу права
  частина зіставлення) і нумерація `recN`; перевірки guard `is_record/3`
  стають зразками.
- Фільтри comprehension — перевірки guard за правилами `erl_lint`
  (`front_end/guard_tests.cpp`, з records модуля й локальними або
  імпортованими функціями).
- Параметри `dialyzer`, `expand_inits`, `[no_]strict_record_tests`, також з
  атрибутів `-compile`.
- CTest `executables_erl_expand_records_forms`.

## Модуль zlib

`builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.

- Компонує zlib 1.3.2, як OTP 29 ([zlib](compile.md#zlib)): ті самі байти.
- Потік — посилання-дескриптор, що володіє `z_stream`; вбудовані функції
  `clause_zlib` виконують одну операцію над усіма вхідними даними.
- `zlib.erl` зберігає API, помилки, стани й допоміжні функції цілих буферів OTP.
- Стиснення `term_to_binary` слідує правилу розміру OTP.

## Модуль zstd

`builtins/zstd/contexts.cpp`, `library/stdlib/zstd.erl`.

- Компонує zstd 1.5.7, як OTP 29 ([zstd](compile.md#zstd)): ті самі кадри.
- Контексти й словники — посилання-дескриптори, що володіють відповідними
  об’єктами libzstd; контекст, що посилається на словник, зберігає його живим.
  Вбудовані функції `clause_zstd` відтворюють NIF OTP: вихідні блоки по
  `ZSTD_CStreamOutSize()` / `ZSTD_DStreamOutSize()` (кадр, що вказує менший
  розмір, розпаковується в один блок такого розміру), результати
  `{continue, Rest, Out}`, `{flush, Out}` і `{done, Out}`, перевірки власника
  (`not_on_controlling_process`), помилки
  `{badarg, {invalid_key | invalid_value, Term}}` і `{zstd_error, Name}`,
  булеві значення зчитуються як `false`, як їх читає NIF OTP.
- `zstd.erl` зберігає обробку iodata, потоків і кадрів OTP.

## Кодек ASN.1

`builtins/asn1/` у `clause_runtime`, `library/asn1/clause_asn1.erl` ([ASN.1](asn1.md)).

- `clause_asn1:encode/3` і `decode/3` приймають терм схеми згенерованого
  модуля, ім’я типу й значення або байти (binary чи iolist); `decode/3`
  повертає `{Value, Rest}`. Вони інтерпретують схему, як згенерований BER-код
  asn1ct і `asn1rtt_ber`, та завершуються з тими самими причинами
  `exit`/`error`, які згенерована обгортка перетворює на
  `{error, {asn1, Reason}}`.
- TLV розбираються, як їх розбирає `asn1rt_nif` (`tlv.cpp`: його позиції
  помилок, межі двобайтового тегу й чотирибайтової довжини);
  `ber_decode.cpp`, `ber_constructed.cpp`, `ber_encode.cpp` і
  `ber_encode_constructed.cpp` містять примітивні та складені типи,
  `values.cpp` — порівняння INTEGER, REAL і DER `DEFAULT`, `legacy.cpp` —
  застарілі форми `BIT STRING`.
- PER (`per.hpp`): `per_bits.cpp` — бітові поля, визначники довжини, цілі
  числа й рядки з їхнім вирівнюванням і фрагментами;
  `per_encode.cpp`/`per_decode.cpp` — примітивні типи;
  `per_encode_constructed.cpp`/`per_decode_constructed.cpp` — послідовності,
  доповнення розширень, вибори й відкриті типи; `per_strings.cpp` — значення
  `BIT STRING`. Декодування PER приймає binary і повертає непрочитані біти.

## Відкритий ключ

`builtins/public_key/` у `clause_runtime`,
`library/public_key/clause_public_key.erl` ([public_key](public_key.md)):
обходи records і таблиці `pubkey_translation` та `pubkey_cert_records` з
OTP, які викликає `clause_public_key_codec`.

- `translate(decode | encode, Term)` (`translate.cpp`) обходить терм, як
  `pubkey_translation:decode/1` і `encode/1`: records згенерованих модулів
  `SubjectPublicKeyInfo_algorithm`, `DSA-Params`, `DSA-Sig-Value`,
  `OTPExtension`, `SingleAttribute`, `OneAsymmetricKey` (версія `v1`) і
  `EncryptionAlgorithmIdentifier` стають тими, що описані в `public_key.hrl`,
  і навпаки; неправильний список завершується з `bad_generator`, як
  comprehension.
- `oid_name(Table, Oid)` і `name_oid(Table, Name)` (`tables.cpp`, рядки в
  `tables.inc`) шукають у таблицях `public_key_algorithm` (тип ключа
  алгоритму), `curve_type`, `named_curve`, `ml_dsa`, `ml_kem`, `slh_dsa` та
  `extension` (тип розширення); `undefined`, коли таблиця не має рядка,
  `badarg` для іншої таблиці.
- `asn1_module(Type)` називає згенерований модуль, який `der_decode/2` і
  `der_encode/2` використовують для типу (`public_key:get_asn1_module/1`),
  `undefined` для типу без такого модуля.

## Модуль crypto

`builtins/crypto/` в окремому архіві `clause_runtime_crypto`,
`library/crypto/crypto.erl` і `clause_crypto.erl`.

- Компонує libcrypto з OpenSSL ≥ 3.1.2 (зафіксовано 4.1.0,
  [OpenSSL](crypto.md)); лише програми, що викликають `crypto` (або передають
  `--with-crypto`), компонують архів, запис `CLAUSE_crypto_extension_v1`
  якого перелічено в дескрипторі запуску.
- `algorithms.cpp` зберігає таблиці імен OTP (дайджести, шифри, MAC, типи
  ключів, криві, KEM) з їхніми іменами отримання OpenSSL; перший виклик
  `crypto` завантажує типовий, базовий і застарілий провайдери й отримує
  кожен дайджест, шифр і MAC, як NIF OTP при завантаженні; криві перевіряються
  (генерацією ключа на кожній) при першому `supports(curves)`.
  `supports/0,1`, `hash_info/1`, `info/0` та `info_lib/0` повідомляють, що
  має скомпонована libcrypto.
- Стани хешу — посилання-дескриптори, що володіють `EVP_MD_CTX`;
  `hash_update/2` повертає новий стан над копією, як в OTP. Стани MAC
  володіють `EVP_MAC_CTX`, який `mac_update/2` змінює на місці. `crypto.erl`
  подає тексти довші за 20000 байтів частинами, як OTP, тож жоден виклик
  вбудованої функції не триває довго.
- Помилки — помилки NIF OTP: `{badarg | notsup | error, #{c_file_name,
  c_file_line_num, c_function_arg_num}, Description}`, які `crypto.erl`
  перетворює на `{Class, {File, Line}, Description}` з `error_info`
  (`?nif_call`); описи й перевірки слідують порядку OTP, файл і рядок — Clause.
- Рушії відповідають як OTP, чия OpenSSL не підтримує рушії (`notsup`;
  OpenSSL 4 їх не має).
- Шифри (`cipher.cpp`) слідують `api_ng.c` з OTP: стани `crypto_init/4`
  володіють `EVP_CIPHER_CTX` за блокуванням, який `crypto_update/2` змінює на
  місці; `crypto_final/1` доповнює відповідно до параметрів (`undefined`,
  `none`, `zero`, `random`, `pkcs_padding` з OTP); `crypto_one_time/5`
  виконує тимчасовий стан. `crypto.erl` подає `crypto_update/2` тексти довші
  за 20000 байтів частинами. AEAD (`aead.cpp`) слідує `aead.c` для GCM, CCM
  і ChaCha20-Poly1305; неправильний тег дає при розшифруванні `error`.
  `crypto.erl` виконує генератори `rand` `crypto_aes` і `crypto_prng1`, як
  OTP, через вбудовані функції `exro928_*` і `seed58/2` модуля `rand`.
- FIPS (`fips.cpp`): кожен запис таблиці зберігає другий результат отримання
  `fips=yes`, що використовується в режимі FIPS; запис без нього там
  заборонений (`*_FORBIDDEN_IN_FIPS` з OTP), зникає з `supports/1` і генерує
  описи `notsup` з OTP. `enable_fips_mode/1` перемикає типові властивості
  OpenSSL; програми, зібрані з `--fips`, компонують запис архіву
  `CLAUSE_crypto_fips_extension_v1`, чий гачок запуску завантажує провайдер
  поруч із виконуваним файлом ([FIPS](crypto.md#fips)).
- Відкриті ключі слідують `pkey.c`, `rsa.c`, `dss.c`, `eddsa.c`, `ec.c`,
  `ecdh.c`, `dh.c`, `evp.c` і `srp.c` з OTP: `crypto.erl` перетворює цілі
  числа на binaries (`format_pkey`, `nif_curve_params`), а вбудовані функції
  будують ключі OpenSSL з тих самих списків `OSSL_PARAM`, що й NIF OTP
  (`params.cpp`, великі числа з нативним порядком байтів), з перевірками,
  описами й номерами аргументів OTP. `pkey.cpp`: `sign/4,5`, `verify/5,6`
  (RSA з PKCS #1, PSS, X9.31 і без доповнення, DSA, ECDSA, EdDSA, ML-DSA,
  SLH-DSA; `{digest, Digest}`), RSA `public_encrypt/4` і три споріднені
  функції (PKCS #1, OAEP з його дайджестами й міткою, без доповнення),
  `privkey_to_pubkey/2`. `keys.cpp`: генерація ключів RSA, DH, X25519/X448,
  Ed25519/Ed448, ML-DSA, SLH-DSA і ML-KEM, узгодження DH і X25519/X448,
  `encapsulate_key/2`, `decapsulate_key/3`. `curves.cpp`: ключі й узгодження
  ECDH на іменованих або явних кривих, повторна спроба з явними параметрами,
  коли OpenSSL не знає імені OTP (як `retry_without_name` з OTP), та
  `ec_curve/1`, чиї явні параметри походять із вбудованих кривих скомпонованої
  libcrypto замість таблиці `crypto_ec_curves` з OTP (ті самі терми байт у
  байт). `srp.cpp`: формули великих чисел SRP; `crypto.erl` зберігає множник
  і скремблер OTP. Особливості OTP збережено: `sign(dss, none, ...)`
  завершується з `"Bad digest type"`, `generate_key(dh, ...)` ігнорує
  заданий приватний ключ, а багатобайтовий відкритий показник RSA надходить
  до OpenSSL у нативному порядку байтів.

## Модуль re

`builtins/re/`, `re.erl` над включеною PCRE2 ([PCRE2](compile.md#pcre2)).

- Скомпільований шаблон: `{re_pattern, ...}` з OTP 29 з
  посиланням-дескриптором.
- `clause_re:compile/2`, `clause_re:run/4` (один збіг, усі параметри
  захоплення, помилки OTP).
- `re.erl`: перетворення chardata, цикл `global`, `replace`, `split`.
- `export`/`import/1` не надаються. CTest `executables_re_module`.

## Prim eval

`process/receive.cpp`, `library/erts/prim_eval.erl`.

- `prim_eval:'receive'/2` сканує поштову скриньку через вбудовані функції
  `clause_receive` (`peek`, `skip`, `take`, `restart`, `wait`); перша
  відповідь, відмінна від `nomatch`, перемагає.
- CTest `executables_prim_eval_receive`.
