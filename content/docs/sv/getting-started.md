---
source: docs/getting-started.md
sourceCommit: 06042fa
sourceSha256: 95b73af25f3b08912c8b7f38fe46edf93a90187b3df3c13291d19a90411c29b1
translatedAt: 2026-10-09
---
# Kom igång

Krav:

- CMake 3.28+ och en kompilator med stöd för C++23.
- På Windows, en installerad körbar Clang-fil i `PATH` eller under
  `Program Files/LLVM/bin`; konfigureringen misslyckas omedelbart om den saknas
  eller inte kan köras.
- LLVM 23.1.x (>=23.1.1) C++-SDK för kompilatorbyggen. CMake föredrar en global
  installation och laddar annars ned den fastlåsta 23.1.2-SDK:n till
  `thirdparty/` om den saknas; se
  [SDK-uppsättning och kompileringskontrakt](compile.md).
- Boost 1.90+ med Boost.Multiprecision för kompilator och runtime; kompilatorn
  kräver även Boost.Parser. Multiprecision består enbart av headerfiler och
  kräver inget binärt Boost-bibliotek.
- toml++ 3.4.0 för projektmanifest; se
  [uppsättning av beroenden](projects.md#build-dependency).
- Vanliga byggen och tester kräver inte Erlang/OTP. Testerna använder
  [projektägda golden-fixturer](../tests/fixtures/patternmatch/generated/README.md).
  Valfria live-granskningar och explicit återskapande av fixturer kräver
  Erlang/OTP 29+.

På macOS:

```sh
xcode-select --install
brew install cmake boost erlang tomlplusplus llvm@23
```

På Windows installeras LLVM/Clang globalt för värdens kompilatorverktyg.
Installera arbetsbelastningen **Desktop development with C++** i Visual Studio
och en Windows SDK, samt Ninja. Använd en kommandotolk av typen
**x64 Native Tools** eller ett Developer PowerShell konfigurerat för x64, med
`clang-cl`, `cmake` och `ninja` i `PATH`.
CMake kontrollerar MSVC-ABI:t, länkning mot Windows SDK och stöd för C++23
`std::expected`. LLVM:s kommandoradsverktyg ensamma tillhandahåller inte den
C++-SDK som krävs; CMake laddar ned den separat när `LLVMConfig.cmake` och
matchande bibliotek saknas.

CMake laddar ned Boost 1.90.0 och toml++ 3.4.0 till den ignorerade katalogen
`thirdparty/` vid första användning, verifierar deras SHA-256-kontrollsummor och
behåller både arkiven och de uppackade källorna. Efterföljande konfigureringar,
även i nya byggkataloger, återanvänder filerna utan nätverksåtkomst. Att ta bort
`build/` tar inte bort beroendena.
När CMakes egen TLS-stack inte kan verifiera certifikat (till exempel den CMake
som följer med Strawberry Perl) görs nya försök med värdens `curl`, och
nedladdningarna verifieras ändå.
Byggen med endast runtime laddar bara ned Boost. Explicita beroenderötter nedan
har företräde och möjliggör uppsättning utan nätverk; en ogiltig explicit rot
misslyckas utan nedladdning.
Linux och macOS fortsätter att använda installerade beroenden eller lokala
källor i `thirdparty/`.
Reservnedladdningar av LLVM SDK gäller på **alla tre plattformar**, med
officiella arkiv fastlåsta med SHA-256 för Windows x64/ARM64, Linux x64/ARM64
och macOS ARM64.
Arkiv och uppackade SDK:er stannar i `thirdparty/` för återanvändning utan
nätverk. Andra värdarkitekturer och korsbyggen kräver en explicit matchande
`LLVM_DIR`.

För kompilatorbyggen identifieras LLVM:s beroenden zlib och zstd från
installerade bibliotek. På Windows utlöser saknade bibliotek nedladdningar av
zlib 1.3.2 och zstd 1.5.7, verifierade med SHA-256, följda av statiska
Debug-/Release-byggen under `thirdparty/`.
Dessa byggen återanvänds mellan byggkataloger och matchar värdens kompilator,
arkitektur och CRT. Sätt `ZLIB_ROOT` eller `zstd_ROOT` för att föredra ett
installerat bibliotek; `CLAUSE_DOWNLOAD_ZLIB=OFF` och `CLAUSE_DOWNLOAD_ZSTD=OFF`
stänger av respektive reservlösning. Sökningen efter MSVC-SDK avvisar cachade
MinGW-bibliotek `.a`, som de som följer med Strawberry Perl. Linux och macOS
använder installerade utvecklingspaket.
