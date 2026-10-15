---
source: docs/native-records.md
sourceCommit: 6ed3851c
sourceSha256: 5383c5a0c72bed06730432be7a2605262122d7580d5a4e6124e01661d7e93086
translatedAt: 2026-10-15
---
# Native records

Define o âmbito das formas de
record do OTP 29 para além dos records comuns em tuplo e fixa a sua
representação, operações e erros. O step 31B implementou as células do
runtime e `CLAUSE_record_v1`; o 31C compila os native records locais, o 31D as
formas qualificadas e importadas com `-export_record`/`-import_record`, o 31E
as formas anónimas. Os records em tuplo estão em [termos](terms.md#records).

O OTP 29 marca os native records como experimentais. Os factos abaixo vêm dos
códigos-fonte fixados `maint-29` (`erl_lint`, `erl_expand_records`,
`v3_core`, `beam_core_to_ssa`, `erts/emulator/beam/erl_record.c`, `utils.c`,
`erl_printf_term.c`) e de sondagens em direto no OTP 29.1.1.

## Âmbito

As três formas para além dos records em tuplo foram selecionadas. Partilham
uma única representação, pelo que não precisam de decisões de representação
separadas:

| Forma | Sintaxe | Step |
| --- | --- | --- |
| Native record, local | `-record #r{...}.`, `#r{...}`, `X#r.f`, `X#r{...}`, padrões, `is_record/1,2,3` | 31C |
| Qualificado e importado | `#m:r{...}`, `X#m:r.f`, `X#m:r{...}`, padrões; `-export_record`, `-import_record` | 31D |
| Inferido (anónimo) | `X#_.f`, `X#_{...}`, padrão `#_{...}` | 31E |

Não selecionados: o módulo de reflexão `records` (uma biblioteca, com o
trabalho de bibliotecas do step 39), `term_to_binary` (`RECORD_EXT`) e a
atualização de código a quente (D01). As chamadas a `records:*` continuam a
dar diagnósticos `unknown module`.

## Representação

- **Descritor.** Cada definição de native record compila para um
  `abi::v1::RecordDescriptor` imutável ao lado do descritor do seu módulo: o
  `ModuleDescriptor` que o define, slots de átomos para os nomes do módulo e
  do record, a flag de exportação (`-export_record` em tempo de compilação) e
  os slots de átomos dos nomes dos campos pela ordem da definição. Os
  slots de átomos são resolvidos através dos átomos registados do módulo,
  como os nomes de `FrameDescriptor`. Os programas são estáticos (sem
  descarregamento), pelo que um descritor vive tanto como o programa; outro
  módulo do lote refere-o por símbolo. Os valores por omissão são compilados
  em cada local de construção, nunca armazenados.
- **Instância.** Célula de heap do tipo `native_record`: cabeçalho (contagem
  `1 + n`), uma palavra de descritor não rastreada e depois `n` valores
  rastreados pela ordem da definição. Um record sem campos é uma célula de
  duas palavras.
- O descritor captura o módulo, o nome, a flag de exportação e a lista de
  campos no momento da construção, como faz a definição capturada do OTP.
  Todas as operações após a construção leem o descritor da instância, nunca o
  código que as executa.
- A cópia, a recolha, o percurso e a verificação tratam a célula como um tuplo
  cuja primeira palavra de conteúdo não é rastreada. A admissão exige um
  descritor registado por um módulo do mesmo runtime.

## Operações

`M` é o módulo atual. Todos os erros têm a classe `error`; os conteúdos de
badrecord são o valor em causa, exceto na construção externa falhada.

| Operação | Aceita | Falha |
| --- | --- | --- |
| Construção local `#r{...}` | Sempre (a definição é local) | Campo desconhecido ou valor em falta são erros de compilação |
| Construção externa `#m:r{...}` (também `#r{...}` importado, também `#M:r`) | `m:r` definido no lote e exportado | `{badrecord, {m, r}}`; depois `{badfield, {{m, r}, F}}`, `{novalue, {{m, r}, F}}` (badfield prevalece) |
| Acesso local `X#r.f` | Native record chamado `r` (módulo e flag de exportação **não** verificados, como no runtime do OTP) | `{badrecord, X}`; campo em falta `{badfield, {{Mod, r}, f}}` |
| Acesso externo `X#m:r.f` | Módulo `m`, nome `r`, exportado | `{badrecord, X}`; `{badfield, ...}` |
| Acesso anónimo `X#_.f` | Qualquer native record (exportação **não** verificada, como no runtime do OTP) | `{badrecord, X}`; `{badfield, ...}` |
| Atualização local `X#r{...}` | Módulo `M`, nome `r` | `{badrecord, X}`; campo desconhecido `{badfield, ...}` |
| Atualização externa `X#m:r{...}` | Exportado, módulo `m`, nome `r` | igual |
| Atualização anónima `X#_{...}` | Exportado ou módulo `M` | igual |
| Padrão local `#r{...}` | Módulo `M`, nome `r`, todos os campos listados presentes | sem correspondência |
| Padrão externo `#m:r{...}` | Módulo `m`, nome `r`; exportado quando um campo é listado | sem correspondência |
| Padrão anónimo `#_{...}` | Qualquer native record; exportado ou módulo `M` quando um campo é listado | sem correspondência |

- A construção avalia os campos indicados pela ordem do código-fonte (os
  valores por omissão são literais); uma atualização avalia primeiro o record
  e depois os novos valores pela ordem do código-fonte, ao contrário de uma
  atualização de record em tuplo. As atualizações vazias também verificam.
- Guards: apenas o acesso a campos (uma falha faz falhar a guard) e
  `is_record`. A construção numa guard dá `creating a record in a guard is only supported
  for tuple records`; a atualização dá `illegal guard expression`.
- `is_record(X)` só é verdadeiro para native records. `is_record(X, r)` com um
  `r` nativo local testa o módulo `M` e o nome `r`; com `r` importado de `m`
  testa o módulo `m`. `is_record(X, m, r)` com átomos testa o módulo e o nome;
  com um inteiro é o teste de tuplo.
- Os native records não são tuplos: `is_tuple` é falso; os serviços de
  elementos e de tamanho rejeitam-nos.

## Regras em tempo de compilação

As mensagens seguem o `erl_lint`:

- Os valores por omissão têm de ser literais após a redução de constantes
  (números, átomos, strings, `[]`, conses/tuplos/maps destes, binaries só de
  strings): `illegal default value for field a in native record r`.
- Construção local sem valor para um campo sem valor por omissão:
  `field a is not initialized in native record r`; campo desconhecido:
  `field zz undefined in record r`. Os campos desconhecidos em acessos,
  atualizações e padrões são aceites (o OTP apenas avisa); falham em tempo de
  execução.
- O índice `#r.a`, `record_info/2`, os inicializadores `_ = V` e os
  refinamentos de tipo de campos são exclusivos dos records em tuplo, com as
  mensagens do OTP.
- Um nome é um record em tuplo, um native record ou um record importado; os
  conflitos e as formas `-export_record`/`-import_record` inválidas são
  erros. `-export_record` tem de preceder as definições de funções.
- As formas externas que designam um módulo fora do lote, um record não
  definido ou não exportado compilam e falham em tempo de execução, como no
  OTP. A construção externa é resolvida em relação ao lote em tempo de
  compilação: o módulo importador rebaixa ele próprio os valores por omissão
  literais do módulo que define o record e referencia o seu descritor
  exportado; os campos desconhecidos lançam `badfield` antes de um valor em
  falta lançar `novalue` (`ErrorReason` 21).

## Impressão e ordem

- `erlang:display/1` imprime `#m:r{a=1,b=2}`: sem espaços, campos pela ordem
  da definição. O OTP imprime os campos pela ordem do índice na tabela de
  átomos, que depende da ordem de criação dos átomos e não é reproduzível;
  esta é uma diferença registada, tal como para as chaves de maps.
- Ordem dos termos: tuplo < native record < map. Os records comparam-se por
  módulo, nome, flag de exportação (falso primeiro), número de campos, nomes
  dos campos pela ordem da definição e depois valores pela ordem da definição.
  `=:=` exige além disso a mesma ordem de campos; `==` compara os valores
  numericamente (o compilador do OTP reduz alguns `==` sobre records a `=:=`;
  segue-se a regra do runtime).

## Diferenças mantidas

| OTP | Clause |
| --- | --- |
| A ordem dos campos em `display` segue os índices dos átomos | Ordem da definição |
| A construção externa de um módulo não carregado falha até ele ser carregado | Todos os módulos do lote são carregados no arranque; um módulo fora do lote falha sempre |
| O compilador pode reduzir `==` entre records a `=:=` (`#r{a=1} == #r{a=1.0}` é falso) | `==` do runtime (verdadeiro) |
| Campos desconhecidos em acessos/atualizações/padrões, construção qualificada do próprio módulo sem valores, records não usados ou definidos em cabeçalhos: avisos | Sem avisos |
