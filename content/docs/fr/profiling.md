---
source: docs/profiling.md
sourceCommit: 6ed3851c
sourceSha256: 0690ee91aab12c03c222bc79f4e862db1a91f1a621e36137ecfe1a97145f988a
translatedAt: 2026-10-15
---
# Profilage

`--profile FILE` (une [option du runtime](executables.md#runtime-options),
également via `CLAUSE_FLAGS`) fait écrire à un programme un rapport de coûts
dans `FILE` lorsqu'il se termine (backlog F31). Rien n'est recompilé : chaque
exécutable peut profiler et, sans l'option, il s'exécute, affiche et écrit des
fichiers exactement comme avant. Un rapport qui ne peut pas être écrit est
signalé sur stderr (`clau: cannot write profile FILE`) ; le code de sortie
reste celui du programme.

## Attribution

Le runtime attribue les coûts là où le contrôle passe d'un cadre à l'autre
([modèle d'exécution](execution-model.md)), sans aucune instrumentation dans
le code généré :

- **Entrées** (réductions) : chaque entrée dans une fonction Erlang par un
  appel ou un appel terminal compte un pour cette fonction, comme une tranche
  de temps compte les réductions.
- **Temps propre** : le temps d'horloge monotone d'un transfert (entrée,
  retour, début d'une tranche de temps) au suivant appartient à la fonction
  dont le cadre était au sommet. Les builtins et les services du runtime
  comptent comme du temps de la fonction qui les a appelés ; le temps pendant
  lequel un processus attend ou n'est pas ordonnancé ne compte pour personne.
  Le temps antérieur à la première entrée d'un processus est `(runtime)`.
- **Par processus** : chaque processus garde ses propres coûts ; ils sont
  ajoutés à ceux du programme lorsque le contexte du processus est détruit,
  avec son pid, ses totaux et sa fonction la plus coûteuse.

Chaque pile activée lit l'horloge à chaque transfert (environ 8 % plus lent
sur une boucle dense en appels en Debug) ; les piles désactivées paient un
branchement par transfert.

## Rapport

```text
Clause profile: 2 processes, 503 time slices, 0 timer clock readings
Functions by self time:
     time_us   share      entries  function
     1193261  100.0%      2000001  profile:spin/2
         204    0.0%            1  profile:main/1
         130    0.0%            1  profile:-main/1-fun-0-/1
           0    0.0%            1  profile:cold/1
Processes by time:
     time_us   share      entries  process: top function
     1193393  100.0%      2000002  <0.2.0>: profile:spin/2
         206    0.0%            2  <0.1.0>: profile:main/1
```

La première ligne compte aussi les tranches de temps exécutées par les workers
de l'ordonnanceur et les lectures d'horloge du thread de minuterie des délais
de `receive` ([roue de minuterie](processes.md#receive-timeouts)). Les
fonctions sont écrites `module:function/arity` (les funs anonymes par leurs
noms générés, dont l'arité compte les valeurs capturées) ; les égalités sont
triées par nom, les processus par temps puis par pid. Les temps sont en
microsecondes et varient d'une exécution à l'autre ; les entrées sont exactes.

## Tests

`linking_profiling` lie `tests/fixtures/linking/profile` en O0 et O2 et
l'exécute sans profilage, avec `--profile FILE` et avec
`CLAUSE_FLAGS=--profile=FILE` : la sortie est identique, `spin/2` arrive en
tête par temps propre avec exactement 2 000 001 entrées, le processus qui
tourne en boucle arrive en tête, et `--profile` sans fichier échoue avec le
code de sortie 70.
