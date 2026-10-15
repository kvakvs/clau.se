---
source: docs/building.md
sourceCommit: 6ed3851c
sourceSha256: 588e40c653165e5d39e7f284cf3173a4f04d81079cba804e17b7444a1f40662d
translatedAt: 2026-10-15
---
# Compilar el compilador

Desde la raíz del repositorio:

```sh
cmake --preset debug
cmake --build --preset debug
```

En Windows se usa el preset clang-cl/Ninja Multi-Config desde el shell de
desarrollador:

```powershell
cmake --preset windows
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Las pruebas y sus ejecutables auxiliares son opcionales. Para las pruebas hay
que configurar explícitamente:

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug --no-tests=error
```

En Windows:

```powershell
cmake --preset windows -DBUILD_TESTING=ON
cmake --build --preset windows-debug
ctest --preset windows-debug --no-tests=error
cmake --build --preset windows-release
ctest --preset windows-release --no-tests=error
```

Las pruebas tienen dos modos, seleccionados con `CLAUSE_TEST_MODE`:

- `fast` para el desarrollo: los corpus golden ejecutan dos combinaciones
  de política/driver (O0 posicional y O2 sin especialización mediante un
  proyecto) en lugar de las ocho, los casos de mutación se ejecutan una vez y se
  excluyen las pruebas etiquetadas `full_only` (proyectos consumidores de CMake
  independientes y mediciones de tiempo).
- `full` (el valor por defecto si no se define) ejecuta todas las combinaciones
  y todas las pruebas; conviene usarlo cuando se completa una funcionalidad
  importante.

```sh
ctest --preset debug-fast            # or windows-debug-fast; tests use half the logical CPUs
ctest --preset debug -j 32           # full mode; -j N runs N/2 tests at once
make test                            # fast; make test-full or TEST_MODE=full for full
```

`make-test.bat` sigue los mismos ajustes `TEST_MODE` (por defecto `fast`) y
`TEST_JOBS` (por defecto todas las CPU lógicas). Cada prueba reserva dos slots
de procesador de CTest (`PROCESSORS 2`), de modo que con N slots se ejecutan
como máximo N/2 pruebas a la vez, lo que deja margen para los compiladores y
las compilaciones nativas anidadas que lanzan las pruebas. En un anfitrión
Windows x64 de 32 hilos, el modo rápido tarda alrededor de un minuto y el modo
completo unos 85 segundos con 16 trabajos (729 segundos en serie).

Para un directorio de compilación sin preset, se pasa `-DBUILD_TESTING=ON` a
`cmake -S . -B <dir>` para las pruebas. CMake guarda este ajuste en caché; hay
que pasar `-DBUILD_TESTING=OFF` al reutilizar ese directorio para compilaciones
ordinarias. Los presets normales y los scripts envoltorio lo fijan a `OFF`.

Los scripts por lotes reflejan los objetivos `build`, `format` y `clean` del
Makefile: `make-build.bat`, `make-test.bat`, `make-format.bat` y
`make-clean.bat`. Los scripts de compilación y de pruebas configuran clang-cl
con Ninja Multi-Config, como el preset `windows`; entran por sí mismos en el
entorno x64 de Visual Studio cuando el shell no es un shell de desarrollador y
añaden `%ProgramFiles%\LLVM\bin` al `PATH` cuando falta `clang-cl`. Un
directorio de compilación configurado con otro generador o compilador se
reconfigura desde cero; con `CLAUSE_TOOLCHAIN=default` se conserva la elección
propia de CMake (por ejemplo, `cl` de MSVC en un directorio aparte). Los valores
por defecto de compilación son `BUILD_DIR=build/debug` (pruebas),
`TOOL_BUILD_DIR=build/tool` (`make build`, `make-build.bat`, `clau.bat`,
`run-macos.sh`: pruebas desactivadas, para que nunca reconfiguren la
compilación de pruebas), `BUILD_TYPE=Debug` y el paralelismo de la herramienta
de compilación nativa (se cambia con `JOBS=N`);
las variables de entorno `CMAKE`, `CTEST`, `CMAKE_ARGS` y `CLANG_FORMAT` también
sustituyen las herramientas u opciones correspondientes. `make-test.bat`
configura con las pruebas activadas, compila todos los objetivos y después
ejecuta CTest, igual que `make test`, propagando los fallos de configuración,
compilación o pruebas. Clean elimina los directorios `build/` y `cmake-build*/`
locales del repositorio.

