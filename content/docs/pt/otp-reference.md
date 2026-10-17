---
source: docs/otp-reference.md
sourceCommit: a8c3f8f6
sourceSha256: 323425ae1e4ea28b00315a75abac332bfb88a8f6e16c30b4347ed7dff710d663
translatedAt: 2026-10-17
---
# Referência das fontes do Erlang/OTP

O Clause acompanha o ramo oficial `maint-29`. A fixação revista encontra-se em
[`references/otp-pin.cmake`](../references/otp-pin.cmake):

- Revisão `d199a49a01a2079afb6f2c5c9ae047cd4555e68d` (OTP 29.1.2, commit
  upstream datado de 2026-10-14), atualizada em 2026-10-14.
- Oráculo instalado usado para goldens e auditorias: OTP 29.1.1 / ERTS 17.1.

`references/otp` é um checkout ignorado. As compilações e os testes normais
usam goldens pertencentes ao projeto e não precisam nem do checkout nem de um
OTP instalado. A configuração e os testes nunca obtêm nem avançam a
referência. As auditorias em direto são opcionais, com
`-DCLAUSE_OTP_AUDITS=ON`; ver
[regeneração de fixtures](../tests/fixtures/patternmatch/generated/README.md).

As fontes do OTP, os auxiliares copiados e os cabeçalhos gerados pelo OTP nunca
entram no Git. As entradas de teste registadas no repositório são de autoria
local; os goldens registados são observações dessas entradas. Ver
[validação](validation.md#fixtures-and-provenance).

## Procedimento de atualização

Executar no início de qualquer trabalho que dependa do OTP.

1. Verificar `git -C references/otp status --short` e preservar o trabalho
   local. Obter:
   `git -C references/otp fetch https://github.com/erlang/otp.git refs/heads/maint-29:refs/remotes/origin/maint-29`.
   Rever `git -C references/otp log -1 origin/maint-29` e as alterações desde a
   fixação, sobretudo na gramática, no scanner, no pré-processador e nas
   entradas do corpus.
2. Avançar o ramo local limpo: `git merge --ff-only origin/maint-29`
   (primeira configuração: `git switch --create maint-29 --track origin/maint-29`).
   Usar bytes de checkout LF (`core.autocrlf=false`) para que as somas de
   verificação coincidam em todas as máquinas; num checkout Windows existente,
   normalizar apenas os ficheiros de texto listados no manifesto e
   `erl_parse.yrl`, e manter inalteradas as fixtures binárias do upstream.
3. Gerar o cabeçalho do compilador a partir da mesma revisão (a partir da raiz
   do projeto):
   `perl references/otp/erts/emulator/utils/beam_makeops -compiler -outdir references/otp/lib/compiler/src references/otp/lib/compiler/src/genop.tab`.
   No Windows, normalizar para LF apenas o `beam_opcodes.hrl` gerado.
4. Atualizar a fixação e verificar todos os caminhos em
   `tests/fixtures/parser/phase6/otp.tsv`. Atualizar os hashes apenas depois de
   rever alterações reais do upstream. Se `erl_parse.yrl` mudar, rever
   `tests/fixtures/parser/grammar.tsv`, as suas fixtures e
   `phase6/coverage.tsv`; cada produção comum precisa de uma testemunha medida.
5. Configurar com `CLAUSE_OTP_AUDITS=ON` e `CLAUSE_OTP_SOURCE_ROOT` apontado
   para o checkout. Executar os testes de auditoria e
   `tests/compiler/patternmatch/regenerate.py --corpus all --check`. Registar a
   revisão e os resultados abaixo; relatar a divergência em vez de regenerar
   para a esconder.

## Histórico da fixação

Os registos históricos mantêm a revisão em relação à qual foram feitos.

| Data | Evento | Revisão |
| --- | --- | --- |
| 2026-09-19 | Validação do parser em relação à tag OTP 29.1 | `751f87b703fe5948607d08e82599ce644b772e76` |
| 2026-09-28 | Mudança para `maint-29`; gramática e dez ficheiros do corpus idênticos | `21776803ecd11f5fa948732c0ec66b8f325dedfc` |
| 2026-10-01 – 10-03 | Obtida de novo antes de cada step de padrões/guards; inalterada | a mesma |
| 2026-10-03 | Plano 11, step 1: 14 testes de auditoria passam, 19 corpora reproduzem-se | a mesma |
| 2026-10-14 | Atualizada para OTP 29.1.2: hashes da gramática, do scanner, do pré-processador e de `phase6/otp.tsv` inalterados (`genop.tab` só num comentário); 17 testes de auditoria passam e 19 corpora reproduzem-se com o oráculo 29.1.1; atualizada a revisão registada pelos goldens de executáveis, lint, programas e impressão (saídas inalteradas, `external_terms` mantém a sua saída de map dependente da ordem dos átomos) | `d199a49a01a2079afb6f2c5c9ae047cd4555e68d` |
