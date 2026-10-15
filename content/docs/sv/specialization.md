---
source: docs/specialization.md
sourceCommit: 6ed3851c
sourceSha256: 896b741de11f8f1f7f9098670798d1de273c0e4be02cb7ebfadca90e184b0e36
translatedAt: 2026-10-15
---
# Typspecialisering

Hastighetsläget (`-O2`) använder [härledda fakta](semantic.md#inference) för
att ta bort kontroller vid körning (bevis) och kan klona en funktion till
representationsvarianter som skyddas av taggkontroller vid körning. `-O0` och
`--no-type-specialization` producerar endast generisk kod: varje kontroll
finns kvar, varje åtkomst till sammansatta värden går genom sin runtime-tjänst.

## Bevis

Ett bevis kommer endast från fakta som gäller närhelst koden körs:

- fakta om en lokal funktions argument, sammanslagna från alla dess anropare
  (`Inference::inputs`; exporterade funktioner och funktioner som namnges av
  `fun F/A` har inga);
- det registrerade faktumet för ett uttryck (en operands faktum registreras
  innan operationen som använder den snävar in det);
- ett formtest tidigare i samma matchningsplan: planens noder körs i en följd,
  så ett godkänt tupel- eller cons-test dominerar varje senare nod.

Specifikationer bevisar aldrig något. `term()` och `none()` (kod som inferensen
fann onåbar) bevisar ingenting; kroppar i anonyma funs får inga bevis.

| Operation | Bevisas av | Genererad kod |
| --- | --- | --- |
| `+ - *` | båda operanderna intervall av små heltal, resultatintervallet inom den omedelbara nyttolasten | avkodning, beräkning och kodning inline; ingen tagg, overflow eller reservväg |
| `+ - *` | en eller båda operanderna intervall av små heltal | de bevisade taggtesterna försvinner; overflow-kontroll och reservväg via tjänst finns kvar |
| tupelmönster | faktum för argument eller granskat värde: exakta tupler med mönstrets aritet | formtestet tas bort (obevisat: testas inline) |
| tupelelement | ett formtest eller faktum som bevisar tupeln | inline-inläsning av elementet |
| listmönster | faktum: säkert en cons-cell | formtestet tas bort (annars ett test av primär tagg på varje nivå) |
| huvud, svans | ett cons-test eller faktum som bevisar cellen | inline-inläsningar |
| exakt literal `[]`, `{}`, litet heltal, atom | alltid (varje nivå sedan OPT0.2A) | ordjämförelse: lika omedelbara värden är ett ord |
| listgenerator | faktum för generatorns indata: en riktig lista | cons-test och läsning av celler inline i varje iteration |

Fakta når mönster i funktionshuvuden (argument sammanslagna från anropare),
matchningar i kroppar (högersidan) och case/try-klausuler (det granskade
värdet eller värdet av try-kroppen); fakta om element, huvud och svans följer
extraheringar. En inline-läsning lagras i en rotplats som en tjänsts utdata,
så att sänkningen av ramar behåller den som en term över safepoints
([omladdningsregeln](runtime-heap.md#reload-rule)). De enda
pekarkonverteringarna i genererad kod är dessa bevisade läsningar och
inläsningarna av huvuden i inline-formtester för tupler (`proven.cell`).
Layoutkonstanterna kommer från [`abi/term.hpp`](abi.md#terms); runtimen
kontrollerar dem mot sina privata cellayouter.

## Varianter

- Profiler kommer från fakta vid anropsplatser: ett argument vars faktum endast
  rymmer små heltal (singletoner eller intervall) bevisar ett argument som
  litet heltal. Specs, breda `integer()`, unioner med andra sorter och okända
  värden förblir generiska.
- En variant är motiverad endast om den tar bort en implementerad kontroll: en
  exakt jämförelse av låg tagg för ett argumentord var som helst i kroppen
  (argumentarrayen skrivs aldrig, och en skräpsamling ändrar aldrig ett litet
  heltal).
- Gränser: 3 varianter per funktion, 32 per modul, 128 per mål. Uppskattad och
  sedan faktisk tillväxt (klon + skydd + dispatch + fallback) måste hålla sig
  inom 2x det generiska instruktionsantalet per funktion och modul.
- Generiska kroppar behålls alltid. Utkast som överskrider budgeten kastas tyst;
  programmet misslyckas aldrig på grund av specialisering.
- Valet är deterministiskt (modul, symbol, profilordning).

LLVM:s kloning/förenkling ersätter bevisade kontroller inuti klonen. En
begränsad dispatcher testar varje begränsad tagg och vidarebefordrar kontext och
argument till en variant eller den generiska kroppen; den publika symbolen och
ABI:t ändras inte. Inga spec-antaganden och inga fast-math-flaggor införs.

## Nuvarande effekt

Bevis verkar på verklig källkod: lokala funktioner vars anropare skickar små
heltal, tupler och listor förlorar sina tagg-, form- och tjänstekontroller
([`proofs`](../tests/fixtures/executables/proofs/proofs.erl), kontrollerat av
CTest `codegen_proofs` och kört som referenstestet för körbara filer
`executables_proofs`). En variant måste spara fler instruktioner än vad dess
dispatch kostar; ett borttaget taggtest av ett argument gör sällan det, så
varianter för källkod planeras oftast och avvisas sedan av tillväxtgränsen.
Fokuserade LLVM-fixturer injicerar upprepade taggkontroller för att testa
träffar, fallbacks och återställning vid tillväxt med native-exekvering.

Referenstester för körbara filer körs under varje policy i full-läget;
fast-läget kör `-O0` (generisk) och `-O2` med specialisering (bevis).

`codegen_measurements` skriver `measurements/<config>/measurements.json` i
byggkatalogen för codegen-testerna (kompileringstid, IR-/objektbytes, varianter,
bevisade läsningar, native-tid). Tider är beskrivande, aldrig tröskelvärden.
Exempel från Windows x64 / LLVM 23.1.2 (2026-09-29, före bevis):
källarbetslast 232 876 IR- / 40 498 objektbytes vid O0 och 204 408 / 35 886
vid båda O2-policyerna, noll varianter; den syntetiska fixturen lade till 30
instruktioner till en funktion med 55 instruktioner för en accepterad variant.
