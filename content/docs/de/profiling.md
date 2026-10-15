---
source: docs/profiling.md
sourceCommit: 6ed3851c
sourceSha256: 0690ee91aab12c03c222bc79f4e862db1a91f1a621e36137ecfe1a97145f988a
translatedAt: 2026-10-15
---
# Profiling

`--profile FILE` (eine [Runtime-Option](executables.md#runtime-options), auch
über `CLAUSE_FLAGS`) lässt ein Programm beim Beenden einen Kostenbericht nach
`FILE` schreiben (Backlog F31). Nichts wird neu kompiliert: Jede ausführbare
Datei kann profilieren, und ohne die Option läuft sie, gibt aus und schreibt
Dateien genau wie zuvor. Ein Bericht, der nicht geschrieben werden kann, wird
auf stderr gemeldet (`clau: cannot write profile FILE`); der Exit-Status bleibt
der des Programms.

## Zuordnung

Die Runtime ordnet Kosten dort zu, wo die Kontrolle zwischen Frames wechselt
([Ausführungsmodell](execution-model.md)), ohne Instrumentierung im erzeugten
Code:

- **Eintritte** (Reduktionen): Jeder Eintritt in eine Erlang-Funktion über einen
  Aufruf oder Endaufruf zählt eins für diese Funktion, so wie eine Zeitscheibe
  Reduktionen zählt.
- **Eigenzeit**: Steady-Clock-Zeit von einer Übergabe (Eintritt, Rückkehr,
  Beginn einer Zeitscheibe) bis zur nächsten gehört der Funktion, deren Frame
  oben lag. Builtins und Runtime-Dienste zählen als Zeit der Funktion, die sie
  aufgerufen hat; Zeit, während der ein Prozess wartet oder nicht eingeplant
  ist, zählt für niemanden. Zeit vor dem ersten Eintritt eines Prozesses ist
  `(runtime)`.
- **Pro Prozess**: Jeder Prozess behält seine eigenen Kosten; sie werden zu
  denen des Programms addiert, wenn der Kontext des Prozesses zerstört wird, mit
  seiner Pid, seinen Summen und seiner teuersten Funktion.

Jeder aktivierte Stack liest bei jeder Übergabe die Uhr (etwa 8 % langsamer bei
einer aufrufdichten Schleife in Debug); deaktivierte Stacks zahlen eine
Verzweigung pro Übergabe.

## Bericht

```text
Clause profile: 2 processes, 503 time slices, 0 timer clock readings
Functions by self time:
     time_us   share      entries  function
     1193261  100.0%      2000001  profile:spin/2
         204    0.0%            1  profile:main/1
         130    0.0%            1  profile:-main/1-fun-0-/1
           0    0.0%            1  profile:cold/1
Processes by time:
     time_us   share      entries  process: top function
     1193393  100.0%      2000002  <0.2.0>: profile:spin/2
         206    0.0%            2  <0.1.0>: profile:main/1
```

Die erste Zeile zählt außerdem die Zeitscheiben, die die Scheduler-Worker
ausgeführt haben, und die Uhrablesungen des Timer-Threads für Receive-Timeouts
([Timer-Rad](processes.md#receive-timeouts)). Funktionen sind
`module:function/arity` (anonyme Funs mit ihren erzeugten Namen, deren
Stelligkeit erfasste Werte mitzählt); Gleichstände werden nach Name sortiert,
Prozesse nach Zeit, dann Pid. Zeiten sind in Mikrosekunden und variieren
zwischen Läufen; Eintritte sind exakt.

## Tests

`linking_profiling` linkt `tests/fixtures/linking/profile` bei O0 und O2 und
führt es ohne Profiling, mit `--profile FILE` und mit
`CLAUSE_FLAGS=--profile=FILE` aus: Die Ausgabe ist identisch, `spin/2` steht
nach Eigenzeit an erster Stelle mit genau 2.000.001 Eintritten, der
rechnende Prozess steht an erster Stelle, und `--profile` ohne Datei scheitert
mit Exit 70.
