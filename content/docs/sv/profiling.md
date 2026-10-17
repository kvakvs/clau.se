---
source: docs/profiling.md
sourceCommit: a8c3f8f6
sourceSha256: ae0b17c50da6bb2c36a31edf31aaa901aa6c57f3e662ef6fe663d066c1d7159a
translatedAt: 2026-10-17
---
# Profilering

`--profile FILE` (ett [runtime-alternativ](executables.md#runtime-options),
även via `CLAUSE_FLAGS`) får ett program att skriva en kostnadsrapport till
`FILE` när det avslutas. Inget kompileras om: varje körbar fil kan profilera,
och utan alternativet körs den, skriver ut och skriver filer exakt likadant. En
rapport som inte kan skrivas rapporteras på stderr
(`clau: cannot write profile FILE`); slutstatusen förblir programmets.

## Tillskrivning

Runtimen tillskriver kostnader där kontrollen flyttas mellan ramar
([exekveringsmodell](execution-model.md)), utan instrumentering i genererad kod:

- **Anrop** (reduktioner): varje ingång i en Erlang-funktion genom ett anrop
  eller svansanrop räknas som en för den funktionen, på samma sätt som en
  tidsskiva räknar reduktioner.
- **Egen tid**: tid enligt en monoton klocka från en överföring (ingång, retur,
  början av en tidsskiva) till nästa tillhör den funktion vars ram låg överst.
  Inbyggda funktioner och runtime-tjänster räknas som tid för den funktion som
  anropade dem; tid medan en process väntar eller inte är schemalagd räknas för
  ingen. Tid före en process första ingång är `(runtime)`.
- **Per process**: varje process håller sina egna kostnader; de läggs till
  programmets när processens kontext förstörs, med dess pid, summor och dyraste
  funktion.

Varje aktiverad stack läser klockan vid varje överföring (ungefär 8 %
långsammare i en anropstät loop i Debug); avaktiverade stackar betalar en
förgrening per överföring.

## Rapport

```text
Clause profile: 2 processes, 503 time slices, 0 timer clock readings
Functions by self time:
     time_us   share      entries  function
     1193261  100.0%      2000001  profile:spin/2
         204    0.0%            1  profile:main/1
         130    0.0%            1  profile:-main/1-fun-0-/1
           0    0.0%            1  profile:cold/1
Processes by time:
     time_us   share      entries  process: top function
     1193393  100.0%      2000002  <0.2.0>: profile:spin/2
         206    0.0%            2  <0.1.0>: profile:main/1
```

Den första raden räknar också de tidsskivor som schemaläggarens arbetstrådar
körde och klockavläsningarna i timertråden för receive-tidsgränser
([timerhjul](processes.md#receive-timeouts)). Funktioner är
`module:function/arity` (anonyma funs efter sina genererade namn, vars aritet
räknar infångade värden); lika värden sorteras efter namn, processer efter tid
och sedan pid. Tider anges i mikrosekunder och varierar mellan körningar;
antalet anrop är exakt.

## Tester

`linking_profiling` länkar `tests/fixtures/linking/profile` vid O0 och O2 och
kör den utan profilering, med `--profile FILE` och med
`CLAUSE_FLAGS=--profile=FILE`: utdata är identiska, `spin/2` hamnar först efter
egen tid med exakt 2 000 001 anrop, den snurrande processen hamnar först, och
`--profile` utan fil misslyckas med exit 70.
