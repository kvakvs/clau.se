---
source: docs/README.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: be550511f58d81353b8a28ffdeba68d3c2e49d69eb8cb6688c3867b834199234
translatedAt: 2026-10-26
---
# Documentation de Clause

Notes de référence succinctes sur l'implémentation actuelle. Chaque fichier
décrit le comportement et les limites qui existent aujourd'hui ; les plans et
l'historique des étapes se trouvent dans `.agents/`.

| Sujet | Document |
| --- | --- |
| Compilation de Clause : prérequis, préréglages, options de configuration, tests, contrôle qualité, benchmarks | [building.md](building.md) |
| Prétraitement (comportement d'`epp`, inclusions, macros, fonctionnalités) | [preprocessor.md](preprocessor.md) |
| Analyse syntaxique, propriété de l'AST, limites de syntaxe | [parser.md](parser.md) |
| Projets TOML, sélection de la cible, répertoire de compilation et caches, sources ignorées | [projects.md](projects.md) |
| CLI du compilateur, artefacts, affichage du source et du format abstrait, cache de compilation, SDK LLVM, PCRE2 et zlib, exemple | [compile.md](compile.md) |
| Spécifications ASN.1 : entrées `.asn` et `[[targets.asn1]]`, options d’asn1ct, couverture, modules générés | [asn1.md](asn1.md) |
| Point d'entrée des exécutables, arguments, code de sortie, flux de sortie, édition de liens | [executables.md](executables.md) |
| Informations de débogage (`-g`), débogueurs et pile d'appels Erlang | [debugging.md](debugging.md) |
| Profilage optionnel (`--profile FILE`) : entrées et temps propre par fonction et par processus | [profiling.md](profiling.md) |
| Parse transforms : chargeur OTP de l'hôte, échange au format abstrait, recherche des transformations | [transforms.md](transforms.md) |
| Analyse sémantique, types, inférence, liaisons | [semantic.md](semantic.md) |
| Spécialisation par type à `-O2` : preuves et variantes de représentation | [specialization.md](specialization.md) |
| ABI du code généré : termes, symboles, enregistrement, échecs, racines | [abi.md](abi.md) |
| Motifs, clauses, correspondances dans le corps et comprehensions | [patterns.md](patterns.md) |
| Guards et catalogue des BIF de guard | [guards.md](guards.md) |
| Représentations des termes (atomes, nombres, conteneurs, maps, bits, records) et affichage | [terms.md](terms.md) |
| Native records, records qualifiés et anonymes (OTP 29) | [native-records.md](native-records.md) |
| Valeurs fonctionnelles : `fun F/A`, `fun M:F/A`, fermetures, funs nommées, appels dynamiques | [funs.md](funs.md) |
| Builtins de production : catalogue, appels passerelles, builtins de module, portions, enregistrement | [builtins.md](builtins.md) |
| Cycle de vie du runtime, mémoire, serveur de code, termes persistants, threads, sortie standard, démarrage | [runtime.md](runtime.md) |
| Processus : workers de l'ordonnanceur, messages et receive, liens, moniteurs, noms enregistrés, minuteries, introspection, alias, signaux de sortie | [processes.md](processes.md) |
| Ports : identité, table des ports, pilotes, modes de données, thread d'E/S, ports occupés, sous-processus, E/S standard, fichiers et sockets | [ports.md](ports.md) |
| Contrat du tas de processus : disposition des mots, zones, admission, racines, collecte | [runtime-heap.md](runtime-heap.md) |
| Modèle d'exécution : cadres, appels, appels terminaux, cession (yield), exceptions | [execution-model.md](execution-model.md) |
| Signalement des fonctionnalités différées (`notimpl`) | [features.md](features.md) |
| Référence épinglée des sources OTP et procédure de rafraîchissement | [otp-reference.md](otp-reference.md) |
| Différences de comportement connues par rapport à Erlang/OTP | [differences.md](differences.md) |
| Référence de validation, modes de test, lacunes par plateforme, benchmarks, historique | [validation.md](validation.md) |

Les anciens comptes rendus de validation par étape et les fichiers JSON de
preuves ont été condensés dans l'[historique de validation](validation.md#history) ;
les originaux complets restent dans l'historique Git (présents pour la dernière
fois au commit `2777c98`).

## Bibliothèques

Applications OTP propres à Clause sous `library/`, dans [libraries/](libraries).

| Sujet | Document |
| --- | --- |
| Modules de bibliothèque sous `library/{erts,kernel,stdlib}` compilés avec les programmes, manière dont les programmes les obtiennent, modules fournis et manquants | [library.md](library.md) |
| Sortie console : `io:format`, `io:put_chars`, périphériques, contrôles de format, mise en page de `~p` | [io.md](io.md) |
| Crypto : versions et sources d'OpenSSL, compilation, édition de liens, mode FIPS et programmes FIPS épinglés | [crypto.md](crypto.md) |
| public_key : spécifications ASN.1 et leurs sources, modules générés, `public_key.hrl` | [public_key.md](public_key.md) |
