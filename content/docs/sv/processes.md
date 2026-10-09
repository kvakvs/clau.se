---
source: docs/processes.md
sourceCommit: 06042fa
sourceSha256: 9add4b7c491f5fe2b819ab08fada089a098afd08cd71b803a8c87cab16f57892
translatedAt: 2026-10-09
---
# Processer

Plan 11 step 43 (2026-10-08): startade processer på en kooperativ exekutor;
step 44: exitorsaker och felrapporter; step 45: sändning av meddelanden;
step 46: selektiv receive; step 47: tidsgränser för receive; step 48: länkar
och exitsignaler; step 49: monitorer; step 50: registrerade namn; step 53:
portar (inga); step 56: schemaläggarens arbetstrådar; step 57: väckningar
mellan arbetstrådar och nedstängning.

## Exekutor

En runtime kör sina processer på sina schemaläggares arbetstrådar
([arbetstrådar](#workers), [exekveringsmodell](execution-model.md)). Vid
uppstart görs anropet av ingångsfunktionen till den första processen,
huvudprocessen, och exekutorn körs tills den avslutas:

- Körbara processer väntar i en enda först in, först ut-kö. En arbetstråd
  kör den första under en tidsskiva på 4 000 reduktioner (OTP:s
  `CONTEXT_REDS`) och lägger sedan tillbaka den sist i kön, om den inte har
  avslutats.
- Varje funktionsingång förbrukar en reduktion: anrop, svansanrop, fun- och
  dynamiska anrop samt inbyggda funktioner. När inga reduktioner återstår
  sker ingången inte: processen registrerar funktionen den var på väg in i,
  behåller sina argument i sina register (de förblir rötter för
  skräpsamlingen) och återvänder till exekutorn, som senare återupptar den
  genom att upprepa ingången. En loop som inte gör något anrop (en
  comprehension över en lista utan anrop i kroppen) körs till sitt slut innan
  processen kan lämna ifrån sig körningen. Inbyggda funktioner vars arbete
  växer med ett list- eller binary-argument körs i portioner och lämnar ifrån
  sig körningen mellan dem ([portioner](builtins.md#portions)).
- Varje process äger sin heap och sin stack. Argument till en ny
  process kopieras in i dess heap
  ([kopiering mellan heapar](runtime-heap.md#copying-between-heaps)).
- En process avslutas när dess första anrop returnerar eller kastar ett
  undantag. En avslutad process kontext, heap och stack frigörs direkt; dess
  pid förblir en giltig term och `is_process_alive/1` returnerar false för
  den.
- En process som väntar i en `receive` står inte i kön; en sändning till den
  lägger tillbaka den sist i kön ([receive](#receive)).
- När huvudprocessen avslutas, avslutas programmet med dess utfall
  ([körbara filer](executables.md)): processer som fortfarande står i kö
  eller väntar frigörs utan att köras vidare, på samma sätt som ett
  OTP-escript stannar när `main/1` returnerar.
- En exitsignal som avslutar huvudprocessen avslutar programmet
  ([exitsignaler](#exit-signals)).
- `erlang:halt/0,1` i vilken process som helst avslutar programmet med dess
  status. Ett runtime-fel i vilken process som helst (minnet slut, ett
  valfritt tak överskridet, ett internt fel) avslutar programmet som ett
  runtime-fel (exit 70). Ett Erlang-undantag avslutar endast den process som
  kastade det ([avslut](#exits)).
- Värdanrop av exporterade funktioner (`CLAUSE_invoke_v1`) kör sin funktion i
  den anropande kontexten till slut och återupptar den efter varje gång den
  lämnar ifrån sig körningen, utan att köra andra processer; program som
  startas av `CLAUSE_main_v1` använder exekutorn.

## Arbetstrådar

Plan step 56 (2026-10-08). Exekutorn kör processer på
`RuntimeOptions::schedulers` arbetstrådar: tråden som startade programmet och
ytterligare en tråd per extra arbetstråd. Program tar antalet från
`--schedulers N` (1 till 1 024,
[runtime-alternativ](executables.md#runtime-options)); standardvärdet är en
arbetstråd per logisk processor, som OTP:s `+S`.

- Varje arbetstråd tar den första processen ur den enda delade kön (det
  dokumenterade alternativet till köer per arbetstråd med arbetsstöld (work
  stealing): en kö behåller OTP:s först in, först ut-ordning och behöver
  ingen stöld). Lediga arbetstrådar sover tills en process köas eller den
  tidigaste tidsgränsen för receive löper ut.
- En exekutormutex skyddar kön, de väntande processerna, timrarna, de
  registrerade namnen, varje process länkar och monitorer samt varje process
  som inte körs. En körande process heap, stack, brevlåda och felkanal
  tillhör enbart dess arbetstråd; Erlang-kod körs utan låset.
- Länkar, monitorer och namn ändras under låset direkt, även för en process
  som körs någon annanstans. En sändning, eller en exitsignal från `exit/2`
  eller `exit_signal/2`, till en process som körs på en annan arbetstråd kan
  inte röra dess heap: den inbyggda funktionen gör ingenting och dess process
  avslutar sin tidsskiva (`builtins::Blocked`); den väntar tills målets
  tidsskiva tar slut, körs sedan först och upprepar den inbyggda funktionen
  med samma argument. Målet hålls kvar till dess, så att den upprepade
  inbyggda funktionen inte kan hitta det körande igen. En process som
  avslutas med länkar eller monitorer vars processer körs någon annanstans
  slutförs på samma sätt när deras tidsskivor tar slut.
- Därför får meddelanden och exitsignaler fortfarande verkan när de skickas:
  en sändning returnerar efter att meddelandet ligger i mottagarens brevlåda,
  och `is_process_alive/1` efter `exit(Pid, kill)` är false, som OTP utlovar
  för signaler från anroparen.
- En spawn länkar eller övervakar den nya processen (`spawn_link`,
  `spawn_monitor`) innan någon arbetstråd kan köra den. En startad process kan
  köras innan dess förälder fortsätter, så ett program som övervakar eller
  länkar till en kortlivad process efter `spawn/1` kan se `noproc`, som i en
  OTP med flera schemaläggare.
- Huvudprocessens slut, en halt eller ett runtime-fel stoppar programmet när
  varje arbetstråd har avslutat sin pågående tidsskiva; därefter frigörs de
  andra processerna.
- Delade runtime-tjänster är synkroniserade ([trådar](runtime.md#threads)):
  atomer, kodservern, pid-nummer och minnesredovisningen.
- Utdata från olika processer flätas samman i den ordning deras skrivningar
  sker. Varje anrop av `io:format` och `erlang:display` skriver sin text
  direkt.

Väckningar och nedstängning (plan step 57) behöver ingen ytterligare
mekanism, eftersom varje ändring av en process schemaläggningstillstånd sker
under exekutorns mutex:

- Ett meddelande, `'EXIT'` eller `'DOWN'` för en väntande process köar den i
  samma kritiska sektion som levererar det och väcker en ledig arbetstråd. En
  process som fortfarande är i den tidsskiva där den började vänta kan inte
  få något meddelande då (dess avsändare väntar på att tidsskivan ska ta
  slut), så leveransen hittar den alltid parkerad.
- En arbetstråd som inte hittar någon körbar process sover tills en annan
  arbetstråd köar en, den tidigaste tidsgränsen för receive, eller programmets
  slut; att parkera en process med en tidsgräns väcker varje ledig arbetstråd
  så att de väntar på den nya tidsfristen. Upptagna arbetstrådar kontrollerar
  timrarna före varje tidsskiva.
- Ett meddelande och en tidsgräns som löper ut för samma receive kan
  kapplöpa: det som kommer först köar processen och avbryter det andra, och
  receive tar ett meddelande som anlände innan den återupptogs, som OTP:s
  gör.
- En exitsignal till en väntande, köad, kvarhållen eller blockerad process tar
  ut den ur var den än befinner sig innan den slutförs.
- När programmet avslutas slutför varje arbetstråd sin pågående tidsskiva och
  stannar; `run()` returnerar efter att ha förenat (join) dem, och varje
  annan process som exekutorn startade frigörs, så att runtimen stängs ned
  utan några kvarvarande kontexter.
- OTP-referenstestet (golden) `executables_wakeups` stresstestar detta med 1,
  2, 4 och alla arbetstrådar: mottagare vars tidsgränser på 0–2 ms kapplöper
  med avsändarnas meddelanden, en kedja av 16 länkade snurrande processer som
  avslutas av en enda exitsignal där varje medlem övervakas, övervakade
  processer som avslutas medan deras bevakare vaknar, ett program som
  avslutas medan processer snurrar, väntar och översvämmar varandra, samt en
  halt i en annan process.

## Avslut

En annan process än huvudprocessen avslutas med en exitorsak, som i OTP
(`detail::exit_reason`, `process/exits`). Exitsignaler bär den till länkade
processer ([länkar](#links)) och `'DOWN'`-meddelanden till övervakande
([monitorer](#monitors)); felrapporter visar den.

| Hur processen avslutas | Exitorsak | Felrapport |
| --- | --- | --- |
| Dess första anrop returnerar | `normal` | Ingen |
| `exit(Reason)` (även `normal`, `kill`) | `Reason` | Ingen |
| Ett fel (`error/1,2,3`, `badarith`, `{badmatch, V}`, `undef`, ...) | `{Reason, Stack}` | Ja |
| Ett ofångat `throw(Value)` | `{{nocatch, Value}, Stack}` | Ja |
| En exitsignal avslutar den ([exitsignaler](#exit-signals)) | Signalens orsak, `killed` för `exit(Pid, kill)` | Ingen |

En felrapport skrivs på stderr när processen avslutas, efter att
standard-utdata har tömts, i formatet för OTP:s standardhanterare för
loggning:

```text
=ERROR REPORT==== 8-Oct-2026::03:42:15.983000 ===
Error in process <0.8.0> with exit value:
{boom,[{crash_reports,'-main/1-fun-6-',0,[]}]}

```

Huvudet innehåller lokal tid; orsaken formateras som `~p` gör.
Huvudprocessen skriver ingen: dess ofångade undantag är programmets
([körbara filer](executables.md)).

## Meddelanden

`Dest ! Msg` och `erlang:send(Dest, Msg)` (plan step 45) evaluerar `Dest`
först och returnerar `Msg`.

| `Dest` | Effekt |
| --- | --- |
| En pid för en levande process | `Msg` kopieras in i mottagarens heap ([kopiering mellan heapar](runtime-heap.md#copying-between-heaps)) med bevarad delning och läggs till sist i dess signalinkorg |
| En pid för en process som har avslutats | Ingenting; sändningen lyckas |
| Ett [registrerat namn](#registered-names) | Som för dess pid; `badarg` när ingen levande process har namnet |
| `{Name, nonode@nohost}` av två atomer | Som för den pid som är registrerad som `Name`; ingenting när det inte finns någon |
| `{Name, Node}` för någon annan nod | Ingenting (det finns inga andra noder) |
| Allt annat | `badarg` |

- Meddelanden från en avsändare anländer i den ordning den skickade dem; en
  sändning till sig själv är ett meddelande som vilket annat som helst.
- Varje meddelande är en rot för skräpsamlingen hos sin mottagare tills en
  receive tar det ([runtime-heap](runtime-heap.md#roots-and-safe-points)).
- Mottagarens brevlåda (`Mailbox`) har en signalinkorg, dit sändningar läggs,
  och en meddelandekö som receive söker igenom från en sparad position:
  anlända meddelanden flyttas sist i kön när en receive undersöker dem.
- När mottagarens heap vägrar kopian (ett valfritt tak som `--max-heap`, eller
  att värden har slut på minne) levereras ingenting och den sändande
  processen misslyckas med ett runtime-fel (exit 70), som varje process som
  överskrider ett tak.

## Receive

`receive` (plan steps 46–47) väljer bland sina klausuler som `case`, över
meddelandena i brevlådan:

- Genomsökningen av brevlådan börjar vid det äldsta meddelandet. Varje
  meddelande matchas mot klausulerna i ordning (mönster och guards, som kan
  läsa bindningar från före `receive`); det första meddelande som någon
  klausul matchar tas bort och den klausulens kropp körs. Meddelanden som
  ingen klausul matchar stannar i brevlådan i sin ordning; nästa receive
  börjar åter vid det äldsta meddelandet.
- När varje meddelande har undersökts väntar processen
  (`CLAUSE_wait_frame_v1`, en inbyggd funktion som anropas som ett anrop):
  den lämnar körkön tills en sändning levererar ett meddelande till den, och
  sedan fortsätter genomsökningen med de meddelanden som har anlänt.
  Väntande processer behåller sina ramar och meddelanden som rötter för
  skräpsamlingen och samlar skräp när de återupptas
  ([väntande processer](runtime-heap.md#waiting-and-suspended-processes)).
- Namn som binds i varje klausul, och i `after`-kroppen när en sådan finns,
  exporteras efter `receive`, som för `case`; ett anrop i svansposition i en
  klausul eller i `after`-kroppen är ett svansanrop, så en serverloop körs med
  konstant stack.
- `after T -> Body`: `T` evalueras först, före genomsökningen. När receive
  skulle vänta måste `T` vara `infinity` eller ett heltal i
  0..4294967295 (millisekunder), annars `error:timeout_value`; ett
  meddelande som matchar direkt kontrollerar det aldrig, som i OTP.
  `after 0` kör `Body` så snart varje meddelande har undersökts. En ändlig
  tidsgräns startar när receive först väntar och startas inte om av
  meddelanden som inte matchar någon klausul; när den löper ut körs `Body`
  med bindningarna från före receive och nästa receive söker från det äldsta
  meddelandet. Ett meddelande som anländer innan tidsgränsen löper ut tas.
  En receive med enbart `after` är en sömn (idiomet för `timer:sleep/1`).
- Genererad kod: ett loophuvud tittar på nästa ej undersökta meddelande
  (`CLAUSE_receive_v1` `peek`, in i en rotplats), klausulvalet tar ett
  matchat meddelande (`take`) före dess kropp eller hoppar över ett
  omatchat (`skip`) och loopar; när inga meddelanden återstår går loopen in i
  väntan med tidsgränsen, som svarar `true` (sök igen) eller `false`
  (tidsgränsen löpte ut: `restart`, sedan `after`-kroppen).
- Exekutorn har en timer per väntande process med en ändlig tidsgräns: en
  timer som löpt ut lägger tillbaka processen i kön, och när ingen process
  kan köras sover exekutorn tills den tidigaste timern. Tidsgränser mäts med
  en monoton klocka i millisekunder och utlöses aldrig för tidigt.
- När varje process väntar utan tidsgräns på ett meddelande som ingenting kan
  skicka, väntar programmet för evigt, som OTP:s gör. Ett värdanrop
  (`CLAUSE_invoke_v1`) som skulle vänta misslyckas i stället med `busy`:
  ingen annan process körs under det.

## Länkar

Plan step 48. En länk förbinder två processer i båda riktningarna (`Signals`
i varje kontext: de länkade pid:arna i länkordning och flaggan `trap_exit`).

- `link(Pid)` länkar anroparen till en levande process och returnerar
  `true`; att länka till sig själv eller igen gör ingenting. För en process
  som har avslutats kastar den `error:noproc`, eller, när anroparen fångar
  exits, returnerar `true` och skickar `{'EXIT', Pid, noproc}` till
  anroparen, som OTP:s lokala `link/1` gör.
- `unlink(Pid)` tar bort länken på båda sidor; länken har ingen verkan efter
  att anropet har returnerat. `true` även när det inte fanns någon länk.
- `spawn_link/1,3` länkar den nya processen till anroparen innan den körs.
- När en process avslutas får varje länkad process en exitsignal med dess
  exitorsak ([avslut](#exits)) och länken försvinner. Länkade processer
  signaleras i den ordning länkarna skapades.

## Monitorer

Plan step 49. En monitor är enkelriktad: den övervakande processen håller
den (via referens, i `Signals`) och den övervakade processen behåller
referensen och den övervakande pid:en, så att den kan skicka meddelandet när
den avslutas.

- `monitor(process, Pid)` returnerar en ny referens. När processen avslutas
  får anroparen `{'DOWN', Ref, process, Pid, Reason}` med dess exitorsak
  ([avslut](#exits)); för en process som redan har avslutats får den
  meddelandet direkt med orsaken `noproc`. Att övervaka sig själv skapar
  ingenting. Varje anrop skapar en separat monitor med ett eget meddelande;
  meddelandena från en process skickas i den ordning monitorerna skapades.
- `demonitor(Ref)` stoppar monitorn: inget `'DOWN'` från den anländer
  därefter. Den returnerar `true`, även för en referens som inte är en aktiv
  monitor hos anroparen.
- `demonitor(Ref, Options)`: `info` returnerar om monitorn fortfarande var
  aktiv; `flush` tar bort det äldsta meddelandet `{_, Ref, _, _, _}` när den
  inte var det (dess `'DOWN'` ligger redan i brevlådan), som OTP gör.
- `spawn_monitor/1,3` returnerar `{Pid, Ref}`, med monitorn skapad innan den
  nya processen körs.
- En process som avslutas släpper de monitorer den håller.
- `monitor(process, Name)` och `monitor(process, {Name, nonode@nohost})`
  övervakar den process som är registrerad som `Name` (`noproc` direkt när
  det inte finns någon); dess `'DOWN'` anger `{Name, nonode@nohost}` i stället
  för pid:en. `{Name, Node}` för en annan nod ger `badarg`.
- `monitor(port, Port | Name)` övervakar en port ([portar](ports.md#port-table-and-ownership)):
  `{'DOWN', Ref, port, Port, Reason}` när den stängs. En pid för `port`, eller
  en port för `process`, ger `badarg`.

## Registrerade namn

Plan step 50. Exekutorn har en tabell från namn (atomer) till pid:ar, och
varje process sitt eget namn (`Signals::name`).

- `register(Name, Pid)` namnger en levande process: `badarg` för `undefined`,
  ett namn som används, en process som redan har ett namn, en process som har
  avslutats, eller en `Pid` som inte är en pid. En process får registrera sig
  själv.
- `unregister(Name)` frigör namnet (`badarg` när ingen process har det);
  `whereis(Name)` är pid:en eller `undefined`; `registered()` listar namnen i
  atomtabellens ordning (OTP:s ordning är också ospecificerad).
- En process namn frigörs när den avslutas, innan dess länkar och monitorer
  signaleras, så att en mottagare av `'DOWN'` eller `'EXIT'` kan registrera
  namnet igen, som i OTP.

## Exitsignaler

Varje exitsignal kommer från en körande process (`exit/2`,
`exit_signal/2`, `link/1`) eller från slutet av en process. Exekutorn
hanterar den direkt när dess mål inte körs på en annan arbetstråd, annars när
målets tidsskiva har tagit slut ([arbetstrådar](#workers),
`scheduler/signals`): ett avslutat mål lämnar körkön eller sin väntan och
slutförs (dess länkar signaleras, dess felrapport skrivs, dess kontext
frigörs) innan den sändande inbyggda funktionen returnerar. En lång länkad
kedja avslutas process för process utan rekursion.

| Signal till en process | Fångar inte exits | Fångar exits |
| --- | --- | --- |
| `exit(Pid, kill)`, `exit_signal(Pid, kill)` | Avslutas med orsaken `killed` | Avslutas med orsaken `killed` |
| Orsaken `normal` (från en länk, eller skickad till en annan process) | Ingenting | Meddelandet `{'EXIT', From, normal}` |
| `exit(self(), normal)` | Avslutas med orsaken `normal` (OTP:s egenhet) | Meddelandet `{'EXIT', Self, normal}` |
| `exit_signal(self(), normal)` | Ingenting | Meddelandet `{'EXIT', Self, normal}` |
| Varje annan orsak, inklusive `kill` från en länk | Avslutas med den orsaken | Meddelandet `{'EXIT', From, Reason}` |

- `process_flag(trap_exit, Bool)` slår på eller av fångandet och returnerar
  den tidigare inställningen (från början `false`).
- En process som avslutas av en signal den skickat till sig själv
  (`exit(self(), kill)`) rullas upp förbi varje `catch`, `try`-hanterare och
  `after`-kropp: signalen är inte ett undantag (`CallError::exited` i
  felkanalen).
- `exit/2` och `exit_signal/2` returnerar `true`; till en process som har
  avslutats gör de ingenting. En referens som mål gör inte heller någonting
  (det finns inga processalias).
- En exitsignal som avslutar huvudprocessen avslutar programmet som ett
  ofångat `exit` ([avslutsstatus](executables.md#exit-status)): orsaken
  `normal` avslutar med 0.
- När mottagarens heap vägrar en exitorsak eller ett `'EXIT'`-meddelande
  misslyckas mottagaren med ett runtime-fel (exit 70).

## Portar

Portar (plan steps 57A–57F) specificeras i [portar](ports.md): en port är
länkad till den som öppnade den, deltar i länkar, monitorer, exitsignaler
och registrerade namn som en process och kommunicerar med sin anslutna
process via meddelanden. Step 57B tillhandahåller identiteter, porttabellen,
portarnas inbyggda funktioner och `{fd, In, Out}`-portar som endast skriver
utdata.

## Inbyggda funktioner

| Inbyggd funktion | Beteende |
| --- | --- |
| `spawn(Fun)` | `badarg` om inte `Fun` är en fun; annars anropar en ny process `Fun()` och kastar `{badarity, {Fun, []}}` i den processen för en annan aritet |
| `spawn(M, F, Args)` | `badarg` om inte `M` och `F` är atomer och `Args` en äkta lista; annars anropar en ny process `M:F(Args...)` och kastar `undef` i den processen när ingen modul exporterar den och ingen inbyggd funktion har det namnet |
| `spawn_link(Fun)`, `spawn_link(M, F, Args)` | Som `spawn`, och den nya processen länkas till anroparen ([länkar](#links)) |
| `is_process_alive(Pid)` | `badarg` om inte `Pid` är en pid; sant så länge dess process inte har avslutats |
| `spawn_monitor(Fun)`, `spawn_monitor(M, F, Args)` | Som `spawn`, och returnerar `{Pid, Ref}` för en ny [monitor](#monitors) |
| `link(Pid)`, `unlink(Pid)` | `badarg` om inte `Pid` är en pid ([länkar](#links)) |
| `monitor(process, Item)` | `badarg` för en annan typ eller ett annat objekt; en referens ([monitorer](#monitors)); `Item` är en pid eller ett registrerat namn |
| `register(Name, Pid)`, `unregister(Name)`, `whereis(Name)`, `registered()` | Se [registrerade namn](#registered-names); `Name` måste vara en atom |
| `demonitor(Ref)`, `demonitor(Ref, Options)` | `badarg` om inte `Ref` är en referens och `Options` en äkta lista av `flush` och `info` |
| `exit(Dest, Reason)`, `exit_signal(Dest, Reason)` | `badarg` om inte `Dest` är en pid eller referens; `true` efter [exitsignalen](#exit-signals) |
| `process_flag(trap_exit, Bool)` | Den tidigare inställningen; `badarg` för en annan flagga eller ett icke-booleskt värde |
| `erlang:send(Dest, Msg)`, `Dest ! Msg` | `Msg`, efter att det har skickats ([meddelanden](#messages)); `send/2` importeras inte automatiskt |

Den nya processen köas bakom varje körbar process; `spawn` returnerar dess
pid direkt.
