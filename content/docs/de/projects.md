---
source: docs/projects.md
sourceCommit: 06042fa
sourceSha256: fede4b3ed0440e1032fd9d7e0bad11ee107bc68c2c08dfa3b1add7b9fbc880c1
translatedAt: 2026-10-09
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

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]

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
  nach `.erl`) sind optional, aber ein Ziel braucht mindestens einen Eintrag.
  Explizite Dateien müssen auf `.erl` enden; Header sind Abhängigkeiten, keine
  Eingaben.
- Die Felder von `options` sind optionale typisierte Frontend-Optionen.
  `defines` verwenden `NAME` (= `true`) oder `NAME=ERLANG_LITERAL_TERM`;
  Duplikate sind Fehler. Ein Feature darf nicht in beiden Feature-Listen stehen.
- `entry` (optional) wählt den Einstieg der ausführbaren Datei
  `MODULE[:FUNCTION]`; siehe
  [ausführbare Dateien](executables.md#entry-selection). Das CLI-`--entry`
  überschreibt es für ein einzelnes ausgewähltes Ziel.
- `output` ist das Ziel der ausführbaren Datei, Standard
  `<manifest-dir>/build/<target>` (`.exe` unter Windows). Ein Ziel mit `output`
  oder `entry` ist ein ausführbares Ziel
  ([ausführbare Dateien](#executables)); `--emit` und Prüf-/Ausgabemodi
  ignorieren die Ausgaben beider Schlüssel.
- Noch nicht unterstützt: Standards auf Wurzelebene, Vererbung,
  Zielabhängigkeiten, Importe, Profile, Ausschlüsse, Pakete, Watch, Caching,
  parallele Builds. Felder werden nur zusammen mit ihrem Verhalten hinzugefügt.

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
- Exit-Code 2: Verwendungsfehler und unbekannte Ziele. Exit-Code 1: Fehler bei
  Manifest, Suche, Frontend oder Erstellung. Exit-Code 0: Erfolg (Warnungen
  erlaubt).

Jedes ausgewählte Ziel ist ein separater Kompilier-Batch mit eigenen
Präprozessor-Sitzungen. Die Planung (Dekodieren, Auswählen, Suchen, Prüfen auf
Ausgabekollisionen) ist abgeschlossen, bevor irgendeine Quelle läuft; die
Ausführung verarbeitet dann Ziele/Dateien der Reihe nach und hält Fehlschläge
fest. Nutzausgaben gehen ohne Banner in Ziel-/Dateireihenfolge nach stdout;
Kontext und Diagnosen gehen nach stderr.

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

## Pfade und Suche

- Der Projektpfad wird gegen das Aufrufverzeichnis aufgelöst; das lexikalische
  übergeordnete Verzeichnis des Manifests ist die Basis für alle Manifestpfade
  (auch über einen Symlink). Absolute Pfade bleiben absolut; `..` ist erlaubt.
  Keine Shell-, Umgebungs- oder Tilde-Expansion. Für Windows-Pfade `/` oder
  literale TOML-Zeichenketten verwenden.
- Literale relative Quellen versuchen zuerst die Basis, dann der Reihe nach
  `source_search_paths`. Ein vorhandener, aber nicht lesbarer Kandidat ist ein
  Fehler. Suchpfade finden nur aufgeführte Dateien; sie zählen keine Module auf
  und beeinflussen keine Includes.
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

## Wirksame Optionen

| Einstellung | Kombination aus Manifest und CLI |
| --- | --- |
| `include_dirs` | Manifestreihenfolge, nach CLI-`-I` (letztes CLI-`-I` wird zuerst durchsucht) |
| `source_search_paths` | Nur Suche nach Projektquellen |
| `defines` | Zuerst Manifest, dann CLI; Duplikate über beide hinweg sind Fehler |
| `applications` | Manifest-Map; CLI-Einträge ersetzen gleichnamige |
| Feature-Listen | Manifesteinstellungen, dann geordnete CLI-Änderungen; CLI gewinnt |
| `output` | Pro Ziel, nur ausführbare Ziele; CLI-`-o` überschreibt für ein einzelnes ausgewähltes Ziel |
| `entry` | Pro Ziel; CLI-`--entry` überschreibt für ein einzelnes ausgewähltes Ziel |

## Build-Abhängigkeit

Compiler-internes toml++ 3.4.0 (MIT), nur Header, mit Ausnahmen, nicht
veröffentlichte Syntax deaktiviert. SHA-256 des Archivs
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS: `brew install tomlplusplus` (Formel 3.4.0) wird erkannt.
- Windows: CMake lädt das Release nach `thirdparty/` herunter und verifiziert es.
- Anderswo: installieren, nach `thirdparty/tomlplusplus-3.4.0` entpacken oder
  `-DCLAUSE_TOML_ROOT=<path>` übergeben (hat Vorrang, deaktiviert den Download).
- Reine Runtime-Builds suchen nicht danach.

## Grenzen

Manifestgröße 1 MiB; höchstens 1.024 Ziele und 100.000 TOML-Knoten. Jede
Quellenexpansion erlaubt 100.000 besuchte Einträge, 128 Verzeichnisebenen und
16.000.000 Wildcard-Übergänge. Erschöpfung ist ein expliziter Fehler; dies sind
Arbeitsgrenzen, keine I/O-Fristen.
