# Getting started

Requirements:

- CMake 3.28+ and a C++23-capable compiler.
- On Windows, an installed Clang executable on `PATH` or under `Program Files/LLVM/bin`;
  configuration fails immediately if it is missing or cannot run.
- LLVM 23.1.x (>=23.1.1) C++ SDK for compiler builds. CMake prefers a global
  installation, then downloads the pinned 23.1.2 SDK into `thirdparty/` if missing;
  see [SDK setup and compilation contract](compile.md).
- Boost 1.90+ with Boost.Multiprecision for compiler and runtime; the compiler also
  requires Boost.Parser. Multiprecision is header-only and needs no Boost binary library.
- toml++ 3.4.0 for project manifests; see [dependency setup](projects.md#build-dependency).
- Normal builds and tests do not require Erlang/OTP. Tests use
  [project-owned golden fixtures](../tests/fixtures/patternmatch/generated/README.md).
  Optional live audits and explicit fixture regeneration require Erlang/OTP 29+.

On macOS:

```sh
xcode-select --install
brew install cmake boost erlang tomlplusplus llvm@23
```

On Windows, install LLVM/Clang globally for the host compiler tools.
Install Visual Studio's **Desktop development with C++** workload and a Windows SDK,
plus Ninja. Use an **x64 Native Tools** command prompt or Developer PowerShell
configured for x64, with `clang-cl`, `cmake`, and `ninja` on `PATH`.
CMake checks the MSVC ABI, Windows SDK linkage, and C++23 `std::expected` support.
The LLVM command-line tools alone do not provide the required C++ SDK; CMake
downloads it separately when `LLVMConfig.cmake` and matching libraries are absent.

CMake downloads Boost 1.90.0 and toml++ 3.4.0 into the ignored `thirdparty/`
directory on first use, verifies their SHA-256 checksums, and retains both archives
and extracted sources. Subsequent configurations, including fresh build directories,
reuse those files without network access. Removing `build/` does not remove dependencies.
When CMake's own TLS stack cannot verify certificates (for example the CMake bundled
with Strawberry Perl), downloads are retried with the host `curl` and still verified.
Runtime-only builds download only Boost. Explicit dependency roots below take
precedence and allow offline setup; an invalid explicit root fails without downloading.
Linux and macOS continue to use installed dependencies or local `thirdparty/` sources.
LLVM SDK fallback downloads apply on **all three platforms**, with SHA-256-pinned
official archives for Windows x64/ARM64, Linux x64/ARM64, and macOS ARM64.
Archives and extracted SDKs stay in `thirdparty/` for offline reuse. Other host
architectures and cross-builds require an explicit matching `LLVM_DIR`.

For compiler builds, LLVM's zlib and zstd dependencies are detected from installed
libraries. On Windows, missing libraries trigger SHA-256-verified downloads of
zlib 1.3.2 and zstd 1.5.7, followed by static Debug/Release builds under `thirdparty/`.
These builds are reused across build directories and match the host compiler,
architecture and CRT. Set `ZLIB_ROOT` or `zstd_ROOT` to prefer an installed library;
`CLAUSE_DOWNLOAD_ZLIB=OFF` and `CLAUSE_DOWNLOAD_ZSTD=OFF` disable the respective
fallbacks. MSVC SDK discovery rejects cached MinGW `.a` libraries such as those
bundled with Strawberry Perl. Linux and macOS use installed development packages.
