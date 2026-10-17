---
source: docs/preprocessor.md
sourceCommit: a8c3f8f6
sourceSha256: 57dcb1da3315eb173341c8100e17e37df776b01f85f4c06585c1b7e5d3503daf
translatedAt: 2026-10-17
---
# Präprozessor

Native C++-Neuimplementierung von OTPs `epp` für die festgelegte
`maint-29`-Quelle. Boost.Parser behandelt die Zeichenregeln; gemeinsame
Compiler-Metadaten liefern die Operatorrangfolge. Expandierte Tokens werden nie
in Quelltext zurückverwandelt.

`PreprocessorSession` liefert expandierte Formen (einschließlich impliziter
`-file`-Attribute), strukturierte Diagnosen und unveränderliche
Feature-Snapshots pro Form; `features()` stellt dem Parser den endgültigen
Sitzungszustand bereit. Dies ist eine interne Schnittstelle, kein öffentliches
Stufenformat. `DirectiveReader` ist die ältere, rein syntaktische API.

## Unterstütztes Verhalten

- Objektmakros und nach Stelligkeit überladene Makros, rohe Ersetzung,
  verschachtelte Block-/Fun-Argumente, Stringifizierung mit kanonischer
  Token-Schreibweise von OTP, Neudefinition, Aufheben der Definition und
  Diagnosen für Abhängigkeitszyklen.
- Verschachtelte Bedingungen mit übersprungenen Effekten und Fehlern,
  EOF-Diagnosen.
- `-include`/`-include_lib`, Pfadanfänge aus Umgebungsvariablen, abgesicherte
  Rekursion.
- `?MODULE`, `?BASE_MODULE` (und die `_STRING`-Formen), `?FILE`, `?LINE`,
  `?FUNCTION_NAME`/`?FUNCTION_ARITY`, `?FEATURE_AVAILABLE`/`?FEATURE_ENABLED`,
  `?OTP_RELEASE` (29) und `?MACHINE` (`'BEAM'`, nur für Quellkompatibilität).
- Guard-Auswertung von `-if`/`-elif` mit beliebigen Ganzzahlen und dem
  Guard-BIF-Katalog von OTP; es laufen keine beliebigen Aufrufe.
- Features von OTP 29.1: `maybe_expr` (standardmäßig aktiviert, steuert
  `maybe`/`else`) und `compr_assign` (experimentell, deaktiviert). Ein initiales
  `all` wählt beide; `-feature(all, ...)` im Quelltext ist ungültig, wie in epp.
  Andere Namen sind Fehler.

## Kompatibilitätsrichtlinien

- Include-Suche: Verzeichnis der aktuellen Datei, Arbeitsverzeichnis, dann
  Include-Pfade in API-Reihenfolge. Die CLI kehrt wiederholte `-I` um, um `erlc`
  zu entsprechen. Absolute Pfade umgehen die Suche. `include_lib` versucht
  gewöhnliche Pfade, dann explizit angegebene Anwendungsverzeichnisse, dann
  die Verzeichnisse `<app>-<version>` von Releases unterhalb jedes durchsuchten
  Verzeichnisses (Versionen sind durch Punkte getrennte Ziffern, wie sie der
  Code-Server von OTP liest; die höchste gewinnt). Mehrere Versionen einer
  Anwendung erzeugen einmal pro Lauf eine Warnung, die das verwendete
  Verzeichnis nennt; kein Code-Server.
- Pfadanfänge mit `$VAR` verwenden einen injizierten Resolver; nicht gesetzte
  Variablen bleiben literal. Include-Operanden werden nicht makroexpandiert.
  Dateien werden als UTF-8 oder deklariertes Latin-1 dekodiert; es gelten die
  Pfadregeln des Hosts, unabhängig von der Ziel-CPU.
- Includes teilen sich den Makro-, Feature- und Modulzustand; jede Datei besitzt
  ihren eigenen Bedingungsstack und ihre logische Dateizuordnung.
- Bedingungen validieren alle Zweige vor der Kurzschlussauswertung. Ungültige
  Syntax ist ein Fehler; ungebundene Variablen, nicht boolesche Ergebnisse und
  Ausnahmen bei der Auswertung wählen false. Zugriff auf Record-Felder/-Indizes
  in Bedingungen schlägt fehl; ein nicht gewählter Record-Zugriff im Kurzschluss
  ist gültig.
- Record-Konstruktion in einer Bedingung erhält eine kontrollierte Diagnose
  (`record construction requires record expansion`); epp von OTP 29.1 stürzt
  dort ab.
- Initialwerte von `-D` sind literale Terme, zu Tokens normalisiert,
  einschließlich Binaries und externer Funs, die `erl_parse:tokens/1` nicht
  darstellen kann.
- `self()` ist eine stabile synthetische Pid und `node()` ist `nonode@nohost`.
- Ein LF direkt nach dem abschließenden Punkt eines Includes erhöht die Zeile
  des zurückgegebenen `-file`; Leerzeichen, Kommentar und CRLF folgen dem
  Ein-Zeichen-`scan_dot` von OTP.

## Grenzen und Diagnosen

Standards (konfigurierbar über `PreprocessorLimits`): 256 Expansionsebenen und
1.000.000 erzeugte Tokens pro Form, Include-Tiefe 64, Ausdrucksverschachtelung
256, dazu feste Grenzen von 4.194.240 Bit für Ganzzahlen (die Grenze von OTP auf
64-Bit-Hosts) und 1.000.000 Bit für Bitstring-Werte. Erschöpfung ist eine
Ressourcendiagnose, nie eine stillschweigend falsche Bedingung.

Diagnosen enthalten eine stabile Kategorie, einen Schweregrad, physische
Bereiche, optionale logische Koordinaten und zugehörige Makro-/Include-Bereiche.
Warnungen führen nicht zum Fehlschlag; Fehler halten den Fehlschlag fest,
während die Wiederherstellung an der nächsten Formgrenze fortfährt.

## Tests

Token-Goldens (`tests/fixtures/preprocessor/semantic/*.erl.tokens`) halten
Token-Arten von epp, dekodierte Werte (Gleitkommazahlen als binary64-Bits) und
die Reihenfolge der Diagnosen fest; der Wortlaut muss nicht mit OTP
übereinstimmen. Eingebundene Header (`semantic/headers/*.hrl`) sind lokal
verfasst, nicht aus OTP kopiert.
`preprocessor_workflow` deckt echte Include-Bäume, Optionsreihenfolge, Umgebung,
Latin-1 und Bedingungsfälle über die CLI ab.
