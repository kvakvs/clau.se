---
source: docs/runtime.md
sourceCommit: 6ed3851c
sourceSha256: 487cb38fceea0b489183ca4c47c3c3b8494d2df44fd821e82de92e1c896f5864
translatedAt: 2026-10-15
---
# Runtime

`clause_runtime` är ett LLVM-fritt C++23-bibliotek. Det äger kontexter,
processheapar, atomer, laddade moduler och livscykelbokföring, och kör
Erlang-processer på schemaläggarens arbetstrådar ([processer](processes.md)).
Alla API:er är interna för projektet; värdanrop måste serialiseras per
runtime och får inte överlappa en programkörning, vars arbetstrådar
synkroniserar sinsemellan ([trådar](#threads)).

## Länkning

Länka exakt en runtime byggd för målet genom `Clause::generated_program`:

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
  lånad `ProcessContext*`,
  stabil tills den förstörs. Standardvärden för heapen: minimiheap på 233 ord
  (`min_heap_words`) och inget minnestak (`limit_bytes` =
  `UNLIMITED_HEAP_BYTES`; en satt budget är en multipel av ordstorleken som
  är minst minimiheapen). Stacken saknar också tak om inte
  `StackOptions::limit_words` är satt.
- `destroy_context(ctx)`, `shutdown()`: shutdown returnerar `busy` medan
  kontexter finns kvar; därefter lyckas den idempotent och senare anrop
  returnerar `stopped`. Destruktorn städar upp återstående kontexter.
- Identiteter för kontexter och runtimes återanvänds inte; när de tar slut
  blir det fel. En kontexts identitet bär dess pid-nummer
  ([pid:ar](terms.md#pids-and-references)). En kontextpekare är ett lån, inte
  en identitet. `lifetime()` ger en svag token som rapporterar
  `alive() == false` innan heapen rivs.
- Livscykelanrop kastar aldrig undantag och är tysta. Statusvärden:
  [abi.md](abi.md#runtime-services).

Ordning vid nedrivning: stäng schemaläggarposter → förstör kontexter → släpp
kodregistreringar → förstör schemaläggartjänsten → atomtabellen sist.
Upplösta funktionshandtag håller kod och atomstavningar vid liv efter att
runtimen rivits, men aldrig en process.

## Processminne

Varje kontext äger en `ProcessHeap`: ett enda heapblock som skapas vid dess
första allokering med storleken `max(min_heap_words, request)`, plus en kedja
av heapfragment som ägs av samma process. Ord flyttas endast när värden anropar
`collect()` vid en safepoint.

Heapen följer den klassiska ERTS-designen; [runtime-heap.md](runtime-heap.md)
är dess kontrakt (layout, områden, dimensionering, antagning, rötter,
skräpsamling).

- `allocate(words)` returnerar nollställt ordutrymme. `reserve` ger en
  reservation som endast kan flyttas, med explicit bekräftelse (commit) och
  automatisk återställning (rollback). En reservation åt gången per heap: bygg
  barnen först och reservera föräldern sist.
- Bump-allokering fyller heapblocket; en begäran som inte får plats går till
  det nyaste fragmentet, annars till ett nytt fragment med storleken
  `max(min_heap_words, request)` (begränsat av den återstående budgeten). Ord
  är endast ordjusterade. Återställning återställer områdets topp, släpper ett
  fragment (eller heapblocket) som reservationen skapat och återställer
  bokföringen exakt.
- Avvisar noll, överflöd och uttömd budget innan något publiceras. Fel:
  `out_of_memory` (allokering) eller `limit_exceeded` (budget); genererad kod
  får den exakta statusen.
- Binaries över 64 bytes finns i delade buffertar utanför heapen. Varje
  heapcell som refererar till en sådan håller en `std::shared_ptr` och ansluts
  till processens lista över objekt utanför heapen när den publiceras;
  nedrivningen går igenom listan och släpper dessa referenser
  ([binaries utanför heapen](runtime-heap.md#off-heap-binaries)).
- `add(value)`/`copy_to` kopierar en graf från en annan process i samma
  runtime, med bevarad delning och delade buffertar utanför heapen; en
  misslyckad kopiering ändrar ingenting
  ([kopiering mellan heapar](runtime-heap.md#copying-between-heaps)).
- `used_words` räknar allokerade ord; `capacity_words` räknar heapblock och
  fragment; `off_heap_words` räknar de buffertar som denna process refererar
  till, var och en en gång. Underliggande ord plus ord utanför heapen delar
  den valfria budgeten `limit_bytes`; en skräpsamling behåller hälften av den
  budget som återstår efter att de överlevande frigjorts, så att uttömma den
  innebär att de levande data inte längre får plats
  ([felbeteende](runtime-heap.md#failure-behavior)).
- Varje använt ord tolkas som ett objekt som inleds av ett huvud, en
  cons-cell eller utfyllnad ([ordlayout](runtime-heap.md#word-layout));
  reserverade ord börjar nollställda.
  Råa `allocate()`-ord måste förbli noll eller innehålla kompletta objekt.
  `verify()` går igenom heapblocket och varje fragment och kontrollerar att
  varje termplats pekar på början av ett objekt i samma process (tester och
  felsökning; annars `corrupt_heap`).
- `collect(roots)` kopierar allt som kan nås från processrötterna och värdens
  rotord till ett nytt heapblock, frigör det gamla blocket och fragmenten,
  släpper döda binaries utanför heapen och skriver om rötterna
  ([skräpsamling](runtime-heap.md#collection)). Genererad kod samlar skräp vid
  funktionsingångar och loophuvuden i comprehensions när
  `wants_collection()`
  ([skräpsamling i genererad kod](runtime-heap.md#collection-in-generated-code)).
  Den körs endast vid en safepoint (ingen
  genererad kod som körs utanför ett `SafePoint`-omfång, ingen öppen
  reservation), annars `unsafe_point`;
  [rotinventeringen](runtime-heap.md#roots-and-safe-points) listar vad den
  skriver om; misslyckande
  att allokera det nya blocket ger `out_of_memory` utan att något ändras.

## Kodserver och inbyggda funktioner

Varje runtime äger en `CodeServer` ([code_server.hpp](../runtime/include/clause/runtime/code_server.hpp),
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
- Registreringen indexerar också genererade modulers bindningar i hashtabeller:
  modul-, record- och fun-deskriptorer till deras bindningar och definitioner,
  och atomord för `Module:Function/Arity` till exportramar. Dynamiska anrop,
  `apply/3`, `fun M:F/A` under körning och uppslag av deskriptorer tar därför
  konstant förväntad tid i antalet moduler och exporter (ungefär 80 ns per
  exportuppslag i Debug med 10 eller 400 moduler). Indexen byggs inuti
  registreringen: en avvisad modul lägger inte till någon post, och de ändras
  endast under serverns exklusiva lås.
- `resolve` skiljer mellan saknad modul och saknad export.
  `ResolvedFunction` fäster modulavbildningen; `call` kontrollerar aritet,
  argument och resultat och gör om värdundantag till fel.
- Native-kroppar måste vara synkrona, icke-blockerande och får inte behålla
  kontexten eller argumentspannet.
- En begränsad katalog över kända uppskjutna BIF:ar (`self/0`, `length/1`,
  `spawn/3`, `spawn_link/3`, `send/2`, `make_ref/0`, `garbage_collect/0`,
  `apply/3` (genererad kod anropar i stället `apply/2,3` genom tjänsterna för
  dynamiska anrop, [funs](funs.md#dynamic-calls)),
  `tuple_size/1`, `+/2`) rapporterar `not_implemented`; andra oregistrerade
  namn returnerar `unknown_builtin` tyst. Denna värdväg når inte
  produktionens inbyggda funktioner.
- Produktionens inbyggda funktioner finns i serverns `BuiltinRegistry`,
  registrerade vid runtimens uppstart; genererad kod, dynamiska anrop och
  funs når dem genom [bryggan för inbyggda funktioner](builtins.md).
- `CodeServer::export_frame` hittar `FrameDescriptor` för en export utifrån
  modul, funktionsatom och aritet; `function_frame` lägger till de inbyggda
  funktionerna för dynamiska anrop; `external_fun` internerar definitionerna
  av externa funs som byggs under körning.
- `CodeServer::unload` är uppskjuten; dynamisk laddning stöds inte.

## Persistenta termer

Källa: `memory/persistent_terms`. En tabell per runtime, som ägs av
`Runtime::Impl` och nås genom `ProcessContext::persistent_terms()`, håller
termerna för `persistent_term` (inbyggda funktioner: step 41M2).

- En nyckel och dess värde kopieras var för sig till en `MessageBuffer`
  ([meddelandebuffertar](runtime-heap.md#message-buffers)) utanför varje
  process, så att de överlever processen som lagrade dem och ingen
  skräpsamling flyttar dem.
- Poster hittas genom en hash av nyckeln (de inbyggda funktionerna använder
  termhashen från `phash2`) och exakt likhet, jämförd på plats i bufferten
  (`MessageBuffer::value`).
- En läsning kopierar värdet till läsarens heap (beslutat 2026-10-14). OTP
  delar i stället ut en referens in i ett literalområde och kopierar endast vid
  ersättning eller borttagning genom en global skräpsamling; Clauses
  admission godtar endast ord från processens egna områden, så literaler på
  plats skulle kräva en ny delad termregion. Kopiering håller varje processheap
  självständig: ett ersatt eller borttaget värde frigörs när den sista läsare
  som fortfarande kopierar det släpper sin buffertreferens, och ingen global
  skräpsamling behövs. Läsningar kostar värdets storlek
  ([skillnader](differences.md)).
- Ett delat lås betjänar läsare på valfritt antal arbetstrådar; put och erase
  tar det ensamma och kopierar aldrig medan de håller det. CTest
  `runtime_persistent_terms` täcker värden som överlever sin skrivare, ersatta
  värden som hålls av läsare, samtidiga läsare och skrivare samt frigjorda
  debiteringar.

## Schemaläggarens bokföring

`SchedulerService` ([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp))
registrerar endast processernas livscykel; den kör ingen kod.

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

Designskisser för arbetstrådar och processer finns i
[runtime/design/](../runtime/design/) och `runtime/include/{scheduler,process}.hpp`.
Meddelanden är implementerade ([processer](processes.md#messages)): en
sändning kopierar meddelandet in i mottagarens heap och lägger till det sist i
dess signalinkorg (`runtime/include/mailbox.hpp`).

## Trådar

Schemaläggarens arbetstrådar
([arbetstrådar](processes.md#workers)) kör processer på flera trådar i en
runtime. Tjänster som de delar är synkroniserade; allt annat förblir
begränsat till tråden som kör dess process eller skyddas av exekutorns mutex.

- Atomer: `AtomStorage` skyddar båda indexen med en delad mutex.
  Uppslagningar (`lookup`, `boolean`, `size`) delar den; `intern` slår upp
  under det delade låset och endast en ny stavning tar det exklusiva låset,
  kontrollerar igen och publicerar posten, så att kapplöpande internering av
  samma stavning får ett och samma ord. Orden förblir stabila: en post ändras
  eller tas aldrig bort före nedrivningen.
- Kod: `CodeServer` skyddar sina moduler och definitioner av
  externa funs med en delad mutex. Uppslagningar (`find_module`, `resolve`,
  `atom_word`, `record_definition`, `fun_definition`, `export_frame`,
  `function_frame`, `owns`) delar den; `load` och byggandet av en ny
  definition av en extern fun tar den exklusivt, så att samtidiga
  registreringar av samma namn publicerar en modul (de andra får
  `duplicate_module`) och kapplöpande `external_fun`-anrop får en definition.
  Registret för inbyggda funktioner fylls vid runtimens uppstart, innan någon
  arbetstråd körs, och läses endast därefter.
- Fästen: moduler tas aldrig bort medan runtimen lever (urladdning är
  uppskjuten) och servern förstörs efter varje kontext, så definitioner,
  ramar och atomplatser som den returnerat förblir giltiga för varje anrop och
  varje fun-cell. Handtag från `ResolvedFunction` och `find_module` behåller
  också sin modul efter att runtimen är borta.
- Pid-nummer: `ProcessNumbers` utfärdar nummer under ett exklusivt
  lås och godtar pid-ord under ett delat.
- Minne: redovisningen för hela runtimen (`RuntimeMemory`)
  debiterar och frigör med atomära operationer; en debitering tar aldrig
  redovisningen förbi en valfri gräns.
- Port-I/O: I/O-tjänstens läs-, skriv- och bevakningstrådar
  samt sockettråden ([portar](ports.md#io-thread)) rör processtillstånd
  endast genom exekutorns mutex.
- Länkning: på Linux lägger runtimen till `-pthread` för sina trådar; på
  Windows länkar den Winsock (`ws2_32`, `mswsock`) för socketar.

## Standard-utdata

`RuntimeOptions::standard_output` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
tar emot `erlang:display/1` och senare bytes för `standard_io`.
Standardimplementationen skriver till processens `stdout` genom C:s stdio
(buffrat); en värdmottagare returnerar `false` för att rapportera en
misslyckad skrivning.

`erlang:display/1` återger sitt argument i
[visningsstil](terms.md#printing), skriver texten och en radbrytning i en
enda skrivning och returnerar `true`. Återgivningsgränser och avvisade
skrivningar blir infrastrukturstatusar (`resource_limit`, `output_failure`,
...) i den kontrollerade kanalen, aldrig Erlang-undantag.

## Programuppstart

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) kör ett helt program åt den genererade `main`: den
kontrollerar varje deskriptors ABI, startar en standardruntime, registrerar
alla moduler före all ingångskod, bygger argv i ingångskontexten, anropar
ingångspunkten och översätter resultatet till avslutsstatusen för
[körbara filer](executables.md#exit-status). Rapporter går till stderr efter
att stdout har tömts; kontexten och runtimen rivs i ordning på varje väg.
`CLAUSE_halt_v1` implementerar `erlang:halt/0,1` (`abort` anropar
`std::abort`).

## Uppskjutna tjänster

Dessa rapporterar en rad `[feature] notimpl` ([funktioner](features.md)) och
ändrar inget tillstånd:

| Gräns | Fel |
| --- | --- |
| `TermFactory::port` (inga portar ännu), `reference(ReferenceIdentity)` och `function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` på en katalogiserad BIF | `Status::not_implemented` |
