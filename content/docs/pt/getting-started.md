---
source: docs/getting-started.md
sourceCommit: a8c3f8f6
sourceSha256: e41796ac4ccff30a50eeb282a99fd37d606801927af08faf115a4a6e21bfe5fd
translatedAt: 2026-10-17
---
# Primeiros passos

Requisitos:

- CMake 3.28+ e um compilador de C++23; no Windows, o workload **Desktop
  development with C++** do Visual Studio com um Windows SDK, o Ninja e uma
  instalação global do LLVM/Clang (`clang-cl`, e `clang` para ligar os
  programas).
- SDK C++ do LLVM 23.1.x (23.1.1 ou mais recente) para o compilador. É
  preferível uma instalação global; caso contrário, o CMake descarrega o SDK
  fixado 23.1.2 para `thirdparty/` em Windows x64/ARM64, Linux x64/ARM64 e
  macOS ARM64 ([SDK do LLVM](compile.md#llvm-sdk)). As ferramentas de linha de
  comandos do LLVM, por si só, não incluem o SDK.
- Boost 1.90+ (Multiprecision, Asio e, para o compilador, Parser; apenas de
  cabeçalhos), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 e zlib 1.3.2. O CMake
  descarrega os que faltam para `thirdparty/` com verificação SHA-256 e
  reutiliza-os sem rede, também em diretórios de compilação novos; no Linux e
  no macOS, o Boost e o toml++ vêm de uma instalação ou de `thirdparty/`
  ([dependência de compilação](projects.md#build-dependency)).
- Python 3 para os testes e para as ferramentas de qualidade, de benchmarks e
  de listagens.
- O Erlang/OTP não é necessário para compilar nem para testar. Os testes usam
  [fixtures golden próprias do projeto](../tests/fixtures/patternmatch/generated/README.md);
  apenas os parse transforms, as auditorias opcionais em direto, a regeneração
  de fixtures e os benchmarks precisam de uma instalação do OTP 29.

Em macOS (Erlang opcional):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```
