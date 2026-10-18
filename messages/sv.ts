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
  },
  home: {
    title: "Erlang/OTP 29, kompilerat till maskinkod",
    intro:
      "Clause är en AOT-kompilator för Erlang. Den förbehandlar, parsar och analyserar Erlang-källkod, kompilerar den via LLVM och länkar körbara program med en egen runtime: lättviktsprocesser på flera schemaläggartrådar, meddelandeöverföring, portar och skräpsamling per process.",
    status:
      "Under utveckling: en växande delmängd av Erlang kompileras till körbara program och körs redan idag på Windows och Linux, med Clause-versioner av de flesta runtime-moduler som OTP:s kernel och stdlib anropar och en växande uppsättning kompletta stdlib-moduler. Återstår: validering på macOS med Apple Silicon och på riktig ARM-hårdvara, bredare jämförelser med OTP:s egna testsviter samt ytterligare optimering; sidan med prestandatester visar var Clause står jämfört med OTP. Dokumentationen beskriver vad som fungerar och var Clause skiljer sig från Erlang/OTP.",
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
        text: "Processer med egna heapar och generationsbaserad skräpsamling, på körköer per arbetstråd fördelade över schemaläggartrådar, med selektiv receive, tidsgränser, länkar, monitorer och registrerade namn.",
      },
      {
        id: "library",
        property: "string · json · rand",
        title: "OTP-biblioteksmoduler",
        text: "Alla dokumenterade funktioner i lists, maps, string, unicode, json, rand, calendar och samlingsmodulerna, mest som inbyggda runtime-funktioner, samt re över PCRE2 och zlib, med samma resultat och fel som OTP 29.",
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
          "Typhärledning med funktionstyper per klausul; en specifikation som motsäger de härledda argumenttyperna ger kompileringsfel, andra motsägelser ger varningar",
          "Härledningen omfattar bara kod som startfunktionen når; resultaten för OTP och konfigurerade bibliotekskataloger cachas per modul",
          "LLVM O0, O2 och Os; objektfiler, IR och bitkod per modul; IR-ögonblicksbilder och assemblerlistningar med Erlang-källkod",
          "Genererad kod allokerar, testar typer, läser tupler, listor och maps, lägger ihop korta listor, bygger och matchar binaries, skapar closures och räknar med flyttal direkt i koden, och anropar runtime bara på långsamma vägar",
          "O2 tar bort typ- och formkontroller som härledningen bevisat, med ett begränsat antal typspecialiserade varianter",
          "Länktidsoptimering över moduler med --lto",
          "Körbara program utelämnar de exporter som startfunktionen inte kan nå; --keep-exports behåller alla",
          "Typrapporter: källkod med härledda funktionssignaturer",
          "Riktiga svansanrop och djup rekursion på en explicit stack per process",
          "Ett tydligt notimpl-meddelande för giltig Erlang som kräver en funktion som ännu inte finns",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Runtime-bibliotek i C++23 utan LLVM, länkat i varje program",
          "Heltal med godtycklig precision, flyttal, atomer, tupler, listor, maps, bitsträngar, records, funs, pids, portar och referenser",
          "Processer, meddelanden, selektiv receive, länkar, monitorer, registrerade namn och timrar på flera schemaläggartrådar, var och en med egen körkö",
          "Heap per process med generationsbaserad kopierande skräpsamlare, min_heap_size, delade binärer utanför heapen, literalområden per modul och valfria minnesgränser",
          "Portar för filer, standard-I/O, underprocesser och TCP/UDP-sockets på en händelsestyrd I/O-tråd",
          "Modulen erlang: processordbok, externt termformat med komprimering, tid och timrar, processinspektion, spawn-alternativ, alias samt phash och phash2 med OTP:s värden för allt utom pid:ar, portar, referenser, funs och native records",
          "Varje OTP 29-export i en Clause-biblioteksmodul kompileras; funktioner som ännu inte är implementerade ger not_implemented när de anropas",
          "io:format, io:fwrite och io:put_chars till valfri I/O-enhet, med OTP:s ~p-formatering; delmängder av file, gen_tcp, gen_udp, inet, os och code",
          "Kompletta moduler lists, maps, binary, math, unicode, string, persistent_term, atomics och counters",
          "Alla dokumenterade funktioner i ordsets, orddict, proplists, dict, sets, gb_trees, gb_sets, queue och array, över OTP:s datastrukturer",
          "Kompletta moduler calendar, filename, uri_string, json, base64, rand och random; io_lib och dess formaterade utskrift, allt utom fread",
          "re över PCRE2 och zlib, byggda från de biblioteksversioner som ingår i OTP 29",
          "Clause-versioner av de ERTS-moduler som OTP:s kernel och stdlib anropar, till exempel init, erts_internal, erl_prim_loader, prim_eval och unicode_util",
        ],
      },
      {
        id: "tooling",
        title: "Projekt och verktyg",
        items: [
          "TOML-projekt med namngivna mål, hittande av källfiler, sökvägar, ignorerade kataloger och moduler samt inställningar per mål",
          "En byggkatalog med SQLite-byggcacher för kompileringsresultat, utdata från parse transforms och härledningsresultat",
          "Inspektion med --print-inputs, --print-env och --print-stage-times",
          "Kommenterade startprojekt med clau --new-project",
          "Ett clau-kommando från Erlang-källkod till körbart program; även escripts kan kompileras",
          "Felsökningsradtabeller med -g (CodeView eller DWARF 5) och valfri profilering med --profile",
          "Beteendet kontrolleras mot utdata från referensversionen av Erlang/OTP",
          "Prestandatester mot Erlang/OTP på värddatorn, som körs manuellt",
          "Körningar med sanitizers för adresser, odefinierat beteende och trådar på Linux",
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
  notFound: {
    title: "Sidan hittades inte",
    home: "Gå till startsidan",
  },
} satisfies Messages;
