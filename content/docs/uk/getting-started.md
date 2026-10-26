---
source: docs/getting-started.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 927f249c0688995dadbae0b7818e34265c28b2e5d58ba5dd6bec1f879661d54c
translatedAt: 2026-10-26
---
# Початок роботи

Вимоги: CMake 3.28+, компілятор C++23 і Python 3. CMake знаходить або завантажує
SDK LLVM 23.1 та інші залежності; у Windows використовуйте оболонку розробника
Visual Studio x64 зі встановленими Ninja та LLVM/Clang. Подробиці:
[збирання](building.md).

Збирання:

```sh
cmake --preset debug          # Windows: cmake --preset windows
cmake --build --preset debug  # Windows: cmake --build --preset windows-release
```

`clau` з'явиться в `build/debug/bin` (Windows: `build/windows/bin/Release`).

Напишіть програму; точкою входу є модуль, що експортує `main/1`, яка отримує
аргументи командного рядка як рядки:

```erlang
-module(hello).
-export([main/1]).

main(Args) -> io:format("Hello, ~p~n", [Args]).
```

Скомпілюйте та запустіть її:

```sh
clau -O2 -o hello hello.erl
./hello world
```

Якщо файлів більше ніж кілька, опишіть цілі в проєкті TOML:

```sh
clau --new-project myapp       # writes an annotated myapp.toml
clau --project myapp.toml
```

`clau --help` перелічує всі параметри.
