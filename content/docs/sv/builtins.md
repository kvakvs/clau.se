---
source: docs/builtins.md
sourceCommit: a8c3f8f6
sourceSha256: c5b5b3ed022c6da6d2e2862ed0b124314e7f7a5b8cfdfcc5b3a787b4b99841fb
translatedAt: 2026-10-17
---
# Inbyggda funktioner

Inbyggda funktioner (builtins) är funktioner som runtime implementerar i C++:
`erlang`-BIF:arna och de funktioner i andra moduler vars motsvarigheter i OTP är
BIF:ar, NIF:ar eller behöver runtime (`io`-utdata, datafunktionerna i `lists`,
`math`, `binary`, ...). Runtime registrerar dem efter modul, funktion och
aritet; genererad kod når dem direkt, via dynamiska anrop och som fun-värden.

## Vilka inbyggda funktioner som finns

Bryggans katalog `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) listar varje inbyggd
funktion som både kompilatorn och runtime känner till, i grupper vars
kommentarer namnger den implementerande källfilen:

- modulen `erlang`: guard-BIF:arna, operatorerna som funktioner
  (`erlang:'+'/2`, `'++'/2`, `'--'/2`, ...), `display/1`, `halt/0,1`, de
  felkastande funktionerna, termåtkomst, konverteringar, processidentiteter,
  [processer](processes.md) (start av processer, meddelanden, länkar,
  monitorer, registrerade namn, processlexikonet, timers, introspektion,
  spawn-alternativ, alias, noder), [portar](ports.md#builtins-and-port-messages),
  det [externa termformatet](#external-term-format), [tid](#time),
  [systeminformation](#system-information),
  [information om funs](funs.md#fun-information), [hashning](#hashing) och
  [kodladdning](#code-loading);
- andra moduler: `io`-utdata ([io](io.md)), datafunktionerna i
  [`lists`](#lists-module), [`math`](#math-module),
  [`binary`](#binary-module), [`maps` och `os`](#maps-module),
  [`persistent_term`](#persistent-terms), [`unicode`](#unicode-module),
  [`code`](#code-module), [`init`](#init-module),
  [`atomics`](#atomics-and-counters), [`erts_internal`](#erts-internal),
  [`unicode_util`](#unicode-util) och [`re`](#re-module);
- privata moduler under Erlang-bibliotekskod: `clause_unicode`, `clause_re`,
  `clause_zlib` ([zlib](#zlib-module)) och `clause_receive`
  ([prim eval](#prim-eval)).

Vilken funktion i en biblioteksmodul som är en inbyggd funktion, en
Erlang-kropp eller en stubbe registreras i dess inventering
`library/<application>/<module>.terms` ([bibliotek](library.md#files));
`erlang`:s är [erlang.terms](#erlang-module).

En posts index är det tal som genererad kod skickar till bryggtjänsten;
kompilatorn och runtime byggs tillsammans, så katalogen får ordnas om. Ett
kvalificerat anrop av en inbyggd funktion i katalogen i vilken modul som helst
(`io:format(F, A)`) anropar bryggan. Varje annan `erlang`-funktion når
[biblioteksmodulen erlang](#erlang-module).

## Hur anrop når dem

| Källkod | Väg |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Inline-kod eller en dedikerad runtime-tjänst |
| `erlang:function_exported(M, F, A)`, `A -- B`, `length(L)` i en kropp (inbyggda funktioner i katalogen utan inline-tjänst) | Går in som en funktion: `CLAUSE_builtin_frame_v1(context, index)` ger den inbyggda funktionens ram, argumenten läggs i registren ([portioner](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (direkta inbyggda funktioner: trappar, väntar eller agerar aldrig på en annan process) | Anropas direkt: `CLAUSE_builtin_call_v1(context, index, arguments)` returnerar resultatet ([ABI](abi.md#runtime-services)) |
| `A ++ B` | En kort äkta `A` kopieras inline; annars går den in som en funktion ([ABI](abi.md#frames-and-transfers)) |
| `fun abs/1`, `fun erlang:'+'/2` | Extern fun `erlang:F/A`; registreringen binder den till den inbyggda funktionen |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` i runtime | Kodservern hittar först en moduls export, sedan en inbyggd funktion |

