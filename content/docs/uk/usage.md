---
source: docs/usage.md
sourceCommit: 06042fa
sourceSha256: 69cd5cc2e8c6acc6bf67d677812a78d984940084e75d4930fbdcdf681e488435
translatedAt: 2026-10-09
---
# Використання компілятора

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

У macOS `./run-macos.sh --parse-check examples/project/src/main.erl` спочатку
виконує збирання, а потім запускає найновіший виконуваний файл, передаючи всі
аргументи без змін. Він приймає перевизначення через змінні середовища
`BUILD_DIR`, `BUILD_TYPE` і `JOBS`.

```text
clau [options] <source.erl>...
  --project <path>        Read a TOML project instead of positional sources
  --target <name>         Select a target; repeat for more (default: all)
  --new-project <filename>  Create an annotated starter; append .toml when needed
  --preprocess-check       Check preprocessing only
  --parse-check            Preprocess and check syntax
  --print-pp               Print expanded Erlang source
  --print-ast              Print an indented syntax tree
  --print-source           Print each module as Erlang source
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  --verbose               Trace files and compilation phases to stderr
  --impldebug <n[,n...]>   Enable debug output for selected implementation steps
  -I, --include <dir>      Add an include directory (last supplied searched first)
  -D, --define <name[=term]>  Define a macro (default value: true)
  --app-dir <app=dir>      Set an include_lib application directory
  --enable-feature <name>  Enable a language feature
  --disable-feature <name> Disable a language feature
  -h, --help              Show all options
  --version               Show version
  --                      Treat remaining arguments as input paths
```

Шляхи з пробілами та значення макросів із пунктуацією оболонки беріть у лапки:

```sh
./build/debug/bin/clau --parse-check -I include '-DVERSION={1,0}' \
  --app-dir myapp=examples/project examples/project/src/main.erl
```

Режими перевірки нічого не виводять у разі успіху; діагностика йде в stderr.
Режими друку пишуть у stdout і можуть поєднуватися: `--print-pp --print-ast`
друкує вихідний код перед деревом для кожного вхідного файлу. Додавання
`--preprocess-check` не вимикає розбору, запитаного через `--parse-check` або
`--print-ast`. Помилки можуть залишити частково надрукований вивід.

Без дії перевірки/друку вхідні файли та `--project` проходять увесь конвеєр
аж до перевірених нативних об'єктних буферів у пам'яті. Позиційні вхідні файли
утворюють один пакет; кожна ціль проєкту утворює власний пакет. `--emit` записує
артефакти в `build/aot` або `--artifact-dir`; проєкти додають закодовану назву
цілі й використовують корінь за замовчуванням відносно маніфесту. Імена файлів
кодують ідентичність модуля. `-o PATH` компонує позиційні вхідні файли або одну
вибрану ціль проєкту у виконуваний файл за допомогою Clang і бібліотеки runtime
(точка входу: `--entry MODULE[:FUNCTION]`, `entry` з маніфесту або єдиний
модуль, що експортує `main/1`). Без `-o` цілі проєкту з ключем `output` або
`entry` компонуються у свій `output` з TOML (за замовчуванням
`build/<target>`), а публікація відбувається лише після компонування всіх
вибраних цілей. Контракт щодо точки входу, аргументів і коду завершення див. у
[виконуваних файлах](executables.md).

```sh
clau -O2 -o demo answer.erl client.erl && ./demo
clau -O2 --emit obj answer.erl client.erl
clau --print-ir --print-optimized-ir -O2 answer.erl
clau --print-types answer.erl client.erl
```

Перегляд IR дозволяє обидва етапи разом і зупиняється перед генерацією
об'єктного коду. Кілька знімків є окремими модулями; для окремих файлів
асемблера використовуйте `--emit llvm-ir`. Перегляд типів зупиняється перед
LLVM і друкує кожен модуль як вихідний код із виведеними сигнатурами функцій та
анотаціями `Expression :: Type`. Він приймає параметри препроцесування/проєкту/
докладності, але відхиляє інші дії, призначення виводу і політику бекенду. Див.
[параметри компіляції](compile.md).

