---
source: docs/debugging.md
sourceCommit: 6ed3851c
sourceSha256: 18d5fe2775a7c01edb18031b8f1ba632b356d04159c88b31692d1cc3d9ccf9da
translatedAt: 2026-10-15
---
# Debugging ausführbarer Dateien

`-g` erzeugt Zeilentabellen für den Erlang-Quelltext (Backlog F30). Sie
funktionieren auf jeder Optimierungsstufe sowie mit `--emit`, positionalem
Linken mit `-o` und Projektzielen.

## Zeilentabellen

- Jede erzeugte Funktion und jede anonyme Fun erhält einen Debug-Scope, benannt
  nach ihrem Erlang-Namen (`leaf`, `-main/1-fun-0-`), in der Datei, die sie
  deklariert, sodass eine Funktion aus einer eingebundenen `.hrl` zu dieser
  Datei gehört. Er hat keinen Linkage-Namen: GDB würde sonst das native Symbol
  (`clausev1_...`) anzeigen.
- Jeder Ausdruck ist an seiner physischen Quelltextzeile verortet. Code, zu dem
  ein Makro expandiert, ist am Aufruf des Makros verortet; eingebundener Code an
  seiner Zeile in der eingebundenen Datei.
- Es werden keine Variablen oder Typen beschrieben, Sprache `DW_LANG_lo_user`.
  Die Übersetzungseinheit ist trotzdem `FullDebug`: LLVM lässt die
  Funktions-Scopes einer `LineTablesOnly`-Einheit aus DWARF weg, sofern nichts
  geinlinet wurde, und Debugger benennen Frames dann nach Symbol.
- Format: CodeView für MSVC-Ziele, sonst DWARF 5. Ohne `-g` tragen Objekte keine
  Zeilentabellen (IR-Inspektion und `--emit llvm-ir` behalten dennoch die Orte,
  die ihre Quelltextkommentare brauchen).

## Linken

`-g` reicht `-g` an den Clang-Treiber weiter. MSVC-Ziele schreiben außerdem eine
PDB, die die ausführbare Datei nur über den Dateinamen nennt
(`/PDBALTPATH:%_PDB%`); sie wird als `<name>.pdb` neben der ausführbaren Datei
veröffentlicht, nach ihr, in derselben verzögerten Veröffentlichung.
ELF-Dateien behalten DWARF in sich. Mach-O-Dateien bräuchten `dsymutil` über
die bereitgestellten Objekte, bevor die Bereitstellung entfernt wird; das
geschieht noch nicht, daher verlieren ausführbare Dateien unter macOS beim
Linken ihre Zeilentabellen (eine Lücke bis
[step 66](../.agents/11-plan.md#step-66)).

## Erlang-Aufrufstapel

Erzeugter Code wechselt zwischen Funktionen durch Endübergaben über den
Prozess-Stack ([Ausführungsmodell](execution-model.md)), daher zeigt ein
nativer Backtrace die aktuelle Erlang-Funktion und dann den Scheduler
(`ProcessStack::run`, `Executor::work`). Die Erlang-Frames des angehaltenen
Prozesses gibt die Runtime-Hilfsfunktion
`clause::runtime::debug_erlang_stack()` aus, den innersten zuerst, als
`module:function/arity`; sie liest den laufenden Prozess des Threads und die
kompilierten Namen der Frames, nie die Atomtabellen der Runtime:

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

GDB schreibt den Aufruf `call clause::runtime::debug_erlang_stack()` nach
`set language c++` (Frames von Erlang-Code haben keine Sprache, in der GDB
C++-Namen parst). Es benennt die Frames `twice () at /path/debug.hrl:5`.
Ausführbare Dateien mit `-Os` können die Hilfsfunktion zusammen mit anderem
nicht referenziertem Code verlieren.

## Tests

- `linking_debug_info`: IR-Metadaten (Dateien und Zeilen von Subprogrammen, ein
  in der eingebundenen Datei verortetes Makro) und Abschnitte mit
  Zeilentabellen in Objekten für x86-64 und x86 Windows, x86-64, AArch64 und
  ARMv7 Linux und arm64 macOS bei O0/O2, und keine ohne `-g`.
- `linking_debugger`: linkt das Fixture mit `-g` bei O0/O2 (und unter Windows
  eine PDB daneben) und steuert dann LLDB (unter Windows das der
  LLVM-Installation) oder GDB: Breakpoints in `debug.hrl` und `debug.erl`
  halten in `twice` und `leaf` an, und die Hilfsfunktion gibt ihre
  Erlang-Stacks aus. Ein Debugger, der nicht startet (das LLDB eines
  LLVM-Releases ohne seine Python-Bibliothek), wird übergangen; Exit 77
  (übersprungen), wenn keiner existiert. Validiert mit LLDB unter Windows x64
  und GDB 16 unter Linux x86-64.
