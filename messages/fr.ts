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
    cookies: "Cookies",
  },
  home: {
    title: "Erlang/OTP 29, compilé en code natif",
    intro:
      "Clause est un compilateur AOT pour Erlang. Il prétraite, analyse et vérifie le code Erlang, le compile via LLVM et produit des exécutables natifs liés à son propre runtime : processus légers sur plusieurs threads ordonnanceurs, passage de messages, ports et ramasse-miettes par processus.",
    status:
      "En cours de développement : un sous-ensemble croissant d'Erlang et de stdlib d'OTP se compile déjà en exécutables natifs qui s'exécutent sous Windows et Linux. Reste à venir : macOS Apple Silicon et le matériel ARM natif, les suites de tests d'OTP et davantage d'optimisation. La page des benchmarks montre où se situe Clause par rapport à OTP ; la documentation indique ce qui fonctionne et en quoi Clause diffère.",
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
        text: "Processus légers dotés de leur propre tas et ramasse-miettes sur plusieurs threads ordonnanceurs, avec receive sélectif, liens et moniteurs.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "Bibliothèque OTP",
        text: "Les propres modules stdlib, kernel et ERTS de Clause, avec les exports, résultats et erreurs d'OTP 29, de lists et maps aux tables ETS et aux fichiers dets qu'OTP peut ouvrir.",
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
          "Inférence de types avec des types de fonctions par clause ; les spécifications qui les contredisent sont signalées",
          "LLVM O0, O2 et Os ; objets, IR et bitcode par module ; listings d'IR et d'assembleur annotés avec le code Erlang",
          "Chemins rapides en ligne pour l'allocation, les tests de type, l'accès aux tuples, listes et maps, les binaries, les closures et l'arithmétique sur les flottants",
          "O2 supprime les vérifications de type prouvées par l'inférence et sélectionne des variantes spécialisées par type",
          "Optimisation à l'édition de liens entre modules avec --lto ; les exports inaccessibles sont omis des exécutables",
          "Vrais appels terminaux et récursion profonde sur une pile explicite par processus",
          "Un message notimpl explicite pour du code Erlang valide qui nécessite une fonctionnalité pas encore implémentée",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Bibliothèque runtime en C++23 sans LLVM, liée à chaque programme",
          "Tous les types de termes Erlang, y compris les entiers en précision arbitraire",
          "Processus, messages, receive sélectif, liens, moniteurs, noms enregistrés et minuteries sur plusieurs threads ordonnanceurs",
          "Tas par processus avec ramasse-miettes par copie, binaries partagés hors tas et limites de mémoire optionnelles",
          "Ports pour les fichiers, les E/S standard, les sous-processus et les sockets TCP/UDP sur un unique thread d'E/S événementiel",
          "Tables ETS concurrentes en C++",
        ],
      },
      {
        id: "library",
        title: "Bibliothèque OTP",
        items: [
          "Les propres versions de Clause des modules OTP 29, avec les listes d'exports, les résultats et les motifs d'erreur d'OTP ; les fonctions pas encore implémentées lèvent not_implemented",
          "stdlib : lists, maps, string, unicode, binary, io_lib, json, rand, calendar, les modules de collections, sofs, graph et digraph",
          "ets avec spécifications de filtrage et fichiers de tables, dets avec des fichiers identiques octet par octet à ceux qu'écrit OTP, et ms_transform",
          "re sur PCRE2, zlib et le module erlang",
          "kernel : file, gen_tcp, gen_udp, inet, os et code",
          "Les modules ERTS qu'appellent kernel et stdlib d'OTP",
        ],
      },
      {
        id: "tooling",
        title: "Projets et outils",
        items: [
          "Projets TOML avec cibles nommées, découverte des sources et options par cible",
          "Caches de compilation SQLite pour les résultats de compilation, la sortie des parse transforms et les résultats d'inférence",
          "Projets de départ commentés avec clau --new-project",
          "Une seule commande clau, du code Erlang à l'exécutable natif ; les escripts se compilent aussi",
          "Tables de lignes de débogage avec -g (CodeView ou DWARF 5) et profilage optionnel avec --profile",
          "Testé par rapport à l'Erlang/OTP de référence, avec des exécutions sous sanitizers sous Linux et des benchmarks face à OTP",
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
  cookies: {
    banner:
      "Ce site compte les visites avec Google Analytics, qui ne dépose des cookies qu'après votre accord.",
    accept: "Accepter",
    decline: "Refuser",
    policyLink: "Politique de cookies",
    title: "Politique de cookies",
    intro:
      "clau.se compte les visites avec Google Analytics pour savoir quelles pages sont lues. Google Analytics n'est chargé et ses cookies ne sont déposés qu'après votre accord ; avant cela, ou en cas de refus, rien n'est envoyé à Google.",
    choiceTitle: "Votre choix",
    choice:
      "Refuser ne change rien au site. Le choix peut être modifié à tout moment ; retirer son consentement supprime les cookies de mesure d'audience.",
    current: "Choix actuel : {state}",
    granted: "accepté",
    denied: "refusé",
    unset: "pas encore fait",
    storedTitle: "Ce qui est stocké",
    name: "Nom",
    purpose: "Finalité",
    duration: "Durée",
    rows: [
      {
        name: "_ga",
        purpose: "Cookie Google Analytics : distingue les visiteurs",
        duration: "2 ans",
      },
      {
        name: "_ga_8Y3XJHBHPB",
        purpose: "Cookie Google Analytics : conserve l'état d'une visite",
        duration: "2 ans",
      },
      {
        name: "analytics-consent",
        purpose:
          "Stockage local du navigateur : votre choix concernant les cookies",
        duration: "Jusqu'à son effacement",
      },
      {
        name: "theme, locale",
        purpose:
          "Stockage local du navigateur : le thème de couleur et la langue choisis",
        duration: "Jusqu'à son effacement",
      },
    ],
    googleTitle: "Google Analytics",
    google:
      "Google Analytics est un service de Google. Avec votre accord, il reçoit les pages visitées, la page de provenance, le type de navigateur et d'appareil et une localisation approximative déduite de l'adresse IP.",
    googleLink: "Comment Google utilise ces informations",
    contact: "Questions sur cette politique :",
  },
  notFound: {
    title: "Page introuvable",
    home: "Aller à l'accueil",
  },
} satisfies Messages;
