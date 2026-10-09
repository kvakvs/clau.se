---
source: docs/executables.md
sourceCommit: 06042fa
sourceSha256: aaec2d5d2a83da50b160d09c8b37ecf1648199279e5aed4b35ef794633bf589a
translatedAt: 2026-10-09
---
# Executáveis

Contrato para os programas construídos por `clau -o` ou por uma compilação de
projeto. As entradas posicionais, ou exatamente um alvo de projeto
selecionado, são ligadas no caminho de `-o`; uma compilação de projeto liga
cada alvo executável selecionado ao `output` do seu manifesto
([ligação](#linking), [projetos](projects.md#executables)).

## Seleção da entrada

A entrada é uma função exportada de aridade 1 que recebe a lista de
argumentos.

| Origem | Grafia | Âmbito |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION]` | Lote posicional, ou o único alvo de projeto selecionado |
| Manifesto | `entry = "MODULE[:FUNCTION]"` numa tabela `[[targets]]` | Esse alvo |
| Por omissão | O único escript, caso contrário o único módulo que exporta `main/1` | Só quando é pedido um executável (`-o`, ou um alvo de projeto com `output`) |

- `FUNCTION` assume por omissão `main`. Os nomes são texto de átomo sem
  aspas: 1–255 escalares Unicode, UTF-8 válido, sem carateres de controlo e
  sem `:`. Outras grafias são erros de utilização (CLI, código de saída 2) ou
  erros de manifesto (código de saída 1).
- `entry` é uma chave opcional do esquema 1; os manifestos mais antigos
  continuam válidos. O manifesto inteiro é descodificado, pelo que um `entry`
  mal formado falha mesmo em alvos não selecionados.
- `--entry` na CLI sobrepõe-se à chave do manifesto e exige exatamente um alvo
  selecionado. Entra em conflito com as ações de verificação/impressão e com
  `--new-project`; essas ações ignoram o `entry` do manifesto (tal como
  ignoram `output`).
- Uma entrada explícita é validada em todos os modos de compilação (por
  omissão, `--emit`, inspeção de IR/tipos), juntamente com os diagnósticos
  semânticos comuns.

| Falha | Diagnóstico (código de saída 1) |
| --- | --- |
| Módulo fora do lote | `<origin>: entry module M is not among the compiled modules` (origem: `--entry` ou o manifesto `file:line:col [target t] (entry)`) |
| Sem `F/1` | `<file>:<line>:<col>: entry function M:F/1 is not defined` na declaração do módulo |
| Só outras aridades | `... is not defined; found F/N, but the entry receives one argument (the argument list)` nessa definição |
| `F/1` não exportada | `<file>:<line>:<col>: entry function M:F/1 is not exported` na definição |
| Sem seleção, sem export de `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION] (an exported FUNCTION/1; FUNCTION defaults to main)` |
| Sem seleção, várias | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (a mesma sugestão) |

Para alvos de projeto, a sugestão indica também a chave do manifesto: `... --entry MODULE[:FUNCTION] or with
entry = "MODULE[:FUNCTION]" in this target's [[targets]] table of the project manifest ...`, por exemplo:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1; plain "app" calls app:main/1
```

## Argumentos

`Entry(Argv)` recebe uma lista própria de strings (listas de pontos de código
Unicode), excluindo o nome do programa e as
[opções do runtime](#runtime-options) iniciais, de resto inalterados e pela
mesma ordem, como no `escript`.

- POSIX: os bytes de cada argumento são descodificados como UTF-8; um byte que
  não inicia uma sequência válida torna-se o ponto de código desse byte
  (alternativa Latin-1).
- Windows: o vetor de argumentos largo (UTF-16) do CRT, dividido pelas mesmas
  regras que `argv`; um surrogate isolado torna-se U+FFFD.
- O runtime não faz qualquer outra análise de opções, expansão de padrões de
  ficheiros (globbing) ou expansão de variáveis de ambiente.

## Opções do runtime

O runtime lê as suas opções da variável de ambiente `CLAUSE_FLAGS` (palavras
separadas por espaços e tabulações, sem aspas) e depois dos argumentos
iniciais da linha de comandos, pelo que a linha de comandos prevalece. Ambas
são analisadas da mesma forma; um valor vai no argumento seguinte ou depois de
`=`.

| Opção | Efeito |
| --- | --- |
| `--max-atoms N` | Tamanho da tabela de átomos, de 1 a 2^26 (67 108 864); por omissão 2^20 (1 048 576), como o `+t` do OTP |
| `--max-heap BYTES` | Limite do bloco de heap, dos fragmentos e dos binaries off-heap de cada processo, pelo menos o heap mínimo (233 palavras); por omissão sem limite |
| `--max-stack BYTES` | Limite da pilha de frames de cada processo; por omissão sem limite |
| `--max-memory BYTES` | Limite da memória de todos os processos em conjunto (heaps, binaries off-heap, pilhas); por omissão sem limite |
| `--schedulers N` | Workers do escalonador que executam processos, de 1 a 1024; por omissão um por processador lógico, como o `+S` do OTP ([workers](processes.md#workers)) |
| `--args-file FILE` | Ficheiro de opções como o `vm.args` do OTP: reservado, indica `runtime option --args-file is not implemented` |
| `--` | Termina as opções do runtime; os argumentos seguintes vão todos para `Entry` |

Na linha de comandos, a análise para no primeiro argumento que não seja uma
opção do runtime, pelo que `prog data --max-atoms 9` passa os três argumentos
ao programa. Em `CLAUSE_FLAGS`, cada palavra tem de ser uma opção do runtime.
Um valor inválido, uma palavra na variável que não seja uma opção, ou
`--args-file` param o programa antes de qualquer módulo ser registado:
`clau: runtime failure: <reason>`, código de saída 70. O número de processos
não é limitado e a memória, por omissão, não tem limite. Os valores em bytes
são decimais sem sufixos e são arredondados por defeito para palavras inteiras;
um programa que atinja um limite falha com `resource_limit`, código de saída 70
([limite de memória do runtime](runtime-heap.md#runtime-memory-limit)).

## Código de saída

| Resultado | Código |
| --- | --- |
| A entrada retorna (qualquer valor) | 0 |
| `erlang:halt()` | 0 |
| `erlang:halt(N)`, inteiro não negativo | `N` (os sistemas POSIX mantêm os 8 bits menos significativos) |
| `erlang:halt(Slogan)` com uma string | Slogan no stderr, depois 1 (sem crash dump) |
| `erlang:halt(abort)` | Abort nativo (sem esvaziar buffers) |
| Qualquer exceção que escape da entrada, incluindo `throw` e `exit(normal)` | Relatório no stderr, 1 |
| Processo de entrada terminado por um sinal de saída ([processos](processes.md#exit-signals)) | Indicado como um `exit` não capturado, 1; razão `normal`: 0 |
| Falha no arranque do runtime ou de infraestrutura (incompatibilidade de ABI, registo, memória antes da entrada) | Mensagem no stderr, 70 |
| Memória do sistema anfitrião esgotada (crescimento do heap, de um binary off-heap ou da pilha recusado; sem limite de memória por omissão, [esgotamento de memória](runtime-heap.md#failure-behavior)) | `clau: runtime failure: entry call failed: out_of_memory`, 70 |

Argumentos inválidos de `halt/1` lançam `badarg` no chamador. Quando a entrada
termina, o programa sai: os outros processos são parados sem continuarem a
correr, como acontece com o `halt/1` do OTP depois de o `escript` retornar. Um
halt em qualquer processo termina o programa com o seu código, e uma falha do
runtime em qualquer processo termina-o com 70; uma exceção num processo
lançado com spawn termina apenas esse processo ([processos](processes.md)).

`halt/0,1`, `error/1,2,3`, `exit/1` e `throw/1` podem ser chamadas com ou sem
o prefixo `erlang:`; uma definição local ou `-compile({no_auto_import, ...})`
mantém o nome não qualificado local, como no OTP. `halt/2` não está
disponível. `halt(N)` mantém os 31 bits menos significativos de qualquer
inteiro não negativo, como faz o OTP. Um slogan é uma lista própria de no
máximo 1023 pontos de código Unicode. Um halt desenrola a entrada através do
canal de erros verificado, tal como um erro, pelo que só para o programa
depois da limpeza gerada.

## Fluxos de saída

- stdout: saída de `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Com buffer; esvaziado em todos os caminhos de saída
  exceto `abort`.
