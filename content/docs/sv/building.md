---
source: docs/building.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b5b9cdbb0544c714f847eac4931ed0fa38d8de1144153349efac4c2302159cbc
translatedAt: 2026-10-26
---
# Bygga Clause

Så bygger man `clau` och `clause_runtime`, konfigurerar bygget, kör testerna
och använder utvecklarverktygen. Testdesign och resultat finns i
[validering](validation.md).

## Krav

- CMake 3.28+ och en C++23-kompilator; på Windows, arbetsbelastningen **Desktop
  development with C++** i Visual Studio med en Windows SDK, Ninja och en
  global LLVM/Clang-installation (`clang-cl`, och `clang` för länkning av
  program).
- LLVM 23.1.x (23.1.1 eller senare) C++ SDK för kompilatorn. En global
  installation föredras; annars hämtar CMake den fastlåsta SDK:n 23.1.2 till
  `thirdparty/` på Windows x64/ARM64, Linux x64/ARM64 och macOS ARM64
  ([LLVM SDK](compile.md#llvm-sdk)). Enbart LLVM:s kommandoradsverktyg
  innehåller inte SDK:n.
- Boost 1.90+ (Multiprecision, Asio och Parser för kompilatorn; endast
  headerfiler), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 och zlib 1.3.2.
  CMake hämtar dem som saknas till `thirdparty/` med SHA-256-kontroller och
  återanvänder dem utan nätverk, även för nya byggkataloger; på Linux och
  macOS kommer Boost och toml++ från en installation eller `thirdparty/`
  ([byggberoende](projects.md#build-dependency)).
- Python 3 för tester och verktygen för kvalitet, prestandamätning och
  listningar.
- Erlang/OTP behövs inte för att bygga eller testa. Testerna använder
  [projektägda golden-fixturer](../tests/fixtures/patternmatch/generated/README.md);
  endast parse transforms, valfria live-granskningar, omgenerering av
  fixturer och prestandamätningar behöver en OTP 29-installation.

På macOS (Erlang valfritt):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```

## Konfigurera och bygga

```sh
cmake --preset debug                    # build/debug, single configuration
cmake --build --preset debug
```

På Windows, från ett x64-utvecklarskal med `clang-cl` och `ninja` i `PATH`:

```powershell
cmake --preset windows                  # build/windows, Ninja Multi-Config
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Förinställningen `debug` lägger `clau` i `build/debug/bin`; förinställningen
`windows` i `build/windows/bin/<Config>/clau.exe`, med runtime i
`build/windows/lib/<Config>/clause_runtime.lib`. `clau` hittar
runtime-arkivet och modulerna i `library/` relativt till sin egen plats.

## Omslag

Miljövariabler som åsidosätter: `BUILD_DIR`, `TOOL_BUILD_DIR`, `BUILD_TYPE`,
`JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`.

| Makefile | Windows | Gör |
| --- | --- | --- |
| `make build` | `make-build.bat` | Bygger `clau` i `build/tool` utan tester (batchskriptet bygger Release och även runtime) |
| `make test`, `make test-full` | `make-test.bat` | Konfigurerar `build/debug` med tester, bygger allt, kör CTest |
| `make format`, `make format-all` | `make-format.bat` | Kör clang-format på ändrade (eller, med `FORMAT_SCOPE=all`, alla) C++-filer |
| `make benchmark` | `make-benchmark.bat` | Release-bygge i `build/bench`, sedan jämförelse med värdens OTP |
| `make clean` | `make-clean.bat` | Tar bort `build/` och `cmake-build*/` |

Batchskripten går själva in i Visual Studio x64-miljön vid behov, lägger till
`%ProgramFiles%\LLVM\bin` i `PATH` när `clang-cl` saknas och konfigurerar om en
byggkatalog som skapats med en annan generator eller kompilator; sätt
`CLAUSE_TOOLCHAIN=default` för att behålla CMakes eget val. `clau.bat`
(Windows) och `run-macos.sh` bygger först `build/tool` och kör sedan `clau` med
alla argument, med anroparens arbetskatalog och slutstatus bevarade.

## Konfigurationsalternativ

| Alternativ | Syfte |
| --- | --- |
| `-DBUILD_TESTING=ON` | Bygg tester och deras hjälpprogram (standard OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF` | Bygg endast det LLVM-fria runtime-biblioteket |
| `-DCLAUSE_BUILD_RUNTIME=OFF` | Bygg endast kompilatorn |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Välj en LLVM 23.1.x SDK (en ogiltig explicit sökväg misslyckas) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Kräv en installerad SDK |
| `-DCLAUSE_BOOST_ROOT=...`, `-DCLAUSE_TOML_ROOT=...`, `-DCLAUSE_SQLITE_ROOT=...`, `-DCLAUSE_PCRE2_ROOT=...` | Välj källkod eller installation för ett beroende (konfiguration utan nätverk) |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Välj den körbara Clang-filen för Windows |
| `-DCLAUSE_OTP_AUDITS=ON`, `-DCLAUSE_ESCRIPT=/path/to/escript` | Aktivera valfria live-granskningar mot OTP och välj vilken OTP 29 som används |
| `-DCLAUSE_TEST_DEBUG_INFO=ON` | Bygg testprogram med felsökningsinformation (för att felsöka en krasch) |
| `-DCLAUSE_OPTIMIZED_COMPILER=OFF` | Bygg `clau` och kompilatorbiblioteken utan optimering i Debug (för att felsöka en `clau`-krasch) |

Anmärkningar för Windows: standard-CRT är `/MDd` (Debug) eller `/MD`; en
explicit `CMAKE_MSVC_RUNTIME_LIBRARY` måste matcha LLVM SDK:n. MSVC `cl`
fungerar i en separat byggkatalog; MinGW stöds inte. Projektets mål behandlar
varningar som fel och inkluderar beroenden som `SYSTEM`-headers, så undvik att
lägga till beroendesökvägar via globala `-I`-flaggor som `CXXFLAGS` (i CLion,
rensa ett cachat värde med `-DCMAKE_CXX_FLAGS:STRING=`); använd rotalternativen
i stället.

## Tester

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug-fast                # or windows-debug-fast
ctest --preset debug -j 16               # full mode
```

`CLAUSE_TEST_MODE=fast` (förinställningarna `*-fast`, `make test`,
`make-test.bat`) kör en reducerad matris av optimeringar och drivrutiner och
hoppar över tester märkta `full_only`; `full` (standard när inget anges,
`make test-full`, `TEST_MODE=full`) kör allt. Varje test reserverar två
CTest-platser, så `-j N` kör N/2 tester samtidigt.

## Kvalitetskontroll

Lizard och clang-tidy, fastlåsta i `tools/requirements-quality.txt` och
installerade i `.venv-quality/` (använd `.venv-quality/bin/python` utanför
Windows):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` kontrollerar filer ändrade sedan `HEAD` (eller
`CLAUSE_QUALITY_BASE`) plus en översättningsenhet per ändrad header
(`check-quality-all` täcker alla beroende enheter) och kräver ett bygge med både
kompilator och runtime aktiverade;
`check-complexity-all` och `check-clang-tidy-all` kör ett verktyg.
`cmake/CheckClangTidy.cmake` godtar `QUALITY_SHARD=K/N` för att dela upp en
lång körning.

## Prestandamätningar och listningar

`make benchmark` / `make-benchmark.bat` bygger en Release-version av `clau` i
`build/bench` och jämför programmen `benchmarks/bench_*.erl` med värdens OTP
och en äldre Clause-commit; `benchmarks/run.py --help` listar alternativen
([prestandamätningar](validation.md#benchmarks)). De ingår aldrig i testerna.

`benchmarks/compile_times.py` mäter tiden för själva `clau`: det kör en
kompileringsarbetslast (`--workload W1`, eller `clau`-argument efter `--`)
flera gånger på prestandakärnorna med `--no-cache --print-stage-times` och
rapporterar median, minimum och spridning för varje fas och inferenspass, de
långsammaste inferenskomponenterna och om passräknare och stdout stämmer
överens mellan körningarna. Med `--baseline <clau.exe>` alternerar de två
byggena och sammanställningen visar deras förhållande. Det vägrar mäta medan
byggen, tester eller en annan `clau` körs, om inte `--force-noisy` anges, och
skriver JSON till `build/bench/compile-times/`.

`decompile-debug.bat <module>` och `decompile-release.bat <module>` skriver
Debug- eller Release-assemblerkoden för en Clause-C++-källfil till
`<module>.debug.asm` / `<module>.release.asm`, med källrader och avkodade namn
(`tools/asm.py`, clang-cl-byggen; `--function TEXT` filtrerar).
