---
source: docs/patterns.md
sourceCommit: a8c3f8f6
sourceSha256: 0a7a8a1553a85de9fdbf7f86b763794ac36eb0f02510d51897f2a17be4209cac
translatedAt: 2026-10-17
---
# Mönster, klausuler och matchningar i kroppar

Huvuden i funktionsklausuler, matchningar i kroppar, `case`-klausuler och
`if`-guards är körbara för varje tillåten termsort ([termer](terms.md)).
Giltighet och tillgänglighet kontrolleras separat: ogiltig Erlang är ett
**semantiskt** fel även i onåbar kod; giltig kod som kräver en saknad funktion
får en diagnostik om **förmåga** (capability); en **avvikelse** (mismatch) vid
körning är aldrig ett kompilatorfel.

| Sammanhang | Status |
| --- | --- |
| Funktionshuvuden + guards | Implementerat; när alla klausuler är uttömda ges `error:function_clause` |
| Matchningar och sekvenser i kroppar, `begin`/`end` | Implementerat; misslyckande ger `error:{badmatch, RHS}` |
| `case`-klausuler + guards | Implementerat; när alla klausuler är uttömda ges `error:{case_clause, Value}` |
| `if`-guardklausuler | Implementerat; när alla klausuler är uttömda ges `error:if_clause` |
| `maybe` med `?=` och `else`-klausuler | Implementerat; en misslyckad `?=` ger sitt värde eller väljer en `else`-klausul, och när dessa är uttömda ges `error:{else_clause, Value}`; kräver funktionen `maybe_expr` ([preprocessor](preprocessor.md)) |
| List-, binary- och map-comprehensions | Implementerat ([nedan](#comprehensions)) |
| `catch Expr` | Implementerat; inga mönster ([ABI](abi.md#failure-channel-revision-2)) |
| `try` `of` och catch-klausuler | Implementerat; när `of` är uttömd ges `error:{try_clause, Value}`, omatchade undantag kastas vidare och `after` körs på varje väg ([ABI](abi.md#failure-channel-revision-2)); `Class:Reason:Stack` binder [stackspårningen](abi.md#stack-traces) |
| Fun-klausuler | Implementerat; när alla klausuler är uttömda ges `error:function_clause` ([funs](funs.md#closures)) |
| `receive`-klausuler + guards | Implementerat; omatchade meddelanden stannar i brevlådan, `after` körs vid timeout ([processer](processes.md#receive)) |

## Comprehensions

`[T1, ..., Tn || Q1, ..., Qm]`, `<< T || Q1, ... >>` och
`#{K => V, ... || Q1, ... }` följer OTP 29:

- Kvalificerare körs från vänster till höger; varje generator loopar över
  resten. Mallar utvärderas i den ordningen för varje kvarvarande kombination;
  flera mallar lägger till flera element per kombination. Mallen i en
  binary-comprehension måste vara en bitstring (annars `error:badarg` vid det
  elementet); delarna sammanfogas i ordning, inklusive ofullständiga byte. En
  map-comprehension utvärderar sitt (första) värde före sin nyckel, och en
  senare dubblerad nyckel vinner.
- Generatorer: `P <- List`, `<<Segs>> <= Bits` och `K := V <- Map`, med de
  strikta formerna `<:-` (listor, maps) och `<:=`. En bitstring-generator
  matchar sitt mönster mot ett prefix och fortsätter med resten. När en
  avslappnad generator avvisar ett element hoppar den över så många bitar som
  mönstrets storlekar beskriver (värden ignoreras, flyttal läses som heltal,
  som OTP gör); när även det misslyckas, eller färre bitar återstår, avslutas
  generatorn. En map-generator går igenom mapen i nyckelordning
  ([skillnader](differences.md#maps)).
- Ett generatormönster binder nya namn: det skuggar yttre namn, och inget som
  en comprehension binder syns efter den. En avslappnad generator hoppar över
  element som dess mönster avvisar; en strikt ger `error:{badmatch, E}` med
  listelementet, den återstående bitstringen eller `{Key, Value}`.
- En zip-grupp (`P1 <- L1 && P2 <- L2`) tar ett element från varje indata per
  steg; dess mönster binder tillsammans, så ett upprepat namn måste matcha. Ett
  avvisat steg hoppas över om inte ett strikt mönster avvisar det. Indata som
  tar slut ojämnt, eller en strikt avvisning, ger
  `error:{bad_generators, {L1', L2'}}` med de indata som återstår vid det steget
  (en map-generator visar OTP:s iterator `{K, V, Next}`, som slutar i `none`).
  Filter inuti en zip-grupp är semantiska fel. När avslappnade och strikta
  generatorer i en grupp delar en variabel kan överhoppningsregeln skilja sig
  från OTP ([skillnader](differences.md)).
- Indata som inte är en map ger `error:{bad_generator, Input}` innan en
  map-generator startar, även inuti en zip-grupp.
- Listindata som inte är en lista, eller en oäkta svans, och bitstring-indata
  som inte är en bitstring ger `error:{bad_generator, Tail}` när elementen före
  den är klara.
- Ett filter som är ett guard-test (OTP `erl_lint:is_guard_test/3`:
  guardsyntax som endast anropar oskuggade guard-BIF:ar, äldre typtester på
  toppnivå) avvisar elementet vid varje fel, som en guard. Alla andra filter
  måste returnera `true` eller `false`; andra värden ger
  `error:{bad_filter, Value}` och dess undantag sprids vidare.
- En matchningskvalificerare på toppnivå (`P = E`) är ett semantiskt fel om
  inte den experimentella funktionen `compr_assign` är aktiverad; att köra den
  är då inte implementerat (förmåga).

Varje generator är en loop i funktionskroppen vars indatamarkör (en rest av en
lista eller bitstring, eller en map och en position) lever i termplatser i
ramen; de producerade elementen ackumuleras omvänt i en annan termplats och
blir listan, den sammanfogade bitstringen eller mapen en gång i slutet, så
långa indata kräver konstant native-stack och processtack.

## Mönsterformer

| Form | Regel | Avvisning |
| --- | --- | --- |
| `_` | Binder aldrig; förekomster är oberoende | Att läsa `_` är semantiskt fel |
| `Name`, `_Name`, upprepningar | Enkel tilldelning; upprepningar kräver exakt likhet (`1` ≠ `1.0`) | Obunden/osäker läsning är semantiskt fel; olikhet ger avvikelse |
| `P1 = P2`, parenteser | Båda begränsar samma värde; inga nyckel-/storleksbindningar mellan syskon | Otillåtet syskonberoende är semantiskt fel |
| Atomer, heltal, tecken, flyttal | Exakt likhet; nollor med tecken skiljs åt | Avvikelse |
| Konstant aritmetik | OTP:s mönsteroperatorer viks exakt; `1 div 0` och icke-konstanter avvisas | Semantiskt |
| Tupler, listor, oäkta svansar, strängar | Exakt aritet och cons/nil-form; strängar är listor | Avvikelse |
| `"prefix" ++ Tail` | Endast prefix som är literal sträng eller literal heltalslista | Variabelt prefix är semantiskt fel |
| `#{K := P}` | Endast `:=`; extra nycklar tillåts; `#{}` testar typen; nycklar är guard-uttryck över inkommande bindningar | `=>`, obunden nyckel är semantiskt fel; saknad nyckel ger avvikelse |
| Bitstrings | Validerad typ/storlek/enhet; tidigare segment kan ange storlek för senare; svans utan storlek sist | Ogiltig specificerare är semantiskt fel; för kort data ger avvikelse |
| Tupel-records `#r{f = P}`, `#r.f` | Expanderas till tupelvillkor; utelämnade fält obegränsade | Okänt record/fält är semantiskt fel |
| Lokala native records `#r{f = P}` | Record i denna modul med namnet `r`, sedan varje listat fält (ett fält som saknas misslyckas) | Okänt record är semantiskt fel |
| Kvalificerade/importerade native records `#m:r{f = P}` | Record i modulen `m` med namnet `r`; exporterat när ett fält listas; sedan varje fält | Ingen vid kompilering |
| Anonyma records `#_{f = P}` | Vilket native record som helst; exporterat eller definierat i denna modul när ett fält listas | `#_{...}` som uttryck är ett fel |
| Anrop, variabel aritmetik, andra uttryck | Inte mönster | Semantiskt |

## Räckvidder

Map-nycklar och binary-storlekar läser den inkommande miljön, aldrig syskon:
`#{K := V} = #{key := K}` och `<<X:N>> = <<N:8>>` kan inte binda sin egen
nyckel eller storlek. Inuti en binary kan en storlek läsa tidigare segment:
`<<N:8, X:N>>` är giltigt; `{N, <<X:N>>}` kräver att `N` är bundet i förväg.
Konstant felaktig aritmetik i en nyckel eller storlek är giltig och misslyckas
vid matchning.

Binary-validering avvisar segment med nästlade behållare/alias, motstridiga
modifierare, felaktiga enhetsintervall, enhet utan storlek för standardvärden
för heltal/flyttal, ogiltig UTF-storlek/enhet, typade/storleksangivna literala
strängar och binary-segment utan storlek som inte står sist.

## Körning

- En platt matchningsplan per huvud/vänsterled över de ursprungliga
  argumentplatserna; alias delar indata, första definitioner binder SSA-värden,
  upprepningar genererar tester för exakt likhet. Formkontroller dominerar
  extrahering, som läser celler inline där den kan och annars anropar
  kontrollerade runtime-tjänster.
- Klausuler körs i källkodsordning, var och en med en ny miljö som laddar om
  de ursprungliga argumenten. Avvikelse i huvudet eller avvisning av guard går
  till nästa klausul; fel i kroppen och infrastrukturfel provar aldrig senare
  klausuler.
- En `case` utvärderar sitt granskade uttryck en gång och provar sedan varje
  klausul i ordning med det granskade uttrycket som planens enda indata:
  mönsteravvikelse eller avvisning av guard (inklusive guard-fel) går till
  nästa klausul, och när alla är uttömda ges `{case_clause, Value}`. Varje
  klausul börjar från bindningarna före case; case-värdet och varje exporterad
  bindning sammanförs i en PHI per värde.
- En `if` är en `case` utan granskat uttryck eller mönster: varje klausuls
  guard provas i ordning (ett guard-fel avvisar klausulen), när alla är uttömda
  ges `if_clause`, och värden och exporter sammanförs på samma sätt.
- `begin`/`end` kör sin sekvens i den omslutande räckvidden och ger sitt sista
  värde.
- Sekvenser i kroppar körs i ordning och returnerar det sista värdet. En
  matchning utvärderar sitt högerled en gång, binder nya namn, kontrollerar
  befintliga och returnerar högerledet (även för `_ = RHS`). Kedjor utvärderar
  det innersta högerledet först.
- Atomliteraler laddar modulbindningar; matchning internerar aldrig atomer.
- Ovillkorliga variabelhuvuden kompileras till kompakt projektions-IR.

## Gränser

Mönsternormalisering delar modulens semantiska budget (1 000 000 enheter, eller
32 per uttryck för större moduler) (ett heltal kostar ungefär sitt antal
decimala siffror); en konstant bortom heltalsgränsen på 4 194 240 bitar är ett
`illegal pattern`, som i OTP ([termer](terms.md#integers)). Varje
matchningsplan har ett tak på 100 000 arbetsenheter. Parsern begränsar separat
nästling till 256 (hårt tak 512).
