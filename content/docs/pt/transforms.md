---
source: docs/transforms.md
sourceCommit: 6ed3851c
sourceSha256: 2c6d8c271fd5fd640bb4c93eaff0872914f396898bfe9df527ca51055d033c11
translatedAt: 2026-10-15
---
# Parse transforms

## Utilizar parse transforms

- **Requisito:** Erlang/OTP 29 instalado no anfitrião, apenas para compilar
  módulos que usam um transform. O `clau` usa `--erl PATH`, caso contrário o
  `erl` no `PATH`, caso contrário, em Windows,
  `%ProgramFiles%\Erlang OTP\bin\erl.exe`. `--erl none` nunca executa código
  do anfitrião: os módulos que precisam de um transform falham.
- **Invocar um transform** no código-fonte com
  `-compile({parse_transform, Module}).` (ou dentro de uma lista
  `-compile([...])`), ou para todos os módulos do comando com
  `--parse-transform Module` (repetível; estes correm primeiro, como
  `erlc +'{parse_transform,M}'`).
- **Os módulos de transform** são encontrados como ficheiros `.beam` nos
  diretórios de `--transform-path` (repetível) e nos `transform_paths` do
  projeto, depois como `Module.erl` entre os códigos-fonte do lote e os
  `source_search_paths` (compilados pelo OTP do anfitrião em cada compilação,
  juntamente com os módulos que chamam a partir daí; aplicam-se
  `ignore_dirs` e `ignore_modules`), depois entre os módulos do OTP
  (`ms_transform`, `qlc`).
- **Pré-compilar** um transform que vem de outra biblioteca (sempre), ou um
  transform do projeto que o compilador do anfitrião não consegue compilar
  com os diretórios de include e as definições do alvo:
  `erlc -o deps/lib/ebin deps/lib/src/*.erl` com o OTP do anfitrião, e depois
  indicar `deps/lib/ebin` com `--transform-path` ou em `transform_paths`. O
  `.beam` tem de vir da release do OTP do anfitrião; um `.beam` aí prevalece
  sobre um código-fonte do mesmo módulo.
- **O que o executa:** a compilação, `--print-ast`, `--print-source` e
  `--print-abstr` (que mostra as formas transformadas); `--parse-check`,
  `--preprocess-check` e `--print-pp` não o executam.

```sh
clau --erl "C:/Program Files/Erlang OTP/bin/erl.exe" --transform-path ebin -o app app.erl
```

