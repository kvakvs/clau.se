---
source: docs/terms.md
sourceCommit: 06042fa
sourceSha256: a6c1ea20b3bdb7055c6080cff72a2a86c4cdce87eb6bd8944ffce5c709e98d66
translatedAt: 2026-10-09
---
# Représentation des termes

Types admis : atomes/booléens, entiers arbitraires, flottants binary64 finis,
tuples, listes propres/impropres et chaînes, maps, bitstrings et records
ordinaires sous forme de tuples ; native records ([native records](native-records.md)) ;
funs ([valeurs fonctionnelles](funs.md)) ; pids, ports et références locaux
([ci-dessous](#pids-and-references), [ports](ports.md#identity)). Les encodages en
mots se trouvent dans [abi.md](abi.md#terms).

## Propriété

- Les valeurs composées vivent dans le tas de leur processus
  ([runtime](runtime.md#process-memory)). Les pointeurs de processus désignent
  toujours le début d'un objet. L'admission vérifie la propriété : le mot pointe,
  aligné sur un mot, sous le sommet du bloc de tas du processus ou de l'un de ses
  fragments,
  et l'en-tête (ou la cellule cons) à cet endroit correspond à son étiquette
  ([admission](runtime-heap.md#admission)). Les mots étrangers et périmés sont
  rejetés sans aucun chargement. Le type et l'étendue sont décodés depuis l'en-tête.
- Un `Term` hôte pour une valeur du tas est un mot étiqueté brut, valide jusqu'au
  prochain ramassage de son tas ([racines](runtime-heap.md#roots-and-safe-points)) ;
  il n'épingle pas le stockage du tas. Après la destruction du contexte, l'accès
  renvoie `expired_context` ; après un ramassage ultérieur, `stale_term`. Les
  termes peuvent toujours être détruits sans risque.
- La construction valide les enfants, réserve, initialise, puis publie en une
  seule étape ; un échec annule le stockage et les compteurs.
- `Term::from_word(word)` n'admet que les immédiats indépendants du propriétaire ;
  `Term::from_word(word, context)` admet aussi les atomes et les termes du tas de
  ce contexte. La transmission dans un même tas conserve l'identité.
  `copy_to`/`ProcessHeap::add` copient un graphe d'un autre processus du même
  runtime avec son partage ; les fabriques de termes refusent les entrées
  étrangères avec `wrong_owner`
  ([copie entre tas](runtime-heap.md#copying-between-heaps)).
- Les cellules vivent jusqu'à ce qu'un ramassage explicite les trouve
  inaccessibles, ou jusqu'à la destruction du tas.

## Atomes

- `AtomStorage` propre à chaque runtime, internement paresseux selon l'orthographe
  UTF-8 exacte, sans normalisation ni éviction. `RuntimeOptions::max_atoms`
  1..2^26, 2^20 par défaut ; les noms de modules/exports comptent. Les
  orthographes existantes réussissent même à pleine capacité.
- Jusqu'à 255 scalaires Unicode ; vide, NUL et caractères supplémentaires
  autorisés ; UTF-8 malformé/trop long/de substitution rejeté.
- Les charges utiles proviennent d'un compteur global au processus, de sorte
  qu'un mot d'atome d'un runtime étranger est détectable. Les processus 32 bits
  disposent de 2^26 identités au total sur toute leur durée de vie.
- Les Terms d'atomes hôtes épinglent l'orthographe et survivent à la destruction
  du runtime. Déplacer un atome entre runtimes signifie interner `atom_utf8()`
  dans la destination.
- Les booléens sont les atomes `true`/`false`.
- L'internement et la recherche sont sûrs depuis des threads de travail
  d'ordonnanceur concurrents ([threads](runtime.md#threads)) ; une orthographe
  garde un seul mot.

## Entiers

- Les valeurs tenant dans la charge utile de 28/60 bits de la cible sont des
  immédiats ; les plus grandes sont des cellules signe/magnitude immuables. Zéro
  et les petites valeurs sont toujours normalisés en immédiats. Pas de
  rétrécissement des littéraux à la largeur de l'hôte.
- Les `+`, `-`, `*` générés tentent un chemin rapide en ligne sur deux immédiats
  (calcul en double largeur avec bornes explicites), sinon appellent le service
  du runtime.
- `div` tronque vers zéro ; `rem` prend le signe du dividende ; les opérations
  bit à bit utilisent un complément à deux infini ; un décalage négatif inverse
  le sens ; les très grands décalages à droite saturent à 0 ou -1.
- Erreurs : mauvais opérandes et diviseur nul → `badarith` ; `abs/1` → `badarg`.
- Limites : comme ERTS, une magnitude d'au plus `BIG_ARITY_MAX` mots :
  4 194 240 bits sur les cibles 64 bits (65 535 mots), 4 194 272 sur 32 bits
  (131 071 mots) ; le texte décimal suit (1 262 593 et 1 262 602 chiffres). Un
  résultat arithmétique plus grand lève `error:system_limit` dans un corps
  (`ValueOutcome::system_limit`, [ABI](abi.md#failure-channel-revision-2)) et
  fait échouer une garde ; un segment entier qui extrait une valeur plus grande
  ne correspond pas. Le compilateur rejette un littéral au-delà de 4 194 240 bits
  (`illegal integer`, comme le scanner d'OTP) et un motif constant au-delà
  (`illegal pattern`).

## Flottants

- Les bits IEEE binary64 sont transmis au runtime sous forme de huit octets dans
  l'ordre réseau ; NaN et l'infini sont rejetés. Pas de fast-math.
- `+ - *` restent exacts sur deux entiers ; tout opérande flottant utilise
  binary64. `/` convertit toujours les deux. Les résultats non finis et les
  diviseurs nuls → `badarith`.
- `float/1` arrondit au plus proche pair ; `round/1` arrondit les égalités en
  s'éloignant de zéro ; `trunc`, `floor`, `ceil` renvoient des entiers
  arbitraires. Mauvais opérandes → `badarg`.
- L'égalité exacte distingue `1` de `1.0` et `0.0` de `-0.0` ; la comparaison
  numérique compare la partie entière exacte et la fraction du flottant, sans
  jamais arrondir l'entier. `min/max` renvoient le premier opérande en cas
  d'égalité.

## Tuples, listes, chaînes

- Tuple : en-tête d'arité + champs. Cons : mots de tête + queue. `{}` et `[]`
  sont des immédiats. Les chaînes sont des listes de points de code. Les listes
  n'ont pas de longueur maximale hormis la mémoire (budget de tas optionnel
  compris). Les tuples contiennent jusqu'à 16 777 215 éléments
  (`MAX_TUPLE_ARITY`, `MAX_ARITYVAL` d'OTP) ; les constructeurs signalent un tuple
  plus grand comme `resource_limit`, les builtins lèveront `badarg`.
- Services : `hd`, `tl`, `length`, `tuple_size`, `size`, `element` indexé à
  partir de un.

## Maps

- Tables immuables triées selon l'ordre exact des clés. Les clés de construction
  en double gardent la dernière valeur. La construction trie les clés
  (O(n log n) comparaisons ; des clés déjà croissantes sont seulement vérifiées) ;
  les mises à jour insèrent par recherche dichotomique. Pas de plafond de taille
  ni de travail hormis la mémoire, comme dans OTP ; sur les cibles 32 bits, le
  nombre de mots de l'en-tête limite une map à 2^24 - 1 entrées
  (`resource_limit`). Les clés entières et flottantes diffèrent (y compris `0.0`
  et `-0.0`, y compris imbriquées).
- Les mises à jour `K := V` exigent la clé ; `K => V` insère ou remplace. Les
  mises à jour préparent une nouvelle table et la publient une seule fois.
- Erreurs dans un corps : `{badmap, M}`, `{badkey, K}` ; les gardes rejettent à
  la place.
- Services : `is_map`, `map_size`, `map_get`, `is_map_key`, construction, mise à
  jour.

## Bitstrings

- Empaquetées bit de poids fort en premier, avec une longueur exacte en bits et
  un remplissage à zéro. Jusqu'à 64 octets vivent en ligne dans un binary de tas
  dimensionné selon les données ; les valeurs plus grandes utilisent un tampon
  immuable partagé hors du tas, vu par des cellules binary hors tas que les
  queues extraites partagent. Le tampon est imputé une seule fois au processus
  créateur. Il n'y a pas de taille maximale hormis un budget de tas optionnel du
  processus ; les segments entiers sont écrits sans construire un entier aussi
  large que le segment.
- La construction prépare tous les segments avant de publier. Les segments
  entiers sont tronqués ; l'endianness native vient de la disposition des
  données de la cible.
- Segments flottants : largeurs 16/32/64 ; la construction peut encoder l'infini,
  mais le filtrage rejette les champs infinis/NaN. Les correspondances de
  flottants de largeur nulle extraient `0.0`.
- Les segments UTF-8/16/32 valident les scalaires, les substituts et la
  troncature.
- Le filtrage n'avance un curseur de bits explicite qu'en cas de succès ; `:all`
  comme taille explicite est invalide.
- Services : `is_binary`, `is_bitstring`, `bit_size`, `byte_size` (arrondi
  supérieur), `size` (arrondi inférieur), `binary_part/2,3`. Erreurs → `badarg`.

## Records

- Les records ordinaires se développent en tuples `{Tag, Fields...}`. Les
  déclarations doivent précéder l'utilisation ; les doublons, champs inconnus,
  références en avant/à soi-même et champs joker invalides sont des erreurs.
- La construction évalue les champs dans l'ordre de déclaration : valeur
  explicite, sinon valeur par défaut joker `_ = V`, sinon valeur par défaut
  déclarée, sinon `undefined`. Chaque valeur par défaut est évaluée séparément à
  chaque utilisation.
- Les motifs vérifient l'arité et l'étiquette, puis seulement les champs listés.
  `#r.f` est l'index à partir de un (étiquette en 1).
- L'accès à un champ vérifie l'arité et l'étiquette ; un échec donne
  `{badrecord, V}` dans les corps et un rejet dans les gardes.
- `is_record(V, r)` utilise l'arité déclarée. `is_record/3` exige une étiquette
  atome et une arité entière (non positive → false ; mauvais types → `badarg`) ;
  un troisième argument atome est la requête de native record et renvoie false.
  Les gardes exigent des arguments littéraux.
- La mise à jour `Expr#r{f = V, ...}` évalue les nouvelles valeurs dans l'ordre
  du source, puis `Expr`, puis vérifie l'arité et l'étiquette
  (`{badrecord, Value}` en cas de non-correspondance, y compris pour `Expr#r{}`)
  et construit un nouveau tuple ; les autres champs sont copiés. `_ = V` est
  rejeté dans les mises à jour ; les mises à jour sont interdites dans les motifs
  et les gardes.
- `record_info(fields | size, r)` se développe à la compilation en la liste des
  noms de champs ou la taille du tuple. Les deux arguments doivent être des
  atomes littéraux et `r` un record tuple déclaré auparavant ; c'est interdit
  dans les gardes, et un `record_info/2` local est rejeté comme déjà défini.
- Native records : [native records](native-records.md) (formes locale, qualifiée,
  importée et anonyme).

## Pids et références

Plan 11 step 42. `self/0` renvoie le pid du processus appelant, `make_ref/0` une
nouvelle référence ; `pid_to_list/1` et `ref_to_list/1` renvoient leur texte.

- Un pid est un mot immédiat (quatre bits de poids faible `0x3`) contenant le
  numéro du processus. Les numéros proviennent d'une seule séquence globale au
  processus et ne sont jamais réutilisés, de sorte qu'un runtime n'admet un mot
  de pid que s'il a attribué ce numéro : un mot forgé (jamais attribué) ou le
  pid d'un autre runtime donne `wrong_owner`. Le pid d'un processus terminé reste
  un terme valide, comme dans OTP. Les cibles 32 bits disposent de 2^28 numéros
  par exécution du programme, les cibles 64 bits de 2^60 ; créer un processus
  au-delà échoue avec `resource_limit`.
- Un port (plan step 57B) est un mot immédiat (quatre bits de poids faible
  `0x7`) contenant son numéro issu de sa propre séquence jamais réutilisée,
  admis comme un pid ; il s'affiche sous la forme `#Port<0.N>` et se range entre
  les funs et les pids ([ports](ports.md#identity)).
- Une référence est une cellule du tas (`reference` : en-tête plus un numéro
  64 bits non tracé) admise comme tout terme du tas : seulement dans son propre
  processus, périmée après un ramassage pour un `Term` hôte, copiée par valeur
  entre processus. Les numéros proviennent d'un seul compteur global au
  processus, donc chaque référence d'une exécution du programme est unique.
- L'affichage suit les identités locales d'OTP : un pid sous la forme `<0.N.S>`
  (N les 28 bits de poids faible de son numéro, S le reste), une référence sous
  la forme `#Ref<0.A.B.C>` (C les 18 bits de poids faible de son numéro, B les
  32 suivants, A le reste), dans les styles `~w` et display. Les pids sont
  ordonnés par numéro, les références aussi, de sorte que les références
  ultérieures d'un programme se rangent après les précédentes.

## Comparaison et ordre

Itérative et sans plafond de travail, comme dans OTP : seule la mémoire pour les
paires en attente limite une comparaison, recherches de clés de map comprises, et
des mots identiques sont égaux sans parcours. Les bitstrings alignées sur l'octet
comparent des octets entiers d'un coup. Ordre : nombres < atomes < références <
funs < pids < tuples < native records < maps < nil < listes < bitstrings
(les [funs](funs.md#comparison-and-printing) s'ordonnent entre elles). Les atomes
se comparent selon leur orthographe UTF-8 (ordre des points de code) ; les tuples
par arité puis par champs ; les maps par taille, puis clés, puis valeurs ; les
bitstrings par bits logiques.

## Affichage

`format_term` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
rend tout terme admis dans l'un des deux styles d'OTP. Les entiers, les tuples
(les records sont des tuples) et l'imbrication sont identiques dans les deux.

| | `~w` (`TermStyle::write`) | `erlang:display/1` (`TermStyle::display`) |
| --- | --- | --- |
| Atomes | Entre guillemets sauf s'il commence par une minuscule Latin-1 suivie de caractères de nom (avec `@`) ; les mots réservés et `maybe`/`else` sont entre guillemets ; au-delà de Latin-1, échappement en `\x{H}` | Entre guillemets sauf s'il commence par une minuscule Latin-1 suivie d'alphanumériques ou de `_` ; pas de règle spéciale pour les mots réservés et `@` ; UTF-8 conservé |
| Flottants | Aller-retour le plus court dans la disposition d'OTP : `0.1`, `100.0`, `1.0e16`, `1.5e-7` | `%.6e` du C : `1.500000e+00` |
| Listes | Éléments : `[104,105]`, `[1,2\|3]` | Une liste plate d'octets Latin-1 imprimables s'affiche comme `"hi"` (octets bruts ; seuls `\n` et `"` sont échappés) |
| Bitstrings | `<<1,2,5:3>>` | Un binary ASCII imprimable s'affiche comme `<<"hi">>`, les autres comme `~w` |
| Maps | `#{k => v,k2 => v2}` | `#{k=>v,k2=>v2}` |

- Les maps s'affichent dans l'ordre des clés (`maps:iterator(M, ordered)`, comme
  `~kw` d'OTP). Le `~w` par défaut et `erlang:display/1` d'OTP suivent plutôt sa
  disposition interne : ordre de la table des atomes pour les clés atomes des
  petites maps (il varie d'une exécution de la VM à l'autre) et ordre de hachage
  au-delà de 32 clés. Clause ne reproduit pas cet ordre.
- Le rendu est itératif, la profondeur n'est donc limitée que par le terme. Le
  texte est plafonné à 64 Mio par défaut ; un dépassement (par exemple un
  sous-terme largement partagé) échoue avec `resource_limit` et ne renvoie aucun
  texte partiel.
- Références (goldens) : `runtime_printing` compare les deux styles avec OTP pour
  9 542 valeurs (tous les résultats du corpus plus des cas limites écrits à la
  main) ; les lignes display dont l'ordre des maps OTP est interne sont ignorées
  ([fixtures](../tests/fixtures/printing/README.md)).
