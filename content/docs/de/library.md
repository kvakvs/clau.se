---
source: docs/library.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: eb1d55d20683cef87e3553554a2b837e023b35acb9de58cdad1cb868ec95d0d8
translatedAt: 2026-10-26
---
# Bibliotheksmodule

Clause liefert eigene Versionen der OTP-Module, die Programme aufrufen, in
Erlang nach dem dokumentierten Verhalten von OTP geschrieben (nicht aus
OTP-Quelltexten kopiert) über [Builtins](builtins.md) der Runtime, und
kompiliert sie mit den Programmen, die sie verwenden.

## Inhalt

Jedes bereitgestellte Modul exportiert die vollständige Liste von OTP 29 für
seinen Namen; sein Inventar `<module>.terms` ([Dateien](#files)) hält fest,
welche Funktionen implementiert und welche Stubs sind.

| Modul | Inhalt |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | Die gängigen Funktionen; Datenfunktionen wie `sublist/2,3`, `flatten/1,2`, `sort/1`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2` sind Runtime-Builtins; jede dokumentierte Funktion ist implementiert ([Modul lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Jede dokumentierte Funktion; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... sind Runtime-Builtins, Funktionen mit funs sind Erlang ([Modul maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Jede dokumentierte Funktion; Listendurchläufe sind Runtime-Builtins, Funktionen mit funs sind Erlang ([Sammlungen](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Jede dokumentierte Funktion; gregorianische Arithmetik als Runtime-Builtins, lokale Zeit und RFC 3339 in Erlang ([calendar](builtins.md#calendar)) |
| [`proc_lib`](../library/stdlib/proc_lib.erl), [`sys`](../library/stdlib/sys.erl) | Jede dokumentierte Funktion: Prozesserzeugung mit Vorfahren und initialen Aufrufen, synchrone Starts (`init_ack`, `init_fail`), Labels, `stop/1,3`, Absturzberichte und ihre Texte; das Systemnachrichtenprotokoll und Debug-Optionen (`trace`, `log`, `statistics`, `log_to_file`, installierte funs) mit den Formen der Debug-Listen von OTP |
| [`gen_server`](../library/stdlib/gen_server.erl), [`gen_statem`](../library/stdlib/gen_statem.erl), [`gen_event`](../library/stdlib/gen_event.erl), [`gen_fsm`](../library/stdlib/gen_fsm.erl), [`gen`](../library/stdlib/gen.erl) | Jede dokumentierte Funktion in Erlang über `proc_lib` und `sys`, mit den Nachrichten (`'$gen_call'` mit Alias-Tags, `'$gen_cast'`, ...), Callback-Ergebnissen und Aktionen, Sammlungen von Anfrage-IDs, Fehlertermen und Berichtstexten von OTP; `gen` enthält die gemeinsamen Teile |
| [`supervisor`](../library/stdlib/supervisor.erl), [`supervisor_bridge`](../library/stdlib/supervisor_bridge.erl) | Jede dokumentierte Funktion: Kindprozessspezifikationen und Fehler, Strategien, Neustartintensität, Regeln zum Herunterfahren, `simple_one_for_one`-Kindprozesse und automatisches Herunterfahren von OTP, als `gen_server` |
| [`logger`](../library/kernel/logger.erl), [`logger_formatter`](../library/kernel/logger_formatter.erl), [`logger_std_h`](../library/kernel/logger_std_h.erl), [`logger_filters`](../library/kernel/logger_filters.erl), [`logger_handler`](../library/kernel/logger_handler.erl) | Jede dokumentierte Funktion in Erlang: Primär-, Handler- und Proxy-Konfiguration mit den Prüfungen und Fehlertermen von OTP, Modulebenen, Prozessmetadaten, Filter, die `?LOG_*`-Makros aus [`kernel/include/logger.hrl`](../library/kernel/include/logger.hrl), Formatvorlagen und der alte Header, `logger_std_h` auf Geräten und Dateien mit Rotation, Komprimierung und `filesync/1`, `logger_disk_log_h` auf halt- und wrap-Disk-Logs (beide über [`clause_logger_h`](../library/kernel/clause_logger_h.erl), gemeinsame Handler-Optionen und Prüfungen von OTP). Der `logger`-Server ist Clauses [`clause_logger`](../library/kernel/clause_logger.erl), beim ersten Gebrauch mit dem Standard-Handler von OTP auf `standard_io` gestartet (die Umgebungsvariable `CLAUSE_LOGGER_TYPE=standard_error` verlegt ihn auf die Standardfehlerausgabe, wie es der Golden-Runner tut, um mit Goldens übereinzustimmen, die dort mit dem Handler von OTP erzeugt wurden); Anwendungsebenen benötigen `application` |
| [`disk_log`](../library/kernel/disk_log.erl), [`wrap_log_reader`](../library/kernel/wrap_log_reader.erl), [`clause_disk_log`](../library/kernel/clause_disk_log.erl), [`clause_disk_log_server`](../library/kernel/clause_disk_log_server.erl) | Jede dokumentierte Funktion in Erlang: halt-, wrap- und rotate-Logs, intern und extern, mit den Dateiformaten von OTP (Log-Köpfe, Eintragsrahmen mit MD5s großer Einträge, wrap-Index- und Größendateien, rotate-Archive), sodass Dateien byteweise denen von OTP entsprechen; ein Prozess pro Log mit Eigentümern, Nutzern, Benachrichtigungen, Blockierung mit eingereihten Anfragen, vorausschauender Protokollierung, einem nach Größe und Timer geleerten Schreibcache, Reparatur, nur lesbaren Chunks mit Zählung fehlerhafter Bytes; der Registrierungsserver `disk_log_server` mit den benannten Tabellen `disk_log_names` und `disk_log_pids`; `wrap_log_reader` über denselben Chunk-Leser |
| [`error_logger`](../library/kernel/error_logger.erl), [`error_logger_file_h`](../library/stdlib/error_logger_file_h.erl), [`log_mf_h`](../library/stdlib/log_mf_h.erl) | Jede dokumentierte Funktion: Nachrichten und Berichte als Log-Ereignisse mit den `error_logger`-Metadaten von OTP, Berichtshandler im Ereignismanager `error_logger`, der vom Logger-Handler `error_logger` gespeist wird, `logfile/1` im alten Berichtsformat, wrap-Dateien mit dem Index- und Datensatzformat von OTP |
| [`pg`](../library/kernel/pg.erl), [`data_publisher`](../library/kernel/data_publisher.erl) | Jede dokumentierte Funktion: Gültigkeitsbereiche als `data_publisher`-Server mit den ETS-Tabellen von OTP, Beitritte, Austritte, endende Mitglieder, Bereichs- und Gruppenmonitore; der Gültigkeitsbereich hat keine Gegenstellen |
| [`global`](../library/kernel/global.erl), [`global_group`](../library/kernel/global_group.erl) | Jede dokumentierte Funktion wie auf einem nicht verteilten Knoten: Namen (auch `{global, Name}` in den Behaviours), Sperren und Transaktionen über einen beim ersten Gebrauch gestarteten `global_name_server`; `global_group` ohne Gruppen; der Locker und die verteilten Interna sind abgelehnt |
| [`rpc`](../library/kernel/rpc.erl), [`erpc`](../library/kernel/erpc.erl) | Jede dokumentierte Funktion: Aufrufe auf diesem Knoten laufen in neu erzeugten Prozessen (`rex` startet beim ersten Gebrauch) mit den Ergebnissen und Fehlern von OTP; andere Knoten sind nicht erreichbar (`{badrpc, nodedown}`, `{erpc, noconnection}`) |
| [`net_adm`](../library/kernel/net_adm.erl), [`net_kernel`](../library/kernel/net_kernel.erl), [`auth`](../library/kernel/auth.erl), [`seq_trace`](../library/kernel/seq_trace.erl) | Die Antworten von OTP für einen nicht aktiven Knoten (`pang`, `ignored`, `#{started => no}`, `nocookie`); `net_kernel:start/1,2` und die Interna der Verteilung sind abgelehnt; `seq_trace` behält das Token jedes Prozesses ohne Ablaufverfolgung |
| [`trace`](../library/kernel/trace.erl), [`erl_tracer`](../library/erts/erl_tracer.erl) | Ablaufverfolgung wird nicht unterstützt: Jede `trace`-Funktion und der Standard-Tracer von `erl_tracer` (`enabled/3`, `trace/5`) lösen `notsup` aus, wie die Ablaufverfolgungsfunktionen von erlang ([Modul erlang](builtins.md#erlang-module)); `erl_tracer:behaviour_info/1` listet die Callbacks von OTP auf |
| [`error_handler`](../library/kernel/error_handler.erl) | Die Funktionen für undefinierte Aufrufe, direkt aufrufbar; die Runtime löst `undef` selbst aus und ruft sie nie auf; `breakpoint/3` ist abgelehnt (kein Interpreter) |
| [`timer`](../library/stdlib/timer.erl) | Jede dokumentierte Funktion ohne den Timer-Server von OTP: zeitgesteuertes Senden an lokale Pids über `erlang:send_after/3`, jeder andere Timer ein eigener Prozess, der über einen Alias in seinem `TRef` erreicht wird; die Umrechnungen und `now_diff/2` sind Runtime-Builtins ([timer](builtins.md#timer)) |
| [`filelib`](../library/stdlib/filelib.erl), [`clause_filelib`](../library/stdlib/clause_filelib.erl) | Jede dokumentierte Funktion: Platzhaltermuster werden von Runtime-Builtins mit den Regeln, Eigenheiten und Fehlern von OTP kompiliert und abgeglichen, Verzeichnisdurchlauf, Abfragen, `ensure_dir/1`, `ensure_path/1`, `fold_files/5,6`, `find_file/2,3`, `find_source/1,2,3` (`source_search_rules` von kernel oder die Standardwerte von OTP) und `safe_relative_path/2` in Erlang; auch die undokumentierten Formen mit einem Modul (`file`, `erl_prim_loader` oder einem anderen), `compile_wildcard/1` (Debug-Hilfe von OTP) ist ein Stub ([filelib](builtins.md#filelib)) |
| [`file_sorter`](../library/stdlib/file_sorter.erl) | Jede dokumentierte Funktion in Erlang: Die Läufe von OTP (`size` Bytes im Speicher sortiert), Zusammenführungen (`no_files` temporäre Dateien gleichzeitig, 16-KiB-Chunks, Datenströme nach ihren gepufferten Objekten und Dateinummern geordnet) und Prüfungen werden Schritt für Schritt nachvollzogen, sodass gleich vergleichende Terme wie in OTP ausgegeben und bei `unique` beibehalten werden; Formate `binary_term`, `binary`, `term` und fun, `header`, `compressed` (über die gzip-Schicht von `file`), `tmpdir`, Ein- und Ausgabe-funs, Fehlerterme von OTP |
| [`zip`](../library/stdlib/zip.erl) | Jede dokumentierte Funktion in Erlang, dem Archivaufbau von OTP Byte für Byte folgend (lokale und zentrale Header von UNIX 6.1, zusätzliche Felder für erweiterte Zeitstempel und UNIX-uid/gid, zip64 oberhalb von 4 GiB, 8-KiB-deflate-Blöcke mit vollständigen Flushes über `zlib`), sodass Archive denen von OTP entsprechen; Dateien oder binaries als Ein- und Ausgabe über die Ein- und Ausgabe-funs von OTP, Filter, `cwd`, `keep_old_files`, `skip_directories`, `foldl/3`, von einem verknüpften Prozess bediente `zip_open/1,2`-Archive, `t/1`, `tt/1`, Fehlerterme von OTP; die records aus [`stdlib/include/zip.hrl`](../library/stdlib/include/zip.hrl) |
| [`erl_tar`](../library/stdlib/erl_tar.erl) | Jede dokumentierte Funktion in Erlang, den Formatregeln von OTP Byte für Byte folgend: USTAR-Header, lange Namen in ein Präfix aufgeteilt oder in erweiterte pax-Header verschoben (ebenso lange oder Nicht-ASCII-Namen, Links und Eigentümernamen sowie für Oktaldarstellung zu breite Zahlen), Lesen von v7-, GNU- (lange Namen und Links, Sparse-Dateien), STAR-, USTAR- und pax-Archiven mit den Eigenheiten von OTP (Basis-256-Felder, pax-Zeiten), `compressed` über die gzip-Schicht von `file`, binaries als `ram`-Dateien gelesen, Geräte, `init/3`-I/O-funs des Nutzers, `max_size`, `keep_old_files`, `files`, `cwd`, `verbose`, Prüfungen unsicherer Pfade, Fehlerterme von OTP und `format_error/1` |
| [`zstd`](../library/stdlib/zstd.erl), [`clause_zstd`](../library/stdlib/clause_zstd.erl) | Jede dokumentierte Funktion: einmalige und fortlaufende Komprimierung und Dekomprimierung, Parameter, Wörterbücher (roh oder referenziert), Frame-Header und Wörterbuch-IDs, in Erlang über Runtime-Builtins, die libzstd-1.5.7-Kontexte wie das NIF von OTP halten ([zstd](builtins.md#zstd-module)); `file:open/2` akzeptiert `{zstd, Options}` |
| [`beam_lib`](../library/stdlib/beam_lib.erl), [`erl_abstract_code`](../library/stdlib/erl_abstract_code.erl) | Jede dokumentierte Funktion in Erlang, der Chunk-Verarbeitung von OTP folgend: IFF-Durchlauf mit den Fehlern von OTP, Atomtabellen in beiden Kodierungen, Symboltabellen, Attribute, Kompilierungsinformationen, Literale, Debug-Informationen und abstrakter Code über das Backend `erl_abstract_code`, Dokumentation (records aus [`kernel/include/eep48.hrl`](../library/kernel/include/eep48.hrl)), MD5s über die relevanten Chunks, Vergleichen und Bereinigen von Dateien, Verzeichnissen und Releases, gzip-komprimierte Beams, `build_module/1` und der Kryptoschlüsselserver mit Entschlüsselung von Debug-Informationen (über `crypto`, dynamisch aufgerufen: mit `--with-crypto` linken) |
| [`io_ansi`](../library/stdlib/io_ansi.erl) | Jede dokumentierte Funktion in Erlang: die virtuellen Terminalsequenzen von OTP 29 als die eingebauten ANSI-Sequenzen, die OTP ohne terminfo verwendet (terminfo-Abfragen antworten mit `{error, enotsup}`), `format/1,2,3` und `render/1,2` über `io_lib`, `fwrite/1,2,3,4` als `put_ansi`-Anfragen, die der Standardeingabeserver darstellt, `scan/1` und `enabled/0,1` aus dem Terminal-Flag des Geräts ([Modul io](builtins.md#io-module)) |
| [`win32reg`](../library/stdlib/win32reg.erl) | Jede dokumentierte Funktion: Parsen von Schlüsseln nach OTP (Wurzeln, absolute, relative und `..`-Pfade), aktueller Schlüssel, Ganzzahl-, Zeichenketten- und binary-Werte, Auflistungen und Löschungen über den Windows-Registry-Treiber ([die Registry](ports.md#the-registry)); andernorts `{error, enotsup}`, wie in OTP |
| [`argparse`](../library/stdlib/argparse.erl), [`clause_argparse`](../library/stdlib/clause_argparse.erl) | Jede Funktion: Validierung mit den Fehlern von OTP, Parsen (Optionen, Flags, `nargs`, Aktionen, Typen mit Auswahlwerten, Grenzen und regulären Ausdrücken, benutzerdefinierte Typen, Unterbefehle, Präfixe, Standardwerte) mit den Argument-maps und Fehlern von OTP, `help/1,2` mit Layout und Vorlagen von OTP, `run/3` mit jeder Handler-Form, als Runtime-Builtins, die Erlang zum Aufruf der funs veranlassen ([argparse](builtins.md#argparse)); ohne `progname` der eigene Name des Programms |
| [`escript`](../library/stdlib/escript.erl) | `create/2` und `extract/2` nach dem Abschnittsaufbau und Header-Lesen von OTP (Shebang-, Kommentar- und Emulatorargumentzeilen; Quelltext-, Beam- und Archivkörper über `zip`); `script_name/0` ist der Pfad der ausführbaren Datei; Ausführen von escripts (`start/0,1`, `parse_file/1`) ist abgelehnt |
| [`filename`](../library/stdlib/filename.erl) | Jede dokumentierte Funktion nach den Unix- und Windows-Regeln von OTP für den Host; Namensdurchläufe sind Runtime-Builtins, `absname/1,2` und `basedir/2,3` (aus `HOME`, den XDG-Variablen und `APPDATA`) sind Erlang ([filename](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Jede dokumentierte Funktion als Runtime-Builtin: Parsen nach RFC 3986 mit den Fehlerfragmenten von OTP, erneutes Zusammensetzen, Normalisierung, Auflösung, Prozentkodierung und form-urlencoded-Abfragen ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Jede dokumentierte Funktion mit iodata, Fehlern und Callback-Reihenfolge von OTP; `decode/1`, `encode/1`, `format/1,2` und die Binary-Escape-Funktionen sind Runtime-Builtins, Encoder und Formatierer mit funs sowie Callback-Decoder sind Erlang ([Kodierungen](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Jede dokumentierte Funktion mit Zuständen und Folgen von OTP; die Algorithmen von OTP laufen als Runtime-Builtins, Plug-in-Generatoren in Erlang ([Zufallszahlen](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Jede dokumentierte Funktion als Runtime-Builtin, das chardata wie `string.erl` von OTP durchläuft, sodass Ergebnisse die Formen von OTP behalten ([string](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Jede dokumentierte Funktion als Runtime-Builtin ([Kodierungen](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Jede dokumentierte Funktion über dem record von OTP 29; record-Operationen sind Runtime-Builtins, Folds und Mapfolds sind Erlang ([Sammlungen](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Jede dokumentierte Funktion über den Baum- und Warteschlangenformen von OTP; Operationen ohne funs sind Runtime-Builtins ([Sammlungen](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Jede dokumentierte Funktion über den records (Mengen der Version 1) und Maps (Version 2) von OTP; Operationen ohne funs sind Runtime-Builtins ([Sammlungen](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (Server der Standardeingabe oder eine geöffnete Datei), `fread/2,3` (eine `get_until`-Anfrage über `io_lib:fread/3`), `read/1..4`, `scan_erl_exprs/1..4`, `scan_erl_form/1..4`, `parse_erl_exprs/1..4`, `parse_erl_form/1..4` (`get_until`-Anfragen über `erl_scan:tokens/3,4`, von `erl_parse` geparst), `request/1,2`, `requests/1,2` (das I/O-Protokoll von OTP, [Dateien](ports.md#standard-io-and-files)), `getopts/0,1`, `setopts/1,2`, `columns/0,1`, `rows/0,1` (Terminalgröße über `clause_io`-Builtins), `get_password/0,1`, `write/1,2`; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` und `nl/0,1` sind Runtime-Builtins ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Schreib-, Prüf- und Sammelfunktionen, Format-Engine, Pretty Printer (`print/1,4`, `~p`, `chars_limit`) und Scanner (`fread/2,3`) als Runtime-Builtins in den tiefen Listenformen von OTP, `maps_order`-funs zum Sortieren von Schlüsseln in `clause_io_lib`; `get_until`, `format_prompt` und `write/3` sind Erlang ([io_lib](builtins.md#io_lib)) |
| [`sofs`](../library/stdlib/sofs.erl), [`clause_sofs`](../library/stdlib/clause_sofs.erl) | Jede Funktion; Datenoperationen sind Runtime-Builtins, Funktionen mit funs und die Digraph-Konvertierungen sind Erlang ([Mengen von Mengen](builtins.md#sets-of-sets)) |
| [`ets`](../library/stdlib/ets.erl) | Tabellen, Lesen, Schreiben, Durchläufe und Aktualisierungen als Runtime-Builtins über den Tabellen der Runtime; `foldl/3`, `foldr/3`, `i/0..3` und `fun2ms/1` in Erlang; Match-Spezifikationen (select-, match-, match_spec-Familien) als Builtins über dem Interpreter der Runtime, `match_spec_run/2`, `test_ms/2`, `repair_continuation/2`, `match_delete/2` und `init_table/2` in Erlang; Tabellendateien (`tab2file/2,3`, `file2tab/1,2`, `tabfile_info/1`) in Erlang über `file` und `clause_disk_log`; `to_dets/2` und `from_dets/2` in Erlang über `dets`; `table/1,2` in Erlang über `qlc:table/2` ([ets](builtins.md#ets)) |
| [`graph`](../library/stdlib/graph.erl) | Jede Funktion über dem record von OTP; Abfragen und Durchläufe sind Runtime-Builtins, Aktualisierungen sind Erlang ([graph](builtins.md#graph)) |
| [`digraph`](../library/stdlib/digraph.erl), [`digraph_utils`](../library/stdlib/digraph_utils.erl) | Jede Funktion über dem Drei-Tabellen-record von OTP; Aktualisierungen und Lesezugriffe sind Erlang über `ets`, Pfadsuchen und Durchläufe von digraph_utils sind Runtime-Builtins, die die Tabellen lesen, `subgraph/2,3` und `condensation/1` sind Erlang ([digraph](builtins.md#digraph)) |
| [`dets`](../library/stdlib/dets.erl), [`clause_dets`](../library/stdlib/clause_dets.erl) | Jede dokumentierte Funktion: Server- und Tabellenprozesse von OTP in Erlang über einer C++-Engine für das Dateiformat Version 9 von OTP, Dateien Byte für Byte wie von OTP geschrieben; `table/1,2` in Erlang über `qlc:table/2` ([dets](builtins.md#dets)) |
| [`ms_transform`](../library/stdlib/ms_transform.erl) | Jede Funktion in Erlang über dem abstrakten Format: `parse_transform/2` übersetzt literale funs, die in den Formen eines Moduls an `ets:fun2ms/1` und `dbg:fun2ms/1` übergeben werden, `transform_from_shell/3` die Klauseln einer Shell-fun, mit den Match-Spezifikationen, Verdeckungswarnungen und Fehlercodes von OTP. Ein Modul, das die Transformation zur Kompilierzeit verwendet, führt weiterhin `ms_transform` des Host-OTP aus ([Parse-Transformationen](transforms.md)) |
| [`qlc_pt`](../library/stdlib/qlc_pt.erl), [`clause_qlc_pt`](../library/stdlib/clause_qlc_pt.erl) | Die qlc-Parse-Transformation zur Laufzeit (in OTP undokumentiert): `transform_expression/2`, `transform_from_evaluator/2` und `parse_transform/2` als Runtime-Builtins mit dem erzeugten Abfragecode, den Nachrichten und Annotationen von OTP; `ms_transform` läuft auf Anfrage in Erlang ([qlc_pt](builtins.md#qlc-pt)). Kompilierte Module, die `qlc.hrl` einbinden, verwenden weiterhin die Transformation des Host-OTP ([Parse-Transformationen](transforms.md)) |
| [`qlc`](../library/stdlib/qlc.erl) | Jede Funktion in Erlang, nach der Dokumentation von OTP geschrieben: Abfrage-Handles kompilierter Abfragen (`qlc_lc`-Handles von OTP aus der Transformation), Listen, `table/2`-Tabellen, `append/1,2`, `sort/1,2` und `keysort/2,3`; Auswertung mit konstanten Nachschlagewerten, Match-Spezifikationen, Merge- und Lookup-Joins, `cache` (`ets`, `list` mit Auslagerung in temporäre Dateien), `unique`, Sortierung mit `file_sorter`, Cursor als Prozesse, `info/1,2` über `erl_pp`, `string_to_handle/1,2,3` über `qlc_pt`, Fehlerterme von OTP und `format_error/1`. Handles, Tabellen, Schlüssel im Prozesswörterbuch und temporäre Dateinamen entsprechen OTP. [`stdlib/include/qlc.hrl`](../library/stdlib/include/qlc.hrl) nennt die Transformation `qlc`, die auf dem Host-OTP läuft ([qlc](builtins.md#qlc)) |
| [`shell`](../library/stdlib/shell.erl), [`clause_shell`](../library/stdlib/clause_shell.erl), [`clause_shell_eval`](../library/stdlib/clause_shell_eval.erl), [`clause_shell_commands`](../library/stdlib/clause_shell_commands.erl), [`clause_shell_records`](../library/stdlib/clause_shell_records.erl) | Jede dokumentierte Funktion in Erlang, nach der Dokumentation von OTP geschrieben: die interaktive Shell auf der Standardeingabe ([interaktive Shell](#interactive-shell)): Eingabeaufforderungen, Banner, Verlauf (`e/1`, `v/1`, `h/0`), Bindungen, records (`rd`, `rr`, `rl`, `rp`, `rf`), an der Eingabeaufforderung definierte Funktionen, Typen und Specs, Ausnahmeberichte über `erl_error`, Ergebnisse wie in OTP ausgegeben (Tiefe 30, records), eingeschränkte Shells, `catch_exception/1` und die Einstellungsfunktionen |
| [`shell_default`](../library/stdlib/shell_default.erl), [`c`](../library/stdlib/c.erl) | Jede Funktion: die Befehle von `c` mit der Ausgabe von OTP (`i/0`, `regs/0`, `m/0,1`, `ls/0,1`, `flush/0`, `help/0`, ...); Kompilierung (`c/1,2,3`, `lc/1`, `nc/1,2`), `xm/1` und `y/1,2` melden den fehlgeschlagenen Aufruf wie OTP ohne compiler, tools oder parsetools; `h/1,2,3` finden keine Dokumentation in gelinktem Code; die `i`-Befehle des Debuggers melden die fehlende Anwendung |
| [`edlin`](../library/stdlib/edlin.erl), [`edlin_expand`](../library/stdlib/edlin_expand.erl) | `edlin:keymap/0` (die Tastenbelegung des aufrufenden Zeileneditors; außerhalb davon `undefined`); `edlin_expand:expand/1,2` in Erlang: Vervollständigung von Modulen, Funktionen (Stelligkeiten für `Mod:`, `fun Mod:Fun/`), BIFs, Shell-Befehlen, in der Shell definierten Funktionen, Schlüsselwörtern, Bindungen, record-Namen und -Feldern, map-Schlüsseln und Dateipfaden, mit den Abschnitten und alten Treffern von OTP; Argumente eines Aufrufs werden als `Mod:Fun/Arity`-Köpfe vorgeschlagen (gelinkter Code hat keine Spezifikationen) |
| [`shell_docs`](../library/stdlib/shell_docs.erl), [`clause_shell_docs_markdown`](../library/stdlib/clause_shell_docs_markdown.erl) | Jede Funktion in Erlang, nach der Dokumentation von OTP geschrieben: `render/2..5`, `render_type/2..5` und `render_callback/2..5` eines übergebenen `docs_v1`-Chunks (`application/erlang+html`, `text/markdown` wie in der Shell von OTP konvertiert, andere `text/`-Formate unverändert) mit Layout, Umbruch, Aufzählungszeichen und ANSI-Stilen von OTP, `normalize/1`, `validate/1`, `supported_tags/0`; identisch mit OTP über die 51.249 Darstellungen der eigenen Dokumentations-Chunks von OTP 29. Gelinkter Code hat keine eigenen Chunks (`code:get_doc/1`) |
| [`erl_parse`](../library/stdlib/erl_parse.erl), [`clause_erl_parse`](../library/stdlib/clause_erl_parse.erl) | Jede Funktion: `parse_form/1`, `parse_exprs/1`, `parse_term/1` sowie `parse/1` und `parse_and_scan/1` von yecc über einem Runtime-Parser mit dem abstrakten Format und den Fehlern von OTP; `normalise/1`, `abstract/1,2`, `tokens/1,2` und die Rangfolgetabellen als Builtins; Annotationendurchläufe und `format_error/1` in Erlang ([erl_parse](builtins.md#erl-parse)) |
| [`erl_eval`](../library/stdlib/erl_eval.erl), [`clause_erl_eval`](../library/stdlib/clause_erl_eval.erl) | Jede Funktion in Erlang über dem abstrakten Format: Bindungen als orddicts oder maps, Handler für lokale und nicht lokale Funktionen (Operatoren, BIFs und Fehler als `erlang:raise/3`-Aufrufe laufen über Letztere), interpretierte funs mit der Umgebung von OTP, comprehensions mit strikten und zip-Generatoren, `maybe`, native records, `receive` über `prim_eval`; Musterabgleich, Bitsyntaxsegmente und Konstantenfaltung sind Runtime-Builtins ([erl_eval](builtins.md#erl-eval)). `exprs/2` und `expr/2` prüfen einen Befehl mit `erl_lint:exprs_opt/3`; `qlc:q/1,2` einer Abfrage-Listen-comprehension läuft über `qlc:transform_from_evaluator/2` mit verborgenen lokalen Aufrufen, wie in OTP |
| [`erl_error`](../library/stdlib/erl_error.erl) | Jede Funktion in Erlang über `io_lib`: `format_exception/3,4` und die internen Formatierer (`format_exception/6,7,8`, `format_stacktrace/4,5`, `format_call/4,5`, `format_fun/1,2`) mit den Erläuterungen, Layouts, `error_info`-Callbacks und Optionen von OTP. Die eigenen Stacktraces von Clause haben keine Quellpositionen oder `error_info` ([Unterschiede](differences.md#errors-stack-traces-and-reports)), daher zeigen ihre Berichte beides nicht |
| [`erl_pp`](../library/stdlib/erl_pp.erl), [`clause_erl_pp`](../library/stdlib/clause_erl_pp.erl) | Jede Funktion; die Ausgabe ist ein Runtime-Builtin ([erl_pp](builtins.md#erl-pp)): Formen, Attribute, Typen und Specs, Funktionen, guards und Ausdrücke mit dem Layout (Zeilenbreite, Einrückung, Zeichenkettenteile, Rangfolgeklammern) und den Optionen von OTP; Hooks und `legalize_vars/1` laufen hier; identisch mit OTP über die Formen von 347 OTP-Quellen und Testsuiten sowie über 80 davon mit fünf Optionssätzen einschließlich Hooks |
| [`erl_lint`](../library/stdlib/erl_lint.erl), [`clause_erl_lint`](../library/stdlib/clause_erl_lint.erl) | Jede Funktion; die Prüfungen sind Runtime-Builtins ([erl_lint](builtins.md#erl-lint)) mit den Fehlern, Warnungen, Optionen und der Reihenfolge von OTP sowie den Texten von `format_error/1`; `behaviour_info/1` der Behaviours wird hier aufgerufen, und `is_guard_test/3` fragt seine fun zuerst nach den lokalen Aufrufen; identisch mit OTP über 481 OTP-Quellen und Testsuiten, 474 Ausschnitte aus Testsuiten und 816 Befehlsausdrücke |
| [`erl_expand_records`](../library/stdlib/erl_expand_records.erl) | `module/2` als Runtime-Builtin ([erl_expand_records](builtins.md#erl-expand-records)): Tupel-records zu Tupeloperationen expandiert, native records und importierte native records beibehalten, Aufrufe von Importen und BIFs mit ihrem Modul versehen, `is_record/3`-guard-Tests in Muster umgewandelt, mit den Optionen `dialyzer`, `expand_inits` und `[no_]strict_record_tests`; identisch mit OTP über die Formen von 347 OTP-Quellen und Testsuiten |
| [`epp`](../library/stdlib/epp.erl), [`clause_epp`](../library/stdlib/clause_epp.erl) | Jede Funktion in Erlang außer den `-if`-Bedingungen, die ein Builtin auswertet ([epp](builtins.md#epp)): ein Server pro geöffneter Quelle mit den Formen, Makros (Argumente, Überladung, `??Arg`, `?FUNCTION_NAME`, vordefinierte und solche aus der Option `macros`), Includes, Bedingungen, `-file`, `-feature`, `-error`/`-warning`, Dokumentationsdateien und Fehlern von OTP; Dateien werden vollständig gelesen und nach ihrem Kodierungskommentar dekodiert. Identisch mit OTP über 1.110 `parse_file`/`scan_file`-Aufrufe auf OTP-Quellen und Testsuiten. `-include_lib` findet Header bis `code:lib_dir/1` nur über den Include-Pfad |
| [`erl_scan`](../library/stdlib/erl_scan.erl) | Jede Funktion: `string/1,2,3` und die wiedereintrittsfähigen `tokens/3,4` über einem Runtime-Scanner mit den Tokens, Annotationen, Optionen, Callbacks und Fehlern von OTP; Zugriffsfunktionen und `format_error/1` in Erlang ([erl_scan](builtins.md#erl-scan)) |
| [`erl_internal`](../library/stdlib/erl_internal.erl), [`erl_anno`](../library/stdlib/erl_anno.erl) | Jede Funktion als Runtime-Builtin: die BIF-, guard-, Typtest- und Operatortabellen, vordefinierten Funktionen und Annotationen von OTP ([Compiler-Tabellen](builtins.md#compiler-tables)) |
| [`records`](../library/stdlib/records.erl), [`erl_features`](../library/stdlib/erl_features.erl) | Reflexion von native records, Laufzeitdefinitionen und kompilierte Definitionen mit gefalteten Standardwerten ([native records](native-records.md#reflection)); die Features von OTP 29 und die, mit denen jedes Modul kompiliert wurde ([Compiler-Tabellen](builtins.md#compiler-tables)) |
| [`binary`](../library/stdlib/binary.erl) | Jede Funktion; `replace/3,4` und `list_to_bin/1` in Erlang, die anderen Runtime-Builtins ([Modul binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Jede Funktion als Runtime-Builtin ([Modul math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Jede Funktion als Runtime-Builtin: Konvertierungen, `bin_is_7bit/1`, Byte Order Marks, Normalisierungsformen, Kategorien und Bezeichnereigenschaften ([Modul unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Jede Funktion über erzeugten Tabellen, die chardata-Durchläufe als Runtime-Builtins ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Jede Funktion außer `import/1`, über PCRE2 ([Modul re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Jede dokumentierte Funktion: Dateien öffnen, lesen, schreiben, positionieren und schließen (auf Datenträger, `compressed` oder im Speicher mit `ram`), positioniertes Lesen und Schreiben, `truncate/1`, `advise/4`, `allocate/3`, ganze Dateien lesen und schreiben, `consult/1`, `eval/1,2`, `script/1,2` und ihre `path_`-Formen mit `path_open/3` (die Datei wird vollständig gelesen und nach ihrem Kodierungskommentar dekodiert, standardmäßig UTF-8, wie es `epp:set_encoding/1` in [`clause_epp`](../library/stdlib/clause_epp.erl) tut, dann Form für Form mit den Ergebnissen und Fehlern von OTP gescannt), Dateiinformationen und ihre Änderungen (`write_file_info/2,3`, `change_*`), Verzeichnisoperationen über den Dateitreiber, `sendfile/2,5` als der in Chunks arbeitende Rückfallpfad von OTP und `format_error/1` ([Dateien](ports.md#standard-io-and-files)) |
| [`erl_posix_msg`](../library/stdlib/erl_posix_msg.erl) | Das interne Modul von OTP für `file:format_error/1`: `message/1` als Runtime-Builtin ([POSIX-Meldungen](builtins.md#posix-messages)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl), [`clause_socket`](../library/kernel/clause_socket.erl), [`clause_socket_options`](../library/kernel/clause_socket_options.erl) | Sockets über Socket-Ports, mit ihren Optionen, Statistiken, Statusangaben und Auflistungen ([Sockets](ports.md#sockets)); `inet:get_rc/0` aus `clause_inet_config` |
| [`socket`](../library/kernel/socket.erl) | Jede dokumentierte Funktion in Erlang über den Socket-Treiber-Ports ([Sockets](ports.md#sockets)): `{'$socket', Ref}`-Handles, die ein `clause_socket_registry`-Prozess und eine Tabelle halten (Eigentümer, Zustände, Zähler, Metadaten, Monitore, Auflistungen), open/bind/listen/accept/connect, send/sendto/sendmsg/sendv/sendfile/sendmmsg, recv/recvfrom/recvmsg/recvmmsg mit den Fehlern für unvollständige Daten von OTP, `nowait` als Abschlussnachrichten unter Windows und select-Nachrichten andernorts, `cancel/2`, die Optionsnamen und Fehler für ungültige Werte von OTP, `info/0,1`, `i/0,1,2`, `supports/0,1,2`; SCTP-Aufrufe lösen `notsup` aus und Schnittstellenanfragen werden abgewiesen, wie in OTP unter Windows |
| [`gen_sctp`](../library/kernel/gen_sctp.erl) | Jede dokumentierte Funktion: kein SCTP, daher antworten `open/0,1,2` nach den Optionsprüfungen von OTP mit `{error, eprotonosupport}`, und die anderen sehen einen geschlossenen oder fremden Socket; `error_string/1` hat die Texte von OTP |
| [`inet_res`](../library/kernel/inet_res.erl), [`clause_inet_config`](../library/kernel/clause_inet_config.erl) | Jede dokumentierte Funktion in Erlang: der DNS-Client von OTP über `gen_udp` und `gen_tcp` (Wiederholungen, alternative Nameserver, EDNS, Kürzung über TCP, servfail-Wartezeiten, Fehler von OTP, Suchlisten, CNAME-Ketten und hostents) mit Nachrichten, die der DNS-Codec von `clause_net` kodiert und dekodiert ([Netzwerknamen](builtins.md#network-names)); die Resolver-Konfiguration, wie OTP sie auf einem nicht verteilten Knoten lädt (keine unter Windows; andernorts `resolv.conf` und die hosts-Datei) |
| [`net`](../library/kernel/net.erl), [`clause_net`](../library/kernel/clause_net.erl) | Jede dokumentierte Funktion: Rechner-, Adress- und Dienstauflösung sowie Schnittstellenlisten als Runtime-Builtins mit den Ergebnissen von prim_net, die Filter in Erlang; keine Netzwerk-Namensräume ([Netzwerknamen](builtins.md#network-names)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Clauses eigenes: das Protokoll des Socket-Treibers, das die drei obigen Module gemeinsam nutzen |
| [`os`](../library/kernel/os.erl) | `cmd/1,2` über einen Port mit dem Shell-Protokoll von OTP, `max_size` und `exception_on_failure`; Abfragen zu Umgebung, Zeit und Version, `find_executable/1,2` und `set_signal/2` als Builtins ([Modul os](builtins.md#os-module)) |
| [`code`](../library/kernel/code.erl) | Abfragen geladener Module ohne Code-Server; der Code-Pfad in einem persistenten Term mit den Pfadänderungen von OTP, `lib_dir`/`priv_dir`-Abfragen, `where_is_file/1`, `all_available/0`, `clash/0`; Antworten zum Laden für gelinkten Code ([Modul code](builtins.md#code-module)) |
| [`application`](../library/kernel/application.erl), [`application_controller`](../library/kernel/application_controller.erl) | Jede dokumentierte Funktion: Laden, Schlüssel, Umgebungen, Starts mit Abhängigkeiten und Startphasen, Stopps, Berechtigungen und Neustarttypen mit den Fehlern und Berichten von OTP, über einen beim ersten Gebrauch gestarteten Controller und [`clause_application_master`](../library/kernel/clause_application_master.erl) ([Anwendungen](#applications)); Release-Verwaltung, Booten und verteilte Steuerung sind abgelehnt |
| [`erlang`](../library/erts/erlang.erl) | Erzeugte Stubs jedes `erlang`-Exports von OTP 29; Katalog-Builtins haben Platzhalterrümpfe, `nif_error/1,2` haben Rümpfe, die anderen lösen beim Aufruf `{not_implemented, F, A}` aus ([Modul erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Die Antworten eines gestarteten Systems; `boot/1`, `restart/0,1` und `make_permanent/2` abgelehnt ([Modul init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Jede Funktion als Runtime-Builtin ([persistente Terme](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Jede Funktion ([atomics und counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Was `stdlib` und `kernel` aufrufen; die Gruppen Distribution, `.beam`, Emulator und Purger-Prozess zurückgewiesen ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Dateiabfragen über `file`; Laden und Archive zurückgewiesen ([Dateien](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Jede Funktion über das festgelegte zlib ([Modul zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` über die Schritte eines kompilierten receive ([prim eval](builtins.md#prim-eval)) |
| Die ASN.1-Module von `public_key` (`'OTP-PKIX'`, `'PKIX1Explicit-2009'`, ...) und [`public_key.hrl`](../library/public_key/include/public_key.hrl) | Beim Bauen aus [`library/public_key/asn1/`](../library/public_key/asn1) nach `library-asn1/public_key/` im Build-Baum erzeugt ([public_key](public_key.md)) |
| [`public_key`](../library/public_key/public_key.erl), [`clause_public_key_codec`](../library/public_key/clause_public_key_codec.erl), [`clause_public_key_keys`](../library/public_key/clause_public_key_keys.erl), [`clause_public_key`](../library/public_key/clause_public_key.erl) | Anwendung `public_key` (mit [`public_key.app`](../library/public_key/public_key.app)): DER- und PEM-Kodierung, PEM-Verschlüsselung, private PKCS-#8-Schlüssel jedes Typs und Zertifikate in den Formen plain und otp über den erzeugten Modulen ([public_key](public_key.md#functions), [öffentliche Schlüssel](builtins.md#public-key)); Schlüssel, Signaturen, RSA-Verschlüsselung, Schlüsselerzeugung und -vereinbarung, Zertifikatsignierung über `crypto` (`clause_public_key_keys`, [Schlüssel](public_key.md#keys-and-signatures)); Validierungsfunktionen sind Stubs |
| [`clause_asn1`](../library/asn1/clause_asn1.erl) | Der Codec, den die von clau aus ASN.1-Spezifikationen erzeugten Module aufrufen ([ASN.1-Codec](builtins.md#asn1-codec), [ASN.1](asn1.md)); die Anwendung `asn1` von OTP (`asn1ct`, `asn1rt_nif`) wird nicht bereitgestellt |
| [`crypto`](../library/crypto/crypto.erl), [`clause_crypto`](../library/crypto/clause_crypto.erl) | Anwendung `crypto` (mit [`crypto.app`](../library/crypto/crypto.app)), über libcrypto von OpenSSL im Krypto-Runtime-Archiv ([Modul crypto](builtins.md#crypto-module), [OpenSSL](crypto.md)): die Algorithmenlisten des gelinkten OpenSSL (`supports/0,1`, `hash_info/1`, `info/0`, `info_lib/0`), Digests und Hash-Zustände, HMAC/CMAC/Poly1305 und MAC-Zustände, `pbkdf2_hmac/5`, `hash_equals/2`, `exor/2`, `mod_pow/3`, Chiffren und ihre Zustände (`crypto_init/3,4`, `crypto_update/2`, `crypto_final/1`, `crypto_get_data/1`, `crypto_one_time/4,5`, `cipher_info/1`), AEAD (`crypto_one_time_aead/4,6,7`, `crypto_one_time_aead_init/4`), starke Zufallszahlen und die `rand`-Plugins `crypto`, `crypto_cache`, `crypto_aes` und `crypto_prng1`, Fehlerterme von OTP; Engines abgewiesen (`notsup`); FIPS-Modus wie bei OTP umschaltbar oder mit `clau --fips` festgelegt; öffentliche Schlüssel (`sign/4,5`, `verify/5,6`, RSA-Verschlüsselung, `generate_key/2,3`, `compute_key/4`, `privkey_to_pubkey/2`: RSA, DSA, DH, ECDSA/ECDH auf benannten und expliziten Kurven, EdDSA, X25519/X448, ML-DSA, SLH-DSA, SRP), `ec_curve/1` und `ec_curves/0` (explizite Parameter aus der gelinkten libcrypto), ML-KEM (`encapsulate_key/2`, `decapsulate_key/3`) |

Ergebnisse und Fehlergründe entsprechen OTP 29, einschließlich der
Fehlerformen der Erlang-Implementierungen von OTP (`lists:map(F, x)` ergibt
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`,
`lists:seq(1, 10, 0)` `badarg`) und seiner BIFs (`lists:member/2`,
`lists:keyfind/3`, `lists:reverse/2`, die `maps`-Funktionen: `badarg`,
`{badmap, M}`, `{badkey, K}`). `lists:member/2` vergleicht mit `=:=`,
`lists:keyfind/3` mit `==`. `lists:sort/1` ist ein stabiles Runtime-Builtin
([Vergleich und Ordnung](terms.md#comparison-and-order)). Stacktraces nennen
die Bibliotheksfunktionen, nicht die von OTP.

## Interaktive Shell

`shell:start_interactive/0,1` startet die Erlang-Shell auf den Standardströmen,
und `clau --shell` linkt sie in eine ausführbare Datei, deren Einstiegspunkt
sie ist, sofern `--entry` keinen anderen nennt
([Kompilierung](compile.md#options)). Der Prozess `clause_shell` übernimmt die
Rolle von `user_drv` in OTP: Er gibt die Systemversion aus, startet den Server
von `shell` und startet einen neuen, wenn eine Shell endet (`exit().`). Der
Server liest jeden Befehl über den Standardeingabeserver von `io`, wobei die
Eingabeaufforderung für jede weitere Zeile eines Befehls erneut ausgegeben
wird, behält den Verlauf und startet den Auswerter, der jeden Ausdruck mit
`erl_lint` prüft, records expandiert und ihn mit `erl_eval` auswertet.
Ergebnisse werden mit den records der Shell über den Pretty Printer der
Runtime ausgegeben (`clause_io_lib:pretty/2`, [io_lib](builtins.md#io-lib)).
Das Eingabeende beendet das Programm nach
`*** Terminating erlang (nonode@nohost)` mit Status 0.

Befehle rufen Module über ihren Namen auf, daher muss ein Programm, das die
Shell startet, jeden Export aufrufbar halten: `--shell` behält sie bei
([Erreichbarkeit von Exporten](executables.md#export-liveness)) und linkt jedes
Bibliotheksmodul; ein ohne diese Option gebautes Programm erreicht nur die
Module, die es nennt. Eingabezeilen werden so gelesen, wie das Terminal sie
liefert, und vom Terminal selbst bearbeitet: Es gibt keine `edlin`-
Zeilenbearbeitung, Verlaufstasten oder Tab-Vervollständigung
([Unterschiede](differences.md#interactive-shell)).

## Wie Programme sie erhalten

- Nennt ein Batch (positionelle Eingaben oder ein Projektziel) ein Modul mit
  einem literalen Atom — `M:F(...)` mit literalem `M`, `fun M:F/A`,
  `apply(M, F, Args)` mit literalem `M`, `-behaviour(M)` oder
  `-import(M, ...)` —, das keine Eingabe definiert, sucht der Compiler `M.erl`
  in den Anwendungsverzeichnissen der Bibliothek, dann in den
  `source_search_paths` des Projekts
  ([Projekte](projects.md#paths-and-discovery)), parst und kompiliert die erste
  gefundene Datei in den Batch und wiederholt das für die Module, die die
  hinzugefügten Dateien nennen
  ([zu welchem Modul ein Name aufgelöst wird](#which-module-a-name-resolves-to)).
  Ein Aufruf `M:F(...)` eines Katalog-Builtins (`io:format/2`, `os:type/0`)
  nennt kein Modul. `--print-inputs` listet die Eingaben auf, die dadurch
  hinzukommen.
- Die Bibliothek ist `library/` des Build-Baums, relativ zu `clau` gefunden wie
  das Runtime-Archiv, mit einem Verzeichnis pro OTP-Anwendung (`erts`,
  `kernel`, `stdlib`), danach `library-asn1/` des Build-Baums mit den Modulen,
  die der Build aus den ASN.1-Spezifikationen der Bibliothek erzeugt
  ([public_key](public_key.md)). `-include_lib("kernel/include/logger.hrl")`,
  `file.hrl`, `eep48.hrl` und `inet.hrl` (`#hostent{}`) werden zu den eigenen
  Headern der Bibliothek aufgelöst, sofern das Projekt keine Anwendung
  `kernel` nennt; `stdlib/include/` `zip.hrl`, `qlc.hrl`, `ms_transform.hrl`
  (nennt die Transformation, die auf dem Host-OTP läuft:
  [Transformationen](transforms.md)) und `assert.hrl`, sofern es keine
  Anwendung `stdlib` nennt. `assert.hrl` hat die Makros, Fehlerterme und
  Schalter `NOASSERT`, `NODEBUG`, `ASSERT` von OTP. Die internen Header von
  OTP (`erl_bits.hrl`, `erl_compile.hrl`) und die für Verteilung (`dist.hrl`,
  `dist_util.hrl`, `net_address.hrl`) werden nicht bereitgestellt, ebenso wenig
  `inet_sctp.hrl` (kein SCTP).
- Ein Modul des Batches mit demselben Namen ersetzt das Bibliotheksmodul, mit
  einer Warnung; Katalog-Builtins dieses Namens gewinnen weiterhin
  ([Registrierung](builtins.md#registration)).
- Bibliotheksmodule sind gewöhnliche Batch-Module: Sie werden in ausführbare
  Dateien gelinkt und erzeugen bei Objekt- oder IR-Ausgabe eigene Artefakte.
  Sie sind Erlang-Code, daher geben sie wie anderer Code ab.
- Ein Modul, das nur über Laufzeitnamen erreicht wird (`M:F(...)` mit `M` als
  Variable), wird nicht hinzugefügt: Ein solcher Aufruf löst `undef` aus, sofern
  nicht etwas anderes das Modul nennt.

## Ersatz für Runtime-Module

Clause vertritt die OTP-Module, die ERTS in C implementiert (NIFs, BIFs,
Port-Treiber, die vorgeladenen Module von `erts/preloaded/src`), sowie Module,
die OTP beim Bauen erzeugt (`unicode_util`). `kernel` und `stdlib` von OTP sind
reines Erlang, rufen aber diese Module auf.

### Bereitgestellt oder fehlend

Was die Runtime braucht und nicht in reinem Erlang geschrieben werden kann,
wird pro Modul entschieden, und pro Funktionsgruppe, wo ein Modul Belange
mischt:

- **Bereitgestellt (provided):** Clause liefert das Modul mit der exakten
  Exportliste von OTP 29. Jede Funktion hat einen von vier Status:
  `implemented` (ein Runtime-Builtin oder ein Erlang-Rumpf über vorhandenen
  Runtime-Diensten), `refused` (gibt zurück oder löst aus, was Aufrufer in OTP
  bereits behandeln, wenn ein Feature fehlt, etwa `{error, enotsup}`), `stub`
  (löst `error({not_implemented, F, A})` mit `M:F/A` oben auf dem Stack aus,
  wie es die [`erlang`-Stubs](builtins.md#erlang-module) tun; noch nicht
  umgesetzt) oder `declined` (ein Stub, der bleibt, mit einem Grund wie
  Distribution oder Laden von Code). Ein neues Modul beginnt mit jeder Funktion
  als Stub, sodass es auffindbar ist und seine Aufrufer kompilieren; Gruppen
  wechseln dann in ihren entschiedenen Status.
- **Builtin-Platzhalter:** Eine von einem Katalog-Builtin implementierte
  Funktion behält ihren Export und den Rumpf
  `F(_, ...) -> clause_builtin_placeholder.`, der nie ausgeführt wird: Die
  Registrierung bindet stattdessen das Builtin, und ein qualifizierter Aufruf
  `M:F(...)` wird zur Brücke kompiliert. Nur ein unqualifizierter Aufruf im
  Modul würde den Platzhalter erreichen, daher ruft das Modul seine eigenen
  Builtins qualifiziert auf; `library_inventory` weist Platzhalter ohne
  zugehöriges Katalog-Builtin, als `not_implemented`-Stub verbliebene
  Katalog-Builtins und unqualifizierte Aufrufe eines Platzhalters zurück.
- **Fehlend (missing):** Clause liefert gar kein Modul, womöglich für immer,
  und hält fest, warum und welche höheren Clause-Module den Platz seiner
  Aufrufer einnehmen (`library/modules.terms`). Die niedrigen Datei- und
  Socket-Schichten `prim_*` (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) sowie `socket` sind die
  fehlenden Module: Programme verwenden stattdessen `file`, `gen_tcp`,
  `gen_udp`, `inet` und `net` von Clause, und weil Clause-Module gegenüber
  denen von OTP gewinnen (siehe unten), gelangen die Aufrufer eines fehlenden
  Moduls aus
  OTP (`gen_tcp_socket`, `inet_tcp`, ... von OTP) nie in einen Batch. Ein
  fehlendes Modul erhält nie einen Stub, daher ist eine Referenz darauf ein
  Fehler zur Kompilierzeit, nie eine Überraschung zur Laufzeit.

Funktionen, die für die Runtime trivial sind, werden ohne eigene Entscheidung
implementiert.

### Zu welchem Modul ein Name aufgelöst wird

OTP ist auf dem Rechner des Nutzers optional; ist es vorhanden, darf es nicht
ändern, was ein Build kompiliert. Ein Modulname wird in dieser Reihenfolge
aufgelöst:

1. **Explizite Eingaben:** Quellen, die der Nutzer aufführt (`sources`,
   `source_dirs`, positionelle Eingaben). Eine, die den Namen eines
   Clause-Moduls trägt, ersetzt es, mit einer Warnung, die beide Dateien nennt.
2. **Clause-Module:** die Bibliotheksmodule, bereitgestellte Ersatzmodule
   eingeschlossen.
3. **`source_search_paths`**, wie unter
   [Projekte](projects.md#paths-and-discovery) beschrieben.

Der Name eines fehlenden Moduls ist reserviert: Eine gleichnamige Datei auf
einem Suchpfad (zum Beispiel `erts/preloaded/src/prim_file.erl` von OTP) wird
nicht verwendet, und die Diagnose sagt, dass Clause das Modul nicht
bereitstellt. Eine explizite Eingabe darf es dennoch bereitstellen, mit der
Ersetzungswarnung.

`ignore_modules` gilt auch für Clause-Module: Ein ignoriertes Clause-Modul
fehlt im Batch, und eine explizite Eingabe kann es dann ohne Warnung
bereitstellen, da nichts ersetzt wird.

### Dateien

- Bibliotheksmodule liegen in `library/<application>/`, benannt nach der
  OTP-Anwendung, der das Modul in OTP gehört: `erts` (Gegenstücke der
  vorgeladenen Module und `erlang`), `kernel`, `stdlib`. Die privaten
  Hilfsmodule von Clause (`clause_socket`, `clause_re`, `clause_unicode`,
  `clause_zlib`, `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`,
  `clause_features`, `clause_io_lib`, `clause_disk_log`, `clause_dets`) liegen
  neben den Modulen, denen sie dienen. Die Suche in der Bibliothek durchsucht jedes
  Anwendungsverzeichnis; ein Modulname existiert in höchstens einem davon.
- `library/modules.terms` listet jedes Modul auf, über das Clause entscheidet:
  `{Module, Application, provided}.` oder
  `{Module, Application, missing, "reason"}.` Der Compiler liest es, um zu
  wissen, welche Namen Clause-Module und welche reserviert sind.
- Jedes bereitgestellte Modul hat daneben ein Inventar `<module>.terms`:
  `{Name, Arity, Group, Status}.` pro Export von OTP 29, sortiert nach Name und
  Stelligkeit, wobei `Group` die Entscheidungsgruppe nennt (zum Beispiel
  `stdlib`, `distribution`, `beam`). `erlang.terms` behält sein eigenes Format
  (`{Name, Arity, Flags, Status}`, [Modul erlang](builtins.md#erlang-module)).
- Exportlisten werden an einem OTP 29 des Hosts beobachtet
  (`M:module_info(exports)`); kein OTP-Quelltext wird kopiert. Ergebnisse und
  Fehlerterme implementierter Funktionen entsprechen OTP 29; bewusste
  Abweichungen stehen unter [Unterschiede](differences.md).

### Dokumentierte Funktionen

`library/documented.terms` listet die öffentlichen Funktionen auf, die OTP 29
für `erts`, `kernel`, `stdlib`, `crypto` und `public_key` dokumentiert:
`{Module, Application, Name, Arity}.` pro Funktion, deren Modul- und
Funktionsdokumentation nicht verborgen ist und die nicht veraltet ist,
beobachtet aus den Doc-Chunks des Host-OTP durch
`tests/compiler/library/observe_docs.escript` (explizit auszuführen).
Undokumentierte Exporte bleiben in den Inventaren, dürfen aber Stubs bleiben.

- `library_inventory` prüft, dass jede dokumentierte Funktion eines
  bereitgestellten Moduls in dessen Inventar steht und kein Stub ist,
  ausgenommen Module, die `library_modules.py` als teilweise implementiert
  mit dem abschließenden Plan-Step aufführt.
- `python tests/compiler/library/library_modules.py coverage .` gibt für
  jedes dokumentierte Modul die Anzahl implementierter und dokumentierter
  Funktionen aus.

### Typen

Weil Clause-Module gegenüber denen von OTP gewinnen, muss OTP-Code, der in
seinen Specs `file:filename()` oder `erlang:time_unit()` nennt, diese Typen in
den Clause-Modulen finden. Jedes bereitgestellte Modul, dessen Gegenstück in
OTP Typen exportiert, bindet `<module>.types.hrl` aus seinem eigenen
Verzeichnis ein: die Liste `-export_type`, dann die exportierten Typen und die
lokalen Typen und Records, die sie verwenden, so wie OTP sie definiert (die
Dokumentation zeigt dieselben Definitionen; die installierte Dokumentation
enthält keine Typdefinitionen, daher stammen sie aus der Implementierung: den
Debug-Informationen der Beam-Datei oder dem mitgelieferten Quelltext eines
vorgeladenen Moduls wie `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` schreibt den
Header aus dem OTP des Hosts, und `--check` vergleicht seine Formen mit einer
frischen Beobachtung (CTest `library_freshness`); `library_modules.py check`
verlangt, dass jedes Modul seinen Header einbindet. Typen, die die Header aus
Modulen außerhalb des Programms nennen (`unicode:chardata()`,
`calendar:datetime()`), und die breiten Unions von OTP (`file:posix()` hat mehr
Glieder, als der Typgraph behält) werden ohne Warnung zu `term()` aufgelöst:
Die Diagnosen gehören zur Bibliothek von Clause, nicht zum Programm des
Nutzers.

### Kernel-Dienste beim Start

`file`, `io` und `code` von OTP rufen registrierte Server auf
(`file_server_2`, `code_server`, den I/O-Server eines Group Leaders), die die
Anwendung `kernel` beim Booten startet. Eine ausführbare Datei von Clause
startet keinen davon: `file` und `io` von Clause brauchen keinen Server,
`logger` von Clause startet seinen Server beim ersten Gebrauch, und ein
OTP-Modul, das einen braucht, scheitert so, wie es unter OTP ohne diesen
Server scheitert (`noproc`). OTP-Code, der zur Laufzeit `code` aufruft,
funktioniert daher nicht. Das Booten der ganzen Anwendung `kernel` ist nicht
geplant.

### Anwendungen

- Spezifikationen stammen aus dem Programm, nicht aus einem Code-Pfad: clau
  kompiliert jede `*.app` und `*.app.src` neben den Quellen des Batches,
  jede `*.app` im danebenliegenden Verzeichnis `ebin` und `ebin/Name.app`
  oder `src/Name.app.src` jedes Eintrags in `[targets.options.applications]`
  in das erzeugte Modul `clause_applications`, das immer hinzugefügt wird,
  wenn der Batch `application_controller` enthält. Die erste Datei eines
  Anwendungsnamens gewinnt. Eine Ressource, die keine Module auflistet, erhält
  die danebenliegenden Module des Batches. Diagnosen verweisen in die
  Ressourcendatei.
- `application:load/1` akzeptiert auch Terme `{application, Name, Keys}`.
  Ein Name ohne Ressource ergibt
  `{error, {"no such file or directory", "Name.app"}}`, wie OTP bei einer
  fehlenden Datei antwortet.
- `kernel` (11.0.4) und `stdlib` (8.1) sind von Anfang an geladen und laufen,
  wie OTP 29.1.1 sie auflistet, ohne Anwendungsmaster; `kernel` hat die
  Standardumgebung seiner `kernel.app`.
- Eine Anwendung mit einem Startmodul erhält einen Master, der die Gruppe
  ihrer Prozesse führt (sodass `get_application/0`, `get_env/1` und
  `start_type/0` darin antworten), ihre I/O-Anfragen an die Standard-I/O
  weiterleitet und beim Stoppen `prep_stop/1` ausführt, den obersten Prozess
  herunterfährt, `stop/1` ausführt und den Rest der Gruppe beendet. Eine
  permanente Anwendung, die endet, oder eine transiente, die abnormal endet,
  hält das Programm mit der Meldung von OTP und Exit-Status 1 an.
- `logger` und `clause_logger` erreichen `application` über einen
  Laufzeitnamen, daher linken es nur Programme, die `application` verwenden.

### Ledger

Der Projektplan sieht jedes dokumentierte Modul von `erts`, `kernel` und
`stdlib` vor; echte Programme (zuerst luerl) setzen die Prioritäten. Es kompilieren und ausführen, jeden
Fehler klassifizieren (`unknown module`, `undefined function M:F/A`, nicht
unterstützte Syntax oder Features, anderes) und jeden einem Plan-Step, einem
anderen Backlog-Eintrag oder einer festgehaltenen Ablehnung zuordnen. Ist das
stderr des Laufs in einer Datei gespeichert, gibt
`python tests/compiler/library/library_modules.py report FILE` die
Klassifikation als Tabellen aus: jedes unbekannte Modul mit seiner
Fehleranzahl, aufrufenden Modulen und aufgerufenen Funktionen mit
Stelligkeiten; undefinierte Funktionen nach Modul; andere Meldungen mit ihren
Anzahlen.

### Werkzeuge

Alle liegen in `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` schreibt
  `LIBRARY/APP/MODULE.terms` aus `MODULE:module_info(exports)` des OTP des
  Hosts und behält dabei Gruppe und Status jedes bereits vorhandenen Eintrags;
  ein neuer Export beginnt als `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` schreibt die
  Moduldatei einmalig, jeder Export ein Stub; danach wird die Datei von Hand
  bearbeitet.
- `python library_modules.py check ROOT` (CTest `library_inventory`, ohne OTP)
  meldet jede Unstimmigkeit: ein bereitgestelltes Modul ohne seine Dateien, ein
  fehlendes Modul mit einer Datei, ein Inventar, das nicht als bereitgestellt
  aufgeführt ist, ein Export, der nicht im Inventar steht, oder umgekehrt, ein
  `stub`/`declined`-Eintrag, der kein `not_implemented`-Stub ist, ein
  `implemented`/`refused`-Eintrag ohne Rumpf oder Katalog-Builtin.
  `library_rejects` belegt das an einer absichtlich inkonsistenten
  Fixture-Bibliothek.
- CTest `library_freshness` (Labels `host_otp`, `full_only`) beobachtet jedes
  Inventar neu und verlangt, dass es unverändert ist, und beobachtet, erzeugt,
  prüft und kompiliert dann ein neues Modul von Anfang bis Ende.
  `library_report` führt `clau` auf einem Fixture-Programm aus und prüft die
  Zeilen des Berichts.
