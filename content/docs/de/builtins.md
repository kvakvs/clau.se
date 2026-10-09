---
source: docs/builtins.md
sourceCommit: 06042fa
sourceSha256: f29dab6160d90187001e7fd8ed997c13236a315dce8c744f9d83072bfdbdaae4
translatedAt: 2026-10-09
---
# Builtins

Plan 11 step 36 (2026-10-07): die produktive Builtin-Brücke. Builtins sind
`erlang`-Funktionen, die die Runtime in C++ implementiert. Die Runtime
registriert sie nach Modul, Funktion und Stelligkeit; generierter Code erreicht
sie direkt, über dynamische Aufrufe und als Fun-Werte.

## Welche Builtins es gibt

Der Brückenkatalog `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) führt jedes Builtin
auf, das sowohl der Compiler als auch die Runtime kennen:

- die Guard-BIFs: Typtests (`is_atom/1` … `is_tuple/1`, `is_function/1,2`),
  `abs/1`, `bit_size/1`, `byte_size/1`, `ceil/1`, `element/2`, `float/1`,
  `floor/1`, `hd/1`, `length/1`, `map_get/2`, `map_size/1`, `is_map_key/2`,
  `max/2`, `min/2`, `round/1`, `size/1`, `tl/1`, `trunc/1`, `tuple_size/1`,
  `binary_part/2,3`;
- die Operatoren als Funktionen: Vergleiche, `not/1`, `and/2`, `or/2`,
  `xor/2`, arithmetische und bitweise Operatoren (`erlang:'+'/1,2` …);
- `display/1`, `halt/0,1`, `error/1,2,3`, `exit/1`, `throw/1`, `raise/3` und
  `function_exported/3`;
- Term-Zugriff (plan step 37): `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` und die Listenoperatoren `'++'/2` und
  `'--'/2` (`A ++ B`, `A -- B` werden per Lowering auf sie abgebildet);
- Konvertierungen (plan step 38): `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` ist nicht ausgewählt);
- Konsolenausgabe (plan step 40): `io:format/1,2` und `io:put_chars/1`, die
  ersten Builtins eines anderen Moduls ([io](io.md));
- Prozessidentitäten (plan step 42): `self/0`, `make_ref/0`, `pid_to_list/1`
  und `ref_to_list/1` ([Pids und Referenzen](terms.md#pids-and-references));
- Prozesse (plan step 43): `spawn/1,3` und `is_process_alive/1`
  ([Prozesse](processes.md)); Links und Exit-Signale (step 48):
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([Links](processes.md#links)); Monitore (step 49):
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([Monitore](processes.md#monitors)); registrierte Namen (step 50):
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([registrierte Namen](processes.md#registered-names));
- Nachrichten (plan step 45): `'!'/2` (der Operator `!`) und `send/2`
  ([Nachrichten](processes.md#messages)).

Einträge werden nur angehängt: Der Index eines Eintrags ist die Nummer, die
generierter Code an den Brückendienst übergibt. Ein qualifizierter Aufruf eines
Katalog-Builtins eines anderen Moduls (`io:format(F, A)`) ruft ebenfalls die
Brücke auf. Andere `erlang`-Funktionen behalten ihre Diagnosen:
ein direkter Aufruf einer unbekannten ergibt `unknown module erlang`;
`fun erlang:F/A` oder `fun F/A` eines Guard-BIF außerhalb des Katalogs
(`node/0`) sowie `fun erlang:apply/2,3` melden die nicht verfügbare Fähigkeit
`dynamic calls`.

## Wie Aufrufe sie erreichen

| Quelle | Weg |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Inline-Dienste, wie vor der Brücke |
| `erlang:function_exported(M, F, A)`, `setelement(I, T, V)`, `A ++ B`, `A -- B`, `length(L)` in einem Rumpf (Katalog-Builtins ohne Inline-Dienst) | Wie eine Funktion betreten: `CLAUSE_builtin_frame_v1(context, index)` liefert den Frame des Builtins, die Argumente kommen in die Register ([Portionen](#portions)) |
| `fun abs/1`, `fun erlang:'+'/2` | Externe Fun `erlang:F/A`; die Registrierung bindet sie an das Builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` zur Laufzeit | Der Code-Server sucht zuerst einen Export des Moduls, dann ein Builtin |

