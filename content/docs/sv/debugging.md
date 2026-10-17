---
source: docs/debugging.md
sourceCommit: a8c3f8f6
sourceSha256: b93973504afffd4df57d0a39ac405818a080f79a56515e27f312fdcaec3e3e8b
translatedAt: 2026-10-17
---
# Felsöka körbara filer

`-g` genererar radtabeller för Erlang-källkoden. De fungerar på varje
optimeringsnivå och med `--emit`, positionell länkning med `-o` och projektmål.

## Radtabeller

- Varje genererad funktion och anonym fun får ett felsökningsomfång (debug
  scope) som namnges efter sitt Erlang-namn (`leaf`, `-main/1-fun-0-`), i filen
  som deklarerar den, så att en funktion från en inkluderad `.hrl` hör till den
  filen. Det har inget länkningsnamn: GDB skulle då visa den inbyggda symbolen
  (`clausev1_...`) i stället.
- Varje uttryck placeras på sin fysiska källrad. Kod som ett makro expanderar
  till placeras där makrot anropas; inkluderad kod på sin rad i den inkluderade
  filen.
- Inga variabler eller typer beskrivs, språket är `DW_LANG_lo_user`.
  Kompileringsenheten är ändå `FullDebug`: LLVM utelämnar funktionsomfången i en
  `LineTablesOnly`-enhet från DWARF om inget inlinades, och debuggrar namnger då
  ramar efter symbol.
- Format: CodeView för MSVC-mål, DWARF 5 på andra. Utan `-g` innehåller objekt
  inga radtabeller (IR-inspektion och `--emit llvm-ir` behåller ändå de platser
  som deras källkommentarer behöver).

## Länkning

`-g` skickar `-g` till Clang-drivrutinen. MSVC-mål skriver också en PDB som den
körbara filen anger endast med filnamn (`/PDBALTPATH:%_PDB%`); den publiceras
bredvid den körbara filen som `<name>.pdb`, efter den körbara filen, i samma
uppskjutna publicering. Körbara ELF-filer behåller DWARF internt. Körbara
Mach-O-filer skulle behöva `dsymutil` över de mellanlagrade objekten innan
mellanlagringen tas bort; det körs inte, så körbara filer för macOS förlorar
radtabellerna vid länkning.

## Erlangs anropsstack

Genererad kod rör sig mellan funktioner genom svansöverföringar via processtacken
([exekveringsmodell](execution-model.md)), så en inbyggd bakåtspårning visar den
aktuella Erlang-funktionen och sedan schemaläggaren (`ProcessStack::run`,
`Executor::work`). Erlang-ramarna för den stoppade processen skrivs ut av
runtimens hjälpfunktion `clause::runtime::debug_erlang_stack()`, innersta först,
som `module:function/arity`; den läser trådens körande process och ramarnas
kompilerade namn, aldrig runtimens atomtabeller:

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

GDB skriver anropet `call clause::runtime::debug_erlang_stack()` efter
`set language c++` (ramar i Erlang-kod har inget språk som GDB tolkar C++-namn
i). Den namnger ramarna `twice () at /path/debug.hrl:5`. Körbara filer byggda
med `-Os` kan ta bort hjälpfunktionen tillsammans med annan orefererad kod.

## Tester

- `linking_debug_info`: IR-metadata (filer och rader för underprogram, ett makro
  placerat i den inkluderade filen) och sektioner med radtabeller i objekt för
  x86-64 och x86 Windows, x86-64, AArch64 och ARMv7 Linux och arm64 macOS vid
  O0/O2, och inga utan `-g`.
- `linking_debugger`: länkar fixturen med `-g` vid O0/O2 (och en PDB bredvid den
  på Windows) och styr sedan LLDB (LLVM-installationens på Windows) eller GDB:
  brytpunkter i `debug.hrl` och `debug.erl` stannar i `twice` och `leaf`, och
  hjälpfunktionen skriver ut deras Erlang-stackar. En debugger som inte startar
  (en LLVM-versions LLDB utan sitt Python-bibliotek) hoppas över; exit 77
  (överhoppat) när ingen finns. Validerat med LLDB på Windows x64 och GDB 16 på
  Linux x86-64.
