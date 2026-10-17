---
source: docs/abi.md
sourceCommit: a8c3f8f6
sourceSha256: 0717f1e1336ae5419c5ef646d39a5488fd45468113ecbf7eb15897e3370b69c4
translatedAt: 2026-10-17
---
# ABI för genererad kod (revision 21)

Privat kontrakt mellan kompilatorns utdata och runtime. Det är projektintern
C++23, inte BEAM-kompatibelt och inte ett allmänt FFI. Objekt och runtime måste
komma från samma bygge; äldre deskriptorrevisioner avvisas före användning.

Headers: [v1.hpp](../abi/include/clause/abi/v1.hpp) (typer för
term/kontext/funktion), [term.hpp](../abi/include/clause/abi/term.hpp) (kodek
för omedelbara heltal), [status.hpp](../abi/include/clause/abi/status.hpp),
[builtins.hpp](../abi/include/clause/abi/builtins.hpp),
[startup.hpp](../abi/include/clause/abi/startup.hpp) (programstart).

## Termer

En term är ett teckenlöst ord med målets pekarbredd (32 eller 64 bitar).
Layouter härleds från det konfigurerade LLVM-målet, så kod för andra mål
använder målets bredder.

- Små heltal: de fyra lägsta bitarna `0xf`; teckensatt nyttolast om
  `word_bits - 4` bitar, intervall `[-2^(word_bits-5), 2^(word_bits-5)-1]`.
  Större värden är bignums på heapen.
- Atomer: de sex lägsta bitarna `0x0b`, nyttolast som aldrig återanvänds och
  gäller i hela processen. ID:n serialiseras aldrig och används aldrig för
  ordning. `false`, `true`, `undefined`, `ok` och `error` är fasta:
  nyttolasterna 0–4 i varje runtime.
- Tom tupel exakt `0x2b` och nil exakt `0x3b`; andra nyttolastbitar är
  ogiltiga.
