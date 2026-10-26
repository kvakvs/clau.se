---
source: docs/crypto.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 1713219c9c04cba4db60a95d49dd0d38365ce9026ca10d36ed4d0d602b55f99b
translatedAt: 2026-10-26
---
# Crypto : OpenSSL, compilation et FIPS

Le `crypto` de Clause fournit le module `crypto` d’OTP au moyen de libcrypto
d’OpenSSL. Cette note décrit la version d’OpenSSL utilisée et sa recherche,
sa compilation depuis les sources par Clause et `clau`, son édition de liens
avec les programmes et le mode FIPS. Les fonctions intégrées sont décrites dans
[fonctions intégrées](builtins.md#crypto-module), le module de bibliothèque dans
[bibliothèque](library.md), et les différences observables avec OTP dans
[différences](differences.md#crypto).
Les clés et signatures de `public_key` y font appel
([public_key](public_key.md#keys-and-signatures)).

## Versions d’OpenSSL

- **Version fixée : 4.1.0.** Version que Clause télécharge et compile si aucun
  autre OpenSSL n’est fourni.
- **Minimum : 3.1.2.** Dernière version dont le fournisseur FIPS est validé
  (certificat FIPS 140-3 #4985). Toute libcrypto à partir de 3.1.2 peut être liée
  à l’archive crypto : les fonctions intégrées utilisent uniquement les API
  présentes dans 3.1.2 et traitent les différences de version à l’exécution ;
  une même archive convient donc à toutes ces libcrypto. Des en-têtes récents
  peuvent toutefois associer un ancien nom à une fonction plus récente
  (`EVP_MD_CTX_get_size` de 4.1 est `EVP_MD_CTX_get_size_ex` de 3.4) ; l’archive
  évite donc ces noms. La suite complète de tests lie les tests de référence
  crypto à une libcrypto compilée depuis les sources de 3.1.2.
- **Les algorithmes sont détectés, sans présumer leur présence.** Le premier
  appel à `crypto` charge les fournisseurs (`fips` s’il peut être chargé, puis
  `default`, `base` et `legacy`, comme OTP) et recherche chaque fonction de
  hachage, algorithme de chiffrement et MAC des tables d’OTP ;
  `crypto:supports/0,1`, `hash_info/1`, `info/0` et `info_lib/0` indiquent ce
  qu’offre l’OpenSSL lié. Un programme lié à 3.1.2 répertorie simplement moins
  d’algorithmes (pas de ML-KEM, ML-DSA ni SLH-DSA).

OpenSSL est sous licence Apache-2.0 ; aucun fichier OpenSSL n’est versionné.

## Provenance de l’OpenSSL de Clause

CMake (`cmake/OpenSSLDependencies.cmake`) recherche libcrypto pour l’archive
crypto dans cet ordre :

1. `-DCLAUSE_OPENSSL_ROOT=<path>` : un préfixe d’installation
   (`include/openssl/opensslv.h`) ou une arborescence source (`Configure`,
   `VERSION.dat`), compilée comme au point 3.
2. Un OpenSSL installé ≥ 3.1.2 (`CLAUSE_OPENSSL_SYSTEM`, ON par défaut sauf sous
   Windows) : `find_package(OpenSSL)`, avec préférence pour libcrypto statique.
3. La version fixée, téléchargée dans `thirdparty/openssl-4.1.0` et vérifiée
   (`openssl-4.1.0.tar.gz`, SHA-256
   `50c17baf54cb008f6ce42d50deb4b28050a1aad711636cabd4b241c7e90cc2fd`),
   configurée et compilée une fois dans
   `thirdparty/openssl-4.1.0-<arch>-<crt>/install` (recompilée si le compilateur
   ou les options changent) ; `-DCLAUSE_DOWNLOAD_OPENSSL=OFF` désactive le
   téléchargement.

`-DCLAUSE_RUNTIME_CRYPTO=OFF` exclut entièrement l’archive crypto. Lorsque les
tests sont activés, la configuration télécharge aussi les sources de 3.1.2
(`openssl-3.1.2.tar.gz`, SHA-256
`a0ce69b8b97ea6a35b96875235aa453b966ba3cba8af2de23657d8b6767d6539`) dans
`thirdparty/openssl-3.1.2` pour les tests de la suite complète ;
`-DCLAUSE_TEST_OPENSSL_MINIMUM=OFF` omet ce téléchargement et ces tests.

## Compilation d’OpenSSL depuis les sources

La compilation depuis les sources produit une libcrypto statique intégrant le
fournisseur legacy (que les fonctions intégrées chargent comme OTP) :

```
Configure <target> no-shared no-module no-tests no-docs no-makedepend enable-ec_explicit_curves
          [enable-static-vcruntime] [--debug] --prefix=<install> --openssldir=<install>/ssl --libdir=lib
make build_libs && make install_dev
```

- **Compilateur et runtime.** Le compilateur C de CMake la compile (`CC`) ;
  `enable-static-vcruntime` sélectionne `/MT` si la compilation utilise le
  runtime MSVC statique, `--debug` sa variante Debug.
- **Outils Windows.** Configure nécessite un Perl natif et NASM : les versions
  fixées de Strawberry Perl 5.42.3.1 portable (SHA-256
  `6a081a811781c30aca51dbc036afd93092af91e3297901f02c17043795a10690`)
  et NASM 3.02 (SHA-256
  `161d0bfaff53c2f9e9f3e69fd0672323ebabafd1268976a5cec11be92a19aee7`)
  sont téléchargées dans `thirdparty/tools/`. `nmake` compile ensuite en série
  (environ 4 minutes la première fois) ; un environnement de développement
  Visual Studio est donc nécessaire. Linux et macOS utilisent leurs `perl`
  et `make -j` (deux tiers des cœurs).
- **Les anciennes arborescences source ne reçoivent que les options connues.**
  enable-X et no-X sont conservées si X figure dans l’une des listes
  `my @disablables... = (...)` de `Configure` : 3.1.2 ne connaît ni `no-docs`,
  ni `enable-ec_explicit_curves` (les courbes explicites sont toujours incluses),
  ni `enable-static-vcruntime` (ses compilations statiques utilisent déjà `/MT`).
- **Les compilations croisées** utilisent l’OpenSSL installé de la cible via
  `CLAUSE_OPENSSL_ROOT`.

### Difficultés rencontrées

- **Le Perl MSYS de Git fait échouer Configure.** Il transmet à Configure des
  chemins Unix que `nmake` ne peut pas utiliser : les compilations Windows
  nécessitent le Perl natif de Strawberry, jamais le `perl` que Git for Windows
  place dans `PATH`.
- **Les compilations hors de l’arborescence source avec `no-apps` échouent**
  (`apps/include` manque) ; Clause conserve donc les applications activées et
  compile la cible `build_libs` plutôt que l’ensemble.
- **`install_fips` hors de l’arborescence source échoue sous Windows.** Le
  makefile désigne le programme par `"apps\\openssl.exe"`, que `nmake` ne fait
  pas correspondre à sa propre règle `apps\openssl.exe`. Compiler `build_sw`
  et exécuter soi-même `openssl fipsinstall` à la place.
- **3.x installe un PDB que clang-cl ne produit jamais.** Sous Windows,
  `install_dev` d’une compilation statique 3.x copie `ossl_static.pdb`, que les
  informations de débogage intégrées de clang-cl (`/Z7`) ne produisent pas ;
  Clause lui fournit un fichier vide (4.0 a supprimé cette copie).
- **`no-module` désactive FIPS.** Configure désactive `fips` avec `no-module` :
  un fournisseur FIPS est toujours un module distinct, jamais une partie d’une
  libcrypto statique (qui peut néanmoins en charger un).
- **libcrypto statique sous Linux nécessite des bibliothèques de compression.**
  Le `libcrypto.a` statique d’Ubuntu exige `-lz -lzstd` (`Libs.private` dans
  `libcrypto.pc`) ; les bibliothèques nécessaires à une installation sont
  enregistrées avec elle.

## Édition de liens des programmes

Les fonctions intégrées résident dans leur propre archive,
`clause_runtime_crypto`, à côté de `clause_runtime` : les programmes qui
n’appellent jamais `crypto` restent aussi petits qu’avant ; libcrypto et ses
fournisseurs ajoutent environ 4.5 MB à ceux qui l’appellent.

- **Quand l’archive est liée.** `clau` lie l’archive lorsque le lot a compilé
  le module de bibliothèque `crypto` (un appel statique à `crypto`), ou avec
  `--with-crypto` pour les programmes qui n’atteignent `crypto` que par des
  appels dynamiques (le déchiffrement des informations de débogage par
  `beam_lib` en est un exemple). L’objet de démarrage répertorie alors le point
  d’entrée de l’extension de l’archive, ce qui inclut celle-ci dans l’édition de
  liens, puis le démarrage enregistre ses fonctions intégrées. Les programmes
  sans `crypto` ne recherchent jamais OpenSSL.
- **Ce qui est lié.** `clause_runtime_crypto.link`, à côté de l’archive, indique
  libcrypto (première ligne) et ses bibliothèques système ;
  `clause_runtime_crypto.openssl` enregistre la manière de compiler une
  arborescence source (version, minimum, cible, options, compilateur,
  répertoires de Perl et NASM).
- **Un autre OpenSSL.** `--with-crypto=PATH`, ou à défaut la variable
  d’environnement `CLAUSE_OPENSSL_ROOT`, lie un autre OpenSSL ≥ 3.1.2 : la
  libcrypto d’une installation, ou une arborescence source que `clau` configure
  et compile avec la procédure enregistrée dans
  `<build-dir>/cache/openssl/<hash>` à la première utilisation (dans un shell
  de développement Visual Studio sous Windows, pour `nmake`).

## FIPS

### Mode commutable (comme OTP)

Le premier appel à `crypto` tente aussi de charger le fournisseur `fips`
d’OpenSSL, qu’OpenSSL trouve via ses propres `OPENSSL_MODULES` (le répertoire
des modules) et `OPENSSL_CONF` (une configuration qui inclut le
`fipsmodule.cnf` écrit par `openssl fipsinstall` et active le fournisseur).
Ensuite :

- `crypto:enable_fips_mode(true)` active la propriété par défaut `fips=yes`
  d’OpenSSL (`true` en cas de succès, `false` sans fournisseur chargeable) ;
  `crypto:enable_fips_mode(false)` la désactive.
- `crypto:info_fips/0` renvoie `enabled` ou `not_enabled`, et `not_supported`
  si aucun fournisseur FIPS n’a été chargé.
- `crypto:info/0` ajoute `fips_provider_buildinfo` lorsqu’un fournisseur FIPS
  est chargé.
- En mode FIPS, les algorithmes absents du fournisseur sont exclus de
  `crypto:supports/1` (ainsi que les clés publiques et courbes non FIPS d’OTP :
  `eddsa`, `eddh`, `srp`, les courbes Edwards) et lèvent les erreurs `notsup`
  d’OTP : `"Bad digest type in
  FIPS"`, `"Digest type not supported in FIPS"`, `"MAC algorithm forbidden in FIPS"`, `"Digest algorithm for HMAC
  forbidden in FIPS"`, `"Cipher algorithm not supported in FIPS"`, `"Forbidden in FIPS"`.
  Chaque entrée de table conserve une seconde recherche avec `fips=yes`,
  utilisée lorsque le mode FIPS est actif ; le mode FIPS effectue ainsi ses
  calculs avec les implémentations du fournisseur lui-même.

Les opérations à clé publique recherchent leurs algorithmes via les propriétés
par défaut d’OpenSSL ; en mode FIPS, elles utilisent donc les implémentations
du fournisseur. `eddsa` lève `"Unsupported algorithm in FIPS mode"` et SRP
`notsup`, comme OTP.

La variable d’application `fips_mode` d’OTP n’est pas lue (Clause n’a pas de
`on_load` et les programmes n’ont pas de `sys.config`) : les programmes
appellent `crypto:enable_fips_mode/1`, ou sont compilés avec le mode fixé.

### Programmes à mode fixé : `clau --fips=PATH`

`--fips=PATH` compile un programme qui s’exécute toujours en mode FIPS, avec un
fournisseur FIPS fourni par l’utilisateur. `PATH` est soit un répertoire
contenant le module du fournisseur et son `fipsmodule.cnf`, soit une
installation OpenSSL :

| Fichier | Recherché dans `PATH`, puis dans |
| --- | --- |
| `fips.dll` (Windows), `fips.so` (Linux), `fips.dylib` (macOS) | `lib/ossl-modules`, `lib64/ossl-modules`, `lib/<triplet>/ossl-modules` |
| `fipsmodule.cnf` | `ssl/`, `etc/ssl/` |

- **La compilation échoue** si le module ou le fichier de paramètres manque,
  ou si les paramètres n’ont pas de `module-mac` dans une section `[fips_sect]`
  (exécuter `openssl fipsinstall`).
- **Les deux fichiers sont copiés à côté de l’exécutable**, sous les noms
  ci-dessus ; les déployer avec lui. L’option implique `--with-crypto` ;
  libcrypto est choisie comme d’habitude et doit accepter le fournisseur.
- **Avant l’exécution du programme**, le point d’entrée FIPS de l’objet de
  démarrage (`CLAUSE_crypto_fips_extension_v1`) lit `fipsmodule.cnf` à côté de
  l’exécutable, charge le module voisin via une configuration de fournisseur
  OpenSSL (les paramètres du fichier plus `module` et `activate`, acceptés par
  toutes les libcrypto à partir de 3.0), charge uniquement le fournisseur
  `base` d’OpenSSL en complément (jamais `default` ni `legacy` ; la
  configuration OpenSSL du système n’est pas lue) et active `fips=yes`.
- **Si le fournisseur ne se charge pas** ou échoue à son autotest (module
  modifié, `module-mac` incorrect), le programme s’arrête avec le code de
  sortie 70 et `crypto: cannot load the FIPS provider from <directory>: <OpenSSL's error>`
  sur stderr. Windows n’affiche pas de boîte de dialogue « Bad Image » pour un
  module endommagé : le mode d’erreur est silencieux pendant son chargement.
- **Il est impossible de quitter ce mode.** `crypto:enable_fips_mode(false)`
  renvoie `false`, et `crypto:info_fips/0` reste à `enabled`.

### Quel fournisseur FIPS utiliser

Clause ne compile jamais de fournisseur FIPS destiné au déploiement. OpenSSL
autorise d’autres versions à utiliser un fournisseur FIPS validé, mais interdit
d’en utiliser un compilé soi-même depuis une version non validée : prendre le
fournisseur d’une version validée (3.1.2 au moment de la rédaction, compilé
selon sa politique de sécurité, ou fourni par un éditeur de système
d’exploitation) et exécuter son `openssl fipsinstall` sur la machine cible
lorsque la politique l’exige. Le fournisseur 3.1.2 se charge dans la libcrypto
4.1 fixée : la suite complète le compile (pour le test uniquement) et exécute
avec lui des programmes à mode fixé et commutable.

## Tests

| Test | Suite | Vérifications |
| --- | --- | --- |
| `executables_crypto_digests`, `executables_crypto_ciphers` | fast | Tests de référence d’OTP 29.1.1 : vecteurs, états, erreurs, listes détectées, `info_fips` sans fournisseur |
| `linking_crypto` | fast | L’archive n’est liée que si elle est utilisée ; `--with-crypto[=PATH]`, `CLAUSE_OPENSSL_ROOT`, refus |
| `linking_fips` | fast | Refus de `--fips`, échec de compilation si les fournisseurs sont absents ou mal formés, copie, échecs au démarrage |
| `linking_crypto_source` | full | `--with-crypto=SOURCE` compile une fois l’arborescence 4.1.0 dans le cache de compilation |
| `linking_crypto_minimum` | full | Les tests de référence crypto liés à une libcrypto compilée depuis les sources de 3.1.2 affichent leurs résultats de référence |
| `linking_fips_real` | full | Fournisseur FIPS de 3.1.2 (compilé avec `enable-fips` pour le test) dans un programme à mode fixé (reste en mode FIPS, algorithmes interdits, arrêt si le module est altéré) et un programme à mode commutable (`OPENSSL_MODULES`/`OPENSSL_CONF`) |
