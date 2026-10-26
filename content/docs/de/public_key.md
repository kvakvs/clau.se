---
source: docs/public_key.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b488261ff871b69e1f5ccbf5ba160afcad4a9521574673ac0d630571c404b268
translatedAt: 2026-10-26
---
# public_key

Clauses Anwendung `public_key` besteht aus zwei Teilen: den ASN.1-Modulen, die
die PKIX- und PKCS-Typen kodieren und dekodieren und die clau aus den
Spezifikationen in `library/public_key/asn1/` generiert, zusammen mit dem Header
`library/public_key/include/public_key.hrl`, sowie dem Modul `public_key`, das
die Exporte von OTP 29 besitzt: Sein DER- und PEM-Codec sowie Schlüssel und
Signaturen sind implementiert; die Validierung löst weiterhin
`{not_implemented, Name, Arity}` aus
([Bestandsverzeichnis](../library/public_key/public_key.terms)).

## Spezifikationen

`library/public_key/asn1/` enthält die Module, die OTPs `public_key` kompiliert,
unter denselben Namen:

| Quelle | Module |
| --- | --- |
| RFC 5912 (PKIX, ASN.1 von 2009) | `AlgorithmInformation-2009`, `AttributeCertificateVersion1-2009`, `EnrollmentMessageSyntax-2009`, `PKCS-10`, `PKIX-CommonTypes-2009`, `PKIX-X400Address-2009`, `PKIX1-PSS-OAEP-Algorithms-2009`, `PKIX1Explicit-2009`, `PKIX1Implicit-2009`, `PKIXAlgs-2009`, `PKIXAttributeCertificate-2009`, `PKIXCRMF-2009` |
| RFC 5911 (CMS und S/MIME) | `CryptographicMessageSyntax-2009`, `CryptographicMessageSyntaxAlgorithms-2009`, `CMSAesRsaesOaep-2009`, `SecureMimeMessageV3dot1-2009` |
| RFC 5915, 5958, 8017, 8018, 8410, 9629, 9654, 9810, 9814, 9881, 9935 | `ECPrivateKey`, `AsymmetricKeyPackageModuleV1`, `PKCS-1`, `PKCS5v2-0`, `Safecurves-pkix-18`, `KEMAlgorithmInformation-2023`, `OCSP-2024-08`, `PKIXCMP-2023`, `SLH-DSA-Module-2024`, `X509-ML-DSA-2025`, `X509-ML-KEM-2025` |
| Für Clause geschrieben | `OTP-PKIX` und `OTP-PKIX-Relaxed` (die `OTPCertificate`-Formen), `DSS` (`DSAPrivateKey`), `PKCS-3` (`DHParameter`), `RFC5639` (Brainpool-Kurvenkennungen), `PKCS-FRAME.set.asn` (`AsymmetricKeyPackageModuleV1` mit `PKCS5v2-0`) |

Jedes RFC-Modul ist der Codebestandteil seines RFC mit dem BSD-Hinweis des IETF
Trust; der Modultext ist unverändert, außer wo OTPs Modul abweicht. Diese
Änderungen sind am Dateianfang aufgeführt (`PKCS-1`, `PKCS5v2-0`, `ECPrivateKey`,
`PKIX1Explicit-2009`, `PKIXAlgs-2009`, `PKIXCMP-2023`). Die Module generieren
dieselben Erlang-Module und Header wie OTPs Spezifikationen.

## Generierte Module

