---
source: docs/projects.md
sourceCommit: 06042fa
sourceSha256: fede4b3ed0440e1032fd9d7e0bad11ee107bc68c2c08dfa3b1add7b9fbc880c1
translatedAt: 2026-10-09
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

[targets.options]
source_search_paths = ["src", "generated"]
include_dirs = ["include", "vendor/include"]
defines = ["DEBUG", "LIMIT=100", 'LABEL="demo"']
enable_features = ["maybe_expr"]
disable_features = ["compr_assign"]

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
  récursive des `.erl`) sont optionnels, mais une cible doit avoir au moins une
  entrée. Les fichiers explicites doivent se terminer par `.erl` ; les en-têtes
  sont des dépendances, pas des entrées.
- Les champs de `options` sont des options typées optionnelles du frontend.
  `defines` utilise `NAME` (= `true`) ou `NAME=ERLANG_LITERAL_TERM` ; les
  doublons sont des erreurs. Une fonctionnalité ne peut pas figurer dans les deux
  listes de fonctionnalités.
- `entry` (optionnel) choisit l'entrée de l'exécutable `MODULE[:FUNCTION]` ;
  voir [exécutables](executables.md#entry-selection). L'option `--entry` de la
  CLI la remplace pour une seule cible sélectionnée.
- `output` est la destination de l'exécutable, par défaut
  `<manifest-dir>/build/<target>` (`.exe` sous Windows). Une cible avec `output`
  ou `entry` est une cible exécutable ([exécutables](#executables)) ; `--emit` et
  les modes de vérification/affichage ignorent les sorties de ces deux clés.
- Pas encore pris en charge : valeurs par défaut à la racine, héritage,
  dépendances entre cibles, imports, profils, exclusions, paquets, surveillance,
  cache, compilations parallèles. Les champs ne sont ajoutés qu'avec le
  comportement correspondant.

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
- Code de sortie 2 : erreurs d'utilisation et cibles inconnues. Code 1 : échecs
  du manifeste, de la découverte, du frontend ou de la création. Code 0 : succès
  (avertissements permis).

Chaque cible sélectionnée est un lot de compilation séparé avec ses propres
sessions de prétraitement. La planification (décodage, sélection, découverte,
vérification des collisions de sorties) se termine avant le traitement de toute
source ; l'exécution traite ensuite les cibles/fichiers dans l'ordre et mémorise
les échecs. La sortie utile va sur stdout dans l'ordre cible/fichier sans
bannières ; le contexte et les diagnostics vont sur stderr.

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

## Chemins et découverte

- Le chemin du projet est résolu par rapport au répertoire d'invocation ; le
  parent lexical du manifeste sert de base à tous les chemins du manifeste (même
  à travers un lien symbolique). Les chemins absolus restent absolus ; `..` est
  autorisé. Pas d'expansion par le shell, l'environnement ou le tilde. Utiliser
  `/` ou des chaînes littérales TOML pour les chemins Windows.
- Les sources relatives littérales essaient d'abord la base, puis
  `source_search_paths` dans l'ordre. Un candidat existant mais illisible est une
  erreur. Les chemins de recherche ne servent qu'à localiser les fichiers listés ;
  ils n'énumèrent pas de modules et n'affectent pas les inclusions.
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

## Options effectives

| Réglage | Combinaison du manifeste et de la CLI |
| --- | --- |
| `include_dirs` | Ordre du manifeste, après les `-I` de la CLI (le dernier `-I` de la CLI est cherché en premier) |
| `source_search_paths` | Recherche des sources du projet uniquement |
| `defines` | Manifeste d'abord, puis CLI ; les doublons entre les deux sont des erreurs |
| `applications` | Map du manifeste ; les entrées de la CLI remplacent les noms correspondants |
| Listes de fonctionnalités | Réglages du manifeste, puis modifications ordonnées de la CLI ; la CLI l'emporte |
| `output` | Par cible, cibles exécutables uniquement ; `-o` de la CLI le remplace pour une seule cible sélectionnée |
| `entry` | Par cible ; `--entry` de la CLI le remplace pour une seule cible sélectionnée |

## Dépendance de compilation

toml++ 3.4.0 (MIT), privé au compilateur, uniquement en en-têtes avec
exceptions, syntaxe non publiée désactivée. SHA-256 de l'archive
`8517f65938a4faae9ccf8ebb36631a38c1cadfb5efa85d9a72e15b9e97d25155`.

- macOS : `brew install tomlplusplus` (formule 3.4.0) est détecté.
- Windows : CMake télécharge et vérifie la version publiée dans `thirdparty/`.
- Ailleurs : l'installer, l'extraire dans `thirdparty/tomlplusplus-3.4.0`, ou
  passer `-DCLAUSE_TOML_ROOT=<path>` (prioritaire, désactive le téléchargement).
- Les compilations du runtime seul ne le recherchent pas.

## Limites

Taille du manifeste 1 Mio ; au plus 1 024 cibles et 100 000 nœuds TOML. Chaque
expansion de sources autorise 100 000 entrées visitées, 128 niveaux de
répertoires et 16 000 000 transitions de motifs génériques. L'épuisement est une
erreur explicite ; ce sont des bornes de travail, pas des délais d'E/S.
