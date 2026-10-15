---
source: docs/compile.md
sourceCommit: 6ed3851c
sourceSha256: 3702a6fe367aab0776ef6b6345f19e09f34fcd9bd96ff7e67047a19b92c95805
translatedAt: 2026-10-15
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
`doc`/`moduledoc`, `behaviour`/`behavior` ([behaviours](semantic.md#behaviours)),
qualquer atributo informativo (`vsn`, `author`, `copyright`, `deprecated`,
`dialyzer`, `-name(Term)` definido pelo utilizador; mantidos para
[`module_info(attributes)`](semantic.md#predefined-functions)),
`-import(Module, [F/A, ...])` ([imports](semantic.md#imports)) e `-compile`
com opções que não alteram nada do que o Clause emite: `{no_auto_import, ...}`,
opções de avisos (`nowarn_*`, `warn_*`, `{nowarn_unused_function, [...]}`) e
sugestões de otimização, depuração e relatório (`inline`, `{inline, [F/A]}`,
`{inline_size, N}`, `{inline_effort, N}`, `inline_list_funcs`, `debug_info`,
`deterministic`, `report*`, `verbose`, ...). `{parse_transform, Module}`
executa o transform no Erlang/OTP do anfitrião antes da análise
([parse transforms](transforms.md)). `on_load`, `nifs`, `export_all`, outras
opções de `compile` e os módulos parametrizados são rejeitados; o diagnóstico
indica-os, por exemplo
`[behavior-changing attributes] notimpl [module="m" operation="-compile option export_all"]`.
Todos os módulos recebem `module_info/0,1`.
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

## Impressão do formato abstrato

`--print-abstr` (uma ação do frontend) imprime cada módulo analisado como as
formas do [formato abstrato](https://www.erlang.org/doc/apps/erts/absform.html)
do OTP que o `epp` entregaria a um parse transform, um termo `file:consult/1`
por linha, os mesmos termos que `erlc +to_abstr` escreve
([transforms](transforms.md)).

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
- `SourceNotes` acrescenta uma nota a uma expressão, impressa como um
  comentário final `% Text` depois da pontuação da linha onde a expressão
  termina, e linhas de comentário acima de uma forma. Só as expressões que
  ocupam linhas inteiras levam notas (expressões de corpo e o escrutinado de
  um `case`; uma por linha, a mais exterior), para que as expressões
  aninhadas longas continuem legíveis e o texto continue a ser Erlang. Os
  padrões e as guards não levam nenhuma.

## Opções

| Opção | Comportamento |
|---|---|
| `--emit obj\|llvm-ir\|llvm-bc` | Publica um artefacto por módulo |
| `--artifact-dir DIR` | Raiz dos artefactos (requer `--emit`) |
| `-o PATH` / `--output PATH` | Liga um executável ([ligação](executables.md#linking)); incompatível com `--emit` |
| `--linker PATH`, `--runtime-library PATH` | Driver do Clang e arquivo do runtime para `-o` |
| `--no-cache` | Não lê nem escreve as [caches de compilação](projects.md#build-caches) |
| `--cache-inference-in-dirs PATTERN` | Repetível: os módulos em diretórios correspondentes guardam os seus resultados de inferência na cache de compilação, além dos diretórios implícitos das aplicações OTP ([cache de inferência](projects.md#inference-cache)) |
| `--build-dir DIR` | Onde o Clause guarda ficheiros temporários (abaixo de `DIR/tmp`); substitui o `build_dir` de cada alvo de projeto selecionado; as entradas posicionais não têm nenhum sem esta opção ([diretório de compilação](projects.md#build-directory)) |
| `--entry MODULE[:FUNCTION]` | Função de entrada/1 do executável; validada em todos os modos de compilação e acrescenta o artefacto de arranque `clausev1_start` ([executáveis](executables.md#startup-object)); as inspeções de IR e de assembly deixam então de fora o que ela não consegue alcançar ([vivacidade dos exports](executables.md#export-liveness)) |
| `--target-triple TRIPLE` | Máquina alvo; `--target` é a seleção do alvo do projeto |
| `-O0` / `-O2` / `-Os` | Código genérico por omissão + LLVM O0 / especialização limitada + LLVM O2 / LLVM Os, sem especialização, uma secção por símbolo e eliminação pelo linker do código e dos dados não referenciados |
| `--no-type-specialization` | Desativa as variantes independentemente da ordem das opções |
| `--lto` | Liga os módulos como bitcode com otimização em tempo de ligação do LLD (alvos Windows MSVC e ELF; exige `-o` ou uma compilação de projeto com ligação) ([ligação](executables.md#linking)) |
| `--keep-exports` | Mantém todos os exports de um executável chamáveis em vez de deixar de fora os que ele não consegue alcançar; exige `-o`, uma compilação de projeto com ligação ou uma inspeção de IR/assembly ([vivacidade dos exports](executables.md#export-liveness)) |
| `-g` | Tabelas de linhas Erlang nos objetos e nos executáveis ligados (CodeView/PDB em alvos MSVC, DWARF nos restantes) ([depuração](debugging.md)) |
| `--print-ir` / `--print-optimized-ir` | IR verificada antes/depois das passagens do LLVM, com as linhas do código-fonte Erlang como comentários |
| `--print-asm` | O assembly do alvo de cada módulo depois do pipeline selecionado, com cada sequência de código máquina comentada com a instrução IR e a linha Erlang de onde veio ([listagens assembly](#assembly-listings)) |
| `--print-types` | Cada módulo como código-fonte Erlang anotado com os tipos inferidos ([análise semântica](semantic.md#--print-types)); para antes do LLVM |
| `--verbose` | Eventos das fases `[pp]`, `[parse]` e `[comp]` em stderr, depois o resumo do [índice de diretórios](projects.md#directory-index) `[index] ...` |
| `--print-stage-times` | `[time] <stage> <subject>: <ms> ms` em stderr: `plan` por manifesto de projeto (carregá-lo e expandir os padrões de cada alvo selecionado), `preprocess`, `parse` e `transform` (módulos com parse transforms) por ficheiro de código-fonte, `compile` por lote (número de módulos, alvo de projeto), `link` por executável; ` (cached)` segue uma fase que reutilizou um resultado da [cache](projects.md#build-caches). Antes do total `compile` de um lote vêm as suas fases com o mesmo sujeito: `index`, `calls`, `liveness` (executáveis e inspeções com uma entrada), `declared-types`, `inference-cache` (com `N of M covered modules reused`, [cache de inferência](projects.md#inference-cache)), `inference`, `inference-store`, `contracts`, `lower`, `optimize`, `emit` (as que correram). Depois de `inference`: linhas `inference pass N` com os passos de trabalho da passagem face ao orçamento de trabalho da inferência (`N of BUDGET work steps`) e a forma como terminou (`inputs changed`, `fun results changed`, `settled`, ou a passagem final após passagens não estabilizadas), indicando a função em execução quando o orçamento se esgotou; depois `inference slowest <module>:<function>/<arity>` para as 10 funções (os grupos recursivos indicam um membro `and N more`) que mais demoraram em todas as passagens, com os seus passos de trabalho e a parte desse trabalho no orçamento das passagens que as executaram (`877450 work steps, 43.9% of 10 passes of 200000 budget`), e `widened to term()` quando um orçamento alargou um dos seus factos; depois `inference rounds <module>:<function>/<arity> and N more` para os 10 grupos recursivos mais lentos: resoluções em todas as passagens, rondas executadas face ao limite por resolução (8 + 4 por membro), resoluções que atingiram o limite ou gastaram o seu oitavo do orçamento da passagem (cada membro alargado a `term()`), resoluções que desistiram de imediato porque uma passagem anterior o fez (`remembered`) ou terminaram com o orçamento da passagem gasto, percursos de membros (e os saltados porque nada do que leem mudou) e a parte que alterou um resumo (cresceu, entradas de tipo função alteradas, ou voltou a um dos 4 últimos resumos do membro), e os membros alterados por ronda da última resolução em dez grupos de rondas. Uma compilação em cache não imprime fases |
| `--print-env` | Imprime o ambiente de compilação resolvido como TOML no stdout e termina sem processar códigos-fonte ([relatório do ambiente](#environment-report)) |
| `--print-inputs` | Pré-processa e analisa as entradas, acrescenta os módulos que elas nomeiam tal como a compilação faz, depois lista todos os códigos-fonte do lote no stdout e para antes da compilação ([projetos](projects.md#cli-and-target-selection)) |

- Sem `--emit`, a compilação verifica os objetos em memória e não escreve
  nada fora do [diretório de compilação](projects.md#build-directory).
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

## Listagens assembly

`--print-asm` executa o pipeline selecionado (como faz `--print-optimized-ir`)
e depois imprime o assembly de cada módulo de entrada a partir da mesma
máquina alvo que escreve os objetos, um módulo de cada vez. Os comentários
usam o marcador do alvo (`#` em x86, `//` em AArch64 ELF, `;` na Apple, `@` em
ARM):

```
# erlang answer.erl:3: value() -> 42.
#     ir store i64 687, ptr %frame.slots, align 8
	movq	$687, 32(%r15,%r12,8)
#     ir br i1 %4, label %return.inline, label %return.service
```

- Um comentário `ir` abre cada sequência de instruções selecionadas a partir
  de uma instrução IR, escrita tal como `--print-optimized-ir` a imprime (a
  mesma numeração de valores, `switch` dobrado numa só linha, sem `!dbg`). O
  código movido ou fundido entre instruções repete ou salta comentários
  conforme a tabela de linhas indica.
- Um comentário `erlang` indica o ficheiro físico, a linha e o texto, como os
  comentários de código-fonte da IR, quando a linha muda dentro de uma função.
  As instruções que o rebaixamento não localizou em lado nenhum (wrappers,
  preparação do frame) não têm nenhum.
- A listagem compila uma cópia cuja tabela de linhas numera as instruções IR
  em vez das linhas Erlang; as diretivas dessa tabela de linhas, as secções de
  depuração e as etiquetas são deixadas de fora. Reassemblada, dá o objeto
  que `--emit obj` escreve.
- Com outras inspeções, cada módulo imprime `before`, `after` e `assembly` à
  vez, cada um depois de um cabeçalho (`stage=assembly`). Tal como a inspeção
  da IR, rejeita `--emit`, `--artifact-dir`, `--output` e `--print-types`. As
  listagens x86 usam a sintaxe AT&T.
- Com `--entry`, as inspeções de IR e de assembly deixam de fora as funções
  que a entrada não consegue alcançar, como faz o executável
  (`--keep-exports` mantém-nas).

## Relatório do ambiente

`--print-env` valida toda a linha de comandos (conflitos, entradas
posicionais legíveis, planeamento do projeto) e depois imprime o que esse
comando usaria como um único documento TOML no stdout, termina com 0 e não lê
nenhum código-fonte. Os caminhos são absolutos, com `/`.

```toml
# clau compile environment (--print-env)
command = ["clau", "--print-env", "-O2", "-o", "app", "main.erl"]  # as given
actions = ["link"]          # see below
working_directory = "/work"

[[targets]]                 # one per selected project target; one for positional inputs
name = "app"                # project targets only
project = "/work/project.toml"
sources = ["/work/src/main.erl"]           # globs and search paths resolved
library_directory = "/clau/library"     # application dirs, searched before source_search_paths
build_dir = "/work/build"   # "" for positional inputs without --build-dir
entry = "main:main"         # or "auto" when linking without --entry
output = "/work/app"        # linking only: final name (".exe" on Windows)
linker = "/usr/bin/clang++" # linking only; "" when none is found
runtime_library = "/clau/lib/libclause_runtime.a"

[targets.options]           # manifest option names
source_search_paths = []    # directories, patterns expanded
include_dirs = []           # search order, patterns expanded
defines = []
applications = { "stdlib" = "/otp/lib/stdlib" }  # last mapping wins
enabled_features = ["maybe_expr"]                # OTP defaults plus changes

[targets.backend]
target_triple = "x86_64-unknown-linux-gnu"  # host when not given
optimization = "O2"
type_specialization = true  # O2 without --no-type-specialization
debug_info = false
lto = false
keep_exports = false        # --keep-exports or the project option
emit = "none"               # or obj, llvm-ir, llvm-bc
artifact_dir = "/work/build/aot"
```

(Os arrays imprimem um item por linha.) `actions` lista as ações do frontend
(`print-pp`, `parse-check`, `print-ast`, `print-source`, `print-abstr`, caso
contrário `preprocess-check`; `print-inputs` sozinha substitui-as), caso
contrário as inspeções (`print-types`, `print-ir`, `print-optimized-ir`,
`print-asm`), caso contrário `emit`, `link` (`-o`) ou `compile`. Numa
compilação de projeto, os alvos com um `output` também ligam. Os módulos
encontrados mais tarde pelo nome (através de `source_search_paths` ou da
biblioteca) não são listados: encontrá-los exige a análise sintática (é isso
que `--print-inputs` faz). `--print-env` não pode ser combinado com
`--new-project`.

## Cache de compilação

Um lote com um diretório de compilação (cada alvo de projeto, as entradas
posicionais com `--build-dir`) guarda o resultado da sua compilação na
[cache de compilação](projects.md#build-caches): os diagnósticos por ordem, a
falha e, quando um executável ou `--emit` precisa deles, os objetos (ou o
bitcode) de cada módulo e do módulo de arranque. Uma compilação posterior do
mesmo lote com as mesmas opções reproduz os diagnósticos e liga ou publica os
objetos guardados exatamente como se fossem novos; `--print-stage-times`
mostra então `[time] compile ... (cached)`. `--print-ir`,
`--print-optimized-ir`, `--print-asm` e `--print-types` recalculam sempre, e
`--no-cache` não lê nem escreve.

- **Unidade de reutilização: o lote inteiro.** A análise, a inferência de
  tipos, os orçamentos de especialização (por alvo), a vivacidade dos exports
  e o módulo de arranque abrangem todos os módulos, pelo que o objeto de um
  módulo depende de factos de outros (tipos das funções chamadas, records,
  behaviours, quais as funções que ficam vivas). Esses factos não têm hoje uma
  forma canónica para calcular um hash por módulo, pelo que uma chave por
  módulo não poderia ser provada correta; qualquer alteração a qualquer
  módulo do lote recompila o lote. Só os resultados da inferência são
  guardados por módulo para os diretórios de biblioteca abrangidos
  ([cache de inferência](projects.md#inference-cache)), pelo que uma
  recompilação dessas os reutiliza.
- **Chave.** A versão do `clau` e a identidade do executável; o caminho e a
  impressão digital de cada entrada (cada ficheiro que o frontend leu para
  ela, caminho e bytes, por ordem: o código-fonte, os seus includes e
  ficheiros `include_lib`, e a resposta dos seus parse transforms; as opções
  de pré-processamento; o texto gerado dos placeholders), as formas
  predefinidas e o estado de escript; a triple resolvida, o nível de
  otimização, `--emit`, `--no-type-specialization`, `-g`, `--lto`,
  `--keep-exports`, se é ligado um executável, a seleção da entrada e o alvo
  de projeto. As entradas de um alvo com outras opções são guardadas lado a
  lado.
- **Armazenamento.** Cada saída é uma parte própria, pelo que um objeto maior
  do que o limite inline do armazenamento se torna um ficheiro blob
  endereçado pelo conteúdo, partilhado quando dois conjuntos de opções
  produzem objetos idênticos.

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

## PCRE2

Os builtins `re` do runtime usam o PCRE2 **10.47**, a release que o OTP 29
inclui (`erts/emulator/pcre/vendor.info`), pelo que a sintaxe dos padrões, as
opções e as capturas se comportam como no OTP: unidades de código de 8 bits,
suporte Unicode, sem JIT, `pcre2_match` de origem (o patch de cedência do OTP
não é transposto). O PCRE2 é licenciado sob BSD-3-Clause com a exceção PCRE2
para binários compilados; nenhum ficheiro do PCRE2 é submetido no
repositório. O CMake (`cmake/Pcre2Dependencies.cmake`) resolve-o por esta
ordem:

1. `-DCLAUSE_PCRE2_ROOT=<source directory>` tem precedência (sem
   transferência); a versão no seu `configure.ac` tem de ser 10.47.
2. Um PCRE2 instalado de versão 10.47 ou superior (`CLAUSE_PCRE2_SYSTEM=ON`, o
   valor por omissão): o pacote CMake
   (`find_package(pcre2 CONFIG COMPONENTS 8BIT)`, com preferência pelas
   bibliotecas estáticas), caso contrário o pkg-config `libpcre2-8`, com
   preferência por um `libpcre2-8.a` estático em vez da biblioteca
   partilhada.
3. A release fixada, descarregada para `thirdparty/pcre2-10.47` e verificada
   (`pcre2-10.47.tar.bz2`, SHA-256
   `47fe8c99461250d42f89e6e8fdaeba9da057855d06eb7fc08d9ca03fd08d7bc7`);
   `-DCLAUSE_DOWNLOAD_PCRE2=OFF` desativa a transferência.

Um diretório de código-fonte (1 ou 3) compila a biblioteca de objetos
`clause_pcre2` a partir dos ficheiros `.c` listados, com os ficheiros
distribuídos `config.h.generic`, `pcre2.h.generic` e
`pcre2_chartables.c.dist` copiados para a árvore de compilação (sem passo de
geração, sem as flags de aviso do projeto, fora do clang-tidy e do Lizard), e
os seus objetos são acrescentados ao próprio `clause_runtime`: o arquivo é
autossuficiente e cada consumidor (ligações do `clau`, programas de teste
aninhados, `runtime_link`, `examples/compile`) obtém o PCRE2 com ele. Uma
biblioteca instalada torna-se, em vez disso, uma entrada adicional do ligador
registada em `clause_runtime.link` ao lado do arquivo (uma entrada por linha),
que o `clau` acrescenta a cada ligação; uma biblioteca partilhada torna os
executáveis dependentes dela em tempo de execução. Por plataforma: o Windows
usa a transferência (na prática, não se procura nenhum PCRE2 do sistema); o
Linux e o macOS usam um PCRE2 10.47 ou mais recente instalado, quando
existe, caso contrário a transferência. Por agora é sempre ligado ao runtime
(decidido em 2026-10-14); ligá-lo apenas aos programas que chamam `re`, ou
numa biblioteca carregada dinamicamente, fica adiado.

## zlib

O módulo zlib do runtime e os termos externos comprimidos usam o zlib
**1.3.2**, a release que o OTP 29 inclui (`erts/emulator/zlib/vendor.info`),
pelo que os bytes comprimidos são iguais aos do OTP. O CMake compila os
fontes da sua biblioteca (`cmake/ZlibDependencies.cmake`,
`clause_add_runtime_zlib`) na biblioteca de objetos `clause_runtime_zlib`,
cujos objetos se juntam a `clause_runtime` como os do PCRE2;
`-DCLAUSE_RUNTIME_ZLIB_ROOT=<source directory>` tem precedência, caso
contrário a release é descarregada para `thirdparty/zlib-1.3.2` e verificada
(SHA-256 `bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16`)
em todos os anfitriões. A licença do zlib é a licença zlib. O LLVM do
compilador mantém o seu próprio zlib; os dois nunca se encontram num mesmo
binário.

Outros pré-requisitos: CMake ≥ 3.28, um compilador C++23, Boost ≥ 1.90,
toml++ 3.4.0 e as ferramentas de qualidade. O OTP só é necessário para
auditorias opcionais e para regenerar fixtures.
