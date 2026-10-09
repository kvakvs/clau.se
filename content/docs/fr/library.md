---
source: docs/library.md
sourceCommit: 06042fa
sourceSha256: 8f2e8537bf42e4f4e23eff414105ee6bb25929992d881da864e86e3eee56eb56
translatedAt: 2026-10-09
---
# Modules de bibliothèque

Plan 11 step 39 (2026-10-07) : un sous-ensemble des modules `lists` et `maps`
d'OTP appartenant au projet, écrit en Erlang d'après le comportement documenté
d'OTP (et non copié depuis les sources d'OTP) et compilé avec les programmes
qui l'utilisent.

## Contenu

| Module | Fonctions |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1` |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1` |
| [`file`](../library/stdlib/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` au-dessus du pilote de fichiers ([fichiers](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (serveur d'entrée standard ou fichier ouvert) ; `format/1,2` et `put_chars/1` sont des builtins du runtime |
| [`gen_tcp`](../library/stdlib/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` au-dessus des ports socket ([sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/stdlib/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/stdlib/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/stdlib/clause_socket.erl) | Propre à Clause : le protocole du pilote de sockets partagé par les trois modules ci-dessus |
| [`os`](../library/stdlib/os.erl) | `cmd/1` au-dessus d'un port ([sous-processus](ports.md#subprocesses)) ; `type/0` et `getenv/1` sont des builtins du runtime |

Les résultats et les raisons d'erreur correspondent à OTP 29, y compris les
formes d'erreur des implémentations Erlang d'OTP (`lists:map(F, x)` donne
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`,
`lists:seq(1, 10, 0)` `badarg`) et de ses BIF (`lists:member/2`,
`lists:keyfind/3`, `lists:reverse/2`, les fonctions `maps` : `badarg`,
`{badmap, M}`, `{badkey, K}`). `lists:member/2` compare avec `=:=`,
`lists:keyfind/3` avec `==`. `lists:sort/1` est un tri par fusion stable. Les
traces de pile nomment les fonctions de la bibliothèque, pas celles d'OTP.

## Comment les programmes les obtiennent

- Lorsqu'un lot (entrées positionnelles ou une cible de projet) nomme un
  module avec un atome littéral — `M:F(...)` avec `M` littéral, `fun M:F/A`,
  ou `apply(M, F, Args)` avec `M` littéral — qu'aucune entrée ne définit, et
  que `<library>/M.erl` existe, le compilateur analyse et compile ce fichier
  dans le lot, puis recommence pour les modules que les fichiers ajoutés
  nomment. Un appel `M:F(...)` d'un builtin du catalogue (`io:format/2`,
  `os:type/0`) ne nomme aucun module.
- `<library>` est `library/stdlib` de l'arborescence de build, trouvé
  relativement à `clau` comme l'archive du runtime.
- Un module du lot portant le même nom remplace le module de bibliothèque.
- Les modules de bibliothèque sont des modules ordinaires du lot : ils sont
  liés dans les exécutables et, pour une sortie objet ou IR, produisent leurs
  propres artefacts.
- Un module atteint uniquement par des noms d'exécution (`M:F(...)` avec `M`
  une variable) n'est pas ajouté : un tel appel lève `undef` à moins que
  quelque chose d'autre ne nomme le module.
- Les fonctions de bibliothèque sont du code Erlang ; elles céderont donc la
  main comme le reste du code une fois l'ordonnanceur en place.
