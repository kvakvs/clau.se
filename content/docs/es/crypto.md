---
source: docs/crypto.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 1713219c9c04cba4db60a95d49dd0d38365ce9026ca10d36ed4d0d602b55f99b
translatedAt: 2026-10-26
---
# Crypto: OpenSSL, compilación y FIPS

El `crypto` de Clause implementa el módulo `crypto` de OTP sobre libcrypto de
OpenSSL. Esta nota explica qué OpenSSL se usa y cómo se encuentra, cómo Clause y
`clau` lo compilan desde el código fuente, cómo lo enlazan los programas y el
modo FIPS. Las funciones integradas se describen en
[funciones integradas](builtins.md#crypto-module), el módulo de biblioteca en
[biblioteca](library.md) y las diferencias observables respecto a OTP en
[diferencias](differences.md#crypto). Las claves y firmas de `public_key` lo
invocan ([public_key](public_key.md#keys-and-signatures)).

## Versiones de OpenSSL

- **Fijada: 4.1.0.** La versión que Clause descarga y compila cuando no se
  proporciona otro OpenSSL.
- **Mínima: 3.1.2.** La versión más reciente cuyo proveedor FIPS está validado
  (certificado FIPS 140-3 #4985). Cualquier libcrypto desde 3.1.2 se enlaza con
  la biblioteca estática de crypto: las funciones integradas solo usan API
  presentes en 3.1.2 y resuelven las diferencias de versión durante la ejecución,
  por lo que una biblioteca sirve para todas esas libcrypto. Las cabeceras más
  recientes aún pueden asociar un nombre antiguo a una función más nueva
  (`EVP_MD_CTX_get_size` de 4.1 es `EVP_MD_CTX_get_size_ex` de 3.4), por lo que
  la biblioteca evita esos nombres; la batería completa de pruebas enlaza las
  pruebas de referencia de crypto con una libcrypto compilada desde 3.1.2.
- **Se comprueban los algoritmos disponibles.** La primera llamada a `crypto`
  carga los proveedores (`fips` si se puede cargar, después `default`, `base` y
  `legacy`, como hace OTP) y obtiene cada resumen, cifrado y MAC de las tablas
  de OTP; `crypto:supports/0,1`, `hash_info/1`, `info/0` e `info_lib/0` informan
  de lo que ofrece el OpenSSL enlazado. Un programa enlazado con 3.1.2 simplemente
  enumera menos algoritmos (sin ML-KEM, ML-DSA ni SLH-DSA).

OpenSSL tiene licencia Apache-2.0; no se incorpora ningún archivo de OpenSSL al
repositorio.

## De dónde procede el OpenSSL de Clause

CMake (`cmake/OpenSSLDependencies.cmake`) resuelve libcrypto para la biblioteca
estática de crypto en este orden:

1. `-DCLAUSE_OPENSSL_ROOT=<path>`: un prefijo de instalación
   (`include/openssl/opensslv.h`) o un árbol de fuentes (`Configure`,
   `VERSION.dat`), que se compila como en 3.
2. Un OpenSSL instalado ≥ 3.1.2 (`CLAUSE_OPENSSL_SYSTEM`, ON por defecto salvo en
   Windows): `find_package(OpenSSL)`, con preferencia por libcrypto estática.
3. La versión fijada, descargada en `thirdparty/openssl-4.1.0` y verificada
   (`openssl-4.1.0.tar.gz`, SHA-256
   `50c17baf54cb008f6ce42d50deb4b28050a1aad711636cabd4b241c7e90cc2fd`),
   configurada y compilada una vez en
   `thirdparty/openssl-4.1.0-<arch>-<crt>/install` (se recompila al cambiar el
   compilador o las opciones); `-DCLAUSE_DOWNLOAD_OPENSSL=OFF` desactiva la
   descarga.

`-DCLAUSE_RUNTIME_CRYPTO=OFF` excluye por completo la biblioteca estática de
crypto. Con las pruebas activadas, la configuración también descarga las fuentes
de 3.1.2 (`openssl-3.1.2.tar.gz`, SHA-256
`a0ce69b8b97ea6a35b96875235aa453b966ba3cba8af2de23657d8b6767d6539`) en
`thirdparty/openssl-3.1.2` para las pruebas de la batería completa;
`-DCLAUSE_TEST_OPENSSL_MINIMUM=OFF` omite la descarga y esas pruebas.

## Compilar OpenSSL desde el código fuente

La compilación desde las fuentes genera una libcrypto estática con el proveedor
legacy integrado (que las funciones integradas cargan como hace OTP):

```
Configure <target> no-shared no-module no-tests no-docs no-makedepend enable-ec_explicit_curves
          [enable-static-vcruntime] [--debug] --prefix=<install> --openssldir=<install>/ssl --libdir=lib
make build_libs && make install_dev
```

- **Compilador y entorno de ejecución.** Se compila con el compilador de C de
  CMake (`CC`); `enable-static-vcruntime` selecciona `/MT` cuando la compilación
  usa el entorno de ejecución estático de MSVC, y `--debug` su variante Debug.
- **Herramientas de Windows.** Configure necesita Perl nativo y NASM: se
  descargan las versiones fijadas de Strawberry Perl 5.42.3.1 portable (SHA-256
  `6a081a811781c30aca51dbc036afd93092af91e3297901f02c17043795a10690`) y NASM
  3.02 (SHA-256
  `161d0bfaff53c2f9e9f3e69fd0672323ebabafd1268976a5cec11be92a19aee7`) en
  `thirdparty/tools/`. Después `nmake` compila secuencialmente (unos 4 minutos
  una sola vez), por lo que hace falta un entorno de desarrollo de Visual Studio.
  Linux y macOS usan su `perl` y `make -j` (dos tercios de los núcleos).
- **Los árboles de fuentes antiguos solo reciben las opciones que conocen.**
  enable-X y no-X se conservan cuando X figura en alguna de las listas
  `my @disablables... = (...)` de `Configure`: 3.1.2 no conoce `no-docs`,
  `enable-ec_explicit_curves` (las curvas explícitas siempre se incluyen) ni
  `enable-static-vcruntime` (sus compilaciones estáticas ya usan `/MT`).
- **Las compilaciones cruzadas** usan el OpenSSL instalado para el destino a
  través de `CLAUSE_OPENSSL_ROOT`.

### Problemas encontrados

- **El Perl de MSYS de Git impide que Configure funcione.** Entrega a Configure
  rutas Unix que `nmake` no puede usar: las compilaciones de Windows necesitan
  Strawberry Perl nativo, nunca el `perl` que Git for Windows añade a `PATH`.
- **Las compilaciones fuera del árbol con `no-apps` fallan** (falta
  `apps/include`), por lo que Clause mantiene las aplicaciones activadas y compila
  el destino `build_libs` en lugar de todo.
- **`install_fips` fuera del árbol falla en Windows.** El makefile enumera el
  programa como `"apps\\openssl.exe"`, que `nmake` no asocia con su propia regla
  `apps\openssl.exe`. En su lugar, se debe compilar `build_sw` y ejecutar
  `openssl fipsinstall` manualmente.
- **3.x instala un PDB que clang-cl nunca escribe.** El `install_dev` de Windows
  de una compilación estática 3.x copia `ossl_static.pdb`, que la información de
  depuración integrada de clang-cl (`/Z7`) no produce; Clause proporciona uno
  vacío (4.0 eliminó la copia).
- **`no-module` desactiva FIPS.** Configure desactiva `fips` con `no-module`: un
  proveedor FIPS siempre es un módulo separado, nunca parte de una libcrypto
  estática (que sí puede cargarlo).
- **La libcrypto estática en Linux necesita bibliotecas de compresión.** La
  `libcrypto.a` estática de Ubuntu requiere `-lz -lzstd` (`Libs.private` de
  `libcrypto.pc`); las bibliotecas que necesita una instalación se registran
  junto a ella.

## Enlazar programas

Las funciones integradas residen en su propia biblioteca estática,
`clause_runtime_crypto`, junto a `clause_runtime`, por lo que los programas que
nunca llaman a `crypto` siguen siendo igual de pequeños; libcrypto con sus
proveedores añade unos 4.5 MB a los que sí lo hacen.

- **Cuándo se enlaza.** `clau` enlaza la biblioteca estática cuando el lote ha
  compilado el módulo de biblioteca `crypto` (una llamada estática a `crypto`),
  o con `--with-crypto` para programas que solo acceden a `crypto` mediante
  llamadas dinámicas (como el descifrado de información de depuración de
  `beam_lib`). El objeto de inicio enumera entonces la entrada de extensión de
  la biblioteca, lo que fuerza su inclusión, y el inicio registra sus funciones
  integradas. Los programas sin `crypto` nunca buscan un OpenSSL.
- **Qué se enlaza.** `clause_runtime_crypto.link`, junto a la biblioteca
  estática, indica libcrypto (primera línea) y sus bibliotecas del sistema;
  `clause_runtime_crypto.openssl` registra cómo se compila un árbol de fuentes
  (versión, mínimo, destino, opciones, compilador y directorios de Perl y NASM).
- **Otro OpenSSL.** `--with-crypto=PATH`, o en su defecto la variable de entorno
  `CLAUSE_OPENSSL_ROOT`, enlaza un OpenSSL ≥ 3.1.2 diferente: la libcrypto de una
  instalación o un árbol de fuentes que `clau` configura y compila con la receta
  registrada en `<build-dir>/cache/openssl/<hash>` durante el primer uso (en una
  consola de desarrollo de Visual Studio en Windows, para `nmake`).

## FIPS

### Modo conmutable (como OTP)

La primera llamada a `crypto` también intenta cargar el proveedor `fips` de
OpenSSL, que OpenSSL encuentra mediante sus variables `OPENSSL_MODULES` (el
directorio de módulos) y `OPENSSL_CONF` (una configuración que incluye el
`fipsmodule.cnf` escrito por `openssl fipsinstall` y activa el proveedor).
Entonces:

- `crypto:enable_fips_mode(true)` activa la propiedad predeterminada `fips=yes`
  de OpenSSL (`true` si lo consigue, `false` sin un proveedor que se pueda
  cargar); `crypto:enable_fips_mode(false)` la desactiva.
- `crypto:info_fips/0` devuelve `enabled` o `not_enabled`, y `not_supported`
  cuando no se ha cargado ningún proveedor FIPS.
- `crypto:info/0` añade `fips_provider_buildinfo` cuando hay un proveedor FIPS
  cargado.
- En modo FIPS, los algoritmos de los que carece el proveedor se excluyen de
  `crypto:supports/1` (y las claves públicas y curvas de OTP ajenas a FIPS:
  `eddsa`, `eddh`, `srp`, las curvas Edwards) y generan los errores `notsup` de
  OTP: `"Bad digest type in FIPS"`, `"Digest type not supported in FIPS"`,
  `"MAC algorithm forbidden in FIPS"`, `"Digest algorithm for HMAC forbidden in FIPS"`,
  `"Cipher algorithm not supported in FIPS"`, `"Forbidden in FIPS"`. Cada
  entrada de tabla conserva una segunda obtención con `fips=yes`, usada mientras
  está activo el modo FIPS, por lo que este modo calcula con las implementaciones
  del propio proveedor.

Las operaciones de clave pública obtienen sus algoritmos mediante las propiedades
predeterminadas de OpenSSL, por lo que en modo FIPS usan las implementaciones del
proveedor; `eddsa` genera `"Unsupported algorithm in FIPS mode"` y SRP genera
`notsup`, como en OTP.

No se lee la variable de aplicación `fips_mode` de OTP (Clause no tiene `on_load`
y los programas no tienen `sys.config`): los programas llaman a
`crypto:enable_fips_mode/1` o se compilan con el modo fijado.

### Programas con modo fijado: `clau --fips=PATH`

`--fips=PATH` compila un programa que siempre se ejecuta en modo FIPS, con un
proveedor FIPS proporcionado por el usuario. `PATH` es un directorio que contiene
el módulo del proveedor y su `fipsmodule.cnf`, o una instalación de OpenSSL:

| Archivo | Se busca en `PATH` y después en |
| --- | --- |
| `fips.dll` (Windows), `fips.so` (Linux), `fips.dylib` (macOS) | `lib/ossl-modules`, `lib64/ossl-modules`, `lib/<triplet>/ossl-modules` |
| `fipsmodule.cnf` | `ssl/`, `etc/ssl/` |

- **La compilación falla** cuando falta el módulo o el archivo de configuración,
  o la configuración no tiene `module-mac` en una sección `[fips_sect]` (se debe
  ejecutar `openssl fipsinstall`).
- **Ambos archivos se copian junto al ejecutable**, con los nombres anteriores;
  deben distribuirse con él. La opción implica `--with-crypto`; libcrypto se
  elige como de costumbre y debe aceptar el proveedor.
- **Antes de ejecutar el programa**, la entrada FIPS del objeto de inicio
  (`CLAUSE_crypto_fips_extension_v1`) lee `fipsmodule.cnf` junto al ejecutable,
  carga el módulo situado junto a él mediante una configuración de proveedor de
  OpenSSL (los ajustes del archivo más `module` y `activate`, que acepta toda
  libcrypto desde 3.0), carga únicamente el proveedor `base` de OpenSSL además
  de él (nunca `default` ni `legacy`; no se lee la configuración de OpenSSL del
  sistema) y activa `fips=yes`.
- **Si el proveedor no se carga** o falla su autoprueba (un módulo modificado,
  un `module-mac` incorrecto), el programa se detiene con estado de salida 70 y
  `crypto: cannot load the FIPS provider from <directory>: <OpenSSL's error>` en
  stderr. Windows no muestra el diálogo "Bad Image" si el módulo está dañado:
  el modo de errores es silencioso durante la carga.
- **No se puede salir del modo.** `crypto:enable_fips_mode(false)` devuelve
  `false`, y `crypto:info_fips/0` permanece en `enabled`.

### Qué proveedor FIPS usar

Clause nunca compila un proveedor FIPS para su distribución. OpenSSL permite
que otras versiones usen un proveedor FIPS validado, pero prohíbe usar uno
compilado por cuenta propia desde una versión no validada: se debe obtener el
proveedor de una versión validada (3.1.2 en el momento de redactar este texto,
compilado según su política de seguridad, o uno distribuido por un proveedor de
sistema operativo) y ejecutar su `openssl fipsinstall` en la máquina de destino
cuando lo exija la política. El proveedor de 3.1.2 se carga en la libcrypto 4.1
fijada: la batería completa lo compila (solo para la prueba) y ejecuta con él
programas con modo fijado y conmutable.

## Pruebas

| Prueba | Batería | Qué comprueba |
| --- | --- | --- |
| `executables_crypto_digests`, `executables_crypto_ciphers` | rápida | Pruebas de referencia de OTP 29.1.1: vectores, estados, errores, listas de disponibilidad, `info_fips` sin proveedor |
| `linking_crypto` | rápida | La biblioteca estática solo se enlaza cuando se usa; `--with-crypto[=PATH]`, `CLAUSE_OPENSSL_ROOT`, rechazos |
| `linking_fips` | rápida | Rechazos de `--fips`, los proveedores ausentes o mal formados hacen fallar la compilación, copia, fallos de inicio |
| `linking_crypto_source` | completa | `--with-crypto=SOURCE` compila el árbol de 4.1.0 una vez en la caché de compilación |
| `linking_crypto_minimum` | completa | Las pruebas de referencia de crypto enlazadas con una libcrypto compilada desde las fuentes de 3.1.2 imprimen sus resultados de referencia |
| `linking_fips_real` | completa | Proveedor FIPS de 3.1.2 (compilado con `enable-fips` para la prueba) en un programa con modo fijado (permanece en modo FIPS, algoritmos prohibidos, un módulo alterado lo detiene) y uno conmutable (`OPENSSL_MODULES`/`OPENSSL_CONF`) |
