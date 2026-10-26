---
source: docs/building.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b5b9cdbb0544c714f847eac4931ed0fa38d8de1144153349efac4c2302159cbc
translatedAt: 2026-10-26
---
# Compilar Clause

Cómo compilar `clau` y `clause_runtime`, configurar la compilación, ejecutar las
pruebas y usar las herramientas de desarrollo. El diseño y los resultados de
las pruebas están en [validación](validation.md).

## Requisitos

- CMake 3.28+ y un compilador C++23; en Windows, la carga de trabajo
  **Desarrollo para el escritorio con C++** de Visual Studio con un SDK de
  Windows, Ninja y una instalación global de LLVM/Clang (`clang-cl`, y `clang`
  para enlazar programas).
- SDK de C++ de LLVM 23.1.x (23.1.1 o posterior) para el compilador. Se prefiere
  una instalación global; en su defecto, CMake descarga el SDK fijado 23.1.2 en
  `thirdparty/` en Windows x64/ARM64, Linux x64/ARM64 y macOS ARM64
  ([SDK de LLVM](compile.md#llvm-sdk)). Las herramientas de línea de comandos de
  LLVM por sí solas no incluyen el SDK.
- Boost 1.90+ (Multiprecision, Asio y Parser para el compilador; solo cabeceras),
  toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 y zlib 1.3.2. CMake descarga las
  dependencias que faltan en `thirdparty/` con comprobaciones SHA-256 y las
  reutiliza sin conexión, también para directorios de compilación nuevos; en
  Linux y macOS, Boost y toml++ proceden de una instalación o de `thirdparty/`
  ([dependencia de compilación](projects.md#build-dependency)).
- Python 3 para las pruebas y las herramientas de calidad, rendimiento y listados.
- No se necesita Erlang/OTP para compilar ni para ejecutar las pruebas. Las
  pruebas usan [fixtures de referencia propios del proyecto](../tests/fixtures/patternmatch/generated/README.md);
  solo las transformaciones de análisis, las auditorías opcionales en vivo, la
  regeneración de fixtures y las pruebas de rendimiento necesitan una
  instalación de OTP 29.

En macOS (Erlang opcional):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```

## Configuración y compilación

```sh
cmake --preset debug                    # build/debug, single configuration
cmake --build --preset debug
```

En Windows, desde un shell de desarrollador x64 con `clang-cl` y `ninja` en el
`PATH`:

```powershell
cmake --preset windows                  # build/windows, Ninja Multi-Config
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

El preset `debug` coloca `clau` en `build/debug/bin`; el preset `windows`, en
`build/windows/bin/<Config>/clau.exe`, con el runtime en
`build/windows/lib/<Config>/clause_runtime.lib`. `clau` localiza el archivo del
runtime y los módulos de `library/` en relación con su propia ubicación.

## Scripts envoltorio

Variables de entorno que los modifican: `BUILD_DIR`, `TOOL_BUILD_DIR`,
`BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`.

| Makefile | Windows | Función |
| --- | --- | --- |
| `make build` | `make-build.bat` | Compila `clau` en `build/tool` sin pruebas (el script por lotes compila en Release y también el runtime) |
| `make test`, `make test-full` | `make-test.bat` | Configura `build/debug` con pruebas, lo compila todo y ejecuta CTest |
| `make format`, `make format-all` | `make-format.bat` | Aplica clang-format a los archivos C++ modificados (o, con `FORMAT_SCOPE=all`, a todos) |
| `make benchmark` | `make-benchmark.bat` | Compilación Release en `build/bench` y después comparación con el OTP del host |
| `make clean` | `make-clean.bat` | Elimina `build/` y `cmake-build*/` |

Los scripts por lotes entran por sí mismos en el entorno x64 de Visual Studio
cuando hace falta, añaden `%ProgramFiles%\LLVM\bin` al `PATH` cuando falta
`clang-cl` y reconfiguran un directorio de compilación creado con otro generador
o compilador; con `CLAUSE_TOOLCHAIN=default` se conserva la elección propia de
CMake. `clau.bat` (Windows) y `run-macos.sh` compilan primero `build/tool` y
después ejecutan `clau` con todos los argumentos, conservando el directorio de
trabajo y el código de salida del llamador.

## Opciones de configuración

| Opción | Propósito |
| --- | --- |
| `-DBUILD_TESTING=ON` | Compila las pruebas y sus programas auxiliares (por defecto OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF` | Compila solo la biblioteca del runtime, sin LLVM |
| `-DCLAUSE_BUILD_RUNTIME=OFF` | Compila solo el compilador |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Selecciona un SDK de LLVM 23.1.x (una ruta explícita no válida falla) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Exige un SDK instalado |
| `-DCLAUSE_BOOST_ROOT=...`, `-DCLAUSE_TOML_ROOT=...`, `-DCLAUSE_SQLITE_ROOT=...`, `-DCLAUSE_PCRE2_ROOT=...` | Selecciona las fuentes o la instalación de una dependencia (configuración sin conexión) |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Selecciona el ejecutable de Clang en Windows |
| `-DCLAUSE_OTP_AUDITS=ON`, `-DCLAUSE_ESCRIPT=/path/to/escript` | Activa las auditorías opcionales en vivo con OTP y selecciona el OTP 29 que se usa |
| `-DCLAUSE_TEST_DEBUG_INFO=ON` | Compila los programas de prueba con información de depuración (para depurar un fallo) |
| `-DCLAUSE_OPTIMIZED_COMPILER=OFF` | Compila `clau` y las bibliotecas del compilador sin optimización en Debug (para depurar un fallo de `clau`) |

Notas para Windows: el CRT por defecto es `/MDd` (Debug) o `/MD`; un valor
explícito de `CMAKE_MSVC_RUNTIME_LIBRARY` debe coincidir con el SDK de LLVM.
`cl` de MSVC funciona en un directorio de compilación aparte; MinGW no está
soportado. Los objetivos del proyecto tratan las advertencias como errores e
incluyen las dependencias como cabeceras `SYSTEM`, por lo que conviene no añadir
rutas de dependencias mediante flags `-I` globales como `CXXFLAGS` (en CLion, el
valor en caché se borra con `-DCMAKE_CXX_FLAGS:STRING=`); en su lugar se usan
las opciones de raíz.

## Pruebas

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug-fast                # or windows-debug-fast
ctest --preset debug -j 16               # full mode
```

`CLAUSE_TEST_MODE=fast` (los presets `*-fast`, `make test`, `make-test.bat`)
ejecuta una matriz reducida de optimización/driver y omite las pruebas
`full_only`; `full` (el valor por defecto si no se define, `make test-full`,
`TEST_MODE=full`) lo ejecuta todo. Cada prueba reserva dos slots de CTest, de
modo que `-j N` ejecuta N/2 pruebas a la vez.

## Control de calidad

Lizard y clang-tidy, fijados en `tools/requirements-quality.txt` e instalados
en `.venv-quality/` (fuera de Windows se usa `.venv-quality/bin/python`):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` comprueba los archivos modificados desde `HEAD` (o desde
`CLAUSE_QUALITY_BASE`) más una unidad de traducción por cabecera modificada
(`check-quality-all` cubre todos sus dependientes) y necesita una compilación
con el compilador y el runtime activados; `check-complexity-all` y
`check-clang-tidy-all` ejecutan una sola herramienta. `cmake/CheckClangTidy.cmake` acepta `QUALITY_SHARD=K/N` para
dividir una ejecución larga.

## Pruebas de rendimiento y listados

`make benchmark` / `make-benchmark.bat` compilan un `clau` Release en
`build/bench` y comparan los programas `benchmarks/bench_*.erl` con el OTP del
anfitrión y un commit anterior de Clause; `benchmarks/run.py --help` enumera las
opciones ([pruebas de rendimiento](validation.md#benchmarks)). Nunca forman parte
de las pruebas.

`benchmarks/compile_times.py` mide los tiempos del propio `clau`: ejecuta una
carga de compilación (`--workload W1`, o argumentos de `clau` después de `--`)
varias veces en los núcleos de rendimiento con `--no-cache --print-stage-times`,
e informa de la mediana, el mínimo y la dispersión de cada fase y pasada de
inferencia, los componentes de inferencia más lentos y si los contadores de
pasadas y la salida estándar coinciden entre ejecuciones. Con
`--baseline <clau.exe>` se alternan las dos compilaciones y el resumen muestra
su proporción. Se niega a medir mientras se ejecutan compilaciones, pruebas u
otro `clau`, salvo que se indique `--force-noisy`, y escribe JSON en
`build/bench/compile-times/`.

`decompile-debug.bat <module>` y `decompile-release.bat <module>` escriben el
ensamblador Debug o Release de un fuente C++ de Clause en `<module>.debug.asm` /
`<module>.release.asm`, con líneas del fuente y nombres sin decoración
(`tools/asm.py`, compilaciones con clang-cl; `--function TEXT` filtra).
