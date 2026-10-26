# Getting started

Requirements: CMake 3.28+, a C++23 compiler and Python 3. CMake finds or downloads the LLVM 23.1 SDK
and other dependencies; on Windows use a Visual Studio x64 developer shell with Ninja and LLVM/Clang
installed. Details: [building](building.md).

Build:

```sh
cmake --preset debug          # Windows: cmake --preset windows
cmake --build --preset debug  # Windows: cmake --build --preset windows-release
```

`clau` lands in `build/debug/bin` (Windows: `build/windows/bin/Release`).

Write a program; the entry is the module exporting `main/1`, which receives the command-line
arguments as strings:

```erlang
-module(hello).
-export([main/1]).

main(Args) -> io:format("Hello, ~p~n", [Args]).
```

Compile and run it:

```sh
clau -O2 -o hello hello.erl
./hello world
```

For more than a few files, describe targets in a TOML project:

```sh
clau --new-project myapp       # writes an annotated myapp.toml
clau --project myapp.toml
```

`clau --help` lists every option.
