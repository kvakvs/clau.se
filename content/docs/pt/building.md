---
source: docs/building.md
sourceCommit: 6ed3851c
sourceSha256: 588e40c653165e5d39e7f284cf3173a4f04d81079cba804e17b7444a1f40662d
translatedAt: 2026-10-15
---
# Compilar o compilador

A partir da raiz do repositório:

```sh
cmake --preset debug
cmake --build --preset debug
```

No Windows, use o preset clang-cl/Ninja Multi-Config a partir da developer
shell:

```powershell
cmake --preset windows
cmake --build --preset windows-debug
cmake --build --preset windows-release
```

Os testes e os respetivos executáveis auxiliares são opcionais. Para testar,
configure explicitamente:

```sh
cmake --preset debug -DBUILD_TESTING=ON
cmake --build --preset debug
ctest --preset debug --no-tests=error
```

No Windows:

```powershell
cmake --preset windows -DBUILD_TESTING=ON
cmake --build --preset windows-debug
ctest --preset windows-debug --no-tests=error
cmake --build --preset windows-release
ctest --preset windows-release --no-tests=error
```

Os testes têm dois modos, selecionados por `CLAUSE_TEST_MODE`:

- `fast` para desenvolvimento: os corpora golden correm duas combinações de
  política/driver (O0 posicional e O2 sem especialização através de um
  projeto) em vez das oito, os casos de mutação correm uma vez, e os testes
  etiquetados `full_only` (projetos consumidores CMake separados e medições de
  tempo) são excluídos.
- `full` (o valor por omissão quando não definido) corre todas as combinações
  e todos os testes; use-o quando uma funcionalidade importante estiver
  concluída.

```sh
ctest --preset debug-fast            # or windows-debug-fast; tests use half the logical CPUs
ctest --preset debug -j 32           # full mode; -j N runs N/2 tests at once
make test                            # fast; make test-full or TEST_MODE=full for full
```

`make-test.bat` segue as mesmas definições `TEST_MODE` (por omissão `fast`) e
`TEST_JOBS` (por omissão todos os CPUs lógicos). Cada teste reserva duas
slots de processador do CTest (`PROCESSORS 2`), pelo que um número de
slots N corre no máximo N/2 testes em simultâneo, deixando espaço para os
compiladores e as compilações nativas aninhadas que os testes iniciam. Num
anfitrião Windows x64 com 32 threads, o modo fast demora cerca de um minuto e
o modo full cerca de 85 segundos com 16 jobs (729 segundos em série).

Para um diretório de compilação sem preset, passe `-DBUILD_TESTING=ON` a
`cmake -S . -B <dir>` para testar. O CMake guarda esta definição em cache;
passe `-DBUILD_TESTING=OFF` ao reutilizar esse diretório para compilações
normais. Os presets normais e os wrappers de compilação definem-na como `OFF`.

Os scripts batch espelham os alvos `build`, `format` e `clean` do Makefile:
`make-build.bat`, `make-test.bat`, `make-format.bat` e `make-clean.bat`. Os
scripts de compilação e de teste configuram o clang-cl com Ninja
Multi-Config, como o preset `windows`, entrando eles próprios no ambiente x64
do Visual Studio quando a shell não é uma developer shell e acrescentando
`%ProgramFiles%\LLVM\bin` ao `PATH` quando o `clang-cl` não está disponível.
Um diretório de compilação configurado com outro gerador ou compilador é
reconfigurado de raiz; defina `CLAUSE_TOOLCHAIN=default` para manter a escolha
do próprio CMake (por exemplo o `cl` do MSVC num diretório separado). Os
valores por omissão da compilação são `BUILD_DIR=build/debug` (testes),
`TOOL_BUILD_DIR=build/tool` (`make build`, `make-build.bat`, `clau.bat`,
`run-macos.sh`: testes desativados, para nunca reconfigurarem a compilação de
testes), `BUILD_TYPE=Debug` e o paralelismo da ferramenta de compilação nativa
(substituível com `JOBS=N`); as variáveis de ambiente
`CMAKE`, `CTEST`, `CMAKE_ARGS` e `CLANG_FORMAT` também substituem as
ferramentas/opções correspondentes.
`make-test.bat` configura com os testes ativados, compila todos os alvos e
depois corre o CTest, tal como `make test`, propagando as falhas de
configuração, compilação ou testes.
O clean remove os diretórios `build/` e `cmake-build*/` locais do repositório.

