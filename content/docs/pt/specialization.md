---
source: docs/specialization.md
sourceCommit: 06042fa
sourceSha256: 2c39d48470df1d080597dde6ad170daf6c6a24e35d3a42c166a0c9dcf90dee23
translatedAt: 2026-10-09
---
# Especialização de tipos

O modo de velocidade (`-O2`) pode clonar uma função em variantes de
representação protegidas por verificações de etiqueta em tempo de execução.
`-O0` e `--no-type-specialization` produzem apenas código genérico.

## Política

- Os perfis provêm de factos inferidos nos locais de chamada. Atualmente, só
  singletons inteiros exatos e representáveis no alvo provam um argumento de
  inteiro pequeno. Specs, `integer()` genérico, uniões e desconhecidos
  permanecem genéricos.
- Uma variante só se justifica se remover uma verificação implementada: uma
  comparação exata da etiqueta baixa num carregamento de argumento no bloco de
  entrada, antes de quaisquer efeitos secundários.
- Limites: 3 variantes por função, 32 por módulo, 128 por alvo. O crescimento
  estimado e depois o real (clone + guards + despacho + recurso) tem de ficar
  dentro de 2x o número de instruções genéricas por função e por módulo.
- Os corpos genéricos são sempre mantidos. Os rascunhos que excedem o orçamento
  são descartados silenciosamente; o programa nunca falha por causa da
  especialização.
- A seleção é determinística (ordem de módulo, símbolo, perfil).

## Rebaixamento (lowering)

A clonagem/simplificação do LLVM substitui as verificações provadas dentro do
clone. Um despachante limitado testa cada etiqueta restringida e encaminha o
contexto e os argumentos para uma variante ou para o corpo genérico; o símbolo
público e a ABI não mudam. Não são introduzidos unboxing não verificado,
pressupostos de specs nem flags de fast-math.

## Efeito atual

O subconjunto atual do código-fonte não tem verificações de representação
removíveis, pelo que o código-fonte Erlang real recebe zero variantes, mesmo em
O2; especializar uma identidade apenas aumentaria o código. Fixtures LLVM
dedicadas injetam verificações de etiqueta repetidas para exercitar acertos,
recursos e a reversão de crescimento com execução nativa.

`codegen_measurements` escreve `measurements/<config>/measurements.json` no
diretório de compilação dos testes de codegen (tempo de compilação, bytes de
IR/objeto, variantes, tempo nativo). Os tempos são descritivos, nunca limiares.
Amostra Windows x64 / LLVM 23.1.2 (2026-09-29): carga de trabalho de
código-fonte com 232 876 bytes de IR / 40 498 bytes de objeto em O0 e
204 408 / 35 886 em ambas as políticas O2, zero variantes; a fixture sintética
acrescentou 30 instruções a uma função de 55 instruções para uma variante
aceite.
