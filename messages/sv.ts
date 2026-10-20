import type { Messages } from "@/messages/en";

export const sv = {
  meta: {
    description:
      "Clause kompilerar Erlang/OTP 29 i förväg via LLVM till körbara program.",
  },
  nav: {
    label: "Huvudmeny",
    home: "Hem",
    docs: "Dokumentation",
    benchmarks: "Prestandatester",
    resources: "Resurser",
  },
  theme: {
    label: "Färgtema",
    light: "Ljust",
    auto: "Auto",
    dark: "Mörkt",
  },
  language: {
    label: "Språk",
  },
  footer: {
    tagline: "Erlang, kompilerat i förväg.",
    updated: "Uppdaterad",
    cookies: "Kakor",
  },
  home: {
    title: "Erlang/OTP 29, kompilerat till maskinkod",
    intro:
      "Clause är en AOT-kompilator för Erlang. Den förbehandlar, parsar och analyserar Erlang-källkod, kompilerar den via LLVM och länkar körbara program med en egen runtime: lättviktsprocesser på flera schemaläggartrådar, meddelandeöverföring, portar och skräpsamling per process.",
    status:
      "Under utveckling: en växande delmängd av Erlang och OTP:s stdlib kompileras till körbara program som redan idag körs på Windows och Linux. Återstår: macOS med Apple Silicon och riktig ARM-hårdvara, OTP:s egna testsviter och mer optimering. Sidan med prestandatester visar var Clause står jämfört med OTP; dokumentationen beskriver vad som fungerar och var Clause skiljer sig.",
    ctaDocs: "Läs dokumentationen",
    ctaSource: "Källkod på GitHub",
    cardsTitle: "Funktioner",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Modern Erlang-syntax",
        text: "Preprocessor och parser för Erlang/OTP 29: makron, records, native records, maps, bitsträngar, comprehensions, maybe och typspecifikationer.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "LLVM-backend",
        text: "Kompilerar till verifierad LLVM IR, bitkod eller objektfiler med O0, O2 eller Os, med valfri länktidsoptimering över moduler.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Körbara program",
        text: "Länkar Erlang-moduler, den delmängd av biblioteket som de använder och runtime till ett fristående program med Clang, med ett enda kommando. Även escripts kan kompileras.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang-processer",
        text: "Lättviktsprocesser med egna heapar och skräpsamling på flera schemaläggartrådar, med selektiv receive, länkar och monitorer.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "OTP-bibliotek",
        text: "Clauses egna stdlib-, kernel- och ERTS-moduler med samma exporter, resultat och fel som OTP 29, från lists och maps till ETS-tabeller och dets-filer som OTP kan öppna.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Portar och I/O",
        text: "Filer, standard-in- och utmatning, underprocesser och TCP/UDP-sockets via portar, hanterade av en händelsestyrd I/O-tråd.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Typhärledning",
        text: "Härleder funktionstyper per klausul; med O2 tar de bort kontroller vid körning och väljer typspecialiserade varianter med en generisk variant som reserv.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Tillämpar parse transforms som erlc gör och kör dem under kompileringen på en Erlang/OTP 29 installerad på värddatorn; de körbara programmen behöver aldrig OTP.",
      },
      {
        id: "targets",
        property: "7 plattformar",
        title: "Plattformsoberoende",
        text: "Körning validerad på Windows x64 och Linux x86-64; runtime testad på 32-bitars x86 och, under emulering, på ARM. Objektfiler för sju plattformar, inklusive Apple Silicon.",
      },
    ],
    detailsTitle: "Funktioner i detalj",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Förbehandling: makron, include, include_lib (även från versionerade applikationskataloger), villkorlig kompilering och språkfunktioner",
          "Parse transforms körs på en Erlang/OTP 29 på värddatorn, inklusive OTP:s ms_transform och qlc; --print-abstr skriver ut formerna i det abstrakta formatet",
          "Erlang/OTP 29-syntax: uttryck, mönster, records, bitsträngar, typer och specifikationer, kontrollflöde och comprehensions",
          "Syntaxkontroll, utskrift av expanderad källkod och ett indenterat syntaxträd",
          "Diagnostik i källkoden över flera indatafiler",
        ],
      },
      {
        id: "language",
        title: "Erlang-semantik",
        items: [
          "Mönstermatchning och guards i funktionsklausuler, case, if, receive och matchningar i funktionskroppar",
          "maybe samt comprehensions för listor, binaries och maps",
          "Records med uppdateringar och record_info/2; native records samt kvalificerade och anonyma records",
          "Funs med infångade variabler, namngivna funs, dynamiska anrop och apply",
          "Undantag: error, exit, throw, catch, try ... of ... catch ... after samt stackspår",
          "Modulattribut: kontroll av callbacks för -behaviour, -import, informativa attribut och genererad module_info/0,1",
        ],
      },
      {
        id: "compiler",
        title: "Kompilator",
        items: [
          "Semantisk analys: kontroll av delmängden, variabelbindningar, anropsupplösning, deklarerade och härledda typer",
          "Typhärledning med funktionstyper per klausul; specifikationer som motsäger dem rapporteras",
          "LLVM O0, O2 och Os; objektfiler, IR och bitkod per modul; IR- och assemblerlistningar med Erlang-källkod",
          "Snabba kodvägar direkt i koden för allokering, typtester, åtkomst till tupler, listor och maps, binaries, closures och flyttalsaritmetik",
          "O2 tar bort typkontroller som härledningen bevisat och väljer typspecialiserade varianter",
          "Länktidsoptimering över moduler med --lto; onåbara exporter utelämnas från körbara program",
          "Riktiga svansanrop och djup rekursion på en explicit stack per process",
          "Ett tydligt notimpl-meddelande för giltig Erlang som kräver en funktion som ännu inte finns",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Runtime-bibliotek i C++23 utan LLVM, länkat i varje program",
          "Alla Erlangs termtyper, inklusive heltal med godtycklig precision",
          "Processer, meddelanden, selektiv receive, länkar, monitorer, registrerade namn och timrar på flera schemaläggartrådar",
          "Heap per process med kopierande skräpsamlare, delade binaries utanför heapen och valfria minnesgränser",
          "Portar för filer, standard-I/O, underprocesser och TCP/UDP-sockets på en händelsestyrd I/O-tråd",
          "ETS-tabeller med samtidig åtkomst i C++",
        ],
      },
      {
        id: "library",
        title: "OTP-bibliotek",
        items: [
          "Clauses egna versioner av OTP 29-moduler med OTP:s exportlistor, resultat och felorsaker; funktioner som ännu inte är implementerade ger not_implemented",
          "stdlib: lists, maps, string, unicode, binary, io_lib, json, rand, calendar, samlingsmodulerna, sofs, graph och digraph",
          "ets med matchningsspecifikationer och tabellfiler, dets med filer som byte för byte motsvarar dem OTP skriver, samt ms_transform",
          "re över PCRE2, zlib och modulen erlang",
          "kernel: file, gen_tcp, gen_udp, inet, os och code",
          "De ERTS-moduler som OTP:s kernel och stdlib anropar",
        ],
      },
      {
        id: "tooling",
        title: "Projekt och verktyg",
        items: [
          "TOML-projekt med namngivna mål, hittande av källfiler och inställningar per mål",
          "SQLite-byggcacher för kompileringsresultat, utdata från parse transforms och härledningsresultat",
          "Kommenterade startprojekt med clau --new-project",
          "Ett clau-kommando från Erlang-källkod till körbart program; även escripts kan kompileras",
          "Felsökningsradtabeller med -g (CodeView eller DWARF 5) och valfri profilering med --profile",
          "Testad mot referensversionen av Erlang/OTP, med sanitizer-körningar på Linux och prestandatester mot OTP",
        ],
      },
    ],
  },
  docs: {
    title: "Dokumentation",
    notReady: "Dokumentationen är inte klar ännu.",
    meanwhile:
      "Under tiden är du välkommen att läsa utvecklaranteckningarna från projektets repository. De beskriver den nuvarande implementationen och dess begränsningar.",
    synced: "Synkroniserad från commit",
    startHere: "Börja här",
    reference: "Referensanteckningar",
    notWritten: "Inte skriven ännu. Se under tiden:",
    allDocs: "All dokumentation",
    englishOnly:
      "Den här sidan är inte översatt ännu och visas därför på engelska.",
    outdated:
      "Det engelska originalet har ändrats sedan översättningen gjordes, så delar av den kan vara inaktuella.",
    translated: "Översatt från det engelska originalet",
    readEnglish: "Läs på engelska",
    featured: {
      gettingStarted: {
        title: "Kom igång",
        text: "Förutsättningar: CMake, en C++23-kompilator, Clang, LLVM 23 SDK, Boost och toml++; CMake laddar ner övriga bibliotek. Erlang/OTP är valfritt.",
      },
      building: {
        title: "Bygga kompilatorn",
        text: "Konfigurera, bygg och testa med CMake-presets på Linux, macOS och Windows.",
      },
      using: {
        title: "Använda kompilatorn",
        text: "Kommandoradsflaggor, inspektionslägen, körbara program, TOML-projekt och parse transforms.",
      },
      interpreting: {
        title: "Hur man tolkar resultaten",
        text: "Att prova Clause på befintlig Erlang-kod: vad som kompileras idag, vad notimpl-meddelanden betyder och vad man kan prova härnäst.",
      },
      differences: {
        title: "Kända skillnader från Erlang/OTP",
        text: "Observerbart beteende där Clause medvetet skiljer sig från OTP 29.",
      },
    },
  },
  benchmarks: {
    title: "Prestandatester",
    intro:
      "Clause jämfört med Erlang/OTP på en och samma maskin: samma Erlang-program, kompilerade med erlc och med clau -O2, tar tid på sina kärnor efter ett uppvärmningsanrop. Siffrorna ändras med varje optimering.",
    geomean:
      "Geometriskt medelvärde av kärntiderna, Clause -O2 mot BEAM JIT (OTP)",
    slowerOnAverage: "långsammare i genomsnitt",
    fasterOnAverage: "snabbare i genomsnitt",
    barFaster: "snabbare",
    barSlower: "långsammare",
    faster: "Kärnor där Clause är snabbare",
    first:
      "Geometriskt medelvärde den {date}, den första registrerade körningen",
    kernelsTitle: "Tider per kärna",
    kernelsNote:
      "Median av {runs} körningar i millisekunder. Stapeln visar Clauses tid delad med OTP:s på en logaritmisk skala.",
    noisy: "Körningarna varierade med mer än halva medianen.",
    kernel: "Kärna",
    otp: "OTP JIT",
    clause: "Clause -O2",
    ratio: "Clause ÷ OTP",
    legendFaster: "Clause snabbare",
    legendSlower: "OTP snabbare",
    groups: {
      datagen: "Datagenerering",
      dataproc: "Databearbetning",
      file: "Fil-I/O",
      gc: "Skräpsamling",
      msg: "Meddelandeöverföring",
      socket: "Loopback-sockets",
    },
    kernelInfo: {
      "datagen.list_of_tuples":
        "Bygger en lista med 200 000 små tupler, 300 gånger",
      "datagen.list_to_tuple":
        "Gör om listor med 1000 element till tupler, 220 000 gånger",
      "datagen.map_put":
        "Lägger in 2000 heltalsnycklar i en map, en i taget, 4900 gånger",
      "datagen.binary_append":
        "Lägger till 10 000 32-bitars heltal i en växande binary, 23 000 gånger",
      "datagen.bigint_factorial":
        "Beräknar fakulteten av 3000 med stora heltal, 330 gånger",
      "datagen.string_build":
        "Bygger 20 000 strängar av heltal och atomer, 1000 gånger",
      "dataproc.sort":
        "Sorterar en lista med 20 000 slumpmässiga heltal, 600 gånger",
      "dataproc.map_foldl":
        "Kör map och sedan fold över 20 000 heltal, 6100 gånger",
      "dataproc.map_update":
        "Ökar varje värde i en map med 500 nycklar, 24 000 gånger",
      "dataproc.binary_match":
        "Summerar 20 000 32-bitars heltal matchade ur en binary, 49 000 gånger",
      "dataproc.int_to_list":
        "Gör om 20 000 heltal till strängar och tillbaka, 2000 gånger",
      "dataproc.term_to_binary":
        "Kodar och avkodar en stor nästlad term, 5100 gånger",
      "dataproc.comprehension":
        "Comprehension som filtrerar och dubblar 20 000 heltal, 15 000 gånger",
      "dataproc.small_map":
        "Uppdaterar en liten tillståndsmap 92 miljoner gånger",
      "file.small_files":
        "Skriver, läser tillbaka och raderar 500 små filer, 11 gånger",
      "file.large_write":
        "Skriver en fil på 16 MB i block om 64 KB, 250 gånger",
      "file.large_read": "Läser en fil på 16 MB i block om 64 KB, 370 gånger",
      "file.read_line":
        "Läser en textfil med 20 000 rader rad för rad, 52 gånger",
      "file.read_file": "Läser en hel fil på 16 MB i ett anrop, 330 gånger",
      "gc.short_processes":
        "Startar 5000 kortlivade processer som var och en skapar skräp, 69 gånger",
      "gc.grow_shrink":
        "Växer heapen med en lista på 200 000 element och släpper den, 300 gånger",
      "gc.long_lived_churn":
        "Behåller ett glidande fönster med 10 000 levande element bland skräp, 370 gånger",
      "gc.explicit_collect":
        "Tvingar fram skräpsamling med 10 000 levande tupler, 7100 gånger",
      "msg.ping_pong":
        "Studsar ett meddelande mellan två processer 2 miljoner gånger",
      "msg.fan_in":
        "100 processer skickar var och en 1000 meddelanden till en, 25 gånger",
      "msg.ring": "Skickar en token 3050 varv runt en ring av 1000 processer",
      "msg.large_message":
        "Skickar en lista med 100 000 element till en process och tillbaka, 560 gånger",
      "socket.tcp_echo":
        "Ekar 30 000 meddelanden på 1 KB över TCP via loopback",
      "socket.tcp_connect":
        "Öppnar 900 TCP-anslutningar via loopback och ekar 25 meddelanden på 1 KB i varje",
      "socket.udp_round_trip":
        "Studsar ett datagram på 1 KB 27 900 gånger över UDP via loopback",
    },
    programInfo: {
      bench_datagen:
        "Bygger listor, tupler, maps, binaries och stora heltal i mängd",
      bench_dataproc:
        "Sortering, fold, map-uppdateringar, binary-matchning och konverteringar",
      bench_file: "Skriver och läser små och stora filer, läser rader",
      bench_gc:
        "Kortlivade processer, heap som växer och krymper, levande data",
      bench_msg:
        "Ping-pong, fan-in, processring och kopiering av stora meddelanden",
      bench_socket: "TCP-eko, TCP-anslutningar och UDP-rundturer via loopback",
    },
    programsTitle: "Hela program",
    programsNote:
      "Verklig tid i sekunder, inklusive uppstart, median av körningarna.",
    program: "Program",
    historyTitle: "Utveckling",
    historyNote:
      "Geometriskt medelvärde av Clauses tid delad med OTP:s för varje dag med registrerade körningar.",
    date: "Datum",
    commit: "Commit",
    sizesTitle: "Storlek på körbara filer",
    sizesNote:
      "Storlek i megabyte på testprogrammen som Clause bygger dem på varje optimeringsnivå.",
    sizesHistoryNote:
      "Storlekar med -O2 för de senaste {count} uppmätta commits, äldst först. Varje körning bygger också en baslinje, den föregående Clause-commiten (den nyaste commiten som är minst en dag äldre än HEAD, eller den som anges med --baseline), med -O2 för att fånga regressioner; baslinjerna visas här som egna commits. Tabellen nedan lägger till summan för alla bench_*-program och storleken på kompilatorn clau.",
    sizesTotal: "Alla bench_*-program",
    megabytes: "{value} MB",
    setupTitle: "Testmiljö",
    machine: "Maskin",
    cpus: "{count} logiska processorer",
    otpVersion: "Erlang/OTP",
    clauseCommit: "Clause-commit",
    runAt: "Körning",
    reproduce:
      "Kör prestandatesterna själv med make benchmark eller make-benchmark.bat i Clause-repositoryt; anteckningarna om prestandatester beskriver programmen och alternativen.",
    notes: "Anteckningar om prestandatester",
  },
  resources: {
    title: "Resurser",
    intro: "Var du hittar källkoden och följer utvecklingen.",
    github: {
      title: "GitHub-repository",
      text: "Källkod, ärenden och utvecklingshistorik.",
    },
    credits: "Bildkällor",
  },
  cookies: {
    banner:
      "Webbplatsen räknar besök med Google Analytics, som sätter kakor bara om du godkänner.",
    accept: "Godkänn",
    decline: "Avböj",
    policyLink: "Kakpolicy",
    title: "Kakpolicy",
    intro:
      "clau.se räknar besök med Google Analytics för att se vilka sidor som läses. Google Analytics laddas och dess kakor sätts först när du godkänner dem; dessförinnan, eller om du avböjer, skickas inget till Google.",
    choiceTitle: "Ditt val",
    choice:
      "Att avböja ändrar ingenting på webbplatsen. Du kan ändra ditt val när som helst; när du drar tillbaka samtycket raderas analyskakorna.",
    current: "Nuvarande val: {state}",
    granted: "godkänt",
    denied: "avböjt",
    unset: "inte gjort än",
    storedTitle: "Vad som lagras",
    name: "Namn",
    purpose: "Syfte",
    duration: "Varaktighet",
    rows: [
      {
        name: "_ga",
        purpose: "Kaka från Google Analytics: skiljer besökare åt",
        duration: "2 år",
      },
      {
        name: "_ga_8Y3XJHBHPB",
        purpose: "Kaka från Google Analytics: håller reda på ett besök",
        duration: "2 år",
      },
      {
        name: "analytics-consent",
        purpose: "Lokal lagring i din webbläsare: ditt val om kakor",
        duration: "Tills du rensar den",
      },
      {
        name: "theme, locale",
        purpose: "Lokal lagring i din webbläsare: valt färgtema och språk",
        duration: "Tills du rensar den",
      },
    ],
    googleTitle: "Google Analytics",
    google:
      "Google Analytics är en tjänst från Google. Med ditt samtycke tar den emot vilka sidor du besöker, hänvisande sida, typ av webbläsare och enhet samt en ungefärlig plats som härleds från din IP-adress.",
    googleLink: "Hur Google använder informationen",
    contact: "Frågor om policyn:",
  },
  notFound: {
    title: "Sidan hittades inte",
    home: "Gå till startsidan",
  },
} satisfies Messages;
