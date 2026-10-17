---
source: docs/funs.md
sourceCommit: a8c3f8f6
sourceSha256: 114573ca575f133c3b45d3422218a8b98264b55c30167b405bb3008e3806c74e
translatedAt: 2026-10-17
---
# Funktionswerte

`fun F/A`, `fun M:F/A`, anonyme Funs mit erfassten Variablen (Closures),
benannte Funs (`fun Name(...) -> ... end`), Aufrufe von Funktionswerten
(`F(Args)`) und dynamische Aufrufe (`M:F(Args)`, `apply/2,3`). Die Fakten
stammen aus den festgelegten `maint-29`-Quellen (`erts/emulator/beam/utils.c`
`erts_cmp`, `erl_printf_term.c`, `erl_lint`) und aus Proben mit OTP 29.1.1.

## Werte

| Quelle | Wert | Aufrufe betreten |
| --- | --- | --- |
| `fun f/1` | Lokale Fun dieses Moduls; jedes `fun f/1` eines Moduls ist derselbe Wert | `f/1` dieses Moduls, exportiert oder nicht |
| `fun m:f/1` | Externe Fun, die `m:f/1` benennt, auch für das aktuelle Modul | `m:f/1`, wenn ein Modul des Programms es exportiert |
| `fun(X) -> ... end` | Lokale Fun, die die Variablen erfasst, die sie von ihrem Erzeuger liest; jede Auswertung baut einen neuen Wert | Die eigene erzeugte Funktion der Fun |
| `fun Name(X) -> ... end` | Dasselbe, wobei `Name` innerhalb ihrer Klauseln an die Fun gebunden ist | Die eigene erzeugte Funktion der Fun |
| `fun M:F/A` mit Variablen | Externe Fun, gebaut bei der Auswertung; gleich dem literalen `fun m:f/1`, das sie benennt | `m:f/1`, wenn ein Modul des Programms es exportiert |

- `fun F/A` muss eine Funktion des Moduls benennen (`function F/A undefined`)
  oder ein automatisch importiertes Builtin: `fun is_atom/1` ist die externe
  Fun `erlang:is_atom/1`. Funs von Builtins rufen diese über die
  [Builtin-Brücke](builtins.md) auf; ein literales `fun erlang:F/A` einer
  Funktion außerhalb des Katalogs (`fun erlang:apply/2`) meldet die nicht
  verfügbare Fähigkeit `dynamic calls`.
- `F(Args)` wertet `F` aus, dann die Argumente von links nach rechts, und prüft
  dann den Wert: Eine Nicht-Funktion löst `{badfun, F}` aus, eine andere
  Stelligkeit `{badarity, {F, Args}}` (vor dem Modul geprüft), eine externe
  Fun, deren Funktion nichts im Programm exportiert, `undef`. Ein Aufruf in
  Endposition ist ein Endaufruf, wie bei benannten Funktionen.
- `is_function/1,2` sind für Funs in Rümpfen und Guards wahr.

## Dynamische Aufrufe

- `M:F(Args)` mit einer Variablen (oder einem beliebigen Ausdruck) als Modul
  oder Funktion wertet das Modul aus, dann die Funktion, dann die Argumente von
  links nach rechts. Ein Modul oder eine Funktion, das bzw. die kein Atom ist,
  löst `badarg` aus; eine Funktion, die kein Modul des Programms mit dieser
  Stelligkeit exportiert, löst `undef` aus. Ein Aufruf in Endposition ist ein
  Endaufruf.
- `apply(Fun, Args)` und `apply(M, F, Args)` (automatisch importiert, sofern
  das Modul `apply/2,3` nicht definiert oder den Import unterdrückt; auch
  `erlang:apply/2,3`) werten ihre Argumente aus und verlangen dann, dass `Args`
  eine echte Liste ist (`badarg`). `apply/2` ruft dann `Fun` wie `F(Args)` auf
  (`{badfun, Fun}`, `{badarity, {Fun, Args}}`); `apply/3` sucht
  `M:F/length(Args)` wie oben, sodass mehr als 255 Argumente `undef` auslösen.
  Beide sind in Endposition Endaufrufe und in Guards nie zulässig.
- `fun M:F/A` mit Variablen löst `badarg` aus, sofern `M` und `F` nicht Atome
  sind und `A` keine Ganzzahl in 0..255 ist; die Funktion muss erst existieren,
  wenn die Fun aufgerufen wird.
