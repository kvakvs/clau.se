---
source: docs/projects.md
sourceCommit: 6ed3851c
sourceSha256: 8a996bd18e6d699944fde901a3d45fece06aa55859935b3fe26c1518edc03e7d
translatedAt: 2026-10-15
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
build_dir = "build"

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]
ignore_dirs = ["src/legacy", "deps/*/test"]
ignore_modules = ["telemetry", "*_SUITE"]
keep_exports = false
cache_inference_in_dirs = ["deps/*"]

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
  recursiva de `.erl` e `.abstr`) são opcionais, mas um alvo precisa de pelo
  menos uma entrada. Os ficheiros explícitos têm de terminar em `.erl`, ou em
  `.abstr` para formas em formato abstrato
  ([transformações](transforms.md#interchange)); os cabeçalhos são
  dependências, não entradas.
- `parse_transforms` (nomes de módulos) e `transform_paths` (diretórios ou
  padrões de ficheiros `.beam` pré-compilados) em `options` aplicam parse
  transforms aos módulos do alvo ([transformações](transforms.md#options)).
- `ignore_dirs` (caminhos) e `ignore_modules` (nomes de módulos), ambos com
  curingas, em `options` deixam códigos-fonte fora da compilação
  ([códigos-fonte ignorados](#ignored-sources)).
- `keep_exports = true` em `options` mantém chamáveis todas as exportações do
  executável do alvo, tal como `--keep-exports` faz para cada alvo
  selecionado ([vivacidade das exportações](executables.md#export-liveness)).
  Tem de ser um booleano.
- `cache_inference_in_dirs` (curingas de diretórios) em `options` acrescenta
  diretórios cujos módulos guardam os seus resultados de inferência na cache de
  compilação ([cache de inferência](#inference-cache)).
- Os campos de `options` são opções de frontend tipadas e opcionais. `defines`
  usa `NAME` (= `true`) ou `NAME=ERLANG_LITERAL_TERM`; duplicados são erros.
  Uma feature não pode aparecer em ambas as listas de features.
- `entry` (opcional) seleciona a entrada do executável `MODULE[:FUNCTION]`; ver
  [executáveis](executables.md#entry-selection). O `--entry` da CLI
  substitui-a para um único alvo selecionado.
- `build_dir` (opcional) é o [diretório de compilação](#build-directory) do
  alvo, por omissão `<manifest-dir>/build`.
- `output` é o destino do executável, por omissão
  `<manifest-dir>/build/<target>` (`.exe` no Windows). Um alvo com `output` ou
  `entry` é um alvo executável ([executáveis](#executables)); `--emit` e os
  modos de verificação/impressão ignoram as saídas de ambas as chaves.
- Ainda não suportado: valores por omissão na raiz, herança, dependências entre
  alvos, importações, perfis, pacotes, watch, compilações paralelas. Os campos
  só são acrescentados juntamente com o seu comportamento. As caches de
  compilação são descritas em [caches de compilação](#build-caches).

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
- `--print-inputs` executa cada alvo selecionado até à compilação:
  pré-processa e analisa os códigos-fonte após a
  [descoberta](#paths-and-discovery) e depois acrescenta os módulos que estes
  nomeiam a partir da biblioteca e de `source_search_paths`, como faz uma
  compilação. Imprime os códigos-fonte do alvo (caminhos absolutos), um por
  linha, e depois cada código-fonte acrescentado como
  `<path> (referenced at <file>:<line>)`, o primeiro local do módulo que o
  referencia em que é nomeado; os códigos-fonte acrescentados são pesquisados
  por sua vez. Nada é compilado. Com vários alvos, cada lista segue uma linha
  `[target <name>]`. As entradas posicionais são impressas tal como foram
  dadas. Os diagnósticos vão para stderr; um erro de análise sintática para de
  acrescentar módulos referenciados e termina com 1. Substitui as outras ações
  de verificação/impressão e entra em conflito, como elas, com `-o`, `--entry`
  e as opções de compilação.
- `--print-env` imprime toda a invocação como TOML: uma tabela `[[targets]]`
  por alvo selecionado com os seus códigos-fonte resolvidos, diretórios de
  pesquisa/inclusão e opções efetivas
  ([relatório do ambiente](compile.md#environment-report)).
- Código de saída 2: erros de utilização e alvos desconhecidos. Código de
  saída 1: falhas do manifesto, da descoberta, do frontend ou da criação.
  Código de saída 0: sucesso (avisos permitidos).

Cada alvo selecionado é um lote de compilação separado, com as suas próprias
sessões de pré-processamento. O planeamento (descodificar, selecionar,
descobrir, verificar colisões de saídas) termina antes de qualquer
código-fonte ser processado; a execução processa então os alvos/ficheiros por
ordem e regista as falhas. A saída útil vai para stdout pela ordem
alvo/ficheiro, sem cabeçalhos (exceto as linhas de alvo de `--print-inputs`);
o contexto e os diagnósticos vão para stderr. Um alvo com diagnósticos é
nomeado uma vez, numa linha `<manifest> [target <name>]:` antes do primeiro;
os próprios diagnósticos (`error: file:line:col: message`) não levam prefixo
de ferramenta nem de alvo.

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

## Diretório de compilação

Cada alvo de projeto tem um diretório de compilação onde o Clause guarda os
seus próprios ficheiros temporários (e, a partir do plan 11 step 62D2, as suas
caches): o `build_dir` do alvo, relativo ao manifesto, por omissão
`<manifest-dir>/build`. `--build-dir DIR` (relativo à invocação) substitui-o
para todos os alvos selecionados. As entradas posicionais não têm nenhum, a
não ser que seja dado `--build-dir`.

- Os ficheiros temporários vão para baixo de `<build_dir>/tmp`: hoje, os
  espaços de trabalho do carregador de parse transforms
  ([transformações](transforms.md#loader)). Cada execução remove os seus; pode
  ficar um `tmp` vazio. Sem diretório de compilação, vão para o diretório
  temporário do sistema.
- A preparação da ligação (`.clause-link-*`) fica ao lado da saída do
  executável, porque a mudança de nome final tem de ficar no volume da saída
  ([ligação](executables.md#linking)).
- Os modos de verificação e impressão (`--parse-check`, `--print-ast`, ...)
  não escrevem nada fora do diretório de compilação; as verificações
  posicionais sem `--build-dir` não escrevem ficheiro nenhum.
- `--print-env` imprime o `build_dir` de cada alvo (`""` quando não há
  nenhum).

### Caches de compilação

Os resultados que vale a pena manter entre execuções vivem abaixo de
`<build_dir>/cache` (62D4 e 62D5); `--no-cache` não os lê nem os escreve. São
as respostas do carregador de parse transforms e a lista de módulos sticky do
OTP anfitrião, para que uma compilação com cache quente não arranque nenhum
`erl` anfitrião para módulos cujas entradas de transformação não mudaram, e o
[resultado da compilação](compile.md#compile-cache) de cada lote.

- **Interface.** Os chamadores usam um único armazenamento interno do projeto
  (`compiler/src/cache/
  store.hpp`): `get`/`put` por diretório de entrada, nome de ficheiro, tipo de
  resultado e chave, mais `invalidate` e `prune`; nunca veem caminhos. Um
  valor é a versão de formato do chamador e uma lista de partes com nome (uma
  execução de transformação: `reply` e `output`; um resultado de compilação:
  `failed`, cada `diagnostic` e, com saídas, `triple`, `extension` e uma parte
  por objeto de módulo), pelo que nenhum chamador precisa de um codec próprio.
  Um `get` com outra versão de formato é uma falha de cache. Todas as operações
  são seguras a partir de várias threads em simultâneo.
- **Disposição (backend SQLite).** `cache/v2/cache.db` é uma base de dados
  SQLite 3.54: tabela `entries` (diretório de entrada, ficheiro, tipo, chave,
  formato, última utilização; única no endereço) e tabela `parts` (entrada,
  ordem, nome, tamanho, checksum xxh3-64 e, ou os bytes, ou o nome de um
  ficheiro blob). As partes maiores do que 256 KB vivem em
  `cache/v2/blobs/<xxh3-128 of the bytes>`, pelo que partes iguais (os objetos
  idênticos de um lote compilado com dois conjuntos de opções) são guardadas
  uma vez. Um ficheiro blob é escrito como ficheiro temporário e renomeado
  antes de a linha que o nomeia ser confirmada, pelo que uma linha nunca nomeia
  um ficheiro incompleto; uma falha a meio deixa apenas um ficheiro órfão.
- **Chaves.** Uma chave é o hash de conteúdo de 128 bits de tudo aquilo de que
  o resultado depende, nunca uma marca temporal: a versão e o executável do
  `clau` (caminho, tamanho, data de modificação, pelo que um `clau`
  recompilado falha a cache), o tipo de resultado e, para uma execução de
  transformação, o pedido enviado ao `erl` (as formas pré-processadas do
  módulo e as suas opções de compilação: diretórios de inclusão, defines,
  features), a versão do OTP anfitrião (`erl` e os ficheiros
  `releases/*/OTP_VERSION` ao seu lado), cada código-fonte de transformação do
  projeto compilado para a execução com os ficheiros que inclui, e cada
  `.beam` nos code paths das transformações. A versão de formato do
  armazenamento é o diretório `v<format>`; a versão de formato própria de um
  valor fica na sua linha. Como a chave cobre as formas pré-processadas, um
  cabeçalho, define ou feature alterado, ou um novo cabeçalho que oculte um
  incluído, falha exatamente os módulos cujas formas ou opções mudam; os
  defines e as features são opções de compilação que todas as transformações
  veem, pelo que falham todos os módulos transformados; um `.beam` alterado
  falha todos os módulos cujas transformações correm com esse code path.
- **Concorrência.** A base de dados corre em modo write-ahead log com
  `synchronous=NORMAL`: os leitores correm ao lado de um escritor, e os
  escritores (uma transação por `put`) esperam uns pelos outros até 30 s.
  Vários processos `clau` que partilham um diretório de compilação mantêm
  todas as entradas. Dentro de um processo, um mutex serializa as threads que
  partilham um armazenamento.
- **Danos.** As partes levam tamanhos e checksums, e os ficheiros blob são
  verificados face aos seus nomes: uma parte danificada ou um ficheiro blob em
  falta é uma falha de cache (`damaged entry`) e a sua entrada é descartada. Um
  `cache.db` com lixo, truncado ou alheio (o SQLite indica-o como corrompido ou
  não sendo uma base de dados, ou o seu application id ou versão de esquema
  diferem) é renomeado para `cache.db.damaged` e criado de novo; quando isso é
  impossível, a execução continua sem cache. Nada disto é um erro, e
  `--verbose` regista-o como `[cache] ...`.
- **Sistemas de ficheiros de rede.** O write-ahead logging precisa de memória
  partilhada entre processos, que os sistemas de ficheiros de rede não
  fornecem. Quando o SQLite não consegue entrar em modo WAL, o armazenamento
  usa o seu rollback journal (os leitores esperam então por um escritor) e
  `--verbose` indica-o uma vez; quando nenhum modo de journal funciona, a
  execução continua sem cache.
- **Limpeza.** No fim de uma execução que escreveu num armazenamento, as
  entradas não usadas há 30 dias são apagadas, depois os ficheiros blob que
  nenhuma entrada nomeia (quando têm mais de 10 minutos, para que o novo
  ficheiro de um escritor concorrente sobreviva), e as páginas libertadas são
  devolvidas ao sistema de ficheiros (incremental vacuum). Cada execução
  remove uma árvore `cache/v1` remanescente do backend de ficheiros do step
  62D2.
- **Observabilidade.** `--print-stage-times` assinala as fases reutilizadas
  (`[time] transform src/a.erl: 7.254 ms (cached)`); `--verbose` imprime
  `[cache] hit|miss <kind> <file>` com o motivo de uma falha (`no entry`,
  `inputs changed`, `damaged entry`). Os diagnósticos e a saída das
  transformações são os mesmos com e sem acerto: são guardados com a entrada.
- **Medições dos backends** (2026-10-12, Release, Windows 11,
  NTFS; `cache_store bench` em `tests/compiler/cache`). O backend de ficheiros
  do 62D2 (um índice reescrito por put, packs só de acrescento) face ao
  SQLite:

  | Caso | Backend de ficheiros | SQLite |
  | --- | --- | --- |
  | 200 puts × 8 KB, depois abrir e 200 gets | 788–902 ms, 9–16 ms | 37–41 ms, 8–9 ms |
  | 2000 puts × 8 KB, depois abrir e gets | 11,1–12,5 s (1–3 entradas perdidas), 118–128 ms | 249–258 ms, 32–33 ms |
  | 3 puts × 24 MB, depois abrir e gets | 106–127 ms, 144–157 ms | 85–90 ms, 73 ms (ficheiros blob) |

  Guardados dentro da base de dados, os valores de 24 MB demoraram 379–392 ms
  a escrever (o log escreve-os duas vezes). Vinte valores diferentes por
  tamanho, escritos e depois lidos: 64 KB na base de dados 21 ms / 7 ms face a
  30 ms / 12–17 ms como ficheiros blob; 256 KB 41–43 ms / 9 ms face a
  30–31 ms / 10–19 ms; 1 MB 105–110 ms / 18 ms face a 37 ms / 18–22 ms; 4 MB
  458–466 ms / 82 ms face a 92 ms / 71 ms. As leituras favorecem a base de
  dados até cerca de 256 KB e as escritas favorecem os ficheiros a partir daí,
  o que fixa o limite inline em 256 KB. As compilações do luerl (Release, três
  execuções) não mudaram: a frio 3,75–3,78 s antes e 3,78–3,80 s depois, a
  quente 1,65–1,68 s antes e 1,69–1,70 s depois; mantêm poucas entradas.
- **Sem cache de varrimento de diretórios** (2026-10-11, `clau` Release,
  Windows, cache de ficheiros do SO quente). O luerl planeia em 78 ms de uma
  compilação a quente de 2,77 s (2,8%). Um manifesto sobre todo o
  `references/otp/lib` (1319 diretórios, 9711 ficheiros) planeia em cerca de
  150 ms: `sources = ["…/lib/**/src/*.erl"]` 74 ms,
  `source_dirs = ["…/lib"]` 140 ms, `source_search_paths` e `include_dirs`
  com `**` 35 ms cada, `ignore_dirs` 0,4 ms. Listar todos os diretórios da
  árvore custa cerca de 28 ms, enquanto verificar a data de modificação de
  cada diretório (o que uma cache de varrimento faria em vez disso) custa
  cerca de 13 ms; o resto é a validação por código-fonte (abrir e identificar
  cada um de 2000-3600 códigos-fonte), que essa cache não pode saltar. A
  primeira execução depois de a árvore sair da cache do SO demorou 10-20 s,
  também dominada pela abertura de ficheiros. A sondagem de includes não
  custa nada mensurável desde o [índice de diretórios](#directory-index).
- **Resultados de inferência** dos módulos em diretórios configurados
  ([cache de inferência](#inference-cache)).
- **Sem cache:** pré-processamento e análise sintática. Um resultado em cache
  seria carregado através das formas abstratas (`transforms/import`) e, no
  luerl (169 módulos, Release, 2026-10-11), só importá-las demorou 1063 ms face
  a 819 ms para pré-processar (409 ms) e analisar (410 ms) os códigos-fonte;
  exportar as formas para uma chave demorou mais 727 ms.

### Cache de inferência

Os módulos de biblioteca (os códigos-fonte de `stdlib`, `kernel`, `compiler` e
`syntax_tools` do OTP encontrados através de `source_search_paths`, a própria
[biblioteca](library.md) do Clause) raramente mudam, pelo que os módulos em
diretórios configurados guardam os seus resultados de inferência de tipos na
cache de compilação, por módulo, e as compilações seguintes reutilizam-nos em
vez de os inferirem de novo.

- Diretórios: os padrões implícitos de aplicações OTP `*/stdlib`,
  `*/stdlib-*`, `*/kernel`, `*/kernel-*`, `*/compiler`, `*/compiler-*`,
  `*/syntax_tools` e `*/syntax_tools-*`, depois o `cache_inference_in_dirs`
  do alvo, depois cada `--cache-inference-in-dirs PATTERN` (repetível; também
  para entradas posicionais). Os padrões usam os
  [curingas](#paths-and-discovery) de `sources`; os separadores do Windows são
  aceites.
- Um módulo é abrangido quando um diretório que contém o seu código-fonte
  corresponde a um padrão. Um padrão relativo corresponde aos diretórios
  finais de qualquer caminho, não a caminhos abaixo do diretório do
  manifesto: `*/stdlib` abrange
  `/usr/lib/erlang/lib/stdlib/src/lists.erl` e
  `references/otp/lib/stdlib/src/lists.erl`, enquanto um
  `.../lib/stdlib-7.0/src/lists.erl` instalado precisa de `*/stdlib-*`. Um
  padrão absoluto corresponde a todo o caminho do diretório
  (`C:/Program Files/Erlang OTP/lib/*`). A correspondência é léxica e
  distingue maiúsculas. Os padrões implícitos abrangem também um diretório
  próprio de um projeto com um desses nomes (`apps/compiler`), o que apenas
  guarda mais entradas: a reutilização é correta para todos os módulos.
- `--print-env` imprime a lista efetiva como `cache_inference_in_dirs`, com
  os padrões implícitos primeiro. Uma construção não suportada (`[`, `{`, `!`)
  é um erro do manifesto, ou um erro de utilização (código de saída 2) na
  linha de comandos.
- A reutilização precisa de um diretório de compilação (todos os alvos de
  projeto; entradas posicionais com `--build-dir`) e fica desligada com
  `--no-cache`. Funciona para todas as ações que fazem análise (compilação,
  executáveis, `--print-types`, inspeções do IR), também quando a
  [cache de compilação](compile.md#compile-cache) do lote falha.
- Chave: a identidade do `clau`, a impressão digital do módulo e as de todos
  os módulos do lote que os seus átomos nomeiam, transitivamente (chamadas
  remotas, `fun M:F/A`, `apply`, qualquer átomo que seja um nome de módulo);
  ver [semântica: cache de inferência](semantic.md#inference-cache) para
  perceber porque é tudo aquilo de que os seus factos dependem. Editar um
  módulo do utilizador mantém, por isso, os acertos da biblioteca, a não ser
  que um módulo de biblioteca o nomeie; editar um módulo de biblioteca falha-o
  a ele e a todos os módulos abrangidos que o alcançam.
- As entradas são guardadas por diretório de código-fonte, ficheiro e alvo de
  projeto (tipo `inference@<target>`, `inference@positional`); um valor é uma
  parte `results` (`semantic/types/inference_store`: nós do grafo, resumos e
  entradas locais por função, factos de expressões por posição sintática). Os
  resultados guardados por uma compilação com mais funções vivas (por exemplo
  `--print-types`) servem um executável que mantém menos.
- `--verbose` imprime `[cache] hit|miss inference <file>` por módulo abrangido
  (motivos de falha: `no entry`, `inputs changed`, `damaged entry`, `results do not
  fit` para resultados guardados a que falta uma função agora viva);
  `--print-stage-times` imprime as fases `inference-cache` (com `N of M
  covered modules reused`) e `inference-store`.

## Caminhos e descoberta

- O caminho do projeto é resolvido em relação ao diretório de invocação; o
  pai léxico do manifesto é a base de todos os caminhos do manifesto (mesmo
  através de uma ligação simbólica). Os caminhos absolutos continuam
  absolutos; `..` é permitido. Sem expansão de shell, de ambiente ou de til.
  Use `/` ou strings literais TOML para caminhos Windows.
- Os códigos-fonte relativos literais tentam primeiro a base e depois
  `source_search_paths` por ordem. Um candidato existente mas ilegível é um
  erro. Os caminhos de pesquisa não enumeram módulos nem afetam os includes.
- Quando os códigos-fonte do alvo nomeiam um módulo que nenhum deles define
  (uma chamada remota, `fun M:F/A`, `apply` com um módulo literal,
  `-behaviour` ou `-import`), é pesquisada primeiro a
  [biblioteca](library.md#how-programs-get-them) do Clause e depois os caminhos
  de pesquisa por ordem, à procura de `Module.erl` (plan step 41K: um OTP
  instalado nunca substitui um módulo do Clause, e um módulo que o Clause
  regista como em falta nunca é obtido de um caminho de pesquisa); um
  ficheiro encontrado junta-se ao alvo como um código-fonte listado, e as suas
  próprias referências são resolvidas da mesma forma. Um código-fonte listado
  com o nome de um módulo do Clause substitui-o, com um aviso.
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

### Índice de diretórios

As pesquisas por nome não sondam todos os diretórios candidatos. Um índice por
invocação do `clau`, partilhado por todos os alvos, guarda os nomes das
entradas de cada diretório pesquisado: listados uma vez, sem recursão, quando
uma pesquisa precisa deles pela primeira vez, ou registados pelos percursos
recursivos que expandem `**` em `sources`, `source_dirs`,
`source_search_paths`, `include_dirs` e `transform_paths`, para que nenhum
diretório seja listado duas vezes. Responde às falhas da pesquisa de módulos
(a biblioteca, depois `source_search_paths`), aos códigos-fonte de
transformações, aos `sources` literais encontrados através de
`source_search_paths` e à resolução de includes (o diretório do ficheiro que
inclui, o diretório de trabalho, os diretórios de inclusão por ordem, depois
as aplicações de `include_lib`); um candidato que o índice contém continua a
ser aberto ou verificado como antes, pelo que a precedência, `ignore_dirs` e
os relatórios de erros não mudam. Os nomes de include com partes de diretório
(`sub/x.hrl`) são procurados no diretório que nomeiam; os nomes com passos
`..`, os nomes absolutos, os diretórios relativos e as listagens que falham
são sondados como antes.

- As chaves dos nomes de ficheiros ignoram maiúsculas ASCII no Windows e no
  macOS, cujos volumes não distinguem maiúsculas por omissão, pelo que
  `Foo.hrl` continua a encontrar `foo.hrl`; nos outros sistemas as chaves são
  exatas. Os nomes que essa conversão não consegue fazer corresponder
  exatamente (aí, nomes não ASCII e, no Windows, nomes terminados em `.` ou
  num espaço ou que contêm `~`, que podem ser nomes curtos 8.3) são sondados.
- O índice é um instantâneo de uma invocação: os ficheiros que aparecem
  enquanto o `clau` corre (preparação da ligação, saídas) nunca são entradas
  de pesquisa.
- `--verbose` termina com `[index] listed=N walked=N lookups=N misses=N probes=N`
  (diretórios listados a pedido, listagens registadas por percursos, pesquisas
  a que o índice respondeu e as falhas entre elas, pesquisas deixadas a uma
  sondagem). No luerl (2026-10-11), responde a todas as 15 215 pesquisas
  (14 909 falhas) a partir de 66 listagens e 1380 diretórios percorridos.

## Códigos-fonte ignorados

`ignore_dirs` e `ignore_modules` mantêm códigos-fonte fora de um alvo sem os
remover da árvore, por exemplo testes de dependências incluídas, código
legado ou módulos que só importam sob o OTP. Um código-fonte ignorado é
saltado silenciosamente: nunca é lido, analisado, compilado ou ligado, pelo
que pode até conter erros de sintaxe.

- `ignore_dirs`: caminhos relativos ao manifesto (ou absolutos) com os
  [curingas](#paths-and-discovery) de `sources`. Um código-fonte é ignorado
  quando o seu caminho, ou um diretório que o contém, corresponde: `src/legacy`,
  `deps/*/test`, `**/test` (qualquer diretório `test`), `src/*_SUITE.erl`. A
  correspondência é léxica; um padrão não precisa de corresponder a nada.
- `ignore_modules`: nomes de módulos, ou padrões de nomes com `*` e `?`
  comparados com o nome inteiro (`*_SUITE`, `legacy_*`, `prim_???`). Um
  código-fonte com o nome `<Module>.erl` (ou `.abstr`) é ignorado quando uma
  entrada corresponde a `<Module>`, e um módulo referenciado que corresponda
  nunca é procurado.
  Isto inclui os [módulos de biblioteca](library.md#which-module-a-name-resolves-to) do Clause.
- Um código-fonte que `sources` lista literalmente (sem curinga) nunca é
  ignorado: as regras não têm efeito sobre ele, e a compilação avisa
  `listed in sources but
  matched by ignore_modules or ignore_dirs; ignoring it has no effect`
  (indicação do utilizador de 2026-10-12). As correspondências por curinga e
  `source_dirs` são ignoradas como descrito.
- Ambos se aplicam a `sources`, `source_dirs`, aos códigos-fonte literais
  encontrados através de `source_search_paths`, à
  [pesquisa de módulos](#paths-and-discovery) de `source_search_paths` e da
  biblioteca, e à pesquisa de
  [códigos-fonte de parse transforms](transforms.md#transform-modules). Uma
  pesquisa passa por cima de um `Module.erl` ignorado e continua a procurar
  nos diretórios seguintes.
- Um módulo é ignorado quando `ignore_modules` o nomeia, ou quando nenhum
  código-fonte do lote o define e os únicos códigos-fonte encontrados para ele
  foram ignorados (pela pesquisa, ou saltados dos códigos-fonte do alvo, pelo
  nome do ficheiro). Um módulo definido por um código-fonte compilado nunca é
  ignorado.
- As referências a um módulo ignorado (`M:F(...)`, `-import`, `fun M:F/A`,
  `apply(M, F, [...])` com nomes literais) alcançam um módulo substituto
  gerado `M` que exporta cada função nomeada desta forma; cada uma devolve
  `{module_ignored, M}` em vez de correr. Uma função que o lote nunca nomeia
  literalmente continua `undef` para chamadas dinâmicas. Um tipo de um módulo
  ignorado nomeado numa spec ou num tipo (`helper:result()`) gera o aviso
  `attempt to import a type
  from a module ignored in project settings: helper:result` e é tratado como
  `term()`. `-behaviour(M)` com um `M` ignorado avisa
  `behaviour M undefined`.
- `--print-inputs` lista cada módulo referenciado ignorado depois dos
  códigos-fonte acrescentados como
  `ignored module <name> (referenced at <file>:<line>)`; `--print-env` imprime
  ambas as chaves.

```toml
[targets.options]
source_search_paths = ["deps/**"]
ignore_dirs = ["deps/*/test", "src/legacy"]
ignore_modules = ["telemetry", "*_SUITE"]
```

## Opções efetivas

| Definição | Combinação do manifesto e da CLI |
| --- | --- |
| `include_dirs` | Ordem do manifesto, depois dos `-I` da CLI (o último `-I` da CLI é pesquisado primeiro); uma entrada com curingas (`deps/*/include`, `apps/**/include`) expande-se no lugar para os diretórios existentes a que corresponde, ordenados pelos bytes UTF-8 do caminho (`**` também corresponde a nenhum, as ligações simbólicas a diretórios são saltadas); um padrão sem correspondência é um erro |
| `source_search_paths` | Raízes de recurso para códigos-fonte literais e para os módulos que o alvo nomeia mas não lista; os padrões expandem-se como em `include_dirs` (sem correspondência: `unmatched source search path pattern`) |
| `defines` | Primeiro o manifesto, depois a CLI; duplicados entre ambos são erros |
| `applications` | Map do manifesto; as entradas da CLI substituem os nomes correspondentes |
| Listas de features | Definições do manifesto, depois as alterações ordenadas da CLI; a CLI prevalece |
| `output` | Por alvo, apenas alvos executáveis; `-o` da CLI substitui-o para um único alvo selecionado |
| `entry` | Por alvo; `--entry` da CLI substitui-o para um único alvo selecionado |
| `cache_inference_in_dirs` | Padrões OTP implícitos, depois os do manifesto, depois `--cache-inference-in-dirs` da CLI ([cache de inferência](#inference-cache)) |

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

A [cache de compilação](#build-caches) usa a amalgamação SQLite 3.54.0
(domínio público), compilada apenas na biblioteca de cache do compilador
(`clause_sqlite`, sem as flags de aviso do projeto). O CMake descarrega
`https://www.sqlite.org/2026/sqlite-amalgamation-3540000.zip` para
`thirdparty/` em todos os anfitriões e verifica o seu SHA-256
`68e913b0fe8ec6b4e5f391c594a28872884e80d6cd042a1e50c957be46b5aa4d`;
`-DCLAUSE_SQLITE_ROOT=<directory with sqlite3.c and sqlite3.h>` tem
precedência e desativa a transferência.

## Limites

Tamanho do manifesto 1 MiB; no máximo 1024 alvos e 100 000 nós TOML. Cada
expansão de códigos-fonte permite 100 000 entradas visitadas, 128 níveis de
diretórios e 16 000 000 de transições de curingas. O esgotamento é um erro
explícito; estes são limites de trabalho, não prazos de E/S.
