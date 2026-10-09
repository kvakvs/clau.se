import type { Messages } from "@/messages/en";

export const de = {
  meta: {
    description:
      "Clause kompiliert Erlang/OTP 29 vorab über LLVM zu nativen ausführbaren Programmen.",
  },
  nav: {
    label: "Hauptmenü",
    home: "Start",
    docs: "Dokumentation",
    resources: "Ressourcen",
  },
  theme: {
    label: "Farbschema",
    light: "Hell",
    auto: "Auto",
    dark: "Dunkel",
  },
  language: {
    label: "Sprache",
  },
  footer: {
    tagline: "Erlang, vorab kompiliert.",
  },
  home: {
    title: "Erlang/OTP 29, kompiliert zu nativem Code",
    intro:
      "Clause ist ein AOT-Compiler für Erlang. Er verarbeitet, parst und analysiert Erlang-Quellcode, kompiliert ihn über LLVM und linkt native Programme mit einer eigenen Laufzeitumgebung: leichtgewichtige Prozesse, Nachrichtenaustausch und Garbage Collection pro Prozess.",
    status:
      "In Entwicklung: Eine wachsende Teilmenge von Erlang lässt sich bereits kompilieren und ausführen. Die Dokumentation beschreibt, was funktioniert und wo Clause von Erlang/OTP abweicht.",
    ctaDocs: "Dokumentation lesen",
    ctaSource: "Quellcode auf GitHub",
    cardsTitle: "Funktionen",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Moderne Erlang-Syntax",
        text: "Präprozessor und Parser für Erlang/OTP 29: Makros, Records, native Records, Maps, Bitstrings, Comprehensions, maybe und Typspezifikationen.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "LLVM-Backend",
        text: "Kompiliert zu verifiziertem LLVM-IR, Bitcode oder nativen Objektdateien mit O0, O2 oder Os, mit typspezialisierten Funktionsvarianten.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Native Programme",
        text: "Linkt Erlang-Module und die Laufzeitumgebung mit Clang zu einem eigenständigen Programm, mit einem einzigen Befehl.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang-Prozesse",
        text: "Prozesse auf Scheduler-Threads mit selektivem receive, Timeouts, Links, Monitoren, registrierten Namen und Exit-Signalen.",
      },
      {
        id: "memory",
        property: "GC pro Prozess",
        title: "Isolierter Speicher",
        text: "Jeder Prozess besitzt seinen eigenen Heap, der von einem kopierenden Garbage Collector nach dem klassischen ERTS-Design bereinigt wird.",
      },
      {
        id: "targets",
        property: "7 Zielplattformen",
        title: "Plattformübergreifend",
        text: "Ausführung unter Windows x64 validiert; Objektdateien geprüft für Linux x86, x64, ARM und AArch64, Windows x86 und x64 sowie Apple Silicon.",
      },
    ],
    detailsTitle: "Funktionen im Detail",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Präprozessor: Makros, include, include_lib, bedingte Kompilierung und Sprachfeatures",
          "Erlang/OTP 29-Syntax: Ausdrücke, Muster, Records, Bitstrings, Typen und Spezifikationen, Kontrollfluss und Comprehensions",
          "Syntaxprüfung, Ausgabe des expandierten Quellcodes und eingerückte Syntaxbaum-Ansicht",
          "Diagnosen im Quellcode über mehrere Eingabedateien",
        ],
      },
      {
        id: "compiler",
        title: "Compiler",
        items: [
          "Semantische Analyse: Prüfung der Teilmenge, Variablenbindungen, Aufrufauflösung, deklarierte und inferierte Typen",
          "LLVM O0, O2 und Os; Objektdateien, IR und Bitcode pro Modul; IR-Snapshots mit Erlang-Quellcode als Kommentar",
          "Typberichte: Quellcode mit inferierten Funktionssignaturen",
          "Echte Endrekursion für lokale, entfernte und wechselseitig rekursive Aufrufe",
          "Eine eindeutige notimpl-Meldung für gültiges Erlang, das ein noch nicht implementiertes Feature braucht",
        ],
      },
      {
        id: "runtime",
        title: "Laufzeitumgebung",
        items: [
          "LLVM-freie C++23-Laufzeitbibliothek, in jedes Programm gelinkt",
          "Ganzzahlen beliebiger Genauigkeit, Gleitkommazahlen, Atome, Tupel, Listen, Maps, Bitstrings, Records, Funs, Pids, Ports und Referenzen",
          "Prozesse, Nachrichten, selektives receive, Links, Monitore und registrierte Namen auf Scheduler-Threads",
          "Heap pro Prozess mit kopierendem Garbage Collector und Binärdaten außerhalb des Heaps",
          "Ports für Standard-I/O, Dateien, Unterprozesse und Sockets",
          "Ausnahmen mit try, catch und after sowie Stacktraces",
          "io:format mit der ~p-Formatierung von OTP; Teilmengen von lists, maps, file und io",
        ],
      },
      {
        id: "tooling",
        title: "Projekte und Werkzeuge",
        items: [
          "TOML-Projekte mit benannten Zielen, Quellsuche und Optionen pro Ziel",
          "Kommentierte Startprojekte mit clau --new-project",
          "Ein clau-Befehl vom Erlang-Quellcode zum nativen Programm",
          "Verhalten geprüft gegen die Ausgaben des Referenz-Erlang/OTP",
        ],
      },
    ],
  },
  docs: {
    title: "Dokumentation",
    notReady: "Die Dokumentation ist noch nicht fertig.",
    meanwhile:
      "Bis dahin können Sie die Entwicklernotizen aus dem Projekt-Repository lesen. Sie beschreiben die aktuelle Implementierung und ihre Grenzen.",
    synced: "Synchronisiert von Commit",
    startHere: "Hier beginnen",
    reference: "Referenznotizen",
    notWritten: "Noch nicht geschrieben. Bis dahin siehe:",
    allDocs: "Gesamte Dokumentation",
    englishOnly: "Diese Seite ist noch nicht übersetzt und wird daher auf Englisch angezeigt.",
    outdated:
      "Das englische Original wurde seit dieser Übersetzung geändert, daher können Teile davon veraltet sein.",
    translated: "Übersetzt aus dem englischen Original",
    readEnglish: "Auf Englisch lesen",
    featured: {
      gettingStarted: {
        title: "Erste Schritte",
        text: "Voraussetzungen: CMake, ein C++23-Compiler, Clang, das LLVM SDK, Boost und toml++.",
      },
      building: {
        title: "Den Compiler bauen",
        text: "Konfigurieren, bauen und testen mit CMake-Presets unter Linux, macOS und Windows.",
      },
      using: {
        title: "Den Compiler verwenden",
        text: "Kommandozeilenoptionen, Inspektionsmodi, ausführbare Programme und TOML-Projekte.",
      },
      interpreting: {
        title: "Ergebnisse richtig deuten",
        text: "Clause an vorhandenem Erlang-Code ausprobieren: was heute kompiliert, was notimpl-Meldungen bedeuten und was man als Nächstes versuchen kann.",
      },
      differences: {
        title: "Bekannte Unterschiede zu Erlang/OTP",
        text: "Beobachtbares Verhalten, bei dem Clause bewusst von OTP 29 abweicht.",
      },
    },
  },
  resources: {
    title: "Ressourcen",
    intro: "Wo Sie den Quellcode finden und die Entwicklung verfolgen können.",
    github: {
      title: "GitHub-Repository",
      text: "Quellcode, Issues und Entwicklungsverlauf.",
    },
  },
  notFound: {
    title: "Seite nicht gefunden",
    home: "Zur Startseite",
  },
} satisfies Messages;
