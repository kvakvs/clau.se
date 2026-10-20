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
        text: "Preprocesses and parses Erlang/OTP 29 source, native records included.",
      },
      {
        id: "benchmarks",
        property: "{ratio} {side}",
        title: "Speed against OTP",
        text: "Geometric mean of {count} benchmark kernels, Clause -O2 against the BEAM JIT.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Native executables",
        text: "One command from Erlang source to a standalone program, compiled through LLVM with link-time optimization. Escripts too.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang processes",
        text: "Lightweight processes with per-process garbage collection on several scheduler threads.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "OTP library",
        text: "Clause's own stdlib and kernel with OTP 29's exports, results and errors.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Ports and I/O",
        text: "Files, subprocesses and TCP/UDP sockets on one event-driven I/O thread.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Type inference",
        text: "At O2, inferred types remove runtime checks and select specialized code.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Runs parse transforms while compiling; the executables never need OTP.",
      },
      {
        id: "targets",
        property: "7 targets",
        title: "Cross-platform",
        text: "Runs on Windows x64 and Linux x86-64; objects for seven targets.",
      },
    ],
    detailsTitle: "Feature details",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Erlang/OTP 29 syntax: records, maps, bitstrings, comprehensions, types and specifications",
          "Macros, includes and conditional compilation",
          "Parse transforms on a host Erlang/OTP 29, ms_transform and qlc included",
        ],
      },
      {
        id: "language",
        title: "Erlang semantics",
        items: [
          "Pattern matching and guards in clauses, case, if and receive",
          "Records, funs, maybe and list, binary and map comprehensions",
          "Exceptions with try, catch and stack traces",
        ],
      },
      {
        id: "compiler",
        title: "Compiler",
        items: [
          "Type inference with per-clause function types",
          "LLVM O0, O2 and Os, with link-time optimization across modules",
          "O2 removes type checks proven by inference",
          "Proper tail calls and deep recursion",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "C++23 runtime with all Erlang term types, arbitrary-precision integers included",
          "Processes, selective receive, links, monitors and timers on several scheduler workers",
          "Per-process heaps with a copying garbage collector",
          "Concurrent ETS tables in C++",
        ],
      },
      {
        id: "library",
        title: "OTP library",
        items: [
          "Clause's own OTP 29 modules with OTP's exports, results and error reasons",
          "stdlib: lists, maps, string, binary, json, rand and the collection modules",
          "ets, dets with files as OTP writes them, re and zlib",
          "kernel: file, gen_tcp, gen_udp, inet and os",
        ],
      },
      {
        id: "tooling",
        title: "Projects and tooling",
        items: [
          "One clau command from Erlang source to a native executable",
          "TOML projects with SQLite build caches",
          "Debug info with -g (CodeView or DWARF 5) and profiling with --profile",
          "Tested against the reference Erlang/OTP and benchmarked against OTP",
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
    kernelInfo: {
      "datagen.list_of_tuples":
        "Builds a list of 200,000 small tuples, 260 times",
      "datagen.list_to_tuple":
        "Converts 1,000-element lists to tuples, 170,000 times",
      "datagen.map_put":
        "Inserts 2,000 integer keys into a map one by one, 4,900 times",
      "datagen.binary_append":
        "Appends 10,000 32-bit integers to a growing binary, 23,000 times",
      "datagen.bigint_factorial":
        "Computes the factorial of 3,000 with big integers, 330 times",
      "datagen.string_build":
        "Builds 20,000 strings from integers and atoms, 1,000 times",
      "dataproc.sort": "Sorts a list of 20,000 random integers, 600 times",
      "dataproc.map_foldl":
        "Maps, then folds a list of 20,000 integers, 4,500 times",
      "dataproc.map_update":
        "Increments every value of a 500-key map, 24,000 times",
      "dataproc.binary_match":
        "Sums 20,000 32-bit integers matched out of a binary, 49,000 times",
      "dataproc.int_to_list":
        "Converts 20,000 integers to strings and back, 2,000 times",
      "dataproc.term_to_binary":
        "Encodes and decodes a large nested term, 4,300 times",
      "dataproc.comprehension":
        "List comprehension filtering and doubling 20,000 integers, 15,000 times",
      "dataproc.small_map": "Updates a small state map 80 million times",
      "file.small_files":
        "Writes, reads back and deletes 500 small files, 11 times",
      "file.large_write": "Writes a 16 MB file in 64 KB chunks, 200 times",
      "file.large_read": "Reads a 16 MB file in 64 KB chunks, 370 times",
      "file.read_line": "Reads a 20,000-line text file line by line, 52 times",
      "file.read_file": "Reads a whole 16 MB file in one call, 330 times",
      "gc.short_processes":
        "Spawns 5,000 short-lived processes that each make garbage, 69 times",
      "gc.grow_shrink":
        "Grows the heap with a 200,000-element list, then drops it, 300 times",
      "gc.long_lived_churn":
        "Keeps a sliding window of 10,000 live elements among garbage, 370 times",
      "gc.explicit_collect":
        "Forces garbage collection with 10,000 live tuples, 5,100 times",
      "msg.ping_pong":
        "Bounces one message between two processes 2 million times",
      "msg.fan_in": "100 processes each send 1,000 messages to one, 25 times",
      "msg.ring": "Passes a token around a 1,000-process ring 3,050 times",
      "msg.large_message":
        "Sends a 100,000-element list to another process and back, 560 times",
      "socket.tcp_echo": "Echoes 30,000 messages of 1 KB over loopback TCP",
      "socket.tcp_connect":
        "Opens 900 TCP connections over loopback, echoing 25 messages of 1 KB on each",
      "socket.udp_round_trip":
        "Bounces a 1 KB datagram 27,900 times over loopback UDP",
    },
    programInfo: {
      bench_datagen:
        "Builds lists, tuples, maps, binaries and big integers in bulk",
      bench_dataproc:
        "Sorting, folds, map updates, binary matching and conversions",
      bench_file: "Small and large file writes and reads, line reads",
      bench_gc:
        "Short-lived processes, heap growth and shrinking, live data churn",
      bench_msg: "Ping-pong, fan-in, a process ring and large message copies",
      bench_socket: "TCP echo, TCP connects and UDP round trips over loopback",
    },
    programsTitle: "Whole programs",
    programsNote: "Wall time in seconds, startup included, median of the runs.",
    program: "Program",
    historyTitle: "Progress",
    historyNote:
      "Geometric mean of Clause's time divided by OTP's on each recorded run day.",
    pinnedSince:
      "Runs before {date} were not pinned to a CPU set, so part of the change on that day comes from the pinning.",
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
    cpuSet: "CPU set",
    cpuSetPerformance:
      "Performance cores {list}, {count} of {total} logical CPUs",
    cpuSetList: "CPUs {list}, {count} of {total} logical CPUs",
    pinningPerformance:
      "OTP and Clause run on the same CPUs: every benchmark program is pinned to the performance cores of the processor, so on a hybrid CPU no kernel lands on a slower efficiency core. Both keep one scheduler online per CPU of that set, unbound within it.",
    pinningList:
      "OTP and Clause run on the same CPUs: every benchmark program is pinned to the CPU set above. Both keep one scheduler online per CPU of that set, unbound within it.",
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
