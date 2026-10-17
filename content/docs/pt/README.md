---
source: docs/README.md
sourceCommit: a8c3f8f6
sourceSha256: 2124516a48ed02c82259ea7ac1d86d673aaf9cff2feba5044f3db2a30ad0db18
translatedAt: 2026-10-17
---
# Documentação do Clause

Notas de referência breves sobre a implementação atual. Cada ficheiro descreve o
comportamento e os limites que existem hoje; os planos e o histórico dos passos
encontram-se em `.agents/`.

| Tema | Documento |
| --- | --- |
| Pré-processamento (comportamento do `epp`, inclusões, macros, funcionalidades) | [preprocessor.md](preprocessor.md) |
| Análise sintática, posse da AST, limites da sintaxe | [parser.md](parser.md) |
| Projetos TOML, seleção de alvos, diretório de compilação e caches, fontes ignoradas | [projects.md](projects.md) |
| CLI do compilador, artefactos, impressão do código-fonte e do formato abstrato, cache de compilação, SDK do LLVM, PCRE2 e zlib, exemplo | [compile.md](compile.md) |
| Ponto de entrada do executável, argumentos, estado de saída, fluxos de saída, ligação | [executables.md](executables.md) |
| Informação de depuração (`-g`), depuradores e a pilha de chamadas Erlang | [debugging.md](debugging.md) |
| Perfilagem opcional (`--profile FILE`): entradas e tempo próprio por função e processo | [profiling.md](profiling.md) |
| Parse transforms: carregador OTP do anfitrião, intercâmbio do formato abstrato, localização de transforms | [transforms.md](transforms.md) |
| Análise semântica, tipos, inferência, vinculações | [semantic.md](semantic.md) |
| Especialização de tipos em `-O2`: provas e variantes de representação | [specialization.md](specialization.md) |
| ABI do código gerado: termos, símbolos, registo, falhas, raízes | [abi.md](abi.md) |
| Padrões, cláusulas, correspondências no corpo e comprehensions | [patterns.md](patterns.md) |
| Guards e o catálogo de BIFs de guard | [guards.md](guards.md) |
| Representações de termos (átomos, números, contentores, maps, bits, records) e impressão | [terms.md](terms.md) |
| Records nativos, qualificados e anónimos (OTP 29) | [native-records.md](native-records.md) |
| Valores de função: `fun F/A`, `fun M:F/A`, closures, funs com nome, chamadas dinâmicas | [funs.md](funs.md) |
| Builtins de produção: catálogo, chamadas de ponte, builtins de módulo, porções, registo | [builtins.md](builtins.md) |
| Módulos de biblioteca em `library/{erts,kernel,stdlib}` compilados com os programas, como os programas os obtêm, módulos fornecidos e em falta | [library.md](library.md) |
| Saída na consola: `io:format`, `io:put_chars`, dispositivos, controlos de formato, disposição de `~p` | [io.md](io.md) |
| Ciclo de vida do runtime, memória, servidor de código, termos persistentes, threads, saída padrão, arranque | [runtime.md](runtime.md) |
| Processos: workers do escalonador, mensagens e receive, ligações, monitores, nomes registados, temporizadores, introspeção, aliases, sinais de saída | [processes.md](processes.md) |
| Portas: identidade, tabela de portas, drivers, modos de dados, a thread de E/S, portas ocupadas, subprocessos, E/S padrão, ficheiros e sockets | [ports.md](ports.md) |
| Contrato do heap do processo: disposição das palavras, áreas, admissão, raízes, recolha | [runtime-heap.md](runtime-heap.md) |
| Modelo de execução: frames, chamadas, chamadas de cauda, cedência, exceções | [execution-model.md](execution-model.md) |
| Comunicação de funcionalidades adiadas (`notimpl`) | [features.md](features.md) |
| Fixação da referência ao código-fonte do OTP e procedimento de atualização | [otp-reference.md](otp-reference.md) |
| Diferenças de comportamento conhecidas em relação ao Erlang/OTP | [differences.md](differences.md) |
| Base de validação, modos de teste, lacunas por plataforma, benchmarks, histórico | [validation.md](validation.md) |

Os registos de validação anteriores, por passo, e o JSON de evidências foram
condensados no [histórico de validação](validation.md#history); os originais
completos permanecem no histórico do Git (presentes pela última vez no commit
`2777c98`).
