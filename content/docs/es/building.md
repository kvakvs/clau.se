---
source: docs/building.md
sourceCommit: 336caea7
sourceSha256: 86d39780700856574257fd2d598102b8e551505085c42a0a8175f9c2c7b2330c
translatedAt: 2026-10-18
---
# Compilar el compilador

Configuración y compilación desde la raíz del repositorio:

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

Scripts envoltorio (variables de entorno que los modifican: `BUILD_DIR`,
`TOOL_BUILD_DIR`, `BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`,
`CLANG_FORMAT`):

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

Opciones de configuración:

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

Notas para Windows: el CRT por defecto es `/MDd` (Debug) o `/MD`; un valor
explícito de `CMAKE_MSVC_RUNTIME_LIBRARY` debe coincidir con el SDK de LLVM.
`cl` de MSVC funciona en un directorio de compilación aparte; MinGW no está
soportado. Los objetivos del proyecto tratan las advertencias como errores e
incluyen las dependencias como cabeceras `SYSTEM`, por lo que conviene no añadir
rutas de dependencias mediante flags `-I` globales como `CXXFLAGS` (en CLion, el
valor en caché se borra con `-DCMAKE_CXX_FLAGS:STRING=`); en su lugar se usan
las opciones de raíz.

## Pruebas

Las pruebas se activan explícitamente al configurar:

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
modo que `-j N` ejecuta N/2 pruebas a la vez. Las pruebas compilan fuentes
Erlang reales mediante la CLI y comparan los ejecutables con resultados de
referencia (goldens) generados con OTP; véase [validación](validation.md) para
la línea base, los fixtures y el diseño de las pruebas.

Control de calidad (Lizard y clang-tidy, herramientas fijadas en
`tools/requirements-quality.txt` e instaladas en `.venv-quality/`; fuera de
Windows se usa `.venv-quality/bin/python`):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` comprueba los archivos modificados desde `HEAD` (o desde
`CLAUSE_QUALITY_BASE`) más una unidad de traducción por cabecera modificada
(`check-quality-all` cubre todos sus dependientes, en la puerta completa), y
necesita una compilación con el compilador y el runtime
activados; `check-complexity-all` y `check-clang-tidy-all` ejecutan una sola
herramienta. `cmake/CheckClangTidy.cmake` acepta `QUALITY_SHARD=K/N` para
dividir una ejecución larga.
