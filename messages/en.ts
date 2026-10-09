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
      "Clause is an ahead-of-time compiler for Erlang. It preprocesses, parses and analyzes Erlang source, compiles it through LLVM and links native executables with its own runtime: lightweight processes, message passing and per-process garbage collection.",
    status:
      "Work in progress: a growing subset of Erlang compiles and runs today. The documentation lists what works and where Clause differs from Erlang/OTP.",
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
        text: "Compiles to verified LLVM IR, bitcode or native objects at O0, O2 or Os, with type-specialized function variants.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Native executables",
        text: "Links Erlang modules and the runtime into a standalone program with Clang, in one command.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Erlang processes",
        text: "Processes on scheduler worker threads with selective receive, timeouts, links, monitors, registered names and exit signals.",
      },
      {
        id: "memory",
        property: "Per-process GC",
        title: "Isolated memory",
        text: "Every process owns its heap, collected by a copying garbage collector in the classic ERTS design.",
      },
      {
        id: "targets",
        property: "7 targets",
        title: "Cross-platform",
        text: "Native execution validated on Windows x64; objects checked for Linux x86, x64, ARM and AArch64, Windows x86 and x64, and Apple Silicon.",
      },
    ],
    detailsTitle: "Feature details",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Preprocessing: macros, includes, include_lib, conditional compilation and language features",
          "Erlang/OTP 29 syntax: expressions, patterns, records, bitstrings, types and specifications, control flow and comprehensions",
          "Syntax checking, expanded source output and an indented syntax tree view",
          "Source diagnostics across multiple input files",
        ],
      },
      {
        id: "compiler",
        title: "Compiler",
        items: [
          "Semantic analysis: subset checks, variable bindings, call resolution, declared and inferred types",
          "LLVM O0, O2 and Os; per-module objects, IR and bitcode; IR snapshots annotated with Erlang source",
          "Type reports: source annotated with inferred function signatures",
          "Proper tail calls for local, remote and mutually recursive calls",
          "One explicit notimpl message for legal Erlang that needs a feature not implemented yet",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "LLVM-free C++23 runtime library linked into every program",
          "Arbitrary-precision integers, floats, atoms, tuples, lists, maps, bitstrings, records, funs, pids, ports and references",
          "Processes, messages, selective receive, links, monitors and registered names on scheduler workers",
          "Per-process heaps with a copying garbage collector and off-heap binaries",
          "Ports for standard I/O, files, subprocesses and sockets",
          "Exceptions with try, catch and after, and stack traces",
          "io:format with OTP's ~p pretty printing; subsets of lists, maps, file and io",
        ],
      },
      {
        id: "tooling",
        title: "Projects and tooling",
        items: [
          "TOML projects with named targets, source discovery and per-target options",
          "Annotated starter projects with clau --new-project",
          "One clau command from Erlang source to a native executable",
          "Behavior checked against outputs of the reference Erlang/OTP",
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
        text: "Command line options, inspection modes, executables and TOML projects.",
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
  },
  notFound: {
    title: "Page not found",
    home: "Go to the home page",
  },
};

export type Messages = typeof en;
