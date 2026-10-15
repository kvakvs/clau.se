---
source: docs/guards.md
sourceCommit: 6ed3851c
sourceSha256: d5589018751662ec240dc70ab6c6d0637d16fa10698c1c4fa7510a033dd888f1
translatedAt: 2026-10-15
---
# Guards

La legalidad de los guards sigue las reglas fijadas de `erl_internal`/`erl_lint`
de OTP 29; nunca se deriva del registro en tiempo de ejecución. Se comprueban
todos los operandos, incluidos los inalcanzables. Un guard solo tiene éxito
cuando el valor final es el átomo `true`.

## Flujo de control

- `,` combina pruebas en conjunción, en orden. `;` inicia una nueva alternativa
  tras `false`, un valor no booleano o un error semántico alcanzado; cuando
  todas fallan, la cláusula no encaja.
- Los vínculos de la cabecera se pueden leer en todas las alternativas; los
  guards no crean vínculos.
- Los errores de infraestructura (falta de memoria, límites, propiedad) detienen
  la ejecución y nunca prueban otra alternativa.

| Operador | Semántica |
| --- | --- |
| `A andalso B` | `A` debe ser booleano; `false` → `false`; en otro caso devuelve `B` como cualquier término |
| `A orelse B` | `A` debe ser booleano; `true` → `true`; en otro caso devuelve `B` |
| `and`, `or`, `xor` | Ambos operandos se evalúan en orden, ambos booleanos |
| `not A` | Negación booleana |

`true andalso 7` devuelve 7 en un cuerpo y falla como prueba final de guard;
`(true andalso 7) =:= 7` tiene éxito. Un error alcanzado dentro de una expresión
anidada rechaza toda la alternativa: `hd([]) orelse true` falla,
`hd([]); true` tiene éxito. En los cuerpos, los operandos estrictos erróneos
lanzan `badarg` y un operando izquierdo perezoso erróneo lanza
`{badarg, Value}`, como en OTP.

## Catálogo

[guards.tsv](../tests/fixtures/patternmatch/guards.tsv) enumera las 81 firmas de
guard de las tablas fijadas `guard_bif`, `new_type_test`, `old_type_test`,
`arith_op`, `bool_op` y `comp_op`, y una prueba exige la igualdad exacta del
conjunto con el original de OTP.
[El manifiesto de auditoría](../tests/fixtures/patternmatch/generated/guard_catalog/manifest.json)
asocia cada una con su resolutor, su lowering y su
responsable en el runtime. Las 81 están implementadas (las que
dependen de la identidad, `self/0`, `node/0,1` e `is_record/1` nativo, desde el
plan step 52): `self()` es el pid del proceso que llama, `node()` y `node/1` de
un pid, una referencia o un puerto son `nonode@nohost` (hay un único nodo;
cualquier otro argumento de `node/1` hace fallar el guard, `badarg` en un
cuerpo), e `is_record/1` comprueba si es un record nativo. `is_record/2` con el
nombre de un record nativo local comprueba módulo y nombre; `is_record/3` con
un tercer argumento átomo comprueba el módulo y el nombre de un record nativo;
el acceso a campos nativos hace fallar el guard ante cualquier desajuste.

- Pruebas de tipo: `is_atom`, `is_integer`, `is_float`, `is_number`,
  `is_boolean`, `is_tuple`, `is_list`, `is_map`, `is_binary`, `is_bitstring`,
  `is_function/1,2` ([funs](funs.md)), `is_pid`, `is_reference`
  ([pids y referencias](terms.md#pids-and-references)); `is_port` es siempre
  falso (no existen puertos).
- `is_integer(V, Lo, Hi)` valida primero ambos límites como enteros (si no,
  `badarg`) y después comprueba el rango inclusivo; los límites invertidos dan
  false.
- Comparaciones `==`, `/=`, `=:=`, `=/=`, `<`, `=<`, `>`, `>=`; operadores
  aritméticos y bit a bit; consultas y conversiones según
  [términos](terms.md).
- Los constructores y las actualizaciones de map en los guards usan los mismos
  servicios enraizados que los cuerpos.
- Pruebas de records: véase [términos](terms.md#records).

## Resolución

- Los BIF de guard no cualificados respetan las definiciones locales, las
  importaciones y `no_auto_import` global/selectivo. `erlang:F(...)` y
  `erlang:'op'(...)` evitan la ocultación, pero solo para BIF de guard y
  operadores.
- Las pruebas heredadas (`integer/1`, `float/1`, `atom/1`, `record/2`, ...) solo
  son válidas en el nivel superior de una prueba de guard (se permiten
  paréntesis). Allí `float(X)` es `is_float`; `float/1` anidado o cualificado es
  la conversión. El `record/2` heredado ignora la supresión de su nombre
  antiguo, pero un `is_record/2` local lo bloquea.
- No se permiten en guards: la asignación, las llamadas
  locales/remotas/dinámicas arbitrarias, `++`, `--`, `!`, los funs, las
  comprehensions, el flujo de control, las actualizaciones de records,
  `record_info/2`.

## Limitaciones del oráculo

El OTP 29.1.1 instalado falla en la conversión SSA con algunas importaciones
modernas no relacionadas detrás de alias escalares heredados; Clause rechaza
explícitamente ese responsable no autorizado. El cargador de OTP también
rechaza un guard con una aridad literal de record enorme, aunque lint lo acepta;
ese caso solo tiene evidencia semántica.
