---
source: docs/processes.md
sourceCommit: 06042fa
sourceSha256: 9add4b7c491f5fe2b819ab08fada089a098afd08cd71b803a8c87cab16f57892
translatedAt: 2026-10-09
---
# Processus

Plan 11 step 43 (2026-10-08) : processus créés par spawn sur un exécuteur
coopératif ; step 44 : raisons de sortie et rapports d'erreur ; step 45 :
envoi de messages ; step 46 : réception sélective ; step 47 : délais
d'attente de réception ; step 48 : liens et signaux de sortie ; step 49 :
moniteurs ; step 50 : noms enregistrés ; step 53 : ports (aucun) ; step 56 :
workers de l'ordonnanceur ; step 57 : réveils entre workers et arrêt.

## Exécuteur

Un runtime exécute ses processus sur ses workers d'ordonnanceur
([workers](#workers), [modèle d'exécution](execution-model.md)). Le démarrage
fait de l'appel de la fonction d'entrée le premier processus, le processus
principal, et exécute l'exécuteur jusqu'à ce qu'il se termine :

- Les processus exécutables attendent dans une file unique de type premier
  entré, premier sorti. Un worker exécute le premier pendant une tranche de
  temps de 4 000 réductions (`CONTEXT_REDS` d'OTP), puis le remet en fin de
  file, sauf s'il s'est terminé.
- Chaque entrée de fonction dépense une réduction : appels, appels terminaux,
  appels de fun et dynamiques, et builtins. S'il n'en reste plus, l'entrée
  n'a pas lieu : le processus enregistre la fonction dans laquelle il entrait,
  garde ses arguments dans ses registres (ils restent des racines de
  collecte) et retourne à l'exécuteur, qui le reprend plus tard en répétant
  l'entrée. Une boucle qui ne fait aucun appel (une comprehension sur une
  liste sans appels dans son corps) s'exécute jusqu'au bout avant que le
  processus puisse céder la main. Les builtins dont le travail croît avec un
  argument liste ou binary s'exécutent par portions et cèdent la main entre
  elles ([portions](builtins.md#portions)).
- Chaque processus possède son tas et sa pile. Les arguments d'un nouveau
  processus sont copiés dans son tas
  ([copie entre tas](runtime-heap.md#copying-between-heaps)).
- Un processus se termine lorsque son premier appel retourne ou lève une
  exception. Le contexte, le tas et la pile d'un processus terminé sont
  libérés immédiatement ; son pid reste un terme valide et
  `is_process_alive/1` renvoie false pour lui.
- Un processus en attente dans un `receive` n'est pas dans la file ; un envoi
  qui lui est destiné le remet en fin de file ([réception](#receive)).
- Lorsque le processus principal se termine, le programme se termine avec son
  résultat ([exécutables](executables.md)) : les processus encore en file ou
  en attente sont libérés sans poursuivre leur exécution, comme un escript
  OTP s'arrête lorsque `main/1` retourne.
- Un signal de sortie qui termine le processus principal termine le programme
  ([signaux de sortie](#exit-signals)).
- `erlang:halt/0,1` dans n'importe quel processus termine le programme avec
  son code. Un échec du runtime dans n'importe quel processus (mémoire
  épuisée, plafond optionnel dépassé, erreur interne) termine le programme
  comme un échec du runtime (code de sortie 70). Une exception Erlang ne
  termine que le processus qui l'a levée ([sorties](#exits)).
- Les invocations par l'hôte de fonctions exportées (`CLAUSE_invoke_v1`)
  exécutent leur fonction dans le contexte appelant jusqu'au bout, en la
  reprenant après chaque cession sans exécuter d'autres processus ; les
  programmes démarrés par `CLAUSE_main_v1` utilisent l'exécuteur.

## Workers

Plan step 56 (2026-10-08). L'exécuteur exécute les processus sur
`RuntimeOptions::schedulers` threads workers : le thread qui a démarré le
programme et un thread de plus par worker supplémentaire. Les programmes
prennent ce nombre dans `--schedulers N` (1 à 1 024,
[options du runtime](executables.md#runtime-options)) ; par défaut, un worker
par processeur logique, comme `+S` d'OTP.

- Chaque worker prend le premier processus de l'unique file partagée
  (l'alternative documentée aux files par worker avec vol de travail : une
  seule file conserve l'ordre premier entré, premier sorti d'OTP et ne
  nécessite aucun vol). Les workers inactifs dorment jusqu'à ce qu'un
  processus soit mis en file ou que le plus proche délai de réception expire.
- Un mutex de l'exécuteur protège la file, les processus en attente, les
  minuteries, les noms enregistrés, les liens et moniteurs de chaque processus,
  et chaque processus qui n'est pas en cours d'exécution. Le tas, la pile, la
  boîte aux lettres et le canal d'échec d'un processus en cours d'exécution
  n'appartiennent qu'à son worker ; le code Erlang s'exécute sans le verrou.
- Les liens, moniteurs et noms changent immédiatement sous le verrou, y
  compris pour un processus qui s'exécute ailleurs. Un envoi, ou un signal de
  sortie de `exit/2` ou `exit_signal/2`, vers un processus qui s'exécute sur
  un autre worker ne peut pas toucher son tas : le builtin ne fait rien et son
  processus termine sa tranche (`builtins::Blocked`) ; il attend que la
  tranche de la cible se termine, puis s'exécute en premier et répète le
  builtin avec les mêmes arguments. La cible est retenue jusque-là, de sorte
  que le builtin répété ne peut pas la retrouver en cours d'exécution. Un
  processus qui se termine avec des liens ou des moniteurs dont les processus
  s'exécutent ailleurs est finalisé de la même façon une fois leurs tranches
  terminées.
- Ainsi, les messages et les signaux de sortie prennent toujours effet au
  moment où ils sont envoyés : un envoi retourne une fois le message dans la
  boîte aux lettres du destinataire, et `is_process_alive/1` après
  `exit(Pid, kill)` vaut false, comme OTP le promet pour les signaux émis par
  l'appelant.
- Un spawn lie ou surveille le nouveau processus (`spawn_link`,
  `spawn_monitor`) avant qu'un worker puisse l'exécuter. Un processus créé
  peut s'exécuter avant que son parent ne continue, donc un programme qui
  surveille un processus de courte durée ou s'y lie après `spawn/1` peut voir
  `noproc`, comme sur un OTP à plusieurs ordonnanceurs.
- La fin du processus principal, un halt ou un échec du runtime arrête le
  programme une fois que chaque worker a terminé sa tranche en cours ; les
  autres processus sont alors libérés.
- Les services partagés du runtime sont synchronisés
  ([threads](runtime.md#threads)) : atomes, serveur de code, numéros de pid et
  compte mémoire.
- Les sorties de différents processus s'entrelacent dans l'ordre où leurs
  écritures ont lieu. Chaque appel `io:format` et `erlang:display` écrit son
  texte d'un seul coup.

Les réveils et l'arrêt (plan step 57) ne nécessitent aucun mécanisme
supplémentaire, car tout changement de l'état d'ordonnancement d'un processus
se fait sous le mutex de l'exécuteur :

- Un message, `'EXIT'` ou `'DOWN'` destiné à un processus en attente le met
  en file dans la même section critique qui le délivre, et réveille un worker
  inactif. Un processus qui est encore dans la tranche où il a commencé à
  attendre ne peut alors pas recevoir de message (ses expéditeurs attendent la
  fin de la tranche), donc la livraison le trouve toujours parqué.
- Un worker qui ne trouve aucun processus exécutable dort jusqu'à ce qu'un
  autre worker en mette un en file, jusqu'au plus proche délai de réception
  ou jusqu'à la fin du programme ; parquer un processus avec un délai réveille
  chaque worker inactif afin qu'ils attendent la nouvelle échéance. Les
  workers occupés vérifient les minuteries avant chaque tranche.
- Un message et l'expiration du délai d'une même réception peuvent entrer en
  concurrence : le premier arrivé met le processus en file et annule l'autre,
  et la réception prend un message arrivé avant sa reprise, comme le fait
  celle d'OTP.
- Un signal de sortie vers un processus en attente, en file, retenu ou bloqué
  le retire de l'endroit où il se trouve avant qu'il ne soit finalisé.
- Lorsque le programme se termine, chaque worker termine sa tranche en cours
  et s'arrête ; `run()` retourne après les avoir joints, et tout autre
  processus démarré par l'exécuteur est libéré, de sorte que le runtime
  s'arrête sans aucun contexte restant.
- Le golden OTP `executables_wakeups` éprouve cela avec 1, 2, 4 et tous les
  workers : des récepteurs dont les délais de 0 à 2 ms entrent en concurrence
  avec les messages de leurs expéditeurs, une chaîne de 16 processus liés
  tournant en boucle terminée par un seul signal de sortie avec chaque membre
  surveillé, des processus surveillés se terminant au moment où leur
  observateur se réveille, un programme se terminant pendant que des
  processus tournent, attendent et s'inondent mutuellement, et un halt dans un
  autre processus.

## Sorties

Un processus autre que le principal se termine avec une raison de sortie,
comme dans OTP (`detail::exit_reason`, `process/exits`). Les signaux de sortie
la transmettent aux processus liés ([liens](#links)) et les messages `'DOWN'`
aux processus qui le surveillent ([moniteurs](#monitors)) ; les rapports
d'erreur l'affichent.

| Comment le processus se termine | Raison de sortie | Rapport d'erreur |
| --- | --- | --- |
| Son premier appel retourne | `normal` | Aucun |
| `exit(Reason)` (y compris `normal`, `kill`) | `Reason` | Aucun |
| Une erreur (`error/1,2,3`, `badarith`, `{badmatch, V}`, `undef`, ...) | `{Reason, Stack}` | Oui |
| Un `throw(Value)` non capturé | `{{nocatch, Value}, Stack}` | Oui |
| Un signal de sortie le termine ([signaux de sortie](#exit-signals)) | La raison du signal, `killed` pour `exit(Pid, kill)` | Aucun |

Un rapport d'erreur est écrit sur stderr lorsque le processus se termine,
après le vidage de la sortie standard, au format du gestionnaire de
journalisation (logger handler) par défaut d'OTP :

```text
=ERROR REPORT==== 8-Oct-2026::03:42:15.983000 ===
Error in process <0.8.0> with exit value:
{boom,[{crash_reports,'-main/1-fun-6-',0,[]}]}

```

L'en-tête contient l'heure locale ; la raison est mise en page comme le fait
`~p`. Le processus principal n'en écrit pas : son exception non capturée est
celle du programme ([exécutables](executables.md)).

## Messages

`Dest ! Msg` et `erlang:send(Dest, Msg)` (plan step 45) évaluent d'abord
`Dest` et renvoient `Msg`.

| `Dest` | Effet |
| --- | --- |
| Un pid d'un processus vivant | `Msg` est copié dans le tas du destinataire ([copie entre tas](runtime-heap.md#copying-between-heaps)), en conservant son partage, et ajouté à sa boîte de réception des signaux |
| Un pid d'un processus terminé | Rien ; l'envoi réussit |
| Un [nom enregistré](#registered-names) | Comme pour son pid ; `badarg` lorsqu'aucun processus vivant ne porte ce nom |
| `{Name, nonode@nohost}` de deux atomes | Comme pour le pid enregistré sous `Name` ; rien s'il n'y en a pas |
| `{Name, Node}` pour tout autre nœud | Rien (il n'y a pas d'autres nœuds) |
| Toute autre chose | `badarg` |

- Les messages d'un même expéditeur arrivent dans l'ordre où il les a
  envoyés ; un envoi à soi-même est un message comme un autre.
- Chaque message est une racine de collecte de son destinataire jusqu'à ce
  qu'une réception le prenne
  ([tas du runtime](runtime-heap.md#roots-and-safe-points)).
- La boîte aux lettres du destinataire (`Mailbox`) contient une boîte de
  réception des signaux, où les envois ajoutent, et une file de messages que
  la réception parcourt à partir d'une position sauvegardée : les messages
  arrivés passent derrière la file lorsqu'une réception les examine.
- Lorsque le tas du destinataire refuse la copie (un plafond optionnel tel que
  `--max-heap`, ou l'hôte à court de mémoire), rien n'est délivré et le
  processus expéditeur échoue comme un échec du runtime (code de sortie 70),
  comme tout processus qui dépasse un plafond.

## Réception

`receive` (plan steps 46–47) choisit parmi ses clauses comme `case`, sur les
messages de la boîte aux lettres :

- Le parcours de la boîte aux lettres commence au message le plus ancien.
  Chaque message est confronté aux clauses dans l'ordre (motifs et guards,
  qui peuvent lire des liaisons antérieures au `receive`) ; le premier
  message reconnu par une clause est retiré et le corps de cette clause
  s'exécute. Les messages qu'aucune clause ne reconnaît restent dans la boîte
  aux lettres dans leur ordre ; la réception suivante recommence au message le
  plus ancien.
- Lorsque tous les messages ont été examinés, le processus attend
  (`CLAUSE_wait_frame_v1`, un builtin dans lequel on entre comme un appel) :
  il quitte la file d'exécution jusqu'à ce qu'un envoi lui délivre un
  message, puis le parcours continue avec les messages arrivés. Les processus
  en attente gardent leurs cadres et leurs messages comme racines de collecte
  et effectuent une collecte à la reprise
  ([processus en attente](runtime-heap.md#waiting-and-suspended-processes)).
- Les noms liés dans chaque clause, et dans le corps `after` s'il y en a un,
  sont exportés après le `receive`, comme pour `case` ; un appel en position
  terminale du corps d'une clause ou du corps `after` est un appel terminal,
  donc une boucle de serveur s'exécute en pile constante.
- `after T -> Body` : `T` est évalué en premier, avant le parcours. Lorsque
  la réception devrait attendre, `T` doit être `infinity` ou un entier dans
  0..4294967295 (millisecondes), sinon `error:timeout_value` ; un message qui
  correspond immédiatement ne le vérifie jamais, comme dans OTP. `after 0`
  exécute `Body` dès que tous les messages ont été examinés. Un délai fini
  commence lorsque la réception attend pour la première fois et n'est pas
  relancé par les messages qui ne correspondent à aucune clause ; lorsqu'il
  expire, `Body` s'exécute à partir des liaisons antérieures à la réception et
  la réception suivante parcourt depuis le message le plus ancien. Un message
  arrivé avant l'expiration du délai est pris. Une réception avec seulement
  `after` est une mise en sommeil (l'idiome de `timer:sleep/1`).
- Code généré : une tête de boucle regarde le prochain message non examiné
  (`CLAUSE_receive_v1` `peek`, dans un emplacement racine), la sélection de
  clause prend un message reconnu (`take`) avant son corps ou saute un
  message non reconnu (`skip`) et boucle ; s'il ne reste aucun message, la
  boucle entre dans l'attente avec le délai, qui répond `true` (parcourir à
  nouveau) ou `false` (délai expiré : `restart`, puis le corps `after`).
- L'exécuteur garde une minuterie par processus en attente avec un délai
  fini : une minuterie expirée remet le processus dans la file, et lorsqu'aucun
  processus ne peut s'exécuter, l'exécuteur dort jusqu'à la minuterie la plus
  proche. Les délais sont mesurés sur une horloge monotone en millisecondes et
  ne se déclenchent jamais en avance.
- Lorsque chaque processus attend sans délai un message que rien ne peut
  envoyer, le programme attend indéfiniment, comme celui d'OTP. Une
  invocation par l'hôte (`CLAUSE_invoke_v1`) qui devrait attendre échoue
  plutôt avec `busy` : aucun autre processus ne s'exécute pendant celle-ci.

## Liens

Plan step 48. Un lien relie deux processus dans les deux sens (`Signals` dans
chaque contexte : les pids liés dans l'ordre des liens et l'indicateur
`trap_exit`).

- `link(Pid)` lie l'appelant à un processus vivant et renvoie `true` ; se lier
  à soi-même ou se lier à nouveau ne fait rien. Pour un processus terminé, il
  lève `error:noproc` ou, lorsque l'appelant piège les sorties, renvoie
  `true` et envoie à l'appelant `{'EXIT', Pid, noproc}`, comme le fait le
  `link/1` local d'OTP.
- `unlink(Pid)` supprime le lien des deux côtés ; le lien n'a plus d'effet
  après son retour. Renvoie `true` également lorsqu'il n'y avait pas de lien.
- `spawn_link/1,3` lient le nouveau processus à l'appelant avant qu'il ne
  s'exécute.
- Lorsqu'un processus se termine, chaque processus lié reçoit un signal de
  sortie avec sa raison de sortie ([sorties](#exits)) et le lien disparaît.
  Les processus liés reçoivent le signal dans l'ordre où les liens ont été
  créés.

## Moniteurs

Plan step 49. Un moniteur est unidirectionnel : le processus qui surveille le
détient (par référence, dans `Signals`) et le processus surveillé garde la
référence et le pid de l'observateur, afin de pouvoir envoyer le message
lorsqu'il se termine.

- `monitor(process, Pid)` renvoie une nouvelle référence. Lorsque le processus
  se termine, l'appelant reçoit `{'DOWN', Ref, process, Pid, Reason}` avec sa
  raison de sortie ([sorties](#exits)) ; pour un processus déjà terminé, il
  reçoit le message immédiatement avec la raison `noproc`. Se surveiller
  soi-même ne crée rien. Chaque appel crée un moniteur distinct avec son
  propre message ; les messages d'un même processus partent dans l'ordre où
  les moniteurs ont été créés.
- `demonitor(Ref)` arrête le moniteur : aucun `'DOWN'` de celui-ci n'arrive
  ensuite. Il renvoie `true`, y compris pour une référence qui n'est pas un
  moniteur actif de l'appelant.
- `demonitor(Ref, Options)` : `info` renvoie si le moniteur était encore
  actif ; `flush` retire le plus ancien message `{_, Ref, _, _, _}` lorsqu'il
  ne l'était pas (son `'DOWN'` est déjà dans la boîte aux lettres), comme le
  fait OTP.
- `spawn_monitor/1,3` renvoient `{Pid, Ref}`, le moniteur étant créé avant
  que le nouveau processus ne s'exécute.
- Un processus qui se termine abandonne les moniteurs qu'il détient.
- `monitor(process, Name)` et `monitor(process, {Name, nonode@nohost})`
  surveillent le processus enregistré sous `Name` (`noproc` immédiatement
  s'il n'y en a pas) ; son `'DOWN'` nomme `{Name, nonode@nohost}` au lieu du
  pid. `{Name, Node}` pour un autre nœud donne `badarg`.
- `monitor(port, Port | Name)` surveille un port
  ([ports](ports.md#port-table-and-ownership)) :
  `{'DOWN', Ref, port, Port, Reason}` lorsqu'il se ferme. Un pid pour `port`,
  ou un port pour `process`, donne `badarg`.

## Noms enregistrés

Plan step 50. L'exécuteur garde une table unique associant des noms (atomes)
à des pids, et chaque processus son propre nom (`Signals::name`).

- `register(Name, Pid)` nomme un processus vivant : `badarg` pour
  `undefined`, un nom déjà utilisé, un processus qui a déjà un nom, un
  processus terminé, ou un `Pid` qui n'est pas un pid. Un processus peut
  s'enregistrer lui-même.
- `unregister(Name)` libère le nom (`badarg` lorsqu'aucun processus ne le
  porte) ; `whereis(Name)` donne le pid ou `undefined` ; `registered()` liste
  les noms dans l'ordre de la table des atomes (l'ordre d'OTP n'est pas
  spécifié non plus).
- Le nom d'un processus est libéré au moment où il se termine, avant que ses
  liens et moniteurs ne reçoivent le signal, de sorte qu'un récepteur de
  `'DOWN'` ou `'EXIT'` peut enregistrer à nouveau le nom, comme dans OTP.

## Signaux de sortie

Tout signal de sortie provient d'un processus en cours d'exécution (`exit/2`,
`exit_signal/2`, `link/1`) ou de la fin d'un processus. L'exécuteur le traite
immédiatement lorsque sa cible ne s'exécute pas sur un autre worker, sinon une
fois la tranche de la cible terminée ([workers](#workers),
`scheduler/signals`) : une cible terminée quitte la file d'exécution ou son
attente et est finalisée (ses liens reçoivent le signal, son rapport d'erreur
est écrit, son contexte libéré) avant que le builtin émetteur ne retourne. Une
longue chaîne de liens se termine processus par processus, sans récursion.

| Signal reçu par un processus | Ne piège pas les sorties | Piège les sorties |
| --- | --- | --- |
| `exit(Pid, kill)`, `exit_signal(Pid, kill)` | Se termine avec la raison `killed` | Se termine avec la raison `killed` |
| Raison `normal` (depuis un lien, ou envoyée à un autre processus) | Rien | Message `{'EXIT', From, normal}` |
| `exit(self(), normal)` | Se termine avec la raison `normal` (bizarrerie d'OTP) | Message `{'EXIT', Self, normal}` |
| `exit_signal(self(), normal)` | Rien | Message `{'EXIT', Self, normal}` |
| Toute autre raison, y compris `kill` depuis un lien | Se termine avec cette raison | Message `{'EXIT', From, Reason}` |

- `process_flag(trap_exit, Bool)` active ou désactive le piégeage et renvoie
  le réglage précédent (initialement `false`).
- Un processus terminé par un signal qu'il s'est envoyé lui-même
  (`exit(self(), kill)`) se déroule au-delà de tout `catch`, gestionnaire
  `try` et corps `after` : le signal n'est pas une exception
  (`CallError::exited` dans le canal d'échec).
- `exit/2` et `exit_signal/2` renvoient `true` ; envers un processus terminé,
  ils ne font rien. Une destination de type référence ne fait rien non plus
  (il n'y a pas d'alias de processus).
- Un signal de sortie qui termine le processus principal termine le programme
  comme un `exit` non capturé ([code de sortie](executables.md#exit-status)) :
  la raison `normal` sort avec 0.
- Lorsque le tas du destinataire refuse une raison de sortie ou un message
  `'EXIT'`, le destinataire échoue comme un échec du runtime (code de
  sortie 70).

## Ports

Les ports (plan steps 57A–57F) sont spécifiés dans [ports](ports.md) : un
port est lié au processus qui l'a ouvert, participe aux liens, moniteurs,
signaux de sortie et noms enregistrés comme un processus, et communique avec
son processus connecté par des messages. Le step 57B fournit les identités,
la table des ports, les builtins de ports et les ports `{fd, In, Out}` en
sortie seule.

## Builtins

| Builtin | Comportement |
| --- | --- |
| `spawn(Fun)` | `badarg` sauf si `Fun` est un fun ; sinon un nouveau processus appelle `Fun()`, levant `{badarity, {Fun, []}}` dans ce processus pour une autre arité |
| `spawn(M, F, Args)` | `badarg` sauf si `M` et `F` sont des atomes et `Args` une liste propre ; sinon un nouveau processus appelle `M:F(Args...)`, levant `undef` dans ce processus lorsqu'aucun module ne l'exporte et qu'aucun builtin ne porte ce nom |
| `spawn_link(Fun)`, `spawn_link(M, F, Args)` | Comme `spawn`, et le nouveau processus est lié à l'appelant ([liens](#links)) |
| `is_process_alive(Pid)` | `badarg` sauf si `Pid` est un pid ; true tant que son processus ne s'est pas terminé |
| `spawn_monitor(Fun)`, `spawn_monitor(M, F, Args)` | Comme `spawn`, en renvoyant `{Pid, Ref}` d'un nouveau [moniteur](#monitors) |
| `link(Pid)`, `unlink(Pid)` | `badarg` sauf si `Pid` est un pid ([liens](#links)) |
| `monitor(process, Item)` | `badarg` pour un autre type ou élément ; une référence ([moniteurs](#monitors)) ; `Item` est un pid ou un nom enregistré |
| `register(Name, Pid)`, `unregister(Name)`, `whereis(Name)`, `registered()` | Voir [noms enregistrés](#registered-names) ; `Name` doit être un atome |
| `demonitor(Ref)`, `demonitor(Ref, Options)` | `badarg` sauf si `Ref` est une référence et `Options` une liste propre de `flush` et `info` |
| `exit(Dest, Reason)`, `exit_signal(Dest, Reason)` | `badarg` sauf si `Dest` est un pid ou une référence ; `true` après le [signal de sortie](#exit-signals) |
| `process_flag(trap_exit, Bool)` | Le réglage précédent ; `badarg` pour un autre indicateur ou une valeur non booléenne |
| `erlang:send(Dest, Msg)`, `Dest ! Msg` | `Msg`, après l'avoir envoyé ([messages](#messages)) ; `send/2` n'est pas auto-importé |

Le nouveau processus est mis en file derrière tous les processus exécutables ;
`spawn` renvoie immédiatement son pid.
