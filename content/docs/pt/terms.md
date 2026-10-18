---
source: docs/terms.md
sourceCommit: 336caea7
sourceSha256: 96b812193b9f942c57eed9d94df4955f308354e89e00cc00f4d46f19b54c2882
translatedAt: 2026-10-18
---
# Representação dos termos

Tipos admitidos: átomos/booleanos, inteiros arbitrários, floats binary64
finitos, tuplos, listas próprias/impróprias e strings, maps, bitstrings e
records comuns em tuplo; native records ([native records](native-records.md));
funs ([valores de função](funs.md)); pids, ports e referências locais
([abaixo](#pids-and-references), [ports](ports.md#identity)). As codificações
em palavras estão em [abi.md](abi.md#terms).

## Propriedade

- Os valores compostos vivem no heap do seu processo
  ([contrato do heap](runtime-heap.md)) ou na área de literais só de leitura de
  um módulo ([áreas](runtime-heap.md#areas)). Os ponteiros de processo designam
  sempre o início de objetos. A admissão (apenas em compilações Debug; Release
  confia nas palavras, `CHECKED_ADMISSION`) verifica o intervalo possuído e a
  forma do cabeçalho, rejeitando endereços alheios e formas inválidas
  ([admissão](runtime-heap.md#admission)); o tipo e a extensão são
  descodificados do cabeçalho.
- Um `Term` do anfitrião é exatamente uma `Word`, trivialmente copiável, apenas
  com `value_`. Um Term de heap é válido até à próxima recolha do seu heap ou à
  saída do processo ([raízes](runtime-heap.md#roots-and-safe-points)); não fixa
  nada nem transporta heap, token de tempo de vida ou contagem de recolhas. O
  acesso após esse momento lê memória movida ou libertada e é indefinido; não
  existe erro `stale_term`. A destruição é segura. As fábricas, reservas e
  buffers de mensagens mantêm as suas próprias verificações de tempo de vida
  e continuam a indicar `expired_context`.
- A construção valida os filhos, reserva, inicializa e depois publica num só
  passo; uma falha reverte o armazenamento e os contadores.
- `Term::from_word(word)` admite apenas imediatos independentes do dono;
  `Term::from_word(word, context)` admite também átomos e termos de heap desse
  contexto. A passagem dentro do mesmo heap mantém a identidade.
  `copy_to`/`ProcessHeap::add` copiam um grafo de outro processo sob um contrato
  do chamador que exige o mesmo runtime; as fábricas de termos recusam entradas alheias com
  `wrong_owner`
  ([cópia entre heaps](runtime-heap.md#copying-between-heaps)).
- As células vivem até que uma recolha as encontre inalcançáveis, ou até à
  destruição do heap ([recolha](runtime-heap.md#collection)).

## Átomos

- `AtomStorage` por runtime, internado de forma preguiçosa pela grafia UTF-8
  exata, sem normalização nem remoção. `RuntimeOptions::max_atoms` 1..2^26, por
  omissão 2^20; os nomes de módulos/exportações contam. Grafias existentes
  continuam a ser aceites quando a capacidade está esgotada.
- Até 255 escalares Unicode; vazio, NUL e caracteres suplementares permitidos;
  UTF-8 malformado/sobrelongo/com surrogates é rejeitado.
- Os conteúdos vêm de um contador global do processo e nunca são reutilizados,
  mesmo entre runtimes. O índice global contém 2^28 números, limitados pela
  carga útil de átomo da palavra em alvos de 32 bits (2^26 identidades durante
  a vida do processo). Os limites por runtime mantêm-se. Os números de átomo
  nunca saem de um nó: ETF e os formatos em disco usam grafias.
- `detail::atom_table` fornece leituras sem bloqueios por número de átomo:
  registos fixos diretamente, depois blocos de 4 096 slots mantidos durante a
  vida do processo. Cada `AtomStorage` possui os seus registos por grafia,
  publica-os neste índice e admite apenas registos seus ou fixos. A desmontagem
  retira os seus slots.
- Os Terms de átomo não fixam nada. `atom_spelling()` empresta a grafia até à
  desmontagem do runtime; tanto esta função como `atom_utf8()` indicam
  `expired_context` após a desmontagem do runtime de um átomo não fixo. Mover
  um átomo entre runtimes significa internar a sua grafia no destino enquanto
  o runtime de origem está vivo.
- Os booleanos são os átomos `true`/`false`. Os átomos fixos `false`, `true`,
  `undefined`, `ok` e `error` (`abi::v1::fixed_atom_spellings`) têm as palavras
  dos números de átomo 0–4 em todos os runtimes, com registos estáticos imortais,
  encontrados sem o bloqueio e não contados nem por `size()` nem
  para `max_atoms`; o código gerado usa-os como constantes. Todas as outras
  palavras de átomo são privadas do runtime.
- Os literais compostos de constantes (strings, listas e tuplos de imediatos e
  de outros literais, floats, bignums) são células da área de literais do
  módulo, construídas em tempo de compilação e partilhadas
  ([áreas de literais](runtime-heap.md#areas)); os literais inteiros no
  intervalo pequeno são imediatos.
- Os outros literais de átomo são carregados da cache de átomos do módulo
  (`ModuleDescriptor::atom_cache`: a identidade do runtime que a reivindica e
  depois uma palavra por slot), que o primeiro runtime a registar o módulo
  preenche; um contexto cujo `FrameState::runtime` corresponda à reivindicação
  lê-a sem chamada, qualquer outro chama `CLAUSE_atom_v3`. A reivindicação é
  devolvida quando o code server do runtime liberta o módulo.
- Internar e procurar são seguros a partir de workers concorrentes do
  escalonador ([threads](runtime.md#threads)); uma grafia mantém uma só palavra.

## Inteiros

- Os valores que cabem no conteúdo de 28/60 bits do alvo são imediatos; os
  maiores são células imutáveis de sinal/magnitude. O zero e os valores pequenos
  são sempre normalizados para imediatos. Os literais não são estreitados à
  largura do anfitrião.
- Em `-O2`, os operandos que a inferência prova serem pequenos dispensam os
  testes de etiqueta, e um intervalo de resultado provado dispensa também a
  verificação de overflow e o recurso alternativo
  ([provas](specialization.md#proofs)).
- Os `+`, `-`, `*` gerados tentam um caminho rápido inline sobre dois
  imediatos; caso contrário, chamam o serviço do runtime: `+` e `-` somam ou
  subtraem diretamente as palavras etiquetadas (`a + (b ^ 15)`) e recorrem à
  alternativa quando a palavra transborda, o que acontece exatamente quando o
  resultado sai do intervalo pequeno; `*` calcula em largura dupla com limites
  explícitos. O mesmo fazem `band`, `bor`, `bxor`, `bsr`, `div`, `rem` e as
  comparações de dois inteiros pequenos
  ([formas inline](abi.md#runtime-services)).
- `div` trunca em direção a zero; `rem` toma o sinal do dividendo; as operações
  bit a bit usam complemento para dois infinito; contagens de deslocamento
  negativas invertem a direção; deslocamentos enormes para a direita saturam em
  0 ou -1.
- Erros: operandos errados e divisor zero → `badarith`; `abs/1` → `badarg`.
- Limites: como no ERTS, uma magnitude de no máximo `BIG_ARITY_MAX` palavras:
  4 194 240 bits em alvos de 64 bits (65 535 palavras), 4 194 272 em 32 bits
  (131 071 palavras); o texto decimal acompanha (1 262 593 e 1 262 602
  dígitos). Um resultado aritmético maior lança `error:system_limit` num corpo
  (`ValueOutcome::system_limit`, [ABI](abi.md#failure-channel-revision-2)) e
  faz falhar uma guard; um segmento inteiro que extraia um valor maior não
  corresponde. O compilador rejeita um literal acima de 4 194 240 bits
  (`illegal integer`, como o scanner do OTP) e um padrão constante acima disso
  (`illegal pattern`).

## Floats

- Os bits IEEE binary64 passam para o runtime como oito bytes em ordem de rede;
  NaN e infinito são rejeitados. Sem fast-math.
- `+ - *` mantêm-se exatos sobre dois inteiros; qualquer operando float usa
  binary64. `/` converte sempre ambos. Resultados não finitos e divisores zero →
  `badarith`.
- `float/1` arredonda para o par mais próximo; `round/1` desempata afastando-se
  de zero; `trunc`, `floor`, `ceil` devolvem inteiros arbitrários. Operandos
  inválidos → `badarg`.
- A igualdade exata distingue `1` de `1.0` e `0.0` de `-0.0`; a comparação
  numérica compara a parte inteira exata e a fração do float, sem nunca
  arredondar o inteiro. `min/max` devolvem o primeiro operando em caso de
  empate.

## Tuplos, listas, strings

- Tuplo: cabeçalho de aridade + campos. Cons: palavras de cabeça + cauda. `{}` e
  `[]` são imediatos. As strings são listas de pontos de código. As listas não
  têm limite de comprimento além da memória (incluindo um orçamento de heap
  opcional). Os tuplos contêm até 16 777 215 elementos (`MAX_TUPLE_ARITY`, o
  `MAX_ARITYVAL` do OTP); os construtores comunicam um maior como
  `resource_limit`; os builtins (`make_tuple`, `list_to_tuple/1`) lançam
  `badarg`.
- Serviços: `hd`, `tl`, `length`, `tuple_size`, `size`, `element` com base 1.

## Maps

- Tabelas imutáveis ordenadas pela ordem exata das chaves. Chaves duplicadas na
  construção mantêm o último valor. A construção ordena as chaves (O(n log n)
  comparações; chaves já ascendentes são apenas verificadas). Até 32 entradas,
  um map é uma única célula de heap e uma atualização insere por pesquisa
  binária numa cópia; acima disso, é uma árvore B+ de células de heap
  atualizada por cópia do caminho em O(log n)
  ([árvores de maps](runtime-heap.md#map-trees)). Sem limite de tamanho ou de
  trabalho além da memória, como no OTP. Chaves inteiras e float diferem
  (também `0.0` vs `-0.0`, também aninhadas).
- As atualizações `K := V` exigem a chave; `K => V` insere ou substitui. As
  atualizações preparam uma nova tabela e publicam uma única vez.
- Erros no corpo: `{badmap, M}`, `{badkey, K}`; as guards rejeitam em vez
  disso.
- Serviços: `is_map`, `map_size`, `map_get`, `is_map_key`, construção,
  atualização.

## Bitstrings

- Empacotados com o bit mais significativo primeiro, com comprimento exato em
  bits e preenchimento a zeros. Até 64 bytes vivem inline num binary de heap
  dimensionado aos dados; os valores maiores usam um buffer imutável partilhado
  fora do heap, e as fatias são células sub-binary do seu original
  ([binaries fora do heap](runtime-heap.md#off-heap-binaries)). Não há limite
  de tamanho além de um orçamento opcional de heap do processo; os segmentos
  inteiros são escritos sem construir um inteiro tão largo como o segmento.
- A construção prepara todos os segmentos antes de publicar. Os segmentos
  inteiros truncam; a ordem de bytes nativa vem da disposição de dados do alvo.
  Um segmento inteiro de um valor pequeno e de largura não superior a 64 bits é
  escrito a partir da sua palavra de máquina (bytes inteiros de uma só vez num
  limite de byte); os outros seguem o caminho de precisão múltipla. O código
  gerado constrói inline as construções pequenas de largura constante
  ([frames e transferências](abi.md#frames-and-transfers)).
- Acréscimos, como os binaries graváveis do OTP: uma construção que começa com
  um binary inteiro (`<<Acc/binary, ...>>`) constrói o seu resultado num buffer
  com espaço de reserva (o dobro do seu tamanho, pelo menos 256 bytes) cuja
  célula fora do heap no processo criador regista os bits em uso e a capacidade
  (zero em todas as outras células, cópias incluídas). Um acréscimo posterior
  cuja vista do acumulador termine exatamente aí escreve os novos bytes no
  espaço de reserva, que nenhuma vista cobre, e devolve uma vista mais longa do
  mesmo buffer: um sub-binary da própria célula fora do heap do buffer, que pode
  ir além dos bits dessa célula. Qualquer outro acumulador (uma vista mais
  antiga, a de outro processo, uma não alinhada, um buffer cheio) é copiado
  para um novo buffer duplicado. As outras vistas do buffer nunca mudam.
- Segmentos float: larguras 16/32/64; a construção pode codificar infinito, mas
  a correspondência rejeita campos infinitos/NaN. Correspondências float de
  largura zero extraem `0.0`.
- Os segmentos UTF-8/16/32 validam escalares, surrogates e truncagem.
- A correspondência avança um cursor de bits explícito apenas em caso de
  sucesso; `:all` como tamanho explícito é inválido.
- Serviços: `is_binary`, `is_bitstring`, `bit_size`, `byte_size` (arredonda
  para cima), `size` (arredonda para baixo), `binary_part/2,3`. Erros →
  `badarg`.

## Records

- Os records comuns expandem-se em tuplos `{Tag, Fields...}`. As declarações
  devem preceder o uso; duplicados, campos desconhecidos, referências
  antecipadas/a si próprio e campos curinga inválidos são erros.
- A construção avalia os campos pela ordem da declaração: valor explícito,
  senão o valor por omissão curinga `_ = V`, senão o valor por omissão
  declarado, senão `undefined`. Cada valor por omissão é avaliado separadamente
  em cada uso.
- Os padrões verificam a aridade e a etiqueta e depois apenas os campos
  listados. `#r.f` é o índice com base 1 (a etiqueta na posição 1).
- O acesso a campos verifica a aridade e a etiqueta; a falha é `{badrecord, V}`
  nos corpos e rejeição nas guards.
- `is_record(V, r)` usa a aridade declarada. `is_record/3` precisa de uma
  etiqueta átomo e de uma aridade inteira (não positiva → falso; tipos errados →
  `badarg`); um terceiro argumento átomo é a consulta de native record e
  devolve falso. As guards exigem argumentos literais.
- A atualização `Expr#r{f = V, ...}` avalia os novos valores pela ordem do
  código-fonte, depois `Expr`, depois verifica a aridade e a etiqueta
  (`{badrecord, Value}` em caso de discordância, também para `Expr#r{}`) e
  constrói um novo tuplo; os restantes campos são copiados. `_ = V` é rejeitado
  em atualizações; as atualizações são ilegais em padrões e guards.
- `record_info(fields | size, r)` expande-se em tempo de compilação para a lista
  de nomes de campos ou para o tamanho do tuplo. Ambos os argumentos devem ser
  átomos literais e `r` um record em tuplo declarado anteriormente; é ilegal em
  guards, e uma `record_info/2` local é rejeitada como já definida.
- Native records: [native records](native-records.md) (formas locais,
  qualificadas, importadas e anónimas).

## Pids e referências

`self/0` devolve o pid do processo chamador, `make_ref/0` uma nova referência;
`pid_to_list/1` e `ref_to_list/1` devolvem o seu texto.

- Um pid é uma palavra imediata (quatro bits inferiores `0x3`) que contém o
  número do processo. Os números vêm de uma única sequência global do processo e
  nunca são reutilizados, pelo que um runtime só admite uma palavra de pid se
  tiver emitido esse número: uma palavra forjada (nunca emitida) ou o pid de
  outro runtime é `wrong_owner`. O pid de um processo terminado continua a ser
  um termo válido, como no OTP. Os alvos de 32 bits têm 2^28 números por
  execução do programa, os de 64 bits 2^60; criar um processo para além deles
  falha com `resource_limit`.
- Um port é uma palavra imediata (quatro bits inferiores `0x7`) que contém o seu
  número, proveniente da sua própria sequência nunca reutilizada, e é admitido
  como um pid; é impresso como `#Port<0.N>` e ordena-se entre funs e pids
  ([ports](ports.md#identity)).
- Uma referência é uma célula de heap (`reference`: cabeçalho mais um número de
  64 bits não rastreado) admitida como qualquer termo de heap: apenas no seu
  próprio processo, copiada por valor entre processos. Um `Term` do anfitrião
  sem raiz não pode ser acedido após a recolha ou a saída do processo. Os números vêm de um único contador global
  do processo, pelo que cada referência de uma execução do programa é única.
- Uma referência handle (uma magic reference do OTP) é uma célula de referência
  que também contém um buffer fora do heap; é a mesma referência para todos os
  serviços e partilha o seu buffer com todas as cópias
  ([referências handle](runtime-heap.md#handle-references)).
- A impressão segue as identidades locais do OTP: um pid como `<0.N.S>` (N os 28
  bits inferiores do seu número, S o resto), uma referência como
  `#Ref<0.A.B.C>` (C os 18 bits inferiores do seu número, B os 32 seguintes, A o
  resto), tanto no estilo `~w` como no de display. Os pids ordenam-se por
  número, as referências por número, pelo que as referências posteriores de um
  programa ficam depois das anteriores.

## Comparação e ordem

Iterativa e sem limite de trabalho, como no OTP: apenas a memória para os pares
pendentes limita uma comparação, incluindo as pesquisas de chaves de map, e
palavras idênticas são iguais sem percurso. Os bitstrings alinhados ao byte
comparam bytes inteiros de uma vez. Ordem: números < átomos < referências <
funs < ports < pids < tuplos < native records < maps < nil < listas <
bitstrings ([as funs](funs.md#comparison-and-printing) ordenam-se entre si).
Os átomos comparam-se pela grafia UTF-8 (ordem dos pontos de código); os tuplos
pela aridade e depois pelos campos; os maps pelo tamanho, depois pelas chaves e
depois pelos valores; os bitstrings pelos bits lógicos. Dois inteiros pequenos,
dois floats ou dois binaries de bytes inteiros são ordenados diretamente a
partir das suas palavras ou células (`detail::word_order`), e dois átomos a
partir das suas grafias na tabela de átomos (`AtomStorage::spelling`, através
do índice numérico sem bloqueios), sem admissão de termos.

## Impressão

`format_term` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
apresenta qualquer termo admitido num de dois estilos do OTP. Os inteiros, os
tuplos (os records são tuplos) e o aninhamento têm o mesmo aspeto em ambos.

| | `~w` (`TermStyle::write`) | `erlang:display/1` (`TermStyle::display`) |
| --- | --- | --- |
| Átomos | Entre aspas, exceto se começar por uma letra minúscula Latin-1 seguida de caracteres de nome (com `@`); as palavras reservadas e `maybe`/`else` levam aspas; fora do Latin-1 escapa como `\x{H}` | Entre aspas, exceto se começar por uma letra minúscula Latin-1 seguida de alfanuméricos ou `_`; as palavras reservadas e `@` não têm regra especial; o UTF-8 é mantido |
| Floats | A representação mais curta que preserva o valor, na disposição do OTP: `0.1`, `100.0`, `1.0e16`, `1.5e-7` | C `%.6e`: `1.500000e+00` |
| Listas | Elementos: `[104,105]`, `[1,2\|3]` | Uma lista plana de bytes Latin-1 imprimíveis é impressa como `"hi"` (bytes em bruto; apenas `\n` e `"` são escapados) |
| Bitstrings | `<<1,2,5:3>>` | Um binary ASCII imprimível é impresso como `<<"hi">>`, os restantes como `~w` |
| Maps | `#{k => v,k2 => v2}` | `#{k=>v,k2=>v2}` |

- Os maps são impressos pela ordem das chaves (`maps:iterator(M, ordered)`,
  como `~kw` do OTP). O `~w` por omissão e o `erlang:display/1` do OTP seguem
  antes a sua disposição interna: ordem da tabela de átomos para chaves átomo de
  maps pequenos (varia entre execuções da VM) e ordem de hash acima de 32
  chaves. O Clause não reproduz essa ordem.
- A apresentação é iterativa, pelo que a profundidade só é limitada pelo termo.
  O texto está limitado a 64 MiB por omissão; excedê-lo (por exemplo, um
  subtermo muito partilhado) falha com `resource_limit` e não devolve texto
  parcial.
- Goldens: `runtime_printing` compara ambos os estilos com o OTP (todos os
  resultados do corpus mais casos-limite escritos à mão); as linhas de display
  cuja ordem de map no OTP é interna são ignoradas
  ([fixtures](../tests/fixtures/printing/README.md)).
