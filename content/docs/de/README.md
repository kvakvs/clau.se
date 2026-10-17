---
source: docs/README.md
sourceCommit: a8c3f8f6
sourceSha256: 2124516a48ed02c82259ea7ac1d86d673aaf9cff2feba5044f3db2a30ad0db18
translatedAt: 2026-10-17
---
# Clause-Dokumentation

Kurze Referenznotizen zur aktuellen Implementierung. Jede Datei beschreibt
Verhalten und Grenzen, die heute bestehen; Pläne und Schrittverlauf liegen in
`.agents/`.

| Thema | Dokument |
| --- | --- |
| Präprozessor (Verhalten von `epp`, Includes, Makros, Features) | [preprocessor.md](preprocessor.md) |
| Parsen, AST-Besitz, Syntaxgrenzen | [parser.md](parser.md) |
| TOML-Projekte, Zielauswahl, Build-Verzeichnis und Caches, ignorierte Quellen | [projects.md](projects.md) |
| Compiler-CLI, Artefakte, Ausgabe von Quelltext und Abstract Format, Kompilier-Cache, LLVM SDK, PCRE2 und zlib, Beispiel | [compile.md](compile.md) |
| Eintrittspunkt ausführbarer Dateien, Argumente, Exit-Status, Ausgabeströme, Linken | [executables.md](executables.md) |
| Debug-Informationen (`-g`), Debugger und der Erlang-Aufrufstapel | [debugging.md](debugging.md) |
| Opt-in-Profiling (`--profile FILE`): Eintritte und Eigenzeit pro Funktion und Prozess | [profiling.md](profiling.md) |
| Parse transforms: OTP-Loader des Hosts, Austausch im Abstract Format, Suche nach Transforms | [transforms.md](transforms.md) |
| Semantische Analyse, Typen, Inferenz, Bindungen | [semantic.md](semantic.md) |
| Typspezialisierung bei `-O2`: Nachweise und Repräsentationsvarianten | [specialization.md](specialization.md) |
| ABI des erzeugten Codes: Terme, Symbole, Registrierung, Fehlschläge, Wurzeln | [abi.md](abi.md) |
| Muster, Klauseln, Matches im Rumpf und Comprehensions | [patterns.md](patterns.md) |
| Guards und der Katalog der Guard-BIFs | [guards.md](guards.md) |
| Termrepräsentationen (Atome, Zahlen, Container, Maps, Bits, Records) und Ausgabe | [terms.md](terms.md) |
| Native, qualifizierte und anonyme Records (OTP 29) | [native-records.md](native-records.md) |
| Funktionswerte: `fun F/A`, `fun M:F/A`, Closures, benannte Funs, dynamische Aufrufe | [funs.md](funs.md) |
| Produktions-Builtins: Katalog, Bridge-Aufrufe, Modul-Builtins, Portionen, Registrierung | [builtins.md](builtins.md) |
| Bibliotheksmodule unter `library/{erts,kernel,stdlib}`, mit Programmen kompiliert: wie Programme sie erhalten, vorhandene und fehlende Module | [library.md](library.md) |
| Konsolenausgabe: `io:format`, `io:put_chars`, Geräte, Formatsteuerzeichen, Layout von `~p` | [io.md](io.md) |
| Lebenszyklus der Runtime, Speicher, Code-Server, persistente Terme, Threads, Standardausgabe, Start | [runtime.md](runtime.md) |
| Prozesse: Scheduler-Worker, Nachrichten und receive, Links, Monitore, registrierte Namen, Timer, Introspektion, Aliase, Exit-Signale | [processes.md](processes.md) |
| Ports: Identität, Port-Tabelle, Treiber, Datenmodi, der I/O-Thread, ausgelastete Ports, Unterprozesse, Standard-I/O, Dateien und Sockets | [ports.md](ports.md) |
| Vertrag des Prozess-Heaps: Wortlayout, Bereiche, Zulassung, Wurzeln, Speicherbereinigung | [runtime-heap.md](runtime-heap.md) |
| Ausführungsmodell: Frames, Aufrufe, Endaufrufe, Yield, Ausnahmen | [execution-model.md](execution-model.md) |
| Meldung zurückgestellter Features (`notimpl`) | [features.md](features.md) |
| Pin der OTP-Quelltextreferenz und Aktualisierungsverfahren | [otp-reference.md](otp-reference.md) |
| Bekannte Verhaltensunterschiede zu Erlang/OTP | [differences.md](differences.md) |
| Validierungsbasislinie, Testmodi, Plattformlücken, Benchmarks, Verlauf | [validation.md](validation.md) |

Ältere schrittweise Validierungsaufzeichnungen und Nachweis-JSON wurden im
[Validierungsverlauf](validation.md#history) verdichtet; die vollständigen
Originale bleiben in der Git-Historie (zuletzt vorhanden in Commit `2777c98`).
