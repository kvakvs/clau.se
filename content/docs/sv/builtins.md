---
source: docs/builtins.md
sourceCommit: 06042fa
sourceSha256: f29dab6160d90187001e7fd8ed997c13236a315dce8c744f9d83072bfdbdaae4
translatedAt: 2026-10-09
---
# Inbyggda funktioner

Plan 11 step 36 (2026-10-07): bryggan för inbyggda funktioner (builtins) i
produktion. Inbyggda funktioner är `erlang`-funktioner som runtime implementerar
i C++. Runtime registrerar dem efter modul, funktion och aritet; genererad kod
når dem direkt, via dynamiska anrop och som fun-värden.

## Vilka inbyggda funktioner som finns

Bryggans katalog `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) listar varje inbyggd
funktion som både kompilatorn och runtime känner till:

- guard-BIF:arna: typtester (`is_atom/1` … `is_tuple/1`, `is_function/1,2`),
  `abs/1`, `bit_size/1`, `byte_size/1`, `ceil/1`, `element/2`, `float/1`,
  `floor/1`, `hd/1`, `length/1`, `map_get/2`, `map_size/1`, `is_map_key/2`,
  `max/2`, `min/2`, `round/1`, `size/1`, `tl/1`, `trunc/1`, `tuple_size/1`,
  `binary_part/2,3`;
- operatorerna som funktioner: jämförelser, `not/1`, `and/2`, `or/2`,
  `xor/2`, aritmetiska och bitvisa operatorer (`erlang:'+'/1,2` …);
- `display/1`, `halt/0,1`, `error/1,2,3`, `exit/1`, `throw/1`, `raise/3` och
  `function_exported/3`;
- termåtkomst (plan step 37): `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` och listoperatorerna `'++'/2` och
  `'--'/2` (`A ++ B`, `A -- B` sänks (lowering) till dem);
- konverteringar (plan step 38): `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` är inte valt);
- konsolutdata (plan step 40): `io:format/1,2` och `io:put_chars/1`, de
  första inbyggda funktionerna i en annan modul ([io](io.md));
- processidentiteter (plan step 42): `self/0`, `make_ref/0`, `pid_to_list/1`
  och `ref_to_list/1` ([pids och referenser](terms.md#pids-and-references));
- processer (plan step 43): `spawn/1,3` och `is_process_alive/1`
  ([processer](processes.md)); länkar och exit-signaler (step 48):
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([länkar](processes.md#links)); monitorer (step 49):
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([monitorer](processes.md#monitors)); registrerade namn (step 50):
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([registrerade namn](processes.md#registered-names));
- meddelanden (plan step 45): `'!'/2` (operatorn `!`) och `send/2`
  ([meddelanden](processes.md#messages)).

Poster läggs bara till i slutet: en posts index är det nummer som genererad kod
skickar till bryggtjänsten. Ett kvalificerat anrop av en inbyggd funktion i
katalogen som tillhör en annan modul (`io:format(F, A)`) anropar också bryggan.
Andra `erlang`-funktioner behåller sin diagnostik:
ett direktanrop av en okänd ger `unknown module erlang`, medan `fun erlang:F/A`
eller `fun F/A` av en guard-BIF utanför katalogen (`node/0`) och
`fun erlang:apply/2,3` rapporterar den otillgängliga förmågan `dynamic calls`.

## Hur anrop når dem

| Källa | Väg |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Inline-tjänster, som före bryggan |
| `erlang:function_exported(M, F, A)`, `setelement(I, T, V)`, `A ++ B`, `A -- B`, `length(L)` i en kropp (inbyggda funktioner i katalogen utan inline-tjänst) | Anropas som en funktion: `CLAUSE_builtin_frame_v1(context, index)` ger den inbyggda funktionens ram, argumenten läggs i registren ([portioner](#portions)) |
| `fun abs/1`, `fun erlang:'+'/2` | Extern fun `erlang:F/A`; registreringen binder den till den inbyggda funktionen |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` vid körning | Kodservern söker först en modulexport, sedan en inbyggd funktion |

