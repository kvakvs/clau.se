---
source: docs/runtime.md
sourceCommit: a8c3f8f6
sourceSha256: 191e95cc2bea15e016f69e98aca4ce93be2fa8f47a09d9d1977607eceaf69fc2
translatedAt: 2026-10-17
---
# Runtime

`clause_runtime` ist eine LLVM-freie C++23-Bibliothek. Sie besitzt Kontexte,
Prozess-Heaps, Atome, geladene Module und die Verwaltung des Lebenszyklus und
führt Erlang-Prozesse auf Scheduler-Workern aus ([Prozesse](processes.md)).
Alle APIs sind projektintern; Host-Aufrufe müssen pro Runtime serialisiert
werden und dürfen sich nicht mit einem Programmlauf überschneiden, dessen
Worker sich untereinander synchronisieren ([Threads](#threads)).

## Linken

Genau eine für das Ziel gebaute Runtime über `Clause::generated_program`
linken:

```cmake
add_executable(harness harness.cpp)
target_link_libraries(harness PRIVATE Clause::generated_program)
```

Das bringt das Archiv, die ABI-/Runtime-Header und C++23 mit, aber nicht
LLVM. [link_consumer.cpp](../tests/runtime/link_consumer.cpp) zeigt einen
vollständigen Lebenszyklus.

## Lebenszyklus

[runtime.hpp](../runtime/include/clause/runtime/runtime.hpp):

- `Runtime::start(options)` → `std::expected<std::unique_ptr<Runtime>, Status>`.
  Standardwerte: aktuelle ABI-Version und native Term-Breite, `max_atoms` 2^20
  (höchstens 2^26; Programme setzen es mit `--max-atoms`,
  [Runtime-Optionen](executables.md#runtime-options)). Die Anzahl der Kontexte
  ist nicht begrenzt. `process_heap` und `process_stack` sind die Optionen der
  durch `create_context()` erzeugten Kontexte; `memory_limit_bytes` ist die
  optionale [runtimeweite Grenze](runtime-heap.md#runtime-memory-limit),
  gemeldet durch `memory_bytes()`. Alle sind standardmäßig unbegrenzt.
- `create_context()` oder `create_context(heap_options, stack_options)` →
  geliehener `ProcessContext*`, stabil bis zur Zerstörung. Heap-Standardwerte:
  minimaler Heap von 233 Wörtern (`min_heap_words`) und keine Speichergrenze
  (`limit_bytes` = `UNLIMITED_HEAP_BYTES`; ein gesetztes Budget ist ein
  Vielfaches eines Worts und mindestens der minimale Heap). Auch der Stack ist
  unbegrenzt, sofern `StackOptions::limit_words` nicht gesetzt ist.
- `destroy_context(ctx)`, `shutdown()`: Shutdown gibt `busy` zurück, solange
  Kontexte übrig sind; danach gelingt es idempotent, und spätere Aufrufe geben
  `stopped` zurück. Der Destruktor räumt verbleibende Kontexte auf.
- Kontext- und Runtime-Identitäten werden nicht wiederverwendet; Erschöpfung
  führt zu einem Fehler. Die Identität eines Kontexts trägt seine Pid-Nummer
  ([Pids](terms.md#pids-and-references)). Ein Kontext-Zeiger ist eine Leihe,
  keine Identität. `lifetime()` liefert ein schwaches Token, das vor dem Abbau
  des Heaps `alive() == false` meldet.
- Lebenszyklus-Aufrufe werfen nie und sind stumm. Statuswerte:
  [abi.md](abi.md#runtime-services).

Abbaureihenfolge: Scheduler-Einträge schließen → Kontexte zerstören →
Code-Registrierungen freigeben → Scheduler-Dienst zerstören → Atomtabelle
zuletzt. Aufgelöste Funktions-Handles halten Code und Atom-Schreibweisen über
den Abbau der Runtime hinaus am Leben, aber nie einen Prozess.

## Prozessspeicher

Jeder Kontext besitzt einen `ProcessHeap`
([process_heap.hpp](../runtime/include/process_heap.hpp)); sein Layout, seine
Bereiche, Größenbemessung, Zulassung, Wurzeln und Speicherbereinigung sind in
[runtime-heap.md](runtime-heap.md) festgelegt. Die Host-API:

- `allocate(words)` gibt genullten Wortspeicher zurück. `reserve` liefert eine
  nur verschiebbare Reservierung mit explizitem Commit und automatischem
  Rollback. Eine Reservierung pro Heap zur gleichen Zeit: zuerst die Kinder
  aufbauen, das Elternobjekt zuletzt reservieren. Rohe `allocate()`-Wörter
  müssen null bleiben oder vollständige Objekte enthalten
  ([Wort-Layout](runtime-heap.md#word-layout)).
- Null, Überlauf und ein erschöpftes Budget werden vor dem Veröffentlichen
  abgewiesen: `out_of_memory` (Allokation) oder `limit_exceeded` (Budget);
  erzeugter Code erhält den genauen Status
  ([Fehlerverhalten](runtime-heap.md#failure-behavior)).
- `add(value)`/`copy_to` kopieren einen Graphen eines anderen Prozesses
  derselben Runtime
  ([Kopieren zwischen Heaps](runtime-heap.md#copying-between-heaps)).
- `used_words` zählt allokierte Wörter, `capacity_words` den Heap-Block und die
  Fragmente, `off_heap_words` die Puffer außerhalb des Heaps, auf die dieser
  Prozess verweist, jeden einmal
  ([Größenbemessung und Budget](runtime-heap.md#sizing-and-budget)).
- `verify()` durchläuft den Heap-Block und jedes Fragment und prüft, ob jeder
  Term-Slot auf einen Objektanfang desselben Prozesses zeigt (Tests und
  Debugging; sonst `corrupt_heap`).
- `collect(roots)` kopiert alles, was von den Prozesswurzeln und den
  Wurzelwörtern des Hosts erreichbar ist, in einen neuen Heap-Block
  ([Speicherbereinigung](runtime-heap.md#collection)). Sie läuft nur an einem
  sicheren Punkt, sonst `unsafe_point`
  ([Wurzeln und sichere Punkte](runtime-heap.md#roots-and-safe-points));
  erzeugter Code bereinigt an seinen eigenen sicheren Punkten
  ([Speicherbereinigung in erzeugtem Code](runtime-heap.md#collection-in-generated-code)).

## Code-Server und Builtins

Jede Runtime besitzt einen `CodeServer`
([code_server.hpp](../runtime/include/clause/runtime/code_server.hpp),
[callable.hpp](../runtime/include/clause/runtime/callable.hpp)):

```cpp
auto functions = std::make_unique<ModuleRegistry>();
auto added = functions->add("identity", 1,
    [](ProcessContext &, std::span<const Term> args) -> CallResult<Term> { return args.front(); });
auto loaded = context.code_server().load({"native_demo", CodeImage::linked(), std::move(functions)});
auto fn = context.code_server().resolve({.module = "native_demo", .function = "identity", .arity = 1});
```

- Eine `ModuleRegistry` bildet exakten Namen/Stelligkeit (≤ 255) auf ein
  aufrufbares Objekt ab, das nur mit `Term` arbeitet. `load` friert sie ein und
  veröffentlicht sie; Duplikate oder Fehler veröffentlichen nichts.
- Die Registrierung indiziert außerdem die Bindungen erzeugter Module in
  Hash-Maps: Modul-, Record- und Fun-Deskriptoren auf ihre Bindungen und
  Definitionen sowie Atomwörter von `Module:Function/Arity` auf Export-Frames.
  Dynamische Aufrufe, `apply/3`, `fun M:F/A` zur Laufzeit und
  Deskriptor-Abfragen brauchen daher erwartet konstante Zeit in der Anzahl der
  Module und Exporte. Die Indizes werden innerhalb der Registrierung gebaut:
  Ein abgewiesenes Modul fügt keinen Eintrag hinzu, und sie ändern sich nur
  unter der exklusiven Sperre des Servers.
- `resolve` unterscheidet fehlendes Modul und fehlenden Export.
  `ResolvedFunction` hält das Modul-Image fest; `call` prüft Stelligkeit,
  Argumente und Ergebnisse und verwandelt Host-Ausnahmen in Fehler.
- Native Rümpfe müssen synchron und nicht blockierend sein und dürfen den
  Kontext oder den Argument-Span nicht festhalten.
- Ein begrenzter Katalog bekannter zurückgestellter BIFs (`self/0`,
  `length/1`, `spawn/3`, `spawn_link/3`, `send/2`, `make_ref/0`,
  `garbage_collect/0`, `apply/3` (erzeugter Code ruft `apply/2,3`
  stattdessen über die Dienste für dynamische Aufrufe auf,
  [Funs](funs.md#dynamic-calls)), `tuple_size/1`, `+/2`) meldet
  `not_implemented`; andere nicht registrierte Namen geben stumm
  `unknown_builtin` zurück. Dieser Host-Pfad erreicht die Produktions-Builtins
  nicht.
- Produktions-Builtins liegen in der `BuiltinRegistry` des Servers, beim Start
  der Runtime registriert; erzeugter Code, dynamische Aufrufe und Funs
  erreichen sie über die [Builtin-Brücke](builtins.md).
- `CodeServer::export_frame` findet den `FrameDescriptor` eines Exports nach
  Modul, Funktionsatom und Stelligkeit; `function_frame` ergänzt die Builtins
  für dynamische Aufrufe; `external_fun` interniert die Definitionen externer
  Funs, die zur Laufzeit gebaut werden.
- Module werden nie entladen; `CodeServer::unload` ist zurückgestellt, und
  dynamisches Laden wird nicht unterstützt.

## Persistente Terme

Eine Tabelle pro Runtime (`memory/persistent_terms`), im Besitz von
`Runtime::Impl` und erreichbar über `ProcessContext::persistent_terms()`, hält
die Terme von `persistent_term` ([Builtins](builtins.md#persistent-terms)).

- Ein Schlüssel und sein Wert werden jeweils in einen `MessageBuffer`
  ([Nachrichtenpuffer](runtime-heap.md#message-buffers)) außerhalb jedes
  Prozesses kopiert, sodass sie den Prozess überleben, der sie gespeichert hat,
  und keine Speicherbereinigung sie verschiebt.
- Einträge werden über einen Hash des Schlüssels (die Builtins verwenden den
  Term-Hash von `phash2`) und exakte Gleichheit gefunden, direkt im Puffer
  verglichen (`MessageBuffer::value`).
- Ein Lesen kopiert den Wert in den Heap des Lesers, wo OTP eine Referenz in
  einen Literalbereich herausgibt und dafür beim Ersetzen oder Löschen mit einer
  globalen Speicherbereinigung bezahlt ([Unterschiede](differences.md)). Jeder
  Prozess-Heap bleibt in sich abgeschlossen: Ein ersetzter oder gelöschter Wert
  wird freigegeben, wenn der letzte Leser, der ihn noch kopiert, seine
  Pufferreferenz aufgibt, und keine globale Speicherbereinigung ist nötig.
- Eine geteilte Sperre bedient Leser auf beliebig vielen Workern; Schreiben und
  Löschen nehmen sie exklusiv und kopieren nie, während sie sie halten. CTest
  `runtime_persistent_terms` deckt Werte ab, die ihren Schreiber überleben,
  ersetzte Werte, die Leser halten, nebenläufige Leser und Schreiber sowie
  freigegebene Belastungen.

## Scheduler-Buchführung

`SchedulerService`
([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp)) ist ein dem
Host zugewandtes Verzeichnis des Lebenszyklus von Prozessen; er führt keinen
Code aus. Programme laufen auf dem Executor
([Prozesse](processes.md#executor)), der ihn nicht verwendet.

- `register_process(context)` einmal pro Kontext (dieselbe Runtime);
  Duplikate geben `already_registered` zurück. `remove_process(id)` nimmt
  einen nicht laufenden Eintrag außer Dienst.
- `begin_dispatch` → laufend; `finish_dispatch` → lauffähig, wartend oder
  beendet (mit Grund). `set_suspended` schaltet ein Flag an lauffähigen oder
  wartenden Einträgen um. Andere Übergänge geben `invalid_transition` zurück.
- `request_shutdown()` schließt Registrierung, Dispatch und
  Suspendierungssteuerung; Inspektion und Rückgaben bleiben zum Leeren
  verfügbar.
- `run` und `execute` melden `not_implemented`.

## Threads

Scheduler-Worker ([Worker](processes.md#workers)) führen Prozesse auf mehreren
Threads einer Runtime aus. Dienste, die sie gemeinsam nutzen, sind
synchronisiert; alles andere bleibt auf den Thread beschränkt, der seinen
Prozess ausführt, oder wird durch den Mutex des Executors geschützt.

- Atome: `AtomStorage` schützt beide Indizes mit einem Shared Mutex.
  Abfragen (`lookup`, `boolean`, `size`) teilen ihn; `intern` sucht unter der
  geteilten Sperre, und nur eine neue Schreibweise nimmt die exklusive Sperre,
  prüft erneut und veröffentlicht den Eintrag, sodass konkurrierende
  Internierungen einer Schreibweise ein einziges Wort erhalten. Wörter bleiben
  stabil: Ein Eintrag wird vor dem Abbau nie geändert oder entfernt. Die
  Zulassung von Atomwörtern liest einen sperrfreien Index
  ([Atome](terms.md#atoms)).
- Code: `CodeServer` schützt seine Module und die Definitionen externer Funs
  mit einem Shared Mutex. Abfragen (`find_module`, `resolve`, `atom_word`,
  `record_definition`, `fun_definition`, `export_frame`, `function_frame`,
  `owns`) teilen ihn; `load` und der Aufbau einer neuen Definition einer
  externen Fun nehmen ihn exklusiv, sodass nebenläufige Registrierungen eines
  Namens ein einziges Modul veröffentlichen (die anderen erhalten
  `duplicate_module`) und konkurrierende `external_fun`-Aufrufe eine einzige
  Definition erhalten. Die Builtin-Registry wird beim Start der Runtime
  gefüllt, bevor irgendein Worker läuft, und danach nur gelesen.
- Festhalten: Module werden nie entfernt, solange die Runtime lebt, und der
  Server wird nach jedem Kontext zerstört, sodass Definitionen, Frames und
  Atom-Slots, die er zurückgegeben hat, für jeden Aufruf und jede Fun-Zelle
  gültig bleiben. Handles von `ResolvedFunction` und `find_module` behalten ihr
  Modul auch, nachdem die Runtime weg ist.
- Pid- und Port-Nummern: `IdentityNumbers` vergibt Nummern unter einer
  exklusiven Sperre und lässt Pid- und Port-Wörter unter einer geteilten zu.
- Speicher: Das runtimeweite Konto (`RuntimeMemory`) belastet und entlastet mit
  atomaren Operationen; eine Belastung bringt das Konto nie über eine optionale
  Grenze.
- Andere Threads: Der Timer-Thread
  ([Empfangs-Timeouts](processes.md#receive-timeouts)), der I/O-Thread und
  unter Windows der Lese-Thread einer `fd`-Eingabe
  ([I/O-Thread](ports.md#io-thread)) berühren Prozesszustand nur über den
  Mutex des Executors.
- Linken: Unter Linux fügt die Runtime für ihre Threads `-pthread` hinzu; unter
  Windows linkt sie Winsock (`ws2_32`, `mswsock`) für Sockets.

## Standardausgabe

`RuntimeOptions::standard_output`
([output.hpp](../runtime/include/clause/runtime/output.hpp)) empfängt
`erlang:display/1` und `io`-Ausgaben auf die Standardausgabe ([io](io.md)). Der
Standard schreibt über C-stdio (gepuffert) auf `stdout` des Prozesses; eine
Host-Senke gibt `false` zurück, um einen gescheiterten Schreibvorgang zu
melden.

`erlang:display/1` stellt sein Argument im [Anzeigestil](terms.md#printing)
dar, schreibt den Text und einen Zeilenumbruch in einem Schreibvorgang und gibt
`true` zurück. Darstellungsgrenzen und abgewiesene Schreibvorgänge werden zu
Infrastruktur-Status (`resource_limit`, `output_failure`, ...) im geprüften
Kanal, nie zu Erlang-Ausnahmen.

## Programmstart

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) führt ein ganzes Programm für das erzeugte `main` aus
([ausführbare Dateien](executables.md)): Es prüft die ABI jedes Deskriptors,
startet eine Runtime, registriert alle Module vor jeglichem Einstiegscode, baut
argv im Einstiegskontext auf, führt den Einstiegspunkt auf dem Executor aus und
bildet das Ergebnis auf den [Exit-Status](executables.md#exit-status) ab.
Berichte gehen nach dem Leeren von stdout an stderr; Kontext und Runtime werden
auf jedem Pfad in Reihenfolge abgebaut. `CLAUSE_halt_v1` implementiert
`erlang:halt/0,1` (`abort` ruft `std::abort` auf).

## Zurückgestellte Dienste

Diese melden eine Zeile `[feature] notimpl` ([Features](features.md)) und
ändern keinen Zustand:

| Grenze | Fehler |
| --- | --- |
| `TermFactory::function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` auf einem katalogisierten BIF | `Status::not_implemented` |
