---
source: docs/funs.md
sourceCommit: 6ed3851c
sourceSha256: d6183dca6e3b3f09dea66c149577541528e02b41b04f721c8d768762926ac676
translatedAt: 2026-10-15
---
# Funktionsvärden

`fun F/A`, `fun M:F/A`, anonyma funs med
infångade variabler (closures), namngivna funs (`fun Name(...) -> ... end`),
anrop av funktionsvärden (`F(Args)`) och dynamiska anrop (`M:F(Args)`,
`apply/2,3`). Fakta kommer från de fastlåsta `maint-29`-källorna
(`erts/emulator/beam/utils.c` `erts_cmp`, `erl_printf_term.c`, `erl_lint`)
och prober på OTP 29.1.1.

## Värden

| Källa | Värde | Anrop går till |
| --- | --- | --- |
| `fun f/1` | Lokal fun i denna modul; varje `fun f/1` i en modul är samma värde | `f/1` i denna modul, exporterad eller inte |
| `fun m:f/1` | Extern fun som namnger `m:f/1`, även för den aktuella modulen | `m:f/1` när en modul i programmet exporterar den |
| `fun(X) -> ... end` | Lokal fun som fångar in de variabler den läser från sin skapare; varje utvärdering bygger ett nytt värde | Funens egen genererade funktion |
| `fun Name(X) -> ... end` | Samma sak, med `Name` bundet till funen inuti dess klausuler | Funens egen genererade funktion |
| `fun M:F/A` med variabler | Extern fun som byggs när den utvärderas; lika med den literala `fun m:f/1` den namnger | `m:f/1` när en modul i programmet exporterar den |

- `fun F/A` måste namnge en funktion i modulen (`function F/A undefined`) eller
  en autoimporterad inbyggd funktion: `fun is_atom/1` är den externa funen
  `erlang:is_atom/1`. Funs av inbyggda funktioner anropar dem via
  [bryggan för inbyggda funktioner](builtins.md); en inbyggd funktion utanför dess katalog
  (`fun self/0`, `fun erlang:apply/2`) rapporterar den otillgängliga förmågan
  `dynamic calls`.
- `F(Args)` utvärderar `F`, sedan argumenten från vänster till höger, och
  kontrollerar därefter värdet: ett värde som inte är en funktion ger
  `{badfun, F}`, en annan aritet `{badarity, {F, Args}}` (kontrolleras före
  modulen), en extern fun vars funktion ingenting i programmet exporterar
  `undef`. Ett anrop i svansposition är ett svansanrop, som för namngivna
  funktioner.
- `is_function/1,2` är sanna för funs i kroppar och guards.

## Dynamiska anrop

- `M:F(Args)` med en variabel (eller vilket uttryck som helst) som modul eller
  funktion utvärderar modulen, sedan funktionen, sedan argumenten från vänster
  till höger. En modul eller funktion som inte är en atom ger `badarg`; en
  funktion som ingen modul i programmet exporterar med den ariteten ger `undef`.
  Ett anrop i svansposition är ett svansanrop.
- `apply(Fun, Args)` och `apply(M, F, Args)` (autoimporterade om inte modulen
  definierar `apply/2,3` eller undertrycker importen; även `erlang:apply/2,3`)
  utvärderar sina argument och kräver sedan att `Args` är en äkta lista
  (`badarg`). `apply/2` anropar sedan `Fun` som `F(Args)` gör (`{badfun, Fun}`,
  `{badarity, {Fun, Args}}`); `apply/3` slår upp `M:F/length(Args)` som ovan,
  så fler än 255 argument ger `undef`. Båda är svansanrop i svansposition och
  aldrig tillåtna i guards.
- `fun M:F/A` med variabler ger `badarg` om inte `M` och `F` är atomer och `A`
  är ett heltal i 0..255; funktionen behöver inte finnas förrän funen anropas.
