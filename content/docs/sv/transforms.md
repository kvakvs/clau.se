---
source: docs/transforms.md
sourceCommit: 6ed3851c
sourceSha256: 2c6d8c271fd5fd640bb4c93eaff0872914f396898bfe9df527ca51055d033c11
translatedAt: 2026-10-15
---
# Parse transforms

## Använda parse transforms

- **Krav:** Erlang/OTP 29 installerat på värden, endast för att kompilera
  moduler som använder en transform. `clau` tar `--erl PATH`, annars `erl` i
  `PATH`, annars på Windows `%ProgramFiles%\Erlang OTP\bin\erl.exe`.
  `--erl none` kör aldrig kod på värden: moduler som behöver en transform
  misslyckas.
- **Anropa en transform** i källkoden med
  `-compile({parse_transform, Module}).` (eller inuti en `-compile([...])`-lista),
  eller för varje modul i kommandot med `--parse-transform Module`
  (kan upprepas; dessa körs först, som `erlc +'{parse_transform,M}'`).
- **Transformmoduler** hittas som `.beam`-filer i `--transform-path`-kataloger
  (kan upprepas) och projektets `transform_paths`, sedan som `Module.erl`
  bland batchens källfiler och `source_search_paths` (kompileras av värdens
  OTP vid varje bygge, tillsammans med de moduler som de anropar därifrån;
  `ignore_dirs` och `ignore_modules` gäller),
  sedan bland OTP:s moduler (`ms_transform`, `qlc`).
- **Förkompilera** en transform som kommer från ett annat bibliotek (alltid),
  eller en projekttransform som värdens kompilator inte kan bygga med målets
  include-kataloger och definitioner: `erlc -o deps/lib/ebin deps/lib/src/*.erl`
  med värdens OTP, och ange sedan `deps/lib/ebin` med `--transform-path` eller
  i `transform_paths`. `.beam`-filen måste komma från värdens OTP-version; en
  `.beam` där vinner över en källfil för samma modul.
- **Vad som kör den:** kompilering, `--print-ast`, `--print-source` och
  `--print-abstr` (som visar de transformerade formerna); `--parse-check`,
  `--preprocess-check` och `--print-pp` gör det inte.

```sh
clau --erl "C:/Program Files/Erlang OTP/bin/erl.exe" --transform-path ebin -o app app.erl
```

