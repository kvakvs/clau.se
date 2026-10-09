---
source: docs/specialization.md
sourceCommit: 06042fa
sourceSha256: 2c39d48470df1d080597dde6ad170daf6c6a24e35d3a42c166a0c9dcf90dee23
translatedAt: 2026-10-09
---
# Typspecialisering

Hastighetsläget (`-O2`) kan klona en funktion till representationsvarianter som
skyddas av taggkontroller vid körning. `-O0` och `--no-type-specialization`
producerar endast generisk kod.

## Policy

- Profiler kommer från härledda fakta vid anropsplatser. I dag bevisar endast
  exakta heltalssingletoner som kan representeras på målet ett argument som
  litet heltal. Specs, breda `integer()`, unioner och okända värden förblir
  generiska.
- En variant är motiverad endast om den tar bort en implementerad kontroll: en
  exakt jämförelse av låg tagg vid inläsning av ett argument i ingångsblocket,
  före sidoeffekter.
- Gränser: 3 varianter per funktion, 32 per modul, 128 per mål. Uppskattad och
  sedan faktisk tillväxt (klon + skydd + dispatch + fallback) måste hålla sig
  inom 2x det generiska instruktionsantalet per funktion och modul.
- Generiska kroppar behålls alltid. Utkast som överskrider budgeten kastas tyst;
  programmet misslyckas aldrig på grund av specialisering.
- Valet är deterministiskt (modul, symbol, profilordning).

## Sänkning

LLVM:s kloning/förenkling ersätter bevisade kontroller inuti klonen. En
begränsad dispatcher testar varje begränsad tagg och vidarebefordrar kontext och
argument till en variant eller den generiska kroppen; den publika symbolen och
ABI:t ändras inte. Ingen okontrollerad uppackning (unboxing), inga
spec-antaganden och inga fast-math-flaggor införs.

## Nuvarande effekt

Den nuvarande källdelmängden har inga borttagbara representationskontroller, så
verklig Erlang-källkod får noll varianter även vid O2; att specialisera en
identitet skulle bara öka koden. Fokuserade LLVM-fixturer injicerar upprepade
taggkontroller för att testa träffar, fallbacks och återställning vid tillväxt
med native-exekvering.

`codegen_measurements` skriver `measurements/<config>/measurements.json` i
byggkatalogen för codegen-testerna (kompileringstid, IR-/objektbytes, varianter,
native-tid). Tider är beskrivande, aldrig tröskelvärden. Exempel från Windows x64
/ LLVM 23.1.2 (2026-09-29): källarbetslast 232 876 IR- / 40 498 objektbytes vid
O0 och 204 408 / 35 886 vid båda O2-policyerna, noll varianter; den syntetiska
fixturen lade till 30 instruktioner till en funktion med 55 instruktioner för en
accepterad variant.
