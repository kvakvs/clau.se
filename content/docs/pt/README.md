---
source: docs/README.md
sourceCommit: 06042fa
sourceSha256: f48733b2827bbf09b77162c249d6b913411b1f3a60e76cf52b281ba68666f65b
translatedAt: 2026-10-09
---
# Documentação do Clause

Notas de referência breves sobre a implementação atual. Cada ficheiro descreve o
comportamento e os limites que existem hoje; os planos e o histórico dos passos
encontram-se em `.agents/`.

| Tema | Documento |
| --- | --- |
| Pré-processamento (comportamento do `epp`, inclusões, macros, funcionalidades) | [preprocessor.md](preprocessor.md) |
| Análise sintática, posse da AST, limites da sintaxe | [parser.md](parser.md) |
| Projetos TOML e seleção de alvos | [projects.md](projects.md) |
| CLI do compilador, artefactos, SDK do LLVM, exemplo | [compile.md](compile.md) |
| Ponto de entrada do executável, argumentos, estado de saída, fluxos de saída, ligação | [executables.md](executables.md) |
| Análise semântica, tipos, inferência, vinculações | [semantic.md](semantic.md) |
| Política de especialização de tipos | [specialization.md](specialization.md) |
| ABI do código gerado: termos, símbolos, registo, falhas, raízes | [abi.md](abi.md) |
| Padrões, cláusulas e correspondências no corpo | [patterns.md](patterns.md) |
| Guards e o catálogo de BIFs de guard | [guards.md](guards.md) |
| Representações de termos (átomos, números, contentores, maps, bits, records) e impressão | [terms.md](terms.md) |
| Records nativos, qualificados e anónimos (OTP 29) | [native-records.md](native-records.md) |
| Valores de função: `fun F/A`, `fun M:F/A`, chamadas de funs | [funs.md](funs.md) |
| Builtins de produção: catálogo, chamadas de ponte, funs builtin, registo | [builtins.md](builtins.md) |
| Módulos de biblioteca (subconjuntos de `lists`, `maps`) compilados com os programas | [library.md](library.md) |
| Saída na consola: `io:format/1,2`, `io:put_chars/1`, disposição de `~p` | [io.md](io.md) |
| Ciclo de vida do runtime, memória, saída padrão, servidor de código, contabilidade do escalonador | [runtime.md](runtime.md) |
| Processos: workers do escalonador, fatias de tempo, `spawn/1,3`, `is_process_alive/1`, ligações, sinais de saída, monitores, nomes registados | [processes.md](processes.md) |
| Portas: identidade, tabela de portas, drivers, modos de dados, a thread de E/S, E/S padrão, ficheiros e sockets (decisão do plan step 57A) | [ports.md](ports.md) |
| Contrato do heap do processo: disposição das palavras, áreas, admissão, raízes, recolha | [runtime-heap.md](runtime-heap.md) |
| Decisão sobre o modelo de execução: frames, chamadas, chamadas de cauda, cedência, exceções | [execution-model.md](execution-model.md) |
| Relato de funcionalidades adiadas (`notimpl`) | [features.md](features.md) |
| Fixação da referência ao código-fonte do OTP e procedimento de atualização | [otp-reference.md](otp-reference.md) |
| Diferenças de comportamento conhecidas em relação ao Erlang/OTP | [differences.md](differences.md) |
| Base de validação, modos de teste, lacunas por plataforma, histórico | [validation.md](validation.md) |

Os registos de validação anteriores, por passo, e o JSON de evidências foram
condensados no [histórico de validação](validation.md#history); os originais
completos permanecem no histórico do Git (presentes pela última vez no commit
`2777c98`).
