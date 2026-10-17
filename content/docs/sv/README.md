---
source: docs/README.md
sourceCommit: a8c3f8f6
sourceSha256: 2124516a48ed02c82259ea7ac1d86d673aaf9cff2feba5044f3db2a30ad0db18
translatedAt: 2026-10-17
---
# Clause-dokumentation

Korta referensanteckningar för den nuvarande implementationen. Varje fil
beskriver beteende och begränsningar som finns i dag; planer och steghistorik
finns i `.agents/`.

| Ämne | Dokument |
| --- | --- |
| Förbehandling (`epp`-beteende, inkluderingar, makron, funktioner) | [preprocessor.md](preprocessor.md) |
| Parsning, ägarskap för AST, syntaxbegränsningar | [parser.md](parser.md) |
| TOML-projekt, val av mål, byggkatalog och cacher, ignorerade källfiler | [projects.md](projects.md) |
| Kompilatorns CLI, artefakter, utskrift av källkod och abstrakt format, kompileringscache, LLVM SDK, PCRE2 och zlib, exempel | [compile.md](compile.md) |
| Startpunkt för körbara filer, argument, slutstatus, utdataströmmar, länkning | [executables.md](executables.md) |
| Felsökningsinformation (`-g`), debuggrar och Erlangs anropsstack | [debugging.md](debugging.md) |
| Profilering som slås på explicit (`--profile FILE`): anrop och egen tid per funktion och process | [profiling.md](profiling.md) |
| Parse transforms: värdens OTP-laddare, utbyte av abstrakt format, uppslagning av transformer | [transforms.md](transforms.md) |
| Semantisk analys, typer, inferens, bindningar | [semantic.md](semantic.md) |
| Typspecialisering vid `-O2`: bevis och representationsvarianter | [specialization.md](specialization.md) |
| ABI för genererad kod: termer, symboler, registrering, fel, rötter | [abi.md](abi.md) |
| Mönster, klausuler, matchningar i funktionskroppar och comprehensions | [patterns.md](patterns.md) |
| Guards och katalogen över guard-BIF:ar | [guards.md](guards.md) |
| Termrepresentationer (atomer, tal, behållare, maps, bitar, records) och utskrift | [terms.md](terms.md) |
| Native, kvalificerade och anonyma records (OTP 29) | [native-records.md](native-records.md) |
| Funktionsvärden: `fun F/A`, `fun M:F/A`, closures, namngivna funs, dynamiska anrop | [funs.md](funs.md) |
| Inbyggda produktionsfunktioner: katalog, bryggaanrop, inbyggda modulfunktioner, portioner, registrering | [builtins.md](builtins.md) |
| Biblioteksmoduler under `library/{erts,kernel,stdlib}` som kompileras med program, hur program får dem, tillhandahållna och saknade moduler | [library.md](library.md) |
| Konsolutdata: `io:format`, `io:put_chars`, enheter, formatdirektiv, `~p`-layout | [io.md](io.md) |
| Runtime-livscykel, minne, kodserver, persistenta termer, trådar, standardutdata, uppstart | [runtime.md](runtime.md) |
| Processer: schemaläggarens arbetstrådar, meddelanden och receive, länkar, monitorer, registrerade namn, timers, introspektion, alias, exit-signaler | [processes.md](processes.md) |
| Portar: identitet, porttabell, drivrutiner, datalägen, I/O-tråden, upptagna portar, underprocesser, standard-I/O, filer och sockets | [ports.md](ports.md) |
| Kontrakt för processheapen: ordlayout, områden, tillträde, rötter, skräpsamling | [runtime-heap.md](runtime-heap.md) |
| Exekveringsmodell: ramar, anrop, svansanrop, yield, undantag | [execution-model.md](execution-model.md) |
| Rapportering av uppskjutna funktioner (`notimpl`) | [features.md](features.md) |
| Fastlåst OTP-källreferens och uppdateringsprocedur | [otp-reference.md](otp-reference.md) |
| Kända beteendeskillnader mot Erlang/OTP | [differences.md](differences.md) |
| Valideringsbaslinje, testlägen, plattformsluckor, benchmarks, historik | [validation.md](validation.md) |

Äldre valideringsposter per steg och bevis-JSON har sammanfattats i
[valideringshistoriken](validation.md#history); de fullständiga originalen finns
kvar i Git-historiken (senast närvarande i commit `2777c98`).
