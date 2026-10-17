---
source: docs/compile.md
sourceCommit: a8c3f8f6
sourceSha256: 070de594787444f6afefbf3760848986bda8c85ff204932e596a67502385ae50
translatedAt: 2026-10-17
---
# Kompilering

`clau` kompilerar Erlang/OTP 29-moduler via LLVM till verifierad IR, bitkod
eller inbyggda objektfiler. `-o/--output` länkar positionella indata (eller ett
valt projektmål), deras [ingångs](executables.md)-startobjekt och runtime till
en körbar fil ([länkning](executables.md#linking)); projektbyggen länkar
körbara mål till utdata i deras manifest ([projekt](projects.md#executables)).
Genererade objekt kan också köras genom en C++-testrigg länkad med runtime (se
exemplet nedan).

## Godtagen delmängd av källkoden

Namngivna moduler i det vanliga OTP 29-språket: ordnade funktionsklausuler med
[mönster](patterns.md) och [guards](guards.md); matchningar, konstruktorer,
operatorer och inbyggda funktioner ([inbyggda funktioner](builtins.md));
`case`, `if`, `receive`, `catch`,
`try ... of ... catch Class:Reason:Stack ... after` med
[stackspårningar](abi.md#stack-traces), `maybe ... else ... end`; list-,
binary- och map-comprehensions ([mönster](patterns.md#comprehensions));
tupel-records och [native records](native-records.md); [funs](funs.md),
lokala, fjärr- och dynamiska anrop (`M:F(...)`, `apply/2,3`);
[processer](processes.md) och [portar](ports.md). Anrop körs på explicita
processramar med äkta svansanrop
([exekveringsmodell](execution-model.md#implementation)); kroppsrekursion
begränsas av processtacken (obegränsad som standard), inte av den inbyggda
stacken. Moduler som en batch namnger men inte deklarerar kommer från
[biblioteket](library.md). Matchningskvalificerare i comprehensions från den
experimentella funktionen `compr_assign` avvisas som
`[heap expressions] notimpl`.

Godtagna attribut: `module`, `export`, `file`, tupel- och native-`record`,
`export_record`, `import_record`, typ-/spec-former, `doc`/`moduledoc`,
`behaviour`/`behavior` ([behaviours](semantic.md#behaviours)), varje
informativt attribut (`vsn`, `author`, `copyright`, `deprecated`, `dialyzer`,
användardefinierade `-name(Term)`; behålls för
[`module_info(attributes)`](semantic.md#predefined-functions)),
`-import(Module, [F/A, ...])` ([importer](semantic.md#imports)) och `-compile`
med alternativ som inte ändrar något som Clause genererar:
`{no_auto_import, ...}`, varningsalternativ (`nowarn_*`, `warn_*`,
`{nowarn_unused_function, [...]}`) samt tips om optimering, felsökning och
rapportering (`inline`, `{inline, [F/A]}`, `{inline_size, N}`,
`{inline_effort, N}`, `inline_list_funcs`, `debug_info`, `deterministic`,
`report*`, `verbose`, ...). `{parse_transform, Module}` kör transformen på
värdens Erlang/OTP före analysen ([parse transforms](transforms.md)).
`on_load`, `nifs`, `export_all`, andra `compile`-alternativ och
parametriserade moduler avvisas; diagnostiken namnger dem, till exempel
`[behavior-changing attributes] notimpl [module="m" operation="-compile option export_all"]`.
Varje modul får `module_info/0,1`. Källfiler som börjar med `#!` följer
[reglerna för escripts](executables.md#escripts) (implicit modul och export av
`main/1`, `-mode` godtas). Typ-/spec-former analyseras men ändrar aldrig
genererad kod. Rena syntaxlägen (`--parse-check`, `--print-ast`,
`--print-source`, ...) godtar hela grammatiken.

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
`-DGENERATED_DIR="$PWD/build/example-aot"`. CTest `codegen_examples` kör dessa
kommandon för varje policy.

Andra åtgärder på samma källfiler:

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

## Utskrift av abstrakt format

`--print-abstr` (en frontend-åtgärd) skriver ut varje tolkad modul som de
former i OTP:s
[abstrakta format](https://www.erlang.org/doc/apps/erts/absform.html) som
`epp` skulle lämna till en parse transform, en `file:consult/1`-term per rad,
samma termer som `erlc +to_abstr` skriver ([transforms](transforms.md)).

## Utskrift av källkod

`--print-source` (en frontend-åtgärd, som `--print-ast`) skriver ut varje
tolkad modul som Erlang-källkod; `--print-types` skriver ut samma text med
typannoteringar. Utskrivaren (`print_source`, `expression_source`,
`type_source` i `printing.hpp`; `compiler/src/printing/source_*`) är
återanvändbar:

- Former följer varandra i källkodsordning, med en tom rad kring varje
  funktion; den `-file`-form som preprocessorn lägger före en modul utelämnas,
  de kring inkluderade filer behålls.
- Texten är den tolkade syntaxen: makron är expanderade, inkluderingar
  infogade, och kommentarer, ursprunglig stavning och layout är borta.
  Klausuler och blockuttryck (`case`, `if`, `receive`, `try`, `maybe`,
  `begin`, funs med mer än en rad) får indragna rader med fyra kolumner; allt
  annat står på en rad. Parenteser kommer endast från källkodens egna
  grupperingar.
- Utskriven text tolkas tillbaka till samma syntaxträd, och att skriva ut den
  igen ger samma text (CTest `printing_source` över de tolkningsbara
  fixturerna).
- `SourceNotes` lägger till en anteckning till ett uttryck, utskriven som en
  avslutande kommentar `% Text` efter skiljetecknen på raden där uttrycket
  slutar, och kommentarsrader ovanför en form. Endast uttryck som utgör hela
  rader får anteckningar (kroppsuttryck och det värde som en `case` granskar;
  en per rad, det yttersta), så att långa nästlade uttryck förblir läsbara och
  texten förblir Erlang. Mönster och guards får inga.

## Alternativ

| Alternativ | Beteende |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publicera en artefakt per modul |
| `--artifact-dir DIR` | Artefaktrot (kräver `--emit`) |
| `-o PATH` / `--output PATH` | Länka en körbar fil ([länkning](executables.md#linking)); i konflikt med `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Clang-drivrutin och runtime-arkiv för `-o` |
| `--no-cache` | Varken läs eller skriv [byggcacher](projects.md#build-caches) |
| `--cache-inference-in-dirs PATTERN` | Kan upprepas: moduler i matchande kataloger behåller sina inferensresultat i byggcachen, utöver de implicita OTP-applikationskatalogerna ([inferenscache](projects.md#inference-cache)) |
| `--build-dir DIR` | Där Clause håller temporära filer (under `DIR/tmp`); ersätter `build_dir` för varje valt projektmål; positionella indata har ingen utan alternativet ([byggkatalog](projects.md#build-directory)) |
| `--entry MODULE[:FUNCTION[/ARITY]]` | Den körbara filens ingångsfunktion/1 (annars funktion/0; `/0` eller `/1` väljer en); valideras i varje kompileringsläge och lägger till startartefakten `clausev1_start` ([körbara filer](executables.md#startup-object)); IR- och assemblerinspektioner utelämnar då det som den inte kan nå ([levande exporter](executables.md#export-liveness)) |
| `--target-triple TRIPLE` | Målmaskin; `--target` väljer projektmål |
| `-O0` / `-O2` / `-Os` | Generisk standardkod + LLVM O0 / begränsad specialisering + LLVM O2 / LLVM Os, ingen specialisering, en sektion per symbol och länkarens borttagning av orefererad kod och data |
| `--no-type-specialization` | Stäng av varianter oavsett alternativens ordning |
| `--lto` | Länka modulerna som bitkod med LLD:s optimering vid länkning (Windows MSVC- och ELF-mål; kräver `-o` eller ett projektbygge som länkar) ([länkning](executables.md#linking)) |
| `--keep-exports` | Behåll varje export i en körbar fil anropbar i stället för att utelämna dem som den inte kan nå; kräver `-o`, ett projektbygge som länkar eller en IR-/assemblerinspektion ([levande exporter](executables.md#export-liveness)) |
| `-g` | Erlangs radtabeller i objekt och länkade körbara filer (CodeView/PDB på MSVC-mål, DWARF på andra) ([felsökning](debugging.md)) |
| `--print-ir` / `--print-optimized-ir` | Verifierad IR före/efter LLVM-pass, med Erlang-källrader som kommentarer |
| `--print-asm` | Varje moduls målassembler efter den valda kedjan, där varje följd av maskinkod kommenteras med den IR-instruktion och Erlang-rad den kommer från ([assemblerlistningar](#assembly-listings)) |
| `--print-types` | Varje modul som Erlang-källkod annoterad med härledda typer ([semantik](semantic.md#--print-types)); stannar före LLVM |
| `--verbose` | Fashändelserna `[pp]`, `[parse]` och `[comp]` på stderr, sedan sammanfattningen `[index] ...` av [katalogindexet](projects.md#directory-index) |
| `--print-stage-times` | `[time] <stage> <subject>: <ms> ms` på stderr: `plan` per projektmanifest (inläsning av det och expansion av varje valt måls mönster), `preprocess`, `parse` och `transform` (moduler med parse transforms) per källfil, `compile` per batch (antal moduler, projektmål), `link` per körbar fil; ` (cached)` följer ett steg som återanvände ett [cachat](projects.md#build-caches) resultat. Före en batchs totala `compile` kommer dess faser med samma subjekt: `index`, `calls`, `liveness` (körbara filer och inspektioner med en ingångspunkt), `declared-types`, `inference-cache` (med `N of M covered modules reused`, [inferenscache](projects.md#inference-cache)), `inference`, `inference-store`, `contracts`, `lower`, `optimize`, `emit` (de som kördes). Efter `inference`: rader `inference pass N` med passets arbetssteg av inferensens arbetsbudget (`N of BUDGET work steps`) och hur det slutade (`inputs changed`, `fun results changed`, `settled`, eller det sista passet efter ostabiliserade pass), med namnet på den funktion som kördes när budgeten tog slut; sedan `inference slowest <module>:<function>/<arity>` för de 10 funktioner (rekursiva grupper namnger en medlem `and N more`) som tog längst tid över alla pass, med deras arbetssteg och det arbetets andel av budgeten för de pass som körde dem (`877450 work steps, 43.9% of 10 passes of 200000 budget`), och `widened to term()` när en budget breddade ett av deras fakta; sedan `inference rounds <module>:<function>/<arity> and N more` för de 10 långsammaste rekursiva grupperna: lösningar över alla pass, rundor som körts mot taket per lösning (8 + 4 per medlem), lösningar som nådde taket eller förbrukade sin åttondel av passets budget (varje medlem breddad till `term()`), lösningar som gav upp direkt eftersom ett tidigare pass gjorde det (`remembered`) eller slutade med passets budget förbrukad, genomgångar av medlemmar (och de som hoppades över eftersom inget de läser ändrades) och andelen som ändrade en sammanfattning (växte, indata av funktionstyp ändrades, eller växlade tillbaka till en av medlemmens 4 senaste sammanfattningar), och de medlemmar som ändrades per runda i den sista lösningen i tio grupper av rundor. En cachad kompilering skriver inga faser |
| `--print-env` | Skriv ut den lösta kompileringsmiljön som TOML på stdout och avsluta utan att bearbeta källfiler ([miljörapport](#environment-report)) |
| `--print-inputs` | Förbehandla och tolka indata, lägg till modulerna som de namnger så som kompileringen gör, lista sedan varje källfil i batchen på stdout och stanna före kompileringen ([projekt](projects.md#cli-and-target-selection)) |

- Utan `--emit` verifierar kompileringen objekten i minnet och skriver
  ingenting utanför [byggkatalogen](projects.md#build-directory).
- Positionella indata bildar en batch; varje projektmål är en egen batch.
- Artefaktrötter: `build/aot` (positionella) eller `build/aot/<hex-target>`
  under manifestkatalogen. Explicita rötter är relativa till anropet.
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

## Assemblerlistningar

`--print-asm` kör den valda kedjan (som `--print-optimized-ir` gör) och skriver
sedan ut varje indatamoduls assembler från samma målmaskin som skriver objekt,
en modul i taget. Kommentarer använder målets markör (`#` på x86, `//` på
AArch64 ELF, `;` på Apple, `@` på ARM):

```
# erlang answer.erl:3: value() -> 42.
#     ir store i64 687, ptr %frame.slots, align 8
	movq	$687, 32(%r15,%r12,8)
#     ir br i1 %4, label %return.inline, label %return.service
```

- En `ir`-kommentar inleder varje följd av instruktioner som valts från en
  IR-instruktion, skriven så som `--print-optimized-ir` skriver ut den (samma
  numrering av värden, `switch` vikt till en rad, ingen `!dbg`). Kod som
  flyttats eller slagits samman över instruktioner upprepar eller hoppar över
  kommentarer så som radtabellen anger.
- En `erlang`-kommentar anger den fysiska filen, raden och texten, som
  IR-källkommentarer, när raden ändras inom en funktion. Instruktioner som
  sänkningen inte placerat någonstans (omslag, uppsättning av ramar) har
  ingen.
- Listningen kompilerar en kopia vars radtabell numrerar IR-instruktioner i
  stället för Erlang-rader; den radtabellens direktiv, felsökningssektioner och
  etiketter utelämnas. Återassemblerad ger den det objekt som `--emit obj`
  skriver.
- Med andra inspektioner skriver varje modul ut `before`, `after` och
  `assembly` i tur och ordning, var och en efter ett huvud
  (`stage=assembly`). Som IR-inspektion avvisar den `--emit`,
  `--artifact-dir`, `--output` och `--print-types`. x86-listningar använder
  AT&T-syntax.
- Med `--entry` utelämnar IR- och assemblerinspektioner de funktioner som
  ingångspunkten inte kan nå, som den körbara filen gör (`--keep-exports`
  behåller dem).

## Miljörapport

`--print-env` validerar hela kommandoraden (konflikter, läsbara positionella
indata, projektplanering), skriver sedan ut det som kommandot skulle använda
som ett TOML-dokument på stdout, avslutar med 0 och läser ingen källfil.
Sökvägar är absoluta, med `/`.

```toml
# clau compile environment (--print-env)
command = ["clau", "--print-env", "-O2", "-o", "app", "main.erl"]  # as given
actions = ["link"]          # see below
working_directory = "/work"

[[targets]]                 # one per selected project target; one for positional inputs
name = "app"                # project targets only
project = "/work/project.toml"
sources = ["/work/src/main.erl"]           # globs and search paths resolved
library_directory = "/clau/library"     # application dirs, searched before source_search_paths
build_dir = "/work/build"   # "" for positional inputs without --build-dir
entry = "main:main"         # or "auto" when linking without --entry
output = "/work/app"        # linking only: final name (".exe" on Windows)
linker = "/usr/bin/clang++" # linking only; "" when none is found
runtime_library = "/clau/lib/libclause_runtime.a"

[targets.options]           # manifest option names
source_search_paths = []    # directories, patterns expanded
include_dirs = []           # search order, patterns expanded
defines = []
applications = { "stdlib" = "/otp/lib/stdlib" }  # last mapping wins
enabled_features = ["maybe_expr"]                # OTP defaults plus changes

[targets.backend]
target_triple = "x86_64-unknown-linux-gnu"  # host when not given
optimization = "O2"
type_specialization = true  # O2 without --no-type-specialization
debug_info = false
lto = false
keep_exports = false        # --keep-exports or the project option
emit = "none"               # or obj, llvm-ir, llvm-bc
artifact_dir = "/work/build/aot"
```

(Arrayer skrivs ut med ett element per rad.) `actions` listar
frontend-åtgärderna (`print-pp`, `parse-check`, `print-ast`, `print-source`,
`print-abstr`, annars `preprocess-check`; `print-inputs` ensamt ersätter dem),
annars inspektionerna (`print-types`, `print-ir`, `print-optimized-ir`,
`print-asm`), annars `emit`, `link` (`-o`) eller `compile`. I ett projektbygge
länkar även mål med en `output`. Moduler som hittas senare via namn (genom
`source_search_paths` eller biblioteket) listas inte: att hitta dem kräver
tolkning (det gör `--print-inputs`). `--print-env` kan inte kombineras med
`--new-project`.

## Kompileringscache

En batch med en byggkatalog (varje projektmål, positionella indata med
`--build-dir`) behåller sitt kompileringsutfall i
[byggcachen](projects.md#build-caches): diagnostiken i ordning, misslyckandet
och, när en körbar fil eller `--emit` behöver dem, objekten (eller bitkoden)
för varje modul och startmodulen. Ett senare bygge av samma batch med samma
alternativ spelar upp diagnostiken igen och länkar eller publicerar de sparade
objekten exakt som nya; `--print-stage-times` visar då
`[time] compile ... (cached)`. `--print-ir`, `--print-optimized-ir`,
`--print-asm` och `--print-types` beräknar alltid om, och `--no-cache` varken
läser eller skriver.

- **Återanvändningsenhet: hela batchen.** Analys, typhärledning,
  specialiseringsbudgetar (per mål), levande exporter och startmodulen spänner
  över varje modul, så en moduls objekt beror på fakta om andra (typer hos
  anropade funktioner, records, behaviours, vilka funktioner som förblir
  levande). Dessa fakta har i dag ingen kanonisk form att hasha per modul, så
  en nyckel per modul kunde inte bevisas sund; varje ändring i någon modul i
  batchen kompilerar om batchen. Endast inferensresultat behålls per modul för
  täckta bibliotekskataloger ([inferenscache](projects.md#inference-cache)),
  så en sådan omkompilering återanvänder dem.
- **Nyckel.** `clau`-versionen och den körbara filens identitet; varje indatas
  sökväg och fingeravtryck (varje fil som frontend läste för den, sökväg och
  bytes, i ordning: källfilen, dess inkluderingar och `include_lib`-filer, och
  svaret från dess parse transforms; förbehandlingsalternativen; den
  genererade texten för platshållare), fördefinierade former och
  escript-status; den lösta triplen, optimeringsnivå, `--emit`,
  `--no-type-specialization`, `-g`, `--lto`, `--keep-exports`, om en körbar
  fil länkas, valet av ingångspunkt och projektmålet. Poster för ett mål med
  andra alternativ behålls sida vid sida.
- **Lagring.** Varje utdata är en egen del, så ett objekt som är större än
  lagrets inline-gräns blir en innehållsadresserad blob-fil, delad när två
  uppsättningar alternativ producerar identiska objekt.

## Backend

- En LLVM-kontext och målmaskin per batch. Värdtripeln använder värdens CPU
  och funktioner; främmande tripler använder den generiska CPU:n. PIC, liten
  kodmodell.
- Backends: X86, ARM, AArch64 (snittet med SDK:n). Okända eller saknade
  backends misslyckas; det finns ingen reserv till värden.
- Verifiering körs före och efter optimering; den kontrollerar IR:ens
  giltighet, inte Erlang-korrekthet.
- Budgetar per mål: 16 384 moduler, 1 500 000 AST-noder per modul, 16 000 000
  per batch. Serialiserad utdata: 64 MiB per modul, 256 MiB per batch. Att
  överskrida en budget är en vanlig resursdiagnostik.

## LLVM SDK

Stabil LLVM **23.1.x**, minst 23.1.1. LLVM är ett värdberoende: arkitektur,
C++-standardbibliotek och Windows CRT måste matcha kompilatorverktyget.
Projektkoden behåller undantag/RTTI; inget undantag får avvecklas genom LLVM.
Runtime använder aldrig LLVM.

- Sökningen genomsöker standardprefix (`/usr`, `/usr/local`, `/opt/homebrew`,
  `/opt/local`, `/opt/llvm`, Linuxbrew, `/Library/Developer/Toolchains`,
  Program Files på Windows), inklusive versionerade layouter. Byggträd
  avvisas.
- `LLVM_DIR` väljer en SDK explicit; ogiltiga val misslyckas utan reserv.
- Om ingen hittas laddar CMake ned det fastlåsta **23.1.2**-arkivet (SHA-256
  kontrollerad) till `thirdparty/` för Windows x64/ARM64, Linux x64/ARM64
  eller macOS ARM64. `CLAUSE_DOWNLOAD_LLVM=OFF` stänger av nedladdningar.
- En länkprob vid konfigurering kontrollerar ABI-kompatibilitet.

Referensuppsättning för Windows x64: värdens clang-cl 23.1.2 i
`C:/Program Files/LLVM/bin`, SDK
`thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`, Visual Studio 18
x64-verktyg, Windows SDK 10.0.26100.0, Ninja, `/MT`,
`_ITERATOR_DEBUG_LEVEL=0`. Automatiskt val tillämpar `/MT`- och
iteratorinställningarna; en explicit `LLVM_DIR` gör det inte, och länkproben
misslyckas då.

## PCRE2

Runtimens inbyggda `re`-funktioner använder PCRE2 **10.47**, den version som
OTP 29 medföljer (`erts/emulator/pcre/vendor.info`), så att mönstersyntax,
alternativ och infångningar beter sig som i OTP: 8-bitars kodenheter,
Unicode-stöd, ingen JIT, oförändrad `pcre2_match` (OTP:s patch för att lämna
ifrån sig körningen förs inte över). PCRE2 är licensierad under BSD-3-Clause
med PCRE2-undantaget för kompilerade binärer; ingen PCRE2-fil checkas in.
CMake (`cmake/Pcre2Dependencies.cmake`) löser den i denna ordning:

1. `-DCLAUSE_PCRE2_ROOT=<source directory>` har företräde (ingen nedladdning);
   versionen i dess `configure.ac` måste vara 10.47.
2. En installerad PCRE2 på minst 10.47 (`CLAUSE_PCRE2_SYSTEM=ON`, standard):
   CMake-paketet (`find_package(pcre2 CONFIG COMPONENTS 8BIT)`, statiska
   bibliotek föredras), annars pkg-config `libpcre2-8`, där en statisk
   `libpcre2-8.a` föredras framför det delade biblioteket.
3. Den fastlåsta versionen, nedladdad till `thirdparty/pcre2-10.47` och
   verifierad (`pcre2-10.47.tar.bz2`, SHA-256
   `47fe8c99461250d42f89e6e8fdaeba9da057855d06eb7fc08d9ca03fd08d7bc7`);
   `-DCLAUSE_DOWNLOAD_PCRE2=OFF` stänger av nedladdningen.

En källkatalog (1 eller 3) bygger objektbiblioteket `clause_pcre2` från de
listade `.c`-filerna med de distribuerade `config.h.generic`,
`pcre2.h.generic` och `pcre2_chartables.c.dist` kopierade till byggträdet
(inget genereringssteg, inga varningsflaggor från projektet, utanför
clang-tidy och Lizard), och dess objekt läggs till i själva `clause_runtime`:
arkivet är självständigt och varje konsument (länkningar med `clau`, nästlade
testprogram, `runtime_link`, `examples/compile`) får PCRE2 med det. Ett
installerat bibliotek blir i stället en extra länkarindata som registreras i
`clause_runtime.link` bredvid arkivet (en indata per rad), som `clau` lägger
till i varje länkning; ett delat bibliotek gör att de körbara filerna beror på
det vid körning. Per plattform: Windows använder nedladdningen (ingen
system-PCRE2 söks i praktiken); Linux och macOS använder en installerad PCRE2
10.47 eller nyare när den finns, annars nedladdningen. PCRE2 länkas alltid in
i runtimen, även i program som aldrig anropar `re`.

## zlib

Runtimens zlib-modul och komprimerade externa termer använder zlib **1.3.2**,
den version som OTP 29 medföljer (`erts/emulator/zlib/vendor.info`), så att
komprimerade bytes är lika med OTP:s. CMake kompilerar dess bibliotekskällor
(`cmake/ZlibDependencies.cmake`, `clause_add_runtime_zlib`) till
objektbiblioteket `clause_runtime_zlib`, vars objekt läggs till i
`clause_runtime` som PCRE2:s; `-DCLAUSE_RUNTIME_ZLIB_ROOT=<source directory>`
har företräde, annars laddas versionen ned till `thirdparty/zlib-1.3.2` och
verifieras (SHA-256
`bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16`) på varje
värd. zlibs licens är zlib-licensen. Kompilatorns LLVM behåller sin egen zlib;
de två möts aldrig i en binär.

Övriga förutsättningar: CMake ≥ 3.28, en C++23-kompilator, Boost ≥ 1.90,
toml++ 3.4.0 och kvalitetsverktygen. OTP behövs endast för valfria
granskningar och återskapande av fixturer.
