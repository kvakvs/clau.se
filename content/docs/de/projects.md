---
source: docs/projects.md
sourceCommit: 6ed3851c
sourceSha256: 8a996bd18e6d699944fde901a3d45fece06aa55859935b3fe26c1518edc03e7d
translatedAt: 2026-10-15
---
# TOML-Projekte

Ein Projektmanifest wählt geordnete Gruppen von Erlang-Quellen aus und
konfiguriert jedes Ziel unabhängig. Alle CLI-Aktionen akzeptieren Projekte.
Siehe das [funktionierende Beispiel](../examples/project/project.toml).

## Manifest (Schema 1)

```toml
schema_version = 1

[[targets]]
name = "app"
sources = ["main.erl", "src/workers/*.erl", "shared/**/*.erl"]
source_dirs = ["src/support"]
output = "build/app"
entry = "main:main"
build_dir = "build"

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]
ignore_dirs = ["src/legacy", "deps/*/test"]
ignore_modules = ["telemetry", "*_SUITE"]
keep_exports = false
cache_inference_in_dirs = ["deps/*"]

[targets.options.applications]
my_dependency = "vendor/my_dependency"
```

- `schema_version = 1` und ein nicht leeres Array `targets` sind erforderlich.
  Unbekannte Schlüssel, falsche Typen, doppelte Zielnamen und leere
  Zeichenketten werden abgewiesen; keine Typumwandlung. Das gesamte Manifest
  wird validiert, einschließlich nicht ausgewählter Ziele.
- Zielnamen: ASCII mit Beachtung der Groß-/Kleinschreibung
  `[A-Za-z0-9_][A-Za-z0-9_.-]*`, eindeutig. Ein Name ist ein Build-Ziel, kein
  LLVM-Triple.
