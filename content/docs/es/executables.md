---
source: docs/executables.md
sourceCommit: 06042fa
sourceSha256: aaec2d5d2a83da50b160d09c8b37ecf1648199279e5aed4b35ef794633bf589a
translatedAt: 2026-10-09
---
# Ejecutables

Contrato de los programas construidos con `clau -o` o con una compilación de
proyecto. Las entradas posicionales, o exactamente un objetivo de proyecto
seleccionado, se enlazan en la ruta de `-o`; una compilación de proyecto
enlaza cada objetivo ejecutable seleccionado en el `output` de su manifiesto
([enlazado](#linking), [proyectos](projects.md#executables)).

## Selección de la entrada

La entrada es una función exportada de aridad 1 que recibe la lista de
argumentos.

| Origen | Escritura | Alcance |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION]` | Lote posicional, o el único objetivo de proyecto seleccionado |
| Manifiesto | `entry = "MODULE[:FUNCTION]"` en una tabla `[[targets]]` | Ese objetivo |
| Por defecto | El único escript; si no, el único módulo que exporta `main/1` | Solo cuando se pide un ejecutable (`-o`, o un objetivo de proyecto con `output`) |

- `FUNCTION` es `main` por defecto. Los nombres son texto de átomo sin
  comillas: de 1 a 255 escalares Unicode, UTF-8 válido, sin caracteres de
  control y sin `:`. Cualquier otra escritura es un error de uso (CLI, salida
  2) o un error de manifiesto (salida 1).
- `entry` es una clave opcional del esquema 1; los manifiestos anteriores
  siguen siendo válidos. Se decodifica el manifiesto completo, así que un
  `entry` mal formado falla incluso en objetivos no seleccionados.
- `--entry` en la CLI prevalece sobre la clave del manifiesto y requiere
  exactamente un objetivo seleccionado. Es incompatible con las acciones de
  comprobación/impresión y con `--new-project`; esas acciones ignoran el
  `entry` del manifiesto (igual que ignoran `output`).
- Una entrada explícita se valida en todos los modos que compilan (por
  defecto, `--emit`, inspección de IR/tipos), junto con los diagnósticos
  semánticos ordinarios.

| Fallo | Diagnóstico (salida 1) |
| --- | --- |
| Módulo ausente del lote | `<origin>: entry module M is not among the compiled modules` (origin: `--entry` o el manifiesto `file:line:col [target t] (entry)`) |
| No hay `F/1` | `<file>:<line>:<col>: entry function M:F/1 is not defined` en la declaración del módulo |
| Solo otras aridades | `... is not defined; found F/N, but the entry receives one argument (the argument list)` en esa definición |
| `F/1` no exportada | `<file>:<line>:<col>: entry function M:F/1 is not exported` en la definición |
| Sin selección, ninguna exportación de `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION] (an exported FUNCTION/1; FUNCTION defaults to main)` |
| Sin selección, varias | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (la misma indicación) |

Para los objetivos de proyecto, la indicación también nombra la clave del
manifiesto: `... --entry MODULE[:FUNCTION] or with
entry = "MODULE[:FUNCTION]" in this target's [[targets]] table of the project manifest ...`,
por ejemplo:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1; plain "app" calls app:main/1
```

## Argumentos

`Entry(Argv)` recibe una lista propia de cadenas (listas de puntos de código
Unicode), sin el nombre del programa ni las
[opciones del runtime](#runtime-options) iniciales, por lo demás sin cambios y
en orden, como `escript`.

- POSIX: los bytes de cada argumento se decodifican como UTF-8; un byte que no
  inicia una secuencia válida se convierte en el punto de código de ese byte
  (alternativa Latin-1).
- Windows: el vector de argumentos ancho (UTF-16) de la CRT, dividido con las
  mismas reglas que `argv`; un sustituto (surrogate) sin pareja se convierte
  en U+FFFD.
- El runtime no realiza ningún otro análisis de opciones, expansión de
  comodines (globbing) ni expansión de variables de entorno.

## Opciones del runtime

El runtime lee sus opciones de la variable de entorno `CLAUSE_FLAGS`
(palabras separadas por espacios y tabuladores, sin comillas) y después de
los argumentos iniciales de la línea de órdenes, así que la línea de órdenes
prevalece. Ambas se analizan igual; un valor va en el argumento siguiente o
después de `=`.

| Opción | Efecto |
| --- | --- |
| `--max-atoms N` | Tamaño de la tabla de átomos, de 1 a 2^26 (67.108.864); por defecto 2^20 (1.048.576), como `+t` de OTP |
| `--max-heap BYTES` | Límite del bloque de heap, los fragmentos y los binaries off-heap de cada proceso, como mínimo el heap mínimo (233 palabras); sin límite por defecto |
| `--max-stack BYTES` | Límite de la pila de marcos de cada proceso; sin límite por defecto |
| `--max-memory BYTES` | Límite de la memoria de todos los procesos juntos (heaps, binaries off-heap, pilas); sin límite por defecto |
| `--schedulers N` | Workers del planificador que ejecutan procesos, de 1 a 1.024; por defecto uno por procesador lógico, como `+S` de OTP ([workers](processes.md#workers)) |
| `--args-file FILE` | Archivo de opciones como `vm.args` de OTP: reservado, informa `runtime option --args-file is not implemented` |
| `--` | Termina las opciones del runtime; los argumentos siguientes van todos a `Entry` |

En la línea de órdenes, el análisis se detiene en el primer argumento que no
es una opción del runtime, así que `prog data --max-atoms 9` pasa los tres
argumentos al programa. En `CLAUSE_FLAGS` cada palabra debe ser una opción del
runtime. Un valor no válido, una palabra de la variable que no es una opción,
o `--args-file` detienen el programa antes de registrar ningún módulo:
`clau: runtime failure: <reason>`, salida 70. El número de procesos no está
limitado y la memoria no tiene límite por defecto. Los valores en bytes son
decimales sin sufijos y se redondean hacia abajo a palabras completas; un
programa que alcanza un límite falla con `resource_limit`, salida 70
([límite de memoria del runtime](runtime-heap.md#runtime-memory-limit)).

## Estado de salida

| Resultado | Estado |
| --- | --- |
| La entrada retorna (cualquier valor) | 0 |
| `erlang:halt()` | 0 |
| `erlang:halt(N)`, entero no negativo | `N` (los sistemas POSIX conservan los 8 bits bajos) |
| `erlang:halt(Slogan)` con una cadena | Slogan en stderr, después 1 (sin volcado de fallo) |
| `erlang:halt(abort)` | Aborto nativo (sin vaciado de búferes) |
| Cualquier excepción que escape de la entrada, incluidos `throw` y `exit(normal)` | Informe en stderr, 1 |
| Proceso de entrada terminado por una señal de salida ([procesos](processes.md#exit-signals)) | Se informa como un `exit` no capturado, 1; razón `normal`: 0 |
| Fallo de arranque o de infraestructura del runtime (ABI incompatible, registro, memoria antes de la entrada) | Mensaje en stderr, 70 |
| Memoria del sistema agotada (crecimiento de heap, de binary off-heap o de pila rechazado; sin límite de memoria por defecto, [agotamiento de memoria](runtime-heap.md#failure-behavior)) | `clau: runtime failure: entry call failed: out_of_memory`, 70 |

Los argumentos no válidos de `halt/1` lanzan `badarg` en quien llama. Cuando
la entrada termina, el programa sale: los demás procesos se detienen sin
seguir ejecutándose, como con `halt/1` de OTP después de que `escript`
retorne. Un halt en cualquier proceso termina el programa con su estado, y un
fallo del runtime en cualquier proceso lo termina con 70; una excepción en un
proceso lanzado con spawn solo termina ese proceso ([procesos](processes.md)).

`halt/0,1`, `error/1,2,3`, `exit/1` y `throw/1` se pueden llamar con o sin el
prefijo `erlang:`; una definición local o `-compile({no_auto_import, ...})`
mantiene local el nombre sin cualificar, como en OTP. `halt/2` no está
disponible. `halt(N)` conserva los 31 bits bajos de cualquier entero no
negativo, como hace OTP. Un slogan es una lista propia de como máximo 1.023
puntos de código Unicode. Un halt desenrolla la entrada a través del canal de
errores comprobado como un error, así que solo detiene el programa después de
la limpieza generada.

## Flujos de salida

- stdout: la salida de `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Con búfer; se vacía en todas las rutas de salida
  excepto `abort`.
