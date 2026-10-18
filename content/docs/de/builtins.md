---
source: docs/builtins.md
sourceCommit: 336caea7
sourceSha256: c5d99568a38fc1f7bc865c63163039a8c2acba8d978636c0b9290afdf0b9a637
translatedAt: 2026-10-18
---
# Builtins

Builtins sind Funktionen, die die Runtime in C++ implementiert: die
`erlang`-BIFs und die Funktionen anderer Module, deren OTP-Gegenstücke BIFs
oder NIFs sind oder die Runtime brauchen (`io`-Ausgabe, Datenfunktionen von
`lists`, `math`, `binary`, ...). Die Runtime registriert sie nach Modul,
Funktion und Stelligkeit; erzeugter Code erreicht sie direkt, über dynamische
Aufrufe und als Fun-Werte.

## Welche Builtins es gibt

Der Brückenkatalog `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) führt jedes Builtin
auf, das sowohl der Compiler als auch die Runtime kennen, in Gruppen, deren
Kommentare die implementierende Quelldatei nennen:

- Modul `erlang`: die Guard-BIFs, die Operatoren als Funktionen
  (`erlang:'+'/2`, `'++'/2`, `'--'/2`, ...), `display/1`, `halt/0,1`, die
  auslösenden Funktionen, Termzugriff, Konvertierungen, Prozessidentitäten,
  [Prozesse](processes.md) (Erzeugen, Nachrichten, Links, Monitore,
  registrierte Namen, das Prozess-Dictionary, Timer, Introspektion,
  Spawn-Optionen, Aliase, Knoten), [Ports](ports.md#builtins-and-port-messages),
  das [externe Termformat](#external-term-format), [Zeit](#time),
  [Systeminformationen](#system-information),
  [Fun-Informationen](funs.md#fun-information), [Hashing](#hashing) und
  [Laden von Code](#code-loading);
- andere Module: `io`-Ausgabe ([io](io.md)), die Datenfunktionen von
  [`lists`](#lists-module), [`math`](#math-module),
  [`binary`](#binary-module), [`maps` und `os`](#maps-module),
  [`ordsets`, `orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`,
  `queue` und `array`](#collections), [`base64` und `json`](#encodings),
  [`calendar`](#calendar), [`filename`](#filename), [`uri_string`](#uri-string), [`string`](#string),
  [`rand` und `random`](#random-numbers),
  [`persistent_term`](#persistent-terms), [`unicode`](#unicode-module),
  [`code`](#code-module), [`init`](#init-module),
  [`atomics`](#atomics-and-counters), [`erts_internal`](#erts-internal),
  [`unicode_util`](#unicode-util) und [`re`](#re-module);
- private Module unter Erlang-Bibliothekscode: `clause_unicode`, `clause_re`,
  `clause_zlib` ([zlib](#zlib-module)) und `clause_receive`
  ([prim eval](#prim-eval)).

Welche Funktion eines Bibliotheksmoduls ein Builtin, ein Erlang-Rumpf oder ein
Stub ist, steht in seinem Inventar `library/<application>/<module>.terms`
([Bibliothek](library.md#files)); das von `erlang` ist
[erlang.terms](#erlang-module).

Der Index eines Eintrags ist die Nummer, die erzeugter Code an den
Brückendienst übergibt; Compiler und Runtime werden zusammen gebaut, daher darf
der Katalog umgeordnet werden. Ein qualifizierter Aufruf eines Katalog-Builtins
eines beliebigen Moduls (`io:format(F, A)`) ruft die Brücke auf. Jede andere
`erlang`-Funktion erreicht das [Bibliotheksmodul erlang](#erlang-module).

## Wie Aufrufe sie erreichen

| Quelle | Weg |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Inline-Code oder ein eigener Runtime-Dienst |
| `erlang:function_exported(M, F, A)`, `A -- B` in einem Rumpf (Katalog-Builtins ohne Inline-Dienst) | Wie eine Funktion betreten: `CLAUSE_builtin_frame_v1(context, index)` liefert den Frame des Builtins, die Argumente kommen in die Register ([Portionen](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (direkte Builtins: kein Trap, kein Warten, keine Wirkung auf einen anderen Prozess) | Sofort aufgerufen: `CLAUSE_builtin_call_v1(context, index, arguments)` liefert das Ergebnis ([ABI](abi.md#runtime-services)) |
| `length(L)`, `binary_to_list(B)`, `list_to_binary(L)`, `iolist_to_binary(L)` (schnelle Builtins) | `CLAUSE_builtin_call_v1` führt einen begrenzten Schnellpfad auf den Argumentwörtern aus (höchstens 256 Zellen, Elemente oder Bytes, 4096 Ergebnisbytes); bei längeren Eingaben, anderen Formen und Fehlern gibt er 0 zurück, und der Aufruf betritt dann den Frame des Builtins |
| `A ++ B` | Ein kurzes echtes `A` wird inline kopiert; andernfalls wie eine Funktion betreten ([ABI](abi.md#frames-and-transfers)) |
| `fun abs/1`, `fun erlang:'+'/2` | Externer Fun `erlang:F/A`; die Registrierung bindet ihn an das Builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` zur Laufzeit | Der Code-Server sucht zuerst einen Export des Moduls, dann ein Builtin |

