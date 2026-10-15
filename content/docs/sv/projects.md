---
source: docs/projects.md
sourceCommit: 6ed3851c
sourceSha256: 8a996bd18e6d699944fde901a3d45fece06aa55859935b3fe26c1518edc03e7d
translatedAt: 2026-10-15
---
# TOML-projekt

Ett projektmanifest väljer ordnade grupper av Erlang-källfiler och konfigurerar
varje mål oberoende. Alla CLI-åtgärder godtar projekt. Se det
[fungerande exemplet](../examples/project/project.toml).

## Manifest (schema 1)

```toml
schema_version = 1

[[targets]]
name = "app"
sources = ["main.erl", "src/workers/*.erl", "shared/**/*.erl"]
source_dirs = ["src/support"]
output = "build/app"
entry = "main:main"
build_dir = "build"

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]
ignore_dirs = ["src/legacy", "deps/*/test"]
ignore_modules = ["telemetry", "*_SUITE"]
keep_exports = false
cache_inference_in_dirs = ["deps/*"]

[targets.options.applications]
my_dependency = "vendor/my_dependency"
```

- `schema_version = 1` och en icke-tom `targets`-array krävs. Okända nycklar,
  fel typer, dubblerade målnamn och tomma strängar avvisas; ingen
  typkonvertering. Hela manifestet valideras, inklusive mål som inte valts.
- Målnamn: skiftlägeskänslig ASCII `[A-Za-z0-9_][A-Za-z0-9_.-]*`, unika. Ett
  namn är ett byggmål, inte en LLVM-tripel.
