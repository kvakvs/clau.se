---
source: docs/getting-started.md
sourceCommit: a8c3f8f6
sourceSha256: e41796ac4ccff30a50eeb282a99fd37d606801927af08faf115a4a6e21bfe5fd
translatedAt: 2026-10-17
---
# Kom igång

Krav:

- CMake 3.28+ och en C++23-kompilator; på Windows arbetsbelastningen
  **Desktop development with C++** i Visual Studio med en Windows SDK, Ninja och
  en global LLVM/Clang-installation (`clang-cl`, och `clang` för att länka
  program).
- LLVM 23.1.x (23.1.1 eller nyare) C++-SDK för kompilatorn. En global
  installation föredras; annars laddar CMake ned den fastlåsta 23.1.2-SDK:n till
  `thirdparty/` på Windows x64/ARM64, Linux x64/ARM64 och macOS ARM64
  ([LLVM SDK](compile.md#llvm-sdk)). LLVM:s kommandoradsverktyg ensamma
  innehåller inte SDK:n.
- Boost 1.90+ (Multiprecision, Asio och Parser för kompilatorn; enbart
  headerfiler), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 och zlib 1.3.2. CMake
  laddar ned saknade beroenden till `thirdparty/` med SHA-256-kontroller och
  återanvänder dem utan nätverk, även för nya byggkataloger; på Linux och macOS
  kommer Boost och toml++ från en installation eller från `thirdparty/`
  ([byggberoende](projects.md#build-dependency)).
- Python 3 för tester och för kvalitets-, benchmark- och listningsverktygen.
- Erlang/OTP behövs inte för att bygga eller testa. Testerna använder
  [projektägda golden-fixturer](../tests/fixtures/patternmatch/generated/README.md);
  endast parse transforms, valfria live-granskningar, återskapande av fixturer
  och benchmarks kräver en OTP 29-installation.

På macOS (Erlang valfritt):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```
