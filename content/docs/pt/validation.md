---
source: docs/validation.md
sourceCommit: 06042fa
sourceSha256: ed256a9f28346170cd141eff3a0d84d3dcaad4d06bbf853414738bd11cb36bd5
translatedAt: 2026-10-09
---
# Validação

## Base atual

Plan 11 step 1, 2026-10-03, commit `b1a471f`, Windows x64: clang-cl
23.1.2, LLVM SDK 23.1.2 (`/MT`, `_ITERATOR_DEBUG_LEVEL=0`), Lizard 1.24.0,
clang-tidy 22.1.8, pin do OTP `21776803ecd1` com o oráculo OTP 29.1.1 /
ERTS 17.1.

| Verificação | Resultado |
| --- | --- |
| CTest Debug combinado a partir do zero | 125/125, zero testes saltados (729 s em série; 85 s com `-j 16`) |
| CTest em modo rápido (`debug-fast`) | 122 testes, cerca de 60 s |
| `check-quality` | Passa; Lizard CCN 10, clang-tidy sobre 258 unidades de produção |
| Testes opcionais de auditoria ao OTP | 14/14 |
| `regenerate.py --corpus all --check` | 19/19 corpora reproduzidos |
| Objetos O0/O2 para outros alvos | 7 alvos inspecionados (Linux x86/x64/ARM/AArch64, Windows x86/x64, Apple Silicon) |

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
  salta os testes `full_only`. O modo completo (predefinido) executa todas as
  combinações de driver/política.
- `check-quality`, `make format` e `make-format.bat` abrangem os ficheiros
  alterados desde `HEAD` mais os ficheiros não seguidos; `cmake/quality_scope.py`
  acrescenta as unidades de tradução que incluem um cabeçalho alterado. As
  alterações a `.clang-tidy`, a `cmake/` ou ao CMake de produção selecionam
  tudo.
- Os programas de teste não contêm informação de depuração (sem PDBs);
  configure com `-DCLAUSE_TEST_DEBUG_INFO=ON` para os recompilar para um
  depurador. Os consumidores nativos aninhados ligam o runtime da compilação
  principal através de `ClauseRuntimeTargets.cmake` em vez de o compilar
  novamente; só `runtime_link` compila o runtime de forma autónoma.
- Os limiares e as supressões nunca são aumentados para passar o gate.

## Fixtures e proveniência

- As compilações e os testes normais não precisam do OTP nem do seu código-fonte.
  Os goldens foram gerados uma vez a partir do OTP e estão no repositório com
  hashes; as verificações de hash são executadas antes de qualquer fixture ser
  usada.
- Dezanove corpora de padrões/guards contêm 67 748 valores/erros nativos
  esperados e 106 linhas de aceitação semântica. Cada corpus nativo executa os
  drivers posicional e de projeto em O0/O2 com a especialização ativada e
  desativada, com chamadas locais e remotas.
- As entradas Erlang no repositório são de autoria local
  (`tests/fixtures/patternmatch/fragments/`, `semantic/headers/` do
  pré-processador). Uma auditoria de 2026-10-03 removeu todos os ficheiros
  copiados do OTP; uma comparação por janelas de 60 tokens com 4 150 ficheiros
  Erlang e 1 190 ficheiros C/C++ do OTP não encontrou nenhuma sobreposição
  restante além de um tuplo de inteiros gerado. `fixture_sources` impõe o
  isolamento.
- Seis fixtures de programas finais (`tests/fixtures/programs/`, plan 11
  step 2) contêm goldens de stdout/estado de saída do OTP e os diagnósticos
  de compilação atuais; `programs_compile` verifica-os sem OTP e
  `tests/compiler/programs/regenerate.py --check` reprodu-los com o OTP
  ([mapa das fixtures](../tests/fixtures/programs/README.md)).
