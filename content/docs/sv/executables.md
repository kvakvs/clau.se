---
source: docs/executables.md
sourceCommit: a8c3f8f6
sourceSha256: 70d36ba8e8c6b7bf8d1497635905c412b3fd8db8a36ef4ee8de8c1ee6f06f6ae
translatedAt: 2026-10-17
---
# Körbara filer

Kontrakt för program som byggs av `clau -o` eller ett projektbygge.
Positionella indata, eller exakt ett valt projektmål, länkas till sökvägen för
`-o`; ett projektbygge länkar varje valt körbart mål till dess `output` i
manifestet ([länkning](#linking), [projekt](projects.md#executables)).

## Val av ingångspunkt

Ingångspunkten är en exporterad funktion med aritet 1 som tar emot
argumentlistan. En vald `FUNCTION` utan `FUNCTION/1` kan i stället vara en
exporterad `FUNCTION/0`: den körs utan programmets argument
(runtime-alternativen tas ändå bort). Ett suffix `/0` eller `/1` väljer endast
den ariteten, så `--entry benchmarks:run/0` kör `run/0` även när `run/1` också
exporteras. Standard (inget val) är alltid `main/1`.

| Källa | Skrivsätt | Omfattning |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION[/ARITY]]` | Positionell batch, eller det enda valda projektmålet |
| Manifest | `entry = "MODULE[:FUNCTION[/ARITY]]"` i en `[[targets]]`-tabell | Det målet |
| Standard | Det enda escriptet, annars den enda modul som exporterar `main/1` | Endast när en körbar fil begärs (`-o`, eller ett projektmål med `output`) |

- `FUNCTION` är som standard `main`. Namn är ociterad atomtext: 1–255
  Unicode-skalärer, giltig UTF-8, inga kontrolltecken och inget `:`. Ett
  avslutande `/DIGITS` efter `FUNCTION` är ariteten och måste vara `0` eller
  `1`; andra snedstreck förblir en del av namnet. Andra skrivsätt är
  användningsfel (CLI, exit 2) eller manifestfel (exit 1).
- Hela manifestet avkodas, så en felformad `entry` misslyckas även i mål som
  inte är valda ([manifest](projects.md)).
- CLI-alternativet `--entry` åsidosätter manifestnyckeln och kräver exakt ett
  valt mål. Det står i konflikt med kontroll-/utskriftsåtgärder och
  `--new-project`; dessa åtgärder ignorerar `entry` i manifestet (som de
  ignorerar `output`).
- En explicit ingångspunkt valideras i varje kompileringsläge (standard,
  `--emit`, IR-/typinspektion), tillsammans med vanliga semantiska
  diagnostiker.

| Fel | Diagnostik (exit 1) |
| --- | --- |
| Modulen finns inte i batchen | `<origin>: entry module M is not among the compiled modules` (ursprung: `--entry` eller manifestets `file:line:col [target t] (entry)`) |
| Varken `F/1` eller `F/0` | `<file>:<line>:<col>: entry function M:F/1 is not defined` vid moduldeklarationen |
| Explicit `F/A` saknas | `... entry function M:F/A is not defined; found F/N` vid en definition med samma namn, annars vid moduldeklarationen |
| Endast andra ariteter | `... is not defined; found F/N, but the entry takes the argument list (FUNCTION/1) or nothing (FUNCTION/0)` vid den definitionen |
| `F/1` (annars `F/0`) exporteras inte | `<file>:<line>:<col>: entry function M:F/A is not exported` vid definitionen |
| Inget val, ingen export av `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION[/ARITY]] (an exported FUNCTION/1, or FUNCTION/0 run without the program arguments; FUNCTION defaults to main, ARITY to 1, else 0)` |
| Inget val, flera | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (samma tips) |

För projektmål anger tipset även manifestnyckeln: `... --entry
MODULE[:FUNCTION[/ARITY]] or with entry = "MODULE[:FUNCTION[/ARITY]]" in this
target's [[targets]] table of the project manifest ...`, till exempel:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1 (or app:start/0); "app:start/0" calls app:start/0; plain "app" calls app:main/1
```

## Argument

`Entry(Argv)` tar emot en äkta lista av strängar (listor av
Unicode-kodpunkter), utan programnamnet och de inledande
[runtime-alternativen](#runtime-options), i övrigt oförändrade och i ordning,
som `escript`.

- POSIX: varje arguments bytes avkodas som UTF-8; en byte som inte inleder en
  giltig sekvens blir kodpunkten för den byten (Latin-1 som reserv).
- Windows: CRT:ns breda (UTF-16) argumentvektor, uppdelad enligt samma regler
  som `argv`; ett oparat surrogat blir U+FFFD.
- Ingen annan tolkning av alternativ, globbing eller expansion av
  miljövariabler sker i runtimen.

## Runtime-alternativ

Runtimen läser sina alternativ från miljövariabeln `CLAUSE_FLAGS` (ord
uppdelade vid mellanslag och tabbar, ingen citering) och sedan från de
inledande kommandoradsargumenten, så att kommandoraden vinner. Båda tolkas på
samma sätt; ett värde anges i nästa argument eller efter `=`.

| Alternativ | Effekt |
| --- | --- |
| `--max-atoms N` | Atomtabellens storlek, 1 till 2^26 (67 108 864); standard 2^20 (1 048 576), som OTP:s `+t` |
| `--max-heap BYTES` | Tak för varje process heapblock, fragment och binaries utanför heapen, minst minimiheapen (233 ord); standard utan tak |
| `--max-stack BYTES` | Tak för varje process ramstack; standard utan tak |
| `--min-heap-size WORDS` | Standardvärde för `min_heap_size` för varje process, minst 1, avrundat uppåt till en heapstorlek, som OTP:s `+hms`; högst `--max-heap`; standard 233 ([storlek](runtime-heap.md#sizing-and-budget)) |
| `--max-memory BYTES` | Tak för det sammanlagda minnet för alla processer (heapar, binaries utanför heapen, stackar); standard utan tak |
| `--schedulers N` | Schemaläggarens arbetstrådar som kör processer, 1 till 1 024; standard en per logisk processor, som OTP:s `+S` ([arbetstrådar](processes.md#workers)) |
| `--profile FILE` | Skriver en rapport över anrop och egen tid per funktion och per process till `FILE` när programmet avslutas ([profilering](profiling.md)); avstängt som standard |
| `--args-file FILE` | Alternativfil som OTP:s `vm.args`: reserverat, rapporterar `runtime option --args-file is not implemented` |
| `--` | Avslutar runtime-alternativen; alla följande argument går till `Entry` |

På kommandoraden stannar tolkningen vid det första argument som inte är ett
runtime-alternativ, så `prog data --max-atoms 9` skickar alla tre argumenten
till programmet. I `CLAUSE_FLAGS` måste varje ord vara ett runtime-alternativ.
Ett ogiltigt värde, ett ord i variabeln som inte är ett alternativ, eller
`--args-file` stoppar programmet innan någon modul har registrerats:
`clau: runtime failure: <reason>`, exit 70. Antalet processer är inte
begränsat och minnet har som standard inget tak. Bytevärden är decimala utan
suffix och avrundas nedåt till hela ord; ett program som når ett tak
misslyckas med `resource_limit`, exit 70
([minnesgräns för runtimen](runtime-heap.md#runtime-memory-limit)).

## Avslutsstatus

| Utfall | Status |
| --- | --- |
| Ingångspunkten returnerar (vilket värde som helst) | 0 |
| `erlang:halt()` | 0 |
| `erlang:halt(N)`, icke-negativt heltal | `N` (POSIX-värdar behåller de låga 8 bitarna) |
| `erlang:halt(Slogan)` med en sträng | Slogan på stderr, sedan 1 (ingen kraschdump) |
| `erlang:halt(abort)` | Native-abort (ingen tömning) |
| Varje undantag som lämnar ingångspunkten, inklusive `throw` och `exit(normal)` | Rapport på stderr, 1 |
| Ingångsprocessen avslutas av en exitsignal ([processer](processes.md#exit-signals)) | Rapporteras som ett ofångat `exit`, 1; orsaken `normal`: 0 |
| Fel vid runtimens uppstart eller i infrastrukturen (ABI-avvikelse, registrering, minne före ingångspunkten) | Meddelande på stderr, 70 |
| Värdens minne slut (tillväxt av heap, binary utanför heapen eller stack vägrad; inget minnestak som standard, [minnesbrist](runtime-heap.md#failure-behavior)) | `clau: runtime failure: entry call failed: out_of_memory`, 70 |

Ogiltiga argument till `halt/1` kastar `badarg` hos anroparen. När
ingångspunkten är klar avslutas programmet: andra processer stoppas utan att
köras vidare, som med OTP:s `halt/1` efter att `escript` returnerat. En halt i
vilken process som helst avslutar programmet med dess status, och ett
runtime-fel i vilken process som helst avslutar det med 70; ett undantag i en
startad process avslutar endast den processen ([processer](processes.md)).

`halt/0,1`, `error/1,2,3`, `exit/1` och `throw/1` kan anropas med eller utan
prefixet `erlang:`; en lokal definition eller `-compile({no_auto_import, ...})`
håller det okvalificerade namnet lokalt, som i OTP. `halt/2` är inte
tillgänglig. `halt(N)` behåller de låga 31 bitarna av varje icke-negativt
heltal, som OTP gör. En slogan är en äkta lista med högst 1 023
Unicode-kodpunkter. En halt rullar upp ingångspunkten genom den kontrollerade
felkanalen som ett fel, så den stoppar programmet först efter genererad
uppstädning.

## Utdataströmmar

- stdout: utdata för `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Buffrad; töms på varje avslutsväg utom `abort`.
- stderr: rapporten om ofångat undantag, utdata för `standard_error`,
  runtime-fel och felrapporter från andra processer som kraschar
  ([processer](processes.md#exits)).
- Rapporten är en rad `uncaught exception <class>: <reason in ~w form>`, utan
  stackramar. Dess exakta text är inte ett stabilt gränssnitt; tester matchar
  den med mönster.

## Uppstartsobjekt

Kompilering med en explicit ingångspunkt (`--entry` eller `entry` i
manifestet) lägger till en uppstartsmodul efter batchens moduler. Med `--emit`
publiceras den som `clausev1_start.{obj,o,ll,bc}` bredvid modulartefakterna
(namnet kan inte krocka med en modulartefakt). Den innehåller en konstant
`abi::v1::StartupDescriptor`
([startup.hpp](../abi/include/clause/abi/startup.hpp)): ABI-revision,
termbredd, varje moduldeskriptor i källordning, skrivsätten för
ingångspunktens modul/funktion och en escript-flagga. Dess
`int main(int, char **)` anropar runtimens `CLAUSE_main_v1`, som:

1. Kontrollerar uppstartsdeskriptorn och varje moduldeskriptor avseende
   ABI-revision och bredd innan något registreras; en avvikelse avslutar med
   70.
2. Startar runtimen och registrerar alla moduler; varje fel stoppar före
   ingångspunkten och kastar runtimen (exit 70), så att ingen Erlang-kod körs
   mot en ofullständig batch.
3. Skapar ingångsprocessen, bygger argv och köar anropet av `M:F/1` som
   huvudprocessen, och kör den sedan samt varje process den startar på
   schemaläggarens arbetstrådar ([processer](processes.md)) tills den
   avslutas.
4. Översätter utfallet till avslutsstatusen ovan, skriver rapporter efter att
   stdout har tömts, och frigör sedan varje process och stänger ned runtimen
   på varje väg (utom `halt(abort)`).

`clau -o` länkar själv dessa objekt ([länkning](#linking)). Manuell länkning
([receptet för native-testramen](compile.md#run-the-compiled-module-example)
utan en källfil för testramen):

```powershell
& $tool --emit obj --entry app --artifact-dir build/app app.erl helper.erl
clang-cl /MT build/app/*.obj build/debug/lib/clause_runtime.lib /Fe:app.exe
```

Varje Clang-kompatibel länkning av objekten med `Clause::generated_program`
fungerar på samma sätt (se `tests/compiler/linking/startup.cmake`).

## Länkning

`clau [-O0|-O2|-Os] -o PATH a.erl b.erl ...` (eller
`--project FILE [--target T] -o PATH` för ett valt mål) kompilerar batchen i
minnet, lägger till uppstartsobjektet för
[ingångspunkten](#entry-selection) och länkar en körbar fil:

```sh
clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo          # build/demo.exe on Windows
```

`-Os` placerar dessutom varje genererad funktion och runtime-funktion samt
varje dataobjekt i en egen sektion och länkar med `--gc-sections` (ELF),
`-dead_strip` (Mach-O) eller `/OPT:REF /OPT:ICF` (MSVC), så att kod som ingen
väg från ingångspunkten når tas bort.

`--lto` kompilerar modulerna och uppstartsmodulen till LLVM-bitkod i stället
för objekt och länkar med `-flto -fuse-ld=lld`, så att LLD optimerar
programmets genererade kod som en enhet mot det inbyggda runtime-arkivet.
Modul- och uppstartsdeskriptorer, exporterade ingångar och `main` förblir
refererade och överlever; program beter sig som utan alternativet. Endast LLD
läser den här kompilatorns bitkod, så `--lto` godtas för Windows MSVC- och
ELF-mål; andra misslyckas före länkningen med
`--lto is not supported for target <triple>: it needs LLD`. `--lto` kräver en
körbar fil som utdata (`-o` eller ett projektbygge som länkar). Den
installerade Clang/LLD måste vara samma LLVM-version som `clau` (23.1).

### Levande exporter

En körbar fil utelämnar de exporter den inte kan nå, så att eliminering av död
kod med `-Os` och `--lto` tar bort bibliotekskod som programmet aldrig
anropar. Direkt efter upplösningen av anrop, före typhärledningen, startar en
analys av hela batchen vid ingångsfunktionen och markerar som levande allt som
en levande funktion anropar direkt (även genom `-import` och OTP:s automatiska
importer), varje `fun F/A` och literal `fun M:F/A`, och de literala målen för
`apply/3`, `spawn/3`, `spawn_link/3`, `spawn_monitor/3`, `spawn_opt/4,5`,
`spawn_request/3,5`, `hibernate/3` och `make_fun/3` (varje aritet av `M:F` när
argumentlistan inte är literal), samt `file:write/2` så snart `io:format/3`,
`io:fwrite/3`, `io:put_chars/2` eller `io:nl/1` är levande (deras inbyggda
funktioner skriver till en processenhet genom den). Den förblir konservativ:

- en modul vars namnatom används som ett värde någonstans i levande kod
  (skickas som argument, lagras, skickas som meddelande, `?MODULE`, en
  record-tagg, `M:F(...)` med en funktion som bestäms vid körning,
  `fun M:F/A` med en del som bestäms vid körning) behåller varje export, vilket
  också behåller callbacks i behaviour-moduler som startas via namn;
- så snart levande kod har både ett anrop med en modul som bestäms vid körning
  (`M:F(...)`, `apply/3` eller en spawn med en variabel modul, `fun M:F/A` med
  en variabel modul, `binary_to_term/1,2`) och en inbyggd funktion som
  producerar atomer (`list_to_atom/1`, `list_to_existing_atom/1`,
  `binary_to_atom/1,2`, `binary_to_existing_atom/1,2`, `binary_to_term/1,2`,
  `fun_info/1,2`, `fun_info_mfa/1`, `process_info/1,2`, `loaded/0`,
  `pre_loaded/0`), behålls varje export i varje modul.

En funktion som inget levande når får ingen kod alls. En utelämnad export
behåller sitt namn i modulens exporttabell utan kod, så att
`function_exported/3` och `module_info(exports)` svarar som om den vore
exporterad, medan ett dynamiskt anrop som når den ger `undef`
([skillnader](differences.md#errors-stack-traces-and-reports)). Det kan bara
hända när ett modulnamn kommer utanför analysen: en stackspårning, en
undantagsterm eller data utifrån programmet. `--verbose` spårar resultatet per
modul (`phase=liveness detail="dropped-exports=3"`, eller
`detail="kept-all-exports reason='m' is used as a value in main:main/1"`).

En funktion som inget levande når typhärleds heller aldrig och kontrolleras
aldrig mot sin `-spec`: inferensen täcker endast levande kod, vilket är
snabbare för program som använder lite av stora biblioteksmoduler och kan
bara snäva in levande funktioners fakta, eftersom onåbara anropare inte längre
slår samman sina argument. En specifikation som motsägs endast i onåbar kod
rapporteras därför för `--emit`-artefakter men inte för den körbara filen.

`--keep-exports` (eller projektalternativet `keep_exports = true`) behåller
varje export anropbar. Analysen gäller körbara filer (`-o` eller ett
projektbygge som länkar) och IR- och assemblerinspektioner som får en
ingångspunkt (`--entry` eller målets `entry` i manifestet), som då visar den
körbara filens kod; `--emit`-artefakter, avsedda för andra program, behåller
varje export.

`-g` behåller Erlangs radtabeller för debuggrar: i den körbara filen (ELF),
eller i en `<name>.pdb` som publiceras bredvid den (MSVC-mål)
([felsökning](debugging.md)).

- `PATH` är relativ till anropet. För Windows-mål läggs `.exe` till när
  filnamnet saknar filändelse. Dess katalog måste finnas.
- Länkare: `--linker PATH` (en sökväg eller ett programnamn), annars
  `clang++` eller `clang` från `PATH`, sedan (Windows)
  `%ProgramFiles%/LLVM/bin`. Den körs som
  `<clang> --driver-mode=g++ --target=<triple> -o <staged> <objects> <runtime>`,
  så att Clang väljer plattformens länkare och C/C++-runtimebibliotek (på
  Windows hittar den själv MSVC och SDK:n; inget utvecklarskal behövs).
- Runtime: `--runtime-library PATH`, annars arkivet `clause_runtime` från det
  bygge som producerade `clau` (sökvägen sparas relativt till den körbara
  filen, t.ex. `bin/../lib/clause_runtime.lib`). Varje native-objekt i arkivet
  måste matcha målets arkitektur och objektformat; `--target-triple` för ett
  annat mål kräver därför en runtime byggd för det.
- Objekten och den körbara filen mellanlagras i en privat
  `.clause-link-*`-katalog bredvid utdata, som tas bort efteråt; den ligger
  där, inte i [byggkatalogen](projects.md#build-directory), eftersom det
  slutliga namnbytet inte får korsa volymer. Utdata ersätts först efter en
  lyckad länkning, så varje fel lämnar en befintlig fil oförändrad. Utdata får
  inte vara en katalog eller vara ett alias för en indatafil.
- Länkarvarningar vidarebefordras till stderr; `--linker` och
  `--runtime-library` kräver `--output` eller ett länkande projektbygge.
- Projektbyggen utan `-o` länkar varje valt mål som har `output` eller
  `entry` till dess utdata i manifestet, skapar saknade kataloger och ersätter
  utdata först när alla valda mål har länkats
  ([projekt](projects.md#executables)).

| Fel (exit 1) | Diagnostik |
| --- | --- |
| Ingen Clang | `cannot find clang++ or clang on PATH; install LLVM/Clang or pass --linker` / `linker not found: X` |
| Ingen runtime | `runtime library not found: P; build the clause_runtime target or pass --runtime-library` |
| Inte ett arkiv | `runtime library is not a static library: P: ...` |
| Fel mål | `runtime library P contains x86_64 coff objects, but the executable targets T; ...` |
| Länkningsfel | `linking O failed: <clang> exited with status N:` följt av länkarens utdata (de första 64 KiB) |
| Felaktigt mål för utdata | `output directory does not exist: D`, `artifact destination is not a regular file: O`, `artifact destination aliases an input: O` |

## Escripts

En källfil vars första rad börjar med `#!` kompileras som ett escript, i
vilket läge som helst och med vilket filnamn som helst (positionella indata
eller projektets `.erl`-filer). Reglerna följer OTP 29:s `escript` för
källskript:

- Raden `#!` ignoreras. En valfri kommentar på rad 2 och en emulatorrad `%%!`
  (rad 2, eller rad 3 efter kommentaren) är kommentarer; argument i `%%!` kan
  inte tillämpas på kompilerad kod och ger en varning.
- Om den första formen inte är `-module(...)` är modulen
  `<file name with '.' replaced by '_'>__escript` (`?MODULE` inräknat). OTP
  lägger till ett suffix med tidsstämpel/unikt värde; Clause håller namnet
  deterministiskt. Den syntetiserade deklarationen upptar rad 1, så senare
  radnummer är oförändrade.
- `main/1` krävs (`escript does not define main/1`) och exporteras implicit;
  andra funktioner följer de vanliga exportreglerna.
- `-mode(compile | interpret | debug | native)` accepteras och ignoreras;
  andra värden är fel. Utanför escripts förblir `-mode` utan stöd.
- Ingångspunkt: utan `--entry` är det enda escriptet i batchen ingångspunkten
  (det vinner över moduler som exporterar `main/1`); flera escripts är
  tvetydiga.
- Avslutsstatus som OTP:s `escript`: ett undantag som lämnar escriptets
  ingångspunkt avslutar med 127 och `escript: exception <class>: <reason>` på
  stderr; övriga rader i tabellen för avslutsstatus gäller oförändrade.
- Filer utan `#!` är vanliga moduler. (OTP:s `escript file.erl` skulle hoppa
  över deras första rad; Clause gör det inte.) Förkompilerade beam- och
  arkiv-escripts stöds inte.

## Jämförelse med OTP

Referensresultat (goldens) för
[programfixturer](../tests/fixtures/programs/README.md) kör ingångspunkten
under OTP med samma regler
([orakel](../tests/compiler/programs/oracle.escript)); samma orakel genererar
[referensfallen för körbara filer](../tests/fixtures/executables/README.md)
som end-to-end-köraren länkar och kör under varje policy. Skillnader mot
`escript` för vanliga moduler: ofångade undantag avslutar med 1 i stället för
127, och `main/1` måste exporteras. Escript-källor behåller OTP:s regler (se
ovan).
