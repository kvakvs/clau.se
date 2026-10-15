---
source: docs/runtime-heap.md
sourceCommit: 6ed3851c
sourceSha256: 9883758a534ec454ceeb011c2dc1e6e2d1893aca483c1b3ca7f36f99319bc537
translatedAt: 2026-10-15
---
# Kontrakt för processheapen

Processheapar följer den klassiska ERTS-designen. Den här anteckningen är
kontraktet; plan 11 phase C levererade det, och senare steg som nämns nedan
utökar det. [runtime.md](runtime.md#process-memory) sammanfattar API:t.

## Vad phase C ersatte

| Före phase C | Problem | Ersättning |
| --- | --- | --- |
| En lista av block (chunks) som aldrig flyttas | Celler kan inte kompakteras eller kopieras; kapaciteten bara växer | Ett sammanhängande heapblock plus fragment, flyttat av en kopierande skräpsamlare (8G, 8H) |
| Varje cell är en nod i ett `std::map`-index per process | Heapord ensamma går inte att tolka; en värdallokering och en O(log n)-uppslagning per cell | Självbeskrivande celler; tillträde via ägt intervall och huvud (8C, 8D) |
| Varje bitstring-cell har en fast 64-byte-array och en `shared_ptr`, frigjord via ett destruktorregister | Stora celler för små data; ingenting kan flytta en cell eller hitta dess döda kopior | Heap-binaries av variabel storlek och binary-celler utanför heapen på en lista per process (8B) |
| Värdens `Term` låser heapen med `shared_ptr<HeapStorage>`; värden som runtime håller lever bara i `Term`-objekt | Ingenting som en skräpsamlare kan hitta eller skriva om | ERTS-modellen: C++ håller råa ord endast mellan safepoints; värden som runtime håller är processens rotord; värdanropare skickar explicita rötter till `collect()` (8E) |
| En heapbuffert per genererad rotram | Ingen processtack att genomsöka | En stack av rotramar per process (8F) |
| Inget överflödesområde | Allokeringen ryms antingen i budgeten eller misslyckas | Heapfragment medan heapen inte får flyttas (8G) |

Genererad kod, dess ABI och varje observerbart programresultat förblir
oförändrade.

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
område cell för cell och `ProcessHeap::verify` kontrollerar en hel heap (8C).
Celler innehåller bara ord och byte, utom binary-cellen utanför heapens
`std::shared_ptr` och trädpekaren i map-cellen utanför heapen (nedan), så en
cell flyttas genom att dess ord kopieras.

| Sort | Ord efter huvudet | Spårade ord |
| --- | --- | --- |
| cons (inget huvud) | 2 ord totalt | head, tail |
| `tuple` | n elementplatser | alla |
| `map` | 2n platser: nycklar i exakt termordning, var och en följd av sitt värde; högst 32 poster | alla |
| `tree_map` | antal poster, roten i trädet utanför heapen, länk för map-listan utanför heapen: 3 ord ([maps utanför heapen](#off-heap-maps)) | inga på heapen; trädets ord |
| `native_record` | adressen till runtimens `RecordDefinition`, sedan n fältvärden i definitionsordning | värden |
| `fun_closure` | adressen till runtimens `FunDefinition`, sedan n fångade värden ([funs](funs.md)) | värden |
| `bignum` | teckenord, sedan beloppets limbs, minst signifikant först | inga |
| `floating` | 8 byte: 1 ord (64 bitar) eller 2 ord (32 bitar) | inga |
| `reference` | 8 byte: referensnumret ([pids och referenser](terms.md#pids-and-references)) | inga |
| `heap_binary` | bitlängd, sedan databyte avrundade uppåt till ord (högst 64 byte) | inga |
| `refc_binary` | bitoffset, bitlängd, buffertens första byte (läses av genererad kod), slut och gräns för tillägg, `std::shared_ptr` (2 ord), länk för listan utanför heapen: 8 ord | inga |
| `sub_binary` | bitoffset in i originalet, bitlängd, originalets `heap_binary` eller `refc_binary` (aldrig en delbinär): 3 ord | originalet |
| `filler` | n oanvända ord | inga |

Antalet för `map` anges i ord (poster = antal / 2). Pids är omedelbara värden
som godtas mot de nummer runtime har utfärdat. Sorter som ännu inte godtas
(externa identiteter) följer samma regler när de kommer: identiteter och
deskriptorer är register-ID:n i ospårade ord, aldrig ägande C++-pekare.

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

## Maps utanför heapen

En map med fler än 32 poster (OTP:s `MAP_SMALL_MAP_LIMIT`) är en
`tree_map`-stubbe på 4 ord på heapen som namnger ett processprivat persistent
B+-träd (`terms/map_tree`). Mindre maps förblir `map`-celler.

- Löv håller upp till 32 nyckel- och värdeord i exakt nyckelordning; grenar
  håller upp till 32 barn med deras första nycklar och antal poster, så
  uppslagning och åtkomst via position är O(log n). Nyckel- och värdeord pekar
  in i ägarens heap: till skillnad från binaries håller trädet termer.
- En uppdatering kopierar vägen till varje ändrat löv och delar varje annan nod
  med källmapen, som förblir oförändrad, så att bygga en map nyckel för nyckel
  kostar O(n log n) i stället för O(n^2). Noder är referensräknade; noder som
  skapats av samma uppdatering bär dess redigeringstoken och ändras på plats
  tills stubben publiceras. En misslyckad uppdatering frigör det den byggt.
- Varje stubbe är länkad in i sin process map-lista utanför heapen. En
  skräpsamling kopierar en stubbe som vilken cell som helst och skriver, när den
  genomsöker kopian, om nyckel- och värdeorden i stubbens träd, och besöker
  varje delad nod en gång per skräpsamling. Genomsökningen av listan länkar
  sedan om flyttade stubbar och frigör träden för döda; nedmonteringen frigör
  alla.
- Nodord debiteras processen som ord utanför heapen (tillsammans med binaries:
  tillräckligt många begär en skräpsamling) och det runtime-omfattande kontot.
  Frigjorda noder behålls för återanvändning, upp till 1 024 av varje sort per
  process (högst cirka 1 MB), eftersom en vägkopierande uppdatering allokerar en
  nod per nivå och en skräpsamling frigör de gamla vägarna tillsammans.
- Att kopiera en map till en annan heap (meddelanden, `MessageBuffer`) bygger
  ett nytt träd i målet från de översatta posterna.
- En ägd uppdatering (`MapOperation::update_owned`) vars källa kompilatorn har
  bevisat inte läses efteråt tar över källstubbens trädreferens och ändrar på
  plats varje nod den når via odelade noder, och kopierar endast delade. Källstubben
  lämnas förbrukad (inget träd, storlek 0); en misslyckad ägd uppdatering ger
  tillbaka trädet till den. Kompilatorn markerar en uppdatering som ägd endast
  när funktionen själv byggde källmapen (`M = <map expression or
  comprehension>` i samma klausulkropp), inte läser `M` någon annanstans och
  aldrig fångar den i en fun (`semantic/map_ownership`).

## Områden

- **Heap.** Ett block `[start, top, end)` per process med bump-allokering (8G).
  Det skapas av processens första allokering, med storleken
  `max(min_heap_words, request)` så att begäran alltid ryms, och ägs enbart av
  den processen. Genererad kod bump-allokerar små tupler och listor direkt i
  det via `FrameState::heap_top`/`heap_limit`: `HeapStorage::absorb` tar in de
  orden i top och `used_words_` före varje heapoperation (reservation,
  tillträde, skräpsamling, verifiering, frågor om användning) och `expose` visar
  de lediga orden igen efter en. Inline-allokering skapar aldrig ett fragment
  och är avstängd under en budget per process.
- **Literalområden**. Varje moduls sammansatta literaler — strängar och
  konstanta listor, tupler av konstanter, flyttal och bignum-literaler — läggs
  ut av kompilatorn som heapceller i en enda skrivskyddad global
  (`ModuleDescriptor::literals`), registrerad runtime-omfattande
  (`detail::LiteralAreas`, en låsfri sorterad ögonblicksbild) när modulen
  registreras. Termer i varje process får peka in i dem: tillträde och
  `TermAccess::object` läser celler via `HeapStorage::readable` (heap,
  fragment, sedan literaler); skräpsamlaren lämnar literalord som de är
  (`owned` förblir endast heap); kopior mellan heapar och in i
  meddelandebuffertar fortsätter peka på dem (en literalrot behöver ingen
  kopia); verifieraren godtar dem. Literaler innehåller endast omedelbara värden
  (endast fasta atomer) och andra literalers ord.
- **Fragment.** När en begäran inte ryms och heapen inte får flyttas hamnar den
  i det nyaste fragmentet om den ryms där, annars i ett nytt fragment av
  passande storlek (minst den minsta heapstorleken) som kedjas till processen.
  Nästa skräpsamling slår ihop fragmenten i det nya heapblocket. En reservation
  lever i ett område; återställning nollställer det områdets top och släpper ett
  fragment (eller heapblocket) som reservationen skapade. Allokering flyttar
  aldrig heapen: överflöd stannar i fragment till nästa safepoint eller
  skräpsamling från värden
  ([skräpsamling i genererad kod](#collection-in-generated-code)).
- **Stack.** Genererade ramar (BEAM:s Y-register) lever på en platt stack per
  process, skild från heapen (`ProcessStack`). Varje ram är ett huvud
  på fyra ord (anroparens huvudoffset, deskriptor, återupptagning, hanterare)
  följt av termplatser (inklusive spillda termer) och råa spillplatser; ramar
  länkas via offsets, så blocket växer genom fördubbling och flyttas. Det har
  inget tak som standard; en valfri gräns per process,
  `StackOptions::limit_words`, begränsar den separat från heapen
  ([exekveringsmodell](execution-model.md#implementation)).
- **Lista utanför heapen.** Som ovan.
- **Gammal heap.** Ingen. Generationsbaserad skräpsamling är uppskjuten;
  oföränderliga termer pekar aldrig från äldre till nyare data, så en
  högvattenmarkering och en gammal heap kan läggas till senare utan att cellerna
  ändras.

## Storlek och budget

- Heapen börjar på `min_heap_words` (233 ord, som ERTS) och växer längs ERTS
  storlekssekvens: 12, 38, sedan är varje storlek summan av de två föregående
  plus ett upp till 833 026 ord, därefter steg om 20 % (`heap_size_at_least`).
- En skräpsamlings nya block är den minsta sådana storlek som håller de ord det
  kan ta emot under 75 % av den: först alla använda ord, eftersom levande data
  inte är kända före kopieringen. Ett resultat med mindre än 25 % levande data
  kopieras en gång till in i den storlek som dess levande data behöver (8H);
  misslyckas allokeringen av det blocket behålls det större. Inget av dem är
  mindre än `min_heap_words`. Båda storlekarna räknar processtackens ord som
  levande, eftersom ERTS håller stacken inuti heapblocket.
- Med en budget satt (nedan) rymmer ett nytt block högst sina levande ord plus
  hälften av den budget som återstår efter dem och buffertarna utanför heapen
  (`block_limit`), aldrig mindre än `min_heap_words`. Den andra
  hälften förblir ledig för fragment och nya buffertar utanför heapen, så att
  skräp som allokeras efter en skräpsamling når nästa safepoint som en utlösare
  i stället för att tömma budgeten. Den första kopian dimensioneras utifrån alla
  använda ord, så ett block över gränsen för de ord som överlevde kopieras en
  gång till in i sin policystorlek.
- Det finns inget minnestak som standard, varken per process eller för runtime:
  heapen växer tills värden vägrar ge minne (`out_of_memory`), medan
  dimensioneringen ovan håller den nära dess levande storlek. En valfri budget
  per process, `HeapOptions::limit_bytes` (standard `UNLIMITED_HEAP_BYTES`),
  täcker heapblocket, fragmenten och byten i de buffertar utanför heapen som
  processen refererar till; att överskrida den ger `limit_exceeded`. Under en
  skräpsamling samexisterar det gamla och det nya blocket; endast det nya blocket
  kontrolleras mot budgeten, begränsat till den budget som återstår efter
  buffertarna utanför heapen. En buffert debitering återförs när processen
  släpper sin sista cell för den. Stacken behåller sitt eget valfria tak,
  `StackOptions::limit_words`. Program sätter båda taken med `--max-heap` och
  `--max-stack` ([runtime-alternativ](executables.md#runtime-options)).

## Minnesgräns för runtime

- En valfri runtime-omfattande gräns, `RuntimeOptions::memory_limit_bytes`
  (standard `UNLIMITED_HEAP_BYTES`; program sätter den med `--max-memory`),
  begränsar minnet för alla processer tillsammans: heapblock, fragment,
  buffertar utanför heapen och stackkapacitet. OTP har ingen sådan
  gräns; det närmaste är att köra VM:en under en minnesgräns i operativsystemet,
  men här misslyckas en process i stället för noden.
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
- En skräpsamlings målutrymme (to-space) debiteras även utöver gränsen,
  eftersom det ersätter de block som den frigör i slutet av samma skräpsamling.
- Stacken fördubblas så länge gränsen tillåter det och växer sedan endast med
  den ram som pushas.

## Tillträde

Pekare in i en processheap skapas endast av kompilatorn och runtime inuti den
processen och namnger alltid början av ett objekt; det finns inga inre pekare
att upptäcka. Tillträde (8D) är en ägarskapskontroll för ord som lämnas tillbaka
till en process:

1. Adressen är ordjusterad inuti ett av processens områden, under dess `top`:
   heapblocket kontrolleras först, sedan fragmenten sorterade efter adress.
   Främmande och inaktuella ord misslyckas här utan någon läsning.
2. Ett boxat ord namnger ett huvud av en godtagen sort (inte utfyllnad); ett
   listord namnger en cons-cell (ett ord som inte är ett huvud).

Åtkomstfunktioner avkodar sort, antal och nyttolast från själva huvudet.
`verify()` förblir den fullständiga kontrollen av att varje plats namnger
början av ett objekt, för tester.

## Rötter och safepoints

`ProcessContext::visit_roots` räknar upp varje rotord för skräpsamlaren. Vid en
safepoint håller ingenting annat heapord för processen:

| Ägare | Rotord | Anteckningar |
| --- | --- | --- |
| Ramens termplatser | De första `roots` platserna i varje ram på stacken | Bottenramar har inga; index för återupptagning och hanterare är heltal |
| Råa ramplatser | Inga | Spillda native-värden; genererad kod håller inget heapord där vid en safepoint (omläsningsregeln från step 24) |
| Register | `x[0..live)` (`ProcessStack::keep_registers`) | En suspenderad ingångs argument; varje push och pop rensar `live` |
| Felkanal | Felnyttolast (BEAM:s `fvalue`), argumentlistan till `erlang:error/2,3`, stackspårstermen | Binds om på plats; fångade spårramar är deskriptorpekare in i koden |
| Trap-tillstånd | Termorden i en trappande inbyggd funktions `TrapState` | Frigörs när den inbyggda funktionen avslutas eller misslyckas |
| Processlexikon | Varje nyckel och värde | Tills de raderas eller processen avslutas |
| Brevlåda | Varje meddelande i signalinkorgen och meddelandekön, inklusive `'EXIT'`- och `'DOWN'`-meddelanden | Tills en receive tar det; skrivs om på plats, så receive-markören (en listposition) och tidsgränsen förblir giltiga |
| Explicita rötter | Det intervall som en värd skickar till `collect(roots)` (8E) | Läses tillbaka efter anropet |
| Lista utanför heapen | Inga | Länkar genomsöks och länkas om, de spåras inte |
| Maps utanför heapen | Inga direkt: nyckel- och värdeorden i trädet för varje stubbe som skräpsamlingen kopierar | Skrivs om när den kopierade stubben genomsöks; listan genomsöks som binary-listan |

Ingen heapcell håller ett lås. Atomer är omedelbara värden och atomtabellen
skräpsamlas aldrig. Fun-celler namnger kod via sin ospårade `FunDefinition`,
som lever lika länge som runtime; inlästa moduler avlastas aldrig, så varken
funs eller spårdeskriptorer behöver ett lås. Små omedelbara värden är inte
rötter.

Som i ERTS C-kod är en `Term` hos värden ett rått taggat ord som är giltigt
till nästa safepoint för dess heap. Den låser inte heaplagringen; den håller en
svag livstidstoken för kontexten och heapens skräpsamlingsräknare, så
användning efter nedmontering rapporterar `expired_context` och användning
efter en senare skräpsamling rapporterar ett fel för inaktuell term. En `Term`
är giltig endast inuti sin egen process; andra processer får bara läsa den.

Heapen flyttas endast vid en safepoint, och aldrig medan en reservation är
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
sista ägare. Timermeddelanden använder den, så de kodas aldrig om.

## Skräpsamling i genererad kod

Implementerat i step 26
([implementation](#implementation)). Genererad kod samlar skräp endast vid
några få **safepoints** där varje levande term redan ligger i en rot. Allt
annat, inklusive varje allokerande tjänst, är en **kritisk sektion** som aldrig
flyttar heapen.

### Utlösare

En safepoint samlar skräp när heapen begär det; annars kostar den en kontroll.

| Utlösare | Villkor vid safepointen | Motsvarighet i ERTS |
| --- | --- | --- |
| Full heap | Något fragment finns: en allokering rymdes inte i heapblocket sedan den senaste skräpsamlingen | Heapens top når heapens slut |
| Tryck från binaries utanför heapen | Orden utanför heapen når gränsen för den virtuella binary-heapen: 46 422 ord till en början, efter varje skräpsamling två gånger de överlevande orden utanför heapen eller de överlevande plus de levande heaporden, det som är störst (aldrig mindre än 46 422; amorterade binary-skräpsamlingar), men högst de överlevande plus hälften av den budget som lämnas ledig efter heapblocket | `bin_vheap_sz` / virtuell binary-heap |
| `erlang:garbage_collect/0` | Alltid; kommer med familjerna av inbyggda funktioner (steps 36-37) som en tvingad safepoint | Explicit fullständig genomsökning |

Det nya blocket dimensioneras för de levande orden **plus de stackord som
används** (ERTS håller stacken inuti heapblocket): en djup stack får en större
heap, så en lång rekursion samlar skräp i proportion till sin allokering i
stället för att genomsöka hela stacken med några hundra ords mellanrum.

### Safepoints

| Punkt | Var | Levande utanför ramens termplatser |
| --- | --- | --- |
| Funktionsingång | I `CLAUSE_enter_v1` / `CLAUSE_tail_v1` (och därmed värdanrop), innan den anropades ram pushas | Den anropades argument `x[0..arity)`, behållna som rötter (`keep_registers`) |
| Loophuvud | Ett anrop av `CLAUSE_safepoint_v1(context)` i huvudet på varje generatorloop i en comprehension | Ingenting |

Varje Erlang-loop är antingen rekursion, som passerar en funktionsingång per
steg, eller en comprehension, som passerar sitt loophuvud, så skräpet mellan
två safepoints begränsas av rak kod och enskilda tjänsteresultat.

Inte safepoints (kritiska sektioner, som fortsätter att allokera i fragment):
varje annan runtime-tjänst, inklusive allokerings-, konstruktions- och
matchningstjänster; `CLAUSE_return_v1`; propagering av undantag; och senare
leverans av meddelanden. Tjänster kan därför hålla råa heapord i C++
under hela sin körning, och deras indataarrayer och utdata behöver ingen
omläsning.

### Väntande och suspenderade processer

En process som inte körs skräpsamlas aldrig: den väntar i en
receive, står i kö efter en yield eller trap, eller har inte startat än, och
allt den håller är redan en rot (dess ramar, registren för den ingång eller
fortsättning där den ska återupptas, trap-tillstånd och dess meddelanden).
Meddelanden som skickas till den kopieras in i fragment av dess heap. Varje
leverans väcker en väntande process, och att återuppta den upprepar ingången
till dess fortsättning (den inbyggda vänta-funktionen, en trap-fortsättning
eller den funktion där den gjorde yield), vilket är en safepoint vid
funktionsingång: det första en återupptagen process gör är att samla skräp när
dess heap begär det. En process som väntar i en selektiv receive som hoppar
över många meddelanden samlar därför skräp allteftersom de anländer, på samma
sätt som ERTS skräpsamlar en process nästa gång den schemaläggs.
`executables_mailbox_collection` kontrollerar hamstring, väntan med tidsgräns
och djup rekursion under meddelandelast, och att en konsument som kvitterar
3 000 meddelanden håller sig inom `--max-heap 65536`.

Förkastat: allokering som safepoint (BEAM:s `test_heap`). Det skulle kräva att
varje tjänsteindata och varje SSA-term som är levande över en allokering låg i
en rot, en omläsning efter varje allokerande tjänst och ett protokoll för nya
försök i varje tjänst, medan de två safepoints ovan redan begränsar skräpet.

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
  (prototyp nedan).

### Beteende vid fel

- En skräpsamling vid en safepoint registrerar aldrig ett fel. När dess nya
  block inte kan allokeras (`out_of_memory`) förblir heapen som den är och
  exekveringen fortsätter med fragment.
- **Minnesuttömning**. Utan tak tar minnet slut endast när värden
  vägrar ett heapblock, ett fragment, en buffert utanför heapen eller
  stacktillväxt: `out_of_memory`. Med en valfri budget eller
  [runtime-omfattande gräns](#runtime-memory-limit) satt ger en begäran utöver
  den `limit_exceeded`, rapporterat som `resource_limit`. Båda är
  infrastrukturfel: ingen hanterare körs, ramarna avvecklas till bottenramen och
  ett program skriver ut `clau: runtime failure: entry call failed: <status>`
  och avslutas med status 70 efter att ha tömt stdout och förstört processen
  ([körbara filer](executables.md#exit-status), [skillnader](differences.md)).
  Eftersom varje skräpsamling håller hälften av den budget som återstår efter
  dess överlevande ledig ([dimensionering](#sizing-and-budget),
  [utlösare](#triggers)), misslyckas en budget endast när den levande mängden
  inte längre ryms eller när rak kod mellan två safepoints allokerar mer än den
  hälften; skräpet samlas först.

### Implementation

- `ProcessStack::safepoint(live)` frågar `ProcessHeap::wants_collection()` (ett
  fragment finns, eller orden utanför heapen har nått `binary_limit_words_`),
  behåller `x[0..live)` som rötter, öppnar en `SafePoint` och samlar skräp; en
  misslyckad skräpsamling ignoreras. `enter` (och därmed `tail` och `invoke`)
  anropar den med den anropades aritet före push; `CLAUSE_safepoint_v1`
  anropar den med 0.
- Sänkningen av comprehensions emitterar `CLAUSE_safepoint_v1` i huvudet på
  varje generatorloop (`lowering_comprehensions`).
- `lower_frames` delar varje kropp efter ett safepoint-anrop och spiller
  korsande värden som efter ett anrop. `home()` behåller argumentplatsen eller
  en termplats i samma block när en sådan håller värdet; annars får ett
  termvärde (`term_value`: läst från en termplats eller ett register, lagrat i
  en termplats eller en PHI av sådana) en ny termplats, som `place_slots` lägger
  till efter de inledande termplatserna före de råa platserna, och varje annat
  värde en rå plats.
- Golden `executables_garbage_collection` (genererad av OTP) allokerar mer än
  64 MiB med en liten levande mängd: en svansloop som bygger en sträng på 400
  ord per steg, 9 000 binaries på 8 KiB utanför heapen, en comprehension vars
  filter allokerar per element, kroppsrekursion 20 000 nivåer djup som håller
  en nästlad term (tupel, lista, binary) per ram, och en felnyttolast som fångas
  efter avveckling av allokerande ramar och behålls genom en lång allokerande
  loop.

- `collected_size` begränsar blocket till `block_limit(live)`; `shrink` körs
  också när blocket överskrider gränsen för de överlevande orden; `collect`
  begränsar `binary_limit_words_` till de överlevande plus hälften av den
  budget som lämnas ledig efter blocket.
- Tidigare kunde ett block ta hela den återstående budgeten (dimensionerat
  utifrån använda ord inklusive skräp) och den virtuella binary-heapen kunde
  överskrida den när de överlevande passerade halva budgeten, så att
  allokeringar misslyckades med skräp som ännu inte samlats: under den då
  gällande standardbudgeten på 64 MiB misslyckades en 64-bitarskörning som
  behöll 700 binaries på 64 KiB och släppte fyra per steg vid 68 % levande; med
  taken ryms 1 010 (99 %).
- Standardbudgeten på 64 MiB för heapen och budgeten på 2^24 ord för stacken
  togs bort (användarens anvisning): båda är valfria per process
  (`Runtime::create_context(HeapOptions, StackOptions)`), utan tak som standard.
- Golden `executables_heap_growth` behåller 1 100 binaries på 65 540 byte
  (72 MB) medan den släpper fyra per steg och skriver ut antalet som OTP gör.
  `runtime_collection` `near_budget` kontrollerar båda taken med en budget på
  10 000 ord (heapblock och buffertar utanför heapen).

- Runtime-omfattande gräns och `--max-heap`, `--max-stack`, `--max-memory`
  ([minnesgräns för runtime](#runtime-memory-limit)). Handskrivna golden-körningar
  bevisar återigen begränsat minne: `garbage_collection` `churn` och `binaries`
  under en runtime-gräns på 1 MiB, `comprehension` under ett heaptak på 1 MiB
  och `payload` under en runtime-gräns på 16 MiB (var och en allokerar mer än
  64 MiB); `tail_calls` loopar under en stack på 4 KiB och ett heaptak på
  64 KiB; `deep` under 1 MiB och `deep_recursion` `build` under en stack på
  64 KiB misslyckas med `resource_limit`. `deep` självt behöver cirka 100 MiB
  vid O0 (levande ramar håller inaktuella termer och är cirka 130 ord vardera),
  så den har ingen lyckad körning med tak. `runtime_collection`
  `shared_limit`: två processer under en gräns på 40 000 ord; hållarens block
  stannar vid 28 000 ord, den andra samlar 20 omgångar skräp nära gränsen och
  misslyckas sedan med en lista på 16 000 ord med `resource_limit` medan
  hållaren fortsätter att allokera, och nedmonteringen återför varje
  debitering.

### Prototyp

[tests/prototypes/safepoint](../tests/prototypes/safepoint/) innehåller en loop
i comprehension-stil i form efter `lower_frames` (`loop.ll`): en term `Y` som
beräknas före loopen lagras i en termplats och läses om efter safepointen i
loophuvudet. `python tests/prototypes/safepoint/run.py` kompilerar den för
`x86_64-pc-windows-msvc`, `aarch64-unknown-linux-gnu` (64-bitarsord),
`i686-pc-windows-msvc` och `armv7-unknown-linux-gnueabihf` (32-bitarsord) vid
O0 och O2 och kontrollerar att en läsning av `Y`:s ramord följer efter
safepoint-anropet. Alla åtta godkänns med clang 23.1.2. Vid O2 (i686) behåller
loopen omläsningen från platsen och återanvänder aldrig registret som höll `Y`:

```text
LBB0_2:                     # loop head
    pushl  %edi
    calll  _clause_safepoint_v1
    pushl  20(%esi)         # cursor reloaded from its term slot
    ...
    pushl  24(%esi)         # accumulator
    pushl  28(%esi)         # Y reloaded from its term slot
    calll  _make
```

## Skräpsamling

En Cheney-kopiering med fullständig genomsökning (8H, `memory/heap_collect`):
allokera först det nya blocket (ett misslyckande ger `out_of_memory` och lämnar
heapen orörd), markera sedan värdens `Term`-objekt som inaktuella, kopiera
objektet bakom varje rotord och genomsök det nya blocket från vänster till
höger medan barnen till varje kopia kopieras. Ett flyttat boxat objekts huvud
ersätts av en boxad pekare till dess kopia; en flyttad cons-cell får ett
nollställt head och en tail som pekar på dess kopia. Vidarebefordran bevarar
delning. Rötter skrivs om på plats, listan utanför heapen genomsöks (kopior
länkas om i listordning, döda celler förstörs), och det gamla blocket och
fragmenten frigörs. En heap som aldrig allokerats skräpsamlas inte.
`CollectionStats` rapporterar ord före, levande ord, det nya heapblocket, de
sammanslagna fragmenten, stackens platskapacitet och ord utanför heapen.

## Kopiering mellan heapar

`ProcessHeap::add(value)`, likvärdigt med `value.copy_to(heap)`, returnerar en
term i målheapen (BEAM:s `size_object` och `copy_struct`):

- Omedelbara värden och atomer i samma runtime behöver ingen lagring, och en
  term i målheapen behåller sin identitet. En graf från en annan process i samma
  runtime kopieras; en annan runtimes graf ger `wrong_owner`, en utgången källa
  `expired_context` och ett källhandtag som är äldre än dess heaps senaste
  skräpsamling `stale_term`. Fabriker vägrar fortfarande främmande indata
  (`ProcessHeap::retain`), så endast en explicit kopiering flyttar en graf.
- En genomgång med en explicit stack (ingen rekursion) hittar varje distinkt
  objekt som kan nås från värdet, med adressen som nyckel, så intern delning
  överlever: `{T, T}` kopierar `T` en gång, till skillnad från ERTS standard för
  `copy_struct`, som plattar ut delning. Adresserna läggs i en map med öppen
  adressering (`boost::unordered_flat_map`). Kopian är en reservation av summan
  av deras ord, i heapblocket eller ett fragment, fylld i genomgångsordning med
  pekare omskrivna till kopiorna.
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
`TermFactory`, går igenom den via kontrollerade åtkomstfunktioner och skapar
1 000 kontexter som var och en håller en liten tupel. Sedan 8I samlar den också
skräp med listan som enda rot och går igenom kopian. Sidobyte är
värdallokeringar utöver heapens underliggande lagring (ett objektindex före 8D,
fragmentkedjan sedan 8G).

| Revision | Bygge | Kärnbygge / genomgång | Använda / kapacitet heapord | Sidobyte | Byte per kontext | Heapord per kontext |
| --- | --- | --- | --- | --- | --- | --- |
| `bb09359` (blocklista, objektindex) | Windows x64 Debug, clang-cl | 264 / 81 ms | 700 000 / 704 512 | 24 002 256 (cirka 80 per cell) | 66 217 | 8 192 |
| 8D (blocklista, ägt intervall) | Windows x64 Debug, clang-cl | 185 / 147 ms | 700 000 / 704 512 | 3 440 | 66 057 | 8 192 |
| 8G (heap på 233 ord, cirka 3 000 fragment) | Windows x64 Debug, clang-cl | 219 / 174 ms | 700 000 / 706 223 | 163 878 | 2 377 | 233 |
| 8I, före skräpsamling | Windows x64 Debug, clang-cl | 216 / 173 ms | 700 000 / 706 223 | 163 878 | 2 377 | 233 |
| 8I, efter en skräpsamling | Windows x64 Debug, clang-cl | skräpsamling 56 ms / genomgång 72 ms | 700 000 / 999 631 | 0 | — | — |

Jämfört med baslinjen `bb09359`: metadata vid sidan av varje cell är borta
(24 MB till ingenting efter skräpsamling), en kontext behöver 2,4 KB och 233
heapord i stället för 66 KB och 8 192 ord, byggandet är cirka 20 % snabbare, och
genomgången är långsammare tills en skräpsamling slår ihop fragmenten
(tillträde för fragment är en binärsökning över cirka 3 000 intervall); efter en
sådan tar genomgången 72 ms. En levande mängd på 700 000 ord skräpsamlas på
cirka 56 ms in i ett block på 999 631 ord, den ERTS-storlek som håller den under
75 %.
