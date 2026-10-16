# Getting started

Requirements:

- CMake 3.28+ and a C++23 compiler; on Windows, Visual Studio's **Desktop
  development with C++** workload with a Windows SDK, Ninja and a global
  LLVM/Clang installation (`clang-cl`, and `clang` for linking programs).
- LLVM 23.1.x (23.1.1 or newer) C++ SDK for the compiler. A global installation
  is preferred; otherwise CMake downloads the pinned 23.1.2 SDK into
  `thirdparty/` on Windows x64/ARM64, Linux x64/ARM64 and macOS ARM64
  ([LLVM SDK](compile.md#llvm-sdk)). The LLVM command-line tools alone do
  not include the SDK.
- Boost 1.90+ (Multiprecision, Asio, and Parser for the compiler; header-only),
  toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 and zlib 1.3.2. CMake downloads
  missing ones into `thirdparty/` with SHA-256 checks and reuses them offline,
  also for fresh build directories; on Linux and macOS, Boost and toml++ come
  from an installation or `thirdparty/`
  ([build dependency](projects.md#build-dependency)).
- Python 3 for tests and the quality, benchmark and listing tools.
- Erlang/OTP is not needed to build or test. Tests use
  [project-owned golden fixtures](../tests/fixtures/patternmatch/generated/README.md);
  only parse transforms, optional live audits, fixture regeneration and
  benchmarks need an OTP 29 installation.

On macOS (Erlang optional):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```
