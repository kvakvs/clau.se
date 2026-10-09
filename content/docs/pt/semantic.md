---
source: docs/semantic.md
sourceCommit: 06042fa
sourceSha256: 4a59e74a8f74a79a05ce095a1fed17c4ee5fc1249c50e25b2b78fe555376445b
translatedAt: 2026-10-09
---
# Análise semântica

É executada após a análise sintática na compilação predefinida e em
`--print-types`; as ações apenas sintáticas saltam-na. Os erros param o lote
afetado antes do LLVM; os diagnósticos mantêm as origens de macros/inclusões, e
as entradas seguintes continuam a ser diagnosticadas.

## Verificações de módulos e chamadas

- A declaração de módulo é obrigatória e única; aridades de funções 0..255;
  sem definições duplicadas; cada exportação existe e é listada uma única vez.
  Os nomes entre aspas/Unicode mantêm a sua identidade exata.
- Todas as funções são verificadas, incluindo o código não usado e
  inalcançável.
- As chamadas são resolvidas dentro do lote por módulo/nome/aridade. As
  chamadas remotas (incluindo as qualificadas com o próprio módulo) exigem
  exportações. Funções chamadas em falta/privadas e módulos duplicados são
  erros.
- `fun F/A` tem de nomear uma função do módulo (`function F/A undefined`);
  `fun M:F/A` e as chamadas de valores (`F(Args)`) não são resolvidas em tempo
  de compilação ([funs](funs.md)). Cada valor fun distinto recebe uma entrada
  em `Module::funs` após a análise das vinculações.
- A recursão própria, mútua e entre módulos é aceite. O grafo de chamadas é
  dividido em componentes fortemente conexas (Tarjan iterativo) pela ordem
  chamado-antes-do-chamador; uma componente é recursiva quando tem vários
  membros ou quando um membro se chama a si próprio.

## Vinculações

Cada vinculação tem uma identidade relativa à função `clause[N].local[M]`. As
ocorrências são definições, leituras ou verificações de igualdade exata,
etiquetadas com o contexto de cabeça/guard/corpo. A análise é determinística.

- Cada cláusula começa a partir de um ambiente vazio. Os candidatos da cabeça
  recolhem definições provisórias; os guards leem-nas; o corpo só as vê em
  caso de sucesso.
- `_` não vincula nada; `_Name` é uma variável comum. Um nome repetido é uma
  restrição de igualdade exata.
- As correspondências no corpo visitam o lado direito antes do lado esquerdo;
  as cadeias são da direita para a esquerda. Um padrão entre parênteses
  `P1 = P2` é um alias, não uma sequência.
- As expressões irmãs leem os mesmos nomes de entrada; as suas definições são
  exportadas após toda a expressão. `{X = 1, X}` é uma leitura não vinculada;
  `{X = 4, X = 3}` é legal e falha em tempo de execução.
- As definições no lado direito de `andalso`/`orelse` ou dentro de
  `catch Expr` são inseguras depois disso (`vtunsafe` do OTP); os nomes
  vinculados antes de um `catch` continuam utilizáveis. Todos os nomes
  vinculados dentro de um `try` são inseguros depois dele; as cláusulas `of`
  veem os nomes do corpo, as cláusulas catch veem-nos como inseguros, e o corpo
  after vê como inseguros todos os nomes vinculados antes no try. A variável de
  pilha de uma cláusula catch tem de ser nova (`stacktrace_bound` do OTP) e o
  seu guard não a pode ler (`stacktrace_guard`). Um `maybe` não exporta nada:
  cada `?=` vincula para as expressões seguintes do corpo, as cláusulas `else`
  veem os nomes do corpo como inseguros e todos os nomes vinculados no interior
  são inseguros depois dele. Os guards nunca publicam vinculações; as
  correspondências em guards são erros mesmo quando inalcançáveis.
