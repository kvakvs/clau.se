---
source: docs/funs.md
sourceCommit: 6ed3851c
sourceSha256: d6183dca6e3b3f09dea66c149577541528e02b41b04f721c8d768762926ac676
translatedAt: 2026-10-15
---
# Valores de função

`fun F/A`, `fun M:F/A`, funs anónimas com
variáveis capturadas (closures), funs com nome (`fun Name(...) -> ... end`),
chamadas de valores de função (`F(Args)`) e chamadas dinâmicas (`M:F(Args)`,
`apply/2,3`). Os factos vêm dos códigos-fonte fixados `maint-29`
(`erts/emulator/beam/utils.c` `erts_cmp`, `erl_printf_term.c`, `erl_lint`) e
de sondagens no OTP 29.1.1.

## Valores

| Origem | Valor | As chamadas entram em |
| --- | --- | --- |
| `fun f/1` | Fun local deste módulo; todos os `fun f/1` de um módulo são o mesmo valor | `f/1` deste módulo, exportada ou não |
| `fun m:f/1` | Fun externa que designa `m:f/1`, também para o módulo atual | `m:f/1` quando um módulo do programa a exporta |
| `fun(X) -> ... end` | Fun local que captura as variáveis que lê do seu criador; cada avaliação constrói um novo valor | A função gerada própria da fun |
| `fun Name(X) -> ... end` | O mesmo, com `Name` associado à fun dentro das suas cláusulas | A função gerada própria da fun |
| `fun M:F/A` com variáveis | Fun externa construída ao ser avaliada; igual à fun literal `fun m:f/1` que designa | `m:f/1` quando um módulo do programa a exporta |

- `fun F/A` tem de designar uma função do módulo (`function F/A undefined`)
  ou um builtin auto-importado: `fun is_atom/1` é a fun externa
  `erlang:is_atom/1`. As funs de builtins chamam-nos através da
  [ponte de builtins](builtins.md); um builtin fora do seu catálogo
  (`fun self/0`, `fun erlang:apply/2`) indica a capacidade `dynamic calls`
  indisponível.
- `F(Args)` avalia `F`, depois os argumentos da esquerda para a direita, e
  depois verifica o valor: algo que não seja uma função lança `{badfun, F}`,
  outra aridade `{badarity, {F, Args}}` (verificado antes do módulo), uma fun
  externa cuja função nada no programa exporta `undef`. Uma chamada em posição
  de cauda é uma chamada de cauda, como para as funções com nome.
- `is_function/1,2` são verdadeiros para funs em corpos e em guards.

## Chamadas dinâmicas

- `M:F(Args)` com uma variável (ou qualquer expressão) como módulo ou função
  avalia o módulo, depois a função, depois os argumentos da esquerda para a
  direita. Um módulo ou função que não seja um átomo lança `badarg`; uma
  função que nenhum módulo do programa exporte com essa aridade lança `undef`.
  Uma chamada em posição de cauda é uma chamada de cauda.
- `apply(Fun, Args)` e `apply(M, F, Args)` (auto-importados, a não ser que o
  módulo defina `apply/2,3` ou suprima a importação; também
  `erlang:apply/2,3`) avaliam os seus argumentos e depois exigem que `Args`
  seja uma lista própria (`badarg`). `apply/2` chama então `Fun` como faz
  `F(Args)` (`{badfun, Fun}`, `{badarity, {Fun, Args}}`); `apply/3` procura
  `M:F/length(Args)` como acima, pelo que mais de 255 argumentos lançam
  `undef`. Ambos são chamadas de cauda em posição de cauda e nunca são legais
  em guards.
- `fun M:F/A` com variáveis lança `badarg`, a não ser que `M` e `F` sejam
  átomos e `A` um inteiro em 0..255; a função não precisa de existir até a fun
  ser chamada.
