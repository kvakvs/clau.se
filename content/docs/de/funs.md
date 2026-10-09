---
source: docs/funs.md
sourceCommit: 06042fa
sourceSha256: 86455c55a6eeb5c5a45118774fc530be75d7ca026113a4e394675ced4b7c12c4
translatedAt: 2026-10-09
---
# Funktionswerte

Plan 11 steps 32–35 (2026-10-07): `fun F/A`, `fun M:F/A`, anonyme Funs mit
erfassten Variablen (Closures), benannte Funs (`fun Name(...) -> ... end`),
Aufrufe von Funktionswerten (`F(Args)`) und dynamische Aufrufe (`M:F(Args)`,
`apply/2,3`). Die Fakten stammen aus den festgelegten `maint-29`-Quellen
(`erts/emulator/beam/utils.c` `erts_cmp`, `erl_printf_term.c`, `erl_lint`)
und aus Proben mit OTP 29.1.1.

## Werte

| Quelle | Wert | Aufrufe betreten |
| --- | --- | --- |
| `fun f/1` | Lokale Fun dieses Moduls; jedes `fun f/1` eines Moduls ist derselbe Wert | `f/1` dieses Moduls, exportiert oder nicht |
| `fun m:f/1` | Externe Fun, die `m:f/1` benennt, auch für das aktuelle Modul | `m:f/1`, wenn ein Modul des Programms es exportiert |
| `fun(X) -> ... end` | Lokale Fun, die die Variablen erfasst, die sie von ihrem Erzeuger liest; jede Auswertung baut einen neuen Wert | Die eigene generierte Funktion der Fun |
| `fun Name(X) -> ... end` | Dasselbe, wobei `Name` innerhalb ihrer Klauseln an die Fun gebunden ist | Die eigene generierte Funktion der Fun |
| `fun M:F/A` mit Variablen | Externe Fun, gebaut bei der Auswertung; gleich dem literalen `fun m:f/1`, das sie benennt | `m:f/1`, wenn ein Modul des Programms es exportiert |

- `fun F/A` muss eine Funktion des Moduls benennen (`function F/A undefined`)
  oder ein automatisch importiertes Builtin: `fun is_atom/1` ist die externe Fun
  `erlang:is_atom/1`. Funs von Builtins rufen diese über die
  [Builtin-Brücke](builtins.md) auf; ein Builtin außerhalb ihres Katalogs
  (`fun self/0`, `fun erlang:apply/2`) meldet die nicht verfügbare Fähigkeit
  `dynamic calls`.
- `F(Args)` wertet `F` aus, dann die Argumente von links nach rechts, und prüft
  dann den Wert: Eine Nicht-Funktion löst `{badfun, F}` aus, eine andere
  Stelligkeit `{badarity, {F, Args}}` (vor dem Modul geprüft), eine externe Fun,
  deren Funktion nichts im Programm exportiert, `undef`. Ein Aufruf in
  Endposition ist ein Endaufruf, wie bei benannten Funktionen.
- `is_function/1,2` sind für Funs in Rümpfen und Guards wahr.

## Dynamische Aufrufe

- `M:F(Args)` mit einer Variablen (oder einem beliebigen Ausdruck) als Modul
  oder Funktion wertet das Modul aus, dann die Funktion, dann die Argumente von
  links nach rechts. Ein Modul oder eine Funktion, das bzw. die kein Atom ist,
  löst `badarg` aus; eine Funktion, die kein Modul des Programms mit dieser
  Stelligkeit exportiert, löst `undef` aus. Ein Aufruf in Endposition ist ein
  Endaufruf.
- `apply(Fun, Args)` und `apply(M, F, Args)` (automatisch importiert, sofern das
  Modul `apply/2,3` nicht definiert oder den Import unterdrückt; auch
  `erlang:apply/2,3`) werten ihre Argumente aus und verlangen dann, dass `Args`
  eine echte Liste ist (`badarg`). `apply/2` ruft dann `Fun` wie `F(Args)` auf
  (`{badfun, Fun}`, `{badarity, {Fun, Args}}`); `apply/3` sucht
  `M:F/length(Args)` wie oben, sodass mehr als 255 Argumente `undef` auslösen.
  Beide sind in Endposition Endaufrufe und in Guards nie zulässig.