- `fun F/A` av en autoimporterad inbyggd funktion som modulen varken definierar
  eller undertrycker (`-compile({no_auto_import, ...})`) är den externa funen
  `erlang:F/A`, som i OTP: `fun abs/1 =:= fun erlang:abs/1` och den skrivs ut som
  `fun erlang:abs/1`. `halt/0,1`, `setelement/3`, `tuple_to_list/1`,
  `list_to_tuple/1`, konverteringarna, processfunktionerna och portfunktionerna `open_port/2`, `port_close/1`,
  `port_command/2,3`, `port_connect/2`, `port_control/3`, `port_to_list/1`, `list_to_port/1` autoimporteras som
  i OTP; `display/1`, `raise/3`, `function_exported/3`, `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3` och
  `ports/0` kräver prefixet `erlang:` ([portar](ports.md#builtins-and-port-messages)).
- En inbyggd funktion har en `FrameDescriptor` med null-kropp (`BuiltinFrame`).
  Att anropa den (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) lägger inte på någon
  ram: den inbyggda funktionen körs på registren och dess resultat återgår till
  anroparens kropp, så en inbyggd funktion i svansposition återvänder till
  anroparens anropare.
- Felen är de som inline-sänkningen ger i en kropp: `badarg`, `badarith` för
  aritmetik, `system_limit`, `{badmap, M}`, `{badkey, K}`; `raise/3` med en
  ogiltig klass eller stack returnerar `badarg`. De går genom den kontrollerade
  felkanalen som alla tjänstefel.
- Termåtkomst följer OTP:s regler för `badarg`: `setelement/3` kräver ett litet
  heltalsindex inom tupeln; `make_tuple/2,3` en liten storlek i
  0..16 777 215, och `make_tuple/3` en äkta lista av `{Index, Value}`-par inom
  storleken (senare par vinner); `list_to_tuple/1` en äkta lista; `A ++ B` en
  äkta lista `A` (`[] ++ B` är `B` för varje `B`, en `B` som inte är en lista
  avslutar resultatet); `A -- B` två äkta listor, där varje element i `B` tar
  bort det första exakt lika (`=:=`) elementet i `A`, i O((n + m) log m).
- Konverteringar följer OTP:
  - `list_to_atom/1` tar en äkta lista av kodpunkter (inga surrogat); ett
    256:e tecken ger `system_limit` innan det kontrolleras. En full atomtabell
    (`--max-atoms`) stoppar programmet som ett runtime-fel
    (`resource_limit`, slutstatus 70).
  - `integer_to_list/2` och `list_to_integer/2` tar en liten bas i 2..36;
    siffror skrivs med versaler och tolkas i båda skiftlägen. `list_to_integer`
    godtar ett valfritt tecken, hoppar över inledande nollor, kräver en siffra
    och ger `system_limit` för fler än 1 262 611 signifikanta decimala siffror
    (eller 4 194 304 i valfri bas) när dess första siffror är giltiga, samt för
    ett värde bortom heltalsgränsen.
  - `float_to_list/1` är `"%.20e"`; alternativen till `/2` tillämpas i ordning
    och det sista formatet vinner: `{scientific, D}` (`"%.*e"`, negativt D blir
    6), `{decimals, D}` (D >= 0; fast notation med OTP:s egen avrundning under
    2^53 och 19 decimaler, `compact` tar bort avslutande nollor, även för ett
    heltal med `{decimals, 0}` över 2^53), `short` (kortaste tur-och-retur-siffror
    i OTP:s val mellan fast och vetenskaplig notation). Text på 256 byte eller
    mer ger `badarg`.
  - `binary_to_list/1` kräver en binary; `list_to_binary/1` en lista och
    `iolist_to_binary/1` en lista eller binary av byte, binaries och nästlade
    listor, där varje lista slutar med `[]` eller en binary.
- `function_exported(M, F, A)` ger `badarg` om inte `M` och `F` är atomer och
  `A` ett litet heltal; den är sann när en modul i programmet exporterar
  `M:F/A` eller när `M:F/A` är en registrerad inbyggd funktion.

## Portioner

Plan 11 step 43A (2026-10-08): inbyggda funktioner vars arbete växer med ett
list- eller binary-argument körs i begränsade portioner, likt OTP:s trappande
BIF:ar, så att en lång inbyggd funktion inte kan hindra andra processer från att
köras ([processer](processes.md)).

- Varje inbyggd funktion i bryggan som en kropp anropar anropas som en funktion
  och förbrukar en reduktion. En portion får utföra `WORK_PER_REDUCTION` (16)
  arbetsenheter per reduktion som återstår av tidsskivan (minst en reduktions
  värde): genomgångna eller byggda listceller, jämförelser, byte. Den betalar
  för dem ur tidsskivan.
- En inbyggd funktion med arbete kvar trappar: `ProcessStack::trap` anger en
  fortsättningsram och lägger funktionens tillståndstermer i registren, som
  förblir rötter; nativt tillstånd (byte, sorteringspositioner, termord som
  hålls som rötter) lever i processtackens `TrapState`. Processen lämnar ifrån
  sig körningen och återupptas vid fortsättningen i en senare tidsskiva.
  Skräpsamlingar mellan portioner skriver om registren och tillståndsorden som
  andra rötter.
- Resultat, fel och utvärderingsordning är desamma som vid körning till slut.
  Ett fel som upptäcks sent (en oäkta svans) ges när genomgången når det.
- Värdanrop (`call_builtin`) fortsätter varje trap direkt.

| Inbyggd funktion | Portioner |
| --- | --- |
| `length/1` i en kropp | Räknar celler; i en guard förblir den inline-tjänsten, eftersom OTP:s guard-BIF inte trappar |
| `A ++ B` | Samlar `A`:s element och bygger sedan kopian på `B` från dess slut |
| `A -- B` | Samlar `B`, sorterar den i exakt ordning (nedifrån-och-upp-mergesort), går igenom `A` med en binärsökning per element och bygger sedan de behållna elementen; när ingenting tas bort är resultatet `A` självt |
| `binary_to_list/1` | Bygger listan från binaryns slut |
| `list_to_binary/1`, `iolist_to_binary/1` | Går igenom iolistan på djupet först och skapar sedan binaryn på en gång |

Andra inbyggda funktioner körs till slut. Tupelfunktionerna (`setelement/3`,
`make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) gör som i OTP: deras
arbete begränsas av gränsen för tupelaritet. Övriga konverteringar läser
indata som begränsas av gränserna för atomer, heltal och flyttal. Formatering
med `io:format/1,2` körs till slut ([skillnader](differences.md)).
Inline-tjänster i loopar (en comprehensions avslutande omvändning) körs till
slut som en del av loopen.

## Typade inbyggda funktioner

Plan 11 step 41 (2026-10-07): inbyggda funktioner som kontrollerar sina egna
argument är C++-funktioner med typade parametrar ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registrerade med
`typed_entry<Function>(module, name)` (ariteten är antalet parametrar).

- Adaptern tillåter varje argumentord i ordning (ett ord som denna process inte
  äger är det fel det är, aldrig `badarg`) och konverterar sedan vart och ett
  till dess parametertyp; en avvikelse ger `badarg` och funktionen körs inte.
- Parametertyper: `Term` (vilken term som helst, den generiska reservlösningen),
  `std::int64_t` (ett litet heltal), `detail::Integer` (vilket heltal som helst),
  `double` (ett flyttal), `ListArgument` (en äkta lista och dess element),
  `TupleArgument`, `BinaryArgument` (en binarys byte), `AtomArgument` (dess
  stavning).
- Resultat: `Term`, `TermResult<Term>` (en misslyckad konstruktion är ett
  runtime-fel), `BuiltinResult<Term>` (`std::expected` med ett `BuiltinFailure`)
  eller ett rått `Word` som funktionen själv publicerat. En funktion kan också
  kasta `BuiltinFailure` (ett Erlang-fel som `badarg` eller `system_limit`, eller
  ett fel vid termåtkomst); `call_builtin` gör om alla andra C++-undantag till
  `out_of_memory` eller `internal_error`, så att inget korsar ABI:t för
  genererad kod.
- Familjerna för termåtkomst, konvertering och io, `binary_part/2` och
  `function_exported/3` är typade. Övriga inbyggda `erlang`-funktioner skickar
  sina argumentord okonverterade till de inline-tjänster som genererad kod också
  anropar, och som tillåter dem; de förblir `BuiltinBody`-adaptrar på ordnivå.

## Registrering

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  som ägs av `CodeServer`, mappar exakt modul/funktion/aritet till en
  `BuiltinFrame`. `add` tar en batch av `BuiltinEntry` och registrerar alla
  eller ingen: ett tomt namn, fler än 255 argument, en saknad implementation
  eller ett namn som redan är registrerat (eller upprepas i batchen) avvisar
  batchen utan att något behålls.
- Vid start registrerar runtime varje tabell i `production_builtins()`
  (`erlang_builtins()`, `term_access_builtins()`, `conversion_builtins()`,
  `io_builtins()`), där de flesta poster skapas av `typed_entry`,
  och som tillsammans täcker
  katalogen; senare familjer lägger till egna tabeller.
- En kropp läser exakt sin aritet av argumentord och registrerar fel i den
  kontrollerade kanalen; värdundantag blir fel av typen `out_of_memory` eller
  `internal_error`.
- Den äldre värdvägen `abi::v1::dispatch_builtin` (värdregistrerade
  native-moduler efter namn, [runtime](runtime.md#code-server-and-builtins)) är
  separat och oförändrad.
