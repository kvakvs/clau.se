---
source: docs/io.md
sourceCommit: 336caea7
sourceSha256: f513079db5cb8e2a7c9e02f15d3c952b9271d64d60cc3c3787cc2eee5efb3a15
translatedAt: 2026-10-18
---
# Konsolenausgabe (`io`)

`io:format/1,2,3`, `io:fwrite/1,2,3`, `io:put_chars/1,2` und `io:nl/0,1` sind
Runtime-Builtins des Moduls `io` im Brückenkatalog
([Builtins](builtins.md)); der Text entspricht `io_lib:format/2`, wird von
[der Engine von io_lib](builtins.md#io_lib) aufgebaut und abgeflacht, wobei
`~p` nach den Regeln von `io_lib_pretty` aus OTP angeordnet wird
([io_lib/pretty.cpp](../runtime/src/builtins/io_lib/pretty.cpp)). Die
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
  String-Erkennung), `k` (geordnete Maps) und `K` (Reihenfolge aus den
  Argumenten: `ordered`, `reversed`; Vergleichs-funs ergeben `badarg`).
  Maps werden in Schlüsselreihenfolge ausgegeben.
- Alle Steuersequenzen von OTP 29 mit ihren Feldregeln: `~w ~W ~p ~P ~s ~e ~f ~g ~b
  ~B ~x ~X ~+ ~# ~c ~i ~n ~~`. `~s` kürzt oder füllt auf `P` innerhalb von
  `F`; `~w`, Ganzzahlen und Gleitkommazahlen geben `*`-Zeichen aus, wenn der
  Text nicht in `F` passt; `~c` wiederholt das Zeichen; Ganzzahlbasen kommen
  aus `P` (2..36); `~n` mit `F` schreibt `F` Zeilenumbrüche; Breiten werden
  wie bei `io_lib:chars_length/1` gezählt.
- Ohne `t` nimmt `~s` nur Latin-1-Zeichen, und `~c` schreibt das niedrige Byte
  seiner Ganzzahl; `~w`/`~p` maskieren Atomzeichen jenseits von Latin-1 als
  `\x{...}`. Mit `t` liest `~s` Binaries als UTF-8 (mit Rückfall auf Latin-1),
  und `~p` schreibt `<<"..."/utf8>>` für druckbare UTF-8-Binaries.
- `badarg`: alles, woran `io_lib:format/2` scheitert (ein unbekanntes
  Steuerzeichen, fehlende oder überzählige Argumente, ein Argument falschen
  Typs, `F` kleiner als `P`, ein linksbündiges `~p` oder `~n`, eine Basis
  außerhalb von 2..36), sowie Ausgabe, die kein Unicode ist.

## Formatierte Ausgabe (`~p`)

- Die Zeilenlänge ist `F` (Standard 80, 0 schreibt eine Zeile); die erste
  Spalte ist `P`, sonst die Spalte, die die Ausgabe in ihrer Zeile erreicht hat
  (Tabs auf Vielfache von 8).
- `~P` beschneidet den Term am Tiefenargument und `chars_limit` (Optionen von
  `io:format/3` und `io_lib:format/3`) am Zeichenanteil der Steuersequenz,
  wobei wie in OTP `...` anstelle ausgelassener Teile ausgegeben wird.
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
