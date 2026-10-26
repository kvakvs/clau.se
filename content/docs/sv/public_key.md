---
source: docs/public_key.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b488261ff871b69e1f5ccbf5ba160afcad4a9521574673ac0d630571c404b268
translatedAt: 2026-10-26
---
# public_key

Clauses applikation `public_key` består av två delar: ASN.1-modulerna som
kodar och avkodar PKIX- och PKCS-typerna, som clau genererar från
specifikationerna i `library/public_key/asn1/`, samt headerfilen
`library/public_key/include/public_key.hrl`, och modulen `public_key`, som
har OTP 29:s exporterade funktioner: dess DER- och PEM-kodare och -avkodare
samt nycklar och signaturer är implementerade; validering ger fortfarande
`{not_implemented, Name, Arity}`
([förteckning](../library/public_key/public_key.terms)).

## Specifikationer

`library/public_key/asn1/` innehåller modulerna som OTP:s `public_key`
kompilerar, under samma namn:

| Källa | Moduler |
| --- | --- |
| RFC 5912 (PKIX, 2009 ASN.1) | `AlgorithmInformation-2009`, `AttributeCertificateVersion1-2009`, `EnrollmentMessageSyntax-2009`, `PKCS-10`, `PKIX-CommonTypes-2009`, `PKIX-X400Address-2009`, `PKIX1-PSS-OAEP-Algorithms-2009`, `PKIX1Explicit-2009`, `PKIX1Implicit-2009`, `PKIXAlgs-2009`, `PKIXAttributeCertificate-2009`, `PKIXCRMF-2009` |
| RFC 5911 (CMS och S/MIME) | `CryptographicMessageSyntax-2009`, `CryptographicMessageSyntaxAlgorithms-2009`, `CMSAesRsaesOaep-2009`, `SecureMimeMessageV3dot1-2009` |
| RFC 5915, 5958, 8017, 8018, 8410, 9629, 9654, 9810, 9814, 9881, 9935 | `ECPrivateKey`, `AsymmetricKeyPackageModuleV1`, `PKCS-1`, `PKCS5v2-0`, `Safecurves-pkix-18`, `KEMAlgorithmInformation-2023`, `OCSP-2024-08`, `PKIXCMP-2023`, `SLH-DSA-Module-2024`, `X509-ML-DSA-2025`, `X509-ML-KEM-2025` |
| Skrivna för Clause | `OTP-PKIX` och `OTP-PKIX-Relaxed` (`OTPCertificate`-formerna), `DSS` (`DSAPrivateKey`), `PKCS-3` (`DHParameter`), `RFC5639` (identifierare för Brainpool-kurvor), `PKCS-FRAME.set.asn` (`AsymmetricKeyPackageModuleV1` med `PKCS5v2-0`) |

Varje RFC-modul är kodkomponenten i sin RFC med IETF Trusts BSD-licenstext,
med oförändrad modultext utom där OTP:s modul skiljer sig; dessa ändringar
listas överst i filen (`PKCS-1`, `PKCS5v2-0`, `ECPrivateKey`,
`PKIX1Explicit-2009`, `PKIXAlgs-2009`, `PKIXCMP-2023`). Modulerna genererar
samma Erlang-moduler och headerfiler som OTP:s specifikationer gör.

## Genererade moduler