- A pesquisa usa as tabelas de exportação dos módulos do programa, que se
  mantêm registadas durante toda a vida do programa, pelo que uma função
  encontrada não pode desaparecer durante a chamada. Percorre os módulos e as
  suas exportações, comparando palavras de átomos; os índices com hash map são
  o step 62A do plano. Um nome que nenhum módulo exporta é depois procurado
  entre os [builtins](builtins.md), pelo que `M:F(...)`, `apply/3` e
  `fun M:F/A` em tempo de execução chegam aos builtins `erlang` do catálogo da
  ponte.
- **Serviços.** `CLAUSE_call_v1(context, module, function, arity)` verifica os
  nomes e devolve o `FrameDescriptor` da exportação (a revisão 8 da ABI
  acrescenta-o a `ExportDescriptor`); os argumentos já estão nos registos.
  `CLAUSE_apply_list_v1(context, fun, list, registers)` e
  `CLAUSE_call_list_v1(context, module, function, list, registers)` copiam
  primeiro a lista para os registos. Os três devolvem null depois de
  registarem o erro, e o código gerado transfere então o controlo através do
  marcador `clause.apply`, como para `F(Args)`.
  `CLAUSE_make_external_fun_v1` constrói a fun de uma `FunDefinition` externa
  que o code server cria uma vez por `M:F/A` (`CodeServer::external_fun`).

## Closures

- Cada cláusula parte do âmbito no ponto da fun. As variáveis da cabeça são
  nomes novos que ocultam os exteriores (o OTP avisa); um nome repetido numa
  mesma cabeça tem de corresponder. As guards leem os nomes da cabeça. Nada do
  que uma fun associa é visível depois dela, e os nomes das cláusulas case da
  função envolvente não chegam ao seu interior.
- Uma fun captura todas as definições exteriores que as suas cabeças, guards
  ou corpos leem (incluindo funs aninhadas), pela ordem de definição, tal como
  o OTP ordena as variáveis livres de uma função. Os valores capturados são
  copiados para a célula da fun quando a expressão fun é avaliada, pelo que
  sobrevivem ao regresso do criador e às recolhas, e são copiados com a fun.
- O código é uma função privada `-f/A-fun-N-` (N conta as funs de `f/A` pela
  ordem do código-fonte) que recebe os argumentos da fun e depois os seus
  valores capturados; os rastreios de pilha mostram esse nome com a aridade
  combinada, como os do OTP. Se nenhuma cláusula corresponder, é lançado
  `function_clause`.
- Os argumentos mais os valores capturados estão limitados a 255.
- As cláusulas de uma fun com nome veem `Name` como a própria fun: um nome
  novo que oculta um exterior (o OTP avisa), nunca capturado e não visível
  depois da fun. Uma variável da cabeça com o mesmo nome oculta-o por sua vez.
  Quando uma cláusula lê `Name`, o código da fun constrói o valor à entrada a
  partir dos seus valores capturados, pelo que é igual (`=:=`) à fun que está a
  ser chamada, e `Name(...)` é uma chamada de fun normal: em posição de cauda é
  uma chamada de cauda e corre em pilha constante.
- Uma fun anónima no valor por omissão de um campo de record é uma única fun
  para todas as construções que usam esse valor (o OTP expande uma cópia por
  local).

## Representação

- **Descritor.** Cada valor distinto que um módulo cria compila para um
  `abi::v1::FunDescriptor` na tabela privada `<prefix>.funs` do módulo
  ([funs.hpp](../abi/include/clause/abi/funs.hpp)): descritor do módulo,
  slots dos átomos do módulo e da função, aridade Erlang, índice, flag de
  externa e o `FrameDescriptor` em que uma chamada entra (null para uma fun
  externa fora do programa). O registo associa-os a `FunDefinition`s
  (`ModuleAtoms::funs`, `CodeServer::fun_definition`); o número de valores
  capturados de uma fun local é a aridade do seu código menos a da fun.
- **Célula.** Tipo boxed `fun_closure`: cabeçalho (contagem `1 + n`), um
  `const FunDefinition *` não rastreado e depois `n` valores capturados. O
  percurso, a recolha, a cópia e a verificação saltam a palavra da definição,
  como para os native records.
