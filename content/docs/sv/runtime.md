---
source: docs/runtime.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 2cf400ead0e2884a583331bb170855aa26c0961dcb974a1e54e32894bebbdbcf
translatedAt: 2026-10-26
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

Nedrivningsordning: stäng schemaläggarposter → förstör kontexter → släpp
kodregistreringar → förstör schemaläggartjänsten → atomtabellen sist.
Upplösta funktionshandtag håller kod vid liv efter runtimens nedrivning, men
deras atomplatsord fäster inga stavningar. Atomlagringen tar sina globala platser
ur bruk innan poster frigörs; stavningsåtkomst genom en överlevande icke-fast
atom-Term rapporterar `expired_context`.

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
  Värd-Terms är orotade enordsvärden; bygg om dem från omskrivna rötter efter
  skräpsamling. De saknar livstids- och inaktualitetskontroller och får inte
  läsas efter skräpsamling eller processens slut. Fabriker och reservationer
  behåller egna livstidstoken och rapporterar ännu `expired_context`.

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

- Varje nyckel och värde kopieras till ett eget område i runtimens intervall
  för persistenta termer (`memory/persistent_region`): en adressreservation
  (64 GiB adressrymd på 64-bitarsvärdar, 256 MiB på 32-bitarsvärdar) vars sidor
  tilldelas när områden allokeras, så att det bara krävs en intervalljämförelse
  för att avgöra om ett ord betecknar en persistent term. Kopior delar endast
  modulliteraler, så varje område är fristående; dess binaries delar buffertar.
- Poster är rotord som hittas via en hash av nyckeln (de inbyggda funktionerna
  använder termhashen från `phash2`) och exakt likhet, jämförd på plats.
- En läsning returnerar det lagrade ordet på plats, som OTP:s literala
  persistenta termer: varje process får hålla det; skräpsamlingar lämnar det
  orört och admissionen godtar det som en literal. Sändningar till andra
  processer, meddelandebuffertar och nya persistenta termer kopierar persistenta
  ord (en sändning går igenom sitt meddelande en gång, före exekverarlåset, så
  att den inte kan dela ett område som kan tas ur bruk under tiden).
- **Återvinning.** Ett ersatt eller raderat värdes område tas ur bruk under en
  ny epok. Därefter kopierar varje kopia dess ord, och varje process som var
  registrerad då kopierar de objekt den håller från området till sin egen heap
  vid en evakuerande fullständig skräpsamling (`Copier` med regionen, varje
  objekt en gång, binary-buffertar hålls före samlingen): en körande eller
  köad process i början av nästa tidskvantum, en parkerad direkt, genom den
  put eller erase som tog området ur bruk (`Executor::evacuate_parked`, under
  exekverarlåset). När varje sådan process gjort detta eller avslutats frigörs
  området. `info/0` räknar bara aktuella poster.
- Ett delat lås betjänar läsare på valfritt antal arbetare; put och erase tar
  det exklusivt (kopior görs innan). CTest `runtime_persistent_terms` täcker
  värden som överlever sin skrivare, läsningar på plats över skräpsamlingar
  och mellan processer, ersatta och raderade värden som läsare håller,
  samtidiga läsare och skrivare samt återvinning (kopior från områden som tas
  ur bruk, evakuering, frigjorda områden och minnesdebiteringar).

## ETS-tabeller

