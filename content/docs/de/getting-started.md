---
source: docs/getting-started.md
sourceCommit: a8c3f8f6
sourceSha256: e41796ac4ccff30a50eeb282a99fd37d606801927af08faf115a4a6e21bfe5fd
translatedAt: 2026-10-17
---
# Erste Schritte

Voraussetzungen:

- CMake 3.28+ und ein C++23-Compiler; unter Windows die Visual-Studio-Workload
  **Desktop development with C++** mit einem Windows SDK, Ninja und eine globale
  LLVM/Clang-Installation (`clang-cl` sowie `clang` zum Linken von Programmen).
- LLVM-23.1.x-C++-SDK (23.1.1 oder neuer) für den Compiler. Eine globale
  Installation wird bevorzugt; andernfalls lädt CMake unter Windows x64/ARM64,
  Linux x64/ARM64 und macOS ARM64 das festgelegte SDK 23.1.2 nach
  `thirdparty/` herunter ([LLVM SDK](compile.md#llvm-sdk)). Die
  LLVM-Kommandozeilenwerkzeuge allein enthalten das SDK nicht.
- Boost 1.90+ (Multiprecision, Asio und Parser für den Compiler; rein
  headerbasiert), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 und zlib 1.3.2.
  CMake lädt fehlende Abhängigkeiten mit SHA-256-Prüfung nach `thirdparty/`
  herunter und verwendet sie ohne Netzwerk wieder, auch für neue
  Build-Verzeichnisse; unter Linux und macOS stammen Boost und toml++ aus einer
  Installation oder aus `thirdparty/`
  ([Build-Abhängigkeit](projects.md#build-dependency)).
- Python 3 für Tests sowie die Qualitäts-, Benchmark- und Listing-Werkzeuge.
- Erlang/OTP wird weder zum Bauen noch zum Testen benötigt. Tests verwenden
  [projekteigene Golden-Fixtures](../tests/fixtures/patternmatch/generated/README.md);
  nur Parse transforms, optionale Live-Audits, die Neuerzeugung von Fixtures
  und Benchmarks benötigen eine OTP-29-Installation.

Unter macOS (Erlang optional):

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```
