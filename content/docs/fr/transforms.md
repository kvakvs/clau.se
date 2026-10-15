---
source: docs/transforms.md
sourceCommit: 6ed3851c
sourceSha256: 2c6d8c271fd5fd640bb4c93eaff0872914f396898bfe9df527ca51055d033c11
translatedAt: 2026-10-15
---
# Parse transforms

## Utiliser les parse transforms

- **Prérequis :** Erlang/OTP 29 installé sur l'hôte, uniquement pour compiler
  les modules qui utilisent une transformation. `clau` prend `--erl PATH`,
  sinon `erl` dans le `PATH`, sinon sous Windows
  `%ProgramFiles%\Erlang OTP\bin\erl.exe`. `--erl none` n'exécute jamais de
  code de l'hôte : les modules qui ont besoin d'une transformation échouent.
- **Invoquer une transformation** dans le source avec
  `-compile({parse_transform, Module}).` (ou dans une liste
  `-compile([...])`), ou pour chaque module de la commande avec
  `--parse-transform Module` (répétable ; celles-ci s'exécutent en premier,
  comme `erlc +'{parse_transform,M}'`).
- **Les modules de transformation** sont trouvés sous forme de fichiers
  `.beam` dans les répertoires `--transform-path` (répétable) et les
  `transform_paths` du projet, puis sous forme de `Module.erl` parmi les
  sources du lot et les `source_search_paths` (compilés par l'OTP de l'hôte à
  chaque build, avec les modules qu'ils appellent depuis ces emplacements ;
  `ignore_dirs` et `ignore_modules` s'appliquent), puis parmi les modules
  d'OTP (`ms_transform`, `qlc`).
- **Précompiler** une transformation qui provient d'une autre bibliothèque
  (toujours), ou une transformation du projet que le compilateur de l'hôte ne
  peut pas construire avec les répertoires d'inclusion et les définitions de
  la cible : `erlc -o deps/lib/ebin deps/lib/src/*.erl` avec l'OTP de l'hôte,
  puis nommer `deps/lib/ebin` avec `--transform-path` ou dans
  `transform_paths`. Le `.beam` doit provenir de la version d'OTP de l'hôte ;
  un `.beam` à cet endroit l'emporte sur un source du même module.
- **Ce qui l'exécute :** la compilation, `--print-ast`, `--print-source` et
  `--print-abstr` (qui montre les formes transformées) ; `--parse-check`,
  `--preprocess-check` et `--print-pp` ne l'exécutent pas.

```sh
clau --erl "C:/Program Files/Erlang OTP/bin/erl.exe" --transform-path ebin -o app app.erl
```

Clause applique `{parse_transform, Module}` comme le fait `erlc`. Il exporte le
module analysé sous forme de formes du
[format abstrait](https://www.erlang.org/doc/apps/erts/absform.html) d'OTP,
exécute le module de transformation sur un Erlang/OTP 29 installé sur l'hôte,
importe les formes renvoyées comme nouvelle syntaxe du module et compile
celle-ci. OTP n'est nécessaire que pendant la compilation d'un module qui
utilise une transformation ; les programmes générés n'en ont jamais besoin.
Décidé au plan step 73A ; implémenté par les steps 73B–73G
(`compiler/src/transforms/`).

## Comportement d'OTP

D'après le `lib/compiler/src/compile.erl` épinglé (`transform_module`,
`foldl_transform`, `maybe_strip_columns`) et observé sous OTP 29.1.1 :

- Les transformations s'exécutent comme première passe standard : après `epp`
  et l'analyse syntaxique, avant `erl_lint`, avant qu'`erl_internal` n'ajoute
  `module_info/0,1` et `behaviour_info/1`.
- La liste des transformations est chaque `{parse_transform, M}` des options de
  compilation (`erlc +'{parse_transform,m}'`), puis des attributs `-compile`
  dans l'ordre des formes. Une transformation nommée deux fois s'exécute deux
  fois. Avant l'exécution de la première, ces options sont retirées des
  formes : un attribut `-compile` ne contenant que l'option disparaît, une
  liste perd l'élément.
- `M` doit se charger (`code:ensure_loaded/1`) et exporter
  `parse_transform/2`, sinon l'erreur `undefined parse transform 'M'` (sans
  emplacement).
