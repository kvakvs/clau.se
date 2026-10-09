---
source: docs/otp-reference.md
sourceCommit: 06042fa
sourceSha256: 0f7d89ad7d9a7b44ece9255eeeda2ea552e3290554f1549ffddde04ed6b5bd6d
translatedAt: 2026-10-09
---
# Referenz auf den Erlang/OTP-Quelltext

Clause verfolgt den offiziellen Branch `maint-29`. Der geprüfte Pin liegt in
[`references/otp-pin.cmake`](../references/otp-pin.cmake):

- Revision `21776803ecd11f5fa948732c0ec66b8f325dedfc` (Upstream-Commit vom
  2026-09-22), zuletzt am 2026-10-03 als unverändert bestätigt.
- Installiertes Orakel für Goldens und Audits: OTP 29.1.1 / ERTS 17.1.

`references/otp` ist ein ignorierter Checkout. Normale Builds und Tests
verwenden projekteigene Goldens und brauchen weder den Checkout noch ein
installiertes OTP. Konfiguration und Tests holen oder bewegen die Referenz nie.
Live-Audits sind optional mit `-DCLAUSE_OTP_AUDITS=ON`; siehe
[Neuerzeugung der Fixtures](../tests/fixtures/patternmatch/generated/README.md).

OTP-Quelltext, kopierte Hilfsprogramme und von OTP erzeugte Header gelangen
nie in Git. Eingecheckte Testeingaben sind lokal verfasst; eingecheckte
Goldens sind Beobachtungen dieser Eingaben. Siehe
[Validierung](validation.md#fixtures-and-provenance).

## Ablauf der Aktualisierung

Zu Beginn von Arbeiten ausführen, die von OTP abhängen.

1. `git -C references/otp status --short` prüfen und lokale Arbeit sichern. Holen:
   `git -C references/otp fetch https://github.com/erlang/otp.git refs/heads/maint-29:refs/remotes/origin/maint-29`.
   `git -C references/otp log -1 origin/maint-29` und die Änderungen seit dem
   Pin prüfen, besonders Grammatik, Scanner, Präprozessor und Korpus-Eingaben.
2. Den sauberen lokalen Branch vorspulen: `git merge --ff-only origin/maint-29`
   (Ersteinrichtung: `git switch --create maint-29 --track origin/maint-29`).
   LF-Checkout-Bytes verwenden (`core.autocrlf=false`), damit Prüfsummen auf
   jedem Host übereinstimmen; in einem vorhandenen Windows-Checkout nur die im
   Manifest gelisteten Textdateien und `erl_parse.yrl` normalisieren und
   Binär-Fixtures von Upstream unverändert lassen.
3. Den Compiler-Header aus derselben Revision erzeugen (aus dem Projektstamm):
   `perl references/otp/erts/emulator/utils/beam_makeops -compiler -outdir references/otp/lib/compiler/src references/otp/lib/compiler/src/genop.tab`.
   Unter Windows nur das erzeugte `beam_opcodes.hrl` auf LF normalisieren.
4. Den Pin aktualisieren und jeden Pfad in `tests/fixtures/parser/phase6/otp.tsv`
   prüfen. Hashes erst nach Prüfung echter Upstream-Änderungen erneuern. Ändert
   sich `erl_parse.yrl`, `tests/fixtures/parser/grammar.tsv`, seine Fixtures und
   `phase6/coverage.tsv` prüfen; jede gewöhnliche Produktion braucht einen
   gemessenen Zeugen.
5. Mit `CLAUSE_OTP_AUDITS=ON` und auf den Checkout gesetztem
   `CLAUSE_OTP_SOURCE_ROOT` konfigurieren. Die Audit-Tests und
   `tests/compiler/patternmatch/regenerate.py --corpus all --check` ausführen.
   Revision und Ergebnisse unten festhalten; Abweichungen melden, statt sie
   durch Neuerzeugung zu verdecken.

## Pin-Historie

Historische Einträge behalten die Revision, gegen die sie entstanden sind.

| Datum | Ereignis | Revision |
| --- | --- | --- |
| 2026-09-19 | Parser-Validierung gegen das Tag OTP 29.1 | `751f87b703fe5948607d08e82599ce644b772e76` |
| 2026-09-28 | Wechsel zu `maint-29`; Grammatik und zehn Korpusdateien identisch | `21776803ecd11f5fa948732c0ec66b8f325dedfc` |
| 2026-10-01 – 10-03 | Vor jedem Pattern-/Guard-Step neu geholt; unverändert | dieselbe |
| 2026-10-03 | Plan 11, step 1: 14 Audit-Tests bestehen, 19 Korpora reproduzieren | dieselbe |
