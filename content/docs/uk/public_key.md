---
source: docs/public_key.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b488261ff871b69e1f5ccbf5ba160afcad4a9521574673ac0d630571c404b268
translatedAt: 2026-10-26
---
# public_key

Застосунок `public_key` у Clause складається з двох частин: модулів ASN.1,
що кодують і декодують типи PKIX і PKCS, які clau генерує зі специфікацій у
`library/public_key/asn1/`, та заголовка
`library/public_key/include/public_key.hrl`, і модуля `public_key`, який має
експорти OTP 29: його кодек DER і PEM та операції з ключами й підписами
реалізовано; перевірка чинності досі спричиняє
`{not_implemented, Name, Arity}` ([перелік](../library/public_key/public_key.terms)).

## Специфікації

`library/public_key/asn1/` містить модулі, які компілює `public_key` з OTP,
під тими самими назвами:

| Джерело | Модулі |
| --- | --- |
| RFC 5912 (PKIX, ASN.1 2009 року) | `AlgorithmInformation-2009`, `AttributeCertificateVersion1-2009`, `EnrollmentMessageSyntax-2009`, `PKCS-10`, `PKIX-CommonTypes-2009`, `PKIX-X400Address-2009`, `PKIX1-PSS-OAEP-Algorithms-2009`, `PKIX1Explicit-2009`, `PKIX1Implicit-2009`, `PKIXAlgs-2009`, `PKIXAttributeCertificate-2009`, `PKIXCRMF-2009` |
| RFC 5911 (CMS і S/MIME) | `CryptographicMessageSyntax-2009`, `CryptographicMessageSyntaxAlgorithms-2009`, `CMSAesRsaesOaep-2009`, `SecureMimeMessageV3dot1-2009` |
| RFC 5915, 5958, 8017, 8018, 8410, 9629, 9654, 9810, 9814, 9881, 9935 | `ECPrivateKey`, `AsymmetricKeyPackageModuleV1`, `PKCS-1`, `PKCS5v2-0`, `Safecurves-pkix-18`, `KEMAlgorithmInformation-2023`, `OCSP-2024-08`, `PKIXCMP-2023`, `SLH-DSA-Module-2024`, `X509-ML-DSA-2025`, `X509-ML-KEM-2025` |
| Написано для Clause | `OTP-PKIX` і `OTP-PKIX-Relaxed` (форми `OTPCertificate`), `DSS` (`DSAPrivateKey`), `PKCS-3` (`DHParameter`), `RFC5639` (ідентифікатори кривих Brainpool), `PKCS-FRAME.set.asn` (`AsymmetricKeyPackageModuleV1` з `PKCS5v2-0`) |

Кожен модуль RFC є компонентом коду свого RFC з повідомленням BSD від IETF
Trust; текст модуля незмінний, крім місць, де модуль OTP відрізняється; ці
зміни перелічено на початку файла (`PKCS-1`, `PKCS5v2-0`, `ECPrivateKey`,
`PKIX1Explicit-2009`, `PKIXAlgs-2009`, `PKIXCMP-2023`). Модулі генерують ті
самі модулі Erlang і заголовки, що й специфікації OTP.

## Згенеровані модулі

