---
source: docs/differences.md
sourceCommit: 06042fa
sourceSha256: b5d1cfc31fec7aaf6e6c4ca75f9056df534ca608a2c93e97a44e6c5e00a1109b
translatedAt: 2026-10-09
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
| Formatage d'un grand terme (`io:format/1,2`) | S'exécute en code Erlang (`io_lib`) et dans le group leader, le processus peut donc être préempté pendant le formatage | S'exécute jusqu'au bout dans un seul appel de builtin ; les autres processus attendent | [builtins](builtins.md#portions) |
| Drapeaux de `process_flag/2` | `trap_exit`, `priority`, `message_queue_data`, `min_heap_size` et d'autres | Seulement `trap_exit` ; tout autre drapeau lève `badarg` | [processus](processes.md#builtins) |
| Ordre des rapports d'erreur de processus qui plantent en même temps | Ordre du logger | L'ordre dans lequel leurs threads de travail les terminent | [processus](processes.md#workers) |
| Signaux vers un processus s'exécutant sur un autre ordonnanceur | Placés dans sa file de signaux et traités plus tard, pendant que l'émetteur continue | L'émetteur attend la fin de la tranche de temps de la cible, puis agit aussitôt ; observable seulement dans les délais | [processus](processes.md#workers) |
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
| Cadres des BIF/opérateurs en échec | Présents (`{erlang, '+', Args, ...}`) | Absents ; rien sous la fonction d'entrée | [ABI](abi.md#stack-traces) |
| Table des atomes pleine (`list_to_atom/1`) | L'émulateur s'arrête (`no more index entries in atom_tab`) et écrit un crash dump | `clau: runtime failure: entry call failed: resource_limit`, code de sortie 70 | [builtins](builtins.md#how-calls-reach-them) |
| `list_to_integer/1,2` avec des caractères au-delà de 255 | Ses premiers chiffres n'utilisent que l'octet de poids faible de chaque caractère (`[16#131]` donne 1) | `badarg` | [builtins](builtins.md#how-calls-reach-them) |
| `erlang:function_exported/3` d'une BIF | Vrai pour toute BIF de l'émulateur | Vrai seulement pour les builtins fournies par ce runtime | [builtins](builtins.md#how-calls-reach-them) |
| Rapports d'erreur des processus plantés | Envoyés au logger, écrits plus tard par son gestionnaire par défaut (sur la sortie standard sous `erl`, souvent perdus quand un escript s'arrête avant) | Écrits sur stderr à la fin du processus, avant toute sortie ultérieure | [processus](processes.md#exits) |
| Appels de fonctions qui ne retournent jamais | Compilés en appels terminaux (appelant absent de la trace) | Appels ordinaires (appelant présent) | [ABI](abi.md#stack-traces) |
| Mémoire de l'hôte épuisée | L'émulateur signale qu'il ne peut pas allouer de mémoire, écrit un crash dump et s'arrête | `clau: runtime failure: entry call failed: out_of_memory`, code de sortie 70, pas de dump | [tas du runtime](runtime-heap.md#failure-behavior) |
| Plafond mémoire par processus | `max_heap_size` (en mots, tas et pile) tue le processus avec la raison `killed` et journalise un rapport d'erreur | `--max-heap` / `--max-stack` (octets) et `--max-memory`, valable pour tout le runtime, font échouer le processus demandeur avec `resource_limit` : `clau: runtime failure: entry call failed: resource_limit`, code de sortie 70 | [tas du runtime](runtime-heap.md#runtime-memory-limit) |
| Arguments du programme | `escript` transmet tous les arguments à `main/1` ; les options de l'émulateur (`+t`) viennent de `%%!` ou de `ERL_FLAGS` | Les options du runtime placées en tête (`--max-atoms`, `--max-heap`, `--max-stack`, `--max-memory`, `--args-file`, `--`) sont retirées d'abord ; `CLAUSE_FLAGS` contient les mêmes options | [exécutables](executables.md#runtime-options) |
| Exception non capturée dans un module d'entrée ordinaire | `escript` sort avec le code 127 | Sort avec le code 1 et une ligne `uncaught exception <class>: <reason>` (les sources escript gardent 127) | [exécutables](executables.md) |
| Diagnostics du compilateur | Formulation d'`erl_lint` (`variable 'X' is unbound`) et avertissements | Formulation propre (`unbound variable X`) ; les avertissements de lint d'OTP ne sont pour la plupart pas émis (y compris les champs de native record inconnus dans les accès, mises à jour et motifs) | [sémantique](semantic.md#bindings) |

## Cas limites du langage

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Segment entier plus large que la limite des entiers, valeur au-delà (`<<V:4194241>>` entièrement à un) | Le JIT x86 réussit le filtrage avec un terme invalide ; son utilisation fait planter la VM | Pas de correspondance | [termes](terms.md#integers) |
| Groupe zip dont les générateurs souples et stricts partagent une variable | Le test de saut conserve les variables des motifs stricts dans les motifs souples | Une étape rejetée est sautée dès que les motifs stricts correspondent à eux seuls | [motifs](patterns.md#comprehensions) |
| Appel d'une fun externe, `M:F(Args)` ou `apply/3` d'un module hors du programme | Charge le module depuis le chemin de code, `undef` s'il est absent | `undef` ; les modules de bibliothèque ne rejoignent le programme que lorsqu'il les nomme par un atome littéral | [funs](funs.md#dynamic-calls), [bibliothèque](library.md#how-programs-get-them) |
| `lists` et `maps` | Les modules complets ; `maps:keys/1`, `values/1`, `to_list/1`, `fold/3` suivent l'ordre interne de la map (ordre de la table des atomes pour les clés atomes, ordre de hachage au-delà de 32 clés) | Le [sous-ensemble de bibliothèque](library.md) ; les fonctions de map suivent l'ordre des clés | [bibliothèque](library.md) |
| Fichiers sans `#!` passés comme escripts | `escript file.erl` saute la première ligne | Compilés comme des modules ordinaires | [exécutables](executables.md) |
| Escripts beam précompilés et escripts archives | S'exécutent | Non pris en charge | [exécutables](executables.md) |
| Un `-spec` dont les types n'ont aucune valeur commune avec le résultat inféré, le domaine d'entrée ou les arguments d'un appel | Compile ; Dialyzer peut avertir | Erreur de compilation indiquant les types déclarés et inférés | [analyse sémantique](semantic.md#inference) |

## io

| Différence | OTP | Clause | Référence |
| --- | --- | --- | --- |
| Séquences de contrôle `~e ~f ~g ~x ~X ~+ ~# ~W ~P`, modificateur `K` | Formatées | `badarg` | [io](io.md#formats) |
| `~p` de conteneurs imbriqués sur plus de 256 niveaux | Affichés | `system_limit` | [io](io.md#pretty-printing-p) |
| Largeurs de champ et précision de `~ts` avec des caractères combinants ou `\r\n` | Comptent les grappes de graphèmes | Comptent les points de code | [io](io.md#formats) |
| Précision ou nombre de remplissage négatif (`~.*c` avec -1) | Boucle indéfiniment | `badarg` | [io](io.md#formats) |
| Fonctions `io` autres que `format/1,2`, `put_chars/1` | Existent | `unknown module io` | [io](io.md#calls) |
