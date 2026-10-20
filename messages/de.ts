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
        text: "Präprozessor und Parser für Erlang/OTP 29-Quellcode, native Records eingeschlossen.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "LLVM-Backend",
        text: "Kompiliert über LLVM mit O2, mit modulübergreifender Link-Time-Optimierung.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Native Programme",
        text: "Ein Befehl vom Erlang-Quellcode zum eigenständigen Programm. Auch Escripts.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang-Prozesse",
        text: "Leichtgewichtige Prozesse mit Garbage Collection pro Prozess auf mehreren Scheduler-Threads.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "OTP-Bibliothek",
        text: "Clause-eigene stdlib und kernel mit den Exporten, Ergebnissen und Fehlern von OTP 29.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Ports und I/O",
        text: "Dateien, Unterprozesse und TCP/UDP-Sockets auf einem ereignisgesteuerten I/O-Thread.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Typinferenz",
        text: "Mit O2 entfernen inferierte Typen Laufzeitprüfungen und wählen spezialisierten Code.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse-Transforms",
        text: "Führt Parse-Transforms beim Kompilieren aus; die Programme selbst benötigen OTP nie.",
      },
      {
        id: "targets",
        property: "7 Zielplattformen",
        title: "Plattformübergreifend",
        text: "Läuft unter Windows x64 und Linux x86-64; Objektdateien für sieben Zielplattformen.",
      },
    ],
    detailsTitle: "Funktionen im Detail",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Erlang/OTP 29-Syntax: Records, Maps, Bitstrings, Comprehensions, Typen und Spezifikationen",
          "Makros, Includes und bedingte Kompilierung",
          "Parse-Transforms auf einem Erlang/OTP 29 des Hosts, einschließlich ms_transform und qlc",
        ],
      },
      {
        id: "language",
        title: "Erlang-Semantik",
        items: [
          "Pattern Matching und Guards in Klauseln, case, if und receive",
          "Records, Funs, maybe sowie List-, Binary- und Map-Comprehensions",
          "Ausnahmen mit try, catch und Stacktraces",
        ],
      },
      {
        id: "compiler",
        title: "Compiler",
        items: [
          "Typinferenz mit Funktionstypen pro Klausel",
          "LLVM O0, O2 und Os, mit modulübergreifender Link-Time-Optimierung",
          "O2 entfernt Typprüfungen, die die Inferenz beweist",
          "Echte Endaufrufe und tiefe Rekursion",
        ],
      },
      {
        id: "runtime",
        title: "Laufzeitumgebung",
        items: [
          "C++23-Laufzeitumgebung mit allen Erlang-Termtypen, einschließlich Ganzzahlen beliebiger Genauigkeit",
          "Prozesse, selektives receive, Links, Monitore und Timer auf mehreren Schedulern",
          "Heaps pro Prozess mit kopierendem Garbage Collector",
          "Nebenläufige ETS-Tabellen in C++",
        ],
      },
      {
        id: "library",
        title: "OTP-Bibliothek",
        items: [
          "Clause-eigene OTP 29-Module mit den Exporten, Ergebnissen und Fehlergründen von OTP",
          "stdlib: lists, maps, string, binary, json, rand und die Collection-Module",
          "ets, dets mit Dateien, wie OTP sie schreibt, re und zlib",
          "kernel: file, gen_tcp, gen_udp, inet und os",
        ],
      },
      {
        id: "tooling",
        title: "Projekte und Werkzeuge",
        items: [
          "Ein clau-Befehl vom Erlang-Quellcode zum nativen Programm",
          "TOML-Projekte mit SQLite-Build-Caches",
          "Debug-Informationen mit -g (CodeView oder DWARF 5) und Profiling mit --profile",
          "Getestet gegen das Referenz-Erlang/OTP und per Benchmarks mit OTP verglichen",
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
      "datagen.list_of_tuples":
        "Baut eine Liste aus 200.000 kleinen Tupeln, 260-mal",
      "datagen.list_to_tuple":
        "Wandelt Listen mit 1000 Elementen 170.000-mal in Tupel um",
      "datagen.map_put":
        "Fügt 2000 Ganzzahlschlüssel einzeln in eine Map ein, 4900-mal",
      "datagen.binary_append":
        "Hängt 10.000 32-Bit-Ganzzahlen an ein wachsendes Binary an, 23.000-mal",
      "datagen.bigint_factorial":
        "Berechnet die Fakultät von 3000 mit großen Ganzzahlen, 330-mal",
      "datagen.string_build":
        "Baut 20.000 Zeichenketten aus Ganzzahlen und Atomen, 1000-mal",
      "dataproc.sort":
        "Sortiert eine Liste mit 20.000 zufälligen Ganzzahlen, 600-mal",
      "dataproc.map_foldl":
        "Wendet map und dann fold auf 20.000 Ganzzahlen an, 4500-mal",
      "dataproc.map_update":
        "Erhöht jeden Wert einer Map mit 500 Schlüsseln 24.000-mal",
      "dataproc.binary_match":
        "Summiert 20.000 32-Bit-Ganzzahlen, per Matching aus einem Binary, 49.000-mal",
      "dataproc.int_to_list":
        "Wandelt 20.000 Ganzzahlen in Zeichenketten und zurück, 2000-mal",
      "dataproc.term_to_binary":
        "Kodiert und dekodiert einen großen verschachtelten Term, 4300-mal",
      "dataproc.comprehension":
        "Comprehension, die 20.000 Ganzzahlen filtert und verdoppelt, 15.000-mal",
      "dataproc.small_map":
        "Aktualisiert eine kleine Zustands-Map 80 Millionen Mal",
      "file.small_files":
        "Schreibt, liest und löscht 500 kleine Dateien, 11-mal",
      "file.large_write":
        "Schreibt eine 16-MB-Datei in Blöcken zu 64 KB, 200-mal",
      "file.large_read": "Liest eine 16-MB-Datei in Blöcken zu 64 KB, 370-mal",
      "file.read_line":
        "Liest eine Textdatei mit 20.000 Zeilen zeilenweise, 52-mal",
      "file.read_file":
        "Liest eine ganze 16-MB-Datei mit einem Aufruf, 330-mal",
      "gc.short_processes":
        "Startet 5000 kurzlebige Prozesse, die jeweils Müll erzeugen, 69-mal",
      "gc.grow_shrink":
        "Lässt den Heap mit einer 200.000-Elemente-Liste wachsen, verwirft sie, 300-mal",
      "gc.long_lived_churn":
        "Hält ein gleitendes Fenster aus 10.000 lebenden Elementen inmitten von Müll, 370-mal",
      "gc.explicit_collect":
        "Erzwingt Garbage Collection mit 10.000 lebenden Tupeln, 5100-mal",
      "msg.ping_pong":
        "Schickt eine Nachricht 2 Millionen Mal zwischen zwei Prozessen hin und her",
      "msg.fan_in": "100 Prozesse senden je 1000 Nachrichten an einen, 25-mal",
      "msg.ring":
        "Reicht ein Token 3050-mal durch einen Ring aus 1000 Prozessen",
      "msg.large_message":
        "Sendet eine Liste mit 100.000 Elementen an einen Prozess und zurück, 560-mal",
      "socket.tcp_echo":
        "Echo von 30.000 Nachrichten zu 1 KB über Loopback-TCP",
      "socket.tcp_connect":
        "Öffnet 900 TCP-Verbindungen über Loopback mit je 25 Echos zu 1 KB",
      "socket.udp_round_trip":
        "27.900 UDP-Roundtrips eines 1-KB-Datagramms über Loopback",
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
