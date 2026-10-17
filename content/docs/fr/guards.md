---
source: docs/guards.md
sourceCommit: a8c3f8f6
sourceSha256: 06fccff40aa16d2969fa711e61435acef58adf23acf5478fdea02da2654c8fa8
translatedAt: 2026-10-17
---
# Guards

La légalité des guards suit les règles `erl_internal`/`erl_lint` épinglées
d'OTP 29 ; elle n'est jamais déduite de l'enregistrement au runtime. Chaque
opérande est vérifié, y compris les opérandes inaccessibles. Un guard ne réussit
que lorsque la valeur finale est l'atome `true`.

## Flot de contrôle

- `,` combine des tests en conjonction, dans l'ordre. `;` démarre une nouvelle
  alternative après `false`, une valeur non booléenne ou une erreur sémantique
  atteinte ; quand toutes échouent, la clause ne correspond pas.
- Les liaisons de tête sont lisibles dans chaque alternative ; les guards ne
  créent aucune liaison.
- Les erreurs d'infrastructure (OOM, limites, propriété) arrêtent l'exécution et
  n'essaient jamais une autre alternative.

| Opérateur | Sémantique |
| --- | --- |
| `A andalso B` | `A` doit être booléen ; `false` → `false` ; sinon renvoie `B` comme terme quelconque |
| `A orelse B` | `A` doit être booléen ; `true` → `true` ; sinon renvoie `B` |
| `and`, `or`, `xor` | Les deux opérandes évalués dans l'ordre, tous deux booléens |
| `not A` | Inverse booléen |

`true andalso 7` renvoie 7 dans un corps et échoue comme test final de guard ;
`(true andalso 7) =:= 7` réussit. Une erreur atteinte dans une expression
imbriquée rejette toute l'alternative : `hd([]) orelse true` échoue,
`hd([]); true` réussit. Dans les corps, des opérandes stricts incorrects lèvent
`badarg` et un opérande gauche paresseux incorrect lève `{badarg, Value}`, comme
dans OTP.

## Catalogue

[guards.tsv](../tests/fixtures/patternmatch/guards.tsv) liste les 81 signatures
de guard issues des tables épinglées `guard_bif`, `new_type_test`,
`old_type_test`, `arith_op`, `bool_op` et `comp_op`, et un test impose l'égalité
exacte des ensembles avec l'amont.
[Le manifeste d'audit](../tests/fixtures/patternmatch/generated/guard_catalog/manifest.json)
associe chacune à un résolveur, un abaissement et un responsable runtime. Les 81
sont toutes implémentées : `self()` est le pid du processus appelant, `node()`
et `node/1` d'un pid, d'une référence ou d'un port valent `nonode@nohost` (il
n'y a qu'un nœud ; tout autre argument de `node/1` fait échouer le guard,
`badarg` dans un corps). Native records dans les guards : `is_record/1,2,3` et
accès aux champs comme dans [native records](native-records.md#operations).

- Tests de type : `is_atom`, `is_integer`, `is_float`, `is_number`,
  `is_boolean`, `is_tuple`, `is_list`, `is_map`, `is_binary`, `is_bitstring`,
  `is_function/1,2` ([funs](funs.md)), `is_pid`, `is_reference`
  ([pids et références](terms.md#pids-and-references)), `is_port`
  ([ports](ports.md#identity)).
- `is_integer(V, Lo, Hi)` valide d'abord les deux bornes comme entiers (sinon
  `badarg`), puis teste l'intervalle inclusif ; des bornes inversées donnent
  false.
- Comparaisons `==`, `/=`, `=:=`, `=/=`, `<`, `=<`, `>`, `>=` ; opérateurs
  arithmétiques et bit à bit ; requêtes et conversions selon [termes](terms.md).
- Les constructeurs et les mises à jour de map dans les guards utilisent les
  mêmes services enracinés que les corps.
- Tests de record : voir [termes](terms.md#records).

## Résolution

- Les BIF de guard non qualifiées respectent les définitions locales, les
  imports et `no_auto_import` global/sélectif. `erlang:F(...)` et
  `erlang:'op'(...)` contournent le masquage, mais seulement pour les BIF de
  guard et les opérateurs.
- Les anciens tests (`integer/1`, `float/1`, `atom/1`, `record/2`, ...) ne sont
  valides qu'au niveau supérieur d'un test de guard (parenthèses autorisées). À
  cet endroit, `float(X)` signifie `is_float` ; `float/1` imbriqué ou qualifié
  est la conversion. L'ancien `record/2` ignore la suppression de son ancien
  nom, mais un `is_record/2` local le bloque.
- Interdits dans les guards : affectation, appels locaux/distants/dynamiques
  arbitraires, `++`, `--`, `!`, funs, comprehensions, flot de contrôle, mises à
  jour de records, `record_info/2`.

## Limites de l'oracle

OTP 29.1.1 installé plante lors de la conversion SSA pour certains imports
modernes sans rapport masqués par d'anciens alias scalaires ; Clause rejette
explicitement ce responsable non autorisé. Le chargeur d'OTP rejette aussi un
guard avec une arité de record littérale énorme bien que le lint l'accepte ; ce
cas n'a qu'une preuve sémantique.
