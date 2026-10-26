---
source: docs/builtins.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d6df02dea1e6270774c9766671b42d9c4b5af4090512da97273a2a4a3a58197f
translatedAt: 2026-10-26
---
# Inbyggda funktioner

Funktioner som runtime implementerar i C++: `erlang`-BIF:ar och funktioner i
andra moduler vars motsvarigheter i OTP är BIF:ar, NIF:ar eller behöver runtime.
Registrerade efter modul, funktion och aritet; nås direkt, via dynamiska anrop
eller som funs. Källkoden finns i `runtime/src/builtins/`; observerbara
skillnader från OTP finns i [skillnader](differences.md).

## Vilka inbyggda funktioner som finns

- Katalogen `abi::v1::bridge_builtins`
  ([builtins.hpp](../abi/include/clause/abi/builtins.hpp)): varje inbyggd
  funktion som både kompilatorn och runtime känner till; gruppkommentarer
  namnger den implementerande filen.
- En posts index är talet som genererad kod skickar till bryggan; katalogen
  får ordnas om (kompilatorn och runtime byggs tillsammans).
- Modulen `erlang`: guard-BIF:ar, operatorer som funktioner, `display/1`,
  `halt/0,1`, felkastning, termåtkomst, konverteringar, processer, portar,
  externt termformat, tid, systeminformation, fun-information, hashning,
  kodladdning.
- Övriga moduler: ett avsnitt var nedan; privata hjälpmoduler
  (`clause_unicode`, `clause_re`, `clause_zlib`, `clause_receive`, ...) betjänar
  Erlang-bibliotekskod.