Bygget kör `clau --generate-asn1` med OTP:s alternativ (`ber`, `der`,
`noobj`) på specifikationerna och skriver modulerna (`'OTP-PKIX'`,
`'PKIX1Explicit-2009'`, ...) till `library-asn1/public_key/` i byggträdet,
en andra biblioteksrot efter `library/`
([bibliotek](library.md#how-programs-get-them)): ett program som anger en av
dem får den kompilerad i sin kompileringsomgång som vilken biblioteksmodul
som helst. Som i OTP är modulerna som `PKCS-FRAME` slår samman
(`AsymmetricKeyPackageModuleV1`, `PKCS5v2-0`) inte egna moduler. Deras
kodningar, avkodningar och records är som i asn1ct ([ASN.1](asn1.md)); OTP:s
exklusiva avkodningsfunktioner för `asn1config`
(`decode_TBSCert_exclusive/1`) genereras inte.

## Headerfil

`-include_lib("public_key/include/public_key.hrl")` hittar Clauses headerfil
om inte ett projekt anger en egen `public_key`-applikation. Den definierar
samma records och makron som OTP:s: de flesta är de records och värden som
specifikationerna genererar, de övriga är de records som `public_key` bygger
själv (`'Certificate'` i sin form från före 2009, `'ECPoint'`, nycklarna för
ML-DSA, ML-KEM och SLH-DSA, `#cert{}`) och de objektidentifierare den anger.
Referenstestet `public_key_records` kontrollerar varje records fält och
standardvärden samt varje makros värde mot OTP:s headerfil;
`public_key_asn1` avkodar och kodar certifikat, nycklar och parametrar genom
de genererade modulerna.

## Funktioner

`public_key` (med [`public_key.app`](../library/public_key/public_key.app)
och en `asn1.app` för applikationen den beror på) vidarebefordrar sina
kodnings- och avkodningsfunktioner till `clause_public_key_codec`, som
inkluderar `public_key.hrl`; record-genomgångarna och tabellerna för
objektidentifierare i OTP:s `pubkey_translation` och `pubkey_cert_records`
är inbyggda funktioner i runtime ([publika nycklar](builtins.md#public-key)).

- `der_decode/2`, `der_encode/2`: typens genererade modul, vald som i OTP;
  PKCS #8 `PrivateKeyInfo` och `OneAsymmetricKey` packas upp till RSA (även
  RSASSA-PSS med dess parametrar), DSA, EC, Ed25519/Ed448, ML-DSA, ML-KEM och
  SLH-DSA-nycklar och packas in igen; `EcpkParameters`, `Dss-Sig-Value`,
  `AttributeTypeAndValue`, `ExtensionRequest` och utökningstyper
  (`'SubjectAltName'`, `'CRLReason'`, ...) som OTP kodar dem; fel som i OTP
  (`{badmatch, {error, {asn1, Reason}}}`, `{badarg, {unknown_type, Type}}`).
- `pem_decode/1`, `pem_encode/1`: OTP:s etiketter och rader (64 tecken,
  `CRLF` och avslutande blanktecken accepteras, andra rader hoppas över); en
  `ENCRYPTED PRIVATE KEY`-post avkodas till
  `{'PrivateKeyInfo', Encrypted, CipherInfo}`.
- `pem_entry_decode/1,2`, `pem_entry_encode/2,3`: `SubjectPublicKeyInfo`-poster
  för varje nyckeltyp; lösenordskryptering med OpenSSL:s äldre
  `Proc-Type`/`DEK-Info`-schema (MD5-nyckelhärledning), PKCS #5 PBES1
  (PBKDF1) och PBES2 (PBKDF2 med HMAC-SHA1/224/256/384/512) ovanpå `crypto`,
  med chiffren `DES-CBC`, `DES-EDE3-CBC`, `RC2-CBC` och `AES-128/192/256-CBC`
  (de som den länkade OpenSSL tillhandahåller).
- `pkix_decode_cert/2` i formerna `plain`, `otp` och `relaxed` (otp-formen
  med sin publika nyckel och sina utökningar avkodade, CRL-distributionspunkter
  lämnas kodade, långa användarmeddelanden kapas till 350 tecken som i OTP),
  `pkix_encode/3` i formerna `plain` och `otp`.

Referenstestet `public_key_codec` jämför allt detta med OTP, även PEM-texten
för krypterade poster.

## Nycklar och signaturer

`clause_public_key_keys` omvandlar nyckel-records till
[`crypto`](crypto.md):s nyckellistor som OTP gör och anropar den:

| Nyckel | crypto-algoritm |
| --- | --- |
| `#'RSAPrivateKey'{}` (alla CRT-komponenter eller bara `[E, N, D]`), `{RSAKey, PssParams}`; `#'RSAPublicKey'{}` | `rsa` |
| `#'DSAPrivateKey'{}`; `{Y, #'Dss-Parms'{}}` | `dss` |
| `#'ECPrivateKey'{}` med namngivna eller explicita parametrar; `{#'ECPoint'{}, Params}` | `ecdsa` |
| Ed25519/Ed448 `#'ECPrivateKey'{}`, `{ed_pri, Curve, Pub, Priv}`; `{#'ECPoint'{}, {namedCurve, Oid}}`, `{ed_pub, Curve, Key}` | `eddsa` |
| `#'ML-DSAPrivateKey'{}` (frö, annars expanderad nyckel), `#'SLH-DSAPrivateKey'{}`; deras publika nycklar | parameteruppsättningen |
| En map med `sign_fun` eller `encrypt_fun` | fun anropas |

- `sign/3,4`, `verify/4,5` (en DSA-nyckel med hashtypen `none` signerar ett
  SHA-1-hashvärde; en signatur som inte är en binary ger `false` vid
  verifiering; en nyckel som inte är av någon giltig typ ger `badarg`),
  `encrypt_private/2,3`, `decrypt_public/2,3`, `encrypt_public/2,3`,
  `decrypt_private/2,3` (utfyllnad från `rsa_pad`, `rsa_padding` eller det
  första atomalternativet, PKCS #1 som standard).
- `generate_key/1`: DH, EC på namngivna och explicita kurvor (parametrar
  normaliseras till kurvans OID), X25519/X448, Ed25519/Ed448, RSA, ML-DSA och
  SLH-DSA; `compute_key/2,3`: ECDH, X25519/X448 och DH.
- `pkix_sign/2` och `pkix_verify/2` för varje signaturalgoritm OTP känner
  till, även RSASSA-PSS; de signerade byten är DER-certifikatets första
  element, som OTP:s exklusiva avkodning ger dem. `pkix_sign_types/1`,
  `pkix_hash_type/1`.
- `short_name_hash/1`: OpenSSL:s `c_rehash`-hashvärde för ett namn.
- `dh_gex_group/4`, `dh_gex_group_sizes/0`: OTP:s urval bland grupper;
  standardgrupperna är åtta per storlek från OpenSSH:s moduli-fil
  (`clause_public_key_moduli`), med de storlekar OTP har
  ([skillnader](differences.md#asn1)). `ssh_curvename2oid/1`,
  `oid2ssh_curvename/1`, `handle_trace/3`.

OTP:s egenheter behålls: en ML-DSA-nyckel som `generate_key/1` skapar har ett
tomt frö, som `crypto` vägrar signera med; en privat DSA-nyckel kan inte
verifiera; explicita primtalsfältskurvor misslyckas när deras primtal avkodas.
Referenstestet `public_key_keys` jämför deterministiska signaturer (RSA
PKCS #1, EdDSA, certifikat), kryptering, nyckelöverenskommelse, typer,
hashvärden och gruppurval med OTP.
