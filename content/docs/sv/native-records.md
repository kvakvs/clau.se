---
source: docs/native-records.md
sourceCommit: 6ed3851c
sourceSha256: 5383c5a0c72bed06730432be7a2605262122d7580d5a4e6124e01661d7e93086
translatedAt: 2026-10-15
---
# Native records

Det avgränsar OTP 29:s record-former
utöver vanliga tupel-records och fastställer deras representation, operationer
och fel. Step 31B implementerade runtime-cellerna och `CLAUSE_record_v1`;
31C kompilerar lokala native records, 31D kvalificerade och importerade former
med `-export_record`/`-import_record`, 31E anonyma former. Tupel-records
beskrivs i [termer](terms.md#records).

OTP 29 markerar native records som experimentella. Fakta nedan kommer från de
fastlåsta `maint-29`-källorna (`erl_lint`, `erl_expand_records`, `v3_core`,
`beam_core_to_ssa`, `erts/emulator/beam/erl_record.c`, `utils.c`,
`erl_printf_term.c`) och liveprober på OTP 29.1.1.

## Omfattning

Alla tre former utöver tupel-records är valda. De delar en representation, så
de behöver inget separat representationsbeslut:

| Form | Syntax | Steg |
| --- | --- | --- |
| Native record, lokalt | `-record #r{...}.`, `#r{...}`, `X#r.f`, `X#r{...}`, mönster, `is_record/1,2,3` | 31C |
| Kvalificerade och importerade | `#m:r{...}`, `X#m:r.f`, `X#m:r{...}`, mönster; `-export_record`, `-import_record` | 31D |
| Härledda (anonyma) | `X#_.f`, `X#_{...}`, mönstret `#_{...}` | 31E |

Inte valt: reflektionsmodulen `records` (ett bibliotek, med bibliotekarbetet i
step 39), `term_to_binary` (`RECORD_EXT`) och uppgradering av kod under drift
(D01). Anrop till `records:*` förblir diagnostiken `unknown module`.

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
  tupel vars första nyttolastord är ospårat. Admission kräver en deskriptor
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
  `is_record`. Konstruktion i en guard ger `creating a record in a guard is only supported
  for tuple records`; uppdatering ger `illegal guard expression`.
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
  definitionsordning. OTP skriver ut fält i atomtabellens indexordning, som
  beror på i vilken ordning atomer skapades och inte går att återskapa; detta
  är en dokumenterad skillnad, som för map-nycklar.
- Termordning: tupel < native record < map. Records jämförs efter modul, namn,
  exportflagga (falskt först), antal fält, fältnamn i definitionsordning, sedan
  värden i definitionsordning. `=:=` kräver dessutom samma fältordning; `==`
  jämför värden numeriskt (OTP:s kompilator viker vissa `==` på records till
  `=:=`; runtime-regeln följs).

## Behållna skillnader

| OTP | Clause |
| --- | --- |
| Fältordningen för `display` följer atomindex | Definitionsordning |
| Extern konstruktion för en modul som inte är laddad misslyckas tills den laddas | Varje modul i batchen laddas vid start; en modul utanför batchen misslyckas alltid |
| Kompilatorn kan vika `==` mellan records till `=:=` (`#r{a=1} == #r{a=1.0}` är falskt) | Runtime-`==` (sant) |
| Okända fält vid åtkomst/uppdatering/i mönster, kvalificerad konstruktion i den egna modulen utan värden, oanvända records eller records definierade i headerfiler: varningar | Inga varningar |