- `sources` (Dateien und Wildcard-Muster) und `source_dirs` (rekursive Suche
  nach `.erl` und `.abstr`) sind optional, aber ein Ziel braucht mindestens
  einen Eintrag. Explizite Dateien müssen auf `.erl` enden oder auf `.abstr`
  für Formen im abstrakten Format
  ([Transformationen](transforms.md#interchange)); Header sind Abhängigkeiten,
  keine Eingaben.
- `parse_transforms` (Modulnamen) und `transform_paths` (Verzeichnisse oder
  Muster vorkompilierter `.beam`-Dateien) in `options` wenden
  Parse-Transformationen auf die Module des Ziels an
  ([Transformationen](transforms.md#options)).
- `ignore_dirs` (Pfade) und `ignore_modules` (Modulnamen), beide mit Wildcards,
  in `options` lassen Quellen aus dem Build heraus
  ([ignorierte Quellen](#ignored-sources)).
- `keep_exports = true` in `options` hält jeden Export der ausführbaren Datei
  des Ziels aufrufbar, wie es `--keep-exports` für jedes ausgewählte Ziel tut
  ([Export-Lebendigkeit](executables.md#export-liveness)). Es muss ein Boolean
  sein.
- `cache_inference_in_dirs` (Verzeichnis-Wildcards) in `options` fügt
  Verzeichnisse hinzu, deren Module ihre Inferenzergebnisse im Build-Cache
  behalten ([Inferenz-Cache](#inference-cache)).
- Die Felder von `options` sind optionale typisierte Frontend-Optionen.
  `defines` verwenden `NAME` (= `true`) oder `NAME=ERLANG_LITERAL_TERM`;
  Duplikate sind Fehler. Ein Feature darf nicht in beiden Feature-Listen stehen.
- `entry` (optional) wählt den Einstieg der ausführbaren Datei
  `MODULE[:FUNCTION]`; siehe
  [ausführbare Dateien](executables.md#entry-selection). Das CLI-`--entry`
  überschreibt es für ein einzelnes ausgewähltes Ziel.
- `build_dir` (optional) ist das [Build-Verzeichnis](#build-directory) des
  Ziels, Standard `<manifest-dir>/build`.
- `output` ist das Ziel der ausführbaren Datei, Standard
  `<manifest-dir>/build/<target>` (`.exe` unter Windows). Ein Ziel mit `output`
  oder `entry` ist ein ausführbares Ziel
  ([ausführbare Dateien](#executables)); `--emit` und Prüf-/Ausgabemodi
  ignorieren die Ausgaben beider Schlüssel.
- Noch nicht unterstützt: Standards auf Wurzelebene, Vererbung,
  Zielabhängigkeiten, Importe, Profile, Pakete, Watch, parallele Builds. Felder
  werden nur zusammen mit ihrem Verhalten hinzugefügt. Build-Caches sind unter
  [Build-Caches](#build-caches) beschrieben.

## CLI und Zielauswahl

```text
clau [options] <source.erl>...
clau [options] --project <path> [--target <name>]...
clau --new-project <filename>
```

- Positionale Quellen und `--project` schließen sich gegenseitig aus. Ein
  `--project`, beliebig viele `--target`, in beliebiger Reihenfolge.
- Kein `--target`: alle Ziele in Manifestreihenfolge. Selektoren behalten ihre
  Reihenfolge und ihr erstes Vorkommen. Unbekannte Namen schlagen vor jeder
  Frontend-Arbeit fehl und listen die verfügbaren Namen auf.
- `--project test1` lädt `test1.toml`, wenn `test1` nicht existiert.
- CLI-Frontend-Optionen gelten für jedes ausgewählte Ziel. CLI-relative Pfade
  behalten ihre Bedeutung relativ zum Aufrufverzeichnis; Manifestpfade sind
  relativ zum Manifest.
- Ohne `--emit` oder eine Prüf-/Ausgabeaktion werden ausführbare Ziele zu ihren
  Ausgaben gelinkt ([ausführbare Dateien](#executables)); andere Ziele werden im
  Speicher kompiliert.
- `-o/--output` linkt das Ziel an diesen Pfad statt an sein `output`
  ([Linken](executables.md#linking)); es erfordert genau ein ausgewähltes Ziel.
- `--verbose` protokolliert `[pp]`-Dateien/-Includes und `[parse]`-Quellen auf
  stderr.
- `--print-inputs` führt jedes ausgewählte Ziel bis zur Kompilierung aus: Es
  verarbeitet und parst die Quellen nach der [Suche](#paths-and-discovery) vor
  und fügt dann die Module hinzu, die sie aus der Bibliothek und
  `source_search_paths` benennen, wie es ein Build tut. Es gibt die Quellen des
  Ziels (absolute Pfade) aus, eine pro Zeile, dann jede hinzugefügte Quelle als
  `<path> (referenced at <file>:<line>)`, die früheste Stelle im verweisenden
  Modul, die sie benennt; hinzugefügte Quellen werden ihrerseits durchsucht. Es
  wird nichts kompiliert. Bei mehreren Zielen folgt jede Liste auf eine Zeile
  `[target <name>]`. Positionale Eingaben werden wie angegeben ausgegeben.
  Diagnosen gehen nach stderr; ein Parse-Fehler stoppt das Hinzufügen
  referenzierter Module und endet mit 1. Es ersetzt andere Prüf-/Ausgabeaktionen
  und kollidiert wie diese mit `-o`, `--entry` und Kompilierschaltern.
- `--print-env` gibt den gesamten Aufruf als TOML aus: eine Tabelle
  `[[targets]]` pro ausgewähltem Ziel mit seinen aufgelösten Quellen,
  Such-/Include-Verzeichnissen und wirksamen Optionen
  ([Umgebungsbericht](compile.md#environment-report)).
- Exit-Code 2: Verwendungsfehler und unbekannte Ziele. Exit-Code 1: Fehler bei
  Manifest, Suche, Frontend oder Erstellung. Exit-Code 0: Erfolg (Warnungen
  erlaubt).

Jedes ausgewählte Ziel ist ein separater Kompilier-Batch mit eigenen
Präprozessor-Sitzungen. Die Planung (Dekodieren, Auswählen, Suchen, Prüfen auf
Ausgabekollisionen) ist abgeschlossen, bevor irgendeine Quelle läuft; die
Ausführung verarbeitet dann Ziele/Dateien der Reihe nach und hält Fehlschläge
fest. Nutzausgaben gehen ohne Banner (außer den Zielzeilen von
`--print-inputs`) in Ziel-/Dateireihenfolge nach stdout; Kontext und Diagnosen
gehen nach stderr. Ein Ziel mit Diagnosen wird einmal genannt, in einer Zeile
`<manifest> [target <name>]:` vor seiner ersten; die Diagnosen selbst
(`error: file:line:col: message`) tragen kein Werkzeug- oder Zielpräfix.

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target tests --target app
```

## Ausführbare Dateien

`clau --project FILE [--target T]...` (kein `--emit`, keine
Prüf-/Ausgabeaktion) linkt jedes ausgewählte Ziel, das einen Schlüssel `output`
oder `entry` hat oder das CLI-`-o`/`--entry` adressiert, zu einer ausführbaren
Datei pro Ziel:

- Ziel: CLI-`-o` (relativ zum Aufruf), sonst `output` (relativ zum Manifest),
  sonst `<manifest-dir>/build/<target>`. Windows-Ziele hängen `.exe` an einen
  Namen ohne Erweiterung an. Fehlende Verzeichnisse von Manifestausgaben werden
  erstellt; ein explizites `-o`-Verzeichnis muss existieren.
- Einstieg: CLI-`--entry`, Manifest-`entry`, sonst Erkennung
  ([Einstiegsauswahl](executables.md#entry-selection)).
- Ziele ohne `output`, `entry`, `-o` und `--entry` sind Bibliotheken: Sie werden
  im Speicher kompiliert und schreiben nichts, selbst wenn ein Modul `main/1`
  exportiert.
- Die Planung weist ausgewählte Ziele mit demselben Ziel ab; Ausgaben, die erst
  nach dem Anhängen von `.exe` zusammenfallen, werden vor der Veröffentlichung
  abgewiesen. Eine Ausgabe darf keine ausgewählte Quelle und nicht das Manifest
  überdecken.
- Jedes Ziel wird in sein eigenes Staging-Verzeichnis kompiliert und gelinkt.
  Ausgaben werden erst ersetzt, nachdem jedes ausgewählte Ziel erfolgreich war,
  in Zielreihenfolge; jeder Fehlschlag lässt alle vorhandenen Ausgaben
  unverändert. Ein Fehlschlag beim Ersetzen einer späteren Ausgabe kann frühere
  bereits ersetzt hinterlassen.
- `--linker` und `--runtime-library` gelten für jedes gelinkte Ziel
  ([Linken](executables.md#linking)).

```sh
./build/debug/bin/clau --project tests/fixtures/linking/project/project.toml
```

## Ein Projekt erstellen

`--new-project <filename>` schreibt ein kommentiertes Manifest und sonst
nichts.

- Hängt `.toml` an, außer der Name endet bereits auf `.toml` (ASCII, ohne
  Beachtung der Groß-/Kleinschreibung): `demo` → `demo.toml`,
  `demo.config` → `demo.config.toml`.
- Weist leere oder verzeichnisartige Namen, Wiederholung und jede Kombination
  mit Quellen, `--project`, `--target`, `-o`, Prüf-/Ausgabemodi oder
  Frontend-Optionen ab.
- Das übergeordnete Verzeichnis muss existieren. Überschreibt nie (exklusive
  Erstellung); räumt bei einem Schreibfehler die eigene unvollständige Datei auf.
  Gibt bei Erfolg den erstellten Pfad aus.
- Der Inhalt ist deterministisches UTF-8/LF mit Kommentaren: ein Ziel `app`,
  `sources = []`, `source_dirs = ["src"]`, leere Optionslisten und die
  Standardausgabe der Plattform. Es lässt sich sofort dekodieren; Quellen fügt
  man unter `src` hinzu.

## Build-Verzeichnis

Jedes Projektziel hat ein Build-Verzeichnis, in dem Clause seine eigenen
temporären Dateien (und ab Plan 11 step 62D2 seine Caches) ablegt: das
`build_dir` des Ziels, relativ zum Manifest, Standard `<manifest-dir>/build`.
`--build-dir DIR` (relativ zum Aufruf) ersetzt es für jedes ausgewählte Ziel.
Positionale Eingaben bekommen keines, außer `--build-dir` ist angegeben.

- Temporäre Dateien liegen unter `<build_dir>/tmp`: derzeit die Arbeitsbereiche
  des Laders für Parse-Transformationen
  ([Transformationen](transforms.md#loader)). Jeder Lauf entfernt seine
  eigenen; ein leeres `tmp` kann bleiben. Ohne Build-Verzeichnis landen sie im
  temporären Verzeichnis des Systems.
- Das Link-Staging (`.clause-link-*`) bleibt neben der Ausgabe der ausführbaren
  Datei, weil das abschließende Umbenennen auf dem Volume der Ausgabe bleiben
  muss ([Linken](executables.md#linking)).
- Prüf- und Ausgabemodi (`--parse-check`, `--print-ast`, ...) schreiben nichts
  außerhalb des Build-Verzeichnisses; positionale Prüfungen ohne `--build-dir`
  schreiben überhaupt keine Datei.
- `--print-env` gibt das `build_dir` jedes Ziels aus (`""`, wenn es keines
  gibt).

### Build-Caches

Ergebnisse, die es wert sind, zwischen Läufen behalten zu werden, liegen unter
`<build_dir>/cache` (62D4 und 62D5); `--no-cache` liest und schreibt sie weder.
Es sind die Antworten des Laders für Parse-Transformationen und die Liste der
Sticky-Module des Host-OTP, sodass ein warmer Build kein Host-`erl` für Module
startet, deren Transformationseingaben sich nicht geändert haben, sowie das
[Kompilierergebnis](compile.md#compile-cache) jedes Batches.

- **Schnittstelle.** Aufrufer verwenden einen projektinternen Speicher
  (`compiler/src/cache/
  store.hpp`): `get`/`put` nach Eingabeverzeichnis, Dateiname, Ergebnisart und
  Schlüssel, dazu `invalidate` und `prune`; Pfade sehen sie nie. Ein Wert ist
  die Formatversion des Aufrufers und eine Liste benannter Teile (ein
  Transformationslauf: `reply` und `output`; ein Kompilierergebnis: `failed`,
  jede `diagnostic` und mit Ausgaben `triple`, `extension` und ein Teil pro
  Modulobjekt), sodass kein Aufrufer einen eigenen Codec braucht. Ein `get` mit
  einer anderen Formatversion ist ein Fehltreffer. Jede Operation ist von
  mehreren Threads gleichzeitig sicher.
- **Layout (SQLite-Backend).** `cache/v2/cache.db` ist eine SQLite-3.54-Datenbank:
  Tabelle `entries` (Eingabeverzeichnis, Datei, Art, Schlüssel, Format, letzte
  Verwendung; eindeutig über die Adresse) und Tabelle `parts` (Eintrag,
  Reihenfolge, Name, Größe, xxh3-64-Prüfsumme und entweder die Bytes oder der
  Name einer Blob-Datei). Teile größer als 256 KB liegen in
  `cache/v2/blobs/<xxh3-128 of the bytes>`, sodass gleiche Teile (die
  identischen Objekte eines unter zwei Optionssätzen gebauten Batches) einmal
  gespeichert werden. Eine Blob-Datei wird als temporäre Datei geschrieben und
  umbenannt, bevor die Zeile, die sie benennt, festgeschrieben wird, sodass eine
  Zeile nie eine unvollständige Datei benennt; ein Absturz dazwischen hinterlässt
  nur eine verwaiste Datei.
- **Schlüssel.** Ein Schlüssel ist der 128-Bit-Inhaltshash von allem, wovon das
  Ergebnis abhängt, nie ein Zeitstempel: die Version und die ausführbare Datei
  von `clau` (Pfad, Größe, Änderungszeit, sodass ein neu gebautes `clau` einen
  Fehltreffer hat), die Ergebnisart und bei einem Transformationslauf die an
  `erl` gesendete Anfrage (die vorverarbeiteten Formen des Moduls und seine
  Compile-Optionen: Include-Verzeichnisse, Defines, Features), das Host-OTP-Release
  (`erl` und die Dateien `releases/*/OTP_VERSION` daneben), jede für den Lauf
  kompilierte Transformationsquelle des Projekts mit den Dateien, die sie
  einbindet, und jede `.beam` auf den Codepfaden der Transformationen. Die
  Formatversion des Speichers ist das Verzeichnis `v<format>`; die eigene
  Formatversion eines Werts wird in seiner Zeile gehalten. Da der Schlüssel die
  vorverarbeiteten Formen abdeckt, verfehlen ein geänderter Header, ein
  geändertes Define oder Feature oder ein neuer Header, der einen eingebundenen
  überdeckt, genau die Module, deren Formen oder Optionen sich ändern; Defines
  und Features sind Compile-Optionen, die jede Transformation sieht, daher
  verfehlen sie jedes transformierte Modul; eine geänderte `.beam` verfehlt
  jedes Modul, dessen Transformationen mit diesem Codepfad laufen.
- **Nebenläufigkeit.** Die Datenbank läuft im Write-Ahead-Log-Modus mit
  `synchronous=NORMAL`: Leser laufen neben einem Schreiber, und Schreiber (eine
  Transaktion pro `put`) warten bis zu 30 s aufeinander. Mehrere
  `clau`-Prozesse, die sich ein Build-Verzeichnis teilen, behalten jeden
  Eintrag. Innerhalb eines Prozesses serialisiert ein Mutex die Threads, die
  sich einen Speicher teilen.
- **Beschädigung.** Teile tragen Größen und Prüfsummen, und Blob-Dateien werden
  gegen ihre Namen geprüft: ein beschädigter Teil oder eine fehlende Blob-Datei
  ist ein Fehltreffer (`damaged entry`), und sein Eintrag wird verworfen. Eine
  unbrauchbare, abgeschnittene oder fremde `cache.db` (SQLite meldet sie als
  beschädigt oder als keine Datenbank, oder ihre Anwendungs-ID oder
  Schemaversion weichen ab) wird in `cache.db.damaged` umbenannt und neu
  erstellt; ist das unmöglich, läuft der Lauf ohne Cache weiter. Nichts davon
  ist ein Fehler, und `--verbose` vermerkt es als `[cache] ...`.
- **Netzwerkdateisysteme.** Write-Ahead-Logging braucht gemeinsamen Speicher
  zwischen Prozessen, den Netzwerkdateisysteme nicht bieten. Kann SQLite nicht
  in den WAL-Modus wechseln, verwendet der Speicher sein Rollback-Journal (Leser
  warten dann auf einen Schreiber), und `--verbose` sagt das einmal; funktioniert
  kein Journalmodus, läuft der Lauf ohne Cache weiter.
- **Bereinigung.** Am Ende eines Laufs, der in einen Speicher geschrieben hat,
  werden Einträge gelöscht, die 30 Tage nicht verwendet wurden, dann
  Blob-Dateien, die kein Eintrag benennt (sobald sie älter als 10 Minuten sind,
  damit die neue Datei eines gleichzeitigen Schreibers überlebt), und die
  freigegebenen Seiten werden an das Dateisystem zurückgegeben (inkrementelles
  Vacuum). Jeder Lauf entfernt einen übrig gebliebenen Baum `cache/v1` des
  Datei-Backends von step 62D2.
- **Beobachtbarkeit.** `--print-stage-times` markiert wiederverwendete Stufen
  (`[time] transform src/a.erl: 7.254 ms (cached)`); `--verbose` gibt
  `[cache] hit|miss <kind> <file>` mit dem Grund eines Fehltreffers aus
  (`no entry`, `inputs changed`, `damaged entry`). Diagnosen und
  Transformationsausgabe sind mit und ohne Treffer gleich: Sie werden mit dem
  Eintrag gespeichert.
- **Backend-Messungen** (2026-10-12, Release, Windows 11, NTFS;
  `cache_store bench` in `tests/compiler/cache`). Das Datei-Backend von 62D2
  (ein Index, der pro Put neu geschrieben wird, nur anhängende Packs) gegen
  SQLite:

  | Fall | Datei-Backend | SQLite |
  | --- | --- | --- |
  | 200 Puts × 8 KB, dann Öffnen und 200 Gets | 788–902 ms, 9–16 ms | 37–41 ms, 8–9 ms |
  | 2.000 Puts × 8 KB, dann Öffnen und Gets | 11,1–12,5 s (1–3 Einträge verloren), 118–128 ms | 249–258 ms, 32–33 ms |
  | 3 Puts × 24 MB, dann Öffnen und Gets | 106–127 ms, 144–157 ms | 85–90 ms, 73 ms (Blob-Dateien) |

  In der Datenbank gehalten, brauchten die 24-MB-Werte 379–392 ms für das Put
  (das Log schreibt sie zweimal). Zwanzig verschiedene Werte pro Größe, gePutet
  und dann zurückgelesen: 64 KB in der Datenbank 21 ms / 7 ms gegen
  30 ms / 12–17 ms als Blob-Dateien; 256 KB 41–43 ms / 9 ms gegen
  30–31 ms / 10–19 ms; 1 MB 105–110 ms / 18 ms gegen 37 ms / 18–22 ms; 4 MB
  458–466 ms / 82 ms gegen 92 ms / 71 ms. Lesen begünstigt die Datenbank bis
  etwa 256 KB, Schreiben begünstigt ab dort Dateien, was die Inline-Grenze auf
  256 KB festlegt. luerl-Builds (Release, drei Läufe) änderten sich nicht: kalt
  3,75–3,78 s vorher und 3,78–3,80 s nachher, warm 1,65–1,68 s vorher und
  1,69–1,70 s nachher; sie behalten wenige Einträge.
- **Kein Cache für Verzeichnisdurchläufe** (2026-10-11, Release-`clau`,
  Windows, Dateicache des Betriebssystems warm). luerl plant in 78 ms eines
  warmen Builds von 2,77 s (2,8 %). Ein Manifest über ganz `references/otp/lib`
  (1.319 Verzeichnisse, 9.711 Dateien) plant in etwa 150 ms:
  `sources = ["…/lib/**/src/*.erl"]` 74 ms, `source_dirs = ["…/lib"]` 140 ms,
  `source_search_paths` und `include_dirs` mit `**` je 35 ms, `ignore_dirs`
  0,4 ms. Das Auflisten jedes Verzeichnisses des Baums kostet etwa 28 ms,
  während das Prüfen der Änderungszeit jedes Verzeichnisses (was ein solcher
  Cache stattdessen täte) etwa 13 ms kostet; der Rest ist die Validierung pro
  Quelle (Öffnen und Identifizieren jeder von 2.000–3.600 Quellen), die ein
  solcher Cache nicht überspringen kann. Der erste Lauf, nachdem der Baum den
  Cache des Betriebssystems verlassen hatte, dauerte 10–20 s, ebenfalls
  dominiert vom Öffnen von Dateien. Das Sondieren von Includes kostet seit dem
  [Verzeichnisindex](#directory-index) nichts Messbares.
- **Inferenzergebnisse** von Modulen in konfigurierten Verzeichnissen
  ([Inferenz-Cache](#inference-cache)).
- **Nicht gecacht:** Vorverarbeitung und Parsen. Ein gecachtes Ergebnis würde
  über die abstrakten Formen laden (`transforms/import`), und bei luerl
  (169 Module, Release, 2026-10-11) dauerte allein ihr Import 1.063 ms gegen
  819 ms für das Vorverarbeiten (409 ms) und Parsen (410 ms) der Quellen; das
  Exportieren der Formen für einen Schlüssel dauerte weitere 727 ms.

### Inferenz-Cache

Bibliotheksmodule (die Quellen von OTPs `stdlib`, `kernel`, `compiler` und
`syntax_tools`, die über `source_search_paths` gefunden werden, Clauses eigene
[Bibliothek](library.md)) ändern sich selten, daher behalten Module in
konfigurierten Verzeichnissen ihre Ergebnisse der Typinferenz im Build-Cache,
pro Modul, und spätere Kompilierungen verwenden sie wieder, statt sie erneut zu
inferieren.

- Verzeichnisse: die impliziten OTP-Anwendungsmuster `*/stdlib`, `*/stdlib-*`,
  `*/kernel`, `*/kernel-*`, `*/compiler`, `*/compiler-*`, `*/syntax_tools` und
  `*/syntax_tools-*`, dann das `cache_inference_in_dirs` des Ziels, dann jedes
  `--cache-inference-in-dirs PATTERN` (wiederholbar; auch positionale
  Eingaben). Muster verwenden die [Wildcards](#paths-and-discovery) von
  `sources`; Windows-Trennzeichen werden akzeptiert.
- Ein Modul ist abgedeckt, wenn ein Verzeichnis, das seine Quelle enthält, auf
  ein Muster passt. Ein relatives Muster passt auf die abschließenden
  Verzeichnisse eines beliebigen Pfads, nicht auf Pfade unterhalb des
  Manifestverzeichnisses: `*/stdlib` deckt
  `/usr/lib/erlang/lib/stdlib/src/lists.erl` und
  `references/otp/lib/stdlib/src/lists.erl` ab, während ein installiertes
  `.../lib/stdlib-7.0/src/lists.erl` `*/stdlib-*` braucht. Ein absolutes Muster
  passt auf den ganzen Verzeichnispfad (`C:/Program Files/Erlang OTP/lib/*`).
  Das Matching ist lexikalisch und beachtet die Groß-/Kleinschreibung. Die
  impliziten Muster decken auch ein eigenes Verzeichnis des Projekts mit einem
  solchen Namen ab (`apps/compiler`), was nur mehr Einträge speichert: die
  Wiederverwendung ist für jedes Modul korrekt.
- `--print-env` gibt die wirksame Liste als `cache_inference_in_dirs` aus, die
  impliziten Muster zuerst. Ein nicht unterstütztes Konstrukt (`[`, `{`, `!`)
  ist ein Manifestfehler oder auf der Befehlszeile ein Verwendungsfehler
  (Exit-Code 2).
- Die Wiederverwendung braucht ein Build-Verzeichnis (jedes Projektziel;
  positionale Eingaben mit `--build-dir`) und ist mit `--no-cache` aus. Sie
  funktioniert für jede Aktion, die analysiert (Kompilieren, ausführbare
  Dateien, `--print-types`, IR-Inspektionen), auch wenn der
  [Kompilier-Cache](compile.md#compile-cache) des Batches einen Fehltreffer hat.
- Schlüssel: die Identität von `clau`, der Fingerabdruck des Moduls und die
  jedes Batch-Moduls, das seine Atome benennen, transitiv (entfernte Aufrufe,
  `fun M:F/A`, `apply`, jedes Atom, das ein Modulname ist); siehe
  [Semantik: Inferenz-Cache](semantic.md#inference-cache) dazu, warum das alles
  ist, wovon seine Fakten abhängen. Das Bearbeiten eines Nutzermoduls behält
  daher die Bibliothekstreffer, außer ein Bibliotheksmodul benennt es; das
  Bearbeiten eines Bibliotheksmoduls verfehlt es und jedes abgedeckte Modul, das
  es erreicht.
- Einträge werden pro Quellverzeichnis, Datei und Projektziel gehalten (Art
  `inference@<target>`, `inference@positional`); ein Wert ist ein Teil
  `results` (`semantic/types/inference_store`: Graphknoten, Zusammenfassungen
  und lokale Eingaben pro Funktion, Ausdrucksfakten nach Syntaxposition).
  Ergebnisse, die eine Kompilierung mit mehr lebenden Funktionen behalten hat
  (zum Beispiel `--print-types`), bedienen eine ausführbare Datei, die weniger
  behält.
- `--verbose` gibt pro abgedecktem Modul `[cache] hit|miss inference <file>`
  aus (Gründe für Fehltreffer: `no entry`, `inputs changed`, `damaged entry`,
  `results do not
  fit` für behaltene Ergebnisse, denen eine jetzt lebende Funktion fehlt);
  `--print-stage-times` gibt die Phasen `inference-cache` (mit `N of M
  covered modules reused`) und `inference-store` aus.

## Pfade und Suche

- Der Projektpfad wird gegen das Aufrufverzeichnis aufgelöst; das lexikalische
  übergeordnete Verzeichnis des Manifests ist die Basis für alle Manifestpfade
  (auch über einen Symlink). Absolute Pfade bleiben absolut; `..` ist erlaubt.
  Keine Shell-, Umgebungs- oder Tilde-Expansion. Für Windows-Pfade `/` oder
  literale TOML-Zeichenketten verwenden.
- Literale relative Quellen versuchen zuerst die Basis, dann der Reihe nach
  `source_search_paths`. Ein vorhandener, aber nicht lesbarer Kandidat ist ein
  Fehler. Suchpfade zählen keine Module auf und beeinflussen keine Includes.
- Benennen die Quellen des Ziels ein Modul, das keine von ihnen definiert (ein
  entfernter Aufruf, `fun M:F/A`, `apply` mit literalem Modul, `-behaviour`
  oder `-import`), wird zuerst Clauses
  [Bibliothek](library.md#how-programs-get-them) und dann der Reihe nach die
  Suchpfade nach `Module.erl` durchsucht (plan step 41K: ein installiertes OTP
  ersetzt nie ein Clause-Modul, und ein Modul, das Clause als fehlend
  verzeichnet, wird nie aus einem Suchpfad genommen); eine gefundene Datei
  kommt wie eine aufgeführte Quelle zum Ziel, und ihre eigenen Verweise werden
  auf dieselbe Weise aufgelöst. Eine aufgeführte Quelle mit dem Namen eines
  Clause-Moduls ersetzt dieses, mit einer Warnung.
- Wildcards: `*` und `?` innerhalb einer Komponente, `**` als ganze Komponente.
  Eckige und geschweifte Klammern, Negation und Maskierungen werden abgewiesen.
  Das Matching beachtet die Groß-/Kleinschreibung; `?` ist ein Unicode-Skalar
  eines gültigen UTF-8-Namens.
- Versteckte Einträge werden eingeschlossen; gefundene Verzeichnis-Symlinks
  werden übersprungen (explizite Wurzeln dürfen Symlinks sein); Datei-Symlinks
  wird gefolgt.
- Reihenfolge: Einträge von `sources` der Reihe nach, die Treffer jedes Musters
  nach UTF-8-Pfadbytes sortiert, dann jede Expansion von `source_dirs` auf
  dieselbe Weise sortiert. Fehlende Literale, Muster ohne Treffer und leere Ziele
  sind Fehler.
- Die Deduplizierung innerhalb eines Ziels verwendet die Identität im
  Dateisystem (Symlinks, Hardlinks, Aliase durch Groß-/Kleinschreibung) und
  behält die erste Schreibweise. Dieselbe Datei in zwei Zielen wird zweimal
  kompiliert, da sich die Optionen unterscheiden können.
- Nur ausgewählte Ziele greifen auf das Dateisystem zu.

### Verzeichnisindex

Lookups nach Namen sondieren nicht jedes Kandidatenverzeichnis. Ein Index pro
Aufruf von `clau`, von allen Zielen geteilt, hält die Eintragsnamen jedes
durchsuchten Verzeichnisses: einmal nicht rekursiv aufgelistet, wenn ein Lookup
es zum ersten Mal braucht, oder von den rekursiven Durchläufen verzeichnet, die
`**` in `sources`, `source_dirs`, `source_search_paths`, `include_dirs` und
`transform_paths` expandieren, sodass kein Verzeichnis zweimal aufgelistet
wird. Er beantwortet die Fehltreffer der Modulsuche (die Bibliothek, dann
`source_search_paths`), Transformationsquellen, literale `sources`, die über
`source_search_paths` gefunden werden, und die Include-Auflösung (das
Verzeichnis der einbindenden Datei, das Arbeitsverzeichnis, Include-Verzeichnisse
der Reihe nach, dann `include_lib`-Anwendungen); ein Kandidat, den der Index
hält, wird weiterhin wie zuvor geöffnet oder geprüft, sodass sich Vorrang,
`ignore_dirs` und Fehlerberichte nicht ändern. Include-Namen mit
Verzeichnisteilen (`sub/x.hrl`) werden in dem Verzeichnis nachgeschlagen, das
sie benennen; Namen mit `..`-Schritten, absolute Namen, relative Verzeichnisse
und fehlgeschlagene Auflistungen werden wie zuvor sondiert.

- Dateinamenschlüssel falten unter Windows und macOS, deren Volumes
  Groß-/Kleinschreibung standardmäßig ignorieren, die ASCII-Schreibung, sodass
  `Foo.hrl` weiterhin `foo.hrl` findet; anderswo sind Schlüssel exakt. Namen,
  die das Falten nicht exakt abgleichen kann (dort Nicht-ASCII-Namen sowie unter
  Windows Namen, die auf `.` oder ein Leerzeichen enden oder `~` enthalten, was
  8.3-Kurznamen sein können), werden sondiert.
- Der Index ist ein Schnappschuss eines Aufrufs: Dateien, die erscheinen,
  während `clau` läuft (Link-Staging, Ausgaben), sind nie Sucheingaben.
- `--verbose` endet mit `[index] listed=N walked=N lookups=N misses=N probes=N`
  (bei Bedarf aufgelistete Verzeichnisse, von Durchläufen verzeichnete
  Auflistungen, vom Index beantwortete Lookups und die Fehltreffer darunter,
  einer Sondierung überlassene Lookups). Bei luerl (2026-10-11) beantwortet er
  alle 15.215 Lookups (14.909 Fehltreffer) aus 66 Auflistungen und 1.380
  durchlaufenen Verzeichnissen.

## Ignorierte Quellen

`ignore_dirs` und `ignore_modules` halten Quellen aus einem Ziel heraus, ohne
sie aus dem Baum zu entfernen, z. B. mitgelieferte Tests, Altcode oder Module,
die nur unter OTP eine Rolle spielen. Eine ignorierte Quelle wird stillschweigend
übersprungen: Sie wird nie gelesen, geparst, kompiliert oder gelinkt, darf also
sogar Syntaxfehler enthalten.

- `ignore_dirs`: manifestrelative (oder absolute) Pfade mit den
  [Wildcards](#paths-and-discovery) von `sources`. Eine Quelle wird ignoriert,
  wenn ihr Pfad oder ein Verzeichnis, das sie enthält, passt: `src/legacy`,
  `deps/*/test`, `**/test` (jedes Verzeichnis `test`), `src/*_SUITE.erl`. Das
  Matching ist lexikalisch; ein Muster muss auf nichts passen.
- `ignore_modules`: Modulnamen oder Namensmuster mit `*` und `?`, gegen den
  ganzen Namen gematcht (`*_SUITE`, `legacy_*`, `prim_???`). Eine Quelle namens
  `<Module>.erl` (oder `.abstr`) wird ignoriert, wenn ein Eintrag auf `<Module>`
  passt, und nach einem referenzierten Modul, das passt, wird nie gesucht. Das
  schließt Clauses [Bibliotheksmodule](library.md#which-module-a-name-resolves-to)
  ein.
- Eine Quelle, die `sources` literal (ohne Wildcard) aufführt, wird nie
  ignoriert: Die Regeln wirken nicht auf sie, und der Build warnt `listed in
  sources but matched by ignore_modules or ignore_dirs; ignoring it has no
  effect` (Vorgabe des Nutzers 2026-10-12). Wildcard-Treffer und `source_dirs`
  werden wie beschrieben ignoriert.
- Beide gelten für `sources`, `source_dirs`, literale Quellen, die über
  `source_search_paths` gefunden werden, die [Modulsuche](#paths-and-discovery)
  in `source_search_paths` und der Bibliothek sowie die Suche nach
  [Quellen von Parse-Transformationen](transforms.md#transform-modules). Eine
  Suche übergeht eine ignorierte `Module.erl` und sucht in späteren
  Verzeichnissen weiter.
- Ein Modul ist ignoriert, wenn `ignore_modules` es benennt oder wenn keine
  Batch-Quelle es definiert und seine einzigen gefundenen Quellen ignoriert
  wurden (bei der Suche oder nach Dateiname aus den Quellen des Ziels
  übersprungen). Ein Modul, das eine kompilierte Quelle definiert, ist nie
  ignoriert.
- Verweise auf ein ignoriertes Modul (`M:F(...)`, `-import`, `fun M:F/A`,
  `apply(M, F, [...])` mit literalen Namen) erreichen ein erzeugtes
  Platzhaltermodul `M`, das jede so benannte Funktion exportiert; jede davon
  gibt `{module_ignored, M}` zurück, statt zu laufen. Eine Funktion, die der
  Batch nie literal benennt, bleibt für dynamische Aufrufe `undef`. Ein Typ
  eines ignorierten Moduls, der in einer Spec oder einem Typ benannt wird
  (`helper:result()`), warnt `attempt to import a type from a module ignored in
  project settings: helper:result` und wird als `term()` behandelt.
  `-behaviour(M)` mit einem ignorierten `M` warnt `behaviour M undefined`.
- `--print-inputs` listet jedes ignorierte referenzierte Modul nach den
  hinzugefügten Quellen als
  `ignored module <name> (referenced at <file>:<line>)` auf; `--print-env` gibt
  beide Schlüssel aus.

```toml
[targets.options]
source_search_paths = ["deps/**"]
ignore_dirs = ["deps/*/test", "src/legacy"]
ignore_modules = ["telemetry", "*_SUITE"]
```

## Wirksame Optionen

| Einstellung | Kombination aus Manifest und CLI |
| --- | --- |
| `include_dirs` | Manifestreihenfolge, nach CLI-`-I` (letztes CLI-`-I` wird zuerst durchsucht); ein Eintrag mit Wildcards (`deps/*/include`, `apps/**/include`) expandiert an Ort und Stelle zu den vorhandenen Verzeichnissen, auf die er passt, sortiert nach UTF-8-Pfadbytes (`**` passt auch auf keines, Verzeichnis-Symlinks werden übersprungen); ein Muster ohne Treffer ist ein Fehler |
| `source_search_paths` | Ersatzwurzeln für literale Quellen und die Module, die das Ziel benennt, aber nicht aufführt; Muster expandieren wie bei `include_dirs` (ohne Treffer: `unmatched source search path pattern`) |
| `defines` | Zuerst Manifest, dann CLI; Duplikate über beide hinweg sind Fehler |
| `applications` | Manifest-Map; CLI-Einträge ersetzen gleichnamige |
| Feature-Listen | Manifesteinstellungen, dann geordnete CLI-Änderungen; CLI gewinnt |
| `output` | Pro Ziel, nur ausführbare Ziele; CLI-`-o` überschreibt für ein einzelnes ausgewähltes Ziel |
| `entry` | Pro Ziel; CLI-`--entry` überschreibt für ein einzelnes ausgewähltes Ziel |
| `cache_inference_in_dirs` | Implizite OTP-Muster, dann die des Manifests, dann CLI-`--cache-inference-in-dirs` ([Inferenz-Cache](#inference-cache)) |

## Build-Abhängigkeit

Compiler-internes toml++ 3.4.0 (MIT), nur Header, mit Ausnahmen, nicht
veröffentlichte Syntax deaktiviert. SHA-256 des Archivs
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS: `brew install tomlplusplus` (Formel 3.4.0) wird erkannt.
- Windows: CMake lädt das Release nach `thirdparty/` herunter und verifiziert es.
- Anderswo: installieren, nach `thirdparty/tomlplusplus-3.4.0` entpacken oder
  `-DCLAUSE_TOML_ROOT=<path>` übergeben (hat Vorrang, deaktiviert den Download).
- Reine Runtime-Builds suchen nicht danach.

Der [Build-Cache](#build-caches) verwendet das SQLite-3.54.0-Amalgamat
(gemeinfrei), nur in die Cache-Bibliothek des Compilers kompiliert
(`clause_sqlite`, ohne die Warnungsflags des Projekts). CMake lädt
`https://www.sqlite.org/2026/sqlite-amalgamation-3540000.zip` auf jedem Host
nach `thirdparty/` herunter und verifiziert seine SHA-256
`68e913b0fe8ec6b4e5f391c594a28872884e80d6cd042a1e50c957be46b5aa4d`;
`-DCLAUSE_SQLITE_ROOT=<directory with sqlite3.c and sqlite3.h>` hat Vorrang und
deaktiviert den Download.

## Grenzen

Manifestgröße 1 MiB; höchstens 1.024 Ziele und 100.000 TOML-Knoten. Jede
Quellenexpansion erlaubt 100.000 besuchte Einträge, 128 Verzeichnisebenen und
16.000.000 Wildcard-Übergänge. Erschöpfung ist ein expliziter Fehler; dies sind
Arbeitsgrenzen, keine I/O-Fristen.
