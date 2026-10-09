---
source: docs/building.md
sourceCommit: 06042fa
sourceSha256: de3570e747becc95b3596b8c17bf4d8bab1fa83db2aae32da918222afd413e6c
translatedAt: 2026-10-09
---
# Bygga kompilatorn

Från förrådets rot:

```sh
cmake --preset debug
cmake --build --preset debug
```

På Windows används förinställningen clang-cl/Ninja Multi-Config från
utvecklarskalet:

```powershell
cmake --preset windows
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Tester och deras hjälpprogram är valfria. Konfigurera uttryckligen för test:

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug --no-tests=error
```

På Windows:

```powershell
cmake --preset windows -DBUILD_TESTING=ON
cmake --build --preset windows-debug
ctest --preset windows-debug --no-tests=error
cmake --build --preset windows-release
ctest --preset windows-release --no-tests=error
```

Testerna har två lägen som väljs med `CLAUSE_TEST_MODE`:

- `fast` för utveckling: golden-korpusar körs med två kombinationer av
  policy och drivrutin (O0 positionellt och O2 utan specialisering via ett
  projekt) i stället för alla åtta, mutationsfall körs en gång, och tester
  märkta `full_only` (separata CMake-konsumentprojekt och tidsmätningar)
  utesluts.
- `full` (standard om inget anges) kör varje kombination och varje test; använd
  det när en större funktion är klar.

```sh
ctest --preset debug-fast            # or windows-debug-fast; tests use half the logical CPUs
ctest --preset debug -j 32           # full mode; -j N runs N/2 tests at once
make test                            # fast; make test-full or TEST_MODE=full for full
```

`make-test.bat` följer samma inställningar `TEST_MODE` (standard `fast`) och
`TEST_JOBS` (standard alla logiska CPU:er). Varje test reserverar två
processorplatser i CTest (`PROCESSORS 2`), så ett platsantal på N kör högst N/2
tester samtidigt, vilket lämnar utrymme för kompilatorerna och de nästlade
inbyggda byggen som testerna startar. På en Windows x64-värd med 32 trådar tar
fast-läget ungefär en minut och full-läget ungefär 85 sekunder med 16 jobb (729
sekunder seriellt).

För en byggkatalog utan förinställning, skicka `-DBUILD_TESTING=ON` till
`cmake -S . -B <dir>` för test. CMake cachar inställningen; skicka
`-DBUILD_TESTING=OFF` när katalogen återanvänds för vanliga byggen. De vanliga
förinställningarna och byggomslagen sätter den till `OFF`.

Batchskripten speglar Makefilens mål `build`, `format` och `clean`:
`make-build.bat`, `make-test.bat`, `make-format.bat` och `make-clean.bat`. Bygg-
och testskripten konfigurerar clang-cl med Ninja Multi-Config, som
förinställningen `windows`, går själva in i Visual Studio x64-miljön när skalet
inte är ett utvecklarskal och lägger till `%ProgramFiles%\LLVM\bin` i `PATH` när
`clang-cl` saknas. En byggkatalog som konfigurerats med en annan generator eller
kompilator konfigureras om från grunden; sätt `CLAUSE_TOOLCHAIN=default` för att
behålla CMakes eget val (till exempel MSVC `cl` i en separat katalog).
Standardvärden för bygget är `BUILD_DIR=build/debug`, `BUILD_TYPE=Debug` och det
inbyggda byggverktygets parallellism (åsidosätt med `JOBS=N`); miljövariablerna
`CMAKE`, `CTEST`, `CMAKE_ARGS` och `CLANG_FORMAT` åsidosätter också motsvarande
verktyg/alternativ.
`make-test.bat` konfigurerar med test aktiverade, bygger alla mål och kör sedan
CTest, vilket motsvarar `make test` och vidarebefordrar fel i konfiguration,
bygge eller test.
Clean tar bort de förrådslokala katalogerna `build/` och `cmake-build*/`.

Kvalitetskontroller och formatering gäller som standard ändrade filer: allt som
skiljer sig från `HEAD` i arbetsträdet, plus ospårade filer.

Kvalitetsverktygen finns i den ignorerade miljön `.venv-quality/`, fastlåsta av
`tools/requirements-quality.txt`:
`python -m venv .venv-quality` och sedan `.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt`
(`.venv-quality/bin/python` utanför Windows).

- `cmake --build build/debug --target check-quality` kör Lizard på ändrade
  C++-produktionsfiler och clang-tidy på ändrade översättningsenheter samt de
  som inkluderar en ändrad header (från Ninjas registrerade beroenden).
  Ändringar i `.clang-tidy`, `cmake/` eller produktionens `CMakeLists.txt`, eller
  saknade beroendedata, kontrollerar varje översättningsenhet.
  Sätt `CLAUSE_QUALITY_BASE` (till exempel `origin/master`) för att jämföra med
  en annan bas.
- `check-quality-all` (och `check-complexity-all`, `check-clang-tidy-all`)
  kontrollerar varje fil.
- clang-tidy körs i batcher om `4 x jobs` översättningsenheter och skriver ut en
  rad passed/FAILED efter varje; alla batcher körs, och sedan misslyckas
  kontrollen om någon batch gjorde det. För att dela upp en lång körning i
  kortare separata anrop, anropa skriptet direkt med en shard, till exempel
  `cmake -DQUALITY_SCOPE=all -DQUALITY_BUILD_DIR=build/debug -DQUALITY_SHARD=1/4 -P cmake/CheckClangTidy.cmake`
  för den första fjärdedelen (`QUALITY_BATCH` och `QUALITY_JOBS` åsidosätter
  batchstorleken och antalet jobb; jobb är som standard hälften av de logiska
  kärnorna).
