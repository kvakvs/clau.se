---
source: docs/preprocessor.md
sourceCommit: a8c3f8f6
sourceSha256: 57dcb1da3315eb173341c8100e17e37df776b01f85f4c06585c1b7e5d3503daf
translatedAt: 2026-10-17
---
# Preprocessor

Inbyggd C++-omimplementation av OTP:s `epp` för den fastlåsta
`maint-29`-källkoden. Boost.Parser hanterar teckenregler; delad
kompilatormetadata tillhandahåller operatorprioritet. Expanderade token görs
aldrig om till källtext.

`PreprocessorSession` returnerar expanderade former (inklusive implicita
`-file`-attribut), strukturerad diagnostik och oföränderliga ögonblicksbilder av
funktioner per form; `features()` exponerar sessionens slutliga tillstånd för
parsern. Detta är ett internt gränssnitt, inte ett publikt stegformat.
`DirectiveReader` är det äldre API:t för enbart syntax.

## Beteende som stöds

- Objektmakron och makron överlagrade på aritet, rå substitution, nästlade
  block-/fun-argument, strängifiering med OTP:s kanoniska tokenstavning,
  omdefiniering, avdefiniering och diagnostik för beroendecykler.
- Nästling av villkor med överhoppade effekter och fel, diagnostik vid EOF.
- `-include`/`-include_lib`, sökvägshuvuden med miljövariabler, skyddad
  rekursion.
- `?MODULE`, `?BASE_MODULE` (och `_STRING`-formerna), `?FILE`, `?LINE`,
  `?FUNCTION_NAME`/`?FUNCTION_ARITY`, `?FEATURE_AVAILABLE`/`?FEATURE_ENABLED`,
  `?OTP_RELEASE` (29) och `?MACHINE` (`'BEAM'`, endast för
  källkodskompatibilitet).
- Utvärdering av guards i `-if`/`-elif` med godtyckliga heltal och OTP:s katalog
  över guard-BIF:ar; inga godtyckliga anrop körs.
- Funktioner i OTP 29.1: `maybe_expr` (aktiverad som standard, styr
  `maybe`/`else`) och `compr_assign` (experimentell, avstängd). Initialt `all`
  väljer båda; `-feature(all, ...)` i källkod är ogiltigt, som i epp. Andra namn
  är fel.

## Kompatibilitetspolicyer

- Uppslag av inkluderingar: den aktuella filens katalog, arbetskatalogen, sedan
  include-sökvägar i API-ordning. CLI:n vänder ordningen på upprepade `-I` för
  att matcha `erlc`. Absoluta sökvägar kringgår sökningen. `include_lib` provar
  vanliga sökvägar, sedan explicit angivna applikationskataloger och sedan
  releasers kataloger `<app>-<version>` under varje genomsökt katalog
  (versioner är punktseparerade siffror, så som OTP:s kodserver läser dem; den
  högsta vinner). Flera versioner av en applikation ger en varning en gång per
  körning som namnger den katalog som används; ingen kodserver.
- Sökvägshuvuden `$VAR` använder en injicerad resolver; ej satta variabler
  förblir literala. Operander till inkluderingar makroexpanderas inte. Filer
  avkodas som UTF-8 eller deklarerad Latin-1; värdens sökvägsregler gäller
  oavsett mål-CPU.
- Inkluderingar delar tillstånd för makron/funktioner/modul; varje fil äger sin
  villkorsstack och logiska filmappning.
- Villkor validerar alla grenar före kortslutande utvärdering. Ogiltig syntax är
  ett fel; obundna variabler, icke-booleska resultat och undantag vid
  utvärdering ger falskt. Åtkomst till record-fält/index i villkor misslyckas;
  en record-åtkomst i en kortsluten gren som inte väljs är giltig.
- Record-konstruktion i ett villkor får en kontrollerad diagnostik
  (`record construction requires record expansion`); epp i OTP 29.1 kraschar
  där.
- Initialvärden för `-D` är literala termer normaliserade till token, inklusive
  binaries och externa funs som `erl_parse:tokens/1` inte kan representera.
- `self()` är en stabil syntetisk pid och `node()` är `nonode@nohost`.
- Ett LF direkt efter en inkluderings avslutande punkt flyttar fram den
  returnerade `-file`-raden; mellanslag, kommentar och CRLF följer OTP:s
  `scan_dot` på ett tecken.

## Gränser och diagnostik

Standardvärden (konfigurerbara via `PreprocessorLimits`): 256 expansionsnivåer
och 1 000 000 producerade token per form, inkluderingsdjup 64, uttrycksnästling
256, samt fasta gränser på 4 194 240 bitar för heltal (OTP:s gräns på
64-bitarsvärdar) och 1 000 000 bitar för bitstring-värden. Uttömning är en
resursdiagnostik, aldrig ett tyst falskt villkor.

Diagnostik bär en stabil kategori, allvarlighetsgrad, fysiska intervall,
valfria logiska koordinater och relaterade intervall för makron/inkluderingar.
Varningar får inget att misslyckas; fel låser fast misslyckandet medan
återhämtningen fortsätter vid nästa formgräns.

## Tester

Goldens för token (`tests/fixtures/preprocessor/semantic/*.erl.tokens`)
registrerar epp:s tokensorter, avkodade värden (flyttal som binary64-bitar) och
diagnostikens ordning; formuleringen behöver inte vara densamma som i OTP.
Inkluderade headerfiler (`semantic/headers/*.hrl`) är skrivna lokalt, inte
kopierade från OTP. `preprocessor_workflow` täcker verkliga inkluderingsträd,
alternativens ordning, miljö, Latin-1 och villkorsfall via CLI:n.
