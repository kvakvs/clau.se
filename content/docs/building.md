# Building the compiler

From the repository root:

```sh
cmake --preset debug
cmake --build --preset debug
```

On Windows, use the clang-cl/Ninja Multi-Config preset from the developer shell:

```powershell
cmake --preset windows
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Tests and their helper executables are opt-in. Configure explicitly for testing:

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug --no-tests=error
```

On Windows:

```powershell
cmake --preset windows -DBUILD_TESTING=ON
cmake --build --preset windows-debug
ctest --preset windows-debug --no-tests=error
cmake --build --preset windows-release
ctest --preset windows-release --no-tests=error
```

Tests have two modes, selected by `CLAUSE_TEST_MODE`:

- `fast` for development: golden corpora run two policy/driver combinations
  (O0 positional and O2 without specialization through a project) instead of all
  eight, mutation cases run once, and tests labelled `full_only` (separate CMake
  consumer projects and timing measurements) are excluded.
- `full` (the default when unset) runs every combination and every test; use it
  when a major feature is complete.

```sh
ctest --preset debug-fast            # or windows-debug-fast; tests use half the logical CPUs
ctest --preset debug -j 32           # full mode; -j N runs N/2 tests at once
make test                            # fast; make test-full or TEST_MODE=full for full
```

`make-test.bat` follows the same `TEST_MODE` (default `fast`) and `TEST_JOBS` (default
all logical CPUs) settings. Every test reserves two CTest processor slots (`PROCESSORS 2`),
so a slot count of N runs at most N/2 tests concurrently, leaving room for the compilers and
nested native builds the tests start. On a 32-thread Windows x64 host, fast mode takes about
one minute and full mode about 85 seconds with 16 jobs (729 seconds serially).

For a build directory without a preset, pass `-DBUILD_TESTING=ON` to `cmake -S . -B <dir>`
for testing. CMake caches this setting; pass `-DBUILD_TESTING=OFF` when reusing that
directory for ordinary builds. The normal presets and build wrappers set it to `OFF`.

The batch scripts mirror the Makefile's `build`, `format`, and `clean` targets:
`make-build.bat`, `make-test.bat`, `make-format.bat`, and `make-clean.bat`. The build and test
scripts configure clang-cl with Ninja Multi-Config, like the `windows` preset, entering the
Visual Studio x64 environment themselves when the shell is not a developer shell and adding
`%ProgramFiles%\LLVM\bin` to `PATH` when `clang-cl` is missing. A build directory configured
with another generator or compiler is reconfigured from scratch; set `CLAUSE_TOOLCHAIN=default`
to keep CMake's own choice (for example MSVC `cl` in a separate directory). Build defaults are
`BUILD_DIR=build/debug`, `BUILD_TYPE=Debug`, and native build tool parallelism
(override with `JOBS=N`); environment variables
`CMAKE`, `CTEST`, `CMAKE_ARGS`, and `CLANG_FORMAT` also override the corresponding tools/options.
`make-test.bat` configures with testing enabled, builds all targets, then runs CTest,
matching `make test` and propagating configuration, build, or test failures.
Clean removes repository-local `build/` and `cmake-build*/` directories.

Quality checks and formatting default to changed files: everything differing from `HEAD`
in the working tree, plus untracked files.

The quality tools live in the ignored `.venv-quality/` environment, pinned by
`tools/requirements-quality.txt`:
`python -m venv .venv-quality` then `.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt`
(`.venv-quality/bin/python` outside Windows).

