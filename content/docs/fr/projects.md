---
source: docs/projects.md
sourceCommit: a8c3f8f6
sourceSha256: b1c98a208a0a72f7ad5b20a2915eb2b39a4142cc65314491f83b019398b3b85a
translatedAt: 2026-10-17
---
# Projets TOML

Un manifeste de projet sélectionne des groupes ordonnés de sources Erlang et
configure chaque cible indépendamment. Toutes les actions de la CLI acceptent
les projets. Voir l'[exemple fonctionnel](../examples/project/project.toml).

## Manifeste (schéma 1)

```toml
schema_version = 1

[[targets]]
name = "app"
sources = ["main.erl", "src/workers/*.erl", "shared/**/*.erl"]
source_dirs = ["src/support"]
output = "build/app"
entry = "main:main"
build_dir = "build"

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]
ignore_dirs = ["src/legacy", "deps/*/test"]
ignore_modules = ["telemetry", "*_SUITE"]
keep_exports = false
cache_inference_in_dirs = ["deps/*"]

[targets.options.applications]
my_dependency = "vendor/my_dependency"
```

- `schema_version = 1` et un tableau `targets` non vide sont obligatoires. Les
  clés inconnues, les mauvais types, les noms de cible en double et les chaînes
  vides sont rejetés ; aucune conversion de type implicite. Tout le manifeste est
  validé, y compris les cibles non sélectionnées.
- Noms de cible : ASCII sensible à la casse `[A-Za-z0-9_][A-Za-z0-9_.-]*`,
  uniques. Un nom désigne une cible de compilation, pas un triplet LLVM.
