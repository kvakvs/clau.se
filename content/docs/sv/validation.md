---
source: docs/validation.md
sourceCommit: 6ed3851c
sourceSha256: 908ac8c879d3df66cb4e8e52800e07da92013325c177e1556378cadd0597b50f
translatedAt: 2026-10-15
---
# Validering

## Nuvarande baslinje

Plan 11 step 1, 2026-10-03, commit `b1a471f`, Windows x64: clang-cl 23.1.2,
LLVM SDK 23.1.2 (`/MT`, `_ITERATOR_DEBUG_LEVEL=0`), Lizard 1.24.0, clang-tidy
22.1.8, OTP-pin `21776803ecd1` med orakel OTP 29.1.1 / ERTS 17.1.

| Kontroll | Resultat |
| --- | --- |
| Färsk kombinerad Debug-CTest | 125/125, noll överhoppade (729 s seriellt; 85 s med `-j 16`) |
| CTest i snabbläge (`debug-fast`) | 122 tester, cirka 60 s |
| `check-quality` | Godkänt; Lizard CCN 10, clang-tidy över 258 produktionsenheter |
| Valfria OTP-granskningstester | 14/14 |
| `regenerate.py --corpus all --check` | 19/19 korpusar återskapas |
| Främmande O0/O2-objekt | 7 mål inspekterade (Linux x86/x64/ARM/AArch64, Windows x86/x64, Apple Silicon) |

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
  `full_only`-tester. Fullt läge (standard) kör alla kombinationer av
  drivrutin/policy.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multiplicerar gränserna per körning för
  golden-köraren (60 s) och köraren för semantiska fall (15 s) för
  instrumenterade byggen.
- `check-quality`, `make format` och `make-format.bat` omfattar filer som
  ändrats sedan `HEAD` plus ospårade filer; `cmake/quality_scope.py` lägger till
  översättningsenheter som inkluderar en ändrad header. Ändringar i
  `.clang-tidy`, `cmake/` eller produktions-CMake väljer allt.
- Testprogram har ingen felsökningsinformation (inga PDB:er); konfigurera med
  `-DCLAUSE_TEST_DEBUG_INFO=ON` för att bygga om dem för en debugger. Nästlade
  native-konsumenter länkar föräldrabyggets runtime via
  `ClauseRuntimeTargets.cmake` i stället för att kompilera den igen; endast
  `runtime_link` bygger runtime fristående.
- Tröskelvärden och undertryckningar höjs aldrig för att klara grinden. Två
  undantag för tredjepartskod är konfigurerade (plan 11 steps 63-64,
  användarens beslut): `cmake/tidy_filter.py` tar bort rapporter från den
  statiska analysatorn som ligger i Boost-headers (falska positiva för
  limb-lagring i Boost.Multiprecision på Linux som en omskrivning av den
  anropande koden bara flyttar) och räknar dem i utdata, och
  `bugprone-exception-escape` ignorerar `bad_array_new_length` (MSVC:s
  flyttkonstruktorer för map/set allokerar; ett allokeringsfel är ändå
  fatalt).
