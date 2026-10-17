---
source: docs/semantic.md
sourceCommit: a8c3f8f6
sourceSha256: f1156b4ef9a29821e7a254cd605e1b92c22cf3304d574ae47f4d558a786f2c18
translatedAt: 2026-10-17
---
# Analyse sémantique

S'exécute après l'analyse syntaxique lors de la compilation par défaut et avec
`--print-types` ; les actions purement syntaxiques l'ignorent. Les erreurs
arrêtent le lot concerné avant LLVM ; les diagnostics conservent l'origine des
macros et des inclusions, et les entrées suivantes sont tout de même
diagnostiquées.

## Vérifications des modules et des appels

- La déclaration de module est obligatoire et unique ; arités de fonction de 0
  à 255 ; pas de définitions en double ; chaque export existe (un export répété
  produit un avertissement, comme dans OTP). Les noms entre guillemets ou
  Unicode conservent leur identité exacte.
- Chaque fonction est vérifiée, y compris le code inutilisé et inaccessible.
- Les appels sont résolus au sein du lot par module/nom/arité. Les appels
  distants (y compris auto-qualifiés) exigent des exports. Les appelés manquants
  ou privés et les modules en double sont des erreurs.
- `fun F/A` doit nommer une fonction du module (`function F/A undefined`) ;
  `fun M:F/A` et les appels de valeurs (`F(Args)`) ne sont pas résolus à la
  compilation ([funs](funs.md)). Chaque valeur de fun distincte reçoit une
  entrée `Module::funs` après l'analyse des liaisons.
- La récursion directe, mutuelle et entre modules est acceptée. Le graphe
  d'appels est découpé en composantes fortement connexes (Tarjan itératif) dans
  l'ordre appelé avant appelant ; une composante est récursive lorsqu'elle a
  plusieurs membres ou qu'un membre s'appelle lui-même.

## Behaviours