Clause tillämpar `{parse_transform, Module}` på samma sätt som `erlc`. Den
exporterar den tolkade modulen som former i OTP:s
[abstrakta format](https://www.erlang.org/doc/apps/erts/absform.html), kör
transformmodulen på ett Erlang/OTP 29 som är installerat på värden, importerar
de returnerade formerna som modulens nya syntax och kompilerar den. OTP behövs
endast medan en modul som använder en transform kompileras; genererade program
behöver det aldrig. Beslutat i plan step 73A; implementerat av steps 73B–73G
(`compiler/src/transforms/`).

## OTP:s beteende

Från den fastlåsta `lib/compiler/src/compile.erl` (`transform_module`,
`foldl_transform`, `maybe_strip_columns`) och observerat under OTP 29.1.1:

- Transformer körs som det första standardpasset: efter `epp` och tolkning,
  före `erl_lint`, innan `erl_internal` lägger till `module_info/0,1` och
  `behaviour_info/1`.
- Transformlistan är varje `{parse_transform, M}` bland
  kompileringsalternativen (`erlc +'{parse_transform,m}'`), sedan bland
  `-compile`-attributen i formordning. En transform som anges två gånger körs
  två gånger. Innan den första körs tas dessa alternativ bort från formerna:
  ett `-compile`-attribut som endast innehåller alternativet försvinner, en
  lista förlorar elementet.
- `M` måste kunna laddas (`code:ensure_loaded/1`) och exportera
  `parse_transform/2`, annars blir felet `undefined parse transform 'M'`
  (utan plats).
- `M:parse_transform(Forms, Options)` får formerna och
  kompileringsalternativen (inte källkodens `-compile`-alternativ):
  `{features, Enabled}`, `report_warnings`, `report_errors`, `{cwd, Dir}`,
  `{outdir, Dir}`, `{i, Dir}` per include-katalog, `{d, Name[, Value]}` per
  definition, plus varje `{parse_transform, M}` som getts som alternativ.
- Den returnerar `Forms`, `{warning, Forms, Warnings}` eller
  `{error, Errors, Warnings}`, där varje lista är
  `[{File, [{Location, Module, Descriptor}]}]` formaterad av
  `Module:format_error(Descriptor)`. Ett undantag är felet
  `error in parse transform 'M': ...` (`compile:format_error/1` av
  `{parse_transform, M, {Class, Reason, Stack}}`). Nästa transform får den
  föregåendes former; det första felet stoppar kedjan.
- `M:parse_transform_info/0` som returnerar `#{error_location => line}`, eller
  kompileringsalternativet `{error_location, line}`, tar bort kolumner från
  formerna innan `M` körs och från de slutliga formerna.
- Former bär annoteringar `{Line, Column}`. `epp` lägger först till
  `{attribute, {1,1}, file, {File, 1}}`, detsamma för varje inkluderad fil när
  den börjar, och `{attribute, {L,1}, file, {File, L}}` när den inkluderande
  filen fortsätter på rad `L`, raden efter dess `-include`. Makrodefinitioner
  och andra direktiv lämnar ingen form. Listan slutar med `{eof, Location}`,
  slutet av huvudfilen. Fel från preprocessorn och tolkningen stannar i listan
  som `{error, E}`-former och `erl_lint` rapporterar dem efter transformerna.
- OTP 29-former som `absform.md` inte listar: `{attribute, A, native_record,
  {Name, Fields}}`; record-namn `{Module, Name}` (kvalificerade) och `[]`
  (`#_`) i `record`/`record_field`-uttryck; `{type, A, record, [{tuple, A,
  [Module, Name]} | Fields]}` för kvalificerade record-typer; `{zip, A,
  Qualifiers}` som kvalificerare i comprehensions; `{mc, ...}`, `m_generate`
  och `_strict`-generatorerna.
- `erlc +to_abstr` skriver formerna efter transformer (och `erl_lint`) till
  `File.abstr`, en `~p.`-term per form; `erlc File.abstr`
  (`compile:file(F, [from_abstr])`) kompilerar en sådan fil utan preprocessor
  eller parser.

## Clauses kedja

1. Förbehandla och tolka modulen. Fel från preprocessorn eller tolkningen
   stoppar här; transformer körs inte på en modul med fel (skiljer sig från
   OTP, som skickar vidare felen som former).
2. Samla transformerna i OTP:s ordning: `--parse-transform`-alternativ och
   projektets `parse_transforms`, sedan `-compile`-attribut. En modul utan
   några hoppar över resten och startar aldrig OTP.
3. Ta bort dessa alternativ från formerna och exportera dem: annoteringar
   `{Line, Column}` så som `erl_parse` tilldelar dem, `epp`:s `file`-attribut
   och `eof`. De fördefinierade funktionerna är ännu inte en del av formerna.
4. Kör [laddaren](#loader) en gång för modulen.
5. Importera de returnerade formerna genom att göra dem till token placerade
   vid sina annoteringar och tolka dem med Clauses parser; ett
   `file`-attribut byter fil för de följande formerna som i `erl_lint`.
6. Lägg till de fördefinierade funktionerna, och kör sedan lint, analys och
   kompilering som vanligt.

Transformer körs när en modul kompileras och för `--print-ast`,
`--print-source` och `--print-abstr`, som skriver ut den transformerade
modulen. `--preprocess-check`, `--parse-check` och `--print-pp` kör dem inte.

## Utbyte

- `clau` och laddaren utbyter filer i External Term Format
  (`term_to_binary`, version 131, okomprimerat): exakta flyttal,
  UTF-8-atomer, stora heltal och ingen texttolkning i Erlang. Själva formatet
  (taggar, layouter, gränskontroller) finns på ett ställe i
  `abi/include/clause/abi/external_term.hpp`, oberoende av någon
  termrepresentation, så att runtimens framtida `term_to_binary/1`,
  `binary_to_term/1` och distribution återanvänder det.
  Clauses termmodell i kompilatorn innehåller atomer, heltal, flyttal, äkta
  och oäkta listor, tupler, maps och bitstrings; pids, portar, referenser och
  funs avvisas med en diagnostik.
- `.abstr`-text är syntaxen för
  [`file:consult/1`](https://www.erlang.org/doc/apps/kernel/file.html#consult/1):
  en term per form, var och en avslutad med `.`. `--print-abstr` skriver ut
  varje moduls former efter transformer i den syntaxen till stdout, en form
  per rad; en `.abstr`-indatafil kompileras som `erlc File.abstr`. Clause
  skriver kanonisk text, inte OTP:s `~p`-layout; det som spelar roll är lika
  termer. Formerna är lika med `epp:parse_file(F, [{location, {1, 1}}])` för
  varje konstruktion i `tests/fixtures/transforms/abstract/`, inklusive
  `epp`:s `file`-attribut (en explicit `-file` annoteras
  `[{generated, true}, {location, L}]`) och en `eof` räknad från den sista
  `-file` i huvudfilen.

## Importera former

Returnerade former, och `.abstr`-indata (positionella eller projektets
`sources`), blir token placerade vid sina annoteringar och går genom Clauses
parser, så att de får samma syntaxkontroller som källkod;
operatorprioriteten avgör var parenteser läggs till. `{Line, Column}`, en
ensam `Line` (visas som `file:line:`) och egenskapslistor med `location` och
`file` godtas; `generated` ignoreras. Ett filattribut byter fil för de
följande formerna; när den filen finns behåller importerad kod sina
felsökningsrader och källkommentarer. Felformade former är fel vid sin
annotering (`unknown expression bogus`, `expected {Name, Arity}`,
`invalid annotation`) och modulen misslyckas; OTP:s
`{error, _}`/`{warning, _}`-former rapporteras med sin deskriptor, som kräver
OTP för att formateras. Att importera en exporterad modul och exportera den
igen ger samma former.

## Värdens OTP

- `erl` söks i ordning: `--erl PATH`, `erl` i `PATH`, sedan på Windows
  `%ProgramFiles%\Erlang OTP\bin\erl.exe`. Att inte hitta någon när en modul
  behöver en transform är ett fel som namnger transformen och modulen; det
  finns ingen reservväg som hoppar över transformer.
- Värden måste köra OTP 29 (`erlang:system_info(otp_release)`); en annan
  version är ett fel.
- [Laddaren](#loader) körs som `erl -noshell -noinput -pa Dir ... -eval ...`
  (kodsökvägens kataloger görs absoluta) med en tidsgräns på 600 s. Dess
  stdout och stderr (inklusive transformens utdata från `io:format`) kopieras
  till `clau`:s stderr när den avslutats.
  En laddare som avslutas utan att skriva ett svar, överskrider tidsgränsen
  eller inte kan starta är ett fel.
- En transform kör godtycklig kod med användarens rättigheter, precis som den
  skulle göra under `erlc`.

## Laddare

`compiler/src/transforms/loader/clause_transform_loader.erl` ägs av projektet
och är inbäddad i `clau`. Varje körning skriver den och begäran i en ny
temporär katalog, `clause-transform-*` under `<build_dir>/tmp`
([byggkatalog](projects.md#build-directory)) eller, för positionella indata
utan `--build-dir`, systemets temporära katalog, som tas bort efter körningen;
`erl` kompilerar och laddar laddaren i minnet. Begäran innehåller formerna,
alternativen, transformlistan, modulens filnamn och de projekttransformer i
källform som ska byggas. Med en byggkatalog behålls svaret och laddarens
utdata i [byggcachen](projects.md#build-caches) och återanvänds så länge
begäran och allt den beror på är oförändrat; värdens lista över klibbiga
(sticky) moduler behålls på samma sätt. Laddaren:

1. kontrollerar OTP-versionen;
2. kompilerar de begärda projekttransformerna i källform i minnet och laddar
   dem;
3. för varje transform: laddar den, tar bort kolumner så som
   `parse_transform_info/0` begär, anropar `parse_transform/2` och formaterar
   varningar och fel till `{File, Location, Text}` med
   `Module:format_error/1`;
4. skriver `{ok, Forms, Warnings}` eller `{error, Errors, Warnings}` och
   stannar.

## Transformmoduler

En transformmodul slås upp i denna ordning:

1. **Förkompilerade `.beam`-filer** i katalogerna från `--transform-path DIR`
   (kan upprepas) och projektalternativet `transform_paths`, som läggs i
   laddarens kodsökväg före OTP:s. Detta är det enda sättet att använda en
   transform som kommer från ett beroendebibliotek: bygg det biblioteket med
   värdens OTP först (till exempel `erlc -o deps/lib/ebin deps/lib/src/*.erl`);
   Clause bygger aldrig beroenden. `.beam`-filen måste komma från värdens
   OTP-huvudversion.
2. **Det aktuella projektets källfiler**: en `Module.erl` i batchen eller dess
   `source_search_paths`, kompilerad av laddaren i minnet med målets
   include-kataloger och definitioner vid varje körning, tillsammans med de
   projektmoduler som den anropar via namn (hittade på samma sätt). Sökningen
   hoppar över källfiler som `ignore_dirs` eller `ignore_modules` utelämnar,
   som [modulsökningen](projects.md#ignored-sources) gör. Clause letar efter
   dessa källfiler en gång per batch och behåller dem i minnet; laddaren
   kompilerar dem ändå för varje modul som transformen körs på, så
   förkompilera en stor transform för att spara den tiden.
   Moduler som värden laddar från sina klibbiga kataloger (`kernel`,
   `stdlib`, `compiler`, till exempel `ms_transform` eller `qlc_pt` när OTP:s
   källkod finns på en söksökväg) kan inte laddas om, så värdens egna moduler
   används: deras källfiler, och de moduler som endast de anropar, söks inte
   efter och kompileras inte. Clause frågar värdens `erl` efter dessa moduler
   en gång per anrop.
3. **OTP:s egna moduler** (`ms_transform`, `qlc`) från värdens kodsökväg.
   OTP levererar `erl_id_trans` endast som en exempelkällfil, inte som en
   modul. Deras headers löses som varje `include_lib`
   ([preprocessor](preprocessor.md#compatibility-policies)): avbilda
   applikationen, som i
   `--app-dir "stdlib=C:/Program Files/Erlang OTP/lib/stdlib-8.1"` för
   `include_lib("stdlib/include/ms_transform.hrl")`, eller ange transformen
   direkt med `-compile({parse_transform, ms_transform})`.

Att kompilera en projekttransform kan misslyckas där dess verkliga bygge
lyckas: headers från beroenden, en transform av transformen, eller makron som
endast ett annat byggverktyg definierar. Clause rapporterar då kompilatorns
meddelanden mot transformens källfil med tipset att förkompilera den till en
`.beam` med värdens OTP och skicka dess katalog med `--transform-path`. En
projekttransform kompileras också av Clause som en vanlig modul när den ingår
i batchen; dess egna anrop (`erl_syntax`, `erl_parse`, ...) kan då behöva
biblioteksmoduler som Clause inte levererar, så håll transformer utanför ett
måls `sources` när endast transformen behöver dem.

## Diagnostik

| Situation | Meddelande |
| --- | --- |
| Inget OTP på värden | `File: parse transform 'M' needs Erlang/OTP 29 on the host; pass --erl` |
| `--erl` anger ingen körbar fil | `File: erl not found: PATH` |
| Fel OTP-version | `parse transforms need Erlang/OTP 29 on the host, found N` |
| Transformen hittades inte | `File: undefined parse transform 'M'` (OTP:s text) |
| Transformen kastade | `File: error in parse transform 'M': ...` (OTP:s text) |
| Varning eller fel från transformen | `File:Line:Column: Text` som returnerat |
| Transformens källfil kompileras inte | dess meddelanden, sedan tipset om förkompilering |
| En transformsökväg finns inte | `File: parse transform path is not a directory: DIR` |
| En `.beam` på en transformsökväg laddas inte | `File: cannot load parse transform 'M' from PATH: Reason` |
| Laddaren misslyckades, överskred tidsgränsen eller skrev inget svar | `parse transform loader failed: ...` |
| Ogiltiga returnerade former | parserns diagnostik vid formens plats |

## Alternativ

| CLI | Projekt (`[targets.options]`) | Betydelse |
| --- | --- | --- |
| `--parse-transform M` | `parse_transforms = ["m"]` | Tillämpa `M` på varje modul, före dess egna `-compile`-transformer (CLI:ns först) |
| `--transform-path DIR` | `transform_paths = ["deps/*/ebin"]` | Kodsökväg för förkompilerade `.beam`-filer för transformer; mönster som i `source_search_paths` |
| `--erl PATH` eller `none` | — | Värdens körbara `erl`; `none` kör aldrig kod på värden |
| `--print-abstr` | — | Skriv ut formerna efter transformer i stället för att kompilera |

Ett projekt som använder sin egen transform och en förkompilerad från ett
beroende:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[targets.options]
source_search_paths = ["transforms"]  # transforms/pt_rewrite.erl, compiled for each build
parse_transforms = ["pt_dep"]         # applied to every module of the target
transform_paths = ["deps/*/ebin"]     # deps/ptdep/ebin/pt_dep.beam, built with erlc first
```

Håll transformmoduler utanför ett måls `sources` när programmet inte anropar
dem: som vanliga moduler skulle de också kompileras av Clause, och deras
anrop till `erl_parse` eller `erl_syntax` behöver moduler som Clause inte
levererar.