- `M:parse_transform(Forms, Options)` reçoit les formes et les options de
  compilation (pas les options `-compile` du source) : `{features, Enabled}`,
  `report_warnings`, `report_errors`, `{cwd, Dir}`, `{outdir, Dir}`,
  `{i, Dir}` par répertoire d'inclusion, `{d, Name[, Value]}` par définition,
  plus tout `{parse_transform, M}` donné comme option.
- Il renvoie `Forms`, `{warning, Forms, Warnings}` ou
  `{error, Errors, Warnings}`, où chaque liste est
  `[{File, [{Location, Module, Descriptor}]}]` formatée par
  `Module:format_error(Descriptor)`. Une exception donne l'erreur
  `error in parse transform 'M': ...` (`compile:format_error/1` de
  `{parse_transform, M, {Class, Reason, Stack}}`). La transformation suivante
  reçoit les formes de la précédente ; la première erreur arrête la chaîne.
- `M:parse_transform_info/0` renvoyant `#{error_location => line}`, ou
  l'option de compilation `{error_location, line}`, retire les colonnes des
  formes avant l'exécution de `M` et des formes finales.
- Les formes portent des annotations `{Line, Column}`. `epp` ajoute d'abord
  `{attribute, {1,1}, file, {File, 1}}`, la même chose pour chaque fichier
  inclus lorsqu'il commence, et `{attribute, {L,1}, file, {File, L}}` lorsque
  le fichier qui inclut reprend à la ligne `L`, celle qui suit son
  `-include`. Les définitions de macros et les autres directives ne laissent
  aucune forme. La liste se termine par `{eof, Location}`, la fin du fichier
  principal. Les erreurs du préprocesseur et de l'analyse syntaxique restent
  dans la liste sous forme de formes `{error, E}` et `erl_lint` les signale
  après les transformations.
