---
source: docs/usage.md
sourceCommit: 6ed3851c
sourceSha256: d4118cc040e610cc84df916720e96a6009b90b6a1cbfe086434dc5800fe49461
translatedAt: 2026-10-15
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
`TOOL_BUILD_DIR`, `BUILD_TYPE` і `JOBS`.

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
  --print-abstr            Print each module as OTP abstract format forms
  --parse-transform <mod>  Apply a parse transform to every module
  --transform-path <dir>   Directory of precompiled transform modules (.beam)
  --erl <path|none>        Host Erlang/OTP 29 erl that runs parse transforms
  --print-inputs           List the batch's sources, including modules added by reference; do not compile
  --print-env              Print the resolved compile environment as TOML and exit
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --print-asm              Print each module's assembly with IR and Erlang source comments
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  -g                      Emit Erlang line tables; executables keep them for debuggers
  --lto                   Link modules as bitcode with link-time optimization (LLD targets)
  --keep-exports          Keep every export of an executable callable (default: unreachable ones left out)
  --build-dir <dir>       Keep temporary files and caches below <dir> (projects default: <manifest-dir>/build)
  --no-cache              Neither read nor write build caches
  --cache-inference-in-dirs <pattern>  Cache inference results of modules in matching directories (besides OTP's)
  --verbose               Trace files and compilation phases to stderr
  --print-stage-times     Print preprocess/parse/transform time per file, compile time per batch and link time to stderr
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
clau --print-asm -O2 answer.erl
clau --print-types answer.erl client.erl
```

Перегляд IR дозволяє обидва етапи разом і зупиняється перед генерацією
об'єктного коду. Кілька знімків є окремими модулями; для окремих файлів
асемблера використовуйте `--emit llvm-ir`. `--print-asm` друкує асемблер цілі для
кожного модуля, де кожна послідовність інструкцій має коментар з інструкцією
IR і рядком Erlang, з яких вона походить
([лістинги асемблера](compile.md#assembly-listings)). Перегляд типів
зупиняється перед LLVM і друкує кожен модуль як вихідний код із виведеними
сигнатурами функцій та завершальними коментарями `% Type` до найзовнішнього
виразу кожного рядка. Він приймає параметри препроцесування/проєкту/
докладності, але відхиляє інші дії, призначення виводу і політику бекенду. Див.
[параметри компіляції](compile.md).

`--verbose` друкує `[pp] <filename>` для вихідних файлів і розв'язаних включень
препроцесора та `[parse] <filename>`, коли кожен вихідний файл надходить до
парсера. Вкладені та бібліотечні включення трасуються під час завантаження;
неактивні включення пропускаються. Парсер споживає розгорнуті токени поступово,
тож його траса може передувати трасам включень. `[comp]` додає семантичні фази
та фази бекенду, а також обмежені рішення щодо спеціалізації в момент їхнього
початку. Трасування йде в stderr у кожному режимі, зокрема для проєктів.

`--print-stage-times` друкує `[time] <stage> <subject>: <milliseconds> ms` у
stderr після завершення кожного етапу: `preprocess` (читання й
препроцесування), `parse` і, для модулів із parse transforms, `transform`
(запуск `erl` хоста й імпорт його форм) для кожного вихідного файлу, `compile`
(від аналізу до генерації об'єктного коду) один раз на пакет із кількістю
модулів і ціллю проєкту, і `link` для кожного виконуваного файлу з його
остаточним шляхом. Парсер забирає форми з препроцесора, тож два часи для
кожного файлу вимірюються окремо, хоча етапи чергуються.

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
