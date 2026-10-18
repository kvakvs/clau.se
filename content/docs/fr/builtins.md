---
source: docs/builtins.md
sourceCommit: 336caea7
sourceSha256: c5d99568a38fc1f7bc865c63163039a8c2acba8d978636c0b9290afdf0b9a637
translatedAt: 2026-10-18
---
# Builtins

Les builtins sont des fonctions que le runtime implémente en C++ : les BIF
d'`erlang` et les fonctions d'autres modules dont les équivalents d'OTP sont des
BIF, des NIF ou ont besoin du runtime (sortie `io`, fonctions de données de
`lists`, `math`, `binary`, ...). Le runtime les enregistre par module, fonction
et arité ; le code généré les atteint directement, par des appels dynamiques et
sous forme de valeurs fun.

## Quelles builtins existent

Le catalogue du pont `abi::v1::bridge_builtins`
([builtins.hpp](../abi/include/clause/abi/builtins.hpp)) liste toutes les
builtins connues à la fois du compilateur et du runtime, en groupes dont les
commentaires nomment le fichier source qui les implémente :

- module `erlang` : les BIF de guard, les opérateurs en tant que fonctions
  (`erlang:'+'/2`, `'++'/2`, `'--'/2`, ...), `display/1`, `halt/0,1`, les
  fonctions qui lèvent des exceptions, l'accès aux termes, les conversions,
  les identités de processus, les [processus](processes.md) (création,
  messages, liens, moniteurs, noms enregistrés, dictionnaire de processus,
  minuteries, introspection, options de spawn, alias, nœuds), les
  [ports](ports.md#builtins-and-port-messages), le
  [format de termes externe](#external-term-format), le [temps](#time), les
  [informations système](#system-information), les
  [informations sur les funs](funs.md#fun-information), le
  [hachage](#hashing) et le [chargement de code](#code-loading) ;
- autres modules : sortie `io` ([io](io.md)), les fonctions de données de
  [`lists`](#lists-module), [`math`](#math-module),
  [`binary`](#binary-module), [`maps` et `os`](#maps-module),
  [`ordsets`, `orddict`, `proplists`, `dict`, `sets`, `gb_trees`, `gb_sets`,
  `queue` et `array`](#collections), [`base64` et `json`](#encodings),
  [`calendar`](#calendar), [`filename`](#filename),
  [`uri_string`](#uri-string), [`string`](#string),
  [`rand` et `random`](#random-numbers),
  [`persistent_term`](#persistent-terms), [`unicode`](#unicode-module),
  [`code`](#code-module), [`init`](#init-module),
  [`atomics`](#atomics-and-counters), [`erts_internal`](#erts-internal),
  [`unicode_util`](#unicode-util) et [`re`](#re-module) ;
- modules privés sous le code de bibliothèque Erlang : `clause_unicode`,
  `clause_re`, `clause_zlib` ([zlib](#zlib-module)) et `clause_receive`
  ([prim eval](#prim-eval)).

Le fait qu'une fonction d'un module de bibliothèque soit une builtin, un corps
Erlang ou un bouchon (stub) est consigné dans son inventaire
`library/<application>/<module>.terms` ([bibliothèque](library.md#files)) ;
celui d'`erlang` est [erlang.terms](#erlang-module).

L'index d'une entrée est le numéro que le code généré transmet au service du
pont ; le compilateur et le runtime sont compilés ensemble, donc le catalogue
peut être réordonné. Un appel qualifié d'une builtin du catalogue de n'importe
quel module (`io:format(F, A)`) appelle le pont. Toute autre fonction `erlang`
atteint le [module de bibliothèque erlang](#erlang-module).

## Comment les appels les atteignent

| Source | Chemin |
| --- | --- |
| `abs(X)`, `X + Y`, `erlang:display(X)`, `halt()`, `error(R)` | Code en ligne ou service dédié du runtime |
| `erlang:function_exported(M, F, A)`, `A -- B` dans un corps (builtins du catalogue sans service en ligne) | Entrées comme une fonction : `CLAUSE_builtin_frame_v1(context, index)` donne le cadre de la builtin, les arguments vont dans les registres ([portions](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (builtins directes : jamais de trap, d'attente ni d'action sur un autre processus) | Appelées immédiatement : `CLAUSE_builtin_call_v1(context, index, arguments)` renvoie le résultat ([ABI](abi.md#runtime-services)) |
| `length(L)`, `binary_to_list(B)`, `list_to_binary(L)`, `iolist_to_binary(L)` (builtins rapides) | `CLAUSE_builtin_call_v1` exécute un chemin rapide borné sur les mots d'arguments (au plus 256 cellules, éléments ou octets, 4096 octets de résultat) ; il renvoie 0 pour les entrées plus longues, les autres formes et les erreurs, et l'appel entre alors dans le cadre du builtin |
| `A ++ B` | Un `A` propre et court est copié en ligne ; sinon entrée comme une fonction ([ABI](abi.md#frames-and-transfers)) |
| `fun abs/1`, `fun erlang:'+'/2` | Fun externe `erlang:F/A` ; l'enregistrement la lie à la builtin |
| `M:F(Args)`, `apply(M, F, Args)`, `fun M:F/A` à l'exécution | Le serveur de code cherche d'abord un export du module, puis une builtin |

- `fun F/A` d'une builtin auto-importée que le module ne définit ni ne supprime
  (`-compile({no_auto_import, ...})`) est la fun externe `erlang:F/A`, comme
  dans OTP : `fun abs/1 =:= fun erlang:abs/1` et elle s'affiche comme
  `fun erlang:abs/1`. Les auto-imports sont ceux d'OTP (indicateur
  `auto_import` dans [erlang.terms](#erlang-module)) ; les autres, comme
  `display/1`, `raise/3`, `function_exported/3`, `make_tuple/2,3`,
  `port_info/1,2`, `port_call/2,3` et `ports/0`, exigent le préfixe
  `erlang:`.
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
    Une table des atomes pleine (`--max-atoms`) arrête le programme par un
    échec du runtime (`resource_limit`, code de sortie 70).
  - `integer_to_list/2` et `list_to_integer/2` prennent une petite base dans
    2..36 ; les chiffres s'affichent en majuscules et s'analysent dans les deux
    casses. `list_to_integer` accepte un signe optionnel, saute les zéros de
    tête, exige un chiffre, et lève `system_limit` au-delà de 1 262 611
    chiffres décimaux significatifs (ou 4 194 304 dans une base quelconque)
    une fois ses premiers chiffres valides, ainsi que pour une valeur au-delà
    de la limite des entiers.
  - `float_to_list/1` vaut `"%.20e"` ; les options de `/2` s'appliquent dans
    l'ordre, le dernier format l'emportant : `{scientific, D}` (`"%.*e"`, D
    négatif vaut 6), `{decimals, D}` (D >= 0 ; virgule fixe avec l'arrondi
    propre d'OTP sous 2^53 et 19 décimales, `compact` supprime les zéros de
    fin, y compris d'un entier avec `{decimals, 0}` au-delà de 2^53), `short`
    (chiffres de l'aller-retour le plus court selon le choix fixe/scientifique
    d'OTP). Un texte de 256 octets ou plus donne `badarg`.
  - `binary_to_list/1` exige un binary ; `list_to_binary/1` une liste et
    `iolist_to_binary/1` une liste ou un binary d'octets, de binaries et de
    listes imbriquées, chaque liste se terminant par `[]` ou un binary.
  - Les jumelles binary (`atom_to_binary/1,2`, `binary_to_integer/1,2`,
    `float_to_binary/1,2`, `list_to_float/1`, ...) partagent ces règles de
    texte (`erlang/conversion_text.cpp`) : le texte d'un flottant exige des
    chiffres des deux côtés du point (`list_to_float("1e10")` donne
    `badarg`), un exposant hors de la plage donne `badarg` et un dépassement
    inférieur `0.0` ; les encodages sont `utf8`, `unicode` et `latin1`.
- `function_exported(M, F, A)` lève `badarg` sauf si `M` et `F` sont des
  atomes et `A` un petit entier ; elle est vraie quand un module du programme
  exporte `M:F/A` ou que `M:F/A` est une builtin enregistrée.

## Portions

Les builtins dont le travail croît avec un argument liste ou binary s'exécutent
en portions bornées, comme les BIF d'OTP qui font un trap, de sorte qu'une
builtin longue ne peut pas empêcher d'autres processus de s'exécuter
([processus](processes.md)).

- Chaque builtin du pont qu'un corps appelle est entrée comme une fonction et
  dépense une réduction. Une portion peut effectuer `WORK_PER_REDUCTION` (16)
  unités de travail par réduction restant dans la tranche de temps (au moins
  l'équivalent d'une réduction) : cellules de liste parcourues ou construites,
  comparaisons, octets. Elle les paie sur la tranche.
- Une builtin à qui il reste du travail fait un trap : `ProcessStack::trap`
  nomme un cadre de continuation et place les termes d'état de la builtin dans
  les registres, qui restent des racines ; l'état natif (octets, positions de
  tri, mots de termes gardés comme racines) vit dans le `TrapState` de la pile
  du processus. Le processus cède la main et reprend à la continuation dans
  une tranche ultérieure. Les collectes entre les portions réécrivent les
  registres et les mots d'état comme les autres racines.
- Une builtin peut aussi continuer dans un export Erlang : la sortie `io` vers
  un périphérique processus fait un trap vers `file:write/2`
  ([io](io.md#calls)).
- Les résultats, les erreurs et l'ordre d'évaluation sont les mêmes qu'avec
  une exécution jusqu'au bout. Une erreur trouvée tardivement (une queue
  impropre) est levée quand le parcours l'atteint.
- Les appels de l'hôte (`call_builtin`) poursuivent chaque trap immédiatement.
- Les parcours de listes valident la liste une seule fois et lisent ses
  cellules comme des mots. Les petites entrées prennent des chemins rapides au
  niveau des mots, sans état de portion : `Left ++ Right` avec au plus
  64 cellules dans `Left`, `integer_to_list/1` d'un petit entier,
  `list_to_integer/1` d'une chaîne décimale courte, `atom_to_list/1`,
  `list_to_tuple/1` et `tuple_to_list/1`.

| Builtin | Portions |
| --- | --- |
| `length/1` dans un corps | Compte les cellules ; dans un guard, elle reste le service en ligne, car la BIF de guard d'OTP ne fait pas de trap |
| `A ++ B` | Collecte les éléments de `A`, puis construit la copie sur `B` à partir de sa fin |
| `A -- B` | Collecte `B`, le trie selon l'ordre exact (tri fusion ascendant), parcourt `A` avec une recherche dichotomique par élément, puis construit les éléments conservés ; quand rien n'est retiré, le résultat est `A` lui-même |
| `binary_to_list/1` | Construit la liste à partir de la fin du binary |
| `list_to_binary/1`, `iolist_to_binary/1` | Parcourt l'iolist en profondeur d'abord, puis crée le binary d'un coup |

Les autres builtins s'exécutent jusqu'au bout. Les builtins de tuples
(`setelement/3`, `make_tuple/2,3`, `tuple_to_list/1`, `list_to_tuple/1`) font
comme dans OTP : leur travail est borné par la limite d'arité des tuples. Les
conversions restantes lisent des entrées bornées par les limites des atomes,
des entiers et des flottants. Le formatage avec `io:format/1,2` s'exécute
jusqu'au bout ([différences](differences.md)). Les services en ligne des
boucles (le renversement final d'une comprehension) s'exécutent jusqu'au bout
dans le cadre de la boucle.

## Builtins typées

Les builtins qui vérifient leurs propres arguments sont des fonctions C++ à
paramètres typés ([typed.hpp](../runtime/src/builtins/typed.hpp)),
`Result Function(ProcessContext &, Parameters...)`, enregistrées avec
`typed_entry<Function>(module, name)` (l'arité est le nombre de paramètres).

- L'adaptateur admet chaque mot d'argument dans l'ordre (un mot que ce
  processus ne possède pas est l'échec qu'il est, jamais `badarg`), puis
  convertit chacun vers le type de son paramètre (`Term`, un petit entier ou
  un entier quelconque, `double`, des arguments liste, tuple, binary, atome,
  map ou pid local ; voir `typed.hpp`) ; une non-correspondance lève `badarg`
  et la fonction ne s'exécute pas. `Named<Role>` est un terme quelconque
  sous son propre type de rôle (`collections::Key`, `Value`, `List`, ...),
  afin que deux paramètres ne puissent être intervertis dans un builtin ayant
  plusieurs paramètres de terme ; le builtin vérifie le terme.
- Une fonction renvoie un terme, un `BuiltinResult` (`std::expected` avec un
  `BuiltinFailure`) ou un `Word` brut qu'elle a publié elle-même, ou lance
  `BuiltinFailure` (une erreur Erlang ou un échec d'accès aux termes) ;
  `call_builtin` transforme toute autre exception C++ en `out_of_memory` ou
  `internal_error`, de sorte qu'aucune ne traverse l'ABI du code généré.
- La plupart des familles sont typées. Les BIF de guard et les opérateurs
  (`erlang/core.cpp`), les builtins de listes qui font un trap et quelques
  autres sont des adaptateurs `BuiltinBody` au niveau des mots, qui
  transmettent leurs mots d'arguments aux services en ligne que le code généré
  appelle aussi. Les conversions fréquentes lisent sur place les cellules
  de leurs arguments (`TermAccess::trusted`) au lieu d'admettre des `Term` :
  `tuple_to_list/1`, `phash2/1` (listes, tuples et petits entiers), ainsi que
  `list_to_atom/1`, `list_to_integer/1` sur de courtes chaînes ASCII, et
  `binary:part/2,3`, un builtin direct dont le résultat court est écrit
  directement dans les mots du tas (arguments de builtin au niveau des mots).

## Enregistrement

- `BuiltinRegistry` ([builtin_registry.hpp](../runtime/include/clause/runtime/builtin_registry.hpp)),
  détenu par le `CodeServer`, associe un module/une fonction/une arité exacts à
  un `BuiltinFrame`. `add` prend un lot de `BuiltinEntry` et les enregistre
  toutes ou aucune : un nom vide, plus de 255 arguments, une implémentation
  manquante ou un nom déjà enregistré (ou répété dans le lot) rejette le lot
  sans rien conserver.
- Le démarrage du runtime enregistre chaque table de famille de
  `production_builtins()` (`builtins/registry.cpp`), qui couvrent ensemble le
  catalogue.
- Les builtins sont collantes : quand un module s'enregistre, le serveur de
  code ignore chaque export qui porte le nom d'une builtin enregistrée, de
  sorte que `M:F(Args)`, `apply/3` et les funs externes se lient à la builtin,
  jamais au corps `clause_builtin_placeholder` d'un module de bibliothèque
  ([corps de substitution](library.md#provided-or-missing)) ni à une fonction
  utilisateur de même nom.
- Un corps lit exactement son arité en mots d'arguments et consigne les
  erreurs dans le canal vérifié ; les exceptions de l'hôte deviennent des
  échecs `out_of_memory` ou `internal_error`.
- Le chemin de l'hôte `abi::v1::dispatch_builtin` (modules natifs enregistrés
  par l'hôte, par nom, [runtime](runtime.md#code-server-and-builtins)) est
  distinct.

## Organisation des sources

- Le runtime implémente les builtins dans `runtime/src/builtins/`. Un gros
  module a son propre sous-répertoire avec une unité de traduction par famille
  de builtins (`erlang/`, `lists/`, `binary/`, `unicode/`, `re/`, `zlib/`) ;
  les petits modules et l'infrastructure du pont (`registry`, `bridge`,
  `portions`, `typed`, formatage du texte et des flottants) sont des fichiers
  uniques.
- Chaque fichier de famille définit sa propre table `*_builtins()` listée dans
  `production_builtins()`. Une nouvelle famille ajoute un nouveau fichier et
  une nouvelle table au lieu d'agrandir ceux qui existent ; un fichier qui
  dépasse environ 400 lignes est découpé par famille avant de grossir
  davantage.
- Le compilateur ne lit jamais les sources du runtime : le catalogue
  `abi::v1::bridge_builtins` est l'unique liste que les deux côtés partagent ;
  ses commentaires de groupe nomment le fichier qui les implémente.

## Module erlang

Le compilateur sait quelles fonctions `erlang` existent grâce à deux sources
propres au projet, jamais grâce au code du runtime :

- `library/erts/erlang.terms` : les exports d'`erlang` d'OTP 29 sous la forme
  `{Name, Arity, Flags, Status}` (indicateurs `auto_import`, `guard` ; état
  `implemented` ou `{unavailable, Reason}` : `distribution`, `tracing`,
  `code_loading`, `not_selected`).
  `tests/compiler/builtins/observe_erlang.escript` observe l'OTP de l'hôte et
  conserve les états, qui sont maintenus à la main.
- `tests/compiler/builtins/generate_erlang.py` le transforme en
  `library/erts/erlang.erl` (le module de bouchons propre à Clause, un corps
  de substitution pour chaque builtin du catalogue) et en
  `compiler/src/semantic/erlang_auto_imports.inc` (la liste des auto-imports
  d'OTP). Le test CTest `builtins_erlang_inventory` vérifie que les deux sont
  à jour et que `implemented` désigne une builtin du catalogue, une fonction
  que le compilateur prend en charge (`apply/2,3`, `is_record/1,2,3`) ou un
  vrai corps Erlang (`nif_error/1,2` lèvent `error(Reason)` comme les bouchons
  d'OTP) ; `builtins_erlang_freshness` (étiquette `host_otp`) compare
  l'inventaire avec l'OTP de l'hôte.

Appels :

- `erlang:F(...)`, `fun erlang:F/A`, `apply(erlang, F, [...])` et
  `-import(erlang, ...)` d'une builtin vont vers la builtin. Tout autre export
  rejoint le programme en tant que module de bibliothèque `erlang` ; ses
  bouchons lèvent `error({not_implemented, F, A})` avec `erlang:F/A` au sommet
  de la pile, uniquement lorsqu'ils sont appelés. Un nom que le module
  n'exporte pas donne `undefined function erlang:F/A`.
- Un appel non qualifié ou `fun F/A` d'un auto-import d'OTP (`get(K)`,
  `fun put/2`) que le module ne définit pas, n'importe pas et ne supprime pas
  avec `-compile({no_auto_import, ...})` atteint `erlang:F/A` de la même
  manière.

## Format de termes externe

`erlang/term_encoding.cpp`, `erlang/term_decoding.cpp`. Les deux sens
partagent le codec de
[external_term.hpp](../abi/include/clause/abi/external_term.hpp) avec le
compilateur et parcourent les termes avec des piles explicites, de sorte que
la profondeur d'imbrication ne coûte aucune pile native. L'encodeur lit sur
place les cellules de son argument validé (`TermAccess::trusted`, sans
recherche d'adresse par cellule) ; le décodeur collecte les enfants sur une
pile partagée unique et écrit les tuples, listes et chaînes directement dans
des mots du tas qu'il réclame une fois par conteneur (`TermAccess::claim`).

- `term_to_binary/1,2` écrit les octets d'OTP pour un nœud non distribué
  (`nonode@nohost`, création 0) : atomes UTF-8, `NEW_FLOAT`, `STRING_EXT`
  pour les listes d'octets jusqu'à 65535 éléments, maps dans l'ordre des clés,
  pids, ports et références sous leurs formes `NEW_PID`, `V4_PORT` et
  `NEWER_REFERENCE`, et `EXPORT_EXT` pour `fun M:F/A` ; une fun locale ou un
  native record donne `error:notsup`. Options : `{minor_version, 0..2}`
  (0 écrit les flottants sous forme de texte, 0 et 1 les atomes en Latin-1),
  `deterministic`, `compressed` et `{compressed, 0..9}`
  ([zlib](#zlib-module)) ; tout le reste donne `badarg`.
- `term_to_iovec/1,2` renvoie l'encodage sous forme de liste d'un seul
  binary ; `external_size/1,2` sa taille exacte.
- `binary_to_term/1,2` vérifie chaque longueur par rapport à l'entrée avant
  d'allouer, ignore les octets après le terme, décompresse l'entrée
  compressée et renvoie `badarg` pour une entrée malformée, un texte d'atome
  invalide, des flottants non finis, des clés de map répétées et des
  identités d'un autre nœud ; `safe` n'admet que les atomes existants, `used`
  renvoie `{Term, BytesRead}`. Tests CTest : `executables_external_terms`
  (octets d'OTP) et `builtins_etf_fuzz` (les encodages mutés se décodent ou
  lèvent une exception).

## Temps

`erlang/time.cpp`. Le temps monotone est l'horloge monotone (steady clock) ;
`native` et `perf_counter` sont des nanosecondes ; les unités sont les atomes
d'OTP (y compris les formes plurielles dépréciées) ou un entier positif de
parties par seconde. `convert_time_unit/3` arrondit vers le bas, comme OTP.
`unique_integer/0,1` puise dans un compteur unique à l'échelle du programme,
de sorte que chaque valeur est positive, unique et croissante quelles que
soient les options (`positive`, `monotonic` ; les autres donnent `badarg`).
`now/0` est le temps système rendu strictement croissant. Les conversions de
calendrier lisent `{{Y, M, D}, {H, Mi, S}}` strictement (une date ou une heure
invalide donne `badarg`) et utilisent le fuseau horaire local de la
bibliothèque C. Minuteries : [processus](processes.md#timers).

## Informations système

`erlang/system.cpp`.

- `statistics/1` : `wall_clock` et `runtime` (`{Total, SinceLastCall}` en
  millisecondes), `run_queue`, `total_run_queue_lengths`,
  `total_active_tasks`, `context_switches` (tranches de temps exécutées).
  Clause ne tient aucun compteur de réductions, de garbage collection ni
  d'E/S : `reductions`, `exact_reductions`, `garbage_collection` et `io`
  renvoient des zéros.
- `system_info/1` : les éléments de version et de compilation (`otp_release`
  `"29"`, `version` `"17.1"`, l'ERTS que suit Clause, `machine` `"Clause"`,
  `system_version`, `system_architecture`, `wordsize`, `endian`, ...), les
  nombres et limites de processus, de ports et d'atomes, le nombre
  d'ordonnanceurs et de processeurs et les réponses fixes de l'émulateur
  (`smp_support`, `threads`, `time_warp_mode`, ...) ; la liste complète se
  trouve dans `system.cpp`.
- `memory/0,1` : les types d'OTP ; `processes` est le décompte à l'échelle du
  runtime de la mémoire des processus, `atom` une estimation à partir du
  nombre d'atomes, `binary`, `code` et `ets` valent 0.
- Les autres éléments donnent `badarg`.

## Hachage

`erlang/hashing.cpp`, `erlang/md5.cpp`.

- `phash2/1,2` est le `make_hash2` d'OTP et `phash/2` son `make_hash`,
  parcourant sur place les cellules de listes et de tuples : les atomes (par
  le hachage d'OTP de leur orthographe), entiers, flottants, binaries et
  bitstrings, listes, tuples et maps (indépendamment de l'ordre) donnent les
  valeurs de hachage d'OTP ; `dict` et `sets` de version 1 disposent donc
  leurs compartiments comme OTP. Les pids, ports et références sont hachés
  selon les numéros de Clause, les funs selon le module, l'arité ou l'indice
  et les captures, les native records selon les valeurs des champs
  ([différences](differences.md)). `phash2/1` est dans 0..2^27-1, `phash2/2`
  dans 0..Range-1, `phash/2` dans 1..Range ; Range est dans 1..2^32, sinon
  `badarg`.
- `md5/1` et `md5_init/0`, `md5_update/2`, `md5_final/1` donnent les
  condensés de la RFC 1321 (les octets d'OTP) d'iodata. Le contexte est un
  binary opaque de 96 octets, à la disposition propre à Clause ; un autre
  binary donne `badarg`.

## Chargement de code

`erlang/code.cpp`. Chaque module est lié dans le programme et reste chargé ;
le code dynamique est différé.
`module_loaded/1` est vrai pour un module compilé ou un module ayant des
builtins du runtime (`erlang`, `io`, `os`, ...) ; `loaded/0` et `pre_loaded/0`
les listent tous. `delete_module/1` renvoie `undefined` pour un module inconnu
et lève `error:notsup` pour un module chargé. `prepare_loading/2` renvoie
`{error, badfile}` (aucun binary n'est du code que le programme peut charger)
et `finish_loading/1` n'accepte que `[]`. `get_module_info(M[, Item])` se
poursuit en `M:module_info(...)`.

## Module lists

`runtime/src/builtins/lists/`. Le `lists` d'OTP est du code Erlang (à part
quelques BIF), donc les builtins de Clause lèvent ce que lèvent les clauses
d'OTP :

- `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`,
  `join/2`, `flatten/1,2`, `flatlength/1`, `delete/2`, `concat/1`, `max/1`,
  `min/1`, `usort/1`, `umerge/1,2`, `merge/1,2`, `merge3/3`, `umerge3/3`,
  `keymerge/3`, `ukeymerge/3`, `ukeysort/2`, `keydelete/3`, `keyreplace/4`,
  `keystore/4`, `keytake/3`, `zip/2,3`, `zip3/3,4`, `unzip/1`, `unzip3/1` et
  `enumerate/1,2,3` lèvent `function_clause` pour un argument qu'aucune clause
  d'OTP n'accepte, et parcourent les listes aussi paresseusement qu'OTP :
  `sublist([a | b], 1)` vaut `[a]`, `nthtail(1, [a | b])` vaut `b`,
  `flatten/2` ne vérifie pas sa queue au-delà de `is_list`, une fusion renvoie
  l'autre liste telle quelle lorsque l'une est `[]` et lève `badarg` pour
  un reste impropre qu'elle concatène, et une fusion par clé lève `badarg`
  pour un élément qui n'est pas un tuple de la taille de la clé, comme
  `element/2`.
- `zipwith/3,4` et `zipwith3/4,5` sont en Erlang au-dessus des builtins `zip`,
  qui apparient d'abord les éléments ; `flatmap/2`, `keymap/3`, `search/2`,
  `umerge/3` et `usort/2` sont aussi en Erlang. Dans `lists.erl`, l'appel
  d'un builtin est qualifié (`lists:zip(...)`) : un appel local atteindrait
  son corps de substitution. Les fonctions non documentées `rmerge/2,3`,
  `rmerge3/3`, `rumerge/2,3`, `rumerge3/3`, `rkeymerge/3` et `rukeymerge/3`
  (auxiliaires de tri d'OTP) restent des bouchons.
- `keymember/3` et `keysearch/3` sont des BIF dans OTP : `badarg` pour une
  position qui n'est pas un petit entier positif ou pour une queue impropre
  atteinte avant une correspondance.
- Les clés et l'ordre se comparent avec `==` et l'ordre des termes ; parmi des
  éléments égaux, le premier l'emporte (`max([1, 1.0])` vaut `1`,
  `usort([1.0, 1])` vaut `[1.0]`, `umerge/1,2` gardent l'élément de la liste
  la plus en amont).
- Elles s'exécutent jusqu'au bout. Les fonctions qui prennent des funs
  (`foreach/2`, `mapfoldl/3`, `splitwith/2`, `filtermap/2`, `uniq/2`, ...)
  sont en Erlang dans `library/stdlib/lists.erl`, car une builtin ne peut pas
  appeler une fun et récupérer son résultat ; de même pour les autres
  fonctions implémentées, avec les clauses et les guards d'OTP.
- Un `function_clause` provenant d'une builtin n'a pas de cadre propre
  ([différences](differences.md)).

## Module math

`runtime/src/builtins/math.cpp`. Chaque fonction `math` d'OTP 29 est une
builtin s'appuyant sur la bibliothèque C (`pi/0` et `tau/0` sont des
constantes). Les arguments sont des nombres convertis en flottants : tout le
reste donne `badarg`, un entier trop grand pour un flottant `badarith`. Un
résultat qui n'est pas un flottant fini (une erreur de domaine comme
`sqrt(-1)`, `log(0)`, `acos(2)`, ou un dépassement comme `pow(10, 400)`,
`exp(1000)`) donne `badarith`. `floor/1` et `ceil/1` renvoient des flottants.
Les résultats sont ceux de la bibliothèque C de l'hôte, qui peuvent différer
de ceux d'OTP sur le dernier bit ([différences](differences.md)). Sur les
cibles 64 bits, le code généré calcule en ligne dans une cellule de flottant
`sqrt`, `floor`, `ceil` (intrinsèques LLVM) et `exp`, `log`, `log2`, `log10`,
`sin`, `cos`, `pow` (les mêmes fonctions de la bibliothèque C, appelées sans
les substitutions de LLVM) pour des arguments numériques ; les autres
opérandes et les résultats non finis appellent la builtin, qui lève
l'exception.

## Module binary

`runtime/src/builtins/binary/`. `replace/3,4` (y compris un remplacement par
fun et `{insert_replaced, ...}`) et `list_to_bin/1` sont en Erlang dans
`library/stdlib/binary.erl` au-dessus des builtins ; toutes les autres
fonctions sont des builtins :

- Les motifs sont un binary non vide, une liste non vide de binaries non vides
  ou un motif compilé. Une correspondance est la position la plus à gauche et,
  à cette position, le motif le plus long ; `matches/2,3` et `split/2,3` avec
  `global` prennent des correspondances sans chevauchement à partir de la
  gauche. `{scope, {Start, Length}}` limite l'endroit où les correspondances
  peuvent commencer et finir (une longueur négative compte à rebours) ;
  `split/3` prend aussi `global`, `trim` et `trim_all`.
- `compile_pattern/1` renvoie `{bm, [Pattern]}` ou `{ac, Patterns}`, une forme
  propre à Clause (OTP : une référence dans le tuple,
  [différences](differences.md)).
- `part/2,3`, `bin_to_list/1,2,3`, `at/2`, `first/1`, `last/1`, `copy/1,2`,
  `longest_common_prefix/1`, `longest_common_suffix/1`, `join/2`,
  `decode_unsigned/1,2`, `encode_unsigned/1,2`, `encode_hex/1,2` et
  `decode_hex/1` suivent OTP ; tout argument incorrect (un bitstring, une
  plage hors du sujet, une option inconnue) donne `badarg`.
- `referenced_byte_size/1` est la taille propre du binary.
- Elles s'exécutent jusqu'au bout.

## Module maps

`runtime/src/builtins/maps.cpp`, `runtime/src/builtins/os.cpp`.

- Chaque fonction documentée de `maps` fonctionne. `maps:get/3`, `is_key/2`,
  `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`,
  `without/2`, `from_keys/2`, `intersect/2` et `is_iterator_valid/1` sont des
  builtins avec les erreurs d'OTP : un argument qui n'est pas une map donne
  `{badmap, Map}`, une clé absente pour `update/3` `{badkey, Key}`, une liste
  de clés qui n'est pas une liste propre `badarg`. Les clés correspondent
  exactement (`1` et `1.0` sont des clés différentes).
- Les fonctions prenant des funs sont en Erlang dans `library/stdlib/maps.erl` :
  `filter/2`, `filtermap/2`, `map/2`, `fold/3` et `foreach/2` prennent une map
  ou un itérateur (tout autre argument donne `{badmap, MapOrIter}`),
  `intersect_with/3` combine au-dessus d'`intersect/2` et `merge_with/3`
  au-dessus de `merge/2`. `groups_from_list/2,3` appellent les funs en
  commençant par le dernier élément, comme OTP, et le builtin privé
  `clause_maps:groups/1` regroupe les paires `{Key, Value}`. Les itérateurs
  (`iterator/1,2`, `next/1`) utilisent
  [`erts_internal:map_next/3`](#erts-internal).
- Les curseurs de map (`runtime/src/terms/map_cursor.hpp`) parcourent de la
  même façon une cellule de map plate et un arbre de map, sous forme de mots
  dans l'ordre des clés, sans `Term` par entrée. La builtin privée
  `clause_maps:entries/1` renvoie `{K1, V1, K2, V2, ...}` à partir d'un
  curseur, de sorte que `maps:fold/3` lit les associations sur place avec
  `element/2` au lieu de construire une liste de paires ; `map_next/3`
  avance aussi avec un curseur.
- `os:type/0`, `os:getenv/0,1` (`getenv/0` : chaînes `"Name=Value"` ; les
  entrées `=C:` par lecteur de Windows sont omises), `os:env/0` (paires
  `{Name, Value}`), `os:putenv/2`, `os:unsetenv/1` (`badarg` sauf si les
  arguments sont des chaînes et que le nom est non vide et sans `=`),
  `os:getpid/0` et `os:version/0` sont des builtins ; `os:timestamp/0`,
  `os:system_time/0,1`, `os:perf_counter/0,1` et `os:getenv/2` sont en Erlang
  au-dessus des builtins de temps d'`erlang` et de `getenv/1` ; `os:cmd/1`
  s'exécute au-dessus d'un port ([sous-processus](ports.md#subprocesses)).

## Collections

`runtime/src/builtins/collections/` : `ordsets`, `orddict`, `proplists`,
`dict`, `sets`, `gb_trees`, `gb_sets`, `queue` et `array`, chaque fonction
documentée.

- Les parcours de listes sont des builtins : appartenance, insertion,
  suppression et algèbre des ensembles d'`ordsets` (`union/2`,
  `intersection/1,2`, `subtract/2`, `is_subset/2`, `is_disjoint/2`,
  `is_set/1`) ; recherches et mises à jour sans funs d'`orddict` (`store/3`,
  `append/3`, `append_list/3`, `update_counter/3`, `take/2`, `from_list/1`,
  ...) ; toutes les fonctions de `proplists` sauf `property/1,2`,
  `get_value/2`, `normalize/2`, `to_map/2` et `from_map/1`, qui sont du code
  de liaison Erlang dans `library/stdlib/`.
- Les fonctions prenant des funs (`ordsets:fold/3`, `filter/2`, `map/2`,
  `filtermap/2`, `orddict:update/3,4`, `fold/3`, `map/2`, `filter/2`,
  `merge/3`) sont en Erlang.
- Chaque builtin parcourt ses listes comme les clauses d'OTP, donc les
  résultats et les erreurs concordent pour toute entrée : les éléments et les
  clés se comparent avec `<` et `==` (entre `1` et `1.0`, le représentant
  conservé par OTP est conservé, y compris après que `union/2` a échangé ses
  ensembles), un reste qu'OTP renvoie sans vérification (`ordsets:union([], X)`
  vaut `X`) est renvoyé tel quel, une forme qu'aucune clause n'accepte donne
  `function_clause`, une entrée de comprehension qui n'est pas une liste
  `{bad_generator, Rest}`, `Old ++ New` avec `Old` impropre `badarg`, et
  `update_counter/3` sur autre chose qu'un nombre `badarith`. Les clés de
  `proplists` correspondent avec `=:=`.
- `proplists:get_keys/1` liste les clés dans l'ordre des clés d'une map, comme
  l'ensemble de clés d'OTP ([différences](differences.md)).
- `dict` et `sets` : un dictionnaire et un ensemble de version 1 sont les
  records d'OTP au-dessus d'une table de hachage linéaire
  (`collections/linear_hash.cpp`), des segments de 16 listes de compartiments
  avec des emplacements issus d'`erlang:phash/2`, agrandis et réduits exactement
  comme OTP ; les records, `to_list/1` et l'ordre des folds sont donc ceux
  d'OTP. Un ensemble de version 2 (par défaut) est une map de valeurs `[]` ;
  l'intersection et la soustraction de deux maps utilisent les valeurs d'OTP
  (les valeurs propres d'une map lorsque suffisamment de clés sont conservées,
  sinon `[]`). Les recherches et mises à jour d'un dictionnaire, les opérations
  de `sets` sans funs, `new/0` et `from_list/1` sont des builtins ; `update`,
  `fold`, `map`, `filter`, `merge` et `sets:new/1`, `from_list/2`, `fold`,
  `filter`, `map`, `filtermap` sont en Erlang, les opérations hachées au-dessus
  des builtins privés `clause_hashed:entries/1` (ordre de stockage),
  `with_values/2` et `keep/2`. Un terme qui n'est pas un dictionnaire lève
  `{badrecord, Term}` (`size/1`, `is_empty/1` donnent `function_clause`), un
  terme qui n'est pas un ensemble `function_clause`.
- `gb_trees` et `gb_sets` partagent un moteur d'arbres équilibrés
  (`collections/balanced_tree.cpp`) : l'insertion vérifie la règle de poids
  d'Andersson en remontant et reconstruit un sous-arbre à partir de ses entrées
  triées comme OTP, la suppression remonte le plus petit nœud du côté le plus
  grand, et l'union, l'intersection et la différence de `gb_sets` fusionnent
  les listes triées ou insèrent et recherchent selon la règle de taille d'OTP
  (`N2 < 10` ou `N2 < N1 * round(1.46 ln N2)`), construisant les arbres
  fusionnés plus lourds à droite comme `balance_revlist` d'OTP ; chaque arbre
  est donc identique à celui d'OTP. `map`, `fold`, `filter`, `filtermap` et les
  constantes sont en Erlang.
- `queue` : le `{Rear, Front}` d'OTP ; chaque opération déplace les éléments
  entre les listes comme OTP (un côté d'un seul élément se déplace, une liste
  laissée seule est divisée en deux), donc les files sont identiques à celles
  d'OTP. Un terme qui n'est pas une paire de listes donne `badarg`, `get`,
  `drop`, `head` sur une file vide l'erreur `empty`. Les fonctions prenant des
  funs et les noms d'Okasaki sont en Erlang.
- `array` : le record `#array{}` d'OTP 29, un arbre de tuples aux feuilles de
  16 entrées (`[]` pour un sous-arbre vide), avec une feuille en cache et un
  décalage nul ; `set`, `append`, `shift`, `prepend`, `slice`, `reset`,
  `resize` et les constructeurs (`from_list`, `from_orddict` avec ses marqueurs
  de trous, `from`) modifient le record exactement comme OTP. Les folds et
  mapfolds sont en Erlang au-dessus des builtins privés
  `clause_array:values/3`, `sparse/3` et `replace/4`, ce dernier reconstruisant
  une plage transformée comme les mapfolds d'OTP (sous-arbres vides dépliés
  sauf si la transformation est creuse) et relisant le cache.

## Encodages

`runtime/src/builtins/encoding/`.

- `base64` : chaque fonction documentée est un builtin. L'encodage prend un
  binary ou une liste d'entiers (avec l'arithmétique d'OTP : `badarith` pour
  un élément non entier, `badarg` au-delà de la table de l'alphabet) ; le
  décodage parcourt son entrée comme les automates d'OTP, donc les erreurs
  concordent pour toute entrée : les espaces sont ignorés, une entrée se
  terminant après un caractère d'un groupe donne `function_clause`, après
  deux ou trois `missing_padding` sauf si `padding => false`, un caractère
  hors de l'alphabet `badarg` lorsque son groupe est construit (`badarith`
  dans les décalages d'OTP), tout caractère autre qu'un espace après le
  remplissage `{case_clause, Symbol}`. `mime_decode` ignore tout caractère
  hors de l'alphabet et les données après un `=` mal placé.
- `json` (`encoding/json.cpp`) : `decode/1` est un builtin parcourant les
  états du décodeur d'OTP sur une pile explicite de conteneurs ouverts ; les
  valeurs (un objet conserve la première valeur d'une clé), le reste après la
  valeur et les erreurs concordent donc : `unexpected_end` lorsqu'une entrée
  supplémentaire pourrait compléter le texte, `{invalid_byte, Byte}` à
  l'octet rejeté par OTP (pour un littéral tronqué, l'octet après son premier),
  `{unexpected_sequence, Bytes}` pour un échappement `\u` incorrect ou un
  flottant rejeté par `binary_to_float/1`. `encode_binary/1` et
  `encode_binary_escape_all/1` sont des builtins construisant les iodata
  imbriquées d'OTP, comme les chemins par défaut `encode/1` et `format/1,2`
  (`encoding/json_encode.cpp`, via `clause_json:encode/1` et `format/2`) ;
  au-delà de 256 niveaux d'imbrication, ou pour des options de format autres
  que de petits entiers non négatifs, ils répondent `fallback` et `json.erl`
  construit lui-même les mêmes iodata. Les encodeurs et formateurs prenant des
  funs et les décodeurs à rappels `decode/3`, `decode_start/3`,
  `decode_continue/2` sont en Erlang ; les décodeurs parcourent les états
  d'OTP au-dessus des analyseurs privés `clause_json:string/2` et `number/2`,
  donc les rappels s'exécutent dans l'ordre d'OTP et les états de continuation
  sont les tuples d'OTP.

## Noms de fichiers

`runtime/src/builtins/filename/`.

- `flatten/1`, `join/1,2`, `absname_join/2`, `append/2`, `basename/1,2`,
  `dirname/1`, `extension/1`, `rootname/1,2`, `split/1`, `pathtype/1`,
  `nativename/1` et `validate/1` sont des builtins suivant les clauses d'OTP
  pour la famille de l'hôte : Unix `/`, ou Windows `/` et `\`, lettres de
  lecteur (mises en minuscules par `join` et `split`) et noms réseau `//`.
  Les listes sont parcourues à mesure que les clauses d'OTP les ouvrent
  (listes imbriquées et atomes là où une clause les ouvre, `List ++ Rest`
  levant `badarg` pour une liste impropre) ; les résultats conservent donc
  les formes d'OTP : les éléments du nom, les binaries conservés comme
  éléments par `flatten/1`, les sous-listes et sous-binaries, et le
  `function_clause` d'OTP lorsqu'une clause rencontre autre chose qu'un
  caractère.
- `absname/1,2` (le répertoire courant et celui d'un lecteur) et `basedir/2,3`
  (l'environnement) sont en Erlang au-dessus de ces fonctions.

## Chaînes

`runtime/src/builtins/string/` : chaque fonction de `string`.

- Les parcours suivent `string.erl` clause par clause au-dessus de
  `unicode_util:cp/1` et `gc/1`, que `unicode/code_points.cpp` porte en
  termes aux formes d'OTP : listes imbriquées ouvertes aussi loin qu'OTP
  (jusqu'à trois points de code supplémentaires aplatis après le premier),
  binaries conservés comme tranches partageant leur tampon, `{error, Rest}`
  en cas d'UTF-8 invalide. Ainsi, `trim`, `take`, `lexemes`, `split`, `find`,
  `slice` et `prefix` renvoient des queues de l'entrée, des sous-binaries et
  les listes mixtes qu'OTP construit (`[Keep | Cont]`, `[Token, Bin]`,
  l'imbrication de `stack/2`), et lèvent les erreurs d'OTP (`{badarg, Rest}`,
  `function_clause`, `case_clause` et `badmatch` lorsque ses clauses
  rencontrent une réponse inattendue, `badarg` de `binary:compile_pattern([])`
  lorsque `nth_lexeme/3` compile un ensemble de séparateurs vide).
- Les parcours depuis la fin (`trim/3`, `take/4` avec `trailing`), récursifs
  dans le corps sous OTP, s'exécutent en boucles enregistrant un cadre par
  étape puis repliant les cadres à la fin ; les longues chaînes ne peuvent
  donc pas faire déborder la pile C++.
- `uppercase/1`, `lowercase/1`, `casefold/1` renvoient l'entrée elle-même
  lorsqu'aucun caractère ne change, comme OTP ; `titlecase/1` transforme le
  premier point de code. `equal/4` normalise via `unicode/normalize.cpp`, le
  portage de `nfc/nfd/nfkc/nfkd` d'`unicode_util` (tables de décomposition,
  ordre canonique, composition par paires, jamos hangul), et revérifie les
  restes identiques à chaque étape comme la clause `equal_nocase(A, A)` d'OTP.
- `to_integer/1` et `to_float/1` prennent les caractères du nombre avec
  `take/2` et les analysent comme `string:list_to_integer/1` (le
  `{Int, Rest}` d'erts avec `no_integer`, `not_a_list`, `system_limit`) et
  `list_to_float/1` (syntaxe des flottants d'Erlang, virgule admise comme
  séparateur décimal, exposant uniquement avec des chiffres) ; toute erreur
  interne donne `{error, badarg}`.
- L'API Latin-1 (`len`, `chr`, `tokens`, `strip`, `left`, `centre`, ...) est
  portée avec ses erreurs : `function_clause` lorsqu'une clause parcourt
  jusqu'à `[]`, `badarg` d'`erlang:length/1`, de `++` et de `lists:reverse/2`.
- `jaro_similarity/2` apparie les grappes de graphèmes dans la distance d'OTP
  et compte les transpositions dans l'ordre d'OTP.

## Chaînes URI

`runtime/src/builtins/uri/`.

- `parse/1` est un parcours de la grammaire RFC 3986 piloté par une table de
  délimiteurs, conservant l'ordre d'OTP pour que ses réponses indiquent où
  l'analyseur d'OTP s'est arrêté : d'abord un URI avec schéma (un échec après
  le deux-points du schéma est définitif), sinon une référence relative ;
  `userinfo@host` si le parcours de userinfo réussit, sinon l'autorité comme
  hôte ; un hôte numérique qui n'est pas une adresse IPv4 stricte est
  reparcouru comme nom enregistré ; `{error,
  invalid_uri, Fragment}` avec le fragment d'OTP. Les hôtes sont vérifiés
  avec les formes IPv4 et IPv6 strictes d'`inet`.
- `recompose/1`, `normalize/1,2` et `resolve/2,3` travaillent sur les
  composants de la map comme `uri_string.erl` : la forme liste ou binary de
  chaque composant décide de celle du résultat, les réponses `{error, ...}`
  d'OTP sont renvoyées, levées ou lancées là où OTP le fait, et `resolve`
  fusionne un chemin relatif après la dernière barre oblique du chemin de
  base (un parcours de graphèmes, comme `string:split/3` d'OTP).
- `percent_decode/1`, `quote/1,2`, `unquote/1`, `transcode/2`,
  `compose_query/1,2`, `dissect_query/1` et les classes de caractères suivent
  les parcours d'octets d'OTP, y compris les erreurs lancées pour un binary et
  renvoyées pour une liste, les références numériques HTML et `+` dans les
  requêtes de formulaire.
- `unicode/graphemes.cpp` segmente les points de code en grappes de graphèmes
  selon les règles d'`unicode_util:gc/1` pour les builtins qui ont besoin des
  limites de grappes.

## Nombres aléatoires

`runtime/src/builtins/rand/`.

- `rand` : les états sont les `{AlgHandler, AlgState}` d'OTP avec ses maps
  de gestionnaires (leurs funs sont celles de `rand`) et ses dispositions
  d'états ; les graines exportées, les séquences et les états après saut
  sont donc identiques à ceux d'OTP pour chaque algorithme (`exsss`,
  `exro928ss`, `exrop`, `exs1024s`, `exsp` et les obsolètes `exs64`,
  `exsplus`, `exs1024`, ainsi que `dummy`). Pour un gestionnaire identique
  à celui d'OTP, les builtins privés `clause_rand:seed/2`, `next/2`,
  `uniform/2,3`, `uniform_real/2`, `bytes/3`, `normal/2`, `shuffle/3` et
  `jump/2` font le travail en C++ : initialisation des graines (SplitMix64,
  listes, hachages de tuples de 3 éléments et erreurs de graines d'OTP),
  plages dépassant les bits du générateur, flottants denses, octets,
  ziggurat normale et flux de bits du mélange. Tout autre gestionnaire est
  un greffon : `rand.erl` exécute les algorithmes génériques d'OTP sur ses funs.
- `splitmix64_next/1`, `exsp_next/1`, `exsp_jump/1` et les fonctions `mwc59`
  sont des builtins ; `mwc59_seed/0` hache la graine par défaut de `rand`.
- `tools/rand/observe.escript` observe les constantes d'OTP via l'API de
  greffons de `rand` : les largeurs des bandes de la ziggurat (produits du
  chemin rapide) et leurs limites (où les mots d'une bande atteignent le
  chemin lent), et les états après saut, à partir desquels
  `tools/rand/generate.py` résout chaque polynôme de saut sur GF(2) (vérifié
  sur un second état) et écrit `tables.cpp` ; les hauteurs des bandes sont
  calculées en haute précision
  ([différences](differences.md#random-numbers)).
- `random` (obsolète) : `uniform_s/1` est un builtin du générateur
  Wichmann-Hill ; les fonctions d'initialisation des graines et de
  dictionnaire de processus sont en Erlang.

## Calendrier

`runtime/src/builtins/calendar.cpp`.

- L'arithmétique grégorienne est constituée de builtins sur des entiers de
  toute taille, avec `div` et `rem` tronqués d'Erlang, selon les formules
  d'ères d'OTP : `date_to_gregorian_days/1,3`, `gregorian_days_to_date/1`,
  `datetime_to_gregorian_seconds/1`, `gregorian_seconds_to_datetime/1`,
  `day_of_the_week/1,3`, `is_leap_year/1`, `last_day_of_the_month/2`,
  `valid_date/1,3`, `seconds_to_time/1`, `seconds_to_daystime/1`,
  `time_to_seconds/1`, `time_difference/2`, `iso_week_number/1`. Une forme
  rejetée par les clauses d'OTP donne `function_clause`, un argument non entier
  utilisé dans un calcul `badarith` ; les dates hors limites sont calculées
  comme OTP les calcule.
- L'heure locale et universelle, l'heure système et l'analyse et le formatage
  RFC 3339 sont en Erlang dans `library/stdlib/calendar.erl` au-dessus des
  builtins de temps d'`erlang` et de `proplists`, avec les erreurs d'OTP
  (`{badarg, [Arg, Options]}` hors limites, `{badmatch, _}` et
  `{case_clause, _}` pour un décalage mal formé).

## Termes persistants

`runtime/src/builtins/persistent_term.cpp`, au-dessus de la table du runtime
([runtime](runtime.md#persistent-terms)). `put/2` et `put_new/2` renvoient
`ok` (`put_new/2` d'une clé déjà stockée donne `ok` pour une valeur
exactement égale, sinon `badarg`) ; `get/1` d'une clé non stockée donne
`badarg`, `get/2` renvoie la valeur par défaut ; `get/0` liste chaque
`{Key, Value}` ; `erase/1` indique si la clé était stockée ; `info/0` vaut
`#{count => N, memory => Bytes}` (les mots des copies stockées). Les clés
correspondent exactement (`1` et `1.0` diffèrent). Les lectures renvoient le
terme stocké sur place, sans copie.

## Module unicode

`runtime/src/builtins/unicode/`. Chaque fonction est un builtin :
`characters_to_binary/1,2,3`, `characters_to_list/1,2` (également sous les noms
internes d'OTP `characters_to_binary_int/2` et `characters_to_list_int/2`),
`bin_is_7bit/1`, `bom_to_encoding/1`, `encoding_to_bom/1`, et
(`unicode/forms.cpp`) les formes de normalisation, `category/1`,
`is_whitespace/1`, `is_id_start/1` et `is_id_continue/1`.

- Encodages : `latin1`, `unicode`/`utf8`, `utf16` et `utf32`, gros-boutistes
  par défaut ou `{utf16 | utf32, big | little}` ; tout le reste donne `badarg`
  (`encoding_to_bom/1` : `function_clause`, comme OTP).
- Les chardata sont un binary ou une liste, éventuellement impropre avec une
  queue binary, de points de code, de binaries dans l'encodage d'entrée et de
  chardata imbriquées ; des binaries consécutifs se décodent comme un seul
  flux, de sorte qu'un caractère peut s'étendre sur deux. Tout le reste donne
  `badarg`.
- Un caractère que la sortie ne peut pas accepter (un point de code ou une
  séquence d'octets invalide, un code supérieur à 255 pour une sortie
  `latin1`) termine la conversion avec `{error, Converted, Rest}` ; une entrée
  qui se termine au milieu d'un caractère avec
  `{incomplete, Converted, Rest}`. `Rest` a la forme d'OTP : la partie non
  convertie de la liste la plus interne commençant par l'élément en échec (un
  binary sous forme de son suffixe non converti, seul lorsqu'il termine le
  niveau supérieur), à l'intérieur de la queue restante de chaque liste
  englobante ; les octets inachevés reportés d'un binary viennent en premier,
  et avec une sortie `latin1` un entier en échec est enveloppé dans une liste.
- `bin_is_7bit/1` est faux pour tout ce qui n'est pas un binary d'octets
  inférieurs à 128.
- `characters_to_nfc_list/1` et les fonctions apparentées exécutent la boucle
  d'OTP sur les formes normales d'`unicode_util` : les points de code sous
  forme de liste ou de binary UTF-8, `{error, Converted, Rest}` en cas d'UTF-8
  invalide et `badarg` pour tout autre cas. Les fonctions de propriétés
  prennent un point de code (sinon `badarg`) et conservent les raccourcis
  d'OTP : `is_whitespace/1` est faux en dessous de 5001 hors de sa liste ASCII
  et Latin-1, et les tests d'identifiants décident directement pour ASCII et
  pour le reste selon la catégorie, Other_ID_Start, Other_ID_Continue et la
  syntaxe des motifs.

## Module code

`runtime/src/builtins/code.cpp`. Il n'existe aucun processus `code_server` ;
les requêtes sur les modules chargés répondent pour le programme lié : un
module est chargé quand le programme le possède (code compilé ou builtins du
runtime). `ensure_loaded/1` donne `{module, M}` ou `{error, nofile}`,
`ensure_modules_loaded/1` `ok` ou `{error, [{M, nofile}]}`, `is_loaded/1`
`{file, preloaded}` ou `false`, `which/1` `preloaded` ou `non_existing`,
`module_status/1` `loaded` ou `not_loaded`, `all_loaded/0` et
`module_status/0` listent tous les modules, `is_sticky/1` vaut `false`. Un
argument module qui n'est pas un atome donne `function_clause`. Le chemin
d'erreur de `io_lib:format/2` d'OTP, qui appelle
`code:ensure_modules_loaded/1`, lève donc le `badarg` d'origine. Les chemins
de code et le chargement sont des bouchons.

## Module init

`runtime/src/builtins/init.cpp`, `library/erts/init.erl`. Un exécutable est un
système démarré sans script de démarrage (boot script). Le démarrage décode la
ligne de commande une seule fois (`ProgramArguments`,
`runtime/src/startup/arguments.cpp`) : les arguments qui suivent les options
du runtime sont à la fois l'argv de l'entrée d'arité 1 et
`get_plain_arguments/0`. Il n'y a pas d'indicateurs de l'émulateur ; le seul
indicateur est `home`, défini au démarrage comme le définit `erlexec` d'OTP
(`HOME` ; sous Windows `HOMEDRIVE` et `HOMEPATH`, sinon `USERPROFILE`), de
sorte que `get_argument(home)` vaut `{ok, [[Home]]}`, `get_arguments/0` vaut
`[{home, [Home]}]` et tout autre indicateur donne `error`. `script_name/0` est
le chemin absolu de l'exécutable avec des barres obliques. Ces quatre
fonctions sont des builtins ; le reste est en Erlang :

- réponses de l'`init` démarré d'OTP : `get_status/0` `{started, started}`,
  `notify_when_started/1` `started`, `ensure_loaded/1` `not_allowed`,
  `fetch_loaded/0` `[]`, `objfile_extension/0` `".beam"`,
  `archive_extension/0` `".ez"`, `code_path_choice/0` `strict`,
  `run_on_load_handlers/0` `ok`, `wait_until_started/0` (attend
  `{init, started}`) ; `get_configfd/1` et `set_configfd/2` gardent leurs
  valeurs dans `persistent_term` sous `{init, configfd, Id}` ;
- `script_id/0` vaut `{"Clause", "29"}` ;
- `stop/0,1` et `reboot/0` arrêtent immédiatement avec les règles de statut
  d'OTP : un entier non négatif est le code de sortie, une liste d'octets le
  slogan d'arrêt, tout autre argument `badarg` ;
- refusées : `boot/1` et `restart/0,1` lèvent `notsup` après les vérifications
  d'arguments d'OTP (`restart/1` d'une liste qui n'est ni `[]` ni
  `[{mode, M}]` donne `badarg`), `make_permanent/2` renvoie
  `{error, notsup}` pour des noms valides et `{error, badarg}` sinon.

## Atomics et compteurs

`runtime/src/builtins/atomics.cpp`. Un tableau `atomics` est une
[référence de handle](runtime-heap.md#handle-references) dont le tampon
contient un mot de signe et les valeurs 64 bits, mises à jour via
`std::atomic_ref` avec des opérations séquentiellement cohérentes ; il est
partagé par toutes les copies de la référence (messages, termes persistants,
`binary_to_term/1` tant qu'il vit) et libéré avec la dernière.

- `new/2` prend une arité de 1 à 2^27 et des options `[{signed, Bool}]` (la
  dernière l'emporte) ; `get/2`, `put/3`, `add/3`, `add_get/3`, `sub/3`,
  `sub_get/3`, `exchange/3`, `compare_exchange/4` et `info/1` sont des
  builtins avec le `badarg` d'OTP pour une référence, un index ou une valeur
  incorrects. Les valeurs stockées doivent tenir dans le tableau (int64 ou
  uint64) ; les incréments peuvent être n'importe quel entier de -2^63 à
  2^64 - 1 et bouclent. `info/1` indique la `memory` d'OTP, soit 40 + 8 octets
  par valeur.
- `counters` est en Erlang (`library/erts/counters.erl`) : `{atomics, Ref}` et
  `{write_concurrency, Ref}` enveloppent tous deux un tableau atomics signé,
  de sorte que les compteurs write-concurrency sont exacts à chaque lecture.
  `info/1` de ces derniers indique la taille et la mémoire du tableau.

## Erts internal

`runtime/src/builtins/erts_internal.cpp`, `library/erts/erts_internal.erl`.
Les fonctions qu'appellent `stdlib` et `kernel` d'OTP :

- les builtins `cmp_term/2` (ordre exact des termes : un entier avant un
  flottant égal) et `map_next/3`, le protocole de `maps:iterator/1,2` et de
  `maps:next/1` : un chemin entier parcourt la map dans l'ordre des clés et
  continue sur les clés restantes, un chemin liste de clés prend ses clés
  dans l'ordre ; un accumulateur liste reçoit chaque association à partir du
  chemin ;
- en Erlang, `list_to_integer/2` et `binary_to_integer/2` (les fonctions
  d'aide de `string:to_integer/1` et des BIF de conversion, `big` au-delà
  d'un petit entier de la taille du mot), `map_to_tuple_keys/1` (les clés
  triées de n'importe quelle map), `term_type/1`, les fonctions `counters_*`
  write-concurrency, `dynamic_node_name/0,1` au-dessus de `persistent_term` ;
- refusées : `get_creation/0` vaut `undefined` (pas de distribution) et
  `map_hashmap_children/1` lève `badarg` (aucune map n'a de nœuds hashmap) ;
- déclinés : les groupes de la distribution, de `.beam` et internes à
  l'émulateur.

`erts_code_purger:purge/1` répond `{false, false}` et `soft_purge/1` `true`,
car le code lié n'a pas d'ancien code ; le processus de purge et
`finish_after_on_load/2` sont déclinés.

## Unicode util

`library/stdlib/unicode_util.erl`, `runtime/src/builtins/unicode/`. OTP génère
`unicode_util` lors de sa compilation (900 Ko d'Erlang) ; Clause conserve les
données dans des tables C++ générées (`unicode/tables.cpp`) interrogées par
les builtins de son module privé `clause_unicode`, et `unicode_util.erl`
répond à chaque fonction d'OTP au-dessus d'elles avec les formes de résultat
d'OTP (`{error, Rest}` ou `{badarg, Rest}` en cas d'UTF-8 invalide). Les parcours de chardata sont des
builtins : `cp/1` (`unicode/code_points.cpp`) ouvre les listes imbriquées
aussi loin qu'OTP et conserve le reste d'un binary comme une tranche de
celui-ci ; `gc/1`
découpe les grappes de graphèmes étendues selon UAX #29 dans l'ordre des
règles d'OTP ; `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` (`unicode/normalize.cpp`) normalisent la première grappe, `nfkc/1`
conservant une liste lorsque sa décomposition avait plusieurs points de code,
comme `compose_compat_0` d'OTP ; `uppercase/1`, `lowercase/1`, `titlecase/1`
et `casefold/1` transforment le premier point de code. `spec_version/0` vaut `{17, 0}`.

`tools/unicode/generate.py` écrit les tables une fois par mise à jour
d'Unicode : correspondances de casse, catégories, décompositions et prédicats
de propriétés à partir des réponses de l'OTP de l'hôte pour chaque point de
code (`tools/unicode/observe.escript`), données de coupure de graphèmes,
d'emoji, indiennes et de composition à partir des fichiers de l'Unicode
Character Database qu'épingle OTP 29 (Unicode 17.0). Seules les tables
générées sont commitées, avec la mention qu'exige la Unicode License v3 ; les
compilations n'ont besoin ni d'OTP ni des fichiers de données.
`executables_unicode_tables` et `executables_unicode_clusters` comparent les
réponses, les grappes et les formes normales avec celles d'OTP,
`executables_unicode_forms` les formes et propriétés d'`unicode`.

## io_lib

`library/stdlib/io_lib.erl`, `runtime/src/builtins/io_lib/`. Les résultats sont
les listes de caractères profondément imbriquées d'OTP, exactement comme
`io_lib` et `io_lib_format` les construisent : le texte est d'abord construit
comme cellules d'une arène C++ (`io_lib/deep.cpp`), puis devient un terme
(`io_lib`) ou des caractères à plat (`io:format/1,2,3`, qui exécute le même
moteur).

- Fonctions d'écriture (`io_lib/write.cpp`) : `write/1,2,5` suivent `write1/4`
  avec des limites de profondeur (`[...]`, `|...`, `,...`), les atomes selon
  l'encodage (`latin1` échappe les caractères au-delà de Latin-1), les maps
  dans l'ordre des clés de Clause, `ordered` ou `reversed` ; `write_bin/5`
  renvoie les tailles d'OTP, particularités comprises. `write_string/1,2` et
  ses formes Latin-1 et `as_latin1`, `write_char/1` et apparentées,
  `write_atom/1`, `quote_atom/2`, `write_binary/3` et les formes binary
  échappent comme `string_char/4` et `needs_escape/2`.
- Moteur de formatage (`io_lib/format_scan.cpp`, `format_build.cpp`) : `scan`
  transforme le format en littéraux et maps `format_spec()` (`scan_format/2`,
  `unscan_format/1`, `build_text/1,2`) ; `build_small` aplatit les petits
  contrôles (`~e ~f ~g ~b ~B ~x ~X ~+ ~# ~c ~~ ~n ~i`, `~s` d'un atome)
  dans le résultat ; `build_limited` répartit `chars_limit` entre
  `~w ~W ~s ~p ~P` et les écrit via `string/6`, `term/6` et le remplissage
  équilibré de `chars/2`. `~e`, `~f`, `~g` arrondissent les 21 chiffres de
  `float_to_list/1` comme `float_man/3` (`format_float.cpp`). Les erreurs
  internes donnent `badarg`, comme avec le catch d'`io_lib` ;
  `unscan_format/1` lève les siennes. `bformat/2,3` et `bfwrite/2,3` donnent
  le même texte en UTF-8.
- Vérifications et auxiliaires : `char_list/1`, `deep_char_list/1`, les
  vérifications de caractères imprimables (`printable_list/1` est en Latin-1 :
  `io:printable_range/0` vaut `latin1`), `chars_length/1`, `indentation/2`
  (avec les décalages de binary d'OTP après une tabulation), `limit_term/2`,
  `nl/0`, et les états du serveur d'E/S `collect_chars/1,3,4`,
  `collect_chars_eager/4`, `collect_line/1,3,4`, `collect_line_no_eol/4`
  (`io_lib/collect.cpp`).
- Affichage formaté (`io_lib/pretty*.cpp`) : l'`io_lib_pretty` d'OTP pour
  `print/1,4`, `~p`/`~P` (profondeur et `chars_limit`), `write/2,5`,
  `bwrite/2` et `write_bin/5` avec `chars_limit` supérieur à 0, et les rapports
  de plantage. `print_length/7` construit le format intermédiaire dans une
  arène (chaque valeur avec sa longueur sur une ligne, les points portant ce
  qu'il faut afficher plus profondément) ; `intermediate/7` l'approfondit dans
  la limite de `chars_limit` (`expand/3`, `find_upper`, `search_depth`) ;
  `cind/7` choisit l'indentation des étiquettes et `pp/8` coupe les lignes
  selon les formes de listes imbriquées d'OTP. `bformat/2,3` met `~p` en
  page comme `print_bin/2`, avec ses sauts de ligne de binary, sa taille et
  sa colonne.
- Erlang : `get_until/1,3,4` (applique l'analyseur de l'appelant),
  `format_prompt/1,2` et `write/3`. Bouchons : `fread/2,3`.
- Les conteneurs imbriqués sur plus de 256 niveaux lèvent `system_limit`, et
  les funs de comparaison de `maps_order` donnent `badarg`
  ([différences](differences.md#io)). `executables_io_lib_text` compare les
  formes de chaque fonction avec celles d'OTP, `executables_pretty_print`
  celles de l'affichage formaté.

## Module zlib

`runtime/src/builtins/zlib/streams.cpp`, `library/erts/zlib.erl`. Le runtime
lie zlib 1.3.2, la version qu'embarque OTP 29 ([zlib](compile.md#zlib)), de
sorte que les octets compressés sont égaux à ceux d'OTP pour chaque niveau,
stratégie, taille de fenêtre et vidage. Un flux est une
[référence de handle](runtime-heap.md#handle-references) dont le tampon
contient le `z_stream` ; son finaliseur termine une session active quand la
dernière copie meurt. Les builtins privées `clause_zlib` (appels d'ouverture,
de fermeture, de contrôleur, d'initialisation, de deflate, d'inflate, de fin,
de réinitialisation, de paramètres et de dictionnaire) exécutent une
opération sur toute leur entrée ; `zlib.erl` conserve l'API d'OTP, ses
erreurs d'arguments (`bad_compression_level`, `bad_windowbits`, ...), ses
états de flux (`not_initialized`, `already_initialized`,
`not_on_controlling_process`), `eos_behavior`, les dictionnaires
(`{need_dictionary, Adler}`) ainsi que `compress/1`, `zip/1`, `gzip/1` sur
tampon entier et leurs inverses (membres gzip concaténés). Un en-tête gzip
nomme la plateforme, comme l'écrit la zlib d'OTP. `term_to_binary/2` avec
`compressed` ou `{compressed, Level}` compresse comme OTP le décide (dans cinq
octets de moins que la charge utile, sinon sans compression).

## Module re

`runtime/src/builtins/re/`, `library/stdlib/re.erl` : les exports et les
types d'OTP 29 au-dessus de la version de PCRE2 qu'embarque OTP
([PCRE2](compile.md#pcre2)). `version/0` est la version et la date de PCRE2
sous forme de binary (`<<"10.47 2025-10-21">>`, comme sur OTP).

Un motif compilé est le `{re_pattern, CaptureCount, Unicode, UseCRLF, Ref}`
d'OTP 29, où `Ref` est une
[référence de handle](runtime-heap.md#handle-references) qui possède le
`pcre2_code` ; son finaliseur libère le code avec la dernière copie, et les
processus le partagent en lecture seule. Comme dans OTP, la partie C est
petite et le reste est en Erlang :

- `clause_re:compile/2` compile un binary d'expression régulière avec des
  options de compilation (`{ok, Pattern}` ou `{error, {Message, Offset}}` avec
  le message de PCRE2) ; `re:inspect/2` répond à `namelist`.
- `clause_re:run/4` est la BIF `re:run` d'OTP sans ses traps : une
  correspondance d'un sujet binary à partir de `{offset, N}`, en compilant
  d'abord une expression régulière textuelle, avec chaque spécification et
  type de capture, `match_limit` et `match_limit_recursion`, et les erreurs
  d'OTP (résultats `report_errors`, `badarg` pour des options de compilation
  ou d'autres conventions de fin de ligne données avec un motif compilé).
- `re.erl` convertit les chardata Unicode en UTF-8 et les captures en
  caractères, exécute les correspondances `global` une à la fois (après une
  correspondance vide, il réessaie ancré et non vide, puis avance d'un
  caractère, ou d'une paire CR LF avec les fins de ligne CRLF, comme le fait
  `loopexec` d'OTP), et implémente `replace/3,4` (`\N`, `\gN`, `\g{N}`, `&`,
  une fun de remplacement) et `split/2,3` (`{parts, N}`, `trim`, `group`,
  `{return, Type}`) avec les résultats d'OTP.

Les motifs exportés (`export`, `import/1`) ne sont pas fournis.
`executables_re_module` compare avec OTP la compilation, les correspondances,
les captures, les correspondances globales et Unicode, le remplacement, le
découpage et les erreurs d'arguments.

## Prim eval

`runtime/src/process/receive.cpp`, `library/erts/prim_eval.erl`.
`prim_eval:'receive'(Fun, Timeout)` est le receive d'`erl_eval`, dont les
clauses sont une fun : il parcourt la boîte aux lettres à partir du message
le plus ancien avec les étapes d'un [receive](processes.md#receive) compilé,
les builtins privées `clause_receive` `peek/0` (`{message, M}` ou `none`),
`skip/0`, `take/0`, `restart/0` et `wait/1` (la builtin d'attente du code
compilé, avec son délai et `timeout_value`). Le premier message pour lequel
`Fun` répond autre chose que `nomatch` est retiré et cette réponse est
renvoyée ; `timeout` quand `Timeout` expire. Une exception levée par `Fun`
laisse chaque message en place.
`executables_prim_eval_receive` compare avec OTP l'ordre de la boîte aux
lettres, les délais, un message arrivant pendant l'attente et les exceptions.