- Os goldens de impressão de termos (`tests/fixtures/printing/`, plan 11
  step 4) contêm o texto de `~w` e de `erlang:display/1` do OTP para 9 542
  valores, mais o stdout do OTP de chamadas display compiladas;
  `tests/compiler/printing/regenerate.py --check` reprodu-los
  ([notas das fixtures](../tests/fixtures/printing/README.md)).
- Os casos golden de executáveis (`tests/fixtures/executables/`, plan 11
  step 8) são diretórios de código-fonte mais um `golden.json` com o
  stdout/estado de saída do OTP e um padrão de stderr escrito à mão;
  `tests/compiler/executables/run.py` liga e executa cada um sob a matriz de
  política/driver (CTest `executables_<case>`), e `regenerate.py --check`
  reprodu-los com o OTP
  ([notas dos casos](../tests/fixtures/executables/README.md)).
- A regeneração e as auditorias em direto são explícitas:
  `-DCLAUSE_OTP_AUDITS=ON` e `tests/compiler/patternmatch/regenerate.py`
  ([instruções](../tests/fixtures/patternmatch/generated/README.md)).
  Nada atualiza os goldens nem o pin silenciosamente.

## Conceção dos testes

O comportamento é testado através da CLI real, dos objetos emitidos, de
consumidores nativos ligados e dos goldens do OTP. Os testes unitários
dedicados permanecem apenas onde o código-fonte não consegue alcançar o
estado, cada um com o seu propósito indicado no teste:

- Orçamentos injetados e falhas de alocação/E/S (`project_limits`,
  `project_creation_failure`, `codegen_limits`, `codegen_write_failure`,
  `runtime_lifecycle_failure`, pontos de injeção de falhas em chamadas
  geradas).
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

- Execução de código gerado nativo: apenas Windows x64.
- Execução em Linux, Apple Silicon e nativa de 32 bits: pendente (os objetos
  são apenas inspecionados).
- ASan, UBSan e LeakSanitizer no compilador/frontend: pendente. O SDK do LLVM
  pré-compilado para Windows entra em conflito com o código instrumentado
  (`annotate_string` 0 vs 1; antes também símbolos duplicados dos alocadores
  rpmalloc/ASan). Nenhuma verificação foi desativada para contornar o problema.
- O ASan apenas do runtime passa em Windows com sondas Release,
  `/EHsc /fsanitize=address`, `/MT`, a biblioteca de importação do ASan e o
  thunk de runtime estático do Clang, e a DLL do ASan no `PATH`.
- Execuções históricas em macOS arm64 (2026-09-19/20) passaram compilações
  Debug completas, C++26, ASan+UBSan, apenas do compilador e apenas do runtime
  para as fases do analisador sintático e dos projetos; são anteriores ao
  backend.

## Histórico

Condensado a partir dos antigos registos por passo (originais no histórico do
Git até ao commit `2777c98`). Salvo indicação em contrário: Windows x64, LLVM
23.1.2, pin `21776803ecd1`, oráculo OTP 29.1.1 / ERTS 17.1. Os números de
testes são execuções completas do CTest aprovadas, com zero testes saltados.

