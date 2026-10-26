---
source: docs/README.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: be550511f58d81353b8a28ffdeba68d3c2e49d69eb8cb6688c3867b834199234
translatedAt: 2026-10-26
---
# Documentação do Clause

Notas de referência breves sobre a implementação atual. Cada ficheiro descreve o
comportamento e os limites que existem hoje; os planos e o histórico dos passos
encontram-se em `.agents/`.

| Tema | Documento |
| --- | --- |
| Compilação do Clause: requisitos, presets, opções de configuração, testes, controlo de qualidade, benchmarks | [building.md](building.md) |
| Pré-processamento (comportamento do `epp`, inclusões, macros, funcionalidades) | [preprocessor.md](preprocessor.md) |
| Análise sintática, posse da AST, limites da sintaxe | [parser.md](parser.md) |
| Projetos TOML, seleção de alvos, diretório de compilação e caches, fontes ignoradas | [projects.md](projects.md) |
| CLI do compilador, artefactos, impressão do código-fonte e do formato abstrato, cache de compilação, SDK do LLVM, PCRE2 e zlib, exemplo | [compile.md](compile.md) |
| Especificações ASN.1: entradas `.asn` e `[[targets.asn1]]`, opções de asn1ct, cobertura, módulos gerados | [asn1.md](asn1.md) |
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

## Bibliotecas

Aplicações OTP próprias do Clause em `library/`, em [libraries/](libraries).

| Tema | Documento |
| --- | --- |
| Módulos de biblioteca em `library/{erts,kernel,stdlib}` compilados com os programas, como os programas os obtêm, módulos fornecidos e em falta | [library.md](library.md) |
| Saída na consola: `io:format`, `io:put_chars`, dispositivos, controlos de formato, disposição de `~p` | [io.md](io.md) |
| Criptografia: versões e fontes do OpenSSL, compilação, ligação, modo FIPS e programas FIPS fixados | [crypto.md](crypto.md) |
| public_key: especificações ASN.1 e respetivas fontes, módulos gerados, `public_key.hrl` | [public_key.md](public_key.md) |
