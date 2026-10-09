---
source: docs/execution-model.md
sourceCommit: 06042fa
sourceSha256: 4496f092872f90d6a3fb46c26f67950a76fa663502d4f2c80d8be45d55c8a599
translatedAt: 2026-10-09
---
# Exekveringsmodell: ramar och fortsättningar

Beslut i plan 11 step 17 (2026-10-05). Det fastställer hur genererade
Erlang-funktioner anropar, returnerar, suspenderas och misslyckas när
rekursion, svansanrop och processer tillkommer. Step 19 implementerade anrop,
returer, svansanrop och ramar ([Implementation](#implementation) listar vad
som fortfarande är öppet); steps 23, 24, 26 och 43 bygger på det.

## Beslut

Varje Erlang-process körs på sin egen **platta stack av explicita ramar**, och
genererad kod rör sig mellan funktioner endast genom **garanterade
svansöverföringar** (LLVM `musttail`). Ett anrop som inte är ett svansanrop
lagrar anroparens fortsättning (continuation) i anroparens ram och hoppar
till den anropade; en retur hoppar tillbaka till den fortsättningen. Den
inbyggda (native) stacken förblir därför ett anrop djup ovanför
schemaläggaren, oavsett Erlang-rekursionens djup, och en process kan stanna
vid vilken överföring som helst och återupptas senare på vilken tråd som
helst.

- En platt stack per process ersätter den segmenterade rotstacken från 8F.
  Den innehåller ramhuvuden och platser, växer genom att flyttas och
  adresseras som bas plus offset.
- Varje funktion som behöver en ram sänks till en **ingång** och en
  **kropp**. Kroppen börjar med en `switch` på ramens fortsättningsindex, så
  att en LLVM-funktion behåller alla funktionens block, sammanslagningar och
  hanterare.
- Argument och resultat färdas i processregistren `x[0..n)` (BEAM:s
  X-register); varje kodpekare har den enda signaturen
  `void code(Process *)`.
- Undantag rullar upp ramar till den innersta ram vars huvud anger en
  hanterarfortsättning.

## Processtillstånd

| Fält | Betydelse |
| --- | --- |
| `stack`, `capacity` | En växande ordarray; flyttas när den växer |
| `frame`, `top` | Ordoffset för det aktuella ramhuvudet och för det första lediga ordet |
| `x[]`, `live` | Argument-/resultatregister; de första `live` orden är rötter vid en överföring |
| `reductions` | Återstående anrop i tidsskivan |
| `resume_at` | Ingången där en suspenderad process fortsätter |
| felkanal | Dagens kanal av revision 2: orsak, nyttolast, stackspårning, `halted` |

## Ramar

En ram är ett fast huvud följt av funktionens platser (BEAM:s Y-register).
Platserna nollställs vid push, som rotramar görs i dag.

| Huvudord | Betydelse |
| --- | --- |
| `previous` | Offset för anroparens huvud (ramar länkas med offset, aldrig pekare) |
| `function` | Funktionens deskriptor |
| `resume` | Fortsättningsindex som kroppen väljer på när kontrollen återvänder hit |
| `handler` | Fortsättningsindex för den innersta aktiva hanteraren, 0 när ingen finns |

Deskriptorn utökar dagens `abi::v1::FrameDescriptor` (moduldeskriptor,
platser för modul- och funktionsatomer, aritet) med kodpekarna för ingång och
kropp samt antalet platser. Huvudord är inte termer; en genomlöpare följer
`previous` och läser antalet platser från deskriptorer. En **bottenram** som
ägs av runtimen ligger under det första anropet i varje process:
fortsättning 1 är ett normalt avslut (resultatet i `x[0]`), fortsättning 2
hanteraren för ett ofångat undantag.

## Operationer

- **Anrop (ej svansanrop).** Levande värden ligger redan i platser (dagens
  rotningsregel). Anroparen sätter sin egen `resume` till nästa
  fortsättningsindex, skriver argumenten till `x[0..n)` och överför till den
  anropades ingång. Ett fjärranrop överför till den exporterade
  ingångssymbolen.
- **Ingång.** Räknar en reduktion (se lämna ifrån sig), pushar en nollställd
  ram (och flyttar stacken när den är full), kopierar `x[0..n)` till
  platser, sätter `resume = 0` och överför till kroppen.
- **Retur.** Den anropade skriver resultatet till `x[0]`, poppar sin ram
  (`top = frame`, `frame = previous`) och överför till anroparens kropp, som
  väljer på anroparens `resume`.
- **Svansanrop.** Argumenten går till `x[0..n)`, anroparen poppar sin egen
  ram utan att överföra och överför sedan till den anropades ingång.
  Anroparens anropare förblir returmålet, så svansrekursion körs med konstant
  Erlang- och native-stack. Lokala, ömsesidiga och fjärranslutna svansanrop
  är samma hopp.
- **Lämna ifrån sig (yield).** Varje ingång förbrukar en reduktion. Vid noll
  registrerar den sig själv i `resume_at` och återvänder till schemaläggaren i
  stället för att pusha en ram; argumenten stannar i `x[0..arity)`, som då är
  processens enda register att rota. Återupptagning fyller på budgeten och
  överför till `resume_at`, som upprepar ingången. Senare väntanden
  (`receive`, step 46) lagrar ett fortsättningsindex i kroppen i stället för
  en ingång.
- **Avslut.** Att returnera in i bottenramen registrerar ett normalt avslut;
  att rulla upp in i den registrerar ett ofångat undantag. I båda fallen
  återvänder koden till schemaläggaren.
- **Undantagsspridning.** Ett kastat undantag eller en misslyckad
  tjänstekontroll registrerar felet i kanalen som i dag och anger de 8
  innersta ramarna för spårningen utifrån ramkedjan. Upprullaren poppar sedan
  ramar vars `handler` är 0, sätter `resume = handler` i den första ram som
  har en och överför till dess kropp. Hanterare för `catch`, `try` och
  `after` är fortsättningsindex; att gå in i en skyddad region sätter
  `handler` och att lämna den återställer det omgivande indexet, båda kända
  statiskt inom en funktion. Haltar och infrastrukturfel hoppar över varje
  hanterare och rullar upp direkt till bottenramen, precis som de hoppar över
  hanterare i dag. Hanteraren tar emot undantaget med dagens tjänster
  (`CLAUSE_catch_v1`, `CLAUSE_exception_v2`) och kastar om genom upprullaren.
- **Värdanrop.** Runtimen pushar en bottenram, laddar `x[]` och kör
  schemaläggarloopen tills den ramen nås. Runtime-tjänster förblir vanliga
  native-anrop och går aldrig in i genererad kod igen; endast denna värdloop
  startar den.

En funktion som inte gör något anrop som inte är ett svansanrop och inte
behåller någon plats över en safepoint kan hoppa över sin ram
och returnera direkt till anroparens kropp. Detta är en optimering som
kompilatorn kan lägga till senare, inte en del av kontraktet.

## Synlighet för rötter

Vid varje överföring och varje safepoint är en process rötter: alla platser
i alla ramar på dess stack, `x[0..live)` samt felkanalens nyttolast,
argumentlista och stackterm (redan processrötter). Överlämningsorden för
resultat i dagens rotstack försvinner; `x[0]` tar över deras roll.

Värden överlever aldrig en överföring i native-register eller SSA-värden.
Varje kropp laddar om sin ramadress från `stack + frame` efter att den har
anropats och läser levande värden från platser. Inom en fortsättning gör en
tjänst som kan pusha en ram eller flytta heapen varje platspekare och
heappekare som hålls i SSA-värden ogiltig; omladdningsregeln för
skräpsamlingar fastställs i
[skräpsamling i genererad kod](runtime-heap.md#collection-in-generated-code).

## Efterföljare till rotstacken från 8F

Den segmenterade stacken finns bara för att genererad kod håller absoluta
rampekare över anrop. Under denna modell överlever ingen rampekare en
överföring, så stacken blir ett platt block per process:

- ramhuvuden finns i stacken, platser adresseras som
  `stack + frame + header + index`;
- blocket växer genom fördubbling och flytt (`realloc`), krymper aldrig under
  körning och är skilt från heapblocket;
- gränsen på 4 096 ramar tas bort; stackord räknas mot processens
  minnesbudget, och att överskrida den är det dokumenterade felet i step 20.

## Mål

`musttail` med den enhetliga signaturen `void (Process *)` accepteras av
varje obligatoriskt mål vid O0 och O2 (prototyp nedan, clang 23.1.2):

| Mål | Ord | Resultat |
| --- | --- | --- |
| `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` | 64 | svanshopp |
| `i686-pc-windows-msvc`, `i686-unknown-linux-gnu` | 32 | svanshopp |
| `aarch64-unknown-linux-gnu`, `arm64-apple-macosx14.0` | 64 | svanshopp |
| `armv7-unknown-linux-gnueabihf` | 32 | svanshopp |

Backend rapporterar ett fel när den inte kan uppfylla ett `musttail`-anrop,
så en lyckad kompilering är garantin. Reserv för ett framtida mål som
avvisar det: en **studsmatta (trampoline)**. Varje kodstycke returnerar nästa
kodpekare till schemaläggarloopen i stället för att hoppa (null
suspenderar); ramar, rötter och fortsättningsindex är oförändrade. Inget
obligatoriskt mål behöver den.

## Implementation

Step 19 (2026-10-05) implementerar modellen med dessa val och luckor:

- **Två steg.** Sänkningen genererar fortfarande *native-form*: en
  `TermWord(context, arguments)`-funktion per Erlang-funktion, vanliga anrop
  mellan dem, ett platshållaranrop `clause.frame` som anger termplatserna,
  och `ret` av ett anrops resultat i svansposition. `lower_frames`
  (`compiler/src/codegen/frames.cpp`) flyttar sedan varje kropp till
  `<symbol>.body`, lägger till prologen (ramhuvud, register,
  återupptagnings-switch), delar block efter anrop som inte är svansanrop och
  safepoints i loophuvuden, spiller värden som används efter dem (termer
  till termplatser, andra ord till råa platser), lyfter konstanta
  platsadresser till prologen och gör om anrop, svansanrop och returer till
  `musttail`-överföringar. Typspecialisering och testsömmar arbetar på
  native-form; backend kör `lower_frames` före IR-inspektion och `optimize`
  kör det om det fortfarande behövs.
- **Ingång och kropp.** Det finns ingen separat ingångsfunktion: anroparen
  anropar `CLAUSE_enter_v1(context, callee.frame)`, som pushar ramen,
  kopierar argumenten och returnerar den anropades kropp. Ett svansanrop
  använder `CLAUSE_tail_v1`, som först frigör anroparens ram.
- **Svanspositioner** är det sista uttrycket i en klausulkropp, följt genom
  block, parenteser samt klausulkroppar i `case` och `if`. Anrop i operander
  till `catch`, `try`, `maybe` och `andalso`/`orelse` är inte svansanrop.
- **Undantag** returnerar genom varje anropare, som kontrollerar kanalen
  efter anropet som tidigare; hanterarindex och direkt upprullning förblir en
  optimering. Stackspårningar läser ramkedjan när undantaget kastas.
- **Loopar.** Generatorer i comprehensions är loopar inuti en kropp. Deras
  markörer och ackumulator finns i termplatser, så inget SSA-värde förs runt
  en loop och en återupptagningspunkt inuti den behöver inget utöver de
  vanliga spillningarna.
- **Att lämna ifrån sig** (step 43, [processer](processes.md)).
  `CLAUSE_enter_v1` och `CLAUSE_tail_v1` förbrukar en av processens
  reduktioner; när inga återstår registrerar de den anropade funktionen
  (`ProcessStack::resume_`, modellens `resume_at`), behåller dess argument
  som registerrötter och returnerar kod som avslutar tidsskivan, så att
  native-stacken rullas upp till exekutorn, som senare upprepar ingången.
  Loophuvuden lämnar inte ifrån sig körningen. Skräpsamlaren räknar upp
  ramarnas termplatser, de register som en suspension håller levande
  (`ProcessStack::keep_registers`) och felkanalen (step 23,
  [rötter](runtime-heap.md#roots-and-safe-points)). Funktionsingångar och
  loophuvuden i comprehensions är safepoints som samlar skräp när heapen
  begär det (step 26,
  [skräpsamling i genererad kod](runtime-heap.md#collection-in-generated-code));
  råa spillplatser innehåller aldrig termer.
- **Inget tak.** Stacken växer tills värden vägrar minne, vilket misslyckas
  med `out_of_memory` (exit 70, [körbara filer](executables.md)), på samma
  sätt som en OTP-process växer. En valfri gräns per process,
  `StackOptions::limit_words` (skild från den valfria heapbudgeten), gör att
  en push utöver den misslyckas med `resource_limit`. Ramar tar i dag 4
  huvudord plus 1–40 platser.
- **Värdingång.** En exporterad symbol behåller native-signaturen och kör sin
  funktion ovanför en bottenram i runtimen med `CLAUSE_invoke_v1`;
  native-undantag som kastas av tjänster fångas upp där.

## Jämförda alternativ

Prototyp i [tests/prototypes/execution_model](../tests/prototypes/execution_model/):
samma Erlang-funktioner (`sum/1` kroppsrekursion, `loop/2` svansrekursion,
`fail/1` som kastar `boom` på djup N, `catcher/1` som fångar det) sänkta för
hand på tre sätt. Värd: Windows x64, clang 23.1.2; tiderna är enstaka
körningar vid O2. Kör
`python tests/prototypes/execution_model/run.py`.

| | Explicita ramar + `musttail` (valt) | Native-anrop + rotramar (i dag) | LLVM-korutiner (C++20) |
| --- | --- | --- | --- |
| Kroppsrekursion 1M djup | ok, 17 ms; 5 ord per ram; 17 stackflyttar | 80 B native-stack per nivå: omkring 13 000 nivåer i en tråd på 1 MiB | ok, 60 ms; en allokering på 64–80 B på heapen per anrop |
| 10M svansanrop | ok, 5 ms; konstant stack | O0 växer 80 B per anrop; O2 endast genom tur med syskonanrop | inga svansanrop: 1M iterationer behåller 1M ramar |
| Lämna ifrån sig / återuppta | varje ingång; två processer växlar | omöjligt utan en native-stack per process | symmetrisk överföring (själv `musttail`) |
| Native-stack på djup 1M | 136–144 B | växer per nivå | 144–520 B |
| Rötter synliga för GC | platser i kända ramar | platser i kända ramar | korutinens ramlayout väljs av LLVM; termer skulle behöva en andra rotad kopia |
| Undantag | rullas upp till hanterarramen | kanalkontroll per retur | kanalkontroll per retur |

Studsmattevarianten av den valda modellen klarar samma körningar (20 ms
rekursion, 16 ms för 10M svansanrop vid O2). Avvisade:

- **Native-anrop med explicita rotramar.** Djup rekursion kräver en
  native-stack per process som är dimensionerad för det djupaste anropet;
  suspension kräver stackbyte per mål; 32-bitarsmål kan inte reservera stora
  stackar för många processer.
- **LLVM-korutiner.** En allokering per anrop, inga svansanrop, ogenomskinliga
  ramar för skräpsamlaren, korutinpass även vid O0, och symmetrisk överföring
  är ändå beroende av `musttail`.
- **En LLVM-funktion per fortsättning** (klassisk CPS). Samma överföringar,
  men sammanslagningar och hanterare som nås från flera fortsättningar skulle
  behöva delas upp i ytterligare funktioner; återupptagnings-switchen
  behåller dagens genomlöpare med en enda funktion.

Accepterade kostnader: ett indirekt hopp per retur plus en switch-dispatch;
värden som lever över anrop laddas om från platser (de lagras redan där);
bakåtspårningar i native-debuggern visar endast den aktuella funktionen,
medan Erlang-stackspårningar kommer från ramkedjan.

## Belägg från prototypen

`run.py` bygger den valda modellen (`musttail` och studsmatta),
native-baslinjen och korutinmodellen för värden vid O0 och O2, kör dem och
kompilerar de handsänkta funktionerna (`generated.cpp`, fristående) för varje
mål ovan vid O0 och O2, och räknar `musttail`-anrop i IR och svanshopp i
assemblern. Resultat 2026-10-05: PASS. För den valda modellen på båda
nivåerna: retur (42), kroppsrekursion med djup 1 000 000, 10 000 000
svansanrop, ett fel som kastas på djup 100 000 och fångas av en hanterarram,
samma fel ofångat (bottenram, spårning av 8 `fail`-ramar), och två processer
som växlar i tidsskivor om 4 000 reduktioner (1 002 tidsskivor). Alla 15
överföringsplatser är `musttail` vid O0 på varje mål (14 vid O2 efter
inlining).

Kroppen för `sum/1` för `i686-pc-windows-msvc` (O2 IR, förkortade namn).
IR för `x86_64-pc-windows-msvc` är densamma med `i64`-ord och fördubblade
offset.

```llvm
%2 = load ptr, ptr %0, align 4                      ; stack base
%3 = getelementptr inbounds nuw i8, ptr %0, i32 8
%4 = load i32, ptr %3, align 4                      ; current frame offset
%5 = getelementptr inbounds nuw [4 x i8], ptr %2, i32 %4
%6 = getelementptr inbounds nuw i8, ptr %5, i32 16  ; slot 0 (N)
%7 = getelementptr inbounds nuw i8, ptr %5, i32 8   ; header: resume index
%8 = load i32, ptr %7, align 4
%9 = icmp eq i32 %8, 0                              ; switch on resume
...
16:                                                 ; N > 0: call sum(N - 1)
  store i32 1, ptr %7, align 4                      ; resume = 1
  ...                                               ; x0 = N - 1
  %19 = tail call ptr @call(ptr %0, ptr @SUM)       ; push frame or park
  musttail call void %19(ptr nonnull %0)
  ret void
20:                                                 ; resume 1: x0 += N
  ...
  %24 = tail call ptr @leave(ptr %0)                ; pop, caller body
  musttail call void %24(ptr nonnull %0)
  ret void
```
