---
source: docs/differences.md
sourceCommit: 06042fa
sourceSha256: b5d1cfc31fec7aaf6e6c4ca75f9056df534ca608a2c93e97a44e6c5e00a1109b
translatedAt: 2026-10-09
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
| Formatering av en stor term (`io:format/1,2`) | Körs i Erlang-kod (`io_lib`) och i group leader, så processen kan avbrytas under formateringen | Körs till slut i ett enda anrop av en inbyggd funktion; andra processer väntar | [inbyggda funktioner](builtins.md#portions) |
| Flaggor till `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` med flera | Endast `trap_exit`; alla andra flaggor ger `badarg` | [processer](processes.md#builtins) |
| Ordning för felrapporter från processer som kraschar samtidigt | Loggerns ordning | Den ordning i vilken deras arbetstrådar avslutar dem | [processer](processes.md#workers) |
| Signaler till en process som körs på en annan schemaläggare | Köas i dess signalkö och hanteras senare, medan avsändaren fortsätter | Avsändaren väntar tills målets tidsskiva tar slut och agerar sedan direkt; observerbart endast som timing | [processer](processes.md#workers) |
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
| Ramar för BIF:ar/operatorer som misslyckas | Finns (`{erlang, '+', Args, ...}`) | Saknas; ingenting under ingångsfunktionen | [ABI](abi.md#stack-traces) |
| Full atomtabell (`list_to_atom/1`) | Emulatorn avbryter (`no more index entries in atom_tab`) och skriver en kraschdump | `clau: runtime failure: entry call failed: resource_limit`, slutstatus 70 | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` med tecken över 255 | De första siffrorna använder endast varje teckens låga byte (`[16#131]` är 1) | `badarg` | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` för en BIF | Sant för varje BIF i emulatorn | Sant endast för de inbyggda funktioner som denna runtime tillhandahåller | [inbyggda funktioner](builtins.md#how-calls-reach-them) |
| Felrapporter från kraschade processer | Skickas till loggern och skrivs senare av dess standardhanterare (på standard ut under `erl`, går ofta förlorade när ett escript avslutas först) | Skrivs på stderr när processen avslutas, före senare utdata | [processer](processes.md#exits) |
| Anrop till funktioner som aldrig returnerar | Kompileras som svansanrop (anroparen saknas i spårningen) | Vanliga anrop (anroparen finns med) | [ABI](abi.md#stack-traces) |
| Värdminnet är slut | Emulatorn rapporterar att den inte kan allokera minne, skriver en kraschdump och stoppar | `clau: runtime failure: entry call failed: out_of_memory`, slutstatus 70, ingen dump | [runtime-heap](runtime-heap.md#failure-behavior) |
| Minnestak per process | `max_heap_size` (i ord, heap och stack) dödar processen med orsaken `killed` och loggar en felrapport | `--max-heap` / `--max-stack` (byte) och runtime-gemensamma `--max-memory` får den begärande processen att misslyckas som `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, slutstatus 70 | [runtime-heap](runtime-heap.md#runtime-memory-limit) |
| Programargument | `escript` skickar varje argument till `main/1`; emulatorflaggor (`+t`) kommer från `%%!` eller `ERL_FLAGS` | Inledande runtime-alternativ (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) plockas ut först; `CLAUSE_FLAGS` innehåller samma alternativ | [körbara filer](executables.md#runtime-options) |
| Ofångat undantag i en vanlig ingångsmodul | `escript` avslutar med 127 | Avslutar med 1 och en rad `uncaught exception <class>: <reason>` (escript-källor behåller 127) | [körbara filer](executables.md) |
| Kompilatordiagnostik | Formuleringar från `erl_lint` (`variable 'X' is unbound`) och varningar | Egna formuleringar (`unbound variable X`); OTP:s lint-varningar ges i regel inte (inte heller för okända fält i native records vid åtkomst, uppdatering och i mönster) | [semantik](semantic.md#bindings) |

## Gränsfall i språket

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Heltalssegment bredare än heltalsgränsen, med ett värde bortom den (`<<V:4194241>>` med bara ettor) | x86-JIT:en matchar med en ogiltig term; att använda den kraschar VM:en | Ingen matchning | [termer](terms.md#integers) |
| Zip-grupp där avslappnade och strikta generatorer delar en variabel | Överhoppningstestet behåller variabler från strikta mönster i de avslappnade mönstren | Ett avvisat steg hoppas över närhelst de strikta mönstren matchar på egen hand | [mönster](patterns.md#comprehensions) |
| Anrop av en extern fun, `M:F(Args)` eller `apply/3` för en modul utanför programmet | Laddar modulen från kodsökvägen, `undef` om den saknas | `undef`; biblioteksmoduler blir del av programmet endast när det namnger dem med en literal atom | [funs](funs.md#dynamic-calls), [bibliotek](library.md#how-programs-get-them) |
| `lists` och `maps` | De fullständiga modulerna; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` följer mapens interna ordning (atomtabellens ordning för atomnycklar, hashordning över 32 nycklar) | [Biblioteksdelmängden](library.md); map-funktioner följer nyckelordning | [bibliotek](library.md) |
| Filer utan `#!` som ges som escripts | `escript file.erl` hoppar över första raden | Kompileras som vanliga moduler | [körbara filer](executables.md) |
| Förkompilerade beam- och arkiv-escripts | Körs | Stöds inte | [körbara filer](executables.md) |
| En `-spec` vars typer inte delar något värde med det härledda resultatet, ingångsdomänen eller argumenten i ett anrop | Kompileras; Dialyzer kan varna | Kompileringsfel som namnger de deklarerade och härledda typerna | [semantisk analys](semantic.md#inference) |

## io

| Skillnad | OTP | Clause | Ägare |
| --- | --- | --- | --- |
| Styrsekvenserna `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, modifieraren `K` | Formateras | `badarg` | [io](io.md#formats) |
| `~p` av behållare nästlade djupare än 256 nivåer | Skrivs ut | `system_limit` | [io](io.md#pretty-printing-p) |
| Fältbredder och precision för `~ts` med kombinerande tecken eller `\r\n` | Räknar grafemkluster | Räknar kodpunkter | [io](io.md#formats) |
| Negativ precision eller utfyllnadsantal (`~.*c` med -1) | Loopar för evigt | `badarg` | [io](io.md#formats) |
| Andra `io`-funktioner än `format/1,2`, `put_chars/1` | Finns | `unknown module io` | [io](io.md#calls) |
