---
source: docs/runtime.md
sourceCommit: a8c3f8f6
sourceSha256: 191e95cc2bea15e016f69e98aca4ce93be2fa8f47a09d9d1977607eceaf69fc2
translatedAt: 2026-10-17
---
# Runtime

`clause_runtime` är ett LLVM-fritt C++23-bibliotek. Det äger kontexter,
processheapar, atomer, laddade moduler och livscykelbokföring, och kör
Erlang-processer på schemaläggarens arbetstrådar ([processer](processes.md)).
Alla API:er är interna för projektet; värdanrop måste serialiseras per runtime
och får inte överlappa en programkörning, vars arbetstrådar synkroniserar
sinsemellan ([trådar](#threads)).

## Länkning

Länka exakt en runtime byggd för målet genom
`Clause::generated_program`:

```cmake
add_executable(harness harness.cpp)
target_link_libraries(harness PRIVATE Clause::generated_program)
```

Det tar med arkivet, ABI-/runtime-headers och C++23, men inte LLVM.
[link_consumer.cpp](../tests/runtime/link_consumer.cpp) visar en fullständig
livscykel.

## Livscykel

[runtime.hpp](../runtime/include/clause/runtime/runtime.hpp):

- `Runtime::start(options)` → `std::expected<std::unique_ptr<Runtime>, Status>`.
  Standardvärden: aktuell ABI-version och native-termbredd, `max_atoms` 2^20
  (högst 2^26; program sätter det med `--max-atoms`,
  [runtime-alternativ](executables.md#runtime-options)). Antalet kontexter är
  inte begränsat. `process_heap` och `process_stack` är alternativen för
  kontexter som skapas av `create_context()`; `memory_limit_bytes` är den
  valfria [gränsen för hela runtimen](runtime-heap.md#runtime-memory-limit),
  som rapporteras av `memory_bytes()`. Alla saknar tak som standard.
- `create_context()` eller `create_context(heap_options, stack_options)` →
  lånad `ProcessContext*`, stabil tills den förstörs. Standardvärden för
  heapen: minimiheap på 233 ord (`min_heap_words`) och inget minnestak
  (`limit_bytes` = `UNLIMITED_HEAP_BYTES`; en satt budget är en multipel av
  ordstorleken som är minst minimiheapen). Stacken saknar också tak om inte
  `StackOptions::limit_words` är satt.
- `destroy_context(ctx)`, `shutdown()`: shutdown returnerar `busy` medan
  kontexter finns kvar; därefter lyckas den idempotent och senare anrop
  returnerar `stopped`. Destruktorn städar upp återstående kontexter.
- Identiteter för kontexter och runtimes återanvänds inte; när de tar slut
  blir det fel. En kontexts identitet bär dess pid-nummer
  ([pids](terms.md#pids-and-references)). En kontextpekare är ett lån, inte
  en identitet. `lifetime()` ger en svag token som rapporterar
  `alive() == false` innan heapen rivs.
- Livscykelanrop kastar aldrig undantag och är tysta. Statusvärden:
  [abi.md](abi.md#runtime-services).

Ordning vid nedrivning: stäng schemaläggarposter → förstör kontexter → släpp
kodregistreringar → förstör schemaläggartjänsten → atomtabellen sist.
Upplösta funktionshandtag håller kod och atomstavningar vid liv efter att
runtimen rivits, men aldrig en process.

## Processminne

Varje kontext äger en `ProcessHeap`
([process_heap.hpp](../runtime/include/process_heap.hpp)); dess layout,
områden, dimensionering, admission, rötter och skräpsamling specificeras i
[runtime-heap.md](runtime-heap.md). Värd-API:et:

- `allocate(words)` returnerar nollställt ordutrymme. `reserve` ger en
  reservation som endast kan flyttas, med explicit bekräftelse (commit) och
  automatisk återställning (rollback). En reservation åt gången per heap: bygg
  barnen först och reservera föräldern sist. Råa `allocate()`-ord måste förbli
  noll eller innehålla kompletta objekt
  ([ordlayout](runtime-heap.md#word-layout)).
- Noll, överflöd och uttömd budget avvisas innan något publiceras:
  `out_of_memory` (allokering) eller `limit_exceeded` (budget); genererad kod
  får den exakta statusen ([felbeteende](runtime-heap.md#failure-behavior)).
- `add(value)`/`copy_to` kopierar en graf från en annan process i samma
  runtime ([kopiering mellan heapar](runtime-heap.md#copying-between-heaps)).
- `used_words` räknar allokerade ord, `capacity_words` heapblocket och
  fragmenten, `off_heap_words` de buffertar utanför heapen som denna process
  refererar till, var och en en gång
  ([dimensionering och budget](runtime-heap.md#sizing-and-budget)).
- `verify()` går igenom heapblocket och varje fragment och kontrollerar att
  varje termplats pekar på början av ett objekt i samma process (tester och
  felsökning; annars `corrupt_heap`).
- `collect(roots)` kopierar allt som kan nås från processrötterna och värdens
  rotord till ett nytt heapblock ([skräpsamling](runtime-heap.md#collection)).
  Den körs endast vid en safepoint, annars `unsafe_point`
  ([rötter och safepoints](runtime-heap.md#roots-and-safe-points)); genererad
  kod samlar skräp vid sina egna safepoints
  ([skräpsamling i genererad kod](runtime-heap.md#collection-in-generated-code)).

## Kodserver och inbyggda funktioner

Varje runtime äger en `CodeServer`
([code_server.hpp](../runtime/include/clause/runtime/code_server.hpp),
[callable.hpp](../runtime/include/clause/runtime/callable.hpp)):

```cpp
auto functions = std::make_unique<ModuleRegistry>();
auto added = functions->add("identity", 1,
    [](ProcessContext &, std::span<const Term> args) -> CallResult<Term> { return args.front(); });
auto loaded = context.code_server().load({"native_demo", CodeImage::linked(), std::move(functions)});
auto fn = context.code_server().resolve({.module = "native_demo", .function = "identity", .arity = 1});
```

- En `ModuleRegistry` avbildar exakt namn/aritet (≤ 255) på ett anropbart
  objekt där allt är `Term`. `load` fryser och publicerar det; dubbletter
  eller fel publicerar ingenting.
- Registreringen indexerar också genererade modulers bindningar i
  hashtabeller: modul-, record- och fun-deskriptorer till deras bindningar och
  definitioner, och atomord för `Module:Function/Arity` till exportramar.
  Dynamiska anrop, `apply/3`, `fun M:F/A` under körning och uppslag av
  deskriptorer tar därför konstant förväntad tid i antalet moduler och
  exporter. Indexen byggs inuti registreringen: en avvisad modul lägger inte
  till någon post, och de ändras endast under serverns exklusiva lås.
- `resolve` skiljer mellan saknad modul och saknad export.
  `ResolvedFunction` fäster modulavbildningen; `call` kontrollerar aritet,
  argument och resultat och gör om värdundantag till fel.
- Native-kroppar måste vara synkrona, icke-blockerande och får inte behålla
  kontexten eller argumentspannet.
- En begränsad katalog över kända uppskjutna BIF:ar (`self/0`, `length/1`,
  `spawn/3`, `spawn_link/3`, `send/2`, `make_ref/0`, `garbage_collect/0`,
  `apply/3` (genererad kod anropar i stället `apply/2,3` genom tjänsterna för
  dynamiska anrop, [funs](funs.md#dynamic-calls)), `tuple_size/1`, `+/2`)
  rapporterar `not_implemented`; andra oregistrerade namn returnerar
  `unknown_builtin` tyst. Denna värdväg når inte produktionens inbyggda
  funktioner.
- Produktionens inbyggda funktioner finns i serverns `BuiltinRegistry`,
  registrerade vid runtimens uppstart; genererad kod, dynamiska anrop och
  funs når dem genom [bryggan för inbyggda funktioner](builtins.md).
- `CodeServer::export_frame` hittar `FrameDescriptor` för en export utifrån
  modul, funktionsatom och aritet; `function_frame` lägger till de inbyggda
  funktionerna för dynamiska anrop; `external_fun` internerar definitionerna
  av externa funs som byggs under körning.
- Moduler laddas aldrig ur; `CodeServer::unload` är uppskjuten och dynamisk
  laddning stöds inte.

## Persistenta termer

En tabell per runtime (`memory/persistent_terms`), som ägs av `Runtime::Impl`
och nås genom `ProcessContext::persistent_terms()`, håller termerna för
`persistent_term` ([inbyggda funktioner](builtins.md#persistent-terms)).

- En nyckel och dess värde kopieras var för sig till en `MessageBuffer`
  ([meddelandebuffertar](runtime-heap.md#message-buffers)) utanför varje
  process, så att de överlever processen som lagrade dem och ingen
  skräpsamling flyttar dem.
- Poster hittas genom en hash av nyckeln (de inbyggda funktionerna använder
  termhashen från `phash2`) och exakt likhet, jämförd på plats i bufferten
  (`MessageBuffer::value`).
- En läsning kopierar värdet till läsarens heap, där OTP delar ut en referens
  in i ett literalområde och betalar med en global skräpsamling vid ersättning
  eller borttagning ([skillnader](differences.md)). Varje processheap förblir
  självständig: ett ersatt eller borttaget värde frigörs när den sista läsare
  som fortfarande kopierar det släpper sin buffertreferens, och ingen global
  skräpsamling behövs.
- Ett delat lås betjänar läsare på valfritt antal arbetstrådar; put och erase
  tar det ensamma och kopierar aldrig medan de håller det. CTest
  `runtime_persistent_terms` täcker värden som överlever sin skrivare, ersatta
  värden som hålls av läsare, samtidiga läsare och skrivare samt frigjorda
  debiteringar.

## Schemaläggarens bokföring

`SchedulerService`
([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp)) är en
värdvänd post över processernas livscykel; den kör ingen kod. Program körs på
exekutorn ([processer](processes.md#executor)), som inte använder den.

- `register_process(context)` en gång per kontext (samma runtime); dubbletter
  returnerar `already_registered`. `remove_process(id)` pensionerar en post
  som inte körs.
- `begin_dispatch` → körs; `finish_dispatch` → körbar, väntande eller
  avslutad (med orsak). `set_suspended` växlar en flagga på körbara/väntande
  poster. Andra övergångar returnerar `invalid_transition`.
- `request_shutdown()` stänger registrering, utdelning och
  suspensionsstyrning; inspektion och returer förblir tillgängliga för
  dränering.
- `run` och `execute` rapporterar `not_implemented`.

## Trådar

Schemaläggarens arbetstrådar ([arbetstrådar](processes.md#workers)) kör
processer på flera trådar i en runtime. Tjänster som de delar är
synkroniserade; allt annat förblir begränsat till tråden som kör dess process
eller skyddas av exekutorns mutex.

- Atomer: `AtomStorage` skyddar båda indexen med en delad mutex.
  Uppslagningar (`lookup`, `boolean`, `size`) delar den; `intern` slår upp
  under det delade låset och endast en ny stavning tar det exklusiva låset,
  kontrollerar igen och publicerar posten, så att kapplöpande internering av
  samma stavning får ett och samma ord. Orden förblir stabila: en post ändras
  eller tas aldrig bort före nedrivningen. Admission av atomord läser ett
  låsfritt index ([atomer](terms.md#atoms)).
- Kod: `CodeServer` skyddar sina moduler och definitioner av externa funs med
  en delad mutex. Uppslagningar (`find_module`, `resolve`, `atom_word`,
  `record_definition`, `fun_definition`, `export_frame`, `function_frame`,
  `owns`) delar den; `load` och byggandet av en ny definition av en extern fun
  tar den exklusivt, så att samtidiga registreringar av samma namn publicerar
  en modul (de andra får `duplicate_module`) och kapplöpande
  `external_fun`-anrop får en definition. Registret för inbyggda funktioner
  fylls vid runtimens uppstart, innan någon arbetstråd körs, och läses endast
  därefter.
- Fästen: moduler tas aldrig bort medan runtimen lever och servern förstörs
  efter varje kontext, så definitioner, ramar och atomplatser som den
  returnerat förblir giltiga för varje anrop och varje fun-cell. Handtag från
  `ResolvedFunction` och `find_module` behåller också sin modul efter att
  runtimen är borta.
- Pid- och portnummer: `IdentityNumbers` utfärdar nummer under ett exklusivt
  lås och godtar pid- och portord under ett delat.
- Minne: redovisningen för hela runtimen (`RuntimeMemory`) debiterar och
  frigör med atomära operationer; en debitering tar aldrig redovisningen förbi
  en valfri gräns.
- Andra trådar: timertråden ([timeouts i receive](processes.md#receive-timeouts)),
  I/O-tråden och, på Windows, lästråden för en `fd`-indata
  ([I/O-tråd](ports.md#io-thread)) rör processtillstånd endast genom
  exekutorns mutex.
- Länkning: på Linux lägger runtimen till `-pthread` för sina trådar; på
  Windows länkar den Winsock (`ws2_32`, `mswsock`) för socketar.

## Standard-utdata

`RuntimeOptions::standard_output`
([output.hpp](../runtime/include/clause/runtime/output.hpp)) tar emot
`erlang:display/1` och `io`-utdata till standard-utdata ([io](io.md)).
Standardimplementationen skriver till processens `stdout` genom C:s stdio
(buffrat); en värdmottagare returnerar `false` för att rapportera en
misslyckad skrivning.

`erlang:display/1` återger sitt argument i [visningsstil](terms.md#printing),
skriver texten och en radbrytning i en enda skrivning och returnerar `true`.
Återgivningsgränser och avvisade skrivningar blir infrastrukturstatusar
(`resource_limit`, `output_failure`, ...) i den kontrollerade kanalen, aldrig
Erlang-undantag.

## Programuppstart

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) kör ett helt program åt den genererade `main`
([körbara filer](executables.md)): den kontrollerar varje deskriptors ABI,
startar en runtime, registrerar alla moduler före all ingångskod, bygger argv i
ingångskontexten, kör ingångspunkten på exekutorn och översätter resultatet
till [avslutsstatusen](executables.md#exit-status). Rapporter går till stderr
efter att stdout har tömts; kontexten och runtimen rivs i ordning på varje väg.
`CLAUSE_halt_v1` implementerar `erlang:halt/0,1` (`abort` anropar
`std::abort`).

## Uppskjutna tjänster

Dessa rapporterar en rad `[feature] notimpl` ([funktioner](features.md)) och
ändrar inget tillstånd:

| Gräns | Fel |
| --- | --- |
| `TermFactory::function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` på en katalogiserad BIF | `Status::not_implemented` |
