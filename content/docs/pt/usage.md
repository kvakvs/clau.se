---
source: docs/usage.md
sourceCommit: 06042fa
sourceSha256: 69cd5cc2e8c6acc6bf67d677812a78d984940084e75d4930fbdcdf681e488435
translatedAt: 2026-10-09
---
# Utilizar o compilador

```sh
./build/debug/bin/clau --parse-check examples/project/src/main.erl
./build/debug/bin/clau --print-pp -I include -DDEBUG examples/project/src/main.erl
./build/debug/bin/clau --print-ast examples/project/src/main.erl
```

Em macOS, `./run-macos.sh --parse-check examples/project/src/main.erl` compila
primeiro e corre o executável mais recente, passando todos os argumentos sem
alteração. Aceita as variáveis de ambiente `BUILD_DIR`, `BUILD_TYPE` e `JOBS`
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
  --print-types            Print each module as source annotated with inferred types
  --print-ir               Print verified IR with Erlang source comments before LLVM optimization
  --print-optimized-ir     Print verified IR with Erlang source comments after LLVM optimization
  --emit obj|llvm-ir|llvm-bc  Write one artifact per module
  --artifact-dir <dir>     Override the artifact root (requires --emit)
  --target-triple <triple>  Select the machine/OS/ABI
  -O0 / -O2 / -Os         Generic O0 (default) / speed / size optimization
  --no-type-specialization  Disable compiler variants at either optimization level
  --verbose               Trace files and compilation phases to stderr
  --impldebug <n[,n...]>   Enable debug output for selected implementation steps
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
clau --print-types answer.erl client.erl
```

A inspeção da IR permite ambas as fases em conjunto e para antes da emissão
de objetos. Vários instantâneos são módulos separados; use `--emit llvm-ir`
para ficheiros assembly individuais. A inspeção de tipos para antes do LLVM e
imprime cada módulo como código-fonte com as assinaturas de funções inferidas
e anotações `Expression :: Type`. Aceita opções de
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

`--impldebug 23` ou `--impldebug 23,24,27` seleciona saída de depuração
opcional dos passos de implementação, independentemente de `--verbose`. As
opções repetidas combinam as suas seleções; os duplicados são ignorados. Os
valores são inteiros decimais de 32 bits com sinal, com sinais `+`/`-`
opcionais e sem espaços nem membros vazios na lista. Os steps 23–27 imprimem
em stderr as entradas/resultados de funções inferidos e as relações entre
parâmetros com o prefixo do step selecionado (por exemplo,
`[impldebug 27]`). Estas são entradas analisadas do rebaixamento, não um dump
da IR. Os steps futuros podem verificar o seu próprio número; selecionar um
step sem saída de depuração não tem efeito. A mesma seleção aplica-se às
entradas posicionais e a todos os alvos de projeto selecionados. As ações de
verificação/impressão só de frontend não correm a inferência.

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