- stderr: el informe de excepción no capturada, la salida de
  `standard_error`, los fallos del runtime y los informes de error de otros
  procesos que fallan ([procesos](processes.md#exits)).
- El informe es una línea `uncaught exception <class>: <reason in ~w form>`,
  seguida más adelante por los marcos de pila (step 15). Su texto exacto no es
  una interfaz estable; las pruebas lo comparan mediante patrones.

## Objeto de arranque

Compilar con una entrada explícita (`--entry` o `entry` del manifiesto) añade
un módulo de arranque después de los módulos del lote. Con `--emit` se publica
como `clausev1_start.{obj,o,ll,bc}` junto a los artefactos de los módulos (el
nombre no puede colisionar con el artefacto de un módulo). Contiene un
`abi::v1::StartupDescriptor` constante
([startup.hpp](../abi/include/clause/abi/startup.hpp)): revisión de la ABI,
ancho de término, todos los descriptores de módulo en el orden del código
fuente, las grafías del módulo y la función de entrada y un indicador de
escript. Su `int main(int, char **)` llama al `CLAUSE_main_v1` del runtime,
que:

1. Comprueba la revisión de la ABI y el ancho del descriptor de arranque y de
   cada descriptor de módulo antes de registrar nada; una discrepancia sale
   con 70.
2. Arranca el runtime y registra todos los módulos; cualquier fallo se
   detiene antes de la entrada y descarta el runtime (salida 70), de modo que
   ningún código Erlang se ejecuta sobre un lote parcial.
3. Crea el proceso de entrada, construye argv y encola la llamada a `M:F/1`
   como proceso principal; después lo ejecuta, junto con todos los procesos
   que lanza, en el ejecutor cooperativo ([procesos](processes.md)) hasta que
   termina.
4. Convierte el resultado en el estado de salida descrito arriba, imprimiendo
   los informes después de vaciar stdout; después libera todos los procesos y
   apaga el runtime en todas las rutas (excepto `halt(abort)`).

`clau -o` enlaza estos objetos por sí mismo ([enlazado](#linking)). Enlazado
manual (la [receta del harness nativo](compile.md#run-the-compiled-module-example)
sin fuente de harness):

```powershell
& $tool --emit obj --entry app --artifact-dir build/app app.erl helper.erl
clang-cl /MT build/app/*.obj build/debug/lib/clause_runtime.lib /Fe:app.exe
```

Cualquier enlazado compatible con Clang de los objetos con
`Clause::generated_program` funciona igual (véase
`tests/compiler/linking/startup.cmake`).

## Enlazado

`clau [-O0|-O2|-Os] -o PATH a.erl b.erl ...` (o
`--project FILE [--target T] -o PATH` para un objetivo seleccionado) compila
el lote en memoria, añade el objeto de arranque para la
[entrada](#entry-selection) y enlaza un ejecutable:

```sh
clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo          # build/demo.exe on Windows
```

`-Os` además coloca cada función y objeto de datos generados y del runtime en
su propia sección y enlaza con `--gc-sections` (ELF), `-dead_strip` (Mach-O) o
`/OPT:REF /OPT:ICF` (MSVC), de modo que se elimina el código al que no llega
ninguna ruta desde la entrada.

- `PATH` es relativa al lugar de invocación. Para destinos Windows se añade
  `.exe` cuando el nombre del archivo no tiene extensión. Su directorio debe
  existir.
- Enlazador: `--linker PATH` (una ruta o un nombre de programa); si no,
  `clang++` o `clang` del `PATH` y después (Windows) `%ProgramFiles%/LLVM/bin`.
  Se ejecuta como
  `<clang> --driver-mode=g++ --target=<triple> -o <staged> <objects> <runtime>`,
  así que Clang elige el enlazador de la plataforma y las bibliotecas de
  runtime de C/C++ (en Windows localiza MSVC y el SDK por sí mismo; no hace
  falta un shell de desarrollador).
- Runtime: `--runtime-library PATH`; si no, el archivo `clause_runtime` de la
  compilación que produjo `clau` (ruta registrada de forma relativa al
  ejecutable, p. ej. `bin/../lib/clause_runtime.lib`). Cada objeto nativo del
  archivo debe coincidir con la arquitectura y el formato de objeto del
  destino; por tanto, `--target-triple` para otro destino necesita un runtime
  compilado para él.
- Los objetos y el ejecutable se preparan en un directorio privado
  `.clause-link-*` junto a la salida, que se elimina después. La salida solo
  se sustituye tras un enlazado correcto, así que cualquier fallo deja sin
  cambios un archivo existente. La salida no debe ser un directorio ni un
  alias de una entrada.
- Los avisos del enlazador se reenvían a stderr; `--linker` y
  `--runtime-library` requieren `--output` o una compilación de proyecto que
  enlace.
- Las compilaciones de proyecto sin `-o` enlazan cada objetivo seleccionado
  que tenga `output` o `entry` en la salida de su manifiesto, creando los
  directorios que falten, y sustituyen las salidas solo después de que se
  hayan enlazado todos los objetivos seleccionados
  ([proyectos](projects.md#executables)).

| Fallo (salida 1) | Diagnóstico |
| --- | --- |
| No hay Clang | `cannot find clang++ or clang on PATH; install LLVM/Clang or pass --linker` / `linker not found: X` |
| No hay runtime | `runtime library not found: P; build the clause_runtime target or pass --runtime-library` |
| No es un archivo | `runtime library is not a static library: P: ...` |
| Destino incorrecto | `runtime library P contains x86_64 coff objects, but the executable targets T; ...` |
| Error de enlazado | `linking O failed: <clang> exited with status N:` seguido de la salida del enlazador (los primeros 64 KiB) |
| Destino de salida incorrecto | `output directory does not exist: D`, `artifact destination is not a regular file: O`, `artifact destination aliases an input: O` |

## Escripts

Un archivo fuente cuya primera línea empieza por `#!` se compila como
escript, en cualquier modo y con cualquier nombre de archivo (entradas
posicionales o archivos `.erl` de proyecto). Las reglas siguen el `escript` de
OTP 29 para scripts en código fuente:

- La línea `#!` se ignora. Un comentario opcional en la línea 2 y una línea
  `%%!` del emulador (línea 2, o línea 3 tras el comentario) son
  comentarios; los argumentos de `%%!` no pueden aplicarse a código compilado
  y producen un aviso.
- Si la primera forma no es `-module(...)`, el módulo es
  `<file name with '.' replaced by '_'>__escript` (incluido `?MODULE`). OTP
  añade un sufijo de marca de tiempo/único; Clause mantiene el nombre
  determinista. La declaración sintetizada ocupa la línea 1, así que los
  números de línea posteriores no cambian.
- `main/1` es obligatoria (`escript does not define main/1`) y se exporta
  implícitamente; las demás funciones siguen las reglas normales de
  exportación.
- `-mode(compile | interpret | debug | native)` se acepta y se ignora; los
  demás valores son errores. Fuera de los escripts, `-mode` sigue sin
  soportarse.
- Entrada: sin `--entry`, el único escript del lote es la entrada (prevalece
  sobre los módulos que exportan `main/1`); varios escripts son ambiguos.
- Estado de salida como en el `escript` de OTP: una excepción que escapa de la
  entrada del escript sale con 127 y `escript: exception <class>: <reason>` en
  stderr; las demás filas de la tabla de estados de salida se aplican sin
  cambios.
- Los archivos sin `#!` son módulos ordinarios. (`escript file.erl` de OTP se
  saltaría su primera línea; Clause no lo hace.) Los escripts precompilados en
  beam y en archivo no están soportados.

## Comparación con OTP

Los goldens de los [fixtures de programas](../tests/fixtures/programs/README.md)
ejecutan la entrada bajo OTP con las mismas reglas
([oráculo](../tests/compiler/programs/oracle.escript)); el mismo oráculo
genera los [casos golden de ejecutables](../tests/fixtures/executables/README.md)
que el ejecutor de extremo a extremo enlaza y ejecuta con cada política.
Diferencias con `escript` para los módulos ordinarios: las excepciones no
capturadas salen con 1 en lugar de 127, y `main/1` debe estar exportada. Los
fuentes de escript conservan las reglas de OTP (véase arriba).
