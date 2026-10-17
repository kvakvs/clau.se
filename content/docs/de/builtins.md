---
source: docs/builtins.md
sourceCommit: a8c3f8f6
sourceSha256: c5b5b3ed022c6da6d2e2862ed0b124314e7f7a5b8cfdfcc5b3a787b4b99841fb
translatedAt: 2026-10-17
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
| `erlang:function_exported(M, F, A)`, `A -- B`, `length(L)` in einem Rumpf (Katalog-Builtins ohne Inline-Dienst) | Wie eine Funktion betreten: `CLAUSE_builtin_frame_v1(context, index)` liefert den Frame des Builtins, die Argumente kommen in die Register ([Portionen](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (direkte Builtins: kein Trap, kein Warten, keine Wirkung auf einen anderen Prozess) | Sofort aufgerufen: `CLAUSE_builtin_call_v1(context, index, arguments)` liefert das Ergebnis ([ABI](abi.md#runtime-services)) |
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
  und die Funktion läuft nicht.
- Eine Funktion gibt einen Term, ein `BuiltinResult` (`std::expected` mit
  einem `BuiltinFailure`) oder ein selbst veröffentlichtes rohes `Word` zurück
  oder wirft `BuiltinFailure` (ein Erlang-Fehler oder ein Fehlschlag beim
  Termzugriff); `call_builtin` macht aus jeder anderen C++-Ausnahme
  `out_of_memory` oder `internal_error`, sodass keine die ABI des erzeugten
  Codes überquert.
- Die meisten Familien sind typisiert. Die Guard-BIFs und Operatoren
  (`erlang/core.cpp`), die trappenden Listen-Builtins und einige andere sind
  `BuiltinBody`-Adapter auf Wortebene, die ihre Argumentwörter an die
  Inline-Dienste weitergeben, die auch erzeugter Code aufruft.

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
  Bibliotheks-Stub oder eine gleichnamige Benutzerfunktion.
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
  `library/erts/erlang.erl` (das eigene Stub-Modul von Clause) und
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

- `phash2/1,2` und `phash/2` hashen die Struktur eines Terms: Exakt gleiche
  Terme ergeben in jedem Programmlauf denselben Hash (Atome nach Schreibweise,
  Maps in Schlüsselreihenfolge, `1` und `1.0` verschieden). `phash2/1` liegt in
  0..2^27-1, `phash2/2` in 0..Range-1, `phash/2` in 1..Range; Range ist
  1..2^32, sonst `badarg`. Die Werte sind die eigenen von Clause, nicht die von
  OTP.
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
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` und
  `keydelete/3` lösen `function_clause` für ein Argument aus, das keine Klausel
  von OTP akzeptiert, und durchlaufen Listen so verzögert wie OTP:
  `sublist([a | b], 1)` ist `[a]`, `nthtail(1, [a | b])` ist `b`, `flatten/2`
  prüft sein Ende nicht über `is_list` hinaus.
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

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` und `from_keys/2` sind Builtins
  mit den Fehlern von OTP: Etwas, das keine Map ist, ergibt `{badmap, Map}`,
  ein fehlender Schlüssel bei `update/3` `{badkey, Key}`, eine
  Schlüsselliste, die keine echte Liste ist, `badarg`. Schlüssel matchen exakt
  (`1` und `1.0` sind verschiedene Schlüssel). Die übrigen implementierten
  Funktionen (`filter/2`, `map/2`, `fold/3`, `iterator/1,2`, `next/1`, ...)
  sind Erlang in `library/stdlib/maps.erl`; Iteratoren verwenden
  [`erts_internal:map_next/3`](#erts-internal).
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

## Persistente Terme

`runtime/src/builtins/persistent_term.cpp`, über der Tabelle der Runtime
([Runtime](runtime.md#persistent-terms)). `put/2` und `put_new/2` geben `ok`
zurück (`put_new/2` eines gespeicherten Schlüssels ist `ok` bei einem exakt
gleichen Wert, sonst `badarg`); `get/1` eines nicht gespeicherten Schlüssels
ist `badarg`, `get/2` gibt den Standardwert zurück; `get/0` listet jedes
`{Key, Value}` auf; `erase/1` gibt an, ob der Schlüssel gespeichert war;
`info/0` ist `#{count => N, memory => Bytes}` (die Wörter der gespeicherten
Kopien). Schlüssel matchen exakt (`1` und `1.0` unterscheiden sich). Jedes
Lesen kopiert den Wert in den Heap des Aufrufers.

## Modul unicode

`runtime/src/builtins/unicode/`. `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` und
`encoding_to_bom/1` sind Builtins; die Normalisierungs-, Kategorie- und
Bezeichnerfunktionen von `library/stdlib/unicode.erl` sind Stubs.

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
UTF-8). `gc/1` trennt erweiterte Graphem-Cluster nach UAX #29 in der
Regelreihenfolge von OTP; `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` normalisieren
den ersten Cluster; `spec_version/0` ist `{17, 0}`.

`tools/unicode/generate.py` schreibt die Tabellen einmal pro Unicode-Update:
Groß-/Kleinschreibungsabbildungen, Kategorien, Zerlegungen und die
Eigenschaftsprädikate aus den Antworten des Host-OTP für jeden Codepunkt
(`tools/unicode/observe.escript`), die Daten zu Graphem-Grenzen, Emoji,
indischen Schriften und Komposition aus den Dateien der Unicode Character
Database, die OTP 29 festlegt (Unicode 17.0). Nur die erzeugten Tabellen werden
eingecheckt, mit dem Hinweis, den die Unicode License v3 verlangt; Builds
brauchen weder OTP noch die Datendateien. `executables_unicode_tables` und
`executables_unicode_clusters` vergleichen Antworten, Cluster und
Normalformen mit denen von OTP.

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
