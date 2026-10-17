---
source: docs/validation.md
sourceCommit: a8c3f8f6
sourceSha256: 54f5af0873d1220b42924fb4323bb6d19263b4e6301ffc0aa412ca04dcd9e835
translatedAt: 2026-10-17
---
# Validação

## Base atual

Os gates registados mais recentes no anfitrião de desenvolvimento Windows x64
(clang-cl e SDK do LLVM 23.1.2, `/MT`, `_ITERATOR_DEBUG_LEVEL=0`); os passos
posteriores registam os seus em `.agents/00-finished.md`:

| Verificação | Resultado |
| --- | --- |
| CTest Debug combinado a partir do zero (2026-10-14) | 299/300 aprovados; a falha é o limite conhecido de tamanho da IR em `codegen_measurements`; `codegen_resource_cli` está desativado |
| `check-quality-all` (mesma execução) | Limpo; Lizard CCN 10 |
| Testes opcionais de auditoria ao OTP (2026-10-14, pin `d199a49a01a2`, oráculo OTP 29.1.1) | 17/17 |
| `regenerate.py --corpus all --check` (idem) | 19/19 corpora reproduzidos |

## Executar o gate

A partir de uma shell de programador do Visual Studio x64 com
`C:\Program Files\LLVM\bin` no `PATH` (a seleção automática do SDK reutiliza
`thirdparty/`):

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files + dependents
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` executa os corpora golden em O0 posicional mais o
  projeto O2 com a especialização desativada, executa as mutações uma vez e
  salta os testes `full_only` (projetos consumidores separados como
  `runtime_generated_link`, medições, a auditoria `library_freshness` ao OTP do
  anfitrião). O modo completo (predefinido) executa todas as combinações de
  driver/política.
- Os testes longos conduzidos por um script Python ou CMake têm um `COST` fixo
  no CTest: o CTest aprende o custo de um wrapper a partir do seu próprio tempo
  de CPU, pequeno, e iniciá-los-ia em último lugar.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multiplica os limites por execução do executor
  de goldens (60 s) e do executor de casos semânticos (15 s) para compilações
  instrumentadas.
- `check-quality`, `make format` e `make-format.bat` abrangem os ficheiros
  alterados desde `HEAD` mais os ficheiros não seguidos; `cmake/quality_scope.py`
  acrescenta as unidades de tradução que incluem um cabeçalho alterado (a partir
  dos dados de dependências do Ninja de qualquer configuração) e, para o
  clang-tidy, as unidades cujo comando de compilação difere do registado pela
  última execução aprovada (`build/debug/quality/tidy-commands.json`),
  pelo que uma edição de uma regra de compilação volta a verificar apenas as
  unidades que altera. As alterações a `.clang-tidy` ou aos scripts do tidy
  selecionam tudo, tal como as edições de regras de compilação antes da primeira
  execução registada.
- `CLAUSE_OPTIMIZED_COMPILER` (por omissão ON) compila o `clau` e as bibliotecas
  do compilador otimizados também nas compilações Debug, mantendo a sua
  informação de depuração e os orçamentos de inferência Debug; os testes passam
  a maior parte do tempo no `clau`. Quando for preciso percorrer passo a passo
  uma falha do compilador, configure com `-DCLAUSE_OPTIMIZED_COMPILER=OFF`,
  recompile e volte a executar o teste que falha.
- Os programas de teste não contêm informação de depuração (sem PDBs);
  configure com `-DCLAUSE_TEST_DEBUG_INFO=ON` para os recompilar para um
  depurador. Os consumidores nativos aninhados ligam o runtime da compilação
  principal através de `ClauseRuntimeTargets.cmake` em vez de o compilar
  novamente; só `runtime_link` compila o runtime de forma autónoma.
- Os limiares e as supressões nunca são aumentados para passar o gate. Estão
  configuradas duas exceções de terceiros (decisão do utilizador):
  `cmake/tidy_filter.py` descarta os relatórios do analisador estático
  localizados em cabeçalhos do Boost (falsos positivos do armazenamento de limbs
  do Boost.Multiprecision em Linux que reescrever o código chamador apenas
  desloca) e conta-os na saída, e
  `bugprone-exception-escape` ignora `bad_array_new_length` (os construtores de
  movimento de map/set do MSVC alocam; uma falha de alocação é, de qualquer
  modo, fatal).
- O clang-tidy verifica os cabeçalhos do projeto em todos os anfitriões: o
  filtro de cabeçalhos aceita os separadores `/` e `\`.

### Linux

O mesmo gate corre em Linux com o SDK Linux do LLVM 23.1.2 fixado como
compilador do anfitrião (`CC`/`CXX` a partir do seu `bin/`), a libstdc++ do
sistema, Ninja e CMake 3.28 ou mais recente. O Boost 1.90 e o toml++ 3.4.0 vêm
de pacotes instalados ou são extraídos para `thirdparty/` (`boost_1_90_0/`,
`tomlplusplus-3.4.0/`); só o Windows os descarrega. O `ld.lld` do arquivo da
release liga a ICU 70 (Ubuntu 22.04) e o seu `lldb` liga o Python 3.14; em
anfitriões sem eles, `linking_lto` precisa da ICU 70 em `LD_LIBRARY_PATH`, e
`linking_debugger` usa o GDB.

```sh
cmake --preset debug --fresh -G Ninja -DBUILD_TESTING=ON
cmake --build build/debug
ctest --preset debug -j 16
```

`check-quality` (Lizard, clang-tidy) corre apenas no anfitrião de
desenvolvimento Windows; os outros anfitriões compilam e executam os testes
(esteve limpo em Linux uma vez, ver o [histórico](#history)).

### Outros alvos

Os alvos de 32 bits e ARM são verificados sem um compilador compilado para eles
(não existe SDK do LLVM para esses anfitriões):

- Uma compilação só do runtime (`-DCLAUSE_BUILD_COMPILER=OFF -DBUILD_TESTING=ON`)
  para o alvo executa aí os testes do runtime e da ABI: nativamente, num
  userland do alvo (chroot) ou através do emulador do anfitrião (qemu binfmt).
- `tests/compiler/executables/cross.py` executa todos os goldens de executáveis
  e fixtures de programas com o `clau` deste anfitrião, `--target-triple`, o
  arquivo do runtime dessa compilação e um `--linker` que alcança as bibliotecas
  do alvo (`run.py --target-option` passa-os adiante).

## Fixtures e proveniência

- As compilações e os testes normais não precisam do OTP nem do seu
  código-fonte. Os goldens foram gerados uma vez a partir do OTP e estão no
  repositório com hashes; as verificações de hash são executadas antes de
  qualquer fixture ser usada.
- Dezanove corpora de padrões/guards contêm 67 748 valores/erros nativos
  esperados e 106 linhas de aceitação semântica. Cada corpus nativo executa os
  drivers posicional e de projeto em O0/O2 com a especialização ativada e
  desativada, com chamadas locais e remotas.
- As entradas Erlang no repositório são de autoria local
  (`tests/fixtures/patternmatch/fragments/`, `semantic/headers/` do
  pré-processador); `fixture_sources` impõe o isolamento em relação ao
  código-fonte do OTP.
- Seis fixtures de programas finais (`tests/fixtures/programs/`) contêm goldens
  de stdout/estado de saída do OTP e os seus diagnósticos de compilação;
  `programs_compile` verifica-os sem OTP e
  `tests/compiler/programs/regenerate.py --check` reprodu-los com o OTP
  ([mapa das fixtures](../tests/fixtures/programs/README.md)).
- Os goldens de impressão de termos (`tests/fixtures/printing/`) contêm o texto
  de `~w` e de `erlang:display/1` do OTP para 9 542 valores, mais o stdout do
  OTP de chamadas display compiladas;
  `tests/compiler/printing/regenerate.py --check` reprodu-los
  ([notas das fixtures](../tests/fixtures/printing/README.md)).
- Os casos golden de executáveis (`tests/fixtures/executables/`) são diretórios
  de código-fonte mais um `golden.json` com o stdout/estado de saída do OTP e um
  padrão de stderr escrito à mão; `tests/compiler/executables/run.py` liga e
  executa cada um sob a matriz de política/driver (CTest `executables_<case>`),
  e `regenerate.py --check` reprodu-los com o OTP
  ([notas dos casos](../tests/fixtures/executables/README.md)).
- A regeneração e as auditorias em direto são explícitas:
  `-DCLAUSE_OTP_AUDITS=ON` e `tests/compiler/patternmatch/regenerate.py`
  ([instruções](../tests/fixtures/patternmatch/generated/README.md)). Nada
  atualiza os goldens nem o pin silenciosamente.

## Conceção dos testes

O comportamento é testado através da CLI real, dos objetos emitidos, de
consumidores nativos ligados e dos goldens do OTP. Os testes unitários dedicados
permanecem apenas onde o código-fonte não consegue alcançar o estado, cada um
com o seu propósito indicado no teste:

- Orçamentos injetados e falhas de alocação/E/S (`project_limits`,
  `project_creation_failure`, `codegen_limits`, `codegen_write_failure`,
  `runtime_lifecycle_failure`, pontos de injeção de falhas em chamadas geradas).
- Invariantes de posse privada, de handles inválidos/obsoletos e de reversão no
  analisador sintático, no grafo de tipos semântico e no backend.
- Validação de palavras em bruto e limites de termos de 32/64 bits
  (`runtime_immediate`, `runtime_term_tag`, `abi_integers`).
- Falhas do destino de diagnósticos e o instantâneo estável dos IDs de
  funcionalidades.

Os casos de capacidades do sistema de ficheiros (ligações, aliases por
maiúsculas/minúsculas) relatam testes saltados por caso; nunca substituem a
aprovação de um teste completo.

## Estado por plataforma e sanitizers

- Execução de código gerado nativo: Windows x64; Linux x86-64. Os resultados de
  32 bits e ARM (testes do runtime e goldens ligados de forma cruzada) estão no
  histórico.
- Apple Silicon: não validado desde que o backend existe.
- ASan, UBSan e LeakSanitizer no compilador e no runtime: Linux
  x86-64, uma única configuração Debug combinada
  (`-fsanitize=address,undefined -fno-sanitize=vptr -fno-sanitize-recover=undefined`),
  CTest completo com `CLAUSE_TEST_TIMEOUT_SCALE=10` (o código instrumentado
  corre várias vezes mais devagar): nenhum relatório dos sanitizers. O
  compilador, o runtime e os programas de teste são instrumentados; os programas
  que o `clau` liga obtêm o runtime do sanitizer a partir de um wrapper
  `clang++` no `PATH`, e o seu código gerado não é instrumentado. Os quatro
  testes de recusa injetada do anfitrião (`codegen_failure_*`,
  `runtime_lifecycle_failure`, `runtime_memory`) estão fora do âmbito do ASan: o
  seu `operator new` aborta perante um tamanho impossível em vez de lançar uma
  exceção.
- ThreadSanitizer: Linux x86-64, o mesmo âmbito de instrumentação com
  `-fsanitize=thread`; o CTest completo e os testes de concorrência, cinco vezes
  cada, não comunicam nenhuma corrida. Também fora do âmbito: os dois testes que
  substituem `operator new`.
- Em Windows, o SDK do LLVM pré-compilado continua a entrar em conflito com o
  código instrumentado (`annotate_string` 0 vs 1).
- O ASan apenas do runtime passa em Windows com sondas Release,
  `/EHsc /fsanitize=address`, `/MT`, a biblioteca de importação do ASan e o
  thunk de runtime estático do Clang, e a DLL do ASan no `PATH`.
- Execuções históricas em macOS arm64 (2026-09-19/20) passaram compilações Debug
  completas, C++26, ASan+UBSan, apenas do compilador e apenas do runtime para as
  fases do analisador sintático e dos projetos; são anteriores ao backend.

## Benchmarks

Comparação manual de desempenho com o Erlang/OTP. Nunca faz parte do CTest, do
gate de commit nem de `check-quality`, e só ela precisa de um Erlang/OTP no
anfitrião; os resultados são evidência específica do anfitrião, não resultados
do gate.

```powershell
make-benchmark.bat                         # Windows; set JOBS=N to cap parallel builds
make-benchmark.bat --repeat 9 --only bench_gc,bench_msg
make benchmark BENCH_ARGS="--baseline HEAD~5"   # other hosts
```

- Ambos configuram e compilam um `clau` e um runtime Release em `build/bench` e
  depois executam `benchmarks/run.py` (`--help` lista as suas opções).
- Programas: `benchmarks/bench_*.erl` com `bench_util.erl`, compilados sem
  alterações pelo `erlc` e por `clau -O2`. Cada um cronometra os seus kernels
  com `erlang:monotonic_time/1` após uma chamada de aquecimento e imprime
  `BENCH <name> <nanoseconds>`: geração de dados, processamento de dados,
  recolha de lixo, passagem de mensagens, E/S de ficheiros (num diretório de
  trabalho temporário vazio) e sockets de loopback.
- Sistemas, no mesmo anfitrião numa só execução, intercalados: o OTP com a sua
  variante por omissão (JIT), o OTP `-emu_flavor emu` quando instalado (o
  instalador Windows só inclui o JIT, pelo que essas colunas mostram `n/a`), o
  Clause HEAD em O2 e com `--lto`, e um commit anterior do Clause (por omissão:
  o commit mais recente com pelo menos um dia a mais do que HEAD;
  `--baseline REV`, `--no-baseline`) compilado num worktree em cache em
  `build/bench-base/<hash>` que partilha `thirdparty/`.
- Relatório: por kernel, a mediana de `--repeat` execuções (por omissão 5) em
  milissegundos com seis casas decimais e a sua dispersão, a variação do Clause
  O2 em relação a cada sistema (`+N%`: o Clause é mais rápido, o outro demora
  mais N%; `-N%`: o Clause demora mais N%; `(Fx)` a razão dos tempos) com uma
  média geométrica, `--lto` em relação ao OTP e ao O2, os tempos totais dos
  programas incluindo o arranque, as falhas e os tempos esgotados (`--timeout`,
  600 s por execução). As contagens de iterações mantêm uma execução por omissão
  abaixo de 10 minutos; o Clause, o sistema mais lento, define os tamanhos, pelo
  que alguns kernels do OTP duram apenas alguns milissegundos.
- Histórico: `benchmarks/history/<host>.json` guarda um registo por dia de
  execução (data da execução, hash e data do commit de HEAD, medianas do Clause,
  do OTP e da referência),
  `benchmarks/history/reports/<host>/<day>-<hash>.txt` os relatórios de texto;
  uma nova execução no mesmo dia substitui ambos. Os registos e os relatórios
  executados mais de 183 dias antes do mais recente são eliminados; uma execução
  com alterações de código-fonte não submetidas é comunicada mas não registada.
  O diretório do histórico é ignorado pelo git: fica no anfitrião que o
  executou.
- Listagens: com `--listings`, antes de medir, uma execução escreve as listagens
  [`--print-asm`](compile.md#assembly-listings) e `--print-ir` de cada programa
  (com `bench_util`, `--entry <program>`, para que o código de biblioteca
  inalcançável fique de fora como no executável) ao lado dos relatórios como
  `<program>.debug.asm` / `<program>.debug.ll` (`-O0`) e
  `<program>.release.asm` / `<program>.release.ll` (`-O2`, o código que a coluna
  `clause-o2` executa), substituindo as listagens da execução anterior,
  incluindo com `--no-history` e alterações não submetidas. `--print-ir` é a IR
  antes do pipeline do LLVM; os comentários do assembly citam a IR depois dele.
  Um programa que não compila perde as suas listagens obsoletas.

## Histórico

Condensado a partir dos antigos registos por passo (originais no histórico do
Git até ao commit `2777c98`). Salvo indicação em contrário: Windows x64, LLVM
23.1.2, pin `21776803ecd1`, oráculo OTP 29.1.1 / ERTS 17.1. Os números de testes
são execuções completas do CTest aprovadas, com zero testes saltados.

| Data | Marco | Testes | Unidades de qualidade | Notas |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Phase VI do analisador sintático (macOS arm64, OTP 29.1 `751f87b7`, oráculo 29.0.5) | 46 | todas | 344/344 produções testemunhadas; corpus de 10 ficheiros |
| 2026-09-20 | Projetos (macOS arm64) | 64 | todas | Debug, apenas compilador, ASan+UBSan |
| 2026-09-28 | Migração dos testes para fluxos de trabalho da CLI; reparação do gate em Windows | 75 | todas | Stack overflow em `parser_hardening` corrigido com uma pilha de 8 MiB; Lizard + clang-tidy limpos |
| 2026-09-29 | Steps 1–46 do marco do compilador | 103 | 182 | Apenas compilador 80, apenas runtime 16, ASan do runtime 16 |
| 2026-10-01 – 10-03 | Plano de padrões/guards PG1–PG20 | 104–131 | 189–258 | Revisões 2–4 da ABI; PG15a tornou os goldens independentes do OTP (auditorias opcionais, 131 → 118 testes); encerrado com 19 corpora, 67 634 valores, 1 969 resultados semeados |
| 2026-10-03 | Auditoria do código-fonte do OTP | 125 | 258 | Ficheiros copiados do OTP substituídos por fragmentos locais; uma comparação por janelas de 60 tokens com 4 150 ficheiros Erlang e 1 190 ficheiros C/C++ do OTP não encontrou sobreposição além de um tuplo de inteiros gerado |
| 2026-10-03 | Base do plan 11 step 1 (commit `b1a471f`, pin `21776803ecd1`, Lizard 1.24.0, clang-tidy 22.1.8) | 125 (122 rápido) | 258 | Completo 729 s em série, 85 s com `-j 16`; 14/14 auditorias; 19/19 corpora; objetos O0/O2 para outros alvos inspecionados em 7 alvos |
| 2026-10-03 | Steps 2, 4: fixtures de programas, impressão de termos | 126–128 | 265 | Seis goldens de programas do OTP; 9 542 goldens de `~w`/display |
| 2026-10-04 | Steps 8, 8I: executor de executáveis, heap clássico (phases B, C fechadas) | 138–144 | 272–276 | Completo `-j 16` 235–370 s |
| 2026-10-04 – 10-05 | Steps 9–20: `case`, `if`, lançamentos, `catch`, `try`, stack traces, `maybe` (phase D fechada), recursão, frames e chamadas de cauda | 146–158 | 277–278 | Testes rápidos e afetados em modo completo por passo; completo `-j 16` 155/155 em 259 s na phase D |
| 2026-10-06 | Steps 21–28: comprehensions (phase E fechada), raízes e recolha, limites de memória e de termos (27A–27E), cópias de grafos | 159–166 | 278–281 | Completo `-j 12` 105–275 s; o step 27 removeu os limites de memória predefinidos |
| 2026-10-07 | Steps 29–35: records, native records (ABI 6), funs (ABI 7), closures, funs com nome, chamadas dinâmicas (ABI 8) | 167–177 | 283–290 | Completo `-j 12` 119–152 s |
| 2026-10-09 | Step 63 Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, clang do SDK LLVM 23.1.2, libstdc++ 14, GDB 16.2) | 235 | 338 | CTest completo 235/235 em 161 s; Lizard e clang-tidy limpos em Linux (7 relatórios do analisador em cabeçalhos do Boost ignorados); gate Windows 235/235 com os cabeçalhos verificados |
| 2026-10-09 | Step 64 32 bits: Windows x86 (WoW64, clang-cl) e Linux i386 (chroot Debian 13, clang 19) | 42 + 65 goldens | — | Testes do runtime/ABI 42/42 nativamente em ambos; goldens `cross.py` 65/65 em ambos (execuções `integer_limit` só de 64 bits saltadas) |
| 2026-10-09 | Step 65 Linux arm64 e armhf (sysroots Debian 13, qemu-user 9.2) | 42 + 65 goldens | — | Testes do runtime/ABI 42/42 em cada; goldens 64/65 em cada (`port_spawn` `enoent`: lacuna do `posix_spawn` no qemu), limite de execução 900 s |
| 2026-10-10 | Step 67 ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Nenhum relatório dos sanitizers; quatro testes de recusa injetada do anfitrião fora do âmbito do ASan; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Step 68 ThreadSanitizer (Linux x86-64) | 233 | — | Uma inversão da ordem de bloqueios corrigida (`Executor::clear`); depois nenhum relatório no CTest completo nem em 15 testes de concorrência x5 |
| 2026-10-10 | Steps 65A–65C: behaviours, `module_info/0,1`, imports | 234–236 rápido | 342–344 | Os goldens de lint e de executáveis reproduzem-se com o OTP 29.1.1 |
| 2026-10-11 | Steps 73A–73G parse transforms | 242/243 rápido | — | Falha conhecida de `codegen_resource_cli`, entretanto desativado |
| 2026-10-12 | Steps 62D1–62E diretório de compilação e caches | 263/264 | todas | CTest completo, falha conhecida de `codegen_resource_cli`; `check-quality-all` limpo |
| 2026-10-13 | Steps 58U–58W cache de inferência | 278/279 | todas | CTest completo, falha conhecida de `codegen_measurements`; `check-quality-all` limpo |
| 2026-10-14 | Step 41S `prim_eval` e a nova execução do luerl (H3 fechado) | 299/300 | todas | Ver a base atual |

PG = passo do plano de padrões/guards; os registos dos passos do plano 11 estão
arquivados em `.agents/00-finished.md`.
