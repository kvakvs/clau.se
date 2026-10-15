---
source: docs/patterns.md
sourceCommit: 6ed3851c
sourceSha256: ef7903895b7901a6980a3cd181783486ae8672876229d35fae120e802392e989
translatedAt: 2026-10-15
---
# Padrões, cláusulas e correspondências no corpo

As cabeças de cláusulas de função, as correspondências no corpo, as cláusulas
`case` e as guards de `if` são executáveis para todos os tipos de termos
admitidos ([termos](terms.md)). A legalidade e a disponibilidade são
verificadas separadamente: Erlang inválido é um erro **semântico** mesmo em
código inalcançável; código legal que precisa de uma funcionalidade em falta
recebe um diagnóstico de **capacidade**; uma **não correspondência** em tempo
de execução nunca é um erro do compilador.

| Contexto | Estado |
| --- | --- |
| Cabeças de função + guards | Implementado; o esgotamento lança `error:function_clause` |
| Correspondências e sequências no corpo, `begin`/`end` | Implementado; a falha lança `error:{badmatch, RHS}` |
| Cláusulas `case` + guards | Implementado; o esgotamento lança `error:{case_clause, Value}` |
| Cláusulas de guard de `if` | Implementado; o esgotamento lança `error:if_clause` |
| `maybe` com `?=` e cláusulas `else` | Implementado; um `?=` falhado produz o seu valor ou seleciona uma cláusula `else`, cujo esgotamento lança `error:{else_clause, Value}`; requer a feature `maybe_expr` ([pré-processador](preprocessor.md)) |
| Comprehensions de lista, binary e map | Implementado ([abaixo](#comprehensions)) |
| `catch Expr` | Implementado; sem padrões ([ABI](abi.md#failure-channel-revision-2)) |
| Cláusulas `of` e catch de `try` | Implementado; o esgotamento de `of` lança `error:{try_clause, Value}`, as exceções não correspondidas são relançadas e `after` corre em todos os caminhos ([ABI](abi.md#failure-channel-revision-2)); `Class:Reason:Stack` associa o [rastreio de pilha](abi.md#stack-traces) |
| Cláusulas de fun | Capacidade (F18) |
| `receive` | Capacidade (F22/F25) |

## Comprehensions

`[T1, ..., Tn || Q1, ..., Qm]`, `<< T || Q1, ... >>` e
`#{K => V, ... || Q1, ... }` seguem o OTP 29:

- Os qualificadores correm da esquerda para a direita; cada gerador itera
  sobre os restantes. Os templates são avaliados por essa ordem para cada
  combinação sobrevivente; vários templates acrescentam vários elementos por
  combinação. O template de uma comprehension de binary tem de ser um
  bitstring (caso contrário, `error:badarg` nesse elemento); as partes são
  unidas por ordem, incluindo bytes parciais. Uma comprehension de map avalia o
  seu (primeiro) valor antes da chave, e uma chave duplicada posterior
  prevalece.
- Geradores: `P <- List`, `<<Segs>> <= Bits` e `K := V <- Map`, com as formas
  estritas `<:-` (listas, maps) e `<:=`. Um gerador de bitstring faz
  corresponder o seu padrão a um prefixo e continua com o resto. Quando um
  gerador relaxado rejeita um elemento, salta tantos bits quantos os tamanhos
  do padrão descrevem (valores ignorados, floats lidos como inteiros, como faz
  o OTP); quando até isso falha, ou restam menos bits, o gerador termina. Um
  gerador de map percorre o map pela ordem das chaves (o OTP também percorre
  até 32 chaves pela ordem das chaves, exceto as chaves átomo, que ordena pelo
  índice do átomo; os maps maiores seguem a ordem de hash do OTP, que o Clause
  não reproduz).
- Um padrão de gerador associa nomes novos: oculta os nomes exteriores, e nada
  do que uma comprehension associa é visível depois dela. Um gerador relaxado
  salta os elementos que o seu padrão rejeita; um estrito lança
  `error:{badmatch, E}` com o elemento da lista, o bitstring restante ou
  `{Key, Value}`.
- Um grupo zip (`P1 <- L1 && P2 <- L2`) toma um elemento de cada entrada por
  passo; os seus padrões associam em conjunto, pelo que um nome repetido tem
  de corresponder. Um passo rejeitado é saltado, a não ser que um padrão
  estrito o rejeite. Entradas que se esgotam de forma desigual, ou uma
  rejeição estrita, lançam `error:{bad_generators, {L1', L2'}}` com as
  entradas restantes nesse passo (um gerador de map mostra o iterador do OTP
  `{K, V, Next}`, terminado em `none`). Filtros dentro de um grupo zip são
  erros semânticos. Quando geradores relaxados e estritos do mesmo grupo
  partilham uma variável, a regra de salto pode diferir do OTP
  ([diferenças](differences.md)).
- Uma entrada que não seja um map lança `error:{bad_generator, Input}` antes
  de um gerador de map começar, mesmo dentro de um grupo zip.
- Uma entrada de lista que não seja uma lista, ou uma cauda imprópria, e uma
  entrada de bitstring que não seja um bitstring lançam
  `error:{bad_generator, Tail}` depois de tratados os elementos anteriores.
- Um filtro que seja um teste de guard (`erl_lint:is_guard_test/3` do OTP:
  sintaxe de guard que chama apenas guard BIFs não ocultadas, testes de tipo
  legados ao nível superior) rejeita o elemento em qualquer falha, como uma
  guard. Qualquer outro filtro tem de devolver `true` ou `false`; outros
  valores lançam `error:{bad_filter, Value}` e as suas exceções propagam-se.
- Um qualificador de correspondência ao nível superior (`P = E`) é um erro
  semântico, a não ser que a feature experimental `compr_assign` esteja
  ativada; nesse caso, a sua execução não está implementada (capacidade).

Cada gerador é um ciclo no corpo da função cujo cursor de entrada (o resto de
uma lista ou de um bitstring, ou um map e uma posição) vive em slots de
termos do frame; os elementos produzidos acumulam-se invertidos noutro slot
de termo e tornam-se a lista, o bitstring unido ou o map de uma só vez no fim,
pelo que entradas longas precisam de pilha nativa e de processo constante.

## Formas de padrões

| Forma | Regra | Rejeição |
| --- | --- | --- |
| `_` | Nunca associa; ocorrências independentes | Ler `_` é semântico |
| `Name`, `_Name`, repetições | Atribuição única; as repetições exigem igualdade exata (`1` ≠ `1.0`) | Leitura não associada/insegura é semântica; desigualdade é não correspondência |
| `P1 = P2`, parênteses | Ambos restringem o mesmo valor; sem associações de chave/tamanho entre irmãos | Dependência ilegal entre irmãos é semântica |
| Átomos, inteiros, caracteres, floats | Igualdade exata; zero com sinal distinto | Não correspondência |
| Aritmética constante | Operadores de padrão do OTP reduzidos exatamente; `1 div 0` e não constantes rejeitados | Semântico |
| Tuplos, listas, caudas impróprias, strings | Aridade exata e forma cons/nil; as strings são listas | Não correspondência |
| `"prefix" ++ Tail` | Apenas prefixo de string literal ou de lista de inteiros literal | Prefixo variável é semântico |
| `#{K := P}` | Apenas `:=`; chaves extra permitidas; `#{}` testa o tipo; as chaves são expressões de guard sobre as associações recebidas | `=>`, chave não associada é semântico; chave em falta é não correspondência |
| Bitstrings | Tipo/tamanho/unidade validados; segmentos anteriores podem dimensionar os posteriores; cauda sem tamanho no fim | Especificador inválido é semântico; dados curtos são não correspondência |
| Records em tuplo `#r{f = P}`, `#r.f` | Expandidos em restrições de tuplo; campos omitidos sem restrição | Record/campo desconhecido é semântico |
| Native records locais `#r{f = P}` | Record deste módulo chamado `r`, depois cada campo listado (um campo em falta falha) | Record desconhecido é semântico |
| Native records qualificados/importados `#m:r{f = P}` | Record do módulo `m` chamado `r`; exportado quando um campo é listado; depois cada campo | Nenhuma em tempo de compilação |
| Records anónimos `#_{f = P}` | Qualquer native record; exportado ou definido neste módulo quando um campo é listado | `#_{...}` como expressão é um erro |
| Chamadas, aritmética com variáveis, outras expressões | Não são padrões | Semântico |

## Âmbitos

As chaves de map e os tamanhos de binary leem o ambiente recebido, nunca os
irmãos: `#{K := V} = #{key := K}` e `<<X:N>> = <<N:8>>` não podem associar a
sua própria chave ou tamanho. Dentro de um mesmo binary, um tamanho pode ler
segmentos anteriores: `<<N:8, X:N>>` é legal; `{N, <<X:N>>}` precisa de `N`
associado previamente. Aritmética constante inválida numa chave ou tamanho é
legal e falha no momento da correspondência.

A validação de binaries rejeita segmentos de contentores aninhados/aliases,
modificadores em conflito, intervalos de unidade inválidos, unidade sem
tamanho para os valores por omissão integer/float, tamanho/unidade UTF
inválidos, strings literais com tipo/tamanho e segmentos binary sem tamanho
que não sejam os últimos.

## Execução

- Um plano de correspondência plano por cabeça/LHS sobre as posições
  originais dos argumentos; os aliases partilham uma entrada, as primeiras
  definições associam valores SSA, as repetições emitem testes de igualdade
  exata. As verificações de forma dominam a extração; a extração usa serviços
  verificados do runtime.
- As cláusulas correm pela ordem do código-fonte, cada uma com um ambiente
  novo que recarrega os argumentos originais. Uma não correspondência da cabeça
  ou a rejeição da guard passa à cláusula seguinte; os erros no corpo e as
  falhas de infraestrutura nunca voltam a tentar cláusulas posteriores.
- Um `case` avalia a sua expressão uma vez e depois tenta cada cláusula por
  ordem, com essa expressão como única entrada do plano: uma não
  correspondência do padrão ou a rejeição da guard (incluindo erros na guard)
  passa à cláusula seguinte, o esgotamento lança `{case_clause, Value}`. Cada
  cláusula parte das associações anteriores ao case; o valor do case e cada
  associação exportada juntam-se num PHI por valor.
- Um `if` é um `case` sem expressão nem padrões: a guard de cada cláusula é
  tentada por ordem (um erro na guard rejeita a cláusula), o esgotamento lança
  `if_clause`, e os valores e as exportações juntam-se da mesma forma.
- `begin`/`end` corre a sua sequência no âmbito envolvente e produz o seu
  último valor.
- As sequências do corpo correm por ordem e devolvem o último valor. Uma
  correspondência avalia o seu RHS uma vez, associa os nomes novos, verifica os
  existentes e devolve o RHS (também para `_ = RHS`). As cadeias avaliam
  primeiro o RHS mais interior.
- Os literais átomo carregam associações do módulo; a correspondência nunca
  interna átomos.
- As cabeças com variáveis incondicionais compilam para IR de projeção
  compacta.

## Limites

A normalização de padrões partilha o orçamento semântico do módulo (1 000 000
de unidades, ou 32 por expressão em módulos maiores) (um inteiro custa cerca
do seu número de dígitos decimais);
uma constante acima do limite de inteiros de 4 194 240 bits é um
`illegal pattern`, como no OTP ([termos](terms.md#integers)).
Cada plano de correspondência tem um teto de 100 000 unidades de trabalho. O
parser limita separadamente o aninhamento a 256 (teto absoluto de 512).
