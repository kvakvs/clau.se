---
source: docs/preprocessor.md
sourceCommit: a8c3f8f6
sourceSha256: 57dcb1da3315eb173341c8100e17e37df776b01f85f4c06585c1b7e5d3503daf
translatedAt: 2026-10-17
---
# Préprocesseur

Réimplémentation native en C++ d'`epp` d'OTP pour le source épinglé de
`maint-29`. Boost.Parser gère les règles de caractères ; des métadonnées
partagées du compilateur fournissent la précédence des opérateurs. Les jetons
développés ne sont jamais reconvertis en texte source.

`PreprocessorSession` renvoie les formes développées (y compris les attributs
`-file` implicites), des diagnostics structurés et des instantanés immuables des
fonctionnalités par forme ; `features()` expose l'état final de la session pour
l'analyseur. C'est une interface interne, pas un format d'étape public.
`DirectiveReader` est l'ancienne API purement syntaxique.

## Comportement pris en charge

- Macros objet et macros surchargées par arité, substitution brute, arguments
  bloc/fun imbriqués, transformation en chaîne avec l'orthographe canonique des
  jetons d'OTP, redéfinition, suppression de définition et diagnostics de cycles
  de dépendances.
- Imbrication des conditionnelles avec effets et erreurs ignorés dans les
  branches sautées, diagnostics de fin de fichier.
- `-include`/`-include_lib`, têtes de chemin en variable d'environnement,
  récursion surveillée.
- `?MODULE`, `?BASE_MODULE` (et les formes `_STRING`), `?FILE`, `?LINE`,
  `?FUNCTION_NAME`/`?FUNCTION_ARITY`, `?FEATURE_AVAILABLE`/`?FEATURE_ENABLED`,
  `?OTP_RELEASE` (29) et `?MACHINE` (`'BEAM'`, uniquement pour la compatibilité
  des sources).
- Évaluation des guards de `-if`/`-elif` avec des entiers arbitraires et le
  catalogue des BIF de guard d'OTP ; aucun appel arbitraire n'est exécuté.
- Fonctionnalités d'OTP 29.1 : `maybe_expr` (activée par défaut, contrôle
  `maybe`/`else`) et `compr_assign` (expérimentale, désactivée). La valeur
  initiale `all` sélectionne les deux ; `-feature(all, ...)` dans le source est
  invalide, comme dans epp. Les autres noms sont des erreurs.

## Politiques de compatibilité

- Recherche des inclusions : répertoire du fichier courant, répertoire de
  travail, puis chemins d'inclusion dans l'ordre de l'API. La CLI inverse les
  `-I` répétés pour correspondre à `erlc`. Les chemins absolus contournent la
  recherche. `include_lib` essaie les chemins ordinaires, puis les répertoires
  d'application fournis explicitement, puis les répertoires `<app>-<version>`
  des releases sous chaque répertoire parcouru (les versions sont des chiffres
  séparés par des points, comme les lit le serveur de code d'OTP ; la plus
  haute l'emporte). Plusieurs versions d'une même application produisent un
  avertissement unique par exécution, nommant le répertoire utilisé ; pas de
  serveur de code.
- Les têtes de chemin `$VAR` utilisent un résolveur injecté ; les variables non
  définies restent littérales. Les opérandes d'inclusion ne sont pas développés
  comme macros. Les fichiers sont décodés en UTF-8 ou en Latin-1 déclaré ; les
  règles de chemins de l'hôte s'appliquent quel que soit le CPU cible.
- Les inclusions partagent l'état des macros/fonctionnalités/du module ; chaque
  fichier possède sa pile de conditionnelles et sa correspondance de fichier
  logique.
- Les conditions valident toutes les branches avant l'évaluation en
  court-circuit. Une syntaxe invalide est une erreur ; les variables non liées,
  les résultats non booléens et les exceptions d'évaluation sélectionnent false.
  L'accès aux champs/index de record dans les conditions échoue ; un accès à un
  record non sélectionné par court-circuit est valide.
- La construction de record dans une condition reçoit un diagnostic contrôlé
  (`record construction requires record expansion`) ; epp d'OTP 29.1 plante
  dans ce cas.
- Les valeurs initiales de `-D` sont des termes littéraux normalisés en jetons,
  y compris les binaries et les funs externes que `erl_parse:tokens/1` ne peut
  pas représenter.
- `self()` est un pid synthétique stable et `node()` vaut `nonode@nohost`.
- Un LF juste après le point final d'une inclusion fait avancer la ligne `-file`
  renvoyée ; l'espace, le commentaire et CRLF suivent le `scan_dot` à un
  caractère d'OTP.

## Limites et diagnostics

Valeurs par défaut (configurables via `PreprocessorLimits`) : 256 niveaux de
développement et 1 000 000 jetons produits par forme, profondeur d'inclusion 64,
imbrication d'expressions 256, plus des bornes fixes de 4 194 240 bits pour les
entiers (la limite d'OTP sur les hôtes 64 bits) et 1 000 000 bits pour les
valeurs bitstring. L'épuisement est un diagnostic de ressource, jamais une
condition fausse silencieuse.

Les diagnostics portent une catégorie stable, une sévérité, des étendues
physiques, des coordonnées logiques optionnelles et les étendues de
macros/inclusions associées. Les avertissements ne font pas échouer ; les
erreurs mémorisent l'échec tandis que la récupération continue à la frontière
de forme suivante.

## Tests

Les références de jetons (`tests/fixtures/preprocessor/semantic/*.erl.tokens`)
consignent les types de jetons d'epp, les valeurs décodées (flottants sous forme
de bits binary64) et l'ordre des diagnostics ; la formulation n'a pas à être
identique à celle d'OTP. Les en-têtes inclus (`semantic/headers/*.hrl`) sont
écrits localement, non copiés d'OTP.
`preprocessor_workflow` couvre de vrais arbres d'inclusion, l'ordre des options,
l'environnement, Latin-1 et des cas de conditions via la CLI.
