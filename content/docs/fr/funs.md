---
source: docs/funs.md
sourceCommit: a8c3f8f6
sourceSha256: 114573ca575f133c3b45d3422218a8b98264b55c30167b405bb3008e3806c74e
translatedAt: 2026-10-17
---
# Valeurs fonctionnelles

`fun F/A`, `fun M:F/A`, funs anonymes avec variables capturées (fermetures,
closures), funs nommées (`fun Name(...) -> ... end`), appels de valeurs
fonctionnelles (`F(Args)`) et appels dynamiques (`M:F(Args)`, `apply/2,3`). Les
faits proviennent des sources épinglées de `maint-29`
(`erts/emulator/beam/utils.c` `erts_cmp`, `erl_printf_term.c`, `erl_lint`) et
de sondages sur OTP 29.1.1.

## Valeurs

| Source | Valeur | Les appels entrent dans |
| --- | --- | --- |
| `fun f/1` | Fun locale de ce module ; chaque `fun f/1` d'un module est la même valeur | `f/1` de ce module, exportée ou non |
| `fun m:f/1` | Fun externe désignant `m:f/1`, y compris pour le module courant | `m:f/1` quand un module du programme l'exporte |
| `fun(X) -> ... end` | Fun locale capturant les variables qu'elle lit chez son créateur ; chaque évaluation construit une nouvelle valeur | La fonction générée propre à la fun |
| `fun Name(X) -> ... end` | Idem, avec `Name` lié à la fun à l'intérieur de ses clauses | La fonction générée propre à la fun |
| `fun M:F/A` avec des variables | Fun externe construite à l'évaluation ; égale à la fun littérale `fun m:f/1` qu'elle désigne | `m:f/1` quand un module du programme l'exporte |

- `fun F/A` doit désigner une fonction du module (`function F/A undefined`) ou
  un builtin auto-importé : `fun is_atom/1` est la fun externe
  `erlang:is_atom/1`. Les funs de builtins les appellent via le
  [pont des builtins](builtins.md) ; une `fun erlang:F/A` littérale d'une
  fonction hors du catalogue (`fun erlang:apply/2`) signale la capacité
  indisponible `dynamic calls`.
- `F(Args)` évalue `F`, puis les arguments de gauche à droite, puis vérifie la
  valeur : une non-fonction lève `{badfun, F}`, une autre arité
  `{badarity, {F, Args}}` (vérifiée avant le module), une fun externe dont
  aucun module du programme n'exporte la fonction `undef`. Un appel en position
  terminale est un appel terminal, comme pour les fonctions nommées.
- `is_function/1,2` sont vraies pour les funs dans les corps et les guards.

## Appels dynamiques

- `M:F(Args)` avec une variable (ou toute expression) comme module ou fonction
  évalue le module, puis la fonction, puis les arguments de gauche à droite. Un
  module ou une fonction qui n'est pas un atome lève `badarg` ; une fonction
  qu'aucun module du programme n'exporte avec cette arité lève `undef`. Un
  appel en position terminale est un appel terminal.
