---
source: docs/validation.md
sourceCommit: a8c3f8f6
sourceSha256: 54f5af0873d1220b42924fb4323bb6d19263b4e6301ffc0aa412ca04dcd9e835
translatedAt: 2026-10-17
---
# Validering

## Nuvarande baslinje

Senast registrerade grindresultat på Windows x64-utvecklingsvärden (clang-cl och
LLVM SDK 23.1.2, `/MT`, `_ITERATOR_DEBUG_LEVEL=0`); senare steg registrerar sina
i `.agents/00-finished.md`:

| Kontroll | Resultat |
| --- | --- |
| Färsk kombinerad Debug-CTest (2026-10-14) | 299/300 godkända; felet är den kända IR-storleksgränsen i `codegen_measurements`; `codegen_resource_cli` är inaktiverat |
| `check-quality-all` (samma körning) | Rent; Lizard CCN 10 |
| Valfria OTP-granskningstester (2026-10-14, pin `d199a49a01a2`, orakel OTP 29.1.1) | 17/17 |
| `regenerate.py --corpus all --check` (samma) | 19/19 korpusar återskapas |

## Köra grinden

Från ett x64-utvecklarskal för Visual Studio med `C:\Program Files\LLVM\bin` i
`PATH` (automatiskt val av SDK återanvänder `thirdparty/`):

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files + dependents
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` kör golden-korpusar vid O0 positionellt plus
  O2-projekt utan specialisering, kör mutationer en gång och hoppar över
  `full_only`-tester (separata konsumentprojekt som `runtime_generated_link`,
  mätningar, granskningen `library_freshness` mot värdens OTP). Fullt läge
  (standard) kör alla kombinationer av drivrutin/policy.
- Långa tester som drivs av ett Python- eller CMake-skript har en fast
  CTest-`COST`: CTest lär sig ett omslags kostnad från dess egen lilla CPU-tid
  och skulle starta dem sist.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multiplicerar gränserna per körning för
  golden-köraren (60 s) och köraren för semantiska fall (15 s) för
  instrumenterade byggen.
- `check-quality`, `make format` och `make-format.bat` omfattar filer som
  ändrats sedan `HEAD` plus ospårade filer; `cmake/quality_scope.py` lägger till
  översättningsenheter som inkluderar en ändrad header (från Ninjas
  beroendedata för valfri konfiguration) och, för clang-tidy, enheter vars
  kompileringskommando skiljer sig från det som den senaste godkända körningen
  registrerade (`build/debug/quality/tidy-commands.json`), så att en ändring av
  en byggregel bara kontrollerar om de enheter den ändrar. Ändringar i
  `.clang-tidy` eller tidy-skripten väljer allt, liksom ändringar av byggregler
  före den första registrerade körningen.
- `CLAUSE_OPTIMIZED_COMPILER` (standard ON) kompilerar `clau` och
  kompilatorbiblioteken optimerade även i Debug-byggen, med bibehållen
  felsökningsinformation och Debug-budgetarna för inferens; testerna tillbringar
  det mesta av sin tid i `clau`. När en kompilatorkrasch behöver stegas igenom,
  konfigurera med `-DCLAUSE_OPTIMIZED_COMPILER=OFF`, bygg om och kör det
  misslyckade testet igen.
- Testprogram har ingen felsökningsinformation (inga PDB:er); konfigurera med
  `-DCLAUSE_TEST_DEBUG_INFO=ON` för att bygga om dem för en debugger. Nästlade
  native-konsumenter länkar föräldrabyggets runtime via
  `ClauseRuntimeTargets.cmake` i stället för att kompilera den igen; endast
  `runtime_link` bygger runtime fristående.
- Tröskelvärden och undertryckningar höjs aldrig för att klara grinden. Två
  undantag för tredjepartskod är konfigurerade (användarens beslut):
  `cmake/tidy_filter.py` tar bort rapporter från den statiska analysatorn som
  ligger i Boost-headers (falska positiva för limb-lagring i
  Boost.Multiprecision på Linux som en omskrivning av den anropande koden bara
  flyttar) och räknar dem i utdata, och `bugprone-exception-escape` ignorerar
  `bad_array_new_length` (MSVC:s flyttkonstruktorer för map/set allokerar; ett
  allokeringsfel är ändå fatalt).
- clang-tidy kontrollerar projektets headers på varje värd: headerfiltret
  godtar avgränsarna `/` och `\`.

### Linux

Samma grind körs på Linux med det fastlåsta LLVM 23.1.2 SDK för Linux som
värdkompilator (`CC`/`CXX` från dess `bin/`), systemets libstdc++, Ninja och
CMake 3.28 eller nyare. Boost 1.90 och toml++ 3.4.0 kommer från installerade
paket eller extraheras till `thirdparty/` (`boost_1_90_0/`,
`tomlplusplus-3.4.0/`); endast Windows laddar ned dem. Versionsarkivets
`ld.lld` länkar ICU 70 (Ubuntu 22.04) och dess `lldb` länkar Python 3.14; på
värdar utan dem behöver `linking_lto` ICU 70 i `LD_LIBRARY_PATH`, och
`linking_debugger` använder GDB.

```sh
cmake --preset debug --fresh -G Ninja -DBUILD_TESTING=ON
cmake --build build/debug
ctest --preset debug -j 16
```

`check-quality` (Lizard, clang-tidy) körs endast på Windows-värden för
utveckling; andra värdar bygger och kör testerna (den var ren på Linux en gång,
se [historik](#history)).

### Andra mål

32-bitars- och ARM-mål kontrolleras utan en kompilator byggd för dem (inget
LLVM SDK finns för de värdarna):

- Ett bygge med endast runtime (`-DCLAUSE_BUILD_COMPILER=OFF -DBUILD_TESTING=ON`)
  för målet kör runtime- och ABI-testerna där: inbyggt, i ett användarland för
  målet (chroot) eller genom värdens emulator (qemu binfmt).
- `tests/compiler/executables/cross.py` kör varje golden för körbara filer och
  varje programfixtur med den här värdens `clau`, `--target-triple`, det
  byggets runtime-arkiv och en `--linker` som når målets bibliotek
  (`run.py --target-option` skickar dem vidare).

## Fixturer och ursprung

- Normala byggen och tester behöver varken OTP eller dess källkodsutcheckning.
  Goldens genererades en gång från OTP och är incheckade med hashar;
  hashkontroller körs innan någon fixtur används.
- Nitton mönster-/guard-korpusar innehåller 67 748 förväntade native-värden/fel
  och 106 rader för semantisk acceptans. Varje native-korpus kör positionella
  drivrutiner och projektdrivrutiner vid O0/O2 med specialisering på/av, lokala
  och fjärranrop.
- Incheckade Erlang-indata är skrivna lokalt
  (`tests/fixtures/patternmatch/fragments/`, preprocessorns `semantic/headers/`);
  `fixture_sources` upprätthåller isoleringen från OTP:s källkod.
- Sex programfixturer för slutmålet (`tests/fixtures/programs/`) innehåller
  goldens för stdout/slutstatus från OTP och deras kompileringsdiagnostik;
  `programs_compile` kontrollerar dem utan OTP och
  `tests/compiler/programs/regenerate.py --check` återskapar dem under OTP
  ([fixturkarta](../tests/fixtures/programs/README.md)).
- Goldens för termutskrift (`tests/fixtures/printing/`) innehåller OTP:s
  `~w`- och `erlang:display/1`-text för 9 542 värden plus OTP:s stdout från
  kompilerade display-anrop; `tests/compiler/printing/regenerate.py --check`
  återskapar dem ([fixturanteckningar](../tests/fixtures/printing/README.md)).
- Golden-fall för körbara filer (`tests/fixtures/executables/`) är
  källkataloger plus en `golden.json` med stdout/slutstatus från OTP och ett
  handskrivet stderr-mönster; `tests/compiler/executables/run.py` länkar och kör
  vart och ett under matrisen av policyer/drivrutiner (CTest
  `executables_<case>`), och `regenerate.py --check` återskapar dem under OTP
  ([fallanteckningar](../tests/fixtures/executables/README.md)).
- Regenerering och levande granskningar är explicita:
  `-DCLAUSE_OTP_AUDITS=ON` och `tests/compiler/patternmatch/regenerate.py`
  ([instruktioner](../tests/fixtures/patternmatch/generated/README.md)).
  Ingenting uppdaterar goldens eller pinnen i tysthet.

## Testdesign

Beteende testas via den riktiga CLI:n, emitterade objekt, länkade
native-konsumenter och goldens från OTP. Fokuserade enhetstester finns kvar
endast där källkod inte kan nå tillståndet, var och ett med sitt syfte angivet i
testet:

- Injicerade budgetar och allokerings-/I/O-fel (`project_limits`,
  `project_creation_failure`, `codegen_limits`, `codegen_write_failure`,
  `runtime_lifecycle_failure`, felsömmar i genererade anrop).
- Privat ägarskap, ogiltiga/inaktuella handtag och invarianter för återställning
  i parsern, den semantiska typgrafen och backend.
- Validering av råa ord och termgränser för 32/64 bitar (`runtime_immediate`,
  `runtime_term_tag`, `abi_integers`).
- Fel i diagnostikmottagare och den stabila ögonblicksbilden av funktions-ID:n.

Fall som beror på filsystemets förmågor (länkar, skiftlägesalias) rapporterar
överhoppningar per fall; de ersätter aldrig ett godkänt helt test.

## Plattforms- och sanitizer-status

- Native-exekvering av genererad kod: Windows x64; Linux x86-64. Resultat för
  32-bitars och ARM (runtime-tester och korslänkade goldens) finns i
  historiken.
- Apple Silicon: inte validerat sedan backend tillkom.
- ASan, UBSan och LeakSanitizer för kompilatorn och runtime: Linux x86-64, en
  kombinerad Debug-konfiguration
  (`-fsanitize=address,undefined -fno-sanitize=vptr -fno-sanitize-recover=undefined`),
  fullständig CTest med `CLAUSE_TEST_TIMEOUT_SCALE=10` (instrumenterad kod
  körs flera gånger långsammare): ingen sanitizer-rapport. Kompilatorn,
  runtimen och testprogrammen är instrumenterade; program som `clau` länkar tar
  sanitizer-runtimen från ett `clang++`-omslag i `PATH`, deras genererade kod
  är inte instrumenterad. De fyra testerna med injicerad vägran från värden
  (`codegen_failure_*`, `runtime_lifecycle_failure`, `runtime_memory`) ligger
  utanför ASan:s räckvidd: dess `operator new` avbryter vid en omöjlig storlek
  i stället för att kasta.
- ThreadSanitizer: Linux x86-64, samma instrumenteringsräckvidd med
  `-fsanitize=thread`; fullständig CTest och samtidighetstesterna fem gånger
  vardera rapporterar ingen kapplöpning. Också utanför räckvidden: de två
  tester som ersätter `operator new`.
- På Windows står det förbyggda LLVM SDK fortfarande i konflikt med
  instrumenterad kod (`annotate_string` 0 mot 1).
- ASan enbart för runtime godkänns på Windows med Release-sonder,
  `/EHsc /fsanitize=address`, `/MT`, Clangs ASan-importbibliotek och statiska
  runtime-thunk samt ASan-DLL:en i `PATH`.
- Historiska körningar på macOS arm64 (2026-09-19/20) klarade fullständiga
  Debug-, C++26-, ASan+UBSan-, enbart kompilator- och enbart runtime-byggen för
  parser- och projektstegen; de är äldre än backend.

## Prestandamätningar

Manuell prestandajämförelse med Erlang/OTP. Den är aldrig en del av CTest,
commit-grinden eller `check-quality`, och endast den behöver ett Erlang/OTP på
värden; resultaten är värdspecifika belägg, inte grindresultat.

```powershell
make-benchmark.bat                         # Windows; set JOBS=N to cap parallel builds
make-benchmark.bat --repeat 9 --only bench_gc,bench_msg
make benchmark BENCH_ARGS="--baseline HEAD~5"   # other hosts
```

- Båda konfigurerar och bygger en Release-`clau` och runtime i `build/bench`
  och kör sedan `benchmarks/run.py` (`--help` listar dess alternativ).
- Program: `benchmarks/bench_*.erl` med `bench_util.erl`, byggda oförändrade
  av `erlc` och `clau -O2`. Var och en tar tid på sina kärnor med
  `erlang:monotonic_time/1` efter ett uppvärmningsanrop och skriver ut
  `BENCH <name> <nanoseconds>`: generering av data, bearbetning av data,
  skräpsamling, meddelandeöverföring, fil-I/O (i en tom temporär arbetskatalog)
  och loopback-socketar.
- System, på samma värd i en körning, varvade: OTP med sin standardvariant
  (JIT), OTP `-emu_flavor emu` när den är installerad (Windows-installeraren
  levererar endast JIT, så de kolumnerna visar `n/a`), Clause HEAD vid O2 och
  med `--lto`, samt en tidigare Clause-commit (standard: den nyaste commit som
  är minst en dag äldre än HEAD; `--baseline REV`, `--no-baseline`) byggd i
  ett cachat arbetsträd under `build/bench-base/<hash>` som delar
  `thirdparty/`.
- Rapport: per kärna medianen av `--repeat` körningar (standard 5) i
  millisekunder med sex decimaler och dess spridning, förändringen för Clause
  O2 mot varje system (`+N%`: Clause snabbare, det andra tar N % längre tid;
  `-N%`: Clause tar N % längre tid; `(Fx)` tidskvoten) med ett geometriskt
  medelvärde, `--lto` mot OTP och O2, programmens totala tider inklusive
  uppstart, fel och tidsgränser (`--timeout`, 600 s per körning).
  Iterationsantalen håller en standardkörning under 10 minuter; Clause, det
  långsammaste systemet, bestämmer storlekarna, så vissa OTP-kärnor varar bara
  några millisekunder.
- Historik: `benchmarks/history/<host>.json` behåller en post per kördag
  (kördatum, HEAD-hash och commitdatum, medianer för Clause, OTP och
  baslinjen), `benchmarks/history/reports/<host>/<day>-<hash>.txt`
  textrapporterna; en ny körning samma dag ersätter båda. Poster och rapporter
  som körts mer än 183 dagar före den nyaste rensas bort; en körning med
  ändringar i källkoden som inte har checkats in rapporteras men registreras
  inte. Historikkatalogen ignoreras av git: den stannar på värden som körde
  den.
- Listningar: med `--listings` skriver en körning, före mätningen, varje
  programs [`--print-asm`](compile.md#assembly-listings)- och
  `--print-ir`-listningar (med `bench_util`, `--entry <program>` så att onåbar
  bibliotekskod utelämnas som i den körbara filen) bredvid rapporterna som
  `<program>.debug.asm` / `<program>.debug.ll` (`-O0`) och
  `<program>.release.asm` / `<program>.release.ll` (`-O2`, koden som kolumnen
  `clause-o2` kör), och ersätter den föregående körningens listningar, även
  med `--no-history` och ändringar som inte har checkats in. `--print-ir` är
  IR före LLVM-kedjan; assemblerkommentarerna citerar IR efter den. Ett
  program som inte går att kompilera förlorar sina inaktuella listningar.

## Historik

Sammanfattat från de tidigare posterna per steg (original i Git-historiken fram
till commit `2777c98`). Om inget annat anges: Windows x64, LLVM 23.1.2, pin
`21776803ecd1`, orakel OTP 29.1.1 / ERTS 17.1. Testantal är fullständiga
CTest-körningar utan överhoppningar.

| Datum | Milstolpe | Tester | Kvalitetsenheter | Anteckningar |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Parserfas VI (macOS arm64, OTP 29.1 `751f87b7`, orakel 29.0.5) | 46 | alla | 344/344 produktioner belagda; korpus med 10 filer |
| 2026-09-20 | Projekt (macOS arm64) | 64 | alla | Debug, enbart kompilator, ASan+UBSan |
| 2026-09-28 | Testmigrering till CLI-arbetsflöden; reparation av Windows-grinden | 75 | alla | Stackspill i `parser_hardening` åtgärdat med 8 MiB stack; Lizard + clang-tidy rena |
| 2026-09-29 | Kompilatormilstolpe steg 1–46 | 103 | 182 | Enbart kompilator 80, enbart runtime 16, runtime-ASan 16 |
| 2026-10-01 – 10-03 | Mönster-/guard-planen PG1–PG20 | 104–131 | 189–258 | ABI-revisioner 2–4; PG15a gjorde goldens OTP-fria (granskningar valfria, 131 → 118 tester); stängd vid 19 korpusar, 67 634 värden, 1 969 seedade utfall |
| 2026-10-03 | Granskning av OTP-källkod | 125 | 258 | Kopierade OTP-filer ersatta med lokala fragment; jämförelse med fönster om 60 token mot 4 150 Erlang-filer och 1 190 C/C++-filer från OTP hittade ingen överlappning utöver en genererad heltalstupel |
| 2026-10-03 | Plan 11 step 1 baslinje (commit `b1a471f`, pin `21776803ecd1`, Lizard 1.24.0, clang-tidy 22.1.8) | 125 (122 snabba) | 258 | Fullt 729 s seriellt, 85 s `-j 16`; 14/14 granskningar; 19/19 korpusar; främmande O0/O2-objekt inspekterade för 7 mål |
| 2026-10-03 | Steps 2, 4: programfixturer, termutskrift | 126–128 | 265 | Sex OTP-programgoldens; 9 542 `~w`/display-goldens |
| 2026-10-04 | Steps 8, 8I: körare för körbara filer, klassisk heap (phases B, C stängda) | 138–144 | 272–276 | Fullt `-j 16` 235–370 s |
| 2026-10-04 – 10-05 | Steps 9–20: `case`, `if`, raises, `catch`, `try`, stackspår, `maybe` (phase D stängd), rekursion, ramar och svansanrop | 146–158 | 277–278 | Snabba och berörda tester i fullt läge per steg; fullt `-j 16` 155/155 på 259 s vid phase D |
| 2026-10-06 | Steps 21–28: comprehensions (phase E stängd), rötter och skräpsamling, minnes- och termgränser (27A–27E), grafkopior | 159–166 | 278–281 | Fullt `-j 12` 105–275 s; step 27 tog bort minnestak som standard |
| 2026-10-07 | Steps 29–35: records, native records (ABI 6), funs (ABI 7), closures, namngivna funs, dynamiska anrop (ABI 8) | 167–177 | 283–290 | Fullt `-j 12` 119–152 s |
| 2026-10-09 | Step 63 Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, LLVM 23.1.2 SDK clang, libstdc++ 14, GDB 16.2) | 235 | 338 | Fullständig CTest 235/235 på 161 s; Lizard och clang-tidy rena på Linux (7 analysatorrapporter i Boost-headers ignorerade); Windows-grinden 235/235 med headers kontrollerade |
| 2026-10-09 | Step 64 32-bitars: Windows x86 (WoW64, clang-cl) och Linux i386 (Debian 13 chroot, clang 19) | 42 + 65 goldens | — | Runtime-/ABI-tester 42/42 inbyggt på båda; `cross.py`-goldens 65/65 på båda (körningar av `integer_limit` endast för 64 bitar överhoppade) |
| 2026-10-09 | Step 65 Linux arm64 och armhf (Debian 13 sysroots, qemu-user 9.2) | 42 + 65 goldens | — | Runtime-/ABI-tester 42/42 vardera; goldens 64/65 vardera (`port_spawn` `enoent`: lucka i qemu:s `posix_spawn`), körgräns 900 s |
| 2026-10-10 | Step 67 ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Ingen sanitizer-rapport; fyra tester med injicerad vägran från värden utanför ASan:s räckvidd; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Step 68 ThreadSanitizer (Linux x86-64) | 233 | — | En inverterad låsordning åtgärdad (`Executor::clear`); därefter ingen rapport i fullständig CTest och 15 samtidighetstester x5 |
| 2026-10-10 | Steps 65A–65C: behaviours, `module_info/0,1`, importer | 234–236 snabba | 342–344 | Lint- och körbara goldens återskapas under OTP 29.1.1 |
| 2026-10-11 | Steps 73A–73G parse transforms | 242/243 snabba | — | Känt fel i `codegen_resource_cli`, sedan dess inaktiverat |
| 2026-10-12 | Steps 62D1–62E byggkatalog och cachar | 263/264 | alla | Fullständig CTest, känt fel i `codegen_resource_cli`; `check-quality-all` rent |
| 2026-10-13 | Steps 58U–58W inferenscache | 278/279 | alla | Fullständig CTest, känt fel i `codegen_measurements`; `check-quality-all` rent |
| 2026-10-14 | Step 41S `prim_eval` och den nya luerl-körningen (H3 stängd) | 299/300 | alla | Se nuvarande baslinje |

PG = steg i mönster-/guard-planen; posterna för plan 11-stegen är arkiverade i
`.agents/00-finished.md`.
