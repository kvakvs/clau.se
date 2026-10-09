---
source: docs/runtime.md
sourceCommit: 06042fa
sourceSha256: 6baeafe0372058547653e00c8d05e2f39a894329ac165b982d1553ad6ba2093e
translatedAt: 2026-10-09
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
  geliehener `ProcessContext*`,
  stabil bis zur Zerstörung. Heap-Standardwerte: minimaler Heap von 233 Wörtern
  (`min_heap_words`) und keine Speichergrenze (`limit_bytes` =
  `UNLIMITED_HEAP_BYTES`; ein gesetztes Budget ist ein Vielfaches eines Worts
  und mindestens der minimale Heap). Auch der Stack ist unbegrenzt, sofern
  `StackOptions::limit_words` nicht gesetzt ist.
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

Jeder Kontext besitzt einen `ProcessHeap`: einen einzigen Heap-Block, der durch
seine erste Allokation erzeugt wird und die Größe
`max(min_heap_words, request)` hat, plus eine Kette von Heap-Fragmenten im
Besitz desselben Prozesses. Wörter bewegen sich nur, wenn der Host an einem
sicheren Punkt `collect()` aufruft.

Der Heap folgt dem klassischen ERTS-Design; [runtime-heap.md](runtime-heap.md)
ist sein Vertrag (Layout, Bereiche, Größenbemessung, Zulassung, Wurzeln,
Speicherbereinigung).

- `allocate(words)` gibt genullten Wortspeicher zurück. `reserve` liefert eine
  nur verschiebbare Reservierung mit explizitem Commit und automatischem
  Rollback. Eine Reservierung pro Heap zur gleichen Zeit: zuerst die Kinder
  aufbauen, das Elternobjekt zuletzt reservieren.
- Bump-Allokation füllt den Heap-Block; eine Anfrage, die nicht passt, geht an
  das neueste Fragment, sonst an ein neues Fragment der Größe
  `max(min_heap_words, request)` (begrenzt durch das verbleibende Budget).
  Wörter sind nur auf Wortgrenzen ausgerichtet. Ein Rollback setzt das obere
  Ende des Bereichs zurück, verwirft ein durch die Reservierung erzeugtes
  Fragment (oder den Heap-Block) und stellt die Buchführung exakt wieder her.
- Lehnt null, Überlauf und erschöpftes Budget vor dem
  Veröffentlichen ab. Fehler: `out_of_memory` (Allokation) oder
  `limit_exceeded` (Budget); erzeugter Code erhält den genauen Status.
