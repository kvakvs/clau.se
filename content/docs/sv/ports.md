---
source: docs/ports.md
sourceCommit: a8c3f8f6
sourceSha256: 59defde90218e0d1374492f8e7fccd5a737dec02f9c4fc9f5f94fc392a26789f
translatedAt: 2026-10-17
---
# Portar

Program får portar så som OTP definierar dem, och extern I/O går genom dem.
Porttabellen, reglerna för avslut och portuppgifterna finns i
`runtime/src/scheduler/ports.cpp`, de inbyggda funktionerna i
`runtime/src/builtins/erlang/ports.cpp`, drivrutinerna och I/O-tråden i
`runtime/src/ports/`. OTP-referenstester (goldens):
`executables_port_identities`, `executables_port_input`,
`executables_port_spawn`, `executables_file_io`, `executables_sockets`,
`executables_many_ports`, `executables_port_fairness`,
`executables_busy_ports`, `executables_slow_owner`; runtime-test
`runtime_port_io`.

## Identitet

- En port är ett omedelbart ord (immediate): tagg `0x7` (`TermKind2::port`
  under den primära taggen `see_termkind2`, bredvid pid:ars `0x3`), med ett
  portnummer som nyttolast, hämtat ur en processgemensam sekvens som aldrig
  återanvänds, precis som pid-nummer
  ([pid:ar](terms.md#pids-and-references)). En runtime godtar endast de nummer
  den själv har utfärdat; förfalskade och främmande portord avvisas.
- Utskrift: `#Port<0.N>`; `port_to_list/1` ger den texten och
  `list_to_port/1` tolkar den (badarg för allt annat).
- Ordning: tal < atomer < referenser < funs < portar < pid:ar < tupler, som i
  OTP; portar jämförs efter nummer.
- En stängd ports identitet förblir giltig: `is_port/1` förblir sant,
  `port_info/1,2` svarar `undefined`, och sändningar till den kastas.
- Portar är omedelbara värden, så kopiering, skräpsamling och meddelanden
  behöver inget nytt.

## Porttabell och ägarskap

- Varje runtime har en porttabell (nummer → port) i sin exekutor, skyddad av
  exekutorns mutex, liksom processernas länkar och namn
  ([arbetstrådar](processes.md#workers)).
- En port registrerar sin drivrutin, sin anslutna process (den som öppnade
  porten, ändras av `port_connect/2` eller `{Pid, {connect, New}}`), sina
  länkar, de monitorer som hålls på den, ett valfritt registrerat namn, sina
  alternativ samt sina bytesräknare för indata och utdata.
- `open_port/2` länkar den nya porten till den som öppnade den. När den
  anslutna processen avslutas stängs dess port; en port som stängs skickar
  exitsignaler till sina länkar och `'DOWN'`-meddelanden till sina monitorer
  med sin orsak (`normal` för en stängning som inte är ett fel, annars en
  POSIX-atom som `epipe`).
- En exitsignal som når en port stänger den med signalens orsak (`kill` från
  `exit/2` som `killed`), utom `normal` genom en länk från en annan process än
  den anslutna, vilket endast tar bort länken. `exit(Port, normal)` stänger
  porten. En ansluten process som har tagit bort länken lämnar sin port öppen
  när den avslutas.
- Ett begäransmeddelande från en annan process än den anslutna, eller ett
  felformat meddelande, skickar exitsignalen `badsig` från porten till den
  anslutna processen; porten förblir öppen.
- En ports exitsignaler och meddelanden till en process som körs på en annan
  arbetstråd väntar tills den processens tidsskiva tar slut (de innehåller
  endast atomer, pid:ar och portar); ett `exit(Port, Reason)` med en
  orsaksterm i avsändarens heap gör att den inbyggda funktionen körs igen
  tills ingen länkad eller övervakande process körs någon annanstans, som för
  processignaler ([arbetstrådar](processes.md#workers)).
- Portar kan få registrerade namn (`register/2`) och `monitor(port, Port)`;
  `link/1` och `unlink/1` accepterar dem.

## Inbyggda funktioner och portmeddelanden

- `is_port/1` (sant för portar), `port_to_list/1`, `list_to_port/1`,
  `ports/0`.
- `port_info/1,2`: `name`, `links`, `id`, `connected`, `input`, `output`,
  `os_pid`, `monitors`, `monitored_by`, `registered_name`, `queue_size`
  ([upptagna portar](#busy-ports)).
- `port_close/1`, `port_connect/2`, `port_command/2,3`; meddelandena
  `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}`.
- `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` på portar; `register/2`
  av en port.
- `port_control/3`, `port_call/3`: `badarg` för drivrutiner utan styrning;
  drivrutinerna för `file` och socketar styrs med `port_control/3`.
- `open_port({fd, In, Out}, Opts)`, `open_port({spawn, Command}, Opts)`,
  `open_port({spawn_executable, File}, Opts)` och de interna drivrutinerna i
  projektets bibliotek (`file`, socketar).

Fel följer OTP: `badarg` för en stängd eller ogiltig port och felaktiga
argument, POSIX-orsaken (`enoent`, `eacces`) som ett `error` för en öppning som
misslyckas.

Meddelanden från en port går till dess anslutna process:
`{Port, {data, Data}}`, `{Port, eof}` (alternativet `eof`),
`{Port, {exit_status, Status}}` (alternativet `exit_status`),
`{Port, closed}` (efter `{Pid, close}`), `{Port, connected}` (till den
tidigare ägaren efter en anslutning).

## Datalägen och alternativ

| Alternativ | Effekt |
| --- | --- |
| `stream` (standard), `{packet, N}` (N = 1, 2, 4) | Bytes allteftersom de anländer, eller meddelanden inramade av en N-bytes längd i big-endian som även utdata får |
| `{line, L}` | `{eol, Line}` per rad, `{noeol, Part}` för delar längre än `L` eller ett oavslutat slut |
| `binary` | Data som binaries i stället för bytelistor |
| `eof` | `{Port, eof}` vid slutet av indata; porten förblir öppen tills den stängs |
| `exit_status` | `{Port, {exit_status, S}}` när programmet avslutas (spawn-portar) |
| `use_stdio` (standard), `nouse_stdio`, `stderr_to_stdout`, `in`, `out`, `hide` | Som i OTP (`hide` har ingen effekt) |
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Spawn-portar ([delprocesser](#subprocesses)) |
| `{busy_limits_port, {Low, High} \| disabled}` | Köade utdatabytes som gör porten upptagen ([upptagna portar](#busy-ports)) |

Utan `eof` stänger slutet av indata porten med orsaken `normal`, efter
meddelandet `exit_status` om ett sådant begärdes. Okända alternativ ger
`badarg`.

## Drivrutiner

En drivrutin är ett C++-objekt bakom en port (`runtime/src/ports/`): den
öppnar resursen, tar emot utdata (`port_command`), svarar på `port_control/3`
när den stöder styrning, rapporterar indata och fel som händelser och stänger.
Drivrutiner:

- `fd`: befintliga deskriptorer, utdata skrivs synkront, indata genom
  I/O-tråden.
- `spawn`: ett barnprogram med sin stdin och stdout som rör (pipes)
  ([delprocesser](#subprocesses)).
- `file`: en öppen fil i projektbibliotekets modul `file`; dess operationer är
  synkrona `port_control/3`-anrop som kan blockera arbetstråden som kör
  anroparen under diskoperationens varaktighet, som OTP:s smutsiga
  I/O-schemaläggare (dirty I/O schedulers) gör
  ([filer](#standard-io-and-files)).
- `tcp_inet`, `udp_inet`: socketar för projektbibliotekets `gen_tcp`,
  `gen_udp` och `inet` ovanpå Boost.Asio; anslutningar, accepteranden och
  mottagningar är asynkrona ([socketar](#sockets)).

De interna drivrutinerna för `file` och socketarna öppnas med
`{spawn_driver, Name}` under Clause-namn, och deras `port_control/3`-operationer
är ett Clause-protokoll: program använder biblioteksmodulerna, inte OTP:s
protokoll `prim_inet`/`efile`.

## I/O-tråd

En I/O-tråd per runtime (`detail::Reactor`, `runtime/src/ports/reactor.hpp`)
kör en Boost.Asio-`io_context`: en I/O-kompletteringsport (I/O completion
port) på Windows, `epoll` på Linux, `kqueue` på macOS. Den första porten som
behöver den startar den; den betjänar alla sorters portar, så en port kostar
ingen egen tråd:

- Rör för startade program: överlappade namngivna rör på Windows
  (`windows::stream_handle`; anonyma rör kan inte överlappas), vanliga rör
  annars (`posix::stream_descriptor`). Utdata köas och skrivs i ordning med
  asynkrona skrivningar.
- `fd`-indata på Linux och macOS: tråden väntar tills deskriptorn är läsbar,
  sedan tar ett `read()` det som finns, så att programmets egna deskriptorer
  behåller sitt blockerande läge; en vanlig fil, som inte går att vänta på,
  läses direkt.
- Programavslut: på Windows väntar systemets trådpool för väntan
  (`RegisterWaitForSingleObject`, som Asios `object_handle` använder) på
  processhandtaget och avslutet rapporteras på I/O-tråden; på Linux och macOS
  tar en `SIGCHLD`-hanterare (`signal_set`) och `waitpid(WNOHANG)` hand om
  varje bevakat program, även efter att dess port har stängts.
- Socketar ([socketar](#sockets)).
- Undantag: ett `fd`-indatahandtag på Windows (en konsol eller ett ärvt
  anonymt rör) kan inte överlappas, så det läses av en egen blockerande tråd,
  som libuv och ERTS gör; att stänga porten avbryter läsningen
  (`CancelSynchronousIo`) och släpper tråden.

`runtime/src/ports/io*.cpp` innehåller port-I/O:n (`detail::IoService`): dess
metoder lägger endast upp arbete på I/O-tråden, där allt I/O-tillstånd finns.
I/O-tråden lämnar över indata så som den lästes: råa bytes, slutet av indata,
ett läsfel, ett programs avslutsstatus. Sockethändelser (meddelanden,
accepterade anslutningar) lämnas över på samma sätt.

Prototypen `tests/prototypes/poller/` (`run.py --wsl`) visar väckningen på
Windows (kompletteringsport) och WSL Linux (`poll()`): en ledig
schemaläggartråd vaknar 9–91 µs efter indata, och nedstängning stoppar
I/O-tråden utan indata.

Vid programmets slut stängs varje port (barnprogram ser slutet av indata; de
dödas inte, som i OTP) och I/O-tråden stoppas: den förenas (join) utanför
exekutorns mutex, eftersom en pågående leverans tar mutexen; en Windows-läsare
för `fd` som är blockerad i en läsning som inte kan avbrytas kopplas loss och
levererar inget mer.

## Portuppgifter

En port schemaläggs som en process: det som I/O-tråden lämnar över väntar i
porten, och porten väntar i exekutorns portkö tills en arbetstråd i
schemaläggaren kör dess uppgift.

- Arbetstrådar tar växelvis en portuppgift och en processtidsskiva medan båda
  köerna har arbete, så en port som översvämmas av indata kan inte svälta
  processer, och processer kan inte svälta portar; en ledig arbetstråd tar det
  som står i kö.
- En uppgift körs under exekutorns mutex i `PORT_TASK_REDUCTIONS` (en
  tidsskivas 4 000): varje meddelande den levererar kostar 100 reduktioner
  plus en per 64 bytes som det bär. En port med arbete kvar köas igen längst
  bak.
- Uppgiften ramar in indata (`InputDecoder`): strömindata kommer i de bitar
  som läsningar returnerar; `{packet, N}` håller kvar bytes tills ett helt
  paket har anlänt (ett ofullständigt paket vid slutet av indata kastas, som i
  OTP); `{line, L}` delar vid `\n`, skickar en rad längre än `L` som
  `{noeol, Part}`-delar och ett oavslutat slut som `{noeol, Rest}`.
  `port_info(P, input)` räknar varje läst byte, inklusive radbrytningar och
  pakethuvuden, när den läses.
- Slutet av indata skickar `{Port, eof}` med alternativet `eof`, annars stängs
  porten med orsaken `normal`; ett läsfel stänger den med `eio`.
- Ett meddelande blir ett meddelande till dess process direkt när den
  processen inte körs på en arbetstråd (och väcker den som vilket meddelande
  som helst), annars när dess tidsskiva tar slut, så att heapen hos en körande
  process aldrig berörs av en annan tråd.
- Kommandon, stängningar, anslutningar och exitsignaler som skickas till en
  port verkar direkt på avsändarens arbetstråd, som ERTS gör för en port som
  inte är upptagen: en `fd`-port skriver sin utdata direkt på anroparens
  arbetstråd; rör- och socketdrivrutinerna köar utdata och låter I/O-tråden
  skriva den; en upptagen port suspenderar avsändaren
  ([upptagna portar](#busy-ports)).

## Upptagna portar

Utdata som en drivrutin köar för I/O-tråden (rör för startade program) räknas
mot portens gränser för upptagenhet, OTP:s `busy_limits_port`
(standardvärden: hög 8 192 bytes, låg 4 096;
`{busy_limits_port, {Low, High}}` eller `disabled` som ett alternativ till
`open_port/2`, gränser minst 1, en låg gräns över den höga sänks till den):

- En skrivning som tar den köade utdatan till den höga gränsen eller över
  skickas ändå och gör porten upptagen; den förblir upptagen tills I/O-tråden
  har skrivit så mycket att mindre än den låga gränsen står i kö.
- `port_command/2` och `Port ! {Pid, {command, Data}}` till en upptagen port
  suspenderar avsändaren, som inte skriver något; när porten inte längre är
  upptagen, eller stängs, kör avsändaren sin inbyggda funktion igen (en stängd
  port ger då `badarg`, som i OTP). En suspenderad process tar fortfarande
  emot exitsignaler.
- `port_command/3` med `nosuspend` returnerar `false` för en upptagen port och
  skriver inget; `force` kastar `notsup`, eftersom OTP:s spawn- och
  `fd`-drivrutiner inte tillåter det.
- `port_info(P, queue_size)` är den utdata som står i kö och ännu inte har
  skrivits.
- `fd`-portar skriver direkt och socketutdata går genom `port_control/3`, så
  ingen av dem är någonsin upptagen.

En port begränsar även den indata den håller:

- När mer än 64 KiB rå indata väntar på portens uppgift slutar I/O-tråden att
  läsa porten (ett program som skriver till den blockeras då, som vid ett
  fullt rör) tills uppgiften har tagit den under 32 KiB.
- Medan den anslutna processen kan köras (den körs eller står i kö, väntar
  inte i en `receive`, är inte suspenderad eller blockerad) och redan håller
  1 024 meddelanden (eller har lika många portsignaler som väntar på att dess
  tidsskiva ska ta slut), levererar portens uppgift inget mer förrän den
  processens tidsskiva har tagit slut. En process som väntar i en `receive`
  får alltid indata, så en receive efter ett senare meddelande från porten kan
  inte vänta för evigt.

## Delprocesser

`open_port({spawn, Command}, Options)` och
`open_port({spawn_executable, File}, Options)` startar ett program vars stdin
och stdout är portens rör:

- `{spawn, Command}`: på Linux och macOS `/bin/sh -c Command`; på Windows
  `CreateProcessW` med `Command` som kommandorad (den hittar programmet i
  sökvägen). `{spawn_executable, File}` kör `File` utan skal, med argv[0]
  `{arg0, A}` (standard `File`) och `{args, List}`; på Windows citeras
  argument enligt reglerna för `CommandLineToArgvW`.
- `{env, [{Name, Value | false}]}` sätter eller tar bort variabler för barnet,
  `{cd, Dir}` dess katalog, `stderr_to_stdout` slår ihop stderr med porten;
  annars delar barnet programmets stderr. `in` öppnar inget stdin-rör och
  `out` inget stdout-rör (null-enheten i stället). `hide` och `overlapped_io`
  har ingen effekt.
- Ett program som inte kan startas kastar `error:Reason` med POSIX-orsaken
  (`enoent`, `eacces`, `enoexec`); felaktiga namn och alternativ kastar
  `badarg`.
- Utdata köas och skrivs av I/O-tråden, med portens gränser för upptagenhet
  ([upptagna portar](#busy-ports)); att stänga porten låter den slutföra det
  som står i kö och stänger sedan programmets stdin. Programmet dödas aldrig;
  det avslutas vanligtvis vid slutet av indata.
- Alternativet `exit_status` skickar `{Port, {exit_status, S}}` när programmet
  har avslutats (dess avslutskod; på Linux och macOS 128 plus signalen för ett
  program som en signal avslutade) och före `{Port, eof}` eller stängningen
  vid slutet av indata; en port som inte läser något rapporterar det när
  programmet avslutas och stängs sedan.
- `port_info(P, os_pid)` är programmets process-id; `name` är kommandot eller
  filen.
- Bibliotekets `os:cmd/1` kör `Command` med `COMSPEC /c` på Windows (`cmd` om
  den inte är satt) eller `/bin/sh -c`, samlar in stdout och stderr tills
  programmet stänger dem och returnerar bytes som en lista; `os:type/0` är
  `{win32, nt}`, `{unix, linux}` eller `{unix, darwin}`; `os:getenv/1`
  returnerar en sträng eller `false`.

## Standard-I/O och filer

- `io:format`, `io:put_chars` och `erlang:display` skriver direkt till
  standard-utdata ([io](io.md)). Standard-indata läses av en serverprocess i
  biblioteket, registrerad som `clause_stdin` och startad vid första
  användning, som äger en `{fd, 0, 1}`-port: `io:get_line/1,2` skriver
  prompten och returnerar sedan nästa rad med dess radbrytning, resten av
  indata utan radbrytning i slutet, och sedan `eof`; `io:get_chars/2,3`
  returnerar upp till `N` tecken, sedan `eof`. Begäranden från flera processer
  besvaras i ankomstordning. Indata returneras som bytes (ett listelement per
  byte).
- Bibliotekets modul `file` driver runtimens fildrivrutin,
  `{spawn_driver, "clause_file"}`, med `port_control/3`. Dess operationer
  (`ports/file.cpp`: open, read, write, position, read_line, close och
  sökvägsoperationerna read_file, write_file, delete, rename, list_dir,
  make_dir, del_dir och read_file_info, `ports/file_info.cpp`; get_cwd,
  set_cwd, read_link, read_link_info, make_link och make_symlink,
  `ports/file_paths.cpp`) är synkrona systemanrop på anroparens arbetstråd,
  utanför exekutorns mutex; deras svar börjar med en statusbyte (0 ok, 1 fel
  och dess POSIX-orsak, 2 filslut). Protokollet är Clauses eget. read_line
  läser 64 KB i förväg och returnerar rader från den bufferten; varje annan
  operation på filen söker först tillbaka över de bytes den inte har
  returnerat, så att positionerna förblir exakta.
- `file:open/2` returnerar en I/O-servers pid som äger en filport och är
  länkad till den som öppnade (lägena `read`, `write`, `append`, `exclusive`,
  `binary`; andra lägen ignoreras, som OTP ignorerar alternativ den inte
  använder; `write` trunkerar om inte även `append` anges).
- `file:write_file/3` öppnar med sina lägen plus `binary` och `write`;
  `file:read_file_info/1,2` returnerar OTP:s `#file_info{}` från sökvägens
  status (länkar följs), med tider som lokalt eller universellt datum och tid
  eller POSIX-sekunder (`{time, local | universal | posix}`; `raw` godtas). På
  Windows är `inode`, `uid` och `gid` 0 och `major_device` är enhetsnumret, så
  som OTP rapporterar dem. `read/2`, `read_line/1`, `write/2`, `position/2`
  och `io:get_line/2`, `io:get_chars/3` på den är begäranden till den servern;
  efter `close/1` returnerar begäranden `{error, terminated}` och `close/1`
  förblir `ok`.
- OTP:s I/O-protokoll: standard-indataservern och servern för varje öppen fil
  besvarar `{io_request, From, ReplyAs, Request}` med
  `{io_reply, ReplyAs, Reply}`, som `io:request/1,2` och `io:requests/1,2`
  skickar (`standard_io` och `user` namnger standard-indataservern, en annan
  atom en registrerad process; `{error, arguments}` när den inte är
  registrerad, `{error, calling_self}` för anroparen själv). Begäranden:
  `get_until` (`M:F(Cont, Chars | eof, Extra...)` från `Cont = []`, matad med
  det som är buffrat eller filblock om 4 KiB tills `{done, Result, Rest}`;
  `Rest` läses igen av nästa begäran: det behålls i bufferten, eller för en
  fil flyttas positionen tillbaka över det), `get_line`, `get_chars`,
  `put_chars` (tecken eller `M:F(A)`), de gamla formerna utan kodning
  (latin1) och `{requests, List}` (i ordning, stannar vid första
  `{error, _}`). Tecken är bytes, som ovan; en fil i binärläge returnerar ett
  listresultat från `get_until` som en binary. Andra får
  `{error, {request, Request}}`. En `get_until`- eller `put_chars`-funktion som
  misslyckas får en fils server att svara `{error, Function}` och avsluta med
  felet, som OTP:s gör; den som öppnade lever vidare (OTP:s filserver är inte
  länkad till den). Indatabegäranden på standard-indata skriver sin prompt.
- Kataloger, länkar och kopior: `get_cwd/0` stavar den aktuella katalogen som
  OTP gör (snedstreck framåt, liten enhetsbokstav), `get_cwd/1` tar en
  Windows-enhet (`enotsup` på andra system); `set_cwd/1` ändrar den för hela
  programmet; `read_link/1`, `read_link_all/1` (`einval` för en sökväg som
  inte är en länk), `read_link_info/1,2` (en slutlig länks egen status: POSIX
  `lstat`, på Windows målets fält med typen `symlink`), `make_link/2`,
  `make_symlink/2` (kräver en behörighet på Windows: `eperm`, som OTP),
  `list_dir_all/1`, `del_dir_r/1`, `copy/2,3` (namn, `{Name, Modes}` eller
  öppna filer; `{ok, BytesCopied}`), `raw_read_file_info/1`, `read_file/2`,
  `delete/2`, `native_name_encoding/0` (`utf8`). `del_dir/1` svarar `enoent`
  för en saknad sökväg och `enotdir` för en fil. `consult/1` och familjen
  `eval`/`script` förblir stubbar: de behöver OTP:s genererade parser.
- Clauses `file` är fillagret; OTP:s `filelib` och `filename` är vanlig Erlang
  som körs ovanpå det när ett programs sökväg innehåller OTP:s källkod
  (`filelib:fold_files/5` behöver `re`); `erl_prim_loader` tillhandahålls
  ovanpå `file` med OTP:s nakna `error`-svar och en laddningssökväg `["."]`
  (`set_path/1`), dess laddnings- och arkivfunktioner avböjs fram till plan
  step 71; `prim_file` och `prim_buffer` saknas fortfarande, så OTP:s
  anropare av `raw_file_io*` kommer aldrig in i ett program.
- Fel följer OTP: `{error, enoent}`, `eexist`, `eisdir` (en katalog som
  öppnas eller läses som en fil), `einval` (en negativ position), `ebadf`
  (läsning av en fil som bara är skrivbar eller skrivning till en som bara är
  läsbar), `badarg` för felaktiga namn och data. Filnamn är strängar,
  binaries eller atomer, kodade som UTF-8.

## Socketar

En socket är en port, som med OTP:s backend `inet_drv`: `is_port(Socket)` är
sant och meddelanden i aktivt läge är `{tcp, Socket, Data}`,
`{tcp_closed, Socket}`, `{tcp_error, Socket, Reason}`,
`{udp, Socket, Address, Port, Data}`. Delmängden: `gen_tcp:connect/3,4`,
`listen/2`, `accept/1,2`, `send/2`, `recv/2,3`, `close/1`,
`controlling_process/2`, `shutdown/2`; `gen_udp:open/1,2`, `send/4`,
`recv/2,3`, `close/1`; `inet:setopts/2`, `inet:port/1`, `inet:peername/1`,
`inet:sockname/1`; lägena `{active, true | false | once}`, `binary`/`list`,
`{packet, 0 | 1 | 2 | 4 | raw}`, `{reuseaddr, Bool}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6`; IPv4- och IPv6-adresser
som tupler, värdnamn som strängar eller atomer (`loopback` inräknat).
Justeringsalternativen `nodelay`, `keepalive`, `send_timeout`,
`send_timeout_close`, `delay_send` och `exit_on_close` accepteras men
tillämpas inte; alla andra alternativ ger `exit(badarg)`, som för ett ogiltigt
alternativ i OTP.

Implementation (`runtime/src/ports/sockets.cpp`):

- Runtimens I/O-tråd ([I/O-tråd](#io-thread)) betjänar socketarna; varje
  sockets tillstånd finns på den tråden. Biblioteket öppnar en port med
  `{spawn_driver, "tcp_inet" | "udp_inet"}` och driver den med
  `port_control/3`; den anropande arbetstråden lägger upp operationen på
  I/O-tråden och väntar på dess synkrona svar (statusbyte 0 och ett resultat,
  eller 1 och en POSIX-orsak).
- Operationer som väntar (connect, accept, recv) svarar senare med ett
  meddelande `{clause_socket, Socket, Reply}` till sin anropare, så att
  anroparen blockeras i en vanlig `receive` och andra processer fortsätter att
  köras. En tidsgräns avbryter begäran; själva avbrottet svarar `cancelled`
  efter allt som socketen skickat dessförinnan, så att ett svar som vann
  kapplöpningen returneras i stället för att gå förlorat.
- Socketmeddelanden beskrivs utanför heapen (`ports/value.hpp`) och byggs i
  mottagarens heap när de levereras ([portuppgifter](#port-tasks)). En
  accepterad anslutning blir en ny port som ägs av och är länkad till den som
  anropade `accept`, med den lyssnande socketens läge.
- `controlling_process/2` stoppar aktiv leverans, flyttar socketens
  meddelanden som redan skickats till den tidigare ägaren till den nya, och
  ansluter sedan om porten, som OTP:s `inet` gör; endast ägaren får anropa den
  (`{error, not_owner}`).
- Utdata köas utan tak och skrivs i ordning på I/O-tråden. Att stänga en port
  skickar det som står i kö och stänger sedan anslutningen på ett ordnat sätt
  (FIN); en stängd port svarar varje väntande anropare `{error, closed}`.
  Namnuppslagning körs på anroparens arbetstråd, eftersom den blockerar.
- Socketportar schemaläggs som andra portar ([portuppgifter](#port-tasks)):
  en sockets meddelanden väntar i dess port tills portens uppgift levererar
  dem.
- Adresser och värdar: `inet:parse_address/1,2`, `parse_strict_address/1,2`,
  `parse_ipv4_address/1`, `parse_ipv4strict_address/1`,
  `parse_ipv6_address/1`, `parse_ipv6strict_address/1` (OTP:s tillåtande
  former: korta och oktala eller hexadecimala IPv4-fält, `::`, IPv4-svansar,
  `%scope` för `fe80::` och `ff02::`), `ntoa/1` (OTP:s stavning:
  hexadecimalt med gemener, den första längsta nollsekvensen som `::`),
  `is_ipv4_address/1`, `is_ipv6_address/1`, `is_ip_address/1` är Erlang;
  `gethostname/0` (en socketoperation), `getaddr/2`, `getaddrs/2` (systemets
  resolver, `getaddrinfo`) och `gethostbyname/1,2` (`h_name` är det
  efterfrågade namnet, inga alias) svarar genom en socketport som öppnas för
  förfrågan.
- Clauses `gen_tcp`, `gen_udp` och `inet` är nätverkslagret och växer mot
  OTP:s exportlistor när program behöver det; OTP:s moduler `socket` och
  `net` (socket-NIF-API:t) saknas, liksom `prim_socket`, `prim_net`,
  `prim_inet` och `socket_registry`.

## Tillhandahålls inte

Inlänkade drivrutiner (linked-in drivers) och NIF:ar,
`erlang:open_port({spawn_driver, Name})` för OTP-drivrutinsnamn,
distributionsportar, `port_call/3` på de tillhandahållna drivrutinerna utöver
bibliotekets eget protokoll, upptagna socketportar samt alternativen
`overlapped_io`, `parallelism` och `busy_limits_msgq`.
