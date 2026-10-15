---
source: docs/builtins.md
sourceCommit: 6ed3851c
sourceSha256: 35d165fa6e573a993a44f0a3284aa944f79954a0af62fd2b79e6b20fe728a9d9
translatedAt: 2026-10-15
---
# Builtins

Die produktive Builtin-Brücke. Builtins sind
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
- Term-Zugriff: `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` und die Listenoperatoren `'++'/2` und
  `'--'/2` (`A ++ B`, `A -- B` werden per Lowering auf sie abgebildet);
- Konvertierungen: `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` ist nicht ausgewählt);
- Konsolenausgabe: `io:format/1,2` und `io:put_chars/1`, die ersten Builtins
  eines anderen Moduls ([io](io.md)); Ausgabegeräte: `io:format/3`,
  `io:fwrite/1,2,3`, `io:put_chars/2`, `io:nl/0,1`;
- die Datenfunktionen von `lists` ([lists-Modul](#lists-module));
- jede `math`-Funktion ([math-Modul](#math-module));
- das Modul `binary` ([binary-Modul](#binary-module));
- Abfragen zu Umgebung, Prozess und Version von `os` sowie die `maps`-BIFs
  ([maps-Modul](#maps-module));
- `persistent_term` ([persistente Terme](#persistent-terms));
- die `unicode`-Konvertierungen ([unicode-Modul](#unicode-module));
- die Abfragen des Moduls `code` zu geladenen Modulen
  ([code-Modul](#code-module));
- die Antworten des Moduls `init` zur Befehlszeile
  ([init-Modul](#init-module));
- `atomics`, `counters` und die `erts_internal`-Funktionen, die stdlib
  aufruft ([atomics und counters](#atomics-and-counters),
  [erts_internal](#erts-internal));
- die Tabellen von `unicode_util` ([unicode_util](#unicode-util));
- Prozessidentitäten: `self/0`, `make_ref/0`, `pid_to_list/1`
  und `ref_to_list/1` ([Pids und Referenzen](terms.md#pids-and-references));
- Prozesse: `spawn/1,3` und `is_process_alive/1`
  ([Prozesse](processes.md)); Links und Exit-Signale:
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([Links](processes.md#links)); Monitore:
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([Monitore](processes.md#monitors)); registrierte Namen:
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([registrierte Namen](processes.md#registered-names));
- Nachrichten: `'!'/2` (der Operator `!`) und `send/2`
  ([Nachrichten](processes.md#messages));
- das Prozess-Dictionary: `put/2`, `get/0,1`, `get_keys/0,1`, `erase/0,1`
  ([Prozess-Dictionary](processes.md#process-dictionary));
- Konvertierungen von Binaries, Atomen und Zahlen: `atom_to_binary/1,2`,
  `binary_to_atom/1,2`, `binary_to_existing_atom/1,2`,
  `list_to_existing_atom/1`, `integer_to_binary/1,2`, `binary_to_integer/1,2`,
  `float_to_binary/1,2`, `binary_to_float/1`, `list_to_float/1`,
  `binary_to_list/3`, `bitstring_to_list/1`, `list_to_bitstring/1`,
  `split_binary/2`, `iolist_size/1`, `list_to_pid/1`, `list_to_ref/1`. Sie
  teilen die Textregeln der Listenkonvertierungen (`conversion_text.cpp`:
  Atomnamen, Ziffern, Gleitkommaoptionen) und die Fehler von OTP:
  Gleitkommatext braucht Ziffern auf beiden Seiten des Punkts
  (`list_to_float("1e10")` ist `badarg`), ein Exponent jenseits des Bereichs ist
  `badarg` und ein Unterlauf `0.0`; Kodierungen sind `utf8`, `unicode` und
  `latin1`; sie laufen bis zum Ende;
- das [externe Termformat](#external-term-format):
  `term_to_binary/1,2`, `term_to_iovec/1,2`, `external_size/1,2`,
  `binary_to_term/1,2`;
- [Zeit](#time) und eindeutige Werte: `monotonic_time/0,1`,
  `system_time/0,1`, `time_offset/0,1`, `convert_time_unit/3`,
  `timestamp/0`, `now/0`, `unique_integer/0,1`, `localtime/0`,
  `universaltime/0`, `date/0`, `time/0`, `localtime_to_universaltime/1,2`,
  `universaltime_to_localtime/1`, `posixtime_to_universaltime/1`,
  `universaltime_to_posixtime/1`; [Timer](processes.md#timers):
  `start_timer/3,4`, `send_after/3,4`, `cancel_timer/1,2`, `read_timer/1,2`;
- [Prozess-Introspektion](processes.md#introspection):
  `process_info/1,2`, `processes/0`, `group_leader/0,2`,
  `garbage_collect/0,1,2`, `yield/0`;
  [Systeminformationen](#system-information): `statistics/1`,
  `system_info/1`, `memory/0,1`;
- [Spawn-Optionen und Aliase](processes.md#spawn-options):
  `spawn_opt/2..5`, `spawn_request/1..5`, `spawn_request_abandon/1`,
  `alias/0,1`, `unalias/1`, `monitor/3`, `hibernate/3`;
- [Fun-Informationen](funs.md#fun-information), [Hashing](#hashing) und MD5:
  `fun_info/1,2`, `fun_to_list/1`, `is_builtin/3`, `phash/2`, `phash2/1,2`,
  `md5/1`, `md5_init/0`, `md5_update/2`, `md5_final/1`;
- [Knoten](processes.md#nodes) und [Laden von Code](#code-loading):
  `nodes/0,1,2`, `is_alive/0`, `monitor_node/2,3`, `disconnect_node/1`,
  `module_loaded/1`, `loaded/0`, `pre_loaded/0`, `delete_module/1`,
  `prepare_loading/2`, `finish_loading/1`, `get_module_info/1,2`.

Einträge werden nur angehängt: Der Index eines Eintrags ist die Nummer, die
generierter Code an den Brückendienst übergibt. Ein qualifizierter Aufruf eines
Katalog-Builtins eines anderen Moduls (`io:format(F, A)`) ruft ebenfalls die
Brücke auf. Jede andere `erlang`-Funktion erreicht das
[Bibliotheksmodul erlang](#erlang-module).

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

## lists-Modul

Quelle: `runtime/src/builtins/lists/`. OTPs `lists` ist Erlang-Code (abgesehen
von einigen BIFs), daher lösen die Builtins von Clause aus, was die Klauseln von
OTP auslösen:

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` und
  `keydelete/3` lösen `function_clause` für ein Argument aus, das keine Klausel
  von OTP akzeptiert, und durchlaufen Listen so träge wie OTP:
  `sublist([a | b], 1)` ist `[a]`, `nthtail(1, [a | b])` ist `b`,
  `flatten/2` prüft seinen Rest nicht über `is_list` hinaus.
- `keymember/3` und `keysearch/3` sind in OTP BIFs: `badarg` für eine
  Position, die keine positive kleine Ganzzahl ist, oder einen unechten Rest,
  der vor einem Treffer erreicht wird.
- Schlüssel und Reihenfolge werden mit `==` und der Termordnung verglichen; von
  gleich verglichenen Elementen gewinnt das erste (`max([1, 1.0])` ist `1`,
  `usort([1.0, 1])` ist `[1.0]`, `umerge/1,2` behalten das Element der früheren
  Liste).
- Sie laufen bis zum Ende. Funktionen, die Funs nehmen (`foreach/2`,
  `mapfoldl/3`, `mapfoldr/3`, `splitwith/2`, `partition/2`, `filtermap/2`,
  `uniq/2`, ...), sind Erlang in `library/stdlib/lists.erl`, weil ein Builtin
  keine Fun aufrufen und ihr Ergebnis zurückbekommen kann; ebenso `prefix/2`,
  `suffix/2` und `uniq/1`, mit den Klauseln und Guards von OTP.
- Ein `function_clause` aus einem Builtin hat keinen eigenen Frame
  ([Unterschiede](differences.md)).

## math-Modul

Quelle: `runtime/src/builtins/math.cpp`. `library/stdlib/math.erl` enthält die
Exporte von OTP 29 als Stubs; jeder ist ein Builtin über der C-Bibliothek
(`pi/0` und `tau/0` sind Konstanten). Argumente sind in Gleitkommazahlen
umgewandelte Zahlen: alles andere ist `badarg`, eine Ganzzahl, die für eine
Gleitkommazahl zu groß ist, `badarith`. Ein Ergebnis, das keine endliche
Gleitkommazahl ist (ein Definitionsbereichsfehler wie `sqrt(-1)`, `log(0)`,
`acos(2)` oder ein Überlauf wie `pow(10, 400)`, `exp(1000)`), ist `badarith`.
`floor/1` und `ceil/1` liefern Gleitkommazahlen. Ergebnisse sind die der
C-Bibliothek des Hosts, die sich im letzten Bit von denen von OTP unterscheiden
können ([Unterschiede](differences.md)). Auf 64-Bit-Zielen berechnet
generierter Code `sqrt`, `floor`, `ceil` (LLVM-Intrinsics) und `exp`, `log`,
`log2`, `log10`, `sin`, `cos`, `pow` (dieselben Funktionen der C-Bibliothek,
ohne die Ersetzungen von LLVM aufgerufen) von Zahlenargumenten inline in eine
Gleitkommazelle; andere Operanden und nicht endliche Ergebnisse rufen das
Builtin auf, das auslöst.

## binary-Modul

Quelle: `runtime/src/builtins/binary/`. `library/stdlib/binary.erl` enthält die
Exporte von OTP 29; `replace/3,4` (einschließlich einer Fun als Ersetzung und
`{insert_replaced, ...}`) und `list_to_bin/1` sind Erlang über den Builtins,
jede andere Funktion ist ein Builtin:

- Muster sind ein nichtleeres Binary, eine nichtleere Liste nichtleerer
  Binaries oder ein kompiliertes Muster. Ein Treffer ist die am weitesten links
  liegende Position und dort das längste Muster; `matches/2,3` und
  `split/2,3` mit `global` nehmen nicht überlappende Treffer von links.
  `{scope, {Start, Length}}` begrenzt, wo Treffer beginnen und enden dürfen
  (eine negative Länge zählt rückwärts); `split/3` nimmt außerdem `global`,
  `trim` und `trim_all`.
- `compile_pattern/1` liefert `{bm, [Pattern]}` oder `{ac, Patterns}`, eine
  eigene Form von Clause (OTP: eine Referenz im Tupel,
  [Unterschiede](differences.md)).
- `part/2,3`, `bin_to_list/2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` und
  `decode_hex/1` folgen OTP; jedes falsche Argument (ein Bitstring, ein Bereich
  außerhalb des Subjekts, eine unbekannte Option) ist `badarg`.
- `referenced_byte_size/1` ist die eigene Größe des Binarys.
- Sie laufen bis zum Ende.

## maps-Modul

Quelle: `runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` und `from_keys/2` sind Builtins
  mit den Fehlern von OTP: eine Nicht-Map ist `{badmap, Map}`, ein fehlender
  Schlüssel von `update/3` `{badkey, Key}`, eine Schlüsselliste, die keine
  echte Liste ist, `badarg`. Schlüssel werden exakt gematcht (`1` und `1.0` sind
  verschiedene Schlüssel). `filter/2`, `map/2`, `foreach/2` und
  `update_with/3,4` sind Erlang in `library/stdlib/maps.erl`.
- `os:getenv/0` (Zeichenketten `"Name=Value"`; die Einträge `=C:` pro Laufwerk
  unter Windows werden weggelassen), `os:env/0` (Paare `{Name, Value}`),
  `os:putenv/2`, `os:unsetenv/1` (`badarg`, außer die Argumente sind
  Zeichenketten und der Name ist nicht leer und ohne `=`), `os:getpid/0` und
  `os:version/0` sind Builtins; `os:timestamp/0`, `os:system_time/0,1`,
  `os:perf_counter/0,1` und `os:getenv/2` sind Erlang über den Zeit-Builtins
  von `erlang` und `getenv/1`.

## Persistente Terme

Plan 11 step 41M2 (`runtime/src/builtins/persistent_term.cpp`) über der Tabelle
der Runtime ([Runtime](runtime.md#persistent-terms)). `put/2` und
`put_new/2` liefern `ok` (`put_new/2` eines gespeicherten Schlüssels ist `ok`
für einen exakt gleichen Wert, sonst `badarg`); `get/1` eines nicht
gespeicherten Schlüssels ist `badarg`, `get/2` liefert den Standardwert;
`get/0` listet jedes `{Key, Value}`; `erase/1` sagt, ob der Schlüssel
gespeichert war; `info/0` ist `#{count => N, memory => Bytes}` (die Wörter der
gespeicherten Kopien). Schlüssel werden exakt gematcht (`1` und `1.0`
unterscheiden sich). Jedes Lesen kopiert den Wert in den Heap des Aufrufers.

## unicode-Modul

Quelle: `runtime/src/builtins/unicode/`. `library/stdlib/unicode.erl` enthält
die Exporte und Typen von OTP 29; `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` und
`encoding_to_bom/1` sind Builtins, die Funktionen für Normalisierung,
Kategorien und Bezeichner bleiben Stubs; sie lassen sich nun über
[unicode_util](#unicode-util) schreiben, wenn ein Programm sie braucht.

- Kodierungen: `latin1`, `unicode`/`utf8`, `utf16` und `utf32`, standardmäßig
  Big Endian oder `{utf16 | utf32, big | little}`; alles andere ist `badarg`
  (`encoding_to_bom/1`: `function_clause`, wie OTP).
- Chardata ist ein Binary oder eine Liste, möglicherweise unecht mit einem
  Binary als Rest, aus Codepoints, Binaries in der Eingabekodierung und
  verschachtelten Chardata; aufeinanderfolgende Binaries werden als ein Strom
  dekodiert, sodass ein Zeichen zwei überspannen kann. Alles andere ist
  `badarg`.
- Ein Zeichen, das die Ausgabe nicht aufnehmen kann (ein ungültiger Codepoint
  oder eine ungültige Bytefolge, ein Code über 255 bei `latin1`-Ausgabe),
  beendet die Konvertierung mit `{error, Converted, Rest}`; eine Eingabe, die
  innerhalb eines Zeichens endet, mit `{incomplete, Converted, Rest}`. `Rest`
  hat die Form von OTP: der nicht konvertierte Teil der innersten Liste, die mit
  dem fehlschlagenden Element beginnt (ein Binary als sein nicht konvertiertes
  Suffix, allein, wenn es die oberste Ebene beendet), innerhalb des
  verbleibenden Rests jeder umschließenden Liste; aus einem Binary übertragene
  unvollständige Bytes kommen zuerst, und bei `latin1`-Ausgabe wird eine
  fehlschlagende Ganzzahl in eine Liste gepackt.
- `bin_is_7bit/1` ist false für alles außer einem Binary aus Bytes unter 128.

## code-Modul

Quelle: `runtime/src/builtins/code.cpp`. `library/kernel/code.erl` enthält die
Exporte und Typen von OTP 29; es gibt keinen Prozess `code_server`, und die
Abfragen zu geladenen Modulen antworten für das gelinkte Programm: Ein Modul ist
geladen, wenn das Programm es hat (kompilierter Code oder Runtime-Builtins).
`ensure_loaded/1` liefert `{module, M}` oder `{error, nofile}`,
`ensure_modules_loaded/1` `ok` oder `{error, [{M, nofile}]}`, `is_loaded/1`
`{file, preloaded}` oder `false`, `which/1` `preloaded` oder `non_existing`,
`module_status/1` `loaded` oder `not_loaded`, `all_loaded/0` und
`module_status/0` listen jedes Modul, `is_sticky/1` ist `false`. Ein
Modulargument, das kein Atom ist, ist `function_clause`. Codepfade und Laden
bleiben Stubs bis [step 71](../.agents/11-plan.md#step-71). Der Fehlerpfad von
OTPs `io_lib:format/2` (`code:ensure_modules_loaded/1`) löst nun das
ursprüngliche `badarg` aus.

## init-Modul

Quelle: `runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Eine
ausführbare Datei ist ein gestartetes System ohne Boot-Skript. Der Start
dekodiert die Befehlszeile einmal (`ProgramArguments`,
`runtime/src/startup/arguments.cpp`): die Argumente nach den Runtime-Optionen
sind sowohl das argv des Einstiegs mit Stelligkeit 1 als auch
`get_plain_arguments/0`. Es gibt keine Emulator-Flags; das einzige Flag ist
`home`, beim Start so gesetzt, wie OTPs `erlexec` es setzt (`HOME`; unter
Windows `HOMEDRIVE` und `HOMEPATH`, sonst `USERPROFILE`), daher ist
`get_argument(home)` `{ok, [[Home]]}`, `get_arguments/0` ist
`[{home, [Home]}]`, und jedes andere Flag ist `error`. `script_name/0` ist der
absolute Pfad der ausführbaren Datei mit Schrägstrichen. Diese vier sind
Builtins; der Rest ist Erlang:

- Antworten des gestarteten `init` von OTP: `get_status/0`
  `{started, started}`, `notify_when_started/1` `started`, `ensure_loaded/1`
  `not_allowed`, `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (wartet auf
  `{init, started}`); `get_configfd/1` und `set_configfd/2` halten ihre Werte in
  `persistent_term` unter `{init, configfd, Id}`;
- `script_id/0` ist `{"Clause", "29"}`;
- `stop/0,1` und `reboot/0` halten sofort an, mit den Statusregeln von OTP:
  eine nichtnegative Ganzzahl ist der Exit-Status, eine Byteliste der
  Halt-Slogan, jedes andere Argument `badarg`;
- abgelehnt: `boot/1` und `restart/0,1` lösen nach den Argumentprüfungen von
  OTP `notsup` aus (`restart/1` einer Liste, die nicht `[]` oder
  `[{mode, M}]` ist, ist `badarg`), `make_permanent/2` liefert
  `{error, notsup}` für gültige Namen und sonst `{error, badarg}`.

## unicode_util

Quelle: `library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`.
OTP erzeugt `unicode_util` während seines Builds (900 KB Erlang); Clause hält
die Daten in generierten C++-Tabellen (`unicode/tables.cpp`), die von den
Builtins seines privaten Moduls `clause_unicode` abgefragt werden (`table/1`,
`class/1`, `cases/1`, `flags/1`, `compose_pair/2`), und `unicode_util.erl`
beantwortet die Funktionen von OTP darüber mit den Ergebnisformen von OTP:

- `cp/1` nimmt den ersten Codepoint von Chardata wie OTP, behält
  Binary-Reste und flacht bis zu drei weitere Codepoints verschachtelter Listen
  ab; `{error, Rest}` bei ungültigem UTF-8;
- `lookup/1`, `category/1`, `get_case/1`, `spec_version/0` (`{17, 0}`),
  `pattern_whitespace/0`; `uppercase/1`, `lowercase/1`, `titlecase/1`,
  `casefold/1` bilden den ersten Codepoint ab (`{badarg, Rest}` bei ungültigem
  UTF-8); `is_wide/1`, `is_whitespace/1`, `is_other_id_start/1`,
  `is_other_id_continue/1`, `is_letter_not_pattern_syntax/1`;
- `gc/1`: erweiterte Graphem-Cluster nach UAX #29, mit der Regelreihenfolge von
  OTP (CR LF, Steuerzeichen, Latin-1-Schnellpfade, Prepend, Hangul-Silben,
  Paare regionaler Indikatoren, erweiterte Piktogramme und ZWJ-Folgen, indische
  Konjunkte) und seinen Ergebnisformen: ein Cluster ist ein Codepoint oder eine
  Liste, und der Rest bleibt die Chardata, aus der er stammt, wo OTP sie behält
  (`{error, Rest}` bei ungültigem UTF-8);
- `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` normalisieren den ersten Cluster:
  kanonische oder Kompatibilitätszerlegung mit algorithmischem Hangul, stabile
  kanonische Ordnung, dann Komposition über die Kompositionspaare.

`tools/unicode/generate.py` schreibt die Tabellen einmal pro Unicode-Update:
Groß-/Kleinschreibungsabbildungen, Kategorien (einschließlich der
Nachbarkategorien, die der Generator von OTP manchen nicht zugewiesenen
Codepoints gibt), Zerlegungen und die Eigenschaftsprädikate stammen aus den
Antworten des Host-OTP für jeden Codepoint (`tools/unicode/observe.escript`),
die Daten zu Graphemgrenzen, Emoji, indischen Schriften und Komposition aus den
Dateien der Unicode Character Database, die OTP 29 festlegt
(`lib/stdlib/uc_spec`, Unicode 17.0). Nur die generierten Tabellen werden
eingecheckt, mit dem Unicode-Urheberrechtshinweis, den die Unicode License v3
verlangt; normale Builds brauchen weder OTP noch die Datendateien. Der Test
`executables_unicode_tables` vergleicht Digests der Antworten von Ebene 0 und
Beispielblöcken der anderen Ebenen mit denen von OTP (alle 1,1 Mio. Codepoints
stimmten überein, als die Tabellen generiert wurden);
`executables_unicode_clusters` vergleicht Cluster und Normalformen
handverlesener Zeichenketten für jede Regel und einen mit Seed erzeugten
Durchlauf von 2000 zufälligen Zeichenketten.

## zlib-Modul

Quelle: `runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. Die
Runtime linkt zlib 1.3.2, das Release, das OTP 29 mitbringt
([zlib](compile.md#zlib)), sodass komprimierte Bytes für jede Stufe, Strategie,
Fenstergröße und jeden Flush denen von OTP gleichen. Ein Stream ist eine
[Handle-Referenz](runtime-heap.md#handle-references), deren Puffer den
`z_stream` hält; ihr Finalizer beendet eine aktive Sitzung, wenn die letzte
Kopie stirbt. Die privaten Builtins von `clause_zlib` (`open/0`, `close/1`,
`set_controller/2`, `deflate_init/2`, `inflate_init/3`, `deflate/3`,
`inflate/2`, die Aufrufe für Ende, Zurücksetzen, Parameter und Wörterbuch)
führen eine Operation über ihre gesamte Eingabe aus; `zlib.erl` behält die API
von OTP, Argumentfehler (`bad_compression_level`, `bad_windowbits`, ...),
Stream-Zustände (`not_initialized`, `already_initialized`,
`not_on_controlling_process`, ein geschlossener Stream, der eine neue
Initialisierung ablehnt), `eos_behavior` (`cut`, `reset`, `error`),
`data_error` aus `inflateEnd/1` vor dem Ende eines Streams, Wörterbücher
(`{need_dictionary, Adler}` ausgelöst oder geliefert), von `deflateParams/3`
für das nächste `deflate` behaltene Ausgabe sowie die Ganzpuffer-Funktionen
`compress/1`, `uncompress/1`, `zip/1`, `unzip/1`, `gzip/1`, `gunzip/1`
(verkettete Members). Ein gzip-Header nennt die Plattform, wie die zlib von
OTP ihn schreibt. `term_to_binary/2` mit `compressed` oder
`{compressed, Level}` komprimiert, wie OTP entscheidet (auf fünf Bytes weniger
als die Nutzdaten, sonst unkomprimiert), und `binary_to_term/1,2` entpackt
komprimierte Eingaben.

## re-Modul

Quelle: `runtime/src/builtins/re/`, `library/stdlib/re.erl`. Die Exporte und
Typen von OTP 29 über dem PCRE2-Release, das OTP mitbringt
([PCRE2](compile.md#pcre2)). `version/0` ist die Version und das Datum von
PCRE2 als Binary (`<<"10.47 2025-10-21">>`, wie unter OTP).

Ein kompiliertes Muster ist OTP 29s
`{re_pattern, CaptureCount, Unicode, UseCRLF, Ref}`, wobei `Ref` eine
[Handle-Referenz](runtime-heap.md#handle-references) ist, die den `pcre2_code`
besitzt; ihr Finalizer gibt den Code mit der letzten Kopie frei, und Prozesse
teilen ihn nur lesend. Wie in OTP ist die C-Seite klein und der Rest Erlang:

- `clause_re:compile/2` kompiliert ein Regex-Binary mit Kompilieroptionen
  (`{ok, Pattern}` oder `{error, {Message,
  Offset}}` mit der Meldung von PCRE2); `re:inspect/2` beantwortet `namelist`.
- `clause_re:run/4` ist das BIF `re:run` von OTP ohne seine Traps: ein Match
  eines Binary-Subjekts ab `{offset, N}`, wobei eine textuelle Regex zuerst
  kompiliert wird (`{error, {compile, Reason}}` mit `report_errors`), mit jeder
  Capture-Spezifikation (`all`, `first`, `all_but_first`, `none`,
  `all_names`, Nummern und Namen, doppelte Namen) und jedem Typ (`index`,
  `list`, `binary`), `match_limit` und `match_limit_recursion`
  (`{error, match_limit}` mit `report_errors`, sonst `nomatch`) sowie dem
  `badarg` von OTP für Kompilieroptionen oder andere Zeilenumbruchkonventionen,
  die mit einem kompilierten Muster angegeben werden.
- `re.erl` wandelt Unicode-Chardata in UTF-8 und Captures zurück in Zeichen
  um, führt `global`-Matches einzeln aus (nach einem leeren Match versucht es
  es verankert und nichtleer erneut, dann rückt es ein Zeichen vor, oder ein
  CR-LF-Paar bei CRLF-Zeilenumbrüchen, wie es `loopexec` von OTP tut) und
  implementiert `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`, eine Fun als
  Ersetzung) und `split/2,3` (`{parts, N}`, `trim`, `group`,
  `{return, Type}`) mit den Ergebnissen von OTP.

Exportierte Muster (`export`, `import/1`) werden nicht bereitgestellt.
`executables_re_module` vergleicht Kompilieren, Matching, Captures, globale und
Unicode-Matches, replace, split und Argumentfehler mit OTP.

## prim_eval

Quelle: `runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun,
Timeout)` ist das receive von `erl_eval`, dessen Klauseln eine Fun sind: es
durchsucht die Mailbox ab der ältesten Nachricht mit den Schritten eines
kompilierten [receive](processes.md#receive), den privaten Builtins von
`clause_receive` `peek/0` (`{message, M}` oder `none`), `skip/0`, `take/0`,
`restart/0` und `wait/1` (das Warte-Builtin kompilierten Codes, mit seinem
Timeout und `timeout_value`). Die erste Nachricht, für die `Fun` etwas anderes
als `nomatch` antwortet, wird entfernt und diese Antwort zurückgegeben;
`timeout`, wenn `Timeout` abläuft. Eine Ausnahme aus `Fun` lässt jede Nachricht
an ihrem Platz. `executables_prim_eval_receive` vergleicht
Mailbox-Reihenfolge, Timeouts, eine während des Wartens eintreffende Nachricht
und Ausnahmen mit OTP.

## atomics und counters

Quelle: `runtime/src/builtins/atomics.cpp`. Ein `atomics`-Array ist eine
[Handle-Referenz](runtime-heap.md#handle-references), deren Puffer ein
Vorzeichenwort und die 64-Bit-Werte hält, aktualisiert über `std::atomic_ref`
mit sequenziell konsistenten Operationen; es wird von jeder Kopie der Referenz
geteilt (Nachrichten, persistente Terme, `binary_to_term/1`, solange es lebt)
und mit der letzten freigegeben.

- `new/2` nimmt eine Stelligkeit von 1 bis 2^27 und Optionen
  `[{signed, Bool}]` (die letzte gewinnt); `get/2`, `put/3`, `add/3`,
  `add_get/3`, `sub/3`, `sub_get/3`, `exchange/3`, `compare_exchange/4` und
  `info/1` sind Builtins mit dem `badarg` von OTP für eine ungültige Referenz,
  einen ungültigen Index oder Wert. Gespeicherte Werte müssen in das Array
  passen (int64 oder uint64); Inkremente dürfen jede Ganzzahl von -2^63 bis
  2^64 - 1 sein und laufen über. `info/1` meldet OTPs `memory` von 40 + 8 Bytes
  pro Wert.
- `counters` ist Erlang (`library/erts/counters.erl`): `{atomics, Ref}` und
  `{write_concurrency, Ref}` umhüllen beide ein vorzeichenbehaftetes
  atomics-Array, sodass Zähler mit Write-Concurrency bei jedem Lesen exakt
  sind. `info/1` der letzteren meldet Größe und Speicher des Arrays.

## erts_internal

Quelle: `runtime/src/builtins/erts_internal.cpp`,
`library/erts/erts_internal.erl`. Die Funktionen, die `stdlib` und `kernel` von
OTP aufrufen:

- die Builtins `cmp_term/2` (exakte Termordnung: eine Ganzzahl vor einer
  gleichen Gleitkommazahl) und `map_next/3`, das Protokoll von
  `maps:iterator/1,2` und `maps:next/1`: ein ganzzahliger Pfad durchläuft die
  Map in Schlüsselreihenfolge und setzt über die verbleibenden Schlüssel fort,
  ein Schlüssellistenpfad nimmt seine Schlüssel der Reihe nach; ein
  Listenakkumulator erhält jede Assoziation ab dem Pfad;
- in Erlang `list_to_integer/2` und `binary_to_integer/2` (die Hilfsfunktionen
  von `string:to_integer/1` und der Konvertierungs-BIFs, `big` jenseits einer
  kleinen Ganzzahl der Wortgröße), `map_to_tuple_keys/1` (die sortierten
  Schlüssel einer beliebigen Map), `term_type/1`, die Funktionen `counters_*`
  für Write-Concurrency, `dynamic_node_name/0,1` über `persistent_term`;
- abgelehnt: `get_creation/0` ist `undefined` (keine Verteilung), und
  `map_hashmap_children/1` löst `badarg` aus (keine Map hat Hashmap-Knoten);
- nicht übernommen: die Gruppen für Verteilung, `.beam` und
  Emulator-Interna.

`erts_code_purger:purge/1` antwortet `{false, false}` und `soft_purge/1`
`true`, da gelinkter Code keinen alten Code hat; der Purger-Prozess und
`finish_after_on_load/2` warten auf [step 71](../.agents/11-plan.md#step-71).

## Portionen

Builtins, deren Arbeit mit einem Listen- oder
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
- `integer_to_list/1` einer kleinen Ganzzahl, `list_to_integer/1` einer kurzen
  dezimalen Zeichenkette und `atom_to_list/1` arbeiten auf Wörtern ohne
  Zwischenallokationen; andere Argumente nehmen die allgemeinen Pfade.
  `list_to_tuple/1` und `tuple_to_list/1` lesen die Zellen ihres Arguments als
  Wörter und bauen das Ergebnis, ohne die Elemente erneut zuzulassen, ebenso
  die Zeichenlisten dieser Konvertierungen.
- Listendurchläufe validieren die Liste einmal und lesen ihre Zellen als
  Wörter, ohne `Term` pro Zelle; `Left ++ Right` kopiert ein `Left` von
  höchstens 64 Zellen in einem Schritt ohne Portionszustand.

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

Builtins, die ihre eigenen Argumente prüfen, sind C++-Funktionen mit typisierten Parametern
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

## erlang-Modul

Der Compiler weiß aus zwei eigenen Quellen, welche `erlang`-Funktionen
existieren, nie aus Runtime-Code:

- `library/stdlib/erlang.terms`: die `erlang`-Exporte von OTP 29 als
  `{Name, Arity, Flags, Status}` (Flags `auto_import`, `guard`; Status
  `implemented`, `{planned, Step}` oder `{unavailable, Reason}`:
  `distribution`, `tracing`, `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` beobachtet das Host-OTP und
  behält die Status bei, die von Hand gepflegt werden.
- `tests/compiler/builtins/generate_erlang.py` macht daraus
  `library/stdlib/erlang.erl` (Clauses eigenes Stub-Modul) und
  `compiler/src/semantic/erlang_auto_imports.inc` (die Auto-Import-Liste von
  OTP). Der CTest `builtins_erlang_inventory` prüft, dass beide aktuell sind und
  dass `implemented` ein Katalog-Builtin bedeutet, eine Funktion, die der
  Compiler behandelt (`apply/2,3`, `is_record/1,2,3`), oder einen echten
  Erlang-Rumpf (`nif_error/1,2` lösen `error(Reason)` aus wie die Stubs von
  OTP); `builtins_erlang_freshness` (Label `host_otp`) vergleicht das Inventar
  mit dem Host-OTP.

Aufrufe:

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` und
  `-import(erlang, ...)` eines Builtins gehen wie bisher an das Builtin. Jeder
  andere Export kommt als Bibliotheksmodul `erlang` zum Programm (kompiliert wie
  `lists`); seine Stubs lösen `error({not_implemented, F, A})` mit
  `erlang:F/A` oben auf dem Stack aus, nur wenn sie aufgerufen werden. Ein Name,
  den das Modul nicht exportiert, ist `undefined function erlang:F/A`.
- Ein unqualifizierter Aufruf oder `fun F/A` eines Auto-Imports von OTP
  (`get(K)`, `fun put/2`), den das Modul weder definiert, importiert noch mit
  `-compile({no_auto_import, ...})` unterdrückt, erreicht `erlang:F/A` auf
  dieselbe Weise.
- Builtins sind sticky: Wenn sich das Modul `erlang` registriert, überspringt
  die Runtime jeden Export, dessen Namen ein registriertes Builtin hat, sodass
  `M:F(Args)` mit `M = erlang` und externe Funs das Builtin binden, nie einen
  Stub.

## Externes Termformat

Quelle: `erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Beide
Richtungen teilen den Codec von
[external_term.hpp](../abi/include/clause/abi/external_term.hpp) mit dem
Compiler und durchlaufen Terme mit expliziten Stacks, sodass
Verschachtelungstiefe keinen nativen Stack kostet.

- `term_to_binary/1,2` schreibt die Bytes von OTP für einen nicht verteilten
  Knoten (`nonode@nohost`, creation 0): UTF-8-Atome, `NEW_FLOAT`,
  `STRING_EXT` für Bytelisten bis 65535 Elemente, Maps in
  Schlüsselreihenfolge, Pids, Ports und Referenzen in ihren Formen `NEW_PID`,
  `V4_PORT` und `NEWER_REFERENCE` sowie `EXPORT_EXT` für `fun M:F/A`.
  Optionen: `{minor_version, 0..2}` (0 schreibt Gleitkommatext, 0 und 1
  Latin-1-Atome), `deterministic`, `compressed` und `{compressed, 0..9}`; alles
  andere ist `badarg`.
- `term_to_iovec/1,2` liefert die Kodierung als Liste aus einem Binary;
  `external_size/1,2` ihre exakte Größe.
- `binary_to_term/1,2` prüft jede Länge vor dem Allozieren gegen die Eingabe,
  ignoriert Bytes nach dem Term und liefert `badarg` für fehlerhafte Eingaben,
  ungültigen Atomtext, nicht endliche Gleitkommazahlen, wiederholte
  Map-Schlüssel und Identitäten eines anderen Knotens; `safe` lässt nur
  vorhandene Atome zu, `used` liefert `{Term, BytesRead}`. CTests:
  `executables_external_terms` (Bytes von OTP) und `builtins_etf_fuzz`
  (mutierte Kodierungen werden dekodiert oder lösen aus).

## Zeit

Quelle: `erlang/time.cpp`. Monotone Zeit ist die Steady Clock; `native` und
`perf_counter` sind Nanosekunden; Einheiten sind die Atome von OTP
(einschließlich der veralteten Pluralformen) oder eine positive Ganzzahl von
Teilen pro Sekunde. `convert_time_unit/3` rundet ab, wie OTP.
`unique_integer/0,1` schöpft aus einem programmweiten Zähler, sodass jeder Wert
positiv, eindeutig und steigend ist, unabhängig von den Optionen (`positive`,
`monotonic`; andere `badarg`). `now/0` ist die streng steigend gemachte
Systemzeit. Kalenderkonvertierungen lesen `{{Y, M, D}, {H, Mi, S}}` strikt (ein
ungültiges Datum oder eine ungültige Uhrzeit ist `badarg`) und verwenden die
lokale Zeitzone der C-Bibliothek.

## Systeminformationen

Quelle: `erlang/system.cpp`.

- `statistics/1`: `wall_clock` und `runtime` (`{Total, SinceLastCall}` in
  Millisekunden), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (ausgeführte Zeitscheiben). Clause
  führt keine Zähler für Reduktionen, Speicherbereinigung oder I/O:
  `reductions`, `exact_reductions`, `garbage_collection` und `io` melden
  Nullen.
- `system_info/1`: `otp_release` (`"29"`), `version` (`"17.1"`, das ERTS, dem
  Clause folgt), `machine` (`"Clause"`), `system_version`,
  `system_architecture`, `wordsize` und `{wordsize, internal | external}`,
  `process_count`/`process_limit`, `port_count`/`port_limit`,
  `atom_count`/`atom_limit`, `schedulers`, `schedulers_online`,
  `logical_processors*`, `thread_pool_size`, `smp_support`, `threads`,
  `build_type`, `heap_type`, `kernel_poll`, `debug_compiled`,
  `time_correction`, `time_warp_mode`, `endian`, `compat_rel`.
- `memory/0,1`: die Typen von OTP; `processes` ist das runtimeweite Konto des
  Prozessspeichers, `atom` eine Schätzung aus der Atomanzahl, `binary`, `code`
  und `ets` sind 0.
- Andere Elemente sind `badarg`.

## Hashing

Quelle: `erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` und `phash/2` hashen die Struktur eines Terms: exakt gleiche
  Terme hashen in jedem Programmlauf gleich (Atome nach Schreibweise, Maps in
  Schlüsselreihenfolge, `1` und `1.0` getrennt). `phash2/1` liegt in
  0..2^27-1, `phash2/2` in 0..Range-1, `phash/2` in 1..Range; Range ist
  1..2^32, sonst `badarg`. Die Werte sind Clauses eigene, nicht die von OTP.
- `md5/1` sowie `md5_init/0`, `md5_update/2`, `md5_final/1` liefern die
  Digests nach RFC 1321 (die Bytes von OTP) von Iodata. Der Kontext ist ein
  opakes 96-Byte-Binary in Clauses eigenem Layout; ein anderes Binary ist
  `badarg`.

## Laden von Code

Quelle: `erlang/code.cpp`. Jedes Modul ist in das Programm gelinkt und bleibt
geladen; [step 71](../.agents/11-plan.md#step-71) entscheidet über dynamischen
Code. `module_loaded/1` ist true für ein kompiliertes Modul oder ein Modul mit
Runtime-Builtins (`erlang`, `io`, `os`); `loaded/0` und `pre_loaded/0` listen
sie alle. `delete_module/1` liefert `undefined` für ein unbekanntes Modul und
löst für ein geladenes `error:notsup` aus. `prepare_loading/2` liefert
`{error, badfile}` (kein Binary ist Code, den das Programm laden kann), und
`finish_loading/1` akzeptiert nur `[]`. `get_module_info(M[, Item])` fährt als
`M:module_info(...)` fort.

## Quelltextaufteilung

- Die Runtime implementiert Builtins in `runtime/src/builtins/`. Ein großes
  Modul bekommt ein eigenes Unterverzeichnis mit einer Übersetzungseinheit pro
  Builtin-Familie: das Modul `erlang` liegt in `runtime/src/builtins/erlang/`
  (`core`: Typtests, Guard-BIFs, Operatoren, Auslösen, `display`, `halt`,
  `function_exported`; `term_access`; `lists`: `length`, `++`, `--`;
  `conversions`; `processes`: Identitäten, Starten, Nachrichten, Links,
  Monitore, registrierte Namen; `ports`; `dictionary`: das
  [Prozess-Dictionary](processes.md#process-dictionary);
  `binary_conversions` mit `conversion_text`, den Textregeln, die es mit
  `conversions` teilt; `term_encoding` und `term_decoding`: das externe
  Termformat; `time` und `timers`; `introspection` und `system`; `spawning`;
  `fun_info`, `hashing` und `md5`; `node` und `code`).
- Jede Familiendatei definiert ihre eigene `*_builtins()`-Tabelle, die in
  `production_builtins()` aufgeführt ist. Eine neue Familie fügt eine neue
  Datei und Tabelle hinzu, statt eine bestehende wachsen zu lassen; eine Datei
  über etwa 400 Zeilen wird nach Familien aufgeteilt, bevor sie weiter wächst.
  Spätere große Module folgen derselben Regel
  (`runtime/src/builtins/<module>/`).
- Kleine Module (`io`, `os`) und die Brückeninfrastruktur (`registry`,
  `invocation`, `bridge`, `portions`, `typed`, `text`, `float_text`,
  `output`) bleiben in `runtime/src/builtins/`.
- Der Compiler liest nie Runtime-Quelltexte: der Katalog
  `abi::v1::bridge_builtins` ist die einzige Liste, die beide Seiten teilen. Er
  bleibt ein einziges, nur anhängendes Array; seine Gruppenkommentare nennen
  die implementierende Datei.
