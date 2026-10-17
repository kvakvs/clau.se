---
source: docs/semantic.md
sourceCommit: a8c3f8f6
sourceSha256: f1156b4ef9a29821e7a254cd605e1b92c22cf3304d574ae47f4d558a786f2c18
translatedAt: 2026-10-17
---
# Análise semântica

Executa-se depois da análise sintática na compilação por omissão e em
`--print-types`; as ações só de sintaxe saltam-na. Os erros param o lote
afetado antes do LLVM; os diagnósticos mantêm as origens de macros/includes, e
as entradas seguintes continuam a ser diagnosticadas.

## Verificações de módulos e chamadas

- A declaração de módulo é obrigatória e única; aridades de funções 0..255;
  sem definições duplicadas; cada exportação existe (uma exportação repetida
  gera um aviso, como no OTP). Os nomes entre aspas/Unicode mantêm a sua
  identidade exata.
- Todas as funções são verificadas, incluindo o código não usado e
  inalcançável.
- As chamadas resolvem-se dentro do lote por módulo/nome/aridade. As chamadas
  remotas (incluindo as qualificadas com o próprio módulo) exigem exportações.
  Funções chamadas em falta/privadas e módulos duplicados são erros.
- `fun F/A` tem de nomear uma função do módulo (`function F/A undefined`);
  `fun M:F/A` e as chamadas de valores (`F(Args)`) não são resolvidas em tempo
  de compilação ([funs](funs.md)). Cada valor fun distinto recebe uma entrada
  em `Module::funs` após a análise de vinculações.
- A recursão própria, mútua e entre módulos é aceite. O grafo de chamadas é
  dividido em componentes fortemente conexas (Tarjan iterativo) pela ordem
  chamado-antes-do-chamador; uma componente é recursiva quando tem vários
  membros ou um membro se chama a si próprio.

## Behaviours

