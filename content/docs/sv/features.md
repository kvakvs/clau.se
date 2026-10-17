---
source: docs/features.md
sourceCommit: a8c3f8f6
sourceSha256: c542e68489672ac575517c6517e5952bc91a1aa3d15f5b5da6474cffc0302f6e
translatedAt: 2026-10-17
---
# Rapportering av uppskjutna funktioner

Giltig Erlang som kräver en ännu inte implementerad funktion misslyckas med ett
enda tydligt meddelande, skilt från vanliga fel för ogiltig indata. Generisk
reservlösning som stöds (till exempel överhoppad specialisering) är tyst och
räknas inte som ett fel.

```text
[pattern matching] notimpl: src/example.erl:12:5 [module="example"] [target="native"] [operation="match argument"]
```

## Katalog

[features.hpp](../abi/include/clause/abi/features.hpp) tilldelar stabila ID:n
som aldrig återanvänds och diagnostiska namn, med ägare och status för varje
post. Ta bort eller förfina en post när dess funktion är på plats; behåll dess
ID reserverat.

| Ägare | Var den rapporterar |
| --- | --- |
| Kompilatorns semantiska analys | Kontroll av förmågor i varje funktion, även oanvänd kod |
| Kompilatorns sänkning (lowering) | Defensivt avvisande vid nådda operationer; rensar förberedda artefakter |
| Drivrutin | Inget uppskjutet: `executable linking` är implementerat ([länkning](executables.md#linking)) |
| Runtime-tjänster | Se [uppskjutna runtime-tjänster](runtime.md#deferred-services) |

Uppskjutna kompilatorfunktioner i dag, var och en täckt av
`codegen_placeholders`:

| Funktion | Exempel som rapporterar den |
| --- | --- |
| `heap expressions` | `compr_assign`-tilldelningar i comprehensions (`[Y \|\| X <- L, Y = X]`) |
| `dynamic calls` | En inbyggd fun av `apply` (`fun erlang:apply/2`) |
| `behavior-changing attributes` | `-on_load`, `-nifs`, `-compile`-alternativ som inte är neutrala, parametriserade moduler ([accepterad delmängd](compile.md#accepted-source-subset)) |

## Regler för meddelanden

- Den gemensamma [formateraren](../abi/include/clause/abi/feature_diagnostic.hpp)
  utelämnar okänd kontext, skriver kontrollbyte som `\xHH` och skyddar
  citattecken och omvända snedstreck så att kontexten inte kan injicera rader.
  UTF-8 behålls.
- Exakt ett meddelande per misslyckad operation, oberoende av `--verbose`.
- En uppskjuten funktion som kompilatorn kunde hoppa över utan att ändra vad
  den accepterar skulle rapporteras som en varning och kompileringen skulle
  fortsätta; ingen gör det i dag. `codegen_placeholders` kontrollerar ett
  meddelande per uppskjuten kompilatorfunktion.
- Kompilatorn: [reject_feature](../compiler/src/codegen/features.hpp) rapporterar
  det första felet i en batch, låser fast felet, kastar förberedd utdata och
  markerar diagnostiken som `reported` så att drivrutinerna inte skriver ut den
  igen.
- Runtime: [FeatureFailure](../runtime/include/clause/runtime/features.hpp)
  rapporterar en gång per operation via en lånad mottagare (null → stderr).
  Senare anrop returnerar den låsta statusen. Fel i mottagaren eller i
  formateringen blir `diagnostic_failure`; undantag hålls inneslutna.
- Anroparna för felet vidare utan att rapportera igen; en värd bör avsluta med en
  nollskild statuskod och stänga ned på normalt sätt.
