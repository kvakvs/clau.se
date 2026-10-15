---
source: docs/semantic.md
sourceCommit: 6ed3851c
sourceSha256: e64ac7a96a11727f6f9c0e83247c36a9b3b2b047fd551a417344938602e864b3
translatedAt: 2026-10-15
---
# Semantisk analys

Körs efter parsning vid standardkompilering och `--print-types`; åtgärder som
bara gäller syntax hoppar över den. Fel stoppar den berörda batchen före LLVM;
diagnostik behåller makro-/include-ursprung, och senare indata diagnostiseras
ändå.

## Kontroller av moduler och anrop

- Moduldeklaration krävs och måste vara unik; funktionsariteter 0..255; inga
  dubblerade definitioner; varje export finns (en upprepad export ger en
  varning, som i OTP). Citerade/Unicode-namn behåller sin exakta identitet.
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

## Beteenden

Enligt OTP:s
[beteenden](https://www.erlang.org/doc/system/design_principles.html#behaviours),
`erl_internal:add_predefined_functions` och `check_behaviour` i `erl_lint`.

- En modul som deklarerar `-callback` får OTP:s fördefinierade, exporterade
  `behaviour_info/1`: `callbacks` ger de deklarerade callbacks i
  källkodsordning, `optional_callbacks` de i välformade
  `-optional_callbacks`-listor (callbacks kvalificerade med en modul utelämnas).
  Frontend lägger till den som en funktion på `-module`-raden
  (`driver/predefined`). Som i OTP kan modulens egen källkod inte namnge den:
  en `-export`, ett lokalt anrop, `fun behaviour_info/1` eller en `-spec` av
  den är en odefinierad funktion; fjärranrop (även självkvalificerade) når den.
  `-callback` bredvid en handskriven `behaviour_info/1` är ett fel
  (`cannot define callback attibute for F/A when behaviour_info is defined`,
  OTP:s stavning).
- `-behaviour(M)` och `-behavior(M)` får upprepas. `M` löses i batchen; ett
  namn med en biblioteksmodul (`library.md`) lägger till den modulen som ett
  literalt anrop gör. Diagnostik använder OTP:s text vid attributnamnet:
  - `undefined callback function F/A (behaviour 'M')` för varje obligatorisk,
    icke-valfri callback som modulen inte exporterar (sorterat);
  - `conflicting behaviours -- callback F/A required by both 'M2' and 'M1'
    (line L, column C)` när ett tidigare beteende också kräver den (en valfri
    callback räknas när den exporteras);
  - `behaviour M undefined` när `M` inte finns i batchen eller saknar
    `behaviour_info/1` (OTP-beteenden som `gen_server` är ännu inte del av
    Clause), plus OTP:s fel för modulnamn som inte kan vara moduler
    (`the module name must not be empty`, `... must be an atom`, ...).
- Varningar får inte kompileringen att misslyckas. `-compile`-alternativen
  `nowarn_behaviours` (hela kontrollen, fel för modulnamn inkluderade),
  `nowarn_undefined_behaviour_func`, `nowarn_undefined_behaviour` och
  `nowarn_conflicting_behaviours` stänger av dem.
- Utvärderas inte: en handskriven exporterad `behaviour_info/1` i en
  beteendemodul, så dess användares callbacks kontrolleras inte, och OTP:s
  varningar för felaktigt definierade och föråldrade callbacks förekommer
  aldrig ([skillnader](differences.md#errors-stack-traces-and-reports)).
- Belägg: `tests/fixtures/lint` (diagnostik genererad av OTP, CTest
  `lint_diagnostics`), `executables_behaviours`, CLI-fall i `semantic`.

## Importer

Enligt importreglerna i `erl_lint`.

- `-import(Module, [F/A, ...])` gör ett lokalt anrop `F(...)` till fjärranropet
  `Module:F(...)`: modulen måste finnas i batchen (en biblioteksmodul ansluter
  som vid ett literalt anrop) och exportera funktionen, eller vara en inbyggd
  modul (`-import(io, [format/2])`, `-import(erlang, [display/1])`). En import
  har företräde framför en automatiskt importerad BIF med samma namn.
- Fel med OTP:s text: `function F/A already imported from M` (hela attributet
  ignoreras då), `defining imported function F/A`,
  `creating a fun from imported name F/A is not allowed`. En importerad
  funktion i en guard är ett otillåtet guard-anrop (utom guard-BIF:ar i
  erlang).
- Varningen `import directive overrides auto-imported BIF F/A -- ...` om inte
  `no_auto_import` namnger den eller `nowarn_bif_clash` anges; Clause känner
  till de automatiskt importerade BIF:ar som det implementerar.
- Belägg: `executables_imports`, lint-fallen `imports_conflicts`,
  `imports_fun`, `imports_bif`, CLI-fall i semantic.

## Fördefinierade funktioner

Enligt OTP:s
[moduler](https://www.erlang.org/doc/system/modules.html) och
`erl_internal:add_predefined_functions`. Frontend lägger till
`module_info/0,1` i varje kompilerad modul (efter en genererad
`behaviour_info/1`) som Erlang-funktioner som returnerar literala data
(`driver/predefined`, `semantic/module_info`); `Module::predefined_` räknar
dessa avslutande former, som alltid exporteras och utelämnas från
`--print-types`.

- `module_info()` ger `[{module,_},{exports,_},{attributes,_},{compile,_},{md5,_}]`;
  `module_info(Key)` besvarar också `functions`, `nifs` (`[]`) och `native`
  (`false`), och ger `badarg` för varje annan nyckel.
- `exports`: de exporterade funktionerna i definitionsordning (escripts lägger
  till `main/1`), sedan `behaviour_info/1` när den genereras, `module_info/0`,
  `module_info/1`. `functions`: varje funktion i definitionsordning, sedan
  samma fördefinierade.
- `attributes`: varje attribut utom `module`, exporter och importer,
  type-/spec-/callback-former, records, `export_type`, `optional_callbacks`,
  `export_record`, `compile`, `file`, dokumentation och `feature`, i
  källkodsordning; ett värde som inte är en lista omsluts av en (`-tags(a)` är
  `{tags,[a]}`). Utan `-vsn` kommer `{vsn,[N]}` först, där `N` är `md5` läst
  som ett teckenlöst big-endian-heltal, så som OTP härleder det.
- `md5`: MD5 av modulens utskrivna källkod (`print_source`: makron
  expanderade, inkluderingar infogade, kommentarer och layout borttagna).
  `compile`: `[{version,ClauseVersion},{options,[]},{source,AbsolutePath}]`.
- Till skillnad från `behaviour_info/1` ser modulens egen källkod dem: lokala
  anrop och `fun module_info/1` fungerar. Att definiera någon av dem är ett
  fel (`function module_info/0 already defined`); att exportera en, som varje
  upprepad export, ger endast en varning (`function module_info/0 already
  exported`).
- Attribut är data; endast `on_load`, `nifs` och `-compile`-alternativ som
  inte är inerta avvisas som beteendeändrande.
- De genererade funktionerna har ingen källkodsrad (OTP ger dem ingen): inga
  felsökningsplatser, källkommentarer i IR eller poster i `--print-types`.
  `module_info/0` innehåller samma literaler som `module_info/1`, så den gör
  inga anrop.
- Belägg: `executables_module_info` (OTP:s stdout; härledda värden efter
  form), fallen `module_info_defined`, `exports_repeated` i
  `tests/fixtures/lint`.

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

Genomgångar är iterativa med en modulbudget på 1 000 000 arbetsenheter, eller
32 per uttryck när det är mer: genererade parsrar behöver cirka 10 per uttryck
(OTP:s `erl_parse`, 139 093 uttryck, tar 1 290 198). Lösningen av tjänster har
en budget av samma storlek; den genomsöker modulens `-compile`- och
`-import`-former efter ett namns autoimportstatus en gång per namn, inte en
gång per anrop (var och en av `erl_parse`:s tusentals klausuler anropar
`hd/1`). Uttömning eller något semantiskt fel rensar modulens bindnings- och
normaliseringstabeller.

## Typer och specifikationer

En privat typgraf representerar alla parsade typformer oberoende av
runtime-layout: singletoner, intervall, behållare, roller för map-fält,
funktionsprodukter och olösta tillämpningar. Unioner plattas ut och
dedupliceras; `term()` är toppen och `none()` botten. Standardvärden:
1 048 576 noder, 256 unionsmedlemmar, 200 000 arbetsposter per genomgång av en
deklarerad typ (lösning, översättning, expansion) och 8 000 000 per
inferenspass över hela programmet; ett felsökningsbygge av `clau` (utan
`NDEBUG`) tillåter 16 000 och 1 000 000 så att stora program fortfarande
kompileras snabbt, och kan bredda mer. Uttömning breddar till `term()` med en
synlig flagga och smalnar aldrig av en representation.

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
  av argumentfakta från sina anropsplatser som indata
  (`semantic/types/inference_inputs`), matchade av varje klausuls huvudmönster;
  rekursiva anrop räknas också. Indata börjar på `none()` (en funktion som
  ingenting anropar körs aldrig och härleds till `none()`) och växer under
  passen över batchen: 8 pass förenar, senare breddar (widening) som rekursiva
  resultat; indata som inte har stabiliserats efter 16 pass blir `term()`
  (rapporterade som breddade).
- Literaler har exakta fakta: heltal av alla storlekar och tecken är
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
- Operatorer och inbyggda funktioner (`semantic/types/inference_operators`)
  beräknar sitt resultat från sina operanders fakta. Heltalssingletoner viks
  exakt upp till 4 096 bitar per operand och resultat (bignums inkluderade; ett
  större blir `integer()`); andra heltal använder intervallaritmetik för `+`,
  `-`, `*` av icke-negativa intervall, `band` med en icke-negativ operand
  (`X band 15` är `0..15`), `rem` med en begränsad divisor (`X rem 10` är
  `-9..9`), `bnot`, unärt `-` och `abs/1`; en flyttalsoperand ger `float()`,
  en okänd `number()`, och `/` är alltid `float()`. Jämförelser viks när
  operandernas värden bara kan jämföras på ett sätt (singletonatomer eller
  -heltal, disjunkta heltalsintervall, tal mot icke-tal) och är annars
  `boolean()`; `and`/`or`/`xor`/`not` och `andalso`/`orelse` kombinerar de
  sanningsvärden som deras operander kan ha (den högra operanden till
  `andalso` är resultatet när den vänstra är `true`). En tabell ger varje
  inbyggd bryggfunktion dess resultat: `pid()` för `self/0` och `spawn/1,3`,
  `reference()`, `port()`, `non_neg_integer()` för storlekar, `string()`,
  `nonempty_string()`, `binary()`, `list()`, `tuple()`, `atom()`, `boolean()`
  för typtester, `true`/`ok` för inbyggda funktioner med sidoeffekter,
  meddelandet för `!` och `send/2`; `trunc/1` och liknande behåller
  heltalsoperander; okända inbyggda funktioner är `term()`. En operation som
  alltid kastar (`1 + a`, `1 div 0`, `error/1`, `exit/1`, `throw/1`,
  `halt/0,1`) är `none()`, och `erlang:raise/3` returnerar endast `badarg`.
  Vikning ändrar aldrig den genererade koden: overflow och fel förblir utfall
  vid körning.
- En kropp vars uttryck aldrig slutförs (`none()`) är `none()`; detsamma gäller
  ett anrop med ett sådant argument. Kastande vägar bidrar inte till en
  förening, så en funktion som alltid kastar härleds till `none()`.
- Identitets-/projektionsfunktioner behåller exakta argumentrelationer, som
  propageras genom nästlade lokala anrop och fjärranrop med nya variabler per
  anrop.
- Behållare (`semantic/types/inference_containers`): en lista
  `[E1, ..., En | T]` förenar sina element framför svansens faktum (en korrekt
  lista när svansen är det, `nonempty_improper_list(H, T)` när den inte är
  någon lista, `nonempty_maybe_improper_list()` när den är okänd eller kan vara
  ofullständig: en cell är aldrig tom, även i ett mönster som `[H | _]`);
  `++`, `--`, `hd/1`, `tl/1`, `element/2`, `setelement/3`, `tuple_to_list/1`
  och `map_get/2` läser och bygger om elementfakta medlem för medlem i en
  union, där en medlem som skulle kasta inte bidrar med något. En
  map-uppdatering behåller exakta nycklar (`:=` av en saknad nyckel tar bort
  den medlemmen) och ger `map()` för en okänd map. Tupel-records är tupler:
  konstruktion fyller i standardvärden (`undefined` om inget finns), åtkomst
  och uppdatering läser och sätter fältet i de matchande tuplerna, och `#r.f`
  är fältets index. En list comprehension är en möjligen tom lista av mallarnas
  fakta, en binary comprehension ett godtyckligt antal kopior av mallens
  storlek, en map comprehension `map()`.
- Funs (`semantic/types/inference_funs`): `fun F/A` är en fun av sin aritet
  som returnerar funktionens härledda resultat (en inbyggd funktions, eller med
  variabel aritet `fun()`), `fun M:F/A` en som returnerar `term()`, och en
  anonym fun en som returnerar sina klausulers förenade resultat, fångade
  värden inkluderade. Ett anrop av ett värde förenar resultaten av de funs av
  den ariteten som dess argument väljer (`term()` för en okänd fun, `none()`
  när ingen medlem kan anropas så).
  En anonym fun som binds i sin helhet till en variabel och anropas via den
  evalueras igen för det anropet med sina mönster matchande argumentens fakta,
  högst 4 sådana anrop djupt, och dess första evaluerings fakta återställs
  efteråt (`Double = fun(Y) -> Y * 2 end, Double(3)` är 6).
  `apply(F, Args)` (även `erlang:apply/2`) är ett anrop av `F` med de argument
  som `Args` innehåller: elementen i en literal korrekt lista, annars de i dess
  faktum (`[]`, en lista med kända positioner, eller så många kopior av en
  korrekt listas element som `F`:s enda aritet tar); en bunden anonym fun
  evalueras igen som ovan (`apply(fun kind/1, [1])` väljer `kind(1)`).
  `apply(M, F, Args)` vars `M` och `F` är kända atomer som namnger en
  exporterad funktion i batchen läser den funktionens funktionstyper som
  `fun F/A`. Argument av okänd längd, andra mål och `M:F(Args)` med variabla
  namn förblir `term()`. Eftersom `fun F/A` och `apply/3` kan namnge en
  funktion som härleds senare, upprepas passen över batchen också tills varje
  sådan läsning har sett sin funktions slutliga resultat; annars ger ett sista
  pass dem resultatet `term()`.
- Tilldelningar av hela värden i kroppen och alias kopierar högerledets faktum
  (`Y = 42, Z = Y, id(Z)` härleds till 42); mönster för tupler, listor, maps och
  tupel-records ger sina variabler fakta för de delar de matchar, i matchningar
  i kroppen, `case`-klausuler (från det testade uttrycket), ett `try`:s
  `of`-klausuler (från kroppens värde) och generatorer (från indatans element
  eller map-nycklar och värden). Obevisade värden förblir `term()` utan
  relationer.
- Inskränkning (narrowing; `semantic/types/inference_narrowing`,
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
  den inåt. Ett värde som kan vara ett flyttal eller en annan term
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
  föreningen av dess fakta i slutet av varje klausul som slutförs,
  så `case X of forever -> ...; N when
  is_integer(N), N >= 0 -> ... end` lämnar `X` som
  `non_neg_integer() | forever`.
- `try` och `maybe`: ett `try` är föreningen av dess
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
- Användningar (`semantic/types/inference_uses`): en operation som
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
  föreningen över de klausuler som slutförs av dess faktum vid deras
  normala retur. `--print-types` visar framgångsdomänen som indata
  (`bounded(1..10) -> 1..10`, `inc(X) -> X + 1` som
  `inc(number()) -> number()`), eller ingångsdomänen för en funktion som aldrig
  returnerar. Ett anrop som returnerar inskränker sina variabla argument till
  den anropades domän, utom inom en rekursiv komponent som fortfarande löses.
- Klausulresultat förenas konservativt: en projektion överlever endast om
  varje klausul returnerar samma argument. Ett `case` eller `if` förenar sina
  klausulresultat på samma sätt; en bindning som definieras av flera av dess
  klausuler förblir `term()`.
- Funktionstyper (`semantic/types/function_types`): utöver
  unionssammanfattningen ovan behåller en funktion en funktionstyp per möjlig
  klausul, likt överlagringarna i en `-spec`: argumentens fakta efter huvud och
  guard (en enkel variabels inskränkta faktum, annars mönstrets) och
  klausulens resultat (`none()` för en klausul som alltid kastar; omöjliga
  klausuler bidrar inte). En klausul vars resultat är ett
  [beroende faktum](#dependent-facts) av dess argument (ett `case` eller `if`
  som avslutar den, eller en variabel bunden till ett sådant, nästlat på
  vilket djup som helst) delas upp i en funktionstyp per klausul i det
  faktumet, där dess parametrars fakta möter de argument de namnger.
  Funktionstyper med lika indata slås ihop (deras resultat förenas); över 32
  slås de sista ihop till en, med indata och resultat förenade. Rekursiva
  komponenter itererar dem tillsammans med resultaten, där varje omgång förenar
  (och sedan breddar) varje typs resultat; en komponent som inte konvergerar
  behåller endast sina unionssammanfattningar. En anonym funs faktum behåller
  en funktionstyp per möjlig klausul (dess mönster och guard över godtyckligt
  argument), `fun F/A` funktionstyperna för `F/A`; funs som förenas behåller
  sina funktionstyper endast när de är lika, annars förenas de som en fun av
  sina förenade resultat med godtyckliga indata (ett möte med en fun med
  godtyckliga indata, som användningen `F(A)` gör, behåller dem).
  Specialisering, domäner och specifikationskontroller läser
  unionssammanfattningen.
- Anrop väljer funktionstyper: ett anrop av en funktion med
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
- Anrop evaluerar den anropade funktionen igen: när ett anrops
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
  En komponent som inte har konvergerat efter 8 omgångar plus 4 per medlem,
  eller vars omgångar har förbrukat mer än en åttondel av passets budget,
  breddar varje medlem till `term()` (rapporterat som breddat, som vid
  budgetuttömning) och en sista omgång beräknar uttrycksfakta på nytt; tidigare
  omgångars uttrycksfakta kastas, så endast fakta från de slutliga antagandena
  återstår. En sådan komponent kommer man ihåg: senare pass ger dess medlemmar
  `term()` direkt och kör endast den sista omgången, i stället för att iterera
  till taket igen. Det pass som breddar varje indata till `term()` glömmer de
  ihågkomna komponenterna, så att var och en får ytterligare en lösning med
  dessa indata.
- Omgångar krymper aldrig en medlems sammanfattning: dess funktionstyper
  förenas med föregående omgångs typ för typ (resultat förenas, ändrade indata
  förenas och typen är inte längre exakt), eller, när antalet typer ändrats,
  slås båda omgångarnas typer ihop. Som ett skyddsnät behåller varje medlem sina
  4 senaste sammanfattningar, och en som återvänder till någon av dem blir
  `term()` utan funktionstyper under resten av lösningen, vilket låter de andra
  medlemmarna konvergera.
- En omgång går endast igenom medlemmar som läser en sammanfattning som ändrats
  sedan deras senaste genomgång: varje genomgång noterar de sammanfattningar den
  läser (anrop, anropsresultat, `fun F/A`), en ändrad sammanfattning markerar
  sina läsare, och en medlem som inte markerats behåller sina uttrycksfakta.
  Den första omgången går igenom varje medlem, så med varje medlem markerad är
  en omgång den fullständiga omgången från tidigare steg.
- En delad arbetsbudget begränsar inferensen; uttömning förlorar precision och
  faller tillbaka på generisk kod, avvisar aldrig ett program.
- Specifikationer som motsäger inferensen diagnostiseras
  (`semantic/types/contracts`): en motsagd ingångsdomän för ett argument är ett
  fel; ett motsagt resultat, och ett anrop vars argumentfakta varje
  överlagring avvisar, är varningar (anropet kan ligga på en väg som aldrig
  körs). Specifikationer blir aldrig fakta: inferens, specialisering och
  kodgenerering använder de härledda typerna, så programmet beter sig som dess
  kod säger i vilket fall som helst. En deklarerad typ blir de fakta den rymmer
  (eller fler): inbyggda typer efter namn (`byte()` är `0..255`, `timeout()` är
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
  returnerar. Diagnostiken namnger funktionen, den deklarerade typen som den
  skrevs och den härledda. Eftersom härledda fakta kan rymma fler värden än
  koden producerar är endast ett disjunkt par en motsägelse: en deklarerad typ
  som är snävare än den härledda godtas. `-callback`-specifikationer
  kontrolleras inte. OTP:s kompilator kontrollerar inte specifikationer
  ([skillnader](differences.md#language-edge-cases)).

### Beroende fakta

Källa: `semantic/types/dependent`. Ett `case`, `if` eller `try ... of` beter
sig som en fun av de variabler som dess klausuler inskränker, tillämpad på
dem: dess värde är ett beroende faktum, en funktionstyp per möjlig klausul.

- Parametrar: de variabler bundna före konstruktionen som dess testade uttryck
  (det sista uttrycket i ett `try`:s kropp) och guards läser, i
  källkodsordning (variabler som dess klausulmönster binder är nya i varje
  klausul, inte parametrar); högst 4, en senares inskränkning glöms bort.
  Varje möjlig klausul behåller parametrarnas fakta efter sitt mönster och sin
  guard samt sitt värde (`none()` för en klausul som aldrig slutförs); den är
  exakt, som en funktionstyp (58L), när ett `case` eller `try` matchar en
  parameter eller en tupel av parametrar med ett exakt mönster och en exakt
  guard, eller ett `if` har en exakt guard.
- Ett testat uttryck som är en tupel av variabler inskränker varje variabel
  till dess element i det matchade värdet, och en variabel i ett tupelmönster
  binds till samma värde som det testade uttryckets element på dess position
  (`case {X, Y} of {A, b} when is_integer(A) -> ...` inskränker `X` och `Y`).
- Ett `try ... of` beror på sina `of`-klausuler; dess catch-klausuler kan följa
  på vilket värde som helst av dess kropp, så deras förenade värden förenas in
  i varje klausuls värde
  (`try X of 1 -> one; _ -> other catch _:_ -> error end` är
  `$try_of_operator(X :: 1) -> error | one; (X :: _) -> error | other`).
- `receive` och `maybe ... else` förblir föreningen av sina klausuler: deras
  klausuler matchar ett meddelande eller ett misslyckat `?=`-värde som ingenting
  utanför dem kan namnge, så ingen läsning kunde välja bland dem.
- En klausul vars värde i sig är beroende (ett nästlat `case` eller `if`, eller
  en läsning av en beroende variabel) bidrar med en funktionstyp per klausul i
  den över unionen av båda parameterlistorna, med indata mötta. Typer som
  aldrig kan nås (en indata `none()`, eller inom en tidigare exakt typs
  indata) tas bort, liksom parametrar vars fakta är desamma i varje typ; lika
  indata slås ihop och över 32 typer slås de sista ihop (58K). En
  konstruktion vars återstående typer alla ger samma värde, eller som inte
  inskränker någon parameter, är sin vanliga förening.
- Varje annan konsument läser det raderade faktumet, föreningen av
  klausulernas värden. Fakta som lämnar den genomgångna funktionen (resultat,
  funktionstyper, fun-fakta) raderas; föreningar behåller ett beroende endast
  när båda sidor har samma.
- En variabel bunden till ett beroende värde behåller det. Att läsa variabeln
  väljer de klausuler som dess parametrars aktuella fakta går in i (ordningen
  från 58L, en exakt klausul vars indata rymmer dem stoppar) och vars värden
  möter variabelns eget inskränkta faktum, och läsningens faktum är föreningen
  av deras värden
  (`Y = case X of 1 -> one; _ -> other end, case X of 1 -> Y end` läser
  `one`).
- En variabel som varje klausul i ett `case` eller `if` binder är föreningen
  av dess fakta i slutet av de klausuler som slutförs, beroende av
  konstruktionens parametrar som dess värde:
  `case X of 1 -> Y = 5; _ -> Y = 6 end, Y` härleds till `(1) -> 5; (_) -> 6`.
  Samma förening gäller efter `receive`, `try` och `maybe`, utan beroende.
- Operatorer, inbyggda funktioner, konstruktioner av tupler, listor, maps och
  records, samt anrop av funktioner i batchen (deras funktionstyper valda som i
  58L, argumenten inte inskränkta igen) med beroende operander evalueras en
  gång per kombination av operandernas klausuler, med de klausulernas värden i
  stället för operandernas fakta och deras indata mötta: läsningar av en
  variabel tar samma klausul, andra operander kombineras, högst 16
  kombinationer (därutöver är användningen den vanliga föreningen). `R + 1`
  med `R = case X of a -> 1; b -> 2 end` härleds till `(a) -> 2; (b) -> 3`.
- Att inskränka en beroende variabel (ett mönster, en guard, en användning)
  inskränker också dess parametrar till föreningen av indata för de nådda
  klausuler vars värden möter det inskränkta faktumet, och deras parametrar i
  sin tur, 4 nivåer djupt: efter `R = case X of a -> 1; b -> 2 end` läser
  `case R of 1 -> X end` `X` som `a`.
- En funktionsklausuls beroende resultat delar upp den (se Funktionstyper):
  parametrar som namnger ett argument, eller ett namn bundet till dess värde,
  möter dess indata; övriga tas bort (en sådan typ är exakt endast om deras
  indata är en godtycklig term). `nested_case(X, L)` med
  `case X of 1 -> case L of spanish -> uno;
  _ -> one end; _ -> other end` härleds till `(1, spanish) -> uno; (1, _) -> one;
  (_, _) -> other`.
- `--print-types` noterar ett beroende värde som en funktionstyp namngiven
  efter sin konstruktion, med varje indata efter sin parameters namn:
  `case X of 1 -> one; _ -> other end` slutar i
  `end. % $case_of_operator(X :: 1) -> one; (X :: _) -> other`; ett `if`
  skriver ut `$if_operator`, ett `try ... of` `$try_of_operator`.

### Inferensdomän

Källa: `semantic/types/lattice`. Ett faktum är en mängd värden som en variabel
eller ett resultat kan ha. Fakta förenas där kontrollflöden möts (klausuler,
grenar) och breddas mellan omgångarna i en rekursiv komponent; varje budget
nedan breddar sunt till en större mängd och avvisar aldrig ett program. Fakta
skrivs ut som Erlang-typer, kategorier med sina inbyggda namn.

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
| Tupler | `{ok, 1}`, `tuple()`, `#point{x :: 0, y :: _}` | Tupler av samma storlek vars första element inte är två olika atomer (deras tagg) förenas element för element; övriga förblir separata medlemmar | Fler än 16 element blir `tuple()` om inte varje element är känt; fler än 8 separata former blir `tuple()`. En tupel med en synlig tupel-records namn och storlek skrivs ut som recorden |
| Listor | `[]`, `[T]`, `[T, ...]`, `nonempty_improper_list(H, T)`, `[1, a]`, `[a, b \| T]` | Elementen förenas; `[]` med en icke-tom lista ger en möjligen tom lista; ofullständiga listor förenar heads och tails. Listor med två eller fler kända element behåller sina positioner (en Clause-notation, typspråket saknar en sådan, element skrivs ut med `\|` inom parentes): positionella listor av samma längd förenas position för position, annars förenas de som vanliga listor | En lista av `0..1114111` (`char()`) skrivs ut som `string()` eller `nonempty_string()`; en möjligen tom lista av `_` skrivs ut som `list()` |
| Maps | `#{}`, `#{a := 1}`, `#{1..17 => a}`, `map()` | Maps med samma nycklar förenas värde för värde; maps med andra nycklar förenas till en association av sina förenade nycklar och värden (`=>`: vilken nyckel som helst kan saknas) | Fler än 16 nycklar förenas till en association |
| Funs | `fun((term()) -> 1)`, `fun()` | Funs med samma aritet förenar sina resultat; andra ariteter ger `fun()` | — |
| Bitstrings | `<<_:16>>`, `<<_:3, _:_*2>>`, `binary()` | Den kortare storleken plus varje skillnad mellan storlekar som enhet | Bas och enhet 0/8, 8/8, 0/1, 1/1 skrivs ut som `binary()`, `nonempty_binary()`, `bitstring()`, `nonempty_bitstring()` |

- En union behåller en medlem per förenad form, i Erlangs termordning för deras
  värden: tal, atomer, `reference()`, funs, `port()`, `pid()`, tupler, maps,
  `[]`, listor, bitstrings, sedan deklarerade namngivna typer; fler än 8
  medlemmar blir `term()`.
- Behållare nästlas högst 4 nivåer; ett faktum längre in blir `term()`.
- En union tar bort en exakt tupelmedlem som en annan exakt tupel av samma
  storlek rymmer (av två som rymmer varandra stannar den tidigare), så en
  mängd värden har en union; utan detta nådde rekursioner över träd samma
  värden i alternerande former och deras omgångar stabiliserades aldrig.
- En rekursiv komponent förenar resultat i 8 omgångar (cykler av upp till 8
  funktioner konvergerar exakt) och breddar dem sedan. En komponent som inte har
  konvergerat efter ytterligare 4 omgångar per medlem breddar varje medlem till
  `term()` och rapporteras som breddad, som vid en uttömd budget.
- Inskränkning (58H, `Lattice::meet`) är mötet av fakta, de
  värden som båda rymmer (eller fler, men `none()` endast när de inte delar
  något): mönster och guards (typtester som `is_integer/1` inskränker sitt
  argument till kategorin) inskränker inom sin klausul och sätter en funktions
  ingångsdomän; en användning som kastar om inte dess operand har en viss typ
  inskränker operanden efter den på den normala vägen. Ett tomt möte innebär
  att vägen inte kan köras.
- Specifikationer lägger aldrig till fakta: härledda fakta kommer endast från
  kod och avgör aldrig en representation på en specs ord.

Sänkningen (lowering) använder dessa fakta. Vid `-O2` med typspecialisering
tar fakta för argument som förenats från anropare och för uttryck bort
tagg-, form- och tjänstekontroller ([bevis](specialization.md#proofs)); de
enda konverteringarna till heappekare är dessa bevisade läsningar. Varje
tjänsteresultat som kan misslyckas läses endast på sin framgångsväg, och
formkontroller dominerar extraktion. Policy för specialisering:
[specialization.md](specialization.md).

### Inferenscache

Moduler i katalogerna för [inferenscachen](projects.md#inference-cache)
kan börja en kompilering med de resultat som en tidigare kompilering behöll:
sammanfattningar, lokala indata och uttrycksfakta för deras funktioner.
`infer` håller dem fasta i varje pass, går aldrig igenom en komponent vars
medlemmar alla återanvänder dem, och går igenom varje annan funktion som
vanligt, där de behållna sammanfattningarna läses som vilka andra som helst.

- **Vad en moduls fakta beror på.** Exporterade funktioner och funktioner som
  en `fun F/A` namnger börjar från `term()`; varje annan funktions indata
  kommer från dess anropare, som finns i samma modul; ett faktum namnger en
  funktion i en annan modul endast via en atom: ett fjärranrop, `fun M:F/A`,
  eller `apply/2,3` på ett atomfaktum (och läser en annan moduls
  record-layout endast via ett native record som den kvalificerar eller
  importerar), och varje atomfaktum kommer från en atom som modulen stavar
  eller från ett faktum i en modul som den når. Alltså beror en moduls fakta
  endast på dess egen kod och på koden i de batchmoduler som dess atomer
  namnger, transitivt. Nyckeln för dess behållna resultat täcker exakt det:
  identiteten för `clau`, modulens fingeravtryck (dess källkod, varje fil den
  inkluderar, förbehandlingsalternativ och ett svar från en parse transform),
  fördefinierade former, escript- och biblioteksstatus, och detsamma för varje
  batchmodul som dess atomer når. En modul som nås på det sättet och som
  saknar fingeravtryck gör modulen omöjlig att cacha.
- **Livskraft.** Exporters livskraft tar endast bort funktioner, och en
  borttagen anropare inskränker endast indata till de funktioner den anropade:
  fakta som beräknats med fler levande funktioner gäller fortfarande. Behållna
  resultat återanvänds när de rymmer varje funktion som är levande nu
  (`results do not fit` annars); funktioner som utelämnats får ingenting.
- **Blandning.** Behållna och färska resultat kan mötas i en batch: varje
  moduls fakta gäller för varje körning av programmet, vad en annan moduls
  fakta än säger, så en färsk modul som läser en behållen sammanfattning (eller
  tvärtom) förblir sund. En rekursiv komponent med båda sorternas medlemmar gås
  igenom i sin helhet.
- **Precision.** Återanvända resultat är de från den kompilering som behöll
  dem. En färsk moduls resultat kan fortfarande skilja sig från en kompilering
  utan cachen: passets budget betalar inte längre för återanvända moduler, och
  grafidentiteter, efter vilka några unionsmedlemmar ordnas, numreras
  annorlunda.

## `--print-types`

Skriver ut varje modul i batchen (i indata-/målordning, biblioteksmoduler efter
dem) som Erlang-källkod ([utskrift av källkod](compile.md#source-printing)) med
det som typinferensen hittade. Utdata går till stdout och är läsbara för
människor, inte Erlang och inte ett utbytesformat. Varningar stannar på stderr.

```erlang
%% module "branches" source="branches.erl" target="" declared=complete inferred=complete
-module(branches).
-export([mixed/1]).

%% inferred: mixed(1) -> 1; (_) -> 2
mixed(X) ->
    case X of
        1 ->
            1;
        _ ->
            2
    end. % $case_of_operator(X :: 1) -> 1; (X :: _) -> 2
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
- Varje rads yttersta uttryck (ett uttryck i kroppen, eller det testade
  uttrycket i ett `case`) vars faktum säger mer än `term()` noteras med en
  avslutande kommentar `% Type` efter radens skiljetecken (en känd typ döljer en
  argumentrelation, som bara visas för ett värde som inte är känt som något
  annat): högst en notering per rad, ingen för uttrycken som är nästlade i det,
  så att utdata förblir giltig Erlang. Ett uttryck i kroppen över flera rader
  har sin notering på sista raden (`end, % ...`). Literala termer (literaler,
  och tupler, listor, konstruerade maps och bitstrings av literaler) noteras
  inte; en matchning visar sitt värde. Ett beroende värde skrivs ut som en
  funktionstyp för sin konstruktion ([beroende fakta](#dependent-facts)).
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
- `clauses.erl` täcker funktionstyper: typtester och literala mönster
  per klausul, sammanslagna lika indata, en klausul som anropare aldrig går in
  i, fler klausuler än budgeten, en rekursiv funktion, en enda klausul, ett
  `case` och ett `if` som avslutar kroppen, ett nästlat `case` och ett `case`
  som inte är sist, anonyma funs med flera klausuler, `fun F/A`, föreningar av
  lika och av olika funs, och en klausul som alltid kastar; samt val vid anrop:
  ett typtest, en första exakt gren, okända argument, ingen godtagen
  typ, inskränkning efter anropet, ett literalt argument, ett intervall över två
  klausuler, nästlade anrop, en lokal funktion med flera anropare, en rekursiv
  anropad funktion, och funs med flera klausuler som är bundna, ligger i en
  tupel, skickas till en lokal funktion och anropas med ett okänt argument; samt
  evaluering per anrop: resultat per anrop, nästling upp till och
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
