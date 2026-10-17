---
source: docs/abi.md
sourceCommit: a8c3f8f6
sourceSha256: 0717f1e1336ae5419c5ef646d39a5488fd45468113ecbf7eb15897e3370b69c4
translatedAt: 2026-10-17
---
# ABI des erzeugten Codes (Revision 21)

Privater Vertrag zwischen der Compilerausgabe und der Runtime. Er ist
projektinternes C++23, nicht BEAM-kompatibel und kein allgemeines FFI. Objekte
und Runtime müssen aus demselben Build stammen; ältere Deskriptorrevisionen
werden vor der Verwendung zurückgewiesen.

Header: [v1.hpp](../abi/include/clause/abi/v1.hpp) (Term-, Kontext- und
Funktionstypen), [term.hpp](../abi/include/clause/abi/term.hpp) (Codec für
Immediate-Ganzzahlen), [status.hpp](../abi/include/clause/abi/status.hpp),
[builtins.hpp](../abi/include/clause/abi/builtins.hpp),
[startup.hpp](../abi/include/clause/abi/startup.hpp) (Programmstart).

## Terme

Ein Term ist ein vorzeichenloses Wort in Zielzeigerbreite (32 oder 64 Bits).
Layouts leiten sich vom konfigurierten LLVM-Ziel ab, sodass zielübergreifender
Code die Breiten des Ziels verwendet.

- Kleine Ganzzahlen: die unteren vier Bits `0xf`; vorzeichenbehaftete Nutzdaten
  von `word_bits - 4` Bits, Bereich `[-2^(word_bits-5), 2^(word_bits-5)-1]`.
  Größere Werte sind Heap-Bignums.
- Atome: die unteren sechs Bits `0x0b`, prozessweit gültige, nicht
  wiederverwendete Nutzdaten. IDs werden nie serialisiert oder zum Ordnen
  verwendet. `false`, `true`, `undefined`, `ok` und `error` sind fest:
  Nutzdaten 0–4 in jeder Runtime.
- Leeres Tupel genau `0x2b` und nil genau `0x3b`; andere Nutzdatenbits sind
  ungültig.
