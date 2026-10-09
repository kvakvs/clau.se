---
source: docs/compile.md
sourceCommit: 06042fa
sourceSha256: 6cf8b5c873d19e18501458078ca8c8ceb51da4da995693046af31ca5a78824b4
translatedAt: 2026-10-09
---
# Compilação

O `clau` compila módulos Erlang/OTP 29 através do LLVM para IR verificada,
bitcode ou objetos nativos. `-o/--output` liga as entradas posicionais (ou um
alvo de projeto selecionado), o respetivo objeto de arranque de
[entrada](executables.md) e o runtime num executável
([ligação](executables.md#linking)); as compilações de projetos ligam os alvos
executáveis às saídas do seu manifesto
([projetos](projects.md#executables)). Os objetos emitidos também podem correr
através de um harness C++ ligado ao runtime (ver o exemplo abaixo).

## Subconjunto de código-fonte aceite

Módulos com nome, com exportações e cláusulas de função ordenadas. As cabeças e
as correspondências no corpo aceitam variáveis, `_`, aliases, nomes repetidos
e padrões sobre átomos, inteiros arbitrários, floats finitos, tuplos,
listas/strings, maps, bitstrings e records comuns em tuplo. Os corpos são
sequências de correspondências, construtores, operadores/guard BIFs
verificados, `erlang:display/1` ([impressão](terms.md#printing)), `halt/0,1`
([código de saída](executables.md#exit-status)), os que lançam exceções
`error/1,2,3`, `exit/1`, `throw/1` e `erlang:raise/3`
([ABI](abi.md#failure-channel-revision-2)), os restantes
[builtins da ponte](builtins.md) (`erlang:function_exported/3`) e funs de
builtins, `case`/`if`, `catch Expr`,
`try ... of ... catch Class:Reason:Stack ... after` com
[rastreios de pilha](abi.md#stack-traces), `maybe ... else ... end`,
comprehensions de lista, binary e map
([padrões](patterns.md#comprehensions)) e chamadas diretas locais ou remotas
literais dentro do lote, incluindo recursão própria, mútua e entre módulos
sobre frames de processo explícitos com chamadas de cauda próprias
([modelo de execução](execution-model.md#implementation)); a recursão no corpo
é limitada pela pilha do processo (sem limite por omissão), não pela pilha
nativa. As guards suportam todo o catálogo admitido. Ver
[padrões](patterns.md), [guards](guards.md) e [termos](terms.md).

Os valores de função `fun F/A`, `fun M:F/A`, as funs anónimas e com nome com
variáveis capturadas, as chamadas de funs e as chamadas dinâmicas
(`M:F(...)`, `apply/2,3`) correm ([funs](funs.md)). São rejeitados com
diagnósticos, mesmo em funções não usadas:
`receive`, funs de builtins,
processos e troca de mensagens.
Atributos aceites: `module`, `export`, `file`, `record` em tuplo e nativo,
`export_record`, `import_record`, formas de type/spec,
`doc`/`moduledoc`, `author`, `vsn`, `copyright`, `deprecated`,
`-compile` com `{no_auto_import, ...}` ou opções `nowarn_*` que só afetam
avisos (por exemplo `nowarn_deprecated_catch`) e `-import` das guard BIFs de
`erlang`. Os restantes atributos (`on_load`, parse transforms, outras opções
de `compile`, módulos parametrizados) são rejeitados.
Os códigos-fonte que começam por `#!` seguem as
[regras de escript](executables.md#escripts) (módulo implícito e exportação de
`main/1`, `-mode` aceite).
As formas type/spec são analisadas, mas nunca alteram o código gerado. Os
modos só de sintaxe (`--parse-check`, `--print-ast`, `--print-source`, ...)
aceitam a gramática completa.

## Correr o exemplo de módulos compilados

`client:main/1` faz do exemplo um programa:

```sh
./build/debug/bin/clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo     # prints 42, -7 and {record,map,binary,list,integer,other}
```

Os mesmos módulos também correm através de um harness C++. A partir de uma
Developer PowerShell do Windows x64 com o compilador compilado:

```powershell
$tool = './build/debug/bin/clau.exe'
& $tool -O0 --emit obj --artifact-dir build/example-aot examples/compile/answer.erl examples/compile/client.erl
cmake -S examples/compile -B build/example-native -G Ninja -DCMAKE_CXX_COMPILER=clang-cl -DCMAKE_BUILD_TYPE=Debug "-DGENERATED_DIR:PATH=$((Resolve-Path build/example-aot).Path)"
cmake --build build/example-native
./build/example-native/bin/Debug/compiled_modules.exe
```

Imprime `42`, `-7`, `record`, `map`, `binary`, `list`, `integer`, `other`,
um por linha. O harness regista os módulos explicitamente, cria um contexto e
descodifica os resultados; é um anfitrião de exemplo, não um ponto de entrada
de produção. Em Unix, use-se `build/debug/bin/clau`, `clang++` e
`-DGENERATED_DIR="$PWD/build/example-aot"` (as execuções nativas aí ainda não
estão validadas).

Outras ações sobre os mesmos códigos-fonte:

```powershell
& $tool -O2 --emit llvm-ir --artifact-dir build/example-ir examples/compile/answer.erl examples/compile/client.erl
& $tool --print-types --verbose examples/compile/answer.erl examples/compile/client.erl
& $tool --print-ir --print-optimized-ir examples/compile/answer.erl examples/compile/client.erl
& $tool -O2 --no-type-specialization --verbose examples/compile/answer.erl examples/compile/client.erl
```

## Impressão do código-fonte

`--print-source` (uma ação do frontend, como `--print-ast`) imprime cada
módulo analisado como código-fonte Erlang; `--print-types` imprime o mesmo
texto com anotações de tipos. O impressor (`print_source`,
`expression_source`, `type_source` em `printing.hpp`;
`compiler/src/printing/source_*`) é reutilizável:

- As formas sucedem-se pela ordem do código-fonte, com uma linha em branco à
  volta de cada função; a forma `-file` que o pré-processador acrescenta antes
  de um módulo é omitida, as que rodeiam ficheiros incluídos são mantidas.
- O texto é a sintaxe analisada: as macros são expandidas, os includes
  inseridos, e os comentários, a grafia e a disposição originais desaparecem.
  As cláusulas e as expressões de bloco (`case`, `if`, `receive`, `try`,
  `maybe`, `begin`, funs com mais de uma linha) ocupam linhas indentadas de
  quatro colunas; tudo o resto fica numa só linha. Os parênteses vêm apenas dos
  próprios agrupamentos do código-fonte.
- O texto impresso volta a ser analisado para a mesma árvore sintática, e
  imprimi-lo de novo dá o mesmo texto (CTest `printing_source` sobre as
  fixtures analisáveis).
- `SourceNotes` acrescenta uma anotação a uma expressão, impressa como
  `Expression :: Text` (entre parênteses, a não ser que seja uma expressão de
  corpo inteira; não é Erlang), e linhas de comentário acima de uma forma. Os
  padrões, as guards e o lado esquerdo de uma correspondência não levam
  nenhuma.

## Opções

| Opção | Comportamento |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publica um artefacto por módulo |
| `--artifact-dir DIR` | Raiz dos artefactos (requer `--emit`) |
| `-o PATH` / `--output PATH` | Liga um executável ([ligação](executables.md#linking)); incompatível com `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Driver do Clang e arquivo do runtime para `-o` |
| `--entry MODULE[:FUNCTION]` | Função de entrada/1 do executável; validada em todos os modos de compilação e acrescenta o artefacto de arranque `clausev1_start` ([executáveis](executables.md#startup-object)) |
| `--target-triple TRIPLE` | Máquina alvo; `--target` é a seleção do alvo do projeto |
| `-O0` / `-O2` / `-Os` | Código genérico por omissão + LLVM O0 / especialização limitada + LLVM O2 / LLVM Os, sem especialização, uma secção por símbolo e eliminação pelo linker do código e dos dados não referenciados |
| `--no-type-specialization` | Desativa as variantes independentemente da ordem das opções |
| `--print-ir` / `--print-optimized-ir` | IR verificada antes/depois das passagens do LLVM, com as linhas do código-fonte Erlang como comentários |
| `--print-types` | Cada módulo como código-fonte Erlang anotado com os tipos inferidos ([análise semântica](semantic.md#--print-types)); para antes do LLVM |
| `--verbose` | Eventos das fases `[pp]`, `[parse]` e `[comp]` em stderr |
| `--impldebug n[,n...]` | Saída de depuração dos passos de implementação em stderr (p. ex. `23`: resumos de inferência) |

- Sem `--emit`, a compilação verifica os objetos em memória e não escreve
  nada.
- As entradas posicionais formam um lote; cada alvo de projeto é um lote
  próprio.
- Raízes dos artefactos: `build/aot` (posicionais) ou `build/aot/<hex-target>`
  sob o diretório do manifesto. As raízes explícitas são relativas à
  invocação.
- Os nomes são hexadecimais reversíveis: `answer` →
  `clausev1_616e73776572__0.obj` (`.o` para ELF/Mach-O, `.ll`, `.bc`); o
  objeto de arranque é `clausev1_start.obj`.
- Todos os lotes são compilados e preparados antes da publicação. As falhas
  não publicam nada e mantêm as saídas anteriores; a substituição é atómica
  por ficheiro, não por lote.
- `--emit` é incompatível com `-o`; as opções de compilação são incompatíveis
  com as ações só de frontend e com `--new-project`. `--print-types` rejeita
  opções de alvo/otimização.
- Os instantâneos de IR são assembly LLVM; vários instantâneos são separados
  por cabeçalhos de comentário escapados e não formam um módulo analisável.
  Use-se `--emit llvm-ir` como entrada para ferramentas. Os comentários com
  linhas do código-fonte mostram o texto original (macros não expandidas) e
  sobrevivem à otimização através das localizações de depuração.

## Backend

- Um contexto LLVM e uma máquina alvo por lote. A triple do anfitrião usa o
  CPU e as funcionalidades do anfitrião; as triples alheias usam o CPU
  genérico. PIC, modelo de código pequeno.
- Backends: X86, ARM, AArch64 (interseção com o SDK). Backends desconhecidos
  ou em falta falham; não há alternativa de recurso para o anfitrião.
- A verificação corre antes e depois da otimização; verifica a validade da IR,
  não a correção do Erlang.
- Orçamentos por alvo: 1024 módulos, 250 000 nós de AST por módulo, 1 000 000
  por lote. Saída serializada: 64 MiB por módulo, 256 MiB por lote. Exceder
  um orçamento é um diagnóstico de recursos comum.

## SDK do LLVM

LLVM estável **23.1.x**, no mínimo 23.1.1. O LLVM é uma dependência do
anfitrião: a arquitetura, a biblioteca padrão de C++ e o CRT do Windows têm de
corresponder aos da ferramenta do compilador. O código do projeto mantém
exceções/RTTI; nenhuma exceção pode propagar-se através do LLVM. O runtime
nunca usa o LLVM.

- A descoberta procura nos prefixos padrão (`/usr`, `/usr/local`,
  `/opt/homebrew`, `/opt/local`, `/opt/llvm`, Linuxbrew,
  `/Library/Developer/Toolchains`, Program Files no Windows), incluindo
  disposições com versão. As árvores de compilação são rejeitadas.
- `LLVM_DIR` seleciona um SDK explicitamente; seleções inválidas falham sem
  alternativa.
- Se nenhum for encontrado, o CMake descarrega o arquivo fixado **23.1.2**
  (verificado por SHA-256) para `thirdparty/` em Windows x64/ARM64, Linux
  x64/ARM64 ou macOS ARM64. `CLAUSE_DOWNLOAD_LLVM=OFF` desativa as
  transferências.
- Uma sonda de ligação durante a configuração verifica a compatibilidade da
  ABI.

Configuração de referência em Windows x64 (2026-09-29): clang-cl 23.1.2 do
anfitrião em `C:/Program Files/LLVM/bin`, SDK
`thirdparty/clang+llvm-23.1.2-x86_64-pc-windows-msvc`, ferramentas x64 do
Visual Studio 18, Windows SDK 10.0.26100.0, Ninja, `/MT`,
`_ITERATOR_DEBUG_LEVEL=0`. A seleção automática aplica as definições `/MT` e
do iterador; um `LLVM_DIR` explícito não o faz, e a sonda de ligação falha
nesse caso.

Referência histórica para macOS: `llvm` 23.1.1_1 do Homebrew (arm64,
`libLLVM.23.1.dylib` partilhada, asserções desativadas) com AppleClang 21.

Outros pré-requisitos: CMake ≥ 3.28, um compilador C++23, Boost ≥ 1.90,
toml++ 3.4.0 e as ferramentas de qualidade. O OTP só é necessário para
auditorias opcionais e para regenerar fixtures.
