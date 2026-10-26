---
source: docs/library.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: eb1d55d20683cef87e3553554a2b837e023b35acb9de58cdad1cb868ec95d0d8
translatedAt: 2026-10-26
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
| [`lists`](../library/stdlib/lists.erl) | Les fonctions courantes ; les fonctions sur les données comme `sublist/2,3`, `flatten/1,2`, `sort/1`, `usort/1`, `keymember/3`, `zip/2,3`, `merge/2` sont des builtins du runtime ; chaque fonction documentée est implémentée ([module lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | Chaque fonction documentée ; `get/3`, `merge/2`, `intersect/2`, `with/2`, ... sont des builtins du runtime, les fonctions prenant des funs sont en Erlang ([module maps](builtins.md#maps-module)) |
| [`ordsets`](../library/stdlib/ordsets.erl), [`orddict`](../library/stdlib/orddict.erl), [`proplists`](../library/stdlib/proplists.erl) | Chaque fonction documentée ; les parcours de listes sont des builtins du runtime, les fonctions prenant des funs sont en Erlang ([collections](builtins.md#collections)) |
| [`calendar`](../library/stdlib/calendar.erl) | Chaque fonction documentée ; l'arithmétique grégorienne sous forme de builtins du runtime, l'heure locale et RFC 3339 en Erlang ([calendar](builtins.md#calendar)) |
| [`proc_lib`](../library/stdlib/proc_lib.erl), [`sys`](../library/stdlib/sys.erl) | Chaque fonction documentée : création de processus avec ancêtres et appels initiaux, démarrages synchrones (`init_ack`, `init_fail`), étiquettes, `stop/1,3`, rapports de plantage et leur texte ; protocole des messages système et options de débogage (`trace`, `log`, `statistics`, `log_to_file`, funs installées) avec les formes de listes de débogage d'OTP |
| [`gen_server`](../library/stdlib/gen_server.erl), [`gen_statem`](../library/stdlib/gen_statem.erl), [`gen_event`](../library/stdlib/gen_event.erl), [`gen_fsm`](../library/stdlib/gen_fsm.erl), [`gen`](../library/stdlib/gen.erl) | Chaque fonction documentée en Erlang au-dessus de `proc_lib` et `sys`, avec les messages d'OTP (`'$gen_call'` avec étiquettes d'alias, `'$gen_cast'`, ...), les résultats et actions des rappels, les collections d'identifiants de requêtes, les termes d'erreur et les textes des rapports ; `gen` contient ce qu'elles partagent |
| [`supervisor`](../library/stdlib/supervisor.erl), [`supervisor_bridge`](../library/stdlib/supervisor_bridge.erl) | Chaque fonction documentée : spécifications et erreurs des enfants, stratégies, intensité de redémarrage, règles d'arrêt, enfants `simple_one_for_one` et arrêt automatique d'OTP, sous forme de `gen_server` |
| [`logger`](../library/kernel/logger.erl), [`logger_formatter`](../library/kernel/logger_formatter.erl), [`logger_std_h`](../library/kernel/logger_std_h.erl), [`logger_filters`](../library/kernel/logger_filters.erl), [`logger_handler`](../library/kernel/logger_handler.erl) | Chaque fonction documentée en Erlang : configuration primaire, des gestionnaires et du proxy avec les vérifications et termes d'erreur d'OTP, niveaux par module, métadonnées de processus, filtres, macros `?LOG_*` de [`kernel/include/logger.hrl`](../library/kernel/include/logger.hrl), modèles de formatage et en-tête historique, `logger_std_h` sur périphériques et fichiers avec rotation, compression et `filesync/1`, `logger_disk_log_h` sur journaux disque halt et wrap (tous deux au-dessus de [`clause_logger_h`](../library/kernel/clause_logger_h.erl), options et vérifications communes des gestionnaires d'OTP). Le serveur `logger` est le [`clause_logger`](../library/kernel/clause_logger.erl) de Clause, démarré à la première utilisation avec le gestionnaire par défaut d'OTP sur `standard_io` (la variable d'environnement `CLAUSE_LOGGER_TYPE=standard_error` le déplace vers la sortie d'erreur standard, comme le fait l'exécuteur de références pour correspondre aux références produites avec le gestionnaire d'OTP sur celle-ci) ; les niveaux par application nécessitent `application` |
| [`disk_log`](../library/kernel/disk_log.erl), [`wrap_log_reader`](../library/kernel/wrap_log_reader.erl), [`clause_disk_log`](../library/kernel/clause_disk_log.erl), [`clause_disk_log_server`](../library/kernel/clause_disk_log_server.erl) | Chaque fonction documentée en Erlang : journaux halt, wrap et rotate, internes et externes, avec les formats de fichiers d'OTP (en-têtes de journaux, trames d'éléments avec MD5 des grands éléments, fichiers d'index et de taille wrap, archives rotate), pour des fichiers identiques à ceux d'OTP octet par octet ; un processus par journal avec propriétaires, utilisateurs, notifications, blocage avec requêtes en attente, journalisation anticipée, cache d'écriture vidé selon la taille et par minuterie, réparation, blocs en lecture seule comptant les octets incorrects ; serveur de registre `disk_log_server` avec les tables nommées `disk_log_names` et `disk_log_pids` ; `wrap_log_reader` au-dessus du même lecteur de blocs |
| [`error_logger`](../library/kernel/error_logger.erl), [`error_logger_file_h`](../library/stdlib/error_logger_file_h.erl), [`log_mf_h`](../library/stdlib/log_mf_h.erl) | Chaque fonction documentée : messages et rapports comme événements de journal avec les métadonnées `error_logger` d'OTP, gestionnaires de rapports sur le gestionnaire d'événements `error_logger` alimenté par le gestionnaire de journalisation `error_logger`, `logfile/1` dans l'ancien texte des rapports, fichiers wrap avec l'index et le format d'enregistrement d'OTP |
| [`pg`](../library/kernel/pg.erl), [`data_publisher`](../library/kernel/data_publisher.erl) | Chaque fonction documentée : portées sous forme de serveurs `data_publisher` avec les tables ETS d'OTP, adhésions, départs, membres qui se terminent, moniteurs de portées et de groupes ; la portée n'a aucun pair |
| [`global`](../library/kernel/global.erl), [`global_group`](../library/kernel/global_group.erl) | Chaque fonction documentée comme sur un nœud non distribué : noms (aussi `{global, Name}` dans les comportements), verrous et transactions au-dessus d'un `global_name_server` démarré à la première utilisation ; `global_group` sans groupes ; le gestionnaire de verrous et les mécanismes internes distribués sont déclinés |
| [`rpc`](../library/kernel/rpc.erl), [`erpc`](../library/kernel/erpc.erl) | Chaque fonction documentée : les appels à ce nœud s'exécutent dans des processus créés à cet effet (`rex` démarre à la première utilisation) avec les résultats et erreurs d'OTP ; les autres nœuds sont indisponibles (`{badrpc, nodedown}`, `{erpc, noconnection}`) |
| [`net_adm`](../library/kernel/net_adm.erl), [`net_kernel`](../library/kernel/net_kernel.erl), [`auth`](../library/kernel/auth.erl), [`seq_trace`](../library/kernel/seq_trace.erl) | Les réponses d'OTP pour un nœud qui n'est pas actif (`pang`, `ignored`, `#{started => no}`, `nocookie`) ; `net_kernel:start/1,2` et les mécanismes internes de distribution sont déclinés ; `seq_trace` conserve le jeton de chaque processus sans traçage |
| [`trace`](../library/kernel/trace.erl), [`erl_tracer`](../library/erts/erl_tracer.erl) | Le traçage n'est pas pris en charge : chaque fonction de `trace` et le traceur par défaut d'`erl_tracer` (`enabled/3`, `trace/5`) lèvent `notsup`, comme les fonctions de traçage d'erlang ([module erlang](builtins.md#erlang-module)) ; `erl_tracer:behaviour_info/1` liste les rappels d'OTP |
| [`error_handler`](../library/kernel/error_handler.erl) | Les fonctions d'appels non définis, appelables directement ; le runtime lève lui-même `undef` et ne les appelle jamais ; `breakpoint/3` décliné (aucun interpréteur) |
| [`timer`](../library/stdlib/timer.erl) | Chaque fonction documentée sans le serveur de minuteries d'OTP : les envois différés à des pid locaux utilisent `erlang:send_after/3`, toute autre minuterie a son propre processus atteint via un alias dans son `TRef` ; les conversions et `now_diff/2` sont des builtins du runtime ([timer](builtins.md#timer)) |
| [`filelib`](../library/stdlib/filelib.erl), [`clause_filelib`](../library/stdlib/clause_filelib.erl) | Chaque fonction documentée : motifs génériques compilés et comparés par des builtins du runtime avec les règles, bizarreries et erreurs d'OTP, parcours des répertoires, requêtes, `ensure_dir/1`, `ensure_path/1`, `fold_files/5,6`, `find_file/2,3`, `find_source/1,2,3` (`source_search_rules` de kernel ou valeurs par défaut d'OTP) et `safe_relative_path/2` en Erlang ; également les formes non documentées prenant un module (`file`, `erl_prim_loader` ou autre), `compile_wildcard/1` (aide au débogage d'OTP) est un bouchon ([filelib](builtins.md#filelib)) |
| [`file_sorter`](../library/stdlib/file_sorter.erl) | Chaque fonction documentée en Erlang : séquences (`size` octets triés en mémoire), fusions (`no_files` fichiers temporaires à la fois, blocs de 16 KiB, flux ordonnés selon leurs objets en tampon et numéros de fichiers) et vérifications d'OTP suivis pas à pas, pour que les termes comparés égaux sortent et survivent à `unique` comme dans OTP ; formats `binary_term`, `binary`, `term` et fun, `header`, `compressed` (via la couche gzip de `file`), `tmpdir`, funs d'entrée et de sortie, termes d'erreur d'OTP |
| [`zip`](../library/stdlib/zip.erl) | Chaque fonction documentée en Erlang, suivant la structure des archives d'OTP octet par octet (en-têtes locaux et centraux créés par UNIX 6.1, champs supplémentaires d'horodatage étendu et d'uid/gid UNIX, zip64 au-delà de 4 GiB, blocs deflate de 8 KiB avec vidages complets via `zlib`), pour des archives identiques à celles d'OTP ; fichiers ou binaries en entrée et en sortie via les funs d'entrée et de sortie d'OTP, filtres, `cwd`, `keep_old_files`, `skip_directories`, `foldl/3`, archives `zip_open/1,2` servies par un processus lié, `t/1`, `tt/1`, termes d'erreur d'OTP ; records de [`stdlib/include/zip.hrl`](../library/stdlib/include/zip.hrl) |
| [`erl_tar`](../library/stdlib/erl_tar.erl) | Chaque fonction documentée en Erlang, suivant les règles de format d'OTP octet par octet : en-têtes USTAR, noms longs séparés en préfixe ou déplacés vers des en-têtes étendus pax (comme les noms longs ou non ASCII, les liens et noms de propriétaires, et les nombres trop larges pour l'octal), lecture des archives v7, GNU (noms et liens longs, fichiers creux), STAR, USTAR et pax avec les bizarreries d'OTP (champs en base 256, dates pax), `compressed` via la couche gzip de `file`, binaries lus comme fichiers `ram`, périphériques, funs d'E/S utilisateur `init/3`, `max_size`, `keep_old_files`, `files`, `cwd`, `verbose`, vérifications des chemins dangereux, termes d'erreur d'OTP et `format_error/1` |
| [`zstd`](../library/stdlib/zstd.erl), [`clause_zstd`](../library/stdlib/clause_zstd.erl) | Chaque fonction documentée : compression et décompression en une fois et en flux, paramètres, dictionnaires (bruts ou référencés), en-têtes de trames et identifiants de dictionnaires, en Erlang au-dessus de builtins du runtime qui détiennent des contextes libzstd 1.5.7 comme la NIF d'OTP ([zstd](builtins.md#zstd-module)) ; `file:open/2` accepte `{zstd, Options}` |
| [`beam_lib`](../library/stdlib/beam_lib.erl), [`erl_abstract_code`](../library/stdlib/erl_abstract_code.erl) | Chaque fonction documentée en Erlang, suivant le traitement des blocs d'OTP : parcours IFF avec les erreurs d'OTP, tables d'atomes dans les deux encodages, tables de symboles, attributs, informations de compilation, littéraux, informations de débogage et code abstrait via le backend `erl_abstract_code`, documentation (records de [`kernel/include/eep48.hrl`](../library/kernel/include/eep48.hrl)), MD5 des blocs significatifs, comparaison et suppression de blocs dans les fichiers, répertoires et releases, beams compressés en gzip, `build_module/1`, et serveur de clés cryptographiques avec déchiffrement des informations de débogage (via `crypto`, appelé dynamiquement : le lier avec `--with-crypto`) |
| [`io_ansi`](../library/stdlib/io_ansi.erl) | Chaque fonction documentée en Erlang : séquences de terminal virtuel d'OTP 29 sous forme de séquences ANSI intégrées utilisées par OTP sans terminfo (les requêtes terminfo répondent `{error, enotsup}`), `format/1,2,3` et `render/1,2` au-dessus d'`io_lib`, `fwrite/1,2,3,4` comme requêtes `put_ansi` rendues par le serveur d'entrée standard, `scan/1`, et `enabled/0,1` selon l'indicateur de terminal du périphérique ([module io](builtins.md#io-module)) |
| [`win32reg`](../library/stdlib/win32reg.erl) | Chaque fonction documentée : analyse des clés d'OTP (racines, chemins absolus, relatifs et `..`), clé courante, valeurs entières, chaînes et binaries, listes et suppressions via le pilote du registre Windows ([le registre](ports.md#the-registry)) ; `{error, enotsup}` ailleurs, comme OTP |
| [`argparse`](../library/stdlib/argparse.erl), [`clause_argparse`](../library/stdlib/clause_argparse.erl) | Chaque fonction : validation avec les erreurs d'OTP, analyse (options, indicateurs, `nargs`, actions, types avec choix, limites et expressions régulières, types personnalisés, sous-commandes, préfixes, valeurs par défaut) avec les maps d'arguments et erreurs d'OTP, `help/1,2` avec la mise en page et les modèles d'OTP, `run/3` avec chaque forme de gestionnaire, sous forme de builtins du runtime qui demandent à Erlang d'appeler les funs ([argparse](builtins.md#argparse)) ; sans `progname`, le nom du programme lui-même |
| [`escript`](../library/stdlib/escript.erl) | `create/2` et `extract/2` suivant la structure des sections et la lecture des en-têtes d'OTP (lignes de shebang, de commentaire et d'arguments de l'émulateur ; corps source, beam et archive via `zip`) ; `script_name/0` est le chemin de l'exécutable ; l'exécution d'escripts (`start/0,1`, `parse_file/1`) est déclinée |
| [`filename`](../library/stdlib/filename.erl) | Chaque fonction documentée selon les règles Unix et Windows d'OTP pour l'hôte ; les parcours de noms sont des builtins du runtime, `absname/1,2` et `basedir/2,3` (à partir de `HOME`, des variables XDG et d'`APPDATA`) en Erlang ([filename](builtins.md#filename)) |
| [`uri_string`](../library/stdlib/uri_string.erl) | Chaque fonction documentée sous forme de builtin du runtime : analyse RFC 3986 avec les fragments d'erreur d'OTP, recomposition, normalisation, résolution, codage pourcent et requêtes form-urlencoded ([uri_string](builtins.md#uri-string)) |
| [`json`](../library/stdlib/json.erl) | Chaque fonction documentée avec les iodata, les erreurs et l'ordre des rappels d'OTP ; `decode/1`, `encode/1`, `format/1,2` et les fonctions d'échappement de binaries sont des builtins du runtime, les encodeurs et formateurs prenant des funs et les décodeurs à rappels sont en Erlang ([encodages](builtins.md#encodings)) |
| [`rand`](../library/stdlib/rand.erl), [`random`](../library/stdlib/random.erl) | Chaque fonction documentée avec les états et séquences d'OTP ; les algorithmes d'OTP s'exécutent sous forme de builtins du runtime, les générateurs greffons en Erlang ([nombres aléatoires](builtins.md#random-numbers)) |
| [`string`](../library/stdlib/string.erl) | Chaque fonction documentée sous forme de builtin du runtime, parcourant chardata comme `string.erl` d'OTP pour conserver les formes de résultats d'OTP ([string](builtins.md#string)) |
| [`base64`](../library/stdlib/base64.erl) | Chaque fonction documentée sous forme de builtin du runtime ([encodages](builtins.md#encodings)) |
| [`array`](../library/stdlib/array.erl) | Chaque fonction documentée au-dessus du record d'OTP 29 ; les opérations sur le record sont des builtins du runtime, les folds et mapfolds sont en Erlang ([collections](builtins.md#collections)) |
| [`gb_trees`](../library/stdlib/gb_trees.erl), [`gb_sets`](../library/stdlib/gb_sets.erl), [`queue`](../library/stdlib/queue.erl) | Chaque fonction documentée au-dessus des formes d'arbres et de files d'OTP ; les opérations sans funs sont des builtins du runtime ([collections](builtins.md#collections)) |
| [`dict`](../library/stdlib/dict.erl), [`sets`](../library/stdlib/sets.erl) | Chaque fonction documentée au-dessus des records d'OTP (ensembles de version 1) et des maps (version 2) ; les opérations sans funs sont des builtins du runtime ([collections](builtins.md#collections)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (serveur d'entrée standard ou fichier ouvert), `fread/2,3` (requête `get_until` au-dessus d'`io_lib:fread/3`), `read/1..4`, `scan_erl_exprs/1..4`, `scan_erl_form/1..4`, `parse_erl_exprs/1..4`, `parse_erl_form/1..4` (requêtes `get_until` au-dessus d'`erl_scan:tokens/3,4`, analysées par `erl_parse`), `request/1,2`, `requests/1,2` (protocole d'E/S d'OTP, [fichiers](ports.md#standard-io-and-files)), `getopts/0,1`, `setopts/1,2`, `columns/0,1`, `rows/0,1` (taille du terminal via les builtins de `clause_io`), `get_password/0,1`, `write/1,2` ; `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` et `nl/0,1` sont des builtins du runtime ([io](io.md)) |
| [`io_lib`](../library/stdlib/io_lib.erl) | Fonctions d'écriture, vérifications, fonctions de collecte, moteur de formatage, affichage formaté (`print/1,4`, `~p`, `chars_limit`) et analyseur (`fread/2,3`) sous forme de builtins du runtime avec les formes de listes imbriquées d'OTP, funs `maps_order` triant les clés dans `clause_io_lib` ; `get_until`, `format_prompt` et `write/3` en Erlang ([io_lib](builtins.md#io_lib)) |
| [`sofs`](../library/stdlib/sofs.erl), [`clause_sofs`](../library/stdlib/clause_sofs.erl) | Chaque fonction ; les opérations sur les données sont des builtins du runtime, les fonctions prenant des funs et les conversions de digraphes sont en Erlang ([ensembles d'ensembles](builtins.md#sets-of-sets)) |
| [`ets`](../library/stdlib/ets.erl) | Tables, lectures, écritures, parcours et mises à jour sous forme de builtins du runtime au-dessus des tables du runtime ; `foldl/3`, `foldr/3`, `i/0..3` et `fun2ms/1` en Erlang ; spécifications de correspondance (familles select, match, match_spec) comme builtins au-dessus de l'interpréteur du runtime, `match_spec_run/2`, `test_ms/2`, `repair_continuation/2`, `match_delete/2` et `init_table/2` en Erlang ; fichiers de tables (`tab2file/2,3`, `file2tab/1,2`, `tabfile_info/1`) en Erlang au-dessus de `file` et `clause_disk_log` ; `to_dets/2` et `from_dets/2` en Erlang au-dessus de `dets` ; `table/1,2` en Erlang au-dessus de `qlc:table/2` ([ets](builtins.md#ets)) |
| [`graph`](../library/stdlib/graph.erl) | Chaque fonction au-dessus du record d'OTP ; les requêtes et parcours sont des builtins du runtime, les mises à jour sont en Erlang ([graph](builtins.md#graph)) |
| [`digraph`](../library/stdlib/digraph.erl), [`digraph_utils`](../library/stdlib/digraph_utils.erl) | Chaque fonction au-dessus du record à trois tables d'OTP ; les mises à jour et lectures sont en Erlang au-dessus d'`ets`, les recherches de chemins et les parcours de digraph_utils sont des builtins du runtime lisant les tables, `subgraph/2,3` et `condensation/1` en Erlang ([digraph](builtins.md#digraph)) |
| [`dets`](../library/stdlib/dets.erl), [`clause_dets`](../library/stdlib/clause_dets.erl) | Chaque fonction documentée : processus de serveur et de tables d'OTP en Erlang au-dessus d'un moteur C++ du format de fichier version 9 d'OTP, fichiers identiques octet par octet à ceux écrits par OTP ; `table/1,2` en Erlang au-dessus de `qlc:table/2` ([dets](builtins.md#dets)) |
| [`ms_transform`](../library/stdlib/ms_transform.erl) | Chaque fonction en Erlang au-dessus du format abstrait : `parse_transform/2` traduit les funs littérales données à `ets:fun2ms/1` et `dbg:fun2ms/1` dans les formes d'un module, `transform_from_shell/3` les clauses d'une fun du shell, avec les spécifications de correspondance, avertissements de masquage et codes d'erreur d'OTP. Un module utilisant la transformation à la compilation exécute toujours le `ms_transform` de l'OTP de l'hôte ([transformations syntaxiques](transforms.md)) |
| [`qlc_pt`](../library/stdlib/qlc_pt.erl), [`clause_qlc_pt`](../library/stdlib/clause_qlc_pt.erl) | La transformation syntaxique qlc à l'exécution (non documentée dans OTP) : `transform_expression/2`, `transform_from_evaluator/2` et `parse_transform/2` comme builtins du runtime avec le code de requête généré, les messages et annotations d'OTP ; `ms_transform` s'exécute en Erlang sur demande ([qlc_pt](builtins.md#qlc-pt)). Les modules compilés incluant `qlc.hrl` utilisent toujours la transformation de l'OTP de l'hôte ([transformations syntaxiques](transforms.md)) |
| [`qlc`](../library/stdlib/qlc.erl) | Chaque fonction en Erlang, écrite d'après la documentation d'OTP : descripteurs de requêtes compilées (descripteurs `qlc_lc` d'OTP issus de la transformation), listes, tables `table/2`, `append/1,2`, `sort/1,2` et `keysort/2,3` ; évaluation avec recherches constantes, spécifications de correspondance, jointures par fusion et par recherche, `cache` (`ets`, `list` débordant vers des fichiers temporaires), `unique`, tris `file_sorter`, curseurs sous forme de processus, `info/1,2` au-dessus d'`erl_pp`, `string_to_handle/1,2,3` au-dessus de `qlc_pt`, termes d'erreur d'OTP et `format_error/1`. Descripteurs, tables, clés du dictionnaire de processus et noms de fichiers temporaires sont ceux d'OTP. [`stdlib/include/qlc.hrl`](../library/stdlib/include/qlc.hrl) nomme la transformation `qlc`, qui s'exécute sur l'OTP de l'hôte ([qlc](builtins.md#qlc)) |
| [`shell`](../library/stdlib/shell.erl), [`clause_shell`](../library/stdlib/clause_shell.erl), [`clause_shell_eval`](../library/stdlib/clause_shell_eval.erl), [`clause_shell_commands`](../library/stdlib/clause_shell_commands.erl), [`clause_shell_records`](../library/stdlib/clause_shell_records.erl) | Chaque fonction documentée en Erlang, écrite d'après la documentation d'OTP : shell interactif sur l'entrée standard ([shell interactif](#interactive-shell)) : invites, bannière, historique (`e/1`, `v/1`, `h/0`), liaisons, records (`rd`, `rr`, `rl`, `rp`, `rf`), fonctions, types et spécifications définis à l'invite, rapports d'exception via `erl_error`, résultats affichés comme dans OTP (profondeur 30, records), shells restreints, `catch_exception/1` et fonctions de réglage |
| [`shell_default`](../library/stdlib/shell_default.erl), [`c`](../library/stdlib/c.erl) | Chaque fonction : commandes de `c` avec la sortie d'OTP (`i/0`, `regs/0`, `m/0,1`, `ls/0,1`, `flush/0`, `help/0`, ...) ; la compilation (`c/1,2,3`, `lc/1`, `nc/1,2`), `xm/1` et `y/1,2` signalent l'appel échoué comme OTP sans compiler, tools ni parsetools ; `h/1,2,3` ne trouvent aucune documentation dans le code lié ; les commandes `i` du débogueur signalent l'application manquante |
| [`edlin`](../library/stdlib/edlin.erl), [`edlin_expand`](../library/stdlib/edlin_expand.erl) | `edlin:keymap/0` (raccourcis de l'éditeur de ligne appelant ; `undefined` en dehors) ; `edlin_expand:expand/1,2` en Erlang : complétion des modules, fonctions (arités `Mod:`, `fun Mod:Fun/`), BIF, commandes du shell, fonctions définies dans le shell, mots-clés, liaisons, noms et champs de records, clés de map et chemins de fichiers, avec les sections et correspondances historiques d'OTP ; les arguments d'un appel sont suggérés comme en-têtes `Mod:Fun/Arity` (le code lié n'a aucune spécification) |
| [`shell_docs`](../library/stdlib/shell_docs.erl), [`clause_shell_docs_markdown`](../library/stdlib/clause_shell_docs_markdown.erl) | Chaque fonction en Erlang, écrite d'après la documentation d'OTP : `render/2..5`, `render_type/2..5` et `render_callback/2..5` d'un bloc `docs_v1` donné (`application/erlang+html`, `text/markdown` converti comme par le shell d'OTP, autres formats `text/` tels quels) avec la mise en page, les retours à la ligne, les puces et styles ANSI d'OTP, `normalize/1`, `validate/1`, `supported_tags/0` ; identique à OTP sur les 51,249 rendus des propres blocs de documentation d'OTP 29. Le code lié n'a aucun bloc propre (`code:get_doc/1`) |
| [`erl_parse`](../library/stdlib/erl_parse.erl), [`clause_erl_parse`](../library/stdlib/clause_erl_parse.erl) | Chaque fonction : `parse_form/1`, `parse_exprs/1`, `parse_term/1` et les `parse/1`, `parse_and_scan/1` de yecc au-dessus d'un analyseur du runtime avec le format abstrait et les erreurs d'OTP ; `normalise/1`, `abstract/1,2`, `tokens/1,2` et les tables de précédence sont des builtins ; les parcours d'annotations et `format_error/1` en Erlang ([erl_parse](builtins.md#erl-parse)) |
| [`erl_eval`](../library/stdlib/erl_eval.erl), [`clause_erl_eval`](../library/stdlib/clause_erl_eval.erl) | Chaque fonction en Erlang au-dessus du format abstrait : liaisons sous forme d'orddicts ou de maps, gestionnaires de fonctions locales et non locales (opérateurs, BIF et erreurs comme appels `erlang:raise/3` passent par ces derniers), funs interprétées avec l'environnement d'OTP, comprehensions avec générateurs stricts et zip, `maybe`, native records, `receive` au-dessus de `prim_eval` ; filtrage par motifs, segments de syntaxe binaire et réduction des constantes sont des builtins du runtime ([erl_eval](builtins.md#erl-eval)). `exprs/2` et `expr/2` vérifient une commande avec `erl_lint:exprs_opt/3` ; `qlc:q/1,2` d'une compréhension de liste de requête passe par `qlc:transform_from_evaluator/2` avec les appels locaux masqués, comme dans OTP |
| [`erl_error`](../library/stdlib/erl_error.erl) | Chaque fonction en Erlang au-dessus d'`io_lib` : `format_exception/3,4` et les formateurs internes (`format_exception/6,7,8`, `format_stacktrace/4,5`, `format_call/4,5`, `format_fun/1,2`) avec les explications, mises en page, rappels `error_info` et options d'OTP. Les propres traces de pile de Clause n'ont ni emplacements ni `error_info` ([différences](differences.md#errors-stack-traces-and-reports)), donc leurs rapports n'affichent ni l'un ni l'autre |
| [`erl_pp`](../library/stdlib/erl_pp.erl), [`clause_erl_pp`](../library/stdlib/clause_erl_pp.erl) | Chaque fonction ; l'affichage est un builtin du runtime ([erl_pp](builtins.md#erl-pp)) : formes, attributs, types et spécifications, fonctions, guards et expressions avec la mise en page (largeur de ligne, indentation, fragments de chaînes, parenthèses de précédence) et les options d'OTP ; les hooks et `legalize_vars/1` s'exécutent ici ; identique à OTP sur les formes de 347 sources et suites d'OTP, et sur 80 d'entre elles avec cinq jeux d'options, hooks inclus |
| [`erl_lint`](../library/stdlib/erl_lint.erl), [`clause_erl_lint`](../library/stdlib/clause_erl_lint.erl) | Chaque fonction ; les vérifications sont des builtins du runtime ([erl_lint](builtins.md#erl-lint)) avec les erreurs, avertissements, options et ordre d'OTP, et les textes de `format_error/1` ; le `behaviour_info/1` des comportements est appelé ici, et `is_guard_test/3` interroge d'abord sa fun sur les appels locaux ; identique à OTP sur 481 sources et suites d'OTP, 474 extraits de suites et 816 expressions de commandes |
| [`erl_expand_records`](../library/stdlib/erl_expand_records.erl) | `module/2` est un builtin du runtime ([erl_expand_records](builtins.md#erl-expand-records)) : records de tuples développés en opérations sur tuples, native records et native records importés conservés, appels d'imports et de BIF qualifiés par leur module, tests de guard `is_record/3` transformés en motifs, avec les options `dialyzer`, `expand_inits` et `[no_]strict_record_tests` ; identique à OTP sur les formes de 347 sources et suites de tests d'OTP |
| [`epp`](../library/stdlib/epp.erl), [`clause_epp`](../library/stdlib/clause_epp.erl) | Chaque fonction en Erlang sauf les conditions `-if`, évaluées par un builtin ([epp](builtins.md#epp)) : un serveur par source ouvert avec les formes, macros (arguments, surcharge, `??Arg`, `?FUNCTION_NAME`, macros prédéfinies et de l'option `macros`), inclusions, conditions, `-file`, `-feature`, `-error`/`-warning`, fichiers de documentation et erreurs d'OTP ; les fichiers sont lus en entier et décodés selon leur commentaire d'encodage. Identique à OTP sur 1,110 appels `parse_file`/`scan_file` sur des sources et suites d'OTP. `-include_lib` trouve les en-têtes uniquement via le chemin d'inclusion en attendant `code:lib_dir/1` |
| [`erl_scan`](../library/stdlib/erl_scan.erl) | Chaque fonction : `string/1,2,3` et les `tokens/3,4` réentrants au-dessus d'un analyseur lexical du runtime avec les jetons, annotations, options, rappels et erreurs d'OTP ; accesseurs et `format_error/1` en Erlang ([erl_scan](builtins.md#erl-scan)) |
| [`erl_internal`](../library/stdlib/erl_internal.erl), [`erl_anno`](../library/stdlib/erl_anno.erl) | Chaque fonction sous forme de builtin du runtime : tables des BIF, guards, tests de type et opérateurs d'OTP, fonctions prédéfinies et annotations ([tables du compilateur](builtins.md#compiler-tables)) |
| [`records`](../library/stdlib/records.erl), [`erl_features`](../library/stdlib/erl_features.erl) | Réflexion des native records, définitions à l'exécution et définitions compilées avec valeurs par défaut réduites ([native records](native-records.md#reflection)) ; fonctionnalités d'OTP 29 et celles avec lesquelles chaque module a été compilé ([tables du compilateur](builtins.md#compiler-tables)) |
| [`binary`](../library/stdlib/binary.erl) | Chaque fonction ; `replace/3,4` et `list_to_bin/1` en Erlang, les autres builtins du runtime ([module binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Chaque fonction sous forme de builtin du runtime ([module math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Chaque fonction sous forme de builtin du runtime : conversions, `bin_is_7bit/1`, marques d'ordre des octets, formes de normalisation, catégories et propriétés d'identifiants ([module unicode](builtins.md#unicode-module)) |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Chaque fonction au-dessus de tables générées, les parcours de chardata sous forme de builtins du runtime ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Chaque fonction sauf `import/1`, au-dessus de PCRE2 ([module re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Chaque fonction documentée : ouvrir, lire, écrire, positionner et fermer des fichiers (sur disque, `compressed`, ou en mémoire avec `ram`), lectures et écritures positionnées, `truncate/1`, `advise/4`, `allocate/3`, lectures et écritures de fichiers entiers, `consult/1`, `eval/1,2`, `script/1,2` et leurs formes `path_` avec `path_open/3` (fichier lu en entier et décodé selon son commentaire d'encodage, UTF-8 par défaut, comme le fait `epp:set_encoding/1` dans [`clause_epp`](../library/stdlib/clause_epp.erl), puis analysé forme par forme avec les résultats et erreurs d'OTP), informations sur les fichiers et leurs modifications (`write_file_info/2,3`, `change_*`), opérations sur les répertoires via le pilote de fichiers, `sendfile/2,5` comme solution de repli par blocs d'OTP et `format_error/1` ([fichiers](ports.md#standard-io-and-files)) |
| [`erl_posix_msg`](../library/stdlib/erl_posix_msg.erl) | Module interne d'OTP pour `file:format_error/1` : `message/1` sous forme de builtin du runtime ([messages POSIX](builtins.md#posix-messages)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl), [`clause_socket`](../library/kernel/clause_socket.erl), [`clause_socket_options`](../library/kernel/clause_socket_options.erl) | Sockets au-dessus des ports socket, avec leurs options, statistiques, états et listes ([sockets](ports.md#sockets)) ; `inet:get_rc/0` depuis `clause_inet_config` |
| [`socket`](../library/kernel/socket.erl) | Chaque fonction documentée en Erlang au-dessus des ports du pilote de sockets ([sockets](ports.md#sockets)) : descripteurs `{'$socket', Ref}` conservés par un processus et une table `clause_socket_registry` (propriétaires, états, compteurs, métadonnées, moniteurs, listes), open/bind/listen/accept/connect, send/sendto/sendmsg/sendv/sendfile/sendmmsg, recv/recvfrom/recvmsg/recvmmsg avec les erreurs de données partielles d'OTP, `nowait` comme messages de complétion sous Windows et messages select ailleurs, `cancel/2`, noms d'options et erreurs d'invalidité d'OTP, `info/0,1`, `i/0,1,2`, `supports/0,1,2` ; les appels SCTP lèvent `notsup` et les requêtes d'interfaces sont refusées, comme OTP sous Windows |
| [`gen_sctp`](../library/kernel/gen_sctp.erl) | Chaque fonction documentée : pas de SCTP, donc `open/0,1,2` répondent `{error, eprotonosupport}` après les vérifications d'options d'OTP et les autres voient une socket fermée ou étrangère ; `error_string/1` a les textes d'OTP |
| [`inet_res`](../library/kernel/inet_res.erl), [`clause_inet_config`](../library/kernel/clause_inet_config.erl) | Chaque fonction documentée en Erlang : client DNS d'OTP au-dessus de `gen_udp` et `gen_tcp` (nouvelles tentatives, serveurs de noms alternatifs, EDNS, troncature via TCP, attentes servfail, erreurs d'OTP, listes de recherche, chaînes CNAME et hostents) avec des messages encodés et décodés par le codec DNS `clause_net` ([noms réseau](builtins.md#network-names)) ; configuration du résolveur telle qu'OTP la charge sur un nœud non distribué (aucune sous Windows ; `resolv.conf` et fichier hosts ailleurs) |
| [`net`](../library/kernel/net.erl), [`clause_net`](../library/kernel/clause_net.erl) | Chaque fonction documentée : recherches d'hôtes, d'adresses et de services et listes d'interfaces comme builtins du runtime avec les résultats de prim_net, filtres en Erlang ; aucun espace de noms réseau ([noms réseau](builtins.md#network-names)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Propre à Clause : le protocole du pilote de sockets partagé par les trois modules ci-dessus |
| [`os`](../library/kernel/os.erl) | `cmd/1,2` au-dessus d'un port avec le protocole de shell d'OTP, `max_size` et `exception_on_failure` ; requêtes d'environnement, d'heure et de version, `find_executable/1,2` et `set_signal/2` comme builtins ([module os](builtins.md#os-module)) |
| [`code`](../library/kernel/code.erl) | Requêtes sur les modules chargés sans serveur de code ; chemin de code dans un terme persistant avec les modifications de chemins d'OTP, recherches `lib_dir`/`priv_dir`, `where_is_file/1`, `all_available/0`, `clash/0` ; réponses de chargement pour le code lié ([module code](builtins.md#code-module)) |
| [`application`](../library/kernel/application.erl), [`application_controller`](../library/kernel/application_controller.erl) | Chaque fonction documentée : chargement, clés, environnements, démarrages avec dépendances et phases de démarrage, arrêts, permissions et types de redémarrage avec les erreurs et rapports d'OTP, au-dessus d'un contrôleur démarré à la première utilisation et de [`clause_application_master`](../library/kernel/clause_application_master.erl) ([applications](#applications)) ; gestion des releases, boot et contrôle distribué déclinés |
| [`erlang`](../library/erts/erlang.erl) | Bouchons générés de chaque export `erlang` d'OTP 29 ; les builtins du catalogue ont des corps de substitution, `nif_error/1,2` ont un corps, les autres lèvent `{not_implemented, F, A}` lorsqu'ils sont appelés ([module erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Les réponses d'un système démarré ; `boot/1`, `restart/0,1` et `make_permanent/2` refusés ([module init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Chaque fonction sous forme de builtin du runtime ([termes persistants](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Chaque fonction ([atomics et counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Ce qu'appellent `stdlib` et `kernel` ; groupes distribution, `.beam`, émulateur et processus de purge déclinés ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Requêtes de fichiers au-dessus de `file` ; chargement et archives déclinés ([fichiers](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Chaque fonction au-dessus de la zlib épinglée ([module zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` au-dessus des étapes d'un receive compilé ([prim eval](builtins.md#prim-eval)) |
| Modules ASN.1 de `public_key` (`'OTP-PKIX'`, `'PKIX1Explicit-2009'`, ...) et [`public_key.hrl`](../library/public_key/include/public_key.hrl) | Générés à la compilation depuis [`library/public_key/asn1/`](../library/public_key/asn1) dans `library-asn1/public_key/` de l'arborescence de build ([public_key](public_key.md)) |
| [`public_key`](../library/public_key/public_key.erl), [`clause_public_key_codec`](../library/public_key/clause_public_key_codec.erl), [`clause_public_key_keys`](../library/public_key/clause_public_key_keys.erl), [`clause_public_key`](../library/public_key/clause_public_key.erl) | Application `public_key` (avec [`public_key.app`](../library/public_key/public_key.app)) : codage DER et PEM, chiffrement PEM, clés privées PKCS #8 de chaque type et certificats aux formes plain et otp au-dessus des modules générés ([public_key](public_key.md#functions), [clé publique](builtins.md#public-key)) ; clés, signatures, chiffrement RSA, génération et accord de clés, signature de certificats au-dessus de `crypto` (`clause_public_key_keys`, [clés](public_key.md#keys-and-signatures)) ; les fonctions de validation sont des bouchons |
| [`clause_asn1`](../library/asn1/clause_asn1.erl) | Le codec qu'appellent les modules générés par clau à partir des spécifications ASN.1 ([codec ASN.1](builtins.md#asn1-codec), [ASN.1](asn1.md)) ; l'application `asn1` d'OTP (`asn1ct`, `asn1rt_nif`) n'est pas fournie |
| [`crypto`](../library/crypto/crypto.erl), [`clause_crypto`](../library/crypto/clause_crypto.erl) | Application `crypto` (avec [`crypto.app`](../library/crypto/crypto.app)), au-dessus de libcrypto d'OpenSSL dans l'archive du runtime crypto ([module crypto](builtins.md#crypto-module), [OpenSSL](crypto.md)) : listes des algorithmes disponibles dans l'OpenSSL lié (`supports/0,1`, `hash_info/1`, `info/0`, `info_lib/0`), condensats et états de hachage, HMAC/CMAC/Poly1305 et états MAC, `pbkdf2_hmac/5`, `hash_equals/2`, `exor/2`, `mod_pow/3`, chiffrements et leurs états (`crypto_init/3,4`, `crypto_update/2`, `crypto_final/1`, `crypto_get_data/1`, `crypto_one_time/4,5`, `cipher_info/1`), AEAD (`crypto_one_time_aead/4,6,7`, `crypto_one_time_aead_init/4`), nombres aléatoires forts et greffons `rand` `crypto`, `crypto_cache`, `crypto_aes` et `crypto_prng1`, termes d'erreur d'OTP ; moteurs refusés (`notsup`) ; mode FIPS commutable comme celui d'OTP, ou fixé avec `clau --fips` ; clés publiques (`sign/4,5`, `verify/5,6`, chiffrement RSA, `generate_key/2,3`, `compute_key/4`, `privkey_to_pubkey/2` : RSA, DSA, DH, ECDSA/ECDH sur courbes nommées et explicites, EdDSA, X25519/X448, ML-DSA, SLH-DSA, SRP), `ec_curve/1` et `ec_curves/0` (paramètres explicites de libcrypto lié), ML-KEM (`encapsulate_key/2`, `decapsulate_key/3`) |

Les résultats et les raisons d'erreur correspondent à OTP 29, y compris les
formes d'erreur des implémentations Erlang d'OTP (`lists:map(F, x)` donne
`{case_clause, x}`, `lists:nth(0, L)` `function_clause`,
`lists:seq(1, 10, 0)` `badarg`) et de ses BIF (`lists:member/2`,
`lists:keyfind/3`, `lists:reverse/2`, les fonctions `maps` : `badarg`,
`{badmap, M}`, `{badkey, K}`). `lists:member/2` compare avec `=:=`,
`lists:keyfind/3` avec `==`. `lists:sort/1` est un builtin stable du runtime
([comparaison et ordre](terms.md#comparison-and-order)). Les traces de pile
nomment les fonctions de la bibliothèque, pas celles d'OTP.

## Shell interactif

`shell:start_interactive/0,1` démarre le shell Erlang sur les flux standard,
et `clau --shell` le lie dans un exécutable dont il est le point d'entrée sauf
si `--entry` en nomme un autre ([compilation](compile.md#options)). Le processus
`clause_shell` tient la place du `user_drv` d'OTP : il affiche la version du
système, démarre le serveur de `shell` et en démarre un nouveau lorsqu'un shell
se termine (`exit().`). Le serveur lit chaque commande via le serveur d'entrée
standard d'`io`, en réaffichant l'invite pour chaque ligne supplémentaire d'une
commande, conserve l'historique et démarre l'évaluateur, qui vérifie chaque
expression avec `erl_lint`, développe les records et l'évalue avec `erl_eval`.
Les résultats s'affichent avec les records du shell via le moteur d'affichage
formaté du runtime (`clause_io_lib:pretty/2`, [io_lib](builtins.md#io-lib)). La
fin de l'entrée termine le programme avec le code 0 après
`*** Terminating erlang (nonode@nohost)`.

Les commandes appellent les modules par leur nom, donc un programme démarrant
le shell a besoin que chaque export soit appelable : `--shell` les conserve
([exports conservés](executables.md#export-liveness)) et lie chaque module de
bibliothèque ; un programme compilé sans cette option n'atteint que les modules
qu'il nomme. Les lignes d'entrée sont lues telles que le terminal les fournit,
éditées par le terminal lui-même : il n'y a ni édition de ligne `edlin`, ni
touches d'historique, ni complétion par tabulation
([différences](differences.md#interactive-shell)).

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
  application OTP (`erts`, `kernel`, `stdlib`), puis `library-asn1/` de
  l'arborescence de build, les modules générés à la compilation à partir des
  spécifications ASN.1 de la bibliothèque ([public_key](public_key.md)).
  `-include_lib("kernel/include/logger.hrl")`, `file.hrl`, `eep48.hrl` et
  `inet.hrl` (`#hostent{}`) se résolvent vers les propres en-têtes de la
  bibliothèque sauf si le projet nomme une application `kernel` ;
  `stdlib/include/` `zip.hrl`, `qlc.hrl`, `ms_transform.hrl` (nomme la
  transformation, qui s'exécute sur l'OTP de l'hôte :
  [transformations](transforms.md)) et `assert.hrl` sauf s'il nomme une
  application `stdlib`. `assert.hrl` contient les macros, termes d'erreur et
  commutateurs `NOASSERT`, `NODEBUG`, `ASSERT` d'OTP. Les en-têtes internes
  d'OTP (`erl_bits.hrl`, `erl_compile.hrl`) et ceux de distribution (`dist.hrl`,
  `dist_util.hrl`, `net_address.hrl`) ne sont pas fournis, ni `inet_sctp.hrl`
  (pas de SCTP).
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
  `socket` sont les modules absents : les programmes utilisent à la
  place les `file`, `gen_tcp`, `gen_udp`, `inet` et `net` de Clause, et comme les
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
  `clause_unicode`, `clause_zlib`, `clause_receive`, `clause_maps`,
  `clause_hashed`, `clause_array`, `clause_features`, `clause_io_lib`,
  `clause_disk_log`, `clause_dets`) se
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
pour `erts`, `kernel`, `stdlib`, `crypto` et `public_key` : `{Module, Application, Name, Arity}.` par
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

Les `file`, `io` et `code` d'OTP appellent des serveurs enregistrés
(`file_server_2`, `code_server`, le serveur d'E/S d'un group leader) que
l'application `kernel` démarre au boot. Un exécutable Clause n'en démarre
aucun : les `file` et `io` propres à Clause n'ont besoin d'aucun serveur, le
`logger` de Clause démarre son serveur à la première utilisation, et un module
OTP qui en a besoin échoue comme il échoue sous OTP sans ce serveur (`noproc`).
Le code OTP qui appelle `code` à l'exécution ne fonctionne donc pas. Démarrer
toute l'application `kernel` n'est pas prévu.

### Applications

- Les spécifications viennent du programme, pas d'un chemin de code : clau
  compile chaque `*.app` et `*.app.src` à côté des sources du lot, chaque
  `*.app` du répertoire `ebin` voisin, et `ebin/Name.app` ou `src/Name.app.src`
  de chaque entrée `[targets.options.applications]` dans le module généré
  `clause_applications`, ajouté dès que le lot contient
  `application_controller`. Le premier fichier d'un nom d'application
  l'emporte. Une ressource ne listant aucun module reçoit les modules du lot
  voisins. Les diagnostics pointent dans le fichier de ressource.
- `application:load/1` accepte aussi des termes `{application, Name, Keys}`.
  Un nom sans ressource donne
  `{error, {"no such file or directory", "Name.app"}}`, comme la réponse d'OTP
  pour un fichier manquant.
- `kernel` (11.0.4) et `stdlib` (8.1) sont chargés et en cours d'exécution dès
  le départ tels qu'OTP 29.1.1 les liste, sans maîtres d'application ; `kernel`
  possède l'environnement par défaut de son `kernel.app`.
- Une application avec un module de démarrage obtient un maître qui dirige le
  groupe de ses processus (pour que `get_application/0`, `get_env/1` et
  `start_type/0` y répondent), relaie leurs requêtes d'E/S vers les E/S standard
  et, à l'arrêt, exécute `prep_stop/1`, arrête le processus principal, exécute
  `stop/1` et tue ce qui reste du groupe. Une application permanente qui se
  termine, ou transitoire qui se termine anormalement, arrête le programme avec
  le slogan d'OTP et le code de sortie 1.
- `logger` et `clause_logger` atteignent `application` par un nom à
  l'exécution, donc seuls les programmes utilisant `application` le lient.

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