- Binaries über 64 Bytes liegen in gemeinsamen Puffern außerhalb des Heaps.
  Jede Heap-Zelle, die auf einen verweist, hält einen `std::shared_ptr` und
  tritt bei der Veröffentlichung der Off-Heap-Liste des Prozesses bei; der
  Abbau durchläuft die Liste und gibt diese Referenzen frei
  ([Off-Heap-binaries](runtime-heap.md#off-heap-binaries)).
- `add(value)`/`copy_to` kopieren einen Graphen eines anderen Prozesses
  derselben Runtime, unter Erhalt seiner gemeinsamen Teile und mit gemeinsamer
  Nutzung von Off-Heap-Puffern; eine gescheiterte Kopie ändert nichts
  ([Kopieren zwischen Heaps](runtime-heap.md#copying-between-heaps)).
- `used_words` zählt allokierte Wörter; `capacity_words` zählt Heap-Block und
  Fragmente; `off_heap_words` zählt die Puffer, auf die dieser Prozess
  verweist, jeden einmal. Hintergrund- plus Off-Heap-Wörter teilen sich das
  optionale Budget `limit_bytes`; eine Speicherbereinigung lässt die Hälfte
  des Budgets übrig, nachdem die Überlebenden freigeben, sodass seine
  Erschöpfung bedeutet, dass die lebenden Daten nicht mehr hineinpassen
  ([Fehlerverhalten](runtime-heap.md#failure-behavior)).
- Jedes benutzte Wort lässt sich als Objekt mit führendem Header, als
  Cons-Zelle oder als Füllwort lesen
  ([Wort-Layout](runtime-heap.md#word-layout)); reservierte Wörter beginnen
  genullt. Rohe `allocate()`-Wörter müssen null bleiben oder vollständige
  Objekte enthalten.
  `verify()` durchläuft den Heap-Block und jedes Fragment und prüft, ob jeder
  Term-Slot auf einen Objektanfang desselben Prozesses zeigt (Tests und
  Debugging; sonst `corrupt_heap`).
- `collect(roots)` kopiert alles, was von den Prozesswurzeln und den
  Wurzelwörtern des Hosts erreichbar ist, in einen neuen Heap-Block, gibt den
  alten Block und die Fragmente frei, gibt tote Off-Heap-binaries frei und
  schreibt die Wurzeln um ([Speicherbereinigung](runtime-heap.md#collection)).
  Erzeugter Code bereinigt an Funktionseintritten und Schleifenköpfen von
  comprehensions, wenn `wants_collection()`
  ([Speicherbereinigung in erzeugtem Code](runtime-heap.md#collection-in-generated-code)).
  Sie läuft nur an einem sicheren Punkt (kein
  erzeugter Code läuft außerhalb eines `SafePoint`-Bereichs, keine offene
  Reservierung), sonst `unsafe_point`; das
  [Wurzelinventar](runtime-heap.md#roots-and-safe-points) listet, was sie
  umschreibt; scheitert die Allokation des neuen Blocks, ergibt das
  `out_of_memory`, ohne dass sich etwas ändert.

## Code-Server und Builtins

Jede Runtime besitzt einen `CodeServer` ([code_server.hpp](../runtime/include/clause/runtime/code_server.hpp),
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
- `resolve` unterscheidet fehlendes Modul und fehlenden Export.
  `ResolvedFunction` hält das Modul-Image fest; `call` prüft Stelligkeit,
  Argumente und Ergebnisse und verwandelt Host-Ausnahmen in Fehler.
- Native Rümpfe müssen synchron und nicht blockierend sein und dürfen den
  Kontext oder den Argument-Span nicht festhalten.
- Ein begrenzter Katalog bekannter zurückgestellter BIFs (`self/0`,
  `length/1`, `spawn/3`, `spawn_link/3`, `send/2`, `make_ref/0`,
  `garbage_collect/0`, `apply/3` (erzeugter Code ruft `apply/2,3`
  stattdessen über die Dienste für dynamische Aufrufe auf,
  [funs](funs.md#dynamic-calls)), `tuple_size/1`, `+/2`) meldet
  `not_implemented`; andere nicht registrierte Namen geben stumm
  `unknown_builtin` zurück. Dieser Host-Pfad erreicht die Produktions-Builtins
  nicht.
- Produktions-Builtins liegen in der `BuiltinRegistry` des Servers, beim Start
  der Runtime registriert; erzeugter Code, dynamische Aufrufe und funs
  erreichen sie über die [Builtin-Brücke](builtins.md).
- `CodeServer::export_frame` findet den `FrameDescriptor` eines Exports nach
  Modul, Funktionsatom und Stelligkeit; `function_frame` ergänzt die Builtins
  für dynamische Aufrufe; `external_fun` interniert die Definitionen externer
  funs, die zur Laufzeit gebaut werden.
- `CodeServer::unload` ist zurückgestellt; dynamisches Laden wird nicht
  unterstützt.

## Scheduler-Buchführung

`SchedulerService` ([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp))
verzeichnet nur den Lebenszyklus von Prozessen; er führt keinen Code aus.

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

Entwurfsskizzen für Worker und Prozesse liegen in
[runtime/design/](../runtime/design/) und `runtime/include/{scheduler,process}.hpp`.
Nachrichten sind umgesetzt ([Prozesse](processes.md#messages)): Eine Sendung
kopiert die Nachricht in den Heap des Empfängers und hängt sie an seinen
Signal-Eingang an (`runtime/include/mailbox.hpp`).

## Threads

Scheduler-Worker (Plan-Step 56, [Worker](processes.md#workers)) führen
Prozesse auf mehreren Threads einer Runtime aus. Dienste, die sie gemeinsam
nutzen, sind synchronisiert; alles andere bleibt auf den Thread beschränkt, der
seinen Prozess ausführt, oder wird durch den Mutex des Executors geschützt.

- Atome (step 54): `AtomStorage` schützt beide Indizes mit einem Shared Mutex.
  Abfragen (`lookup`, `boolean`, `size`) teilen ihn; `intern` sucht unter der
  geteilten Sperre, und nur eine neue Schreibweise nimmt die exklusive Sperre,
  prüft erneut und veröffentlicht den Eintrag, sodass konkurrierende
  Internierungen einer Schreibweise ein einziges Wort erhalten. Wörter bleiben
  stabil: Ein Eintrag wird vor dem Abbau nie geändert oder entfernt.
- Code (step 55): `CodeServer` schützt seine Module und die Definitionen
  externer funs mit einem Shared Mutex. Abfragen (`find_module`, `resolve`,
  `atom_word`, `record_definition`, `fun_definition`, `export_frame`,
  `function_frame`, `owns`) teilen ihn; `load` und der Aufbau einer neuen
  Definition eines externen fun nehmen ihn exklusiv, sodass nebenläufige
  Registrierungen eines Namens ein einziges Modul veröffentlichen (die anderen
  erhalten `duplicate_module`) und konkurrierende `external_fun`-Aufrufe eine
  einzige Definition erhalten. Die Builtin-Registry wird beim Start der Runtime
  gefüllt, bevor irgendein Worker läuft, und danach nur gelesen.
- Festhalten: Module werden nie entfernt, solange die Runtime lebt (Entladen
  ist zurückgestellt), und der Server wird nach jedem Kontext zerstört, sodass
  Definitionen, Frames und Atom-Slots, die er zurückgegeben hat, für jeden
  Aufruf und jede fun-Zelle gültig bleiben. Handles von `ResolvedFunction` und
  `find_module` behalten ihr Modul auch, nachdem die Runtime weg ist.
- Pid-Nummern (step 56): `ProcessNumbers` vergibt Nummern unter einer
  exklusiven Sperre und akzeptiert Pid-Wörter unter einer geteilten.
- Speicher (step 56): Das runtimeweite Konto (`RuntimeMemory`) belastet und
  entlastet mit atomaren Operationen; eine Belastung bringt das Konto nie über
  eine optionale Grenze.
- Port-I/O (Steps 57C–57F): Die Lese-, Schreib- und Überwachungs-Threads des
  I/O-Dienstes und der Socket-Thread ([Ports](ports.md#io-thread)) berühren
  Prozesszustand nur über den Mutex des Executors.
- Linken: Unter Linux fügt die Runtime für ihre Threads `-pthread` hinzu; unter
  Windows linkt sie Winsock (`ws2_32`, `mswsock`) für Sockets.

## Standardausgabe

`RuntimeOptions::standard_output` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
empfängt `erlang:display/1` und später Bytes von `standard_io`. Der Standard
schreibt über C-stdio (gepuffert) auf `stdout` des Prozesses; eine Host-Senke
gibt `false` zurück, um einen gescheiterten Schreibvorgang zu melden.

`erlang:display/1` stellt sein Argument im [Anzeigestil](terms.md#printing)
dar, schreibt den Text und einen Zeilenumbruch in einem Schreibvorgang und gibt
`true` zurück. Darstellungsgrenzen und abgewiesene Schreibvorgänge werden zu
Infrastruktur-Status (`resource_limit`, `output_failure`, ...) im geprüften
Kanal, nie zu Erlang-Ausnahmen.

## Programmstart

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) führt ein ganzes Programm für das erzeugte `main` aus:
Es prüft die ABI jedes Deskriptors, startet eine Standard-Runtime, registriert
alle Module vor jeglichem Einstiegscode, baut argv im Einstiegskontext auf,
ruft den Einstiegspunkt auf und bildet das Ergebnis auf den Exit-Status aus
[ausführbare Dateien](executables.md#exit-status) ab. Berichte gehen nach dem
Leeren von stdout an stderr; Kontext und Runtime werden auf jedem Pfad in
Reihenfolge abgebaut. `CLAUSE_halt_v1` implementiert `erlang:halt/0,1`
(`abort` ruft `std::abort` auf).

## Zurückgestellte Dienste

Diese melden eine Zeile `[feature] notimpl` ([Features](features.md)) und
ändern keinen Zustand:

| Grenze | Fehler |
| --- | --- |
| `TermFactory::port` (noch keine Ports, Plan-Step 53), `reference(ReferenceIdentity)` und `function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` auf einem katalogisierten BIF | `Status::not_implemented` |
