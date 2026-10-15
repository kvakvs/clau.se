---
source: docs/differences.md
sourceCommit: 6ed3851c
sourceSha256: 7f5e373cf63cd3d962f6e9954719a80cdb14f9cf5bfdb3af590c58fc8e0cabf3
translatedAt: 2026-10-15
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
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3` | Ordem interna (ordem da tabela de átomos para chaves átomo, ordem de hash acima de 32 chaves); um iterador é uma posição ou uma cadeia `{K, V, Next}` | Ordem canónica das chaves; um iterador continua sobre uma lista de chaves | [builtins](builtins.md#erts-internal) |
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
| Pilha de um `function_clause` lançado por um builtin de `lists` (`lists:sublist/2`, `lists:max/1`, ...) | O frame superior é a função Erlang, frequentemente um auxiliar interno (`lists:sublist_2/2`), com os seus argumentos | O chamador fica no topo: os builtins não empilham nenhum frame | [builtins](builtins.md#lists-module) |
| Último bit dos resultados de `math` (`math:erfc(1)`, ...) | A biblioteca C com que o OTP foi compilado | A biblioteca C que os programas Clause ligam (Windows: `0.15729920705028513` para `erfc(1)`, OTP `0.1572992070502851`) | [builtins](builtins.md#math-module) |
| Resultado de `binary:compile_pattern/1` | `{bm, Ref}` ou `{ac, Ref}` com uma referência opaca | `{bm, [Pattern]}` ou `{ac, Patterns}` | [builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` de um sub-binary | O tamanho do binary para o qual aponta | O seu próprio tamanho | [builtins](builtins.md#binary-module) |
| Custo de `persistent_term:get/1,2` | Constante: o valor fica numa área de literais; `put`/`erase` de um valor substituído desencadeiam uma recolha global | Copia o valor para o heap do leitor em cada leitura; sem recolha global | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` e `get/0` | Incluem os termos que `kernel` e `stdlib` do OTP guardam no arranque (26 no OTP 29) | Apenas os termos do próprio programa | [builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` de um módulo compilado | O ficheiro `.beam` a partir do qual foi carregado | `preloaded`: todos os módulos estão ligados no executável | [builtins](builtins.md#code-module) |
| `init:get_arguments/0`, `init:get_argument/1` | As flags do emulador: `root`, `bindir`, `progname`, `home` e cada `-Flag` da linha de comandos | Apenas `home`; um executável não tem flags de emulador | [builtins](builtins.md#init-module) |
| `init:script_name/0`, `init:script_id/0` | O caminho do script de arranque e `{"Erlang/OTP", "29"}` | O caminho absoluto do executável e `{"Clause", "29"}` | [builtins](builtins.md#init-module) |
| `init:get_status/0`, `init:ensure_loaded/1` na entrada | `{starting, started}` e carregamento de código enquanto código de `escript`, `-s` ou `-eval` corre durante o arranque; `{started, started}` e `not_allowed` depois de iniciado | Sempre as respostas de sistema iniciado | [builtins](builtins.md#init-module) |
| `init:stop/0,1`, `init:reboot/0` | Devolvem `ok`; `init` desliga então as aplicações e termina, enquanto o chamador continua a correr | Terminam de imediato; a chamada nunca regressa | [builtins](builtins.md#init-module) |
| `init:get_argument(home)` no Windows sem `HOMEDRIVE`/`HOMEPATH` | A pasta de perfil da shell | `USERPROFILE`, normalmente a mesma pasta | [builtins](builtins.md#init-module) |
| `erlang:halt(Slogan)`, `init:stop(Slogan)` | Imprime o slogan, escreve `erl_crash.dump` no diretório atual e indica-o em stderr; código de saída 1 | Imprime o slogan em stderr, não escreve crash dump; código de saída 1 | [executáveis](executables.md) |
| `init:restart/0,1`, `init:boot/1`, `init:make_permanent/2` | Reiniciam o sistema no mesmo nó, arrancam-no ou definem o script de arranque do próximo reinício | Recusados: erro `notsup`, `{error, notsup}` de `make_permanent/2` | [builtins](builtins.md#init-module) |
| Aridade de `atomics:new/2` | Qualquer inteiro positivo que o alocador consiga servir; um enorme termina o nó com um crash dump | 1 a 2^27, caso contrário `badarg` | [builtins](builtins.md#atomics-and-counters) |
| `counters` com `write_concurrency` | Contadores por escalonador somados na leitura; a memória de `info/1` cresce com o número de escalonadores | Um único array de atomics; a memória de `info/1` é a do array | [builtins](builtins.md#atomics-and-counters) |
| `erts_internal:term_type/1` | A representação interna: `flatmap` ou `hashmap`, `heap_binary`, `refc_binary` ou `sub_binary`, ... | Todos os maps `flatmap`, todos os bitstrings `sub_binary` | [builtins](builtins.md#erts-internal) |
| `erl_prim_loader:get_path/0` | O code path de arranque | `["."]` até `set_path/1` | [ports](ports.md#standard-io-and-files) |
| `file:read_link_info/1,2` de uma ligação simbólica no Windows | Os dados do próprio reparse point da ligação | O tamanho e as datas do destino com tipo `symlink` | [ports](ports.md#standard-io-and-files) |
| `inet:gethostbyname/1,2` | O nome canónico e os aliases do resolvedor (`inet_res`, ficheiro hosts, nativo) | O nome pedido e sem aliases; endereços do resolvedor do sistema | [ports](ports.md#sockets-57f) |
| Módulos `socket`, `net` | A API NIF de sockets | Em falta: uma referência é um erro de compilação; usar `gen_tcp`, `gen_udp`, `inet` | [biblioteca](library.md) |
| Listas de saída de `zlib` | Um binary por bloco interno, aninhado onde um fluxo terminou e recomeçou | Um binary por chamada, `[]` quando não há nenhum; os bytes são os do OTP | [builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` e chamadas `zlib` longas | Regressam após uma quantidade limitada de saída (`{continue, Output}`) e cedem | Descomprimem toda a entrada em fila numa única chamada (`{finished, Output}`); uma chamada longa retém a thread do seu escalonador | [builtins](builtins.md#zlib-module) |
| Correspondências `re` longas | `re:run/3` e o ciclo global cedem após uma quantidade limitada de trabalho | Uma correspondência corre até ao fim e retém a thread do seu escalonador; uma execução global cede apenas entre correspondências | [builtins](builtins.md#re-module) |
| `re:compile/2` com `export`, `re:import/1` | Um padrão exportado `{re_exported_pattern, ...}` que outro nó importa | `export` é `badarg`; `import/1` lança `{not_implemented, import, 1}` | [builtins](builtins.md#re-module) |
| Erros de argumento de `re` | `badarg` lançado de `re:run/3` (ou `replace`, `split`) com os argumentos do chamador e `error_info` | `badarg` lançado do auxiliar de `re` que rejeitou o argumento, com os argumentos desse auxiliar | [builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` para os módulos de `kernel`, `stdlib` e `compiler` | Sempre `false` | [builtins](builtins.md#code-module) |
| Saída para um dispositivo de ficheiro (`io:format(File, ...)`) | Os caracteres são codificados segundo a codificação do ficheiro (`latin1` por omissão: caracteres acima de 255 são um erro) | Sempre bytes UTF-8 | [io](io.md#calls) |
| Formatação de um termo grande (`io:format/1,2`) | Corre em código Erlang (`io_lib`) e no group leader, pelo que o processo pode ser preemptado durante a formatação | Corre até ao fim numa única chamada de builtin; os outros processos esperam | [builtins](builtins.md#portions) |
| Flags de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` e outras | Apenas `trap_exit`; qualquer outra flag lança `badarg` | [processos](processes.md#builtins) |
| Ordem dos relatórios de erro de processos que falham ao mesmo tempo | Ordem do logger | A ordem pela qual os respetivos workers os terminam | [processos](processes.md#workers) |
| Sinais para um processo em execução noutro escalonador | Colocados na sua fila de sinais e tratados mais tarde, enquanto o emissor prossegue | O emissor espera até ao fim da fatia de tempo do destino e atua então de imediato; observável apenas na temporização | [processos](processes.md#workers) |
| `term_to_binary/1` de uma fun local ou de um native record | Codificado (`NEW_FUN_EXT`, ...) | `error:notsup`; `fun M:F/A` é codificada | [builtins](builtins.md#external-term-format) |
| `term_to_binary/1` de um map com mais de 32 chaves | Ordem de hash salvo com `deterministic` | Sempre a ordem das chaves (os bytes de `deterministic`) | [builtins](builtins.md#external-term-format) |
| `binary_to_term/1` do pid, port ou referência de outro nó; opção `local` de `term_to_binary/2` | Identidades externas; codificação `LOCAL_EXT` | `badarg` | [builtins](builtins.md#external-term-format) |
| Limite de tempo dos temporizadores | Depende da unidade de tempo nativa (cerca de 2^49.7 ms no Windows) | Tempo relativo 0..2^49-1 ms em todas as plataformas | [processos](processes.md#timers) |
| `unique_integer/0,1` sem `positive` | Pode ser negativo | Sempre positivo e crescente | [builtins](builtins.md#time) |
| Itens `current_function`, `initial_call`, `current_stacktrace`, ... de `process_info/2` | Indicados | `error:{notsup, Item}`; `process_info/1` omite-os | [processos](processes.md#introspection) |
| `reductions` de `process_info/2`; `reductions`, `garbage_collection`, `io` de `statistics/1` | Contados | 0 (não mantidos) | [builtins](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Recolhe antes de regressar | Recolhe no próximo safepoint do destino | [processos](processes.md#introspection) |
| `erlang:system_info(machine)` | `"BEAM"` | `"Clause"` | [builtins](builtins.md#system-information) |
| Opções de afinação de `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Aplicadas | Verificadas e aceites, não aplicadas | [processos](processes.md#spawn-options) |
| `hibernate/3` | Descarta a pilha; o processo termina quando `M:F` regressa | Mantém a pilha; o resultado de `M:F` regressa ao chamador de `hibernate/3` | [processos](processes.md#spawn-options) |
| `monitor(port, Item, Options)` com opções | Aceite | `badarg` | [processos](processes.md#aliases) |
| `spawn_request_abandon/1` | `true` enquanto a resposta está pendente | Sempre `false`: a resposta é enviada antes de `spawn_request` regressar | [processos](processes.md#spawn-options) |
| Último bit de `math:log2/1` (Windows) | A compilação do OTP para Windows divide `log(X)` por `log(2)` (`math:log2(1.0e308)` é `1023.1538532253077`) | O `log2` da biblioteca C (`1023.1538532253076`) | [builtins](builtins.md#math-module) |
| Valores de `phash/2`, `phash2/1,2` | A função de hash do OTP | O hash estável próprio do Clause, com os mesmos intervalos e a mesma garantia de igualdade | [builtins](builtins.md#hashing) |
| `erlang:is_builtin/3` de `lists:reverse/2` e outras funções de biblioteca implementadas em C | `true` | `false`: apenas os builtins do runtime e `apply/2,3` | [funs](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` de `fun_info/1,2` de uma fun local | Pid do criador, checksums do compilador | `undefined`, MD5 do nome do módulo | [funs](funs.md#fun-information) |
| Contexto de `md5_init/0` | Estado de 92 bytes do OTP | Estado de 96 bytes do Clause; os digests são iguais | [builtins](builtins.md#hashing) |
| `erlang:delete_module/1` de um módulo carregado | Torna o seu código antigo (`true`) | `error:notsup`: o código ligado mantém-se | [builtins](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Prepara um binary BEAM válido | Sempre `{error, badfile}` | [builtins](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | Os módulos de arranque pré-carregados | Todos os módulos do programa | [builtins](builtins.md#code-loading) |
| `list_to_pid/1` de um número nunca emitido | Devolve um termo pid | `badarg`: só são admitidos os pids que este programa criou | [termos](terms.md#pids-and-references) |
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
| Chamada dinâmica de uma exportação que um executável não consegue alcançar (o seu módulo é nomeado apenas através de um rastreio de pilha, de uma exceção ou de uma mensagem vinda de fora do programa) | Chama-a | `undef`, salvo se compilado com `--keep-exports`; `function_exported/3` e `module_info(exports)` continuam a listá-la | [executáveis](executables.md#export-liveness) |
| Frames de BIFs/operadores que falham | Presentes (`{erlang, '+', Args, ...}`) | Ausentes; nada abaixo da função de entrada | [ABI](abi.md#stack-traces) |
| Tabela de átomos cheia (`list_to_atom/1`) | O emulador aborta (`no more index entries in atom_tab`) e escreve um crash dump | `clau: runtime failure: entry call failed: resource_limit`, código de saída 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` com caracteres acima de 255 | Os primeiros dígitos usam apenas o byte inferior de cada carácter (`[16#131]` é 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` de uma BIF | Verdadeiro para todas as BIFs do emulador | Verdadeiro apenas para os builtins que este runtime fornece | [builtins](builtins.md#how-calls-reach-them) |
| Relatórios de erro de processos que falharam | Enviados ao logger, escritos mais tarde pelo seu handler por omissão (na saída padrão sob `erl`, frequentemente perdidos quando um escript termina primeiro) | Escritos em stderr quando o processo termina, antes de qualquer saída posterior | [processos](processes.md#exits) |
| Chamadas a funções que nunca regressam | Compiladas como chamadas de cauda (o chamador não aparece no rastreio) | Chamadas normais (o chamador aparece) | [ABI](abi.md#stack-traces) |
| Memória do anfitrião esgotada | O emulador indica que não consegue alocar memória, escreve um crash dump e para | `clau: runtime failure: entry call failed: out_of_memory`, código de saída 70, sem dump | [heap do runtime](runtime-heap.md#failure-behavior) |
| Armazenamento de maps com mais de 32 chaves | Uma HAMT no heap, contada em `heap_size` e copiada por cada recolha | Uma árvore fora do heap atrás de um stub de 4 palavras no heap, contada com os binaries fora do heap; os tamanhos de heap são menores e as recolhas copiam apenas o stub | [heap do runtime](runtime-heap.md#off-heap-maps) |
| Limite de memória por processo | `max_heap_size` (em palavras, heap e pilha) mata o processo com a razão `killed` e regista um relatório de erro | `--max-heap` / `--max-stack` (bytes) e o `--max-memory` global do runtime fazem falhar o processo que pede memória com `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, código de saída 70 | [heap do runtime](runtime-heap.md#runtime-memory-limit) |
| Argumentos do programa | `escript` passa todos os argumentos a `main/1`; as flags do emulador (`+t`) vêm de `%%!` ou de `ERL_FLAGS` | As opções do runtime iniciais (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) são retiradas primeiro; `CLAUSE_FLAGS` contém as mesmas opções | [executáveis](executables.md#runtime-options) |
| Exceção não apanhada num módulo de entrada normal | `escript` termina com 127 | Termina com 1 e uma linha `uncaught exception <class>: <reason>` (os códigos-fonte escript mantêm 127) | [executáveis](executables.md) |
| Diagnósticos do compilador | Formulação do `erl_lint` (`variable 'X' is unbound`) e avisos | Formulação própria (`unbound variable X`); os avisos de lint do OTP na maioria não são emitidos (também campos desconhecidos de native records em acesso, atualização e padrões) | [análise semântica](semantic.md#bindings) |
| Módulo de behaviour com um `behaviour_info/1` escrito à mão | Chama-o ao compilar os utilizadores e avisa sobre callbacks em falta, mal definidos ou obsoletos | Não avaliado: os callbacks dos seus utilizadores não são verificados | [análise semântica](semantic.md#behaviours) |
| Módulos de behaviour fora do lote (`gen_server`, `supervisor`, ...) | Carregados a partir do code path; os seus callbacks são verificados | Aviso `behaviour M undefined` | [análise semântica](semantic.md#behaviours) |
| `-behaviour` com um valor que não é um átomo | O aviso imprime o termo com `~w` (`behaviour [115,116,114] undefined`) | Imprime o texto-fonte do atributo (`behaviour "str" undefined`); o erro é o mesmo | [análise semântica](semantic.md#behaviours) |
| `module_info(md5)` e o `vsn` que o OTP dele deriva | MD5 do código BEAM compilado | MD5 do código-fonte impresso do módulo; o inteiro `vsn` derivado difere em conformidade | [análise semântica](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` da aplicação compiler do OTP, `options` que lhe foram dadas | A versão do Clause; `options` sempre `[]` | [análise semântica](semantic.md#predefined-functions) |
| `module_info(functions)` | Lista também as funções que o OTP gera para as funs (`'-f/0-fun-0-'/0`) | Apenas as funções do código-fonte e as predefinidas | [análise semântica](semantic.md#predefined-functions) |
| `-nominal` em `module_info(attributes)` | Mantido como `{nominal,[{Name,AbstractType,Params}]}` em formato abstrato | Omitido | [análise semântica](semantic.md#predefined-functions) |
| `erlang:get_module_info/1,2` | A BIF por trás de `module_info/0,1` | Não fornecida; `module_info/0,1` devolvem dados literais | [análise semântica](semantic.md#predefined-functions) |
| `-compile({parse_transform, Module})` | Aplica a transformação às formas do módulo | Não aplicada; aviso `[parse transforms] notimpl` e o módulo compila sem transformação | [compilação](compile.md#accepted-source-subset) |
| Uma função de um módulo de biblioteca do Clause que o Clause não implementou (uma BIF de `erlang`, `lists:keysort/2`, `persistent_term:get/1`, ...) | Corre | Compila; lança `error({not_implemented, F, A})` quando chamada, com `M:F/A` no topo da pilha ([estados](../library/modules.terms)) | [biblioteca](library.md#provided-or-missing), [builtins](builtins.md#erlang-module) |
| Import de um módulo fora do lote | Compila; a chamada lança `undef` em tempo de execução se o módulo faltar | Erro de compilação `unknown module M` quando o import é chamado (os imports não usados não precisam do módulo) | [análise semântica](semantic.md#imports) |
| Aviso `import directive overrides auto-imported BIF` | Para cada BIF auto-importada de `erl_internal:bif/2` | Apenas para as BIFs auto-importadas que o Clause implementa | [análise semântica](semantic.md#imports) |

## Casos-limite da linguagem

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Segmento inteiro mais largo do que o limite de inteiros, valor acima dele (`<<V:4194241>>` só com uns) | O JIT x86 faz a correspondência com um termo inválido; usá-lo faz a VM falhar | Sem correspondência | [termos](terms.md#integers) |
| Grupo zip cujos geradores relaxados e estritos partilham uma variável | O teste de salto mantém as variáveis dos padrões estritos nos padrões relaxados | Um passo rejeitado é saltado sempre que os padrões estritos correspondem por si só | [padrões](patterns.md#comprehensions) |
| Chamar uma fun externa, `M:F(Args)` ou `apply/3` de um módulo fora do programa | Carrega o módulo a partir do code path, `undef` se não existir | `undef`; os módulos de biblioteca só entram no programa quando este os nomeia com um átomo literal | [funs](funs.md#dynamic-calls), [biblioteca](library.md#how-programs-get-them) |
| `lists` e `maps` | Os módulos completos; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` seguem a ordem interna do map (ordem da tabela de átomos para chaves átomo, ordem de hash acima de 32 chaves) | O [subconjunto da biblioteca](library.md); as funções de map seguem a ordem das chaves | [biblioteca](library.md) |
| Ficheiros sem `#!` passados como escripts | `escript file.erl` salta a primeira linha | Compilados como módulos normais | [executáveis](executables.md) |
| Escripts com beam pré-compilado e em arquivo | Correm | Não suportados | [executáveis](executables.md) |
| `include_lib` de uma aplicação encontrada em vários diretórios `<app>-<version>` | O code path contém uma única versão (o arranque escolhe a mais alta); sem diagnóstico | A versão mais alta abaixo de cada diretório pesquisado, com um aviso por execução que as lista | [pré-processador](preprocessor.md#compatibility-policies) |
| Um `-spec` cujos tipos não partilham nenhum valor com o resultado inferido, o domínio de entrada ou os argumentos de uma chamada | Compila; o Dialyzer pode avisar | Um domínio de entrada de argumentos contradito é um erro de compilação que indica os tipos declarados e inferidos; um resultado ou uma chamada contraditos são um aviso, e são usados os tipos inferidos | [análise semântica](semantic.md#inference) |

## io

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Sequências de controlo `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, modificador `K` | Formatadas | `badarg` | [io](io.md#formats) |
| `~p` de contentores aninhados a mais de 256 níveis | Impressos | `system_limit` | [io](io.md#pretty-printing-p) |
| Larguras de campo e precisão de `~ts` com caracteres combinatórios ou `\r\n` | Contam grupos de grafemas | Contam pontos de código | [io](io.md#formats) |
| Precisão ou contagem de preenchimento negativa (`~.*c` com -1) | Ciclo infinito | `badarg` | [io](io.md#formats) |
| Funções `io` além de `format/1,2`, `put_chars/1` | Existem | `unknown module io` | [io](io.md#calls) |

## Parse transforms

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Nome no atributo `file` de um ficheiro incluído (`--print-abstr`, entrada da transformação) | O diretório de inclusão unido ao nome, tal como encontrado (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | O caminho relativo ao diretório de trabalho quando o ficheiro está dentro dele, caso contrário o caminho absoluto | [transformações](transforms.md#interchange) |
| Anotações `generated` de formas importadas (entradas `.abstr`, saída da transformação) | `erl_lint` e o compilador omitem alguns avisos para código gerado | Ignoradas: o código é verificado como código-fonte | [transformações](transforms.md#importing-forms) |
| Formas `{error, {Location, Module, Descriptor}}` em código importado | Formatadas com `Module:format_error/1` | O texto do termo do descritor; a formatação requer o OTP | [transformações](transforms.md#importing-forms) |
| Um módulo com erros de pré-processamento ou de análise sintática que nomeia uma parse transform | A transformação corre e recebe os erros como formas `{error, E}`; `erl_lint` reporta-os depois | Os erros são reportados e a transformação não corre | [transformações](transforms.md#clause-pipeline) |
| Opções de compilação que uma transformação recebe | A lista completa de opções do erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (o diretório de trabalho), `{i, _}`, `{d, ...}` e `{parse_transform, _}` | [transformações](transforms.md#otp-behavior) |
