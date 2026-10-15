---
source: docs/README.md
sourceCommit: 6ed3851c
sourceSha256: 42d519fef371b8ba151942ea3a92a7ab67b3f1f6aaae2cf1f40c9cc18b5df542
translatedAt: 2026-10-15
---
# Documentation de Clause

Notes de référence succinctes sur l'implémentation actuelle. Chaque fichier
décrit le comportement et les limites qui existent aujourd'hui ; les plans et
l'historique des étapes se trouvent dans `.agents/`.

| Sujet | Document |
| --- | --- |
| Prétraitement (comportement d'`epp`, inclusions, macros, fonctionnalités) | [preprocessor.md](preprocessor.md) |
| Analyse syntaxique, propriété de l'AST, limites de syntaxe | [parser.md](parser.md) |
| Projets TOML et sélection de la cible | [projects.md](projects.md) |
| CLI du compilateur, artefacts, SDK LLVM, exemple | [compile.md](compile.md) |
| Point d'entrée des exécutables, arguments, code de sortie, flux de sortie, édition de liens | [executables.md](executables.md) |
| Informations de débogage (`-g`), débogueurs et pile d'appels Erlang | [debugging.md](debugging.md) |
| Profilage optionnel (`--profile FILE`) : entrées et temps propre par fonction et par processus | [profiling.md](profiling.md) |
| Parse transforms : chargeur OTP de l'hôte, échange au format abstrait, recherche des transformations | [transforms.md](transforms.md) |
| Analyse sémantique, types, inférence, liaisons | [semantic.md](semantic.md) |
| Politique de spécialisation par type | [specialization.md](specialization.md) |
| ABI du code généré : termes, symboles, enregistrement, échecs, racines | [abi.md](abi.md) |
| Motifs, clauses et correspondances dans le corps | [patterns.md](patterns.md) |
| Guards et catalogue des BIF de guard | [guards.md](guards.md) |
| Représentations des termes (atomes, nombres, conteneurs, maps, bits, records) et affichage | [terms.md](terms.md) |
| Native records, records qualifiés et anonymes (OTP 29) | [native-records.md](native-records.md) |
| Valeurs fonctionnelles : `fun F/A`, `fun M:F/A`, appels de funs | [funs.md](funs.md) |
| Builtins de production : catalogue, appels passerelles, funs builtin, enregistrement | [builtins.md](builtins.md) |
| Modules de bibliothèque (sous-ensembles de `lists`, `maps`) compilés avec les programmes | [library.md](library.md) |
| Sortie console : `io:format/1,2`, `io:put_chars/1`, mise en page de `~p` | [io.md](io.md) |
| Cycle de vie du runtime, mémoire, sortie standard, serveur de code, comptabilité de l'ordonnanceur | [runtime.md](runtime.md) |
| Processus : workers de l'ordonnanceur, tranches de temps, `spawn/1,3`, `is_process_alive/1`, liens, signaux de sortie, moniteurs, noms enregistrés | [processes.md](processes.md) |
| Ports : identité, table des ports, pilotes, modes de données, thread d'E/S, E/S standard, fichiers et sockets (décision du plan step 57A) | [ports.md](ports.md) |
| Contrat du tas de processus : disposition des mots, zones, admission, racines, collecte | [runtime-heap.md](runtime-heap.md) |
| Décision sur le modèle d'exécution : cadres, appels, appels terminaux, cession (yield), exceptions | [execution-model.md](execution-model.md) |
| Signalement des fonctionnalités différées (`notimpl`) | [features.md](features.md) |
| Référence épinglée des sources OTP et procédure de rafraîchissement | [otp-reference.md](otp-reference.md) |
| Différences de comportement connues par rapport à Erlang/OTP | [differences.md](differences.md) |
| Référence de validation, modes de test, lacunes par plateforme, historique | [validation.md](validation.md) |

Les anciens comptes rendus de validation par étape et les fichiers JSON de
preuves ont été condensés dans l'[historique de validation](validation.md#history) ;
les originaux complets restent dans l'historique Git (présents pour la dernière
fois au commit `2777c98`).
