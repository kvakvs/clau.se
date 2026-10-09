---
source: docs/builtins.md
sourceCommit: 06042fa
sourceSha256: f29dab6160d90187001e7fd8ed997c13236a315dce8c744f9d83072bfdbdaae4
translatedAt: 2026-10-09
---
# Builtins

Plan 11 step 36 (2026-10-07) : le pont de builtins de production. Les builtins
sont des fonctions `erlang` que le runtime implémente en C++. Le runtime les
enregistre par module, fonction et arité ; le code généré les atteint
directement, par des appels dynamiques et sous forme de valeurs fun.

## Quelles builtins existent

Le catalogue du pont `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) liste toutes les
builtins connues à la fois du compilateur et du runtime :

- les BIF de garde : tests de type (`is_atom/1` … `is_tuple/1`,
  `is_function/1,2`), `abs/1`, `bit_size/1`, `byte_size/1`, `ceil/1`,
  `element/2`, `float/1`, `floor/1`, `hd/1`, `length/1`, `map_get/2`,
  `map_size/1`, `is_map_key/2`, `max/2`, `min/2`, `round/1`, `size/1`, `tl/1`,
  `trunc/1`, `tuple_size/1`, `binary_part/2,3` ;
- les opérateurs en tant que fonctions : comparaisons, `not/1`, `and/2`,
  `or/2`, `xor/2`, opérateurs arithmétiques et bit à bit (`erlang:'+'/1,2` …) ;
- `display/1`, `halt/0,1`, `error/1,2,3`, `exit/1`, `throw/1`, `raise/3` et
  `function_exported/3` ;
- accès aux termes (plan step 37) : `setelement/3`, `make_tuple/2,3`,
  `tuple_to_list/1`, `list_to_tuple/1` et les opérateurs de liste `'++'/2` et
  `'--'/2` (`A ++ B`, `A -- B` sont abaissés vers eux) ;
- conversions (plan step 38) : `atom_to_list/1`, `list_to_atom/1`,
  `integer_to_list/1,2`, `list_to_integer/1,2`, `float_to_list/1,2`,
  `binary_to_list/1`, `list_to_binary/1`, `iolist_to_binary/1`
  (`term_to_binary/1` n'est pas retenu) ;
- sortie console (plan step 40) : `io:format/1,2` et `io:put_chars/1`, les
  premières builtins d'un autre module ([io](io.md)) ;
- identités de processus (plan step 42) : `self/0`, `make_ref/0`,
  `pid_to_list/1` et `ref_to_list/1`
  ([pids et références](terms.md#pids-and-references)) ;
- processus (plan step 43) : `spawn/1,3` et `is_process_alive/1`
  ([processus](processes.md)) ; liens et signaux de sortie (step 48) :
  `spawn_link/1,3`, `link/1`, `unlink/1`, `exit/2`, `exit_signal/2`,
  `process_flag/2` ([liens](processes.md#links)) ; moniteurs (step 49) :
  `spawn_monitor/1,3`, `monitor/2`, `demonitor/1,2`
  ([moniteurs](processes.md#monitors)) ; noms enregistrés (step 50) :
  `register/2`, `unregister/1`, `whereis/1`, `registered/0`
  ([noms enregistrés](processes.md#registered-names)) ;
- messages (plan step 45) : `'!'/2` (l'opérateur `!`) et `send/2`
  ([messages](processes.md#messages)).

Les entrées sont seulement ajoutées en fin : l'index d'une entrée est le numéro
que le code généré transmet au service du pont. Un appel qualifié d'une builtin
du catalogue appartenant à un autre module (`io:format(F, A)`) appelle aussi le
pont. Les autres fonctions `erlang` gardent leurs diagnostics :
un appel direct d'une fonction inconnue donne `unknown module erlang`,
`fun erlang:F/A` ou `fun F/A` d'une BIF de garde hors du catalogue (`node/0`) et
`fun erlang:apply/2,3` signalent la capacité indisponible `dynamic calls`.

## Comment les appels les atteignent

| Source | Chemin |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Services en ligne, comme avant le pont |
| `erlang:function_exported(M, F, A)`, `setelement(I, T, V)`, `A ++ B`, `A -- B`, `length(L)` dans un corps (builtins du catalogue sans service en ligne) | Entrées comme une fonction : `CLAUSE_builtin_frame_v1(context, index)` donne le cadre de la builtin, les arguments vont dans les registres ([portions](#portions)) |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externe `erlang:F/A` ; l'enregistrement la lie à la builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` à l'exécution | Le serveur de code cherche d'abord un export du module, puis une builtin |