Segue os
[behaviours](https://www.erlang.org/doc/system/design_principles.html#behaviours)
do OTP, `erl_internal:add_predefined_functions` e o `check_behaviour` do
`erl_lint`.

- Um módulo que declara `-callback` recebe a função predefinida e exportada do
  OTP `behaviour_info/1`: `callbacks` dá os callbacks declarados pela ordem do
  código-fonte, `optional_callbacks` os das listas `-optional_callbacks` bem
  formadas (os callbacks qualificados com um módulo ficam de fora). O frontend
  acrescenta-a como uma função na linha de `-module` (`driver/predefined`).
  Como no OTP, o próprio código-fonte do módulo não a pode nomear: um
  `-export`, uma chamada local, `fun behaviour_info/1` ou um `-spec` dela é
  uma função indefinida; as chamadas remotas (também as qualificadas com o
  próprio módulo) chegam a ela. `-callback` ao lado de um `behaviour_info/1`
  escrito à mão é um erro
  (`cannot define callback attibute for F/A when behaviour_info is defined`,
  com a grafia do OTP).
- `-behaviour(M)` e `-behavior(M)` podem repetir-se. `M` resolve-se no lote; um
  nome com um módulo de biblioteca (`library.md`) acrescenta esse módulo, tal
  como uma chamada literal. Os diagnósticos usam o texto do OTP no nome do
  atributo:
  - `undefined callback function F/A (behaviour 'M')` para cada callback
    obrigatório e não opcional que o módulo não exporta (ordenados);
  - `conflicting behaviours -- callback F/A required by both 'M2' and 'M1' (line
    L, column C)` quando um behaviour anterior também o exige (um callback
    opcional conta quando exportado);
  - `behaviour M undefined` quando `M` não está no lote ou não tem
    `behaviour_info/1` (os behaviours do OTP, como `gen_server`, não estão na
    [biblioteca](library.md) do Clause), mais os erros de nome de módulo do OTP
    para nomes que não podem ser módulos (`the module name must not be empty`,
    `... must be an atom`, ...).
- Os avisos não fazem falhar a compilação. As opções de `-compile`
  `nowarn_behaviours` (toda a verificação, incluindo os erros de nome de
  módulo), `nowarn_undefined_behaviour_func`, `nowarn_undefined_behaviour` e
  `nowarn_conflicting_behaviours` desativam-nos.
- Não avaliado: um `behaviour_info/1` exportado escrito à mão num módulo de
  behaviour, pelo que os callbacks dos seus utilizadores não são verificados, e
  os avisos do OTP sobre callbacks mal definidos e obsoletos nunca ocorrem
  ([diferenças](differences.md#errors-stack-traces-and-reports)).
- Evidência: `tests/fixtures/lint` (diagnósticos gerados pelo OTP, CTest
  `lint_diagnostics`), `executables_behaviours`, casos de CLI `semantic`.

## Imports

Segue as regras de importação do `erl_lint`.

- `-import(Module, [F/A, ...])` faz de uma chamada local `F(...)` a chamada
  remota `Module:F(...)`: o módulo tem de estar no lote (um módulo de
  biblioteca junta-se a ele como numa chamada literal) e exportar a função, ou
  ser um módulo de builtins (`-import(io, [format/2])`,
  `-import(erlang, [display/1])`). Uma importação tem precedência sobre uma BIF
  auto-importada com o mesmo nome.
- Erros com o texto do OTP: `function F/A already imported from M` (todo o
  atributo é então ignorado), `defining imported function F/A`,
  `creating a fun from imported name F/A is not allowed`. Uma função importada
  numa guard é uma chamada ilegal numa guard (exceto as guard BIFs de erlang).
- Aviso `import directive overrides auto-imported BIF F/A -- ...` a menos que
  `no_auto_import` a nomeie ou seja dado `nowarn_bif_clash`; o Clause conhece
  as BIFs auto-importadas que implementa.
- Evidência: `executables_imports`, casos de lint `imports_conflicts`,
  `imports_fun`, `imports_bif`, casos de CLI semânticos.

## Funções predefinidas

Segue os [módulos](https://www.erlang.org/doc/system/modules.html) do OTP e
`erl_internal:add_predefined_functions`. O frontend acrescenta
`module_info/0,1` a cada módulo compilado (depois de um `behaviour_info/1`
gerado) como funções Erlang que devolvem dados literais (`driver/predefined`,
`semantic/module_info`); `Module::predefined_` conta estas formas finais, que
são sempre exportadas e ficam fora de `--print-types`.

- `module_info()` dá
  `[{module,_},{exports,_},{attributes,_},{compile,_},{md5,_}]`;
  `module_info(Key)` responde também a `functions`, `nifs` (`[]`) e `native`
  (`false`), e lança `badarg` para qualquer outra chave.
- `exports`: as funções exportadas pela ordem de definição (os escripts
  acrescentam `main/1`), depois `behaviour_info/1` quando gerada,
  `module_info/0`, `module_info/1`. `functions`: todas as funções pela ordem de
  definição, depois as mesmas predefinidas.
- `attributes`: todos os atributos exceto `module`, exportações e importações,
  formas type/spec/callback, records, `export_type`, `optional_callbacks`,
  `export_record`, `compile`, `file`, documentação e `feature`, pela ordem do
  código-fonte; um valor que não seja uma lista é envolvido numa
  (`-tags(a)` é `{tags,[a]}`). Sem `-vsn`, `{vsn,[N]}` vem primeiro, sendo `N`
  o `md5` lido como um inteiro big-endian sem sinal, tal como o OTP o deriva.
- `md5`: MD5 do código-fonte impresso do módulo (`print_source`: macros
  expandidas, includes incorporados, comentários e disposição removidos).
  `compile`: `[{version,ClauseVersion},{options,[]},{source,AbsolutePath}]`.
- Ao contrário de `behaviour_info/1`, o próprio código-fonte do módulo vê-as:
  as chamadas locais e `fun module_info/1` funcionam. Definir qualquer uma
  delas é um erro (`function module_info/0 already defined`); exportar uma,
  como qualquer exportação repetida, só gera um aviso
  (`function module_info/0 already exported`).
- Os atributos são dados; apenas `on_load`, `nifs` e as opções `-compile` não
  inertes são rejeitados por alterarem o comportamento.
- As funções geradas não têm linha de código-fonte (o OTP não lhes dá
  nenhuma): sem localizações de depuração, comentários de código-fonte na IR
  nem entradas em `--print-types`. `module_info/0` contém os mesmos literais
  que `module_info/1`, pelo que não faz chamadas.
- Evidência: `executables_module_info` (stdout do OTP; valores derivados pela
  forma), casos de `tests/fixtures/lint` `module_info_defined`,
  `exports_repeated`.

## Vinculações

Cada vinculação tem uma identidade relativa à função `clause[N].local[M]`. As
ocorrências são definições, leituras ou verificações de igualdade exata,
etiquetadas com o contexto cabeça/guard/corpo. A análise é determinística.

- Cada cláusula começa a partir de um ambiente vazio. Os candidatos da cabeça
  recolhem definições provisórias; as guards leem-nas; o corpo só as vê em caso
  de sucesso.
- `_` não vincula nada; `_Name` é uma variável comum. Um nome repetido é uma
  restrição de igualdade exata.
- As correspondências no corpo visitam o lado direito antes do esquerdo; as
  cadeias são da direita para a esquerda. Um padrão entre parênteses
  `P1 = P2` é um alias, não uma sequência.
- As expressões irmãs leem os mesmos nomes de entrada; as suas definições são
  exportadas depois de toda a expressão. `{X = 1, X}` é uma leitura não
  vinculada; `{X = 4, X = 3}` é legal e falha em tempo de execução.
- As definições no lado direito de `andalso`/`orelse` ou dentro de
  `catch Expr` são inseguras depois (OTP `vtunsafe`); os nomes vinculados
  antes de um `catch` continuam utilizáveis. Todos os nomes vinculados dentro
  de um `try` são inseguros depois; as cláusulas `of` veem os nomes do corpo,
  as cláusulas catch veem-nos como inseguros, e o corpo after vê como inseguros
  todos os nomes vinculados antes no try. A variável de pilha de uma cláusula
  catch tem de ser nova (OTP `stacktrace_bound`) e a sua guard não a pode ler
  (`stacktrace_guard`). Um `maybe` não exporta nada: cada `?=` vincula para as
  expressões seguintes do corpo, as cláusulas `else` veem os nomes do corpo
  como inseguros e todos os nomes vinculados dentro são inseguros depois. As
  guards nunca publicam vinculações; as correspondências em guards são erros,
  mesmo quando inalcançáveis.
- As chaves de maps leem apenas vinculações de entrada; os tamanhos de binaries
  leem também segmentos anteriores do mesmo binary (ver
  [padrões](patterns.md#scopes)).
- O valor examinado (scrutinee) de um `case` vincula no âmbito envolvente.
  Cada cláusula começa a partir desse âmbito; as definições do seu padrão são
  provisórias até à guard, que apenas lê. Os nomes vinculados por todas as
  cláusulas são exportados com uma identidade (as cláusulas posteriores
  reutilizam a identidade que uma cláusula anterior deu ao nome); os nomes
  vinculados apenas por algumas cláusulas, ou inseguros em alguma, são
  inseguros depois. As exportações juntam-se de forma conservadora como no
  `erl_lint` do OTP (`icrt_export`); o aviso do OTP quando um padrão posterior
  corresponde a um nome exportado não é emitido. As cláusulas `if` seguem as
  mesmas regras, com uma guard e sem padrão.
- `begin`/`end` é uma sequência no âmbito envolvente.
- As leituras não vinculadas, inseguras e de curinga são erros localizados. As
  mensagens mantêm a formulação do compilador (`unbound variable X`,
  `unsafe variable X`); o corpus de vinculações verifica cada uma em relação à
  classe `unbound_var`/`unsafe_var` do OTP.
- Uma comprehension avalia cada qualificador por ordem, no âmbito deixado
  pelos anteriores. Os padrões dos geradores vinculam nomes novos que ocultam
  os exteriores (as leituras dentro do padrão preferem os nomes que este já
  vinculou); um grupo zip vincula todos os seus padrões em conjunto. Os modelos
  leem como irmãos. O âmbito depois da comprehension é o de antes dela: os seus
  nomes não estão vinculados aí.
- As cláusulas de uma fun anónima começam cada uma a partir do âmbito na fun:
  os nomes da cabeça são novos e ocultam os exteriores, as guards leem-nos, e
  nada vinculado dentro é visível depois da fun. Cada definição exterior lida
  dentro é registada como uma captura (`Function::captures`, ordem de
  definição). O nome de uma fun com nome é mais uma definição com que cada
  cláusula começa (`Function::fun_names`); nunca é capturado. As variáveis de
  `fun M:F/A` são leituras da expressão fun (`Function::fun_operands`).

Os percursos são iterativos, com um orçamento por módulo de 1 000 000 unidades
de trabalho, ou 32 por expressão quando isso for mais (os parsers gerados, como
o `erl_parse` do OTP, precisam de cerca de 10 por expressão). A resolução de
serviços tem um orçamento do mesmo tamanho; percorre as formas `-compile` e
`-import` do módulo para o estado de auto-importação de um nome uma vez por
nome, não uma vez por chamada (cada uma dos milhares de cláusulas do
`erl_parse` chama `hd/1`). O esgotamento ou qualquer erro semântico limpa as
tabelas de vinculações e de normalização do módulo.

## Tipos e especificações

Um grafo de tipos privado representa todas as formas de tipo analisadas,
independentemente da disposição no runtime: singletons, intervalos,
contentores, papéis dos campos de maps, produtos de funções e aplicações não
resolvidas. As uniões são achatadas e sem duplicados; `term()` é o topo e
`none()` o fundo. Valores por omissão: 1 048 576 nós, 256 membros por união,
200 000 itens de trabalho por percurso de um tipo declarado (resolução,
tradução, expansão) e 8 000 000 por passagem de inferência sobre todo o
programa; uma compilação debug de `clau` (sem `NDEBUG`) permite 16 000 e
1 000 000, para que os programas grandes continuem a compilar depressa, e pode
alargar mais. O esgotamento alarga para `term()` com uma flag visível e nunca
estreita uma representação.

Os metadados declarados (`-type`, `-opaque`, `-nominal`, `-export_type`,
`-spec`, `-callback`, `-optional_callbacks`) seguem a referência de typespecs
do OTP e o comportamento fixado de `erl_lint`/`erl_internal`/`erl_types`:

- Os aliases locais podem ocultar nomes de tipos builtin. Os tipos remotos do
  lote têm de ser exportados. Tipos em falta, duplicados, metadados
  malformados, variáveis de tipo singleton, limites inválidos e specs de
  funções em falta são erros. Os tipos externos indisponíveis geram um aviso e
  tornam-se `term()`.
- Cada alias ou sobrecarga tem o seu próprio âmbito de variáveis; os
  parâmetros formais repetidos seguem a substituição pelo último argumento do
  OTP.
- Os aliases recursivos mantêm-se referências nomeadas finitas; os corpos
  opacos só se expandem no seu módulo; os nomes nominais mantêm-se em todo o
  lado, e só a verificação de especificações lê a definição de um tipo
  nominal, dentro do seu módulo.
- A avaliação de constantes é exata, limitada a 10 000 dígitos decimais por
  valor.

## Inferência

A inferência é separada dos tipos declarados e nunca confia nas specs.

- As entradas exportadas, e as entradas das funções que `fun F/A` nomeia, são
  termos arbitrários. Uma função em que só se entra por chamadas diretas do
  lote (nem exportada nem nomeada por uma fun) toma como entradas a junção
  (join) dos factos dos argumentos dos seus locais de chamada
  (`semantic/types/inference_inputs`), correspondidos pelos padrões da cabeça
  de cada cláusula; as chamadas recursivas também contam. As entradas começam
  em `none()` (uma função que nada chama nunca executa e infere `none()`) e
  crescem ao longo das passagens pelo lote: 8 passagens juntam, as seguintes
  alargam como os resultados recursivos; as entradas que não estabilizaram
  após 16 passagens tornam-se `term()` (relatadas como alargadas).
- Os literais têm factos exatos: os inteiros de qualquer tamanho e os
  caracteres são singletons, os átomos átomos singleton, os floats `float()`,
  as strings listas não vazias dos seus caracteres (`[]` para `""`), e `-`/`+`
  de um número literal mantêm o seu facto. Os tuplos mantêm os factos dos seus
  elementos; os maps construídos com chaves constantes (um facto de um único
  valor: um inteiro, um átomo, `[]`, ou um tuplo ou map destes) mantêm o facto
  do valor de cada chave, mantendo uma chave dada duas vezes o seu último
  valor, e qualquer outra chave dá `map()`. A construção de um bitstring conta
  o seu tamanho: caracteres literais, com tamanho e literais codificados em UTF
  exatamente, um segmento UTF de outro valor pela sua codificação (UTF-8: 8 a
  32 bits por bytes), e um segmento `binary`/`bitstring` pelo facto do seu
  valor ou por qualquer múltiplo da sua unidade (`<<1, Rest/binary>>` é
  `nonempty_binary()`). Um operando que nunca produz um valor (`none()`) torna
  a construção `none()`.
- Os operadores e os builtins (`semantic/types/inference_operators`) calculam
  o seu resultado a partir dos factos dos seus operandos. Os singletons
  inteiros são dobrados (folding) exatamente até 4 096 bits por operando e
  resultado (incluindo bignums; um maior é `integer()`); os outros inteiros
  usam aritmética de intervalos para `+`, `-`, `*` de intervalos não
  negativos, `band` com um operando não negativo (`X band 15` é `0..15`),
  `rem` por um divisor limitado (`X rem 10` é `-9..9`), `bnot`, `-` unário e
  `abs/1`; um operando float dá `float()`, um desconhecido `number()`, e `/` é
  sempre `float()`. As comparações são dobradas quando os valores dos
  operandos só se podem comparar de uma forma (átomos ou inteiros singleton,
  intervalos inteiros disjuntos, números contra não números) e são
  `boolean()` caso contrário; `and`/`or`/`xor`/`not` e `andalso`/`orelse`
  combinam os valores de verdade que os seus operandos podem ter (o operando
  direito de `andalso` é o resultado quando o esquerdo é `true`). Uma tabela dá
  a cada builtin da ponte o seu resultado: `pid()` para `self/0` e
  `spawn/1,3`, `reference()`, `port()`, `non_neg_integer()` para tamanhos,
  `string()`, `nonempty_string()`, `binary()`, `list()`, `tuple()`, `atom()`,
  `boolean()` para os testes de tipo, `true`/`ok` para os builtins com efeitos
  secundários, a mensagem para `!` e `send/2`; `trunc/1` e afins mantêm os
  operandos inteiros; os builtins desconhecidos são `term()`. Uma operação que
  lança sempre (`1 + a`, `1 div 0`, `error/1`, `exit/1`, `throw/1`,
  `halt/0,1`) é `none()`, e `erlang:raise/3` devolve apenas `badarg`. O
  folding nunca altera o código gerado: o overflow e as falhas continuam a ser
  resultados de runtime.
- Um corpo cuja expressão nunca termina (`none()`) é `none()`; o mesmo
  acontece com uma chamada com um argumento desses. Os caminhos que lançam não
  acrescentam nada a uma junção, pelo que uma função que lança sempre infere
  `none()`.
- As funções de identidade/projeção mantêm relações exatas com os argumentos,
  propagadas através de chamadas locais e remotas aninhadas com variáveis novas
  por chamada.
- Contentores (`semantic/types/inference_containers`): uma lista
  `[E1, ..., En | T]` junta os seus elementos à frente do facto da cauda (uma
  lista própria quando a cauda o é, `nonempty_improper_list(H, T)` quando não
  é lista, `nonempty_maybe_improper_list()` quando é desconhecida ou pode ser
  imprópria: uma célula nunca é vazia, também num padrão como `[H | _]`);
  `++`, `--`, `hd/1`, `tl/1`, `element/2`, `setelement/3`, `tuple_to_list/1` e
  `map_get/2` leem e reconstroem os factos dos elementos membro a membro de uma
  união, sendo que um membro que lançaria não acrescenta nada. Uma atualização
  de map mantém as chaves exatas (`:=` de uma chave em falta remove esse
  membro) e dá `map()` de um map desconhecido. Os records em tuplo são tuplos:
  a construção preenche os valores por omissão (`undefined` sem nenhum), o
  acesso e a atualização leem e definem o campo dos tuplos correspondentes, e
  `#r.f` é o índice do campo. Uma list comprehension é uma lista possivelmente
  vazia dos factos dos seus modelos, uma binary comprehension um número
  qualquer de cópias do tamanho do seu modelo, uma map comprehension `map()`.
- Funs (`semantic/types/inference_funs`): `fun F/A` é uma fun da sua aridade
  que devolve o resultado inferido da função (o de um builtin ou, com uma
  aridade variável, `fun()`), `fun M:F/A` uma que devolve `term()`, e uma fun
  anónima uma que devolve os resultados juntos das suas cláusulas, incluindo
  os valores capturados. Uma chamada de um valor junta os resultados das suas
  funs dessa aridade que os seus argumentos selecionam (`term()` para uma fun
  desconhecida, `none()` quando nenhum membro pode ser chamado assim). Uma fun
  anónima vinculada inteira a uma variável e chamada através dela é avaliada
  de novo para essa chamada, com os seus padrões a corresponder aos factos dos
  argumentos, no máximo com 4 dessas chamadas de profundidade, e os factos da
  sua primeira avaliação são repostos depois
  (`Double = fun(Y) -> Y * 2 end, Double(3)` é 6). `apply(F, Args)` (também
  `erlang:apply/2`) é uma chamada de `F` com os argumentos que `Args` contém:
  os elementos de uma lista própria literal, caso contrário os do seu facto
  (`[]`, uma lista de posições conhecidas, ou tantas cópias do elemento de uma
  lista própria quantas a única aridade de `F` recebe); uma fun anónima
  vinculada é avaliada de novo como acima (`apply(fun kind/1, [1])` seleciona
  `kind(1)`). `apply(M, F, Args)` cujos `M` e `F` são átomos conhecidos que
  nomeiam uma função exportada do lote lê os tipos de função dessa função como
  `fun F/A`. Os argumentos de comprimento desconhecido, os outros alvos e
  `M:F(Args)` com nomes variáveis ficam `term()`. Como `fun F/A` e `apply/3`
  podem nomear uma função inferida mais tarde, as passagens pelo lote também
  se repetem até que cada uma dessas leituras tenha visto o resultado final da
  sua função; caso contrário, uma última passagem dá-lhes resultados `term()`.
- As atribuições de valor completo no corpo e os aliases copiam o facto do
  lado direito (`Y = 42, Z = Y, id(Z)` infere 42); os padrões de tuplo, lista,
  map e record em tuplo dão às suas variáveis os factos das partes a que
  correspondem, nas correspondências no corpo, nas cláusulas `case` (a partir
  do valor examinado), nas cláusulas `of` de um `try` (a partir do valor do seu
  corpo) e nos geradores (a partir dos elementos da sua entrada ou das chaves e
  valores de maps). Os valores não provados ficam `term()` sem relações.
- Estreitamento (narrowing) (`semantic/types/inference_narrowing`,
  `inference_scopes`, `meet`): dentro de uma cláusula de função, `case`,
  `receive` ou fun, cada padrão interseta (meet) o valor a que corresponde
  (uma forma literal, de tuplo, lista, record em tuplo, map ou bitstring; o
  facto de uma variável vinculada), uma variável examinada por um `case`
  estreita-se com ele, e a guard estreita as variáveis que testa. Os testes de
  tipo (`is_atom/1` para `atom()`, `is_boolean/1`, `is_integer/1`,
  `is_float/1`, `is_number/1`, `is_binary/1`, `is_bitstring/1`, `is_list/1`
  para `maybe_improper_list()`, `is_tuple/1`, `is_map/1`, `is_function/1,2`,
  `is_pid/1`, `is_port/1`, `is_reference/1`, `is_record/2,3` para o tuplo do
  record, `is_map_key/2` o seu map para `map()`, e os nomes antigos de guards)
  intersetam o facto do seu argumento; as comparações com constantes inteiras
  (`<`, `=<`, `>`, `>=`, `==`, `=:=`, em qualquer dos lados, incluindo
  constantes dobradas) estreitam um valor já provado como inteiro para um
  intervalo, acumulando-se os limites de um mesmo teste (`10 >= X, X >= 0` é
  `0..10`); dois inteiros provados comparados estreitam-se mutuamente pelos
  seus limites (`X > Y` com `Y` em `0..5` torna `X` pelo menos 1), e `/=`,
  `=/=` com uma constante movem para dentro um limite do intervalo igual a
  ela. Um valor que possa ser um float ou outro termo não é estreitado. Uma
  conjunção aplica cada teste à vez, uma disjunção junta o que cada
  alternativa prova, `not` e os testes falsos não provam nada. Uma cláusula a
  seguir a outra cujos padrões são todos variáveis simples e cuja guard
  inteira era um único teste de tipo vê esse valor sem a categoria testada;
  depois de uma única comparação com uma constante inteira, o mesmo valor (uma
  variável simples desta cláusula) provado como inteiro vê a comparação como
  falsa (`f(N) when N >= 0 -> ...; f(N) when is_integer(N) -> ...`: a segunda
  cláusula vê `neg_integer()`). O operando direito de `andalso`, a cláusula
  `true` de `case Test of` e o que se segue a um filtro de comprehension veem
  o teste como verdadeiro. Uma interseção vazia torna a cláusula impossível:
  não acrescenta nada ao resultado. Os factos estreitados só valem dentro da
  sua cláusula ou operando; `catch`, o operando direito de `orelse` e cada
  cláusula repõem os factos de antes deles. Após um `case`, `if`, `receive`,
  `try` ou `maybe`, o facto de uma variável é a junção dos seus factos no fim
  de cada cláusula que termina, pelo que
  `case X of forever -> ...; N when is_integer(N), N >= 0 -> ... end` deixa `X`
  como `non_neg_integer() | forever`.
- `try` e `maybe`: um `try` é a junção dos valores das suas cláusulas `of`
  (dos do seu corpo, sem `of`) e dos valores das suas cláusulas catch; o corpo
  `after` não acrescenta nada. As cláusulas `of` começam a partir dos factos no
  fim do corpo e correspondem ao seu valor como as cláusulas `case` (uma
  cláusula impossível não acrescenta nada); as cláusulas catch e o corpo
  `after` começam a partir dos factos antes do `try`, com um padrão de classe
  a corresponder a `error | exit | throw`. Um `maybe` é a junção do valor do
  seu corpo, dos valores das suas cláusulas `else` e, sem `else`, dos valores
  em que as suas correspondências `?=` podem falhar: o facto do valor
  correspondido sem a forma do padrão, quando o padrão corresponde a toda a sua
  forma (variáveis novas usadas uma vez, átomos e inteiros literais, `[]`,
  tuplos destes), caso contrário o facto completo. Cada padrão `?=` interseta o
  seu valor e publica as suas variáveis para o resto do corpo; um `?=` que
  nunca pode corresponder para o corpo. As cláusulas `else` começam a partir
  dos factos antes do `maybe` e correspondem aos valores de falha juntos como
  as cláusulas `case`. Os factos após um `try` juntam os do fim do seu corpo
  (sem `of`) e de cada cláusula que termina; após um `maybe`, os do fim do seu
  corpo, de cada cláusula `else` que termina e, sem `else`, os de antes dele.
- Usos (`semantic/types/inference_uses`): uma operação que lança a menos que
  um operando tenha um tipo prova esse tipo para a variável que leu, depois de
  a operação regressar: a aritmética e `-`/`+` unários um `number()`, `div`,
  `rem`, os operadores de bits e `bnot` um `integer()`, `and`/`or`/`xor`, `not`
  e o operando esquerdo de `andalso`/`orelse` um `boolean()`, `++` e `--` uma
  `list()`, um valor chamado uma fun dessa aridade, um nome variável de módulo
  ou de função um `atom()`, uma atualização de map `map()`, um acesso ou
  atualização de record em tuplo o tuplo do record, um segmento de binary o
  seu tipo (`<<X:8>>`: `integer()`) e o seu tamanho um `non_neg_integer()`, e
  uma linha por cada verificação de argumento de um builtin da ponte (`hd/1`,
  `tl/1` `nonempty_maybe_improper_list()`, `length/1` `list()`, `element/2`
  `pos_integer()` e `tuple()`, `map_get/2` e `is_map_key/2` `map()`,
  `atom_to_list/1` `atom()`, ...). A operação mantém a sua verificação em
  runtime. Os nomes vinculados ao mesmo valor (`Y = X`, um padrão `case`
  variável sobre um valor examinado variável) estreitam-se em conjunto.
- Domínios de entrada e de sucesso: o domínio de entrada de cada argumento é a
  junção, sobre as cláusulas de função possíveis, do seu facto após a cabeça e
  a guard (o facto estreitado de uma variável simples, caso contrário o do
  padrão); o seu domínio de sucesso, a junção, sobre as cláusulas que
  terminam, do seu facto no seu retorno normal. `--print-types` mostra o
  domínio de sucesso como as entradas (`bounded(1..10) -> 1..10`,
  `inc(X) -> X + 1` como `inc(number()) -> number()`), ou o domínio de entrada
  de uma função que nunca regressa. Uma chamada que regressa estreita os seus
  argumentos variáveis para o domínio da função chamada, exceto dentro de uma
  componente recursiva ainda em resolução.
- Os resultados das cláusulas juntam-se de forma conservadora: uma projeção só
  sobrevive se todas as cláusulas devolverem o mesmo argumento. Um `case` ou
  `if` junta os resultados das suas cláusulas da mesma forma.
- Tipos de função (`semantic/types/function_types`): além do resumo em união
  acima, uma função mantém um tipo de função por cada cláusula possível, como
  as sobrecargas de um `-spec`: os factos dos argumentos após a cabeça e a
  guard (o facto estreitado de uma variável simples, caso contrário o do
  padrão) e o resultado da cláusula (`none()` para uma cláusula que lança
  sempre; as cláusulas impossíveis não acrescentam nenhum). Uma cláusula cujo
  resultado é um [facto dependente](#dependent-facts) dos seus argumentos (um
  `case` ou `if` que a termina, ou uma variável vinculada a um deles, aninhados
  a qualquer profundidade) divide-se num tipo de função por cada cláusula desse
  facto, intersetando os factos dos seus parâmetros com os argumentos que
  nomeiam. Os tipos de função com entradas iguais fundem-se (os seus
  resultados juntam-se); além de 32, os últimos fundem-se num só, com entradas
  e resultados juntos. As componentes recursivas iteram-nos com os resultados,
  juntando (e depois alargando) em cada ronda o resultado de cada tipo; uma
  componente que não converge mantém apenas os seus resumos em união. O facto
  de uma fun anónima mantém um tipo de função por cada cláusula possível (os
  seus padrões e guard sobre qualquer argumento), `fun F/A` os tipos de função
  de `F/A`; as funs que se juntam só mantêm os seus tipos de função quando são
  iguais, caso contrário juntam-se como uma fun dos seus resultados juntos com
  quaisquer entradas (intersetar com uma fun de quaisquer entradas, como faz o
  uso `F(A)`, mantém-nos). A especialização, os domínios e as verificações de
  especificações leem o resumo em união.
- As chamadas selecionam tipos de função: uma chamada de uma função com tipos
  de função lê, por ordem, cada tipo cujas entradas todos os factos dos
  argumentos intersetam, e para depois de um exato (padrões de variáveis novas
  usadas uma vez, átomos e inteiros literais, `[]` e tuplos destes; sem guard
  ou apenas `true` e testes de tipo de variáveis simples de argumentos; para um
  ramo, um argumento como valor examinado do `case`) cujas entradas contêm os
  argumentos: nenhuma cláusula posterior pode ser alcançada. O seu resultado é
  a junção dos resultados dos tipos selecionados, sendo um resultado igual a
  um argumento o facto desse argumento dentro do resultado do tipo; se nenhum
  for selecionado, a chamada é `none()` (só pode lançar `function_clause`). Os
  argumentos desconhecidos selecionam todos os tipos, a união; uma função sem
  tipos de função (orçamento, componente não convergida) usa o seu resumo em
  união. Depois de uma chamada regressar, os seus argumentos variáveis
  estreitam-se para o domínio de sucesso e para as entradas juntas dos tipos
  selecionados. As chamadas de valores fun selecionam os tipos de função do
  facto da fun da mesma forma, e uma fun anónima avaliada de novo para uma
  chamada (ver Funs) entra, avalia as guards e sai das suas cláusulas como um
  `case`, pelo que uma cláusula a que os seus argumentos não podem corresponder
  não acrescenta nada (`F = fun(1) -> one; (_) -> other end, F(2)` é
  `other`). As componentes recursivas convergem nos resultados e nos tipos de
  função.
- As chamadas avaliam de novo a função chamada: quando os factos dos
  argumentos de uma chamada estão dentro das entradas da função chamada e são
  mais estreitos numa delas, o corpo da função chamada é avaliado de novo com
  eles como entradas, como uma fun anónima vinculada, e o resultado da chamada
  é o resultado dos tipos de função selecionados intersetado com o dessa
  avaliação (`two_callers() -> {add_one(10), add_one(20)}` é `{11, 21}`); os
  argumentos da chamada também se estreitam para o domínio de sucesso dessa
  avaliação. O resumo, os tipos de função e os factos de expressões registados
  da função chamada nunca mudam (a especialização só lê esses). Orçamentos: 4
  avaliações aninhadas, funções chamadas de no máximo 256 expressões, 4 096
  unidades de trabalho por chamada a partir de uma reserva de 262 144 por
  passagem pelo lote (separada do orçamento do próprio lote); as componentes
  recursivas nunca são avaliadas de novo. Ultrapassado um orçamento, a chamada
  mantém o resultado dos tipos de função selecionados.
- Um `receive` é a junção das suas cláusulas e do seu corpo `after`, que um
  tempo limite `infinity` nunca executa.
- Uma componente recursiva começa o resultado de cada membro em `none()` e
  volta a inferir todos os membros até que nenhum resultado mude; cada ronda
  junta o novo resultado com o anterior (alarga-o após as primeiras 8 rondas,
  [domínio de inferência](#inference-domain)), e uma chamada recursiva
  pendente não acrescenta nada a uma junção. Uma função que nunca pode
  regressar fica `none()`. Uma componente que não convergiu após 8 rondas mais
  4 por membro, ou cujas rondas gastaram mais de um oitavo do orçamento da
  passagem, alarga todos os membros para `term()` (relatados como alargados,
  como no esgotamento do orçamento) e uma ronda final recalcula os factos das
  expressões; os factos de expressões das rondas anteriores são descartados,
  pelo que só restam os factos das suposições finais. Uma componente assim é
  memorizada: as passagens seguintes dão de imediato `term()` aos seus membros
  e executam apenas essa ronda final, em vez de iterarem de novo até ao
  limite. A passagem que alarga todas as entradas para `term()` esquece as
  componentes memorizadas, pelo que cada uma recebe mais uma resolução com
  essas entradas.
- As rondas nunca encolhem o resumo de um membro: os seus tipos de função
  juntam-se com os da ronda anterior tipo a tipo (os resultados juntam-se, as
  entradas alteradas juntam-se e o tipo deixa de ser exato), ou, quando o
  número de tipos mudou, os tipos de ambas as rondas fundem-se. Como rede de
  segurança, cada membro guarda os seus últimos 4 resumos, e um que regresse a
  qualquer deles fica `term()` sem tipos de função durante o resto da
  resolução, o que permite aos outros membros convergir.
- Uma ronda só percorre os membros que leem um resumo alterado desde o seu
  último percurso: cada percurso regista os resumos que lê (chamadas,
  resultados de chamadas, `fun F/A`), um resumo alterado marca os seus
  leitores, e um membro não marcado mantém os seus factos de expressões. A
  primeira ronda percorre todos os membros.
- Um orçamento de trabalho partilhado limita a inferência; o esgotamento perde
  precisão e recorre a código genérico, nunca rejeita um programa.
- As especificações que contradizem a inferência são diagnosticadas
  (`semantic/types/contracts`), mas nunca se tornam factos, pelo que o
  programa se comporta como o seu código diz em qualquer caso. Um tipo
  declarado torna-se os factos que contém (ou mais): os tipos built-in pelo
  nome (`byte()` é `0..255`, `timeout()` é `non_neg_integer() | infinity`,
  `iodata()` e `iolist()` listas de qualquer forma), os aliases pela sua
  definição, os tipos opacos e nominais pela sua definição dentro do seu módulo
  e como qualquer termo fora dele, os tipos remotos através do lote, as
  variáveis de tipo através dos seus limites `when` (sem restrições: qualquer
  termo), os maps e os records pela sua categoria. Só um par disjunto
  contradiz, já que os factos inferidos podem conter mais valores do que o
  código produz:
  - um domínio de entrada de um argumento que não partilha nenhum valor com a
    spec é um erro;
  - um resultado inferido que não partilha nenhum (a menos que seja
    desconhecido ou `none()`, que se ajusta a qualquer resultado), ou uma
    chamada cujos factos dos argumentos todas as sobrecargas rejeitam, é um
    aviso (a chamada pode estar num caminho que nunca executa);
  - `none()`/`no_return()` só admite uma função que nunca regressa.

  O diagnóstico nomeia a função, o tipo declarado tal como escrito e o
  inferido. As especificações `-callback` não são verificadas. O compilador do
  OTP não verifica especificações
  ([diferenças](differences.md#language-edge-cases)).

### Factos dependentes

`semantic/types/dependent`. Um `case`, `if` ou `try ... of` comporta-se como
uma fun das variáveis que as suas cláusulas estreitam, aplicada a elas: o seu
valor é um facto dependente, um tipo de função por cada cláusula possível.

- Parâmetros: as variáveis vinculadas antes da construção que o seu valor
  examinado (a última expressão do corpo de um `try`) e as suas guards leem,
  pela ordem do código-fonte (as variáveis que os padrões das suas cláusulas
  vinculam são novas em cada cláusula, não parâmetros); no máximo 4, sendo
  esquecido o estreitamento de uma posterior. Cada cláusula possível mantém os
  factos dos parâmetros após o seu padrão e guard e o seu valor (`none()` para
  uma cláusula que nunca termina); é exata, como um tipo de função na seleção
  de chamadas, quando um `case` ou `try` corresponde a um parâmetro ou a um
  tuplo de parâmetros com um padrão e guard exatos, ou um `if` tem uma guard
  exata.
- Um valor examinado que é um tuplo de variáveis estreita cada variável para o
  seu elemento do valor correspondido, e a variável de um padrão de tuplo é
  vinculada ao mesmo valor que o elemento do valor examinado na sua posição
  (`case {X, Y} of {A, b} when is_integer(A) -> ...` estreita `X` e `Y`).
- Um `try ... of` depende das suas cláusulas `of`; as suas cláusulas catch
  podem seguir qualquer valor do seu corpo, pelo que os seus valores juntos se
  juntam ao valor de cada cláusula
  (`try X of 1 -> one; _ -> other catch _:_ -> error end` é
  `$try_of_operator(X :: 1) -> error | one; (X :: _) -> error | other`).
- `receive` e `maybe ... else` continuam a ser a junção das suas cláusulas: as
  suas cláusulas correspondem a uma mensagem ou a um valor `?=` falhado que
  nada fora delas pode nomear, pelo que nenhuma leitura poderia selecionar
  entre elas.
- Uma cláusula cujo valor é ele próprio dependente (um `case` ou `if`
  aninhado, ou uma leitura de uma variável dependente) contribui com um tipo de
  função por cada cláusula dele sobre a união de ambas as listas de
  parâmetros, com as entradas intersetadas. Os tipos em que nunca se pode
  entrar (uma entrada `none()`, ou dentro das entradas de um tipo exato
  anterior) são descartados, tal como os parâmetros cujos factos são os mesmos
  em todos os tipos; as entradas iguais fundem-se e, além de 32 tipos, os
  últimos fundem-se, como nos tipos de função. Uma construção cujos tipos
  restantes dão todos o mesmo valor, ou que não estreita nenhum parâmetro, é a
  sua junção simples.
- Todos os outros consumidores leem o facto apagado, a junção dos valores das
  cláusulas. Os factos que saem da função percorrida (resultados, tipos de
  função, factos de funs) são apagados; as junções só mantêm uma dependência
  quando ambos os lados têm a mesma.
- Uma variável vinculada a um valor dependente mantém-no. Ler a variável
  seleciona as cláusulas em que os factos atuais dos seus parâmetros entram
  (pela ordem da seleção de chamadas, uma cláusula exata cujas entradas os
  contêm para) e cujos valores intersetam o próprio facto estreitado da
  variável, e o facto da leitura é a junção dos seus valores
  (`Y = case X of 1 -> one; _ -> other end, case X of 1 -> Y end` lê `one`).
- Uma variável que todas as cláusulas de um `case` ou `if` vinculam é a junção
  dos seus factos no fim das cláusulas que terminam, dependente dos parâmetros
  da construção como o seu valor: `case X of 1 -> Y = 5; _ -> Y = 6 end, Y`
  infere `(1) -> 5; (_) -> 6`. A mesma junção aplica-se depois de `receive`,
  `try` e `maybe`, sem dependência.
- Os operadores, os builtins, as construções de tuplos, listas, maps e
  records, e as chamadas de funções do lote (com os seus tipos de função
  selecionados como na seleção de chamadas, sem estreitar de novo os
  argumentos) com operandos dependentes são avaliados uma vez por cada
  combinação das cláusulas dos operandos, com os valores dessas cláusulas em
  vez dos factos dos operandos e as suas entradas intersetadas: as leituras de
  uma mesma variável tomam a mesma cláusula, os outros operandos combinam-se,
  no máximo 16 combinações (além disso o uso é a junção simples). `R + 1` com
  `R = case X of a -> 1; b -> 2 end` infere `(a) -> 2; (b) -> 3`.
- Estreitar uma variável dependente (um padrão, uma guard, um uso) também
  estreita os seus parâmetros para a junção das entradas das cláusulas em que
  se entra cujos valores intersetam o facto estreitado, e por sua vez os
  parâmetros destes, até 4 níveis de profundidade: depois de
  `R = case X of a -> 1; b -> 2 end`, `case R of 1 -> X end` lê `X` como `a`.
- O resultado dependente de uma cláusula de função divide-a (ver Tipos de
  função): os parâmetros que nomeiam um argumento, ou um nome vinculado ao seu
  valor, intersetam a sua entrada; os outros são descartados (um tal tipo só
  é exato se a sua entrada for qualquer termo). `nested_case(X, L)` com
  `case X of 1 -> case L of spanish -> uno; _ ->
  one end; _ -> other end` infere `(1, spanish) -> uno; (1, _) -> one; (_, _) ->
  other`.
- `--print-types` anota um valor dependente como um tipo de função com o nome
  da sua construção, cada entrada depois do nome do seu parâmetro:
  `case X of 1 -> one; _ -> other end` termina em
  `end. % $case_of_operator(X :: 1) -> one; (X :: _) -> other`; um `if`
  imprime `$if_operator`, um `try ... of` `$try_of_operator`.

### Domínio de inferência

`semantic/types/lattice`. Um facto é um conjunto de valores que uma variável
ou um resultado pode ter. Os factos juntam-se onde o fluxo de controlo se
encontra (cláusulas, ramos) e alargam-se entre as rondas de uma componente
recursiva; cada orçamento abaixo alarga de forma correta para um conjunto
maior, nunca rejeita um programa. Os factos imprimem-se como tipos Erlang, as
categorias pelos seus nomes built-in.

| Facto | Impresso | Junção | Orçamento e alargamento |
| --- | --- | --- | --- |
| Nada | `none()` | Identidade | Uma função que nunca regressa fica `none()` |
| Qualquer coisa | `term()` | Absorve qualquer facto | `dynamic()` e `any()` são `term()` |
| Inteiros | `42`, `1 \| 3 \| 7` | União de singletons | Mais de 8 singletons tornam-se o seu intervalo |
| Intervalo de inteiros | `1..10`, `0..255` | O menor intervalo que contém ambos | Um limite que se moveu entre rondas passa para o limiar seguinte: um inferior para 1, depois 0, depois ilimitado; um superior para -1, depois ilimitado |
| Inteiros ilimitados | `pos_integer()` (1 e acima), `non_neg_integer()` (0 e acima), `neg_integer()` (-1 e abaixo), `integer()` | O menor intervalo que contém ambos, impresso pela sua categoria | — |
| Floats | `float()` | — | — |
| Números | `number()` | Um intervalo ou categoria de inteiros junto com `float()` | Inteiros singleton com `float()` ficam `1 \| float()` |
| Átomos | `ok`, `error \| ok`, `boolean()` | União de singletons; exatamente `false` e `true` imprimem `boolean()` | Mais de 8 singletons tornam-se `atom()` |
| Identificadores | `pid()`, `port()`, `reference()` | — | — |
| Tuplos | `{ok, 1}`, `tuple()`, `#point{x :: 0, y :: _}` | Os tuplos do mesmo tamanho cujos primeiros elementos não são dois átomos diferentes (a sua etiqueta) juntam-se elemento a elemento; os outros ficam membros separados | Mais de 16 elementos tornam-se `tuple()`, a menos que todos os elementos sejam conhecidos; mais de 8 formas separadas tornam-se `tuple()`. Um tuplo com o nome e o tamanho de um record em tuplo visível imprime-se como o record |
| Listas | `[]`, `[T]`, `[T, ...]`, `nonempty_improper_list(H, T)`, `[1, a]`, `[a, b \| T]` | Os elementos juntam-se; `[]` com uma lista não vazia dá uma possivelmente vazia; as listas impróprias juntam cabeças e caudas. As listas de dois ou mais elementos conhecidos mantêm as suas posições (uma notação do Clause, a linguagem de tipos não tem nenhuma, com os elementos impressos com `\|` entre parênteses): as listas posicionais de um mesmo comprimento juntam-se posição a posição, caso contrário juntam-se como listas simples | Uma lista de `0..1114111` (`char()`) imprime `string()` ou `nonempty_string()`; uma lista possivelmente vazia de `_` imprime `list()` |
| Maps | `#{}`, `#{a := 1}`, `#{1..17 => a}`, `map()` | Os maps com as mesmas chaves juntam-se valor a valor; os maps de outras chaves juntam-se numa associação das suas chaves e valores juntos (`=>`: qualquer chave pode faltar) | Mais de 16 chaves juntam-se numa associação |
| Funs | `fun((term()) -> 1)`, `fun()` | As funs de uma mesma aridade juntam os seus resultados; outras aridades dão `fun()` | — |
| Bitstrings | `<<_:16>>`, `<<_:3, _:_*2>>`, `binary()` | O tamanho menor mais cada diferença de tamanhos como unidade | Base e unidade 0/8, 8/8, 0/1, 1/1 imprimem `binary()`, `nonempty_binary()`, `bitstring()`, `nonempty_bitstring()` |

- Uma união mantém um membro por cada forma junta, pela ordem dos termos
  Erlang dos seus valores: números, átomos, `reference()`, funs, `port()`,
  `pid()`, tuplos, maps, `[]`, listas, bitstrings e depois os tipos nomeados
  declarados; mais de 8 membros tornam-se `term()`.
- Os contentores aninham-se no máximo 4 níveis; um facto mais profundo torna-se
  `term()`.
- Uma união descarta um membro tuplo exato que outro tuplo exato do seu
  tamanho contém (de dois que se contêm mutuamente, fica o anterior), para que
  um conjunto de valores tenha uma única união e as recursões sobre árvores
  estabilizem.
- As componentes recursivas juntam durante 8 rondas (ciclos de até 8 funções
  convergem exatamente) e depois alargam ([inferência](#inference)).
- O estreitamento (`Lattice::meet`) é a interseção (meet) dos factos, os
  valores que ambos contêm (ou mais, mas `none()` apenas quando não partilham
  nenhum). Uma interseção vazia significa que o caminho não pode executar.

Em `-O2` com especialização de tipos, o rebaixamento usa estes factos para
remover verificações ([especialização](specialization.md#proofs)); as
especificações nunca se tornam factos.

### Cache de inferência

Os módulos nos diretórios da
[cache de inferência](projects.md#inference-cache) podem começar uma
compilação com os resultados que uma compilação anterior guardou: resumos,
entradas locais e factos de expressões das suas funções. `infer` mantém-nos
fixos em todas as passagens, nunca percorre uma componente cujos membros os
reutilizam todos, e percorre todas as outras funções como de costume, lendo
os resumos guardados como quaisquer outros.

- **De que dependem os factos de um módulo.** As funções exportadas e as
  funções que um `fun F/A` nomeia começam em `term()`; as entradas de todas as
  outras funções vêm dos seus chamadores, que estão no mesmo módulo; um facto
  só nomeia uma função de outro módulo através de um átomo: uma chamada
  remota, `fun M:F/A`, ou `apply/2,3` sobre um facto átomo (e só lê a
  disposição de records de outro módulo através de um native record que
  qualifica ou importa), e cada facto átomo vem de um átomo que o módulo
  escreve ou de um facto de um módulo que alcança. Assim, os factos de um
  módulo dependem apenas do seu próprio código e do código dos módulos do lote
  que os seus átomos nomeiam, transitivamente. A chave dos seus resultados
  guardados cobre exatamente isso: a identidade de `clau`, a impressão digital
  do módulo (o seu código-fonte, todos os ficheiros que inclui, as opções de
  pré-processamento e uma resposta de parse transform), as formas
  predefinidas, o estado de escript e de biblioteca, e o mesmo para cada módulo
  do lote que os seus átomos alcançam. Um módulo alcançado dessa forma que não
  tenha impressão digital torna o módulo não armazenável em cache.
- **Vivacidade.** A vivacidade das exportações só remove funções, e um
  chamador removido só estreita as entradas das funções que chamava: os factos
  calculados com mais funções vivas continuam válidos. Os resultados guardados
  são reutilizados quando contêm todas as funções vivas agora
  (`results do not fit` caso contrário); as funções deixadas de fora não
  recebem nada.
- **Mistura.** Os resultados guardados e os novos podem encontrar-se num mesmo
  lote: os factos de cada módulo valem para todas as execuções do programa, o
  que quer que digam os factos de outro módulo, pelo que um módulo novo que lê
  um resumo guardado (ou o inverso) se mantém correto. Uma componente
  recursiva com membros de ambos os tipos é percorrida inteira.
- **Precisão.** Os resultados reutilizados são os da compilação que os
  guardou. Os resultados de um módulo novo podem ainda diferir dos de uma
  compilação sem a cache: o orçamento da passagem já não paga pelos módulos
  reutilizados, e as identidades do grafo, pelas quais alguns membros de
  uniões são ordenados, são numeradas de forma diferente.

## `--print-types`

Imprime cada módulo do lote (pela ordem das entradas/alvos, com os módulos de
biblioteca depois deles) como código-fonte Erlang
([impressão do código-fonte](compile.md#source-printing)) com o que a
inferência de tipos encontrou. A saída vai para stdout e é legível por
humanos, não é Erlang nem um formato de intercâmbio. Os avisos ficam em
stderr.

```erlang
%% module "branches" source="branches.erl" target="" declared=complete inferred=complete
-module(branches).
-export([mixed/1]).

%% inferred: mixed(1) -> 1; (_) -> 2
mixed(X) ->
    case X of
        1 ->
            1;
        _ ->
            2
    end. % $case_of_operator(X :: 1) -> 1; (X :: _) -> 2
```

- Uma linha `%% module` nomeia o módulo, o seu código-fonte, o alvo do projeto
  e se os tipos declarados e inferidos ficaram completos ou foram alargados por
  um limite.
- As declarações (`-type`, `-spec`, `-callback`, records) aparecem tal como
  escritas.
- Por cima de cada função, `%% declared: f(Inputs) -> Result` dá cada
  sobrecarga do seu `-spec` tal como resolvida (com as suas restrições
  `when`), e `%% inferred: f(Inputs) -> Result` o que a inferência encontrou,
  para que os dois possam ser comparados. As entradas são o domínio de sucesso
  de cada argumento (a partir de `term()` para as funções exportadas e as que
  `fun F/A` nomeia, a partir dos argumentos juntos dos chamadores para as
  outras funções). Uma função com vários tipos de função imprime uma
  assinatura por tipo, cada uma com as suas próprias entradas:
  `f(integer()) -> integer(); (atom()) -> string()`
  (`semantic::types::function_source`). Um `-spec` fica com a função logo a
  seguir a ele, separado das outras formas por uma linha em branco.
- A expressão mais exterior de cada linha (uma expressão do corpo, ou o valor
  examinado de um `case`) cujo facto diz mais do que `term()` é anotada com um
  comentário final `% Type` depois da pontuação da linha (um tipo conhecido
  esconde uma relação com um argumento, que só aparece para um valor que não é
  conhecido como mais nada): no máximo uma anotação por linha, nenhuma para as
  expressões aninhadas nela, para que a saída continue a ser Erlang válido.
  Uma expressão do corpo em várias linhas leva a sua anotação na última linha
  (`end, % ...`). Os termos literais (literais, e tuplos, listas, maps
  construídos e bitstrings de literais) não são anotados; uma correspondência
  mostra o seu valor. Um valor dependente imprime-se como um tipo de função da
  sua construção ([factos dependentes](#dependent-facts)).
- Um valor que a inferência provou ser igual a um dos argumentos da função, e
  que não é conhecido como mais nada, imprime-se com o nome desse argumento,
  uma variável de tipo: a variável que lhe dá a primeira cláusula que vincula
  o argumento inteiro, caso contrário `_argumentN` (a partir de 1, também
  quando um argumento anterior tomou o nome). A entrada do argumento mostra o
  mesmo nome quando é qualquer termo: `second(_, Y) -> Y`,
  `keep(Acc, number()) -> Acc`. Uma variável mostra apenas o seu tipo; o seu
  nome já diz que argumento é.

### Expectativas de inferência

`tests/fixtures/inference/*.erl` registam o que a inferência deve encontrar
para cada função e o que encontra hoje. Cada módulo torna-se o CTest
`inference_<module>` (`tests/compiler/inference/expectations.py`):

```erlang
%% expect: sum() -> 3
%% today: sum() -> _
sum() -> 1 + 2.
```

- `expect:` é a assinatura que `--print-types` deve imprimir na sua linha
  `%% inferred:`; `today:`, presente enquanto a inferência fica aquém, é a que
  imprime agora.
- A verificação compara a saída com `today` quando existe, caso contrário com
  `expect`; todas as funções do módulo precisam de uma linha `expect`. Uma
  linha `today` que a inferência já alcançou faz falhar a verificação até ser
  removida.
- `expectations.py <clau> <fixture> --record` reescreve as linhas `today` a
  partir da saída atual (uma ação de manutenção: rever o diff).
- `values.erl` cobre valores literais e construídos, resultados de operadores
  e builtins, contentores e as suas partes, funs e as suas chamadas, entradas
  locais a partir dos chamadores, junções e intervalos de inteiros, relações
  com argumentos e valores de `try`/`maybe`; `narrowing.erl` testes de tipo,
  guards, padrões, intervalos de comparações, disjunções e estreitamentos que
  não podem escapar; `base_types.erl` uma função por cada tipo base e built-in
  da [linguagem de tipos](https://www.erlang.org/doc/system/typespec.html),
  cujo `-spec` tem de se resolver e cujo corpo produz um valor desse tipo;
  `clauses.erl` tipos de função, seleção de chamadas e avaliação por chamada
  dentro e além dos seus orçamentos; `dependent.erl`
  [factos dependentes](#dependent-facts); `trees.erl` e `parsers.erl`
  recursões sobre árvores e formas de parsers gerados.
- `tests/fixtures/inference/contracts/` contém as verificações de
  especificações (CTest `inference_contracts`).

### Impressão de tipos

`semantic::types::type_source(graph, type)` (`semantic/types/printing`)
apresenta um tipo do grafo de tipos na sintaxe de tipos Erlang: `_` para
qualquer termo (`term()`, escrito por `TERM_SOURCE` por brevidade; a sintaxe de
tipos lê `_` como `any()`), `none()`, átomos e inteiros, `1..5`, `{ok, T}`,
`tuple()`, `[T]`, `[T, ...]`, `#{K => V, K := V}`, `#r{f :: T}`,
`<<_:B, _:_*U>>`, `fun((A) -> R)`, `A | B`. Uma fun com vários tipos de função
imprime-os numa notação do Clause, `fun((1) -> one;
(_) -> other)`: a sintaxe de tipos Erlang não tem um tipo fun sobrecarregado,
e uma união de tipos fun significa outra coisa. Os inteiros de uma união
imprimem-se por ordem de valor onde está o seu primeiro inteiro, os
consecutivos como um intervalo (`1 | 2 | 3 | 5` imprime `1..3 | 5`; o facto
mantém os singletons). Os tipos predefinidos de `erlang` perdem o seu módulo;
as referências a tipos declarados ficam com nome. Um orçamento de nós limita o
texto; além dele, e abaixo de 32 níveis de aninhamento, `...` toma o seu
lugar.

```sh
clau --print-types answer.erl client.erl
clau --print-types --project project.toml --target demo --verbose
```
