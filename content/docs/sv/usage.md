---
source: docs/usage.md
sourceCommit: 6ed3851c
sourceSha256: d4118cc040e610cc84df916720e96a6009b90b6a1cbfe086434dc5800fe49461
translatedAt: 2026-10-15
---
# Använda kompilatorn

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

På macOS bygger `./run-macos.sh --parse-check examples/project/src/main.erl`
först och kör sedan den senaste körbara filen, med alla argument oförändrade.
Det godtar åsidosättningar via miljövariablerna `TOOL_BUILD_DIR`, `BUILD_TYPE` och
`JOBS`.

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
  --print-asm              Print each module's assembly with IR and Erlang source comments
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
  --cache-inference-in-dirs <pattern>  Cache inference results of modules in matching directories (besides OTP's)
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

Citera sökvägar som innehåller mellanslag och makrovärden som innehåller
skalets skiljetecken:

```sh
./build/debug/bin/clau --parse-check -I include '-DVERSION={1,0}' \
  --app-dir myapp=examples/project examples/project/src/main.erl
```

Kontrollägen är tysta vid lyckat utfall; diagnostik går till stderr.
Utskriftslägen skriver till stdout och kan kombineras: `--print-pp --print-ast`
skriver ut källkoden före trädet för varje indatafil. Att lägga till
`--preprocess-check` stänger inte av den tolkning som begärs av `--parse-check`
eller `--print-ast`. Fel kan lämna ofullständig utskrift.

Utan kontroll-/utskriftsåtgärd kör källfiler och `--project` hela kedjan till
verifierade inbyggda objektbuffertar i minnet. Positionella indata bildar en
batch; varje projektmål bildar en egen batch. `--emit` skriver artefakter under
`build/aot` eller `--artifact-dir`; projekt lägger till ett kodat målnamn och
använder en standardrot relativ till manifestet. Filnamnen kodar modulens
identitet. `-o PATH` länkar positionella indata, eller ett valt projektmål, till
en körbar fil med Clang och runtime-biblioteket (ingång:
`--entry MODULE[:FUNCTION]`, manifestets `entry`, eller den enda modul som
exporterar `main/1`). Utan `-o` länkas projektmål med en `output`- eller
`entry`-nyckel till sin `output` i TOML (standard `build/<target>`), och
publiceras först när alla valda mål har länkats.
Se [körbara filer](executables.md) för kontraktet om ingång, argument och
slutstatus.

```sh
clau -O2 -o demo answer.erl client.erl && ./demo
clau -O2 --emit obj answer.erl client.erl
clau --print-ir --print-optimized-ir -O2 answer.erl
clau --print-asm -O2 answer.erl
clau --print-types answer.erl client.erl
```

IR-inspektion tillåter båda stegen tillsammans och stannar före generering av
objekt. Flera ögonblicksbilder är separata moduler; använd `--emit llvm-ir` för
enskilda assemblerfiler.
`--print-asm` skriver ut varje moduls målassembler där varje följd av
instruktioner kommenteras med den IR-instruktion och Erlang-rad den kommer från
([assemblerlistningar](compile.md#assembly-listings)).
Typinspektion stannar före LLVM och skriver ut varje modul som källkod med
härledda funktionssignaturer och avslutande kommentarer `% Type` på varje rads
yttersta uttryck.
Den godtar alternativ för preprocessor, projekt och utförlighet, men avvisar
andra åtgärder, utdatadestinationer och backend-policy. Se
[kompileringsalternativ](compile.md).

`--verbose` skriver ut `[pp] <filename>` för källfiler och lösta
preprocessorinkluderingar, och `[parse] <filename>` när varje källfil går in i
parsern. Nästlade inkluderingar och biblioteksinkluderingar spåras när de
laddas; inaktiva inkluderingar hoppas över.
Parsern konsumerar expanderade token stegvis, så dess spårning kan komma före
spårningen av inkluderingar. `[comp]` lägger till semantiska faser och
backend-faser samt beslut om begränsad specialisering när de startar. Spårning
går till stderr i varje läge, även för projekt.

`--print-stage-times` skriver ut `[time] <stage> <subject>: <milliseconds> ms`
på stderr när varje steg avslutas: `preprocess` (läsning och förbehandling),
`parse` och, för moduler som använder parse transforms, `transform` (körningen
av värdens `erl` och importen av dess former) per källfil, `compile` (analys
till och med generering av objekt) en gång per batch, med antal moduler och
projektmål, och `link` per körbar fil, med dess slutliga sökväg. Parsern hämtar
former från preprocessorn, så de två tiderna per fil mäts separat medan de
varvas.

Slutstatus: **0** vid lyckat utfall (även med varningar), **1** för fel i
källkod/projekt, **2** för användningsfel eller okända målnamn.
Varje indatafil har ett oberoende preprocessortillstånd; varje källfel får hela
kommandot att misslyckas.

Syntaxkontroller validerar inte semantik och kör inte parse transforms.
Kontroll-/utskriftslägen skapar inga utdatafiler och avvisar `-o`/`--output`.
Standardkompilering utan `-o` skriver ingen körbar fil.

Se [preprocessorn](preprocessor.md), [användning av parsern](parser.md) och
[valideringsstatus](validation.md) för mer information.

## Projekt

Kör det medföljande exemplet med två mål:

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target app
./build/debug/bin/clau --preprocess-check --project examples/project/project.toml --target tests --target app
```

Skapa ett annoterat projekt i en befintlig katalog:

```sh
mkdir -p build/project-demo
./build/debug/bin/clau --new-project build/project-demo/demo
mkdir -p build/project-demo/src
cp examples/project/src/main.erl build/project-demo/src/main.erl
./build/debug/bin/clau --parse-check --project build/project-demo/demo.toml
```

Skapandet skriver endast den begärda TOML-filen och vägrar befintliga
destinationer. Startfilen innehåller ett mål `app` som använder `src`, med alla
frontend-alternativ på sina standardvärden. Lägg till källfiler innan den
kontrolleras.

Manifestsökvägar är relativa till TOML-filen; CLI-sökvägar är relativa till
anropskatalogen. Alla mål körs som standard. Upprepa `--target` för att välja
en ordnad delmängd; upprepade val körs en gång. `sources` stöder literala
filnamn och mönstren `*`, `?`, `**`; `source_dirs` hittar rekursivt `.erl`-filer.
Söksökvägar för källfiler lokaliserar endast explicit listade filer.
CLI:ns include-sökvägar har företräde, CLI:ns applikationsrötter ersätter
matchande namn, CLI:ns funktionsinställningar tillämpas sist, och dubblerade
makrodefinitioner förblir fel.

Se [projektformat och arbetsflöden](projects.md). Projekt stöder varje
CLI-åtgärd; generering av körbara filer är fortfarande inte implementerad.

Den [tillåtna guard-katalogen](guards.md) innehåller kontrollerad
`is_integer/3`, kvalificerade anrop och äldre tester på toppnivå;
process-/nodidentiteter och identiteter för native records behåller explicit
förmågediagnostik.
