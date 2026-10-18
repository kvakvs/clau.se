---
source: docs/builtins.md
sourceCommit: 336caea7
sourceSha256: c5d99568a38fc1f7bc865c63163039a8c2acba8d978636c0b9290afdf0b9a637
translatedAt: 2026-10-18
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
  [`ordsets`, `orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`,
  `queue` och `array`](#collections), [`base64` och `json`](#encodings),
  [`calendar`](#calendar), [`filename`](#filename),
  [`uri_string`](#uri-string), [`string`](#string),
  [`rand` och `random`](#random-numbers),
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
| `erlang:function_exported(M, F, A)`, `A -- B` i en kropp (inbyggda funktioner i katalogen utan inline-tjänst) | Går in som en funktion: `CLAUSE_builtin_frame_v1(context, index)` ger den inbyggda funktionens ram, argumenten läggs i registren ([portioner](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (direkta inbyggda funktioner: trappar, väntar eller agerar aldrig på en annan process) | Anropas direkt: `CLAUSE_builtin_call_v1(context, index, arguments)` returnerar resultatet ([ABI](abi.md#runtime-services)) |
| `length(L)`, `binary_to_list(B)`, `list_to_binary(L)`, `iolist_to_binary(L)` (snabba inbyggda funktioner) | `CLAUSE_builtin_call_v1` kör en begränsad snabb väg på argumentorden (högst 256 celler, element eller byte, 4096 resultatbyte); den returnerar 0 för längre indata, andra former och fel, och anropet går då in i den inbyggda funktionens ram |
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
  en avvikelse ger `badarg` och funktionen körs inte. `Named<Role>` är en godtycklig term
  under en egen rolltyp (`collections::Key`, `Value`, `List`, ...), så att
  två termparametrar i en inbyggd funktion inte kan förväxlas; den inbyggda
  funktionen kontrollerar termen.
- En funktion returnerar en term, ett `BuiltinResult` (`std::expected` med ett
  `BuiltinFailure`) eller ett rått `Word` som den själv publicerat, eller kastar
  `BuiltinFailure` (ett Erlang-fel eller ett fel vid termåtkomst);
  `call_builtin` gör om alla andra C++-undantag till `out_of_memory` eller
  `internal_error`, så att inget korsar ABI:t för genererad kod.
- De flesta familjer är typade. Guard-BIF:arna och operatorerna
  (`erlang/core.cpp`), de trappande listfunktionerna och några andra är
  `BuiltinBody`-adaptrar på ordnivå, som skickar sina argumentord till de
  inline-tjänster som genererad kod också anropar. Vanliga konverteringar läser argumentens celler på plats
  (`TermAccess::trusted`) i stället för att pröva tillträde för `Term`:
  `tuple_to_list/1`, `phash2/1` (listor, tupler och små heltal) samt
  `list_to_atom/1`, `list_to_integer/1` för korta ASCII-strängar och
  `binary:part/2,3`, en direkt inbyggd funktion vars korta resultat skrivs
  direkt i heapord (inbyggda funktionsargument på ordnivå).

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
  funktionen, aldrig en biblioteksmoduls
  `clause_builtin_placeholder`-kropp
  ([platshållare](library.md#provided-or-missing)) eller en användarfunktion
  med samma namn.
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
  `library/erts/erlang.erl` (Clauses egen stubbmodul, med en
  platshållarkropp för varje inbyggd katalogfunktion) och
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

- `phash2/1,2` är OTP:s `make_hash2` och `phash/2` dess `make_hash`, som går
  igenom list- och tupelceller på plats: atomer (med OTP:s hash av deras
  stavning), heltal, flyttal, binaries och bitstrings, listor, tupler och
  maps (ordningsoberoende) hashas till OTP:s värden, så att `dict` och
  `sets` av version 1 lägger ut sina hinkar som OTP gör. Pids, portar och
  referenser hashas efter Clauses nummer, funs efter modul, aritet eller index
  och fångade värden, native records efter fältvärden
  ([skillnader](differences.md)). `phash2/1` ligger i 0..2^27-1, `phash2/2` i
  0..Range-1, `phash/2` i 1..Range; Range är 1..2^32, annars `badarg`.
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
  `join/2`, `flatten/1,2`, `flatlength/1`, `delete/2`, `concat/1`, `max/1`,
  `min/1`, `usort/1`, `umerge/1,2`, `merge/1,2`, `merge3/3`, `umerge3/3`,
  `keymerge/3`, `ukeymerge/3`, `ukeysort/2`, `keydelete/3`, `keyreplace/4`,
  `keystore/4`, `keytake/3`, `zip/2,3`, `zip3/3,4`, `unzip/1`, `unzip3/1` och
  `enumerate/1,2,3` ger `function_clause` för ett argument som ingen OTP-klausul
  godtar, och går igenom listor lika lat som OTP: `sublist([a | b], 1)` är
  `[a]`, `nthtail(1, [a | b])` är `b`, `flatten/2` kontrollerar inte sin svans
  utöver `is_list`, en sammanslagning returnerar den andra listan som den är
  när en är `[]` och ger `badarg` för en oäkta rest som den lägger till, och
  en nyckelsammanslagning ger `badarg` för ett element som inte är en tupel
  med nyckelns storlek, som `element/2`.
- `zipwith/3,4` och `zipwith3/4,5` är Erlang ovanpå de inbyggda
  `zip`-funktionerna, som parar ihop elementen först; `flatmap/2`, `keymap/3`,
  `search/2`, `umerge/3` och `usort/2` är också Erlang. Inuti `lists.erl`
  anropas en inbyggd funktion kvalificerat (`lists:zip(...)`): ett lokalt
  anrop skulle nå dess platshållare. De odokumenterade `rmerge/2,3`,
  `rmerge3/3`, `rumerge/2,3`, `rumerge3/3`, `rkeymerge/3` och
  `rukeymerge/3` (OTP:s sorteringshjälpfunktioner) förblir stubbar.
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

- Varje dokumenterad `maps`-funktion fungerar. `maps:get/3`, `is_key/2`,
  `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`,
  `without/2`, `from_keys/2`, `intersect/2` och `is_iterator_valid/1` är
  inbyggda funktioner med OTP:s fel: något som inte är en map ger
  `{badmap, Map}`, en saknad nyckel i `update/3` `{badkey, Key}`, en
  nyckellista som inte är en äkta lista `badarg`. Nycklar matchas exakt
  (`1` och `1.0` är olika nycklar).
- Funktionerna som tar funs är Erlang i `library/stdlib/maps.erl`:
  `filter/2`, `filtermap/2`, `map/2`, `fold/3` och `foreach/2` tar en map
  eller en iterator (allt annat är `{badmap, MapOrIter}`),
  `intersect_with/3` kombinerar ovanpå `intersect/2` och `merge_with/3`
  ovanpå `merge/2`. `groups_from_list/2,3` anropar funs med sista elementet
  först, som OTP gör, och den privata inbyggda funktionen
  `clause_maps:groups/1` grupperar paren `{Key, Value}`.
  Iteratorer (`iterator/1,2`, `next/1`) använder
  [`erts_internal:map_next/3`](#erts-internal).
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

## Samlingar

`runtime/src/builtins/collections/`: `ordsets`, `orddict`, `proplists`,
`dict`, `sets`, `gb_trees`, `gb_sets`, `queue` och `array`, varje
dokumenterad funktion.

- Listgenomgångarna är inbyggda funktioner: medlemskap, insättning,
  borttagning och mängdalgebra för `ordsets` (`union/2`, `intersection/1,2`,
  `subtract/2`, `is_subset/2`, `is_disjoint/2`, `is_set/1`); uppslag och
  uppdateringar utan funs för `orddict` (`store/3`, `append/3`,
  `append_list/3`, `update_counter/3`, `take/2`, `from_list/1`, ...); alla
  `proplists`-funktioner utom `property/1,2`, `get_value/2`, `normalize/2`,
  `to_map/2` och `from_map/1`, som är Erlang-limkod i `library/stdlib/`.
- Funktionerna som tar funs (`ordsets:fold/3`, `filter/2`, `map/2`,
  `filtermap/2`, `orddict:update/3,4`, `fold/3`, `map/2`, `filter/2`,
  `merge/3`) är Erlang.
- Varje inbyggd funktion går igenom sina listor som OTP:s klausuler, så att
  resultat och fel stämmer för alla indata: element och nycklar jämförs med
  `<` och `==` (av `1` och `1.0` behålls den representant OTP behåller,
  även efter att `union/2` byter plats på sina mängder), en rest som OTP
  returnerar okontrollerad (`ordsets:union([], X)` är `X`) returneras som den
  är, en form som ingen klausul godtar ger `function_clause`, en
  comprehensions indata som inte är en lista ger `{bad_generator, Rest}`,
  `Old ++ New` med oäkta `Old` ger `badarg` och `update_counter/3` med
  något som inte är ett tal ger `badarith`. `proplists`-nycklar matchas med
  `=:=`.
- `proplists:get_keys/1` listar nycklarna i ordningen för en maps nycklar,
  som OTP:s nyckelmängd gör ([skillnader](differences.md)).
- `dict` och `sets`: en dict och en mängd av version 1 är OTP:s records över
  en linjär hashtabell (`collections/linear_hash.cpp`), segment om 16
  hinklistor med platser från `erlang:phash/2`, utökade och krympta exakt
  som i OTP, så att records, `to_list/1` och fold-ordningar är lika OTP:s.
  En mängd av version 2 (standard) är en map med `[]`-värden; två maps
  snittas och subtraheras med OTP:s värden (en maps egna värden när
  tillräckligt många nycklar behålls, annars `[]`). En dicts uppslag och
  uppdateringar, `sets`-operationer utan funs, `new/0` och `from_list/1` är
  inbyggda funktioner; `update`, `fold`, `map`, `filter`, `merge` och
  `sets:new/1`, `from_list/2`, `fold`, `filter`, `map`, `filtermap` är
  Erlang, de hashade ovanpå de privata inbyggda funktionerna
  `clause_hashed:entries/1` (lagringsordning), `with_values/2` och `keep/2`.
  En term som inte är en dict ger `{badrecord, Term}` (`size/1`,
  `is_empty/1` ger `function_clause`), en som inte är en mängd
  `function_clause`.
- `gb_trees` och `gb_sets` delar en balanserad trädmotor
  (`collections/balanced_tree.cpp`): insättning kontrollerar Anderssons
  viktregel på vägen tillbaka upp och bygger om ett delträd från dess
  sorterade poster som OTP gör, borttagning lyfter den större sidans minsta
  nod, och union, snitt och differens för `gb_sets` slår samman de sorterade
  listorna eller sätter in och slår upp enligt OTP:s storleksregel
  (`N2 < 10` eller `N2 < N1 * round(1.46 ln N2)`), med sammanslagna träd
  som är högertunga som OTP:s `balance_revlist`, så att varje träd är lika
  OTP:s. `map`, `fold`, `filter`, `filtermap` och konstanterna är Erlang.
- `queue`: OTP:s `{Rear, Front}`; varje operation flyttar objekt mellan
  listorna som OTP gör (en sida med ett objekt flyttas, en ensam lista delas
  på mitten), så att köerna är lika OTP:s. En term som inte är ett par listor
  ger `badarg`, en tom kös `get`, `drop`, `head` ger felet `empty`.
  Funktionerna som tar funs och Okasaki-namnen är Erlang.
- `array`: OTP 29:s `#array{}`-record, ett tupelträd med löv om 16 poster
  (`[]` för ett tomt delträd) med ett cachat löv och nollförskjutning;
  `set`, `append`, `shift`, `prepend`, `slice`, `reset`, `resize` och
  byggarna (`from_list`, `from_orddict` med dess luckmarkörer, `from`)
  ändrar recorden exakt som OTP gör. Fold- och mapfold-funktionerna är Erlang
  ovanpå de privata inbyggda funktionerna `clause_array:values/3`,
  `sparse/3` och `replace/4`, där den sista bygger om ett mappat intervall
  som OTP:s mapfold-funktioner (tomma delträd vecklas ut om inte mappningen
  är gles) och läser cachen igen.

## Kodningar

`runtime/src/builtins/encoding/`.

- `base64`: varje dokumenterad funktion är inbyggd. Kodning tar en binary
  eller en lista av heltal (OTP:s aritmetik på dem: `badarith` för något
  som inte är ett heltal, `badarg` bortom alfabetstabellen); avkodning går
  igenom indata som OTP:s tillståndsmaskiner, så att felen stämmer för alla
  indata: blanktecken hoppas över, indata som slutar efter ett tecken i en
  grupp ger `function_clause`, efter två eller tre `missing_padding` om
  inte `padding => false`, ett tecken utanför alfabetet ger `badarg` när
  dess grupp byggs (`badarith` inuti OTP:s skift), allt utom blanktecken efter
  utfyllnaden ger `{case_clause, Symbol}`. `mime_decode` hoppar över varje
  tecken utanför alfabetet och data efter ett felplacerat `=`.
- `json` (`encoding/json.cpp`): `decode/1` är en inbyggd funktion som går
  igenom OTP:s avkodartillstånd med en explicit stack av öppna behållare, så
  att värden (ett objekt behåller en nyckels första värde), resten efter
  värdet och felen stämmer: `unexpected_end` där mer indata skulle kunna
  fullborda texten, `{invalid_byte, Byte}` vid den byte OTP avvisar (för en
  avklippt literal byten efter dess första), `{unexpected_sequence, Bytes}`
  för en felaktig `\u`-escape eller ett flyttal som `binary_to_float/1`
  avvisar. `encode_binary/1` och `encode_binary_escape_all/1` är inbyggda
  funktioner som bygger OTP:s nästlade iodata, liksom standardvägarna
  `encode/1` och `format/1,2` (`encoding/json_encode.cpp`, via
  `clause_json:encode/1` och `format/2`); bortom 256 nästlingsnivåer, eller
  för andra formatalternativ än små icke-negativa heltal, svarar de
  `fallback` och `json.erl` bygger samma iodata själv. Kodarna och
  formaterarna som tar funs och avkodarna med återanrop `decode/3`,
  `decode_start/3`, `decode_continue/2` är Erlang; avkodarna går igenom
  OTP:s tillstånd ovanpå de privata skannrarna `clause_json:string/2` och
  `number/2`, så återanrop körs i OTP:s ordning och fortsättningstillstånden
  är OTP:s tupler.

## Filnamn

`runtime/src/builtins/filename/`.

- `flatten/1`, `join/1,2`, `absname_join/2`, `append/2`, `basename/1,2`,
  `dirname/1`, `extension/1`, `rootname/1,2`, `split/1`, `pathtype/1`,
  `nativename/1` och `validate/1` är inbyggda funktioner som följer OTP:s
  klausuler för värdens familj: Unix `/`, eller Windows `/` och `\`,
  enhetsbokstäver (versaler görs till gemener av `join` och `split`) och
  `//`-nätverksnamn. Listor gås igenom som OTP:s klausuler öppnar dem
  (nästlade listor och atomer där en klausul öppnar dem, `List ++ Rest` ger
  `badarg` för en oäkta lista), så resultaten behåller OTP:s former:
  namnets element, binaries behållna som element av `flatten/1`, dellistor
  och sub-binaries samt OTP:s `function_clause` där en klausul möter något
  som inte är ett tecken.
- `absname/1,2` (den aktuella katalogen och en enhets egen) och
  `basedir/2,3` (miljön) är Erlang ovanpå dem.

## Strängar

`runtime/src/builtins/string/`: varje funktion i `string`.

- Genomgångarna följer `string.erl` klausul för klausul ovanpå
  `unicode_util:cp/1` och `gc/1`, som `unicode/code_points.cpp` portar till
  termer i OTP:s former: nästlade listor öppnade så långt OTP öppnar dem
  (upp till tre ytterligare kodpunkter plattas ut efter den första), binaries
  behållna som delar som delar buffert, `{error, Rest}` vid ogiltig UTF-8.
  Därför returnerar `trim`, `take`, `lexemes`, `split`, `find`, `slice`
  och `prefix` indatasvansar, sub-binaries och de blandade listor OTP bygger
  (`[Keep | Cont]`, `[Token, Bin]`, nästlingen från `stack/2`) och kastar
  OTP:s fel (`{badarg, Rest}`, `function_clause`, `case_clause` och
  `badmatch` där dess klausuler möter ett oväntat svar, `badarg` från
  `binary:compile_pattern([])` när `nth_lexeme/3` kompilerar en tom
  separatormängd).
- Genomgångarna bakifrån (`trim/3`, `take/4` med `trailing`), som är
  kroppsrekursiva i OTP, körs som loopar som registrerar en ram per steg och
  viker ihop ramarna på slutet, så långa strängar inte kan överflöda
  C++-stacken.
- `uppercase/1`, `lowercase/1`, `casefold/1` returnerar själva indata när
  inget tecken ändras, som OTP gör; `titlecase/1` mappar första kodpunkten.
  `equal/4` normaliserar via `unicode/normalize.cpp`, portningen av
  `unicode_util`:s `nfc/nfd/nfkc/nfkd` (dekompositionstabeller, kanonisk
  ordning, parvis komposition, Hangul jamo), och kontrollerar identiska rester
  igen i varje steg som OTP:s `equal_nocase(A, A)`-klausul.
- `to_integer/1` och `to_float/1` tar talets tecken med `take/2` och tolkar
  dem som `string:list_to_integer/1` (erts `{Int, Rest}` med `no_integer`,
  `not_a_list`, `system_limit`) och `list_to_float/1` (Erlangs
  flyttalssyntax, komma tillåts som punkt, exponent endast med siffror);
  varje internt fel ger `{error, badarg}`.
- Latin-1-API:t (`len`, `chr`, `tokens`, `strip`, `left`, `centre`, ...)
  är portat med sina fel: `function_clause` där en klausul går till `[]`,
  `badarg` från `erlang:length/1`, `++` och `lists:reverse/2`.
- `jaro_similarity/2` matchar grafemkluster inom OTP:s avstånd och räknar
  transpositioner i OTP:s ordning.

## URI-strängar

`runtime/src/builtins/uri/`.

- `parse/1` är en enda genomgång av grammatiken i RFC 3986 styrd av en
  avgränsartabell, som behåller OTP:s ordning så att svaren anger var OTP:s
  parser stannade: först en URI med schema (ett misslyckande efter schemats
  kolon är slutgiltigt), annars en relativ referens; `userinfo@host` när
  genomgången av userinfo lyckas, annars auktoriteten som värd; en värd av
  siffror som inte är en strikt IPv4-adress gås igenom igen som ett
  registrerat namn; `{error,
  invalid_uri, Fragment}` med OTP:s fragment. Värdar kontrolleras med
  `inet`:s strikta IPv4- och IPv6-former.
- `recompose/1`, `normalize/1,2` och `resolve/2,3` arbetar på map:ens
  komponenter som `uri_string.erl`: varje komponents list- eller
  binary-form avgör resultatets, OTP:s `{error, ...}`-svar returneras,
  kastas som undantag eller med throw där OTP gör det, och `resolve`
  slår samman en relativ sökväg efter bassökvägens sista snedstreck (en
  grafemgenomgång, som OTP:s `string:split/3`).
- `percent_decode/1`, `quote/1,2`, `unquote/1`, `transcode/2`,
  `compose_query/1,2`, `dissect_query/1` och teckenklasserna följer OTP:s
  bytegenomgångar, inklusive att en binarys fel kastas och en listas
  returneras, numeriska HTML-referenser och `+` i formulärfrågor.
- `unicode/graphemes.cpp` delar upp kodpunkter i grafemkluster enligt
  reglerna för `unicode_util:gc/1` för inbyggda funktioner som behöver
  klustergränser.

## Slumptal

`runtime/src/builtins/rand/`.

- `rand`: tillstånden är OTP:s `{AlgHandler, AlgState}` med OTP:s
  hanterar-maps (deras funs är `rand`:s egna) och OTP:s tillståndslayouter,
  så exporterade frön, sekvenser och hoppade tillstånd är lika OTP:s för
  varje algoritm (`exsss`, `exro928ss`, `exrop`, `exs1024s`, `exsp` och
  de föråldrade `exs64`, `exsplus`, `exs1024` samt `dummy`). För en
  hanterare lika OTP:s egen gör de privata inbyggda funktionerna
  `clause_rand:seed/2`, `next/2`, `uniform/2,3`, `uniform_real/2`,
  `bytes/3`, `normal/2`, `shuffle/3` och `jump/2` arbetet i C++:
  frösättning (SplitMix64, listor, OTP:s 3-tupelhashar och fröfel),
  intervall bortom generatorns bitar, täta flyttal, byte, normalzigguraten
  och blandningens bitström. Varje annan hanterare är ett instick:
  `rand.erl` kör OTP:s generiska algoritmer ovanpå dess funs.
- `splitmix64_next/1`, `exsp_next/1`, `exsp_jump/1` och `mwc59`-funktionerna
  är inbyggda; `mwc59_seed/0` hashar `rand`:s standardfrö.
- `tools/rand/observe.escript` observerar OTP:s konstanter genom `rand`:s
  insticks-API: zigguratens remsbredder (produkter för den snabba vägen)
  och gränser (där en remsas ord når den långsamma vägen), samt hoppade
  tillstånd, från vilka `tools/rand/generate.py` löser varje hopppolynom
  över GF(2) (kontrollerat på ett andra tillstånd) och skriver
  `tables.cpp`; remshöjder beräknas med hög precision
  ([skillnader](differences.md#random-numbers)).
- `random` (föråldrad): `uniform_s/1` är en inbyggd funktion för
  Wichmann-Hill-generatorn; funktionerna för frösättning och processlexikon
  är Erlang.

## Kalender

`runtime/src/builtins/calendar.cpp`.

- Den gregorianska aritmetiken är inbyggda funktioner över heltal av valfri
  storlek med Erlangs trunkerande `div` och `rem`, enligt OTP:s eraformler:
  `date_to_gregorian_days/1,3`, `gregorian_days_to_date/1`,
  `datetime_to_gregorian_seconds/1`, `gregorian_seconds_to_datetime/1`,
  `day_of_the_week/1,3`, `is_leap_year/1`, `last_day_of_the_month/2`,
  `valid_date/1,3`, `seconds_to_time/1`, `seconds_to_daystime/1`,
  `time_to_seconds/1`, `time_difference/2`, `iso_week_number/1`. En form
  som OTP:s klausuler avvisar ger `function_clause`, ett icke-heltal den
  räknar med `badarith`; datum utanför intervallet beräknas som OTP
  beräknar dem.
- Lokal och universell tid, systemtid samt tolkning och formatering av
  RFC 3339 är Erlang i `library/stdlib/calendar.erl` ovanpå de inbyggda
  tidsfunktionerna i `erlang` och `proplists`, med OTP:s fel
  (`{badarg, [Arg, Options]}` utanför intervallet, `{badmatch, _}` och
  `{case_clause, _}` för en felaktigt formad förskjutning).

## Persistenta termer

`runtime/src/builtins/persistent_term.cpp`, ovanpå runtimens tabell
([runtime](runtime.md#persistent-terms)). `put/2` och `put_new/2` returnerar
`ok` (`put_new/2` för en lagrad nyckel är `ok` för ett exakt lika värde, annars
`badarg`); `get/1` för en nyckel som inte är lagrad ger `badarg`, `get/2`
returnerar standardvärdet; `get/0` listar varje `{Key, Value}`; `erase/1` anger
om nyckeln var lagrad; `info/0` är `#{count => N, memory => Bytes}` (orden i de
lagrade kopiorna). Nycklar matchas exakt (`1` och `1.0` skiljer sig). Läsningar
returnerar den lagrade termen på plats, utan kopia.

## Modulen unicode

`runtime/src/builtins/unicode/`. Varje funktion är inbyggd:
`characters_to_binary/1,2,3`, `characters_to_list/1,2` (även under OTP:s
interna namn `characters_to_binary_int/2` och `characters_to_list_int/2`),
`bin_is_7bit/1`, `bom_to_encoding/1`, `encoding_to_bom/1`, och
(`unicode/forms.cpp`) normalformerna, `category/1`, `is_whitespace/1`,
`is_id_start/1` och `is_id_continue/1`.

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
- `characters_to_nfc_list/1` och dess syskon kör OTP:s loop över
  `unicode_util`:s normalformer: kodpunkterna som en lista eller en
  UTF-8-binary, `{error, Converted, Rest}` vid ogiltig UTF-8 och `badarg` för
  allt annat. Egenskapsfunktionerna tar en kodpunkt (annars `badarg`) och
  behåller OTP:s genvägar: `is_whitespace/1` är falskt under 5001 utanför dess
  ASCII- och Latin-1-lista, och identifierartesterna avgör ASCII direkt och
  resten efter kategori, Other_ID_Start, Other_ID_Continue och mönstersyntax.

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
(`{error, Rest}` eller `{badarg, Rest}` vid ogiltig UTF-8). Chardata-genomgångarna är inbyggda
funktioner: `cp/1` (`unicode/code_points.cpp`) öppnar nästlade listor så långt
som OTP gör och behåller en binarys rest som en del av den; `gc/1` delar upp
utökade grafemkluster enligt UAX #29 i OTP:s regelordning; `nfd/1`, `nfc/1`,
`nfkd/1`, `nfkc/1` (`unicode/normalize.cpp`) normaliserar det första
klustret, där `nfkc/1` behåller en lista där dess dekomposition hade flera
kodpunkter, som OTP:s `compose_compat_0`; `uppercase/1`, `lowercase/1`,
`titlecase/1` och `casefold/1` mappar den första kodpunkten.
`spec_version/0` är `{17, 0}`.

`tools/unicode/generate.py` skriver tabellerna en gång per Unicode-uppdatering:
skiftlägesmappningar, kategorier, dekompositioner och egenskapspredikaten från
värd-OTP:ns svar för varje kodpunkt (`tools/unicode/observe.escript`),
grafemgränser, emoji-, indiska och kompositionsdata från de filer i Unicode
Character Database som OTP 29 låser (Unicode 17.0). Endast de genererade
tabellerna checkas in, med den notis som Unicode License v3 kräver; byggen
behöver varken OTP eller datafilerna. `executables_unicode_tables` och
`executables_unicode_clusters` jämför svar, kluster och normalformer med OTP:s, `executables_unicode_forms` jämför `unicode`-formerna och
egenskaperna.

## io_lib

`library/stdlib/io_lib.erl`, `runtime/src/builtins/io_lib/`. Resultaten är OTP:s
djupa teckenlistor, nästlade exakt som `io_lib` och `io_lib_format` bygger
dem: text byggs först som celler i en C++-arena (`io_lib/deep.cpp`), och blir
sedan en term (`io_lib`) eller platta tecken (`io:format/1,2,3`, som kör samma
motor).

- Skrivare (`io_lib/write.cpp`): `write/1,2,5` följer `write1/4` med
  djupgränser (`[...]`, `|...`, `,...`), atomer efter kodning (`latin1`
  skriver escape-sekvenser för tecken utanför Latin-1), maps i Clauses
  nyckelordning, `ordered` eller `reversed`; `write_bin/5` rapporterar OTP:s
  storlekar, inklusive egenheter. `write_string/1,2` och dess Latin-1- och
  `as_latin1`-former, `write_char/1` och besläktade funktioner,
  `write_atom/1`, `quote_atom/2`, `write_binary/3` och binary-formerna
  skriver escape-sekvenser som `string_char/4` och `needs_escape/2`.
- Formatmotor (`io_lib/format_scan.cpp`, `format_build.cpp`): `scan` gör
  om formatet till literaler och `format_spec()`-maps (`scan_format/2`,
  `unscan_format/1`, `build_text/1,2`); `build_small` plattar ut de små
  styrsekvenserna (`~e ~f ~g ~b ~B ~x ~X ~+ ~# ~c ~~ ~n ~i`, `~s` för en
  atom) till resultatet; `build_limited` delar `chars_limit` mellan
  `~w ~W ~s ~p ~P` och skriver dem genom `string/6`, `term/6` och den
  balanserade utfyllnaden i `chars/2`. `~e`, `~f`, `~g` avrundar de 21
  siffrorna från `float_to_list/1` som `float_man/3` gör
  (`format_float.cpp`). Interna fel är `badarg`, som `io_lib`:s catch gör
  dem till; `unscan_format/1` kastar sina egna. `bformat/2,3` och
  `bfwrite/2,3` är samma text som UTF-8.
- Kontroller och hjälpfunktioner: `char_list/1`, `deep_char_list/1`,
  kontrollerna av utskrivbarhet (`printable_list/1` är Latin-1:
  `io:printable_range/0` är `latin1`), `chars_length/1`, `indentation/2`
  (med OTP:s binary-förskjutningar efter en tabb), `limit_term/2`, `nl/0`
  och I/O-serverns tillstånd `collect_chars/1,3,4`,
  `collect_chars_eager/4`, `collect_line/1,3,4`, `collect_line_no_eol/4`
  (`io_lib/collect.cpp`).
- Pretty printer (`io_lib/pretty*.cpp`): OTP:s `io_lib_pretty` för
  `print/1,4`, `~p`/`~P` (djup och `chars_limit`), `write/2,5`,
  `bwrite/2` och `write_bin/5` med `chars_limit` över 0, samt
  kraschrapporter. `print_length/7` bygger mellanformatet i en arena (varje
  värde med sin längd på en rad, punkter bär det som ska skrivas djupare);
  `intermediate/7` fördjupar det inom `chars_limit` (`expand/3`,
  `find_upper`, `search_depth`); `cind/7` väljer taggindrag och `pp/8`
  bryter rader i OTP:s djupa listformer. `bformat/2,3` lägger ut `~p` som
  `print_bin/2`, med dess binary-radbrytningar, storlek och kolumn.
- Erlang: `get_until/1,3,4` (tillämpar anroparens skanner),
  `format_prompt/1,2` och `write/3`. Stubbe: `fread/2,3`.
- Behållare nästlade djupare än 256 nivåer ger `system_limit`, och
  jämförelse-funs för `maps_order` ger `badarg`
  ([skillnader](differences.md#io)).
  `executables_io_lib_text` jämför varje funktions former med OTP:s,
  `executables_pretty_print` jämför pretty printer.

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
