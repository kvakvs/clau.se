---
source: docs/building.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: b5b9cdbb0544c714f847eac4931ed0fa38d8de1144153349efac4c2302159cbc
translatedAt: 2026-10-26
---
# Compilar o Clause

Como compilar `clau` e `clause_runtime`, configurar a compilação, executar os
testes e usar as ferramentas de desenvolvimento. O desenho dos testes e os
resultados estão em [validação](validation.md).

## Requisitos

- CMake 3.28+ e um compilador C++23; no Windows, a carga de trabalho **Desktop
  development with C++** do Visual Studio com um Windows SDK, Ninja e uma
  instalação global de LLVM/Clang (`clang-cl`, e `clang` para ligar programas).
- SDK C++ do LLVM 23.1.x (23.1.1 ou mais recente) para o compilador. É preferível
  uma instalação global; caso contrário, o CMake transfere o SDK fixado 23.1.2
  para `thirdparty/` no Windows x64/ARM64, Linux x64/ARM64 e macOS ARM64
  ([SDK do LLVM](compile.md#llvm-sdk)). As ferramentas de linha de comandos do
  LLVM, por si só, não incluem o SDK.
- Boost 1.90+ (Multiprecision, Asio e Parser para o compilador; apenas
  cabeçalhos), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 e zlib 1.3.2. O CMake
  transfere as dependências em falta para `thirdparty/` com verificações SHA-256
  e reutiliza-as offline, também em novos diretórios de compilação; no Linux e
  no macOS, Boost e toml++ vêm de uma instalação ou de `thirdparty/`
  ([dependência de compilação](projects.md#build-dependency)).
- Python 3 para os testes e as ferramentas de qualidade, benchmarks e listagens.
- Não é necessário Erlang/OTP para compilar ou testar. Os testes usam
  [fixtures golden próprias do projeto](../tests/fixtures/patternmatch/generated/README.md);
  só as parse transforms, as auditorias opcionais com OTP real, a regeneração
  de fixtures e os benchmarks precisam de uma instalação do OTP 29.

No macOS (Erlang opcional):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```

## Configurar e compilar

```sh
cmake --preset debug                    # build/debug, single configuration
cmake --build --preset debug
```

No Windows, a partir de uma developer shell x64 com `clang-cl` e `ninja` no
`PATH`:

```powershell
cmake --preset windows                  # build/windows, Ninja Multi-Config
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

O preset `debug` coloca o `clau` em `build/debug/bin`; o preset `windows` em
`build/windows/bin/<Config>/clau.exe`, com o runtime em
`build/windows/lib/<Config>/clause_runtime.lib`. O `clau` encontra o arquivo do
runtime e os módulos de `library/` relativamente à sua própria localização.

## Wrappers

Substituições por variáveis de ambiente: `BUILD_DIR`, `TOOL_BUILD_DIR`,
`BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`, `CLANG_FORMAT`.

| Makefile | Windows | Faz |
| --- | --- | --- |
| `make build` | `make-build.bat` | Compila o `clau` em `build/tool` sem testes (o script batch compila em Release e também o runtime) |
| `make test`, `make test-full` | `make-test.bat` | Configura `build/debug` com testes, compila tudo e corre o CTest |
| `make format`, `make format-all` | `make-format.bat` | Aplica o clang-format aos ficheiros C++ alterados (ou, com `FORMAT_SCOPE=all`, a todos) |
| `make benchmark` | `make-benchmark.bat` | Compilação Release em `build/bench`, seguida da comparação com o OTP do anfitrião |
| `make clean` | `make-clean.bat` | Remove `build/` e `cmake-build*/` |

Os scripts batch entram eles próprios no ambiente x64 do Visual Studio quando
necessário, acrescentam `%ProgramFiles%\LLVM\bin` ao `PATH` quando o `clang-cl`
está em falta e reconfiguram um diretório de compilação criado por outro
gerador ou compilador; defina `CLAUSE_TOOLCHAIN=default` para manter a escolha
do próprio CMake. `clau.bat` (Windows) e `run-macos.sh` compilam primeiro
`build/tool` e depois executam o `clau` com todos os argumentos, mantendo o
diretório de trabalho e o código de saída do chamador.

## Opções de configuração

| Opção | Finalidade |
| --- | --- |
| `-DBUILD_TESTING=ON` | Compila os testes e os respetivos programas auxiliares (por omissão OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF` | Compila apenas a biblioteca do runtime, sem LLVM |
| `-DCLAUSE_BUILD_RUNTIME=OFF` | Compila apenas o compilador |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Seleciona um SDK do LLVM 23.1.x (um caminho explícito inválido falha) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Exige um SDK instalado |
| `-DCLAUSE_BOOST_ROOT=...`, `-DCLAUSE_TOML_ROOT=...`, `-DCLAUSE_SQLITE_ROOT=...`, `-DCLAUSE_PCRE2_ROOT=...` | Seleciona o código-fonte ou a instalação de uma dependência (configuração offline) |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Seleciona o executável do Clang no Windows |
| `-DCLAUSE_OTP_AUDITS=ON`, `-DCLAUSE_ESCRIPT=/path/to/escript` | Ativa as auditorias opcionais com OTP real e seleciona o OTP 29 usado |
| `-DCLAUSE_TEST_DEBUG_INFO=ON` | Compila os programas de teste com informação de depuração (para depurar um crash) |
| `-DCLAUSE_OPTIMIZED_COMPILER=OFF` | Compila `clau` e as bibliotecas do compilador sem otimização em Debug (para depurar um crash de `clau`) |

Notas para Windows: o CRT por omissão é `/MDd` (Debug) ou `/MD`; um
`CMAKE_MSVC_RUNTIME_LIBRARY` explícito tem de corresponder ao SDK do LLVM. O
`cl` do MSVC funciona num diretório de compilação separado; o MinGW não é
suportado. Os alvos do projeto tratam os avisos como erros e incluem as
dependências como cabeçalhos `SYSTEM`, pelo que deve evitar acrescentar
caminhos de dependências através de flags `-I` globais como `CXXFLAGS` (no
CLion, limpe um valor em cache com `-DCMAKE_CXX_FLAGS:STRING=`); use antes as
opções de raiz.

## Testes

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug-fast                # or windows-debug-fast
ctest --preset debug -j 16               # full mode
```

`CLAUSE_TEST_MODE=fast` (os presets `*-fast`, `make test`, `make-test.bat`)
corre uma matriz reduzida de otimizações/drivers e salta os testes
`full_only`; `full` (o valor por omissão quando não definido, `make test-full`,
`TEST_MODE=full`) corre tudo. Cada teste reserva duas slots do CTest, pelo que
`-j N` corre N/2 testes em simultâneo.

## Controlo de qualidade

Lizard e clang-tidy, fixados em `tools/requirements-quality.txt` e instalados
em `.venv-quality/` (use `.venv-quality/bin/python` fora do Windows):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` verifica os ficheiros alterados desde `HEAD` (ou
`CLAUSE_QUALITY_BASE`) mais uma unidade de tradução por cabeçalho alterado
(`check-quality-all` cobre todos os dependentes) e
precisa de uma compilação com o compilador e o runtime ativados;
`check-complexity-all` e `check-clang-tidy-all` correm uma só ferramenta.
`cmake/CheckClangTidy.cmake` aceita `QUALITY_SHARD=K/N` para dividir uma
execução longa.

## Benchmarks e listagens

`make benchmark` / `make-benchmark.bat` compilam um `clau` Release em
`build/bench` e comparam os programas `benchmarks/bench_*.erl` com o OTP do
anfitrião e um commit anterior do Clause; `benchmarks/run.py --help` lista as
opções ([benchmarks](validation.md#benchmarks)). Nunca fazem parte dos testes.

`benchmarks/compile_times.py` mede os tempos do próprio `clau`: executa várias
vezes uma carga de compilação (`--workload W1`, ou argumentos de `clau` após
`--`) nos núcleos de desempenho com `--no-cache --print-stage-times`, e indica
a mediana, o mínimo e a dispersão de cada fase e passagem de inferência, os
componentes de inferência mais lentos, e se os contadores de passagens e a saída
padrão coincidem entre execuções. Com `--baseline <clau.exe>`, as duas
compilações alternam e o resumo mostra a sua razão. Recusa medir enquanto
estiverem a decorrer compilações, testes ou outra execução de `clau`, salvo com
`--force-noisy`, e escreve JSON em `build/bench/compile-times/`.

`decompile-debug.bat <module>` e `decompile-release.bat <module>` escrevem o
assembly Debug ou Release de um ficheiro-fonte C++ do Clause em
`<module>.debug.asm` / `<module>.release.asm`, com linhas de código-fonte e
nomes desmanglados (`tools/asm.py`, compilações clang-cl; `--function TEXT`
filtra).
