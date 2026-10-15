---
source: docs/debugging.md
sourceCommit: 6ed3851c
sourceSha256: 18d5fe2775a7c01edb18031b8f1ba632b356d04159c88b31692d1cc3d9ccf9da
translatedAt: 2026-10-15
---
# Depuración de ejecutables

`-g` emite tablas de líneas del código fuente Erlang (backlog F30). Funcionan
en todos los niveles de optimización y con `--emit`, con el enlazado
posicional mediante `-o` y con los destinos de proyecto.

## Tablas de líneas

- Cada función generada y cada fun anónimo recibe un ámbito de depuración con
  su nombre de Erlang (`leaf`, `-main/1-fun-0-`), en el archivo que lo
  declara, de modo que una función de un `.hrl` incluido pertenece a ese
  archivo. No tiene nombre de enlazado (linkage name): GDB mostraría en su
  lugar el símbolo nativo (`clausev1_...`).
- Cada expresión se ubica en su línea física del código fuente. El código al
  que se expande una macro se ubica en la invocación de la macro; el código
  incluido, en su línea del archivo incluido.
- No se describen variables ni tipos, lenguaje `DW_LANG_lo_user`. Aun así, la
  unidad de compilación es `FullDebug`: LLVM omite de DWARF los ámbitos de
  función de una unidad `LineTablesOnly` salvo que algo se haya insertado en
  línea, y entonces los depuradores nombran los marcos por su símbolo.
- Formato: CodeView para destinos MSVC, DWARF 5 en los demás. Sin `-g`, los
  objetos no llevan tablas de líneas (la inspección del IR y `--emit llvm-ir`
  siguen conservando las ubicaciones que necesitan sus comentarios de fuente).

## Enlazado

`-g` pasa `-g` al driver de Clang. Los destinos MSVC también escriben un PDB
que el ejecutable nombra solo por el nombre de archivo
(`/PDBALTPATH:%_PDB%`); se publica junto al ejecutable como `<name>.pdb`,
después del ejecutable, en la misma publicación diferida. Los ejecutables ELF
conservan DWARF en su interior. Los ejecutables Mach-O necesitarían `dsymutil`
sobre los objetos preparados antes de eliminar la preparación; esto aún no se
hace, así que los ejecutables de macOS pierden las tablas de líneas al enlazar
(una carencia hasta el [step 66](../.agents/11-plan.md#step-66)).

## Pila de llamadas de Erlang

El código generado pasa de una función a otra mediante transferencias de cola
a través de la pila del proceso ([modelo de ejecución](execution-model.md)),
así que una traza nativa muestra la función Erlang actual y después el
planificador (`ProcessStack::run`, `Executor::work`). Los marcos Erlang del
proceso detenido los imprime la función auxiliar del runtime
`clause::runtime::debug_erlang_stack()`, del más interno al más externo, como
`module:function/arity`; lee el proceso en ejecución del hilo y los nombres
compilados de los marcos, nunca las tablas de átomos del runtime:

```text
(lldb) breakpoint set --file debug.erl --line 8
(lldb) run
* thread #1, stop reason = breakpoint 1.1
    frame #0: debug.exe`leaf at debug.erl:8
(lldb) expr -- clause::runtime::debug_erlang_stack()
  debug:leaf/1
  debug:middle/1
  debug:main/1
```

En GDB la llamada se escribe `call clause::runtime::debug_erlang_stack()` tras
`set language c++` (los marcos de código Erlang no tienen un lenguaje en el que
GDB analice nombres de C++). Nombra los marcos `twice () at /path/debug.hrl:5`.
Los ejecutables `-Os` pueden descartar la función auxiliar junto con otro
código no referenciado.

## Pruebas

- `linking_debug_info`: metadatos del IR (archivos y líneas de los
  subprogramas, una macro ubicada en el archivo incluido) y secciones de tablas
  de líneas de los objetos para Windows x86-64 y x86, Linux x86-64, AArch64 y
  ARMv7 y macOS arm64 en O0/O2, y ninguna sin `-g`.
- `linking_debugger`: enlaza el fixture con `-g` en O0/O2 (y un PDB junto a él
  en Windows) y después maneja LLDB (el de la instalación de LLVM en Windows) o
  GDB: los puntos de interrupción en `debug.hrl` y `debug.erl` se detienen en
  `twice` y `leaf`, y la función auxiliar imprime sus pilas de Erlang. Un
  depurador que no arranca (el LLDB de una versión de LLVM sin su biblioteca
  de Python) se omite; sale con 77 (omitida) cuando no existe ninguno. Validado
  con LLDB en Windows x64 y GDB 16 en Linux x86-64.
