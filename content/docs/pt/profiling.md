---
source: docs/profiling.md
sourceCommit: a8c3f8f6
sourceSha256: ae0b17c50da6bb2c36a31edf31aaa901aa6c57f3e662ef6fe663d066c1d7159a
translatedAt: 2026-10-17
---
# Perfilagem

`--profile FILE` (uma [opção do runtime](executables.md#runtime-options),
também através de `CLAUSE_FLAGS`) faz com que um programa escreva um relatório
de custos em `FILE` quando termina. Nada é recompilado: todos os executáveis
podem ser perfilados e, sem a opção, executam, imprimem e escrevem ficheiros
exatamente da mesma forma. Um relatório que não pode ser escrito é comunicado
em stderr (`clau: cannot write profile FILE`); o código de saída continua a ser
o do programa.

## Atribuição

O runtime atribui os custos nos pontos onde o controlo passa entre frames
([modelo de execução](execution-model.md)), sem instrumentação no código
gerado:

- **Entradas** (reduções): cada entrada numa função Erlang através de uma
  chamada ou de uma chamada de cauda conta uma para essa função, tal como uma
  fatia de tempo conta reduções.
- **Tempo próprio**: o tempo do relógio monótono entre uma transferência
  (entrada, retorno, início de uma fatia de tempo) e a seguinte pertence à
  função cujo frame estava no topo. Os builtins e os serviços do runtime
  contam como tempo da função que os chamou; o tempo durante o qual um
  processo espera ou não está escalonado não conta para ninguém. O tempo
  antes da primeira entrada de um processo é `(runtime)`.
- **Por processo**: cada processo mantém os seus próprios custos; são
  somados aos do programa quando o contexto do processo é destruído, com o
  seu pid, os totais e a função mais dispendiosa.

Cada pilha ativada lê o relógio em cada transferência (cerca de 8% mais lenta
num ciclo denso em chamadas em Debug); as pilhas desativadas pagam um salto
condicional por transferência.

## Relatório

```text
Clause profile: 2 processes, 503 time slices, 0 timer clock readings
Functions by self time:
     time_us   share      entries  function
     1193261  100.0%      2000001  profile:spin/2
         204    0.0%            1  profile:main/1
         130    0.0%            1  profile:-main/1-fun-0-/1
           0    0.0%            1  profile:cold/1
Processes by time:
     time_us   share      entries  process: top function
     1193393  100.0%      2000002  <0.2.0>: profile:spin/2
         206    0.0%            2  <0.1.0>: profile:main/1
```

A primeira linha conta também as fatias de tempo que os workers do
escalonador executaram e as leituras de relógio da thread do temporizador dos
tempos limite de receive
([roda de temporizadores](processes.md#receive-timeouts)). As funções são
`module:function/arity` (as funs anónimas pelos seus nomes gerados, cuja
aridade conta os valores capturados); os empates ordenam-se pelo nome, os
processos pelo tempo e depois pelo pid. Os tempos estão em microssegundos e
variam entre execuções; as entradas são exatas.

## Testes

`linking_profiling` liga `tests/fixtures/linking/profile` em O0 e O2 e
executa-o sem perfilagem, com `--profile FILE` e com
`CLAUSE_FLAGS=--profile=FILE`: a saída é idêntica, `spin/2` fica em primeiro
lugar no tempo próprio com exatamente 2 000 001 entradas, o processo que gira
fica em primeiro lugar, e `--profile` sem ficheiro falha com o código de
saída 70.
