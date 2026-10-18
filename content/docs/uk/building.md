---
source: docs/building.md
sourceCommit: 336caea7
sourceSha256: 86d39780700856574257fd2d598102b8e551505085c42a0a8175f9c2c7b2330c
translatedAt: 2026-10-18
---

# Збирання компілятора

Налаштуйте й зберіть з кореня репозиторію:

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

Обгортки (перевизначення через змінні середовища: `BUILD_DIR`,
`TOOL_BUILD_DIR`, `BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`,
`CLANG_FORMAT`):

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

Параметри конфігурування:

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

Примітки щодо Windows: CRT за замовчуванням — `/MDd` (Debug) або `/MD`; явно
заданий `CMAKE_MSVC_RUNTIME_LIBRARY` має відповідати SDK LLVM. MSVC `cl`
працює в окремому каталозі збирання; MinGW не підтримується. Цілі проєкту
трактують попередження як помилки та включають залежності як заголовки
`SYSTEM`, тому не додавайте шляхи залежностей через глобальні прапорці `-I`,
як-от `CXXFLAGS` (у CLion очистіть кешоване значення через
`-DCMAKE_CXX_FLAGS:STRING=`); натомість використовуйте кореневі параметри.

## Тестування

Тести вмикаються за бажанням під час конфігурування:

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
`-j N` виконує N/2 тестів одночасно. Тести компілюють справжні вихідні файли
Erlang через CLI і порівнюють виконувані файли з еталонами, згенерованими OTP;
базову лінію, фікстури та будову тестів описано в
[валідації](validation.md).

Контроль якості (Lizard і clang-tidy, версії інструментів зафіксовано в
`tools/requirements-quality.txt`, встановлюються в `.venv-quality/`; поза
Windows використовуйте `.venv-quality/bin/python`):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` перевіряє файли, змінені від `HEAD` (або `CLAUSE_QUALITY_BASE`),
і по одній одиниці трансляції на змінений заголовок (`check-quality-all` охоплює
всі залежні одиниці в повній перевірці) та потребує збірки з увімкненими
компілятором і runtime; `check-complexity-all` та `check-clang-tidy-all`
запускають один інструмент. `cmake/CheckClangTidy.cmake` приймає
`QUALITY_SHARD=K/N`, щоб розділити тривалий запуск.
