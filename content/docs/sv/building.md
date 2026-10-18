---
source: docs/building.md
sourceCommit: 336caea7
sourceSha256: 86d39780700856574257fd2d598102b8e551505085c42a0a8175f9c2c7b2330c
translatedAt: 2026-10-18
---
# Bygga kompilatorn

Konfigurera och bygg från förrådets rot:

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

Omslag (miljövariabler som åsidosätter: `BUILD_DIR`, `TOOL_BUILD_DIR`,
`BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`):

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

Konfigurationsalternativ:

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

Anmärkningar för Windows: standard-CRT är `/MDd` (Debug) eller `/MD`; en
explicit `CMAKE_MSVC_RUNTIME_LIBRARY` måste matcha LLVM SDK:n. MSVC `cl`
fungerar i en separat byggkatalog; MinGW stöds inte. Projektets mål behandlar
varningar som fel och inkluderar beroenden som `SYSTEM`-headers, så undvik att
lägga till beroendesökvägar via globala `-I`-flaggor som `CXXFLAGS` (i CLion,
rensa ett cachat värde med `-DCMAKE_CXX_FLAGS:STRING=`); använd rotalternativen
i stället.

## Testning

Tester väljs in vid konfigurering:

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
CTest-platser, så `-j N` kör N/2 tester samtidigt. Testerna kompilerar riktiga
Erlang-källfiler via CLI:t och jämför körbara filer med golden-utdata
genererade av OTP; se [validering](validation.md) för baslinjen, fixturerna och
testdesignen.

Kvalitetskontroll (Lizard och clang-tidy, verktyg fastlåsta i
`tools/requirements-quality.txt` och installerade i `.venv-quality/`; använd
`.venv-quality/bin/python` utanför Windows):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` kontrollerar filer ändrade sedan `HEAD` (eller
`CLAUSE_QUALITY_BASE`) plus en översättningsenhet per ändrad header
(`check-quality-all` täcker alla beroende enheter i den fullständiga kontrollen),
och kräver ett bygge med både kompilator och runtime aktiverade;
`check-complexity-all` och `check-clang-tidy-all` kör ett verktyg.
`cmake/CheckClangTidy.cmake` godtar `QUALITY_SHARD=K/N` för att dela upp en
lång körning.
