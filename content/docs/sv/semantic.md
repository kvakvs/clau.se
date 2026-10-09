---
source: docs/semantic.md
sourceCommit: 06042fa
sourceSha256: 4a59e74a8f74a79a05ce095a1fed17c4ee5fc1249c50e25b2b78fe555376445b
translatedAt: 2026-10-09
---
# Semantisk analys

Körs efter parsning vid standardkompilering och `--print-types`; åtgärder som
bara gäller syntax hoppar över den. Fel stoppar den berörda batchen före LLVM;
diagnostik behåller makro-/include-ursprung, och senare indata diagnostiseras
ändå.

## Kontroller av moduler och anrop

- Moduldeklaration krävs och måste vara unik; funktionsariteter 0..255; inga
  dubblerade definitioner; varje export finns och listas en gång.
  Citerade/Unicode-namn behåller sin exakta identitet.
- Varje funktion kontrolleras, även oanvänd och onåbar kod.
- Anrop löses inom batchen via modul/namn/aritet. Fjärranrop (även
  självkvalificerade) kräver exporter. Saknade/privata anropade funktioner och
  dubblerade moduler är fel.
- `fun F/A` måste namnge en funktion i modulen (`function F/A undefined`);
  `fun M:F/A` och anrop av värden (`F(Args)`) löses inte vid kompilering
  ([funs](funs.md)). Varje distinkt fun-värde får en post i `Module::funs`
  efter bindningsanalysen.
- Själv-, ömsesidig och modulöverskridande rekursion godtas. Anropsgrafen delas
  upp i starkt sammanhängande komponenter (iterativ Tarjan) i ordningen anropad
  före anropare; en komponent är rekursiv när den har flera medlemmar eller när
  en medlem anropar sig själv.

## Bindningar

Varje bindning har en funktionsrelativ identitet `clause[N].local[M]`.
Förekomster är definitioner, läsningar eller kontroller av exakt likhet,
märkta med kontexten huvud/guard/kropp. Analysen är deterministisk.

- Varje klausul börjar från en tom miljö. Huvudkandidater samlar preliminära
  definitioner; guards läser dem; kroppen ser dem endast vid framgång.
- `_` binder ingenting; `_Name` är en vanlig variabel. Ett upprepat namn är ett
  villkor om exakt likhet.
- Matchningar i kroppen besöker högerledet före vänsterledet; kedjor går från
  höger till vänster. Ett mönster inom parentes `P1 = P2` är ett alias, inte en
  sekvens.
- Syskonuttryck läser samma inkommande namn; deras definitioner exporteras
  efter hela uttrycket. `{X = 1, X}` är en obunden läsning; `{X = 4, X = 3}` är
  tillåtet och misslyckas vid körning.
- Definitioner i högerledet av `andalso`/`orelse` eller inuti `catch Expr` är
  osäkra efteråt (OTP:s `vtunsafe`); namn som bundits före en `catch` förblir
  användbara. Varje namn som binds inuti ett `try` är osäkert efteråt;
  `of`-klausuler ser kroppens namn, catch-klausuler ser dem som osäkra, och
  after-kroppen ser varje namn som bundits tidigare i try som osäkert. En
  catch-klausuls stackvariabel måste vara ny (OTP:s `stacktrace_bound`) och dess
  guard får inte läsa den (`stacktrace_guard`). En `maybe` exporterar ingenting:
  varje `?=` binder för de följande uttrycken i kroppen, `else`-klausuler ser
  kroppens namn som osäkra och varje namn som binds inuti är osäkert efteråt.
  Guards publicerar aldrig bindningar; matchningar i guards är fel även när de
  är onåbara.
