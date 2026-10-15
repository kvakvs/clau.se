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
    benchmarks: "Benchmarks",
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
    updated: "Aktualisiert",
  },
  home: {
    title: "Erlang/OTP 29, kompiliert zu nativem Code",
    intro:
      "Clause ist ein AOT-Compiler für Erlang. Er verarbeitet, parst und analysiert Erlang-Quellcode, kompiliert ihn über LLVM und linkt native Programme mit einer eigenen Laufzeitumgebung: leichtgewichtige Prozesse auf mehreren Scheduler-Threads, Nachrichtenaustausch, Ports und Garbage Collection pro Prozess.",
    status:
      "In Entwicklung: Eine wachsende Teilmenge von Erlang lässt sich bereits heute zu nativen Programmen kompilieren und unter Windows und Linux ausführen, mit Clause-Versionen der meisten Runtime-Module, die kernel und stdlib von OTP aufrufen. Noch ausstehend: Validierung auf macOS mit Apple Silicon und auf nativer ARM-Hardware, umfassendere Vergleiche mit den Testsuites von OTP und weitere Optimierungen; die Benchmark-Seite zeigt, wo Clause im Vergleich zu OTP steht. Die Dokumentation beschreibt, was funktioniert und wo Clause von Erlang/OTP abweicht.",
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
        text: "Prozesse mit eigenem Heap und eigener Garbage Collection, auf Run-Queues pro Worker verteilt über Scheduler-Threads, mit selektivem receive, Timeouts, Links, Monitoren und registrierten Namen.",
      },
      {
        id: "library",
        property: "re · zlib · binary",
        title: "OTP-Bibliotheksmodule",
        text: "Runtime-Builtins für binary, math, unicode, persistent_term, atomics und counters, re über PCRE2 und zlib, mit den Ergebnissen und Fehlern von OTP 29.",
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
        id: "transforms",
        property: "parse_transform",
        title: "Parse-Transforms",
        text: "Wendet Parse-Transforms wie erlc an und führt sie beim Kompilieren auf einem auf dem Host installierten Erlang/OTP 29 aus; die Programme selbst benötigen OTP nie.",
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
          "Präprozessor: Makros, include, include_lib (auch aus versionierten Anwendungsverzeichnissen), bedingte Kompilierung und Sprachfeatures",
          "Parse-Transforms laufen auf einem Erlang/OTP 29 des Hosts, einschließlich ms_transform und qlc von OTP; --print-abstr gibt die Formen im abstrakten Format aus",
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
          "Modulattribute: Prüfung der Callbacks von -behaviour, -import, informative Attribute und generiertes module_info/0,1",
        ],
      },
      {
        id: "compiler",
        title: "Compiler",
        items: [
          "Semantische Analyse: Prüfung der Teilmenge, Variablenbindungen, Aufrufauflösung, deklarierte und inferierte Typen",
          "Typinferenz mit Funktionstypen pro Klausel; eine Spezifikation, die den inferierten Argumenttypen widerspricht, ist ein Kompilierfehler, andere Widersprüche sind Warnungen",
          "Die Inferenz erfasst nur Code, den die Einstiegsfunktion erreicht; Ergebnisse für OTP und konfigurierte Bibliotheksverzeichnisse werden pro Modul zwischengespeichert",
          "LLVM O0, O2 und Os; Objektdateien, IR und Bitcode pro Modul; IR-Snapshots und Assembler-Listings mit Erlang-Quellcode als Kommentar",
          "Generierter Code alloziert, prüft Typen, liest Tupel, Listen und Maps, baut und matcht Binaries, erzeugt Closures und rechnet mit Gleitkommazahlen inline und ruft die Laufzeitumgebung nur auf langsamen Pfaden auf",
          "O2 entfernt durch die Inferenz bewiesene Typ- und Formprüfungen, mit einer begrenzten Zahl typspezialisierter Varianten",
          "Modulübergreifende Link-Time-Optimierung mit --lto",
          "Programme lassen Exporte weg, die ihre Einstiegsfunktion nicht erreichen kann; --keep-exports behält alle",
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
          "Prozesse, Nachrichten, selektives receive, Links, Monitore, registrierte Namen und Timer auf mehreren Scheduler-Threads, jeder mit eigener Run-Queue",
          "Heap pro Prozess mit kopierendem Garbage Collector, Binärdaten und großen Maps außerhalb des Heaps, Literalbereichen pro Modul und optionalen Speicherlimits",
          "Ports für Dateien, Standard-I/O, Unterprozesse und TCP/UDP-Sockets auf einem ereignisgesteuerten I/O-Thread",
          "Das Modul erlang: Prozess-Dictionary, externes Termformat mit Kompression, Zeit und Timer, Prozess-Introspektion, spawn-Optionen, Aliase und Hashing",
          "Jeder Export von OTP 29 eines Clause-Bibliotheksmoduls lässt sich kompilieren; noch nicht implementierte Funktionen lösen beim Aufruf not_implemented aus",
          "io:format, io:fwrite und io:put_chars auf jedes I/O-Gerät, mit der ~p-Formatierung von OTP; Teilmengen von lists, maps, file, gen_tcp, gen_udp, inet, os und code",
          "Vollständige Module binary, math, persistent_term, atomics und counters; Unicode-Konvertierungen",
          "re über PCRE2 und zlib, gebaut aus den Bibliotheksversionen, die OTP 29 mitliefert",
          "Clause-Versionen der ERTS-Module, die kernel und stdlib von OTP aufrufen, etwa init, erts_internal, erl_prim_loader, prim_eval und unicode_util",
        ],
      },
      {
        id: "tooling",
        title: "Projekte und Werkzeuge",
        items: [
          "TOML-Projekte mit benannten Zielen, Quellsuche, Suchpfaden, ignorierten Verzeichnissen und Modulen sowie Optionen pro Ziel",
          "Ein Build-Verzeichnis mit SQLite-Build-Caches für Kompilierergebnisse, die Ausgabe von Parse-Transforms und Inferenzergebnisse",
          "Inspektion mit --print-inputs, --print-env und --print-stage-times",
          "Kommentierte Startprojekte mit clau --new-project",
          "Ein clau-Befehl vom Erlang-Quellcode zum nativen Programm; auch Escripts lassen sich kompilieren",
          "Debug-Zeilentabellen mit -g (CodeView oder DWARF 5) und optionales Profiling mit --profile",
          "Verhalten geprüft gegen die Ausgaben des Referenz-Erlang/OTP",
          "Performance-Benchmarks gegen das Erlang/OTP des Hosts, manuell ausgeführt",
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
        text: "Kommandozeilenoptionen, Inspektionsmodi, ausführbare Programme, TOML-Projekte und Parse-Transforms.",
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
  benchmarks: {
    title: "Benchmarks",
    intro:
      "Clause im Vergleich mit Erlang/OTP auf einer Maschine: Dieselben Erlang-Programme, kompiliert mit erlc und mit clau -O2, messen die Laufzeit ihrer Kernels nach einem Aufwärmaufruf. Diese Zahlen ändern sich mit jeder Optimierung.",
    geomean:
      "Geometrisches Mittel der Kernel-Zeiten, Clause -O2 gegenüber dem BEAM-JIT (OTP)",
    slowerOnAverage: "im Mittel langsamer",
    fasterOnAverage: "im Mittel schneller",
    barFaster: "schneller",
    barSlower: "langsamer",
    faster: "Kernels, bei denen Clause schneller ist",
    first: "Geometrisches Mittel am {date}, dem ersten erfassten Lauf",
    kernelsTitle: "Kernel-Zeiten",
    kernelsNote:
      "Median aus {runs} Läufen in Millisekunden. Der Balken zeigt die Zeit von Clause geteilt durch die von OTP auf logarithmischer Skala.",
    noisy: "Die Läufe schwankten um mehr als die Hälfte des Medians.",
    kernel: "Kernel",
    otp: "OTP JIT",
    clause: "Clause -O2",
    ratio: "Clause ÷ OTP",
    legendFaster: "Clause schneller",
    legendSlower: "OTP schneller",
    groups: {
      datagen: "Datenerzeugung",
      dataproc: "Datenverarbeitung",
      file: "Datei-I/O",
      gc: "Garbage Collection",
      msg: "Nachrichtenaustausch",
      socket: "Loopback-Sockets",
    },
    programsTitle: "Vollständige Programme",
    programsNote:
      "Gesamtlaufzeit in Sekunden, einschließlich Start, Median der Läufe.",
    program: "Programm",
    historyTitle: "Fortschritt",
    historyNote:
      "Geometrisches Mittel der Zeit von Clause geteilt durch die von OTP an jedem erfassten Lauftag.",
    date: "Datum",
    commit: "Commit",
    setupTitle: "Testumgebung",
    machine: "Maschine",
    cpus: "{count} logische CPUs",
    otpVersion: "Erlang/OTP",
    clauseCommit: "Clause-Commit",
    runAt: "Lauf",
    reproduce:
      "Um die Benchmarks selbst auszuführen, make benchmark oder make-benchmark.bat im Clause-Repository verwenden; die Benchmark-Notizen beschreiben die Programme und Optionen.",
    notes: "Benchmark-Notizen",
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
