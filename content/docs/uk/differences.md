---
source: docs/differences.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d23f82e2b75a7d8717057d09d1a6e30555fb75f81b5e810be0aaa9fc83a5b22c
translatedAt: 2026-10-26
---

# Відмінності від Erlang/OTP

Поведінка, що спостерігається, у якій Clause свідомо відрізняється від
зафіксованого OTP 29 (`maint-29`, див. [otp-reference.md](otp-reference.md)).
Кожен запис посилається на контракт, якому він належить. Запис видаляють, щойно
відмінність усунуто. Ще не реалізовані можливості (про які повідомляється як
`notimpl`) тут не наведено; див. [features.md](features.md) і план.

## Map

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Порядок генератора map (`K := V <- M`) | Пласкі map (до 32 ключів) перебираються в порядку ключів, але атомні ключі — в порядку таблиці атомів, який різниться між запусками VM; більші map — у порядку хешів | Завжди канонічний порядок ключів (порядок термів) | [зразки](patterns.md#comprehensions) |
| Вміст `bad_generators` для генератора map у zip-групі | Його ітератор: ланцюжок `{K, V, Next}`, що закінчується `none`, у порядку OTP | Той самий ланцюжок, побудований у канонічному порядку ключів | [зразки](patterns.md#comprehensions) |
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3`, порядок виконання fun у `maps` (`intersect_with/3`, `merge_with/3`, ...), `proplists:get_keys/1`, `sets` версії 2 (`to_list/1`, `fold/3`) | Внутрішній порядок (порядок таблиці атомів для ключів-атомів, порядок хешів понад 32 ключі); ітератор — позиція або ланцюжок `{K, V, Next}` | Канонічний порядок ключів; ітератор продовжує обхід списку ключів | [вбудовані функції](builtins.md#erts-internal) |
| Друк map (`erlang:display/1`, `~w`, `~p`) | Порядок внутрішнього розміщення (порядок таблиці атомів для атомних ключів, порядок хешів понад 32 ключі) | Порядок ключів map, як `~kw` в OTP | [терми](terms.md#printing) |
| Порядок `digraph:vertices/1`, `edges/1`, `source_vertices/1`, `sink_vertices/1` та впорядкувань і компонентів `digraph_utils`, що починаються з цих списків | Хеш-порядок таблиць вершин і ребер | Хеш-порядок Clause ([ETS](#ets)); шляхи та списки сусідів в обох випадках відповідають порядку вставлення ребер | [вбудовані функції](builtins.md#digraph) |
| Порядок `maps:keys/1`, `values/1`, `to_list/1`, `fold/3`, елементів, які записує `json:encode/1`, полів, які `erl_parse:abstract/1,2` надає map, а також списків вершин і обходів `graph` | Внутрішній порядок map (порядок таблиці атомів для ключів-атомів, хеш-порядок для понад 32 ключів) | Порядок ключів | [бібліотека](library.md) |
| Друк native record (`erlang:display/1`) | Поля в порядку індексів таблиці атомів | Порядок визначення, як `~w` | [native records](native-records.md#printing-and-order) |
| `==` між native record, поля яких відрізняються лише як ціле число/число з рухомою комою | Компілятор може згорнути його до `=:=` (false) | Числове порівняння (true) | [native records](native-records.md#printing-and-order) |
| Зовнішнє конструювання native record модуля, який не завантажено | Завершується збоєм, доки модуль, що його визначає, не завантажено | Кожен модуль пакета завантажується під час запуску; модуль поза пакетом завжди дає збій | [native records](native-records.md#differences-kept) |
| Друк локального fun (`#Fun<M.Index.Uniq>`) | Індекс із нумерації лямбд компілятора, `Uniq` — хеш коду модуля | Індекс серед локальних fun модуля в порядку вихідного коду, `Uniq` завжди 0 | [fun](funs.md#comparison-and-printing) |
| Порядок двох локальних fun одного модуля | За індексом OTP | За індексом у порядку вихідного коду, тож fun різних функцій можуть упорядковуватися інакше | [fun](funs.md#comparison-and-printing) |
| Імена анонімних fun у трасуваннях стека (`-f/1-fun-N-`) | `N` з нумерації компілятора | `N` лічить fun функції `f/1` у порядку вихідного коду | [fun](funs.md#closures) |
| Анонімний fun у значенні за замовчуванням поля record | Кожне місце конструювання розгортає власну копію: fun із двох місць нерівні | Один fun для значення за замовчуванням: fun з будь-якого місця конструювання рівні | [fun](funs.md#closures) |
| Порядок захоплених значень fun, створених усередині comprehension | Вільні змінні згенерованої функції comprehension | Порядок визначення в охопній функції; помітно лише при порівнянні двох таких fun | [fun](funs.md#closures) |

## Pid, посилання і процеси

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Одноразові та інтервальні таймери `timer`, крім надсилань локальним pid | Виконуються процесом `timer_server`, запущеним під `kernel_sup` за першого використання; сигнали `exit_after/2,3` надходять від нього | Сервера таймерів немає: кожен таймер є окремим процесом, який надсилає сигнал `exit_after`; `cancel/1` повертається до того, як цей процес побачить скасування | [вбудовані функції](builtins.md#timer) |
| Номери pid | Перший процес користувача — приблизно `<0.80.0>`; номери повторно використовуються після переповнення таблиці pid | Перший процес — `<0.1.0>`; номери беруться з однієї послідовності й ніколи не використовуються повторно | [терми](terms.md#pids-and-references) |
| Код після `spawn(Fun)` для fun іншої арності | Аналіз типів компілятора може вважати код після виклику недосяжним і відкинути його, тож викликач одразу повертає pid | Викликач продовжує роботу; завершується з помилкою лише новий процес, з `{badarity, {Fun, []}}` | [процеси](processes.md#builtins) |
| Стек `function_clause`, викликаного вбудованою функцією `lists` (`lists:sublist/2`, `lists:max/1`, ...) | Верхній фрейм — функція Erlang, часто внутрішня допоміжна (`lists:sublist_2/2`), з її аргументами | Нагорі викликач: вбудовані функції не додають фрейм | [вбудовані функції](builtins.md#lists-module) |
| Останній біт результатів `math` (`math:erfc(1)`, ...) | Бібліотека C, з якою зібрано OTP | Бібліотека C, з якою компонуються програми Clause (Windows: `0.15729920705028513` для `erfc(1)`, OTP `0.1572992070502851`) | [вбудовані функції](builtins.md#math-module) |
| Результат `binary:compile_pattern/1` | `{bm, Ref}` або `{ac, Ref}` з непрозорим посиланням | `{bm, [Pattern]}` або `{ac, Patterns}` | [вбудовані функції](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` для sub-binary | Розмір binary, на який він посилається | Його власний розмір | [вбудовані функції](builtins.md#binary-module) |
| Пам’ять замінених або видалених persistent terms | Звільняється фоновим процесом збирача областей літералів, який змушує кожен процес скопіювати значення до себе | Кожен процес копіює значення до себе під час наступного кванта (призупинені — одразу, через `put`/`erase`), потім область звільняється; окремого процесу збирача немає | [runtime](runtime.md#persistent-terms) |
| Persistent terms, надіслані в повідомленнях | Залишаються спільними, як літерали: купа одержувача не зростає | Копіюються в купу одержувача, як будь-який інший терм | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` і `get/0` | Включають терми, які `kernel` і `stdlib` з OTP зберігають під час завантаження (26 в OTP 29) | Лише власні терми програми | [вбудовані функції](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` для скомпільованого модуля | Файл `.beam`, з якого його завантажено | `preloaded`: кожен модуль скомпоновано у виконуваний файл | [вбудовані функції](builtins.md#code-module) |
| Параметр `priority` у `send/3`, `link/2`, `exit/3`, `exit_signal/3` | Пріоритетні повідомлення й сигнали випереджають звичайні | Приймається; доставляються як звичайні повідомлення й сигнали | [процеси](processes.md#builtins) |
| `spawn/2,4`, `spawn_link/2,4`, `spawn_monitor/2,4` з іменем іншого вузла | Журналюється попередження `** Can not start ... on Node **` | Нічого не друкується; непридатний pid усе одно завершується з `noconnection` | [процеси](processes.md#builtins) |
| Прапорці `system_flag/2`, крім `backtrace_depth` і `min_heap_size` (`fullsweep_after`, `schedulers_online`, `multi_scheduling`, `max_heap_size`, ...) | Змінюють емулятор | Перевіряються й зчитуються без впливу; початкове значення `system_logger` — `undefined` (процесу logger немає); `cpu_topology`, `erts_alloc`, `scheduler_bind_type` дають `badarg` | [вбудовані функції](builtins.md#system-information) |
| Таймери призупиненого процесу (`receive ... after`, `send_after/3` і `start_timer/3` на його pid) | Призупиняються разом із процесом до його відновлення (OTP 28, 29) | Продовжують працювати: тайм-аут, що сплив під час призупинення, обробляється після відновлення процесу; повідомлення таймера чекає в його поштовій скриньці | [процеси](processes.md#suspending-processes) |
| Вивід `process_display/2` | Дамп стека OTP з адресами й комірками стека | Один `Module:Function/Arity` на фрейм | [процеси](processes.md#builtins) |
| `process_flag(save_calls, N)` | Зберігає останні N викликів для `process_info(Pid, last_calls)` | Зберігається й зчитується; виклики не зберігаються | [процеси](processes.md#builtins) |
| `adler32_combine/3`, `crc32_combine/3` з другим розміром понад 2^31 - 1 у Windows | Об'єднуються | `badarg` (`z_off_t` у zlib там має 32 біти) | [вбудовані функції](builtins.md#erlang-module) |
| `init:get_arguments/0`, `init:get_argument/1` | Прапорці емулятора: `root`, `bindir`, `progname`, `home` і кожен `-Flag` командного рядка | Лише `home`; виконуваний файл не має прапорців емулятора | [вбудовані функції](builtins.md#init-module) |
| `init:script_name/0`, `init:script_id/0` | Шлях до скрипту завантаження і `{"Erlang/OTP", "29"}` | Абсолютний шлях до виконуваного файлу і `{"Clause", "29"}` | [вбудовані функції](builtins.md#init-module) |
| `init:get_status/0`, `init:ensure_loaded/1` у вхідній функції | `{starting, started}` і завантаження коду, поки під час завантаження системи виконується код `escript`, `-s` або `-eval`; `{started, started}` і `not_allowed` після запуску | Завжди відповіді для запущеної системи | [вбудовані функції](builtins.md#init-module) |
| `init:stop/0,1`, `init:reboot/0` | Повертають `ok`; потім `init` зупиняє застосунки і завершує роботу, а викликач продовжує виконуватися | Зупиняють роботу одразу; виклик ніколи не повертається | [вбудовані функції](builtins.md#init-module) |
| `init:get_argument(home)` у Windows без `HOMEDRIVE`/`HOMEPATH` | Папка профілю оболонки | `USERPROFILE`, зазвичай та сама папка | [вбудовані функції](builtins.md#init-module) |
| `erlang:halt(Slogan)`, `init:stop(Slogan)` | Друкує гасло, записує `erl_crash.dump` у поточний каталог і повідомляє про це в stderr; код виходу 1 | Друкує гасло в stderr, crash dump не записує; код виходу 1 | [виконувані файли](executables.md) |
| `init:restart/0,1`, `init:boot/1`, `init:make_permanent/2` | Перезапускають систему в тому самому вузлі, завантажують її або задають скрипт завантаження наступного перезапуску | Відхиляються: помилка `notsup`, `{error, notsup}` від `make_permanent/2` | [вбудовані функції](builtins.md#init-module) |
| Арність `atomics:new/2` | Будь-яке додатне ціле, яке може обслужити алокатор; надто велике завершує вузол із crash dump | Від 1 до 2^27, інакше `badarg` | [вбудовані функції](builtins.md#atomics-and-counters) |
| `counters` з `write_concurrency` | Лічильники окремих планувальників, що підсумовуються при читанні; пам'ять у `info/1` зростає з кількістю планувальників | Один масив atomics; пам'ять у `info/1` — це пам'ять масиву | [вбудовані функції](builtins.md#atomics-and-counters) |
| `erts_internal:term_type/1` | Внутрішнє представлення: `flatmap` або `hashmap`, `heap_binary`, `refc_binary` або `sub_binary`, ... | Кожен map — `flatmap`, кожен bitstring — `sub_binary` | [вбудовані функції](builtins.md#erts-internal) |
| `erl_prim_loader:get_path/0` | Шлях коду завантаження | `["."]` до `set_path/1` | [порти](ports.md#standard-io-and-files) |
| `file:read_link_info/1,2` для символьного посилання у Windows | Власні дані точки повторного розбору (reparse point) посилання | Розмір і часи цілі з типом `symlink` | [порти](ports.md#standard-io-and-files) |
| `inet:gethostbyname/1,2` | Канонічне ім'я і псевдоніми від резолвера (`inet_res`, файл hosts, нативний) | Запитане ім'я без псевдонімів; адреси від системного резолвера | [порти](ports.md#sockets) |
| Модуль `socket` | Socket NIF API | Відсутній: посилання — помилка компіляції; використовуйте `gen_tcp`, `gen_udp`, `inet` | [бібліотека](library.md) |
| `net:getifaddrs/1,2` із простором імен, `inet:getifaddrs([{netns, _}])` | `net` нескінченно викликає сам себе (OTP 29); `inet` читає простір імен у Linux | `{error, enotsup}` | [вбудовані функції](builtins.md#network-names) |
| Списки виводу `zlib` | Один binary на внутрішній фрагмент, вкладені там, де потік закінчився і почався знову | Один binary на виклик, `[]`, коли його немає; байти такі самі, як в OTP | [вбудовані функції](builtins.md#zlib-module) |
| `zlib:safeInflate/2` і довгі виклики `zlib` | Повертаються після обмеженого обсягу виводу (`{continue, Output}`) і поступаються виконанням | Розпаковують усе введення з черги за один виклик (`{finished, Output}`); довгий виклик утримує свій потік планувальника | [вбудовані функції](builtins.md#zlib-module) |
| Довгі зіставлення `re` | `re:run/3` і глобальний цикл поступаються виконанням після обмеженого обсягу роботи | Одне зіставлення виконується до кінця й утримує свій потік планувальника; глобальний прогін поступається лише між зіставленнями | [вбудовані функції](builtins.md#re-module) |
| `re:compile/2` з `export`, `re:import/1` | Експортований шаблон `{re_exported_pattern, ...}`, який імпортує інший вузол | `export` — `badarg`; `import/1` викликає `{not_implemented, import, 1}` | [вбудовані функції](builtins.md#re-module) |
| Помилки аргументів `re` | `badarg` з `re:run/3` (або `replace`, `split`) з аргументами викликача і `error_info` | `badarg` з допоміжної функції `re`, яка відхилила аргумент, з аргументами цієї функції | [вбудовані функції](builtins.md#re-module) |
| `code:is_sticky/1` | `true` для модулів `kernel`, `stdlib` і `compiler`, а також модулів каталогів, названих у `code:stick_dir/1` | Завжди `false`; `stick_dir/1` лише перевіряє, чи можна перелічити вміст каталогу | [вбудовані функції](builtins.md#code-module) |
| `code:root_dir/0` і початковий шлях коду | Каталог встановлення OTP; шлях містить його каталоги `lib/*/ebin` | Каталог виконуваного файлу; шлях містить каталоги `ebin` з `lib/` поруч із ним та з `ERL_LIBS`, а потім `"."` | [вбудовані функції](builtins.md#code-module) |
| `code:load_file/1`, `load_abs/1`, `load_binary/3`, `atomic_load/1`, `prepare_loading/1` з коректним об'єктним кодом | Завантажують модуль | `{error, badfile}`: кожен модуль скомпоновано у виконуваний файл (D01) | [вбудовані функції](builtins.md#code-module) |
| `code:coverage_support/0` і функції покриття | `true` із JIT; режими й лічильники покриття | `false`; решта піднімає `badarg`, як OTP без підтримки покриття | [вбудовані функції](builtins.md#code-module) |
| `code:get_doc/1` для модуля, наявного в програмі | Його блок документації EEP 48 | `{error, missing}`: виконувані файли не містять документації | [вбудовані функції](builtins.md#code-module) |
| Форматування великого терма (`io:format/1,2`) | Виконується в коді Erlang (`io_lib`) і в group leader, тож процес може бути витіснений під час форматування | Виконується до кінця в одному виклику вбудованої функції; інші процеси чекають | [вбудовані функції](builtins.md#portions) |
| Прапорці `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` та інші | Лише `trap_exit` і `min_heap_size`; будь-який інший прапорець викликає `badarg` | [процеси](processes.md#builtins) |
| Порядок звітів про помилки процесів, що аварійно завершуються одночасно | Порядок logger | Порядок, у якому їх завершують їхні робочі потоки | [процеси](processes.md#workers) |
| Сигнали виходу (`exit/2`, `exit_signal/2`) процесу, що виконується на іншому планувальнику | Ставляться в чергу сигналів і обробляються пізніше, поки відправник продовжує роботу | Відправник чекає, доки закінчиться квант часу цілі, і тоді діє одразу; помітно лише за часом (повідомлення буферизуються, і відправник продовжує роботу) | [процеси](processes.md#workers) |
| `term_to_binary/1` для локального fun або native record | Кодується (`NEW_FUN_EXT`, ...) | `error:notsup`; `fun M:F/A` кодується | [вбудовані функції](builtins.md#external-term-format) |
| `term_to_binary/1` для map з понад 32 ключами | Порядок хешів, якщо не задано `deterministic` | Завжди порядок ключів (байти `deterministic`) | [вбудовані функції](builtins.md#external-term-format) |
| `binary_to_term/1` для pid, порту або посилання іншого вузла; параметр `local` у `term_to_binary/2` | Зовнішні ідентичності; кодування `LOCAL_EXT` | `badarg` | [вбудовані функції](builtins.md#external-term-format) |
| Межа часу таймера | Залежить від нативної одиниці часу (близько 2^49.7 мс у Windows) | Відносний час 0..2^49-1 мс на кожній платформі | [процеси](processes.md#timers) |
| `unique_integer/0,1` без `positive` | Може бути від'ємним | Завжди додатне і зростає | [вбудовані функції](builtins.md#time) |
| Елементи `process_info/2` `current_function`, `initial_call`, `current_stacktrace`, ... | Повідомляються | `error:{notsup, Item}`; `process_info/1` їх пропускає | [процеси](processes.md#introspection) |
| `reductions` у `process_info/2`; `reductions`, `garbage_collection`, `io` у `statistics/1` | Лічаться | 0 (не ведуться) | [вбудовані функції](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Збирає сміття перед поверненням | Збирає в наступній безпечній точці (safepoint) цілі | [процеси](processes.md#introspection) |
| `erlang:system_info(machine)`, а отже, `?MACHINE` у `epp` і макрос, який він називає | `"BEAM"`, `'BEAM'` | `"Clause"`, `'Clause'` | [вбудовані функції](builtins.md#system-information) |
| `erlang:system_info(schedulers)` для програми, запущеної з маскою прив'язки (`start /affinity`, `taskset`) | Один планувальник на логічний процесор хоста (32 під маскою з 7 CPU), `schedulers_online` — один на CPU маски | Обидва — один на CPU маски: Clause запускає лише активні робочі потоки | [процеси](processes.md#workers) |
| Параметри налаштування `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Застосовуються | Перевіряються і приймаються, але не застосовуються | [процеси](processes.md#spawn-options) |
| `hibernate/3` | Відкидає стек; процес завершується, коли `M:F` повертається | Зберігає стек; результат `M:F` повертається до викликача `hibernate/3` | [процеси](processes.md#spawn-options) |
| `monitor(port, Item, Options)` з параметрами | Приймається | `badarg` | [процеси](processes.md#aliases) |
| `spawn_request_abandon/1` | `true`, поки відповідь очікується | Завжди `false`: відповідь надсилається до повернення `spawn_request` | [процеси](processes.md#spawn-options) |
| Останній біт `math:log2/1` (Windows) | Збірка OTP для Windows ділить `log(X)` на `log(2)` (`math:log2(1.0e308)` дає `1023.1538532253077`) | `log2` бібліотеки C (`1023.1538532253076`) | [вбудовані функції](builtins.md#math-module) |
| `phash/2`, `phash2/1,2` для pid, портів, посилань, fun і native record | Хеші номерів процесів, портів і посилань OTP, індексу й унікального номера fun, хешу визначення record | Хеші номерів Clause, модуля, арності або індексу й захоплень fun, значень полів record; усі інші терми мають хеші OTP | [вбудовані функції](builtins.md#hashing) |
| `dict:fold/3`, `map/2`, `filter/2` зі значенням, що не є fun | `function_clause` або `{badfun, F}`, коли перший відвіданий OTP кошик містить запис | `function_clause` | [вбудовані функції](builtins.md#collections) |
| `erlang:is_builtin/3` для `lists:reverse/2` та інших бібліотечних функцій, реалізованих на C | `true` | `false`: лише вбудовані функції runtime і `apply/2,3` | [fun](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` у `fun_info/1,2` локального fun | Pid творця, контрольні суми компілятора | `undefined`, MD5 імені модуля | [fun](funs.md#fun-information) |
| Контекст `md5_init/0` | 92-байтовий стан OTP | 96-байтовий стан Clause; дайджести однакові | [вбудовані функції](builtins.md#hashing) |
| `erlang:delete_module/1` для завантаженого модуля | Робить його код старим (`true`) | `error:notsup`: скомпонований код лишається | [вбудовані функції](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Готує дійсний binary BEAM | Завжди `{error, badfile}` | [вбудовані функції](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | Попередньо завантажені модулі завантаження системи | Кожен модуль програми | [вбудовані функції](builtins.md#code-loading) |
| `list_to_pid/1` для номера, який ніколи не видавався | Повертає терм pid | `badarg`: допускаються лише pid, створені цією програмою | [терми](terms.md#pids-and-references) |
| `list_to_port/1` для номера, який ніколи не видавався | Повертає терм порту | `badarg`: допускаються лише порти, відкриті цією програмою | [порти](ports.md#identity) |
| Значення `port_info/1,2` | `id` — індекс таблиці; `memory`, `queue_size`, `locking` описують драйвер | `id` — номер порту; `memory` і `queue_size` дорівнюють 0; `locking` — `port_level` | [порти](ports.md#builtins-and-port-messages) |
| Запис у файл, відкритий лише для читання | `{error, eacces}` у Windows, `{error, ebadf}` деінде | `{error, ebadf}` скрізь | [порти](ports.md#standard-io-and-files) |
| Порт `win32reg` | Вбудований порт `registry__drv__` (`{spawn, "registry__drv__ rw"}`), що відповідає на команди повідомленнями порту | Драйвер `clause_registry` (`{spawn_driver, ...}`), що повертає ті самі відповіді через `port_control/3`; `port_info/2` називає його `clause_registry` | [порти](ports.md#the-registry) |
| Ім'я програми в `argparse` без параметра `progname` | `progname` емулятора (`erl`) | Ім'я виконуваного файлу без розширення (`init` не має `progname`) | [бібліотека](library.md) |
| Верхній фрейм стека помилки перевірки команди в `argparse` | Функція перевірки (`argparse:validate_command/2`, `validate_option/2`, fun усередині них) з `[Entity]` | `argparse:validate/2` з `[Entity]` | [вбудовані функції](builtins.md#argparse) |
| `escript:script_name/0` | Шлях escript, перший звичайний аргумент | Шлях виконуваного файлу: програма Clause є власним скриптом | [бібліотека](library.md) |
| `escript:extract/2` з `compile_source` | Вихідний код, скомпільований у beam | `{error, {compile, ...}}`: програми Clause не мають компілятора | [бібліотека](library.md) |
| `erl_abstract_code:debug_info(core_v1, ...)` (Core Erlang з beam_lib) | Core Erlang від компілятора | `{error, failed_conversion}`: програми Clause не мають компілятора | [бібліотека](library.md) |
| `zstd:get_frame_header/1` для обрізаного заголовка кадру | Поля неініціалізованої пам'яті | Нульові поля (`'ZSTD_frame'`, розміри 0) | [вбудовані функції](builtins.md#zstd-module) |
| `file:open/2` з `raw` або `ram` | Record `#file_descriptor{}`, що обслуговується у викликачі (`is_pid/1` — false); запити `io` до нього не виконуються; файл `ram` не має `read_line/1` (`undef`), а закритий відповідає `{error, einval}` | Pid файлового сервера, як для інших файлів; позиційне введення-виведення й `sendfile/5` відповідають як для raw-файлів OTP; файл `ram` відповідає на `read_line/1` і запити введення-виведення `{error, enotsup}`, а після закриття — `{error, terminated}` | [порти](ports.md#standard-io-and-files) |
| `file:truncate/1` для файлу, відкритого лише для читання | Помилка платформи (`eacces` у Windows, `einval` на інших) | Помилка C runtime для дескриптора (`ebadf` або `einval`); сервер зупиняється як в OTP | [порти](ports.md#standard-io-and-files) |
| Файли, відкриті або налаштовані з `{utf16, _}` чи `{utf32, _}` | Рядки й символи декодуються у відповідному кодуванні | Рядки закінчуються байтом 10 до декодування | [порти](ports.md#standard-io-and-files) |
| Послідовності `io_ansi` у Linux і macOS | З бази terminfo для `TERM`, якщо вона має відповідну можливість (`setaf`, `sgr0`, ...); `tput/1,2`, `tigetnum/1`, `tigetflag/1`, `tinfo/0` читають її | Вбудовані послідовності ANSI, які OTP використовує без terminfo (як OTP у Windows); `tigetnum/1`, `tigetflag/1`, `tinfo/0` відповідають `{error, enotsup}`, `tput/1,2` піднімають `{enotsup, Capability}`; `enabled/0,1` потребує `TERM`, відмінного від `dumb` | [бібліотека](library.md#contents) |
| `io_ansi:scan/1` і `tput/1,2` у Windows | Завершуються з `try_clause` на `{error, enotsup}` від terminfo | `scan/1` зіставляє вбудовані послідовності; `tput/1,2` піднімають `{enotsup, Capability}` | [бібліотека](library.md#contents) |
| `socket` у Windows: `recvmsg`, `sendmsg`, `sendfile`, `sendmmsg`, `recvmmsg` | Піднімають `notsup` | Працюють як у Linux і macOS | [бібліотека](library.md#contents) |
| `socket` у Windows: дейтаграма, довша за довжину `recv` | `{error, {completion_status, ...more_data...}}` | Обрізана дейтаграма, як на інших платформах | [бібліотека](library.md#contents) |
| `socket` у Linux і macOS: `ioctl/2,3,4`, `getopt_native/3`, `setopt_native/3`, `open/1,2` для дескриптора, домен `local`, SCTP | Підтримуються | Відхиляються, як в OTP у Windows (`{error, {invalid, ...}}`, `notsup`); `local` дає `{error, eafnosupport}` | [бібліотека](library.md#contents) |
| `socket:info/1`, `i/0,1,2` | Лічильники й стани NIF, `fd` — дескриптор | Лічильники здійснених викликів, стани за даними модуля; `Fd` — номер порту | [бібліотека](library.md#contents) |
| Відповіді `inet_res` | Відповіді `gethostbyname`, `getbyname` і `gethostbyaddr` кешуються за TTL у `inet_db`; пошук у кеші може перелічувати адреси в іншому порядку | Нічого не кешується: кожен пошук звертається до серверів імен | [бібліотека](library.md#contents) |
| Налаштування резолвера в Linux і macOS | `inet_db` також читає файли `host.conf`/`nsswitch.conf` і `inetrc`, відстежує зміни `resolv.conf`, а в Linux визначає домен з імені хоста | Рядки `nameserver`, `domain` і `search` у `resolv.conf` та файл hosts, прочитані один раз | [бібліотека](library.md#contents) |
| `os:set_signal(Signal, handle)` (Linux, macOS) | Сигнал надсилається до `erl_signal_server`, обробник за замовчуванням якого зупиняє систему за `sigterm`, завершує її за `sigusr1` і `sigquit` | Немає `erl_signal_server`: `sigterm` і `sigquit` завершують із кодом 0, `sigusr1` — із кодом 1, інші відкидаються; без `set_signal` для `SIGTERM` зберігається системна дія за замовчуванням | [порти](ports.md#subprocesses) |
| Порожні аргументи `{spawn_executable, F}` у Windows | Відкидаються з командного рядка | Передаються як `""` | [порти](ports.md#subprocesses) |
| `{exit_status, S}` і `eof` запущеної програми | Порядок не визначено, `exit_status` може надійти раніше за останні дані | Після всіх даних, перед `eof` | [порти](ports.md#subprocesses) |
| Зайняті порти | Порт із надто великою чергою виводу призупиняє відправників, зокрема порти сокетів; `force` у `port_command/3` працює з драйверами, які це дозволяють | Зайнятими стають лише порти запущених програм; порти `fd` і сокетів — ніколи; `force` викликає `notsup` на кожному драйвері | [порти](ports.md#busy-ports) |
| `{active, N}` для сокетів | Ціле `N` лічить повідомлення до `{tcp_passive, S}` | `exit(badarg)`; лише `true`, `false` і `once` | [порти](ports.md#sockets) |
| Власні параметри сокетів `inet_drv` (`header`, `deliver`, `exit_on_close`, `send_timeout`, `send_timeout_close`, `delay_send`, порогові рівні, `packet_size`, `show_econnreset`, `buffer`, `read_packets`, `recvtos`, `recvttl`, `line_delimiter`) | Застосовуються | Зберігаються й повертаються `getopts/2` зі значеннями OTP за замовчуванням, не застосовуються; системні параметри (`nodelay`, `keepalive`, `linger`, буфери, `tos`, багатоадресне передавання, ...) застосовуються | [порти](ports.md#sockets) |
| Інші параметри сокетів (`{packet, line \| http \| ...}`, `{raw, ...}`, `bind_to_device`, `netns`) | Працюють | `exit(badarg)` під час відкриття, `{error, einval}` від `setopts/2` і `getopts/2` | [порти](ports.md#sockets) |
| `inet:getopts(S, [multicast_if])` у Windows | Читає неініціалізовану пам'ять для TCP-сокета, а для UDP-сокета після встановлення адреси — невизначену адресу | Системне значення; невизначена адреса, якщо сокет не має адреси | [порти](ports.md#sockets) |
| `port_info(Socket, input \| output)`, `input` і `output` з `inet:info/1` | Байти команд драйвера та відповідей | 0: трафік сокетів рахує лише `inet:getstat/1,2` | [порти](ports.md#sockets) |
| Причини помилок сокетів | Кожна причина POSIX, про яку повідомляє система | Поширені (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); інші — `eio` | [порти](ports.md#sockets) |
| Введення порту, коли під'єднаний процес утримує 1 024 повідомлення і може виконуватися | Продовжує читати й доставляти | Припиняє доставку, доки не закінчиться квант часу процесу; понад 64 KiB утримуваних даних припиняє читання, тож програма, що пише, блокується | [порти](ports.md#busy-ports) |
| `gen_tcp:close/1` із виводом у черзі | Чекає до межі `linger`/`send_timeout`, поки вивід буде відправлено | Повертається одразу; потік вводу-виводу надсилає вивід із черги, потім закриває | [порти](ports.md#sockets) |
| Типи `monitor/2` | `process`, `port`, `time_offset` | `process` і `port`; `time_offset` викликає `badarg` (зміщення часу не змінюється) | [процеси](processes.md#monitors) |
| `exit/2`, `exit_signal/2` до посилання | Надсилає псевдоніму процесу, якщо посилання активне | Нічого: сигнали виходу ніколи не надходять до псевдонімів | [процеси](processes.md#exit-signals) |
| Номери посилань | Поєднують ідентифікатор планувальника і лічильники окремих планувальників (`#Ref<0.178111994.4235460610.214105>`) | Один лічильник на всю програму (`#Ref<0.0.0.1>`), тож посилання впорядковані за часом створення | [терми](terms.md#pids-and-references) |

## Помилки, трасування стека і звіти

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Розташування в трасуванні стека | `[{file, F}, {line, L}]`, `error_info` для `error/3` | Завжди `[]`; без `error_info`, тому `erl_error:format_exception/3,4` не показує для них розташувань чи рядків `*** argument` | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` із записами стека `{Fun, Args}` | Приймаються | Відхиляються | [ABI](abi.md#stack-traces) |
| Верхній фрейм `function_clause` | Список аргументів | Арність | [ABI](abi.md#stack-traces) |
| Верхній фрейм `undef` для виклику `M:F(A1, ..., An)` | `{M, F, [A1, ..., An], []}` | `{M, F, N, []}`: арність замість аргументів (`apply/3` і виклики fun показують аргументи) | [fun](funs.md#dynamic-calls) |
| Динамічний виклик експорту, недосяжного для виконуваного файлу (його модуль названо лише через трасування стека, виняток або повідомлення ззовні програми) | Викликає його | `undef`, якщо не зібрано з `--keep-exports`; `function_exported/3` і `module_info(exports)` усе одно його перелічують | [виконувані файли](executables.md#export-liveness) |
| Фрейми BIF/операторів, що завершилися з помилкою | Присутні (`{erlang, '+', Args, ...}`) | Відсутні; нічого нижче за вхідну функцію | [ABI](abi.md#stack-traces) |
| Таблиця атомів заповнена (`list_to_atom/1`) | Емулятор аварійно зупиняється (`no more index entries in atom_tab`) і записує crash dump | `clau: runtime failure: entry call failed: resource_limit`, код виходу 70 | [вбудовані функції](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` із символами понад 255 | Його перші цифри використовують лише молодший байт кожного символу (`[16#131]` дає 1) | `badarg` | [вбудовані функції](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` для BIF | True для кожного BIF емулятора | True лише для вбудованих функцій, які надає цей runtime | [вбудовані функції](builtins.md#how-calls-reach-them) |
| Звіти про помилки аварійно завершених процесів | Надсилаються до logger, записуються пізніше його обробником за замовчуванням (у стандартний вивід під `erl`, часто губляться, коли escript зупиняється раніше) | Записуються в stderr, коли процес завершується, до будь-якого подальшого виводу; не є подією `logger`, тому обробники й фільтри їх не бачать | [процеси](processes.md#exits) |
| Виклики функцій, що ніколи не повертаються | Компілюються як хвостові виклики (викликача немає в трасуванні) | Звичайні виклики (викликач присутній) | [ABI](abi.md#stack-traces) |
| Винятки всередині відомого анонімного fun на `-O2` (`F = fun ... end, F(X)`, `lists:map(fun ... end, L)` та інші цикли списків, `maps:fold(fun ... end, A, M)`) | Фрейми fun (`-f/1-fun-0-`) і допоміжних функцій `lists` та `maps` (`lists:map_1/2`) | Тіло fun вбудовується у викликача: ці фрейми відсутні, а неправильний хвіст списку в `map/2`, `foldl/3`, `all/2`, `any/2`, `flatmap/2` піднімає `function_clause` із викликачем на вершині | [fun](funs.md#inlined-funs) |
| Пам'ять хоста вичерпано | Емулятор повідомляє, що не може виділити пам'ять, записує crash dump і зупиняється | `clau: runtime failure: entry call failed: out_of_memory`, код виходу 70, без dump | [купа runtime](runtime-heap.md#failure-behavior) |
| Зберігання map з понад 32 ключами | HAMT у купі з 16-шляхових хешованих вузлів | B+ дерево в купі з вузлами до 16 записів у порядку ключів; розміри купи великих map відрізняються від OTP | [купа runtime](runtime-heap.md#map-trees) |
| Обмеження пам'яті процесу | `max_heap_size` (у словах, купа і стек) вбиває процес із причиною `killed` і журналює звіт про помилку | `--max-heap` / `--max-stack` (у байтах) і загальний для runtime `--max-memory` завершують процес, що запитує пам'ять, як `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, код виходу 70 | [купа runtime](runtime-heap.md#runtime-memory-limit) |
| Аргументи програми | `escript` передає кожен аргумент у `main/1`; прапорці емулятора (`+t`) беруться з `%%!` або `ERL_FLAGS` | Початкові параметри runtime (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) вилучаються першими; `CLAUSE_FLAGS` містить ті самі параметри | [виконувані файли](executables.md#runtime-options) |
| Неперехоплений виняток у звичайному вхідному модулі | `escript` завершується з кодом 127 | Завершується з кодом 1 і одним рядком `uncaught exception <class>: <reason>` (вихідні файли escript зберігають 127) | [виконувані файли](executables.md) |
| Діагностика компілятора | Формулювання `erl_lint` (`variable 'X' is unbound`) і попередження | Власні формулювання (`unbound variable X`); попередження lint з OTP здебільшого не видаються (також попередження для native record: невідомі поля в доступі, оновленні та зразках, кваліфіковане конструювання власного модуля без значень, невикористані record або record, визначені в заголовку; пізніший зразок, що зіставляє ім'я, експортоване з гілки) | [семантика](semantic.md#bindings) |
| Модуль поведінки з написаною вручну `behaviour_info/1` | Викликає її під час компіляції користувачів і попереджає про відсутні, неправильно визначені або застарілі callback-функції | Не обчислюється: callback-функції його користувачів не перевіряються | [семантика](semantic.md#behaviours) |
| Модулі поведінок поза пакетом і бібліотекою Clause (`application`, ...) | Завантажуються зі шляху коду; їхні callback-функції перевіряються | Попередження `behaviour M undefined` | [семантика](semantic.md#behaviours) |
| Обробник `logger` за замовчуванням | `logger_std_h`, що записує асинхронно із захистом від перевантаження (режими синхронізації, відкидання й очищення, обмеження сплесків, завершення за перевантаження) | Також у `standard_io` (`standard_error` з `CLAUSE_LOGGER_TYPE=standard_error`), але кожна подія записується до повернення виклику журналювання; параметри перевантаження перевіряються й зберігаються без впливу | [бібліотека](library.md) |
| Процеси обробників `logger_std_h` | Під наглядом `logger_sup`, перезапускаються через `overload_kill_restart_after` | Зв'язані із сервером `logger`; обробник, процес якого завершується, видаляється | [бібліотека](library.md) |
| `net_adm:names/0,1` | Звертається до epmd: `{ok, Names}`, коли epmd працює на хості | `{error, address}`: Clause не має клієнта epmd | [бібліотека](library.md) |
| `net_kernel:start/1,2` | Запускає розподілений режим або повертає помилку OTP, якщо це неможливо | Недоступно (`not_implemented`) | [бібліотека](library.md) |
| Трасування: `erlang:trace/3`, `trace_pattern/2,3`, `trace_info/2`, `trace_delivered/1`, `system_monitor/0,1,2`, `system_profile/0,2`, `seq_trace/2`, `seq_trace_info/1`, `seq_trace_print/1,2`, `dt_*`, модуль `trace`, `erl_tracer:enabled/3`, `trace/5` | Трасують | `error:notsup` | [вбудовані функції](builtins.md#erlang-module) |
| Токени `seq_trace` | Передаються з повідомленнями; порядкові номери їх рахують; системний трасувальник отримує повідомлення трасування | Зберігаються лише в процесі: не передаються далі, порядкові номери залишаються встановленими, повідомлень трасування немає | [бібліотека](library.md) |
| Області `pg` і `global` | Реплікуються між з'єднаними вузлами; `pg` відстежує вузли через `net_kernel` | Один вузол, без інших вузлів і їх моніторингу | [бібліотека](library.md) |
| Ресурси застосунків | Файли `.app`, знайдені на шляху коду під час завантаження; `sys.config`, `-config` і аргументи `-App Key Value` задають середовища | Компілюються у виконуваний файл із ресурсних файлів збирання; їх зміна потребує повторного збирання; файлів конфігурації й аргументів немає | [бібліотека](library.md#applications) |
| Застосунки `kernel` і `stdlib` | Запускаються під час завантаження; `kernel` має головний процес і верхній супервізор | Завантажені й працюють без головних процесів: `get_supervisor(kernel)` — `undefined`, `info/0` перелічує їх як запущені з `undefined` | [бібліотека](library.md#applications) |
| `application:ensure_all_started/3` з `concurrent` | Запускає незалежні застосунки одночасно; список відповідає порядку завершення | Запускає їх послідовно, спершу залежності | [бібліотека](library.md#applications) |
| `application:takeover/2` | Чекає на контролер розподілених застосунків | Завершується з `noproc` (немає `dist_ac`), як і `load/2` з вузлами в обох | [бібліотека](library.md#applications) |
| Запити введення-виведення до головного процесу застосунку | Пересилаються керівнику групи, під яким запущено застосунок | Обслуговуються через стандартне введення-виведення | [бібліотека](library.md#applications) |
| `erlang:process_flag(error_handler, Module)` | Runtime викликає `Module:undefined_function/3` і `undefined_lambda/3` для невизначених викликів | `badarg`; `process_info/2` завжди повертає `error_handler`, а невизначені виклики піднімають `undef` безпосередньо ([`error_handler`](library.md) можна лише викликати) | [бібліотека](library.md) |
| Подробиці звітів про аварії (`proc_lib`) | Текст винятку від `erl_error` з розширеною інформацією про помилку; сусіди з `current_function`, `initial_call` і `current_stacktrace`; фактичні `reductions` | Рядок класу винятку й фрейми стека без розширеної інформації про помилку; сусіди без цих елементів; `reductions` — 0 | [бібліотека](library.md) |
| `client_info` у звітах про помилки `gen_server`, `gen_statem` і `gen_fsm` | `current_stacktrace` процесу, що викликає | `[]`: Clause не зберігає поточний стек іншого процесу | [бібліотека](library.md) |
| `-behaviour` зі значенням, що не є атомом | Попередження друкує терм через `~w` (`behaviour [115,116,114] undefined`) | Друкує вихідний текст атрибута (`behaviour "str" undefined`); помилка та сама | [семантика](semantic.md#behaviours) |
| `module_info(md5)` і `vsn`, який OTP з нього виводить | MD5 скомпільованого коду BEAM | MD5 надрукованого вихідного коду модуля; виведене ціле `vsn` відповідно відрізняється | [семантика](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` застосунку compiler з OTP, `options`, передані йому | Версія Clause; `options` завжди `[]` | [семантика](semantic.md#predefined-functions) |
| `module_info(functions)` | Також перелічує функції, які OTP генерує для fun (`'-f/0-fun-0-'/0`) | Лише функції з вихідного коду і попередньо визначені | [семантика](semantic.md#predefined-functions) |
| `-nominal` у `module_info(attributes)` | Зберігається як `{nominal,[{Name,AbstractType,Params}]}` в абстрактному форматі | Пропускається | [семантика](semantic.md#predefined-functions) |
| Функція бібліотечного модуля Clause, яку Clause ще не реалізує (BIF `erlang`, `lists:rmerge/2`, ...) | Виконується | Компілюється; під час виклику піднімає `error({not_implemented, F, A})` з `M:F/A` на вершині стека ([статуси](../library/modules.terms)) | [бібліотека](library.md#provided-or-missing), [вбудовані функції](builtins.md#erlang-module) |
| Імпорт модуля поза пакетом | Компілюється; виклик викликає `undef` під час виконання, якщо модуля немає | Помилка компіляції `unknown module M`, коли імпорт викликається (невикористані імпорти модуля не потребують) | [семантика](semantic.md#imports) |
| Попередження `import directive overrides auto-imported BIF` | Для кожного автоімпортованого BIF з `erl_internal:bif/2` | Лише для автоімпортованих BIF, які реалізує Clause | [семантика](semantic.md#imports) |

## Граничні випадки мови

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Цілочисловий сегмент, ширший за межу цілих чисел, зі значенням понад неї (`<<V:4194241>>` з усіх одиниць) | JIT для x86 зіставляє з недійсним термом; його використання призводить до аварії VM | Немає збігу | [терми](terms.md#integers) |
| Zip-група, у якій нестрогий і строгий генератори мають спільну змінну | Перевірка пропуску зберігає змінні строгих зразків у нестрогих зразках | Відхилений крок пропускається щоразу, коли строгі зразки збігаються самі по собі | [зразки](patterns.md#comprehensions) |
| Виклик зовнішнього fun, `M:F(Args)` або `apply/3` модуля поза програмою | Завантажує модуль зі шляху коду, `undef`, якщо його немає | `undef`; бібліотечні модулі входять до програми лише тоді, коли вона називає їх літеральним атомом | [fun](funs.md#dynamic-calls), [бібліотека](library.md#how-programs-get-them) |
| Файли без `#!`, передані як escript | `escript file.erl` пропускає перший рядок | Компілюються як звичайні модулі | [виконувані файли](executables.md) |
| Попередньо скомпільовані beam та архівні escript | Виконуються | Не підтримуються | [виконувані файли](executables.md) |
| Ім'я модуля escript без `-module` | `<name>__escript` плюс суфікс із часовою міткою/унікальним значенням | `<name>__escript`, детерміноване | [виконувані файли](executables.md#escripts) |
| `include_lib` застосунку, знайденого в кількох каталогах `<app>-<version>` | Шлях коду містить одну версію (завантаження вибирає найвищу); без діагностики | Найвища версія в кожному каталозі пошуку, з одним попередженням за запуск, що їх перелічує | [препроцесор](preprocessor.md#compatibility-policies) |
| `-spec`, типи якого не мають спільного значення з виведеним результатом, вхідною областю визначення чи аргументами виклику | Компілюється; Dialyzer може попередити | Суперечлива вхідна область визначення аргументів — помилка компіляції із зазначенням оголошених і виведених типів; суперечливий результат чи виклик — попередження, і використовуються виведені типи | [семантичний аналіз](semantic.md#inference) |

## ETS

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Порядок `first/1`, `next/2`, `tab2list/1`, `foldl/3` і `i/1` для таблиць `set`, `bag` і `duplicate_bag`, а також що нумерує `slot/2` | Комірки лінійного хешування обходяться блокування за блокуванням; порядок змінюється зі зростанням таблиці | Частини, потім кошики за порядком, потім ключі в порядку вставлення всередині кошика; комірка — один кошик | [runtime](runtime.md#ets-tables) |
| `ets:all/0` | Містить таблиці `kernel` і `stdlib` з OTP; порядок відповідей планувальників | Лише таблиці програми, без певного порядку | [вбудовані функції](builtins.md#ets) |
| `memory` у `info/2` | Виділені слова таблиці та її об'єктів | Слова збережених об'єктів і власні накладні витрати Clause | [вбудовані функції](builtins.md#ets) |
| `{write_concurrency, auto}` | Кількість блокувань адаптується до конкуренції (від 64 до 8192) | 64 фіксовані частини, як для `true`; `stats` повідомляє про 64 блокування | [runtime](runtime.md#ets-tables) |
| `compressed` | Зберігає елементи, крім ключа, у зовнішньому форматі | Приймається й відображається; об'єкти зберігаються як є | [вбудовані функції](builtins.md#ets) |
| `stats` у `info/2` для `ordered_set` з `write_concurrency`; `data`; `binary` | CA-дерево `{RouteNodes, BaseNodes, MaxDepth}`; друк таблиці; binary таблиці поза купою | `false`; `true` без друку; `[]` | [вбудовані функції](builtins.md#ets) |
| `badarg` від вбудованої функції `ets` | Містить `error_info` з причиною (`id`, `access`, `type`, ...) | Звичайний `badarg` | [вбудовані функції](builtins.md#ets) |
| Порядок результатів `select`, `match` і `match_object` для хеш-таблиць та склад кожної порції `select/3` | Результати кожного кроку обходу додаються на початок списку, найновіші першими; комірки лінійного хешування | Порядок обходу частин і кошиків Clause; кожна порція — перші `Limit` зібраних результатів | [вбудовані функції](builtins.md#ets) |
| `select_delete/2`, `select_replace/2` для всієї таблиці | Передають керування кожні 1000 об'єктів (таблиця тим часом зафіксована) | Виконуються цілком, кожна частина під своїм блокуванням | [runtime](runtime.md#ets-tables) |
| Специфікації зіставлення зі змінною під номером 25 або вище | Перенумеровує кожен атом `'$N'` у специфікації, навіть усередині `{const, ...}` (тому `{const, '$30'}` дає `'$0'`) | Змінні зберігають номери; `{const, '$30'}` дає `'$30'` | [runtime](runtime.md#match-specifications) |
| Guard і тіла специфікацій зіставлення з вкладеністю понад 1000 рівнів | Компілюються до вичерпання стека C (`system_limit`) | `system_limit` | [runtime](runtime.md#match-specifications) |
| Дії трасування в `erlang:match_spec_test/3`: `enable_trace`, `disable_trace`, `trace` з коректними прапорцями | Змінюють прапорці трасування викликача (29.1.1 аварійно завершується без трасувальника) | `true` після перевірки прапорців (і того, що аргумент pid живий); нічого не змінюється | [вбудовані функції](builtins.md#ets) |
| `ets:tab2file/2,3` і `file2tab/1,2` | Через процес disk_log з іменем у вигляді нового посилання | Запис і читання безпосередньо через `file` | [вбудовані функції](builtins.md#ets) |
| `{process_dump}` і `{current_stacktrace}` у `erlang:match_spec_test/3` | Текст дампа процесу; трасування його стека | `<<>>`; `[]` | [вбудовані функції](builtins.md#ets) |

## dets

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Запити, що одночасно чекають біля таблиці | Пошуки, вставлення й видалення, поставлені в чергу разом, використовують одне оновлення кешу; відповіді на пошуки надходять до записів; зафіксована таблиця присипляє деякі процеси запису на 1 ms | Кожен запит по черзі, у порядку надходження | [вбудовані функції](builtins.md#dets) |
| Тривалі операції dets (відновлення, `init_table/2,3`, ущільнення, скидання великого кешу) | Код Erlang, що витісняється за лічильником редукцій | Кожна — один виклик вбудованої функції; робочий потік таблиці тим часом не виконує нічого іншого | [вбудовані функції](builtins.md#dets) |
| Процеси `dets` | Сервер `dets` і `dets_sup` під `kernel_safe_sup`, таблиці під `dets_sup` | Сервер `dets`, запущений за першого використання, без нагляду; процеси таблиць зв'язані з ним | [вбудовані функції](builtins.md#dets) |
| Порядок `dets:all/0` | Порядок ETS реєстру | Порядок ETS Clause ([ETS](#ets)) | [вбудовані функції](builtins.md#dets) |
| Звіти | Відновлення журналюється на рівні info; `verbose/0,1` і `DETS_DEBUG` журналюють більше; внутрішній збій — `{dets_bug, ...}` | Нічого не журналюється | [вбудовані функції](builtins.md#dets) |

## io

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| `~p`, `~w` і функції виведення `io_lib` для контейнерів із вкладеністю понад 256 | Виводяться | `system_limit` | [введення-виведення](io.md#pretty-printing-p) |
| `io_lib:print/4` зі стовпцем або довжиною рядка, що не є цілим числом | Залежить від терма: виведення (guard мовчки не спрацьовують), `function_clause` або `badarith` | `badarith` для будь-якого терма-контейнера | [io_lib](builtins.md#io_lib) |
| Від'ємна точність або кількість заповнення (`~.*c` з -1) | Нескінченний цикл | `badarg` | [io](io.md#formats) |

## erl_scan

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Розташування продовження `tokens/3,4` (`continuation_location/1`, не документовано) | Місце зупинки сканера всередині незавершеного токена | Початок незавершеного токена, який сканується знову з наступними символами | [erl_scan](builtins.md#erl-scan) |
| `{compiler_internal, [ssa_checks]}` | Сканує коментарі перевірок `%ssa%` у токени | Ігнорується: вони залишаються коментарями | [erl_scan](builtins.md#erl-scan) |
| Число з рухомою комою з основою (`16#1.8#e1`, основа відмінна від 10), цифри якого перевищують 53 біти | Мантиса перетворюється так, як ERTS перетворює великі цілі числа | Накопичується в double; останній біт може відрізнятися | [erl_scan](builtins.md#erl-scan) |
| Елемент списку, що не є символом, усередині рядка, атома в лапках або escape-послідовності | `function_clause`, `case_clause` або `if_clause`, залежно від клаузи | `function_clause` | [erl_scan](builtins.md#erl-scan) |

## erl_parse

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Токени `'%ssa%'` (клаузи перевірки SSA з тестів компілятора OTP) | Розбираються в клаузи `ssa_check_when` | Синтаксична помилка; `erl_scan` ніколи не створює цей токен | [erl_parse](builtins.md#erl-parse) |

## erl_eval

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Трасування стека помилки, яку піднімає інтерпретатор (`{badmatch, V}`, `undef` локального виклику, ...) | Поточний стек процесу інтерпретації (`current_stacktrace` у `process_info/2`) | Стек у точці `throw` інтерпретатора, що його збирає, у фреймах Clause | [erl_eval](builtins.md#erl-eval) |

## erl_lint

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Поведінки, названі в `-behaviour` | Будь-який модуль на шляху коду відповідає на `behaviour_info/1` | Відповідають лише модулі, скомпоновані в програму; інші дають `undefined_behaviour` | [erl_lint](builtins.md#erl-lint) |
| Порядок кількох помилок, знайдених в одному згортанні map (одиночні змінні одного типу, специфікації без функції, перевірки callback-функцій) | Внутрішній порядок map (атоми за індексом) | Порядок термів | [erl_lint](builtins.md#erl-lint) |
| `erlang:is_builtin/3` для неекспортованих записів `-deprecated`, `-removed` і `-unsafe` | Таблиця BIF OTP | Вбудовані функції runtime, зокрема нативні бібліотечні функції | [erl_lint](builtins.md#erl-lint) |
| `is_guard_expr/1` для конструювання record | Піднімає `case_clause` | Відповідає, чи є поля виразами guard | [erl_lint](builtins.md#erl-lint) |

## epp

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| `-include_lib("App/...")` поза шляхом включення | Знаходиться в `code:lib_dir(App)`, що знає застосунки OTP | Знаходиться в `code:lib_dir(App)` шляху коду Clause, який не має застосунків OTP, якщо їх туди не додано | [бібліотека](library.md#contents) |

## erl_pp

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Форма символів, які повертає `erl_pp` | Глибоко вкладені списки символів | Один плоский список символів; після сплощення вивід однаковий | [вбудовані функції](builtins.md#erl-pp) |

## qlc

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Трасування стека винятку в процесі курсора, який повторно піднімає `next_answers/1,2` | Трасування стека курсора, за яким іде `process_info(self(), current_stacktrace)` власника | Далі йде трасування стека винятку, перехопленого у власнику (Clause не має елемента `current_stacktrace`) | [qlc](builtins.md#qlc) |
| `qlc:q/1,2` в `erl_eval`, `ets:table/1,2`, `dets:table/1,2` у програмі, що ніколи не називає `qlc` | `qlc` завжди завантажено | `undef` для `qlc`: вони звертаються до нього за іменем під час виконання, тому його компонують лише програми, що називають `qlc` (це робить кожен модуль, що включає `qlc.hrl`) | [бібліотека](library.md#how-programs-get-them) |
| Номери анотацій у коді скомпільованих запитів (`info/2` з `{format, abstract_code}`) | Перетворення OTP нумерує анотації з урахуванням кожного цілого числа модуля, зокрема символів шляху `qlc.hrl` в його атрибуті `file` | Те саме перетворення, але `qlc.hrl` Clause має інший шлях, тому номери після першого запиту можуть відрізнятися; решта коду однакова | [qlc](builtins.md#qlc) |

## qlc_pt

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Повідомлення `qlc_pt:parse_transform/2` під час виконання | Від `compile:noenv_forms/2` (`strong_validation`): `erl_lint` і основні проходи компілятора, зокрема попередження `sys_core_fold` | Лише від `erl_lint`, як в OTP `qlc_pt`, коли компілятор недоступний | [qlc_pt](builtins.md#qlc-pt) |

## Інтерактивна оболонка

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Редагування рядка в терміналі | `edlin`: клавіші курсора, історія рядків, пошук, доповнення клавішею Tab через `edlin_expand`, багаторядкове запрошення `..>` | Власне редагування рядка термінала (cooked); рядки читаються в міру їх надходження від термінала, з однаковим запрошенням для кожного наступного рядка команди, як в OTP для введення через канал | [бібліотека](library.md#interactive-shell) |
| Керування завданнями | Ctrl+G відкриває меню JCL (нові, під'єднані, перервані й завершені оболонки) | Відсутнє; банер і підказка для повільних команд усе одно згадують Ctrl+G, як їх друкує OTP | [бібліотека](library.md#interactive-shell) |
| `exit().`, коли оболонка читає введення через канал | Запускається нова оболонка й більше нічого не читає | Запускається нова оболонка й читає решту введення | [бібліотека](library.md#interactive-shell) |
| Програми, що запускають оболонку без `--shell` | Можна викликати кожен модуль шляху коду | Лише модулі, скомпоновані в програму; без `--keep-exports` динамічні виклики досягають лише експортів, досяжних для програми | [бібліотека](library.md#interactive-shell) |
| Record скомпільованих модулів (`rr(Module)`, `shell_default` і `user_default` під час запуску) | Читаються з налагоджувальної інформації або вихідного коду модуля | `{error, nofile}`: скомпонований код не зберігає абстрактного коду; `rr/1,2,3` читають його з вихідних і `.beam` файлів | [бібліотека](library.md#interactive-shell) |
| `save_module/1` | Записує модуль і компілює його через `c:c/1` | Лише записує модуль (компілятора немає) | [бібліотека](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` усередині виклику або значення поля record | Заголовки функцій і типи аргументів зі специфікації функції (`lists:seq(From, To)`), атоми й типи, які дозволяє специфікація | Заголовки `Mod:Fun/Arity` для експортованих арностей, без підказок типів: скомпонований код не зберігає специфікацій | [бібліотека](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` для функцій і модулів | Функції, згруповані за групами документації; модулі шляху коду | Одна група `Functions` (документації немає); модулі програми | [бібліотека](library.md#interactive-shell) |
| Стовпці `c:i/0,1`, `c:ni/0`, `c:regs/0` | Початковий виклик і поточна функція кожного процесу | Початковий виклик `proc_lib` або `undefined`; поточна функція — `undefined` (немає елемента `current_function`) | [бібліотека](library.md#interactive-shell) |

## Випадкові числа

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Висоти смуг нормального зикурата `rand` | Табличні константи | Обчислюються до найближчого double з констант зикурата; висота може відрізнятися останнім бітом, що змінює прийняття на повільному шляху лише для вибірки в межах цього біта від границі (ймовірність близько 2^-53 на вибірку повільного шляху). Ширини й границі смуг отримано спостереженням за OTP, вони однакові | [вбудовані функції](builtins.md#random-numbers) |

## crypto

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Порядок `crypto:supports(ciphers)` | Таблиця NIF, відсортована за індексом атома, що змінюється між запусками VM, потім псевдоніми | Порядок таблиці OTP, потім псевдоніми | [вбудовані функції](builtins.md#crypto-module) |
| `{File, Line}` у помилках `{badarg \| notsup \| error, {File, Line}, Description}` модуля `crypto` | Файл вихідного коду C й рядок OTP (`{"hash.c", 111}`) | Файл вихідного коду C++ й рядок Clause (`{"hash.cpp", 63}`); клас і опис — як в OTP | [вбудовані функції](builtins.md#crypto-module) |
| `link_type` у `crypto:info/0` | Спосіб компонування libcrypto в OTP (зазвичай `dynamic`) | Завжди `static`, також коли компонується встановлена спільна бібліотека libcrypto | [OpenSSL](crypto.md) |
| Тривалі обчислення `pbkdf2_hmac/5` (понад 100 ітерацій або 64 байти) | Виконуються на планувальнику dirty CPU | Виконуються на робочому потоці планувальника процесу-викликача, який тим часом не виконує інших процесів | [вбудовані функції](builtins.md#crypto-module) |
| `modules` застосунку `crypto` | `[crypto, crypto_ec_curves]` | `[crypto]` | [бібліотека](library.md) |
| Довгі тексти `crypto_one_time/4,5` і `crypto_one_time_aead/4,6,7` (понад 20000 байтів) | Виконуються на планувальнику dirty CPU | Виконуються на робочому потоці планувальника процесу-викликача, який тим часом не виконує інших процесів | [вбудовані функції](builtins.md#crypto-module) |
| Змінна середовища застосунку `fips_mode` для `crypto` | Читається під час завантаження модуля `crypto`: `true` вмикає режим FIPS | Не читається (Clause не має `on_load`, а програми не мають `sys.config`): використовуйте `crypto:enable_fips_mode/1` або `clau --fips` | [crypto](crypto.md#fips) |
| `crypto:info_fips/0` без доступного для завантаження провайдера FIPS | `not_enabled`, якщо OTP зібрано з підтримкою FIPS, інакше `not_supported` | `not_supported` | [crypto](crypto.md#fips) |
| Коли завантажується застосунок `crypto` | Під час завантаження модуля `crypto` (його `on_load`) | Коли генератор `crypto_cache`, `crypto_aes` або `crypto_prng1` уперше читає `rand_cache_size` | [бібліотека](library.md) |
| Генерування ключів RSA (`crypto:generate_key(rsa, ...)`) і підписи SLH-DSA | Виконуються на планувальнику dirty CPU | Виконуються на робочому потоці планувальника процесу-викликача, який тим часом не виконує інших процесів | [вбудовані функції](builtins.md#crypto-module) |
| Параметр `rsa_sslv23_padding` у `crypto:public_encrypt/4` і споріднених функціях | Приймається, коли OTP зібрано з OpenSSL, що має заповнення SSLv23 (1.1, 3.x) | `"Bad padding type in option rsa_padding"`, як в OTP, зібраному з OpenSSL 4 | [вбудовані функції](builtins.md#crypto-module) |
| `crypto:ec_curve/1` для кривої, якої немає у скомпонованій libcrypto (OpenSSL, зібраний без двійкових кривих) | Параметри з `crypto_ec_curves` | `error:function_clause`, як для невідомої кривої: параметри беруться з вбудованих кривих libcrypto | [вбудовані функції](builtins.md#crypto-module) |
| Розшифрування налагоджувальної інформації через `beam_lib` у програмі, яка не викликає `crypto` | `crypto` завжди присутній | `key_missing_or_invalid`, якщо програма не компонує `crypto` (`--with-crypto`), оскільки `beam_lib` викликає його динамічно | [бібліотека](library.md) |

## ASN.1

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Стек у `{error, {asn1, {Reason, Stack}}}` | Фрейми згенерованих функцій `enc_*`/`dec_*` і `asn1rtt_*` | Фрейми `Module:encode/2` або `decode/2` та вбудованої функції кодека | [asn1](asn1.md#generated-modules) |
| Функції згенерованого модуля | Також експортує `enc_Type/1,2`, `dec_Type/1,2` та інші функції для кожного типу, які генерує asn1ct | Лише `encode/2`, `decode/2`, `info/0`, функції параметрів і функції значень | [asn1](asn1.md#generated-modules) |
| `CHOICE`, тіло якого починається з `...` (без кореневих альтернатив) | asn1ct повідомляє про синтаксичну помилку | Приймається | [asn1](asn1.md#coverage) |
| Макроси й функції значень, що називають інше значення всередині відкритого типу (`mgf1SHA1`, `rSASSA-PSS-Default-Identifier` з PKCS-1) | asn1ct залишає `{'Externalvaluereference', Line, Module, Name}` замість значення | Значення, на яке посилаються | [asn1](asn1.md#generated-modules) |
| Помилка runtime (не ASN.1) під час декодування чи кодування значення розширення в `public_key` | Піднімається в момент виникнення, здебільшого класу `error`, зі згенерованої функції `dec_ext-*`/`enc_ext-*` | `exit({error, {asn1, Reason}})`: значення проходить через `decode/2` або `encode/2` згенерованого модуля, що обгортає кожен збій | [public_key](public_key.md#functions) |
| Групи Діффі — Геллмана за замовчуванням у `public_key:dh_gex_group/4` | Групи, згенеровані OTP (`lib/public_key/priv/moduli`), 60–81 для кожного розміру | Вісім для кожного розміру з файлу moduli OpenSSH; ті самі розміри (від 2047 до 8191) | [public_key](public_key.md#keys-and-signatures) |
| Фрейми винятку `public_key` | `public_key`, `pubkey_pem`, `pubkey_pbe`, `pubkey_cert_records`, `pubkey_cert`, `pubkey_ssh` | `public_key`, `clause_public_key_codec` і `clause_public_key_keys` | [public_key](public_key.md#functions) |

## Parse transforms

| Відмінність | OTP | Clause | Власник |
| --- | --- | --- | --- |
| Ім'я в атрибуті `file` включеного файлу (`--print-abstr`, вхід перетворення) | Каталог включення, поєднаний з ім'ям, як знайдено (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | Шлях відносно робочого каталогу, якщо файл у ньому, інакше абсолютний шлях | [перетворення](transforms.md#interchange) |
| Анотації рядка 0 в імпортованих формах (згенерований код, наприклад від перетворення `qlc`) | Коректний рядок: код не має вихідного рядка | Код займає місце вузла, імпортованого перед ним | [перетворення](transforms.md#importing-forms) |
| Анотації `generated` імпортованих форм (входи `.abstr`, вихід перетворення) | `erl_lint` і компілятор пропускають деякі попередження для згенерованого коду | Ігноруються: код перевіряється як вихідний | [перетворення](transforms.md#importing-forms) |
| Форми `{error, {Location, Module, Descriptor}}` в імпортованому коді | Форматуються через `Module:format_error/1` | Текст терма дескриптора; форматування потребує OTP | [перетворення](transforms.md#importing-forms) |
| Модуль із помилками препроцесора чи розбору, що називає parse transform | Перетворення виконується й отримує помилки як форми `{error, E}`; `erl_lint` повідомляє про них згодом | Про помилки повідомляється, і перетворення не виконується | [перетворення](transforms.md#clause-pipeline) |
| Параметри компіляції, які отримує перетворення | Повний список параметрів erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (робочий каталог), `{i, _}`, `{d, ...}` і `{parse_transform, _}` | [перетворення](transforms.md#otp-behavior) |