- Uppslag använder exporttabellerna för programmets moduler, som förblir
  registrerade under programmets livstid, så en funnen funktion kan inte
  försvinna under anropet. Det genomsöker modulerna och deras exporter och
  jämför atomord; hashmap-index är plan step 62A. Ett namn som ingen modul
  exporterar slås sedan upp bland [de inbyggda funktionerna](builtins.md), så `M:F(...)`,
  `apply/3` och `fun M:F/A` vid körning når inbyggda `erlang`-funktioner i bryggans
  katalog.
- **Tjänster.** `CLAUSE_call_v1(context, module, function, arity)` kontrollerar
  namnen och returnerar exportens `FrameDescriptor` (ABI-revision 8 lägger till
  den i `ExportDescriptor`); argumenten finns redan i registren.
  `CLAUSE_apply_list_v1(context, fun, list, registers)` och
  `CLAUSE_call_list_v1(context, module, function, list, registers)` kopierar
  först listan till registren. Alla tre returnerar null efter att ha registrerat
  felet, och genererad kod överför sedan via markören `clause.apply` som för
  `F(Args)`. `CLAUSE_make_external_fun_v1` bygger funen för en extern
  `FunDefinition` som kodservern skapar en gång per `M:F/A`
  (`CodeServer::external_fun`).

## Closures

- Varje klausul börjar från räckvidden vid funen. Variabler i huvudet är nya
  namn som skuggar yttre (OTP varnar); ett namn som upprepas inom ett huvud
  måste matcha. Guards läser huvudets namn. Inget som en fun binder syns efter
  den, och namn från case-klausuler i den omslutande funktionen når inte in i
  den.
- En fun fångar in varje yttre definition som dess huvuden, guards eller kroppar
  läser (inklusive nästlade funs), i definitionsordning, så som OTP ordnar en
  funktions fria variabler. Infångade värden kopieras in i fun-cellen när
  fun-uttrycket utvärderas, så de överlever att skaparen returnerar och
  skräpsamlingar, och kopieras med funen.
- Koden är en privat funktion `-f/A-fun-N-` (N räknar funs i `f/A` i
  källkodsordning) som tar funens argument och sedan dess infångade värden;
  stackspårningar visar det namnet med den sammanlagda ariteten, som OTP:s gör.
  Om ingen klausul matchar ges `function_clause`.
- Argument plus infångade värden är begränsade till 255.
- En namngiven funs klausuler ser `Name` som funen själv: ett nytt namn som
  skuggar ett yttre (OTP varnar), aldrig infångat och inte synligt efter funen.
  En huvudvariabel med samma namn skuggar det i sin tur. När en klausul läser
  `Name` bygger funens kod värdet vid inträde från dess infångade värden, så det
  är lika (`=:=`) med den fun som anropas, och `Name(...)` är ett vanligt
  fun-anrop: i svansposition är det ett svansanrop och körs med konstant stack.
- En anonym fun i ett standardvärde för ett record-fält är en enda fun för varje
  konstruktion som använder standardvärdet (OTP expanderar en kopia per
  ställe).

## Representation

- **Deskriptor.** Varje distinkt värde som en modul skapar kompileras till en
  `abi::v1::FunDescriptor` i modulens privata tabell `<prefix>.funs`
  ([funs.hpp](../abi/include/clause/abi/funs.hpp)): moduldeskriptor,
  atomplatser för modul och funktion, Erlang-aritet, index, extern-flagga och
  den `FrameDescriptor` som ett anrop går in i (null för en extern fun utanför
  programmet). Registreringen binder dem till `FunDefinition`
  (`ModuleAtoms::funs`, `CodeServer::fun_definition`); antalet infångade värden
  för en lokal fun är dess kods aritet minus funens.
- **Cell.** Boxad sort `fun_closure`: huvud (antal `1 + n`), en ospårad
  `const FunDefinition *`, sedan `n` infångade värden. Genomgång,
  skräpsamling, kopiering och verifiering hoppar över definitionsordet, som för
  native records.