Збирання запускає `clau --generate-asn1` з параметрами OTP (`ber`, `der`,
`noobj`) для специфікацій і записує модулі (`'OTP-PKIX'`,
`'PKIX1Explicit-2009'`, ...) у `library-asn1/public_key/` в дереві збирання,
другий корінь бібліотеки після `library/`
([бібліотека](library.md#how-programs-get-them)): програма, яка вказує такий
модуль, отримує його скомпільованим у своєму пакеті, як будь-який бібліотечний
модуль. Як і в OTP, модулі, які об'єднує `PKCS-FRAME`
(`AsymmetricKeyPackageModuleV1`, `PKCS5v2-0`), не є окремими модулями. Їхні
кодування, декодування та record відповідають asn1ct ([ASN.1](asn1.md));
функції вибіркового декодування `asn1config` з OTP
(`decode_TBSCert_exclusive/1`) не генеруються.

## Заголовок

`-include_lib("public_key/include/public_key.hrl")` знаходить заголовок Clause,
якщо проєкт не задає власний застосунок `public_key`. Він визначає ті самі
record і макроси, що й OTP: більшість — record і значення, згенеровані зі
специфікацій, решта — record, які `public_key` будує сам (`'Certificate'` у
формі до 2009 року, `'ECPoint'`, ключі ML-DSA, ML-KEM і SLH-DSA, `#cert{}`),
та ідентифікатори об'єктів, на які він посилається. Еталонний тест
`public_key_records` звіряє поля й типові значення кожного record та значення
кожного макросу із заголовком OTP; `public_key_asn1` декодує та кодує
сертифікати, ключі й параметри через згенеровані модулі.

## Функції

`public_key` (із [`public_key.app`](../library/public_key/public_key.app) та
`asn1.app` для застосунку, від якого він залежить) передає свої функції кодека
до `clause_public_key_codec`, який включає `public_key.hrl`; обходи record і
таблиці ідентифікаторів об'єктів із `pubkey_translation` та
`pubkey_cert_records` в OTP є вбудованими функціями runtime
([відкриті ключі](builtins.md#public-key)).

- `der_decode/2`, `der_encode/2`: згенерований модуль типу, вибраний так само,
  як в OTP; PKCS #8 `PrivateKeyInfo` та `OneAsymmetricKey` розгортаються в
  ключі RSA (також RSASSA-PSS з його параметрами), DSA, EC, Ed25519/Ed448,
  ML-DSA, ML-KEM і SLH-DSA та згортаються назад; `EcpkParameters`,
  `Dss-Sig-Value`, `AttributeTypeAndValue`, `ExtensionRequest` і типи
  розширень (`'SubjectAltName'`, `'CRLReason'`, ...) кодуються як в OTP;
  помилки як в OTP (`{badmatch, {error, {asn1, Reason}}}`,
  `{badarg, {unknown_type, Type}}`).
- `pem_decode/1`, `pem_encode/1`: мітки та рядки OTP (64 символи, `CRLF` і
  кінцеві пробільні символи приймаються, інші рядки пропускаються); запис
  `ENCRYPTED PRIVATE KEY` декодується в
  `{'PrivateKeyInfo', Encrypted, CipherInfo}`.
- `pem_entry_decode/1,2`, `pem_entry_encode/2,3`: записи
  `SubjectPublicKeyInfo` кожного типу ключів; шифрування паролем за застарілою
  схемою OpenSSL `Proc-Type`/`DEK-Info` (виведення ключа за MD5), PKCS #5
  PBES1 (PBKDF1) та PBES2 (PBKDF2 з HMAC-SHA1/224/256/384/512) через
  `crypto`, із шифрами `DES-CBC`, `DES-EDE3-CBC`, `RC2-CBC` та
  `AES-128/192/256-CBC` (які надає скомпонована OpenSSL).
- `pkix_decode_cert/2` у формах `plain`, `otp` і `relaxed` (форма otp із
  декодованими відкритим ключем і розширеннями, точки розповсюдження CRL
  залишаються закодованими, довгі повідомлення користувача обрізаються до
  350 символів, як в OTP), `pkix_encode/3` у формах `plain` і `otp`.

Еталонний тест `public_key_codec` порівнює все це з OTP, зокрема текст PEM
зашифрованих записів.

## Ключі та підписи

`clause_public_key_keys` перетворює record ключів на списки ключів
[`crypto`](crypto.md), як в OTP, і викликає його:

| Ключ | Алгоритм crypto |
| --- | --- |
| `#'RSAPrivateKey'{}` (усі компоненти CRT або лише `[E, N, D]`), `{RSAKey, PssParams}`; `#'RSAPublicKey'{}` | `rsa` |
| `#'DSAPrivateKey'{}`; `{Y, #'Dss-Parms'{}}` | `dss` |
| `#'ECPrivateKey'{}` з іменованими або явними параметрами; `{#'ECPoint'{}, Params}` | `ecdsa` |
| Ed25519/Ed448 `#'ECPrivateKey'{}`, `{ed_pri, Curve, Pub, Priv}`; `{#'ECPoint'{}, {namedCurve, Oid}}`, `{ed_pub, Curve, Key}` | `eddsa` |
| `#'ML-DSAPrivateKey'{}` (початкове значення, інакше розгорнутий ключ), `#'SLH-DSAPrivateKey'{}`; їхні відкриті ключі | набір параметрів |
| Map із `sign_fun` або `encrypt_fun` | викликається fun |

- `sign/3,4`, `verify/4,5` (ключ DSA з типом гешу `none` підписує геш SHA-1;
  перевірка підпису, що не є binary, повертає `false`; ключ жодного відомого
  виду спричиняє `badarg`), `encrypt_private/2,3`, `decrypt_public/2,3`,
  `encrypt_public/2,3`, `decrypt_private/2,3` (доповнення з `rsa_pad`,
  `rsa_padding` або першого параметра-атома, типово PKCS #1).
- `generate_key/1`: DH, EC на іменованих і явних кривих (параметри
  нормалізуються до OID кривої), X25519/X448, Ed25519/Ed448, RSA, ML-DSA та
  SLH-DSA; `compute_key/2,3`: ECDH, X25519/X448 і DH.
- `pkix_sign/2` та `pkix_verify/2` для кожного відомого OTP алгоритму підпису,
  включно з RSASSA-PSS; підписувані байти — перший елемент сертифіката DER,
  як їх надає вибіркове декодування OTP. `pkix_sign_types/1`,
  `pkix_hash_type/1`.
- `short_name_hash/1`: геш імені `c_rehash` з OpenSSL.
- `dh_gex_group/4`, `dh_gex_group_sizes/0`: вибір серед груп як в OTP; типові
  групи — по вісім на розмір із файла модулів OpenSSH
  (`clause_public_key_moduli`), розміри як в OTP
  ([відмінності](differences.md#asn1)). `ssh_curvename2oid/1`,
  `oid2ssh_curvename/1`, `handle_trace/3`.

Особливості OTP збережено: ключ ML-DSA, створений `generate_key/1`, має
порожнє початкове значення, з яким `crypto` відмовляється підписувати;
закритий ключ DSA не може перевіряти підпис; декодування простого числа
явних кривих над простим полем завершується помилкою. Еталонний тест
`public_key_keys` порівнює з OTP детерміновані підписи (RSA PKCS #1, EdDSA,
сертифікати), шифрування, узгодження ключів, типи, геші та вибір груп.
