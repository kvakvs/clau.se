---
source: docs/io.md
sourceCommit: 6ed3851c
sourceSha256: 66dc714b12c1c9b117cfcabd5ac63dc68c134dc7a995c6548ba5de931204f6c2
translatedAt: 2026-10-15
---
# Saída para a consola (`io`)

`io:format/1,2` e `io:put_chars/1` escrevem
na saída padrão. São builtins do runtime do módulo `io` no catálogo da ponte
([builtins](builtins.md)); o runtime implementa as regras de `io_lib_format` e
`io_lib_pretty` do OTP em C++ ([io_format.cpp](../runtime/src/builtins/io_format.cpp),
[io_pretty.cpp](../runtime/src/builtins/io_pretty.cpp)).

## Chamadas

- `io:format(Format)` equivale a `io:format(Format, [])`. Ambas devolvem `ok`.
  `io:fwrite/1,2,3` são iguais a `io:format/1,2,3`; `io:nl/0,1` escrevem uma
  quebra de linha.
- Dispositivos de `io:format/3`, `io:fwrite/3`, `io:put_chars/2`
  e `io:nl/1`: `standard_io` e `user` são a saída padrão, `standard_error` é
  o erro padrão (a saída padrão é despejada primeiro, para que as duas
  mantenham a sua ordem). Um pid, ou um átomo registado para um, é um servidor
  de I/O: o texto é-lhe enviado em UTF-8 através de `file:write/2` (um
  ficheiro aberto do módulo `file` do Clause) e a chamada devolve o que essa
  devolver. Um átomo não registado é `badarg`, um pid morto
  `error:terminated`, o próprio chamador `error:calling_self` e qualquer outro
  termo `function_clause`, como no OTP.
- `io:put_chars(Chardata)` escreve chardata: carateres Unicode, binaries
  UTF-8 e listas aninhadas terminadas em `[]` ou num binary. Qualquer outra
  coisa (um átomo, um surrogate, UTF-8 inválido, um bitstring) lança `badarg`.
- O texto é construído por inteiro e depois escrito em UTF-8, tal como faz o
  dispositivo de saída padrão do OTP no modo `-noshell` (codificação
  `unicode`). Um erro não escreve nada. Uma escrita rejeitada é a falha do
  runtime `output_failure` (código de saída 70).
- Chamadas qualificadas, `fun io:format/2`, `apply(io, format, Args)` e
  `M:format(...)` chegam todas aos builtins. As outras funções de `io` mantêm o
  diagnóstico `unknown module io`. Um módulo do lote chamado `io` não substitui
  os builtins (o `io` do OTP é sticky).

## Formatos

- `Format` é um átomo (os seus carateres), um binary (os seus bytes como
  carateres Latin-1) ou uma lista. Um elemento da lista que não seja um carater
  é chardata escrito tal como está, sem sequências de controlo, e avança a
  coluna uma posição (uma peculiaridade do OTP).
- Sequências de controlo `~F.P.PadModC`: largura do campo `F` (negativa ou `-`:
  alinhado à esquerda), precisão `P`, carater de preenchimento, `*` que retira
  um inteiro (ou o preenchimento) dos argumentos, modificadores `t` (Unicode),
  `l` (sem deteção de strings) e `k` (maps ordenados; o Clause imprime sempre
  os maps por ordem das chaves).
- `C` suportados: `~w`, `~p`, `~s`, `~c`, `~b`, `~B`, `~i`, `~n`, `~~`, com as
  regras de campo do OTP: `~s` trunca ou preenche até `P` dentro de `F`; `~w` e
  `~b` imprimem carateres `*` quando o texto não cabe em `F`; `~c` repete o
  carater; `~b`/`~B` obtêm a base de `P` (2..36); `~n` com `F` escreve `F`
  mudanças de linha.
- Sem `t`, `~s` aceita apenas carateres Latin-1 e `~c` escreve o byte menos
  significativo do seu inteiro; `~w`/`~p` escapam os carateres de átomos fora
  do Latin-1 como `\x{...}`. Com `t`, `~s` lê binaries como UTF-8 (recorrendo
  a Latin-1 em alternativa) e `~p` escreve `<<"..."/utf8>>` para binaries
  UTF-8 imprimíveis.
- `badarg`: um carater de controlo desconhecido, argumentos em falta ou a
  mais, um argumento do tipo errado, `F` menor do que `P` para `~s`/`~c`, um
  `~p` ou `~n` alinhado à esquerda, uma base fora de 2..36, uma saída que não
  é Unicode.
- Não implementado (`badarg`, ver [diferenças](differences.md#io)): `~e`, `~f`,
  `~g`, `~x`, `~X`, `~+`, `~#`, `~W`, `~P` e o modificador `K`.

## Impressão formatada (`~p`)

- O comprimento da linha é `F` (por omissão 80; 0 escreve uma só linha); a
  primeira coluna é `P` ou, caso contrário, a coluna que a saída já atingiu na
  sua linha (tabulações para múltiplos de 8).
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
