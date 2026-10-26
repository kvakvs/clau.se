---
source: docs/library.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: eb1d55d20683cef87e3553554a2b837e023b35acb9de58cdad1cb868ec95d0d8
translatedAt: 2026-10-26
---
# Biblioteksmoduler

Clause levererar egna versioner av de OTP-moduler som program anropar,
skrivna i Erlang utifrån OTP:s dokumenterade beteende (inte kopierade från
OTP:s källkod) ovanpå runtimens [inbyggda funktioner](builtins.md), och
kompilerar dem tillsammans med de program som använder dem.

## Innehåll

Varje tillhandahållen modul exporterar OTP 29:s fullständiga lista för sitt
namn; dess inventering `<module>.terms` ([filer](#files)) registrerar vilka
funktioner som är implementerade och vilka som är stubbar.

| Modul | Innehåll |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | De vanliga funktionerna; datafunktioner som `sublist/2,3`, `flatten/1,2`, `sort/1`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2` är inbyggda funktioner i runtime; varje dokumenterad funktion är implementerad ([modulen lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Varje dokumenterad funktion; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... är inbyggda funktioner i runtime, funktionerna som tar funs är Erlang ([modulen maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Varje dokumenterad funktion; listgenomgångarna är inbyggda funktioner i runtime, funktionerna som tar funs är Erlang ([samlingar](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Varje dokumenterad funktion; den gregorianska aritmetiken som inbyggda funktioner i runtime, lokal tid och RFC 3339 i Erlang ([calendar](builtins.md#calendar)) |
| [`proc_lib`](../library/stdlib/proc_lib.erl), [`sys`](../library/stdlib/sys.erl) | Varje dokumenterad funktion: skapande av processer med förfäder och initiala anrop, synkrona starter (`init_ack`, `init_fail`), etiketter, `stop/1,3`, kraschrapporter och deras text; systemmeddelandeprotokollet och felsökningsalternativ (`trace`, `log`, `statistics`, `log_to_file`, installerade funs) med OTP:s former för felsökningslistor |
| [`gen_server`](../library/stdlib/gen_server.erl), [`gen_statem`](../library/stdlib/gen_statem.erl), [`gen_event`](../library/stdlib/gen_event.erl), [`gen_fsm`](../library/stdlib/gen_fsm.erl), [`gen`](../library/stdlib/gen.erl) | Varje dokumenterad funktion i Erlang ovanpå `proc_lib` och `sys`, med OTP:s meddelanden (`'$gen_call'` med aliastaggar, `'$gen_cast'`, ...), återanropsresultat och åtgärder, samlingar av begärans-id:n, feltermer och rapporttexter; `gen` innehåller det de delar |
| [`supervisor`](../library/stdlib/supervisor.erl), [`supervisor_bridge`](../library/stdlib/supervisor_bridge.erl) | Varje dokumenterad funktion: OTP:s barnspecifikationer och fel, strategier, omstartsintensitet, regler för avslutning, `simple_one_for_one`-barn och automatisk avslutning, som en `gen_server` |
| [`logger`](../library/kernel/logger.erl), [`logger_formatter`](../library/kernel/logger_formatter.erl), [`logger_std_h`](../library/kernel/logger_std_h.erl), [`logger_filters`](../library/kernel/logger_filters.erl), [`logger_handler`](../library/kernel/logger_handler.erl) | Varje dokumenterad funktion i Erlang: primär-, hanterar- och proxykonfiguration med OTP:s kontroller och feltermer, modulnivåer, processmetadata, filter, makrona `?LOG_*` i [`kernel/include/logger.hrl`](../library/kernel/include/logger.hrl), formateringsmallar och den äldre rubriken, `logger_std_h` på enheter och filer med rotation, komprimering och `filesync/1`, `logger_disk_log_h` på diskloggar av typerna halt och wrap (båda ovanpå [`clause_logger_h`](../library/kernel/clause_logger_h.erl), OTP:s gemensamma hanteraralternativ och kontroller). Servern `logger` är Clauses [`clause_logger`](../library/kernel/clause_logger.erl), som startas vid första användningen med OTP:s standardhanterare på `standard_io` (miljövariabeln `CLAUSE_LOGGER_TYPE=standard_error` flyttar den till standard-fel, som golden-köraren gör för att matcha goldens skapade med OTP:s hanterare där); applikationsnivåer behöver `application` |
| [`disk_log`](../library/kernel/disk_log.erl), [`wrap_log_reader`](../library/kernel/wrap_log_reader.erl), [`clause_disk_log`](../library/kernel/clause_disk_log.erl), [`clause_disk_log_server`](../library/kernel/clause_disk_log_server.erl) | Varje dokumenterad funktion i Erlang: halt-, wrap- och rotate-loggar, interna och externa, med OTP:s filformat (logghuvuden, postramar med MD5 för stora poster, wrap-index- och storleksfiler, rotate-arkiv), så filerna är byte för byte som OTP:s; en process per logg med ägare, användare, aviseringar, blockering med köade begäranden, framåtblickande loggning, en skrivcache som töms efter storlek och timer, reparation, skrivskyddade block som räknar felaktiga byte; registerservern `disk_log_server` med de namngivna tabellerna `disk_log_names` och `disk_log_pids`; `wrap_log_reader` ovanpå samma blockläsare |
| [`error_logger`](../library/kernel/error_logger.erl), [`error_logger_file_h`](../library/stdlib/error_logger_file_h.erl), [`log_mf_h`](../library/stdlib/log_mf_h.erl) | Varje dokumenterad funktion: meddelanden och rapporter som logghändelser med OTP:s `error_logger`-metadata, rapporthanterare på händelsehanteraren `error_logger` som matas av logghanteraren `error_logger`, `logfile/1` med den gamla rapporttexten, wrap-filer med OTP:s index- och record-format |
| [`pg`](../library/kernel/pg.erl), [`data_publisher`](../library/kernel/data_publisher.erl) | Varje dokumenterad funktion: omfång som `data_publisher`-servrar med OTP:s ETS-tabeller, anslutningar, utträden, medlemmar som avslutas, omfångs- och gruppmonitorer; omfånget har inga jämlikar |
| [`global`](../library/kernel/global.erl), [`global_group`](../library/kernel/global_group.erl) | Varje dokumenterad funktion som på en nod som inte är distribuerad: namn (även `{global, Name}` i beteendena), lås och transaktioner ovanpå en `global_name_server` som startas vid första användningen; `global_group` utan grupper; låsprocessen och de interna distributionsdelarna avböjda |
| [`rpc`](../library/kernel/rpc.erl), [`erpc`](../library/kernel/erpc.erl) | Varje dokumenterad funktion: anrop till denna nod körs i skapade processer (`rex` startas vid första användningen) med OTP:s resultat och fel; andra noder är nere (`{badrpc, nodedown}`, `{erpc, noconnection}`) |
| [`net_adm`](../library/kernel/net_adm.erl), [`net_kernel`](../library/kernel/net_kernel.erl), [`auth`](../library/kernel/auth.erl), [`seq_trace`](../library/kernel/seq_trace.erl) | OTP:s svar för en nod som inte är aktiv (`pang`, `ignored`, `#{started => no}`, `nocookie`); `net_kernel:start/1,2` och distributionens interna delar avböjda; `seq_trace` behåller varje process token utan spårning |
| [`trace`](../library/kernel/trace.erl), [`erl_tracer`](../library/erts/erl_tracer.erl) | Spårning stöds inte: varje `trace`-funktion och `erl_tracer`:s standardspårare (`enabled/3`, `trace/5`) kastar `notsup`, som erlangs spårningsfunktioner gör ([modulen erlang](builtins.md#erlang-module)); `erl_tracer:behaviour_info/1` listar OTP:s återanrop |
| [`error_handler`](../library/kernel/error_handler.erl) | Funktionerna för odefinierade anrop, direkt anropbara; runtime kastar själv `undef` och anropar dem aldrig; `breakpoint/3` avböjd (ingen tolk) |
| [`timer`](../library/stdlib/timer.erl) | Varje dokumenterad funktion utan OTP:s timerserver: tidsstyrda sändningar till lokala pid:ar är `erlang:send_after/3`, varje annan timer en egen process som nås genom ett alias i dess `TRef`; konverteringarna och `now_diff/2` är inbyggda funktioner i runtime ([timer](builtins.md#timer)) |
| [`filelib`](../library/stdlib/filelib.erl), [`clause_filelib`](../library/stdlib/clause_filelib.erl) | Varje dokumenterad funktion: jokertecken kompileras och matchas av inbyggda funktioner i runtime med OTP:s regler, egenheter och fel, kataloggenomgången, frågor, `ensure_dir/1`, `ensure_path/1`, `fold_files/5,6`, `find_file/2,3`, `find_source/1,2,3` (kernels `source_search_rules` eller OTP:s standardvärden) och `safe_relative_path/2` i Erlang; även de odokumenterade formerna som tar en modul (`file`, `erl_prim_loader` eller en annan), `compile_wildcard/1` (OTP:s felsökningshjälp) en stubbe ([filelib](builtins.md#filelib)) |
| [`file_sorter`](../library/stdlib/file_sorter.erl) | Varje dokumenterad funktion i Erlang: OTP:s delsekvenser (`size` byte sorterade i minnet), sammanslagningar (`no_files` temporära filer åt gången, block på 16 KiB, strömmar ordnade efter sina buffrade objekt och filnummer) och kontroller följs steg för steg, så termer som jämförs lika kommer ut och överlever `unique` som i OTP; formaten `binary_term`, `binary`, `term` och fun, `header`, `compressed` (genom `file`:s gzip-lager), `tmpdir`, indata- och utdata-funs, OTP:s feltermer |
| [`zip`](../library/stdlib/zip.erl) | Varje dokumenterad funktion i Erlang, följer OTP:s arkivlayout byte för byte (lokala och centrala huvuden skapade av UNIX 6.1, utökad tidsstämpel och extra UNIX uid/gid-fält, zip64 över 4 GiB, deflate-block på 8 KiB med fullständiga tömningar ovanpå `zlib`), så arkiven är lika OTP:s; filer eller binaries in och ut genom OTP:s indata- och utdata-funs, filter, `cwd`, `keep_old_files`, `skip_directories`, `foldl/3`, `zip_open/1,2`-arkiv betjänade av en länkad process, `t/1`, `tt/1`, OTP:s feltermer; records i [`stdlib/include/zip.hrl`](../library/stdlib/include/zip.hrl) |
| [`erl_tar`](../library/stdlib/erl_tar.erl) | Varje dokumenterad funktion i Erlang, följer OTP:s formatregler byte för byte: USTAR-huvuden, långa namn delas upp i ett prefix eller flyttas till utökade pax-huvuden (liksom långa namn eller namn utanför ASCII, länkar och ägarnamn, och tal för breda för oktal form), läsning av v7-, GNU- (långa namn och länkar, glesa filer), STAR-, USTAR- och pax-arkiv med OTP:s egenheter (bas-256-fält, pax-tider), `compressed` genom `file`:s gzip-lager, binaries lästa som `ram`-filer, enheter, `init/3` för användarens I/O-funs, `max_size`, `keep_old_files`, `files`, `cwd`, `verbose`, kontroller av osäkra sökvägar, OTP:s feltermer och `format_error/1` |
| [`zstd`](../library/stdlib/zstd.erl), [`clause_zstd`](../library/stdlib/clause_zstd.erl) | Varje dokumenterad funktion: komprimering och dekomprimering i ett anrop och som ström, parametrar, ordböcker (råa eller refererade), ramhuvuden och ordboks-id:n, i Erlang ovanpå inbyggda funktioner i runtime som håller libzstd 1.5.7-kontexter som OTP:s NIF gör ([zstd](builtins.md#zstd-module)); `file:open/2` tar `{zstd, Options}` |
| [`beam_lib`](../library/stdlib/beam_lib.erl), [`erl_abstract_code`](../library/stdlib/erl_abstract_code.erl) | Varje dokumenterad funktion i Erlang, följer OTP:s blockhantering: IFF-genomgången med OTP:s fel, atomtabeller i båda kodningarna, symboltabeller, attribut, kompileringsinformation, literaler, felsökningsinformation och abstrakt kod genom `erl_abstract_code`-bakänden, dokumentation (records i [`kernel/include/eep48.hrl`](../library/kernel/include/eep48.hrl)), MD5 över de betydelsebärande blocken, jämförelse och rensning av filer, kataloger och releaser, gzip-komprimerade beam-filer, `build_module/1` och kryptonyckelservern med dekryptering av felsökningsinformation (genom `crypto`, anropad dynamiskt: länka den med `--with-crypto`) |
| [`io_ansi`](../library/stdlib/io_ansi.erl) | Varje dokumenterad funktion i Erlang: OTP 29:s virtuella terminalsekvenser som de inbyggda ANSI-sekvenser OTP använder utan terminfo (terminfo-frågorna svarar `{error, enotsup}`), `format/1,2,3` och `render/1,2` ovanpå `io_lib`, `fwrite/1,2,3,4` som `put_ansi`-begäranden som servern för standard-indata renderar, `scan/1` och `enabled/0,1` från enhetens terminalflagga ([modulen io](builtins.md#io-module)) |
| [`win32reg`](../library/stdlib/win32reg.erl) | Varje dokumenterad funktion: OTP:s nyckeltolkning (rötter, absoluta, relativa och `..`-sökvägar), aktuell nyckel, heltals-, sträng- och binary-värden, listningar och borttagningar ovanpå Windows registerdrivrutin ([registret](ports.md#the-registry)); `{error, enotsup}` på andra plattformar, som OTP |
| [`argparse`](../library/stdlib/argparse.erl), [`clause_argparse`](../library/stdlib/clause_argparse.erl) | Varje funktion: validering med OTP:s fel, tolkning (alternativ, flaggor, `nargs`, åtgärder, typer med val, gränser och reguljära uttryck, anpassade typer, underkommandon, prefix, standardvärden) med OTP:s argument-maps och fel, `help/1,2` med OTP:s layout och mallar, `run/3` med varje hanterarform, som inbyggda funktioner i runtime som ber Erlang att anropa funs ([argparse](builtins.md#argparse)); utan `progname` programmets eget namn |
| [`escript`](../library/stdlib/escript.erl) | `create/2` och `extract/2` följer OTP:s sektionslayout och headerläsning (shebang-, kommentar- och emulatorargumentrader; källkod, beam- och arkivkroppar genom `zip`); `script_name/0` är den körbara filens sökväg; körning av escripts (`start/0,1`, `parse_file/1`) avböjd |
| [`filename`](../library/stdlib/filename.erl) | Varje dokumenterad funktion enligt OTP:s Unix- och Windows-regler för värden; namngenomgångarna är inbyggda funktioner i runtime, `absname/1,2` och `basedir/2,3` (från `HOME`, XDG-variablerna och `APPDATA`) är Erlang ([filename](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Varje dokumenterad funktion som inbyggd funktion i runtime: RFC 3986-tolkning med OTP:s felfragment, återsammansättning, normalisering, upplösning, procentkodning och form-urlencoded-frågor ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Varje dokumenterad funktion med OTP:s iodata, fel och återanropsordning; `decode/1`, `encode/1`, `format/1,2` och binary-escape-funktionerna är inbyggda funktioner i runtime, kodarna och formaterarna som tar funs och avkodarna med återanrop är Erlang ([kodningar](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Varje dokumenterad funktion med OTP:s tillstånd och sekvenser; OTP:s algoritmer körs som inbyggda funktioner i runtime, insticksgeneratorer i Erlang ([slumptal](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Varje dokumenterad funktion som inbyggd funktion i runtime, går igenom chardata som OTP:s `string.erl` så att resultaten behåller OTP:s former ([string](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Varje dokumenterad funktion som inbyggd funktion i runtime ([kodningar](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Varje dokumenterad funktion över OTP 29:s record; record-operationerna är inbyggda funktioner i runtime, fold- och mapfold-funktionerna är Erlang ([samlingar](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Varje dokumenterad funktion över OTP:s träd- och köformer; operationerna utan funs är inbyggda funktioner i runtime ([samlingar](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Varje dokumenterad funktion över OTP:s records (mängder av version 1) och maps (version 2); operationer utan funs är inbyggda funktioner i runtime ([samlingar](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (server för standard-indata eller en öppen fil), `fread/2,3` (en `get_until`-begäran ovanpå `io_lib:fread/3`), `read/1..4`, `scan_erl_exprs/1..4`, `scan_erl_form/1..4`, `parse_erl_exprs/1..4`, `parse_erl_form/1..4` (`get_until`-begäranden ovanpå `erl_scan:tokens/3,4`, tolkade av `erl_parse`), `request/1,2`, `requests/1,2` (OTP:s I/O-protokoll, [filer](ports.md#standard-io-and-files)), `getopts/0,1`, `setopts/1,2`, `columns/0,1`, `rows/0,1` (terminalstorlek ovanpå `clause_io`:s inbyggda funktioner), `get_password/0,1`, `write/1,2`; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` och `nl/0,1` är inbyggda funktioner i runtime ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Skrivare, kontroller, insamlingsfunktioner, formatmotorn, pretty printer (`print/1,4`, `~p`, `chars_limit`) och skannern (`fread/2,3`) som inbyggda funktioner i runtime med OTP:s djupa listformer, `maps_order`-funs som sorterar nycklar i `clause_io_lib`; `get_until`, `format_prompt` och `write/3` är Erlang ([io_lib](builtins.md#io_lib)) |
| [`sofs`](../library/stdlib/sofs.erl), [`clause_sofs`](../library/stdlib/clause_sofs.erl) | Varje funktion; dataoperationer är inbyggda funktioner i runtime, funktionerna som tar funs och digraph-konverteringarna är Erlang ([mängder av mängder](builtins.md#sets-of-sets)) |
| [`ets`](../library/stdlib/ets.erl) | Tabeller, läsningar, skrivningar, genomgångar och uppdateringar som inbyggda funktioner i runtime ovanpå runtime-tabellerna; `foldl/3`, `foldr/3`, `i/0..3` och `fun2ms/1` i Erlang; matchningsspecifikationer (familjerna select, match, match_spec) som inbyggda funktioner ovanpå runtimens tolk, `match_spec_run/2`, `test_ms/2`, `repair_continuation/2`, `match_delete/2` och `init_table/2` i Erlang; tabellfiler (`tab2file/2,3`, `file2tab/1,2`, `tabfile_info/1`) i Erlang ovanpå `file` och `clause_disk_log`; `to_dets/2` och `from_dets/2` i Erlang ovanpå `dets`; `table/1,2` i Erlang ovanpå `qlc:table/2` ([ets](builtins.md#ets)) |
| [`graph`](../library/stdlib/graph.erl) | Varje funktion ovanpå OTP:s record; frågorna och genomgångarna är inbyggda funktioner i runtime, uppdateringarna är Erlang ([graph](builtins.md#graph)) |
| [`digraph`](../library/stdlib/digraph.erl), [`digraph_utils`](../library/stdlib/digraph_utils.erl) | Varje funktion ovanpå OTP:s record med tre tabeller; uppdateringarna och läsningarna är Erlang ovanpå `ets`, sökningarna efter vägar och digraph_utils genomgångar är inbyggda funktioner i runtime som läser tabellerna, `subgraph/2,3` och `condensation/1` är Erlang ([digraph](builtins.md#digraph)) |
| [`dets`](../library/stdlib/dets.erl), [`clause_dets`](../library/stdlib/clause_dets.erl) | Varje dokumenterad funktion: OTP:s server- och tabellprocesser i Erlang ovanpå en C++-motor för OTP:s version 9-filformat, filer byte för byte som OTP skriver dem; `table/1,2` i Erlang ovanpå `qlc:table/2` ([dets](builtins.md#dets)) |
| [`ms_transform`](../library/stdlib/ms_transform.erl) | Varje funktion i Erlang ovanpå det abstrakta formatet: `parse_transform/2` översätter literala funs som ges till `ets:fun2ms/1` och `dbg:fun2ms/1` i en moduls former, `transform_from_shell/3` en skal-funs klausuler, med OTP:s matchningsspecifikationer, skuggningsvarningar och felkoder. En modul som använder transformeringen vid kompilering kör fortfarande värd-OTP:s `ms_transform` ([parse transforms](transforms.md)) |
| [`qlc_pt`](../library/stdlib/qlc_pt.erl), [`clause_qlc_pt`](../library/stdlib/clause_qlc_pt.erl) | qlc:s parse transform vid körning (odokumenterad i OTP): `transform_expression/2`, `transform_from_evaluator/2` och `parse_transform/2` som inbyggda funktioner i runtime med OTP:s genererade frågekod, meddelanden och annoteringar; `ms_transform` körs i Erlang på begäran ([qlc_pt](builtins.md#qlc-pt)). Kompilerade moduler som inkluderar `qlc.hrl` använder fortfarande värd-OTP:s transformering ([parse transforms](transforms.md)) |
| [`qlc`](../library/stdlib/qlc.erl) | Varje funktion i Erlang, skriven utifrån OTP:s dokumentation: frågehandtag för kompilerade frågor (OTP:s `qlc_lc`-handtag från transformeringen), listor, `table/2`-tabeller, `append/1,2`, `sort/1,2` och `keysort/2,3`; utvärdering med konstanta uppslagningar, matchningsspecifikationer, sammanslagnings- och uppslagningskopplingar, `cache` (`ets`, `list` som spiller över till temporära filer), `unique`, `file_sorter`-sorteringar, markörer som processer, `info/1,2` ovanpå `erl_pp`, `string_to_handle/1,2,3` ovanpå `qlc_pt`, OTP:s feltermer och `format_error/1`. Handtag, tabeller, processordboksnycklar och temporära filnamn är OTP:s. [`stdlib/include/qlc.hrl`](../library/stdlib/include/qlc.hrl) anger transformeringen `qlc`, som körs på värdens OTP ([qlc](builtins.md#qlc)) |
| [`shell`](../library/stdlib/shell.erl), [`clause_shell`](../library/stdlib/clause_shell.erl), [`clause_shell_eval`](../library/stdlib/clause_shell_eval.erl), [`clause_shell_commands`](../library/stdlib/clause_shell_commands.erl), [`clause_shell_records`](../library/stdlib/clause_shell_records.erl) | Varje dokumenterad funktion i Erlang, skriven utifrån OTP:s dokumentation: det interaktiva skalet på standard-indata ([interaktivt skal](#interactive-shell)): OTP:s promptar, starttext, historik (`e/1`, `v/1`, `h/0`), bindningar, records (`rd`, `rr`, `rl`, `rp`, `rf`), funktioner, typer och specs definierade vid prompten, undantagsrapporter ovanpå `erl_error`, resultat utskrivna som OTP skriver dem (djup 30, records), begränsade skal, `catch_exception/1` och inställningsfunktionerna |
| [`shell_default`](../library/stdlib/shell_default.erl), [`c`](../library/stdlib/c.erl) | Varje funktion: `c`:s kommandon med OTP:s utdata (`i/0`, `regs/0`, `m/0,1`, `ls/0,1`, `flush/0`, `help/0`, ...); kompilering (`c/1,2,3`, `lc/1`, `nc/1,2`), `xm/1` och `y/1,2` rapporterar det misslyckade anropet som OTP gör utan compiler, tools eller parsetools; `h/1,2,3` hittar ingen dokumentation i länkad kod; felsökarens `i`-kommandon rapporterar den saknade applikationen |
| [`edlin`](../library/stdlib/edlin.erl), [`edlin_expand`](../library/stdlib/edlin_expand.erl) | `edlin:keymap/0` (den anropande radredigerarens tangentkarta; `undefined` utanför en sådan); `edlin_expand:expand/1,2` i Erlang: komplettering av moduler, funktioner (`Mod:`, `fun Mod:Fun/`-ariteter), BIF:ar, skalkommandon, funktioner definierade i skalet, nyckelord, bindningar, record-namn och fält, map-nycklar och filsökvägar, med OTP:s sektioner och äldre matchningar; ett anrops argument föreslås som `Mod:Fun/Arity`-huvuden (länkad kod har inga specifikationer) |
| [`shell_docs`](../library/stdlib/shell_docs.erl), [`clause_shell_docs_markdown`](../library/stdlib/clause_shell_docs_markdown.erl) | Varje funktion i Erlang, skriven utifrån OTP:s dokumentation: `render/2..5`, `render_type/2..5` och `render_callback/2..5` av ett givet `docs_v1`-block (`application/erlang+html`, `text/markdown` konverterad som OTP:s skal konverterar den, andra `text/`-format som de är) med OTP:s layout, radbrytning, punkter och ANSI-stilar, `normalize/1`, `validate/1`, `supported_tags/0`; identisk med OTP över de 51,249 renderingarna av OTP 29:s egna dokumentationsblock. Länkad kod har inga egna block (`code:get_doc/1`) |
| [`erl_parse`](../library/stdlib/erl_parse.erl), [`clause_erl_parse`](../library/stdlib/clause_erl_parse.erl) | Varje funktion: `parse_form/1`, `parse_exprs/1`, `parse_term/1` och yecc:s `parse/1`, `parse_and_scan/1` ovanpå en runtime-tolk med OTP:s abstrakta format och fel; `normalise/1`, `abstract/1,2`, `tokens/1,2` och precedenstabellerna som inbyggda funktioner; annoteringsgenomgångarna och `format_error/1` i Erlang ([erl_parse](builtins.md#erl-parse)) |
| [`erl_eval`](../library/stdlib/erl_eval.erl), [`clause_erl_eval`](../library/stdlib/clause_erl_eval.erl) | Varje funktion i Erlang ovanpå det abstrakta formatet: bindningar som orddicts eller maps, lokala och icke-lokala funktionshanterare (operatorer, BIF:ar och fel som `erlang:raise/3`-anrop går genom den senare), tolkade funs med OTP:s miljö, comprehensions med strikta generatorer och zip-generatorer, `maybe`, native records, `receive` ovanpå `prim_eval`; mönstermatchning, bit-syntaxsegment och konstantvikning är inbyggda funktioner i runtime ([erl_eval](builtins.md#erl-eval)). `exprs/2` och `expr/2` kontrollerar ett kommando med `erl_lint:exprs_opt/3`; `qlc:q/1,2` av en frågelist-comprehension går genom `qlc:transform_from_evaluator/2` med lokala anrop dolda, som OTP:s |
| [`erl_error`](../library/stdlib/erl_error.erl) | Varje funktion i Erlang ovanpå `io_lib`: `format_exception/3,4` och de interna formaterarna (`format_exception/6,7,8`, `format_stacktrace/4,5`, `format_call/4,5`, `format_fun/1,2`) med OTP:s förklaringar, layouter, `error_info`-återanrop och alternativ. Clauses egna stackspårningar saknar platser eller `error_info` ([skillnader](differences.md#errors-stack-traces-and-reports)), så deras rapporter visar ingetdera |
| [`erl_pp`](../library/stdlib/erl_pp.erl), [`clause_erl_pp`](../library/stdlib/clause_erl_pp.erl) | Varje funktion; utskriften är en inbyggd funktion i runtime ([erl_pp](builtins.md#erl-pp)): former, attribut, typer och specs, funktioner, guards och uttryck med OTP:s layout (radbredd, indrag, strängdelar, precedensparenteser) och alternativ; hooks och `legalize_vars/1` körs här; identisk med OTP över formerna i 347 OTP-källfiler och testsviter, och över 80 av dem med fem uppsättningar alternativ, inklusive hooks |
| [`erl_lint`](../library/stdlib/erl_lint.erl), [`clause_erl_lint`](../library/stdlib/clause_erl_lint.erl) | Varje funktion; kontrollerna är inbyggda funktioner i runtime ([erl_lint](builtins.md#erl-lint)) med OTP:s fel, varningar, alternativ och ordning, och `format_error/1`-texter; beteendenas `behaviour_info/1` anropas här, och `is_guard_test/3` frågar först sin fun om de lokala anropen; identisk med OTP över 481 OTP-källfiler och testsviter, 474 svitfragment och 816 kommandouttryck |
| [`erl_expand_records`](../library/stdlib/erl_expand_records.erl) | `module/2` en inbyggd funktion i runtime ([erl_expand_records](builtins.md#erl-expand-records)): tupel-records expanderas till tupeloperationer, native och importerade native records behålls, import- och BIF-anrop får sin modul, `is_record/3`-guard-tester omvandlas till mönster, med alternativen `dialyzer`, `expand_inits` och `[no_]strict_record_tests`; identisk med OTP över formerna i 347 OTP-källfiler och testsviter |
| [`epp`](../library/stdlib/epp.erl), [`clause_epp`](../library/stdlib/clause_epp.erl) | Varje funktion i Erlang utom `-if`-villkoren, som utvärderas av en inbyggd funktion ([epp](builtins.md#epp)): en server per öppen källfil med OTP:s former, makron (argument, överlagring, `??Arg`, `?FUNCTION_NAME`, fördefinierade och de från alternativet `macros`), inkluderingar, villkor, `-file`, `-feature`, `-error`/`-warning`, dokumentationsfiler och fel; filer läses i sin helhet och avkodas enligt sin kodningskommentar. Identisk med OTP över 1,110 `parse_file`/`scan_file`-anrop på OTP-källfiler och testsviter. `-include_lib` hittar headrar enbart genom inkluderingssökvägen tills `code:lib_dir/1` |
| [`erl_scan`](../library/stdlib/erl_scan.erl) | Varje funktion: `string/1,2,3` och de återinträdesbara `tokens/3,4` ovanpå en runtime-skanner med OTP:s token, annoteringar, alternativ, återanrop och fel; åtkomstfunktioner och `format_error/1` i Erlang ([erl_scan](builtins.md#erl-scan)) |
| [`erl_internal`](../library/stdlib/erl_internal.erl), [`erl_anno`](../library/stdlib/erl_anno.erl) | Varje funktion som inbyggd funktion i runtime: OTP:s tabeller för BIF:ar, guards, typtester och operatorer, fördefinierade funktioner och annoteringar ([kompilatortabeller](builtins.md#compiler-tables)) |
| [`records`](../library/stdlib/records.erl), [`erl_features`](../library/stdlib/erl_features.erl) | Reflektion för native records, definitioner vid körning och kompilerade definitioner med vikta standardvärden ([native records](native-records.md#reflection)); OTP 29:s funktioner och de som varje modul kompilerades med ([kompilatortabeller](builtins.md#compiler-tables)) |
| [`binary`](../library/stdlib/binary.erl) | Varje funktion; `replace/3,4` och `list_to_bin/1` i Erlang, de övriga inbyggda funktioner i runtimen ([modulen binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Varje funktion som inbyggd funktion i runtimen ([modulen math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Varje funktion som inbyggd funktion i runtime: konverteringar, `bin_is_7bit/1`, byteordningsmärken, normalformer, kategorier och identifieraregenskaper ([modulen unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Varje funktion över genererade tabeller, chardata-genomgångarna som inbyggda funktioner i runtime ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Varje funktion utom `import/1`, ovanpå PCRE2 ([modulen re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Varje dokumenterad funktion: öppna, läsa, skriva, positionera och stänga filer (på disk, `compressed` eller i minnet med `ram`), positionerade läsningar och skrivningar, `truncate/1`, `advise/4`, `allocate/3`, läsning och skrivning av hela filer, `consult/1`, `eval/1,2`, `script/1,2` och deras `path_`-former med `path_open/3` (filen läses i sin helhet och avkodas enligt sin kodningskommentar, UTF-8 som standard, som `epp:set_encoding/1` gör i [`clause_epp`](../library/stdlib/clause_epp.erl), och skannas sedan form för form med OTP:s resultat och fel), filinformation och dess ändringar (`write_file_info/2,3`, `change_*`), katalogoperationer ovanpå fildrivrutinen, `sendfile/2,5` som OTP:s blockvisa reservlösning och `format_error/1` ([filer](ports.md#standard-io-and-files)) |
| [`erl_posix_msg`](../library/stdlib/erl_posix_msg.erl) | OTP:s interna modul för `file:format_error/1`: `message/1` som inbyggd funktion i runtime ([POSIX-meddelanden](builtins.md#posix-messages)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl), [`clause_socket`](../library/kernel/clause_socket.erl), [`clause_socket_options`](../library/kernel/clause_socket_options.erl) | Socketar ovanpå socketportar, med deras alternativ, statistik, status och listningar ([socketar](ports.md#sockets)); `inet:get_rc/0` från `clause_inet_config` |
| [`socket`](../library/kernel/socket.erl) | Varje dokumenterad funktion i Erlang ovanpå socketdrivrutinens portar ([socketar](ports.md#sockets)): `{'$socket', Ref}`-handtag hållna av en `clause_socket_registry`-process och tabell (ägare, tillstånd, räknare, meta, monitorer, listningar), open/bind/listen/accept/connect, send/sendto/sendmsg/sendv/sendfile/sendmmsg, recv/recvfrom/recvmsg/recvmmsg med OTP:s fel för partiella data, `nowait` som slutförandemeddelanden på Windows och select-meddelanden på andra plattformar, `cancel/2`, OTP:s alternativnamn och fel för ogiltiga värden, `info/0,1`, `i/0,1,2`, `supports/0,1,2`; SCTP-anrop kastar `notsup` och gränssnittsbegäranden avvisas, som OTP på Windows |
| [`gen_sctp`](../library/kernel/gen_sctp.erl) | Varje dokumenterad funktion: ingen SCTP, så `open/0,1,2` svarar `{error, eprotonosupport}` efter OTP:s alternativkontroller och de andra ser en stängd eller främmande socket; `error_string/1` har OTP:s texter |
| [`inet_res`](../library/kernel/inet_res.erl), [`clause_inet_config`](../library/kernel/clause_inet_config.erl) | Varje dokumenterad funktion i Erlang: OTP:s DNS-klient ovanpå `gen_udp` och `gen_tcp` (omförsök, alternativa namnservrar, EDNS, trunkering över TCP, servfail-väntetider, OTP:s fel, söklistor, CNAME-kedjor och hostents) med meddelanden kodade och avkodade av DNS-kodeken i `clause_net` ([nätverksnamn](builtins.md#network-names)); namnuppslagningskonfigurationen som OTP laddar den på en nod som inte är distribuerad (ingen på Windows; `resolv.conf` och hosts-filen på andra plattformar) |
| [`net`](../library/kernel/net.erl), [`clause_net`](../library/kernel/clause_net.erl) | Varje dokumenterad funktion: värd-, adress- och tjänsteuppslagningar och gränssnittslistorna som inbyggda funktioner i runtime med prim_net:s resultat, filtren i Erlang; inga nätverksnamnrymder ([nätverksnamn](builtins.md#network-names)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Clauses egen: protokollet för socketdrivrutinen som de tre modulerna ovan delar |
| [`os`](../library/kernel/os.erl) | `cmd/1,2` ovanpå en port med OTP:s skalprotokoll, `max_size` och `exception_on_failure`; frågor om miljö, tid och version, `find_executable/1,2` och `set_signal/2` som inbyggda funktioner ([modulen os](builtins.md#os-module)) |
| [`code`](../library/kernel/code.erl) | Frågor om laddade moduler utan kodserver; kodsökvägen i en persistent term med OTP:s sökvägsändringar, `lib_dir`/`priv_dir`-uppslagningar, `where_is_file/1`, `all_available/0`, `clash/0`; laddningssvar för länkad kod ([modulen code](builtins.md#code-module)) |
| [`application`](../library/kernel/application.erl), [`application_controller`](../library/kernel/application_controller.erl) | Varje dokumenterad funktion: laddning, nycklar, miljöer, starter med beroenden och startfaser, stopp, behörigheter och omstartstyper med OTP:s fel och rapporter, ovanpå en styrenhet som startas vid första användningen och [`clause_application_master`](../library/kernel/clause_application_master.erl) ([applikationer](#applications)); releasehantering, uppstart och distribuerad styrning avböjda |
| [`erlang`](../library/erts/erlang.erl) | Genererade stubbar för varje export i OTP 29:s `erlang`; katalogens inbyggda funktioner har platshållarkroppar, `nif_error/1,2` har kroppar, andra kastar `{not_implemented, F, A}` när de anropas ([modulen erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Ett startat systems svar; `boot/1`, `restart/0,1` och `make_permanent/2` avvisas ([modulen init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Varje funktion som inbyggd funktion i runtimen ([persistenta termer](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Varje funktion ([atomics och counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Det som `stdlib` och `kernel` anropar; grupperna för distribution, `.beam`, emulator och rensningsprocess avböjda ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Filfrågor ovanpå `file`; laddning och arkiv avböjda ([filer](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Varje funktion ovanpå den fastlåsta zlib ([modulen zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` ovanpå stegen i en kompilerad receive ([prim eval](builtins.md#prim-eval)) |
| `public_key`:s ASN.1-moduler (`'OTP-PKIX'`, `'PKIX1Explicit-2009'`, ...) och [`public_key.hrl`](../library/public_key/include/public_key.hrl) | Genererade vid byggning från [`library/public_key/asn1/`](../library/public_key/asn1) till byggträdets `library-asn1/public_key/` ([public_key](public_key.md)) |
| [`public_key`](../library/public_key/public_key.erl), [`clause_public_key_codec`](../library/public_key/clause_public_key_codec.erl), [`clause_public_key_keys`](../library/public_key/clause_public_key_keys.erl), [`clause_public_key`](../library/public_key/clause_public_key.erl) | Applikationen `public_key` (med [`public_key.app`](../library/public_key/public_key.app)): DER- och PEM-kodning, PEM-kryptering, privata PKCS #8-nycklar av varje typ och certifikat i plain- och otp-formerna ovanpå de genererade modulerna ([public_key](public_key.md#functions), [publik nyckel](builtins.md#public-key)); nycklar, signaturer, RSA-kryptering, nyckelgenerering och nyckelöverenskommelse, certifikatsignering ovanpå `crypto` (`clause_public_key_keys`, [nycklar](public_key.md#keys-and-signatures)); valideringsfunktionerna är stubbar |
| [`clause_asn1`](../library/asn1/clause_asn1.erl) | Kodeken som modulerna clau genererar från ASN.1-specifikationer anropar ([ASN.1-kodek](builtins.md#asn1-codec), [ASN.1](asn1.md)); OTP:s applikation `asn1` (`asn1ct`, `asn1rt_nif`) tillhandahålls inte |
| [`crypto`](../library/crypto/crypto.erl), [`clause_crypto`](../library/crypto/clause_crypto.erl) | Applikationen `crypto` (med [`crypto.app`](../library/crypto/crypto.app)), ovanpå OpenSSL:s libcrypto i runtime-arkivet för kryptografi ([modulen crypto](builtins.md#crypto-module), [OpenSSL](crypto.md)): algoritmlistorna som länkad OpenSSL har (`supports/0,1`, `hash_info/1`, `info/0`, `info_lib/0`), kondensat och hashtillstånd, HMAC/CMAC/Poly1305 och MAC-tillstånd, `pbkdf2_hmac/5`, `hash_equals/2`, `exor/2`, `mod_pow/3`, chiffer och deras tillstånd (`crypto_init/3,4`, `crypto_update/2`, `crypto_final/1`, `crypto_get_data/1`, `crypto_one_time/4,5`, `cipher_info/1`), AEAD (`crypto_one_time_aead/4,6,7`, `crypto_one_time_aead_init/4`), starka slumptal och `rand`-insticken `crypto`, `crypto_cache`, `crypto_aes` och `crypto_prng1`, OTP:s feltermer; motorer avvisas (`notsup`); FIPS-läge kan växlas som OTP:s, eller låsas med `clau --fips`; publika nycklar (`sign/4,5`, `verify/5,6`, RSA-kryptering, `generate_key/2,3`, `compute_key/4`, `privkey_to_pubkey/2`: RSA, DSA, DH, ECDSA/ECDH på namngivna och explicita kurvor, EdDSA, X25519/X448, ML-DSA, SLH-DSA, SRP), `ec_curve/1` och `ec_curves/0` (explicita parametrar från länkad libcrypto), ML-KEM (`encapsulate_key/2`, `decapsulate_key/3`) |

Resultat och felorsaker stämmer med OTP 29, inklusive felens form i OTP:s
Erlang-implementationer (`lists:map(F, x)` är `{case_clause, x}`,
`lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)` `badarg`) och i
dess BIF:ar (`lists:member/2`, `lists:keyfind/3`, `lists:reverse/2`,
`maps`-funktionerna: `badarg`, `{badmap, M}`, `{badkey, K}`).
`lists:member/2` matchar med `=:=`, `lists:keyfind/3` med `==`.
`lists:sort/1` är en stabil inbyggd funktion i runtime
([jämförelse och ordning](terms.md#comparison-and-order)).
Stackspårningar anger biblioteksfunktionerna, inte OTP:s.

## Interaktivt skal

`shell:start_interactive/0,1` startar Erlang-skalet på standardströmmarna, och
`clau --shell` länkar in det i en körbar fil vars ingångspunkt det är om inte
`--entry` anger en annan ([kompilera](compile.md#options)). Processen
`clause_shell` tar den plats som OTP:s `user_drv` har: den skriver ut
systemversionen, startar `shell`:s server och startar en ny när ett skal
avslutas (`exit().`). Servern läser varje kommando genom `io`:s server för
standard-indata med prompten utskriven på nytt för varje ytterligare rad i
ett kommando, behåller historiken och startar utvärderaren, som kontrollerar
varje uttryck med `erl_lint`, expanderar records och utvärderar det med
`erl_eval`. Resultat skrivs ut med skalets records genom runtimens pretty
printer (`clause_io_lib:pretty/2`, [io_lib](builtins.md#io-lib)). Slutet på
indata avslutar programmet med status 0 efter
`*** Terminating erlang (nonode@nohost)`.

Kommandon anropar moduler med namn, så ett program som startar skalet behöver
varje export anropbar: `--shell` behåller dem
([exporters livslängd](executables.md#export-liveness)) och länkar in varje
biblioteksmodul; ett program byggt utan det når bara de moduler det anger.
Indatarader läses som terminalen levererar dem, redigerade av terminalen
själv: det finns ingen `edlin`-radredigering, historiktangenter eller
tabbkomplettering ([skillnader](differences.md#interactive-shell)).

## Hur program får dem

- När en batch (positionella indata eller ett projektmål) anger en modul med
  en literal atom — `M:F(...)` med literal `M`, `fun M:F/A`,
  `apply(M, F, Args)` med literal `M`, `-behaviour(M)` eller
  `-import(M, ...)` — som inga indata definierar, letar kompilatorn efter
  `M.erl` i bibliotekets applikationskataloger och sedan i projektets
  `source_search_paths` ([projekt](projects.md#paths-and-discovery)), tolkar
  och kompilerar den första som hittas in i batchen och upprepar sedan för de
  moduler som de tillagda filerna anger
  ([vilken modul ett namn löses till](#which-module-a-name-resolves-to)). Ett
  anrop `M:F(...)` av en inbyggd funktion i katalogen (`io:format/2`,
  `os:type/0`) anger ingen modul. `--print-inputs` listar de indata som detta
  lägger till.
- Biblioteket är `library/` i byggträdet, som hittas relativt till `clau` på
  samma sätt som runtime-arkivet, med en katalog per OTP-applikation (`erts`,
  `kernel`, `stdlib`), sedan `library-asn1/` i byggträdet, modulerna som bygget
  genererar från bibliotekets ASN.1-specifikationer ([public_key](public_key.md)).
  `-include_lib("kernel/include/logger.hrl")`, `file.hrl`, `eep48.hrl` och
  `inet.hrl` (`#hostent{}`) löses till bibliotekets egna headrar om inte
  projektet anger en `kernel`-applikation; `stdlib/include/` `zip.hrl`,
  `qlc.hrl`, `ms_transform.hrl` (anger transformeringen, som körs på värdens
  OTP: [transformeringar](transforms.md)) och `assert.hrl` om det inte anger en
  `stdlib`-applikation. `assert.hrl` har OTP:s makron, feltermer och
  omkopplarna `NOASSERT`, `NODEBUG`, `ASSERT`. OTP:s interna headrar
  (`erl_bits.hrl`, `erl_compile.hrl`) och distributionsheadrar (`dist.hrl`,
  `dist_util.hrl`, `net_address.hrl`) tillhandahålls inte, inte heller
  `inet_sctp.hrl` (ingen SCTP).
- En modul i batchen med samma namn ersätter biblioteksmodulen, med en
  varning; inbyggda funktioner i katalogen med det namnet vinner ändå
  ([registrering](builtins.md#registration)).
- Biblioteksmoduler är vanliga batchmoduler: de länkas in i körbara filer och
  producerar, för objekt- eller IR-utdata, egna artefakter. De är Erlang-kod,
  så de lämnar ifrån sig körningen som annan kod.
- En modul som endast nås genom namn under körning (`M:F(...)` där `M` är en
  variabel) läggs inte till: ett sådant anrop kastar `undef` om inte något
  annat anger modulen.

## Ersättningar för runtime-moduler

Clause ersätter de OTP-moduler som ERTS implementerar i C (NIF:ar, BIF:ar,
portdrivrutiner, de förladdade modulerna i `erts/preloaded/src`) och moduler
som OTP genererar när det byggs (`unicode_util`). OTP:s `kernel` och `stdlib`
är vanlig Erlang men anropar dessa moduler.

### Tillhandahållen eller saknad

Allt som behöver runtimen och inte kan skrivas i vanlig Erlang avgörs per
modul, och per grupp av funktioner där en modul blandar ansvarsområden:

- **Tillhandahållen:** Clause levererar modulen med OTP 29:s exakta
  exportlista. Varje funktion har en av fyra statusar: `implemented` (en
  inbyggd funktion i runtimen eller en Erlang-kropp ovanpå befintliga
  runtime-tjänster), `refused` (returnerar eller kastar det som OTP:s
  anropare redan hanterar när en funktion saknas, till exempel
  `{error, enotsup}`), `stub` (kastar `error({not_implemented, F, A})` med
  `M:F/A` överst på stacken, som
  [`erlang`-stubbarna](builtins.md#erlang-module) gör; ännu inte klar) eller
  `declined` (en stubbe som blir kvar, med ett skäl som distribution eller
  kodladdning). En ny modul börjar med varje funktion som stubbe, så att den
  kan hittas och dess anropare kompileras; grupper flyttas sedan till sin
  beslutade status.
- **Platshållare för inbyggda funktioner:** en funktion som implementeras av
  en inbyggd funktion i katalogen behåller sin export och kroppen
  `F(_, ...) -> clause_builtin_placeholder.`, som aldrig körs: registreringen
  binder den inbyggda funktionen i dess ställe, och ett kvalificerat anrop
  `M:F(...)` kompileras till bryggan. Endast ett okvalificerat anrop inuti
  modulen skulle nå platshållaren, så modulen anropar sina egna inbyggda
  funktioner kvalificerat; `library_inventory` avvisar en platshållare som
  inte namnger någon inbyggd katalogfunktion, en inbyggd katalogfunktion som
  lämnats som `not_implemented`-stubbe och ett okvalificerat anrop till en
  platshållare.
- **Saknad:** Clause levererar ingen modul alls, möjligen för alltid, och
  registrerar varför och vilka Clause-moduler på högre nivå som tar dess
  anropares plats (`library/modules.terms`). Lågnivålagren för filer och
  socketar som heter `prim_*` (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) samt `socket` är de
  saknade modulerna: program använder i stället Clauses `file`, `gen_tcp`,
  `gen_udp`, `inet` och `net`, och eftersom Clause-moduler vinner över OTP:s (nedan)
  kommer OTP:s anropare av en saknad modul (OTP:s `gen_tcp_socket`,
  `inet_tcp`, ...) aldrig in i en batch. En saknad modul får aldrig en stubbe,
  så en referens till den är ett fel vid kompilering, aldrig en överraskning
  vid körning.

Funktioner som är triviala för runtimen implementeras utan ett separat beslut.

### Vilken modul ett namn löses till

OTP är valfritt på användarens maskin; när det finns får det inte ändra vad
ett bygge kompilerar. Ett modulnamn löses i denna ordning:

1. **Explicita indata:** källfiler som användaren listar (`sources`,
   `source_dirs`, positionella indata). En som har namnet på en
   Clause-modul ersätter den, med en varning som namnger båda filerna.
2. **Clause-moduler:** biblioteksmodulerna, inklusive tillhandahållna
   ersättningar.
3. **`source_search_paths`**, så som beskrivs i
   [projekt](projects.md#paths-and-discovery).

Namnet på en saknad modul är reserverat: en fil med samma namn på en
söksökväg (till exempel OTP:s `erts/preloaded/src/prim_file.erl`) används
inte, och diagnostiken säger att Clause inte tillhandahåller modulen. En
explicit indata kan ändå tillhandahålla den, med ersättningsvarningen.

`ignore_modules` gäller även Clause-moduler: en ignorerad Clause-modul saknas
i batchen, och en explicit indata kan då tillhandahålla den utan varning,
eftersom inget ersätts.

### Filer

- Biblioteksmoduler finns i `library/<application>/`, uppkallade efter den
  OTP-applikation som äger modulen i OTP: `erts` (förladdade motsvarigheter
  och `erlang`), `kernel`, `stdlib`. Clauses privata hjälpmoduler
  (`clause_socket`, `clause_re`, `clause_unicode`, `clause_zlib`,
  `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`,
  `clause_features`, `clause_io_lib`, `clause_disk_log`, `clause_dets`) ligger
  bredvid de moduler de betjänar.
  Biblioteksuppslagningen söker i varje applikationskatalog; ett modulnamn
  finns i högst en av dem.
- `library/modules.terms` listar varje modul som Clause fattar beslut om:
  `{Module, Application, provided}.` eller
  `{Module, Application, missing, "reason"}.` Kompilatorn läser den för att
  veta vilka namn som är Clause-moduler och vilka som är reserverade.
- Varje tillhandahållen modul har en inventering `<module>.terms` bredvid sig:
  `{Name, Arity, Group, Status}.` per export i OTP 29, sorterad efter namn och
  aritet, där `Group` namnger beslutsgruppen (till exempel `stdlib`,
  `distribution`, `beam`). `erlang.terms` behåller sitt eget format
  (`{Name, Arity, Flags, Status}`, [modulen erlang](builtins.md#erlang-module)).
- Exportlistor observeras från ett OTP 29 på värden
  (`M:module_info(exports)`); ingen OTP-källkod kopieras. Resultat och
  feltermer för implementerade funktioner stämmer med OTP 29; avsiktliga
  skillnader förs till [skillnader](differences.md).

### Dokumenterade funktioner

`library/documented.terms` listar de publika funktioner som OTP 29 dokumenterar
för `erts`, `kernel`, `stdlib`, `crypto` och `public_key`:
`{Module, Application, Name, Arity}.` per
funktion vars modul- och funktionsdokumentation inte är dold och som inte är
föråldrad, observerade från värd-OTP:s dokumentationsblock av
`tests/compiler/library/observe_docs.escript` (körs uttryckligen).
Odokumenterade exporter stannar i inventeringarna men får förbli stubbar.

- `library_inventory` kontrollerar att varje dokumenterad funktion i en
  tillhandahållen modul finns i dess inventering och inte är en stubbe, utom
  i modulerna som `library_modules.py` listar som partiella med det plan step
  som färdigställer dem.
- `python tests/compiler/library/library_modules.py coverage .` skriver ut
  varje dokumenterad moduls antal implementerade och dokumenterade funktioner.

### Typer

Eftersom Clauses moduler vinner över OTP:s måste OTP-kod som anger
`file:filename()` eller `erlang:time_unit()` i sina specs hitta de typerna i
Clauses moduler. Varje tillhandahållen modul vars OTP-motsvarighet exporterar
typer inkluderar `<module>.types.hrl` från sin egen katalog: listan
`-export_type`, sedan de exporterade typerna och de lokala typer och records
som de använder, så som OTP definierar dem (dokumentationen visar samma
definitioner; den installerade dokumentationen innehåller inga
typdefinitioner, så de kommer från implementationen: beam-filens
felsökningsinformation, eller den levererade källkoden för en förladdad modul
som `erlang`). `escript tests/compiler/library/observe_types.escript LIBRARY APP
MODULE` skriver headern från värdens OTP, och `--check` jämför dess former med
en ny observation (CTest `library_freshness`); `library_modules.py check`
kräver att varje header inkluderas av sin modul. Typer som headrarna anger från
moduler utanför programmet (`unicode:chardata()`, `calendar:datetime()`) och
OTP:s breda unioner (`file:posix()` har fler medlemmar än typgrafen behåller)
löses till `term()` utan varning: diagnostiken hör till Clauses bibliotek,
inte till användarens program.

### Kärntjänster vid uppstart

OTP:s `file`, `io` och `code` anropar registrerade servrar (`file_server_2`,
`code_server`, en gruppledares io-server) som applikationen `kernel` startar
vid uppstart. En körbar fil från Clause startar ingen av dem: Clauses egna
`file` och `io` behöver ingen server, Clauses `logger` startar sin server vid
första användningen, och en OTP-modul som behöver en misslyckas på samma sätt
som den misslyckas i OTP utan den servern (`noproc`). OTP-kod som anropar
`code` under körning fungerar därför inte. Att starta hela applikationen
`kernel` är inte planerat.

### Applikationer

- Specifikationer kommer från programmet, inte en kodsökväg: clau kompilerar
  varje `*.app` och `*.app.src` bredvid batchens källfiler, varje `*.app` i
  katalogen `ebin` intill dem, och `ebin/Name.app` eller `src/Name.app.src` för
  varje post i `[targets.options.applications]` till den genererade modulen
  `clause_applications`, som läggs till när batchen har
  `application_controller`. Den första filen för ett applikationsnamn vinner.
  En resurs som inte listar några moduler får batchens moduler bredvid sig.
  Diagnostik pekar in i resursfilen.
- `application:load/1` tar även termer av formen `{application, Name, Keys}`.
  Ett namn utan resurs ger `{error, {"no such file or directory", "Name.app"}}`,
  som OTP svarar för en saknad fil.
- `kernel` (11.0.4) och `stdlib` (8.1) är laddade och körs från start som
  OTP 29.1.1 listar dem, utan applikationsmasterprocesser; `kernel` har
  standardmiljön från sin `kernel.app`.
- En applikation med en startmodul får en masterprocess som leder dess
  processgrupp (så att `get_application/0`, `get_env/1` och `start_type/0`
  svarar inuti den), vidarebefordrar dess I/O-begäranden till standard-I/O,
  och vid stopp kör `prep_stop/1`, stänger av topprocessen, kör `stop/1` och
  dödar det som återstår av gruppen. En permanent applikation som avslutas,
  eller en transient som avslutas onormalt, stoppar programmet med OTP:s
  slutmeddelande, slutstatus 1.
- `logger` och `clause_logger` når `application` genom ett namn vid körning,
  så endast program som använder `application` länkar in den.

### Liggare

Projektplanen schemalägger varje dokumenterad modul i `erts`, `kernel` och
`stdlib`; verkliga program (luerl först) sätter prioriteringarna. Kompilera och kör det,
klassificera varje fel (`unknown module`, `undefined function M:F/A`, syntax
eller funktion som inte stöds, annat) och tilldela vart och ett ett plan step,
en annan post i eftersläpningen eller ett registrerat avböjande. Med
körningens stderr sparad i en fil skriver
`python tests/compiler/library/library_modules.py report FILE` ut
klassificeringen som tabeller: varje okänd modul med sitt antal fel,
anropande moduler och anropade funktioner med ariteter; odefinierade
funktioner per modul; andra meddelanden med sina antal.

### Verktyg

Alla finns i `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` skriver
  `LIBRARY/APP/MODULE.terms` från värd-OTP:s `MODULE:module_info(exports)`,
  och behåller grupp och status för varje post som redan finns där; en ny
  export börjar som `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` skriver modulfilen
  en gång, med varje export som stubbe; därefter redigeras filen för hand.
- `python library_modules.py check ROOT` (CTest `library_inventory`, inget
  OTP) rapporterar varje oöverensstämmelse: en tillhandahållen modul utan sina
  filer, en saknad modul med en fil, en inventering som inte listas som
  tillhandahållen, en export som inte finns i inventeringen eller omvänt, en
  `stub`/`declined`-post som inte är en `not_implemented`-stubbe, en
  `implemented`/`refused`-post utan kropp eller inbyggd funktion i katalogen.
  `library_rejects` bevisar det på ett avsiktligt inkonsekvent
  fixturbibliotek.
- CTest `library_freshness` (etiketterna `host_otp`, `full_only`) observerar
  varje inventering på nytt och kräver att den är oförändrad, och observerar,
  genererar, kontrollerar och kompilerar sedan en ny modul från början till
  slut. `library_report` kör `clau` på ett fixturprogram och kontrollerar
  rapportens rader.
