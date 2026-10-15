---
source: docs/usage.md
sourceCommit: 6ed3851c
sourceSha256: d4118cc040e610cc84df916720e96a6009b90b6a1cbfe086434dc5800fe49461
translatedAt: 2026-10-15
---
# Utilizar o compilador

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

Em macOS, `./run-macos.sh --parse-check examples/project/src/main.erl` compila
primeiro e corre o executável mais recente, passando todos os argumentos sem
alteração. Aceita as variáveis de ambiente `TOOL_BUILD_DIR`, `BUILD_TYPE` e `JOBS`
para substituir os valores por omissão.

```text
clau [options] <source.erl>...
  --project <path>        Read a TOML project instead of positional sources
  --target <name>         Select a target; repeat for more (default: all)
  --new-project <filename>  Create an annotated starter; append .toml when needed
  --preprocess-check       Check preprocessing only
  --parse-check            Preprocess and check syntax
  --print-pp               Print expanded Erlang source
  --print-ast              Print an indented syntax tree
  --print-source           Print each module as Erlang source
  --print-abstr            Print each module as OTP abstract format forms
  --parse-transform <mod>  Apply a parse transform to every module
  --transform-path <dir>   Directory of precompiled transform modules (.beam)
  --erl <path|none>        Host Erlang/OTP 29 erl that runs parse transforms
  --print-inputs           List the batch's sources, including modules added by reference; do not compile
  --print-env              Print the resolved compile environment as TOML and exit
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --print-asm              Print each module's assembly with IR and Erlang source comments
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  -g                      Emit Erlang line tables; executables keep them for debuggers
  --lto                   Link modules as bitcode with link-time optimization (LLD targets)
  --keep-exports          Keep every export of an executable callable (default: unreachable ones left out)
  --build-dir <dir>       Keep temporary files and caches below <dir> (projects default: <manifest-dir>/build)
  --no-cache              Neither read nor write build caches
  --cache-inference-in-dirs <pattern>  Cache inference results of modules in matching directories (besides OTP's)
  --verbose               Trace files and compilation phases to stderr
  --print-stage-times     Print preprocess/parse/transform time per file, compile time per batch and link time to stderr
  -I, --include <dir>      Add an include directory (last supplied searched first)
  -D, --define <name[=term]>  Define a macro (default value: true)
  --app-dir <app=dir>      Set an include_lib application directory
  --enable-feature <name>  Enable a language feature
  --disable-feature <name> Disable a language feature
  -h, --help              Show all options
  --version               Show version
  --                      Treat remaining arguments as input paths
```

Ponha entre aspas os caminhos que contêm espaços e os valores de macros que
contêm pontuação da shell:

```sh
./build/debug/bin/clau --parse-check -I include '-DVERSION={1,0}' \
  --app-dir myapp=examples/project examples/project/src/main.erl
```

Os modos de verificação são silenciosos em caso de sucesso; os diagnósticos
vão para stderr. Os modos de impressão escrevem para stdout e podem ser
combinados: `--print-pp --print-ast` imprime o código-fonte antes da árvore
para cada entrada. Acrescentar `--preprocess-check` não desativa a análise
sintática pedida por `--parse-check` ou `--print-ast`. Os erros podem deixar
saída impressa parcial.

Sem ação de verificação/impressão, as entradas de código-fonte e `--project`
correm o pipeline completo até buffers de objetos nativos verificados em
memória. As entradas posicionais formam um lote; cada alvo de projeto forma o
seu próprio lote. `--emit` escreve artefactos em `build/aot` ou em
`--artifact-dir`; os projetos acrescentam um nome de alvo codificado e usam
uma raiz por omissão relativa ao manifesto. Os nomes de ficheiros codificam a
identidade do módulo. `-o PATH` liga as entradas posicionais, ou um alvo de
projeto selecionado, num executável com o Clang e a biblioteca do runtime
(entrada: `--entry MODULE[:FUNCTION]`, `entry` do manifesto, ou o único módulo
que exporta `main/1`). Sem `-o`, os alvos de projeto com uma chave `output` ou
`entry` são ligados ao seu `output` TOML (por omissão `build/<target>`),
publicando apenas depois de todos os alvos selecionados terem sido ligados.
Ver [executáveis](executables.md) para o contrato de entrada, argumentos e
código de saída.

```sh
clau -O2 -o demo answer.erl client.erl && ./demo
clau -O2 --emit obj answer.erl client.erl
clau --print-ir --print-optimized-ir -O2 answer.erl
clau --print-asm -O2 answer.erl
clau --print-types answer.erl client.erl
```

