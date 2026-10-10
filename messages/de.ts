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
      "Clause ist ein AOT-Compiler für Erlang. Er verarbeitet, parst und analysiert Erlang-Quellcode, kompiliert ihn über LLVM und linkt native Programme mit einer eigenen Laufzeitumgebung: leichtgewichtige Prozesse auf mehreren Scheduler-Threads, Nachrichtenaustausch, Ports und Garbage Collection pro Prozess.",
    status:
      "In Entwicklung: Eine wachsende Teilmenge von Erlang lässt sich bereits heute zu nativen Programmen kompilieren und unter Windows und Linux ausführen. Noch ausstehend: Validierung auf macOS mit Apple Silicon und auf nativer ARM-Hardware sowie umfassendere Vergleiche mit den Testsuites von OTP. Die Dokumentation beschreibt, was funktioniert und wo Clause von Erlang/OTP abweicht.",
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
        text: "Kompiliert zu verifiziertem LLVM-IR, Bitcode oder nativen Objektdateien mit O0, O2 oder Os, optional mit modulübergreifender Link-Time-Optimierung.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Native Programme",
        text: "Linkt Erlang-Module, die von ihnen genutzte Teilmenge der Bibliothek und die Laufzeitumgebung mit Clang zu einem eigenständigen Programm, mit einem einzigen Befehl. Auch Escripts lassen sich kompilieren.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang-Prozesse",
        text: "Prozesse auf mehreren Scheduler-Threads mit selektivem receive, Timeouts, Links, Monitoren, registrierten Namen und Exit-Signalen.",
      },
      {
        id: "memory",
        property: "GC pro Prozess",
        title: "Isolierter Speicher",
        text: "Jeder Prozess besitzt seinen eigenen Heap, der von einem kopierenden Garbage Collector nach dem klassischen ERTS-Design bereinigt wird.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Ports und I/O",
        text: "Dateien, Standardein- und -ausgabe, Unterprozesse und TCP/UDP-Sockets über Ports, bedient von einem ereignisgesteuerten I/O-Thread.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Typinferenz",
        text: "Inferiert Funktionstypen pro Klausel; mit O2 entfallen dadurch Laufzeitprüfungen, und es werden typspezialisierte Varianten mit generischem Fallback gewählt.",
      },
      {
        id: "debugging",
        property: "-g · --profile",
        title: "Debugging und Profiling",
        text: "Zeilentabellen zum Erlang-Quellcode für native Debugger sowie ein optionaler Kostenbericht pro Funktion und pro Prozess.",
      },
      {
        id: "targets",
        property: "7 Zielplattformen",
        title: "Plattformübergreifend",
        text: "Native Ausführung unter Windows x64 und Linux x86-64 validiert; Laufzeitumgebung getestet unter 32-Bit-x86 und, per Emulation, unter ARM. Objektdateien für sieben Zielplattformen, einschließlich Apple Silicon.",
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
        id: "language",
        title: "Erlang-Semantik",
        items: [
          "Musterabgleich und Guards in Funktionsklauseln, case, if, receive und Match-Ausdrücken im Rumpf",
          "maybe sowie List-, Binary- und Map-Comprehensions",
          "Records mit Updates und record_info/2; native, qualifizierte und anonyme Records",
          "Funs mit erfassten Variablen, benannte Funs, dynamische Aufrufe und apply",
          "Ausnahmen: error, exit, throw, catch, try ... of ... catch ... after sowie Stacktraces",
        ],
      },
      {
        id: "compiler",
        title: "Compiler",
        items: [
          "Semantische Analyse: Prüfung der Teilmenge, Variablenbindungen, Aufrufauflösung, deklarierte und inferierte Typen",
          "Typinferenz mit Funktionstypen pro Klausel; Spezifikationen, die den inferierten Typen widersprechen, sind Kompilierfehler",
          "LLVM O0, O2 und Os; Objektdateien, IR und Bitcode pro Modul; IR-Snapshots mit Erlang-Quellcode als Kommentar",
          "O2 entfernt durch die Inferenz bewiesene Typ- und Formprüfungen, mit einer begrenzten Zahl typspezialisierter Varianten",
          "Modulübergreifende Link-Time-Optimierung mit --lto",
          "Typberichte: Quellcode mit inferierten Funktionssignaturen",
          "Echte Endaufrufe und tiefe Rekursion auf einem expliziten Stack pro Prozess",
          "Eine eindeutige notimpl-Meldung für gültiges Erlang, das ein noch nicht implementiertes Feature braucht",
        ],
      },
      {
        id: "runtime",
        title: "Laufzeitumgebung",
        items: [
          "LLVM-freie C++23-Laufzeitbibliothek, in jedes Programm gelinkt",
          "Ganzzahlen beliebiger Genauigkeit, Gleitkommazahlen, Atome, Tupel, Listen, Maps, Bitstrings, Records, Funs, Pids, Ports und Referenzen",
          "Prozesse, Nachrichten, selektives receive, Links, Monitore, registrierte Namen und Timer auf mehreren Scheduler-Threads",
          "Heap pro Prozess mit kopierendem Garbage Collector, Binärdaten außerhalb des Heaps und optionalen Speicherlimits",
          "Ports für Dateien, Standard-I/O, Unterprozesse und TCP/UDP-Sockets auf einem ereignisgesteuerten I/O-Thread",
          "io:format mit der ~p-Formatierung von OTP; Teilmengen von lists, maps, file, io, gen_tcp, gen_udp, inet und os",
        ],
      },
      {
        id: "tooling",
        title: "Projekte und Werkzeuge",
        items: [
          "TOML-Projekte mit benannten Zielen, Quellsuche und Optionen pro Ziel",
          "Kommentierte Startprojekte mit clau --new-project",
          "Ein clau-Befehl vom Erlang-Quellcode zum nativen Programm; auch Escripts lassen sich kompilieren",
          "Debug-Zeilentabellen mit -g (CodeView oder DWARF 5) und optionales Profiling mit --profile",
          "Verhalten geprüft gegen die Ausgaben des Referenz-Erlang/OTP",
          "Prüfläufe mit Address-, Undefined-Behavior- und Thread-Sanitizer unter Linux",
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
    englishOnly:
      "Diese Seite ist noch nicht übersetzt und wird daher auf Englisch angezeigt.",
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
    credits: "Bildnachweis",
  },
  notFound: {
    title: "Seite nicht gefunden",
    home: "Zur Startseite",
  },
} satisfies Messages;
