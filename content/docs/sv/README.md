---
source: docs/README.md
sourceCommit: 06042fa
sourceSha256: f48733b2827bbf09b77162c249d6b913411b1f3a60e76cf52b281ba68666f65b
translatedAt: 2026-10-09
---
# Clause-dokumentation

Korta referensanteckningar för den nuvarande implementationen. Varje fil
beskriver beteende och begränsningar som finns i dag; planer och steghistorik
finns i `.agents/`.

| Ämne | Dokument |
| --- | --- |
| Förbehandling (`epp`-beteende, inkluderingar, makron, funktioner) | [preprocessor.md](preprocessor.md) |
| Parsning, ägarskap för AST, syntaxbegränsningar | [parser.md](parser.md) |
| TOML-projekt och val av mål | [projects.md](projects.md) |
| Kompilatorns CLI, artefakter, LLVM SDK, exempel | [compile.md](compile.md) |
| Startpunkt för körbara filer, argument, slutstatus, utdataströmmar, länkning | [executables.md](executables.md) |
| Semantisk analys, typer, inferens, bindningar | [semantic.md](semantic.md) |
| Policy för typspecialisering | [specialization.md](specialization.md) |
| ABI för genererad kod: termer, symboler, registrering, fel, rötter | [abi.md](abi.md) |
| Mönster, klausuler och matchningar i funktionskroppar | [patterns.md](patterns.md) |
| Guards och katalogen över guard-BIF:ar | [guards.md](guards.md) |
| Termrepresentationer (atomer, tal, behållare, maps, bitar, records) och utskrift | [terms.md](terms.md) |
| Native, kvalificerade och anonyma records (OTP 29) | [native-records.md](native-records.md) |
| Funktionsvärden: `fun F/A`, `fun M:F/A`, anrop av funs | [funs.md](funs.md) |
| Inbyggda produktionsfunktioner: katalog, bryggaanrop, inbyggda funs, registrering | [builtins.md](builtins.md) |
| Biblioteksmoduler (delmängder av `lists`, `maps`) som kompileras med program | [library.md](library.md) |
| Konsolutdata: `io:format/1,2`, `io:put_chars/1`, `~p`-layout | [io.md](io.md) |
| Runtime-livscykel, minne, standardutdata, kodserver, schemaläggarens bokföring | [runtime.md](runtime.md) |
| Processer: schemaläggarens arbetstrådar, tidsskivor, `spawn/1,3`, `is_process_alive/1`, länkar, exit-signaler, monitorer, registrerade namn | [processes.md](processes.md) |
| Portar: identitet, porttabell, drivrutiner, datalägen, I/O-tråden, standard-I/O, filer och sockets (beslut i plan step 57A) | [ports.md](ports.md) |
| Kontrakt för processheapen: ordlayout, områden, tillträde, rötter, skräpsamling | [runtime-heap.md](runtime-heap.md) |
| Beslut om exekveringsmodell: ramar, anrop, svansanrop, yield, undantag | [execution-model.md](execution-model.md) |
| Rapportering av uppskjutna funktioner (`notimpl`) | [features.md](features.md) |
| Fastlåst OTP-källreferens och uppdateringsprocedur | [otp-reference.md](otp-reference.md) |
| Kända beteendeskillnader mot Erlang/OTP | [differences.md](differences.md) |
| Valideringsbaslinje, testlägen, plattformsluckor, historik | [validation.md](validation.md) |

Äldre valideringsposter per steg och bevis-JSON har sammanfattats i
[valideringshistoriken](validation.md#history); de fullständiga originalen finns
kvar i Git-historiken (senast närvarande i commit `2777c98`).
