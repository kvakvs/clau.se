---
source: docs/runtime.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 2cf400ead0e2884a583331bb170855aa26c0961dcb974a1e54e32894bebbdbcf
translatedAt: 2026-10-26
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
zuletzt. Aufgelöste Funktions-Handles halten Code über den Abbau der Runtime
hinaus am Leben, aber ihre Atom-Slot-Wörter pinnen keine Schreibweisen. Der
Atomspeicher zieht seine globalen Slots zurück, bevor er Datensätze freigibt;
ein Zugriff auf die Schreibweise über einen überlebenden Term eines nicht
festen Atoms meldet `expired_context`.

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
  Host-Terme sind unverwurzelte Ein-Wort-Werte; nach einer Bereinigung sind sie
  aus umgeschriebenen Wurzeln neu aufzubauen. Sie haben keine Lebensdauer- oder
  Veraltungsprüfungen und dürfen nach Bereinigung oder Prozessende nicht
  gelesen werden. Fabriken und Reservierungen behalten eigene Lebensdauer-Tokens
  und melden weiterhin `expired_context`.

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

- Jeder Schlüssel und Wert wird in einen eigenen Bereich im Bereich
  persistenter Terme der Runtime (`memory/persistent_region`) kopiert: eine
  Adressreservierung (64 GiB Adressraum auf 64-Bit-Hosts, 256 MiB auf
  32-Bit-Hosts), deren Seiten bei der Bereichsallokation bereitgestellt werden,
  sodass ein Bereichsvergleich zeigt, ob ein Wort einen persistenten Term
  benennt. Kopien teilen nur Modulliterale, sodass jeder Bereich eigenständig
  ist; seine Binaries teilen ihre Puffer.
- Einträge sind Wurzelwörter, die über einen Hash des Schlüssels (die Builtins
  verwenden den Term-Hash von `phash2`) und exakte Gleichheit gefunden und an
  Ort und Stelle verglichen werden.
- Ein Lesen gibt das gespeicherte Wort an Ort und Stelle zurück, wie die
  literalen persistenten Terme von OTP: Jeder Prozess darf es halten;
  Speicherbereinigungen lassen es unverändert und die Zulassung akzeptiert es
  wie ein Literal. Senden an andere Prozesse, Nachrichtenpuffer und neue
  persistente Terme kopieren persistente Wörter (ein Sendevorgang durchläuft
  seine Nachricht einmal vor der Executor-Sperre, sodass er keinen Bereich
  teilen kann, der inzwischen zurückgezogen werden könnte).
- **Freigabe.** Der Bereich eines ersetzten oder gelöschten Werts wird unter
  einer neuen Epoche zurückgezogen. Von da an kopiert jede Kopie seine Wörter,
  und jeder beim Zurückziehen registrierte Prozess kopiert die gehaltenen
  zurückgezogenen Objekte in einem evakuierenden vollständigen Durchlauf in
  seinen eigenen Heap (`Copier` mit dem Bereich, jedes Objekt einmal,
  Binary-Puffer vor dem Durchlauf gehalten): ein laufender oder eingereihter
  Prozess am Anfang seiner nächsten Zeitscheibe, ein geparkter sofort durch
  das zurückziehende Schreiben oder Löschen (`Executor::evacuate_parked`,
  unter der Executor-Sperre). Sobald jeder solche Prozess dies getan hat oder
  beendet ist, wird der Bereich freigegeben. `info/0` zählt nur aktuelle
  Einträge.
- Eine geteilte Sperre bedient Leser auf beliebig vielen Workern; Schreiben und
  Löschen nehmen sie exklusiv (Kopien entstehen davor). CTest
  `runtime_persistent_terms` deckt Werte ab, die ihren Schreiber überleben,
  Lesen an Ort und Stelle über Bereinigungen und zwischen Prozessen, ersetzte
  und gelöschte Werte, die Leser halten, nebenläufige Leser und Schreiber sowie
  die Freigabe (zurückgezogene Kopien, Evakuierung, freigegebene Bereiche und
  Belastungen).

## ETS-Tabellen

