---
source: docs/native-records.md
sourceCommit: a8c3f8f6
sourceSha256: b3cd9f802ea845b9145cd2ca30525129bb74dce96fc0d1da55c515a295eabf0e
translatedAt: 2026-10-17
---
# Native Records

Die Record-Formen von OTP 29 jenseits gewöhnlicher Tupel-Records: ihre
Darstellung, Operationen und Fehler. Tupel-Records stehen unter
[Terme](terms.md#records).

OTP 29 kennzeichnet native Records als experimentell. Die folgenden Fakten
stammen aus den festgelegten `maint-29`-Quellen (`erl_lint`,
`erl_expand_records`, `v3_core`, `beam_core_to_ssa`,
`erts/emulator/beam/erl_record.c`, `utils.c`, `erl_printf_term.c`) und aus
Live-Proben mit OTP 29.1.1.

## Umfang

Alle drei Formen jenseits der Tupel-Records sind implementiert und teilen eine
Darstellung:

| Form | Syntax |
| --- | --- |
| Nativer Record, lokal | `-record #r{...}.`, `#r{...}`, `X#r.f`, `X#r{...}`, Muster, `is_record/1,2,3` |
| Qualifiziert und importiert | `#m:r{...}`, `X#m:r.f`, `X#m:r{...}`, Muster; `-export_record`, `-import_record` |
| Inferiert (anonym) | `X#_.f`, `X#_{...}`, Muster `#_{...}` |

Nicht vorhanden: das Reflexionsmodul `records` (Aufrufe von `records:*` sind
Diagnosen `unknown module`), `term_to_binary` nativer Records (`error:notsup`,
[externes Termformat](builtins.md#external-term-format)) und Hot Code Upgrade.

## Darstellung

- **Deskriptor.** Jede Definition eines nativen Records wird zu einem
  unveränderlichen `abi::v1::RecordDescriptor` neben ihrem Moduldeskriptor
  kompiliert: der definierende `ModuleDescriptor`, Atom-Slots für Modul- und
  Record-Namen, das Export-Flag (`-export_record` zur Compile-Zeit) und die
  Atom-Slots der Feldnamen in Definitionsreihenfolge. Atom-Slots werden über die
  registrierten Atome des Moduls aufgelöst, wie die Namen in
  `FrameDescriptor`. Programme sind statisch (kein Entladen), daher lebt ein
  Deskriptor so lange wie das Programm; ein anderes Modul des Batches verweist
  per Symbol auf ihn. Standardwerte werden in jede Konstruktionsstelle
  kompiliert, nie gespeichert.
- **Instanz.** Heap-Zelle der Art `native_record`: Header (Anzahl `1 + n`), ein
  nicht verfolgtes Deskriptorwort, dann `n` verfolgte Werte in
  Definitionsreihenfolge. Ein Record ohne Felder ist eine Zelle aus zwei
  Wörtern.
- Der Deskriptor hält Modul, Name, Export-Flag und Feldliste bei der
  Konstruktion fest, wie die erfasste Definition von OTP. Jede Operation nach
  der Konstruktion liest den Deskriptor der Instanz, nie den Code, der sie
  ausführt.
- Kopieren, Speicherbereinigung, Durchlauf und Verifikation behandeln die Zelle
  wie ein Tupel, dessen erstes Nutzdatenwort nicht verfolgt wird. Die Zulassung
  erfordert einen Deskriptor, der von einem Modul derselben Runtime registriert
  wurde.

## Operationen

`M` ist das aktuelle Modul. Alle Fehler haben die Klasse `error`;
badrecord-Nutzlasten sind der fehlerhafte Wert, außer bei fehlgeschlagener
externer Konstruktion.

| Operation | Akzeptiert | Fehlschlag |
| --- | --- | --- |
| Lokale Konstruktion `#r{...}` | Immer (Definition ist lokal) | Unbekanntes Feld oder fehlender Wert sind Kompilierfehler |
| Externe Konstruktion `#m:r{...}` (auch importiertes `#r{...}`, auch `#M:r`) | `m:r` im Batch definiert und exportiert | `{badrecord, {m, r}}`; dann `{badfield, {{m, r}, F}}`, `{novalue, {{m, r}, F}}` (badfield gewinnt) |
| Lokaler Zugriff `X#r.f` | Nativer Record namens `r` (Modul und Export-Flag werden **nicht** geprüft, wie in der Runtime von OTP) | `{badrecord, X}`; fehlendes Feld `{badfield, {{Mod, r}, f}}` |
| Externer Zugriff `X#m:r.f` | Modul `m`, Name `r`, exportiert | `{badrecord, X}`; `{badfield, ...}` |
| Anonymer Zugriff `X#_.f` | Jeder native Record (Export wird **nicht** geprüft, wie in der Runtime von OTP) | `{badrecord, X}`; `{badfield, ...}` |
| Lokale Aktualisierung `X#r{...}` | Modul `M`, Name `r` | `{badrecord, X}`; unbekanntes Feld `{badfield, ...}` |
| Externe Aktualisierung `X#m:r{...}` | Exportiert, Modul `m`, Name `r` | ebenso |
| Anonyme Aktualisierung `X#_{...}` | Exportiert oder Modul `M` | ebenso |
| Lokales Muster `#r{...}` | Modul `M`, Name `r`, jedes aufgeführte Feld vorhanden | kein Match |
| Externes Muster `#m:r{...}` | Modul `m`, Name `r`; exportiert, wenn ein Feld aufgeführt ist | kein Match |
| Anonymes Muster `#_{...}` | Jeder native Record; exportiert oder Modul `M`, wenn ein Feld aufgeführt ist | kein Match |

- Die Konstruktion wertet die angegebenen Felder in Quelltextreihenfolge aus
  (Standardwerte sind Literale); eine Aktualisierung wertet zuerst den Record
  aus, dann die neuen Werte in Quelltextreihenfolge, anders als eine
  Aktualisierung eines Tupel-Records. Leere Aktualisierungen prüfen trotzdem.
- Guards: nur Feldzugriff (ein Fehlschlag lässt den Guard fehlschlagen) und
  `is_record`. Konstruktion in einem Guard ergibt `creating a record in a guard
  is only supported for tuple records`; Aktualisierung ergibt
  `illegal guard expression`.
- `is_record(X)` ist nur für native Records wahr. `is_record(X, r)` mit einem
  lokalen nativen `r` prüft Modul `M` und Name `r`; mit einem aus `m`
  importierten `r` prüft es Modul `m`. `is_record(X, m, r)` mit Atomen prüft
  Modul und Name; mit einer Ganzzahl ist es der Tupeltest.
- Native Records sind keine Tupel: `is_tuple` ist false; Element- und
  Größendienste weisen sie ab.

## Regeln zur Compile-Zeit

Die Meldungen folgen `erl_lint`:

- Standardwerte müssen nach der Konstantenfaltung literal sein (Zahlen, Atome,
  Zeichenketten, `[]`, Conses/Tupel/Maps daraus, Binaries nur aus
  Zeichenketten): `illegal default value for field a in native record r`.
- Lokale Konstruktion ohne Wert für ein Feld ohne Standardwert:
  `field a is not initialized in native record r`; unbekanntes Feld:
  `field zz undefined in record r`. Unbekannte Felder in Zugriff,
  Aktualisierung und Mustern werden akzeptiert (OTP warnt nur); sie schlagen zur
  Laufzeit fehl.
- Index `#r.a`, `record_info/2`, Initialisierer `_ = V` und typisierte
  Feldverfeinerungen gibt es nur für Tupel-Records, mit den Meldungen von OTP.
- Ein Name ist entweder ein Tupel-Record, ein nativer Record oder ein
  importierter Record; Konflikte und fehlerhafte Formen von
  `-export_record`/`-import_record` sind Fehler. `-export_record` muss vor den
  Funktionsdefinitionen stehen.
- Externe Formen, die ein Modul außerhalb des Batches, einen undefinierten oder
  einen nicht exportierten Record benennen, kompilieren und schlagen wie in OTP
  zur Laufzeit fehl. Externe Konstruktion wird zur Compile-Zeit gegen den Batch
  aufgelöst: Das importierende Modul führt das Lowering der literalen
  Standardwerte des definierenden Moduls selbst durch und referenziert dessen
  exportierten Deskriptor; unbekannte Felder lösen `badfield` aus, bevor ein
  fehlender Wert `novalue` auslöst (`ErrorReason` 21).

## Ausgabe und Ordnung

- `erlang:display/1` gibt `#m:r{a=1,b=2}` aus: keine Leerzeichen, Felder in
  Definitionsreihenfolge (OTP: Reihenfolge der Atomtabellen-Indizes,
  [Unterschiede](differences.md#maps)).
- Term-Ordnung: Tupel < nativer Record < Map. Records werden nach Modul, Name,
  Export-Flag (false zuerst), Feldanzahl, Feldnamen in Definitionsreihenfolge
  und dann Werten in Definitionsreihenfolge verglichen. `=:=` verlangt
  zusätzlich dieselbe Feldreihenfolge; `==` vergleicht Werte numerisch (der
  Compiler von OTP faltet manche `==` auf Records zu `=:=`,
  [Unterschiede](differences.md#maps); befolgt wird die Runtime-Regel).

## Beibehaltene Unterschiede

Feldreihenfolge der Ausgabe, Faltung von `==`, externe Konstruktion nicht
geladener Module und fehlende Record-Warnungen sind unter
[Unterschiede](differences.md#maps) festgehalten.
