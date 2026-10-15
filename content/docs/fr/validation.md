---
source: docs/validation.md
sourceCommit: 6ed3851c
sourceSha256: 908ac8c879d3df66cb4e8e52800e07da92013325c177e1556378cadd0597b50f
translatedAt: 2026-10-15
---
# Validation

## Référence actuelle

Plan 11 step 1, 2026-10-03, commit `b1a471f`, Windows x64 : clang-cl 23.1.2,
SDK LLVM 23.1.2 (`/MT`, `_ITERATOR_DEBUG_LEVEL=0`), Lizard 1.24.0, clang-tidy
22.1.8, version OTP épinglée `21776803ecd1` avec OTP oracle 29.1.1 / ERTS 17.1.

| Vérification | Résultat |
| --- | --- |
| CTest Debug combiné à neuf | 125/125, aucun test ignoré (729 s en série ; 85 s avec `-j 16`) |
| CTest en mode rapide (`debug-fast`) | 122 tests, environ 60 s |
| `check-quality` | Réussi ; Lizard CCN 10, clang-tidy sur 258 unités de production |
| Tests d'audit OTP optionnels | 14/14 |
| `regenerate.py --corpus all --check` | 19/19 corpus reproduits |
| Objets étrangers O0/O2 | 7 cibles inspectées (Linux x86/x64/ARM/AArch64, Windows x86/x64, Apple Silicon) |

## Exécuter la porte de validation

