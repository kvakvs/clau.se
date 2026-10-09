---
source: docs/README.md
sourceCommit: 06042fa
sourceSha256: f48733b2827bbf09b77162c249d6b913411b1f3a60e76cf52b281ba68666f65b
translatedAt: 2026-10-09
---
# Clause-Dokumentation

Kurze Referenznotizen zur aktuellen Implementierung. Jede Datei beschreibt
Verhalten und Grenzen, die heute bestehen; Pläne und Schrittverlauf liegen in
`.agents/`.

| Thema | Dokument |
| --- | --- |
| Präprozessor (Verhalten von `epp`, Includes, Makros, Features) | [preprocessor.md](preprocessor.md) |
| Parsen, AST-Besitz, Syntaxgrenzen | [parser.md](parser.md) |
| TOML-Projekte und Zielauswahl | [projects.md](projects.md) |
| Compiler-CLI, Artefakte, LLVM SDK, Beispiel | [compile.md](compile.md) |
| Eintrittspunkt ausführbarer Dateien, Argumente, Exit-Status, Ausgabeströme, Linken | [executables.md](executables.md) |
| Semantische Analyse, Typen, Inferenz, Bindungen | [semantic.md](semantic.md) |
| Richtlinie zur Typspezialisierung | [specialization.md](specialization.md) |
| ABI des erzeugten Codes: Terme, Symbole, Registrierung, Fehlschläge, Wurzeln | [abi.md](abi.md) |
| Muster, Klauseln und Matches im Rumpf | [patterns.md](patterns.md) |
| Guards und der Katalog der Guard-BIFs | [guards.md](guards.md) |
| Termrepräsentationen (Atome, Zahlen, Container, Maps, Bits, records) und Ausgabe | [terms.md](terms.md) |
| Native, qualifizierte und anonyme records (OTP 29) | [native-records.md](native-records.md) |
| Funktionswerte: `fun F/A`, `fun M:F/A`, Aufrufe von funs | [funs.md](funs.md) |
| Produktions-Builtins: Katalog, Bridge-Aufrufe, Builtin-funs, Registrierung | [builtins.md](builtins.md) |
| Bibliotheksmodule (Teilmengen von `lists`, `maps`), mit Programmen kompiliert | [library.md](library.md) |
| Konsolenausgabe: `io:format/1,2`, `io:put_chars/1`, Layout von `~p` | [io.md](io.md) |
| Lebenszyklus der Runtime, Speicher, Standardausgabe, Code-Server, Buchführung des Schedulers | [runtime.md](runtime.md) |
| Prozesse: Scheduler-Worker, Zeitscheiben, `spawn/1,3`, `is_process_alive/1`, Links, Exit-Signale, Monitore, registrierte Namen | [processes.md](processes.md) |
| Ports: Identität, Port-Tabelle, Treiber, Datenmodi, der I/O-Thread, Standard-I/O, Dateien und Sockets (Entscheidung von plan step 57A) | [ports.md](ports.md) |
| Vertrag des Prozess-Heaps: Wortlayout, Bereiche, Zulassung, Wurzeln, Speicherbereinigung | [runtime-heap.md](runtime-heap.md) |
| Entscheidung zum Ausführungsmodell: Frames, Aufrufe, Endaufrufe, Yield, Ausnahmen | [execution-model.md](execution-model.md) |
| Meldung zurückgestellter Features (`notimpl`) | [features.md](features.md) |
| Pin der OTP-Quelltextreferenz und Aktualisierungsverfahren | [otp-reference.md](otp-reference.md) |
| Bekannte Verhaltensunterschiede zu Erlang/OTP | [differences.md](differences.md) |
| Validierungsbasislinie, Testmodi, Plattformlücken, Verlauf | [validation.md](validation.md) |

Ältere schrittweise Validierungsaufzeichnungen und Nachweis-JSON wurden im
[Validierungsverlauf](validation.md#history) verdichtet; die vollständigen
Originale bleiben in der Git-Historie (zuletzt vorhanden in Commit `2777c98`).
