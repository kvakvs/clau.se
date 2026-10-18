import type { Messages } from "@/messages/en";

export const fr = {
  meta: {
    description:
      "Clause compile Erlang/OTP 29 à l'avance via LLVM en exécutables natifs.",
  },
  nav: {
    label: "Principal",
    home: "Accueil",
    docs: "Documentation",
    benchmarks: "Benchmarks",
    resources: "Ressources",
  },
  theme: {
    label: "Thème de couleur",
    light: "Clair",
    auto: "Auto",
    dark: "Sombre",
  },
  language: {
    label: "Langue",
  },
  footer: {
    tagline: "Erlang, compilé à l'avance.",
    updated: "Mis à jour",
  },
  home: {
    title: "Erlang/OTP 29, compilé en code natif",
    intro:
      "Clause est un compilateur AOT pour Erlang. Il prétraite, analyse et vérifie le code Erlang, le compile via LLVM et produit des exécutables natifs liés à son propre runtime : processus légers sur plusieurs threads ordonnanceurs, passage de messages, ports et ramasse-miettes par processus.",
    status:
      "En cours de développement : un sous-ensemble croissant d'Erlang se compile déjà en exécutables natifs et s'exécute sous Windows et Linux, avec des versions Clause de la plupart des modules runtime qu'appellent kernel et stdlib d'OTP et un ensemble croissant de modules stdlib complets. Reste à venir : la validation sur macOS Apple Silicon et sur du matériel ARM natif, des comparaisons plus larges avec les suites de tests d'OTP, et davantage d'optimisation ; la page des benchmarks montre où se situe Clause par rapport à OTP. La documentation indique ce qui fonctionne et en quoi Clause diffère d'Erlang/OTP.",
    ctaDocs: "Lire la documentation",
    ctaSource: "Code source sur GitHub",
    cardsTitle: "Fonctionnalités",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Syntaxe Erlang moderne",
        text: "Préprocesseur et parseur pour Erlang/OTP 29 : macros, records, records natifs, maps, bitstrings, comprehensions, maybe et spécifications de types.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "Backend LLVM",
        text: "Compile en LLVM IR vérifié, en bitcode ou en objets natifs avec O0, O2 ou Os, avec une optimisation à l'édition de liens optionnelle entre modules.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Exécutables natifs",
        text: "Lie les modules Erlang, le sous-ensemble de la bibliothèque qu'ils utilisent et le runtime en un programme autonome avec Clang, en une seule commande. Les escripts se compilent aussi.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Processus Erlang",
        text: "Processus dotés de leur propre tas et ramasse-miettes générationnel, répartis sur des files d'exécution par worker entre les threads ordonnanceurs, avec receive sélectif, délais d'attente, liens, moniteurs et noms enregistrés.",
      },
      {
        id: "library",
        property: "string · json · rand",
        title: "Modules de bibliothèque OTP",
        text: "Toutes les fonctions documentées de lists, maps, string, unicode, json, rand, calendar et des modules de collections, pour la plupart en builtins runtime, ainsi que re sur PCRE2 et zlib, avec les résultats et erreurs d'OTP 29.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Ports et E/S",
        text: "Fichiers, entrée et sortie standard, sous-processus et sockets TCP/UDP via des ports, servis par un unique thread d'E/S événementiel.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Inférence de types",
        text: "Infère des types de fonctions par clause ; en O2, ils suppriment des vérifications à l'exécution et sélectionnent des variantes spécialisées par type, avec une version générique de repli.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Applique les parse transforms comme le fait erlc, en les exécutant pendant la compilation sur un Erlang/OTP 29 installé sur l'hôte ; les exécutables n'ont jamais besoin d'OTP.",
      },
      {
        id: "targets",
        property: "7 cibles",
        title: "Multiplateforme",
        text: "Exécution native validée sous Windows x64 et Linux x86-64 ; runtime testé sur x86 32 bits et, en émulation, sur ARM. Objets pour sept cibles, Apple Silicon compris.",
      },
    ],
    detailsTitle: "Fonctionnalités en détail",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Prétraitement : macros, include, include_lib (y compris depuis des répertoires d'applications versionnés), compilation conditionnelle et fonctionnalités du langage",
          "Parse transforms exécutées sur un Erlang/OTP 29 de l'hôte, ms_transform et qlc d'OTP compris ; --print-abstr affiche les formes du format abstrait",
          "Syntaxe Erlang/OTP 29 : expressions, motifs, records, bitstrings, types et spécifications, structures de contrôle et comprehensions",
          "Vérification de la syntaxe, affichage du code expansé et arbre syntaxique indenté",
          "Diagnostics sur le code source de plusieurs fichiers d'entrée",
        ],
      },
      {
        id: "language",
        title: "Sémantique Erlang",
        items: [
          "Filtrage par motif et guards dans les clauses de fonctions, case, if, receive et les correspondances dans le corps",
          "maybe, et comprehensions de listes, de binaries et de maps",
          "Records avec mises à jour et record_info/2 ; records natifs, qualifiés et anonymes",
          "Funs avec captures, funs nommés, appels dynamiques et apply",
          "Exceptions : error, exit, throw, catch, try ... of ... catch ... after, et traces de pile",
          "Attributs de module : vérification des callbacks de -behaviour, -import, attributs informatifs et génération de module_info/0,1",
        ],
      },
      {
        id: "compiler",
        title: "Compilateur",
        items: [
          "Analyse sémantique : vérification du sous-ensemble, liaison des variables, résolution des appels, types déclarés et inférés",
          "Inférence de types avec des types de fonctions par clause ; une spécification qui contredit les types d'arguments inférés est une erreur de compilation, les autres contradictions sont des avertissements",
          "L'inférence ne couvre que le code atteint par la fonction d'entrée ; les résultats pour OTP et les répertoires de bibliothèques configurés sont mis en cache par module",
          "LLVM O0, O2 et Os ; objets, IR et bitcode par module ; instantanés d'IR et listings assembleur annotés avec le code Erlang",
          "Le code généré alloue, teste les types, lit les tuples, listes et maps, concatène les listes courtes, construit et filtre les binaries, crée des closures et calcule sur les flottants en ligne, n'appelant le runtime que sur les chemins lents",
          "O2 supprime les vérifications de type et de forme prouvées par l'inférence, avec un nombre borné de variantes spécialisées par type",
          "Optimisation à l'édition de liens entre modules avec --lto",
          "Les exécutables omettent les exports que leur fonction d'entrée ne peut pas atteindre ; --keep-exports les conserve tous",
          "Rapports de types : code source annoté avec les signatures de fonctions inférées",
          "Vrais appels terminaux et récursion profonde sur une pile explicite par processus",
          "Un message notimpl explicite pour du code Erlang valide qui nécessite une fonctionnalité pas encore implémentée",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Bibliothèque runtime en C++23 sans LLVM, liée à chaque programme",
          "Entiers en précision arbitraire, flottants, atomes, tuples, listes, maps, bitstrings, records, funs, pids, ports et références",
          "Processus, messages, receive sélectif, liens, moniteurs, noms enregistrés et minuteries sur plusieurs threads ordonnanceurs, chacun avec sa propre file d'exécution",
          "Tas par processus avec ramasse-miettes générationnel par copie, min_heap_size, binaires partagés hors tas, zones de littéraux de module et limites de mémoire optionnelles",
          "Ports pour les fichiers, les E/S standard, les sous-processus et les sockets TCP/UDP sur un unique thread d'E/S événementiel",
          "Le module erlang : dictionnaire de processus, format de terme externe avec compression, temps et minuteries, introspection des processus, options de spawn, alias, ainsi que phash et phash2 avec les valeurs d'OTP pour tout sauf les pids, ports, références, funs et native records",
          "Chaque export OTP 29 d'un module de bibliothèque Clause se compile ; les fonctions pas encore implémentées lèvent not_implemented à l'appel",
          "io:format, io:fwrite et io:put_chars vers tout périphérique d'E/S, avec la mise en forme ~p d'OTP ; sous-ensembles de file, gen_tcp, gen_udp, inet, os et code",
          "Modules lists, maps, binary, math, unicode, string, persistent_term, atomics et counters complets",
          "Toutes les fonctions documentées de ordsets, orddict, proplists, dict, sets, gb_trees, gb_sets, queue et array, sur les structures de données d'OTP",
          "Modules calendar, filename, uri_string, json, base64, rand et random complets ; io_lib et son affichage formaté, tout sauf fread",
          "re sur PCRE2 et zlib, construits à partir des versions de bibliothèques fournies avec OTP 29",
          "Versions Clause des modules ERTS qu'appellent kernel et stdlib d'OTP, comme init, erts_internal, erl_prim_loader, prim_eval et unicode_util",
        ],
      },
      {
        id: "tooling",
        title: "Projets et outils",
        items: [
          "Projets TOML avec cibles nommées, découverte des sources, chemins de recherche, répertoires et modules ignorés, et options par cible",
          "Un répertoire de build avec des caches SQLite pour les résultats de compilation, la sortie des parse transforms et les résultats d'inférence",
          "Inspection avec --print-inputs, --print-env et --print-stage-times",
          "Projets de départ commentés avec clau --new-project",
          "Une seule commande clau, du code Erlang à l'exécutable natif ; les escripts se compilent aussi",
          "Tables de lignes de débogage avec -g (CodeView ou DWARF 5) et profilage optionnel avec --profile",
          "Comportement vérifié par rapport aux sorties de l'Erlang/OTP de référence",
          "Benchmarks de performance face à l'Erlang/OTP de l'hôte, lancés manuellement",
          "Exécutions avec les sanitizers d'adresses, de comportement indéfini et de threads sous Linux",
        ],
      },
    ],
  },
  docs: {
    title: "Documentation",
    notReady: "La documentation n'est pas encore prête.",
    meanwhile:
      "En attendant, vous pouvez lire les notes de développement du dépôt du projet. Elles décrivent l'implémentation actuelle et ses limites.",
    synced: "Synchronisé depuis le commit",
    startHere: "Commencer ici",
    reference: "Notes de référence",
    notWritten: "Pas encore rédigé. En attendant, voir :",
    allDocs: "Toute la documentation",
    englishOnly:
      "Cette page n'est pas encore traduite ; elle est donc affichée en anglais.",
    outdated:
      "L'original anglais a changé depuis cette traduction ; certaines parties peuvent donc être obsolètes.",
    translated: "Traduit de l'original anglais",
    readEnglish: "Lire en anglais",
    featured: {
      gettingStarted: {
        title: "Premiers pas",
        text: "Prérequis : CMake, un compilateur C++23, Clang, le SDK LLVM 23, Boost et toml++ ; CMake télécharge les autres bibliothèques. Erlang/OTP est facultatif.",
      },
      building: {
        title: "Compiler le compilateur",
        text: "Configurer, compiler et tester avec les presets CMake sous Linux, macOS et Windows.",
      },
      using: {
        title: "Utiliser le compilateur",
        text: "Options de ligne de commande, modes d'inspection, exécutables, projets TOML et parse transforms.",
      },
      interpreting: {
        title: "Comment interpréter les résultats",
        text: "Essayer Clause sur du code Erlang existant : ce qui compile aujourd'hui, ce que signifient les messages notimpl et quoi essayer ensuite.",
      },
      differences: {
        title: "Différences connues avec Erlang/OTP",
        text: "Comportements observables où Clause diffère sciemment d'OTP 29.",
      },
    },
  },
  benchmarks: {
    title: "Benchmarks",
    intro:
      "Clause comparé à Erlang/OTP sur une même machine : les mêmes programmes Erlang, compilés par erlc et par clau -O2, chronomètrent leurs noyaux après un appel de préchauffage. Ces chiffres évoluent à chaque optimisation.",
    geomean:
      "Moyenne géométrique des temps des noyaux, Clause -O2 face au JIT de BEAM (OTP)",
    slowerOnAverage: "plus lent en moyenne",
    fasterOnAverage: "plus rapide en moyenne",
    barFaster: "plus rapide",
    barSlower: "plus lent",
    faster: "Noyaux où Clause est plus rapide",
    first: "Moyenne géométrique au {date}, première exécution enregistrée",
    kernelsTitle: "Temps des noyaux",
    kernelsNote:
      "Médiane de {runs} exécutions en millisecondes. La barre montre le temps de Clause divisé par celui d'OTP sur une échelle logarithmique.",
    noisy: "Les exécutions ont varié de plus de la moitié de la médiane.",
    kernel: "Noyau",
    otp: "OTP JIT",
    clause: "Clause -O2",
    ratio: "Clause ÷ OTP",
    legendFaster: "Clause plus rapide",
    legendSlower: "OTP plus rapide",
    groups: {
      datagen: "Génération de données",
      dataproc: "Traitement de données",
      file: "E/S fichiers",
      gc: "Ramasse-miettes",
      msg: "Passage de messages",
      socket: "Sockets en boucle locale",
    },
    programsTitle: "Programmes complets",
    programsNote:
      "Temps réel en secondes, démarrage compris, médiane des exécutions.",
    program: "Programme",
    historyTitle: "Progression",
    historyNote:
      "Moyenne géométrique du temps de Clause divisé par celui d'OTP pour chaque jour d'exécution enregistré.",
    date: "Date",
    commit: "Commit",
    sizesTitle: "Taille des exécutables",
    sizesNote:
      "Taille en mégaoctets des programmes de test tels que Clause les construit à chaque niveau d'optimisation.",
    sizesHistoryNote:
      "Tailles en -O2 des {count} derniers commits mesurés, du plus ancien au plus récent. Chaque exécution construit aussi une référence (baseline), le commit précédent de Clause (le commit le plus récent antérieur d'au moins un jour à HEAD, ou celui donné par --baseline), en -O2 pour détecter les régressions ; les références apparaissent ici comme des commits à part entière. Le tableau ci-dessous ajoute le total de tous les programmes bench_* et la taille du compilateur clau.",
    sizesTotal: "Tous les programmes bench_*",
    megabytes: "{value} Mo",
    setupTitle: "Configuration",
    machine: "Machine",
    cpus: "{count} processeurs logiques",
    otpVersion: "Erlang/OTP",
    clauseCommit: "Commit Clause",
    runAt: "Exécution",
    reproduce:
      "Pour lancer les benchmarks vous-même, utilisez make benchmark ou make-benchmark.bat dans le dépôt Clause ; les notes de benchmark décrivent les programmes et les options.",
    notes: "Notes de benchmark",
  },
  resources: {
    title: "Ressources",
    intro: "Où trouver le code source et suivre le développement.",
    github: {
      title: "Dépôt GitHub",
      text: "Code source, tickets et historique du développement.",
    },
    credits: "Crédits graphiques",
  },
  notFound: {
    title: "Page introuvable",
    home: "Aller à l'accueil",
  },
} satisfies Messages;