D'après les
[behaviours](https://www.erlang.org/doc/system/design_principles.html#behaviours)
d'OTP, `erl_internal:add_predefined_functions` et le `check_behaviour`
d'`erl_lint`.

- Un module qui déclare `-callback` reçoit la fonction prédéfinie et exportée
  `behaviour_info/1` d'OTP : `callbacks` donne les callbacks déclarés dans
  l'ordre du source, `optional_callbacks` ceux des listes `-optional_callbacks`
  bien formées (les callbacks qualifiés par un module sont omis). Le frontend
  l'ajoute comme fonction à la ligne `-module` (`driver/predefined`). Comme dans
  OTP, le source du module lui-même ne peut pas la nommer : un `-export`, un
  appel local, `fun
  behaviour_info/1` ou une `-spec` la concernant sont une fonction non définie ;
  les appels distants (y compris auto-qualifiés) l'atteignent. `-callback` à
  côté d'une `behaviour_info/1` écrite à la main est une erreur
  (`cannot define callback attibute for F/A when behaviour_info is defined`,
  orthographe d'OTP).
- `-behaviour(M)` et `-behavior(M)` peuvent se répéter. `M` est résolu dans le
  lot ; un nom de module de bibliothèque (`library.md`) ajoute ce module comme
  le fait un appel littéral. Les diagnostics utilisent le texte d'OTP au nom de
  l'attribut :
  - `undefined callback function F/A (behaviour 'M')` pour chaque callback
    requis et non optionnel que le module n'exporte pas (triés) ;
  - `conflicting behaviours -- callback F/A required by both 'M2' and 'M1' (line
    L, column C)` lorsqu'un behaviour antérieur l'exige aussi (un callback
    optionnel compte lorsqu'il est exporté) ;
  - `behaviour M undefined` lorsque `M` n'est pas dans le lot ou n'a pas de
    `behaviour_info/1` (les behaviours d'OTP comme `gen_server` ne sont pas
    dans la [bibliothèque](library.md) de Clause), ainsi que les erreurs de nom
    de module d'OTP pour les noms qui ne peuvent pas être des modules
    (`the module name must not be empty`, `... must be an atom`, ...).
- Les avertissements ne font pas échouer la compilation. Les options
  `-compile` `nowarn_behaviours` (toute la vérification, erreurs de nom de
  module comprises), `nowarn_undefined_behaviour_func`,
  `nowarn_undefined_behaviour` et `nowarn_conflicting_behaviours` les
  désactivent.
- Non évalué : une `behaviour_info/1` exportée et écrite à la main d'un module
  behaviour, de sorte que les callbacks de ses utilisateurs ne sont pas
  vérifiés, et les avertissements d'OTP sur les callbacks mal définis ou
  dépréciés ne se produisent jamais
  ([différences](differences.md#errors-stack-traces-and-reports)).
- Preuves : `tests/fixtures/lint` (diagnostics générés par OTP, CTest
  `lint_diagnostics`), `executables_behaviours`, cas CLI `semantic`.

## Imports

D'après les règles d'import d'`erl_lint`.

- `-import(Module, [F/A, ...])` fait d'un appel local `F(...)` l'appel distant
  `Module:F(...)` : le module doit être dans le lot (un module de bibliothèque
  le rejoint comme pour un appel littéral) et exporter la fonction, ou être un
  module de builtins (`-import(io, [format/2])`,
  `-import(erlang, [display/1])`). Un import a priorité sur une BIF
  auto-importée de même nom.
- Erreurs avec le texte d'OTP : `function F/A already imported from M`
  (l'attribut entier est alors ignoré), `defining imported function F/A`,
  `creating a fun from imported name F/A is not allowed`. Une fonction importée
  dans un guard est un appel de guard illégal (sauf les BIF de guard
  d'erlang).
- Avertissement `import directive overrides auto-imported BIF F/A -- ...` sauf
  si `no_auto_import` la nomme ou si `nowarn_bif_clash` est donné ; Clause
  connaît les BIF auto-importées qu'il implémente.
- Preuves : `executables_imports`, cas de lint `imports_conflicts`,
  `imports_fun`, `imports_bif`, cas CLI sémantiques.

## Fonctions prédéfinies

D'après les [modules](https://www.erlang.org/doc/system/modules.html) d'OTP et
`erl_internal:add_predefined_functions`. Le frontend ajoute `module_info/0,1` à
chaque module compilé (après une `behaviour_info/1` générée) sous forme de
fonctions Erlang renvoyant des données littérales (`driver/predefined`,
`semantic/module_info`) ; `Module::predefined_` compte ces formes finales, qui
sont toujours exportées et omises de `--print-types`.

- `module_info()` donne
  `[{module,_},{exports,_},{attributes,_},{compile,_},{md5,_}]` ;
  `module_info(Key)` répond aussi à `functions`, `nifs` (`[]`) et `native`
  (`false`), et lève `badarg` pour toute autre clé.
- `exports` : les fonctions exportées dans l'ordre de définition (les escripts
  ajoutent `main/1`), puis `behaviour_info/1` lorsqu'elle est générée,
  `module_info/0`, `module_info/1`. `functions` : chaque fonction dans l'ordre
  de définition, puis les mêmes fonctions prédéfinies.
- `attributes` : chaque attribut sauf `module`, les exports et les imports, les
  formes type/spec/callback, les records, `export_type`, `optional_callbacks`,
  `export_record`, `compile`, `file`, la documentation et `feature`, dans
  l'ordre du source ; une valeur qui n'est pas une liste est enveloppée dans
  une liste (`-tags(a)` donne `{tags,[a]}`). Sans `-vsn`, `{vsn,[N]}` vient en
  premier, `N` étant `md5` lu comme un entier non signé gros-boutiste, comme le
  dérive OTP.
- `md5` : MD5 du source affiché du module (`print_source` : macros
  développées, inclusions intégrées, commentaires et mise en page supprimés).
  `compile` : `[{version,ClauseVersion},{options,[]},{source,AbsolutePath}]`.
- Contrairement à `behaviour_info/1`, le source du module lui-même les voit :
  les appels locaux et `fun module_info/1` fonctionnent. Définir l'une ou
  l'autre est une erreur (`function module_info/0 already defined`) ; en
  exporter une, comme tout export répété, ne produit qu'un avertissement
  (`function module_info/0 already exported`).
- Les attributs sont des données ; seules `on_load`, `nifs` et les options
  `-compile` non inertes sont rejetées comme modifiant le comportement.
- Les fonctions générées n'ont pas de ligne source (OTP ne leur en donne
  aucune) : pas d'emplacements de débogage, de commentaires de source dans
  l'IR ni d'entrées `--print-types`. `module_info/0` contient les mêmes
  littéraux que `module_info/1`, donc elle ne fait aucun appel.
- Preuves : `executables_module_info` (stdout d'OTP ; valeurs dérivées par leur
  forme), cas de `tests/fixtures/lint` `module_info_defined`,
  `exports_repeated`.

## Liaisons

Chaque liaison a une identité relative à la fonction `clause[N].local[M]`. Les
occurrences sont des définitions, des lectures ou des vérifications d'égalité
exacte, étiquetées avec le contexte tête/guard/corps. L'analyse est
déterministe.

- Chaque clause part d'un environnement vide. Les candidats de la tête
  collectent des définitions provisoires ; les guards les lisent ; le corps ne
  les voit qu'en cas de succès.
- `_` ne lie rien ; `_Name` est une variable ordinaire. Un nom répété est une
  contrainte d'égalité exacte.
- Les correspondances du corps visitent le membre droit avant le membre
  gauche ; les chaînes vont de droite à gauche. Un motif entre parenthèses
  `P1 = P2` est un alias, pas une séquence.
- Les expressions sœurs lisent les mêmes noms entrants ; leurs définitions sont
  exportées après l'expression entière. `{X = 1, X}` est une lecture non liée ;
  `{X = 4, X = 3}` est légal et échoue à l'exécution.
- Les définitions dans le membre droit de `andalso`/`orelse` ou à l'intérieur
  de `catch Expr` sont dangereuses (unsafe) ensuite (`vtunsafe` d'OTP) ; les
  noms liés avant un `catch` restent utilisables. Chaque nom lié à l'intérieur
  d'un `try` est dangereux ensuite ; les clauses `of` voient les noms du corps,
  les clauses catch les voient comme dangereux, et le corps after voit comme
  dangereux chaque nom lié plus tôt dans le try. La variable de pile d'une
  clause catch doit être nouvelle (`stacktrace_bound` d'OTP) et son guard ne
  doit pas la lire (`stacktrace_guard`). Un `maybe` n'exporte rien : chaque
  `?=` lie pour les expressions suivantes du corps, les clauses `else` voient
  les noms du corps comme dangereux et chaque nom lié à l'intérieur est
  dangereux ensuite. Les guards ne publient jamais de liaisons ; les
  correspondances dans les guards sont des erreurs même lorsqu'elles sont
  inaccessibles.
- Les clés de map ne lisent que les liaisons entrantes ; les tailles de
  binaries lisent aussi les segments antérieurs du même binary (voir
  [motifs](patterns.md#scopes)).
- L'expression examinée d'un `case` lie dans la portée englobante. Chaque
  clause part de cette portée ; les définitions de son motif sont provisoires
  jusqu'au guard, qui ne fait que lire. Les noms liés par toutes les clauses
  sont exportés avec une seule identité (les clauses suivantes réutilisent
  l'identité qu'une clause antérieure a donnée au nom) ; les noms liés par
  certaines clauses seulement, ou dangereux dans l'une d'elles, sont dangereux
  ensuite. Les exports se joignent de façon conservatrice comme dans
  l'`erl_lint` d'OTP (`icrt_export`) ; l'avertissement d'OTP lorsqu'un motif
  ultérieur fait correspondre un nom exporté n'est pas émis. Les clauses `if`
  suivent les mêmes règles avec un guard et sans motif.
- `begin`/`end` est une séquence dans la portée englobante.
- Les lectures non liées, dangereuses et de jokers sont des erreurs localisées.
  Les messages conservent la formulation du compilateur (`unbound variable X`,
  `unsafe variable X`) ; le corpus des liaisons vérifie chacune par rapport à
  la classe `unbound_var`/`unsafe_var` d'OTP.
- Une comprehension évalue chaque qualificateur dans l'ordre, dans la portée
  laissée par les précédents. Les motifs des générateurs lient de nouveaux noms
  qui masquent les noms extérieurs (les lectures à l'intérieur du motif
  préfèrent les noms qu'il a déjà liés) ; un groupe zip lie tous ses motifs
  ensemble. Les modèles (templates) lisent comme des expressions sœurs. La
  portée après la comprehension est celle d'avant : ses noms n'y sont pas
  liés.
- Les clauses d'une fun anonyme partent chacune de la portée au niveau de la
  fun : les noms de la tête sont nouveaux et masquent les noms extérieurs, les
  guards les lisent, et rien de ce qui est lié à l'intérieur n'est visible
  après la fun. Chaque définition extérieure lue à l'intérieur est consignée
  comme une capture (`Function::captures`, ordre de définition). Le nom d'une
  fun nommée est une définition de plus avec laquelle chaque clause commence
  (`Function::fun_names`) ; il n'est jamais capturé. Les variables de
  `fun M:F/A` sont des lectures de l'expression fun
  (`Function::fun_operands`).

Les parcours sont itératifs, avec un budget par module de 1 000 000 unités de
travail, ou 32 par expression si c'est davantage (les parseurs générés comme
l'`erl_parse` d'OTP ont besoin d'environ 10 par expression). La résolution des
services a un budget de même taille ; elle parcourt les formes `-compile` et
`-import` du module pour l'état d'auto-import d'un nom une fois par nom, et non
une fois par appel (chacune des milliers de clauses d'`erl_parse` appelle
`hd/1`). L'épuisement ou toute erreur sémantique vide les tables de liaisons et
de normalisation du module.

## Types et spécifications

Un graphe de types privé représente toutes les formes de types analysées,
indépendamment de la disposition au runtime : singletons, plages, conteneurs,
rôles des champs de map, produits de fonctions et applications non résolues.
Les unions sont aplaties et dédupliquées ; `term()` est le sommet et `none()`
le fond. Valeurs par défaut : 1 048 576 nœuds, 256 membres d'union,
200 000 éléments de travail par parcours d'un type déclaré (résolution,
traduction, expansion) et 8 000 000 par passe d'inférence sur tout le
programme ; une compilation de débogage de `clau` (sans `NDEBUG`) autorise
16 000 et 1 000 000 afin que les grands programmes compilent toujours
rapidement, et peut élargir davantage. L'épuisement élargit à `term()` avec un
indicateur visible et ne rétrécit jamais une représentation.

Les métadonnées déclarées (`-type`, `-opaque`, `-nominal`, `-export_type`,
`-spec`, `-callback`, `-optional_callbacks`) suivent la référence des typespecs
d'OTP et le comportement épinglé d'`erl_lint`/`erl_internal`/`erl_types` :

- Les alias locaux peuvent masquer les noms de types intégrés. Les types
  distants du lot doivent être exportés. Les types manquants, les doublons, les
  métadonnées malformées, les variables de type singletons, les bornes
  invalides et les specs de fonctions manquantes sont des erreurs. Les types
  externes indisponibles produisent un avertissement et deviennent `term()`.
- Chaque alias ou surcharge a sa propre portée de variables ; les paramètres
  formels répétés suivent la substitution par le dernier argument d'OTP.
- Les alias récursifs restent des références nommées finies ; les corps opaques
  ne sont développés que dans leur module ; les noms nominaux sont conservés
  partout, et seule la vérification des spécifications lit la définition d'un
  type nominal, à l'intérieur de son module.
- L'évaluation des constantes est exacte, limitée à 10 000 chiffres décimaux
  par valeur.

## Inférence

L'inférence est séparée des types déclarés et ne fait jamais confiance aux
specs.

- Les entrées exportées, et les entrées des fonctions que nomme `fun F/A`, sont
  des termes arbitraires. Une fonction dans laquelle on n'entre que par des
  appels directs du lot (ni exportée ni nommée par une fun) prend comme entrées
  la jonction des faits d'arguments de ses sites d'appel
  (`semantic/types/inference_inputs`), mis en correspondance par les motifs de
  tête de chaque clause ; les appels récursifs comptent aussi. Les entrées
  partent de `none()` (une fonction que rien n'appelle ne s'exécute jamais et
  infère `none()`) et croissent au fil des passes sur le lot : 8 passes
  joignent, les suivantes élargissent comme pour les résultats récursifs ; les
  entrées qui ne se sont pas stabilisées après 16 passes deviennent `term()`
  (signalées comme élargies).
- Les littéraux ont des faits exacts : les entiers de toute taille et les
  caractères sont des singletons, les atomes des atomes singletons, les
  flottants `float()`, les chaînes des listes non vides de leurs caractères
  (`[]` pour `""`), et `-`/`+` d'un nombre littéral conservent son fait. Les
  tuples conservent les faits de leurs éléments ; les maps construites avec des
  clés constantes (un fait d'une seule valeur : un entier, un atome, `[]`, ou
  un tuple ou une map de ceux-ci) conservent le fait de valeur de chaque clé,
  une clé donnée deux fois gardant sa dernière valeur, et toute autre clé donne
  `map()`. Une construction de bitstring compte sa taille : les caractères
  littéraux, dimensionnés et encodés en UTF exactement, un segment UTF d'une
  autre valeur selon son encodage (UTF-8 : de 8 à 32 bits par octets), et un
  segment `binary`/`bitstring` selon le fait de sa valeur ou n'importe quel
  multiple de son unité (`<<1, Rest/binary>>` est `nonempty_binary()`). Un
  opérande qui ne produit jamais de valeur (`none()`) rend la construction
  `none()`.
- Les opérateurs et les builtins (`semantic/types/inference_operators`)
  calculent leur résultat à partir des faits de leurs opérandes. Les entiers
  singletons se replient exactement jusqu'à 4 096 bits par opérande et par
  résultat (bignums compris ; au-delà, `integer()`) ; les autres entiers
  utilisent l'arithmétique d'intervalles pour `+`, `-`, `*` de plages non
  négatives, `band` avec un opérande non négatif (`X band 15` est `0..15`),
  `rem` par un diviseur borné (`X rem 10` est `-9..9`), `bnot`, le `-` unaire
  et `abs/1` ; un opérande flottant donne `float()`, un opérande inconnu
  `number()`, et `/` est toujours `float()`. Les comparaisons se replient
  lorsque les valeurs des opérandes ne peuvent se comparer que d'une seule
  façon (atomes ou entiers singletons, plages d'entiers disjointes, nombres
  contre non-nombres) et sont `boolean()` sinon ; `and`/`or`/`xor`/`not` et
  `andalso`/`orelse` combinent les valeurs de vérité que leurs opérandes
  peuvent avoir (l'opérande droit d'`andalso` est le résultat lorsque le gauche
  est `true`). Une table donne à chaque builtin du pont son résultat : `pid()`
  pour `self/0` et `spawn/1,3`, `reference()`, `port()`, `non_neg_integer()`
  pour les tailles, `string()`, `nonempty_string()`, `binary()`, `list()`,
  `tuple()`, `atom()`, `boolean()` pour les tests de type, `true`/`ok` pour
  les builtins à effet de bord, le message pour `!` et `send/2` ; `trunc/1` et
  ses semblables conservent les opérandes entiers ; les builtins inconnues sont
  `term()`. Une opération qui lève toujours une exception (`1 + a`, `1 div 0`,
  `error/1`, `exit/1`, `throw/1`, `halt/0,1`) est `none()`, et
  `erlang:raise/3` ne renvoie que `badarg`. Le repli ne change jamais le code
  généré : les dépassements et les échecs restent des issues à l'exécution.
- Un corps dont l'expression ne se termine jamais (`none()`) est `none()` ; de
  même pour un appel avec un tel argument. Les chemins qui lèvent une exception
  n'ajoutent rien à une jonction, de sorte qu'une fonction qui lève toujours
  infère `none()`.
- Les fonctions d'identité/de projection conservent des relations exactes avec
  les arguments, propagées à travers les appels locaux et distants imbriqués
  avec des variables fraîches à chaque appel.
- Conteneurs (`semantic/types/inference_containers`) : une liste
  `[E1, ..., En | T]` joint ses éléments devant le fait de la queue (une liste
  propre quand la queue en est une, `nonempty_improper_list(H, T)` quand elle
  n'est pas une liste, `nonempty_maybe_improper_list()` quand elle est inconnue
  ou peut être impropre : une cellule n'est jamais vide, y compris dans un motif
  comme `[H | _]`) ; `++`, `--`, `hd/1`, `tl/1`, `element/2`, `setelement/3`,
  `tuple_to_list/1` et `map_get/2` lisent et reconstruisent les faits des
  éléments membre par membre d'une union, un membre qui lèverait une exception
  n'ajoutant rien. Une mise à jour de map conserve les clés exactes (`:=` d'une
  clé absente supprime ce membre) et donne `map()` pour une map inconnue. Les
  records sous forme de tuple sont des tuples : la construction remplit les
  valeurs par défaut (`undefined` en l'absence de valeur par défaut), l'accès
  et la mise à jour lisent et fixent le champ des tuples correspondants, et
  `#r.f` est l'index du champ. Une comprehension de liste est une liste
  éventuellement vide des faits de ses modèles, une comprehension de binary un
  nombre quelconque de copies de la taille de son modèle, une comprehension de
  map `map()`.
- Funs (`semantic/types/inference_funs`) : `fun F/A` est une fun de son arité
  renvoyant le résultat inféré de la fonction (celui d'une builtin, ou, avec
  une arité variable, `fun()`), `fun M:F/A` une fun renvoyant `term()`, et une
  fun anonyme une fun renvoyant la jonction des résultats de ses clauses,
  valeurs capturées comprises. Un appel d'une valeur joint les résultats de ses
  funs de cette arité que ses arguments sélectionnent (`term()` pour une fun
  inconnue, `none()` quand aucun membre ne peut être appelé ainsi). Une fun
  anonyme liée entière à une variable et appelée à travers elle est évaluée de
  nouveau pour cet appel, ses motifs étant mis en correspondance avec les faits
  des arguments, sur au plus 4 appels imbriqués, et les faits de sa première
  évaluation sont restaurés ensuite (`Double = fun(Y) -> Y * 2 end, Double(3)`
  donne 6). `apply(F, Args)` (aussi `erlang:apply/2`) est un appel de `F` avec
  les arguments que contient `Args` : les éléments d'une liste propre
  littérale, sinon ceux de son fait (`[]`, une liste de positions connues, ou
  autant de copies de l'élément d'une liste propre que l'arité unique de `F`
  en prend) ; une fun anonyme liée est évaluée de nouveau comme ci-dessus
  (`apply(fun kind/1, [1])` sélectionne `kind(1)`). `apply(M, F, Args)` dont
  `M` et `F` sont des atomes connus nommant une fonction exportée du lot lit
  les types de fonction de cette fonction comme `fun F/A`. Les arguments de
  longueur inconnue, les autres cibles et `M:F(Args)` avec des noms variables
  restent `term()`. Comme `fun F/A` et `apply/3` peuvent nommer une fonction
  inférée plus tard, les passes sur le lot se répètent aussi jusqu'à ce que
  chacune de ces lectures ait vu le résultat final de sa fonction ; sinon une
  dernière passe leur donne des résultats `term()`.
- Les affectations de valeur entière dans le corps et les alias copient le fait
  du membre droit (`Y = 42, Z = Y, id(Z)` infère 42) ; les motifs de tuple, de
  liste, de map et de record sous forme de tuple donnent à leurs variables les
  faits des parties qu'ils font correspondre, dans les correspondances du
  corps, les clauses `case` (depuis l'expression examinée), les clauses `of`
  d'un `try` (depuis la valeur de son corps) et les générateurs (depuis les
  éléments de leur entrée ou les clés et valeurs de map). Les valeurs non
  prouvées restent `term()` sans relations.
- Restriction (`semantic/types/inference_narrowing`, `inference_scopes`,
  `meet`) : à l'intérieur d'une clause de fonction, de `case`, de `receive` ou
  de fun, chaque motif est intersecté (meet) avec la valeur qu'il fait
  correspondre (une forme de littéral, de tuple, de liste, de record sous forme
  de tuple, de map ou de bitstring ; le fait d'une variable liée), une variable
  examinée par un `case` est restreinte avec lui, et le guard restreint les
  variables qu'il teste. Les tests de type (`is_atom/1` vers `atom()`,
  `is_boolean/1`, `is_integer/1`, `is_float/1`, `is_number/1`,
  `is_binary/1`, `is_bitstring/1`, `is_list/1` vers `maybe_improper_list()`,
  `is_tuple/1`, `is_map/1`, `is_function/1,2`, `is_pid/1`, `is_port/1`,
  `is_reference/1`, `is_record/2,3` vers le tuple du record, `is_map_key/2` sa
  map vers `map()`, et les anciens noms de guards) sont intersectés avec le
  fait de leur argument ; les comparaisons avec des constantes entières (`<`,
  `=<`, `>`, `>=`, `==`, `=:=`, d'un côté ou de l'autre, constantes repliées
  comprises) restreignent à une plage une valeur déjà prouvée entière, les
  bornes d'un même test s'accumulant (`10 >= X, X >= 0` est `0..10`) ; deux
  entiers prouvés comparés se restreignent mutuellement par leurs bornes
  (`X > Y` avec `Y` dans `0..5` rend `X` au moins égal à 1), et `/=`, `=/=`
  avec une constante resserrent vers l'intérieur une borne de plage égale à
  celle-ci. Une valeur qui peut être un flottant ou un autre terme n'est pas
  restreinte. Une conjonction applique chaque test tour à tour, une
  disjonction joint ce que prouve chaque alternative, `not` et les tests faux
  ne prouvent rien. Une clause qui suit une clause dont les motifs sont tous
  des variables simples et dont le guard entier était un unique test de type
  voit cette valeur sans la catégorie testée ; après une unique comparaison
  avec une constante entière, la même valeur (une variable simple de cette
  clause) prouvée entière voit la comparaison comme fausse
  (`f(N) when N >= 0 -> ...; f(N) when is_integer(N) -> ...` : la seconde
  clause voit `neg_integer()`). L'opérande droit d'`andalso`, la clause `true`
  de `case Test of` et ce qui suit un filtre de comprehension voient le test
  comme vrai. Une intersection vide rend la clause impossible : elle n'ajoute
  rien au résultat. Les faits restreints ne valent qu'à l'intérieur de leur
  clause ou de leur opérande ; `catch`, l'opérande droit d'`orelse` et chaque
  clause restaurent les faits d'avant eux. Après un `case`, un `if`, un
  `receive`, un `try` ou un `maybe`, le fait d'une variable est la jonction de
  ses faits à la fin de chaque clause qui se termine, de sorte que
  `case X of forever -> ...; N when is_integer(N), N >= 0 -> ... end` laisse
  `X` à `non_neg_integer() | forever`.
- `try` et `maybe` : un `try` est la jonction des valeurs de ses clauses `of`
  (de celle de son corps sans `of`) et des valeurs de ses clauses catch ; le
  corps `after` n'ajoute rien. Les clauses `of` partent des faits à la fin du
  corps et font correspondre sa valeur comme des clauses `case` (une clause
  impossible n'ajoute rien) ; les clauses catch et le corps `after` partent des
  faits d'avant le `try`, un motif de classe correspondant à
  `error | exit | throw`. Un `maybe` est la jonction de la valeur de son corps,
  des valeurs de ses clauses `else` et, sans `else`, des valeurs sur lesquelles
  ses correspondances `?=` peuvent échouer : le fait de la valeur mise en
  correspondance sans la forme du motif lorsque le motif correspond à toute sa
  forme (nouvelles variables utilisées une fois, atomes et entiers littéraux,
  `[]`, tuples de ceux-ci), sinon le fait entier. Chaque motif `?=` est
  intersecté avec sa valeur et publie ses variables pour le reste du corps ;
  un `?=` qui ne peut jamais correspondre arrête le corps. Les clauses `else`
  partent des faits d'avant le `maybe` et font correspondre les valeurs en
  échec jointes comme des clauses `case`. Les faits après un `try` joignent
  ceux de la fin de son corps (sans `of`) et de chaque clause qui se termine ;
  après un `maybe`, ceux de la fin de son corps, de chaque clause `else` qui se
  termine et, sans `else`, ceux d'avant lui.
- Usages (`semantic/types/inference_uses`) : une opération qui lève une
  exception à moins qu'un opérande ait un type prouve ce type pour la variable
  qu'elle a lue, après le retour de l'opération : l'arithmétique et les `-`/`+`
  unaires un `number()`, `div`, `rem`, les opérateurs de bits et `bnot` un
  `integer()`, `and`/`or`/`xor`, `not` et l'opérande gauche
  d'`andalso`/`orelse` un `boolean()`, `++` et `--` une `list()`, une valeur
  appelée une fun de cette arité, un nom de module ou de fonction variable un
  `atom()`, une mise à jour de map `map()`, un accès ou une mise à jour de
  record sous forme de tuple le tuple du record, un segment de binary son type
  (`<<X:8>>` : `integer()`) et sa taille un `non_neg_integer()`, et une ligne
  par vérification d'argument d'une builtin du pont (`hd/1`, `tl/1`
  `nonempty_maybe_improper_list()`, `length/1` `list()`, `element/2`
  `pos_integer()` et `tuple()`, `map_get/2` et `is_map_key/2` `map()`,
  `atom_to_list/1` `atom()`, ...). L'opération conserve sa vérification à
  l'exécution. Les noms liés à la même valeur (`Y = X`, un motif `case`
  variable sur une expression examinée variable) se restreignent ensemble.
- Domaines d'entrée et de succès : le domaine d'entrée de chaque argument est
  la jonction, sur les clauses de fonction possibles, de son fait après la tête
  et le guard (le fait restreint d'une variable simple, sinon celui du motif) ;
  son domaine de succès est la jonction, sur les clauses qui se terminent, de
  son fait à leur retour normal. `--print-types` affiche le domaine de succès
  comme les entrées (`bounded(1..10) -> 1..10`, `inc(X) -> X + 1` comme
  `inc(number()) -> number()`), ou le domaine d'entrée d'une fonction qui ne
  retourne jamais. Un appel qui retourne restreint ses arguments variables au
  domaine de l'appelé, sauf au sein d'une composante récursive encore en cours
  de résolution.
- Les résultats des clauses se joignent de façon conservatrice : une
  projection ne survit que si chaque clause renvoie le même argument. Un `case`
  ou un `if` joint les résultats de ses clauses de la même façon.
- Types de fonction (`semantic/types/function_types`) : à côté du résumé en
  union ci-dessus, une fonction conserve un type de fonction par clause
  possible, comme les surcharges d'une `-spec` : les faits des arguments après
  la tête et le guard (le fait restreint d'une variable simple, sinon celui du
  motif) et le résultat de la clause (`none()` pour une clause qui lève
  toujours une exception ; les clauses impossibles n'en ajoutent aucun). Une
  clause dont le résultat est un [fait dépendant](#dependent-facts) de ses
  arguments (un `case` ou un `if` qui la termine, ou une variable liée à
  celui-ci, imbriqué à n'importe quelle profondeur) se scinde en un type de
  fonction par clause de ce fait, les faits de ses paramètres étant
  intersectés avec les arguments qu'ils nomment. Les types de fonction aux
  entrées égales fusionnent (leurs résultats se joignent) ; au-delà de 32, les
  derniers fusionnent en un seul, entrées et résultats joints. Les composantes
  récursives les itèrent avec les résultats, chaque tour joignant (puis
  élargissant) le résultat de chaque type ; une composante qui ne converge pas
  ne conserve que ses résumés en union. Le fait d'une fun anonyme conserve un
  type de fonction par clause possible (ses motifs et son guard sur n'importe
  quel argument), `fun F/A` les types de fonction de `F/A` ; les funs qui se
  joignent ne conservent leurs types de fonction que lorsqu'ils sont égaux,
  sinon elles se joignent en une seule fun de leurs résultats joints avec des
  entrées quelconques (l'intersection avec une fun d'entrées quelconques, comme
  le fait l'usage `F(A)`, les conserve). La spécialisation, les domaines et les
  vérifications des spécifications lisent le résumé en union.
- Les appels sélectionnent des types de fonction : un appel d'une fonction
  ayant des types de fonction lit, dans l'ordre, chaque type dont les entrées
  sont intersectées par chaque fait d'argument, et s'arrête après un type exact
  (motifs de nouvelles variables utilisées une fois, atomes et entiers
  littéraux, `[]` et tuples de ceux-ci ; pas de guard ou seulement `true` et
  des tests de type de variables d'arguments simples ; pour une branche, un
  argument comme expression examinée du `case`) dont les entrées contiennent
  les arguments : aucune clause ultérieure ne peut être entrée. Son résultat
  est la jonction des résultats des types sélectionnés, un résultat égal à un
  argument étant le fait de cet argument au sein du résultat du type ; aucun
  type sélectionné rend l'appel `none()` (il ne peut que lever
  `function_clause`). Des arguments inconnus sélectionnent chaque type,
  l'union ; une fonction sans types de fonction (budget, composante non
  convergée) utilise son résumé en union. Après le retour d'un appel, ses
  arguments variables sont restreints au domaine de succès et aux entrées
  jointes des types sélectionnés. Les appels de valeurs fun sélectionnent les
  types de fonction du fait de la fun de la même façon, et une fun anonyme
  évaluée de nouveau pour un appel (voir Funs) entre dans ses clauses, les
  garde et en sort comme un `case`, de sorte qu'une clause à laquelle ses
  arguments ne peuvent pas correspondre n'ajoute rien
  (`F = fun(1) -> one; (_) -> other end, F(2)` donne `other`). Les composantes
  récursives convergent sur les résultats et les types de fonction.
- Les appels évaluent de nouveau leur appelé : lorsque les faits d'arguments
  d'un appel sont dans les entrées de l'appelé et plus étroits dans l'une
  d'elles, le corps de l'appelé est évalué de nouveau avec eux comme entrées,
  comme une fun anonyme liée, et le résultat de l'appel est le résultat des
  types de fonction sélectionnés intersecté avec celui de cette évaluation
  (`two_callers() -> {add_one(10), add_one(20)}` donne `{11, 21}`) ; les
  arguments de l'appel sont aussi restreints au domaine de succès de cette
  évaluation. Le résumé de l'appelé, ses types de fonction et les faits
  d'expressions consignés ne changent jamais (la spécialisation ne lit que
  ceux-ci). Budgets : 4 évaluations imbriquées, appelés d'au plus
  256 expressions, 4 096 unités de travail par appel puisées dans une réserve
  de 262 144 par passe sur le lot (distincte du budget propre au lot) ; les
  composantes récursives ne sont jamais évaluées de nouveau. Au-delà d'un
  budget, l'appel conserve le résultat des types de fonction sélectionnés.
- Un `receive` est la jonction de ses clauses et de son corps `after`, qu'un
  délai `infinity` n'exécute jamais.
- Une composante récursive fait partir le résultat de chaque membre de
  `none()` et infère de nouveau tous les membres jusqu'à ce qu'aucun résultat
  ne change ; chaque tour joint le nouveau résultat au précédent (l'élargit
  après les 8 premiers tours, [domaine d'inférence](#inference-domain)), et un
  appel récursif en attente n'ajoute rien à une jonction. Une fonction qui ne
  peut jamais retourner reste `none()`. Une composante qui n'a pas convergé
  après 8 tours plus 4 par membre, ou dont les tours ont dépensé plus d'un
  huitième du budget de la passe, élargit chaque membre à `term()` (signalé
  comme élargi, comme l'épuisement d'un budget) et un tour final recalcule les
  faits d'expressions ; les faits d'expressions des tours antérieurs sont
  écartés, de sorte que seuls restent les faits issus des hypothèses finales.
  Une telle composante est mémorisée : les passes suivantes donnent
  immédiatement `term()` à ses membres et n'exécutent que ce tour final, au
  lieu d'itérer de nouveau jusqu'au plafond. La passe qui élargit chaque entrée
  à `term()` oublie les composantes mémorisées, de sorte que chacune obtient
  une résolution de plus avec ces entrées.
- Les tours ne rétrécissent jamais le résumé d'un membre : ses types de
  fonction se joignent à ceux du tour précédent type par type (les résultats se
  joignent, les entrées modifiées se joignent et le type n'est plus exact), ou,
  lorsque le nombre de types a changé, les types des deux tours fusionnent. Par
  sécurité, chaque membre conserve ses 4 derniers résumés, et un membre qui
  revient à l'un d'eux devient `term()` sans types de fonction pour le reste de
  la résolution, ce qui permet aux autres membres de converger.
- Un tour ne parcourt que les membres qui lisent un résumé modifié depuis leur
  dernier parcours : chaque parcours note les résumés qu'il lit (appels,
  résultats d'appels, `fun F/A`), un résumé modifié marque ses lecteurs, et un
  membre non marqué conserve ses faits d'expressions. Le premier tour parcourt
  tous les membres.
- Un budget de travail partagé borne l'inférence ; l'épuisement fait perdre de
  la précision et retombe sur du code générique, sans jamais rejeter un
  programme.
- Les spécifications qui contredisent l'inférence sont diagnostiquées
  (`semantic/types/contracts`), mais ne deviennent jamais des faits, de sorte
  que le programme se comporte dans tous les cas comme son code le dit. Un
  type déclaré devient les faits qu'il contient (ou plus) : les types intégrés
  par leur nom (`byte()` est `0..255`, `timeout()` est
  `non_neg_integer() | infinity`, `iodata()` et `iolist()` des listes de
  n'importe quelle forme), les alias par leur définition, les types opaques et
  nominaux par leur définition à l'intérieur de leur module et comme un terme
  quelconque à l'extérieur, les types distants à travers le lot, les variables
  de type à travers leurs bornes `when` (sans contrainte : un terme
  quelconque), les maps et les records par leur catégorie. Seule une paire
  disjointe constitue une contradiction, car les faits inférés peuvent
  contenir plus de valeurs que le code n'en produit :
  - un domaine d'entrée d'argument qui ne partage aucune valeur avec la spec
    est une erreur ;
  - un résultat inféré qui n'en partage aucune (sauf s'il est inconnu ou
    `none()`, qui convient à tout résultat), ou un appel dont toutes les
    surcharges rejettent les faits d'arguments, est un avertissement (l'appel
    peut se trouver sur un chemin qui ne s'exécute jamais) ;
  - `none()`/`no_return()` n'admet qu'une fonction qui ne retourne jamais.

  Le diagnostic nomme la fonction, le type déclaré tel qu'il est écrit et le
  type inféré. Les spécifications `-callback` ne sont pas vérifiées. Le
  compilateur d'OTP ne vérifie pas les spécifications
  ([différences](differences.md#language-edge-cases)).

### Faits dépendants

`semantic/types/dependent`. Un `case`, un `if` ou un `try ... of` se comporte
comme une fun des variables que ses clauses restreignent, appliquée à
celles-ci : sa valeur est un fait dépendant, un type de fonction par clause
possible.

- Paramètres : les variables liées avant la construction que lisent son
  expression examinée (la dernière expression du corps d'un `try`) et ses
  guards, dans l'ordre du source (les variables que lient les motifs de ses
  clauses sont nouvelles dans chaque clause, pas des paramètres) ; au plus 4,
  la restriction d'un paramètre ultérieur est oubliée. Chaque clause possible
  conserve les faits des paramètres après son motif et son guard ainsi que sa
  valeur (`none()` pour une clause qui ne se termine jamais) ; elle est exacte,
  comme un type de fonction dans la sélection d'appel, lorsqu'un `case` ou un
  `try` fait correspondre un paramètre ou un tuple de paramètres avec un motif
  et un guard exacts, ou qu'un `if` a un guard exact.
- Une expression examinée qui est un tuple de variables restreint chaque
  variable à son élément de la valeur mise en correspondance, et la variable
  d'un motif de tuple est liée à la même valeur que l'élément de l'expression
  examinée à sa position
  (`case {X, Y} of {A, b} when is_integer(A) -> ...` restreint `X` et `Y`).
- Un `try ... of` dépend de ses clauses `of` ; ses clauses catch peuvent
  suivre n'importe quelle valeur de son corps, donc leurs valeurs jointes se
  joignent à la valeur de chaque clause
  (`try X of 1 -> one; _ -> other catch _:_ -> error end` donne
  `$try_of_operator(X :: 1) -> error | one; (X :: _) -> error | other`).
- `receive` et `maybe ... else` restent la jonction de leurs clauses : leurs
  clauses font correspondre un message ou une valeur `?=` en échec que rien en
  dehors d'eux ne peut nommer, donc aucune lecture ne pourrait choisir parmi
  elles.
- Une clause dont la valeur est elle-même dépendante (un `case` ou un `if`
  imbriqué, ou une lecture d'une variable dépendante) contribue un type de
  fonction par clause de celle-ci sur l'union des deux listes de paramètres,
  entrées intersectées. Les types dans lesquels on ne peut jamais entrer (une
  entrée `none()`, ou au sein des entrées d'un type exact antérieur) sont
  supprimés, de même que les paramètres dont les faits sont les mêmes dans
  chaque type ; les entrées égales fusionnent et, au-delà de 32 types, les
  derniers fusionnent, comme pour les types de fonction. Une construction dont
  les types restants donnent tous la même valeur, ou qui ne restreint aucun
  paramètre, est sa simple jonction.
- Tout autre consommateur lit le fait effacé, la jonction des valeurs des
  clauses. Les faits qui quittent la fonction parcourue (résultats, types de
  fonction, faits de funs) sont effacés ; les jonctions ne conservent une
  dépendance que lorsque les deux côtés ont la même.
- Une variable liée à une valeur dépendante la conserve. Lire la variable
  sélectionne les clauses dans lesquelles entrent les faits actuels de ses
  paramètres (dans l'ordre de la sélection d'appel, une clause exacte dont les
  entrées les contiennent arrête la sélection) et dont les valeurs
  intersectent le fait restreint propre à la variable, et le fait de la
  lecture est la jonction de leurs valeurs
  (`Y = case X of 1 -> one; _ -> other end, case X of 1 -> Y end` lit `one`).
- Une variable que lie chaque clause d'un `case` ou d'un `if` est la jonction
  de ses faits à la fin des clauses qui se terminent, dépendante des
  paramètres de la construction comme sa valeur :
  `case X of 1 -> Y = 5; _ -> Y = 6 end, Y` infère `(1) -> 5; (_) -> 6`. La
  même jonction s'applique après `receive`, `try` et `maybe`, sans
  dépendance.
- Les opérateurs, les builtins, les constructions de tuple, de liste, de map et
  de record, et les appels de fonctions du lot (leurs types de fonction
  sélectionnés comme dans la sélection d'appel, les arguments n'étant pas
  restreints de nouveau) ayant des opérandes dépendants sont évalués une fois
  par combinaison des clauses des opérandes, avec les valeurs de ces clauses à
  la place des faits des opérandes et leurs entrées intersectées : les
  lectures d'une même variable prennent la même clause, les autres opérandes
  se combinent, avec au plus 16 combinaisons (au-delà, l'usage est la simple
  jonction). `R + 1` avec `R = case X of a -> 1; b -> 2 end` infère
  `(a) -> 2; (b) -> 3`.
- Restreindre une variable dépendante (un motif, un guard, un usage)
  restreint aussi ses paramètres à la jonction des entrées des clauses entrées
  dont les valeurs intersectent le fait restreint, et leurs paramètres à leur
  tour, sur 4 niveaux : après `R = case X of a -> 1; b -> 2 end`,
  `case R of 1 -> X end` lit `X` comme `a`.
- Le résultat dépendant d'une clause de fonction la scinde (voir Types de
  fonction) : les paramètres qui nomment un argument, ou un nom lié à sa
  valeur, sont intersectés avec son entrée ; les autres sont supprimés (un tel
  type n'est exact que si leur entrée est un terme quelconque).
  `nested_case(X, L)` avec `case X of 1 -> case L of spanish -> uno; _ ->
  one end; _ -> other end` infère `(1, spanish) -> uno; (1, _) -> one; (_, _) ->
  other`.
- `--print-types` note une valeur dépendante comme un type de fonction nommé
  d'après sa construction, chaque entrée après le nom de son paramètre :
  `case X of 1 -> one; _ -> other end` se termine par
  `end. % $case_of_operator(X :: 1) -> one; (X :: _) -> other` ; un `if`
  affiche `$if_operator`, un `try ... of` `$try_of_operator`.

### Domaine d'inférence

`semantic/types/lattice`. Un fait est un ensemble de valeurs qu'une variable
ou un résultat peut avoir. Les faits se joignent là où le flot de contrôle se
rejoint (clauses, branches) et s'élargissent entre les tours d'une composante
récursive ; chaque budget ci-dessous élargit de façon sûre vers un ensemble
plus grand, sans jamais rejeter un programme. Les faits s'affichent comme des
types Erlang, les catégories par leurs noms intégrés.

| Fait | Affichage | Jonction | Budget et élargissement |
| --- | --- | --- | --- |
| Rien | `none()` | Élément neutre | Une fonction qui ne retourne jamais reste `none()` |
| N'importe quoi | `term()` | Absorbe tout fait | `dynamic()` et `any()` sont `term()` |
| Entiers | `42`, `1 \| 3 \| 7` | Union de singletons | Plus de 8 singletons deviennent leur plage |
| Plage d'entiers | `1..10`, `0..255` | Plus petite plage contenant les deux | Une borne qui a bougé entre deux tours passe au seuil suivant : une borne inférieure à 1, puis 0, puis non bornée ; une borne supérieure à -1, puis non bornée |
| Entiers non bornés | `pos_integer()` (1 et plus), `non_neg_integer()` (0 et plus), `neg_integer()` (-1 et moins), `integer()` | Plus petit intervalle contenant les deux, affiché par sa catégorie | — |
| Flottants | `float()` | — | — |
| Nombres | `number()` | Une plage ou une catégorie d'entiers jointe avec `float()` | Des entiers singletons avec `float()` restent `1 \| float()` |
| Atomes | `ok`, `error \| ok`, `boolean()` | Union de singletons ; exactement `false` et `true` s'affichent `boolean()` | Plus de 8 singletons deviennent `atom()` |
| Identifiants | `pid()`, `port()`, `reference()` | — | — |
| Tuples | `{ok, 1}`, `tuple()`, `#point{x :: 0, y :: _}` | Les tuples de même taille dont les premiers éléments ne sont pas deux atomes différents (leur étiquette) se joignent élément par élément ; les autres restent des membres séparés | Plus de 16 éléments deviennent `tuple()` sauf si chaque élément est connu ; plus de 8 formes séparées deviennent `tuple()`. Un tuple ayant le nom et la taille d'un record sous forme de tuple visible s'affiche comme le record |
| Listes | `[]`, `[T]`, `[T, ...]`, `nonempty_improper_list(H, T)`, `[1, a]`, `[a, b \| T]` | Les éléments se joignent ; `[]` avec une liste non vide donne une liste éventuellement vide ; les listes impropres joignent têtes et queues. Les listes de deux éléments connus ou plus conservent leurs positions (une notation de Clause, le langage de types n'en a pas, éléments affichés avec `\|` entre parenthèses) : les listes positionnelles d'une même longueur se joignent position par position, sinon elles se joignent comme des listes simples | Une liste de `0..1114111` (`char()`) s'affiche `string()` ou `nonempty_string()` ; une liste éventuellement vide de `_` s'affiche `list()` |
| Maps | `#{}`, `#{a := 1}`, `#{1..17 => a}`, `map()` | Les maps ayant les mêmes clés se joignent valeur par valeur ; les maps d'autres clés se joignent en une seule association de leurs clés et valeurs jointes (`=>` : n'importe quelle clé peut manquer) | Plus de 16 clés se joignent en une seule association |
| Funs | `fun((term()) -> 1)`, `fun()` | Les funs d'une même arité joignent leurs résultats ; d'autres arités donnent `fun()` | — |
| Bitstrings | `<<_:16>>`, `<<_:3, _:_*2>>`, `binary()` | La taille la plus courte plus chaque différence de tailles comme unité | Base et unité 0/8, 8/8, 0/1, 1/1 s'affichent `binary()`, `nonempty_binary()`, `bitstring()`, `nonempty_bitstring()` |

- Une union conserve un membre par forme jointe, dans l'ordre des termes
  Erlang de leurs valeurs : nombres, atomes, `reference()`, funs, `port()`,
  `pid()`, tuples, maps, `[]`, listes, bitstrings, puis types nommés déclarés ;
  plus de 8 membres deviennent `term()`.
- Les conteneurs s'imbriquent sur au plus 4 niveaux ; un fait plus profond
  devient `term()`.
- Une union supprime un membre tuple exact qu'un autre tuple exact de sa
  taille contient (de deux qui se contiennent mutuellement, le premier reste),
  de sorte qu'un même ensemble de valeurs a une seule union et que les
  récursions sur des arbres se stabilisent.
- Les composantes récursives joignent pendant 8 tours (les cycles d'au plus
  8 fonctions convergent exactement), puis élargissent
  ([inférence](#inference)).
- La restriction (`Lattice::meet`) est l'intersection (meet) des faits, les
  valeurs que les deux contiennent (ou plus, mais `none()` seulement
  lorsqu'ils n'en partagent aucune). Une intersection vide signifie que le
  chemin ne peut pas s'exécuter.

En `-O2` avec la spécialisation par type, l'abaissement utilise ces faits pour
supprimer des vérifications ([spécialisation](specialization.md#proofs)) ; les
spécifications ne deviennent jamais des faits.

### Cache d'inférence

Les modules des répertoires du
[cache d'inférence](projects.md#inference-cache) peuvent commencer une
compilation avec les résultats qu'une compilation antérieure a conservés :
résumés, entrées locales et faits d'expressions de leurs fonctions. `infer` les
garde fixes à chaque passe, ne parcourt jamais une composante dont tous les
membres les réutilisent, et parcourt chaque autre fonction comme d'habitude,
en lisant les résumés conservés comme n'importe quels autres.

- **Ce dont dépendent les faits d'un module.** Les fonctions exportées et les
  fonctions que nomme un `fun F/A` partent de `term()` ; les entrées de toute
  autre fonction proviennent de ses appelants, qui sont dans le même module ;
  un fait ne nomme une fonction d'un autre module qu'à travers un atome : un
  appel distant, `fun M:F/A`, ou `apply/2,3` sur un fait d'atome (et ne lit la
  disposition d'un record d'un autre module qu'à travers un native record
  qu'il qualifie ou importe), et chaque fait d'atome provient d'un atome que
  le module écrit ou d'un fait d'un module qu'il atteint. Ainsi les faits d'un
  module ne dépendent que de son propre code et du code des modules du lot que
  ses atomes nomment, transitivement. La clé de ses résultats conservés couvre
  exactement cela : l'identité de `clau`, l'empreinte du module (son source,
  chaque fichier qu'il inclut, les options de prétraitement et une réponse de
  parse transform), les formes prédéfinies, le statut d'escript et de
  bibliothèque, et la même chose pour chaque module du lot qu'atteignent ses
  atomes. Un module ainsi atteint qui n'a pas d'empreinte rend le module non
  cachable.
- **Vivacité.** La vivacité des exports ne fait que supprimer des fonctions, et
  un appelant supprimé ne fait que restreindre les entrées des fonctions qu'il
  appelait : les faits calculés avec davantage de fonctions vivantes restent
  valables. Les résultats conservés sont réutilisés lorsqu'ils contiennent
  chaque fonction vivante actuellement (`results do not fit` sinon) ; les
  fonctions laissées de côté n'obtiennent rien.
- **Mélange.** Des résultats conservés et frais peuvent se rencontrer dans un
  même lot : les faits de chaque module valent pour chaque exécution du
  programme, quoi que disent les faits d'un autre module, de sorte qu'un module
  frais lisant un résumé conservé (ou l'inverse) reste correct. Une composante
  récursive avec des membres des deux sortes est parcourue entièrement.
- **Précision.** Les résultats réutilisés sont ceux de la compilation qui les a
  conservés. Les résultats d'un module frais peuvent tout de même différer de
  ceux d'une compilation sans le cache : le budget de passe ne paie plus pour
  les modules réutilisés, et les identités du graphe, qui ordonnent quelques
  membres d'union, sont numérotées différemment.

## `--print-types`

Affiche chaque module du lot (ordre des entrées/cibles, les modules de
bibliothèque après eux) sous forme de source Erlang
([affichage du source](compile.md#source-printing)) avec ce que l'inférence de
types a trouvé. La sortie va sur stdout et est lisible par un humain ; ce n'est
ni de l'Erlang ni un format d'échange. Les avertissements restent sur stderr.

```erlang
%% module "branches" source="branches.erl" target="" declared=complete inferred=complete
-module(branches).
-export([mixed/1]).

%% inferred: mixed(1) -> 1; (_) -> 2
mixed(X) ->
    case X of
        1 ->
            1;
        _ ->
            2
    end. % $case_of_operator(X :: 1) -> 1; (X :: _) -> 2
```

- Une ligne `%% module` nomme le module, son source, la cible du projet et
  indique si les types déclarés et inférés sont complets ou ont été élargis par
  une limite.
- Les déclarations (`-type`, `-spec`, `-callback`, records) apparaissent telles
  qu'elles sont écrites.
- Au-dessus de chaque fonction, `%% declared: f(Inputs) -> Result` donne chaque
  surcharge de sa `-spec` telle que résolue (avec ses contraintes `when`), et
  `%% inferred: f(Inputs) -> Result` ce que l'inférence a trouvé, de sorte que
  les deux peuvent être comparés. Les entrées sont le domaine de succès de
  chaque argument (à partir de `term()` pour les fonctions exportées et celles
  que nomme `fun F/A`, à partir des arguments joints des appelants pour les
  autres fonctions). Une fonction ayant plusieurs types de fonction affiche une
  signature par type, chacune avec ses propres entrées :
  `f(integer()) -> integer(); (atom()) -> string()`
  (`semantic::types::function_source`). Une `-spec` reste avec la fonction
  juste après elle, séparée des autres formes par une ligne vide.
- L'expression la plus externe de chaque ligne (une expression du corps, ou
  l'expression examinée d'un `case`) dont le fait en dit plus que `term()` est
  annotée par un commentaire final `% Type` après la ponctuation de la ligne
  (un type connu masque une relation avec un argument, qui ne s'affiche que
  pour une valeur connue comme rien d'autre) : au plus une annotation par
  ligne, aucune pour les expressions imbriquées dedans, de sorte que la sortie
  reste de l'Erlang valide. Une expression du corps sur plusieurs lignes porte
  son annotation sur sa dernière ligne (`end, % ...`). Les termes littéraux
  (littéraux, et tuples, listes, maps construites et bitstrings de littéraux)
  ne sont pas annotés ; une correspondance affiche sa valeur. Une valeur
  dépendante s'affiche comme un type de fonction de sa construction
  ([faits dépendants](#dependent-facts)).
- Une valeur que l'inférence a prouvée égale à l'un des arguments de la
  fonction, et connue comme rien de plus, s'affiche sous le nom de cet
  argument, une variable de type : la variable que lui donne la première
  clause qui lie l'argument entier, sinon `_argumentN` (à partir de 1, y
  compris lorsqu'un argument antérieur a pris le nom). L'entrée de l'argument
  affiche le même nom lorsqu'elle est un terme quelconque : `second(_, Y) -> Y`,
  `keep(Acc, number()) -> Acc`. Une variable n'affiche que son type, son nom
  disant déjà de quel argument il s'agit.

### Attentes de l'inférence

`tests/fixtures/inference/*.erl` consignent ce que l'inférence devrait trouver
pour chaque fonction, et ce qu'elle trouve aujourd'hui. Chaque module devient
le test CTest `inference_<module>` (`tests/compiler/inference/expectations.py`) :

```erlang
%% expect: sum() -> 3
%% today: sum() -> _
sum() -> 1 + 2.
```

- `expect:` est la signature que `--print-types` devrait afficher dans sa ligne
  `%% inferred:` ; `today:`, présente tant que l'inférence est en deçà, est
  celle qu'il affiche maintenant.
- La vérification compare la sortie avec `today` lorsqu'elle existe, sinon avec
  `expect` ; chaque fonction du module a besoin d'une ligne `expect`. Une ligne
  `today` que l'inférence a rattrapée fait échouer la vérification jusqu'à ce
  qu'elle soit supprimée.
- `expectations.py <clau> <fixture> --record` réécrit les lignes `today` à
  partir de la sortie actuelle (une action de mainteneur : examiner le diff).
- `values.erl` couvre les valeurs littérales et construites, les résultats des
  opérateurs et des builtins, les conteneurs et leurs parties, les funs et
  leurs appels, les entrées locales provenant des appelants, les jonctions et
  plages d'entiers, les relations avec les arguments et les valeurs de
  `try`/`maybe` ; `narrowing.erl` les tests de type, les guards, les motifs,
  les plages de comparaison, les disjonctions et les restrictions qui ne
  doivent pas fuir ; `base_types.erl` une fonction par type de base et type
  intégré du [langage de types](https://www.erlang.org/doc/system/typespec.html),
  dont la `-spec` doit se résoudre et dont le corps produit une telle valeur ;
  `clauses.erl` les types de fonction, la sélection d'appel et l'évaluation
  par appel en deçà et au-delà de leurs budgets ; `dependent.erl` les
  [faits dépendants](#dependent-facts) ; `trees.erl` et `parsers.erl` les
  récursions sur des arbres et les formes de parseurs générés.
- `tests/fixtures/inference/contracts/` contient les vérifications des
  spécifications (CTest `inference_contracts`).

### Affichage des types

`semantic::types::type_source(graph, type)` (`semantic/types/printing`) rend un
type du graphe de types dans la syntaxe des types Erlang : `_` pour un terme
quelconque (`term()`, écrit par `TERM_SOURCE` par concision ; la syntaxe des
types lit `_` comme `any()`), `none()`, atomes et entiers, `1..5`, `{ok, T}`,
`tuple()`, `[T]`, `[T, ...]`, `#{K => V, K := V}`, `#r{f :: T}`,
`<<_:B, _:_*U>>`, `fun((A) -> R)`, `A | B`. Une fun de plusieurs types de
fonction les affiche dans une notation de Clause, `fun((1) -> one;
(_) -> other)` : la syntaxe des types Erlang n'a pas de type de fun surchargé,
et une union de types de fun signifie autre chose. Les entiers d'une union
s'affichent dans l'ordre des valeurs à l'endroit où se trouve son premier
entier, les entiers consécutifs sous forme de plage (`1 | 2 | 3 | 5` s'affiche
`1..3 | 5` ; le fait conserve les singletons). Les types prédéfinis d'`erlang`
perdent leur module ; les références aux types déclarés restent nommées. Un
budget de nœuds borne le texte ; au-delà, et en dessous de 32 niveaux
d'imbrication, `...` les remplace.

```sh
clau --print-types answer.erl client.erl
clau --print-types --project project.toml --target demo --verbose
```
