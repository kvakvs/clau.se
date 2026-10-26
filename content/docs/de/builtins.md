---
source: docs/builtins.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d6df02dea1e6270774c9766671b42d9c4b5af4090512da97273a2a4a3a58197f
translatedAt: 2026-10-26
---
# Builtins

Funktionen, die die Runtime in C++ implementiert: `erlang`-BIFs und Funktionen
anderer Module, deren OTP-Gegenstücke BIFs oder NIFs sind oder die Runtime
brauchen. Nach Modul, Funktion und Stelligkeit registriert; direkt, über
dynamische Aufrufe und als funs erreichbar. Die Quellen liegen in
`runtime/src/builtins/`; beobachtbare Abweichungen von OTP stehen unter
[Unterschiede](differences.md).

## Welche Builtins es gibt

- Katalog `abi::v1::bridge_builtins`
  ([builtins.hpp](../abi/include/clause/abi/builtins.hpp)): jedes Builtin, das
  Compiler und Runtime kennen; Gruppenkommentare nennen die implementierende
  Datei.
- Der Index eines Eintrags ist die Nummer, die erzeugter Code an die Brücke
  übergibt; der Katalog darf umgeordnet werden (Compiler und Runtime werden
  zusammen gebaut).
- Modul `erlang`: guard-BIFs, Operatoren als Funktionen, `display/1`, `halt/0,1`,
  Auslösen von Ausnahmen, Termzugriff, Konvertierungen, Prozesse, Ports,
  externes Termformat, Zeit, Systeminformationen, fun-Informationen, Hashing,
  Laden von Code.
- Andere Module: jeweils ein Abschnitt unten; private Hilfsmodule
  (`clause_unicode`, `clause_re`, `clause_zlib`, `clause_receive`, ...) dienen
  Erlang-Bibliothekscode.