- Status per funktion (inbyggd funktion, Erlang-kropp, stubbe) finns i
  `library/<application>/<module>.terms` ([bibliotek](library.md#files)).
- Ett kvalificerat anrop av en inbyggd funktion i katalogen anropar bryggan;
  varje annan `erlang`-funktion når [biblioteksmodulen erlang](#erlang-module).

## Hur anrop når dem

| Källa | Väg |
| --- | --- |
| `abs(X)`, `X + Y`, `display`, `halt`, `error` | Inline-kod eller en särskild tjänst |
| Inbyggda funktioner i katalogen utan inline-tjänst (`A -- B`, ...) | Inträde som i en funktion: `CLAUSE_builtin_frame_v1`, argument i register |
| Direkta inbyggda funktioner (gör aldrig trap, väntar aldrig och rör aldrig en annan process) | `CLAUSE_builtin_call_v1` returnerar resultatet |
| Snabba inbyggda funktioner (`length`, `binary_to_list`, `list_to_binary`, `iolist_to_binary`) | Begränsad snabb väg (256 celler, 4096 resultatbyte); annars inträde i ramen |
| `A ++ B` | Kort äkta `A` kopieras inline; annars inträde |
| `fun abs/1`, `fun erlang:'+'/2` | Extern fun `erlang:F/A` bunden till den inbyggda funktionen |
| `M:F(Args)`, `apply/3`, `fun M:F/A` vid körning | Modulexport först, sedan inbyggd funktion |

- `fun F/A` av en autoimport som modulen varken definierar eller undertrycker
  är `fun erlang:F/A`, som i OTP. Icke-autoimporter (`display/1`, `raise/3`,
  `make_tuple/2,3`, ...) behöver prefixet `erlang:`.
- En inbyggd funktions ram har en null-kropp: inträdet lägger inte till någon
  ram, så ett svansanrop returnerar till anroparens anropare.
- Fel (`badarg`, `badarith`, `system_limit`, `{badmap, M}`, `{badkey, K}`)
  använder den kontrollerade felkanalen.
- Termåtkomst och konverteringar följer OTP:s `badarg`-regler:
  - `setelement/3`: litet index i tupeln; `make_tuple/2,3`: storlek
    0..16,777,215; `A ++ B`: äkta `A`; `A -- B`: äkta listor, `=:=`,
    O((n + m) log m).
  - `list_to_atom/1`: det 256:e tecknet ger `system_limit`; full atomtabell
    (`--max-atoms`) avslutar med 70.
  - `integer_to_list/2`, `list_to_integer/2`: bas 2..36; `system_limit` efter
    1,262,611 decimalsiffror.
  - `float_to_list/1,2`: OTP:s format (`scientific`, `decimals`, `compact`,
    `short`); 256+ byte text ger `badarg`.
  - Binary-motsvarigheterna delar textregler (`erlang/conversion_text.cpp`);
    flyttalstext behöver siffror på båda sidor om punkten.
- `function_exported/3`: sant för en programexport eller en registrerad
  inbyggd funktion.

## Portioner

Inbyggda funktioner vars arbete växer med en lista eller binary körs i
begränsade portioner, som OTP:s trapping-BIF:ar.

- Varje inträde i en inbyggd funktion förbrukar en reduktion; en portion gör
  `WORK_PER_REDUCTION` (16) enheter per reduktion som återstår i tidskvoten.
- Arbete kvar: `ProcessStack::trap` namnger en fortsättning; tillståndstermer
  stannar i register (rötter), native-tillstånd i `TrapState`. Processen lämnar
  ifrån sig exekveringen och återupptas senare.
- Kan fortsätta i en Erlang-export (`io` till en processenhet gör trap till
  `file:write/2`).
- Resultat, fel och ordning är desamma som vid körning till slut. Värdanrop
  (`call_builtin`) slutför varje trap direkt.
- Små indata tar snabba vägar på ordnivå (`++` med ≤ 64 celler, korta
  `integer_to_list`, `list_to_integer`, `atom_to_list`, tupelkonverteringar).
- Gör trap: `length/1` i en kropp (guard förblir inline), `++`, `--`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`.
- Allt annat, inklusive `io:format` och inbyggda tupelfunktioner, körs till
  slut.

## Typade inbyggda funktioner

- C++-funktioner `Result F(ProcessContext &, Parameters...)` registrerade med
  `typed_entry<F>(module, name)`
  ([typed.hpp](../runtime/src/builtins/typed.hpp)).
- Adaptern tar emot argumentord och konverterar till parametertyper; en
  avvikelse ger `badarg` innan kroppen körs. `Named<Role>` förhindrar
  förväxlade termparametrar.
- Returnerar en term, `BuiltinResult` eller rått `Word`, eller kastar
  `BuiltinFailure`; andra C++-undantag blir `out_of_memory` eller
  `internal_error`.
- Guard-BIF:ar, operatorer och listfunktioner som gör trap är adaptrar av typen
  `BuiltinBody` på ordnivå; frekventa konverteringar läser celler på plats
  (`TermAccess::trusted`).

## Registrering

- `BuiltinRegistry`
  ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  som ägs av `CodeServer`, mappar modul/funktion/aritet till en `BuiltinFrame`;
  `add` registrerar en hel grupp eller ingenting.
- Vid start registreras varje tabell i `production_builtins()`
  (`builtins/registry.cpp`), sedan tabellerna från de runtime-tillägg som
  startdeskriptorn listar (`RuntimeOptions::extensions`): kryptoarkivets när
  programmet länkar det ([modulen crypto](#crypto-module)).
- Klistriga: modulexporter med samma namn som en inbyggd funktion hoppas över,
  så anrop når aldrig en `clause_builtin_placeholder`-kropp eller en
  användarfunktion med samma namn.
- Värdvägen `abi::v1::dispatch_builtin` är separat
  ([runtime](runtime.md#code-server-and-builtins)).

## Källkodslayout

- Stora moduler får en underkatalog med en fil per familj (`erlang/`,
  `lists/`, `binary/`, `unicode/`, `re/`, `zlib/`, ...); små är enskilda filer.
- Varje familjefil definierar en `*_builtins()`-tabell som listas i
  `production_builtins()`. Ny familj = ny fil; dela filer över cirka 400 rader.
- Kompilatorn läser aldrig runtime-källkod; katalogen är den delade listan.

## Modulen erlang

- `library/erts/erlang.terms`: OTP 29:s exporter som `{Name, Arity, Flags, Status}`
  (flaggor `auto_import`, `guard`; status `implemented` eller
  `{unavailable, Reason}`), statusar hålls uppdaterade för hand.
- `tests/compiler/builtins/generate_erlang.py` skriver `library/erts/erlang.erl`
  (stubbar) och `compiler/src/semantic/erlang_auto_imports.inc`. CTests
  `builtins_erlang_inventory` (aktuella) och `builtins_erlang_freshness`
  (värd-OTP).
- Inbyggda funktioner vinner för `erlang:F(...)`, `fun erlang:F/A`, `apply`
  och importer; övriga exporter ger `{not_implemented, F, A}` vid anrop,
  spårningsfunktionerna (`{unavailable, tracing}`: `trace*`, `system_monitor`,
  `system_profile`, `seq_trace*`, `dt_*`) `notsup`; okända namn är
  `undefined function`.
- Tillägg (`executables_erlang_gaps`, `_packet_decoding`, `_suspension`):
  - `adler32`, `crc32` och `*_combine` ovanpå fastlåst zlib; `iolist_to_iovec/1`.
  - `append_element/2`, `insert_element/3`, `delete_element/2`.
  - Cookies som på en icke-levande nod; `halt/2` som `halt/1`.
  - `send/3`, `spawn/2,4` och besläktade ([processer](processes.md#builtins)).
  - `decode_packet/3`: varje OTP-pakettyp och alternativ, OTP:s http-termer.
  - `suspend_process/1,2`, `resume_process/1`, `process_display/2`.

## Externt termformat

`erlang/term_encoding.cpp`, `term_decoding.cpp`; kodek delad med kompilatorn
([external_term.hpp](../abi/include/clause/abi/external_term.hpp)), explicita
stackar.

- `term_to_binary/1,2`: OTP:s byte för `nonode@nohost`; alternativ
  `minor_version`, `deterministic`, `compressed`; lokala funs och native records
  ger `notsup`.
- `term_to_iovec/1,2`, `external_size/1,2`.
- `binary_to_term/1,2`: längder kontrolleras före allokering; `safe`, `used`;
  felaktig indata eller främmande identiteter ger `badarg`.
- Kodekens stackar och de kodade byten i `term_to_binary` är trådlokala
  buffertar som behålls mellan anrop (upp till 1 MB vardera,
  `builtins/scratch.hpp`), så en stor term tar inte nya sidor vid varje anrop;
  små heltal hoppar över den generella objektvägen i båda riktningarna.
- CTests `executables_external_terms`, `builtins_etf_fuzz`.

## Tid

`erlang/time.cpp`.

- Monoton tid är den stadiga klockan; `native` är nanosekunder; OTP:s
  enhetsatomer eller heltal som anger delar per sekund.
- `convert_time_unit/3` avrundar nedåt; `unique_integer/0,1` en stigande
  räknare; `now/0` strikt stigande.
- Kalenderkonverteringar är strikta och använder C-bibliotekets lokala tidszon.
- Timers: [processer](processes.md#timers).

## Systeminformation

`erlang/system.cpp`, `erlang/system_flags.cpp`.

- `statistics/1`: `wall_clock`, `runtime`, körköer, `context_switches`;
  räknare för reduktioner, skräpsamling och I/O rapporterar noll.
- `system_info/1`: `otp_release` `"29"`, `version` `"17.1"`, `machine`
  `"Clause"`, antal, gränser, fasta emulatorsvar; fullständig lista i `system.cpp`.
- `memory/0,1`: OTP:s typer; `binary`, `code`, `ets` är 0.
- `system_flag/2`: `backtrace_depth` (≤ 64) och `min_heap_size` har effekt;
  de flesta andra läses tillbaka utan effekt; `cpu_topology`, `erts_alloc`, ...
  `badarg`.

## Hashning

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2`, `phash/2`: OTP:s värden för atomer, tal, binaries, listor,
  tupler, maps; pid:ar, portar, referenser och funs hashas på Clauses eget sätt.
- `md5/1` och `md5_init/update/final`: RFC 1321; kontexten är Clauses egen
  binary på 96 byte.

## Kodladdning

`erlang/code.cpp`. Varje modul länkas och förblir laddad; dynamisk kod är
uppskjuten.

- `module_loaded/1`, `loaded/0`, `pre_loaded/0` omfattar kompilerade och
  inbyggda moduler.
- `delete_module/1` för en laddad modul ger `notsup`; `prepare_loading/2` ger
  `{error, badfile}`.

## Modulen lists

`builtins/lists/`. OTP:s `lists` är Erlang, så inbyggda funktioner ger de fel
som dess klausuler ger.

- Genomgångar (`sublist`, `flatten`, sammanslagningar, `key*`, `zip`, `sort`,
  `usort`, ...) ger `function_clause` som OTP och förblir lika lata
  (`sublist([a | b], 1)` är `[a]`).
- `keymember/3`, `keysearch/3` är BIF:ar: `badarg`-regler.
- Lika element: det första vinner (`max([1, 1.0])` är `1`).
- Funktioner som tar funs och resten är Erlang i `library/stdlib/lists.erl`;
  inuti den anropas inbyggda funktioner kvalificerat.
- Inbyggd `function_clause` har ingen egen ram.

## Modulen math

`builtins/math.cpp`.

- Varje OTP 29-funktion ovanpå C-biblioteket; icke-tal ger `badarg`,
  icke-ändliga resultat `badarith`.
- 64-bitars kodgenerering inlinar `sqrt`, `floor`, `ceil`, `exp`, `log*`,
  `sin`, `cos`, `pow` på tal och behåller råa double-värden.

## Modulen binary

`builtins/binary/`; `replace/3,4` och `list_to_bin/1` är Erlang.

- Mönster: binary, lista av binaries eller kompilerat; matchning längst till
  vänster, sedan längst; `scope`, `global`, `trim`, `trim_all`.
- `compile_pattern/1` returnerar `{bm, ...}` eller `{ac, ...}` utan referens.
- Övriga funktioner följer OTP; felaktiga argument ger `badarg`;
  `referenced_byte_size/1` är binaryns egen storlek.

## Modulen maps

`builtins/maps.cpp`, `builtins/os.cpp`.

- Varje dokumenterad `maps`-funktion; kärnfunktioner är inbyggda med OTP:s fel;
  nycklar matchas exakt.
- Funktioner som tar funs är Erlang i `maps.erl`; iteratorer använder
  [`erts_internal:map_next/3`](#erts-internal).
- Map-markörer går igenom platta maps och map-träd i nyckelordning;
  `clause_maps:entries/1` förser `maps:fold/3` med poster.
- `os`: `type`, `getenv`, `env`, `putenv`, `unsetenv`, `getpid`, `version` är
  inbyggda; tidsfunktioner är Erlang; `os:cmd/1` använder en port.

## Samlingar

`builtins/collections/`: varje dokumenterad funktion i `ordsets`, `orddict`,
`proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue`, `array`.

- Listgenomgångar är inbyggda funktioner; funktioner som tar funs är Erlang.
- Varje inbyggd funktion går igenom data som OTP:s klausuler: samma resultat,
  samma fel för alla indata.
- `dict`, version 1 av `sets`: OTP:s linjära hash-records (samma layout och
  ordning). Version 2 av sets är maps.
- `gb_trees`, `gb_sets`: delad balanserad trädmotor; träd är lika OTP:s.
- `queue`: OTP:s förflyttningar av `{Rear, Front}`; köer är lika OTP:s.
- `array`: OTP 29:s record `#array{}`, ändras exakt som i OTP.

## Mängder av mängder

- `sofs` (`builtins/sofs/`, `executables_sofs_sets`): OTP:s records ovanpå
  sorterade listor; algebra, relationer och familjer är inbyggda funktioner,
  funktioner som tar funs är Erlang.

## Graf

- `graph` (`builtins/graph/`, `executables_graph_module`): OTP:s `#graph{}`;
  genomgångar och vägar är inbyggda funktioner med explicita stackar,
  uppdateringar är Erlang.

## Digraph

- `digraph`, `digraph_utils` (`builtins/digraph/`,
  `executables_digraph_tables`): OTP:s tre ETS-tabeller; uppdateringar i Erlang
  ovanpå `ets`; vägsökningar och genomgångar är inbyggda funktioner som läser
  tabeller på plats.

## ETS

`builtins/ets/` ovanpå runtimens tabeller ([runtime](runtime.md#ets-tables)).

- Inbyggda funktioner: tabellernas livscykel, infogning/uppslag/radering,
  genomgångar, räknare, `info`; folds, `i/0..3`, `fun2ms/1` är Erlang.
- Alternativ och åtkomsträttigheter som OTP; varje fel är `badarg`.
- Matchningsspecifikationer ([runtime](runtime.md#match-specifications)):
  `select*`, `match*`, `match_spec_*`, `erlang:match_spec_test/3`; resultat i
  genomgångsordning, fortsättningar med OTP:s form.
- Tabellfiler: `tab2file`, `file2tab`, `tabfile_info` läser och skriver OTP:s
  disk_log-format i båda riktningarna.
- `to_dets/2`, `from_dets/2` ovanpå `dets`; `table/1,2` i Erlang ovanpå
  `qlc:table/2` (select/3 som standard, `first_next`, `last_prev`, `{select, MS}`),
  slår upp nycklar med `==` i ett `ordered_set`, annars `=:=`.
- CTests `executables_ets_*` kör OTP-referensfall.

## Dets

`dets.erl` ovanpå `clause_dets` (`builtins/dets/`): OTP:s filformat version 9,
byte för byte, samma filordningar.

- Motor (C++): huvud, buddy-frilistor, linjär hashning, tömning av skrivcache,
  skanningar, bulklayouter.
- Processer (Erlang): `dets`-server med OTP:s registertabeller; en process per
  tabell som håller filhandtag, cache, fixeringar, timers.
- Reparationer och fel vid öppning som i OTP; funs körs där OTP kör dem.
- `table/1,2` i Erlang ovanpå `qlc:table/2` (select/3 som standard, `first_next`,
  `{select, MS}`); odokumenterade hjälpfunktioner är stubbar.
- CTest `executables_dets_tables` jämför med OTP, inklusive filernas MD5.

## Kodningar

`builtins/encoding/`.

- `base64`: varje funktion är inbyggd; avkodningsfel matchar OTP:s
  tillståndsmaskiner.
- `json`: `decode/1`, `encode/1`, `format/1,2` och binary-kodare är inbyggda
  funktioner (återgår till Erlang efter 256 nästlingsnivåer); avkodare med
  återanrop och kodare som tar funs är Erlang ovanpå `clause_json`-skannrar.

## POSIX-meddelanden

`builtins/erl_posix_msg.cpp`, `library/stdlib/erl_posix_msg.erl`.

- `erl_posix_msg:message/1` (OTP:s interna modul, som `file:format_error/1`
  behöver): den engelska texten för en POSIX-felorsak från en tabell observerad
  från OTP 29, `"unknown POSIX error: "` och namnet för en annan atom, `badarg`
  för något som inte är en atom.

## Nätverksnamn

`builtins/net/`, `library/kernel/clause_net.erl`, `library/kernel/net.erl`.

- `clause_net:gethostname/0`, `getaddrinfo/2`, `getnameinfo/4`,
  `getservbyname/2`, `getservbyport/2` anropar systemets funktioner och svarar
  som OTP:s `prim_net`: adressinformation som maps av `family`, `socktype`,
  `protocol` och en socketadress, prim_net:s felnamn (`eservice`,
  `enodata`, ...), `{error, einval}` för en okänd tjänst. `net` kontrollerar
  argumenten med OTP:s guards och skickar text som UTF-8-binaries.
- `clause_net:inet_getifaddrs/0` listar gränssnitt som OTP:s `inet_drv` gör
  för `inet:getifaddrs/0` (på Windows från `GetAdaptersAddresses` och
  `GetIfEntry` med dess regler för flaggor, prefix och klassbaserade nätmasker;
  annars från `getifaddrs(3)`, sammanslagna per namn och flaggor som `prim_inet`).
  `clause_net:getifaddrs/0` listar dem som `net:getifaddrs(all)` (Windows:
  OTP:s `net`-moduls paketposter och sorterade flaggor; annars prim_net:s maps
  med paket- eller länkadresser); `net` filtrerar dem efter familj, flaggor eller
  fun. `if_names/0` är listan över index och namn som både `net:if_index2name/1`
  och `if_name2index/1` söker i.
- `inet:getservbyname/2`, `getservbyport/2` och `gethostbyaddr/1` (ett
  `getnameinfo` med `NI_NAMEREQD`) använder samma inbyggda funktioner;
  nätverksnamnrymder svarar `{error, enotsup}` ([skillnader](differences.md)).
- `clause_net:dns_decode/1` och `dns_encode/1` (`builtins/net/dns.cpp`) är
  inet_res:s kodek för DNS-meddelanden: OTP:s tupler `#dns_rec{}`,
  `#dns_header{}`, `#dns_query{}`, `#dns_rr{}`, `#dns_rr_opt{}` och
  `#dns_rr_tsig{}` med inet_dns:s värden (symboliska typer, klasser och
  operationskoder, escape-sekvenser i namnetiketter, LOC som grader och meter)
  och dess `formerr`-regler (komprimeringspekare bakåt efter huvudet, namn under
  255 byte, trunkerade avsnitt bara med TC-biten); kodning komprimerar namn.

## Filnamn

`builtins/filename/`.

- Sökvägsfunktioner är inbyggda och följer OTP:s klausuler för värdens familj
  (Unix eller Windows-enheter och `//`-namn); OTP:s resultatformer och fel.
- `absname/1,2`, `basedir/2,3` är Erlang.

## Filelib

`builtins/filelib.cpp`, `library/stdlib/filelib.erl`, `library/stdlib/clause_filelib.erl`.

- `clause_filelib:escape/1` skriver `@` och `\` så att `filename:split/1`
  behåller escape-sekvenser; `compile_part/1` kompilerar en del av ett uppdelat
  mönster (`?`, `*`, `**`, teckenmängder med intervall, `{...}`-alternativ som
  tar med resten av sin del) med OTP:s egenheter (`**` bara som en hel del,
  `]` först eller som ett intervalls nedre gräns, `{badpattern, missing_delimiter}`,
  en `case_clause` för nästlade alternativ); `matches/3` och `match/2` filtrerar
  katalogposter.
- Genomgången (literala prefix, `..`, `**`, existenskontroller) är Erlang
  ovanpå `file` och `filename`, så resultaten är OTP:s, sorterade.

## Argparse

`builtins/argparse/`, `library/stdlib/argparse.erl`,
`library/stdlib/clause_argparse.erl`.

- `clause_argparse:validate/3` kontrollerar ett kommando som OTP:s `validate/2`
  gör, i OTP:s ordning, och returnerar det första ogiltiga fältet så att
  `argparse.erl` kan ge ett fel.
- `parse/6` är OTP:s tolk som en loop: långa former (`--name=value`), korta
  former, kombinerade flaggor, bifogade värden, negativa tal, `nargs`, åtgärder,
  typer, underkommandon, standardvärden; OTP:s kastade fel och argument-maps.
- `help/4` bygger OTP:s hjälplistor (radbrytning av användningsanvisningar,
  avsnitt, mallar) genom de inbyggda funktionerna i `io_lib`, `string` och
  `unicode`, så formerna är lika OTP:s.
- Funs anropas av `argparse.erl`: en inbyggd funktion returnerar en begäran
  (`{custom, Fun, Arg}`, `{re, Arg, Re[, Options]}`, `{describe, Fun}`) och
  anropas igen med svaren hittills och spelar upp sin genomgång på nytt;
  varje fun körs en gång, i OTP:s ordning.
- `run/3`, hanterare och `format_error/1,2` är Erlang.

## Qlc pt

`builtins/qlc_pt/`, `library/stdlib/qlc_pt.erl`,
`library/stdlib/clause_qlc_pt.erl`: qlc:s parse transform vid körning, för
`qlc:string_to_handle/1,2,3` och `qlc:q/1,2` i utvärderad kod. Moduler som
kompileras med `qlc.hrl` får fortfarande värd-OTP:ns transformering
([parse transforms](transforms.md)).

- `clause_qlc_pt:transform_expression/4` och `parse_transform/4` följer
  `qlc_pt.erl` funktion för funktion: NodeInfo (unika annoteringar och vad
  kontrollerna noterar på varje nod, lagrat efter platsnummer från 1 som i OTP),
  `no_shadows`, lint-körningarna som hittar introducerade variabler och
  generatorvariabler, ramar av `#bind{}`-records för konstant- och
  kopplingskolumner, överhoppning av filter, matchningsspecifikationer,
  kopplingsgeneratorer, den genererade tillstånds-funen, `Qdata`, `CodeF`
  (`term_to_binary(_, [compressed])` av den ursprungliga koden) och
  alternativ-funen. Mellandata är Erlang-termer med OTP:s former, så
  sorteringar följer termordningen; genererade variabler är referenser som
  OTP:s `make_ref/0`.
- Meddelanden kommer från C++-versionen av `erl_lint` (`Lint`), vägen som OTP:s
  `qlc_pt` tar när kompilatorn inte är tillgänglig; en lint-krasch på de former
  den bygger är kompilatorns interna fel, så som OTP:s kompilator rapporterar
  det. Records expanderas av C++-versionen av `erl_expand_records`,
  guard-tester av `is_guard_test/3`.
- Matchningsspecifikationer kör `ms_transform` i Erlang: den inbyggda funktionen
  returnerar `{try_ms, Forms}`, `qlc_pt.erl` svarar med resultatet av `try_ms/4`
  och anropar den inbyggda funktionen igen med svaren hittills och spelar upp
  dess genomgång på nytt; resultatet är `{done, Result, Transformed}` (en
  transformerad modul höjer stackspårningsdjupet till 500, som OTP:s
  transformering gör).

## Qlc

`library/stdlib/qlc.erl`: varje funktion i Erlang, eftersom utvärderingen
anropar frågans funs. Skriven utifrån OTP:s dokumentation; algoritmerna är
OTP:s där svar, deras ordning eller `info/1,2` visar dem.

- Handtag behåller OTP:s tupler (`{qlc_handle, H}` med `qlc_lc`, `qlc_table`,
  `qlc_append`, `qlc_sort`; `{qlc_cursor, {Pid, Owner}}`); kompilerade frågor är
  transformeringens `{qlc_lc, Fun, Opt}` med data i `qlc_v1` eller `simple_v1`.
- Förberedelse: uppslag vid nyckeln eller indexet med minst antal nycklar
  (`max_lookup`), matchningsspecifikationer för unära genomgångs-funs och
  listor, uppslagskopplingar föredras framför sammanslagningskopplingar,
  indata till sammanslagningskopplingar sorteras om de inte är kända som
  sorterade, enkla frågor för `cache` och `unique`, sammanslagna, och aldrig
  för den första generatorn.
- Utvärdering: svar är listor som slutar i `[]` eller en fortsättnings-fun.
  `cache` använder `ets`-tabeller (`qlc`, privata) eller en lista lagrad under
  `{Ref, '$_qlc_cache_tmpfiles_'}`, som flyttas till en temporär fil efter
  `max_list_size`; sammanslagningskopplingar lägger stora klasser av lika
  nycklar på fil (`'$_qlc_merge_join_tmpfiles_'`); sorteringar kör `file_sorter`
  när svaren överstiger `size`. Temporära filer heter
  `qlc_<node>_<os pid>_<unique>` i `tmpdir` eller arbetskatalogen;
  `tmpdir_usage` rapporterar genom `error_logger`.
- Fel som utvärderingen hittar (ett icke-listsvar från en genomgångs- eller
  uppslags-fun, filfel, `{tmpdir_usage, _}`) kastas med en intern tagg och
  returneras av `eval/2`, `fold/4`, `info/2` och markörer, så som OTP
  returnerar felen dess `throw_error/1` kastar.
- `info/1,2` skriver den förberedda frågan med `erl_pp:expr/3`,
  tabellbeskrivningar genom deras format-funs (strängar tolkas av
  `erl_eval:extended_parse_exprs/1`).
- `string_to_handle/1,2,3` och `erl_eval`:s `qlc:q/1,2` kör Clauses
  [`qlc_pt`](#qlc-pt); `ets:table/1,2`, `dets:table/1,2` och `erl_eval` når
  `qlc` via ett runtime-namn, så bara program som namnger `qlc` länkar det.
- CTest `executables_qlc_queries` jämför med OTP: dess frågemodul kompileras
  från `qlc_queries.abstr`, formerna efter OTP:s transformering, så testet
  behöver ingen värd-OTP ([körbara fall](../tests/fixtures/executables/README.md)).

## Strängar

`builtins/string/`: varje `string`-funktion.

- Genomgångar följer `string.erl` ovanpå `unicode_util:cp/1`, `gc/1`: OTP:s
  svansar, sub-binaries, blandade listor och fel.
- Genomgångar från slutet loopar i stället för att rekursera.
- Skiftlägesfunktioner returnerar indata när ingenting ändras; `equal/4`
  normaliserar via `unicode/normalize.cpp`.
- `to_integer/1`, `to_float/1`, Latin-1-API, `jaro_similarity/2` som OTP.

## URI-strängar

`builtins/uri/`.

- `parse/1`: en RFC 3986-genomgång i OTP:s ordning, OTP:s felfragment.
- `recompose`, `normalize`, `resolve`, `percent_decode`, `quote` och
  frågefunktioner följer OTP:s genomgångar och felstilar.
- `unicode/graphemes.cpp` delar upp kluster för inbyggda funktioner som behöver
  dem.

## Slumptal

`builtins/rand/`.

- `rand`: OTP:s tillstånd och hanterare; varje algoritm ger OTP:s sekvenser.
  Kända hanterare körs i C++ (`clause_rand:*`); övriga kör OTP:s generiska
  Erlang.
- `splitmix64_next/1`, `exsp_*`, `mwc59*` är inbyggda funktioner.
- `tools/rand/` observerar OTP-konstanter och genererar `tables.cpp`.
- `random`: `uniform_s/1` är inbyggd, resten Erlang.

## Kalender

`builtins/calendar.cpp`.

- Inbyggda funktioner för gregoriansk aritmetik över heltal av valfri storlek,
  OTP:s formler och fel.
- Lokal/universell tid och RFC 3339 är Erlang i `calendar.erl`.

## Timer

`builtins/timer.cpp`.

- `seconds/1`, `minutes/1`, `hours/1`, `hms/3` och `now_diff/2` som
  Erlang-aritmetik över vilka tal som helst: `badarith` för ett icke-tal,
  `function_clause` för ett argument till `now_diff/2` som inte är en 3-tupel.
- Timers är Erlang i `timer.erl`, utan `timer_server`: sändningar till en lokal
  pid använder `erlang:send_after/3`; varje annan engångs- eller intervalltimer
  är en process som skapar ett alias, som dess `TRef` bär och `cancel/1` skickar
  till. En intervalltimer övervakar processen den arbetar åt och avslutas med
  den; `apply_repeatedly` väntar på att varje åtgärd avslutas före nästa tick.

## Persistenta termer

`builtins/persistent_term.cpp` ovanpå runtimens tabell
([runtime](runtime.md#persistent-terms)).

- `put/2`, `put_new/2`, `get/0,1,2`, `erase/1`, `info/0` med OTP:s resultat;
  nycklar matchas exakt; läsningar returnerar den lagrade termen utan kopia.

## Modulen unicode

`builtins/unicode/`: varje funktion är inbyggd.

- Kodningar `latin1`, `utf8`, `utf16`, `utf32` (med byteordning); annars `badarg`.
- Chardata: binaries, kodpunkter, nästlade listor; på varandra följande binaries
  är en ström.
- Fel ger `{error | incomplete, Converted, Rest}` med OTP:s form på `Rest`.
- Normalformer, `category/1`, `is_whitespace/1`, `is_id_*` behåller OTP:s
  genvägar.

## Modulen code

`builtins/code.cpp`. Ingen `code_server`-process; svaren beskriver det länkade
programmet.

- `ensure_loaded/1`, `is_loaded/1` (`{file, preloaded}`), `which/1`
  (`preloaded`), `all_loaded/0`, `module_status/0,1`; `is_sticky/1` `false`.
- Kodsökväg (`library/kernel/code.erl`): en persistent term som byggs vid första
  användning så som OTP:s interaktiva kodserver bygger den: applikationernas
  `ebin`-kataloger i `ERL_LIBS`, den senaste versionen av varje applikation i
  `lib_dir()`, sedan `"."`. `root_dir/0` är den körbara filens katalog.
  Sökvägsändringar normaliserar och kontrollerar kataloger som OTP; `lib_dir/1`,
  `priv_dir/1` och `compiler_dir/0` namnger den första sökvägskatalogen
  `.../Name[-Vsn][/ebin]`.
- Laddningssvar för länkad kod: objektkod som hittas på sökvägen ger
  `erlang:prepare_loading/2`:s `{error, badfile}`, saknad kod `nofile`;
  `purge/1` `false`, `soft_purge/1` `true`, `delete/1` `false`;
  `get_doc/1` `{error, missing}`; inget stöd för täckningsmätning.

## Modulen io

`builtins/terminal.cpp`, `library/stdlib/clause_io.erl`.

- `clause_io:isatty/1` (`stdin`, `stdout`, `stderr`): en konsol på Windows,
  `isatty(3)` annars; `window_size/1`: en terminals `{Columns, Rows}`
  (`GetConsoleScreenBufferInfo`, `TIOCGWINSZ`), annars `{error, enotsup}`.
- De besvarar terminalflaggorna i `io:getopts/0,1`, `io:columns/0,1`,
  `io:rows/0,1` och `io_ansi:enabled/0,1`.
- Servern för standardindata (`io.erl`) läser rader som OTP:s grupp gör: en
  `get_until`-begäran (`io:read/1,2`, `io:scan_erl_exprs/1..4`, skalets
  kommandon) tar en rad i taget och skriver sin prompt igen före varje
  ytterligare rad, och ett CRLF-radslut läses som LF.

## Modulen os

`builtins/os.cpp`, `library/kernel/os.erl`.

- `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0`,
  `version/0` är inbyggda funktioner.
- `cmd/1,2`: Erlang ovanpå en spawn-port med OTP:s protokoll: Windows kör
  `COMSPEC /c Command`; annars läser `/bin/sh -s unix:cmd` kommandot och
  ekar `^D` (och slutstatusen) vid dess slut. `max_size`,
  `exception_on_failure`, UTF-8-utdata avkodas till tecken.
- `find_executable/2` (inbyggd funktion): OTP:s sökning över element i `PATH`
  (Windows: den aktuella katalogen först, `.exe`, `.com`, `.cmd`, `.bat`).
- `set_signal/2` (inbyggd funktion): `badarg` på Windows som OTP; annars
  `sigaction`; en hanterad signal fungerar som OTP:s standardhanterare
  `erl_signal_handler`.

## Modulen init

`builtins/init.cpp`, `library/erts/init.erl`. Ett startat system utan
bootskript.

- Kommandoraden avkodas en gång (`startup/arguments.cpp`): vanliga argument
  matar startpunktens argv och `get_plain_arguments/0`.
- Enda flaggan är `home`; `script_name/0` är den körbara filens sökväg.
- Övriga funktioner är Erlang med OTP:s startade svar; `script_id/0` är
  `{"Clause", "29"}`.
- `stop/0,1`, `reboot/0` stoppar direkt; `boot/1`, `restart/0,1`,
  `make_permanent/2` avvisas med `notsup`.

## Atomics och counters

`builtins/atomics.cpp`.

- En `atomics`-array är en [handtagsreferens](runtime-heap.md#handle-references)
  ovanpå `std::atomic_ref`-värden; aritet 1..2^27; OTP:s `badarg`-regler och
  `info/1`.
- `counters` är Erlang ovanpå en atomics-array med tecken; write-concurrency-
  räknare är exakta.

## Erts internal

`builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`: funktionerna
som `stdlib` och `kernel` anropar.

- Inbyggda funktioner `cmp_term/2` och `map_next/3` (map-iteratorer, nyckelordning).
- Erlang: `list_to_integer/2`, `binary_to_integer/2`, `map_to_tuple_keys/1`,
  `term_type/1`, räknare, `dynamic_node_name`.
- `get_creation/0` `undefined`; grupper för distribution och `.beam` avböjs.
- `erts_code_purger`: ingenting att rensa.

## Unicode util

`unicode_util.erl` ovanpå inbyggda funktioner i `clause_unicode` och genererade
tabeller (`unicode/tables.cpp`).

- `cp/1`, `gc/1` (UAX #29), `nfd/nfc/nfkd/nfkc`, skiftlägesmappningar med OTP:s
  former; `spec_version/0` `{17, 0}`.
- `tools/unicode/generate.py` bygger tabeller från värd-OTP:ns svar och
  Unicode 17.0-data; byggen behöver ingetdera.
- CTests `executables_unicode_tables`, `_clusters`, `_forms`.

## io_lib

`io_lib.erl`, `builtins/io_lib/`. OTP:s djupa teckenlistor byggs i en C++-arena;
`io:format` använder samma motor.

- Skrivare (`write.cpp`): `write`, `write_string`, `write_atom`, ... skriver
  escape-sekvenser och begränsar som OTP.
- Formatmotor (`format_scan.cpp`, `format_build.cpp`): varje styrsekvens,
  `chars_limit`, OTP:s flyttalsavrundning; fel `badarg`.
- Pretty printer (`pretty*.cpp`): OTP:s layouter i `io_lib_pretty`.
  `clause_io_lib:pretty/2` är `io_lib_pretty:print/2` för skalet: `column`,
  `line_length`, `depth`, `line_max_chars`, `strings`, `encoding` och `records`,
  definitionerna `[{Name, [Field]}]` som en `record_print_fun` skulle svara med,
  så tupler med ett känt namn och en känd storlek skrivs som
  `#Name{Field = Value, ...}` med OTP:s layout. CTest
  `executables_shell_session`.
- Skanner (`fread.cpp`): styrsekvenser och fortsättningar för `fread/2,3`.
- Insamlare (`collect.cpp`), kontroller av utskrivbarhet, `indentation/2`.
- Funs för `maps_order`: den inbyggda funktionen registrerar maps och
  fortsätter i `clause_io_lib:sort_maps/6`, kör igen med sorterade nycklar.
- Nästling djupare än 256 ger `system_limit`. CTests `executables_io_lib_text`,
  `_pretty_print`, `_fread_scanning`.

## Kompilatortabeller

`builtins/front_end/`.

- `erl_internal`: BIF- och guard-tabeller från `erlang.terms`; typ- och
  operatortabeller; `add_predefined_functions/1`.
- `erl_anno`: OTP:s former och fel.
- `erl_features`: svar från Clauses kompilator; `used/1` läser deskriptorer
  eller `Meta`-block i `.beam`.
- `records`: se [native records](native-records.md#reflection).
- CTests `executables_compiler_tables`, `_records_reflection`.

## Erl scan

`erl_scan.erl` ovanpå `clause_erl_scan:scan/6` (`front_end/scanner*.cpp`), dess
egen skanner som följer OTP:s `scan1/5`.

- OTP:s token, annoteringar, sigill, strängar med tredubbla citattecken, fel
  och rester.
- Återanrop för `reserved_word_fun`, `text_fun` körs i Erlang i tokenordning.
- Fortsättningar för `tokens/3,4` skannar om den ofärdiga token.
- CTest `executables_erl_scan_tokens`.

## Erl parse

`erl_parse.erl` ovanpå `clause_erl_parse:parse/1` (`front_end/parser*.cpp`), en
rekursiv nedstigningstolk för OTP:s grammatik.

- OTP:s abstrakta format och LALR-felbeteende (stopptoken, ordning mellan
  åtgärdsfel och syntaxfel).
- `first_anno/1`, `last_anno/1` följer ordningen i `map_anno/2`.
- `normalise/1`, `abstract/1,2`, `tokens/1,2` är inbyggda funktioner;
  annoteringsgenomgångar med funs är Erlang.
- CTest `executables_erl_parse_forms`.

## Erl eval

`erl_eval.erl` tolkar det abstrakta formatet i Erlang; inbyggda funktioner i
`clause_erl_eval` hanterar bitsyntaxsegment (`front_end/erl_eval.cpp`) och
mönstermatchning (`front_end/eval_match.cpp`), och `erl_eval:partial_eval/1`
och `is_constant_expr/1` är också inbyggda funktioner.

- `clause_erl_eval:match/4` är `match1/5`: literaler, variabler, listor, tupler,
  maps, native records, prefix av `"abc" ++ T`, operatorkonstanter och
  binary-mönster, ger `{match, Bindings}`, `nomatch` eller `invalid` (ges som
  `{illegal_pattern, Pattern}` av `erl_eval.erl`). Map-nycklar och
  segmentstorlekar är guard-uttryck som utvärderas över de yttre bindningarna
  (`front_end/guard_eval.cpp`, delas med `epp`:s `-if`); bindningar läses och
  lagras som `orddict` eller en map, som OTP gör, även en osorterad lista.
- `clause_erl_eval:bits_gen/4` tar en binary-generators mönster från bitarnas
  början; utvärderarens loop, guards (de anropar den icke-lokala hanteraren)
  och comprehension-genomgångarna förblir Erlang.

- `bit_type/2` fastställer en `bin_element`:s specifikationer med `erl_bits`:s
  standardvärden och fel (`front_end/bit_types.cpp`, delas med `normalise/1`);
  `bit_segment/3` bygger ett segment (`badarg`, `system_limit`), `bit_take/3`
  tar ett från början av en bitstring (`nomatch`).
- Funs som utvärderaren skapar är closures över OTP:s miljö
  `{Anno, Bindings, Lf, Ef, UsedVars, Clauses}`, så `fun_data/1` och
  `erlang:fun_info/2` svarar som i OTP; `fun M:F/A` med delar vid körning
  använder `erlang:make_fun/3`.
- `exprs/2`, `expr/2` och `check_command/2` kontrollerar kommandon med
  `erl_lint:exprs_opt/3` som OTP gör.
- CTest `executables_erl_eval_exprs`.

## Erl lint

Kontrollerna i `erl_lint` är inbyggda funktioner (`front_end/lint*.cpp`),
skrivna efter OTP:s `erl_lint` klausul för klausul; `erl_lint.erl` behåller det
som anropar funs eller andra moduler.

- Ett `Lint`-objekt håller OTP:s `#lint{}`-tillstånd; variabeltabeller är
  vektorer sorterade efter namn (OTP:s orddicts), mängder och maps som OTP
  håller i termordning är ordnade behållare, så fel behåller infogningsordningen
  och varningar sorteras som i `return_status/1`.
- `module/1,2,3` går genom `clause_erl_lint:module/4` med behaviour-modulernas
  svar från `behaviour_info/1` uppslagna i Erlang
  ([skillnader](differences.md#erl_lint)); `format_error/1` formaterar svaret
  från `clause_erl_lint:format_spec/1` (inklusive nästlade `io_lib:format/2`-delar)
  så att resultaten är lika OTP:s termer.
- Utfasningar kommer från OTP:s `otp_internal`-tabeller
  (`front_end/otp_obsolete.inc`, genererad av
  `tests/compiler/library/generate_obsolete.escript`).
- `erl_eval:partial_eval/1` och `erl_bits:set_bit_type/2` som kontrollerna
  använder är C++ (`lint_eval.cpp`, `bit_types.cpp`).
- CTest `executables_erl_lint_checks`.

## Erl pp

Utskriften i `erl_pp` är en inbyggd funktion (`front_end/pp*.cpp`),
`clause_erl_pp:print/2`, porterad från den tidigare Erlang-modulens två pass;
`erl_pp.erl` behåller krokarna och `legalize_vars/1`.

- Det första passet gör om en form till layoutobjekt i en arena (`pp_items`,
  `pp_exprs`, `pp_forms`, `pp_types`); det andra lägger ut dem mot radbredden
  (`pp_layout`) och skriver atomer, strängar, tecken och värden genom
  C++-skrivarna i `io_lib`.
- En form som bara kroken kan skriva stoppar layouten med
  `{hook, Expr, Column, Precedence}`; `erl_pp.erl` anropar kroken och skriver
  igen med svaren hittills, så varje krok körs en gång, i OTP:s ordning.
- Precedenser och `erl_parse:abstract/2` kommer från `erl_parse.cpp`.
- CTest `executables_erl_pp_forms`.

## Epp

Villkoren i `epp`:s `-if` och `-elif` utvärderas av en inbyggd funktion,
`clause_epp:eval_if/1` (`front_end/epp_eval.cpp`), så ett program som
förbehandlar filer inte länkar `erl_eval`.

- Den utvärderar guard-uttrycket som `erl_eval:exprs/3` gör utan bindningar:
  literaler, listor, tupler, maps och map-uppdateringar, binaries (segment genom
  bitfunktionerna i `clause_erl_eval`), operatorer där `andalso`/`orelse` ger
  högersidans värde, och anrop av guard-BIF:ar (lokala autoimporterade eller
  `erlang:`) genom guard-tabellen för matchningsspecifikationer.
- Varje fel (obundna variabler, odefinierade records, en BIF som ger fel, ett
  lokalt anrop) gör villkoret falskt, eftersom `epp` fångar det.
- `epp`, `file` och `erl_features` kompileras med
  [strikt livstidsanalys](compile.md#strict-liveness).

## Erl expand records

`erl_expand_records:module/2` är en inbyggd funktion
(`front_end/expand_records.cpp`): expansionen går igenom former i C++ i stället
för en stor klausuldispatch i Erlang, så program som anropar den inte
kompilerar någon extra kod.

- OTP:s genomgångsordning (binary-segment från sista till första, matchningens
  högersida först) och `recN`-numrering; guard-tester med `is_record/3` blir
  mönster.
- Filter i comprehensions är guard-tester enligt `erl_lint`:s regler
  (`front_end/guard_tests.cpp`, med modulens records och lokala eller
  importerade funktioner).
- Alternativen `dialyzer`, `expand_inits`, `[no_]strict_record_tests`, även
  från `-compile`-attribut.
- CTest `executables_erl_expand_records_forms`.

## Modulen zlib

`builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.

- Länkar zlib 1.3.2 som OTP 29 ([zlib](compile.md#zlib)): samma byte.
- En ström är en handtagsreferens som äger `z_stream`; inbyggda funktioner i
  `clause_zlib` kör en operation över all indata.
- `zlib.erl` behåller OTP:s API, fel, tillstånd och helbuffertfunktioner.
- Komprimeringen i `term_to_binary` följer OTP:s storleksregel.

## Modulen zstd

`builtins/zstd/contexts.cpp`, `library/stdlib/zstd.erl`.

- Länkar zstd 1.5.7 som OTP 29 ([zstd](compile.md#zstd)): samma ramar.
- Kontexter och ordlistor är handtagsreferenser som äger libzstd:s motsvarigheter;
  en kontext som refererar till en ordlista håller den vid liv. Inbyggda
  funktioner i `clause_zstd` speglar OTP:s NIF: utdatablock på
  `ZSTD_CStreamOutSize()` / `ZSTD_DStreamOutSize()` (en ram som anger en mindre
  storlek dekomprimeras till ett block av den storleken), resultaten
  `{continue, Rest, Out}`, `{flush, Out}` och `{done, Out}`, ägarkontroller
  (`not_on_controlling_process`), felen `{badarg, {invalid_key | invalid_value,
  Term}}` och `{zstd_error, Name}`, booleska värden läses tillbaka som `false`
  så som OTP:s NIF läser dem.
- `zstd.erl` behåller OTP:s hantering av iodata, strömning och ramar.

## ASN.1-kodek

`builtins/asn1/` i `clause_runtime`, `library/asn1/clause_asn1.erl`
([ASN.1](asn1.md)).

- `clause_asn1:encode/3` och `decode/3` tar den genererade modulens schematerm,
  typnamnet och värdet eller byten (en binary eller iolist); `decode/3`
  returnerar `{Value, Rest}`. De tolkar schemat som asn1ct:s genererade BER-kod
  och `asn1rtt_ber` gör och ger samma `exit`/`error`-orsaker, som den genererade
  omslutande funktionen gör om till `{error, {asn1, Reason}}`.
- TLV:er tolkas som `asn1rt_nif` tolkar dem (`tlv.cpp`: dess felpositioner,
  gränser på två byte för taggar och fyra byte för längder); `ber_decode.cpp`,
  `ber_constructed.cpp`, `ber_encode.cpp` och `ber_encode_constructed.cpp`
  innehåller primitiva och konstruerade typer, `values.cpp` INTEGER, REAL och
  DER-`DEFAULT`-jämförelser, `legacy.cpp` äldre `BIT STRING`-former.
- PER (`per.hpp`): `per_bits.cpp` bitfält, längdbestämningar, heltal och strängar
  med deras justering och fragment; `per_encode.cpp`/`per_decode.cpp` de
  primitiva typerna; `per_encode_constructed.cpp`/`per_decode_constructed.cpp`
  sekvenser, utökningar, val och öppna typer; `per_strings.cpp`
  `BIT STRING`-värden. En PER-avkodning tar en binary och returnerar bitarna
  som lämnats olästa.

## Publik nyckel

`builtins/public_key/` i `clause_runtime`,
`library/public_key/clause_public_key.erl` ([public_key](public_key.md)):
record-genomgångarna och tabellerna i OTP:s `pubkey_translation` och
`pubkey_cert_records`, som `clause_public_key_codec` anropar.

- `translate(decode | encode, Term)` (`translate.cpp`) går igenom en term som
  `pubkey_translation:decode/1` och `encode/1` gör: de genererade modulernas
  records `SubjectPublicKeyInfo_algorithm`, `DSA-Params`, `DSA-Sig-Value`,
  `OTPExtension`, `SingleAttribute`, `OneAsymmetricKey` (version `v1`) och
  `EncryptionAlgorithmIdentifier` blir dem som `public_key.hrl` dokumenterar,
  och tillbaka; en oäkta lista ger `bad_generator` som comprehension gör.
- `oid_name(Table, Oid)` och `name_oid(Table, Name)` (`tables.cpp`, rader i
  `tables.inc`) slår upp i tabellerna `public_key_algorithm` (en algoritms
  nyckeltyp), `curve_type`, `named_curve`, `ml_dsa`, `ml_kem`, `slh_dsa` och
  `extension` (en utöknings typ); `undefined` när tabellen saknar rad,
  `badarg` för en annan tabell.
- `asn1_module(Type)` namnger den genererade modul som `der_decode/2` och
  `der_encode/2` använder för en typ (`public_key:get_asn1_module/1`),
  `undefined` för en typ som inte hör till någon.

## Modulen crypto

`builtins/crypto/` i det separata arkivet `clause_runtime_crypto`,
`library/crypto/crypto.erl` och `clause_crypto.erl`.

- Länkar OpenSSL:s libcrypto ≥ 3.1.2 (fastlåst 4.1.0, [OpenSSL](crypto.md));
  bara program som anropar `crypto` (eller anger `--with-crypto`) länkar
  arkivet, vars post `CLAUSE_crypto_extension_v1` listas i startdeskriptorn.
- `algorithms.cpp` behåller OTP:s namntabeller (hashvärden, chiffer, MAC:ar,
  nyckeltyper, kurvor, KEM:ar) med deras OpenSSL-hämtningsnamn; det första
  `crypto`-anropet laddar leverantörerna default, base och legacy och hämtar
  varje hashfunktion, chiffer och MAC, som OTP:s NIF gör när den laddas;
  kurvor provas (en nyckel genereras på varje) vid första `supports(curves)`.
  `supports/0,1`, `hash_info/1`, `info/0` och `info_lib/0` rapporterar vad det
  länkade libcrypto har.
- Hashtillstånd är handtagsreferenser som äger en `EVP_MD_CTX`;
  `hash_update/2` returnerar ett nytt tillstånd över en kopia, som OTP:s.
  MAC-tillstånd äger en `EVP_MAC_CTX` som `mac_update/2` för framåt på plats.
  `crypto.erl` matar texter längre än 20000 byte i delar, som OTP gör, så inget
  anrop av en inbyggd funktion körs länge.
- Fel är OTP:s NIF-fel: `{badarg | notsup | error, #{c_file_name,
  c_file_line_num, c_function_arg_num}, Description}`, som `crypto.erl` gör om
  till `{Class, {File, Line}, Description}` med `error_info` (`?nif_call`);
  beskrivningar och kontroller följer OTP:s ordning, fil och rad är Clauses.
- Motorer svarar som en OTP vars OpenSSL saknar motorstöd (`notsup`;
  OpenSSL 4 saknar det).
- Chiffer (`cipher.cpp`) följer OTP:s `api_ng.c`: tillstånd från `crypto_init/4`
  äger en `EVP_CIPHER_CTX` bakom ett lås som `crypto_update/2` för framåt på
  plats; `crypto_final/1` fyller ut enligt alternativen (OTP:s `undefined`,
  `none`, `zero`, `random`, `pkcs_padding`); `crypto_one_time/5` kör ett
  temporärt tillstånd. `crypto.erl` matar `crypto_update/2` med texter längre
  än 20000 byte i delar. AEAD (`aead.cpp`) följer `aead.c` för GCM, CCM och
  ChaCha20-Poly1305; en felaktig tagg dekrypteras till `error`. `crypto.erl`
  kör `rand`-generatorerna `crypto_aes` och `crypto_prng1` som OTP:s, ovanpå
  de inbyggda funktionerna `exro928_*` och `seed58/2` i `rand`.
- FIPS (`fips.cpp`): varje tabellpost behåller en andra `fips=yes`-hämtning,
  som används i FIPS-läge; en post utan en sådan är förbjuden där (OTP:s
  `*_FORBIDDEN_IN_FIPS`), lämnar `supports/1` och ger OTP:s
  `notsup`-beskrivningar. `enable_fips_mode/1` växlar OpenSSL:s
  standardegenskaper; program byggda med `--fips` länkar arkivets post
  `CLAUSE_crypto_fips_extension_v1`, vars startkrok laddar leverantören bredvid
  den körbara filen ([FIPS](crypto.md#fips)).
- Publika nycklar följer OTP:s `pkey.c`, `rsa.c`, `dss.c`, `eddsa.c`, `ec.c`,
  `ecdh.c`, `dh.c`, `evp.c` och `srp.c`: `crypto.erl` gör om heltal till
  binaries (`format_pkey`, `nif_curve_params`) och de inbyggda funktionerna
  bygger OpenSSL-nycklar från samma `OSSL_PARAM`-listor som OTP:s NIF:ar bygger
  (`params.cpp`, stora tal i native-byteordning), med OTP:s kontroller,
  beskrivningar och argumentnummer. `pkey.cpp`: `sign/4,5`, `verify/5,6`
  (RSA med PKCS #1, PSS, X9.31 och utan utfyllnad, DSA, ECDSA, EdDSA, ML-DSA,
  SLH-DSA; `{digest, Digest}`), RSA-`public_encrypt/4` och dess tre syskon
  (PKCS #1, OAEP med dess hashfunktioner och etikett, ingen utfyllnad),
  `privkey_to_pubkey/2`. `keys.cpp`: nyckelgenerering för RSA, DH, X25519/X448,
  Ed25519/Ed448, ML-DSA, SLH-DSA och ML-KEM, nyckelutbyte med DH och
  X25519/X448, `encapsulate_key/2`, `decapsulate_key/3`. `curves.cpp`:
  ECDH-nycklar och nyckelutbyte på namngivna eller explicita kurvor, försöker
  igen med explicita parametrar när OpenSSL inte känner till OTP:s namn (som
  OTP:s `retry_without_name`), och `ec_curve/1`, vars explicita parametrar
  kommer från det länkade libcrypto:s inbyggda kurvor i stället för OTP:s
  tabell `crypto_ec_curves` (byte för byte samma termer). `srp.cpp`: SRP:s
  formler för stora tal; `crypto.erl` behåller OTP:s multiplikator och
  scrambler. OTP:s egenheter behålls: `sign(dss, none, ...)` ger
  `"Bad digest type"`, `generate_key(dh, ...)` ignorerar en given privat
  nyckel, och en publik RSA-exponent på flera byte når OpenSSL i
  native-byteordning.

## Modulen re

`builtins/re/`, `re.erl` ovanpå medföljande PCRE2 ([PCRE2](compile.md#pcre2)).

- Kompilerat mönster: OTP 29:s `{re_pattern, ...}` med en handtagsreferens.
- `clause_re:compile/2`, `clause_re:run/4` (en matchning, varje
  capture-alternativ, OTP:s fel).
- `re.erl`: chardata-konvertering, `global`-loop, `replace`, `split`.
- `export`/`import/1` tillhandahålls inte. CTest `executables_re_module`.

## Prim eval

`process/receive.cpp`, `library/erts/prim_eval.erl`.

- `prim_eval:'receive'/2` går igenom brevlådan med inbyggda funktioner i
  `clause_receive` (`peek`, `skip`, `take`, `restart`, `wait`); det första
  svaret som inte är `nomatch` vinner.
- CTest `executables_prim_eval_receive`.
