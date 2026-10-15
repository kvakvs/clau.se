---
source: docs/builtins.md
sourceCommit: 6ed3851c
sourceSha256: 35d165fa6e573a993a44f0a3284aa944f79954a0af62fd2b79e6b20fe728a9d9
translatedAt: 2026-10-15
---
# Builtins

Le pont de builtins de production. Les builtins sont des fonctions `erlang` que
le runtime implémente en C++. Le runtime les enregistre par module, fonction et
arité ; le code généré les atteint directement, par des appels dynamiques et
sous forme de valeurs fun.

## Quelles builtins existent

Le catalogue du pont `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) liste toutes les
builtins connues à la fois du compilateur et du runtime :

- les BIF de garde : tests de type (`is_atom/1` … `is_tuple/1`,
  `is_function/1,2`), `abs/1`, `bit_size/1`, `byte_size/1`, `ceil/1`,
  `element/2`, `float/1`, `floor/1`, `hd/1`, `length/1`, `map_get/2`,
  `map_size/1`, `is_map_key/2`, `max/2`, `min/2`, `round/1`, `size/1`, `tl/1`,
  `trunc/1`, `tuple_size/1`, `binary_part/2,3` ;
- les opérateurs en tant que fonctions : comparaisons, `not/1`, `and/2`,
  `or/2`, `xor/2`, opérateurs arithmétiques et bit à bit (`erlang:'+'/1,2` …) ;
- `display/1`, `halt/0,1`, `error/1,2,3`, `exit/1`, `throw/1`, `raise/3` et
  `function_exported/3` ;
- accès aux termes : `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` et les opérateurs de liste `'++'/2` et
  `'--'/2` (`A ++ B`, `A -- B` sont abaissés vers eux) ;
- conversions : `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` n'est pas retenu) ;
- sortie console : `io:format/1,2` et `io:put_chars/1`, les premières builtins
  d'un autre module ([io](io.md)) ; périphériques de sortie : `io:format/3`,
  `io:fwrite/1,2,3`, `io:put_chars/2`, `io:nl/0,1` ;
- les fonctions de données de `lists` ([module lists](#lists-module)) ;
- toutes les fonctions de `math` ([module math](#math-module)) ;
- le module `binary` ([module binary](#binary-module)) ;
- les requêtes d'environnement, de processus et de version de `os` et les BIF
  de `maps` ([module maps](#maps-module)) ;
- `persistent_term` ([termes persistants](#persistent-terms)) ;
- les conversions de `unicode` ([module unicode](#unicode-module)) ;
- les requêtes du module `code` sur les modules chargés
  ([module code](#code-module)) ;
- les réponses du module `init` sur la ligne de commande
  ([module init](#init-module)) ;
- `atomics`, `counters` et les fonctions de `erts_internal` qu'appelle stdlib
  ([atomics et compteurs](#atomics-and-counters),
  [erts_internal](#erts-internal)) ;
- les tables de `unicode_util` ([unicode_util](#unicode-util)) ;
- identités de processus : `self/0`, `make_ref/0`, `pid_to_list/1` et
  `ref_to_list/1` ([pids et références](terms.md#pids-and-references)) ;
- processus : `spawn/1,3` et `is_process_alive/1`
  ([processus](processes.md)) ; liens et signaux de sortie :
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([liens](processes.md#links)) ; moniteurs :
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([moniteurs](processes.md#monitors)) ; noms enregistrés :
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([noms enregistrés](processes.md#registered-names)) ;
- messages : `'!'/2` (l'opérateur `!`) et `send/2`
  ([messages](processes.md#messages)) ;
- le dictionnaire de processus : `put/2`, `get/0,1`, `get_keys/0,1`,
  `erase/0,1` ([dictionnaire de processus](processes.md#process-dictionary)) ;
- conversions de binaries, d'atomes et de nombres : `atom_to_binary/1,2`,
  `binary_to_atom/1,2`, `binary_to_existing_atom/1,2`,
  `list_to_existing_atom/1`, `integer_to_binary/1,2`,
  `binary_to_integer/1,2`, `float_to_binary/1,2`, `binary_to_float/1`,
  `list_to_float/1`, `binary_to_list/3`, `bitstring_to_list/1`,
  `list_to_bitstring/1`, `split_binary/2`, `iolist_size/1`, `list_to_pid/1`,
  `list_to_ref/1`. Elles partagent les règles de texte des conversions de
  listes (`conversion_text.cpp` : noms d'atomes, chiffres, options des
  flottants) et les erreurs d'OTP : le texte d'un flottant exige des chiffres
  des deux côtés du point (`list_to_float("1e10")` donne `badarg`), un exposant
  hors de la plage donne `badarg` et un dépassement inférieur `0.0` ; les
  encodages sont `utf8`, `unicode` et `latin1` ; elles s'exécutent jusqu'au
  bout ;
- le [format de termes externe](#external-term-format) :
  `term_to_binary/1,2`, `term_to_iovec/1,2`, `external_size/1,2`,
  `binary_to_term/1,2` ;
- le [temps](#time) et les valeurs uniques : `monotonic_time/0,1`,
  `system_time/0,1`, `time_offset/0,1`, `convert_time_unit/3`,
  `timestamp/0`, `now/0`, `unique_integer/0,1`, `localtime/0`,
  `universaltime/0`, `date/0`, `time/0`, `localtime_to_universaltime/1,2`,
  `universaltime_to_localtime/1`, `posixtime_to_universaltime/1`,
  `universaltime_to_posixtime/1` ; [minuteries](processes.md#timers) :
  `start_timer/3,4`, `send_after/3,4`, `cancel_timer/1,2`, `read_timer/1,2` ;
- l'[introspection des processus](processes.md#introspection) :
  `process_info/1,2`, `processes/0`, `group_leader/0,2`,
  `garbage_collect/0,1,2`, `yield/0` ;
  [informations système](#system-information) : `statistics/1`,
  `system_info/1`, `memory/0,1` ;
- [options de spawn et alias](processes.md#spawn-options) :
  `spawn_opt/2..5`, `spawn_request/1..5`, `spawn_request_abandon/1`,
  `alias/0,1`, `unalias/1`, `monitor/3`, `hibernate/3` ;
- [informations sur les funs](funs.md#fun-information), [hachage](#hashing)
  et MD5 : `fun_info/1,2`, `fun_to_list/1`, `is_builtin/3`, `phash/2`,
  `phash2/1,2`, `md5/1`, `md5_init/0`, `md5_update/2`, `md5_final/1` ;
- [nœuds](processes.md#nodes) et [chargement de code](#code-loading) :
  `nodes/0,1,2`, `is_alive/0`, `monitor_node/2,3`, `disconnect_node/1`,
  `module_loaded/1`, `loaded/0`, `pre_loaded/0`, `delete_module/1`,
  `prepare_loading/2`, `finish_loading/1`, `get_module_info/1,2`.

Les entrées sont seulement ajoutées en fin : l'index d'une entrée est le numéro
que le code généré transmet au service du pont. Un appel qualifié d'une builtin
du catalogue appartenant à un autre module (`io:format(F, A)`) appelle aussi le
pont. Toute autre fonction `erlang` atteint le
[module de bibliothèque erlang](#erlang-module).

## Comment les appels les atteignent

| Source | Chemin |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Services en ligne, comme avant le pont |
| `erlang:function_exported(M, F, A)`, `setelement(I, T, V)`, `A ++ B`, `A -- B`, `length(L)` dans un corps (builtins du catalogue sans service en ligne) | Entrées comme une fonction : `CLAUSE_builtin_frame_v1(context, index)` donne le cadre de la builtin, les arguments vont dans les registres ([portions](#portions)) |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externe `erlang:F/A` ; l'enregistrement la lie à la builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` à l'exécution | Le serveur de code cherche d'abord un export du module, puis une builtin |

