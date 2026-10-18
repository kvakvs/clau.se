---
source: docs/io.md
sourceCommit: 336caea7
sourceSha256: f513079db5cb8e2a7c9e02f15d3c952b9271d64d60cc3c3787cc2eee5efb3a15
translatedAt: 2026-10-18
---
# Saída para a consola (`io`)

`io:format/1,2,3`, `io:fwrite/1,2,3`, `io:put_chars/1,2` e `io:nl/0,1` são
builtins do runtime do módulo `io` no catálogo da ponte
([builtins](builtins.md)); o texto é o de `io_lib:format/2`, construído pelo
[motor de io_lib](builtins.md#io_lib) e aplanado, com `~p` disposto segundo as
regras de `io_lib_pretty` do OTP
([io_lib/pretty.cpp](../runtime/src/builtins/io_lib/pretty.cpp)). As funções de entrada
de `io` são Erlang na [biblioteca](library.md#contents).

## Chamadas

- `io:format(Format)` equivale a `io:format(Format, [])`. Ambas devolvem `ok`.
  `io:fwrite/1,2,3` são iguais a `io:format/1,2,3`; `io:nl/0,1` escrevem uma
  mudança de linha.
- Dispositivos de `io:format/3`, `io:fwrite/3`, `io:put_chars/2` e `io:nl/1`:
  `standard_io` e `user` são a saída padrão, `standard_error` é o erro padrão
  (a saída padrão é despejada primeiro, para que as duas mantenham a sua
  ordem). Um pid, ou um átomo registado para um, é um servidor de I/O: o texto
  é-lhe enviado em UTF-8 através de `file:write/2` (um ficheiro aberto do
  módulo `file` do Clause) e a chamada devolve o que essa devolver. Um átomo
  não registado é `badarg`, um pid morto `error:terminated`, o próprio chamador
  `error:calling_self` e qualquer outro termo `function_clause`, como no OTP.
- `io:put_chars(Chardata)` escreve chardata: carateres Unicode, binaries UTF-8
  e listas aninhadas terminadas em `[]` ou num binary. Qualquer outra coisa (um
  átomo, um surrogate, UTF-8 inválido, um bitstring) lança `badarg`.
- O texto é construído por inteiro e depois escrito em UTF-8, tal como faz o
  dispositivo de saída padrão do OTP no modo `-noshell` (codificação
  `unicode`). Um erro não escreve nada. Uma escrita rejeitada é a falha do
  runtime `output_failure` (código de saída 70).
- Chamadas qualificadas, `fun io:format/2`, `apply(io, format, Args)` e
  `M:format(...)` chegam todas aos builtins. Um módulo do lote chamado `io` não
  substitui os builtins (o `io` do OTP é sticky,
  [registo](builtins.md#registration)).

## Formatos

- `Format` é um átomo (os seus carateres), um binary (os seus bytes como
  carateres Latin-1) ou uma lista. Um elemento da lista que não seja um carater
  é chardata escrito tal como está, sem sequências de controlo, e avança a
  coluna uma posição (uma peculiaridade do OTP).
- Sequências de controlo `~F.P.PadModC`: largura do campo `F` (negativa ou `-`:
  alinhado à esquerda), precisão `P`, carater de preenchimento, `*` que retira
  um inteiro (ou o preenchimento) dos argumentos, modificadores `t` (Unicode),
  `l` (sem deteção de strings), `k` (maps ordenados) e `K` (a ordem dos
  argumentos: `ordered`, `reversed`; funs de comparação são `badarg`). Os maps
  são impressos por ordem das chaves.
- Todos os controlos do OTP 29 com as suas regras de campo: `~w ~W ~p ~P ~s ~e ~f ~g ~b
  ~B ~x ~X ~+ ~# ~c ~i ~n ~~`. `~s` trunca ou preenche até `P` dentro de `F`;
  `~w`, inteiros e floats imprimem carateres `*` quando o texto não cabe em `F`;
  `~c` repete o carater; as bases dos inteiros vêm de `P` (2..36); `~n` com
  `F` escreve `F` mudanças de linha; as larguras contam como
  `io_lib:chars_length/1`.
- Sem `t`, `~s` aceita apenas carateres Latin-1 e `~c` escreve o byte menos
  significativo do seu inteiro; `~w`/`~p` escapam os carateres de átomos fora
  do Latin-1 como `\x{...}`. Com `t`, `~s` lê binaries como UTF-8 (recorrendo
  a Latin-1 em alternativa) e `~p` escreve `<<"..."/utf8>>` para binaries UTF-8
  imprimíveis.
- `badarg`: tudo o que faz falhar `io_lib:format/2` (um carater de controlo
  desconhecido, argumentos em falta ou a mais, um argumento do tipo errado,
  `F` menor do que `P`, um `~p` ou `~n` alinhado à esquerda, uma base fora de
  2..36), e uma saída que não é Unicode.

## Impressão formatada (`~p`)

- O comprimento da linha é `F` (por omissão 80; 0 escreve uma só linha); a
  primeira coluna é `P` ou, caso contrário, a coluna que a saída já atingiu na
  sua linha (tabulações para múltiplos de 8).
- `~P` corta o termo no seu argumento de profundidade e `chars_limit` (opções
  de `io:format/3` e `io_lib:format/3`) na parte dos carateres atribuída ao
  controlo, imprimindo `...` onde foram omitidas partes, como faz o OTP.
- O termo passa à forma intermédia do OTP: cada valor com o seu comprimento
  numa linha; strings (listas planas de carateres Latin-1 imprimíveis, o
  `io:printable_range()` por omissão), binaries imprimíveis, átomos e números
  são texto.
- O que cabe no resto da linha é escrito por inteiro. Listas e tuplos quebram
  entre elementos, alinhados após o parêntese; tuplos etiquetados
  (`{atom, ...}`) alinham após a etiqueta, ou indentam 4 (ou 1) posições quando
  isso ultrapassaria metade da linha; pares de maps e campos de native records
  que não cabem colocam o valor na linha seguinte; binaries longos quebram
  entre bytes.
- Contentores aninhados a mais de 256 níveis de profundidade lançam
  `system_limit` (a disposição é recursiva na pilha nativa).
- A formatação corre até ao fim, por maior que seja o termo
  ([porções](builtins.md#portions)).
