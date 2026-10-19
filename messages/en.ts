export const en = {
  meta: {
    description:
      "Clause compiles Erlang/OTP 29 ahead of time through LLVM into native executables.",
  },
  nav: {
    label: "Main",
    home: "Home",
    docs: "Documentation",
    benchmarks: "Benchmarks",
    resources: "Resources",
  },
  theme: {
    label: "Color theme",
    light: "Light",
    auto: "Auto",
    dark: "Dark",
  },
  language: {
    label: "Language",
  },
  footer: {
    tagline: "Erlang, compiled ahead of time.",
    updated: "Updated",
    cookies: "Cookies",
  },
  home: {
    title: "Erlang/OTP 29, compiled to native code",
    intro:
      "Clause is an ahead-of-time compiler for Erlang. It preprocesses, parses and analyzes Erlang source, compiles it through LLVM and links native executables with its own runtime: lightweight processes on several scheduler threads, message passing, ports and per-process garbage collection.",
    status:
      "Work in progress: a growing subset of Erlang and OTP's stdlib compiles to native executables that run on Windows and Linux today. Still to come: macOS Apple Silicon and native ARM hardware, OTP's own test suites, and more optimization. The benchmarks page shows where Clause stands against OTP; the documentation lists what works and where Clause differs.",
    ctaDocs: "Read the documentation",
    ctaSource: "Source on GitHub",
    cardsTitle: "Features",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Modern Erlang syntax",
        text: "Preprocessor and parser for Erlang/OTP 29: macros, records, native records, maps, bitstrings, comprehensions, maybe and type specifications.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "LLVM backend",
        text: "Compiles to verified LLVM IR, bitcode or native objects at O0, O2 or Os, with optional link-time optimization across modules.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Native executables",
        text: "Links Erlang modules, the library subset they use and the runtime into a standalone program with Clang, in one command. Escripts compile too.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang processes",
        text: "Lightweight processes with their own heaps and garbage collection on several scheduler threads, with selective receive, links and monitors.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "OTP library",
        text: "Clause's own stdlib, kernel and ERTS modules with OTP 29's exports, results and errors, from lists and maps to ETS tables and dets files OTP can open.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Ports and I/O",
        text: "Files, standard input and output, subprocesses and TCP/UDP sockets through ports, served by one event-driven I/O thread.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Type inference",
        text: "Infers per-clause function types; at O2 they remove runtime checks and select type-specialized variants with a generic fallback.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Applies parse transforms as erlc does, running them on an Erlang/OTP 29 installed on the host while compiling; the executables never need OTP.",
      },
      {
        id: "targets",
        property: "7 targets",
        title: "Cross-platform",
        text: "Native execution validated on Windows x64 and Linux x86-64; runtime tested on 32-bit x86 and, under emulation, on ARM. Objects for seven targets, Apple Silicon included.",
      },
    ],
    detailsTitle: "Feature details",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Preprocessing: macros, includes, include_lib (also from versioned application directories), conditional compilation and language features",
          "Parse transforms run on a host Erlang/OTP 29, OTP's ms_transform and qlc included; --print-abstr prints the abstract format forms",
          "Erlang/OTP 29 syntax: expressions, patterns, records, bitstrings, types and specifications, control flow and comprehensions",
          "Syntax checking, expanded source output and an indented syntax tree view",
          "Source diagnostics across multiple input files",
        ],
      },
      {
        id: "language",
        title: "Erlang semantics",
        items: [
          "Pattern matching and guards in function clauses, case, if, receive and body matches",
          "maybe, and list, binary and map comprehensions",
          "Records with updates and record_info/2; native, qualified and anonymous records",
          "Funs with captures, named funs, dynamic calls and apply",
          "Exceptions: error, exit, throw, catch, try ... of ... catch ... after, and stack traces",
          "Module attributes: -behaviour callback checks, -import, informational attributes and generated module_info/0,1",
        ],
      },
      {
        id: "compiler",
        title: "Compiler",
        items: [
          "Semantic analysis: subset checks, variable bindings, call resolution, declared and inferred types",
          "Type inference with per-clause function types; specifications that contradict them are reported",
          "LLVM O0, O2 and Os; per-module objects, IR and bitcode; IR and assembly listings annotated with Erlang source",
          "Inline fast paths for allocation, type tests, tuple, list and map access, binaries, closures and float arithmetic",
          "O2 removes type checks proven by inference and selects type-specialized variants",
          "Link-time optimization across modules with --lto; unreachable exports left out of executables",
          "Proper tail calls and deep recursion on an explicit per-process stack",
          "One explicit notimpl message for legal Erlang that needs a feature not implemented yet",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "LLVM-free C++23 runtime library linked into every program",
          "All Erlang term types, arbitrary-precision integers included",
          "Processes, messages, selective receive, links, monitors, registered names and timers on several scheduler workers",
          "Per-process heaps with a copying garbage collector, shared off-heap binaries and optional memory limits",
          "Ports for files, standard I/O, subprocesses and TCP/UDP sockets on one event-driven I/O thread",
          "Concurrent ETS tables in C++",
        ],
      },
      {
        id: "library",
        title: "OTP library",
        items: [
          "Clause's own versions of OTP 29 modules with OTP's export lists, results and error reasons; functions not implemented yet raise not_implemented",
          "stdlib: lists, maps, string, unicode, binary, io_lib, json, rand, calendar, the collection modules, sofs, graph and digraph",
          "ets with match specifications and table files, dets with files byte for byte as OTP writes them, and ms_transform",
          "re over PCRE2, zlib and the erlang module",
          "kernel: file, gen_tcp, gen_udp, inet, os and code",
          "The ERTS modules OTP's kernel and stdlib call",
        ],
      },
      {
        id: "tooling",
        title: "Projects and tooling",
        items: [
          "TOML projects with named targets, source discovery and per-target options",
          "SQLite build caches for compile results, parse transform output and inference results",
          "Annotated starter projects with clau --new-project",
          "One clau command from Erlang source to a native executable; escripts compile too",
          "Debug line tables with -g (CodeView or DWARF 5) and opt-in profiling with --profile",
          "Tested against the reference Erlang/OTP, with sanitizer runs on Linux and benchmarks against OTP",
        ],
      },
    ],
  },
  docs: {
    title: "Documentation",
    notReady: "The documentation is not ready yet.",
    meanwhile:
      "Meanwhile, you are welcome to read the developer notes from the project repository. They describe the current implementation and its limits.",
    synced: "Synced from commit",
    startHere: "Start here",
    reference: "Reference notes",
    notWritten: "Not written yet. Meanwhile, see:",
    allDocs: "All documentation",
    englishOnly: "This page is not translated yet, so it is shown in English.",
    outdated:
      "The English original has changed since this translation was made, so parts of it may be out of date.",
    translated: "Translated from the English original",
    readEnglish: "Read in English",
    featured: {
      gettingStarted: {
        title: "Getting started",
        text: "Prerequisites: CMake, a C++23 compiler, Clang, the LLVM 23 SDK, Boost and toml++; CMake downloads the other libraries. Erlang/OTP is optional.",
      },
      building: {
        title: "Building the compiler",
        text: "Configure, build and test with CMake presets on Linux, macOS and Windows.",
      },
      using: {
        title: "Using the compiler",
        text: "Command line options, inspection modes, executables, TOML projects and parse transforms.",
      },
      interpreting: {
        title: "How to interpret the results",
        text: "Trying Clause on an existing Erlang code base: what compiles today, what notimpl messages mean, and what to try next.",
      },
      differences: {
        title: "Known differences from Erlang/OTP",
        text: "Observable behavior where Clause knowingly differs from OTP 29.",
      },
    },
  },
  benchmarks: {
    title: "Benchmarks",
    intro:
      "Clause compared with Erlang/OTP on one machine: the same Erlang programs, compiled by erlc and by clau -O2, time their kernels after a warm-up call. These numbers change with every optimization.",
    geomean:
      "Geometric mean of kernel times, Clause -O2 against the BEAM JIT (OTP)",
    slowerOnAverage: "slower on average",
    fasterOnAverage: "faster on average",
    barFaster: "faster",
    barSlower: "slower",
    faster: "Kernels where Clause is faster",
    first: "Geometric mean on {date}, the first recorded run",
    kernelsTitle: "Kernel times",
    kernelsNote:
      "Median of {runs} runs in milliseconds. The bar shows Clause's time divided by OTP's on a logarithmic scale.",
    noisy: "Runs varied by more than half of the median.",
    kernel: "Kernel",
    otp: "OTP JIT",
    clause: "Clause -O2",
    ratio: "Clause ÷ OTP",
    legendFaster: "Clause faster",
    legendSlower: "OTP faster",
    groups: {
      datagen: "Data generation",
      dataproc: "Data processing",
      file: "File I/O",
      gc: "Garbage collection",
      msg: "Message passing",
      socket: "Loopback sockets",
    },
    programsTitle: "Whole programs",
    programsNote: "Wall time in seconds, startup included, median of the runs.",
    program: "Program",
    historyTitle: "Progress",
    historyNote:
      "Geometric mean of Clause's time divided by OTP's on each recorded run day.",
    date: "Date",
    commit: "Commit",
    sizesTitle: "Executable sizes",
    sizesNote:
      "Size of the benchmark programs as Clause builds them at each optimization level, in megabytes.",
    sizesHistoryNote:
      "-O2 sizes of the last {count} measured commits, oldest first. Each run also builds a baseline, the previous Clause commit (the newest commit at least one day older than HEAD, or the one given with --baseline), at -O2 to catch regressions; baselines appear here as commits of their own. The table below adds the total of all bench_* programs and the size of the clau compiler.",
    sizesTotal: "All bench_* programs",
    megabytes: "{value} MB",
    setupTitle: "Setup",
    machine: "Machine",
    cpus: "{count} logical CPUs",
    otpVersion: "Erlang/OTP",
    clauseCommit: "Clause commit",
    runAt: "Run",
    reproduce:
      "To run the benchmarks yourself, use make benchmark or make-benchmark.bat in the Clause repository; the benchmark notes describe the programs and options.",
    notes: "Benchmark notes",
  },
  resources: {
    title: "Resources",
    intro: "Where to find the source code and follow development.",
    github: {
      title: "GitHub repository",
      text: "Source code, issues and development history.",
    },
    credits: "Art credits",
  },
  cookies: {
    banner:
      "This site counts visits with Google Analytics, which sets cookies only if you accept.",
    accept: "Accept",
    decline: "Decline",
    policyLink: "Cookie policy",
    title: "Cookie policy",
    intro:
      "clau.se counts visits with Google Analytics to see which pages are read. Google Analytics is loaded and its cookies are set only after you accept them; until then, or if you decline, nothing is sent to Google.",
    choiceTitle: "Your choice",
    choice:
      "Declining changes nothing on the site. You can change your choice at any time; withdrawing consent deletes the analytics cookies.",
    current: "Current choice: {state}",
    granted: "accepted",
    denied: "declined",
    unset: "not made yet",
    storedTitle: "What is stored",
    name: "Name",
    purpose: "Purpose",
    duration: "Duration",
    rows: [
      {
        name: "_ga",
        purpose: "Google Analytics cookie: tells visitors apart",
        duration: "2 years",
      },
      {
        name: "_ga_8Y3XJHBHPB",
        purpose: "Google Analytics cookie: keeps the state of a visit",
        duration: "2 years",
      },
      {
        name: "analytics-consent",
        purpose: "Local storage in your browser: your cookie choice",
        duration: "Until you clear it",
      },
      {
        name: "theme, locale",
        purpose:
          "Local storage in your browser: the color theme and language you picked",
        duration: "Until you clear it",
      },
    ],
    googleTitle: "Google Analytics",
    google:
      "Google Analytics is a service of Google. With your consent it receives the pages you visit, the referring page, your browser and device type and an approximate location derived from your IP address.",
    googleLink: "How Google uses this information",
    contact: "Questions about this policy:",
  },
  notFound: {
    title: "Page not found",
    home: "Go to the home page",
  },
};

export type Messages = typeof en;
