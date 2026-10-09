---
source: docs/features.md
sourceCommit: 06042fa
sourceSha256: a01c524098c785a3c361908d8a6a5221ef5182bf96ee3780a02e2e2a1efd0e2b
translatedAt: 2026-10-09
---
# Rapportering av ej implementerade funktioner

Giltig Erlang som kräver en ännu inte implementerad funktion misslyckas med ett
enda tydligt meddelande, skilt från vanliga fel för ogiltig indata. Fallback
till generisk kod som stöds (till exempel överhoppad specialisering) är tyst och
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
| Drivrutin | `-o/--output` [länkar](executables.md#linking) positionella indata eller ett projektmål; projektbyggen länkar varje körbart mål till dess [`output`](projects.md#executables) i manifestet |
| Runtime-tjänster | Se [uppskjutna runtime-tjänster](runtime.md#deferred-services) |

## Regler för meddelanden

- Den gemensamma [formateraren](../abi/include/clause/abi/feature_diagnostic.hpp)
  utelämnar okänd kontext, skriver kontrolltecken som `\xHH` och skyddar
  citattecken och omvända snedstreck så att kontexten inte kan injicera rader.
  UTF-8 behålls.
- Exakt ett meddelande per misslyckad operation, oberoende av `--verbose`.
- Kompilatorn: [reject_feature](../compiler/src/codegen/features.hpp) rapporterar
  det första felet i en batch, låser fast felet, kastar förberedd utdata och
  markerar diagnostiken som `reported` så att drivrutinerna inte skriver ut den
  igen.
- Runtime: [FeatureFailure](../runtime/include/clause/runtime/features.hpp)
  rapporterar en gång per operation via en lånad mottagare (null → stderr).
  Senare anrop returnerar den låsta statusen. Fel i mottagaren eller i
  formateringen blir `diagnostic_failure`; undantag hålls inneslutna.
- Anroparna för felet vidare utan att rapportera igen; en värdprocess bör avsluta
  med en nollskild statuskod och stänga ned på normalt sätt.