O Clause aplica `{parse_transform, Module}` tal como o `erlc`. Exporta o
módulo analisado como formas do
[formato abstrato](https://www.erlang.org/doc/apps/erts/absform.html) do OTP,
executa o módulo de transform num Erlang/OTP 29 instalado no anfitrião,
importa as formas devolvidas como a nova sintaxe do módulo e compila-a. O OTP
só é necessário enquanto se compila um módulo que usa um transform; os
programas gerados nunca precisam dele. Decidido no step 73A do plano;
implementado pelos steps 73B–73G (`compiler/src/transforms/`).

## Comportamento do OTP

A partir de `lib/compiler/src/compile.erl` fixado (`transform_module`,
`foldl_transform`, `maybe_strip_columns`) e observado com o OTP 29.1.1:

- Os transforms correm como a primeira passagem padrão: depois do `epp` e da
  análise sintática, antes do `erl_lint`, antes de o `erl_internal`
  acrescentar `module_info/0,1` e `behaviour_info/1`.
- A lista de transforms é cada `{parse_transform, M}` das opções de
  compilação (`erlc +'{parse_transform,m}'`) e depois dos atributos
  `-compile`, pela ordem das formas. Um transform indicado duas vezes corre
  duas vezes. Antes de o primeiro correr, essas opções são removidas das
  formas: um atributo `-compile` que contenha apenas a opção desaparece, uma
  lista perde o elemento.
- `M` tem de carregar (`code:ensure_loaded/1`) e exportar `parse_transform/2`;
  caso contrário, dá o erro `undefined parse transform 'M'` (sem
  localização).
- `M:parse_transform(Forms, Options)` recebe as formas e as opções de
  compilação (não as opções `-compile` do código-fonte): `{features, Enabled}`,
  `report_warnings`, `report_errors`, `{cwd, Dir}`, `{outdir, Dir}`,
  `{i, Dir}` por diretório de include, `{d, Name[, Value]}` por definição,
  mais qualquer `{parse_transform, M}` dado como opção.
- Devolve `Forms`, `{warning, Forms, Warnings}` ou
  `{error, Errors, Warnings}`, em que cada lista é
  `[{File, [{Location, Module, Descriptor}]}]` formatada por
  `Module:format_error(Descriptor)`. Uma exceção é o erro
  `error in parse transform 'M': ...` (`compile:format_error/1` de
  `{parse_transform, M, {Class, Reason, Stack}}`). O transform seguinte
  recebe as formas do anterior; o primeiro erro interrompe a cadeia.
- `M:parse_transform_info/0` a devolver `#{error_location => line}`, ou a
  opção de compilação `{error_location, line}`, retira as colunas das formas
  antes de `M` correr e das formas finais.
- As formas levam anotações `{Line, Column}`. O `epp` acrescenta primeiro
  `{attribute, {1,1}, file, {File, 1}}`, o mesmo para cada ficheiro incluído
  quando começa, e `{attribute, {L,1}, file, {File, L}}` quando o ficheiro
  que inclui continua na linha `L`, a linha a seguir ao seu `-include`. As
  definições de macros e as outras diretivas não deixam nenhuma forma. A
  lista termina com `{eof, Location}`, o fim do ficheiro principal. Os erros
  do pré-processador e de análise sintática ficam na lista como formas
  `{error, E}` e o `erl_lint` comunica-os depois dos transforms.
- Formas do OTP 29 que o `absform.md` não lista: `{attribute, A, native_record,
  {Name, Fields}}`; nomes de records `{Module, Name}` (qualificados) e `[]`
  (`#_`) em expressões `record`/`record_field`; `{type, A, record, [{tuple, A,
  [Module, Name]} | Fields]}` para tipos de records qualificados; `{zip, A,
  Qualifiers}` como qualificadores de comprehensions; `{mc, ...}`,
  `m_generate` e os geradores `_strict`.
- `erlc +to_abstr` escreve as formas depois dos transforms (e do `erl_lint`)
  em `File.abstr`, um termo `~p.` por forma; `erlc File.abstr`
  (`compile:file(F, [from_abstr])`) compila um ficheiro desses sem
  pré-processador nem parser.

## Pipeline do Clause

1. Pré-processar e analisar o módulo. Os erros do pré-processador ou da
   análise sintática param aqui; os transforms não correm num módulo com
   erros (difere do OTP, que passa os erros adiante como formas).
2. Recolher os transforms pela ordem do OTP: as opções `--parse-transform` e
   os `parse_transforms` do projeto, depois os atributos `-compile`. Um
   módulo sem nenhum salta o resto e nunca inicia o OTP.
3. Remover essas opções das formas e exportá-las: anotações
   `{Line, Column}` tal como o `erl_parse` as atribui, os atributos `file` do
   `epp` e `eof`. As funções predefinidas ainda não fazem parte das formas.
4. Executar o [carregador](#loader) uma vez para o módulo.
5. Importar as formas devolvidas transformando-as em tokens localizados nas
   suas anotações e analisando-as com o parser do Clause; um atributo `file`
   muda o ficheiro das formas seguintes, como no `erl_lint`.
6. Acrescentar as funções predefinidas e depois fazer o lint, analisar e
   compilar como habitualmente.

Os transforms correm quando um módulo é compilado e para `--print-ast`,
`--print-source` e `--print-abstr`, que imprimem o módulo transformado.
`--preprocess-check`, `--parse-check` e `--print-pp` não os executam.

## Intercâmbio

- O `clau` e o carregador trocam ficheiros no External Term Format
  (`term_to_binary`, versão 131, não comprimido): floats exatos, átomos
  UTF-8, inteiros grandes e nenhuma análise de texto em Erlang. O próprio
  formato (etiquetas, disposições, verificações de limites) existe uma única
  vez em `abi/include/clause/abi/external_term.hpp`, independente de qualquer
  representação de termos, para que os futuros `term_to_binary/1`,
  `binary_to_term/1` e a distribuição do runtime o reutilizem.
  O modelo de termos do compilador do Clause contém átomos, inteiros, floats,
  listas próprias e impróprias, tuplos, maps e bitstrings; os pids, ports,
  referências e funs são rejeitados com um diagnóstico.
- O texto `.abstr` usa a sintaxe de
  [`file:consult/1`](https://www.erlang.org/doc/apps/kernel/file.html#consult/1):
  um termo por forma, cada um terminado em `.`. `--print-abstr` imprime no
  stdout as formas de cada módulo depois dos transforms nessa sintaxe, uma
  forma por linha; um ficheiro de entrada `.abstr` compila como
  `erlc File.abstr`. O Clause escreve texto canónico, não a disposição `~p`
  do OTP; o que importa são termos iguais. As formas são iguais a
  `epp:parse_file(F, [{location, {1, 1}}])` para todas as construções de
  `tests/fixtures/transforms/abstract/`, incluindo os atributos `file` do
  `epp` (um `-file` explícito é anotado
  `[{generated, true}, {location, L}]`) e um `eof` contado a partir do último
  `-file` do ficheiro principal.

## Importar formas

As formas devolvidas, e as entradas `.abstr` (posicionais ou nos `sources` do
projeto), tornam-se tokens localizados nas suas anotações e passam pelo
parser do Clause, pelo que recebem as mesmas verificações de sintaxe que o
código-fonte; a precedência dos operadores decide onde são acrescentados
parênteses. São aceites `{Line, Column}`, um `Line` simples (mostrado como
`file:line:`) e listas de propriedades com `location` e `file`; `generated`
é ignorado. Um atributo file muda o ficheiro das formas seguintes; quando esse
ficheiro existe, o código importado mantém as suas linhas de depuração e os
comentários de código-fonte. As formas mal formadas são erros na sua anotação
(`unknown expression bogus`, `expected {Name, Arity}`, `invalid annotation`)
e o módulo falha; as formas `{error, _}`/`{warning, _}` do OTP são
comunicadas com o seu descritor, cuja formatação precisa do OTP. Importar um
módulo exportado e exportá-lo de novo dá as mesmas formas.

## OTP do anfitrião

- O `erl` é procurado por esta ordem: `--erl PATH`, `erl` no `PATH` e depois,
  em Windows, `%ProgramFiles%\Erlang OTP\bin\erl.exe`. Não encontrar nenhum
  quando um módulo precisa de um transform é um erro que indica o transform e
  o módulo; não há alternativa que salte os transforms.
- O anfitrião tem de executar o OTP 29 (`erlang:system_info(otp_release)`);
  outra release é um erro.
- O [carregador](#loader) corre como `erl -noshell -noinput -pa Dir ... -eval ...`
  (diretórios do caminho de código tornados absolutos) com um limite de tempo
  de 600 s. O seu stdout e stderr (incluindo a saída `io:format` do
  transform) são copiados para o stderr do `clau` depois de terminar.
  Um carregador que sai sem escrever uma resposta, esgota o tempo ou não
  consegue arrancar é um erro.
- Um transform executa código arbitrário com os direitos do utilizador,
  exatamente como faria com o `erlc`.

## Carregador

`compiler/src/transforms/loader/clause_transform_loader.erl` pertence ao
projeto e está embutido no `clau`. Cada execução escreve-o, juntamente com o
pedido, num diretório temporário novo, `clause-transform-*` abaixo de
`<build_dir>/tmp` ([diretório de compilação](projects.md#build-directory))
ou, para entradas posicionais sem `--build-dir`, no diretório temporário do
sistema, removido após a execução; o `erl` compila e carrega o carregador em
memória. O pedido contém as formas, as opções, a lista de transforms, o nome
do ficheiro do módulo e os códigos-fonte de transforms do projeto a compilar.
Com um diretório de compilação, a resposta e a saída do carregador são
guardadas na [cache de compilação](projects.md#build-caches) e reutilizadas
enquanto o pedido e tudo aquilo de que depende se mantiverem inalterados; a
lista de módulos sticky do anfitrião é guardada da mesma forma. O carregador:

1. verifica a release do OTP;
2. compila em memória os códigos-fonte de transforms do projeto pedidos e
   carrega-os;
3. para cada transform: carrega-o, retira as colunas conforme
   `parse_transform_info/0` pedir, chama `parse_transform/2` e formata os
   avisos e os erros como `{File, Location, Text}` com
   `Module:format_error/1`;
4. escreve `{ok, Forms, Warnings}` ou `{error, Errors, Warnings}` e termina.

## Módulos de transform

Um módulo de transform é procurado por esta ordem:

1. **Ficheiros `.beam` pré-compilados** nos diretórios de
   `--transform-path DIR` (repetível) e da opção de projeto
   `transform_paths`, que entram no caminho de código do carregador antes dos
   do OTP. É a única forma de usar um transform que vem de uma biblioteca de
   dependência: compile primeiro essa biblioteca com o OTP do anfitrião (por
   exemplo `erlc -o deps/lib/ebin deps/lib/src/*.erl`); o Clause nunca compila
   dependências. O `.beam` tem de vir da release principal do OTP do
   anfitrião.
2. **Os códigos-fonte do projeto atual**: um `Module.erl` no lote ou nos seus
   `source_search_paths`, compilado pelo carregador em memória com os
   diretórios de include e as definições do alvo em cada execução,
   juntamente com os módulos do projeto que chama pelo nome (encontrados da
   mesma forma). A pesquisa ignora os códigos-fonte que `ignore_dirs` ou
   `ignore_modules` deixam de fora, tal como faz a
   [pesquisa de módulos](projects.md#ignored-sources). O Clause procura estes
   códigos-fonte uma vez por lote e mantém-nos em memória; o carregador
   continua a compilá-los para cada módulo em que o transform corre, pelo que
   convém pré-compilar um transform grande para poupar esse tempo.
   Os módulos que o anfitrião carrega dos seus diretórios sticky (`kernel`,
   `stdlib`, `compiler`, como `ms_transform` ou `qlc_pt` quando os fontes do
   OTP estão num caminho de pesquisa) não podem ser recarregados, pelo que são
   usados os próprios módulos do anfitrião: os seus códigos-fonte, e os
   módulos que só eles chamam, não são procurados nem compilados.
   O Clause pergunta ao `erl` do anfitrião por estes módulos uma vez por
   invocação.
3. **Os próprios módulos do OTP** (`ms_transform`, `qlc`) a partir do caminho
   de código do anfitrião. O OTP inclui `erl_id_trans` apenas como
   código-fonte de exemplo, não como módulo.
   Os seus cabeçalhos resolvem-se como qualquer `include_lib`
   ([pré-processador](preprocessor.md#compatibility-policies)): mapeie a
   aplicação, como em
   `--app-dir "stdlib=C:/Program Files/Erlang OTP/lib/stdlib-8.1"` para
   `include_lib("stdlib/include/ms_transform.hrl")`, ou indique o transform
   diretamente com `-compile({parse_transform, ms_transform})`.

Compilar um transform do projeto pode falhar onde a sua compilação real tem
sucesso: cabeçalhos de dependências, um transform do transform, ou macros que
só outra ferramenta de compilação define. O Clause comunica então as
mensagens do compilador em relação ao código-fonte do transform, com a
sugestão de o pré-compilar num `.beam` com o OTP do anfitrião e de passar o
seu diretório com `--transform-path`. Um transform do projeto também é
compilado pelo Clause como um módulo comum quando faz parte do lote; as suas
próprias chamadas (`erl_syntax`, `erl_parse`, ...) podem então precisar de
módulos de biblioteca que o Clause não inclui, pelo que convém manter os
transforms fora dos `sources` de um alvo quando só o transform precisa deles.

## Diagnósticos

| Situação | Mensagem |
| --- | --- |
| Sem OTP no anfitrião | `File: parse transform 'M' needs Erlang/OTP 29 on the host; pass --erl` |
| `--erl` não indica nenhum executável | `File: erl not found: PATH` |
| Release do OTP errada | `parse transforms need Erlang/OTP 29 on the host, found N` |
| Transform não encontrado | `File: undefined parse transform 'M'` (texto do OTP) |
| O transform lançou uma exceção | `File: error in parse transform 'M': ...` (texto do OTP) |
| Aviso ou erro do transform | `File:Line:Column: Text` tal como devolvido |
| O código-fonte do transform não compila | as suas mensagens e depois a sugestão de pré-compilação |
| Um caminho de transforms não existe | `File: parse transform path is not a directory: DIR` |
| Um `.beam` num caminho de transforms não carrega | `File: cannot load parse transform 'M' from PATH: Reason` |
| O carregador falhou, esgotou o tempo ou não escreveu resposta | `parse transform loader failed: ...` |
| Formas devolvidas inválidas | o diagnóstico do parser na localização da forma |

## Opções

| CLI | Projeto (`[targets.options]`) | Significado |
| --- | --- | --- |
| `--parse-transform M` | `parse_transforms = ["m"]` | Aplica `M` a todos os módulos, antes dos seus próprios transforms `-compile` (os da CLI primeiro) |
| `--transform-path DIR` | `transform_paths = ["deps/*/ebin"]` | Caminho de código para ficheiros `.beam` de transforms pré-compilados; padrões como em `source_search_paths` |
| `--erl PATH` ou `none` | — | Executável `erl` do anfitrião; `none` nunca executa código do anfitrião |
| `--print-abstr` | — | Imprime as formas depois dos transforms em vez de compilar |

Um projeto que usa o seu próprio transform e um pré-compilado de uma
dependência:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[targets.options]
source_search_paths = ["transforms"]  # transforms/pt_rewrite.erl, compiled for each build
parse_transforms = ["pt_dep"]         # applied to every module of the target
transform_paths = ["deps/*/ebin"]     # deps/ptdep/ebin/pt_dep.beam, built with erlc first
```

Mantenha os módulos de transform fora dos `sources` de um alvo quando o
programa não os chama: como módulos comuns, seriam também compilados pelo
Clause, e as suas chamadas a `erl_parse` ou `erl_syntax` precisam de módulos
que o Clause não inclui.
