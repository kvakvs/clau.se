---
source: docs/projects.md
sourceCommit: 06042fa
sourceSha256: fede4b3ed0440e1032fd9d7e0bad11ee107bc68c2c08dfa3b1add7b9fbc880c1
translatedAt: 2026-10-09
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

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]

[targets.options.applications]
my_dependency = "vendor/my_dependency"
```

- `schema_version = 1` och en icke-tom `targets`-array krävs. Okända nycklar,
  fel typer, dubblerade målnamn och tomma strängar avvisas; ingen
  typkonvertering. Hela manifestet valideras, inklusive mål som inte valts.
- Målnamn: skiftlägeskänslig ASCII `[A-Za-z0-9_][A-Za-z0-9_.-]*`, unika. Ett
  namn är ett byggmål, inte en LLVM-tripel.
- `sources` (filer och jokerteckenmönster) och `source_dirs` (rekursiv sökning
  efter `.erl`) är valfria, men ett mål behöver minst en post. Explicita filer
  måste sluta på `.erl`; headerfiler är beroenden, inte indata.
- Fälten i `options` är valfria typade frontend-alternativ. `defines` använder
  `NAME` (= `true`) eller `NAME=ERLANG_LITERAL_TERM`; dubbletter är fel. En
  funktion kan inte förekomma i båda funktionslistorna.
- `entry` (valfritt) väljer den körbara filens ingång `MODULE[:FUNCTION]`; se
  [körbara filer](executables.md#entry-selection). CLI-flaggan `--entry`
  åsidosätter den för ett enda valt mål.
- `output` är den körbara filens destination, som standard
  `<manifest-dir>/build/<target>` (`.exe` på Windows). Ett mål med `output` eller
  `entry` är ett körbart mål ([körbara filer](#executables)); `--emit` och
  kontroll-/utskriftslägen ignorerar båda nycklarnas utdata.
- Stöds ännu inte: standardvärden på rotnivå, arv, beroenden mellan mål,
  importer, profiler, undantag, paket, bevakning, cachning, parallella byggen.
  Fält läggs till endast tillsammans med sitt beteende.

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
- Slutstatus 2: användningsfel och okända mål. Slutstatus 1: fel i manifest,
  sökning, frontend eller skapande. Slutstatus 0: lyckat (varningar tillåtna).

Varje valt mål är en separat kompileringsbatch med egna
preprocessorsessioner. Planeringen (avkoda, välja, söka, kontrollera
utdatakollisioner) avslutas innan någon källfil körs; körningen bearbetar sedan
mål/filer i ordning och låser fast fel. Nyttolastutdata går till stdout i
mål-/filordning utan rubriker; kontext och diagnostik går till stderr.

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

## Sökvägar och sökning

- Projektsökvägen löses mot anropskatalogen; manifestets lexikala överordnade
  katalog är basen för alla manifestsökvägar (även via en symbolisk länk).
  Absoluta sökvägar förblir absoluta; `..` tillåts. Ingen expansion av skal,
  miljö eller tilde. Använd `/` eller TOML-literalsträngar för Windows-sökvägar.
- Literala relativa källfiler provas först mot basen, sedan mot
  `source_search_paths` i ordning. En befintlig men oläsbar kandidat är ett fel.
  Söksökvägar lokaliserar endast listade filer; de räknar inte upp moduler och
  påverkar inte inkluderingar.
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

## Effektiva alternativ

| Inställning | Kombination av manifest och CLI |
| --- | --- |
| `include_dirs` | Manifestets ordning, efter CLI-flaggan `-I` (sista CLI-`-I` söks först) |
| `source_search_paths` | Endast uppslag av projektets källfiler |
| `defines` | Manifestet först, sedan CLI; dubbletter mellan dem är fel |
| `applications` | Manifestets map; CLI-poster ersätter matchande namn |
| Funktionslistor | Manifestets inställningar, sedan ordnade CLI-ändringar; CLI vinner |
| `output` | Per mål, endast körbara mål; CLI-flaggan `-o` åsidosätter för ett enda valt mål |
| `entry` | Per mål; CLI-flaggan `--entry` åsidosätter för ett enda valt mål |

## Byggberoende

Kompilatorprivat toml++ 3.4.0 (MIT), endast headerfiler, med undantag, ej
släppt syntax avstängd. Arkivets SHA-256
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS: `brew install tomlplusplus` (formel 3.4.0) upptäcks.
- Windows: CMake laddar ned och verifierar utgåvan till `thirdparty/`.
- Övriga: installera den, packa upp till `thirdparty/tomlplusplus-3.4.0`, eller
  skicka `-DCLAUSE_TOML_ROOT=<path>` (har företräde, stänger av nedladdning).
- Byggen med endast runtime letar inte efter den.

## Gränser

Manifestets storlek 1 MiB; högst 1 024 mål och 100 000 TOML-noder. Varje
källexpansion tillåter 100 000 besökta poster, 128 katalognivåer och 16 000 000
jokerteckenövergångar. Uttömning är ett explicit fel; detta är arbetsgränser,
inte tidsfrister för I/O.
