---
source: docs/debugging.md
sourceCommit: 6ed3851c
sourceSha256: 18d5fe2775a7c01edb18031b8f1ba632b356d04159c88b31692d1cc3d9ccf9da
translatedAt: 2026-10-15
---
# Déboguer les exécutables

`-g` émet des tables de lignes du source Erlang (backlog F30). Elles
fonctionnent à tous les niveaux d'optimisation et avec `--emit`, l'édition de
liens positionnelle `-o` et les cibles de projet.

## Tables de lignes

- Chaque fonction générée et chaque fun anonyme reçoit une portée de débogage
  nommée d'après son nom Erlang (`leaf`, `-main/1-fun-0-`), dans le fichier
  qui la déclare, de sorte qu'une fonction provenant d'un `.hrl` inclus
  appartient à ce fichier. Elle n'a pas de nom de liaison (linkage name) : GDB
  afficherait sinon le symbole natif (`clausev1_...`).
- Chaque expression est située à sa ligne physique du source. Le code dans
  lequel une macro se développe est situé à l'invocation de la macro ; le code
  inclus à sa ligne dans le fichier inclus.
- Aucune variable ni aucun type n'est décrit, langage `DW_LANG_lo_user`.
  L'unité de compilation est tout de même `FullDebug` : LLVM omet du DWARF les
  portées de fonctions d'une unité `LineTablesOnly` sauf si quelque chose a été
  inliné, et les débogueurs nomment alors les cadres par symbole.
- Format : CodeView pour les cibles MSVC, DWARF 5 ailleurs. Sans `-g`, les
  objets ne portent aucune table de lignes (l'inspection de l'IR et
  `--emit llvm-ir` gardent tout de même les emplacements dont leurs
  commentaires de source ont besoin).

## Édition de liens

`-g` passe `-g` au pilote Clang. Les cibles MSVC écrivent aussi un PDB que
l'exécutable nomme par son seul nom de fichier (`/PDBALTPATH:%_PDB%`) ; il est
publié à côté de l'exécutable sous le nom `<name>.pdb`, après l'exécutable,
dans la même publication différée. Les exécutables ELF gardent le DWARF en
interne. Les exécutables Mach-O nécessiteraient `dsymutil` sur les objets
préparés avant la suppression du répertoire de préparation ; ce n'est pas
encore fait, donc les exécutables macOS perdent leurs tables de lignes à
l'édition de liens (une lacune jusqu'au
[step 66](../.agents/11-plan.md#step-66)).

## Pile d'appels Erlang

Le code généré passe d'une fonction à l'autre par des transferts terminaux via
la pile du processus ([modèle d'exécution](execution-model.md)), de sorte
qu'une trace de pile native montre la fonction Erlang courante puis
l'ordonnanceur (`ProcessStack::run`, `Executor::work`). Les cadres Erlang du
processus arrêté sont affichés par la fonction d'aide du runtime
`clause::runtime::debug_erlang_stack()`, le plus interne en premier, sous la
forme `module:function/arity` ; elle lit le processus en cours d'exécution du
thread et les noms compilés des cadres, jamais les tables d'atomes du runtime :

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

GDB écrit l'appel `call clause::runtime::debug_erlang_stack()` après
`set language c++` (les cadres du code Erlang n'ont pas de langage dans lequel
GDB analyse les noms C++). Il nomme les cadres
`twice () at /path/debug.hrl:5`. Les exécutables `-Os` peuvent supprimer la
fonction d'aide avec le reste du code non référencé.

## Tests

- `linking_debug_info` : métadonnées de l'IR (fichiers et lignes des
  sous-programmes, une macro située dans le fichier inclus) et sections de
  tables de lignes des objets pour Windows x86-64 et x86, Linux x86-64,
  AArch64 et ARMv7 et macOS arm64 en O0/O2, et aucune sans `-g`.
- `linking_debugger` : lie la fixture avec `-g` en O0/O2 (et un PDB à côté
  sous Windows), puis pilote LLDB (celui de l'installation LLVM sous Windows)
  ou GDB : les points d'arrêt dans `debug.hrl` et `debug.erl` s'arrêtent dans
  `twice` et `leaf`, et la fonction d'aide affiche leurs piles Erlang. Un
  débogueur qui ne démarre pas (le LLDB d'une release LLVM sans sa
  bibliothèque Python) est ignoré ; code de sortie 77 (ignoré) lorsqu'il n'en
  existe aucun. Validé avec LLDB sous Windows x64 et GDB 16 sous Linux x86-64.
