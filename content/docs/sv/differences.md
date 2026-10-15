---
source: docs/differences.md
sourceCommit: 6ed3851c
sourceSha256: 7f5e373cf63cd3d962f6e9954719a80cdb14f9cf5bfdb3af590c58fc8e0cabf3
translatedAt: 2026-10-15
---
# Skillnader mot Erlang/OTP

Observerbart beteende där Clause medvetet skiljer sig från den fastlåsta OTP 29
(`maint-29`, se [otp-reference.md](otp-reference.md)). Varje post länkar till
det kontrakt som äger den. Ta bort en post när skillnaden är åtgärdad. Funktioner
som ännu inte är implementerade (rapporteras som `notimpl`) listas inte här; se
[features.md](features.md) och planen.

## Maps

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Ordning för map-generatorer (`K := V <- M`) | Platta maps (upp till 32 nycklar) itereras i nyckelordning, men atomnycklar i atomtabellens ordning, som varierar mellan VM-körningar; större maps i hashordning | Alltid kanonisk nyckelordning (termordning) | [mönster](patterns.md#comprehensions) |
| `bad_generators`-nyttolast för en map-generator i en zip-grupp | Dess iterator: en `{K, V, Next}`-kedja som slutar i `none`, i OTP:s ordning | Samma kedja, byggd i kanonisk nyckelordning | [mönster](patterns.md#comprehensions) |
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3` | Intern ordning (atomtabellens ordning för atomnycklar, hashordning över 32 nycklar); en iterator är en position eller en `{K, V, Next}`-kedja | Kanonisk nyckelordning; en iterator fortsätter över en nyckellista | [inbyggda funktioner](builtins.md#erts-internal) |
| Utskrift av maps (`erlang:display/1`, `~w`, `~p`) | Intern layoutordning (atomtabellens ordning för atomnycklar, hashordning över 32 nycklar) | Map-nyckelordning, som OTP:s `~kw` | [termer](terms.md#printing) |
| Utskrift av native records (`erlang:display/1`) | Fält i atomtabellens indexordning | Definitionsordning, som `~w` | [native records](native-records.md#printing-and-order) |
| `==` mellan native records vars fält skiljer sig endast som heltal/flyttal | Kompilatorn kan vika det till `=:=` (falskt) | Numerisk jämförelse (sant) | [native records](native-records.md#printing-and-order) |
| Utskrift av lokala funs (`#Fun<M.Index.Uniq>`) | Index från kompilatorns lambdanumrering, `Uniq` en hash av modulens kod | Index bland modulens lokala funs i källkodsordning, `Uniq` alltid 0 | [funs](funs.md#comparison-and-printing) |
| Ordning mellan två lokala funs i en modul | Enligt OTP:s index | Enligt index i källkodsordning, så funs från olika funktioner kan ordnas annorlunda | [funs](funs.md#comparison-and-printing) |
| Namn på anonyma funs i stackspårningar (`-f/1-fun-N-`) | `N` från kompilatorns numrering | `N` räknar funs i `f/1` i källkodsordning | [funs](funs.md#closures) |
| En anonym fun i ett standardvärde för ett record-fält | Varje konstruktionsställe expanderar en egen kopia: funs från två ställen är olika | En fun för standardvärdet: funs från alla konstruktionsställen är lika | [funs](funs.md#closures) |
| Ordning för infångade värden i funs som skapas i comprehensions | Fria variabler i comprehensionens genererade funktion | Definitionsordning i den omslutande funktionen; syns endast när två sådana funs jämförs | [funs](funs.md#closures) |

## Pids, referenser och processer

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Pid-nummer | Den första användarprocessen är ungefär `<0.80.0>`; nummer återanvänds när pid-tabellen slår runt | Den första processen är `<0.1.0>`; nummer kommer från en enda sekvens och återanvänds aldrig | [termer](terms.md#pids-and-references) |
| Kod efter `spawn(Fun)` av en fun med annan aritet | Kompilatorns typanalys kan betrakta koden efter anropet som onåbar och ta bort den, så att anroparen genast returnerar pid:en | Anroparen fortsätter; endast den nya processen misslyckas med `{badarity, {Fun, []}}` | [processer](processes.md#builtins) |
| Stacken för en `function_clause` som en inbyggd funktion i `lists` ger (`lists:sublist/2`, `lists:max/1`, ...) | Den översta ramen är Erlang-funktionen, ofta en intern hjälpfunktion (`lists:sublist_2/2`), med dess argument | Anroparen ligger överst: inbyggda funktioner lägger inte upp någon ram | [inbyggda funktioner](builtins.md#lists-module) |
| Sista biten i resultat från `math` (`math:erfc(1)`, ...) | Det C-bibliotek som OTP byggdes med | Det C-bibliotek som Clause-program länkar (Windows: `0.15729920705028513` för `erfc(1)`, OTP `0.1572992070502851`) | [inbyggda funktioner](builtins.md#math-module) |
| Resultatet av `binary:compile_pattern/1` | `{bm, Ref}` eller `{ac, Ref}` med en ogenomskinlig referens | `{bm, [Pattern]}` eller `{ac, Patterns}` | [inbyggda funktioner](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` för en delbinär | Storleken på den binär den pekar in i | Dess egen storlek | [inbyggda funktioner](builtins.md#binary-module) |
| Kostnaden för `persistent_term:get/1,2` | Konstant: värdet ligger kvar i ett literalområde; `put`/`erase` av ett ersatt värde utlöser en global skräpsamling | Kopierar värdet till läsarens heap vid varje läsning; ingen global skräpsamling | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` och `get/0` | Innefattar de termer som OTP:s `kernel` och `stdlib` lagrar vid uppstart (26 i OTP 29) | Endast programmets egna termer | [inbyggda funktioner](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` för en kompilerad modul | Den `.beam`-fil den laddades från | `preloaded`: varje modul är länkad in i den körbara filen | [inbyggda funktioner](builtins.md#code-module) |
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
| `inet:gethostbyname/1,2` | Resolverns kanoniska namn och alias (`inet_res`, hosts-filen, native) | Det efterfrågade namnet och inga alias; adresser från systemets resolver | [portar](ports.md#sockets-57f) |
| Modulerna `socket`, `net` | Socket-NIF-API:t | Saknas: en referens är ett kompileringsfel; använd `gen_tcp`, `gen_udp`, `inet` | [bibliotek](library.md) |
| Utdatalistor från `zlib` | En binär per intern del, nästlad där en ström avslutades och startades om | En binär per anrop, `[]` när det inte finns någon; byten är OTP:s | [inbyggda funktioner](builtins.md#zlib-module) |
| `zlib:safeInflate/2` och långa `zlib`-anrop | Returnerar efter en begränsad mängd utdata (`{continue, Output}`) och lämnar över körningen | Packar upp all köad indata i ett anrop (`{finished, Output}`); ett långt anrop håller kvar sin schemaläggartråd | [inbyggda funktioner](builtins.md#zlib-module) |
| Långa `re`-matchningar | `re:run/3` och den globala loopen lämnar över körningen efter en begränsad mängd arbete | En matchning körs till slut och håller kvar sin schemaläggartråd; en global körning lämnar över endast mellan matchningar | [inbyggda funktioner](builtins.md#re-module) |
| `re:compile/2` med `export`, `re:import/1` | Ett exporterat mönster `{re_exported_pattern, ...}` som en annan nod importerar | `export` ger `badarg`; `import/1` ger `{not_implemented, import, 1}` | [inbyggda funktioner](builtins.md#re-module) |
| Argumentfel i `re` | `badarg` från `re:run/3` (eller `replace`, `split`) med anroparens argument och `error_info` | `badarg` från den `re`-hjälpfunktion som avvisade argumentet, med den hjälpfunktionens argument | [inbyggda funktioner](builtins.md#re-module) |
| `code:is_sticky/1` | `true` för moduler i `kernel`, `stdlib` och `compiler` | Alltid `false` | [inbyggda funktioner](builtins.md#code-module) |
| Utdata till en filenhet (`io:format(File, ...)`) | Tecken kodas enligt filens kodning (`latin1` som standard: tecken över 255 är ett fel) | Alltid UTF-8-byte | [io](io.md#calls) |
| Formatering av en stor term (`io:format/1,2`) | Körs i Erlang-kod (`io_lib`) och i group leader, så processen kan avbrytas under formateringen | Körs till slut i ett enda anrop av en inbyggd funktion; andra processer väntar | [inbyggda funktioner](builtins.md#portions) |
| Flaggor till `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` med flera | Endast `trap_exit`; alla andra flaggor ger `badarg` | [processer](processes.md#builtins) |
| Ordning för felrapporter från processer som kraschar samtidigt | Loggerns ordning | Den ordning i vilken deras arbetstrådar avslutar dem | [processer](processes.md#workers) |
| Signaler till en process som körs på en annan schemaläggare | Köas i dess signalkö och hanteras senare, medan avsändaren fortsätter | Avsändaren väntar tills målets tidsskiva tar slut och agerar sedan direkt; observerbart endast som timing | [processer](processes.md#workers) |
| `term_to_binary/1` av en lokal fun eller ett native record | Kodas (`NEW_FUN_EXT`, ...) | `error:notsup`; `fun M:F/A` kodas | [inbyggda funktioner](builtins.md#external-term-format) |
| `term_to_binary/1` av en map med fler än 32 nycklar | Hashordning om inte `deterministic` anges | Alltid nyckelordning (byten från `deterministic`) | [inbyggda funktioner](builtins.md#external-term-format) |
| `binary_to_term/1` av en annan nods pid, port eller referens; alternativet `local` till `term_to_binary/2` | Externa identiteter; kodningen `LOCAL_EXT` | `badarg` | [inbyggda funktioner](builtins.md#external-term-format) |
| Tidsgräns för timers | Beror på den nativa tidsenheten (ungefär 2^49.7 ms på Windows) | Relativ tid 0..2^49-1 ms på alla plattformar | [processer](processes.md#timers) |
| `unique_integer/0,1` utan `positive` | Kan vara negativt | Alltid positivt och växande | [inbyggda funktioner](builtins.md#time) |
| Posterna `current_function`, `initial_call`, `current_stacktrace`, ... i `process_info/2` | Rapporteras | `error:{notsup, Item}`; `process_info/1` utelämnar dem | [processer](processes.md#introspection) |
| `reductions` i `process_info/2`; `reductions`, `garbage_collection`, `io` i `statistics/1` | Räknas | 0 (hålls inte) | [inbyggda funktioner](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Samlar skräp innan anropet returnerar | Samlar skräp vid målets nästa säkra punkt (safepoint) | [processer](processes.md#introspection) |
| `erlang:system_info(machine)` | `"BEAM"` | `"Clause"` | [inbyggda funktioner](builtins.md#system-information) |
| Inställningsalternativ för `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Tillämpas | Kontrolleras och godtas, tillämpas inte | [processer](processes.md#spawn-options) |
| `hibernate/3` | Kastar stacken; processen avslutas när `M:F` returnerar | Behåller stacken; resultatet av `M:F` returneras till anroparen av `hibernate/3` | [processer](processes.md#spawn-options) |
| `monitor(port, Item, Options)` med alternativ | Godtas | `badarg` | [processer](processes.md#aliases) |
| `spawn_request_abandon/1` | `true` medan svaret väntar | Alltid `false`: svaret skickas innan `spawn_request` returnerar | [processer](processes.md#spawn-options) |
| Sista biten i `math:log2/1` (Windows) | OTP:s Windows-bygge dividerar `log(X)` med `log(2)` (`math:log2(1.0e308)` är `1023.1538532253077`) | C-bibliotekets `log2` (`1023.1538532253076`) | [inbyggda funktioner](builtins.md#math-module) |
| Värden från `phash/2`, `phash2/1,2` | OTP:s hashfunktion | Clauses egen stabila hash med samma intervall och likhetsgaranti | [inbyggda funktioner](builtins.md#hashing) |
| `erlang:is_builtin/3` för `lists:reverse/2` och andra biblioteksfunktioner implementerade i C | `true` | `false`: endast runtimens inbyggda funktioner och `apply/2,3` | [funs](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` från `fun_info/1,2` för en lokal fun | Skaparens pid, kompilatorns kontrollsummor | `undefined`, MD5 av modulnamnet | [funs](funs.md#fun-information) |
| Kontexten från `md5_init/0` | OTP:s tillstånd på 92 byte | Clauses tillstånd på 96 byte; sammandragen är lika | [inbyggda funktioner](builtins.md#hashing) |
| `erlang:delete_module/1` för en laddad modul | Gör dess kod gammal (`true`) | `error:notsup`: länkad kod ligger kvar | [inbyggda funktioner](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Förbereder en giltig BEAM-binär | Alltid `{error, badfile}` | [inbyggda funktioner](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | De förladdade uppstartsmodulerna | Varje modul i programmet | [inbyggda funktioner](builtins.md#code-loading) |
| `list_to_pid/1` av ett nummer som aldrig delats ut | Returnerar en pid-term | `badarg`: endast pids som detta program har skapat godtas | [termer](terms.md#pids-and-references) |
| `list_to_port/1` av ett nummer som aldrig delats ut | Returnerar en portterm | `badarg`: endast portar som detta program har öppnat godtas | [portar](ports.md#identity) |
| Värden från `port_info/1,2` | `id` är ett tabellindex; `memory`, `queue_size`, `locking` beskriver drivrutinen | `id` är portnumret; `memory` och `queue_size` är 0; `locking` är `port_level` | [portar](ports.md#builtins-and-port-messages) |
| Skrivning till en fil som öppnats endast för läsning | `{error, eacces}` på Windows, `{error, ebadf}` på andra system | `{error, ebadf}` överallt | [portar](ports.md#standard-io-and-files) |
| `io:get_line`, `io:get_chars` och `file:read/2` i listläge på icke-ASCII-indata | Tecken avkodas enligt enhetens kodning | Ett listelement per byte | [portar](ports.md#standard-io-and-files) |
| Resultatet av `os:cmd/1` | Unicode-tecken avkodade från utdata | Utdatans byte | [portar](ports.md#subprocesses) |
| Tomma argument till `{spawn_executable, F}` på Windows | Tas bort från kommandoraden | Skickas som `""` | [portar](ports.md#subprocesses) |
| `{exit_status, S}` och `eof` från ett startat program | Ospecificerad ordning, `exit_status` kan komma före sista datat | Efter allt data, före `eof` | [portar](ports.md#subprocesses) |
| Upptagna portar | En port med för mycket köad utdata stoppar avsändare; `force` i `port_command/3` fungerar på drivrutiner som tillåter det | Utdata stoppar aldrig avsändare; `force` ger `notsup` på alla drivrutiner | [portar](ports.md#io-thread) |
| `{active, N}` för sockets | Ett heltal `N` räknar meddelanden före `{tcp_passive, S}` | `exit(badarg)`; endast `true`, `false` och `once` | [portar](ports.md#sockets-57f) |
| Inställningsalternativ för sockets (`nodelay`, `keepalive`, `send_timeout`, `delay_send`, buffertar) | Tillämpas; andra `inet`-alternativ (`header`, `{packet, line}`, `http`, ...) fungerar | De listade inställningsalternativen godtas men tillämpas inte; andra alternativ ger `exit(badarg)` | [portar](ports.md#sockets-57f) |
| Felorsaker för sockets | Varje POSIX-orsak som systemet rapporterar | De vanliga (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); andra blir `eio` | [portar](ports.md#sockets-57f) |
| Portindata medan den anslutna processen har 1 024 meddelanden och kan köras | Fortsätter läsa och leverera | Slutar leverera tills processens tidsskiva tar slut; över 64 KiB kvarhållet slutar den läsa, så det skrivande programmet blockeras | [portar](ports.md#busy-ports) |
| `gen_tcp:close/1` med köad utdata | Väntar upp till inställningen `linger`/`send_timeout` på att utdatan ska skickas | Returnerar direkt; I/O-tråden skickar den köade utdatan och stänger sedan | [portar](ports.md#sockets-57f) |
| Typer för `monitor/2` | `process`, `port`, `time_offset` | `process` och `port`; `time_offset` ger `badarg` (inga ändringar av tidsförskjutning) | [processer](processes.md#monitors) |
| `exit/2`, `exit_signal/2` till en referens | Skickar till processaliaset, om referensen är ett aktivt sådant | Ingenting (inga alias) | [processer](processes.md#exit-signals) |
| Referensnummer | Blandar en schemaläggaridentifierare och räknare per schemaläggare (`#Ref<0.178111994.4235460610.214105>`) | En enda räknare för hela programmet (`#Ref<0.0.0.1>`), så referenser ordnas efter skapandetid | [termer](terms.md#pids-and-references) |

## Fel, stackspårningar och rapporter

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Platser i stackspårningar | `[{file, F}, {line, L}]`, `error_info` för `error/3` | Alltid `[]`; ingen `error_info` | [ABI](abi.md#stack-traces) |
| Översta ramen för `function_clause` | Argumentlista | Aritet | [ABI](abi.md#stack-traces) |
| Översta ramen för `undef` | `{M, F, Args, []}` för den saknade funktionen | Den anropande funktionens ram | [funs](funs.md#dynamic-calls) |
| Dynamiskt anrop av en export som en körbar fil inte kan nå (dess modul namnges endast via en stackspårning, ett undantag eller ett meddelande utifrån programmet) | Anropar den | `undef`, om programmet inte byggts med `--keep-exports`; `function_exported/3` och `module_info(exports)` listar den ändå | [körbara filer](executables.md#export-liveness) |
| Ramar för BIF:ar/operatorer som misslyckas | Finns (`{erlang, '+', Args, ...}`) | Saknas; ingenting under ingångsfunktionen | [ABI](abi.md#stack-traces) |
| Full atomtabell (`list_to_atom/1`) | Emulatorn avbryter (`no more index entries in atom_tab`) och skriver en kraschdump | `clau: runtime failure: entry call failed: resource_limit`, slutstatus 70 | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` med tecken över 255 | De första siffrorna använder endast varje teckens låga byte (`[16#131]` är 1) | `badarg` | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` för en BIF | Sant för varje BIF i emulatorn | Sant endast för de inbyggda funktioner som denna runtime tillhandahåller | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| Felrapporter från kraschade processer | Skickas till loggern och skrivs senare av dess standardhanterare (på standard ut under `erl`, går ofta förlorade när ett escript avslutas först) | Skrivs på stderr när processen avslutas, före senare utdata | [processer](processes.md#exits) |
| Anrop till funktioner som aldrig returnerar | Kompileras som svansanrop (anroparen saknas i spårningen) | Vanliga anrop (anroparen finns med) | [ABI](abi.md#stack-traces) |
| Värdminnet är slut | Emulatorn rapporterar att den inte kan allokera minne, skriver en kraschdump och stoppar | `clau: runtime failure: entry call failed: out_of_memory`, slutstatus 70, ingen dump | [runtime-heap](runtime-heap.md#failure-behavior) |
| Lagring av maps med fler än 32 nycklar | En HAMT på heapen, räknad i `heap_size` och kopierad vid varje skräpsamling | Ett träd utanför heapen bakom en stubbe på 4 ord på heapen, räknat tillsammans med binärer utanför heapen; heapstorlekarna är mindre och skräpsamlingar kopierar endast stubben | [runtime-heap](runtime-heap.md#off-heap-maps) |
| Minnestak per process | `max_heap_size` (i ord, heap och stack) dödar processen med orsaken `killed` och loggar en felrapport | `--max-heap` / `--max-stack` (byte) och runtime-gemensamma `--max-memory` får den begärande processen att misslyckas som `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, slutstatus 70 | [runtime-heap](runtime-heap.md#runtime-memory-limit) |
| Programargument | `escript` skickar varje argument till `main/1`; emulatorflaggor (`+t`) kommer från `%%!` eller `ERL_FLAGS` | Inledande runtime-alternativ (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) plockas ut först; `CLAUSE_FLAGS` innehåller samma alternativ | [körbara filer](executables.md#runtime-options) |
| Ofångat undantag i en vanlig ingångsmodul | `escript` avslutar med 127 | Avslutar med 1 och en rad `uncaught exception <class>: <reason>` (escript-källor behåller 127) | [körbara filer](executables.md) |
| Kompilatordiagnostik | Formuleringar från `erl_lint` (`variable 'X' is unbound`) och varningar | Egna formuleringar (`unbound variable X`); OTP:s lint-varningar ges i regel inte (inte heller för okända fält i native records vid åtkomst, uppdatering och i mönster) | [semantik](semantic.md#bindings) |
| Beteendemodul med en handskriven `behaviour_info/1` | Anropar den när användarna kompileras och varnar för saknade, felaktigt definierade eller föråldrade callbacks | Utvärderas inte: användarnas callbacks kontrolleras inte | [semantik](semantic.md#behaviours) |
| Beteendemoduler utanför batchen (`gen_server`, `supervisor`, ...) | Laddas från kodsökvägen; deras callbacks kontrolleras | Varningen `behaviour M undefined` | [semantik](semantic.md#behaviours) |
| `-behaviour` med ett värde som inte är en atom | Varningen skriver ut termen med `~w` (`behaviour [115,116,114] undefined`) | Skriver ut attributets källtext (`behaviour "str" undefined`); felet är detsamma | [semantik](semantic.md#behaviours) |
| `module_info(md5)` och den `vsn` som OTP härleder från den | MD5 av den kompilerade BEAM-koden | MD5 av modulens utskrivna källkod; det härledda `vsn`-heltalet skiljer sig i motsvarande grad | [semantik](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` för OTP:s kompilatorapplikation, de `options` som gavs till den | Clauses version; `options` alltid `[]` | [semantik](semantic.md#predefined-functions) |
| `module_info(functions)` | Listar även de funktioner som OTP genererar för funs (`'-f/0-fun-0-'/0`) | Endast källkodsfunktionerna och de fördefinierade | [semantik](semantic.md#predefined-functions) |
| `-nominal` i `module_info(attributes)` | Behålls som `{nominal,[{Name,AbstractType,Params}]}` i abstrakt format | Utelämnas | [semantik](semantic.md#predefined-functions) |
| `erlang:get_module_info/1,2` | BIF:en bakom `module_info/0,1` | Tillhandahålls inte; `module_info/0,1` returnerar literala data | [semantik](semantic.md#predefined-functions) |
| `-compile({parse_transform, Module})` | Kör transformen över modulens former | Tillämpas inte; varningen `[parse transforms] notimpl` och modulen kompileras otransformerad | [kompilering](compile.md#accepted-source-subset) |
| En funktion i en Clause-biblioteksmodul som Clause inte har implementerat (en `erlang`-BIF, `lists:keysort/2`, `persistent_term:get/1`, ...) | Körs | Kompileras; ger `error({not_implemented, F, A})` när den anropas, med `M:F/A` överst på stacken ([statusar](../library/modules.terms)) | [bibliotek](library.md#provided-or-missing), [inbyggda funktioner](builtins.md#erlang-module) |
| Import av en modul utanför batchen | Kompileras; anropet ger `undef` vid körning om modulen saknas | Kompileringsfelet `unknown module M` när importen anropas (oanvända importer behöver ingen modul) | [semantik](semantic.md#imports) |
| Varningen `import directive overrides auto-imported BIF` | För varje automatiskt importerad BIF i `erl_internal:bif/2` | Endast för de automatiskt importerade BIF:ar som Clause implementerar | [semantik](semantic.md#imports) |

## Gränsfall i språket

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Heltalssegment bredare än heltalsgränsen, med ett värde bortom den (`<<V:4194241>>` med bara ettor) | x86-JIT:en matchar med en ogiltig term; att använda den kraschar VM:en | Ingen matchning | [termer](terms.md#integers) |
| Zip-grupp där avslappnade och strikta generatorer delar en variabel | Överhoppningstestet behåller variabler från strikta mönster i de avslappnade mönstren | Ett avvisat steg hoppas över närhelst de strikta mönstren matchar på egen hand | [mönster](patterns.md#comprehensions) |
| Anrop av en extern fun, `M:F(Args)` eller `apply/3` för en modul utanför programmet | Laddar modulen från kodsökvägen, `undef` om den saknas | `undef`; biblioteksmoduler blir del av programmet endast när det namnger dem med en literal atom | [funs](funs.md#dynamic-calls), [bibliotek](library.md#how-programs-get-them) |
| `lists` och `maps` | De fullständiga modulerna; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` följer mapens interna ordning (atomtabellens ordning för atomnycklar, hashordning över 32 nycklar) | [Biblioteksdelmängden](library.md); map-funktioner följer nyckelordning | [bibliotek](library.md) |
| Filer utan `#!` som ges som escripts | `escript file.erl` hoppar över första raden | Kompileras som vanliga moduler | [körbara filer](executables.md) |
| Förkompilerade beam- och arkiv-escripts | Körs | Stöds inte | [körbara filer](executables.md) |
| `include_lib` av en applikation som finns i flera `<app>-<version>`-kataloger | Kodsökvägen innehåller en version (uppstarten väljer den högsta); ingen diagnostik | Den högsta versionen under varje genomsökt katalog, med en varning per körning som listar dem | [preprocessor](preprocessor.md#compatibility-policies) |
| En `-spec` vars typer inte delar något värde med det härledda resultatet, ingångsdomänen eller argumenten i ett anrop | Kompileras; Dialyzer kan varna | En motsagd ingångsdomän för ett argument är ett kompileringsfel som namnger de deklarerade och härledda typerna; ett motsagt resultat eller anrop är en varning, och de härledda typerna används | [semantisk analys](semantic.md#inference) |

## io

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Styrsekvenserna `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, modifieraren `K` | Formateras | `badarg` | [io](io.md#formats) |
| `~p` av behållare nästlade djupare än 256 nivåer | Skrivs ut | `system_limit` | [io](io.md#pretty-printing-p) |
| Fältbredder och precision för `~ts` med kombinerande tecken eller `\r\n` | Räknar grafemkluster | Räknar kodpunkter | [io](io.md#formats) |
| Negativ precision eller utfyllnadsantal (`~.*c` med -1) | Loopar för evigt | `badarg` | [io](io.md#formats) |
| Andra `io`-funktioner än `format/1,2`, `put_chars/1` | Finns | `unknown module io` | [io](io.md#calls) |

## Parse transforms

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Namnet i `file`-attributet för en inkluderad fil (`--print-abstr`, indata till transformen) | Inkluderingskatalogen sammanfogad med namnet, så som det hittades (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | Sökvägen relativt arbetskatalogen när filen ligger under den, annars den absoluta sökvägen | [transformer](transforms.md#interchange) |
| `generated`-annoteringar på importerade former (`.abstr`-indata, utdata från transformer) | `erl_lint` och kompilatorn hoppar över vissa varningar för genererad kod | Ignoreras: koden kontrolleras som källkod | [transformer](transforms.md#importing-forms) |
| Formerna `{error, {Location, Module, Descriptor}}` i importerad kod | Formateras med `Module:format_error/1` | Deskriptorns termtext; formateringen kräver OTP | [transformer](transforms.md#importing-forms) |
| En modul med preprocessor- eller parsningsfel som namnger en parse transform | Transformen körs och får felen som `{error, E}`-former; `erl_lint` rapporterar dem efteråt | Felen rapporteras och transformen körs inte | [transformer](transforms.md#clause-pipeline) |
| Kompileringsalternativ som en transform får | erlc:s fullständiga alternativlista | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (arbetskatalogen), `{i, _}`, `{d, ...}` och `{parse_transform, _}` | [transformer](transforms.md#otp-behavior) |