- `fun M:F/A` mit Variablen löst `badarg` aus, sofern `M` und `F` nicht Atome
  sind und `A` keine Ganzzahl in 0..255 ist; die Funktion muss erst existieren,
  wenn die Fun aufgerufen wird.
- Die Suche verwendet die Exporttabellen der Module des Programms, die für die
  Lebensdauer des Programms registriert bleiben, sodass eine gefundene Funktion
  während des Aufrufs nicht verschwinden kann. Sie durchsucht die Module und
  ihre Exporte und vergleicht Atomwörter; Hash-Map-Indizes sind plan step 62A.
  Ein Name, den kein Modul exportiert, wird dann unter den
  [Builtins](builtins.md) gesucht, sodass `M:F(...)`, `apply/3` und
  `fun M:F/A` zur Laufzeit die `erlang`-Builtins des Brückenkatalogs erreichen.
- **Dienste.** `CLAUSE_call_v1(context, module, function, arity)` prüft die
  Namen und gibt den `FrameDescriptor` des Exports zurück (ABI-Revision 8 fügt
  ihn zu `ExportDescriptor` hinzu); die Argumente liegen bereits in den
  Registern. `CLAUSE_apply_list_v1(context, fun, list, registers)` und
  `CLAUSE_call_list_v1(context, module, function, list, registers)` kopieren
  zuerst die Liste in die Register. Alle drei geben nach dem Vermerken des
  Fehlers null zurück, und generierter Code springt dann wie bei `F(Args)` über
  den Marker `clause.apply`. `CLAUSE_make_external_fun_v1` baut die Fun einer
  externen `FunDefinition`, die der Code-Server einmal pro `M:F/A` erzeugt
  (`CodeServer::external_fun`).

## Closures

- Jede Klausel beginnt mit dem Gültigkeitsbereich an der Stelle der Fun.
  Kopfvariablen sind neue Namen, die äußere verdecken (OTP warnt); ein innerhalb
  eines Kopfs wiederholter Name muss matchen. Guards lesen die Namen des Kopfs.
  Nichts, was eine Fun bindet, ist nach ihr sichtbar, und Namen aus
  case-Klauseln der umschließenden Funktion reichen nicht in sie hinein.
- Eine Fun erfasst jede äußere Definition, die ihre Köpfe, Guards oder Rümpfe
  lesen (verschachtelte Funs eingeschlossen), in Definitionsreihenfolge, so wie
  OTP die freien Variablen einer Funktion ordnet. Erfasste Werte werden bei der
  Auswertung des Fun-Ausdrucks in die Fun-Zelle kopiert, sodass sie die Rückkehr
  des Erzeugers und Speicherbereinigungen überleben und mit der Fun kopiert werden.
- Der Code ist eine private Funktion `-f/A-fun-N-` (N zählt die Funs von `f/A`
  in Quelltextreihenfolge), die die Argumente der Fun und dann ihre erfassten
  Werte nimmt; Stacktraces zeigen diesen Namen mit der kombinierten
  Stelligkeit, wie die von OTP. Matcht keine Klausel, wird `function_clause`
  ausgelöst.
- Argumente plus erfasste Werte sind auf 255 begrenzt.
- Die Klauseln einer benannten Fun sehen `Name` als die Fun selbst: ein neuer
  Name, der einen äußeren verdeckt (OTP warnt), nie erfasst und nach der Fun
  nicht sichtbar. Eine gleichnamige Kopfvariable verdeckt ihn wiederum. Liest
  eine Klausel `Name`, baut der Code der Fun den Wert beim Betreten aus ihren
  erfassten Werten, sodass er gleich (`=:=`) der aufgerufenen Fun ist, und
  `Name(...)` ist ein gewöhnlicher Fun-Aufruf: In Endposition ist er ein
  Endaufruf und läuft mit konstantem Stack.
- Eine anonyme Fun im Standardwert eines Record-Felds ist eine einzige Fun für
  jede Konstruktion, die den Standardwert verwendet (OTP expandiert eine Kopie
  pro Stelle).

## Darstellung

