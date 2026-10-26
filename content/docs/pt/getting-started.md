---
source: docs/getting-started.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 927f249c0688995dadbae0b7818e34265c28b2e5d58ba5dd6bec1f879661d54c
translatedAt: 2026-10-26
---
# Primeiros passos

Requisitos: CMake 3.28+, um compilador de C++23 e Python 3. O CMake encontra ou
descarrega o SDK do LLVM 23.1 e outras dependências; no Windows, usar uma shell
de desenvolvimento x64 do Visual Studio com Ninja e LLVM/Clang instalados.
Detalhes: [compilação](building.md).

Compilar:

```sh
cmake --preset debug          # Windows: cmake --preset windows
cmake --build --preset debug  # Windows: cmake --build --preset windows-release
```

O `clau` fica em `build/debug/bin` (Windows: `build/windows/bin/Release`).

Escrever um programa; o ponto de entrada é o módulo que exporta `main/1`, que
recebe os argumentos da linha de comandos como strings:

```erlang
-module(hello).
-export([main/1]).

main(Args) -> io:format("Hello, ~p~n", [Args]).
```

Compilar e executar:

```sh
clau -O2 -o hello hello.erl
./hello world
```

Para mais do que alguns ficheiros, descrever os alvos num projeto TOML:

```sh
clau --new-project myapp       # writes an annotated myapp.toml
clau --project myapp.toml
```

`clau --help` lista todas as opções.