- Der Status jeder Funktion (Builtin, Erlang-Rumpf, Stub) steht in
  `library/<application>/<module>.terms` ([Bibliothek](library.md#files)).
- Ein qualifizierter Aufruf eines Katalog-Builtins ruft die Brücke auf; jede
  andere `erlang`-Funktion erreicht das
  [Bibliotheksmodul erlang](#erlang-module).

## Wie Aufrufe sie erreichen

| Quelle | Weg |
| --- | --- |
| `abs(X)`, `X + Y`, `display`, `halt`, `error` | Inline-Code oder ein eigener Dienst |
| Katalog-Builtins ohne Inline-Dienst (`A -- B`, ...) | Wie eine Funktion betreten: `CLAUSE_builtin_frame_v1`, Argumente in Registern |
| Direkte Builtins (kein Trap, kein Warten, kein Zugriff auf einen anderen Prozess) | `CLAUSE_builtin_call_v1` liefert das Ergebnis |
| Schnelle Builtins (`length`, `binary_to_list`, `list_to_binary`, `iolist_to_binary`) | Begrenzter Schnellpfad (256 Zellen, 4096 Ergebnisbytes); sonst den Frame betreten |
| `A ++ B` | Kurzes echtes `A` inline kopiert; sonst betreten |
| `fun abs/1`, `fun erlang:'+'/2` | Externer fun `erlang:F/A`, an das Builtin gebunden |
| `M:F(Args)`, `apply/3`, `fun M:F/A` zur Laufzeit | Zuerst Modulexport, dann Builtin |

- `fun F/A` eines automatischen Imports, den das Modul weder definiert noch
  unterdrückt, ist `fun erlang:F/A`, wie in OTP. Nicht automatisch importierte
  Funktionen (`display/1`, `raise/3`, `make_tuple/2,3`, ...) brauchen das
  Präfix `erlang:`.
- Ein Builtin-Frame hat einen null-Rumpf: Das Betreten legt keinen Frame an,
  sodass ein Endaufruf zum Aufrufer des Aufrufers zurückkehrt.
- Fehler (`badarg`, `badarith`, `system_limit`, `{badmap, M}`, `{badkey, K}`)
  verwenden den geprüften Fehlerkanal.
- Termzugriff und Konvertierungen folgen den `badarg`-Regeln von OTP:
  - `setelement/3`: kleiner Index im Tupel; `make_tuple/2,3`: Größe
    0..16,777,215; `A ++ B`: echtes `A`; `A -- B`: echte Listen, `=:=`,
    O((n + m) log m).
  - `list_to_atom/1`: Das 256. Zeichen ist `system_limit`; eine volle
    Atomtabelle (`--max-atoms`) beendet mit 70.
  - `integer_to_list/2`, `list_to_integer/2`: Basis 2..36; `system_limit`
    jenseits von 1,262,611 Dezimalziffern.
  - `float_to_list/1,2`: OTP-Formate (`scientific`, `decimals`, `compact`,
    `short`); Text ab 256 Bytes ist `badarg`.
  - binary-Zwillinge teilen die Textregeln (`erlang/conversion_text.cpp`);
    Gleitkommatext braucht Ziffern auf beiden Seiten des Punkts.
- `function_exported/3`: wahr für einen Programmexport oder ein registriertes
  Builtin.

## Portionen

Builtins, deren Arbeit mit einer Liste oder einem binary wächst, laufen in
begrenzten Portionen, wie die trappenden BIFs von OTP.

- Jedes betretene Builtin verbraucht eine Reduktion; eine Portion erledigt
  `WORK_PER_REDUCTION` (16) Einheiten pro verbleibender Reduktion der
  Zeitscheibe.
- Verbleibende Arbeit: `ProcessStack::trap` benennt eine Fortsetzung;
  Zustandsterme bleiben in Registern (Wurzeln), nativer Zustand in `TrapState`.
  Der Prozess gibt ab und setzt später fort.
- Kann in einem Erlang-Export fortsetzen (`io` an ein Prozessgerät trappt nach
  `file:write/2`).
- Ergebnisse, Fehler und Reihenfolge entsprechen der vollständigen Ausführung.
  Host-Aufrufe (`call_builtin`) beenden jeden Trap sofort.
- Kleine Eingaben nehmen Schnellpfade auf Wortebene (`++` mit ≤ 64 Zellen,
  kurze `integer_to_list`, `list_to_integer`, `atom_to_list`,
  Tupelkonvertierungen).
- Trappend: `length/1` in einem Rumpf (guard bleibt inline), `++`, `--`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`.
- Alles andere, einschließlich `io:format` und Tupel-Builtins, läuft bis zum
  Abschluss.

## Typisierte Builtins

- C++-Funktionen `Result F(ProcessContext &, Parameters...)`, registriert mit
  `typed_entry<F>(module, name)`
  ([typed.hpp](../runtime/src/builtins/typed.hpp)).
- Der Adapter nimmt Argumentwörter an und konvertiert sie in Parametertypen;
  eine Abweichung ist `badarg`, bevor der Rumpf läuft. `Named<Role>` verhindert
  vertauschte Termparameter.
- Rückgabe eines Terms, `BuiltinResult` oder rohen `Word`, oder Auslösen von
  `BuiltinFailure`; andere C++-Ausnahmen werden `out_of_memory` oder
  `internal_error`.
- guard-BIFs, Operatoren und trappende Listen-Builtins sind `BuiltinBody`-Adapter
  auf Wortebene; häufige Konvertierungen lesen Zellen direkt
  (`TermAccess::trusted`).

## Registrierung

- `BuiltinRegistry`
  ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  im Besitz von `CodeServer`, bildet Modul/Funktion/Stelligkeit auf einen
  `BuiltinFrame` ab; `add` registriert einen Stapel vollständig oder gar nicht.
- Der Start registriert jede Tabelle von `production_builtins()`
  (`builtins/registry.cpp`), dann die der Runtime-Erweiterungen im
  Startdeskriptor (`RuntimeOptions::extensions`): die des Crypto-Archivs, wenn
  das Programm es einbindet ([Crypto-Modul](#crypto-module)).
- Sticky: Modulexporte mit dem Namen eines Builtins werden übersprungen, sodass
  Aufrufe nie einen `clause_builtin_placeholder`-Rumpf oder eine gleichnamige
  Benutzerfunktion erreichen.
- Der Host-Pfad `abi::v1::dispatch_builtin` ist getrennt
  ([Runtime](runtime.md#code-server-and-builtins)).

## Aufbau der Quelltexte

- Große Module erhalten ein Unterverzeichnis mit einer Datei pro Familie
  (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`, `zlib/`, ...); kleine
  bestehen aus einzelnen Dateien.
- Jede Familiendatei definiert eine in `production_builtins()` aufgeführte
  `*_builtins()`-Tabelle. Neue Familie = neue Datei; Dateien über etwa 400
  Zeilen aufteilen.
- Der Compiler liest nie Runtime-Quellen; der Katalog ist die gemeinsame Liste.

## Modul erlang

- `library/erts/erlang.terms`: OTP-29-Exporte als `{Name, Arity, Flags, Status}`
  (Flags `auto_import`, `guard`; Status `implemented` oder
  `{unavailable, Reason}`), Statuswerte von Hand gepflegt.
- `tests/compiler/builtins/generate_erlang.py` schreibt
  `library/erts/erlang.erl` (Stubs) und
  `compiler/src/semantic/erlang_auto_imports.inc`. CTests
  `builtins_erlang_inventory` (aktuell) und `builtins_erlang_freshness`
  (Host-OTP).
- Builtins haben Vorrang bei `erlang:F(...)`, `fun erlang:F/A`, `apply` und
  Importen; andere Exporte lösen beim Aufruf `{not_implemented, F, A}` aus,
  die für Tracing (`{unavailable, tracing}`: `trace*`, `system_monitor`,
  `system_profile`, `seq_trace*`, `dt_*`) `notsup`; unbekannte Namen sind
  `undefined function`.
- Extras (`executables_erlang_gaps`, `_packet_decoding`, `_suspension`):
  - `adler32`, `crc32` und `*_combine` über festgelegtem zlib; `iolist_to_iovec/1`.
  - `append_element/2`, `insert_element/3`, `delete_element/2`.
  - Cookies wie auf einem nicht lebenden Knoten; `halt/2` wie `halt/1`.
  - `send/3`, `spawn/2,4` und verwandte Funktionen
    ([Prozesse](processes.md#builtins)).
  - `decode_packet/3`: jeder OTP-Pakettyp und jede Option, OTP-http-Terme.
  - `suspend_process/1,2`, `resume_process/1`, `process_display/2`.

## Externes Termformat

`erlang/term_encoding.cpp`, `term_decoding.cpp`; mit dem Compiler geteilter
Codec ([external_term.hpp](../abi/include/clause/abi/external_term.hpp)),
explizite Stacks.

- `term_to_binary/1,2`: OTP-Bytes für `nonode@nohost`; Optionen
  `minor_version`, `deterministic`, `compressed`; lokale funs und native records
  sind `notsup`.
- `term_to_iovec/1,2`, `external_size/1,2`.
- `binary_to_term/1,2`: Längen vor der Allokation geprüft; `safe`, `used`;
  fehlerhafte Eingaben oder fremde Identitäten sind `badarg`.
- Die Stacks des Codecs und die kodierten Bytes von `term_to_binary` sind
  Puffer pro Thread, die zwischen Aufrufen erhalten bleiben (je bis zu 1 MB,
  `builtins/scratch.hpp`), sodass ein großer Term nicht bei jedem Aufruf neue
  Speicherseiten benötigt; kleine Ganzzahlen überspringen den allgemeinen
  Elementpfad in beiden Richtungen.
- CTests `executables_external_terms`, `builtins_etf_fuzz`.

## Zeit

`erlang/time.cpp`.

- Monotone Zeit ist die stetige Uhr; `native` sind Nanosekunden; OTP-Einheitenatome
  oder Ganzzahlen für Teile pro Sekunde.
- `convert_time_unit/3` rundet ab; `unique_integer/0,1` ein steigender Zähler;
  `now/0` streng steigend.
- Kalenderkonvertierungen sind strikt und verwenden die lokale Zeitzone der
  C-Bibliothek.
- Timer: [Prozesse](processes.md#timers).

## Systeminformationen

`erlang/system.cpp`, `erlang/system_flags.cpp`.

- `statistics/1`: `wall_clock`, `runtime`, Ausführungswarteschlangen,
  `context_switches`; Reduktions-, GC- und E/A-Zähler melden Nullen.
- `system_info/1`: `otp_release` `"29"`, `version` `"17.1"`, `machine`
  `"Clause"`, Anzahlen, Grenzen, feste Emulatorantworten; vollständige Liste
  in `system.cpp`.
- `memory/0,1`: OTP-Typen; `binary`, `code`, `ets` sind 0.
- `system_flag/2`: `backtrace_depth` (≤ 64) und `min_heap_size` wirken; die
  meisten anderen werden ohne Wirkung zurückgelesen; `cpu_topology`,
  `erts_alloc`, ... `badarg`.

## Hashing

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2`, `phash/2`: OTP-Werte für Atome, Zahlen, binaries, Listen,
  Tupel, maps; Pids, Ports, Referenzen und funs hashen auf Clause-eigene Weise.
- `md5/1` und `md5_init/update/final`: RFC 1321; der Kontext ist ein
  Clause-eigenes binary mit 96 Bytes.

## Laden von Code

`erlang/code.cpp`. Jedes Modul wird eingebunden und bleibt geladen;
dynamischer Code ist aufgeschoben.

- `module_loaded/1`, `loaded/0`, `pre_loaded/0` erfassen kompilierte und
  Builtin-Module.
- `delete_module/1` eines geladenen Moduls ist `notsup`; `prepare_loading/2`
  ist `{error, badfile}`.

## Modul lists

`builtins/lists/`. OTPs `lists` ist Erlang, daher lösen Builtins aus, was
seine Klauseln auslösen.

- Durchläufe (`sublist`, `flatten`, Zusammenführungen, `key*`, `zip`, `sort`,
  `usort`, ...) lösen wie OTP `function_clause` aus und bleiben ebenso
  bedarfsgesteuert (`sublist([a | b], 1)` ist `[a]`).
- `keymember/3`, `keysearch/3` sind BIFs: `badarg`-Regeln.
- Gleiche Elemente: Das erste gewinnt (`max([1, 1.0])` ist `1`).
- Funktionen mit fun-Argumenten und der Rest sind Erlang in
  `library/stdlib/lists.erl`; darin werden Builtins qualifiziert aufgerufen.
- Das `function_clause` eines Builtins hat keinen eigenen Frame.

## Modul math

`builtins/math.cpp`.

- Jede OTP-29-Funktion über der C-Bibliothek; Nichtzahlen `badarg`,
  nichtendliche Ergebnisse `badarith`.
- Die 64-Bit-Codeerzeugung bettet `sqrt`, `floor`, `ceil`, `exp`, `log*`,
  `sin`, `cos`, `pow` für Zahlen inline ein und behält rohe doubles.

## Modul binary

`builtins/binary/`; `replace/3,4` und `list_to_bin/1` sind Erlang.

- Muster: binary, Liste von binaries oder kompiliert; zuerst der am weitesten
  links liegende, dann der längste Treffer; `scope`, `global`, `trim`, `trim_all`.
- `compile_pattern/1` liefert `{bm, ...}` oder `{ac, ...}` ohne Referenz.
- Andere Funktionen folgen OTP; falsche Argumente `badarg`;
  `referenced_byte_size/1` ist die eigene Größe des binary.

## Modul maps

`builtins/maps.cpp`, `builtins/os.cpp`.

- Jede dokumentierte `maps`-Funktion; die Kernfunktionen sind Builtins mit
  OTP-Fehlern; Schlüssel stimmen exakt überein.
- Funktionen mit fun-Argumenten sind Erlang in `maps.erl`; Iteratoren verwenden
  [`erts_internal:map_next/3`](#erts-internal).
- map-Cursor durchlaufen flache maps und Baum-maps in Schlüsselreihenfolge;
  `clause_maps:entries/1` versorgt `maps:fold/3`.
- `os`: `type`, `getenv`, `env`, `putenv`, `unsetenv`, `getpid`, `version`
  sind Builtins; Zeitfunktionen sind Erlang; `os:cmd/1` verwendet einen Port.

## Sammlungen

`builtins/collections/`: jede dokumentierte Funktion von `ordsets`, `orddict`,
`proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue`, `array`.

- Listendurchläufe sind Builtins; Funktionen mit fun-Argumenten sind Erlang.
- Jedes Builtin durchläuft wie OTPs Klauseln: gleiche Ergebnisse, gleiche
  Fehler für jede Eingabe.
- `dict`, Version 1 von `sets`: OTP-records für lineares Hashing (gleicher
  Aufbau und gleiche Reihenfolge). Mengen der Version 2 sind maps.
- `gb_trees`, `gb_sets`: gemeinsame Implementierung balancierter Bäume; die
  Bäume gleichen denen von OTP.
- `queue`: OTP-Verschiebungen von `{Rear, Front}`; die Warteschlangen gleichen
  denen von OTP.
- `array`: OTP-29-record `#array{}`, genau wie in OTP geändert.

## Mengen von Mengen

- `sofs` (`builtins/sofs/`, `executables_sofs_sets`): OTP-records über
  sortierten Listen; Algebra, Relationen und Familien sind Builtins,
  Funktionen mit fun-Argumenten Erlang.

## Graph

- `graph` (`builtins/graph/`, `executables_graph_module`): OTPs `#graph{}`;
  Durchläufe und Pfade sind Builtins mit expliziten Stacks, Änderungen Erlang.

## Digraph

- `digraph`, `digraph_utils` (`builtins/digraph/`,
  `executables_digraph_tables`): die drei ETS-Tabellen von OTP; Änderungen in
  Erlang über `ets`; Pfadsuchen und Durchläufe sind Builtins, die Tabellen
  direkt lesen.

## ETS

`builtins/ets/` über den Tabellen der Runtime
([Runtime](runtime.md#ets-tables)).

- Builtins: Tabellenlebenszyklus, Einfügen/Nachschlagen/Löschen, Durchläufe,
  Zähler, `info`; Faltungen, `i/0..3`, `fun2ms/1` Erlang.
- Optionen und Zugriffsrechte wie in OTP; jeder Fehler `badarg`.
- Match-Spezifikationen ([Runtime](runtime.md#match-specifications)):
  `select*`, `match*`, `match_spec_*`, `erlang:match_spec_test/3`; Ergebnisse
  in Durchlaufreihenfolge, Fortsetzungen in OTP-Form.
- Tabellendateien: `tab2file`, `file2tab`, `tabfile_info` lesen und schreiben
  OTPs disk_log-Format in beiden Richtungen.
- `to_dets/2`, `from_dets/2` über `dets`; `table/1,2` in Erlang über
  `qlc:table/2` (standardmäßig select/3, `first_next`, `last_prev`,
  `{select, MS}`), Schlüsselsuche mit `==` in einem `ordered_set`, sonst `=:=`.
- CTests `executables_ets_*` führen OTP-Referenztests aus.

## Dets

`dets.erl` über `clause_dets` (`builtins/dets/`): OTP-Dateiformat der Version 9
Byte für Byte, gleiche Dateireihenfolgen.

- Implementierung (C++): Header, Buddy-Freilisten, lineares Hashing, Leeren des
  Schreibcaches, Scans, Massenaufbau.
- Prozesse (Erlang): `dets`-Server mit OTP-Registrierungstabellen; ein Prozess
  pro Tabelle mit Dateihandle, Cache, Fixierungen, Timern.
- Reparaturen und Fehler beim Öffnen wie in OTP; funs laufen dort, wo OTP sie
  ausführt.
- `table/1,2` in Erlang über `qlc:table/2` (standardmäßig select/3,
  `first_next`, `{select, MS}`); undokumentierte Helfer sind Stubs.
- CTest `executables_dets_tables` vergleicht mit OTP, einschließlich Datei-MD5s.

## Kodierungen

`builtins/encoding/`.

- `base64`: jede Funktion ein Builtin; Dekodierfehler entsprechen OTPs
  Zustandsautomaten.
- `json`: `decode/1`, `encode/1`, `format/1,2` und binary-Kodierer sind
  Builtins (Rückfall auf Erlang jenseits von 256 Verschachtelungsebenen);
  Callback-Dekodierer und Kodierer mit fun-Argumenten sind Erlang über
  `clause_json`-Scannern.

## POSIX-Meldungen

`builtins/erl_posix_msg.cpp`, `library/stdlib/erl_posix_msg.erl`.

- `erl_posix_msg:message/1` (OTPs internes Modul, das `file:format_error/1`
  benötigt): der englische Text eines POSIX-Fehlergrunds aus einer anhand von
  OTP 29 beobachteten Tabelle, `"unknown POSIX error: "` und der Name für ein
  anderes Atom, `badarg` für ein Nichtatom.

## Netzwerknamen

`builtins/net/`, `library/kernel/clause_net.erl`, `library/kernel/net.erl`.

- `clause_net:gethostname/0`, `getaddrinfo/2`, `getnameinfo/4`,
  `getservbyname/2`, `getservbyport/2` rufen die Systemfunktionen auf und
  antworten wie OTPs `prim_net`: Adressinformationen als maps aus `family`,
  `socktype`, `protocol` und einer Socket-Adresse, prim_net-Fehlernamen
  (`eservice`, `enodata`, ...), `{error, einval}` für einen unbekannten
  Dienst. `net` prüft Argumente mit OTP-guards und übergibt Text als
  UTF-8-binaries.
- `clause_net:inet_getifaddrs/0` listet Schnittstellen wie OTPs `inet_drv`
  für `inet:getifaddrs/0` (unter Windows aus `GetAdaptersAddresses` und
  `GetIfEntry` mit dessen Regeln für Flags, Präfixe und klassenbasierte
  Netzmasken; anderswo aus `getifaddrs(3)`, nach Namen und Flags wie
  `prim_inet` zusammengeführt). `clause_net:getifaddrs/0` listet sie wie
  `net:getifaddrs(all)` (Windows: Paketeinträge und sortierte Flags von OTPs
  `net`-Modul; anderswo prim_net-maps mit Paket- oder Link-Adressen); `net`
  filtert sie nach Familie, Flags oder fun. `if_names/0` ist die Index- und
  Namensliste, die sowohl `net:if_index2name/1` als auch `if_name2index/1`
  durchsuchen.
- `inet:getservbyname/2`, `getservbyport/2` und `gethostbyaddr/1` (ein
  `getnameinfo` mit `NI_NAMEREQD`) verwenden dieselben Builtins;
  Netzwerk-Namensräume antworten mit `{error, enotsup}`
  ([Unterschiede](differences.md)).
- `clause_net:dns_decode/1` und `dns_encode/1` (`builtins/net/dns.cpp`) sind
  der DNS-Nachrichtencodec von inet_res: OTP-Tupel `#dns_rec{}`,
  `#dns_header{}`, `#dns_query{}`, `#dns_rr{}`, `#dns_rr_opt{}` und
  `#dns_rr_tsig{}` mit inet_dns-Werten (symbolische Typen, Klassen und Opcodes,
  maskierte Namenslabels, LOC in Grad und Metern) und dessen `formerr`-Regeln
  (Kompressionszeiger rückwärts hinter den Header, Namen unter 255 Bytes,
  abgeschnittene Abschnitte nur mit dem TC-Bit); die Kodierung komprimiert Namen.

## Dateinamen

`builtins/filename/`.

- Pfadfunktionen sind Builtins, die OTPs Klauseln für die Host-Familie folgen
  (Unix oder Windows-Laufwerke und `//`-Namen); OTP-Ergebnisformen und Fehler.
- `absname/1,2`, `basedir/2,3` sind Erlang.

## Filelib

`builtins/filelib.cpp`, `library/stdlib/filelib.erl`, `library/stdlib/clause_filelib.erl`.

- `clause_filelib:escape/1` schreibt `@` und `\` so, dass `filename:split/1`
  Maskierungen erhält; `compile_part/1` kompiliert einen Teil eines zerlegten
  Musters (`?`, `*`, `**`, Zeichenmengen mit Bereichen, `{...}`-Alternativen,
  die den Rest ihres Teils einbeziehen) mit OTP-Eigenheiten (`**` nur als
  ganzer Teil, `]` zuerst oder als unteres Bereichsende,
  `{badpattern, missing_delimiter}`, ein `case_clause` für verschachtelte
  Alternativen); `matches/3` und `match/2` filtern Verzeichniseinträge.
- Der Durchlauf (wörtliche Präfixe, `..`, `**`, Existenzprüfungen) ist Erlang
  über `file` und `filename`, daher sind die Ergebnisse die von OTP, sortiert.

## Argparse

`builtins/argparse/`, `library/stdlib/argparse.erl`,
`library/stdlib/clause_argparse.erl`.

- `clause_argparse:validate/3` prüft einen Befehl wie OTPs `validate/2`, in
  OTP-Reihenfolge, und liefert das erste ungültige Feld, damit `argparse.erl`
  den Fehler auslöst.
- `parse/6` ist OTPs Parser als Schleife: Langformen (`--name=value`),
  Kurzformen, kombinierte Flags, angehängte Werte, negative Zahlen, `nargs`,
  Aktionen, Typen, Unterbefehle, Standardwerte; OTPs geworfene Fehler und
  Argument-maps.
- `help/4` baut OTP-Hilfelisten (Umbruch der Aufrufbeschreibung, Abschnitte,
  Vorlagen) über die Builtins von `io_lib`, `string` und `unicode`, sodass die
  Formen denen von OTP gleichen.
- funs werden von `argparse.erl` aufgerufen: Ein Builtin liefert eine Anfrage
  (`{custom, Fun, Arg}`, `{re, Arg, Re[, Options]}`, `{describe, Fun}`) und
  wird mit den bisherigen Antworten erneut aufgerufen, wobei es seinen
  Durchlauf wiederholt; jeder fun läuft einmal, in OTP-Reihenfolge.
- `run/3`, Handler und `format_error/1,2` sind Erlang.

## Qlc pt

`builtins/qlc_pt/`, `library/stdlib/qlc_pt.erl`,
`library/stdlib/clause_qlc_pt.erl`: der qlc-Parse-Transform zur Laufzeit, für
`qlc:string_to_handle/1,2,3` und `qlc:q/1,2` in ausgewertetem Code. Mit
`qlc.hrl` kompilierte Module erhalten weiterhin den Transform des Host-OTP
([Parse-Transforms](transforms.md)).

- `clause_qlc_pt:transform_expression/4` und `parse_transform/4` folgen
  `qlc_pt.erl` Funktion für Funktion: NodeInfo (eindeutige Annotationen und
  die von Prüfungen pro Knoten vermerkten Angaben, wie in OTP nach Slotnummer
  ab 1 gehalten), `no_shadows`, die Lint-Durchläufe zum Finden eingeführter
  Variablen und Generatorvariablen, Frames aus `#bind{}`-records für
  Konstanten- und Verbundspalten, Überspringen von Filtern,
  Match-Spezifikationen, Verbundgeneratoren, der erzeugte Zustands-fun,
  `Qdata`, `CodeF` (`term_to_binary(_, [compressed])` des ursprünglichen
  Codes) und der Options-fun. Zwischendaten sind Erlang-Terme in OTP-Form,
  sodass Sortierungen der Termordnung folgen; erzeugte Variablen sind
  Referenzen wie OTPs `make_ref/0`.
- Meldungen kommen vom C++-`erl_lint` (`Lint`), dem Pfad, den OTPs `qlc_pt`
  ohne verfügbaren Compiler nimmt; ein Lint-Absturz bei den erzeugten Formen
  ist der interne Compilerfehler, den auch OTPs Compiler meldet. records
  werden vom C++-`erl_expand_records` expandiert, guard-Tests von
  `is_guard_test/3`.
- Match-Spezifikationen führen `ms_transform` in Erlang aus: Das Builtin
  liefert `{try_ms, Forms}`, `qlc_pt.erl` antwortet mit dem Ergebnis von
  `try_ms/4` und ruft das Builtin mit den bisherigen Antworten erneut auf,
  wobei es seinen Durchlauf wiederholt; das Ergebnis ist
  `{done, Result, Transformed}` (ein transformiertes Modul erhöht die
  Backtrace-Tiefe auf 500, wie OTPs Transform).

## Qlc

`library/stdlib/qlc.erl`: jede Funktion in Erlang, da die Auswertung die funs
der Abfrage aufruft. Nach OTPs Dokumentation geschrieben; die Algorithmen sind
die von OTP, wo Antworten, ihre Reihenfolge oder `info/1,2` sie sichtbar machen.

- Handles behalten OTP-Tupel (`{qlc_handle, H}` mit `qlc_lc`, `qlc_table`,
  `qlc_append`, `qlc_sort`; `{qlc_cursor, {Pid, Owner}}`); kompilierte Abfragen
  sind das `{qlc_lc, Fun, Opt}` des Transforms mit `qlc_v1`- oder
  `simple_v1`-Daten.
- Vorbereitung: Nachschlagen am Schlüssel oder Index mit den wenigsten
  Schlüsseln (`max_lookup`), Match-Spezifikationen für unäre Durchlauf-funs
  und Listen, Nachschlageverbunde vor Mischverbunden bevorzugt, Eingaben von
  Mischverbunden sortiert, sofern nicht als sortiert bekannt, einfache
  Abfragen für `cache` und `unique`, zusammengefasst und nie für den ersten
  Generator.
- Auswertung: Antworten sind Listen mit `[]` oder einem Fortsetzungs-fun am
  Ende. `cache` verwendet `ets`-Tabellen (`qlc`, privat) oder eine Liste unter
  `{Ref, '$_qlc_cache_tmpfiles_'}`, jenseits von `max_list_size` in eine
  temporäre Datei verschoben; Mischverbunde legen große Klassen gleicher
  Schlüssel in einer Datei ab (`'$_qlc_merge_join_tmpfiles_'`); Sortierungen
  führen `file_sorter` aus, sobald Antworten `size` überschreiten. Temporäre
  Dateien heißen `qlc_<node>_<os pid>_<unique>` in `tmpdir` oder dem
  Arbeitsverzeichnis; `tmpdir_usage` meldet über `error_logger`.
- Bei der Auswertung gefundene Fehler (eine Nichtlisten-Antwort eines
  Durchlauf- oder Nachschlage-funs, Dateifehler, `{tmpdir_usage, _}`) werden
  mit einer internen Markierung geworfen und von `eval/2`, `fold/4`, `info/2`
  und Cursorn zurückgegeben, wie OTP die von `throw_error/1` geworfenen Fehler
  zurückgibt.
- `info/1,2` gibt die vorbereitete Abfrage mit `erl_pp:expr/3` aus,
  Tabellenbeschreibungen über ihre Format-funs (Zeichenketten mit
  `erl_eval:extended_parse_exprs/1` geparst).
- `string_to_handle/1,2,3` und `qlc:q/1,2` von `erl_eval` führen Clauses
  [`qlc_pt`](#qlc-pt) aus; `ets:table/1,2`, `dets:table/1,2` und `erl_eval`
  erreichen `qlc` über einen Laufzeitnamen, sodass nur Programme, die `qlc`
  benennen, es einbinden.
- CTest `executables_qlc_queries` vergleicht mit OTP: Sein Abfragemodul wird
  aus `qlc_queries.abstr` kompiliert, den Formen nach OTPs Transform, sodass
  der Test kein Host-OTP benötigt
  ([ausführbare Fälle](../tests/fixtures/executables/README.md)).

## Zeichenketten

`builtins/string/`: jede `string`-Funktion.

- Durchläufe folgen `string.erl` über `unicode_util:cp/1`, `gc/1`: OTPs
  Listenenden, Teil-binaries, gemischte Listen und Fehler.
- Durchläufe vom Ende verwenden Schleifen statt Rekursion.
- Funktionen zur Groß-/Kleinschreibung liefern die Eingabe, wenn sich nichts
  ändert; `equal/4` normalisiert über `unicode/normalize.cpp`.
- `to_integer/1`, `to_float/1`, Latin-1-API, `jaro_similarity/2` wie OTP.

## URI-Zeichenketten

`builtins/uri/`.

- `parse/1`: ein RFC-3986-Durchlauf in OTP-Reihenfolge, OTP-Fehlerfragmente.
- `recompose`, `normalize`, `resolve`, `percent_decode`, `quote` und
  Abfragefunktionen folgen OTPs Durchläufen und Fehlerstilen.
- `unicode/graphemes.cpp` zerlegt Cluster für Builtins, die sie benötigen.

## Zufallszahlen

`builtins/rand/`.

- `rand`: OTP-Zustände und Handler; jeder Algorithmus liefert OTPs Folgen.
  Bekannte Handler laufen in C++ (`clause_rand:*`); andere führen OTPs
  generisches Erlang aus.
- `splitmix64_next/1`, `exsp_*`, `mwc59*` sind Builtins.
- `tools/rand/` beobachtet OTP-Konstanten und erzeugt `tables.cpp`.
- `random`: `uniform_s/1` Builtin, Rest Erlang.

## Kalender

`builtins/calendar.cpp`.

- Builtins für gregorianische Arithmetik über beliebigen Ganzzahlen,
  OTP-Formeln und Fehler.
- Lokale/universelle Zeit und RFC 3339 sind Erlang in `calendar.erl`.

## Timer

`builtins/timer.cpp`.

- `seconds/1`, `minutes/1`, `hours/1`, `hms/3` und `now_diff/2` als
  Erlang-Arithmetik über beliebigen Zahlen: `badarith` für eine Nichtzahl,
  `function_clause` für ein `now_diff/2`-Argument, das kein 3-Tupel ist.
- Die Timer sind Erlang in `timer.erl`, ohne `timer_server`: Senden an eine
  lokale Pid verwendet `erlang:send_after/3`; jeder andere einmalige oder
  Intervalltimer ist ein Prozess, der einen Alias erzeugt, den sein `TRef`
  trägt und an den `cancel/1` sendet. Ein Intervalltimer überwacht den Prozess,
  für den er arbeitet, und endet mit ihm; `apply_repeatedly` wartet vor dem
  nächsten Takt auf das Ende jeder Aktion.

## Persistente Terme

`builtins/persistent_term.cpp` über der Tabelle der Runtime
([Runtime](runtime.md#persistent-terms)).

- `put/2`, `put_new/2`, `get/0,1,2`, `erase/1`, `info/0` mit OTP-Ergebnissen;
  Schlüssel stimmen exakt überein; Lesen liefert den gespeicherten Term ohne
  Kopie.

## Modul unicode

`builtins/unicode/`: jede Funktion ist ein Builtin.

- Kodierungen `latin1`, `utf8`, `utf16`, `utf32` (mit Byte-Reihenfolge);
  sonst `badarg`.
- Chardata: binaries, Codepunkte, verschachtelte Listen; aufeinanderfolgende
  binaries bilden einen Strom.
- Fehler liefern `{error | incomplete, Converted, Rest}` mit OTPs `Rest`-Form.
- Normalformen, `category/1`, `is_whitespace/1`, `is_id_*` behalten OTPs
  Abkürzungen.

## Modul code

`builtins/code.cpp`. Kein `code_server`-Prozess; Antworten beschreiben das
eingebundene Programm.

- `ensure_loaded/1`, `is_loaded/1` (`{file, preloaded}`), `which/1`
  (`preloaded`), `all_loaded/0`, `module_status/0,1`; `is_sticky/1` `false`.
- Codepfad (`library/kernel/code.erl`): ein persistenter Term, beim ersten
  Gebrauch so aufgebaut wie bei OTPs interaktivem Code-Server:
  Anwendungs-`ebin`-Verzeichnisse aus `ERL_LIBS`, die neueste Version jeder
  Anwendung in `lib_dir()`, dann `"."`. `root_dir/0` ist das Verzeichnis der
  ausführbaren Datei. Pfadänderungen normalisieren und prüfen Verzeichnisse
  wie OTP; `lib_dir/1`, `priv_dir/1` und `compiler_dir/0` benennen das erste
  Pfadverzeichnis `.../Name[-Vsn][/ebin]`.
- Ladeantworten für eingebundenen Code: Im Pfad gefundener Objektcode liefert
  das `{error, badfile}` von `erlang:prepare_loading/2`, fehlender Code
  `nofile`; `purge/1` `false`, `soft_purge/1` `true`, `delete/1` `false`;
  `get_doc/1` `{error, missing}`; keine Unterstützung für Testabdeckung.

## Io-Modul

`builtins/terminal.cpp`, `library/stdlib/clause_io.erl`.

- `clause_io:isatty/1` (`stdin`, `stdout`, `stderr`): eine Konsole unter
  Windows, anderswo `isatty(3)`; `window_size/1`: `{Columns, Rows}` eines
  Terminals (`GetConsoleScreenBufferInfo`, `TIOCGWINSZ`), sonst
  `{error, enotsup}`.
- Sie beantworten die Terminal-Flags von `io:getopts/0,1`, `io:columns/0,1`,
  `io:rows/0,1` und `io_ansi:enabled/0,1`.
- Der Standardeingabeserver (`io.erl`) liest Zeilen wie OTPs group: Eine
  `get_until`-Anfrage (`io:read/1,2`, `io:scan_erl_exprs/1..4`, Shell-Befehle)
  nimmt jeweils eine Zeile und schreibt ihre Eingabeaufforderung vor jeder
  weiteren Zeile erneut; ein CRLF-Zeilenende wird als LF gelesen.

## Os-Modul

`builtins/os.cpp`, `library/kernel/os.erl`.

- `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0`,
  `version/0` sind Builtins.
- `cmd/1,2`: Erlang über einem Spawn-Port mit OTP-Protokoll: Windows führt
  `COMSPEC /c Command` aus; anderswo liest `/bin/sh -s unix:cmd` den Befehl
  und gibt am Ende `^D` (und den Exit-Status) aus. `max_size`,
  `exception_on_failure`, UTF-8-Ausgabe zu Zeichen dekodiert.
- `find_executable/2` (Builtin): OTPs Suche über `PATH`-Elemente (Windows:
  zuerst das aktuelle Verzeichnis, `.exe`, `.com`, `.cmd`, `.bat`).
- `set_signal/2` (Builtin): `badarg` unter Windows wie bei OTP; anderswo
  `sigaction`; ein behandeltes Signal wirkt wie OTPs standardmäßiger
  `erl_signal_handler`.

## Modul init

`builtins/init.cpp`, `library/erts/init.erl`. Ein gestartetes System ohne
Boot-Skript.

- Befehlszeile einmal dekodiert (`startup/arguments.cpp`): einfache Argumente
  versorgen argv des Einstiegspunkts und `get_plain_arguments/0`.
- Einziges Flag ist `home`; `script_name/0` ist der Pfad der ausführbaren Datei.
- Andere Funktionen sind Erlang mit OTP-Antworten für ein gestartetes System;
  `script_id/0` ist `{"Clause", "29"}`.
- `stop/0,1`, `reboot/0` halten sofort an; `boot/1`, `restart/0,1`,
  `make_permanent/2` werden mit `notsup` abgewiesen.

## Atomics und Counters

`builtins/atomics.cpp`.

- Das `atomics`-Array ist eine
  [Handle-Referenz](runtime-heap.md#handle-references) über
  `std::atomic_ref`-Werten; Stelligkeit 1..2^27; OTPs `badarg`-Regeln und
  `info/1`.
- `counters` ist Erlang über einem vorzeichenbehafteten atomics-Array;
  Schreibparallelitätszähler sind exakt.

## Erts internal

`builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`: die von
`stdlib` und `kernel` aufgerufenen Funktionen.

- Builtins `cmp_term/2` und `map_next/3` (map-Iteratoren, Schlüsselreihenfolge).
- Erlang: `list_to_integer/2`, `binary_to_integer/2`, `map_to_tuple_keys/1`,
  `term_type/1`, Zähler, `dynamic_node_name`.
- `get_creation/0` `undefined`; Distribution und `.beam`-Gruppen abgewiesen.
- `erts_code_purger`: nichts zu bereinigen.

## Unicode util

`unicode_util.erl` über `clause_unicode`-Builtins und erzeugten Tabellen
(`unicode/tables.cpp`).

- `cp/1`, `gc/1` (UAX #29), `nfd/nfc/nfkd/nfkc`, Umsetzungen der
  Groß-/Kleinschreibung mit OTP-Formen; `spec_version/0` `{17, 0}`.
- `tools/unicode/generate.py` baut Tabellen aus Host-OTP-Antworten und
  Unicode-17.0-Daten; Builds benötigen keines von beiden.
- CTests `executables_unicode_tables`, `_clusters`, `_forms`.

## io_lib

`io_lib.erl`, `builtins/io_lib/`. OTPs tief verschachtelte Zeichenlisten,
aufgebaut in einer C++-Arena; `io:format` verwendet dieselbe Implementierung.

- Schreiber (`write.cpp`): `write`, `write_string`, `write_atom`, ...
  maskieren und begrenzen wie OTP.
- Formatimplementierung (`format_scan.cpp`, `format_build.cpp`): jede
  Steuersequenz, `chars_limit`, OTP-Gleitkommarundung; Fehler `badarg`.
- Pretty-Printer (`pretty*.cpp`): OTP-Layouts von `io_lib_pretty`.
  `clause_io_lib:pretty/2` ist `io_lib_pretty:print/2` für die Shell: `column`,
  `line_length`, `depth`, `line_max_chars`, `strings`, `encoding` und `records`,
  die `[{Name, [Field]}]`-Definitionen, die ein `record_print_fun` beantworten
  würde, sodass Tupel mit bekanntem Namen und bekannter Größe als
  `#Name{Field = Value, ...}` in OTP-Layout ausgegeben werden. CTest
  `executables_shell_session`.
- Scanner (`fread.cpp`): Steuersequenzen und Fortsetzungen von `fread/2,3`.
- Sammler (`collect.cpp`), Druckbarkeitsprüfungen, `indentation/2`.
- `maps_order`-funs: Das Builtin vermerkt maps und setzt in
  `clause_io_lib:sort_maps/6` fort, erneut mit sortierten Schlüsseln.
- Verschachtelung jenseits von 256 ist `system_limit`. CTests
  `executables_io_lib_text`, `_pretty_print`, `_fread_scanning`.

## Compiler-Tabellen

`builtins/front_end/`.

- `erl_internal`: BIF- und guard-Tabellen aus `erlang.terms`; Typ- und
  Operatortabellen; `add_predefined_functions/1`.
- `erl_anno`: OTP-Formen und Fehler.
- `erl_features`: Antworten von Clauses Compiler; `used/1` liest Deskriptoren
  oder `.beam`-`Meta`-Chunks.
- `records`: siehe [native records](native-records.md#reflection).
- CTests `executables_compiler_tables`, `_records_reflection`.

## Erl scan

`erl_scan.erl` über `clause_erl_scan:scan/6` (`front_end/scanner*.cpp`), ein
eigener Scanner nach OTPs `scan1/5`.

- OTP-Token, Annotationen, Sigils, dreifach zitierte Zeichenketten, Fehler und
  Reste.
- `reserved_word_fun`-, `text_fun`-Callbacks laufen in Erlang in Tokenreihenfolge.
- Fortsetzungen von `tokens/3,4` scannen das unfertige Token erneut.
- CTest `executables_erl_scan_tokens`.

## Erl parse

`erl_parse.erl` über `clause_erl_parse:parse/1` (`front_end/parser*.cpp`), ein
Parser mit rekursivem Abstieg für OTPs Grammatik.

- OTPs abstraktes Format und LALR-Fehlerverhalten (Stopptoken, Reihenfolge von
  Aktions- und Syntaxfehlern).
- `first_anno/1`, `last_anno/1` folgen der Reihenfolge von `map_anno/2`.
- `normalise/1`, `abstract/1,2`, `tokens/1,2` Builtins; Annotationsdurchläufe
  mit funs Erlang.
- CTest `executables_erl_parse_forms`.

## Erl eval

`erl_eval.erl` interpretiert das abstrakte Format in Erlang;
`clause_erl_eval`-Builtins behandeln Bitsyntaxsegmente
(`front_end/erl_eval.cpp`) und Musterabgleich (`front_end/eval_match.cpp`),
und `erl_eval:partial_eval/1` sowie `is_constant_expr/1` sind ebenfalls Builtins.

- `clause_erl_eval:match/4` ist `match1/5`: Literale, Variablen, Listen, Tupel,
  maps, native records, `"abc" ++ T`-Präfixe, Operatorkonstanten und
  binary-Muster, mit Ergebnis `{match, Bindings}`, `nomatch` oder `invalid`
  (von `erl_eval.erl` als `{illegal_pattern, Pattern}` ausgelöst).
  map-Schlüssel und Segmentgrößen sind guard-Ausdrücke, ausgewertet über den
  äußeren Bindungen (`front_end/guard_eval.cpp`, geteilt mit `epp`s `-if`);
  Bindungen werden wie in OTP als `orddict` oder map gelesen und gespeichert,
  einschließlich einer unsortierten Liste.
- `clause_erl_eval:bits_gen/4` nimmt das Muster eines binary-Generators vom
  Anfang der Bits; die Auswertungsschleife, guards (sie rufen den nichtlokalen
  Handler auf) und die comprehension-Durchläufe bleiben Erlang.

- `bit_type/2` bestimmt die Spezifizierer eines `bin_element` mit den
  Standardwerten und Fehlern von `erl_bits` (`front_end/bit_types.cpp`, geteilt
  mit `normalise/1`); `bit_segment/3` baut ein Segment (`badarg`,
  `system_limit`), `bit_take/3` nimmt eines vom Anfang eines bitstring
  (`nomatch`).
- Vom Auswerter erzeugte funs sind Closures über OTPs
  `{Anno, Bindings, Lf, Ef, UsedVars, Clauses}`-Umgebung, sodass `fun_data/1`
  und `erlang:fun_info/2` wie in OTP antworten; `fun M:F/A` mit Laufzeitteilen
  verwendet `erlang:make_fun/3`.
- `exprs/2`, `expr/2` und `check_command/2` prüfen Befehle wie OTP mit
  `erl_lint:exprs_opt/3`.
- CTest `executables_erl_eval_exprs`.

## Erl lint

Die Prüfungen von `erl_lint` sind Builtins (`front_end/lint*.cpp`), Klausel
für Klausel nach OTPs `erl_lint` geschrieben; `erl_lint.erl` behält, was funs
oder andere Module aufruft.

- Ein `Lint`-Objekt hält OTPs `#lint{}`-Zustand; Variablentabellen sind nach
  Namen sortierte Vektoren (OTPs orddicts), Mengen und maps, die OTP in
  Termordnung hält, sind geordnete Container, sodass Fehler die
  Einfügereihenfolge behalten und Warnungen wie in `return_status/1` sortieren.
- `module/1,2,3` laufen über `clause_erl_lint:module/4` mit den in Erlang
  nachgeschlagenen `behaviour_info/1`-Antworten der Behaviours
  ([Unterschiede](differences.md#erl_lint)); `format_error/1` formatiert die
  Antwort von `clause_erl_lint:format_spec/1` (einschließlich verschachtelter
  `io_lib:format/2`-Teile), sodass Ergebnisse OTPs Termen gleichen.
- Veraltungsangaben kommen aus OTPs `otp_internal`-Tabellen
  (`front_end/otp_obsolete.inc`, erzeugt von
  `tests/compiler/library/generate_obsolete.escript`).
- Die von den Prüfungen verwendeten `erl_eval:partial_eval/1` und
  `erl_bits:set_bit_type/2` sind C++ (`lint_eval.cpp`, `bit_types.cpp`).
- CTest `executables_erl_lint_checks`.

## Erl pp

Die Ausgabe von `erl_pp` ist ein Builtin (`front_end/pp*.cpp`),
`clause_erl_pp:print/2`, aus den zwei Durchläufen des früheren Erlang-Moduls
portiert; `erl_pp.erl` behält die Hooks und `legalize_vars/1`.

- Der erste Durchlauf wandelt eine Form in Layoutelemente einer Arena um
  (`pp_items`, `pp_exprs`, `pp_forms`, `pp_types`); der zweite ordnet sie
  anhand der Zeilenbreite an (`pp_layout`) und schreibt Atome, Zeichenketten,
  Zeichen und Werte über die C++-Schreiber von `io_lib`.
- Eine Form, die nur der Hook ausgeben kann, stoppt das Layout mit
  `{hook, Expr, Column, Precedence}`; `erl_pp.erl` ruft den Hook auf und gibt
  mit den bisherigen Antworten erneut aus, sodass jeder Hook einmal in
  OTP-Reihenfolge läuft.
- Präzedenzen und `erl_parse:abstract/2` kommen aus `erl_parse.cpp`.
- CTest `executables_erl_pp_forms`.

## Epp

Die `-if`- und `-elif`-Bedingungen von `epp` werden von einem Builtin
ausgewertet, `clause_epp:eval_if/1` (`front_end/epp_eval.cpp`), sodass ein
Programm, das Dateien vorverarbeitet, `erl_eval` nicht einbindet.

- Es wertet den guard-Ausdruck wie `erl_eval:exprs/3` ohne Bindungen aus:
  Literale, Listen, Tupel, maps und map-Aktualisierungen, binaries (Segmente
  über die Bit-Builtins von `clause_erl_eval`), Operatoren, bei denen
  `andalso`/`orelse` den Wert ihrer rechten Seite liefern, und Aufrufe von
  guard-BIFs (lokal automatisch importiert oder `erlang:`) über die
  guard-Tabelle der Match-Spezifikationen.
- Jeder Fehler (ungebundene Variablen, undefinierte records, ein auslösendes
  BIF, ein lokaler Aufruf) macht die Bedingung falsch, da `epp` ihn abfängt.
- `epp`, `file` und `erl_features` werden mit
  [strikter Lebendigkeit](compile.md#strict-liveness) kompiliert.

## Erl expand records

`erl_expand_records:module/2` ist ein Builtin (`front_end/expand_records.cpp`):
Die Expansion durchläuft Formen in C++ statt über eine große
Erlang-Klauselauswahl, sodass Programme, die sie aufrufen, keinen zusätzlichen
Code kompilieren.

- OTP-Durchlaufreihenfolge (binary-Segmente vom letzten zum ersten, beim
  Abgleich zuerst die rechte Seite) und `recN`-Nummerierung;
  `is_record/3`-guard-Tests werden zu Mustern.
- Filter von comprehensions sind guard-Tests nach den Regeln von `erl_lint`
  (`front_end/guard_tests.cpp`, mit den records und lokalen oder importierten
  Funktionen des Moduls).
- Optionen `dialyzer`, `expand_inits`, `[no_]strict_record_tests`, auch aus
  `-compile`-Attributen.
- CTest `executables_erl_expand_records_forms`.

## Modul zlib

`builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.

- Bindet zlib 1.3.2 wie OTP 29 ein ([zlib](compile.md#zlib)): gleiche Bytes.
- Ein Strom ist eine Handle-Referenz mit einem `z_stream`; `clause_zlib`-Builtins
  führen eine Operation über die gesamte Eingabe aus.
- `zlib.erl` behält OTPs API, Fehler, Zustände und Helfer für ganze Puffer.
- Die Kompression von `term_to_binary` folgt OTPs Größenregel.

## Zstd-Modul

`builtins/zstd/contexts.cpp`, `library/stdlib/zstd.erl`.

- Bindet zstd 1.5.7 wie OTP 29 ein ([zstd](compile.md#zstd)): gleiche Frames.
- Kontexte und Wörterbücher sind Handle-Referenzen mit den Objekten von
  libzstd; ein Kontext, der ein Wörterbuch referenziert, hält es am Leben.
  `clause_zstd`-Builtins spiegeln OTPs NIF: Ausgabestücke von
  `ZSTD_CStreamOutSize()` / `ZSTD_DStreamOutSize()` (ein Frame mit kleinerer
  Größenangabe wird in ein Stück dieser Größe dekomprimiert), Ergebnisse
  `{continue, Rest, Out}`, `{flush, Out}` und `{done, Out}`,
  Eigentümerprüfungen (`not_on_controlling_process`), Fehler
  `{badarg, {invalid_key | invalid_value, Term}}` und `{zstd_error, Name}`,
  boolesche Werte als `false` zurückgelesen, wie OTPs NIF sie liest.
- `zstd.erl` behält OTPs iodata-, Streaming- und Frame-Behandlung.

## ASN.1-Codec

`builtins/asn1/` in `clause_runtime`, `library/asn1/clause_asn1.erl`
([ASN.1](asn1.md)).

- `clause_asn1:encode/3` und `decode/3` nehmen den Schematerm des erzeugten
  Moduls, den Typnamen und den Wert oder die Bytes (ein binary oder eine
  iolist); `decode/3` liefert `{Value, Rest}`. Sie interpretieren das Schema
  wie der erzeugte BER-Code von asn1ct und `asn1rtt_ber` und scheitern mit
  denselben `exit`/`error`-Gründen, die der erzeugte Wrapper in
  `{error, {asn1, Reason}}` umwandelt.
- TLVs werden wie durch `asn1rt_nif` geparst (`tlv.cpp`: dessen
  Fehlerpositionen, Zwei-Byte-Tag- und Vier-Byte-Längengrenzen);
  `ber_decode.cpp`, `ber_constructed.cpp`, `ber_encode.cpp` und
  `ber_encode_constructed.cpp` enthalten die primitiven und konstruierten
  Typen, `values.cpp` die INTEGER-, REAL- und DER-`DEFAULT`-Vergleiche,
  `legacy.cpp` die alten `BIT STRING`-Formen.
- PER (`per.hpp`): `per_bits.cpp` Bitfelder, Längenangaben, ganze Zahlen und
  Zeichenketten mit ihrer Ausrichtung und ihren Fragmenten;
  `per_encode.cpp`/`per_decode.cpp` die primitiven Typen;
  `per_encode_constructed.cpp`/`per_decode_constructed.cpp` Sequenzen,
  Erweiterungszusätze, Auswahlen und offene Typen; `per_strings.cpp`
  `BIT STRING`-Werte. Eine PER-Dekodierung nimmt ein binary und liefert die
  ungelesenen Bits zurück.

## Öffentliche Schlüssel

`builtins/public_key/` in `clause_runtime`,
`library/public_key/clause_public_key.erl` ([public_key](public_key.md)):
die record-Durchläufe und Tabellen von OTPs `pubkey_translation` und
`pubkey_cert_records`, die `clause_public_key_codec` aufruft.

- `translate(decode | encode, Term)` (`translate.cpp`) durchläuft einen Term
  wie `pubkey_translation:decode/1` und `encode/1`: Die records
  `SubjectPublicKeyInfo_algorithm`, `DSA-Params`, `DSA-Sig-Value`,
  `OTPExtension`, `SingleAttribute`, `OneAsymmetricKey` (Version `v1`) und
  `EncryptionAlgorithmIdentifier` der erzeugten Module werden zu den in
  `public_key.hrl` dokumentierten und zurück; eine unechte Liste scheitert
  wie die comprehension mit `bad_generator`.
- `oid_name(Table, Oid)` und `name_oid(Table, Name)` (`tables.cpp`, Zeilen in
  `tables.inc`) schlagen in den Tabellen `public_key_algorithm` (Schlüsseltyp
  eines Algorithmus), `curve_type`, `named_curve`, `ml_dsa`, `ml_kem`,
  `slh_dsa` und `extension` (Typ einer Erweiterung) nach; `undefined`, wenn
  die Tabelle keine Zeile enthält, `badarg` für eine andere Tabelle.
- `asn1_module(Type)` benennt das erzeugte Modul, das `der_decode/2` und
  `der_encode/2` für einen Typ verwenden (`public_key:get_asn1_module/1`),
  `undefined` für einen Typ ohne solches Modul.

## Crypto-Modul

`builtins/crypto/` im separaten Archiv `clause_runtime_crypto`,
`library/crypto/crypto.erl` und `clause_crypto.erl`.

- Bindet OpenSSLs libcrypto ≥ 3.1.2 ein (festgelegt auf 4.1.0,
  [OpenSSL](crypto.md)); nur Programme, die `crypto` aufrufen (oder
  `--with-crypto` übergeben), binden das Archiv ein, dessen Eintrag
  `CLAUSE_crypto_extension_v1` der Startdeskriptor aufführt.
- `algorithms.cpp` hält OTPs Namenstabellen (Digests, Chiffren, MACs,
  Schlüsseltypen, Kurven, KEMs) mit ihren OpenSSL-Abrufnamen; der erste
  `crypto`-Aufruf lädt die Provider default, base und legacy und ruft jeden
  Digest, jede Chiffre und jeden MAC ab, wie OTPs NIF beim Laden; Kurven
  werden beim ersten `supports(curves)` geprüft (auf jeder ein Schlüssel
  erzeugt). `supports/0,1`, `hash_info/1`, `info/0` und `info_lib/0` melden,
  was die eingebundene libcrypto bietet.
- Hash-Zustände sind Handle-Referenzen mit einem `EVP_MD_CTX`;
  `hash_update/2` liefert wie OTP einen neuen Zustand über einer Kopie.
  MAC-Zustände besitzen einen `EVP_MAC_CTX`, den `mac_update/2` direkt
  fortschreibt. `crypto.erl` übergibt Texte über 20000 Bytes wie OTP in
  Stücken, sodass kein Builtin-Aufruf lange läuft.
- Fehler sind OTPs NIF-Fehler: `{badarg | notsup | error, #{c_file_name,
  c_file_line_num, c_function_arg_num}, Description}`, die `crypto.erl` mit
  `error_info` (`?nif_call`) in `{Class, {File, Line}, Description}` umwandelt;
  Beschreibungen und Prüfungen folgen OTP-Reihenfolge, Datei und Zeile sind
  die von Clause.
- Engines antworten wie ein OTP, dessen OpenSSL keine Engine-Unterstützung
  hat (`notsup`; OpenSSL 4 hat keine).
- Chiffren (`cipher.cpp`) folgen OTPs `api_ng.c`: `crypto_init/4`-Zustände
  besitzen einen gesperrten `EVP_CIPHER_CTX`, den `crypto_update/2` direkt
  fortschreibt; `crypto_final/1` füllt gemäß den Optionen auf (OTPs
  `undefined`, `none`, `zero`, `random`, `pkcs_padding`);
  `crypto_one_time/5` führt einen temporären Zustand aus. `crypto.erl`
  übergibt `crypto_update/2` Texte über 20000 Bytes in Stücken. AEAD
  (`aead.cpp`) folgt `aead.c` für GCM, CCM und ChaCha20-Poly1305; ein falsches
  Tag wird zu `error` entschlüsselt. `crypto.erl` führt die
  `rand`-Generatoren `crypto_aes` und `crypto_prng1` wie OTP aus, über den
  `exro928_*`- und `seed58/2`-Builtins von `rand`.
- FIPS (`fips.cpp`): Jeder Tabelleneintrag hält einen zweiten `fips=yes`-Abruf
  für den FIPS-Modus; ein Eintrag ohne diesen ist dort verboten (OTPs
  `*_FORBIDDEN_IN_FIPS`), entfällt aus `supports/1` und löst OTPs
  `notsup`-Beschreibungen aus. `enable_fips_mode/1` schaltet OpenSSLs
  Standardeigenschaften um; mit `--fips` gebaute Programme binden den Eintrag
  `CLAUSE_crypto_fips_extension_v1` des Archivs ein, dessen Start-Hook den
  Provider neben der ausführbaren Datei lädt ([FIPS](crypto.md#fips)).
- Öffentliche Schlüssel folgen OTPs `pkey.c`, `rsa.c`, `dss.c`, `eddsa.c`,
  `ec.c`, `ecdh.c`, `dh.c`, `evp.c` und `srp.c`: `crypto.erl` wandelt
  Ganzzahlen in binaries um (`format_pkey`, `nif_curve_params`), und die
  Builtins bauen OpenSSL-Schlüssel aus denselben `OSSL_PARAM`-Listen wie
  OTPs NIFs (`params.cpp`, große Zahlen in nativer Byte-Reihenfolge), mit
  OTP-Prüfungen, Beschreibungen und Argumentnummern. `pkey.cpp`: `sign/4,5`,
  `verify/5,6` (RSA mit PKCS #1, PSS, X9.31 und ohne Auffüllung, DSA, ECDSA,
  EdDSA, ML-DSA, SLH-DSA; `{digest, Digest}`), RSA-`public_encrypt/4` und
  seine drei verwandten Funktionen (PKCS #1, OAEP mit seinen Digests und
  seinem Label, ohne Auffüllung), `privkey_to_pubkey/2`. `keys.cpp`:
  Schlüsselerzeugung für RSA, DH, X25519/X448, Ed25519/Ed448, ML-DSA, SLH-DSA
  und ML-KEM, Schlüsselvereinbarung für DH und X25519/X448,
  `encapsulate_key/2`, `decapsulate_key/3`. `curves.cpp`: ECDH-Schlüssel und
  Schlüsselvereinbarung auf benannten oder expliziten Kurven, mit expliziten
  Parametern wiederholt, wenn OpenSSL OTPs Namen nicht kennt (wie OTPs
  `retry_without_name`), und `ec_curve/1`, dessen explizite Parameter aus
  den eingebauten Kurven der eingebundenen libcrypto statt aus OTPs
  `crypto_ec_curves`-Tabelle stammen (Byte für Byte dieselben Terme).
  `srp.cpp`: SRPs Formeln für große Zahlen; `crypto.erl` behält OTPs
  Multiplikator und Scrambler. OTP-Eigenheiten bleiben erhalten:
  `sign(dss, none, ...)` scheitert mit `"Bad digest type"`,
  `generate_key(dh, ...)` ignoriert einen angegebenen privaten Schlüssel,
  und ein RSA-Exponent des öffentlichen Schlüssels aus mehreren Bytes
  erreicht OpenSSL in nativer Byte-Reihenfolge.

## Modul re

`builtins/re/`, `re.erl` über dem gebündelten PCRE2
([PCRE2](compile.md#pcre2)).

- Kompiliertes Muster: OTP 29s `{re_pattern, ...}` mit einer Handle-Referenz.
- `clause_re:compile/2`, `clause_re:run/4` (ein Treffer, jede Capture-Option,
  OTP-Fehler).
- `re.erl`: Chardata-Konvertierung, `global`-Schleife, `replace`, `split`.
- `export`/`import/1` nicht verfügbar. CTest `executables_re_module`.

## Prim eval

`process/receive.cpp`, `library/erts/prim_eval.erl`.

- `prim_eval:'receive'/2` durchsucht das Postfach mit `clause_receive`-Builtins
  (`peek`, `skip`, `take`, `restart`, `wait`); die erste Antwort ungleich
  `nomatch` gewinnt.
- CTest `executables_prim_eval_receive`.
