---
source: docs/semantic.md
sourceCommit: 6ed3851c
sourceSha256: e64ac7a96a11727f6f9c0e83247c36a9b3b2b047fd551a417344938602e864b3
translatedAt: 2026-10-15
---
# Semantische Analyse

Läuft nach dem Parsen bei der Standardkompilierung und bei `--print-types`;
reine Syntaxaktionen überspringen sie. Fehler stoppen den betroffenen Batch vor
LLVM; Diagnosen behalten ihre Makro-/Include-Herkunft, und spätere Eingaben
werden weiterhin diagnostiziert.

## Modul- und Aufrufprüfungen

- Eine Moduldeklaration ist erforderlich und eindeutig; Funktionsstelligkeiten
  0..255; keine doppelten Definitionen; jeder Export existiert (ein
  wiederholter Export warnt, wie in OTP). Quotierte/Unicode-Namen behalten ihre
  exakte Identität.
- Jede Funktion wird geprüft, auch ungenutzter und unerreichbarer Code.
- Aufrufe werden innerhalb des Batches über Modul/Name/Stelligkeit aufgelöst.
  Remote-Aufrufe (auch selbstqualifizierte) erfordern Exporte. Fehlende/private
  Aufgerufene und doppelte Module sind Fehler.
- `fun F/A` muss eine Funktion des Moduls benennen (`function F/A undefined`);
  `fun M:F/A` und Aufrufe von Werten (`F(Args)`) werden nicht zur
  Kompilierzeit aufgelöst ([Funs](funs.md)). Jeder unterschiedliche fun-Wert
  erhält nach der Bindungsanalyse einen Eintrag in `Module::funs`.
- Selbst-, wechselseitige und modulübergreifende Rekursion werden akzeptiert.
  Der Aufrufgraph wird in starke Zusammenhangskomponenten (iterativer Tarjan) in
  der Reihenfolge Aufgerufener vor Aufrufer zerlegt; eine Komponente ist
  rekursiv, wenn sie mehrere Mitglieder hat oder ein Mitglied sich selbst
  aufruft.

## Behaviours

