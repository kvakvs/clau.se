---
source: docs/crypto.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 1713219c9c04cba4db60a95d49dd0d38365ce9026ca10d36ed4d0d602b55f99b
translatedAt: 2026-10-26
---
# Crypto: OpenSSL, Kompilierung und FIPS

Clauses `crypto` bildet das `crypto`-Modul von OTP auf OpenSSLs libcrypto ab.
Dieses Dokument beschreibt, welches OpenSSL verwendet und wie es gefunden wird,
wie Clause und `clau` es aus dem Quellcode kompilieren, wie Programme es linken
und wie der FIPS-Modus funktioniert. Die Builtins sind unter
[Builtins](builtins.md#crypto-module), das Bibliotheksmodul unter
[Bibliothek](library.md) und die beobachtbaren Unterschiede zu OTP unter
[Unterschiede](differences.md#crypto) beschrieben.
Die Schlüssel- und Signaturfunktionen von `public_key` rufen es auf
([public_key](public_key.md#keys-and-signatures)).

## OpenSSL-Versionen

- **Festgelegt: 4.1.0.** Diese Version lädt Clause herunter und kompiliert sie,
  wenn kein anderes OpenSSL angegeben wird.
- **Minimum: 3.1.2.** Die neueste Version, deren FIPS-Provider validiert ist
  (FIPS-140-3-Zertifikat #4985). Jede libcrypto ab 3.1.2 lässt sich mit dem
  Crypto-Archiv linken: Die Builtins verwenden nur die in 3.1.2 vorhandene API
  und behandeln Versionsunterschiede zur Laufzeit, sodass ein Archiv für jede
  solche libcrypto ausreicht. Neuere Header können alte Namen dennoch auf neuere
  Funktionen abbilden (`EVP_MD_CTX_get_size` aus 4.1 ist
  `EVP_MD_CTX_get_size_ex` aus 3.4); deshalb vermeidet das Archiv solche Namen.
  Die vollständige Testsuite linkt die Crypto-Referenztests mit einer aus dem
  Quellcode von 3.1.2 kompilierten libcrypto.
- **Algorithmen werden geprüft, nicht vorausgesetzt.** Der erste `crypto`-Aufruf
  lädt die Provider (`fips`, falls ladbar, dann `default`, `base` und `legacy`,
  wie bei OTP) und ruft jeden Digest, jede Chiffre und jeden MAC aus OTPs Tabellen
  ab. `crypto:supports/0,1`, `hash_info/1`, `info/0` und `info_lib/0` melden,
  was das gelinkte OpenSSL bereitstellt. Ein mit 3.1.2 gelinktes Programm listet
  lediglich weniger Algorithmen auf (kein ML-KEM, ML-DSA oder SLH-DSA).

OpenSSL steht unter der Apache-2.0-Lizenz; keine OpenSSL-Datei ist im Repository
eingecheckt.

## Herkunft von Clauses OpenSSL

CMake (`cmake/OpenSSLDependencies.cmake`) sucht libcrypto für das Crypto-Archiv
in dieser Reihenfolge:

1. `-DCLAUSE_OPENSSL_ROOT=<path>`: ein Installationspräfix
   (`include/openssl/opensslv.h`) oder ein Quellbaum (`Configure`, `VERSION.dat`),
   der wie unter 3 kompiliert wird.
2. Ein installiertes OpenSSL ≥ 3.1.2 (`CLAUSE_OPENSSL_SYSTEM`, standardmäßig ON
   außer unter Windows): `find_package(OpenSSL)`, bevorzugt statische libcrypto.
3. Die festgelegte Version, heruntergeladen nach `thirdparty/openssl-4.1.0` und
   geprüft (`openssl-4.1.0.tar.gz`, SHA-256
   `50c17baf54cb008f6ce42d50deb4b28050a1aad711636cabd4b241c7e90cc2fd`), einmalig
   konfiguriert und nach `thirdparty/openssl-4.1.0-<arch>-<crt>/install`
   kompiliert (erneut kompiliert, wenn sich Compiler oder Optionen ändern);
   `-DCLAUSE_DOWNLOAD_OPENSSL=OFF` deaktiviert den Download.

`-DCLAUSE_RUNTIME_CRYPTO=OFF` lässt das Crypto-Archiv vollständig weg. Bei
aktivierten Tests lädt die Konfiguration außerdem den Quellcode von 3.1.2
(`openssl-3.1.2.tar.gz`, SHA-256
`a0ce69b8b97ea6a35b96875235aa453b966ba3cba8af2de23657d8b6767d6539`) für die
Tests der vollständigen Suite nach `thirdparty/openssl-3.1.2` herunter;
`-DCLAUSE_TEST_OPENSSL_MINIMUM=OFF` überspringt dies und diese Tests.

## OpenSSL aus dem Quellcode kompilieren

Die Kompilierung aus dem Quellcode erzeugt eine statische libcrypto mit
eingebautem Legacy-Provider (den die Builtins wie OTP laden):

```
Configure <target> no-shared no-module no-tests no-docs no-makedepend enable-ec_explicit_curves
          [enable-static-vcruntime] [--debug] --prefix=<install> --openssldir=<install>/ssl --libdir=lib
make build_libs && make install_dev
```

- **Compiler und Laufzeit.** CMakes C-Compiler kompiliert die Bibliothek (`CC`);
  `enable-static-vcruntime` wählt `/MT`, wenn der Build die statische
  MSVC-Laufzeit verwendet, `--debug` deren Debug-Variante.
- **Windows-Werkzeuge.** Configure benötigt natives Perl und NASM: Die
  festgelegten Versionen Strawberry Perl 5.42.3.1 portable (SHA-256
  `6a081a811781c30aca51dbc036afd93092af91e3297901f02c17043795a10690`) und NASM
  3.02 (SHA-256
  `161d0bfaff53c2f9e9f3e69fd0672323ebabafd1268976a5cec11be92a19aee7`) werden
  nach `thirdparty/tools/` heruntergeladen. Anschließend kompiliert `nmake`
  sequenziell (einmalig etwa 4 Minuten); daher ist eine Visual
  Studio-Entwicklungsumgebung erforderlich. Linux und macOS verwenden ihr
  `perl` und `make -j` (zwei Drittel der Kerne).
- **Ältere Quellbäume erhalten nur die ihnen bekannten Optionen.** enable-X und
  no-X bleiben erhalten, wenn X in einer der Listen
  `my @disablables... = (...)` des Quellbaums in `Configure` steht: 3.1.2 kennt
  weder `no-docs` noch `enable-ec_explicit_curves` (explizite Kurven sind immer
  enthalten) noch `enable-static-vcruntime` (seine statischen Builds verwenden
  bereits `/MT`).
- **Cross-Builds** verwenden das installierte OpenSSL der Zielplattform über
  `CLAUSE_OPENSSL_ROOT`.

### Aufgetretene Fallstricke

- **Gits MSYS-Perl lässt Configure scheitern.** Es übergibt Configure Unix-Pfade,
  die `nmake` nicht verwenden kann: Windows-Builds benötigen natives Strawberry
  Perl, niemals das `perl`, das Git for Windows in `PATH` einträgt.
- **Builds außerhalb des Quellbaums mit `no-apps` scheitern**
  (`apps/include` fehlt); deshalb lässt Clause die Anwendungen aktiviert und
  kompiliert das Ziel `build_libs` statt aller Ziele.
- **`install_fips` außerhalb des Quellbaums scheitert unter Windows.** Das
  Makefile führt das Programm als `"apps\\openssl.exe"` auf, was `nmake` nicht
  seiner eigenen Regel `apps\openssl.exe` zuordnet. Stattdessen `build_sw`
  kompilieren und `openssl fipsinstall` selbst ausführen.
- **3.x installiert eine PDB, die clang-cl nie schreibt.** Das Windows-Ziel
  `install_dev` eines statischen 3.x-Builds kopiert `ossl_static.pdb`, die
  clang-cls eingebettete Debug-Informationen (`/Z7`) nicht erzeugen; Clause
  stellt dafür eine leere Datei bereit (4.0 hat das Kopieren entfernt).
- **`no-module` deaktiviert FIPS.** Configure schaltet `fips` bei `no-module`
  aus: Ein FIPS-Provider ist immer ein separates Modul, niemals Teil einer
  statischen libcrypto (die dennoch einen laden kann).
- **Statische libcrypto unter Linux benötigt Kompressionsbibliotheken.** Ubuntus
  statische `libcrypto.a` benötigt `-lz -lzstd` (`Libs.private` in
  `libcrypto.pc`); die für eine Installation erforderlichen Bibliotheken werden
  zusammen mit ihr verzeichnet.

## Programme linken

Die Builtins liegen in einem eigenen Archiv, `clause_runtime_crypto` neben
`clause_runtime`, sodass Programme, die `crypto` nie aufrufen, so klein wie
bisher bleiben; libcrypto mit ihren Providern vergrößert Programme, die es
aufrufen, um etwa 4,5 MB.

- **Wann gelinkt wird.** `clau` linkt das Archiv, wenn im Stapel das
  Bibliotheksmodul `crypto` kompiliert wurde (ein statischer Aufruf von
  `crypto`), oder mit `--with-crypto` für Programme, die `crypto` nur durch
  dynamische Aufrufe erreichen (etwa die Entschlüsselung von Debug-Informationen
  durch `beam_lib`). Das Startobjekt führt dann den Erweiterungseintrag des
  Archivs auf, wodurch das Archiv eingebunden wird; beim Start werden seine
  Builtins registriert. Programme ohne `crypto` greifen nie auf OpenSSL zu.
- **Was gelinkt wird.** `clause_runtime_crypto.link` neben dem Archiv nennt
  libcrypto (erste Zeile) und ihre Systembibliotheken;
  `clause_runtime_crypto.openssl` hält fest, wie ein Quellbaum kompiliert wird
  (Version, Minimum, Ziel, Optionen, Compiler, Perl- und NASM-Verzeichnisse).
- **Ein anderes OpenSSL.** `--with-crypto=PATH`, andernfalls die
  Umgebungsvariable `CLAUSE_OPENSSL_ROOT`, linkt ein anderes OpenSSL ≥ 3.1.2:
  die libcrypto einer Installation oder einen Quellbaum, den `clau` bei der
  ersten Verwendung mit dem aufgezeichneten Verfahren unter
  `<build-dir>/cache/openssl/<hash>` konfiguriert und kompiliert (unter Windows
  wegen `nmake` in einer Visual Studio-Entwicklershell).

## FIPS

### Umschaltbarer Modus (wie bei OTP)

Der erste `crypto`-Aufruf versucht außerdem, OpenSSLs `fips`-Provider zu laden,
den OpenSSL über seine eigenen Variablen `OPENSSL_MODULES` (das Modulverzeichnis)
und `OPENSSL_CONF` findet (eine Konfiguration, die die von `openssl fipsinstall`
geschriebene `fipsmodule.cnf` einbindet und den Provider aktiviert). Dann gilt:

- `crypto:enable_fips_mode(true)` aktiviert OpenSSLs Standardeigenschaft
  `fips=yes` (`true`, wenn dies gelingt, `false` ohne ladbaren Provider);
  `crypto:enable_fips_mode(false)` deaktiviert sie.
- `crypto:info_fips/0` liefert `enabled` oder `not_enabled` sowie
  `not_supported`, wenn kein FIPS-Provider geladen wurde.
- `crypto:info/0` ergänzt `fips_provider_buildinfo`, wenn ein FIPS-Provider
  geladen ist.
- Im FIPS-Modus werden die dem Provider fehlenden Algorithmen aus
  `crypto:supports/1` weggelassen (ebenso OTPs öffentliche Nicht-FIPS-Schlüssel
  und -Kurven: `eddsa`, `eddh`, `srp`, die Edwards-Kurven) und lösen OTPs
  `notsup`-Fehler aus: `"Bad digest type in
  FIPS"`, `"Digest type not supported in FIPS"`, `"MAC algorithm forbidden in FIPS"`, `"Digest algorithm for HMAC
  forbidden in FIPS"`, `"Cipher algorithm not supported in FIPS"`, `"Forbidden in FIPS"`.
  Jeder Tabelleneintrag hält einen zweiten Abruf mit `fips=yes` vor, der bei
  aktiviertem FIPS-Modus verwendet wird, sodass der FIPS-Modus mit den eigenen
  Implementierungen des Providers rechnet.

Operationen mit öffentlichen Schlüsseln rufen ihre Algorithmen über OpenSSLs
Standardeigenschaften ab und verwenden im FIPS-Modus daher die Implementierungen
des Providers; `eddsa` löst `"Unsupported algorithm in FIPS mode"` aus und SRP
`notsup`, wie bei OTP.

OTPs Anwendungsvariable `fips_mode` wird nicht gelesen (Clause hat kein
`on_load` und Programme haben keine `sys.config`): Programme rufen
`crypto:enable_fips_mode/1` auf oder werden mit festgelegtem Modus kompiliert.

### Programme mit festgelegtem Modus: `clau --fips=PATH`

`--fips=PATH` erzeugt ein Programm, das immer im FIPS-Modus läuft, mit einem
vom Benutzer bereitgestellten FIPS-Provider. `PATH` ist entweder ein Verzeichnis
mit dem Provider-Modul und seiner `fipsmodule.cnf` oder eine OpenSSL-Installation:

| Datei | Zuerst in `PATH` gesucht, dann in |
| --- | --- |
| `fips.dll` (Windows), `fips.so` (Linux), `fips.dylib` (macOS) | `lib/ossl-modules`, `lib64/ossl-modules`, `lib/<triplet>/ossl-modules` |
| `fipsmodule.cnf` | `ssl/`, `etc/ssl/` |

- **Der Build scheitert**, wenn das Modul oder die Einstellungsdatei fehlt oder
  die Einstellungen kein `module-mac` in einem Abschnitt `[fips_sect]` enthalten
  (`openssl fipsinstall` ausführen).
- **Beide Dateien werden neben die ausführbare Datei kopiert**, unter den oben
  genannten Namen; sie müssen mit ihr bereitgestellt werden. Die Option
  impliziert `--with-crypto`; libcrypto wird wie üblich gewählt und muss den
  Provider akzeptieren.
- **Vor der Programmausführung** liest der FIPS-Eintrag des Startobjekts
  (`CLAUSE_crypto_fips_extension_v1`) die `fipsmodule.cnf` neben der ausführbaren
  Datei, lädt das danebenliegende Modul über eine OpenSSL-Provider-Konfiguration
  (die Einstellungen der Datei plus `module` und `activate`, die jede libcrypto
  ab 3.0 akzeptiert), lädt daneben nur OpenSSLs `base`-Provider (niemals
  `default` oder `legacy`; die OpenSSL-Systemkonfiguration wird nicht gelesen)
  und aktiviert `fips=yes`.
- **Wenn der Provider nicht geladen wird** oder sein Selbsttest scheitert
  (ein verändertes Modul, ein falscher `module-mac`), endet das Programm mit
  Exit-Status 70 und
  `crypto: cannot load the FIPS provider from <directory>: <OpenSSL's error>`
  auf stderr. Windows zeigt bei einem defekten Modul keinen „Bad Image“-Dialog:
  Der Fehlermodus unterdrückt ihn während des Ladens.
- **Der Modus kann nicht verlassen werden.** `crypto:enable_fips_mode(false)`
  liefert `false`, und `crypto:info_fips/0` bleibt `enabled`.

### Welcher FIPS-Provider

Clause kompiliert niemals einen FIPS-Provider für die Bereitstellung. OpenSSL
erlaubt anderen Versionen, einen validierten FIPS-Provider zu verwenden,
verbietet aber einen selbst kompilierten aus einer nicht validierten Version:
Es ist der Provider einer validierten Version zu verwenden (zum Zeitpunkt dieses
Dokuments 3.1.2, gemäß ihrer Sicherheitsrichtlinie kompiliert, oder ein von einem
Betriebssystemanbieter gelieferter); dessen `openssl fipsinstall` ist auf dem
Zielrechner auszuführen, soweit die Richtlinie dies verlangt. Der Provider von
3.1.2 lässt sich in die festgelegte libcrypto 4.1 laden: Die vollständige Suite
kompiliert ihn (nur für den Test) und führt damit Programme mit festgelegtem und
umschaltbarem Modus aus.

## Tests

| Test | Suite | Was geprüft wird |
| --- | --- | --- |
| `executables_crypto_digests`, `executables_crypto_ciphers` | fast | Referenztests aus OTP 29.1.1: Vektoren, Zustände, Fehler, ermittelte Listen, `info_fips` ohne Provider |
| `linking_crypto` | fast | Das Archiv wird nur bei Verwendung gelinkt; `--with-crypto[=PATH]`, `CLAUSE_OPENSSL_ROOT`, Ablehnungen |
| `linking_fips` | fast | Ablehnungen von `--fips`, fehlende oder fehlerhafte Provider lassen den Build scheitern, Kopieren, Startfehler |
| `linking_crypto_source` | full | `--with-crypto=SOURCE` kompiliert den Quellbaum von 4.1.0 einmalig in den Build-Cache |
| `linking_crypto_minimum` | full | Mit einer aus dem Quellcode von 3.1.2 kompilierten libcrypto gelinkte Crypto-Referenztests geben ihre Referenzausgaben aus |
| `linking_fips_real` | full | Der FIPS-Provider von 3.1.2 (für den Test mit `enable-fips` kompiliert) in einem Programm mit festgelegtem Modus (bleibt im FIPS-Modus, verbotene Algorithmen, manipuliertes Modul stoppt es) und einem umschaltbaren (`OPENSSL_MODULES`/`OPENSSL_CONF`) |