- As chaves de maps leem apenas vinculações de entrada; os tamanhos de binaries
  também leem segmentos anteriores do mesmo binary (ver
  [padrões](patterns.md#scopes)).
- O valor examinado de um `case` vincula no âmbito envolvente. Cada cláusula
  começa a partir desse âmbito; as definições do seu padrão são provisórias até
  ao guard, que apenas lê. Os nomes vinculados por todas as cláusulas são
  exportados com uma única identidade (as cláusulas posteriores reutilizam a
  identidade que uma cláusula anterior deu ao nome); os nomes vinculados apenas
  por algumas cláusulas, ou inseguros em alguma, são inseguros depois disso. As
  exportações juntam-se de forma conservadora, como no `erl_lint` do OTP
  (`icrt_export`); o aviso do OTP quando um padrão posterior corresponde a um
  nome exportado não é emitido. As cláusulas `if` seguem as mesmas regras, com
  um guard e sem padrão.
- `begin`/`end` é uma sequência no âmbito envolvente.
- As leituras não vinculadas, inseguras e de wildcard são erros localizados.
  As mensagens mantêm a formulação do compilador (`unbound variable X`,
  `unsafe variable X`); o corpus de vinculações verifica cada uma face à classe
  `unbound_var`/`unsafe_var` do OTP.
- Uma comprehension avalia cada qualificador por ordem, no âmbito deixado pelos
  anteriores. Os padrões dos geradores vinculam novos nomes que ocultam os
  exteriores (as leituras dentro do padrão preferem os nomes que este já
  vinculou); um grupo zip vincula todos os seus padrões em conjunto. Os modelos
  leem como irmãos. O âmbito após a comprehension é o anterior a ela: os seus
  nomes não estão aí vinculados.
- As cláusulas de uma fun anónima começam cada uma a partir do âmbito na fun:
  os nomes da cabeça são novos e ocultam os exteriores, os guards leem-nos, e
  nada vinculado no interior é visível após a fun. Cada definição exterior lida
  no interior é registada como captura (`Function::captures`, pela ordem de
  definição). O nome de uma fun com nome é mais uma definição com que cada
  cláusula começa (`Function::fun_names`); nunca é capturado. As variáveis de
  `fun M:F/A` são leituras da expressão fun (`Function::fun_operands`).

Os percursos são iterativos, com um orçamento por módulo de 1 000 000 unidades
de trabalho. O esgotamento ou qualquer erro semântico limpa as tabelas de
vinculações e de normalização do módulo.

## Tipos e especificações

Um grafo de tipos privado representa todas as formas de tipos analisadas,
independentemente da disposição em runtime: singletons, intervalos,
contentores, papéis dos campos de maps, produtos de funções e aplicações não
resolvidas. As uniões são achatadas e deduplicadas; `term()` é o topo e
`none()` o fundo. Predefinições: 16 384 nós, 16 membros por união, 100 000
itens de trabalho por tradução. O esgotamento alarga para `term()` com uma flag
visível e nunca estreita uma representação.

Os metadados declarados (`-type`, `-opaque`, `-nominal`, `-export_type`,
`-spec`, `-callback`, `-optional_callbacks`) seguem a referência de typespecs
do OTP e o comportamento fixado de `erl_lint`/`erl_internal`/`erl_types`:

- Os aliases locais podem ocultar nomes de tipos builtin. Os tipos remotos do
  lote têm de ser exportados. Tipos em falta, duplicados, metadados
  malformados, variáveis de tipo singleton, limites inválidos e specs para
  funções em falta são erros. Os tipos externos indisponíveis geram um aviso e
  tornam-se `term()`.
- Cada alias ou sobrecarga tem o seu próprio âmbito de variáveis; os
  parâmetros formais repetidos seguem a substituição pelo último argumento do
  OTP.
- Os aliases recursivos permanecem referências nomeadas finitas; os corpos
  opacos só são expandidos no seu módulo; os nomes nominais são mantidos em
  todo o lado, e só a verificação de especificações lê a definição de um tipo
  nominal, dentro do seu módulo.
- A avaliação de constantes é exata, limitada a 10 000 dígitos decimais por
  valor.

## Inferência

A inferência é separada dos tipos declarados e nunca confia nas specs.

- As entradas exportadas, e as entradas das funções que `fun F/A` nomeia, são
  termos arbitrários. Uma função em que só se entra por chamadas diretas do
  lote (nem exportada nem nomeada por uma fun) toma como entradas a junção
  (join) dos factos dos argumentos dos seus locais de chamada (step 58F,
  `semantic/types/inference_inputs`), correspondidos pelos padrões da cabeça de
  cada cláusula; as chamadas recursivas também contam. As entradas começam em
  `none()` (uma função que nada chama nunca é executada e infere `none()`) e
  crescem ao longo de passagens pelo lote: 8 passagens juntam, as seguintes
  alargam como os resultados recursivos; as entradas que não estabilizaram
  após 16 passagens tornam-se `term()` (relatadas como alargadas).
- Os literais têm factos exatos (step 58B):
  os inteiros de qualquer tamanho e os caracteres são singletons, os átomos
  átomos singleton, os floats `float()`, as strings listas não vazias dos seus
  caracteres (`[]` para `""`), e `-`/`+` de um número literal mantém o seu
  facto. Os tuplos mantêm os factos dos seus elementos; os maps construídos com
  chaves constantes (um facto de um único valor: um inteiro, um átomo, `[]`, ou
  um tuplo ou map destes) mantêm o facto do valor de cada chave, uma chave dada
  duas vezes mantendo o seu último valor, e qualquer outra chave dá `map()`.
  Uma construção de bitstring conta o seu tamanho: caracteres literais, com
  tamanho e codificados em UTF exatamente, um segmento UTF de outro valor pela
  sua codificação (UTF-8: 8 a 32 bits, por bytes), e um segmento
  `binary`/`bitstring` pelo facto do seu valor ou por qualquer múltiplo da sua
  unidade (`<<1, Rest/binary>>` é `nonempty_binary()`). Um operando que nunca
  produz um valor (`none()`) torna a construção `none()`.
- Os operadores e os builtins (step 58C, `semantic/types/inference_operators`)
  calculam o seu resultado a partir dos factos dos seus operandos. Os
  singletons inteiros são dobrados exatamente até 4 096 bits por operando e
  resultado (incluindo bignums; um maior é
  `integer()`); os outros inteiros usam aritmética de intervalos para `+`, `-`,
  `*` de intervalos não negativos, `band` com um operando não negativo
  (`X band 15` é `0..15`), `rem` por um divisor limitado (`X rem 10` é
  `-9..9`), `bnot`, `-` unário e `abs/1`; um operando float dá `float()`, um
  desconhecido `number()`, e `/` é sempre `float()`. As comparações são
  dobradas quando os valores dos operandos só podem comparar-se de uma forma
  (átomos ou inteiros singleton, intervalos de inteiros disjuntos, números face
  a não números) e são `boolean()` caso contrário; `and`/`or`/`xor`/`not` e
  `andalso`/`orelse` combinam os valores de verdade que os seus operandos podem
  ter (o operando direito de `andalso` é o resultado quando o esquerdo é
  `true`). Uma tabela dá a cada builtin de ponte o seu resultado: `pid()` para
  `self/0` e `spawn/1,3`, `reference()`, `port()`, `non_neg_integer()` para
  tamanhos, `string()`, `nonempty_string()`, `binary()`, `list()`, `tuple()`,
  `atom()`, `boolean()` para testes de tipo, `true`/`ok` para builtins com
  efeitos secundários, a mensagem para `!` e `send/2`; `trunc/1` e afins
  mantêm os operandos inteiros; os builtins desconhecidos são `term()`. Uma
  operação que lança sempre (`1 + a`, `1 div 0`, `error/1`, `exit/1`,
  `throw/1`, `halt/0,1`) é `none()`, e `erlang:raise/3` devolve apenas
  `badarg`. A dobragem nunca altera o código gerado: o overflow e as falhas
  continuam a ser resultados em runtime.
- Um corpo cuja expressão nunca termina (`none()`) é `none()`; o mesmo vale
  para uma chamada com um argumento desses. Os caminhos que lançam não
  acrescentam nada a uma junção, pelo que uma função que lança sempre infere
  `none()`.
- As funções de identidade/projeção mantêm relações exatas com os argumentos,
  propagadas através de chamadas locais e remotas aninhadas, com variáveis
  novas por chamada.
- Contentores (step 58D, `semantic/types/inference_containers`): uma lista
  `[E1, ..., En | T]` junta os seus elementos à frente do facto da cauda (uma
  lista própria quando a cauda o é, `nonempty_improper_list(H, T)` quando não
  é uma lista, `term()` quando é desconhecida); `++`, `--`, `hd/1`, `tl/1`,
  `element/2`, `setelement/3`, `tuple_to_list/1` e `map_get/2` leem e
  reconstroem os factos dos elementos membro a membro de uma união, sendo que
  um membro que lançaria não acrescenta nada. Uma atualização de map mantém as
  chaves exatas (`:=` de uma chave em falta descarta esse membro) e dá `map()`
  para um map desconhecido. Os records em tuplo são tuplos: a construção
  preenche os valores predefinidos (`undefined` se não houver), o acesso e a
  atualização leem e definem o campo dos tuplos correspondentes, e `#r.f` é o
  índice do campo. Uma list comprehension é uma lista possivelmente vazia dos
  factos dos seus modelos, uma binary comprehension um número qualquer de
  cópias do tamanho do seu modelo, uma map comprehension `map()`.
- Funs (step 58E, `semantic/types/inference_funs`): `fun F/A` é uma fun da sua
  aridade que devolve o resultado inferido da função (o de um builtin ou, com
  uma aridade variável, `fun()`), `fun M:F/A` uma que devolve `term()`, e uma
  fun anónima uma que devolve os resultados juntos das suas cláusulas,
  incluindo os valores capturados. Uma chamada de um valor junta os resultados
  das suas funs dessa aridade que os seus argumentos selecionam (step 58L;
  `term()` para uma fun desconhecida, `none()` quando nenhum membro pode ser
  chamado assim).
  Uma fun anónima vinculada inteira a uma variável e chamada através dela é
  avaliada novamente para essa chamada, com os seus padrões a corresponder aos
  factos dos argumentos, no máximo com 4 dessas chamadas de profundidade, e os
  factos da sua primeira avaliação são repostos depois
  (`Double = fun(Y) -> Y * 2 end, Double(3)` é 6). `apply/2,3` e as chamadas
  dinâmicas permanecem `term()`. Como `fun F/A` pode nomear uma função
  inferida mais tarde, as passagens pelo lote também se repetem até cada fun
  dessas ter lido o resultado final da sua função; caso contrário, uma última
  passagem dá-lhes resultados `term()`.
- As atribuições de valor completo no corpo e os aliases copiam o facto do
  lado direito (`Y = 42, Z = Y, id(Z)` infere 42); os padrões de tuplo, lista,
  map e record em tuplo dão às suas variáveis os factos das partes a que
  correspondem, em correspondências no corpo, em cláusulas `case` (a partir do
  valor examinado), nas cláusulas `of` de um `try` (a partir do valor do seu
  corpo) e em geradores (a partir dos elementos da sua entrada ou das chaves e
  valores do map). Os valores não provados permanecem `term()` sem relações.
- Estreitamento (narrowing) (step 58G, `semantic/types/inference_narrowing`,
  `inference_scopes`, `meet`): dentro de uma cláusula de função, `case`,
  `receive` ou fun, cada padrão interseta (meet) o valor a que corresponde
  (uma forma de literal, tuplo, lista, record em tuplo, map ou bitstring; o
  facto de uma variável vinculada), uma variável examinada por um `case`
  estreita-se com ele, e o guard estreita as variáveis que testa. Os testes de
  tipo (`is_atom/1` para `atom()`, `is_boolean/1`, `is_integer/1`,
  `is_float/1`, `is_number/1`, `is_binary/1`, `is_bitstring/1`, `is_list/1`
  para `maybe_improper_list()`, `is_tuple/1`, `is_map/1`, `is_function/1,2`,
  `is_pid/1`, `is_port/1`, `is_reference/1`, `is_record/2,3` para o tuplo do
  record, `is_map_key/2` o seu map para `map()`, e os nomes antigos de guards)
  intersetam o facto do seu argumento; as comparações com constantes inteiras
  (`<`, `=<`, `>`, `>=`, `==`, `=:=`, de qualquer lado, incluindo constantes
  dobradas) estreitam um valor já provado como inteiro para um intervalo,
  acumulando os limites de um teste (`10 >= X, X >= 0` é `0..10`); dois
  inteiros provados comparados estreitam-se mutuamente pelos seus limites
  (`X > Y` com `Y` em `0..5` faz `X` pelo menos 1), e `/=`, `=/=` com uma
  constante deslocam para dentro um limite do intervalo igual a ela
  (step 58H1). Um valor que possa ser um float ou outro termo não é
  estreitado. Uma conjunção aplica
  cada teste à vez, uma disjunção junta o que cada alternativa prova, `not` e
  os testes falsos não provam nada. Uma cláusula a seguir a outra cujos
  padrões sejam todos variáveis simples e cujo guard completo tenha sido um
  único teste de tipo vê esse valor sem a categoria testada; após uma única
  comparação com uma constante inteira, o mesmo valor (uma variável simples
  desta cláusula) provado como inteiro vê a comparação como falsa
  (`f(N) when N >= 0 -> ...;
  f(N) when is_integer(N) -> ...`: a segunda cláusula vê `neg_integer()`). O
  operando direito de `andalso`, a cláusula `true` de `case Test of` e o que
  se segue a um filtro de comprehension veem o teste como verdadeiro. Uma
  interseção vazia torna a cláusula impossível: não acrescenta nada ao
  resultado. Os factos estreitados só valem dentro da sua cláusula ou operando;
  `catch`, o operando direito de `orelse` e cada cláusula repõem os factos de
  antes deles. Após um `case`, `if`, `receive`, `try` ou `maybe`, o facto de
  uma variável é a junção dos seus factos no fim de cada cláusula que termina
  (step 58H), pelo que `case X of forever -> ...; N when
  is_integer(N), N >= 0 -> ... end` deixa `X` como
  `non_neg_integer() | forever`.
- `try` e `maybe` (step 58J1): um `try` é a junção dos valores das suas
  cláusulas `of` (o do seu corpo, sem `of`) e dos valores das suas cláusulas
  catch; o corpo `after` não acrescenta nada. As cláusulas `of` começam a
  partir dos factos no fim do corpo e correspondem ao seu valor como as
  cláusulas `case` (uma cláusula impossível não acrescenta nada); as cláusulas
  catch e o corpo `after` começam a partir dos factos antes do `try`, com um
  padrão de classe a corresponder a `error | exit | throw`. Um `maybe` é a
  junção do valor do seu corpo, dos valores das suas cláusulas `else` e, sem
  `else`, dos valores em que as suas correspondências `?=` podem falhar: o
  facto do valor correspondido sem a forma do padrão, quando o padrão
  corresponde a toda a sua forma (variáveis novas usadas uma vez, átomos e
  inteiros literais, `[]`, tuplos destes), caso contrário o facto completo.
  Cada padrão `?=` interseta o seu valor e publica as suas variáveis para o
  resto do corpo; um `?=` que nunca pode corresponder para o corpo. As
  cláusulas `else` começam a partir dos factos antes do `maybe` e correspondem
  aos valores de falha juntos como as cláusulas `case`. Os factos após um
  `try` juntam os do fim do seu corpo (sem `of`) e os de cada cláusula que
  termina; após um `maybe`, os do fim do seu corpo, os de cada cláusula `else`
  que termina e, sem `else`, os de antes dele.
- Usos (step 58H, `semantic/types/inference_uses`): uma operação que lança a
  menos que um operando tenha um tipo prova esse tipo para a variável que leu,
  depois de a operação retornar: a aritmética e `-`/`+` unários um
  `number()`, `div`, `rem`, os operadores de bits e `bnot` um `integer()`,
  `and`/`or`/`xor`, `not` e o operando esquerdo de `andalso`/`orelse` um
  `boolean()`, `++` e `--` uma `list()`, um valor chamado uma fun dessa
  aridade, um nome de módulo ou de função variável um `atom()`, uma
  atualização de map `map()`, um acesso ou atualização de record em tuplo o
  tuplo do record, um segmento de binary o seu tipo (`<<X:8>>`: `integer()`)
  e o seu tamanho um `non_neg_integer()`, e uma linha por verificação de
  argumento de builtin de ponte (`hd/1`, `tl/1`
  `nonempty_maybe_improper_list()`, `length/1` `list()`, `element/2`
  `pos_integer()` e `tuple()`, `map_get/2` e `is_map_key/2` `map()`,
  `atom_to_list/1` `atom()`, ...). A operação mantém a sua verificação em
  runtime. Os nomes vinculados ao mesmo valor (`Y = X`, um padrão `case`
  variável sobre um valor examinado variável) estreitam-se em conjunto.
- Domínios de entrada e de sucesso: o domínio de entrada de cada argumento é a
  junção, sobre as cláusulas de função possíveis, do seu facto após a cabeça e
  o guard (o facto estreitado de uma variável simples, caso contrário o do
  padrão); o seu domínio de sucesso (step 58H) é a junção, sobre as cláusulas
  que terminam, do seu facto no respetivo retorno normal. `--print-types`
  mostra o domínio de sucesso como entradas (`bounded(1..10) -> 1..10`,
  `inc(X) -> X + 1` como `inc(number()) -> number()`), ou o domínio de entrada
  de uma função que nunca retorna. Uma chamada que retorna estreita os seus
  argumentos variáveis para o domínio da função chamada, exceto dentro de uma
  componente recursiva ainda em resolução.
- Os resultados das cláusulas juntam-se de forma conservadora: uma projeção só
  sobrevive se todas as cláusulas devolverem o mesmo argumento. Um `case` ou
  `if` junta os resultados das suas cláusulas da mesma forma; uma vinculação
  definida por várias das suas cláusulas permanece `term()`.
- Tipos de função (step 58K, `semantic/types/function_types`): além do resumo
  em união acima, uma função mantém um tipo de função por cada cláusula
  possível, como as sobrecargas de uma `-spec`: os factos dos argumentos após
  a cabeça e o guard (o facto estreitado de uma variável simples, caso
  contrário o do padrão) e o resultado da cláusula (`none()` para uma cláusula
  que lança sempre; as cláusulas impossíveis não acrescentam nenhum). Uma
  cláusula cujo corpo termina num `case` ou `if` divide-se num tipo de função
  por cada ramo possível, com os factos dos argumentos após o padrão e o guard
  desse ramo e o resultado do ramo (um nível: um `case` aninhado não se divide
  mais). Os tipos de função com entradas iguais fundem-se (os seus resultados
  juntam-se); para além de 8, os últimos fundem-se num só, com as entradas e
  os resultados juntos. As componentes recursivas iteram-nos com os
  resultados, juntando (e depois alargando) o resultado de cada tipo em cada
  ronda; uma componente que não converge mantém apenas os seus resumos em
  união. O facto de uma fun anónima mantém um tipo de função por cada cláusula
  possível (os seus padrões e guard sobre qualquer argumento), `fun F/A` os
  tipos de função de `F/A`; as funs que se juntam só mantêm os seus tipos de
  função quando estes são iguais, caso contrário juntam-se como uma única fun
  dos seus resultados juntos com quaisquer entradas (intersetar uma fun de
  quaisquer entradas, como faz o uso `F(A)`, mantém-nos). A especialização,
  os domínios e as verificações de especificações leem o resumo em união.
- As chamadas selecionam tipos de função (step 58L): uma chamada de uma função
  com tipos de função lê, por ordem, cada tipo cujas entradas todos os factos
  dos argumentos intersetam, e para após um exato (padrões de variáveis novas
  usadas uma vez, átomos e inteiros literais, `[]` e tuplos destes; sem guard
  ou apenas `true` e testes de tipo de variáveis de argumento simples; para um
  ramo, um argumento como valor examinado do `case`) cujas entradas contêm os
  argumentos: nenhuma cláusula posterior pode ser alcançada. O seu resultado é
  a junção dos resultados dos tipos selecionados, sendo um resultado igual a
  um argumento o facto desse argumento dentro do resultado do tipo; se nenhum
  for selecionado, a chamada é `none()` (só pode lançar `function_clause`). Os
  argumentos desconhecidos selecionam todos os tipos, a união; uma função sem
  tipos de função (orçamento, componente não convergida) usa o seu resumo em
  união. Depois de uma chamada retornar, os seus argumentos variáveis
  estreitam-se para o domínio de sucesso e para as entradas juntas dos tipos
  selecionados. As chamadas de valores fun selecionam os tipos de função do
  facto da fun da mesma forma, e uma fun anónima avaliada novamente para uma
  chamada (ver Funs) entra, aplica os guards e sai das suas cláusulas como um
  `case`, pelo que uma cláusula a que os seus argumentos não podem
  corresponder não acrescenta nada (`F = fun(1) -> one; (_) -> other end, F(2)`
  é `other`). As componentes recursivas convergem nos resultados e nos tipos
  de função.
- As chamadas avaliam novamente a função chamada (step 58M): quando os factos
  dos argumentos de uma chamada estão dentro das entradas da função chamada e
  são mais estreitos numa delas, o corpo da função chamada é avaliado
  novamente com eles como entradas, como uma fun anónima vinculada, e o
  resultado da chamada é o resultado dos tipos de função selecionados
  intersetado com o dessa avaliação (`two_callers() -> {add_one(10), add_one(20)}`
  é `{11, 21}`); os argumentos da chamada também se estreitam para o domínio
  de sucesso dessa avaliação. O resumo, os tipos de função e os factos de
  expressões registados da função chamada nunca mudam (a especialização só lê
  esses). Orçamentos: 4 avaliações aninhadas, funções chamadas com no máximo
  256 expressões, 4 096 unidades de trabalho por chamada a partir de uma
  reserva de 262 144 por passagem pelo lote (separada do orçamento do próprio
  lote); as componentes recursivas nunca são avaliadas novamente. Ultrapassado
  um orçamento, a chamada mantém o resultado dos tipos de função
  selecionados.
- Um `receive` é a junção das suas cláusulas e do seu corpo `after`, que um
  timeout `infinity` nunca executa.
- Uma componente recursiva inicia o resultado de cada membro em `none()` e
  volta a inferir todos os membros até nenhum resultado mudar; cada ronda junta
  o novo resultado com o anterior (alarga-o após as primeiras 8 rondas,
  [domínio de inferência](#inference-domain)), e uma chamada recursiva pendente
  não acrescenta nada a uma junção. Uma função que nunca pode retornar
  permanece `none()`. Uma componente que não convergiu após 8 rondas mais 4 por
  membro alarga todos os membros para `term()` (relatado como alargado, tal
  como o esgotamento do orçamento) e uma ronda final recalcula os factos das
  expressões; os factos de expressões das rondas anteriores são descartados,
  pelo que só restam os factos dos pressupostos finais.
- Um orçamento de trabalho partilhado limita a inferência; o esgotamento perde
  precisão e recorre a código genérico, nunca rejeita um programa.
- As especificações que contradizem a inferência são erros (step 58I,
  `semantic/types/contracts`). Um tipo declarado torna-se os factos que contém
  (ou mais): os tipos built-in pelo nome (`byte()` é `0..255`, `timeout()` é
  `non_neg_integer() | infinity`, `iodata()` e `iolist()` listas de qualquer
  forma), os aliases pela sua definição, os tipos opacos e nominais pela sua
  definição dentro do seu módulo e como qualquer termo fora dele, os tipos
  remotos através do lote, as variáveis de tipo através dos seus limites
  `when` (uma sem restrições é qualquer termo), os maps e os records pela sua
  categoria. Uma especificação contradiz o código quando os seus factos não
  partilham nenhum valor com o que a inferência prova: o resultado inferido
  (exceto se desconhecido, ou `none()`: uma função que nunca retorna serve
  para qualquer resultado), o domínio de entrada de um argumento, ou os factos
  dos argumentos de uma chamada face a todas as sobrecargas.
  `none()`/`no_return()` só admite uma função que nunca retorna. O erro nomeia
  a função, o tipo declarado tal como foi escrito e o inferido. Como os factos
  inferidos podem conter mais valores do que o código produz, só um par
  disjunto é uma contradição: um tipo declarado mais estreito do que o
  inferido é aceite. As especificações `-callback` não são verificadas. O
  compilador do OTP não verifica especificações
  ([diferenças](differences.md#language-edge-cases)).

### Domínio de inferência

Decisão do plan 11 step 58A (`semantic/types/lattice`). Um facto é um conjunto
de valores que uma variável ou um resultado pode ter. Os factos juntam-se onde
o fluxo de controlo se encontra (cláusulas, ramos) e alargam-se entre as
rondas de uma componente recursiva; cada orçamento abaixo alarga de forma
correta para um conjunto maior, nunca rejeita um programa. Os factos são
impressos como tipos Erlang, as categorias pelos seus nomes built-in.

| Facto | Impresso | Junção | Orçamento e alargamento |
| --- | --- | --- | --- |
| Nada | `none()` | Identidade | Uma função que nunca retorna permanece `none()` |
| Qualquer coisa | `term()` | Absorve todos os factos | `dynamic()` e `any()` são `term()` |
| Inteiros | `42`, `1 \| 3 \| 7` | União de singletons | Mais de 8 singletons tornam-se o seu intervalo |
| Intervalo de inteiros | `1..10`, `0..255` | O menor intervalo que contém ambos | Um limite que se moveu entre rondas passa para o limiar seguinte: um inferior para 1, depois 0, depois ilimitado; um superior para -1, depois ilimitado |
| Inteiros ilimitados | `pos_integer()` (1 e acima), `non_neg_integer()` (0 e acima), `neg_integer()` (-1 e abaixo), `integer()` | O menor intervalo que contém ambos, impresso pela sua categoria | — |
| Floats | `float()` | — | — |
| Números | `number()` | Um intervalo ou categoria de inteiros junto com `float()` | Inteiros singleton com `float()` permanecem `1 \| float()` |
| Átomos | `ok`, `error \| ok`, `boolean()` | União de singletons; exatamente `false` e `true` imprimem `boolean()` | Mais de 8 singletons tornam-se `atom()` |
| Identificadores | `pid()`, `port()`, `reference()` | — | — |
| Tuplos | `{ok, 1}`, `tuple()`, `#point{x :: 0, y :: _}` | Os tuplos do mesmo tamanho cujos primeiros elementos não sejam dois átomos diferentes (a sua etiqueta) juntam-se elemento a elemento; os outros permanecem membros separados | Mais de 16 elementos tornam-se `tuple()`, a menos que todos os elementos sejam conhecidos; mais de 8 formas separadas tornam-se `tuple()`. Um tuplo com o nome e o tamanho de um record em tuplo visível é impresso como o record (step 58J) |
| Listas | `[]`, `[T]`, `[T, ...]`, `nonempty_improper_list(H, T)`, `[1, a]`, `[a, b \| T]` | Os elementos juntam-se; `[]` com uma lista não vazia dá uma possivelmente vazia; as listas impróprias juntam cabeças e caudas. As listas de dois ou mais elementos conhecidos mantêm as suas posições (step 58J; uma notação do Clause, a linguagem de tipos não tem nenhuma, elementos impressos com `\|` entre parênteses): as listas posicionais do mesmo comprimento juntam-se posição a posição, caso contrário juntam-se como listas simples | Uma lista de `0..1114111` (`char()`) imprime `string()` ou `nonempty_string()`; uma lista possivelmente vazia de `_` imprime `list()` |
| Maps | `#{}`, `#{a := 1}`, `#{1..17 => a}`, `map()` | Os maps com as mesmas chaves juntam-se valor a valor; os maps de outras chaves juntam-se numa única associação das suas chaves e valores juntos (`=>`: qualquer chave pode faltar, step 58J) | Mais de 16 chaves juntam-se numa única associação |
| Funs | `fun((term()) -> 1)`, `fun()` | As funs de uma aridade juntam os seus resultados; outras aridades dão `fun()` | — |
| Bitstrings | `<<_:16>>`, `<<_:3, _:_*2>>`, `binary()` | O tamanho menor mais cada diferença de tamanhos como unidade | Base e unidade 0/8, 8/8, 0/1, 1/1 imprimem `binary()`, `nonempty_binary()`, `bitstring()`, `nonempty_bitstring()` |

- Uma união mantém um membro por forma junta, pela ordem dos termos Erlang dos
  seus valores: números, átomos, `reference()`, funs, `port()`, `pid()`,
  tuplos, maps, `[]`, listas, bitstrings e depois os tipos nomeados
  declarados; mais de 8 membros tornam-se `term()`.
- Os contentores aninham-se no máximo 4 níveis; um facto mais profundo
  torna-se `term()`.
- Uma componente recursiva junta os resultados durante 8 rondas (ciclos de até
  8 funções convergem exatamente) e depois alarga-os. Uma componente que não
  convergiu após mais 4 rondas por membro alarga todos os membros para
  `term()` e é relatada como alargada, tal como um orçamento esgotado.
- O estreitamento (plan steps 58G, 58H, `Lattice::meet`) é a interseção
  (meet) dos factos, os valores que ambos contêm (ou mais, mas `none()` apenas
  quando não partilham nenhum): os padrões e os guards (testes de tipo como
  `is_integer/1` estreitam o seu argumento para a categoria) estreitam dentro
  da sua cláusula e definem o domínio de entrada de uma função; um uso que
  lança a menos que o seu operando tenha um tipo estreita o operando depois
  dele, no caminho normal. Uma interseção vazia significa que o caminho não
  pode ser executado.
- As especificações nunca acrescentam aos factos: os factos inferidos provêm
  apenas do código e nunca decidem uma representação com base na palavra de
  uma spec.

O rebaixamento (lowering) consome estes factos. O IR gerado nunca converte um
inteiro num ponteiro para o heap; cada resultado de serviço falível só é
carregado no seu caminho de sucesso, e as verificações de forma dominam a
extração. Política de especialização:
[specialization.md](specialization.md).

## `--print-types`

Imprime cada módulo do lote (pela ordem das entradas/alvos, com os módulos de
biblioteca a seguir) como código-fonte Erlang
([impressão do código-fonte](compile.md#source-printing)) com o que a
inferência de tipos encontrou. A saída vai para o stdout e destina-se a ser
lida por pessoas; não é Erlang nem um formato de intercâmbio. Os avisos
permanecem no stderr.

```erlang
%% module "branches" source="branches.erl" target="" declared=complete inferred=complete
-module(branches).
-export([mixed/1]).

%% inferred: mixed(_) -> 1..2
mixed(X) ->
    case X of
        1 ->
            1;
        _ ->
            2
    end :: 1..2.
```

- Uma linha `%% module` nomeia o módulo, o seu código-fonte, o alvo do projeto
  e se os tipos declarados e inferidos foram concluídos ou alargados por um
  limite.
- As declarações (`-type`, `-spec`, `-callback`, records) aparecem tal como
  foram escritas.
- Acima de cada função, `%% declared: f(Inputs) -> Result` dá cada sobrecarga
  da sua `-spec` tal como foi resolvida (com as suas restrições `when`), e
  `%% inferred: f(Inputs) -> Result` o que a inferência encontrou, para que os
  dois possam ser comparados. As entradas são o domínio de sucesso de cada
  argumento (a partir de `term()` para as funções exportadas e para as que
  `fun F/A` nomeia, a partir dos argumentos juntos dos chamadores para as
  outras funções). Uma função com vários tipos de função imprime uma
  assinatura por tipo, cada uma com as suas próprias entradas:
  `f(integer()) -> integer(); (atom()) -> string()`
  (`semantic::types::function_source`). Uma `-spec` fica junto da função logo a seguir a
  ela, separada das outras formas por uma linha em branco.
- As expressões cujo facto diz mais do que `term()` são anotadas
  `Expression :: Type` (um tipo conhecido esconde uma relação com um argumento,
  que só aparece para um valor que não se sabe ser mais nada): entre
  parênteses dentro de outras expressões, sem eles
  para uma expressão completa do corpo. Os termos literais (literais, e tuplos,
  listas, maps construídos e bitstrings de literais) e as correspondências não
  são anotados (o lado direito de uma correspondência é).
- Um valor que a inferência provou ser igual a um dos argumentos da função, e
  que não se sabe ser mais nada, é impresso com o nome desse argumento, uma
  variável de tipo: a variável que lhe dá a primeira cláusula que vincula o
  argumento inteiro, caso contrário `_argumentN` (a partir de 1, também quando
  um argumento anterior tomou o nome). A entrada do argumento mostra o mesmo
  nome quando é qualquer termo:
  `second(_, Y) -> Y`, `keep(Acc, number()) -> Acc`. Uma variável mostra
  apenas o seu tipo; o seu nome já diz de que argumento se trata.

### Expectativas de inferência

`tests/fixtures/inference/*.erl` registam o que a inferência deveria encontrar
para cada função e o que encontra hoje. Cada módulo torna-se o CTest
`inference_<module>` (`tests/compiler/inference/expectations.py`):

```erlang
%% expect: sum() -> 3
%% today: sum() -> _
sum() -> 1 + 2.
```

- `expect:` é a assinatura que `--print-types` deveria imprimir na sua linha
  `%% inferred:`; `today:`, presente enquanto a inferência fica aquém, é a que
  imprime agora.
- A verificação compara a saída com `today` quando existe, caso contrário com
  `expect`; cada função do módulo precisa de uma linha `expect`. Uma linha
  `today` que a inferência já alcançou faz falhar a verificação até ser
  removida.
- `expectations.py <clau> <fixture> --record` reescreve as linhas `today` a
  partir da saída atual (uma ação de manutenção: reveja o diff).
- `values.erl` abrange literais, aritmética e comparações, chamadas de funções
  locais e de outras funções, junções e intervalos de inteiros, inteiros ou
  floats, listas, strings, tuplos, maps com chaves átomo e outras, funs
  devolvidas e aplicadas, binaries, relações com argumentos e valores de
  `try`/`maybe`. Hoje a inferência encontra valores literais e
  construídos, resultados de operadores e builtins, contentores e as suas
  partes, funs e as suas chamadas, entradas locais a partir dos chamadores,
  junções de inteiros e relações com argumentos, estreitamento por usos e
  domínios de sucesso (141 de 141 funções).
- `narrowing.erl` abrange cada teste de tipo, guards de case, valores
  examinados com teste verdadeiro, `andalso`, filtros de comprehension,
  padrões de tuplo/lista/map, cláusulas que apanham tudo, guards de intervalo,
  contradições, disjunções, a cláusula após um único teste de tipo, o
  estreitamento após uma chamada, estreitamentos que não podem escapar, e
  intervalos de comparação: cada operador de qualquer lado, duas variáveis,
  `=/=` num limite e dentro dele, complementos, guards de case e de if, um
  `orelse`, uma contagem decrescente com guard, e operandos que não podem ser
  estreitados (51 de 51).
- `base_types.erl` tem uma função por cada tipo base e built-in da
  [linguagem de tipos](https://www.erlang.org/doc/system/typespec.html)
  (`pid()`, `reference()`, bitstrings e binaries, intervalos, `byte()`,
  `char()`, `non_neg_integer()`, `boolean()`, `string()`, `iolist()`,
  `mfa()`, `timeout()`, `no_return()`, ...): a sua `-spec` nomeia o tipo, pelo
  que se verifica que cada tipo built-in é resolvido, e o seu corpo produz um
  valor desse tipo. As categorias são esperadas sob os seus nomes built-in, os
  conjuntos de inteiros limitados como intervalos. Todas as funções atingem o
  seu tipo esperado.
- `clauses.erl` abrange os tipos de função (step 58K): testes de tipo e
  padrões literais por cláusula, entradas iguais fundidas, uma cláusula em que
  os chamadores nunca entram, mais cláusulas do que o orçamento, uma função
  recursiva, uma única cláusula, um `case` e um `if` a terminar o corpo, um
  `case` aninhado e um `case` que não é o último, funs anónimas com várias
  cláusulas, `fun F/A`, junções de funs iguais e diferentes, e uma cláusula que
  lança sempre; a seleção de chamadas (step 58L): um teste de tipo, um
  primeiro ramo exato, argumentos desconhecidos, nenhum tipo admitido, o
  estreitamento após a chamada, um argumento literal, um intervalo sobre duas
  cláusulas, chamadas aninhadas, uma função local com vários chamadores, uma
  função chamada recursiva, e funs com várias cláusulas vinculadas, num tuplo,
  passadas a uma função local e chamadas com um argumento desconhecido; e a
  avaliação por chamada (step 58M): resultados por chamada, aninhamento até ao
  orçamento de profundidade e para além dele, uma função chamada acima do
  orçamento de tamanho, uma função chamada recursiva e argumentos
  desconhecidos.

### Impressão de tipos

`semantic::types::type_source(graph, type)` (`semantic/types/printing`)
apresenta um tipo do grafo de tipos na sintaxe de tipos do Erlang: `_` para
qualquer termo (`term()`, escrito por `TERM_SOURCE` por brevidade; a sintaxe de tipos lê `_` como `any()`),
`none()`, átomos e inteiros, `1..5`, `{ok, T}`, `tuple()`, `[T]`,
`[T, ...]`, `#{K => V, K := V}`, `#r{f :: T}`, `<<_:B, _:_*U>>`,
`fun((A) -> R)`, `A | B`. Uma fun com vários tipos de função imprime-os numa
notação do Clause, `fun((1) -> one; (_) ->
other)`: a sintaxe de tipos do Erlang não tem um tipo fun sobrecarregado, e
uma união de tipos fun significa outra coisa. Os inteiros de uma união
são impressos pela ordem dos valores, na posição do seu primeiro inteiro, e os
consecutivos como intervalo (`1 | 2 | 3 | 5` imprime `1..3 | 5`; o facto
mantém os singletons).
Os tipos `erlang`
predefinidos perdem o seu módulo; as referências a tipos declarados
permanecem nomeadas. Um orçamento de nós limita o texto; para além dele, e
abaixo de 32 níveis de aninhamento, `...` ocupa o seu lugar.

```sh
clau --print-types answer.erl client.erl
clau --print-types --project project.toml --target demo --verbose
```
