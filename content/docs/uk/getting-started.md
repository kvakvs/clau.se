---
source: docs/getting-started.md
sourceCommit: a8c3f8f6
sourceSha256: e41796ac4ccff30a50eeb282a99fd37d606801927af08faf115a4a6e21bfe5fd
translatedAt: 2026-10-17
---
# Початок роботи

Вимоги:

- CMake 3.28+ і компілятор C++23; у Windows — робоче навантаження Visual Studio
  **Desktop development with C++** із Windows SDK, Ninja і глобальне
  встановлення LLVM/Clang (`clang-cl`, а також `clang` для компонування
  програм).
- C++ SDK LLVM 23.1.x (23.1.1 або новіший) для компілятора. Перевага надається
  глобальному встановленню; інакше CMake завантажує зафіксований SDK 23.1.2 у
  `thirdparty/` на Windows x64/ARM64, Linux x64/ARM64 і macOS ARM64
  ([LLVM SDK](compile.md#llvm-sdk)). Самі лише інструменти командного рядка LLVM
  не містять SDK.
- Boost 1.90+ (Multiprecision, Asio і Parser для компілятора; лише заголовки),
  toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 і zlib 1.3.2. CMake завантажує
  відсутні з них у `thirdparty/` з перевіркою SHA-256 і повторно використовує їх
  офлайн, також для нових каталогів збирання; у Linux і macOS Boost і toml++
  беруться зі встановлення або з `thirdparty/`
  ([залежність збирання](projects.md#build-dependency)).
- Python 3 для тестів та інструментів якості, бенчмарків і лістингів.
- Erlang/OTP не потрібен для збирання чи тестування. Тести використовують
  [еталонні фікстури, що належать проєкту](../tests/fixtures/patternmatch/generated/README.md);
  лише parse transforms, необов'язкові живі аудити, повторне генерування фікстур
  і бенчмарки потребують встановленого OTP 29.

У macOS (Erlang необов'язковий):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```
