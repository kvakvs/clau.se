---
source: docs/building.md
sourceCommit: 336caea7
sourceSha256: 86d39780700856574257fd2d598102b8e551505085c42a0a8175f9c2c7b2330c
translatedAt: 2026-10-18
---
# Compilar o compilador

Configure e compile a partir da raiz do repositório:

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

Wrappers (substituições por variáveis de ambiente: `BUILD_DIR`,
`TOOL_BUILD_DIR`, `BUILD_TYPE`, `JOBS`, `CMAKE`, `CTEST`, `CMAKE_ARGS`,
`CLANG_FORMAT`):

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

Opções de configuração:

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

Notas para Windows: o CRT por omissão é `/MDd` (Debug) ou `/MD`; um
`CMAKE_MSVC_RUNTIME_LIBRARY` explícito tem de corresponder ao SDK do LLVM. O
`cl` do MSVC funciona num diretório de compilação separado; o MinGW não é
suportado. Os alvos do projeto tratam os avisos como erros e incluem as
dependências como cabeçalhos `SYSTEM`, pelo que deve evitar acrescentar
caminhos de dependências através de flags `-I` globais como `CXXFLAGS` (no
CLion, limpe um valor em cache com `-DCMAKE_CXX_FLAGS:STRING=`); use antes as
opções de raiz.

## Testes

Os testes são opcionais e ativam-se ao configurar:

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
`-j N` corre N/2 testes em simultâneo. Os testes compilam código-fonte Erlang
real através da CLI e comparam os executáveis com goldens gerados pelo OTP; ver
[validação](validation.md) para a linha de base, as fixtures e o desenho dos
testes.

Controlo de qualidade (Lizard e clang-tidy, ferramentas fixadas em
`tools/requirements-quality.txt` e instaladas em `.venv-quality/`; use
`.venv-quality/bin/python` fora do Windows):

```sh
python -m venv .venv-quality
.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt
cmake --build build/debug --target check-quality       # changed files
cmake --build build/debug --target check-quality-all   # whole tree
```

`check-quality` verifica os ficheiros alterados desde `HEAD` (ou
`CLAUSE_QUALITY_BASE`) mais uma unidade de tradução por cabeçalho alterado
(`check-quality-all` cobre todos os dependentes, na verificação completa), e
precisa de uma compilação com o compilador e o runtime ativados;
`check-complexity-all` e `check-clang-tidy-all` correm uma só ferramenta.
`cmake/CheckClangTidy.cmake` aceita `QUALITY_SHARD=K/N` para dividir uma
execução longa.
