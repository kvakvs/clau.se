---
source: docs/asn1.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: fc528bb80707fa028fab896cf045bdf94eebb64ce17aa24704db249ed19cbe6b
translatedAt: 2026-10-26
---
# ASN.1-specifikationer

Clau kompilerar ASN.1-specifikationer (`.asn`, `.asn1` och modullistor i
`.set.asn`) till Erlang-moduler som OTP:s `asn1ct` gör: `Module.erl` med
`encode/2`, `decode/2` och modulens värden, samt `Module.hrl` med dess records
och makron. Den genererade modulen ingår i kompileringsomgången som vilken
annan källkod som helst; dess kodning och avkodning körs i C++-motorn för BER,
DER och PER i `clause_runtime` (ingen OpenSSL behövs). OTP:s specifikationer
för `public_key` kommer att kompileras på samma sätt.

## Indata

Positionsargument som slutar med `.asn` eller `.asn1` är specifikationer:

```sh
clau --asn1-option der --asn1-outdir gen Kitchen.asn main.erl -o app
clau --generate-asn1 --asn1-outdir gen Kitchen.asn   # only write gen/Kitchen.erl and gen/Kitchen.hrl
```

| Alternativ | Betydelse |
| --- | --- |
| `--asn1-option <option>` | Ett `asn1ct`-alternativ för alla specifikationer i anropet; kan upprepas. Standard är `ber`. |
| `--asn1-outdir <dir>` | Där `Module.erl` och `Module.hrl` skrivs (`outdir` i asn1ct); standard är aktuell katalog. Katalogen läggs till i inkluderingssökvägen, så `-include("Module.hrl").` fungerar. |
| `--generate-asn1` | Skriv bara genererade moduler och headerfiler; kompilera ingenting. |
| `-I <dir>` | Genomsöks också efter importerade ASN.1-moduler (`i` i asn1ct), efter specifikationens egen katalog. |

