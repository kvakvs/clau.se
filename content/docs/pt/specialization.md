---
source: docs/specialization.md
sourceCommit: 6ed3851c
sourceSha256: 896b741de11f8f1f7f9098670798d1de273c0e4be02cb7ebfadca90e184b0e36
translatedAt: 2026-10-15
---
# Especialização de tipos

O modo de velocidade (`-O2`) usa [factos inferidos](semantic.md#inference) para
remover verificações em tempo de execução (provas) e pode clonar uma função em
variantes de representação protegidas por verificações de etiqueta em tempo de
execução. `-O0` e `--no-type-specialization` produzem apenas código genérico:
todas as verificações ficam, e cada acesso a um termo composto passa pelo seu
serviço do runtime.

## Provas

Uma prova só provém de factos que se verificam sempre que o código corre:

- os factos dos argumentos de uma função local, reunidos a partir de todos os
  seus chamadores (`Inference::inputs`; as funções exportadas e as funções
  nomeadas por `fun F/A` não têm nenhum);
- o facto registado de uma expressão (o facto de um operando é registado antes
  de a operação que o usa o estreitar);
- um teste de forma anterior no mesmo plano de correspondência: os nós do
  plano correm em linha, pelo que um teste de tuplo ou de cons bem-sucedido
  domina todos os nós posteriores.

As especificações nunca provam nada. `term()` e `none()` (código que a
inferência considerou inalcançável) não provam nada; os corpos de funs
anónimas não recebem provas.

| Operação | Provada por | Código gerado |
| --- | --- | --- |
| `+ - *` | ambos os operandos em intervalos de inteiros pequenos, intervalo do resultado dentro do payload imediato | descodifica, calcula e codifica inline; sem etiqueta, overflow nem recurso |
| `+ - *` | um ou ambos os operandos em intervalos de inteiros pequenos | os testes de etiqueta provados desaparecem; a verificação de overflow e o recurso ao serviço ficam |
| padrão de tuplo | facto do argumento ou do escrutinado: tuplos exatos com a aridade do padrão | teste de forma removido (não provado: testado inline) |
| elemento de tuplo | um teste de forma ou um facto que prova o tuplo | carregamento inline do elemento |
| padrão de lista | facto: certamente uma célula cons | teste de forma removido (caso contrário, um teste de etiqueta primária em cada nível) |
| cabeça, cauda | um teste de cons ou um facto que prova a célula | carregamentos inline |
| literal exato `[]`, `{}`, inteiro pequeno, átomo | sempre (todos os níveis desde OPT0.2A) | comparação de palavras: imediatos iguais são uma só palavra |
| gerador de lista | facto da entrada do gerador: uma lista própria | teste de cons e leituras de células inline em cada iteração |

Os factos chegam aos padrões das cabeças de funções (argumentos reunidos dos
chamadores), às correspondências no corpo (o lado direito) e às cláusulas
case/try (o escrutinado ou o valor do corpo do try); os factos de elemento,
cabeça e cauda acompanham as extrações. Uma leitura inline é guardada num slot
de raiz como uma saída de serviço, pelo que o rebaixamento dos frames a mantém
como termo através dos safepoints ([regra de recarga](runtime-heap.md#reload-rule)).
As únicas conversões de ponteiros no código gerado são estas leituras provadas
e os carregamentos de cabeçalho dos testes de forma de tuplo inline
(`proven.cell`).
As constantes de disposição provêm de [`abi/term.hpp`](abi.md#terms); o
runtime verifica-as em relação às suas disposições privadas de células.

## Variantes

- Os perfis provêm de factos dos locais de chamada: um argumento cujo facto só
  contém inteiros pequenos (singletons ou intervalos) prova um argumento de
  inteiro pequeno. Specs, `integer()` genérico, uniões com outros tipos e
  desconhecidos permanecem genéricos.
- Uma variante só se justifica se remover uma verificação implementada: uma
  comparação exata da etiqueta baixa de uma palavra de argumento em qualquer
  ponto do corpo (o array de argumentos nunca é escrito, e uma recolha nunca
  altera um inteiro pequeno).
- Limites: 3 variantes por função, 32 por módulo, 128 por alvo. O crescimento
  estimado e depois o real (clone + guards + despacho + recurso) tem de ficar
  dentro de 2x o número de instruções genéricas por função e por módulo.
- Os corpos genéricos são sempre mantidos. Os rascunhos que excedem o orçamento
  são descartados silenciosamente; o programa nunca falha por causa da
  especialização.
- A seleção é determinística (ordem de módulo, símbolo, perfil).

A clonagem/simplificação do LLVM substitui as verificações provadas dentro do
clone. Um despachante limitado testa cada etiqueta restringida e encaminha o
contexto e os argumentos para uma variante ou para o corpo genérico; o símbolo
público e a ABI não mudam. Não são introduzidos pressupostos de specs nem
flags de fast-math.

## Efeito atual

As provas atuam sobre código-fonte real: as funções locais cujos chamadores
passam inteiros pequenos, tuplos e listas perdem as suas verificações de
etiqueta, de forma e de serviço
([`proofs`](../tests/fixtures/executables/proofs/proofs.erl), verificado pelo
CTest `codegen_proofs` e executado como o golden de executáveis
`executables_proofs`). Uma variante tem de poupar mais instruções do que custa
o seu despacho; um único teste de etiqueta removido de um argumento raramente
o consegue, pelo que as variantes de código-fonte são normalmente planeadas e
depois rejeitadas pelo limite de crescimento. Fixtures LLVM dedicadas injetam
verificações de etiqueta repetidas para exercitar acertos, recursos e a
reversão de crescimento com execução nativa.

Os goldens de executáveis correm com todas as políticas no modo completo; o
modo rápido corre `-O0` (genérico) e `-O2` com especialização (provas).

`codegen_measurements` escreve `measurements/<config>/measurements.json` no
diretório de compilação dos testes de codegen (tempo de compilação, bytes de
IR/objeto, variantes, leituras provadas, tempo nativo). Os tempos são
descritivos, nunca limiares. Amostra Windows x64 / LLVM 23.1.2 (2026-09-29,
antes das provas): carga de trabalho de código-fonte com 232 876 bytes de IR /
40 498 bytes de objeto em O0 e 204 408 / 35 886 em ambas as políticas O2, zero
variantes; a fixture sintética acrescentou 30 instruções a uma função de 55
instruções para uma variante aceite.
