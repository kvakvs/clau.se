---
source: docs/getting-started.md
sourceCommit: a8c3f8f6
sourceSha256: e41796ac4ccff30a50eeb282a99fd37d606801927af08faf115a4a6e21bfe5fd
translatedAt: 2026-10-17
---
# Primeros pasos

Requisitos:

- CMake 3.28+ y un compilador de C++23; en Windows, la carga de trabajo
  **Desktop development with C++** de Visual Studio con un Windows SDK, Ninja y
  una instalación global de LLVM/Clang (`clang-cl`, y `clang` para enlazar
  programas).
- El SDK de C++ de LLVM 23.1.x (23.1.1 o posterior) para el compilador. Se
  prefiere una instalación global; en caso contrario, CMake descarga el SDK
  fijado 23.1.2 en `thirdparty/` en Windows x64/ARM64, Linux x64/ARM64 y macOS
  ARM64 ([SDK de LLVM](compile.md#llvm-sdk)). Las herramientas de línea de
  órdenes de LLVM por sí solas no incluyen el SDK.
- Boost 1.90+ (Multiprecision, Asio y Parser para el compilador; solo
  cabeceras), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 y zlib 1.3.2. CMake
  descarga las que faltan en `thirdparty/` con verificación SHA-256 y las
  reutiliza sin conexión, también para directorios de compilación nuevos; en
  Linux y macOS, Boost y toml++ proceden de una instalación o de `thirdparty/`
  ([dependencias de compilación](projects.md#build-dependency)).
- Python 3 para las pruebas y las herramientas de calidad, benchmarks y
  listados.
- Erlang/OTP no es necesario para compilar ni para ejecutar las pruebas. Las
  pruebas usan
  [fixtures golden propios del proyecto](../tests/fixtures/patternmatch/generated/README.md);
  solo los parse transforms, las auditorías opcionales en vivo, la regeneración
  de fixtures y los benchmarks necesitan una instalación de OTP 29.

En macOS (Erlang opcional):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```
