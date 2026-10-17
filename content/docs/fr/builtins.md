---
source: docs/builtins.md
sourceCommit: a8c3f8f6
sourceSha256: c5b5b3ed022c6da6d2e2862ed0b124314e7f7a5b8cfdfcc5b3a787b4b99841fb
translatedAt: 2026-10-17
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
| `erlang:function_exported(M, F, A)`, `A -- B`, `length(L)` dans un corps (builtins du catalogue sans service en ligne) | Entrées comme une fonction : `CLAUSE_builtin_frame_v1(context, index)` donne le cadre de la builtin, les arguments vont dans les registres ([portions](#portions)) |
| `integer_to_list(I)`, `atom_to_list(A)`, `setelement(I, T, V)`, ... (builtins directes : jamais de trap, d'attente ni d'action sur un autre processus) | Appelées immédiatement : `CLAUSE_builtin_call_v1(context, index, arguments)` renvoie le résultat ([ABI](abi.md#runtime-services)) |
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
  et la fonction ne s'exécute pas.
- Une fonction renvoie un terme, un `BuiltinResult` (`std::expected` avec un
  `BuiltinFailure`) ou un `Word` brut qu'elle a publié elle-même, ou lance
  `BuiltinFailure` (une erreur Erlang ou un échec d'accès aux termes) ;
  `call_builtin` transforme toute autre exception C++ en `out_of_memory` ou
  `internal_error`, de sorte qu'aucune ne traverse l'ABI du code généré.
- La plupart des familles sont typées. Les BIF de guard et les opérateurs
  (`erlang/core.cpp`), les builtins de listes qui font un trap et quelques
  autres sont des adaptateurs `BuiltinBody` au niveau des mots, qui
  transmettent leurs mots d'arguments aux services en ligne que le code généré
  appelle aussi.

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
  jamais à un bouchon de bibliothèque ni à une fonction utilisateur de même
  nom.
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
  `library/erts/erlang.erl` (le module de bouchons propre à Clause) et en
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

- `phash2/1,2` et `phash/2` hachent la structure d'un terme : des termes
  exactement égaux ont le même hachage dans chaque exécution du programme
  (atomes selon leur orthographe, maps dans l'ordre des clés, `1` et `1.0`
  distincts). `phash2/1` est dans 0..2^27-1, `phash2/2` dans 0..Range-1,
  `phash/2` dans 1..Range ; Range est dans 1..2^32, sinon `badarg`. Les
  valeurs sont propres à Clause, pas celles d'OTP.
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
  `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2` et
  `keydelete/3` lèvent `function_clause` pour un argument qu'aucune clause
  d'OTP n'accepte, et parcourent les listes aussi paresseusement qu'OTP :
  `sublist([a | b], 1)` vaut `[a]`, `nthtail(1, [a | b])` vaut `b`,
  `flatten/2` ne vérifie pas sa queue au-delà de `is_list`.
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

- `maps:get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`,
  `take/2`, `update/3`, `with/2`, `without/2` et `from_keys/2` sont des
  builtins avec les erreurs d'OTP : un argument qui n'est pas une map donne
  `{badmap, Map}`, une clé absente pour `update/3` `{badkey, Key}`, une liste
  de clés qui n'est pas une liste propre `badarg`. Les clés correspondent
  exactement (`1` et `1.0` sont des clés différentes). Les autres fonctions
  implémentées (`filter/2`, `map/2`, `fold/3`, `iterator/1,2`, `next/1`, ...)
  sont en Erlang dans `library/stdlib/maps.erl` ; les itérateurs utilisent
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

## Termes persistants

`runtime/src/builtins/persistent_term.cpp`, au-dessus de la table du runtime
([runtime](runtime.md#persistent-terms)). `put/2` et `put_new/2` renvoient
`ok` (`put_new/2` d'une clé déjà stockée donne `ok` pour une valeur
exactement égale, sinon `badarg`) ; `get/1` d'une clé non stockée donne
`badarg`, `get/2` renvoie la valeur par défaut ; `get/0` liste chaque
`{Key, Value}` ; `erase/1` indique si la clé était stockée ; `info/0` vaut
`#{count => N, memory => Bytes}` (les mots des copies stockées). Les clés
correspondent exactement (`1` et `1.0` diffèrent). Chaque lecture copie la
valeur dans le tas de l'appelant.

## Module unicode

`runtime/src/builtins/unicode/`. `characters_to_binary/1,2,3`,
`characters_to_list/1,2`, `bin_is_7bit/1`, `bom_to_encoding/1` et
`encoding_to_bom/1` sont des builtins ; les fonctions de normalisation, de
catégorie et d'identifiant de `library/stdlib/unicode.erl` sont des bouchons.

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
d'OTP (`{error, Rest}` ou `{badarg, Rest}` en cas d'UTF-8 invalide). `gc/1`
découpe les grappes de graphèmes étendues selon UAX #29 dans l'ordre des
règles d'OTP ; `nfd/1`, `nfc/1`, `nfkd/1`, `nfkc/1` normalisent la première
grappe ; `spec_version/0` vaut `{17, 0}`.

`tools/unicode/generate.py` écrit les tables une fois par mise à jour
d'Unicode : correspondances de casse, catégories, décompositions et prédicats
de propriétés à partir des réponses de l'OTP de l'hôte pour chaque point de
code (`tools/unicode/observe.escript`), données de coupure de graphèmes,
d'emoji, indiennes et de composition à partir des fichiers de l'Unicode
Character Database qu'épingle OTP 29 (Unicode 17.0). Seules les tables
générées sont commitées, avec la mention qu'exige la Unicode License v3 ; les
compilations n'ont besoin ni d'OTP ni des fichiers de données.
`executables_unicode_tables` et `executables_unicode_clusters` comparent les
réponses, les grappes et les formes normales avec celles d'OTP.

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
