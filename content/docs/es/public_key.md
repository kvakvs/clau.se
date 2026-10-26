---
source: docs/public_key.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b488261ff871b69e1f5ccbf5ba160afcad4a9521574673ac0d630571c404b268
translatedAt: 2026-10-26
---
# public_key

La aplicación `public_key` de Clause se construye a partir de dos partes: los
módulos ASN.1 que codifican y decodifican los tipos PKIX y PKCS, que clau genera
desde las especificaciones de `library/public_key/asn1/`, y la cabecera
`library/public_key/include/public_key.hrl`, y el módulo `public_key`, que tiene
las exportaciones de OTP 29: su códec DER y PEM y las claves y firmas están
implementados; la validación aún genera `{not_implemented, Name, Arity}`
([inventario](../library/public_key/public_key.terms)).

## Especificaciones

`library/public_key/asn1/` contiene los módulos que compila `public_key` de OTP,
con los mismos nombres:

| Fuente | Módulos |
| --- | --- |
| RFC 5912 (PKIX, ASN.1 de 2009) | `AlgorithmInformation-2009`, `AttributeCertificateVersion1-2009`, `EnrollmentMessageSyntax-2009`, `PKCS-10`, `PKIX-CommonTypes-2009`, `PKIX-X400Address-2009`, `PKIX1-PSS-OAEP-Algorithms-2009`, `PKIX1Explicit-2009`, `PKIX1Implicit-2009`, `PKIXAlgs-2009`, `PKIXAttributeCertificate-2009`, `PKIXCRMF-2009` |
| RFC 5911 (CMS y S/MIME) | `CryptographicMessageSyntax-2009`, `CryptographicMessageSyntaxAlgorithms-2009`, `CMSAesRsaesOaep-2009`, `SecureMimeMessageV3dot1-2009` |
| RFC 5915, 5958, 8017, 8018, 8410, 9629, 9654, 9810, 9814, 9881, 9935 | `ECPrivateKey`, `AsymmetricKeyPackageModuleV1`, `PKCS-1`, `PKCS5v2-0`, `Safecurves-pkix-18`, `KEMAlgorithmInformation-2023`, `OCSP-2024-08`, `PKIXCMP-2023`, `SLH-DSA-Module-2024`, `X509-ML-DSA-2025`, `X509-ML-KEM-2025` |
| Escritos para Clause | `OTP-PKIX` y `OTP-PKIX-Relaxed` (las formas de `OTPCertificate`), `DSS` (`DSAPrivateKey`), `PKCS-3` (`DHParameter`), `RFC5639` (identificadores de curvas Brainpool), `PKCS-FRAME.set.asn` (`AsymmetricKeyPackageModuleV1` con `PKCS5v2-0`) |

Cada módulo RFC es el componente de código de su RFC con el aviso BSD del IETF
Trust, y el texto del módulo sin cambios salvo donde difiere el módulo de OTP;
esas modificaciones se enumeran al principio del archivo (`PKCS-1`, `PKCS5v2-0`,
`ECPrivateKey`, `PKIX1Explicit-2009`, `PKIXAlgs-2009`, `PKIXCMP-2023`). Los
módulos generan los mismos módulos y cabeceras Erlang que las especificaciones
de OTP.

## Módulos generados

