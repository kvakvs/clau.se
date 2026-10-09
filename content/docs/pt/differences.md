---
source: docs/differences.md
sourceCommit: 06042fa
sourceSha256: b5d1cfc31fec7aaf6e6c4ca75f9056df534ca608a2c93e97a44e6c5e00a1109b
translatedAt: 2026-10-09
---
# Diferenças em relação ao Erlang/OTP

Comportamento observável em que o Clause difere conscientemente do OTP 29
fixado (`maint-29`, ver [otp-reference.md](otp-reference.md)). Cada entrada
remete para o contrato que a rege. Uma entrada é removida quando a diferença é
corrigida. As funcionalidades ainda não implementadas (assinaladas como
`notimpl`) não constam aqui; ver [features.md](features.md) e o plano.

## Maps

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Ordem do gerador de map (`K := V <- M`) | Os maps planos (até 32 chaves) são percorridos pela ordem das chaves, mas as chaves átomo pela ordem da tabela de átomos, que varia entre execuções da VM; os maps maiores pela ordem de hash | Sempre a ordem canónica das chaves (ordem dos termos) | [padrões](patterns.md#comprehensions) |
| Conteúdo de `bad_generators` de um gerador de map num grupo zip | O seu iterador: cadeia `{K, V, Next}` terminada em `none`, pela ordem do OTP | A mesma cadeia, construída pela ordem canónica das chaves | [padrões](patterns.md#comprehensions) |
| Impressão de maps (`erlang:display/1`, `~w`, `~p`) | Ordem da disposição interna (ordem da tabela de átomos para chaves átomo, ordem de hash acima de 32 chaves) | Ordem das chaves do map, como `~kw` do OTP | [termos](terms.md#printing) |
| Impressão de native records (`erlang:display/1`) | Campos pela ordem do índice na tabela de átomos | Ordem da definição, como `~w` | [native records](native-records.md#printing-and-order) |
| `==` entre native records cujos campos diferem apenas como inteiro/float | O compilador pode reduzi-lo a `=:=` (falso) | Comparação numérica (verdadeiro) | [native records](native-records.md#printing-and-order) |
| Impressão de funs locais (`#Fun<M.Index.Uniq>`) | Índice da numeração de lambdas do compilador, `Uniq` um hash do código do módulo | Índice das funs locais do módulo pela ordem do código-fonte, `Uniq` sempre 0 | [funs](funs.md#comparison-and-printing) |
| Ordem de duas funs locais de um módulo | Pelo índice do OTP | Pelo índice na ordem do código-fonte, pelo que funs de funções diferentes podem ordenar-se de outra forma | [funs](funs.md#comparison-and-printing) |
| Nomes de funs anónimas nos rastreios de pilha (`-f/1-fun-N-`) | `N` da numeração do compilador | `N` conta as funs de `f/1` pela ordem do código-fonte | [funs](funs.md#closures) |
| Uma fun anónima no valor por omissão de um campo de record | Cada local de construção expande a sua própria cópia: funs de dois locais são diferentes | Uma única fun para o valor por omissão: funs de qualquer local de construção são iguais | [funs](funs.md#closures) |
| Ordem dos valores capturados de funs criadas dentro de comprehensions | Variáveis livres da função gerada para a comprehension | Ordem de definição na função envolvente; visível apenas ao comparar duas dessas funs | [funs](funs.md#closures) |

## Pids, referências e processos

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Números de pid | O primeiro processo do utilizador é aproximadamente `<0.80.0>`; os números são reutilizados quando a tabela de pids dá a volta | O primeiro processo é `<0.1.0>`; os números vêm de uma única sequência e nunca são reutilizados | [termos](terms.md#pids-and-references) |
| Código após `spawn(Fun)` de uma fun de outra aridade | A análise de tipos do compilador pode considerar inalcançável o código após a chamada e eliminá-lo, pelo que o chamador devolve o pid de imediato | O chamador prossegue; apenas o novo processo falha com `{badarity, {Fun, []}}` | [processos](processes.md#builtins) |
| Formatação de um termo grande (`io:format/1,2`) | Corre em código Erlang (`io_lib`) e no group leader, pelo que o processo pode ser preemptado durante a formatação | Corre até ao fim numa única chamada de builtin; os outros processos esperam | [builtins](builtins.md#portions) |
| Flags de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` e outras | Apenas `trap_exit`; qualquer outra flag lança `badarg` | [processos](processes.md#builtins) |
| Ordem dos relatórios de erro de processos que falham ao mesmo tempo | Ordem do logger | A ordem pela qual os respetivos workers os terminam | [processos](processes.md#workers) |
| Sinais para um processo em execução noutro escalonador | Colocados na sua fila de sinais e tratados mais tarde, enquanto o emissor prossegue | O emissor espera até ao fim da fatia de tempo do destino e atua então de imediato; observável apenas na temporização | [processos](processes.md#workers) |
| `list_to_port/1` de um número nunca emitido | Devolve um termo port | `badarg`: só são admitidos os ports que este programa abriu | [ports](ports.md#identity) |
| Valores de `port_info/1,2` | `id` é um índice de tabela; `memory`, `queue_size`, `locking` descrevem o driver | `id` é o número do port; `memory` e `queue_size` são 0; `locking` é `port_level` | [ports](ports.md#builtins-and-port-messages) |
| Escrita num ficheiro aberto só para leitura | `{error, eacces}` no Windows, `{error, ebadf}` nos restantes | `{error, ebadf}` em todo o lado | [ports](ports.md#standard-io-and-files) |
| `io:get_line`, `io:get_chars` e `file:read/2` em modo lista com entrada não ASCII | Caracteres descodificados segundo a codificação do dispositivo | Um elemento da lista por byte | [ports](ports.md#standard-io-and-files) |
| Resultado de `os:cmd/1` | Caracteres Unicode descodificados da saída | Os bytes da saída | [ports](ports.md#subprocesses) |
| Argumentos vazios de `{spawn_executable, F}` no Windows | Omitidos da linha de comandos | Passados como `""` | [ports](ports.md#subprocesses) |
| `{exit_status, S}` e `eof` de um programa lançado | Ordem não especificada, `exit_status` pode chegar antes dos últimos dados | Depois de todos os dados, antes de `eof` | [ports](ports.md#subprocesses) |
| Ports ocupados | Um port com demasiada saída em fila suspende os emissores; `force` de `port_command/3` funciona nos drivers que o permitem | A saída nunca suspende; `force` lança `notsup` em todos os drivers | [ports](ports.md#io-thread) |
| `{active, N}` de sockets | Um inteiro `N` conta as mensagens antes de `{tcp_passive, S}` | `exit(badarg)`; apenas `true`, `false` e `once` | [ports](ports.md#sockets-57f) |
| Opções de afinação de sockets (`nodelay`, `keepalive`, `send_timeout`, `delay_send`, buffers) | Aplicadas; outras opções `inet` (`header`, `{packet, line}`, `http`, ...) funcionam | As opções de afinação listadas são aceites e não aplicadas; as outras opções dão `exit(badarg)` | [ports](ports.md#sockets-57f) |
| Razões de erro de sockets | Todas as razões POSIX que o sistema indica | As comuns (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); as restantes são `eio` | [ports](ports.md#sockets-57f) |
| Entrada de um port enquanto o processo ligado retém 1024 mensagens e pode correr | Continua a ler e a entregar | Deixa de entregar até ao fim da fatia de tempo do processo; acima de 64 KiB retidos, deixa de ler, pelo que o programa que escreve fica bloqueado | [ports](ports.md#busy-ports) |
| `gen_tcp:close/1` com saída em fila | Espera, até ao valor de `linger`/`send_timeout`, que a saída seja enviada | Regressa de imediato; a thread de E/S envia a saída em fila e depois fecha | [ports](ports.md#sockets-57f) |
| Tipos de `monitor/2` | `process`, `port`, `time_offset` | `process` e `port`; `time_offset` lança `badarg` (não há alterações do desvio de tempo) | [processos](processes.md#monitors) |
| `exit/2`, `exit_signal/2` para uma referência | Envia para o alias do processo, se a referência for um alias ativo | Nada (não há aliases) | [processos](processes.md#exit-signals) |
| Números de referência | Combinam um identificador de escalonador e contadores por escalonador (`#Ref<0.178111994.4235460610.214105>`) | Um único contador para todo o programa (`#Ref<0.0.0.1>`), pelo que as referências se ordenam por criação | [termos](terms.md#pids-and-references) |

## Erros, rastreios de pilha e relatórios

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Localizações nos rastreios de pilha | `[{file, F}, {line, L}]`, `error_info` para `error/3` | Sempre `[]`; sem `error_info` | [ABI](abi.md#stack-traces) |
| Frame superior de `function_clause` | Lista de argumentos | Aridade | [ABI](abi.md#stack-traces) |
| Frame superior de `undef` | `{M, F, Args, []}` da função em falta | O frame da função chamadora | [funs](funs.md#dynamic-calls) |
| Frames de BIFs/operadores que falham | Presentes (`{erlang, '+', Args, ...}`) | Ausentes; nada abaixo da função de entrada | [ABI](abi.md#stack-traces) |
| Tabela de átomos cheia (`list_to_atom/1`) | O emulador aborta (`no more index entries in atom_tab`) e escreve um crash dump | `clau: runtime failure: entry call failed: resource_limit`, código de saída 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` com caracteres acima de 255 | Os primeiros dígitos usam apenas o byte inferior de cada carácter (`[16#131]` é 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` de uma BIF | Verdadeiro para todas as BIFs do emulador | Verdadeiro apenas para os builtins que este runtime fornece | [builtins](builtins.md#how-calls-reach-them) |
| Relatórios de erro de processos que falharam | Enviados ao logger, escritos mais tarde pelo seu handler por omissão (na saída padrão sob `erl`, frequentemente perdidos quando um escript termina primeiro) | Escritos em stderr quando o processo termina, antes de qualquer saída posterior | [processos](processes.md#exits) |
| Chamadas a funções que nunca regressam | Compiladas como chamadas de cauda (o chamador não aparece no rastreio) | Chamadas normais (o chamador aparece) | [ABI](abi.md#stack-traces) |
| Memória do anfitrião esgotada | O emulador indica que não consegue alocar memória, escreve um crash dump e para | `clau: runtime failure: entry call failed: out_of_memory`, código de saída 70, sem dump | [heap do runtime](runtime-heap.md#failure-behavior) |
| Limite de memória por processo | `max_heap_size` (em palavras, heap e pilha) mata o processo com a razão `killed` e regista um relatório de erro | `--max-heap` / `--max-stack` (bytes) e o `--max-memory` global do runtime fazem falhar o processo que pede memória com `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, código de saída 70 | [heap do runtime](runtime-heap.md#runtime-memory-limit) |
| Argumentos do programa | `escript` passa todos os argumentos a `main/1`; as flags do emulador (`+t`) vêm de `%%!` ou de `ERL_FLAGS` | As opções do runtime iniciais (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) são retiradas primeiro; `CLAUSE_FLAGS` contém as mesmas opções | [executáveis](executables.md#runtime-options) |
| Exceção não apanhada num módulo de entrada normal | `escript` termina com 127 | Termina com 1 e uma linha `uncaught exception <class>: <reason>` (os códigos-fonte escript mantêm 127) | [executáveis](executables.md) |
| Diagnósticos do compilador | Formulação do `erl_lint` (`variable 'X' is unbound`) e avisos | Formulação própria (`unbound variable X`); os avisos de lint do OTP na maioria não são emitidos (também campos desconhecidos de native records em acesso, atualização e padrões) | [análise semântica](semantic.md#bindings) |

## Casos-limite da linguagem

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Segmento inteiro mais largo do que o limite de inteiros, valor acima dele (`<<V:4194241>>` só com uns) | O JIT x86 faz a correspondência com um termo inválido; usá-lo faz a VM falhar | Sem correspondência | [termos](terms.md#integers) |
| Grupo zip cujos geradores relaxados e estritos partilham uma variável | O teste de salto mantém as variáveis dos padrões estritos nos padrões relaxados | Um passo rejeitado é saltado sempre que os padrões estritos correspondem por si só | [padrões](patterns.md#comprehensions) |
| Chamar uma fun externa, `M:F(Args)` ou `apply/3` de um módulo fora do programa | Carrega o módulo a partir do code path, `undef` se não existir | `undef`; os módulos de biblioteca só entram no programa quando este os nomeia com um átomo literal | [funs](funs.md#dynamic-calls), [biblioteca](library.md#how-programs-get-them) |
| `lists` e `maps` | Os módulos completos; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` seguem a ordem interna do map (ordem da tabela de átomos para chaves átomo, ordem de hash acima de 32 chaves) | O [subconjunto da biblioteca](library.md); as funções de map seguem a ordem das chaves | [biblioteca](library.md) |
| Ficheiros sem `#!` passados como escripts | `escript file.erl` salta a primeira linha | Compilados como módulos normais | [executáveis](executables.md) |
| Escripts com beam pré-compilado e em arquivo | Correm | Não suportados | [executáveis](executables.md) |
| Um `-spec` cujos tipos não partilham nenhum valor com o resultado inferido, o domínio de entrada ou os argumentos de uma chamada | Compila; o Dialyzer pode avisar | Erro de compilação que indica os tipos declarados e inferidos | [análise semântica](semantic.md#inference) |

## io

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Sequências de controlo `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, modificador `K` | Formatadas | `badarg` | [io](io.md#formats) |
| `~p` de contentores aninhados a mais de 256 níveis | Impressos | `system_limit` | [io](io.md#pretty-printing-p) |
| Larguras de campo e precisão de `~ts` com caracteres combinatórios ou `\r\n` | Contam grupos de grafemas | Contam pontos de código | [io](io.md#formats) |
| Precisão ou contagem de preenchimento negativa (`~.*c` com -1) | Ciclo infinito | `badarg` | [io](io.md#formats) |
| Funções `io` além de `format/1,2`, `put_chars/1` | Existem | `unknown module io` | [io](io.md#calls) |