- `sources` (fichiers et motifs génériques) et `source_dirs` (découverte
  récursive des `.erl` et `.abstr`) sont optionnels, mais une cible doit avoir
  au moins une entrée. Les fichiers explicites doivent se terminer par `.erl`,
  ou `.abstr` pour des formes au format abstrait
  ([transformations](transforms.md#interchange)) ; les en-têtes sont des
  dépendances, pas des entrées.
- `parse_transforms` (noms de modules) et `transform_paths` (répertoires ou
  motifs de fichiers `.beam` précompilés) dans `options` appliquent des parse
  transforms aux modules de la cible
  ([transformations](transforms.md#options)).
- `ignore_dirs` (chemins) et `ignore_modules` (noms de modules), tous deux avec
  motifs génériques, dans `options` excluent des sources de la compilation
  ([sources ignorées](#ignored-sources)).
- `keep_exports = true` dans `options` garde appelable chaque export de
  l'exécutable de la cible, comme `--keep-exports` le fait pour chaque cible
  sélectionnée ([vivacité des exports](executables.md#export-liveness)). Ce
  doit être un booléen.
- `cache_inference_in_dirs` (motifs génériques de répertoires) dans `options`
  ajoute des répertoires dont les modules gardent leurs résultats d'inférence
  dans le cache de compilation ([cache d'inférence](#inference-cache)).
- Les champs de `options` sont des options typées optionnelles du frontend.
  `defines` utilise `NAME` (= `true`) ou `NAME=ERLANG_LITERAL_TERM` ; les
  doublons sont des erreurs. Une fonctionnalité ne peut pas figurer dans les deux
  listes de fonctionnalités.
- `entry` (optionnel) choisit l'entrée de l'exécutable
  `MODULE[:FUNCTION[/ARITY]]` ; voir
  [exécutables](executables.md#entry-selection). L'option `--entry` de la CLI la
  remplace pour une seule cible sélectionnée.
- `build_dir` (optionnel) est le [répertoire de build](#build-directory) de la
  cible, par défaut `<manifest-dir>/build`.
- `output` est la destination de l'exécutable, par défaut
  `<manifest-dir>/build/<target>` (`.exe` sous Windows). Une cible avec `output`
  ou `entry` est une cible exécutable ([exécutables](#executables)) ; `--emit` et
  les modes de vérification/affichage ignorent les sorties de ces deux clés.
- Non pris en charge : valeurs par défaut à la racine, héritage, dépendances
  entre cibles, imports, profils, paquets, surveillance, compilations
  parallèles. Les champs ne sont ajoutés qu'avec le comportement correspondant.

## CLI et sélection des cibles

```text
clau [options] <source.erl>...
clau [options] --project <path> [--target <name>]...
clau --new-project <filename>
```

- Les sources positionnelles et `--project` sont mutuellement exclusifs. Un seul
  `--project`, un nombre quelconque de `--target`, dans n'importe quel ordre.
- Sans `--target` : toutes les cibles dans l'ordre du manifeste. Les sélecteurs
  gardent leur ordre et leur première occurrence. Les noms inconnus échouent avant
  tout travail du frontend et listent les noms disponibles.
- `--project test1` charge `test1.toml` quand `test1` n'existe pas.
- Les options de frontend de la CLI s'appliquent à toutes les cibles
  sélectionnées. Les chemins relatifs de la CLI gardent leur sens par rapport au
  répertoire d'invocation ; les chemins du manifeste sont relatifs au manifeste.
- Sans `--emit` ni action de vérification/affichage, les cibles exécutables sont
  liées vers leurs sorties ([exécutables](#executables)) ; les autres cibles sont
  compilées en mémoire.
- `-o/--output` lie la cible vers ce chemin au lieu de son `output`
  ([édition de liens](executables.md#linking)) ; il exige exactement une cible
  sélectionnée.
- `--verbose` trace les fichiers/inclusions `[pp]` et les sources `[parse]` sur
  stderr.
- `--print-inputs` exécute chaque cible sélectionnée jusqu'à la compilation :
  il prétraite et analyse les sources après la
  [découverte](#paths-and-discovery), puis ajoute les modules qu'elles nomment
  depuis la bibliothèque et `source_search_paths`, comme le fait une
  compilation. Il affiche les sources de la cible (chemins absolus), une par
  ligne, puis chaque source ajoutée sous la forme
  `<path> (referenced at <file>:<line>)`, le premier endroit du module
  référent qui la nomme ; les sources ajoutées sont parcourues à leur tour.
  Rien n'est compilé. Avec plusieurs cibles, chaque liste suit une ligne
  `[target <name>]`. Les entrées positionnelles s'affichent telles que
  données. Les diagnostics vont sur stderr ; une erreur d'analyse arrête
  l'ajout des modules référencés et sort avec 1. Il remplace les autres
  actions de vérification/affichage et entre en conflit comme elles avec
  `-o`, `--entry` et les options de compilation.
- `--print-env` affiche toute l'invocation en TOML : une table `[[targets]]`
  par cible sélectionnée avec ses sources résolues, ses répertoires de
  recherche/d'inclusion et ses options effectives
  ([rapport d'environnement](compile.md#environment-report)).
- Code de sortie 2 : erreurs d'utilisation et cibles inconnues. Code 1 : échecs
  du manifeste, de la découverte, du frontend ou de la création. Code 0 : succès
  (avertissements permis).

Chaque cible sélectionnée est un lot de compilation séparé avec ses propres
sessions de prétraitement. La planification (décodage, sélection, découverte,
vérification des collisions de sorties) se termine avant le traitement de toute
source ; l'exécution traite ensuite les cibles/fichiers dans l'ordre et mémorise
les échecs. La sortie utile va sur stdout dans l'ordre cible/fichier sans
bannières (sauf les lignes de cible de `--print-inputs`) ; le contexte et les
diagnostics vont sur stderr. Une cible avec des diagnostics est nommée une
fois, sur une ligne `<manifest> [target <name>]:` avant le premier ; les
diagnostics eux-mêmes (`error: file:line:col: message`) ne portent aucun
préfixe d'outil ni de cible.

```sh
./build/debug/bin/clau --parse-check --project examples/project/project.toml
./build/debug/bin/clau --print-ast --project examples/project/project.toml --target tests --target app
```

## Exécutables

`clau --project FILE [--target T]...` (sans `--emit`, sans action de
vérification/affichage) lie chaque cible sélectionnée qui a une clé `output` ou
`entry`, ou que `-o`/`--entry` de la CLI désigne, en un exécutable par cible :

- Destination : `-o` de la CLI (relatif à l'invocation), sinon `output`
  (relatif au manifeste), sinon `<manifest-dir>/build/<target>`. Les cibles
  Windows ajoutent `.exe` à un nom sans extension. Les répertoires manquants des
  sorties du manifeste sont créés ; un répertoire `-o` explicite doit exister.
- Entrée : `--entry` de la CLI, `entry` du manifeste, sinon détection
  ([sélection de l'entrée](executables.md#entry-selection)).
- Les cibles sans `output`, `entry`, `-o` ni `--entry` sont des bibliothèques :
  elles sont compilées en mémoire et n'écrivent rien, même si un module exporte
  `main/1`.
- La planification rejette les cibles sélectionnées ayant la même destination ;
  les sorties qui ne coïncident qu'après l'ajout de `.exe` sont rejetées avant
  publication. Une sortie ne doit pas être un alias d'une source sélectionnée ou
  du manifeste.
- Chaque cible est compilée et liée dans son propre répertoire de préparation.
  Les sorties ne sont remplacées qu'après la réussite de toutes les cibles
  sélectionnées, dans l'ordre des cibles ; tout échec laisse toutes les sorties
  existantes inchangées. Un échec pendant le remplacement d'une sortie ultérieure
  peut laisser des sorties précédentes déjà remplacées.
- `--linker` et `--runtime-library` s'appliquent à toutes les cibles liées
  ([édition de liens](executables.md#linking)).

```sh
./build/debug/bin/clau --project tests/fixtures/linking/project/project.toml
```

## Créer un projet

`--new-project <filename>` écrit un manifeste annoté et rien d'autre.

- Ajoute `.toml` sauf si le nom se termine déjà par `.toml` (ASCII, insensible à
  la casse) : `demo` → `demo.toml`, `demo.config` → `demo.config.toml`.
- Rejette les noms vides ou ressemblant à des répertoires, la répétition et toute
  combinaison avec des sources, `--project`, `--target`, `-o`, les modes de
  vérification/affichage ou des options de frontend.
- Le parent doit exister. N'écrase jamais (création exclusive) ; nettoie son
  propre fichier partiel en cas d'échec d'écriture. Affiche le chemin créé en cas
  de succès.
- Le contenu est déterministe, en UTF-8/LF avec commentaires : une cible `app`,
  `sources = []`, `source_dirs = ["src"]`, des listes d'options vides et la
  sortie par défaut de la plateforme. Il se décode immédiatement ; l'utilisateur
  ajoute les sources sous `src`.

## Répertoire de build

Chaque cible de projet a un répertoire de build où Clause garde ses propres
fichiers temporaires et ses caches : le `build_dir` de la cible, relatif au
manifeste, par défaut `<manifest-dir>/build`. `--build-dir DIR` (relatif à
l'invocation) le remplace pour chaque cible sélectionnée. Les entrées
positionnelles n'en ont pas, sauf si `--build-dir` est donné.

- Les fichiers temporaires vont sous `<build_dir>/tmp` : les espaces de travail
  du chargeur de parse transforms ([transformations](transforms.md#loader)).
  Chaque exécution supprime les siens ; un `tmp` vide peut rester. Sans
  répertoire de build, ils vont dans le répertoire temporaire du système.
- La préparation de l'édition de liens (`.clause-link-*`) reste à côté de la
  sortie exécutable, car le renommage final doit rester sur le volume de la
  sortie ([édition de liens](executables.md#linking)).
- Les modes de vérification et d'affichage (`--parse-check`, `--print-ast`,
  ...) n'écrivent rien en dehors du répertoire de build ; les vérifications
  positionnelles sans `--build-dir` n'écrivent aucun fichier.
- `--print-env` affiche le `build_dir` de chaque cible (`""` s'il n'y en a
  pas).

### Caches de compilation

Les résultats qui valent la peine d'être gardés entre deux exécutions vivent
sous `<build_dir>/cache` ; `--no-cache` ne les lit ni ne les écrit. Ce sont les
réponses du chargeur de parse transforms et la liste des modules collants
(sticky) de l'OTP hôte, si bien qu'une compilation à chaud ne démarre aucun
`erl` hôte pour les modules dont les entrées de transformation n'ont pas
changé, le [résultat de compilation](compile.md#compile-cache) de chaque lot,
et les [résultats d'inférence](#inference-cache) des modules des répertoires
configurés.

- **Interface.** Les appelants utilisent un seul magasin interne au projet
  (`compiler/src/cache/
  store.hpp`) : `get`/`put` par répertoire d'entrée, nom de fichier, genre de
  résultat et clé, plus `invalidate` et `prune` ; ils ne voient jamais de
  chemins. Une valeur est la version de format de l'appelant et une liste de
  parties nommées (une exécution de transformation : `reply` et `output` ; un
  résultat de compilation : `failed`, chaque `diagnostic`, et avec des sorties
  `triple`, `extension` et une partie par objet de module), si bien qu'aucun
  appelant n'a besoin de son propre codec. Un `get` avec une autre version de
  format est un échec (miss). Chaque opération est sûre depuis plusieurs
  threads à la fois.
- **Disposition.** `cache/v2/cache.db` est une base SQLite 3.54 : table
  `entries` (répertoire d'entrée, fichier, genre, clé, format, dernière
  utilisation ; unique sur l'adresse) et table `parts` (entrée, ordre, nom,
  taille, somme de contrôle xxh3-64, et soit les octets, soit le nom d'un
  fichier blob). Les parties de plus de 256 Ko vivent dans
  `cache/v2/blobs/<xxh3-128 of the bytes>`, si bien que des parties égales (les
  objets identiques d'un lot compilé sous deux jeux d'options) ne sont stockées
  qu'une fois ; 256 Ko est le seuil où, selon les mesures, les lectures cessent
  de favoriser la base et les écritures commencent à favoriser les fichiers
  (`cache_store bench` dans `tests/compiler/cache`). Un fichier blob est écrit
  comme fichier temporaire et renommé avant la validation de la ligne qui le
  nomme, si bien qu'une ligne ne nomme jamais un fichier incomplet ; un
  plantage entre les deux ne laisse qu'un fichier orphelin.
- **Clés.** Une clé est le hachage de contenu de 128 bits de tout ce dont le
  résultat dépend, jamais un horodatage : la version et l'exécutable de `clau`
  (chemin, taille, date de modification, si bien qu'un `clau` recompilé donne
  un échec), le genre de résultat et, pour une exécution de transformation, la
  requête envoyée à `erl` (les formes prétraitées du module et ses options de
  compilation : répertoires d'inclusion, defines, fonctionnalités), la version
  de l'OTP hôte (`erl` et les fichiers `releases/*/OTP_VERSION` à côté de
  lui), chaque source de transformation du projet compilée pour l'exécution
  avec les fichiers qu'elle inclut, et chaque `.beam` des chemins de code des
  transformations. La version de format du magasin est le répertoire
  `v<format>` ; la version de format propre à une valeur est gardée dans sa
  ligne. Comme la clé couvre les formes prétraitées, un en-tête, un define ou
  une fonctionnalité modifiés, ou un nouvel en-tête qui masque un en-tête
  inclus, font échouer exactement les modules dont les formes ou les options
  changent ; les defines et les fonctionnalités sont des options de compilation
  que toute transformation voit, ils font donc échouer chaque module
  transformé ; un `.beam` modifié fait échouer chaque module dont les
  transformations s'exécutent avec ce chemin de code.
- **Concurrence.** La base fonctionne en mode journal à écriture anticipée
  (write-ahead log) avec `synchronous=NORMAL` : les lecteurs s'exécutent à côté
  d'un écrivain, et les écrivains (une transaction par `put`) s'attendent
  mutuellement jusqu'à 30 s. Plusieurs processus `clau` partageant un
  répertoire de build gardent chaque entrée. Au sein d'un processus, un mutex
  sérialise les threads qui partagent un magasin.
- **Dommages.** Les parties portent des tailles et des sommes de contrôle, et
  les fichiers blob sont vérifiés par rapport à leur nom : une partie
  endommagée ou un fichier blob manquant est un échec (`damaged entry`) et son
  entrée est supprimée. Un `cache.db` invalide, tronqué ou étranger (SQLite le
  signale corrompu ou comme n'étant pas une base, ou son identifiant
  d'application ou sa version de schéma diffèrent) est renommé en
  `cache.db.damaged` et recréé ; lorsque c'est impossible, l'exécution continue
  sans cache. Rien de cela n'est une erreur, et `--verbose` le signale par
  `[cache] ...`.
- **Systèmes de fichiers réseau.** La journalisation à écriture anticipée
  exige une mémoire partagée entre processus, que les systèmes de fichiers
  réseau ne fournissent pas. Lorsque SQLite ne peut pas passer en mode WAL, le
  magasin utilise son journal de retour arrière (les lecteurs attendent alors
  un écrivain) et `--verbose` le dit une fois ; lorsqu'aucun mode de journal ne
  fonctionne, l'exécution continue sans cache.
- **Élagage.** À la fin d'une exécution qui a écrit dans un magasin, les
  entrées inutilisées depuis 30 jours sont supprimées, puis les fichiers blob
  qu'aucune entrée ne nomme (une fois âgés de plus de 10 minutes, afin que le
  nouveau fichier d'un écrivain concurrent survive), et les pages libérées sont
  rendues au système de fichiers (vacuum incrémental). Chaque exécution
  supprime une arborescence `cache/v1` résiduelle de l'ancien backend fichier.
- **Observabilité.** `--print-stage-times` marque les étapes réutilisées
  (`[time] transform src/a.erl: 7.254 ms (cached)`) ; `--verbose` affiche
  `[cache] hit|miss <kind> <file>` avec la raison d'un échec (`no entry`,
  `inputs changed`, `damaged entry`). Les diagnostics et la sortie des
  transformations sont identiques avec et sans succès de cache : ils sont
  stockés avec l'entrée.
- **Non mis en cache :** le prétraitement et l'analyse syntaxique (charger un
  résultat en cache via les formes abstraites, `transforms/import`, s'est
  mesuré plus lent que d'analyser de nouveau), et les parcours de répertoires :
  la planification est dominée par l'ouverture et l'identification de chaque
  source, qu'un cache de parcours ne peut pas éviter.

### Cache d'inférence

Les modules de bibliothèque (les sources de `stdlib`, `kernel`, `compiler` et
`syntax_tools` d'OTP trouvées via `source_search_paths`, la
[bibliothèque](library.md) propre à Clause) changent rarement, si bien que les
modules des répertoires configurés gardent leurs résultats d'inférence de types
dans le cache de compilation, par module, et les compilations ultérieures les
réutilisent au lieu de les inférer à nouveau.

- Répertoires : les motifs implicites d'applications OTP `*/stdlib`,
  `*/stdlib-*`, `*/kernel`, `*/kernel-*`, `*/compiler`, `*/compiler-*`,
  `*/syntax_tools` et `*/syntax_tools-*`, puis le `cache_inference_in_dirs` de
  la cible, puis chaque `--cache-inference-in-dirs PATTERN` (répétable ; pour
  les entrées positionnelles aussi). Les motifs utilisent les
  [motifs génériques](#paths-and-discovery) de `sources` ; les séparateurs
  Windows sont acceptés.
- Un module est couvert lorsqu'un répertoire contenant sa source correspond à
  un motif. Un motif relatif correspond aux derniers répertoires de n'importe
  quel chemin, pas aux chemins sous le répertoire du manifeste : `*/stdlib`
  couvre `/usr/lib/erlang/lib/stdlib/src/lists.erl` et
  `references/otp/lib/stdlib/src/lists.erl`, alors qu'un
  `.../lib/stdlib-7.0/src/lists.erl` installé nécessite `*/stdlib-*`. Un motif
  absolu correspond au chemin entier du répertoire
  (`C:/Program Files/Erlang OTP/lib/*`). La correspondance est lexicale et
  sensible à la casse. Les motifs implicites couvrent aussi un répertoire du
  projet portant un tel nom (`apps/compiler`), ce qui ne fait que stocker plus
  d'entrées : la réutilisation est correcte pour tout module.
- `--print-env` affiche la liste effective sous `cache_inference_in_dirs`, les
  motifs implicites en premier. Une construction non prise en charge (`[`,
  `{`, `!`) est une erreur de manifeste, ou une erreur d'utilisation (code 2)
  sur la ligne de commande.
- La réutilisation nécessite un répertoire de build (toute cible de projet ;
  les entrées positionnelles avec `--build-dir`) et est désactivée par
  `--no-cache`. Elle fonctionne pour toute action qui analyse (compilation,
  exécutables, `--print-types`, inspections de l'IR), y compris lorsque le
  [cache de compilation](compile.md#compile-cache) du lot échoue.
- Clé : l'identité de `clau`, l'empreinte du module et celles de chaque module
  du lot que ses atomes nomment, transitivement (appels distants,
  `fun M:F/A`, `apply`, tout atome qui est un nom de module) ; voir
  [sémantique : cache d'inférence](semantic.md#inference-cache) pour savoir
  pourquoi ses faits ne dépendent que de cela. Modifier un module utilisateur
  conserve donc les succès de cache de la bibliothèque, sauf si un module de
  bibliothèque le nomme ; modifier un module de bibliothèque le fait échouer,
  ainsi que chaque module couvert qui l'atteint.
- Les entrées sont gardées par répertoire source, fichier et cible de projet
  (genre `inference@<target>`, `inference@positional`) ; une valeur est une
  partie `results` (`semantic/types/inference_store` : nœuds du graphe,
  résumés et entrées locales par fonction, faits d'expression par position
  syntaxique). Les résultats gardés par une compilation avec plus de fonctions
  vivantes (par exemple `--print-types`) servent un exécutable qui en garde
  moins.
- `--verbose` affiche `[cache] hit|miss inference <file>` par module couvert
  (raisons d'échec : `no entry`, `inputs changed`, `damaged entry`,
  `results do not fit` pour des résultats gardés auxquels manque une fonction
  vivante désormais) ; `--print-stage-times` affiche les phases
  `inference-cache` (avec `N of M
  covered modules reused`) et `inference-store`.

## Chemins et découverte

- Le chemin du projet est résolu par rapport au répertoire d'invocation ; le
  parent lexical du manifeste sert de base à tous les chemins du manifeste (même
  à travers un lien symbolique). Les chemins absolus restent absolus ; `..` est
  autorisé. Pas d'expansion par le shell, l'environnement ou le tilde. Utiliser
  `/` ou des chaînes littérales TOML pour les chemins Windows.
- Les sources relatives littérales essaient d'abord la base, puis
  `source_search_paths` dans l'ordre. Un candidat existant mais illisible est une
  erreur. Les chemins de recherche n'énumèrent pas de modules et n'affectent pas
  les inclusions.
- Lorsque les sources de la cible nomment un module qu'aucune d'elles ne
  définit (un appel distant, `fun M:F/A`, `apply` avec un module littéral,
  `-behaviour` ou `-import`), la
  [bibliothèque](library.md#how-programs-get-them) de Clause est cherchée
  d'abord, puis les chemins de recherche dans l'ordre, pour `Module.erl` (un
  OTP installé ne remplace jamais un module de Clause, et un module que Clause
  enregistre comme manquant n'est jamais pris dans un chemin de recherche :
  [résolution](library.md#which-module-a-name-resolves-to)) ; un fichier trouvé
  rejoint la cible comme une source listée, et ses propres références sont
  résolues de la même façon. Une source listée portant le nom d'un module de
  Clause le remplace, avec un avertissement.
- Motifs génériques : `*` et `?` à l'intérieur d'un composant, `**` comme
  composant entier. Les crochets, accolades, négations et échappements sont
  rejetés. La correspondance est sensible à la casse ; `?` est un scalaire
  Unicode d'un nom UTF-8 valide.
- Les entrées cachées sont incluses ; les liens symboliques de répertoire
  découverts sont ignorés (les racines explicites peuvent être des liens
  symboliques) ; les liens symboliques de fichier sont suivis.
- Ordre : les entrées de `sources` dans l'ordre, les correspondances de chaque
  motif triées par octets du chemin UTF-8, puis chaque expansion de
  `source_dirs` triée de la même façon. Les littéraux manquants, les motifs sans
  correspondance et les cibles vides sont des erreurs.
- La déduplication au sein d'une cible utilise l'identité dans le système de
  fichiers (liens symboliques, liens physiques, alias de casse), en gardant la
  première orthographe. Le même fichier dans deux cibles est compilé deux fois,
  car les options peuvent différer.
- Seules les cibles sélectionnées touchent au système de fichiers.

### Index des répertoires

Les recherches par nom ne sondent pas chaque répertoire candidat. Un index par
invocation de `clau`, partagé par toutes les cibles, garde les noms des entrées
de chaque répertoire parcouru : listés une fois, de façon non récursive, quand
une recherche en a besoin pour la première fois, ou enregistrés par les
parcours récursifs qui développent `**` dans `sources`, `source_dirs`,
`source_search_paths`, `include_dirs` et `transform_paths`, si bien qu'aucun
répertoire n'est listé deux fois. Il répond aux échecs de la recherche de
modules (la bibliothèque, puis `source_search_paths`), aux sources de
transformations, aux `sources` littérales trouvées via `source_search_paths`
et à la résolution des inclusions (le répertoire du fichier qui inclut, le
répertoire de travail, les répertoires d'inclusion dans l'ordre, puis les
applications de `include_lib`) ; un candidat que l'index contient est toujours
ouvert ou vérifié comme avant, si bien que la priorité, `ignore_dirs` et les
rapports d'erreur ne changent pas. Les noms d'inclusion avec des parties de
répertoire (`sub/x.hrl`) sont cherchés dans le répertoire qu'ils nomment ; les
noms avec des étapes `..`, les noms absolus, les répertoires relatifs et les
listages qui échouent sont sondés comme avant.

- Les clés de noms de fichiers ignorent la casse ASCII sous Windows et macOS,
  dont les volumes ignorent la casse par défaut, si bien que `Foo.hrl` trouve
  toujours `foo.hrl` ; ailleurs les clés sont exactes. Les noms que le
  repliement ne peut pas faire correspondre exactement (les noms non ASCII sur
  ces systèmes, et sous Windows les noms se terminant par `.` ou une espace ou
  contenant `~`, qui peuvent être des noms courts 8.3) sont sondés.
- L'index est un instantané d'une invocation : les fichiers qui apparaissent
  pendant l'exécution de `clau` (préparation de l'édition de liens, sorties) ne
  sont jamais des entrées de recherche.
- `--verbose` se termine par
  `[index] listed=N walked=N lookups=N misses=N probes=N` (répertoires listés à
  la demande, listages enregistrés par les parcours, recherches auxquelles
  l'index a répondu et échecs parmi elles, recherches laissées à un sondage).

## Sources ignorées

`ignore_dirs` et `ignore_modules` excluent des sources d'une cible sans les
retirer de l'arborescence, par exemple des tests embarqués, du code ancien ou
des modules qui ne comptent que sous OTP. Une source ignorée est sautée en
silence : elle n'est jamais lue, analysée, compilée ni liée, elle peut donc
même contenir des erreurs de syntaxe.

- `ignore_dirs` : chemins relatifs au manifeste (ou absolus) avec les
  [motifs génériques](#paths-and-discovery) de `sources`. Une source est
  ignorée lorsque son chemin, ou un répertoire qui la contient, correspond :
  `src/legacy`, `deps/*/test`, `**/test` (tout répertoire `test`),
  `src/*_SUITE.erl`. La correspondance est lexicale ; un motif n'a pas besoin
  de correspondre à quoi que ce soit.
- `ignore_modules` : noms de modules, ou motifs de noms avec `*` et `?`
  confrontés au nom entier (`*_SUITE`, `legacy_*`, `prim_???`). Une source
  nommée `<Module>.erl` (ou `.abstr`) est ignorée lorsqu'une entrée correspond
  à `<Module>`, et un module référencé qui correspond n'est jamais recherché.
  Cela inclut les
  [modules de bibliothèque](library.md#which-module-a-name-resolves-to) de
  Clause.
- Une source que `sources` liste littéralement (sans motif générique) n'est
  jamais ignorée : les règles n'ont aucun effet sur elle, et la compilation
  avertit `listed in sources but matched
  by ignore_modules or ignore_dirs; ignoring it has no effect`. Les
  correspondances de motifs génériques et `source_dirs` sont ignorées comme
  décrit.
- Les deux s'appliquent à `sources`, à `source_dirs`, aux sources littérales
  trouvées via `source_search_paths`, à la
  [recherche de modules](#paths-and-discovery) de `source_search_paths` et de
  la bibliothèque, et à la recherche des
  [sources de parse transforms](transforms.md#transform-modules). Une recherche
  passe outre un `Module.erl` ignoré et continue dans les répertoires suivants.
- Un module est ignoré lorsque `ignore_modules` le nomme, ou lorsqu'aucune
  source du lot ne le définit et que ses seules sources trouvées ont été
  ignorées (par la recherche, ou sautées parmi les sources de la cible, par nom
  de fichier). Un module défini par une source compilée n'est jamais ignoré.
- Les références à un module ignoré (`M:F(...)`, `-import`, `fun M:F/A`,
  `apply(M, F, [...])` avec des noms littéraux) atteignent un module
  substitut généré `M` qui exporte chaque fonction ainsi nommée ; chacune
  renvoie `{module_ignored, M}` au lieu de s'exécuter. Une fonction que le lot
  ne nomme jamais littéralement reste `undef` pour les appels dynamiques. Un
  type d'un module ignoré nommé dans une spec ou un type (`helper:result()`)
  avertit `attempt to import a type from a module ignored in project settings:
  helper:result` et est traité comme `term()`. `-behaviour(M)` avec un `M`
  ignoré avertit `behaviour M undefined`.
- `--print-inputs` liste chaque module référencé ignoré après les sources
  ajoutées sous la forme `ignored module <name> (referenced at <file>:<line>)` ;
  `--print-env` affiche les deux clés.

```toml
[targets.options]
source_search_paths = ["deps/**"]
ignore_dirs = ["deps/*/test", "src/legacy"]
ignore_modules = ["telemetry", "*_SUITE"]
```

## Options effectives

| Réglage | Combinaison du manifeste et de la CLI |
| --- | --- |
| `include_dirs` | Ordre du manifeste, après les `-I` de la CLI (le dernier `-I` de la CLI est cherché en premier) ; une entrée avec motifs génériques (`deps/*/include`, `apps/**/include`) se développe sur place en les répertoires existants auxquels elle correspond, triés par octets du chemin UTF-8 (`**` correspond aussi à zéro répertoire, les liens symboliques de répertoire sont sautés) ; un motif sans correspondance est une erreur |
| `source_search_paths` | Racines de repli pour les sources littérales et les modules que la cible nomme sans les lister ; les motifs se développent comme pour `include_dirs` (sans correspondance : `unmatched source search path pattern`) |
| `defines` | Manifeste d'abord, puis CLI ; les doublons entre les deux sont des erreurs |
| `applications` | Map du manifeste ; les entrées de la CLI remplacent les noms correspondants |
| Listes de fonctionnalités | Réglages du manifeste, puis modifications ordonnées de la CLI ; la CLI l'emporte |
| `output` | Par cible, cibles exécutables uniquement ; `-o` de la CLI le remplace pour une seule cible sélectionnée |
| `entry` | Par cible ; `--entry` de la CLI le remplace pour une seule cible sélectionnée |
| `cache_inference_in_dirs` | Motifs OTP implicites, puis ceux du manifeste, puis `--cache-inference-in-dirs` de la CLI ([cache d'inférence](#inference-cache)) |

## Dépendance de compilation

toml++ 3.4.0 (MIT), privé au compilateur, uniquement en en-têtes avec
exceptions, syntaxe non publiée désactivée. SHA-256 de l'archive
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS : `brew install tomlplusplus` (formule 3.4.0) est détecté.
- Windows : CMake télécharge et vérifie la version publiée dans `thirdparty/`.
- Ailleurs : l'installer, l'extraire dans `thirdparty/tomlplusplus-3.4.0`, ou
  passer `-DCLAUSE_TOML_ROOT=<path>` (prioritaire, désactive le téléchargement).
- Les compilations du runtime seul ne le recherchent pas.

Le [cache de compilation](#build-caches) utilise l'amalgamation SQLite 3.54.0
(domaine public), compilée uniquement dans la bibliothèque de cache du
compilateur (`clause_sqlite`, sans les options d'avertissement du projet).
CMake télécharge
`https://www.sqlite.org/2026/sqlite-amalgamation-3540000.zip` dans
`thirdparty/` sur tous les hôtes et vérifie son SHA-256
`68e913b0fe8ec6b4e5f391c594a28872884e80d6cd042a1e50c957be46b5aa4d` ;
`-DCLAUSE_SQLITE_ROOT=<directory with sqlite3.c and sqlite3.h>` est prioritaire
et désactive le téléchargement.

## Limites

Taille du manifeste 1 Mio ; au plus 1 024 cibles et 100 000 nœuds TOML. Chaque
expansion de sources autorise 100 000 entrées visitées, 128 niveaux de
répertoires et 16 000 000 transitions de motifs génériques. L'épuisement est une
erreur explicite ; ce sont des bornes de travail, pas des délais d'E/S.
