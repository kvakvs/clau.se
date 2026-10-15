---
source: docs/library.md
sourceCommit: 6ed3851c
sourceSha256: 827659aa3cf1548562f97b6e8d7a37e0f230599570a6c78628cd7a72896102f9
translatedAt: 2026-10-15
---
# Modules de bibliothèque

Un sous-ensemble des modules `lists` et `maps` d'OTP appartenant au projet,
écrit en Erlang d'après le comportement documenté d'OTP (et non copié depuis
les sources d'OTP) et compilé avec les programmes qui l'utilisent.

## Contenu

| Module | Fonctions |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1`, `foreach/2`, `mapfoldl/3`, `mapfoldr/3`, `partition/2`, `splitwith/2` ; builtins du runtime `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`, `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2`, `keymember/3`, `keysearch/3`, `keydelete/3` ([module lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1`, `filter/2`, `map/2`, `foreach/2`, `update_with/3,4` ; builtins du runtime `get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`, `without/2`, `from_keys/2` ([module maps](builtins.md#maps-module)) |
| [`file`](../library/kernel/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2,3`, `read_file_info/1,2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` au-dessus du pilote de fichiers ([fichiers](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (serveur d'entrée standard ou fichier ouvert), `request/1,2`, `requests/1,2` (protocole d'E/S d'OTP, [fichiers](ports.md#standard-io-and-files)) ; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` et `nl/0,1` sont des builtins du runtime ([io](io.md)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` au-dessus des ports socket ([sockets](ports.md#sockets-57f)) |
| [`gen_udp`](../library/kernel/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/kernel/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Propre à Clause : le protocole du pilote de sockets partagé par les trois modules ci-dessus |
| [`erlang`](../library/erts/erlang.erl) | Bouchons générés de chaque export `erlang` d'OTP 29 ; les builtins remplacent les leurs, `nif_error/1,2` ont un corps, les autres lèvent `{not_implemented, F, A}` lorsqu'ils sont appelés ([module erlang](builtins.md#erlang-module)) |
| [`binary`](../library/stdlib/binary.erl) | Chaque fonction d'OTP 29 : `replace/3,4` et `list_to_bin/1` en Erlang, les autres builtins du runtime ([module binary](builtins.md#binary-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Conversions, `bin_is_7bit/1` et marques d'ordre des octets sous forme de builtins du runtime ([module unicode](builtins.md#unicode-module)) ; la normalisation et les propriétés sont des bouchons |
| [`math`](../library/stdlib/math.erl) | Chaque fonction d'OTP 29 sous forme de builtin du runtime ([module math](builtins.md#math-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Chaque fonction d'OTP 29 sous forme de builtin du runtime ([termes persistants](builtins.md#persistent-terms)) |
| [`code`](../library/kernel/code.erl) | Requêtes sur les modules chargés sous forme de builtins du runtime, sans serveur de code ([module code](builtins.md#code-module)) ; les chemins et le chargement sont des bouchons |
| [`os`](../library/kernel/os.erl) | `cmd/1` au-dessus d'un port ([sous-processus](ports.md#subprocesses)), `timestamp/0`, `system_time/0,1`, `perf_counter/0,1`, `getenv/2` ; `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0` et `version/0` sont des builtins du runtime |

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
  `apply(M, F, Args)` avec `M` littéral, `-behaviour(M)` ou
  `-import(M, ...)` — qu'aucune entrée ne définit, le compilateur cherche
  `M.erl` dans les répertoires d'applications de la bibliothèque, puis dans les
  `source_search_paths` du projet
  ([projets](projects.md#paths-and-discovery)), analyse et compile le premier
  trouvé dans le lot, puis recommence pour les modules que les fichiers
  ajoutés nomment
  ([à quel module un nom se résout](#which-module-a-name-resolves-to)). Un
  appel `M:F(...)` d'un builtin du catalogue (`io:format/2`, `os:type/0`) ne
  nomme aucun module.
- La bibliothèque est `library/` de l'arborescence de build, trouvée
  relativement à `clau` comme l'archive du runtime, avec un répertoire par
  application OTP (`erts`, `kernel`, `stdlib`).
- Un module du lot portant le même nom remplace le module de bibliothèque,
  avec un avertissement.
- Les modules de bibliothèque sont des modules ordinaires du lot : ils sont
  liés dans les exécutables et, pour une sortie objet ou IR, produisent leurs
  propres artefacts.
- Un module atteint uniquement par des noms d'exécution (`M:F(...)` avec `M`
  une variable) n'est pas ajouté : un tel appel lève `undef` à moins que
  quelque chose d'autre ne nomme le module.
- Les fonctions de bibliothèque sont du code Erlang ; elles céderont donc la
  main comme le reste du code une fois l'ordonnanceur en place.

## Remplacements des modules du runtime

Le plan 11 step 41I (2026-10-12) décide comment Clause remplace les modules
d'OTP qu'ERTS implémente en C (NIF, BIF, pilotes de ports, les modules
préchargés de `erts/preloaded/src`) et les modules qu'OTP génère pendant son
build (`unicode_util`). Les `kernel` et `stdlib` d'OTP sont de l'Erlang
ordinaire, mais appellent ces modules ; les steps 41J et suivants
implémentent ce contrat.

### Fourni ou absent

Tout ce qui a besoin du runtime et ne peut pas être écrit en Erlang ordinaire
est décidé par module, et par groupe de fonctions lorsqu'un module mélange
plusieurs préoccupations :

- **Fourni :** Clause livre le module avec la liste d'exports exacte d'OTP 29.
  Chaque fonction a l'un de quatre statuts : `implemented` (un builtin du
  runtime ou un corps Erlang au-dessus de services existants du runtime),
  `refused` (renvoie ou lève ce que les appelants d'OTP gèrent déjà lorsqu'une
  fonctionnalité est absente, comme `{error, enotsup}`), `stub` (lève
  `error({not_implemented, F, A})` avec `M:F/A` au sommet de la pile, comme le
  font les [bouchons d'`erlang`](builtins.md#erlang-module) ; pas encore fait ;
  orientation de l'utilisateur du 2026-10-12), ou `declined` (un bouchon qui
  reste, avec une raison comme la distribution ou le chargement de code en
  attente du plan step 71). Un module commence avec toutes ses fonctions en
  bouchons, de sorte qu'il est découvrable et que ses appelants compilent ;
  les groupes passent ensuite à leur statut décidé.
- **Absent :** Clause ne livre aucun module, peut-être pour toujours, et
  consigne pourquoi et quels modules Clause de plus haut niveau prennent la
  place de ses appelants. Les couches bas niveau `prim_*` de fichiers et de
  sockets en sont le cas typique : les programmes utilisent à la place les
  `file`, `gen_tcp`, `gen_udp` et `inet` de Clause, et comme les modules de
  Clause l'emportent sur ceux d'OTP (ci-dessous), les appelants d'OTP d'un
  module absent n'entrent jamais dans un lot. Un module absent n'obtient
  jamais de bouchon, de sorte qu'une référence à celui-ci est une erreur de
  compilation, jamais une surprise à l'exécution.

Les fonctions triviales pour le runtime sont implémentées sans décision
séparée.

### À quel module un nom se résout

OTP est optionnel sur la machine de l'utilisateur ; lorsqu'il est présent, il
ne doit pas changer ce qu'un build compile. Un nom de module se résout dans
cet ordre :

1. **Entrées explicites :** les sources que l'utilisateur liste (`sources`,
   `source_dirs`, entrées positionnelles). Une entrée qui porte le nom d'un
   module Clause le remplace, avec un avertissement nommant les deux fichiers.
2. **Modules Clause :** les modules de bibliothèque, remplacements fournis
   compris.
3. **`source_search_paths`**, comme décrit dans
   [projets](projects.md#paths-and-discovery).

Le nom d'un module absent est réservé : un fichier du même nom sur un chemin
de recherche (par exemple `erts/preloaded/src/prim_file.erl` d'OTP) n'est pas
utilisé, et le diagnostic indique que Clause ne fournit pas le module. Une
entrée explicite peut tout de même le fournir, avec l'avertissement de
remplacement.

`ignore_modules` s'applique aussi aux modules Clause : un module Clause ignoré
est absent du lot, et une entrée explicite peut alors le fournir sans
avertissement, puisque rien n'est remplacé.

### Fichiers

- Les modules de bibliothèque vivent dans `library/<application>/`, nommé
  d'après l'application OTP qui possède le module dans OTP : `erts`
  (équivalents des modules préchargés et `erlang`), `kernel` (`file`,
  `gen_tcp`, `gen_udp`, `inet`, `os`, et le `clause_socket` propre à Clause),
  `stdlib` (`binary`, `lists`, `maps`, `math`, `io`, `unicode`,
  `unicode_util`). La recherche dans la bibliothèque parcourt chaque
  répertoire d'application ; un nom de module existe dans au plus l'un d'eux.
- `library/modules.terms` liste chaque module sur lequel Clause statue :
  `{Module, Application, provided}.` ou
  `{Module, Application, missing, "reason"}.` Le compilateur le lit pour savoir
  quels noms sont des modules Clause et lesquels sont réservés.
- Chaque module fourni a un inventaire `<module>.terms` à côté de lui :
  `{Name, Arity, Group, Status}.` par export d'OTP 29, trié par nom et arité,
  où `Group` nomme le groupe de décision (par exemple `stdlib`,
  `distribution`, `beam`). `erlang.terms` garde son propre format
  (`{Name, Arity, Flags, Status}`, [module erlang](builtins.md#erlang-module)).
- Les listes d'exports sont observées sur un OTP 29 de l'hôte
  (`M:module_info(exports)`) ; aucune source d'OTP n'est copiée. Les résultats
  et les termes d'erreur des fonctions implémentées correspondent à OTP 29 ;
  les différences délibérées vont dans [différences](differences.md).
- Chaque module de bibliothèque de Clause exporte la liste complète d'OTP 29
  pour son nom, de sorte que le code OTP compilé contre lui trouve chaque
  fonction ; les `lists`, `maps`, `file`, `io`, `os`, `gen_tcp`, `gen_udp` et
  `inet` propres à Clause reçoivent aussi des inventaires et des bouchons pour
  ce qu'ils n'implémentent pas encore.

### Types

Comme les modules de Clause l'emportent sur ceux d'OTP, le code OTP qui nomme
`file:filename()` ou `erlang:time_unit()` dans ses specs doit trouver ces types
dans les modules de Clause. Chaque module fourni dont l'équivalent OTP exporte
des types inclut `<module>.types.hrl` depuis son propre répertoire : la liste
`-export_type`, puis les types exportés et les types locaux et records qu'ils
utilisent, tels qu'OTP les définit (la documentation montre les mêmes
définitions ; la documentation installée ne contient aucune définition de type,
elles proviennent donc de l'implémentation : les informations de débogage du
beam, ou le source livré d'un module préchargé comme `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` écrit
l'en-tête à partir de l'OTP de l'hôte, et `--check` compare ses formes avec une
observation fraîche (CTest `library_freshness`) ; `library_modules.py check`
exige que chaque en-tête soit inclus par son module. Les types que les
en-têtes nomment depuis des modules extérieurs au programme
(`unicode:chardata()`, `calendar:datetime()`) et les larges unions d'OTP
(`file:posix()` a plus de membres que le graphe de types n'en garde) se
résolvent en `term()` sans avertissement : les diagnostics relèvent de la
bibliothèque de Clause, pas du programme de l'utilisateur.

### Services du kernel au démarrage

Les `file`, `io`, `code` et `logger` d'OTP appellent des serveurs enregistrés
(`file_server_2`, `code_server`, le serveur d'E/S d'un group leader, `logger`)
que l'application `kernel` démarre au boot. Un exécutable Clause n'en démarre
aucun et, comme décidé le 2026-10-12, continue de n'en démarrer aucun pour
l'instant : les `file` et `io` propres à Clause n'ont besoin d'aucun serveur,
et un module OTP qui en a besoin échoue comme il échoue sous OTP sans ce
serveur (`noproc`). Coût : le code OTP qui journalise via `logger` ou appelle
`code` à l'exécution ne fonctionne pas tant qu'une entrée ultérieure du
registre ne choisit pas un ensemble minimal de services pour l'objet de
démarrage. Démarrer toute l'application `kernel` n'est pas prévu.

### Registre

Le projet luerl pilote ce travail. Après chaque step, exécuter

```text
clau.bat --project test-luerl --entry luerl:init
```

classer chaque erreur (`unknown module`, `undefined function M:F/A`, syntaxe
ou fonctionnalité non prise en charge, autre), et affecter chacune à un step
de la phase H3 du plan 11, à un autre élément du backlog ou à un refus
consigné. Avec la sortie d'erreur de l'exécution enregistrée dans un fichier,
`python tests/compiler/library/library_modules.py report FILE` affiche la
classification sous forme de tableaux : chaque module inconnu avec son nombre
d'erreurs, les modules appelants et les fonctions appelées avec leurs arités ;
les fonctions non définies par module ; les autres messages avec leurs
nombres.

### Outils

Tous se trouvent dans `tests/compiler/library/` :

- `escript observe_module.escript LIBRARY APP MODULE` écrit
  `LIBRARY/APP/MODULE.terms` à partir de `MODULE:module_info(exports)` de
  l'OTP de l'hôte, en conservant le groupe et le statut de chaque entrée déjà
  présente ; un nouvel export commence sous la forme
  `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` écrit le fichier du
  module une fois, chaque export étant un bouchon ; ensuite, le fichier est
  édité à la main.
- `python library_modules.py check ROOT` (CTest `library_inventory`, sans OTP)
  signale chaque désaccord : un module fourni sans ses fichiers, un module
  absent avec un fichier, un inventaire non listé comme fourni, un export
  absent de l'inventaire ou l'inverse, une entrée `stub`/`declined` qui n'est
  pas un bouchon levant `undef`, une entrée `implemented`/`refused` sans corps
  ni builtin du catalogue. `library_rejects` le démontre sur une bibliothèque
  de fixtures délibérément incohérente.
- Le test CTest `library_freshness` (étiquette `host_otp`) observe à nouveau
  chaque inventaire et exige qu'il soit inchangé, puis observe, génère,
  vérifie et compile un nouveau module de bout en bout. `library_report`
  exécute `clau` sur un programme de fixture et vérifie les lignes du rapport.

| Module | Décision (2026-10-12) | Raison ou step du plan |
| --- | --- | --- |
| `init` | fourni ; implémenté sauf `boot/1`, `restart/0,1` et `make_permanent/2`, refusés | réponses sur les arguments et l'état d'un système démarré (41L, [module init](builtins.md#init-module)) |
| `persistent_term` | fourni, uniquement des bouchons | table de termes à l'échelle du runtime (41M) |
| `erts_internal` | fourni ; groupes `stdlib` et `counters` implémentés, `get_creation/0` et `map_hashmap_children/1` refusés, groupes `distribution`, `beam` et `emulator` déclinés | 41N ([erts_internal](builtins.md#erts-internal)) ; pas de distribution, pas de fichiers `.beam` |
| `atomics`, `counters`, `erts_code_purger` | fournis ; `atomics`, `counters` implémentés ; `purge/1`, `soft_purge/1` implémentés, le processus de purge décliné | 41N ([atomics et counters](builtins.md#atomics-and-counters)) ; le chargement de code attend le step 71 |
| `unicode_util` | fourni, implémenté (41O1, 41O2) | tables générées à partir des réponses d'OTP et des données Unicode ([unicode_util](builtins.md#unicode-util)) |
| `erl_prim_loader` | fourni ; requêtes de fichiers implémentées au-dessus de `file`, chargement et archives déclinés | 41P ([fichiers](ports.md#standard-io-and-files)) ; le chargement de code attend le step 71 |
| `zlib` | fourni, implémenté au-dessus de la zlib épinglée (41Q) | les flux sont des références handle ([module zlib](builtins.md#zlib-module)) |
| `prim_eval` | fourni, implémenté (41S) | `'receive'/2` au-dessus des étapes d'un receive compilé ([prim eval](builtins.md#prim-eval)) |
| `application_controller` | fourni, uniquement des bouchons | masque celui d'OTP, qui appelle `prim_file` (luerl le nomme via `application` d'OTP) |
| `lists`, `maps`, `io`, `file`, `os`, `gen_tcp`, `gen_udp`, `inet` | fournis, listes d'exports complètes d'OTP 29 ; ce que Clause avait reste implémenté, le reste en bouchons | s'étendent selon les demandes du registre |
| `re` | fourni ; implémenté (41ZA, 41ZB) sauf `import/1`, décliné | au-dessus de la PCRE2 épinglée ([module re](builtins.md#re-module)) ; Clause n'exporte aucun motif |
| `prim_file`, `prim_buffer` | absents, décidé en 41P | le `file` de Clause est la couche fichiers ; `filelib`/`filename` d'OTP s'exécutent dessus |
| `prim_socket`, `prim_net`, `prim_inet`, `socket_registry`, `socket`, `net` | absents, décidé en 41R | les `gen_tcp`, `gen_udp`, `inet` de Clause sont la couche réseau ; `gen_tcp_socket`, `gen_udp_socket`, `inet_tcp`, `inet_udp` d'OTP ne sont atteints que depuis les modules masqués d'OTP ([sockets](ports.md#sockets-57f)) |

Dernière couche luerl (2026-10-12, après les steps 41K1 et 41K2, avec
`NEW_STACKTRACE` défini comme le fait le `rebar.config.script` de luerl sous
OTP 21 et ultérieur, et `inet` ne figurant plus dans `ignore_modules`) : la
cible compile et se lie sans erreur. Il reste 83 avertissements : 74 types des
`erl_parse` et `compile` ignorés, 8 types de modules OTP extérieurs au
programme nommés par du code OTP que la cible compile, un élargissement du
graphe de types par budget dans ce code. L'exécutable démarre `luerl:init/0`
et termine avec le code 0. La couche suivante est le comportement à
l'exécution : quels bouchons luerl atteint lorsqu'il exécute du code Lua.

Couche d'exécution (2026-10-14, après les phases H3–H5) : un pilote qui
exécute 35 extraits Lua via `luerl:do` se compile avec 17 avertissements et
affiche la sortie d'OTP 29 pour 34 d'entre eux, `os.date` compris. Le dernier,
un `goto`, échoue avec le `function_clause` d'OTP ; seuls ses cadres de pile
diffèrent, sans arguments ni emplacements ([différences](differences.md)).
