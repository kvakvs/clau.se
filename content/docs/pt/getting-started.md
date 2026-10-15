---
source: docs/getting-started.md
sourceCommit: 6ed3851c
sourceSha256: 95b73af25f3b08912c8b7f38fe46edf93a90187b3df3c13291d19a90411c29b1
translatedAt: 2026-10-15
---
# Primeiros passos

Requisitos:

- CMake 3.28+ e um compilador com suporte de C++23.
- No Windows, um executável do Clang instalado no `PATH` ou em
  `Program Files/LLVM/bin`; a configuração falha de imediato se não existir
  ou não puder ser executado.
- SDK C++ do LLVM 23.1.x (>=23.1.1) para compilar o compilador. O CMake
  prefere uma instalação global e, se não existir, descarrega o SDK fixado
  23.1.2 para `thirdparty/`; ver
  [configuração do SDK e contrato de compilação](compile.md).
- Boost 1.90+ com Boost.Multiprecision para o compilador e o runtime; o
  compilador também requer Boost.Parser. O Multiprecision é apenas de
  cabeçalhos e não precisa de nenhuma biblioteca binária do Boost.
- toml++ 3.4.0 para os manifestos de projeto; ver
  [configuração da dependência](projects.md#build-dependency).
- As compilações e os testes normais não requerem Erlang/OTP. Os testes usam
  [fixtures golden próprias do projeto](../tests/fixtures/patternmatch/generated/README.md).
  As auditorias opcionais em direto e a regeneração explícita de fixtures
  requerem Erlang/OTP 29+.

Em macOS:

```sh
xcode-select --install
brew install cmake boost erlang tomlplusplus llvm@23
```

No Windows, instale o LLVM/Clang globalmente para as ferramentas de
compilação do anfitrião. Instale o workload **Desktop development with C++**
do Visual Studio e um Windows SDK, bem como o Ninja. Use uma linha de comandos
**x64 Native Tools** ou uma Developer PowerShell configurada para x64, com
`clang-cl`, `cmake` e `ninja` no `PATH`.
O CMake verifica a ABI do MSVC, a ligação ao Windows SDK e o suporte de
`std::expected` do C++23. As ferramentas de linha de comandos do LLVM, por si
só, não fornecem o SDK C++ necessário; o CMake descarrega-o separadamente
quando `LLVMConfig.cmake` e as bibliotecas correspondentes não existem.

O CMake descarrega o Boost 1.90.0 e o toml++ 3.4.0 para o diretório ignorado
`thirdparty/` na primeira utilização, verifica as suas somas de controlo
SHA-256 e guarda tanto os arquivos como os códigos-fonte extraídos. As
configurações seguintes, incluindo diretórios de compilação novos, reutilizam
esses ficheiros sem acesso à rede. Remover `build/` não remove as
dependências. Quando a própria pilha TLS do CMake não consegue verificar
certificados (por exemplo, o CMake incluído no Strawberry Perl), as
transferências são repetidas com o `curl` do anfitrião e continuam a ser
verificadas. As compilações só do runtime descarregam apenas o Boost. As
raízes de dependências explícitas abaixo têm precedência e permitem uma
configuração offline; uma raiz explícita inválida falha sem descarregar.
O Linux e o macOS continuam a usar as dependências instaladas ou os
códigos-fonte locais em `thirdparty/`. As transferências de recurso do SDK do
LLVM aplicam-se nas **três plataformas**, com arquivos oficiais fixados por
SHA-256 para Windows x64/ARM64, Linux x64/ARM64 e macOS ARM64. Os arquivos e
os SDKs extraídos ficam em `thirdparty/` para reutilização offline. Outras
arquiteturas de anfitrião e compilações cruzadas requerem um `LLVM_DIR`
explícito correspondente.

Para compilar o compilador, as dependências zlib e zstd do LLVM são detetadas
a partir das bibliotecas instaladas. No Windows, a falta das bibliotecas
desencadeia transferências verificadas por SHA-256 do zlib 1.3.2 e do zstd
1.5.7, seguidas de compilações estáticas Debug/Release em `thirdparty/`. Estas
compilações são reutilizadas entre diretórios de compilação e correspondem ao
compilador, à arquitetura e ao CRT do anfitrião. Defina `ZLIB_ROOT` ou
`zstd_ROOT` para preferir uma biblioteca instalada; `CLAUSE_DOWNLOAD_ZLIB=OFF`
e `CLAUSE_DOWNLOAD_ZSTD=OFF` desativam as respetivas alternativas de recurso.
A descoberta do SDK do MSVC rejeita bibliotecas MinGW `.a` em cache, como as
incluídas no Strawberry Perl. O Linux e o macOS usam os pacotes de
desenvolvimento instalados.
