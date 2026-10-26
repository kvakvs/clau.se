---
source: docs/public_key.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b488261ff871b69e1f5ccbf5ba160afcad4a9521574673ac0d630571c404b268
translatedAt: 2026-10-26
---
# public_key

L’application `public_key` de Clause se compose de deux parties : les modules
ASN.1 qui encodent et décodent les types PKIX et PKCS, que clau génère depuis
les spécifications de `library/public_key/asn1/`, avec l’en-tête
`library/public_key/include/public_key.hrl`, et le module `public_key`, qui
possède les exports d’OTP 29 : son codec DER et PEM ainsi que ses clés et
signatures sont implémentés ; la validation lève encore
`{not_implemented, Name, Arity}`
([inventaire](../library/public_key/public_key.terms)).

## Spécifications

`library/public_key/asn1/` contient les modules que le `public_key` d’OTP
compile, sous les mêmes noms :

| Source | Modules |
| --- | --- |
| RFC 5912 (PKIX, ASN.1 de 2009) | `AlgorithmInformation-2009`, `AttributeCertificateVersion1-2009`, `EnrollmentMessageSyntax-2009`, `PKCS-10`, `PKIX-CommonTypes-2009`, `PKIX-X400Address-2009`, `PKIX1-PSS-OAEP-Algorithms-2009`, `PKIX1Explicit-2009`, `PKIX1Implicit-2009`, `PKIXAlgs-2009`, `PKIXAttributeCertificate-2009`, `PKIXCRMF-2009` |
| RFC 5911 (CMS et S/MIME) | `CryptographicMessageSyntax-2009`, `CryptographicMessageSyntaxAlgorithms-2009`, `CMSAesRsaesOaep-2009`, `SecureMimeMessageV3dot1-2009` |
| RFC 5915, 5958, 8017, 8018, 8410, 9629, 9654, 9810, 9814, 9881, 9935 | `ECPrivateKey`, `AsymmetricKeyPackageModuleV1`, `PKCS-1`, `PKCS5v2-0`, `Safecurves-pkix-18`, `KEMAlgorithmInformation-2023`, `OCSP-2024-08`, `PKIXCMP-2023`, `SLH-DSA-Module-2024`, `X509-ML-DSA-2025`, `X509-ML-KEM-2025` |
| Écrits pour Clause | `OTP-PKIX` et `OTP-PKIX-Relaxed` (les formes `OTPCertificate`), `DSS` (`DSAPrivateKey`), `PKCS-3` (`DHParameter`), `RFC5639` (identifiants des courbes Brainpool), `PKCS-FRAME.set.asn` (`AsymmetricKeyPackageModuleV1` avec `PKCS5v2-0`) |

Chaque module RFC est le composant de code de sa RFC, avec la notice BSD de
l’IETF Trust ; le texte du module est inchangé sauf là où le module d’OTP
diffère. Ces modifications sont répertoriées en tête du fichier (`PKCS-1`,
`PKCS5v2-0`, `ECPrivateKey`, `PKIX1Explicit-2009`, `PKIXAlgs-2009`,
`PKIXCMP-2023`). Les modules génèrent les mêmes modules Erlang et en-têtes
que les spécifications d’OTP.

## Modules générés

