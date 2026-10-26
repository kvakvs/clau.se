---
source: docs/getting-started.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 927f249c0688995dadbae0b7818e34265c28b2e5d58ba5dd6bec1f879661d54c
translatedAt: 2026-10-26
---
# Kom igång

Krav: CMake 3.28+, en C++23-kompilator och Python 3. CMake hittar eller laddar ned
LLVM 23.1 SDK och andra beroenden; på Windows används ett Visual Studio
x64-utvecklarskal med Ninja och LLVM/Clang installerade.
Detaljer: [bygga](building.md).

Bygg:

```sh
cmake --preset debug          # Windows: cmake --preset windows
cmake --build --preset debug  # Windows: cmake --build --preset windows-release
```

`clau` hamnar i `build/debug/bin` (Windows: `build/windows/bin/Release`).

Skriv ett program; ingången är modulen som exporterar `main/1`, som tar emot
kommandoradsargumenten som strängar:

```erlang
-module(hello).
-export([main/1]).

main(Args) -> io:format("Hello, ~p~n", [Args]).
```

Kompilera och kör det:

```sh
clau -O2 -o hello hello.erl
./hello world
```

För fler än några få filer, beskriv målen i ett TOML-projekt:

```sh
clau --new-project myapp       # writes an annotated myapp.toml
clau --project myapp.toml
```

`clau --help` listar alla alternativ.
