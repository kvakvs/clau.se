---
source: docs/asn1.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: fc528bb80707fa028fab896cf045bdf94eebb64ce17aa24704db249ed19cbe6b
translatedAt: 2026-10-26
---
# ASN.1-Spezifikationen

Clau kompiliert ASN.1-Spezifikationen (`.asn`, `.asn1` und `.set.asn`-Modullisten)
wie OTPs `asn1ct` in Erlang-Module: `Module.erl` mit `encode/2`, `decode/2` und
den Werten des Moduls sowie `Module.hrl` mit seinen records und Makros. Das
generierte Modul wird wie jede andere Quelldatei in den Stapel aufgenommen;
seine Kodierung und Dekodierung laufen in der C++-Engine für BER, DER und PER
von `clause_runtime` (kein OpenSSL erforderlich). Die Spezifikationen von OTPs
`public_key` werden auf dieselbe Weise kompiliert.

## Eingaben

Positionale Eingaben mit der Endung `.asn` oder `.asn1` sind Spezifikationen:

```sh
clau --asn1-option der --asn1-outdir gen Kitchen.asn main.erl -o app
clau --generate-asn1 --asn1-outdir gen Kitchen.asn   # only write gen/Kitchen.erl and gen/Kitchen.hrl
```

| Option | Bedeutung |
| --- | --- |
| `--asn1-option <option>` | Eine `asn1ct`-Option für alle Spezifikationen des Aufrufs; wiederholbar. Standard: `ber`. |
| `--asn1-outdir <dir>` | Verzeichnis, in das `Module.erl` und `Module.hrl` geschrieben werden (`outdir` von asn1ct); standardmäßig das aktuelle Verzeichnis. Das Verzeichnis wird in den Include-Pfad aufgenommen, sodass `-include("Module.hrl").` funktioniert. |
| `--generate-asn1` | Nur die generierten Module und Header schreiben; nichts kompilieren. |
| `-I <dir>` | Wird auch nach importierten ASN.1-Modulen durchsucht (`i` von asn1ct), nach dem eigenen Verzeichnis der Spezifikation. |

