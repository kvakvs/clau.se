---
source: docs/library.md
sourceCommit: 336caea7
sourceSha256: 0fc98265c5256c76cd34c89f89a48993e3452732ca40c3a295860a34bee27186
translatedAt: 2026-10-18
---
# Modules de bibliothèque

Clause livre ses propres versions des modules d'OTP qu'appellent les
programmes, écrites en Erlang d'après le comportement documenté d'OTP (et non
copiées depuis les sources d'OTP) au-dessus des [builtins](builtins.md) du
runtime, et les compile avec les programmes qui les utilisent.

## Contenu

Chaque module fourni exporte la liste complète d'OTP 29 pour son nom ; son
inventaire `<module>.terms` ([fichiers](#files)) consigne quelles fonctions
sont implémentées et lesquelles sont des bouchons (stubs).

| Module | Contenu |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | Les fonctions courantes ; les fonctions sur les données comme `sublist/2,3`, `flatten/1,2`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2` sont des builtins du runtime ; chaque fonction documentée est implémentée ([module lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Chaque fonction documentée ; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... sont des builtins du runtime, les fonctions prenant des funs sont en Erlang ([module maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Chaque fonction documentée ; les parcours de listes sont des builtins du runtime, les fonctions prenant des funs sont en Erlang ([collections](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Chaque fonction documentée ; l'arithmétique grégorienne sous forme de builtins du runtime, l'heure locale et RFC 3339 en Erlang ([calendar](builtins.md#calendar)) |
| [`filename`](../library/stdlib/filename.erl) | Chaque fonction documentée selon les règles Unix et Windows d'OTP pour l'hôte ; les parcours de noms sont des builtins du runtime, `absname/1,2` et `basedir/2,3` (à partir de `HOME`, des variables XDG et d'`APPDATA`) en Erlang ([filename](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Chaque fonction documentée sous forme de builtin du runtime : analyse RFC 3986 avec les fragments d'erreur d'OTP, recomposition, normalisation, résolution, codage pourcent et requêtes form-urlencoded ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Chaque fonction documentée avec les iodata, les erreurs et l'ordre des rappels d'OTP ; `decode/1`, `encode/1`, `format/1,2` et les fonctions d'échappement de binaries sont des builtins du runtime, les encodeurs et formateurs prenant des funs et les décodeurs à rappels sont en Erlang ([encodages](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Chaque fonction documentée avec les états et séquences d'OTP ; les algorithmes d'OTP s'exécutent sous forme de builtins du runtime, les générateurs greffons en Erlang ([nombres aléatoires](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Chaque fonction documentée sous forme de builtin du runtime, parcourant chardata comme `string.erl` d'OTP pour conserver les formes de résultats d'OTP ([string](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Chaque fonction documentée sous forme de builtin du runtime ([encodages](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Chaque fonction documentée au-dessus du record d'OTP 29 ; les opérations sur le record sont des builtins du runtime, les folds et mapfolds sont en Erlang ([collections](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Chaque fonction documentée au-dessus des formes d'arbres et de files d'OTP ; les opérations sans funs sont des builtins du runtime ([collections](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Chaque fonction documentée au-dessus des records d'OTP (ensembles de version 1) et des maps (version 2) ; les opérations sans funs sont des builtins du runtime ([collections](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (serveur d'entrée standard ou fichier ouvert), `request/1,2`, `requests/1,2` (protocole d'E/S d'OTP, [fichiers](ports.md#standard-io-and-files)) ; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` et `nl/0,1` sont des builtins du runtime ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Fonctions d'écriture, vérifications, fonctions de collecte, moteur de formatage et affichage formaté (`print/1,4`, `~p`, `chars_limit`) sous forme de builtins du runtime avec les formes de listes imbriquées d'OTP ; `get_until`, `format_prompt` et `write/3` en Erlang ; `fread/2,3` en bouchons ([io_lib](builtins.md#io_lib)) |
| [`binary`](../library/stdlib/binary.erl) | Chaque fonction ; `replace/3,4` et `list_to_bin/1` en Erlang, les autres builtins du runtime ([module binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Chaque fonction sous forme de builtin du runtime ([module math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Chaque fonction sous forme de builtin du runtime : conversions, `bin_is_7bit/1`, marques d'ordre des octets, formes de normalisation, catégories et propriétés d'identifiants ([module unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Chaque fonction au-dessus de tables générées, les parcours de chardata sous forme de builtins du runtime ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Chaque fonction sauf `import/1`, au-dessus de PCRE2 ([module re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Ouvrir, lire, écrire, positionner et fermer des fichiers, lectures et écritures de fichiers entiers, informations sur les fichiers et opérations sur les répertoires au-dessus du pilote de fichiers ([fichiers](ports.md#standard-io-and-files)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl) | Sockets au-dessus des ports socket ([sockets](ports.md#sockets)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Propre à Clause : le protocole du pilote de sockets partagé par les trois modules ci-dessus |
| [`os`](../library/kernel/os.erl) | `cmd/1` au-dessus d'un port, requêtes d'environnement, d'heure et de version ([module maps](builtins.md#maps-module)) |
| [`code`](../library/kernel/code.erl) | Requêtes sur les modules chargés sans serveur de code ([module code](builtins.md#code-module)) ; les chemins et le chargement sont des bouchons |
| [`application_controller`](../library/kernel/application_controller.erl) | Uniquement des bouchons ; masque celui d'OTP, qui appelle `prim_file` (luerl l'atteint via `application` d'OTP) |
| [`erlang`](../library/erts/erlang.erl) | Bouchons générés de chaque export `erlang` d'OTP 29 ; les builtins du catalogue ont des corps de substitution, `nif_error/1,2` ont un corps, les autres lèvent `{not_implemented, F, A}` lorsqu'ils sont appelés ([module erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Les réponses d'un système démarré ; `boot/1`, `restart/0,1` et `make_permanent/2` refusés ([module init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Chaque fonction sous forme de builtin du runtime ([termes persistants](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Chaque fonction ([atomics et counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Ce qu'appellent `stdlib` et `kernel` ; groupes distribution, `.beam`, émulateur et processus de purge déclinés ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Requêtes de fichiers au-dessus de `file` ; chargement et archives déclinés ([fichiers](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Chaque fonction au-dessus de la zlib épinglée ([module zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` au-dessus des étapes d'un receive compilé ([prim eval](builtins.md#prim-eval)) |

Les résultats et les raisons d'erreur correspondent à OTP 29, y compris les
formes d'erreur des implémentations Erlang d'OTP (`lists:map(F, x)` donne
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`,
`lists:seq(1, 10, 0)` `badarg`) et de ses BIF (`lists:member/2`,
`lists:keyfind/3`, `lists:reverse/2`, les fonctions `maps` : `badarg`,
`{badmap, M}`, `{badkey, K}`). `lists:member/2` compare avec `=:=`,
`lists:keyfind/3` avec `==`. `lists:sort/1` est un tri par fusion stable dont
les passes alternent des séquences croissantes et décroissantes, de sorte
qu'aucune fusion n'inverse une séquence. Les traces de pile nomment les
fonctions de la bibliothèque, pas celles d'OTP.

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
  nomme aucun module. `--print-inputs` liste les entrées ainsi ajoutées.
- La bibliothèque est `library/` de l'arborescence de build, trouvée
  relativement à `clau` comme l'archive du runtime, avec un répertoire par
  application OTP (`erts`, `kernel`, `stdlib`).
- Un module du lot portant le même nom remplace le module de bibliothèque,
  avec un avertissement ; les builtins du catalogue de ce nom l'emportent
  toujours ([enregistrement](builtins.md#registration)).
- Les modules de bibliothèque sont des modules ordinaires du lot : ils sont
  liés dans les exécutables et, pour une sortie objet ou IR, produisent leurs
  propres artefacts. Ce sont du code Erlang, ils cèdent donc la main comme le
  reste du code.
- Un module atteint uniquement par des noms d'exécution (`M:F(...)` avec `M`
  une variable) n'est pas ajouté : un tel appel lève `undef` à moins que
  quelque chose d'autre ne nomme le module.

## Remplacements des modules du runtime

Clause remplace les modules d'OTP qu'ERTS implémente en C (NIF, BIF, pilotes
de ports, les modules préchargés de `erts/preloaded/src`) et les modules
qu'OTP génère pendant son build (`unicode_util`). Les `kernel` et `stdlib`
d'OTP sont de l'Erlang ordinaire, mais appellent ces modules.

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
  font les [bouchons d'`erlang`](builtins.md#erlang-module) ; pas encore
  fait), ou `declined` (un bouchon qui reste, avec une raison comme la
  distribution ou le chargement de code). Un module commence avec toutes ses
  fonctions en bouchons, de sorte qu'il est découvrable et que ses appelants
  compilent ; les groupes passent ensuite à leur statut décidé.
- **Corps de substitution des builtins :** une fonction implémentée par un
  builtin du catalogue conserve son export et le corps
  `F(_, ...) -> clause_builtin_placeholder.`, qui ne s'exécute jamais :
  l'enregistrement lie le builtin à sa place, et un appel qualifié `M:F(...)`
  est compilé vers le pont. Seul un appel non qualifié dans le module
  atteindrait ce corps, donc le module qualifie les appels à ses propres
  builtins ; `library_inventory` rejette un corps de substitution qui ne
  désigne aucun builtin du catalogue, un builtin du catalogue laissé en
  bouchon `not_implemented` et un appel non qualifié d'un corps de substitution.
- **Absent :** Clause ne livre aucun module, peut-être pour toujours, et
  consigne pourquoi et quels modules Clause de plus haut niveau prennent la
  place de ses appelants (`library/modules.terms`). Les couches bas niveau
  `prim_*` de fichiers et de sockets (`prim_file`, `prim_buffer`,
  `prim_socket`, `prim_net`, `prim_inet`, `socket_registry`) ainsi que
  `socket` et `net` sont les modules absents : les programmes utilisent à la
  place les `file`, `gen_tcp`, `gen_udp` et `inet` de Clause, et comme les
  modules de Clause l'emportent sur ceux d'OTP (ci-dessous), les appelants
  d'OTP d'un module absent (`gen_tcp_socket`, `inet_tcp`, ... d'OTP) n'entrent
  jamais dans un lot. Un module absent n'obtient jamais de bouchon, de sorte
  qu'une référence à celui-ci est une erreur de compilation, jamais une
  surprise à l'exécution.

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
  (équivalents des modules préchargés et `erlang`), `kernel`, `stdlib`. Les
  modules auxiliaires privés de Clause (`clause_socket`, `clause_re`,
  `clause_unicode`, `clause_zlib`, `clause_receive`, `clause_maps`, `clause_hashed`, `clause_array`) se
  trouvent à côté des modules qu'ils servent. La recherche dans la
  bibliothèque parcourt chaque répertoire d'application ; un nom de module
  existe dans au plus l'un d'eux.
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

### Fonctions documentées

`library/documented.terms` liste les fonctions publiques qu'OTP 29 documente
pour `erts`, `kernel` et `stdlib` : `{Module, Application, Name, Arity}.` par
fonction dont les documentations de module et de fonction ne sont pas masquées
et qui n'est pas obsolète, observée dans les blocs de documentation de l'OTP
de l'hôte par `tests/compiler/library/observe_docs.escript` (exécuté
explicitement). Les exports non documentés restent dans les inventaires mais
peuvent rester des bouchons.

- `library_inventory` vérifie que chaque fonction documentée d'un module fourni
  figure dans son inventaire et n'est pas un bouchon, sauf dans les modules que
  `library_modules.py` liste comme partiels avec l'étape du plan qui les achève.
- `python tests/compiler/library/library_modules.py coverage .` affiche les
  nombres de fonctions implémentées et documentées de chaque module documenté.

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
aucun : les `file` et `io` propres à Clause n'ont besoin d'aucun serveur, et un
module OTP qui en a besoin échoue comme il échoue sous OTP sans ce serveur
(`noproc`). Le code OTP qui journalise via `logger` ou appelle `code` à
l'exécution ne fonctionne donc pas. Démarrer toute l'application `kernel`
n'est pas prévu.

### Registre

Le plan du projet programme chaque module documenté de `erts`, `kernel` et
`stdlib` ; les programmes réels (luerl en premier) fixent les priorités. Le compiler et l'exécuter, classer
chaque erreur (`unknown module`, `undefined function M:F/A`, syntaxe ou
fonctionnalité non prise en charge, autre), et affecter chacune à une étape du
plan, à un autre élément du backlog ou à un refus consigné. Avec la sortie
d'erreur de l'exécution enregistrée dans un fichier,
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
  pas un bouchon `not_implemented`, une entrée `implemented`/`refused` sans
  corps ni builtin du catalogue.
  `library_rejects` le démontre sur une bibliothèque de fixtures délibérément
  incohérente.
- Le test CTest `library_freshness` (étiquettes `host_otp`, `full_only`)
  observe à nouveau chaque inventaire et exige qu'il soit inchangé, puis
  observe, génère, vérifie et compile un nouveau module de bout en bout.
  `library_report` exécute `clau` sur un programme de fixture et vérifie les
  lignes du rapport.
