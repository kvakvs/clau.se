---
source: docs/getting-started.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 927f249c0688995dadbae0b7818e34265c28b2e5d58ba5dd6bec1f879661d54c
translatedAt: 2026-10-26
---
# Primeros pasos

Requisitos: CMake 3.28+, un compilador de C++23 y Python 3. CMake encuentra o
descarga el SDK de LLVM 23.1 y las demás dependencias; en Windows se usa una
consola de desarrollo x64 de Visual Studio con Ninja y LLVM/Clang instalados.
Detalles: [compilación](building.md).

Compilación:

```sh
cmake --preset debug          # Windows: cmake --preset windows
cmake --build --preset debug  # Windows: cmake --build --preset windows-release
```

`clau` queda en `build/debug/bin` (Windows: `build/windows/bin/Release`).

Se escribe un programa; el punto de entrada es el módulo que exporta `main/1`,
que recibe los argumentos de la línea de órdenes como cadenas:

```erlang
-module(hello).
-export([main/1]).

main(Args) -> io:format("Hello, ~p~n", [Args]).
```

Se compila y ejecuta:

```sh
clau -O2 -o hello hello.erl
./hello world
```

Para más de unos pocos archivos, se describen los objetivos en un proyecto TOML:

```sh
clau --new-project myapp       # writes an annotated myapp.toml
clau --project myapp.toml
```

`clau --help` enumera todas las opciones.