- `fun F/A` eines automatisch importierten Builtins, das das Modul weder
  definiert noch unterdrückt (`-compile({no_auto_import, ...})`), ist der
  externe Fun `erlang:F/A`, wie in OTP: `fun abs/1 =:= fun erlang:abs/1`, und er
  wird als `fun erlang:abs/1` ausgegeben. Die automatischen Importe sind die von
  OTP (Flag `auto_import` in [erlang.terms](#erlang-module)); andere, etwa
  `display/1`, `raise/3`, `function_exported/3`, `make_tuple/2,3`,
  `port_info/1,2`, `port_call/2,3` und `ports/0`, brauchen das Präfix
  `erlang:`.
- Ein Builtin hat einen `FrameDescriptor` mit leerem Rumpf (`BuiltinFrame`).
  Sein Betreten (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) legt keinen Frame an: Das
  Builtin läuft auf den Registern, und sein Ergebnis kehrt in den Rumpf des
  Aufrufers zurück, sodass ein Builtin in Endposition zum Aufrufer des
  Aufrufers zurückkehrt.
- Fehler sind dieselben, die das Inline-Lowering in einem Rumpf auslöst:
  `badarg`, `badarith` für Arithmetik, `system_limit`, `{badmap, M}`,
  `{badkey, K}`; `raise/3` mit ungültiger Klasse oder ungültigem Stack gibt
  `badarg` zurück. Sie laufen wie jeder Dienstfehler über den geprüften
  Fehlerkanal.
- Termzugriff folgt den `badarg`-Regeln von OTP: `setelement/3` braucht einen
  kleinen ganzzahligen Index innerhalb des Tupels; `make_tuple/2,3` eine kleine
  Größe in 0..16.777.215, und `make_tuple/3` eine echte Liste von Paaren
  `{Index, Value}` innerhalb der Größe (spätere Paare gewinnen);
  `list_to_tuple/1` eine echte Liste; `A ++ B` eine echte Liste `A`
  (`[] ++ B` ist `B` für jedes `B`, ein `B`, das keine Liste ist, beendet das
  Ergebnis); `A -- B` zwei echte Listen, wobei jedes Element von `B` das erste
  exakt gleiche (`=:=`) Element von `A` entfernt, in O((n + m) log m).
- Konvertierungen folgen OTP:
  - `list_to_atom/1` nimmt eine echte Liste von Codepunkten (keine Surrogate);
    ein 256. Zeichen ist `system_limit`, bevor es geprüft wird. Eine volle
    Atomtabelle (`--max-atoms`) stoppt das Programm als Runtime-Fehlschlag
    (`resource_limit`, Exit 70).
  - `integer_to_list/2` und `list_to_integer/2` nehmen eine kleine Basis in
    2..36; Ziffern werden in Großbuchstaben ausgegeben und in beiden
    Schreibweisen geparst. `list_to_integer` akzeptiert ein optionales
    Vorzeichen, überspringt führende Nullen, braucht eine Ziffer und löst
    `system_limit` aus bei mehr als 1.262.611 signifikanten Dezimalziffern
    (oder 4.194.304 in beliebiger Basis), sobald die ersten Ziffern gültig
    sind, sowie bei einem Wert jenseits der Ganzzahlgrenze.
  - `float_to_list/1` ist `"%.20e"`; Optionen von `/2` gelten der Reihe nach,
    das letzte Format gewinnt: `{scientific, D}` (`"%.*e"`, negatives D ist 6),
    `{decimals, D}` (D >= 0; Festkomma mit der eigenen Rundung von OTP unter
    2^53 und 19 Dezimalstellen, `compact` entfernt nachgestellte Nullen, auch
    bei einer Ganzzahl mit `{decimals, 0}` über 2^53), `short` (kürzeste
    Round-Trip-Ziffern in der Festkomma-/Exponentialwahl von OTP). Text von 256
    Bytes oder mehr ist `badarg`.
  - `binary_to_list/1` braucht ein Binary; `list_to_binary/1` eine Liste und
    `iolist_to_binary/1` eine Liste oder ein Binary aus Bytes, Binaries und
    verschachtelten Listen, wobei jede Liste auf `[]` oder ein Binary endet.
  - Die Binary-Zwillinge (`atom_to_binary/1,2`, `binary_to_integer/1,2`,
    `float_to_binary/1,2`, `list_to_float/1`, ...) teilen diese Textregeln
    (`erlang/conversion_text.cpp`): Gleitkommatext braucht Ziffern auf beiden
    Seiten des Punkts (`list_to_float("1e10")` ist `badarg`), ein Exponent
    jenseits des Bereichs ist `badarg` und ein Unterlauf `0.0`; Kodierungen
    sind `utf8`, `unicode` und `latin1`.
- `function_exported(M, F, A)` löst `badarg` aus, es sei denn, `M` und `F`
  sind Atome und `A` ist eine kleine Ganzzahl; es ist true, wenn ein Modul des
  Programms `M:F/A` exportiert oder `M:F/A` ein registriertes Builtin ist.

## Portionen

Builtins, deren Arbeit mit einem Listen- oder Binary-Argument wächst, laufen in
begrenzten Portionen, wie die trappenden BIFs von OTP, sodass ein langes Builtin
andere Prozesse nicht am Laufen hindern kann ([Prozesse](processes.md)).

- Jedes Brücken-Builtin, das ein Rumpf aufruft, wird wie eine Funktion
  betreten und verbraucht eine Reduktion. Eine Portion darf
  `WORK_PER_REDUCTION` (16) Arbeitseinheiten pro in der Zeitscheibe
  verbleibender Reduktion leisten (mindestens eine Reduktion lang):
  durchlaufene oder aufgebaute Listenzellen, Vergleiche, Bytes. Sie bezahlt
  dafür aus der Zeitscheibe.
- Ein Builtin mit verbleibender Arbeit trappt: `ProcessStack::trap` nennt einen
  Fortsetzungs-Frame und legt die Zustandsterme des Builtins in die Register,
  die Wurzeln bleiben; nativer Zustand (Bytes, Sortierpositionen, als Wurzeln
  gehaltene Termwörter) liegt im `TrapState` des Prozess-Stacks. Der Prozess
  gibt ab und setzt in einer späteren Zeitscheibe an der Fortsetzung fort.
  Speicherbereinigungen zwischen Portionen schreiben die Register und
  Zustandswörter wie andere Wurzeln um.
- Ein Builtin kann auch in einem Erlang-Export fortfahren: `io`-Ausgabe an ein
  Prozessgerät trappt in `file:write/2` ([io](io.md#calls)).
- Ergebnisse, Fehler und Auswertungsreihenfolge sind dieselben wie bei einem
  Lauf bis zum Ende. Ein spät gefundener Fehler (ein unechtes Listenende) wird
  ausgelöst, wenn der Durchlauf ihn erreicht.
- Host-Aufrufe (`call_builtin`) setzen jeden Trap sofort fort.
- Listendurchläufe validieren die Liste einmal und lesen ihre Zellen als
  Wörter. Kleine Eingaben nehmen schnelle Pfade auf Wortebene ohne
  Portionszustand: `Left ++ Right` mit höchstens 64 Zellen in `Left`,
  `integer_to_list/1` einer kleinen Ganzzahl, `list_to_integer/1` eines kurzen
  Dezimalstrings, `atom_to_list/1`, `list_to_tuple/1` und `tuple_to_list/1`.

| Builtin | Portionen |
| --- | --- |
| `length/1` in einem Rumpf | Zählt Zellen; in einem Guard bleibt es der Inline-Dienst, da der Guard-BIF von OTP nicht trappt |
| `A ++ B` | Sammelt die Elemente von `A` und baut dann die Kopie von ihrem Ende her auf `B` auf |
| `A -- B` | Sammelt `B`, sortiert es nach exakter Ordnung (Bottom-up-Mergesort), durchsucht `A` mit einer binären Suche pro Element und baut dann die behaltenen Elemente auf; wird nichts entfernt, ist das Ergebnis `A` selbst |
| `binary_to_list/1` | Baut die Liste vom Ende des Binary her auf |
| `list_to_binary/1`, `iolist_to_binary/1` | Durchläuft die Iolist in Tiefensuche und erzeugt dann das Binary in einem Schritt |

Andere Builtins laufen bis zum Ende. Die Tupel-Builtins (`setelement/3`,
`make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) verhalten sich wie in
OTP: Ihre Arbeit ist durch die Grenze der Tupelstelligkeit beschränkt. Die
übrigen Konvertierungen lesen Eingaben, die durch die Grenzen für Atome,
Ganzzahlen und Gleitkommazahlen beschränkt sind. Formatieren mit
`io:format/1,2` läuft bis zum Ende ([Unterschiede](differences.md)).
Inline-Dienste von Schleifen (das abschließende Umkehren einer Comprehension)
laufen als Teil der Schleife bis zum Ende.

## Typisierte Builtins

Builtins, die ihre eigenen Argumente prüfen, sind C++-Funktionen mit
typisierten Parametern ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, registriert mit
`typed_entry<Function>(module, name)` (die Stelligkeit ist die
Parameteranzahl).

- Der Adapter lässt jedes Argumentwort der Reihe nach zu (ein Wort, das dieser
  Prozess nicht besitzt, ist der Fehlschlag, der es ist, nie `badarg`) und
  konvertiert dann jedes in seinen Parametertyp (`Term`, eine kleine oder
  beliebige Ganzzahl, `double`, Listen-, Tupel-, Binary-, Atom-, Map- oder
  lokale Pid-Argumente; siehe `typed.hpp`); eine Abweichung löst `badarg` aus,
  und die Funktion läuft nicht. `Named<Role>` ist ein beliebiger Term
  unter einem eigenen Rollentyp (`collections::Key`, `Value`, `List`, ...),
  sodass bei einem Builtin mit mehreren Termparametern keine zwei vertauscht
  werden können; das Builtin prüft den Term.
- Eine Funktion gibt einen Term, ein `BuiltinResult` (`std::expected` mit
  einem `BuiltinFailure`) oder ein selbst veröffentlichtes rohes `Word` zurück
  oder wirft `BuiltinFailure` (ein Erlang-Fehler oder ein Fehlschlag beim
  Termzugriff); `call_builtin` macht aus jeder anderen C++-Ausnahme
  `out_of_memory` oder `internal_error`, sodass keine die ABI des erzeugten
  Codes überquert.
- Die meisten Familien sind typisiert. Die Guard-BIFs und Operatoren
  (`erlang/core.cpp`), die trappenden Listen-Builtins und einige andere sind
  `BuiltinBody`-Adapter auf Wortebene, die ihre Argumentwörter an die
  Inline-Dienste weitergeben, die auch erzeugter Code aufruft. Häufige
  Umwandlungen lesen die Zellen ihrer Argumente an Ort und Stelle
  (`TermAccess::trusted`), statt `Term`s zuzulassen: `tuple_to_list/1`,
  `phash2/1` (Listen, Tupel und kleine Ganzzahlen) sowie `list_to_atom/1`,
  `list_to_integer/1` kurzer ASCII-Strings und `binary:part/2,3`, ein direktes
  Builtin, dessen kurzes Ergebnis unmittelbar in Heap-Wörter geschrieben wird
  (Builtin-Argumente auf Wortebene).

## Registrierung

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  im Besitz des `CodeServer`, bildet exakt Modul/Funktion/Stelligkeit auf einen
  `BuiltinFrame` ab. `add` nimmt einen Batch von `BuiltinEntry`s und
  registriert alle oder keinen: ein leerer Name, mehr als 255 Argumente, eine
  fehlende Implementierung oder ein bereits registrierter (oder im Batch
  wiederholter) Name weist den Batch ab, ohne etwas zu behalten.
- Der Start der Runtime registriert jede Familientabelle von
  `production_builtins()` (`builtins/registry.cpp`), die zusammen den Katalog
  abdecken.
- Builtins sind haftend: Registriert sich ein Modul, überspringt der
  Code-Server jeden Export, der den Namen eines registrierten Builtins trägt,
  sodass `M:F(Args)`, `apply/3` und externe Funs das Builtin binden, nie einen
  `clause_builtin_placeholder`-Rumpf eines Bibliotheksmoduls
  ([Platzhalter](library.md#provided-or-missing)) oder eine gleichnamige Benutzerfunktion.
- Ein Rumpf liest genau so viele Argumentwörter, wie seine Stelligkeit angibt,
  und hält Fehler im geprüften Kanal fest; Host-Ausnahmen werden zu
  Fehlschlägen `out_of_memory` oder `internal_error`.
- Der Host-Pfad `abi::v1::dispatch_builtin` (vom Host registrierte native
  Module nach Namen, [Runtime](runtime.md#code-server-and-builtins)) ist davon
  getrennt.

## Aufbau der Quelltexte

- Die Runtime implementiert Builtins in `runtime/src/builtins/`. Ein großes
  Modul erhält ein eigenes Unterverzeichnis mit einer Übersetzungseinheit pro
  Builtin-Familie (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`,
  `zlib/`); kleine Module und die Brücken-Infrastruktur (`registry`, `bridge`,
  `portions`, `typed`, Text- und Gleitkommaformatierung) sind einzelne
  Dateien.
- Jede Familiendatei definiert ihre eigene Tabelle `*_builtins()`, die in
  `production_builtins()` aufgeführt ist. Eine neue Familie fügt eine neue
  Datei und Tabelle hinzu, statt eine bestehende zu vergrößern; eine Datei über
  etwa 400 Zeilen wird nach Familien aufgeteilt, bevor sie weiter wächst.
- Der Compiler liest nie Quelltexte der Runtime: Der Katalog
  `abi::v1::bridge_builtins` ist die einzige Liste, die beide Seiten teilen;
  seine Gruppenkommentare nennen die implementierende Datei.

## Modul erlang

Der Compiler weiß aus zwei eigenen Quellen, welche `erlang`-Funktionen
existieren, nie aus Runtime-Code:

- `library/erts/erlang.terms`: die `erlang`-Exporte von OTP 29 als
  `{Name, Arity, Flags, Status}` (Flags `auto_import`, `guard`; Status
  `implemented` oder `{unavailable, Reason}`: `distribution`, `tracing`,
  `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` beobachtet das OTP des Hosts
  und behält die Status bei, die von Hand gepflegt werden.
- `tests/compiler/builtins/generate_erlang.py` macht daraus
  `library/erts/erlang.erl` (das eigene Stub-Modul von Clause, ein
  Platzhalterrumpf pro Katalog-Builtin) und
  `compiler/src/semantic/erlang_auto_imports.inc` (die Liste automatischer
  Importe von OTP). CTest `builtins_erlang_inventory` prüft, dass beide aktuell
  sind und dass `implemented` ein Katalog-Builtin, eine vom Compiler behandelte
  Funktion (`apply/2,3`, `is_record/1,2,3`) oder einen echten Erlang-Rumpf
  bedeutet (`nif_error/1,2` lösen `error(Reason)` aus wie die Stubs von OTP);
  `builtins_erlang_freshness` (Label `host_otp`) vergleicht das Inventar mit
  dem OTP des Hosts.

Aufrufe:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` und
  `-import(erlang, ...)` eines Builtins gehen an das Builtin. Jeder andere
  Export kommt als Bibliotheksmodul `erlang` ins Programm; seine Stubs lösen
  `error({not_implemented, F, A})` mit `erlang:F/A` oben auf dem Stack aus, nur
  wenn sie aufgerufen werden. Ein Name, den das Modul nicht exportiert, ist
  `undefined function erlang:F/A`.
- Ein unqualifizierter Aufruf oder `fun F/A` eines automatischen Imports von OTP
  (`get(K)`, `fun put/2`), den das Modul weder definiert, importiert noch mit
  `-compile({no_auto_import, ...})` unterdrückt, erreicht `erlang:F/A` auf
  dieselbe Weise.

## Externes Termformat

`erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Beide Richtungen teilen
den Codec von [external_term.hpp](../abi/include/clause/abi/external_term.hpp)
mit dem Compiler und durchlaufen Terme mit expliziten Stacks, sodass die
Verschachtelungstiefe keinen nativen Stack kostet. Der Encoder liest die Zellen
seines validierten Arguments an Ort und Stelle (`TermAccess::trusted`, keine
Adressprüfung pro Zelle); der Decoder sammelt Kinder auf einem gemeinsamen
Stack und schreibt Tupel, Listen und Strings direkt in Heap-Wörter, die er
einmal pro Container beansprucht (`TermAccess::claim`).

- `term_to_binary/1,2` schreibt die Bytes von OTP für einen nicht verteilten
  Knoten (`nonode@nohost`, Creation 0): UTF-8-Atome, `NEW_FLOAT`,
  `STRING_EXT` für Byte-Listen bis 65535 Elemente, Maps in
  Schlüsselreihenfolge, Pids, Ports und Referenzen in ihren Formen `NEW_PID`,
  `V4_PORT` und `NEWER_REFERENCE` sowie `EXPORT_EXT` für `fun M:F/A`; ein
  lokaler Fun oder ein nativer Record ist `error:notsup`. Optionen:
  `{minor_version, 0..2}` (0 schreibt Gleitkommatext, 0 und 1 Latin-1-Atome),
  `deterministic`, `compressed` und `{compressed, 0..9}` ([zlib](#zlib-module));
  alles andere ist `badarg`.
- `term_to_iovec/1,2` gibt die Kodierung als Liste mit einem Binary zurück;
  `external_size/1,2` ihre exakte Größe.
- `binary_to_term/1,2` prüft jede Länge gegen die Eingabe, bevor es
  allokiert, ignoriert Bytes nach dem Term, entpackt komprimierte Eingaben und
  gibt `badarg` zurück für fehlerhafte Eingaben, ungültigen Atomtext, nicht
  endliche Gleitkommazahlen, wiederholte Map-Schlüssel und Identitäten eines
  anderen Knotens; `safe` lässt nur existierende Atome zu, `used` gibt
  `{Term, BytesRead}` zurück. CTests: `executables_external_terms` (Bytes von
  OTP) und `builtins_etf_fuzz` (mutierte Kodierungen werden dekodiert oder
  lösen aus).

## Zeit

`erlang/time.cpp`. Monotone Zeit ist die Steady Clock; `native` und
`perf_counter` sind Nanosekunden; Einheiten sind die Atome von OTP
(einschließlich der veralteten Pluralformen) oder eine positive ganze Zahl von
Teilen pro Sekunde. `convert_time_unit/3` rundet ab, wie OTP.
`unique_integer/0,1` zieht aus einem programmweiten Zähler, sodass jeder Wert
positiv, eindeutig und steigend ist, unabhängig von den Optionen (`positive`,
`monotonic`; andere `badarg`). `now/0` ist Systemzeit, die streng steigend
gemacht wird. Kalenderkonvertierungen lesen `{{Y, M, D}, {H, Mi, S}}` streng
(ein ungültiges Datum oder eine ungültige Uhrzeit ist `badarg`) und verwenden
die lokale Zeitzone der C-Bibliothek. Timer:
[Prozesse](processes.md#timers).

## Systeminformationen

`erlang/system.cpp`.

- `statistics/1`: `wall_clock` und `runtime` (`{Total, SinceLastCall}` in
  Millisekunden), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (ausgeführte Zeitscheiben). Clause
  führt keine Zähler für Reduktionen, Speicherbereinigung oder I/O:
  `reductions`, `exact_reductions`, `garbage_collection` und `io` melden
  Nullen.
- `system_info/1`: die Release- und Build-Einträge (`otp_release` `"29"`,
  `version` `"17.1"`, das ERTS, dem Clause folgt, `machine` `"Clause"`,
  `system_version`, `system_architecture`, `wordsize`, `endian`, ...),
  Anzahlen und Grenzen von Prozessen, Ports und Atomen, Anzahlen von
  Schedulern und Prozessoren sowie die festen Antworten des Emulators
  (`smp_support`, `threads`, `time_warp_mode`, ...); die vollständige Liste
  steht in `system.cpp`.
- `memory/0,1`: die Typen von OTP; `processes` ist die runtimeweite Bilanz des
  Prozessspeichers, `atom` eine Schätzung aus der Atomanzahl, `binary`, `code`
  und `ets` sind 0.
- Andere Einträge sind `badarg`.

## Hashing

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` ist `make_hash2` von OTP und `phash/2` dessen `make_hash`,
  mit Listenzellen und Tupelzellen direkt durchlaufen: Atome (nach dem
  OTP-Hash ihrer Schreibweise), Ganzzahlen, Gleitkommazahlen, Binaries und
  Bitstrings, Listen, Tupel und Maps (reihenfolgeunabhängig) ergeben die
  Hash-Werte von OTP, sodass `dict` und `sets` der Version 1 ihre Buckets
  wie OTP anordnen. Pids, Ports und Referenzen hashen nach den Nummern von
  Clause, funs nach Modul, Stelligkeit oder Index und eingefangenen Werten,
  native records nach Feldwerten ([Unterschiede](differences.md)).
  `phash2/1` liegt in 0..2^27-1, `phash2/2` in 0..Range-1, `phash/2` in
  1..Range; Range ist 1..2^32, sonst `badarg`.
- `md5/1` sowie `md5_init/0`, `md5_update/2`, `md5_final/1` liefern die
  Digests nach RFC 1321 (die Bytes von OTP) von iodata. Der Kontext ist ein
  opakes 96-Byte-Binary mit dem eigenen Layout von Clause; ein anderes Binary
  ist `badarg`.

## Laden von Code

`erlang/code.cpp`. Jedes Modul wird in das Programm gelinkt und bleibt geladen;
dynamischer Code ist zurückgestellt.
`module_loaded/1` ist true für ein kompiliertes Modul oder ein Modul mit
Runtime-Builtins (`erlang`, `io`, `os`, ...); `loaded/0` und `pre_loaded/0`
listen sie alle auf. `delete_module/1` gibt für ein unbekanntes Modul
`undefined` zurück und löst für ein geladenes `error:notsup` aus.
`prepare_loading/2` gibt `{error, badfile}` zurück (kein Binary ist Code, den
das Programm laden kann), und `finish_loading/1` akzeptiert nur `[]`.
`get_module_info(M[, Item])` fährt als `M:module_info(...)` fort.

## Modul lists

`runtime/src/builtins/lists/`. Das `lists` von OTP ist Erlang-Code (abgesehen
von einigen BIFs), daher lösen die Builtins von Clause aus, was die Klauseln
von OTP auslösen:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `flatlength/1`, `delete/2`, `concat/1`, `max/1`,
  `min/1`, `usort/1`, `umerge/1,2`, `merge/1,2`, `merge3/3`, `umerge3/3`,
  `keymerge/3`, `ukeymerge/3`, `ukeysort/2`, `keydelete/3`, `keyreplace/4`,
  `keystore/4`, `keytake/3`, `zip/2,3`, `zip3/3,4`, `unzip/1`, `unzip3/1` und
  `enumerate/1,2,3` lösen `function_clause` für ein Argument aus, das keine
  Klausel von OTP akzeptiert, und durchlaufen Listen so verzögert wie OTP:
  `sublist([a | b], 1)` ist `[a]`, `nthtail(1, [a | b])` ist `b`,
  `flatten/2` prüft sein Ende nicht über `is_list` hinaus; eine
  Zusammenführung gibt die andere Liste unverändert zurück, wenn eine `[]`
  ist, und löst bei einem angehängten unechten Rest `badarg` aus; eine
  Schlüsselzusammenführung löst wie `element/2` bei einem Element, das kein
  Tupel der Schlüsselgröße ist, `badarg` aus.
- `zipwith/3,4` und `zipwith3/4,5` sind Erlang über den `zip`-Builtins, die
  zuerst die Elemente paaren; `flatmap/2`, `keymap/3`, `search/2`,
  `umerge/3` und `usort/2` sind ebenfalls Erlang. Innerhalb von `lists.erl`
  wird ein Builtin qualifiziert aufgerufen (`lists:zip(...)`): Ein lokaler
  Aufruf würde seinen Platzhalter erreichen. Die undokumentierten
  `rmerge/2,3`, `rmerge3/3`, `rumerge/2,3`, `rumerge3/3`, `rkeymerge/3`
  und `rukeymerge/3` (Sortierhilfen von OTP) bleiben Stubs.
- `keymember/3` und `keysearch/3` sind in OTP BIFs: `badarg` für eine Position,
  die keine positive kleine Ganzzahl ist, oder für ein unechtes Listenende, das
  vor einem Treffer erreicht wird.
- Schlüssel und Reihenfolge vergleichen mit `==` und der Termordnung; von
  gleich vergleichenden Elementen gewinnt das erste (`max([1, 1.0])` ist `1`,
  `usort([1.0, 1])` ist `[1.0]`, `umerge/1,2` behalten das Element der
  früheren Liste).
- Sie laufen bis zum Ende. Funktionen, die Funs nehmen (`foreach/2`,
  `mapfoldl/3`, `splitwith/2`, `filtermap/2`, `uniq/2`, ...), sind Erlang in
  `library/stdlib/lists.erl`, weil ein Builtin keinen Fun aufrufen und sein
  Ergebnis zurückerhalten kann; ebenso die übrigen implementierten Funktionen,
  mit den Klauseln und Guards von OTP.
- Ein `function_clause` aus einem Builtin hat keinen eigenen Frame
  ([Unterschiede](differences.md)).

## Modul math

`runtime/src/builtins/math.cpp`. Jede `math`-Funktion von OTP 29 ist ein
Builtin über der C-Bibliothek (`pi/0` und `tau/0` sind Konstanten). Argumente
sind Zahlen, die in Gleitkommazahlen konvertiert werden: alles andere ist
`badarg`, eine für eine Gleitkommazahl zu große Ganzzahl `badarith`. Ein
Ergebnis, das keine endliche Gleitkommazahl ist (ein Definitionsbereichsfehler
wie `sqrt(-1)`, `log(0)`, `acos(2)` oder ein Überlauf wie `pow(10, 400)`,
`exp(1000)`), ist `badarith`. `floor/1` und `ceil/1` geben Gleitkommazahlen
zurück. Die Ergebnisse sind die der C-Bibliothek des Hosts und können im
letzten Bit von denen von OTP abweichen ([Unterschiede](differences.md)). Auf
64-Bit-Zielen berechnet erzeugter Code `sqrt`, `floor`, `ceil`
(LLVM-Intrinsics) sowie `exp`, `log`, `log2`, `log10`, `sin`, `cos`, `pow`
(dieselben Funktionen der C-Bibliothek, ohne die Ersetzungen von LLVM
aufgerufen) von Zahlargumenten inline in eine Gleitkommazelle; andere Operanden
und nicht endliche Ergebnisse rufen das Builtin auf, das auslöst.

## Modul binary

`runtime/src/builtins/binary/`. `replace/3,4` (einschließlich eines Funs als
Ersetzung und `{insert_replaced, ...}`) und `list_to_bin/1` sind Erlang in
`library/stdlib/binary.erl` über den Builtins; jede andere Funktion ist ein
Builtin:

- Muster sind ein nicht leeres Binary, eine nicht leere Liste nicht leerer
  Binaries oder ein kompiliertes Muster. Ein Treffer ist die am weitesten links
  liegende Position und dort das längste Muster; `matches/2,3` und
  `split/2,3` mit `global` nehmen nicht überlappende Treffer von links.
  `{scope, {Start, Length}}` begrenzt, wo Treffer beginnen und enden dürfen
  (eine negative Länge zählt rückwärts); `split/3` nimmt außerdem `global`,
  `trim` und `trim_all`.
- `compile_pattern/1` gibt `{bm, [Pattern]}` oder `{ac, Patterns}` zurück, die
  eigene Form von Clause (OTP: eine Referenz im Tupel,
  [Unterschiede](differences.md)).
- `part/2,3`, `bin_to_list/1,2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` und
  `decode_hex/1` folgen OTP; jedes falsche Argument (ein Bitstring, ein Bereich
  außerhalb des Subjekts, eine unbekannte Option) ist `badarg`.
- `referenced_byte_size/1` ist die eigene Größe des Binary.
- Sie laufen bis zum Ende.

## Modul maps

`runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- Jede dokumentierte `maps`-Funktion funktioniert. `maps:get/3`, `is_key/2`,
  `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`,
  `without/2`, `from_keys/2`, `intersect/2` und `is_iterator_valid/1` sind
  Builtins mit den Fehlern von OTP: Etwas, das keine Map ist, ergibt
  `{badmap, Map}`, ein fehlender Schlüssel bei `update/3` `{badkey, Key}`,
  eine Schlüsselliste, die keine echte Liste ist, `badarg`. Schlüssel matchen
  exakt (`1` und `1.0` sind verschiedene Schlüssel).
- Die Funktionen mit funs sind Erlang in `library/stdlib/maps.erl`:
  `filter/2`, `filtermap/2`, `map/2`, `fold/3` und `foreach/2` nehmen eine
  Map oder einen Iterator entgegen (alles andere ergibt `{badmap, MapOrIter}`),
  `intersect_with/3` kombiniert über `intersect/2` und `merge_with/3` über
  `merge/2`. `groups_from_list/2,3` rufen die funs wie OTP mit dem letzten
  Element zuerst auf, und das private Builtin `clause_maps:groups/1`
  gruppiert die `{Key, Value}`-Paare. Iteratoren (`iterator/1,2`, `next/1`)
  verwenden [`erts_internal:map_next/3`](#erts-internal).
- Map-Cursor (`runtime/src/terms/map_cursor.hpp`) durchlaufen eine flache
  Map-Zelle und einen Map-Baum gleichermaßen, als Wörter in
  Schlüsselreihenfolge, ohne `Term` pro Eintrag. Das private Builtin
  `clause_maps:entries/1` gibt damit `{K1, V1, K2, V2, ...}` zurück, sodass
  `maps:fold/3` die Assoziationen an Ort und Stelle mit `element/2` liest,
  statt eine Liste von Paaren aufzubauen; auch `map_next/3` schreitet mit einem
  Cursor voran.
- `os:type/0`, `os:getenv/0,1` (`getenv/0`: Strings `"Name=Value"`; die
  laufwerksbezogenen Einträge `=C:` von Windows werden weggelassen),
  `os:env/0` (Paare `{Name, Value}`), `os:putenv/2`, `os:unsetenv/1`
  (`badarg`, es sei denn, die Argumente sind Strings und der Name ist nicht
  leer und ohne `=`), `os:getpid/0` und `os:version/0` sind Builtins;
  `os:timestamp/0`, `os:system_time/0,1`, `os:perf_counter/0,1` und
  `os:getenv/2` sind Erlang über den Zeit-Builtins von `erlang` und
  `getenv/1`; `os:cmd/1` läuft über einen Port
  ([Unterprozesse](ports.md#subprocesses)).

## Sammlungen

`runtime/src/builtins/collections/`: `ordsets`,
`orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue` und
`array`, jede dokumentierte Funktion.

- Die Listendurchläufe sind Builtins: Zugehörigkeit, Einfügen, Löschen und
  Mengenalgebra von `ordsets` (`union/2`, `intersection/1,2`,
  `subtract/2`, `is_subset/2`, `is_disjoint/2`, `is_set/1`); Abfragen und
  Aktualisierungen von `orddict` ohne funs (`store/3`, `append/3`,
  `append_list/3`, `update_counter/3`, `take/2`, `from_list/1`, ...); alle
  `proplists`-Funktionen außer `property/1,2`, `get_value/2`, `normalize/2`,
  `to_map/2` und `from_map/1`, die Erlang-Verbindungscode in
  `library/stdlib/` sind.
- Die Funktionen mit funs (`ordsets:fold/3`, `filter/2`, `map/2`,
  `filtermap/2`, `orddict:update/3,4`, `fold/3`, `map/2`, `filter/2`,
  `merge/3`) sind Erlang.
- Jedes Builtin durchläuft seine Listen wie die Klauseln von OTP, sodass
  Ergebnisse und Fehler für jede Eingabe übereinstimmen: Elemente und
  Schlüssel werden mit `<` und `==` verglichen (von `1` und `1.0` bleibt
  der von OTP gewählte Repräsentant erhalten, auch nachdem `union/2` seine
  Mengen vertauscht); ein von OTP ungeprüft zurückgegebener Rest
  (`ordsets:union([], X)` ist `X`) wird unverändert zurückgegeben; eine
  von keiner Klausel akzeptierte Form ergibt `function_clause`, eine
  Nicht-Listen-Eingabe einer comprehension `{bad_generator, Rest}`,
  `Old ++ New` mit unechtem `Old` `badarg` und `update_counter/3` mit
  einer Nicht-Zahl `badarith`. `proplists`-Schlüssel matchen mit `=:=`.
- `proplists:get_keys/1` listet die Schlüssel in der Schlüsselreihenfolge
  einer Map auf, wie die Schlüsselmenge von OTP
  ([Unterschiede](differences.md)).
- `dict` und `sets`: Ein dict und eine Menge der Version 1 sind die records
  von OTP über einer linearen Hash-Tabelle (`collections/linear_hash.cpp`),
  Segmente aus 16 Bucket-Listen mit Slots aus `erlang:phash/2`, genau wie in
  OTP erweitert und verkleinert, sodass records, `to_list/1` und
  Fold-Reihenfolgen denen von OTP entsprechen. Eine Menge der Version 2
  (Standard) ist eine Map mit `[]`-Werten; Schnitt und Differenz zweier Maps
  verwenden die Werte von OTP (die eigenen Werte einer Map, sobald genügend
  Schlüssel erhalten bleiben, sonst `[]`). Abfragen und Aktualisierungen
  eines dict, `sets`-Operationen ohne funs, `new/0` und `from_list/1` sind
  Builtins; `update`, `fold`, `map`, `filter`, `merge` und `sets:new/1`,
  `from_list/2`, `fold`, `filter`, `map`, `filtermap` sind Erlang, die
  gehashten über den privaten Builtins `clause_hashed:entries/1`
  (Speicherreihenfolge), `with_values/2` und `keep/2`. Ein Term, der kein dict
  ist, löst `{badrecord, Term}` aus (`size/1`, `is_empty/1`
  `function_clause`), einer, der keine Menge ist, `function_clause`.
- `gb_trees` und `gb_sets` teilen eine Engine für balancierte Bäume
  (`collections/balanced_tree.cpp`): Einfügen prüft beim Rückweg nach oben
  Anderssons Gewichtsregel und baut einen Teilbaum wie OTP aus seinen
  sortierten Einträgen neu auf; Löschen hebt den kleinsten Knoten der größeren
  Seite an, und Vereinigung, Schnitt und Differenz von `gb_sets` führen die
  sortierten Listen zusammen oder fügen nach der Größenregel von OTP
  (`N2 < 10` oder `N2 < N1 * round(1.46 ln N2)`) ein und schlagen nach.
  Zusammengeführte Bäume werden wie bei `balance_revlist` von OTP
  rechtslastig aufgebaut, sodass jeder Baum dem von OTP entspricht. `map`,
  `fold`, `filter`, `filtermap` und die Konstanten sind Erlang.
- `queue`: `{Rear, Front}` von OTP; jede Operation verschiebt Elemente
  zwischen den Listen wie OTP (eine Seite mit einem Element wird verschoben,
  eine allein verbleibende Liste halbiert), sodass Warteschlangen denen von
  OTP entsprechen. Ein Term, der kein Listenpaar ist, ergibt `badarg`,
  `get`, `drop`, `head` einer leeren Warteschlange den Fehler `empty`.
  Funktionen mit funs und die Okasaki-Namen sind Erlang.
- `array`: Der record `#array{}` von OTP 29, ein Tupelbaum mit Blättern aus
  16 Einträgen (`[]` für einen leeren Teilbaum), einem zwischengespeicherten
  Blatt und einem Null-Offset; `set`, `append`, `shift`, `prepend`, `slice`,
  `reset`, `resize` und die Konstruktoren (`from_list`, `from_orddict` mit
  seinen Lückenmarkern, `from`) ändern den record genau wie OTP. Folds und
  Mapfolds sind Erlang über den privaten Builtins `clause_array:values/3`,
  `sparse/3` und `replace/4`; das letzte baut einen abgebildeten Bereich wie
  die Mapfolds von OTP neu auf (leere Teilbäume entfaltet, außer bei einer
  dünn besetzten Abbildung) und liest den Cache erneut.

## Kodierungen

`runtime/src/builtins/encoding/`.

- `base64`: Jede dokumentierte Funktion ist ein Builtin. Die Kodierung nimmt
  ein binary oder eine Ganzzahlliste entgegen (die Arithmetik von OTP darauf:
  `badarith` für eine Nicht-Ganzzahl, `badarg` jenseits der Alphabettabelle);
  die Dekodierung durchläuft die Eingabe wie die Zustandsautomaten von OTP,
  sodass die Fehler für jede Eingabe übereinstimmen: Leerraum wird
  übersprungen, ein Eingabeende nach einem Zeichen einer Gruppe ergibt
  `function_clause`, nach zwei oder drei `missing_padding`, außer bei
  `padding => false`, ein Zeichen außerhalb des Alphabets `badarg` beim
  Aufbau seiner Gruppe (`badarith` innerhalb der Verschiebungen von OTP),
  alles außer Leerraum nach der Auffüllung `{case_clause, Symbol}`.
  `mime_decode` überspringt jedes Zeichen außerhalb des Alphabets und Daten
  nach einem falsch platzierten `=`.
- `json` (`encoding/json.cpp`): `decode/1` ist ein Builtin, das die
  Decoder-Zustände von OTP über einem expliziten Stapel offener Container
  durchläuft, sodass Werte (ein Objekt behält den ersten Wert eines
  Schlüssels), der Rest nach dem Wert und die Fehler übereinstimmen:
  `unexpected_end`, wenn mehr Eingabe den Text vervollständigen könnte,
  `{invalid_byte, Byte}` beim von OTP zurückgewiesenen Byte (bei einem
  abgeschnittenen Literal das Byte nach seinem ersten),
  `{unexpected_sequence, Bytes}` bei einer fehlerhaften `\u`-Escape-Sequenz
  oder einer von `binary_to_float/1` zurückgewiesenen Gleitkommazahl.
  `encode_binary/1` und `encode_binary_escape_all/1` sind Builtins, die die
  verschachtelten iodata von OTP aufbauen, ebenso die Standardpfade
  `encode/1` und `format/1,2` (`encoding/json_encode.cpp`, über
  `clause_json:encode/1` und `format/2`); jenseits von 256
  Verschachtelungsebenen oder bei Formatoptionen, die keine kleinen
  nichtnegativen Ganzzahlen sind, antworten sie mit `fallback`, und
  `json.erl` baut dieselben iodata selbst auf. Encoder und Formatierer mit
  funs und die Callback-Decoder `decode/3`, `decode_start/3`,
  `decode_continue/2` sind Erlang; die Decoder durchlaufen die Zustände von
  OTP über den privaten Scannern `clause_json:string/2` und `number/2`,
  sodass Callbacks in der Reihenfolge von OTP laufen und Fortsetzungszustände
  die Tupel von OTP sind.

## Dateinamen

`runtime/src/builtins/filename/`.

- `flatten/1`, `join/1,2`, `absname_join/2`, `append/2`, `basename/1,2`,
  `dirname/1`, `extension/1`, `rootname/1,2`, `split/1`, `pathtype/1`,
  `nativename/1` und `validate/1` sind Builtins nach den Klauseln von OTP
  für die Host-Familie: Unix `/` oder Windows `/` und `\`,
  Laufwerksbuchstaben (Großbuchstaben werden von `join` und `split` klein
  geschrieben) und `//`-Netzwerknamen. Listen werden so durchlaufen, wie die
  Klauseln von OTP sie öffnen (verschachtelte Listen und Atome dort, wo eine
  Klausel sie öffnet, `List ++ Rest` löst bei einer unechten Liste
  `badarg` aus), sodass Ergebnisse die Formen von OTP behalten: die Elemente
  des Namens, von `flatten/1` als Elemente erhaltene Binaries, Teillisten und
  Teilbinaries sowie `function_clause` von OTP, wenn eine Klausel auf ein
  Nicht-Zeichen trifft.
- `absname/1,2` (das aktuelle Verzeichnis und das eigene eines Laufwerks) und
  `basedir/2,3` (die Umgebung) sind Erlang darüber.

## Zeichenketten

`runtime/src/builtins/string/`: jede Funktion von `string`.

- Die Durchläufe folgen `string.erl` Klausel für Klausel über
  `unicode_util:cp/1` und `gc/1`, die `unicode/code_points.cpp` auf Terme in
  den Formen von OTP portiert: verschachtelte Listen werden so weit wie in OTP
  geöffnet (bis zu drei weitere Codepoints nach dem ersten abgeflacht),
  Binaries als Ausschnitte mit geteiltem Puffer erhalten, `{error, Rest}` bei
  ungültigem UTF-8. So geben `trim`, `take`, `lexemes`, `split`, `find`,
  `slice` und `prefix` Reste der Eingabe, Teilbinaries und die von OTP
  aufgebauten gemischten Listen zurück (`[Keep | Cont]`, `[Token, Bin]`,
  Verschachtelung von `stack/2`) und lösen die Fehler von OTP aus
  (`{badarg, Rest}`, `function_clause`, `case_clause` und `badmatch`, wenn
  Klauseln auf eine unerwartete Antwort treffen, `badarg` von
  `binary:compile_pattern([])`, wenn `nth_lexeme/3` eine leere Trennermenge
  kompiliert).
- Die in OTP rumpfrekursiven Durchläufe am Ende (`trim/3`, `take/4` mit
  `trailing`) laufen als Schleifen, die pro Schritt einen Frame aufzeichnen
  und die Frames am Ende falten, sodass lange Strings den C++-Stack nicht
  überlaufen können.
- `uppercase/1`, `lowercase/1`, `casefold/1` geben wie OTP die Eingabe selbst
  zurück, wenn sich kein Zeichen ändert; `titlecase/1` bildet den ersten
  Codepoint ab. `equal/4` normalisiert über `unicode/normalize.cpp`, die
  Portierung von `nfc/nfd/nfkc/nfkd` aus `unicode_util` (Zerlegungstabellen,
  kanonische Ordnung, paarweise Zusammensetzung, Hangul-Jamo), und prüft
  identische Reste in jedem Schritt erneut wie die Klausel
  `equal_nocase(A, A)` von OTP.
- `to_integer/1` und `to_float/1` entnehmen mit `take/2` die Zeichen der
  Zahl und parsen sie wie `string:list_to_integer/1` (`{Int, Rest}` von erts
  mit `no_integer`, `not_a_list`, `system_limit`) und `list_to_float/1`
  (Gleitkommasyntax von Erlang, Komma als Dezimalpunkt erlaubt, Exponent nur
  mit Ziffern); jeder interne Fehler ergibt `{error, badarg}`.
- Die Latin-1-API (`len`, `chr`, `tokens`, `strip`, `left`, `centre`, ...)
  ist mit ihren Fehlern portiert: `function_clause`, wenn eine Klausel bis
  `[]` läuft, `badarg` von `erlang:length/1`, `++` und `lists:reverse/2`.
- `jaro_similarity/2` gleicht Graphem-Cluster innerhalb der Distanz von OTP ab
  und zählt Vertauschungen in der Reihenfolge von OTP.

## URI-Zeichenketten

`runtime/src/builtins/uri/`.

- `parse/1` ist ein durch eine Trennzeichentabelle gesteuerter Durchlauf über
  die Grammatik von RFC 3986, der die Reihenfolge von OTP beibehält, sodass
  seine Antworten enthalten, wo der Parser von OTP anhielt: zuerst eine URI
  mit Schema (ein Fehler nach dem Doppelpunkt des Schemas ist endgültig),
  sonst eine relative Referenz; `userinfo@host`, wenn der userinfo-Durchlauf
  gelingt, sonst die Autorität als Host; ein Host aus Ziffern, der keine
  strenge IPv4-Adresse ist, wird erneut als registrierter Name durchlaufen;
  `{error,
  invalid_uri, Fragment}` mit dem Fragment von OTP. Hosts werden mit den
  strengen IPv4- und IPv6-Formen von `inet` geprüft.
- `recompose/1`, `normalize/1,2` und `resolve/2,3` arbeiten wie
  `uri_string.erl` auf den Map-Komponenten: Die Listen- oder Binary-Form
  jeder Komponente bestimmt die des Ergebnisses, Antworten `{error, ...}`
  von OTP werden an denselben Stellen zurückgegeben, ausgelöst oder geworfen,
  und `resolve` führt einen relativen Pfad nach dem letzten Schrägstrich des
  Basispfads zusammen (ein Graphem-Durchlauf wie `string:split/3` von OTP).
- `percent_decode/1`, `quote/1,2`, `unquote/1`, `transcode/2`,
  `compose_query/1,2`, `dissect_query/1` und die Zeichenklassen folgen den
  Byte-Durchläufen von OTP, einschließlich geworfener Fehler bei Binaries und
  zurückgegebener bei Listen, numerischer HTML-Referenzen und `+` in
  Formularabfragen.
- `unicode/graphemes.cpp` segmentiert Codepoints nach den Regeln von
  `unicode_util:gc/1` in Graphem-Cluster für Builtins, die Cluster-Grenzen
  benötigen.

## Zufallszahlen

`runtime/src/builtins/rand/`.

- `rand`: Zustände sind `{AlgHandler, AlgState}` von OTP mit dessen
  Handler-Maps (ihre funs gehören `rand` selbst) und Zustandslayouts, sodass
  exportierte Seeds, Folgen und gesprungene Zustände für jeden Algorithmus
  denen von OTP entsprechen (`exsss`, `exro928ss`, `exrop`, `exs1024s`,
  `exsp` und die veralteten `exs64`, `exsplus`, `exs1024` sowie `dummy`).
  Bei einem Handler, der dem eigenen von OTP entspricht, erledigen die
  privaten Builtins `clause_rand:seed/2`, `next/2`, `uniform/2,3`,
  `uniform_real/2`, `bytes/3`, `normal/2`, `shuffle/3` und `jump/2` die
  Arbeit in C++: Initialisierung (SplitMix64, Listen, die 3-Tupel-Hashes und
  Seed-Fehler von OTP), Bereiche über die Bits des Generators hinaus, dichte
  Gleitkommazahlen, Bytes, die Normalverteilungs-Ziggurat und der Bitstrom der
  Mischoperation. Jeder andere Handler ist ein Plug-in: `rand.erl` führt die
  generischen Algorithmen von OTP über seinen funs aus.
- `splitmix64_next/1`, `exsp_next/1`, `exsp_jump/1` und die
  `mwc59`-Funktionen sind Builtins; `mwc59_seed/0` hasht den Standard-Seed
  von `rand`.
- `tools/rand/observe.escript` beobachtet die Konstanten von OTP über die
  Plug-in-API von `rand`: Streifenbreiten (Schnellpfad-Produkte) und Grenzen
  (wo die Wörter eines Streifens den langsamen Pfad erreichen) der Ziggurat
  sowie gesprungene Zustände, aus denen `tools/rand/generate.py` jedes
  Sprungpolynom über GF(2) löst (an einem zweiten Zustand geprüft) und
  `tables.cpp` schreibt; Streifenhöhen werden mit hoher Genauigkeit berechnet
  ([Unterschiede](differences.md#random-numbers)).
- `random` (veraltet): `uniform_s/1` ist ein Builtin des
  Wichmann-Hill-Generators; Initialisierung und Prozesswörterbuchfunktionen
  sind Erlang.

## Kalender

`runtime/src/builtins/calendar.cpp`.

- Die gregorianische Arithmetik besteht aus Builtins über Ganzzahlen
  beliebiger Größe mit dem abschneidenden `div` und `rem` von Erlang nach
  den Ära-Formeln von OTP: `date_to_gregorian_days/1,3`,
  `gregorian_days_to_date/1`, `datetime_to_gregorian_seconds/1`,
  `gregorian_seconds_to_datetime/1`, `day_of_the_week/1,3`,
  `is_leap_year/1`, `last_day_of_the_month/2`, `valid_date/1,3`,
  `seconds_to_time/1`, `seconds_to_daystime/1`, `time_to_seconds/1`,
  `time_difference/2`, `iso_week_number/1`. Eine von den Klauseln von OTP
  zurückgewiesene Form ergibt `function_clause`, eine Nicht-Ganzzahl, mit
  der gerechnet wird, `badarith`; Daten außerhalb des Wertebereichs werden
  wie in OTP berechnet.
- Lokale und universelle Zeit, Systemzeit sowie Parsen und Formatieren nach
  RFC 3339 sind Erlang in `library/stdlib/calendar.erl` über den
  `erlang`-Zeit-Builtins und `proplists`, mit den Fehlern von OTP
  (`{badarg, [Arg, Options]}` außerhalb des Wertebereichs, `{badmatch, _}`
  und `{case_clause, _}` bei einer fehlerhaften Zeitverschiebung).

## Persistente Terme

`runtime/src/builtins/persistent_term.cpp`, über der Tabelle der Runtime
([Runtime](runtime.md#persistent-terms)). `put/2` und `put_new/2` geben `ok`
zurück (`put_new/2` eines gespeicherten Schlüssels ist `ok` bei einem exakt
gleichen Wert, sonst `badarg`); `get/1` eines nicht gespeicherten Schlüssels
ist `badarg`, `get/2` gibt den Standardwert zurück; `get/0` listet jedes
`{Key, Value}` auf; `erase/1` gibt an, ob der Schlüssel gespeichert war;
`info/0` ist `#{count => N, memory => Bytes}` (die Wörter der gespeicherten
Kopien). Schlüssel matchen exakt (`1` und `1.0` unterscheiden sich). Lesezugriffe geben den
gespeicherten Term an Ort und Stelle zurück, ohne Kopie.

## Modul unicode

`runtime/src/builtins/unicode/`. Jede Funktion ist ein Builtin:
`characters_to_binary/1,2,3`, `characters_to_list/1,2` (auch unter den
internen OTP-Namen `characters_to_binary_int/2` und `characters_to_list_int/2`),
`bin_is_7bit/1`, `bom_to_encoding/1`, `encoding_to_bom/1` sowie
(`unicode/forms.cpp`) die Normalisierungsformen, `category/1`,
`is_whitespace/1`, `is_id_start/1` und `is_id_continue/1`.

- Kodierungen: `latin1`, `unicode`/`utf8`, `utf16` und `utf32`, standardmäßig
  Big Endian oder `{utf16 | utf32, big | little}`; alles andere ist `badarg`
  (`encoding_to_bom/1`: `function_clause`, wie OTP).
- Chardata ist ein Binary oder eine Liste, möglicherweise unecht mit einem
  Binary als Ende, aus Codepunkten, Binaries in der Eingabekodierung und
  verschachtelten Chardata; aufeinanderfolgende Binaries werden als ein Strom
  dekodiert, sodass ein Zeichen zwei überspannen kann. Alles andere ist
  `badarg`.
- Ein Zeichen, das die Ausgabe nicht aufnehmen kann (ein ungültiger Codepunkt
  oder eine ungültige Bytefolge, ein Code über 255 bei `latin1`-Ausgabe),
  beendet die Konvertierung mit `{error, Converted, Rest}`; eine Eingabe, die
  innerhalb eines Zeichens endet, mit `{incomplete, Converted, Rest}`. `Rest`
  hat die Form von OTP: der nicht konvertierte Teil der innersten Liste, die
  mit dem fehlschlagenden Element beginnt (ein Binary als sein nicht
  konvertiertes Suffix, allein, wenn es die oberste Ebene beendet), innerhalb
  des verbleibenden Endes jeder umschließenden Liste; unfertige Bytes, die aus
  einem Binary übernommen wurden, kommen zuerst, und bei `latin1`-Ausgabe wird
  eine fehlschlagende Ganzzahl in eine Liste gehüllt.
- `bin_is_7bit/1` ist false für alles außer einem Binary aus Bytes unter 128.
- `characters_to_nfc_list/1` und seine Geschwister führen die Schleife von
  OTP über die Normalformen von `unicode_util` aus: Codepoints als Liste
  oder UTF-8-binary, `{error, Converted, Rest}` bei ungültigem UTF-8 und
  `badarg` für alles andere. Die Eigenschaftsfunktionen nehmen einen
  Codepoint entgegen (sonst `badarg`) und behalten die Abkürzungen von OTP:
  `is_whitespace/1` ist unterhalb von 5001 außerhalb seiner ASCII- und
  Latin-1-Liste falsch, und Bezeichnertests entscheiden ASCII direkt und den
  Rest nach Kategorie, Other_ID_Start, Other_ID_Continue und Mustersyntax.

## Modul code

`runtime/src/builtins/code.cpp`. Es gibt keinen `code_server`-Prozess; die
Abfragen zu geladenen Modulen antworten für das gelinkte Programm: Ein Modul ist
geladen, wenn das Programm es enthält (kompilierter Code oder
Runtime-Builtins). `ensure_loaded/1` liefert `{module, M}` oder
`{error, nofile}`, `ensure_modules_loaded/1` `ok` oder
`{error, [{M, nofile}]}`, `is_loaded/1` `{file, preloaded}` oder `false`,
`which/1` `preloaded` oder `non_existing`, `module_status/1` `loaded` oder
`not_loaded`, `all_loaded/0` und `module_status/0` listen jedes Modul auf,
`is_sticky/1` ist `false`. Ein Modulargument, das kein Atom ist, ist
`function_clause`. Der Fehlerpfad von `io_lib:format/2` in OTP, der
`code:ensure_modules_loaded/1` aufruft, löst daher das ursprüngliche `badarg`
aus. Codepfade und Laden sind Stubs.

## Modul init

`runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Eine ausführbare
Datei ist ein gestartetes System ohne Boot-Skript. Der Start dekodiert die
Befehlszeile einmal (`ProgramArguments`, `runtime/src/startup/arguments.cpp`):
Die Argumente nach den Runtime-Optionen sind sowohl das argv des Eintritts mit
Stelligkeit 1 als auch `get_plain_arguments/0`. Es gibt keine Emulator-Flags;
das einzige Flag ist `home`, beim Start gesetzt, wie `erlexec` von OTP es setzt
(`HOME`; unter Windows `HOMEDRIVE` und `HOMEPATH`, sonst `USERPROFILE`), sodass
`get_argument(home)` `{ok, [[Home]]}` ist, `get_arguments/0`
`[{home, [Home]}]` und jedes andere Flag `error`. `script_name/0` ist der
absolute Pfad der ausführbaren Datei mit Schrägstrichen. Diese vier sind
Builtins; der Rest ist Erlang:

- Antworten des gestarteten `init` von OTP: `get_status/0`
  `{started, started}`, `notify_when_started/1` `started`, `ensure_loaded/1`
  `not_allowed`, `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (wartet auf
  `{init, started}`); `get_configfd/1` und `set_configfd/2` halten ihre Werte
  in `persistent_term` unter `{init, configfd, Id}`;
- `script_id/0` ist `{"Clause", "29"}`;
- `stop/0,1` und `reboot/0` halten sofort an, mit den Statusregeln von OTP:
  Eine nicht negative Ganzzahl ist der Exit-Status, eine Byte-Liste der
  Halt-Slogan, jedes andere Argument `badarg`;
- abgelehnt: `boot/1` und `restart/0,1` lösen nach den Argumentprüfungen von
  OTP `notsup` aus (`restart/1` mit einer Liste, die nicht `[]` oder
  `[{mode, M}]` ist, ist `badarg`), `make_permanent/2` gibt für gültige Namen
  `{error, notsup}` zurück und sonst `{error, badarg}`.

## Atomics und Counters

`runtime/src/builtins/atomics.cpp`. Ein `atomics`-Array ist eine
[Handle-Referenz](runtime-heap.md#handle-references), deren Puffer ein
Vorzeichenwort und die 64-Bit-Werte enthält, aktualisiert über
`std::atomic_ref` mit sequenziell konsistenten Operationen; es wird von jeder
Kopie der Referenz geteilt (Nachrichten, persistente Terme, `binary_to_term/1`,
solange es lebt) und mit der letzten freigegeben.

- `new/2` nimmt eine Stelligkeit von 1 bis 2^27 und Optionen
  `[{signed, Bool}]` (die letzte gewinnt); `get/2`, `put/3`, `add/3`,
  `add_get/3`, `sub/3`, `sub_get/3`, `exchange/3`, `compare_exchange/4` und
  `info/1` sind Builtins mit dem `badarg` von OTP für eine ungültige Referenz,
  einen ungültigen Index oder Wert. Gespeicherte Werte müssen in das Array
  passen (int64 oder uint64); Inkremente dürfen jede Ganzzahl von -2^63 bis
  2^64 - 1 sein und laufen über. `info/1` meldet den `memory` von OTP mit
  40 + 8 Bytes pro Wert.
- `counters` ist Erlang (`library/erts/counters.erl`): `{atomics, Ref}` und
  `{write_concurrency, Ref}` hüllen beide ein vorzeichenbehaftetes
  atomics-Array, sodass Write-Concurrency-Zähler bei jedem Lesen exakt sind.
  `info/1` des letzteren meldet Größe und Speicher des Arrays.

## Erts internal

`runtime/src/builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`.
Die Funktionen, die `stdlib` und `kernel` von OTP aufrufen:

- Builtins `cmp_term/2` (exakte Termordnung: eine Ganzzahl vor einer gleichen
  Gleitkommazahl) und `map_next/3`, das Protokoll von `maps:iterator/1,2` und
  `maps:next/1`: Ein ganzzahliger Pfad durchläuft die Map in
  Schlüsselreihenfolge und fährt über die verbleibenden Schlüssel fort, ein
  Schlüssellistenpfad nimmt seine Schlüssel der Reihe nach; ein
  Listenakkumulator erhält jede Assoziation ab dem Pfad;
- Erlang `list_to_integer/2` und `binary_to_integer/2` (die Hilfsfunktionen
  von `string:to_integer/1` und den Konvertierungs-BIFs, `big` jenseits einer
  kleinen Ganzzahl der Wortgröße), `map_to_tuple_keys/1` (die sortierten
  Schlüssel einer beliebigen Map), `term_type/1`, die
  Write-Concurrency-Funktionen `counters_*`, `dynamic_node_name/0,1` über
  `persistent_term`;
- abgelehnt: `get_creation/0` ist `undefined` (keine Verteilung) und
  `map_hashmap_children/1` löst `badarg` aus (keine Map hat Hashmap-Knoten);
- ausgelassen: die Gruppen für Verteilung, `.beam` und Emulator-Interna.

`erts_code_purger:purge/1` antwortet `{false, false}` und `soft_purge/1`
`true`, da gelinkter Code keinen alten Code hat; der Purger-Prozess und
`finish_after_on_load/2` sind ausgelassen.

## Unicode util

`library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`. OTP
erzeugt `unicode_util` während seines Builds (900 KB Erlang); Clause hält die
Daten in erzeugten C++-Tabellen (`unicode/tables.cpp`), die von den Builtins
seines privaten Moduls `clause_unicode` abgefragt werden, und
`unicode_util.erl` beantwortet darüber jede Funktion von OTP mit den
Ergebnisformen von OTP (`{error, Rest}` oder `{badarg, Rest}` bei ungültigem
UTF-8). Die chardata-Durchläufe sind Builtins: `cp/1`
(`unicode/code_points.cpp`) öffnet verschachtelte Listen so weit wie OTP und
erhält den Rest eines binary als Ausschnitt daraus; `gc/1` trennt erweiterte
Graphem-Cluster nach UAX #29 in der Regelreihenfolge von OTP; `nfd/1`,
`nfc/1`, `nfkd/1`, `nfkc/1` (`unicode/normalize.cpp`) normalisieren den
ersten Cluster, wobei `nfkc/1` wie `compose_compat_0` von OTP eine Liste
erhält, wenn deren Zerlegung mehrere Codepoints hatte; `uppercase/1`,
`lowercase/1`, `titlecase/1` und `casefold/1` bilden den ersten Codepoint
ab. `spec_version/0` ist `{17, 0}`.

`tools/unicode/generate.py` schreibt die Tabellen einmal pro Unicode-Update:
Groß-/Kleinschreibungsabbildungen, Kategorien, Zerlegungen und die
Eigenschaftsprädikate aus den Antworten des Host-OTP für jeden Codepunkt
(`tools/unicode/observe.escript`), die Daten zu Graphem-Grenzen, Emoji,
indischen Schriften und Komposition aus den Dateien der Unicode Character
Database, die OTP 29 festlegt (Unicode 17.0). Nur die erzeugten Tabellen werden
eingecheckt, mit dem Hinweis, den die Unicode License v3 verlangt; Builds
brauchen weder OTP noch die Datendateien. `executables_unicode_tables` und
`executables_unicode_clusters` vergleichen Antworten, Cluster und
Normalformen mit denen von OTP, `executables_unicode_forms` die Formen und
Eigenschaften von `unicode`.

## io_lib

`library/stdlib/io_lib.erl`, `runtime/src/builtins/io_lib/`. Ergebnisse sind
die tiefen Zeichenlisten von OTP, genau wie von `io_lib`, `io_lib_format`
verschachtelt aufgebaut: Text entsteht zuerst als Zellen einer C++-Arena
(`io_lib/deep.cpp`), dann als Term (`io_lib`) oder flache Zeichen
(`io:format/1,2,3`, das dieselbe Engine ausführt).

- Schreibfunktionen (`io_lib/write.cpp`): `write/1,2,5` folgen `write1/4`
  mit Tiefengrenzen (`[...]`, `|...`, `,...`), Atomen nach Kodierung
  (`latin1` maskiert Zeichen jenseits von Latin-1), Maps in der
  Schlüsselreihenfolge von Clause, `ordered` oder `reversed`;
  `write_bin/5` meldet die Größen von OTP einschließlich seiner Eigenheiten.
  `write_string/1,2` und seine Latin-1- und `as_latin1`-Formen,
  `write_char/1` und Verwandte, `write_atom/1`, `quote_atom/2`,
  `write_binary/3` und die Binary-Formen maskieren wie `string_char/4` und
  `needs_escape/2`.
- Format-Engine (`io_lib/format_scan.cpp`, `format_build.cpp`): `scan`
  wandelt das Format in Literale und `format_spec()`-Maps um
  (`scan_format/2`, `unscan_format/1`, `build_text/1,2`); `build_small`
  flacht die kleinen Steuersequenzen
  (`~e ~f ~g ~b ~B ~x ~X ~+ ~# ~c ~~ ~n ~i`, `~s` eines Atoms) in das
  Ergebnis ab; `build_limited` verteilt `chars_limit` auf `~w ~W ~s ~p ~P`
  und schreibt sie über `string/6`, `term/6` und die balancierte Auffüllung
  von `chars/2`. `~e`, `~f`, `~g` runden die 21 Ziffern von
  `float_to_list/1` wie `float_man/3` (`format_float.cpp`). Interne Fehler
  ergeben `badarg`, wie durch das catch von `io_lib`; `unscan_format/1`
  löst seine eigenen aus. `bformat/2,3` und `bfwrite/2,3` liefern denselben
  Text als UTF-8.
- Prüfungen und Hilfsfunktionen: `char_list/1`, `deep_char_list/1`,
  Druckbarkeitsprüfungen (`printable_list/1` ist Latin-1:
  `io:printable_range/0` ist `latin1`), `chars_length/1`, `indentation/2`
  (mit den Binary-Offsets von OTP nach einem Tabulator), `limit_term/2`,
  `nl/0` und die E/A-Serverzustände `collect_chars/1,3,4`,
  `collect_chars_eager/4`, `collect_line/1,3,4`, `collect_line_no_eol/4`
  (`io_lib/collect.cpp`).
- Pretty Printer (`io_lib/pretty*.cpp`): `io_lib_pretty` von OTP für
  `print/1,4`, `~p`/`~P` (Tiefe und `chars_limit`), `write/2,5`,
  `bwrite/2` und `write_bin/5` mit `chars_limit` über 0 sowie
  Absturzberichte. `print_length/7` baut das Zwischenformat in einer Arena
  auf (jeder Wert mit seiner einzeiligen Länge, Punkte mit der Information
  zur tieferen Ausgabe); `intermediate/7` vertieft es innerhalb von
  `chars_limit` (`expand/3`, `find_upper`, `search_depth`); `cind/7`
  wählt die Tag-Einrückung, und `pp/8` bricht Zeilen in den tiefen
  Listenformen von OTP um. `bformat/2,3` ordnen `~p` wie `print_bin/2`
  an, mit dessen Binary-Zeilenumbrüchen, Größe und Spalte.
- Erlang: `get_until/1,3,4` (wendet den Scanner des Aufrufers an),
  `format_prompt/1,2` und `write/3`. Stub: `fread/2,3`.
- Tiefer als 256 Ebenen verschachtelte Container lösen `system_limit` aus,
  und Vergleichs-funs für `maps_order` ergeben `badarg`
  ([Unterschiede](differences.md#io)). `executables_io_lib_text` vergleicht
  die Formen jeder Funktion mit denen von OTP, `executables_pretty_print`
  die des Pretty Printers.

## Modul zlib

`runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. Die Runtime
linkt zlib 1.3.2, das Release, das OTP 29 mitbringt ([zlib](compile.md#zlib)),
sodass komprimierte Bytes für jede Stufe, Strategie, Fenstergröße und jedes
Flush denen von OTP gleichen. Ein Stream ist eine
[Handle-Referenz](runtime-heap.md#handle-references), deren Puffer den
`z_stream` enthält; sein Finalizer beendet eine aktive Sitzung, wenn die
letzte Kopie stirbt. Die privaten `clause_zlib`-Builtins (Öffnen, Schließen,
Controller, Init, Deflate, Inflate, End, Reset, Parameter- und
Wörterbuchaufrufe) führen eine Operation über ihre gesamte Eingabe aus;
`zlib.erl` behält die API von OTP, Argumentfehler (`bad_compression_level`,
`bad_windowbits`, ...), Stream-Zustände (`not_initialized`,
`already_initialized`, `not_on_controlling_process`), `eos_behavior`,
Wörterbücher (`{need_dictionary, Adler}`) und die Ganzpuffer-Funktionen
`compress/1`, `zip/1`, `gzip/1` und ihre Umkehrungen (verkettete
gzip-Member). Ein gzip-Header nennt die Plattform, wie das zlib von OTP ihn
schreibt. `term_to_binary/2` mit `compressed` oder `{compressed, Level}`
komprimiert so, wie OTP entscheidet (auf mindestens fünf Bytes weniger als die
Nutzdaten, sonst unkomprimiert).

## Modul re

`runtime/src/builtins/re/`, `library/stdlib/re.erl`: die Exporte und Typen von
OTP 29 über dem PCRE2-Release, das OTP mitbringt ([PCRE2](compile.md#pcre2)).
`version/0` ist Version und Datum von PCRE2 als Binary
(`<<"10.47 2025-10-21">>`, wie in OTP).

Ein kompiliertes Muster ist das `{re_pattern, CaptureCount, Unicode, UseCRLF,
Ref}` von OTP 29, wobei `Ref` eine
[Handle-Referenz](runtime-heap.md#handle-references) ist, die den
`pcre2_code` besitzt; ihr Finalizer gibt den Code mit der letzten Kopie frei,
und Prozesse teilen ihn nur lesend. Wie in OTP ist die C-Seite klein und der
Rest Erlang:

- `clause_re:compile/2` kompiliert ein Regex-Binary mit Kompilieroptionen
  (`{ok, Pattern}` oder `{error, {Message, Offset}}` mit der Meldung von
  PCRE2); `re:inspect/2` beantwortet `namelist`.
- `clause_re:run/4` ist der `re:run`-BIF von OTP ohne seine Traps: ein Treffer
  eines Binary-Subjekts ab `{offset, N}`, wobei ein textueller Regex zuerst
  kompiliert wird, mit jeder Capture-Spezifikation und jedem Capture-Typ,
  `match_limit` und `match_limit_recursion` und den Fehlern von OTP
  (Ergebnisse von `report_errors`, `badarg` für Kompilieroptionen oder andere
  Zeilenumbruch-Konventionen, die zusammen mit einem kompilierten Muster
  angegeben werden).
- `re.erl` konvertiert Unicode-Chardata in UTF-8 und Captures zurück in
  Zeichen, führt `global`-Treffer einzeln aus (nach einem leeren Treffer
  versucht es erneut verankert und nicht leer, dann rückt es ein Zeichen vor,
  oder ein CR-LF-Paar bei CRLF-Zeilenumbrüchen, wie es `loopexec` von OTP tut)
  und implementiert `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`, ein Fun als
  Ersetzung) und `split/2,3` (`{parts, N}`, `trim`, `group`,
  `{return, Type}`) mit den Ergebnissen von OTP.

Exportierte Muster (`export`, `import/1`) werden nicht bereitgestellt.
`executables_re_module` vergleicht Kompilieren, Matchen, Captures, globale und
Unicode-Treffer, Ersetzen, Teilen und Argumentfehler mit OTP.

## Prim eval

`runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun, Timeout)` ist das receive von `erl_eval`, dessen
Klauseln ein Fun sind: Es durchsucht die Mailbox ab der ältesten Nachricht mit
den Schritten eines kompilierten [receive](processes.md#receive), den privaten
`clause_receive`-Builtins `peek/0` (`{message, M}` oder `none`), `skip/0`,
`take/0`, `restart/0` und `wait/1` (das Warte-Builtin des kompilierten Codes,
mit seinem Timeout und `timeout_value`). Die erste Nachricht, für die `Fun`
etwas anderes als `nomatch` antwortet, wird entfernt und diese Antwort
zurückgegeben; `timeout`, wenn `Timeout` abläuft. Eine Ausnahme aus `Fun` lässt
jede Nachricht an ihrem Platz. `executables_prim_eval_receive` vergleicht
Mailbox-Reihenfolge, Timeouts, eine während des Wartens eintreffende Nachricht
und Ausnahmen mit OTP.
