---
source: docs/projects.md
sourceCommit: 06042fa
sourceSha256: fede4b3ed0440e1032fd9d7e0bad11ee107bc68c2c08dfa3b1add7b9fbc880c1
translatedAt: 2026-10-09
---
# Projetos TOML

Um manifesto de projeto seleciona grupos ordenados de códigos-fonte Erlang e
configura cada alvo de forma independente. Todas as ações da CLI aceitam
projetos. Ver o [exemplo funcional](../examples/project/project.toml).

## Manifesto (schema 1)

```toml
schema_version = 1

[[targets]]
name = "app"
sources = ["main.erl", "src/workers/*.erl", "shared/**/*.erl"]
source_dirs = ["src/support"]
output = "build/app"
entry = "main:main"

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]

[targets.options.applications]
my_dependency = "vendor/my_dependency"
```

- `schema_version = 1` e um array `targets` não vazio são obrigatórios. Chaves
  desconhecidas, tipos errados, nomes de alvos duplicados e strings vazias são
  rejeitados; não há coerção de tipos. Todo o manifesto é validado, incluindo
  os alvos não selecionados.
- Nomes de alvos: ASCII sensível a maiúsculas `[A-Za-z0-9_][A-Za-z0-9_.-]*`,
  únicos. Um nome é um alvo de compilação, não uma triple do LLVM.
- `sources` (ficheiros e padrões curinga) e `source_dirs` (descoberta
  recursiva de `.erl`) são opcionais, mas um alvo precisa de pelo menos uma
  entrada. Os ficheiros explícitos têm de terminar em `.erl`; os cabeçalhos são
  dependências, não entradas.
- Os campos de `options` são opções de frontend tipadas e opcionais. `defines`
  usa `NAME` (= `true`) ou `NAME=ERLANG_LITERAL_TERM`; duplicados são erros.
  Uma feature não pode aparecer em ambas as listas de features.