- `fun F/A` eines automatisch importierten Builtins, das das Modul weder
  definiert noch unterdrückt (`-compile({no_auto_import, ...})`), ist die externe
  Fun `erlang:F/A`, wie in OTP: `fun abs/1 =:= fun erlang:abs/1`, und sie wird als
  `fun erlang:abs/1` ausgegeben. `halt/0,1`, `setelement/3`, `tuple_to_list/1`,
  `list_to_tuple/1`, die Konvertierungen, die Prozess-Builtins und die
  Port-Builtins `open_port/2`, `port_close/1`,
  `port_command/2,3`, `port_connect/2`, `port_control/3`, `port_to_list/1`,
  `list_to_port/1` werden wie in OTP automatisch importiert; `display/1`,
  `raise/3`, `function_exported/3`, `make_tuple/2,3`, `port_info/1,2`,
  `port_call/2,3` und `ports/0` brauchen das Präfix `erlang:`
  ([Ports](ports.md#builtins-and-port-messages)).
- Ein Builtin hat einen `FrameDescriptor` mit leerem Rumpf (`BuiltinFrame`).
  Sein Betreten (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) legt keinen Frame an: Das
  Builtin läuft auf den Registern, und sein Ergebnis kehrt in den Rumpf des
  Aufrufers zurück, sodass ein Builtin in Endposition zum Aufrufer des Aufrufers
  zurückkehrt.
- Fehler sind dieselben, die das Inline-Lowering in einem Rumpf auslöst:
  `badarg`, `badarith` für Arithmetik, `system_limit`, `{badmap, M}`,
  `{badkey, K}`; `raise/3` mit ungültiger Klasse oder ungültigem Stack gibt
  `badarg` zurück. Sie laufen wie jeder Dienstfehler über den geprüften
  Fehlerkanal.
- Term-Zugriff folgt den `badarg`-Regeln von OTP: `setelement/3` braucht einen
  kleinen ganzzahligen Index innerhalb des Tupels; `make_tuple/2,3` eine kleine
  Größe in 0..16.777.215, und `make_tuple/3` eine echte Liste von
  `{Index, Value}`-Paaren innerhalb der Größe (spätere Paare gewinnen);
  `list_to_tuple/1` eine echte Liste; `A ++ B` eine echte Liste `A`
  (`[] ++ B` ist `B` für jedes `B`, ein `B`, das keine Liste ist, beendet das
  Ergebnis); `A -- B` zwei echte Listen, wobei jedes Element von `B` das erste
  exakt gleiche (`=:=`) Element von `A` entfernt, in O((n + m) log m).
- Konvertierungen folgen OTP:
  - `list_to_atom/1` nimmt eine echte Liste von Codepoints (keine Surrogate);
    ein 256. Zeichen ist `system_limit`, bevor es geprüft wird. Eine volle
    Atomtabelle (`--max-atoms`) beendet das Programm als Runtime-Fehler
    (`resource_limit`, Exit-Code 70).
  - `integer_to_list/2` und `list_to_integer/2` nehmen eine kleine Basis in
    2..36; Ziffern werden in Großbuchstaben ausgegeben und in beiden
    Schreibweisen gelesen. `list_to_integer` akzeptiert ein optionales
    Vorzeichen, überspringt führende Nullen, braucht eine Ziffer und löst
    `system_limit` aus bei mehr als 1.262.611 signifikanten Dezimalziffern (oder
    4.194.304 in beliebiger Basis), sobald seine ersten Ziffern gültig sind, und
    bei einem Wert jenseits der Ganzzahlgrenze.
  - `float_to_list/1` ist `"%.20e"`; Optionen von `/2` gelten der Reihe nach,
    das letzte Format gewinnt: `{scientific, D}` (`"%.*e"`, negatives D ist 6),
    `{decimals, D}` (D >= 0; Festkomma mit OTPs eigener Rundung unter 2^53 und
    19 Dezimalstellen, `compact` entfernt nachgestellte Nullen, auch bei einer
    Ganzzahl mit `{decimals, 0}` über 2^53), `short` (kürzeste verlustfreie
    Ziffern in OTPs Wahl zwischen Festkomma und wissenschaftlicher Notation).
    Text von 256 Bytes oder mehr ist `badarg`.
  - `binary_to_list/1` braucht ein Binary; `list_to_binary/1` eine Liste und
    `iolist_to_binary/1` eine Liste oder ein Binary aus Bytes, Binaries und
    verschachtelten Listen, wobei jede Liste auf `[]` oder ein Binary endet.
- `function_exported(M, F, A)` löst `badarg` aus, sofern `M` und `F` nicht Atome
  sind und `A` keine kleine Ganzzahl ist; es ist wahr, wenn ein Modul des
  Programms `M:F/A` exportiert oder `M:F/A` ein registriertes Builtin ist.

## Portionen

Plan 11 step 43A (2026-10-08): Builtins, deren Arbeit mit einem Listen- oder
Binary-Argument wächst, laufen in begrenzten Portionen, wie die trappenden BIFs
von OTP, sodass ein langes Builtin andere Prozesse nicht am Laufen hindern kann
([Prozesse](processes.md)).

- Jedes Brücken-Builtin, das ein Rumpf aufruft, wird wie eine Funktion betreten
  und verbraucht eine Reduktion. Eine Portion darf `WORK_PER_REDUCTION` (16)
  Arbeitseinheiten pro verbleibender Reduktion der Zeitscheibe leisten
  (mindestens den Gegenwert einer Reduktion): durchlaufene oder gebaute
  Listenzellen, Vergleiche, Bytes. Sie bezahlt diese aus der Zeitscheibe.
- Ein Builtin mit verbleibender Arbeit trappt: `ProcessStack::trap` benennt einen
  Fortsetzungs-Frame und legt die Zustandsterme des Builtins in die Register,
  die Wurzeln bleiben; nativer Zustand (Bytes, Sortierpositionen, als Wurzeln
  gehaltene Termwörter) lebt im `TrapState` des Prozess-Stacks. Der Prozess gibt
  ab und setzt in einer späteren Zeitscheibe an der Fortsetzung fort. Speicherbereinigungen
  zwischen Portionen schreiben die Register und Zustandswörter wie andere Wurzeln
  um.
- Ergebnisse, Fehler und Auswertungsreihenfolge sind dieselben wie bei einem
  Durchlauf bis zum Ende. Ein spät gefundener Fehler (ein unechter Rest) wird
  ausgelöst, wenn der Durchlauf ihn erreicht.
- Host-Aufrufe (`call_builtin`) setzen jeden Trap sofort fort.

| Builtin | Portionen |
| --- | --- |
| `length/1` in einem Rumpf | Zählt Zellen; in einem Guard bleibt es der Inline-Dienst, da das Guard-BIF von OTP nicht trappt |
| `A ++ B` | Sammelt die Elemente von `A` und baut dann die Kopie von ihrem Ende her auf `B` auf |
| `A -- B` | Sammelt `B`, sortiert es nach exakter Ordnung (Bottom-up-Mergesort), durchsucht `A` mit einer binären Suche pro Element und baut dann die behaltenen Elemente; wird nichts entfernt, ist das Ergebnis `A` selbst |
| `binary_to_list/1` | Baut die Liste vom Ende des Binary her |
| `list_to_binary/1`, `iolist_to_binary/1` | Durchläuft die Iolist in Tiefensuche und erzeugt dann das Binary auf einmal |

Andere Builtins laufen bis zum Ende. Die Tupel-Builtins (`setelement/3`,
`make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) verhalten sich wie in
OTP: Ihre Arbeit ist durch die Grenze der Tupelstelligkeit beschränkt. Die
übrigen Konvertierungen lesen Eingaben, die durch die Grenzen für Atome,
Ganzzahlen und Gleitkommazahlen beschränkt sind. Formatieren mit
`io:format/1,2` läuft bis zum Ende ([Unterschiede](differences.md)).
Inline-Dienste von Schleifen (das abschließende Umkehren einer Comprehension)
laufen als Teil der Schleife bis zum Ende.

## Typisierte Builtins

Plan 11 step 41 (2026-10-07): Builtins, die ihre eigenen Argumente prüfen, sind
C++-Funktionen mit typisierten Parametern
([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registriert mit
`typed_entry<Function>(module, name)` (die Stelligkeit ist die Parameteranzahl).

- Der Adapter lässt jedes Argumentwort der Reihe nach zu (ein Wort, das diesem
  Prozess nicht gehört, ist der Fehler, der es ist, nie `badarg`) und konvertiert
  dann jedes in seinen Parametertyp; eine Abweichung löst `badarg` aus, und die
  Funktion läuft nicht.
- Parametertypen: `Term` (beliebiger Term, der generische Rückfall),
  `std::int64_t` (eine kleine Ganzzahl), `detail::Integer` (eine beliebige
  Ganzzahl), `double` (eine Gleitkommazahl), `ListArgument` (eine echte Liste und
  ihre Elemente), `TupleArgument`, `BinaryArgument` (Bytes eines Binary),
  `AtomArgument` (seine Schreibweise).
- Ergebnisse: `Term`, `TermResult<Term>` (eine fehlgeschlagene Konstruktion ist
  ein Runtime-Fehler), `BuiltinResult<Term>` (`std::expected` mit einem
  `BuiltinFailure`) oder ein rohes `Word`, das die Funktion selbst veröffentlicht
  hat. Eine Funktion darf auch `BuiltinFailure` werfen (einen Erlang-Fehler wie
  `badarg` oder `system_limit` oder einen Fehler beim Term-Zugriff);
  `call_builtin` macht aus jeder anderen C++-Ausnahme `out_of_memory` oder
  `internal_error`, sodass keine die ABI des generierten Codes überquert.
- Die Familien Term-Zugriff, Konvertierung und io, `binary_part/2` und
  `function_exported/3` sind typisiert. Die anderen `erlang`-Builtins reichen
  ihre Argumentwörter unkonvertiert an die Inline-Dienste weiter, die auch
  generierter Code aufruft und die sie zulassen; sie bleiben `BuiltinBody`-Adapter
  auf Wortebene.

## Registrierung

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  im Besitz des `CodeServer`, bildet exakte Modul/Funktion/Stelligkeit auf einen
  `BuiltinFrame` ab. `add` nimmt einen Batch von `BuiltinEntry`s und registriert
  alle oder keinen: ein leerer Name, mehr als 255 Argumente, eine fehlende
  Implementierung oder ein bereits registrierter (oder im Batch wiederholter)
  Name weist den Batch ab, ohne etwas zu behalten.
- Der Start der Runtime registriert jede Tabelle von `production_builtins()`
  (`erlang_builtins()`, `term_access_builtins()`, `conversion_builtins()`,
  `io_builtins()`), deren Einträge größtenteils mit `typed_entry` erstellt sind
  und die zusammen den
  Katalog abdecken; spätere Familien fügen eigene Tabellen hinzu.
- Ein Rumpf liest genau so viele Argumentwörter wie seine Stelligkeit und
  vermerkt Fehler im geprüften Kanal; Host-Ausnahmen werden zu Fehlern
  `out_of_memory` oder `internal_error`.
- Der ältere Host-Pfad `abi::v1::dispatch_builtin` (vom Host registrierte native
  Module nach Namen, [Runtime](runtime.md#code-server-and-builtins)) ist getrennt
  und unverändert.
