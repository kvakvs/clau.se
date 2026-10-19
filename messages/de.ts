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
    cookies: "Cookies",
  },
  home: {
    title: "Erlang/OTP 29, kompiliert zu nativem Code",
    intro:
      "Clause ist ein AOT-Compiler für Erlang. Er verarbeitet, parst und analysiert Erlang-Quellcode, kompiliert ihn über LLVM und linkt native Programme mit einer eigenen Laufzeitumgebung: leichtgewichtige Prozesse auf mehreren Scheduler-Threads, Nachrichtenaustausch, Ports und Garbage Collection pro Prozess.",
    status:
      "In Entwicklung: Eine wachsende Teilmenge von Erlang und stdlib von OTP lässt sich bereits heute zu nativen Programmen kompilieren, die unter Windows und Linux laufen. Noch ausstehend: macOS mit Apple Silicon und native ARM-Hardware, die Testsuites von OTP und weitere Optimierungen. Die Benchmark-Seite zeigt, wo Clause im Vergleich zu OTP steht; die Dokumentation beschreibt, was funktioniert und wo Clause abweicht.",
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
        text: "Leichtgewichtige Prozesse mit eigenem Heap und eigener Garbage Collection auf mehreren Scheduler-Threads, mit selektivem receive, Links und Monitoren.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "OTP-Bibliothek",
        text: "Clause-eigene Module für stdlib, kernel und ERTS mit den Exporten, Ergebnissen und Fehlern von OTP 29, von lists und maps bis zu ETS-Tabellen und dets-Dateien, die OTP öffnen kann.",
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
          "Typinferenz mit Funktionstypen pro Klausel; widersprüchliche Spezifikationen werden gemeldet",
          "LLVM O0, O2 und Os; Objektdateien, IR und Bitcode pro Modul; IR- und Assembler-Listings mit Erlang-Quellcode als Kommentar",
          "Schnelle Inline-Pfade für Allokation, Typprüfungen, Zugriffe auf Tupel, Listen und maps, binaries, Closures und Gleitkommaarithmetik",
          "O2 entfernt durch die Inferenz bewiesene Typprüfungen und wählt typspezialisierte Varianten",
          "Modulübergreifende Link-Time-Optimierung mit --lto; nicht erreichbare Exporte werden aus Programmen weggelassen",
          "Echte Endaufrufe und tiefe Rekursion auf einem expliziten Stack pro Prozess",
          "Eine eindeutige notimpl-Meldung für gültiges Erlang, das ein noch nicht implementiertes Feature braucht",
        ],
      },
      {
        id: "runtime",
        title: "Laufzeitumgebung",
        items: [
          "LLVM-freie C++23-Laufzeitbibliothek, in jedes Programm gelinkt",
          "Alle Erlang-Termtypen, einschließlich Ganzzahlen beliebiger Genauigkeit",
          "Prozesse, Nachrichten, selektives receive, Links, Monitore, registrierte Namen und Timer auf mehreren Scheduler-Workern",
          "Heap pro Prozess mit kopierendem Garbage Collector, gemeinsam genutzten binaries außerhalb des Heaps und optionalen Speicherlimits",
          "Ports für Dateien, Standard-I/O, Unterprozesse und TCP/UDP-Sockets auf einem ereignisgesteuerten I/O-Thread",
          "Nebenläufige ETS-Tabellen in C++",
        ],
      },
      {
        id: "library",
        title: "OTP-Bibliothek",
        items: [
          "Clause-eigene Versionen der OTP-29-Module mit den Exportlisten, Ergebnissen und Fehlergründen von OTP; noch nicht implementierte Funktionen lösen not_implemented aus",
          "stdlib: lists, maps, string, unicode, binary, io_lib, json, rand, calendar, die Collection-Module, sofs, graph und digraph",
          "ets mit Match-Spezifikationen und Tabellendateien, dets mit Dateien, die Byte für Byte denen von OTP entsprechen, sowie ms_transform",
          "re über PCRE2, zlib und das Modul erlang",
          "kernel: file, gen_tcp, gen_udp, inet, os und code",
          "Die ERTS-Module, die kernel und stdlib von OTP aufrufen",
        ],
      },
      {
        id: "tooling",
        title: "Projekte und Werkzeuge",
        items: [
          "TOML-Projekte mit benannten Zielen, Quellsuche und Optionen pro Ziel",
          "SQLite-Build-Caches für Kompilierergebnisse, die Ausgabe von Parse-Transforms und Inferenzergebnisse",
          "Kommentierte Startprojekte mit clau --new-project",
          "Ein clau-Befehl vom Erlang-Quellcode zum nativen Programm; auch Escripts lassen sich kompilieren",
          "Debug-Zeilentabellen mit -g (CodeView oder DWARF 5) und optionales Profiling mit --profile",
          "Getestet gegen das Referenz-Erlang/OTP, mit Sanitizer-Prüfläufen unter Linux und Benchmarks gegen OTP",
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
        text: "Voraussetzungen: CMake, ein C++23-Compiler, Clang, das LLVM 23 SDK, Boost und toml++; die übrigen Bibliotheken lädt CMake herunter. Erlang/OTP ist optional.",
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
    kernelInfo: {
      "datagen.list_of_tuples": "Baut eine Liste aus 200.000 kleinen Tupeln",
      "datagen.list_to_tuple":
        "Wandelt Listen mit 1000 Elementen 100-mal in Tupel um",
      "datagen.map_put": "Fügt 2000 Ganzzahlschlüssel einzeln in eine Map ein",
      "datagen.binary_append":
        "Hängt 10.000 32-Bit-Ganzzahlen an ein wachsendes Binary an",
      "datagen.bigint_factorial":
        "Berechnet die Fakultät von 3000 mit großen Ganzzahlen",
      "datagen.string_build":
        "Baut 20.000 Zeichenketten aus Ganzzahlen und Atomen",
      "dataproc.sort": "Sortiert eine Liste mit 20.000 zufälligen Ganzzahlen",
      "dataproc.map_foldl": "Wendet map und dann fold auf 20.000 Ganzzahlen an",
      "dataproc.map_update":
        "Erhöht jeden Wert einer Map mit 500 Schlüsseln zweimal",
      "dataproc.binary_match":
        "Summiert 20.000 32-Bit-Ganzzahlen, per Matching aus einem Binary",
      "dataproc.int_to_list":
        "Wandelt 20.000 Ganzzahlen in Zeichenketten und zurück",
      "dataproc.term_to_binary":
        "Kodiert und dekodiert einen großen verschachtelten Term",
      "dataproc.comprehension":
        "Comprehension, die 20.000 Ganzzahlen filtert und verdoppelt",
      "dataproc.small_map": "Aktualisiert eine kleine Zustands-Map 20.000-mal",
      "file.small_files": "Schreibt, liest und löscht 500 kleine Dateien",
      "file.large_write": "Schreibt eine 16-MB-Datei in Blöcken zu 64 KB",
      "file.large_read": "Liest eine 16-MB-Datei in Blöcken zu 64 KB",
      "file.read_line": "Liest eine Textdatei mit 20.000 Zeilen zeilenweise",
      "file.read_file": "Liest eine ganze 16-MB-Datei mit einem Aufruf",
      "gc.short_processes":
        "Startet 5000 kurzlebige Prozesse, die jeweils Müll erzeugen",
      "gc.grow_shrink":
        "Lässt den Heap mit einer 200.000-Elemente-Liste wachsen, verwirft sie",
      "gc.long_lived_churn":
        "Hält ein gleitendes Fenster lebender Daten inmitten von Müll",
      "gc.explicit_collect":
        "Erzwingt Garbage Collection mit 10.000 lebenden Tupeln",
      "msg.ping_pong":
        "Schickt eine Nachricht 50.000-mal zwischen zwei Prozessen hin und her",
      "msg.fan_in": "100 Prozesse senden je 1000 Nachrichten an einen",
      "msg.ring": "Reicht ein Token 50-mal durch einen Ring aus 1000 Prozessen",
      "msg.large_message":
        "Sendet eine Liste mit 100.000 Elementen an einen Prozess und zurück",
      "socket.tcp_echo": "Echo von 2000 Nachrichten zu 1 KB über Loopback-TCP",
      "socket.tcp_connect":
        "Öffnet und schließt 300 TCP-Verbindungen über Loopback",
      "socket.udp_round_trip":
        "2000 UDP-Roundtrips eines 1-KB-Datagramms über Loopback",
    },
    programInfo: {
      bench_datagen:
        "Erzeugt massenhaft Listen, Tupel, Maps, Binaries und große Ganzzahlen",
      bench_dataproc:
        "Sortieren, Folds, Map-Updates, Binary-Matching und Umwandlungen",
      bench_file:
        "Schreiben und Lesen kleiner und großer Dateien, zeilenweises Lesen",
      bench_gc:
        "Kurzlebige Prozesse, wachsender und schrumpfender Heap, lebende Daten",
      bench_msg:
        "Ping-Pong, Fan-in, Prozessring und Kopieren großer Nachrichten",
      bench_socket:
        "TCP-Echo, TCP-Verbindungsaufbau und UDP-Roundtrips über Loopback",
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
    sizesTitle: "Größe der ausführbaren Dateien",
    sizesNote:
      "Größe der Benchmark-Programme in Megabyte, wie Clause sie auf jeder Optimierungsstufe erzeugt.",
    sizesHistoryNote:
      "Größen mit -O2 der letzten {count} gemessenen Commits, älteste zuerst. Jeder Lauf erzeugt außerdem eine Baseline, den vorherigen Clause-Commit (den neuesten Commit, der mindestens einen Tag älter als HEAD ist, oder den mit --baseline angegebenen), mit -O2, um Regressionen zu erkennen; Baselines erscheinen hier als eigene Commits. Die Tabelle darunter ergänzt die Summe aller bench_*-Programme und die Größe des Compilers clau.",
    sizesTotal: "Alle bench_*-Programme",
    megabytes: "{value} MB",
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
  cookies: {
    banner:
      "Diese Website zählt Besuche mit Google Analytics, das Cookies nur nach Zustimmung setzt.",
    accept: "Zustimmen",
    decline: "Ablehnen",
    policyLink: "Cookie-Richtlinie",
    title: "Cookie-Richtlinie",
    intro:
      "clau.se zählt Besuche mit Google Analytics, um zu sehen, welche Seiten gelesen werden. Google Analytics wird erst nach Zustimmung geladen und setzt erst dann Cookies; bis dahin oder bei Ablehnung wird nichts an Google gesendet.",
    choiceTitle: "Auswahl",
    choice:
      "Eine Ablehnung ändert nichts an der Website. Die Auswahl lässt sich jederzeit ändern; ein Widerruf der Zustimmung löscht die Analyse-Cookies.",
    current: "Aktuelle Auswahl: {state}",
    granted: "zugestimmt",
    denied: "abgelehnt",
    unset: "noch keine",
    storedTitle: "Was gespeichert wird",
    name: "Name",
    purpose: "Zweck",
    duration: "Dauer",
    rows: [
      {
        name: "_ga",
        purpose: "Cookie von Google Analytics: unterscheidet Besucher",
        duration: "2 Jahre",
      },
      {
        name: "_ga_8Y3XJHBHPB",
        purpose: "Cookie von Google Analytics: hält den Zustand eines Besuchs",
        duration: "2 Jahre",
      },
      {
        name: "analytics-consent",
        purpose: "Lokaler Speicher des Browsers: die Cookie-Auswahl",
        duration: "Bis zum Löschen",
      },
      {
        name: "theme, locale",
        purpose:
          "Lokaler Speicher des Browsers: gewähltes Farbschema und gewählte Sprache",
        duration: "Bis zum Löschen",
      },
    ],
    googleTitle: "Google Analytics",
    google:
      "Google Analytics ist ein Dienst von Google. Mit Zustimmung erhält er die besuchten Seiten, die verweisende Seite, Browser- und Gerätetyp sowie einen aus der IP-Adresse abgeleiteten ungefähren Standort.",
    googleLink: "Wie Google diese Informationen verwendet",
    contact: "Fragen zu dieser Richtlinie:",
  },
  notFound: {
    title: "Seite nicht gefunden",
    home: "Zur Startseite",
  },
} satisfies Messages;