`make benchmark` e `make-benchmark.bat` executam a comparação manual de
desempenho com o Erlang/OTP do anfitrião (compilação Release em `build/bench`,
nunca faz parte dos testes); ver [benchmarks](validation.md#benchmarks).

`decompile-debug.bat <module>` e `decompile-release.bat <module>` recompilam
um ficheiro-fonte C++ (nome sem caminho nem extensão; acrescente diretórios
pais quando for ambíguo, por exemplo `ast/attributes`) com as suas flags Debug
ou Release registadas e escrevem `<module>.debug.asm` / `<module>.release.asm`
no diretório atual. Envolvem `tools/asm.py` (apenas compilações clang-cl), que
obtém o comando de compilação de `build/tool` e depois de `build/debug`
(`--build-dir` substitui-o). A saída mantém o código e os dados com
comentários das linhas de código-fonte e nomes desmanglados, sem diretivas de
informação de depuração, de desenrolamento e da tabela de símbolos.
`--function TEXT` mantém apenas as funções cujo nome desmanglado contém
`TEXT`, e `--raw` escreve a listagem sem filtro.

As verificações de qualidade e a formatação aplicam-se por omissão aos
ficheiros alterados: tudo o que difere de `HEAD` na árvore de trabalho, mais
os ficheiros não seguidos.

As ferramentas de qualidade vivem no ambiente ignorado `.venv-quality/`,
fixado por `tools/requirements-quality.txt`:
`python -m venv .venv-quality` e depois `.venv-quality/Scripts/python -m pip install -r tools/requirements-quality.txt`
(`.venv-quality/bin/python` fora do Windows).

- `cmake --build build/debug --target check-quality` corre o Lizard sobre os
  ficheiros C++ de produção alterados e o clang-tidy sobre as unidades de
  tradução alteradas mais as que incluem um cabeçalho alterado (a partir das
  dependências registadas pelo Ninja). Alterações a `.clang-tidy`, `cmake/` ou
  a `CMakeLists.txt` de produção, ou dados de dependências em falta, verificam
  todas as unidades de tradução. Defina `CLAUSE_QUALITY_BASE` (por exemplo
  `origin/master`) para comparar com outra base.
- `check-quality-all` (e `check-complexity-all`, `check-clang-tidy-all`)
  verificam todos os ficheiros.
- O clang-tidy corre em lotes de `4 x jobs` unidades de tradução e imprime uma
  linha passed/FAILED após cada um; todos os lotes correm e depois a
  verificação falha se algum tiver falhado. Para dividir uma execução longa em
  invocações separadas mais curtas, chame o script diretamente com um
  fragmento, por exemplo
  `cmake -DQUALITY_SCOPE=all -DQUALITY_BUILD_DIR=build/debug -DQUALITY_SHARD=1/4 -P cmake/CheckClangTidy.cmake`
  para o primeiro quarto (`QUALITY_BATCH` e `QUALITY_JOBS` substituem o
  tamanho do lote e os jobs; por omissão, os jobs são metade dos núcleos
  lógicos).
- `make format` / `make-format.bat` formatam os ficheiros C++ alterados;
  `make format-all` ou `FORMAT_SCOPE=all make-format.bat` formata tudo.

`clau.bat --help` compila primeiro e depois passa todos os argumentos ao
executável da configuração selecionada. As falhas de compilação interrompem a
execução; os caminhos de entrada do compilador continuam relativos ao
diretório de trabalho do chamador, e o seu código de saída é preservado.

Para desenvolver o runtime sem descarregar nem usar o SDK C++ do LLVM,
configure com `cmake --preset windows -DCLAUSE_BUILD_COMPILER=OFF`; aplicam-se
os mesmos presets de compilação/teste. Volte a definir a opção como `ON`
quando o SDK estiver disponível. O `cl` do MSVC também é aceite num diretório
de compilação separado; o MinGW não é suportado para compilações nativas de
desenvolvimento no Windows. Selecione x86 ou x64 através do ambiente de
desenvolvimento (ou `-A` com um gerador do Visual Studio) e use um SDK do LLVM
e um runtime dessa arquitetura.

O CRT por omissão no Windows é `/MDd` para Debug e `/MD` para as restantes
configurações, incluindo a biblioteca estática do runtime e os seus
consumidores. Uma definição explícita de `CMAKE_MSVC_RUNTIME_LIBRARY` é
preservada; tem de corresponder ao SDK do LLVM e a todas as bibliotecas C++
ligadas. Evite misturar artefactos STL/CRT de Debug e de Release.
Os códigos-fonte do projeto no Windows e as fixtures de CLI/caminhos usam
UTF-8.

Todos os alvos do projeto usam C++23 e tratam os avisos do compilador como
erros. O executável é `build/debug/bin/clau`. Os presets e os wrappers de
compilação pedem compilações paralelas no Windows, Linux e macOS com o número
de jobs por omissão da ferramenta de compilação nativa (`jobs: 0` nos presets,
`--parallel` nos wrappers). Defina um limite explícito com
`cmake --build --preset debug --parallel 8` ou `JOBS=8` para os wrappers.
Para um diretório de compilação sem preset, use
`cmake --build <dir> --parallel`.
O preset do Windows coloca o executável em
`build/windows/bin/<Config>/clau.exe` e o runtime em
`build/windows/lib/<Config>/clause_runtime.lib`.

Em alternativa, use `make build` para compilar apenas o `clau` e as suas
dependências em `build/tool`, ou `make test` para compilar e correr o conjunto completo de
testes. Para uma configuração diferente:

```sh
make test BUILD_DIR=build/release BUILD_TYPE=Release JOBS=4
```

O CMake descobre o Boost e o Erlang instalados, incluindo instalações do
Homebrew. Passe estas opções ao configurar para substituir os valores por
omissão:

| Opção | Finalidade |
|---|---|
| `-DCLAUSE_BOOST_ROOT=/path/to/boost` | Seleciona uma instalação do Boost ou uma árvore de código-fonte completa |
| `-DCLAUSE_TOML_ROOT=/path/to/tomlplusplus-3.4.0` | Seleciona a dependência TOML fixada |
| `-DCLAUSE_SQLITE_ROOT=/path/to/sqlite-amalgamation-3540000` | Seleciona a amalgamação SQLite fixada (cache de compilação) |
| `-DCLAUSE_OTP_AUDITS=ON` | Ativa as auditorias opcionais com OTP real/de referência; por omissão OFF |
| `-DCLAUSE_ESCRIPT=/path/to/bin/escript` | Seleciona o OTP 29+ para as auditorias opcionais; não usado pelos testes normais |
| `-DCLAUSE_CLANG_EXECUTABLE=C:/path/to/clang.exe` | Seleciona um executável do Clang instalado no Windows |
| `-DLLVM_DIR=/prefix/lib/cmake/llvm` | Seleciona um SDK do LLVM 23.1.x existente (caminhos explícitos inválidos falham) |
| `-DCLAUSE_DOWNLOAD_LLVM=OFF` | Exige um SDK instalado; desativa as transferências automáticas do LLVM |
| `-DBUILD_TESTING=ON` | Ativa os testes, os executáveis auxiliares e a sua dependência do Erlang (por omissão: OFF) |
| `-DCLAUSE_BUILD_COMPILER=OFF` | Compila apenas a biblioteca do runtime |
| `-DCLAUSE_BUILD_RUNTIME=OFF` | Compila apenas o compilador |

Para geradores multiconfiguração, acrescente `--config Debug` ao compilar e
`-C Debug` ao testar. Os IDEs compatíveis com CMake podem abrir o repositório
com o preset `debug`, ou com o preset `windows` com uma toolchain de
desenvolvimento do Visual Studio.

Os cabeçalhos do Boost e do toml++ usam includes `SYSTEM` do CMake, mantendo
os avisos como erros para o código do projeto. Nas compilações nativas em
macOS, o CMake também marca o diretório de include ligado do Homebrew como
`SYSTEM` quando os seus cabeçalhos do Boost correspondem à instalação
selecionada. Isto impede que flags herdadas como
`CXXFLAGS=-I/opt/homebrew/include` exponham avisos do Boost, incluindo quando
essa flag já está em cache no CMake.
Para outras instalações, evite acrescentar caminhos de dependências através de
flags `-I` globais (incluindo `CXXFLAGS`): um caminho de include comum pode ter
precedência sobre o caminho de sistema de uma dependência. Se o CLion indicar
avisos do Boost como erros, remova essas flags globais e limpe o valor em
cache, por exemplo:

```sh
cmake -S . -B cmake-build-debug -DCMAKE_CXX_FLAGS:STRING=
```

Depois, recarregue o CMake no CLion. Use as opções de raiz de dependências
acima para selecionar instalações em vez de acrescentar flags de include
globais.