| Data | Marco | Testes | Unidades de qualidade | Notas |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Phase VI do analisador sintático (macOS arm64, OTP 29.1 `751f87b7`, oráculo 29.0.5) | 46 | todas | 344/344 produções testemunhadas; corpus de 10 ficheiros |
| 2026-09-20 | Projetos (macOS arm64) | 64 | todas | Debug, apenas compilador, ASan+UBSan |
| 2026-09-28 | Migração dos testes para fluxos de trabalho da CLI | 74/75 | — | Base 78/93; stack overflow em `parser_hardening` corrigido depois com uma pilha de 8 MiB |
| 2026-09-28 | Reparação do gate em Windows | 75 | todas | Lizard + clang-tidy sem avisos |
| 2026-09-29 | Steps 1–46 do marco do compilador | 103 | 182 | Apenas compilador 80, apenas runtime 16, ASan do runtime 16 |
| 2026-10-01 | PG1 matriz semântica e evidências | 104 | — | Hashes do código-fonte fixados |
| 2026-10-01 | PG2 canal de falhas | 108 | — | ABI rev 2 |
| 2026-10-01 | PG3 átomos | 109 | 189 | ABI rev 3 |
| 2026-10-01 | PG4 vinculações com âmbito | 111 | 191 | 26 casos de legalidade |
| 2026-10-02 | PG5 semântica de padrões | 113 | 196 | 92 módulos de legalidade |
| 2026-10-02 | PG6 correspondência de imediatos | 114 | 199 | 34 chamadas |
| 2026-10-02 | PG7 guards de imediatos | 119 | 205 | 1 689 chamadas |
| 2026-10-02 | PG8 fluxo de controlo dos guards | 120 | 207 | 2 075 chamadas |
| 2026-10-02 | PG9 cláusulas ordenadas | 121 | 208 | 1 020 chamadas |
| 2026-10-02 | PG10 correspondências no corpo | 122 | 209 | 1 666 chamadas |
| 2026-10-02 | PG11 heap estável e raízes | 123 | 213 | ABI rev 4 |
| 2026-10-02 | PG12 tuplos/listas/strings | 125 | 221 | 4 801 chamadas |
| 2026-10-02 | PG13 inteiros arbitrários | 127 | 231 | 16 065 chamadas |
| 2026-10-02 | PG14 floats | 129 | 238 | 14 436 chamadas |
| 2026-10-02 | PG15 maps | 131 | 244 | 8 010 chamadas |
| 2026-10-02 | PG15a goldens sem OTP | 118 | 244 | 14 corpora, 49 959 valores; auditorias opcionais |
| 2026-10-02 | PG16 bitstrings | 120 | 253 | 8 826 chamadas |
| 2026-10-03 | PG17 records em tuplo | 121 | 257 | 1 025 resultados, 29 casos semânticos |
| 2026-10-03 | PG18 catálogo de guards | 122 | 257 | 81 linhas, 5 033 resultados |
| 2026-10-03 | PG19 factos de vinculação | 123 | 258 | 822 resultados, 976 verificações de dominância |
| 2026-10-03 | PG20 encerramento | 124 | 258 | 19 corpora, 67 634 valores, 1 969 resultados semeados |
| 2026-10-03 | Auditoria do código-fonte do OTP | 125 | 258 | Ficheiros copiados do OTP substituídos por fragmentos locais |
| 2026-10-03 | Base do plan 11 step 1 | 125 | 258 | Ver a base atual |
| 2026-10-03 | Plan 11 step 2, fixtures de programas | 126 | 258 | Seis goldens do OTP; modo rápido 123 testes; completo `-j 16` 83 s |
| 2026-10-03 | Plan 11 step 4, impressão de termos | 128 rápido | 265 | 9 542 goldens de `~w`/display; 154 chamadas display compiladas em todas as políticas; clang-tidy executado com um job (execuções concorrentes fizeram a ferramenta falhar em unidades inalteradas) |
| 2026-10-04 | Plan 11 step 8, executor de executáveis (phase B fechada) | 138 (135 rápido) | 272 | Casos `demo`, `exits` sob oito combinações de política/driver; completo `-j 16` 235 s |
| 2026-10-04 | Plan 11 step 8I, heap clássico (phase C fechada) | 144 (140 rápido) | 276 | Completo `-j 16` 370 s: 143/144, `codegen_dependency` excedeu o tempo de 120 s sob carga e passou sozinho em 29 s; Lizard-all 0 avisos; tidy-all passou com um job após uma saída silenciosa da ferramenta com dois jobs |
| 2026-10-04 | Plan 11 step 9, `case` e `begin` | 146 (142 rápido) | 114 alteradas | Rápido 142/142; testes afetados 7/7 em modo completo; Lizard 0 avisos; tidy passou com um job após uma saída silenciosa com dois jobs |
| 2026-10-05 | Plan 11 step 10, `if` | 147 (143 rápido) | 114 alteradas | Rápido 143/143; testes afetados 8/8 em modo completo; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 11, lançamentos no código-fonte | 148 (144 rápido) | 124 alteradas | Rápido 144/144; testes afetados 22/22 em modo completo; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 12, `catch Expr` | 149 (145 rápido) | 277 | Rápido 145/145; testes afetados 25/25 em modo completo; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 13, `try ... of ... catch` | 150 (146 rápido) | 189 alteradas | Rápido 146/146; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 14, `try ... after` | 153 (149 rápido) | 2 alteradas | Rápido 149/149; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 15, stack traces e `raise/3` | 154 (150 rápido) | 129 alteradas | Rápido 150/150; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 16, `maybe` (phase D fechada) | 155 (151 rápido) | 277 | Rápido 151/151; completo `-j 16` 155/155 em 259 s; Lizard-all 0 avisos; tidy-all passou |
| 2026-10-05 | Plan 11 step 18, grafos de chamadas recursivos | 156 (152 rápido) | 91 alteradas | Rápido 152/152; testes afetados 13/13 em modo completo; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 19, frames explícitos e chamadas de cauda | 157 (153 rápido) | 278 | CTest rápido e completo passam (com o caso do step 20: 154/154, 158/158); configuração com clang-cl; Lizard 0 avisos; tidy passou |
| 2026-10-05 | Plan 11 step 20, recursão profunda no corpo e orçamento da pilha | 158 (154 rápido) | 278 | Rápido 154/154; completo 158/158; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Plan 11 step 21, list comprehensions | 159 (155 rápido) | alteradas | Rápido 155/155; testes afetados em modo completo; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Plan 11 step 22, binary e map comprehensions (phase E fechada) | 160 (156 rápido) | todas | Rápido 156/156; completo `-j 12` 160/160 em 275 s; Lizard-all 0 avisos; tidy-all passou após corrigir quatro problemas em código novo |
| 2026-10-06 | Plan 11 step 23, inventário de raízes, `SafePoint`, registos vivos | 160 (156 rápido) | 50 alteradas | Rápido 156/156; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Plan 11 step 26, recolha a partir do código gerado | 161 (157 rápido) | 63 alteradas | Rápido 157/157; completo `-j 12` 161/161 em 107 s; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Plan 11 step 27, esgotamento do heap após a recolha | 162 (158 rápido) | 50 alteradas | Rápido 158/158; completo `-j 12` 162/162 em 108 s; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Correção do plan 11 step 27: sem limites de memória predefinidos | 162 (158 rápido) | 50 alteradas | Completo `-j 12` 158/162 em 120 s, 4 `codegen_failure_*` corrigidos passando a esperar `out_of_memory`, depois 10/10 afetados; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Seguimento do plan 11 step 27: sem limites de binaries nem do número de processos, `--max-atoms` | 164 (160 rápido) | 281 | Rápido 160/160; completo `-j 12` 164/164 em 105 s; Lizard 0 avisos; tidy-all passou |
| 2026-10-06 | Plan 11 step 28, cópias de grafos entre heaps, buffers partilhados fora do heap | 166 (162 rápido) | 71 alteradas | Rápido 162/162; completo `-j 12` 166/166 em 130 s; Lizard 0 avisos; tidy passou |
| 2026-10-07 | Plan 11 step 29, atualizações de records | 167 (163 rápido) | 38 alteradas | Rápido 163/163; Lizard 0 avisos; tidy passou; o corpus de records reproduz-se com o OTP |
| 2026-10-07 | Plan 11 step 30, `record_info/2` | 168 (164 rápido) | 42 alteradas | Rápido 164/164; completo `-j 12` 168/168 em 119 s; Lizard 0 avisos; tidy passou |
| 2026-10-07 | Plan 11 step 31B, células de native records e `CLAUSE_record_v1` (ABI 6) | 169 (165 rápido) | 283 alteradas | Rápido 165/165; completo `-j 12` 169/169 em 122 s; Lizard 0 avisos; tidy passou após duas correções |
| 2026-10-07 | Plan 11 step 31C, native records locais | 170 (166 rápido) | 285 alteradas | Rápido 166/166; completo `-j 12` 170/170 em 146 s; Lizard e tidy passaram após correções de complexidade |
| 2026-10-07 | Plan 11 step 31D, native records qualificados e importados | 171 (167 rápido) | 124 alteradas | Rápido 167/167; completo `-j 12` 171/171 em 129 s; Lizard 0 avisos; tidy passou após três correções |
| 2026-10-07 | Plan 11 step 31E, native records anónimos (step 31 fechado) | 172 (168 rápido) | 33 alteradas | Rápido 168/168; completo `-j 12` 172/172 em 124 s; Lizard 0 avisos; tidy passou após uma correção |
| 2026-10-07 | Plan 11 step 32, valores de função `fun F/A`, `fun M:F/A` (ABI 7) | 173 (169 rápido) | 289 alteradas | Rápido 169/169; completo `-j 12` 173/173 em 122 s; Lizard e tidy passaram após correções de complexidade |
| 2026-10-07 | Plan 11 step 33, closures com variáveis capturadas | 175 (171 rápido) | 134 alteradas | Rápido 171/171; completo `-j 12` 175/175 em 126 s; Lizard e tidy passaram após correções de complexidade |
| 2026-10-07 | Plan 11 step 34, funs com nome | 176 (172 rápido) | 132 alteradas | Rápido 172/172; completo `-j 12` 176/176 em 152 s; Lizard 0 avisos; tidy passou |
| 2026-10-07 | Plan 11 step 35, chamadas dinâmicas `M:F(Args)`, `apply/2,3`, `fun M:F/A` em runtime (ABI 8) | 177 (173 rápido) | 290 (configuração do analisador alterada) | Rápido 173/173; completo `-j 12` 177/177 em 142 s; Lizard 0 avisos e tidy passou após uma correção de complexidade e três do tidy |
| 2026-10-06 | Plan 11 step 27E, limite de inteiros grandes do ERTS, `error:system_limit` | 165 (161 rápido) | 157 alteradas | Rápido 161/161; completo `-j 12` 165/165 em 130 s; Lizard 0 avisos; tidy passou; 21 goldens de executáveis reproduzem-se com o OTP |
| 2026-10-06 | Plan 11 step 27D, sem limites de tamanho de map nem de trabalho sobre chaves | 164 (160 rápido) | 13 alteradas | Rápido 160/160; completo `-j 12` 164/164 em 115 s; após uma correção do tidy em `bit_order`, passam 35 testes afetados; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Plan 11 step 27C, limite de aridade de tuplos 16 777 215 | 164 (160 rápido) | 51 alteradas | Rápido 160/160; completo `-j 12` 164/164 em 121 s; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Plan 11 step 27B, sem limites de comprimento de listas nem de trabalho de comparação | 164 (160 rápido) | 4 alteradas | Rápido 160/160; completo `-j 12` 164/164 em 125 s; Lizard 0 avisos; tidy passou |
| 2026-10-06 | Plan 11 step 27A, limite de memória global do runtime e `--max-heap/stack/memory` | 164 (160 rápido) | 49 alteradas | Rápido 160/160; completo `-j 12` 164/164 em 118 s; após uma correção do tidy em `ProcessStack::grow`, passam 42 testes afetados; Lizard 0 avisos; tidy passou |

PG = passo do plano de padrões/guards (arquivado em `.agents/00-finished.md`).
