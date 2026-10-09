---
source: docs/abi.md
sourceCommit: 06042fa
sourceSha256: f8f56cfac2333ccc8481b962036e323d397415d2505365d432a3e26b811a54b6
translatedAt: 2026-10-09
---
# ABI des erzeugten Codes (Revision 4)

Privater Vertrag zwischen der Compilerausgabe und der Runtime. Er ist
projektinternes C++23, nicht BEAM-kompatibel und kein allgemeines FFI. Objekte
und Runtime müssen aus demselben Build stammen; ältere Deskriptorrevisionen
werden vor der Verwendung zurückgewiesen.

Header: [v1.hpp](../abi/include/clause/abi/v1.hpp) (Term-/Kontext-/
Funktionstypen), [term.hpp](../abi/include/clause/abi/term.hpp) (Codec für
Immediate-Ganzzahlen), [status.hpp](../abi/include/clause/abi/status.hpp),
[builtins.hpp](../abi/include/clause/abi/builtins.hpp),
[startup.hpp](../abi/include/clause/abi/startup.hpp) (Programmstart).

## Terme

Ein Term ist ein vorzeichenloses Wort in Zielzeigerbreite (32 oder 64 Bits).
Layouts leiten sich vom konfigurierten LLVM-Ziel ab, sodass zielübergreifender
Code die Breiten des Ziels verwendet.

- Kleine Ganzzahlen: die unteren vier Bits `0xf`; vorzeichenbehaftete
  Nutzdaten von `word_bits - 4` Bits, Bereich
  `[-2^(word_bits-5), 2^(word_bits-5)-1]`. Größere Werte sind Heap-Bignums.
- Atome: die unteren sechs Bits `0x0b`, prozessweit gültige, nicht
  wiederverwendete Nutzdaten. IDs werden nie serialisiert oder zum Ordnen
  verwendet.
- Leeres Tupel genau `0x2b` und nil genau `0x3b`; andere Nutzdatenbits sind
  ungültig.
