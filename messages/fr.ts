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
  },
  home: {
    title: "Erlang/OTP 29, compilé en code natif",
    intro:
      "Clause est un compilateur AOT pour Erlang. Il prétraite, analyse et vérifie le code Erlang, le compile via LLVM et produit des exécutables natifs liés à son propre runtime : processus légers, passage de messages et ramasse-miettes par processus.",
    status:
      "En cours de développement : un sous-ensemble croissant d'Erlang se compile et s'exécute déjà. La documentation indique ce qui fonctionne et en quoi Clause diffère d'Erlang/OTP.",
    ctaDocs: "Lire la documentation",
    ctaSource: "Code source sur GitHub",
    cardsTitle: "Fonctionnalités",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Syntaxe Erlang moderne",
        text: "Préprocesseur et parseur pour Erlang/OTP 29 : macros, records, records natifs, maps, bitstrings, compréhensions, maybe et spécifications de types.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "Backend LLVM",
        text: "Compile en LLVM IR vérifié, en bitcode ou en objets natifs avec O0, O2 ou Os, avec des variantes de fonctions spécialisées par type.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Exécutables natifs",
        text: "Lie les modules Erlang et le runtime en un programme autonome avec Clang, en une seule commande.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Processus Erlang",
        text: "Processus sur des threads ordonnanceurs avec receive sélectif, délais d'attente, liens, moniteurs, noms enregistrés et signaux de sortie.",
      },
      {
        id: "memory",
        property: "GC par processus",
        title: "Mémoire isolée",
        text: "Chaque processus possède son tas, nettoyé par un ramasse-miettes par copie selon la conception classique d'ERTS.",
      },
      {
        id: "targets",
        property: "7 cibles",
        title: "Multiplateforme",
        text: "Exécution validée sous Windows x64 ; objets vérifiés pour Linux x86, x64, ARM et AArch64, Windows x86 et x64, et Apple Silicon.",
      },
    ],
    detailsTitle: "Fonctionnalités en détail",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Prétraitement : macros, include, include_lib, compilation conditionnelle et fonctionnalités du langage",
          "Syntaxe Erlang/OTP 29 : expressions, motifs, records, bitstrings, types et spécifications, structures de contrôle et compréhensions",
          "Vérification de la syntaxe, affichage du code expansé et arbre syntaxique indenté",
          "Diagnostics sur le code source de plusieurs fichiers d'entrée",
        ],
      },
      {
        id: "compiler",
        title: "Compilateur",
        items: [
          "Analyse sémantique : vérification du sous-ensemble, liaison des variables, résolution des appels, types déclarés et inférés",
          "LLVM O0, O2 et Os ; objets, IR et bitcode par module ; instantanés d'IR annotés avec le code Erlang",
          "Rapports de types : code source annoté avec les signatures de fonctions inférées",
          "Vrais appels terminaux pour les appels locaux, distants et mutuellement récursifs",
          "Un message notimpl explicite pour du code Erlang valide qui nécessite une fonctionnalité pas encore implémentée",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Bibliothèque runtime en C++23 sans LLVM, liée à chaque programme",
          "Entiers en précision arbitraire, flottants, atomes, tuples, listes, maps, bitstrings, records, funs, pids, ports et références",
          "Processus, messages, receive sélectif, liens, moniteurs et noms enregistrés sur des threads ordonnanceurs",
          "Tas par processus avec ramasse-miettes par copie et binaires hors tas",
          "Ports pour les E/S standard, les fichiers, les sous-processus et les sockets",
          "Exceptions avec try, catch et after, et traces de pile",
          "io:format avec la mise en forme ~p d'OTP ; sous-ensembles de lists, maps, file et io",
        ],
      },
      {
        id: "tooling",
        title: "Projets et outils",
        items: [
          "Projets TOML avec cibles nommées, découverte des sources et options par cible",
          "Projets de départ commentés avec clau --new-project",
          "Une seule commande clau, du code Erlang à l'exécutable natif",
          "Comportement vérifié par rapport aux sorties de l'Erlang/OTP de référence",
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
    englishOnly: "Cette page n'est pas encore traduite ; elle est donc affichée en anglais.",
    outdated:
      "L'original anglais a changé depuis cette traduction ; certaines parties peuvent donc être obsolètes.",
    translated: "Traduit de l'original anglais",
    readEnglish: "Lire en anglais",
    featured: {
      gettingStarted: {
        title: "Premiers pas",
        text: "Prérequis : CMake, un compilateur C++23, Clang, le SDK LLVM, Boost et toml++.",
      },
      building: {
        title: "Compiler le compilateur",
        text: "Configurer, compiler et tester avec les presets CMake sous Linux, macOS et Windows.",
      },
      using: {
        title: "Utiliser le compilateur",
        text: "Options de ligne de commande, modes d'inspection, exécutables et projets TOML.",
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
  resources: {
    title: "Ressources",
    intro: "Où trouver le code source et suivre le développement.",
    github: {
      title: "Dépôt GitHub",
      text: "Code source, tickets et historique du développement.",
    },
  },
  notFound: {
    title: "Page introuvable",
    home: "Aller à l'accueil",
  },
} satisfies Messages;
