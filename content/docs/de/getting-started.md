---
source: docs/getting-started.md
sourceCommit: 6ed3851c
sourceSha256: 95b73af25f3b08912c8b7f38fe46edf93a90187b3df3c13291d19a90411c29b1
translatedAt: 2026-10-15
---
# Erste Schritte

Voraussetzungen:

- CMake 3.28+ und ein C++23-fähiger Compiler.
- Unter Windows eine installierte Clang-Programmdatei in `PATH` oder unter
  `Program Files/LLVM/bin`; die Konfiguration schlägt sofort fehl, wenn sie
  fehlt oder nicht ausgeführt werden kann.
- LLVM-23.1.x-C++-SDK (>=23.1.1) für Compiler-Builds. CMake bevorzugt eine
  globale Installation und lädt andernfalls das festgelegte SDK 23.1.2 nach
  `thirdparty/` herunter; siehe
  [SDK-Einrichtung und Kompiliervertrag](compile.md).
- Boost 1.90+ mit Boost.Multiprecision für Compiler und Runtime; der Compiler
  benötigt außerdem Boost.Parser. Multiprecision ist rein headerbasiert und
  braucht keine binäre Boost-Bibliothek.
- toml++ 3.4.0 für Projektmanifeste; siehe
  [Einrichtung der Abhängigkeit](projects.md#build-dependency).
- Normale Builds und Tests benötigen kein Erlang/OTP. Tests verwenden
  [projekteigene Golden-Fixtures](../tests/fixtures/patternmatch/generated/README.md).
  Optionale Live-Audits und die explizite Neuerzeugung von Fixtures erfordern
  Erlang/OTP 29+.

Unter macOS:

```sh
xcode-select --install
brew install cmake boost erlang tomlplusplus llvm@23
```

Unter Windows LLVM/Clang global für die Host-Compiler-Werkzeuge installieren.
Die Visual-Studio-Workload **Desktop development with C++** und ein Windows SDK
sowie Ninja installieren. Eine **x64 Native Tools**-Eingabeaufforderung oder eine
für x64 konfigurierte Developer-PowerShell verwenden, mit `clang-cl`, `cmake` und
`ninja` in `PATH`.
CMake prüft die MSVC-ABI, das Linken gegen das Windows SDK und die Unterstützung
für C++23-`std::expected`.
Die LLVM-Kommandozeilenwerkzeuge allein liefern nicht das benötigte C++-SDK;
CMake lädt es separat herunter, wenn `LLVMConfig.cmake` und passende
Bibliotheken fehlen.

CMake lädt Boost 1.90.0 und toml++ 3.4.0 bei der ersten Verwendung in das
ignorierte Verzeichnis `thirdparty/` herunter, verifiziert ihre
SHA-256-Prüfsummen und behält sowohl die Archive als auch die entpackten
Quellen. Spätere Konfigurationen, auch in neuen Build-Verzeichnissen, verwenden
diese Dateien ohne Netzwerkzugriff wieder. Das Entfernen von `build/` entfernt
keine Abhängigkeiten.
Kann der eigene TLS-Stack von CMake Zertifikate nicht verifizieren (zum Beispiel
bei dem mit Strawberry Perl gebündelten CMake), werden Downloads mit dem `curl`
des Hosts wiederholt und trotzdem verifiziert.
Reine Runtime-Builds laden nur Boost herunter. Die unten genannten expliziten
Abhängigkeitswurzeln haben Vorrang und ermöglichen eine Einrichtung ohne
Netzwerk; eine ungültige explizite Wurzel schlägt fehl, ohne herunterzuladen.
Linux und macOS verwenden weiterhin installierte Abhängigkeiten oder lokale
Quellen in `thirdparty/`.
Rückfall-Downloads des LLVM-SDK gelten auf **allen drei Plattformen**, mit per
SHA-256 festgelegten offiziellen Archiven für Windows x64/ARM64, Linux
x64/ARM64 und macOS ARM64.
Archive und entpackte SDKs bleiben zur Wiederverwendung ohne Netzwerk in
`thirdparty/`. Andere Host-Architekturen und Cross-Builds erfordern ein
explizites passendes `LLVM_DIR`.

Bei Compiler-Builds werden die Abhängigkeiten zlib und zstd von LLVM aus
installierten Bibliotheken erkannt. Unter Windows lösen fehlende Bibliotheken
SHA-256-verifizierte Downloads von zlib 1.3.2 und zstd 1.5.7 aus, gefolgt von
statischen Debug-/Release-Builds unter `thirdparty/`.
Diese Builds werden über Build-Verzeichnisse hinweg wiederverwendet und passen
zu Host-Compiler, Architektur und CRT. `ZLIB_ROOT` oder `zstd_ROOT` setzen, um
eine installierte Bibliothek zu bevorzugen;
`CLAUSE_DOWNLOAD_ZLIB=OFF` und `CLAUSE_DOWNLOAD_ZSTD=OFF` deaktivieren den
jeweiligen Rückfall. Die Suche nach dem MSVC-SDK weist gecachte MinGW-`.a`-
Bibliotheken ab, etwa die mit Strawberry Perl gebündelten. Linux und macOS
verwenden installierte Entwicklungspakete.