`make benchmark` y `make-benchmark.bat` ejecutan la comparación manual de
rendimiento con el Erlang/OTP del host (compilación Release en `build/bench`,
nunca forma parte de las pruebas); véase
[benchmarks](validation.md#benchmarks).

`decompile-debug.bat <module>` y `decompile-release.bat <module>` recompilan un
archivo fuente C++ (nombre sin ruta ni extensión; se añaden directorios padre
cuando es ambiguo, p. ej. `ast/attributes`) con sus opciones registradas de
Debug o Release y escriben `<module>.debug.asm` / `<module>.release.asm` en el
directorio actual. Envuelven `tools/asm.py` (solo compilaciones con clang-cl),
que toma la orden de compilación de `build/tool` y después de `build/debug`
(`--build-dir` lo cambia). La salida conserva código y datos con comentarios de
línea de fuente y nombres desmanglados, sin directivas de información de
depuración, de desenrollado (unwinding) ni de tabla de símbolos.
`--function TEXT` conserva solo las funciones cuyo nombre desmanglado contiene
`TEXT`, y `--raw` escribe el listado sin filtrar.

Las comprobaciones de calidad y el formateo se aplican por defecto a los
archivos modificados: todo lo que difiere de `HEAD` en el árbol de trabajo, más
los archivos no rastreados.

Las herramientas de calidad residen en el entorno ignorado `.venv-quality/`,
fijado por `tools/requirements-quality.txt`:
`python -m venv .venv-quality` y después `.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt`
(`.venv-quality/bin/python` fuera de Windows).

- `cmake --build build/debug --target check-quality` ejecuta Lizard sobre los
  archivos C++ de producción modificados y clang-tidy sobre las unidades de
  traducción modificadas más las que incluyen una cabecera modificada (según las
  dependencias registradas por Ninja). Los cambios en `.clang-tidy`, `cmake/` o
  en los `CMakeLists.txt` de producción, o la falta de datos de dependencias,
  comprueban todas las unidades de traducción. Con `CLAUSE_QUALITY_BASE` (por
  ejemplo `origin/master`) se compara con otra base.
- `check-quality-all` (y `check-complexity-all`, `check-clang-tidy-all`)
  comprueban todos los archivos.
- clang-tidy se ejecuta en lotes de `4 x jobs` unidades de traducción e imprime
  una línea passed/FAILED tras cada uno; se ejecutan todos los lotes y después la
  comprobación falla si alguno falló. Para dividir una ejecución larga en
  invocaciones separadas más cortas, se llama al script directamente con una
  partición, por ejemplo
  `cmake -DQUALITY_SCOPE=all -DQUALITY_BUILD_DIR=build/debug -DQUALITY_SHARD=1/4 -P cmake/CheckClangTidy.cmake`
  para el primer cuarto (`QUALITY_BATCH` y `QUALITY_JOBS` cambian el tamaño de
  lote y los trabajos; por defecto los trabajos son la mitad de los núcleos
  lógicos).
- `make format` / `make-format.bat` formatean los archivos C++ modificados;
  `make format-all` o `FORMAT_SCOPE=all make-format.bat` lo formatean todo.

`clau.bat --help` compila primero y después reenvía todos los argumentos al
ejecutable de la configuración seleccionada. Los fallos de compilación detienen
la ejecución; las rutas de entrada del compilador siguen siendo relativas al
directorio de trabajo del llamador, y se conserva su código de salida.

Para desarrollar el runtime sin descargar ni usar el SDK de C++ de
LLVM, se configura con `cmake --preset windows -DCLAUSE_BUILD_COMPILER=OFF`; se
aplican los mismos presets de compilación y pruebas. La opción se vuelve a poner
a `ON` cuando el SDK está disponible. También se acepta `cl` de MSVC en un
directorio de compilación aparte; MinGW no está soportado para compilaciones de
desarrollo nativas en Windows. x86 o x64 se seleccionan mediante el entorno de
desarrollador (o con `-A` con un generador de Visual Studio), y se usan un SDK
de LLVM y un runtime de esa arquitectura.

El CRT por defecto en Windows es `/MDd` para Debug y `/MD` para las demás
configuraciones, incluida la biblioteca estática del runtime y sus
consumidores. Un ajuste explícito de `CMAKE_MSVC_RUNTIME_LIBRARY` se respeta;
debe coincidir con el SDK de LLVM y con todas las bibliotecas C++ enlazadas.
Conviene no mezclar artefactos STL/CRT de Debug y Release. Los fuentes del
proyecto en Windows y los fixtures de CLI/rutas usan UTF-8.

Todos los objetivos del proyecto usan C++23 y tratan las advertencias del
compilador como errores. El ejecutable es `build/debug/bin/clau`. Los presets
de compilación y los scripts envoltorio solicitan compilaciones en paralelo en
Windows, Linux y macOS con el número de trabajos por defecto de la herramienta
de compilación nativa (`jobs: 0` en los presets, `--parallel` en los scripts).
Se fija un límite explícito con `cmake --build --preset debug --parallel 8` o
con `JOBS=8` para los scripts. Para un directorio de compilación sin preset, se
usa `cmake --build <dir> --parallel`. El preset de Windows coloca el ejecutable
en `build/windows/bin/<Config>/clau.exe` y el runtime en
`build/windows/lib/<Config>/clause_runtime.lib`.

Como alternativa, `make build` compila solo `clau` y sus dependencias en
`build/tool`, y
`make test` compila y ejecuta el conjunto completo de pruebas. Para otra
configuración:

```sh
make test BUILD_DIR=build/release BUILD_TYPE=Release JOBS=4
```

CMake detecta las instalaciones de Boost y Erlang, incluidas las de Homebrew.
Estas opciones, pasadas al configurar, sustituyen los valores por defecto:

| Opción                                      | Propósito                                                     |
|---------------------------------------------|---------------------------------------------------------------|
| `-DCLAUSE_BOOST_ROOT=/path/to/boost`    | Selecciona una instalación de Boost o un árbol de fuentes completo |
| `-DCLAUSE_TOML_ROOT=/path/to/tomlplusplus-3.4.0` | Selecciona la dependencia TOML fijada |
| `-DCLAUSE_SQLITE_ROOT=/path/to/sqlite-amalgamation-3540000` | Selecciona la amalgamación de SQLite fijada (caché de compilación) |
| `-DCLAUSE_OTP_AUDITS=ON` | Activa las auditorías opcionales en vivo de OTP/referencia; por defecto OFF |
| `-DCLAUSE_ESCRIPT=/path/to/bin/escript` | Selecciona OTP 29+ para las auditorías opcionales; las pruebas normales no lo usan |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Selecciona un ejecutable de Clang instalado en Windows |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Selecciona un SDK de LLVM 23.1.x existente (las rutas explícitas no válidas fallan) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Exige un SDK instalado; desactiva las descargas automáticas de LLVM |
| `-DBUILD_TESTING=ON`                        | Activa las pruebas, los ejecutables auxiliares y su dependencia de Erlang (por defecto: OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF`           | Compila solo la biblioteca del runtime           |
| `-DCLAUSE_BUILD_RUNTIME=OFF`            | Compila solo el compilador                                    |

Con generadores multiconfiguración, se añade `--config Debug` al compilar y
`-C Debug` al ejecutar las pruebas. Los IDE compatibles con CMake pueden abrir
el repositorio con el preset `debug`, o con el preset `windows` y una cadena de
herramientas de desarrollo de Visual Studio.

Las cabeceras de Boost y toml++ usan includes `SYSTEM` de CMake, lo que mantiene
las advertencias como errores para el código del proyecto. En las compilaciones
nativas de macOS, CMake también marca como `SYSTEM` el directorio de includes
enlazado de Homebrew cuando sus cabeceras de Boost corresponden a la
instalación seleccionada. Así, flags heredados como
`CXXFLAGS=-I/opt/homebrew/include` no exponen advertencias de Boost, incluso
cuando CMake ya tiene ese flag en caché. Para otras instalaciones, conviene no
añadir rutas de dependencias mediante flags `-I` globales (incluido
`CXXFLAGS`): una ruta de include ordinaria puede tener prioridad sobre la ruta
de sistema de una dependencia. Si CLion informa de advertencias de Boost como
errores, hay que eliminar esos flags globales y borrar el valor en caché, por
ejemplo:

```sh
cmake -S . -B cmake-build-debug -DCMAKE_CXX_FLAGS:STRING=
```

Después se recarga CMake en CLion. Para seleccionar instalaciones se usan las
opciones de raíz de dependencias anteriores en lugar de añadir flags de include
globales.
