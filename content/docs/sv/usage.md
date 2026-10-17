---
source: docs/usage.md
sourceCommit: a8c3f8f6
sourceSha256: 06562916f7abbce822d9a5ca87d42cc0b3306de611e06ebce33ca5b2bd10d101
translatedAt: 2026-10-17
---
# Använda kompilatorn

Bygg ett program från källfiler; ingången är den enda modul som exporterar
`main/1`, som tar emot kommandoradsargumenten som strängar:

```sh
clau -O2 -o demo examples/compile/answer.erl examples/compile/client.erl
./demo
clau -o app --entry app:start src/*.erl     # app:start/1, else app:start/0
```

På Windows lägger `-o` till `.exe` när sökvägen saknar filändelse. Utan `-o`
kompileras positionella indata i minnet och rapporterar endast diagnostik. Se
[körbara filer](executables.md) för val av ingång, argument, slutstatus och
länkning, och [exemplet med kompilerade moduler](../examples/compile/) för en
C++-värd som själv länkar de emitterade objekten.

Projekt beskriver mål i TOML; varje mål med en `output`- eller `entry`-nyckel
länkas till sin utdatafil (standard `build/<target>`), och utdata ersätts först
när alla valda mål har lyckats:

```sh
clau --new-project myapp                        # writes an annotated myapp.toml
clau --project myapp.toml                       # build every target
clau --project examples/project/project.toml --target app --parse-check
```

Se [projekt](projects.md) för manifestet, sökning efter källfiler, ignorerade
källfiler, byggkataloger och cacher.

Vanliga alternativ (`clau --help` listar alla):

| Alternativ | Syfte |
| --- | --- |
| `-o, --output PATH`, `--entry M[:F[/A]]` | Länka en körbar fil och välj dess ingång |
| `--project PATH`, `--target NAME` | Bygg ett TOML-projekt, eller valda mål |
| `-O0`, `-O2`, `-Os`, `--no-type-specialization` | Optimering (O0 som standard; O2 lägger till typspecialisering) |
| `-g`, `--lto`, `--keep-exports` | Radtabeller för felsökning, optimering vid länkning, behåll oåtkomliga exporter |
| `-I DIR`, `-D NAME[=TERM]`, `--app-dir APP=DIR` | Inkluderingssökvägar, makron, rötter för `include_lib` |
| `--enable-feature F`, `--disable-feature F` | OTP:s språkfunktioner (features) |
| `--parse-transform M`, `--transform-path DIR`, `--erl PATH\|none` | Parse transforms och den värd-OTP som kör dem |
| `--emit obj\|llvm-ir\|llvm-bc`, `--artifact-dir DIR` | Skriv en artefakt per modul (standardrot `build/aot`) |
| `--target-triple TRIPLE`, `--linker PATH`, `--runtime-library PATH` | Mål, länkdrivrutin och runtime-arkiv |
| `--build-dir DIR`, `--no-cache`, `--cache-inference-in-dirs PAT` | Temporära filer och byggcacher |
| `--verbose`, `--print-stage-times` | Spåra faser; mät tiden för varje steg på stderr |

Inspektionsåtgärder skriver till stdout och kompilerar inga körbara filer:

| Alternativ | Skriver ut |
| --- | --- |
| `--preprocess-check`, `--parse-check` | Ingenting; endast diagnostik |
| `--print-pp`, `--print-ast`, `--print-source`, `--print-abstr` | Förbehandlad källkod, syntaxträd, källkod, OTP:s abstrakta format |
| `--print-inputs` | Varje källfil i batchen, inklusive biblioteksmoduler som lagts till via referens |
| `--print-env` | Den lösta kompileringsmiljön som TOML |
| `--print-types` | Källkod annoterad med härledda typer |
| `--print-ir`, `--print-optimized-ir`, `--print-asm` | IR före/efter LLVM-optimering, assembler med IR- och Erlang-kommentarer |

`clau` avslutas med 0 vid lyckat utfall (även med varningar), 1 för fel i
källkod eller projekt och 2 för användningsfel. Detaljer:
[kompilering](compile.md), [förbehandling](preprocessor.md),
[parser](parser.md).

Parse transforms (`-compile({parse_transform, M})`) körs på en Erlang/OTP 29
som är installerad på värden (`erl` i `PATH`, eller `--erl`), så som `erlc`
skulle göra; endast kompileringen behöver OTP, aldrig den körbara filen. Andra
transformer än OTP:s egna måste först kompileras till `.beam`
([parse transforms](transforms.md)).

### Runtime-alternativ

Program läser runtime-alternativ från miljövariabeln `CLAUSE_FLAGS` och från
inledande kommandoradsargument, fram till det första andra argumentet eller
`--`:

```sh
./demo --schedulers 4 --max-heap 100000000 -- arg1 arg2
```

`--schedulers N`, `--max-atoms N`, `--max-heap BYTES`, `--max-stack BYTES`,
`--max-memory BYTES` och `--profile FILE` beskrivs i
[runtime-alternativ](executables.md#runtime-options).
