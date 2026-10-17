---
source: docs/patterns.md
sourceCommit: a8c3f8f6
sourceSha256: 0a7a8a1553a85de9fdbf7f86b763794ac36eb0f02510d51897f2a17be4209cac
translatedAt: 2026-10-17
---
# Motifs, clauses et correspondances dans les corps

Les têtes de clauses de fonction, les correspondances dans les corps, les
clauses de `case` et les guards de `if` sont exécutables pour tous les types de
termes admis ([termes](terms.md)). La légalité et la disponibilité sont
vérifiées séparément : un Erlang invalide est une erreur **sémantique** même
dans du code inaccessible ; un code légal qui requiert une fonctionnalité
manquante reçoit un diagnostic de **capacité** (capability) ; une
**non-correspondance** à l'exécution n'est jamais une erreur de compilation.

| Contexte | État |
| --- | --- |
| Têtes de fonction + guards | Implémenté ; l'épuisement lève `error:function_clause` |
| Correspondances et séquences dans les corps, `begin`/`end` | Implémenté ; un échec lève `error:{badmatch, RHS}` |
| Clauses de `case` + guards | Implémenté ; l'épuisement lève `error:{case_clause, Value}` |
| Clauses de guard de `if` | Implémenté ; l'épuisement lève `error:if_clause` |
| `maybe` avec `?=` et clauses `else` | Implémenté ; un `?=` en échec produit sa valeur ou sélectionne une clause `else`, dont l'épuisement lève `error:{else_clause, Value}` ; requiert la fonctionnalité `maybe_expr` ([préprocesseur](preprocessor.md)) |
| Comprehensions de liste, de binary et de map | Implémenté ([ci-dessous](#comprehensions)) |
| `catch Expr` | Implémenté ; pas de motifs ([ABI](abi.md#failure-channel-revision-2)) |
| Clauses `try` `of` et catch | Implémenté ; l'épuisement de `of` lève `error:{try_clause, Value}`, les exceptions non filtrées sont relevées et `after` s'exécute sur tous les chemins ([ABI](abi.md#failure-channel-revision-2)) ; `Class:Reason:Stack` lie la [trace de pile](abi.md#stack-traces) |
| Clauses de fun | Implémenté ; l'épuisement lève `error:function_clause` ([funs](funs.md#closures)) |
| Clauses de `receive` + guards | Implémenté ; les messages non filtrés restent dans la boîte aux lettres, `after` s'exécute à l'expiration du délai ([processus](processes.md#receive)) |

## Comprehensions

`[T1, ..., Tn || Q1, ..., Qm]`, `<< T || Q1, ... >>` et
`#{K => V, ... || Q1, ... }` suivent OTP 29 :

- Les qualificateurs s'exécutent de gauche à droite ; chaque générateur boucle
  sur le reste. Les modèles (templates) sont évalués dans cet ordre pour chaque
  combinaison retenue ; plusieurs modèles ajoutent plusieurs éléments par
  combinaison. Le modèle d'une comprehension de binary doit être une bitstring
  (sinon `error:badarg` sur cet élément) ; les morceaux sont joints dans
  l'ordre, octets partiels compris. Une comprehension de map évalue sa
  (première) valeur avant sa clé, et une clé en double ultérieure l'emporte.
- Générateurs : `P <- List`, `<<Segs>> <= Bits` et `K := V <- Map`, avec les
  formes strictes `<:-` (listes, maps) et `<:=`. Un générateur de bitstring
  confronte son motif à un préfixe et continue avec le reste. Quand un
  générateur souple rejette un élément, il saute autant de bits que les tailles
  du motif l'indiquent (valeurs ignorées, flottants lus comme entiers, comme le
  fait OTP) ; quand même cela échoue, ou qu'il reste moins de bits, le
  générateur se termine. Un générateur de map parcourt la map dans l'ordre des
  clés ([différences](differences.md#maps)).
- Un motif de générateur lie de nouveaux noms : il masque les noms extérieurs,
  et rien de ce qu'une comprehension lie n'est visible après elle. Un
  générateur souple saute les éléments que son motif rejette ; un générateur
  strict lève `error:{badmatch, E}` avec l'élément de liste, la bitstring
  restante ou `{Key, Value}`.
- Un groupe zip (`P1 <- L1 && P2 <- L2`) prend un élément de chaque entrée à
  chaque étape ; ses motifs lient ensemble, donc un nom répété doit
  correspondre. Une étape rejetée est sautée sauf si un motif strict la
  rejette. Des entrées qui s'épuisent inégalement, ou un rejet strict, lèvent
  `error:{bad_generators, {L1', L2'}}` avec les entrées restantes à cette étape
  (un générateur de map montre l'itérateur d'OTP `{K, V, Next}`, terminé par
  `none`). Les filtres à l'intérieur d'un groupe zip sont des erreurs
  sémantiques. Quand des générateurs souples et stricts d'un même groupe
  partagent une variable, la règle de saut peut différer d'OTP
  ([différences](differences.md)).
- Une entrée qui n'est pas une map lève `error:{bad_generator, Input}` avant le
  début d'un générateur de map, même à l'intérieur d'un groupe zip.
- Une entrée de liste qui n'est pas une liste, ou une queue impropre, et une
  entrée de bitstring qui n'est pas une bitstring lèvent
  `error:{bad_generator, Tail}` une fois les éléments précédents traités.
- Un filtre qui est un test de guard (`erl_lint:is_guard_test/3` d'OTP :
  syntaxe de guard n'appelant que des BIF de guard non masqués, anciens tests
  de type au niveau supérieur) rejette l'élément en cas d'échec quelconque,
  comme un guard. Tout autre filtre doit renvoyer `true` ou `false` ; les
  autres valeurs lèvent `error:{bad_filter, Value}` et ses exceptions se
  propagent.
- Un qualificateur de correspondance au niveau supérieur (`P = E`) est une
  erreur sémantique sauf si la fonctionnalité expérimentale `compr_assign` est
  activée ; son exécution n'est alors pas implémentée (capacité).

Chaque générateur est une boucle dans le corps de la fonction dont le curseur
d'entrée (un reste de liste ou de bitstring, ou une map et une position) vit
dans des emplacements de termes du cadre ; les éléments produits s'accumulent à
l'envers dans un autre emplacement de terme et deviennent la liste, la
bitstring jointe ou la map une seule fois à la fin, de sorte que les longues
entrées ne demandent qu'une pile native et de processus constante.

## Formes de motifs

| Forme | Règle | Rejet |
| --- | --- | --- |
| `_` | Ne lie jamais ; occurrences indépendantes | Lire `_` est sémantique |
| `Name`, `_Name`, répétitions | Affectation unique ; les répétitions exigent l'égalité exacte (`1` ≠ `1.0`) | Lecture non liée/non sûre sémantique ; l'inégalité ne correspond pas |
| `P1 = P2`, parenthèses | Les deux contraignent la même valeur ; pas de liaisons de clé/taille entre frères | Dépendance illégale entre frères sémantique |
| Atomes, entiers, caractères, flottants | Égalité exacte ; zéro signé distinct | Non-correspondance |
| Arithmétique constante | Opérateurs de motif d'OTP réduits exactement ; `1 div 0` et les non-constantes rejetés | Sémantique |
| Tuples, listes, queues impropres, chaînes | Arité exacte et forme cons/nil ; les chaînes sont des listes | Non-correspondance |
| `"prefix" ++ Tail` | Préfixe chaîne littérale ou liste d'entiers littérale uniquement | Préfixe variable sémantique |
| `#{K := P}` | `:=` uniquement ; clés supplémentaires autorisées ; `#{}` teste le type ; les clés sont des expressions de guard sur les liaisons entrantes | `=>`, clé non liée sémantique ; clé manquante ne correspond pas |
| Bitstrings | Type/taille/unité validés ; les segments précédents peuvent dimensionner les suivants ; queue sans taille en dernier | Spécificateur invalide sémantique ; données trop courtes ne correspondent pas |
| Records tuples `#r{f = P}`, `#r.f` | Développés en contraintes de tuple ; champs omis non contraints | Record/champ inconnu sémantique |
| Native records locaux `#r{f = P}` | Record de ce module nommé `r`, puis chaque champ listé (un champ absent échoue) | Record inconnu sémantique |
| Native records qualifiés/importés `#m:r{f = P}` | Record du module `m` nommé `r` ; exporté quand un champ est listé ; puis chaque champ | Aucun à la compilation |
| Records anonymes `#_{f = P}` | Tout native record ; exporté ou défini dans ce module quand un champ est listé | `#_{...}` comme expression est une erreur |
| Appels, arithmétique sur variables, autres expressions | Pas des motifs | Sémantique |

## Portées

Les clés de map et les tailles de binary lisent l'environnement entrant,
jamais les frères : `#{K := V} = #{key := K}` et `<<X:N>> = <<N:8>>` ne
peuvent pas lier leur propre clé ou taille. Dans un même binary, une taille
peut lire les segments précédents : `<<N:8, X:N>>` est légal ;
`{N, <<X:N>>}` exige que `N` soit lié auparavant. Une arithmétique constante
erronée dans une clé ou une taille est légale et échoue au moment de la
correspondance.

La validation des binaries rejette les segments conteneurs imbriqués/alias, les
modificateurs contradictoires, les plages d'unité incorrectes, l'unité sans
taille pour les valeurs par défaut entier/flottant, les tailles/unités UTF
invalides, les chaînes littérales typées/dimensionnées et les segments binary
sans taille qui ne sont pas en dernière position.

## Exécution

- Un plan de correspondance plat par tête/côté gauche sur les emplacements
  d'arguments d'origine ; les alias partagent une entrée, les premières
  définitions lient des valeurs SSA, les répétitions émettent des tests
  d'égalité exacte. Les vérifications de forme précèdent l'extraction, qui lit
  les cellules en ligne quand elle le peut et appelle sinon des services
  vérifiés du runtime.
- Les clauses s'exécutent dans l'ordre du source, chacune avec un
  environnement neuf qui recharge les arguments d'origine. Une
  non-correspondance de tête ou un rejet de guard passe à la clause suivante ;
  les erreurs du corps et les échecs d'infrastructure ne réessaient jamais les
  clauses suivantes.
- Un `case` évalue son expression examinée une seule fois, puis essaie chaque
  clause dans l'ordre avec cette expression comme unique entrée du plan : une
  non-correspondance de motif ou un rejet de guard (erreurs de guard
  comprises) passe à la clause suivante, l'épuisement lève
  `{case_clause, Value}`. Chaque clause part des liaisons d'avant le case ; la
  valeur du case et chaque liaison exportée se rejoignent en un PHI par valeur.
- Un `if` est un `case` sans expression examinée ni motifs : chaque guard de
  clause est essayé dans l'ordre (une erreur de guard rejette la clause),
  l'épuisement lève `if_clause`, et les valeurs et exports se rejoignent de la
  même façon.
- `begin`/`end` exécute sa séquence dans la portée englobante et produit sa
  dernière valeur.
- Les séquences de corps s'exécutent dans l'ordre et renvoient la dernière
  valeur. Une correspondance évalue son côté droit une seule fois, lie les
  nouveaux noms, vérifie ceux qui existent et renvoie le côté droit (y compris
  pour `_ = RHS`). Les chaînes évaluent d'abord le côté droit le plus interne.
- Les atomes littéraux chargent des liaisons de module ; la correspondance
  n'interne jamais d'atomes.
- Les têtes à variables inconditionnelles se compilent en un IR de projection
  compact.

## Limites

La normalisation des motifs partage le budget sémantique du module
(1 000 000 unités, ou 32 par expression pour les modules plus grands) (un
entier coûte environ son nombre de chiffres décimaux) ; une constante au-delà
de la limite des entiers de 4 194 240 bits est un `illegal pattern`, comme dans
OTP ([termes](terms.md#integers)). Chaque plan de correspondance a un plafond
de 100 000 unités de travail. L'analyseur limite séparément l'imbrication à
256 (plafond strict 512).
