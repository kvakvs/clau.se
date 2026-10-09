---
source: docs/otp-reference.md
sourceCommit: 06042fa
sourceSha256: 0f7d89ad7d9a7b44ece9255eeeda2ea552e3290554f1549ffddde04ed6b5bd6d
translatedAt: 2026-10-09
---
# Référence des sources Erlang/OTP

Clause suit la branche officielle `maint-29`. La révision épinglée (pin),
vérifiée, se trouve dans
[`references/otp-pin.cmake`](../references/otp-pin.cmake) :

- Révision `21776803ecd11f5fa948732c0ec66b8f325dedfc` (commit amont daté du
  2026-09-22), confirmée inchangée pour la dernière fois le 2026-10-03.
- Oracle installé utilisé pour les résultats de référence (goldens) et les
  audits : OTP 29.1.1 / ERTS 17.1.

`references/otp` est un checkout ignoré par Git. Les builds et tests normaux
utilisent des goldens appartenant au projet et n'ont besoin ni du checkout ni
d'un OTP installé. La configuration et les tests ne récupèrent ni n'avancent
jamais la référence. Les audits en direct sont optionnels, avec
`-DCLAUSE_OTP_AUDITS=ON` ; voir
[régénération des fixtures](../tests/fixtures/patternmatch/generated/README.md).

Les sources d'OTP, les utilitaires copiés et les en-têtes générés par OTP
n'entrent jamais dans Git. Les entrées de test commitées sont écrites
localement ; les goldens commités sont des observations de ces entrées. Voir
[validation](validation.md#fixtures-and-provenance).

## Procédure de mise à jour

À exécuter au début de tout travail dépendant d'OTP.

1. Vérifier `git -C references/otp status --short` et préserver le travail
   local. Récupérer :
   `git -C references/otp fetch https://github.com/erlang/otp.git refs/heads/maint-29:refs/remotes/origin/maint-29`.
   Examiner `git -C references/otp log -1 origin/maint-29` et les changements
   depuis le pin, en particulier la grammaire, le scanner, le préprocesseur et
   les entrées du corpus.
2. Avancer en fast-forward la branche locale propre :
   `git merge --ff-only origin/maint-29` (première installation :
   `git switch --create maint-29 --track origin/maint-29`). Utiliser des octets
   de checkout en LF (`core.autocrlf=false`) pour que les sommes de contrôle
   correspondent sur chaque hôte ; sur un checkout Windows existant, ne
   normaliser que les fichiers texte listés dans le manifeste et
   `erl_parse.yrl`, et laisser inchangées les fixtures binaires amont.
3. Générer l'en-tête du compilateur à partir de la même révision (depuis la
   racine du projet) :
   `perl references/otp/erts/emulator/utils/beam_makeops -compiler -outdir references/otp/lib/compiler/src references/otp/lib/compiler/src/genop.tab`.
   Sous Windows, ne normaliser en LF que le fichier généré `beam_opcodes.hrl`.
4. Mettre à jour le pin et vérifier chaque chemin de
   `tests/fixtures/parser/phase6/otp.tsv`. Ne rafraîchir les empreintes
   qu'après avoir examiné de vrais changements amont. Si `erl_parse.yrl`
   change, examiner `tests/fixtures/parser/grammar.tsv`, ses fixtures et
   `phase6/coverage.tsv` ; chaque production ordinaire a besoin d'un témoin
   mesuré.
5. Configurer avec `CLAUSE_OTP_AUDITS=ON` et `CLAUSE_OTP_SOURCE_ROOT` pointant
   vers le checkout. Exécuter les tests d'audit et
   `tests/compiler/patternmatch/regenerate.py --corpus all --check`. Consigner
   la révision et les résultats ci-dessous ; signaler toute dérive au lieu de
   régénérer pour la masquer.

## Historique du pin

Les enregistrements historiques conservent la révision sur laquelle ils ont
été faits.

| Date | Événement | Révision |
| --- | --- | --- |
| 2026-09-19 | Validation du parseur contre le tag OTP 29.1 | `751f87b703fe5948607d08e82599ce644b772e76` |
| 2026-09-28 | Passage à `maint-29` ; grammaire et dix fichiers du corpus identiques | `21776803ecd11f5fa948732c0ec66b8f325dedfc` |
| 2026-10-01 – 10-03 | Récupéré à nouveau avant chaque étape motifs/guards ; inchangé | identique |
| 2026-10-03 | Plan 11 step 1 : 14 tests d'audit réussis, 19 corpus reproduits | identique |