- Map-nycklar läser endast inkommande bindningar; binärstorlekar läser också
  tidigare segment i samma binary (se [mönster](patterns.md#scopes)).
- Det testade uttrycket i ett `case` binder i den omgivande räckvidden. Varje
  klausul börjar från den räckvidden; dess mönsterdefinitioner är preliminära
  fram till guarden, som bara läser. Namn som binds av varje klausul exporteras
  med en identitet (senare klausuler återanvänder den identitet som en tidigare
  klausul gav namnet); namn som binds av endast vissa klausuler, eller är osäkra
  i någon, är osäkra efteråt. Exporter förenas konservativt som i OTP:s
  `erl_lint` (`icrt_export`); OTP:s varning när ett senare mönster matchar ett
  exporterat namn emitteras inte. `if`-klausuler följer samma regler med en
  guard och inget mönster.
- `begin`/`end` är en sekvens i den omgivande räckvidden.
- Obundna, osäkra och jokerteckenläsningar är fel med position. Meddelandena
  behåller kompilatorns formulering (`unbound variable X`,
  `unsafe variable X`); bindningskorpusen kontrollerar var och en mot OTP:s
  klass `unbound_var`/`unsafe_var`.
- En comprehension evaluerar varje kvalificerare i ordning i den räckvidd som
  de föregående lämnar. Generatormönster binder nya namn som skuggar yttre
  (läsningar inuti mönstret föredrar namn som det redan har bundit); en
  zip-grupp binder alla sina mönster tillsammans. Mallar läser som syskon.
  Räckvidden efter comprehensionen är den som gällde före den: dess namn är
  obundna där.
- Varje klausul i en anonym fun börjar från räckvidden vid funen: huvudnamn är
  nya och skuggar yttre, guards läser dem, och ingenting som binds inuti syns
  efter funen. Varje yttre definition som läses inuti registreras som en
  fångst (`Function::captures`, definitionsordning). En namngiven funs namn är
  ytterligare en definition som varje klausul börjar med
  (`Function::fun_names`); den fångas aldrig. Variablerna i `fun M:F/A` är
  läsningar av fun-uttrycket (`Function::fun_operands`).

Genomgångar är iterativa med en modulbudget på 1 000 000 arbetsenheter.
Uttömning eller något semantiskt fel rensar modulens bindnings- och
normaliseringstabeller.

## Typer och specifikationer

En privat typgraf representerar alla parsade typformer oberoende av
runtime-layout: singletoner, intervall, behållare, roller för map-fält,
funktionsprodukter och olösta tillämpningar. Unioner plattas ut och
dedupliceras; `term()` är toppen och `none()` botten. Standardvärden: 16 384
noder, 16 unionsmedlemmar, 100 000 arbetsposter per översättning. Uttömning
breddar till `term()` med en synlig flagga och smalnar aldrig av en
representation.

Deklarerad metadata (`-type`, `-opaque`, `-nominal`, `-export_type`, `-spec`,
`-callback`, `-optional_callbacks`) följer OTP:s typespec-referens och det
fastlåsta beteendet hos `erl_lint`/`erl_internal`/`erl_types`:

- Lokala alias får skugga inbyggda typnamn. Fjärrtyper i batchen måste vara
  exporterade. Saknade typer, dubbletter, felformad metadata, typvariabler som
  förekommer en gång, ogiltiga gränser och specs för saknade funktioner är fel.
  Otillgängliga externa typer ger en varning och blir `term()`.
- Varje alias eller överlagring har sin egen variabelräckvidd; upprepade
  formella parametrar följer OTP:s substitution med det sista argumentet.
- Rekursiva alias förblir ändliga namngivna referenser; opaka kroppar expanderas
  endast i sin modul; nominella namn behålls överallt, och endast
  specifikationskontrollen läser en nominell typs definition, inuti dess modul.
- Konstantevaluering är exakt, begränsad till 10 000 decimala siffror per
  värde.

## Inferens

Inferensen är skild från deklarerade typer och litar aldrig på specs.

- Exporterade indata, och indata till funktioner som `fun F/A` namnger, är
  godtyckliga termer. En funktion som endast nås genom direkta anrop inom
  batchen (varken exporterad eller namngiven av en fun) tar föreningen (join)
  av argumentfakta från sina anropsplatser som indata (step 58F,
  `semantic/types/inference_inputs`), matchade av varje klausuls huvudmönster;
  rekursiva anrop räknas också. Indata börjar på `none()` (en funktion som
  ingenting anropar körs aldrig och härleds till `none()`) och växer under
  passen över batchen: 8 pass förenar, senare breddar (widening) som rekursiva
  resultat; indata som inte har stabiliserats efter 16 pass blir `term()`
  (rapporterade som breddade).
- Literaler har exakta fakta (step 58B): heltal av alla storlekar och tecken är
  singletoner, atomer singletonatomer, flyttal `float()`, strängar icke-tomma
  listor av sina tecken (`[]` för `""`), och `-`/`+` av ett literalt tal
  behåller dess faktum. Tupler behåller sina elements fakta; maps byggda med
  konstanta nycklar (ett faktum med ett enda värde: ett heltal, en atom, `[]`,
  eller en tupel eller map av sådana) behåller varje nyckels värdefaktum, där en
  nyckel som anges två gånger behåller sitt sista värde, och varje annan nyckel
  ger `map()`. En bitstring-konstruktion räknar sin storlek: literala, storleksatta
  och UTF-kodade literala tecken exakt, ett UTF-segment av ett annat värde efter
  sin kodning (UTF-8: 8 till 32 bitar i byte), och ett
  `binary`/`bitstring`-segment efter sitt värdes faktum eller en godtycklig
  multipel av sin enhet (`<<1, Rest/binary>>` är `nonempty_binary()`). En
  operand som aldrig producerar ett värde (`none()`) gör konstruktionen till
  `none()`.
- Operatorer och inbyggda funktioner (step 58C,
  `semantic/types/inference_operators`) beräknar sitt resultat från sina
  operanders fakta. Heltalssingletoner viks exakt upp till 4 096 bitar per
  operand och resultat (bignums inkluderade; ett större blir `integer()`);
  andra heltal använder intervallaritmetik för `+`, `-`, `*` av icke-negativa
  intervall, `band` med en icke-negativ operand (`X band 15` är `0..15`), `rem`
  med en begränsad divisor (`X rem 10` är `-9..9`), `bnot`, unärt `-` och
  `abs/1`; en flyttalsoperand ger `float()`, en okänd `number()`, och `/` är
  alltid `float()`. Jämförelser viks när operandernas värden bara kan jämföras
  på ett sätt (singletonatomer eller -heltal, disjunkta heltalsintervall, tal
  mot icke-tal) och är annars `boolean()`; `and`/`or`/`xor`/`not` och
  `andalso`/`orelse` kombinerar de sanningsvärden som deras operander kan ha
  (den högra operanden till `andalso` är resultatet när den vänstra är
  `true`). En tabell ger varje inbyggd bryggfunktion dess resultat: `pid()`
  för `self/0` och `spawn/1,3`, `reference()`, `port()`, `non_neg_integer()`
  för storlekar, `string()`, `nonempty_string()`, `binary()`, `list()`,
  `tuple()`, `atom()`, `boolean()` för typtester, `true`/`ok` för inbyggda
  funktioner med sidoeffekter, meddelandet för `!` och `send/2`; `trunc/1` och
  liknande behåller heltalsoperander; okända inbyggda funktioner är `term()`.
  En operation som alltid kastar (`1 + a`, `1 div 0`, `error/1`, `exit/1`,
  `throw/1`, `halt/0,1`) är `none()`, och `erlang:raise/3` returnerar endast
  `badarg`. Vikning ändrar aldrig den genererade koden: overflow och fel förblir
  utfall vid körning.
- En kropp vars uttryck aldrig slutförs (`none()`) är `none()`; detsamma gäller
  ett anrop med ett sådant argument. Kastande vägar bidrar inte till en
  förening, så en funktion som alltid kastar härleds till `none()`.
- Identitets-/projektionsfunktioner behåller exakta argumentrelationer, som
  propageras genom nästlade lokala anrop och fjärranrop med nya variabler per
  anrop.
- Behållare (step 58D, `semantic/types/inference_containers`): en lista
  `[E1, ..., En | T]` förenar sina element framför svansens faktum (en korrekt
  lista när svansen är det, `nonempty_improper_list(H, T)` när den inte är
  någon lista, `term()` när den är okänd); `++`, `--`, `hd/1`, `tl/1`,
  `element/2`, `setelement/3`, `tuple_to_list/1` och `map_get/2` läser och
  bygger om elementfakta medlem för medlem i en union, där en medlem som skulle
  kasta inte bidrar med något. En map-uppdatering behåller exakta nycklar (`:=`
  av en saknad nyckel tar bort den medlemmen) och ger `map()` för en okänd map.
  Tupel-records är tupler: konstruktion fyller i standardvärden (`undefined`
  om inget finns), åtkomst och uppdatering läser och sätter fältet i de
  matchande tuplerna, och `#r.f` är fältets index. En list comprehension är en
  möjligen tom lista av mallarnas fakta, en binary comprehension ett godtyckligt
  antal kopior av mallens storlek, en map comprehension `map()`.
- Funs (step 58E, `semantic/types/inference_funs`): `fun F/A` är en fun av sin
  aritet som returnerar funktionens härledda resultat (en inbyggd funktions,
  eller med variabel aritet `fun()`), `fun M:F/A` en som returnerar `term()`,
  och en anonym fun en som returnerar sina klausulers förenade resultat,
  fångade värden inkluderade. Ett anrop av ett värde förenar resultaten av de
  funs av den ariteten som dess argument väljer (step 58L; `term()` för en
  okänd fun, `none()` när ingen medlem kan anropas så).
  En anonym fun som binds i sin helhet till en variabel och anropas via den
  evalueras igen för det anropet med sina mönster matchande argumentens fakta,
  högst 4 sådana anrop djupt, och dess första evaluerings fakta återställs
  efteråt (`Double = fun(Y) -> Y * 2 end, Double(3)` är 6). `apply/2,3` och
  dynamiska anrop förblir `term()`. Eftersom `fun F/A` kan namnge en funktion
  som härleds senare, upprepas passen över batchen också tills varje sådan fun
  har läst sin funktions slutliga resultat; annars ger ett sista pass dem
  resultatet `term()`.
- Tilldelningar av hela värden i kroppen och alias kopierar högerledets faktum
  (`Y = 42, Z = Y, id(Z)` härleds till 42); mönster för tupler, listor, maps och
  tupel-records ger sina variabler fakta för de delar de matchar, i matchningar
  i kroppen, `case`-klausuler (från det testade uttrycket), ett `try`:s
  `of`-klausuler (från kroppens värde) och generatorer (från indatans element
  eller map-nycklar och värden). Obevisade värden förblir `term()` utan
  relationer.
- Inskränkning (narrowing; step 58G, `semantic/types/inference_narrowing`,
  `inference_scopes`, `meet`): inuti en funktions-, `case`-, `receive`- eller
  fun-klausul möter (meet) varje mönster det värde det matchar (en literal,
  tupel, lista, tupel-record, map eller bitstring-form; en bunden variabels
  faktum), en variabel som är det testade uttrycket i ett `case` inskränks med
  det, och guarden inskränker de variabler den testar. Typtester (`is_atom/1`
  till `atom()`, `is_boolean/1`, `is_integer/1`, `is_float/1`, `is_number/1`,
  `is_binary/1`, `is_bitstring/1`, `is_list/1` till `maybe_improper_list()`,
  `is_tuple/1`, `is_map/1`, `is_function/1,2`, `is_pid/1`, `is_port/1`,
  `is_reference/1`, `is_record/2,3` till recordens tupel, `is_map_key/2` dess
  map till `map()`, och de gamla guard-namnen) möter sitt arguments faktum;
  jämförelser med heltalskonstanter (`<`, `=<`, `>`, `>=`, `==`, `=:=`, på
  vilken sida som helst, vikta konstanter inkluderade) inskränker ett värde som
  redan bevisats vara ett heltal till ett intervall, där gränserna i ett test
  ackumuleras (`10 >= X, X >= 0` är `0..10`); två bevisade heltal som jämförs
  inskränker varandra genom sina gränser (`X > Y` med `Y` i `0..5` gör `X` minst
  1), och `/=`, `=/=` med en konstant flyttar en intervallgräns som är lika med
  den inåt (step 58H1). Ett värde som kan vara ett flyttal eller en annan term
  inskränks inte. En konjunktion tillämpar varje test i tur och ordning, en
  disjunktion förenar vad varje alternativ bevisar, `not` och falska tester
  bevisar ingenting. En klausul efter en vars mönster alla är enkla variabler
  och vars hela guard var ett enda typtest ser det värdet utan den testade
  kategorin; efter en enda jämförelse med en heltalskonstant ser samma värde (en
  enkel variabel i den här klausulen) som bevisats vara ett heltal jämförelsen
  som falsk (`f(N) when N >= 0 -> ...;
  f(N) when is_integer(N) -> ...`: den andra klausulen ser `neg_integer()`).
  Den högra operanden till `andalso`, `true`-klausulen i `case Test of` och det
  som följer efter ett filter i en comprehension ser testet som sant. Ett tomt
  möte gör klausulen omöjlig: den bidrar inte till resultatet. Inskränkta fakta
  gäller endast inuti sin klausul eller operand; `catch`, den högra operanden
  till `orelse` och varje klausul återställer fakta från före dem. Efter ett
  `case`, `if`, `receive`, `try` eller `maybe` är en variabels faktum
  föreningen av dess fakta i slutet av varje klausul som slutförs (step 58H),
  så `case X of forever -> ...; N when
  is_integer(N), N >= 0 -> ... end` lämnar `X` som
  `non_neg_integer() | forever`.
- `try` och `maybe` (step 58J1): ett `try` är föreningen av dess
  `of`-klausulers värden (dess kropps värde utan `of`) och dess
  catch-klausulers värden; `after`-kroppen bidrar inte med något.
  `of`-klausuler börjar från fakta i slutet av kroppen och matchar dess värde
  som `case`-klausuler (en omöjlig klausul bidrar inte); catch-klausuler och
  `after`-kroppen börjar från fakta före `try`, där ett klassmönster matchar
  `error | exit | throw`. En `maybe` är föreningen av dess kropps värde, dess
  `else`-klausulers värden och, utan `else`, de värden som dess
  `?=`-matchningar kan misslyckas på: det matchade värdets faktum utan
  mönstrets form när mönstret matchar hela dess form (nya variabler som används
  en gång, literala atomer och heltal, `[]`, tupler av dem), annars hela
  faktumet. Varje `?=`-mönster möter sitt värde och publicerar sina variabler
  för resten av kroppen; ett `?=` som aldrig kan matcha stoppar kroppen.
  `else`-klausuler börjar från fakta före `maybe` och matchar de förenade
  misslyckade värdena som `case`-klausuler. Fakta efter ett `try` förenar dem i
  slutet av dess kropp (utan `of`) och i varje slutförd klausul; efter en
  `maybe` dem i slutet av dess kropp, i varje slutförd `else`-klausul och, utan
  `else`, dem före den.
- Användningar (step 58H, `semantic/types/inference_uses`): en operation som
  kastar om inte en operand har en viss typ bevisar den typen för variabeln den
  läste, efter att operationen returnerat: aritmetik och unärt `-`/`+` ett
  `number()`, `div`, `rem`, bitoperatorer och `bnot` ett `integer()`,
  `and`/`or`/`xor`, `not` och den vänstra operanden till `andalso`/`orelse` ett
  `boolean()`, `++` och `--` en `list()`, ett anropat värde en fun av den
  ariteten, ett variabelt modul- eller funktionsnamn en `atom()`, en
  map-uppdatering `map()`, en åtkomst eller uppdatering av en tupel-record
  recordens tupel, ett binärsegment dess typ (`<<X:8>>`: `integer()`) och dess
  storlek ett `non_neg_integer()`, och en rad per argumentkontroll i en
  inbyggd bryggfunktion (`hd/1`, `tl/1` `nonempty_maybe_improper_list()`,
  `length/1` `list()`, `element/2` `pos_integer()` och `tuple()`, `map_get/2`
  och `is_map_key/2` `map()`, `atom_to_list/1` `atom()`, ...). Operationen
  behåller sin kontroll vid körning. Namn som är bundna till samma värde
  (`Y = X`, ett variabelt `case`-mönster på ett testat uttryck som är en
  variabel) inskränks tillsammans.
- Ingångs- och framgångsdomäner: varje arguments ingångsdomän är föreningen
  över de möjliga funktionsklausulerna av dess faktum efter huvud och guard (en
  enkel variabels inskränkta faktum, annars mönstrets); dess framgångsdomän
  (step 58H) föreningen över de klausuler som slutförs av dess faktum vid deras
  normala retur. `--print-types` visar framgångsdomänen som indata
  (`bounded(1..10) -> 1..10`, `inc(X) -> X + 1` som
  `inc(number()) -> number()`), eller ingångsdomänen för en funktion som aldrig
  returnerar. Ett anrop som returnerar inskränker sina variabla argument till
  den anropades domän, utom inom en rekursiv komponent som fortfarande löses.
- Klausulresultat förenas konservativt: en projektion överlever endast om
  varje klausul returnerar samma argument. Ett `case` eller `if` förenar sina
  klausulresultat på samma sätt; en bindning som definieras av flera av dess
  klausuler förblir `term()`.
- Funktionstyper (step 58K, `semantic/types/function_types`): utöver
  unionssammanfattningen ovan behåller en funktion en funktionstyp per möjlig
  klausul, likt överlagringarna i en `-spec`: argumentens fakta efter huvud och
  guard (en enkel variabels inskränkta faktum, annars mönstrets) och
  klausulens resultat (`none()` för en klausul som alltid kastar; omöjliga
  klausuler bidrar inte). En klausul vars kropp slutar i ett `case` eller `if`
  delas upp i en funktionstyp per möjlig gren, med argumentens fakta efter den
  grenens mönster och guard och grenens resultat (en nivå: ett nästlat `case`
  delas inte upp vidare). Funktionstyper med lika indata slås ihop (deras
  resultat förenas); över 8 slås de sista ihop till en, med indata och resultat
  förenade. Rekursiva komponenter itererar dem tillsammans med resultaten, där
  varje omgång förenar (och sedan breddar) varje typs resultat; en komponent som
  inte konvergerar behåller endast sina unionssammanfattningar. En anonym funs
  faktum behåller en funktionstyp per möjlig klausul (dess mönster och guard
  över godtyckligt argument), `fun F/A` funktionstyperna för `F/A`; funs som
  förenas behåller sina funktionstyper endast när de är lika, annars förenas de
  som en fun av sina förenade resultat med godtyckliga indata (ett möte med en
  fun med godtyckliga indata, som användningen `F(A)` gör, behåller dem).
  Specialisering, domäner och specifikationskontroller läser
  unionssammanfattningen.
- Anrop väljer funktionstyper (step 58L): ett anrop av en funktion med
  funktionstyper läser, i ordning, varje typ vars indata varje argumentfaktum
  möter, och stannar efter en exakt typ (mönster av nya variabler som används en
  gång, literala atomer och heltal, `[]` och tupler av dem; ingen guard eller
  endast `true` och typtester av enkla argumentvariabler; för en gren, ett
  argument som det testade uttrycket i `case`) vars indata rymmer argumenten:
  ingen senare klausul kan nås. Dess resultat är föreningen av de valda typernas
  resultat, där ett resultat som är lika med ett argument är det argumentets
  faktum inom typens resultat; om ingen väljs blir anropet `none()` (det kan
  bara kasta `function_clause`). Okända argument väljer varje typ, unionen; en
  funktion utan funktionstyper (budget, ej konvergerad komponent) använder sin
  unionssammanfattning. Efter att ett anrop returnerat inskränks dess variabla
  argument till framgångsdomänen och till de valda typernas förenade indata.
  Anrop av fun-värden väljer fun-faktumets funktionstyper på samma sätt, och en
  anonym fun som evalueras igen för ett anrop (se Funs) går in i, testar guards
  för och lämnar sina klausuler som ett `case`, så en klausul som dess argument
  inte kan matcha bidrar inte (`F = fun(1) -> one; (_) -> other end, F(2)` är
  `other`). Rekursiva komponenter konvergerar för resultat och funktionstyper.
- Anrop evaluerar den anropade funktionen igen (step 58M): när ett anrops
  argumentfakta ligger inom den anropades indata och är snävare i något,
  evalueras den anropades kropp igen med dem som indata, som en bunden anonym
  fun, och anropets resultat är de valda funktionstypernas resultat mött med den
  evalueringens (`two_callers() -> {add_one(10), add_one(20)}` är
  `{11, 21}`); anropets argument inskränks också till den evalueringens
  framgångsdomän. Den anropades sammanfattning, funktionstyper och registrerade
  uttrycksfakta ändras aldrig (specialisering läser endast dessa). Budgetar: 4
  nästlade evalueringar, anropade funktioner med högst 256 uttryck, 4 096
  arbetsenheter per anrop ur en pool på 262 144 per pass över batchen (skild från
  batchens egen budget); rekursiva komponenter evalueras aldrig igen. Utöver en
  budget behåller anropet de valda funktionstypernas resultat.
- En `receive` är föreningen av dess klausuler och dess `after`-kropp, som en
  tidsgräns `infinity` aldrig kör.
- En rekursiv komponent börjar varje medlems resultat på `none()` och härleder
  alla medlemmar på nytt tills inget resultat ändras; varje omgång förenar det
  nya resultatet med det föregående (breddar det efter de första 8 omgångarna,
  [inferensdomän](#inference-domain)), och ett väntande rekursivt anrop bidrar
  inte till en förening. En funktion som aldrig kan returnera förblir `none()`.
  En komponent som inte har konvergerat efter 8 omgångar plus 4 per medlem
  breddar varje medlem till `term()` (rapporterat som breddat, som vid
  budgetuttömning) och en sista omgång beräknar uttrycksfakta på nytt; tidigare
  omgångars uttrycksfakta kastas, så endast fakta från de slutliga antagandena
  återstår.
- En delad arbetsbudget begränsar inferensen; uttömning förlorar precision och
  faller tillbaka på generisk kod, avvisar aldrig ett program.
- Specifikationer som motsäger inferensen är fel (step 58I,
  `semantic/types/contracts`). En deklarerad typ blir de fakta den rymmer (eller
  fler): inbyggda typer efter namn (`byte()` är `0..255`, `timeout()` är
  `non_neg_integer() | infinity`, `iodata()` och `iolist()` listor av
  godtycklig form), alias efter sin definition, opaka och nominella typer efter
  sin definition inuti sin modul och som godtycklig term utanför den, fjärrtyper
  via batchen, typvariabler via sina `when`-gränser (en obegränsad är en
  godtycklig term), maps och records efter sin kategori. En specifikation
  motsäger koden när dess fakta inte delar något värde med det som inferensen
  bevisar: det härledda resultatet (om det inte är okänt, eller `none()`: en
  funktion som aldrig returnerar passar vilket resultat som helst), ett
  arguments ingångsdomän, eller ett anrops argumentfakta mot varje
  överlagring. `none()`/`no_return()` godtar endast en funktion som aldrig
  returnerar. Felet namnger funktionen, den deklarerade typen som den skrevs och
  den härledda. Eftersom härledda fakta kan rymma fler värden än koden
  producerar är endast ett disjunkt par en motsägelse: en deklarerad typ som är
  snävare än den härledda godtas. `-callback`-specifikationer kontrolleras inte.
  OTP:s kompilator kontrollerar inte specifikationer
  ([skillnader](differences.md#language-edge-cases)).

### Inferensdomän

Beslut i plan 11 step 58A (`semantic/types/lattice`). Ett faktum är en mängd
värden som en variabel eller ett resultat kan ha. Fakta förenas där
kontrollflöden möts (klausuler, grenar) och breddas mellan omgångarna i en
rekursiv komponent; varje budget nedan breddar sunt till en större mängd och
avvisar aldrig ett program. Fakta skrivs ut som Erlang-typer, kategorier med
sina inbyggda namn.

| Faktum | Utskrift | Förening | Budget och breddning |
| --- | --- | --- | --- |
| Ingenting | `none()` | Identitet | En funktion som aldrig returnerar förblir `none()` |
| Vad som helst | `term()` | Absorberar varje faktum | `dynamic()` och `any()` är `term()` |
| Heltal | `42`, `1 \| 3 \| 7` | Union av singletoner | Fler än 8 singletoner blir sitt intervall |
| Heltalsintervall | `1..10`, `0..255` | Minsta intervall som rymmer båda | En gräns som flyttats mellan omgångar går till nästa tröskel: en nedre till 1, sedan 0, sedan obegränsad; en övre till -1, sedan obegränsad |
| Obegränsade heltal | `pos_integer()` (1 och uppåt), `non_neg_integer()` (0 och uppåt), `neg_integer()` (-1 och nedåt), `integer()` | Minsta intervall som rymmer båda, utskrivet med sin kategori | — |
| Flyttal | `float()` | — | — |
| Tal | `number()` | Ett intervall eller en kategori av heltal förenat med `float()` | Singletonheltal med `float()` förblir `1 \| float()` |
| Atomer | `ok`, `error \| ok`, `boolean()` | Union av singletoner; exakt `false` och `true` skrivs ut som `boolean()` | Fler än 8 singletoner blir `atom()` |
| Identifierare | `pid()`, `port()`, `reference()` | — | — |
| Tupler | `{ok, 1}`, `tuple()`, `#point{x :: 0, y :: _}` | Tupler av samma storlek vars första element inte är två olika atomer (deras tagg) förenas element för element; övriga förblir separata medlemmar | Fler än 16 element blir `tuple()` om inte varje element är känt; fler än 8 separata former blir `tuple()`. En tupel med en synlig tupel-records namn och storlek skrivs ut som recorden (step 58J) |
| Listor | `[]`, `[T]`, `[T, ...]`, `nonempty_improper_list(H, T)`, `[1, a]`, `[a, b \| T]` | Elementen förenas; `[]` med en icke-tom lista ger en möjligen tom lista; ofullständiga listor förenar heads och tails. Listor med två eller fler kända element behåller sina positioner (step 58J; en Clause-notation, typspråket saknar en sådan, element skrivs ut med `\|` inom parentes): positionella listor av samma längd förenas position för position, annars förenas de som vanliga listor | En lista av `0..1114111` (`char()`) skrivs ut som `string()` eller `nonempty_string()`; en möjligen tom lista av `_` skrivs ut som `list()` |
| Maps | `#{}`, `#{a := 1}`, `#{1..17 => a}`, `map()` | Maps med samma nycklar förenas värde för värde; maps med andra nycklar förenas till en association av sina förenade nycklar och värden (`=>`: vilken nyckel som helst kan saknas, step 58J) | Fler än 16 nycklar förenas till en association |
| Funs | `fun((term()) -> 1)`, `fun()` | Funs med samma aritet förenar sina resultat; andra ariteter ger `fun()` | — |
| Bitstrings | `<<_:16>>`, `<<_:3, _:_*2>>`, `binary()` | Den kortare storleken plus varje skillnad mellan storlekar som enhet | Bas och enhet 0/8, 8/8, 0/1, 1/1 skrivs ut som `binary()`, `nonempty_binary()`, `bitstring()`, `nonempty_bitstring()` |

- En union behåller en medlem per förenad form, i Erlangs termordning för deras
  värden: tal, atomer, `reference()`, funs, `port()`, `pid()`, tupler, maps,
  `[]`, listor, bitstrings, sedan deklarerade namngivna typer; fler än 8
  medlemmar blir `term()`.
- Behållare nästlas högst 4 nivåer; ett faktum längre in blir `term()`.
- En rekursiv komponent förenar resultat i 8 omgångar (cykler av upp till 8
  funktioner konvergerar exakt) och breddar dem sedan. En komponent som inte har
  konvergerat efter ytterligare 4 omgångar per medlem breddar varje medlem till
  `term()` och rapporteras som breddad, som vid en uttömd budget.
- Inskränkning (plan steps 58G, 58H, `Lattice::meet`) är mötet av fakta, de
  värden som båda rymmer (eller fler, men `none()` endast när de inte delar
  något): mönster och guards (typtester som `is_integer/1` inskränker sitt
  argument till kategorin) inskränker inom sin klausul och sätter en funktions
  ingångsdomän; en användning som kastar om inte dess operand har en viss typ
  inskränker operanden efter den på den normala vägen. Ett tomt möte innebär
  att vägen inte kan köras.
- Specifikationer lägger aldrig till fakta: härledda fakta kommer endast från
  kod och avgör aldrig en representation på en specs ord.

Sänkningen (lowering) använder dessa fakta. Genererad IR konverterar aldrig ett
heltal till en heappekare; varje tjänsteresultat som kan misslyckas läses
endast på sin framgångsväg, och formkontroller dominerar extraktion. Policy för
specialisering: [specialization.md](specialization.md).

## `--print-types`

Skriver ut varje modul i batchen (i indata-/målordning, biblioteksmoduler efter
dem) som Erlang-källkod ([utskrift av källkod](compile.md#source-printing)) med
det som typinferensen hittade. Utdata går till stdout och är läsbara för
människor, inte Erlang och inte ett utbytesformat. Varningar stannar på stderr.

```erlang
%% module "branches" source="branches.erl" target="" declared=complete inferred=complete
-module(branches).
-export([mixed/1]).

%% inferred: mixed(_) -> 1..2
mixed(X) ->
    case X of
        1 ->
            1;
        _ ->
            2
    end :: 1..2.
```

- En `%% module`-rad namnger modulen, dess källa, projektmålet och huruvida
  deklarerade och härledda typer slutfördes eller breddades av en gräns.
- Deklarationer (`-type`, `-spec`, `-callback`, records) visas som de skrevs.
- Ovanför varje funktion anger `%% declared: f(Inputs) -> Result` varje
  överlagring i dess `-spec` som den lösts (med sina `when`-villkor), och
  `%% inferred: f(Inputs) -> Result` det som inferensen hittade, så att de två
  kan jämföras. Indata är varje arguments framgångsdomän (från `term()` för
  exporterade funktioner och de som `fun F/A` namnger, från anroparnas förenade
  argument för andra funktioner). En funktion med flera funktionstyper skriver
  ut en signatur per typ, var och en med sina egna indata:
  `f(integer()) -> integer(); (atom()) -> string()`
  (`semantic::types::function_source`). En `-spec` stannar hos funktionen
  direkt efter den, åtskild från andra former med en tom rad.
- Uttryck vars faktum säger mer än `term()` annoteras `Expression :: Type` (en
  känd typ döljer en argumentrelation, som bara visas för ett värde som inte är
  känt som något annat): inom parentes inuti andra uttryck, utan parentes för
  ett helt uttryck i kroppen. Literala termer (literaler, och tupler, listor,
  konstruerade maps och bitstrings av literaler) och matchningar annoteras inte
  (högerledet i en matchning gör det).
- Ett värde som inferensen bevisat vara lika med ett av funktionens argument,
  och som inte är känt som något mer, skrivs ut som det argumentets namn, en
  typvariabel: den variabel som den första klausulen som binder hela argumentet
  ger det, annars `_argumentN` (1-baserat, även när ett tidigare argument tog
  namnet). Argumentets indata visar samma namn när det är en godtycklig term:
  `second(_, Y) -> Y`, `keep(Acc, number()) -> Acc`. En variabel visar endast
  sin typ, dess namn säger redan vilket argument den är.

### Förväntningar på inferensen

`tests/fixtures/inference/*.erl` registrerar vad inferensen bör hitta för varje
funktion, och vad den hittar i dag. Varje modul blir CTest-testet
`inference_<module>` (`tests/compiler/inference/expectations.py`):

```erlang
%% expect: sum() -> 3
%% today: sum() -> _
sum() -> 1 + 2.
```

- `expect:` är den signatur som `--print-types` bör skriva ut på sin
  `%% inferred:`-rad; `today:`, som finns medan inferensen inte räcker till, är
  den som skrivs ut nu.
- Kontrollen jämför utdata med `today` när en sådan finns, annars med `expect`;
  varje funktion i modulen behöver en `expect`-rad. En `today`-rad som
  inferensen har kommit ikapp får kontrollen att misslyckas tills den tas bort.
- `expectations.py <clau> <fixture> --record` skriver om `today`-raderna från
  aktuell utdata (en åtgärd för underhållare: granska diffen).
- `values.erl` täcker literaler, aritmetik och jämförelser, anrop av lokala och
  andra funktioner, heltalsföreningar och intervall, heltal eller flyttal,
  listor, strängar, tupler, maps med atomnycklar och andra nycklar, funs som
  returneras och tillämpas, binaries, argumentrelationer och värden från
  `try`/`maybe`. I dag hittar inferensen literala och konstruerade värden,
  resultat av operatorer och inbyggda funktioner, behållare och deras delar,
  funs och anrop av dem, lokala indata från anropare, heltalsföreningar och
  argumentrelationer, inskränkning genom användningar och framgångsdomäner (141
  av 141 funktioner).
- `narrowing.erl` täcker varje typtest, case-guards, testade uttryck med sanna
  tester, `andalso`, filter i comprehensions, mönster för tupler/listor/maps,
  klausuler som fångar allt, intervallguards, motsägelser, disjunktioner,
  klausulen efter ett enda typtest, inskränkning efter ett anrop, inskränkningar
  som inte får läcka, och jämförelseintervall: varje operator på vardera sidan,
  två variabler, `=/=` vid och inuti en gräns, komplement, case- och if-guards,
  en `orelse`, en nedräkning med guard, och operander som inte får inskränkas
  (51 av 51).
- `base_types.erl` har en funktion per bastyp och inbyggd typ i
  [typspråket](https://www.erlang.org/doc/system/typespec.html) (`pid()`,
  `reference()`, bitstrings och binaries, intervall, `byte()`, `char()`,
  `non_neg_integer()`, `boolean()`, `string()`, `iolist()`, `mfa()`,
  `timeout()`, `no_return()`, ...): dess `-spec` namnger typen, så att varje
  inbyggd typ kontrolleras att den kan lösas, och dess kropp producerar ett
  sådant värde. Kategorier förväntas med sina inbyggda namn, begränsade
  heltalsmängder som intervall. Varje funktion når sin förväntade typ.
- `clauses.erl` täcker funktionstyper (step 58K): typtester och literala mönster
  per klausul, sammanslagna lika indata, en klausul som anropare aldrig går in
  i, fler klausuler än budgeten, en rekursiv funktion, en enda klausul, ett
  `case` och ett `if` som avslutar kroppen, ett nästlat `case` och ett `case`
  som inte är sist, anonyma funs med flera klausuler, `fun F/A`, föreningar av
  lika och av olika funs, och en klausul som alltid kastar; samt val vid anrop
  (step 58L): ett typtest, en första exakt gren, okända argument, ingen godtagen
  typ, inskränkning efter anropet, ett literalt argument, ett intervall över två
  klausuler, nästlade anrop, en lokal funktion med flera anropare, en rekursiv
  anropad funktion, och funs med flera klausuler som är bundna, ligger i en
  tupel, skickas till en lokal funktion och anropas med ett okänt argument; samt
  evaluering per anrop (step 58M): resultat per anrop, nästling upp till och
  förbi djupbudgeten, en anropad funktion över storleksbudgeten, en rekursiv
  anropad funktion och okända argument.

### Utskrift av typer

`semantic::types::type_source(graph, type)` (`semantic/types/printing`)
återger en typ ur typgrafen i Erlangs typsyntax: `_` för godtycklig term
(`term()`, skrivet av `TERM_SOURCE` för korthetens skull; typsyntaxen läser `_`
som `any()`), `none()`, atomer och heltal, `1..5`, `{ok, T}`, `tuple()`, `[T]`,
`[T, ...]`, `#{K => V, K := V}`, `#r{f :: T}`, `<<_:B, _:_*U>>`,
`fun((A) -> R)`, `A | B`. En fun med flera funktionstyper skriver ut dem i en
Clause-notation, `fun((1) -> one; (_) ->
other)`: Erlangs typsyntax har ingen överlagrad fun-typ, och en union av
fun-typer betyder något annat. En unions heltal skrivs ut i värdeordning där
dess första heltal står, på varandra följande som ett intervall
(`1 | 2 | 3 | 5` skrivs ut som `1..3 | 5`; faktumet behåller singletonerna).
Fördefinierade `erlang`-typer tappar sin modul; referenser till deklarerade
typer förblir namngivna. En nodbudget begränsar texten; utöver den, och djupare
än 32 nivåers nästling, står `...` i stället.

```sh
clau --print-types answer.erl client.erl
clau --print-types --project project.toml --target demo --verbose
```
