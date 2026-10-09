---
source: docs/executables.md
sourceCommit: 06042fa
sourceSha256: aaec2d5d2a83da50b160d09c8b37ecf1648199279e5aed4b35ef794633bf589a
translatedAt: 2026-10-09
---
# Körbara filer

Kontrakt för program som byggs av `clau -o` eller ett projektbygge.
Positionella indata, eller exakt ett valt projektmål, länkas till sökvägen
för `-o`; ett projektbygge länkar varje valt körbart mål till dess `output` i
manifestet ([länkning](#linking), [projekt](projects.md#executables)).

## Val av ingångspunkt

Ingångspunkten är en exporterad funktion med aritet 1 som tar emot
argumentlistan.

| Källa | Skrivsätt | Omfattning |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION]` | Positionell batch, eller det enda valda projektmålet |
| Manifest | `entry = "MODULE[:FUNCTION]"` i en `[[targets]]`-tabell | Det målet |
| Standard | Det enda escriptet, annars den enda modul som exporterar `main/1` | Endast när en körbar fil begärs (`-o`, eller ett projektmål med `output`) |

- `FUNCTION` är som standard `main`. Namn är ociterad atomtext: 1–255
  Unicode-skalärer, giltig UTF-8, inga kontrolltecken och inget `:`. Andra
  skrivsätt är användningsfel (CLI, exit 2) eller manifestfel (exit 1).
- `entry` är en valfri nyckel i schema 1; äldre manifest förblir giltiga.
  Hela manifestet avkodas, så en felformad `entry` misslyckas även i mål som
  inte är valda.
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
| Ingen `F/1` | `<file>:<line>:<col>: entry function M:F/1 is not defined` vid moduldeklarationen |
| Endast andra ariteter | `... is not defined; found F/N, but the entry receives one argument (the argument list)` vid den definitionen |
| `F/1` exporteras inte | `<file>:<line>:<col>: entry function M:F/1 is not exported` vid definitionen |
| Inget val, ingen export av `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION] (an exported FUNCTION/1; FUNCTION defaults to main)` |
| Inget val, flera | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (samma tips) |

För projektmål anger tipset även manifestnyckeln: `... --entry MODULE[:FUNCTION] or with
entry = "MODULE[:FUNCTION]" in this target's [[targets]] table of the project manifest ...`, till exempel:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1; plain "app" calls app:main/1
```

## Argument

`Entry(Argv)` tar emot en äkta lista av strängar (listor av Unicode-kodpunkter),
utan programnamnet och de inledande
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
| `--max-memory BYTES` | Tak för det sammanlagda minnet för alla processer (heapar, binaries utanför heapen, stackar); standard utan tak |
| `--schedulers N` | Schemaläggarens arbetstrådar som kör processer, 1 till 1 024; standard en per logisk processor, som OTP:s `+S` ([arbetstrådar](processes.md#workers)) |
| `--args-file FILE` | Alternativfil som OTP:s `vm.args`: reserverat, rapporterar `runtime option --args-file is not implemented` |
| `--` | Avslutar runtime-alternativen; alla följande argument går till `Entry` |

På kommandoraden stannar tolkningen vid det första argument som inte är ett
runtime-alternativ, så `prog data --max-atoms 9` skickar alla tre argumenten
till programmet. I `CLAUSE_FLAGS` måste varje ord vara ett
runtime-alternativ. Ett ogiltigt värde, ett ord i variabeln som inte är ett
alternativ, eller `--args-file` stoppar programmet innan någon modul har
registrerats: `clau: runtime failure: <reason>`, exit 70. Antalet processer
är inte begränsat och minnet har som standard inget tak. Bytevärden är
decimala utan suffix och avrundas nedåt till hela ord; ett program som når
ett tak misslyckas med `resource_limit`, exit 70
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
köras vidare, som med OTP:s `halt/1` efter att `escript` returnerat. En halt
i vilken process som helst avslutar programmet med dess status, och ett
runtime-fel i vilken process som helst avslutar det med 70; ett undantag i en
startad process avslutar endast den processen ([processer](processes.md)).

`halt/0,1`, `error/1,2,3`, `exit/1` och `throw/1` kan anropas med eller utan
prefixet `erlang:`; en lokal definition eller
`-compile({no_auto_import, ...})` håller det okvalificerade namnet lokalt,
som i OTP. `halt/2` är inte tillgänglig.
`halt(N)` behåller de låga 31 bitarna av varje icke-negativt heltal, som OTP
gör. En slogan är en äkta lista med högst 1 023 Unicode-kodpunkter. En halt
rullar upp ingångspunkten genom den kontrollerade felkanalen som ett fel, så
den stoppar programmet först efter genererad uppstädning.

## Utdataströmmar

- stdout: utdata för `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Buffrad; töms på varje avslutsväg utom `abort`.
- stderr: rapporten om ofångat undantag, utdata för `standard_error`,
  runtime-fel och felrapporter från andra processer som kraschar
  ([processer](processes.md#exits)).
- Rapporten är en rad `uncaught exception <class>: <reason in ~w form>`,
  senare följd av stackramar (step 15). Dess exakta text är inte ett stabilt
  gränssnitt; tester matchar den med mönster.

## Uppstartsobjekt

Kompilering med en explicit ingångspunkt (`--entry` eller `entry` i
manifestet) lägger till en uppstartsmodul efter batchens moduler. Med
`--emit` publiceras den som `clausev1_start.{obj,o,ll,bc}` bredvid
modulartefakterna (namnet kan inte krocka med en modulartefakt). Den
innehåller en konstant
`abi::v1::StartupDescriptor` ([startup.hpp](../abi/include/clause/abi/startup.hpp)):
ABI-revision, termbredd, varje moduldeskriptor i källordning, skrivsätten för
ingångspunktens modul/funktion och en escript-flagga. Dess
`int main(int, char **)` anropar runtimens `CLAUSE_main_v1`, som:

1. Kontrollerar uppstartsdeskriptorn och varje moduldeskriptor avseende
   ABI-revision och bredd innan något registreras; en avvikelse avslutar med
   70.
2. Startar runtimen och registrerar alla moduler; varje fel stoppar före
   ingångspunkten och kastar runtimen (exit 70), så att ingen Erlang-kod körs
   mot en ofullständig batch.
3. Skapar ingångsprocessen, bygger argv och köar anropet av `M:F/1` som
   huvudprocessen, och kör den sedan samt varje process den startar på den
   kooperativa exekutorn ([processer](processes.md)) tills den avslutas.
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

`clau [-O0|-O2|-Os] -o PATH a.erl b.erl ...` (eller `--project FILE [--target T] -o PATH`
för ett valt mål) kompilerar batchen i minnet, lägger till uppstartsobjektet
för [ingångspunkten](#entry-selection) och länkar en körbar fil:

```sh
clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo          # build/demo.exe on Windows
```

`-Os` placerar dessutom varje genererad funktion och runtime-funktion samt
varje dataobjekt i en egen sektion och länkar med `--gc-sections` (ELF),
`-dead_strip` (Mach-O) eller `/OPT:REF /OPT:ICF` (MSVC), så att kod som ingen
väg från ingångspunkten når tas bort.

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
  `.clause-link-*`-katalog bredvid utdata, som tas bort efteråt. Utdata
  ersätts först efter en lyckad länkning, så varje fel lämnar en befintlig fil
  oförändrad. Utdata får inte vara en katalog eller vara ett alias för en
  indatafil.
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

- Raden `#!` ignoreras. En valfri kommentar på rad 2 och en emulatorrad
  `%%!` (rad 2, eller rad 3 efter kommentaren) är kommentarer; argument i
  `%%!` kan inte tillämpas på kompilerad kod och ger en varning.
- Om den första formen inte är `-module(...)` är modulen
  `<file name with '.' replaced by '_'>__escript` (`?MODULE` inräknat). OTP
  lägger till ett suffix med tidsstämpel/unikt värde; Clause håller namnet
  deterministiskt. Den syntetiserade deklarationen upptar rad 1, så senare
  radnummer är oförändrade.
- `main/1` krävs (`escript does not define main/1`) och exporteras
  implicit; andra funktioner följer de vanliga exportreglerna.
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

Referensresultat (goldens) för [programfixturer](../tests/fixtures/programs/README.md)
kör ingångspunkten under OTP med samma regler
([orakel](../tests/compiler/programs/oracle.escript)); samma orakel genererar
[referensfallen för körbara filer](../tests/fixtures/executables/README.md)
som end-to-end-köraren länkar och kör under varje policy. Skillnader mot
`escript` för vanliga moduler: ofångade undantag avslutar med 1 i stället för
127, och `main/1` måste exporteras. Escript-källor behåller OTP:s regler (se
ovan).
