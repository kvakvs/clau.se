---
source: docs/native-records.md
sourceCommit: a8c3f8f6
sourceSha256: b3cd9f802ea845b9145cd2ca30525129bb74dce96fc0d1da55c515a295eabf0e
translatedAt: 2026-10-17
---
# Native records

OTP 29:s record-former utöver vanliga tupel-records: deras representation,
operationer och fel. Tupel-records beskrivs i [termer](terms.md#records).

OTP 29 markerar native records som experimentella. Fakta nedan kommer från de
fastlåsta `maint-29`-källorna (`erl_lint`, `erl_expand_records`, `v3_core`,
`beam_core_to_ssa`, `erts/emulator/beam/erl_record.c`, `utils.c`,
`erl_printf_term.c`) och liveprober på OTP 29.1.1.

## Omfattning

Alla tre former utöver tupel-records är implementerade och delar en
representation:

| Form | Syntax |
| --- | --- |
| Native record, lokalt | `-record #r{...}.`, `#r{...}`, `X#r.f`, `X#r{...}`, mönster, `is_record/1,2,3` |
| Kvalificerade och importerade | `#m:r{...}`, `X#m:r.f`, `X#m:r{...}`, mönster; `-export_record`, `-import_record` |
| Härledda (anonyma) | `X#_.f`, `X#_{...}`, mönstret `#_{...}` |

Tillhandahålls inte: reflektionsmodulen `records` (anrop till `records:*` ger
diagnostiken `unknown module`), `term_to_binary` av native records
(`error:notsup`, [externt termformat](builtins.md#external-term-format)) och
uppgradering av kod under drift.

## Representation

- **Deskriptor.** Varje definition av ett native record kompileras till en
  oföränderlig `abi::v1::RecordDescriptor` bredvid dess moduldeskriptor: den
  definierande `ModuleDescriptor`, atomplatser för modul- och record-namnen,
  exportflaggan (`-export_record` vid kompilering) och atomplatserna för
  fältnamnen i definitionsordning. Atomplatser löses via modulens registrerade
  atomer, som namnen i `FrameDescriptor`. Program är statiska (ingen
  avladdning), så en deskriptor lever lika länge som programmet; en annan modul
  i batchen refererar till den via symbol. Standardvärden kompileras in vid
  varje konstruktionsställe och lagras aldrig.
- **Instans.** Heapcell av sorten `native_record`: huvud (antal `1 + n`), ett
  ospårat deskriptorord, sedan `n` spårade värden i definitionsordning. Ett
  record utan fält är en cell på två ord.
- Deskriptorn fångar modul, namn, exportflagga och fältlista vid konstruktion,
  som OTP:s infångade definition gör. Varje operation efter konstruktion läser
  instansens deskriptor, aldrig koden som kör den.
- Kopiering, skräpsamling, genomgång och verifiering behandlar cellen som en
  tupel vars första nyttolastord är ospårat. Godkännande kräver en deskriptor
  registrerad av en modul i samma runtime.

## Operationer

`M` är den aktuella modulen. Alla fel har klassen `error`; badrecord-nyttolaster
är det felaktiga värdet utom vid misslyckad extern konstruktion.

| Operation | Godtar | Fel |
| --- | --- | --- |
| Lokal konstruktion `#r{...}` | Alltid (definitionen är lokal) | Okänt fält eller saknat värde är kompileringsfel |
| Extern konstruktion `#m:r{...}` (även importerad `#r{...}`, även `#M:r`) | `m:r` definierad i batchen och exporterad | `{badrecord, {m, r}}`; sedan `{badfield, {{m, r}, F}}`, `{novalue, {{m, r}, F}}` (badfield vinner) |
| Lokal åtkomst `X#r.f` | Native record med namnet `r` (modul och exportflagga kontrolleras **inte**, som i OTP:s runtime) | `{badrecord, X}`; saknat fält `{badfield, {{Mod, r}, f}}` |
| Extern åtkomst `X#m:r.f` | Modul `m`, namn `r`, exporterat | `{badrecord, X}`; `{badfield, ...}` |
| Anonym åtkomst `X#_.f` | Vilket native record som helst (export kontrolleras **inte**, som i OTP:s runtime) | `{badrecord, X}`; `{badfield, ...}` |
| Lokal uppdatering `X#r{...}` | Modul `M`, namn `r` | `{badrecord, X}`; okänt fält `{badfield, ...}` |
| Extern uppdatering `X#m:r{...}` | Exporterat, modul `m`, namn `r` | samma |
| Anonym uppdatering `X#_{...}` | Exporterat eller modul `M` | samma |
| Lokalt mönster `#r{...}` | Modul `M`, namn `r`, varje listat fält finns | ingen matchning |
| Externt mönster `#m:r{...}` | Modul `m`, namn `r`; exporterat när ett fält listas | ingen matchning |
| Anonymt mönster `#_{...}` | Vilket native record som helst; exporterat eller modul `M` när ett fält listas | ingen matchning |

- Konstruktion utvärderar de angivna fälten i källkodsordning (standardvärden
  är literaler); en uppdatering utvärderar först recordet och sedan de nya
  värdena i källkodsordning, till skillnad från en uppdatering av ett
  tupel-record. Tomma uppdateringar kontrolleras ändå.
- Guards: endast fältåtkomst (ett fel får guarden att misslyckas) och
  `is_record`. Konstruktion i en guard ger `creating a record in a guard is only supported for
  tuple records`; uppdatering ger `illegal guard expression`.
- `is_record(X)` är sant endast för native records. `is_record(X, r)` med ett
  lokalt native `r` testar modul `M` och namn `r`; med `r` importerat från `m`
  testar den modul `m`. `is_record(X, m, r)` med atomer testar modul och namn;
  med ett heltal är det tupeltestet.
- Native records är inte tupler: `is_tuple` är falskt; element- och
  storlekstjänster avvisar dem.

## Regler vid kompilering

Meddelanden följer `erl_lint`:

- Standardvärden måste vara literaler efter konstantvikning (tal, atomer,
  strängar, `[]`, cons-celler/tupler/maps av sådana, binaries med endast
  strängar): `illegal default value for field a in native record r`.
- Lokal konstruktion utan värde för ett fält utan standardvärde:
  `field a is not initialized in native record r`; okänt fält:
  `field zz undefined in record r`. Okända fält vid åtkomst, uppdatering och i
  mönster godtas (OTP varnar bara); de misslyckas vid körning.
- Index `#r.a`, `record_info/2`, initierare `_ = V` och typade fältförfiningar
  gäller endast tupel-records, med OTP:s meddelanden.
- Ett namn är antingen ett tupel-record, ett native record eller ett importerat
  record; konflikter och felaktiga former av `-export_record`/`-import_record`
  är fel. `-export_record` måste stå före funktionsdefinitioner.
- Externa former som namnger en modul utanför batchen, ett odefinierat eller
  ett icke-exporterat record kompileras och misslyckas vid körning som i OTP.
  Extern konstruktion löses mot batchen vid kompilering: den importerande
  modulen sänker själv den definierande modulens literala standardvärden och
  refererar till dess exporterade deskriptor; okända fält ger `badfield` innan
  ett saknat värde ger `novalue` (`ErrorReason` 21).

## Utskrift och ordning

- `erlang:display/1` skriver ut `#m:r{a=1,b=2}`: inga mellanslag, fält i
  definitionsordning (OTP: atomtabellens indexordning,
  [skillnader](differences.md#maps)).
- Termordning: tupel < native record < map. Records jämförs efter modul, namn,
  exportflagga (falskt först), antal fält, fältnamn i definitionsordning, sedan
  värden i definitionsordning. `=:=` kräver dessutom samma fältordning; `==`
  jämför värden numeriskt (OTP:s kompilator viker vissa `==` på records till
  `=:=`, [skillnader](differences.md#maps); runtime-regeln följs).

## Behållna skillnader

Fältordning vid utskrift, vikning av `==`, extern konstruktion för moduler som
inte är laddade och saknade varningar för records finns beskrivna i
[skillnader](differences.md#maps).
