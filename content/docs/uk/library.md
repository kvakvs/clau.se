---
source: docs/library.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: eb1d55d20683cef87e3553554a2b837e023b35acb9de58cdad1cb868ec95d0d8
translatedAt: 2026-10-26
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
| [`lists`](../library/stdlib/lists.erl) | Поширені функції; функції даних, як-от `sublist/2,3`, `flatten/1,2`, `sort/1`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2`, — вбудовані функції runtime; кожну документовану функцію реалізовано ([модуль lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Кожна документована функція; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... — вбудовані функції runtime, функції з fun написано Erlang ([модуль maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Кожна документована функція; обходи списків — вбудовані функції runtime, функції з fun написано Erlang ([колекції](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Кожна документована функція; григоріанська арифметика — вбудовані функції runtime, локальний час і RFC 3339 написано Erlang ([календар](builtins.md#calendar)) |
| [`proc_lib`](../library/stdlib/proc_lib.erl), [`sys`](../library/stdlib/sys.erl) | Кожна документована функція: створення процесів із предками й початковими викликами, синхронні запуски (`init_ack`, `init_fail`), мітки, `stop/1,3`, звіти про збої та їхній текст; протокол системних повідомлень і параметри налагодження (`trace`, `log`, `statistics`, `log_to_file`, встановлені fun) з формами списків налагодження OTP |
| [`gen_server`](../library/stdlib/gen_server.erl), [`gen_statem`](../library/stdlib/gen_statem.erl), [`gen_event`](../library/stdlib/gen_event.erl), [`gen_fsm`](../library/stdlib/gen_fsm.erl), [`gen`](../library/stdlib/gen.erl) | Кожна документована функція на Erlang поверх `proc_lib` і `sys`, з повідомленнями OTP (`'$gen_call'` з тегами псевдонімів, `'$gen_cast'`, ...), результатами й діями зворотних викликів, колекціями ідентифікаторів запитів, термами помилок і текстами звітів; `gen` містить спільну частину |
| [`supervisor`](../library/stdlib/supervisor.erl), [`supervisor_bridge`](../library/stdlib/supervisor_bridge.erl) | Кожна документована функція: специфікації дочірніх процесів і помилки OTP, стратегії, інтенсивність перезапусків, правила завершення, дочірні процеси `simple_one_for_one` й автоматичне завершення, як `gen_server` |
| [`logger`](../library/kernel/logger.erl), [`logger_formatter`](../library/kernel/logger_formatter.erl), [`logger_std_h`](../library/kernel/logger_std_h.erl), [`logger_filters`](../library/kernel/logger_filters.erl), [`logger_handler`](../library/kernel/logger_handler.erl) | Кожна документована функція на Erlang: основна конфігурація, конфігурація обробників і проксі з перевірками й термами помилок OTP, рівні модулів, метадані процесів, фільтри, макроси `?LOG_*` з [`kernel/include/logger.hrl`](../library/kernel/include/logger.hrl), шаблони форматувальника й застарілий заголовок, `logger_std_h` для пристроїв і файлів із ротацією, стисненням і `filesync/1`, `logger_disk_log_h` для дискових журналів halt і wrap (обидва поверх [`clause_logger_h`](../library/kernel/clause_logger_h.erl), спільні параметри й перевірки обробників OTP). Сервер `logger` — це [`clause_logger`](../library/kernel/clause_logger.erl) з Clause, який запускається при першому використанні зі стандартним обробником OTP на `standard_io` (змінна середовища `CLAUSE_LOGGER_TYPE=standard_error` переносить його на стандартний потік помилок, як робить засіб запуску еталонних тестів для відповідності еталонам, створеним з обробником OTP на цьому потоці); рівні застосунків потребують `application` |
| [`disk_log`](../library/kernel/disk_log.erl), [`wrap_log_reader`](../library/kernel/wrap_log_reader.erl), [`clause_disk_log`](../library/kernel/clause_disk_log.erl), [`clause_disk_log_server`](../library/kernel/clause_disk_log_server.erl) | Кожна документована функція на Erlang: журнали halt, wrap і rotate, внутрішні й зовнішні, з форматами файлів OTP (заголовки журналів, кадри елементів із MD5 для великих елементів, файли індексу й розміру wrap, архіви rotate), тож файли побайтово збігаються з OTP; окремий процес для кожного журналу з власниками, користувачами, сповіщеннями, блокуванням із чергою запитів, випереджальним журналюванням, кешем запису зі скиданням за розміром і таймером, відновленням, блоками лише для читання з підрахунком пошкоджених байтів; сервер реєстру `disk_log_server` з іменованими таблицями `disk_log_names` і `disk_log_pids`; `wrap_log_reader` поверх того самого засобу читання блоків |
| [`error_logger`](../library/kernel/error_logger.erl), [`error_logger_file_h`](../library/stdlib/error_logger_file_h.erl), [`log_mf_h`](../library/stdlib/log_mf_h.erl) | Кожна документована функція: повідомлення й звіти як події журналу з метаданими `error_logger` OTP, обробники звітів у менеджері подій `error_logger`, який отримує дані від обробника журналу `error_logger`, `logfile/1` зі старим текстом звітів, файли wrap з індексом і форматом записів OTP |
| [`pg`](../library/kernel/pg.erl), [`data_publisher`](../library/kernel/data_publisher.erl) | Кожна документована функція: області як сервери `data_publisher` з таблицями ETS OTP, приєднання, виходи, учасники, що завершуються, монітори областей і груп; область не має однорангових вузлів |
| [`global`](../library/kernel/global.erl), [`global_group`](../library/kernel/global_group.erl) | Кожна документована функція як на нерозподіленому вузлі: імена (також `{global, Name}` у поведінках), блокування й транзакції поверх `global_name_server`, що запускається при першому використанні; `global_group` без груп; механізм блокування й внутрішні механізми розподілу відхилено |
| [`rpc`](../library/kernel/rpc.erl), [`erpc`](../library/kernel/erpc.erl) | Кожна документована функція: виклики цього вузла виконуються у створених процесах (`rex` запускається при першому використанні) з результатами й помилками OTP; інші вузли недоступні (`{badrpc, nodedown}`, `{erpc, noconnection}`) |
| [`net_adm`](../library/kernel/net_adm.erl), [`net_kernel`](../library/kernel/net_kernel.erl), [`auth`](../library/kernel/auth.erl), [`seq_trace`](../library/kernel/seq_trace.erl) | Відповіді OTP для неактивного вузла (`pang`, `ignored`, `#{started => no}`, `nocookie`); `net_kernel:start/1,2` і внутрішні механізми розподілу відхилено; `seq_trace` зберігає токен кожного процесу без трасування |
| [`trace`](../library/kernel/trace.erl), [`erl_tracer`](../library/erts/erl_tracer.erl) | Трасування не підтримується: кожна функція `trace` і стандартний трасувальник `erl_tracer` (`enabled/3`, `trace/5`) породжують `notsup`, як і функції трасування erlang ([модуль erlang](builtins.md#erlang-module)); `erl_tracer:behaviour_info/1` перелічує зворотні виклики OTP |
| [`error_handler`](../library/kernel/error_handler.erl) | Функції невизначених викликів, які можна викликати безпосередньо; runtime сам породжує `undef` і ніколи їх не викликає; `breakpoint/3` відхилено (немає інтерпретатора) |
| [`timer`](../library/stdlib/timer.erl) | Кожна документована функція без сервера таймерів OTP: відкладені надсилання локальним pid — це `erlang:send_after/3`, кожен інший таймер — окремий процес, доступний через псевдонім у його `TRef`; перетворення й `now_diff/2` — вбудовані функції runtime ([таймер](builtins.md#timer)) |
| [`filelib`](../library/stdlib/filelib.erl), [`clause_filelib`](../library/stdlib/clause_filelib.erl) | Кожна документована функція: шаблони імен компілюються й зіставляються вбудованими функціями runtime за правилами, особливостями й помилками OTP, обхід каталогів, запити, `ensure_dir/1`, `ensure_path/1`, `fold_files/5,6`, `find_file/2,3`, `find_source/1,2,3` (`source_search_rules` з kernel або стандартні правила OTP) і `safe_relative_path/2` на Erlang; також недокументовані форми, що приймають модуль (`file`, `erl_prim_loader` чи інший), `compile_wildcard/1` (допоміжний засіб налагодження OTP) — заглушка ([filelib](builtins.md#filelib)) |
| [`file_sorter`](../library/stdlib/file_sorter.erl) | Кожна документована функція на Erlang: серії OTP (`size` байтів, відсортованих у пам'яті), злиття (по `no_files` тимчасових файлів, блоки 16 KiB, потоки впорядковано за їхніми буферизованими об'єктами й номерами файлів) і перевірки відтворено крок за кроком, тож терми, які порівнюються як рівні, виводяться й зберігаються після `unique` як в OTP; формати `binary_term`, `binary`, `term` і fun, `header`, `compressed` (через шар gzip модуля `file`), `tmpdir`, вхідні й вихідні fun, терми помилок OTP |
| [`zip`](../library/stdlib/zip.erl) | Кожна документована функція на Erlang із побайтовим відтворенням структури архівів OTP (локальні й центральні заголовки, створені UNIX 6.1, додаткові поля розширених часових позначок і UNIX uid/gid, zip64 понад 4 GiB, блоки deflate по 8 KiB з повними скиданнями через `zlib`), тож архіви збігаються з OTP; файли або binary на вході й виході через вхідні й вихідні fun OTP, фільтри, `cwd`, `keep_old_files`, `skip_directories`, `foldl/3`, архіви `zip_open/1,2`, які обслуговує зв'язаний процес, `t/1`, `tt/1`, терми помилок OTP; record з [`stdlib/include/zip.hrl`](../library/stdlib/include/zip.hrl) |
| [`erl_tar`](../library/stdlib/erl_tar.erl) | Кожна документована функція на Erlang із побайтовим відтворенням правил формату OTP: заголовки USTAR, довгі імена розділяються з виділенням префікса або переносяться в розширені заголовки pax (як і довгі чи не-ASCII імена, посилання та імена власників і числа, що не вміщуються у вісімковий формат), читання архівів v7, GNU (довгі імена й посилання, розріджені файли), STAR, USTAR і pax з особливостями OTP (поля з основою 256, час pax), `compressed` через шар gzip модуля `file`, binary читаються як файли `ram`, пристрої, користувацькі fun I/O `init/3`, `max_size`, `keep_old_files`, `files`, `cwd`, `verbose`, перевірки небезпечних шляхів, терми помилок OTP і `format_error/1` |
| [`zstd`](../library/stdlib/zstd.erl), [`clause_zstd`](../library/stdlib/clause_zstd.erl) | Кожна документована функція: одноразове й потокове стиснення та розпакування, параметри, словники (сирі чи за посиланням), заголовки кадрів та ідентифікатори словників, на Erlang поверх вбудованих функцій runtime, які зберігають контексти libzstd 1.5.7, як NIF в OTP ([zstd](builtins.md#zstd-module)); `file:open/2` приймає `{zstd, Options}` |
| [`beam_lib`](../library/stdlib/beam_lib.erl), [`erl_abstract_code`](../library/stdlib/erl_abstract_code.erl) | Кожна документована функція на Erlang з обробкою блоків як в OTP: обхід IFF з помилками OTP, таблиці атомів в обох кодуваннях, таблиці символів, атрибути, інформація про компіляцію, літерали, налагоджувальна інформація й абстрактний код через бекенд `erl_abstract_code`, документація (record з [`kernel/include/eep48.hrl`](../library/kernel/include/eep48.hrl)), MD5 значущих блоків, порівняння й очищення файлів, каталогів і випусків, beam зі стисненням gzip, `build_module/1` і сервер криптографічних ключів із розшифруванням налагоджувальної інформації (через `crypto`, що викликається динамічно: скомпонуйте його з `--with-crypto`) |
| [`io_ansi`](../library/stdlib/io_ansi.erl) | Кожна документована функція на Erlang: послідовності віртуального термінала OTP 29 як вбудовані послідовності ANSI, які OTP використовує без terminfo (запити terminfo відповідають `{error, enotsup}`), `format/1,2,3` і `render/1,2` поверх `io_lib`, `fwrite/1,2,3,4` як запити `put_ansi`, які відтворює сервер стандартного вводу, `scan/1` і `enabled/0,1` з ознаки термінала пристрою ([модуль io](builtins.md#io-module)) |
| [`win32reg`](../library/stdlib/win32reg.erl) | Кожна документована функція: розбір ключів OTP (корені, абсолютні, відносні шляхи й `..`), поточний ключ, цілі, рядкові й binary значення, переліки й видалення поверх драйвера реєстру Windows ([реєстр](ports.md#the-registry)); на інших платформах `{error, enotsup}`, як в OTP |
| [`argparse`](../library/stdlib/argparse.erl), [`clause_argparse`](../library/stdlib/clause_argparse.erl) | Кожна функція: валідація з помилками OTP, розбір (параметри, прапорці, `nargs`, дії, типи з варіантами вибору, обмеженнями й регулярними виразами, власні типи, підкоманди, префікси, типові значення) з map аргументів і помилками OTP, `help/1,2` з оформленням і шаблонами OTP, `run/3` з усіма формами обробників, як вбудовані функції runtime, що просять Erlang викликати fun ([argparse](builtins.md#argparse)); без `progname` — власне ім'я програми |
| [`escript`](../library/stdlib/escript.erl) | `create/2` і `extract/2` зі структурою секцій і читанням заголовків як в OTP (shebang, коментар і рядки аргументів емулятора; тіла з вихідним кодом, beam і архівами через `zip`); `script_name/0` — шлях виконуваного файлу; виконання escript (`start/0,1`, `parse_file/1`) відхилено |
| [`filename`](../library/stdlib/filename.erl) | Кожна документована функція за правилами Unix і Windows OTP для хоста; обходи імен — вбудовані функції runtime, `absname/1,2` і `basedir/2,3` (з `HOME`, змінних XDG і `APPDATA`) написано Erlang ([імена файлів](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Кожна документована функція — вбудована функція runtime: розбір RFC 3986 з фрагментами помилок OTP, повторне складання, нормалізація, розв’язання, відсоткове кодування й запити form-urlencoded ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Кожна документована функція з iodata, помилками й порядком зворотних викликів OTP; `decode/1`, `encode/1`, `format/1,2` і екранування binary — вбудовані функції runtime, кодувальники й форматувальники з fun та декодувальники зі зворотними викликами написано Erlang ([кодування](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Кожна документована функція зі станами й послідовностями OTP; алгоритми OTP виконуються як вбудовані функції runtime, під’єднувані генератори — в Erlang ([випадкові числа](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Кожна документована функція — вбудована функція runtime, що обходить chardata як `string.erl` OTP, зберігаючи форми результатів OTP ([рядки](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Кожна документована функція — вбудована функція runtime ([кодування](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Кожна документована функція над record OTP 29; операції з record — вбудовані функції runtime, згортки й mapfold написано Erlang ([колекції](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Кожна документована функція над формами дерев і черг OTP; операції без fun — вбудовані функції runtime ([колекції](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Кожна документована функція над record OTP (множини версії 1) і map (версія 2); операції без fun — вбудовані функції runtime ([колекції](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (сервер стандартного вводу або відкритий файл), `fread/2,3` (запит `get_until` поверх `io_lib:fread/3`), `read/1..4`, `scan_erl_exprs/1..4`, `scan_erl_form/1..4`, `parse_erl_exprs/1..4`, `parse_erl_form/1..4` (запити `get_until` поверх `erl_scan:tokens/3,4`, розібрані `erl_parse`), `request/1,2`, `requests/1,2` (протокол вводу-виводу OTP, [файли](ports.md#standard-io-and-files)), `getopts/0,1`, `setopts/1,2`, `columns/0,1`, `rows/0,1` (розмір термінала через вбудовані функції `clause_io`), `get_password/0,1`, `write/1,2`; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` і `nl/0,1` є вбудованими функціями runtime ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Функції виведення, перевірки, збирання даних, рушій форматування, форматувальник (`print/1,4`, `~p`, `chars_limit`) і сканер (`fread/2,3`) — вбудовані функції runtime з формами глибоких списків OTP, fun `maps_order` сортують ключі в `clause_io_lib`; `get_until`, `format_prompt` і `write/3` написано Erlang ([io_lib](builtins.md#io_lib)) |
| [`sofs`](../library/stdlib/sofs.erl), [`clause_sofs`](../library/stdlib/clause_sofs.erl) | Кожна функція; операції з даними — вбудовані функції runtime, функції, що приймають fun, і перетворення digraph написано Erlang ([множини множин](builtins.md#sets-of-sets)) |
| [`ets`](../library/stdlib/ets.erl) | Таблиці, читання, запис, обходи й оновлення як вбудовані функції runtime поверх таблиць runtime; `foldl/3`, `foldr/3`, `i/0..3` і `fun2ms/1` написано Erlang; специфікації зіставлення (сімейства select, match, match_spec) як вбудовані функції поверх інтерпретатора runtime, `match_spec_run/2`, `test_ms/2`, `repair_continuation/2`, `match_delete/2` і `init_table/2` написано Erlang; файли таблиць (`tab2file/2,3`, `file2tab/1,2`, `tabfile_info/1`) на Erlang поверх `file` і `clause_disk_log`; `to_dets/2` і `from_dets/2` на Erlang поверх `dets`; `table/1,2` на Erlang поверх `qlc:table/2` ([ets](builtins.md#ets)) |
| [`graph`](../library/stdlib/graph.erl) | Кожна функція над record OTP; запити й обходи — вбудовані функції runtime, оновлення написано Erlang ([graph](builtins.md#graph)) |
| [`digraph`](../library/stdlib/digraph.erl), [`digraph_utils`](../library/stdlib/digraph_utils.erl) | Кожна функція над record OTP із трьома таблицями; оновлення й читання на Erlang поверх `ets`, пошуки шляхів і обходи digraph_utils — вбудовані функції runtime, що читають таблиці, `subgraph/2,3` і `condensation/1` написано Erlang ([digraph](builtins.md#digraph)) |
| [`dets`](../library/stdlib/dets.erl), [`clause_dets`](../library/stdlib/clause_dets.erl) | Кожна документована функція: серверні й табличні процеси OTP на Erlang поверх рушія C++ для формату файлів OTP версії 9, файли побайтово збігаються з записаними OTP; `table/1,2` на Erlang поверх `qlc:table/2` ([dets](builtins.md#dets)) |
| [`ms_transform`](../library/stdlib/ms_transform.erl) | Кожна функція на Erlang поверх абстрактного формату: `parse_transform/2` перетворює літеральні fun, передані `ets:fun2ms/1` і `dbg:fun2ms/1` у формах модуля, `transform_from_shell/3` — гілки fun оболонки, зі специфікаціями зіставлення, попередженнями про затінення й кодами помилок OTP. Модуль, що використовує перетворення під час компіляції, як і раніше запускає `ms_transform` OTP хоста ([перетворення розбору](transforms.md)) |
| [`qlc_pt`](../library/stdlib/qlc_pt.erl), [`clause_qlc_pt`](../library/stdlib/clause_qlc_pt.erl) | Перетворення розбору qlc під час виконання (недокументоване в OTP): `transform_expression/2`, `transform_from_evaluator/2` і `parse_transform/2` як вбудовані функції runtime зі згенерованим кодом запитів, повідомленнями й анотаціями OTP; `ms_transform` виконується на Erlang за запитом ([qlc_pt](builtins.md#qlc-pt)). Скомпільовані модулі, що підключають `qlc.hrl`, як і раніше використовують перетворення OTP хоста ([перетворення розбору](transforms.md)) |
| [`qlc`](../library/stdlib/qlc.erl) | Кожна функція на Erlang, написана за документацією OTP: дескриптори скомпільованих запитів (дескриптори `qlc_lc` OTP з перетворення), списків, таблиць `table/2`, `append/1,2`, `sort/1,2` і `keysort/2,3`; обчислення з пошуком констант, специфікаціями зіставлення, з'єднаннями злиттям і пошуком, `cache` (`ets`, `list` зі скиданням у тимчасові файли), `unique`, сортуванням `file_sorter`, курсорами як процесами, `info/1,2` поверх `erl_pp`, `string_to_handle/1,2,3` поверх `qlc_pt`, термами помилок OTP і `format_error/1`. Дескриптори, таблиці, ключі словника процесу й імена тимчасових файлів — як в OTP. [`stdlib/include/qlc.hrl`](../library/stdlib/include/qlc.hrl) задає перетворення `qlc`, яке виконується на OTP хоста ([qlc](builtins.md#qlc)) |
| [`shell`](../library/stdlib/shell.erl), [`clause_shell`](../library/stdlib/clause_shell.erl), [`clause_shell_eval`](../library/stdlib/clause_shell_eval.erl), [`clause_shell_commands`](../library/stdlib/clause_shell_commands.erl), [`clause_shell_records`](../library/stdlib/clause_shell_records.erl) | Кожна документована функція на Erlang, написана за документацією OTP: інтерактивна оболонка на стандартному вводі ([інтерактивна оболонка](#interactive-shell)): запрошення, банер, історія (`e/1`, `v/1`, `h/0`), прив'язки, record (`rd`, `rr`, `rl`, `rp`, `rf`) OTP, функції, типи й специфікації, визначені в оболонці, звіти про винятки через `erl_error`, результати виводяться як в OTP (глибина 30, record), обмежені оболонки, `catch_exception/1` і функції налаштувань |
| [`shell_default`](../library/stdlib/shell_default.erl), [`c`](../library/stdlib/c.erl) | Кожна функція: команди `c` з виводом OTP (`i/0`, `regs/0`, `m/0,1`, `ls/0,1`, `flush/0`, `help/0`, ...); компіляція (`c/1,2,3`, `lc/1`, `nc/1,2`), `xm/1` і `y/1,2` повідомляють про невдалий виклик як OTP без compiler, tools чи parsetools; `h/1,2,3` не знаходять документації у скомпонованому коді; команди налагоджувача `i` повідомляють про відсутній застосунок |
| [`edlin`](../library/stdlib/edlin.erl), [`edlin_expand`](../library/stdlib/edlin_expand.erl) | `edlin:keymap/0` (розкладка клавіш редактора рядка, що викликає функцію; `undefined` поза ним); `edlin_expand:expand/1,2` на Erlang: доповнення модулів, функцій (арності `Mod:`, `fun Mod:Fun/`), BIF, команд оболонки, визначених в оболонці функцій, ключових слів, прив'язок, імен і полів record, ключів map і шляхів файлів, із секціями й застарілими збігами OTP; аргументи виклику пропонуються як заголовки `Mod:Fun/Arity` (скомпонований код не має специфікацій) |
| [`shell_docs`](../library/stdlib/shell_docs.erl), [`clause_shell_docs_markdown`](../library/stdlib/clause_shell_docs_markdown.erl) | Кожна функція на Erlang, написана за документацією OTP: `render/2..5`, `render_type/2..5` і `render_callback/2..5` для заданого блока `docs_v1` (`application/erlang+html`, `text/markdown` перетворюється як в оболонці OTP, інші формати `text/` — без змін) з оформленням, перенесенням рядків, маркерами списків і стилями ANSI OTP, `normalize/1`, `validate/1`, `supported_tags/0`; ідентично OTP на 51,249 відтвореннях власних блоків документації OTP 29. Скомпонований код не має власних блоків (`code:get_doc/1`) |
| [`erl_parse`](../library/stdlib/erl_parse.erl), [`clause_erl_parse`](../library/stdlib/clause_erl_parse.erl) | Кожна функція: `parse_form/1`, `parse_exprs/1`, `parse_term/1` і `parse/1`, `parse_and_scan/1` yecc поверх парсера runtime з абстрактним форматом і помилками OTP; `normalise/1`, `abstract/1,2`, `tokens/1,2` і таблиці пріоритетів — вбудовані функції; обходи анотацій і `format_error/1` написано Erlang ([erl_parse](builtins.md#erl-parse)) |
| [`erl_eval`](../library/stdlib/erl_eval.erl), [`clause_erl_eval`](../library/stdlib/clause_erl_eval.erl) | Кожна функція на Erlang поверх абстрактного формату: прив'язки як orddict або map, обробники локальних і нелокальних функцій (оператори, BIF і помилки як виклики `erlang:raise/3` проходять через останні), інтерпретовані fun з оточенням OTP, comprehension зі строгими й zip-генераторами, `maybe`, native record, `receive` поверх `prim_eval`; зіставлення зі зразком, сегменти бітового синтаксису й згортання констант — вбудовані функції runtime ([erl_eval](builtins.md#erl-eval)). `exprs/2` і `expr/2` перевіряють команду через `erl_lint:exprs_opt/3`; `qlc:q/1,2` для запиту у вигляді list comprehension проходить через `qlc:transform_from_evaluator/2` із прихованими локальними викликами, як в OTP |
| [`erl_error`](../library/stdlib/erl_error.erl) | Кожна функція на Erlang поверх `io_lib`: `format_exception/3,4` і внутрішні форматувальники (`format_exception/6,7,8`, `format_stacktrace/4,5`, `format_call/4,5`, `format_fun/1,2`) з поясненнями, оформленням, зворотними викликами `error_info` й параметрами OTP. Власні трасування стека Clause не містять розташувань чи `error_info` ([відмінності](differences.md#errors-stack-traces-and-reports)), тож їхні звіти не показують ні того, ні іншого |
| [`erl_pp`](../library/stdlib/erl_pp.erl), [`clause_erl_pp`](../library/stdlib/clause_erl_pp.erl) | Кожна функція; друк — вбудована функція runtime ([erl_pp](builtins.md#erl-pp)): форми, атрибути, типи й специфікації, функції, guard і вирази з оформленням (ширина рядка, відступи, частини рядків, дужки пріоритетів) і параметрами OTP; обробники-перехоплювачі та `legalize_vars/1` виконуються тут; ідентично OTP на формах 347 вихідних файлів і тестових наборів OTP, а також на 80 із них з п'ятьма наборами параметрів, включно з перехоплювачами |
| [`erl_lint`](../library/stdlib/erl_lint.erl), [`clause_erl_lint`](../library/stdlib/clause_erl_lint.erl) | Кожна функція; перевірки — вбудовані функції runtime ([erl_lint](builtins.md#erl-lint)) з помилками, попередженнями, параметрами, порядком і текстами `format_error/1` OTP; `behaviour_info/1` поведінок викликається тут, а `is_guard_test/3` спочатку запитує свій fun про локальні виклики; ідентично OTP на 481 вихідному файлі й тестовому наборі OTP, 474 фрагментах наборів і 816 командних виразах |
| [`erl_expand_records`](../library/stdlib/erl_expand_records.erl) | `module/2` — вбудована функція runtime ([erl_expand_records](builtins.md#erl-expand-records)): record на основі кортежів розгортаються в операції з кортежами, native record та імпортовані native record зберігаються, виклики імпортів і BIF отримують свій модуль, перевірки guard `is_record/3` перетворюються на зразки, з параметрами `dialyzer`, `expand_inits` і `[no_]strict_record_tests`; ідентично OTP на формах 347 вихідних файлів і тестових наборів OTP |
| [`epp`](../library/stdlib/epp.erl), [`clause_epp`](../library/stdlib/clause_epp.erl) | Кожна функція на Erlang, крім умов `-if`, які обчислює вбудована функція ([epp](builtins.md#epp)): окремий сервер для кожного відкритого вихідного файлу з формами, макросами (аргументи, перевантаження, `??Arg`, `?FUNCTION_NAME`, попередньо визначені й задані параметром `macros`), включеннями, умовними директивами, `-file`, `-feature`, `-error`/`-warning`, файлами документації й помилками OTP; файли читаються цілком і декодуються за коментарем кодування. Ідентично OTP на 1,110 викликах `parse_file`/`scan_file` для вихідних файлів і наборів OTP. `-include_lib` знаходить заголовки лише через шлях включення до появи `code:lib_dir/1` |
| [`erl_scan`](../library/stdlib/erl_scan.erl) | Кожна функція: `string/1,2,3` і реентерабельні `tokens/3,4` поверх сканера runtime з токенами, анотаціями, параметрами, зворотними викликами й помилками OTP; функції доступу й `format_error/1` написано Erlang ([erl_scan](builtins.md#erl-scan)) |
| [`erl_internal`](../library/stdlib/erl_internal.erl), [`erl_anno`](../library/stdlib/erl_anno.erl) | Кожна функція як вбудована функція runtime: таблиці BIF, guard, перевірок типів і операторів OTP, попередньо визначені функції та анотації ([таблиці компілятора](builtins.md#compiler-tables)) |
| [`records`](../library/stdlib/records.erl), [`erl_features`](../library/stdlib/erl_features.erl) | Рефлексія native record, визначення під час виконання й скомпільовані визначення зі згорнутими типовими значеннями ([native record](native-records.md#reflection)); можливості OTP 29 і ті, з якими скомпільовано кожен модуль ([таблиці компілятора](builtins.md#compiler-tables)) |
| [`binary`](../library/stdlib/binary.erl) | Кожна функція; `replace/3,4` і `list_to_bin/1` на Erlang, інші — вбудовані функції runtime ([модуль binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Кожна функція як вбудована функція runtime ([модуль math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Кожна функція — вбудована функція runtime: перетворення, `bin_is_7bit/1`, позначки порядку байтів, форми нормалізації, категорії й властивості ідентифікаторів ([модуль unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Кожна функція над згенерованими таблицями, обходи chardata — вбудовані функції runtime ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Кожна функція, крім `import/1`, поверх PCRE2 ([модуль re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Кожна документована функція: відкриття, читання, запис, позиціювання й закриття файлів (на диску, `compressed` або в пам'яті з `ram`), позиційне читання й запис, `truncate/1`, `advise/4`, `allocate/3`, читання й запис цілих файлів, `consult/1`, `eval/1,2`, `script/1,2` та їхні форми `path_` з `path_open/3` (файл читається цілком і декодується за коментарем кодування, типово UTF-8, як робить `epp:set_encoding/1` у [`clause_epp`](../library/stdlib/clause_epp.erl), а потім сканується форма за формою з результатами й помилками OTP), інформація про файли та її зміни (`write_file_info/2,3`, `change_*`), операції з каталогами поверх файлового драйвера, `sendfile/2,5` як резервний поблоковий варіант OTP і `format_error/1` ([файли](ports.md#standard-io-and-files)) |
| [`erl_posix_msg`](../library/stdlib/erl_posix_msg.erl) | Внутрішній модуль OTP для `file:format_error/1`: `message/1` як вбудована функція runtime ([повідомлення POSIX](builtins.md#posix-messages)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl), [`clause_socket`](../library/kernel/clause_socket.erl), [`clause_socket_options`](../library/kernel/clause_socket_options.erl) | Сокети поверх портів-сокетів, з їхніми параметрами, статистикою, станом і переліками ([сокети](ports.md#sockets)); `inet:get_rc/0` з `clause_inet_config` |
| [`socket`](../library/kernel/socket.erl) | Кожна документована функція на Erlang поверх портів драйвера сокетів ([сокети](ports.md#sockets)): дескриптори `{'$socket', Ref}`, що зберігаються процесом і таблицею `clause_socket_registry` (власники, стани, лічильники, метадані, монітори, переліки), open/bind/listen/accept/connect, send/sendto/sendmsg/sendv/sendfile/sendmmsg, recv/recvfrom/recvmsg/recvmmsg з помилками часткових даних OTP, `nowait` як повідомлення про завершення у Windows і повідомлення select на інших платформах, `cancel/2`, імена параметрів і помилки некоректних значень OTP, `info/0,1`, `i/0,1,2`, `supports/0,1,2`; виклики SCTP породжують `notsup`, а запити інтерфейсів відхиляються, як в OTP на Windows |
| [`gen_sctp`](../library/kernel/gen_sctp.erl) | Кожна документована функція: SCTP немає, тож `open/0,1,2` відповідають `{error, eprotonosupport}` після перевірок параметрів OTP, а інші бачать закритий або чужий сокет; `error_string/1` містить тексти OTP |
| [`inet_res`](../library/kernel/inet_res.erl), [`clause_inet_config`](../library/kernel/clause_inet_config.erl) | Кожна документована функція на Erlang: клієнт DNS OTP поверх `gen_udp` і `gen_tcp` (повторні спроби, альтернативні сервери імен, EDNS, перехід на TCP при обрізанні, очікування servfail, помилки OTP, списки пошуку, ланцюжки CNAME і hostent) з повідомленнями, які кодує й декодує кодек DNS `clause_net` ([мережеві імена](builtins.md#network-names)); конфігурація розв'язувача як її завантажує OTP на нерозподіленому вузлі (відсутня у Windows; `resolv.conf` і файл hosts на інших платформах) |
| [`net`](../library/kernel/net.erl), [`clause_net`](../library/kernel/clause_net.erl) | Кожна документована функція: пошук хостів, адрес і служб та списки інтерфейсів як вбудовані функції runtime з результатами prim_net, фільтри написано Erlang; без мережевих просторів імен ([мережеві імена](builtins.md#network-names)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Власний модуль Clause: протокол драйвера сокетів, спільний для трьох модулів вище |
| [`os`](../library/kernel/os.erl) | `cmd/1,2` через порт із протоколом оболонки OTP, `max_size` і `exception_on_failure`; запити про оточення, час і версію, `find_executable/1,2` і `set_signal/2` як вбудовані функції ([модуль os](builtins.md#os-module)) |
| [`code`](../library/kernel/code.erl) | Запити про завантажені модулі без сервера коду; шлях коду в постійному термі зі змінами шляхів OTP, пошуки `lib_dir`/`priv_dir`, `where_is_file/1`, `all_available/0`, `clash/0`; відповіді щодо завантаження для скомпонованого коду ([модуль code](builtins.md#code-module)) |
| [`application`](../library/kernel/application.erl), [`application_controller`](../library/kernel/application_controller.erl) | Кожна документована функція: завантаження, ключі, оточення, запуски із залежностями й фазами запуску, зупинки, дозволи й типи перезапуску з помилками й звітами OTP, поверх контролера, який запускається при першому використанні, і [`clause_application_master`](../library/kernel/clause_application_master.erl) ([застосунки](#applications)); обробку випусків, завантаження системи й розподілене керування відхилено |
| [`erlang`](../library/erts/erlang.erl) | Згенеровані заглушки кожного експорту `erlang` OTP 29; вбудовані функції каталогу мають тіла-заповнювачі, `nif_error/1,2` мають тіла, інші піднімають `{not_implemented, F, A}` під час виклику ([модуль erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Відповіді запущеної системи; `boot/1`, `restart/0,1` і `make_permanent/2` відхилено ([модуль init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Кожна функція як вбудована функція runtime ([постійні терми](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Кожна функція ([atomics і counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Те, що викликають `stdlib` і `kernel`; групи дистрибуції, `.beam`, емулятора й процесу purger — declined ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Файлові запити поверх `file`; завантаження й архіви — declined ([файли](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Кожна функція поверх зафіксованого zlib ([модуль zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` поверх кроків скомпільованого receive ([prim eval](builtins.md#prim-eval)) |
| Модулі ASN.1 `public_key` (`'OTP-PKIX'`, `'PKIX1Explicit-2009'`, ...) і [`public_key.hrl`](../library/public_key/include/public_key.hrl) | Генеруються під час збирання з [`library/public_key/asn1/`](../library/public_key/asn1) у `library-asn1/public_key/` дерева збірки ([public_key](public_key.md)) |
| [`public_key`](../library/public_key/public_key.erl), [`clause_public_key_codec`](../library/public_key/clause_public_key_codec.erl), [`clause_public_key_keys`](../library/public_key/clause_public_key_keys.erl), [`clause_public_key`](../library/public_key/clause_public_key.erl) | Застосунок `public_key` (з [`public_key.app`](../library/public_key/public_key.app)): кодування DER і PEM, шифрування PEM, закриті ключі PKCS #8 усіх типів і сертифікати у формах plain та otp поверх згенерованих модулів ([public_key](public_key.md#functions), [відкритий ключ](builtins.md#public-key)); ключі, підписи, шифрування RSA, генерація й узгодження ключів, підписування сертифікатів через `crypto` (`clause_public_key_keys`, [ключі](public_key.md#keys-and-signatures)); функції валідації — заглушки |
| [`clause_asn1`](../library/asn1/clause_asn1.erl) | Кодек, який викликають модулі, згенеровані clau зі специфікацій ASN.1 ([кодек ASN.1](builtins.md#asn1-codec), [ASN.1](asn1.md)); застосунок `asn1` OTP (`asn1ct`, `asn1rt_nif`) не надається |
| [`crypto`](../library/crypto/crypto.erl), [`clause_crypto`](../library/crypto/clause_crypto.erl) | Застосунок `crypto` (з [`crypto.app`](../library/crypto/crypto.app)), поверх libcrypto OpenSSL в архіві криптографічного runtime ([модуль crypto](builtins.md#crypto-module), [OpenSSL](crypto.md)): списки алгоритмів скомпонованого OpenSSL (`supports/0,1`, `hash_info/1`, `info/0`, `info_lib/0`), дайджести й стани хешування, HMAC/CMAC/Poly1305 і стани MAC, `pbkdf2_hmac/5`, `hash_equals/2`, `exor/2`, `mod_pow/3`, шифри та їхні стани (`crypto_init/3,4`, `crypto_update/2`, `crypto_final/1`, `crypto_get_data/1`, `crypto_one_time/4,5`, `cipher_info/1`), AEAD (`crypto_one_time_aead/4,6,7`, `crypto_one_time_aead_init/4`), криптографічно стійкі випадкові числа й модулі `crypto`, `crypto_cache`, `crypto_aes` і `crypto_prng1` для `rand`, терми помилок OTP; рушії відхилено (`notsup`); режим FIPS перемикається як в OTP або фіксується через `clau --fips`; відкриті ключі (`sign/4,5`, `verify/5,6`, шифрування RSA, `generate_key/2,3`, `compute_key/4`, `privkey_to_pubkey/2`: RSA, DSA, DH, ECDSA/ECDH на іменованих і явно заданих кривих, EdDSA, X25519/X448, ML-DSA, SLH-DSA, SRP), `ec_curve/1` і `ec_curves/0` (явні параметри зі скомпонованої libcrypto), ML-KEM (`encapsulate_key/2`, `decapsulate_key/3`) |

Результати й причини помилок збігаються з OTP 29, включно з формою помилок
реалізацій OTP на Erlang (`lists:map(F, x)` дає `{case_clause, x}`,
`lists:nth(0, L)` — `function_clause`, `lists:seq(1, 10, 0)` — `badarg`) і
його BIF (`lists:member/2`, `lists:keyfind/3`, `lists:reverse/2`, функції
`maps`: `badarg`, `{badmap, M}`, `{badkey, K}`). `lists:member/2` порівнює
через `=:=`, `lists:keyfind/3` — через `==`. `lists:sort/1` — це стабільна
вбудована функція runtime ([порівняння й порядок](terms.md#comparison-and-order)).
Трасування стека називають функції бібліотеки, а не OTP.

## Інтерактивна оболонка

`shell:start_interactive/0,1` запускає оболонку Erlang на стандартних потоках,
а `clau --shell` компонує її у виконуваний файл, точкою входу якого вона є,
якщо `--entry` не задає іншу ([компіляція](compile.md#options)). Процес
`clause_shell` займає місце `user_drv` OTP: виводить версію системи, запускає
сервер `shell` і запускає новий, коли оболонка завершується (`exit().`).
Сервер читає кожну команду через сервер стандартного вводу `io`, повторюючи
запрошення для кожного наступного рядка команди, зберігає історію й запускає
обчислювач, який перевіряє кожен вираз через `erl_lint`, розгортає record та
обчислює його через `erl_eval`. Результати виводяться з record оболонки через
форматувальник runtime (`clause_io_lib:pretty/2`,
[io_lib](builtins.md#io-lib)). Кінець вводу завершує програму з кодом 0 після
`*** Terminating erlang (nonode@nohost)`.

Команди викликають модулі за іменем, тож програмі, що запускає оболонку,
потрібна можливість викликати кожен експорт: `--shell` зберігає їх
([живість експортів](executables.md#export-liveness)) і компонує кожен модуль
бібліотеки; програма, зібрана без нього, досягає лише названих нею модулів.
Рядки вводу читаються в міру надходження з термінала й редагуються самим
терміналом: редагування рядків `edlin`, клавіш історії чи доповнення Tab немає
([відмінності](differences.md#interactive-shell)).

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
  `kernel`, `stdlib`), а потім `library-asn1/` дерева збірки — модулі, які
  збирання генерує зі специфікацій ASN.1 бібліотеки
  ([public_key](public_key.md)). `-include_lib("kernel/include/logger.hrl")`,
  `file.hrl`, `eep48.hrl` і `inet.hrl` (`#hostent{}`) розв'язуються у власні
  заголовки бібліотеки, якщо проєкт не задає застосунок `kernel`;
  `stdlib/include/` `zip.hrl`, `qlc.hrl`, `ms_transform.hrl` (задає
  перетворення, яке виконується на OTP хоста:
  [перетворення](transforms.md)) і `assert.hrl` — якщо він не задає
  застосунок `stdlib`. `assert.hrl` містить макроси, терми помилок і
  перемикачі `NOASSERT`, `NODEBUG`, `ASSERT` OTP. Внутрішні заголовки OTP
  (`erl_bits.hrl`, `erl_compile.hrl`) і заголовки розподілу (`dist.hrl`,
  `dist_util.hrl`, `net_address.hrl`) не надаються, як і `inet_sctp.hrl`
  (немає SCTP).
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
  `prim_inet`, `socket_registry`), а також `socket` — це відсутні
  модулі: програми натомість використовують `file`, `gen_tcp`, `gen_udp`,
  `inet` і `net` з Clause, а оскільки модулі Clause мають перевагу над модулями OTP
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
  `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`,
  `clause_features`, `clause_io_lib`, `clause_disk_log`, `clause_dets`) розташовані
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
для `erts`, `kernel`, `stdlib`, `crypto` і `public_key`:
`{Module, Application, Name, Arity}.` на
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

`file`, `io` і `code` з OTP викликають зареєстровані сервери
(`file_server_2`, `code_server`, сервер io лідера групи), які застосунок
`kernel` запускає під час завантаження системи. Виконуваний файл Clause не
запускає жодного з них: власним `file` і `io` з Clause сервер не потрібен,
`logger` з Clause запускає свій сервер при першому використанні, а модуль
OTP, якому сервер таки потрібен, завершується збоєм так само, як в OTP без
цього сервера (`noproc`). Тому код OTP, що викликає `code` під час виконання,
не працює. Завантаження всього застосунку `kernel` не планується.

### Застосунки

- Специфікації беруться з програми, а не зі шляху коду: clau компілює кожен
  `*.app` і `*.app.src` поряд із вихідними файлами пакета, кожен `*.app` у
  каталозі `ebin` поряд із ними та `ebin/Name.app` або `src/Name.app.src`
  кожного запису `[targets.options.applications]` у згенерований модуль
  `clause_applications`, який додається щоразу, коли пакет містить
  `application_controller`. Перший файл з іменем застосунку має перевагу.
  Ресурс, який не перелічує модулів, отримує модулі пакета поряд із ним.
  Діагностика вказує на місця у файлі ресурсу.
- `application:load/1` також приймає терми `{application, Name, Keys}`. Ім'я
  без ресурсу дає `{error, {"no such file or directory", "Name.app"}}`, як
  відповідає OTP для відсутнього файлу.
- `kernel` (11.0.4) і `stdlib` (8.1) завантажені й працюють від початку, як
  їх перелічує OTP 29.1.1, без головних процесів застосунків; `kernel` має
  стандартне оточення зі свого `kernel.app`.
- Застосунок зі стартовим модулем отримує головний процес, який очолює групу
  його процесів (тож `get_application/0`, `get_env/1` і `start_type/0`
  відповідають усередині неї), пересилає їхні запити I/O до стандартного I/O,
  а при зупинці виконує `prep_stop/1`, завершує верхній процес, виконує
  `stop/1` і знищує решту групи. Постійний застосунок, що завершується, або
  перехідний застосунок, що завершується аварійно, зупиняє програму з
  повідомленням OTP і кодом виходу 1.
- `logger` і `clause_logger` звертаються до `application` за іменем під час
  виконання, тож його компонують лише програми, які використовують `application`.

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
