---
source: docs/otp-reference.md
sourceCommit: 6ed3851c
sourceSha256: 6429059c33d43fbad7fcb826ceba6b33db7ae53de6eb578f6247f3aa56e69ee7
translatedAt: 2026-10-15
---
# Referencia de los fuentes de Erlang/OTP

Clause sigue la rama oficial `maint-29`. La fijación (pin) revisada está en
[`references/otp-pin.cmake`](../references/otp-pin.cmake):

- Revisión `d199a49a01a2079afb6f2c5c9ae047cd4555e68d` (OTP 29.1.2, commit
  upstream con fecha 2026-10-14), actualizada el 2026-10-14.
- Oráculo instalado usado para los goldens y las auditorías: OTP 29.1.1 /
  ERTS 17.1.

`references/otp` es un checkout ignorado. Las compilaciones y pruebas normales
usan goldens propios del proyecto y no necesitan ni el checkout ni un OTP
instalado. La configuración y las pruebas nunca descargan ni avanzan la
referencia. Las auditorías en vivo son opcionales con
`-DCLAUSE_OTP_AUDITS=ON`; véase
[regeneración de fixtures](../tests/fixtures/patternmatch/generated/README.md).

Los fuentes de OTP, los helpers copiados y las cabeceras generadas por OTP
nunca entran en Git. Las entradas de prueba confirmadas en el repositorio son
de autoría local; los goldens confirmados son observaciones de esas entradas.
Véase [validación](validation.md#fixtures-and-provenance).

## Procedimiento de actualización

Se ejecuta al comienzo de cualquier trabajo que dependa de OTP.

1. Comprobar `git -C references/otp status --short` y conservar el trabajo
   local. Descargar:
   `git -C references/otp fetch https://github.com/erlang/otp.git refs/heads/maint-29:refs/remotes/origin/maint-29`.
   Revisar `git -C references/otp log -1 origin/maint-29` y los cambios desde
   la fijación, sobre todo en la gramática, el escáner, el preprocesador y las
   entradas del corpus.
2. Avanzar (fast-forward) la rama local limpia:
   `git merge --ff-only origin/maint-29` (primera configuración:
   `git switch --create maint-29 --track origin/maint-29`). Usar bytes de
   checkout LF (`core.autocrlf=false`) para que las sumas de comprobación
   coincidan en todos los equipos; en un checkout existente de Windows,
   normalizar solo los archivos de texto listados en el manifiesto y
   `erl_parse.yrl`, y dejar sin cambios los fixtures binarios de upstream.
3. Generar la cabecera del compilador a partir de la misma revisión (desde la
   raíz del proyecto):
   `perl references/otp/erts/emulator/utils/beam_makeops -compiler -outdir references/otp/lib/compiler/src references/otp/lib/compiler/src/genop.tab`.
   En Windows, normalizar a LF solo el `beam_opcodes.hrl` generado.
4. Actualizar la fijación y verificar cada ruta de
   `tests/fixtures/parser/phase6/otp.tsv`. Actualizar los hashes solo tras
   revisar cambios reales de upstream. Si cambia `erl_parse.yrl`, revisar
   `tests/fixtures/parser/grammar.tsv`, sus fixtures y `phase6/coverage.tsv`;
   cada producción ordinaria necesita un testigo medido.
5. Configurar con `CLAUSE_OTP_AUDITS=ON` y con `CLAUSE_OTP_SOURCE_ROOT`
   apuntando al checkout. Ejecutar las pruebas de auditoría y
   `tests/compiler/patternmatch/regenerate.py --corpus all --check`. Anotar la
   revisión y los resultados más abajo; informar de las divergencias en lugar
   de regenerar para ocultarlas.

## Historial de fijaciones

Los registros históricos conservan la revisión con la que se hicieron.

| Fecha | Evento | Revisión |
| --- | --- | --- |
| 2026-09-19 | Validación del parser frente a la etiqueta OTP 29.1 | `751f87b703fe5948607d08e82599ce644b772e76` |
| 2026-09-28 | Cambio a `maint-29`; gramática y diez archivos del corpus idénticos | `21776803ecd11f5fa948732c0ec66b8f325dedfc` |
| 2026-10-01 – 10-03 | Descargada de nuevo antes de cada paso de patrones/guards; sin cambios | la misma |
| 2026-10-03 | Plan 11 step 1: pasan 14 pruebas de auditoría, se reproducen 19 corpus | la misma |
| 2026-10-14 | Actualizada a OTP 29.1.2: hashes de gramática, escáner, preprocesador y `phase6/otp.tsv` sin cambios (`genop.tab` solo un comentario); pasan 17 pruebas de auditoría y se reproducen 19 corpus con el oráculo 29.1.1; actualizada la revisión registrada por los goldens de ejecutables, lint, programas e impresión (salidas sin cambios, `external_terms` conserva su salida de map dependiente del orden de los átomos) | `d199a49a01a2079afb6f2c5c9ae047cd4555e68d` |
