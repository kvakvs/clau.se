---
source: docs/building.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b5b9cdbb0544c714f847eac4931ed0fa38d8de1144153349efac4c2302159cbc
translatedAt: 2026-10-26
---

# Збирання Clause

Як зібрати `clau` і `clause_runtime`, налаштувати збирання, запустити тести
й використовувати інструменти розробника. Будову тестів і результати описано у
[валідації](validation.md).

## Вимоги

- CMake 3.28+ і компілятор C++23; у Windows — набір компонентів **Desktop
  development with C++** Visual Studio з Windows SDK, Ninja і глобально
  встановленим LLVM/Clang (`clang-cl` і `clang` для компонування програм).
- C++ SDK LLVM 23.1.x (23.1.1 або новіший) для компілятора. Бажано глобальне
  встановлення; інакше CMake завантажує зафіксований SDK 23.1.2 у
  `thirdparty/` на Windows x64/ARM64, Linux x64/ARM64 і macOS ARM64
  ([LLVM SDK](compile.md#llvm-sdk)). Самі інструменти командного рядка LLVM
  не містять SDK.
- Boost 1.90+ (Multiprecision, Asio та Parser для компілятора; лише заголовки),
  toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 і zlib 1.3.2. CMake завантажує
  відсутні залежності в `thirdparty/` з перевірками SHA-256 і повторно
  використовує їх без мережі, зокрема для нових каталогів збирання; на Linux
  і macOS Boost і toml++ беруться зі встановлення або `thirdparty/`
  ([залежність збирання](projects.md#build-dependency)).
- Python 3 для тестів та інструментів якості, бенчмарків і лістингів.
- Erlang/OTP не потрібен для збирання чи тестування. Тести використовують
  [власні еталонні фікстури проєкту](../tests/fixtures/patternmatch/generated/README.md);
  встановлення OTP 29 потрібне лише для перетворень розбору, необов'язкових
  живих аудитів, повторної генерації фікстур і бенчмарків.

На macOS (Erlang необов'язковий):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```

## Налаштування та збирання

```sh
cmake --preset debug                    # build/debug, single configuration
cmake --build --preset debug
```

У Windows — з оболонки розробника x64, де `clang-cl` і `ninja` є в `PATH`:

```powershell
cmake --preset windows                  # build/windows, Ninja Multi-Config
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Пресет `debug` розміщує `clau` у `build/debug/bin`; пресет `windows` — у
`build/windows/bin/<Config>/clau.exe`, а runtime — у
`build/windows/lib/<Config>/clause_runtime.lib`. `clau` знаходить архів
runtime і модулі `library/` відносно власного розташування.

## Обгортки

Перевизначення через змінні середовища: `BUILD_DIR`, `TOOL_BUILD_DIR`,
`BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`.

| Makefile | Windows | Що робить |
| --- | --- | --- |
| `make build` | `make-build.bat` | Збирає `clau` у `build/tool` без тестів (пакетний скрипт також збирає Release і runtime) |
| `make test`, `make test-full` | `make-test.bat` | Налаштовує `build/debug` з тестами, збирає все, запускає CTest |
| `make format`, `make format-all` | `make-format.bat` | Форматує clang-format змінені (або, з `FORMAT_SCOPE=all`, усі) файли C++ |
| `make benchmark` | `make-benchmark.bat` | Збирання Release у `build/bench`, потім порівняння з OTP хоста |
| `make clean` | `make-clean.bat` | Видаляє `build/` і `cmake-build*/` |

Пакетні скрипти за потреби самі входять у середовище Visual Studio x64,
додають `%ProgramFiles%\LLVM\bin` до `PATH`, коли `clang-cl` відсутній, і
переналаштовують каталог збирання, створений іншим генератором або
компілятором; задайте `CLAUSE_TOOLCHAIN=default`, щоб зберегти власний вибір
CMake. `clau.bat` (Windows) і `run-macos.sh` спершу збирають `build/tool`, а
потім запускають `clau` з усіма аргументами, зберігаючи робочий каталог і код
виходу викликача.

## Параметри конфігурування

| Параметр | Призначення |
| --- | --- |
| `-DBUILD_TESTING=ON` | Збирати тести та їхні допоміжні програми (за замовчуванням OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF` | Зібрати лише бібліотеку runtime без LLVM |
| `-DCLAUSE_BUILD_RUNTIME=OFF` | Зібрати лише компілятор |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Вибрати SDK LLVM 23.1.x (недійсний явний шлях дає помилку) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Вимагати встановлений SDK |
| `-DCLAUSE_BOOST_ROOT=...`, `-DCLAUSE_TOML_ROOT=...`, `-DCLAUSE_SQLITE_ROOT=...`, `-DCLAUSE_PCRE2_ROOT=...` | Вибрати джерело або встановлення залежності (налаштування без мережі) |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Вибрати виконуваний файл Clang для Windows |
| `-DCLAUSE_OTP_AUDITS=ON`, `-DCLAUSE_ESCRIPT=/path/to/escript` | Увімкнути необов'язкові живі аудити OTP і вибрати використовуваний OTP 29 |
| `-DCLAUSE_TEST_DEBUG_INFO=ON` | Збирати тестові програми з налагоджувальною інформацією (щоб налагодити збій) |
| `-DCLAUSE_OPTIMIZED_COMPILER=OFF` | Збирати `clau` і бібліотеки компілятора без оптимізації в Debug (щоб налагодити збій `clau`) |

Примітки щодо Windows: CRT за замовчуванням — `/MDd` (Debug) або `/MD`; явно
заданий `CMAKE_MSVC_RUNTIME_LIBRARY` має відповідати SDK LLVM. MSVC `cl`
працює в окремому каталозі збирання; MinGW не підтримується. Цілі проєкту
трактують попередження як помилки та включають залежності як заголовки
`SYSTEM`, тому не додавайте шляхи залежностей через глобальні прапорці `-I`,
як-от `CXXFLAGS` (у CLion очистіть кешоване значення через
`-DCMAKE_CXX_FLAGS:STRING=`); натомість використовуйте кореневі параметри.

## Тести

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug-fast                # or windows-debug-fast
ctest --preset debug -j 16               # full mode
```

`CLAUSE_TEST_MODE=fast` (пресети `*-fast`, `make test`, `make-test.bat`)
виконує скорочену матрицю оптимізацій/драйверів і пропускає тести
`full_only`; `full` (за замовчуванням, якщо не задано, `make test-full`,
`TEST_MODE=full`) виконує все. Кожен тест резервує два слоти CTest, тож
`-j N` виконує N/2 тестів одночасно.

## Контроль якості

Lizard і clang-tidy, версії зафіксовано в `tools/requirements-quality.txt`,
встановлюються в `.venv-quality/` (поза Windows використовуйте
`.venv-quality/bin/python`):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` перевіряє файли, змінені від `HEAD` (або `CLAUSE_QUALITY_BASE`),
і по одній одиниці трансляції на змінений заголовок (`check-quality-all` охоплює
всі залежні одиниці) та потребує збірки з увімкненими
компілятором і runtime; `check-complexity-all` та `check-clang-tidy-all`
запускають один інструмент. `cmake/CheckClangTidy.cmake` приймає
`QUALITY_SHARD=K/N`, щоб розділити тривалий запуск.

## Бенчмарки й лістинги

`make benchmark` / `make-benchmark.bat` збирають Release `clau` у `build/bench`
і порівнюють програми `benchmarks/bench_*.erl` з OTP хоста та старішим комітом
Clause; `benchmarks/run.py --help` перелічує параметри
([бенчмарки](validation.md#benchmarks)). Вони ніколи не є частиною тестів.

`benchmarks/compile_times.py` вимірює час роботи самого `clau`: кілька разів
запускає завдання компіляції (`--workload W1` або аргументи `clau` після `--`)
на продуктивних ядрах із `--no-cache --print-stage-times` і звітує про медіану,
мінімум і розкид для кожної фази та проходу виведення, найповільніші компоненти
виведення й те, чи збігаються лічильники проходів і stdout між запусками.
З `--baseline <clau.exe>` дві збірки чергуються, а підсумок показує їхнє
співвідношення. Скрипт відмовляється вимірювати час, поки тривають збирання,
тести чи інший запуск `clau`, якщо не задано `--force-noisy`, і записує JSON
у `build/bench/compile-times/`.

`decompile-debug.bat <module>` і `decompile-release.bat <module>` записують
асемблерний код Debug або Release одного вихідного файлу Clause на C++ у
`<module>.debug.asm` / `<module>.release.asm`, з рядками вихідного коду й
відновленими іменами (`tools/asm.py`, збірки clang-cl; `--function TEXT`
фільтрує).