- `cmake --build build/debug --target check-quality` runs Lizard on changed production
  C++ files and clang-tidy on changed translation units plus those including a changed
  header (from Ninja's recorded dependencies). Changes to `.clang-tidy`, `cmake/` or
  production `CMakeLists.txt`, or missing dependency data, check every translation unit.
  Set `CLAUSE_QUALITY_BASE` (for example `origin/master`) to compare with another base.
- `check-quality-all` (and `check-complexity-all`, `check-clang-tidy-all`) check every file.
- clang-tidy runs in batches of `4 x jobs` translation units and prints a passed/FAILED line
  after each; every batch runs, then the check fails if any batch did. To split a long run
  into shorter separate invocations, call the script directly with a shard, for example
  `cmake -DQUALITY_SCOPE=all -DQUALITY_BUILD_DIR=build/debug -DQUALITY_SHARD=1/4 -P cmake/CheckClangTidy.cmake`
  for the first quarter (`QUALITY_BATCH` and `QUALITY_JOBS` override the batch size and jobs;
  jobs default to half of the logical cores).
- `make format` / `make-format.bat` format changed C++ files; `make format-all` or
  `FORMAT_SCOPE=all make-format.bat` formats everything.

`clau.bat --help` builds first, then forwards all arguments to the selected
configuration's executable. Build failures stop execution; compiler input paths
remain relative to the caller's working directory, and its exit code is preserved.

For runtime development without downloading or using the LLVM C++ SDK, configure with
`cmake --preset windows -DCLAUSE_BUILD_COMPILER=OFF`; the same build/test presets
apply. Set the option back to `ON` when the SDK is available. MSVC `cl` is also
accepted in a separate build directory; MinGW is not supported for native Windows
development builds. Select x86 or x64 through the developer environment (or `-A`
with a Visual Studio generator), and use an LLVM SDK and runtime of that architecture.

The Windows default CRT is `/MDd` for Debug and `/MD` for other configurations,
including the static runtime library and its consumers. An explicit
`CMAKE_MSVC_RUNTIME_LIBRARY` setting is preserved; it must match the LLVM SDK and
all linked C++ libraries. Avoid mixing Debug and Release STL/CRT artifacts.
Windows project sources and CLI/path fixtures use UTF-8.

All project targets use C++23 and treat compiler warnings as errors.
The executable is `build/debug/bin/clau`. Build presets and wrappers request
parallel builds on Windows, Linux, and macOS using the native build tool's default
job count (`jobs: 0` in presets, `--parallel` in wrappers). Set an explicit limit
with `cmake --build --preset debug --parallel 8` or `JOBS=8` for the wrappers.
For a build directory without a preset, use `cmake --build <dir> --parallel`.
The Windows preset places the executable in `build/windows/bin/<Config>/clau.exe`
and the runtime in `build/windows/lib/<Config>/clause_runtime.lib`.

Alternatively, use `make build` to build only `clau` and its dependencies,
or `make test` to build and run the full test suite. For a different configuration:

```sh
make test BUILD_DIR=build/release BUILD_TYPE=Release JOBS=4
```

CMake discovers installed Boost and Erlang, including Homebrew installations.
Pass these options when configuring to override defaults:

| Option                                      | Purpose                                                       |
|---------------------------------------------|---------------------------------------------------------------|
| `-DCLAUSE_BOOST_ROOT=/path/to/boost`    | Select a Boost installation or full source tree               |
| `-DCLAUSE_TOML_ROOT=/path/to/tomlplusplus-3.4.0` | Select the pinned TOML dependency |
| `-DCLAUSE_OTP_AUDITS=ON` | Enable optional live OTP/reference audits; default is OFF |
| `-DCLAUSE_ESCRIPT=/path/to/bin/escript` | Select OTP 29+ for optional audits; unused by normal tests |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Select an installed Windows Clang executable |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Select an existing LLVM 23.1.x SDK (invalid explicit paths fail) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Require an installed SDK; disable automatic LLVM downloads |
| `-DBUILD_TESTING=ON`                        | Enable tests, helper executables and their Erlang dependency (default: OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF`           | Build only the runtime library                                |
| `-DCLAUSE_BUILD_RUNTIME=OFF`            | Build only the compiler                                       |

For multi-configuration generators, add `--config Debug` when building and
`-C Debug` when testing. CMake-aware IDEs can open the repository using the
`debug` preset, or the `windows` preset with a Visual Studio development toolchain.

Boost and toml++ headers use CMake `SYSTEM` includes, keeping warnings as errors
for project code. On native macOS builds, CMake also marks Homebrew's linked include
directory as `SYSTEM` when its Boost headers resolve to the selected installation.
This keeps inherited flags such as `CXXFLAGS=-I/opt/homebrew/include` from exposing
Boost warnings, including when that flag is already cached by CMake.
For other installations, avoid adding dependency paths through global `-I` flags (including
`CXXFLAGS`): an ordinary include path can take precedence over a dependency's
system path. If CLion reports Boost warnings as errors, remove those global flags
and clear the cached value, for example:

```sh
cmake -S . -B cmake-build-debug -DCMAKE_CXX_FLAGS:STRING=
```

Then reload CMake in CLion. Use the dependency root options above to select
installations instead of adding global include flags.
