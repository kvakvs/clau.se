---
source: docs/builtins.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d6df02dea1e6270774c9766671b42d9c4b5af4090512da97273a2a4a3a58197f
translatedAt: 2026-10-26
---
# Builtins

Fonctions que le runtime implémente en C++ : BIF d'`erlang` et fonctions
d'autres modules dont les équivalents d'OTP sont des BIF, des NIF ou ont besoin
du runtime. Enregistrées par module, fonction et arité ; atteintes directement,
par des appels dynamiques et sous forme de funs. Les sources sont dans
`runtime/src/builtins/` ; les différences observables avec OTP sont dans
[différences](differences.md).

## Quelles builtins existent

- Catalogue `abi::v1::bridge_builtins`
  ([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) : toutes les builtins
  connues du compilateur et du runtime ; les commentaires des groupes nomment
  le fichier qui les implémente.
- L'index d'une entrée est le nombre que le code généré passe au pont ; le
  catalogue peut être réordonné (compilateur et runtime sont construits ensemble).
- Module `erlang` : BIF de guard, opérateurs en tant que fonctions, `display/1`,
  `halt/0,1`, levée d'exceptions, accès aux termes, conversions, processus,
  ports, format de termes externe, temps, informations système, informations
  sur les funs, hachage, chargement de code.
- Autres modules : une section par module ci-dessous ; les modules auxiliaires
  privés (`clause_unicode`, `clause_re`, `clause_zlib`, `clause_receive`, ...)
  servent le code Erlang des bibliothèques.
- L'état de chaque fonction (builtin, corps Erlang, bouchon) est dans
  `library/<application>/<module>.terms` ([bibliothèque](library.md#files)).
- Un appel qualifié d'une builtin du catalogue appelle le pont ; toute autre
  fonction `erlang` atteint le [module de bibliothèque erlang](#erlang-module).

## Comment les appels les atteignent

| Source | Chemin |
| --- | --- |
| `abs(X)`, `X + Y`, `display`, `halt`, `error` | Code en ligne ou service dédié |
| Builtins du catalogue sans service en ligne (`A -- B`, ...) | Entrée comme dans une fonction : `CLAUSE_builtin_frame_v1`, arguments dans les registres |
| Builtins directes (ne font jamais de trap, n'attendent pas et ne touchent aucun autre processus) | `CLAUSE_builtin_call_v1` renvoie le résultat |
| Builtins rapides (`length`, `binary_to_list`, `list_to_binary`, `iolist_to_binary`) | Chemin rapide borné (256 cellules, 4096 octets de résultat) ; sinon entrée dans la trame |
| `A ++ B` | `A` courte et propre copiée en ligne ; sinon entrée |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externe `erlang:F/A` liée à la builtin |
| `M:F(Args)`, `apply/3`, `fun M:F/A` à l'exécution | Export du module d'abord, puis builtin |

- `fun F/A` d'un auto-import que le module ne définit ni ne supprime est
  `fun erlang:F/A`, comme dans OTP. Les fonctions non auto-importées
  (`display/1`, `raise/3`, `make_tuple/2,3`, ...) exigent le préfixe `erlang:`.
- Une trame de builtin a un corps null : y entrer n'empile aucune trame, donc
  un appel terminal revient à l'appelant de l'appelant.
- Les erreurs (`badarg`, `badarith`, `system_limit`, `{badmap, M}`, `{badkey, K}`)
  utilisent le canal d'échec vérifié.
- L'accès aux termes et les conversions suivent les règles `badarg` d'OTP :
  - `setelement/3` : petit index dans le tuple ; `make_tuple/2,3` : taille
    0..16,777,215 ; `A ++ B` : `A` propre ; `A -- B` : listes propres,
    `=:=`, O((n + m) log m).
  - `list_to_atom/1` : le 256e caractère donne `system_limit` ; une table
    d'atomes pleine (`--max-atoms`) termine avec le code 70.
  - `integer_to_list/2`, `list_to_integer/2` : base 2..36 ; `system_limit`
    au-delà de 1,262,611 chiffres décimaux.
  - `float_to_list/1,2` : formats d'OTP (`scientific`, `decimals`, `compact`,
    `short`) ; un texte de 256 octets ou plus donne `badarg`.
  - Les équivalents binary partagent les règles textuelles
    (`erlang/conversion_text.cpp`) ; le texte d'un flottant exige des chiffres
    des deux côtés du point.
- `function_exported/3` : vrai pour un export du programme ou une builtin
  enregistrée.

## Portions

Les builtins dont le travail croît avec une liste ou un binary s'exécutent
par portions bornées, comme les BIF à traps d'OTP.

- Chaque entrée dans une builtin dépense une réduction ; une portion effectue
  `WORK_PER_REDUCTION` (16) unités par réduction restante dans la tranche.
- Travail restant : `ProcessStack::trap` nomme une continuation ; les termes
  d'état restent dans les registres (racines), l'état natif dans `TrapState`.
  Le processus cède la main et reprend plus tard.
- Peut continuer dans un export Erlang (`io` vers un périphérique processus
  fait un trap dans `file:write/2`).
- Résultats, erreurs et ordre sont ceux d'une exécution complète. Les appels
  hôtes (`call_builtin`) terminent tous les traps immédiatement.
- Les petites entrées suivent des chemins rapides au niveau des mots
  (`++` avec ≤ 64 cellules, `integer_to_list`, `list_to_integer`,
  `atom_to_list` courts, conversions de tuples).
- Avec traps : `length/1` dans un corps (reste en ligne dans un guard), `++`,
  `--`, `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`.
- Tout le reste, dont `io:format` et les builtins de tuples, s'exécute jusqu'au
  bout.

## Builtins typées

- Fonctions C++ `Result F(ProcessContext &, Parameters...)` enregistrées avec
  `typed_entry<F>(module, name)`
  ([typed.hpp](../runtime/src/builtins/typed.hpp)).
- L'adaptateur accepte les mots d'arguments et les convertit aux types des
  paramètres ; une incompatibilité donne `badarg` avant l'exécution du corps.
  `Named<Role>` empêche d'intervertir les paramètres termes.
- Renvoient un terme, `BuiltinResult` ou un `Word` brut, ou lèvent
  `BuiltinFailure` ; les autres exceptions C++ deviennent `out_of_memory`
  ou `internal_error`.
- Les BIF de guard, les opérateurs et les builtins de liste à traps sont des
  adaptateurs `BuiltinBody` au niveau des mots ; les conversions fréquentes
  lisent les cellules sur place (`TermAccess::trusted`).

## Enregistrement

- `BuiltinRegistry`
  ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  possédé par `CodeServer`, associe module/fonction/arité à un `BuiltinFrame` ;
  `add` enregistre un lot entièrement ou pas du tout.
- Le démarrage enregistre chaque table de `production_builtins()`
  (`builtins/registry.cpp`), puis celles des extensions du runtime listées dans
  le descripteur de démarrage (`RuntimeOptions::extensions`) : celles de
  l'archive crypto quand le programme la lie ([module crypto](#crypto-module)).
- Modules protégés : les exports de module portant le nom d'une builtin sont
  ignorés, donc les appels n'atteignent jamais un corps
  `clause_builtin_placeholder` ni une fonction utilisateur de même nom.
- Le chemin hôte `abi::v1::dispatch_builtin` est séparé
  ([runtime](runtime.md#code-server-and-builtins)).

## Organisation des sources

- Les grands modules ont un sous-répertoire avec un fichier par famille
  (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`, `zlib/`, ...) ; les
  petits tiennent dans un seul fichier.
- Chaque fichier de famille définit une table `*_builtins()` listée dans
  `production_builtins()`. Nouvelle famille = nouveau fichier ; scinder les
  fichiers au-delà d'environ 400 lignes.
- Le compilateur ne lit jamais les sources du runtime ; le catalogue est la
  liste partagée.

## Module erlang

- `library/erts/erlang.terms` : exports d'OTP 29 sous la forme
  `{Name, Arity, Flags, Status}` (indicateurs `auto_import`, `guard` ; état
  `implemented` ou `{unavailable, Reason}`), états maintenus à la main.
- `tests/compiler/builtins/generate_erlang.py` écrit
  `library/erts/erlang.erl` (bouchons) et
  `compiler/src/semantic/erlang_auto_imports.inc`. CTests
  `builtins_erlang_inventory` (à jour) et `builtins_erlang_freshness` (OTP hôte).
- Les builtins priment pour `erlang:F(...)`, `fun erlang:F/A`, `apply` et les
  imports ; les autres exports lèvent `{not_implemented, F, A}` à l'appel,
  ceux du traçage (`{unavailable, tracing}` : `trace*`, `system_monitor`,
  `system_profile`, `seq_trace*`, `dt_*`) lèvent `notsup` ; les noms inconnus
  donnent `undefined function`.
- Compléments (`executables_erlang_gaps`, `_packet_decoding`, `_suspension`) :
  - `adler32`, `crc32` et `*_combine` sur la zlib épinglée ; `iolist_to_iovec/1`.
  - `append_element/2`, `insert_element/3`, `delete_element/2`.
  - Cookies comme sur un nœud non actif ; `halt/2` comme `halt/1`.
  - `send/3`, `spawn/2,4` et apparentées ([processus](processes.md#builtins)).
  - `decode_packet/3` : tous les types de paquets et options d'OTP, ses termes http.
  - `suspend_process/1,2`, `resume_process/1`, `process_display/2`.

## Format de termes externe

`erlang/term_encoding.cpp`, `term_decoding.cpp` ; codec partagé avec le
compilateur ([external_term.hpp](../abi/include/clause/abi/external_term.hpp)),
piles explicites.

- `term_to_binary/1,2` : octets d'OTP pour `nonode@nohost` ; options
  `minor_version`, `deterministic`, `compressed` ; les funs locales et les
  native records donnent `notsup`.
- `term_to_iovec/1,2`, `external_size/1,2`.
- `binary_to_term/1,2` : longueurs vérifiées avant allocation ; `safe`, `used` ;
  entrée mal formée ou identités étrangères donnent `badarg`.
- Les piles du codec et les octets encodés de `term_to_binary` sont des tampons
  par fil conservés entre les appels (jusqu'à 1 MB chacun,
  `builtins/scratch.hpp`), donc un grand terme ne demande pas de nouvelles
  pages à chaque appel ; les petits entiers évitent le chemin général des
  éléments dans les deux sens.
- CTests `executables_external_terms`, `builtins_etf_fuzz`.

## Temps

`erlang/time.cpp`.

- Le temps monotone est l'horloge stable ; `native` est en nanosecondes ;
  atomes d'unités d'OTP ou entiers en fractions par seconde.
- `convert_time_unit/3` arrondit vers le bas ; `unique_integer/0,1` utilise un
  compteur croissant ; `now/0` est strictement croissant.
- Les conversions calendaires sont strictes et utilisent le fuseau local de
  la bibliothèque C.
- Minuteurs : [processus](processes.md#timers).

## Informations système

`erlang/system.cpp`, `erlang/system_flags.cpp`.

- `statistics/1` : `wall_clock`, `runtime`, files d'exécution,
  `context_switches` ; les compteurs de réductions, de GC et d'E/S renvoient zéro.
- `system_info/1` : `otp_release` `"29"`, `version` `"17.1"`, `machine`
  `"Clause"`, comptes, limites, réponses fixes de l'émulateur ; liste complète
  dans `system.cpp`.
- `memory/0,1` : types d'OTP ; `binary`, `code`, `ets` valent 0.
- `system_flag/2` : `backtrace_depth` (≤ 64) et `min_heap_size` agissent ;
  la plupart des autres sont relus sans effet ; `cpu_topology`, `erts_alloc`,
  ... donnent `badarg`.

## Hachage

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2`, `phash/2` : valeurs d'OTP pour les atomes, nombres, binary,
  listes, tuples, maps ; pid, ports, références et funs sont hachés à la façon
  propre à Clause.
- `md5/1` et `md5_init/update/final` : RFC 1321 ; le contexte est un binary de
  96 octets propre à Clause.

## Chargement de code

`erlang/code.cpp`. Chaque module est lié et reste chargé ; le code dynamique
est reporté.

- `module_loaded/1`, `loaded/0`, `pre_loaded/0` couvrent les modules compilés
  et les modules de builtins.
- `delete_module/1` d'un module chargé donne `notsup` ; `prepare_loading/2`
  donne `{error, badfile}`.

## Module lists

`builtins/lists/`. Le module `lists` d'OTP est en Erlang, donc les builtins
lèvent ce que ses clauses lèvent.

- Les parcours (`sublist`, `flatten`, fusions, `key*`, `zip`, `sort`,
  `usort`, ...) lèvent `function_clause` comme OTP et restent aussi paresseux
  (`sublist([a | b], 1)` donne `[a]`).
- `keymember/3`, `keysearch/3` sont des BIF : règles `badarg`.
- Éléments égaux : le premier gagne (`max([1, 1.0])` donne `1`).
- Les fonctions prenant des funs et le reste sont en Erlang dans
  `library/stdlib/lists.erl` ; les builtins y sont appelées de façon qualifiée.
- Une `function_clause` de builtin n'a pas de trame propre.

## Module math

`builtins/math.cpp`.

- Toutes les fonctions d'OTP 29 sur la bibliothèque C ; valeurs non numériques
  donnent `badarg`, résultats non finis `badarith`.
- La génération de code 64 bits développe en ligne `sqrt`, `floor`, `ceil`,
  `exp`, `log*`, `sin`, `cos`, `pow` sur des nombres, en gardant des doubles
  bruts.

## Module binary

`builtins/binary/` ; `replace/3,4` et `list_to_bin/1` sont en Erlang.

- Motifs : binary, liste de binary ou compilés ; correspondance la plus à
  gauche, puis la plus longue ; `scope`, `global`, `trim`, `trim_all`.
- `compile_pattern/1` renvoie `{bm, ...}` ou `{ac, ...}` sans référence.
- Les autres fonctions suivent OTP ; arguments incorrects donnent `badarg` ;
  `referenced_byte_size/1` est la taille propre du binary.

## Module maps

`builtins/maps.cpp`, `builtins/os.cpp`.

- Toutes les fonctions documentées de `maps` ; les fonctions principales sont
  des builtins avec les erreurs d'OTP ; les clés correspondent exactement.
- Les fonctions prenant des funs sont en Erlang dans `maps.erl` ; les
  itérateurs utilisent [`erts_internal:map_next/3`](#erts-internal).
- Les curseurs de map parcourent les maps plates et arborescentes dans l'ordre
  des clés ; `clause_maps:entries/1` alimente `maps:fold/3`.
- `os` : `type`, `getenv`, `env`, `putenv`, `unsetenv`, `getpid`,
  `version` sont des builtins ; les fonctions de temps sont en Erlang ;
  `os:cmd/1` utilise un port.

## Collections

`builtins/collections/` : toutes les fonctions documentées de `ordsets`,
`orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`, `queue`, `array`.

- Les parcours de listes sont des builtins ; les fonctions prenant des funs
  sont en Erlang.
- Chaque builtin parcourt comme les clauses d'OTP : mêmes résultats, mêmes
  erreurs pour toute entrée.
- `dict`, `sets` version 1 : records de hachage linéaire d'OTP (mêmes
  disposition et ordre). Les ensembles version 2 sont des maps.
- `gb_trees`, `gb_sets` : moteur d'arbre équilibré partagé ; arbres égaux à
  ceux d'OTP.
- `queue` : déplacements `{Rear, Front}` d'OTP ; files égales à celles d'OTP.
- `array` : record `#array{}` d'OTP 29, modifié exactement comme dans OTP.

## Ensembles d'ensembles

- `sofs` (`builtins/sofs/`, `executables_sofs_sets`) : records d'OTP sur des
  listes triées ; algèbre, relations et familles sont des builtins, les
  fonctions prenant des funs sont en Erlang.

## Graphe

- `graph` (`builtins/graph/`, `executables_graph_module`) : `#graph{}` d'OTP ;
  parcours et chemins sont des builtins à piles explicites, les mises à jour
  sont en Erlang.

## Digraphe

- `digraph`, `digraph_utils` (`builtins/digraph/`,
  `executables_digraph_tables`) : les trois tables ETS d'OTP ; mises à jour
  en Erlang sur `ets` ; recherches de chemins et parcours sont des builtins
  qui lisent les tables sur place.

## ETS

`builtins/ets/` sur les tables du runtime ([runtime](runtime.md#ets-tables)).

- Builtins : cycle de vie des tables, insertion/recherche/suppression,
  parcours, compteurs, `info` ; pliages, `i/0..3`, `fun2ms/1` en Erlang.
- Options et droits d'accès comme OTP ; tout échec donne `badarg`.
- Spécifications de correspondance
  ([runtime](runtime.md#match-specifications)) : `select*`, `match*`,
  `match_spec_*`, `erlang:match_spec_test/3` ; résultats dans l'ordre du
  parcours, continuations de forme OTP.
- Fichiers de tables : `tab2file`, `file2tab`, `tabfile_info` lisent et
  écrivent le format disk_log d'OTP dans les deux sens.
- `to_dets/2`, `from_dets/2` sur `dets` ; `table/1,2` en Erlang sur
  `qlc:table/2` (select/3 par défaut, `first_next`, `last_prev`,
  `{select, MS}`), recherche des clés avec `==` dans un `ordered_set`,
  sinon `=:=`.
- Les CTests `executables_ets_*` exécutent les cas de référence d'OTP.

## Dets

`dets.erl` sur `clause_dets` (`builtins/dets/`) : format de fichier version 9
d'OTP octet pour octet, mêmes ordres de fichiers.

- Moteur (C++) : en-tête, listes libres par compagnons, hachage linéaire,
  vidage du cache d'écriture, parcours, dispositions en masse.
- Processus (Erlang) : serveur `dets` avec les tables de registre d'OTP ; un
  processus par table détenant descripteur de fichier, cache, fixations,
  minuteurs.
- Réparations et erreurs d'ouverture comme OTP ; les funs s'exécutent là où
  OTP les exécute.
- `table/1,2` en Erlang sur `qlc:table/2` (select/3 par défaut, `first_next`,
  `{select, MS}`) ; les auxiliaires non documentés sont des bouchons.
- Le CTest `executables_dets_tables` compare avec OTP, MD5 des fichiers inclus.

## Encodages

`builtins/encoding/`.

- `base64` : chaque fonction est une builtin ; les erreurs de décodage
  correspondent aux automates d'OTP.
- `json` : `decode/1`, `encode/1`, `format/1,2` et les encodeurs binary sont
  des builtins (repli sur Erlang au-delà de 256 niveaux d'imbrication) ; les
  décodeurs à rappels et les encodeurs prenant des funs sont en Erlang sur les
  analyseurs de `clause_json`.

## Messages POSIX

`builtins/erl_posix_msg.cpp`, `library/stdlib/erl_posix_msg.erl`.

- `erl_posix_msg:message/1` (module interne d'OTP dont `file:format_error/1`
  a besoin) : texte anglais d'une raison POSIX depuis une table observée sur
  OTP 29, `"unknown POSIX error: "` et le nom pour un autre atome, `badarg`
  pour une valeur autre qu'un atome.

## Noms réseau

`builtins/net/`, `library/kernel/clause_net.erl`, `library/kernel/net.erl`.

- `clause_net:gethostname/0`, `getaddrinfo/2`, `getnameinfo/4`,
  `getservbyname/2`, `getservbyport/2` appellent les fonctions du système
  et répondent comme `prim_net` d'OTP : informations d'adresse en maps de
  `family`, `socktype`, `protocol` et d'une adresse de socket, noms d'erreur
  de prim_net (`eservice`, `enodata`, ...), `{error, einval}` pour un service
  inconnu. `net` vérifie les arguments avec les guards d'OTP et passe le texte
  sous forme de binary UTF-8.
- `clause_net:inet_getifaddrs/0` liste les interfaces comme `inet_drv` d'OTP
  pour `inet:getifaddrs/0` (sur Windows depuis `GetAdaptersAddresses` et
  `GetIfEntry` avec ses règles d'indicateurs, de préfixes et de masques réseau
  par classes ; ailleurs depuis `getifaddrs(3)`, fusionnées par nom et
  indicateurs comme `prim_inet`). `clause_net:getifaddrs/0` les liste comme
  `net:getifaddrs(all)` (Windows : entrées de paquets et indicateurs triés du
  module `net` d'OTP ; ailleurs maps de prim_net avec adresses de paquets ou de
  liens) ; `net` les filtre par famille, indicateurs ou fun. `if_names/0` est
  la liste d'index et de noms que `net:if_index2name/1` et `if_name2index/1`
  parcourent.
- `inet:getservbyname/2`, `getservbyport/2` et `gethostbyaddr/1` (un
  `getnameinfo` avec `NI_NAMEREQD`) utilisent les mêmes builtins ; les espaces
  de noms réseau répondent `{error, enotsup}` ([différences](differences.md)).
- `clause_net:dns_decode/1` et `dns_encode/1` (`builtins/net/dns.cpp`) sont
  le codec de messages DNS d'inet_res : tuples `#dns_rec{}`, `#dns_header{}`,
  `#dns_query{}`, `#dns_rr{}`, `#dns_rr_opt{}` et `#dns_rr_tsig{}` d'OTP avec
  les valeurs d'inet_dns (types, classes et opcodes symboliques, étiquettes de
  noms échappées, LOC en degrés et mètres) et ses règles `formerr` (pointeurs
  de compression vers l'arrière au-delà de l'en-tête, noms de moins de 255
  octets, sections tronquées uniquement avec le bit TC) ; l'encodage compresse
  les noms.

## Noms de fichiers

`builtins/filename/`.

- Les fonctions de chemins sont des builtins suivant les clauses d'OTP pour
  la famille du système hôte (Unix ou lecteurs Windows et noms `//`) ; formes
  de résultats et erreurs d'OTP.
- `absname/1,2`, `basedir/2,3` sont en Erlang.

## Filelib

`builtins/filelib.cpp`, `library/stdlib/filelib.erl`, `library/stdlib/clause_filelib.erl`.

- `clause_filelib:escape/1` écrit `@` et `\` de sorte que `filename:split/1`
  garde les échappements ; `compile_part/1` compile une partie d'un motif
  découpé (`?`, `*`, `**`, ensembles de caractères avec plages, alternatives
  `{...}` incorporant le reste de leur partie) avec les particularités d'OTP
  (`**` uniquement comme partie entière, `]` en premier ou comme borne basse
  d'une plage, `{badpattern, missing_delimiter}`, un `case_clause` pour les
  alternatives imbriquées) ; `matches/3` et `match/2` filtrent les entrées
  des répertoires.
- Le parcours (préfixes littéraux, `..`, `**`, vérifications d'existence) est
  en Erlang sur `file` et `filename`, donc les résultats sont ceux d'OTP, triés.

## Argparse

`builtins/argparse/`, `library/stdlib/argparse.erl`,
`library/stdlib/clause_argparse.erl`.

- `clause_argparse:validate/3` vérifie une commande comme `validate/2` d'OTP,
  dans l'ordre d'OTP, et renvoie le premier champ invalide pour
  qu'`argparse.erl` lève l'erreur.
- `parse/6` est l'analyseur d'OTP sous forme de boucle : formes longues
  (`--name=value`), courtes, indicateurs combinés, valeurs attachées, nombres
  négatifs, `nargs`, actions, types, sous-commandes, valeurs par défaut ;
  erreurs levées et maps d'arguments d'OTP.
- `help/4` construit les listes d'aide d'OTP (retours à la ligne de l'usage,
  sections, modèles) via les builtins `io_lib`, `string` et `unicode`, donc
  les formes sont celles d'OTP.
- Les funs sont appelées par `argparse.erl` : une builtin renvoie une requête
  (`{custom, Fun, Arg}`, `{re, Arg, Re[, Options]}`, `{describe, Fun}`) et est
  rappelée avec les réponses obtenues, en rejouant son parcours ; chaque fun
  s'exécute une fois, dans l'ordre d'OTP.
- `run/3`, les gestionnaires et `format_error/1,2` sont en Erlang.

## Qlc pt

`builtins/qlc_pt/`, `library/stdlib/qlc_pt.erl`,
`library/stdlib/clause_qlc_pt.erl` : la transformation syntaxique qlc à
l'exécution, pour `qlc:string_to_handle/1,2,3` et `qlc:q/1,2` dans le code
évalué. Les modules compilés avec `qlc.hrl` reçoivent toujours la transformation
de l'OTP hôte ([transformations syntaxiques](transforms.md)).

- `clause_qlc_pt:transform_expression/4` et `parse_transform/4` suivent
  `qlc_pt.erl` fonction par fonction : NodeInfo (annotations uniques et ce que
  les vérifications notent sur chaque nœud, conservés par numéro d'emplacement
  à partir de 1 comme dans OTP), `no_shadows`, les passes de vérification qui
  trouvent les variables introduites et de générateur, trames de records
  `#bind{}` pour les colonnes constantes et de jointure, saut de filtres,
  spécifications de correspondance, générateurs de jointure, fun d'état
  générée, `Qdata`, `CodeF` (`term_to_binary(_, [compressed])` du code
  d'origine) et fun d'options. Les données intermédiaires sont des termes
  Erlang de forme OTP, donc les tris suivent l'ordre des termes ; les
  variables générées sont des références comme `make_ref/0` d'OTP.
- Les messages proviennent du `erl_lint` C++ (`Lint`), le chemin que prend
  `qlc_pt` d'OTP quand le compilateur est indisponible ; un plantage de la
  vérification sur les formes construites est l'erreur interne du compilateur,
  comme le signale celui d'OTP. Les records sont développés par
  `erl_expand_records` C++, les tests de guard par `is_guard_test/3`.
- Les spécifications de correspondance exécutent `ms_transform` en Erlang :
  la builtin renvoie `{try_ms, Forms}`, `qlc_pt.erl` répond avec le résultat
  de `try_ms/4` et rappelle la builtin avec les réponses obtenues, en rejouant
  son parcours ; le résultat est `{done, Result, Transformed}` (un module
  transformé porte la profondeur de trace à 500, comme la transformation d'OTP).

## Qlc

`library/stdlib/qlc.erl` : toutes les fonctions sont en Erlang, car l'évaluation
appelle les funs de la requête. Écrit à partir de la documentation d'OTP ; les
algorithmes sont ceux d'OTP quand les réponses, leur ordre ou `info/1,2` les
rendent observables.

- Les handles conservent les tuples d'OTP (`{qlc_handle, H}` avec `qlc_lc`,
  `qlc_table`, `qlc_append`, `qlc_sort` ; `{qlc_cursor, {Pid, Owner}}`) ;
  les requêtes compilées sont le `{qlc_lc, Fun, Opt}` de la transformation
  avec des données `qlc_v1` ou `simple_v1`.
- Préparation : recherches par la clé ou l'index ayant le moins de clés
  (`max_lookup`), spécifications de correspondance pour les funs de parcours
  unaires et les listes, jointures par recherche préférées aux jointures par
  fusion, entrées de ces dernières triées sauf si déjà connues comme triées,
  requêtes simples pour `cache` et `unique`, regroupées, et jamais pour le
  premier générateur.
- Évaluation : les réponses sont des listes terminées par `[]` ou une fun de
  continuation. `cache` utilise des tables `ets` (`qlc`, privées) ou une liste
  conservée sous `{Ref, '$_qlc_cache_tmpfiles_'}`, transférée dans un fichier
  temporaire au-delà de `max_list_size` ; les jointures par fusion placent les
  grandes classes de clés égales dans un fichier
  (`'$_qlc_merge_join_tmpfiles_'`) ; les tris exécutent `file_sorter` quand les
  réponses dépassent `size`. Les fichiers temporaires sont
  `qlc_<node>_<os pid>_<unique>` dans `tmpdir` ou le répertoire de travail ;
  `tmpdir_usage` signale via `error_logger`.
- Les erreurs trouvées à l'évaluation (réponse autre qu'une liste d'une fun de
  parcours ou de recherche, erreurs de fichier, `{tmpdir_usage, _}`) sont
  levées avec une étiquette interne et renvoyées par `eval/2`, `fold/4`,
  `info/2` et les curseurs, comme OTP renvoie les erreurs de `throw_error/1`.
- `info/1,2` affiche la requête préparée avec `erl_pp:expr/3`, les
  descriptions de tables via leurs funs de formatage (chaînes analysées par
  `erl_eval:extended_parse_exprs/1`).
- `string_to_handle/1,2,3` et `qlc:q/1,2` d'`erl_eval` exécutent
  [`qlc_pt`](#qlc-pt) de Clause ; `ets:table/1,2`, `dets:table/1,2` et
  `erl_eval` atteignent `qlc` par un nom à l'exécution, donc seuls les
  programmes qui nomment `qlc` le lient.
- Le CTest `executables_qlc_queries` compare avec OTP : son module de requêtes
  est compilé depuis `qlc_queries.abstr`, les formes après la transformation
  d'OTP, donc le test ne nécessite aucun OTP hôte
  ([cas exécutables](../tests/fixtures/executables/README.md)).

## Chaînes

`builtins/string/` : toutes les fonctions de `string`.

- Les parcours suivent `string.erl` sur `unicode_util:cp/1`, `gc/1` :
  queues, sous-binary, listes mixtes et erreurs d'OTP.
- Les parcours de fin bouclent au lieu d'être récursifs.
- Les fonctions de casse renvoient l'entrée quand rien ne change ; `equal/4`
  normalise via `unicode/normalize.cpp`.
- `to_integer/1`, `to_float/1`, API Latin-1, `jaro_similarity/2` comme OTP.

## Chaînes URI

`builtins/uri/`.

- `parse/1` : un parcours RFC 3986 dans l'ordre d'OTP, fragments d'erreur d'OTP.
- `recompose`, `normalize`, `resolve`, `percent_decode`, `quote` et les
  fonctions de requête suivent les parcours et styles d'erreur d'OTP.
- `unicode/graphemes.cpp` segmente les grappes pour les builtins qui en ont
  besoin.

## Nombres aléatoires

`builtins/rand/`.

- `rand` : états et gestionnaires d'OTP ; chaque algorithme donne ses
  séquences. Les gestionnaires connus s'exécutent en C++ (`clause_rand:*`) ;
  les autres exécutent l'Erlang générique d'OTP.
- `splitmix64_next/1`, `exsp_*`, `mwc59*` sont des builtins.
- `tools/rand/` observe les constantes d'OTP et génère `tables.cpp`.
- `random` : `uniform_s/1` est une builtin, le reste est en Erlang.

## Calendrier

`builtins/calendar.cpp`.

- Builtins d'arithmétique grégorienne sur des entiers quelconques, formules et
  erreurs d'OTP.
- Temps local/universel et RFC 3339 sont en Erlang dans `calendar.erl`.

## Minuteurs

`builtins/timer.cpp`.

- `seconds/1`, `minutes/1`, `hours/1`, `hms/3` et `now_diff/2` comme
  l'arithmétique Erlang sur des nombres quelconques : `badarith` pour une
  valeur non numérique, `function_clause` pour un argument de `now_diff/2`
  qui n'est pas un triplet.
- Les minuteurs sont en Erlang dans `timer.erl`, sans `timer_server` : les
  envois à un pid local utilisent `erlang:send_after/3` ; tout autre minuteur
  ponctuel ou périodique est un processus qui crée un alias, porté par son
  `TRef` et auquel `cancel/1` envoie un message. Un minuteur périodique
  surveille le processus pour lequel il travaille et se termine avec lui ;
  `apply_repeatedly` attend la fin de chaque action avant le prochain tick.

## Termes persistants

`builtins/persistent_term.cpp` sur la table du runtime
([runtime](runtime.md#persistent-terms)).

- `put/2`, `put_new/2`, `get/0,1,2`, `erase/1`, `info/0` avec les résultats
  d'OTP ; les clés correspondent exactement ; les lectures renvoient le terme
  stocké sans copie.

## Module unicode

`builtins/unicode/` : chaque fonction est une builtin.

- Encodages `latin1`, `utf8`, `utf16`, `utf32` (avec boutisme) ; sinon `badarg`.
- Chardata : binary, points de code, listes imbriquées ; les binary consécutifs
  forment un seul flux.
- Les échecs donnent `{error | incomplete, Converted, Rest}` avec la forme
  de `Rest` d'OTP.
- Les formes normales, `category/1`, `is_whitespace/1`, `is_id_*` gardent
  les raccourcis d'OTP.

## Module code

`builtins/code.cpp`. Aucun processus `code_server` ; les réponses décrivent
le programme lié.

- `ensure_loaded/1`, `is_loaded/1` (`{file, preloaded}`), `which/1`
  (`preloaded`), `all_loaded/0`, `module_status/0,1` ; `is_sticky/1` vaut
  `false`.
- Chemin du code (`library/kernel/code.erl`) : un terme persistant construit
  à la première utilisation comme le serveur de code interactif d'OTP :
  répertoires `ebin` des applications d'`ERL_LIBS`, version la plus récente de
  chaque application dans `lib_dir()`, puis `"."`. `root_dir/0` est le
  répertoire de l'exécutable. Les modifications du chemin normalisent et
  vérifient les répertoires comme OTP ; `lib_dir/1`, `priv_dir/1` et
  `compiler_dir/0` désignent le premier répertoire du chemin
  `.../Name[-Vsn][/ebin]`.
- Réponses de chargement pour le code lié : le code objet trouvé sur le chemin
  donne `{error, badfile}` de `erlang:prepare_loading/2`, le code manquant
  `nofile` ; `purge/1` vaut `false`, `soft_purge/1` `true`, `delete/1`
  `false` ; `get_doc/1` donne `{error, missing}` ; aucune prise en charge
  de la couverture.

## Module io

`builtins/terminal.cpp`, `library/stdlib/clause_io.erl`.

- `clause_io:isatty/1` (`stdin`, `stdout`, `stderr`) : une console sur
  Windows, `isatty(3)` ailleurs ; `window_size/1` : `{Columns, Rows}` d'un
  terminal (`GetConsoleScreenBufferInfo`, `TIOCGWINSZ`), sinon
  `{error, enotsup}`.
- Elles répondent aux indicateurs de terminal d'`io:getopts/0,1`,
  à `io:columns/0,1`, `io:rows/0,1` et `io_ansi:enabled/0,1`.
- Le serveur d'entrée standard (`io.erl`) lit les lignes comme le groupe
  d'OTP : une requête `get_until` (`io:read/1,2`, `io:scan_erl_exprs/1..4`,
  commandes du shell) prend une ligne à la fois et réécrit son invite avant
  chaque ligne supplémentaire ; une fin de ligne CRLF est lue comme LF.

## Module os

`builtins/os.cpp`, `library/kernel/os.erl`.

- `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0`,
  `version/0` sont des builtins.
- `cmd/1,2` : Erlang sur un port de lancement avec le protocole d'OTP :
  Windows exécute `COMSPEC /c Command` ; ailleurs `/bin/sh -s unix:cmd` lit
  la commande et affiche `^D` (et le code de sortie) à sa fin. `max_size`,
  `exception_on_failure`, sortie UTF-8 décodée en caractères.
- `find_executable/2` (builtin) : recherche d'OTP dans les éléments de `PATH`
  (Windows : répertoire courant d'abord, `.exe`, `.com`, `.cmd`, `.bat`).
- `set_signal/2` (builtin) : `badarg` sur Windows comme OTP ; ailleurs
  `sigaction` ; un signal traité agit comme l'`erl_signal_handler` par défaut
  d'OTP.

## Module init

`builtins/init.cpp`, `library/erts/init.erl`. Un système démarré sans script
d'amorçage.

- Ligne de commande décodée une fois (`startup/arguments.cpp`) : les arguments
  ordinaires alimentent argv du point d'entrée et `get_plain_arguments/0`.
- Seul indicateur : `home` ; `script_name/0` est le chemin de l'exécutable.
- Les autres fonctions sont en Erlang avec les réponses d'OTP après démarrage ;
  `script_id/0` est `{"Clause", "29"}`.
- `stop/0,1`, `reboot/0` arrêtent immédiatement ; `boot/1`, `restart/0,1`,
  `make_permanent/2` sont refusées avec `notsup`.

## Atomics et compteurs

`builtins/atomics.cpp`.

- Le tableau `atomics` est une
  [référence de handle](runtime-heap.md#handle-references) sur des valeurs
  `std::atomic_ref` ; arité 1..2^27 ; règles `badarg` et `info/1` d'OTP.
- `counters` est en Erlang sur un tableau atomics signé ; les compteurs à
  écritures concurrentes sont exacts.

## Erts internal

`builtins/erts_internal.cpp`, `library/erts/erts_internal.erl` : les fonctions
appelées par `stdlib` et `kernel`.

- Builtins `cmp_term/2` et `map_next/3` (itérateurs de map, ordre des clés).
- Erlang : `list_to_integer/2`, `binary_to_integer/2`, `map_to_tuple_keys/1`,
  `term_type/1`, compteurs, `dynamic_node_name`.
- `get_creation/0` vaut `undefined` ; les groupes de distribution et `.beam`
  sont refusés.
- `erts_code_purger` : rien à purger.

## Unicode util

`unicode_util.erl` sur les builtins `clause_unicode` et les tables générées
(`unicode/tables.cpp`).

- `cp/1`, `gc/1` (UAX #29), `nfd/nfc/nfkd/nfkc`, conversions de casse avec
  les formes d'OTP ; `spec_version/0` vaut `{17, 0}`.
- `tools/unicode/generate.py` construit les tables à partir des réponses de
  l'OTP hôte et des données Unicode 17.0 ; la construction n'exige ni l'un
  ni l'autre.
- CTests `executables_unicode_tables`, `_clusters`, `_forms`.

## io_lib

`io_lib.erl`, `builtins/io_lib/`. Listes profondes de caractères d'OTP
construites dans une arène C++ ; `io:format` utilise le même moteur.

- Rédacteurs (`write.cpp`) : `write`, `write_string`, `write_atom`, ...
  échappent et limitent comme OTP.
- Moteur de formatage (`format_scan.cpp`, `format_build.cpp`) : chaque contrôle,
  `chars_limit`, arrondi des flottants d'OTP ; erreurs `badarg`.
- Mise en forme (`pretty*.cpp`) : dispositions d'`io_lib_pretty` d'OTP.
  `clause_io_lib:pretty/2` est `io_lib_pretty:print/2` pour le shell :
  `column`, `line_length`, `depth`, `line_max_chars`, `strings`, `encoding`
  et `records`, les définitions `[{Name, [Field]}]` que renverrait une
  `record_print_fun`, donc les tuples de nom et taille connus s'affichent
  sous la forme `#Name{Field = Value, ...}` avec la disposition d'OTP.
  CTest `executables_shell_session`.
- Analyseur (`fread.cpp`) : contrôles et continuations de `fread/2,3`.
- Collecteurs (`collect.cpp`), vérifications de caractères imprimables,
  `indentation/2`.
- Funs `maps_order` : la builtin enregistre les maps et continue dans
  `clause_io_lib:sort_maps/6`, en relançant avec les clés triées.
- Une imbrication au-delà de 256 donne `system_limit`. CTests
  `executables_io_lib_text`, `_pretty_print`, `_fread_scanning`.

## Tables du compilateur

`builtins/front_end/`.

- `erl_internal` : tables de BIF et de guards d'`erlang.terms` ; tables de
  types et d'opérateurs ; `add_predefined_functions/1`.
- `erl_anno` : formes et erreurs d'OTP.
- `erl_features` : réponses du compilateur de Clause ; `used/1` lit les
  descripteurs ou les sections `Meta` des `.beam`.
- `records` : voir [native records](native-records.md#reflection).
- CTests `executables_compiler_tables`, `_records_reflection`.

## Erl scan

`erl_scan.erl` sur `clause_erl_scan:scan/6` (`front_end/scanner*.cpp`), son
propre analyseur lexical suivant `scan1/5` d'OTP.

- Tokens, annotations, sigils, chaînes à triples guillemets, erreurs et restes
  d'OTP.
- Les rappels `reserved_word_fun`, `text_fun` s'exécutent en Erlang dans
  l'ordre des tokens.
- Les continuations de `tokens/3,4` réanalysent le token inachevé.
- CTest `executables_erl_scan_tokens`.

## Erl parse

`erl_parse.erl` sur `clause_erl_parse:parse/1` (`front_end/parser*.cpp`),
un analyseur par descente récursive de la grammaire d'OTP.

- Format abstrait et comportement d'erreur LALR d'OTP (token d'arrêt, ordre
  des erreurs d'action et de syntaxe).
- `first_anno/1`, `last_anno/1` suivent l'ordre de `map_anno/2`.
- `normalise/1`, `abstract/1,2`, `tokens/1,2` sont des builtins ; les
  parcours d'annotations avec funs sont en Erlang.
- CTest `executables_erl_parse_forms`.

## Erl eval

`erl_eval.erl` interprète le format abstrait en Erlang ; les builtins
`clause_erl_eval` traitent les segments de syntaxe binaire
(`front_end/erl_eval.cpp`) et la correspondance de motifs
(`front_end/eval_match.cpp`), et `erl_eval:partial_eval/1` et
`is_constant_expr/1` sont aussi des builtins.

- `clause_erl_eval:match/4` est `match1/5` : littéraux, variables, listes,
  tuples, maps, native records, préfixes `"abc" ++ T`, constantes d'opérateurs
  et motifs binary, donnant `{match, Bindings}`, `nomatch` ou `invalid`
  (levé comme `{illegal_pattern, Pattern}` par `erl_eval.erl`). Les clés de
  map et les tailles de segments sont des expressions de guard évaluées sur
  les liaisons extérieures (`front_end/guard_eval.cpp`, partagé avec `-if`
  d'`epp`) ; les liaisons sont lues et stockées en `orddict` ou map, comme
  dans OTP, y compris une liste non triée.
- `clause_erl_eval:bits_gen/4` prend le motif d'un générateur binary au début
  des bits ; la boucle d'évaluation, les guards (ils appellent le gestionnaire
  non local) et les parcours de comprehension restent en Erlang.

- `bit_type/2` résout les spécificateurs d'un `bin_element` avec les valeurs
  par défaut et erreurs d'`erl_bits` (`front_end/bit_types.cpp`, partagé avec
  `normalise/1`) ; `bit_segment/3` construit un segment (`badarg`,
  `system_limit`), `bit_take/3` en prend un au début d'un bitstring (`nomatch`).
- Les funs créées par l'évaluateur sont des fermetures sur l'environnement
  `{Anno, Bindings, Lf, Ef, UsedVars, Clauses}` d'OTP, donc `fun_data/1` et
  `erlang:fun_info/2` répondent comme dans OTP ; `fun M:F/A` avec des parties
  déterminées à l'exécution utilise `erlang:make_fun/3`.
- `exprs/2`, `expr/2` et `check_command/2` vérifient les commandes avec
  `erl_lint:exprs_opt/3` comme OTP.
- CTest `executables_erl_eval_exprs`.

## Erl lint

Les vérifications d'`erl_lint` sont des builtins (`front_end/lint*.cpp`)
écrites d'après `erl_lint` d'OTP clause par clause ; `erl_lint.erl` garde ce
qui appelle des funs ou d'autres modules.

- Un objet `Lint` contient l'état `#lint{}` d'OTP ; les tables de variables
  sont des vecteurs triés par nom (orddicts d'OTP), les ensembles et maps
  qu'OTP garde dans l'ordre des termes sont des conteneurs ordonnés, donc les
  erreurs gardent l'ordre d'insertion et les avertissements sont triés comme
  dans `return_status/1`.
- `module/1,2,3` passent par `clause_erl_lint:module/4` avec les réponses
  `behaviour_info/1` des comportements recherchées en Erlang
  ([différences](differences.md#erl_lint)) ; `format_error/1` formate la
  réponse de `clause_erl_lint:format_spec/1` (parties `io_lib:format/2`
  imbriquées comprises), donc les résultats égalent les termes d'OTP.
- Les dépréciations proviennent des tables `otp_internal` d'OTP
  (`front_end/otp_obsolete.inc`, généré par
  `tests/compiler/library/generate_obsolete.escript`).
- `erl_eval:partial_eval/1` et `erl_bits:set_bit_type/2` utilisés par les
  vérifications sont en C++ (`lint_eval.cpp`, `bit_types.cpp`).
- CTest `executables_erl_lint_checks`.

## Erl pp

L'affichage d'`erl_pp` est une builtin (`front_end/pp*.cpp`),
`clause_erl_pp:print/2`, portée depuis les deux passes de l'ancien module
Erlang ; `erl_pp.erl` garde les hooks et `legalize_vars/1`.

- La première passe transforme une forme en éléments de disposition dans une
  arène (`pp_items`, `pp_exprs`, `pp_forms`, `pp_types`) ; la seconde les
  dispose selon la largeur de ligne (`pp_layout`), en écrivant atomes,
  chaînes, caractères et valeurs via les rédacteurs C++ d'`io_lib`.
- Une forme que seul le hook peut afficher arrête la mise en page avec
  `{hook, Expr, Column, Precedence}` ; `erl_pp.erl` appelle le hook et
  affiche à nouveau avec les réponses obtenues, donc chaque hook s'exécute
  une fois, dans l'ordre d'OTP.
- Les priorités et `erl_parse:abstract/2` proviennent d'`erl_parse.cpp`.
- CTest `executables_erl_pp_forms`.

## Epp

Les conditions `-if` et `-elif` d'`epp` sont évaluées par une builtin,
`clause_epp:eval_if/1` (`front_end/epp_eval.cpp`), donc un programme qui
prétraite des fichiers ne lie pas `erl_eval`.

- Elle évalue l'expression de guard comme `erl_eval:exprs/3` sans liaisons :
  littéraux, listes, tuples, maps et mises à jour de maps, binary (segments
  via les builtins de bits de `clause_erl_eval`), opérateurs dont
  `andalso`/`orelse` donnent la valeur de leur côté droit, et appels de BIF
  de guard (locales auto-importées ou `erlang:`) via la table de guards des
  spécifications de correspondance.
- Toute erreur (variables non liées, records non définis, BIF levant une
  exception, appel local) rend la condition fausse, car `epp` l'intercepte.
- `epp`, `file` et `erl_features` sont compilés avec la
  [vivacité stricte](compile.md#strict-liveness).

## Erl expand records

`erl_expand_records:module/2` est une builtin
(`front_end/expand_records.cpp`) : le développement parcourt les formes en
C++ au lieu d'une vaste sélection de clauses Erlang, donc les programmes qui
l'appellent ne compilent aucun code supplémentaire.

- Ordre de parcours d'OTP (segments binary du dernier au premier, côté droit
  des correspondances en premier) et numérotation `recN` ; les tests de
  guard `is_record/3` deviennent des motifs.
- Les filtres de comprehensions sont des tests de guard selon les règles
  d'`erl_lint` (`front_end/guard_tests.cpp`, avec les records du module et
  les fonctions locales ou importées).
- Options `dialyzer`, `expand_inits`, `[no_]strict_record_tests`, également
  issues des attributs `-compile`.
- CTest `executables_erl_expand_records_forms`.

## Module zlib

`builtins/zlib/streams.cpp`, `library/erts/zlib.erl`.

- Lie zlib 1.3.2 comme OTP 29 ([zlib](compile.md#zlib)) : mêmes octets.
- Un flux est une référence de handle possédant `z_stream` ; les builtins
  `clause_zlib` exécutent une opération sur toute l'entrée.
- `zlib.erl` garde l'API, les erreurs, les états et les auxiliaires sur tampon
  entier d'OTP.
- La compression de `term_to_binary` suit la règle de taille d'OTP.

## Module zstd

`builtins/zstd/contexts.cpp`, `library/stdlib/zstd.erl`.

- Lie zstd 1.5.7 comme OTP 29 ([zstd](compile.md#zstd)) : mêmes trames.
- Les contextes et dictionnaires sont des références de handle possédant ceux
  de libzstd ; un contexte référençant un dictionnaire le garde en vie. Les
  builtins `clause_zstd` reproduisent la NIF d'OTP : blocs de sortie de
  `ZSTD_CStreamOutSize()` / `ZSTD_DStreamOutSize()` (une trame annonçant une
  taille plus petite se décompresse en un bloc de cette taille), résultats
  `{continue, Rest, Out}`, `{flush, Out}` et `{done, Out}`, vérifications
  de propriétaire (`not_on_controlling_process`), erreurs
  `{badarg, {invalid_key | invalid_value, Term}}` et `{zstd_error, Name}`,
  booléens relus comme `false` comme les lit la NIF d'OTP.
- `zstd.erl` garde la gestion des iodata, des flux et des trames d'OTP.

## Codec ASN.1

`builtins/asn1/` dans `clause_runtime`, `library/asn1/clause_asn1.erl`
([ASN.1](asn1.md)).

- `clause_asn1:encode/3` et `decode/3` prennent le terme de schéma du module
  généré, le nom du type et la valeur ou les octets (un binary ou une iolist) ;
  `decode/3` renvoie `{Value, Rest}`. Elles interprètent le schéma comme le
  code BER généré par asn1ct et `asn1rtt_ber`, et échouent avec les mêmes
  raisons `exit`/`error`, que l'enveloppe générée transforme en
  `{error, {asn1, Reason}}`.
- Les TLV sont analysés comme par `asn1rt_nif` (`tlv.cpp` : ses positions
  d'erreur, limites de deux octets pour l'étiquette et de quatre pour la
  longueur) ; `ber_decode.cpp`, `ber_constructed.cpp`, `ber_encode.cpp` et
  `ber_encode_constructed.cpp` contiennent les types primitifs et construits,
  `values.cpp` les comparaisons INTEGER, REAL et DER `DEFAULT`, `legacy.cpp`
  les anciennes formes de `BIT STRING`.
- PER (`per.hpp`) : `per_bits.cpp` pour les champs de bits, déterminants de
  longueur, nombres entiers et chaînes avec leur alignement et leurs
  fragments ; `per_encode.cpp`/`per_decode.cpp` pour les types primitifs ;
  `per_encode_constructed.cpp`/`per_decode_constructed.cpp` pour les
  séquences, ajouts d'extension, choix et types ouverts ; `per_strings.cpp`
  pour les valeurs `BIT STRING`. Un décodage PER prend un binary et renvoie
  les bits non lus.

## Clé publique

`builtins/public_key/` dans `clause_runtime`,
`library/public_key/clause_public_key.erl` ([public_key](public_key.md)) :
les parcours de records et tables de `pubkey_translation` et
`pubkey_cert_records` d'OTP, appelés par `clause_public_key_codec`.

- `translate(decode | encode, Term)` (`translate.cpp`) parcourt un terme
  comme `pubkey_translation:decode/1` et `encode/1` : les records
  `SubjectPublicKeyInfo_algorithm`, `DSA-Params`, `DSA-Sig-Value`,
  `OTPExtension`, `SingleAttribute`, `OneAsymmetricKey` (version `v1`) et
  `EncryptionAlgorithmIdentifier` des modules générés deviennent ceux que
  documente `public_key.hrl`, et inversement ; une liste impropre échoue
  avec `bad_generator` comme la comprehension.
- `oid_name(Table, Oid)` et `name_oid(Table, Name)` (`tables.cpp`, lignes
  dans `tables.inc`) recherchent dans les tables `public_key_algorithm`
  (type de clé d'un algorithme), `curve_type`, `named_curve`, `ml_dsa`,
  `ml_kem`, `slh_dsa` et `extension` (type d'une extension) ; `undefined`
  si la table n'a pas de ligne, `badarg` pour une autre table.
- `asn1_module(Type)` nomme le module généré qu'utilisent `der_decode/2`
  et `der_encode/2` pour un type (`public_key:get_asn1_module/1`),
  `undefined` pour un type n'appartenant à aucun.

## Module crypto

`builtins/crypto/` dans l'archive séparée `clause_runtime_crypto`,
`library/crypto/crypto.erl` et `clause_crypto.erl`.

- Lie libcrypto d'OpenSSL ≥ 3.1.2 (version épinglée 4.1.0,
  [OpenSSL](crypto.md)) ; seuls les programmes qui appellent `crypto` (ou
  passent `--with-crypto`) lient l'archive, dont le descripteur de démarrage
  liste l'entrée `CLAUSE_crypto_extension_v1`.
- `algorithms.cpp` garde les tables de noms d'OTP (empreintes, chiffrements,
  MAC, types de clés, courbes, KEM) avec leurs noms de récupération OpenSSL ;
  le premier appel `crypto` charge les fournisseurs default, base et legacy
  et récupère chaque empreinte, chiffrement et MAC, comme la NIF d'OTP à son
  chargement ; les courbes sont sondées (une clé générée sur chacune) au
  premier `supports(curves)`. `supports/0,1`, `hash_info/1`, `info/0` et
  `info_lib/0` indiquent ce que fournit la libcrypto liée.
- Les états de hachage sont des références de handle possédant un
  `EVP_MD_CTX` ; `hash_update/2` renvoie un nouvel état sur une copie, comme
  dans OTP. Les états MAC possèdent un `EVP_MAC_CTX` que `mac_update/2`
  fait avancer sur place. `crypto.erl` fournit les textes de plus de 20000
  octets par morceaux, comme OTP, donc aucun appel de builtin ne dure longtemps.
- Les erreurs sont celles des NIF d'OTP :
  `{badarg | notsup | error, #{c_file_name, c_file_line_num, c_function_arg_num}, Description}`,
  que `crypto.erl` transforme en `{Class, {File, Line}, Description}` avec
  `error_info` (`?nif_call`) ; les descriptions et vérifications suivent
  l'ordre d'OTP, le fichier et la ligne sont ceux de Clause.
- Les moteurs répondent comme un OTP dont OpenSSL ne les prend pas en charge
  (`notsup` ; OpenSSL 4 n'en a pas).
- Les chiffrements (`cipher.cpp`) suivent `api_ng.c` d'OTP : les états
  `crypto_init/4` possèdent un `EVP_CIPHER_CTX` protégé par un verrou que
  `crypto_update/2` fait avancer sur place ; `crypto_final/1` remplit selon
  les options (`undefined`, `none`, `zero`, `random`, `pkcs_padding`
  d'OTP) ; `crypto_one_time/5` exécute un état temporaire. `crypto.erl`
  fournit à `crypto_update/2` les textes de plus de 20000 octets par
  morceaux. AEAD (`aead.cpp`) suit `aead.c` pour GCM, CCM et
  ChaCha20-Poly1305 ; une mauvaise étiquette donne `error` au déchiffrement.
  `crypto.erl` exécute les générateurs `rand` `crypto_aes` et
  `crypto_prng1` comme OTP, sur les builtins `exro928_*` et `seed58/2`
  de `rand`.
- FIPS (`fips.cpp`) : chaque entrée de table garde une seconde récupération
  `fips=yes`, utilisée en mode FIPS ; une entrée qui n'en a pas y est
  interdite (`*_FORBIDDEN_IN_FIPS` d'OTP), disparaît de `supports/1` et
  lève les descriptions `notsup` d'OTP. `enable_fips_mode/1` bascule les
  propriétés par défaut d'OpenSSL ; les programmes construits avec `--fips`
  lient l'entrée `CLAUSE_crypto_fips_extension_v1` de l'archive, dont le hook
  de démarrage charge le fournisseur à côté de l'exécutable
  ([FIPS](crypto.md#fips)).
- Les clés publiques suivent `pkey.c`, `rsa.c`, `dss.c`, `eddsa.c`,
  `ec.c`, `ecdh.c`, `dh.c`, `evp.c` et `srp.c` d'OTP : `crypto.erl`
  transforme les entiers en binary (`format_pkey`, `nif_curve_params`) et
  les builtins construisent les clés OpenSSL depuis les mêmes listes
  `OSSL_PARAM` que les NIF d'OTP (`params.cpp`, grands nombres en ordre natif),
  avec les vérifications, descriptions et numéros d'arguments d'OTP.
  `pkey.cpp` : `sign/4,5`, `verify/5,6` (RSA avec PKCS #1, PSS, X9.31 et
  sans remplissage, DSA, ECDSA, EdDSA, ML-DSA, SLH-DSA ; `{digest, Digest}`),
  `public_encrypt/4` de RSA et ses trois apparentées (PKCS #1, OAEP avec ses
  empreintes et son étiquette, sans remplissage), `privkey_to_pubkey/2`.
  `keys.cpp` : génération de clés RSA, DH, X25519/X448, Ed25519/Ed448,
  ML-DSA, SLH-DSA et ML-KEM, accord DH et X25519/X448, `encapsulate_key/2`,
  `decapsulate_key/3`. `curves.cpp` : clés et accord ECDH sur courbes nommées
  ou explicites, réessayés avec des paramètres explicites quand OpenSSL ne
  connaît pas le nom d'OTP (comme `retry_without_name` d'OTP), et `ec_curve/1`,
  dont les paramètres explicites proviennent des courbes intégrées de la
  libcrypto liée plutôt que de la table `crypto_ec_curves` d'OTP (mêmes termes
  octet pour octet). `srp.cpp` : formules de grands nombres de SRP ;
  `crypto.erl` garde le multiplicateur et le brouilleur d'OTP. Les
  particularités d'OTP sont conservées : `sign(dss, none, ...)` échoue avec
  `"Bad digest type"`, `generate_key(dh, ...)` ignore une clé privée donnée,
  et un exposant public RSA sur plusieurs octets atteint OpenSSL dans
  l'ordre natif des octets.

## Module re

`builtins/re/`, `re.erl` sur PCRE2 embarqué ([PCRE2](compile.md#pcre2)).

- Motif compilé : `{re_pattern, ...}` d'OTP 29 avec une référence de handle.
- `clause_re:compile/2`, `clause_re:run/4` (une correspondance, toutes les
  options de capture, erreurs d'OTP).
- `re.erl` : conversion de chardata, boucle `global`, `replace`, `split`.
- `export`/`import/1` non fournis. CTest `executables_re_module`.

## Prim eval

`process/receive.cpp`, `library/erts/prim_eval.erl`.

- `prim_eval:'receive'/2` parcourt la boîte aux lettres avec les builtins
  `clause_receive` (`peek`, `skip`, `take`, `restart`, `wait`) ; la
  première réponse autre que `nomatch` gagne.
- CTest `executables_prim_eval_receive`.
