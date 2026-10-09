---
source: docs/getting-started.md
sourceCommit: 06042fa
sourceSha256: 95b73af25f3b08912c8b7f38fe46edf93a90187b3df3c13291d19a90411c29b1
translatedAt: 2026-10-09
---
# Primeros pasos

Requisitos:

- CMake 3.28+ y un compilador compatible con C++23.
- En Windows, un ejecutable de Clang instalado en el `PATH` o en
  `Program Files/LLVM/bin`; la configuración falla de inmediato si falta o no
  puede ejecutarse.
- El SDK de C++ de LLVM 23.1.x (>=23.1.1) para compilar el compilador. CMake
  prefiere una instalación global y, si falta, descarga el SDK fijado 23.1.2 en
  `thirdparty/`; véase
  [configuración del SDK y contrato de compilación](compile.md).
- Boost 1.90+ con Boost.Multiprecision para el compilador y el runtime; el
  compilador también requiere Boost.Parser. Multiprecision es solo de cabeceras y
  no necesita ninguna biblioteca binaria de Boost.
- toml++ 3.4.0 para los manifiestos de proyecto; véase
  [configuración de dependencias](projects.md#build-dependency).
- Las compilaciones y pruebas normales no requieren Erlang/OTP. Las pruebas usan
  [fixtures golden propios del proyecto](../tests/fixtures/patternmatch/generated/README.md).
  Las auditorías opcionales en vivo y la regeneración explícita de fixtures
  requieren Erlang/OTP 29+.

En macOS:

```sh
xcode-select --install
brew install cmake boost erlang tomlplusplus llvm@23
```

En Windows, LLVM/Clang se instala globalmente para las herramientas del
compilador del anfitrión. Hay que instalar la carga de trabajo
**Desktop development with C++** de Visual Studio y un Windows SDK, además de
Ninja. Se usa un símbolo del sistema **x64 Native Tools** o un Developer
PowerShell configurado para x64, con `clang-cl`, `cmake` y `ninja` en el `PATH`.
CMake comprueba la ABI de MSVC, el enlazado con el Windows SDK y el soporte de
`std::expected` de C++23. Las herramientas de línea de órdenes de LLVM por sí
solas no proporcionan el SDK de C++ necesario; CMake lo descarga por separado
cuando faltan `LLVMConfig.cmake` y las bibliotecas correspondientes.

CMake descarga Boost 1.90.0 y toml++ 3.4.0 en el directorio ignorado
`thirdparty/` en el primer uso, verifica sus sumas de comprobación SHA-256 y
conserva tanto los archivos comprimidos como los fuentes extraídos. Las
configuraciones posteriores, incluidos los directorios de compilación nuevos,
reutilizan esos archivos sin acceso a la red. Eliminar `build/` no elimina las
dependencias. Cuando la pila TLS propia de CMake no puede verificar los
certificados (por ejemplo, el CMake incluido con Strawberry Perl), las
descargas se reintentan con el `curl` del anfitrión y se siguen verificando. Las
compilaciones solo del runtime descargan únicamente Boost. Las raíces de
dependencias explícitas indicadas más abajo tienen prioridad y permiten una
configuración sin conexión; una raíz explícita no válida falla sin descargar.
Linux y macOS siguen usando las dependencias instaladas o los fuentes locales de
`thirdparty/`. Las descargas de respaldo del SDK de LLVM se aplican en **las
tres plataformas**, con archivos oficiales fijados por SHA-256 para Windows
x64/ARM64, Linux x64/ARM64 y macOS ARM64. Los archivos comprimidos y los SDK
extraídos permanecen en `thirdparty/` para reutilizarlos sin conexión. Otras
arquitecturas del anfitrión y las compilaciones cruzadas requieren un
`LLVM_DIR` explícito correspondiente.

Para compilar el compilador, las dependencias zlib y zstd de LLVM se detectan a
partir de las bibliotecas instaladas. En Windows, si faltan bibliotecas, se
descargan zlib 1.3.2 y zstd 1.5.7 con verificación SHA-256 y se compilan de
forma estática en Debug/Release en `thirdparty/`. Estas compilaciones se
reutilizan entre directorios de compilación y coinciden con el compilador, la
arquitectura y el CRT del anfitrión. Con `ZLIB_ROOT` o `zstd_ROOT` se prefiere
una biblioteca instalada; `CLAUSE_DOWNLOAD_ZLIB=OFF` y
`CLAUSE_DOWNLOAD_ZSTD=OFF` desactivan las respectivas alternativas. La
detección del SDK de MSVC rechaza las bibliotecas `.a` de MinGW en caché, como
las incluidas con Strawberry Perl. Linux y macOS usan los paquetes de
desarrollo instalados.
