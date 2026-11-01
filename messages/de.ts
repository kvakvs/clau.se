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
      "Clause ist ein AOT-Compiler für Erlang. Er verarbeitet, parst und analysiert Erlang-Quellcode, kompiliert ihn über LLVM und linkt native Programme mit einer eigenen Laufzeitumgebung: leichtgewichtige Prozesse auf mehreren Scheduler-Threads, Nachrichtenaustausch, Verteilung, Ports und Garbage Collection pro Prozess.",
    status:
      "In Entwicklung: Erlang/OTP 29-Programme lassen sich bereits heute zu nativen Programmen kompilieren, die unter Windows und Linux laufen, mit Clause-eigenen stdlib, kernel, crypto und ssl, und als verteilte Knoten untereinander und mit OTP 29-Knoten verbinden. Noch ausstehend: macOS mit Apple Silicon und native ARM-Hardware, die Testsuites von OTP, Quelldatei- und Zeilenangaben in Stacktraces, rpc, global und pg über Knoten hinweg und weitere Optimierungen; das Nachladen von Code im laufenden Betrieb wird nicht unterstützt. Die Benchmark-Seite zeigt, wo Clause im Vergleich zu OTP steht; die Dokumentation beschreibt, was funktioniert und wo Clause abweicht.",
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
        id: "benchmarks",
        property: "{ratio} {side}",
        title: "Geschwindigkeit gegenüber OTP",
        text: "Geometrisches Mittel von {count} Benchmark-Kernels, Clause -O2 gegenüber dem BEAM-JIT.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Native Programme",
        text: "Ein Befehl vom Erlang-Quellcode zum eigenständigen Programm, über LLVM mit Link-Time-Optimierung kompiliert. Auch Escripts.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang-Prozesse",
        text: "Leichtgewichtige Prozesse mit Garbage Collection pro Prozess auf mehreren Scheduler-Threads.",
      },
      {
        id: "library",
        property: "gen_server · ssl",
        title: "OTP-Bibliothek",
        text: "Clause-eigene stdlib, kernel, crypto und ssl mit den Exporten, Ergebnissen und Fehlern von OTP 29.",
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
        id: "distribution",
        property: "node@host",
        title: "Verteiltes Erlang",
        text: "Knoten verbinden sich untereinander und mit OTP 29-Knoten über das OTP-Protokoll: Nachrichten, Links, Monitore und Prozessstarts auf anderen Knoten.",
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
          "Parse-Transforms ohne installiertes Erlang/OTP: ms_transform, qlc, merl und eigene",
          "ASN.1-Spezifikationen werden wie mit asn1ct zu Modulen kompiliert: BER, DER, PER und UPER",
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
          "O2 inlinet kleine lokale Funktionen, bekannte Funs und lists-Schleifen",
          "Echte Endaufrufe und tiefe Rekursion",
          "Parallele Codegenerierung auf jedem Hardware-Thread",
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
        id: "distribution",
        title: "Verteilung",
        items: [
          "Benannte Knoten über --sname und --name oder net_kernel:start zur Laufzeit",
          "OTP-Handshake und Cookies über TCP, IPv4 und IPv6",
          "Nachrichten, Links, Monitore, Group Leader und Prozessstarts über Knoten hinweg",
          "Funktioniert mit OTP 29-Knoten in beide Richtungen",
          "Eingebauter epmd oder clause-epmd als eigenes Programm",
        ],
      },
      {
        id: "library",
        title: "OTP-Bibliothek",
        items: [
          "Clause-eigene OTP 29-Module mit den Exporten, Ergebnissen und Fehlergründen von OTP",
          "gen_server, gen_statem, gen_event, supervisor, application und logger",
          "stdlib: lists, maps, string, binary, json, re, rand und die Collection-Module",
          "ets, dets, disk_log, zip und erl_tar mit Dateien, wie OTP sie schreibt",
          "erl_scan, erl_parse, erl_lint, erl_eval, qlc und compile zur Laufzeit, kompilierte Module werden interpretiert",
          "syntax_tools: erl_syntax, erl_prettypr, epp_dodger und merl",
          "kernel: file, gen_tcp, gen_udp, inet, inet_res und os",
          "crypto über OpenSSL mit FIPS-Modus; public_key mit Validierung von Zertifikatspfaden, CRLs und OCSP",
          "ssl: TLS-1.2- und TLS-1.3-Verbindungen über libssl von OpenSSL",
        ],
      },
      {
        id: "tooling",
        title: "Projekte und Werkzeuge",
        items: [
          "Ein clau-Befehl vom Erlang-Quellcode zum nativen Programm",
          "TOML-Projekte mit SQLite-Build-Caches",
          "Release-Dateien vm.args und sys.config, gelesen wie beim Start von OTP",
          "Interaktive Erlang-Shell mit clau --shell",
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
        text: "Voraussetzungen, ein erster Build und ein erstes Programm: CMake 3.28+, ein C++23-Compiler und Python 3; CMake findet LLVM 23 und die übrigen Bibliotheken oder lädt sie herunter.",
      },
      building: {
        title: "Den Compiler bauen",
        text: "Voraussetzungen, CMake-Presets und Optionen, Tests und Benchmarks unter Linux, macOS und Windows.",
      },
      using: {
        title: "Den Compiler verwenden",
        text: "Die clau-Kommandozeile: Optionen, Artefakte, Listings und der Kompilierungscache.",
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
      dist: "Verteilung",
      file: "Datei-I/O",
      float: "Gleitkomma",
      gc: "Garbage Collection",
      libraries: "Bibliotheken",
      msg: "Nachrichtenaustausch",
      socket: "Loopback-Sockets",
      ssl: "TLS",
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
      "dist.ping_pong":
        "5.000 Nachrichten hin und zurück mit einem anderen Knoten über TCP, 3-mal",
      "dist.data_exchange":
        "200 Hin- und Rückwege eines 64-KB-Binärs und 1.000 Tupeln mit einem anderen Knoten, 3-mal",
      "dist.spawn":
        "Startet 500 Prozesse nacheinander auf einem anderen Knoten, 3-mal",
      "dist.reconnect":
        "20 Trennungen und Neuverbindungen zu einem anderen Knoten, jeweils mit einem Hin und Zurück, 3-mal",
      "file.small_files":
        "Schreibt, liest und löscht 500 kleine Dateien, 11-mal",
      "file.large_write":
        "Schreibt eine 16-MB-Datei in Blöcken zu 64 KB, 200-mal",
      "file.large_read": "Liest eine 16-MB-Datei in Blöcken zu 64 KB, 370-mal",
      "file.read_line":
        "Liest eine Textdatei mit 20.000 Zeilen zeilenweise, 52-mal",
      "file.read_file":
        "Liest eine ganze 16-MB-Datei mit einem Aufruf, 330-mal",
      "float.sum":
        "Summiert ein Float in einer Schleife mit 1 Million Schritten, 200-mal",
      "float.mandelbrot":
        "Mandelbrot-Iterationen über ein 120×120-Raster, 120-mal",
      "float.limit": "Lässt ein Float schrittweise über 1e100 wachsen, 80-mal",
      "float.negate":
        "Unäres Minus und float/1 in einer Float-Schleife mit 1 Million Schritten, 70-mal",
      "float.guards":
        "Ein is_float/1-Guard in einer Float-Schleife mit 1 Million Schritten, 120-mal",
      "float.calls":
        "Trapezsumme eines Polynoms, ein Aufruf pro Schritt, 160-mal",
      "gc.short_processes":
        "Startet 5000 kurzlebige Prozesse, die jeweils Müll erzeugen, 69-mal",
      "gc.grow_shrink":
        "Lässt den Heap mit einer 200.000-Elemente-Liste wachsen, verwirft sie, 300-mal",
      "gc.long_lived_churn":
        "Hält ein gleitendes Fenster aus 10.000 lebenden Elementen inmitten von Müll, 370-mal",
      "gc.explicit_collect":
        "Erzwingt Garbage Collection mit 10.000 lebenden Tupeln, 5100-mal",
      "libraries.qlc":
        "Führt die qlc-Transformation über 27 Abfragen und 3 Module aus, 11-mal",
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
      "ssl.tls_echo": "5.000 TLS-1.3-Echos zu 1 KB über Loopback, 3-mal",
      "ssl.tls_handshake":
        "50 TLS-1.3-Verbindungen, jeweils mit vollem Handshake und einem Echo, 3-mal",
      "ssl.tls_bulk":
        "Sendet 1.024 Blöcke zu 16 KB über Loopback-TLS 1.3, 3-mal",
    },
    programInfo: {
      bench_datagen:
        "Erzeugt massenhaft Listen, Tupel, Maps, Binaries und große Ganzzahlen",
      bench_dataproc:
        "Sortieren, Folds, Map-Updates, Binary-Matching und Umwandlungen",
      bench_dist:
        "Hin und Zurück, Daten, entfernte Prozessstarts und Neuverbindungen zwischen Knoten; OTP führt sie auch über TLS aus",
      bench_file:
        "Schreiben und Lesen kleiner und großer Dateien, zeilenweises Lesen",
      bench_float:
        "Float-Schleifen: Summen, Mandelbrot, Grenzen, Negation, Guards und Aufrufe",
      bench_gc:
        "Kurzlebige Prozesse, wachsender und schrumpfender Heap, lebende Daten",
      bench_library:
        "Die qlc-Parse-Transform zur Laufzeit, wie qlc:q/1 sie nutzt",
      bench_msg:
        "Ping-Pong, Fan-in, Prozessring und Kopieren großer Nachrichten",
      bench_socket:
        "TCP-Echo, TCP-Verbindungsaufbau und UDP-Roundtrips über Loopback",
      bench_ssl: "TLS-1.3-Echo, Handshakes und Massenübertragung über Loopback",
    },
    programsTitle: "Vollständige Programme",
    programsNote:
      "Gesamtlaufzeit in Sekunden, einschließlich Start, Median der Läufe.",
    program: "Programm",
    historyTitle: "Fortschritt",
    historyNote:
      "Geometrisches Mittel der Zeit von Clause geteilt durch die von OTP an jedem erfassten Lauftag.",
    pinnedSince:
      "Läufe vor dem {date} waren nicht an eine CPU-Menge gebunden; ein Teil der Änderung an diesem Tag geht daher auf die Bindung zurück.",
    date: "Datum",
    commit: "Commit",
    sizesTitle: "Größe der ausführbaren Dateien",
    sizesNote:
      "Größe der Benchmark-Programme in Megabyte, wie Clause sie auf jeder Optimierungsstufe erzeugt.",
    sizesHistoryNote:
      "Größen mit -O2 der letzten {count} Benchmark-Läufe, älteste zuerst, ein Clause-Commit pro Lauf. Die Tabelle darunter ergänzt die Summe aller bench_*-Programme und die Größe des Compilers clau.",
    sizesTotal: "Alle bench_*-Programme",
    megabytes: "{value} MB",
    setupTitle: "Testumgebung",
    machine: "Maschine",
    cpus: "{count} logische CPUs",
    cpuSet: "CPU-Menge",
    cpuSetPerformance:
      "Performance-Kerne {list}, {count} von {total} logischen CPUs",
    cpuSetList: "CPUs {list}, {count} von {total} logischen CPUs",
    pinningPerformance:
      "OTP und Clause laufen auf denselben CPUs: Jedes Benchmark-Programm ist an die Performance-Kerne des Prozessors gebunden, sodass auf einer Hybrid-CPU kein Kernel auf einem langsameren Effizienz-Kern landet. Beide halten einen Scheduler pro CPU dieser Menge online, ohne ihn innerhalb der Menge an eine bestimmte CPU zu binden.",
    pinningList:
      "OTP und Clause laufen auf denselben CPUs: Jedes Benchmark-Programm ist an die oben genannte CPU-Menge gebunden. Beide halten einen Scheduler pro CPU dieser Menge online, ohne ihn innerhalb der Menge an eine bestimmte CPU zu binden.",
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