Ett register per runtime (`ets/tables`), som ägs av `Runtime::Impl` och nås
genom `ProcessContext::ets_tables()`, håller tabellerna för `ets`
([inbyggda funktioner](builtins.md#ets)).

- **Objekt.** Varje lagrat objekt (och en arvtagares data) är en `DetachedTerm`
  (`memory/detached_term`): en platt kopia i ett eget block, skapad av
  grafkopieringen, utanför alla heapar. Modulliteraler förblir delade;
  persistenta termer kopieras, eftersom deras områden kan tas ur bruk;
  binary-celler delar sina buffertar. Block flyttas aldrig och tillhör ingen
  process, så läsare jämför och hashar dem på plats och kopierar dem till sin
  egen heap. Deras ord debiteras runtimens minneskonto.
- **Index** (`ets/index`). Tabeller av typen `set`, `bag` och `duplicate_bag`
  använder ett hashindex: en array av hinkar vars antal är en tvåpotens, var
  och en en liten vektor av poster (en per nyckel, med objekt i
  insättningsordning), som fördubblas över två nycklar per hink och halveras
  under en på åtta. Nycklar hittas genom 64-bitars spridning av deras
  `phash2`-hash och exakt likhet. Tabeller av typen `ordered_set` använder en
  `std::set` med en nod per nyckel i termordning, där nycklar som jämförs lika
  (`1`, `1.0`) är en nyckel; när ett objekt ersätts behålls dess nod.
- **Delar och lås** (`ets/table`). En hashtabell med `write_concurrency`
  (`true` eller `auto`) delar sina nycklar i 64 delar efter hashens högsta
  bitar, var och en ett index med en egen `shared_mutex`; alla andra tabeller
  har en del. Tabellåset delas av operationer på enstaka nycklar och tas
  exklusivt av operationer på hela tabellen (listor av objekt,
  `delete_all_objects/1`, fixering, borttagning), så att en listinsättning är
  atomär och isolerad som i OTP. Läsningar kopierar ut objekt medan deras del
  är låst med ett delat lås.
- **Genomgångar och fixering.** En hashtabell gås igenom del för del och hink
  för hink, bakåt liksom framåt; `next/2` från en nyckel den inte innehåller
  ger `badarg`. Medan tabellen är fixerad (`safe_fixtable/2`, `foldl/3`)
  ändrar dess index aldrig storlek, en borttagen nyckel stannar som en
  borttagningsmarkör som håller ett objekt för sin nyckel, och nya nycklar
  läggs sist i sin hink, så att en genomgång ser varje kvarvarande nyckel en
  gång. När den sista fixeringen släpps tas markörerna bort och storleken
  justeras. En ordered_set går från valfri nyckel till den närmaste.
- **Register.** Tabeller efter identitetsnummer (en vanlig referens från
  programmets sekvens) och namn, samt de tabeller varje process äger eller
  fixerar. När en process avslutas (`Executor::release_tables`, under
  exekverarlåset innan länkar och monitorer signaleras) släpps dess fixeringar
  och varje tabell den ägde överförs till en levande arvtagare som inte är den
  själv, vilken får `{'ETS-TRANSFER', Table, From,
  HeirData}` (inget för en arvtagare satt utan data), eller tas bort.
  Låsordning: exekverarens, registrets, tabellens; inbyggda funktioner tar
  aldrig exekverarlåset medan de håller ett ETS-lås, och `give_away/3` skickar
  sitt meddelande efter att de släppts.
- **Portioner**. `tab2list/1` och urval av varje objekt (`select/2`,
  `select_reverse/2`, `match/2`, `match_object/2`, `select_count/2`) går igenom
  tabellen med så många objekt per portion som processens budget tillåter och
  lämnar sedan över körningen (`builtins/ets/table_walks.cpp`); en hashtabell
  fixeras av processen som går igenom den från dess första överlämning till
  slutet, som OTP fixerar den, så att dess platser ligger kvar.
  `delete_all_objects/1` och `delete/1` tömmer eller tar bort tabellen direkt
  genom att ta ut dess index (`Table::empty`, `Table::destroy`) och frigör
  sedan de gamla objekten i portioner (`builtins/ets/disposal.cpp`,
  `Index::shed`); en fixerad hashtabell töms i stället på plats och behåller
  sina borttagningsmarkörer. Tabeller som en avslutad ägare lämnar frigörs av
  arbetstråden efter att den släppt exekverarlåset. `select_delete/2` och
  `select_replace/2` körs fortfarande i ett stycke.
- **Räknare på plats.** `update_counter/3,4` på en nyckel vars objekt är
  tabellens egen kopia och vars räknare förblir små heltal ändrar de lagrade
  fälten där de finns, under delens lås, som OTP gör; ett bignum, ett objekt som
  är en modulliteral eller ett standardobjekt tar den allmänna vägen, som
  lagrar en ny kopia.
- CTest `executables_ets_concurrency` täcker räknare, insättningar och
  genomgångar från många processer på en och fyra arbetstrådar samt avslut av
  ägare till många tabeller; `executables_ets_portions` visar andra processer
  som körs under långa operationer på en arbetstråd.
- **Urval** ([matchningsspecifikationer](#match-specifications)). Ett urval
  över hela tabellen läser varje del under dess lås; ett vars huvuden alla
  binder nyckeln slår upp nycklarna. Ett portionsvis urval går igenom en
  hashtabell plats för plats (varje plats under sin dels lås) och en
  ordered_set efter nycklar från den senaste, så att en fortsättning anger en
  plats eller en nyckel. `select_delete/2` och `select_replace/2` ändrar varje
  del under dess eget lås (`Index::edit`); en fixerad hashtabell behåller under
  tiden borttagningsmarkörerna för borttagna nycklar.

## Matchningsspecifikationer

`runtime/src/match_spec/` kompilerar och kör matchningsspecifikationer som
OTP:s `erl_db_util.c` gör, för `ets` och `erlang:match_spec_test/3`
([inbyggda funktioner](builtins.md#ets)).

- **Program.** `compile` gör om en specifikation till ett `Program`: per klausul
  ett huvudmönster, guard- och kroppsuttryck över numrerade variabelplatser,
  samt variablerna som huvudet binder (`'$$'`). Konstanter beräknas som i OTP
  (`{{...}}` och `{const, X}` till värden; en konstant map behåller sina
  nycklar som de är skrivna) och behålls som `DetachedTerm`-kopior, så att ett
  program inte tillhör någon process. Två dialekter: `table` (ets) och `trace`
  (huvuden är argumentlistor, en lista som slutar med `'_'` matchar ett prefix,
  `'$N'` eller `'_'` hela listan; kroppar får köra spårningsåtgärder).
- **Kontroller.** Kompilatorn tillämpar OTP:s kontroller i OTP:s ordning och
  ger vid lintning (`erlang:match_spec_test/3`) OTP:s meddelanden för den
  första klausul som har några, med operander till anrop och tupler
  kompilerade från sista till första som i OTP; ett meddelande kapas vid 99
  byte som OTP:s buffert gör. Guard-funktionerna är OTP:s tabell
  (`match_spec/functions.cpp`), med de kontexter där var och en får anropas;
  nästling över 1000 nivåer ger `system_limit`.
- **Körning** (`match_spec/run.cpp`). Klausuler prövas i ordning. Ett huvud
  binder delar av objektet på plats (exakt likhet för konstanter och upprepade
  variabler, maps som innehåller minst mönstrets nycklar); guards läser dem på
  plats och måste ge exakt `true`; en kropp kopierar varje värde den ger till
  anroparens heap. En guard-funktion som kastar ett undantag får klausulen att
  misslyckas; i en kropp ger den `'EXIT'` i dess ställe och kroppen fortsätter,
  liksom `and`, `or`, `andalso` och `orelse` med en term som inte är ett
  booleskt värde. De flesta guard-funktioner är den omedelbara tjänstens
  termoperationer (`terms/immediate_terms.hpp`).
- **Kompilerade specifikationer** är handtagsreferenser som håller programmet
  (`match_spec/handles.cpp`), så att de överlever `term_to_binary/1` inom
  programmet som magiska referenser i OTP 20+ gör.

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

- Atomer: `AtomStorage` skyddar sin stavnings-map och ägda poster med ett delat
  mutex. `existing` och `size` delar det; `intern` slår först upp under det
  delade låset, tar sedan det exklusiva låset för en ny stavning och
  kontrollerar igen, så samtidiga interneringar får ett ord. Publicering
  använder processens gemensamma `detail::atom_table`; admission och
  stavningsläsningar använder dess låsfria nummerindex (`lookup` kontrollerar
  även postens ägare). Fasta atomer behöver inget lås. Poster förblir
  oförändrade tills nedrivningen tar deras platser ur bruk
  ([atomer](terms.md#atoms)).
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
  runtimen är borta; deras atomplatser behåller ord, inte fästen för
  stavningar.
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
