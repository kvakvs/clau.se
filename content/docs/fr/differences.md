---
source: docs/differences.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: d23f82e2b75a7d8717057d09d1a6e30555fb75f81b5e810be0aaa9fc83a5b22c
translatedAt: 2026-10-26
---
# Différences avec Erlang/OTP

Comportements observables pour lesquels Clause diffère sciemment de la version
d'OTP 29 de référence (`maint-29`, voir [otp-reference.md](otp-reference.md)).
Chaque entrée renvoie au contrat qui en est responsable. Retirer une entrée dès
que la différence est corrigée. Les fonctionnalités pas encore implémentées
(signalées par `notimpl`) ne figurent pas ici ; voir [features.md](features.md)
et le plan.

## Maps

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Ordre d'un générateur de map (`K := V <- M`) | Les maps plates (jusqu'à 32 clés) sont parcourues dans l'ordre des clés, mais les clés atomes dans l'ordre de la table des atomes, qui varie d'une exécution de la VM à l'autre ; les maps plus grandes dans l'ordre de hachage | Toujours l'ordre canonique des clés (ordre des termes) | [motifs](patterns.md#comprehensions) |
| Contenu de `bad_generators` pour un générateur de map dans un groupe zip | Son itérateur : une chaîne `{K, V, Next}` terminée par `none`, dans l'ordre d'OTP | La même chaîne, construite dans l'ordre canonique des clés | [motifs](patterns.md#comprehensions) |
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3`, ordre d'exécution des funs de `maps` (`intersect_with/3`, `merge_with/3`, ...), `proplists:get_keys/1`, `sets` de version 2 (`to_list/1`, `fold/3`) | Ordre interne (ordre de la table des atomes pour les clés atomes, ordre de hachage au-delà de 32 clés) ; un itérateur est une position ou une chaîne `{K, V, Next}` | Ordre canonique des clés ; un itérateur continue sur une liste de clés | [builtins](builtins.md#erts-internal) |
| Affichage des maps (`erlang:display/1`, `~w`, `~p`) | Ordre de la disposition interne (ordre de la table des atomes pour les clés atomes, ordre de hachage au-delà de 32 clés) | Ordre des clés de la map, comme `~kw` d'OTP | [termes](terms.md#printing) |
| Ordre de `digraph:vertices/1`, `edges/1`, `source_vertices/1`, `sink_vertices/1` et des ordonnancements et composantes de `digraph_utils` lorsqu'ils partent de ces listes | Ordre de hachage des tables de sommets et d'arêtes | Ordre de hachage de Clause ([ETS](#ets)) ; les chemins et listes de voisins suivent l'insertion des arêtes dans les deux cas | [builtins](builtins.md#digraph) |
| Ordre de `maps:keys/1`, `values/1`, `to_list/1`, `fold/3`, des membres écrits par `json:encode/1`, des champs donnés à une map par `erl_parse:abstract/1,2`, et des listes de sommets et parcours de `graph` | L'ordre interne de la map (ordre de la table des atomes pour les clés atomes, ordre de hachage au-delà de 32 clés) | Ordre des clés | [bibliothèque](library.md) |
| Affichage des native records (`erlang:display/1`) | Champs dans l'ordre d'index de la table des atomes | Ordre de définition, comme `~w` | [native records](native-records.md#printing-and-order) |
| `==` entre native records dont les champs ne diffèrent que par entier/flottant | Le compilateur peut le réduire à `=:=` (false) | Comparaison numérique (true) | [native records](native-records.md#printing-and-order) |
| Construction externe d'un native record d'un module non chargé | Échoue tant que le module qui le définit n'est pas chargé | Chaque module du lot est chargé au démarrage ; un module hors du lot échoue toujours | [native records](native-records.md#differences-kept) |
| Affichage des funs locales (`#Fun<M.Index.Uniq>`) | Index issu de la numérotation des lambdas par le compilateur, `Uniq` un hachage du code du module | Index parmi les funs locales du module dans l'ordre du source, `Uniq` toujours 0 | [funs](funs.md#comparison-and-printing) |
| Ordre de deux funs locales d'un même module | Selon l'index d'OTP | Selon l'index dans l'ordre du source, donc des funs de fonctions différentes peuvent être ordonnées différemment | [funs](funs.md#comparison-and-printing) |
| Noms des funs anonymes dans les traces de pile (`-f/1-fun-N-`) | `N` issu de la numérotation du compilateur | `N` compte les funs de `f/1` dans l'ordre du source | [funs](funs.md#closures) |
| Fun anonyme dans la valeur par défaut d'un champ de record | Chaque site de construction développe sa propre copie : les funs de deux sites sont différentes | Une seule fun pour la valeur par défaut : les funs de tous les sites de construction sont égales | [funs](funs.md#closures) |
| Ordre des valeurs capturées des funs créées dans des comprehensions | Variables libres de la fonction générée pour la comprehension | Ordre de définition dans la fonction englobante ; visible uniquement en comparant deux telles funs | [funs](funs.md#closures) |

## Pids, références et processus

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Minuteries ponctuelles et périodiques de `timer` autres que les envois à des pids locaux | Gérées par le processus `timer_server`, démarré sous `kernel_sup` à la première utilisation ; les signaux d'`exit_after/2,3` en proviennent | Aucun serveur de minuteries : chaque minuterie est un processus distinct, qui envoie le signal d'`exit_after` ; `cancel/1` retourne avant que ce processus ait vu l'annulation | [builtins](builtins.md#timer) |
| Numéros de pid | Le premier processus utilisateur est environ `<0.80.0>` ; les numéros sont réutilisés quand la table des pids reboucle | Le premier processus est `<0.1.0>` ; les numéros proviennent d'une seule séquence et ne sont jamais réutilisés | [termes](terms.md#pids-and-references) |
| Code après `spawn(Fun)` d'une fun d'une autre arité | L'analyse de types du compilateur peut considérer le code après l'appel comme inaccessible et le supprimer, de sorte que l'appelant renvoie le pid immédiatement | L'appelant continue ; seul le nouveau processus échoue avec `{badarity, {Fun, []}}` | [processus](processes.md#builtins) |
| Pile d'un `function_clause` levé par un builtin de `lists` (`lists:sublist/2`, `lists:max/1`, ...) | Le cadre supérieur est la fonction Erlang, souvent un auxiliaire interne (`lists:sublist_2/2`), avec ses arguments | L'appelant est au sommet : les builtins n'empilent aucun cadre | [builtins](builtins.md#lists-module) |
| Dernier bit des résultats de `math` (`math:erfc(1)`, ...) | La bibliothèque C avec laquelle OTP a été construit | La bibliothèque C liée aux programmes Clause (Windows : `0.15729920705028513` pour `erfc(1)`, OTP `0.1572992070502851`) | [builtins](builtins.md#math-module) |
| Résultat de `binary:compile_pattern/1` | `{bm, Ref}` ou `{ac, Ref}` avec une référence opaque | `{bm, [Pattern]}` ou `{ac, Patterns}` | [builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` d'un sous-binary | La taille du binary dans lequel il pointe | Sa propre taille | [builtins](builtins.md#binary-module) |
| Mémoire des termes persistants remplacés ou effacés | Récupérée par un processus de collecte des zones de littéraux qui fait copier la valeur par chaque processus en arrière-plan | Chaque processus la copie à sa prochaine tranche (ceux en attente aussitôt, par le `put`/`erase`), puis la zone est libérée ; aucun processus de collecte | [runtime](runtime.md#persistent-terms) |
| Termes persistants envoyés dans des messages | Restent partagés, comme les littéraux : le tas du destinataire ne grossit pas | Copiés dans le tas du destinataire comme tout autre terme | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` et `get/0` | Incluent les termes que `kernel` et `stdlib` d'OTP stockent au démarrage (26 sous OTP 29) | Seulement les termes propres au programme | [builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` d'un module compilé | Le fichier `.beam` depuis lequel il a été chargé | `preloaded` : chaque module est lié dans l'exécutable | [builtins](builtins.md#code-module) |
| Option `priority` de `send/3`, `link/2`, `exit/3`, `exit_signal/3` | Les messages et signaux prioritaires dépassent les ordinaires | Acceptée ; livrés comme des messages et signaux ordinaires | [processus](processes.md#builtins) |
| `spawn/2,4`, `spawn_link/2,4`, `spawn_monitor/2,4` nommant un autre nœud | Un avertissement `** Can not start ... on Node **` est journalisé | Rien n'est affiché ; le pid inutile se termine tout de même avec `noconnection` | [processus](processes.md#builtins) |
| Options de `system_flag/2` autres que `backtrace_depth` et `min_heap_size` (`fullsweep_after`, `schedulers_online`, `multi_scheduling`, `max_heap_size`, ...) | Modifient l'émulateur | Vérifiées et relues sans effet ; `system_logger` vaut initialement `undefined` (aucun processus de journalisation) ; `cpu_topology`, `erts_alloc`, `scheduler_bind_type` donnent `badarg` | [builtins](builtins.md#system-information) |
| Minuteries d'un processus suspendu (`receive ... after`, `send_after/3` et `start_timer/3` vers son pid) | Suspendues avec le processus jusqu'à sa reprise (OTP 28, 29) | Continuent de fonctionner : un délai expirant pendant la suspension est pris en compte à la reprise ; un message de minuterie attend dans sa boîte aux lettres | [processus](processes.md#suspending-processes) |
| Sortie de `process_display/2` | Vidage de pile d'OTP avec adresses et emplacements de pile | Un `Module:Function/Arity` par cadre | [processus](processes.md#builtins) |
| `process_flag(save_calls, N)` | Enregistre les N derniers appels pour `process_info(Pid, last_calls)` | Conservé et relu ; aucun appel enregistré | [processus](processes.md#builtins) |
| `adler32_combine/3`, `crc32_combine/3` avec une seconde taille supérieure à 2^31 - 1 sous Windows | Combinés | `badarg` (`z_off_t` de zlib y fait 32 bits) | [builtins](builtins.md#erlang-module) |
| `init:get_arguments/0`, `init:get_argument/1` | Les options de l'émulateur : `root`, `bindir`, `progname`, `home` et chaque `-Flag` de la ligne de commande | Seulement `home` ; un exécutable n'a pas d'options d'émulateur | [builtins](builtins.md#init-module) |
| `init:script_name/0`, `init:script_id/0` | Le chemin du script de démarrage et `{"Erlang/OTP", "29"}` | Le chemin absolu de l'exécutable et `{"Clause", "29"}` | [builtins](builtins.md#init-module) |
| `init:get_status/0`, `init:ensure_loaded/1` dans l'entrée | `{starting, started}` et chargement de code pendant que du code `escript`, `-s` ou `-eval` s'exécute au démarrage ; `{started, started}` et `not_allowed` une fois démarré | Toujours les réponses de l'état démarré | [builtins](builtins.md#init-module) |
| `init:stop/0,1`, `init:reboot/0` | Renvoient `ok` ; `init` arrête ensuite les applications et termine, pendant que l'appelant continue | Terminent immédiatement ; l'appel ne retourne jamais | [builtins](builtins.md#init-module) |
| `init:get_argument(home)` sous Windows sans `HOMEDRIVE`/`HOMEPATH` | Le dossier de profil du shell | `USERPROFILE`, normalement le même dossier | [builtins](builtins.md#init-module) |
| `erlang:halt(Slogan)`, `init:stop(Slogan)` | Affiche le slogan, écrit `erl_crash.dump` dans le répertoire courant et le signale sur stderr ; code de sortie 1 | Affiche le slogan sur stderr, n'écrit pas de crash dump ; code de sortie 1 | [exécutables](executables.md) |
| `init:restart/0,1`, `init:boot/1`, `init:make_permanent/2` | Redémarrent le système dans le même nœud, le démarrent ou fixent le script de démarrage du prochain redémarrage | Refusés : erreur `notsup`, `{error, notsup}` pour `make_permanent/2` | [builtins](builtins.md#init-module) |
| Arité de `atomics:new/2` | Tout entier positif que l'allocateur peut servir ; un entier énorme arrête le nœud avec un crash dump | De 1 à 2^27, sinon `badarg` | [builtins](builtins.md#atomics-and-counters) |
| `counters` avec `write_concurrency` | Compteurs par ordonnanceur additionnés à la lecture ; la mémoire indiquée par `info/1` croît avec le nombre d'ordonnanceurs | Un seul tableau atomics ; la mémoire indiquée par `info/1` est celle du tableau | [builtins](builtins.md#atomics-and-counters) |
| `erts_internal:term_type/1` | La représentation interne : `flatmap` ou `hashmap`, `heap_binary`, `refc_binary` ou `sub_binary`, ... | Toute map est `flatmap`, tout bitstring `sub_binary` | [builtins](builtins.md#erts-internal) |
| `erl_prim_loader:get_path/0` | Le chemin de code de démarrage | `["."]` jusqu'à `set_path/1` | [ports](ports.md#standard-io-and-files) |
| `file:read_link_info/1,2` d'un lien symbolique sous Windows | Les données propres du point d'analyse (reparse point) du lien | La taille et les dates de la cible avec le type `symlink` | [ports](ports.md#standard-io-and-files) |
| `inet:gethostbyname/1,2` | Le nom canonique et les alias du résolveur (`inet_res`, fichier hosts, natif) | Le nom demandé et aucun alias ; adresses issues du résolveur du système | [ports](ports.md#sockets) |
| Module `socket` | L'API NIF des sockets | Absents : une référence est une erreur de compilation ; utiliser `gen_tcp`, `gen_udp`, `inet` | [bibliothèque](library.md) |
| `net:getifaddrs/1,2` avec un espace de noms, `inet:getifaddrs([{netns, _}])` | `net` s'appelle indéfiniment (OTP 29) ; `inet` lit l'espace de noms sous Linux | `{error, enotsup}` | [builtins](builtins.md#network-names) |
| Listes de sortie de `zlib` | Un binary par bloc interne, imbriqué là où un flux s'est terminé et a redémarré | Un binary par appel, `[]` s'il n'y en a pas ; les octets sont ceux d'OTP | [builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` et appels `zlib` longs | Retournent après une quantité bornée de sortie (`{continue, Output}`) et cèdent la main | Décompressent toute l'entrée en attente en un seul appel (`{finished, Output}`) ; un appel long occupe son thread d'ordonnanceur | [builtins](builtins.md#zlib-module) |
| Correspondances `re` longues | `re:run/3` et la boucle globale cèdent la main après une quantité bornée de travail | Une correspondance s'exécute jusqu'au bout et occupe son thread d'ordonnanceur ; une exécution globale ne cède la main qu'entre les correspondances | [builtins](builtins.md#re-module) |
| `re:compile/2` avec `export`, `re:import/1` | Un motif exporté `{re_exported_pattern, ...}` qu'un autre nœud importe | `export` donne `badarg` ; `import/1` lève `{not_implemented, import, 1}` | [builtins](builtins.md#re-module) |
| Erreurs d'argument de `re` | `badarg` levé depuis `re:run/3` (ou `replace`, `split`) avec les arguments de l'appelant et `error_info` | `badarg` levé depuis l'auxiliaire `re` qui a rejeté l'argument, avec les arguments de cet auxiliaire | [builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` pour les modules de `kernel`, `stdlib` et `compiler`, et ceux des répertoires nommés par `code:stick_dir/1` | Toujours `false` ; `stick_dir/1` vérifie seulement que le répertoire peut être listé | [builtins](builtins.md#code-module) |
| `code:root_dir/0` et chemin de code initial | Répertoire d'installation d'OTP ; le chemin contient ses répertoires `lib/*/ebin` | Répertoire de l'exécutable ; le chemin contient les répertoires `ebin` de `lib/` voisin et d'`ERL_LIBS`, puis `"."` | [builtins](builtins.md#code-module) |
| `code:load_file/1`, `load_abs/1`, `load_binary/3`, `atomic_load/1`, `prepare_loading/1` avec du code objet valide | Chargent le module | `{error, badfile}` : chaque module est lié dans l'exécutable (D01) | [builtins](builtins.md#code-module) |
| `code:coverage_support/0` et fonctions de couverture | `true` avec le JIT ; modes et compteurs de couverture | `false` ; les autres lèvent `badarg`, comme OTP sans prise en charge de la couverture | [builtins](builtins.md#code-module) |
| `code:get_doc/1` d'un module présent dans le programme | Son bloc de documentation EEP 48 | `{error, missing}` : les exécutables n'embarquent aucune documentation | [builtins](builtins.md#code-module) |
| Formatage d'un grand terme (`io:format/1,2`) | S'exécute en code Erlang (`io_lib`) et dans le group leader, le processus peut donc être préempté pendant le formatage | S'exécute jusqu'au bout dans un seul appel de builtin ; les autres processus attendent | [builtins](builtins.md#portions) |
| Drapeaux de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` et d'autres | Seulement `trap_exit` et `min_heap_size` ; tout autre drapeau lève `badarg` | [processus](processes.md#builtins) |
| Ordre des rapports d'erreur de processus qui plantent en même temps | Ordre du logger | L'ordre dans lequel leurs workers les terminent | [processus](processes.md#workers) |
| Signaux de sortie (`exit/2`, `exit_signal/2`) vers un processus s'exécutant sur un autre ordonnanceur | Placés dans sa file de signaux et traités plus tard, pendant que l'émetteur continue | L'émetteur attend la fin de la tranche de temps de la cible, puis agit aussitôt ; observable seulement dans les délais (les messages sont mis en tampon et l'émetteur continue) | [processus](processes.md#workers) |
| `term_to_binary/1` d'une fun locale ou d'un native record | Encodé (`NEW_FUN_EXT`, ...) | `error:notsup` ; `fun M:F/A` est encodée | [builtins](builtins.md#external-term-format) |
| `term_to_binary/1` d'une map de plus de 32 clés | Ordre de hachage sauf avec `deterministic` | Toujours l'ordre des clés (les octets de `deterministic`) | [builtins](builtins.md#external-term-format) |
| `binary_to_term/1` d'un pid, port ou référence d'un autre nœud ; option `local` de `term_to_binary/2` | Identités externes ; encodage `LOCAL_EXT` | `badarg` | [builtins](builtins.md#external-term-format) |
| Limite de temps des timers | Dépend de l'unité de temps native (environ 2^49.7 ms sous Windows) | Temps relatif de 0 à 2^49-1 ms sur toutes les plateformes | [processus](processes.md#timers) |
| `unique_integer/0,1` sans `positive` | Peut être négatif | Toujours positif et croissant | [builtins](builtins.md#time) |
| Éléments `current_function`, `initial_call`, `current_stacktrace`, ... de `process_info/2` | Rapportés | `error:{notsup, Item}` ; `process_info/1` les omet | [processus](processes.md#introspection) |
| `reductions` de `process_info/2` ; `reductions`, `garbage_collection`, `io` de `statistics/1` | Comptés | 0 (non tenus) | [builtins](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Collecte avant de retourner | Collecte au prochain point sûr (safepoint) de la cible | [processus](processes.md#introspection) |
| `erlang:system_info(machine)`, donc `?MACHINE` d'`epp` et la macro qu'elle nomme | `"BEAM"`, `'BEAM'` | `"Clause"`, `'Clause'` | [builtins](builtins.md#system-information) |
| `erlang:system_info(schedulers)` d'un programme démarré avec un masque d'affinité (`start /affinity`, `taskset`) | Un ordonnanceur par processeur logique de l'hôte (32 sous un masque de 7 CPU), `schedulers_online` un par CPU du masque | Les deux un par CPU du masque : Clause démarre uniquement les threads de travail en ligne | [processus](processes.md#workers) |
| Options de réglage de `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Appliquées | Vérifiées et acceptées, non appliquées | [processus](processes.md#spawn-options) |
| `hibernate/3` | Abandonne la pile ; le processus se termine quand `M:F` retourne | Garde la pile ; le résultat de `M:F` revient à l'appelant de `hibernate/3` | [processus](processes.md#spawn-options) |
| `monitor(port, Item, Options)` avec des options | Accepté | `badarg` | [processus](processes.md#aliases) |
| `spawn_request_abandon/1` | `true` tant que la réponse est en attente | Toujours `false` : la réponse est envoyée avant le retour de `spawn_request` | [processus](processes.md#spawn-options) |
| Dernier bit de `math:log2/1` (Windows) | La version Windows d'OTP divise `log(X)` par `log(2)` (`math:log2(1.0e308)` vaut `1023.1538532253077`) | Le `log2` de la bibliothèque C (`1023.1538532253076`) | [builtins](builtins.md#math-module) |
| `phash/2`, `phash2/1,2` des pids, ports, références, funs et native records | Hachages des numéros de processus, ports et références d'OTP, de l'indice et du numéro unique d'une fun, hachage de la définition d'un record | Hachages des numéros de Clause, du module, de l'arité ou de l'indice et des captures d'une fun, des valeurs des champs d'un record ; tout autre terme donne la valeur de hachage d'OTP | [builtins](builtins.md#hashing) |
| `dict:fold/3`, `map/2`, `filter/2` avec un argument qui n'est pas une fun | `function_clause`, ou `{badfun, F}` lorsque le premier compartiment visité par OTP contient une entrée | `function_clause` | [builtins](builtins.md#collections) |
| `erlang:is_builtin/3` de `lists:reverse/2` et d'autres fonctions de bibliothèque implémentées en C | `true` | `false` : seulement les builtins du runtime et `apply/2,3` | [funs](funs.md#fun-information) |
| `pid`, `uniq`, `new_uniq` de `fun_info/1,2` pour une fun locale | Pid du créateur, sommes de contrôle du compilateur | `undefined`, MD5 du nom du module | [funs](funs.md#fun-information) |
| Contexte de `md5_init/0` | L'état de 92 octets d'OTP | L'état de 96 octets de Clause ; les condensés sont égaux | [builtins](builtins.md#hashing) |
| `erlang:delete_module/1` d'un module chargé | Rend son code ancien (`true`) | `error:notsup` : le code lié reste | [builtins](builtins.md#code-loading) |
| `erlang:prepare_loading/2` | Prépare un binary BEAM valide | Toujours `{error, badfile}` | [builtins](builtins.md#code-loading) |
| `erlang:pre_loaded/0` | Les modules de démarrage préchargés | Tous les modules du programme | [builtins](builtins.md#code-loading) |
| `list_to_pid/1` d'un numéro jamais attribué | Renvoie un terme pid | `badarg` : seuls les pids créés par ce programme sont admis | [termes](terms.md#pids-and-references) |
| `list_to_port/1` d'un numéro jamais attribué | Renvoie un terme port | `badarg` : seuls les ports ouverts par ce programme sont admis | [ports](ports.md#identity) |
| Valeurs de `port_info/1,2` | `id` est un index de table ; `memory`, `queue_size`, `locking` décrivent le pilote | `id` est le numéro du port ; `memory` et `queue_size` valent 0 ; `locking` vaut `port_level` | [ports](ports.md#builtins-and-port-messages) |
| Écriture dans un fichier ouvert en lecture seule | `{error, eacces}` sous Windows, `{error, ebadf}` ailleurs | `{error, ebadf}` partout | [ports](ports.md#standard-io-and-files) |
| Port de `win32reg` | Le port intégré `registry__drv__` (`{spawn, "registry__drv__ rw"}`), répondant aux commandes par des messages de port | Le pilote `clause_registry` (`{spawn_driver, ...}`), donnant les mêmes réponses par `port_control/3` ; `port_info/2` le nomme `clause_registry` | [ports](ports.md#the-registry) |
| Nom du programme d'`argparse` sans l'option `progname` | Le `progname` de l'émulateur (`erl`) | Le nom de l'exécutable sans son extension (`init` n'a pas de `progname`) | [bibliothèque](library.md) |
| Cadre au sommet de la pile d'une erreur de validation de commande d'`argparse` | La fonction de validation (`argparse:validate_command/2`, `validate_option/2`, une fun à l'intérieur) avec `[Entity]` | `argparse:validate/2` avec `[Entity]` | [builtins](builtins.md#argparse) |
| `escript:script_name/0` | Le chemin de l'escript, premier argument ordinaire | Le chemin de l'exécutable : un programme Clause est son propre script | [bibliothèque](library.md) |
| `escript:extract/2` avec `compile_source` | Le source compilé en beam | `{error, {compile, ...}}` : les programmes Clause n'ont pas de compilateur | [bibliothèque](library.md) |
| `erl_abstract_code:debug_info(core_v1, ...)` (Core Erlang de beam_lib) | Core Erlang issu du compilateur | `{error, failed_conversion}` : les programmes Clause n'ont pas de compilateur | [bibliothèque](library.md) |
| `zstd:get_frame_header/1` d'un en-tête de trame tronqué | Les champs de mémoire non initialisée | Les champs à zéro (`'ZSTD_frame'`, tailles 0) | [builtins](builtins.md#zstd-module) |
| `file:open/2` avec `raw` ou `ram` | Un record `#file_descriptor{}` servi dans l'appelant (`is_pid/1` false) ; les requêtes `io` échouent ; un fichier `ram` n'a pas de `read_line/1` (`undef`) et répond `{error, einval}` une fois fermé | Un pid de serveur de fichiers comme les autres fichiers ; les E/S positionnées et `sendfile/5` répondent comme pour les fichiers raw d'OTP ; un fichier `ram` répond `{error, enotsup}` à `read_line/1` et aux requêtes d'E/S, et `{error, terminated}` une fois fermé | [ports](ports.md#standard-io-and-files) |
| `file:truncate/1` sur un fichier ouvert uniquement en lecture | L'erreur de la plateforme (`eacces` sous Windows, `einval` ailleurs) | L'erreur du runtime C pour le descripteur (`ebadf` ou `einval`) ; le serveur s'arrête comme celui d'OTP | [ports](ports.md#standard-io-and-files) |
| Fichiers ouverts ou réglés sur `{utf16, _}` ou `{utf32, _}` | Lignes et caractères décodés dans l'encodage | Les lignes se terminent à un octet 10 avant leur décodage | [ports](ports.md#standard-io-and-files) |
| Séquences d'`io_ansi` sous Linux et macOS | Issues de la base terminfo de `TERM` lorsqu'elle possède la capacité (`setaf`, `sgr0`, ...) ; `tput/1,2`, `tigetnum/1`, `tigetflag/1`, `tinfo/0` la lisent | Les séquences ANSI intégrées utilisées par OTP sans terminfo (comme OTP sous Windows) ; `tigetnum/1`, `tigetflag/1`, `tinfo/0` répondent `{error, enotsup}`, `tput/1,2` lèvent `{enotsup, Capability}` ; `enabled/0,1` exige un `TERM` autre que `dumb` | [bibliothèque](library.md#contents) |
| `io_ansi:scan/1` et `tput/1,2` sous Windows | Échouent avec `try_clause` sur le résultat `{error, enotsup}` de terminfo | `scan/1` reconnaît les séquences intégrées ; `tput/1,2` lèvent `{enotsup, Capability}` | [bibliothèque](library.md#contents) |
| `socket` sous Windows : `recvmsg`, `sendmsg`, `sendfile`, `sendmmsg`, `recvmmsg` | Lèvent `notsup` | Fonctionnent comme sous Linux et macOS | [bibliothèque](library.md#contents) |
| `socket` sous Windows : datagramme plus long que la longueur de `recv` | `{error, {completion_status, ...more_data...}}` | Le datagramme tronqué, comme ailleurs | [bibliothèque](library.md#contents) |
| `socket` sous Linux et macOS : `ioctl/2,3,4`, `getopt_native/3`, `setopt_native/3`, `open/1,2` d'un descripteur, domaine `local`, SCTP | Pris en charge | Refusés comme OTP les refuse sous Windows (`{error, {invalid, ...}}`, `notsup`) ; `local` donne `{error, eafnosupport}` | [bibliothèque](library.md#contents) |
| `socket:info/1`, `i/0,1,2` | Les compteurs et états du NIF, `fd` le descripteur | Compteurs des appels effectués, états suivis par le module ; `Fd` est le numéro du port | [bibliothèque](library.md#contents) |
| Réponses d'`inet_res` | Les réponses de `gethostbyname`, `getbyname` et `gethostbyaddr` sont mises en cache par TTL dans `inet_db` ; une recherche en cache peut lister les adresses dans un autre ordre | Aucun cache : chaque recherche interroge les serveurs de noms | [bibliothèque](library.md#contents) |
| Configuration du résolveur sous Linux et macOS | `inet_db` lit aussi `host.conf`/`nsswitch.conf` et les fichiers `inetrc`, suit les changements de `resolv.conf` et, sous Linux, déduit le domaine du nom d'hôte | Les lignes `nameserver`, `domain` et `search` de `resolv.conf` et le fichier hosts, lus une seule fois | [bibliothèque](library.md#contents) |
| `os:set_signal(Signal, handle)` (Linux, macOS) | Le signal est envoyé à `erl_signal_server`, dont le gestionnaire par défaut arrête le système sur `sigterm`, le termine sur `sigusr1` et `sigquit` | Aucun `erl_signal_server` : `sigterm` et `sigquit` terminent avec le code 0, `sigusr1` avec le code 1, les autres sont ignorés ; sans `set_signal`, `SIGTERM` conserve l'action par défaut du système | [ports](ports.md#subprocesses) |
| Arguments vides de `{spawn_executable, F}` sous Windows | Supprimés de la ligne de commande | Transmis sous forme `""` | [ports](ports.md#subprocesses) |
| `{exit_status, S}` et `eof` d'un programme lancé | Ordre non spécifié, `exit_status` peut arriver avant les dernières données | Après toutes les données, avant `eof` | [ports](ports.md#subprocesses) |
| Ports occupés | Un port avec trop de sortie en attente suspend les émetteurs, ports socket compris ; `force` de `port_command/3` fonctionne sur les pilotes qui le permettent | Seuls les ports des programmes lancés deviennent occupés ; les ports `fd` et socket jamais ; `force` lève `notsup` sur tous les pilotes | [ports](ports.md#busy-ports) |
| `{active, N}` des sockets | Un entier `N` compte les messages avant `{tcp_passive, S}` | `exit(badarg)` ; seulement `true`, `false` et `once` | [ports](ports.md#sockets) |
| Options propres à `inet_drv` (`header`, `deliver`, `exit_on_close`, `send_timeout`, `send_timeout_close`, `delay_send`, seuils, `packet_size`, `show_econnreset`, `buffer`, `read_packets`, `recvtos`, `recvttl`, `line_delimiter`) | Appliquées | Conservées et rapportées par `getopts/2` avec les valeurs par défaut d'OTP, sans être appliquées ; les options du système (`nodelay`, `keepalive`, `linger`, tampons, `tos`, multicast, ...) sont appliquées | [ports](ports.md#sockets) |
| Autres options de socket (`{packet, line \| http \| ...}`, `{raw, ...}`, `bind_to_device`, `netns`) | Fonctionnent | `exit(badarg)` à l'ouverture, `{error, einval}` depuis `setopts/2` et `getopts/2` | [ports](ports.md#sockets) |
| `inet:getopts(S, [multicast_if])` sous Windows | Lit de la mémoire non initialisée pour une socket TCP, et l'adresse générique après qu'une socket UDP en a défini une | La valeur du système ; l'adresse générique lorsque la socket n'en a pas | [ports](ports.md#sockets) |
| `port_info(Socket, input \| output)`, `input` et `output` d'`inet:info/1` | Les octets des commandes et réponses du pilote | 0 : le trafic des sockets est compté uniquement par `inet:getstat/1,2` | [ports](ports.md#sockets) |
| Raisons d'erreur des sockets | Toute raison POSIX signalée par le système | Les plus courantes (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...) ; les autres deviennent `eio` | [ports](ports.md#sockets) |
| Entrée d'un port pendant que le processus connecté détient 1 024 messages et peut s'exécuter | Continue à lire et à livrer | Cesse de livrer jusqu'à la fin de la tranche de temps du processus ; au-delà de 64 Kio détenus, cesse de lire, et le programme qui écrit se bloque | [ports](ports.md#busy-ports) |
| `gen_tcp:close/1` avec de la sortie en attente | Attend, au plus selon le réglage `linger`/`send_timeout`, que la sortie soit partie | Retourne immédiatement ; le thread d'E/S envoie la sortie en attente, puis ferme | [ports](ports.md#sockets) |
| Types de `monitor/2` | `process`, `port`, `time_offset` | `process` et `port` ; `time_offset` lève `badarg` (pas de changement de décalage temporel) | [processus](processes.md#monitors) |
| `exit/2`, `exit_signal/2` vers une référence | Envoie à l'alias de processus, si la référence en est un actif | Rien : les signaux de sortie ne vont jamais vers les alias | [processus](processes.md#exit-signals) |
| Numéros de référence | Combinent un identifiant d'ordonnanceur et des compteurs par ordonnanceur (`#Ref<0.178111994.4235460610.214105>`) | Un seul compteur pour tout le programme (`#Ref<0.0.0.1>`), les références sont donc ordonnées par création | [termes](terms.md#pids-and-references) |

## Erreurs, traces de pile et rapports

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Emplacements des traces de pile | `[{file, F}, {line, L}]`, `error_info` pour `error/3` | Toujours `[]` ; aucun `error_info`, donc `erl_error:format_exception/3,4` n'affiche pour eux ni emplacement ni ligne `*** argument` | [ABI](abi.md#stack-traces) |
| `erlang:raise/3` avec des entrées de pile `{Fun, Args}` | Acceptées | Rejetées | [ABI](abi.md#stack-traces) |
| Cadre supérieur de `function_clause` | Liste des arguments | Arité | [ABI](abi.md#stack-traces) |
| Cadre au sommet pour `undef` d'un appel `M:F(A1, ..., An)` | `{M, F, [A1, ..., An], []}` | `{M, F, N, []}` : l'arité à la place des arguments (`apply/3` et les appels de funs affichent les arguments) | [funs](funs.md#dynamic-calls) |
| Appel dynamique d'un export qu'un exécutable ne peut pas atteindre (son module n'est nommé que par une trace de pile, une exception ou un message venu de l'extérieur du programme) | L'appelle | `undef`, sauf avec `--keep-exports` ; `function_exported/3` et `module_info(exports)` le listent quand même | [exécutables](executables.md#export-liveness) |
| Cadres des BIF/opérateurs en échec | Présents (`{erlang, '+', Args, ...}`) | Absents ; rien sous la fonction d'entrée | [ABI](abi.md#stack-traces) |
| Table des atomes pleine (`list_to_atom/1`) | L'émulateur s'arrête (`no more index entries in atom_tab`) et écrit un crash dump | `clau: runtime failure: entry call failed: resource_limit`, code de sortie 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` avec des caractères au-delà de 255 | Ses premiers chiffres n'utilisent que l'octet de poids faible de chaque caractère (`[16#131]` donne 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` d'un BIF | Vrai pour tout BIF de l'émulateur | Vrai seulement pour les builtins fournis par ce runtime | [builtins](builtins.md#how-calls-reach-them) |
| Rapports d'erreur des processus plantés | Envoyés au logger, écrits plus tard par son gestionnaire par défaut (sur la sortie standard sous `erl`, souvent perdus quand un escript s'arrête avant) | Écrits sur stderr à la fin du processus, avant toute sortie ultérieure ; ce n'est pas un événement `logger`, donc les gestionnaires et filtres ne le voient pas | [processus](processes.md#exits) |
| Appels de fonctions qui ne retournent jamais | Compilés en appels terminaux (appelant absent de la trace) | Appels ordinaires (appelant présent) | [ABI](abi.md#stack-traces) |
| Exceptions dans une fun anonyme connue à `-O2` (`F = fun ... end, F(X)`, `lists:map(fun ... end, L)` et les autres boucles de listes, `maps:fold(fun ... end, A, M)`) | Cadres de la fun (`-f/1-fun-0-`) et des auxiliaires de `lists` et `maps` (`lists:map_1/2`) | Le corps de la fun est intégré dans l'appelant : ces cadres sont absents, et une queue de liste impropre dans `map/2`, `foldl/3`, `all/2`, `any/2`, `flatmap/2` lève `function_clause` avec l'appelant au sommet | [funs](funs.md#inlined-funs) |
| Mémoire de l'hôte épuisée | L'émulateur signale qu'il ne peut pas allouer de mémoire, écrit un crash dump et s'arrête | `clau: runtime failure: entry call failed: out_of_memory`, code de sortie 70, pas de dump | [tas du runtime](runtime-heap.md#failure-behavior) |
| Stockage des maps de plus de 32 clés | Un HAMT sur le tas, à nœuds hachés à 16 branches | Un arbre B+ sur le tas, d'au plus 16 entrées par nœud dans l'ordre des clés ; les tailles de tas des grandes maps diffèrent de celles d'OTP | [tas du runtime](runtime-heap.md#map-trees) |
| Plafond mémoire par processus | `max_heap_size` (en mots, tas et pile) tue le processus avec la raison `killed` et journalise un rapport d'erreur | `--max-heap` / `--max-stack` (octets) et `--max-memory`, valable pour tout le runtime, font échouer le processus demandeur avec `resource_limit` : `clau: runtime failure: entry call failed: resource_limit`, code de sortie 70 | [tas du runtime](runtime-heap.md#runtime-memory-limit) |
| Arguments du programme | `escript` transmet tous les arguments à `main/1` ; les options de l'émulateur (`+t`) viennent de `%%!` ou de `ERL_FLAGS` | Les options du runtime placées en tête (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--min-heap-size`, `--args-file`, `--`) sont retirées d'abord ; `CLAUSE_FLAGS` contient les mêmes options | [exécutables](executables.md#runtime-options) |
| Exception non capturée dans un module d'entrée ordinaire | `escript` sort avec le code 127 | Sort avec le code 1 et une ligne `uncaught exception <class>: <reason>` (les sources escript gardent 127) | [exécutables](executables.md) |
| Diagnostics du compilateur | Formulation d'`erl_lint` (`variable 'X' is unbound`) et avertissements | Formulation propre (`unbound variable X`) ; les avertissements de lint d'OTP ne sont pour la plupart pas émis (y compris les avertissements sur les native records : champs inconnus dans les accès, mises à jour et motifs, construction qualifiée par le module lui-même sans valeurs, records inutilisés ou définis dans un en-tête ; un motif ultérieur qui filtre un nom exporté d'une branche) | [sémantique](semantic.md#bindings) |
| Module de behaviour avec une `behaviour_info/1` écrite à la main | L'appelle lors de la compilation des utilisateurs et avertit des callbacks manquants, mal définis ou obsolètes | Non évaluée : les callbacks de ses utilisateurs ne sont pas vérifiés | [sémantique](semantic.md#behaviours) |
| Modules de behaviour ni dans le lot ni dans la bibliothèque Clause (`application`, ...) | Chargés depuis le chemin de code ; leurs callbacks sont vérifiés | Avertissement `behaviour M undefined` | [semantic](semantic.md#behaviours) |
| Gestionnaire par défaut de `logger` | `logger_std_h` écrit de façon asynchrone avec protection contre la surcharge (modes synchrone, abandon et purge, limites de rafale, arrêt en surcharge) | Également sur `standard_io` (`standard_error` avec `CLAUSE_LOGGER_TYPE=standard_error`), mais chaque événement est écrit avant le retour de l'appel de journalisation ; les options de surcharge sont vérifiées et conservées sans effet | [bibliothèque](library.md) |
| Processus gestionnaires de `logger_std_h` | Supervisés par `logger_sup`, redémarrés après `overload_kill_restart_after` | Liés au serveur `logger` ; un gestionnaire dont le processus meurt est retiré | [bibliothèque](library.md) |
| `net_adm:names/0,1` | Interroge epmd : `{ok, Names}` lorsqu'un epmd fonctionne sur l'hôte | `{error, address}` : Clause n'a pas de client epmd | [bibliothèque](library.md) |
| `net_kernel:start/1,2` | Démarre la distribution, ou donne l'erreur d'OTP en cas d'échec | Indisponible (`not_implemented`) | [bibliothèque](library.md) |
| Traçage : `erlang:trace/3`, `trace_pattern/2,3`, `trace_info/2`, `trace_delivered/1`, `system_monitor/0,1,2`, `system_profile/0,2`, `seq_trace/2`, `seq_trace_info/1`, `seq_trace_print/1,2`, `dt_*`, le module `trace`, `erl_tracer:enabled/3`, `trace/5` | Effectuent le traçage | `error:notsup` | [builtins](builtins.md#erlang-module) |
| Jetons de `seq_trace` | Transmis avec les messages ; les numéros de série les comptent ; un traceur système reçoit les messages de trace | Conservés uniquement par processus : non transmis, numéros de série inchangés, aucun message de trace | [bibliothèque](library.md) |
| Portées de `pg` et `global` | Répliquent entre nœuds connectés ; `pg` surveille les nœuds via `net_kernel` | Un seul nœud, aucun pair ni surveillance des nœuds | [bibliothèque](library.md) |
| Ressources d'application | Fichiers `.app` trouvés sur le chemin de code au chargement ; `sys.config`, `-config` et les arguments `-App Key Value` définissent les environnements | Compilées dans l'exécutable à partir des fichiers de ressources de la compilation ; les modifier exige une recompilation ; aucun fichier ni argument de configuration | [bibliothèque](library.md#applications) |
| Applications `kernel` et `stdlib` | Démarrées à l'amorçage ; `kernel` a un maître et un superviseur principal | Chargées et actives sans maîtres : `get_supervisor(kernel)` vaut `undefined`, `info/0` les liste comme actives avec `undefined` | [bibliothèque](library.md#applications) |
| `application:ensure_all_started/3` avec `concurrent` | Démarre les applications indépendantes simultanément ; la liste suit l'ordre de fin | Les démarre l'une après l'autre, dépendances d'abord | [bibliothèque](library.md#applications) |
| `application:takeover/2` | Attend le contrôleur d'applications distribuées | Se termine avec `noproc` (aucun `dist_ac`), comme `load/2` avec des nœuds dans les deux cas | [bibliothèque](library.md#applications) |
| Requêtes d'E/S à un maître d'application | Relayées au chef de groupe sous lequel l'application a démarré | Traitées sur les E/S standard | [bibliothèque](library.md#applications) |
| `erlang:process_flag(error_handler, Module)` | Le runtime appelle `Module:undefined_function/3` et `undefined_lambda/3` pour les appels non définis | `badarg` ; `process_info/2` rapporte toujours `error_handler`, et les appels non définis lèvent directement `undef` ([`error_handler`](library.md) peut seulement être appelé) | [bibliothèque](library.md) |
| Détails des rapports de plantage (`proc_lib`) | Texte de l'exception d'`erl_error` avec informations d'erreur étendues ; voisins avec `current_function`, `initial_call` et `current_stacktrace` ; vraies `reductions` | Ligne de classe de l'exception et cadres de pile sans informations d'erreur étendues ; voisins sans ces éléments ; `reductions` à 0 | [bibliothèque](library.md) |
| `client_info` des rapports d'erreur de `gen_server`, `gen_statem` et `gen_fsm` | Le `current_stacktrace` du processus appelant | `[]` : Clause ne conserve pas la pile courante d'un autre processus | [bibliothèque](library.md) |
| `-behaviour` avec une valeur qui n'est pas un atome | L'avertissement affiche le terme avec `~w` (`behaviour [115,116,114] undefined`) | Affiche le texte source de l'attribut (`behaviour "str" undefined`) ; l'erreur est la même | [sémantique](semantic.md#behaviours) |
| `module_info(md5)` et le `vsn` qu'OTP en dérive | MD5 du code BEAM compilé | MD5 du source imprimé du module ; l'entier `vsn` dérivé diffère en conséquence | [sémantique](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` de l'application compiler d'OTP, `options` qui lui ont été données | La version de Clause ; `options` toujours `[]` | [sémantique](semantic.md#predefined-functions) |
| `module_info(functions)` | Liste aussi les fonctions qu'OTP génère pour les funs (`'-f/0-fun-0-'/0`) | Seulement les fonctions du source et les fonctions prédéfinies | [sémantique](semantic.md#predefined-functions) |
| `-nominal` dans `module_info(attributes)` | Conservé sous forme `{nominal,[{Name,AbstractType,Params}]}` au format abstrait | Omis | [sémantique](semantic.md#predefined-functions) |
| Une fonction d'un module de bibliothèque de Clause que Clause n'a pas implémentée (un BIF `erlang`, `lists:rmerge/2`, ...) | S'exécute | Compile ; lève `error({not_implemented, F, A})` à l'appel, avec `M:F/A` au sommet de la pile ([statuts](../library/modules.terms)) | [bibliothèque](library.md#provided-or-missing), [builtins](builtins.md#erlang-module) |
| Import d'un module hors du lot | Compile ; l'appel lève `undef` à l'exécution si le module est absent | Erreur de compilation `unknown module M` quand l'import est appelé (les imports inutilisés n'exigent pas le module) | [sémantique](semantic.md#imports) |
| Avertissement `import directive overrides auto-imported BIF` | Pour tout BIF auto-importé de `erl_internal:bif/2` | Seulement pour les BIF auto-importés que Clause implémente | [sémantique](semantic.md#imports) |

## Cas limites du langage

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Segment entier plus large que la limite des entiers, valeur au-delà (`<<V:4194241>>` entièrement à un) | Le JIT x86 réussit le filtrage avec un terme invalide ; son utilisation fait planter la VM | Pas de correspondance | [termes](terms.md#integers) |
| Groupe zip dont les générateurs souples et stricts partagent une variable | Le test de saut conserve les variables des motifs stricts dans les motifs souples | Une étape rejetée est sautée dès que les motifs stricts correspondent à eux seuls | [motifs](patterns.md#comprehensions) |
| Appel d'une fun externe, `M:F(Args)` ou `apply/3` d'un module hors du programme | Charge le module depuis le chemin de code, `undef` s'il est absent | `undef` ; les modules de bibliothèque ne rejoignent le programme que lorsqu'il les nomme par un atome littéral | [funs](funs.md#dynamic-calls), [bibliothèque](library.md#how-programs-get-them) |
| Fichiers sans `#!` passés comme escripts | `escript file.erl` saute la première ligne | Compilés comme des modules ordinaires | [exécutables](executables.md) |
| Escripts beam précompilés et escripts archives | S'exécutent | Non pris en charge | [exécutables](executables.md) |
| Nom de module d'un escript sans `-module` | `<name>__escript` plus un suffixe horodaté/unique | `<name>__escript`, déterministe | [exécutables](executables.md#escripts) |
| `include_lib` d'une application trouvée dans plusieurs répertoires `<app>-<version>` | Le chemin de code contient une seule version (le démarrage choisit la plus haute) ; aucun diagnostic | La version la plus haute sous chaque répertoire parcouru, avec un avertissement par exécution qui les liste | [préprocesseur](preprocessor.md#compatibility-policies) |
| Un `-spec` dont les types n'ont aucune valeur commune avec le résultat inféré, le domaine d'entrée ou les arguments d'un appel | Compile ; Dialyzer peut avertir | Un domaine d'entrée d'argument contredit est une erreur de compilation indiquant les types déclarés et inférés ; un résultat ou un appel contredit est un avertissement, et les types inférés sont utilisés | [analyse sémantique](semantic.md#inference) |

## ETS

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Ordre de `first/1`, `next/2`, `tab2list/1`, `foldl/3` et `i/1` sur les tables `set`, `bag` et `duplicate_bag`, et ce que numérote `slot/2` | Emplacements de hachage linéaire visités verrou par verrou ; l'ordre change quand la table grossit | Partitions, puis compartiments dans l'ordre, puis clés dans l'ordre d'insertion au sein d'un compartiment ; un emplacement est un compartiment | [runtime](runtime.md#ets-tables) |
| `ets:all/0` | Inclut les tables de `kernel` et `stdlib` d'OTP ; ordre des réponses des ordonnanceurs | Seulement les tables du programme, sans ordre particulier | [builtins](builtins.md#ets) |
| `memory` d'`info/2` | Mots alloués pour la table et ses objets | Mots des objets stockés plus les surcoûts propres à Clause | [builtins](builtins.md#ets) |
| `{write_concurrency, auto}` | Le nombre de verrous s'adapte à la contention (64 à 8192) | 64 partitions fixes, comme pour `true` ; `stats` rapporte 64 verrous | [runtime](runtime.md#ets-tables) |
| `compressed` | Stocke les éléments autres que la clé au format externe | Accepté et rapporté ; les objets sont stockés tels quels | [builtins](builtins.md#ets) |
| `stats` d'`info/2` d'un `ordered_set` avec `write_concurrency` ; `data` ; `binary` | Arbre CA `{RouteNodes, BaseNodes, MaxDepth}` ; affiche la table ; les binaries hors tas de la table | `false` ; `true` sans affichage ; `[]` | [builtins](builtins.md#ets) |
| `badarg` d'un builtin d'`ets` | Porte `error_info` avec une cause (`id`, `access`, `type`, ...) | Simple `badarg` | [builtins](builtins.md#ets) |
| Ordre des résultats de `select`, `match` et `match_object` sur les tables de hachage, et résultats contenus dans chaque bloc de `select/3` | Résultats de chaque étape du parcours ajoutés en tête, plus récents d'abord ; emplacements de hachage linéaire | Ordre de parcours des partitions et compartiments de Clause ; chaque bloc contient les premiers `Limit` résultats recueillis | [builtins](builtins.md#ets) |
| `select_delete/2`, `select_replace/2` sur une table entière | Cèdent la main tous les 1000 objets (table fixée entre-temps) | S'exécutent d'un seul tenant, chaque partition sous son verrou | [runtime](runtime.md#ets-tables) |
| Spécifications de filtrage nommant une variable numérotée 25 ou plus | Renumérotent chaque atome `'$N'` de la spécification, même dans `{const, ...}` (ainsi `{const, '$30'}` donne `'$0'`) | Les variables gardent leurs numéros ; `{const, '$30'}` donne `'$30'` | [runtime](runtime.md#match-specifications) |
| Guards et corps de spécifications de filtrage imbriqués sur plus de 1000 niveaux | Compilent jusqu'à manquer de pile C (`system_limit`) | `system_limit` | [runtime](runtime.md#match-specifications) |
| Actions de trace dans `erlang:match_spec_test/3` : `enable_trace`, `disable_trace`, `trace` avec des options valides | Modifient les options de trace de l'appelant (29.1.1 plante sans traceur) | `true` après vérification des options (et qu'un pid argument est vivant) ; rien ne change | [builtins](builtins.md#ets) |
| `ets:tab2file/2,3` et `file2tab/1,2` | Via un processus disk_log nommé par une nouvelle référence | Écrits et lus directement avec `file` | [builtins](builtins.md#ets) |
| `{process_dump}` et `{current_stacktrace}` dans `erlang:match_spec_test/3` | Texte du vidage du processus ; sa trace de pile | `<<>>` ; `[]` | [builtins](builtins.md#ets) |

## dets

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Requêtes attendant ensemble sur une table | Recherches, insertions et suppressions en attente simultanément partagent une mise à jour du cache ; les recherches reçoivent leur réponse avant les écritures ; une table fixée fait dormir certains rédacteurs 1 ms | Chaque requête à son tour, dans l'ordre d'arrivée | [builtins](builtins.md#dets) |
| Opérations dets longues (réparations, `init_table/2,3`, compactages, vidages d'un grand cache) | Code Erlang, préempté par réductions | Un appel builtin par opération ; le thread de travail de la table ne fait rien d'autre entre-temps | [builtins](builtins.md#dets) |
| Processus de `dets` | Serveur `dets` et `dets_sup` sous `kernel_safe_sup`, tables sous `dets_sup` | Serveur `dets` démarré à la première utilisation, sans supervision ; processus des tables liés à lui | [builtins](builtins.md#dets) |
| Ordre de `dets:all/0` | Ordre ETS du registre | Ordre ETS de Clause ([ETS](#ets)) | [builtins](builtins.md#dets) |
| Rapports | Une réparation est journalisée au niveau info ; `verbose/0,1` et `DETS_DEBUG` journalisent davantage ; une défaillance interne est `{dets_bug, ...}` | Rien n'est journalisé | [builtins](builtins.md#dets) |

## io

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| `~p`, `~w` et fonctions d'écriture d'`io_lib` pour des conteneurs imbriqués sur plus de 256 niveaux | Affichés | `system_limit` | [io](io.md#pretty-printing-p) |
| `io_lib:print/4` avec une colonne ou une longueur de ligne qui n'est pas un entier | Dépend du terme : affiché (les guards échouent silencieusement), `function_clause` ou `badarith` | `badarith` pour tout terme conteneur | [io_lib](builtins.md#io_lib) |
| Précision ou nombre de remplissage négatif (`~.*c` avec -1) | Boucle indéfiniment | `badarg` | [io](io.md#formats) |

## erl_scan

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Emplacement d'une continuation de `tokens/3,4` (`continuation_location/1`, non documenté) | Là où le scanner s'est arrêté, à l'intérieur du jeton inachevé | Le début du jeton inachevé, analysé de nouveau avec les caractères suivants | [erl_scan](builtins.md#erl-scan) |
| `{compiler_internal, [ssa_checks]}` | Transforme les commentaires de vérification `%ssa%` en jetons | Ignoré : ils restent des commentaires | [erl_scan](builtins.md#erl-scan) |
| Flottant dans une base donnée (`16#1.8#e1`, base autre que 10) dont les chiffres dépassent 53 bits | Mantisse convertie comme ERTS convertit les grands entiers | Accumulée dans un double ; le dernier bit peut différer | [erl_scan](builtins.md#erl-scan) |
| Élément de liste qui n'est pas un caractère dans une chaîne, un atome entre guillemets ou un échappement | `function_clause`, `case_clause` ou `if_clause`, selon la clause | `function_clause` | [erl_scan](builtins.md#erl-scan) |

## erl_parse

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Jetons `'%ssa%'` (clauses de vérification SSA des tests du compilateur OTP) | Analysés en clauses `ssa_check_when` | Erreur de syntaxe ; `erl_scan` ne produit jamais ce jeton | [erl_parse](builtins.md#erl-parse) |

## erl_eval

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Trace de pile d'une erreur levée par l'évaluateur (`{badmatch, V}`, `undef` d'un appel local, ...) | Pile courante du processus d'évaluation (`current_stacktrace` de `process_info/2`) | Pile au `throw` de l'évaluateur qui la recueille, dans les cadres de Clause | [erl_eval](builtins.md#erl-eval) |

## erl_lint

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Behaviours nommés par `-behaviour` | Tout module sur le chemin de code répond à `behaviour_info/1` | Seuls les modules liés dans le programme répondent ; un autre donne `undefined_behaviour` | [erl_lint](builtins.md#erl-lint) |
| Ordre de plusieurs erreurs trouvées dans un même parcours de map (variables de type singleton d'un type, specs sans fonction, vérifications de callbacks) | Ordre interne de la map (atomes par index) | Ordre des termes | [erl_lint](builtins.md#erl-lint) |
| `erlang:is_builtin/3` pour les entrées `-deprecated`, `-removed` et `-unsafe` non exportées | Table des BIF d'OTP | Builtins du runtime, incluant les fonctions natives de bibliothèque | [erl_lint](builtins.md#erl-lint) |
| `is_guard_expr/1` d'une construction de record | Lève `case_clause` | Indique si les champs sont des expressions de guard | [erl_lint](builtins.md#erl-lint) |

## epp

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| `-include_lib("App/...")` absent du chemin d'inclusion | Trouvé dans `code:lib_dir(App)`, qui connaît les applications d'OTP | Trouvé dans `code:lib_dir(App)` du chemin de code de Clause, qui ne contient aucune application OTP sauf ajout explicite | [bibliothèque](library.md#contents) |

## erl_pp

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Forme des caractères retournés par `erl_pp` | Listes de caractères profondément imbriquées | Une liste de caractères plate ; la sortie aplatie est identique | [builtins](builtins.md#erl-pp) |

## qlc

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Trace de pile d'une exception levée dans un processus curseur, telle que `next_answers/1,2` la relance | Trace de pile du curseur suivie de `process_info(self(), current_stacktrace)` du propriétaire | Suivie de la trace de pile d'une exception capturée chez le propriétaire (Clause n'a pas d'élément `current_stacktrace`) | [qlc](builtins.md#qlc) |
| `qlc:q/1,2` dans `erl_eval`, `ets:table/1,2`, `dets:table/1,2` dans un programme qui ne nomme jamais `qlc` | `qlc` est toujours chargé | `undef` pour `qlc` : ces appels l'atteignent par un nom à l'exécution, donc seuls les programmes nommant `qlc` (tout module incluant `qlc.hrl` le fait) le lient | [bibliothèque](library.md#how-programs-get-them) |
| Numéros d'annotation dans le code des requêtes compilées (`info/2` avec `{format, abstract_code}`) | La transformation d'OTP numérote les annotations autour de chaque entier du module, y compris les caractères du chemin de `qlc.hrl` dans son attribut `file` | Même transformation, mais le `qlc.hrl` de Clause a un autre chemin, donc les numéros après la première requête peuvent différer ; le code est autrement identique | [qlc](builtins.md#qlc) |

## qlc_pt

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Messages de `qlc_pt:parse_transform/2` à l'exécution | Issus de `compile:noenv_forms/2` (`strong_validation`) : `erl_lint` plus les passes internes du compilateur, comme les avertissements de `sys_core_fold` | Issus d'`erl_lint` uniquement, comme le fait `qlc_pt` d'OTP lorsque le compilateur est indisponible | [qlc_pt](builtins.md#qlc-pt) |

## Shell interactif

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Édition de ligne dans un terminal | `edlin` : touches de déplacement, historique des lignes, recherche, complétion par tabulation via `edlin_expand`, invite multiligne `..>` | Édition de ligne propre au terminal (mode canonique) ; les lignes sont lues telles que le terminal les livre, avec la même invite pour chaque ligne supplémentaire d'une commande, comme OTP pour une entrée par tube | [bibliothèque](library.md#interactive-shell) |
| Contrôle des tâches | Ctrl+G ouvre le menu JCL (shells nouveaux, connectés, interrompus et tués) | Aucun ; la bannière et l'indication de commande lente mentionnent toujours Ctrl+G comme OTP les affiche | [bibliothèque](library.md#interactive-shell) |
| `exit().` lorsque le shell lit une entrée par tube | Un nouveau shell démarre et ne lit plus rien | Un nouveau shell démarre et lit le reste de l'entrée | [bibliothèque](library.md#interactive-shell) |
| Programmes démarrant le shell sans `--shell` | Tout module du chemin de code peut être appelé | Seulement les modules liés par le programme ; sans `--keep-exports`, les appels dynamiques atteignent uniquement les exports accessibles au programme | [bibliothèque](library.md#interactive-shell) |
| Records des modules compilés (`rr(Module)`, `shell_default` et `user_default` au démarrage) | Lus depuis les informations de débogage ou le source du module | `{error, nofile}` : le code lié ne conserve aucun code abstrait ; `rr/1,2,3` les lit depuis les fichiers source et `.beam` | [bibliothèque](library.md#interactive-shell) |
| `save_module/1` | Écrit le module et le compile avec `c:c/1` | Écrit seulement le module (aucun compilateur) | [bibliothèque](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` dans un appel ou une valeur de champ de record | En-têtes de fonction et types d'arguments issus de la spécification (`lists:seq(From, To)`), atomes et types permis par celle-ci | En-têtes `Mod:Fun/Arity` des arités exportées, aucune suggestion de type : le code lié ne conserve aucune spécification | [bibliothèque](library.md#interactive-shell) |
| `edlin_expand:expand/1,2` pour les fonctions et modules | Fonctions regroupées selon les groupes de la documentation ; modules du chemin de code | Un groupe `Functions` (aucune documentation) ; modules du programme | [bibliothèque](library.md#interactive-shell) |
| Colonnes de `c:i/0,1`, `c:ni/0`, `c:regs/0` | Appel initial et fonction courante de chaque processus | Appel initial de `proc_lib` ou `undefined` ; fonction courante `undefined` (aucun élément `current_function`) | [bibliothèque](library.md#interactive-shell) |

## Nombres aléatoires

| Différence | OTP | Clause | Responsable |
| --- | --- | --- | --- |
| Hauteurs des bandes de la ziggurat normale de `rand` | Constantes tabulées | Calculées au double le plus proche à partir des constantes de la ziggurat ; une hauteur peut différer au dernier bit, ce qui ne change une acceptation du chemin lent que pour un tirage situé dans ce bit de la limite (probabilité proche de 2^-53 par tirage du chemin lent). Les largeurs et les limites des bandes sont observées sur OTP et identiques | [builtins](builtins.md#random-numbers) |

## crypto

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Ordre de `crypto:supports(ciphers)` | Table du NIF triée par index d'atome, qui varie d'une exécution de la VM à l'autre, puis alias | Ordre de la table d'OTP, puis alias | [builtins](builtins.md#crypto-module) |
| `{File, Line}` des erreurs `{badarg \| notsup \| error, {File, Line}, Description}` de `crypto` | Fichier source C et ligne d'OTP (`{"hash.c", 111}`) | Fichier source C++ et ligne de Clause (`{"hash.cpp", 63}`) ; classe et description identiques à celles d'OTP | [builtins](builtins.md#crypto-module) |
| `link_type` de `crypto:info/0` | Manière dont OTP a lié libcrypto (généralement `dynamic`) | Toujours `static`, même lorsqu'une libcrypto partagée installée est liée | [OpenSSL](crypto.md) |
| Longs calculs de `pbkdf2_hmac/5` (plus de 100 itérations ou 64 octets) | Exécutés sur un ordonnanceur CPU dirty | Exécutés sur le thread de travail de l'ordonnanceur du processus appelant, qui n'exécute aucun autre processus entre-temps | [builtins](builtins.md#crypto-module) |
| `modules` de l'application `crypto` | `[crypto, crypto_ec_curves]` | `[crypto]` | [bibliothèque](library.md) |
| Textes longs de `crypto_one_time/4,5` et `crypto_one_time_aead/4,6,7` (plus de 20000 octets) | Traités sur un ordonnanceur CPU dirty | Traités sur le thread de travail de l'ordonnanceur du processus appelant, qui n'exécute aucun autre processus entre-temps | [builtins](builtins.md#crypto-module) |
| Variable d'application `fips_mode` de `crypto` | Lue au chargement du module `crypto` : `true` active le mode FIPS | Non lue (Clause n'a pas d'`on_load` et les programmes n'ont pas de `sys.config`) : utiliser `crypto:enable_fips_mode/1`, ou `clau --fips` | [crypto](crypto.md#fips) |
| `crypto:info_fips/0` sans fournisseur FIPS chargeable | `not_enabled` si OTP a été compilé avec la prise en charge FIPS, `not_supported` sinon | `not_supported` | [crypto](crypto.md#fips) |
| Moment du chargement de l'application `crypto` | Au chargement du module `crypto` (son `on_load`) | Lorsqu'un générateur `crypto_cache`, `crypto_aes` ou `crypto_prng1` lit `rand_cache_size` pour la première fois | [bibliothèque](library.md) |
| Génération de clés RSA (`crypto:generate_key(rsa, ...)`) et signatures SLH-DSA | Exécutées sur un ordonnanceur CPU dirty | Exécutées sur le thread de travail de l'ordonnanceur du processus appelant, qui n'exécute aucun autre processus entre-temps | [builtins](builtins.md#crypto-module) |
| Option `rsa_sslv23_padding` de `crypto:public_encrypt/4` et fonctions apparentées | Acceptée si OTP est compilé avec un OpenSSL possédant le remplissage SSLv23 (1.1, 3.x) | `"Bad padding type in option rsa_padding"`, comme OTP compilé avec OpenSSL 4 | [builtins](builtins.md#crypto-module) |
| `crypto:ec_curve/1` pour une courbe absente de la libcrypto liée (OpenSSL compilé sans courbes binaires) | Paramètres issus de `crypto_ec_curves` | `error:function_clause`, comme pour une courbe inconnue : les paramètres proviennent des courbes intégrées de libcrypto | [builtins](builtins.md#crypto-module) |
| Déchiffrement des informations de débogage par `beam_lib` dans un programme qui n'appelle pas `crypto` | `crypto` est toujours présent | `key_missing_or_invalid` sauf si le programme lie `crypto` (`--with-crypto`), car `beam_lib` l'appelle dynamiquement | [bibliothèque](library.md) |

## ASN.1

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Pile dans `{error, {asn1, {Reason, Stack}}}` | Cadres des fonctions générées `enc_*`/`dec_*` et d'`asn1rtt_*` | Cadres de `Module:encode/2` ou `decode/2` et du builtin du codec | [asn1](asn1.md#generated-modules) |
| Fonctions d'un module généré | Exporte aussi `enc_Type/1,2`, `dec_Type/1,2` et les autres fonctions par type générées par asn1ct | Seulement `encode/2`, `decode/2`, `info/0`, les fonctions d'options et les fonctions de valeurs | [asn1](asn1.md#generated-modules) |
| Un `CHOICE` dont le corps commence par `...` (aucune alternative racine) | asn1ct signale une erreur de syntaxe | Accepté | [asn1](asn1.md#coverage) |
| Macros et fonctions de valeurs nommant une autre valeur dans un type ouvert (`mgf1SHA1`, `rSASSA-PSS-Default-Identifier` de PKCS-1) | asn1ct laisse `{'Externalvaluereference', Line, Module, Name}` à la place de la valeur | La valeur référencée | [asn1](asn1.md#generated-modules) |
| Erreur du runtime (autre qu'ASN.1) lorsque `public_key` décode ou encode une valeur d'extension | Levée telle quelle, principalement de classe `error`, depuis la fonction générée `dec_ext-*`/`enc_ext-*` | `exit({error, {asn1, Reason}})` : la valeur passe par `decode/2` ou `encode/2` du module généré, qui encapsule tout échec | [public_key](public_key.md#functions) |
| Groupes Diffie-Hellman par défaut de `public_key:dh_gex_group/4` | Groupes générés par OTP (`lib/public_key/priv/moduli`), 60–81 par taille | Huit par taille issus du fichier moduli d'OpenSSH ; mêmes tailles (2047 à 8191) | [public_key](public_key.md#keys-and-signatures) |
| Cadres d'une exception de `public_key` | `public_key`, `pubkey_pem`, `pubkey_pbe`, `pubkey_cert_records`, `pubkey_cert`, `pubkey_ssh` | `public_key`, `clause_public_key_codec` et `clause_public_key_keys` | [public_key](public_key.md#functions) |

## Parse transforms

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Nom dans l'attribut `file` d'un fichier inclus (`--print-abstr`, entrée d'une transformation) | Le répertoire d'inclusion joint au nom, tel que trouvé (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | Le chemin relatif au répertoire de travail quand le fichier s'y trouve, sinon le chemin absolu | [transformations](transforms.md#interchange) |
| Annotations de ligne 0 des formes importées (code généré, comme par la transformation `qlc`) | Ligne valide : le code n'a pas de ligne source | Le code prend la place du nœud importé avant lui | [transformations](transforms.md#importing-forms) |
| Annotations `generated` des formes importées (entrées `.abstr`, sortie d'une transformation) | `erl_lint` et le compilateur omettent certains avertissements pour le code généré | Ignorées : le code est vérifié comme du source | [transformations](transforms.md#importing-forms) |
| Formes `{error, {Location, Module, Descriptor}}` dans du code importé | Formatées avec `Module:format_error/1` | Le texte du terme du descripteur ; le formatage nécessite OTP | [transformations](transforms.md#importing-forms) |
| Un module avec des erreurs de préprocesseur ou d'analyse syntaxique qui nomme une parse transform | La transformation s'exécute et reçoit les erreurs sous forme de formes `{error, E}` ; `erl_lint` les signale ensuite | Les erreurs sont signalées et la transformation ne s'exécute pas | [transformations](transforms.md#clause-pipeline) |
| Options de compilation reçues par une transformation | La liste complète des options d'erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (le répertoire de travail), `{i, _}`, `{d, ...}` et `{parse_transform, _}` | [transformations](transforms.md#otp-behavior) |