Ein Verzeichnis pro Runtime (`ets/tables`), im Besitz von `Runtime::Impl` und
über `ProcessContext::ets_tables()` erreichbar, hält die Tabellen von `ets`
([Builtins](builtins.md#ets)).

- **Objekte.** Jedes gespeicherte Objekt (und die Daten eines Erben) ist ein
  `DetachedTerm` (`memory/detached_term`): eine flache Kopie in einem eigenen
  Block, durch die Graphkopie erstellt, außerhalb jedes Heaps. Modulliterale
  bleiben geteilt; persistente Terme werden kopiert, da ihre Bereiche
  zurückgezogen werden können; Binary-Zellen teilen ihre Puffer. Blöcke werden
  nie verschoben und gehören keinem Prozess, sodass Leser sie an Ort und
  Stelle vergleichen und hashen und in ihren eigenen Heap kopieren. Ihre
  Wörter werden dem Speicherkonto der Runtime belastet.
- **Indizes** (`ets/index`). Tabellen vom Typ `set`, `bag` und `duplicate_bag`
  verwenden einen Hash-Index: ein Array von Buckets mit einer Zweierpotenz als
  Größe, jedes mit einem kleinen Vektor von Einträgen (einer pro Schlüssel,
  seine Objekte in Einfügereihenfolge); es verdoppelt sich bei mehr als zwei
  Schlüsseln pro Bucket und halbiert sich bei weniger als einem pro acht.
  Schlüssel werden über die 64-Bit-Verteilung ihres `phash2`-Hashes und exakte
  Gleichheit gefunden. Tabellen vom Typ `ordered_set` verwenden ein `std::set`
  mit einem Knoten pro Schlüssel in Term-Reihenfolge, wobei gleich
  vergleichende Schlüssel (`1`, `1.0`) ein Schlüssel sind; das Ersetzen eines
  Objekts behält seinen Knoten.
- **Teile und Sperren** (`ets/table`). Eine Hash-Tabelle mit
  `write_concurrency` (`true` oder `auto`) teilt ihre Schlüssel anhand der
  höchsten Hash-Bits in 64 Teile auf, jeder ein Index mit eigenem
  `shared_mutex`; jede andere Tabelle hat einen Teil. Die Tabellensperre wird
  bei Operationen auf einzelnen Schlüsseln geteilt und bei Operationen auf der
  ganzen Tabelle exklusiv genommen (Objektlisten, `delete_all_objects/1`,
  Fixierung, Löschung), sodass das Einfügen einer Liste wie in OTP atomar und
  isoliert ist. Lesevorgänge kopieren Objekte heraus, während ihr Teil geteilt
  gesperrt ist.
- **Durchläufe und Fixierung.** Eine Hash-Tabelle wird Teil für Teil und Bucket
  für Bucket durchlaufen, rückwärts wie vorwärts; `next/2` von einem nicht
  enthaltenen Schlüssel ergibt `badarg`. Während die Tabelle fixiert ist
  (`safe_fixtable/2`, `foldl/3`), ändern ihre Indizes nie die Größe, ein
  entfernter Schlüssel bleibt als Löschmarkierung mit einem Objekt für seinen
  Schlüssel erhalten, und neue Schlüssel kommen ans Ende ihres Buckets, sodass
  ein Durchlauf jeden durchgehend vorhandenen Schlüssel einmal sieht. Das
  Aufheben der letzten Fixierung entfernt die Löschmarkierungen und passt die
  Größe an. Ein ordered_set geht von jedem Schlüssel zum nächstgelegenen.
- **Verzeichnis.** Tabellen nach Identifikationsnummer (eine gewöhnliche
  Referenz aus der Programmsequenz) und nach Namen sowie die Tabellen, die
  jeder Prozess besitzt oder fixiert. Das Ende eines Prozesses
  (`Executor::release_tables`, unter der Executor-Sperre, bevor Links und
  Monitore signalisiert werden) löst seine Fixierungen und übergibt jede seiner
  Tabellen an einen lebenden Erben außer ihm selbst, der
  `{'ETS-TRANSFER', Table, From, HeirData}` erhält (keine Nachricht für einen
  ohne Daten gesetzten Erben), oder löscht sie. Sperrreihenfolge: Executor,
  Verzeichnis, Tabelle; Builtins nehmen nie die Executor-Sperre, während sie
  eine ETS-Sperre halten, und `give_away/3` sendet seine Nachricht nach deren
  Freigabe.
- **Portionen**. `tab2list/1` und die Auswahl aller Objekte (`select/2`,
  `select_reverse/2`, `match/2`, `match_object/2`, `select_count/2`) durchlaufen
  pro Portion so viele Objekte der Tabelle, wie das Prozessbudget erlaubt, und
  unterbrechen dann mit einem Trap (`builtins/ets/table_walks.cpp`); eine
  Hash-Tabelle wird vom durchlaufenden Prozess vom ersten Trap bis zum Ende
  fixiert, wie in OTP, sodass ihre Slots an Ort und Stelle bleiben.
  `delete_all_objects/1` und `delete/1` leeren oder löschen die Tabelle sofort
  durch Herausnehmen ihrer Indizes (`Table::empty`, `Table::destroy`) und geben
  dann die alten Objekte in Portionen frei (`builtins/ets/disposal.cpp`,
  `Index::shed`); eine fixierte Hash-Tabelle wird stattdessen an Ort und Stelle
  geleert und behält ihre Löschmarkierungen. Die Tabellen eines beendeten
  Besitzers gibt der Worker nach Freigabe der Executor-Sperre frei.
  `select_delete/2` und `select_replace/2` laufen weiterhin in einem Stück.
- **Zähler an Ort und Stelle.** `update_counter/3,4` auf einem Schlüssel, dessen
  Objekt die eigene Kopie der Tabelle ist und dessen Zähler kleine Ganzzahlen
  bleiben, ändert die gespeicherten Felder unter der Sperre des Teils an Ort
  und Stelle, wie in OTP; ein Bignum, ein Modulliteralobjekt oder ein
  Standardobjekt nimmt den allgemeinen Pfad, der eine neue Kopie speichert.
- CTest `executables_ets_concurrency` deckt Zähler, Einfügungen und Durchläufe
  aus vielen Prozessen auf einem und vier Workern sowie das Ende von Besitzern
  vieler Tabellen ab; `executables_ets_portions` zeigt, dass andere Prozesse
  während langer Operationen auf einem Worker laufen.
- **Auswahl** ([Match-Spezifikationen](#match-specifications)). Eine Auswahl
  über die ganze Tabelle liest jeden Teil unter seinen Sperren; eine, deren
  Köpfe alle den Schlüssel binden, schlägt die Schlüssel nach. Eine Auswahl in
  Abschnitten durchläuft eine Hash-Tabelle Slot für Slot (jeden Slot unter der
  Sperre seines Teils) und ein ordered_set nach Schlüsseln ab dem letzten,
  sodass eine Fortsetzung einen Slot oder Schlüssel benennt. `select_delete/2`
  und `select_replace/2` bearbeiten jeden Teil unter dessen eigener Sperre
  (`Index::edit`); eine fixierte Hash-Tabelle behält dabei die Löschmarkierungen
  entfernter Schlüssel.

## Match-Spezifikationen

`runtime/src/match_spec/` kompiliert und führt Match-Spezifikationen wie
`erl_db_util.c` von OTP aus, für `ets` und `erlang:match_spec_test/3`
([Builtins](builtins.md#ets)).

- **Programme.** `compile` verwandelt eine Spezifikation in ein `Program`: pro
  Klausel ein Kopfmuster, Guard- und Rumpfausdrücke über nummerierten
  Variablenslots und die vom Kopf gebundenen Variablen (`'$$'`). Konstanten
  werden wie in OTP gefaltet (`{{...}}` und `{const, X}` zu Werten; eine
  konstante map behält ihre Schlüssel wie geschrieben) und als
  `DetachedTerm`-Kopien gehalten, sodass ein Programm keinem Prozess gehört.
  Zwei Dialekte: `table` (ets) und `trace` (Köpfe sind Argumentlisten, eine mit
  `'_'` endende Liste matcht ein Präfix, `'$N'` oder `'_'` die ganze Liste;
  Rümpfe dürfen Trace-Aktionen ausführen).
- **Prüfungen.** Der Compiler wendet die Prüfungen von OTP in dessen Reihenfolge
  an und liefert beim Linting (`erlang:match_spec_test/3`) die Meldungen von OTP
  für die erste Klausel mit Meldungen; Operanden von Aufrufen und Tupeln werden
  wie in OTP vom letzten zum ersten kompiliert; eine Meldung wird wie durch
  den Puffer von OTP bei 99 Bytes abgeschnitten. Guard-Funktionen entsprechen
  der Tabelle von OTP (`match_spec/functions.cpp`), mit den jeweils erlaubten
  Aufrufkontexten; Verschachtelung über 1000 Ebenen ergibt `system_limit`.
- **Ausführung** (`match_spec/run.cpp`). Klauseln werden der Reihe nach
  versucht. Ein Kopf bindet Teile des Objekts an Ort und Stelle (exakte
  Gleichheit für Konstanten und wiederholte Variablen, maps mit mindestens den
  Schlüsseln des Musters); Guards lesen sie an Ort und Stelle und müssen genau
  `true` ergeben; ein Rumpf kopiert jeden ausgegebenen Wert in den Heap des
  Aufrufers. Eine Guard-Funktion, die eine Ausnahme auslöst, lässt die Klausel
  scheitern; im Rumpf liefert sie stattdessen `'EXIT'`, und der Rumpf läuft weiter, ebenso
  bei `and`, `or`, `andalso` und `orelse` mit einem Term, der kein Boolean ist.
  Die meisten Guard-Funktionen sind die Term-Operationen des
  Immediate-Dienstes (`terms/immediate_terms.hpp`).
- **Kompilierte Spezifikationen** sind Handle-Referenzen, die das Programm
  halten (`match_spec/handles.cpp`), sodass sie `term_to_binary/1` innerhalb des
  Programms wie die magic references von OTP 20+ überstehen.

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

- Atome: `AtomStorage` schützt seine Schreibweisen-Map und eigenen Datensätze
  mit einem Shared Mutex. `existing` und `size` teilen ihn; `intern` sucht
  zuerst unter der geteilten Sperre, nimmt dann für eine neue Schreibweise die
  exklusive Sperre und prüft erneut, sodass konkurrierende Internierungen ein
  Wort erhalten. Die Veröffentlichung verwendet die prozessweite
  `detail::atom_table`; Zulassung und Lesen der Schreibweise verwenden deren
  sperrfreien Nummernindex (`lookup` prüft auch den Besitzer des Datensatzes).
  Feste Atome benötigen keine Sperre. Datensätze bleiben unverändert, bis der
  Abbau ihre Slots zurückzieht ([Atome](terms.md#atoms)).
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
  Modul auch, nachdem die Runtime weg ist; ihre Atom-Slots halten Wörter,
  keine Pins für Schreibweisen.
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
