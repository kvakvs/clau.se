---
source: docs/getting-started.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 927f249c0688995dadbae0b7818e34265c28b2e5d58ba5dd6bec1f879661d54c
translatedAt: 2026-10-26
---
# Premiers pas

Prérequis : CMake 3.28+, un compilateur C++23 et Python 3. CMake trouve ou
télécharge le SDK LLVM 23.1 et les autres dépendances ; sous Windows, utiliser
un shell développeur Visual Studio x64 avec Ninja et LLVM/Clang installés.
Détails : [compilation](building.md).

Compilation :

```sh
cmake --preset debug          # Windows: cmake --preset windows
cmake --build --preset debug  # Windows: cmake --build --preset windows-release
```

`clau` se trouve dans `build/debug/bin` (Windows : `build/windows/bin/Release`).

Écrire un programme ; le point d'entrée est le module exportant `main/1`, qui
reçoit les arguments de la ligne de commande sous forme de chaînes :

```erlang
-module(hello).
-export([main/1]).

main(Args) -> io:format("Hello, ~p~n", [Args]).
```

Le compiler et l'exécuter :

```sh
clau -O2 -o hello hello.erl
./hello world
```

Au-delà de quelques fichiers, décrire les cibles dans un projet TOML :

```sh
clau --new-project myapp       # writes an annotated myapp.toml
clau --project myapp.toml
```

`clau --help` liste toutes les options.
