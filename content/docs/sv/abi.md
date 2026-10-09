---
source: docs/abi.md
sourceCommit: 06042fa
sourceSha256: f8f56cfac2333ccc8481b962036e323d397415d2505365d432a3e26b811a54b6
translatedAt: 2026-10-09
---
# ABI för genererad kod (revision 4)

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
  ordning.
- Tom tupel exakt `0x2b` och nil exakt `0x3b`; andra nyttolastbitar är
  ogiltiga.
- Lokala pids: de fyra lägsta bitarna `0x3`, nyttolasten är processnumret,
  godtas endast när runtime har utfärdat den
  ([pids och referenser](terms.md#pids-and-references)).
- Boxade ord och listord pekar in i den ägande processens heap och godtas
  endast efter att runtime har bevisat ägarskapet (se [termer](terms.md)).

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
`<prefix>.records`-tabell som andra moduler i en batch refererar till, och
fun-deskriptorer i en privat `<prefix>.funs`-tabell
([funs](funs.md#representation)). Registreringen anropar
`CLAUSE_register_module_v4(Runtime*)`, som validerar version/bredd och alla
exporter, internerar atomer, bygger ett fryst register och publicerar det
tillsammans med kodavbilden i en enda transaktion. Dubblerade moduler ersätter
aldrig kod; vid varje fel publiceras ingenting (redan internerade atomer stannar
i den begränsade tabellen).

- Anropa `.register` explicit innan exporter slås upp. Det finns inga globala
  konstruktorer; användare av statiska arkiv måste referera till
  registreringsingångarna.
- `llvm.used` behåller deskriptorer och ingångar; länkning utan runtime
  misslyckas på den saknade tjänstesymbolen.
- Deskriptorns adress är nyckeln för atombindningar; dess avbild måste förbli
  mappad under modulens livstid. Varje runtime har egna bindningar för samma
  avbild.
- Atomuttryck läser platser via `CLAUSE_atom_v3`; de internerar aldrig.
- Ett startobjekt (`clausev1_start`) listar varje deskriptor i en
  `StartupDescriptor` och dess native `main` anropar
  `CLAUSE_main_v1(argc, argv, descriptor)`, som registrerar alla moduler och
  kör ingången ([körbara filer](executables.md#startup-object)).

## Felkanal (revision 2)

Fel kodas inte i termbitar. Efter varje genererat anrop som inte är ett
svansanrop kontrollerar anroparen `CLAUSE_call_failed_v2(context)` innan
resultatet används eller nästa argument evalueras. Vid fel returnerar den
anropade ett ogiltigt nollord.

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
med en `raised_*`-orsak och samma stack, vilket rapporteras och fångas exakt som
originalet. `of`-klausuler väljer på kroppens värde och kastar
`{try_clause, Value}` (`ErrorReason::try_clause = 14`); undantag inuti
`of`-klausuler och hanterare går till den omgivande hanteraren.

`maybe` behöver ingen tjänst: varje `?=` är en vanlig matchning vars kant för
icke-matchning lämnar kroppen mot maybes utgång med det omatchade (redan
rotade) värdet. Utan `else` är det värdet resultatet; annars väljer
`else`-klausuler på det som `case`-klausuler och kastar `{else_clause, Value}`
(`ErrorReason::else_clause = 15`) när ingen matchar.

Comprehensions använder de befintliga tjänsterna med några få operationer: de
ackumulerade elementen vänds av konstruktionen `reverse`
(`ContainerConstruction::reverse = 2`, värden `{List, Tail}`); en binary
comprehension sammanfogar sina delar med `BitOperation::concat` (`{List}`) och
en map comprehension bygger sin map med `MapOperation::from_list` (`{Pairs}`,
senare nycklar vinner). Map-generatorer läser `MapOperation::key_at`/`value_at`
(`{Map, Position}` i kanonisk nyckelordning) och visar en zips återstående
indata med `MapOperation::iterator`, OTP:s kedja `{K, V, Next}` som slutar i
`none`. Bitstring-generatorer använder vanlig mönsterextraktion plus ett
avslutande `binary`/`all`-segment för resten.

`try ... after A end` lägger till ett andra skydd runt kroppen och alla `of`-
och catch-klausuler. På den normala vägen körs `A` efter att det valda värdet
har rotats, och dess värde kastas bort. After-hanteraren tar undantaget med
`CLAUSE_exception_v2`, kör en andra kopia av `A` och kastar om med
`CLAUSE_reraise_v2`; ett undantag eller fel inuti `A` lämnar i stället via den
omgivande hanteraren och ersätter originalet. Halts och infrastrukturfel hoppar
över `A`. Rotplatser tillhör funktionsramen, så varje väg frigör dem vid
funktionens utgång.

### Stackspår

Varje rotram namnger sin genererade funktion med en privat
`abi::v1::FrameDescriptor` (moduldeskriptor, platser för modul- och
funktionsnamnsatomer, aritet). När ett Erlang-undantag registreras kopierar
kanalen de 8 innersta namngivna ramarna (BEAM:s standard för
`backtrace_depth`); termen `[{Module, Function, Arity, []}, ...]` byggs först
när en hanterare, `catch` eller en rapport efterfrågar den. Den översta ramen
visar argumentlistan till `error/2,3` i stället för ariteten när det argumentet
är en lista.

`erlang:raise(Class, Reason, Stack)` (`CLAUSE_reraise_v2`) godtar de stackar som
BEAM godtar: en korrekt lista av `{M, F, A}` (kompletterad med platsen `[]`)
eller `{M, F, A, Location}` med atomerna `M`, `F` och en lista `Location`,
avkortad till 8 poster; stacken behålls sedan som den gavs och ramar fångas inte
längre. En ogiltig klass eller stack registrerar ingenting och anropet
evalueras till `badarg`, som i OTP. `erlang:get_stacktrace/0` avvisas med
OTP 29:s lint-text om att funktionen är "removed".

Skillnader mot OTP, alla synliga endast i stacktermen:

- Platser är alltid `[]` (OTP lägger till `{file, F}`, `{line, L}`), och
  alternativ till `error/3` lägger inte till någon `error_info`.
- En översta ram för `function_clause` visar ariteten, inte argumentlistan.
- Ingen ram namnger en misslyckad BIF eller operator (OTP lägger till
  `{erlang, '+', Args, [{error_info, ...}]}`), och ingenting under
  ingångsfunktionen visas.
- Ett svansanrop frigör anroparens ram (step 19), så, som i OTP, saknas en
  anropare som avslutades med ett svansanrop i spåret. OTP gör också anrop till
  funktioner som aldrig returnerar till svansanrop; det gör inte Clause.
- Stackposter av formen `{Fun, Args}` till `erlang:raise/3` avvisas fortfarande.

## Ramar och överföringar

Genererade funktioner körs på explicita ramar
([exekveringsmodell](execution-model.md), step 19; tjänster i
[frames.hpp](../abi/include/clause/abi/frames.hpp)). Varje funktion har en
`<symbol>.frame`-deskriptor (`FrameDescriptor`: moduldeskriptor, platser för
modul- och funktionsatomer, aritet, kroppskod, antal platser, antal termplatser;
extern för exporterade funktioner) och en intern `<symbol>.body` av typen
`void(void *context)`. En exporterad `<symbol>` behåller signaturen
`TermWord(Context *, const TermWord *)` som värdingång som anropar
`CLAUSE_invoke_v1(context, frame, arguments)`.

- En kropp läser sitt ramhuvud (`CLAUSE_frame_v1`) och registren
  (`CLAUSE_registers_v1`) vid ingång och väljer gren efter huvudets
  återupptagningsord. Den lämnar endast genom `musttail`-anrop av den kod som
  `CLAUSE_enter_v1` (anrop), `CLAUSE_tail_v1` (svansanrop) eller
  `CLAUSE_return_v1` (retur) ger tillbaka.
- Argumenten upptar ramens första platser; varje evaluerat värde lagras i en
  termplats före nästa uttryck eller anrop. Misslyckade kandidater rensar sina
  platser. Värden som en kropp fortfarande behöver efter ett anrop eller en
  safepoint i ett loophuvud spills: termer till termplatser (räknade i
  deskriptorns `roots`), andra ord till råa platser efter dem; råa platser är
  inte rötter.
- Ett resultat skickas i register 0; felnyttolaster är rotord i kanalen (BEAM:s
  `fvalue`). Ett fel returnerar till anroparen som ett resultat och varje
  anropare kontrollerar kanalen efter anropet; huvudets hanterarord förblir 0.
- Stacken har inget tak som standard; en push som värden inte kan allokera
  registrerar `out_of_memory`, och en som överskrider en valfri gräns per
  process, `StackOptions::limit_words`, registrerar `resource_limit`
  (infrastrukturfel).
- Ett anrop av ett funktionsvärde skickar dess argument, och funens fångade
  värden efter dem, i registren; `CLAUSE_apply_v1` returnerar den
  `FrameDescriptor` som överföringen går in i ([funs](funs.md#representation)).
- Safepoints: `CLAUSE_enter_v1`/`CLAUSE_tail_v1` samlar skräp innan den anropade
  funktionens ram pushas (dess argument är registerrötter), och
  `CLAUSE_safepoint_v1(context)` vid varje loophuvud i en comprehension samlar
  på plats när heapen begär det. Varje annan tjänst är en kritisk sektion som
  aldrig flyttar heapen
  ([skräpsamling i genererad kod](runtime-heap.md#collection-in-generated-code)).

## Runtime-tjänster

Genererad kod anropar kontrollerade C++-tjänster: `CLAUSE_exact_v1` (exakt
likhet), `CLAUSE_immediate_v1` (predikat/frågor för omedelbara värden),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1`, `CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`,
`CLAUSE_record_v1` (make/get/update/match/test för native records under en
`RecordCheck`; utfall `bad_record`, `bad_field`, `no_match`),
`CLAUSE_make_fun_v1` (bygger en fun av en `FunDescriptor`). Var och en
returnerar framgång, semantiskt fel (`badarg`/`badarith`/...) eller
infrastrukturfel och skriver utdata endast vid framgång. `CLAUSE_display_v1`
([output.hpp](../abi/include/clause/abi/output.hpp)) skriver ut en rad med
`erlang:display/1` och ger `true`; den har inget semantiskt fel.
`CLAUSE_halt_v1` lyckas aldrig: den registrerar en begäran om halt
(`CallError::halted` med slutstatusen) eller `badarg`, så att anroparen
avvecklar. Länkarens stavningar följer målets Itanium- eller
Microsoft-C++-mangling.

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
