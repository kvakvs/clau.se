---
source: docs/library.md
sourceCommit: 336caea7
sourceSha256: 0fc98265c5256c76cd34c89f89a48993e3452732ca40c3a295860a34bee27186
translatedAt: 2026-10-18
---

# Модулі бібліотеки

Clause постачає власні версії модулів OTP, які викликають програми, написані
на Erlang за документованою поведінкою OTP (не скопійовані з вихідних кодів
OTP) поверх [вбудованих функцій](builtins.md) runtime, і компілює їх разом із
програмами, що їх використовують.

## Вміст

Кожен наданий модуль експортує повний список OTP 29 для свого імені; його
інвентар `<module>.terms` ([файли](#files)) записує, які функції реалізовано,
а які є заглушками.

| Модуль | Вміст |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | Поширені функції; функції даних, як-от `sublist/2,3`, `flatten/1,2`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2`, — вбудовані функції runtime; кожну документовану функцію реалізовано ([модуль lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Кожна документована функція; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... — вбудовані функції runtime, функції з fun написано Erlang ([модуль maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Кожна документована функція; обходи списків — вбудовані функції runtime, функції з fun написано Erlang ([колекції](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Кожна документована функція; григоріанська арифметика — вбудовані функції runtime, локальний час і RFC 3339 написано Erlang ([календар](builtins.md#calendar)) |
| [`filename`](../library/stdlib/filename.erl) | Кожна документована функція за правилами Unix і Windows OTP для хоста; обходи імен — вбудовані функції runtime, `absname/1,2` і `basedir/2,3` (з `HOME`, змінних XDG і `APPDATA`) написано Erlang ([імена файлів](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Кожна документована функція — вбудована функція runtime: розбір RFC 3986 з фрагментами помилок OTP, повторне складання, нормалізація, розв’язання, відсоткове кодування й запити form-urlencoded ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Кожна документована функція з iodata, помилками й порядком зворотних викликів OTP; `decode/1`, `encode/1`, `format/1,2` і екранування binary — вбудовані функції runtime, кодувальники й форматувальники з fun та декодувальники зі зворотними викликами написано Erlang ([кодування](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Кожна документована функція зі станами й послідовностями OTP; алгоритми OTP виконуються як вбудовані функції runtime, під’єднувані генератори — в Erlang ([випадкові числа](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Кожна документована функція — вбудована функція runtime, що обходить chardata як `string.erl` OTP, зберігаючи форми результатів OTP ([рядки](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Кожна документована функція — вбудована функція runtime ([кодування](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Кожна документована функція над record OTP 29; операції з record — вбудовані функції runtime, згортки й mapfold написано Erlang ([колекції](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Кожна документована функція над формами дерев і черг OTP; операції без fun — вбудовані функції runtime ([колекції](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Кожна документована функція над record OTP (множини версії 1) і map (версія 2); операції без fun — вбудовані функції runtime ([колекції](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (сервер стандартного вводу або відкритий файл), `request/1,2`, `requests/1,2` (протокол вводу-виводу OTP, [файли](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` і `nl/0,1` є вбудованими функціями runtime ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Функції виведення, перевірки, збирання даних, рушій форматування й форматувальник (`print/1,4`, `~p`, `chars_limit`) — вбудовані функції runtime з формами глибоких списків OTP; `get_until`, `format_prompt` і `write/3` написано Erlang; `fread/2,3` — заглушки ([io_lib](builtins.md#io_lib)) |
| [`binary`](../library/stdlib/binary.erl) | Кожна функція; `replace/3,4` і `list_to_bin/1` на Erlang, інші — вбудовані функції runtime ([модуль binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Кожна функція як вбудована функція runtime ([модуль math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Кожна функція — вбудована функція runtime: перетворення, `bin_is_7bit/1`, позначки порядку байтів, форми нормалізації, категорії й властивості ідентифікаторів ([модуль unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Кожна функція над згенерованими таблицями, обходи chardata — вбудовані функції runtime ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Кожна функція, крім `import/1`, поверх PCRE2 ([модуль re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Відкриття, читання, запис, позиціювання й закриття файлів, читання й запис цілих файлів, інформація про файли й операції з каталогами поверх файлового драйвера ([файли](ports.md#standard-io-and-files)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl) | Сокети поверх портів-сокетів ([сокети](ports.md#sockets)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Власний модуль Clause: протокол драйвера сокетів, спільний для трьох модулів вище |
| [`os`](../library/kernel/os.erl) | `cmd/1` через порт, запити про оточення, час і версію ([модуль maps](builtins.md#maps-module)) |
| [`code`](../library/kernel/code.erl) | Запити про завантажені модулі без сервера коду ([модуль code](builtins.md#code-module)); шляхи й завантаження — заглушки |
| [`application_controller`](../library/kernel/application_controller.erl) | Усе заглушки; затіняє модуль OTP, який викликає `prim_file` (luerl доходить до нього через `application` з OTP) |
| [`erlang`](../library/erts/erlang.erl) | Згенеровані заглушки кожного експорту `erlang` OTP 29; вбудовані функції каталогу мають тіла-заповнювачі, `nif_error/1,2` мають тіла, інші піднімають `{not_implemented, F, A}` під час виклику ([модуль erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Відповіді запущеної системи; `boot/1`, `restart/0,1` і `make_permanent/2` відхилено ([модуль init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Кожна функція як вбудована функція runtime ([постійні терми](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Кожна функція ([atomics і counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Те, що викликають `stdlib` і `kernel`; групи дистрибуції, `.beam`, емулятора й процесу purger — declined ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Файлові запити поверх `file`; завантаження й архіви — declined ([файли](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Кожна функція поверх зафіксованого zlib ([модуль zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` поверх кроків скомпільованого receive ([prim eval](builtins.md#prim-eval)) |

Результати й причини помилок збігаються з OTP 29, включно з формою помилок
реалізацій OTP на Erlang (`lists:map(F, x)` дає `{case_clause, x}`,
`lists:nth(0, L)` — `function_clause`, `lists:seq(1, 10, 0)` — `badarg`) і
його BIF (`lists:member/2`, `lists:keyfind/3`, `lists:reverse/2`, функції
`maps`: `badarg`, `{badmap, M}`, `{badkey, K}`). `lists:member/2` порівнює
через `=:=`, `lists:keyfind/3` — через `==`. `lists:sort/1` — це стабільне
сортування злиттям, проходи якого чергують зростаючі й спадні серії, тож
жодне злиття не обертає серію. Трасування стека називають функції бібліотеки,
а не OTP.

## Як програми їх отримують

- Коли пакет (batch; позиційні вхідні файли або одна ціль проєкту) називає
  модуль літеральним атомом — `M:F(...)` з літеральним `M`, `fun M:F/A`,
  `apply(M, F, Args)` з літеральним `M`, `-behaviour(M)` або
  `-import(M, ...)`, — який не визначено в жодному вхідному файлі, компілятор
  шукає `M.erl` у каталогах застосунків бібліотеки, потім у
  `source_search_paths` проєкту ([проєкти](projects.md#paths-and-discovery)),
  розбирає й компілює перший знайдений файл у пакет, а потім повторює це для
  модулів, які називають додані файли
  ([до якого модуля розв'язується ім'я](#which-module-a-name-resolves-to)).
  Виклик `M:F(...)` вбудованої функції каталогу (`io:format/2`, `os:type/0`)
  не називає модуля. `--print-inputs` перелічує вхідні файли, які це додає.
- Бібліотека — це `library/` дерева збірки, що знаходиться відносно `clau`,
  як і архів runtime, з окремим каталогом для кожного застосунку OTP (`erts`,
  `kernel`, `stdlib`).
- Модуль пакета з тим самим ім'ям замінює модуль бібліотеки з попередженням;
  вбудовані функції каталогу з цим ім'ям однаково мають перевагу
  ([реєстрація](builtins.md#registration)).
- Модулі бібліотеки — звичайні модулі пакета: вони компонуються у виконувані
  файли, а для виводу об'єктних файлів чи IR створюють власні артефакти. Це
  код на Erlang, тож вони поступаються (yield), як і інший код.
- Модуль, до якого звертаються лише через імена під час виконання
  (`M:F(...)` зі змінною `M`), не додається: такий виклик породжує `undef`,
  якщо щось інше не називає цей модуль.

## Заміни модулів runtime

Clause заміщує модулі OTP, які ERTS реалізує на C (NIF, BIF, драйвери портів,
попередньо завантажені модулі з `erts/preloaded/src`), і модулі, які OTP
генерує під час власного збирання (`unicode_util`). `kernel` і `stdlib` з OTP
— звичайний Erlang, але вони викликають ці модулі.

### Надані або відсутні

Усе, що потребує runtime і не може бути написане звичайним Erlang,
вирішується для кожного модуля окремо, а там, де модуль поєднує різні
завдання, — для кожної групи функцій:

- **Надані (provided):** Clause постачає модуль з точним списком експортів
  OTP 29. Кожна функція має один із чотирьох статусів: `implemented`
  (вбудована функція runtime або тіло на Erlang поверх наявних служб
  runtime), `refused` (повертає чи породжує те, що викликачі в OTP уже
  обробляють, коли можливість відсутня, наприклад `{error, enotsup}`), `stub`
  (породжує `error({not_implemented, F, A})` з `M:F/A` на вершині стека, як
  це роблять [заглушки `erlang`](builtins.md#erlang-module); ще не зроблено)
  або `declined` (заглушка, що лишається, з причиною, як-от дистрибуція чи
  завантаження коду). Новий модуль починається з того, що кожна функція —
  заглушка, тож його можна знайти, а його викликачі компілюються; потім групи
  переходять до вирішеного статусу.
- **Заповнювачі вбудованих функцій:** функція, яку реалізує вбудована функція
  каталогу, зберігає експорт і тіло `F(_, ...) -> clause_builtin_placeholder.`,
  яке ніколи не виконується: реєстрація прив’язує замість нього вбудовану
  функцію, а кваліфікований виклик `M:F(...)` компілюється в міст. Лише
  некваліфікований виклик усередині модуля досяг би заповнювача, тому модуль
  викликає власні вбудовані функції кваліфіковано; `library_inventory` відхиляє
  заповнювач без відповідної вбудованої функції каталогу, вбудовану функцію
  каталогу, залишену заглушкою `not_implemented`, і некваліфікований виклик
  заповнювача.
- **Відсутні (missing):** Clause взагалі не постачає модуля, можливо, назавжди,
  і записує причину та те, які модулі Clause вищого рівня займають місце його
  викликачів (`library/modules.terms`). Низькорівневі файлові й сокетні шари
  `prim_*` (`prim_file`, `prim_buffer`, `prim_socket`, `prim_net`,
  `prim_inet`, `socket_registry`), а також `socket`, `net` — це відсутні
  модулі: програми натомість використовують `file`, `gen_tcp`, `gen_udp` і
  `inet` з Clause, а оскільки модулі Clause мають перевагу над модулями OTP
  (нижче), викликачі відсутнього модуля з OTP (`gen_tcp_socket`, `inet_tcp`,
  ... з OTP) ніколи не потрапляють у пакет. Відсутній модуль ніколи не
  отримує заглушки, тож посилання на нього — це помилка під час компіляції, а
  не несподіванка під час виконання.

Функції, тривіальні для runtime, реалізуються без окремого рішення.

### До якого модуля розв'язується ім'я

OTP на машині користувача необов'язковий; якщо він є, то не повинен змінювати
того, що компілює збирання. Ім'я модуля розв'язується в такому порядку:

1. **Явні вхідні файли:** вихідні файли, які перелічує користувач (`sources`,
   `source_dirs`, позиційні вхідні файли). Файл з іменем модуля Clause
   замінює його з попередженням, що називає обидва файли.
2. **Модулі Clause:** модулі бібліотеки, включно з наданими замінами.
3. **`source_search_paths`**, як описано в
   [проєктах](projects.md#paths-and-discovery).

Ім'я відсутнього модуля зарезервовано: однойменний файл у шляху пошуку
(наприклад, `erts/preloaded/src/prim_file.erl` з OTP) не використовується, а
діагностика повідомляє, що Clause не надає цього модуля. Явний вхідний файл
усе ж може його надати з попередженням про заміну.

`ignore_modules` діє і на модулі Clause: ігнорований модуль Clause відсутній
у пакеті, і тоді явний вхідний файл може надати його без попередження, бо
нічого не замінюється.

### Файли

- Бібліотечні модулі містяться в `library/<application>/` за назвою застосунку
  OTP, якому належить модуль в OTP: `erts` (аналоги попередньо завантажених
  модулів та `erlang`), `kernel`, `stdlib`. Приватні допоміжні модулі Clause
  (`clause_socket`, `clause_re`, `clause_unicode`, `clause_zlib`,
  `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`) розташовані
  поряд із модулями, які обслуговують. Пошук бібліотеки переглядає кожен каталог
  застосунку; назва модуля існує щонайбільше в одному з них.
- `library/modules.terms` перелічує кожен модуль, щодо якого Clause ухвалює
  рішення: `{Module, Application, provided}.` або
  `{Module, Application, missing, "reason"}.` Компілятор читає його, щоб
  знати, які імена є модулями Clause, а які зарезервовано.
- Кожен наданий модуль має поруч інвентар `<module>.terms`:
  `{Name, Arity, Group, Status}.` для кожного експорту OTP 29, відсортований
  за іменем і арністю, де `Group` називає групу рішення (наприклад, `stdlib`,
  `distribution`, `beam`). `erlang.terms` зберігає власний формат
  (`{Name, Arity, Flags, Status}`, [модуль erlang](builtins.md#erlang-module)).
- Списки експортів спостерігаються з OTP 29 на хості
  (`M:module_info(exports)`); жоден вихідний код OTP не копіюється.
  Результати й терми помилок реалізованих функцій збігаються з OTP 29;
  навмисні відмінності записуються у [відмінності](differences.md).

### Документовані функції

`library/documented.terms` перелічує публічні функції, документовані OTP 29
для `erts`, `kernel` і `stdlib`: `{Module, Application, Name, Arity}.` на
функцію, документація модуля й функції якої не прихована та яка не застаріла.
Дані отримано з блоків документації хостової OTP через
`tests/compiler/library/observe_docs.escript` (запускається явно).
Недокументовані експорти залишаються в переліках, але можуть бути заглушками.

- `library_inventory` перевіряє, що кожна документована функція наданого модуля
  є в його переліку й не є заглушкою, крім модулів, які `library_modules.py`
  позначає як часткові з кроком плану, що їх завершує.
- `python tests/compiler/library/library_modules.py coverage .` виводить
  кількість реалізованих і документованих функцій кожного документованого модуля.

### Типи

Оскільки модулі Clause мають перевагу над модулями OTP, код OTP, що називає
`file:filename()` чи `erlang:time_unit()` у своїх специфікаціях, має знаходити
ці типи в модулях Clause. Кожен наданий модуль, чий відповідник в OTP
експортує типи, підключає `<module>.types.hrl` зі свого каталогу: список
`-export_type`, потім експортовані типи й локальні типи та record, які вони
використовують, так, як їх визначає OTP (документація показує ті самі
визначення; встановлена документація не містить визначень типів, тож вони
беруться з реалізації: налагоджувальної інформації beam або постачуваного
вихідного коду попередньо завантаженого модуля, як-от `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` записує
заголовок з OTP хоста, а `--check` порівнює його форми зі свіжим
спостереженням (CTest `library_freshness`); `library_modules.py check`
вимагає, щоб кожен заголовок підключав його модуль. Типи, які заголовки
називають з модулів поза програмою (`unicode:chardata()`,
`calendar:datetime()`), і широкі об'єднання OTP (`file:posix()` має більше
членів, ніж зберігає граф типів) розв'язуються в `term()` без попередження:
ця діагностика стосується бібліотеки Clause, а не програми користувача.

### Служби kernel під час запуску

`file`, `io`, `code` і `logger` з OTP викликають зареєстровані сервери
(`file_server_2`, `code_server`, сервер io лідера групи, `logger`), які
застосунок `kernel` запускає під час завантаження системи. Виконуваний файл
Clause не запускає жодного з них: власним `file` і `io` з Clause сервер не
потрібен, а модуль OTP, якому він таки потрібен, завершується збоєм так само,
як в OTP без цього сервера (`noproc`). Тому код OTP, що веде журнал через
`logger` або викликає `code` під час виконання, не працює. Завантаження всього
застосунку `kernel` не планується.

### Реєстр

План проєкту охоплює кожен документований модуль `erts`, `kernel` і `stdlib`;
реальні програми (першою luerl) визначають пріоритети. Скомпілювати й запустити
її, класифікувати кожну помилку (`unknown module`, `undefined function M:F/A`,
непідтримуваний синтаксис або можливість, інше) та призначити кожну кроку плану,
іншому пункту черги чи задокументованій відмові. Коли stderr запуску збережено
у файл, `python tests/compiler/library/library_modules.py report FILE`
виводить класифікацію таблицями: кожен невідомий модуль із кількістю помилок,
модулями-викликачами й викликаними функціями з арностями; невизначені функції
за модулями; інші повідомлення з кількостями.

### Інструменти

Усі лежать у `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` записує
  `LIBRARY/APP/MODULE.terms` з `MODULE:module_info(exports)` OTP хоста,
  зберігаючи групу й статус кожного наявного запису; новий експорт
  починається як `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` один раз записує
  файл модуля, де кожен експорт — заглушка; далі файл редагується вручну.
- `python library_modules.py check ROOT` (CTest `library_inventory`, без OTP)
  повідомляє про кожну розбіжність: наданий модуль без своїх файлів,
  відсутній модуль із файлом, інвентар, не позначений як наданий, експорт,
  якого немає в інвентарі, або навпаки, запис `stub`/`declined`, що не є
  заглушкою `not_implemented`, запис `implemented`/`refused` без тіла чи
  вбудованої функції каталогу. `library_rejects` доводить це на навмисно
  неузгодженій бібліотеці-фікстурі.
- CTest `library_freshness` (мітки `host_otp`, `full_only`) повторно
  спостерігає кожен інвентар і вимагає, щоб він не змінився, потім
  спостерігає, генерує, перевіряє й компілює новий модуль від початку до
  кінця. `library_report` запускає `clau` на програмі-фікстурі й перевіряє
  рядки звіту.