- `sources` (filer och jokerteckenmönster) och `source_dirs` (rekursiv sökning
  efter `.erl` och `.abstr`) är valfria, men ett mål behöver minst en post.
  Explicita filer måste sluta på `.erl`, eller `.abstr` för former i abstrakt
  format ([transformer](transforms.md#interchange)); headerfiler är beroenden,
  inte indata.
- `parse_transforms` (modulnamn) och `transform_paths` (kataloger eller mönster
  för förkompilerade `.beam`-filer) i `options` tillämpar parse transforms på
  målets moduler ([transformer](transforms.md#options)).
- `ignore_dirs` (sökvägar) och `ignore_modules` (modulnamn), båda med
  jokertecken, i `options` utesluter källfiler från bygget
  ([ignorerade källfiler](#ignored-sources)).
- `keep_exports = true` i `options` håller varje export i målets körbara fil
  anropbar, så som `--keep-exports` gör för varje valt mål
  ([exporters livskraft](executables.md#export-liveness)). Det måste vara ett
  booleskt värde.
- `cache_inference_in_dirs` (katalogjokertecken) i `options` lägger till
  kataloger vars moduler behåller sina inferensresultat i byggcachen
  ([inferenscache](#inference-cache)).
- Fälten i `options` är valfria typade frontend-alternativ. `defines` använder
  `NAME` (= `true`) eller `NAME=ERLANG_LITERAL_TERM`; dubbletter är fel. En
  funktion kan inte förekomma i båda funktionslistorna.
- `entry` (valfritt) väljer den körbara filens ingång `MODULE[:FUNCTION]`; se
  [körbara filer](executables.md#entry-selection). CLI-flaggan `--entry`
  åsidosätter den för ett enda valt mål.
- `build_dir` (valfritt) är målets [byggkatalog](#build-directory), som
  standard `<manifest-dir>/build`.
- `output` är den körbara filens destination, som standard
  `<manifest-dir>/build/<target>` (`.exe` på Windows). Ett mål med `output` eller
  `entry` är ett körbart mål ([körbara filer](#executables)); `--emit` och
  kontroll-/utskriftslägen ignorerar båda nycklarnas utdata.
- Stöds ännu inte: standardvärden på rotnivå, arv, beroenden mellan mål,
  importer, profiler, paket, bevakning, parallella byggen. Fält läggs till
  endast tillsammans med sitt beteende. Byggcacher beskrivs under
  [byggcacher](#build-caches).

## CLI och val av mål

```text
clau [options] <source.erl>...
clau [options] --project <path> [--target <name>]...
clau --new-project <filename>
```

- Positionella källfiler och `--project` utesluter varandra. En `--project`,
  valfritt antal `--target`, i valfri ordning.
- Ingen `--target`: alla mål i manifestets ordning. Väljare behåller sin ordning
  och första förekomst. Okända namn misslyckas före allt frontend-arbete och
  listar de tillgängliga namnen.
- `--project test1` läser `test1.toml` när `test1` inte finns.
- CLI:ns frontend-alternativ gäller varje valt mål. CLI-relativa sökvägar
  behåller sin betydelse relativt anropskatalogen; manifestsökvägar är relativa
  till manifestet.
- Utan `--emit` eller en kontroll-/utskriftsåtgärd länkas körbara mål till sina
  utdata ([körbara filer](#executables)); andra mål kompileras i minnet.
- `-o/--output` länkar målet till den sökvägen i stället för dess `output`
  ([länkning](executables.md#linking)); det kräver exakt ett valt mål.
- `--verbose` spårar `[pp]`-filer/inkluderingar och `[parse]`-källor på stderr.
- `--print-inputs` kör varje valt mål fram till kompileringen: den
  förbehandlar och parsar källfilerna efter [sökningen](#paths-and-discovery)
  och lägger sedan till de moduler de namnger från biblioteket och
  `source_search_paths`, så som ett bygge gör. Den skriver ut målets källfiler
  (absoluta sökvägar), en per rad, och sedan varje tillagd källfil som
  `<path> (referenced at <file>:<line>)`, det tidigaste stället i den
  refererande modulen som namnger den; tillagda källfiler genomsöks i tur och
  ordning. Ingenting kompileras. Med flera mål följer varje lista efter en rad
  `[target <name>]`. Positionella indata skrivs ut som de gavs. Diagnostik går
  till stderr; ett parsningsfel stoppar tillägget av refererade moduler och
  avslutar med 1. Den ersätter andra kontroll-/utskriftsåtgärder och står som
  de i konflikt med `-o`, `--entry` och kompileringsflaggor.
- `--print-env` skriver ut hela anropet som TOML: en `[[targets]]`-tabell per
  valt mål med dess lösta källfiler, sök-/inkluderingskataloger och effektiva
  alternativ ([miljörapport](compile.md#environment-report)).
- Slutstatus 2: användningsfel och okända mål. Slutstatus 1: fel i manifest,
  sökning, frontend eller skapande. Slutstatus 0: lyckat (varningar tillåtna).

Varje valt mål är en separat kompileringsbatch med egna
preprocessorsessioner. Planeringen (avkoda, välja, söka, kontrollera
utdatakollisioner) avslutas innan någon källfil körs; körningen bearbetar sedan
mål/filer i ordning och låser fast fel. Nyttolastutdata går till stdout i
mål-/filordning utan rubriker (utom målraderna från `--print-inputs`); kontext
och diagnostik går till stderr. Ett mål med diagnostik namnges en gång, på en
rad `<manifest> [target <name>]:` före den första; själva diagnostiken
(`error: file:line:col: message`) har inget verktygs- eller målprefix.

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target tests --target app
```

## Körbara filer

`clau --project FILE [--target T]...` (ingen `--emit`, ingen
kontroll-/utskriftsåtgärd) länkar varje valt mål som har en `output`- eller
`entry`-nyckel, eller som CLI-flaggorna `-o`/`--entry` avser, till en körbar fil
per mål:

- Destination: CLI-flaggan `-o` (relativ till anropet), annars `output`
  (relativ till manifestet), annars `<manifest-dir>/build/<target>`. Windows-mål
  lägger till `.exe` till ett namn utan filändelse. Saknade kataloger för
  manifestutdata skapas; en explicit `-o`-katalog måste finnas.
- Ingång: CLI-flaggan `--entry`, manifestets `entry`, annars detektering
  ([val av ingång](executables.md#entry-selection)).
- Mål utan `output`, `entry`, `-o` och `--entry` är bibliotek: de kompileras i
  minnet och skriver ingenting, även om en modul exporterar `main/1`.
- Planeringen avvisar valda mål med samma destination; utdata som sammanfaller
  först efter att `.exe` lagts till avvisas före publicering. En utdatafil får
  inte vara ett alias för en vald källfil eller manifestet.
- Varje mål kompileras och länkas i en egen mellanlagringskatalog. Utdata
  ersätts först när alla valda mål har lyckats, i målordning; varje fel lämnar
  alla befintliga utdata oförändrade. Ett fel vid ersättning av en senare
  utdatafil kan lämna tidigare redan ersatta.
- `--linker` och `--runtime-library` gäller varje länkat mål
  ([länkning](executables.md#linking)).

```sh
./build/debug/bin/clau --project tests/fixtures/linking/project/project.toml
```

## Skapa ett projekt

`--new-project <filename>` skriver ett annoterat manifest och ingenting annat.

- Lägger till `.toml` om namnet inte redan slutar på `.toml` (ASCII,
  skiftlägesokänsligt): `demo` → `demo.toml`, `demo.config` → `demo.config.toml`.
- Avvisar tomma eller katalogliknande namn, upprepning och varje kombination med
  källfiler, `--project`, `--target`, `-o`, kontroll-/utskriftslägen eller
  frontend-alternativ.
- Den överordnade katalogen måste finnas. Skriver aldrig över (exklusivt
  skapande); städar bort sin egen ofullständiga fil vid skrivfel. Skriver ut den
  skapade sökvägen vid lyckat utfall.
- Innehållet är deterministiskt UTF-8/LF med kommentarer: ett mål `app`,
  `sources = []`, `source_dirs = ["src"]`, tomma alternativlistor och
  plattformens standardutdata. Det avkodas omedelbart; användaren lägger till
  källfiler under `src`.

## Byggkatalog

Varje projektmål har en byggkatalog där Clause håller sina egna temporära filer
(och, från plan 11 step 62D2, sina cacher): målets `build_dir`, relativ till
manifestet, som standard `<manifest-dir>/build`. `--build-dir DIR` (relativ
till anropet) ersätter den för varje valt mål. Positionella indata får ingen
om inte `--build-dir` anges.

- Temporära filer hamnar under `<build_dir>/tmp`: i dag arbetsytorna för
  laddaren av parse transforms ([transformer](transforms.md#loader)). Varje
  körning tar bort sina egna; en tom `tmp` kan bli kvar. Utan byggkatalog
  hamnar de i systemets temporära katalog.
- Mellanlagring för länkning (`.clause-link-*`) ligger kvar bredvid den körbara
  utdatafilen, eftersom det slutliga namnbytet måste ske på utdatafilens volym
  ([länkning](executables.md#linking)).
- Kontroll- och utskriftslägen (`--parse-check`, `--print-ast`, ...) skriver
  ingenting utanför byggkatalogen; positionella kontroller utan `--build-dir`
  skriver ingen fil alls.
- `--print-env` skriver ut varje måls `build_dir` (`""` när det inte finns
  någon).

### Byggcacher

Resultat som är värda att behålla mellan körningar ligger under
`<build_dir>/cache` (62D4 och 62D5); `--no-cache` varken läser eller skriver
dem. De är svaren från laddaren av parse transforms och värd-OTP:ns lista över
klistriga (sticky) moduler, så att ett varmt bygge inte startar någon `erl` på
värden för moduler vars transformindata inte har ändrats, samt varje batchs
[kompileringsutfall](compile.md#compile-cache).

- **Gränssnitt.** Anropare använder ett projektinternt lager (`compiler/src/cache/
  store.hpp`): `get`/`put` via indatakatalog, filnamn, resultatsort och nyckel,
  plus `invalidate` och `prune`; de ser aldrig sökvägar. Ett värde är
  anroparens formatversion och en lista av namngivna delar (en
  transformkörning: `reply` och `output`; ett kompileringsutfall: `failed`,
  varje `diagnostic`, och med utdata `triple`, `extension` och en del per
  modulobjekt), så ingen anropare behöver en egen kodek. En `get` med en annan
  formatversion är en miss. Varje operation är säker från flera trådar
  samtidigt.
- **Layout (SQLite-backend).** `cache/v2/cache.db` är en SQLite 3.54-databas:
  tabellen `entries` (indatakatalog, fil, sort, nyckel, format, senaste
  användning; unik på adressen) och tabellen `parts` (post, ordning, namn,
  storlek, xxh3-64-kontrollsumma, och antingen byten eller namnet på en
  blob-fil). Delar större än 256 KB ligger i
  `cache/v2/blobs/<xxh3-128 of the bytes>`, så lika delar (de identiska
  objekten i en batch som byggts med två alternativuppsättningar) lagras en
  gång. En blob-fil skrivs som en temporär fil och byter namn innan raden som
  namnger den bekräftas, så en rad namnger aldrig en ofullständig fil; en krasch
  däremellan lämnar endast en föräldralös fil.
- **Nycklar.** En nyckel är 128-bitars innehållshashen av allt som resultatet
  beror på, aldrig en tidsstämpel: versionen av `clau` och den körbara filen
  (sökväg, storlek, ändringstid, så att en ombyggd `clau` ger miss),
  resultatsorten, och för en transformkörning den begäran som skickas till
  `erl` (modulens förbehandlade former och dess kompileringsalternativ:
  inkluderingskataloger, defines, features), värd-OTP:ns utgåva (`erl` och
  filerna `releases/*/OTP_VERSION` bredvid den), varje transformkällfil i
  projektet som kompileras för körningen med de filer den inkluderar, och
  varje `.beam` på transformernas kodsökvägar. Lagrets formatversion är
  katalogen `v<format>`; ett värdes egen formatversion hålls i dess rad.
  Eftersom nyckeln täcker de förbehandlade formerna ger en ändrad header,
  define eller feature, eller en ny header som skuggar en inkluderad, miss för
  exakt de moduler vars former eller alternativ ändras; defines och features är
  kompileringsalternativ som varje transform ser, så de ger miss för varje
  transformerad modul; en ändrad `.beam` ger miss för varje modul vars
  transformer körs med den kodsökvägen.
- **Samtidighet.** Databasen körs i läget write-ahead-log med
  `synchronous=NORMAL`: läsare körs bredvid en skrivare, och skrivare (en
  transaktion per `put`) väntar på varandra i upp till 30 s. Flera
  `clau`-processer som delar en byggkatalog behåller varje post. Inom en
  process serialiserar en mutex de trådar som delar ett lager.
- **Skador.** Delar bär storlekar och kontrollsummor, och blob-filer
  kontrolleras mot sina namn: en skadad del eller en saknad blob-fil är en miss
  (`damaged entry`) och dess post tas bort. En `cache.db` som är skräp,
  avkortad eller främmande (SQLite rapporterar den som korrupt eller inte en
  databas, eller dess applikations-id eller schemaversion skiljer sig) byter
  namn till `cache.db.damaged` och skapas på nytt; när det är omöjligt
  fortsätter körningen utan cache. Inget av detta är ett fel, och `--verbose`
  noterar det som `[cache] ...`.
- **Nätverksfilsystem.** Write-ahead-loggning kräver delat minne mellan
  processer, vilket nätverksfilsystem inte tillhandahåller. När SQLite inte kan
  gå in i WAL-läge använder lagret sin återställningsjournal (läsare väntar då
  på en skrivare) och `--verbose` säger det en gång; när inget journalläge
  fungerar fortsätter körningen utan cache.
- **Rensning.** I slutet av en körning som skrev till ett lager tas poster som
  inte använts på 30 dagar bort, sedan blob-filer som ingen post namnger (när de
  är äldre än 10 minuter, så att en samtidig skrivares nya fil överlever), och
  de frigjorda sidorna lämnas tillbaka till filsystemet (inkrementell vacuum).
  Varje körning tar bort ett kvarlämnat `cache/v1`-träd från filbackenden i
  step 62D2.
- **Observerbarhet.** `--print-stage-times` markerar återanvända steg
  (`[time] transform src/a.erl: 7.254 ms (cached)`); `--verbose` skriver ut
  `[cache] hit|miss <kind> <file>` med orsaken till en miss (`no entry`,
  `inputs changed`, `damaged entry`). Diagnostik och transformutdata är
  desamma med och utan träff: de lagras med posten.
- **Mätningar av backends** (2026-10-12, Release, Windows 11,
  NTFS; `cache_store bench` i `tests/compiler/cache`). Filbackenden från 62D2
  (ett index som skrivs om per put, paket som endast utökas) mot SQLite:

  | Fall | Filbackend | SQLite |
  | --- | --- | --- |
  | 200 put × 8 KB, sedan öppning och 200 get | 788–902 ms, 9–16 ms | 37–41 ms, 8–9 ms |
  | 2 000 put × 8 KB, sedan öppning och get | 11,1–12,5 s (1–3 poster förlorade), 118–128 ms | 249–258 ms, 32–33 ms |
  | 3 put × 24 MB, sedan öppning och get | 106–127 ms, 144–157 ms | 85–90 ms, 73 ms (blob-filer) |

  Lagrade inuti databasen tog värdena på 24 MB 379–392 ms att lägga in (loggen
  skriver dem två gånger). Tjugo olika värden per storlek, inlagda och sedan
  tillbakalästa: 64 KB i databasen 21 ms / 7 ms mot 30 ms / 12–17 ms som
  blob-filer; 256 KB 41–43 ms / 9 ms mot 30–31 ms / 10–19 ms; 1 MB
  105–110 ms / 18 ms mot 37 ms / 18–22 ms; 4 MB 458–466 ms / 82 ms mot 92 ms /
  71 ms. Läsningar gynnar databasen upp till cirka 256 KB och skrivningar
  gynnar filer därifrån, vilket sätter inline-gränsen till 256 KB. Byggen av
  luerl (Release, tre körningar) ändrades inte: kalla 3,75–3,78 s före och
  3,78–3,80 s efter, varma 1,65–1,68 s före och 1,69–1,70 s efter; de håller få
  poster.
- **Ingen cache för katalogsökning** (2026-10-11, Release `clau`, Windows,
  operativsystemets filcache varm). luerl planeras på 78 ms av ett varmt bygge
  på 2,77 s (2,8 %). Ett manifest över hela `references/otp/lib` (1 319
  kataloger, 9 711 filer) planeras på cirka 150 ms:
  `sources = ["…/lib/**/src/*.erl"]` 74 ms, `source_dirs = ["…/lib"]` 140 ms,
  `source_search_paths` och `include_dirs` med `**` 35 ms vardera,
  `ignore_dirs` 0,4 ms. Att lista varje katalog i trädet kostar cirka 28 ms,
  medan att kontrollera varje katalogs ändringstid (vad en sökcache skulle göra
  i stället) kostar cirka 13 ms; resten är valideringen per källfil (öppning och
  identifiering av var och en av 2 000-3 600 källfiler), som en sådan cache
  inte kan hoppa över. Den första körningen efter att trädet lämnat
  operativsystemets cache tog 10-20 s, också dominerad av öppning av filer.
  Sondering efter inkluderingar kostar ingenting mätbart sedan
  [katalogindexet](#directory-index).
- **Inferensresultat** för moduler i konfigurerade kataloger
  ([inferenscache](#inference-cache)).
- **Cachas inte:** förbehandling och parsning. Ett cachat resultat skulle
  laddas via de abstrakta formerna (`transforms/import`), och för luerl (169
  moduler, Release, 2026-10-11) tog enbart importen av dem 1 063 ms mot
  819 ms för att förbehandla (409 ms) och parsa (410 ms) källfilerna; att
  exportera formerna för en nyckel tog ytterligare 727 ms.

### Inferenscache

Biblioteksmoduler (källfiler från OTP:s `stdlib`, `kernel`, `compiler` och
`syntax_tools` som hittas via `source_search_paths`, Clauses eget
[bibliotek](library.md)) ändras sällan, så moduler i konfigurerade kataloger
behåller sina typinferensresultat i byggcachen, per modul, och senare
kompileringar återanvänder dem i stället för att härleda dem igen.

- Kataloger: de implicita OTP-applikationsmönstren `*/stdlib`,
  `*/stdlib-*`, `*/kernel`, `*/kernel-*`, `*/compiler`, `*/compiler-*`,
  `*/syntax_tools` och `*/syntax_tools-*`, sedan målets
  `cache_inference_in_dirs`, sedan varje `--cache-inference-in-dirs PATTERN`
  (kan upprepas; även för positionella indata). Mönster använder samma
  [jokertecken](#paths-and-discovery) som `sources`; Windows-avgränsare
  godtas.
- En modul täcks när en katalog som innehåller dess källfil matchar ett
  mönster. Ett relativt mönster matchar de avslutande katalogerna i vilken
  sökväg som helst, inte sökvägar under manifestets katalog: `*/stdlib` täcker
  `/usr/lib/erlang/lib/stdlib/src/lists.erl` och
  `references/otp/lib/stdlib/src/lists.erl`, medan en installerad
  `.../lib/stdlib-7.0/src/lists.erl` behöver `*/stdlib-*`. Ett absolut mönster
  matchar hela katalogsökvägen (`C:/Program Files/Erlang OTP/lib/*`).
  Matchningen är lexikal och skiftlägeskänslig. De implicita mönstren täcker
  också ett projekts egen katalog med ett sådant namn (`apps/compiler`), vilket
  bara lagrar fler poster: återanvändning är korrekt för varje modul.
- `--print-env` skriver ut den effektiva listan som
  `cache_inference_in_dirs`, implicita mönster först. En konstruktion som inte
  stöds (`[`, `{`, `!`) är ett manifestfel, eller ett användningsfel
  (slutstatus 2) på kommandoraden.
- Återanvändning kräver en byggkatalog (varje projektmål; positionella indata
  med `--build-dir`) och är avstängd med `--no-cache`. Den fungerar för varje
  åtgärd som analyserar (kompilering, körbara filer, `--print-types`,
  IR-inspektioner), även när batchens
  [kompileringscache](compile.md#compile-cache) ger miss.
- Nyckel: identiteten för `clau`, modulens fingeravtryck och fingeravtrycken
  för varje batchmodul som dess atomer namnger, transitivt (fjärranrop,
  `fun M:F/A`, `apply`, varje atom som är ett modulnamn); se
  [semantik: inferenscache](semantic.md#inference-cache) för varför det är allt
  dess fakta beror på. Att redigera en användarmodul behåller därför
  biblioteksträffarna om inte en biblioteksmodul namnger den; att redigera en
  biblioteksmodul ger miss för den och för varje täckt modul som når den.
- Poster hålls per källkatalog, fil och projektmål (sort
  `inference@<target>`, `inference@positional`); ett värde är en del
  `results` (`semantic/types/inference_store`: grafnoder, sammanfattningar och
  lokala indata per funktion, uttrycksfakta per syntaxposition). Resultat som
  behållits av en kompilering med fler levande funktioner (till exempel
  `--print-types`) betjänar en körbar fil som behåller färre.
- `--verbose` skriver ut `[cache] hit|miss inference <file>` per täckt modul
  (orsaker till miss: `no entry`, `inputs changed`, `damaged entry`,
  `results do not fit` för behållna resultat som saknar en funktion som är
  levande nu); `--print-stage-times` skriver ut faserna `inference-cache` (med
  `N of M covered modules reused`) och `inference-store`.

## Sökvägar och sökning

- Projektsökvägen löses mot anropskatalogen; manifestets lexikala överordnade
  katalog är basen för alla manifestsökvägar (även via en symbolisk länk).
  Absoluta sökvägar förblir absoluta; `..` tillåts. Ingen expansion av skal,
  miljö eller tilde. Använd `/` eller TOML-literalsträngar för Windows-sökvägar.
- Literala relativa källfiler provas först mot basen, sedan mot
  `source_search_paths` i ordning. En befintlig men oläsbar kandidat är ett fel.
  Söksökvägar räknar inte upp moduler och påverkar inte inkluderingar.
- När målets källfiler namnger en modul som ingen av dem definierar (ett
  fjärranrop, `fun M:F/A`, `apply` med en literal modul, `-behaviour` eller
  `-import`), söks först Clauses [bibliotek](library.md#how-programs-get-them)
  och sedan söksökvägarna i ordning efter `Module.erl` (plan step 41K: en
  installerad OTP ersätter aldrig en Clause-modul, och en modul som Clause
  registrerar som saknad tas aldrig från en söksökväg); en hittad fil ansluter
  till målet som en listad källfil, och dess egna referenser löses på samma
  sätt. En listad källfil med samma namn som en Clause-modul ersätter den, med
  en varning.
- Jokertecken: `*` och `?` inom en komponent, `**` som en hel komponent.
  Hakparenteser, klammerparenteser, negation och escape-tecken avvisas.
  Matchning är skiftlägeskänslig; `?` är en Unicode-skalär i ett giltigt
  UTF-8-namn.
- Dolda poster inkluderas; upptäckta symboliska länkar till kataloger hoppas
  över (explicita rötter får vara symboliska länkar); symboliska länkar till
  filer följs.
- Ordning: `sources`-poster i ordning, där varje mönsters träffar sorteras efter
  sökvägens UTF-8-byte, sedan varje expansion av `source_dirs` sorterad på samma
  sätt. Saknade literaler, mönster utan träffar och tomma mål är fel.
- Dubbletter inom ett mål tas bort efter filsystemsidentitet (symboliska länkar,
  hårda länkar, skiftlägesalias), och den första stavningen behålls. Samma fil i
  två mål kompileras två gånger eftersom alternativen kan skilja sig.
- Endast valda mål rör filsystemet.

### Katalogindex

Uppslagningar efter namn sonderar inte varje kandidatkatalog. Ett index per
anrop av `clau`, delat av alla mål, håller postnamnen för varje genomsökt
katalog: listade en gång, icke-rekursivt, när en uppslagning först behöver
dem, eller registrerade av de rekursiva genomgångar som expanderar `**` i
`sources`, `source_dirs`, `source_search_paths`, `include_dirs` och
`transform_paths`, så att ingen katalog listas två gånger. Det besvarar
missarna i modulsökningen (biblioteket, sedan `source_search_paths`),
transformkällfiler, literala `sources` som hittas via `source_search_paths`,
och lösning av inkluderingar (den inkluderande filens katalog, arbetskatalogen,
inkluderingskataloger i ordning, sedan `include_lib`-applikationer); en
kandidat som indexet innehåller öppnas eller kontrolleras fortfarande som
tidigare, så företräde, `ignore_dirs` och felrapporter ändras inte.
Inkluderingsnamn med katalogdelar (`sub/x.hrl`) slås upp i den katalog de
namnger; namn med `..`-steg, absoluta namn, relativa kataloger och listningar
som misslyckas sonderas som tidigare.

- Nycklar för filnamn viks i ASCII-skiftläge på Windows och macOS, vars volymer
  som standard ignorerar skiftläge, så `Foo.hrl` hittar fortfarande `foo.hrl`;
  på andra system är nycklarna exakta. Namn som vikning inte kan matcha exakt
  (icke-ASCII-namn där, och på Windows namn som slutar på `.` eller ett
  mellanslag eller innehåller `~`, vilka kan vara korta 8.3-namn) sonderas.
- Indexet är en ögonblicksbild av ett anrop: filer som dyker upp medan `clau`
  körs (mellanlagring för länkning, utdata) är aldrig sökindata.
- `--verbose` avslutas med `[index] listed=N walked=N lookups=N misses=N probes=N`
  (kataloger listade vid behov, listningar registrerade av genomgångar,
  uppslagningar som indexet besvarade och missarna bland dem, uppslagningar som
  lämnades till en sondering). För luerl (2026-10-11) besvarar det alla 15 215
  uppslagningar (14 909 missar) från 66 listningar och 1 380 genomgångna
  kataloger.

## Ignorerade källfiler

`ignore_dirs` och `ignore_modules` håller källfiler utanför ett mål utan att
ta bort dem från trädet, t.ex. medföljande tester, äldre kod eller moduler som
endast spelar roll under OTP. En ignorerad källfil hoppas över tyst: den läses,
parsas, kompileras eller länkas aldrig, så den kan till och med innehålla
syntaxfel.

- `ignore_dirs`: sökvägar relativa till manifestet (eller absoluta) med samma
  [jokertecken](#paths-and-discovery) som `sources`. En källfil ignoreras när
  dess sökväg, eller en katalog som innehåller den, matchar: `src/legacy`,
  `deps/*/test`, `**/test` (varje `test`-katalog), `src/*_SUITE.erl`.
  Matchningen är lexikal; ett mönster behöver inte matcha något.
- `ignore_modules`: modulnamn, eller namnmönster med `*` och `?` som matchas
  mot hela namnet (`*_SUITE`, `legacy_*`, `prim_???`). En källfil med namnet
  `<Module>.erl` (eller `.abstr`) ignoreras när en post matchar `<Module>`, och
  en refererad modul som matchar söks aldrig efter.
  Detta inkluderar Clauses [biblioteksmoduler](library.md#which-module-a-name-resolves-to).
- En källfil som `sources` listar literalt (utan jokertecken) ignoreras aldrig:
  reglerna har ingen verkan på den, och bygget varnar `listed in sources but
  matched by ignore_modules or ignore_dirs; ignoring it has no effect`
  (user direction 2026-10-12). Jokerteckenträffar och
  `source_dirs` ignoreras enligt beskrivningen.
- Båda gäller för `sources`, `source_dirs`, literala källfiler som hittas via
  `source_search_paths`, [modulsökningen](#paths-and-discovery) i
  `source_search_paths` och biblioteket, och sökningen efter
  [källfiler för parse transforms](transforms.md#transform-modules). En sökning
  går förbi en ignorerad `Module.erl` och fortsätter leta i senare kataloger.
- En modul ignoreras när `ignore_modules` namnger den, eller när ingen
  källfil i batchen definierar den och dess enda hittade källfiler ignorerades
  (av sökningen, eller överhoppade bland målets källfiler, efter filnamn). En
  modul som definieras av en kompilerad källfil ignoreras aldrig.
- Referenser till en ignorerad modul (`M:F(...)`, `-import`, `fun M:F/A`,
  `apply(M, F, [...])` med literala namn) når en genererad platshållarmodul
  `M` som exporterar varje funktion som namnges på detta sätt; var och en
  returnerar `{module_ignored, M}` i stället för att köras. En funktion som
  batchen aldrig namnger literalt förblir `undef` för dynamiska anrop. En typ i
  en ignorerad modul som namnges i en spec eller typ (`helper:result()`) ger
  varningen `attempt to import a type from a module ignored in project
  settings: helper:result` och behandlas som `term()`. `-behaviour(M)` med en
  ignorerad `M` ger varningen `behaviour M undefined`.
- `--print-inputs` listar varje ignorerad refererad modul efter de tillagda
  källfilerna som `ignored module <name> (referenced at <file>:<line>)`;
  `--print-env` skriver ut båda nycklarna.

```toml
[targets.options]
source_search_paths = ["deps/**"]
ignore_dirs = ["deps/*/test", "src/legacy"]
ignore_modules = ["telemetry", "*_SUITE"]
```

## Effektiva alternativ

| Inställning | Kombination av manifest och CLI |
| --- | --- |
| `include_dirs` | Manifestets ordning, efter CLI-flaggan `-I` (sista CLI-`-I` söks först); en post med jokertecken (`deps/*/include`, `apps/**/include`) expanderas på plats till de befintliga kataloger den matchar, sorterade efter sökvägens UTF-8-byte (`**` matchar också ingen, symboliska länkar till kataloger hoppas över); ett mönster utan träffar är ett fel |
| `source_search_paths` | Reservrötter för literala källfiler och de moduler som målet namnger men inte listar; mönster expanderas som för `include_dirs` (utan träff: `unmatched source search path pattern`) |
| `defines` | Manifestet först, sedan CLI; dubbletter mellan dem är fel |
| `applications` | Manifestets map; CLI-poster ersätter matchande namn |
| Funktionslistor | Manifestets inställningar, sedan ordnade CLI-ändringar; CLI vinner |
| `output` | Per mål, endast körbara mål; CLI-flaggan `-o` åsidosätter för ett enda valt mål |
| `entry` | Per mål; CLI-flaggan `--entry` åsidosätter för ett enda valt mål |
| `cache_inference_in_dirs` | Implicita OTP-mönster, sedan manifestets, sedan CLI-flaggan `--cache-inference-in-dirs` ([inferenscache](#inference-cache)) |

## Byggberoende

Kompilatorprivat toml++ 3.4.0 (MIT), endast headerfiler, med undantag, ej
släppt syntax avstängd. Arkivets SHA-256
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS: `brew install tomlplusplus` (formel 3.4.0) upptäcks.
- Windows: CMake laddar ned och verifierar utgåvan till `thirdparty/`.
- Övriga: installera den, packa upp till `thirdparty/tomlplusplus-3.4.0`, eller
  skicka `-DCLAUSE_TOML_ROOT=<path>` (har företräde, stänger av nedladdning).
- Byggen med endast runtime letar inte efter den.

[Byggcachen](#build-caches) använder SQLite 3.54.0-amalgamationen (public
domain), kompilerad enbart in i kompilatorns cachebibliotek (`clause_sqlite`,
utan projektets varningsflaggor). CMake laddar ned
`https://www.sqlite.org/2026/sqlite-amalgamation-3540000.zip` till
`thirdparty/` på varje värd och verifierar dess SHA-256
`68e913b0fe8ec6b4e5f391c594a28872884e80d6cd042a1e50c957be46b5aa4d`;
`-DCLAUSE_SQLITE_ROOT=<directory with sqlite3.c and sqlite3.h>` har företräde
och stänger av nedladdningen.

## Gränser

Manifestets storlek 1 MiB; högst 1 024 mål och 100 000 TOML-noder. Varje
källexpansion tillåter 100 000 besökta poster, 128 katalognivåer och 16 000 000
jokerteckenövergångar. Uttömning är ett explicit fel; detta är arbetsgränser,
inte tidsfrister för I/O.