- Lokala pids: de fyra lägsta bitarna `0x3`, nyttolasten är processnumret,
  godtas endast när runtime har utfärdat den
  ([pids och referenser](terms.md#pids-and-references)).
- Boxade ord och listord pekar in i den ägande processens heap och godtas
  endast efter att runtime har bevisat ägarskapet (se [termer](terms.md)).
- Primära taggar: lista `0x1`, boxad `0x2`. Ett huvud har sin sort från bit 2
  och antalet efterföljande ord från bit 7 (`header_count_shift`); en tupels
  sort är 0. Genererad kod läser tupelelement och cons-celler inline endast
  efter att inferens eller ett dominerande formtest har bevisat cellen
  ([bevis](specialization.md#proofs)); matchningsplaner testar tupel- och
  cons-former inline på varje optimeringsnivå (en boxad tagg, sedan huvudet),
  och exakt likhet jämför ord först och anropar `CLAUSE_exact_v1` endast för
  två olika list- eller boxade ord. Runtime kontrollerar dessa konstanter.

## Funktioner och symboler

Ingångssignatur (native C-anropskonvention, ingen C-länkning krävs):

```cpp
TermWord function(ProcessContext *context, const TermWord *arguments);
```

Argumenten är en lånad, ordjusterad array i källordning (null vid aritet 0).
Kontexten är levande och skickas oförändrad genom anrop. Ett returnerat ord är
användbart först efter kontroll av felkanalen.

Symboler: `clausev1_<hex module>_<hex function>_<arity>`, hex med gemener av
UTF-8-byte, kanonisk decimal aritet; reversibla och oberoende av värdsystemet.
Exporterade ingångar är externa, övriga interna.

## Modulregistrering

Varje modul emitterar `clausev1_<hex module>__0.descriptor` och `.register`.
Deskriptorn innehåller ABI-version, termbredd, exporttabell (namn, aritet,
värdingång och den `FrameDescriptor` som dynamiska anrop går in i),
atomstavningar (par av UTF-8-pekare/storlek), deskriptorer för native records
(modul-, namn- och fältatomplatser, exportflagga;
[native records](native-records.md#representation)) i en extern
`<prefix>.records`-tabell som andra moduler i en batch refererar till,
fun-deskriptorer i en privat `<prefix>.funs`-tabell
([funs](funs.md#representation)), det skrivskyddade literalområdet
([områden](runtime-heap.md#areas)), de skrivbara atom- och fun-cacher som
genererad kod läser inline, samt `code_convention` för dess kroppar.
Registreringen anropar `CLAUSE_register_module_v4(Runtime*)`, som validerar
version/bredd och alla exporter, internerar atomer, bygger ett fryst register
och publicerar det tillsammans med kodavbilden i en enda transaktion.
Dubblerade moduler ersätter aldrig kod; vid varje fel publiceras ingenting
(redan internerade atomer stannar i den begränsade tabellen).

- Anropa `.register` explicit innan exporter slås upp. Det finns inga globala
  konstruktorer; användare av statiska arkiv måste referera till
  registreringsingångarna.
- `llvm.used` behåller deskriptorer och ingångar; länkning utan runtime
  misslyckas på den saknade tjänstesymbolen.
- Deskriptorns adress är nyckeln för atombindningar; dess avbild måste förbli
  mappad under modulens livstid. Varje runtime har egna bindningar för samma
  avbild.
- Andra atomuttryck än de fasta atomerna läser `atom_cache` när kontextens
  `FrameState::runtime` äger cachen, annars `CLAUSE_atom_v3`; de internerar
  aldrig ([atomer](terms.md#atoms)).
- Ett startobjekt (`clausev1_start`) listar varje deskriptor i en
  `StartupDescriptor` och dess native `main` anropar
  `CLAUSE_main_v1(argc, argv, descriptor)`, som registrerar alla moduler och
  kör ingången ([körbara filer](executables.md#startup-object)).

## Felkanal (revision 2)

Fel kodas inte i termbitar. Efter varje genererat anrop som inte är ett
svansanrop kontrollerar anroparen kanalen innan resultatet används eller nästa
argument evalueras: den läser ordet `failed` i kontextens `FrameState`, som
runtime håller lika med `CLAUSE_call_failed_v2(context)`. Vid fel returnerar
den anropade ett ogiltigt nollord.

| Utfall | Transport |
| --- | --- |
| Mönster som inte matchar, guard som avvisar | Fortsättning till nästa kandidat; kanalen orörd |
| Uttömda klausuler | `error:function_clause`; `error:{case_clause, Value}` med ägd nyttolast för ett `case`; `error:if_clause`; `error:{try_clause, Value}` för ett trys `of`-klausuler; `error:{else_clause, Value}` för en maybes `else`-klausuler |
| Misslyckad matchning i kropp | `error:{badmatch, Value}` med ägd nyttolast |
| Comprehensions | `error:{bad_generator, Tail}`, `error:{bad_filter, Value}`, `error:{bad_generators, Inputs}` (`ErrorReason` 16-18); en strikt generators avvisning är `{badmatch, Element}` |
| Åtkomst till records, felaktiga argument, aritmetik, maps | `badrecord`, `badarg`, `badarith`, `badmap`/`badkey` |
| Fält i native record saknas | `ErrorReason::badfield` (20), nyttolast `{{Module, Name}, Field}` |
| Anrop av ett värde (`F(Args)`) | `ErrorReason::badfun` (22, nyttolasten är värdet), `badarity` (23, nyttolast `{Fun, Args}`), `undef` (24), registrerade av `CLAUSE_apply_v1` ([funs](funs.md)) |
| Dynamiska anrop (`M:F(Args)`, `apply/2,3`, `fun M:F/A` med variabler) | `badarg` för en modul eller funktion som inte är en atom, en ofullständig argumentlista eller en ogiltig aritet; `undef` när ingen modul i programmet exporterar funktionen; `badfun`/`badarity` som ovan ([funs](funs.md#dynamic-calls)) |
| Extern native-konstruktion utan värde | `ErrorReason::novalue` (21), nyttolast `{{Module, Name}, Field}` |
| Heltalsresultat över storleksgränsen | Tjänsteutfall `ValueOutcome::system_limit` (3): en guard avvisar, en kropp kastar `error:system_limit` (`ErrorReason` 19) |
| Ogiltig lat vänsteroperand | `{badarg, Value}` |
| Infrastruktur (OOM, gränser, ägarskap, internt) | `CallError::runtime_failure` med exakt `Status` |
| `erlang:error/1,2,3`, `exit/1`, `throw/1`, `erlang:raise/3` | `raised_error`/`raised_exit`/`raised_throw`: klassen kommer från ID:t, den ägda nyttolasten är hela orsaken |
| `erlang:halt/0,1` | `CallError::halted` med `halt_status` (och slogan) |

Orsaker är typade ID:n som registreras av `CLAUSE_raise_v2`; de tre
`raised_*`-ID:na väljer klassen `exit` eller `throw` (annars `error`) och bär
vilken term som helst som orsak. `error/2,3` kastar via
`CLAUSE_error_v1(context, reason, args)`, som också behåller en lista `args`
för den översta stackramen. Det första felet vinner; nästlade anrop delar
kanalen. `GeneratedInvocation` är värdens räckvidd: den kontrollerar väntande
fel före ingång och efter retur, kopierar resultat eller fel och rensar endast
vid den yttersta utgången (även vid C++-undantag). Inga undantag passerar
genererade ingångar. Anropare av råa ingångar måste öppna en
`GeneratedInvocation`; vanliga värdar använder `ResolvedFunction::call`.

`catch Expr` omdirigerar varje felkontroll och varje kast inuti `Expr` till ett
hanterarblock som anropar `CLAUSE_catch_v1(context, slot)`. För ett väntande
Erlang-undantag skriver den catch-värdet till rotplatsen och rensar kanalen:
den kastade termen, `{'EXIT', Reason}` för en exit eller
`{'EXIT', {Reason, []}}` för ett error (typade orsaker blir sina OTP-termer,
till exempel `{badmatch, V}`; stacken beskrivs [nedan](#stack-traces)). Halts
och infrastrukturfel förblir väntande, och hanterarens egen kontroll fortsätter
till den omgivande hanteraren eller funktionens utgång. Bindningar som görs
inuti `Expr` är osäkra efteråt, så sammanfogningen slår bara ihop värdet.

`try Body of ... catch ... end` skyddar endast `Body` på samma sätt. Dess
hanterare anropar `CLAUSE_exception_v2(context, class_slot, reason_slot,
stack_slot)`, som skriver klassatomen (`error`, `exit` eller `throw`), orsaken
och stackspårstermen till rotplatser och rensar kanalen (halts och
infrastrukturfel förblir väntande som för `catch`). Catch-klausuler matchar
sedan `Class:Reason` med vanliga mönster och guards; en utelämnad klass matchar
`throw`, och en namngiven stackvariabel binder stacktermen. När ingen matchar
registrerar `CLAUSE_reraise_v2(context, class, reason, stack)` undantaget igen
med en `raised_*`-orsak och samma stack, vilket rapporteras och fångas exakt
som originalet. `of`-klausuler väljer på kroppens värde och kastar
`{try_clause, Value}` (`ErrorReason::try_clause = 14`); undantag inuti
`of`-klausuler och hanterare går till den omgivande hanteraren.

`maybe` behöver ingen tjänst: varje `?=` är en vanlig matchning vars kant för
icke-matchning lämnar kroppen mot maybes utgång med det omatchade (redan
rotade) värdet. Utan `else` är det värdet resultatet; annars väljer
`else`-klausuler på det som `case`-klausuler och kastar `{else_clause, Value}`
(`ErrorReason::else_clause = 15`) när ingen matchar.

Comprehensions använder de befintliga tjänsterna med några få operationer: de
ackumulerade elementen vänds av konstruktionen `reverse`
(`ContainerConstruction::reverse = 2`, värden `{List, Tail}`), som bygger
resultatet i en enda heapreservation; listgeneratorer testar och läser
cons-celler inline; en binary comprehension sammanfogar sina delar med
`BitOperation::concat` (`{List}`) och en map comprehension bygger sin map med
`MapOperation::from_list` (`{Pairs}`, senare nycklar vinner). Map-generatorer
tar `MapOperation::entries` (11, `{Map}`) en gång: en cell med nycklarna och
värdena på orden `1 + 2i` och `2 + 2i` i kanonisk nyckelordning (en klassisk
map själv, eller en tupelformad kopia av posterna i en map utanför heapen som
endast genererad kod läser) och läser varje post inline; `key_at`/`value_at`
(`{Map, Position}`) finns kvar för andra anropare. En zips återstående indata
visas med `MapOperation::iterator`, OTP:s kedja `{K, V, Next}` som slutar i
`none`. `MapOperation::update_owned` (10) tar operanderna till `update` för en
map-uppdatering vars källa kompilatorn har bevisat inte läses efteråt: en
källmap utanför heapen uppdateras på plats och dess stubbe lämnas förbrukad
(tom). Bitstring-generatorer använder vanlig mönsterextraktion plus ett
avslutande `binary`/`all`-segment för resten.

`try ... after A end` lägger till ett andra skydd runt kroppen och alla `of`-
och catch-klausuler. På den normala vägen körs `A` efter att det valda värdet
har rotats, och dess värde kastas bort. After-hanteraren tar undantaget med
`CLAUSE_exception_v2`, kör en andra kopia av `A` och kastar om med
`CLAUSE_reraise_v2`; ett undantag eller fel inuti `A` lämnar i stället via den
omgivande hanteraren och ersätter originalet. Halts och infrastrukturfel
hoppar över `A`. Rotplatser tillhör funktionsramen, så varje väg frigör dem
vid funktionens utgång.

### Stackspår

Varje rotram namnger sin genererade funktion med en privat
`abi::v1::FrameDescriptor` (moduldeskriptor, platser för modul- och
funktionsnamnsatomer, aritet). När ett Erlang-undantag registreras kopierar
kanalen de 8 innersta namngivna ramarna (BEAM:s standard för
`backtrace_depth`); termen `[{Module, Function, Arity, []}, ...]` byggs först
när en hanterare, `catch` eller en rapport efterfrågar den. Den översta ramen
visar argumentlistan till `error/2,3` i stället för ariteten när det
argumentet är en lista.

`erlang:raise(Class, Reason, Stack)` (`CLAUSE_reraise_v2`) godtar de stackar
som BEAM godtar: en korrekt lista av `{M, F, A}` (kompletterad med platsen
`[]`) eller `{M, F, A, Location}` med atomerna `M`, `F` och en lista
`Location`, avkortad till 8 poster; stacken behålls sedan som den gavs och
ramar fångas inte längre. En ogiltig klass eller stack registrerar ingenting
och anropet evalueras till `badarg`, som i OTP. `erlang:get_stacktrace/0`
avvisas med OTP 29:s lint-text om att funktionen är "removed".

Skillnader mot OTP, alla synliga endast i stacktermen:

- Platser är alltid `[]` (OTP lägger till `{file, F}`, `{line, L}`), och
  alternativ till `error/3` lägger inte till någon `error_info`.
- En översta ram för `function_clause` visar ariteten, inte argumentlistan.
- Ingen ram namnger en misslyckad BIF eller operator (OTP lägger till
  `{erlang, '+', Args, [{error_info, ...}]}`), och ingenting under
  ingångsfunktionen visas.
- Ett svansanrop frigör anroparens ram, så, som i OTP, saknas en anropare som
  avslutades med ett svansanrop i spåret. OTP gör också anrop till funktioner
  som aldrig returnerar till svansanrop; det gör inte Clause.
- Stackposter av formen `{Fun, Args}` till `erlang:raise/3` avvisas.

## Ramar och överföringar

Genererade funktioner körs på explicita ramar
([exekveringsmodell](execution-model.md); tjänster i
[frames.hpp](../abi/include/clause/abi/frames.hpp)). Varje funktion har en
`<symbol>.frame`-deskriptor (`FrameDescriptor`: moduldeskriptor, platser för
modul- och funktionsatomer, aritet, kroppskod, antal platser, antal
termplatser; extern för exporterade funktioner) och en intern `<symbol>.body`
av typen `abi::v1::Code`, `void(void *context, TermWord x0, ...)` med
`abi::v1::register_arguments` termparametrar; med en runtime byggd med Clang
på x86-64 och AArch64 använder kropparna och varje överföring konventionen
`preserve_none`, liksom `abi::v1::Code` gör där: kroppar returnerar aldrig
normalt, så de sparar inga register som den anropade ska bevara;
registreringen avvisar en modul vars `code_convention` (0 ingen, 1 C, 2
`preserve_none`) inte är runtimens. En exporterad `<symbol>` behåller
signaturen `TermWord(Context *, const TermWord *)` som värdingång som anropar
`CLAUSE_invoke_v1(context, frame, arguments)`.

- Varje kontext börjar med en `abi::v1::FrameState`: stackblock, topp,
  push-gräns, aktuell ramförskjutning, återstående reduktioner,
  registerpekare, antal levande register, långsamma bitar, ordet för fel,
  heapblockets fria ord `[heap_top, heap_limit)`, den runtime-identitet som
  atomcacherna tillhör, kontextens pid-ord (`self`), ett målord vardera. En
  kropp läser sitt ramhuvud (`stack + frame`) och registren från den vid
  ingång och väljer gren efter huvudets återupptagningsord.
- Binära mönster (64-bitarsmål): starttestet, sluttestet och heltalssegment
  med en konstant bredd i hela byte upp till 56 bitar på en byte-justerad
  position läser cellen inline (`abi::v1::heap_binary_*_word`,
  `refc_*_word`: `data_` i en vy utanför heapen är dess buffertens första
  byte); andra segment och ojusterade positioner anropar `CLAUSE_bits_v1`. Ett
  `sub_binary`-subjekt (`sub_*_word`) läses via sitt original. En avslutande
  `Rest/binary` eller `Rest/bits` med enhet 1 bump-allokeras inline som en
  `sub_binary`-cell på 4 ord av originalet.
- Binärloopar: när varje klausul i en funktion matchar en parameter som en
  binary (eller ignorerar den), aldrig behåller hela binaryn och läser de
  rester den binder endast som den parametern i egna svansanrop, får
  funktionen en privat variant `<symbol>.loop`. Funktionens eget steg skapar
  restcellen som ovan och går in i varianten med den (en rest som tjänsten
  skapat, och som kan vara delad, går i stället in i funktionen igen).
  Varianten skapar ingen restcell: varje eget svansanrop lagrar den nya
  förskjutningen och bitlängden i parameterns cell, som endast denna loop
  refererar till, och skickar samma cell vidare, så att en loop över en binary
  allokerar en gång. Varianten läser cellens vy en gång per steg, före sina
  klausuler, och hoppar över bitstring-testet av parametern. Varianten har
  funktionens namn och aritet i stackspår.
- En binärkonstruktion vars varje byte är känd vid kompileringstid (små
  heltalskonstanter och strängliteraler med konstanta bredder i hela byte,
  högst 64 byte) är en inline binärcell i modulens literalområde, liksom andra
  sammansatta literaler.
- `Left ++ Right` där `Left` är skriven som en korrekt lista (en
  strängliteral, eller en lista utan svans) byggs som `[E1, ..., En | Right]`,
  som OTP:s kompilator gör, utan att anropa `erlang:'++'/2`. Varje annan
  `Left ++ Right` går igenom `Left` inline (`codegen/lowering_append`): en
  korrekt lista på högst 32 celler kopieras på `Right` i heapblockets fria
  ord; en längre eller ofullständig `Left`, eller ett block utan plats, går in
  i den inbyggda funktionen, som behåller varje fel och portion.
- En ren inbyggd funktion med literala argument evalueras vid kompileringstid,
  som OTP:s `sys_core_fold` gör: `atom_to_list(Atom)` av en atomliteral är det
  namnets literala sträng, utan anrop.
- `erlang:make_tuple(N, V)` med ett litet `N` i 1..64 bump-allokerar tupeln
  och fyller den med `llvm.experimental.memset.pattern` där heapen har plats;
  annars körs den inbyggda funktionen.
- Binärkonstruktioner (64-bitarsmål) vars segment alla är heltal med
  konstanta bredder i hela byte upp till 64 bitar, högst 64 byte totalt,
  bump-allokeras inline som `heap_binary`-celler (huvud, bitlängd,
  nollställda dataord, sedan varje segments byte) när varje värde är ett litet
  heltal och heapen har plats; annars bygger `CLAUSE_bits_v1` dem. Samma
  segment efter en ackumulator av en hel binary (`<<Acc/binary, ...>>`)
  skrivs in i ackumulatorns buffert när den är en `refc_binary` (eller en
  `sub_binary` av en sådan) som slutar, byte-justerad, vid cellens
  `refc_append_end_word` med plats under `refc_append_limit_word`: byten
  hamnar efter slutet, slutet flyttas fram och resultatet är en `sub_binary`
  på 4 ord av den cellen.
- `+ - * /` (64-bitarsmål) med en flyttalsoperand, och `/` av två godtyckliga
  tal, läser varje operand som en double (ett litet heltal konverteras,
  värdet i en flyttalscell läses via ett val mellan dess cell och en konstant
  ersättningscell, så att ingen laddning beror på en gren), räknar i register
  och bump-allokerar flyttalscellen på 2 ord när resultatet är ändligt,
  divisorn nollskild och heapen har plats; annars kastar
  `CLAUSE_immediate_v1` `badarith` eller befordrar.
- Map-uttryck utan bas vars nycklar är atom- eller små heltalsliteraler
  (högst 32 olika) skrivs inline som klassiska map-celler, med nycklarna
  sorterade vid kompileringstid i exakt termordning och det sista värdet för
  en upprepad nyckel behållet; annars bygger `CLAUSE_map_v1` dem.
- Tupler och listor på högst 64 ord bump-allokeras inline i
  `[heap_top, heap_limit)` (huvud eller cons-celler skrivs på plats,
  `heap_top` flyttas fram), annars byggs de av `CLAUSE_construct_v1`;
  resultatet rotas som en tjänsts utdata. Runtime räknar in inline-orden i
  sin bokföring före varje heapoperation och återställer båda fälten efter
  en; de är null medan inget heapblock finns eller en heapbudget per process
  gäller, så att varje allokering då når tjänsten
  ([heap](runtime-heap.md#areas)). `CLAUSE_frame_v1` och
  `CLAUSE_registers_v1` finns kvar för andra användare.
- En kropp lämnar endast genom `musttail`-anrop. Anrop, svansanrop och
  returer körs inline när de kan, annars kommer koden från `CLAUSE_enter_v1`
  (anrop), `CLAUSE_tail_v1` (svansanrop) eller `CLAUSE_return_v1` (retur),
  som håller tillståndet aktuellt
  ([exekveringsmodell](execution-model.md#implementation)).
- Varje överföring skickar de första `abi::v1::register_arguments` (6)
  X-registren som C-parametrar efter kontexten: ett anrops inledande
  argument, en returs resultat (som `x0` i anroparens kropp), noll för
  oanvända. Ytterligare argument färdas i registerarrayen. Runt varje
  överföringstjänst lagrar den genererade koden parametrarna i arrayen
  (tjänsterna och skräpsamlaren läser dem där) och laddar tillbaka dem
  efteråt. Runtime anropar kod på samma sätt (`ProcessStack::run_code`), och
  dess kropp för bottenramen lagrar `x0` i det första registret åt värden.
- En ingång nollställer ramen och kopierar endast argumenten efter
  parametrarna till sina platser; en kropp behåller ett parameterargument i
  sin plats endast där `lower_frames` spiller det över ett anrop eller en
  safepoint. Evaluerade värden lagras inte ivrigt: sänkningen markerar
  beräknade termer (`clause.term`-metadata) och `lower_frames` ger en
  termplats endast åt ett värde som korsar ett anrop eller en safepoint;
  argumentarrayer till tjänster går fortfarande via rotplatser. Misslyckade
  kandidater rensar sina platser. Värden som en kropp fortfarande behöver
  efter ett anrop eller en safepoint i ett loophuvud spills: termer till
  termplatser (räknade i deskriptorns `roots`), andra ord till råa platser
  efter dem; råa platser är inte rötter.
- Ett resultat skickas som `x0`; felnyttolaster är rotord i kanalen (BEAM:s
  `fvalue`). Ett fel returnerar till anroparen som ett resultat och varje
  anropare kontrollerar kanalen efter anropet; huvudets hanterarord förblir
  0.
- Stacken har inget tak som standard; en push som värden inte kan allokera
  registrerar `out_of_memory`, och en som överskrider en valfri gräns per
  process, `StackOptions::limit_words`, registrerar `resource_limit`
  (infrastrukturfel).
- Ett anrop av ett funktionsvärde skickar dess argument, och funens fångade
  värden efter dem, i registren; `CLAUSE_apply_v1` returnerar den
  `FrameDescriptor` som överföringen går in i
  ([funs](funs.md#representation)).
- Safepoints: `CLAUSE_enter_v1`/`CLAUSE_tail_v1` samlar skräp innan den
  anropade funktionens ram pushas (dess argument är registerrötter); heapen
  sätter biten `slow_collect` närhelst den vill ha en skräpsamling, så
  inline-ingångar hoppar aldrig över en. Och `CLAUSE_safepoint_v1(context)`
  vid varje loophuvud i en comprehension samlar på plats; huvudet anropar den
  endast medan `FrameState::slow` har `slow_collect`, förbrukar sedan en
  reduktion och går, när ingen återstår, in i `erlang:self/0` (ingången
  suspenderar processen), så att långa loopar utan anrop delar på
  schemaläggaren. Varje annan tjänst är en kritisk sektion som aldrig flyttar
  heapen
  ([skräpsamling i genererad kod](runtime-heap.md#collection-in-generated-code)).

## Runtime-tjänster

Genererad kod anropar kontrollerade C++-tjänster: `CLAUSE_exact_v1` (exakt
likhet), `CLAUSE_immediate_v1` (predikat/frågor för omedelbara värden),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1` (för andra användare; genererad kod
testar och läser tupel- och cons-celler inline), `CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`, `CLAUSE_record_v1`
(make/get/update/match/test för native records under en `RecordCheck`; utfall
`bad_record`, `bad_field`, `no_match`), `CLAUSE_make_fun_v1` (bygger en fun av
en `FunDescriptor`). Var och en returnerar framgång, semantiskt fel
(`badarg`/`badarith`/...) eller infrastrukturfel och skriver utdata endast vid
framgång. `CLAUSE_display_v1`
([output.hpp](../abi/include/clause/abi/output.hpp)) skriver ut en rad med
`erlang:display/1` och ger `true`; den har inget semantiskt fel.
`CLAUSE_halt_v1` lyckas aldrig: den registrerar en begäran om halt
(`CallError::halted` med slutstatusen) eller `badarg`, så att anroparen
avvecklar. Länkarens stavningar följer målets Itanium- eller
Microsoft-C++-mangling.

Inline-former (`codegen/lowering_inline.cpp`): typtester (`is_atom`,
`is_integer`, `is_number`, `is_boolean`, `is_tuple`, `is_list`,
`is_bitstring`, `is_float`, `is_map`, `is_pid`, `is_port`, `is_reference`,
`is_function/1`, native `is_record/1`, `is_binary/1` via bitlängdsordet) läser
taggar och, efter ett test av boxad tagg, huvudets sort
(`abi::v1::HeaderKind`); de anropar aldrig en tjänst. Jämförelser av två
omedelbara värden (`==`, `/=`) eller två små heltal (`<`, `=<`, `>`, `>=`),
`element/2`, `tuple_size/1`, `hd/1`, `tl/1`, de booleska operatorerna, `band`,
`bor`, `bxor`, `bsr`, `bsl` (så länge resultatet förblir litet) och små
`div`/`rem` körs inline; `self/0` läser `FrameState::self`. De körs inline där
operanderna tillåter det och anropar annars `CLAUSE_immediate_v1`, som
behåller varje fel- och bignum-fall. `setelement/3` med ett litet index inom
en boxad tupel kopierar tupeln till heapblockets fria ord och ersätter platsen
inline; annars, eller utan plats, går den in i den inbyggda bryggfunktionen.

`CLAUSE_builtin_frame_v1(context, builtin)`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) returnerar
`FrameDescriptor` för den inbyggda produktionsfunktionen med index `builtin` i
`abi::v1::bridge_builtins` (endast tillägg); genererad kod går in i den som i
en funktion med argumenten i registren, och fel och misslyckanden går till den
kontrollerade kanalen ([inbyggda funktioner](builtins.md)). En
`FrameDescriptor` med null-kropp är en inbyggd funktion: att gå in i den kör
den inbyggda funktionen på registren och returnerar till anroparen, eller
suspenderar processen vid den inbyggda funktionens fortsättning när den har
trappat ([portioner](builtins.md#portions)).

En direkt inbyggd funktion (`BuiltinName::direct`: rena konverteringar som
`integer_to_list/1`, `atom_to_list/1`, `list_to_tuple/1`, `setelement/3`,
`phash2/1`) trappar aldrig, väntar aldrig och verkar aldrig på en annan
process. Genererad kod anropar den med
`CLAUSE_builtin_call_v1(context, builtin, arguments)`, som kör dess kropp
direkt och returnerar resultatet, utan ramöverföring, utan
återupptagningspunkt och utan safepoint vid ingången; den förbrukar en
reduktion, och ett fel går till den kontrollerade kanalen som för en tjänst.

`abi::v1::dispatch_builtin` anropar inbyggda funktioner som registrerats av
värden via modul-/funktionsbyte, argumentarray och aritet, och returnerar en
`Status`; utdata skrivs endast vid framgång.

| Status | Värde | Betydelse |
| --- | ---: | --- |
| `ok` | 0 | Framgång |
| `not_implemented` | 1 | Känd uppskjuten funktion, rapporteras en gång |
| `invalid_argument` | 2 | Ogiltig indata |
| `diagnostic_failure` | 3 | Leverans av rapport misslyckades |
| `out_of_memory` | 4 | Allokering misslyckades, tillståndet återställt |
| `busy` | 5 | Levande kontexter eller pågående dispatch |
| `wrong_owner` | 6 | Objektet tillhör en annan runtime/kontext |
| `resource_limit` | 7 | Tak eller budget uttömd |
| `stopped` | 8 | Ägaren har stängts ned |
| `abi_mismatch` | 9 | Version eller termbredd skiljer sig |
| `internal_error` | 10 | Oväntat fel inneslutet |
| `unknown_builtin` | 11 | Signaturen är inte registrerad eller katalogiserad |
| `erlang_error` | 12 | Strukturerat Erlang-fel registrerat |
| `output_failure` | 13 | Standardutdata avvisade en skrivning |

## Revisioner

| Revision | Ändring |
| --- | --- |
| 1 | Inledande deskriptorer och ingångar |
| 2 | Kontrollerad felkanal |
| 3 | Atomstavningar och platser i deskriptorer |
| 4 | Obligatoriska genererade rotomfång |
| 5 | Explicita processramar och överföringar |
| 6 | Deskriptorer för native records i moduldeskriptorer, `CLAUSE_record_v1` |
| 7 | Fun-deskriptorer i moduldeskriptorer, `CLAUSE_make_fun_v1`, `CLAUSE_apply_v1` |
| 8 | Exportdeskriptorer namnger sin `FrameDescriptor`; tjänster för dynamiska anrop `CLAUSE_call_v1`, `CLAUSE_apply_list_v1`, `CLAUSE_call_list_v1`, `CLAUSE_make_external_fun_v1` |
| 9 | Varje kontext börjar med `abi::v1::FrameState`; inline-överföringar |
| 10 | Inledande X-register skickas som kodparametrar |
| 11 | Fasta ord för `false` och `true` |
| 12 | Inline-heapfälten `heap_top`/`heap_limit` i `FrameState` |
| 13 | Fasta `undefined`, `ok`, `error`; `ModuleDescriptor::atom_cache` och `FrameState::runtime` |
| 14 | Literalområden för moduler: `ModuleDescriptor::literals`, `literal_words` |
| 15 | `FrameState::self`, kontextens pid-ord |
| 16 | `Code` använder `preserve_none` på x86-64 och AArch64 med en runtime byggd med Clang; `ModuleDescriptor::code_convention` |
| 17 | Sex X-register som parametrar till `Code` |
| 18 | `sub_binary`-celler (`HeaderKind::sub_binary`, `sub_*_word`) och inline-extraktion av `Rest` |
| 19 | Slut- och gränsord i `refc_binary`-celler (`refc_append_*_word`, 8 nyttolastord) och inline-tillägg |
| 20 | `MapOperation::entries` och inline map-generatorer |
| 21 | `ModuleDescriptor::fun_cache` och inline-closures |
| 22 | Direkta inbyggda funktioner: `BuiltinName::direct`, `CLAUSE_builtin_call_v1` |
