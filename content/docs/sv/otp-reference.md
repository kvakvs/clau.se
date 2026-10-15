---
source: docs/otp-reference.md
sourceCommit: 6ed3851c
sourceSha256: 6429059c33d43fbad7fcb826ceba6b33db7ae53de6eb578f6247f3aa56e69ee7
translatedAt: 2026-10-15
---
# Referens till Erlang/OTP-källkoden

Clause följer den officiella grenen `maint-29`. Den granskade låsta revisionen
(pin) finns i
[`references/otp-pin.cmake`](../references/otp-pin.cmake):

- Revision `d199a49a01a2079afb6f2c5c9ae047cd4555e68d` (OTP 29.1.2,
  uppströmscommit daterad 2026-10-14), uppdaterad 2026-10-14.
- Installerat orakel som används för referensresultat (goldens) och
  granskningar: OTP 29.1.1 / ERTS 17.1.

`references/otp` är en ignorerad utcheckning. Vanliga byggen och tester
använder referensresultat som ägs av projektet och behöver varken
utcheckningen eller en installerad OTP. Konfiguration och tester hämtar eller
flyttar aldrig fram referensen. Levande granskningar aktiveras uttryckligen
med `-DCLAUSE_OTP_AUDITS=ON`; se
[återskapande av fixturer](../tests/fixtures/patternmatch/generated/README.md).

OTP-källkod, kopierade hjälpfiler och headers genererade av OTP kommer
aldrig in i Git. Incheckade testindata är skrivna lokalt; incheckade
referensresultat är observationer av dessa indata. Se
[validering](validation.md#fixtures-and-provenance).

## Uppdateringsprocedur

Körs i början av arbete som beror på OTP.

1. Kontrollera `git -C references/otp status --short` och bevara lokalt
   arbete. Hämta:
   `git -C references/otp fetch https://github.com/erlang/otp.git refs/heads/maint-29:refs/remotes/origin/maint-29`.
   Granska `git -C references/otp log -1 origin/maint-29` och ändringar sedan
   den låsta revisionen, särskilt grammatik, scanner, preprocessor och
   korpusindata.
2. Snabbspola den rena lokala grenen: `git merge --ff-only origin/maint-29`
   (första uppsättning: `git switch --create maint-29 --track origin/maint-29`).
   Använd LF i utcheckade bytes (`core.autocrlf=false`) så att kontrollsummor
   stämmer på varje värd; i en befintlig utcheckning på Windows normaliseras
   endast textfiler som listas i manifestet och `erl_parse.yrl`, och
   uppströms binära fixturer lämnas oförändrade.
3. Generera kompilatorns header från samma revision (från projektroten):
   `perl references/otp/erts/emulator/utils/beam_makeops -compiler -outdir references/otp/lib/compiler/src references/otp/lib/compiler/src/genop.tab`.
   På Windows normaliseras endast den genererade `beam_opcodes.hrl` till LF.
4. Uppdatera den låsta revisionen och verifiera varje sökväg i
   `tests/fixtures/parser/phase6/otp.tsv`. Uppdatera hashvärden först efter
   att ha granskat verkliga uppströmsändringar. Om `erl_parse.yrl` ändras,
   granska `tests/fixtures/parser/grammar.tsv`, dess fixturer och
   `phase6/coverage.tsv`; varje vanlig produktion behöver ett uppmätt belägg.
5. Konfigurera med `CLAUSE_OTP_AUDITS=ON` och `CLAUSE_OTP_SOURCE_ROOT` satt
   till utcheckningen. Kör granskningstesterna och
   `tests/compiler/patternmatch/regenerate.py --corpus all --check`. Notera
   revisionen och utfallen nedan; rapportera avvikelser i stället för att
   återskapa för att dölja dem.

## Historik för låst revision

Historiska poster behåller den revision de gjordes mot.

| Datum | Händelse | Revision |
| --- | --- | --- |
| 2026-09-19 | Parservalidering mot OTP 29.1-taggen | `751f87b703fe5948607d08e82599ce644b772e76` |
| 2026-09-28 | Bytte till `maint-29`; grammatik och tio korpusfiler identiska | `21776803ecd11f5fa948732c0ec66b8f325dedfc` |
| 2026-10-01 – 10-03 | Hämtad på nytt före varje step för mönster/guards; oförändrad | samma |
| 2026-10-03 | Plan 11 step 1: 14 granskningstester godkända, 19 korpusar reproduceras | samma |
| 2026-10-14 | Uppdaterad till OTP 29.1.2: hashar för grammatik, skanner, preprocessor och `phase6/otp.tsv` oförändrade (endast kommentar i `genop.tab`); 17 granskningstester godkända och 19 korpusar reproduceras med orakel 29.1.1; revisionen som registreras av referensresultat för körbara filer, lint, program och utskrift uppdaterad (utdata oförändrade, `external_terms` behåller sin map-utdata som beror på atomordning) | `d199a49a01a2079afb6f2c5c9ae047cd4555e68d` |
