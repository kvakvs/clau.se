---
source: docs/library.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: eb1d55d20683cef87e3553554a2b837e023b35acb9de58cdad1cb868ec95d0d8
translatedAt: 2026-10-26
---
# Módulos de biblioteca

O Clause inclui as suas próprias versões dos módulos do OTP que os programas
chamam, escritas em Erlang a partir do comportamento documentado do OTP (não
copiadas das fontes do OTP) sobre [builtins](builtins.md) do runtime, e
compila-as juntamente com os programas que as usam.

## Conteúdo

Cada módulo fornecido exporta a lista completa do OTP 29 para o seu nome; o seu
inventário `<module>.terms` ([ficheiros](#files)) regista que funções estão
implementadas e quais são stubs.

| Módulo | Conteúdo |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | As funções habituais; funções de dados como `sublist/2,3`, `flatten/1,2`, `sort/1`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2` são builtins do runtime; todas as funções documentadas estão implementadas ([módulo lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Todas as funções documentadas; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... são builtins do runtime, as funções que recebem funs são Erlang ([módulo maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Todas as funções documentadas; os percursos de listas são builtins do runtime, as funções que recebem funs são Erlang ([coleções](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Todas as funções documentadas; a aritmética gregoriana como builtins do runtime, a hora local e RFC 3339 em Erlang ([calendar](builtins.md#calendar)) |
| [`proc_lib`](../library/stdlib/proc_lib.erl), [`sys`](../library/stdlib/sys.erl) | Todas as funções documentadas: criação de processos com antecessores e chamadas iniciais, arranques síncronos (`init_ack`, `init_fail`), etiquetas, `stop/1,3`, relatórios de falhas e o seu texto; o protocolo de mensagens de sistema e opções de depuração (`trace`, `log`, `statistics`, `log_to_file`, funs instaladas) com as formas das listas de depuração do OTP |
| [`gen_server`](../library/stdlib/gen_server.erl), [`gen_statem`](../library/stdlib/gen_statem.erl), [`gen_event`](../library/stdlib/gen_event.erl), [`gen_fsm`](../library/stdlib/gen_fsm.erl), [`gen`](../library/stdlib/gen.erl) | Todas as funções documentadas em Erlang sobre `proc_lib` e `sys`, com as mensagens do OTP (`'$gen_call'` com etiquetas de alias, `'$gen_cast'`, ...), resultados e ações dos callbacks, coleções de identificadores de pedidos, termos de erro e textos de relatórios; `gen` contém o que partilham |
| [`supervisor`](../library/stdlib/supervisor.erl), [`supervisor_bridge`](../library/stdlib/supervisor_bridge.erl) | Todas as funções documentadas: especificações de processos filhos e erros do OTP, estratégias, intensidade de reinício, regras de encerramento, filhos `simple_one_for_one` e encerramento automático, como um `gen_server` |
| [`logger`](../library/kernel/logger.erl), [`logger_formatter`](../library/kernel/logger_formatter.erl), [`logger_std_h`](../library/kernel/logger_std_h.erl), [`logger_filters`](../library/kernel/logger_filters.erl), [`logger_handler`](../library/kernel/logger_handler.erl) | Todas as funções documentadas em Erlang: configuração primária, de handlers e de proxy com as verificações e termos de erro do OTP, níveis por módulo, metadados de processos, filtros, as macros `?LOG_*` de [`kernel/include/logger.hrl`](../library/kernel/include/logger.hrl), modelos de formatação e o cabeçalho antigo, `logger_std_h` em dispositivos e ficheiros com rotação, compressão e `filesync/1`, `logger_disk_log_h` em registos de disco halt e wrap (ambos sobre [`clause_logger_h`](../library/kernel/clause_logger_h.erl), opções e verificações comuns dos handlers do OTP). O servidor `logger` é o [`clause_logger`](../library/kernel/clause_logger.erl) do Clause, iniciado na primeira utilização com o handler predefinido do OTP em `standard_io` (a variável de ambiente `CLAUSE_LOGGER_TYPE=standard_error` passa-o para o erro padrão, como faz o executor de goldens para corresponder aos goldens feitos com o handler do OTP aí); os níveis por aplicação precisam de `application` |
| [`disk_log`](../library/kernel/disk_log.erl), [`wrap_log_reader`](../library/kernel/wrap_log_reader.erl), [`clause_disk_log`](../library/kernel/clause_disk_log.erl), [`clause_disk_log_server`](../library/kernel/clause_disk_log_server.erl) | Todas as funções documentadas em Erlang: registos halt, wrap e rotate, internos e externos, com os formatos de ficheiro do OTP (cabeçalhos de registo, estruturas de itens com MD5 de itens grandes, ficheiros de índice e tamanho wrap, arquivos rotate), pelo que os ficheiros são idênticos aos do OTP byte a byte; um processo por registo com proprietários, utilizadores, notificações, bloqueio com pedidos em fila, registo antecipado, uma cache de escrita despejada por tamanho e temporizador, reparação, blocos só de leitura que contam bytes inválidos; o servidor de registo `disk_log_server` com as tabelas nomeadas `disk_log_names` e `disk_log_pids`; `wrap_log_reader` sobre o mesmo leitor de blocos |
| [`error_logger`](../library/kernel/error_logger.erl), [`error_logger_file_h`](../library/stdlib/error_logger_file_h.erl), [`log_mf_h`](../library/stdlib/log_mf_h.erl) | Todas as funções documentadas: mensagens e relatórios como eventos de registo com os metadados `error_logger` do OTP, handlers de relatórios no gestor de eventos `error_logger` alimentado pelo handler de logger `error_logger`, `logfile/1` com o texto de relatório antigo, ficheiros wrap com o formato de índice e record do OTP |
| [`pg`](../library/kernel/pg.erl), [`data_publisher`](../library/kernel/data_publisher.erl) | Todas as funções documentadas: âmbitos como servidores `data_publisher` com as tabelas ETS do OTP, adesões, saídas, membros que terminam, monitores de âmbito e grupo; o âmbito não tem pares |
| [`global`](../library/kernel/global.erl), [`global_group`](../library/kernel/global_group.erl) | Todas as funções documentadas como num nó não distribuído: nomes (também `{global, Name}` nos behaviours), bloqueios e transações sobre um `global_name_server` iniciado na primeira utilização; `global_group` sem grupos; o locker e os mecanismos internos de distribuição são declinados |
| [`rpc`](../library/kernel/rpc.erl), [`erpc`](../library/kernel/erpc.erl) | Todas as funções documentadas: chamadas a este nó executadas em processos criados para o efeito (`rex` inicia-se na primeira utilização) com os resultados e erros do OTP; os outros nós estão indisponíveis (`{badrpc, nodedown}`, `{erpc, noconnection}`) |
| [`net_adm`](../library/kernel/net_adm.erl), [`net_kernel`](../library/kernel/net_kernel.erl), [`auth`](../library/kernel/auth.erl), [`seq_trace`](../library/kernel/seq_trace.erl) | As respostas do OTP para um nó que não está ativo (`pang`, `ignored`, `#{started => no}`, `nocookie`); `net_kernel:start/1,2` e os mecanismos internos da distribuição são declinados; `seq_trace` mantém o token de cada processo sem rastreio |
| [`trace`](../library/kernel/trace.erl), [`erl_tracer`](../library/erts/erl_tracer.erl) | O rastreio não é suportado: todas as funções de `trace` e o tracer predefinido de `erl_tracer` (`enabled/3`, `trace/5`) lançam `notsup`, como as funções de rastreio de erlang ([módulo erlang](builtins.md#erlang-module)); `erl_tracer:behaviour_info/1` lista os callbacks do OTP |
| [`error_handler`](../library/kernel/error_handler.erl) | As funções de chamadas indefinidas, que podem ser chamadas diretamente; o próprio runtime lança `undef` e nunca as chama; `breakpoint/3` declinado (sem interpretador) |
| [`timer`](../library/stdlib/timer.erl) | Todas as funções documentadas sem o servidor de temporizadores do OTP: envios temporizados para pids locais são `erlang:send_after/3`, cada outro temporizador é um processo próprio alcançado por um alias no seu `TRef`; as conversões e `now_diff/2` são builtins do runtime ([timer](builtins.md#timer)) |
| [`filelib`](../library/stdlib/filelib.erl), [`clause_filelib`](../library/stdlib/clause_filelib.erl) | Todas as funções documentadas: padrões glob compilados e comparados por builtins do runtime com as regras, peculiaridades e erros do OTP, o percurso de diretórios, consultas, `ensure_dir/1`, `ensure_path/1`, `fold_files/5,6`, `find_file/2,3`, `find_source/1,2,3` (`source_search_rules` do kernel ou os valores predefinidos do OTP) e `safe_relative_path/2` em Erlang; também as formas não documentadas que recebem um módulo (`file`, `erl_prim_loader` ou outro), `compile_wildcard/1` (auxiliar de depuração do OTP) como stub ([filelib](builtins.md#filelib)) |
| [`file_sorter`](../library/stdlib/file_sorter.erl) | Todas as funções documentadas em Erlang: sequências do OTP (`size` bytes ordenados em memória), fusões (`no_files` ficheiros temporários de cada vez, blocos de 16 KiB, fluxos ordenados pelos objetos em memória intermédia e números de ficheiro) e verificações seguidas passo a passo, pelo que os termos que comparam como iguais saem e sobrevivem a `unique` como no OTP; formatos `binary_term`, `binary`, `term` e fun, `header`, `compressed` (através da camada gzip de `file`), `tmpdir`, funs de entrada e saída, termos de erro do OTP |
| [`zip`](../library/stdlib/zip.erl) | Todas as funções documentadas em Erlang, seguindo a disposição dos arquivos do OTP byte a byte (cabeçalhos locais e centrais feitos por UNIX 6.1, campos extra de timestamp estendido e uid/gid UNIX, zip64 acima de 4 GiB, blocos deflate de 8 KiB com despejos completos sobre `zlib`), pelo que os arquivos são iguais aos do OTP; ficheiros ou binaries de entrada e saída através das funs de entrada e saída do OTP, filtros, `cwd`, `keep_old_files`, `skip_directories`, `foldl/3`, arquivos `zip_open/1,2` servidos por um processo ligado, `t/1`, `tt/1`, termos de erro do OTP; os records de [`stdlib/include/zip.hrl`](../library/stdlib/include/zip.hrl) |
| [`erl_tar`](../library/stdlib/erl_tar.erl) | Todas as funções documentadas em Erlang, seguindo as regras de formato do OTP byte a byte: cabeçalhos USTAR, nomes longos divididos num prefixo ou movidos para cabeçalhos estendidos pax (tal como nomes longos ou não ASCII, ligações e nomes de proprietários, e números demasiado largos para octal), leitura de arquivos v7, GNU (nomes e ligações longos, ficheiros esparsos), STAR, USTAR e pax com as peculiaridades do OTP (campos em base 256, tempos pax), `compressed` através da camada gzip de `file`, binaries lidos como ficheiros `ram`, dispositivos, funs de E/S do utilizador `init/3`, `max_size`, `keep_old_files`, `files`, `cwd`, `verbose`, verificações de caminhos inseguros, termos de erro do OTP e `format_error/1` |
| [`zstd`](../library/stdlib/zstd.erl), [`clause_zstd`](../library/stdlib/clause_zstd.erl) | Todas as funções documentadas: compressão e descompressão numa só operação e em fluxo, parâmetros, dicionários (em bruto ou por referência), cabeçalhos de frames e identificadores de dicionários, em Erlang sobre builtins do runtime que mantêm contextos libzstd 1.5.7 como o NIF do OTP ([zstd](builtins.md#zstd-module)); `file:open/2` aceita `{zstd, Options}` |
| [`beam_lib`](../library/stdlib/beam_lib.erl), [`erl_abstract_code`](../library/stdlib/erl_abstract_code.erl) | Todas as funções documentadas em Erlang, seguindo o tratamento de blocos do OTP: o percurso IFF com os erros do OTP, tabelas de átomos nas duas codificações, tabelas de símbolos, atributos, informação de compilação, literais, informação de depuração e código abstrato através do backend `erl_abstract_code`, documentação (records de [`kernel/include/eep48.hrl`](../library/kernel/include/eep48.hrl)), MD5 dos blocos significativos, comparação e remoção de informação de ficheiros, diretórios e releases, beams comprimidos com gzip, `build_module/1`, e o servidor de chaves criptográficas com desencriptação da informação de depuração (através de `crypto`, chamado dinamicamente: ligue-o com `--with-crypto`) |
| [`io_ansi`](../library/stdlib/io_ansi.erl) | Todas as funções documentadas em Erlang: sequências de terminal virtual do OTP 29 como as sequências ANSI integradas que o OTP usa sem terminfo (as consultas terminfo respondem `{error, enotsup}`), `format/1,2,3` e `render/1,2` sobre `io_lib`, `fwrite/1,2,3,4` como pedidos `put_ansi` apresentados pelo servidor de entrada padrão, `scan/1`, e `enabled/0,1` a partir do indicador de terminal do dispositivo ([módulo io](builtins.md#io-module)) |
| [`win32reg`](../library/stdlib/win32reg.erl) | Todas as funções documentadas: análise de chaves do OTP (raízes, caminhos absolutos, relativos e `..`), chave atual, valores inteiros, strings e binaries, listagens e eliminações sobre o driver do registo do Windows ([o registo](ports.md#the-registry)); `{error, enotsup}` noutros sistemas, como no OTP |
| [`argparse`](../library/stdlib/argparse.erl), [`clause_argparse`](../library/stdlib/clause_argparse.erl) | Todas as funções: validação com os erros do OTP, análise (opções, flags, `nargs`, ações, tipos com escolhas, limites e expressões regulares, tipos personalizados, subcomandos, prefixos, valores predefinidos) com os maps de argumentos e erros do OTP, `help/1,2` com a disposição e modelos do OTP, `run/3` com todas as formas de handler, como builtins do runtime que pedem ao Erlang para chamar as funs ([argparse](builtins.md#argparse)); sem `progname`, o nome do próprio programa |
| [`escript`](../library/stdlib/escript.erl) | `create/2` e `extract/2` seguindo a disposição de secções e leitura de cabeçalhos do OTP (linhas shebang, de comentário e de argumentos do emulador; corpos source, beam e archive através de `zip`); `script_name/0` é o caminho do executável; a execução de escripts (`start/0,1`, `parse_file/1`) é declinada |
| [`filename`](../library/stdlib/filename.erl) | Todas as funções documentadas segundo as regras Unix e Windows do OTP para o anfitrião; os percursos de nomes são builtins do runtime, `absname/1,2` e `basedir/2,3` (a partir de `HOME`, das variáveis XDG e de `APPDATA`) são Erlang ([filename](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Todas as funções documentadas como builtins do runtime: análise de RFC 3986 com os fragmentos de erro do OTP, recomposição, normalização, resolução, codificação percentual e consultas form-urlencoded ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Todas as funções documentadas com os iodata, erros e ordem de callbacks do OTP; `decode/1`, `encode/1`, `format/1,2` e as funções de escape de binaries são builtins do runtime, os codificadores e formatadores que recebem funs e os descodificadores com callbacks são Erlang ([codificações](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Todas as funções documentadas com os estados e sequências do OTP; os algoritmos do OTP correm como builtins do runtime, os geradores plug-in em Erlang ([números aleatórios](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Todas as funções documentadas como builtins do runtime, percorrendo chardata como `string.erl` do OTP para manter as formas dos resultados do OTP ([string](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Todas as funções documentadas como builtins do runtime ([codificações](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Todas as funções documentadas sobre o record do OTP 29; as operações sobre o record são builtins do runtime, os folds e mapfolds são Erlang ([coleções](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Todas as funções documentadas sobre as formas de árvores e filas do OTP; as operações sem funs são builtins do runtime ([coleções](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Todas as funções documentadas sobre os records do OTP (conjuntos da versão 1) e maps (versão 2); as operações sem funs são builtins do runtime ([coleções](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (servidor da entrada padrão ou um ficheiro aberto), `fread/2,3` (um pedido `get_until` sobre `io_lib:fread/3`), `read/1..4`, `scan_erl_exprs/1..4`, `scan_erl_form/1..4`, `parse_erl_exprs/1..4`, `parse_erl_form/1..4` (pedidos `get_until` sobre `erl_scan:tokens/3,4`, analisados por `erl_parse`), `request/1,2`, `requests/1,2` (o protocolo de E/S do OTP, [ficheiros](ports.md#standard-io-and-files)), `getopts/0,1`, `setopts/1,2`, `columns/0,1`, `rows/0,1` (tamanho do terminal sobre builtins de `clause_io`), `get_password/0,1`, `write/1,2`; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` e `nl/0,1` são builtins do runtime ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Escritores, verificações, funções de recolha, o motor de formatação, o formatador de apresentação (`print/1,4`, `~p`, `chars_limit`) e o scanner (`fread/2,3`) como builtins do runtime nas formas de listas profundas do OTP, funs `maps_order` que ordenam chaves em `clause_io_lib`; `get_until`, `format_prompt` e `write/3` em Erlang ([io_lib](builtins.md#io_lib)) |
| [`sofs`](../library/stdlib/sofs.erl), [`clause_sofs`](../library/stdlib/clause_sofs.erl) | Todas as funções; as operações de dados são builtins do runtime, as funções que recebem funs e as conversões de dígrafos são Erlang ([conjuntos de conjuntos](builtins.md#sets-of-sets)) |
| [`ets`](../library/stdlib/ets.erl) | Tabelas, leituras, escritas, percursos e atualizações como builtins do runtime sobre as suas tabelas; `foldl/3`, `foldr/3`, `i/0..3` e `fun2ms/1` em Erlang; especificações de correspondência (famílias select, match, match_spec) como builtins sobre o interpretador do runtime, `match_spec_run/2`, `test_ms/2`, `repair_continuation/2`, `match_delete/2` e `init_table/2` em Erlang; ficheiros de tabelas (`tab2file/2,3`, `file2tab/1,2`, `tabfile_info/1`) em Erlang sobre `file` e `clause_disk_log`; `to_dets/2` e `from_dets/2` em Erlang sobre `dets`; `table/1,2` em Erlang sobre `qlc:table/2` ([ets](builtins.md#ets)) |
| [`graph`](../library/stdlib/graph.erl) | Todas as funções sobre o record do OTP; as consultas e percursos são builtins do runtime, as atualizações são Erlang ([graph](builtins.md#graph)) |
| [`digraph`](../library/stdlib/digraph.erl), [`digraph_utils`](../library/stdlib/digraph_utils.erl) | Todas as funções sobre o record de três tabelas do OTP; as atualizações e leituras são Erlang sobre `ets`, as pesquisas de caminhos e os percursos de digraph_utils são builtins do runtime que leem as tabelas, `subgraph/2,3` e `condensation/1` em Erlang ([digraph](builtins.md#digraph)) |
| [`dets`](../library/stdlib/dets.erl), [`clause_dets`](../library/stdlib/clause_dets.erl) | Todas as funções documentadas: processos de servidor e de tabela do OTP em Erlang sobre um motor C++ do formato de ficheiro versão 9 do OTP, ficheiros idênticos byte a byte aos escritos pelo OTP; `table/1,2` em Erlang sobre `qlc:table/2` ([dets](builtins.md#dets)) |
| [`ms_transform`](../library/stdlib/ms_transform.erl) | Todas as funções em Erlang sobre o formato abstrato: `parse_transform/2` traduz funs literais passadas a `ets:fun2ms/1` e `dbg:fun2ms/1` nas formas de um módulo, `transform_from_shell/3` as cláusulas de uma fun da shell, com as especificações de correspondência, avisos de ocultação e códigos de erro do OTP. Um módulo que usa a transformação em tempo de compilação continua a executar o `ms_transform` do OTP do anfitrião ([parse transforms](transforms.md)) |
| [`qlc_pt`](../library/stdlib/qlc_pt.erl), [`clause_qlc_pt`](../library/stdlib/clause_qlc_pt.erl) | A parse transform qlc em tempo de execução (não documentada no OTP): `transform_expression/2`, `transform_from_evaluator/2` e `parse_transform/2` como builtins do runtime com o código de consulta gerado, mensagens e anotações do OTP; `ms_transform` executa-se em Erlang a pedido ([qlc_pt](builtins.md#qlc-pt)). Os módulos compilados que incluem `qlc.hrl` continuam a usar a transformação do OTP do anfitrião ([parse transforms](transforms.md)) |
| [`qlc`](../library/stdlib/qlc.erl) | Todas as funções em Erlang, escritas a partir da documentação do OTP: identificadores de consultas compiladas (identificadores `qlc_lc` do OTP provenientes da transformação), listas, tabelas `table/2`, `append/1,2`, `sort/1,2` e `keysort/2,3`; avaliação com pesquisas de constantes, especificações de correspondência, junções por fusão e pesquisa, `cache` (`ets`, `list` com transferência para ficheiros temporários), `unique`, ordenações de `file_sorter`, cursores como processos, `info/1,2` sobre `erl_pp`, `string_to_handle/1,2,3` sobre `qlc_pt`, termos de erro do OTP e `format_error/1`. Os identificadores, tabelas, chaves do dicionário de processos e nomes de ficheiros temporários são os do OTP. [`stdlib/include/qlc.hrl`](../library/stdlib/include/qlc.hrl) nomeia a transformação `qlc`, que se executa no OTP do anfitrião ([qlc](builtins.md#qlc)) |
| [`shell`](../library/stdlib/shell.erl), [`clause_shell`](../library/stdlib/clause_shell.erl), [`clause_shell_eval`](../library/stdlib/clause_shell_eval.erl), [`clause_shell_commands`](../library/stdlib/clause_shell_commands.erl), [`clause_shell_records`](../library/stdlib/clause_shell_records.erl) | Todas as funções documentadas em Erlang, escritas a partir da documentação do OTP: a shell interativa na entrada padrão ([shell interativa](#interactive-shell)): prompts, mensagem inicial, histórico (`e/1`, `v/1`, `h/0`), associações, records (`rd`, `rr`, `rl`, `rp`, `rf`), funções, tipos e specs definidos no prompt, relatórios de exceções sobre `erl_error`, resultados apresentados como no OTP (profundidade 30, records), shells restritas, `catch_exception/1` e as funções de configuração |
| [`shell_default`](../library/stdlib/shell_default.erl), [`c`](../library/stdlib/c.erl) | Todas as funções: comandos de `c` com a saída do OTP (`i/0`, `regs/0`, `m/0,1`, `ls/0,1`, `flush/0`, `help/0`, ...); a compilação (`c/1,2,3`, `lc/1`, `nc/1,2`), `xm/1` e `y/1,2` reportam a chamada falhada como o OTP sem compiler, tools ou parsetools; `h/1,2,3` não encontram documentação no código ligado; os comandos `i` do depurador reportam a aplicação em falta |
| [`edlin`](../library/stdlib/edlin.erl), [`edlin_expand`](../library/stdlib/edlin_expand.erl) | `edlin:keymap/0` (o mapa de teclas do editor de linha chamador; `undefined` fora de um); `edlin_expand:expand/1,2` em Erlang: completamento de módulos, funções (aridades `Mod:`, `fun Mod:Fun/`), BIFs, comandos da shell, funções definidas na shell, palavras-chave, associações, nomes e campos de records, chaves de maps e caminhos de ficheiros, com as secções e correspondências antigas do OTP; os argumentos de uma chamada são sugeridos como cabeçalhos `Mod:Fun/Arity` (o código ligado não tem especificações) |
| [`shell_docs`](../library/stdlib/shell_docs.erl), [`clause_shell_docs_markdown`](../library/stdlib/clause_shell_docs_markdown.erl) | Todas as funções em Erlang, escritas a partir da documentação do OTP: `render/2..5`, `render_type/2..5` e `render_callback/2..5` de um dado bloco `docs_v1` (`application/erlang+html`, `text/markdown` convertido como a shell do OTP o converte, outros formatos `text/` tal como estão) com a disposição, quebra de linhas, marcadores e estilos ANSI do OTP, `normalize/1`, `validate/1`, `supported_tags/0`; idêntico ao OTP nas 51,249 apresentações dos blocos de documentação do próprio OTP 29. O código ligado não tem blocos próprios (`code:get_doc/1`) |
| [`erl_parse`](../library/stdlib/erl_parse.erl), [`clause_erl_parse`](../library/stdlib/clause_erl_parse.erl) | Todas as funções: `parse_form/1`, `parse_exprs/1`, `parse_term/1` e `parse/1`, `parse_and_scan/1` do yecc sobre um analisador do runtime com o formato abstrato e erros do OTP; `normalise/1`, `abstract/1,2`, `tokens/1,2` e as tabelas de precedência como builtins; os percursos de anotações e `format_error/1` em Erlang ([erl_parse](builtins.md#erl-parse)) |
| [`erl_eval`](../library/stdlib/erl_eval.erl), [`clause_erl_eval`](../library/stdlib/clause_erl_eval.erl) | Todas as funções em Erlang sobre o formato abstrato: associações como orddicts ou maps, handlers de funções locais e não locais (os operadores, BIFs e erros como chamadas `erlang:raise/3` passam pelo segundo), funs interpretadas com o ambiente do OTP, comprehensions com geradores estritos e zip, `maybe`, native records, `receive` sobre `prim_eval`; correspondência de padrões, segmentos de sintaxe de bits e avaliação de constantes são builtins do runtime ([erl_eval](builtins.md#erl-eval)). `exprs/2` e `expr/2` verificam um comando com `erl_lint:exprs_opt/3`; `qlc:q/1,2` de uma list comprehension de consulta passa por `qlc:transform_from_evaluator/2` com as chamadas locais ocultas, como no OTP |
| [`erl_error`](../library/stdlib/erl_error.erl) | Todas as funções em Erlang sobre `io_lib`: `format_exception/3,4` e os formatadores internos (`format_exception/6,7,8`, `format_stacktrace/4,5`, `format_call/4,5`, `format_fun/1,2`) com as explicações, disposições, callbacks `error_info` e opções do OTP. Os stack traces do próprio Clause não têm localizações nem `error_info` ([diferenças](differences.md#errors-stack-traces-and-reports)), pelo que os seus relatórios não mostram nenhum dos dois |
| [`erl_pp`](../library/stdlib/erl_pp.erl), [`clause_erl_pp`](../library/stdlib/clause_erl_pp.erl) | Todas as funções; a apresentação é um builtin do runtime ([erl_pp](builtins.md#erl-pp)): formas, atributos, tipos e specs, funções, guards e expressões com a disposição (largura de linha, indentação, fragmentos de strings, parênteses de precedência) e opções do OTP; os hooks e `legalize_vars/1` executam-se aqui; idêntico ao OTP nas formas de 347 ficheiros-fonte e suites do OTP, e em 80 deles com cinco conjuntos de opções, incluindo hooks |
| [`erl_lint`](../library/stdlib/erl_lint.erl), [`clause_erl_lint`](../library/stdlib/clause_erl_lint.erl) | Todas as funções; as verificações são builtins do runtime ([erl_lint](builtins.md#erl-lint)) com os erros, avisos, opções e ordem do OTP, e os textos de `format_error/1`; o `behaviour_info/1` dos behaviours é chamado aqui, e `is_guard_test/3` consulta primeiro a sua fun sobre as chamadas locais; idêntico ao OTP em 481 ficheiros-fonte e suites do OTP, 474 fragmentos de suites e 816 expressões de comandos |
| [`erl_expand_records`](../library/stdlib/erl_expand_records.erl) | `module/2` como builtin do runtime ([erl_expand_records](builtins.md#erl-expand-records)): records de tuplos expandidos para operações de tuplos, native records e native records importados mantidos, chamadas de imports e BIFs com o respetivo módulo, testes guard `is_record/3` transformados em padrões, com as opções `dialyzer`, `expand_inits` e `[no_]strict_record_tests`; idêntico ao OTP nas formas de 347 ficheiros-fonte e suites de testes do OTP |
| [`epp`](../library/stdlib/epp.erl), [`clause_epp`](../library/stdlib/clause_epp.erl) | Todas as funções em Erlang exceto as condições `-if`, avaliadas por um builtin ([epp](builtins.md#epp)): um servidor por ficheiro-fonte aberto com as formas, macros (argumentos, sobrecarga, `??Arg`, `?FUNCTION_NAME`, predefinidas e da opção `macros`), inclusões, condicionais, `-file`, `-feature`, `-error`/`-warning`, ficheiros de documentação e erros do OTP; os ficheiros são lidos por inteiro e descodificados pelo seu comentário de codificação. Idêntico ao OTP em 1,110 chamadas `parse_file`/`scan_file` em ficheiros-fonte e suites do OTP. `-include_lib` encontra cabeçalhos apenas pelo caminho de inclusão até `code:lib_dir/1` |
| [`erl_scan`](../library/stdlib/erl_scan.erl) | Todas as funções: `string/1,2,3` e `tokens/3,4` reentrante sobre um scanner do runtime com os tokens, anotações, opções, callbacks e erros do OTP; funções de acesso e `format_error/1` em Erlang ([erl_scan](builtins.md#erl-scan)) |
| [`erl_internal`](../library/stdlib/erl_internal.erl), [`erl_anno`](../library/stdlib/erl_anno.erl) | Todas as funções como builtins do runtime: tabelas de BIFs, guards, testes de tipos e operadores, funções predefinidas e anotações do OTP ([tabelas do compilador](builtins.md#compiler-tables)) |
| [`records`](../library/stdlib/records.erl), [`erl_features`](../library/stdlib/erl_features.erl) | Reflexão de native records, definições em tempo de execução e definições compiladas com valores predefinidos avaliados ([native records](native-records.md#reflection)); funcionalidades do OTP 29 e aquelas com que cada módulo foi compilado ([tabelas do compilador](builtins.md#compiler-tables)) |
| [`binary`](../library/stdlib/binary.erl) | Todas as funções; `replace/3,4` e `list_to_bin/1` em Erlang, as outras builtins do runtime ([módulo binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Todas as funções como builtins do runtime ([módulo math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Todas as funções como builtins do runtime: conversões, `bin_is_7bit/1`, marcas de ordem de bytes, formas de normalização, categorias e propriedades de identificadores ([módulo unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Todas as funções sobre tabelas geradas, os percursos de chardata como builtins do runtime ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Todas as funções exceto `import/1`, sobre o PCRE2 ([módulo re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Todas as funções documentadas: abrir, ler, escrever, posicionar e fechar ficheiros (em disco, `compressed`, ou em memória com `ram`), leituras e escritas posicionadas, `truncate/1`, `advise/4`, `allocate/3`, leituras e escritas de ficheiros inteiros, `consult/1`, `eval/1,2`, `script/1,2` e as suas formas `path_` com `path_open/3` (o ficheiro lido por inteiro e descodificado pelo seu comentário de codificação, UTF-8 por omissão, como faz `epp:set_encoding/1` em [`clause_epp`](../library/stdlib/clause_epp.erl), depois analisado forma a forma com os resultados e erros do OTP), informação de ficheiros e as suas alterações (`write_file_info/2,3`, `change_*`), operações de diretórios sobre o driver de ficheiros, `sendfile/2,5` como alternativa por blocos do OTP e `format_error/1` ([ficheiros](ports.md#standard-io-and-files)) |
| [`erl_posix_msg`](../library/stdlib/erl_posix_msg.erl) | Módulo interno do OTP para `file:format_error/1`: `message/1` como builtin do runtime ([mensagens POSIX](builtins.md#posix-messages)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl), [`clause_socket`](../library/kernel/clause_socket.erl), [`clause_socket_options`](../library/kernel/clause_socket_options.erl) | Sockets sobre portas de socket, com as suas opções, estatísticas, estado e listagens ([sockets](ports.md#sockets)); `inet:get_rc/0` de `clause_inet_config` |
| [`socket`](../library/kernel/socket.erl) | Todas as funções documentadas em Erlang sobre as portas do driver de sockets ([sockets](ports.md#sockets)): identificadores `{'$socket', Ref}` mantidos por um processo e tabela `clause_socket_registry` (proprietários, estados, contadores, meta, monitores, listagens), open/bind/listen/accept/connect, send/sendto/sendmsg/sendv/sendfile/sendmmsg, recv/recvfrom/recvmsg/recvmmsg com os erros de dados parciais do OTP, `nowait` como mensagens de conclusão no Windows e mensagens select noutros sistemas, `cancel/2`, nomes de opções e erros de valores inválidos do OTP, `info/0,1`, `i/0,1,2`, `supports/0,1,2`; chamadas SCTP lançam `notsup` e os pedidos de interfaces são recusados, como no OTP no Windows |
| [`gen_sctp`](../library/kernel/gen_sctp.erl) | Todas as funções documentadas: sem SCTP, pelo que `open/0,1,2` respondem `{error, eprotonosupport}` após as verificações de opções do OTP e as restantes veem um socket fechado ou alheio; `error_string/1` tem os textos do OTP |
| [`inet_res`](../library/kernel/inet_res.erl), [`clause_inet_config`](../library/kernel/clause_inet_config.erl) | Todas as funções documentadas em Erlang: cliente DNS do OTP sobre `gen_udp` e `gen_tcp` (repetições, servidores de nomes alternativos, EDNS, truncagem sobre TCP, esperas servfail, erros do OTP, listas de pesquisa, cadeias CNAME e hostents) com mensagens codificadas e descodificadas pelo codec DNS de `clause_net` ([nomes de rede](builtins.md#network-names)); a configuração do resolvedor como o OTP a carrega num nó não distribuído (nenhuma no Windows; `resolv.conf` e o ficheiro hosts noutros sistemas) |
| [`net`](../library/kernel/net.erl), [`clause_net`](../library/kernel/clause_net.erl) | Todas as funções documentadas: pesquisas de anfitriões, endereços e serviços e listas de interfaces como builtins do runtime com os resultados de prim_net, os filtros em Erlang; sem espaços de nomes de rede ([nomes de rede](builtins.md#network-names)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Próprio do Clause: o protocolo do driver de sockets partilhado pelos três módulos acima |
| [`os`](../library/kernel/os.erl) | `cmd/1,2` sobre uma porta com o protocolo de shell, `max_size` e `exception_on_failure` do OTP; consultas de ambiente, tempo e versão, `find_executable/1,2` e `set_signal/2` como builtins ([módulo os](builtins.md#os-module)) |
| [`code`](../library/kernel/code.erl) | Consultas de módulos carregados sem code server; o caminho de código num termo persistente com as alterações de caminhos do OTP, pesquisas `lib_dir`/`priv_dir`, `where_is_file/1`, `all_available/0`, `clash/0`; respostas de carregamento para código ligado ([módulo code](builtins.md#code-module)) |
| [`application`](../library/kernel/application.erl), [`application_controller`](../library/kernel/application_controller.erl) | Todas as funções documentadas: carregamento, chaves, ambientes, arranques com dependências e fases de arranque, paragens, permissões e tipos de reinício com os erros e relatórios do OTP, sobre um controlador iniciado na primeira utilização e [`clause_application_master`](../library/kernel/clause_application_master.erl) ([aplicações](#applications)); gestão de releases, arranque do sistema e controlo distribuído declinados |
| [`erlang`](../library/erts/erlang.erl) | Stubs gerados de todos os exports de `erlang` do OTP 29; os builtins do catálogo têm corpos de marcador de posição, `nif_error/1,2` têm corpo, os restantes lançam `{not_implemented, F, A}` quando chamados ([módulo erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | As respostas de um sistema arrancado; `boot/1`, `restart/0,1` e `make_permanent/2` recusados ([módulo init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Todas as funções como builtins do runtime ([termos persistentes](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Todas as funções ([atomics e counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | O que `stdlib` e `kernel` chamam; os grupos de distribuição, `.beam`, emulador e processo de purga declinados ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Consultas de ficheiros sobre `file`; carregamento e arquivos declinados ([ficheiros](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Todas as funções sobre o zlib fixado ([módulo zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` sobre os passos de um receive compilado ([prim eval](builtins.md#prim-eval)) |
| Módulos ASN.1 de `public_key` (`'OTP-PKIX'`, `'PKIX1Explicit-2009'`, ...) e [`public_key.hrl`](../library/public_key/include/public_key.hrl) | Gerados em tempo de compilação a partir de [`library/public_key/asn1/`](../library/public_key/asn1) para `library-asn1/public_key/` da árvore de compilação ([public_key](public_key.md)) |
| [`public_key`](../library/public_key/public_key.erl), [`clause_public_key_codec`](../library/public_key/clause_public_key_codec.erl), [`clause_public_key_keys`](../library/public_key/clause_public_key_keys.erl), [`clause_public_key`](../library/public_key/clause_public_key.erl) | Aplicação `public_key` (com [`public_key.app`](../library/public_key/public_key.app)): codificação DER e PEM, encriptação PEM, chaves privadas PKCS #8 de todos os tipos e certificados nas formas plain e otp sobre os módulos gerados ([public_key](public_key.md#functions), [chave pública](builtins.md#public-key)); chaves, assinaturas, encriptação RSA, geração e acordo de chaves, assinatura de certificados sobre `crypto` (`clause_public_key_keys`, [chaves](public_key.md#keys-and-signatures)); as funções de validação são stubs |
| [`clause_asn1`](../library/asn1/clause_asn1.erl) | O codec que os módulos gerados pelo clau a partir de especificações ASN.1 chamam ([codec ASN.1](builtins.md#asn1-codec), [ASN.1](asn1.md)); a aplicação `asn1` do OTP (`asn1ct`, `asn1rt_nif`) não é fornecida |
| [`crypto`](../library/crypto/crypto.erl), [`clause_crypto`](../library/crypto/clause_crypto.erl) | Aplicação `crypto` (com [`crypto.app`](../library/crypto/crypto.app)), sobre libcrypto do OpenSSL no arquivo do runtime de criptografia ([módulo crypto](builtins.md#crypto-module), [OpenSSL](crypto.md)): listas de algoritmos do OpenSSL ligado (`supports/0,1`, `hash_info/1`, `info/0`, `info_lib/0`), resumos e estados de hash, HMAC/CMAC/Poly1305 e estados de MAC, `pbkdf2_hmac/5`, `hash_equals/2`, `exor/2`, `mod_pow/3`, cifras e os seus estados (`crypto_init/3,4`, `crypto_update/2`, `crypto_final/1`, `crypto_get_data/1`, `crypto_one_time/4,5`, `cipher_info/1`), AEAD (`crypto_one_time_aead/4,6,7`, `crypto_one_time_aead_init/4`), números aleatórios fortes e os plugins `crypto`, `crypto_cache`, `crypto_aes` e `crypto_prng1` de `rand`, termos de erro do OTP; motores recusados (`notsup`); modo FIPS alterável como no OTP, ou fixado com `clau --fips`; chaves públicas (`sign/4,5`, `verify/5,6`, encriptação RSA, `generate_key/2,3`, `compute_key/4`, `privkey_to_pubkey/2`: RSA, DSA, DH, ECDSA/ECDH em curvas nomeadas e explícitas, EdDSA, X25519/X448, ML-DSA, SLH-DSA, SRP), `ec_curve/1` e `ec_curves/0` (parâmetros explícitos da libcrypto ligada), ML-KEM (`encapsulate_key/2`, `decapsulate_key/3`) |

Os resultados e as razões de erro coincidem com o OTP 29, incluindo as formas de
erro das implementações em Erlang do OTP (`lists:map(F, x)` dá
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)`
`badarg`) e dos seus BIFs (`lists:member/2`, `lists:keyfind/3`,
`lists:reverse/2`, as funções de `maps`: `badarg`, `{badmap, M}`,
`{badkey, K}`). `lists:member/2` compara com `=:=`, `lists:keyfind/3` com `==`.
`lists:sort/1` é um builtin estável do runtime
([comparação e ordem](terms.md#comparison-and-order)). Os stack traces indicam as funções da biblioteca, não as do OTP.

## Shell interativa

`shell:start_interactive/0,1` inicia a shell Erlang nos fluxos padrão, e
`clau --shell` liga-a num executável de que é o ponto de entrada, salvo se
`--entry` nomear outro ([compilação](compile.md#options)). O processo
`clause_shell` ocupa o lugar do `user_drv` do OTP: apresenta a versão do
sistema, inicia o servidor de `shell` e inicia um novo quando uma shell termina
(`exit().`). O servidor lê cada comando através do servidor de entrada padrão
de `io`, repetindo o prompt em cada linha adicional de um comando, mantém o
histórico e inicia o avaliador, que verifica cada expressão com `erl_lint`,
expande records e avalia-a com `erl_eval`. Os resultados são apresentados com os
records da shell pelo formatador de apresentação do runtime
(`clause_io_lib:pretty/2`, [io_lib](builtins.md#io-lib)). O fim da entrada termina
o programa com estado 0 após `*** Terminating erlang (nonode@nohost)`.

Os comandos chamam módulos pelo nome, pelo que um programa que inicia a shell
precisa de poder chamar todos os exports: `--shell` mantém-nos
([exports em uso](executables.md#export-liveness)) e liga todos os módulos da
biblioteca; um programa compilado sem essa opção alcança apenas os módulos que
nomeia. As linhas de entrada são lidas tal como o terminal as entrega, editadas
pelo próprio terminal: não há edição de linha `edlin`, teclas de histórico nem
completamento com Tab ([diferenças](differences.md#interactive-shell)).

## Como os programas os obtêm

- Quando um lote (entradas posicionais ou um alvo de projeto) nomeia um módulo
  com um átomo literal — `M:F(...)` com `M` literal, `fun M:F/A`,
  `apply(M, F, Args)` com `M` literal, `-behaviour(M)` ou `-import(M, ...)` —
  que nenhuma entrada define, o compilador procura `M.erl` nos diretórios de
  aplicações da biblioteca e depois nos `source_search_paths` do projeto
  ([projetos](projects.md#paths-and-discovery)), analisa e compila no lote o
  primeiro que encontrar, repetindo depois para os módulos que os ficheiros
  acrescentados nomeiam
  ([a que módulo um nome é resolvido](#which-module-a-name-resolves-to)). Uma
  chamada `M:F(...)` de um builtin do catálogo (`io:format/2`, `os:type/0`) não
  nomeia nenhum módulo. `--print-inputs` lista as entradas que isto acrescenta.
- A biblioteca é `library/` da árvore de compilação, encontrada em relação a
  `clau` tal como o arquivo do runtime, com um diretório por aplicação OTP
  (`erts`, `kernel`, `stdlib`), depois `library-asn1/` da árvore de compilação,
  os módulos que a compilação gera a partir das especificações ASN.1 da
  biblioteca ([public_key](public_key.md)).
  `-include_lib("kernel/include/logger.hrl")`, `file.hrl`, `eep48.hrl` e
  `inet.hrl` (`#hostent{}`) resolvem-se para os cabeçalhos da própria biblioteca,
  salvo se o projeto nomear uma aplicação `kernel`; `stdlib/include/`
  `zip.hrl`, `qlc.hrl`, `ms_transform.hrl` (nomeia a transformação, que se executa
  no OTP do anfitrião: [transformações](transforms.md)) e `assert.hrl`, salvo se
  nomear uma aplicação `stdlib`. `assert.hrl` tem as macros, termos de erro e
  opções `NOASSERT`, `NODEBUG`, `ASSERT` do OTP. Os cabeçalhos internos do OTP
  (`erl_bits.hrl`, `erl_compile.hrl`) e de distribuição (`dist.hrl`,
  `dist_util.hrl`, `net_address.hrl`) não são fornecidos, nem `inet_sctp.hrl`
  (sem SCTP).
- Um módulo do lote com o mesmo nome substitui o módulo da biblioteca, com um
  aviso; os builtins do catálogo com esse nome continuam a prevalecer
  ([registo](builtins.md#registration)).
- Os módulos de biblioteca são módulos de lote comuns: são ligados aos
  executáveis e, para saída em objeto ou IR, produzem os seus próprios
  artefactos. São código Erlang, pelo que cedem a execução (yield) como qualquer
  outro código.
- Um módulo alcançado apenas através de nomes em tempo de execução (`M:F(...)`
  com `M` uma variável) não é acrescentado: essa chamada lança `undef`, a menos
  que outra coisa nomeie o módulo.

## Substituições de módulos do runtime

O Clause substitui os módulos do OTP que o ERTS implementa em C (NIFs, BIFs,
drivers de portas, os módulos pré-carregados de `erts/preloaded/src`) e os
módulos que o OTP gera durante a sua compilação (`unicode_util`). O `kernel` e o
`stdlib` do OTP são Erlang simples, mas chamam esses módulos.

### Fornecido ou em falta

Tudo o que precisa do runtime e não pode ser escrito em Erlang simples é
decidido por módulo, e por grupo de funções quando um módulo mistura
responsabilidades:

- **Fornecido:** o Clause inclui o módulo com a lista de exports exata do
  OTP 29. Cada função tem um de quatro estados: `implemented` (um builtin do
  runtime ou um corpo Erlang sobre serviços do runtime existentes), `refused`
  (devolve ou lança o que os chamadores do OTP já tratam quando uma
  funcionalidade está ausente, como `{error, enotsup}`), `stub` (lança
  `error({not_implemented, F, A})` com `M:F/A` no topo da pilha, como fazem os
  [stubs de `erlang`](builtins.md#erlang-module); ainda não feito) ou
  `declined` (um stub que fica, com uma razão como a distribuição ou o
  carregamento de código). Um módulo novo começa com todas as funções como
  stubs, para que seja detetável e os seus chamadores compilem; os grupos passam
  depois ao estado decidido.
- **Marcadores de posição de builtins:** uma função implementada por um builtin
  do catálogo mantém o seu export e o corpo
  `F(_, ...) -> clause_builtin_placeholder.`, que nunca é executado: o registo
  associa o builtin no seu lugar, e uma chamada qualificada `M:F(...)` compila
  para a ponte. Só uma chamada não qualificada dentro do módulo chegaria ao
  marcador de posição, pelo que o módulo chama os seus próprios builtins de
  forma qualificada; `library_inventory` rejeita um marcador de posição que não
  nomeie nenhum builtin do catálogo, um builtin do catálogo que permaneça como
  stub `not_implemented` e uma chamada não qualificada de um marcador de posição.
- **Em falta:** o Clause não inclui módulo nenhum, possivelmente para sempre, e
  regista porquê e que módulos do Clause de nível mais alto tomam o lugar dos
  seus chamadores (`library/modules.terms`). As camadas de ficheiros e de
  sockets `prim_*` de baixo nível (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) e `socket` são os módulos
  em falta: os programas usam antes `file`, `gen_tcp`, `gen_udp`, `inet` e `net` do
  Clause e, como os módulos do Clause prevalecem sobre os do OTP (ver abaixo),
  os chamadores do OTP de um módulo em falta (`gen_tcp_socket`, `inet_tcp`, ...
  do OTP) nunca entram num lote. Um módulo em falta nunca recebe um stub, pelo
  que uma referência a ele é um erro em tempo de compilação, nunca uma surpresa
  em tempo de execução.

As funções triviais para o runtime são implementadas sem uma decisão separada.

### A que módulo um nome é resolvido

O OTP é opcional na máquina do utilizador; quando presente, não pode alterar o
que uma compilação compila. Um nome de módulo é resolvido por esta ordem:

1. **Entradas explícitas:** os códigos-fonte que o utilizador lista (`sources`,
   `source_dirs`, entradas posicionais). Uma que tenha o nome de um módulo do
   Clause substitui-o, com um aviso que indica ambos os ficheiros.
2. **Módulos do Clause:** os módulos da biblioteca, incluindo as substituições
   fornecidas.
3. **`source_search_paths`**, tal como descrito em
   [projetos](projects.md#paths-and-discovery).

O nome de um módulo em falta está reservado: um ficheiro com o mesmo nome num
caminho de pesquisa (por exemplo `erts/preloaded/src/prim_file.erl` do OTP) não
é usado, e o diagnóstico indica que o Clause não fornece o módulo. Uma entrada
explícita pode ainda fornecê-lo, com o aviso de substituição.

`ignore_modules` aplica-se também aos módulos do Clause: um módulo do Clause
ignorado fica em falta no lote, e uma entrada explícita pode então fornecê-lo
sem aviso, uma vez que nada é substituído.

### Ficheiros

- Os módulos de biblioteca ficam em `library/<application>/`, com o nome da
  aplicação OTP a que o módulo pertence no OTP: `erts` (os equivalentes
  pré-carregados e `erlang`), `kernel`, `stdlib`. Os módulos auxiliares privados
  do Clause (`clause_socket`, `clause_re`, `clause_unicode`, `clause_zlib`,
  `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`,
  `clause_features`, `clause_io_lib`, `clause_disk_log`, `clause_dets`) ficam ao
  lado dos módulos que servem. A
  consulta da biblioteca procura em todos os diretórios de aplicações; um nome
  de módulo existe no máximo num deles.
- `library/modules.terms` lista todos os módulos sobre os quais o Clause decide:
  `{Module, Application, provided}.` ou
  `{Module, Application, missing, "reason"}.` O compilador lê-o para saber que
  nomes são módulos do Clause e quais estão reservados.
- Cada módulo fornecido tem um inventário `<module>.terms` ao seu lado:
  `{Name, Arity, Group, Status}.` por export do OTP 29, ordenado por nome e
  aridade, em que `Group` indica o grupo de decisão (por exemplo `stdlib`,
  `distribution`, `beam`). `erlang.terms` mantém o seu próprio formato
  (`{Name, Arity, Flags, Status}`, [módulo erlang](builtins.md#erlang-module)).
- As listas de exports são observadas a partir de um OTP 29 do anfitrião
  (`M:module_info(exports)`); nenhum código-fonte do OTP é copiado. Os
  resultados e os termos de erro das funções implementadas coincidem com o
  OTP 29; as diferenças deliberadas vão para [diferenças](differences.md).

### Funções documentadas

`library/documented.terms` lista as funções públicas que o OTP 29 documenta
para `erts`, `kernel`, `stdlib`, `crypto` e `public_key`: `{Module, Application, Name, Arity}.` por
função cuja documentação do módulo e da função não está oculta e que não está
obsoleta, observada nos blocos de documentação do OTP do anfitrião por
`tests/compiler/library/observe_docs.escript` (executado explicitamente).
Os exports não documentados mantêm-se nos inventários mas podem continuar como stubs.

- `library_inventory` verifica que cada função documentada de um módulo
  fornecido está no seu inventário e não é um stub, exceto nos módulos que
  `library_modules.py` lista como parciais com o passo do plano que os completa.
- `python tests/compiler/library/library_modules.py coverage .` imprime as
  contagens de funções implementadas e documentadas de cada módulo documentado.

### Tipos

Como os módulos do Clause prevalecem sobre os do OTP, o código OTP que nomeia
`file:filename()` ou `erlang:time_unit()` nas suas specs tem de encontrar esses
tipos nos módulos do Clause. Cada módulo fornecido cujo equivalente OTP exporta
tipos inclui `<module>.types.hrl` do seu próprio diretório: a lista
`-export_type`, depois os tipos exportados e os tipos locais e records que eles
usam, tal como o OTP os define (a documentação mostra as mesmas definições; a
documentação instalada não traz definições de tipos, pelo que estas vêm da
implementação: a informação de depuração do beam, ou o código-fonte distribuído
de um módulo pré-carregado como `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` escreve o
cabeçalho a partir do OTP do anfitrião, e `--check` compara as suas formas com
uma observação nova (CTest `library_freshness`); `library_modules.py check`
exige que cada cabeçalho seja incluído pelo seu módulo. Os tipos que os
cabeçalhos nomeiam a partir de módulos fora do programa (`unicode:chardata()`,
`calendar:datetime()`) e as uniões largas do OTP (`file:posix()` tem mais
membros do que o grafo de tipos mantém) resolvem-se para `term()` sem aviso: os
diagnósticos pertencem à biblioteca do Clause, não ao programa do utilizador.

### Serviços do kernel no arranque

`file`, `io` e `code` do OTP chamam servidores registados (`file_server_2`,
`code_server`, o servidor de io de um group leader) que a aplicação `kernel`
inicia no arranque. Um executável do Clause não inicia nenhum deles: os
próprios `file` e `io` do Clause não precisam de servidor, o `logger` do Clause
inicia o seu servidor na primeira utilização, e um módulo OTP que precise de um
falha da mesma forma que falha no OTP sem esse servidor (`noproc`). O código OTP
que chama `code` em tempo de execução não funciona, portanto. Arrancar toda a
aplicação `kernel` não está planeado.

### Aplicações

- As especificações vêm do programa, não de um caminho de código: o clau compila
  todos os `*.app` e `*.app.src` ao lado dos ficheiros-fonte do lote, todos os
  `*.app` no diretório `ebin` adjacente, e `ebin/Name.app` ou `src/Name.app.src`
  de cada entrada de `[targets.options.applications]` para o módulo gerado
  `clause_applications`, acrescentado sempre que o lote tem
  `application_controller`. Prevalece o primeiro ficheiro de cada nome de
  aplicação. Um recurso que não liste módulos recebe os módulos do lote ao seu
  lado. Os diagnósticos apontam para o ficheiro de recurso.
- `application:load/1` também aceita termos `{application, Name, Keys}`. Um nome
  sem recurso dá `{error, {"no such file or directory", "Name.app"}}`, como a
  resposta do OTP para um ficheiro em falta.
- `kernel` (11.0.4) e `stdlib` (8.1) estão carregados e em execução desde o
  início tal como o OTP 29.1.1 os lista, sem processos mestres de aplicação;
  `kernel` tem o ambiente predefinido do seu `kernel.app`.
- Uma aplicação com um módulo de arranque recebe um processo mestre que lidera
  o grupo dos seus processos (pelo que `get_application/0`, `get_env/1` e
  `start_type/0` respondem dentro dele), reencaminha os seus pedidos de E/S para
  a E/S padrão e, ao parar, executa `prep_stop/1`, encerra o processo de topo,
  executa `stop/1` e termina o que resta do grupo. Uma aplicação permanente que
  termina, ou uma transitória que termina de forma anormal, termina o programa
  com a mensagem do OTP e estado de saída 1.
- `logger` e `clause_logger` alcançam `application` por um nome em tempo de
  execução, pelo que só os programas que usam `application` o ligam.

### Registo

O plano do projeto agenda todos os módulos documentados de `erts`, `kernel`
e `stdlib`; os programas reais (luerl primeiro) definem as prioridades.
Compile-o e execute-o, classifique cada erro
(`unknown module`, `undefined function M:F/A`, sintaxe ou funcionalidade não
suportada, outro) e atribua cada um a um passo do plano, a outro item pendente
ou a uma recusa registada. Com o stderr da execução guardado num ficheiro,
`python tests/compiler/library/library_modules.py report FILE` imprime a
classificação em tabelas: cada módulo desconhecido com o seu número de erros, os
módulos chamadores e as funções chamadas com as aridades; as funções não
definidas por módulo; as outras mensagens com as suas contagens.

### Ferramentas

Todas ficam em `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` escreve
  `LIBRARY/APP/MODULE.terms` a partir de `MODULE:module_info(exports)` do OTP
  do anfitrião, mantendo o grupo e o estado de cada entrada já existente; um
  novo export começa como `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` escreve o ficheiro do
  módulo uma vez, com todos os exports como stubs; a partir daí o ficheiro é
  editado à mão.
- `python library_modules.py check ROOT` (CTest `library_inventory`, sem OTP)
  comunica todas as discordâncias: um módulo fornecido sem os seus ficheiros, um
  módulo em falta com um ficheiro, um inventário não listado como fornecido, um
  export ausente do inventário ou o inverso, uma entrada `stub`/`declined` que
  não é um stub `not_implemented`, uma entrada `implemented`/`refused` sem corpo
  nem builtin do catálogo.
  `library_rejects` prova-o numa biblioteca de fixture deliberadamente
  inconsistente.
- O CTest `library_freshness` (etiquetas `host_otp`, `full_only`) volta a
  observar todos os inventários e exige-os inalterados, depois observa, gera,
  verifica e compila um módulo novo de ponta a ponta. `library_report` executa o
  `clau` num programa de fixture e verifica as linhas do relatório.