- `apply(Fun, Args)` et `apply(M, F, Args)` (auto-importées sauf si le module
  définit `apply/2,3` ou supprime l'import ; également `erlang:apply/2,3`)
  évaluent leurs arguments, puis exigent que `Args` soit une liste propre
  (`badarg`). `apply/2` appelle ensuite `Fun` comme le fait `F(Args)`
  (`{badfun, Fun}`, `{badarity, {Fun, Args}}`) ; `apply/3` recherche
  `M:F/length(Args)` comme ci-dessus, donc plus de 255 arguments lèvent
  `undef`. Les deux sont des appels terminaux en position terminale et ne sont
  jamais légaux dans les guards.
- `fun M:F/A` avec des variables lève `badarg` sauf si `M` et `F` sont des
  atomes et `A` un entier dans 0..255 ; la fonction n'a pas besoin d'exister
  avant l'appel de la fun.
- La recherche utilise les index par hachage des exports du programme tenus
  par le serveur de code ([runtime](runtime.md#code-server-and-builtins)), qui
  restent enregistrés pendant toute la durée de vie du programme, de sorte
  qu'une fonction trouvée ne peut pas disparaître pendant l'appel. Un nom
  qu'aucun module n'exporte est ensuite recherché parmi les
  [builtins](builtins.md), de sorte que `M:F(...)`, `apply/3` et `fun M:F/A` à
  l'exécution atteignent les builtins du catalogue du pont.
- **Services.** `CLAUSE_call_v1(context, module, function, arity)` vérifie les
  noms et renvoie le `FrameDescriptor` de l'export (tiré de son
  `ExportDescriptor`) ; les arguments sont déjà dans les registres.
  `CLAUSE_apply_list_v1(context, fun, list, registers)` et
  `CLAUSE_call_list_v1(context, module, function, list, registers)` copient
  d'abord la liste dans les registres. Les trois renvoient null après avoir
  consigné l'erreur, et le code généré effectue alors un transfert via le
  marqueur `clause.apply` comme pour `F(Args)`. `CLAUSE_make_external_fun_v1`
  construit la fun d'une `FunDefinition` externe que le serveur de code crée
  une seule fois par `M:F/A` (`CodeServer::external_fun`).

## Fermetures

- Chaque clause part de la portée au niveau de la fun. Les variables de tête
  sont de nouveaux noms qui masquent les noms extérieurs (OTP avertit) ; un nom
  répété dans une même tête doit correspondre. Les guards lisent les noms de la
  tête. Rien de ce qu'une fun lie n'est visible après elle, et les noms des
  clauses de case de la fonction englobante n'y pénètrent pas.
- Une fun capture toute définition extérieure que ses têtes, guards ou corps
  lisent (funs imbriquées comprises), dans l'ordre de définition, comme OTP
  ordonne les variables libres d'une fonction. Les valeurs capturées sont
  copiées dans la cellule de la fun lors de l'évaluation de l'expression fun,
  de sorte qu'elles survivent au retour du créateur et aux ramassages, et sont
  copiées avec la fun.
- Le code est une fonction privée `-f/A-fun-N-` (N compte les funs de `f/A`
  dans l'ordre du source) qui prend les arguments de la fun, puis ses valeurs
  capturées ; les traces de pile montrent ce nom avec l'arité combinée, comme
  celles d'OTP. L'absence de clause correspondante lève `function_clause`.
- Les arguments plus les valeurs capturées sont limités à 255.
- Les clauses d'une fun nommée voient `Name` comme la fun elle-même : un
  nouveau nom qui masque un nom extérieur (OTP avertit), jamais capturé et
  invisible après la fun. Une variable de tête du même nom le masque à son
  tour. Quand une clause lit `Name`, le code de la fun construit la valeur à
  l'entrée à partir de ses valeurs capturées, de sorte qu'elle est égale
  (`=:=`) à la fun appelée, et `Name(...)` est un appel de fun ordinaire : en
  position terminale, c'est un appel terminal qui s'exécute en pile constante.
- Une fun anonyme dans la valeur par défaut d'un champ de record est une seule
  fun pour toutes les constructions qui utilisent la valeur par défaut (OTP
  développe une copie par site).

## Représentation

- **Descripteur.** Chaque valeur distincte qu'un module crée se compile en un
  `abi::v1::FunDescriptor` dans la table privée `<prefix>.funs` du module
  ([funs.hpp](../abi/include/clause/abi/funs.hpp)) : descripteur de module,
  emplacements d'atomes du module et de la fonction, arité Erlang, index,
  indicateur externe et le `FrameDescriptor` dans lequel entre un appel (null
  pour une fun externe hors du programme). L'enregistrement les lie à des
  `FunDefinition` (`ModuleAtoms::funs`, `CodeServer::fun_definition`) ; le
  nombre de valeurs capturées d'une fun locale est l'arité de son code moins
  celle de la fun.
- **Cellule.** Type boxé `fun_closure` : en-tête (nombre `1 + n`), un
  `const FunDefinition *` non tracé, puis `n` valeurs capturées. Le parcours,
  le ramassage, la copie et la vérification sautent le mot de définition, comme
  pour les native records.
- **Services.** `CLAUSE_make_fun_v1(context, descriptor, captures, count,
  output)` construit une fun. `CLAUSE_apply_v1(context, fun, arity, arguments)`
  vérifie une valeur appelée, consigne les erreurs ci-dessus dans le canal
  d'échec (`ErrorReason` 22-24) et sinon ajoute les valeurs capturées après les
  arguments et renvoie le `FrameDescriptor` dans lequel entrer.
- **Fermetures inline.** Le runtime qui revendique le cache d'atomes d'un
  module remplit aussi `ModuleDescriptor::fun_cache` avec l'adresse de la
  définition de chaque fun ; tant que la revendication est la sienne, le code
  généré alloue lui-même la cellule de la fun (en-tête, définition, valeurs
  capturées) par incrément de pointeur et n'appelle `CLAUSE_make_fun_v1`
  qu'en l'absence de place sur le tas ou dans un autre runtime.
  `CLAUSE_apply_v1` et `CLAUSE_apply_list_v1` lisent une fun de la bonne arité
  (et la liste d'arguments) directement dans ses cellules avant le chemin
  vérifié qui signale les erreurs.
- **Appels.** La forme native passe les arguments dans un tableau de mots et
  appelle le marqueur `clause.apply` avec le descripteur ; `lower_frames` fait
  du tableau les registres du processus et du marqueur une entrée ou, en
  position terminale, un transfert terminal
  ([modèle d'exécution](execution-model.md#implementation)).

## Comparaison et affichage

- Les funs se rangent après les références et avant les ports
  ([ordre des termes](terms.md#comparison-and-order)).
- Les funs locales se rangent avant les funs externes. Les funs locales se
  comparent par module, puis index, puis valeurs capturées dans l'ordre (`==`
  les compare avec `==`) ; les funs externes par module, fonction et arité. Des
  descripteurs égaux donnent des valeurs égales, donc `fun f/1 =:= fun f/1`.
- `erlang:display/1`, `~w` et les rapports d'exception non capturée affichent
  une fun externe sous la forme `fun m:f/1` (atomes entre guillemets comme le
  fait l'émulateur) et une fun locale sous la forme `#Fun<m.Index.0>`.

## Différences

La numérotation, l'affichage et l'ordre des funs, l'ordre de capture dans les
comprehensions, les traces de pile `undef` et les appels de modules hors du
programme diffèrent d'OTP comme consigné dans [différences](differences.md).

## Informations sur les funs

`runtime/src/builtins/erlang/fun_info.cpp`. `erlang:fun_info/1` liste les
éléments d'OTP dans l'ordre d'OTP : pour une fun locale `pid`, `module`,
`new_index`, `new_uniq`, `index`, `uniq`, `name` (`-F/A-fun-N-` pour une fun
anonyme), `arity`, `env` (les valeurs capturées) et `type` ; pour
`fun M:F/A` `module`, `name`, `arity`, `env` (`[]`) et `type`. `fun_info/2`
renvoie un seul `{Item, Value}` ; un élément inconnu donne `badarg`. `pid`
vaut `undefined`, `new_uniq` est le MD5 du nom du module et `uniq` ses 24
premiers bits, de sorte qu'ils diffèrent de ceux d'OTP. `fun_to_list/1` est le
texte `~w`. `is_builtin/3` est vrai pour les builtins du runtime et
`erlang:apply/2,3`.
