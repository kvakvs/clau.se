export const en = {
  meta: {
    description:
      "Clause compiles Erlang/OTP 29 ahead of time through LLVM into native executables.",
  },
  nav: {
    label: "Main",
    home: "Home",
    docs: "Documentation",
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
  },
  home: {
    title: "Erlang/OTP 29, compiled to native code",
    intro:
      "Clause is an ahead-of-time compiler for Erlang. It preprocesses, parses and analyzes Erlang source, compiles it through LLVM and links native executables with its own runtime: lightweight processes on several scheduler threads, message passing, ports and per-process garbage collection.",
    status:
      "Work in progress: a growing subset of Erlang compiles to native executables and runs on Windows and Linux today. Still to come: validation on macOS Apple Silicon and native ARM hardware, wider comparisons with OTP's own test suites, and Clause versions of the runtime modules that OTP's kernel and stdlib call. The documentation lists what works and where Clause differs from Erlang/OTP.",
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
        text: "Processes on several scheduler worker threads with selective receive, timeouts, links, monitors, registered names and exit signals.",
      },
      {
        id: "memory",
        property: "Per-process GC",
        title: "Isolated memory",
        text: "Every process owns its heap, collected by a copying garbage collector in the classic ERTS design.",
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
          "Type inference with per-clause function types; a specification that contradicts the inferred argument types is a compile error, other contradictions are warnings",
          "LLVM O0, O2 and Os; per-module objects, IR and bitcode; IR snapshots annotated with Erlang source",
          "O2 removes type and shape checks proven by inference, with bounded type-specialized variants",
          "Link-time optimization across modules with --lto",
          "Executables leave out the exports their entry function cannot reach; --keep-exports keeps them all",
          "Type reports: source annotated with inferred function signatures",
          "Proper tail calls and deep recursion on an explicit per-process stack",
          "One explicit notimpl message for legal Erlang that needs a feature not implemented yet",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "LLVM-free C++23 runtime library linked into every program",
          "Arbitrary-precision integers, floats, atoms, tuples, lists, maps, bitstrings, records, funs, pids, ports and references",
          "Processes, messages, selective receive, links, monitors, registered names and timers on several scheduler workers",
          "Per-process heaps with a copying garbage collector, off-heap binaries and optional memory limits",
          "Ports for files, standard I/O, subprocesses and TCP/UDP sockets on one event-driven I/O thread",
          "The erlang module: process dictionary, external term format, time and timers, process introspection, spawn options, aliases and hashing",
          "Every OTP 29 export of a Clause library module compiles; functions not implemented yet raise not_implemented when called",
          "io:format with OTP's ~p pretty printing; subsets of lists, maps, file, io, gen_tcp, gen_udp, inet and os",
        ],
      },
      {
        id: "tooling",
        title: "Projects and tooling",
        items: [
          "TOML projects with named targets, source discovery, search paths, ignored directories and modules, and per-target options",
          "A build directory with SQLite build caches for compile results and parse transform output",
          "Inspection with --print-inputs, --print-env and --print-stage-times",
          "Annotated starter projects with clau --new-project",
          "One clau command from Erlang source to a native executable; escripts compile too",
          "Debug line tables with -g (CodeView or DWARF 5) and opt-in profiling with --profile",
          "Behavior checked against outputs of the reference Erlang/OTP",
          "Address, undefined-behavior and thread sanitizer runs on Linux",
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
        text: "Prerequisites: CMake, a C++23 compiler, Clang, the LLVM SDK, Boost and toml++.",
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
  resources: {
    title: "Resources",
    intro: "Where to find the source code and follow development.",
    github: {
      title: "GitHub repository",
      text: "Source code, issues and development history.",
    },
    credits: "Art credits",
  },
  notFound: {
    title: "Page not found",
    home: "Go to the home page",
  },
};

export type Messages = typeof en;