- **Tjänster.** `CLAUSE_make_fun_v1(context, descriptor, captures, count,
  output)` bygger en fun. `CLAUSE_apply_v1(context, fun, arity, arguments)`
  kontrollerar ett anropat värde, registrerar felen ovan i felkanalen
  (`ErrorReason` 22-24) och lägger annars till de infångade värdena efter
  argumenten och returnerar den `FrameDescriptor` som ska anropas.
- **Inline-closures** (ABI 21). Den runtime som tar en moduls atomcache fyller
  också `ModuleDescriptor::fun_cache` med adressen till varje funs definition;
  så länge anspråket är dess eget allokerar genererad kod själv fun-cellen
  (huvud, definition, infångade värden) genom att flytta fram heappekaren och
  anropar `CLAUSE_make_fun_v1` endast när heaputrymme saknas eller i en annan
  runtime. `CLAUSE_apply_v1` och `CLAUSE_apply_list_v1` läser en fun med rätt
  aritet (och argumentlistan) direkt från dess celler före den kontrollerade
  vägen som rapporterar fel.
- **Anrop.** Den inbyggda formen skickar argumenten i en ordarray och anropar
  markören `clause.apply` med deskriptorn; `lower_frames` gör arrayen till
  processens register och markören till en överföring via
  `CLAUSE_enter_v1` eller, i svansposition, `CLAUSE_tail_v1`.

## Jämförelse och utskrift

- Termordning: tal < atom < fun < tupel < native record < map < nil < lista
  < bitstring (referenser, portar och pids, som ligger mellan atomer och tupler
  i OTP, finns ännu inte).
- Lokala funs ordnas före externa funs. Lokala funs jämförs efter modul, sedan
  index, sedan infångade värden i ordning (`==` jämför dem med `==`); externa
  funs efter modul, funktion och aritet. Lika deskriptorer ger lika värden, så
  `fun f/1 =:= fun f/1`.
- `erlang:display/1`, `~w` och rapporter om ofångade undantag skriver ut en
  extern fun som `fun m:f/1` (atomer citerade som emulatorn gör) och en lokal
  fun som `#Fun<m.Index.0>`.

## Skillnader

Dokumenterade i [skillnader](differences.md):

- En lokal fun skrivs ut som `#Fun<m.Index.0>`: OTP:s index följer dess
  kompilators lambdanumrering och dess tredje del är en hash av modulens kod.
  Clause numrerar lokala funs i källkodsordning, så ordningen mellan två lokala
  funs från olika funktioner i en modul kan också skilja sig.
- Att anropa en extern fun i en modul utanför programmet ger `undef`; OTP skulle
  först försöka ladda modulen från kodsökvägen. Detsamma gäller för
  `M:F(Args)` och `apply/3`.
- En stackspårning för `undef` börjar med anroparens ram; OTP:s börjar med
  `{M, F, Args, []}` för den saknade funktionen.
- Namn på anonyma funs (`-f/1-fun-0-`, syns i stackspårningar) räknar funs i
  källkodsordning; OTP:s kompilator numrerar dem i sin egen ordning. Funs som
  skapas inuti comprehensions kan också fånga in sina värden i en annan ordning
  än OTP:s, vilket bara syns när två sådana funs jämförs.

## Information om funs

Källa: `builtins/erlang/fun_info.cpp`. `erlang:fun_info/1` listar OTP:s
poster i OTP:s ordning: för en lokal fun `pid`, `module`, `new_index`,
`new_uniq`, `index`, `uniq`, `name` (`-F/A-fun-N-` för en anonym fun),
`arity`, `env` (de infångade värdena) och `type`; för `fun M:F/A` `module`,
`name`, `arity`, `env` (`[]`) och `type`.
`fun_info/2` returnerar en `{Item, Value}`; en okänd post ger `badarg`. `pid`
är `undefined`, `new_uniq` MD5 av modulnamnet och `uniq` dess första 24 bitar,
så de skiljer sig från OTP:s. `fun_to_list/1` är texten för `~w`.
`is_builtin/3` är sant för runtimens inbyggda funktioner och
`erlang:apply/2,3`.