- `make format` / `make-format.bat` formaterar ändrade C++-filer;
  `make format-all` eller `FORMAT_SCOPE=all make-format.bat` formaterar allt.

`clau.bat --help` bygger först och vidarebefordrar sedan alla argument till den
valda konfigurationens körbara fil. Byggfel stoppar körningen; kompilatorns
indatasökvägar förblir relativa till anroparens arbetskatalog, och dess
slutstatus bevaras.

För runtime-utveckling utan att ladda ned eller använda LLVM:s C++-SDK,
konfigurera med `cmake --preset windows -DCLAUSE_BUILD_COMPILER=OFF`; samma
förinställningar för bygge och test gäller. Sätt tillbaka alternativet till
`ON` när SDK:n finns tillgänglig. MSVC `cl` godtas också i en separat
byggkatalog; MinGW stöds inte för inbyggda utvecklingsbyggen på Windows. Välj
x86 eller x64 via utvecklarmiljön (eller `-A` med en Visual Studio-generator),
och använd en LLVM SDK och runtime för samma arkitektur.

Windows standard-CRT är `/MDd` för Debug och `/MD` för övriga konfigurationer,
inklusive det statiska runtime-biblioteket och dess konsumenter. En explicit
inställning av `CMAKE_MSVC_RUNTIME_LIBRARY` bevaras; den måste matcha LLVM SDK:n
och alla länkade C++-bibliotek. Undvik att blanda STL/CRT-artefakter från Debug
och Release. Windows-projektets källfiler och fixturer för CLI/sökvägar använder
UTF-8.

Alla projektmål använder C++23 och behandlar kompilatorvarningar som fel.
Den körbara filen är `build/debug/bin/clau`. Förinställningar och byggomslag
begär parallella byggen på Windows, Linux och macOS med det inbyggda
byggverktygets standardantal jobb (`jobs: 0` i förinställningar, `--parallel` i
omslag). Sätt en explicit gräns med `cmake --build --preset debug --parallel 8`
eller `JOBS=8` för omslagen.
För en byggkatalog utan förinställning, använd `cmake --build <dir> --parallel`.
Windows-förinställningen placerar den körbara filen i
`build/windows/bin/<Config>/clau.exe` och runtime i
`build/windows/lib/<Config>/clause_runtime.lib`.

Alternativt kan `make build` användas för att bygga endast `clau` och dess
beroenden, eller `make test` för att bygga och köra hela testsviten. För en
annan konfiguration:

```sh
make test BUILD_DIR=build/release BUILD_TYPE=Release JOBS=4
```

CMake hittar installerade Boost och Erlang, inklusive Homebrew-installationer.
Skicka dessa alternativ vid konfigurering för att åsidosätta standardvärden:

| Alternativ                                  | Syfte                                                         |
|---------------------------------------------|---------------------------------------------------------------|
| `-DCLAUSE_BOOST_ROOT=/path/to/boost`    | Välj en Boost-installation eller ett fullständigt källträd    |
| `-DCLAUSE_TOML_ROOT=/path/to/tomlplusplus-3.4.0` | Välj det fastlåsta TOML-beroendet |
| `-DCLAUSE_OTP_AUDITS=ON` | Aktivera valfria live-granskningar mot OTP/referens; standard är OFF |
| `-DCLAUSE_ESCRIPT=/path/to/bin/escript` | Välj OTP 29+ för valfria granskningar; används inte av vanliga tester |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Välj en installerad körbar Clang-fil för Windows |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Välj en befintlig LLVM 23.1.x SDK (ogiltiga explicita sökvägar misslyckas) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Kräv en installerad SDK; stäng av automatiska LLVM-nedladdningar |
| `-DBUILD_TESTING=ON`                        | Aktivera tester, hjälpprogram och deras Erlang-beroende (standard: OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF`           | Bygg endast runtime-biblioteket                               |
| `-DCLAUSE_BUILD_RUNTIME=OFF`            | Bygg endast kompilatorn                                       |

För generatorer med flera konfigurationer, lägg till `--config Debug` vid bygge
och `-C Debug` vid test. IDE:er med CMake-stöd kan öppna förrådet med
förinställningen `debug`, eller förinställningen `windows` med en Visual
Studio-utvecklingsverktygskedja.

Headerfiler för Boost och toml++ använder CMake `SYSTEM`-inkluderingar, vilket
behåller varningar som fel för projektkoden. Vid inbyggda macOS-byggen markerar
CMake även Homebrews länkade include-katalog som `SYSTEM` när dess Boost-headers
pekar på den valda installationen. Det hindrar ärvda flaggor som
`CXXFLAGS=-I/opt/homebrew/include` från att exponera Boost-varningar, även när
flaggan redan är cachad av CMake.
För andra installationer, undvik att lägga till beroendesökvägar via globala
`-I`-flaggor (inklusive `CXXFLAGS`): en vanlig include-sökväg kan ha företräde
framför ett beroendes systemsökväg. Om CLion rapporterar Boost-varningar som
fel, ta bort de globala flaggorna och rensa det cachade värdet, till exempel:

```sh
cmake -S . -B cmake-build-debug -DCMAKE_CXX_FLAGS:STRING=
```

Läs sedan in CMake på nytt i CLion. Använd alternativen för beroenderötter ovan
för att välja installationer i stället för att lägga till globala
include-flaggor.