- Die Suche verwendet die Hash-Indizes des Code-Servers über die Exporte des
  Programms ([Runtime](runtime.md#code-server-and-builtins)), die für die
  Lebensdauer des Programms registriert bleiben, sodass eine gefundene Funktion
  während des Aufrufs nicht verschwinden kann. Ein Name, den kein Modul
  exportiert, wird dann unter den [Builtins](builtins.md) gesucht, sodass
  `M:F(...)`, `apply/3` und `fun M:F/A` zur Laufzeit die Builtins des
  Brückenkatalogs erreichen.
- **Dienste.** `CLAUSE_call_v1(context, module, function, arity)` prüft die
  Namen und gibt den `FrameDescriptor` des Exports zurück (aus seinem
  `ExportDescriptor`); die Argumente liegen bereits in den Registern.
  `CLAUSE_apply_list_v1(context, fun, list, registers)` und
  `CLAUSE_call_list_v1(context, module, function, list, registers)` kopieren
  zuerst die Liste in die Register. Alle drei geben nach dem Vermerken des
  Fehlers null zurück, und erzeugter Code übergibt dann wie bei `F(Args)` über
  den Marker `clause.apply`. `CLAUSE_make_external_fun_v1` baut die Fun einer
  externen `FunDefinition`, die der Code-Server einmal pro `M:F/A` erzeugt
  (`CodeServer::external_fun`).

## Closures

- Jede Klausel beginnt mit dem Gültigkeitsbereich an der Stelle der Fun.
  Kopfvariablen sind neue Namen, die äußere verdecken (OTP warnt); ein
  innerhalb eines Kopfs wiederholter Name muss matchen. Guards lesen die Namen
  des Kopfs. Nichts, was eine Fun bindet, ist nach ihr sichtbar, und Namen aus
  case-Klauseln der umschließenden Funktion reichen nicht in sie hinein.
- Eine Fun erfasst jede äußere Definition, die ihre Köpfe, Guards oder Rümpfe
  lesen (verschachtelte Funs eingeschlossen), in Definitionsreihenfolge, so wie
  OTP die freien Variablen einer Funktion ordnet. Erfasste Werte werden bei der
  Auswertung des Fun-Ausdrucks in die Fun-Zelle kopiert, sodass sie die
  Rückkehr des Erzeugers und Speicherbereinigungen überleben und mit der Fun
  kopiert werden.
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
  Moduldeskriptor, Atom-Slots für Modul und Funktion, Erlang-Stelligkeit,
  Index, Extern-Flag und der `FrameDescriptor`, den ein Aufruf betritt (null
  für eine externe Fun außerhalb des Programms). Die Registrierung bindet sie
  an `FunDefinition`s (`ModuleAtoms::funs`, `CodeServer::fun_definition`); die
  Anzahl erfasster Werte einer lokalen Fun ist die Stelligkeit ihres Codes
  minus die der Fun.
- **Zelle.** Geboxte Art `fun_closure`: Header (Anzahl `1 + n`), ein nicht
  verfolgter `const FunDefinition *`, dann `n` erfasste Werte. Durchlauf,
  Speicherbereinigung, Kopieren und Verifikation überspringen das
  Definitionswort, wie bei nativen Records.
- **Dienste.** `CLAUSE_make_fun_v1(context, descriptor, captures, count,
  output)` baut eine Fun. `CLAUSE_apply_v1(context, fun, arity, arguments)`
  prüft einen aufgerufenen Wert, vermerkt die obigen Fehler im Fehlerkanal
  (`ErrorReason` 22-24) und hängt andernfalls die erfassten Werte an die
  Argumente an und gibt den zu betretenden `FrameDescriptor` zurück.
- **Inline-Closures.** Die Runtime, die den Atom-Cache eines Moduls
  beansprucht, füllt auch `ModuleDescriptor::fun_cache` mit der Adresse der
  Definition jeder Fun; solange der Anspruch ihr eigener ist, alloziert der
  erzeugte Code die Fun-Zelle (Header, Definition, erfasste Werte) selbst per
  Bump-Allokation und ruft `CLAUSE_make_fun_v1` nur ohne Platz auf dem Heap
  oder in einer anderen Runtime auf. `CLAUSE_apply_v1` und
  `CLAUSE_apply_list_v1` lesen eine Fun der richtigen Stelligkeit (und die
  Argumentliste) direkt aus ihren Zellen, vor dem geprüften Pfad, der Fehler
  meldet.
- **Aufrufe.** Die native Form übergibt die Argumente in einem Wort-Array und
  ruft den Marker `clause.apply` mit dem Deskriptor auf; `lower_frames` macht
  das Array zu den Prozessregistern und den Marker zu einem Eintritt oder, in
  Endposition, zu einer Endübergabe
  ([Ausführungsmodell](execution-model.md#implementation)).

## Vergleich und Ausgabe

- Funs werden nach Referenzen und vor Ports eingeordnet
  ([Term-Ordnung](terms.md#comparison-and-order)).
- Lokale Funs werden vor externen Funs eingeordnet. Lokale Funs werden nach
  Modul verglichen, dann nach Index, dann nach den erfassten Werten der Reihe
  nach (`==` vergleicht diese mit `==`); externe Funs nach Modul, Funktion und
  Stelligkeit. Gleiche Deskriptoren ergeben gleiche Werte, also
  `fun f/1 =:= fun f/1`.
- `erlang:display/1`, `~w` und Berichte über nicht abgefangene Ausnahmen geben
  eine externe Fun als `fun m:f/1` aus (Atome in Anführungszeichen wie beim
  Emulator) und eine lokale Fun als `#Fun<m.Index.0>`.

## Unterschiede

Nummerierung, Ausgabe und Ordnung von Funs, die Erfassungsreihenfolge in
Comprehensions, `undef`-Stacktraces und Aufrufe von Modulen außerhalb des
Programms weichen von OTP ab, wie in [Unterschiede](differences.md)
festgehalten.

## Informationen über Funs

`runtime/src/builtins/erlang/fun_info.cpp`. `erlang:fun_info/1` listet die
Einträge von OTP in der Reihenfolge von OTP auf: für eine lokale Fun `pid`,
`module`, `new_index`, `new_uniq`, `index`, `uniq`, `name` (`-F/A-fun-N-` für
eine anonyme Fun), `arity`, `env` (die erfassten Werte) und `type`; für
`fun M:F/A` `module`, `name`, `arity`, `env` (`[]`) und `type`. `fun_info/2`
gibt ein `{Item, Value}` zurück; ein unbekannter Eintrag ist `badarg`. `pid` ist
`undefined`, `new_uniq` der MD5 des Modulnamens und `uniq` dessen erste 24 Bit,
daher weichen sie von OTP ab. `fun_to_list/1` ist der Text von `~w`.
`is_builtin/3` ist wahr für die Builtins der Runtime und `erlang:apply/2,3`.
