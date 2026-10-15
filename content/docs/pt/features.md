---
source: docs/features.md
sourceCommit: 6ed3851c
sourceSha256: bdb726e4ca520adf0644572e0d808482745802ff3316d535cdb5ea6178e5a0a8
translatedAt: 2026-10-15
---
# Comunicação de funcionalidades adiadas

Erlang legal que precise de uma funcionalidade não implementada falha com uma
única mensagem explícita, distinta dos erros comuns de entrada inválida. As
alternativas genéricas suportadas (por exemplo, especialização saltada) são
silenciosas e não constituem uma falha.

```text
[pattern matching] notimpl: src/example.erl:12:5 [module="example"] [target="native"] [operation="match argument"]
```

## Catálogo

[features.hpp](../abi/include/clause/abi/features.hpp) atribui IDs estáveis e
nunca reutilizados e nomes de diagnóstico, com responsável e estado por
entrada. Uma entrada é retirada ou refinada quando a sua funcionalidade fica
pronta; o seu ID mantém-se reservado.

| Responsável | Onde comunica |
| --- | --- |
| Análise semântica do compilador | Verificações de capacidade sobre todas as funções, incluindo código não usado |
| Rebaixamento do compilador | Rejeição defensiva nas operações alcançadas; limpa os artefactos preparados |
| Driver | `-o/--output` [liga](executables.md#linking) as entradas posicionais ou um alvo de projeto; as compilações de projetos ligam cada alvo executável ao [`output`](projects.md#executables) do seu manifesto |
| Serviços do runtime | Ver [serviços adiados do runtime](runtime.md#deferred-services) |

## Regras das mensagens

- O [formatador](../abi/include/clause/abi/feature_diagnostic.hpp) partilhado
  omite o contexto desconhecido, escapa os bytes de controlo como `\xHH` e
  escapa as aspas e as barras invertidas, para que o contexto não possa
  injetar linhas. O UTF-8 é mantido.
- Exatamente uma mensagem por operação falhada, independentemente de
  `--verbose`.
- Uma funcionalidade adiada que o compilador pudesse saltar sem alterar o que
  aceita seria comunicada como aviso e a compilação continuaria; hoje nenhuma
  o faz (`parse transforms` fazia-o até o step 73F do plano as aplicar, ver
  [transforms](transforms.md)). `codegen_placeholders` verifica uma mensagem
  por cada funcionalidade adiada do compilador.
- Compilador: [reject_feature](../compiler/src/codegen/features.hpp) comunica
  a primeira falha de um lote, regista a falha, descarta a saída preparada e
  marca o diagnóstico como `reported`, para que os drivers não o voltem a
  imprimir.
- Runtime: [FeatureFailure](../runtime/include/clause/runtime/features.hpp)
  comunica uma vez por operação através de um destino emprestado (null →
  stderr). As chamadas posteriores devolvem o estado registado. As falhas do
  destino ou da formatação tornam-se `diagnostic_failure`; as exceções são
  contidas.
- Os chamadores propagam a falha sem a voltar a comunicar; um anfitrião deve
  terminar com um código diferente de zero e encerrar normalmente.