- clang-tidy kontrollerar projektets headers på varje värd: headerfiltret
  godtar avgränsarna `/` och `\` (Windows-sökvägar matchade aldrig före step
  63).

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
utveckling; andra värdar bygger och kör testerna. Step 63 körde den en gång på
Linux, vilket hittade det som Windows-körningen inte kunde se (källfiler
endast för POSIX, libstdc++:s `std::optional`), och lämnade den ren.

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
  (`tests/fixtures/patternmatch/fragments/`, preprocessorns `semantic/headers/`).
  En granskning 2026-10-03 tog bort alla kopierade OTP-filer; jämförelse med
  fönster om 60 token mot 4 150 Erlang-filer och 1 190 C/C++-filer från OTP
  hittade ingen kvarvarande överlappning utöver en genererad heltalstupel.
  `fixture_sources` upprätthåller isoleringen.
- Sex programfixturer för slutmålet (`tests/fixtures/programs/`)
  innehåller goldens för stdout/slutstatus från OTP och dagens
  kompileringsdiagnostik; `programs_compile` kontrollerar dem utan OTP och
  `tests/compiler/programs/regenerate.py --check` återskapar dem under OTP
  ([fixturkarta](../tests/fixtures/programs/README.md)).
- Goldens för termutskrift (`tests/fixtures/printing/`)
  innehåller OTP:s `~w`- och `erlang:display/1`-text för 9 542 värden plus OTP:s
  stdout från kompilerade display-anrop;
  `tests/compiler/printing/regenerate.py --check` återskapar dem
  ([fixturanteckningar](../tests/fixtures/printing/README.md)).
- Golden-fall för körbara filer (`tests/fixtures/executables/`)
  är källkataloger plus en `golden.json` med stdout/slutstatus från OTP och ett
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
  32-bitars och ARM finns i historiken.
- Apple Silicon: väntande.
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
  vardera rapporterar ingen kapplöpning efter åtgärden av låsordningen i
  `Executor::clear`. Också utanför räckvidden: de två tester som ersätter
  `operator new`.
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
| 2026-09-28 | Testmigrering till CLI-arbetsflöden | 74/75 | — | Baslinje 78/93; stackspill i `parser_hardening` åtgärdades senare med 8 MiB stack |
| 2026-09-28 | Reparation av Windows-grinden | 75 | alla | Lizard + clang-tidy rena |
| 2026-09-29 | Kompilatormilstolpe steg 1–46 | 103 | 182 | Enbart kompilator 80, enbart runtime 16, runtime-ASan 16 |
| 2026-10-01 | PG1 semantisk matris och bevis | 104 | — | Källhashar fastlåsta |
| 2026-10-01 | PG2 felkanal | 108 | — | ABI rev 2 |
| 2026-10-01 | PG3 atomer | 109 | 189 | ABI rev 3 |
| 2026-10-01 | PG4 bindningar med räckvidd | 111 | 191 | 26 legalitetsfall |
| 2026-10-02 | PG5 mönstersemantik | 113 | 196 | 92 legalitetsmoduler |
| 2026-10-02 | PG6 matchning av omedelbara värden | 114 | 199 | 34 anrop |
| 2026-10-02 | PG7 guards för omedelbara värden | 119 | 205 | 1 689 anrop |
| 2026-10-02 | PG8 kontrollflöde i guards | 120 | 207 | 2 075 anrop |
| 2026-10-02 | PG9 ordnade klausuler | 121 | 208 | 1 020 anrop |
| 2026-10-02 | PG10 matchningar i kroppar | 122 | 209 | 1 666 anrop |
| 2026-10-02 | PG11 stabil heap och rötter | 123 | 213 | ABI rev 4 |
| 2026-10-02 | PG12 tupler/listor/strängar | 125 | 221 | 4 801 anrop |
| 2026-10-02 | PG13 godtyckliga heltal | 127 | 231 | 16 065 anrop |
| 2026-10-02 | PG14 flyttal | 129 | 238 | 14 436 anrop |
| 2026-10-02 | PG15 maps | 131 | 244 | 8 010 anrop |
| 2026-10-02 | PG15a OTP-fria goldens | 118 | 244 | 14 korpusar, 49 959 värden; granskningar valfria |
| 2026-10-02 | PG16 bitstrings | 120 | 253 | 8 826 anrop |
| 2026-10-03 | PG17 tupel-records | 121 | 257 | 1 025 utfall, 29 semantiska fall |
| 2026-10-03 | PG18 guard-katalog | 122 | 257 | 81 rader, 5 033 utfall |
| 2026-10-03 | PG19 bindningsfakta | 123 | 258 | 822 utfall, 976 dominanskontroller |
| 2026-10-03 | PG20 avslutning | 124 | 258 | 19 korpusar, 67 634 värden, 1 969 seedade utfall |
| 2026-10-03 | Granskning av OTP-källkod | 125 | 258 | Kopierade OTP-filer ersatta med lokala fragment |
| 2026-10-03 | Plan 11 step 1 baslinje | 125 | 258 | Se nuvarande baslinje |
| 2026-10-03 | Plan 11 step 2 programfixturer | 126 | 258 | Sex OTP-goldens; snabbläge 123 tester; fullt `-j 16` 83 s |
| 2026-10-03 | Plan 11 step 4 termutskrift | 128 snabba | 265 | 9 542 `~w`/display-goldens; 154 kompilerade display-anrop i alla policyer; clang-tidy kört med ett jobb (samtidiga körningar kraschade verktyget på oförändrade enheter) |
| 2026-10-04 | Plan 11 step 8 körare för körbara filer (phase B stängd) | 138 (135 snabba) | 272 | Fallen `demo`, `exits` under åtta kombinationer av policy/drivrutin; fullt `-j 16` 235 s |
| 2026-10-04 | Plan 11 step 8I klassisk heap (phase C stängd) | 144 (140 snabba) | 276 | Fullt `-j 16` 370 s: 143/144, `codegen_dependency` fick timeout efter 120 s under last och klarade sig ensamt på 29 s; Lizard-all 0 varningar; tidy-all godkänt med ett jobb efter ett tyst avslut med två jobb |
| 2026-10-04 | Plan 11 step 9 `case` och `begin` | 146 (142 snabba) | 114 ändrade | Snabbt 142/142; berörda tester 7/7 i fullt läge; Lizard 0 varningar; tidy godkänt med ett jobb efter ett tyst avslut med två jobb |
| 2026-10-05 | Plan 11 step 10 `if` | 147 (143 snabba) | 114 ändrade | Snabbt 143/143; berörda tester 8/8 i fullt läge; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 11 raises i källkod | 148 (144 snabba) | 124 ändrade | Snabbt 144/144; berörda tester 22/22 i fullt läge; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 12 `catch Expr` | 149 (145 snabba) | 277 | Snabbt 145/145; berörda tester 25/25 i fullt läge; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 13 `try ... of ... catch` | 150 (146 snabba) | 189 ändrade | Snabbt 146/146; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 14 `try ... after` | 153 (149 snabba) | 2 ändrade | Snabbt 149/149; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 15 stackspår och `raise/3` | 154 (150 snabba) | 129 ändrade | Snabbt 150/150; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 16 `maybe` (phase D stängd) | 155 (151 snabba) | 277 | Snabbt 151/151; fullt `-j 16` 155/155 på 259 s; Lizard-all 0 varningar; tidy-all godkänt |
| 2026-10-05 | Plan 11 step 18 rekursiva anropsgrafer | 156 (152 snabba) | 91 ändrade | Snabbt 152/152; berörda tester 13/13 i fullt läge; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 19 explicita ramar och svansanrop | 157 (153 snabba) | 278 | Snabb och fullständig CTest godkända (med fallet från step 20: 154/154, 158/158); clang-cl-konfigurering; Lizard 0 varningar; tidy godkänt |
| 2026-10-05 | Plan 11 step 20 djup rekursion i kroppar och stackbudget | 158 (154 snabba) | 278 | Snabbt 154/154; fullt 158/158; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 21 list-comprehensions | 159 (155 snabba) | ändrade | Snabbt 155/155; berörda tester i fullt läge; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 22 binary- och map-comprehensions (phase E stängd) | 160 (156 snabba) | alla | Snabbt 156/156; fullt `-j 12` 160/160 på 275 s; Lizard-all 0 varningar; tidy-all godkänt efter åtgärd av fyra fynd i ny kod |
| 2026-10-06 | Plan 11 step 23 rotinventering, `SafePoint`, levande register | 160 (156 snabba) | 50 ändrade | Snabbt 156/156; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 26 skräpsamling från genererad kod | 161 (157 snabba) | 63 ändrade | Snabbt 157/157; fullt `-j 12` 161/161 på 107 s; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 27 heaputtömning efter skräpsamling | 162 (158 snabba) | 50 ändrade | Snabbt 158/158; fullt `-j 12` 162/162 på 108 s; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 27 korrigering: inga minnestak som standard | 162 (158 snabba) | 50 ändrade | Fullt `-j 12` 158/162 på 120 s, 4 `codegen_failure_*` åtgärdade genom att förvänta `out_of_memory`, sedan 10/10 berörda; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 27 uppföljning: inga tak för binaries eller antal processer, `--max-atoms` | 164 (160 snabba) | 281 | Snabbt 160/160; fullt `-j 12` 164/164 på 105 s; Lizard 0 varningar; tidy-all godkänt |
| 2026-10-06 | Plan 11 step 28 grafkopior mellan heapar, delade buffertar utanför heapen | 166 (162 snabba) | 71 ändrade | Snabbt 162/162; fullt `-j 12` 166/166 på 130 s; Lizard 0 varningar; tidy godkänt |
| 2026-10-07 | Plan 11 step 29 uppdateringar av records | 167 (163 snabba) | 38 ändrade | Snabbt 163/163; Lizard 0 varningar; tidy godkänt; records-korpusen återskapas under OTP |
| 2026-10-07 | Plan 11 step 30 `record_info/2` | 168 (164 snabba) | 42 ändrade | Snabbt 164/164; fullt `-j 12` 168/168 på 119 s; Lizard 0 varningar; tidy godkänt |
| 2026-10-07 | Plan 11 step 31B celler för native records och `CLAUSE_record_v1` (ABI 6) | 169 (165 snabba) | 283 ändrade | Snabbt 165/165; fullt `-j 12` 169/169 på 122 s; Lizard 0 varningar; tidy godkänt efter två åtgärder |
| 2026-10-07 | Plan 11 step 31C lokala native records | 170 (166 snabba) | 285 ändrade | Snabbt 166/166; fullt `-j 12` 170/170 på 146 s; Lizard och tidy godkända efter komplexitetsåtgärder |
| 2026-10-07 | Plan 11 step 31D kvalificerade och importerade native records | 171 (167 snabba) | 124 ändrade | Snabbt 167/167; fullt `-j 12` 171/171 på 129 s; Lizard 0 varningar; tidy godkänt efter tre åtgärder |
| 2026-10-07 | Plan 11 step 31E anonyma native records (step 31 stängt) | 172 (168 snabba) | 33 ändrade | Snabbt 168/168; fullt `-j 12` 172/172 på 124 s; Lizard 0 varningar; tidy godkänt efter en åtgärd |
| 2026-10-07 | Plan 11 step 32 funktionsvärden `fun F/A`, `fun M:F/A` (ABI 7) | 173 (169 snabba) | 289 ändrade | Snabbt 169/169; fullt `-j 12` 173/173 på 122 s; Lizard och tidy godkända efter komplexitetsåtgärder |
| 2026-10-07 | Plan 11 step 33 closures med fångade variabler | 175 (171 snabba) | 134 ändrade | Snabbt 171/171; fullt `-j 12` 175/175 på 126 s; Lizard och tidy godkända efter komplexitetsåtgärder |
| 2026-10-07 | Plan 11 step 34 namngivna funs | 176 (172 snabba) | 132 ändrade | Snabbt 172/172; fullt `-j 12` 176/176 på 152 s; Lizard 0 varningar; tidy godkänt |
| 2026-10-07 | Plan 11 step 35 dynamiska anrop `M:F(Args)`, `apply/2,3`, `fun M:F/A` vid körning (ABI 8) | 177 (173 snabba) | 290 (analysatorkonfiguration ändrad) | Snabbt 173/173; fullt `-j 12` 177/177 på 142 s; Lizard 0 varningar och tidy godkänt efter en komplexitetsåtgärd och tre tidy-åtgärder |
| 2026-10-09 | Plan 11 step 63 Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, LLVM 23.1.2 SDK clang, libstdc++ 14, GDB 16.2) | 235 | 338 | Fullständig CTest 235/235 på 161 s; Lizard och clang-tidy rena (7 analysatorrapporter i Boost-headers ignorerade); Windows-grinden 235/235 med headers kontrollerade |
| 2026-10-09 | Plan 11 step 64 32-bitars: Windows x86 (WoW64, clang-cl) och Linux i386 (Debian 13 chroot, clang 19) | 42 + 65 goldens | — | Runtime-/ABI-tester 42/42 inbyggt på båda; `cross.py`-goldens 65/65 på båda (körningar av `integer_limit` endast för 64 bitar överhoppade) |
| 2026-10-09 | Plan 11 step 65 Linux arm64 och armhf (Debian 13 sysroots, qemu-user 9.2) | 42 + 65 goldens | — | Runtime-/ABI-tester 42/42 vardera; goldens 64/65 vardera (`port_spawn` `enoent`: lucka i qemu:s `posix_spawn`), körgräns 900 s |
| 2026-10-10 | Plan 11 step 67 ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Ingen sanitizer-rapport; fyra tester med injicerad vägran från värden utanför ASan:s räckvidd; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Plan 11 step 68 ThreadSanitizer (Linux x86-64) | 233 | — | En inverterad låsordning åtgärdad (`Executor::clear`); därefter ingen rapport i fullständig CTest och 15 samtidighetstester x5 |
| 2026-10-10 | Plan 11 step 65A `-behaviour`/`-behavior` och genererad `behaviour_info/1` | 234 (snabba) | 342 | Ny konfigurering; snabbt 234/234; Lizard 0 varningar; tidy godkänt efter en åtgärd (kastande statisk initiering); nya `lint_diagnostics` (8 OTP-genererade fall) och `executables_behaviours`; OTP `--check` återskapar 60 goldens för körbara filer och 8 lint-goldens; programgoldens återskapade endast för den ändrade orakelhashen |
| 2026-10-10 | Plan 11 step 65B `module_info/0,1` och informativa attribut | 235 (snabba) | 344 | Ny konfigurering; snabbt 235/235; Lizard 0 varningar; tidy godkänt efter uppdelning av `parse_and_print`; nya `executables_module_info` och lint-fallen `module_info_defined`, `exports_repeated` återskapas under OTP 29.1.1 |
| 2026-10-10 | Plan 11 step 65C importer, kompileringstips, namngivna avvisningar av attribut | 236 (snabba) | — | Se belägg för plan 65C; `executables_imports` och tre lint-fall för importer återskapas under OTP 29.1.1 |
| 2026-10-06 | Plan 11 step 27E ERTS-gräns för stora heltal, `error:system_limit` | 165 (161 snabba) | 157 ändrade | Snabbt 161/161; fullt `-j 12` 165/165 på 130 s; Lizard 0 varningar; tidy godkänt; 21 goldens för körbara filer återskapas under OTP |
| 2026-10-06 | Plan 11 step 27D inga tak för map-storlek eller nyckelarbete | 164 (160 snabba) | 13 ändrade | Snabbt 160/160; fullt `-j 12` 164/164 på 115 s; efter en tidy-åtgärd i `bit_order` godkänns 35 berörda tester; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 27C gräns för tupelaritet 16 777 215 | 164 (160 snabba) | 51 ändrade | Snabbt 160/160; fullt `-j 12` 164/164 på 121 s; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 27B inga tak för listlängd eller jämförelsearbete | 164 (160 snabba) | 4 ändrade | Snabbt 160/160; fullt `-j 12` 164/164 på 125 s; Lizard 0 varningar; tidy godkänt |
| 2026-10-06 | Plan 11 step 27A runtime-omfattande minnesgräns och `--max-heap/stack/memory` | 164 (160 snabba) | 49 ändrade | Snabbt 160/160; fullt `-j 12` 164/164 på 118 s; efter en tidy-åtgärd i `ProcessStack::grow` godkänns 42 berörda tester; Lizard 0 varningar; tidy godkänt |

PG = steg i mönster-/guard-planen (arkiverat i `.agents/00-finished.md`).