- `entry` (opcional) seleciona a entrada do executável `MODULE[:FUNCTION]`; ver
  [executáveis](executables.md#entry-selection). O `--entry` da CLI
  substitui-a para um único alvo selecionado.
- `output` é o destino do executável, por omissão
  `<manifest-dir>/build/<target>` (`.exe` no Windows). Um alvo com `output` ou
  `entry` é um alvo executável ([executáveis](#executables)); `--emit` e os
  modos de verificação/impressão ignoram as saídas de ambas as chaves.
- Ainda não suportado: valores por omissão na raiz, herança, dependências entre
  alvos, importações, perfis, exclusões, pacotes, watch, cache, compilações
  paralelas. Os campos só são acrescentados juntamente com o seu
  comportamento.

## CLI e seleção de alvos

```text
clau [options] <source.erl>...
clau [options] --project <path> [--target <name>]...
clau --new-project <filename>
```

- Os códigos-fonte posicionais e `--project` são mutuamente exclusivos. Um
  `--project`, qualquer número de `--target`, por qualquer ordem.
- Sem `--target`: todos os alvos pela ordem do manifesto. Os seletores mantêm
  a sua ordem e a primeira ocorrência. Nomes desconhecidos falham antes de
  qualquer trabalho do frontend e listam os nomes disponíveis.
- `--project test1` carrega `test1.toml` quando `test1` não existe.
- As opções de frontend da CLI aplicam-se a todos os alvos selecionados. Os
  caminhos relativos da CLI mantêm o significado relativo ao diretório de
  invocação; os caminhos do manifesto são relativos ao manifesto.
- Sem `--emit` nem uma ação de verificação/impressão, os alvos executáveis são
  ligados às suas saídas ([executáveis](#executables)); os restantes alvos
  compilam em memória.
- `-o/--output` liga o alvo a esse caminho em vez do seu `output`
  ([ligação](executables.md#linking)); exige exatamente um alvo selecionado.
- `--verbose` regista em stderr os ficheiros/includes `[pp]` e os códigos-fonte
  `[parse]`.
- Código de saída 2: erros de utilização e alvos desconhecidos. Código de
  saída 1: falhas do manifesto, da descoberta, do frontend ou da criação.
  Código de saída 0: sucesso (avisos permitidos).

Cada alvo selecionado é um lote de compilação separado, com as suas próprias
sessões de pré-processamento. O planeamento (descodificar, selecionar,
descobrir, verificar colisões de saídas) termina antes de qualquer
código-fonte ser processado; a execução processa então os alvos/ficheiros por
ordem e regista as falhas. A saída útil vai para stdout pela ordem
alvo/ficheiro, sem cabeçalhos; o contexto e os diagnósticos vão para stderr.

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target tests --target app
```

## Executáveis

`clau --project FILE [--target T]...` (sem `--emit`, sem ação de
verificação/impressão) liga cada alvo selecionado que tenha uma chave `output`
ou `entry`, ou ao qual se dirijam `-o`/`--entry` da CLI, num executável por
alvo:

- Destino: `-o` da CLI (relativo à invocação), senão `output` (relativo ao
  manifesto), senão `<manifest-dir>/build/<target>`. Os alvos Windows
  acrescentam `.exe` a um nome sem extensão. Os diretórios em falta das saídas
  do manifesto são criados; um diretório de `-o` explícito tem de existir.
- Entrada: `--entry` da CLI, `entry` do manifesto, senão deteção
  ([seleção da entrada](executables.md#entry-selection)).
- Os alvos sem `output`, `entry`, `-o` e `--entry` são bibliotecas: compilam
  em memória e não escrevem nada, mesmo que um módulo exporte `main/1`.
- O planeamento rejeita alvos selecionados com o mesmo destino; saídas que só
  coincidem depois de acrescentado `.exe` são rejeitadas antes da publicação.
  Uma saída não pode coincidir com um código-fonte selecionado nem com o
  manifesto.
- Cada alvo é compilado e ligado no seu próprio diretório de preparação. As
  saídas só são substituídas depois de todos os alvos selecionados terem tido
  sucesso, pela ordem dos alvos; qualquer falha mantém inalteradas todas as
  saídas existentes. Uma falha ao substituir uma saída posterior pode deixar
  as anteriores já substituídas.
- `--linker` e `--runtime-library` aplicam-se a todos os alvos ligados
  ([ligação](executables.md#linking)).

```sh
./build/debug/bin/clau --project tests/fixtures/linking/project/project.toml
```

## Criar um projeto

`--new-project <filename>` escreve um manifesto anotado e nada mais.

- Acrescenta `.toml`, a não ser que o nome já termine em `.toml` (ASCII, sem
  distinção de maiúsculas): `demo` → `demo.toml`, `demo.config` →
  `demo.config.toml`.
- Rejeita nomes vazios ou semelhantes a diretórios, repetição e qualquer
  combinação com códigos-fonte, `--project`, `--target`, `-o`, modos de
  verificação/impressão ou opções de frontend.
- O diretório pai tem de existir. Nunca substitui (criação exclusiva); limpa o
  seu próprio ficheiro parcial em caso de falha de escrita. Imprime o caminho
  criado em caso de sucesso.
- O conteúdo é UTF-8/LF determinístico com comentários: um alvo `app`,
  `sources = []`, `source_dirs = ["src"]`, listas de opções vazias e a saída
  por omissão da plataforma. É descodificado de imediato; o utilizador
  acrescenta os códigos-fonte em `src`.

## Caminhos e descoberta

- O caminho do projeto é resolvido em relação ao diretório de invocação; o
  pai léxico do manifesto é a base de todos os caminhos do manifesto (mesmo
  através de uma ligação simbólica). Os caminhos absolutos continuam
  absolutos; `..` é permitido. Sem expansão de shell, de ambiente ou de til.
  Use `/` ou strings literais TOML para caminhos Windows.
- Os códigos-fonte relativos literais tentam primeiro a base e depois
  `source_search_paths` por ordem. Um candidato existente mas ilegível é um
  erro. Os caminhos de pesquisa só localizam ficheiros listados; não enumeram
  módulos nem afetam os includes.
- Curingas: `*` e `?` dentro de um componente, `**` como componente inteiro.
  Parênteses retos, chavetas, negação e escapes são rejeitados. A
  correspondência distingue maiúsculas; `?` é um escalar Unicode de um nome
  UTF-8 válido.
- As entradas ocultas são incluídas; as ligações simbólicas a diretórios
  descobertas são saltadas (as raízes explícitas podem ser ligações
  simbólicas); as ligações simbólicas a ficheiros são seguidas.
- Ordem: as entradas de `sources` por ordem, com as correspondências de cada
  padrão ordenadas pelos bytes UTF-8 do caminho, depois cada expansão de
  `source_dirs` ordenada da mesma forma. Literais em falta, padrões sem
  correspondência e alvos vazios são erros.
- A remoção de duplicados dentro de um alvo usa a identidade no sistema de
  ficheiros (ligações simbólicas, ligações físicas, aliases por maiúsculas),
  mantendo a primeira grafia. O mesmo ficheiro em dois alvos é compilado duas
  vezes, porque as opções podem diferir.
- Apenas os alvos selecionados acedem ao sistema de ficheiros.

## Opções efetivas

| Definição | Combinação do manifesto e da CLI |
| --- | --- |
| `include_dirs` | Ordem do manifesto, depois dos `-I` da CLI (o último `-I` da CLI é pesquisado primeiro) |
| `source_search_paths` | Apenas pesquisa de códigos-fonte do projeto |
| `defines` | Primeiro o manifesto, depois a CLI; duplicados entre ambos são erros |
| `applications` | Map do manifesto; as entradas da CLI substituem os nomes correspondentes |
| Listas de features | Definições do manifesto, depois as alterações ordenadas da CLI; a CLI prevalece |
| `output` | Por alvo, apenas alvos executáveis; `-o` da CLI substitui-o para um único alvo selecionado |
| `entry` | Por alvo; `--entry` da CLI substitui-o para um único alvo selecionado |

## Dependência de compilação

toml++ 3.4.0 (MIT), privado do compilador, apenas cabeçalhos com exceções,
sintaxe não publicada desativada. SHA-256 do arquivo
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS: `brew install tomlplusplus` (fórmula 3.4.0) é detetado.
- Windows: o CMake descarrega e verifica a versão para `thirdparty/`.
- Noutros sistemas: instale-o, extraia-o para `thirdparty/tomlplusplus-3.4.0`
  ou passe `-DCLAUSE_TOML_ROOT=<path>` (tem precedência, desativa a
  transferência).
- As compilações só do runtime não o procuram.

## Limites

Tamanho do manifesto 1 MiB; no máximo 1024 alvos e 100 000 nós TOML. Cada
expansão de códigos-fonte permite 100 000 entradas visitadas, 128 níveis de
diretórios e 16 000 000 de transições de curingas. O esgotamento é um erro
explícito; estes são limites de trabalho, não prazos de E/S.
