---
source: docs/getting-started.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 927f249c0688995dadbae0b7818e34265c28b2e5d58ba5dd6bec1f879661d54c
translatedAt: 2026-10-26
---
# Erste Schritte

Voraussetzungen: CMake 3.28+, ein C++23-Compiler und Python 3. CMake findet das
LLVM-23.1-SDK und weitere Abhängigkeiten oder lädt sie herunter; unter Windows
ist eine Visual-Studio-x64-Entwicklershell mit installiertem Ninja und
LLVM/Clang zu verwenden. Einzelheiten: [Bauen](building.md).

Bauen:

```sh
cmake --preset debug          # Windows: cmake --preset windows
cmake --build --preset debug  # Windows: cmake --build --preset windows-release
```

`clau` liegt danach in `build/debug/bin` (Windows: `build/windows/bin/Release`).

Ein Programm schreiben; der Einstieg ist das Modul, das `main/1` exportiert.
Diese Funktion erhält die Befehlszeilenargumente als Zeichenketten:

```erlang
-module(hello).
-export([main/1]).

main(Args) -> io:format("Hello, ~p~n", [Args]).
```

Kompilieren und ausführen:

```sh
clau -O2 -o hello hello.erl
./hello world
```

Für mehr als wenige Dateien die Ziele in einem TOML-Projekt beschreiben:

```sh
clau --new-project myapp       # writes an annotated myapp.toml
clau --project myapp.toml
```

`clau --help` listet alle Optionen auf.
