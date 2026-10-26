---
source: docs/differences.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d23f82e2b75a7d8717057d09d1a6e30555fb75f81b5e810be0aaa9fc83a5b22c
translatedAt: 2026-10-26
---
# Skillnader mot Erlang/OTP

Observerbart beteende där Clause medvetet skiljer sig från den fastlåsta OTP 29
(`maint-29`, se [otp-reference.md](otp-reference.md)). Varje post länkar till
det kontrakt som äger den. Ta bort en post när skillnaden är åtgärdad.
Funktioner som ännu inte är implementerade (rapporteras som `notimpl`) listas
inte här; se [features.md](features.md) och planen.

## Maps

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Ordning för map-generatorer (`K := V <- M`) | Platta maps (upp till 32 nycklar) itereras i nyckelordning, men atomnycklar i atomtabellens ordning, som varierar mellan VM-körningar; större maps i hashordning | Alltid kanonisk nyckelordning (termordning) | [mönster](patterns.md#comprehensions) |
| `bad_generators`-nyttolast för en map-generator i en zip-grupp | Dess iterator: en `{K, V, Next}`-kedja som slutar i `none`, i OTP:s ordning | Samma kedja, byggd i kanonisk nyckelordning | [mönster](patterns.md#comprehensions) |
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3`, ordningen som `maps`-funs körs i (`intersect_with/3`, `merge_with/3`, ...), `proplists:get_keys/1`, `sets` av version 2 (`to_list/1`, `fold/3`) | Intern ordning (atomtabellordning för atomnycklar, hashordning över 32 nycklar); en iterator är en position eller en `{K, V, Next}`-kedja | Kanonisk nyckelordning; en iterator fortsätter över en nyckellista | [inbyggda funktioner](builtins.md#erts-internal) |
| Utskrift av maps (`erlang:display/1`, `~w`, `~p`) | Intern layoutordning (atomtabellens ordning för atomnycklar, hashordning över 32 nycklar) | Map-nyckelordning, som OTP:s `~kw` | [termer](terms.md#printing) |
| Ordning för `digraph:vertices/1`, `edges/1`, `source_vertices/1`, `sink_vertices/1` samt för ordningar och komponenter i `digraph_utils` som utgår från dessa listor | Nod- och kanttabellernas hashordning | Clauses hashordning ([ETS](#ets)); vägar och grannlistor följer kantinsättningen i båda | [inbyggda funktioner](builtins.md#digraph) |
| Ordningen för `maps:keys/1`, `values/1`, `to_list/1`, `fold/3`, medlemmarna som `json:encode/1` skriver, fälten som `erl_parse:abstract/1,2` ger en map samt nodlistor och traverseringar i `graph` | Mapens interna ordning (atomtabellsordning för atomnycklar, hashordning över 32 nycklar) | Nyckelordning | [bibliotek](library.md) |
| Utskrift av native records (`erlang:display/1`) | Fält i atomtabellens indexordning | Definitionsordning, som `~w` | [native records](native-records.md#printing-and-order) |
| `==` mellan native records vars fält skiljer sig endast som heltal/flyttal | Kompilatorn kan vika det till `=:=` (falskt) | Numerisk jämförelse (sant) | [native records](native-records.md#printing-and-order) |
| Extern konstruktion av ett native record från en modul som inte är laddad | Misslyckas tills den definierande modulen laddas | Varje modul i batchen laddas vid uppstart; en modul utanför batchen misslyckas alltid | [native records](native-records.md#differences-kept) |
| Utskrift av lokala funs (`#Fun<M.Index.Uniq>`) | Index från kompilatorns lambdanumrering, `Uniq` en hash av modulens kod | Index bland modulens lokala funs i källkodsordning, `Uniq` alltid 0 | [funs](funs.md#comparison-and-printing) |
| Ordning mellan två lokala funs i en modul | Enligt OTP:s index | Enligt index i källkodsordning, så funs från olika funktioner kan ordnas annorlunda | [funs](funs.md#comparison-and-printing) |
| Namn på anonyma funs i stackspårningar (`-f/1-fun-N-`) | `N` från kompilatorns numrering | `N` räknar funs i `f/1` i källkodsordning | [funs](funs.md#closures) |
| En anonym fun i ett standardvärde för ett record-fält | Varje konstruktionsställe expanderar en egen kopia: funs från två ställen är olika | En fun för standardvärdet: funs från alla konstruktionsställen är lika | [funs](funs.md#closures) |
| Ordning för infångade värden i funs som skapas i comprehensions | Fria variabler i comprehensionens genererade funktion | Definitionsordning i den omslutande funktionen; syns endast när två sådana funs jämförs | [funs](funs.md#closures) |

## Pids, referenser och processer

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Engångs- och intervalltimers i `timer` utom sändningar till lokala pids | Körs av processen `timer_server`, som startas under `kernel_sup` vid första användningen; signalerna från `exit_after/2,3` kommer från den | Ingen timerserver: varje timer är en egen process som skickar signalen från `exit_after`; `cancel/1` returnerar innan processen har sett avbrytandet | [inbyggda funktioner](builtins.md#timer) |
| Pid-nummer | Den första användarprocessen är ungefär `<0.80.0>`; nummer återanvänds när pid-tabellen slår runt | Den första processen är `<0.1.0>`; nummer kommer från en enda sekvens och återanvänds aldrig | [termer](terms.md#pids-and-references) |
| Kod efter `spawn(Fun)` av en fun med annan aritet | Kompilatorns typanalys kan betrakta koden efter anropet som onåbar och ta bort den, så att anroparen genast returnerar pid:en | Anroparen fortsätter; endast den nya processen misslyckas med `{badarity, {Fun, []}}` | [processer](processes.md#builtins) |
| Stacken för en `function_clause` som en inbyggd funktion i `lists` ger (`lists:sublist/2`, `lists:max/1`, ...) | Den översta ramen är Erlang-funktionen, ofta en intern hjälpfunktion (`lists:sublist_2/2`), med dess argument | Anroparen ligger överst: inbyggda funktioner lägger inte upp någon ram | [inbyggda funktioner](builtins.md#lists-module) |
| Sista biten i resultat från `math` (`math:erfc(1)`, ...) | Det C-bibliotek som OTP byggdes med | Det C-bibliotek som Clause-program länkar (Windows: `0.15729920705028513` för `erfc(1)`, OTP `0.1572992070502851`) | [inbyggda funktioner](builtins.md#math-module) |
| Resultatet av `binary:compile_pattern/1` | `{bm, Ref}` eller `{ac, Ref}` med en ogenomskinlig referens | `{bm, [Pattern]}` eller `{ac, Patterns}` | [inbyggda funktioner](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` för en sub-binary | Storleken på den binary den pekar in i | Dess egen storlek | [inbyggda funktioner](builtins.md#binary-module) |
| Minne för ersatta eller raderade persistenta termer | Återvinns av en insamlarprocess för literalområden som får varje process att kopiera ut värdet i bakgrunden | Varje process kopierar ut det vid nästa tidskvantum (parkerade direkt, av `put`/`erase`), sedan frigörs området; ingen insamlarprocess | [runtime](runtime.md#persistent-terms) |
| Persistenta termer som skickas i meddelanden | Förblir delade, som literaler: mottagarens heap växer inte | Kopieras till mottagarens heap som alla andra termer | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` och `get/0` | Innefattar de termer som OTP:s `kernel` och `stdlib` lagrar vid uppstart (26 i OTP 29) | Endast programmets egna termer | [inbyggda funktioner](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` för en kompilerad modul | Den `.beam`-fil den laddades från | `preloaded`: varje modul är länkad in i den körbara filen | [inbyggda funktioner](builtins.md#code-module) |
| Alternativet `priority` till `send/3`, `link/2`, `exit/3`, `exit_signal/3` | Prioriterade meddelanden och signaler går före vanliga | Godtas; levereras som vanliga meddelanden och signaler | [processer](processes.md#builtins) |
| `spawn/2,4`, `spawn_link/2,4`, `spawn_monitor/2,4` som anger en annan nod | En varningsrapport `** Can not start ... on Node **` loggas | Ingenting skrivs ut; den oanvändbara piden avslutas ändå med `noconnection` | [processer](processes.md#builtins) |
| Flaggor för `system_flag/2` utom `backtrace_depth` och `min_heap_size` (`fullsweep_after`, `schedulers_online`, `multi_scheduling`, `max_heap_size`, ...) | Ändrar emulatorn | Kontrolleras och läses tillbaka utan effekt; `system_logger` börjar som `undefined` (ingen loggerprocess); `cpu_topology`, `erts_alloc`, `scheduler_bind_type` ger `badarg` | [inbyggda funktioner](builtins.md#system-information) |
| Timers för en suspenderad process (`receive ... after`, `send_after/3` och `start_timer/3` till dess pid) | Suspenderas med processen tills den återupptas (OTP 28, 29) | Fortsätter köras: en timeout som löper ut under suspenderingen hanteras när processen återupptas; ett timermeddelande väntar i dess brevlåda | [processer](processes.md#suspending-processes) |
| Utdata från `process_display/2` | OTP:s stackdump med adresser och stackplatser | En `Module:Function/Arity` per ram | [processer](processes.md#builtins) |
| `process_flag(save_calls, N)` | Sparar de senaste N anropen för `process_info(Pid, last_calls)` | Behålls och läses tillbaka; inga anrop sparas | [processer](processes.md#builtins) |
| `adler32_combine/3`, `crc32_combine/3` med en andra storlek över 2^31 - 1 på Windows | Kombineras | `badarg` (zlibs `z_off_t` är 32 bitar där) | [inbyggda funktioner](builtins.md#erlang-module) |
| `init:get_arguments/0`, `init:get_argument/1` | Emulatorns flaggor: `root`, `bindir`, `progname`, `home` och varje `-Flag` på kommandoraden | Endast `home`; en körbar fil har inga emulatorflaggor | [inbyggda funktioner](builtins.md#init-module) |
| `init:script_name/0`, `init:script_id/0` | Startskriptets sökväg och `{"Erlang/OTP", "29"}` | Den körbara filens absoluta sökväg och `{"Clause", "29"}` | [inbyggda funktioner](builtins.md#init-module) |
| `init:get_status/0`, `init:ensure_loaded/1` i ingången | `{starting, started}` och kodladdning medan `escript`-, `-s`- eller `-eval`-kod körs under uppstarten; `{started, started}` och `not_allowed` när systemet har startat | Alltid svaren för ett startat system | [inbyggda funktioner](builtins.md#init-module) |
| `init:stop/0,1`, `init:reboot/0` | Returnerar `ok`; `init` tar sedan ner applikationerna och stoppar, medan anroparen fortsätter köra | Stoppar direkt; anropet returnerar aldrig | [inbyggda funktioner](builtins.md#init-module) |
| `init:get_argument(home)` på Windows utan `HOMEDRIVE`/`HOMEPATH` | Skalets profilmapp | `USERPROFILE`, normalt samma mapp | [inbyggda funktioner](builtins.md#init-module) |
| `erlang:halt(Slogan)`, `init:stop(Slogan)` | Skriver ut sloganen, skriver `erl_crash.dump` i aktuell katalog och meddelar det på stderr; slutstatus 1 | Skriver ut sloganen på stderr, skriver ingen kraschdump; slutstatus 1 | [körbara filer](executables.md) |
| `init:restart/0,1`, `init:boot/1`, `init:make_permanent/2` | Startar om systemet i samma nod, startar det, eller anger startskriptet för nästa omstart | Avvisas: felet `notsup`, `{error, notsup}` från `make_permanent/2` | [inbyggda funktioner](builtins.md#init-module) |
| Aritet för `atomics:new/2` | Varje positivt heltal som allokeraren kan betjäna; ett enormt värde avslutar noden med en kraschdump | 1 till 2^27, annars `badarg` | [inbyggda funktioner](builtins.md#atomics-and-counters) |
| `counters` med `write_concurrency` | Räknare per schemaläggare som summeras vid läsning; minnet i `info/1` växer med antalet schemaläggare | En atomics-array; minnet i `info/1` är arrayens | [inbyggda funktioner](builtins.md#atomics-and-counters) |
| `erts_internal:term_type/1` | Den interna representationen: `flatmap` eller `hashmap`, `heap_binary`, `refc_binary` eller `sub_binary`, ... | Varje map är `flatmap`, varje bitstring `sub_binary` | [inbyggda funktioner](builtins.md#erts-internal) |
| `erl_prim_loader:get_path/0` | Uppstartens kodsökväg | `["."]` fram till `set_path/1` | [portar](ports.md#standard-io-and-files) |
| `file:read_link_info/1,2` för en symbolisk länk på Windows | Länkens egna reparse-point-data | Målets storlek och tider med typen `symlink` | [portar](ports.md#standard-io-and-files) |
| `inet:gethostbyname/1,2` | Resolverns kanoniska namn och alias (`inet_res`, hosts-filen, native) | Det efterfrågade namnet och inga alias; adresser från systemets resolver | [portar](ports.md#sockets) |
| Modulen `socket` | Socket-NIF-API:t | Saknas: en referens är ett kompileringsfel; använd `gen_tcp`, `gen_udp`, `inet` | [bibliotek](library.md) |
| `net:getifaddrs/1,2` med en namnrymd, `inet:getifaddrs([{netns, _}])` | `net` anropar sig själv utan slut (OTP 29); `inet` läser namnrymden på Linux | `{error, enotsup}` | [inbyggda funktioner](builtins.md#network-names) |
| Utdatalistor från `zlib` | En binary per intern del, nästlad där en ström avslutades och startades om | En binary per anrop, `[]` när det inte finns någon; byten är OTP:s | [inbyggda funktioner](builtins.md#zlib-module) |
| `zlib:safeInflate/2` och långa `zlib`-anrop | Returnerar efter en begränsad mängd utdata (`{continue, Output}`) och lämnar ifrån sig körningen | Packar upp all köad indata i ett anrop (`{finished, Output}`); ett långt anrop håller kvar sin schemaläggartråd | [inbyggda funktioner](builtins.md#zlib-module) |
| Långa `re`-matchningar | `re:run/3` och den globala loopen lämnar ifrån sig körningen efter en begränsad mängd arbete | En matchning körs till slut och håller kvar sin schemaläggartråd; en global körning lämnar ifrån sig endast mellan matchningar | [inbyggda funktioner](builtins.md#re-module) |
| `re:compile/2` med `export`, `re:import/1` | Ett exporterat mönster `{re_exported_pattern, ...}` som en annan nod importerar | `export` ger `badarg`; `import/1` ger `{not_implemented, import, 1}` | [inbyggda funktioner](builtins.md#re-module) |
| Argumentfel i `re` | `badarg` från `re:run/3` (eller `replace`, `split`) med anroparens argument och `error_info` | `badarg` från den `re`-hjälpfunktion som avvisade argumentet, med den hjälpfunktionens argument | [inbyggda funktioner](builtins.md#re-module) |
| `code:is_sticky/1` | `true` för moduler i `kernel`, `stdlib` och `compiler`, och för moduler i kataloger som `code:stick_dir/1` angett | Alltid `false`; `stick_dir/1` kontrollerar bara att katalogen kan listas | [inbyggda funktioner](builtins.md#code-module) |
| `code:root_dir/0` och den ursprungliga kodsökvägen | OTP:s installationskatalog; sökvägen innehåller dess `lib/*/ebin`-kataloger | Den körbara filens katalog; sökvägen innehåller `ebin`-katalogerna i `lib/` bredvid den och i `ERL_LIBS`, sedan `"."` | [inbyggda funktioner](builtins.md#code-module) |
| `code:load_file/1`, `load_abs/1`, `load_binary/3`, `atomic_load/1`, `prepare_loading/1` med giltig objektkod | Laddar modulen | `{error, badfile}`: varje modul länkas in i den körbara filen (D01) | [inbyggda funktioner](builtins.md#code-module) |
| `code:coverage_support/0` och täckningsfunktionerna | `true` med JIT; täckningslägen och räknare | `false`; de andra ger `badarg`, som OTP gör utan täckningsstöd | [inbyggda funktioner](builtins.md#code-module) |
| `code:get_doc/1` för en modul som programmet har | Dess dokumentationsblock enligt EEP 48 | `{error, missing}`: körbara filer bäddar inte in dokumentation | [inbyggda funktioner](builtins.md#code-module) |
| Formatering av en stor term (`io:format/1,2`) | Körs i Erlang-kod (`io_lib`) och i group leader, så processen kan avbrytas under formateringen | Körs till slut i ett enda anrop av en inbyggd funktion; andra processer väntar | [inbyggda funktioner](builtins.md#portions) |
| Flaggor till `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` med flera | Endast `trap_exit` och `min_heap_size`; alla andra flaggor ger `badarg` | [processer](processes.md#builtins) |
| Ordning för felrapporter från processer som kraschar samtidigt | Loggerns ordning | Den ordning i vilken deras arbetstrådar avslutar dem | [processer](processes.md#workers) |
| Exit-signaler (`exit/2`, `exit_signal/2`) till en process som körs på en annan schemaläggare | Köas i dess signalkö och hanteras senare, medan avsändaren fortsätter | Avsändaren väntar tills målets tidsskiva tar slut och agerar sedan direkt; observerbart endast som timing (meddelanden buffras och avsändaren fortsätter) | [processer](processes.md#workers) |
| `term_to_binary/1` av en lokal fun eller ett native record | Kodas (`NEW_FUN_EXT`, ...) | `error:notsup`; `fun M:F/A` kodas | [inbyggda funktioner](builtins.md#external-term-format) |
| `term_to_binary/1` av en map med fler än 32 nycklar | Hashordning om inte `deterministic` anges | Alltid nyckelordning (byten från `deterministic`) | [inbyggda funktioner](builtins.md#external-term-format) |
| `binary_to_term/1` av en annan nods pid, port eller referens; alternativet `local` till `term_to_binary/2` | Externa identiteter; kodningen `LOCAL_EXT` | `badarg` | [inbyggda funktioner](builtins.md#external-term-format) |
| Tidsgräns för timers | Beror på den nativa tidsenheten (ungefär 2^49.7 ms på Windows) | Relativ tid 0..2^49-1 ms på alla plattformar | [processer](processes.md#timers) |
| `unique_integer/0,1` utan `positive` | Kan vara negativt | Alltid positivt och växande | [inbyggda funktioner](builtins.md#time) |
| Posterna `current_function`, `initial_call`, `current_stacktrace`, ... i `process_info/2` | Rapporteras | `error:{notsup, Item}`; `process_info/1` utelämnar dem | [processer](processes.md#introspection) |
| `reductions` i `process_info/2`; `reductions`, `garbage_collection`, `io` i `statistics/1` | Räknas | 0 (hålls inte) | [inbyggda funktioner](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Samlar skräp innan anropet returnerar | Samlar skräp vid målets nästa safepoint | [processer](processes.md#introspection) |
| `erlang:system_info(machine)`, och därmed `?MACHINE` i `epp` och makrot det anger | `"BEAM"`, `'BEAM'` | `"Clause"`, `'Clause'` | [inbyggda funktioner](builtins.md#system-information) |
| `erlang:system_info(schedulers)` i ett program som startats med en affinitetsmask (`start /affinity`, `taskset`) | En schemaläggare per logisk processor på värden (32 med en mask för 7 CPU:er), `schedulers_online` en per CPU i masken | Båda en per CPU i masken: Clause startar bara de aktiva arbetstrådarna | [processer](processes.md#workers) |
| Inställningsalternativ för `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Tillämpas | Kontrolleras och godtas, tillämpas inte | [processer](processes.md#spawn-options) |
| `hibernate/3` | Kastar stacken; processen avslutas när `M:F` returnerar | Behåller stacken; resultatet av `M:F` returneras till anroparen av `hibernate/3` | [processer](processes.md#spawn-options) |
| `monitor(port, Item, Options)` med alternativ | Godtas | `badarg` | [processer](processes.md#aliases) |
| `spawn_request_abandon/1` | `true` medan svaret väntar | Alltid `false`: svaret skickas innan `spawn_request` returnerar | [processer](processes.md#spawn-options) |
| Sista biten i `math:log2/1` (Windows) | OTP:s Windows-bygge dividerar `log(X)` med `log(2)` (`math:log2(1.0e308)` är `1023.1538532253077`) | C-bibliotekets `log2` (`1023.1538532253076`) | [inbyggda funktioner](builtins.md#math-module) |
| `phash/2`, `phash2/1,2` för pids, portar, referenser, funs och native records | Hashar av OTP:s process-, port- och referensnummer, en funs index och unika nummer, en record-definitions hash | Hashar av Clauses nummer, en funs modul, aritet eller index och fångade värden, en records fältvärden; varje annan term hashas till OTP:s värde | [inbyggda funktioner](builtins.md#hashing) |
| `dict:fold/3`, `map/2`, `filter/2` med något som inte är en fun | `function_clause`, eller `{badfun, F}` när den första hinken OTP besöker innehåller en post | `function_clause` | [inbyggda funktioner](builtins.md#collections) |
| `erlang:is_builtin/3` för `lists:reverse/2` och andra biblioteksfunktioner implementerade i C | `true` | `false`: endast runtimens inbyggda funktioner och `apply/2,3` | [funs](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` från `fun_info/1,2` för en lokal fun | Skaparens pid, kompilatorns kontrollsummor | `undefined`, MD5 av modulnamnet | [funs](funs.md#fun-information) |
| Kontexten från `md5_init/0` | OTP:s tillstånd på 92 byte | Clauses tillstånd på 96 byte; sammandragen är lika | [inbyggda funktioner](builtins.md#hashing) |
| `erlang:delete_module/1` för en laddad modul | Gör dess kod gammal (`true`) | `error:notsup`: länkad kod ligger kvar | [inbyggda funktioner](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Förbereder en giltig BEAM-binary | Alltid `{error, badfile}` | [inbyggda funktioner](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | De förladdade uppstartsmodulerna | Varje modul i programmet | [inbyggda funktioner](builtins.md#code-loading) |
| `list_to_pid/1` av ett nummer som aldrig delats ut | Returnerar en pid-term | `badarg`: endast pids som detta program har skapat godtas | [termer](terms.md#pids-and-references) |
| `list_to_port/1` av ett nummer som aldrig delats ut | Returnerar en portterm | `badarg`: endast portar som detta program har öppnat godtas | [portar](ports.md#identity) |
| Värden från `port_info/1,2` | `id` är ett tabellindex; `memory`, `queue_size`, `locking` beskriver drivrutinen | `id` är portnumret; `memory` och `queue_size` är 0; `locking` är `port_level` | [portar](ports.md#builtins-and-port-messages) |
| Skrivning till en fil som öppnats endast för läsning | `{error, eacces}` på Windows, `{error, ebadf}` på andra system | `{error, ebadf}` överallt | [portar](ports.md#standard-io-and-files) |
| Porten i `win32reg` | Den inlänkade porten `registry__drv__` (`{spawn, "registry__drv__ rw"}`), som besvarar kommandon med portmeddelanden | Drivrutinen `clause_registry` (`{spawn_driver, ...}`), som ger samma svar via `port_control/3`; `port_info/2` anger namnet `clause_registry` | [ports](ports.md#the-registry) |
| Programnamnet i `argparse` utan alternativet `progname` | Emulatorns `progname` (`erl`) | Den körbara filens namn utan filändelse (`init` har inget `progname`) | [bibliotek](library.md) |
| Översta stackramen för ett fel vid kommandovalidering i `argparse` | Den validerande funktionen (`argparse:validate_command/2`, `validate_option/2`, en fun i dem) med `[Entity]` | `argparse:validate/2` med `[Entity]` | [inbyggda funktioner](builtins.md#argparse) |
| `escript:script_name/0` | Escriptets sökväg, det första vanliga argumentet | Den körbara filens sökväg: ett Clause-program är sitt eget skript | [bibliotek](library.md) |
| `escript:extract/2` med `compile_source` | Källkoden kompilerad till en beam | `{error, {compile, ...}}`: Clause-program har ingen kompilator | [bibliotek](library.md) |
| `erl_abstract_code:debug_info(core_v1, ...)` (Core Erlang i beam_lib) | Core Erlang från kompilatorn | `{error, failed_conversion}`: Clause-program har ingen kompilator | [bibliotek](library.md) |
| `zstd:get_frame_header/1` för ett avkortat ramhuvud | Fält från oinitierat minne | Fälten är noll (`'ZSTD_frame'`, storlekar 0) | [inbyggda funktioner](builtins.md#zstd-module) |
| `file:open/2` med `raw` eller `ram` | Ett `#file_descriptor{}` record som hanteras i anroparen (`is_pid/1` är falskt); `io`-begäranden till det misslyckas; en `ram`-fil saknar `read_line/1` (`undef`) och en stängd fil svarar `{error, einval}` | En filserver-pid som för andra filer; positionerad I/O och `sendfile/5` svarar som för OTP:s raw-filer; en `ram`-fil besvarar `read_line/1` och I/O-begäranden med `{error, enotsup}`, och `{error, terminated}` när den stängts | [ports](ports.md#standard-io-and-files) |
| `file:truncate/1` på en fil som öppnats endast för läsning | Plattformens fel (`eacces` på Windows, `einval` på andra system) | C-runtimens fel för deskriptorn (`ebadf` eller `einval`); servern stannar som i OTP | [ports](ports.md#standard-io-and-files) |
| Filer som öppnats eller ställts in på `{utf16, _}` eller `{utf32, _}` | Rader och tecken avkodas enligt kodningen | Rader slutar vid en byte med värdet 10 innan de avkodas | [ports](ports.md#standard-io-and-files) |
| Sekvenser från `io_ansi` på Linux och macOS | Från terminfo-databasen för `TERM` där den har förmågan (`setaf`, `sgr0`, ...); `tput/1,2`, `tigetnum/1`, `tigetflag/1`, `tinfo/0` läser den | De inbyggda ANSI-sekvenser OTP använder utan terminfo (som OTP på Windows); `tigetnum/1`, `tigetflag/1`, `tinfo/0` svarar `{error, enotsup}`, `tput/1,2` ger `{enotsup, Capability}`; `enabled/0,1` kräver ett annat `TERM` än `dumb` | [bibliotek](library.md#contents) |
| `io_ansi:scan/1` och `tput/1,2` på Windows | Misslyckas med `try_clause` på terminfos `{error, enotsup}` | `scan/1` matchar de inbyggda sekvenserna; `tput/1,2` ger `{enotsup, Capability}` | [bibliotek](library.md#contents) |
| `socket` på Windows: `recvmsg`, `sendmsg`, `sendfile`, `sendmmsg`, `recvmmsg` | Ger `notsup` | Fungerar som på Linux och macOS | [bibliotek](library.md#contents) |
| `socket` på Windows: ett datagram längre än längden för `recv` | `{error, {completion_status, ...more_data...}}` | Datagrammet avkortas, som på andra system | [bibliotek](library.md#contents) |
| `socket` på Linux och macOS: `ioctl/2,3,4`, `getopt_native/3`, `setopt_native/3`, `open/1,2` för en deskriptor, domänen `local`, SCTP | Stöds | Avvisas som OTP på Windows avvisar dem (`{error, {invalid, ...}}`, `notsup`); `local` ger `{error, eafnosupport}` | [bibliotek](library.md#contents) |
| `socket:info/1`, `i/0,1,2` | NIF:ens räknare och tillstånd, `fd` är deskriptorn | Räknare för gjorda anrop, tillstånd som modulen håller reda på; `Fd` är portnumret | [bibliotek](library.md#contents) |
| Svar från `inet_res` | Svar från `gethostbyname`, `getbyname` och `gethostbyaddr` cachas enligt TTL i `inet_db`; en cachad uppslagning kan lista adresser i en annan ordning | Ingenting cachas: varje uppslagning frågar namnservrarna | [bibliotek](library.md#contents) |
| Resolverkonfiguration på Linux och macOS | `inet_db` läser även `host.conf`/`nsswitch.conf` och `inetrc`-filer, följer ändringar i `resolv.conf` och härleder på Linux domänen från värdnamnet | Raderna `nameserver`, `domain` och `search` i `resolv.conf` samt hosts-filen, lästa en gång | [bibliotek](library.md#contents) |
| `os:set_signal(Signal, handle)` (Linux, macOS) | Signalen skickas till `erl_signal_server`, vars standardhanterare stoppar systemet vid `sigterm` och avslutar det vid `sigusr1` och `sigquit` | Ingen `erl_signal_server`: `sigterm` och `sigquit` avslutar med status 0, `sigusr1` med status 1, andra ignoreras; utan `set_signal` behåller `SIGTERM` systemets standardåtgärd | [ports](ports.md#subprocesses) |
| Tomma argument till `{spawn_executable, F}` på Windows | Tas bort från kommandoraden | Skickas som `""` | [portar](ports.md#subprocesses) |
| `{exit_status, S}` och `eof` från ett startat program | Ospecificerad ordning, `exit_status` kan komma före sista datat | Efter allt data, före `eof` | [portar](ports.md#subprocesses) |
| Upptagna portar | En port med för mycket köad utdata suspenderar avsändare, även socketportar; `force` i `port_command/3` fungerar på drivrutiner som tillåter det | Endast portar för startade program blir upptagna; `fd`- och socketportar blir det aldrig; `force` ger `notsup` på alla drivrutiner | [portar](ports.md#busy-ports) |
| `{active, N}` för socketar | Ett heltal `N` räknar meddelanden före `{tcp_passive, S}` | `exit(badarg)`; endast `true`, `false` och `once` | [portar](ports.md#sockets) |
| Socketalternativ i själva `inet_drv` (`header`, `deliver`, `exit_on_close`, `send_timeout`, `send_timeout_close`, `delay_send`, vattenmärken, `packet_size`, `show_econnreset`, `buffer`, `read_packets`, `recvtos`, `recvttl`, `line_delimiter`) | Tillämpas | Behålls och rapporteras av `getopts/2` med OTP:s standardvärden, tillämpas inte; systemets alternativ (`nodelay`, `keepalive`, `linger`, buffertar, `tos`, multicast, ...) tillämpas | [ports](ports.md#sockets) |
| Andra socketalternativ (`{packet, line \| http \| ...}`, `{raw, ...}`, `bind_to_device`, `netns`) | Fungerar | `exit(badarg)` vid öppning, `{error, einval}` från `setopts/2` och `getopts/2` | [ports](ports.md#sockets) |
| `inet:getopts(S, [multicast_if])` på Windows | Läser oinitierat minne för en TCP-socket, och den ospecificerade adressen efter att en UDP-socket ställt in en adress | Systemets värde; den ospecificerade adressen när socketen saknar en | [ports](ports.md#sockets) |
| `port_info(Socket, input \| output)`, `input` och `output` i `inet:info/1` | Byten i drivrutinens kommandon och svar | 0: sockettrafik räknas endast av `inet:getstat/1,2` | [ports](ports.md#sockets) |
| Felorsaker för socketar | Varje POSIX-orsak som systemet rapporterar | De vanliga (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); andra blir `eio` | [portar](ports.md#sockets) |
| Portindata medan den anslutna processen har 1 024 meddelanden och kan köras | Fortsätter läsa och leverera | Slutar leverera tills processens tidsskiva tar slut; över 64 KiB kvarhållet slutar den läsa, så det skrivande programmet blockeras | [portar](ports.md#busy-ports) |
| `gen_tcp:close/1` med köad utdata | Väntar upp till inställningen `linger`/`send_timeout` på att utdatan ska skickas | Returnerar direkt; I/O-tråden skickar den köade utdatan och stänger sedan | [portar](ports.md#sockets) |
| Typer för `monitor/2` | `process`, `port`, `time_offset` | `process` och `port`; `time_offset` ger `badarg` (inga ändringar av tidsförskjutning) | [processer](processes.md#monitors) |
| `exit/2`, `exit_signal/2` till en referens | Skickar till processaliaset, om referensen är ett aktivt sådant | Ingenting: exit-signaler går aldrig till alias | [processer](processes.md#exit-signals) |
| Referensnummer | Blandar en schemaläggaridentifierare och räknare per schemaläggare (`#Ref<0.178111994.4235460610.214105>`) | En enda räknare för hela programmet (`#Ref<0.0.0.1>`), så referenser ordnas efter skapandetid | [termer](terms.md#pids-and-references) |

## Fel, stackspårningar och rapporter

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Platser i stackspårningar | `[{file, F}, {line, L}]`, `error_info` för `error/3` | Alltid `[]`; ingen `error_info`, så `erl_error:format_exception/3,4` visar inga platser eller `*** argument`-rader för dem | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` med stackposter `{Fun, Args}` | Godtas | Avvisas | [ABI](abi.md#stack-traces) |
| Översta ramen för `function_clause` | Argumentlista | Aritet | [ABI](abi.md#stack-traces) |
| Översta ramen för `undef` vid ett anrop `M:F(A1, ..., An)` | `{M, F, [A1, ..., An], []}` | `{M, F, N, []}`: ariteten i stället för argumenten (`apply/3` och fun-anrop visar argumenten) | [funs](funs.md#dynamic-calls) |
| Dynamiskt anrop av en export som en körbar fil inte kan nå (dess modul namnges endast via en stackspårning, ett undantag eller ett meddelande utifrån programmet) | Anropar den | `undef`, om programmet inte byggts med `--keep-exports`; `function_exported/3` och `module_info(exports)` listar den ändå | [körbara filer](executables.md#export-liveness) |
| Ramar för BIF:ar/operatorer som misslyckas | Finns (`{erlang, '+', Args, ...}`) | Saknas; ingenting under ingångsfunktionen | [ABI](abi.md#stack-traces) |
| Full atomtabell (`list_to_atom/1`) | Emulatorn avbryter (`no more index entries in atom_tab`) och skriver en kraschdump | `clau: runtime failure: entry call failed: resource_limit`, slutstatus 70 | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` med tecken över 255 | De första siffrorna använder endast varje teckens låga byte (`[16#131]` är 1) | `badarg` | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` för en BIF | Sant för varje BIF i emulatorn | Sant endast för de inbyggda funktioner som denna runtime tillhandahåller | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| Felrapporter från kraschade processer | Skickas till loggern och skrivs senare av dess standardhanterare (på standardutdata under `erl`, går ofta förlorade när ett escript avslutas först) | Skrivs på stderr när processen avslutas, före senare utdata; ingen `logger`-händelse, så hanterare och filter ser den inte | [processer](processes.md#exits) |
| Anrop till funktioner som aldrig returnerar | Kompileras som svansanrop (anroparen saknas i spårningen) | Vanliga anrop (anroparen finns med) | [ABI](abi.md#stack-traces) |
| Undantag i en känd anonym fun vid `-O2` (`F = fun ... end, F(X)`, `lists:map(fun ... end, L)` och de andra listlooparna, `maps:fold(fun ... end, A, M)`) | Ramar för funen (`-f/1-fun-0-`) och hjälpfunktionerna i `lists` och `maps` (`lists:map_1/2`) | Funens kropp körs infogad i anroparen: dessa ramar saknas, och en oäkta listsvans i `map/2`, `foldl/3`, `all/2`, `any/2`, `flatmap/2` ger `function_clause` med anroparen överst | [funs](funs.md#inlined-funs) |
| Värdminnet är slut | Emulatorn rapporterar att den inte kan allokera minne, skriver en kraschdump och stoppar | `clau: runtime failure: entry call failed: out_of_memory`, slutstatus 70, ingen dump | [runtime-heap](runtime-heap.md#failure-behavior) |
| Lagring av maps med fler än 32 nycklar | En HAMT på heapen med hashade noder med 16 grenar | Ett B+-träd på heapen med upp till 16 poster per nod i nyckelordning; heapstorlekarna för stora maps skiljer sig från OTP:s | [runtime-heap](runtime-heap.md#map-trees) |
| Minnestak per process | `max_heap_size` (i ord, heap och stack) dödar processen med orsaken `killed` och loggar en felrapport | `--max-heap` / `--max-stack` (byte) och `--max-memory` för hela runtimen får den begärande processen att misslyckas som `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, slutstatus 70 | [runtime-heap](runtime-heap.md#runtime-memory-limit) |
| Programargument | `escript` skickar varje argument till `main/1`; emulatorflaggor (`+t`) kommer från `%%!` eller `ERL_FLAGS` | Inledande runtime-alternativ (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) plockas ut först; `CLAUSE_FLAGS` innehåller samma alternativ | [körbara filer](executables.md#runtime-options) |
| Ofångat undantag i en vanlig ingångsmodul | `escript` avslutar med 127 | Avslutar med 1 och en rad `uncaught exception <class>: <reason>` (escript-källor behåller 127) | [körbara filer](executables.md) |
| Kompilatordiagnostik | Formuleringar från `erl_lint` (`variable 'X' is unbound`) och varningar | Egna formuleringar (`unbound variable X`); OTP:s lint-varningar ges i regel inte (inte heller varningar för native records: okända fält vid åtkomst, uppdatering och i mönster, kvalificerad konstruktion i den egna modulen utan värden, oanvända eller header-definierade records; ett senare mönster som matchar ett namn exporterat från en gren) | [semantik](semantic.md#bindings) |
| Behaviour-modul med en handskriven `behaviour_info/1` | Anropar den när användarna kompileras och varnar för saknade, felaktigt definierade eller föråldrade callbacks | Utvärderas inte: användarnas callbacks kontrolleras inte | [semantik](semantic.md#behaviours) |
| Behaviour-moduler som varken finns i batchen eller i Clause-biblioteket (`application`, ...) | Laddas från kodsökvägen; deras callbacks kontrolleras | Varningen `behaviour M undefined` | [semantik](semantic.md#behaviours) |
| Standardhanteraren för `logger` | `logger_std_h` som skriver asynkront med överlastskydd (synkroniserings-, borttagnings- och tömningslägen, gränser för skurar, avslut vid överlast) | Även på `standard_io` (`standard_error` med `CLAUSE_LOGGER_TYPE=standard_error`), men varje händelse skrivs innan loggningsanropet returnerar; överlastalternativen kontrolleras och behålls utan effekt | [bibliotek](library.md) |
| Hanterarprocesser i `logger_std_h` | Övervakas av `logger_sup`, startas om efter `overload_kill_restart_after` | Länkade till `logger`-servern; en hanterare vars process dör tas bort | [bibliotek](library.md) |
| `net_adm:names/0,1` | Frågar epmd: `{ok, Names}` när en epmd körs på värden | `{error, address}`: Clause saknar epmd-klient | [bibliotek](library.md) |
| `net_kernel:start/1,2` | Startar distribution, eller ger OTP:s fel när det inte går | Inte tillgänglig (`not_implemented`) | [bibliotek](library.md) |
| Spårning: `erlang:trace/3`, `trace_pattern/2,3`, `trace_info/2`, `trace_delivered/1`, `system_monitor/0,1,2`, `system_profile/0,2`, `seq_trace/2`, `seq_trace_info/1`, `seq_trace_print/1,2`, `dt_*`, modulen `trace`, `erl_tracer:enabled/3`, `trace/5` | Spårar | `error:notsup` | [inbyggda funktioner](builtins.md#erlang-module) |
| Token i `seq_trace` | Skickas vidare med meddelanden; serienummer räknar dem; en systemspårare tar emot spårmeddelanden | Behålls endast per process: skickas inte vidare, serienumren förblir som de ställts in, inga spårmeddelanden | [bibliotek](library.md) |
| Omfattningar i `pg` och `global` | Replikeras mellan anslutna noder; `pg` övervakar noder via `net_kernel` | En nod, inga andra noder eller nodövervakning | [bibliotek](library.md) |
| Applikationsresurser | `.app`-filer som hittas på kodsökvägen vid laddning; `sys.config`, `-config` och argumenten `-App Key Value` ställer in miljöer | Kompileras in i den körbara filen från byggets resursfiler; ändringar kräver ombyggnad; inga konfigurationsfiler eller argument | [bibliotek](library.md#applications) |
| Applikationerna `kernel` och `stdlib` | Startas vid uppstart; `kernel` har en master och en toppsupervisor | Laddade och körs utan masters: `get_supervisor(kernel)` är `undefined`, `info/0` listar dem som körande `undefined` | [bibliotek](library.md#applications) |
| `application:ensure_all_started/3` med `concurrent` | Startar oberoende applikationer samtidigt; listan följer ordningen de blir klara i | Startar dem en efter en, beroenden först | [bibliotek](library.md#applications) |
| `application:takeover/2` | Väntar på den distribuerade applikationskontrollern | Avslutas med `noproc` (ingen `dist_ac`), som `load/2` med noder gör i båda | [bibliotek](library.md#applications) |
| I/O-begäranden till en applikationsmaster | Vidarebefordras till gruppledaren som applikationen startades under | Besvaras på standard-I/O | [bibliotek](library.md#applications) |
| `erlang:process_flag(error_handler, Module)` | Runtime anropar `Module:undefined_function/3` och `undefined_lambda/3` för odefinierade anrop | `badarg`; `process_info/2` rapporterar alltid `error_handler`, och odefinierade anrop ger `undef` direkt ([`error_handler`](library.md) kan endast anropas) | [bibliotek](library.md) |
| Detaljer i kraschrapporter (`proc_lib`) | Undantagstext från `erl_error` med utökad felinformation; grannar med `current_function`, `initial_call` och `current_stacktrace`; verkliga `reductions` | Undantagets klassrad och stackramar utan utökad felinformation; grannar utan dessa poster; `reductions` 0 | [bibliotek](library.md) |
| `client_info` i felrapporter från `gen_server`, `gen_statem` och `gen_fsm` | Den anropande processens `current_stacktrace` | `[]`: Clause behåller ingen aktuell stack för en annan process | [bibliotek](library.md) |
| `-behaviour` med ett värde som inte är en atom | Varningen skriver ut termen med `~w` (`behaviour [115,116,114] undefined`) | Skriver ut attributets källtext (`behaviour "str" undefined`); felet är detsamma | [semantik](semantic.md#behaviours) |
| `module_info(md5)` och den `vsn` som OTP härleder från den | MD5 av den kompilerade BEAM-koden | MD5 av modulens utskrivna källkod; det härledda `vsn`-heltalet skiljer sig i motsvarande grad | [semantik](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` för OTP:s kompilatorapplikation, de `options` som gavs till den | Clauses version; `options` alltid `[]` | [semantik](semantic.md#predefined-functions) |
| `module_info(functions)` | Listar även de funktioner som OTP genererar för funs (`'-f/0-fun-0-'/0`) | Endast källkodsfunktionerna och de fördefinierade | [semantik](semantic.md#predefined-functions) |
| `-nominal` i `module_info(attributes)` | Behålls som `{nominal,[{Name,AbstractType,Params}]}` i abstrakt format | Utelämnas | [semantik](semantic.md#predefined-functions) |
| En funktion i en Clause-biblioteksmodul som Clause inte har implementerat (en `erlang`-BIF, `lists:rmerge/2`, ...) | Körs | Kompileras; ger `error({not_implemented, F, A})` när den anropas, med `M:F/A` överst på stacken ([statusar](../library/modules.terms)) | [bibliotek](library.md#provided-or-missing), [inbyggda funktioner](builtins.md#erlang-module) |
| Import av en modul utanför batchen | Kompileras; anropet ger `undef` vid körning om modulen saknas | Kompileringsfelet `unknown module M` när importen anropas (oanvända importer behöver ingen modul) | [semantik](semantic.md#imports) |
| Varningen `import directive overrides auto-imported BIF` | För varje automatiskt importerad BIF i `erl_internal:bif/2` | Endast för de automatiskt importerade BIF:ar som Clause implementerar | [semantik](semantic.md#imports) |

## Gränsfall i språket

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Heltalssegment bredare än heltalsgränsen, med ett värde bortom den (`<<V:4194241>>` med bara ettor) | x86-JIT:en matchar med en ogiltig term; att använda den kraschar VM:en | Ingen matchning | [termer](terms.md#integers) |
| Zip-grupp där avslappnade och strikta generatorer delar en variabel | Överhoppningstestet behåller variabler från strikta mönster i de avslappnade mönstren | Ett avvisat steg hoppas över närhelst de strikta mönstren matchar på egen hand | [mönster](patterns.md#comprehensions) |
| Anrop av en extern fun, `M:F(Args)` eller `apply/3` för en modul utanför programmet | Laddar modulen från kodsökvägen, `undef` om den saknas | `undef`; biblioteksmoduler blir del av programmet endast när det namnger dem med en literal atom | [funs](funs.md#dynamic-calls), [bibliotek](library.md#how-programs-get-them) |
| Filer utan `#!` som ges som escripts | `escript file.erl` hoppar över första raden | Kompileras som vanliga moduler | [körbara filer](executables.md) |
| Förkompilerade beam- och arkiv-escripts | Körs | Stöds inte | [körbara filer](executables.md) |
| Modulnamnet för ett escript utan `-module` | `<name>__escript` plus ett suffix med tidsstämpel/unikt värde | `<name>__escript`, deterministiskt | [körbara filer](executables.md#escripts) |
| `include_lib` av en applikation som finns i flera `<app>-<version>`-kataloger | Kodsökvägen innehåller en version (uppstarten väljer den högsta); ingen diagnostik | Den högsta versionen under varje genomsökt katalog, med en varning per körning som listar dem | [preprocessor](preprocessor.md#compatibility-policies) |
| En `-spec` vars typer inte delar något värde med det härledda resultatet, ingångsdomänen eller argumenten i ett anrop | Kompileras; Dialyzer kan varna | En motsagd ingångsdomän för ett argument är ett kompileringsfel som namnger de deklarerade och härledda typerna; ett motsagt resultat eller anrop är en varning, och de härledda typerna används | [semantisk analys](semantic.md#inference) |

## ETS

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Ordning för `first/1`, `next/2`, `tab2list/1`, `foldl/3` och `i/1` över tabeller av typen `set`, `bag` och `duplicate_bag`, samt vad `slot/2` numrerar | Linjära hashplatser besöks lås för lås; ordningen ändras när tabellen växer | Delar, sedan hinkar i ordning, sedan nycklar i insättningsordning inom en hink; en plats är en hink | [runtime](runtime.md#ets-tables) |
| `ets:all/0` | Inkluderar tabellerna i OTP:s `kernel` och `stdlib`; ordningen på schemaläggarnas svar | Endast programmets tabeller, utan bestämd ordning | [inbyggda funktioner](builtins.md#ets) |
| `memory` i `info/2` | Allokerade ord för tabellen och dess objekt | Lagrade objektord plus Clauses egen overhead | [inbyggda funktioner](builtins.md#ets) |
| `{write_concurrency, auto}` | Antalet lås anpassas till konkurrensen (64 till 8192) | 64 fasta delar, som för `true`; `stats` rapporterar 64 lås | [runtime](runtime.md#ets-tables) |
| `compressed` | Lagrar andra element än nyckeln i externt format | Godtas och rapporteras; objekten lagras som de är | [inbyggda funktioner](builtins.md#ets) |
| `stats` i `info/2` för en `ordered_set` med `write_concurrency`; `data`; `binary` | CA-träd `{RouteNodes, BaseNodes, MaxDepth}`; skriver ut tabellen; tabellens binaries utanför heapen | `false`; `true` utan utskrift; `[]` | [inbyggda funktioner](builtins.md#ets) |
| `badarg` från en inbyggd `ets`-funktion | Innehåller `error_info` med en orsak (`id`, `access`, `type`, ...) | Enbart `badarg` | [inbyggda funktioner](builtins.md#ets) |
| Ordning för resultat från `select`, `match` och `match_object` på hashtabeller, samt vilka resultat varje del från `select/3` innehåller | Resultaten från varje genomgångssteg läggs först i listan, nyaste först; linjära hashplatser | Genomgångsordning för Clauses delar och hinkar; varje del innehåller de första `Limit` insamlade resultaten | [inbyggda funktioner](builtins.md#ets) |
| `select_delete/2`, `select_replace/2` över en hel tabell | Lämnar över körningen var 1000:e objekt (tabellen fixerad under tiden) | Körs i ett stycke, varje del under sitt lås | [runtime](runtime.md#ets-tables) |
| Matchningsspecifikationer som anger en variabel med nummer 25 eller högre | Numrerar om varje `'$N'`-atom i specifikationen, även inuti `{const, ...}` (så `{const, '$30'}` ger `'$0'`) | Variablerna behåller sina nummer; `{const, '$30'}` ger `'$30'` | [runtime](runtime.md#match-specifications) |
| Guards och kroppar i matchningsspecifikationer som är nästlade djupare än 1000 nivåer | Kompileras tills C-stacken nästan är slut (`system_limit`) | `system_limit` | [runtime](runtime.md#match-specifications) |
| Spårningsåtgärder i `erlang:match_spec_test/3`: `enable_trace`, `disable_trace`, `trace` med giltiga flaggor | Ändrar anroparens spårningsflaggor (29.1.1 kraschar utan en spårare) | `true` efter kontroll av flaggorna (och att ett pid-argument lever); ingenting ändras | [inbyggda funktioner](builtins.md#ets) |
| `ets:tab2file/2,3` och `file2tab/1,2` | Via en disk_log-process med en ny referens som namn | Skrivs och läses direkt med `file` | [inbyggda funktioner](builtins.md#ets) |
| `{process_dump}` och `{current_stacktrace}` i `erlang:match_spec_test/3` | Processens dumptext; dess stackspårning | `<<>>`; `[]` | [inbyggda funktioner](builtins.md#ets) |

## dets

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Begäranden som väntar tillsammans vid en tabell | Uppslagningar, insättningar och borttagningar som köats samtidigt delar en cacheuppdatering; uppslagningar besvaras innan skrivningarna görs; en fixerad tabell får vissa skrivare att sova 1 ms | Varje begäran i tur och ordning, efter ankomst | [inbyggda funktioner](builtins.md#dets) |
| Långa dets-operationer (reparationer, `init_table/2,3`, komprimeringar, tömningar av en stor cache) | Erlang-kod, avbryts efter reduktioner | Ett inbyggt anrop vardera; tabellens arbetstråd kör ingenting annat under tiden | [inbyggda funktioner](builtins.md#dets) |
| Processer i `dets` | `dets`-servern och `dets_sup` under `kernel_safe_sup`, tabeller under `dets_sup` | En `dets`-server som startas vid första användningen, utan övervakning; tabellprocesser länkade till den | [inbyggda funktioner](builtins.md#dets) |
| Ordningen för `dets:all/0` | Registrets ETS-ordning | Clauses ETS-ordning ([ETS](#ets)) | [inbyggda funktioner](builtins.md#dets) |
| Rapporter | En reparation loggas på info-nivå; `verbose/0,1` och `DETS_DEBUG` loggar mer; ett internt fel är `{dets_bug, ...}` | Ingenting loggas | [inbyggda funktioner](builtins.md#dets) |

## io

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| `~p`, `~w` och `io_lib`-skrivare för behållare nästlade djupare än 256 nivåer | Skrivs ut | `system_limit` | [io](io.md#pretty-printing-p) |
| `io_lib:print/4` med en kolumn eller radlängd som inte är ett heltal | Beror på termen: skrivs ut (guards misslyckas tyst), `function_clause` eller `badarith` | `badarith` för varje behållarterm | [io_lib](builtins.md#io_lib) |
| Negativ precision eller utfyllnadsantal (`~.*c` med -1) | Loopar för evigt | `badarg` | [io](io.md#formats) |

## erl_scan

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Position för en fortsättning från `tokens/3,4` (`continuation_location/1`, odokumenterad) | Där skannern stannade, inuti det ofullständiga tokenet | Början av det ofullständiga tokenet, som skannas igen med nästa tecken | [erl_scan](builtins.md#erl-scan) |
| `{compiler_internal, [ssa_checks]}` | Skannar kontrollkommentarer av typen `%ssa%` till token | Ignoreras: de förblir kommentarer | [erl_scan](builtins.md#erl-scan) |
| Ett flyttal med angiven bas (`16#1.8#e1`, annan bas än 10) vars siffror överstiger 53 bitar | Mantissan konverteras som ERTS konverterar stora heltal | Ackumuleras i en double; sista biten kan skilja sig | [erl_scan](builtins.md#erl-scan) |
| Ett listelement som inte är ett tecken inuti en sträng, citerad atom eller escape-sekvens | `function_clause`, `case_clause` eller `if_clause`, beroende på klausulen | `function_clause` | [erl_scan](builtins.md#erl-scan) |

## erl_parse

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Token av typen `'%ssa%'` (SSA-kontrollklausuler i OTP:s kompilatortester) | Parsas till `ssa_check_when`-klausuler | Ett syntaxfel; `erl_scan` producerar aldrig tokenet | [erl_parse](builtins.md#erl-parse) |

## erl_eval

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Stackspårning för ett fel som evaluatorn ger (`{badmatch, V}`, `undef` för ett lokalt anrop, ...) | Den evaluerande processens aktuella stack (`current_stacktrace` i `process_info/2`) | Stacken vid det `throw` i evaluatorn som samlar in den, med Clauses ramar | [erl_eval](builtins.md#erl-eval) |

## erl_lint

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Behaviours som anges av `-behaviour` | Varje modul på kodsökvägen svarar på `behaviour_info/1` | Endast moduler som länkats in i programmet svarar; andra ger `undefined_behaviour` | [erl_lint](builtins.md#erl-lint) |
| Ordning för flera fel som hittas i en map-fold (typvariabler som förekommer en gång i en typ, specs utan en funktion, callback-kontroller) | Mapens interna ordning (atomer efter index) | Termordning | [erl_lint](builtins.md#erl-lint) |
| `erlang:is_builtin/3` för poster i `-deprecated`, `-removed` och `-unsafe` som inte exporteras | OTP:s BIF-tabell | Runtimens inbyggda funktioner, som inkluderar nativa biblioteksfunktioner | [erl_lint](builtins.md#erl-lint) |
| `is_guard_expr/1` för en record-konstruktion | Ger `case_clause` | Svarar om fälten är guard-uttryck | [erl_lint](builtins.md#erl-lint) |

## epp

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| `-include_lib("App/...")` som inte finns på inkluderingssökvägen | Hittas i `code:lib_dir(App)`, som känner till OTP:s applikationer | Hittas i `code:lib_dir(App)` på Clauses kodsökväg, som saknar OTP-applikationer om de inte läggs till | [bibliotek](library.md#contents) |

## erl_pp

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Formen på tecknen som `erl_pp` returnerar | Djupa teckenlistor | En platt teckenlista; utdata är lika efter utplattning | [inbyggda funktioner](builtins.md#erl-pp) |

## qlc

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Stackspårning för ett undantag som uppstår i en markörprocess och som `next_answers/1,2` ger igen | Markörens stackspårning följd av ägarens `process_info(self(), current_stacktrace)` | Följd av stackspårningen från ett undantag som fångas i ägaren (Clause saknar posten `current_stacktrace`) | [qlc](builtins.md#qlc) |
| `qlc:q/1,2` i `erl_eval`, `ets:table/1,2`, `dets:table/1,2` i ett program som aldrig namnger `qlc` | `qlc` är alltid laddad | `undef` för `qlc`: dessa når modulen via ett namn vid körning, så endast program som namnger `qlc` (vilket varje modul som inkluderar `qlc.hrl` gör) länkar in den | [bibliotek](library.md#how-programs-get-them) |
| Annoteringsnummer i koden för kompilerade frågor (`info/2` med `{format, abstract_code}`) | OTP:s transform numrerar annoteringar runt varje heltal i modulen, inklusive tecknen i sökvägen till `qlc.hrl` i dess `file`-attribut | Samma transform, men Clauses `qlc.hrl` har en annan sökväg, så nummer efter den första frågan kan skilja sig; koden är i övrigt lika | [qlc](builtins.md#qlc) |

## qlc_pt

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Meddelanden från `qlc_pt:parse_transform/2` vid körning | Från `compile:noenv_forms/2` (`strong_validation`): `erl_lint` samt kompilatorns Core-pass, till exempel varningar från `sys_core_fold` | Endast från `erl_lint`, som OTP:s `qlc_pt` gör när kompilatorn inte är tillgänglig | [qlc_pt](builtins.md#qlc-pt) |

## Interaktivt skal

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Radredigering i en terminal | `edlin`: piltangenter, radhistorik, sökning, tabbkomplettering via `edlin_expand`, flerradsprompten `..>` | Terminalens egen radredigering (cooked); rader läses som terminalen levererar dem, med samma prompt för varje ytterligare rad i ett kommando, som OTP gör för indata via en pipe | [bibliotek](library.md#interactive-shell) |
| Jobbkontroll | Ctrl+G öppnar JCL-menyn (nya, anslutna, avbrutna och dödade skal) | Ingen; bannern och tipset för långsamma kommandon nämner ändå Ctrl+G som OTP skriver dem | [bibliotek](library.md#interactive-shell) |
| `exit().` när skalet läser indata från en pipe | Ett nytt skal startar och läser ingenting mer | Ett nytt skal startar och läser resten av indatan | [bibliotek](library.md#interactive-shell) |
| Program som startar skalet utan `--shell` | Varje modul på kodsökvägen kan anropas | Endast modulerna som programmet länkar; utan `--keep-exports` når dynamiska anrop bara exporter som programmet kan nå | [bibliotek](library.md#interactive-shell) |
| Records i kompilerade moduler (`rr(Module)`, `shell_default` och `user_default` vid start) | Läses från modulens felsökningsinformation eller källkod | `{error, nofile}`: länkad kod behåller ingen abstrakt kod; `rr/1,2,3` för källfiler och `.beam`-filer läser dem | [bibliotek](library.md#interactive-shell) |
| `save_module/1` | Skriver modulen och kompilerar den med `c:c/1` | Skriver bara modulen (ingen kompilator) | [bibliotek](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` inuti ett anrop eller ett record-fältvärde | Funktionshuvuden och argumenttyper från funktionens specifikation (`lists:seq(From, To)`), atomer och typer som specifikationen tillåter | `Mod:Fun/Arity`-huvuden för de exporterade ariteterna, inga typförslag: länkad kod behåller inga specifikationer | [bibliotek](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` för funktioner och moduler | Funktioner grupperade enligt dokumentationens grupper; moduler på kodsökvägen | En grupp `Functions` (ingen dokumentation); programmets moduler | [bibliotek](library.md#interactive-shell) |
| Kolumner i `c:i/0,1`, `c:ni/0`, `c:regs/0` | Varje process initiala anrop och aktuella funktion | Det initiala anropet från `proc_lib` eller `undefined`; den aktuella funktionen `undefined` (ingen post `current_function`) | [bibliotek](library.md#interactive-shell) |

## Slumptal

| Skillnad | OTP | Clause | Ansvarig |
| --- | --- | --- | --- |
| Remshöjder i `rand`:s normalziggurat | Tabellerade konstanter | Beräknas till närmaste double från zigguratens konstanter; en höjd kan skilja sig i sista biten, vilket ändrar ett godkännande på den långsamma vägen endast för en dragning inom den biten från gränsen (sannolikhet nära 2^-53 per dragning på den långsamma vägen). Remsbredder och gränser observeras från OTP och är lika | [inbyggda funktioner](builtins.md#random-numbers) |

## crypto

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Ordningen för `crypto:supports(ciphers)` | NIF:ens tabell sorterad efter atomindex, som varierar mellan VM-körningar, sedan aliasen | OTP:s tabellordning, sedan aliasen | [inbyggda funktioner](builtins.md#crypto-module) |
| `{File, Line}` i felen `{badarg \| notsup \| error, {File, Line}, Description}` från `crypto` | OTP:s C-källfil och rad (`{"hash.c", 111}`) | Clauses C++-källfil och rad (`{"hash.cpp", 63}`); klassen och beskrivningen är OTP:s | [inbyggda funktioner](builtins.md#crypto-module) |
| `link_type` i `crypto:info/0` | Hur OTP länkade libcrypto (vanligen `dynamic`) | Alltid `static`, även när ett installerat delat libcrypto länkas | [OpenSSL](crypto.md) |
| Långa beräkningar med `pbkdf2_hmac/5` (fler än 100 iterationer eller 64 byte) | Körs på en dirty CPU-schemaläggare | Körs på den anropande processens arbetstråd i schemaläggaren, som inte kör någon annan process under tiden | [inbyggda funktioner](builtins.md#crypto-module) |
| `modules` för applikationen `crypto` | `[crypto, crypto_ec_curves]` | `[crypto]` | [bibliotek](library.md) |
| Långa texter för `crypto_one_time/4,5` och `crypto_one_time_aead/4,6,7` (fler än 20000 byte) | Körs på en dirty CPU-schemaläggare | Körs på den anropande processens arbetstråd i schemaläggaren, som inte kör någon annan process under tiden | [inbyggda funktioner](builtins.md#crypto-module) |
| Applikationsvariabeln `fips_mode` i `crypto` | Läses när modulen `crypto` laddas: `true` aktiverar FIPS-läge | Läses inte (Clause saknar `on_load` och program saknar `sys.config`): använd `crypto:enable_fips_mode/1` eller `clau --fips` | [crypto](crypto.md#fips) |
| `crypto:info_fips/0` utan en FIPS-leverantör som kan laddas | `not_enabled` när OTP byggts med FIPS-stöd, annars `not_supported` | `not_supported` | [crypto](crypto.md#fips) |
| När applikationen `crypto` laddas | När modulen `crypto` laddas (dess `on_load`) | När en generator av typen `crypto_cache`, `crypto_aes` eller `crypto_prng1` först läser `rand_cache_size` | [bibliotek](library.md) |
| RSA-nyckelgenerering (`crypto:generate_key(rsa, ...)`) och SLH-DSA-signaturer | Körs på en dirty CPU-schemaläggare | Körs på den anropande processens arbetstråd i schemaläggaren, som inte kör någon annan process under tiden | [inbyggda funktioner](builtins.md#crypto-module) |
| Alternativet `rsa_sslv23_padding` till `crypto:public_encrypt/4` och dess syskon | Godtas när OTP byggts mot en OpenSSL som har SSLv23-utfyllnad (1.1, 3.x) | `"Bad padding type in option rsa_padding"`, som OTP byggt mot OpenSSL 4 | [inbyggda funktioner](builtins.md#crypto-module) |
| `crypto:ec_curve/1` för en kurva som det länkade libcrypto saknar (en OpenSSL byggd utan binära kurvor) | Parametrarna från `crypto_ec_curves` | `error:function_clause`, som för en okänd kurva: parametrarna kommer från libcryptos inbyggda kurvor | [inbyggda funktioner](builtins.md#crypto-module) |
| Avkryptering av felsökningsinformation med `beam_lib` i ett program som inte anropar `crypto` | `crypto` finns alltid | `key_missing_or_invalid` om programmet inte länkar `crypto` (`--with-crypto`), eftersom `beam_lib` anropar modulen dynamiskt | [bibliotek](library.md) |

## ASN.1

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Stacken i `{error, {asn1, {Reason, Stack}}}` | Ramar för de genererade funktionerna `enc_*`/`dec_*` och `asn1rtt_*` | Ramar för `Module:encode/2` eller `decode/2` och den inbyggda kodekfunktionen | [asn1](asn1.md#generated-modules) |
| Funktioner i en genererad modul | Exporterar även `enc_Type/1,2`, `dec_Type/1,2` och de andra funktioner per typ som asn1ct genererar | Endast `encode/2`, `decode/2`, `info/0`, alternativfunktionerna och värdefunktionerna | [asn1](asn1.md#generated-modules) |
| En `CHOICE` vars kropp börjar med `...` (inga rotalternativ) | asn1ct rapporterar ett syntaxfel | Godtas | [asn1](asn1.md#coverage) |
| Värdemakron och funktioner som anger ett annat värde inuti en öppen typ (`mgf1SHA1`, `rSASSA-PSS-Default-Identifier` i PKCS-1) | asn1ct lämnar `{'Externalvaluereference', Line, Module, Name}` i stället för värdet | Det refererade värdet | [asn1](asn1.md#generated-modules) |
| Ett runtime-fel (inte ett ASN.1-fel) medan `public_key` avkodar eller kodar ett tilläggsvärde | Ges när det inträffar, oftast med klassen `error`, från den genererade funktionen `dec_ext-*`/`enc_ext-*` | `exit({error, {asn1, Reason}})`: värdet går genom den genererade modulens `decode/2` eller `encode/2`, som kapslar in varje fel | [public_key](public_key.md#functions) |
| Standardgrupperna för Diffie-Hellman i `public_key:dh_gex_group/4` | Grupperna som OTP genererade (`lib/public_key/priv/moduli`), 60–81 per storlek | Åtta per storlek från OpenSSH:s moduli-fil; samma storlekar (2047 till 8191) | [public_key](public_key.md#keys-and-signatures) |
| Ramar för ett undantag i `public_key` | `public_key`, `pubkey_pem`, `pubkey_pbe`, `pubkey_cert_records`, `pubkey_cert`, `pubkey_ssh` | `public_key`, `clause_public_key_codec` och `clause_public_key_keys` | [public_key](public_key.md#functions) |

## Parse transforms

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Namnet i `file`-attributet för en inkluderad fil (`--print-abstr`, indata till transformen) | Inkluderingskatalogen sammanfogad med namnet, så som det hittades (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | Sökvägen relativt arbetskatalogen när filen ligger under den, annars den absoluta sökvägen | [transformer](transforms.md#interchange) |
| Annoteringar med rad 0 på importerade former (genererad kod, som från transformen `qlc`) | En giltig rad: koden saknar källkodsrad | Koden tar platsen för den nod som importerades före den | [transformer](transforms.md#importing-forms) |
| `generated`-annoteringar på importerade former (`.abstr`-indata, utdata från transformer) | `erl_lint` och kompilatorn hoppar över vissa varningar för genererad kod | Ignoreras: koden kontrolleras som källkod | [transformer](transforms.md#importing-forms) |
| Formerna `{error, {Location, Module, Descriptor}}` i importerad kod | Formateras med `Module:format_error/1` | Deskriptorns termtext; formateringen kräver OTP | [transformer](transforms.md#importing-forms) |
| En modul med preprocessor- eller parsningsfel som namnger en parse transform | Transformen körs och får felen som `{error, E}`-former; `erl_lint` rapporterar dem efteråt | Felen rapporteras och transformen körs inte | [transformer](transforms.md#clause-pipeline) |
| Kompileringsalternativ som en transform får | erlc:s fullständiga alternativlista | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (arbetskatalogen), `{i, _}`, `{d, ...}` och `{parse_transform, _}` | [transformer](transforms.md#otp-behavior) |
