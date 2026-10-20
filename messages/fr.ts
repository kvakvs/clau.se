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
        text: "Prétraite et analyse le source Erlang/OTP 29, records natifs compris.",
      },
      {
        id: "benchmarks",
        property: "{ratio} {side}",
        title: "Vitesse face à OTP",
        text: "Moyenne géométrique de {count} noyaux de test, Clause -O2 face au JIT de BEAM.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Exécutables natifs",
        text: "Une commande du source Erlang à un programme autonome, compilé via LLVM avec optimisation à l'édition de liens. Les escripts aussi.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Processus Erlang",
        text: "Processus légers avec ramasse-miettes par processus sur plusieurs threads ordonnanceurs.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "Bibliothèque OTP",
        text: "Les propres stdlib et kernel de Clause, avec les exports, résultats et erreurs d'OTP 29.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Ports et E/S",
        text: "Fichiers, sous-processus et sockets TCP/UDP sur un unique thread d'E/S événementiel.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Inférence de types",
        text: "En O2, les types inférés suppriment des vérifications à l'exécution et sélectionnent du code spécialisé.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Exécute les parse transforms à la compilation ; les exécutables n'ont jamais besoin d'OTP.",
      },
      {
        id: "targets",
        property: "7 cibles",
        title: "Multiplateforme",
        text: "Fonctionne sous Windows x64 et Linux x86-64 ; objets pour sept cibles.",
      },
    ],
    detailsTitle: "Fonctionnalités en détail",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Syntaxe Erlang/OTP 29 : records, maps, bitstrings, comprehensions, types et spécifications",
          "Macros, inclusions et compilation conditionnelle",
          "Parse transforms sur un Erlang/OTP 29 de l'hôte, ms_transform et qlc compris",
        ],
      },
      {
        id: "language",
        title: "Sémantique Erlang",
        items: [
          "Filtrage par motif et gardes dans les clauses, case, if et receive",
          "Records, funs, maybe et comprehensions de listes, binaires et maps",
          "Exceptions avec try, catch et traces de pile",
        ],
      },
      {
        id: "compiler",
        title: "Compilateur",
        items: [
          "Inférence de types avec des types de fonctions par clause",
          "LLVM O0, O2 et Os, avec optimisation à l'édition de liens entre modules",
          "O2 supprime les vérifications de types prouvées par l'inférence",
          "Vrais appels terminaux et récursion profonde",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Runtime C++23 avec tous les types de termes Erlang, entiers en précision arbitraire compris",
          "Processus, receive sélectif, liens, moniteurs et timers sur plusieurs ordonnanceurs",
          "Tas par processus avec un ramasse-miettes par copie",
          "Tables ETS concurrentes en C++",
        ],
      },
      {
        id: "library",
        title: "Bibliothèque OTP",
        items: [
          "Les propres modules OTP 29 de Clause, avec les exports, résultats et raisons d'erreur d'OTP",
          "stdlib : lists, maps, string, binary, json, rand et les modules de collections",
          "ets, dets avec des fichiers tels qu'OTP les écrit, re et zlib",
          "kernel : file, gen_tcp, gen_udp, inet et os",
        ],
      },
      {
        id: "tooling",
        title: "Projets et outils",
        items: [
          "Une seule commande clau du source Erlang à un exécutable natif",
          "Projets TOML avec caches de compilation SQLite",
          "Informations de débogage avec -g (CodeView ou DWARF 5) et profilage avec --profile",
          "Testé face à l'Erlang/OTP de référence et comparé à OTP par des benchmarks",
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
    kernelInfo: {
      "datagen.list_of_tuples":
        "Construit une liste de 200 000 petits tuples, 260 fois",
      "datagen.list_to_tuple":
        "Convertit des listes de 1000 éléments en tuples, 170 000 fois",
      "datagen.map_put":
        "Insère 2000 clés entières dans une map, une à une, 4900 fois",
      "datagen.binary_append":
        "Ajoute 10 000 entiers 32 bits à un binary croissant, 23 000 fois",
      "datagen.bigint_factorial":
        "Calcule la factorielle de 3000 en grands entiers, 330 fois",
      "datagen.string_build":
        "Construit 20 000 chaînes à partir d'entiers et d'atomes, 1000 fois",
      "dataproc.sort": "Trie une liste de 20 000 entiers aléatoires, 600 fois",
      "dataproc.map_foldl":
        "Applique map puis fold à 20 000 entiers, 4500 fois",
      "dataproc.map_update":
        "Incrémente chaque valeur d'une map de 500 clés, 24 000 fois",
      "dataproc.binary_match":
        "Additionne 20 000 entiers 32 bits extraits d'un binary, 49 000 fois",
      "dataproc.int_to_list":
        "Convertit 20 000 entiers en chaînes et inversement, 2000 fois",
      "dataproc.term_to_binary":
        "Encode et décode un grand terme imbriqué, 4300 fois",
      "dataproc.comprehension":
        "Comprehension qui filtre et double 20 000 entiers, 15 000 fois",
      "dataproc.small_map":
        "Met à jour 80 millions de fois une petite map d'état",
      "file.small_files":
        "Écrit, relit et supprime 500 petits fichiers, 11 fois",
      "file.large_write":
        "Écrit un fichier de 16 Mo par blocs de 64 Ko, 200 fois",
      "file.large_read": "Lit un fichier de 16 Mo par blocs de 64 Ko, 370 fois",
      "file.read_line":
        "Lit ligne par ligne un fichier texte de 20 000 lignes, 52 fois",
      "file.read_file":
        "Lit un fichier entier de 16 Mo en un seul appel, 330 fois",
      "gc.short_processes":
        "Lance 5000 processus éphémères qui produisent chacun des déchets, 69 fois",
      "gc.grow_shrink":
        "Fait grossir le tas avec une liste de 200 000 éléments, puis la libère, 300 fois",
      "gc.long_lived_churn":
        "Garde une fenêtre glissante de 10 000 éléments vivants parmi les déchets, 370 fois",
      "gc.explicit_collect":
        "Force le ramasse-miettes avec 10 000 tuples vivants, 5100 fois",
      "msg.ping_pong":
        "Renvoie un message entre deux processus 2 millions de fois",
      "msg.fan_in":
        "100 processus envoient chacun 1000 messages à un seul, 25 fois",
      "msg.ring":
        "Fait passer un jeton 3050 fois dans un anneau de 1000 processus",
      "msg.large_message":
        "Envoie une liste de 100 000 éléments à un autre processus, aller-retour, 560 fois",
      "socket.tcp_echo":
        "Renvoie en écho 30 000 messages de 1 Ko en TCP sur loopback",
      "socket.tcp_connect":
        "Ouvre 900 connexions TCP sur loopback, avec 25 échos de 1 Ko sur chacune",
      "socket.udp_round_trip":
        "Renvoie un datagramme de 1 Ko 27 900 fois en UDP sur loopback",
    },
    programInfo: {
      bench_datagen:
        "Construit en masse listes, tuples, maps, binaries et grands entiers",
      bench_dataproc:
        "Tri, fold, mises à jour de maps, filtrage de binaries, conversions",
      bench_file:
        "Écriture et lecture de petits et grands fichiers, lecture par ligne",
      bench_gc:
        "Processus éphémères, tas qui grossit puis rétrécit, données vivantes",
      bench_msg:
        "Ping-pong, fan-in, anneau de processus et copie de gros messages",
      bench_socket:
        "Écho TCP, connexions TCP et allers-retours UDP sur loopback",
    },
    programsTitle: "Programmes complets",
    programsNote:
      "Temps réel en secondes, démarrage compris, médiane des exécutions.",
    program: "Programme",
    historyTitle: "Progression",
    historyNote:
      "Moyenne géométrique du temps de Clause divisé par celui d'OTP pour chaque jour d'exécution enregistré.",
    pinnedSince:
      "Les exécutions antérieures au {date} n'étaient pas épinglées à un ensemble de processeurs ; une partie de l'évolution de ce jour-là vient donc de l'épinglage.",
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
    cpuSet: "Ensemble de processeurs",
    cpuSetPerformance:
      "Cœurs de performance {list}, {count} sur {total} processeurs logiques",
    cpuSetList: "Processeurs {list}, {count} sur {total} processeurs logiques",
    pinningPerformance:
      "OTP et Clause s'exécutent sur les mêmes processeurs : chaque programme de benchmark est épinglé aux cœurs de performance du processeur, si bien que sur un processeur hybride aucun noyau (kernel) ne tombe sur un cœur d'efficacité plus lent. Les deux gardent un ordonnanceur actif par processeur de cet ensemble, sans le lier à un processeur précis de l'ensemble.",
    pinningList:
      "OTP et Clause s'exécutent sur les mêmes processeurs : chaque programme de benchmark est épinglé à l'ensemble de processeurs ci-dessus. Les deux gardent un ordonnanceur actif par processeur de cet ensemble, sans le lier à un processeur précis de l'ensemble.",
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
