---
source: docs/guards.md
sourceCommit: 06042fa
sourceSha256: d5589018751662ec240dc70ab6c6d0637d16fa10698c1c4fa7510a033dd888f1
translatedAt: 2026-10-09
---
# Guards

A legalidade das guards segue as regras `erl_internal`/`erl_lint` do OTP 29
fixado; nunca é derivada do registo no runtime. Todos os operandos são
verificados, incluindo os inalcançáveis. Uma guard só tem sucesso quando o
valor final é o átomo `true`.

## Fluxo de controlo

- `,` conjuga os testes por ordem. `;` inicia uma nova alternativa após
  `false`, um valor não booleano ou um erro semântico alcançado; quando todas
  falham, a cláusula não corresponde.
- As associações da cabeça são legíveis em todas as alternativas; as guards
  não criam associações.
- Os erros de infraestrutura (falta de memória, limites, propriedade)
  interrompem a execução e nunca tentam outra alternativa.

| Operador | Semântica |
| --- | --- |
| `A andalso B` | `A` tem de ser booleano; `false` → `false`; caso contrário devolve `B` como qualquer termo |
| `A orelse B` | `A` tem de ser booleano; `true` → `true`; caso contrário devolve `B` |
| `and`, `or`, `xor` | Ambos os operandos avaliados por ordem, ambos booleanos |
| `not A` | Inverso booleano |

`true andalso 7` devolve 7 num corpo e falha como teste final de uma guard;
`(true andalso 7) =:= 7` tem sucesso. Um erro alcançado dentro de uma
expressão aninhada rejeita toda a alternativa: `hd([]) orelse true` falha,
`hd([]); true` tem sucesso. Nos corpos, operandos estritos inválidos lançam
`badarg` e um operando esquerdo preguiçoso inválido lança `{badarg, Value}`,
como no OTP.

## Catálogo

[guards.tsv](../tests/fixtures/patternmatch/guards.tsv) lista as 81
assinaturas de guards das tabelas fixadas `guard_bif`, `new_type_test`,
`old_type_test`, `arith_op`, `bool_op` e `comp_op`, e um teste impõe a
igualdade exata do conjunto com o upstream.
[O manifesto de auditoria](../tests/fixtures/patternmatch/generated/guard_catalog/manifest.json)
associa cada uma ao resolvedor, ao rebaixamento e ao responsável no runtime.
As 81 estão todas implementadas (as dependentes de identidade `self/0`,
`node/0,1` e `is_record/1` nativo desde o step 52 do plano): `self()` é o pid
do processo chamador, `node()` e `node/1` de um pid, referência ou port são
`nonode@nohost` (há um único nó; qualquer outro argumento de `node/1` faz
falhar a guard, `badarg` num corpo), e `is_record/1` testa se se trata de um
native record. `is_record/2` com o nome de um native record local testa o
módulo e o nome; `is_record/3` com um terceiro argumento átomo testa o módulo
e o nome de um native record; o acesso a campos nativos faz falhar a guard em
qualquer discordância.

- Testes de tipo: `is_atom`, `is_integer`, `is_float`, `is_number`,
  `is_boolean`, `is_tuple`, `is_list`, `is_map`, `is_binary`, `is_bitstring`,
  `is_function/1,2` ([funs](funs.md)), `is_pid`, `is_reference`
  ([pids e referências](terms.md#pids-and-references)); `is_port` é sempre
  falso (não existem ports).
- `is_integer(V, Lo, Hi)` valida primeiro ambos os limites como inteiros
  (caso contrário, `badarg`) e depois testa o intervalo inclusivo; limites
  invertidos dão falso.
- Comparações `==`, `/=`, `=:=`, `=/=`, `<`, `=<`, `>`, `>=`; operadores
  aritméticos e bit a bit; consultas e conversões conforme [termos](terms.md).
- Os construtores e as atualizações de maps em guards usam os mesmos serviços
  com raízes que os corpos.
- Testes de records: ver [termos](terms.md#records).

## Resolução

- As guard BIFs não qualificadas respeitam as definições locais, as
  importações e `no_auto_import` global/seletivo. `erlang:F(...)` e
  `erlang:'op'(...)` contornam a ocultação, mas apenas para guard BIFs e
  operadores.
- Os testes legados (`integer/1`, `float/1`, `atom/1`, `record/2`, ...) só
  são válidos ao nível superior de um teste de guard (parênteses permitidos).
  Aí, `float(X)` é `is_float`; `float/1` aninhado ou qualificado é a
  conversão. O `record/2` legado ignora a supressão do seu nome antigo, mas uma
  `is_record/2` local bloqueia-o.
- Não permitido em guards: atribuição, chamadas locais/remotas/dinâmicas
  arbitrárias, `++`, `--`, `!`, funs, comprehensions, fluxo de controlo,
  atualizações de records, `record_info/2`.

## Limitações do oráculo

O OTP 29.1.1 instalado falha na conversão SSA para algumas importações
modernas não relacionadas por trás de aliases escalares legados; o Clause
rejeita explicitamente esse responsável não autorizado. O carregador do OTP
também rejeita uma guard com uma aridade literal de record enorme, apesar de o
lint a aceitar; esse caso só tem evidência semântica.