La compilación ejecuta `clau --generate-asn1` con las opciones de OTP (`ber`,
`der`, `noobj`) sobre las especificaciones y escribe los módulos (`'OTP-PKIX'`,
`'PKIX1Explicit-2009'`, ...) en `library-asn1/public_key/` del árbol de
compilación, una segunda raíz de biblioteca después de `library/`
([biblioteca](library.md#how-programs-get-them)): un programa que menciona uno lo
incorpora compilado a su lote como cualquier módulo de biblioteca. Como en OTP,
los módulos que combina `PKCS-FRAME` (`AsymmetricKeyPackageModuleV1`,
`PKCS5v2-0`) no son módulos independientes. Sus codificaciones, decodificaciones
y records son los de asn1ct ([ASN.1](asn1.md)); no se generan las funciones de
decodificación exclusiva de `asn1config` de OTP (`decode_TBSCert_exclusive/1`).

## Cabecera

`-include_lib("public_key/include/public_key.hrl")` se resuelve a la cabecera de
Clause, salvo que un proyecto nombre su propia aplicación `public_key`. Define
los records y macros de la de OTP: la mayoría son los records y valores que
generan las especificaciones; los demás son los records que construye el propio
`public_key` (`'Certificate'` en su forma anterior a 2009, `'ECPoint'`, las
claves ML-DSA, ML-KEM y SLH-DSA, `#cert{}`) y los identificadores de objeto que
menciona. La prueba de referencia `public_key_records` comprueba los campos y
valores predeterminados de cada record y el valor de cada macro frente a la
cabecera de OTP; `public_key_asn1` decodifica y codifica certificados, claves y
parámetros mediante los módulos generados.

## Funciones

`public_key` (con [`public_key.app`](../library/public_key/public_key.app) y un
`asn1.app` para la aplicación de la que depende) delega sus funciones de códec
en `clause_public_key_codec`, que incluye `public_key.hrl`; los recorridos de
records y las tablas de identificadores de objeto de `pubkey_translation` y
`pubkey_cert_records` de OTP son funciones integradas del entorno de ejecución
([clave pública](builtins.md#public-key)).

- `der_decode/2`, `der_encode/2`: el módulo generado del tipo, elegido como en
  OTP; `PrivateKeyInfo` y `OneAsymmetricKey` de PKCS #8 se desenvuelven en
  claves RSA (también RSASSA-PSS con sus parámetros), DSA, EC, Ed25519/Ed448,
  ML-DSA, ML-KEM y SLH-DSA, y se vuelven a envolver; `EcpkParameters`,
  `Dss-Sig-Value`, `AttributeTypeAndValue`, `ExtensionRequest` y los tipos de
  extensión (`'SubjectAltName'`, `'CRLReason'`, ...) se codifican como en OTP;
  errores como los de OTP (`{badmatch, {error, {asn1, Reason}}}`,
  `{badarg, {unknown_type, Type}}`).
- `pem_decode/1`, `pem_encode/1`: etiquetas y líneas de OTP (64 caracteres, se
  aceptan `CRLF` y espacios en blanco finales, se omiten las demás líneas); una
  entrada `ENCRYPTED PRIVATE KEY` se decodifica como
  `{'PrivateKeyInfo', Encrypted, CipherInfo}`.
- `pem_entry_decode/1,2`, `pem_entry_encode/2,3`: entradas
  `SubjectPublicKeyInfo` de todos los tipos de clave; cifrado con contraseña
  mediante el esquema heredado `Proc-Type`/`DEK-Info` de OpenSSL (derivación de
  clave con MD5), PKCS #5 PBES1 (PBKDF1) y PBES2 (PBKDF2 con
  HMAC-SHA1/224/256/384/512) sobre `crypto`, con los cifrados `DES-CBC`,
  `DES-EDE3-CBC`, `RC2-CBC` y `AES-128/192/256-CBC` (los que proporcione el
  OpenSSL enlazado).
- `pkix_decode_cert/2` en las formas `plain`, `otp` y `relaxed` (la forma otp
  con su clave pública y extensiones decodificadas, los puntos de distribución
  de CRL se dejan codificados, los avisos de usuario largos se recortan a 350
  caracteres como hace OTP), `pkix_encode/3` en las formas `plain` y `otp`.

La prueba de referencia `public_key_codec` compara todo esto con OTP, incluido
el texto PEM de las entradas cifradas.

## Claves y firmas

`clause_public_key_keys` convierte los records de claves en listas de claves de
[`crypto`](crypto.md) como hace OTP y lo invoca:

| Clave | Algoritmo de crypto |
| --- | --- |
| `#'RSAPrivateKey'{}` (todos los componentes CRT, o solo `[E, N, D]`), `{RSAKey, PssParams}`; `#'RSAPublicKey'{}` | `rsa` |
| `#'DSAPrivateKey'{}`; `{Y, #'Dss-Parms'{}}` | `dss` |
| `#'ECPrivateKey'{}` con parámetros con nombre o explícitos; `{#'ECPoint'{}, Params}` | `ecdsa` |
| Ed25519/Ed448 `#'ECPrivateKey'{}`, `{ed_pri, Curve, Pub, Priv}`; `{#'ECPoint'{}, {namedCurve, Oid}}`, `{ed_pub, Curve, Key}` | `eddsa` |
| `#'ML-DSAPrivateKey'{}` (semilla o, en su defecto, clave expandida), `#'SLH-DSAPrivateKey'{}`; sus claves públicas | el conjunto de parámetros |
| Un map con `sign_fun` o `encrypt_fun` | se llama a la fun |

- `sign/3,4`, `verify/4,5` (una clave DSA con tipo de resumen `none` firma un
  resumen SHA-1; una firma que no es un binary se verifica como `false`; una
  clave de tipo desconocido genera `badarg`), `encrypt_private/2,3`,
  `decrypt_public/2,3`, `encrypt_public/2,3`, `decrypt_private/2,3` (relleno de
  `rsa_pad`, `rsa_padding` o la primera opción de tipo átomo; PKCS #1 por
  defecto).
- `generate_key/1`: DH, EC en curvas con nombre y explícitas (parámetros
  normalizados al OID de la curva), X25519/X448, Ed25519/Ed448, RSA, ML-DSA y
  SLH-DSA; `compute_key/2,3`: ECDH, X25519/X448 y DH.
- `pkix_sign/2` y `pkix_verify/2` para todos los algoritmos de firma que conoce
  OTP, incluido RSASSA-PSS; los bytes firmados son el primer elemento del
  certificado DER, tal como los proporciona la decodificación exclusiva de OTP.
  `pkix_sign_types/1`, `pkix_hash_type/1`.
- `short_name_hash/1`: hash `c_rehash` de OpenSSL de un nombre.
- `dh_gex_group/4`, `dh_gex_group_sizes/0`: selección de grupos de OTP; los
  grupos predeterminados son ocho por tamaño del archivo de módulos de OpenSSH
  (`clause_public_key_moduli`), con los tamaños de OTP
  ([diferencias](differences.md#asn1)). `ssh_curvename2oid/1`,
  `oid2ssh_curvename/1`, `handle_trace/3`.

Se conservan las peculiaridades de OTP: una clave ML-DSA creada por
`generate_key/1` tiene una semilla vacía, con la que `crypto` se niega a firmar;
una clave privada DSA no puede verificar; las curvas explícitas de cuerpo primo
fallan al decodificar su primo. La prueba de referencia `public_key_keys`
compara con OTP las firmas deterministas (RSA PKCS #1, EdDSA, certificados),
el cifrado, el acuerdo de claves, los tipos, los hashes y la selección de grupos.
