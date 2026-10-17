---
source: docs/runtime-heap.md
sourceCommit: a8c3f8f6
sourceSha256: cc0485350969c6f992d4987c8f893772eef2f3b1d7b9f3315e20c63541a45bc8
translatedAt: 2026-10-17
---
# Kontrakt för processheapen

Processheapar följer den klassiska ERTS-designen: ett sammanhängande heapblock
per process plus överflödesfragment, självbeskrivande celler, stora binaries i
delade buffertar utanför heapen, och en kopierande skräpsamlare som körs endast
vid säkra punkter (safe points). Den här anteckningen är kontraktet;
[runtime.md](runtime.md#process-memory) sammanfattar värdens API.

## Ordlayout

En term är ett målord (32 eller 64 bitar); kodningarna finns i
[abi.md](abi.md#terms). Varje heapområde är en sekvens av objekt som en
genomlöpare tolkar från dess första ord:

- **Huvudord** (primär tagg `00`): bitarna 2–6 innehåller `BoxedKind`, bit 7
  och uppåt antalet ord som följer efter huvudet. En boxad term pekar på sitt
  huvud. Antalet täcker varje prefix-, nyttolast- och utfyllnadsord, så att
  genomlöparen hoppar över ospårad nyttolast utan att tolka den. Det har 25
  bitar på 32-bitarsmål (högst 33 554 431 ord) och 57 på 64-bitarsmål
  (`BoxHeader::MAX_COUNT`): gränsen för tupelaritet (2^24 - 1) och den största
  bignum (131 072 ord på 32 bitar) ryms enligt statisk kontroll, maps
  kontrollerar det när de byggs, och cons-celler och celler av fast storlek har
  inget stort antal.
- **Cons-cell**: två termord (head, tail) utan huvud. En listterm pekar på
  head. Ett head är aldrig ett huvud eftersom ingen term har taggen `00`.
- **Utfyllnad**: ordet med enbart nollor (sort `tuple`, antal 0) är en
  utfyllnad på ett ord; sorten `filler` med antalet n täcker n ytterligare ord.
  Reservationer börjar nollställda, så reserverade men oanvända ord tolkas som
  utfyllnad. Icke-tomma tupler har alltid ett antal skilt från noll och `{}` är
  ett omedelbart värde.

Ingen cell behöver starkare justering än ett ord. `memory/heap_walk` tolkar ett
område cell för cell och `ProcessHeap::verify` kontrollerar en hel heap. Celler
innehåller bara ord och byte, utom binary-cellens `std::shared_ptr` för data
utanför heapen (nedan), så en cell flyttas genom att dess ord kopieras.

| Sort | Ord efter huvudet | Spårade ord |
| --- | --- | --- |
| cons (inget huvud) | 2 ord totalt | head, tail |
| `tuple` | n elementplatser | alla |
| `map` | 2n platser: nycklar i exakt termordning, var och en följd av sitt värde; högst 32 poster | alla |
| `tree_map` | antal poster, redigeringsord, rotens `map_node`: 3 ord ([map-träd](#map-trees)) | roten |
| `map_node` | antal poster under, redigeringsord, sedan n nycklar och n värden (ett löv) eller n barn (en gren); aldrig en term | nycklar och värden eller barn |
| `native_record` | adressen till runtimens `RecordDefinition`, sedan n fältvärden i definitionsordning | värden |
| `fun_closure` | adressen till runtimens `FunDefinition`, sedan n fångade värden ([funs](funs.md)) | värden |
| `bignum` | teckenord, sedan beloppets limbs, minst signifikant först | inga |
| `floating` | 8 byte: 1 ord (64 bitar) eller 2 ord (32 bitar) | inga |
| `reference` | 8 byte: referensnumret ([pids och referenser](terms.md#pids-and-references)) | inga |
| `heap_binary` | bitlängd, sedan databyte avrundade uppåt till ord (högst 64 byte) | inga |
| `refc_binary` | bitoffset, bitlängd, buffertens första byte (läses av genererad kod), slut och gräns för tillägg, `std::shared_ptr` (2 ord), länk för listan utanför heapen: 8 ord | inga |
| `sub_binary` | bitoffset in i originalet, bitlängd, originalets `heap_binary` eller `refc_binary` (aldrig en sub-binary): 3 ord | originalet |
| `filler` | n oanvända ord | inga |

Antalet för `map` anges i ord (poster = antal / 2). Pids och portar är
omedelbara värden som godtas mot de nummer runtime har utfärdat.

## Binaries utanför heapen

En binary större än 64 byte är en oföränderlig buffert som ligger utanför varje
processheap och delas genom referensräkning (BEAM:s ProcBin och `Binary`).

- Dess boxade `refc_binary`-cell innehåller en `std::shared_ptr` till bufferten,
  en bitoffset och en bitlängd. Delar av en stor binary (och delar av sådana)
  är `sub_binary`-celler som namnger originalcellen, så som ERTS sub-binaries
  gör: en del tar ingen buffertreferens och håller originalet vid liv. Att
  kopiera en cell till en annan process kopierar `shared_ptr`
  ([kopiering mellan heapar](#copying-between-heaps)), aldrig byten.
- Varje cell är länkad in i sin process lista utanför heapen via sitt länkord.
  Listan är det enda sättet att hitta dessa cellers C++-tillstånd.
- Att flytta en cell kopierar dess övriga ord och flyttkonstruerar
  `shared_ptr` in i den nya cellen, så att den gamla kopian inte äger något.
  Efter en skräpsamling länkar genomsökningen av listan om flyttade celler och
  förstör `shared_ptr` för döda celler; nedmonteringen förstör alla. En buffert
  frigörs när dess sista cell, i någon process, dör.
- Varje process räknar sina celler per buffert (`HeapStorage::buffers_`); en
  buffert debiteras en gång till varje process som refererar till den (dess ord
  utanför heapen, ERTS virtuella binary-heap) tills processens sista cell för
  den dör, och en gång till det runtime-omfattande kontot från skapandet tills
  bufferten frigörs.
- `std::shared_ptr` är två pekare i varje STL som stöds; en `static_assert`
  håller cellstorleken fast på åtta ord efter huvudet för båda bredderna.

### Handtagsreferenser

En handtagsreferens är en referens som också håller en buffert utanför heapen,
så som en magisk referens i OTP håller en resurs; `atomics`-arrayer lever i
dem ([atomics och counters](builtins.md#atomics-and-counters)).

- Dess cell har sorten `reference` och layouten för `refc_binary`: åtta ord
  efter huvudet, det 64-bitars referensnumret i offset- och bitlängdsorden (där
  en vanlig referenscell håller det), sedan `shared_ptr` och länkordet. Varje
  referenstjänst läser endast numret, så den jämförs, hashas, skrivs ut och
  kodas som en vanlig referens.
- Den listas, flyttas, genomsöks, debiteras och kopieras exakt som en
  binary-cell utanför heapen (`layout::off_heap_cell`); dess buffert frigörs
  när den sista kopian av referensen i någon process dör.
- Ett processomfattande register mappar numren för levande handtag till deras
  buffertar (svaga referenser), så att `binary_to_term/1` av ett kodat handtag
  återskapar ett handtag som delar bufferten medan den lever, och en vanlig
  referens därefter. Utgångna poster tas bort när registret växer.

## Map-träd

En map med fler än 32 poster (OTP:s `MAP_SMALL_MAP_LIMIT`) är en
`tree_map`-stubbe på 4 ord som namnger roten i ett persistent B+-träd
(`terms/map_tree`) vars noder är `map_node`-celler i samma heap, så som OTP
håller sina HAMT-noder på heapen. Mindre maps förblir `map`-celler.

- Löv håller upp till 16 nyckel- och värdeord i exakt nyckelordning; grenar
  håller upp till 16 barn med deras första nycklar, och varje nod räknar
  posterna under sig, så uppslagning och åtkomst via position är O(log n).
  Varje nod utom roten är minst halvfull.
- En uppdatering kopierar vägen till det ändrade lövet (cirka 35 ord per nivå)
  och delar varje annan nod med källmapen, som förblir oförändrad, så att bygga
  en map nyckel för nyckel kostar O(n log n) i stället för O(n^2). Den räknar
  först vägens ord och allokerar dem en gång; en misslyckad uppdatering rullar
  tillbaka dem.
- Noder är vanliga celler: skräpsamlingar flyttar, befordrar och frigör dem,
  döda versioner kostar ingenting, och de räknas i `heap_size`, inte som ord
  utanför heapen. Att kopiera en map till en annan heap (meddelanden) kopierar
  dess noder som vilka celler som helst.
- Varje stubbe och nod bär ett redigeringsord: token för den uppdatering som
  skapade den, ovanför en lövbit. Noder med uppdateringens egen token ändras på
  plats (en uppdatering av flera nycklar skriver varje nod en gång). Token som
  utfärdats före den senaste skräpsamlingen tillåter ingen ändring på plats,
  eftersom skräpsamlingen kan ha befordrat noderna, och en kopiering till en
  annan heap nollställer token.
- En ägd uppdatering (`MapOperation::update_owned`) vars källa kompilatorn har
  bevisat inte läses efteråt förbrukar källstubben (rot `[]`, storlek 0) och
  återanvänder dess token medan den är aktuell, så att den ändrar de noder som
  källans egen uppdatering skapade på plats och kopierar resten av vägen. En
  misslyckad ägd uppdatering ger tillbaka trädet till stubben. Kompilatorn
  markerar en uppdatering som ägd endast när funktionen själv byggde källmapen
  (`M = <map expression or
  comprehension>` i samma klausulkropp), inte läser `M` någon annanstans och
  aldrig fångar den i en fun (`semantic/map_ownership`).

## Områden

- **Heap.** Ett block `[start, top, end)` per process med bump-allokering. Det
  skapas av processens första allokering, med storleken
  `max(min_heap_words, request)` så att begäran alltid ryms (fragment börjar på
  minimum, högst 233 ord, och växer sedan, nedan), och ägs enbart av den
  processen. Genererad kod bump-allokerar små tupler, listor, flyttal och
  closures direkt i det via `FrameState::heap_top`/`heap_limit`:
  `HeapStorage::absorb` tar in de orden i top och `used_words_` före varje
  heapoperation (reservation, tillträde, skräpsamling, verifiering, frågor om
  användning) och `expose` visar de lediga orden igen efter en.
  Inline-allokering skapar aldrig ett fragment och är avstängd under en budget
  per process. När blocket har färre än 64 lediga ord visar `expose` i stället
  processens nyaste egna fragment (aldrig ett övertaget meddelandeblock), så att
  allokering mellan två safepoints, till exempel returerna i en kroppsrekursion,
  förblir inline efter att det första fragmentet öppnats (fragmentfönster). Utan
  budget är varje nytt fragment minst lika stort som fragmenten före det.
- **Literalområden.** Varje moduls sammansatta literaler — strängar och
  konstanta listor, tupler av konstanter, flyttal, bignum-literaler och
  konstanta binaries — läggs ut av kompilatorn som heapceller i en enda
  skrivskyddad global (`ModuleDescriptor::literals`), registrerad
  runtime-omfattande (`detail::LiteralAreas`, en låsfri sorterad
  ögonblicksbild) när modulen registreras. Termer i varje process får peka in i
  dem: tillträde och `TermAccess::object` läser celler via
  `HeapStorage::readable` (heap, fragment, sedan literaler); skräpsamlaren
  lämnar literalord som de är (`owned` förblir endast heap); kopior mellan
  heapar och in i meddelandebuffertar fortsätter peka på dem (en literalrot
  behöver ingen kopia); verifieraren godtar dem. Literaler innehåller endast
  omedelbara värden (endast fasta atomer) och andra literalers ord.
- **Fragment.** När en begäran inte ryms och heapen inte får flyttas hamnar den
  i det nyaste fragmentet om den ryms där, annars i ett nytt fragment av
  passande storlek (minst den minsta heapstorleken) som kedjas till processen.
  Nästa skräpsamling slår ihop fragmenten i det nya heapblocket. En reservation
  lever i ett område; återställning nollställer det områdets top och släpper ett
  fragment (eller heapblocket) som reservationen skapade. Allokering flyttar
  aldrig heapen: överflöd stannar i fragment till nästa safepoint eller
  skräpsamling från värden
  ([skräpsamling i genererad kod](#collection-in-generated-code)).
- **Stack.** Genererade ramar lever på en platt stack per process, skild från
  heapen (`ProcessStack`, [exekveringsmodell](execution-model.md#implementation)).
  Den har inget tak som standard; en valfri gräns per process,
  `StackOptions::limit_words`, begränsar den separat från heapen.
- **Lista utanför heapen.** Som ovan.
- **Gammalt område.** Objekt som har överlevt två skräpsamlingar
  ([generationer](#generations)); mindre skräpsamlingar (minor collections)
  lämnar det på plats, en fullständig genomsökning kopierar det in i det nya
  blocket och frigör det.

## Storlek och budget

- `min_heap_words` är processens `min_heap_size`: 233 ord som standard (som
  ERTS), `--min-heap-size` för varje process (ERTS `+hms`),
  `{min_heap_size, N}` i `spawn_opt` eller `process_flag(min_heap_size, N)` för
  en enskild; en inställning avrundas uppåt till en heapstorlek och blir aldrig
  lägre än runtimens standard, och `process_flag` gäller från nästa
  skräpsamling. Eftersom inget block är mindre samlar en process inte skräp
  innan den har allokerat så många ord.
- Heapen börjar på `min_heap_words` och växer längs ERTS storlekssekvens: 12,
  38, sedan är varje storlek summan av de två föregående plus ett upp till
  833 026 ord, därefter steg om 20 % (`heap_size_at_least`).
- En skräpsamlings nya block är den minsta sådana storlek som håller de ord det
  kan ta emot under 75 % av den: först alla använda ord, eftersom levande data
  inte är kända före kopieringen. Ett resultat med mindre än 25 % levande data
  kopieras en gång till in i den storlek som dess levande data behöver;
  misslyckas allokeringen av det blocket behålls det större. Inget av dem är
  mindre än `min_heap_words`. Båda storlekarna räknar processtackens ord som
  levande, eftersom ERTS håller stacken inuti heapblocket.
- Med en budget satt (nedan) rymmer ett nytt block högst sina levande ord plus
  hälften av den budget som återstår efter dem och buffertarna utanför heapen
  (`block_limit`), aldrig mindre än `min_heap_words`. Den andra hälften förblir
  ledig för fragment och nya buffertar utanför heapen, så att skräp som
  allokeras efter en skräpsamling når nästa safepoint som en utlösare i stället
  för att tömma budgeten. Den första kopian dimensioneras utifrån alla använda
  ord, så ett block över gränsen för de ord som överlevde kopieras en gång till
  in i sin policystorlek.
- Det finns inget minnestak som standard, varken per process eller för runtime:
  heapen växer tills värden vägrar ge minne (`out_of_memory`), medan
  dimensioneringen ovan håller den nära dess levande storlek. En valfri budget
  per process, `HeapOptions::limit_bytes` (standard `UNLIMITED_HEAP_BYTES`),
  täcker heapblocket, fragmenten och byten i de buffertar utanför heapen som
  processen refererar till; att överskrida den ger `limit_exceeded`. Under en
  skräpsamling samexisterar det gamla och det nya blocket; endast det nya blocket
  kontrolleras mot budgeten, begränsat till den budget som återstår efter
  buffertarna utanför heapen. En bufferts debitering återförs när processen
  släpper sin sista cell för den. Stacken behåller sitt eget valfria tak,
  `StackOptions::limit_words`. Program sätter båda taken med `--max-heap` och
  `--max-stack` ([runtime-alternativ](executables.md#runtime-options)).

## Heapblock

Heapblock, fragment och gamla områden kommer från `memory/heap_blocks`. Ett
block som en skräpsamling frigör stannar hos sin tråd för trådens nästa
skräpsamlingar (så som ERTS-bärare (carriers) behåller minne): ett nytt block
tar det minsta cachade blocket som är minst lika stort och högst dubbelt så
stort, annars nytt minne. Varje tråd behåller högst 8 block och 4M ord (32 MB
på 64-bitarsmål); block under 4 096 ord behålls inte, eftersom C++-heapens
fria listor betjänar dem billigt. Utan detta tog varje skräpsamlings målutrymme
(to-space) nya sidor från operativsystemet och betalade ett sidfel per sida det
rörde, och att frigöra ett stort block lämnade tillbaka dess sidor. Cachade
block debiteras inte någon process eller det runtime-omfattande kontot; en
tråd frigör sin cache när den avslutas.

## Minnesgräns för runtime

- En valfri runtime-omfattande gräns, `RuntimeOptions::memory_limit_bytes`
  (standard `UNLIMITED_HEAP_BYTES`; program sätter den med `--max-memory`),
  begränsar minnet för alla processer tillsammans: heapblock, fragment,
  buffertar utanför heapen och stackkapacitet. OTP har ingen sådan gräns; det
  närmaste är att köra VM:en under en minnesgräns i operativsystemet, men här
  misslyckas en process i stället för noden.
- Ett konto per runtime (`detail::RuntimeMemory`, delat av varje heaplagring
  och stack) debiteras när ett block, fragment, en buffert utanför heapen eller
  stackkapacitet skapas och krediteras när det släpps; en buffert som delas av
  flera processer debiteras en gång och krediteras när dess sista referens dör.
  Nedmonteringen återför varje debitering för processen.
  `Runtime::memory_bytes()` rapporterar summan.
- För varje process fungerar gränsen som en budget för den lagring den äger
  plus vad gränsen lämnar (`HeapStorage::budget`, `room`), så att
  dimensioneringen ovan håller hälften av det lediga minnet ledigt efter varje
  skräpsamling, och en begäran utöver den ger `limit_exceeded`
  (`resource_limit`) endast för den begärande processen; andra processer
  fortsätter att köra. En annan process skräp räknas tills den processen samlar
  skräp.
- En skräpsamlings målutrymme debiteras även utöver gränsen, eftersom det
  ersätter de block som den frigör i slutet av samma skräpsamling.
- Stacken fördubblas så länge gränsen tillåter det och växer sedan endast med
  den ram som pushas.

## Tillträde

Pekare in i en processheap skapas endast av kompilatorn och runtime inuti den
processen och namnger alltid början av ett objekt; det finns inga inre pekare
att upptäcka. Tillträde (admission) är en ägarskapskontroll för ord som lämnas
tillbaka till en process:

1. Adressen är ordjusterad inuti ett av processens områden, under dess `top`:
   heapblocket kontrolleras först, sedan fragmenten sorterade efter adress,
   sedan literalområdena ([områden](#areas)). Främmande och inaktuella ord
   misslyckas här utan någon läsning.
2. Ett boxat ord namnger ett huvud av en godtagen sort (inte utfyllnad); ett
   listord namnger en cons-cell (ett ord som inte är ett huvud).

Åtkomstfunktioner avkodar sort, antal och nyttolast från själva huvudet.
`verify()` förblir den fullständiga kontrollen av att varje plats namnger
början av ett objekt, för tester.

## Rötter och säkra punkter

`ProcessContext::visit_roots` räknar upp varje rotord för skräpsamlaren. Vid en
säker punkt håller ingenting annat heapord för processen:

| Ägare | Rotord | Anteckningar |
| --- | --- | --- |
| Ramens termplatser | De första `roots` platserna i varje ram på stacken | Bottenramar har inga; index för återupptagning och hanterare är heltal |
| Råa ramplatser | Inga | Spillda native-värden; genererad kod håller inget heapord där vid en säker punkt ([omläsningsregel](#reload-rule)) |
| Register | `x[0..live)` (`ProcessStack::keep_registers`) | En suspenderad ingångs argument; varje push och pop rensar `live` |
| Felkanal | Felnyttolast (BEAM:s `fvalue`), argumentlistan till `erlang:error/2,3`, stackspårstermen | Binds om på plats; fångade spårramar är deskriptorpekare in i koden |
| Trap-tillstånd | Termorden i en trappande inbyggd funktions `TrapState` ([portioner](builtins.md#portions)) | Frigörs när den inbyggda funktionen avslutas eller misslyckas |
| Processlexikon | Varje nyckel och värde | Tills de raderas eller processen avslutas |
| Brevlåda | Varje meddelande i signalinkorgen och meddelandekön, inklusive `'EXIT'`- och `'DOWN'`-meddelanden | Tills en receive tar det; skrivs om på plats, så receive-markören (en listposition) och tidsgränsen förblir giltiga |
| Explicita rötter | Det intervall som en värd skickar till `collect(roots)` | Läses tillbaka efter anropet |
| Lista utanför heapen | Inga | Länkar genomsöks och länkas om, de spåras inte |

Ingen heapcell håller ett lås. Atomer är omedelbara värden och atomtabellen
skräpsamlas aldrig. Fun-celler namnger kod via sin ospårade `FunDefinition`,
som lever lika länge som runtime; inlästa moduler avlastas aldrig, så varken
funs eller spårdeskriptorer behöver ett lås. Små omedelbara värden är inte
rötter.

Som i ERTS C-kod är en `Term` hos värden ett rått taggat ord som är giltigt
till nästa säkra punkt för dess heap; den låser inte heaplagringen
([ägarskap](terms.md#ownership)). En `Term` är giltig endast inuti sin egen
process; andra processer får bara läsa den.

Heapen flyttas endast vid en säker punkt, och aldrig medan en reservation är
öppen:

- en explicit `collect()` från värden medan kontexten inte kör någon genererad
  kod;
- en `collect()` medan körande genererad kod har deklarerat ett
  `SafePoint`-omfång och därmed lovat att den håller heapord endast i rötterna
  ovan. Runtime öppnar ett sådant endast vid de safepoints i genererad kod som
  beskrivs i nästa avsnitt.

Varje annan begäran returnerar `unsafe_point` och ändrar ingenting, inte ens
felkanalen för ett pågående genererat anrop. Allokering flyttar aldrig heapen:
en begäran som inte ryms skapar ett fragment.

## Meddelandebuffertar

En `MessageBuffer`
([message_buffer.hpp](../runtime/src/memory/message_buffer.hpp)) håller en term
utanför varje process: `copy_of` kopierar grafen från dess processheap till en
egen `HeapStorage` (egen livstidstoken, runtimens atomer och minneskonto,
binaries utanför heapen delade och hållna), med samma `GraphCopy` som en
sändning använder; `copy_to` kopierar den till en mottagares heap. Omedelbara
värden behöver ingen lagring. Bufferten skräpsamlas aldrig och frigörs med sin
sista ägare; dess block är exakt termens ord, oavsett avsändarens minsta heap.
Meddelanden till en process som körs på en annan arbetare
([arbetare](processes.md#workers)), timermeddelanden, monitortaggar och
[persistenta termer](runtime.md#persistent-terms) använder den, så de kodas
aldrig om.

**Överlämning av meddelanden.** En sändning vars meddelande tar minst
`MessageBuffer::ADOPTED_WORDS` (512) ord, räknat av en begränsad genomgång som
stannar där, bygger bufferten innan exekutorlåset tas, så att avsändaren inte
håller något lås under kopieringen. Mottagaren tar sedan över bufferten i
stället för att kopiera den (`MessageBuffer::take`, `HeapStorage::adopt`), när
bufferten inte har någon annan ägare och mottagaren har ett heapblock och ingen
budget: blocket ansluter till dess fragment på samma adresser, buffertens
listor för binaries och maps utanför heapen ansluter till mottagarens egna med
sina debiteringar, och bufferten lämnas tom. Ingen annan kan nå blocket före
eller efter, så inget ord kopieras två gånger. Övertagna fragment begär en
skräpsamling först när deras ord når det unga blockets, så som ERTS
meddelandefragment gör, och nästa skräpsamling behandlar dem som ung data.
Mindre meddelanden kopieras, som förut: det är billigare än ett fragment
vardera.

## Skräpsamling i genererad kod

Genererad kod samlar skräp endast vid några få **safepoints** där varje
levande term redan ligger i en rot. Allt annat, inklusive varje allokerande
tjänst, är en **kritisk sektion** som aldrig flyttar heapen.

### Utlösare

En safepoint samlar skräp när heapen begär det (`wants_collection()`); annars
kostar den en kontroll.

| Utlösare | Villkor vid safepointen | Motsvarighet i ERTS |
| --- | --- | --- |
| Full heap | Något fragment finns: en allokering rymdes inte i heapblocket sedan den senaste skräpsamlingen | Heapens top når heapens slut |
| Tryck från binaries utanför heapen (en mindre skräpsamling om inte den senaste frigjorde mindre än hälften, [binary-tryck](#generations)) | Orden utanför heapen når gränsen för den virtuella binary-heapen: 46 422 ord till en början, efter varje skräpsamling två gånger de överlevande orden utanför heapen eller de överlevande plus de levande heaporden, det som är störst (aldrig mindre än 46 422), men högst de överlevande plus hälften av den budget som lämnas ledig efter heapblocket | `bin_vheap_sz` / virtuell binary-heap |
| `erlang:garbage_collect/0,1,2` | En begäran från den inbyggda funktionen ([introspektion](processes.md#introspection)), tagen vid målets nästa safepoint | Explicit fullständig genomsökning |

En safepoint kör en **mindre skräpsamling** om inte en fullständig genomsökning
är aktuell: en `garbage_collect`-begäran, tryck från binaries utanför heapen,
en heapbudget, eller ett gammalt område utan plats för de mogna orden
([generationer](#generations)). Den publika `ProcessHeap::collect` är alltid en
fullständig genomsökning.

Det nya blocket dimensioneras för de levande orden **plus de stackord som
används** (ERTS håller stacken inuti heapblocket): en djup stack får en större
heap, så en lång rekursion samlar skräp i proportion till sin allokering i
stället för att genomsöka hela stacken med några hundra ords mellanrum.

### Safepoints

| Punkt | Var | Levande utanför ramens termplatser |
| --- | --- | --- |
| Funktionsingång | I `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (och därmed värdanrop), innan den anropades ram pushas; en inline-ingång tar denna väg närhelst heapen vill ha en skräpsamling | Den anropades argument `x[0..arity)`, behållna som rötter (`keep_registers`) |
| Loophuvud | `CLAUSE_safepoint_v1(context)` i huvudet på varje generatorloop i en comprehension, anropad endast medan heapen vill ha en skräpsamling | Ingenting |

Varje Erlang-loop är antingen rekursion, som passerar en funktionsingång per
steg, eller en comprehension, som passerar sitt loophuvud, så skräpet mellan
två safepoints begränsas av rak kod och enskilda tjänsteresultat.

Inte safepoints (kritiska sektioner, som fortsätter att allokera i fragment):
varje annan runtime-tjänst, inklusive allokerings-, konstruktions- och
matchningstjänster; `CLAUSE_return_v1`; propagering av undantag; och leverans
av meddelanden. Tjänster kan därför hålla råa heapord i C++ under hela sin
körning, och deras indataarrayer och utdata behöver ingen omläsning.

### Väntande och suspenderade processer

En process som inte körs skräpsamlas aldrig: den väntar i en receive, står i kö
efter en yield eller trap, eller har inte startat än, och allt den håller är
redan en rot (dess ramar, registren för den ingång eller fortsättning där den
ska återupptas, trap-tillstånd och dess meddelanden). Meddelanden som skickas
till den kopieras in i fragment av dess heap. Varje leverans väcker en väntande
process, och att återuppta den upprepar ingången till dess fortsättning (den
inbyggda vänta-funktionen, en trap-fortsättning eller den funktion där den
gjorde yield), vilket är en safepoint vid funktionsingång: det första en
återupptagen process gör är att samla skräp när dess heap begär det. En process
som väntar i en selektiv receive som hoppar över många meddelanden samlar
därför skräp allteftersom de anländer, på samma sätt som ERTS skräpsamlar en
process nästa gång den schemaläggs. Golden-testet
`executables_mailbox_collection` täcker hamstring, väntan med tidsgräns, djup
rekursion under meddelandelast och en konsument som kvitterar 3 000 meddelanden
inom `--max-heap 65536`.

Allokering är inte en safepoint (till skillnad från BEAM:s `test_heap`): det
skulle kräva att varje tjänsteindata och varje SSA-term som är levande över en
allokering låg i en rot, en omläsning efter varje allokerande tjänst och ett
protokoll för nya försök i varje tjänst, medan de två safepoints ovan redan
begränsar skräpet.

### Omläsningsregel

Inget SSA-värde (ett värde i ett native-register) håller ett heapord över en
safepoint, och ingen native-pekare korsar en överhuvudtaget (redan ett fel i
`lower_frames`).

- `lower_frames` behandlar ett safepoint-anrop i ett loophuvud som
  återupptagningspunkten för ett anrop: den delar blocket efter anropet och
  spiller varje värde som läses efter det och beräknades före det. Ett
  **termvärde** (en läsning från en termplats eller ett register, ett värde som
  lagras i en termplats eller en PHI av sådana värden) lagras efter sin
  definition i sin befintliga termplats eller en ny termplats som räknas i
  deskriptorns `roots`, och läses om före varje användning. Andra ord (små
  omedelbara värden, atomer, råa heltal, flaggor) behåller råa platser: en
  skräpsamling ändrar dem aldrig.
- Anrop spiller och läser om på samma sätt, termer till termplatser, så att
  ingångens safepoint ser varje levande term hos varje anropare.
- Rambasen förblir giltig över en safepoint i ett loophuvud, eftersom en
  skräpsamling skriver om stackord på plats och aldrig flyttar stacken; varje
  överföring läser om den i kroppens prolog som tidigare.
- Optimeringen körs efter `lower_frames` och kan inte ersätta en omläsning med
  det äldre SSA-värdet: ramadressen läses från kontextens `FrameState`, och
  det ogenomskinliga safepoint-anropet kan skriva varje plats via den
  ([prototyp](#prototype)).

### Beteende vid fel

- En skräpsamling vid en safepoint registrerar aldrig ett fel. När dess nya
  block inte kan allokeras (`out_of_memory`) förblir heapen som den är och
  exekveringen fortsätter med fragment.
- **Minnesuttömning.** Utan tak tar minnet slut endast när värden vägrar ett
  heapblock, ett fragment, en buffert utanför heapen eller stacktillväxt:
  `out_of_memory`. Med en valfri budget eller
  [runtime-omfattande gräns](#runtime-memory-limit) satt ger en begäran utöver
  den `limit_exceeded`, rapporterat som `resource_limit`. Båda är
  infrastrukturfel: ingen hanterare körs, ramarna avvecklas till bottenramen och
  ett program skriver ut
  `clau: runtime failure: entry call failed: <status>` och avslutas med status
  70 efter att ha tömt stdout och förstört processen
  ([körbara filer](executables.md#exit-status), [skillnader](differences.md)).
  Eftersom varje skräpsamling håller hälften av den budget som återstår efter
  dess överlevande ledig ([dimensionering](#sizing-and-budget),
  [utlösare](#triggers)), misslyckas en budget endast när den levande mängden
  inte längre ryms eller när rak kod mellan två safepoints allokerar mer än den
  hälften; skräpet samlas först.

### Implementation

- `ProcessStack::safepoint(live)` frågar `ProcessHeap::wants_collection()` (ett
  fragment finns, orden utanför heapen har nått `binary_limit_words_`, eller en
  skräpsamling har begärts), behåller `x[0..live)` som rötter, öppnar en
  `SafePoint` och samlar skräp; en misslyckad skräpsamling ignoreras. `enter`
  (och därmed `tail` och `invoke`) anropar den med den anropades aritet före
  push; `CLAUSE_safepoint_v1` anropar den med 0.
- Sänkningen (lowering) av comprehensions emitterar kontrollen för loophuvudet
  i huvudet på varje generatorloop (`lowering_comprehensions`).
- `lower_frames` delar varje kropp efter ett safepoint-anrop och spiller
  korsande värden som efter ett anrop. Argument anländer i register och lagras
  inte vid ingången: ett argument som korsar ett anrop eller en safepoint lagras
  i sin egen argumentplats efter att det anlänt. `home()` behåller
  argumentplatsen eller en termplats i samma block när en sådan håller värdet;
  annars får ett termvärde (`term_value`: läst
  från en termplats eller ett register, lagrat i en termplats eller en PHI av
  sådana) en ny termplats, som `place_slots` lägger till efter de inledande
  termplatserna före de råa platserna, och varje annat värde en rå plats.
- `collected_size` begränsar blocket till `block_limit(live)`; `shrink` körs
  också när blocket överskrider gränsen för de överlevande orden; `collect`
  begränsar `binary_limit_words_` till de överlevande plus hälften av den
  budget som lämnas ledig efter blocket.
- Täckning: OTP-golden-testerna `executables_garbage_collection` (mer än 64 MiB
  allokerat med en liten levande mängd: svansloopar, binaries utanför heapen,
  allokerande filter i comprehensions, djup kroppsrekursion, en fångad
  felnyttolast; med körningar med tak under `--max-heap`, `--max-stack` och
  `--max-memory`) och `executables_heap_growth` (72 MB behållna binaries);
  `runtime_collection` `near_budget` och `shared_limit` kontrollerar budgeten
  och den runtime-omfattande gränsen.

### Prototyp

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) innehåller en loop
i comprehension-stil i form efter `lower_frames` (`loop.ll`): en term `Y` som
beräknas före loopen lagras i en termplats och läses om efter safepointen i
loophuvudet. `python tests/prototypes/safepoint/run.py` kompilerar den för
`x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu`, `i686-pc-windows-msvc`
och `armv7-unknown-linux-gnueabihf` vid O0 och O2 och kontrollerar att en
läsning av `Y`:s ramord följer efter safepoint-anropet, så att optimeraren
aldrig återanvänder registret som höll `Y`.

## Skräpsamling

En Cheney-kopiering (`memory/heap_collect`), en fullständig genomsökning eller
en mindre skräpsamling ([generationer](#generations)): allokera först det nya
blocket (ett misslyckande ger `out_of_memory` och lämnar heapen orörd), markera
sedan värdens `Term`-objekt som inaktuella, kopiera objektet bakom varje rotord
och genomsök det nya blocket från vänster till höger medan barnen till varje
kopia kopieras. Ett flyttat boxat objekts huvud ersätts av en boxad pekare till
dess kopia; en flyttad cons-cell får ett nollställt head och en tail som pekar
på dess kopia. Vidarebefordran bevarar delning. Rötter skrivs om på plats,
listan utanför heapen genomsöks (kopior länkas om i listordning, döda celler
förstörs), och det gamla blocket och fragmenten frigörs. En heap som aldrig
allokerats skräpsamlas inte. `CollectionStats` rapporterar ord före, levande
ord, det nya heapblocket, de sammanslagna fragmenten, stackens platskapacitet
och ord utanför heapen.

## Generationer

Generationsbaserad skräpsamling, så som ERTS gör den, utan dess skrivbarriär:

- **Högvattenmärke.** Efter en skräpsamling har varje objekt i det nya blocket
  överlevt en; blockets top blir högvattenmärket. Nästa mindre skräpsamling
  kopierar det unga blocket och fragmenten, och **befordrar** objekt under
  märket till det gamla området och resten till ett nytt ungt block.
- **Gammalt område.** Ett block som aldrig flyttas mellan fullständiga
  genomsökningar; en mindre skräpsamling varken kopierar eller genomsöker det.
  Det skapas av den första mindre skräpsamling som befordrar, med storleken två
  gånger de mogna orden. När det inte kan ta emot de mogna orden kör
  safepointen i stället en fullständig genomsökning, som lämnar allt i det nya
  blocket under dess högvattenmärke och frigör det gamla området.
- **Invariant.** Ett oföränderligt objekt pekar endast på objekt som är äldre
  än det självt, så att befordran efter adress aldrig lämnar ett gammalt objekt
  som pekar på ett ungt. Runtimens skrivningar på plats bevarar detta:
  binary-loopar och binaries som kan utökas skriver heltal, och en
  map-uppdatering ändrar på plats endast noder som skapats sedan den senaste
  skräpsamlingen. Debugbyggen kontrollerar efter varje mindre skräpsamling att
  inget gammalt objekt pekar in i det unga blocket eller ett fragment.
- **Genomsökningar.** Listan över binaries utanför heapen behåller celler i det
  gamla området, länkar om vidarebefordrade och släpper döda unga; döda gamla
  celler väntar till nästa fullständiga genomsökning.
- **Storlek för unga.** En mindre skräpsamling behåller det unga blockets
  storlek, så som ERTS gör, och minst en åttondel av det gamla området (ERTS).
  Genererad kod samlar skräp endast vid safepoints, så allokering mellan två
  sådana (returerna i en kroppsrekursion) kan svämma över långt in i fragment;
  när de rymmer en fjärdedel av blocket eller mer växer nästa block med dem och
  krymps inte. Annars kopieras ett ungt block på över 8 000 ord med mindre än
  25 % levande data in i tre gånger dess levande ord (ERTS regel för mindre
  skräpsamlingar).
- **Gräns utanför heapen.** Efter en mindre skräpsamling räknar gränsen för den
  virtuella binary-heapen endast de unga levande orden: det gamla området kan
  innehålla döda ord, som inte får skjuta upp den fullständiga genomsökning som
  frigör döda gamla binaries.
- **Binary-tryck.** Att nå gränsen samlar den unga generationen, så som ERTS
  virtuella binary-heap gör, vilket frigör binaries för döda unga celler. När
  en sådan mindre skräpsamling frigör mindre än hälften av orden utanför heapen
  blir nästa skräpsamling på grund av binary-tryck en fullständig genomsökning,
  som också frigör binaries för döda gamla celler (`binary_sweep_due_`).

## Kopiering mellan heapar

`ProcessHeap::add(value)`, likvärdigt med `value.copy_to(heap)`, returnerar en
term i målheapen (BEAM:s `size_object` och `copy_struct`). Varje källcell slås
först upp i den föregåendes område, och en cons-cell behöver ingen tolkning:

- Omedelbara värden och atomer i samma runtime behöver ingen lagring, och en
  term i målheapen behåller sin identitet. En graf från en annan process i samma
  runtime kopieras; en annan runtimes graf ger `wrong_owner`, en utgången källa
  `expired_context` och ett källhandtag som är äldre än dess heaps senaste
  skräpsamling `stale_term`. Fabriker vägrar fortfarande främmande indata
  (`ProcessHeap::retain`), så endast en explicit kopiering flyttar en graf.
- Kopior är platta, som ERTS standard-`copy_struct` (utan dess valfria variant
  som bevarar delning): en delterm kopieras en gång per gång den nås, så
  `{T, T}` kopierar `T` två gånger, och en term vars delning fördubblas på varje
  nivå växer exponentiellt, som i OTP. En genomgång med en explicit stack
  (ingen rekursion) summerar orden för varje nått objekt; kopian är en
  reservation av den summan, i heapblocket eller ett fragment, fylld av en andra
  genomgång i samma ordning som läser varje cell igen och pekar varje plats på
  dess barns kopia. Ingen tabell mappar källobjekt till kopior, och endast
  binary-celler och map-stubbar behåller sina offsets.
- Kopian av en binary utanför heapen är en ny cell som delar bufferten; målet
  håller bufferten (och debiterar sina egna ord utanför heapen om det inte
  höll något av den) innan det reserverar, och listar cellen först efter att
  reservationen har bekräftats.
- Källan läses bara. Ett fel (`resource_limit` för målets budget eller
  runtime-gränsen, `out_of_memory` för värden) släpper hållen på buffertar och
  återställer reservationen, så att båda heaparna och varje debitering är som
  förut. En kopia äger ingen källagring: den överlever källans skräpsamling och
  nedmontering.

## Mätningar

`runtime_heap_measurements` (CTest i fullt läge; siffrorna skrivs ut, inga
gränsvärden) bygger en lista med 100 000 element av `{Index, Float}`-tupler via
`TermFactory`, går igenom den via kontrollerade åtkomstfunktioner, samlar skräp
med listan som enda rot och går igenom kopian, och skapar 1 000 kontexter som
var och en håller en liten tupel. Den rapporterar bygg- och genomgångstider,
använda heapord och kapacitet i heapord, sidobyte (värdallokeringar utöver
heapens underliggande lagring) samt byte och heapord per kontext.