- `fun F/A` d'une builtin auto-importée que le module ne définit ni ne supprime
  (`-compile({no_auto_import, ...})`) est la fun externe `erlang:F/A`, comme
  dans OTP : `fun abs/1 =:= fun erlang:abs/1` et elle s'affiche comme
  `fun erlang:abs/1`. `halt/0,1`, `setelement/3`, `tuple_to_list/1`,
  `list_to_tuple/1`, les conversions, les builtins de processus et les builtins
  de port `open_port/2`, `port_close/1`, `port_command/2,3`, `port_connect/2`,
  `port_control/3`, `port_to_list/1`, `list_to_port/1` sont auto-importées comme
  celles d'OTP ; `display/1`, `raise/3`, `function_exported/3`,
  `make_tuple/2,3`, `port_info/1,2`, `port_call/2,3` et `ports/0` exigent le
  préfixe `erlang:` ([ports](ports.md#builtins-and-port-messages)).
- Une builtin a un `FrameDescriptor` au corps nul (`BuiltinFrame`). Y entrer
  (`CLAUSE_enter_v1`, `CLAUSE_tail_v1`) n'empile aucun cadre : la builtin
  s'exécute sur les registres et son résultat revient dans le corps de
  l'appelant, de sorte qu'une builtin en position terminale retourne à
  l'appelant de l'appelant.
- Les erreurs sont celles que l'abaissement en ligne lève dans un corps :
  `badarg`, `badarith` pour l'arithmétique, `system_limit`, `{badmap, M}`,
  `{badkey, K}` ; `raise/3` avec une classe ou une pile invalide renvoie
  `badarg`. Elles passent par le canal d'échec vérifié comme toute erreur de
  service.
- L'accès aux termes suit les règles `badarg` d'OTP : `setelement/3` exige un
  petit entier comme index à l'intérieur du tuple ; `make_tuple/2,3` une petite
  taille dans 0..16 777 215, et `make_tuple/3` une liste propre de paires
  `{Index, Value}` dans la taille (les paires suivantes l'emportent) ;
  `list_to_tuple/1` une liste propre ; `A ++ B` une liste propre `A`
  (`[] ++ B` vaut `B` pour tout `B`, un `B` qui n'est pas une liste termine le
  résultat) ; `A -- B` deux listes propres, chaque élément de `B` retirant le
  premier élément exactement égal (`=:=`) de `A`, en O((n + m) log m).
- Les conversions suivent OTP :
  - `list_to_atom/1` prend une liste propre de points de code (sans
    substituts) ; un 256e caractère donne `system_limit` avant d'être vérifié.
    Une table des atomes pleine (`--max-atoms`) arrête le programme par un échec
    du runtime (`resource_limit`, code de sortie 70).
  - `integer_to_list/2` et `list_to_integer/2` prennent une petite base dans
    2..36 ; les chiffres s'affichent en majuscules et s'analysent dans les deux
    casses. `list_to_integer` accepte un signe optionnel, saute les zéros de
    tête, exige un chiffre, et lève `system_limit` au-delà de 1 262 611 chiffres
    décimaux significatifs (ou 4 194 304 dans une base quelconque) une fois ses
    premiers chiffres valides, ainsi que pour une valeur au-delà de la limite
    des entiers.
  - `float_to_list/1` vaut `"%.20e"` ; les options de `/2` s'appliquent dans
    l'ordre, le dernier format l'emportant : `{scientific, D}` (`"%.*e"`, D
    négatif vaut 6), `{decimals, D}` (D >= 0 ; virgule fixe avec l'arrondi
    propre d'OTP sous 2^53 et 19 décimales, `compact` supprime les zéros de fin,
    y compris d'un entier avec `{decimals, 0}` au-delà de 2^53), `short`
    (chiffres de l'aller-retour le plus court selon le choix fixe/scientifique
    d'OTP). Un texte de 256 octets ou plus donne `badarg`.
  - `binary_to_list/1` exige un binary ; `list_to_binary/1` une liste et
    `iolist_to_binary/1` une liste ou un binary d'octets, de binaries et de
    listes imbriquées, chaque liste se terminant par `[]` ou un binary.
- `function_exported(M, F, A)` lève `badarg` sauf si `M` et `F` sont des atomes
  et `A` un petit entier ; elle est vraie quand un module du programme exporte
  `M:F/A` ou que `M:F/A` est une builtin enregistrée.

## Portions

Plan 11 step 43A (2026-10-08) : les builtins dont le travail croît avec un
argument liste ou binary s'exécutent par portions bornées, comme les BIF
d'OTP qui font un trap, afin qu'une builtin longue ne puisse pas empêcher les
autres processus de s'exécuter ([processus](processes.md)).

- Toute builtin du pont appelée par un corps est entrée comme une fonction et
  consomme une réduction. Une portion peut effectuer `WORK_PER_REDUCTION` (16)
  unités de travail par réduction restante dans la tranche de temps (au moins
  l'équivalent d'une réduction) : cellules de liste parcourues ou construites,
  comparaisons, octets. Elle les paie sur la tranche.
- Une builtin à qui il reste du travail fait un trap : `ProcessStack::trap`
  désigne un cadre de continuation et place les termes d'état de la builtin
  dans les registres, qui restent des racines ; l'état natif (octets, positions
  de tri, mots de termes gardés comme racines) vit dans le `TrapState` de la pile
  du processus. Le processus cède la main et reprend à la continuation dans une
  tranche ultérieure. Les ramassages entre portions réécrivent les registres et
  les mots d'état comme les autres racines.
- Les résultats, les erreurs et l'ordre d'évaluation sont les mêmes qu'avec une
  exécution jusqu'au bout. Une erreur détectée tardivement (une queue impropre)
  est levée quand le parcours l'atteint.
- Les appels de l'hôte (`call_builtin`) poursuivent immédiatement chaque trap.

| Builtin | Portions |
| --- | --- |
| `length/1` dans un corps | Compte les cellules ; dans une garde, elle reste le service en ligne, car la BIF de garde d'OTP ne fait pas de trap |
| `A ++ B` | Collecte les éléments de `A`, puis construit la copie sur `B` en partant de la fin |
| `A -- B` | Collecte `B`, le trie selon l'ordre exact (tri fusion ascendant), parcourt `A` avec une recherche dichotomique par élément, puis construit les éléments conservés ; si rien n'est retiré, le résultat est `A` lui-même |
| `binary_to_list/1` | Construit la liste depuis la fin du binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Parcourt l'iolist en profondeur d'abord, puis crée le binary d'un coup |

Les autres builtins s'exécutent jusqu'au bout. Les builtins de tuple
(`setelement/3`, `make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) font
comme dans OTP : leur travail est borné par la limite d'arité des tuples. Les
conversions restantes lisent des entrées bornées par les limites des atomes, des
entiers et des flottants. Le formatage avec `io:format/1,2` s'exécute jusqu'au
bout ([différences](differences.md)). Les services en ligne des boucles
(l'inversion finale d'une comprehension) s'exécutent jusqu'au bout dans le cadre
de la boucle.

## Builtins typées

Plan 11 step 41 (2026-10-07) : les builtins qui vérifient elles-mêmes leurs
arguments sont des fonctions C++ à paramètres typés
([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, enregistrées avec
`typed_entry<Function>(module, name)` (l'arité est le nombre de paramètres).

- L'adaptateur admet chaque mot d'argument dans l'ordre (un mot que ce
  processus ne possède pas est l'échec correspondant, jamais `badarg`), puis
  convertit chacun vers le type de son paramètre ; une non-correspondance lève
  `badarg` et la fonction ne s'exécute pas.
- Types de paramètres : `Term` (tout terme, le repli générique), `std::int64_t`
  (un petit entier), `detail::Integer` (tout entier), `double` (un flottant),
  `ListArgument` (une liste propre et ses éléments), `TupleArgument`,
  `BinaryArgument` (les octets d'un binary), `AtomArgument` (son orthographe).
- Résultats : `Term`, `TermResult<Term>` (une construction ratée est un échec du
  runtime), `BuiltinResult<Term>` (`std::expected` avec un `BuiltinFailure`), ou
  un `Word` brut que la fonction a publié elle-même. Une fonction peut aussi
  lever `BuiltinFailure` (une erreur Erlang telle que `badarg` ou
  `system_limit`, ou un échec d'accès à un terme) ; `call_builtin` transforme
  toute autre exception C++ en `out_of_memory` ou `internal_error`, de sorte
  qu'aucune ne traverse l'ABI du code généré.
- Les familles d'accès aux termes, de conversion et d'io, `binary_part/2` et
  `function_exported/3` sont typées. Les autres builtins `erlang` transmettent
  leurs mots d'argument non convertis aux services en ligne que le code généré
  appelle aussi, et qui les admettent ; elles restent des adaptateurs
  `BuiltinBody` au niveau des mots.

## Enregistrement

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  détenu par le `CodeServer`, associe module/fonction/arité exacts à un
  `BuiltinFrame`. `add` prend un lot de `BuiltinEntry` et les enregistre toutes
  ou aucune : un nom vide, plus de 255 arguments, une implémentation manquante
  ou un nom déjà enregistré (ou répété dans le lot) rejette le lot sans rien
  conserver.
- Le démarrage du runtime enregistre chaque table de `production_builtins()`
  (`erlang_builtins()`, `term_access_builtins()`, `conversion_builtins()`,
  `io_builtins()`), la plupart des entrées étant créées par `typed_entry`,
  qui couvrent ensemble le
  catalogue ; les familles ultérieures ajoutent leurs propres tables.
- Un corps lit exactement autant de mots d'argument que son arité et consigne
  les erreurs dans le canal vérifié ; les exceptions de l'hôte deviennent des
  échecs `out_of_memory` ou `internal_error`.
- L'ancien chemin hôte `abi::v1::dispatch_builtin` (modules natifs enregistrés
  par l'hôte par nom, [runtime](runtime.md#code-server-and-builtins)) est
  distinct et inchangé.