- stderr: o relatório de exceção não capturada, a saída de `standard_error`,
  as falhas do runtime e os relatórios de erro de outros processos que
  falham ([processos](processes.md#exits)).
- O relatório é uma linha `uncaught exception <class>: <reason in ~w form>`,
  seguida mais tarde por frames da pilha (step 15). O seu texto exato não é
  uma interface estável; os testes comparam-no por padrão.

## Objeto de arranque

Compilar com uma entrada explícita (`--entry` ou `entry` do manifesto)
acrescenta um módulo de arranque depois dos módulos do lote. Com `--emit`, é
publicado como `clausev1_start.{obj,o,ll,bc}` ao lado dos artefactos dos
módulos (o nome não pode colidir com um artefacto de módulo). Contém um
`abi::v1::StartupDescriptor` constante ([startup.hpp](../abi/include/clause/abi/startup.hpp)):
revisão da ABI, largura dos termos, todos os descritores de módulos pela
ordem do código-fonte, as grafias do módulo/função de entrada e um indicador
de escript. O seu `int main(int, char **)` chama o `CLAUSE_main_v1` do
runtime, que:

1. Verifica a revisão da ABI e a largura do descritor de arranque e de todos
   os descritores de módulos antes de qualquer registo; uma incompatibilidade
   sai com 70.
2. Inicia o runtime e regista todos os módulos; qualquer falha para antes da
   entrada e descarta o runtime (código de saída 70), pelo que nenhum código
   Erlang corre sobre um lote parcial.
3. Cria o processo de entrada, constrói o argv e coloca em fila a chamada de
   `M:F/1` como processo principal, executando-o depois, juntamente com todos
   os processos que lança, no executor cooperativo
   ([processos](processes.md)) até terminar.
4. Converte o resultado no código de saída acima, imprimindo os relatórios
   depois de esvaziar o stdout, e em seguida liberta todos os processos e
   encerra o runtime em todos os caminhos (exceto `halt(abort)`).

O `clau -o` liga estes objetos por si próprio ([ligação](#linking)). Ligação
manual (a [receita do harness nativo](compile.md#run-the-compiled-module-example)
sem um ficheiro-fonte de harness):

```powershell
& $tool --emit obj --entry app --artifact-dir build/app app.erl helper.erl
clang-cl /MT build/app/*.obj build/debug/lib/clause_runtime.lib /Fe:app.exe
```

Qualquer ligação dos objetos com `Clause::generated_program` compatível com o
Clang funciona da mesma forma (ver `tests/compiler/linking/startup.cmake`).

## Ligação

`clau [-O0|-O2|-Os] -o PATH a.erl b.erl ...` (ou `--project FILE [--target T] -o PATH`
para um alvo selecionado) compila o lote em memória, acrescenta o objeto de
arranque para a [entrada](#entry-selection) e liga um executável:

```sh
clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo          # build/demo.exe on Windows
```

`-Os` coloca, além disso, cada função e objeto de dados gerados e do runtime
na sua própria secção e liga com `--gc-sections` (ELF), `-dead_strip` (Mach-O)
ou `/OPT:REF /OPT:ICF` (MSVC), pelo que o código que nenhum caminho de entrada
alcança é removido.

- `PATH` é relativo à invocação. Para alvos Windows, `.exe` é acrescentado
  quando o nome do ficheiro não tem extensão. O seu diretório tem de existir.
- Ligador (linker): `--linker PATH` (um caminho ou nome de programa), caso
  contrário `clang++` ou `clang` a partir do `PATH`, depois (Windows)
  `%ProgramFiles%/LLVM/bin`. É executado como
  `<clang> --driver-mode=g++ --target=<triple> -o <staged> <objects> <runtime>`,
  pelo que o Clang escolhe o ligador da plataforma e as bibliotecas de runtime
  de C/C++ (no Windows localiza ele próprio o MSVC e o SDK; não é necessária
  uma shell de programador).
- Runtime: `--runtime-library PATH`, caso contrário o arquivo
  `clause_runtime` da compilação que produziu o `clau` (caminho registado em
  relação ao executável, p. ex. `bin/../lib/clause_runtime.lib`). Cada objeto
  nativo no arquivo tem de corresponder à arquitetura e ao formato de objeto
  do alvo; `--target-triple` para outro alvo precisa, portanto, de um runtime
  compilado para ele.
- Os objetos e o executável são preparados num diretório privado
  `.clause-link-*` ao lado da saída, que é removido no fim. A saída só é
  substituída depois de uma ligação bem-sucedida, pelo que qualquer falha
  mantém inalterado um ficheiro existente. A saída não pode ser um diretório
  nem um alias de uma entrada.
- Os avisos do ligador são reencaminhados para o stderr; `--linker` e
  `--runtime-library` exigem `--output` ou uma compilação de projeto com
  ligação.
- As compilações de projeto sem `-o` ligam cada alvo selecionado que tenha
  `output` ou `entry` à saída do seu manifesto, criando os diretórios em
  falta, e só substituem as saídas depois de todos os alvos selecionados terem
  sido ligados ([projetos](projects.md#executables)).

| Falha (código de saída 1) | Diagnóstico |
| --- | --- |
| Sem Clang | `cannot find clang++ or clang on PATH; install LLVM/Clang or pass --linker` / `linker not found: X` |
| Sem runtime | `runtime library not found: P; build the clause_runtime target or pass --runtime-library` |
| Não é um arquivo | `runtime library is not a static library: P: ...` |
| Alvo errado | `runtime library P contains x86_64 coff objects, but the executable targets T; ...` |
| Erro de ligação | `linking O failed: <clang> exited with status N:` seguido da saída do ligador (primeiros 64 KiB) |
| Destino inválido | `output directory does not exist: D`, `artifact destination is not a regular file: O`, `artifact destination aliases an input: O` |

## Escripts

Um ficheiro-fonte cuja primeira linha começa por `#!` é compilado como
escript, em qualquer modo e com qualquer nome de ficheiro (entradas
posicionais ou ficheiros `.erl` de projeto). As regras seguem o `escript` do
OTP 29 para scripts em código-fonte:

- A linha `#!` é ignorada. Um comentário opcional na linha 2 e uma linha de
  emulador `%%!` (linha 2, ou linha 3 depois do comentário) são comentários;
  os argumentos de `%%!` não se podem aplicar a código compilado e produzem um
  aviso.
- Se a primeira forma não for `-module(...)`, o módulo é
  `<file name with '.' replaced by '_'>__escript` (incluindo `?MODULE`). O OTP
  acrescenta um sufixo de timestamp/único; o Clause mantém o nome
  determinístico. A declaração sintetizada ocupa a linha 1, pelo que os
  números das linhas seguintes não se alteram.
- `main/1` é obrigatória (`escript does not define main/1`) e exportada
  implicitamente; as outras funções seguem as regras normais de export.
- `-mode(compile | interpret | debug | native)` é aceite e ignorado; outros
  valores são erros. Fora dos escripts, `-mode` continua sem suporte.
- Entrada: sem `--entry`, o único escript do lote é a entrada (prevalece sobre
  os módulos que exportam `main/1`); vários escripts são ambíguos.
- Código de saída como no `escript` do OTP: uma exceção que escape da entrada
  do escript sai com 127 e `escript: exception <class>: <reason>` no stderr;
  as outras linhas da tabela de códigos de saída aplicam-se sem alterações.
- Os ficheiros sem `#!` são módulos comuns. (O `escript file.erl` do OTP
  saltaria a sua primeira linha; o Clause não o faz.) Os escripts beam
  pré-compilados e em arquivo não são suportados.

## Comparação com o OTP

Os goldens das [fixtures de programas](../tests/fixtures/programs/README.md)
executam a entrada no OTP com as mesmas regras
([oráculo](../tests/compiler/programs/oracle.escript)); o mesmo oráculo gera
os [casos golden de executáveis](../tests/fixtures/executables/README.md) que
o executor de ponta a ponta liga e executa sob todas as políticas. Diferenças
em relação ao `escript` para módulos comuns: as exceções não capturadas saem
com 1 em vez de 127, e `main/1` tem de ser exportada. Os ficheiros-fonte de
escripts mantêm as regras do OTP (ver acima).