- Lokale Pids: die unteren vier Bits `0x3`, Nutzdaten die Prozessnummer, nur
  zugelassen, wenn die Runtime sie vergeben hat
  ([Pids und Referenzen](terms.md#pids-and-references)).
- Geboxte und Listenwörter zeigen in den Heap des besitzenden Prozesses und
  werden erst zugelassen, nachdem die Runtime den Besitz nachgewiesen hat
  (siehe [Terme](terms.md)).

## Funktionen und Symbole

Eintrittssignatur (native C-Aufrufkonvention, keine C-Linkage erforderlich):

```cpp
TermWord function(ProcessContext *context, const TermWord *arguments);
```

Die Argumente sind ein geliehenes, wortausgerichtetes Array in
Quelltextreihenfolge (null bei Stelligkeit 0). Der Kontext ist lebendig und wird
unverändert durch Aufrufe gereicht. Ein zurückgegebenes Wort ist erst nach
Prüfung des Fehlerkanals verwendbar.

Symbole: `clausev1_<hex module>_<hex function>_<arity>`, kleingeschriebenes Hex
der UTF-8-Bytes, kanonische dezimale Stelligkeit; umkehrbar und unabhängig vom
Host. Exportierte Eintrittspunkte sind extern, andere intern.

## Modulregistrierung

Jedes Modul erzeugt `clausev1_<hex module>__0.descriptor` und `.register`. Der
Deskriptor enthält ABI-Version, Termbreite, Exporttabelle (Name, Stelligkeit,
Host-Eintrittspunkt und den `FrameDescriptor`, den dynamische Aufrufe
betreten), Atomschreibweisen (UTF-8-Paare aus Zeiger und Größe),
Deskriptoren für native records (Atomplätze für Modul, Name und Felder,
Export-Flag; [native records](native-records.md#representation)) in einer
externen Tabelle `<prefix>.records`, auf die andere Module eines Batches
verweisen, und fun-Deskriptoren in einer privaten Tabelle `<prefix>.funs`
([Funs](funs.md#representation)). Die Registrierung ruft
`CLAUSE_register_module_v4(Runtime*)` auf, das Version/Breite und alle Exporte
validiert, Atome interniert, eine eingefrorene Registry aufbaut und sie
zusammen mit dem Code-Image in einer Transaktion veröffentlicht. Doppelte Module
ersetzen nie Code; jeder Fehlschlag veröffentlicht nichts (bereits internierte
Atome bleiben in der begrenzten Tabelle).

- `.register` muss explizit aufgerufen werden, bevor Exporte aufgelöst werden.
  Es gibt keine globalen Konstruktoren; Nutzer statischer Archive müssen auf
  die Registrierungseinträge verweisen.
- `llvm.used` hält Deskriptoren und Eintrittspunkte; das Linken ohne die
  Runtime scheitert am fehlenden Service-Symbol.
- Die Deskriptoradresse ist der Schlüssel der Atombindung; ihr Image muss für
  die Lebensdauer des Moduls gemappt bleiben. Jede Runtime hat ihre eigenen
  Bindungen für dasselbe Image.
- Atomausdrücke lesen Plätze über `CLAUSE_atom_v3`; sie internieren nie.
- Ein Startobjekt (`clausev1_start`) listet jeden Deskriptor in einem
  `StartupDescriptor` auf, und sein natives `main` ruft
  `CLAUSE_main_v1(argc, argv, descriptor)` auf, das alle Module registriert
  und den Eintrittspunkt ausführt
  ([ausführbare Dateien](executables.md#startup-object)).

## Fehlerkanal (Revision 2)

Fehler werden nicht in Termbits kodiert. Nach jedem erzeugten Aufruf, der kein
Endaufruf ist, prüft der Aufrufer `CLAUSE_call_failed_v2(context)`, bevor er das
Ergebnis verwendet oder das nächste Argument auswertet. Bei einem Fehlschlag
liefert der Aufgerufene ein ungültiges Null-Wort.

| Ergebnis | Transport |
| --- | --- |
| Musterabweichung, Ablehnung durch Guard | Fortsetzung beim nächsten Kandidaten; Kanal unberührt |
| Erschöpfte Klauseln | `error:function_clause`; `error:{case_clause, Value}` mit eigenen Nutzdaten bei einem `case`; `error:if_clause`; `error:{try_clause, Value}` bei den `of`-Klauseln eines try; `error:{else_clause, Value}` bei den `else`-Klauseln eines maybe |
| Fehlgeschlagener Match im Rumpf | `error:{badmatch, Value}` mit eigenen Nutzdaten |
| Comprehensions | `error:{bad_generator, Tail}`, `error:{bad_filter, Value}`, `error:{bad_generators, Inputs}` (`ErrorReason` 16-18); die Ablehnung durch einen strikten Generator ist `{badmatch, Element}` |
| record-Zugriff, ungültige Argumente, Arithmetik, Maps | `badrecord`, `badarg`, `badarith`, `badmap`/`badkey` |
| Feld eines native records fehlt | `ErrorReason::badfield` (20), Nutzdaten `{{Module, Name}, Field}` |
| Aufruf eines Werts (`F(Args)`) | `ErrorReason::badfun` (22, Nutzdaten der Wert), `badarity` (23, Nutzdaten `{Fun, Args}`), `undef` (24), verzeichnet von `CLAUSE_apply_v1` ([Funs](funs.md)) |
| Dynamische Aufrufe (`M:F(Args)`, `apply/2,3`, `fun M:F/A` mit Variablen) | `badarg` bei einem Modul oder einer Funktion, die kein Atom ist, einer unechten Argumentliste oder einer ungültigen Stelligkeit; `undef`, wenn kein Modul des Programms die Funktion exportiert; `badfun`/`badarity` wie oben ([Funs](funs.md#dynamic-calls)) |
| Externe native Konstruktion ohne Wert | `ErrorReason::novalue` (21), Nutzdaten `{{Module, Name}, Field}` |
| Ganzzahlergebnis über der Größengrenze | Service-Ergebnis `ValueOutcome::system_limit` (3): ein Guard lehnt ab, ein Rumpf löst `error:system_limit` aus (`ErrorReason` 19) |
| Ungültiger linker Operand eines Kurzschlussoperators | `{badarg, Value}` |
| Infrastruktur (OOM, Limits, Besitz, intern) | `CallError::runtime_failure` mit exaktem `Status` |
| `erlang:error/1,2,3`, `exit/1`, `throw/1`, `erlang:raise/3` | `raised_error`/`raised_exit`/`raised_throw`: Klasse aus der ID, die eigenen Nutzdaten sind der ganze Grund |
| `erlang:halt/0,1` | `CallError::halted` mit `halt_status` (und Slogan) |

Gründe sind typisierte IDs, die von `CLAUSE_raise_v2` verzeichnet werden; die
drei `raised_*`-IDs wählen die Klasse `exit` oder `throw` (sonst `error`) und
tragen einen beliebigen Term als Grund. `error/2,3` lösen über
`CLAUSE_error_v1(context, reason, args)` aus, das zusätzlich eine Liste `args`
für den obersten Stack-Frame behält. Der erste Fehlschlag gewinnt;
verschachtelte Aufrufe teilen den Kanal. `GeneratedInvocation` ist der
Host-Gültigkeitsbereich: er prüft ausstehende Fehlschläge vor dem Eintritt und
nach der Rückkehr, kopiert Ergebnis oder Fehler und leert erst beim äußersten
Austritt (auch bei C++-Ausnahmen). Keine Ausnahme überquert erzeugte
Eintrittspunkte. Aufrufer roher Eintrittspunkte müssen eine
`GeneratedInvocation` öffnen; normale Hosts verwenden
`ResolvedFunction::call`.

`catch Expr` leitet jede Fehlerprüfung und jedes Auslösen innerhalb von `Expr`
an einen Handler-Block um, der `CLAUSE_catch_v1(context, slot)` aufruft. Bei
einer ausstehenden Erlang-Ausnahme schreibt er den catch-Wert in den
Wurzelplatz und leert den Kanal: den geworfenen Term, `{'EXIT', Reason}` bei
einem exit oder `{'EXIT', {Reason, []}}` bei einem error (typisierte Gründe
werden zu ihren OTP-Termen wie `{badmatch, V}`; der Stack ist
[unten](#stack-traces) beschrieben). Halts und Infrastrukturfehler bleiben
ausstehend, und die eigene Prüfung des Handlers geht weiter zum umschließenden
Handler oder zum Funktionsaustritt. Innerhalb von `Expr` gemachte Bindungen
sind danach unsicher, daher führt die Zusammenführung nur den Wert zusammen.

`try Body of ... catch ... end` schützt auf dieselbe Weise nur `Body`. Sein
Handler ruft `CLAUSE_exception_v2(context, class_slot, reason_slot,
stack_slot)` auf, das das Klassenatom (`error`, `exit` oder `throw`), den Grund
und den Stacktrace-Term in Wurzelplätze schreibt und den Kanal leert (Halts und
Infrastrukturfehler bleiben ausstehend wie bei `catch`). catch-Klauseln matchen
dann `Class:Reason` mit gewöhnlichen Mustern und Guards; eine weggelassene
Klasse matcht `throw`, und eine benannte Stack-Variable bindet den Stack-Term.
Wenn keine passt, verzeichnet `CLAUSE_reraise_v2(context, class, reason,
stack)` die Ausnahme erneut mit einem `raised_*`-Grund und demselben Stack, der
sich genau wie das Original meldet und fangen lässt.
`of`-Klauseln wählen anhand des Rumpfwerts aus und lösen
`{try_clause, Value}` aus (`ErrorReason::try_clause = 14`); Ausnahmen innerhalb
von `of`-Klauseln und Handlern gehen an den umschließenden Handler.

`maybe` braucht keinen Service: jedes `?=` ist ein gewöhnlicher Match, dessen
Abweichungskante den Rumpf zum Austritt des maybe mit dem nicht gematchten
(bereits verwurzelten) Wert verlässt. Ohne `else` ist dieser Wert das
Ergebnis; andernfalls wählen `else`-Klauseln anhand seiner aus wie
`case`-Klauseln und lösen `{else_clause, Value}`
(`ErrorReason::else_clause = 15`) aus, wenn keine passt.

Comprehensions verwenden die bestehenden Services mit einigen Operationen: die
angesammelten Elemente werden von der Konstruktion `reverse` umgekehrt
(`ContainerConstruction::reverse = 2`, Werte `{List, Tail}`); eine
Binary-comprehension fügt ihre Teile mit `BitOperation::concat` (`{List}`)
zusammen, und eine Map-comprehension baut ihre Map mit
`MapOperation::from_list` (`{Pairs}`, spätere Schlüssel gewinnen).
Map-Generatoren lesen `MapOperation::key_at`/`value_at` (`{Map, Position}` in
kanonischer Schlüsselreihenfolge) und zeigen die verbleibende Eingabe eines
Zips mit `MapOperation::iterator`, OTPs Kette `{K, V, Next}`, die in `none`
endet. Bitstring-Generatoren verwenden die gewöhnliche Musterextraktion plus
ein abschließendes `binary`/`all`-Segment für den Rest.

`try ... after A end` fügt einen zweiten Schutz um den Rumpf und alle `of`- und
catch-Klauseln hinzu. Auf dem normalen Pfad läuft `A`, nachdem der ausgewählte
Wert verwurzelt ist, und sein Wert wird verworfen. Der after-Handler nimmt die
Ausnahme mit `CLAUSE_exception_v2` entgegen, führt eine zweite Kopie von `A` aus
und löst mit `CLAUSE_reraise_v2` erneut aus; eine Ausnahme oder ein Fehlschlag
innerhalb von `A` verlässt stattdessen über den umschließenden Handler und
ersetzt das Original. Halts und Infrastrukturfehler überspringen `A`.
Wurzelplätze gehören zum Funktions-Frame, sodass jeder Pfad sie beim
Funktionsaustritt freigibt.

### Stacktraces

Jeder Wurzel-Frame benennt seine erzeugte Funktion mit einem privaten
`abi::v1::FrameDescriptor` (Moduldeskriptor, Atomplätze für Modul- und
Funktionsname, Stelligkeit). Wenn eine Erlang-Ausnahme verzeichnet wird, kopiert
der Kanal die innersten 8 benannten Frames (BEAMs Standard-`backtrace_depth`);
der Term `[{Module, Function, Arity, []}, ...]` wird erst gebaut, wenn ein
Handler, `catch` oder ein Bericht danach fragt. Der oberste Frame zeigt statt
der Stelligkeit die Argumentliste von `error/2,3`, wenn dieses Argument eine
Liste ist.

`erlang:raise(Class, Reason, Stack)` (`CLAUSE_reraise_v2`) akzeptiert die
Stacks, die BEAM akzeptiert: eine echte Liste aus `{M, F, A}` (ergänzt um eine
`[]`-Ortsangabe) oder `{M, F, A, Location}` mit Atomen `M`, `F` und einer
Liste `Location`, gekürzt auf 8 Einträge; der Stack wird dann wie angegeben
behalten, und Frames werden nicht mehr erfasst. Eine ungültige Klasse oder ein
ungültiger Stack verzeichnet nichts, und der Aufruf ergibt `badarg`, wie in
OTP. `erlang:get_stacktrace/0` wird mit dem Lint-Text „removed“ von OTP 29
zurückgewiesen.

Unterschiede zu OTP, alle nur im Stack-Term sichtbar:

- Ortsangaben sind immer `[]` (OTP fügt `{file, F}`, `{line, L}` hinzu), und
  Optionen von `error/3` fügen kein `error_info` hinzu.
- Ein oberster `function_clause`-Frame zeigt die Stelligkeit, nicht die
  Argumentliste.
- Kein Frame benennt eine fehlschlagende BIF oder einen Operator (OTP fügt
  `{erlang, '+', Args, [{error_info, ...}]}` hinzu), und nichts unterhalb der
  Eintrittsfunktion erscheint.
- Ein Endaufruf gibt den Frame des Aufrufers frei (step 19), daher fehlt, wie
  in OTP, ein Aufrufer, der mit einem Endaufruf endete, im Trace. OTP macht
  außerdem Aufrufe von Funktionen, die nie zurückkehren, zu Endaufrufen; Clause
  nicht.
- `{Fun, Args}`-Stack-Einträge von `erlang:raise/3` werden weiterhin
  zurückgewiesen.

## Frames und Übergaben

Erzeugte Funktionen laufen auf expliziten Frames
([Ausführungsmodell](execution-model.md), step 19; Services in
[frames.hpp](../abi/include/clause/abi/frames.hpp)). Jede Funktion hat einen
Deskriptor `<symbol>.frame` (`FrameDescriptor`: Moduldeskriptor, Atomplätze für
Modul und Funktion, Stelligkeit, Rumpfcode, Anzahl der Plätze, Anzahl der
Termplätze; extern bei exportierten Funktionen) und einen internen
`<symbol>.body` vom Typ `void(void *context)`. Ein exportiertes `<symbol>`
behält die Signatur `TermWord(Context *, const TermWord *)` als
Host-Eintrittspunkt, der `CLAUSE_invoke_v1(context, frame, arguments)`
aufruft.

- Ein Rumpf liest beim Eintritt seinen Frame-Header (`CLAUSE_frame_v1`) und die
  Register (`CLAUSE_registers_v1`) und verzweigt anhand des Fortsetzungsworts
  des Headers. Er verlässt sich nur über `musttail`-Aufrufe des Codes, den
  `CLAUSE_enter_v1` (Aufruf), `CLAUSE_tail_v1` (Endaufruf) oder
  `CLAUSE_return_v1` (Rückkehr) zurückgeben.
- Argumente belegen die ersten Frame-Plätze; jeder ausgewertete Wert wird vor
  dem nächsten Ausdruck oder Aufruf in einem Termplatz gespeichert.
  Gescheiterte Kandidaten leeren ihre Plätze. Werte, die ein Rumpf nach einem
  Aufruf oder einem Safepoint am Schleifenkopf noch braucht, werden ausgelagert:
  Terme in Termplätze (im `roots` des Deskriptors gezählt), andere Wörter in
  rohe Plätze danach; rohe Plätze sind keine Wurzeln.
- Ein Ergebnis wird in Register 0 übergeben; Fehler-Nutzdaten sind Wurzelwörter
  des Kanals (BEAM `fvalue`). Ein Fehlschlag kehrt wie ein Ergebnis zum
  Aufrufer zurück, und jeder Aufrufer prüft den Kanal nach dem Aufruf; das
  Handler-Wort des Headers bleibt 0.
- Der Stack hat standardmäßig keine Obergrenze; ein Push, den der Host nicht
  allozieren kann, verzeichnet `out_of_memory`, und einer jenseits eines
  optionalen prozesseigenen `StackOptions::limit_words` verzeichnet
  `resource_limit` (Infrastrukturfehler).
- Ein Aufruf eines Funktionswerts übergibt seine Argumente und danach die
  erfassten Werte des fun in den Registern; `CLAUSE_apply_v1` liefert den
  `FrameDescriptor`, den die Übergabe betritt
  ([Funs](funs.md#representation)).
- Safepoints: `CLAUSE_enter_v1`/`CLAUSE_tail_v1` bereinigen, bevor der Frame
  des Aufgerufenen abgelegt wird (seine Argumente sind Registerwurzeln), und
  `CLAUSE_safepoint_v1(context)` an jedem Schleifenkopf einer comprehension
  bereinigt an Ort und Stelle, wenn der Heap danach verlangt. Jeder andere
  Service ist ein kritischer Abschnitt, der den Heap nie bewegt
  ([Bereinigung in erzeugtem Code](runtime-heap.md#collection-in-generated-code)).

## Runtime-Services

Erzeugter Code ruft geprüfte C++-Services auf: `CLAUSE_exact_v1` (exakte
Gleichheit), `CLAUSE_immediate_v1` (Prädikate/Abfragen auf Immediates),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1`, `CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`,
`CLAUSE_record_v1` (Erzeugen/Lesen/Aktualisieren/Matchen/Testen von native
records unter einem `RecordCheck`; Ergebnisse `bad_record`, `bad_field`,
`no_match`), `CLAUSE_make_fun_v1` (baut einen fun aus einem `FunDescriptor`).
Jeder liefert Erfolg, semantischen Fehler (`badarg`/`badarith`/...) oder
Infrastrukturfehler und schreibt Ausgaben nur bei Erfolg. `CLAUSE_display_v1`
([output.hpp](../abi/include/clause/abi/output.hpp)) gibt eine Zeile von
`erlang:display/1` aus und ergibt `true`; er hat keinen semantischen Fehler.
`CLAUSE_halt_v1` hat nie Erfolg: er verzeichnet eine Halt-Anforderung
(`CallError::halted` mit dem Exit-Status) oder `badarg`, sodass der Aufrufer
abwickelt. Linker-Schreibweisen folgen dem Itanium- oder
Microsoft-C++-Mangling des Ziels.

`CLAUSE_builtin_frame_v1(context, builtin)`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) liefert den
`FrameDescriptor` des Produktions-Builtins mit Index `builtin` in
`abi::v1::bridge_builtins` (nur anhängend); erzeugter Code betritt ihn wie eine
Funktion mit den Argumenten in den Registern, und Fehler und Fehlschläge gehen
an den geprüften Kanal ([Builtins](builtins.md)). Ein `FrameDescriptor` mit
leerem Rumpf ist ein Builtin: sein Betreten führt das Builtin auf den Registern
aus und kehrt zum Aufrufer zurück oder suspendiert den Prozess an der
Fortsetzung des Builtins, wenn es getrappt hat
([Portionen](builtins.md#portions)).

`abi::v1::dispatch_builtin` ruft vom Host registrierte Builtins über
Modul-/Funktionsbytes, Argumentarray und Stelligkeit auf und liefert einen
`Status`; Ausgaben werden nur bei Erfolg geschrieben.

| Status | Wert | Bedeutung |
| --- | ---: | --- |
| `ok` | 0 | Erfolg |
| `not_implemented` | 1 | Bekanntes zurückgestelltes Feature, einmal gemeldet |
| `invalid_argument` | 2 | Ungültige Eingabe |
| `diagnostic_failure` | 3 | Zustellung des Berichts gescheitert |
| `out_of_memory` | 4 | Allokation gescheitert, Zustand zurückgerollt |
| `busy` | 5 | Lebende Kontexte oder laufender Dispatch |
| `wrong_owner` | 6 | Objekt gehört zu einer anderen Runtime bzw. einem anderen Kontext |
| `resource_limit` | 7 | Obergrenze oder Budget erschöpft |
| `stopped` | 8 | Besitzer heruntergefahren |
| `abi_mismatch` | 9 | Version oder Termbreite weicht ab |
| `internal_error` | 10 | Unerwarteter Fehlschlag abgefangen |
| `unknown_builtin` | 11 | Signatur nicht registriert oder katalogisiert |
| `erlang_error` | 12 | Strukturierter Erlang-Fehler verzeichnet |
| `output_failure` | 13 | Die Standardausgabe hat einen Schreibvorgang abgelehnt |

## Revisionen

| Revision | Änderung |
| --- | --- |
| 1 | Erste Deskriptoren und Eintrittspunkte |
| 2 | Geprüfter Fehlerkanal |
| 3 | Atomschreibweisen und -plätze in Deskriptoren |
| 4 | Verpflichtende erzeugte Wurzel-Gültigkeitsbereiche |
| 5 | Explizite Prozess-Frames und Übergaben |
| 6 | Deskriptoren für native records in Moduldeskriptoren, `CLAUSE_record_v1` |
| 7 | fun-Deskriptoren in Moduldeskriptoren, `CLAUSE_make_fun_v1`, `CLAUSE_apply_v1` |
| 8 | Exportdeskriptoren benennen ihren `FrameDescriptor`; Services für dynamische Aufrufe `CLAUSE_call_v1`, `CLAUSE_apply_list_v1`, `CLAUSE_call_list_v1`, `CLAUSE_make_external_fun_v1` |