Ein Projektziel führt Spezifikationen in `[[targets.asn1]]`-Gruppen auf, die
jeweils mit eigenen Optionen kompiliert werden:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[[targets.asn1]]
sources = ["asn1/*.asn"]
options = ["per", "noobj"]
outdir = "build/gen"   # default: asn1/ in the target's build directory
```

`sources` (erforderlich) akzeptiert wie die Quelldateien des Ziels Dateien und
Platzhaltermuster und berücksichtigt `.asn` und `.asn1`; ein Muster ohne Treffer
ist ein Fehler. Importe werden in den Verzeichnissen der Spezifikationen der
Gruppe gesucht. Ein generiertes Modul, das bereits unter den Quelldateien des
Ziels aufgeführt ist, wird nicht doppelt hinzugefügt. `outdir` wird in den
Include-Pfad des Ziels aufgenommen.

Eine `.set.asn`-Datei führt pro Zeile eine Moduldatei auf (zusammengeführte
Kompilierung von asn1ct); jeder Name wird unverändert ausprobiert, dann mit
angehängtem `.asn1`, `.asn` und `.py`. Das zusammengeführte Modul erhält den
Namen der Set-Datei.

## Optionen

| Option | Wirkung |
| --- | --- |
| `ber` | Basic Encoding Rules (Standard). |
| `der` | Distinguished Encoding Rules: `ber` mit sortiertem `SET`/`SET OF`, ausgelassenen `DEFAULT`-Werten und DER-Prüfungen. |
| `maps` | `SEQUENCE`/`SET`-Werte sind maps; fehlende Komponenten werden weggelassen. |
| `undec_rest` | `decode/2` liefert `{ok, Value, Rest}` mit den Bytes nach dem Wert. |
| `no_ok_wrapper` | `encode/2` und `decode/2` liefern den Wert selbst und lösen bei Fehlern Ausnahmen aus. |
| `legacy_erlang_types` | `BIT STRING`- und `OCTET STRING`-Werte als Listen, `{Unused, Binary}` und Ganzzahlen werden akzeptiert. |
| `legacy_bit_string`, `compact_bit_string` | Alte `BIT STRING`-Formen (Listen aus 0 und 1, `{Unused, Binary}`); implizieren `legacy_erlang_types`. |
| `noobj`, `asn1config`, `verbose`, `warnings`, `errors`, `deterministic` | Akzeptiert, ändern nichts. |
| `per`, `uper` | Packed Encoding Rules, ausgerichtet und nicht ausgerichtet ([PER](#per)). |
| `no_final_padding` | Mit `uper`: `encode/2` liefert die Bits ohne Auffüllung auf ein Oktett (einen bitstring). |
| `jer` | Abgelehnt: `jer (JSON encoding rules) is not supported`. |

Jede andere Option führt zu `unknown ASN.1 option 'Name'` (Exit-Status 2).

## Abdeckung

Die von OTPs PKIX- und PKCS-Modulen sowie den Spezifikationen von emqx
verwendeten Konstrukte aus X.680/X.681/X.682/X.683:

- Typen: `BOOLEAN`, `INTEGER` mit benannten Zahlen, `ENUMERATED` mit
  Erweiterungen, `NULL`, `BIT STRING` mit benannten Bits, `OCTET STRING`,
  `OBJECT IDENTIFIER`, `RELATIVE-OID`, `REAL`, die eingeschränkten
  Zeichenkettentypen, `UTCTime`, `GeneralizedTime`, `ObjectDescriptor`,
  `SEQUENCE`, `SET`, `SEQUENCE OF`, `SET OF`, `CHOICE`, `ANY`, `ANY DEFINED BY`,
  `INSTANCE OF`, offene Typen, Selektionstypen (`name < Type`).
- Tagging: explizite, implizite und automatische Tags, Modulvorgaben,
  `COMPONENTS OF`, Erweiterungsmarkierungen, Gruppen von Erweiterungszusätzen
  und die Komponenten nach den Erweiterungen.
- Einschränkungen: Einzelwerte, Bereiche, `SIZE`, `FROM`, Vereinigungen und
  Schnittmengen (ausgewertet für die Grenzen, die BER prüft und PER kodiert);
  `WITH COMPONENT(S)`, `CONTAINING`, `PATTERN`, `CONSTRAINED BY` und `INCLUDES`
  werden wie bei asn1ct geparst, aber nicht geprüft.
- Informationsobjekte: Klassen mit `WITH SYNTAX`, `TYPE-IDENTIFIER`,
  `ABSTRACT-SYNTAX`, Objekte, Objektmengen (Vereinigungen, erweiterbare Mengen,
  Mengen aus anderen Mengen und Objektfeldern), einfache und auf
  Komponentenbeziehungen beruhende Tabelleneinschränkungen (`{Set}{@a.b}`,
  über den Typ des Objekts dekodiert und kodiert).
- Parametrisierte Typen, Objekte und Objektmengen; Importe zwischen Modulen;
  `DEFAULT`-Werte jedes Typs.

Nicht unterstützt, jeweils mit einem Fehler an der betreffenden Position:
`EXTERNAL`, `EMBEDDED PDV` und `CHARACTER STRING` (`unsupported ASN.1
type`), parametrisierte Werte, aus Objektmengen extrahierte Objekte,
`MACRO`-Definitionen und Wertnotationen, die OTPs Spezifikationen nicht verwenden
(`unsupported value notation`).

## Generierte Module

`Module.erl` exportiert dasselbe wie das Modul von asn1ct: `encoding_rule/0`,
`maps/0`, `bit_string_format/0`, `legacy_erlang_types/0`, `encode/2`, `decode/2`,
`info/0` und eine Funktion pro Wertzuweisung. records und ihre Namen folgen
asn1ct (innere Typen nach ihrem Pfad benannt, `SEQOF`/`SETOF` für
Sammlungselemente, parametrisierte Instanzen), sodass `Module.hrl` abgesehen
von der ersten Kommentarzeile mit der Ausgabe von asn1ct identisch ist; Werte
werden wie von asn1ct ausgegeben.

`encode/2` und `decode/2` liefern `{ok, Value}` oder `{error, {asn1, Reason}}`
mit den Fehlergründen von asn1ct (`{bad_range, ...}`, `{unexpected, ...}`,
`{invalid_choice_type, ...}`, `{'Type not compatible with table constraint', ...}`,
die TLV-Fehler von `asn1rt_nif`); die Dekodierung behält die Nachsicht und
Eigenheiten von asn1ct bei (unbekannte Erweiterungskomponenten werden
übersprungen, `{asn1_OPENTYPE, Bytes}` und `{asn1_ExtAlt, Bytes}` für unbekannte
Werte offener Typen und von `CHOICE`, `{asn1_enum, N}`).

Die generierten Funktionen rufen `clause_asn1:encode/3` und
`clause_asn1:decode/3` mit einem Schematerm auf: `{asn1_schema, 1,
Rule, Flags, #{Type => Node}, Nodes}`. Jeder Knoten ist
`{Kind, Tags, Fields...}` (Arten in der Reihenfolge von `NodeKind` des Compilers,
Tags als `Number bsl 2 bor Class`; Grenzen `{Lower, Upper, Extensible}` mit den
Wurzelwerten einer erweiterbaren Einzelwertliste als viertem Element,
eingeschränkte Zeichenketten mit ihrem PER-Alphabet, Komponenten mit ihrem
Kennzeichen für die Erweiterungsgruppe); das Format ist Clause-intern und kann
sich ändern.

## PER

`per` (ausgerichtet) und `uper` (nicht ausgerichtet) folgen dem von asn1ct
generierten Code und `asn1rtt_per`/`asn1rtt_uper`/`asn1rtt_per_common` Byte für
Byte (X.691 in der Implementierung von OTP):

- Für PER sichtbare Einschränkungen, wie sie asn1cts `effective_constraint/2`
  berechnet: Wertebereiche (eingeschränkte, teilweise eingeschränkte und
  uneingeschränkte ganze Zahlen), `SIZE`-Grenzen unter 64K (größere werden als
  uneingeschränkte Längen kodiert), erweiterbare Wurzeln (eine erweiterbare Liste
  von Einzelwerten kodiert nur diese Werte als Wurzelwerte) und `FROM`-Alphabete
  der Zeichenkettentypen mit bekanntem Multiplikator (`NumericString`,
  `PrintableString`, `VisibleString`, `IA5String`, `BMPString`, `UniversalString`,
  `UTCTime`, `GeneralizedTime`), deren Zeichen als Indizes dargestellt werden,
  wenn ihre Codes nicht in die Zeichenbreite passen.
- Wurzelkomponenten von `SET` werden in Tag-Reihenfolge kodiert,
  `CHOICE`-Alternativen in Textreihenfolge (wie bei asn1ct, nicht in der
  kanonischen Reihenfolge von X.691), `ENUMERATED`-Elemente nach Wert;
  Erweiterungszusätze sind offene Typen, eine Erweiterungsgruppe ist eine
  `SEQUENCE` ihrer Komponenten; Fragmente oberhalb von 16K Einheiten (Oktette,
  Bits, Zeichen, Elemente).
- Die Eigenheiten von asn1ct bleiben erhalten: In einem record werden
  Erweiterungszusätze nach einer Gruppe aus mehreren Komponenten von den
  falschen Positionen gelesen (um die Gruppenlänge minus eins verschoben);
  Elemente offenen Typs einer `SEQUENCE OF` ignorieren ihre
  Tabelleneinschränkung; das Entfernen abschließender Nullbits eines vollständig
  aus Nullen bestehenden Endes eines benannten `BIT STRING` scheitert mit
  `badmatch`; fehlerhafte Eingaben scheitern mit `badmatch`, `case_clause` oder
  `function_clause` des generierten Codes auf den verbleibenden Bits.

## Diagnosen

Fehler enthalten Pfad, Zeile und Spalte der Spezifikation und beenden den Aufruf
(Exit-Status 1) vor der Erlang-Kompilierung:

```text
syntax.asn:4:1: error: expected '::=' near 'END'
undefined.asn:3:22: error: undefined reference Missing
import.asn:4:9: error: cannot find ASN.1 module Absent
empty.asn:1:1: error: no ASN.1 module found
```

Unterschiede zu asn1ct sind unter [differences.md](differences.md#asn1) aufgeführt.
