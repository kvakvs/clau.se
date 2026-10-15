---
source: docs/differences.md
sourceCommit: 6ed3851c
sourceSha256: 7f5e373cf63cd3d962f6e9954719a80cdb14f9cf5bfdb3af590c58fc8e0cabf3
translatedAt: 2026-10-15
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
| `maps:iterator/1,2`, `maps:next/1`, `erts_internal:map_next/3` | Ordre interne (ordre de la table des atomes pour les clés atomes, ordre de hachage au-delà de 32 clés) ; un itérateur est une position ou une chaîne `{K, V, Next}` | Ordre canonique des clés ; un itérateur continue sur une liste de clés | [builtins](builtins.md#erts-internal) |
| Affichage des maps (`erlang:display/1`, `~w`, `~p`) | Ordre de la disposition interne (ordre de la table des atomes pour les clés atomes, ordre de hachage au-delà de 32 clés) | Ordre des clés de la map, comme `~kw` d'OTP | [termes](terms.md#printing) |
| Affichage des native records (`erlang:display/1`) | Champs dans l'ordre d'index de la table des atomes | Ordre de définition, comme `~w` | [native records](native-records.md#printing-and-order) |
| `==` entre native records dont les champs ne diffèrent que par entier/flottant | Le compilateur peut le réduire à `=:=` (false) | Comparaison numérique (true) | [native records](native-records.md#printing-and-order) |
| Affichage des funs locales (`#Fun<M.Index.Uniq>`) | Index issu de la numérotation des lambdas par le compilateur, `Uniq` un hachage du code du module | Index parmi les funs locales du module dans l'ordre du source, `Uniq` toujours 0 | [funs](funs.md#comparison-and-printing) |
| Ordre de deux funs locales d'un même module | Selon l'index d'OTP | Selon l'index dans l'ordre du source, donc des funs de fonctions différentes peuvent être ordonnées différemment | [funs](funs.md#comparison-and-printing) |
| Noms des funs anonymes dans les traces de pile (`-f/1-fun-N-`) | `N` issu de la numérotation du compilateur | `N` compte les funs de `f/1` dans l'ordre du source | [funs](funs.md#closures) |
| Fun anonyme dans la valeur par défaut d'un champ de record | Chaque site de construction développe sa propre copie : les funs de deux sites sont différentes | Une seule fun pour la valeur par défaut : les funs de tous les sites de construction sont égales | [funs](funs.md#closures) |
| Ordre des valeurs capturées des funs créées dans des comprehensions | Variables libres de la fonction générée pour la comprehension | Ordre de définition dans la fonction englobante ; visible uniquement en comparant deux telles funs | [funs](funs.md#closures) |

## Pids, références et processus

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Numéros de pid | Le premier processus utilisateur est environ `<0.80.0>` ; les numéros sont réutilisés quand la table des pids reboucle | Le premier processus est `<0.1.0>` ; les numéros proviennent d'une seule séquence et ne sont jamais réutilisés | [termes](terms.md#pids-and-references) |
| Code après `spawn(Fun)` d'une fun d'une autre arité | L'analyse de types du compilateur peut considérer le code après l'appel comme inaccessible et le supprimer, de sorte que l'appelant renvoie le pid immédiatement | L'appelant continue ; seul le nouveau processus échoue avec `{badarity, {Fun, []}}` | [processus](processes.md#builtins) |
| Pile d'un `function_clause` levé par une builtin de `lists` (`lists:sublist/2`, `lists:max/1`, ...) | Le cadre supérieur est la fonction Erlang, souvent un auxiliaire interne (`lists:sublist_2/2`), avec ses arguments | L'appelant est au sommet : les builtins n'empilent aucun cadre | [builtins](builtins.md#lists-module) |
| Dernier bit des résultats de `math` (`math:erfc(1)`, ...) | La bibliothèque C avec laquelle OTP a été construit | La bibliothèque C liée aux programmes Clause (Windows : `0.15729920705028513` pour `erfc(1)`, OTP `0.1572992070502851`) | [builtins](builtins.md#math-module) |
| Résultat de `binary:compile_pattern/1` | `{bm, Ref}` ou `{ac, Ref}` avec une référence opaque | `{bm, [Pattern]}` ou `{ac, Patterns}` | [builtins](builtins.md#binary-module) |
| `binary:referenced_byte_size/1` d'un sous-binary | La taille du binary dans lequel il pointe | Sa propre taille | [builtins](builtins.md#binary-module) |
| Coût de `persistent_term:get/1,2` | Constant : la valeur reste dans une zone de littéraux ; `put`/`erase` d'une valeur remplacée déclenchent une collecte globale | Copie la valeur dans le tas du lecteur à chaque lecture ; pas de collecte globale | [runtime](runtime.md#persistent-terms) |
| `persistent_term:info/0` et `get/0` | Incluent les termes que `kernel` et `stdlib` d'OTP stockent au démarrage (26 sous OTP 29) | Seulement les termes propres au programme | [builtins](builtins.md#persistent-terms) |
| `code:is_loaded/1`, `code:which/1`, `code:all_loaded/0` d'un module compilé | Le fichier `.beam` depuis lequel il a été chargé | `preloaded` : chaque module est lié dans l'exécutable | [builtins](builtins.md#code-module) |
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
| `inet:gethostbyname/1,2` | Le nom canonique et les alias du résolveur (`inet_res`, fichier hosts, natif) | Le nom demandé et aucun alias ; adresses issues du résolveur du système | [ports](ports.md#sockets-57f) |
| Modules `socket`, `net` | L'API NIF des sockets | Absents : une référence est une erreur de compilation ; utiliser `gen_tcp`, `gen_udp`, `inet` | [bibliothèque](library.md) |
| Listes de sortie de `zlib` | Un binary par bloc interne, imbriqué là où un flux s'est terminé et a redémarré | Un binary par appel, `[]` s'il n'y en a pas ; les octets sont ceux d'OTP | [builtins](builtins.md#zlib-module) |
| `zlib:safeInflate/2` et appels `zlib` longs | Retournent après une quantité bornée de sortie (`{continue, Output}`) et cèdent la main | Décompressent toute l'entrée en attente en un seul appel (`{finished, Output}`) ; un appel long occupe son thread d'ordonnanceur | [builtins](builtins.md#zlib-module) |
| Correspondances `re` longues | `re:run/3` et la boucle globale cèdent la main après une quantité bornée de travail | Une correspondance s'exécute jusqu'au bout et occupe son thread d'ordonnanceur ; une exécution globale ne cède la main qu'entre les correspondances | [builtins](builtins.md#re-module) |
| `re:compile/2` avec `export`, `re:import/1` | Un motif exporté `{re_exported_pattern, ...}` qu'un autre nœud importe | `export` donne `badarg` ; `import/1` lève `{not_implemented, import, 1}` | [builtins](builtins.md#re-module) |
| Erreurs d'argument de `re` | `badarg` levé depuis `re:run/3` (ou `replace`, `split`) avec les arguments de l'appelant et `error_info` | `badarg` levé depuis l'auxiliaire `re` qui a rejeté l'argument, avec les arguments de cet auxiliaire | [builtins](builtins.md#re-module) |
| `code:is_sticky/1` | `true` pour les modules de `kernel`, `stdlib` et `compiler` | Toujours `false` | [builtins](builtins.md#code-module) |
| Sortie vers un périphérique fichier (`io:format(File, ...)`) | Les caractères sont encodés selon l'encodage du fichier (`latin1` par défaut : les caractères au-delà de 255 sont une erreur) | Toujours des octets UTF-8 | [io](io.md#calls) |
| Formatage d'un grand terme (`io:format/1,2`) | S'exécute en code Erlang (`io_lib`) et dans le group leader, le processus peut donc être préempté pendant le formatage | S'exécute jusqu'au bout dans un seul appel de builtin ; les autres processus attendent | [builtins](builtins.md#portions) |
| Drapeaux de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` et d'autres | Seulement `trap_exit` ; tout autre drapeau lève `badarg` | [processus](processes.md#builtins) |
| Ordre des rapports d'erreur de processus qui plantent en même temps | Ordre du logger | L'ordre dans lequel leurs threads de travail les terminent | [processus](processes.md#workers) |
| Signaux vers un processus s'exécutant sur un autre ordonnanceur | Placés dans sa file de signaux et traités plus tard, pendant que l'émetteur continue | L'émetteur attend la fin de la tranche de temps de la cible, puis agit aussitôt ; observable seulement dans les délais | [processus](processes.md#workers) |
| `term_to_binary/1` d'une fun locale ou d'un native record | Encodé (`NEW_FUN_EXT`, ...) | `error:notsup` ; `fun M:F/A` est encodée | [builtins](builtins.md#external-term-format) |
| `term_to_binary/1` d'une map de plus de 32 clés | Ordre de hachage sauf avec `deterministic` | Toujours l'ordre des clés (les octets de `deterministic`) | [builtins](builtins.md#external-term-format) |
| `binary_to_term/1` d'un pid, port ou référence d'un autre nœud ; option `local` de `term_to_binary/2` | Identités externes ; encodage `LOCAL_EXT` | `badarg` | [builtins](builtins.md#external-term-format) |
| Limite de temps des timers | Dépend de l'unité de temps native (environ 2^49.7 ms sous Windows) | Temps relatif de 0 à 2^49-1 ms sur toutes les plateformes | [processus](processes.md#timers) |
| `unique_integer/0,1` sans `positive` | Peut être négatif | Toujours positif et croissant | [builtins](builtins.md#time) |
| Éléments `current_function`, `initial_call`, `current_stacktrace`, ... de `process_info/2` | Rapportés | `error:{notsup, Item}` ; `process_info/1` les omet | [processus](processes.md#introspection) |
| `reductions` de `process_info/2` ; `reductions`, `garbage_collection`, `io` de `statistics/1` | Comptés | 0 (non tenus) | [builtins](builtins.md#system-information) |
| `garbage_collect/0,1,2` | Collecte avant de retourner | Collecte au prochain point sûr (safepoint) de la cible | [processus](processes.md#introspection) |
| `erlang:system_info(machine)` | `"BEAM"` | `"Clause"` | [builtins](builtins.md#system-information) |
| Options de réglage de `spawn_opt/2..5` (`priority`, `min_heap_size`, ...) | Appliquées | Vérifiées et acceptées, non appliquées | [processus](processes.md#spawn-options) |
| `hibernate/3` | Abandonne la pile ; le processus se termine quand `M:F` retourne | Garde la pile ; le résultat de `M:F` revient à l'appelant de `hibernate/3` | [processus](processes.md#spawn-options) |
| `monitor(port, Item, Options)` avec des options | Accepté | `badarg` | [processus](processes.md#aliases) |
| `spawn_request_abandon/1` | `true` tant que la réponse est en attente | Toujours `false` : la réponse est envoyée avant le retour de `spawn_request` | [processus](processes.md#spawn-options) |
| Dernier bit de `math:log2/1` (Windows) | La version Windows d'OTP divise `log(X)` par `log(2)` (`math:log2(1.0e308)` vaut `1023.1538532253077`) | Le `log2` de la bibliothèque C (`1023.1538532253076`) | [builtins](builtins.md#math-module) |
| Valeurs de `phash/2`, `phash2/1,2` | La fonction de hachage d'OTP | Le hachage stable propre à Clause, avec les mêmes plages et la même garantie d'égalité | [builtins](builtins.md#hashing) |
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
| `io:get_line`, `io:get_chars` et `file:read/2` en mode liste sur une entrée non ASCII | Caractères décodés selon l'encodage du périphérique | Un élément de liste par octet | [ports](ports.md#standard-io-and-files) |
| Résultat de `os:cmd/1` | Caractères Unicode décodés depuis la sortie | Les octets de la sortie | [ports](ports.md#subprocesses) |
| Arguments vides de `{spawn_executable, F}` sous Windows | Supprimés de la ligne de commande | Transmis sous forme `""` | [ports](ports.md#subprocesses) |
| `{exit_status, S}` et `eof` d'un programme lancé | Ordre non spécifié, `exit_status` peut arriver avant les dernières données | Après toutes les données, avant `eof` | [ports](ports.md#subprocesses) |
| Ports occupés | Un port avec trop de sortie en attente suspend les émetteurs ; `force` de `port_command/3` fonctionne sur les pilotes qui le permettent | La sortie ne suspend jamais ; `force` lève `notsup` sur tous les pilotes | [ports](ports.md#io-thread) |
| `{active, N}` des sockets | Un entier `N` compte les messages avant `{tcp_passive, S}` | `exit(badarg)` ; seulement `true`, `false` et `once` | [ports](ports.md#sockets-57f) |
| Options de réglage des sockets (`nodelay`, `keepalive`, `send_timeout`, `delay_send`, tampons) | Appliquées ; les autres options `inet` (`header`, `{packet, line}`, `http`, ...) fonctionnent | Les options de réglage listées sont acceptées mais non appliquées ; les autres options donnent `exit(badarg)` | [ports](ports.md#sockets-57f) |
| Raisons d'erreur des sockets | Toute raison POSIX signalée par le système | Les plus courantes (`econnrefused`, `eaddrinuse`, `econnreset`, `etimedout`, ...) ; les autres deviennent `eio` | [ports](ports.md#sockets-57f) |
| Entrée d'un port pendant que le processus connecté détient 1 024 messages et peut s'exécuter | Continue à lire et à livrer | Cesse de livrer jusqu'à la fin de la tranche de temps du processus ; au-delà de 64 Kio détenus, cesse de lire, et le programme qui écrit se bloque | [ports](ports.md#busy-ports) |
| `gen_tcp:close/1` avec de la sortie en attente | Attend, au plus selon le réglage `linger`/`send_timeout`, que la sortie soit partie | Retourne immédiatement ; le thread d'E/S envoie la sortie en attente, puis ferme | [ports](ports.md#sockets-57f) |
| Types de `monitor/2` | `process`, `port`, `time_offset` | `process` et `port` ; `time_offset` lève `badarg` (pas de changement de décalage temporel) | [processus](processes.md#monitors) |
| `exit/2`, `exit_signal/2` vers une référence | Envoie à l'alias de processus, si la référence en est un actif | Rien (pas d'alias) | [processus](processes.md#exit-signals) |
| Numéros de référence | Combinent un identifiant d'ordonnanceur et des compteurs par ordonnanceur (`#Ref<0.178111994.4235460610.214105>`) | Un seul compteur pour tout le programme (`#Ref<0.0.0.1>`), les références sont donc ordonnées par création | [termes](terms.md#pids-and-references) |

## Erreurs, traces de pile et rapports

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Emplacements dans les traces de pile | `[{file, F}, {line, L}]`, `error_info` pour `error/3` | Toujours `[]` ; pas d'`error_info` | [ABI](abi.md#stack-traces) |
| Cadre supérieur de `function_clause` | Liste des arguments | Arité | [ABI](abi.md#stack-traces) |
| Cadre supérieur de `undef` | `{M, F, Args, []}` de la fonction manquante | Le cadre de la fonction appelante | [funs](funs.md#dynamic-calls) |
| Appel dynamique d'un export qu'un exécutable ne peut pas atteindre (son module n'est nommé que par une trace de pile, une exception ou un message venu de l'extérieur du programme) | L'appelle | `undef`, sauf avec `--keep-exports` ; `function_exported/3` et `module_info(exports)` le listent quand même | [exécutables](executables.md#export-liveness) |
| Cadres des BIF/opérateurs en échec | Présents (`{erlang, '+', Args, ...}`) | Absents ; rien sous la fonction d'entrée | [ABI](abi.md#stack-traces) |
| Table des atomes pleine (`list_to_atom/1`) | L'émulateur s'arrête (`no more index entries in atom_tab`) et écrit un crash dump | `clau: runtime failure: entry call failed: resource_limit`, code de sortie 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` avec des caractères au-delà de 255 | Ses premiers chiffres n'utilisent que l'octet de poids faible de chaque caractère (`[16#131]` donne 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` d'une BIF | Vrai pour toute BIF de l'émulateur | Vrai seulement pour les builtins fournies par ce runtime | [builtins](builtins.md#how-calls-reach-them) |
| Rapports d'erreur des processus plantés | Envoyés au logger, écrits plus tard par son gestionnaire par défaut (sur la sortie standard sous `erl`, souvent perdus quand un escript s'arrête avant) | Écrits sur stderr à la fin du processus, avant toute sortie ultérieure | [processus](processes.md#exits) |
| Appels de fonctions qui ne retournent jamais | Compilés en appels terminaux (appelant absent de la trace) | Appels ordinaires (appelant présent) | [ABI](abi.md#stack-traces) |
| Mémoire de l'hôte épuisée | L'émulateur signale qu'il ne peut pas allouer de mémoire, écrit un crash dump et s'arrête | `clau: runtime failure: entry call failed: out_of_memory`, code de sortie 70, pas de dump | [tas du runtime](runtime-heap.md#failure-behavior) |
| Stockage des maps de plus de 32 clés | Un HAMT sur le tas, compté dans `heap_size` et copié à chaque collecte | Un arbre hors tas derrière un talon (stub) de 4 mots sur le tas, compté avec les binaries hors tas ; les tailles de tas sont plus petites et les collectes ne copient que le talon | [tas du runtime](runtime-heap.md#off-heap-maps) |
| Plafond mémoire par processus | `max_heap_size` (en mots, tas et pile) tue le processus avec la raison `killed` et journalise un rapport d'erreur | `--max-heap` / `--max-stack` (octets) et `--max-memory`, valable pour tout le runtime, font échouer le processus demandeur avec `resource_limit` : `clau: runtime failure: entry call failed: resource_limit`, code de sortie 70 | [tas du runtime](runtime-heap.md#runtime-memory-limit) |
| Arguments du programme | `escript` transmet tous les arguments à `main/1` ; les options de l'émulateur (`+t`) viennent de `%%!` ou de `ERL_FLAGS` | Les options du runtime placées en tête (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) sont retirées d'abord ; `CLAUSE_FLAGS` contient les mêmes options | [exécutables](executables.md#runtime-options) |
| Exception non capturée dans un module d'entrée ordinaire | `escript` sort avec le code 127 | Sort avec le code 1 et une ligne `uncaught exception <class>: <reason>` (les sources escript gardent 127) | [exécutables](executables.md) |
| Diagnostics du compilateur | Formulation d'`erl_lint` (`variable 'X' is unbound`) et avertissements | Formulation propre (`unbound variable X`) ; les avertissements de lint d'OTP ne sont pour la plupart pas émis (y compris les champs de native record inconnus dans les accès, mises à jour et motifs) | [sémantique](semantic.md#bindings) |
| Module de behaviour avec une `behaviour_info/1` écrite à la main | L'appelle lors de la compilation des utilisateurs et avertit des callbacks manquants, mal définis ou obsolètes | Non évaluée : les callbacks de ses utilisateurs ne sont pas vérifiés | [sémantique](semantic.md#behaviours) |
| Modules de behaviour hors du lot (`gen_server`, `supervisor`, ...) | Chargés depuis le chemin de code ; leurs callbacks sont vérifiés | Avertissement `behaviour M undefined` | [sémantique](semantic.md#behaviours) |
| `-behaviour` avec une valeur qui n'est pas un atome | L'avertissement affiche le terme avec `~w` (`behaviour [115,116,114] undefined`) | Affiche le texte source de l'attribut (`behaviour "str" undefined`) ; l'erreur est la même | [sémantique](semantic.md#behaviours) |
| `module_info(md5)` et le `vsn` qu'OTP en dérive | MD5 du code BEAM compilé | MD5 du source imprimé du module ; l'entier `vsn` dérivé diffère en conséquence | [sémantique](semantic.md#predefined-functions) |
| `module_info(compile)` | `version` de l'application compiler d'OTP, `options` qui lui ont été données | La version de Clause ; `options` toujours `[]` | [sémantique](semantic.md#predefined-functions) |
| `module_info(functions)` | Liste aussi les fonctions qu'OTP génère pour les funs (`'-f/0-fun-0-'/0`) | Seulement les fonctions du source et les fonctions prédéfinies | [sémantique](semantic.md#predefined-functions) |
| `-nominal` dans `module_info(attributes)` | Conservé sous forme `{nominal,[{Name,AbstractType,Params}]}` au format abstrait | Omis | [sémantique](semantic.md#predefined-functions) |
| `erlang:get_module_info/1,2` | La BIF derrière `module_info/0,1` | Non fournie ; `module_info/0,1` renvoient des données littérales | [sémantique](semantic.md#predefined-functions) |
| `-compile({parse_transform, Module})` | Exécute la transformation sur les formes du module | Non appliquée ; avertissement `[parse transforms] notimpl` et le module est compilé sans transformation | [compilation](compile.md#accepted-source-subset) |
| Une fonction d'un module de bibliothèque de Clause que Clause n'a pas implémentée (une BIF `erlang`, `lists:keysort/2`, `persistent_term:get/1`, ...) | S'exécute | Compile ; lève `error({not_implemented, F, A})` à l'appel, avec `M:F/A` au sommet de la pile ([statuts](../library/modules.terms)) | [bibliothèque](library.md#provided-or-missing), [builtins](builtins.md#erlang-module) |
| Import d'un module hors du lot | Compile ; l'appel lève `undef` à l'exécution si le module est absent | Erreur de compilation `unknown module M` quand l'import est appelé (les imports inutilisés n'exigent pas le module) | [sémantique](semantic.md#imports) |
| Avertissement `import directive overrides auto-imported BIF` | Pour toute BIF auto-importée de `erl_internal:bif/2` | Seulement pour les BIF auto-importées que Clause implémente | [sémantique](semantic.md#imports) |

## Cas limites du langage

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Segment entier plus large que la limite des entiers, valeur au-delà (`<<V:4194241>>` entièrement à un) | Le JIT x86 réussit le filtrage avec un terme invalide ; son utilisation fait planter la VM | Pas de correspondance | [termes](terms.md#integers) |
| Groupe zip dont les générateurs souples et stricts partagent une variable | Le test de saut conserve les variables des motifs stricts dans les motifs souples | Une étape rejetée est sautée dès que les motifs stricts correspondent à eux seuls | [motifs](patterns.md#comprehensions) |
| Appel d'une fun externe, `M:F(Args)` ou `apply/3` d'un module hors du programme | Charge le module depuis le chemin de code, `undef` s'il est absent | `undef` ; les modules de bibliothèque ne rejoignent le programme que lorsqu'il les nomme par un atome littéral | [funs](funs.md#dynamic-calls), [bibliothèque](library.md#how-programs-get-them) |
| `lists` et `maps` | Les modules complets ; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` suivent l'ordre interne de la map (ordre de la table des atomes pour les clés atomes, ordre de hachage au-delà de 32 clés) | Le [sous-ensemble de bibliothèque](library.md) ; les fonctions de map suivent l'ordre des clés | [bibliothèque](library.md) |
| Fichiers sans `#!` passés comme escripts | `escript file.erl` saute la première ligne | Compilés comme des modules ordinaires | [exécutables](executables.md) |
| Escripts beam précompilés et escripts archives | S'exécutent | Non pris en charge | [exécutables](executables.md) |
| `include_lib` d'une application trouvée dans plusieurs répertoires `<app>-<version>` | Le chemin de code contient une seule version (le démarrage choisit la plus haute) ; aucun diagnostic | La version la plus haute sous chaque répertoire parcouru, avec un avertissement par exécution qui les liste | [préprocesseur](preprocessor.md#compatibility-policies) |
| Un `-spec` dont les types n'ont aucune valeur commune avec le résultat inféré, le domaine d'entrée ou les arguments d'un appel | Compile ; Dialyzer peut avertir | Un domaine d'entrée d'argument contredit est une erreur de compilation indiquant les types déclarés et inférés ; un résultat ou un appel contredit est un avertissement, et les types inférés sont utilisés | [analyse sémantique](semantic.md#inference) |

## io

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Séquences de contrôle `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, modificateur `K` | Formatées | `badarg` | [io](io.md#formats) |
| `~p` de conteneurs imbriqués sur plus de 256 niveaux | Affichés | `system_limit` | [io](io.md#pretty-printing-p) |
| Largeurs de champ et précision de `~ts` avec des caractères combinants ou `\r\n` | Comptent les grappes de graphèmes | Comptent les points de code | [io](io.md#formats) |
| Précision ou nombre de remplissage négatif (`~.*c` avec -1) | Boucle indéfiniment | `badarg` | [io](io.md#formats) |
| Fonctions `io` autres que `format/1,2`, `put_chars/1` | Existent | `unknown module io` | [io](io.md#calls) |

## Parse transforms

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Nom dans l'attribut `file` d'un fichier inclus (`--print-abstr`, entrée d'une transformation) | Le répertoire d'inclusion joint au nom, tel que trouvé (`inc.hrl`, `/abs/dir/inc.hrl`, `../inc/x.hrl`) | Le chemin relatif au répertoire de travail quand le fichier s'y trouve, sinon le chemin absolu | [transformations](transforms.md#interchange) |
| Annotations `generated` des formes importées (entrées `.abstr`, sortie d'une transformation) | `erl_lint` et le compilateur omettent certains avertissements pour le code généré | Ignorées : le code est vérifié comme du source | [transformations](transforms.md#importing-forms) |
| Formes `{error, {Location, Module, Descriptor}}` dans du code importé | Formatées avec `Module:format_error/1` | Le texte du terme du descripteur ; le formatage nécessite OTP | [transformations](transforms.md#importing-forms) |
| Un module avec des erreurs de préprocesseur ou d'analyse syntaxique qui nomme une parse transform | La transformation s'exécute et reçoit les erreurs sous forme de formes `{error, E}` ; `erl_lint` les signale ensuite | Les erreurs sont signalées et la transformation ne s'exécute pas | [transformations](transforms.md#clause-pipeline) |
| Options de compilation reçues par une transformation | La liste complète des options d'erlc | `{features, _}`, `report_warnings`, `report_errors`, `{cwd, _}`, `{outdir, _}` (le répertoire de travail), `{i, _}`, `{d, ...}` et `{parse_transform, _}` | [transformations](transforms.md#otp-behavior) |