- `fun F/A` d'une builtin auto-importée que le module ne définit ni ne supprime
  (`-compile({no_auto_import, ...})`) est la fun externe `erlang:F/A`, comme
  dans OTP : `fun abs/1 =:= fun erlang:abs/1` et elle s'affiche comme
  `fun erlang:abs/1`. `halt/0,1`, `setelement/3`, `tuple_to_list/1`,
  `list_to_tuple/1`, les conversions, les builtins de processus et les builtins
  de port `open_port/2`, `port_close/1`, `port_command/2,3`, `port_connect/2`,
  `port_control/3`, `port_to_list/1`, `list_to_port/1` sont auto-importées comme
  celles d'OTP ; `display/1`, `raise/3`, `function_exported/3`,
  `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3` et `ports/0` exigent le
  préfixe `erlang:` ([ports](ports.md#builtins-and-port-messages)).
- Une builtin a un `FrameDescriptor` au corps nul (`BuiltinFrame`). Y entrer
  (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) n'empile aucun cadre : la builtin
  s'exécute sur les registres et son résultat revient dans le corps de
  l'appelant, de sorte qu'une builtin en position terminale retourne à
  l'appelant de l'appelant.
- Les erreurs sont celles que l'abaissement en ligne lève dans un corps :
  `badarg`, `badarith` pour l'arithmétique, `system_limit`, `{badmap, M}`,
  `{badkey, K}` ; `raise/3` avec une classe ou une pile invalide renvoie
  `badarg`. Elles passent par le canal d'échec vérifié comme toute erreur de
  service.
- L'accès aux termes suit les règles `badarg` d'OTP : `setelement/3` exige un
  petit entier comme index à l'intérieur du tuple ; `make_tuple/2,3` une petite
  taille dans 0..16 777 215, et `make_tuple/3` une liste propre de paires
  `{Index, Value}` dans la taille (les paires suivantes l'emportent) ;
  `list_to_tuple/1` une liste propre ; `A ++ B` une liste propre `A`
  (`[] ++ B` vaut `B` pour tout `B`, un `B` qui n'est pas une liste termine le
  résultat) ; `A -- B` deux listes propres, chaque élément de `B` retirant le
  premier élément exactement égal (`=:=`) de `A`, en O((n + m) log m).
- Les conversions suivent OTP :
  - `list_to_atom/1` prend une liste propre de points de code (sans
    substituts) ; un 256e caractère donne `system_limit` avant d'être vérifié.
    Une table des atomes pleine (`--max-atoms`) arrête le programme par un échec
    du runtime (`resource_limit`, code de sortie 70).
  - `integer_to_list/2` et `list_to_integer/2` prennent une petite base dans
    2..36 ; les chiffres s'affichent en majuscules et s'analysent dans les deux
    casses. `list_to_integer` accepte un signe optionnel, saute les zéros de
    tête, exige un chiffre, et lève `system_limit` au-delà de 1 262 611 chiffres
    décimaux significatifs (ou 4 194 304 dans une base quelconque) une fois ses
    premiers chiffres valides, ainsi que pour une valeur au-delà de la limite
    des entiers.
  - `float_to_list/1` vaut `"%.20e"` ; les options de `/2` s'appliquent dans
    l'ordre, le dernier format l'emportant : `{scientific, D}` (`"%.*e"`, D
    négatif vaut 6), `{decimals, D}` (D >= 0 ; virgule fixe avec l'arrondi
    propre d'OTP sous 2^53 et 19 décimales, `compact` supprime les zéros de fin,
    y compris d'un entier avec `{decimals, 0}` au-delà de 2^53), `short`
    (chiffres de l'aller-retour le plus court selon le choix fixe/scientifique
    d'OTP). Un texte de 256 octets ou plus donne `badarg`.
  - `binary_to_list/1` exige un binary ; `list_to_binary/1` une liste et
    `iolist_to_binary/1` une liste ou un binary d'octets, de binaries et de
    listes imbriquées, chaque liste se terminant par `[]` ou un binary.
- `function_exported(M, F, A)` lève `badarg` sauf si `M` et `F` sont des atomes
  et `A` un petit entier ; elle est vraie quand un module du programme exporte
  `M:F/A` ou que `M:F/A` est une builtin enregistrée.

## Module lists

Source : `runtime/src/builtins/lists/`. Le `lists` d'OTP est du code Erlang
(à part quelques BIF), donc les builtins de Clause lèvent ce que lèvent les
clauses d'OTP :

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` et
  `keydelete/3` lèvent `function_clause` pour un argument qu'aucune clause
  d'OTP n'accepte, et parcourent les listes aussi paresseusement qu'OTP :
  `sublist([a | b], 1)` vaut `[a]`, `nthtail(1, [a | b])` vaut `b`,
  `flatten/2` ne vérifie pas sa queue au-delà de `is_list`.
- `keymember/3` et `keysearch/3` sont des BIF dans OTP : `badarg` pour une
  position qui n'est pas un petit entier positif ou pour une queue impropre
  atteinte avant une correspondance.
- Les clés et l'ordre se comparent avec `==` et l'ordre des termes ; parmi des
  éléments égaux, le premier l'emporte (`max([1, 1.0])` vaut `1`,
  `usort([1.0, 1])` vaut `[1.0]`, `umerge/1,2` gardent l'élément de la liste
  la plus ancienne).
- Elles s'exécutent jusqu'au bout. Les fonctions qui prennent des funs
  (`foreach/2`, `mapfoldl/3`, `mapfoldr/3`, `splitwith/2`, `partition/2`,
  `filtermap/2`, `uniq/2`, ...) sont en Erlang dans
  `library/stdlib/lists.erl`, car une builtin ne peut pas appeler une fun et
  récupérer son résultat ; de même pour `prefix/2`, `suffix/2` et `uniq/1`,
  avec les clauses et les guards d'OTP.
- Un `function_clause` provenant d'une builtin n'a pas de cadre propre
  ([différences](differences.md)).

## Module math

Source : `runtime/src/builtins/math.cpp`. `library/stdlib/math.erl` contient
les exports d'OTP 29 sous forme de talons (stubs) ; chacun est une builtin
au-dessus de la bibliothèque C (`pi/0` et `tau/0` sont des constantes). Les
arguments sont des nombres convertis en flottants : toute autre valeur donne
`badarg`, un entier trop grand pour un flottant `badarith`. Un résultat qui
n'est pas un flottant fini (une erreur de domaine comme `sqrt(-1)`, `log(0)`,
`acos(2)`, ou un dépassement comme `pow(10, 400)`, `exp(1000)`) donne
`badarith`. `floor/1` et `ceil/1` renvoient des flottants. Les résultats sont
ceux de la bibliothèque C de l'hôte, qui peuvent différer de ceux d'OTP sur le
dernier bit ([différences](differences.md)). Sur les cibles 64 bits, le code
généré calcule `sqrt`, `floor`, `ceil` (intrinsèques LLVM) et `exp`, `log`,
`log2`, `log10`, `sin`, `cos`, `pow` (les mêmes fonctions de la bibliothèque C,
appelées sans les substitutions de LLVM) d'arguments numériques en ligne dans
une cellule flottante ; les autres opérandes et les résultats non finis
appellent la builtin, qui lève l'erreur.

## Module binary

Source : `runtime/src/builtins/binary/`. `library/stdlib/binary.erl` contient
les exports d'OTP 29 ; `replace/3,4` (y compris un remplacement par fun et
`{insert_replaced, ...}`) et `list_to_bin/1` sont en Erlang au-dessus des
builtins, toutes les autres fonctions sont des builtins :

- Les motifs sont un binary non vide, une liste non vide de binaries non vides
  ou un motif compilé. Une correspondance est la position la plus à gauche et,
  à cette position, le motif le plus long ; `matches/2,3` et `split/2,3` avec
  `global` prennent des correspondances sans chevauchement depuis la gauche.
  `{scope, {Start, Length}}` limite où les correspondances peuvent commencer
  et finir (une longueur négative compte à rebours) ; `split/3` accepte aussi
  `global`, `trim` et `trim_all`.
- `compile_pattern/1` renvoie `{bm, [Pattern]}` ou `{ac, Patterns}`, une forme
  propre à Clause (OTP : une référence dans le tuple,
  [différences](differences.md)).
- `part/2,3`, `bin_to_list/2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` et
  `decode_hex/1` suivent OTP ; tout mauvais argument (un bitstring, une plage
  hors du sujet, une option inconnue) donne `badarg`.
- `referenced_byte_size/1` est la taille propre du binary.
- Elles s'exécutent jusqu'au bout.

## Module maps

Source : `runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` et `from_keys/2` sont des
  builtins avec les erreurs d'OTP : une valeur qui n'est pas une map donne
  `{badmap, Map}`, une clé manquante de `update/3` `{badkey, Key}`, une liste
  de clés qui n'est pas une liste propre `badarg`. Les clés correspondent
  exactement (`1` et `1.0` sont des clés différentes). `filter/2`, `map/2`,
  `foreach/2` et `update_with/3,4` sont en Erlang dans
  `library/stdlib/maps.erl`.
- `os:getenv/0` (chaînes `"Name=Value"` ; les entrées `=C:` par lecteur de
  Windows sont omises), `os:env/0` (paires `{Name, Value}`), `os:putenv/2`,
  `os:unsetenv/1` (`badarg` sauf si les arguments sont des chaînes et le nom
  non vide et sans `=`), `os:getpid/0` et `os:version/0` sont des builtins ;
  `os:timestamp/0`, `os:system_time/0,1`, `os:perf_counter/0,1` et
  `os:getenv/2` sont en Erlang au-dessus des builtins de temps de `erlang` et
  de `getenv/1`.

## Termes persistants

Plan 11 step 41M2 (`runtime/src/builtins/persistent_term.cpp`) au-dessus de la
table du runtime ([runtime](runtime.md#persistent-terms)). `put/2` et
`put_new/2` renvoient `ok` (`put_new/2` d'une clé stockée donne `ok` pour une
valeur exactement égale, sinon `badarg`) ; `get/1` d'une clé non stockée donne
`badarg`, `get/2` renvoie la valeur par défaut ; `get/0` liste chaque
`{Key, Value}` ; `erase/1` indique si la clé était stockée ; `info/0` vaut
`#{count => N, memory => Bytes}` (les mots des copies stockées). Les clés
correspondent exactement (`1` et `1.0` diffèrent). Chaque lecture copie la
valeur dans le tas de l'appelant.

## Module unicode

Source : `runtime/src/builtins/unicode/`. `library/stdlib/unicode.erl`
contient les exports et les types d'OTP 29 ; `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` et
`encoding_to_bom/1` sont des builtins, les fonctions de normalisation, de
catégorie et d'identifiant restent des talons ; elles peuvent désormais être
écrites au-dessus de [unicode_util](#unicode-util) lorsqu'un programme en a
besoin.

- Encodages : `latin1`, `unicode`/`utf8`, `utf16` et `utf32`, gros-boutiens
  par défaut ou `{utf16 | utf32, big | little}` ; toute autre valeur donne
  `badarg` (`encoding_to_bom/1` : `function_clause`, comme OTP).
- Les chardata sont un binary ou une liste, éventuellement impropre avec une
  queue binary, de points de code, de binaries dans l'encodage d'entrée et de
  chardata imbriquées ; des binaries consécutifs se décodent comme un seul
  flux, si bien qu'un caractère peut s'étendre sur deux. Toute autre valeur
  donne `badarg`.
- Un caractère que la sortie ne peut pas prendre (un point de code ou une
  séquence d'octets invalide, un code au-delà de 255 pour une sortie
  `latin1`) termine la conversion avec `{error, Converted, Rest}` ; une entrée
  qui se termine au milieu d'un caractère avec
  `{incomplete, Converted, Rest}`. `Rest` a la forme d'OTP : la partie non
  convertie de la liste la plus interne commençant par l'élément en échec (un
  binary sous forme de son suffixe non converti, seul lorsqu'il termine le
  niveau supérieur), à l'intérieur de la queue restante de chaque liste
  englobante ; les octets inachevés reportés d'un binary viennent en premier,
  et avec une sortie `latin1` un entier en échec est enveloppé dans une liste.
- `bin_is_7bit/1` est faux pour tout ce qui n'est pas un binary d'octets
  inférieurs à 128.

## Module code

Source : `runtime/src/builtins/code.cpp`. `library/kernel/code.erl` contient
les exports et les types d'OTP 29 ; aucun processus `code_server` n'existe, et
les requêtes sur les modules chargés répondent pour le programme lié : un
module est chargé quand le programme le contient (code compilé ou builtins du
runtime). `ensure_loaded/1` donne `{module, M}` ou `{error, nofile}`,
`ensure_modules_loaded/1` `ok` ou `{error, [{M, nofile}]}`, `is_loaded/1`
`{file, preloaded}` ou `false`, `which/1` `preloaded` ou `non_existing`,
`module_status/1` `loaded` ou `not_loaded`, `all_loaded/0` et
`module_status/0` listent tous les modules, `is_sticky/1` vaut `false`. Un
argument de module qui n'est pas un atome donne `function_clause`. Les chemins
de code et le chargement restent des talons jusqu'au
[step 71](../.agents/11-plan.md#step-71). Le chemin d'erreur de
`io_lib:format/2` d'OTP (`code:ensure_modules_loaded/1`) lève désormais le
`badarg` d'origine.

## Module init

Source : `runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Un
exécutable est un système démarré sans script de démarrage. Le démarrage
décode la ligne de commande une fois (`ProgramArguments`,
`runtime/src/startup/arguments.cpp`) : les arguments qui suivent les options
du runtime sont à la fois l'argv de l'entrée d'arité 1 et
`get_plain_arguments/0`. Il n'y a pas d'options d'émulateur ; la seule option
est `home`, définie au démarrage comme le fait `erlexec` d'OTP (`HOME` ; sous
Windows `HOMEDRIVE` et `HOMEPATH`, sinon `USERPROFILE`), si bien que
`get_argument(home)` vaut `{ok, [[Home]]}`, `get_arguments/0` vaut
`[{home, [Home]}]` et toute autre option donne `error`. `script_name/0` est le
chemin absolu de l'exécutable avec des barres obliques. Ces quatre fonctions
sont des builtins ; les autres sont en Erlang :

- réponses de l'`init` démarré d'OTP : `get_status/0` `{started, started}`,
  `notify_when_started/1` `started`, `ensure_loaded/1` `not_allowed`,
  `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (attend
  `{init, started}`) ; `get_configfd/1` et `set_configfd/2` gardent leurs
  valeurs dans `persistent_term` sous `{init, configfd, Id}` ;
- `script_id/0` vaut `{"Clause", "29"}` ;
- `stop/0,1` et `reboot/0` terminent immédiatement avec les règles de statut
  d'OTP : un entier non négatif est le code de sortie, une liste d'octets le
  slogan d'arrêt, tout autre argument `badarg` ;
- refusées : `boot/1` et `restart/0,1` lèvent `notsup` après les vérifications
  d'arguments d'OTP (`restart/1` d'une liste qui n'est pas `[]` ou
  `[{mode, M}]` donne `badarg`), `make_permanent/2` renvoie `{error, notsup}`
  pour des noms valides et `{error, badarg}` sinon.

## Unicode util

Source : `library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`.
OTP génère `unicode_util` pendant sa construction (900 Ko d'Erlang) ; Clause
garde les données dans des tables C++ générées (`unicode/tables.cpp`)
interrogées par les builtins de son module privé `clause_unicode` (`table/1`,
`class/1`, `cases/1`, `flags/1`, `compose_pair/2`), et `unicode_util.erl`
répond aux fonctions d'OTP au-dessus d'elles avec les formes de résultat
d'OTP :

- `cp/1` prend le premier point de code des chardata comme le fait OTP, en
  gardant les queues binaries et en aplatissant jusqu'à trois points de code
  supplémentaires de listes imbriquées ; `{error, Rest}` sur un UTF-8
  invalide ;
- `lookup/1`, `category/1`, `get_case/1`, `spec_version/0` (`{17, 0}`),
  `pattern_whitespace/0` ; `uppercase/1`, `lowercase/1`, `titlecase/1`,
  `casefold/1` transforment le premier point de code (`{badarg, Rest}` sur un
  UTF-8 invalide) ; `is_wide/1`, `is_whitespace/1`, `is_other_id_start/1`,
  `is_other_id_continue/1`, `is_letter_not_pattern_syntax/1` ;
- `gc/1` : grappes de graphèmes étendues selon UAX #29, avec l'ordre des
  règles d'OTP (CR LF, caractères de contrôle, chemins rapides Latin-1,
  préfixes, syllabes hangûl, paires d'indicateurs régionaux, séquences
  pictographiques étendues et ZWJ, conjointes indiennes) et ses formes de
  résultat : une grappe est un point de code ou une liste, et le reste demeure
  les chardata dont il provient là où OTP le garde (`{error, Rest}` sur un
  UTF-8 invalide) ;
- `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` normalisent la première grappe :
  décomposition canonique ou de compatibilité avec hangûl algorithmique, ordre
  canonique stable, puis composition par les paires de composition.

`tools/unicode/generate.py` écrit les tables une fois par mise à jour
d'Unicode : les correspondances de casse, les catégories (y compris les
catégories voisines que le générateur d'OTP attribue à certains points de code
non assignés), les décompositions et les prédicats de propriétés proviennent
des réponses de l'OTP hôte pour chaque point de code
(`tools/unicode/observe.escript`), les données de coupure de graphèmes,
d'emoji, indiennes et de composition des fichiers de l'Unicode Character
Database qu'OTP 29 fixe (`lib/stdlib/uc_spec`, Unicode 17.0). Seules les
tables générées sont versionnées, avec la mention de copyright Unicode
qu'exige la licence Unicode v3 ; les compilations normales n'ont besoin ni
d'OTP ni des fichiers de données. Le test `executables_unicode_tables` compare
les condensés des réponses du plan 0 et de blocs échantillons des autres plans
avec ceux d'OTP (les 1,1 M points de code correspondaient lors de la
génération des tables) ; `executables_unicode_clusters` compare les grappes et
les formes normales de chaînes choisies à la main pour chaque règle et d'un
balayage initialisé de 2000 chaînes aléatoires.

## Module zlib

Source : `runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. Le
runtime lie zlib 1.3.2, la version qu'embarque OTP 29 ([zlib](compile.md#zlib)),
si bien que les octets compressés sont égaux à ceux d'OTP pour tout niveau,
toute stratégie, toute taille de fenêtre et tout vidage. Un flux est une
[référence à handle](runtime-heap.md#handle-references) dont le tampon
contient le `z_stream` ; son finaliseur termine une session active lorsque la
dernière copie meurt. Les builtins privées de `clause_zlib` (`open/0`,
`close/1`, `set_controller/2`, `deflate_init/2`, `inflate_init/3`,
`deflate/3`, `inflate/2`, les appels de fin, de réinitialisation, de
paramètres et de dictionnaire) exécutent une opération sur toute leur entrée ;
`zlib.erl` conserve l'API d'OTP, les erreurs d'argument
(`bad_compression_level`, `bad_windowbits`, ...), les états de flux
(`not_initialized`, `already_initialized`, `not_on_controlling_process`, un
flux fermé refusant une nouvelle initialisation), `eos_behavior` (`cut`,
`reset`, `error`), `data_error` de `inflateEnd/1` avant la fin d'un flux, les
dictionnaires (`{need_dictionary, Adler}` levé ou renvoyé), la sortie gardée
par `deflateParams/3` pour le `deflate` suivant, et les fonctions sur tampon
entier `compress/1`, `uncompress/1`, `zip/1`, `unzip/1`, `gzip/1`, `gunzip/1`
(membres concaténés). Un en-tête gzip nomme la plateforme, comme l'écrit la
zlib d'OTP. `term_to_binary/2` avec `compressed` ou `{compressed, Level}`
compresse comme OTP le décide (en cinq octets de moins que la charge utile,
sinon sans compression) et `binary_to_term/1,2` décompresse une entrée
compressée.

## Module re

Source : `runtime/src/builtins/re/`, `library/stdlib/re.erl`. Les exports et
les types d'OTP 29 au-dessus de la version de PCRE2 qu'embarque OTP
([PCRE2](compile.md#pcre2)). `version/0` est la version et la date de PCRE2
sous forme de binary (`<<"10.47 2025-10-21">>`, comme sous OTP).

Un motif compilé est le `{re_pattern, CaptureCount, Unicode, UseCRLF, Ref}`
d'OTP 29, où `Ref` est une
[référence à handle](runtime-heap.md#handle-references) qui possède le
`pcre2_code` ; son finaliseur libère le code avec la dernière copie, et les
processus le partagent en lecture seule. Comme dans OTP, la partie C est
petite et le reste est en Erlang :

- `clause_re:compile/2` compile un binary d'expression régulière avec des
  options de compilation (`{ok, Pattern}` ou `{error, {Message,
  Offset}}` avec le message de PCRE2) ; `re:inspect/2` répond à `namelist`.
- `clause_re:run/4` est la BIF `re:run` d'OTP sans ses traps : une
  correspondance d'un sujet binary à partir de `{offset, N}`, en compilant
  d'abord une expression régulière textuelle (`{error, {compile, Reason}}` avec
  `report_errors`), avec toutes les spécifications de capture (`all`, `first`,
  `all_but_first`, `none`, `all_names`, numéros et noms, noms dupliqués) et
  tous les types (`index`, `list`, `binary`), `match_limit` et
  `match_limit_recursion` (`{error, match_limit}` avec `report_errors`, sinon
  `nomatch`), et le `badarg` d'OTP pour des options de compilation ou d'autres
  conventions de fin de ligne données avec un motif compilé.
- `re.erl` convertit les chardata Unicode en UTF-8 et les captures en
  caractères, exécute les correspondances `global` une à la fois (après une
  correspondance vide, il réessaie ancré et non vide, puis avance d'un
  caractère, ou d'une paire CR LF avec des fins de ligne CRLF, comme le fait
  le `loopexec` d'OTP), et implémente `replace/3,4` (`\N`, `\gN`, `\g{N}`,
  `&`, une fun de remplacement) et `split/2,3` (`{parts, N}`, `trim`,
  `group`, `{return, Type}`) avec les résultats d'OTP.

Les motifs exportés (`export`, `import/1`) ne sont pas fournis.
`executables_re_module` compare avec OTP la compilation, la correspondance,
les captures, les correspondances globales et Unicode, le remplacement, le
découpage et les erreurs d'argument.

## Prim eval

Source : `runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun,
Timeout)` est le receive d'`erl_eval`, dont les clauses sont une fun : il
parcourt la boîte aux lettres depuis le message le plus ancien avec les étapes
d'un [receive](processes.md#receive) compilé, les builtins privées de
`clause_receive` `peek/0` (`{message, M}` ou `none`), `skip/0`, `take/0`,
`restart/0` et `wait/1` (la builtin d'attente du code compilé, avec son délai
et `timeout_value`). Le premier message pour lequel `Fun` répond autre chose
que `nomatch` est retiré et cette réponse renvoyée ; `timeout` lorsque
`Timeout` expire. Une exception levée par `Fun` laisse chaque message en
place. `executables_prim_eval_receive` compare avec OTP l'ordre de la boîte
aux lettres, les délais, un message arrivant pendant l'attente et les
exceptions.

## Atomics et compteurs

Source : `runtime/src/builtins/atomics.cpp`. Un tableau `atomics` est une
[référence à handle](runtime-heap.md#handle-references) dont le tampon
contient un mot de signe et les valeurs de 64 bits, mises à jour via
`std::atomic_ref` avec des opérations séquentiellement cohérentes ; il est
partagé par chaque copie de la référence (messages, termes persistants,
`binary_to_term/1` tant qu'il vit) et libéré avec la dernière.

- `new/2` prend une arité de 1 à 2^27 et des options `[{signed, Bool}]` (la
  dernière l'emporte) ; `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`,
  `sub_get/3`, `exchange/3`, `compare_exchange/4` et `info/1` sont des
  builtins avec le `badarg` d'OTP pour une mauvaise référence, un mauvais
  indice ou une mauvaise valeur. Les valeurs stockées doivent tenir dans le
  tableau (int64 ou uint64) ; les incréments peuvent être tout entier de
  -2^63 à 2^64 - 1 et rebouclent. `info/1` indique le `memory` d'OTP de 40 + 8
  octets par valeur.
- `counters` est en Erlang (`library/erts/counters.erl`) : `{atomics, Ref}` et
  `{write_concurrency, Ref}` enveloppent tous deux un tableau atomics signé, si
  bien que les compteurs à écriture concurrente sont exacts à chaque lecture.
  `info/1` de ces derniers indique la taille et la mémoire du tableau.

## Erts internal

Source : `runtime/src/builtins/erts_internal.cpp`,
`library/erts/erts_internal.erl`. Les fonctions qu'appellent `stdlib` et
`kernel` d'OTP :

- les builtins `cmp_term/2` (ordre exact des termes : un entier avant un
  flottant égal) et `map_next/3`, le protocole de `maps:iterator/1,2` et
  `maps:next/1` : un chemin entier parcourt la map dans l'ordre des clés et
  continue sur les clés restantes, un chemin en liste de clés prend ses clés
  dans l'ordre ; un accumulateur liste reçoit chaque association à partir du
  chemin ;
- en Erlang : `list_to_integer/2` et `binary_to_integer/2` (les auxiliaires de
  `string:to_integer/1` et des BIF de conversion, `big` au-delà d'un petit
  entier de la taille du mot), `map_to_tuple_keys/1` (les clés triées de toute
  map), `term_type/1`, les fonctions `counters_*` à écriture concurrente,
  `dynamic_node_name/0,1` au-dessus de `persistent_term` ;
- refusées : `get_creation/0` vaut `undefined` (pas de distribution) et
  `map_hashmap_children/1` lève `badarg` (aucune map n'a de nœuds hashmap) ;
- écartés : les groupes de la distribution, de `.beam` et internes à
  l'émulateur.

`erts_code_purger:purge/1` répond `{false, false}` et `soft_purge/1` `true`,
car le code lié n'a pas d'ancien code ; le processus de purge et
`finish_after_on_load/2` attendent le [step 71](../.agents/11-plan.md#step-71).

## Portions

Les builtins dont le travail croît avec un argument liste ou binary
s'exécutent par portions bornées, comme les BIF d'OTP qui font un trap, afin
qu'une builtin longue ne puisse pas empêcher les autres processus de
s'exécuter ([processus](processes.md)).

- Toute builtin du pont appelée par un corps est entrée comme une fonction et
  consomme une réduction. Une portion peut effectuer `WORK_PER_REDUCTION` (16)
  unités de travail par réduction restante dans la tranche de temps (au moins
  l'équivalent d'une réduction) : cellules de liste parcourues ou construites,
  comparaisons, octets. Elle les paie sur la tranche.
- Une builtin à qui il reste du travail fait un trap : `ProcessStack::trap`
  désigne un cadre de continuation et place les termes d'état de la builtin
  dans les registres, qui restent des racines ; l'état natif (octets, positions
  de tri, mots de termes gardés comme racines) vit dans le `TrapState` de la pile
  du processus. Le processus cède la main et reprend à la continuation dans une
  tranche ultérieure. Les ramassages entre portions réécrivent les registres et
  les mots d'état comme les autres racines.
- Les résultats, les erreurs et l'ordre d'évaluation sont les mêmes qu'avec une
  exécution jusqu'au bout. Une erreur détectée tardivement (une queue impropre)
  est levée quand le parcours l'atteint.
- Les appels de l'hôte (`call_builtin`) poursuivent immédiatement chaque trap.
- `integer_to_list/1` d'un petit entier, `list_to_integer/1` d'une courte
  chaîne décimale et `atom_to_list/1` travaillent sur des mots sans
  allocations intermédiaires ; les autres arguments prennent les chemins
  généraux. `list_to_tuple/1` et `tuple_to_list/1` lisent les cellules de leur
  argument comme des mots et construisent le résultat sans admettre de nouveau
  les éléments, de même que les listes de caractères de ces conversions.
- Les parcours de listes valident la liste une fois et lisent ses cellules
  comme des mots, sans `Term` par cellule ; `Left ++ Right` copie un `Left`
  d'au plus 64 cellules en une étape, sans état de portion.

| Builtin | Portions |
| --- | --- |
| `length/1` dans un corps | Compte les cellules ; dans une garde, elle reste le service en ligne, car la BIF de garde d'OTP ne fait pas de trap |
| `A ++ B` | Collecte les éléments de `A`, puis construit la copie sur `B` en partant de la fin |
| `A -- B` | Collecte `B`, le trie selon l'ordre exact (tri fusion ascendant), parcourt `A` avec une recherche dichotomique par élément, puis construit les éléments conservés ; si rien n'est retiré, le résultat est `A` lui-même |
| `binary_to_list/1` | Construit la liste depuis la fin du binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Parcourt l'iolist en profondeur d'abord, puis crée le binary d'un coup |

Les autres builtins s'exécutent jusqu'au bout. Les builtins de tuple
(`setelement/3`, `make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) font
comme dans OTP : leur travail est borné par la limite d'arité des tuples. Les
conversions restantes lisent des entrées bornées par les limites des atomes, des
entiers et des flottants. Le formatage avec `io:format/1,2` s'exécute jusqu'au
bout ([différences](differences.md)). Les services en ligne des boucles
(l'inversion finale d'une comprehension) s'exécutent jusqu'au bout dans le cadre
de la boucle.

## Builtins typées

Les builtins qui vérifient elles-mêmes leurs arguments sont des fonctions C++
à paramètres typés ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, enregistrées avec
`typed_entry<Function>(module, name)` (l'arité est le nombre de paramètres).

- L'adaptateur admet chaque mot d'argument dans l'ordre (un mot que ce
  processus ne possède pas est l'échec correspondant, jamais `badarg`), puis
  convertit chacun vers le type de son paramètre ; une non-correspondance lève
  `badarg` et la fonction ne s'exécute pas.
- Types de paramètres : `Term` (tout terme, le repli générique), `std::int64_t`
  (un petit entier), `detail::Integer` (tout entier), `double` (un flottant),
  `ListArgument` (une liste propre et ses éléments), `TupleArgument`,
  `BinaryArgument` (les octets d'un binary), `AtomArgument` (son orthographe).
- Résultats : `Term`, `TermResult<Term>` (une construction ratée est un échec du
  runtime), `BuiltinResult<Term>` (`std::expected` avec un `BuiltinFailure`), ou
  un `Word` brut que la fonction a publié elle-même. Une fonction peut aussi
  lever `BuiltinFailure` (une erreur Erlang telle que `badarg` ou
  `system_limit`, ou un échec d'accès à un terme) ; `call_builtin` transforme
  toute autre exception C++ en `out_of_memory` ou `internal_error`, de sorte
  qu'aucune ne traverse l'ABI du code généré.
- Les familles d'accès aux termes, de conversion et d'io, `binary_part/2` et
  `function_exported/3` sont typées. Les autres builtins `erlang` transmettent
  leurs mots d'argument non convertis aux services en ligne que le code généré
  appelle aussi, et qui les admettent ; elles restent des adaptateurs
  `BuiltinBody` au niveau des mots.

## Enregistrement

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  détenu par le `CodeServer`, associe module/fonction/arité exacts à un
  `BuiltinFrame`. `add` prend un lot de `BuiltinEntry` et les enregistre toutes
  ou aucune : un nom vide, plus de 255 arguments, une implémentation manquante
  ou un nom déjà enregistré (ou répété dans le lot) rejette le lot sans rien
  conserver.
- Le démarrage du runtime enregistre chaque table de `production_builtins()`
  (`erlang_builtins()`, `term_access_builtins()`, `conversion_builtins()`,
  `io_builtins()`), la plupart des entrées étant créées par `typed_entry`,
  qui couvrent ensemble le
  catalogue ; les familles ultérieures ajoutent leurs propres tables.
- Un corps lit exactement autant de mots d'argument que son arité et consigne
  les erreurs dans le canal vérifié ; les exceptions de l'hôte deviennent des
  échecs `out_of_memory` ou `internal_error`.
- L'ancien chemin hôte `abi::v1::dispatch_builtin` (modules natifs enregistrés
  par l'hôte par nom, [runtime](runtime.md#code-server-and-builtins)) est
  distinct et inchangé.

## Module erlang

Le compilateur sait quelles fonctions `erlang` existent à partir de deux
sources possédées par le projet, jamais à partir du code du runtime :

- `library/stdlib/erlang.terms` : les exports `erlang` d'OTP 29 sous la forme
  `{Name, Arity, Flags, Status}` (indicateurs `auto_import`, `guard` ; statut
  `implemented`, `{planned, Step}` ou `{unavailable, Reason}` :
  `distribution`, `tracing`, `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` observe l'OTP hôte et
  conserve les statuts, qui sont maintenus à la main.
- `tests/compiler/builtins/generate_erlang.py` le transforme en
  `library/stdlib/erlang.erl` (le module de talons propre à Clause) et en
  `compiler/src/semantic/erlang_auto_imports.inc` (la liste d'auto-imports
  d'OTP). Le CTest `builtins_erlang_inventory` vérifie que les deux sont à jour
  et que `implemented` désigne une builtin du catalogue, une fonction que le
  compilateur gère (`apply/2,3`, `is_record/1,2,3`) ou un vrai corps Erlang
  (`nif_error/1,2` lèvent `error(Reason)` comme les talons d'OTP) ;
  `builtins_erlang_freshness` (étiquette `host_otp`) compare l'inventaire avec
  l'OTP hôte.

Appels :

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` et
  `-import(erlang, ...)` d'une builtin vont à la builtin, comme avant. Tout
  autre export rejoint le programme en tant que module de bibliothèque
  `erlang` (compilé comme `lists`) ; ses talons lèvent
  `error({not_implemented, F, A})` avec `erlang:F/A` au sommet de la pile,
  seulement lorsqu'ils sont appelés. Un nom que le module n'exporte pas donne
  `undefined function erlang:F/A`.
- Un appel non qualifié ou `fun F/A` d'un auto-import d'OTP (`get(K)`,
  `fun put/2`) que le module ne définit pas, n'importe pas et ne supprime pas
  avec `-compile({no_auto_import, ...})` atteint `erlang:F/A` de la même
  manière.
- Les builtins sont collantes (sticky) : lorsque le module `erlang`
  s'enregistre, le runtime saute chaque export qui porte le nom d'une builtin
  enregistrée, si bien que `M:F(Args)` avec `M = erlang` et les funs externes
  se lient à la builtin, jamais à un talon.

## Format de termes externe

Source : `erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Les deux
directions partagent le codec de
[external_term.hpp](../abi/include/clause/abi/external_term.hpp) avec le
compilateur, et parcourent les termes avec des piles explicites, si bien que
la profondeur d'imbrication ne coûte aucune pile native.

- `term_to_binary/1,2` écrit les octets d'OTP pour un nœud non distribué
  (`nonode@nohost`, création 0) : atomes UTF-8, `NEW_FLOAT`, `STRING_EXT` pour
  les listes d'octets jusqu'à 65535 éléments, maps dans l'ordre des clés,
  pids, ports et références sous leurs formes `NEW_PID`, `V4_PORT` et
  `NEWER_REFERENCE`, et `EXPORT_EXT` pour `fun M:F/A`. Options :
  `{minor_version, 0..2}` (0 écrit les flottants en texte, 0 et 1 les atomes
  en Latin-1), `deterministic`, `compressed` et `{compressed, 0..9}` ; toute
  autre valeur donne `badarg`.
- `term_to_iovec/1,2` renvoie l'encodage sous forme de liste d'un seul
  binary ; `external_size/1,2` sa taille exacte.
- `binary_to_term/1,2` vérifie chaque longueur par rapport à l'entrée avant
  d'allouer, ignore les octets après le terme, et renvoie `badarg` pour une
  entrée malformée, un texte d'atome invalide, des flottants non finis, des
  clés de map répétées et des identités d'un autre nœud ; `safe` n'admet que
  des atomes existants, `used` renvoie `{Term, BytesRead}`. CTests :
  `executables_external_terms` (octets d'OTP) et `builtins_etf_fuzz` (les
  encodages mutés se décodent ou lèvent une erreur).

## Temps

Source : `erlang/time.cpp`. Le temps monotone est l'horloge stable ; `native`
et `perf_counter` sont en nanosecondes ; les unités sont les atomes d'OTP (y
compris les formes plurielles obsolètes) ou un entier positif de parties par
seconde. `convert_time_unit/3` arrondit vers le bas, comme OTP.
`unique_integer/0,1` puise dans un seul compteur pour tout le programme, si
bien que chaque valeur est positive, unique et croissante quelles que soient
les options (`positive`, `monotonic` ; les autres donnent `badarg`). `now/0`
est le temps système rendu strictement croissant. Les conversions de
calendrier lisent `{{Y, M, D}, {H, Mi, S}}` strictement (une date ou une heure
invalide donne `badarg`) et utilisent le fuseau horaire local de la
bibliothèque C.

## Informations système

Source : `erlang/system.cpp`.

- `statistics/1` : `wall_clock` et `runtime` (`{Total, SinceLastCall}` en
  millisecondes), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (tranches de temps exécutées).
  Clause ne tient aucun compteur de réductions, de ramasse-miettes ni d'E/S :
  `reductions`, `exact_reductions`, `garbage_collection` et `io` indiquent des
  zéros.
- `system_info/1` : `otp_release` (`"29"`), `version` (`"17.1"`, l'ERTS que
  Clause suit), `machine` (`"Clause"`), `system_version`,
  `system_architecture`, `wordsize` et `{wordsize, internal | external}`,
  `process_count`/`process_limit`, `port_count`/`port_limit`,
  `atom_count`/`atom_limit`, `schedulers`, `schedulers_online`,
  `logical_processors*`, `thread_pool_size`, `smp_support`, `threads`,
  `build_type`, `heap_type`, `kernel_poll`, `debug_compiled`,
  `time_correction`, `time_warp_mode`, `endian`, `compat_rel`.
- `memory/0,1` : les types d'OTP ; `processes` est le compte global du runtime
  de la mémoire des processus, `atom` une estimation d'après le nombre
  d'atomes, `binary`, `code` et `ets` valent 0.
- Les autres éléments donnent `badarg`.

## Hachage

Source : `erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` et `phash/2` hachent la structure d'un terme : des termes
  exactement égaux ont le même hachage à chaque exécution du programme (atomes
  par leur orthographe, maps dans l'ordre des clés, `1` et `1.0` distincts).
  `phash2/1` est dans 0..2^27-1, `phash2/2` dans 0..Range-1, `phash/2` dans
  1..Range ; Range est dans 1..2^32, sinon `badarg`. Les valeurs sont propres
  à Clause, pas celles d'OTP.
- `md5/1` et `md5_init/0`, `md5_update/2`, `md5_final/1` donnent les condensés
  de la RFC 1321 (les octets d'OTP) d'iodata. Le contexte est un binary opaque
  de 96 octets dans une disposition propre à Clause ; un autre binary donne
  `badarg`.

## Chargement de code

Source : `erlang/code.cpp`. Chaque module est lié dans le programme et reste
chargé ; le [step 71](../.agents/11-plan.md#step-71) décidera du code
dynamique. `module_loaded/1` est vrai pour un module compilé ou un module avec
des builtins du runtime (`erlang`, `io`, `os`) ; `loaded/0` et `pre_loaded/0`
les listent tous. `delete_module/1` renvoie `undefined` pour un module inconnu
et lève `error:notsup` pour un module chargé. `prepare_loading/2` renvoie
`{error, badfile}` (aucun binary n'est du code que le programme peut charger)
et `finish_loading/1` n'accepte que `[]`. `get_module_info(M[, Item])`
continue comme `M:module_info(...)`.

## Organisation des sources

- Le runtime implémente les builtins dans `runtime/src/builtins/`. Un grand
  module a son propre sous-répertoire avec une unité de traduction par famille
  de builtins : le module `erlang` vit dans `runtime/src/builtins/erlang/`
  (`core` : tests de type, BIF de garde, opérateurs, levée d'exceptions,
  `display`, `halt`, `function_exported` ; `term_access` ; `lists` :
  `length`, `++`, `--` ; `conversions` ; `processes` : identités, spawn,
  messages, liens, moniteurs, noms enregistrés ; `ports` ; `dictionary` : le
  [dictionnaire de processus](processes.md#process-dictionary) ;
  `binary_conversions` avec `conversion_text`, les règles de texte qu'il
  partage avec `conversions` ; `term_encoding` et `term_decoding` : le format
  de termes externe ; `time` et `timers` ; `introspection` et `system` ;
  `spawning` ; `fun_info`, `hashing` et `md5` ; `node` et `code`).
- Chaque fichier de famille définit sa propre table `*_builtins()` listée dans
  `production_builtins()`. Une nouvelle famille ajoute un nouveau fichier et une
  nouvelle table au lieu d'agrandir une table existante ; un fichier qui
  dépasse environ 400 lignes est scindé par famille avant de grandir
  davantage. Les grands modules ultérieurs suivent la même règle
  (`runtime/src/builtins/<module>/`).
- Les petits modules (`io`, `os`) et l'infrastructure du pont (`registry`,
  `invocation`, `bridge`, `portions`, `typed`, `text`, `float_text`,
  `output`) restent dans `runtime/src/builtins/`.
- Le compilateur ne lit jamais les sources du runtime : le catalogue
  `abi::v1::bridge_builtins` est la seule liste que les deux côtés partagent.
  Il reste un tableau unique en ajout seul ; ses commentaires de groupe
  nomment le fichier qui l'implémente.
