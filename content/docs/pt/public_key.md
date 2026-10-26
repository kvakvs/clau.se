---
source: docs/public_key.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b488261ff871b69e1f5ccbf5ba160afcad4a9521574673ac0d630571c404b268
translatedAt: 2026-10-26
---
# public_key

A aplicação `public_key` do Clause é composta por duas partes: os módulos
ASN.1 que codificam e descodificam os tipos PKIX e PKCS, que o clau gera a
partir das especificações em `library/public_key/asn1/`, e o cabeçalho
`library/public_key/include/public_key.hrl`, e o módulo `public_key`, que tem
as exportações do OTP 29: o seu codificador/descodificador DER e PEM e as chaves
e assinaturas estão implementados; a validação continua a gerar
`{not_implemented, Name, Arity}`
([inventário](../library/public_key/public_key.terms)).

## Especificações

`library/public_key/asn1/` contém os módulos que o `public_key` do OTP compila,
com os mesmos nomes:

| Origem | Módulos |
| --- | --- |
| RFC 5912 (PKIX, ASN.1 de 2009) | `AlgorithmInformation-2009`, `AttributeCertificateVersion1-2009`, `EnrollmentMessageSyntax-2009`, `PKCS-10`, `PKIX-CommonTypes-2009`, `PKIX-X400Address-2009`, `PKIX1-PSS-OAEP-Algorithms-2009`, `PKIX1Explicit-2009`, `PKIX1Implicit-2009`, `PKIXAlgs-2009`, `PKIXAttributeCertificate-2009`, `PKIXCRMF-2009` |
| RFC 5911 (CMS e S/MIME) | `CryptographicMessageSyntax-2009`, `CryptographicMessageSyntaxAlgorithms-2009`, `CMSAesRsaesOaep-2009`, `SecureMimeMessageV3dot1-2009` |
| RFC 5915, 5958, 8017, 8018, 8410, 9629, 9654, 9810, 9814, 9881, 9935 | `ECPrivateKey`, `AsymmetricKeyPackageModuleV1`, `PKCS-1`, `PKCS5v2-0`, `Safecurves-pkix-18`, `KEMAlgorithmInformation-2023`, `OCSP-2024-08`, `PKIXCMP-2023`, `SLH-DSA-Module-2024`, `X509-ML-DSA-2025`, `X509-ML-KEM-2025` |
| Escritos para o Clause | `OTP-PKIX` e `OTP-PKIX-Relaxed` (as formas de `OTPCertificate`), `DSS` (`DSAPrivateKey`), `PKCS-3` (`DHParameter`), `RFC5639` (identificadores de curvas Brainpool), `PKCS-FRAME.set.asn` (`AsymmetricKeyPackageModuleV1` com `PKCS5v2-0`) |

Cada módulo RFC é o componente de código do respetivo RFC com o aviso BSD do
IETF Trust, com o texto do módulo inalterado exceto onde o módulo do OTP difere;
essas alterações estão listadas no início do ficheiro (`PKCS-1`, `PKCS5v2-0`,
`ECPrivateKey`, `PKIX1Explicit-2009`, `PKIXAlgs-2009`, `PKIXCMP-2023`). Os
módulos geram os mesmos módulos Erlang e cabeçalhos que as especificações do
OTP.

## Módulos gerados

