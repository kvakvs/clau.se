---
source: docs/crypto.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 1713219c9c04cba4db60a95d49dd0d38365ce9026ca10d36ed4d0d602b55f99b
translatedAt: 2026-10-26
---
# Crypto: OpenSSL, compilação e FIPS

O `crypto` do Clause corresponde ao módulo `crypto` do OTP sobre a libcrypto do
OpenSSL. Esta nota descreve que OpenSSL é usado e como é encontrado, como o Clause
e o `clau` o compilam a partir do código-fonte, como os programas o ligam e o modo
FIPS. As funções incorporadas são descritas em [funções incorporadas](builtins.md#crypto-module),
o módulo de biblioteca em [biblioteca](library.md) e as diferenças observáveis
face ao OTP em [diferenças](differences.md#crypto).
As chaves e assinaturas de `public_key` chamam-no
([public_key](public_key.md#keys-and-signatures)).

## Versões do OpenSSL

- **Versão fixada: 4.1.0.** A versão que o Clause descarrega e compila quando não
  é indicado outro OpenSSL.
- **Mínimo: 3.1.2.** A versão mais recente cujo fornecedor FIPS está validado
  (certificado FIPS 140-3 #4985). Qualquer libcrypto a partir de 3.1.2 pode ser
  ligada ao arquivo crypto: as funções incorporadas usam apenas a API presente
  em 3.1.2 e resolvem as diferenças de versão em execução, pelo que um único
  arquivo serve todas essas libcrypto. Cabeçalhos mais recentes podem ainda
  associar um nome antigo a uma função mais recente (`EVP_MD_CTX_get_size` de
  4.1 é `EVP_MD_CTX_get_size_ex` de 3.4), pelo que o arquivo evita esses nomes;
  a bateria completa de testes liga os testes de referência de crypto a uma
  libcrypto compilada a partir do código-fonte de 3.1.2.
- **Os algoritmos são detetados, não presumidos.** A primeira chamada a `crypto`
  carrega os fornecedores (`fips` quando pode ser carregado, depois `default`,
  `base` e `legacy`, como faz o OTP) e obtém cada resumo criptográfico, cifra e
  MAC das tabelas do OTP; `crypto:supports/0,1`, `hash_info/1`, `info/0` e
  `info_lib/0` indicam o que o OpenSSL ligado disponibiliza. Um programa ligado
  a 3.1.2 simplesmente lista menos algoritmos (sem ML-KEM, ML-DSA ou SLH-DSA).

O OpenSSL tem licença Apache-2.0; nenhum ficheiro do OpenSSL é incluído no
repositório.

## De onde vem o OpenSSL do Clause

O CMake (`cmake/OpenSSLDependencies.cmake`) resolve a libcrypto para o arquivo
crypto pela seguinte ordem:

1. `-DCLAUSE_OPENSSL_ROOT=<path>`: um prefixo de instalação
   (`include/openssl/opensslv.h`) ou uma árvore de código-fonte (`Configure`,
   `VERSION.dat`), que é compilada como em 3.
2. Um OpenSSL ≥ 3.1.2 instalado (`CLAUSE_OPENSSL_SYSTEM`, ON por predefinição
   exceto em Windows): `find_package(OpenSSL)`, com preferência pela libcrypto
   estática.
3. A versão fixada, descarregada para `thirdparty/openssl-4.1.0` e verificada
   (`openssl-4.1.0.tar.gz`, SHA-256
   `50c17baf54cb008f6ce42d50deb4b28050a1aad711636cabd4b241c7e90cc2fd`),
   configurada e compilada uma vez em
   `thirdparty/openssl-4.1.0-<arch>-<crt>/install` (recompilada quando o
   compilador ou as opções mudam); `-DCLAUSE_DOWNLOAD_OPENSSL=OFF` desativa a
   transferência.

`-DCLAUSE_RUNTIME_CRYPTO=OFF` exclui por completo o arquivo crypto. Com os testes
ativados, a configuração também descarrega o código-fonte de 3.1.2
(`openssl-3.1.2.tar.gz`, SHA-256
`a0ce69b8b97ea6a35b96875235aa453b966ba3cba8af2de23657d8b6767d6539`) para
`thirdparty/openssl-3.1.2`, para os testes da bateria completa;
`-DCLAUSE_TEST_OPENSSL_MINIMUM=OFF` ignora-o e ignora esses testes.

## Compilar o OpenSSL a partir do código-fonte

Uma compilação a partir do código-fonte produz uma libcrypto estática com o
fornecedor legacy incorporado (que as funções incorporadas carregam como o OTP):

```
Configure <target> no-shared no-module no-tests no-docs no-makedepend enable-ec_explicit_curves
          [enable-static-vcruntime] [--debug] --prefix=<install> --openssldir=<install>/ssl --libdir=lib
make build_libs && make install_dev
```

- **Compilador e ambiente de execução.** O compilador C do CMake compila-a
  (`CC`); `enable-static-vcruntime` seleciona `/MT` quando a compilação usa o
  ambiente de execução estático do MSVC, e `--debug` seleciona o de Debug.
- **Ferramentas de Windows.** O Configure precisa de Perl nativo e NASM: as
  versões fixadas Strawberry Perl 5.42.3.1 portátil (SHA-256
  `6a081a811781c30aca51dbc036afd93092af91e3297901f02c17043795a10690`) e NASM
  3.02 (SHA-256
  `161d0bfaff53c2f9e9f3e69fd0672323ebabafd1268976a5cec11be92a19aee7`) são
  descarregadas para `thirdparty/tools/`. O `nmake` compila depois em série
  (cerca de 4 minutos, uma vez), pelo que é necessário um ambiente de
  desenvolvimento do Visual Studio. Linux e macOS usam os seus `perl` e
  `make -j` (dois terços dos núcleos).
- **As árvores de código-fonte mais antigas recebem apenas as opções que
  conhecem.** enable-X e no-X são mantidas quando X consta de uma das listas
  `my @disablables... = (...)` da árvore em `Configure`: 3.1.2 não conhece
  `no-docs`, `enable-ec_explicit_curves` (as curvas explícitas estão sempre
  incluídas) nem `enable-static-vcruntime` (as suas compilações estáticas já
  usam `/MT`).
- **As compilações cruzadas** usam o OpenSSL instalado para o destino através
  de `CLAUSE_OPENSSL_ROOT`.

### Dificuldades encontradas pelo caminho

- **O Perl MSYS do Git impede o funcionamento do Configure.** Passa caminhos
  Unix ao Configure, que o `nmake` não pode usar: as compilações para Windows
  precisam do Strawberry Perl nativo, nunca do `perl` que o Git for Windows
  coloca em `PATH`.
- **As compilações fora da árvore com `no-apps` falham** (falta
  `apps/include`), pelo que o Clause mantém as aplicações ativadas e compila o
  alvo `build_libs` em vez de tudo.
- **`install_fips` fora da árvore falha em Windows.** O makefile lista o
  programa como `"apps\\openssl.exe"`, que o `nmake` não associa à sua própria
  regra `apps\openssl.exe`. Em alternativa, compile `build_sw` e execute
  `openssl fipsinstall` manualmente.
- **3.x instala um PDB que o clang-cl nunca escreve.** O `install_dev` de
  Windows de uma compilação estática 3.x copia `ossl_static.pdb`, que a
  informação de depuração incorporada do clang-cl (`/Z7`) não produz; o Clause
  fornece-lhe um ficheiro vazio (4.0 eliminou a cópia).
- **`no-module` desativa FIPS.** O Configure desativa `fips` com `no-module`:
  um fornecedor FIPS é sempre um módulo separado, nunca parte de uma libcrypto
  estática (que continua a poder carregar um).
- **A libcrypto estática em Linux precisa de bibliotecas de compressão.** A
  `libcrypto.a` estática do Ubuntu requer `-lz -lzstd` (`Libs.private` de
  `libcrypto.pc`); as bibliotecas necessárias a uma instalação são registadas
  com ela.

## Ligação de programas

As funções incorporadas residem no seu próprio arquivo, `clause_runtime_crypto`,
ao lado de `clause_runtime`, pelo que os programas que nunca chamam `crypto`
mantêm o tamanho anterior; a libcrypto com os seus fornecedores acrescenta cerca
de 4.5 MB aos que o fazem.

- **Quando é ligado.** O `clau` liga o arquivo quando o lote compilou o módulo
  de biblioteca `crypto` (uma chamada estática a `crypto`), ou com
  `--with-crypto` para programas que só chegam a `crypto` através de chamadas
  dinâmicas (a desencriptação da informação de depuração de `beam_lib` é um
  exemplo). O objeto de arranque lista então a entrada de extensão do arquivo,
  o que inclui o arquivo na ligação, e o arranque regista as suas funções
  incorporadas. Os programas sem `crypto` nunca consultam um OpenSSL.
- **O que é ligado.** `clause_runtime_crypto.link`, ao lado do arquivo,
  identifica a libcrypto (primeira linha) e as suas bibliotecas de sistema;
  `clause_runtime_crypto.openssl` regista como uma árvore de código-fonte é
  compilada (versão, mínimo, destino, opções, compilador, diretórios de Perl e
  NASM).
- **Outro OpenSSL.** `--with-crypto=PATH`, ou, na sua ausência, a variável de
  ambiente `CLAUSE_OPENSSL_ROOT`, liga um OpenSSL ≥ 3.1.2 diferente: a libcrypto
  de uma instalação ou uma árvore de código-fonte que o `clau` configura e
  compila com a receita registada em `<build-dir>/cache/openssl/<hash>` na
  primeira utilização (numa shell de desenvolvimento do Visual Studio em
  Windows, para o `nmake`).

## FIPS

### Modo comutável (como no OTP)

A primeira chamada a `crypto` também tenta carregar o fornecedor `fips` do
OpenSSL, que o OpenSSL encontra através dos seus `OPENSSL_MODULES` (o diretório
de módulos) e `OPENSSL_CONF` (uma configuração que inclui o `fipsmodule.cnf`
escrito por `openssl fipsinstall` e ativa o fornecedor). Depois:

- `crypto:enable_fips_mode(true)` ativa a propriedade predefinida `fips=yes` do
  OpenSSL (`true` quando consegue, `false` sem um fornecedor carregável);
  `crypto:enable_fips_mode(false)` desativa-a.
- `crypto:info_fips/0` responde `enabled` ou `not_enabled`, e `not_supported`
  quando nenhum fornecedor FIPS foi carregado.
- `crypto:info/0` acrescenta `fips_provider_buildinfo` quando está carregado um
  fornecedor FIPS.
- No modo FIPS, os algoritmos que faltam no fornecedor são excluídos de
  `crypto:supports/1` (bem como as chaves públicas e curvas não FIPS do OTP:
  `eddsa`, `eddh`, `srp`, as curvas de Edwards) e geram os erros `notsup` do
  OTP: `"Bad digest type in
  FIPS"`, `"Digest type not supported in FIPS"`, `"MAC algorithm forbidden in FIPS"`, `"Digest algorithm for HMAC
  forbidden in FIPS"`, `"Cipher algorithm not supported in FIPS"`, `"Forbidden in FIPS"`.
  Cada entrada da tabela mantém uma segunda obtenção com `fips=yes`, usada
  enquanto o modo FIPS está ativo, pelo que o modo FIPS calcula com as
  implementações do próprio fornecedor.

As operações de chave pública obtêm os seus algoritmos através das propriedades
predefinidas do OpenSSL, pelo que no modo FIPS usam as implementações do
fornecedor; `eddsa` gera `"Unsupported algorithm in FIPS mode"` e SRP gera
`notsup`, como no OTP.

A variável de aplicação `fips_mode` do OTP não é lida (o Clause não tem
`on_load` e os programas não têm `sys.config`): os programas chamam
`crypto:enable_fips_mode/1` ou são compilados com o modo fixado.

### Programas com modo fixado: `clau --fips=PATH`

`--fips=PATH` compila um programa que executa sempre no modo FIPS, com um
fornecedor FIPS indicado pelo utilizador. `PATH` é um diretório que contém o
módulo do fornecedor e o seu `fipsmodule.cnf`, ou uma instalação do OpenSSL:

| Ficheiro | Procurado em `PATH`, depois em |
| --- | --- |
| `fips.dll` (Windows), `fips.so` (Linux), `fips.dylib` (macOS) | `lib/ossl-modules`, `lib64/ossl-modules`, `lib/<triplet>/ossl-modules` |
| `fipsmodule.cnf` | `ssl/`, `etc/ssl/` |

- **A compilação falha** quando falta o módulo ou o ficheiro de definições, ou
  as definições não têm `module-mac` numa secção `[fips_sect]` (execute
  `openssl fipsinstall`).
- **Ambos os ficheiros são copiados para junto do executável**, com os nomes
  acima; distribua-os com ele. A opção implica `--with-crypto`; a libcrypto é
  escolhida como habitualmente e tem de aceitar o fornecedor.
- **Antes de o programa executar**, a entrada FIPS do objeto de arranque
  (`CLAUSE_crypto_fips_extension_v1`) lê `fipsmodule.cnf` junto do executável,
  carrega o módulo que está junto dele através de uma configuração de
  fornecedores do OpenSSL (as definições do ficheiro mais `module` e
  `activate`, que todas as libcrypto desde 3.0 aceitam), carrega apenas o
  fornecedor `base` do OpenSSL além dele (nunca `default` nem `legacy`; a
  configuração do OpenSSL do sistema não é lida) e ativa `fips=yes`.
- **Quando o fornecedor não é carregado** ou falha o autoteste (um módulo
  alterado, um `module-mac` incorreto), o programa termina com o código de saída
  70 e `crypto: cannot load the FIPS provider from <directory>: <OpenSSL's error>`
  em stderr. O Windows não mostra a caixa de diálogo "Bad Image" para um módulo
  danificado: o modo de erro é silencioso durante o carregamento.
- **Não é possível sair do modo.** `crypto:enable_fips_mode(false)` devolve
  `false`, e `crypto:info_fips/0` mantém-se `enabled`.

### Que fornecedor FIPS usar

O Clause nunca compila um fornecedor FIPS para distribuição. O OpenSSL permite
que outras versões usem um fornecedor FIPS validado, mas proíbe o uso de um
compilado pelo próprio utilizador a partir de uma versão não validada: use o
fornecedor de uma versão validada (3.1.2 à data deste texto, compilado como
prescreve a sua política de segurança, ou um distribuído por um fornecedor de
sistema operativo) e execute o seu `openssl fipsinstall` na máquina de destino
quando a política o exigir. O fornecedor de 3.1.2 carrega na libcrypto 4.1
fixada: a bateria completa compila-o (apenas para o teste) e executa com ele
programas de modo fixado e comutável.

## Testes

| Teste | Bateria | O que verifica |
| --- | --- | --- |
| `executables_crypto_digests`, `executables_crypto_ciphers` | rápida | Testes de referência do OTP 29.1.1: vetores, estados, erros, listas detetadas, `info_fips` sem fornecedor |
| `linking_crypto` | rápida | O arquivo só é ligado quando é usado; `--with-crypto[=PATH]`, `CLAUSE_OPENSSL_ROOT`, recusas |
| `linking_fips` | rápida | Recusas de `--fips`, fornecedores ausentes ou malformados fazem falhar a compilação, cópia, falhas no arranque |
| `linking_crypto_source` | completa | `--with-crypto=SOURCE` compila a árvore de 4.1.0 uma vez na cache de compilação |
| `linking_crypto_minimum` | completa | Os testes de referência de crypto ligados a uma libcrypto compilada a partir do código-fonte de 3.1.2 imprimem os seus resultados de referência |
| `linking_fips_real` | completa | O fornecedor FIPS de 3.1.2 (compilado com `enable-fips` para o teste) num programa de modo fixado (mantém-se no modo FIPS, algoritmos proibidos, um módulo adulterado termina-o) e num de modo comutável (`OPENSSL_MODULES`/`OPENSSL_CONF`) |
