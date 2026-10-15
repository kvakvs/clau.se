---
source: docs/specialization.md
sourceCommit: 6ed3851c
sourceSha256: 896b741de11f8f1f7f9098670798d1de273c0e4be02cb7ebfadca90e184b0e36
translatedAt: 2026-10-15
---
# Spécialisation par type

Le mode vitesse (`-O2`) utilise les [faits inférés](semantic.md#inference) pour
supprimer des vérifications au runtime (preuves) et peut cloner une fonction en
variantes de représentation protégées par des vérifications d'étiquette (tag) au
runtime. `-O0` et `--no-type-specialization` ne produisent que du code
générique : chaque vérification reste, chaque accès composé passe par son
service du runtime.

## Preuves

Une preuve ne provient que de faits qui sont vrais chaque fois que le code
s'exécute :

- les faits des arguments d'une fonction locale, joints depuis tous ses
  appelants (`Inference::inputs` ; les fonctions exportées et les fonctions
  nommées par `fun F/A` n'en ont pas) ;
- le fait enregistré d'une expression (le fait d'un opérande est enregistré
  avant que l'opération qui l'utilise ne le restreigne) ;
- un test de forme antérieur dans le même plan de correspondance : les nœuds
  du plan s'exécutent en ligne, donc un test de tuple ou de cons réussi domine
  chaque nœud ultérieur.

Les spécifications ne prouvent jamais rien. `term()` et `none()` (code que
l'inférence a trouvé inaccessible) ne prouvent rien ; les corps des funs
anonymes n'obtiennent aucune preuve.

| Opération | Prouvée par | Code généré |
| --- | --- | --- |
| `+ - *` | les deux opérandes dans des plages de petits entiers, plage du résultat dans la charge utile immédiate | décodage, calcul et encodage en ligne ; ni étiquette, ni dépassement, ni repli |
| `+ - *` | un ou deux opérandes dans des plages de petits entiers | les tests d'étiquette prouvés disparaissent ; la vérification de dépassement et le repli vers le service restent |
| motif de tuple | fait de l'argument ou de la valeur examinée : tuples exacts de l'arité du motif | test de forme supprimé (non prouvé : testé en ligne) |
| élément de tuple | un test de forme ou un fait prouvant le tuple | chargement en ligne de l'élément |
| motif de liste | fait : sûrement une cellule cons | test de forme supprimé (sinon un test d'étiquette primaire à chaque niveau) |
| tête, queue | un test de cons ou un fait prouvant la cellule | chargements en ligne |
| littéral exact `[]`, `{}`, petit entier, atome | toujours (à chaque niveau depuis OPT0.2A) | comparaison de mots : des immédiats égaux sont un seul mot |
| générateur de liste | fait de l'entrée du générateur : une liste propre | test de cons et lectures de cellules en ligne à chaque itération |

Les faits atteignent les motifs des têtes de fonctions (arguments joints depuis
les appelants), les correspondances dans les corps (le côté droit) et les
clauses case/try (la valeur examinée ou la valeur du corps du try) ; les faits
d'élément, de tête et de queue suivent les extractions. Une lecture en ligne est
stockée dans un emplacement racine comme une sortie de service, de sorte que
l'abaissement des cadres la garde comme terme à travers les points sûrs
([règle de rechargement](runtime-heap.md#reload-rule)). Les seules conversions
de pointeurs dans le code généré sont ces lectures prouvées et les chargements
d'en-tête des tests de forme de tuple en ligne (`proven.cell`).
Les constantes de disposition proviennent de [`abi/term.hpp`](abi.md#terms) ; le
runtime les vérifie par assertion contre ses dispositions privées de cellules.

## Variantes

- Les profils proviennent des faits aux sites d'appel : un argument dont le fait
  ne contient que de petits entiers (singletons ou plages) prouve un argument
  petit entier. Les specs, `integer()` au sens large, les unions avec d'autres
  sortes et les inconnues restent génériques.
- Une variante n'est justifiée que si elle supprime une vérification
  implémentée : une comparaison exacte d'étiquette basse d'un mot d'argument
  n'importe où dans le corps (le tableau d'arguments n'est jamais écrit, et une
  collecte ne change jamais un petit entier).
- Limites : 3 variantes par fonction, 32 par module, 128 par cible. La
  croissance estimée puis réelle (clone + gardes + aiguillage + repli) doit
  rester inférieure à 2x le nombre d'instructions génériques par fonction et par
  module.
- Les corps génériques sont toujours conservés. Les ébauches qui dépassent le
  budget sont abandonnées silencieusement ; le programme n'échoue jamais à cause
  de la spécialisation.
- La sélection est déterministe (ordre module, symbole, profil).

Le clonage et la simplification LLVM remplacent les vérifications prouvées à
l'intérieur du clone. Un aiguilleur borné teste chaque étiquette contrainte et
transmet le contexte et les arguments à une variante ou au corps générique ; le
symbole public et l'ABI ne changent pas. Aucune hypothèse tirée des specs ni
aucun drapeau fast-math n'est introduit.

## Effet actuel

Les preuves agissent sur du vrai code source : les fonctions locales dont les
appelants passent de petits entiers, des tuples et des listes perdent leurs
vérifications d'étiquette, de forme et de service
([`proofs`](../tests/fixtures/executables/proofs/proofs.erl), vérifié par le test
CTest `codegen_proofs` et exécuté comme golden d'exécutable
`executables_proofs`). Une variante doit économiser plus d'instructions que son
aiguillage n'en coûte ; un seul test d'étiquette d'argument supprimé y parvient
rarement, si bien que les variantes du source sont généralement planifiées puis
rejetées par la limite de croissance. Des fixtures LLVM ciblées injectent des
vérifications d'étiquette répétées pour exercer les réussites, les replis et
l'annulation en cas de croissance avec une exécution native.

Les goldens d'exécutables s'exécutent sous chaque politique en mode complet ; le
mode rapide exécute `-O0` (générique) et `-O2` avec spécialisation (preuves).

`codegen_measurements` écrit `measurements/<config>/measurements.json` dans le
répertoire de build des tests de codegen (temps de compilation, octets d'IR et
d'objet, variantes, lectures prouvées, temps natif). Les temps sont descriptifs,
jamais des seuils. Échantillon Windows x64 / LLVM 23.1.2 (2026-09-29, avant les
preuves) : charge de travail source de 232 876 octets d'IR / 40 498 octets
d'objet en O0 et 204 408 / 35 886 avec les deux politiques O2, aucune
variante ; la fixture synthétique a ajouté 30 instructions à une fonction de
55 instructions pour une variante acceptée.