- **Deskriptor.** Jeder unterschiedliche Wert, den ein Modul erzeugt, wird zu
  einem `abi::v1::FunDescriptor` in der privaten Tabelle `<prefix>.funs` des
  Moduls kompiliert ([funs.hpp](../abi/include/clause/abi/funs.hpp)):
  Moduldeskriptor, Atom-Slots für Modul und Funktion, Erlang-Stelligkeit, Index,
  Extern-Flag und der `FrameDescriptor`, den ein Aufruf betritt (null für eine
  externe Fun außerhalb des Programms). Die Registrierung bindet sie an
  `FunDefinition`s (`ModuleAtoms::funs`, `CodeServer::fun_definition`); die
  Anzahl erfasster Werte einer lokalen Fun ist die Stelligkeit ihres Codes minus
  die der Fun.
- **Zelle.** Geboxte Art `fun_closure`: Header (Anzahl `1 + n`), ein nicht
  verfolgter `const FunDefinition *`, dann `n` erfasste Werte. Durchlauf,
  Speicherbereinigung, Kopieren und Verifikation überspringen das Definitionswort, wie bei
  nativen Records.
- **Dienste.** `CLAUSE_make_fun_v1(context, descriptor, captures, count,
  output)` baut eine Fun. `CLAUSE_apply_v1(context, fun, arity, arguments)`
  prüft einen aufgerufenen Wert, vermerkt die obigen Fehler im Fehlerkanal
  (`ErrorReason` 22-24) und hängt andernfalls die erfassten Werte an die
  Argumente an und gibt den zu betretenden `FrameDescriptor` zurück.
- **Aufrufe.** Die native Form übergibt die Argumente in einem Wort-Array und
  ruft den Marker `clause.apply` mit dem Deskriptor auf; `lower_frames` macht
  das Array zu den Prozessregistern und den Marker zu einem Sprung über
  `CLAUSE_enter_v1` oder, in Endposition, `CLAUSE_tail_v1`.

## Vergleich und Ausgabe

- Term-Ordnung: Zahl < Atom < Fun < Tupel < nativer Record < Map < nil < Liste
  < Bitstring (Referenzen, Ports und Pids, die in OTP zwischen Atomen und Tupeln
  stehen, gibt es noch nicht).
- Lokale Funs werden vor externen Funs eingeordnet. Lokale Funs werden nach
  Modul verglichen, dann nach Index, dann nach den erfassten Werten der Reihe
  nach (`==` vergleicht diese mit `==`); externe Funs nach Modul, Funktion und
  Stelligkeit. Gleiche Deskriptoren ergeben gleiche Werte, also
  `fun f/1 =:= fun f/1`.
- `erlang:display/1`, `~w` und Berichte über nicht abgefangene Ausnahmen geben
  eine externe Fun als `fun m:f/1` aus (Atome in Anführungszeichen wie beim
  Emulator) und eine lokale Fun als `#Fun<m.Index.0>`.

## Unterschiede

Festgehalten in [Unterschiede](differences.md):

- Eine lokale Fun wird als `#Fun<m.Index.0>` ausgegeben: Der Index von OTP folgt
  der Lambda-Nummerierung seines Compilers, und sein dritter Teil ist ein Hash
  des Modulcodes. Clause nummeriert lokale Funs in Quelltextreihenfolge, sodass
  auch die Ordnung zweier lokaler Funs verschiedener Funktionen eines Moduls
  abweichen kann.
- Der Aufruf einer externen Fun eines Moduls außerhalb des Programms löst
  `undef` aus; OTP würde zuerst versuchen, das Modul aus dem Codepfad zu laden.
  Dasselbe gilt für `M:F(Args)` und `apply/3`.
- Ein `undef`-Stacktrace beginnt mit dem Frame des Aufrufers; der von OTP
  beginnt mit `{M, F, Args, []}` für die fehlende Funktion.
- Namen anonymer Funs (`-f/1-fun-0-`, in Stacktraces zu sehen) zählen Funs in
  Quelltextreihenfolge; der Compiler von OTP nummeriert sie in seiner eigenen
  Reihenfolge. In Comprehensions erzeugte Funs können ihre Werte zudem in einer
  anderen Reihenfolge als bei OTP erfassen, was sich nur beim Vergleich zweier
  solcher Funs zeigt.