- Formes d'OTP 29 que `absform.md` ne liste pas : `{attribute, A, native_record,
  {Name, Fields}}` ; noms de records `{Module, Name}` (qualifiés) et `[]`
  (`#_`) dans les expressions `record`/`record_field` ; `{type, A, record,
  [{tuple, A, [Module, Name]} | Fields]}` pour les types de records qualifiés ;
  qualificateurs de comprehension `{zip, A, Qualifiers}` ; `{mc, ...}`,
  `m_generate` et les générateurs `_strict`.
- `erlc +to_abstr` écrit les formes après les transformations (et `erl_lint`)
  dans `File.abstr`, un terme `~p.` par forme ; `erlc File.abstr`
  (`compile:file(F, [from_abstr])`) compile un tel fichier sans préprocesseur
  ni analyseur.

## Chaîne de Clause

1. Prétraiter et analyser le module. Les erreurs du préprocesseur ou de
   l'analyse syntaxique arrêtent ici ; les transformations ne s'exécutent pas
   sur un module comportant des erreurs (diffère d'OTP, qui transmet les
   erreurs sous forme de formes).
2. Collecter les transformations dans l'ordre d'OTP : les options
   `--parse-transform` et les `parse_transforms` du projet, puis les attributs
   `-compile`. Un module qui n'en a aucune saute le reste et ne démarre jamais
   OTP.
3. Retirer ces options des formes et exporter celles-ci : annotations
   `{Line, Column}` telles qu'`erl_parse` les attribue, attributs `file`
   d'`epp`, et `eof`. Les fonctions prédéfinies ne font pas encore partie des
   formes.
4. Exécuter le [chargeur](#loader) une fois pour le module.
5. Importer les formes renvoyées en les transformant en jetons situés à leurs
   annotations et en les analysant avec l'analyseur de Clause ; un attribut
   `file` change le fichier des formes suivantes comme dans `erl_lint`.
6. Ajouter les fonctions prédéfinies, puis effectuer le lint, l'analyse et la
   compilation comme d'habitude.

Les transformations s'exécutent lorsqu'un module est compilé et pour
`--print-ast`, `--print-source` et `--print-abstr`, qui affichent le module
transformé. `--preprocess-check`, `--parse-check` et `--print-pp` ne les
exécutent pas.

## Échange

- `clau` et le chargeur échangent des fichiers au format External Term Format
  (`term_to_binary`, version 131, non compressé) : flottants exacts, atomes
  UTF-8, grands entiers et aucune analyse de texte en Erlang. Le format
  lui-même (étiquettes, dispositions, vérifications de bornes) vit une seule
  fois dans `abi/include/clause/abi/external_term.hpp`, indépendamment de toute
  représentation des termes, de sorte que les futurs `term_to_binary/1`,
  `binary_to_term/1` et la distribution du runtime le réutilisent. Le modèle
  de termes du compilateur de Clause contient les atomes, les entiers, les
  flottants, les listes propres et impropres, les tuples, les maps et les
  bitstrings ; les pids, ports, références et funs sont rejetés avec un
  diagnostic.
- Le texte `.abstr` suit la syntaxe de
  [`file:consult/1`](https://www.erlang.org/doc/apps/kernel/file.html#consult/1) :
  un terme par forme, chacun se terminant par `.`. `--print-abstr` affiche sur
  stdout les formes de chaque module après les transformations dans cette
  syntaxe, une forme par ligne ; un fichier d'entrée `.abstr` se compile comme
  `erlc File.abstr`. Clause écrit un texte canonique, pas la mise en page `~p`
  d'OTP ; ce qui compte, ce sont des termes égaux. Les formes sont égales à
  `epp:parse_file(F, [{location, {1, 1}}])` pour chaque construction de
  `tests/fixtures/transforms/abstract/`, y compris les attributs `file`
  d'`epp` (un `-file` explicite est annoté
  `[{generated, true}, {location, L}]`) et un `eof` compté depuis le dernier
  `-file` du fichier principal.

## Importer des formes

Les formes renvoyées, et les entrées `.abstr` (positionnelles ou `sources` du
projet), deviennent des jetons situés à leurs annotations et passent par
l'analyseur de Clause, de sorte qu'elles subissent les mêmes vérifications
syntaxiques que le source ; la précédence des opérateurs décide où des
parenthèses sont ajoutées. `{Line, Column}`, un `Line` seul (affiché
`file:line:`) et les listes de propriétés avec `location` et `file` sont
acceptés ; `generated` est ignoré. Un attribut de fichier change le fichier
des formes suivantes ; lorsque ce fichier existe, le code importé garde ses
lignes de débogage et ses commentaires de source. Les formes mal formées sont
des erreurs à leur annotation (`unknown expression bogus`,
`expected {Name, Arity}`, `invalid annotation`) et le module échoue ; les
formes `{error, _}`/`{warning, _}` d'OTP sont signalées avec leur descripteur,
dont le formatage exige OTP. Importer un module exporté et l'exporter de
nouveau donne les mêmes formes.

## OTP de l'hôte

- `erl` est cherché dans cet ordre : `--erl PATH`, `erl` dans le `PATH`, puis
  sous Windows `%ProgramFiles%\Erlang OTP\bin\erl.exe`. Ne pas en trouver
  lorsqu'un module a besoin d'une transformation est une erreur qui nomme la
  transformation et le module ; il n'existe aucun repli qui saute les
  transformations.
- L'hôte doit exécuter OTP 29 (`erlang:system_info(otp_release)`) ; une autre
  version est une erreur.
- Le [chargeur](#loader) s'exécute sous la forme
  `erl -noshell -noinput -pa Dir ... -eval ...` (répertoires du chemin de code
  rendus absolus) avec une limite de temps de 600 s. Sa sortie standard et sa
  sortie d'erreur (y compris la sortie `io:format` de la transformation) sont
  recopiées sur la sortie d'erreur de `clau` après sa fin.
  Un chargeur qui se termine sans écrire de réponse, dépasse le délai ou ne
  peut pas démarrer est une erreur.
- Une transformation exécute du code arbitraire avec les droits de
  l'utilisateur, exactement comme elle le ferait sous `erlc`.

## Chargeur

`compiler/src/transforms/loader/clause_transform_loader.erl` appartient au
projet et est embarqué dans `clau`. Chaque exécution l'écrit, ainsi que la
requête, dans un nouveau répertoire temporaire, `clause-transform-*` sous
`<build_dir>/tmp` ([répertoire de build](projects.md#build-directory)) ou,
pour les entrées positionnelles sans `--build-dir`, le répertoire temporaire du
système, supprimé après l'exécution ; `erl` compile et charge le chargeur en
mémoire. La requête contient les formes, les options, la liste des
transformations, le nom de fichier du module et les sources de
transformations du projet à construire. Avec un répertoire de build, la
réponse et la sortie du chargeur sont gardées dans le
[cache de build](projects.md#build-caches) et réutilisées tant que la requête
et tout ce dont elle dépend restent inchangés ; la liste des modules collants
(sticky) de l'hôte est gardée de la même façon. Le chargeur :

1. vérifie la version d'OTP ;
2. compile en mémoire les sources de transformations du projet demandées et
   les charge ;
3. pour chaque transformation : la charge, retire les colonnes comme le
   demande `parse_transform_info/0`, appelle `parse_transform/2` et formate
   les avertissements et les erreurs en `{File, Location, Text}` avec
   `Module:format_error/1` ;
4. écrit `{ok, Forms, Warnings}` ou `{error, Errors, Warnings}` et s'arrête.

## Modules de transformation

Un module de transformation est recherché dans cet ordre :

1. **Fichiers `.beam` précompilés** dans les répertoires de
   `--transform-path DIR` (répétable) et de l'option de projet
   `transform_paths`, qui sont placés dans le chemin de code du chargeur avant
   ceux d'OTP. C'est la seule façon d'utiliser une transformation qui provient
   d'une bibliothèque de dépendance : construire d'abord cette bibliothèque
   avec l'OTP de l'hôte (par exemple `erlc -o deps/lib/ebin deps/lib/src/*.erl`) ;
   Clause ne construit jamais les dépendances. Le `.beam` doit provenir de la
   version majeure d'OTP de l'hôte.
2. **Les sources du projet courant** : un `Module.erl` dans le lot ou ses
   `source_search_paths`, compilé en mémoire par le chargeur avec les
   répertoires d'inclusion et les définitions de la cible à chaque exécution,
   avec les modules du projet qu'il appelle par leur nom (trouvés de la même
   façon). La recherche ignore les sources que `ignore_dirs` ou
   `ignore_modules` laissent de côté, comme le fait la
   [recherche de modules](projects.md#ignored-sources). Clause cherche ces
   sources une fois par lot et les garde en mémoire ; le chargeur les compile
   tout de même pour chaque module sur lequel la transformation s'exécute,
   donc précompiler une grosse transformation fait gagner ce temps.
   Les modules que l'hôte charge depuis ses répertoires collants (`kernel`,
   `stdlib`, `compiler`, comme `ms_transform` ou `qlc_pt` lorsque les sources
   d'OTP sont sur un chemin de recherche) ne peuvent pas être rechargés, donc
   les modules propres à l'hôte sont utilisés : leurs sources, et les modules
   qu'eux seuls appellent, ne sont ni recherchés ni compilés. Clause demande
   ces modules à l'`erl` de l'hôte une fois par invocation.
3. **Les modules propres à OTP** (`ms_transform`, `qlc`) depuis le chemin de
   code de l'hôte. OTP ne livre `erl_id_trans` que comme source d'exemple, pas
   comme module. Leurs en-têtes se résolvent comme tout `include_lib`
   ([préprocesseur](preprocessor.md#compatibility-policies)) : associer
   l'application, comme dans
   `--app-dir "stdlib=C:/Program Files/Erlang OTP/lib/stdlib-8.1"` pour
   `include_lib("stdlib/include/ms_transform.hrl")`, ou nommer directement la
   transformation avec `-compile({parse_transform, ms_transform})`.

Compiler une transformation du projet peut échouer là où son vrai build
réussit : en-têtes de dépendances, transformation de la transformation, ou
macros que seul un autre outil de build définit. Clause signale alors les
messages du compilateur sur le source de la transformation, avec l'indication
de la précompiler en `.beam` avec l'OTP de l'hôte et de passer son répertoire
avec `--transform-path`. Une transformation du projet est aussi compilée par
Clause comme module ordinaire lorsqu'elle fait partie du lot ; ses propres
appels (`erl_syntax`, `erl_parse`, ...) peuvent alors exiger des modules de
bibliothèque que Clause ne livre pas, donc garder les transformations hors des
`sources` d'une cible lorsque seule la transformation en a besoin.

## Diagnostics

| Situation | Message |
| --- | --- |
| Pas d'OTP sur l'hôte | `File: parse transform 'M' needs Erlang/OTP 29 on the host; pass --erl` |
| `--erl` ne nomme aucun exécutable | `File: erl not found: PATH` |
| Mauvaise version d'OTP | `parse transforms need Erlang/OTP 29 on the host, found N` |
| Transformation introuvable | `File: undefined parse transform 'M'` (texte d'OTP) |
| La transformation a levé une exception | `File: error in parse transform 'M': ...` (texte d'OTP) |
| Avertissement ou erreur de la transformation | `File:Line:Column: Text` tel que renvoyé |
| Le source de la transformation ne compile pas | ses messages, puis l'indication de précompilation |
| Un chemin de transformation n'existe pas | `File: parse transform path is not a directory: DIR` |
| Un `.beam` d'un chemin de transformation ne se charge pas | `File: cannot load parse transform 'M' from PATH: Reason` |
| Le chargeur a échoué, dépassé le délai ou n'a écrit aucune réponse | `parse transform loader failed: ...` |
| Formes renvoyées invalides | le diagnostic de l'analyseur à l'emplacement de la forme |

## Options

| CLI | Projet (`[targets.options]`) | Signification |
| --- | --- | --- |
| `--parse-transform M` | `parse_transforms = ["m"]` | Applique `M` à chaque module, avant ses propres transformations `-compile` (celles de la CLI d'abord) |
| `--transform-path DIR` | `transform_paths = ["deps/*/ebin"]` | Chemin de code pour les fichiers `.beam` de transformations précompilées ; motifs comme dans `source_search_paths` |
| `--erl PATH` ou `none` | — | Exécutable `erl` de l'hôte ; `none` n'exécute jamais de code de l'hôte |
| `--print-abstr` | — | Affiche les formes après les transformations au lieu de compiler |

Un projet qui utilise sa propre transformation et une transformation
précompilée provenant d'une dépendance :

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[targets.options]
source_search_paths = ["transforms"]  # transforms/pt_rewrite.erl, compiled for each build
parse_transforms = ["pt_dep"]         # applied to every module of the target
transform_paths = ["deps/*/ebin"]     # deps/ptdep/ebin/pt_dep.beam, built with erlc first
```

Garder les modules de transformation hors des `sources` d'une cible lorsque le
programme ne les appelle pas : en tant que modules ordinaires, ils seraient
aussi compilés par Clause, et leurs appels à `erl_parse` ou `erl_syntax`
exigent des modules que Clause ne livre pas.