A compilação executa `clau --generate-asn1` com as opções do OTP (`ber`, `der`,
`noobj`) sobre as especificações e escreve os módulos (`'OTP-PKIX'`,
`'PKIX1Explicit-2009'`, ...) em `library-asn1/public_key/` na árvore de
compilação, uma segunda raiz de bibliotecas após `library/`
([biblioteca](library.md#how-programs-get-them)): um programa que nomeie um
deles faz com que seja compilado no seu lote como qualquer módulo de
biblioteca. Como no OTP, os módulos que `PKCS-FRAME` combina
(`AsymmetricKeyPackageModuleV1`, `PKCS5v2-0`) não são módulos autónomos. As
suas codificações, descodificações e records são os de asn1ct
([ASN.1](asn1.md)); as funções de descodificação exclusiva de `asn1config` do
OTP (`decode_TBSCert_exclusive/1`) não são geradas.

## Cabeçalho

`-include_lib("public_key/include/public_key.hrl")` resolve para o cabeçalho do
Clause, salvo se um projeto definir a sua própria aplicação `public_key`.
Define os records e macros do cabeçalho do OTP: a maioria são os records e
valores que as especificações geram; os restantes são os records que
`public_key` constrói por si (`'Certificate'` na sua forma anterior a 2009,
`'ECPoint'`, as chaves ML-DSA, ML-KEM e SLH-DSA, `#cert{}`) e os
identificadores de objetos que nomeia. O teste de referência
`public_key_records` verifica os campos e predefinições de cada record e o
valor de cada macro face ao cabeçalho do OTP; `public_key_asn1` descodifica e
codifica certificados, chaves e parâmetros através dos módulos gerados.

## Funções

`public_key` (com [`public_key.app`](../library/public_key/public_key.app), e
um `asn1.app` para a aplicação de que depende) encaminha as suas funções de
codificação e descodificação para `clause_public_key_codec`, que inclui
`public_key.hrl`; os percursos de records e as tabelas de identificadores de
objetos de `pubkey_translation` e `pubkey_cert_records` do OTP são funções
incorporadas do ambiente de execução ([chave pública](builtins.md#public-key)).

- `der_decode/2`, `der_encode/2`: o módulo gerado do tipo, tal como o OTP o
  escolhe; `PrivateKeyInfo` e `OneAsymmetricKey` de PKCS #8 desembrulhados em
  chaves RSA (também RSASSA-PSS com os seus parâmetros), DSA, EC, Ed25519/Ed448,
  ML-DSA, ML-KEM e SLH-DSA e embrulhados novamente; `EcpkParameters`,
  `Dss-Sig-Value`, `AttributeTypeAndValue`, `ExtensionRequest` e tipos de
  extensão (`'SubjectAltName'`, `'CRLReason'`, ...) tal como o OTP os codifica;
  erros como os do OTP (`{badmatch, {error, {asn1, Reason}}}`,
  `{badarg, {unknown_type, Type}}`).
- `pem_decode/1`, `pem_encode/1`: etiquetas e linhas do OTP (64 carateres,
  `CRLF` e espaços em branco finais aceites, outras linhas ignoradas); uma
  entrada `ENCRYPTED PRIVATE KEY` é descodificada para
  `{'PrivateKeyInfo', Encrypted, CipherInfo}`.
- `pem_entry_decode/1,2`, `pem_entry_encode/2,3`: entradas
  `SubjectPublicKeyInfo` de todos os tipos de chave; encriptação por
  palavra-passe pelo esquema antigo `Proc-Type`/`DEK-Info` do OpenSSL
  (derivação de chaves MD5), PKCS #5 PBES1 (PBKDF1) e PBES2 (PBKDF2 com
  HMAC-SHA1/224/256/384/512) sobre `crypto`, com as cifras `DES-CBC`,
  `DES-EDE3-CBC`, `RC2-CBC` e `AES-128/192/256-CBC` (as que o OpenSSL ligado
  disponibiliza).
- `pkix_decode_cert/2` nas formas `plain`, `otp` e `relaxed` (a forma otp com
  a sua chave pública e extensões descodificadas, os pontos de distribuição
  CRL deixados codificados, avisos de utilizador longos cortados a 350
  carateres, como faz o OTP), `pkix_encode/3` nas formas `plain` e `otp`.

O teste de referência `public_key_codec` compara tudo isto com o OTP,
incluindo o texto PEM das entradas encriptadas.

## Chaves e assinaturas

`clause_public_key_keys` transforma records de chaves em listas de chaves de
[`crypto`](crypto.md) como faz o OTP e chama-o:

| Chave | Algoritmo de crypto |
| --- | --- |
| `#'RSAPrivateKey'{}` (todos os componentes CRT, ou apenas `[E, N, D]`), `{RSAKey, PssParams}`; `#'RSAPublicKey'{}` | `rsa` |
| `#'DSAPrivateKey'{}`; `{Y, #'Dss-Parms'{}}` | `dss` |
| `#'ECPrivateKey'{}` com parâmetros nomeados ou explícitos; `{#'ECPoint'{}, Params}` | `ecdsa` |
| Ed25519/Ed448 `#'ECPrivateKey'{}`, `{ed_pri, Curve, Pub, Priv}`; `{#'ECPoint'{}, {namedCurve, Oid}}`, `{ed_pub, Curve, Key}` | `eddsa` |
| `#'ML-DSAPrivateKey'{}` (semente, ou, na sua ausência, chave expandida), `#'SLH-DSAPrivateKey'{}`; as suas chaves públicas | o conjunto de parâmetros |
| Um map com `sign_fun` ou `encrypt_fun` | a fun é chamada |

- `sign/3,4`, `verify/4,5` (uma chave DSA com tipo de resumo `none` assina um
  resumo SHA-1; uma assinatura que não seja um binary verifica como `false`;
  uma chave sem tipo reconhecido gera `badarg`), `encrypt_private/2,3`,
  `decrypt_public/2,3`, `encrypt_public/2,3`, `decrypt_private/2,3`
  (preenchimento de `rsa_pad`, `rsa_padding` ou da primeira opção átomo, PKCS
  #1 por predefinição).
- `generate_key/1`: DH, EC em curvas nomeadas e explícitas (parâmetros
  normalizados para o OID da curva), X25519/X448, Ed25519/Ed448, RSA, ML-DSA e
  SLH-DSA; `compute_key/2,3`: ECDH, X25519/X448 e DH.
- `pkix_sign/2` e `pkix_verify/2` para todos os algoritmos de assinatura que
  o OTP conhece, incluindo RSASSA-PSS; os bytes assinados são o primeiro
  elemento do certificado DER, tal como a descodificação exclusiva do OTP os
  fornece. `pkix_sign_types/1`, `pkix_hash_type/1`.
- `short_name_hash/1`: o hash `c_rehash` do OpenSSL de um nome.
- `dh_gex_group/4`, `dh_gex_group_sizes/0`: seleção de grupos do OTP; os
  grupos predefinidos são oito por tamanho do ficheiro de módulos do OpenSSH
  (`clause_public_key_moduli`), com os tamanhos que o OTP tem
  ([diferenças](differences.md#asn1)). `ssh_curvename2oid/1`,
  `oid2ssh_curvename/1`, `handle_trace/3`.

As particularidades do OTP são mantidas: uma chave ML-DSA criada por
`generate_key/1` tem uma semente vazia, com a qual `crypto` recusa assinar;
uma chave privada DSA não pode verificar; as curvas explícitas sobre corpos
primos falham ao descodificar o seu primo. O teste de referência
`public_key_keys` compara assinaturas determinísticas (RSA PKCS #1, EdDSA,
certificados), encriptação, acordo de chaves, tipos, hashes e seleção de grupos
com o OTP.
