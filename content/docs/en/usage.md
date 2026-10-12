# Using the compiler

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

On macOS, `./run-macos.sh --parse-check examples/project/src/main.erl` builds first
and runs the latest executable, passing all arguments unchanged. It accepts `TOOL_BUILD_DIR`,
`BUILD_TYPE` and `JOBS` environment overrides.

```text
clau [options] <source.erl>...
  --project <path>        Read a TOML project instead of positional sources
  --target <name>         Select a target; repeat for more (default: all)
  --new-project <filename>  Create an annotated starter; append .toml when needed
  --preprocess-check       Check preprocessing only
  --parse-check            Preprocess and check syntax
  --print-pp               Print expanded Erlang source
  --print-ast              Print an indented syntax tree
  --print-source           Print each module as Erlang source
  --print-abstr            Print each module as OTP abstract format forms
  --parse-transform <mod>  Apply a parse transform to every module
  --transform-path <dir>   Directory of precompiled transform modules (.beam)
  --erl <path|none>        Host Erlang/OTP 29 erl that runs parse transforms
  --print-inputs           List the batch's sources, including modules added by reference; do not compile
  --print-env              Print the resolved compile environment as TOML and exit
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  -g                      Emit Erlang line tables; executables keep them for debuggers
  --lto                   Link modules as bitcode with link-time optimization (LLD targets)
  --keep-exports          Keep every export of an executable callable (default: unreachable ones left out)
  --build-dir <dir>       Keep temporary files and caches below <dir> (projects default: <manifest-dir>/build)
  --no-cache              Neither read nor write build caches
  --verbose               Trace files and compilation phases to stderr
  --print-stage-times     Print preprocess/parse/transform time per file, compile time per batch and link time to stderr
  -I, --include <dir>      Add an include directory (last supplied searched first)
  -D, --define <name[=term]>  Define a macro (default value: true)
  --app-dir <app=dir>      Set an include_lib application directory
  --enable-feature <name>  Enable a language feature
  --disable-feature <name> Disable a language feature
  -h, --help              Show all options
  --version               Show version
  --                      Treat remaining arguments as input paths
```

Quote paths containing spaces and macro values containing shell punctuation:

```sh
./build/debug/bin/clau --parse-check -I include '-DVERSION={1,0}' \
  --app-dir myapp=examples/project examples/project/src/main.erl
```

Check modes are silent on success; diagnostics go to stderr. Print modes write
to stdout and can be combined: `--print-pp --print-ast` prints source before the
tree for each input. Adding `--preprocess-check` does not disable parsing requested
by `--parse-check` or `--print-ast`. Errors may leave partial printed output.

With no check/print action, source inputs and `--project` run the complete pipeline
through verified native object buffers in memory. Positional inputs form one batch;
each project target forms its own batch. `--emit` writes artifacts under `build/aot`
or `--artifact-dir`; projects append an encoded target name and use a manifest-relative
default root. Filenames encode module identity. `-o PATH` links positional inputs, or one
selected project target, into an executable with Clang and the runtime library (entry:
`--entry MODULE[:FUNCTION]`, manifest `entry`, or the only module exporting `main/1`). Without
`-o`, project targets with an `output` or `entry` key link to their TOML `output` (default
`build/<target>`), publishing only after every selected target linked.
See [executables](executables.md) for the entry, argument and exit-status contract.

```sh
clau -O2 -o demo answer.erl client.erl && ./demo
clau -O2 --emit obj answer.erl client.erl
clau --print-ir --print-optimized-ir -O2 answer.erl
clau --print-types answer.erl client.erl
```

IR inspection allows both stages together and stops before object emission. Multiple
snapshots are separate modules; use `--emit llvm-ir` for individual assembly files.
Type inspection stops before LLVM and prints each module as source with inferred
function signatures and trailing `% Type` comments on each line's outermost expression. It accepts preprocessing/project/verbosity options, but rejects other
actions, output destinations and backend policy. See [compilation options](compile.md).

`--verbose` prints `[pp] <filename>` for source files and resolved preprocessor
includes, and `[parse] <filename>` when each source enters the parser. Nested and
library includes are traced as they are loaded; inactive includes are skipped.
The parser consumes expanded tokens incrementally, so its trace can precede include
traces. `[comp]` adds semantic/backend phases and bounded specialization decisions
as they start. Tracing goes to stderr in every mode, including projects.

`--print-stage-times` prints `[time] <stage> <subject>: <milliseconds> ms` on stderr as each stage
finishes: `preprocess` (reading and preprocessing), `parse` and, for modules using parse transforms,
`transform` (the host `erl` run and import of its forms) per source file, `compile` (analysis
through object emission) once per batch, naming its module count and project target, and `link` per
executable, naming its final path. The parser pulls forms from the preprocessor, so the two per-file
times are measured separately while they interleave.

Exit codes: **0** for success (including warnings), **1** for source/project errors,
**2** for usage errors or unknown target names.
Each input has independent preprocessing state; any source error makes the overall command fail.

Syntax checks do not validate semantics or execute parse transforms. Check/print
modes do not create output files and reject `-o`/`--output`. Default compilation
without `-o` writes no executable.

See [preprocessing](preprocessor.md), [parser usage](parser.md) and
[validation status](validation.md) for further details.


## Projects


Run the included two-target example:

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target app
./build/debug/bin/clau --preprocess-check --project examples/project/project.toml --target tests --target app
```

Create an annotated project in an existing directory:

```sh
mkdir -p build/project-demo
./build/debug/bin/clau --new-project build/project-demo/demo
mkdir -p build/project-demo/src
cp examples/project/src/main.erl build/project-demo/src/main.erl
./build/debug/bin/clau --parse-check --project build/project-demo/demo.toml
```

Creation writes only the requested TOML file and refuses existing destinations.
The starter contains one `app` target using `src`, with all frontend options at
their defaults. Add source files before checking it.

Manifest paths are relative to the TOML file; CLI paths are relative to the
invocation directory. All targets run by default. Repeat `--target` to choose an
ordered subset; repeat selections run once. `sources` supports literal filenames
and `*`, `?`, `**` patterns; `source_dirs` recursively discovers `.erl` files.
Source search paths only locate explicitly listed files. CLI include paths take
precedence, CLI application roots replace matching names, CLI feature settings
apply last, and duplicate macro definitions remain errors.

See [project format and workflows](projects.md). Projects support every
CLI action; executable generation remains unimplemented.

The [admitted guard catalog](guards.md) includes checked
`is_integer/3`, qualified calls and top-level legacy tests; process/node and native
record identities retain explicit capability diagnostics.