- Lokale Pids: die unteren vier Bits `0x3`, Nutzdaten die Prozessnummer, nur
  zugelassen, wenn die Runtime sie vergeben hat
  ([Pids und Referenzen](terms.md#pids-and-references)).
- Geboxte und Listenwörter zeigen in den Heap des besitzenden Prozesses und
  werden erst zugelassen, nachdem die Runtime den Besitz nachgewiesen hat (siehe
  [Terme](terms.md)).
- Primäre Tags: Liste `0x1`, geboxt `0x2`. Ein Header hält seine Art ab Bit 2
  und die Anzahl der folgenden Wörter ab Bit 7 (`header_count_shift`); die Art
  eines Tupels ist 0. Erzeugter Code liest Tupelelemente und Cons-Zellen erst
  inline, nachdem die Inferenz oder ein dominierender Formtest die Zelle
  nachgewiesen hat ([Nachweise](specialization.md#proofs)); Match-Pläne testen
  Tupel- und Cons-Formen auf jeder Optimierungsstufe inline (ein Box-Tag, dann
  der Header), und exakte Gleichheit vergleicht zuerst Wörter und ruft
  `CLAUSE_exact_v1` nur für zwei verschiedene Listen- oder Box-Wörter auf. Die
  Runtime prüft diese Konstanten per Assertion.

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
betreten), Atomschreibweisen (UTF-8-Paare aus Zeiger und Größe), Deskriptoren
für native Records (Atomplätze für Modul, Name und Felder, Export-Flag;
[native Records](native-records.md#representation)) in einer externen Tabelle
`<prefix>.records`, auf die andere Module eines Batches verweisen,
Fun-Deskriptoren in einer privaten Tabelle `<prefix>.funs`
([Funs](funs.md#representation)), den schreibgeschützten Literalbereich
([Bereiche](runtime-heap.md#areas)), die beschreibbaren Atom- und Fun-Caches,
die erzeugter Code inline liest, und die `code_convention` seiner Rümpfe. Die
Registrierung ruft `CLAUSE_register_module_v4(Runtime*)` auf, das
Version/Breite und alle Exporte validiert, Atome interniert, eine eingefrorene
Registry aufbaut und sie zusammen mit dem Code-Image in einer Transaktion
veröffentlicht. Doppelte Module ersetzen nie Code; jeder Fehlschlag
veröffentlicht nichts (bereits internierte Atome bleiben in der begrenzten
Tabelle).

- `.register` muss explizit aufgerufen werden, bevor Exporte aufgelöst werden.
  Es gibt keine globalen Konstruktoren; Nutzer statischer Archive müssen auf die
  Registrierungseinträge verweisen.
- `llvm.used` hält Deskriptoren und Eintrittspunkte; das Linken ohne die Runtime
  scheitert am fehlenden Service-Symbol.
- Die Deskriptoradresse ist der Schlüssel der Atombindung; ihr Image muss für
  die Lebensdauer des Moduls gemappt bleiben. Jede Runtime hat ihre eigenen
  Bindungen für dasselbe Image.
- Atomausdrücke außer den festen Atomen lesen `atom_cache`, wenn das
  `FrameState::runtime` des Kontexts den Cache besitzt, sonst
  `CLAUSE_atom_v3`; sie internieren nie ([Atome](terms.md#atoms)).
- Ein Startobjekt (`clausev1_start`) listet jeden Deskriptor in einem
  `StartupDescriptor` auf, und sein natives `main` ruft
  `CLAUSE_main_v1(argc, argv, descriptor)` auf, das alle Module registriert und
  den Eintrittspunkt ausführt
  ([ausführbare Dateien](executables.md#startup-object)).

## Fehlerkanal (Revision 2)

Fehler werden nicht in Termbits kodiert. Nach jedem erzeugten Aufruf, der kein
Endaufruf ist, prüft der Aufrufer den Kanal, bevor er das Ergebnis verwendet
oder das nächste Argument auswertet: Er liest das Wort `failed` des
`FrameState` des Kontexts, das die Runtime gleich
`CLAUSE_call_failed_v2(context)` hält. Bei einem Fehlschlag liefert der
Aufgerufene ein ungültiges Null-Wort.

| Ergebnis | Transport |
| --- | --- |
| Musterabweichung, Ablehnung durch Guard | Fortsetzung beim nächsten Kandidaten; Kanal unberührt |
| Erschöpfte Klauseln | `error:function_clause`; `error:{case_clause, Value}` mit eigenen Nutzdaten bei einem `case`; `error:if_clause`; `error:{try_clause, Value}` bei den `of`-Klauseln eines try; `error:{else_clause, Value}` bei den `else`-Klauseln eines maybe |
| Fehlgeschlagener Match im Rumpf | `error:{badmatch, Value}` mit eigenen Nutzdaten |
| Comprehensions | `error:{bad_generator, Tail}`, `error:{bad_filter, Value}`, `error:{bad_generators, Inputs}` (`ErrorReason` 16-18); die Ablehnung durch einen strikten Generator ist `{badmatch, Element}` |
| Record-Zugriff, ungültige Argumente, Arithmetik, Maps | `badrecord`, `badarg`, `badarith`, `badmap`/`badkey` |
| Feld eines nativen Records fehlt | `ErrorReason::badfield` (20), Nutzdaten `{{Module, Name}, Field}` |
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
Host-Gültigkeitsbereich: Er prüft ausstehende Fehlschläge vor dem Eintritt und
nach der Rückkehr, kopiert Ergebnis oder Fehler und leert erst beim äußersten
Austritt (auch bei C++-Ausnahmen). Keine Ausnahme überquert erzeugte
Eintrittspunkte. Aufrufer roher Eintrittspunkte müssen eine
`GeneratedInvocation` öffnen; normale Hosts verwenden `ResolvedFunction::call`.

`catch Expr` leitet jede Fehlerprüfung und jedes Auslösen innerhalb von `Expr`
an einen Handler-Block um, der `CLAUSE_catch_v1(context, slot)` aufruft. Bei
einer ausstehenden Erlang-Ausnahme schreibt er den catch-Wert in den Wurzelplatz
und leert den Kanal: den geworfenen Term, `{'EXIT', Reason}` bei einem exit oder
`{'EXIT', {Reason, []}}` bei einem error (typisierte Gründe werden zu ihren
OTP-Termen wie `{badmatch, V}`; der Stack ist [unten](#stack-traces)
beschrieben). Halts und Infrastrukturfehler bleiben ausstehend, und die eigene
Prüfung des Handlers geht weiter zum umschließenden Handler oder zum
Funktionsaustritt. Innerhalb von `Expr` gemachte Bindungen sind danach
unsicher, daher führt die Zusammenführung nur den Wert zusammen.

`try Body of ... catch ... end` schützt auf dieselbe Weise nur `Body`. Sein
Handler ruft
`CLAUSE_exception_v2(context, class_slot, reason_slot, stack_slot)` auf, das das
Klassenatom (`error`, `exit` oder `throw`), den Grund und den Stacktrace-Term in
Wurzelplätze schreibt und den Kanal leert (Halts und Infrastrukturfehler bleiben
ausstehend wie bei `catch`). catch-Klauseln matchen dann `Class:Reason` mit
gewöhnlichen Mustern und Guards; eine weggelassene Klasse matcht `throw`, und
eine benannte Stack-Variable bindet den Stack-Term. Wenn keine passt,
verzeichnet `CLAUSE_reraise_v2(context, class, reason, stack)` die Ausnahme
erneut mit einem `raised_*`-Grund und demselben Stack, die sich genau wie das
Original meldet und fangen lässt. `of`-Klauseln wählen anhand des Rumpfwerts aus
und lösen `{try_clause, Value}` aus (`ErrorReason::try_clause = 14`); Ausnahmen
innerhalb von `of`-Klauseln und Handlern gehen an den umschließenden Handler.

`maybe` braucht keinen Service: Jedes `?=` ist ein gewöhnlicher Match, dessen
Abweichungskante den Rumpf zum Austritt des maybe mit dem nicht gematchten
(bereits verwurzelten) Wert verlässt. Ohne `else` ist dieser Wert das Ergebnis;
andernfalls wählen `else`-Klauseln anhand seiner aus wie `case`-Klauseln und
lösen `{else_clause, Value}` (`ErrorReason::else_clause = 15`) aus, wenn keine
passt.

Comprehensions verwenden die bestehenden Services mit einigen Operationen: Die
angesammelten Elemente werden von der Konstruktion `reverse` umgekehrt
(`ContainerConstruction::reverse = 2`, Werte `{List, Tail}`), die das Ergebnis
in einer einzigen Heap-Reservierung baut; Listengeneratoren testen und lesen
Cons-Zellen inline; eine Binary-Comprehension fügt ihre Teile mit
`BitOperation::concat` (`{List}`) zusammen, und eine Map-Comprehension baut ihre
Map mit `MapOperation::from_list` (`{Pairs}`, spätere Schlüssel gewinnen).
Map-Generatoren holen einmal `MapOperation::entries` (11, `{Map}`): eine Zelle
mit den Schlüsseln und Werten an den Wörtern `1 + 2i` und `2 + 2i` in
kanonischer Schlüsselreihenfolge (eine klassische Map selbst oder eine
tupelförmige Kopie der Einträge einer Off-Heap-Map, die nur erzeugter Code
liest), und lesen jeden Eintrag inline; `key_at`/`value_at` (`{Map, Position}`)
bleiben für andere Aufrufer. Die verbleibende Eingabe eines Zips wird mit
`MapOperation::iterator` gezeigt, der Kette `{K, V, Next}` von OTP, die in
`none` endet. `MapOperation::update_owned` (10) nimmt die Operanden von
`update` für eine Map-Aktualisierung, deren Quelle laut Nachweis des Compilers
danach nicht mehr gelesen wird: Eine Off-Heap-Quell-Map wird an Ort und Stelle
aktualisiert und ihr Stub als verbraucht (leer) zurückgelassen.
Bitstring-Generatoren verwenden die gewöhnliche Musterextraktion plus ein
abschließendes `binary`/`all`-Segment für den Rest.

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
`[]`-Ortsangabe) oder `{M, F, A, Location}` mit Atomen `M`, `F` und einer Liste
`Location`, gekürzt auf 8 Einträge; der Stack wird dann wie angegeben behalten,
und Frames werden nicht mehr erfasst. Eine ungültige Klasse oder ein ungültiger
Stack verzeichnet nichts, und der Aufruf ergibt `badarg`, wie in OTP.
`erlang:get_stacktrace/0` wird mit dem Lint-Text „removed“ von OTP 29
zurückgewiesen.

Unterschiede zu OTP, alle nur im Stack-Term sichtbar:

- Ortsangaben sind immer `[]` (OTP fügt `{file, F}`, `{line, L}` hinzu), und
  Optionen von `error/3` fügen kein `error_info` hinzu.
- Ein oberster `function_clause`-Frame zeigt die Stelligkeit, nicht die
  Argumentliste.
- Kein Frame benennt eine fehlschlagende BIF oder einen Operator (OTP fügt
  `{erlang, '+', Args, [{error_info, ...}]}` hinzu), und nichts unterhalb der
  Eintrittsfunktion erscheint.
- Ein Endaufruf gibt den Frame des Aufrufers frei, daher fehlt, wie in OTP, ein
  Aufrufer, der mit einem Endaufruf endete, im Trace. OTP macht außerdem Aufrufe
  von Funktionen, die nie zurückkehren, zu Endaufrufen; Clause nicht.
- `{Fun, Args}`-Stack-Einträge von `erlang:raise/3` werden zurückgewiesen.

## Frames und Übergaben

Erzeugte Funktionen laufen auf expliziten Frames
([Ausführungsmodell](execution-model.md); Services in
[frames.hpp](../abi/include/clause/abi/frames.hpp)). Jede Funktion hat einen
Deskriptor `<symbol>.frame` (`FrameDescriptor`: Moduldeskriptor, Atomplätze für
Modul und Funktion, Stelligkeit, Rumpfcode, Anzahl der Plätze, Anzahl der
Termplätze; extern bei exportierten Funktionen) und einen internen
`<symbol>.body` vom Typ `abi::v1::Code`,
`void(void *context, TermWord x0, ...)` mit `abi::v1::register_arguments`
Term-Parametern; mit einer von Clang gebauten Runtime auf x86-64 und AArch64
verwenden die Rümpfe und jede Übergabe die Konvention `preserve_none`, wie es
`abi::v1::Code` dort tut: Rümpfe kehren nie normal zurück und sichern daher
keine callee-gesicherten Register; die Registrierung weist ein Modul zurück,
dessen `code_convention` (0 keine, 1 C, 2 `preserve_none`) nicht die der Runtime
ist. Ein exportiertes `<symbol>` behält die Signatur
`TermWord(Context *, const TermWord *)` als Host-Eintrittspunkt, der
`CLAUSE_invoke_v1(context, frame, arguments)` aufruft.

- Jeder Kontext beginnt mit einem `abi::v1::FrameState`: Stackblock, Spitze,
  Push-Grenze, Offset des aktuellen Frames, verbleibende Reduktionen,
  Registerzeiger, Anzahl lebender Register, Slow-Bits, das Wort `failed`, die
  freien Wörter des Heap-Blocks `[heap_top, heap_limit)`, die Runtime-Identität,
  von der die Atom-Caches beansprucht werden, das Pid-Wort des Kontexts
  (`self`), je ein Zielwort. Ein Rumpf liest beim Eintritt daraus seinen
  Frame-Header (`stack + frame`) und die Register und verzweigt anhand des
  Fortsetzungsworts des Headers.
- Binary-Muster (64-Bit-Ziele): Der Starttest, der Endtest und Ganzzahlsegmente
  konstanter ganzzahliger Bytebreite bis 56 Bits an einer byteausgerichteten
  Position lesen die Zelle inline (`abi::v1::heap_binary_*_word`,
  `refc_*_word`: das `data_` einer Off-Heap-Sicht ist das erste Byte ihres
  Puffers); andere Segmente und nicht ausgerichtete Positionen rufen
  `CLAUSE_bits_v1` auf. Ein `sub_binary` als Subjekt (`sub_*_word`) wird über
  sein Original gelesen. Ein abschließendes `Rest/binary` oder `Rest/bits` der
  Einheit 1 wird inline als 4-Wort-Zelle `sub_binary` des Originals per
  Bump-Allokation angelegt.
- Binary-Schleifen: Wenn jede Klausel einer Funktion einen Parameter als Binary
  matcht (oder ihn ignoriert), nie das ganze Binary behält und die gebundenen
  Reste nur als diesen Parameter von Selbst-Endaufrufen liest, erhält die
  Funktion eine private Variante `<symbol>.loop`. Der eigene Schritt der
  Funktion erzeugt die Rest-Zelle wie oben und betritt mit ihr die Variante (ein
  vom Service erzeugter Rest, der geteilt sein kann, betritt stattdessen erneut
  die Funktion). Die Variante erzeugt keine Rest-Zelle: Jeder Selbst-Endaufruf
  speichert den neuen Offset und die Bitlänge in die Zelle des Parameters, auf
  die nur diese Schleife verweist, und reicht dieselbe Zelle weiter, sodass eine
  Schleife über ein Binary einmal alloziert. Die Variante liest die Sicht der
  Zelle einmal pro Schritt, vor ihren Klauseln, und überspringt den
  Bitstring-Test des Parameters. Die Variante trägt in Stacktraces Name und
  Stelligkeit der Funktion.
- Eine Binary-Konstruktion, deren Bytes alle zur Kompilierzeit bekannt sind
  (kleine Ganzzahlkonstanten und Stringliterale konstanter ganzzahliger
  Bytebreite, höchstens 64 Bytes), ist eine Inline-Binary-Zelle des
  Literalbereichs des Moduls, wie andere zusammengesetzte Literale.
- `Left ++ Right`, wobei `Left` als echte Liste geschrieben ist (ein
  Stringliteral oder eine Liste ohne Rest), wird wie im Compiler von OTP als
  `[E1, ..., En | Right]` gebaut, ohne `erlang:'++'/2` aufzurufen. Jedes andere
  `Left ++ Right` durchläuft `Left` inline (`codegen/lowering_append`): Eine
  echte Liste von höchstens 32 Zellen wird in den freien Wörtern des Heap-Blocks
  vor `Right` kopiert; ein längeres oder unechtes `Left` oder ein Block ohne
  Platz betritt das Builtin, das jeden Fehler und jede Portion behält.
- Ein reines Builtin mit literalen Argumenten wird zur Kompilierzeit
  ausgewertet, wie es `sys_core_fold` von OTP tut: `atom_to_list(Atom)` eines
  Atomliterals ist der literale String dieses Namens, ohne Aufruf.
- `erlang:make_tuple(N, V)` mit kleinem `N` in 1..64 legt das Tupel per
  Bump-Allokation an und füllt es mit `llvm.experimental.memset.pattern`, wo der
  Heap Platz hat; andernfalls läuft das Builtin.
- Binary-Konstruktionen (64-Bit-Ziele), deren Segmente alle Ganzzahlen
  konstanter ganzzahliger Bytebreite bis 64 Bits sind, insgesamt höchstens
  64 Bytes, werden inline als `heap_binary`-Zellen per Bump-Allokation angelegt
  (Header, Bitlänge, genullte Datenwörter, dann die Bytes jedes Segments), wenn
  jeder Wert eine kleine Ganzzahl ist und der Heap Platz hat; andernfalls baut
  `CLAUSE_bits_v1` sie. Dieselben Segmente nach einem Akkumulator für das ganze
  Binary (`<<Acc/binary, ...>>`) werden in den Puffer des Akkumulators
  geschrieben, wenn dieser ein `refc_binary` (oder ein `sub_binary` eines
  solchen) ist, das byteausgerichtet am `refc_append_end_word` der Zelle endet,
  mit Platz unterhalb von `refc_append_limit_word`: Die Bytes kommen hinter das
  Ende, das Ende rückt vor, und das Ergebnis ist ein 4-Wort-`sub_binary` dieser
  Zelle.
- `+ - * /` (64-Bit-Ziele) mit einem Gleitkommaoperanden sowie `/` zweier
  beliebiger Zahlen lesen jeden Operanden als double (eine kleine Ganzzahl
  umgewandelt, der Wert einer Gleitkommazelle über ein Select ihrer Zelle oder
  einer konstanten Ersatzzelle gelesen, sodass kein Laden von einer Verzweigung
  abhängt), rechnen in Registern und legen die 2-Wort-Gleitkommazelle per
  Bump-Allokation an, wenn das Ergebnis endlich, der Divisor ungleich null ist
  und der Heap Platz hat; andernfalls löst `CLAUSE_immediate_v1` `badarith` aus
  oder befördert.
- Map-Ausdrücke ohne Basis, deren Schlüssel Atom- oder kleine Ganzzahlliterale
  sind (höchstens 32 verschiedene), werden inline als klassische Map-Zellen
  geschrieben, die Schlüssel zur Kompilierzeit in exakter Termordnung sortiert,
  bei wiederholtem Schlüssel der letzte Wert behalten; andernfalls baut
  `CLAUSE_map_v1` sie.
- Tupel und Listen von höchstens 64 Wörtern werden inline in
  `[heap_top, heap_limit)` per Bump-Allokation angelegt (Header oder Cons-Zellen
  an Ort und Stelle geschrieben, `heap_top` vorgerückt), sonst von
  `CLAUSE_construct_v1` gebaut; das Ergebnis wird wie eine Service-Ausgabe
  verwurzelt. Die Runtime übernimmt Inline-Wörter vor jeder Heap-Operation in
  ihre Buchführung und setzt beide Felder danach zurück; sie sind null, solange
  kein Heap-Block existiert oder ein prozesseigenes Heap-Budget gilt, sodass
  dann jede Allokation den Service erreicht ([Heap](runtime-heap.md#areas)).
  `CLAUSE_frame_v1` und `CLAUSE_registers_v1` bleiben für andere Nutzer.
- Ein Rumpf verlässt sich nur über `musttail`-Aufrufe. Aufrufe, Endaufrufe und
  Rückkehr laufen inline, wenn sie können, andernfalls kommt der Code von
  `CLAUSE_enter_v1` (Aufruf), `CLAUSE_tail_v1` (Endaufruf) oder
  `CLAUSE_return_v1` (Rückkehr), die den Zustand aktuell halten
  ([Ausführungsmodell](execution-model.md#implementation)).
- Jede Übergabe reicht die ersten `abi::v1::register_arguments` (6) X-Register
  als C-Parameter nach dem Kontext weiter: die führenden Argumente eines
  Aufrufs, das Ergebnis einer Rückkehr (als `x0` des Rumpfs des Aufrufers), null
  für ungenutzte. Weitere Argumente reisen im Registerarray. Um jeden
  Übergabe-Service herum speichert der erzeugte Code die Parameter in das Array
  (die Services und der Garbage Collector lesen sie dort) und lädt sie danach
  zurück. Die Runtime ruft Code auf dieselbe Weise auf
  (`ProcessStack::run_code`), und ihr Rumpf des untersten Frames speichert `x0`
  für den Host in das erste Register.
- Ein Eintritt nullt den Frame und kopiert nur die Argumente jenseits der
  Parameter in ihre Plätze; ein Rumpf behält ein Parameterargument nur dort in
  seinem Platz, wo `lower_frames` es über einen Aufruf oder Safepoint hinweg
  auslagert. Ausgewertete Werte werden nicht vorab gespeichert: Die Absenkung
  (lowering) markiert berechnete Terme (Metadaten `clause.term`), und
  `lower_frames` gibt nur einem Wert einen Termplatz, der einen Aufruf oder
  Safepoint überquert; Argumentarrays von Services laufen weiterhin über
  Wurzelplätze. Gescheiterte Kandidaten leeren ihre Plätze. Werte, die ein Rumpf
  nach einem Aufruf oder einem Safepoint am Schleifenkopf noch braucht, werden
  ausgelagert: Terme in Termplätze (im `roots` des Deskriptors gezählt), andere
  Wörter in rohe Plätze danach; rohe Plätze sind keine Wurzeln.
- Ein Ergebnis wird als `x0` übergeben; Fehler-Nutzdaten sind Wurzelwörter des
  Kanals (BEAM `fvalue`). Ein Fehlschlag kehrt wie ein Ergebnis zum Aufrufer
  zurück, und jeder Aufrufer prüft den Kanal nach dem Aufruf; das Handler-Wort
  des Headers bleibt 0.
- Der Stack hat standardmäßig keine Obergrenze; ein Push, den der Host nicht
  allozieren kann, verzeichnet `out_of_memory`, und einer jenseits eines
  optionalen prozesseigenen `StackOptions::limit_words` verzeichnet
  `resource_limit` (Infrastrukturfehler).
- Ein Aufruf eines Funktionswerts übergibt seine Argumente und danach die
  erfassten Werte der Fun in den Registern; `CLAUSE_apply_v1` liefert den
  `FrameDescriptor`, den die Übergabe betritt ([Funs](funs.md#representation)).
- Safepoints: `CLAUSE_enter_v1`/`CLAUSE_tail_v1` bereinigen, bevor der Frame
  des Aufgerufenen abgelegt wird (seine Argumente sind Registerwurzeln); der
  Heap setzt das Bit `slow_collect`, wann immer er eine Bereinigung will, sodass
  Inline-Eintritte nie eine überspringen. Und `CLAUSE_safepoint_v1(context)` an
  jedem Schleifenkopf einer Comprehension bereinigt an Ort und Stelle; der Kopf
  ruft ihn nur auf, solange `FrameState::slow` `slow_collect` enthält,
  verbraucht dann eine Reduktion und betritt, wenn keine übrig ist,
  `erlang:self/0` (der Eintritt suspendiert den Prozess), sodass lange Schleifen
  ohne Aufrufe sich den Scheduler teilen. Jeder andere Service ist ein
  kritischer Abschnitt, der den Heap nie bewegt
  ([Bereinigung in erzeugtem Code](runtime-heap.md#collection-in-generated-code)).

## Runtime-Services

Erzeugter Code ruft geprüfte C++-Services auf: `CLAUSE_exact_v1` (exakte
Gleichheit), `CLAUSE_immediate_v1` (Prädikate/Abfragen auf Immediates),
`CLAUSE_construct_v1`, `CLAUSE_inspect_v1` (für andere Nutzer; erzeugter Code
testet und liest Tupel- und Cons-Zellen inline), `CLAUSE_integer_v1`,
`CLAUSE_float_v1`, `CLAUSE_map_v1`, `CLAUSE_bits_v1`, `CLAUSE_record_v1`
(Erzeugen/Lesen/Aktualisieren/Matchen/Testen nativer Records unter einem
`RecordCheck`; Ergebnisse `bad_record`, `bad_field`, `no_match`),
`CLAUSE_make_fun_v1` (baut eine Fun aus einem `FunDescriptor`). Jeder liefert
Erfolg, semantischen Fehler (`badarg`/`badarith`/...) oder Infrastrukturfehler
und schreibt Ausgaben nur bei Erfolg. `CLAUSE_display_v1`
([output.hpp](../abi/include/clause/abi/output.hpp)) gibt eine Zeile von
`erlang:display/1` aus und ergibt `true`; er hat keinen semantischen Fehler.
`CLAUSE_halt_v1` hat nie Erfolg: Er verzeichnet eine Halt-Anforderung
(`CallError::halted` mit dem Exit-Status) oder `badarg`, sodass der Aufrufer
abwickelt. Linker-Schreibweisen folgen dem Itanium- oder Microsoft-C++-Mangling
des Ziels.

Inline-Formen (`codegen/lowering_inline.cpp`): Typtests (`is_atom`,
`is_integer`, `is_number`, `is_boolean`, `is_tuple`, `is_list`,
`is_bitstring`, `is_float`, `is_map`, `is_pid`, `is_port`, `is_reference`,
`is_function/1`, natives `is_record/1`, `is_binary/1` über das Bitlängenwort)
lesen Tags und nach einem Box-Tag-Test die Header-Art (`abi::v1::HeaderKind`);
sie rufen nie einen Service auf. Vergleiche zweier Immediates (`==`, `/=`) oder
zweier kleiner Ganzzahlen (`<`, `=<`, `>`, `>=`), `element/2`,
`tuple_size/1`, `hd/1`, `tl/1`, die booleschen Operatoren, `band`, `bor`,
`bxor`, `bsr`, `bsl` (solange das Ergebnis klein bleibt) und kleines
`div`/`rem` laufen inline; `self/0` liest `FrameState::self`. Sie laufen
inline, wo ihre Operanden es erlauben, und rufen sonst `CLAUSE_immediate_v1`
auf, das jeden Fehler- und Bignum-Fall behält. `setelement/3` mit kleinem Index
innerhalb eines geboxten Tupels kopiert das Tupel in die freien Wörter des
Heap-Blocks und ersetzt den Platz inline; andernfalls oder ohne Platz betritt es
das Bridge-Builtin.

`CLAUSE_builtin_frame_v1(context, builtin)`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) liefert den
`FrameDescriptor` des Produktions-Builtins mit Index `builtin` in
`abi::v1::bridge_builtins` (nur anhängend); erzeugter Code betritt ihn wie eine
Funktion mit den Argumenten in den Registern, und Fehler und Fehlschläge gehen
an den geprüften Kanal ([Builtins](builtins.md)). Ein `FrameDescriptor` mit
leerem Rumpf ist ein Builtin: Sein Betreten führt das Builtin auf den Registern
aus und kehrt zum Aufrufer zurück oder suspendiert den Prozess an der
Fortsetzung des Builtins, wenn es getrappt hat
([Portionen](builtins.md#portions)).

Ein direktes Builtin (`BuiltinName::direct`: reine Umwandlungen wie
`integer_to_list/1`, `atom_to_list/1`, `list_to_tuple/1`, `setelement/3`,
`phash2/1`) trappt nie, wartet nie und wirkt nie auf einen anderen Prozess.
Erzeugter Code ruft es mit `CLAUSE_builtin_call_v1(context, builtin, arguments)`
auf, das seinen Rumpf sofort ausführt und das Ergebnis zurückgibt, ohne
Frame-Übergabe, ohne Fortsetzungspunkt und ohne Safepoint beim Eintritt; es
verbraucht eine Reduktion, und ein Fehlschlag geht wie bei einem Service an den
geprüften Kanal.

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
| 6 | Deskriptoren für native Records in Moduldeskriptoren, `CLAUSE_record_v1` |
| 7 | Fun-Deskriptoren in Moduldeskriptoren, `CLAUSE_make_fun_v1`, `CLAUSE_apply_v1` |
| 8 | Exportdeskriptoren benennen ihren `FrameDescriptor`; Services für dynamische Aufrufe `CLAUSE_call_v1`, `CLAUSE_apply_list_v1`, `CLAUSE_call_list_v1`, `CLAUSE_make_external_fun_v1` |
| 9 | Jeder Kontext beginnt mit `abi::v1::FrameState`; Inline-Übergaben |
| 10 | Führende X-Register als Code-Parameter übergeben |
| 11 | Feste Wörter für `false` und `true` |
| 12 | Inline-Heap-Felder `heap_top`/`heap_limit` in `FrameState` |
| 13 | Feste `undefined`, `ok`, `error`; `ModuleDescriptor::atom_cache` und `FrameState::runtime` |
| 14 | Literalbereiche der Module: `ModuleDescriptor::literals`, `literal_words` |
| 15 | `FrameState::self`, das Pid-Wort des Kontexts |
| 16 | `Code` verwendet `preserve_none` auf x86-64 und AArch64 mit einer von Clang gebauten Runtime; `ModuleDescriptor::code_convention` |
| 17 | Sechs X-Register als `Code`-Parameter |
| 18 | `sub_binary`-Zellen (`HeaderKind::sub_binary`, `sub_*_word`) und Inline-Extraktion von `Rest` |
| 19 | End- und Grenzwörter für Anhänge in `refc_binary`-Zellen (`refc_append_*_word`, 8 Nutzdatenwörter) und Inline-Anhänge |
| 20 | `MapOperation::entries` und Inline-Map-Generatoren |
| 21 | `ModuleDescriptor::fun_cache` und Inline-Closures |
| 22 | Direkte Builtins: `BuiltinName::direct`, `CLAUSE_builtin_call_v1` |
