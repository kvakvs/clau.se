---
source: docs/usage.md
sourceCommit: a8c3f8f6
sourceSha256: 06562916f7abbce822d9a5ca87d42cc0b3306de611e06ebce33ca5b2bd10d101
translatedAt: 2026-10-17
---
# Utilizar o compilador

Construa um programa a partir do código-fonte; a entrada é o único módulo que
exporta `main/1`, que recebe os argumentos da linha de comandos como strings:

```sh
clau -O2 -o demo examples/compile/answer.erl examples/compile/client.erl
./demo
clau -o app --entry app:start src/*.erl     # app:start/1, else app:start/0
```

Em Windows, `-o` acrescenta `.exe` quando o caminho não tem extensão. Sem `-o`,
as entradas posicionais são compiladas em memória e apenas comunicam
diagnósticos. Ver [executáveis](executables.md) para a seleção da entrada, os
argumentos, o código de saída e a ligação, e
[o exemplo de módulo compilado](../examples/compile/) para um anfitrião C++ que
liga ele próprio os objetos emitidos.

Os projetos descrevem alvos em TOML; cada alvo com uma chave `output` ou
`entry` é ligado à sua saída (por omissão `build/<target>`), e as saídas só são
substituídas depois de todos os alvos selecionados terem sido concluídos com
sucesso:

```sh
clau --new-project myapp                        # writes an annotated myapp.toml
clau --project myapp.toml                       # build every target
clau --project examples/project/project.toml --target app --parse-check
```

Ver [projetos](projects.md) para o manifesto, a descoberta de código-fonte, o
código-fonte ignorado, os diretórios de compilação e as caches.

Opções comuns (`clau --help` lista todas):

| Opção | Finalidade |
| --- | --- |
| `-o, --output PATH`, `--entry M[:F[/A]]` | Ligar um executável e escolher a sua entrada |
| `--project PATH`, `--target NAME` | Construir um projeto TOML, ou os alvos selecionados |
| `-O0`, `-O2`, `-Os`, `--no-type-specialization` | Otimização (O0 por omissão; O2 acrescenta especialização por tipos) |
| `-g`, `--lto`, `--keep-exports` | Tabelas de linhas de depuração, otimização no momento da ligação, manter exportações inalcançáveis |
| `-I DIR`, `-D NAME[=TERM]`, `--app-dir APP=DIR` | Caminhos de include, macros, raízes de `include_lib` |
| `--enable-feature F`, `--disable-feature F` | Features da linguagem do OTP |
| `--parse-transform M`, `--transform-path DIR`, `--erl PATH\|none` | Parse transforms e o OTP do anfitrião que os executa |
| `--emit obj\|llvm-ir\|llvm-bc`, `--artifact-dir DIR` | Escrever um artefacto por módulo (raiz por omissão `build/aot`) |
| `--target-triple TRIPLE`, `--linker PATH`, `--runtime-library PATH` | Alvo, driver de ligação e arquivo do runtime |
| `--build-dir DIR`, `--no-cache`, `--cache-inference-in-dirs PAT` | Ficheiros temporários e caches de compilação |
| `--verbose`, `--print-stage-times` | Rastrear as fases; medir o tempo de cada etapa em stderr |

As ações de inspeção imprimem para stdout e não compilam executáveis:

| Opção | Imprime |
| --- | --- |
| `--preprocess-check`, `--parse-check` | Nada; apenas diagnósticos |
| `--print-pp`, `--print-ast`, `--print-source`, `--print-abstr` | Código-fonte pré-processado, árvore sintática, código-fonte, formato abstrato do OTP |
| `--print-inputs` | Todo o código-fonte do lote, incluindo os módulos de biblioteca acrescentados por referência |
| `--print-env` | O ambiente de compilação resolvido, em TOML |
| `--print-types` | Código-fonte anotado com os tipos inferidos |
| `--print-ir`, `--print-optimized-ir`, `--print-asm` | IR antes/depois da otimização do LLVM, assembly com comentários de IR e de Erlang |

O `clau` termina com 0 em caso de sucesso (incluindo avisos), 1 para erros de
código-fonte ou de projeto e 2 para erros de utilização. Pormenores:
[compilação](compile.md), [pré-processamento](preprocessor.md),
[parser](parser.md).

Os parse transforms (`-compile({parse_transform, M})`) correm num Erlang/OTP 29
instalado no anfitrião (`erl` no `PATH`, ou `--erl`), tal como faria o `erlc`;
só a compilação precisa do OTP, nunca o executável. Os transforms que não sejam
do próprio OTP têm de ser compilados primeiro para `.beam`
([parse transforms](transforms.md)).

### Opções do runtime

Os programas leem as opções do runtime da variável de ambiente `CLAUSE_FLAGS` e
dos argumentos iniciais da linha de comandos, até ao primeiro argumento de
outro tipo ou até `--`:

```sh
./demo --schedulers 4 --max-heap 100000000 -- arg1 arg2
```

`--schedulers N`, `--max-atoms N`, `--max-heap BYTES`, `--max-stack BYTES`,
`--max-memory BYTES` e `--profile FILE` são descritas em
[opções do runtime](executables.md#runtime-options).
