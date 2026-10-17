---
source: docs/debugging.md
sourceCommit: a8c3f8f6
sourceSha256: b93973504afffd4df57d0a39ac405818a080f79a56515e27f312fdcaec3e3e8b
translatedAt: 2026-10-17
---
# Depuração de executáveis

`-g` emite tabelas de linhas do código-fonte Erlang. Funcionam em todos os
níveis de otimização e com `--emit`, com a ligação posicional `-o` e com alvos
de projeto.

## Tabelas de linhas

- Cada função gerada e cada fun anónima recebe um âmbito de depuração com o
  seu nome Erlang (`leaf`, `-main/1-fun-0-`), no ficheiro que a declara, pelo
  que uma função de um `.hrl` incluído pertence a esse ficheiro. Não tem nome
  de ligação: o GDB mostraria em vez disso o símbolo nativo (`clausev1_...`).
- Cada expressão é localizada na sua linha física do código-fonte. O código em
  que uma macro se expande é localizado na invocação da macro; o código
  incluído, na sua linha no ficheiro incluído.
- Não são descritas variáveis nem tipos, linguagem `DW_LANG_lo_user`. Ainda
  assim, a unidade de compilação é `FullDebug`: o LLVM deixa fora do DWARF os
  âmbitos de funções de uma unidade `LineTablesOnly`, a menos que algo tenha
  sido feito inline, e os depuradores nomeiam então os frames pelo símbolo.
- Formato: CodeView para alvos MSVC, DWARF 5 nos restantes. Sem `-g`, os
  objetos não trazem tabelas de linhas (a inspeção da IR e `--emit llvm-ir`
  continuam a manter as localizações de que os seus comentários de
  código-fonte precisam).

## Ligação

`-g` passa `-g` ao driver do Clang. Os alvos MSVC também escrevem um PDB que o
executável nomeia apenas pelo nome do ficheiro (`/PDBALTPATH:%_PDB%`); é
publicado ao lado do executável como `<name>.pdb`, depois do executável, na
mesma publicação diferida. Os executáveis ELF mantêm o DWARF no seu interior.
Os executáveis Mach-O precisariam de `dsymutil` sobre os objetos preparados
antes de a preparação ser removida; isso não é feito, pelo que os executáveis
macOS perdem as tabelas de linhas na ligação.

## Pilha de chamadas Erlang

O código gerado passa de uma função para outra por transferências de cauda
através da pilha do processo ([modelo de execução](execution-model.md)), pelo
que um backtrace nativo mostra a função Erlang atual e depois o escalonador
(`ProcessStack::run`, `Executor::work`). Os frames Erlang do processo parado
são impressos pela função auxiliar do runtime
`clause::runtime::debug_erlang_stack()`, do mais interior para o mais
exterior, como `module:function/arity`; lê o processo em execução da thread e
os nomes compilados dos frames, nunca as tabelas de átomos do runtime:

```text
(lldb) breakpoint set --file debug.erl --line 8
(lldb) run
* thread #1, stop reason = breakpoint 1.1
    frame #0: debug.exe`leaf at debug.erl:8
(lldb) expr -- clause::runtime::debug_erlang_stack()
  debug:leaf/1
  debug:middle/1
  debug:main/1
```

No GDB, a chamada escreve-se `call clause::runtime::debug_erlang_stack()`
depois de `set language c++` (os frames de código Erlang não têm uma
linguagem na qual o GDB analise nomes C++). Nomeia os frames
`twice () at /path/debug.hrl:5`. Os executáveis `-Os` podem eliminar a função
auxiliar juntamente com outro código não referenciado.

## Testes

- `linking_debug_info`: metadados da IR (ficheiros e linhas dos subprogramas,
  uma macro localizada no ficheiro incluído) e secções de tabelas de linhas
  dos objetos para Windows x86-64 e x86, Linux x86-64, AArch64 e ARMv7 e
  macOS arm64 em O0/O2, e nenhuma sem `-g`.
- `linking_debugger`: liga a fixture com `-g` em O0/O2 (e um PDB ao lado em
  Windows) e depois conduz o LLDB (o da instalação do LLVM em Windows) ou o
  GDB: os breakpoints em `debug.hrl` e `debug.erl` param em `twice` e `leaf`,
  e a função auxiliar imprime as suas pilhas Erlang. Um depurador que não
  arranca (o LLDB de uma release do LLVM sem a sua biblioteca Python) é
  ignorado; código de saída 77 (saltado) quando não existe nenhum. Validado
  com o LLDB em Windows x64 e o GDB 16 em Linux x86-64.