A inspeção da IR permite ambas as fases em conjunto e para antes da emissão
de objetos. Vários instantâneos são módulos separados; use `--emit llvm-ir`
para ficheiros assembly individuais. `--print-asm` imprime o assembly do alvo
de cada módulo, com cada sequência de instruções comentada com a instrução IR
e a linha Erlang de onde veio
([listagens assembly](compile.md#assembly-listings)). A inspeção de tipos para
antes do LLVM e imprime cada módulo como código-fonte com as assinaturas de
funções inferidas e comentários `% Type` no fim de cada linha, para a
expressão mais exterior da linha. Aceita opções de
pré-processamento/projeto/verbosidade, mas rejeita outras ações, destinos de
saída e políticas de backend. Ver [opções de compilação](compile.md).

`--verbose` imprime `[pp] <filename>` para os ficheiros de código-fonte e os
includes resolvidos pelo pré-processador, e `[parse] <filename>` quando cada
código-fonte entra no parser. Os includes aninhados e de bibliotecas são
registados à medida que são carregados; os includes inativos são saltados. O
parser consome os tokens expandidos de forma incremental, pelo que o seu
registo pode preceder o dos includes. `[comp]` acrescenta as fases
semântica/backend e as decisões de especialização limitada à medida que
começam. O registo vai para stderr em todos os modos, incluindo projetos.

`--print-stage-times` imprime `[time] <stage> <subject>: <milliseconds> ms` em
stderr à medida que cada fase termina: `preprocess` (leitura e
pré-processamento), `parse` e, para módulos que usam parse transforms,
`transform` (a execução do `erl` do anfitrião e a importação das suas formas)
por ficheiro de código-fonte, `compile` (da análise até à emissão de objetos)
uma vez por lote, indicando o seu número de módulos e o alvo de projeto, e
`link` por executável, indicando o seu caminho final. O parser obtém as formas
do pré-processador, pelo que os dois tempos por ficheiro são medidos
separadamente enquanto se intercalam.

Códigos de saída: **0** em caso de sucesso (incluindo avisos), **1** para
erros de código-fonte/projeto, **2** para erros de utilização ou nomes de
alvos desconhecidos.
Cada entrada tem um estado de pré-processamento independente; qualquer erro
de código-fonte faz falhar o comando no seu todo.

As verificações de sintaxe não validam a semântica nem executam parse
transforms. Os modos de verificação/impressão não criam ficheiros de saída e
rejeitam `-o`/`--output`. A compilação por omissão sem `-o` não escreve
nenhum executável.

Ver [pré-processamento](preprocessor.md), [utilização do parser](parser.md) e
[estado da validação](validation.md) para mais pormenores.

## Projetos

Corra o exemplo incluído com dois alvos:

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target app
./build/debug/bin/clau --preprocess-check --project examples/project/project.toml --target tests --target app
```

Crie um projeto anotado num diretório existente:

```sh
mkdir -p build/project-demo
./build/debug/bin/clau --new-project build/project-demo/demo
mkdir -p build/project-demo/src
cp examples/project/src/main.erl build/project-demo/src/main.erl
./build/debug/bin/clau --parse-check --project build/project-demo/demo.toml
```

A criação escreve apenas o ficheiro TOML pedido e recusa destinos existentes.
O projeto inicial contém um alvo `app` que usa `src`, com todas as opções de
frontend nos seus valores por omissão. Acrescente ficheiros de código-fonte
antes de o verificar.

Os caminhos do manifesto são relativos ao ficheiro TOML; os caminhos da CLI
são relativos ao diretório de invocação. Todos os alvos correm por omissão.
Repita `--target` para escolher um subconjunto ordenado; as seleções repetidas
correm uma vez. `sources` suporta nomes de ficheiros literais e padrões `*`,
`?`, `**`; `source_dirs` descobre recursivamente ficheiros `.erl`. Os caminhos
de pesquisa de código-fonte só localizam ficheiros listados explicitamente. Os
caminhos de include da CLI têm precedência, as raízes de aplicações da CLI
substituem os nomes correspondentes, as definições de features da CLI
aplicam-se em último lugar, e as definições de macros duplicadas continuam a
ser erros.

Ver [formato e fluxos de trabalho dos projetos](projects.md). Os projetos
suportam todas as ações da CLI; a geração de executáveis continua por
implementar.

O [catálogo de guards admitidas](guards.md) inclui `is_integer/3` verificado,
chamadas qualificadas e testes legados ao nível superior; as identidades de
processo/nó e de native record mantêm diagnósticos de capacidade explícitos.