La compilation exécute `clau --generate-asn1` avec les options d’OTP (`ber`,
`der`, `noobj`) sur les spécifications et écrit les modules (`'OTP-PKIX'`,
`'PKIX1Explicit-2009'`, ...) dans `library-asn1/public_key/`, dans
l’arborescence de compilation, une seconde racine de bibliothèque après
`library/` ([bibliothèque](library.md#how-programs-get-them)) : un programme
qui en nomme un le fait compiler dans son lot comme tout module de
bibliothèque. Comme dans OTP, les modules fusionnés par `PKCS-FRAME`
(`AsymmetricKeyPackageModuleV1`, `PKCS5v2-0`) ne sont pas des modules
autonomes. Leurs encodages, décodages et records sont ceux d’asn1ct
([ASN.1](asn1.md)) ; les fonctions de décodage exclusif `asn1config` d’OTP
(`decode_TBSCert_exclusive/1`) ne sont pas générées.

## En-tête

`-include_lib("public_key/include/public_key.hrl")` se résout vers l’en-tête
de Clause, sauf si un projet désigne sa propre application `public_key`.
Il définit les records et macros de celui d’OTP : la plupart sont les records
et valeurs générés par les spécifications, les autres sont les records que
`public_key` construit lui-même (`'Certificate'` dans sa forme antérieure à
2009, `'ECPoint'`, les clés ML-DSA, ML-KEM et SLH-DSA, `#cert{}`) et les
identifiants d’objet qu’il nomme. Le test de référence `public_key_records`
vérifie les champs et valeurs par défaut de chaque record et la valeur de
chaque macro par rapport à l’en-tête d’OTP ; `public_key_asn1` décode et encode
certificats, clés et paramètres via les modules générés.

## Fonctions

`public_key` (avec [`public_key.app`](../library/public_key/public_key.app)
et un `asn1.app` pour l’application dont il dépend) délègue ses fonctions de
codec à `clause_public_key_codec`, qui inclut `public_key.hrl` ; les parcours
de records et les tables d’identifiants d’objet de `pubkey_translation` et
`pubkey_cert_records` d’OTP sont des fonctions intégrées du runtime
([clé publique](builtins.md#public-key)).

- `der_decode/2`, `der_encode/2` : le module généré du type, choisi comme par
  OTP ; `PrivateKeyInfo` et `OneAsymmetricKey` de PKCS #8 déballés en clés RSA
  (également RSASSA-PSS avec ses paramètres), DSA, EC, Ed25519/Ed448, ML-DSA,
  ML-KEM et SLH-DSA, puis réemballés ; `EcpkParameters`, `Dss-Sig-Value`,
  `AttributeTypeAndValue`, `ExtensionRequest` et types d’extension
  (`'SubjectAltName'`, `'CRLReason'`, ...) tels qu’OTP les encode ; erreurs
  identiques à celles d’OTP (`{badmatch, {error, {asn1, Reason}}}`,
  `{badarg, {unknown_type, Type}}`).
- `pem_decode/1`, `pem_encode/1` : étiquettes et lignes d’OTP (64 caractères,
  `CRLF` et espaces finaux acceptés, autres lignes ignorées) ; une entrée
  `ENCRYPTED PRIVATE KEY` est décodée en
  `{'PrivateKeyInfo', Encrypted, CipherInfo}`.
- `pem_entry_decode/1,2`, `pem_entry_encode/2,3` : entrées
  `SubjectPublicKeyInfo` de tous les types de clés ; chiffrement par mot de
  passe selon l’ancien schéma `Proc-Type`/`DEK-Info` d’OpenSSL (dérivation de
  clé MD5), PKCS #5 PBES1 (PBKDF1) et PBES2 (PBKDF2 avec
  HMAC-SHA1/224/256/384/512) via `crypto`, avec les algorithmes de chiffrement
  `DES-CBC`, `DES-EDE3-CBC`, `RC2-CBC` et `AES-128/192/256-CBC` (ceux que
  l’OpenSSL lié fournit).
- `pkix_decode_cert/2` sous les formes `plain`, `otp` et `relaxed` (la forme
  otp avec sa clé publique et ses extensions décodées, les points de
  distribution CRL laissés encodés, les longues notices utilisateur tronquées
  à 350 caractères comme dans OTP), `pkix_encode/3` sous les formes `plain`
  et `otp`.

Le test de référence `public_key_codec` compare tous ces éléments à OTP,
y compris le texte PEM des entrées chiffrées.

## Clés et signatures

`clause_public_key_keys` transforme les records de clés en listes de clés de
[`crypto`](crypto.md) comme OTP, puis l’appelle :

| Clé | Algorithme crypto |
| --- | --- |
| `#'RSAPrivateKey'{}` (tous les composants CRT, ou seulement `[E, N, D]`), `{RSAKey, PssParams}` ; `#'RSAPublicKey'{}` | `rsa` |
| `#'DSAPrivateKey'{}` ; `{Y, #'Dss-Parms'{}}` | `dss` |
| `#'ECPrivateKey'{}` avec paramètres nommés ou explicites ; `{#'ECPoint'{}, Params}` | `ecdsa` |
| Ed25519/Ed448 `#'ECPrivateKey'{}`, `{ed_pri, Curve, Pub, Priv}` ; `{#'ECPoint'{}, {namedCurve, Oid}}`, `{ed_pub, Curve, Key}` | `eddsa` |
| `#'ML-DSAPrivateKey'{}` (graine, sinon clé développée), `#'SLH-DSAPrivateKey'{}` ; leurs clés publiques | le jeu de paramètres |
| Une map avec `sign_fun` ou `encrypt_fun` | la fun est appelée |

- `sign/3,4`, `verify/4,5` (une clé DSA avec le type d’empreinte `none` signe
  une empreinte SHA-1 ; une signature qui n’est pas un binary donne `false`
  à la vérification ; une clé d’aucun type reconnu lève `badarg`),
  `encrypt_private/2,3`, `decrypt_public/2,3`, `encrypt_public/2,3`,
  `decrypt_private/2,3` (bourrage issu de `rsa_pad`, `rsa_padding` ou de la
  première option atome, PKCS #1 par défaut).
- `generate_key/1` : DH, EC sur courbes nommées et explicites (paramètres
  normalisés vers l’OID de la courbe), X25519/X448, Ed25519/Ed448, RSA,
  ML-DSA et SLH-DSA ; `compute_key/2,3` : ECDH, X25519/X448 et DH.
- `pkix_sign/2` et `pkix_verify/2` pour tous les algorithmes de signature
  connus d’OTP, y compris RSASSA-PSS ; les octets signés sont le premier
  élément du certificat DER, tels que les fournit le décodage exclusif d’OTP.
  `pkix_sign_types/1`, `pkix_hash_type/1`.
- `short_name_hash/1` : hachage `c_rehash` d’OpenSSL appliqué à un nom.
- `dh_gex_group/4`, `dh_gex_group_sizes/0` : sélection des groupes d’OTP ;
  les groupes par défaut sont au nombre de huit par taille, issus du fichier
  de modules d’OpenSSH (`clause_public_key_moduli`), avec les tailles d’OTP
  ([différences](differences.md#asn1)). `ssh_curvename2oid/1`,
  `oid2ssh_curvename/1`, `handle_trace/3`.

Les particularités d’OTP sont conservées : une clé ML-DSA créée par
`generate_key/1` a une graine vide, avec laquelle `crypto` refuse de signer ;
une clé privée DSA ne peut pas vérifier de signature ; les courbes explicites
sur corps premier échouent lors du décodage de leur nombre premier. Le test
de référence `public_key_keys` compare à OTP les signatures déterministes
(RSA PKCS #1, EdDSA, certificats), le chiffrement, l’accord de clés, les types,
les hachages et la sélection des groupes.