Der Build führt `clau --generate-asn1` mit OTPs Optionen (`ber`, `der`, `noobj`)
für die Spezifikationen aus und schreibt die Module (`'OTP-PKIX'`,
`'PKIX1Explicit-2009'`, ...) nach `library-asn1/public_key/` im Build-Verzeichnis,
einem zweiten Bibliothekswurzelverzeichnis nach `library/`
([Bibliothek](library.md#how-programs-get-them)): Nennt ein Programm eines davon,
wird es wie jedes Bibliotheksmodul in seinen Stapel kompiliert. Wie bei OTP sind
die von `PKCS-FRAME` zusammengeführten Module (`AsymmetricKeyPackageModuleV1`,
`PKCS5v2-0`) keine eigenständigen Module. Ihre Kodierungen, Dekodierungen und
records entsprechen denen von asn1ct ([ASN.1](asn1.md)); OTPs exklusive
Dekodierungsfunktionen aus `asn1config` (`decode_TBSCert_exclusive/1`) werden
nicht generiert.

## Header

`-include_lib("public_key/include/public_key.hrl")` wird auf Clauses Header
aufgelöst, sofern ein Projekt keine eigene Anwendung `public_key` nennt. Er
definiert die records und Makros aus OTPs Header: Die meisten sind die von den
Spezifikationen generierten records und Werte, die übrigen die von `public_key`
selbst angelegten records (`'Certificate'` in seiner Form vor 2009, `'ECPoint'`,
die ML-DSA-, ML-KEM- und SLH-DSA-Schlüssel, `#cert{}`) und die darin genannten
Objektkennungen. Der Referenztest `public_key_records` prüft die Felder und
Standardwerte jedes records sowie den Wert jedes Makros gegen OTPs Header;
`public_key_asn1` dekodiert und kodiert Zertifikate, Schlüssel und Parameter über
die generierten Module.

## Funktionen

`public_key` (mit [`public_key.app`](../library/public_key/public_key.app) und
einer `asn1.app` für die Anwendung, von der es abhängt) leitet seine
Codec-Funktionen an `clause_public_key_codec` weiter, das `public_key.hrl`
einbindet; die record-Durchläufe und Objektkennungstabellen von OTPs
`pubkey_translation` und `pubkey_cert_records` sind Laufzeit-Builtins
([öffentliche Schlüssel](builtins.md#public-key)).

- `der_decode/2`, `der_encode/2`: das generierte Modul des Typs, wie OTP es
  auswählt; PKCS #8 `PrivateKeyInfo` und `OneAsymmetricKey` werden in RSA- (auch
  RSASSA-PSS mit seinen Parametern), DSA-, EC-, Ed25519/Ed448-, ML-DSA-, ML-KEM-
  und SLH-DSA-Schlüssel entpackt und wieder verpackt; `EcpkParameters`,
  `Dss-Sig-Value`, `AttributeTypeAndValue`, `ExtensionRequest` und
  Erweiterungstypen (`'SubjectAltName'`, `'CRLReason'`, ...) werden wie bei OTP
  kodiert; Fehler wie bei OTP (`{badmatch, {error, {asn1, Reason}}}`,
  `{badarg, {unknown_type, Type}}`).
- `pem_decode/1`, `pem_encode/1`: OTPs Bezeichnungen und Zeilen (64 Zeichen,
  `CRLF` und abschließende Leerzeichen akzeptiert, andere Zeilen übersprungen);
  ein Eintrag `ENCRYPTED PRIVATE KEY` wird zu
  `{'PrivateKeyInfo', Encrypted, CipherInfo}` dekodiert.
- `pem_entry_decode/1,2`, `pem_entry_encode/2,3`: `SubjectPublicKeyInfo`-Einträge
  jedes Schlüsseltyps; Passwortverschlüsselung nach OpenSSLs altem
  `Proc-Type`/`DEK-Info`-Schema (MD5-Schlüsselableitung), PKCS #5 PBES1 (PBKDF1)
  und PBES2 (PBKDF2 mit HMAC-SHA1/224/256/384/512) über `crypto`, mit den Chiffren
  `DES-CBC`, `DES-EDE3-CBC`, `RC2-CBC` und `AES-128/192/256-CBC` (soweit vom
  gelinkten OpenSSL bereitgestellt).
- `pkix_decode_cert/2` in den Formen `plain`, `otp` und `relaxed` (die otp-Form
  mit dekodiertem öffentlichem Schlüssel und dekodierten Erweiterungen,
  CRL-Verteilungspunkte bleiben kodiert, lange Benutzerhinweise werden wie bei
  OTP auf 350 Zeichen gekürzt), `pkix_encode/3` in den Formen `plain` und `otp`.

Der Referenztest `public_key_codec` vergleicht all dies mit OTP, einschließlich
des PEM-Texts verschlüsselter Einträge.

## Schlüssel und Signaturen

`clause_public_key_keys` wandelt Schlüssel-records wie OTP in die Schlüssellisten
von [`crypto`](crypto.md) um und ruft es auf:

| Schlüssel | crypto-Algorithmus |
| --- | --- |
| `#'RSAPrivateKey'{}` (alle CRT-Komponenten oder nur `[E, N, D]`), `{RSAKey, PssParams}`; `#'RSAPublicKey'{}` | `rsa` |
| `#'DSAPrivateKey'{}`; `{Y, #'Dss-Parms'{}}` | `dss` |
| `#'ECPrivateKey'{}` mit benannten oder expliziten Parametern; `{#'ECPoint'{}, Params}` | `ecdsa` |
| Ed25519/Ed448 `#'ECPrivateKey'{}`, `{ed_pri, Curve, Pub, Priv}`; `{#'ECPoint'{}, {namedCurve, Oid}}`, `{ed_pub, Curve, Key}` | `eddsa` |
| `#'ML-DSAPrivateKey'{}` (Seed, andernfalls expandierter Schlüssel), `#'SLH-DSAPrivateKey'{}`; ihre öffentlichen Schlüssel | der Parametersatz |
| Eine map mit `sign_fun` oder `encrypt_fun` | die fun wird aufgerufen |

- `sign/3,4`, `verify/4,5` (ein DSA-Schlüssel mit Digest-Typ `none` signiert
  einen SHA-1-Digest; eine Signatur, die kein binary ist, ergibt bei der Prüfung
  `false`; ein Schlüssel ohne passenden Typ löst `badarg` aus),
  `encrypt_private/2,3`, `decrypt_public/2,3`, `encrypt_public/2,3`,
  `decrypt_private/2,3` (Padding aus `rsa_pad`, `rsa_padding` oder der ersten
  Atom-Option, standardmäßig PKCS #1).
- `generate_key/1`: DH, EC auf benannten und expliziten Kurven (Parameter auf
  die OID der Kurve normalisiert), X25519/X448, Ed25519/Ed448, RSA, ML-DSA und
  SLH-DSA; `compute_key/2,3`: ECDH, X25519/X448 und DH.
- `pkix_sign/2` und `pkix_verify/2` für jeden OTP bekannten Signaturalgorithmus,
  einschließlich RSASSA-PSS; die signierten Bytes sind das erste Element des
  DER-Zertifikats, wie OTPs exklusive Dekodierung sie liefert.
  `pkix_sign_types/1`, `pkix_hash_type/1`.
- `short_name_hash/1`: OpenSSLs `c_rehash`-Hash eines Namens.
- `dh_gex_group/4`, `dh_gex_group_sizes/0`: OTPs Gruppenauswahl; die
  Standardgruppen sind acht pro Größe aus OpenSSHs Moduli-Datei
  (`clause_public_key_moduli`), mit den Größen von OTP
  ([Unterschiede](differences.md#asn1)). `ssh_curvename2oid/1`,
  `oid2ssh_curvename/1`, `handle_trace/3`.

OTPs Eigenheiten bleiben erhalten: Ein von `generate_key/1` erzeugter
ML-DSA-Schlüssel hat einen leeren Seed, mit dem `crypto` das Signieren verweigert;
ein privater DSA-Schlüssel kann nicht verifizieren; bei expliziten Kurven über
Primkörpern scheitert die Dekodierung ihrer Primzahl. Der Referenztest
`public_key_keys` vergleicht deterministische Signaturen (RSA PKCS #1, EdDSA,
Zertifikate), Verschlüsselung, Schlüsselvereinbarung, Typen, Hashes und
Gruppenauswahl mit OTP.
