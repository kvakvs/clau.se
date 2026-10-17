---
source: docs/ports.md
sourceCommit: a8c3f8f6
sourceSha256: 59defde90218e0d1374492f8e7fccd5a737dec02f9c4fc9f5f94fc392a26789f
translatedAt: 2026-10-17
---
# Ports

Les programmes disposent des ports tels qu'OTP les définit, et les E/S externes
passent par eux. La table des ports, les règles de sortie et les tâches de
ports se trouvent dans `runtime/src/scheduler/ports.cpp`, les builtins dans
`runtime/src/builtins/erlang/ports.cpp`, les pilotes et le thread d'E/S dans
`runtime/src/ports/`. Goldens OTP : `executables_port_identities`,
`executables_port_input`, `executables_port_spawn`, `executables_file_io`,
`executables_sockets`, `executables_many_ports`, `executables_port_fairness`,
`executables_busy_ports`, `executables_slow_owner` ; test du runtime
`runtime_port_io`.

## Identité

- Un port est un mot immédiat : étiquette `0x7` (`TermKind2::port` sous
  l'étiquette primaire `see_termkind2`, à côté du `0x3` des pids), charge
  utile un numéro de port issu d'une séquence unique à l'échelle du processus
  qui n'est jamais réutilisée, comme les numéros de pid
  ([pids](terms.md#pids-and-references)). Un runtime n'admet que les numéros
  qu'il a émis ; les mots de port forgés ou étrangers sont rejetés.
- Affichage : `#Port<0.N>` ; `port_to_list/1` donne ce texte et
  `list_to_port/1` l'analyse (badarg pour toute autre chose).
- Ordre : nombres < atomes < références < funs < ports < pids < tuples, comme
  dans OTP ; les ports se comparent par numéro.
- L'identité d'un port fermé reste valide : `is_port/1` reste vrai,
  `port_info/1,2` répondent `undefined`, les envois vers lui sont abandonnés.
- Les ports sont des immédiats, donc la copie, le ramassage et les messages ne
  nécessitent rien de nouveau.

## Table des ports et propriété

- Chaque runtime garde une table des ports (numéro → port) dans son
  exécuteur, protégée par le mutex de l'exécuteur comme les liens et les noms
  des processus ([workers](processes.md#workers)).
- Un port enregistre son pilote, son processus connecté (celui qui l'a ouvert,
  changé par `port_connect/2` ou `{Pid, {connect, New}}`), ses liens, les
  moniteurs posés sur lui, un nom enregistré optionnel, ses options et ses
  compteurs d'octets d'entrée/sortie.
- `open_port/2` lie le nouveau port au processus qui l'ouvre. Lorsque le
  processus connecté se termine, son port se ferme ; un port qui se ferme
  envoie des signaux de sortie à ses liens et des messages `'DOWN'` à ses
  moniteurs avec sa raison (`normal` pour une fermeture qui n'est pas une
  erreur, un atome POSIX tel que `epipe` sinon).
- Un signal de sortie qui atteint un port le ferme avec sa raison (`kill` de
  `exit/2` devient `killed`), sauf `normal` via un lien depuis un processus
  autre que le processus connecté, qui ne fait que supprimer le lien.
  `exit(Port, normal)` ferme le port. Un processus connecté qui s'est délié
  laisse son port ouvert lorsqu'il se termine.
- Un message de requête provenant d'un processus autre que le processus
  connecté, ou un message mal formé, envoie au processus connecté un signal
  de sortie `badsig` depuis le port ; le port reste ouvert.
- Les signaux de sortie et les messages d'un port vers un processus qui
  s'exécute sur un autre worker attendent la fin de la tranche de temps de ce
  processus (ils ne contiennent que des atomes, des pids et des ports) ; un
  `exit(Port, Reason)` avec un terme de raison dans le tas de l'expéditeur
  fait réexécuter le builtin jusqu'à ce qu'aucun processus lié ou
  surveillant ne s'exécute ailleurs, comme pour les signaux de processus
  ([workers](processes.md#workers)).
- Les ports acceptent les noms enregistrés (`register/2`) et
  `monitor(port, Port)` ; `link/1` et `unlink/1` les acceptent.

## Builtins et messages de ports

- `is_port/1` (vrai pour les ports), `port_to_list/1`, `list_to_port/1`,
  `ports/0`.
- `port_info/1,2` : `name`, `links`, `id`, `connected`, `input`, `output`,
  `os_pid`, `monitors`, `monitored_by`, `registered_name`, `queue_size`
  ([ports occupés](#busy-ports)).
- `port_close/1`, `port_connect/2`, `port_command/2,3` ; les messages
  `Port ! {Pid, {command, Data}}`, `{Pid, close}`, `{Pid, {connect, New}}`.
- `link/1`, `unlink/1`, `monitor(port, P)`, `exit/2` sur des ports ;
  `register/2` d'un port.
- `port_control/3`, `port_call/3` : `badarg` pour les pilotes sans contrôle ;
  le pilote `file` et les pilotes de sockets sont pilotés par
  `port_control/3`.
- `open_port({fd, In, Out}, Opts)`, `open_port({spawn, Command}, Opts)`,
  `open_port({spawn_executable, File}, Opts)`, et les pilotes internes de la
  bibliothèque du projet (`file`, sockets).

Les erreurs suivent OTP : `badarg` pour un port fermé ou invalide et pour de
mauvais arguments, la raison POSIX (`enoent`, `eacces`) comme `error` pour une
ouverture qui échoue.

Les messages d'un port vont à son processus connecté :
`{Port, {data, Data}}`, `{Port, eof}` (option `eof`),
`{Port, {exit_status, Status}}` (option `exit_status`), `{Port, closed}`
(après `{Pid, close}`), `{Port, connected}` (à l'ancien propriétaire après une
connexion).

## Modes de données et options

| Option | Effet |
| --- | --- |
| `stream` (par défaut), `{packet, N}` (N = 1, 2, 4) | Octets tels qu'ils arrivent, ou messages délimités par une longueur big-endian de N octets que la sortie reçoit aussi |
| `{line, L}` | `{eol, Line}` par ligne, `{noeol, Part}` pour les parties plus longues que `L` ou une fin non terminée |
| `binary` | Données sous forme de binaries au lieu de listes d'octets |
| `eof` | `{Port, eof}` en fin d'entrée ; le port reste ouvert jusqu'à sa fermeture |
| `exit_status` | `{Port, {exit_status, S}}` lorsque le programme se termine (ports spawn) |
| `use_stdio` (par défaut), `nouse_stdio`, `stderr_to_stdout`, `in`, `out`, `hide` | Comme dans OTP (`hide` n'a aucun effet) |
| `{args, List}`, `{arg0, A}`, `{env, Env}`, `{cd, Dir}` | Ports spawn ([sous-processus](#subprocesses)) |
| `{busy_limits_port, {Low, High} \| disabled}` | Octets de sortie en file qui rendent le port occupé ([ports occupés](#busy-ports)) |

Sans `eof`, la fin de l'entrée ferme le port avec la raison `normal`, après le
message `exit_status` lorsqu'il a été demandé. Les options inconnues donnent
`badarg`.

## Pilotes

Un pilote (driver) est un objet C++ derrière un port (`runtime/src/ports/`) :
il ouvre la ressource, accepte la sortie (`port_command`), répond à
`port_control/3` lorsqu'il prend en charge le contrôle, signale l'entrée et
les erreurs sous forme d'événements et se ferme. Pilotes :

- `fd` : descripteurs existants, sortie écrite de façon synchrone, entrée via
  le thread d'E/S.
- `spawn` : un programme enfant dont stdin et stdout sont des tubes
  ([sous-processus](#subprocesses)).
- `file` : un fichier ouvert du module `file` de la bibliothèque du projet ;
  ses opérations sont des appels synchrones à `port_control/3` qui peuvent
  bloquer le worker exécutant l'appelant pendant la durée des E/S disque,
  comme le font les ordonnanceurs dirty I/O d'OTP
  ([fichiers](#standard-io-and-files)).
- `tcp_inet`, `udp_inet` : sockets de `gen_tcp`, `gen_udp` et `inet` de la
  bibliothèque du projet, sur Boost.Asio ; les connexions, acceptations et
  réceptions sont asynchrones ([sockets](#sockets)).

Les pilotes internes de `file` et des sockets sont ouverts avec
`{spawn_driver, Name}` sous des noms propres à Clause, et leurs opérations
`port_control/3` forment un protocole de Clause : les programmes utilisent les
modules de la bibliothèque, pas les protocoles `prim_inet`/`efile` d'OTP.

## Thread d'E/S

Un thread d'E/S par runtime (`detail::Reactor`,
`runtime/src/ports/reactor.hpp`) exécute un `io_context` de Boost.Asio : un
port de complétion d'E/S sous Windows, `epoll` sous Linux, `kqueue` sous
macOS. Le premier port qui en a besoin le démarre ; il sert tous les types de
ports, de sorte qu'un port ne coûte aucun thread propre :

- Tubes des programmes lancés : tubes nommés en mode overlapped sous Windows
  (`windows::stream_handle` ; les tubes anonymes ne peuvent pas être en mode
  overlapped), tubes ordinaires ailleurs (`posix::stream_descriptor`). La
  sortie est mise en file et écrite dans l'ordre par des écritures
  asynchrones.
- Entrée `fd` sous Linux et macOS : le thread attend que le descripteur soit
  lisible, puis un seul `read()` prend ce qui s'y trouve, de sorte que les
  descripteurs propres du programme conservent leur mode bloquant ; un
  fichier ordinaire, qu'on ne peut pas attendre, est lu immédiatement.
- Fins de programmes : sous Windows, le pool de threads d'attente du système
  (`RegisterWaitForSingleObject`, comme l'utilise `object_handle` d'Asio)
  attend le handle du processus et la fin est signalée sur le thread d'E/S ;
  sous Linux et macOS, un gestionnaire de `SIGCHLD` (`signal_set`) et
  `waitpid(WNOHANG)` récupèrent chaque programme surveillé, y compris après la
  fermeture de son port.
- Sockets ([sockets](#sockets)).
- Exception : un handle d'entrée `fd` sous Windows (une console ou un tube
  anonyme hérité) ne peut pas être en mode overlapped, il est donc lu par un
  thread bloquant qui lui est propre, comme le font libuv et ERTS ; fermer le
  port annule la lecture (`CancelSynchronousIo`) et libère le thread.

`runtime/src/ports/io*.cpp` contiennent les E/S des ports
(`detail::IoService`) : ses méthodes ne font que poster du travail vers le
thread d'E/S, où réside tout l'état des E/S. Le thread d'E/S transmet l'entrée
telle qu'elle a été lue : octets bruts, fin d'entrée, erreur de lecture, code
de sortie d'un programme. Les événements de sockets (messages, connexions
acceptées) sont transmis de la même façon.

Le prototype `tests/prototypes/poller/` (`run.py --wsl`) montre le réveil sous
Windows (port de complétion) et sous Linux WSL (`poll()`) : un thread
d'ordonnanceur inactif se réveille 9 à 91 µs après l'entrée, et l'arrêt
stoppe le thread d'E/S sans entrée.

À la fin du programme, chaque port est fermé (les programmes enfants voient la
fin de l'entrée ; ils ne sont pas tués, comme dans OTP) et le thread d'E/S
s'arrête : il est joint en dehors du mutex de l'exécuteur, car une livraison
en cours prend ce mutex ; un lecteur `fd` Windows bloqué dans une lecture qui
ne peut pas être annulée est détaché et ne délivre plus rien.

## Tâches de ports

Un port est ordonnancé comme un processus : ce que le thread d'E/S transmet
attend dans le port, et le port attend dans la file des ports de l'exécuteur
jusqu'à ce qu'un worker de l'ordonnanceur exécute sa tâche.

- Les workers prennent tour à tour une tâche de port et une tranche de temps
  de processus tant que les deux files ont du travail, de sorte qu'un port
  inondé d'entrées ne peut pas affamer les processus, et que les processus ne
  peuvent pas affamer les ports ; un worker inactif prend ce qui est en file.
- Une tâche s'exécute sous le mutex de l'exécuteur pendant
  `PORT_TASK_REDUCTIONS` (les 4 000 d'une tranche de temps) : chaque message
  qu'elle délivre coûte 100 réductions plus une par tranche de 64 octets
  transportés. Un port auquel il reste du travail est remis en fin de file.
- La tâche découpe l'entrée (`InputDecoder`) : l'entrée en flux arrive par
  les morceaux que renvoient les lectures ; `{packet, N}` retient les octets
  jusqu'à l'arrivée d'un paquet entier (un paquet incomplet en fin d'entrée
  est abandonné, comme dans OTP) ; `{line, L}` coupe à `\n`, envoie une ligne
  plus longue que `L` en morceaux `{noeol, Part}` et une fin non terminée en
  `{noeol, Rest}`. `port_info(P, input)` compte chaque octet lu, sauts de
  ligne et en-têtes de paquets compris, au moment où il est lu.
- La fin de l'entrée envoie `{Port, eof}` avec l'option `eof`, sinon ferme le
  port avec la raison `normal` ; une erreur de lecture le ferme avec `eio`.
- Un message devient immédiatement un message pour son processus lorsque ce
  processus ne s'exécute pas sur un worker (en le réveillant comme tout
  message), sinon à la fin de sa tranche de temps, de sorte que le tas d'un
  processus en cours d'exécution n'est jamais touché par un autre thread.
- Les commandes, fermetures, connexions et signaux de sortie envoyés à un port
  agissent immédiatement sur le worker de l'expéditeur, comme le fait ERTS
  pour un port qui n'est pas occupé : un port `fd` écrit sa sortie
  immédiatement sur le worker de l'appelant ; les pilotes de tubes et de
  sockets mettent la sortie en file et laissent le thread d'E/S l'écrire ; un
  port occupé suspend l'expéditeur ([ports occupés](#busy-ports)).

## Ports occupés

La sortie qu'un pilote met en file pour le thread d'E/S (tubes des programmes
lancés) est comptée par rapport aux limites d'occupation du port, le
`busy_limits_port` d'OTP (par défaut : haute 8 192 octets, basse 4 096 ;
`{busy_limits_port, {Low, High}}` ou `disabled` comme option de
`open_port/2`, limites d'au moins 1, une limite basse supérieure à la haute
étant abaissée à celle-ci) :

- Une écriture qui porte la sortie en file à la limite haute ou au-delà part
  quand même et rend le port occupé ; il reste occupé jusqu'à ce que le
  thread d'E/S en ait écrit assez pour que moins que la limite basse soit en
  file.
- `port_command/2` et `Port ! {Pid, {command, Data}}` vers un port occupé
  suspendent l'expéditeur, qui n'écrit rien ; une fois que le port n'est plus
  occupé, ou qu'il se ferme, l'expéditeur réexécute son builtin (un port fermé
  donne alors `badarg`, comme dans OTP). Un processus suspendu reçoit
  toujours les signaux de sortie.
- `port_command/3` avec `nosuspend` renvoie `false` pour un port occupé et
  n'écrit rien ; `force` lève `notsup`, car les pilotes spawn et `fd` d'OTP
  ne le permettent pas.
- `port_info(P, queue_size)` est la sortie en file non encore écrite.
- Les ports `fd` écrivent immédiatement et la sortie des sockets passe par
  `port_control/3`, donc aucun des deux n'est jamais occupé.

Un port borne aussi l'entrée qu'il retient :

- Lorsque plus de 64 Kio d'entrée brute attendent la tâche du port, le thread
  d'E/S cesse de lire le port (un programme qui y écrit se bloque alors,
  comme sur un tube plein) jusqu'à ce que la tâche l'ait ramenée sous
  32 Kio.
- Tant que le processus connecté peut s'exécuter (il est en cours
  d'exécution ou en file, ni en attente dans un `receive`, ni suspendu, ni
  bloqué) et détient déjà 1 024 messages (ou a autant de signaux de port en
  attente de la fin de sa tranche de temps), la tâche du port ne délivre plus
  rien jusqu'à la fin de la tranche de ce processus. Un processus en attente
  dans un `receive` reçoit toujours l'entrée, de sorte qu'une réception d'un
  message ultérieur du port ne peut pas attendre indéfiniment.

## Sous-processus

`open_port({spawn, Command}, Options)` et
`open_port({spawn_executable, File}, Options)` démarrent un programme dont
stdin et stdout sont des tubes du port :

- `{spawn, Command}` : sous Linux et macOS, `/bin/sh -c Command` ; sous
  Windows, `CreateProcessW` avec `Command` comme ligne de commande (il trouve
  le programme dans le chemin de recherche). `{spawn_executable, File}`
  exécute `File` sans shell, avec argv[0] `{arg0, A}` (par défaut `File`) et
  `{args, List}` ; sous Windows, les arguments sont mis entre guillemets selon
  les règles de `CommandLineToArgvW`.
- `{env, [{Name, Value | false}]}` définit ou supprime des variables de
  l'enfant, `{cd, Dir}` son répertoire, `stderr_to_stdout` fusionne stderr
  dans le port ; sinon l'enfant partage le stderr du programme. `in` n'ouvre
  aucun tube stdin et `out` aucun tube stdout (le périphérique nul à la
  place). `hide` et `overlapped_io` n'ont aucun effet.
- Un programme qui ne peut pas être démarré lève `error:Reason` avec la
  raison POSIX (`enoent`, `eacces`, `enoexec`) ; les noms et options
  incorrects lèvent `badarg`.
- La sortie est mise en file et écrite par le thread d'E/S, avec les limites
  d'occupation du port ([ports occupés](#busy-ports)) ; fermer le port le
  laisse terminer ce qui est en file, puis ferme le stdin du programme. Le
  programme n'est jamais tué ; il se termine généralement en fin d'entrée.
- L'option `exit_status` envoie `{Port, {exit_status, S}}` une fois le
  programme terminé (son code de sortie ; sous Linux et macOS, 128 plus le
  signal pour un programme terminé par un signal) et avant `{Port, eof}` ou la
  fermeture en fin d'entrée ; un port qui ne lit rien le signale lorsque le
  programme se termine, puis se ferme.
- `port_info(P, os_pid)` est l'identifiant de processus du programme ; `name`
  est la commande ou le fichier.
- `os:cmd/1` de la bibliothèque exécute `Command` avec `COMSPEC /c` sous
  Windows (`cmd` s'il n'est pas défini) ou `/bin/sh -c`, collecte stdout et
  stderr jusqu'à ce que le programme les ferme et renvoie les octets sous
  forme de liste ; `os:type/0` vaut `{win32, nt}`, `{unix, linux}` ou
  `{unix, darwin}` ; `os:getenv/1` renvoie une chaîne ou `false`.

## E/S standard et fichiers

- `io:format`, `io:put_chars` et `erlang:display` écrivent directement sur la
  sortie standard ([io](io.md)). L'entrée standard est lue par un unique
  processus serveur de la bibliothèque, enregistré sous `clause_stdin` et
  démarré à la première utilisation, qui possède un port `{fd, 0, 1}` :
  `io:get_line/1,2` écrit l'invite, puis renvoie la ligne suivante avec son
  saut de ligne, le reste de l'entrée sans saut de ligne à la fin, puis
  `eof` ; `io:get_chars/2,3` renvoie jusqu'à `N` caractères, puis `eof`. Les
  requêtes de plusieurs processus sont servies dans l'ordre d'arrivée.
  L'entrée est renvoyée sous forme d'octets (un élément de liste par octet).
- Le module `file` de la bibliothèque pilote le pilote de fichiers du runtime,
  `{spawn_driver, "clause_file"}`, avec `port_control/3`. Ses opérations
  (`ports/file.cpp` : open, read, write, position, read_line, close, et les
  opérations sur les chemins read_file, write_file, delete, rename, list_dir,
  make_dir, del_dir et read_file_info, `ports/file_info.cpp` ; get_cwd,
  set_cwd, read_link, read_link_info, make_link et make_symlink,
  `ports/file_paths.cpp`) sont des appels système synchrones sur le worker de
  l'appelant, en dehors du mutex de l'exécuteur ; leurs réponses commencent
  par un octet de statut (0 ok, 1 erreur suivie de sa raison POSIX, 2 fin de
  fichier). Le protocole est propre à Clause. read_line lit 64 Ko en avance
  et renvoie des lignes depuis ce tampon ; toute autre opération sur le
  fichier recule d'abord sur les octets qu'elle n'a pas renvoyés, de sorte que
  les positions restent exactes.
- `file:open/2` renvoie le pid d'un serveur d'E/S qui possède un port de
  fichier et est lié au processus qui l'ouvre (modes `read`, `write`,
  `append`, `exclusive`, `binary` ; les autres modes sont ignorés, comme OTP
  ignore les options qu'il n'utilise pas ; `write` tronque sauf si `append`
  est aussi donné).
- `file:write_file/3` ouvre avec ses modes plus `binary` et `write` ;
  `file:read_file_info/1,2` renvoient le `#file_info{}` d'OTP à partir du
  statut du chemin (en suivant les liens), avec les heures en date et heure
  locales ou universelles ou en secondes POSIX
  (`{time, local | universal | posix}` ; `raw` est accepté). Sous Windows,
  `inode`, `uid` et `gid` valent 0 et `major_device` est le numéro du lecteur,
  comme OTP les rapporte. `read/2`, `read_line/1`, `write/2`, `position/2` et
  `io:get_line/2`, `io:get_chars/3` sur ce pid sont des requêtes à ce
  serveur ; après `close/1`, les requêtes renvoient `{error, terminated}` et
  `close/1` reste `ok`.
- Protocole d'E/S d'OTP : le serveur de l'entrée standard et le serveur de
  chaque fichier ouvert répondent à `{io_request, From, ReplyAs, Request}` par
  `{io_reply, ReplyAs, Reply}`, qu'envoient `io:request/1,2` et
  `io:requests/1,2` (`standard_io` et `user` désignent le serveur de l'entrée
  standard, un autre atome un processus enregistré ; `{error, arguments}`
  lorsqu'il n'est pas enregistré, `{error, calling_self}` pour l'appelant
  lui-même). Requêtes : `get_until` (`M:F(Cont, Chars | eof, Extra...)` à
  partir de `Cont = []`, alimentée par ce qui est en tampon ou par des blocs
  de fichier de 4 Kio jusqu'à `{done, Result, Rest}` ; `Rest` est relu par la
  requête suivante : conservé dans le tampon, ou pour un fichier la position
  recule d'autant), `get_line`, `get_chars`, `put_chars` (caractères ou
  `M:F(A)`), les anciennes formes sans encodage (latin1), et
  `{requests, List}` (dans l'ordre, en s'arrêtant au premier `{error, _}`).
  Les caractères sont des octets, comme ci-dessus ; un fichier en mode binaire
  renvoie un résultat de liste de `get_until` sous forme de binary. Les autres
  obtiennent `{error, {request, Request}}`. Une fonction `get_until` ou
  `put_chars` qui échoue fait répondre au serveur d'un fichier
  `{error, Function}` et le fait sortir avec l'échec, comme celui d'OTP ; le
  processus qui l'a ouvert continue de vivre (le serveur de fichiers d'OTP ne
  lui est pas lié). Les requêtes d'entrée sur l'entrée standard écrivent leur
  invite.
- Répertoires, liens et copies : `get_cwd/0` écrit le répertoire courant comme
  OTP (barres obliques, lettre de lecteur en minuscule), `get_cwd/1` prend un
  lecteur Windows (`enotsup` ailleurs) ; `set_cwd/1` le change pour tout le
  programme ; `read_link/1`, `read_link_all/1` (`einval` pour un chemin qui
  n'est pas un lien), `read_link_info/1,2` (le statut propre d'un lien final :
  `lstat` POSIX, sous Windows les champs de la cible avec le type `symlink`),
  `make_link/2`, `make_symlink/2` (exige un privilège sous Windows : `eperm`,
  comme OTP), `list_dir_all/1`, `del_dir_r/1`, `copy/2,3` (noms,
  `{Name, Modes}` ou fichiers ouverts ; `{ok, BytesCopied}`),
  `raw_read_file_info/1`, `read_file/2`, `delete/2`,
  `native_name_encoding/0` (`utf8`). `del_dir/1` répond `enoent` pour un
  chemin absent et `enotdir` pour un fichier. `consult/1` et la famille
  `eval`/`script` restent des bouchons : ils exigent l'analyseur généré
  d'OTP.
- Le `file` de Clause est la couche fichiers ; `filelib` et `filename` d'OTP
  sont de l'Erlang ordinaire qui s'exécute dessus lorsque le chemin de
  recherche d'un programme contient les sources d'OTP
  (`filelib:fold_files/5` exige `re`) ; `erl_prim_loader` est fourni au-dessus
  de `file` avec les réponses `error` nues d'OTP et un chemin de chargement
  `["."]` (`set_path/1`), ses fonctions de chargement et d'archives étant
  refusées jusqu'au plan step 71 ; `prim_file` et `prim_buffer` restent
  absents, de sorte que les appelants `raw_file_io*` d'OTP n'entrent jamais
  dans un programme.
- Les erreurs suivent OTP : `{error, enoent}`, `eexist`, `eisdir` (un
  répertoire ouvert ou lu comme un fichier), `einval` (une position
  négative), `ebadf` (lecture d'un fichier en écriture seule ou écriture d'un
  fichier en lecture seule), `badarg` pour les noms et données incorrects.
  Les noms de fichiers sont des chaînes, des binaries ou des atomes, encodés
  en UTF-8.

## Sockets

Une socket est un port, comme avec le backend `inet_drv` d'OTP :
`is_port(Socket)` est vrai et les messages du mode actif sont
`{tcp, Socket, Data}`, `{tcp_closed, Socket}`,
`{tcp_error, Socket, Reason}`, `{udp, Socket, Address, Port, Data}`. Le
sous-ensemble : `gen_tcp:connect/3,4`, `listen/2`, `accept/1,2`, `send/2`,
`recv/2,3`, `close/1`, `controlling_process/2`, `shutdown/2` ;
`gen_udp:open/1,2`, `send/4`, `recv/2,3`, `close/1` ; `inet:setopts/2`,
`inet:port/1`, `inet:peername/1`, `inet:sockname/1` ; modes
`{active, true | false | once}`, `binary`/`list`,
`{packet, 0 | 1 | 2 | 4 | raw}`, `{reuseaddr, Bool}`, `{backlog, N}`,
`{ip, Address}`/`{ifaddr, Address}`, `inet`/`inet6` ; adresses IPv4 et IPv6
sous forme de tuples, noms d'hôtes sous forme de chaînes ou d'atomes
(`loopback` compris). Les options de réglage `nodelay`, `keepalive`,
`send_timeout`, `send_timeout_close`, `delay_send` et `exit_on_close` sont
acceptées et non appliquées ; toute autre option donne `exit(badarg)`, comme
pour une option invalide dans OTP.

Implémentation (`runtime/src/ports/sockets.cpp`) :

- Le thread d'E/S du runtime ([thread d'E/S](#io-thread)) sert les sockets ;
  l'état de chaque socket réside sur ce thread. La bibliothèque ouvre un port
  avec `{spawn_driver, "tcp_inet" | "udp_inet"}` et le pilote avec
  `port_control/3` ; le worker appelant poste l'opération vers le thread
  d'E/S et attend sa réponse synchrone (octet de statut 0 et un résultat, ou
  1 et une raison POSIX).
- Les opérations qui attendent (connect, accept, recv) répondent plus tard par
  un message `{clause_socket, Socket, Reply}` à leur appelant, de sorte que
  l'appelant se bloque dans un `receive` ordinaire et que les autres
  processus continuent de s'exécuter. Un délai d'attente annule la requête ;
  l'annulation elle-même répond `cancelled` après tout ce que la socket a
  envoyé auparavant, de sorte qu'une réponse arrivée la première est renvoyée
  au lieu d'être perdue.
- Les messages de sockets sont décrits hors tas (`ports/value.hpp`) et
  construits dans le tas du destinataire lors de leur livraison
  ([tâches de ports](#port-tasks)). Une connexion acceptée devient un nouveau
  port appartenant à l'appelant d'`accept` et lié à lui, avec le mode de la
  socket d'écoute.
- `controlling_process/2` arrête la livraison active, déplace vers le nouveau
  propriétaire les messages de la socket déjà envoyés à l'ancien, puis
  reconnecte le port, comme le fait `inet` d'OTP ; seul le propriétaire peut
  l'appeler (`{error, not_owner}`).
- La sortie est mise en file sans plafond et écrite dans l'ordre sur le
  thread d'E/S. Fermer un port envoie ce qui est en file, puis ferme la
  connexion proprement (FIN) ; un port fermé répond `{error, closed}` à
  chaque appelant en attente. La résolution de noms s'exécute sur le worker
  de l'appelant, car elle est bloquante.
- Les ports de sockets sont ordonnancés comme les autres ports
  ([tâches de ports](#port-tasks)) : les messages d'une socket attendent dans
  son port jusqu'à ce que la tâche du port les délivre.
- Adresses et hôtes : `inet:parse_address/1,2`,
  `parse_strict_address/1,2`, `parse_ipv4_address/1`,
  `parse_ipv4strict_address/1`, `parse_ipv6_address/1`,
  `parse_ipv6strict_address/1` (les formes souples d'OTP : champs IPv4 courts
  et octaux ou hexadécimaux, `::`, queues IPv4, `%scope` de `fe80::` et
  `ff02::`), `ntoa/1` (l'écriture d'OTP : hexadécimal en minuscules, la
  première plus longue suite de zéros sous forme `::`), `is_ipv4_address/1`,
  `is_ipv6_address/1`, `is_ip_address/1` sont en Erlang ; `gethostname/0` (une
  opération de socket), `getaddr/2`, `getaddrs/2` (le résolveur du système,
  `getaddrinfo`) et `gethostbyname/1,2` (`h_name` est le nom demandé, sans
  alias) répondent via un port de socket ouvert pour la requête.
- Les `gen_tcp`, `gen_udp` et `inet` de Clause sont la couche réseau et
  s'étendent vers les listes d'exports d'OTP selon les besoins des
  programmes ; les modules `socket` et `net` d'OTP (l'API NIF des sockets)
  sont absents, de même que `prim_socket`, `prim_net`, `prim_inet` et
  `socket_registry`.

## Non fourni

Les pilotes liés (linked-in drivers) et les NIF,
`erlang:open_port({spawn_driver, Name})` pour les noms de pilotes d'OTP, les
ports de distribution, `port_call/3` sur les pilotes fournis en dehors du
protocole propre à la bibliothèque, les ports de sockets occupés, et les
options `overlapped_io`, `parallelism` et `busy_limits_msgq`.