`--verbose` друкує `[pp] <filename>` для вихідних файлів і розв'язаних включень
препроцесора та `[parse] <filename>`, коли кожен вихідний файл надходить до
парсера. Вкладені та бібліотечні включення трасуються під час завантаження;
неактивні включення пропускаються. Парсер споживає розгорнуті токени поступово,
тож його траса може передувати трасам включень. `[comp]` додає семантичні фази
та фази бекенду, а також обмежені рішення щодо спеціалізації в момент їхнього
початку. Трасування йде в stderr у кожному режимі, зокрема для проєктів.

`--impldebug 23` або `--impldebug 23,24,27` вибирає необов'язковий
налагоджувальний вивід кроків реалізації незалежно від `--verbose`. Повторювані
параметри поєднують свої вибори; дублікати ігноруються. Значення — знакові
32-бітні десяткові цілі числа з необов'язковими знаками `+`/`-`, без пробілів і
порожніх елементів списку. Кроки 23–27 друкують у stderr виведені входи/
результати функцій і зв'язки параметрів із префіксом вибраного кроку
(наприклад, `[impldebug 27]`). Це проаналізовані вхідні дані пониження, а не дамп
IR. Майбутні кроки можуть перевіряти власний номер; вибір кроку без
налагоджувального виводу нічого не змінює. Той самий вибір застосовується до
позиційних вхідних файлів і кожної вибраної цілі проєкту. Дії перевірки/друку
лише фронтенду не запускають виведення типів.

Коди виходу: **0** — успіх (зокрема з попередженнями), **1** — помилки
вихідного коду/проєкту, **2** — помилки використання або невідомі назви цілей.
Кожен вхідний файл має незалежний стан препроцесування; будь-яка помилка
вихідного коду робить усю команду невдалою.

Синтаксичні перевірки не перевіряють семантику і не виконують parse transform.
Режими перевірки/друку не створюють вихідних файлів і відхиляють `-o`/`--output`.
Компіляція за замовчуванням без `-o` не записує виконуваного файлу.

Докладніше див. [препроцесування](preprocessor.md),
[використання парсера](parser.md) і [стан валідації](validation.md).


## Проєкти


Запустіть доданий приклад із двома цілями:

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target app
./build/debug/bin/clau --preprocess-check --project examples/project/project.toml --target tests --target app
```

Створіть анотований проєкт в існуючому каталозі:

```sh
mkdir -p build/project-demo
./build/debug/bin/clau --new-project build/project-demo/demo
mkdir -p build/project-demo/src
cp examples/project/src/main.erl build/project-demo/src/main.erl
./build/debug/bin/clau --parse-check --project build/project-demo/demo.toml
```

Створення записує лише запитаний файл TOML і відмовляється перезаписувати
наявні файли. Початковий шаблон містить одну ціль `app`, що використовує `src`,
з усіма параметрами фронтенду за замовчуванням. Перед перевіркою додайте
вихідні файли.

Шляхи в маніфесті задаються відносно файлу TOML; шляхи в CLI — відносно
каталогу виклику. За замовчуванням виконуються всі цілі. Повторюйте `--target`,
щоб вибрати впорядковану підмножину; повторні вибори виконуються один раз.
`sources` підтримує буквальні імена файлів і шаблони `*`, `?`, `**`;
`source_dirs` рекурсивно знаходить файли `.erl`. Шляхи пошуку вихідного коду
лише знаходять явно перелічені файли. Шляхи включень із CLI мають пріоритет,
корені застосунків із CLI замінюють однойменні, налаштування можливостей із CLI
застосовуються останніми, а дублікати визначень макросів лишаються помилками.

Див. [формат проєктів і робочі процеси](projects.md). Проєкти підтримують кожну
дію CLI; генерація виконуваних файлів лишається нереалізованою.

[Каталог допущених guard](guards.md) містить перевірені `is_integer/3`,
кваліфіковані виклики і застарілі перевірки верхнього рівня; ідентичності
процесу/вузла і native record зберігають явну діагностику можливостей.
