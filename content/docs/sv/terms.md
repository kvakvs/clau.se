---
source: docs/terms.md
sourceCommit: 06042fa
sourceSha256: a6c1ea20b3bdb7055c6080cff72a2a86c4cdce87eb6bd8944ffce5c709e98d66
translatedAt: 2026-10-09
---
# Termrepresentationer

Tillåtna sorter: atomer/booleska värden, godtyckliga heltal, ändliga binary64-flyttal,
tupler, äkta/oäkta listor och strängar, maps, bitstrings och vanliga tupel-records;
native records ([native records](native-records.md)); funs
([funktionsvärden](funs.md)); lokala pids, portar och referenser
([nedan](#pids-and-references), [portar](ports.md#identity)). Ordkodningar finns i
[abi.md](abi.md#terms).

## Ägarskap

- Sammansatta värden lever i processens heap ([runtime](runtime.md#process-memory)).
  Processpekare pekar alltid på början av ett objekt. Admissionen kontrollerar
  ägarskap: ordet pekar, ordjusterat, under toppen av processens heapblock eller
  ett av dess fragment,
  och huvudet (eller cons-cellen) där matchar dess tagg
  ([admission](runtime-heap.md#admission)). Främmande och inaktuella ord avvisas
  utan någon läsning. Sort och utsträckning avkodas från huvudet.
- En värd-`Term` för ett heapvärde är ett rått taggat ord, giltigt till heapens
  nästa skräpsamling ([rötter](runtime-heap.md#roots-and-safe-points)); den
  fäster inte heapens minne. Efter att kontexten rivits returnerar åtkomst
  `expired_context`; efter en senare skräpsamling `stale_term`. Termer är alltid
  säkra att förstöra.
- Konstruktion validerar barn, reserverar, initierar och publicerar sedan i ett
  steg; vid fel rullas minne och räknare tillbaka.
- `Term::from_word(word)` tillåter endast ägaroberoende omedelbara värden;
  `Term::from_word(word, context)` tillåter även atomer och heaptermer från den
  kontexten. Överlämning inom samma heap behåller identiteten. `copy_to`/`ProcessHeap::add`
  kopierar en graf från en annan process i samma runtime med dess delning;
  termfabriker vägrar främmande indata med `wrong_owner`
  ([kopiering mellan heapar](runtime-heap.md#copying-between-heaps)).
- Celler lever tills en explicit skräpsamling finner dem onåbara, eller tills
  heapen rivs.

## Atomer

- `AtomStorage` per runtime, internerade vid behov efter exakt UTF-8-stavning,
  utan normalisering eller borttagning. `RuntimeOptions::max_atoms` 1..2^26,
  standard 2^20; modul- och exportnamn räknas. Befintliga stavningar lyckas även
  vid full kapacitet.
- Upp till 255 Unicode-skalärer; tom sträng, NUL och supplementära tecken
  tillåts; felaktig/överlång/surrogat-UTF-8 avvisas.
- Nyttolaster kommer från en räknare för hela processen så att en främmande
  runtimes atomord kan upptäckas. 32-bitarsprocesser har totalt 2^26 identiteter
  under sin livstid.
- Värdens atom-Terms fäster stavningen och överlever att runtime rivs. Att flytta
  en atom mellan runtimes innebär att `atom_utf8()` interneras i målet.
- Booleska värden är atomerna `true`/`false`.
- Internering och uppslag är säkra från samtidiga schemaläggararbetare
  ([trådar](runtime.md#threads)); en stavning behåller ett ord.

## Heltal

- Värden som ryms i målets 28/60-bitars nyttolast är omedelbara värden; större
  är oföränderliga celler med tecken/belopp. Noll och små värden normaliseras
  alltid till omedelbara värden. Ingen avsmalning av literaler till värdens bredd.
- Genererade `+`, `-`, `*` provar en inline snabbväg för två omedelbara värden
  (beräkning med dubbel bredd och explicita gränser), annars anropas
  runtime-tjänsten.
- `div` trunkerar mot noll; `rem` får dividendens tecken; bitvisa operationer
  använder oändligt tvåkomplement; negativa skiftantal vänder riktning; enorma
  högerskift mättas till 0 eller -1.
- Fel: felaktiga operander och nolldivisor → `badarith`; `abs/1` → `badarg`.
- Gränser: som i ERTS, ett belopp på högst `BIG_ARITY_MAX` ord: 4 194 240 bitar
  på 64-bitarsmål (65 535 ord), 4 194 272 på 32-bitars (131 071 ord); decimal
  text följer (1 262 593 och 1 262 602 siffror). Ett större aritmetiskt resultat
  ger `error:system_limit` i en kropp (`ValueOutcome::system_limit`,
  [ABI](abi.md#failure-channel-revision-2)) och får en guard att misslyckas; ett
  heltalssegment som extraherar ett större värde matchar inte. Kompilatorn
  avvisar en literal över 4 194 240 bitar (`illegal integer`, som OTP:s scanner)
  och ett konstant mönster över gränsen (`illegal pattern`).

## Flyttal

- IEEE binary64-bitar skickas till runtime som åtta byte i nätverksordning; NaN
  och oändlighet avvisas. Ingen fast-math.
- `+ - *` förblir exakta för två heltal; en flyttalsoperand ger binary64. `/`
  konverterar alltid båda. Icke-ändliga resultat och nolldivisorer → `badarith`.
- `float/1` avrundar till närmaste jämna; `round/1` avrundar lika avstånd bort
  från noll; `trunc`, `floor`, `ceil` returnerar godtyckliga heltal. Felaktiga
  operander → `badarg`.
- Exakt likhet skiljer `1` från `1.0` och `0.0` från `-0.0`; numerisk jämförelse
  jämför flyttalets exakta heltalsdel och bråkdel och avrundar aldrig heltalet.
  `min/max` returnerar den första operanden vid lika värden.

## Tupler, listor, strängar

- Tupel: aritetshuvud + fält. Cons: huvud- och svansord. `{}` och `[]` är
  omedelbara värden. Strängar är listor av kodpunkter. Listor har ingen
  längdgräns utöver minnet (inklusive en valfri heapbudget). Tupler rymmer upp
  till 16 777 215 element (`MAX_TUPLE_ARITY`, OTP:s `MAX_ARITYVAL`);
  konstruktorer rapporterar en större som `resource_limit`, inbyggda funktioner kommer att
  ge `badarg`.
- Tjänster: `hd`, `tl`, `length`, `tuple_size`, `size`, ettbaserad `element`.

## Maps

- Oföränderliga tabeller sorterade i exakt nyckelordning. Dubblerade nycklar vid
  konstruktion behåller det sista värdet. Konstruktion sorterar nycklarna
  (O(n log n) jämförelser; redan stigande nycklar kontrolleras bara);
  uppdateringar infogar med binärsökning. Ingen storleks- eller arbetsgräns utöver
  minnet, som i OTP; på 32-bitarsmål begränsar huvudets ordantal en map till
  2^24 - 1 poster (`resource_limit`). Heltals- och flyttalsnycklar skiljer sig
  (även `0.0` mot `-0.0`, även nästlat).
- Uppdateringar med `K := V` kräver nyckeln; `K => V` infogar eller ersätter.
  Uppdateringar förbereder en ny tabell och publicerar en gång.
- Fel i kroppar: `{badmap, M}`, `{badkey, K}`; guards avvisar i stället.
- Tjänster: `is_map`, `map_size`, `map_get`, `is_map_key`, konstruktion,
  uppdatering.

## Bitstrings

- Packade med mest signifikanta bit först, exakt bitlängd och nollad utfyllnad.
  Upp till 64 byte lever inline i en heap-binary dimensionerad efter datat; större
  värden använder en delad oföränderlig buffert utanför heapen, som visas genom
  binary-celler utanför heapen som extraherade svansar delar. Bufferten belastar
  den skapande processen en gång. Det finns ingen storleksgräns utöver en valfri
  heapbudget för processen; heltalssegment skrivs utan att ett heltal lika brett
  som segmentet byggs.
- Konstruktion förbereder alla segment före publicering. Heltalssegment
  trunkeras; inbyggd byteordning kommer från målets datalayout.
- Flyttalssegment: bredderna 16/32/64; konstruktion kan koda oändlighet, men
  matchning avvisar oändliga fält och NaN-fält. Flyttalsmatchningar med bredd
  noll extraherar `0.0`.
- UTF-8/16/32-segment validerar skalärer, surrogat och trunkering.
- Matchning flyttar fram en explicit bitmarkör endast vid lyckat utfall; `:all`
  som explicit storlek är ogiltigt.
- Tjänster: `is_binary`, `is_bitstring`, `bit_size`, `byte_size` (avrundar uppåt),
  `size` (avrundar nedåt), `binary_part/2,3`. Fel → `badarg`.

## Records

- Vanliga records expanderas till tupler `{Tag, Fields...}`. Deklarationer måste
  komma före användning; dubbletter, okända fält, framåt-/självreferenser och
  ogiltiga jokerteckenfält är fel.
- Konstruktion utvärderar fält i deklarationsordning: explicit värde, annars
  jokerteckenstandard `_ = V`, annars deklarerat standardvärde, annars
  `undefined`. Varje standardvärde utvärderas separat vid varje användning.
- Mönster kontrollerar aritet och tagg och sedan endast de listade fälten.
  `#r.f` är det ettbaserade indexet (taggen på 1).
- Fältåtkomst kontrollerar aritet och tagg; fel ger `{badrecord, V}` i kroppar
  och avvisning i guards.
- `is_record(V, r)` använder den deklarerade ariteten. `is_record/3` kräver en
  atomtagg och en heltalsaritet (icke-positiv → falskt; fel typer → `badarg`);
  en atom som tredje argument är frågan för native records och returnerar
  falskt. Guards kräver literala argument.
- Uppdateringen `Expr#r{f = V, ...}` utvärderar de nya värdena i källkodsordning,
  sedan `Expr`, kontrollerar därefter aritet och tagg (`{badrecord, Value}` vid
  avvikelse, även för `Expr#r{}`) och bygger en ny tupel; övriga fält kopieras.
  `_ = V` avvisas i uppdateringar; uppdateringar är otillåtna i mönster och
  guards.
- `record_info(fields | size, r)` expanderas vid kompilering till listan med
  fältnamn eller tupelstorleken. Båda argumenten måste vara literala atomer och
  `r` ett tupel-record som deklarerats tidigare; det är otillåtet i guards, och
  en lokal `record_info/2` avvisas som redan definierad.
- Native records: [native records](native-records.md) (lokala, kvalificerade,
  importerade och anonyma former).

## Pids och referenser

Plan 11 step 42. `self/0` returnerar den anropande processens pid, `make_ref/0`
en ny referens; `pid_to_list/1` och `ref_to_list/1` returnerar deras text.

- En pid är ett omedelbart ord (låga fyra bitar `0x3`) som innehåller
  processens nummer. Nummer kommer från en enda sekvens för hela processen och
  återanvänds aldrig, så en runtime tillåter ett pid-ord endast om den delat ut
  det numret: ett förfalskat ord (aldrig utdelat) eller en annan runtimes pid är
  `wrong_owner`. Pid:en för en avslutad process förblir en giltig term, som i
  OTP. 32-bitarsmål har 2^28 nummer per programkörning, 64-bitarsmål 2^60; att
  skapa en process bortom dem misslyckas med `resource_limit`.
- En port (plan step 57B) är ett omedelbart ord (låga fyra bitar `0x7`) som
  innehåller dess nummer från en egen sekvens som aldrig återanvänds, och tillåts
  som en pid; den skrivs ut som `#Port<0.N>` och ordnas mellan funs och pids
  ([portar](ports.md#identity)).
- En referens är en heapcell (`reference`: huvud plus ett ospårat 64-bitars
  nummer) som tillåts som alla heaptermer: endast i sin egen process, inaktuell
  efter en skräpsamling för en värd-`Term`, kopieras som värde mellan processer.
  Nummer kommer från en räknare för hela processen, så varje referens i en
  programkörning är unik.
- Utskrift följer OTP:s lokala identiteter: en pid som `<0.N.S>` (N de låga 28
  bitarna av dess nummer, S resten), en referens som `#Ref<0.A.B.C>` (C de låga
  18 bitarna av dess nummer, B de nästa 32, A resten), i både `~w`- och
  display-stil. Pids ordnas efter nummer, referenser efter nummer, så senare
  referenser i ett program ordnas efter tidigare.

## Jämförelse och ordning

Iterativ utan arbetsgräns, som i OTP: endast minnet för väntande par begränsar
en jämförelse, inklusive nyckelsökningar i maps, och identiska ord är lika utan
genomgång. Byte-justerade bitstrings jämför hela byte åt gången. Ordning: tal < atomer < referenser < funs < pids < tupler < native records < maps < nil < listor <
bitstrings ([funs](funs.md#comparison-and-printing) ordnas sinsemellan). Atomer jämförs efter UTF-8-stavning (kodpunktsordning); tupler efter aritet
och sedan fält; maps efter storlek, sedan nycklar, sedan värden; bitstrings efter
logiska bitar.

## Utskrift

`format_term` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
återger varje tillåten term i en av två OTP-stilar. Heltal, tupler (records är
tupler) och nästling ser likadana ut i båda.

| | `~w` (`TermStyle::write`) | `erlang:display/1` (`TermStyle::display`) |
| --- | --- | --- |
| Atomer | Citeras om den inte börjar med en gemen Latin-1-bokstav följd av namntecken (med `@`); reserverade ord och `maybe`/`else` citeras; tecken utanför Latin-1 skrivs som `\x{H}` | Citeras om den inte börjar med en gemen Latin-1-bokstav följd av alfanumeriska tecken eller `_`; reserverade ord och `@` har ingen specialregel; UTF-8 behålls |
| Flyttal | Kortaste tur-och-retur i OTP:s layout: `0.1`, `100.0`, `1.0e16`, `1.5e-7` | C `%.6e`: `1.500000e+00` |
| Listor | Element: `[104,105]`, `[1,2\|3]` | En platt lista av utskrivbara Latin-1-byte skrivs som `"hi"` (råa byte; endast `\n` och `"` skyddas) |
| Bitstrings | `<<1,2,5:3>>` | En utskrivbar ASCII-binary skrivs som `<<"hi">>`, andra som `~w` |
| Maps | `#{k => v,k2 => v2}` | `#{k=>v,k2=>v2}` |

- Maps skrivs ut i map-nyckelordning (`maps:iterator(M, ordered)`, som OTP:s
  `~kw`). OTP:s standard-`~w` och `erlang:display/1` följer i stället dess
  interna layout: atomtabellens ordning för atomnycklar i små maps (den varierar
  mellan VM-körningar) och hashordning över 32 nycklar. Clause återskapar inte
  den ordningen.
- Återgivningen är iterativ, så djupet begränsas endast av termen. Texten är som
  standard begränsad till 64 MiB; att överskrida den (till exempel med en vitt
  delad delterm) misslyckas med `resource_limit` och returnerar ingen deltext.
- Goldens: `runtime_printing` jämför båda stilarna med OTP för
  9 542 värden (alla korpusresultat plus författade gränsfall); display-rader
  vars map-ordning i OTP är intern hoppas över
  ([fixturer](../tests/fixtures/printing/README.md)).
