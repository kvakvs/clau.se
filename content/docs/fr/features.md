---
source: docs/features.md
sourceCommit: 6ed3851c
sourceSha256: bdb726e4ca520adf0644572e0d808482745802ff3316d535cdb5ea6178e5a0a8
translatedAt: 2026-10-15
---
# Signalement des fonctionnalités différées

Un code Erlang légal qui requiert une fonctionnalité non implémentée échoue avec
un unique message explicite, distinct des erreurs ordinaires d'entrée invalide.
Le repli générique pris en charge (par exemple une spécialisation sautée) est
silencieux et n'est pas un échec.

```text
[pattern matching] notimpl: src/example.erl:12:5 [module="example"] [target="native"] [operation="match argument"]
```

## Catalogue

[features.hpp](../abi/include/clause/abi/features.hpp) attribue des
identifiants stables, jamais réutilisés, et des noms de diagnostic, avec un
responsable et un état par entrée. Retirer ou affiner une entrée quand sa
fonctionnalité arrive ; garder son identifiant réservé.

| Responsable | Où il signale |
| --- | --- |
| Analyse sémantique du compilateur | Vérifications de capacité sur toutes les fonctions, y compris le code inutilisé |
| Abaissement du compilateur | Rejet défensif aux opérations atteintes ; supprime les artefacts préparés |
| Pilote | `-o/--output` [lie](executables.md#linking) les entrées positionnelles ou une cible de projet ; les compilations de projet lient chaque cible exécutable vers l'[`output`](projects.md#executables) de son manifeste |
| Services du runtime | Voir [services différés du runtime](runtime.md#deferred-services) |

## Règles des messages

- Le [formateur](../abi/include/clause/abi/feature_diagnostic.hpp) partagé omet
  le contexte inconnu, échappe les octets de contrôle en `\xHH` et échappe les
  guillemets et les barres obliques inverses afin que le contexte ne puisse pas
  injecter de lignes. UTF-8 est conservé.
- Exactement un message par opération en échec, indépendamment de `--verbose`.
- Une fonctionnalité différée que le compilateur pourrait ignorer sans changer
  ce qu'il accepte serait signalée par un avertissement et la compilation
  continuerait ; aucune ne l'est aujourd'hui (`parse transforms` l'était
  jusqu'à ce que le plan step 73F les applique, voir
  [transforms](transforms.md)). `codegen_placeholders` vérifie un message par
  fonctionnalité différée du compilateur.
- Compilateur : [reject_feature](../compiler/src/codegen/features.hpp) signale le
  premier échec d'un lot, mémorise l'échec, abandonne la sortie préparée et marque
  le diagnostic comme `reported` afin que les pilotes ne l'affichent pas de
  nouveau.
- Runtime : [FeatureFailure](../runtime/include/clause/runtime/features.hpp)
  signale une seule fois par opération via un récepteur emprunté (null →
  stderr). Les appels suivants renvoient l'état mémorisé. Les échecs du récepteur
  ou du formatage deviennent `diagnostic_failure` ; les exceptions sont
  contenues.
- Les appelants propagent l'échec sans le signaler de nouveau ; un hôte doit se
  terminer avec un code non nul et se démonter normalement.
