---
source: docs/guards.md
sourceCommit: 6ed3851c
sourceSha256: d5589018751662ec240dc70ab6c6d0637d16fa10698c1c4fa7510a033dd888f1
translatedAt: 2026-10-15
---
# Guards

Die Zulässigkeit von Guards folgt den festgelegten Regeln von OTP 29
`erl_internal`/`erl_lint`; sie wird nie aus der Registrierung zur Laufzeit
abgeleitet. Jeder Operand wird geprüft, auch unerreichbare. Ein Guard gelingt
nur, wenn der Endwert das Atom `true` ist.

## Kontrollfluss

- `,` verknüpft Tests der Reihe nach. `;` beginnt eine neue Alternative nach
  `false`, einem Nicht-Boolean oder einem erreichten semantischen Fehler;
  schlagen alle fehl, matcht die Klausel nicht.
- Bindungen des Kopfs sind in jeder Alternative lesbar; Guards erzeugen keine
  Bindungen.
- Infrastrukturfehler (OOM, Grenzen, Besitz) stoppen die Ausführung und
  versuchen nie eine andere Alternative.

| Operator | Semantik |
| --- | --- |
| `A andalso B` | `A` muss ein Boolean sein; `false` → `false`; andernfalls wird `B` als beliebiger Term zurückgegeben |
| `A orelse B` | `A` muss ein Boolean sein; `true` → `true`; andernfalls wird `B` zurückgegeben |
| `and`, `or`, `xor` | Beide Operanden der Reihe nach ausgewertet, beide Boolean |
| `not A` | Boolesche Umkehrung |

`true andalso 7` gibt in einem Rumpf 7 zurück und schlägt als abschließender
Guard-Test fehl; `(true andalso 7) =:= 7` gelingt. Ein erreichter Fehler in
einem verschachtelten Ausdruck weist die ganze Alternative ab:
`hd([]) orelse true` schlägt fehl, `hd([]); true` gelingt. In Rümpfen lösen
ungültige strikte Operanden `badarg` aus und ein ungültiger linker Operand eines
verzögerten Operators `{badarg, Value}`, wie in OTP.

## Katalog

[guards.tsv](../tests/fixtures/patternmatch/guards.tsv) führt alle 81
Guard-Signaturen aus den festgelegten Tabellen `guard_bif`, `new_type_test`,
`old_type_test`, `arith_op`, `bool_op` und `comp_op` auf, und ein Test erzwingt
exakte Mengengleichheit mit Upstream.
[Das Audit-Manifest](../tests/fixtures/patternmatch/generated/guard_catalog/manifest.json)
ordnet jede Signatur Resolver, Lowering und Runtime-Zuständigem zu. Alle 81
sind implementiert (die identitätsabhängigen `self/0`, `node/0,1` und das native
`is_record/1` seit plan step 52): `self()` ist die Pid des aufrufenden
Prozesses, `node()` und `node/1` einer Pid, Referenz oder eines Ports sind
`nonode@nohost` (es gibt einen Knoten; jedes andere Argument von `node/1` lässt
den Guard fehlschlagen, in einem Rumpf `badarg`), und `is_record/1` prüft auf
einen nativen Record. `is_record/2` mit einem lokalen
Namen eines nativen Records prüft Modul und Name; `is_record/3` mit einem Atom
als drittem Argument prüft Modul und Name eines nativen Records; nativer
Feldzugriff lässt den Guard bei jeder Abweichung fehlschlagen.

- Typtests: `is_atom`, `is_integer`, `is_float`, `is_number`, `is_boolean`,
  `is_tuple`, `is_list`, `is_map`, `is_binary`, `is_bitstring`,
  `is_function/1,2` ([Funs](funs.md)), `is_pid`, `is_reference`
  ([Pids und Referenzen](terms.md#pids-and-references)); `is_port` ist
  immer false (es gibt keine Ports).
- `is_integer(V, Lo, Hi)` validiert zuerst beide Grenzen als Ganzzahlen (sonst
  `badarg`) und prüft dann den einschließlichen Bereich; vertauschte Grenzen
  ergeben false.
- Vergleiche `==`, `/=`, `=:=`, `=/=`, `<`, `=<`, `>`, `>=`; arithmetische und
  bitweise Operatoren; Abfragen und Konvertierungen gemäß [Terme](terms.md).
- Konstruktoren und Map-Aktualisierungen in Guards verwenden dieselben
  gewurzelten Dienste wie Rümpfe.
- Record-Tests: siehe [Terme](terms.md#records).

## Auflösung

- Unqualifizierte Guard-BIFs berücksichtigen lokale Definitionen, Importe und
  globales/selektives `no_auto_import`. `erlang:F(...)` und `erlang:'op'(...)`
  umgehen die Verdeckung, aber nur für Guard-BIFs und Operatoren.
- Veraltete Tests (`integer/1`, `float/1`, `atom/1`, `record/2`, ...) sind nur
  auf oberster Ebene eines Guard-Tests gültig (Klammern erlaubt). Dort ist
  `float(X)` gleich `is_float`; verschachteltes oder qualifiziertes `float/1`
  ist eine Konvertierung. Das veraltete `record/2` ignoriert die Unterdrückung
  seines alten Namens, aber ein lokales `is_record/2` blockiert es.
- In Guards nicht erlaubt: Zuweisung, beliebige lokale/entfernte/dynamische
  Aufrufe, `++`, `--`, `!`, Funs, Comprehensions, Kontrollfluss,
  Record-Aktualisierungen, `record_info/2`.

## Grenzen des Orakels

Das installierte OTP 29.1.1 stürzt bei der SSA-Konvertierung für einige
unabhängige moderne Importe hinter veralteten skalaren Aliasen ab; Clause weist
diesen nicht autorisierten Zuständigen explizit ab. Der Loader von OTP weist
außerdem einen Guard mit einer riesigen literalen Record-Stelligkeit ab,
obwohl Lint ihn akzeptiert; für diesen Fall gibt es nur semantische Belege.
