---
source: docs/getting-started.md
sourceCommit: 6ed3851c
sourceSha256: 95b73af25f3b08912c8b7f38fe46edf93a90187b3df3c13291d19a90411c29b1
translatedAt: 2026-10-15
---
# Premiers pas

Prérequis :

- CMake 3.28+ et un compilateur prenant en charge C++23.
- Sous Windows, un exécutable Clang installé dans le `PATH` ou sous
  `Program Files/LLVM/bin` ; la configuration échoue immédiatement s'il est
  absent ou ne peut pas s'exécuter.
- Le SDK C++ de LLVM 23.1.x (>=23.1.1) pour compiler le compilateur. CMake
  préfère une installation globale, puis télécharge le SDK épinglé 23.1.2 dans
  `thirdparty/` s'il est absent ; voir
  [configuration du SDK et contrat de compilation](compile.md).
- Boost 1.90+ avec Boost.Multiprecision pour le compilateur et le runtime ; le
  compilateur exige aussi Boost.Parser. Multiprecision est uniquement en en-têtes
  et ne nécessite aucune bibliothèque binaire de Boost.
- toml++ 3.4.0 pour les manifestes de projet ; voir
  [configuration de la dépendance](projects.md#build-dependency).
- Les compilations et tests normaux ne nécessitent pas Erlang/OTP. Les tests
  utilisent des
  [fixtures de référence propres au projet](../tests/fixtures/patternmatch/generated/README.md).
  Les audits optionnels en direct et la régénération explicite des fixtures
  exigent Erlang/OTP 29+.

Sous macOS :

```sh
xcode-select --install
brew install cmake boost erlang tomlplusplus llvm@23
```

Sous Windows, installer LLVM/Clang globalement pour les outils de compilation de
l'hôte. Installer la charge de travail **Desktop development with C++** de Visual
Studio et un Windows SDK, ainsi que Ninja. Utiliser une invite de commandes
**x64 Native Tools** ou un Developer PowerShell configuré pour x64, avec
`clang-cl`, `cmake` et `ninja` dans le `PATH`.
CMake vérifie l'ABI MSVC, l'édition de liens avec le Windows SDK et la prise en
charge de `std::expected` de C++23. Les outils en ligne de commande de LLVM seuls
ne fournissent pas le SDK C++ requis ; CMake le télécharge séparément quand
`LLVMConfig.cmake` et les bibliothèques correspondantes sont absents.

CMake télécharge Boost 1.90.0 et toml++ 3.4.0 dans le répertoire ignoré
`thirdparty/` lors de la première utilisation, vérifie leurs sommes de contrôle
SHA-256 et conserve les archives comme les sources extraites. Les configurations
suivantes, y compris dans de nouveaux répertoires de compilation, réutilisent ces
fichiers sans accès réseau. Supprimer `build/` ne supprime pas les dépendances.
Quand la pile TLS propre à CMake ne peut pas vérifier les certificats (par
exemple le CMake fourni avec Strawberry Perl), les téléchargements sont retentés
avec le `curl` de l'hôte et restent vérifiés. Les compilations du runtime seul ne
téléchargent que Boost. Les racines de dépendances explicites ci-dessous sont
prioritaires et permettent une installation hors ligne ; une racine explicite
invalide échoue sans téléchargement. Linux et macOS continuent d'utiliser les
dépendances installées ou les sources locales de `thirdparty/`.
Les téléchargements de repli du SDK LLVM s'appliquent sur **les trois
plateformes**, avec des archives officielles épinglées par SHA-256 pour Windows
x64/ARM64, Linux x64/ARM64 et macOS ARM64. Les archives et les SDK extraits
restent dans `thirdparty/` pour être réutilisés hors ligne. Les autres
architectures d'hôte et les compilations croisées exigent un `LLVM_DIR`
explicite correspondant.

Pour les compilations du compilateur, les dépendances zlib et zstd de LLVM sont
détectées à partir des bibliothèques installées. Sous Windows, les bibliothèques
manquantes déclenchent le téléchargement, vérifié par SHA-256, de zlib 1.3.2 et
zstd 1.5.7, suivi de compilations statiques Debug/Release sous `thirdparty/`. Ces
compilations sont réutilisées d'un répertoire de compilation à l'autre et
correspondent au compilateur, à l'architecture et au CRT de l'hôte. Définir
`ZLIB_ROOT` ou `zstd_ROOT` pour préférer une bibliothèque installée ;
`CLAUSE_DOWNLOAD_ZLIB=OFF` et `CLAUSE_DOWNLOAD_ZSTD=OFF` désactivent les replis
respectifs. La découverte du SDK MSVC rejette les bibliothèques MinGW `.a` en
cache, comme celles fournies avec Strawberry Perl. Linux et macOS utilisent les
paquets de développement installés.
