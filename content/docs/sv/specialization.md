---
source: docs/specialization.md
sourceCommit: a8c3f8f6
sourceSha256: 30fb2421aad552fe8985671c5251c1200101aa35c3ee76024120620bcf97ef7a
translatedAt: 2026-10-17
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
| head, tail | ett cons-test eller faktum som bevisar cellen | inline-inläsningar |
| exakt literal `[]`, `{}`, litet heltal, atom | alltid (på varje nivå) | ordjämförelse: lika omedelbara värden är ett ord |
| listgenerator | faktum för generatorns indata: en äkta lista | cons-test och läsning av celler inline i varje iteration |

Fakta når mönster i funktionshuvuden (argument sammanslagna från anropare),
matchningar i kroppar (högersidan) och case/try-klausuler (det granskade
värdet eller värdet av try-kroppen); fakta om element, head och tail följer
extraheringar. En inline-läsning lagras i en rotplats som en tjänsts utdata,
så att sänkningen av ramar behåller den som en term över safepoints
([omläsningsregeln](runtime-heap.md#reload-rule)). De enda
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
  sedan faktisk tillväxt (klon + skydd + dispatch + reservväg) måste hålla sig
  inom 2x det generiska instruktionsantalet per funktion och modul.
- Generiska kroppar behålls alltid. Utkast som överskrider budgeten kastas
  tyst; programmet misslyckas aldrig på grund av specialisering.
- Valet är deterministiskt (modul, symbol, profilordning).

LLVM:s kloning/förenkling ersätter bevisade kontroller inuti klonen. En
begränsad dispatcher testar varje begränsad tagg och vidarebefordrar kontext och
argument till en variant eller den generiska kroppen; den publika symbolen och
ABI:t ändras inte. Inga spec-antaganden och inga fast-math-flaggor införs.

## Nuvarande effekt

Bevis verkar på verklig källkod: lokala funktioner vars anropare skickar små
heltal, tupler och listor förlorar sina tagg-, form- och tjänstekontroller
([`proofs`](../tests/fixtures/executables/proofs/proofs.erl), kontrollerat av
CTest `codegen_proofs` och kört som golden-testet för körbara filer
`executables_proofs`). En variant måste spara fler instruktioner än vad dess
dispatch kostar; ett borttaget taggtest av ett argument gör sällan det, så
varianter för källkod planeras oftast och avvisas sedan av tillväxtgränsen.
Fokuserade LLVM-fixturer injicerar upprepade taggkontroller för att testa
träffar, reservvägar och återställning vid tillväxt med native-exekvering.

Golden-tester för körbara filer körs under varje policy i fullt läge; snabbt
läge kör `-O0` (generisk) och `-O2` med specialisering (bevis).

`codegen_measurements` skriver `measurements/<config>/measurements.json` i
byggkatalogen för codegen-testerna (kompileringstid, IR-/objektbyte,
varianter, bevisade läsningar, native-tid). Tider är beskrivande, aldrig
tröskelvärden.