- `fun F/A` av en autoimporterad inbyggd funktion som modulen varken definierar
  eller undertrycker (`-compile({no_auto_import, ...})`) är den externa funen
  `erlang:F/A`, som i OTP: `fun abs/1 =:= fun erlang:abs/1` och den skrivs ut
  som `fun erlang:abs/1`. Autoimporterna är OTP:s (flaggan `auto_import` i
  [erlang.terms](#erlang-module)); andra, som `display/1`, `raise/3`,
  `function_exported/3`, `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3`
  och `ports/0`, behöver prefixet `erlang:`.
- En inbyggd funktion har en `FrameDescriptor` med en null-kropp
  (`BuiltinFrame`). Att gå in i den (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`)
  lägger ingen ram på stacken: den inbyggda funktionen körs på registren och
  dess resultat returneras till anroparens kropp, så en inbyggd funktion i
  svansposition returnerar till anroparens anropare.
- Felen är de som inline-sänkningen ger i en kropp: `badarg`, `badarith` för
  aritmetik, `system_limit`, `{badmap, M}`, `{badkey, K}`; `raise/3` med en
  ogiltig klass eller stack returnerar `badarg`. De går genom den kontrollerade
  felkanalen som varje tjänstefel.
- Termåtkomst följer OTP:s `badarg`-regler: `setelement/3` behöver ett litet
  heltalsindex inom tupeln; `make_tuple/2,3` en liten storlek i
  0..16 777 215, och `make_tuple/3` en äkta lista av par `{Index, Value}` inom
  storleken (senare par vinner); `list_to_tuple/1` en äkta lista; `A ++ B` en
  äkta lista `A` (`[] ++ B` är `B` för varje `B`, en `B` som inte är en lista
  avslutar resultatet); `A -- B` två äkta listor, där varje element i `B` tar
  bort det första exakt lika (`=:=`) elementet i `A`, i O((n + m) log m).
- Konverteringar följer OTP:
  - `list_to_atom/1` tar en äkta lista av kodpunkter (inga surrogat); ett
    256:e tecken ger `system_limit` innan det kontrolleras. En full atomtabell
    (`--max-atoms`) stoppar programmet som ett runtime-fel
    (`resource_limit`, exit 70).
  - `integer_to_list/2` och `list_to_integer/2` tar en liten bas i 2..36;
    siffror skrivs ut med versaler och tolkas i båda skiftlägena.
    `list_to_integer` godtar ett valfritt tecken, hoppar över inledande nollor,
    behöver en siffra och ger `system_limit` för fler än 1 262 611
    signifikanta decimala siffror (eller 4 194 304 i vilken bas som helst) när
    dess första siffror är giltiga, samt för ett värde bortom heltalsgränsen.
  - `float_to_list/1` är `"%.20e"`; alternativen till `/2` tillämpas i ordning
    och det sista formatet vinner: `{scientific, D}` (`"%.*e"`, negativt D är
    6), `{decimals, D}` (D >= 0; fast notation med OTP:s egen avrundning under
    2^53 och 19 decimaler, `compact` tar bort avslutande nollor, även för ett
    heltal med `{decimals, 0}` över 2^53), `short` (kortaste siffror som klarar
    en tur och retur, med OTP:s val mellan fast och vetenskaplig notation).
    Text på 256 byte eller mer ger `badarg`.
  - `binary_to_list/1` behöver en binary; `list_to_binary/1` en lista och
    `iolist_to_binary/1` en lista eller binary av byte, binaries och nästlade
    listor, där varje lista slutar med `[]` eller en binary.
  - Binary-tvillingarna (`atom_to_binary/1,2`, `binary_to_integer/1,2`,
    `float_to_binary/1,2`, `list_to_float/1`, ...) delar dessa textregler
    (`erlang/conversion_text.cpp`): flyttalstext behöver siffror på båda sidor
    om punkten (`list_to_float("1e10")` ger `badarg`), en exponent utanför
    intervallet ger `badarg` och ett underflöde `0.0`; kodningarna är `utf8`,
    `unicode` och `latin1`.
- `function_exported(M, F, A)` ger `badarg` om inte `M` och `F` är atomer och
  `A` ett litet heltal; den är sann när en modul i programmet exporterar
  `M:F/A` eller `M:F/A` är en registrerad inbyggd funktion.

## Portioner

Inbyggda funktioner vars arbete växer med ett list- eller binary-argument körs i
begränsade portioner, likt OTP:s trappande BIF:ar, så att en lång inbyggd
funktion inte kan hindra andra processer från att köras
([processer](processes.md)).

- Varje inbyggd funktion i bryggan som en kropp anropar går in som en funktion
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
- En inbyggd funktion kan också fortsätta i en Erlang-export: `io`-utdata till
  en processenhet trappar in i `file:write/2` ([io](io.md#calls)).
- Resultat, fel och utvärderingsordning är desamma som vid körning till slut.
  Ett fel som upptäcks sent (en oäkta svans) ges när genomgången når det.
- Värdanrop (`call_builtin`) fortsätter varje trap direkt.
- Listgenomgångar validerar listan en gång och läser dess celler som ord. Små
  indata tar snabba vägar på ordnivå utan portionstillstånd: `Left ++ Right`
  med högst 64 celler i `Left`, `integer_to_list/1` av ett litet heltal,
  `list_to_integer/1` av en kort decimal sträng, `atom_to_list/1`,
  `list_to_tuple/1` och `tuple_to_list/1`.

| Inbyggd funktion | Portioner |
| --- | --- |
| `length/1` i en kropp | Räknar celler; i en guard förblir den inline-tjänsten, eftersom OTP:s guard-BIF inte trappar |
| `A ++ B` | Samlar `A`:s element och bygger sedan kopian på `B` från dess slut |
| `A -- B` | Samlar `B`, sorterar den i exakt ordning (nedifrån-och-upp-mergesort), går igenom `A` med en binärsökning per element och bygger sedan de behållna elementen; när ingenting tas bort är resultatet `A` självt |
| `binary_to_list/1` | Bygger listan från binaryns slut |
| `list_to_binary/1`, `iolist_to_binary/1` | Går igenom iolistan på djupet först och skapar sedan binaryn på en gång |

Andra inbyggda funktioner körs till slut. Tupelfunktionerna (`setelement/3`,
`make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) gör som i OTP: deras
arbete begränsas av gränsen för tupelaritet. Övriga konverteringar läser indata
som begränsas av gränserna för atomer, heltal och flyttal. Formatering med
`io:format/1,2` körs till slut ([skillnader](differences.md)). Inline-tjänster
i loopar (en comprehensions avslutande omvändning) körs till slut som en del av
loopen.

## Typade inbyggda funktioner

Inbyggda funktioner som kontrollerar sina egna argument är C++-funktioner med
typade parametrar ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registrerade med
`typed_entry<Function>(module, name)` (ariteten är antalet parametrar).

- Adaptern tillåter varje argumentord i ordning (ett ord som denna process inte
  äger är det fel det är, aldrig `badarg`) och konverterar sedan vart och ett
  till dess parametertyp (`Term`, ett litet eller godtyckligt heltal, `double`,
  lista, tupel, binary, atom, map eller lokala pid-argument; se `typed.hpp`);
  en avvikelse ger `badarg` och funktionen körs inte.
- En funktion returnerar en term, ett `BuiltinResult` (`std::expected` med ett
  `BuiltinFailure`) eller ett rått `Word` som den själv publicerat, eller kastar
  `BuiltinFailure` (ett Erlang-fel eller ett fel vid termåtkomst);
  `call_builtin` gör om alla andra C++-undantag till `out_of_memory` eller
  `internal_error`, så att inget korsar ABI:t för genererad kod.
- De flesta familjer är typade. Guard-BIF:arna och operatorerna
  (`erlang/core.cpp`), de trappande listfunktionerna och några andra är
  `BuiltinBody`-adaptrar på ordnivå, som skickar sina argumentord till de
  inline-tjänster som genererad kod också anropar.

## Registrering

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  som ägs av `CodeServer`, mappar exakt modul/funktion/aritet till en
  `BuiltinFrame`. `add` tar en batch av `BuiltinEntry` och registrerar alla
  eller ingen: ett tomt namn, fler än 255 argument, en saknad implementation
  eller ett namn som redan är registrerat (eller upprepas i batchen) avvisar
  batchen utan att något behålls.
- Vid start registrerar runtime varje familjetabell i `production_builtins()`
  (`builtins/registry.cpp`), som tillsammans täcker katalogen.
- Inbyggda funktioner är klistriga (sticky): när en modul registreras hoppar
  kodservern över varje export som har namnet på en registrerad inbyggd
  funktion, så `M:F(Args)`, `apply/3` och externa funs binder den inbyggda
  funktionen, aldrig en biblioteksstubbe eller en användarfunktion med samma
  namn.
- En kropp läser exakt sin aritet av argumentord och registrerar fel i den
  kontrollerade kanalen; värdundantag blir fel av typen `out_of_memory` eller
  `internal_error`.
- Värdvägen `abi::v1::dispatch_builtin` (värdregistrerade native-moduler efter
  namn, [runtime](runtime.md#code-server-and-builtins)) är separat.

## Källkodslayout

- Runtime implementerar inbyggda funktioner i `runtime/src/builtins/`. En stor
  modul får en egen underkatalog med en översättningsenhet per familj av
  inbyggda funktioner (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`,
  `zlib/`); små moduler och bryggans infrastruktur (`registry`, `bridge`,
  `portions`, `typed`, text- och flyttalsformatering) är enskilda filer.
- Varje familjefil definierar sin egen tabell `*_builtins()` som listas i
  `production_builtins()`. En ny familj lägger till en ny fil och tabell i
  stället för att utöka en befintlig; en fil över cirka 400 rader delas upp per
  familj innan den växer vidare.
- Kompilatorn läser aldrig runtime-källkod: katalogen
  `abi::v1::bridge_builtins` är den enda lista som båda sidor delar; dess
  gruppkommentarer namnger den implementerande filen.

## Modulen erlang

Kompilatorn vet vilka `erlang`-funktioner som finns från två egna källor,
aldrig från runtime-kod:

- `library/erts/erlang.terms`: OTP 29:s `erlang`-exporter som
  `{Name, Arity, Flags, Status}` (flaggor `auto_import`, `guard`; status
  `implemented` eller `{unavailable, Reason}`: `distribution`, `tracing`,
  `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` observerar värd-OTP:n och
  behåller statusarna, som underhålls för hand.
- `tests/compiler/builtins/generate_erlang.py` gör om den till
  `library/erts/erlang.erl` (Clauses egen stubbmodul) och
  `compiler/src/semantic/erlang_auto_imports.inc` (OTP:s lista över
  autoimporter). CTest `builtins_erlang_inventory` kontrollerar att båda är
  aktuella och att `implemented` betyder en inbyggd funktion i katalogen, en
  funktion som kompilatorn hanterar (`apply/2,3`, `is_record/1,2,3`) eller en
  riktig Erlang-kropp (`nif_error/1,2` ger `error(Reason)` som OTP:s stubbar);
  `builtins_erlang_freshness` (etikett `host_otp`) jämför inventeringen med
  värd-OTP:n.

Anrop:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` och
  `-import(erlang, ...)` av en inbyggd funktion går till den inbyggda
  funktionen. Varje annan export blir del av programmet som biblioteksmodulen
  `erlang`; dess stubbar ger `error({not_implemented, F, A})` med `erlang:F/A`
  överst på stacken, endast när de anropas. Ett namn som modulen inte
  exporterar ger `undefined function erlang:F/A`.
- Ett okvalificerat anrop eller `fun F/A` av en OTP-autoimport (`get(K)`,
  `fun put/2`) som modulen varken definierar, importerar eller undertrycker med
  `-compile({no_auto_import, ...})` når `erlang:F/A` på samma sätt.

## Externt termformat

`erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Båda riktningarna delar
kodeken i [external_term.hpp](../abi/include/clause/abi/external_term.hpp) med
kompilatorn, och går igenom termer med explicita stackar, så nästlingsdjup
kostar ingen native-stack. Kodaren läser cellerna i sitt validerade argument på
plats (`TermAccess::trusted`, ingen adressuppslagning per cell); avkodaren
samlar barn på en gemensam stack och skriver tupler, listor och strängar direkt
i heapord som den gör anspråk på en gång per behållare (`TermAccess::claim`).

- `term_to_binary/1,2` skriver OTP:s byte för en icke-distribuerad nod
  (`nonode@nohost`, creation 0): UTF-8-atomer, `NEW_FLOAT`, `STRING_EXT` för
  bytelistor upp till 65535 element, maps i nyckelordning, pids, portar och
  referenser i formerna `NEW_PID`, `V4_PORT` och `NEWER_REFERENCE`, och
  `EXPORT_EXT` för `fun M:F/A`; en lokal fun eller ett native record ger
  `error:notsup`. Alternativ: `{minor_version, 0..2}` (0 skriver
  flyttalstext, 0 och 1 Latin-1-atomer), `deterministic`, `compressed` och
  `{compressed, 0..9}` ([zlib](#zlib-module)); allt annat ger `badarg`.
- `term_to_iovec/1,2` returnerar kodningen som en lista med en binary;
  `external_size/1,2` dess exakta storlek.
- `binary_to_term/1,2` kontrollerar varje längd mot indata före allokering,
  ignorerar byte efter termen, packar upp komprimerad indata och returnerar
  `badarg` för felformad indata, ogiltig atomtext, icke-ändliga flyttal,
  upprepade map-nycklar och identiteter från en annan nod; `safe` godtar endast
  befintliga atomer, `used` returnerar `{Term, BytesRead}`. CTests:
  `executables_external_terms` (OTP-byte) och `builtins_etf_fuzz` (muterade
  kodningar avkodas eller ger fel).

## Tid

`erlang/time.cpp`. Monoton tid är den stabila klockan; `native` och
`perf_counter` är nanosekunder; enheter är OTP:s atomer (inklusive de
föråldrade pluralformerna) eller ett positivt heltal för delar per sekund.
`convert_time_unit/3` avrundar nedåt, som OTP. `unique_integer/0,1` hämtar från
en enda programomfattande räknare, så varje värde är positivt, unikt och
växande oavsett alternativen (`positive`, `monotonic`; andra ger `badarg`).
`now/0` är systemtid som görs strikt växande. Kalenderkonverteringar läser
`{{Y, M, D}, {H, Mi, S}}` strikt (ett ogiltigt datum eller en ogiltig tid ger
`badarg`) och använder C-bibliotekets lokala tidszon. Timers:
[processer](processes.md#timers).

## Systeminformation

`erlang/system.cpp`.

- `statistics/1`: `wall_clock` och `runtime` (`{Total, SinceLastCall}` i
  millisekunder), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (körda tidsskivor). Clause håller
  inga räknare för reduktioner, skräpsamling eller I/O: `reductions`,
  `exact_reductions`, `garbage_collection` och `io` rapporterar nollor.
- `system_info/1`: release- och byggposterna (`otp_release` `"29"`,
  `version` `"17.1"`, den ERTS som Clause följer, `machine` `"Clause"`,
  `system_version`, `system_architecture`, `wordsize`, `endian`, ...), antal
  och gränser för processer, portar och atomer, antal schemaläggare och
  processorer samt emulatorns fasta svar (`smp_support`, `threads`,
  `time_warp_mode`, ...); hela listan finns i `system.cpp`.
- `memory/0,1`: OTP:s typer; `processes` är det runtime-omfattande kontot för
  processminne, `atom` en uppskattning utifrån antalet atomer, `binary`, `code`
  och `ets` är 0.
- Andra poster ger `badarg`.

## Hashning

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` och `phash/2` hashar en terms struktur: exakt lika termer hashas
  lika i varje programkörning (atomer efter stavning, maps i nyckelordning,
  `1` och `1.0` åtskilda). `phash2/1` ligger i 0..2^27-1, `phash2/2` i
  0..Range-1, `phash/2` i 1..Range; Range är 1..2^32, annars `badarg`. Värdena
  är Clauses egna, inte OTP:s.
- `md5/1` och `md5_init/0`, `md5_update/2`, `md5_final/1` ger sammandrag enligt
  RFC 1321 (OTP:s byte) av iodata. Kontexten är en ogenomskinlig binary på 96
  byte med Clauses egen layout; en annan binary ger `badarg`.

## Kodladdning

`erlang/code.cpp`. Varje modul är länkad in i programmet och förblir laddad;
dynamisk kod är uppskjuten. `module_loaded/1` är sant för en kompilerad modul
eller en modul med runtimens inbyggda funktioner (`erlang`, `io`, `os`, ...);
`loaded/0` och `pre_loaded/0` listar dem alla. `delete_module/1` returnerar
`undefined` för en okänd modul och ger `error:notsup` för en laddad.
`prepare_loading/2` returnerar `{error, badfile}` (ingen binary är kod som
programmet kan ladda) och `finish_loading/1` godtar endast `[]`.
`get_module_info(M[, Item])` fortsätter som `M:module_info(...)`.

## Modulen lists

`runtime/src/builtins/lists/`. OTP:s `lists` är Erlang-kod (bortsett från några
få BIF:ar), så Clauses inbyggda funktioner ger de fel som OTP:s klausuler ger:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` och
  `keydelete/3` ger `function_clause` för ett argument som ingen OTP-klausul
  godtar, och går igenom listor lika lat som OTP: `sublist([a | b], 1)` är
  `[a]`, `nthtail(1, [a | b])` är `b`, `flatten/2` kontrollerar inte sin svans
  utöver `is_list`.
- `keymember/3` och `keysearch/3` är BIF:ar i OTP: `badarg` för en position som
  inte är ett positivt litet heltal eller en oäkta svans som nås före en
  matchning.
- Nycklar och ordning jämförs med `==` och termordning; av element som jämförs
  lika vinner det första (`max([1, 1.0])` är `1`, `usort([1.0, 1])` är
  `[1.0]`, `umerge/1,2` behåller elementet från den tidigare listan).
- De körs till slut. Funktioner som tar funs (`foreach/2`, `mapfoldl/3`,
  `splitwith/2`, `filtermap/2`, `uniq/2`, ...) är Erlang i
  `library/stdlib/lists.erl`, eftersom en inbyggd funktion inte kan anropa en
  fun och få tillbaka dess resultat; det är även de andra implementerade
  funktionerna, med OTP:s klausuler och guards.
- En `function_clause` från en inbyggd funktion har ingen egen ram
  ([skillnader](differences.md)).

## Modulen math

`runtime/src/builtins/math.cpp`. Varje `math`-funktion i OTP 29 är en inbyggd
funktion ovanpå C-biblioteket (`pi/0` och `tau/0` är konstanter). Argumenten är
tal som konverteras till flyttal: allt annat ger `badarg`, ett heltal som är för
stort för ett flyttal `badarith`. Ett resultat som inte är ett ändligt flyttal
(ett domänfel som `sqrt(-1)`, `log(0)`, `acos(2)`, eller ett överflöde som
`pow(10, 400)`, `exp(1000)`) ger `badarith`. `floor/1` och `ceil/1` returnerar
flyttal. Resultaten är värdens C-biblioteks, som kan skilja sig från OTP:s i den
sista biten ([skillnader](differences.md)). På 64-bitarsmål beräknar genererad
kod `sqrt`, `floor`, `ceil` (LLVM-intrinsics) och `exp`, `log`, `log2`,
`log10`, `sin`, `cos`, `pow` (samma C-biblioteksfunktioner, anropade utan
LLVM:s substitutioner) av talargument inline till en flyttalscell; andra
operander och icke-ändliga resultat anropar den inbyggda funktionen, som ger
felet.

## Modulen binary

`runtime/src/builtins/binary/`. `replace/3,4` (inklusive en fun som ersättning
och `{insert_replaced, ...}`) och `list_to_bin/1` är Erlang i
`library/stdlib/binary.erl` ovanpå de inbyggda funktionerna; varje annan
funktion är inbyggd:

- Mönster är en icke-tom binary, en icke-tom lista av icke-tomma binaries eller
  ett kompilerat mönster. En matchning är den position som ligger längst till
  vänster och där det längsta mönstret; `matches/2,3` och `split/2,3` med
  `global` tar icke-överlappande matchningar från vänster.
  `{scope, {Start, Length}}` begränsar var matchningar får börja och sluta (en
  negativ längd räknar bakåt); `split/3` tar även `global`, `trim` och
  `trim_all`.
- `compile_pattern/1` returnerar `{bm, [Pattern]}` eller `{ac, Patterns}`,
  Clauses egen form (OTP: en referens inuti tupeln,
  [skillnader](differences.md)).
- `part/2,3`, `bin_to_list/1,2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` och
  `decode_hex/1` följer OTP; varje felaktigt argument (en bitstring, ett
  intervall utanför subjektet, ett okänt alternativ) ger `badarg`.
- `referenced_byte_size/1` är binaryns egen storlek.
- De körs till slut.

## Modulen maps

`runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` och `from_keys/2` är inbyggda
  funktioner med OTP:s fel: något som inte är en map ger `{badmap, Map}`, en
  saknad nyckel i `update/3` `{badkey, Key}`, en nyckellista som inte är en äkta
  lista `badarg`. Nycklar matchas exakt (`1` och `1.0` är olika nycklar). De
  andra implementerade funktionerna (`filter/2`, `map/2`, `fold/3`,
  `iterator/1,2`, `next/1`, ...) är Erlang i `library/stdlib/maps.erl`;
  iteratorer använder [`erts_internal:map_next/3`](#erts-internal).
- Map-markörer (`runtime/src/terms/map_cursor.hpp`) går igenom en platt
  map-cell och ett map-träd på samma sätt, som ord i nyckelordning, utan någon
  `Term` per post. Den privata inbyggda funktionen `clause_maps:entries/1`
  returnerar `{K1, V1, K2, V2, ...}` från en sådan, så `maps:fold/3` läser
  associationerna på plats med `element/2` i stället för att bygga en lista av
  par; `map_next/3` stegar också med en.
- `os:type/0`, `os:getenv/0,1` (`getenv/0`: strängar `"Name=Value"`; Windows
  poster `=C:` per enhet utelämnas), `os:env/0` (par `{Name, Value}`),
  `os:putenv/2`, `os:unsetenv/1` (`badarg` om inte argumenten är strängar och
  namnet är icke-tomt utan `=`), `os:getpid/0` och `os:version/0` är inbyggda
  funktioner; `os:timestamp/0`, `os:system_time/0,1`, `os:perf_counter/0,1` och
  `os:getenv/2` är Erlang ovanpå `erlang`-funktionerna för tid och `getenv/1`;
  `os:cmd/1` körs via en port ([underprocesser](ports.md#subprocesses)).

## Persistenta termer

`runtime/src/builtins/persistent_term.cpp`, ovanpå runtimens tabell
([runtime](runtime.md#persistent-terms)). `put/2` och `put_new/2` returnerar
`ok` (`put_new/2` för en lagrad nyckel är `ok` för ett exakt lika värde, annars
`badarg`); `get/1` för en nyckel som inte är lagrad ger `badarg`, `get/2`
returnerar standardvärdet; `get/0` listar varje `{Key, Value}`; `erase/1` anger
om nyckeln var lagrad; `info/0` är `#{count => N, memory => Bytes}` (orden i de
lagrade kopiorna). Nycklar matchas exakt (`1` och `1.0` skiljer sig). Varje
läsning kopierar värdet till anroparens heap.

## Modulen unicode

`runtime/src/builtins/unicode/`. `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` och
`encoding_to_bom/1` är inbyggda funktioner; normaliserings-, kategori- och
identifierarfunktionerna i `library/stdlib/unicode.erl` är stubbar.

- Kodningar: `latin1`, `unicode`/`utf8`, `utf16` och `utf32`, big endian som
  standard eller `{utf16 | utf32, big | little}`; allt annat ger `badarg`
  (`encoding_to_bom/1`: `function_clause`, som OTP).
- Chardata är en binary eller en lista, möjligen oäkta med en binary-svans, av
  kodpunkter, binaries i indatakodningen och nästlade chardata; på varandra
  följande binaries avkodas som en ström, så ett tecken kan sträcka sig över
  två. Allt annat ger `badarg`.
- Ett tecken som utdata inte kan ta emot (en ogiltig kodpunkt eller
  bytesekvens, en kod över 255 för `latin1`-utdata) avslutar konverteringen med
  `{error, Converted, Rest}`; indata som slutar inuti ett tecken med
  `{incomplete, Converted, Rest}`. `Rest` har OTP:s form: den okonverterade
  delen av den innersta listan med det felande elementet först (en binary som
  dess okonverterade suffix, ensam när den avslutar toppnivån), inuti den
  återstående svansen av varje omslutande lista; ofullständiga byte som förts
  vidare från en binary kommer först, och med `latin1`-utdata omsluts ett
  felande heltal av en lista.
- `bin_is_7bit/1` är falskt för allt utom en binary med byte under 128.

## Modulen code

`runtime/src/builtins/code.cpp`. Det finns ingen `code_server`-process;
frågorna om laddade moduler besvaras för det länkade programmet: en modul är
laddad när programmet har den (kompilerad kod eller runtimens inbyggda
funktioner). `ensure_loaded/1` ger `{module, M}` eller `{error, nofile}`,
`ensure_modules_loaded/1` `ok` eller `{error, [{M, nofile}]}`, `is_loaded/1`
`{file, preloaded}` eller `false`, `which/1` `preloaded` eller `non_existing`,
`module_status/1` `loaded` eller `not_loaded`, `all_loaded/0` och
`module_status/0` listar varje modul, `is_sticky/1` är `false`. Ett
modulargument som inte är en atom ger `function_clause`. OTP:s felväg i
`io_lib:format/2`, som anropar `code:ensure_modules_loaded/1`, ger därför det
ursprungliga `badarg`. Kodsökvägar och laddning är stubbar.

## Modulen init

`runtime/src/builtins/init.cpp`, `library/erts/init.erl`. En körbar fil är ett
startat system utan bootskript. Vid start avkodas kommandoraden en gång
(`ProgramArguments`, `runtime/src/startup/arguments.cpp`): argumenten efter
runtime-alternativen är både argv för startpunkten med aritet 1 och
`get_plain_arguments/0`. Det finns inga emulatorflaggor; den enda flaggan är
`home`, som sätts vid start så som OTP:s `erlexec` sätter den (`HOME`; på
Windows `HOMEDRIVE` och `HOMEPATH`, annars `USERPROFILE`), så
`get_argument(home)` är `{ok, [[Home]]}`, `get_arguments/0` är
`[{home, [Home]}]` och varje annan flagga är `error`. `script_name/0` är den
körbara filens absoluta sökväg med snedstreck framåt. Dessa fyra är inbyggda
funktioner; resten är Erlang:

- svar från OTP:s startade `init`: `get_status/0` `{started, started}`,
  `notify_when_started/1` `started`, `ensure_loaded/1` `not_allowed`,
  `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (väntar på
  `{init, started}`); `get_configfd/1` och `set_configfd/2` håller sina värden i
  `persistent_term` under `{init, configfd, Id}`;
- `script_id/0` är `{"Clause", "29"}`;
- `stop/0,1` och `reboot/0` stoppar direkt med OTP:s statusregler: ett
  icke-negativt heltal är slutstatusen, en bytelista stoppslogan, alla andra
  argument `badarg`;
- avvisade: `boot/1` och `restart/0,1` ger `notsup` efter OTP:s
  argumentkontroller (`restart/1` av en lista som inte är `[]` eller
  `[{mode, M}]` ger `badarg`), `make_permanent/2` returnerar `{error, notsup}`
  för giltiga namn och `{error, badarg}` annars.

## Atomics och counters

`runtime/src/builtins/atomics.cpp`. En `atomics`-array är en
[handtagsreferens](runtime-heap.md#handle-references) vars buffert innehåller
ett ord för teckenhantering och 64-bitarsvärdena, som uppdateras via
`std::atomic_ref` med sekventiellt konsistenta operationer; den delas av varje
kopia av referensen (meddelanden, persistenta termer, `binary_to_term/1` medan
den lever) och frigörs med den sista.

- `new/2` tar en aritet från 1 till 2^27 och alternativ `[{signed, Bool}]` (det
  sista vinner); `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`, `sub_get/3`,
  `exchange/3`, `compare_exchange/4` och `info/1` är inbyggda funktioner med
  OTP:s `badarg` för en felaktig referens, ett felaktigt index eller värde.
  Lagrade värden måste passa i arrayen (int64 eller uint64); ökningar kan vara
  vilket heltal som helst från -2^63 till 2^64 - 1 och slår runt. `info/1`
  rapporterar OTP:s `memory` på 40 + 8 byte per värde.
- `counters` är Erlang (`library/erts/counters.erl`): `{atomics, Ref}` och
  `{write_concurrency, Ref}` omsluter båda en atomics-array med tecken, så
  write-concurrency-räknare är exakta vid varje läsning. `info/1` för de
  senare rapporterar arrayens storlek och minne.

## Erts internal

`runtime/src/builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`. De
funktioner som OTP:s `stdlib` och `kernel` anropar:

- inbyggda funktioner `cmp_term/2` (exakt termordning: ett heltal före ett lika
  flyttal) och `map_next/3`, protokollet för `maps:iterator/1,2` och
  `maps:next/1`: en heltalssökväg går igenom map:en i nyckelordning och
  fortsätter över de återstående nycklarna, en sökväg i form av en
  nyckellista tar sina nycklar i ordning; en listackumulator tar emot varje
  association från sökvägen och framåt;
- Erlang `list_to_integer/2` och `binary_to_integer/2` (hjälpfunktionerna till
  `string:to_integer/1` och konverterings-BIF:arna, `big` bortom ett litet
  heltal i ordstorleken), `map_to_tuple_keys/1` (de sorterade nycklarna i
  vilken map som helst), `term_type/1`, write-concurrency-funktionerna
  `counters_*`, `dynamic_node_name/0,1` ovanpå `persistent_term`;
- avvisade: `get_creation/0` är `undefined` (ingen distribution) och
  `map_hashmap_children/1` ger `badarg` (ingen map har hashmap-noder);
- avböjda: grupperna för distribution, `.beam` och emulatorns interna delar.

`erts_code_purger:purge/1` svarar `{false, false}` och `soft_purge/1` `true`,
eftersom länkad kod inte har någon gammal kod; rensningsprocessen och
`finish_after_on_load/2` är avböjda.

## Unicode util

`library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`. OTP
genererar `unicode_util` när det byggs (900 KB Erlang); Clause håller data i
genererade C++-tabeller (`unicode/tables.cpp`) som efterfrågas av de inbyggda
funktionerna i den privata modulen `clause_unicode`, och `unicode_util.erl`
besvarar varje OTP-funktion ovanpå dem med OTP:s resultatformer
(`{error, Rest}` eller `{badarg, Rest}` vid ogiltig UTF-8). `gc/1` delar upp
utökade grafemkluster enligt UAX #29 i OTP:s regelordning; `nfd/1`, `nfc/1`,
`nfkd/1`, `nfkc/1` normaliserar det första klustret; `spec_version/0` är
`{17, 0}`.

`tools/unicode/generate.py` skriver tabellerna en gång per Unicode-uppdatering:
skiftlägesmappningar, kategorier, dekompositioner och egenskapspredikaten från
värd-OTP:ns svar för varje kodpunkt (`tools/unicode/observe.escript`),
grafemgränser, emoji-, indiska och kompositionsdata från de filer i Unicode
Character Database som OTP 29 låser (Unicode 17.0). Endast de genererade
tabellerna checkas in, med den notis som Unicode License v3 kräver; byggen
behöver varken OTP eller datafilerna. `executables_unicode_tables` och
`executables_unicode_clusters` jämför svar, kluster och normalformer med OTP:s.

## Modulen zlib

`runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. Runtime
länkar zlib 1.3.2, den version som OTP 29 levererar med ([zlib](compile.md#zlib)),
så komprimerade byte är lika med OTP:s för varje nivå, strategi, fönsterstorlek
och flush. En ström är en
[handtagsreferens](runtime-heap.md#handle-references) vars buffert innehåller
`z_stream`; dess finalizer avslutar en aktiv session när den sista kopian dör.
De privata inbyggda funktionerna i `clause_zlib` (anrop för open, close,
controller, init, deflate, inflate, end, reset, parametrar och ordlistor) kör
en operation över all sin indata; `zlib.erl` behåller OTP:s API,
argumentfel (`bad_compression_level`, `bad_windowbits`, ...),
strömtillstånd (`not_initialized`, `already_initialized`,
`not_on_controlling_process`), `eos_behavior`, ordlistor
(`{need_dictionary, Adler}`) och helbuffertfunktionerna `compress/1`, `zip/1`,
`gzip/1` och deras inverser (sammanfogade gzip-medlemmar). Ett gzip-huvud
namnger plattformen, så som OTP:s zlib skriver det. `term_to_binary/2` med
`compressed` eller `{compressed, Level}` komprimerar som OTP avgör (till fem
byte färre än nyttolasten, annars okomprimerat).

## Modulen re

`runtime/src/builtins/re/`, `library/stdlib/re.erl`: OTP 29:s exporter och
typer ovanpå den PCRE2-version som OTP levererar med ([PCRE2](compile.md#pcre2)).
`version/0` är PCRE2:s version och datum som en binary
(`<<"10.47 2025-10-21">>`, som i OTP).

Ett kompilerat mönster är OTP 29:s `{re_pattern, CaptureCount, Unicode, UseCRLF,
Ref}`, där `Ref` är en [handtagsreferens](runtime-heap.md#handle-references) som
äger `pcre2_code`; dess finalizer frigör koden med den sista kopian, och
processer delar den skrivskyddat. Som i OTP är C-sidan liten och resten är
Erlang:

- `clause_re:compile/2` kompilerar ett regex-binary med kompileringsalternativ
  (`{ok, Pattern}` eller `{error, {Message, Offset}}` med PCRE2:s meddelande);
  `re:inspect/2` besvarar `namelist`.
- `clause_re:run/4` är OTP:s BIF `re:run` utan dess traps: en matchning av ett
  binary-subjekt från `{offset, N}`, där ett textuellt regex först kompileras,
  med varje capture-specifikation och typ, `match_limit` och
  `match_limit_recursion`, och OTP:s fel (`report_errors`-resultat, `badarg`
  för kompileringsalternativ eller andra radbrytningskonventioner som ges med
  ett kompilerat mönster).
- `re.erl` konverterar Unicode-chardata till UTF-8 och captures tillbaka till
  tecken, kör `global`-matchningar en i taget (efter en tom matchning försöker
  den igen förankrat och icke-tomt, och stegar sedan ett tecken, eller ett par
  CR LF med CRLF-radbrytningar, som OTP:s `loopexec` gör), och implementerar
  `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`, en ersättnings-fun) och
  `split/2,3` (`{parts, N}`, `trim`, `group`, `{return, Type}`) med OTP:s
  resultat.

Exporterade mönster (`export`, `import/1`) tillhandahålls inte.
`executables_re_module` jämför kompilering, matchning, captures, globala och
Unicode-matchningar, replace, split och argumentfel med OTP.

## Prim eval

`runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun, Timeout)` är receive i `erl_eval`, vars klausuler är
en fun: den går igenom brevlådan från det äldsta meddelandet med stegen i ett
kompilerat [receive](processes.md#receive), de privata inbyggda funktionerna i
`clause_receive` `peek/0` (`{message, M}` eller `none`), `skip/0`, `take/0`,
`restart/0` och `wait/1` (väntefunktionen för kompilerad kod, med dess
tidsgräns och `timeout_value`). Det första meddelandet för vilket `Fun` svarar
något annat än `nomatch` tas bort och det svaret returneras; `timeout` när
`Timeout` löper ut. Ett undantag från `Fun` lämnar varje meddelande på plats.
`executables_prim_eval_receive` jämför brevlådans ordning, tidsgränser, ett
meddelande som anländer under väntan och undantag med OTP.
