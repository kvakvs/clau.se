---
source: docs/execution-model.md
sourceCommit: a8c3f8f6
sourceSha256: 20c13ce39d1763e6ec342e1ed9aaa741312fc2be68cb0e08dd005c77a126fc43
translatedAt: 2026-10-17
---
# Exekveringsmodell: ramar och fortsättningar

Hur genererade Erlang-funktioner anropar, returnerar, suspenderas och
misslyckas. Modellen valdes efter prototypjämförelsen i
[jämförda alternativ](#alternatives-compared); den genererade kodens sida av
dess ABI finns i [ramar och överföringar](abi.md#frames-and-transfers).

## Beslut

Varje Erlang-process körs på sin egen **platta stack av explicita ramar**, och
genererad kod rör sig mellan funktioner endast genom **garanterade
svansöverföringar** (LLVM `musttail`). Ett anrop som inte är ett svansanrop
lagrar anroparens fortsättning (continuation) i anroparens ram och hoppar till
den anropade; en retur hoppar tillbaka till den fortsättningen. Den inbyggda
(native) stacken förblir därför ett anrop djup ovanför schemaläggaren, oavsett
Erlang-rekursionens djup, och en process kan stanna vid vilken överföring som
helst och återupptas senare på vilken tråd som helst.

- En platt stack per process (`ProcessStack`, `process/stack`) innehåller
  ramhuvuden och platser, växer genom att flyttas och adresseras som bas plus
  offset.
- Varje funktion är en LLVM-funktion, dess **kropp**, som börjar med en
  `switch` på ramens återupptagningsindex, så att den behåller alla
  funktionens block, sammanslagningar och hanterare.
- Argument och resultat färdas i processregistren `x[]` (BEAM:s X-register).
  Varje kodpekare har den enda signaturen `abi::v1::Code`,
  `void(void *context, TermWord x0, ..., TermWord x5)`: de första
  `abi::v1::register_arguments` (6) registren skickas också som parametrar, så
  att ett anrops inledande argument och en returs resultat stannar i
  maskinregister.
- Ett fel returnerar genom varje anropare, som kontrollerar felkanalen efter
  anropet ([felkanal](abi.md#failure-channel-revision-2)).

## Processtillstånd

`abi::v1::FrameState` inleder varje kontext, så att genererad kod läser och
uppdaterar det inline:

| Fält | Betydelse |
| --- | --- |
| `stack`, `top`, `limit` | Stackblocket (flyttas när det växer), dess första lediga ord och de ord som en push får nå utan att växa eller passera stackgränsen |
| `frame` | Ordoffset för det aktuella ramhuvudet |
| `registers`, `live` | De 256 argument-/resultatregistren; de första `live` orden är rötter vid en överföring |
| `reductions` | Återstående funktionsingångar i tidsskivan |
| `slow`, `failed` | Bitar som skickar överföringar till tjänsterna (`slow_collect`, `slow_profile`); skilt från noll medan felkanalen innehåller ett fel |

`heap_top`/`heap_limit`, `runtime` och `self` betjänar inline-allokering,
atomladdningar och `self/0` ([ramar och överföringar](abi.md#frames-and-transfers)).
En suspenderad process registrerar ingången där den fortsätter i
`ProcessStack::resume_`.

## Ramar

En ram är ett huvud på 4 ord följt av funktionens platser (BEAM:s
Y-register): termplatser, som är rötter, och sedan råa platser för spillda
native-värden.

| Huvudord | Betydelse |
| --- | --- |
| `previous` | Offset för anroparens huvud (ramar länkas med offset, aldrig pekare) |
| `function` | Funktionens `FrameDescriptor` |
| `resume` | Fortsättningsindex som kroppen väljer på när kontrollen återvänder hit |
| `handler` | Hanterarindex; alltid 0, eftersom fel returnerar genom anropare |

Deskriptorn `<symbol>.frame` anger modul, funktion och aritet och innehåller
kroppens kodpekare och antalet platser ([abi](abi.md#frames-and-transfers)).
Huvudord är inte termer; en genomlöpare följer `previous` och läser antalet
platser från deskriptorer. En **bottenram** som ägs av runtimen ligger under
det första anropet i varje process och i varje värdanrop: att returnera in i
den lagrar resultatet i det första registret och avslutar native-anropet.

## Operationer

- **Anrop (ej svansanrop).** Värden som lever efter anropet spills till
  platser. Anroparen sätter sin egen `resume` till nästa fortsättningsindex,
  lägger argumenten i registren och överför till den anropade. Lokala,
  fjärr-, fun- och dynamiska anrop är samma överföring; ett fun-anrop eller
  dynamiskt anrop frågar först en förberedelsetjänst efter den anropades
  `FrameDescriptor` ([funs](funs.md#dynamic-calls)).
- **Ingång.** Förbrukar en reduktion, pushar en nollställd ram (och låter
  stacken växa när den är full), kopierar argumenten bortom parametrarna till
  platser, sätter `resume = 0` och överför till den anropades kropp.
- **Retur.** Den anropade skickar resultatet som `x0`, poppar sin ram
  (`top = frame`, `frame = previous`) och överför till anroparens kropp, som
  väljer på anroparens `resume`.
- **Svansanrop.** Anroparen poppar sin egen ram utan att överföra och går
  sedan in i den anropade på dess plats. Anroparens anropare förblir
  returmålet, så svansrekursion körs med konstant Erlang- och native-stack. Ett
  självsvansanrop behåller sin ram där den är: det förbrukar en reduktion,
  återställer ramens återupptagnings- och hanterarord och antalet levande
  värden och kopierar argumenten bortom parametrarna, utan att skriva om
  huvudet eller nollställa platserna; LLVM gör det till en loop. Ett svansanrop
  till en annan medlem i anroparens svansanropscykel (funktioner i en modul som
  når varandra genom svansanrop) behåller anroparlänken och de termplatser som
  båda ramarna har: det skriver den anropades deskriptor, nollställer endast
  den anropades termplatser bortom anroparens och hoppar över testet av
  stackgränsen när den anropades ram inte är större. Liksom vid ett
  självsvansanrop kan en behållen plats innehålla en term från en tidigare
  medlem tills den anropade skriver den, så skräpsamlingar kan hålla en sådan
  term vid liv något längre.
- **Lämna ifrån sig (yield).** När ingen reduktion återstår pushar en ingång
  inte: den registrerar sig själv i `ProcessStack::resume_`, behåller sina
  argument som registerrötter (`ProcessStack::keep_registers`) och returnerar
  kod som avslutar tidsskivan, så att native-stacken rullas upp till
  exekutorn, som senare fyller på budgeten och upprepar ingången. Loophuvuden
  i comprehensions förbrukar också en reduktion och lämnar ifrån sig genom en
  ingång när ingen återstår. En `receive` väntar genom den inbyggda funktionen
  `CLAUSE_wait_frame_v1`, som man går in i som ett anrop
  ([receive](processes.md#receive)).
- **Avslut.** Att returnera in i bottenramen avslutar processen med dess
  resultat; ett fel som returnerar in i den avslutar processen med felet.
- **Undantag.** Ett kastat undantag eller en misslyckad tjänstekontroll
  registrerar felet i kanalen och kopierar de 8 innersta ramarna i kedjan för
  stackspårningen ([stackspårningar](abi.md#stack-traces)). Varje anropare
  kontrollerar kanalen efter anropet och returnerar genast, eller hoppar till
  hanterarblocket för en omgivande `catch`, `try` eller `after` i samma kropp
  ([felkanal](abi.md#failure-channel-revision-2)). Haltar och
  infrastrukturfel hoppar över varje hanterare och returnerar till
  bottenramen.
- **Värdanrop.** En exporterad symbol behåller en native-signatur och kör sin
  funktion ovanför en bottenram med `CLAUSE_invoke_v1`, och återupptar den
  efter varje gång den lämnat ifrån sig; native-undantag som kastas av
  tjänster fångas upp där. Runtime-tjänster förblir vanliga native-anrop och
  går aldrig in i genererad kod igen.

Varje anrop pushar en ram; lövfunktioner hoppar inte över den, så varje
funktion behåller sin post i stackspårningen.

## Synlighet för rötter

Vid varje överföring och varje safepoint är en process rötter: termplatserna i
alla ramar på dess stack, `x[0..live)` samt felkanalens nyttolast,
argumentlista och stackterm ([rötter](runtime-heap.md#roots-and-safe-points)).

Värden överlever aldrig en överföring i native-register eller SSA-värden,
utom parametrarna för själva överföringen. Varje kropp laddar om sin
ramadress från `stack + frame` efter att man gått in i den och läser levande
värden från platser. Inom en fortsättning gör en tjänst som kan pusha en ram
eller flytta heapen varje platspekare och heappekare som hålls i SSA-värden
ogiltig; omladdningsregeln för skräpsamlingar fastställs i
[omladdningsregeln](runtime-heap.md#reload-rule).

Stackblocket växer genom fördubbling och flytt så länge gränsen för hela
runtimen tillåter det, krymper aldrig under körning och är skilt från
heapblocket. Det har ingen gräns för antalet ramar; stackord räknas mot
[runtimens minnesgräns](runtime-heap.md#runtime-memory-limit).

## Mål

`musttail` med en enhetlig kodsignatur accepteras av varje obligatoriskt mål
vid O0 och O2 (prototyp nedan, clang 23.1.2):

| Mål | Ord | Resultat |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | svanshopp |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | svanshopp |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | svanshopp |
| `armv7-unknown-linux-gnueabihf` | 32 | svanshopp |

Backend rapporterar ett fel när den inte kan uppfylla ett `musttail`-anrop, så
en lyckad kompilering är garantin. Reserv för ett framtida mål som avvisar
det: en **studsmatta (trampoline)**, där varje kodstycke returnerar nästa
kodpekare till schemaläggarloopen i stället för att hoppa; ramar, rötter och
fortsättningsindex är oförändrade. Inget obligatoriskt mål behöver den.

## Implementation

- **Två steg.** Sänkningen (lowering) genererar *native-form*: en
  `TermWord(context, arguments)`-funktion per Erlang-funktion, vanliga anrop
  mellan dem, ett platshållaranrop `clause.frame` som anger termplatserna, och
  `ret` av ett anrops resultat i svansposition. `lower_frames`
  (`compiler/src/codegen/frames.cpp`) flyttar sedan varje kropp till
  `<symbol>.body`, lägger till prologen (ramhuvud, register,
  återupptagnings-switch), delar block efter anrop som inte är svansanrop och
  safepoints i loophuvuden, spiller värden som används efter dem (termer till
  termplatser, andra ord till råa platser), lyfter konstanta platsadresser till
  prologen och gör om anrop, svansanrop och returer till
  `musttail`-överföringar. Typspecialisering och testsömmar arbetar på
  native-form; backend kör `lower_frames` före IR-inspektion och `optimize`
  kör det om det fortfarande behövs.
- **Inline-överföringar.** Ingångar, svansingångar och returer körs inline på
  `FrameState`. Var och en faller tillbaka på `CLAUSE_enter_v1`,
  `CLAUSE_tail_v1` eller `CLAUSE_return_v1` när heapen vill ha en
  skräpsamling, processen profileras, ingen reduktion återstår, stacken måste
  växa eller nå sin gräns, eller den anropade är en inbyggd funktion.
  Felkontrollen efter ett anrop läser tillståndets ord `failed`.
  Tjänstevägarna lagrar parametrarna i registerarrayen före tjänsten och läser
  in dem igen efteråt.
- **Parametrar.** En kropp läser sina inledande argument från parametrarna när
  den startar och anropsresultatet från `x0` när den återupptas;
  `lower_frames` spiller något av dem till en plats endast när det är levande
  över ett anrop eller en safepoint.
- **Svanspositioner** är det sista uttrycket i en klausulkropp, följt genom
  block, parenteser samt klausulkroppar i `case`, `if` och `receive`. Anrop i
  operander till `catch`, `try`, `maybe` och `andalso`/`orelse` är inte
  svansanrop.
- **Loopar.** Generatorer i comprehensions är loopar inuti en kropp. Deras
  markörer och ackumulator finns i termplatser, så inget SSA-värde förs runt
  en loop och en återupptagningspunkt inuti den behöver inget utöver de
  vanliga spillningarna.
- **Safepoints.** Funktionsingångar och loophuvuden i comprehensions samlar
  skräp när heapen begär det
  ([skräpsamling i genererad kod](runtime-heap.md#collection-in-generated-code));
  råa spillplatser innehåller aldrig termer.
- **Inget tak.** Stacken växer tills värden vägrar minne, vilket misslyckas
  med `out_of_memory` (exit 70, [körbara filer](executables.md)), på samma
  sätt som en OTP-process växer. En valfri gräns per process,
  `StackOptions::limit_words` (skild från den valfria heapbudgeten), gör att
  en push utöver den misslyckas med `resource_limit`.

## Jämförda alternativ

[tests/prototypes/execution_model](../tests/prototypes/execution_model/)
sänker samma Erlang-funktioner för hand (`sum/1` kroppsrekursion, `loop/2`
svansrekursion, `fail/1` som kastar på djup N, `catcher/1` som fångar det) på
tre sätt och kompilerar dem för varje mål ovan vid O0 och O2
(`python tests/prototypes/execution_model/run.py`). På Windows x64 vid O2
körde den valda modellen kroppsrekursion med djup 1M på 17 ms med 5 ord per
ram och 10M svansanrop med konstant stack; dess studsmattevariant klarade
samma körningar. Avvisade:

- **Native-anrop med explicita rotramar.** Djup rekursion kräver en
  native-stack per process som är dimensionerad för det djupaste anropet
  (omkring 13 000 nivåer i en tråd på 1 MiB); suspension kräver stackbyte per
  mål; 32-bitarsmål kan inte reservera stora stackar för många processer.
- **LLVM-korutiner.** En heapallokering per anrop, inga svansanrop, ramar vars
  layout skräpsamlaren inte kan se, korutinpass även vid O0, och symmetrisk
  överföring är ändå beroende av `musttail`.
- **En LLVM-funktion per fortsättning** (klassisk CPS). Samma överföringar,
  men sammanslagningar och hanterare som nås från flera fortsättningar skulle
  behöva delas upp i ytterligare funktioner; återupptagnings-switchen behåller
  en genomlöpare med en enda funktion.

Accepterade kostnader: ett indirekt hopp per retur plus en switch-dispatch;
värden som lever över anrop laddas om från platser; bakåtspårningar i
native-debuggern visar endast den aktuella funktionen, medan
Erlang-stackspårningar kommer från ramkedjan ([felsökning](debugging.md)).
