---
source: docs/crypto.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 1713219c9c04cba4db60a95d49dd0d38365ce9026ca10d36ed4d0d602b55f99b
translatedAt: 2026-10-26
---
# Crypto: OpenSSL, bygge och FIPS

Clauses `crypto` motsvarar OTP:s `crypto`-modul ovanpå OpenSSL:s libcrypto.
Denna text beskriver vilken OpenSSL som används och hur den hittas, hur Clause
och `clau` bygger den från källkod, hur program länkar den och FIPS-läge. De
inbyggda funktionerna beskrivs i [inbyggda funktioner](builtins.md#crypto-module),
biblioteksmodulen i [bibliotek](library.md) och de observerbara skillnaderna mot
OTP i [skillnader](differences.md#crypto).
Nycklar och signaturer i `public_key` anropar den
([public_key](public_key.md#keys-and-signatures)).

## OpenSSL-versioner

- **Låst version: 4.1.0.** Den utgåva som Clause hämtar och bygger när ingen
  annan OpenSSL anges.
- **Minimum: 3.1.2.** Den senaste utgåvan vars FIPS-provider är validerad
  (FIPS 140-3-certifikat #4985). Alla libcrypto från 3.1.2 och framåt kan länkas
  med crypto-arkivet: de inbyggda funktionerna använder bara API som finns i
  3.1.2 och hanterar versionsskillnader vid körning, så ett arkiv fungerar med
  alla sådana libcrypto. Nyare headerfiler kan ändå mappa ett äldre namn till
  en nyare funktion (4.1:s `EVP_MD_CTX_get_size` är 3.4:s
  `EVP_MD_CTX_get_size_ex`), så arkivet undviker sådana namn; den fullständiga
  testsviten länkar crypto-referenstesterna med ett libcrypto byggt från
  källkoden för 3.1.2.
- **Algoritmer undersöks, inte antas.** Det första `crypto`-anropet laddar
  providrarna (`fips` när den kan laddas, sedan `default`, `base` och `legacy`,
  som OTP gör) och hämtar varje hashfunktion, chiffer och MAC i OTP:s tabeller;
  `crypto:supports/0,1`, `hash_info/1`, `info/0` och `info_lib/0` rapporterar vad
  den länkade OpenSSL har. Ett program länkat med 3.1.2 listar helt enkelt
  färre algoritmer (ingen ML-KEM, ML-DSA eller SLH-DSA).

OpenSSL har Apache-2.0-licens; ingen OpenSSL-fil checkas in.

## Var Clauses OpenSSL kommer från

CMake (`cmake/OpenSSLDependencies.cmake`) hittar libcrypto för crypto-arkivet i
denna ordning:

1. `-DCLAUSE_OPENSSL_ROOT=<path>`: ett installationsprefix
   (`include/openssl/opensslv.h`) eller ett källkodsträd (`Configure`,
   `VERSION.dat`), som byggs enligt punkt 3.
2. En installerad OpenSSL ≥ 3.1.2 (`CLAUSE_OPENSSL_SYSTEM`, ON som standard utom
   på Windows): `find_package(OpenSSL)`, med statiskt libcrypto i första hand.
3. Den låsta utgåvan, hämtad till `thirdparty/openssl-4.1.0` och verifierad
   (`openssl-4.1.0.tar.gz`, SHA-256
   `50c17baf54cb008f6ce42d50deb4b28050a1aad711636cabd4b241c7e90cc2fd`),
   konfigurerad och byggd en gång till
   `thirdparty/openssl-4.1.0-<arch>-<crt>/install` (byggs om när kompilatorn
   eller alternativen ändras); `-DCLAUSE_DOWNLOAD_OPENSSL=OFF` stänger av
   hämtningen.

`-DCLAUSE_RUNTIME_CRYPTO=OFF` utelämnar crypto-arkivet helt. Med tester
aktiverade hämtar konfigurationen också källkoden för 3.1.2
(`openssl-3.1.2.tar.gz`, SHA-256
`a0ce69b8b97ea6a35b96875235aa453b966ba3cba8af2de23657d8b6767d6539`) till
`thirdparty/openssl-3.1.2` för den fullständiga svitens tester;
`-DCLAUSE_TEST_OPENSSL_MINIMUM=OFF` hoppar över den och dessa tester.

## Bygga OpenSSL från källkod

Ett källkodsbygge skapar ett statiskt libcrypto med legacy-providern inbyggd
(som de inbyggda funktionerna laddar på samma sätt som OTP):

```
Configure <target> no-shared no-module no-tests no-docs no-makedepend enable-ec_explicit_curves
          [enable-static-vcruntime] [--debug] --prefix=<install> --openssldir=<install>/ssl --libdir=lib
make build_libs && make install_dev
```

- **Kompilator och runtime.** CMakes C-kompilator bygger den (`CC`);
  `enable-static-vcruntime` väljer `/MT` när bygget använder statisk MSVC
  runtime, `--debug` väljer Debug-varianten.
- **Windows-verktyg.** Configure behöver en native Perl och NASM: låsta
  Strawberry Perl 5.42.3.1 portable (SHA-256
  `6a081a811781c30aca51dbc036afd93092af91e3297901f02c17043795a10690`) och
  NASM 3.02 (SHA-256
  `161d0bfaff53c2f9e9f3e69fd0672323ebabafd1268976a5cec11be92a19aee7`)
  hämtas till `thirdparty/tools/`. `nmake` bygger sedan seriellt (cirka
  4 minuter en gång), så en Visual Studio-utvecklingsmiljö behövs. Linux och
  macOS använder sina `perl` och `make -j` (två tredjedelar av kärnorna).
- **Äldre källkodsträd får bara alternativ de känner till.** enable-X och no-X
  behålls när X finns i någon av trädets `my @disablables... = (...)`-listor i
  `Configure`: 3.1.2 känner varken till `no-docs`, `enable-ec_explicit_curves`
  (explicita kurvor ingår alltid) eller `enable-static-vcruntime` (dess
  statiska byggen använder redan `/MT`).
- **Korskompilering** använder målplattformens installerade OpenSSL genom
  `CLAUSE_OPENSSL_ROOT`.

### Fallgropar längs vägen

- **Gits MSYS Perl förstör Configure.** Den ger Configure Unix-sökvägar som
  `nmake` inte kan använda: Windows-byggen behöver native Strawberry Perl,
  aldrig den `perl` som Git for Windows lägger i `PATH`.
- **Byggen utanför källkodsträdet med `no-apps` misslyckas** (`apps/include`
  saknas), så Clause behåller apparna aktiverade och bygger målet `build_libs`
  i stället för allt.
- **`install_fips` utanför källkodsträdet misslyckas på Windows.** Makefilen
  listar programmet som `"apps\\openssl.exe"`, vilket `nmake` inte matchar
  mot sin egen regel för `apps\openssl.exe`. Bygg `build_sw` och kör
  `openssl fipsinstall` själv i stället.
- **3.x installerar en PDB som clang-cl aldrig skriver.** Windows-versionen
  av `install_dev` för ett statiskt 3.x-bygge kopierar `ossl_static.pdb`, som
  clang-cl:s inbäddade felsökningsinformation (`/Z7`) inte skapar; Clause ger
  den en tom fil (4.0 tog bort kopieringen).
- **`no-module` stänger av FIPS.** Configure stänger av `fips` med
  `no-module`: en FIPS-provider är alltid en separat modul, aldrig en del av
  ett statiskt libcrypto (som ändå kan ladda en).
- **Statiskt libcrypto på Linux behöver komprimeringsbibliotek.** Ubuntus
  statiska `libcrypto.a` kräver `-lz -lzstd` (`libcrypto.pc`:s `Libs.private`);
  biblioteken som en installation behöver registreras tillsammans med den.

## Länka program

De inbyggda funktionerna finns i ett eget arkiv, `clause_runtime_crypto`
bredvid `clause_runtime`, så program som aldrig anropar `crypto` förblir lika
små som tidigare; libcrypto med sina providrar lägger till cirka 4.5 MB för
dem som gör det.

- **När det länkas.** `clau` länkar arkivet när kompileringsomgången har
  kompilerat biblioteksmodulen `crypto` (ett statiskt anrop till `crypto`),
  eller med `--with-crypto` för program som bara når `crypto` genom dynamiska
  anrop (`beam_lib`:s dekryptering av felsökningsinformation är ett exempel).
  Startobjektet listar då arkivets tilläggspost, som drar in arkivet, och
  starten registrerar dess inbyggda funktioner. Program utan `crypto` söker
  aldrig efter någon OpenSSL.
- **Vad som länkas.** `clause_runtime_crypto.link` bredvid arkivet anger
  libcrypto (första raden) och dess systembibliotek;
  `clause_runtime_crypto.openssl` registrerar hur ett källkodsträd byggs
  (version, minimum, målplattform, alternativ, kompilator samt kataloger för
  Perl och NASM).
- **En annan OpenSSL.** `--with-crypto=PATH`, annars miljövariabeln
  `CLAUSE_OPENSSL_ROOT`, länkar en annan OpenSSL ≥ 3.1.2: en installations
  libcrypto eller ett källkodsträd som `clau` konfigurerar och bygger med det
  registrerade receptet till `<build-dir>/cache/openssl/<hash>` vid första
  användningen (i ett Visual Studio-utvecklingsskal på Windows, för `nmake`).

## FIPS

### Omkopplingsbart läge (som OTP)

Det första `crypto`-anropet försöker också ladda OpenSSL:s `fips`-provider,
som OpenSSL hittar genom sina egna `OPENSSL_MODULES` (modulkatalogen) och
`OPENSSL_CONF` (en konfiguration som inkluderar den `fipsmodule.cnf` som
`openssl fipsinstall` skrev och aktiverar providern). Sedan gäller följande:

- `crypto:enable_fips_mode(true)` aktiverar OpenSSL:s standardegenskap
  `fips=yes` (`true` när det gick, `false` utan en laddningsbar provider);
  `crypto:enable_fips_mode(false)` stänger av den.
- `crypto:info_fips/0` svarar `enabled` eller `not_enabled`, och
  `not_supported` när ingen FIPS-provider laddades.
- `crypto:info/0` lägger till `fips_provider_buildinfo` när en FIPS-provider
  har laddats.
- I FIPS-läge utelämnas algoritmer som providern saknar från
  `crypto:supports/1` (även OTP:s publika nycklar och kurvor utanför FIPS:
  `eddsa`, `eddh`, `srp`, Edwards-kurvorna) och ger OTP:s `notsup`-fel:
  `"Bad digest type in
  FIPS"`, `"Digest type not supported in FIPS"`, `"MAC algorithm forbidden in FIPS"`, `"Digest algorithm for HMAC
  forbidden in FIPS"`, `"Cipher algorithm not supported in FIPS"`, `"Forbidden in FIPS"`.
  Varje tabellpost behåller en andra hämtning med `fips=yes`, som används när
  FIPS-läget är på, så FIPS-läget beräknar med providerns egna implementationer.

Operationer med publika nycklar hämtar sina algoritmer genom OpenSSL:s
standardegenskaper, så i FIPS-läge körs de med providerns implementationer;
`eddsa` ger `"Unsupported algorithm in FIPS mode"` och SRP `notsup`, som i OTP.

OTP:s applikationsvariabel `fips_mode` läses inte (Clause har ingen `on_load`
och program har ingen `sys.config`): program anropar
`crypto:enable_fips_mode/1` eller byggs med låst läge.

### Program med låst läge: `clau --fips=PATH`

`--fips=PATH` bygger ett program som alltid körs i FIPS-läge, med en
FIPS-provider som användaren tillhandahåller. `PATH` är antingen en katalog
med providermodulen och dess `fipsmodule.cnf` eller en OpenSSL-installation:

| Fil | Söks i `PATH`, sedan i |
| --- | --- |
| `fips.dll` (Windows), `fips.so` (Linux), `fips.dylib` (macOS) | `lib/ossl-modules`, `lib64/ossl-modules`, `lib/<triplet>/ossl-modules` |
| `fipsmodule.cnf` | `ssl/`, `etc/ssl/` |

- **Bygget misslyckas** när modulen eller inställningsfilen saknas, eller
  inställningarna saknar `module-mac` i en `[fips_sect]`-sektion (kör
  `openssl fipsinstall`).
- **Båda filerna kopieras bredvid den körbara filen**, under namnen ovan;
  distribuera dem med den. Alternativet medför `--with-crypto`; libcrypto
  väljs som vanligt och måste acceptera providern.
- **Innan programmet körs** läser startobjektets FIPS-post
  (`CLAUSE_crypto_fips_extension_v1`) `fipsmodule.cnf` bredvid den körbara
  filen, laddar modulen bredvid den genom en OpenSSL-providerkonfiguration
  (filens inställningar plus `module` och `activate`, som alla libcrypto från
  3.0 accepterar), laddar bara OpenSSL:s `base`-provider utöver den (aldrig
  `default` eller `legacy`; systemets OpenSSL-konfiguration läses inte) och
  aktiverar `fips=yes`.
- **När providern inte laddas** eller misslyckas med sitt självtest (en ändrad
  modul, ett felaktigt `module-mac`) stannar programmet med avslutningsstatus
  70 och `crypto: cannot load the FIPS provider from <directory>: <OpenSSL's error>`
  på stderr. Windows visar ingen "Bad Image"-dialog för en trasig modul:
  felläget är tyst medan den laddas.
- **Läget kan inte lämnas.** `crypto:enable_fips_mode(false)` returnerar
  `false`, och `crypto:info_fips/0` förblir `enabled`.

### Vilken FIPS-provider

Clause bygger aldrig en FIPS-provider för distribution. OpenSSL tillåter att
andra utgåvor använder en validerad FIPS-provider men förbjuder användning av
en egenbyggd från en icke-validerad utgåva: använd providern från en validerad
utgåva (3.1.2 i skrivande stund, byggd enligt dess säkerhetspolicy, eller en
som levereras av en operativsystemsleverantör) och kör dess
`openssl fipsinstall` på målmaskinen där policyn kräver det. Providern från
3.1.2 laddas i det låsta libcrypto 4.1: den fullständiga sviten bygger den
(bara för testet) och kör program med låst och omkopplingsbart läge med den.

## Tester

| Test | Svit | Vad det kontrollerar |
| --- | --- | --- |
| `executables_crypto_digests`, `executables_crypto_ciphers` | fast | Referenstester från OTP 29.1.1: vektorer, tillstånd, fel, undersökta listor, `info_fips` utan provider |
| `linking_crypto` | fast | Arkivet länkas bara när det används; `--with-crypto[=PATH]`, `CLAUSE_OPENSSL_ROOT`, avvisanden |
| `linking_fips` | fast | Avvisade `--fips`, saknade eller felaktiga providrar får bygget att misslyckas, kopiering, startfel |
| `linking_crypto_source` | full | `--with-crypto=SOURCE` bygger 4.1.0-trädet en gång i byggcachen |
| `linking_crypto_minimum` | full | Crypto-referenstesterna länkade med ett libcrypto byggt från källkoden för 3.1.2 skriver ut sina referensresultat |
| `linking_fips_real` | full | FIPS-providern från 3.1.2 (byggd med `enable-fips` för testet) i ett program med låst läge (förblir i FIPS-läge, förbjudna algoritmer, manipulerad modul stoppar det) och ett med omkopplingsbart läge (`OPENSSL_MODULES`/`OPENSSL_CONF`) |