Ett projektmål listar specifikationer i `[[targets.asn1]]`-grupper, som var
och en kompileras med egna alternativ:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[[targets.asn1]]
sources = ["asn1/*.asn"]
options = ["per", "noobj"]
outdir = "build/gen"   # default: asn1/ in the target's build directory
```

`sources` (obligatoriskt) tar filer och jokerteckenmönster på samma sätt som
målets källfiler och matchar `.asn` och `.asn1`; ett mönster utan träff är ett
fel. Importer söks i katalogerna för gruppens specifikationer. En genererad
modul som redan finns bland målets källfiler läggs inte till två gånger.
`outdir` läggs till i målets inkluderingssökväg.

En `.set.asn`-fil listar en modulfil per rad (asn1ct:s sammanslagna
kompilering); varje namn provas som det är, sedan med `.asn1`, `.asn` och
`.py` tillagda. Den sammanslagna modulen får set-filens namn.

## Alternativ

| Alternativ | Effekt |
| --- | --- |
| `ber` | Basic Encoding Rules (standard). |
| `der` | Distinguished Encoding Rules: `ber` med sorterade `SET`/`SET OF`, utelämnade `DEFAULT`-värden och DER-kontroller. |
| `maps` | `SEQUENCE`/`SET`-värden är maps; komponenter som saknas utelämnas. |
| `undec_rest` | `decode/2` returnerar `{ok, Value, Rest}` med byten efter värdet. |
| `no_ok_wrapper` | `encode/2` och `decode/2` returnerar själva värdet och utlöser undantag vid fel. |
| `legacy_erlang_types` | `BIT STRING`- och `OCTET STRING`-värden som listor, `{Unused, Binary}` och heltal accepteras. |
| `legacy_bit_string`, `compact_bit_string` | Äldre `BIT STRING`-former (listor av 0 och 1, `{Unused, Binary}`); medför `legacy_erlang_types`. |
| `noobj`, `asn1config`, `verbose`, `warnings`, `errors`, `deterministic` | Accepteras, ändrar ingenting. |
| `per`, `uper` | Packed Encoding Rules, med och utan justering ([PER](#per)). |
| `no_final_padding` | Med `uper`: `encode/2` returnerar bitarna utan utfyllnad till en oktett (en bitstring). |
| `jer` | Avvisas: `jer (JSON encoding rules) is not supported`. |

Alla andra alternativ ger `unknown ASN.1 option 'Name'` (avslutningsstatus 2).

## Täckning

De konstruktioner i X.680/X.681/X.682/X.683 som OTP:s PKIX- och PKCS-moduler
och emqx:s specifikationer använder:

- Typer: `BOOLEAN`, `INTEGER` med namngivna tal, `ENUMERATED` med utökningar,
  `NULL`, `BIT STRING` med namngivna bitar, `OCTET STRING`,
  `OBJECT IDENTIFIER`, `RELATIVE-OID`, `REAL`, de begränsade teckensträngarna,
  `UTCTime`, `GeneralizedTime`, `ObjectDescriptor`, `SEQUENCE`, `SET`,
  `SEQUENCE OF`, `SET OF`, `CHOICE`, `ANY`, `ANY DEFINED BY`, `INSTANCE OF`,
  öppna typer, urvalstyper (`name < Type`).
- Taggning: explicita, implicita och automatiska taggar, modulstandarder,
  `COMPONENTS OF`, utökningsmarkörer, grupper av utökningstillägg och
  komponenterna efter utökningarna.
- Begränsningar: enstaka värden, intervall, `SIZE`, `FROM`, unioner och snitt
  (utvärderas för gränserna som BER kontrollerar och PER kodar);
  `WITH COMPONENT(S)`, `CONTAINING`, `PATTERN`, `CONSTRAINED BY` och `INCLUDES`
  parsas men kontrolleras inte, liksom i asn1ct.
- Informationsobjekt: klasser med `WITH SYNTAX`, `TYPE-IDENTIFIER`,
  `ABSTRACT-SYNTAX`, objekt, objektmängder (unioner, utökningsbara mängder,
  mängder från andra mängder och objektfält), enkla tabellbegränsningar och
  tabellbegränsningar för komponentrelationer (`{Set}{@a.b}`, avkodas och
  kodas genom objektets typ).
- Parametriserade typer, objekt och objektmängder; importer mellan moduler;
  `DEFAULT`-värden av alla typer.

Stöds inte, och ger var sitt fel på sin position: `EXTERNAL`, `EMBEDDED PDV`
och `CHARACTER STRING` (`unsupported ASN.1
type`), parametriserade värden, objekt extraherade från objektmängder,
`MACRO`-definitioner och värdenotationer som OTP:s specifikationer inte
använder (`unsupported value notation`).

## Genererade moduler

`Module.erl` exporterar samma som asn1ct:s: `encoding_rule/0`, `maps/0`,
`bit_string_format/0`, `legacy_erlang_types/0`, `encode/2`, `decode/2`,
`info/0` och en funktion per värdetilldelning. Records och deras namn följer
asn1ct (inre typer namngivna efter sin sökväg, `SEQOF`/`SETOF` för
samlingselement, parametriserade instanser), så `Module.hrl` är identisk med
asn1ct:s förutom den första kommentarraden; värden skrivs ut som asn1ct
skriver dem.

`encode/2` och `decode/2` returnerar `{ok, Value}` eller
`{error, {asn1, Reason}}` med asn1ct:s felorsaker (`{bad_range, ...}`,
`{unexpected, ...}`, `{invalid_choice_type, ...}`,
`{'Type not compatible with table constraint', ...}`, TLV-felen från
`asn1rt_nif`); avkodningen behåller asn1ct:s tolerans och egenheter (okända
utökningskomponenter hoppas över, `{asn1_OPENTYPE, Bytes}` och
`{asn1_ExtAlt, Bytes}` för okända öppna typer och `CHOICE`-värden,
`{asn1_enum, N}`).

De genererade funktionerna anropar `clause_asn1:encode/3` och
`clause_asn1:decode/3` med en schematerm: `{asn1_schema, 1,
Rule, Flags, #{Type => Node}, Nodes}`. Varje nod är `{Kind, Tags, Fields...}`
(typer i samma ordning som kompilatorns `NodeKind`, taggar som
`Number bsl 2 bor Class`; gränser `{Lower, Upper, Extensible}` med rotvärdena
för en utökningsbar lista av enstaka värden som fjärde element, begränsade
strängar med sitt PER-alfabet, komponenter med sin flagga för tilläggsgrupp);
formatet är internt för Clause och kan ändras.

## PER

`per` (med justering) och `uper` (utan justering) följer koden som asn1ct
genererar och `asn1rtt_per`/`asn1rtt_uper`/`asn1rtt_per_common`, byte för byte
(X.691 som OTP implementerar den):

- PER-synliga begränsningar som asn1ct:s `effective_constraint/2` beräknar dem:
  värdeintervall (begränsade, halvbegränsade och obegränsade heltal),
  `SIZE`-gränser under 64K (större kodas som obegränsade längder),
  utökningsbara rötter (en utökningsbar lista av enstaka värden kodar bara
  dessa värden som rotvärden) och `FROM`-alfabet för strängarna med känd
  multiplikator (`NumericString`, `PrintableString`, `VisibleString`,
  `IA5String`, `BMPString`, `UniversalString`, `UTCTime`, `GeneralizedTime`),
  vars tecken är index när deras koder inte ryms i teckenbredden.
- Rotkomponenter i `SET` kodas i taggordning, `CHOICE`-alternativ i textordning
  (som asn1ct, inte X.691:s kanoniska ordning), `ENUMERATED`-element efter
  värde; utökningstillägg är öppna typer, en tilläggsgrupp en `SEQUENCE` av
  sina komponenter; fragment över 16K enheter (oktetter, bitar, tecken,
  element).
- asn1ct:s egenheter behålls: i ett record läses utökningstillägg efter en
  grupp av flera komponenter från fel positioner (förskjutna med gruppens
  längd minus ett); element av öppen typ i en `SEQUENCE OF` ignorerar sin
  tabellbegränsning; att ta bort avslutande nollbitar från en helt nollställd
  namngiven `BIT STRING`-svans misslyckas med `badmatch`; felaktiga indata
  misslyckas med den genererade kodens `badmatch`, `case_clause` eller
  `function_clause` på de återstående bitarna.

## Diagnostik

Fel innehåller specifikationens sökväg, rad och kolumn och stoppar anropet
(avslutningsstatus 1) före Erlang-kompileringen:

```text
syntax.asn:4:1: error: expected '::=' near 'END'
undefined.asn:3:22: error: undefined reference Missing
import.asn:4:9: error: cannot find ASN.1 module Absent
empty.asn:1:1: error: no ASN.1 module found
```

Skillnader mot asn1ct listas i [differences.md](differences.md#asn1).
