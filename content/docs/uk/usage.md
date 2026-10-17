---
source: docs/usage.md
sourceCommit: a8c3f8f6
sourceSha256: 06562916f7abbce822d9a5ca87d42cc0b3306de611e06ebce33ca5b2bd10d101
translatedAt: 2026-10-17
---
# Використання компілятора

Зберіть програму з вихідних файлів; точкою входу є єдиний модуль, що
експортує `main/1`, який отримує аргументи командного рядка як рядки:

```sh
clau -O2 -o demo examples/compile/answer.erl examples/compile/client.erl
./demo
clau -o app --entry app:start src/*.erl     # app:start/1, else app:start/0
```

У Windows `-o` додає `.exe`, коли шлях не має розширення. Без `-o` позиційні
вхідні файли компілюються в пам'яті й видають лише діагностику. Вибір точки
входу, аргументи, код завершення та компонування описано у
[виконуваних файлах](executables.md), а [приклад скомпільованого модуля](../examples/compile/)
показує хост на C++, який сам компонує згенеровані об'єкти.

Проєкти описують цілі в TOML; кожна ціль із ключем `output` або `entry`
компонується у свій вихідний файл (типово `build/<target>`), а вихідні файли
замінюються лише після успіху всіх вибраних цілей:

```sh
clau --new-project myapp                        # writes an annotated myapp.toml
clau --project myapp.toml                       # build every target
clau --project examples/project/project.toml --target app --parse-check
```

Маніфест, пошук вихідних файлів, ігноровані вихідні файли, каталоги збирання й
кеші описано в [проєктах](projects.md).

Поширені параметри (`clau --help` перелічує всі):

| Параметр | Призначення |
| --- | --- |
| `-o, --output PATH`, `--entry M[:F[/A]]` | Скомпонувати виконуваний файл і вибрати точку входу |
| `--project PATH`, `--target NAME` | Зібрати проєкт TOML або вибрані цілі |
| `-O0`, `-O2`, `-Os`, `--no-type-specialization` | Оптимізація (типово O0; O2 додає спеціалізацію за типами) |
| `-g`, `--lto`, `--keep-exports` | Таблиці рядків для налагодження, оптимізація під час компонування, збереження недосяжних експортів |
| `-I DIR`, `-D NAME[=TERM]`, `--app-dir APP=DIR` | Шляхи включень, макроси, корені `include_lib` |
| `--enable-feature F`, `--disable-feature F` | Мовні можливості OTP |
| `--parse-transform M`, `--transform-path DIR`, `--erl PATH\|none` | Parse transforms і OTP хоста, що їх виконує |
| `--emit obj\|llvm-ir\|llvm-bc`, `--artifact-dir DIR` | Записати один артефакт на модуль (типовий корінь `build/aot`) |
| `--target-triple TRIPLE`, `--linker PATH`, `--runtime-library PATH` | Ціль, драйвер компонувальника й архів runtime |
| `--build-dir DIR`, `--no-cache`, `--cache-inference-in-dirs PAT` | Тимчасові файли й кеші збирання |
| `--verbose`, `--print-stage-times` | Трасування фаз; час кожного етапу в stderr |

Дії перегляду друкують у stdout і не компілюють виконуваних файлів:

| Параметр | Друкує |
| --- | --- |
| `--preprocess-check`, `--parse-check` | Нічого; лише діагностику |
| `--print-pp`, `--print-ast`, `--print-source`, `--print-abstr` | Препроцесований вихідний код, синтаксичне дерево, вихідний код, абстрактний формат OTP |
| `--print-inputs` | Кожен вихідний файл пакета, зокрема бібліотечні модулі, додані за посиланням |
| `--print-env` | Розв'язане середовище компіляції як TOML |
| `--print-types` | Вихідний код, анотований виведеними типами |
| `--print-ir`, `--print-optimized-ir`, `--print-asm` | IR до/після оптимізації LLVM, асемблер із коментарями IR та Erlang |

`clau` завершується з кодом 0 у разі успіху (зокрема з попередженнями), 1 —
для помилок вихідного коду чи проєкту і 2 — для помилок використання.
Докладніше: [компіляція](compile.md), [препроцесування](preprocessor.md),
[парсер](parser.md).

Parse transforms (`-compile({parse_transform, M})`) виконуються на
Erlang/OTP 29, встановленому на хості (`erl` у `PATH` або `--erl`), як це
робив би `erlc`; OTP потрібен лише для компіляції, але ніколи для виконуваного
файлу. Transforms, окрім власних transforms OTP, треба спершу скомпілювати в
`.beam` ([parse transforms](transforms.md)).

### Параметри runtime

Програми читають параметри runtime зі змінної середовища `CLAUSE_FLAGS` і з
початкових аргументів командного рядка, аж до першого іншого аргументу або
`--`:

```sh
./demo --schedulers 4 --max-heap 100000000 -- arg1 arg2
```

`--schedulers N`, `--max-atoms N`, `--max-heap BYTES`, `--max-stack BYTES`,
`--max-memory BYTES` і `--profile FILE` описано в
[параметрах runtime](executables.md#runtime-options).