- **Serviços.** `CLAUSE_make_fun_v1(context, descriptor, captures, count,
  output)` constrói uma fun. `CLAUSE_apply_v1(context, fun, arity, arguments)`
  verifica um valor chamado, regista os erros acima no canal de falhas
  (`ErrorReason` 22-24) e, caso contrário, acrescenta os valores capturados
  depois dos argumentos e devolve o `FrameDescriptor` em que entrar.
- **Closures inline** (ABI 21). O runtime que reivindica a cache de átomos de
  um módulo também preenche `ModuleDescriptor::fun_cache` com o endereço da
  definição de cada fun; enquanto a reivindicação for sua, o código gerado
  aloca ele próprio a célula da fun por incremento de ponteiro (cabeçalho,
  definição, valores capturados) e chama `CLAUSE_make_fun_v1` apenas quando
  não há espaço no heap ou noutro runtime. `CLAUSE_apply_v1` e
  `CLAUSE_apply_list_v1` leem uma fun com a aridade certa (e a lista de
  argumentos) diretamente das suas células antes do caminho verificado que
  comunica os erros.
- **Chamadas.** A forma nativa passa os argumentos num array de palavras e
  chama o marcador `clause.apply` com o descritor; `lower_frames` faz do array
  os registos do processo e do marcador uma transferência através de
  `CLAUSE_enter_v1` ou, em posição de cauda, de `CLAUSE_tail_v1`.

## Comparação e impressão

- Ordem dos termos: número < átomo < fun < tuplo < native record < map < nil
  < lista < bitstring (as referências, os ports e os pids, que no OTP ficam
  entre os átomos e os tuplos, ainda não existem).
- As funs locais ordenam-se antes das funs externas. As funs locais
  comparam-se por módulo, depois por índice, depois pelos valores capturados
  por ordem (`==` compara-os com `==`); as funs externas por módulo, função e
  aridade. Descritores iguais dão valores iguais, pelo que
  `fun f/1 =:= fun f/1`.
- `erlang:display/1`, `~w` e os relatórios de exceções não apanhadas imprimem
  uma fun externa como `fun m:f/1` (átomos entre aspas como faz o emulador) e
  uma fun local como `#Fun<m.Index.0>`.

## Diferenças

Registadas em [diferenças](differences.md):

- Uma fun local é impressa como `#Fun<m.Index.0>`: o índice do OTP segue a
  numeração de lambdas do seu compilador e a terceira parte é um hash do
  código do módulo. O Clause numera as funs locais pela ordem do código-fonte,
  pelo que a ordem de duas funs locais de funções diferentes de um módulo
  também pode diferir.
- Chamar uma fun externa de um módulo fora do programa lança `undef`; o OTP
  tentaria primeiro carregar o módulo a partir do code path. O mesmo se aplica
  a `M:F(Args)` e a `apply/3`.
- Um rastreio de pilha de `undef` começa com o frame do chamador; o do OTP
  começa com `{M, F, Args, []}` da função em falta.
- Os nomes das funs anónimas (`-f/1-fun-0-`, vistos nos rastreios de pilha)
  contam as funs pela ordem do código-fonte; o compilador do OTP numera-as pela
  sua própria ordem. As funs criadas dentro de comprehensions também podem
  capturar os seus valores numa ordem diferente da do OTP, o que só se nota
  quando se comparam duas dessas funs.

## Informação de funs

Fonte: `builtins/erlang/fun_info.cpp`. `erlang:fun_info/1`
lista os itens do OTP pela ordem do OTP: para uma fun local `pid`, `module`,
`new_index`, `new_uniq`, `index`, `uniq`, `name` (`-F/A-fun-N-` para uma fun
anónima), `arity`, `env` (os valores capturados) e `type`; para
`fun M:F/A` `module`, `name`, `arity`, `env` (`[]`) e `type`.
`fun_info/2` devolve um `{Item, Value}`; um item desconhecido é `badarg`.
`pid` é `undefined`, `new_uniq` o MD5 do nome do módulo e `uniq` os seus
primeiros 24 bits, pelo que diferem dos do OTP. `fun_to_list/1` é o texto
`~w`. `is_builtin/3` é verdadeiro para os builtins do runtime e para
`erlang:apply/2,3`.
