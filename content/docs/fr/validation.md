---
source: docs/validation.md
sourceCommit: 336caea7
sourceSha256: b00092bc767953e496774561feaef35ac500b4db73b4344eafd6dda372c90e24
translatedAt: 2026-10-18
---
# Validation

## Référence actuelle

Dernières portes de validation enregistrées sur l'hôte de développement
Windows x64 (clang-cl et SDK LLVM 23.1.2, `/MT`, `_ITERATOR_DEBUG_LEVEL=0`) ;
les étapes suivantes enregistrent les leurs dans `.agents/00-finished.md` :

| Vérification | Résultat |
| --- | --- |
| CTest Debug combiné à neuf (2026-10-14) | 299/300 réussis ; l'échec est la borne connue de taille d'IR de `codegen_measurements` ; `codegen_resource_cli` est désactivé |
| `check-quality-all` (même exécution) | Propre ; Lizard CCN 10 |
| Tests d'audit OTP optionnels (2026-10-14, version épinglée `d199a49a01a2`, OTP oracle 29.1.1) | 17/17 |
| `regenerate.py --corpus all --check` (idem) | 19/19 corpus reproduits |

## Exécuter la porte de validation

Depuis un shell développeur Visual Studio x64 avec `C:\Program Files\LLVM\bin`
dans le `PATH` (la sélection automatique du SDK réutilise `thirdparty/`) :

```powershell
cmake --preset debug --fresh -DBUILD_TESTING=ON -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl
cmake --build build/debug
ctest --preset debug-fast                  # during development
ctest --preset debug -j 16                 # full mode, at feature completion
cmake --build build/debug --target check-quality      # changed files, one unit per header
cmake --build build/debug --target check-quality-all  # whole tree
```

- `CLAUSE_TEST_MODE=fast` exécute les corpus de référence en O0 positionnel plus
  en projet O2 sans spécialisation, exécute les mutations une seule fois et
  ignore les tests `full_only` (projets consommateurs séparés tels que
  `runtime_generated_link`, les mesures, l'audit `library_freshness` de l'OTP
  de l'hôte, et les flux lents `linking_lto`, `linking_exports`,
  `linking_compile_cache`, `programs_compile` et `transforms_cache`). Le mode complet (par défaut) exécute toutes les combinaisons de
  pilote et de politique.
- Les tests longs pilotés par un script Python ou CMake portent un `COST` CTest
  fixe : CTest apprend le coût d'un wrapper à partir de son propre temps CPU,
  faible, et les lancerait en dernier.
- `CLAUSE_TEST_TIMEOUT_SCALE=N` multiplie les limites par exécution de
  l'exécuteur de références (60 s) et de l'exécuteur de cas sémantiques (15 s)
  pour les builds instrumentés.
- `check-quality`, `make format` et `make-format.bat` couvrent les fichiers
  modifiés depuis `HEAD` ainsi que les fichiers non suivis ;
  `cmake/quality_scope.py` ajoute, pour chaque en-tête modifié, une unité de
  traduction qui l'inclut (son propre source, sinon son premier utilisateur,
  d'après les données de dépendances de Ninja de n'importe quelle
  configuration ; les autres dépendants de l'en-tête sont laissés à
  `check-quality-all` lors de la vérification complète) et, pour clang-tidy, les unités dont la commande de
  compilation diffère de celle enregistrée par la dernière exécution réussie
  (`build/debug/quality/tidy-commands.json`), de sorte qu'une modification
  d'une règle de build ne revérifie que les unités qu'elle change. Les
  modifications de `.clang-tidy` ou des scripts tidy sélectionnent l'ensemble,
  tout comme les modifications de règles de build avant la première exécution
  enregistrée.
- `CLAUSE_OPTIMIZED_COMPILER` (ON par défaut) compile `clau` et les
  bibliothèques du compilateur avec optimisation également dans les builds
  Debug, en conservant leurs informations de débogage et les budgets
  d'inférence Debug ; les tests passent la plupart de leur temps dans `clau`.
  Lorsqu'un plantage du compilateur doit être suivi pas à pas, configurer avec
  `-DCLAUSE_OPTIMIZED_COMPILER=OFF`, recompiler et relancer le test en échec.