Folgt OTPs
[Behaviours](https://www.erlang.org/doc/system/design_principles.html#behaviours),
`erl_internal:add_predefined_functions` und `check_behaviour` von `erl_lint`.

- Ein Modul, das `-callback` deklariert, erhält OTPs vordefinierte, exportierte
  `behaviour_info/1`: `callbacks` liefert die deklarierten Callbacks in
  Quelltextreihenfolge, `optional_callbacks` die der wohlgeformten
  `-optional_callbacks`-Listen (mit einem Modul qualifizierte Callbacks werden
  weggelassen). Das Frontend hängt sie als Funktion an der `-module`-Zeile an
  (`driver/predefined`). Wie in OTP kann der eigene Quelltext des Moduls sie
  nicht benennen: ein `-export`, ein lokaler Aufruf, `fun
  behaviour_info/1` oder eine `-spec` davon ist eine undefinierte Funktion;
  Remote-Aufrufe (auch selbstqualifizierte) erreichen sie. `-callback` neben
  einer handgeschriebenen `behaviour_info/1` ist ein Fehler
  (`cannot define callback attibute for F/A when behaviour_info is defined`,
  OTPs Schreibweise).
- `-behaviour(M)` und `-behavior(M)` dürfen sich wiederholen. `M` wird im Batch
  aufgelöst; ein Name mit einem Bibliotheksmodul (`library.md`) fügt dieses
  Modul hinzu, wie es ein literaler Aufruf tut. Diagnosen verwenden OTPs Text am
  Attributnamen:
  - `undefined callback function F/A (behaviour 'M')` für jeden erforderlichen,
    nicht optionalen Callback, den das Modul nicht exportiert (sortiert);
  - `conflicting behaviours -- callback F/A required by both 'M2' and 'M1'
    (line L, column C)`, wenn ein früheres Behaviour ihn ebenfalls verlangt
    (ein optionaler Callback zählt, wenn er exportiert ist);
  - `behaviour M undefined`, wenn `M` nicht im Batch ist oder keine
    `behaviour_info/1` hat (OTP-Behaviours wie `gen_server` sind noch nicht Teil
    von Clause), dazu OTPs Modulnamenfehler für Namen, die keine Module sein
    können (`the module name must not be empty`, `... must be an atom`, ...).
- Warnungen lassen die Kompilierung nicht fehlschlagen. Die `-compile`-Optionen
  `nowarn_behaviours` (die ganze Prüfung, Modulnamenfehler eingeschlossen),
  `nowarn_undefined_behaviour_func`, `nowarn_undefined_behaviour` und
  `nowarn_conflicting_behaviours` schalten sie ab.
- Nicht ausgewertet: eine handgeschriebene exportierte `behaviour_info/1` eines
  Behaviour-Moduls, daher werden die Callbacks seiner Nutzer nicht geprüft, und
  OTPs Warnungen zu falsch definierten und veralteten Callbacks treten nie auf
  ([Unterschiede](differences.md#errors-stack-traces-and-reports)).
- Belege: `tests/fixtures/lint` (von OTP erzeugte Diagnosen, CTest
  `lint_diagnostics`), `executables_behaviours`, `semantic`-CLI-Fälle.

## Importe

Folgt den Importregeln von `erl_lint`.

- `-import(Module, [F/A, ...])` macht einen lokalen Aufruf `F(...)` zum
  Remote-Aufruf `Module:F(...)`: Das Modul muss im Batch sein (ein
  Bibliotheksmodul kommt hinzu wie bei einem literalen Aufruf) und die Funktion
  exportieren, oder ein Builtin-Modul sein (`-import(io, [format/2])`,
  `-import(erlang, [display/1])`). Ein Import hat Vorrang vor einem automatisch
  importierten BIF desselben Namens.
- Fehler mit OTPs Text: `function F/A already imported from M` (das ganze
  Attribut wird dann ignoriert), `defining imported function F/A`,
  `creating a fun from imported name F/A is not allowed`. Eine importierte
  Funktion in einem guard ist ein unzulässiger Guard-Aufruf (außer
  erlang-Guard-BIFs).
- Warnung `import directive overrides auto-imported BIF F/A -- ...`, außer
  `no_auto_import` benennt es oder `nowarn_bif_clash` ist angegeben; Clause
  kennt die automatisch importierten BIFs, die es implementiert.
- Belege: `executables_imports`, Lint-Fälle `imports_conflicts`,
  `imports_fun`, `imports_bif`, semantische CLI-Fälle.

## Vordefinierte Funktionen

Folgt OTPs [Modulen](https://www.erlang.org/doc/system/modules.html) und
`erl_internal:add_predefined_functions`. Das Frontend hängt `module_info/0,1`
an jedes kompilierte Modul an (nach einer erzeugten `behaviour_info/1`), als
Erlang-Funktionen, die literale Daten liefern (`driver/predefined`,
`semantic/module_info`); `Module::predefined_` zählt diese abschließenden
Formen, die immer exportiert sind und in `--print-types` weggelassen werden.

- `module_info()` liefert `[{module,_},{exports,_},{attributes,_},{compile,_},{md5,_}]`;
  `module_info(Key)` beantwortet zusätzlich `functions`, `nifs` (`[]`) und
  `native` (`false`) und löst für jeden anderen Schlüssel `badarg` aus.
- `exports`: die exportierten Funktionen in Definitionsreihenfolge (escripts
  fügen `main/1` hinzu), dann `behaviour_info/1`, wenn erzeugt,
  `module_info/0`, `module_info/1`. `functions`: jede Funktion in
  Definitionsreihenfolge, dann dieselben vordefinierten.
- `attributes`: jedes Attribut außer `module`, Exporten und Importen,
  Type-/Spec-/Callback-Formen, records, `export_type`, `optional_callbacks`,
  `export_record`, `compile`, `file`, Dokumentation und `feature`, in
  Quelltextreihenfolge; ein Wert, der keine Liste ist, wird in eine gepackt
  (`-tags(a)` ist `{tags,[a]}`). Ohne `-vsn` kommt `{vsn,[N]}` zuerst, wobei
  `N` das als vorzeichenlose Big-Endian-Ganzzahl gelesene `md5` ist, wie OTP es
  ableitet.
- `md5`: MD5 des ausgegebenen Quelltexts des Moduls (`print_source`: Makros
  expandiert, Includes eingefügt, Kommentare und Layout entfernt). `compile`:
  `[{version,ClauseVersion},{options,[]},{source,AbsolutePath}]`.
- Anders als `behaviour_info/1` sieht der eigene Quelltext des Moduls sie:
  lokale Aufrufe und `fun module_info/1` funktionieren. Eine davon zu
  definieren ist ein Fehler (`function module_info/0 already defined`); eine zu
  exportieren warnt nur, wie jeder wiederholte Export
  (`function module_info/0 already exported`).
- Attribute sind Daten; nur `on_load`, `nifs` und nicht wirkungslose
  `-compile`-Optionen werden als verhaltensändernd abgewiesen.
- Die erzeugten Funktionen haben keine Quelltextzeile (OTP gibt ihnen keine):
  keine Debug-Orte, IR-Quelltextkommentare oder `--print-types`-Einträge.
  `module_info/0` hält dieselben Literale wie `module_info/1` und macht daher
  keine Aufrufe.
- Belege: `executables_module_info` (stdout von OTP; abgeleitete Werte nach
  Form), `tests/fixtures/lint`-Fälle `module_info_defined`,
  `exports_repeated`.

## Bindungen

Jede Bindung hat eine funktionsrelative Identität `clause[N].local[M]`.
Vorkommen sind Definitionen, Lesezugriffe oder Prüfungen auf exakte Gleichheit,
markiert mit Kopf-/Guard-/Rumpfkontext. Die Analyse ist deterministisch.

- Jede Klausel beginnt mit einer leeren Umgebung. Kopfkandidaten sammeln
  vorläufige Definitionen; Guards lesen sie; der Rumpf sieht sie nur bei Erfolg.
- `_` bindet nichts; `_Name` ist eine gewöhnliche Variable. Ein wiederholter
  Name ist eine Bedingung auf exakte Gleichheit.
- Matches im Rumpf besuchen die rechte Seite vor der linken; Ketten werden von
  rechts nach links ausgewertet. Ein geklammertes Muster `P1 = P2` ist ein
  Alias, keine Sequenz.
- Geschwisterausdrücke lesen dieselben eingehenden Namen; ihre Definitionen
  werden nach dem gesamten Ausdruck exportiert. `{X = 1, X}` ist ein Lesezugriff
  auf eine ungebundene Variable; `{X = 4, X = 3}` ist zulässig und schlägt zur
  Laufzeit fehl.
- Definitionen auf der rechten Seite von `andalso`/`orelse` oder innerhalb von
  `catch Expr` sind danach unsicher (OTP `vtunsafe`); vor einem `catch`
  gebundene Namen bleiben nutzbar. Jeder innerhalb eines `try` gebundene Name
  ist danach unsicher; `of`-Klauseln sehen die Namen des Rumpfes, catch-Klauseln
  sehen sie als unsicher, und der after-Rumpf sieht jeden zuvor im try
  gebundenen Namen als unsicher. Die Stack-Variable einer catch-Klausel muss neu
  sein (OTP `stacktrace_bound`), und ihr Guard darf sie nicht lesen
  (`stacktrace_guard`). Ein `maybe` exportiert nichts: jedes `?=` bindet für die
  folgenden Rumpfausdrücke, `else`-Klauseln sehen die Namen des Rumpfes als
  unsicher, und jeder darin gebundene Name ist danach unsicher. Guards
  veröffentlichen nie Bindungen; Matches in Guards sind Fehler, selbst wenn sie
  unerreichbar sind.
- Map-Schlüssel lesen nur eingehende Bindungen; Binary-Größen lesen zusätzlich
  frühere Segmente desselben Binarys (siehe [Muster](patterns.md#scopes)).
- Der Prüfausdruck (scrutinee) eines `case` bindet im umschließenden
  Gültigkeitsbereich. Jede Klausel beginnt in diesem Bereich; ihre
  Musterdefinitionen sind bis zum Guard vorläufig, der nur liest. Von jeder
  Klausel gebundene Namen werden mit einer Identität exportiert (spätere
  Klauseln verwenden die Identität wieder, die eine frühere Klausel dem Namen
  gab); nur von einigen Klauseln gebundene oder in irgendeiner unsichere Namen
  sind danach unsicher. Exporte werden konservativ zusammengeführt wie bei OTPs
  `erl_lint` (`icrt_export`); OTPs Warnung, wenn ein späteres Muster einen
  exportierten Namen matcht, wird nicht ausgegeben. `if`-Klauseln folgen
  denselben Regeln mit einem Guard und ohne Muster.
- `begin`/`end` ist eine Sequenz im umschließenden Gültigkeitsbereich.
- Ungebundene, unsichere und Wildcard-Lesezugriffe sind Fehler mit
  Ortsangabe. Meldungen behalten den Wortlaut des Compilers (`unbound variable
  X`, `unsafe variable X`); der Bindungskorpus prüft jede gegen OTPs Klasse
  `unbound_var`/`unsafe_var`.
- Eine comprehension wertet jeden Qualifier der Reihe nach im
  Gültigkeitsbereich aus, den die vorherigen hinterlassen. Generatormuster
  binden neue Namen, die äußere verdecken (Lesezugriffe innerhalb des Musters
  bevorzugen Namen, die es bereits gebunden hat); eine Zip-Gruppe bindet alle
  ihre Muster gemeinsam. Templates lesen wie Geschwister. Der
  Gültigkeitsbereich nach der comprehension ist derjenige davor: ihre Namen
  sind dort ungebunden.
- Die Klauseln eines anonymen fun beginnen jeweils im Gültigkeitsbereich am
  fun: Kopfnamen sind neu und verdecken äußere, Guards lesen sie, und nichts
  darin Gebundenes ist nach dem fun sichtbar. Jede äußere Definition, die darin
  gelesen wird, wird als Capture erfasst (`Function::captures`,
  Definitionsreihenfolge). Der Name eines benannten fun ist eine weitere
  Definition, mit der jede Klausel beginnt (`Function::fun_names`); er wird nie
  erfasst. Die Variablen von `fun M:F/A` sind Lesezugriffe des fun-Ausdrucks
  (`Function::fun_operands`).

Durchläufe sind iterativ mit einem Modulbudget von 1.000.000 Arbeitseinheiten
oder 32 pro Ausdruck, wenn das mehr ist: erzeugte Parser brauchen etwa 10 pro
Ausdruck (OTPs `erl_parse`, 139.093 Ausdrücke, braucht 1.290.198). Die
Service-Auflösung hat ein Budget derselben Größe; sie durchsucht die
`-compile`- und `-import`-Formen des Moduls einmal pro Name nach dessen
Auto-Import-Zustand, nicht einmal pro Aufruf (jede der tausenden Klauseln von
`erl_parse` ruft `hd/1` auf). Erschöpfung oder ein beliebiger semantischer Fehler leert die Bindungs- und
Normalisierungstabellen des Moduls.

## Typen und Spezifikationen

Ein privater Typgraph stellt alle geparsten Typformen unabhängig vom
Runtime-Layout dar: Singletons, Bereiche, Container, Rollen von Map-Feldern,
Funktionsprodukte und unaufgelöste Anwendungen. Unions werden abgeflacht und
dedupliziert; `term()` ist das obere und `none()` das untere Element.
Standardwerte: 1.048.576 Knoten, 256 Union-Mitglieder, 200.000 Arbeitsschritte
pro Durchlauf über einen deklarierten Typ (Auflösung, Übersetzung, Expansion)
und 8.000.000 pro Inferenzdurchlauf über das ganze Programm; ein Debug-Build von
`clau` (ohne `NDEBUG`) erlaubt 16.000 und 1.000.000, damit große Programme
weiterhin schnell kompilieren, und kann stärker aufweiten. Erschöpfung weitet
auf `term()` mit sichtbarem Flag auf und engt nie eine Repräsentation ein.

Deklarierte Metadaten (`-type`, `-opaque`, `-nominal`, `-export_type`, `-spec`,
`-callback`, `-optional_callbacks`) folgen der OTP-Typespec-Referenz und dem
festgelegten Verhalten von `erl_lint`/`erl_internal`/`erl_types`:

- Lokale Aliase dürfen eingebaute Typnamen verdecken. Remote-Typen des Batches
  müssen exportiert sein. Fehlende Typen, Duplikate, fehlerhafte Metadaten,
  Typvariablen mit nur einem Vorkommen, ungültige Schranken und Specs für
  fehlende Funktionen sind Fehler. Nicht verfügbare externe Typen erzeugen eine
  Warnung und werden zu `term()`.
- Jeder Alias und jede Überladung hat einen eigenen Variablenbereich;
  wiederholte formale Parameter folgen OTPs Substitution durch das letzte
  Argument.
- Rekursive Aliase bleiben endliche benannte Referenzen; opake Rümpfe werden nur
  in ihrem Modul expandiert; nominale Namen bleiben überall erhalten, und nur
  die Spezifikationsprüfung liest die Definition eines nominalen Typs,
  innerhalb seines Moduls.
- Die Konstantenauswertung ist exakt, begrenzt auf 10.000 Dezimalstellen pro
  Wert.

## Inferenz

Die Inferenz ist von deklarierten Typen getrennt und vertraut Specs nie.

- Exportierte Eingaben und Eingaben von Funktionen, die `fun F/A` benennt, sind
  beliebige Terme. Eine Funktion, die nur über direkte Aufrufe des Batches
  betreten wird (weder exportiert noch von einem fun benannt), nimmt die
  Vereinigung (join) der Argumentfakten ihrer Aufrufstellen als Eingaben
  (`semantic/types/inference_inputs`), gematcht durch die Kopfmuster
  jeder Klausel; rekursive Aufrufe zählen mit. Eingaben beginnen bei `none()`
  (eine Funktion, die nichts aufruft, läuft nie und inferiert `none()`) und
  wachsen über Durchläufe des Batches: 8 Durchläufe vereinigen, spätere weiten
  auf wie rekursive Ergebnisse; Eingaben, die sich nach 16 Durchläufen nicht
  stabilisiert haben, werden zu `term()` (als aufgeweitet gemeldet).
- Literale haben exakte Fakten:
  Ganzzahlen jeder Größe und Zeichen sind Singletons, Atome Singleton-Atome,
  Gleitkommazahlen `float()`, Strings nichtleere Listen ihrer Zeichen (`[]` für
  `""`), und `-`/`+` einer literalen Zahl behält deren Fakt. Tupel behalten die
  Fakten ihrer Elemente; mit konstanten Schlüsseln gebaute Maps (ein Fakt
  eines einzigen Werts: eine Ganzzahl, ein Atom, `[]` oder ein Tupel oder eine
  Map daraus) behalten den Wertfakt jedes Schlüssels, wobei ein zweimal
  angegebener Schlüssel seinen letzten Wert behält, und jeder andere Schlüssel
  ergibt `map()`. Eine bitstring-Konstruktion zählt ihre Größe: literale,
  größenangegebene und UTF-kodierte literale Zeichen exakt, ein UTF-Segment
  eines anderen Werts nach seiner Kodierung (UTF-8: 8 bis 32 Bits nach Bytes),
  und ein `binary`/`bitstring`-Segment nach dem Fakt seines Werts oder einem
  beliebigen Vielfachen seiner Einheit (`<<1, Rest/binary>>` ist
  `nonempty_binary()`). Ein Operand, der nie einen Wert erzeugt (`none()`),
  macht die Konstruktion zu `none()`.
- Operatoren und Builtins (`semantic/types/inference_operators`)
  berechnen ihr Ergebnis aus den Fakten ihrer Operanden. Ganzzahl-Singletons
  werden exakt gefaltet bis zu 4.096 Bits pro Operand und Ergebnis (Bignums
  eingeschlossen; ein größeres ist `integer()`); andere Ganzzahlen verwenden
  Intervallarithmetik für `+`, `-`, `*` nichtnegativer Bereiche, `band` mit
  einem nichtnegativen Operanden (`X band 15` ist `0..15`), `rem` durch einen
  beschränkten Divisor (`X rem 10` ist `-9..9`), `bnot`, unäres `-` und
  `abs/1`; ein Gleitkommaoperand ergibt `float()`, ein unbekannter `number()`,
  und `/` ist immer `float()`. Vergleiche werden gefaltet, wenn sich die Werte
  der Operanden nur auf eine Weise vergleichen lassen (Singleton-Atome oder
  -Ganzzahlen, disjunkte Ganzzahlbereiche, Zahlen gegen Nicht-Zahlen), und sind
  sonst `boolean()`; `and`/`or`/`xor`/`not` und `andalso`/`orelse` kombinieren
  die Wahrheitswerte, die ihre Operanden haben können (der rechte Operand von
  `andalso` ist das Ergebnis, wenn der linke `true` ist). Eine Tabelle gibt
  jedem Bridge-Builtin sein Ergebnis: `pid()` für `self/0` und `spawn/1,3`,
  `reference()`, `port()`, `non_neg_integer()` für Größen, `string()`,
  `nonempty_string()`, `binary()`, `list()`, `tuple()`, `atom()`, `boolean()`
  für Typtests, `true`/`ok` für Builtins mit Seiteneffekten, die Nachricht für
  `!` und `send/2`; `trunc/1` und verwandte Funktionen behalten
  Ganzzahloperanden; unbekannte Builtins sind `term()`. Eine Operation, die
  immer eine Ausnahme auslöst (`1 + a`, `1 div 0`, `error/1`, `exit/1`,
  `throw/1`, `halt/0,1`), ist `none()`, und `erlang:raise/3` liefert nur
  `badarg`. Das Falten ändert nie den erzeugten Code: Überläufe und
  Fehlschläge bleiben Ergebnisse zur Laufzeit.
- Ein Rumpf, dessen Ausdruck nie abschließt (`none()`), ist `none()`; ebenso
  ein Aufruf mit einem solchen Argument. Pfade mit Ausnahmen tragen nichts zu
  einer Vereinigung bei, daher inferiert eine Funktion, die immer eine Ausnahme
  auslöst, `none()`.
- Identitäts-/Projektionsfunktionen behalten exakte Argumentrelationen,
  weitergegeben durch verschachtelte lokale und Remote-Aufrufe mit frischen
  Variablen pro Aufruf.
- Container (`semantic/types/inference_containers`): eine Liste
  `[E1, ..., En | T]` vereinigt ihre Elemente vor dem Fakt des Tails (eine
  echte Liste, wenn der Tail eine ist, `nonempty_improper_list(H, T)`, wenn er
  keine Liste ist, `nonempty_maybe_improper_list()`, wenn er unbekannt ist oder
  unecht sein kann: eine Zelle ist nie leer, auch in einem Muster wie
  `[H | _]`); `++`, `--`, `hd/1`,
  `tl/1`, `element/2`, `setelement/3`, `tuple_to_list/1` und `map_get/2` lesen
  und bauen Elementfakten Mitglied für Mitglied einer Union neu auf, wobei ein
  Mitglied, das eine Ausnahme auslösen würde, nichts beiträgt. Ein Map-Update
  behält exakte Schlüssel (`:=` eines fehlenden Schlüssels verwirft dieses
  Mitglied) und ergibt `map()` bei einer unbekannten Map. Tupel-records sind
  Tupel: die Konstruktion füllt Standardwerte (`undefined` ohne einen), Zugriff
  und Update lesen und setzen das Feld der passenden Tupel, und `#r.f` ist der
  Index des Feldes. Eine List-comprehension ist eine möglicherweise leere Liste
  der Fakten ihrer Templates, eine Binary-comprehension eine beliebige Anzahl
  von Kopien der Größe ihres Templates, eine Map-comprehension `map()`.
- Funs (`semantic/types/inference_funs`): `fun F/A` ist ein fun
  seiner Stelligkeit, der das inferierte Ergebnis der Funktion liefert (das
  eines Builtins, oder bei variabler Stelligkeit `fun()`), `fun M:F/A` einer,
  der `term()` liefert, und ein anonymer fun einer, der die vereinigten
  Ergebnisse seiner Klauseln liefert, erfasste Werte eingeschlossen. Ein Aufruf
  eines Werts vereinigt die Ergebnisse seiner funs dieser Stelligkeit, die
  seine Argumente auswählen (`term()` für einen unbekannten fun,
  `none()`, wenn kein Mitglied so aufgerufen werden kann).
  Ein anonymer fun, der als Ganzes an eine Variable gebunden und über sie
  aufgerufen wird, wird für diesen Aufruf erneut ausgewertet, wobei seine
  Muster die Fakten der Argumente matchen, höchstens 4 solche Aufrufe tief, und
  die Fakten seiner ersten Auswertung werden danach wiederhergestellt
  (`Double = fun(Y) -> Y * 2 end, Double(3)` ist 6). `apply(F, Args)` (auch
  `erlang:apply/2`) ist ein Aufruf von `F` mit den Argumenten, die `Args` hält:
  den Elementen einer literalen echten Liste, sonst denen ihres Fakts (`[]`,
  einer Liste bekannter Positionen oder so vielen Kopien des Elements einer
  echten Liste, wie die einzige Stelligkeit von `F` verlangt); ein gebundener
  anonymer fun wird wie oben erneut ausgewertet (`apply(fun kind/1, [1])` wählt
  `kind(1)`). `apply(M, F, Args)`, dessen `M` und `F` bekannte Atome sind, die
  eine exportierte Batch-Funktion benennen, liest die Funktionstypen dieser
  Funktion wie `fun F/A`. Argumente unbekannter Länge, andere Ziele und
  `M:F(Args)` mit variablen Namen bleiben `term()`. Da `fun F/A` und `apply/3`
  eine später inferierte Funktion benennen können, wiederholen sich die
  Durchläufe über den Batch außerdem, bis jeder solche Lesezugriff das
  endgültige Ergebnis seiner Funktion gesehen hat; andernfalls gibt ein letzter
  Durchlauf ihnen `term()`-Ergebnisse.
- Zuweisungen ganzer Werte im Rumpf und Aliase kopieren den Fakt der rechten
  Seite (`Y = 42, Z = Y, id(Z)` inferiert 42); Tupel-, Listen-, Map- und
  Tupel-record-Muster geben ihren Variablen die Fakten der Teile, die sie
  matchen, in Matches im Rumpf, `case`-Klauseln (vom Prüfausdruck), den
  `of`-Klauseln eines `try` (vom Wert seines Rumpfes) und Generatoren (von den
  Elementen ihrer Eingabe bzw. Map-Schlüsseln und -Werten). Nicht bewiesene
  Werte bleiben `term()` ohne Relationen.
- Einengung (narrowing) (`semantic/types/inference_narrowing`,
  `inference_scopes`, `meet`): innerhalb einer Funktions-, `case`-, `receive`-
  oder fun-Klausel bildet jedes Muster den Schnitt (meet) mit dem Wert, den es
  matcht (ein Literal, eine Tupel-, Listen-, Tupel-record-, Map- oder
  bitstring-Form; der Fakt einer gebundenen Variable), eine
  `case`-Prüfvariable wird damit eingeengt, und der Guard engt die Variablen
  ein, die er testet. Typtests (`is_atom/1` auf `atom()`, `is_boolean/1`,
  `is_integer/1`, `is_float/1`, `is_number/1`, `is_binary/1`,
  `is_bitstring/1`, `is_list/1` auf `maybe_improper_list()`, `is_tuple/1`,
  `is_map/1`, `is_function/1,2`, `is_pid/1`, `is_port/1`, `is_reference/1`,
  `is_record/2,3` auf das Tupel des records, `is_map_key/2` seine Map auf
  `map()`, und die alten Guard-Namen) bilden den Schnitt mit dem Fakt ihres
  Arguments; Vergleiche mit Ganzzahlkonstanten (`<`, `=<`, `>`, `>=`, `==`,
  `=:=`, auf beiden Seiten, gefaltete Konstanten eingeschlossen) engen einen
  bereits als Ganzzahl bewiesenen Wert auf einen Bereich ein, wobei sich die
  Schranken eines Tests ansammeln (`10 >= X, X >= 0` ist `0..10`); zwei
  verglichene bewiesene Ganzzahlen engen einander über ihre Schranken ein
  (`X > Y` mit `Y` in `0..5` macht `X` mindestens 1), und `/=`, `=/=` mit einer
  Konstante verschieben eine ihr gleiche Bereichsschranke nach innen. Ein Wert, der eine Gleitkommazahl oder ein anderer Term sein kann,
  wird nicht eingeengt. Eine Konjunktion wendet jeden Test der Reihe nach an,
  eine Disjunktion vereinigt, was jede Alternative beweist, `not` und falsche
  Tests beweisen nichts. Eine Klausel nach einer, deren Muster alle einfache
  Variablen sind und deren gesamter Guard ein einzelner Typtest war, sieht
  diesen Wert ohne die getestete Kategorie; nach einem einzelnen Vergleich mit
  einer Ganzzahlkonstante sieht derselbe Wert (eine einfache Variable dieser
  Klausel), als Ganzzahl bewiesen, den Vergleich als falsch (`f(N) when N >= 0
  -> ...; f(N) when is_integer(N) -> ...`: die zweite Klausel sieht
  `neg_integer()`). Der rechte Operand von `andalso`, die `true`-Klausel von
  `case Test of` und was auf einen comprehension-Filter folgt, sehen den Test
  als wahr. Ein leerer Schnitt macht die Klausel unmöglich: sie trägt nichts
  zum Ergebnis bei. Eingeengte Fakten gelten nur innerhalb ihrer Klausel oder
  ihres Operanden; `catch`, der rechte Operand von `orelse` und jede Klausel
  stellen die Fakten von davor wieder her. Nach einem `case`, `if`, `receive`,
  `try` oder `maybe` ist der Fakt einer Variable die Vereinigung ihrer Fakten
  am Ende jeder Klausel, die abschließt, daher hinterlässt `case X
  of forever -> ...; N when is_integer(N), N >= 0 -> ... end` `X` als
  `non_neg_integer() | forever`.
- `try` und `maybe`: ein `try` ist die Vereinigung der Werte
  seiner `of`-Klauseln (ohne `of` der seines Rumpfes) und der Werte seiner
  catch-Klauseln; der `after`-Rumpf trägt nichts bei. `of`-Klauseln beginnen
  mit den Fakten am Ende des Rumpfes und matchen dessen Wert wie
  `case`-Klauseln (eine unmögliche Klausel trägt nichts bei); catch-Klauseln
  und der `after`-Rumpf beginnen mit den Fakten vor dem `try`, wobei ein
  Klassenmuster `error | exit | throw` matcht. Ein `maybe` ist die Vereinigung
  des Werts seines Rumpfes, der Werte seiner `else`-Klauseln und, ohne `else`,
  der Werte, an denen seine `?=`-Matches scheitern können: der Fakt des
  gematchten Werts ohne die Form des Musters, wenn das Muster seine gesamte
  Form matcht (neue, einmal verwendete Variablen, literale Atome und
  Ganzzahlen, `[]`, Tupel daraus), sonst der ganze Fakt. Jedes `?=`-Muster
  bildet den Schnitt mit seinem Wert und veröffentlicht seine Variablen für
  den Rest des Rumpfes; ein `?=`, das nie matchen kann, beendet den Rumpf.
  `else`-Klauseln beginnen mit den Fakten vor dem `maybe` und matchen die
  vereinigten Fehlschlagswerte wie `case`-Klauseln. Die Fakten nach einem
  `try` vereinigen die am Ende seines Rumpfes (ohne `of`) und jeder
  abschließenden Klausel; nach einem `maybe` die am Ende seines Rumpfes, jeder
  abschließenden `else`-Klausel und, ohne `else`, die davor.
- Verwendungen (`semantic/types/inference_uses`): eine Operation, die
  eine Ausnahme auslöst, sofern ein Operand keinen bestimmten Typ hat, beweist
  diesen Typ für die gelesene Variable, nachdem die Operation zurückkehrt:
  Arithmetik und unäres `-`/`+` ein `number()`, `div`, `rem`, Bitoperatoren und
  `bnot` ein `integer()`, `and`/`or`/`xor`, `not` und der linke Operand von
  `andalso`/`orelse` ein `boolean()`, `++` und `--` eine `list()`, ein
  aufgerufener Wert ein fun dieser Stelligkeit, ein variabler Modul- oder
  Funktionsname ein `atom()`, ein Map-Update `map()`, ein Tupel-record-Zugriff
  oder -Update das Tupel des records, ein Binary-Segment seinen Typ
  (`<<X:8>>`: `integer()`) und seine Größe ein `non_neg_integer()`, und eine
  Zeile pro Argumentprüfung eines Bridge-Builtins (`hd/1`, `tl/1`
  `nonempty_maybe_improper_list()`, `length/1` `list()`, `element/2`
  `pos_integer()` und `tuple()`, `map_get/2` und `is_map_key/2` `map()`,
  `atom_to_list/1` `atom()`, ...). Die Operation behält ihre Laufzeitprüfung.
  An denselben Wert gebundene Namen (`Y = X`, ein variables `case`-Muster auf
  einem variablen Prüfausdruck) werden gemeinsam eingeengt.
- Eintritts- und Erfolgsdomänen: die Eintrittsdomäne jedes Arguments ist die
  Vereinigung über die möglichen Funktionsklauseln seines Fakts nach Kopf und
  Guard (der eingeengte Fakt einer einfachen Variable, sonst der des Musters);
  seine Erfolgsdomäne die Vereinigung über die abschließenden
  Klauseln seines Fakts bei ihrer normalen Rückkehr. `--print-types` zeigt die
  Erfolgsdomäne als Eingaben (`bounded(1..10) -> 1..10`, `inc(X) -> X + 1` als
  `inc(number()) -> number()`), bzw. die Eintrittsdomäne einer Funktion, die
  nie zurückkehrt. Ein zurückkehrender Aufruf engt seine variablen Argumente
  auf die Domäne des Aufgerufenen ein, außer innerhalb einer rekursiven
  Komponente, die noch gelöst wird.
- Klauselergebnisse werden konservativ vereinigt: eine Projektion bleibt nur
  erhalten, wenn jede Klausel dasselbe Argument liefert. Ein `case` oder `if`
  vereinigt seine Klauselergebnisse auf dieselbe Weise; eine Bindung, die von
  mehreren seiner Klauseln definiert wird, bleibt `term()`.
- Funktionstypen (`semantic/types/function_types`): neben der obigen
  Union-Zusammenfassung behält eine Funktion einen Funktionstyp pro möglicher
  Klausel, wie die Überladungen einer `-spec`: die Fakten der Argumente nach
  Kopf und Guard (der eingeengte Fakt einer einfachen Variable, sonst der des
  Musters) und das Ergebnis der Klausel (`none()` für eine Klausel, die immer
  eine Ausnahme auslöst; unmögliche Klauseln tragen keinen bei). Eine Klausel,
  deren Ergebnis ein [abhängiger Fakt](#dependent-facts) über ihre Argumente ist
  (ein `case` oder `if` an ihrem Ende oder eine daran gebundene Variable, in
  beliebiger Tiefe verschachtelt), teilt sich in einen Funktionstyp pro Klausel
  dieses Fakts auf, wobei die Fakten seiner Parameter mit den Argumenten, die
  sie benennen, geschnitten werden. Funktionstypen mit gleichen Eingaben werden
  zusammengeführt (ihre Ergebnisse vereinigt); über 32 hinaus werden die letzten zu einem zusammengeführt, Eingaben und Ergebnisse
  vereinigt. Rekursive Komponenten iterieren sie mit den Ergebnissen, wobei
  jede Runde das Ergebnis jedes Typs vereinigt (dann aufweitet); eine
  Komponente, die nicht konvergiert, behält nur ihre Union-Zusammenfassungen.
  Der Fakt eines anonymen fun behält einen Funktionstyp pro möglicher Klausel
  (seine Muster und sein Guard über ein beliebiges Argument), `fun F/A` die
  Funktionstypen von `F/A`; funs, die vereinigt werden, behalten ihre
  Funktionstypen nur, wenn sie gleich sind, sonst werden sie zu einem fun ihrer
  vereinigten Ergebnisse mit beliebigen Eingaben vereinigt (der Schnitt mit
  einem fun beliebiger Eingaben, wie ihn die Verwendung `F(A)` bildet, behält
  sie). Spezialisierung, Domänen und Spezifikationsprüfungen lesen die
  Union-Zusammenfassung.
- Aufrufe wählen Funktionstypen aus: ein Aufruf einer Funktion mit
  Funktionstypen liest der Reihe nach jeden Typ, dessen Eingaben jeder
  Argumentfakt schneidet, und hört nach einem exakten auf (Muster aus neuen,
  einmal verwendeten Variablen, literalen Atomen und Ganzzahlen, `[]` und
  Tupeln daraus; kein Guard oder nur `true` und Typtests einfacher
  Argumentvariablen; bei einem Zweig ein Argument als `case`-Prüfausdruck),
  dessen Eingaben die Argumente enthalten: keine spätere Klausel kann betreten
  werden. Sein Ergebnis ist die Vereinigung der Ergebnisse der ausgewählten
  Typen, wobei ein Ergebnis, das einem Argument gleicht, der Fakt dieses
  Arguments innerhalb des Ergebnisses des Typs ist; wird keiner ausgewählt,
  ist der Aufruf `none()` (er kann nur `function_clause` auslösen). Unbekannte
  Argumente wählen jeden Typ aus, die Union; eine Funktion ohne Funktionstypen
  (Budget, nicht konvergierte Komponente) verwendet ihre
  Union-Zusammenfassung. Nachdem ein Aufruf zurückkehrt, werden seine
  variablen Argumente auf die Erfolgsdomäne und auf die vereinigten Eingaben
  der ausgewählten Typen eingeengt. Aufrufe von fun-Werten wählen die
  Funktionstypen des fun-Fakts auf dieselbe Weise aus, und ein anonymer fun,
  der für einen Aufruf erneut ausgewertet wird (siehe Funs), betritt, prüft und
  verlässt seine Klauseln wie ein `case`, sodass eine Klausel, die seine
  Argumente nicht matchen können, nichts beiträgt (`F = fun(1) -> one; (_) ->
  other end, F(2)` ist `other`). Rekursive Komponenten konvergieren über
  Ergebnisse und Funktionstypen.
- Aufrufe werten ihren Aufgerufenen erneut aus: wenn die
  Argumentfakten eines Aufrufs innerhalb der Eingaben des Aufgerufenen liegen
  und in einer davon enger sind, wird der Rumpf des Aufgerufenen mit ihnen als
  Eingaben erneut ausgewertet, wie ein gebundener anonymer fun, und das
  Ergebnis des Aufrufs ist das Ergebnis der ausgewählten Funktionstypen,
  geschnitten mit dem dieser Auswertung (`two_callers() -> {add_one(10),
  add_one(20)}` ist `{11, 21}`); die Argumente des Aufrufs werden außerdem auf
  die Erfolgsdomäne dieser Auswertung eingeengt. Zusammenfassung,
  Funktionstypen und erfasste Ausdrucksfakten des Aufgerufenen ändern sich nie
  (die Spezialisierung liest nur diese). Budgets: 4 verschachtelte
  Auswertungen, Aufgerufene mit höchstens 256 Ausdrücken, 4.096
  Arbeitseinheiten pro Aufruf aus einem Pool von 262.144 pro Durchlauf über
  den Batch (getrennt vom eigenen Budget des Batches); rekursive Komponenten
  werden nie erneut ausgewertet. Jenseits eines Budgets behält der Aufruf das
  Ergebnis der ausgewählten Funktionstypen.
- Ein `receive` ist die Vereinigung seiner Klauseln und seines `after`-Rumpfes,
  den ein Timeout von `infinity` nie ausführt.
- Eine rekursive Komponente beginnt das Ergebnis jedes Mitglieds bei `none()`
  und inferiert alle Mitglieder erneut, bis sich kein Ergebnis mehr ändert;
  jede Runde vereinigt das neue Ergebnis mit dem vorherigen (weitet es nach den
  ersten 8 Runden auf, [Inferenzdomäne](#inference-domain)), und ein
  ausstehender rekursiver Aufruf trägt nichts zu einer Vereinigung bei. Eine
  Funktion, die nie zurückkehren kann, bleibt `none()`. Eine Komponente, die
  nach 8 Runden plus 4 pro Mitglied nicht konvergiert ist oder deren Runden mehr
  als ein Achtel des Durchlaufbudgets verbraucht haben, weitet jedes Mitglied
  auf `term()` auf (als aufgeweitet gemeldet, wie bei Budgeterschöpfung), und
  eine letzte Runde berechnet die Ausdrucksfakten neu; die Ausdrucksfakten
  früherer Runden werden verworfen, sodass nur Fakten aus den endgültigen
  Annahmen übrig bleiben. Eine solche Komponente wird gemerkt: spätere
  Durchläufe geben ihren Mitgliedern sofort `term()` und führen nur diese letzte
  Runde aus, statt erneut bis zur Obergrenze zu iterieren. Der Durchlauf, der
  jede Eingabe auf `term()` aufweitet, vergisst die gemerkten Komponenten,
  sodass jede mit diesen Eingaben noch eine Lösung bekommt.
- Runden verkleinern die Zusammenfassung eines Mitglieds nie: seine
  Funktionstypen werden Typ für Typ mit dem Typ der vorherigen Runde vereinigt
  (Ergebnisse vereinigt, geänderte Eingaben vereinigt, und der Typ ist nicht
  mehr exakt), oder, wenn sich die Anzahl der Typen geändert hat, werden die
  Typen beider Runden zusammengeführt. Als Sicherheitsnetz behält jedes
  Mitglied seine letzten 4 Zusammenfassungen, und eines, das zu einer davon
  zurückkehrt, ist für den Rest der Lösung `term()` ohne Funktionstypen, was
  die anderen Mitglieder konvergieren lässt.
- Eine Runde durchläuft nur Mitglieder, die eine seit ihrem letzten Durchlauf
  geänderte Zusammenfassung lesen: Jeder Durchlauf vermerkt die
  Zusammenfassungen, die er liest (Aufrufe, Aufrufergebnisse, `fun F/A`), eine
  geänderte Zusammenfassung markiert ihre Leser, und ein nicht markiertes
  Mitglied behält seine Ausdrucksfakten. Die erste Runde durchläuft jedes
  Mitglied, sodass eine Runde mit allen Mitgliedern markiert die volle Runde
  früherer Schritte ist.
- Ein gemeinsames Arbeitsbudget begrenzt die Inferenz; Erschöpfung kostet
  Präzision und fällt auf generischen Code zurück, weist aber nie ein Programm
  zurück.
- Spezifikationen, die der Inferenz widersprechen, werden diagnostiziert
  (`semantic/types/contracts`): eine widersprochene Eintrittsdomäne eines
  Arguments ist ein Fehler; ein widersprochenes Ergebnis und ein Aufruf, dessen
  Argumentfakten jede Überladung ablehnt, sind Warnungen (der Aufruf kann auf
  einem Pfad liegen, der nie läuft). Spezifikationen werden nie zu Fakten:
  Inferenz, Spezialisierung und Codeerzeugung verwenden die inferierten Typen,
  sodass sich das Programm in jedem Fall so verhält, wie sein Code sagt. Ein
  deklarierter Typ wird zu den Fakten, die er
  enthält (oder mehr): eingebaute Typen nach Namen (`byte()` ist `0..255`,
  `timeout()` ist `non_neg_integer() | infinity`, `iodata()` und `iolist()`
  Listen beliebiger Form), Aliase nach ihrer Definition, opake und nominale
  Typen nach ihrer Definition innerhalb ihres Moduls und als beliebiger Term
  außerhalb, Remote-Typen über den Batch, Typvariablen über ihre
  `when`-Schranken (eine unbeschränkte ist ein beliebiger Term), Maps und
  records nach ihrer Kategorie. Eine Spezifikation widerspricht dem Code, wenn
  ihre Fakten keinen Wert mit dem teilen, was die Inferenz beweist: dem
  inferierten Ergebnis (außer unbekannt, oder `none()`: eine Funktion, die nie
  zurückkehrt, passt zu jedem Ergebnis), der Eintrittsdomäne eines Arguments
  oder den Argumentfakten eines Aufrufs gegenüber jeder Überladung.
  `none()`/`no_return()` lässt nur eine Funktion zu, die nie zurückkehrt. Die
  Diagnose nennt die Funktion, den deklarierten Typ wie geschrieben und den
  inferierten. Da inferierte Fakten mehr Werte enthalten können, als der Code
  erzeugt, ist nur ein disjunktes Paar ein Widerspruch: ein deklarierter Typ,
  der enger als der inferierte ist, wird akzeptiert. `-callback`-Spezifikationen
  werden nicht geprüft. OTPs Compiler prüft Spezifikationen nicht
  ([Unterschiede](differences.md#language-edge-cases)).

### Abhängige Fakten

Quelle: `semantic/types/dependent`. Ein `case`, `if` oder `try ... of` verhält
sich wie ein fun der Variablen, die seine Klauseln einengen, angewendet auf
diese: Sein Wert ist ein abhängiger Fakt, ein Funktionstyp pro möglicher
Klausel.

- Parameter: die vor dem Konstrukt gebundenen Variablen, die sein Prüfausdruck
  (der letzte Ausdruck des Rumpfes eines `try`) und seine Guards lesen, in
  Quelltextreihenfolge (Variablen, die seine Klauselmuster binden, sind in jeder
  Klausel neu, keine Parameter); höchstens 4, die Einengung eines späteren wird
  vergessen. Jede mögliche Klausel behält die Fakten der Parameter nach ihrem
  Muster und Guard sowie ihren Wert (`none()` für eine Klausel, die nie
  abschließt); sie ist exakt, wie ein Funktionstyp (58L), wenn ein `case` oder
  `try` einen Parameter oder ein Tupel von Parametern mit exaktem Muster und
  Guard matcht oder ein `if` einen exakten Guard hat.
- Ein Prüfausdruck, der ein Tupel von Variablen ist, engt jede Variable auf ihr
  Element des gematchten Werts ein, und die Variable eines Tupelmusters wird an
  denselben Wert gebunden wie das Element des Prüfausdrucks an ihrer Position
  (`case {X, Y} of {A, b} when is_integer(A) -> ...` engt `X` und `Y` ein).
- Ein `try ... of` hängt von seinen `of`-Klauseln ab; seine catch-Klauseln
  können auf jeden Wert seines Rumpfes folgen, daher wird ihr vereinigter Wert
  in den Wert jeder Klausel vereinigt (`try X of 1 -> one; _ -> other catch _:_
  -> error end` ist
  `$try_of_operator(X :: 1) -> error | one; (X :: _) -> error | other`).
- `receive` und `maybe ... else` bleiben die Vereinigung ihrer Klauseln: Ihre
  Klauseln matchen eine Nachricht oder einen gescheiterten `?=`-Wert, den nichts
  außerhalb benennen kann, daher könnte kein Lesezugriff unter ihnen auswählen.
- Eine Klausel, deren Wert selbst abhängig ist (ein verschachteltes `case` oder
  `if` oder ein Lesezugriff auf eine abhängige Variable), trägt einen
  Funktionstyp pro Klausel davon bei, über der Vereinigung beider
  Parameterlisten, die Eingaben geschnitten. Typen, die nie betreten werden
  können (eine Eingabe `none()` oder innerhalb der Eingaben eines früheren
  exakten Typs), werden verworfen, ebenso Parameter, deren Fakten in jedem Typ
  gleich sind; gleiche Eingaben werden zusammengeführt, und über 32 Typen hinaus
  werden die letzten zusammengeführt (58K). Ein Konstrukt, dessen verbleibende
  Typen alle denselben Wert liefern oder das keinen Parameter einengt, ist seine
  einfache Vereinigung.
- Jeder andere Verbraucher liest den gelöschten Fakt, die Vereinigung der Werte
  der Klauseln. Fakten, die die durchlaufene Funktion verlassen (Ergebnisse,
  Funktionstypen, fun-Fakten), werden gelöscht; Vereinigungen behalten eine
  Abhängigkeit nur, wenn beide Seiten dieselbe haben.
- Eine an einen abhängigen Wert gebundene Variable behält ihn. Das Lesen der
  Variable wählt die Klauseln, die die aktuellen Fakten ihrer Parameter
  betreten (Reihenfolge wie in 58L, eine exakte Klausel, deren Eingaben sie
  enthalten, beendet die Auswahl) und deren Werte den eigenen eingeengten Fakt
  der Variable schneiden, und der Fakt des Lesezugriffs ist die Vereinigung
  ihrer Werte (`Y = case X of 1 -> one; _ -> other end, case X of 1 -> Y end`
  liest `one`).
- Eine Variable, die jede Klausel eines `case` oder `if` bindet, ist die
  Vereinigung ihrer Fakten am Ende der abschließenden Klauseln, abhängig von den
  Parametern des Konstrukts wie dessen Wert:
  `case X of 1 -> Y = 5; _ -> Y = 6 end, Y` inferiert `(1) -> 5; (_) -> 6`.
  Dieselbe Vereinigung gilt nach `receive`, `try` und `maybe`, ohne
  Abhängigkeit.
- Operatoren, Builtins, Tupel-, Listen-, Map- und record-Konstruktionen sowie
  Aufrufe von Batch-Funktionen (deren Funktionstypen wie in 58L ausgewählt, die
  Argumente nicht erneut eingeengt) mit abhängigen Operanden werden einmal pro
  Kombination der Klauseln der Operanden ausgewertet, mit den Werten dieser
  Klauseln anstelle der Fakten der Operanden und ihren Eingaben geschnitten:
  Lesezugriffe auf eine Variable nehmen dieselbe Klausel, andere Operanden
  werden kombiniert, höchstens 16 Kombinationen (darüber hinaus ist die
  Verwendung die einfache Vereinigung). `R + 1` mit
  `R = case X of a -> 1; b -> 2 end` inferiert `(a) -> 2; (b) -> 3`.
- Das Einengen einer abhängigen Variable (ein Muster, ein Guard, eine
  Verwendung) engt auch ihre Parameter auf die Vereinigung der Eingaben der
  betretenen Klauseln ein, deren Werte den eingeengten Fakt schneiden, und
  deren Parameter wiederum, 4 Ebenen tief: nach
  `R = case X of a -> 1; b -> 2 end` liest `case R of 1 -> X end` `X` als `a`.
- Das abhängige Ergebnis einer Funktionsklausel teilt sie auf (siehe
  Funktionstypen): Parameter, die ein Argument oder einen an seinen Wert
  gebundenen Namen benennen, schneiden dessen Eingabe; andere werden verworfen
  (ein solcher Typ ist nur exakt, wenn ihre Eingabe ein beliebiger Term ist).
  `nested_case(X, L)` mit `case X of 1 -> case L of spanish -> uno;
  _ -> one end; _ -> other end` inferiert `(1, spanish) -> uno; (1, _) -> one;
  (_, _) -> other`.
- `--print-types` vermerkt einen abhängigen Wert als Funktionstyp, benannt nach
  seinem Konstrukt, jede Eingabe nach dem Namen ihres Parameters:
  `case X of 1 -> one; _ -> other end` endet auf
  `end. % $case_of_operator(X :: 1) -> one; (X :: _) -> other`; ein `if` gibt
  `$if_operator` aus, ein `try ... of` `$try_of_operator`.

### Inferenzdomäne

Quelle: `semantic/types/lattice`. Ein Fakt ist eine
Menge von Werten, die eine Variable oder ein Ergebnis haben kann. Fakten werden
dort vereinigt, wo der Kontrollfluss zusammenläuft (Klauseln, Zweige), und
zwischen den Runden einer rekursiven Komponente aufgeweitet; jedes der
folgenden Budgets weitet korrekt auf eine größere Menge auf und weist nie ein
Programm zurück. Fakten werden als Erlang-Typen ausgegeben, Kategorien unter
ihren eingebauten Namen.

| Fakt | Ausgabe | Vereinigung | Budget und Aufweitung |
| --- | --- | --- | --- |
| Nichts | `none()` | Neutrales Element | Eine Funktion, die nie zurückkehrt, bleibt `none()` |
| Alles | `term()` | Absorbiert jeden Fakt | `dynamic()` und `any()` sind `term()` |
| Ganzzahlen | `42`, `1 \| 3 \| 7` | Union der Singletons | Mehr als 8 Singletons werden zu ihrem Bereich |
| Ganzzahlbereich | `1..10`, `0..255` | Kleinster Bereich, der beide enthält | Eine Schranke, die sich zwischen Runden bewegt hat, springt zum nächsten Schwellenwert: eine untere auf 1, dann 0, dann unbeschränkt; eine obere auf -1, dann unbeschränkt |
| Unbeschränkte Ganzzahlen | `pos_integer()` (ab 1), `non_neg_integer()` (ab 0), `neg_integer()` (-1 und darunter), `integer()` | Kleinstes Intervall, das beide enthält, ausgegeben nach seiner Kategorie | — |
| Gleitkommazahlen | `float()` | — | — |
| Zahlen | `number()` | Ein Bereich oder eine Kategorie von Ganzzahlen, vereinigt mit `float()` | Singleton-Ganzzahlen mit `float()` bleiben `1 \| float()` |
| Atome | `ok`, `error \| ok`, `boolean()` | Union der Singletons; genau `false` und `true` werden als `boolean()` ausgegeben | Mehr als 8 Singletons werden zu `atom()` |
| Bezeichner | `pid()`, `port()`, `reference()` | — | — |
| Tupel | `{ok, 1}`, `tuple()`, `#point{x :: 0, y :: _}` | Tupel gleicher Größe, deren erste Elemente nicht zwei verschiedene Atome sind (ihr Tag), werden elementweise vereinigt; andere bleiben getrennte Mitglieder | Mehr als 16 Elemente werden zu `tuple()`, sofern nicht jedes Element bekannt ist; mehr als 8 getrennte Formen werden zu `tuple()`. Ein Tupel mit Name und Größe eines sichtbaren Tupel-records wird als record ausgegeben |
| Listen | `[]`, `[T]`, `[T, ...]`, `nonempty_improper_list(H, T)`, `[1, a]`, `[a, b \| T]` | Elemente werden vereinigt; `[]` mit einer nichtleeren Liste ergibt eine möglicherweise leere; unechte Listen vereinigen Köpfe und Tails. Listen aus zwei oder mehr bekannten Elementen behalten ihre Positionen (eine Clause-Notation, die Typsprache hat keine, Elemente mit `\|` in Klammern ausgegeben): positionelle Listen einer Länge werden Position für Position vereinigt, sonst als einfache Listen | Eine Liste von `0..1114111` (`char()`) wird als `string()` oder `nonempty_string()` ausgegeben; eine möglicherweise leere Liste von `_` als `list()` |
| Maps | `#{}`, `#{a := 1}`, `#{1..17 => a}`, `map()` | Maps mit denselben Schlüsseln werden Wert für Wert vereinigt; Maps anderer Schlüssel werden zu einer Assoziation ihrer vereinigten Schlüssel und Werte vereinigt (`=>`: jeder Schlüssel darf fehlen) | Mehr als 16 Schlüssel werden zu einer Assoziation vereinigt |
| Funs | `fun((term()) -> 1)`, `fun()` | Funs einer Stelligkeit vereinigen ihre Ergebnisse; andere Stelligkeiten ergeben `fun()` | — |
| Bitstrings | `<<_:16>>`, `<<_:3, _:_*2>>`, `binary()` | Die kürzere Größe plus jede Größendifferenz als Einheit | Basis und Einheit 0/8, 8/8, 0/1, 1/1 werden als `binary()`, `nonempty_binary()`, `bitstring()`, `nonempty_bitstring()` ausgegeben |

- Eine Union behält ein Mitglied pro vereinigter Form, in der
  Erlang-Termordnung ihrer Werte: Zahlen, Atome, `reference()`, funs, `port()`,
  `pid()`, Tupel, Maps, `[]`, Listen, bitstrings, dann deklarierte benannte
  Typen; mehr als 8 Mitglieder werden zu `term()`.
- Container sind höchstens 4 Ebenen tief verschachtelt; ein tiefer liegender
  Fakt wird zu `term()`.
- Eine Union verwirft ein exaktes Tupelmitglied, das ein anderes exaktes Tupel
  seiner Größe enthält (von zweien, die einander enthalten, bleibt das
  frühere), sodass eine Wertmenge eine einzige Union hat; ohne das erreichten
  Rekursionen über Bäume dieselben Werte in wechselnden Formen, und ihre Runden
  stabilisierten sich nie.
- Eine rekursive Komponente vereinigt Ergebnisse 8 Runden lang (Zyklen von bis
  zu 8 Funktionen konvergieren exakt) und weitet sie dann auf. Eine Komponente,
  die nach 4 weiteren Runden pro Mitglied nicht konvergiert ist, weitet jedes
  Mitglied auf `term()` auf und wird als aufgeweitet gemeldet, wie ein
  erschöpftes Budget.
- Einengung (58H, `Lattice::meet`) ist der Schnitt von Fakten,
  die Werte, die beide enthalten (oder mehr, aber `none()` nur, wenn sie keine
  teilen): Muster und Guards (Typtests wie `is_integer/1` engen ihr Argument
  auf die Kategorie ein) engen innerhalb ihrer Klausel ein und legen die
  Eintrittsdomäne einer Funktion fest; eine Verwendung, die eine Ausnahme
  auslöst, sofern ihr Operand keinen bestimmten Typ hat, engt den Operanden
  danach auf dem normalen Pfad ein. Ein leerer Schnitt bedeutet, dass der Pfad
  nicht ausgeführt werden kann.
- Spezifikationen fügen Fakten nie etwas hinzu: inferierte Fakten stammen nur
  aus Code und entscheiden nie auf das Wort einer Spec hin über eine
  Repräsentation.

Das Lowering verarbeitet diese Fakten. Bei `-O2` mit Typspezialisierung
entfernen Fakten von Argumenten, die von Aufrufern vereinigt werden, und von
Ausdrücken Tag-, Form- und Service-Prüfungen
([Nachweise](specialization.md#proofs)); die einzigen Umwandlungen in
Heap-Zeiger sind diese nachgewiesenen Lesezugriffe. Jedes fehlbare
Serviceergebnis wird nur auf seinem Erfolgspfad geladen, und Formprüfungen
dominieren die Extraktion. Spezialisierungsstrategie:
[specialization.md](specialization.md).

### Inferenz-Cache

Module in den Verzeichnissen des [Inferenz-Caches](projects.md#inference-cache)
können eine Kompilierung mit den Ergebnissen beginnen, die eine frühere
Kompilierung behalten hat: Zusammenfassungen, lokale Eingaben und
Ausdrucksfakten ihrer Funktionen. `infer` hält sie in jedem Durchlauf fest,
durchläuft nie eine Komponente, deren Mitglieder sie alle wiederverwenden, und
durchläuft jede andere Funktion wie üblich, wobei es die behaltenen
Zusammenfassungen wie jede andere liest.

- **Wovon die Fakten eines Moduls abhängen.** Exportierte Funktionen und
  Funktionen, die ein `fun F/A` benennt, beginnen bei `term()`; die Eingaben
  jeder anderen Funktion kommen von ihren Aufrufern, die im selben Modul sind;
  ein Fakt benennt eine Funktion eines anderen Moduls nur über ein Atom: einen
  Remote-Aufruf, `fun M:F/A` oder `apply/2,3` auf einem Atomfakt (und liest das
  record-Layout eines anderen Moduls nur über einen nativen record, den es
  qualifiziert oder importiert), und jeder Atomfakt stammt von einem Atom, das
  das Modul schreibt, oder aus einem Fakt eines Moduls, das es erreicht. Die
  Fakten eines Moduls hängen also nur von seinem eigenen Code und vom Code der
  Batch-Module ab, die seine Atome benennen, transitiv. Der Schlüssel seiner
  behaltenen Ergebnisse deckt genau das ab: die Identität von `clau`, den
  Fingerabdruck des Moduls (sein Quelltext, jede Datei, die es einbindet,
  Präprozessoroptionen und eine Antwort einer Parse-Transformation),
  vordefinierte Formen, escript- und Bibliotheksstatus sowie dasselbe von jedem
  Batch-Modul, das seine Atome erreichen. Ein so erreichtes Modul ohne
  Fingerabdruck macht das Modul nicht cachebar.
- **Lebendigkeit.** Die Export-Lebendigkeit entfernt nur Funktionen, und ein
  entfernter Aufrufer engt nur die Eingaben der Funktionen ein, die er aufrief:
  mit mehr lebenden Funktionen berechnete Fakten gelten weiterhin. Behaltene
  Ergebnisse werden wiederverwendet, wenn sie jede jetzt lebende Funktion
  enthalten (sonst `results do not fit`); weggelassene Funktionen bekommen
  nichts.
- **Mischen.** Behaltene und frische Ergebnisse können sich in einem Batch
  treffen: Die Fakten jedes Moduls gelten für jeden Lauf des Programms,
  unabhängig davon, was die Fakten eines anderen Moduls sagen, daher bleibt ein
  frisches Modul, das eine behaltene Zusammenfassung liest (oder umgekehrt),
  korrekt. Eine rekursive Komponente mit Mitgliedern beider Arten wird als
  Ganzes durchlaufen.
- **Präzision.** Wiederverwendete Ergebnisse sind die der Kompilierung, die sie
  behalten hat. Die Ergebnisse eines frischen Moduls können dennoch von einer
  Kompilierung ohne Cache abweichen: Das Durchlaufbudget bezahlt nicht mehr für
  wiederverwendete Module, und Graphidentitäten, nach denen einige
  Union-Mitglieder geordnet werden, sind anders nummeriert.

## `--print-types`

Gibt jedes Modul des Batches (in Eingabe-/Zielreihenfolge, Bibliotheksmodule
danach) als Erlang-Quelltext aus ([Quelltextausgabe](compile.md#source-printing))
zusammen mit dem, was die Typinferenz gefunden hat. Die Ausgabe erfolgt auf
stdout und ist menschenlesbar, weder Erlang noch ein Austauschformat. Warnungen
bleiben auf stderr.

```erlang
%% module "branches" source="branches.erl" target="" declared=complete inferred=complete
-module(branches).
-export([mixed/1]).

%% inferred: mixed(1) -> 1; (_) -> 2
mixed(X) ->
    case X of
        1 ->
            1;
        _ ->
            2
    end. % $case_of_operator(X :: 1) -> 1; (X :: _) -> 2
```

- Eine `%% module`-Zeile nennt das Modul, seinen Quelltext, das Projektziel und
  ob deklarierte und inferierte Typen vollständig waren oder durch ein Limit
  aufgeweitet wurden.
- Deklarationen (`-type`, `-spec`, `-callback`, records) erscheinen wie
  geschrieben.
- Über jeder Funktion gibt `%% declared: f(Inputs) -> Result` jede Überladung
  ihrer `-spec` aufgelöst an (mit ihren `when`-Bedingungen), und
  `%% inferred: f(Inputs) -> Result`, was die Inferenz gefunden hat, sodass
  beide verglichen werden können. Die Eingaben sind die Erfolgsdomäne jedes
  Arguments (ausgehend von `term()` bei exportierten Funktionen und solchen,
  die `fun F/A` benennt, ausgehend von den vereinigten Argumenten der Aufrufer
  bei anderen Funktionen). Eine Funktion mit mehreren Funktionstypen gibt eine
  Signatur pro Typ aus, jede mit eigenen Eingaben:
  `f(integer()) -> integer(); (atom()) -> string()`
  (`semantic::types::function_source`). Eine `-spec` bleibt direkt vor der
  Funktion, durch eine Leerzeile von anderen Formen abgesetzt.
- Der äußerste Ausdruck jeder Zeile (ein Rumpfausdruck oder der Prüfausdruck
  eines `case`), dessen Fakt mehr als `term()` aussagt, wird mit einem
  abschließenden Kommentar `% Type` nach der Interpunktion der Zeile vermerkt
  (ein bekannter Typ verdeckt eine Argumentrelation, die nur bei einem Wert
  erscheint, über den sonst nichts bekannt ist): höchstens ein Vermerk pro
  Zeile, keiner für die darin verschachtelten Ausdrücke, sodass die Ausgabe
  gültiges Erlang bleibt. Ein Rumpfausdruck über mehrere Zeilen trägt seinen
  Vermerk in seiner letzten Zeile (`end, % ...`). Literale Terme (Literale sowie
  Tupel, Listen, konstruierte Maps und bitstrings aus Literalen) werden nicht
  vermerkt; ein Match zeigt seinen Wert. Ein abhängiger Wert wird wie ein
  Funktionstyp seines Konstrukts ausgegeben
  ([abhängige Fakten](#dependent-facts)).
- Ein Wert, den die Inferenz als gleich einem der Argumente der Funktion
  bewiesen hat und über den nichts weiter bekannt ist, wird als Name dieses
  Arguments ausgegeben, eine Typvariable: die Variable, die ihm die erste
  Klausel gibt, die das ganze Argument bindet, sonst `_argumentN` (1-basiert,
  auch wenn ein früheres Argument den Namen genommen hat). Die Eingabe des
  Arguments zeigt denselben Namen, wenn sie ein beliebiger Term ist:
  `second(_, Y) -> Y`, `keep(Acc, number()) -> Acc`. Eine Variable zeigt nur
  ihren Typ, ihr Name sagt bereits, welches Argument sie ist.

### Inferenzerwartungen

`tests/fixtures/inference/*.erl` halten fest, was die Inferenz für jede
Funktion finden sollte und was sie heute findet. Jedes Modul wird zum CTest
`inference_<module>` (`tests/compiler/inference/expectations.py`):

```erlang
%% expect: sum() -> 3
%% today: sum() -> _
sum() -> 1 + 2.
```

- `expect:` ist die Signatur, die `--print-types` in seiner
  `%% inferred:`-Zeile ausgeben sollte; `today:`, vorhanden, solange die
  Inferenz dahinter zurückbleibt, ist die, die es jetzt ausgibt.
- Die Prüfung vergleicht die Ausgabe mit `today`, falls vorhanden, sonst mit
  `expect`; jede Funktion des Moduls braucht eine `expect`-Zeile. Eine
  `today`-Zeile, die die Inferenz eingeholt hat, lässt die Prüfung
  fehlschlagen, bis sie entfernt wird.
- `expectations.py <clau> <fixture> --record` schreibt die `today`-Zeilen aus
  der aktuellen Ausgabe neu (eine Aktion für Maintainer: den Diff prüfen).
- `values.erl` deckt Literale, Arithmetik und Vergleiche ab, Aufrufe lokaler
  und anderer Funktionen, Ganzzahlvereinigungen und -bereiche, Ganzzahlen oder
  Gleitkommazahlen, Listen, Strings, Tupel, Maps mit Atom- und anderen
  Schlüsseln, zurückgegebene und angewendete funs, binaries,
  Argumentrelationen und `try`/`maybe`-Werte. Heute findet die Inferenz
  literale und konstruierte Werte, Ergebnisse von Operatoren und Builtins,
  Container und ihre Teile, funs und ihre Aufrufe, lokale Eingaben von
  Aufrufern, Ganzzahlvereinigungen und Argumentrelationen, Einengung durch
  Verwendungen und Erfolgsdomänen (141 von 141 Funktionen).
- `narrowing.erl` deckt jeden Typtest ab, case-Guards, Prüfausdrücke mit
  wahrem Test, `andalso`, comprehension-Filter, Tupel-/Listen-/Map-Muster,
  Auffangklauseln, Bereichs-Guards, Widersprüche, Disjunktionen, die Klausel
  nach einem einzelnen Typtest, Einengung nach einem Aufruf, Einengungen, die
  nicht durchsickern dürfen, und Vergleichsbereiche: jeden Operator auf beiden
  Seiten, zwei Variablen, `=/=` an und innerhalb einer Schranke, Komplemente,
  case- und if-Guards, ein `orelse`, einen Countdown mit Guard und Operanden,
  die nicht eingeengt werden dürfen (51 von 51).
- `base_types.erl` hat eine Funktion pro Basistyp und eingebautem Typ der
  [Typsprache](https://www.erlang.org/doc/system/typespec.html) (`pid()`,
  `reference()`, bitstrings und binaries, Bereiche, `byte()`, `char()`,
  `non_neg_integer()`, `boolean()`, `string()`, `iolist()`, `mfa()`,
  `timeout()`, `no_return()`, ...): ihre `-spec` nennt den Typ, sodass für
  jeden eingebauten Typ geprüft wird, dass er sich auflöst, und ihr Rumpf
  erzeugt einen solchen Wert. Kategorien werden unter ihren eingebauten Namen
  erwartet, beschränkte Ganzzahlmengen als Bereiche. Jede Funktion erreicht
  ihren erwarteten Typ.
- `clauses.erl` deckt Funktionstypen ab: Typtests und literale
  Muster pro Klausel, zusammengeführte gleiche Eingaben, eine Klausel, die
  Aufrufer nie betreten, mehr Klauseln als das Budget, eine rekursive
  Funktion, eine einzelne Klausel, ein `case` und ein `if` am Ende des
  Rumpfes, ein verschachteltes `case` und ein `case`, das nicht am Ende steht,
  anonyme funs mit mehreren Klauseln, `fun F/A`, Vereinigungen gleicher und
  verschiedener funs und eine Klausel, die immer eine Ausnahme auslöst; ferner
  die Aufrufauswahl: einen Typtest, einen ersten exakten Zweig,
  unbekannte Argumente, keinen zugelassenen Typ, Einengung nach dem Aufruf, ein
  literales Argument, einen Bereich über zwei Klauseln, verschachtelte
  Aufrufe, eine lokale Funktion mit mehreren Aufrufern, einen rekursiven
  Aufgerufenen und funs mit mehreren Klauseln, gebunden, in einem Tupel, an
  eine lokale Funktion übergeben und mit einem unbekannten Argument
  aufgerufen; und die Auswertung pro Aufruf: Ergebnisse pro Aufruf,
  Verschachtelung bis zum und über das Tiefenbudget hinaus, einen Aufgerufenen
  über dem Größenbudget, einen rekursiven Aufgerufenen und unbekannte
  Argumente.

### Ausgabe von Typen

`semantic::types::type_source(graph, type)` (`semantic/types/printing`) stellt
einen Typ des Typgraphen in Erlang-Typsyntax dar: `_` für einen beliebigen Term
(`term()`, der Kürze halber von `TERM_SOURCE` geschrieben; die Typsyntax liest
`_` als `any()`), `none()`, Atome und Ganzzahlen, `1..5`, `{ok, T}`, `tuple()`,
`[T]`, `[T, ...]`, `#{K => V, K := V}`, `#r{f :: T}`, `<<_:B, _:_*U>>`,
`fun((A) -> R)`, `A | B`. Ein fun mit mehreren Funktionstypen gibt sie in einer
Clause-Notation aus, `fun((1) -> one; (_) -> other)`: die Erlang-Typsyntax
kennt keinen überladenen fun-Typ, und eine Union von fun-Typen bedeutet etwas
anderes. Die Ganzzahlen einer Union werden in Wertreihenfolge dort ausgegeben,
wo ihre erste Ganzzahl steht, aufeinanderfolgende als Bereich (`1 | 2 | 3 | 5`
wird als `1..3 | 5` ausgegeben; der Fakt behält die Singletons).
Vordefinierte `erlang`-Typen verlieren ihr Modul; Referenzen auf deklarierte
Typen bleiben benannt. Ein Knotenbudget begrenzt den Text; jenseits davon, und
unterhalb von 32 Verschachtelungsebenen, steht `...` an seiner Stelle.

```sh
clau --print-types answer.erl client.erl
clau --print-types --project project.toml --target demo --verbose
```