Depuis un shell développeur Visual Studio x64 avec `C:\Program Files\LLVM\bin`
dans le `PATH` (la sélection automatique du SDK réutilise `thirdparty/`) :

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files + dependents
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` exécute les corpus de référence en O0 positionnel plus
  en projet O2 sans spécialisation, exécute les mutations une seule fois et
  ignore les tests `full_only`. Le mode complet (par défaut) exécute toutes les
  combinaisons de pilote et de politique.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multiplie les limites par exécution de
  l'exécuteur de références (60 s) et de l'exécuteur de cas sémantiques (15 s)
  pour les builds instrumentés.
- `check-quality`, `make format` et `make-format.bat` couvrent les fichiers
  modifiés depuis `HEAD` ainsi que les fichiers non suivis ; `cmake/quality_scope.py`
  ajoute les unités de traduction qui incluent un en-tête modifié. Toute
  modification de `.clang-tidy`, de `cmake/` ou du CMake de production
  sélectionne l'ensemble.
- Les programmes de test ne portent aucune information de débogage (pas de
  PDB) ; configurer avec `-DCLAUSE_TEST_DEBUG_INFO=ON` pour les reconstruire en
  vue d'un débogueur. Les consommateurs natifs imbriqués lient le runtime du
  build parent via `ClauseRuntimeTargets.cmake` au lieu de le recompiler ; seul
  `runtime_link` construit le runtime de manière autonome.
- Les seuils et les suppressions ne sont jamais relevés pour franchir la porte.
  Deux exceptions tierces sont configurées (plan 11 steps 63-64, décision de
  l'utilisateur) : `cmake/tidy_filter.py` écarte les rapports de l'analyseur
  statique situés dans les en-têtes Boost (faux positifs de stockage des limbs
  de Boost.Multiprecision sous Linux, que réécrire le code appelant ne fait que
  déplacer) et les compte dans la sortie, et `bugprone-exception-escape` ignore
  `bad_array_new_length` (les constructeurs de déplacement de map/set de MSVC
  allouent ; un échec d'allocation est de toute façon fatal).
- clang-tidy vérifie les en-têtes du projet sur chaque hôte : le filtre
  d'en-têtes accepte les séparateurs `/` et `\` (les chemins Windows ne
  correspondaient jamais avant le step 63).

### Linux

La même porte s'exécute sous Linux avec le SDK LLVM 23.1.2 pour Linux épinglé
comme compilateur hôte (`CC`/`CXX` depuis son `bin/`), la libstdc++ du système,
Ninja et CMake 3.28 ou plus récent. Boost 1.90 et toml++ 3.4.0 proviennent de
paquets installés ou sont extraits dans `thirdparty/` (`boost_1_90_0/`,
`tomlplusplus-3.4.0/`) ; seul Windows les télécharge. Le `ld.lld` de l'archive
de release est lié à ICU 70 (Ubuntu 22.04) et son `lldb` à Python 3.14 ; sur
les hôtes qui ne les ont pas, `linking_lto` a besoin d'ICU 70 dans
`LD_LIBRARY_PATH`, et `linking_debugger` utilise GDB.

```sh
cmake --preset debug --fresh -G Ninja -DBUILD_TESTING=ON
cmake --build build/debug
ctest --preset debug -j 16
```

`check-quality` (Lizard, clang-tidy) ne s'exécute que sur l'hôte de
développement Windows ; les autres hôtes compilent et exécutent les tests. Le
step 63 l'a exécuté une fois sous Linux, ce qui a trouvé ce que l'exécution
Windows ne pouvait pas voir (sources uniquement POSIX, `std::optional` de
libstdc++), et l'a laissé propre.

### Autres cibles

Les cibles 32 bits et ARM sont vérifiées sans compilateur construit pour elles
(aucun SDK LLVM n'existe pour ces hôtes) :

- Un build du runtime seul (`-DCLAUSE_BUILD_COMPILER=OFF -DBUILD_TESTING=ON`)
  pour la cible y exécute les tests du runtime et de l'ABI : nativement, dans
  un espace utilisateur de la cible (chroot), ou via l'émulateur de l'hôte
  (qemu binfmt).
- `tests/compiler/executables/cross.py` exécute chaque référence d'exécutable
  et chaque fixture de programme avec le `clau` de cet hôte,
  `--target-triple`, l'archive du runtime de ce build et un `--linker` qui
  atteint les bibliothèques de la cible (`run.py --target-option` les
  transmet).

## Fixtures et provenance

- Les builds et les tests normaux n'ont besoin ni d'OTP ni de son dépôt source.
  Les résultats de référence (goldens) ont été générés une fois à partir d'OTP et
  sont versionnés avec leurs empreintes ; les vérifications d'empreinte
  s'exécutent avant toute utilisation d'une fixture.
- Dix-neuf corpus de motifs et de guards contiennent 67 748 valeurs ou erreurs
  natives attendues et 106 lignes d'acceptation sémantique. Chaque corpus natif
  exécute les pilotes positionnel et projet en O0/O2, avec et sans
  spécialisation, en appels locaux et distants.
- Les entrées Erlang versionnées sont écrites localement
  (`tests/fixtures/patternmatch/fragments/`, préprocesseur `semantic/headers/`).
  Un audit du 2026-10-03 a supprimé tous les fichiers OTP copiés ; une
  comparaison par fenêtres de 60 jetons avec 4 150 fichiers Erlang et
  1 190 fichiers C/C++ d'OTP n'a trouvé aucun recouvrement restant hormis un
  tuple d'entiers généré. `fixture_sources` impose cette isolation.
- Six fixtures de programmes cibles (`tests/fixtures/programs/`) contiennent les références OTP de sortie standard et de code de
  sortie ainsi que les diagnostics de compilation actuels ; `programs_compile`
  les vérifie sans OTP et `tests/compiler/programs/regenerate.py --check` les
  reproduit sous OTP ([carte des fixtures](../tests/fixtures/programs/README.md)).
- Les références d'affichage des termes (`tests/fixtures/printing/`)
  contiennent le texte OTP de `~w` et de `erlang:display/1` pour
  9 542 valeurs ainsi que la sortie standard OTP des appels d'affichage
  compilés ; `tests/compiler/printing/regenerate.py --check` les reproduit
  ([notes sur les fixtures](../tests/fixtures/printing/README.md)).
- Les cas de référence des exécutables (`tests/fixtures/executables/`) sont
  des répertoires source accompagnés d'un `golden.json` contenant
  la sortie standard et le code de sortie OTP ainsi qu'un motif de sortie
  d'erreur rédigé à la main ; `tests/compiler/executables/run.py` lie et exécute
  chaque cas selon la matrice politique/pilote (CTest `executables_<case>`), et
  `regenerate.py --check` les reproduit sous OTP
  ([notes sur les cas](../tests/fixtures/executables/README.md)).
- La régénération et les audits en direct sont explicites :
  `-DCLAUSE_OTP_AUDITS=ON` et `tests/compiler/patternmatch/regenerate.py`
  ([instructions](../tests/fixtures/patternmatch/generated/README.md)).
  Rien ne rafraîchit silencieusement les références ni la version épinglée.

## Conception des tests

Le comportement est testé via la vraie CLI, les objets émis, des consommateurs
natifs liés et les références OTP. Des tests unitaires ciblés ne subsistent que
là où le code source ne peut pas atteindre l'état voulu, chacun avec son objectif
indiqué dans le test :

- Budgets injectés et défaillances d'allocation ou d'E/S (`project_limits`,
  `project_creation_failure`, `codegen_limits`, `codegen_write_failure`,
  `runtime_lifecycle_failure`, points d'injection de défaillances des appels
  générés).
- Invariants de propriété privée, de handles invalides ou périmés et
  d'annulation dans l'analyseur syntaxique, le graphe de types sémantique et le
  backend.
- Validation des mots bruts et limites des termes 32/64 bits
  (`runtime_immediate`, `runtime_term_tag`, `abi_integers`).
- Défaillances du récepteur de diagnostics et instantané des identifiants de
  fonctionnalités stables.

Les cas liés aux capacités du système de fichiers (liens, alias de casse)
signalent des tests ignorés au cas par cas ; ils ne remplacent jamais la
réussite d'un test complet.

## État des plateformes et des sanitizers

- Exécution native du code généré : Windows x64 ; Linux x86-64. Les résultats
  32 bits et ARM figurent dans l'historique.
- Apple Silicon : en attente.
- ASan, UBSan et LeakSanitizer pour le compilateur et le runtime : Linux
  x86-64, une configuration Debug combinée
  (`-fsanitize=address,undefined -fno-sanitize=vptr -fno-sanitize-recover=undefined`),
  CTest complet avec `CLAUSE_TEST_TIMEOUT_SCALE=10` (le code instrumenté
  s'exécute plusieurs fois plus lentement) : aucun rapport de sanitizer. Le
  compilateur, le runtime et les programmes de test sont instrumentés ; les
  programmes que `clau` lie prennent le runtime du sanitizer d'un wrapper
  `clang++` dans le `PATH`, leur code généré n'est pas instrumenté. Les quatre
  tests de refus de l'hôte injectés (`codegen_failure_*`,
  `runtime_lifecycle_failure`, `runtime_memory`) sont hors du périmètre d'ASan :
  son `operator new` abandonne sur une taille impossible au lieu de lever une
  exception.
- ThreadSanitizer : Linux x86-64, le même périmètre d'instrumentation avec
  `-fsanitize=thread` ; le CTest complet et les tests de concurrence, cinq fois
  chacun, ne signalent aucune course après la correction de l'ordre des verrous
  de `Executor::clear`. Également hors périmètre : les deux tests qui
  remplacent `operator new`.
- Sous Windows, le SDK LLVM précompilé entre toujours en conflit avec le code
  instrumenté (`annotate_string` 0 contre 1).
- ASan limité au runtime réussit sous Windows avec des sondes Release,
  `/EHsc /fsanitize=address`, `/MT`, la bibliothèque d'importation ASan de Clang
  et le thunk du runtime statique, et la DLL ASan dans le `PATH`.
- Des exécutions historiques sur macOS arm64 (2026-09-19/20) ont réussi les
  builds Debug complet, C++26, ASan+UBSan, compilateur seul et runtime seul pour
  les étapes de l'analyseur syntaxique et des projets ; elles sont antérieures
  au backend.

## Benchmarks

Comparaison manuelle des performances avec Erlang/OTP. Elle ne fait jamais
partie de CTest, de la porte de commit ni de `check-quality`, et elle seule a
besoin d'un Erlang/OTP sur l'hôte ; les résultats sont des éléments propres à
l'hôte, pas des résultats de la porte.

```powershell
make-benchmark.bat                         # Windows; set JOBS=N to cap parallel builds
make-benchmark.bat --repeat 9 --only bench_gc,bench_msg
make benchmark BENCH_ARGS="--baseline HEAD~5"   # other hosts
```

- Les deux configurent et compilent un `clau` et un runtime Release dans
  `build/bench`, puis lancent `benchmarks/run.py` (`--help` liste ses options).
- Programmes : `benchmarks/bench_*.erl` avec `bench_util.erl`, compilés sans
  modification par `erlc` et `clau -O2`. Chacun chronomètre ses noyaux avec
  `erlang:monotonic_time/1` après un appel de mise en température et affiche
  `BENCH <name> <nanoseconds>` : génération de données, traitement de données,
  ramassage des miettes, passage de messages, E/S de fichiers (dans un
  répertoire de travail temporaire vide) et sockets en boucle locale.
- Systèmes, sur le même hôte en une seule exécution, entrelacés : OTP avec sa
  variante par défaut (JIT), OTP `-emu_flavor emu` lorsqu'il est installé
  (l'installateur Windows ne fournit que le JIT, donc ces colonnes affichent
  `n/a`), Clause HEAD en O2 et avec `--lto`, et un commit précédent de Clause
  (par défaut : le commit le plus récent ayant au moins un jour de plus que
  HEAD ; `--baseline REV`, `--no-baseline`) compilé dans un worktree en cache
  sous `build/bench-base/<hash>` qui partage `thirdparty/`.
- Rapport : par noyau, la médiane de `--repeat` exécutions (5 par défaut) en
  millisecondes avec six décimales et sa dispersion, la variation de Clause O2
  par rapport à chaque système (`+N%` : Clause est plus rapide, l'autre prend
  N % de plus ; `-N%` : Clause prend N % de plus ; `(Fx)` le rapport des
  temps) avec une moyenne géométrique, `--lto` par rapport à OTP et à O2, les
  temps réels des programmes démarrage compris, les échecs et les délais
  dépassés (`--timeout`, 600 s par exécution). Les nombres d'itérations
  maintiennent une exécution par défaut sous 10 minutes ; Clause, le système
  le plus lent, fixe les tailles, donc certains noyaux OTP ne durent que
  quelques millisecondes.
- Historique : `benchmarks/history/<host>.json` garde un enregistrement par
  jour d'exécution (date d'exécution, hash et date de commit de HEAD, médianes
  de Clause, d'OTP et de la référence),
  `benchmarks/history/reports/<host>/<day>-<hash>.txt` les rapports texte ;
  une nouvelle exécution le même jour remplace les deux. Les enregistrements
  et rapports exécutés plus de 183 jours avant le plus récent sont élagués ;
  une exécution avec des modifications de source non commitées est rapportée
  mais pas enregistrée. Le répertoire d'historique est ignoré par git : il
  reste sur l'hôte qui l'a exécuté.
- Listings : avec `--listings`, avant de mesurer, une exécution écrit les
  listings [`--print-asm`](compile.md#assembly-listings) et `--print-ir` de
  chaque programme (avec `bench_util`, `--entry <program>` afin que le code de
  bibliothèque inaccessible soit laissé de côté comme dans l'exécutable) à
  côté des rapports sous les noms `<program>.debug.asm` / `<program>.debug.ll`
  (`-O0`) et `<program>.release.asm` / `<program>.release.ll` (`-O2`, le code
  qu'exécute la colonne `clause-o2`), en remplaçant les listings de
  l'exécution précédente, `--no-history` et modifications non commitées
  compris. `--print-ir` est l'IR avant le pipeline LLVM ; les commentaires de
  l'assembleur citent l'IR après celui-ci. Un programme qui ne compile pas
  perd ses listings périmés.

## Historique

Condensé à partir des anciens comptes rendus par étape (originaux dans
l'historique Git jusqu'au commit `2777c98`). Sauf mention contraire : Windows
x64, LLVM 23.1.2, version épinglée `21776803ecd1`, OTP oracle 29.1.1 /
ERTS 17.1. Les nombres de tests correspondent à des passes CTest complètes sans
aucun test ignoré.

| Date | Jalon | Tests | Unités de qualité | Notes |
| --- | --- | ---: | ---: | --- |
| 2026-09-19 | Analyseur syntaxique phase VI (macOS arm64, OTP 29.1 `751f87b7`, oracle 29.0.5) | 46 | toutes | 344/344 productions observées ; corpus de 10 fichiers |
| 2026-09-20 | Projets (macOS arm64) | 64 | toutes | Debug, compilateur seul, ASan+UBSan |
| 2026-09-28 | Migration des tests vers des flux CLI | 74/75 | — | Référence 78/93 ; dépassement de pile de `parser_hardening` corrigé plus tard avec une pile de 8 Mio |
| 2026-09-28 | Réparation de la porte Windows | 75 | toutes | Lizard + clang-tidy sans avertissement |
| 2026-09-29 | Jalon du compilateur, steps 1–46 | 103 | 182 | Compilateur seul 80, runtime seul 16, ASan runtime 16 |
| 2026-10-01 | PG1 matrice sémantique et preuves | 104 | — | Empreintes des sources épinglées |
| 2026-10-01 | PG2 canal d'échec | 108 | — | ABI rév. 2 |
| 2026-10-01 | PG3 atomes | 109 | 189 | ABI rév. 3 |
| 2026-10-01 | PG4 liaisons à portée | 111 | 191 | 26 cas de légalité |
| 2026-10-02 | PG5 sémantique des motifs | 113 | 196 | 92 modules de légalité |
| 2026-10-02 | PG6 correspondance immédiate | 114 | 199 | 34 appels |
| 2026-10-02 | PG7 guards immédiats | 119 | 205 | 1 689 appels |
| 2026-10-02 | PG8 flot de contrôle des guards | 120 | 207 | 2 075 appels |
| 2026-10-02 | PG9 clauses ordonnées | 121 | 208 | 1 020 appels |
| 2026-10-02 | PG10 correspondances dans le corps | 122 | 209 | 1 666 appels |
| 2026-10-02 | PG11 tas stable et racines | 123 | 213 | ABI rév. 4 |
| 2026-10-02 | PG12 tuples/listes/chaînes | 125 | 221 | 4 801 appels |
| 2026-10-02 | PG13 entiers arbitraires | 127 | 231 | 16 065 appels |
| 2026-10-02 | PG14 flottants | 129 | 238 | 14 436 appels |
| 2026-10-02 | PG15 maps | 131 | 244 | 8 010 appels |
| 2026-10-02 | PG15a références sans OTP | 118 | 244 | 14 corpus, 49 959 valeurs ; audits optionnels |
| 2026-10-02 | PG16 bitstrings | 120 | 253 | 8 826 appels |
| 2026-10-03 | PG17 records sous forme de tuples | 121 | 257 | 1 025 résultats, 29 cas sémantiques |
| 2026-10-03 | PG18 catalogue des guards | 122 | 257 | 81 lignes, 5 033 résultats |
| 2026-10-03 | PG19 faits de liaison | 123 | 258 | 822 résultats, 976 vérifications de dominance |
| 2026-10-03 | PG20 clôture | 124 | 258 | 19 corpus, 67 634 valeurs, 1 969 résultats semés |
| 2026-10-03 | Audit des sources OTP | 125 | 258 | Fichiers OTP copiés remplacés par des fragments locaux |
| 2026-10-03 | Plan 11 step 1, référence | 125 | 258 | Voir la référence actuelle |
| 2026-10-03 | Plan 11 step 2, fixtures de programmes | 126 | 258 | Six références OTP ; mode rapide 123 tests ; complet `-j 16` 83 s |
| 2026-10-03 | Plan 11 step 4, affichage des termes | 128 rapide | 265 | 9 542 références `~w`/display ; 154 appels d'affichage compilés dans toutes les politiques ; clang-tidy exécuté avec un seul job (les exécutions concurrentes faisaient planter l'outil sur des unités inchangées) |
| 2026-10-04 | Plan 11 step 8, exécuteur d'exécutables (phase B close) | 138 (135 rapide) | 272 | Cas `demo`, `exits` sous huit combinaisons politique/pilote ; complet `-j 16` 235 s |
| 2026-10-04 | Plan 11 step 8I, tas classique (phase C close) | 144 (140 rapide) | 276 | Complet `-j 16` 370 s : 143/144, `codegen_dependency` a expiré à 120 s sous charge et a réussi seul en 29 s ; Lizard-all 0 avertissement ; tidy-all réussi avec un job après une sortie silencieuse de l'outil à deux jobs |
| 2026-10-04 | Plan 11 step 9, `case` et `begin` | 146 (142 rapide) | 114 modifiées | Rapide 142/142 ; tests concernés 7/7 en mode complet ; Lizard 0 avertissement ; tidy réussi avec un job après une sortie silencieuse à deux jobs |
| 2026-10-05 | Plan 11 step 10, `if` | 147 (143 rapide) | 114 modifiées | Rapide 143/143 ; tests concernés 8/8 en mode complet ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 11, levées d'exceptions dans le source | 148 (144 rapide) | 124 modifiées | Rapide 144/144 ; tests concernés 22/22 en mode complet ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 12, `catch Expr` | 149 (145 rapide) | 277 | Rapide 145/145 ; tests concernés 25/25 en mode complet ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 13, `try ... of ... catch` | 150 (146 rapide) | 189 modifiées | Rapide 146/146 ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 14, `try ... after` | 153 (149 rapide) | 2 modifiées | Rapide 149/149 ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 15, traces de pile et `raise/3` | 154 (150 rapide) | 129 modifiées | Rapide 150/150 ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 16, `maybe` (phase D close) | 155 (151 rapide) | 277 | Rapide 151/151 ; complet `-j 16` 155/155 en 259 s ; Lizard-all 0 avertissement ; tidy-all réussi |
| 2026-10-05 | Plan 11 step 18, graphes d'appels récursifs | 156 (152 rapide) | 91 modifiées | Rapide 152/152 ; tests concernés 13/13 en mode complet ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 19, cadres explicites et appels terminaux | 157 (153 rapide) | 278 | CTest rapide et complet réussis (avec le cas du step 20 : 154/154, 158/158) ; configuration clang-cl ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-05 | Plan 11 step 20, récursion profonde dans le corps et budget de pile | 158 (154 rapide) | 278 | Rapide 154/154 ; complet 158/158 ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 21, compréhensions de listes | 159 (155 rapide) | modifiées | Rapide 155/155 ; tests concernés en mode complet ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 22, compréhensions de binaries et de maps (phase E close) | 160 (156 rapide) | toutes | Rapide 156/156 ; complet `-j 12` 160/160 en 275 s ; Lizard-all 0 avertissement ; tidy-all réussi après correction de quatre signalements dans du nouveau code |
| 2026-10-06 | Plan 11 step 23, inventaire des racines, `SafePoint`, registres vivants | 160 (156 rapide) | 50 modifiées | Rapide 156/156 ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 26, collecte depuis le code généré | 161 (157 rapide) | 63 modifiées | Rapide 157/157 ; complet `-j 12` 161/161 en 107 s ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 27, épuisement du tas après collecte | 162 (158 rapide) | 50 modifiées | Rapide 158/158 ; complet `-j 12` 162/162 en 108 s ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 27, correction : pas de plafond mémoire par défaut | 162 (158 rapide) | 50 modifiées | Complet `-j 12` 158/162 en 120 s, 4 `codegen_failure_*` corrigés en attendant `out_of_memory`, puis 10/10 concernés ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 27, suite : pas de plafond sur les binaries ni sur le nombre de processus, `--max-atoms` | 164 (160 rapide) | 281 | Rapide 160/160 ; complet `-j 12` 164/164 en 105 s ; Lizard 0 avertissement ; tidy-all réussi |
| 2026-10-06 | Plan 11 step 28, copies de graphes entre tas, tampons hors tas partagés | 166 (162 rapide) | 71 modifiées | Rapide 162/162 ; complet `-j 12` 166/166 en 130 s ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-07 | Plan 11 step 29, mises à jour de records | 167 (163 rapide) | 38 modifiées | Rapide 163/163 ; Lizard 0 avertissement ; tidy réussi ; le corpus des records se reproduit sous OTP |
| 2026-10-07 | Plan 11 step 30, `record_info/2` | 168 (164 rapide) | 42 modifiées | Rapide 164/164 ; complet `-j 12` 168/168 en 119 s ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-07 | Plan 11 step 31B, cellules de native records et `CLAUSE_record_v1` (ABI 6) | 169 (165 rapide) | 283 modifiées | Rapide 165/165 ; complet `-j 12` 169/169 en 122 s ; Lizard 0 avertissement ; tidy réussi après deux corrections |
| 2026-10-07 | Plan 11 step 31C, native records locaux | 170 (166 rapide) | 285 modifiées | Rapide 166/166 ; complet `-j 12` 170/170 en 146 s ; Lizard et tidy réussis après corrections de complexité |
| 2026-10-07 | Plan 11 step 31D, native records qualifiés et importés | 171 (167 rapide) | 124 modifiées | Rapide 167/167 ; complet `-j 12` 171/171 en 129 s ; Lizard 0 avertissement ; tidy réussi après trois corrections |
| 2026-10-07 | Plan 11 step 31E, native records anonymes (step 31 clos) | 172 (168 rapide) | 33 modifiées | Rapide 168/168 ; complet `-j 12` 172/172 en 124 s ; Lizard 0 avertissement ; tidy réussi après une correction |
| 2026-10-07 | Plan 11 step 32, valeurs fonctionnelles `fun F/A`, `fun M:F/A` (ABI 7) | 173 (169 rapide) | 289 modifiées | Rapide 169/169 ; complet `-j 12` 173/173 en 122 s ; Lizard et tidy réussis après corrections de complexité |
| 2026-10-07 | Plan 11 step 33, fermetures avec variables capturées | 175 (171 rapide) | 134 modifiées | Rapide 171/171 ; complet `-j 12` 175/175 en 126 s ; Lizard et tidy réussis après corrections de complexité |
| 2026-10-07 | Plan 11 step 34, funs nommées | 176 (172 rapide) | 132 modifiées | Rapide 172/172 ; complet `-j 12` 176/176 en 152 s ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-07 | Plan 11 step 35, appels dynamiques `M:F(Args)`, `apply/2,3`, `fun M:F/A` au runtime (ABI 8) | 177 (173 rapide) | 290 (configuration de l'analyseur modifiée) | Rapide 173/173 ; complet `-j 12` 177/177 en 142 s ; Lizard 0 avertissement et tidy réussi après une correction de complexité et trois corrections tidy |
| 2026-10-09 | Plan 11 step 63, Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, clang du SDK LLVM 23.1.2, libstdc++ 14, GDB 16.2) | 235 | 338 | CTest complet 235/235 en 161 s ; Lizard et clang-tidy propres (7 rapports de l'analyseur dans les en-têtes Boost ignorés) ; porte Windows 235/235 avec les en-têtes vérifiés |
| 2026-10-09 | Plan 11 step 64, 32 bits : Windows x86 (WoW64, clang-cl) et Linux i386 (chroot Debian 13, clang 19) | 42 + 65 références | — | Tests runtime/ABI 42/42 nativement sur les deux ; références `cross.py` 65/65 sur les deux (exécutions `integer_limit` réservées au 64 bits ignorées) |
| 2026-10-09 | Plan 11 step 65, Linux arm64 et armhf (sysroots Debian 13, qemu-user 9.2) | 42 + 65 références | — | Tests runtime/ABI 42/42 chacun ; références 64/65 chacun (`port_spawn` `enoent` : lacune de `posix_spawn` dans qemu), limite d'exécution 900 s |
| 2026-10-10 | Plan 11 step 67, ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Aucun rapport de sanitizer ; quatre tests de refus de l'hôte injectés hors du périmètre d'ASan ; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Plan 11 step 68, ThreadSanitizer (Linux x86-64) | 233 | — | Une inversion d'ordre des verrous corrigée (`Executor::clear`) ; ensuite aucun rapport dans le CTest complet ni dans 15 tests de concurrence x5 |
| 2026-10-10 | Plan 11 step 65A, `-behaviour`/`-behavior` et `behaviour_info/1` généré | 234 (rapide) | 342 | Configuration fraîche ; rapide 234/234 ; Lizard 0 avertissement ; tidy réussi après une correction (initialisation statique pouvant lever) ; nouveaux `lint_diagnostics` (8 cas générés par OTP) et `executables_behaviours` ; `--check` d'OTP reproduit 60 références d'exécutables et 8 de lint ; références de programmes régénérées uniquement pour l'empreinte modifiée de l'oracle |
| 2026-10-10 | Plan 11 step 65B, `module_info/0,1` et attributs informatifs | 235 (rapide) | 344 | Configuration fraîche ; rapide 235/235 ; Lizard 0 avertissement ; tidy réussi après la séparation de `parse_and_print` ; les nouveaux `executables_module_info` et cas de lint `module_info_defined`, `exports_repeated` se reproduisent sous OTP 29.1.1 |
| 2026-10-10 | Plan 11 step 65C, imports, indications de compilation, rejets d'attributs nommés | 236 (rapide) | — | Voir les éléments du plan 65C ; `executables_imports` et trois cas de lint d'import se reproduisent sous OTP 29.1.1 |
| 2026-10-06 | Plan 11 step 27E, limite ERTS des grands entiers, `error:system_limit` | 165 (161 rapide) | 157 modifiées | Rapide 161/161 ; complet `-j 12` 165/165 en 130 s ; Lizard 0 avertissement ; tidy réussi ; 21 références d'exécutables se reproduisent sous OTP |
| 2026-10-06 | Plan 11 step 27D, pas de plafond sur la taille des maps ni sur le travail des clés | 164 (160 rapide) | 13 modifiées | Rapide 160/160 ; complet `-j 12` 164/164 en 115 s ; après une correction tidy dans `bit_order`, 35 tests concernés réussissent ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 27C, limite d'arité des tuples 16 777 215 | 164 (160 rapide) | 51 modifiées | Rapide 160/160 ; complet `-j 12` 164/164 en 121 s ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 27B, pas de plafond sur la longueur des listes ni sur le travail de comparaison | 164 (160 rapide) | 4 modifiées | Rapide 160/160 ; complet `-j 12` 164/164 en 125 s ; Lizard 0 avertissement ; tidy réussi |
| 2026-10-06 | Plan 11 step 27A, limite mémoire globale du runtime et `--max-heap/stack/memory` | 164 (160 rapide) | 49 modifiées | Rapide 160/160 ; complet `-j 12` 164/164 en 118 s ; après une correction tidy dans `ProcessStack::grow`, 42 tests concernés réussissent ; Lizard 0 avertissement ; tidy réussi |

PG = étape du plan motifs/guards (archivé dans `.agents/00-finished.md`).