- Les programmes de test ne portent aucune information de débogage (pas de
  PDB) ; configurer avec `-DCLAUSE_TEST_DEBUG_INFO=ON` pour les reconstruire en
  vue d'un débogueur. Les consommateurs natifs imbriqués lient le runtime du
  build parent via `ClauseRuntimeTargets.cmake` au lieu de le recompiler ; seul
  `runtime_link` construit le runtime de manière autonome.
- Les seuils et les suppressions ne sont jamais relevés pour franchir la porte.
  Deux exceptions tierces sont configurées (décision de l'utilisateur) :
  `cmake/tidy_filter.py` écarte les rapports de l'analyseur statique situés
  dans les en-têtes Boost (faux positifs de stockage des limbs de
  Boost.Multiprecision sous Linux, que réécrire le code appelant ne fait que
  déplacer) et les compte dans la sortie, et `bugprone-exception-escape` ignore
  `bad_array_new_length` (les constructeurs de déplacement de map/set de MSVC
  allouent ; un échec d'allocation est de toute façon fatal).
- clang-tidy vérifie les en-têtes du projet sur chaque hôte : le filtre
  d'en-têtes accepte les séparateurs `/` et `\`.

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
développement Windows ; les autres hôtes compilent et exécutent les tests (il a
été propre une fois sous Linux, voir l'[historique](#history)).

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
  Les résultats de référence (goldens) ont été générés une fois à partir d'OTP
  et sont versionnés avec leurs empreintes ; les vérifications d'empreinte
  s'exécutent avant toute utilisation d'une fixture.
- Dix-neuf corpus de motifs et de guards contiennent 67 748 valeurs ou erreurs
  natives attendues et 106 lignes d'acceptation sémantique. Chaque corpus natif
  exécute les pilotes positionnel et projet en O0/O2, avec et sans
  spécialisation, en appels locaux et distants.
- Les entrées Erlang versionnées sont écrites localement
  (`tests/fixtures/patternmatch/fragments/`, préprocesseur `semantic/headers/`) ;
  `fixture_sources` impose leur isolation vis-à-vis des sources d'OTP.
- Six fixtures de programmes cibles (`tests/fixtures/programs/`) contiennent
  les références OTP de sortie standard et de code de sortie ainsi que leurs
  diagnostics de compilation ; `programs_compile` les vérifie sans OTP et
  `tests/compiler/programs/regenerate.py --check` les reproduit sous OTP
  ([carte des fixtures](../tests/fixtures/programs/README.md)).
- Les références d'affichage des termes (`tests/fixtures/printing/`)
  contiennent le texte OTP de `~w` et de `erlang:display/1` pour
  9 542 valeurs ainsi que la sortie standard OTP des appels d'affichage
  compilés ; `tests/compiler/printing/regenerate.py --check` les reproduit
  ([notes sur les fixtures](../tests/fixtures/printing/README.md)).
- Les cas de référence des exécutables (`tests/fixtures/executables/`) sont
  des répertoires source accompagnés d'un `golden.json` contenant la sortie
  standard et le code de sortie OTP ainsi qu'un motif de sortie d'erreur rédigé
  à la main ; `tests/compiler/executables/run.py` lie et exécute chaque cas
  selon la matrice politique/pilote (CTest `executables_<case>`), et
  `regenerate.py --check` les reproduit sous OTP
  ([notes sur les cas](../tests/fixtures/executables/README.md)).
- La régénération et les audits en direct sont explicites :
  `-DCLAUSE_OTP_AUDITS=ON` et `tests/compiler/patternmatch/regenerate.py`
  ([instructions](../tests/fixtures/patternmatch/generated/README.md)). Rien ne
  rafraîchit silencieusement les références ni la version épinglée.

## Conception des tests

Le comportement est testé via la vraie CLI, les objets émis, des consommateurs
natifs liés et les références OTP. Des tests unitaires ciblés ne subsistent que
là où le code source ne peut pas atteindre l'état voulu, chacun avec son
objectif indiqué dans le test :

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
  32 bits et ARM (tests du runtime et références liées en croisé) figurent dans
  l'historique.
- Apple Silicon : non validé depuis l'existence du backend.
- ASan, UBSan et LeakSanitizer pour le compilateur et le runtime : Linux
  x86-64, une configuration Debug combinée
  (`-fsanitize=address,undefined -fno-sanitize=vptr -fno-sanitize-recover=undefined`),
  CTest complet avec `CLAUSE_TEST_TIMEOUT_SCALE=10` (le code instrumenté
  s'exécute plusieurs fois plus lentement) : aucun rapport de sanitizer. Le
  compilateur, le runtime et les programmes de test sont instrumentés ; les
  programmes que `clau` lie prennent le runtime du sanitizer d'un wrapper
  `clang++` dans le `PATH`, leur code généré n'est pas instrumenté. Les quatre
  tests de refus de l'hôte injectés (`codegen_failure_*`,
  `runtime_lifecycle_failure`, `runtime_memory`) sont hors du périmètre
  d'ASan : son `operator new` abandonne sur une taille impossible au lieu de
  lever une exception.
- ThreadSanitizer : Linux x86-64, le même périmètre d'instrumentation avec
  `-fsanitize=thread` ; le CTest complet et les tests de concurrence, cinq fois
  chacun, ne signalent aucune course. Également hors périmètre : les deux tests
  qui remplacent `operator new`.
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
  temps réels des programmes démarrage compris, les tailles des exécutables,
  les échecs et les délais
  dépassés (`--timeout`, 600 s par exécution). Les nombres d'itérations
  maintiennent une exécution par défaut sous 10 minutes ; Clause, le système
  le plus lent, fixe les tailles, donc certains noyaux OTP ne durent que
  quelques millisecondes.
- Tailles des exécutables, en octets : chaque programme à `-O2`, avec `--lto`
  et à `-O0` (une compilation supplémentaire uniquement mesurée, jamais
  exécutée ; toutes deux omises par `--no-lto`) et la référence à `-O2`, avec
  une ligne de total et les variations O2 par rapport à O0, `--lto` par rapport
  à O2, `--lto` par rapport à O0 et O2 par rapport à la référence (`-N%` plus
  petit) ; et `clau` à HEAD et à la référence. L'historique les conserve sous
  `sizes_bytes` (`programs` : programme → colonne → octets, `clau` :
  `head`/`baseline` → octets ; `null` en cas d'échec de compilation).
- Historique : `benchmarks/history/<host>.json` garde un enregistrement par
  jour d'exécution (date d'exécution, hash et date de commit de HEAD, médianes
  de Clause, d'OTP et de la référence, tailles),
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
| 2026-09-28 | Migration des tests vers des flux CLI ; réparation de la porte Windows | 75 | toutes | Dépassement de pile de `parser_hardening` corrigé avec une pile de 8 Mio ; Lizard + clang-tidy propres |
| 2026-09-29 | Jalon du compilateur, steps 1–46 | 103 | 182 | Compilateur seul 80, runtime seul 16, ASan runtime 16 |
| 2026-10-01 – 10-03 | Plan motifs/guards PG1–PG20 | 104–131 | 189–258 | Révisions ABI 2–4 ; PG15a a rendu les références indépendantes d'OTP (audits optionnels, 131 → 118 tests) ; clos à 19 corpus, 67 634 valeurs, 1 969 résultats semés |
| 2026-10-03 | Audit des sources OTP | 125 | 258 | Fichiers OTP copiés remplacés par des fragments locaux ; une comparaison par fenêtres de 60 jetons avec 4 150 fichiers Erlang et 1 190 fichiers C/C++ d'OTP n'a trouvé aucun recouvrement hormis un tuple d'entiers généré |
| 2026-10-03 | Référence du plan 11 step 1 (commit `b1a471f`, version épinglée `21776803ecd1`, Lizard 1.24.0, clang-tidy 22.1.8) | 125 (122 rapide) | 258 | Complet 729 s en série, 85 s avec `-j 16` ; 14/14 audits ; 19/19 corpus ; objets étrangers O0/O2 inspectés pour 7 cibles |
| 2026-10-03 | Steps 2, 4 : fixtures de programmes, affichage des termes | 126–128 | 265 | Six références de programmes OTP ; 9 542 références `~w`/display |
| 2026-10-04 | Steps 8, 8I : exécuteur d'exécutables, tas classique (phases B, C closes) | 138–144 | 272–276 | Complet `-j 16` 235–370 s |
| 2026-10-04 – 10-05 | Steps 9–20 : `case`, `if`, levées d'exceptions, `catch`, `try`, traces de pile, `maybe` (phase D close), récursion, cadres et appels terminaux | 146–158 | 277–278 | Tests rapides et tests concernés en mode complet à chaque étape ; complet `-j 16` 155/155 en 259 s à la phase D |
| 2026-10-06 | Steps 21–28 : compréhensions (phase E close), racines et collecte, limites de mémoire et de termes (27A–27E), copies de graphes | 159–166 | 278–281 | Complet `-j 12` 105–275 s ; le step 27 a supprimé les plafonds mémoire par défaut |
| 2026-10-07 | Steps 29–35 : records, native records (ABI 6), funs (ABI 7), fermetures, funs nommées, appels dynamiques (ABI 8) | 167–177 | 283–290 | Complet `-j 12` 119–152 s |
| 2026-10-09 | Step 63 Linux x86-64 (WSL2 Ubuntu 25.04, glibc 2.41, clang du SDK LLVM 23.1.2, libstdc++ 14, GDB 16.2) | 235 | 338 | CTest complet 235/235 en 161 s ; Lizard et clang-tidy propres sous Linux (7 rapports de l'analyseur dans les en-têtes Boost ignorés) ; porte Windows 235/235 avec les en-têtes vérifiés |
| 2026-10-09 | Step 64 32 bits : Windows x86 (WoW64, clang-cl) et Linux i386 (chroot Debian 13, clang 19) | 42 + 65 références | — | Tests runtime/ABI 42/42 nativement sur les deux ; références `cross.py` 65/65 sur les deux (exécutions `integer_limit` réservées au 64 bits ignorées) |
| 2026-10-09 | Step 65 Linux arm64 et armhf (sysroots Debian 13, qemu-user 9.2) | 42 + 65 références | — | Tests runtime/ABI 42/42 chacun ; références 64/65 chacun (`port_spawn` `enoent` : lacune de `posix_spawn` dans qemu), limite d'exécution 900 s |
| 2026-10-10 | Step 67 ASan + UBSan + LeakSanitizer (Linux x86-64) | 235 | — | Aucun rapport de sanitizer ; quatre tests de refus de l'hôte injectés hors du périmètre d'ASan ; `CLAUSE_TEST_TIMEOUT_SCALE=10` |
| 2026-10-10 | Step 68 ThreadSanitizer (Linux x86-64) | 233 | — | Une inversion d'ordre des verrous corrigée (`Executor::clear`) ; ensuite aucun rapport dans le CTest complet ni dans 15 tests de concurrence x5 |
| 2026-10-10 | Steps 65A–65C : behaviours, `module_info/0,1`, imports | 234–236 rapide | 342–344 | Les références de lint et d'exécutables se reproduisent sous OTP 29.1.1 |
| 2026-10-11 | Steps 73A–73G parse transforms | 242/243 rapide | — | Échec connu de `codegen_resource_cli`, désactivé depuis |
| 2026-10-12 | Steps 62D1–62E répertoire de build et caches | 263/264 | toutes | CTest complet, échec connu de `codegen_resource_cli` ; `check-quality-all` propre |
| 2026-10-13 | Steps 58U–58W cache d'inférence | 278/279 | toutes | CTest complet, échec connu de `codegen_measurements` ; `check-quality-all` propre |
| 2026-10-14 | Step 41S `prim_eval` et la réexécution de luerl (H3 clos) | 299/300 | toutes | Voir la référence actuelle |
| 2026-10-17 | Plan 20 OPTM.2 (Term d'un mot, termes persistants sur place et récupérés) et OPTM.3 (accesseurs sans vérification) | 330/332 | toutes | CTest complet : échec connu de `codegen_measurements`, et `library_freshness` (OTP de l'hôte) attend encore les corps de bouchons `not_implemented` que `b0e62a38` a remplacés ; `check-quality-all` propre |

PG = étape du plan motifs/guards ; les comptes rendus des étapes du plan 11
sont archivés dans `.agents/00-finished.md`.
