---
source: docs/getting-started.md
sourceCommit: a8c3f8f6
sourceSha256: e41796ac4ccff30a50eeb282a99fd37d606801927af08faf115a4a6e21bfe5fd
translatedAt: 2026-10-17
---
# Premiers pas

Prérequis :

- CMake 3.28+ et un compilateur C++23 ; sous Windows, la charge de travail
  **Desktop development with C++** de Visual Studio avec un Windows SDK, Ninja
  et une installation globale de LLVM/Clang (`clang-cl`, et `clang` pour
  l'édition de liens des programmes).
- Le SDK C++ de LLVM 23.1.x (23.1.1 ou plus récent) pour le compilateur. Une
  installation globale est préférée ; sinon CMake télécharge le SDK épinglé
  23.1.2 dans `thirdparty/` sous Windows x64/ARM64, Linux x64/ARM64 et macOS
  ARM64 ([SDK LLVM](compile.md#llvm-sdk)). Les outils en ligne de commande de
  LLVM seuls ne contiennent pas le SDK.
- Boost 1.90+ (Multiprecision, Asio et Parser pour le compilateur ; uniquement
  en en-têtes), toml++ 3.4.0, SQLite 3.54.0, PCRE2 10.47 et zlib 1.3.2. CMake
  télécharge ceux qui manquent dans `thirdparty/` avec vérification SHA-256 et
  les réutilise hors ligne, y compris pour de nouveaux répertoires de
  compilation ; sous Linux et macOS, Boost et toml++ proviennent d'une
  installation ou de `thirdparty/`
  ([dépendance de compilation](projects.md#build-dependency)).
- Python 3 pour les tests et les outils de qualité, de benchmark et de listage.
- Erlang/OTP n'est pas nécessaire pour compiler ni pour tester. Les tests
  utilisent des
  [fixtures de référence propres au projet](../tests/fixtures/patternmatch/generated/README.md) ;
  seuls les parse transforms, les audits optionnels en direct, la régénération
  des fixtures et les benchmarks exigent une installation d'OTP 29.

Sous macOS (Erlang optionnel) :

```sh
xcode-select --install
brew install cmake boost tomlplusplus llvm@23 erlang
```
