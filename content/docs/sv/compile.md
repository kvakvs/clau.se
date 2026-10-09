---
source: docs/compile.md
sourceCommit: 06042fa
sourceSha256: 6cf8b5c873d19e18501458078ca8c8ceb51da4da995693046af31ca5a78824b4
translatedAt: 2026-10-09
---
# Kompilering

`clau` kompilerar Erlang/OTP 29-moduler via LLVM till verifierad IR, bitkod
eller inbyggda objektfiler. `-o/--output` länkar positionella indata (eller ett
valt projektmål), deras [ingångs](executables.md)-startobjekt och runtime till
en körbar fil ([länkning](executables.md#linking)); projektbyggen länkar körbara
mål till utdata i deras manifest ([projekt](projects.md#executables)). Genererade
objekt kan också köras genom en C++-testrigg länkad med runtime (se exemplet
nedan).

## Godtagen delmängd av källkoden

Namngivna moduler med exporter och ordnade funktionsklausuler. Huvuden och
matchningar i kroppar godtar variabler, `_`, alias, upprepade namn och mönster
över atomer, godtyckliga heltal, ändliga flyttal, tupler, listor/strängar, maps,
bitstrings och vanliga tupel-records. Kroppar är sekvenser av matchningar,
konstruktorer, kontrollerade operatorer/guard-BIF:ar, `erlang:display/1`
([utskrift](terms.md#printing)), `halt/0,1`
([slutstatus](executables.md#exit-status)), de felgivande
`error/1,2,3`, `exit/1`, `throw/1` och `erlang:raise/3`
([ABI](abi.md#failure-channel-revision-2)), övriga
[inbyggda funktioner i bryggan](builtins.md) (`erlang:function_exported/3`) och funs av
inbyggda funktioner, `case`/`if`, `catch Expr`,
`try ... of ... catch Class:Reason:Stack ... after` med
[stackspårningar](abi.md#stack-traces), `maybe ... else ... end`, list-, binary- och map-comprehensions
([mönster](patterns.md#comprehensions)) samt direkta lokala anrop eller
literala fjärranrop inom batchen, inklusive själv-, ömsesidig och
modulöverskridande rekursion på explicita processramar med äkta svansanrop
([exekveringsmodell](execution-model.md#implementation)); kroppsrekursion
begränsas av processtacken (obegränsad som standard), inte av den inbyggda
stacken. Guards stöder hela den tillåtna
katalogen. Se [mönster](patterns.md), [guards](guards.md) och [termer](terms.md).

Funktionsvärden `fun F/A`, `fun M:F/A`, anonyma och namngivna funs med
infångade variabler, anrop av funs och dynamiska anrop (`M:F(...)`, `apply/2,3`)
körs ([funs](funs.md)). Avvisas med diagnostik även i oanvända funktioner:
`receive`, funs av inbyggda funktioner,
processer och meddelandehantering.
Godtagna attribut: `module`, `export`, `file`, tupel- och native-`record`,
`export_record`, `import_record`, typ-/spec-former,
`doc`/`moduledoc`, `author`, `vsn`, `copyright`, `deprecated`,
`-compile` med `{no_auto_import, ...}` eller `nowarn_*`-alternativ som bara
påverkar varningar (till exempel `nowarn_deprecated_catch`) och `-import` av
guard-BIF:ar från `erlang`. Andra attribut (`on_load`, parse transforms, andra
`compile`-alternativ, parametriserade moduler) avvisas.
Källfiler som börjar med `#!` följer [reglerna för escripts](executables.md#escripts)
(implicit modul och export av `main/1`, `-mode` godtas).
Typ-/spec-former analyseras men ändrar aldrig genererad kod. Rena syntaxlägen
(`--parse-check`, `--print-ast`, `--print-source`, ...) godtar hela grammatiken.

## Kör exemplet med kompilerade moduler

`client:main/1` gör exemplet till ett program:

```sh
./build/debug/bin/clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo     # prints 42, -7 and {record,map,binary,list,integer,other}
```

Samma moduler kan också köras genom en C++-testrigg. Från ett Windows x64
Developer PowerShell med den byggda kompilatorn:

```powershell
$tool = './build/debug/bin/clau.exe'
& $tool -O0 --emit obj --artifact-dir build/example-aot examples/compile/answer.erl examples/compile/client.erl
cmake -S examples/compile -B build/example-native -G Ninja -DCMAKE_CXX_COMPILER=clang-cl -DCMAKE_BUILD_TYPE=Debug "-DGENERATED_DIR:PATH=$((Resolve-Path build/example-aot).Path)"
cmake --build build/example-native
./build/example-native/bin/Debug/compiled_modules.exe
```

Det skriver ut `42`, `-7`, `record`, `map`, `binary`, `list`, `integer`,
`other`, en per rad. Testriggen registrerar moduler explicit, skapar en kontext
och avkodar resultat; den är ett exempel på en värd, inte en ingångspunkt för
produktion. På Unix används `build/debug/bin/clau`, `clang++` och
`-DGENERATED_DIR="$PWD/build/example-aot"` (inbyggda körningar där är ännu inte
validerade).

Andra åtgärder på samma källfiler:

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

## Utskrift av källkod

`--print-source` (en frontend-åtgärd, som `--print-ast`) skriver ut varje
tolkad modul som Erlang-källkod; `--print-types` skriver ut samma text med
typannoteringar. Utskrivaren (`print_source`, `expression_source`, `type_source`
i `printing.hpp`; `compiler/src/printing/source_*`) är återanvändbar:

- Former följer varandra i källkodsordning, med en tom rad kring varje funktion;
  den `-file`-form som preprocessorn lägger före en modul utelämnas, de kring
  inkluderade filer behålls.
- Texten är den tolkade syntaxen: makron är expanderade, inkluderingar
  infogade, och kommentarer, ursprunglig stavning och layout är borta. Klausuler
  och blockuttryck (`case`, `if`, `receive`, `try`, `maybe`, `begin`, funs med
  mer än en rad) får indragna rader med fyra kolumner; allt annat står på en
  rad. Parenteser kommer endast från källkodens egna grupperingar.
- Utskriven text tolkas tillbaka till samma syntaxträd, och att skriva ut den
  igen ger samma text (CTest `printing_source` över de tolkningsbara
  fixturerna).
- `SourceNotes` lägger till en annotering till ett uttryck, utskriven som
  `Expression :: Text` (inom parentes om det inte är ett helt kroppsuttryck;
  inte Erlang), och kommentarsrader ovanför en form. Mönster, guards och
  vänstersidan av en matchning får inga.

## Alternativ

| Alternativ | Beteende |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publicera en artefakt per modul |
| `--artifact-dir DIR` | Artefaktrot (kräver `--emit`) |
| `-o PATH` / `--output PATH` | Länka en körbar fil ([länkning](executables.md#linking)); i konflikt med `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Clang-drivrutin och runtime-arkiv för `-o` |
| `--entry MODULE[:FUNCTION]` | Den körbara filens ingångsfunktion/1; valideras i varje kompileringsläge och lägger till startartefakten `clausev1_start` ([körbara filer](executables.md#startup-object)) |
| `--target-triple TRIPLE` | Målmaskin; `--target` väljer projektmål |
| `-O0` / `-O2` / `-Os` | Generisk standardkod + LLVM O0 / begränsad specialisering + LLVM O2 / LLVM Os, ingen specialisering, en sektion per symbol och länkarens borttagning av orefererad kod och data |
| `--no-type-specialization` | Stäng av varianter oavsett alternativens ordning |
| `--print-ir` / `--print-optimized-ir` | Verifierad IR före/efter LLVM-pass, med Erlang-källrader som kommentarer |
| `--print-types` | Varje modul som Erlang-källkod annoterad med härledda typer ([semantik](semantic.md#--print-types)); stannar före LLVM |
| `--verbose` | Fashändelserna `[pp]`, `[parse]` och `[comp]` på stderr |
| `--impldebug n[,n...]` | Felsökningsutdata för implementationssteg på stderr (t.ex. `23`: sammanfattningar av typhärledning) |

- Utan `--emit` verifierar kompileringen objekten i minnet och skriver ingenting.
- Positionella indata bildar en batch; varje projektmål är en egen batch.
- Artefaktrötter: `build/aot` (positionella) eller `build/aot/<hex-target>` under
  manifestkatalogen. Explicita rötter är relativa till anropet.
- Namn är reversibel hex: `answer` → `clausev1_616e73776572__0.obj` (`.o` för
  ELF/Mach-O, `.ll`, `.bc`); startobjektet är `clausev1_start.obj`.
- Alla batcher kompileras och förbereds före publicering. Fel publicerar
  ingenting och behåller tidigare utdata; ersättning är atomisk per fil, inte
  per batch.
- `--emit` är i konflikt med `-o`; kompileringsflaggor är i konflikt med rena
  frontend-åtgärder och `--new-project`. `--print-types` avvisar mål- och
  optimeringsalternativ.
- IR-ögonblicksbilder är LLVM-assembler; flera ögonblicksbilder separeras av
  skyddade kommentarshuvuden och utgör inte en tolkningsbar modul. Använd
  `--emit llvm-ir` som indata till verktyg. Kommentarer med källrader visar
  originaltexten (oexpanderade makron) och överlever optimering via
  felsökningsplatser.

## Backend

- En LLVM-kontext och målmaskin per batch. Värdtripeln använder värdens CPU och
  funktioner; främmande tripler använder den generiska CPU:n. PIC, liten
  kodmodell.
- Backends: X86, ARM, AArch64 (snittet med SDK:n). Okända eller saknade
  backends misslyckas; det finns ingen reserv till värden.
- Verifiering körs före och efter optimering; den kontrollerar IR:ens giltighet,
  inte Erlang-korrekthet.
- Budgetar per mål: 1 024 moduler, 250 000 AST-noder per modul, 1 000 000 per
  batch. Serialiserad utdata: 64 MiB per modul, 256 MiB per batch. Att
  överskrida en budget är en vanlig resursdiagnostik.

## LLVM SDK

Stabil LLVM **23.1.x**, minst 23.1.1. LLVM är ett värdberoende: arkitektur,
C++-standardbibliotek och Windows CRT måste matcha kompilatorverktyget.
Projektkoden behåller undantag/RTTI; inget undantag får avvecklas genom LLVM.
Runtime använder aldrig LLVM.

- Sökningen genomsöker standardprefix (`/usr`, `/usr/local`, `/opt/homebrew`,
  `/opt/local`, `/opt/llvm`, Linuxbrew, `/Library/Developer/Toolchains`,
  Program Files på Windows), inklusive versionerade layouter. Byggträd avvisas.
- `LLVM_DIR` väljer en SDK explicit; ogiltiga val misslyckas utan reserv.
- Om ingen hittas laddar CMake ned det fastlåsta **23.1.2**-arkivet (SHA-256
  kontrollerad) till `thirdparty/` för Windows x64/ARM64, Linux x64/ARM64 eller
  macOS ARM64. `CLAUSE_DOWNLOAD_LLVM=OFF` stänger av nedladdningar.
- En länkprob vid konfigurering kontrollerar ABI-kompatibilitet.

Referensuppsättning för Windows x64 (2026-09-29): värdens clang-cl 23.1.2 i
`C:/Program Files/LLVM/bin`, SDK `thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`,
Visual Studio 18 x64-verktyg, Windows SDK 10.0.26100.0, Ninja, `/MT`,
`_ITERATOR_DEBUG_LEVEL=0`. Automatiskt val tillämpar `/MT`- och
iteratorinställningarna; en explicit `LLVM_DIR` gör det inte, och länkproben
misslyckas då.

Historisk referens för macOS: Homebrew `llvm` 23.1.1_1 (arm64, delad
`libLLVM.23.1.dylib`, assertions avstängda) med AppleClang 21.

Övriga förutsättningar: CMake ≥ 3.28, en C++23-kompilator, Boost ≥ 1.90, toml++
3.4.0 och kvalitetsverktygen. OTP behövs endast för valfria granskningar och
återskapande av fixturer.
