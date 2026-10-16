# Using the compiler

Build a program from sources; the entry is the only module exporting `main/1`,
which receives the command-line arguments as strings:

```sh
clau -O2 -o demo examples/compile/answer.erl examples/compile/client.erl
./demo
clau -o app --entry app:start src/*.erl     # app:start/1, else app:start/0
```

On Windows `-o` adds `.exe` when the path has no extension. Without `-o`,
positional inputs compile in memory and report diagnostics only. See
[executables](executables.md) for entry selection, arguments, exit status
and linking, and [the compiled-module example](../examples/compile/) for a C++ host
that links emitted objects itself.

Projects describe targets in TOML; each target with an `output` or `entry` key
links to its output (default `build/<target>`), and outputs are replaced only
after every selected target succeeded:

```sh
clau --new-project myapp                        # writes an annotated myapp.toml
clau --project myapp.toml                       # build every target
clau --project examples/project/project.toml --target app --parse-check
```

See [projects](projects.md) for the manifest, source discovery, ignored
sources, build directories and caches.

Common options (`clau --help` lists all):

| Option | Purpose |
| --- | --- |
| `-o, --output PATH`, `--entry M[:F[/A]]` | Link an executable and choose its entry |
| `--project PATH`, `--target NAME` | Build a TOML project, or selected targets |
| `-O0`, `-O2`, `-Os`, `--no-type-specialization` | Optimization (O0 default; O2 adds type specialization) |
| `-g`, `--lto`, `--keep-exports` | Debug line tables, link-time optimization, keep unreachable exports |
| `-I DIR`, `-D NAME[=TERM]`, `--app-dir APP=DIR` | Include paths, macros, `include_lib` roots |
| `--enable-feature F`, `--disable-feature F` | OTP language features |
| `--parse-transform M`, `--transform-path DIR`, `--erl PATH\|none` | Parse transforms and the host OTP running them |
| `--emit obj\|llvm-ir\|llvm-bc`, `--artifact-dir DIR` | Write one artifact per module (default root `build/aot`) |
| `--target-triple TRIPLE`, `--linker PATH`, `--runtime-library PATH` | Target, link driver and runtime archive |
| `--build-dir DIR`, `--no-cache`, `--cache-inference-in-dirs PAT` | Temporary files and build caches |
| `--verbose`, `--print-stage-times` | Trace phases; time each stage on stderr |

Inspection actions print to stdout and do not compile executables:

| Option | Prints |
| --- | --- |
| `--preprocess-check`, `--parse-check` | Nothing; diagnostics only |
| `--print-pp`, `--print-ast`, `--print-source`, `--print-abstr` | Preprocessed source, syntax tree, source, OTP abstract format |
| `--print-inputs` | Every source of the batch, including library modules added by reference |
| `--print-env` | The resolved compile environment as TOML |
| `--print-types` | Source annotated with inferred types |
| `--print-ir`, `--print-optimized-ir`, `--print-asm` | IR before/after LLVM optimization, assembly with IR and Erlang comments |

`clau` exits with 0 on success (warnings included), 1 for source or project
errors and 2 for usage errors. Details: [compilation](compile.md),
[preprocessing](preprocessor.md), [parser](parser.md).

Parse transforms (`-compile({parse_transform, M})`) run on an Erlang/OTP 29
installed on the host (`erl` on `PATH`, or `--erl`), as `erlc` would; only the
compile needs OTP, never the executable. Transforms other than OTP's own must be
compiled to `.beam` first ([parse transforms](transforms.md)).

### Runtime options

Programs read runtime options from the `CLAUSE_FLAGS` environment variable and
from leading command-line arguments, up to the first other argument or `--`:

```sh
./demo --schedulers 4 --max-heap 100000000 -- arg1 arg2
```

`--schedulers N`, `--max-atoms N`, `--max-heap BYTES`, `--max-stack BYTES`,
`--max-memory BYTES` and `--profile FILE` are described in
[runtime options](executables.md#runtime-options).
