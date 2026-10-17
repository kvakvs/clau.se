---
source: docs/runtime.md
sourceCommit: a8c3f8f6
sourceSha256: 191e95cc2bea15e016f69e98aca4ce93be2fa8f47a09d9d1977607eceaf69fc2
translatedAt: 2026-10-17
---
# Runtime

`clause_runtime` é uma biblioteca C++23 sem LLVM. Detém os contextos, os heaps
dos processos, os átomos, os módulos carregados e o registo do ciclo de vida, e
executa processos Erlang em workers do escalonador ([processos](processes.md)).
Todas as APIs são internas ao projeto; as chamadas do anfitrião têm de ser
serializadas por runtime e não podem sobrepor-se a uma execução do programa,
cujos workers se sincronizam entre si ([threads](#threads)).

## Ligação

Ligar exatamente um runtime compilado para o alvo através de
`Clause::generated_program`:

```cmake
add_executable(harness harness.cpp)
target_link_libraries(harness PRIVATE Clause::generated_program)
```

Traz o arquivo, os cabeçalhos de ABI/runtime e o C++23, mas não o LLVM.
[link_consumer.cpp](../tests/runtime/link_consumer.cpp) mostra um ciclo de vida
completo.

## Ciclo de vida

[runtime.hpp](../runtime/include/clause/runtime/runtime.hpp):

- `Runtime::start(options)` → `std::expected<std::unique_ptr<Runtime>, Status>`.
  Valores por omissão: versão atual da ABI e largura nativa dos termos,
  `max_atoms` 2^20 (no máximo 2^26; os programas definem-no com `--max-atoms`,
  [opções do runtime](executables.md#runtime-options)). O número de contextos
  não é limitado. `process_heap` e `process_stack` são as opções dos contextos
  criados por `create_context()`; `memory_limit_bytes` é o
  [limite global do runtime](runtime-heap.md#runtime-memory-limit) opcional,
  indicado por `memory_bytes()`. Por omissão, nenhum tem limite.
- `create_context()` ou `create_context(heap_options, stack_options)` →
  `ProcessContext*` emprestado, estável até ser destruído. Valores por omissão
  do heap: heap mínimo de 233 palavras (`min_heap_words`) e sem limite de
  memória (`limit_bytes` = `UNLIMITED_HEAP_BYTES`; um orçamento definido é um
  múltiplo da palavra pelo menos igual ao heap mínimo). A pilha também não tem
  limite, a menos que `StackOptions::limit_words` esteja definido.
- `destroy_context(ctx)`, `shutdown()`: shutdown devolve `busy` enquanto houver
  contextos; depois disso tem sucesso de forma idempotente e as chamadas
  seguintes devolvem `stopped`. O destrutor limpa os contextos restantes.
- As identidades de contextos e de runtimes não são reutilizadas; o seu
  esgotamento é uma falha. A identidade de um contexto inclui o seu número de
  pid ([pids](terms.md#pids-and-references)). Um ponteiro de contexto é um
  empréstimo, não uma identidade. `lifetime()` dá um token fraco que indica
  `alive() == false` antes da desmontagem do heap.
- As chamadas do ciclo de vida nunca lançam exceções e são silenciosas. Valores
  de estado: [abi.md](abi.md#runtime-services).

Ordem de desmontagem: fechar os registos do escalonador → destruir os contextos
→ libertar os registos de código → destruir o serviço do escalonador → tabela de
átomos por último. Os handles de funções resolvidas mantêm vivos o código e as
grafias dos átomos após a desmontagem do runtime, mas nunca um processo.

## Memória dos processos

Cada contexto detém um `ProcessHeap`
([process_heap.hpp](../runtime/include/process_heap.hpp)); a sua disposição,
áreas, dimensionamento, admissão, raízes e recolha estão especificados em
[runtime-heap.md](runtime-heap.md). A API do anfitrião:

- `allocate(words)` devolve armazenamento de palavras a zero. `reserve` dá uma
  reserva só movível, com commit explícito e rollback automático. Uma reserva de
  cada vez por heap: construir primeiro os filhos e reservar o pai por último.
  As palavras de `allocate()` em bruto têm de ficar a zero ou conter objetos
  completos ([disposição das palavras](runtime-heap.md#word-layout)).
- Zero, overflow e orçamento esgotado são rejeitados antes de publicar:
  `out_of_memory` (alocação) ou `limit_exceeded` (orçamento); o código gerado
  recebe o estado exato
  ([comportamento em caso de falha](runtime-heap.md#failure-behavior)).
- `add(value)`/`copy_to` copiam um grafo de outro processo do mesmo runtime
  ([cópia entre heaps](runtime-heap.md#copying-between-heaps)).
- `used_words` conta as palavras alocadas, `capacity_words` o bloco de heap e os
  fragmentos, `off_heap_words` os buffers fora do heap que este processo
  referencia, cada um uma vez
  ([dimensionamento e orçamento](runtime-heap.md#sizing-and-budget)).
- `verify()` percorre o bloco de heap e todos os fragmentos e verifica que cada
  slot de termo aponta para o início de um objeto do mesmo processo (testes e
  depuração; caso contrário `corrupt_heap`).
- `collect(roots)` copia tudo o que é alcançável a partir das raízes do processo
  e das palavras-raiz do anfitrião para um novo bloco de heap
  ([recolha](runtime-heap.md#collection)). Só corre num ponto seguro, caso
  contrário `unsafe_point`
  ([raízes e pontos seguros](runtime-heap.md#roots-and-safe-points)); o código
  gerado faz a recolha nos seus próprios pontos seguros
  ([recolha no código gerado](runtime-heap.md#collection-in-generated-code)).

## Servidor de código e builtins

Cada runtime detém um `CodeServer`
([code_server.hpp](../runtime/include/clause/runtime/code_server.hpp),
[callable.hpp](../runtime/include/clause/runtime/callable.hpp)):

```cpp
auto functions = std::make_unique<ModuleRegistry>();
auto added = functions->add("identity", 1,
    [](ProcessContext &, std::span<const Term> args) -> CallResult<Term> { return args.front(); });
auto loaded = context.code_server().load({"native_demo", CodeImage::linked(), std::move(functions)});
auto fn = context.code_server().resolve({.module = "native_demo", .function = "identity", .arity = 1});
```

- Um `ModuleRegistry` associa um nome/aridade exato (≤ 255) a um callable só com
  `Term`. `load` congela-o e publica-o; duplicados ou falhas não publicam nada.
- O registo também indexa as vinculações dos módulos gerados em hash maps: os
  descritores de módulos, records e funs para as suas vinculações e definições,
  e as palavras de átomo `Module:Function/Arity` para os frames de export. As
  chamadas dinâmicas, `apply/3`, `fun M:F/A` em tempo de execução e as consultas
  de descritores demoram, por isso, um tempo esperado constante em relação ao
  número de módulos e exports. Os índices são construídos dentro do registo: um
  módulo rejeitado não acrescenta nenhuma entrada, e só mudam sob o bloqueio
  exclusivo do servidor.
- `resolve` distingue entre módulo em falta e export em falta.
  `ResolvedFunction` fixa a imagem do módulo; `call` verifica a aridade, os
  argumentos e os resultados, e converte exceções do anfitrião em falhas.
- Os corpos nativos têm de ser síncronos e não bloqueantes, e não podem reter o
  contexto nem o span de argumentos.
- Um catálogo limitado de BIFs diferidos conhecidos (`self/0`, `length/1`,
  `spawn/3`, `spawn_link/3`, `send/2`, `make_ref/0`, `garbage_collect/0`,
  `apply/3` (o código gerado chama antes `apply/2,3` através dos serviços de
  chamada dinâmica, [funs](funs.md#dynamic-calls)), `tuple_size/1`, `+/2`)
  indica `not_implemented`; os outros nomes não registados devolvem
  `unknown_builtin` silenciosamente. Este caminho do anfitrião não chega aos
  builtins de produção.
- Os builtins de produção residem no `BuiltinRegistry` do servidor, registados
  no arranque do runtime; o código gerado, as chamadas dinâmicas e os funs
  chegam a eles através da [ponte de builtins](builtins.md).
- `CodeServer::export_frame` encontra o `FrameDescriptor` de um export pelo
  módulo, pelo átomo da função e pela aridade; `function_frame` acrescenta os
  builtins para chamadas dinâmicas; `external_fun` interna as definições de funs
  externos construídos em tempo de execução.
- Os módulos nunca são descarregados; `CodeServer::unload` está adiado e o
  carregamento dinâmico não é suportado.

## Termos persistentes

Uma tabela por runtime (`memory/persistent_terms`), pertencente a
`Runtime::Impl` e acessível através de `ProcessContext::persistent_terms()`,
guarda os termos de `persistent_term` ([builtins](builtins.md#persistent-terms)).

- Uma chave e o seu valor são copiados, cada um, para um `MessageBuffer`
  ([buffers de mensagens](runtime-heap.md#message-buffers)) fora de qualquer
  processo, pelo que sobrevivem ao processo que os guardou e nenhuma recolha os
  move.
- As entradas são encontradas por um hash da chave (os builtins usam o hash de
  termos de `phash2`) e por igualdade exata, comparada no próprio buffer
  (`MessageBuffer::value`).
- Uma leitura copia o valor para o heap do leitor, onde o OTP entrega uma
  referência para uma área de literais e paga com uma recolha global ao
  substituir ou apagar ([diferenças](differences.md)). Cada heap de processo
  mantém-se autocontido: um valor substituído ou apagado é libertado quando o
  último leitor que ainda o está a copiar larga a sua referência ao buffer, e
  não é necessária nenhuma recolha global.
- Um bloqueio partilhado serve leitores em qualquer número de workers; put e
  erase obtêm-no em exclusivo e nunca copiam enquanto o detêm. O CTest
  `runtime_persistent_terms` cobre valores que sobrevivem a quem os escreveu,
  valores substituídos detidos por leitores, leitores e escritores concorrentes
  e débitos libertados.

## Registo do escalonador

`SchedulerService`
([scheduler.hpp](../runtime/include/clause/runtime/scheduler.hpp)) é um registo
do ciclo de vida dos processos virado para o anfitrião; não executa código. Os
programas correm no executor ([processos](processes.md#executor)), que não o
usa.

- `register_process(context)` uma vez por contexto (mesmo runtime); os
  duplicados devolvem `already_registered`. `remove_process(id)` retira um
  registo que não esteja em execução.
- `begin_dispatch` → em execução; `finish_dispatch` → executável, em espera ou
  terminado (com razão). `set_suspended` alterna um indicador nos registos
  executáveis/em espera. As outras transições devolvem `invalid_transition`.
- `request_shutdown()` fecha o registo, o despacho e o controlo de suspensão; a
  inspeção e as devoluções continuam disponíveis para o esvaziamento.
- `run` e `execute` indicam `not_implemented`.

## Threads

Os workers do escalonador ([workers](processes.md#workers)) executam processos
em várias threads de um runtime. Os serviços que partilham são sincronizados;
tudo o resto fica confinado à thread que executa o seu processo ou protegido
pelo mutex do executor.

- Átomos: `AtomStorage` protege ambos os índices com um mutex partilhado. As
  consultas (`lookup`, `boolean`, `size`) partilham-no; `intern` consulta sob o
  bloqueio partilhado e só uma grafia nova obtém o bloqueio exclusivo, verifica
  de novo e publica a entrada, pelo que interns concorrentes da mesma grafia
  obtêm uma única palavra. As palavras mantêm-se estáveis: uma entrada nunca é
  alterada nem removida antes da desmontagem. A admissão de palavras de átomo lê
  um índice sem bloqueios ([átomos](terms.md#atoms)).
- Código: `CodeServer` protege os seus módulos e as definições de funs externos
  com um mutex partilhado. As consultas (`find_module`, `resolve`, `atom_word`,
  `record_definition`, `fun_definition`, `export_frame`, `function_frame`,
  `owns`) partilham-no; `load` e a construção de uma nova definição de fun
  externo obtêm-no em exclusivo, pelo que registos concorrentes do mesmo nome
  publicam um único módulo (os outros recebem `duplicate_module`) e chamadas
  concorrentes a `external_fun` obtêm uma única definição. O registo de builtins
  é preenchido no arranque do runtime, antes de qualquer worker correr, e depois
  só é lido.
- Fixações: os módulos nunca são removidos enquanto o runtime vive e o servidor
  é destruído depois de todos os contextos, pelo que as definições, os frames e
  os slots de átomos que devolveu permanecem válidos para todas as invocações e
  todas as células de fun. Os handles de `ResolvedFunction` e `find_module`
  também mantêm o seu módulo depois de o runtime desaparecer.
- Números de pid e de port: `IdentityNumbers` emite números sob um bloqueio
  exclusivo e admite palavras de pid e de port sob um bloqueio partilhado.
- Memória: a conta global do runtime (`RuntimeMemory`) debita e liberta com
  operações atómicas; um débito nunca leva a conta além de um limite opcional.
- Outras threads: a thread de temporizadores
  ([timeouts de receive](processes.md#receive-timeouts)), a thread de E/S e, em
  Windows, a thread de leitura de uma entrada `fd`
  ([thread de E/S](ports.md#io-thread)) só tocam no estado dos processos através
  do mutex do executor.
- Ligação: em Linux, o runtime acrescenta `-pthread` para as suas threads; em
  Windows, liga o Winsock (`ws2_32`, `mswsock`) para os sockets.

## Saída padrão

`RuntimeOptions::standard_output`
([output.hpp](../runtime/include/clause/runtime/output.hpp)) recebe a saída de
`erlang:display/1` e de `io` para a saída padrão ([io](io.md)). Por omissão,
escreve no `stdout` do processo através do stdio de C (com buffer); um destino
do anfitrião devolve `false` para indicar uma escrita falhada.

`erlang:display/1` apresenta o seu argumento no
[estilo de display](terms.md#printing), escreve o texto e uma mudança de linha
numa só escrita e devolve `true`. Os limites de apresentação e as escritas
rejeitadas tornam-se estados de infraestrutura (`resource_limit`,
`output_failure`, ...) no canal verificado, nunca exceções Erlang.

## Arranque do programa

`CLAUSE_main_v1` ([startup.hpp](../abi/include/clause/abi/startup.hpp),
`runtime/src/startup/`) executa um programa inteiro para o `main` gerado
([executáveis](executables.md)): verifica a ABI de cada descritor, inicia um
runtime, regista todos os módulos antes de qualquer código de entrada, constrói
o argv no contexto de entrada, executa a entrada no executor e converte o
resultado no [estado de saída](executables.md#exit-status). Os relatórios vão
para o stderr depois de o stdout ser esvaziado; o contexto e o runtime são
desmontados por ordem em todos os caminhos. `CLAUSE_halt_v1` implementa
`erlang:halt/0,1` (`abort` chama `std::abort`).

## Serviços adiados

Estes emitem uma linha `[feature] notimpl` ([funcionalidades](features.md)) e
não alteram nenhum estado:

| Fronteira | Erro |
| --- | --- |
| `TermFactory::function(FunctionIdentity)` | `TermError::not_implemented` |
| `SchedulerService::run` / `execute` | `SchedulerError::not_implemented` |
| `CodeServer::unload` | `CodeError::not_implemented` |
| `dispatch_builtin` num BIF catalogado | `Status::not_implemented` |
