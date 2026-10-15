---
source: docs/guards.md
sourceCommit: 6ed3851c
sourceSha256: d5589018751662ec240dc70ab6c6d0637d16fa10698c1c4fa7510a033dd888f1
translatedAt: 2026-10-15
---
# Guards

Vad som är tillåtet i guards följer de fastlåsta OTP 29-reglerna i
`erl_internal`/`erl_lint`; det härleds aldrig från registreringen i runtime.
Varje operand kontrolleras, även onåbara. En guard lyckas endast när det slutliga
värdet är atomen `true`.

## Kontrollflöde

- `,` förenar tester i ordning. `;` startar ett nytt alternativ efter `false`,
  ett icke-booleskt värde eller ett nått semantiskt fel; när alla misslyckas
  matchar klausulen inte.
- Bindningar från huvudet kan läsas i varje alternativ; guards skapar inga
  bindningar.
- Infrastrukturfel (slut på minne, gränser, ägarskap) stoppar körningen och
  provar aldrig ett annat alternativ.

| Operator | Semantik |
| --- | --- |
| `A andalso B` | `A` måste vara booleskt; `false` → `false`; annars returneras `B` som vilken term som helst |
| `A orelse B` | `A` måste vara booleskt; `true` → `true`; annars returneras `B` |
| `and`, `or`, `xor` | Båda operanderna utvärderas i ordning, båda booleska |
| `not A` | Boolesk negation |

`true andalso 7` returnerar 7 i en kropp och misslyckas som slutligt guard-test;
`(true andalso 7) =:= 7` lyckas. Ett nått fel inuti ett nästlat uttryck avvisar
hela alternativet: `hd([]) orelse true` misslyckas, `hd([]); true` lyckas. I
kroppar ger felaktiga strikta operander `badarg` och en felaktig lat vänster
operand ger `{badarg, Value}`, som i OTP.

## Katalog

[guards.tsv](../tests/fixtures/patternmatch/guards.tsv) listar alla 81
guard-signaturer från de fastlåsta tabellerna `guard_bif`, `new_type_test`,
`old_type_test`, `arith_op`, `bool_op` och `comp_op`, och ett test kräver exakt
mängdlikhet med uppströms. [Granskningsmanifestet](../tests/fixtures/patternmatch/generated/guard_catalog/manifest.json)
mappar var och en till resolver, sänkning (lowering) och ägare i runtime. Alla 81 är
implementerade (de identitetsberoende `self/0`, `node/0,1` och native
`is_record/1` sedan plan step 52): `self()` är den anropande processens pid,
`node()` och `node/1` för en pid, referens eller port är `nonode@nohost` (det
finns en nod; alla andra argument till `node/1` får guarden att misslyckas,
`badarg` i en kropp), och `is_record/1` testar om värdet är ett native record.
`is_record/2` med ett lokalt
namn på ett native record testar modul och namn; `is_record/3` med en atom som
tredje argument testar ett native records modul och namn; native fältåtkomst
får guarden att misslyckas vid varje avvikelse.

- Typtester: `is_atom`, `is_integer`, `is_float`, `is_number`, `is_boolean`,
  `is_tuple`, `is_list`, `is_map`, `is_binary`, `is_bitstring`,
  `is_function/1,2` ([funs](funs.md)), `is_pid`, `is_reference`
  ([pids och referenser](terms.md#pids-and-references)); `is_port` är
  alltid falskt (inga portar finns).
- `is_integer(V, Lo, Hi)` validerar först båda gränserna som heltal (annars
  `badarg`) och testar sedan det slutna intervallet; omvända gränser ger falskt.
- Jämförelser `==`, `/=`, `=:=`, `=/=`, `<`, `=<`, `>`, `>=`; aritmetiska och
  bitvisa operatorer; frågor och konverteringar enligt [termer](terms.md).
- Konstruktorer och map-uppdateringar i guards använder samma rotade tjänster
  som kroppar.
- Record-tester: se [termer](terms.md#records).

## Upplösning

- Okvalificerade guard-BIF:ar respekterar lokala definitioner, importer och
  global/selektiv `no_auto_import`. `erlang:F(...)` och `erlang:'op'(...)`
  kringgår skuggning, men endast för guard-BIF:ar och operatorer.
- Äldre tester (`integer/1`, `float/1`, `atom/1`, `record/2`, ...) är giltiga
  endast på toppnivå i ett guard-test (parenteser tillåtna). Där är `float(X)`
  `is_float`; nästlad eller kvalificerad `float/1` är konvertering. Den äldre
  `record/2` ignorerar undertryckning av sitt gamla namn, men en lokal
  `is_record/2` blockerar den.
- Inte tillåtet i guards: tilldelning, godtyckliga lokala/fjärr-/dynamiska
  anrop, `++`, `--`, `!`, funs, comprehensions, kontrollflöde,
  record-uppdateringar, `record_info/2`.

## Begränsningar hos orakeln

Installerad OTP 29.1.1 kraschar i SSA-konverteringen för vissa orelaterade
moderna importer bakom äldre skalära alias; Clause avvisar den obehöriga ägaren
explicit. OTP:s laddare avvisar också en guard med en enorm literal
record-aritet trots att lint godtar den; för det fallet finns endast semantiska
belägg.
