---
source: docs/differences.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d23f82e2b75a7d8717057d09d1a6e30555fb75f81b5e810be0aaa9fc83a5b22c
translatedAt: 2026-10-26
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
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3`, a ordem de execução das funs de `maps` (`intersect_with/3`, `merge_with/3`, ...), `proplists:get_keys/1`, `sets` da versão 2 (`to_list/1`, `fold/3`) | Ordem interna (ordem da tabela de átomos para chaves átomo, ordem de hash acima de 32 chaves); um iterador é uma posição ou uma cadeia `{K, V, Next}` | Ordem canónica das chaves; um iterador continua sobre uma lista de chaves | [builtins](builtins.md#erts-internal) |
| Impressão de maps (`erlang:display/1`, `~w`, `~p`) | Ordem da disposição interna (ordem da tabela de átomos para chaves átomo, ordem de hash acima de 32 chaves) | Ordem das chaves do map, como `~kw` do OTP | [termos](terms.md#printing) |
| Ordem de `digraph:vertices/1`, `edges/1`, `source_vertices/1`, `sink_vertices/1` e das ordenações e componentes de `digraph_utils` quando partem dessas listas | A ordem de hash das tabelas de vértices e arestas | A ordem de hash do Clause ([ETS](#ets)); os caminhos e as listas de vizinhos seguem a inserção das arestas em ambos | [builtins](builtins.md#digraph) |
| Ordem de `maps:keys/1`, `values/1`, `to_list/1`, `fold/3`, dos membros escritos por `json:encode/1`, dos campos que `erl_parse:abstract/1,2` atribui a um map e das listas de vértices e percursos de `graph` | A ordem interna do map (ordem da tabela de átomos para chaves átomo, ordem de hash acima de 32 chaves) | Ordem das chaves | [biblioteca](library.md) |
| Impressão de native records (`erlang:display/1`) | Campos pela ordem do índice na tabela de átomos | Ordem da definição, como `~w` | [native records](native-records.md#printing-and-order) |
| `==` entre native records cujos campos diferem apenas como inteiro/float | O compilador pode reduzi-lo a `=:=` (falso) | Comparação numérica (verdadeiro) | [native records](native-records.md#printing-and-order) |
| Construção externa de um native record de um módulo que não está carregado | Falha até o módulo que o define ser carregado | Todos os módulos do lote são carregados no arranque; um módulo fora do lote falha sempre | [native records](native-records.md#differences-kept) |
| Impressão de funs locais (`#Fun<M.Index.Uniq>`) | Índice da numeração de lambdas do compilador, `Uniq` um hash do código do módulo | Índice das funs locais do módulo pela ordem do código-fonte, `Uniq` sempre 0 | [funs](funs.md#comparison-and-printing) |
| Ordem de duas funs locais de um módulo | Pelo índice do OTP | Pelo índice na ordem do código-fonte, pelo que funs de funções diferentes podem ordenar-se de outra forma | [funs](funs.md#comparison-and-printing) |
| Nomes de funs anónimas nos stack traces (`-f/1-fun-N-`) | `N` da numeração do compilador | `N` conta as funs de `f/1` pela ordem do código-fonte | [funs](funs.md#closures) |
| Uma fun anónima no valor por omissão de um campo de record | Cada local de construção expande a sua própria cópia: funs de dois locais são diferentes | Uma única fun para o valor por omissão: funs de qualquer local de construção são iguais | [funs](funs.md#closures) |
| Ordem dos valores capturados de funs criadas dentro de comprehensions | Variáveis livres da função gerada para a comprehension | Ordem de definição na função envolvente; visível apenas ao comparar duas dessas funs | [funs](funs.md#closures) |

## Pids, referências e processos

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Temporizadores de disparo único e de intervalo de `timer`, exceto envios para pids locais | Executados pelo processo `timer_server`, iniciado sob `kernel_sup` na primeira utilização; os sinais de `exit_after/2,3` vêm dele | Sem servidor de temporizadores: cada temporizador é um processo próprio, que envia o sinal de `exit_after`; `cancel/1` devolve antes de esse processo ter visto o cancelamento | [builtins](builtins.md#timer) |
| Números de pid | O primeiro processo do utilizador é aproximadamente `<0.80.0>`; os números são reutilizados quando a tabela de pids dá a volta | O primeiro processo é `<0.1.0>`; os números vêm de uma única sequência e nunca são reutilizados | [termos](terms.md#pids-and-references) |
| Código após `spawn(Fun)` de uma fun de outra aridade | A análise de tipos do compilador pode considerar inalcançável o código após a chamada e eliminá-lo, pelo que o chamador devolve o pid de imediato | O chamador prossegue; apenas o novo processo falha com `{badarity, {Fun, []}}` | [processos](processes.md#builtins) |
| Pilha de um `function_clause` lançado por um builtin de `lists` (`lists:sublist/2`, `lists:max/1`, ...) | O frame superior é a função Erlang, frequentemente um auxiliar interno (`lists:sublist_2/2`), com os seus argumentos | O chamador fica no topo: os builtins não empilham nenhum frame | [builtins](builtins.md#lists-module) |
| Último bit dos resultados de `math` (`math:erfc(1)`, ...) | A biblioteca C com que o OTP foi compilado | A biblioteca C que os programas Clause ligam (Windows: `0.15729920705028513` para `erfc(1)`, OTP `0.1572992070502851`) | [builtins](builtins.md#math-module) |
| Resultado de `binary:compile_pattern/1` | `{bm, Ref}` ou `{ac, Ref}` com uma referência opaca | `{bm, [Pattern]}` ou `{ac, Patterns}` | [builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` de um sub-binary | O tamanho do binary para o qual aponta | O seu próprio tamanho | [builtins](builtins.md#binary-module) |
| Memória dos termos persistentes substituídos ou apagados | Recuperada em segundo plano por um processo coletor de áreas de literais que faz cada processo copiar o valor para fora | Cada processo copia-o para fora na sua próxima fatia (os suspensos de imediato, pelo `put`/`erase`), depois a área é libertada; sem processo coletor | [runtime](runtime.md#persistent-terms) |
| Termos persistentes enviados em mensagens | Permanecem partilhados, como os literais: o heap do destinatário não cresce | Copiados para o heap do destinatário como qualquer outro termo | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` e `get/0` | Incluem os termos que `kernel` e `stdlib` do OTP guardam no arranque (26 no OTP 29) | Apenas os termos do próprio programa | [builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` de um módulo compilado | O ficheiro `.beam` a partir do qual foi carregado | `preloaded`: todos os módulos estão ligados no executável | [builtins](builtins.md#code-module) |
| Opção `priority` de `send/3`, `link/2`, `exit/3`, `exit_signal/3` | As mensagens e os sinais prioritários ultrapassam os comuns | Aceite; entregues como mensagens e sinais comuns | [processos](processes.md#builtins) |
| `spawn/2,4`, `spawn_link/2,4`, `spawn_monitor/2,4` que nomeiam outro nó | É registado um aviso `** Can not start ... on Node **` | Nada é impresso; o pid inútil termina na mesma com `noconnection` | [processos](processes.md#builtins) |
| Flags de `system_flag/2` diferentes de `backtrace_depth` e `min_heap_size` (`fullsweep_after`, `schedulers_online`, `multi_scheduling`, `max_heap_size`, ...) | Alteram o emulador | Verificadas e consultáveis sem efeito; `system_logger` começa como `undefined` (sem processo logger); `cpu_topology`, `erts_alloc`, `scheduler_bind_type` dão `badarg` | [builtins](builtins.md#system-information) |
| Temporizadores de um processo suspenso (`receive ... after`, `send_after/3` e `start_timer/3` para o seu pid) | Suspensos com o processo até este ser retomado (OTP 28, 29) | Continuam a correr: um tempo limite que expire durante a suspensão é tratado quando o processo é retomado; uma mensagem de temporizador espera na sua caixa de correio | [processos](processes.md#suspending-processes) |
| Saída de `process_display/2` | Dump da pilha do OTP com endereços e posições da pilha | Um `Module:Function/Arity` por frame | [processos](processes.md#builtins) |
| `process_flag(save_calls, N)` | Guarda as últimas N chamadas para `process_info(Pid, last_calls)` | Mantido e consultável; não são guardadas chamadas | [processos](processes.md#builtins) |
| `adler32_combine/3`, `crc32_combine/3` com um segundo tamanho acima de 2^31 - 1 no Windows | Combinados | `badarg` (o `z_off_t` da zlib tem 32 bits nessa plataforma) | [builtins](builtins.md#erlang-module) |
| `init:get_arguments/0`, `init:get_argument/1` | As flags do emulador: `root`, `bindir`, `progname`, `home` e cada `-Flag` da linha de comandos | Apenas `home`; um executável não tem flags de emulador | [builtins](builtins.md#init-module) |
| `init:script_name/0`, `init:script_id/0` | O caminho do script de arranque e `{"Erlang/OTP", "29"}` | O caminho absoluto do executável e `{"Clause", "29"}` | [builtins](builtins.md#init-module) |
| `init:get_status/0`, `init:ensure_loaded/1` na entrada | `{starting, started}` e carregamento de código enquanto código de `escript`, `-s` ou `-eval` corre durante o arranque; `{started, started}` e `not_allowed` depois de iniciado | Sempre as respostas de sistema iniciado | [builtins](builtins.md#init-module) |
| `init:stop/0,1`, `init:reboot/0` | Devolvem `ok`; `init` desliga então as aplicações e termina, enquanto o chamador continua a correr | Terminam de imediato; a chamada nunca regressa | [builtins](builtins.md#init-module) |
| `init:get_argument(home)` em Windows sem `HOMEDRIVE`/`HOMEPATH` | A pasta de perfil da shell | `USERPROFILE`, normalmente a mesma pasta | [builtins](builtins.md#init-module) |
| `erlang:halt(Slogan)`, `init:stop(Slogan)` | Imprime o slogan, escreve `erl_crash.dump` no diretório atual e indica-o em stderr; código de saída 1 | Imprime o slogan em stderr, não escreve crash dump; código de saída 1 | [executáveis](executables.md) |
| `init:restart/0,1`, `init:boot/1`, `init:make_permanent/2` | Reiniciam o sistema no mesmo nó, arrancam-no ou definem o script de arranque do próximo reinício | Recusados: erro `notsup`, `{error, notsup}` de `make_permanent/2` | [builtins](builtins.md#init-module) |
| Aridade de `atomics:new/2` | Qualquer inteiro positivo que o alocador consiga servir; um enorme termina o nó com um crash dump | 1 a 2^27, caso contrário `badarg` | [builtins](builtins.md#atomics-and-counters) |
| `counters` com `write_concurrency` | Contadores por escalonador somados na leitura; a memória de `info/1` cresce com o número de escalonadores | Um único array de atomics; a memória de `info/1` é a do array | [builtins](builtins.md#atomics-and-counters) |
| `erts_internal:term_type/1` | A representação interna: `flatmap` ou `hashmap`, `heap_binary`, `refc_binary` ou `sub_binary`, ... | Todos os maps `flatmap`, todos os bitstrings `sub_binary` | [builtins](builtins.md#erts-internal) |
| `erl_prim_loader:get_path/0` | O caminho de código de arranque | `["."]` até `set_path/1` | [ports](ports.md#standard-io-and-files) |
| `file:read_link_info/1,2` de uma ligação simbólica em Windows | Os dados do próprio reparse point da ligação | O tamanho e as datas do destino com tipo `symlink` | [ports](ports.md#standard-io-and-files) |
| `inet:gethostbyname/1,2` | O nome canónico e os aliases do resolvedor (`inet_res`, ficheiro hosts, nativo) | O nome pedido e sem aliases; endereços do resolvedor do sistema | [ports](ports.md#sockets) |
| Módulo `socket` | A API NIF de sockets | Em falta: uma referência é um erro de compilação; usar `gen_tcp`, `gen_udp`, `inet` | [biblioteca](library.md) |
| `net:getifaddrs/1,2` com um espaço de nomes, `inet:getifaddrs([{netns, _}])` | `net` chama-se a si próprio sem fim (OTP 29); `inet` lê o espaço de nomes no Linux | `{error, enotsup}` | [builtins](builtins.md#network-names) |
| Listas de saída de `zlib` | Um binary por bloco interno, aninhado onde um fluxo terminou e recomeçou | Um binary por chamada, `[]` quando não há nenhum; os bytes são os do OTP | [builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` e chamadas `zlib` longas | Regressam após uma quantidade limitada de saída (`{continue, Output}`) e cedem | Descomprimem toda a entrada em fila numa única chamada (`{finished, Output}`); uma chamada longa retém a thread do seu escalonador | [builtins](builtins.md#zlib-module) |
| Correspondências `re` longas | `re:run/3` e o ciclo global cedem após uma quantidade limitada de trabalho | Uma correspondência corre até ao fim e retém a thread do seu escalonador; uma execução global cede apenas entre correspondências | [builtins](builtins.md#re-module) |
| `re:compile/2` com `export`, `re:import/1` | Um padrão exportado `{re_exported_pattern, ...}` que outro nó importa | `export` é `badarg`; `import/1` lança `{not_implemented, import, 1}` | [builtins](builtins.md#re-module) |
| Erros de argumento de `re` | `badarg` lançado de `re:run/3` (ou `replace`, `split`) com os argumentos do chamador e `error_info` | `badarg` lançado do auxiliar de `re` que rejeitou o argumento, com os argumentos desse auxiliar | [builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` para módulos de `kernel`, `stdlib` e `compiler`, e para os módulos dos diretórios nomeados por `code:stick_dir/1` | Sempre `false`; `stick_dir/1` apenas verifica se o diretório pode ser listado | [builtins](builtins.md#code-module) |
| `code:root_dir/0` e o caminho de código inicial | O diretório de instalação do OTP; o caminho contém os seus diretórios `lib/*/ebin` | O diretório do executável; o caminho contém os diretórios `ebin` de `lib/` ao lado dele e de `ERL_LIBS`, depois `"."` | [builtins](builtins.md#code-module) |
| `code:load_file/1`, `load_abs/1`, `load_binary/3`, `atomic_load/1`, `prepare_loading/1` com código objeto válido | Carregam o módulo | `{error, badfile}`: todos os módulos são ligados ao executável (D01) | [builtins](builtins.md#code-module) |
| `code:coverage_support/0` e as funções de cobertura | `true` com o JIT; modos e contadores de cobertura | `false`; as restantes lançam `badarg`, como o OTP sem suporte de cobertura | [builtins](builtins.md#code-module) |
| `code:get_doc/1` de um módulo que o programa tem | O seu bloco de documentação EEP 48 | `{error, missing}`: os executáveis não incorporam documentação | [builtins](builtins.md#code-module) |
| Formatação de um termo grande (`io:format/1,2`) | Corre em código Erlang (`io_lib`) e no group leader, pelo que o processo pode ser preemptado durante a formatação | Corre até ao fim numa única chamada de builtin; os outros processos esperam | [builtins](builtins.md#portions) |
| Flags de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` e outras | Apenas `trap_exit` e `min_heap_size`; qualquer outra flag lança `badarg` | [processos](processes.md#builtins) |
| Ordem dos relatórios de erro de processos que falham ao mesmo tempo | Ordem do logger | A ordem pela qual os respetivos workers os terminam | [processos](processes.md#workers) |
| Sinais de saída (`exit/2`, `exit_signal/2`) para um processo em execução noutro escalonador | Colocados na sua fila de sinais e tratados mais tarde, enquanto o emissor prossegue | O emissor espera até ao fim da fatia de tempo do destino e atua então de imediato; observável apenas na temporização (as mensagens ficam em buffer e o emissor prossegue) | [processos](processes.md#workers) |
| `term_to_binary/1` de uma fun local ou de um native record | Codificado (`NEW_FUN_EXT`, ...) | `error:notsup`; `fun M:F/A` é codificada | [builtins](builtins.md#external-term-format) |
| `term_to_binary/1` de um map com mais de 32 chaves | Ordem de hash salvo com `deterministic` | Sempre a ordem das chaves (os bytes de `deterministic`) | [builtins](builtins.md#external-term-format) |
| `binary_to_term/1` do pid, port ou referência de outro nó; opção `local` de `term_to_binary/2` | Identidades externas; codificação `LOCAL_EXT` | `badarg` | [builtins](builtins.md#external-term-format) |
| Limite de tempo dos temporizadores | Depende da unidade de tempo nativa (cerca de 2^49.7 ms em Windows) | Tempo relativo 0..2^49-1 ms em todas as plataformas | [processos](processes.md#timers) |
| `unique_integer/0,1` sem `positive` | Pode ser negativo | Sempre positivo e crescente | [builtins](builtins.md#time) |
| Itens `current_function`, `initial_call`, `current_stacktrace`, ... de `process_info/2` | Indicados | `error:{notsup, Item}`; `process_info/1` omite-os | [processos](processes.md#introspection) |
| `reductions` de `process_info/2`; `reductions`, `garbage_collection`, `io` de `statistics/1` | Contados | 0 (não mantidos) | [builtins](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Recolhe antes de regressar | Recolhe no próximo safepoint do destino | [processos](processes.md#introspection) |
| `erlang:system_info(machine)`, e por isso `?MACHINE` de `epp` e a macro que nomeia | `"BEAM"`, `'BEAM'` | `"Clause"`, `'Clause'` | [builtins](builtins.md#system-information) |
| `erlang:system_info(schedulers)` de um programa iniciado com uma máscara de afinidade (`start /affinity`, `taskset`) | Um escalonador por processador lógico da máquina (32 com uma máscara de 7 CPUs), `schedulers_online` um por CPU da máscara | Ambos um por CPU da máscara: o Clause inicia apenas as threads de trabalho ativas | [processos](processes.md#workers) |
| Opções de afinação de `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Aplicadas | Verificadas e aceites, não aplicadas | [processos](processes.md#spawn-options) |
| `hibernate/3` | Descarta a pilha; o processo termina quando `M:F` regressa | Mantém a pilha; o resultado de `M:F` regressa ao chamador de `hibernate/3` | [processos](processes.md#spawn-options) |
| `monitor(port, Item, Options)` com opções | Aceite | `badarg` | [processos](processes.md#aliases) |
| `spawn_request_abandon/1` | `true` enquanto a resposta está pendente | Sempre `false`: a resposta é enviada antes de `spawn_request` regressar | [processos](processes.md#spawn-options) |
| Último bit de `math:log2/1` (Windows) | A compilação do OTP para Windows divide `log(X)` por `log(2)` (`math:log2(1.0e308)` é `1023.1538532253077`) | O `log2` da biblioteca C (`1023.1538532253076`) | [builtins](builtins.md#math-module) |
| `phash/2`, `phash2/1,2` de pids, ports, referências, funs e native records | Hashes dos números de processo, port e referência do OTP, do índice e número único de uma fun, do hash da definição de um record | Hashes dos números do Clause, do módulo, aridade ou índice e capturas de uma fun, dos valores dos campos de um record; todos os outros termos produzem o hash do OTP | [builtins](builtins.md#hashing) |
| `dict:fold/3`, `map/2`, `filter/2` com um valor que não é uma fun | `function_clause`, ou `{badfun, F}` quando o primeiro bucket visitado pelo OTP contém uma entrada | `function_clause` | [builtins](builtins.md#collections) |
| `erlang:is_builtin/3` de `lists:reverse/2` e outras funções de biblioteca implementadas em C | `true` | `false`: apenas os builtins do runtime e `apply/2,3` | [funs](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` de `fun_info/1,2` de uma fun local | Pid do criador, checksums do compilador | `undefined`, MD5 do nome do módulo | [funs](funs.md#fun-information) |
| Contexto de `md5_init/0` | Estado de 92 bytes do OTP | Estado de 96 bytes do Clause; os digests são iguais | [builtins](builtins.md#hashing) |
| `erlang:delete_module/1` de um módulo carregado | Torna o seu código antigo (`true`) | `error:notsup`: o código ligado mantém-se | [builtins](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Prepara um binary BEAM válido | Sempre `{error, badfile}` | [builtins](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | Os módulos de arranque pré-carregados | Todos os módulos do programa | [builtins](builtins.md#code-loading) |
| `list_to_pid/1` de um número nunca emitido | Devolve um termo pid | `badarg`: só são admitidos os pids que este programa criou | [termos](terms.md#pids-and-references) |
| `list_to_port/1` de um número nunca emitido | Devolve um termo port | `badarg`: só são admitidos os ports que este programa abriu | [ports](ports.md#identity) |
| Valores de `port_info/1,2` | `id` é um índice de tabela; `memory`, `queue_size`, `locking` descrevem o driver | `id` é o número do port; `memory` e `queue_size` são 0; `locking` é `port_level` | [ports](ports.md#builtins-and-port-messages) |
| Escrita num ficheiro aberto só para leitura | `{error, eacces}` em Windows, `{error, ebadf}` nos restantes | `{error, ebadf}` em todo o lado | [ports](ports.md#standard-io-and-files) |
| Porta de `win32reg` | A porta `registry__drv__` ligada estaticamente (`{spawn, "registry__drv__ rw"}`), que responde aos comandos com mensagens de porta | O driver `clause_registry` (`{spawn_driver, ...}`), que dá as mesmas respostas através de `port_control/3`; `port_info/2` nomeia-o `clause_registry` | [ports](ports.md#the-registry) |
| Nome do programa de `argparse` sem a opção `progname` | O `progname` do emulador (`erl`) | O nome do executável sem a extensão (`init` não tem `progname`) | [biblioteca](library.md) |
| Frame superior da pilha de um erro de validação de comando de `argparse` | A função de validação (`argparse:validate_command/2`, `validate_option/2`, uma fun dentro delas) com `[Entity]` | `argparse:validate/2` com `[Entity]` | [builtins](builtins.md#argparse) |
| `escript:script_name/0` | O caminho do escript, o primeiro argumento simples | O caminho do executável: um programa Clause é o seu próprio script | [biblioteca](library.md) |
| `escript:extract/2` com `compile_source` | O código-fonte compilado para um beam | `{error, {compile, ...}}`: os programas Clause não têm compilador | [biblioteca](library.md) |
| `erl_abstract_code:debug_info(core_v1, ...)` (Core Erlang de beam_lib) | Core Erlang do compilador | `{error, failed_conversion}`: os programas Clause não têm compilador | [biblioteca](library.md) |
| `zstd:get_frame_header/1` de um cabeçalho de frame truncado | Os campos de memória não inicializada | Os campos a zero (`'ZSTD_frame'`, tamanhos 0) | [builtins](builtins.md#zstd-module) |
| `file:open/2` com `raw` ou `ram` | Um record `#file_descriptor{}` servido no chamador (`is_pid/1` falso); os pedidos `io` sobre ele falham; um ficheiro `ram` não tem `read_line/1` (`undef`) e, fechado, responde `{error, einval}` | Um pid de servidor de ficheiros como os restantes ficheiros; E/S posicionada e `sendfile/5` respondem como para os ficheiros raw do OTP; um ficheiro `ram` responde a `read_line/1` e a pedidos de E/S com `{error, enotsup}`, e com `{error, terminated}` depois de fechado | [ports](ports.md#standard-io-and-files) |
| `file:truncate/1` num ficheiro aberto apenas para leitura | O erro da plataforma (`eacces` no Windows, `einval` nas restantes) | O erro do runtime C para o descritor (`ebadf` ou `einval`); o servidor para como o do OTP | [ports](ports.md#standard-io-and-files) |
| Ficheiros abertos ou configurados para `{utf16, _}` ou `{utf32, _}` | Linhas e caracteres descodificados nessa codificação | As linhas terminam num byte 10 antes de serem descodificadas | [ports](ports.md#standard-io-and-files) |
| Sequências de `io_ansi` no Linux e no macOS | Da base de dados terminfo de `TERM` quando tem a capacidade (`setaf`, `sgr0`, ...); `tput/1,2`, `tigetnum/1`, `tigetflag/1`, `tinfo/0` leem-na | As sequências ANSI incorporadas que o OTP usa sem terminfo (como o OTP no Windows); `tigetnum/1`, `tigetflag/1`, `tinfo/0` respondem `{error, enotsup}`, `tput/1,2` lançam `{enotsup, Capability}`; `enabled/0,1` exige um `TERM` diferente de `dumb` | [biblioteca](library.md#contents) |
| `io_ansi:scan/1` e `tput/1,2` no Windows | Falham com `try_clause` sobre o `{error, enotsup}` de terminfo | `scan/1` reconhece as sequências incorporadas; `tput/1,2` lançam `{enotsup, Capability}` | [biblioteca](library.md#contents) |
| `socket` no Windows: `recvmsg`, `sendmsg`, `sendfile`, `sendmmsg`, `recvmmsg` | Lançam `notsup` | Funcionam como no Linux e no macOS | [biblioteca](library.md#contents) |
| `socket` no Windows: um datagrama maior do que o comprimento de `recv` | `{error, {completion_status, ...more_data...}}` | O datagrama truncado, como nas restantes plataformas | [biblioteca](library.md#contents) |
| `socket` no Linux e no macOS: `ioctl/2,3,4`, `getopt_native/3`, `setopt_native/3`, `open/1,2` de um descritor, domínio `local`, SCTP | Suportados | Recusados como o OTP no Windows os recusa (`{error, {invalid, ...}}`, `notsup`); `local` dá `{error, eafnosupport}` | [biblioteca](library.md#contents) |
| `socket:info/1`, `i/0,1,2` | Os contadores e estados do NIF, `fd` é o descritor | Contadores das chamadas efetuadas, estados tal como o módulo os acompanha; `Fd` é o número da porta | [biblioteca](library.md#contents) |
| Respostas de `inet_res` | As respostas de `gethostbyname`, `getbyname` e `gethostbyaddr` são guardadas em cache por TTL em `inet_db`; uma consulta em cache pode listar os endereços noutra ordem | Nada é guardado em cache: cada consulta pergunta aos servidores de nomes | [biblioteca](library.md#contents) |
| Configuração do resolvedor no Linux e no macOS | `inet_db` também lê ficheiros `host.conf`/`nsswitch.conf` e `inetrc`, acompanha alterações a `resolv.conf` e, no Linux, deriva o domínio do nome da máquina | As linhas `nameserver`, `domain` e `search` de `resolv.conf` e o ficheiro hosts, lidos uma vez | [biblioteca](library.md#contents) |
| `os:set_signal(Signal, handle)` (Linux, macOS) | O sinal é enviado para `erl_signal_server`, cujo tratador predefinido para o sistema com `sigterm` e termina com `sigusr1` e `sigquit` | Sem `erl_signal_server`: `sigterm` e `sigquit` terminam com estado 0, `sigusr1` com estado 1, os restantes são descartados; sem `set_signal`, `SIGTERM` mantém a ação predefinida do sistema | [ports](ports.md#subprocesses) |
| Argumentos vazios de `{spawn_executable, F}` em Windows | Omitidos da linha de comandos | Passados como `""` | [ports](ports.md#subprocesses) |
| `{exit_status, S}` e `eof` de um programa lançado | Ordem não especificada, `exit_status` pode chegar antes dos últimos dados | Depois de todos os dados, antes de `eof` | [ports](ports.md#subprocesses) |
| Ports ocupados | Um port com demasiada saída em fila suspende os emissores, incluindo ports de socket; `force` de `port_command/3` funciona nos drivers que o permitem | Só os ports de programas lançados ficam ocupados; os ports `fd` e de socket nunca ficam; `force` lança `notsup` em todos os drivers | [ports](ports.md#busy-ports) |
| `{active, N}` de sockets | Um inteiro `N` conta as mensagens antes de `{tcp_passive, S}` | `exit(badarg)`; apenas `true`, `false` e `once` | [ports](ports.md#sockets) |
| Opções de socket do próprio `inet_drv` (`header`, `deliver`, `exit_on_close`, `send_timeout`, `send_timeout_close`, `delay_send`, marcas de nível, `packet_size`, `show_econnreset`, `buffer`, `read_packets`, `recvtos`, `recvttl`, `line_delimiter`) | Aplicadas | Mantidas e comunicadas por `getopts/2` com os valores predefinidos do OTP, sem serem aplicadas; as opções do sistema (`nodelay`, `keepalive`, `linger`, buffers, `tos`, multicast, ...) são aplicadas | [ports](ports.md#sockets) |
| Outras opções de socket (`{packet, line \| http \| ...}`, `{raw, ...}`, `bind_to_device`, `netns`) | Funcionam | `exit(badarg)` na abertura, `{error, einval}` de `setopts/2` e `getopts/2` | [ports](ports.md#sockets) |
| `inet:getopts(S, [multicast_if])` no Windows | Lê memória não inicializada para um socket TCP, e o endereço genérico depois de um socket UDP definir um | O valor do sistema; o endereço genérico quando o socket não tem nenhum | [ports](ports.md#sockets) |
| `port_info(Socket, input \| output)`, `input` e `output` de `inet:info/1` | Os bytes dos comandos e respostas do driver | 0: o tráfego de sockets é contado apenas por `inet:getstat/1,2` | [ports](ports.md#sockets) |
| Razões de erro de sockets | Todas as razões POSIX que o sistema indica | As comuns (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...); as restantes são `eio` | [ports](ports.md#sockets) |
| Entrada de um port enquanto o processo ligado retém 1 024 mensagens e pode correr | Continua a ler e a entregar | Deixa de entregar até ao fim da fatia de tempo do processo; acima de 64 KiB retidos, deixa de ler, pelo que o programa que escreve fica bloqueado | [ports](ports.md#busy-ports) |
| `gen_tcp:close/1` com saída em fila | Espera, até ao valor de `linger`/`send_timeout`, que a saída seja enviada | Regressa de imediato; a thread de E/S envia a saída em fila e depois fecha | [ports](ports.md#sockets) |
| Tipos de `monitor/2` | `process`, `port`, `time_offset` | `process` e `port`; `time_offset` lança `badarg` (não há alterações do desvio de tempo) | [processos](processes.md#monitors) |
| `exit/2`, `exit_signal/2` para uma referência | Envia para o alias do processo, se a referência for um alias ativo | Nada: os sinais de saída nunca vão para aliases | [processos](processes.md#exit-signals) |
| Números de referência | Combinam um identificador de escalonador e contadores por escalonador (`#Ref<0.178111994.4235460610.214105>`) | Um único contador para todo o programa (`#Ref<0.0.0.1>`), pelo que as referências se ordenam por criação | [termos](terms.md#pids-and-references) |

## Erros, stack traces e relatórios

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Localizações nos stack traces | `[{file, F}, {line, L}]`, `error_info` para `error/3` | Sempre `[]`; sem `error_info`, pelo que `erl_error:format_exception/3,4` não mostra localizações nem linhas `*** argument` para elas | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` com entradas de pilha `{Fun, Args}` | Aceites | Rejeitadas | [ABI](abi.md#stack-traces) |
| Frame superior de `function_clause` | Lista de argumentos | Aridade | [ABI](abi.md#stack-traces) |
| Frame superior de `undef` numa chamada `M:F(A1, ..., An)` | `{M, F, [A1, ..., An], []}` | `{M, F, N, []}`: a aridade em vez dos argumentos (`apply/3` e chamadas de funs mostram os argumentos) | [funs](funs.md#dynamic-calls) |
| Chamada dinâmica de um export que um executável não consegue alcançar (o seu módulo é nomeado apenas através de um stack trace, de uma exceção ou de uma mensagem vinda de fora do programa) | Chama-o | `undef`, salvo se compilado com `--keep-exports`; `function_exported/3` e `module_info(exports)` continuam a listá-lo | [executáveis](executables.md#export-liveness) |
| Frames de BIFs/operadores que falham | Presentes (`{erlang, '+', Args, ...}`) | Ausentes; nada abaixo da função de entrada | [ABI](abi.md#stack-traces) |
| Tabela de átomos cheia (`list_to_atom/1`) | O emulador aborta (`no more index entries in atom_tab`) e escreve um crash dump | `clau: runtime failure: entry call failed: resource_limit`, código de saída 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` com caracteres acima de 255 | Os primeiros dígitos usam apenas o byte inferior de cada carácter (`[16#131]` é 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` de um BIF | Verdadeiro para todos os BIFs do emulador | Verdadeiro apenas para os builtins que este runtime fornece | [builtins](builtins.md#how-calls-reach-them) |
| Relatórios de erro de processos que falharam | Enviados ao logger, escritos mais tarde pelo seu handler por omissão (na saída padrão sob `erl`, frequentemente perdidos quando um escript termina primeiro) | Escritos em stderr quando o processo termina, antes de qualquer saída posterior; não são eventos de `logger`, pelo que os tratadores e filtros não os veem | [processos](processes.md#exits) |
| Chamadas a funções que nunca regressam | Compiladas como chamadas de cauda (o chamador não aparece no trace) | Chamadas normais (o chamador aparece) | [ABI](abi.md#stack-traces) |
| Exceções dentro de uma fun anónima conhecida em `-O2` (`F = fun ... end, F(X)`, `lists:map(fun ... end, L)` e os restantes ciclos de listas, `maps:fold(fun ... end, A, M)`) | Frames da fun (`-f/1-fun-0-`) e dos auxiliares de `lists` e `maps` (`lists:map_1/2`) | O corpo da fun corre inline no chamador: esses frames estão ausentes, e uma cauda imprópria de lista de `map/2`, `foldl/3`, `all/2`, `any/2`, `flatmap/2` lança `function_clause` com o chamador no topo | [funs](funs.md#inlined-funs) |
| Memória do anfitrião esgotada | O emulador indica que não consegue alocar memória, escreve um crash dump e para | `clau: runtime failure: entry call failed: out_of_memory`, código de saída 70, sem dump | [heap do runtime](runtime-heap.md#failure-behavior) |
| Armazenamento de maps com mais de 32 chaves | Uma HAMT no heap de nós com hash de 16 ramos | Uma árvore B+ no heap com até 16 entradas por nó pela ordem das chaves; os tamanhos de heap dos maps grandes diferem dos do OTP | [heap do runtime](runtime-heap.md#map-trees) |
| Limite de memória por processo | `max_heap_size` (em palavras, heap e pilha) mata o processo com a razão `killed` e regista um relatório de erro | `--max-heap` / `--max-stack` (bytes) e o `--max-memory` global do runtime fazem falhar o processo que pede memória com `resource_limit`: `clau: runtime failure: entry call failed: resource_limit`, código de saída 70 | [heap do runtime](runtime-heap.md#runtime-memory-limit) |
| Argumentos do programa | `escript` passa todos os argumentos a `main/1`; as flags do emulador (`+t`) vêm de `%%!` ou de `ERL_FLAGS` | As opções do runtime iniciais (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) são retiradas primeiro; `CLAUSE_FLAGS` contém as mesmas opções | [executáveis](executables.md#runtime-options) |
| Exceção não apanhada num módulo de entrada normal | `escript` termina com 127 | Termina com 1 e uma linha `uncaught exception <class>: <reason>` (os códigos-fonte escript mantêm 127) | [executáveis](executables.md) |
| Diagnósticos do compilador | Formulação do `erl_lint` (`variable 'X' is unbound`) e avisos | Formulação própria (`unbound variable X`); os avisos de lint do OTP na maioria não são emitidos (também os avisos de native records: campos desconhecidos em acesso, atualização e padrões, construção qualificada do próprio módulo sem valores, records não usados ou definidos em cabeçalhos; um padrão posterior que corresponde a um nome exportado de um ramo) | [análise semântica](semantic.md#bindings) |
| Módulo de behaviour com um `behaviour_info/1` escrito à mão | Chama-o ao compilar os utilizadores e avisa sobre callbacks em falta, mal definidos ou obsoletos | Não avaliado: os callbacks dos seus utilizadores não são verificados | [análise semântica](semantic.md#behaviours) |
| Módulos de behaviour que não estão no lote nem na biblioteca do Clause (`application`, ...) | Carregados a partir do caminho de código; os seus callbacks são verificados | Aviso `behaviour M undefined` | [análise semântica](semantic.md#behaviours) |
| Tratador predefinido de `logger` | `logger_std_h` escreve de forma assíncrona com proteção contra sobrecarga (modos síncrono, descarte e esvaziamento, limites de rajada, terminação por sobrecarga) | Também em `standard_io` (`standard_error` com `CLAUSE_LOGGER_TYPE=standard_error`), mas cada evento é escrito antes de a chamada de registo devolver; as opções de sobrecarga são verificadas e mantidas sem efeito | [biblioteca](library.md) |
| Processos dos tratadores de `logger_std_h` | Supervisionados por `logger_sup`, reiniciados após `overload_kill_restart_after` | Ligados ao servidor `logger`; um tratador cujo processo morra é removido | [biblioteca](library.md) |
| `net_adm:names/0,1` | Consulta epmd: `{ok, Names}` quando há um epmd a correr na máquina | `{error, address}`: o Clause não tem cliente epmd | [biblioteca](library.md) |
| `net_kernel:start/1,2` | Inicia a distribuição, ou dá o erro do OTP quando não consegue | Indisponível (`not_implemented`) | [biblioteca](library.md) |
| Rastreio: `erlang:trace/3`, `trace_pattern/2,3`, `trace_info/2`, `trace_delivered/1`, `system_monitor/0,1,2`, `system_profile/0,2`, `seq_trace/2`, `seq_trace_info/1`, `seq_trace_print/1,2`, `dt_*`, o módulo `trace`, `erl_tracer:enabled/3`, `trace/5` | Rastreiam | `error:notsup` | [builtins](builtins.md#erlang-module) |
| Tokens de `seq_trace` | Transmitidos com as mensagens; os números de série contam-nos; um rastreador do sistema recebe mensagens de rastreio | Mantidos apenas por processo: não são transmitidos, os números de série ficam como foram definidos, sem mensagens de rastreio | [biblioteca](library.md) |
| Âmbitos de `pg` e `global` | Replicam entre nós ligados; `pg` monitoriza nós através de `net_kernel` | Um nó, sem pares nem monitorização de nós | [biblioteca](library.md) |
| Recursos de aplicações | Ficheiros `.app` encontrados no caminho de código ao carregar; `sys.config`, `-config` e argumentos `-App Key Value` definem os ambientes | Compilados para o executável a partir dos ficheiros de recursos da compilação; alterá-los exige recompilar; sem ficheiros nem argumentos de configuração | [biblioteca](library.md#applications) |
| Aplicações `kernel` e `stdlib` | Iniciadas no arranque; `kernel` tem um mestre e um supervisor de topo | Carregadas e em execução sem mestres: `get_supervisor(kernel)` é `undefined`, `info/0` lista-as em execução como `undefined` | [biblioteca](library.md#applications) |
| `application:ensure_all_started/3` com `concurrent` | Inicia aplicações independentes ao mesmo tempo; a lista segue a ordem de conclusão | Inicia-as uma após outra, primeiro as dependências | [biblioteca](library.md#applications) |
| `application:takeover/2` | Espera pelo controlador de aplicações distribuídas | Termina com `noproc` (sem `dist_ac`), como `load/2` com nós faz em ambos | [biblioteca](library.md#applications) |
| Pedidos de E/S a um mestre de aplicação | Encaminhados para o líder de grupo sob o qual a aplicação arrancou | Respondidos na E/S padrão | [biblioteca](library.md#applications) |
| `erlang:process_flag(error_handler, Module)` | O runtime chama `Module:undefined_function/3` e `undefined_lambda/3` para chamadas indefinidas | `badarg`; `process_info/2` comunica sempre `error_handler`, e as chamadas indefinidas lançam `undef` diretamente ([`error_handler`](library.md) só pode ser chamado) | [biblioteca](library.md) |
| Detalhes dos relatórios de falha (`proc_lib`) | Texto da exceção de `erl_error` com informação de erro alargada; vizinhos com `current_function`, `initial_call` e `current_stacktrace`; `reductions` reais | A linha da classe da exceção e os frames da pilha sem informação de erro alargada; vizinhos sem esses itens; `reductions` 0 | [biblioteca](library.md) |
| `client_info` dos relatórios de erro de `gen_server`, `gen_statem` e `gen_fsm` | O `current_stacktrace` do processo chamador | `[]`: o Clause não mantém a pilha atual de outro processo | [biblioteca](library.md) |
| `-behaviour` com um valor que não é um átomo | O aviso imprime o termo com `~w` (`behaviour [115,116,114] undefined`) | Imprime o texto-fonte do atributo (`behaviour "str" undefined`); o erro é o mesmo | [análise semântica](semantic.md#behaviours) |
| `module_info(md5)` e o `vsn` que o OTP dele deriva | MD5 do código BEAM compilado | MD5 do código-fonte impresso do módulo; o inteiro `vsn` derivado difere em conformidade | [análise semântica](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` da aplicação compiler do OTP, `options` que lhe foram dadas | A versão do Clause; `options` sempre `[]` | [análise semântica](semantic.md#predefined-functions) |
| `module_info(functions)` | Lista também as funções que o OTP gera para as funs (`'-f/0-fun-0-'/0`) | Apenas as funções do código-fonte e as predefinidas | [análise semântica](semantic.md#predefined-functions) |
| `-nominal` em `module_info(attributes)` | Mantido como `{nominal,[{Name,AbstractType,Params}]}` em formato abstrato | Omitido | [análise semântica](semantic.md#predefined-functions) |
| Uma função de um módulo de biblioteca do Clause que o Clause não implementou (um BIF de `erlang`, `lists:rmerge/2`, ...) | Corre | Compila; lança `error({not_implemented, F, A})` quando chamada, com `M:F/A` no topo da pilha ([estados](../library/modules.terms)) | [biblioteca](library.md#provided-or-missing), [builtins](builtins.md#erlang-module) |
| Import de um módulo fora do lote | Compila; a chamada lança `undef` em tempo de execução se o módulo faltar | Erro de compilação `unknown module M` quando o import é chamado (os imports não usados não precisam do módulo) | [análise semântica](semantic.md#imports) |
| Aviso `import directive overrides auto-imported BIF` | Para cada BIF auto-importado de `erl_internal:bif/2` | Apenas para os BIFs auto-importados que o Clause implementa | [análise semântica](semantic.md#imports) |

## Casos-limite da linguagem

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Segmento inteiro mais largo do que o limite de inteiros, valor acima dele (`<<V:4194241>>` só com uns) | O JIT x86 faz a correspondência com um termo inválido; usá-lo faz a VM falhar | Sem correspondência | [termos](terms.md#integers) |
| Grupo zip cujos geradores relaxados e estritos partilham uma variável | O teste de salto mantém as variáveis dos padrões estritos nos padrões relaxados | Um passo rejeitado é saltado sempre que os padrões estritos correspondem por si só | [padrões](patterns.md#comprehensions) |
| Chamar uma fun externa, `M:F(Args)` ou `apply/3` de um módulo fora do programa | Carrega o módulo a partir do caminho de código, `undef` se não existir | `undef`; os módulos de biblioteca só entram no programa quando este os nomeia com um átomo literal | [funs](funs.md#dynamic-calls), [biblioteca](library.md#how-programs-get-them) |
| Ficheiros sem `#!` passados como escripts | `escript file.erl` salta a primeira linha | Compilados como módulos normais | [executáveis](executables.md) |
| Escripts com beam pré-compilado e em arquivo | Correm | Não suportados | [executáveis](executables.md) |
| Nome do módulo de um escript sem `-module` | `<name>__escript` mais um sufixo de data/hora ou único | `<name>__escript`, determinístico | [executáveis](executables.md#escripts) |
| `include_lib` de uma aplicação encontrada em vários diretórios `<app>-<version>` | O caminho de código contém uma única versão (o arranque escolhe a mais alta); sem diagnóstico | A versão mais alta abaixo de cada diretório pesquisado, com um aviso por execução que as lista | [pré-processador](preprocessor.md#compatibility-policies) |
| Um `-spec` cujos tipos não partilham nenhum valor com o resultado inferido, o domínio de entrada ou os argumentos de uma chamada | Compila; o Dialyzer pode avisar | Um domínio de entrada de argumentos contradito é um erro de compilação que indica os tipos declarados e inferidos; um resultado ou uma chamada contraditos são um aviso, e são usados os tipos inferidos | [análise semântica](semantic.md#inference) |

## ETS

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Ordem de `first/1`, `next/2`, `tab2list/1`, `foldl/3` e `i/1` sobre tabelas `set`, `bag` e `duplicate_bag`, e o que `slot/2` numera | Posições de hash linear visitadas bloqueio a bloqueio; a ordem muda à medida que a tabela cresce | Partes, depois buckets por ordem, depois chaves pela ordem de inserção dentro de um bucket; uma posição é um bucket | [runtime](runtime.md#ets-tables) |
| `ets:all/0` | Inclui as tabelas de `kernel` e `stdlib` do OTP; ordem das respostas dos escalonadores | Apenas as tabelas do programa, sem ordem particular | [builtins](builtins.md#ets) |
| `memory` de `info/2` | Palavras alocadas para a tabela e os seus objetos | Palavras dos objetos armazenados mais os custos adicionais próprios do Clause | [builtins](builtins.md#ets) |
| `{write_concurrency, auto}` | O número de bloqueios adapta-se à contenção (64 a 8192) | 64 partes fixas, como para `true`; `stats` comunica 64 bloqueios | [runtime](runtime.md#ets-tables) |
| `compressed` | Armazena elementos diferentes da chave em formato externo | Aceite e comunicado; os objetos são armazenados tal como estão | [builtins](builtins.md#ets) |
| `stats` de `info/2` de um `ordered_set` com `write_concurrency`; `data`; `binary` | Árvore CA `{RouteNodes, BaseNodes, MaxDepth}`; imprime a tabela; os binaries da tabela fora do heap | `false`; `true` sem imprimir; `[]` | [builtins](builtins.md#ets) |
| `badarg` de um builtin de `ets` | Contém `error_info` com uma causa (`id`, `access`, `type`, ...) | `badarg` simples | [builtins](builtins.md#ets) |
| Ordem dos resultados de `select`, `match` e `match_object` de tabelas de hash, e resultados que cada bloco de `select/3` contém | Resultados de cada passo do percurso acrescentados à cabeça, os mais recentes primeiro; posições de hash linear | Ordem de percurso das partes e buckets do Clause; cada bloco contém os primeiros `Limit` resultados recolhidos | [builtins](builtins.md#ets) |
| `select_delete/2`, `select_replace/2` sobre uma tabela inteira | Cedem a cada 1000 objetos (com a tabela fixada entretanto) | Correm de uma vez, cada parte sob o seu bloqueio | [runtime](runtime.md#ets-tables) |
| Especificações de correspondência que nomeiam uma variável com número 25 ou superior | Renumeram cada átomo `'$N'` da especificação, mesmo dentro de `{const, ...}` (por isso `{const, '$30'}` dá `'$0'`) | As variáveis mantêm os seus números; `{const, '$30'}` dá `'$30'` | [runtime](runtime.md#match-specifications) |
| Guards e corpos de especificações de correspondência aninhados a mais de 1000 níveis | Compilam até a pilha C ficar com pouco espaço (`system_limit`) | `system_limit` | [runtime](runtime.md#match-specifications) |
| Ações de rastreio em `erlang:match_spec_test/3`: `enable_trace`, `disable_trace`, `trace` com flags válidas | Alteram as flags de rastreio do chamador (29.1.1 falha sem um rastreador) | `true` após verificar as flags (e que um argumento pid está vivo); nada muda | [builtins](builtins.md#ets) |
| `ets:tab2file/2,3` e `file2tab/1,2` | Através de um processo disk_log nomeado por uma referência nova | Escritos e lidos diretamente com `file` | [builtins](builtins.md#ets) |
| `{process_dump}` e `{current_stacktrace}` em `erlang:match_spec_test/3` | O texto do dump do processo; o seu stack trace | `<<>>`; `[]` | [builtins](builtins.md#ets) |

## dets

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Pedidos à espera em conjunto numa tabela | Consultas, inserções e eliminações enfileiradas ao mesmo tempo partilham uma atualização da cache; as consultas são respondidas antes das escritas; uma tabela fixada faz alguns escritores dormir 1 ms | Cada pedido à vez, pela ordem de chegada | [builtins](builtins.md#dets) |
| Operações dets longas (reparações, `init_table/2,3`, compactações, esvaziamento de uma cache grande) | Código Erlang, interrompido por reduções | Uma chamada builtin cada; a thread de trabalho da tabela não executa mais nada entretanto | [builtins](builtins.md#dets) |
| Processos de `dets` | O servidor `dets` e `dets_sup` sob `kernel_safe_sup`, tabelas sob `dets_sup` | Um servidor `dets` iniciado na primeira utilização, sem supervisão; processos das tabelas ligados a ele | [builtins](builtins.md#dets) |
| Ordem de `dets:all/0` | A ordem ETS do registo | A ordem ETS do Clause ([ETS](#ets)) | [builtins](builtins.md#dets) |
| Relatórios | Uma reparação é registada ao nível info; `verbose/0,1` e `DETS_DEBUG` registam mais; uma falha interna é `{dets_bug, ...}` | Nada é registado | [builtins](builtins.md#dets) |

## io

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| `~p`, `~w` e escritores de `io_lib` de contentores aninhados a mais de 256 níveis | Impressos | `system_limit` | [io](io.md#pretty-printing-p) |
| `io_lib:print/4` com uma coluna ou comprimento de linha que não é inteiro | Depende do termo: impresso (as guards falham silenciosamente), `function_clause` ou `badarith` | `badarith` para qualquer termo contentor | [io_lib](builtins.md#io_lib) |
| Precisão ou contagem de preenchimento negativa (`~.*c` com -1) | Ciclo infinito | `badarg` | [io](io.md#formats) |

## erl_scan

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Localização de uma continuação de `tokens/3,4` (`continuation_location/1`, não documentada) | Onde o scanner parou, dentro do token inacabado | O início do token inacabado, que é analisado de novo com os próximos caracteres | [erl_scan](builtins.md#erl-scan) |
| `{compiler_internal, [ssa_checks]}` | Analisa os comentários de verificação `%ssa%` como tokens | Ignorado: continuam a ser comentários | [erl_scan](builtins.md#erl-scan) |
| Um número de vírgula flutuante com base (`16#1.8#e1`, base diferente de 10) cujos dígitos excedem 53 bits | A mantissa convertida como o ERTS converte inteiros grandes | Acumulado num double; o último bit pode diferir | [erl_scan](builtins.md#erl-scan) |
| Um elemento de lista que não é um carácter dentro de uma string, átomo entre aspas ou escape | `function_clause`, `case_clause` ou `if_clause`, consoante a cláusula | `function_clause` | [erl_scan](builtins.md#erl-scan) |

## erl_parse

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Tokens `'%ssa%'` (cláusulas de verificação SSA dos testes do compilador OTP) | Analisados como cláusulas `ssa_check_when` | Um erro de sintaxe; `erl_scan` nunca produz o token | [erl_parse](builtins.md#erl-parse) |

## erl_eval

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Stack trace de um erro lançado pelo avaliador (`{badmatch, V}`, `undef` de uma chamada local, ...) | A pilha atual do processo avaliador (`current_stacktrace` de `process_info/2`) | A pilha no `throw` do avaliador que a recolhe, nos frames do Clause | [erl_eval](builtins.md#erl-eval) |

## erl_lint

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Behaviours nomeados por `-behaviour` | Qualquer módulo no caminho de código responde a `behaviour_info/1` | Só respondem módulos ligados ao programa; outro é `undefined_behaviour` | [erl_lint](builtins.md#erl-lint) |
| Ordem de vários erros encontrados numa redução de map (variáveis de tipo únicas de um tipo, especificações sem função, verificações de callbacks) | A ordem interna do map (átomos por índice) | Ordem dos termos | [erl_lint](builtins.md#erl-lint) |
| `erlang:is_builtin/3` para entradas `-deprecated`, `-removed` e `-unsafe` que não são exportadas | A tabela de BIFs do OTP | Os builtins do runtime, que incluem funções nativas de biblioteca | [erl_lint](builtins.md#erl-lint) |
| `is_guard_expr/1` de uma construção de record | Lança `case_clause` | Responde se os campos são expressões de guard | [erl_lint](builtins.md#erl-lint) |

## epp

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| `-include_lib("App/...")` fora do caminho de inclusão | Encontrado em `code:lib_dir(App)`, que conhece as aplicações do OTP | Encontrado em `code:lib_dir(App)` do caminho de código do Clause, que não tem aplicações OTP a menos que lhe sejam adicionadas | [biblioteca](library.md#contents) |

## erl_pp

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Forma dos caracteres devolvidos por `erl_pp` | Listas de caracteres profundas | Uma lista de caracteres plana; a saída aplanada é igual | [builtins](builtins.md#erl-pp) |

## qlc

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Stack trace de uma exceção lançada num processo de cursor, quando `next_answers/1,2` a relança | O stack trace do cursor seguido do `process_info(self(), current_stacktrace)` do proprietário | Seguido do stack trace de uma exceção capturada no proprietário (o Clause não tem o item `current_stacktrace`) | [qlc](builtins.md#qlc) |
| `qlc:q/1,2` em `erl_eval`, `ets:table/1,2`, `dets:table/1,2` num programa que nunca nomeia `qlc` | `qlc` está sempre carregado | `undef` para `qlc`: estes chegam-lhe por um nome em runtime, pelo que só programas que nomeiam `qlc` (qualquer módulo que inclua `qlc.hrl` o faz) o ligam | [biblioteca](library.md#how-programs-get-them) |
| Números de anotações no código de consultas compiladas (`info/2` com `{format, abstract_code}`) | O transform do OTP numera as anotações à volta de todos os inteiros do módulo, incluindo os caracteres do caminho de `qlc.hrl` no seu atributo `file` | O mesmo transform, mas o `qlc.hrl` do Clause tem outro caminho, pelo que os números após a primeira consulta podem diferir; o código é igual nos restantes aspetos | [qlc](builtins.md#qlc) |

## qlc_pt

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Mensagens de `qlc_pt:parse_transform/2` em runtime | De `compile:noenv_forms/2` (`strong_validation`): `erl_lint` mais as passagens core do compilador, como avisos de `sys_core_fold` | Apenas de `erl_lint`, como o `qlc_pt` do OTP faz quando o compilador não está disponível | [qlc_pt](builtins.md#qlc-pt) |

## Shell interativa

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Edição de linhas num terminal | `edlin`: teclas de cursor, histórico de linhas, pesquisa, conclusão com Tab através de `edlin_expand`, o prompt multilinha `..>` | A edição de linhas do próprio terminal (modo cooked); as linhas são lidas tal como o terminal as entrega, com o mesmo prompt para cada linha adicional de um comando, como o OTP faz para entrada por pipe | [biblioteca](library.md#interactive-shell) |
| Controlo de tarefas | Ctrl+G abre o menu JCL (shells novas, ligadas, interrompidas e terminadas) | Nenhum; o cabeçalho e a indicação de comando lento continuam a nomear Ctrl+G como o OTP os imprime | [biblioteca](library.md#interactive-shell) |
| `exit().` quando a shell lê entrada por pipe | Uma shell nova arranca e não lê mais nada | Uma shell nova arranca e lê o resto da entrada | [biblioteca](library.md#interactive-shell) |
| Programas que iniciam a shell sem `--shell` | Todos os módulos do caminho de código podem ser chamados | Apenas os módulos que o programa liga; sem `--keep-exports` as chamadas dinâmicas chegam apenas a exportações alcançáveis pelo programa | [biblioteca](library.md#interactive-shell) |
| Records de módulos compilados (`rr(Module)`, `shell_default` e `user_default` no arranque) | Lidos da informação de depuração ou do código-fonte do módulo | `{error, nofile}`: o código ligado não mantém código abstrato; `rr/1,2,3` de ficheiros de código-fonte e `.beam` leem-nos | [biblioteca](library.md#interactive-shell) |
| `save_module/1` | Escreve o módulo e compila-o com `c:c/1` | Escreve apenas o módulo (sem compilador) | [biblioteca](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` dentro de uma chamada ou valor de campo de record | Cabeças de funções e tipos de argumentos da especificação da função (`lists:seq(From, To)`), átomos e tipos permitidos pela especificação | Cabeças `Mod:Fun/Arity` das aridades exportadas, sem sugestões de tipos: o código ligado não mantém especificações | [biblioteca](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` de funções e módulos | Funções agrupadas pelos grupos da documentação; módulos do caminho de código | Um grupo `Functions` (sem documentação); os módulos do programa | [biblioteca](library.md#interactive-shell) |
| Colunas de `c:i/0,1`, `c:ni/0`, `c:regs/0` | Chamada inicial e função atual de cada processo | A chamada inicial de `proc_lib` ou `undefined`; a função atual `undefined` (sem item `current_function`) | [biblioteca](library.md#interactive-shell) |

## Números aleatórios

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Alturas das faixas do zigurate normal de `rand` | Constantes tabeladas | Calculadas para o double mais próximo a partir das constantes do zigurate; uma altura pode diferir no último bit, o que altera uma aceitação no caminho lento apenas para um sorteio dentro desse bit do limite (probabilidade próxima de 2^-53 por sorteio no caminho lento). As larguras e os limites das faixas são observados a partir do OTP e são iguais | [builtins](builtins.md#random-numbers) |

## crypto

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Ordem de `crypto:supports(ciphers)` | A tabela do NIF ordenada por índice de átomo, que varia entre execuções da VM, depois os aliases | A ordem da tabela do OTP, depois os aliases | [builtins](builtins.md#crypto-module) |
| `{File, Line}` dos erros `{badarg \| notsup \| error, {File, Line}, Description}` de `crypto` | Ficheiro-fonte C e linha do OTP (`{"hash.c", 111}`) | Ficheiro-fonte C++ e linha do Clause (`{"hash.cpp", 63}`); a classe e a descrição são as do OTP | [builtins](builtins.md#crypto-module) |
| `link_type` de `crypto:info/0` | Como o OTP ligou libcrypto (normalmente `dynamic`) | Sempre `static`, também quando é ligada uma libcrypto partilhada instalada | [OpenSSL](crypto.md) |
| Cálculos longos de `pbkdf2_hmac/5` (mais de 100 iterações ou 64 bytes) | Executados num escalonador de CPU dirty | Executados na thread de trabalho do escalonador do processo chamador, que não executa mais nenhum processo entretanto | [builtins](builtins.md#crypto-module) |
| `modules` da aplicação `crypto` | `[crypto, crypto_ec_curves]` | `[crypto]` | [biblioteca](library.md) |
| Textos longos de `crypto_one_time/4,5` e `crypto_one_time_aead/4,6,7` (mais de 20000 bytes) | Executados num escalonador de CPU dirty | Executados na thread de trabalho do escalonador do processo chamador, que não executa mais nenhum processo entretanto | [builtins](builtins.md#crypto-module) |
| A variável de aplicação `fips_mode` de `crypto` | Lida quando o módulo `crypto` é carregado: `true` ativa o modo FIPS | Não é lida (o Clause não tem `on_load` e os programas não têm `sys.config`): usar `crypto:enable_fips_mode/1` ou `clau --fips` | [crypto](crypto.md#fips) |
| `crypto:info_fips/0` sem um fornecedor FIPS carregável | `not_enabled` quando o OTP foi compilado com suporte FIPS, `not_supported` caso contrário | `not_supported` | [crypto](crypto.md#fips) |
| Quando a aplicação `crypto` é carregada | Quando o módulo `crypto` é carregado (o seu `on_load`) | Quando um gerador `crypto_cache`, `crypto_aes` ou `crypto_prng1` lê `rand_cache_size` pela primeira vez | [biblioteca](library.md) |
| Geração de chaves RSA (`crypto:generate_key(rsa, ...)`) e assinaturas SLH-DSA | Executadas num escalonador de CPU dirty | Executadas na thread de trabalho do escalonador do processo chamador, que não executa mais nenhum processo entretanto | [builtins](builtins.md#crypto-module) |
| A opção `rsa_sslv23_padding` de `crypto:public_encrypt/4` e das funções afins | Aceite quando o OTP é compilado com um OpenSSL que tem padding SSLv23 (1.1, 3.x) | `"Bad padding type in option rsa_padding"`, como o OTP compilado com OpenSSL 4 | [builtins](builtins.md#crypto-module) |
| `crypto:ec_curve/1` de uma curva que a libcrypto ligada não tem (um OpenSSL compilado sem curvas binárias) | Os parâmetros de `crypto_ec_curves` | `error:function_clause`, como para uma curva desconhecida: os parâmetros vêm das curvas incorporadas da libcrypto | [builtins](builtins.md#crypto-module) |
| Desencriptação de informação de depuração por `beam_lib` num programa que não chama `crypto` | `crypto` está sempre presente | `key_missing_or_invalid` a menos que o programa ligue `crypto` (`--with-crypto`), pois `beam_lib` chama-o dinamicamente | [biblioteca](library.md) |

## ASN.1

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Pilha em `{error, {asn1, {Reason, Stack}}}` | Frames das funções geradas `enc_*`/`dec_*` e de `asn1rtt_*` | Frames de `Module:encode/2` ou `decode/2` e do builtin do codec | [asn1](asn1.md#generated-modules) |
| Funções de um módulo gerado | Também exporta `enc_Type/1,2`, `dec_Type/1,2` e as restantes funções por tipo geradas por asn1ct | Apenas `encode/2`, `decode/2`, `info/0`, as funções de opções e as funções de valores | [asn1](asn1.md#generated-modules) |
| Um `CHOICE` cujo corpo começa com `...` (sem alternativas de raiz) | asn1ct comunica um erro de sintaxe | Aceite | [asn1](asn1.md#coverage) |
| Macros e funções de valores que nomeiam outro valor dentro de um tipo aberto (`mgf1SHA1`, `rSASSA-PSS-Default-Identifier` de PKCS-1) | asn1ct deixa `{'Externalvaluereference', Line, Module, Name}` no lugar do valor | O valor referenciado | [asn1](asn1.md#generated-modules) |
| Um erro de runtime (não de ASN.1) enquanto `public_key` descodifica ou codifica um valor de extensão | Lançado quando ocorre, sobretudo da classe `error`, a partir da função gerada `dec_ext-*`/`enc_ext-*` | `exit({error, {asn1, Reason}})`: o valor passa por `decode/2` ou `encode/2` do módulo gerado, que encapsula todas as falhas | [public_key](public_key.md#functions) |
| Os grupos Diffie-Hellman predefinidos de `public_key:dh_gex_group/4` | Os grupos gerados pelo OTP (`lib/public_key/priv/moduli`), 60–81 por tamanho | Oito por tamanho do ficheiro moduli do OpenSSH; os mesmos tamanhos (2047 a 8191) | [public_key](public_key.md#keys-and-signatures) |
| Frames de uma exceção de `public_key` | `public_key`, `pubkey_pem`, `pubkey_pbe`, `pubkey_cert_records`, `pubkey_cert`, `pubkey_ssh` | `public_key`, `clause_public_key_codec` e `clause_public_key_keys` | [public_key](public_key.md#functions) |

## Parse transforms

| Diferença | OTP | Clause | Responsável |
| --- | --- | --- | --- |
| Nome no atributo `file` de um ficheiro incluído (`--print-abstr`, entrada do transform) | O diretório de include unido ao nome, tal como encontrado (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | O caminho relativo ao diretório de trabalho quando o ficheiro está dentro dele, caso contrário o caminho absoluto | [transforms](transforms.md#interchange) |
| Anotações de linha 0 de formas importadas (código gerado, como o do transform de `qlc`) | Uma linha válida: o código não tem linha de origem | O código toma o lugar do nó importado antes dele | [transforms](transforms.md#importing-forms) |
| Anotações `generated` de formas importadas (entradas `.abstr`, saída do transform) | `erl_lint` e o compilador omitem alguns avisos para código gerado | Ignoradas: o código é verificado como código-fonte | [transforms](transforms.md#importing-forms) |
| Formas `{error, {Location, Module, Descriptor}}` em código importado | Formatadas com `Module:format_error/1` | O texto do termo do descritor; a formatação requer o OTP | [transforms](transforms.md#importing-forms) |
| Um módulo com erros de pré-processamento ou de análise sintática que nomeia um parse transform | O transform corre e recebe os erros como formas `{error, E}`; `erl_lint` comunica-os depois | Os erros são comunicados e o transform não corre | [transforms](transforms.md#clause-pipeline) |
| Opções de compilação que um transform recebe | A lista completa de opções do erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (o diretório de trabalho), `{i, _}`, `{d, ...}` e `{parse_transform, _}` | [transforms](transforms.md#otp-behavior) |
