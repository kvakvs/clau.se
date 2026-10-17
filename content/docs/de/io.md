---
source: docs/io.md
sourceCommit: a8c3f8f6
sourceSha256: 1a1dffbcffc7158bbd4b175979fb33aef895af149c1a3d78b4f773598432536a
translatedAt: 2026-10-17
---
# Konsolenausgabe (`io`)

`io:format/1,2,3`, `io:fwrite/1,2,3`, `io:put_chars/1,2` und `io:nl/0,1` sind
Runtime-Builtins des Moduls `io` im Brückenkatalog
([Builtins](builtins.md)); die Runtime implementiert die Regeln von
`io_lib_format` und `io_lib_pretty` aus OTP in C++
([io_format.cpp](../runtime/src/builtins/io_format.cpp),
[io_pretty.cpp](../runtime/src/builtins/io_pretty.cpp)). Die
Eingabefunktionen von `io` sind Erlang in der
[Bibliothek](library.md#contents).

## Aufrufe

- `io:format(Format)` ist `io:format(Format, [])`. Beide geben `ok` zurück.
  `io:fwrite/1,2,3` sind dasselbe wie `io:format/1,2,3`; `io:nl/0,1` schreiben
  einen Zeilenumbruch.
- Geräte von `io:format/3`, `io:fwrite/3`, `io:put_chars/2` und `io:nl/1`:
  `standard_io` und `user` sind die Standardausgabe, `standard_error` ist die
  Standardfehlerausgabe (die Standardausgabe wird zuerst geleert, sodass beide
  ihre Reihenfolge behalten). Eine pid oder ein darauf registriertes Atom ist
  ein I/O-Server: Der Text geht als UTF-8 über `file:write/2` an ihn (eine
  geöffnete Datei des Clause-Moduls `file`), und der Aufruf gibt zurück, was
  dieser zurückgibt. Ein nicht registriertes Atom ist `badarg`, eine tote pid
  `error:terminated`, der Aufrufer selbst `error:calling_self`, jeder andere
  Term `function_clause`, wie in OTP.
- `io:put_chars(Chardata)` schreibt Chardata: Unicode-Zeichen, UTF-8-Binaries
  und verschachtelte Listen, die auf `[]` oder ein Binary enden. Alles andere
  (ein Atom, ein Surrogat, ungültiges UTF-8, ein Bitstring) löst `badarg` aus.
- Text wird vollständig aufgebaut und dann als UTF-8 geschrieben, wie es das
  Standardausgabegerät von OTP im Modus `-noshell` tut (Kodierung `unicode`).
  Ein Fehler schreibt nichts. Ein abgewiesener Schreibvorgang ist der
  Runtime-Fehler `output_failure` (Exit 70).
- Qualifizierte Aufrufe, `fun io:format/2`, `apply(io, format, Args)` und
  `M:format(...)` erreichen alle die Builtins. Ein Batch-Modul namens `io`
  ersetzt die Builtins nicht (das `io` von OTP ist sticky,
  [Registrierung](builtins.md#registration)).

## Formate

- `Format` ist ein Atom (seine Zeichen), ein Binary (seine Bytes als
  Latin-1-Zeichen) oder eine Liste. Ein Listenelement, das kein Zeichen ist,
  ist Chardata, wird unverändert ohne Steuersequenzen geschrieben und rückt die
  Spalte um eins vor (eine Eigenheit von OTP).
- Steuersequenzen `~F.P.PadModC`: Feldbreite `F` (negativ oder `-`:
  linksbündig), Genauigkeit `P`, Füllzeichen, `*` entnimmt eine Ganzzahl (oder
  das Füllzeichen) den Argumenten, Modifikatoren `t` (Unicode), `l` (keine
  String-Erkennung) und `k` (geordnete Maps; Clause gibt Maps immer in
  Schlüsselreihenfolge aus).
- Unterstützte `C`: `~w`, `~p`, `~s`, `~c`, `~b`, `~B`, `~i`, `~n`, `~~`, mit
  den Feldregeln von OTP: `~s` kürzt oder füllt auf `P` innerhalb von `F`; `~w`
  und `~b` geben `*`-Zeichen aus, wenn der Text nicht in `F` passt; `~c`
  wiederholt das Zeichen; `~b`/`~B` nehmen die Basis aus `P` (2..36); `~n` mit
  `F` schreibt `F` Zeilenumbrüche.
- Ohne `t` nimmt `~s` nur Latin-1-Zeichen, und `~c` schreibt das niedrige Byte
  seiner Ganzzahl; `~w`/`~p` maskieren Atomzeichen jenseits von Latin-1 als
  `\x{...}`. Mit `t` liest `~s` Binaries als UTF-8 (mit Rückfall auf Latin-1),
  und `~p` schreibt `<<"..."/utf8>>` für druckbare UTF-8-Binaries.
- `badarg`: ein unbekanntes Steuerzeichen, fehlende oder überzählige
  Argumente, ein Argument falschen Typs, `F` kleiner als `P` für `~s`/`~c`, ein
  linksbündiges `~p` oder `~n`, eine Basis außerhalb von 2..36, Ausgabe, die
  kein Unicode ist.
- Nicht implementiert (`badarg`, siehe [Unterschiede](differences.md#io)):
  `~e`, `~f`, `~g`, `~x`, `~X`, `~+`, `~#`, `~W`, `~P` und der Modifikator `K`.

## Formatierte Ausgabe (`~p`)

- Die Zeilenlänge ist `F` (Standard 80, 0 schreibt eine Zeile); die erste
  Spalte ist `P`, sonst die Spalte, die die Ausgabe in ihrer Zeile erreicht hat
  (Tabs auf Vielfache von 8).
- Der Term wird zur Zwischenform von OTP: jeder Wert mit seiner einzeiligen
  Länge; Strings (flache Listen druckbarer Latin-1-Zeichen, das standardmäßige
  `io:printable_range()`), druckbare Binaries, Atome und Zahlen sind Text.
- Was auf den Rest der Zeile passt, wird ganz geschrieben. Listen und Tupel
  brechen zwischen Elementen um, ausgerichtet nach der Klammer; getaggte Tupel
  (`{atom, ...}`) richten sich nach dem Tag aus oder rücken um 4 (oder 1) ein,
  wenn das über die halbe Zeile hinausginge; Map-Paare und Felder nativer
  Records, die nicht passen, setzen den Wert in die nächste Zeile; lange
  Binaries brechen zwischen Bytes um.
- Container, die tiefer als 256 verschachtelt sind, lösen `system_limit` aus
  (das Layout rekursiert auf dem nativen Stack).
- Die Formatierung läuft bis zum Ende, egal wie groß der Term ist
  ([Portionen](builtins.md#portions)).
