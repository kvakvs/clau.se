---
source: docs/executables.md
sourceCommit: 06042fa
sourceSha256: aaec2d5d2a83da50b160d09c8b37ecf1648199279e5aed4b35ef794633bf589a
translatedAt: 2026-10-09
---
# Exécutables

Contrat des programmes construits par `clau -o` ou par un build de projet. Les
entrées positionnelles, ou exactement une cible de projet sélectionnée, sont
liées dans le chemin `-o` ; un build de projet lie chaque cible exécutable
sélectionnée à son `output` du manifeste
([édition de liens](#linking), [projets](projects.md#executables)).

## Choix du point d'entrée

Le point d'entrée est une fonction exportée d'arité 1 qui reçoit la liste des
arguments.

| Source | Écriture | Portée |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION]` | Lot positionnel, ou l'unique cible de projet sélectionnée |
| Manifeste | `entry = "MODULE[:FUNCTION]"` dans une table `[[targets]]` | Cette cible |
| Par défaut | L'unique escript, sinon l'unique module exportant `main/1` | Seulement lorsqu'un exécutable est demandé (`-o`, ou une cible de projet avec `output`) |

- `FUNCTION` vaut `main` par défaut. Les noms sont du texte d'atome sans
  guillemets : 1 à 255 scalaires Unicode, UTF-8 valide, sans caractères de
  contrôle ni `:`. Les autres écritures sont des erreurs d'utilisation (CLI,
  code de sortie 2) ou des erreurs de manifeste (code de sortie 1).
- `entry` est une clé optionnelle du schéma 1 ; les anciens manifestes restent
  valides. Le manifeste entier est décodé, donc un `entry` mal formé échoue
  même dans les cibles non sélectionnées.
- L'option CLI `--entry` remplace la clé du manifeste et exige exactement une
  cible sélectionnée. Elle est incompatible avec les actions de vérification
  et d'affichage et avec `--new-project` ; ces actions ignorent l'`entry` du
  manifeste (comme elles ignorent `output`).
- Un point d'entrée explicite est validé dans chaque mode de compilation (par
  défaut, `--emit`, inspection de l'IR/des types), en même temps que les
  diagnostics sémantiques ordinaires.

| Échec | Diagnostic (code de sortie 1) |
| --- | --- |
| Module absent du lot | `<origin>: entry module M is not among the compiled modules` (origine : `--entry` ou manifeste `file:line:col [target t] (entry)`) |
| Pas de `F/1` | `<file>:<line>:<col>: entry function M:F/1 is not defined` à la déclaration du module |
| Seulement d'autres arités | `... is not defined; found F/N, but the entry receives one argument (the argument list)` à cette définition |
| `F/1` non exportée | `<file>:<line>:<col>: entry function M:F/1 is not exported` à la définition |
| Pas de sélection, aucun export `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION] (an exported FUNCTION/1; FUNCTION defaults to main)` |
| Pas de sélection, plusieurs | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (même indication) |

Pour les cibles de projet, l'indication nomme aussi la clé du manifeste : `... --entry MODULE[:FUNCTION] or with
entry = "MODULE[:FUNCTION]" in this target's [[targets]] table of the project manifest ...`, par exemple :

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1; plain "app" calls app:main/1
```

## Arguments

`Entry(Argv)` reçoit une liste propre de chaînes (listes de points de code
Unicode), à l'exclusion du nom du programme et des
[options du runtime](#runtime-options) en tête, sinon inchangées et dans
l'ordre, comme `escript`.

- POSIX : les octets de chaque argument sont décodés en UTF-8 ; un octet qui
  ne commence pas une séquence valide devient le point de code de cet octet
  (repli sur Latin-1).
- Windows : le vecteur d'arguments large (UTF-16) du CRT, découpé selon les
  mêmes règles que `argv` ; un surrogate non apparié devient U+FFFD.
- Aucune autre analyse d'options, expansion de motifs de fichiers (globbing)
  ou expansion d'environnement n'a lieu dans le runtime.

## Options du runtime

Le runtime lit ses options dans la variable d'environnement `CLAUSE_FLAGS`
(mots séparés par des espaces et des tabulations, sans guillemets), puis dans
les arguments de ligne de commande en tête, de sorte que la ligne de commande
l'emporte. Les deux sont analysés de la même façon ; une valeur se place dans
l'argument suivant ou après `=`.

| Option | Effet |
| --- | --- |
| `--max-atoms N` | Taille de la table des atomes, de 1 à 2^26 (67 108 864) ; 2^20 (1 048 576) par défaut, comme `+t` d'OTP |
| `--max-heap BYTES` | Plafond du bloc de tas, des fragments et des binaries hors tas de chaque processus, au moins le tas minimal (233 mots) ; non plafonné par défaut |
| `--max-stack BYTES` | Plafond de la pile de cadres de chaque processus ; non plafonné par défaut |
| `--max-memory BYTES` | Plafond de la mémoire de l'ensemble des processus (tas, binaries hors tas, piles) ; non plafonné par défaut |
| `--schedulers N` | Workers de l'ordonnanceur exécutant les processus, de 1 à 1 024 ; un par processeur logique par défaut, comme `+S` d'OTP ([workers](processes.md#workers)) |
| `--args-file FILE` | Fichier d'options comme `vm.args` d'OTP : réservé, rapporte `runtime option --args-file is not implemented` |
| `--` | Termine les options du runtime ; les arguments suivants vont tous à `Entry` |

Sur la ligne de commande, l'analyse s'arrête au premier argument qui n'est pas
une option du runtime, donc `prog data --max-atoms 9` transmet les trois
arguments au programme. Dans `CLAUSE_FLAGS`, chaque mot doit être une option
du runtime. Une valeur invalide, un mot de la variable qui n'est pas une
option, ou `--args-file` arrête le programme avant l'enregistrement de tout
module : `clau: runtime failure: <reason>`, code de sortie 70. Le nombre de
processus n'est pas limité et la mémoire n'est pas plafonnée par défaut. Les
valeurs en octets sont décimales, sans suffixe, et arrondies à l'inférieur en
mots entiers ; un programme qui atteint un plafond échoue avec
`resource_limit`, code de sortie 70
([limite mémoire du runtime](runtime-heap.md#runtime-memory-limit)).

## Code de sortie

| Résultat | Code |
| --- | --- |
| Le point d'entrée retourne (n'importe quelle valeur) | 0 |
| `erlang:halt()` | 0 |
| `erlang:halt(N)`, entier non négatif | `N` (les hôtes POSIX gardent les 8 bits de poids faible) |
| `erlang:halt(Slogan)` avec une chaîne | Slogan sur stderr, puis 1 (pas de crash dump) |
| `erlang:halt(abort)` | Abandon natif (sans vidage des tampons) |
| Toute exception qui s'échappe du point d'entrée, y compris `throw` et `exit(normal)` | Rapport sur stderr, 1 |
| Processus d'entrée terminé par un signal de sortie ([processus](processes.md#exit-signals)) | Rapporté comme un `exit` non capturé, 1 ; raison `normal` : 0 |
| Échec du démarrage du runtime ou de l'infrastructure (incompatibilité d'ABI, enregistrement, mémoire avant le point d'entrée) | Message sur stderr, 70 |
| Mémoire de l'hôte épuisée (croissance du tas, d'un binary hors tas ou de la pile refusée ; aucun plafond mémoire par défaut, [épuisement de la mémoire](runtime-heap.md#failure-behavior)) | `clau: runtime failure: entry call failed: out_of_memory`, 70 |

Des arguments invalides de `halt/1` lèvent `badarg` chez l'appelant. Lorsque
le point d'entrée se termine, le programme se termine : les autres processus
sont arrêtés sans poursuivre leur exécution, comme avec `halt/1` d'OTP après
le retour d'`escript`. Un halt dans n'importe quel processus termine le
programme avec son code, et un échec du runtime dans n'importe quel processus
le termine avec 70 ; une exception dans un processus créé par spawn ne termine
que ce processus ([processus](processes.md)).

`halt/0,1`, `error/1,2,3`, `exit/1` et `throw/1` peuvent être appelées avec ou
sans le préfixe `erlang:` ; une définition locale ou
`-compile({no_auto_import, ...})` garde le nom non qualifié local, comme dans
OTP. `halt/2` n'est pas disponible.
`halt(N)` garde les 31 bits de poids faible de tout entier non négatif, comme
le fait OTP. Un slogan est une liste propre d'au plus 1 023 points de code
Unicode. Un halt déroule le point d'entrée à travers le canal d'erreur vérifié
comme une erreur, il n'arrête donc le programme qu'après le nettoyage généré.

## Flux de sortie

- stdout : sortie `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Avec tampon ; vidé sur chaque chemin de sortie sauf
  `abort`.
- stderr : le rapport d'exception non capturée, la sortie `standard_error`,
  les échecs du runtime et les rapports d'erreur des autres processus qui
  plantent ([processus](processes.md#exits)).
- Le rapport est une ligne `uncaught exception <class>: <reason in ~w form>`,
  suivie plus tard des cadres de pile (step 15). Son texte exact n'est pas une
  interface stable ; les tests le comparent par motif.

## Objet de démarrage

Compiler avec un point d'entrée explicite (`--entry` ou `entry` du manifeste)
ajoute un module de démarrage après les modules du lot. Avec `--emit`, il est
publié sous le nom `clausev1_start.{obj,o,ll,bc}` à côté des artefacts des
modules (le nom ne peut pas entrer en collision avec un artefact de module).
Il contient un `abi::v1::StartupDescriptor` constant
([startup.hpp](../abi/include/clause/abi/startup.hpp)) : révision de l'ABI,
largeur de terme, chaque descripteur de module dans l'ordre des sources, les
noms du module et de la fonction d'entrée et un indicateur escript. Son
`int main(int, char **)` appelle `CLAUSE_main_v1` du runtime, qui :

1. Vérifie la révision de l'ABI et la largeur du descripteur de démarrage et
   de chaque descripteur de module avant tout enregistrement ; une
   incompatibilité sort avec le code 70.
2. Démarre le runtime et enregistre tous les modules ; tout échec s'arrête
   avant le point d'entrée et abandonne le runtime (code de sortie 70), donc
   aucun code Erlang ne s'exécute sur un lot partiel.
3. Crée le processus d'entrée, construit argv et met en file l'appel de
   `M:F/1` comme processus principal, puis l'exécute, ainsi que chaque
   processus qu'il crée, sur l'exécuteur coopératif ([processus](processes.md))
   jusqu'à sa fin.
4. Convertit le résultat en code de sortie ci-dessus, en affichant les
   rapports après le vidage de stdout, puis libère chaque processus et arrête
   le runtime sur chaque chemin (sauf `halt(abort)`).

`clau -o` lie lui-même ces objets ([édition de liens](#linking)). Édition de
liens manuelle (la [recette du harnais natif](compile.md#run-the-compiled-module-example)
sans source de harnais) :

```powershell
& $tool --emit obj --entry app --artifact-dir build/app app.erl helper.erl
clang-cl /MT build/app/*.obj build/debug/lib/clause_runtime.lib /Fe:app.exe
```

Toute édition de liens compatible Clang des objets avec
`Clause::generated_program` fonctionne de la même façon (voir
`tests/compiler/linking/startup.cmake`).

## Édition de liens

`clau [-O0|-O2|-Os] -o PATH a.erl b.erl ...` (ou
`--project FILE [--target T] -o PATH` pour une cible sélectionnée) compile le
lot en mémoire, ajoute l'objet de démarrage pour le
[point d'entrée](#entry-selection) et lie un exécutable :

```sh
clau -O2 -o build/demo examples/compile/answer.erl examples/compile/client.erl
./build/demo          # build/demo.exe on Windows
```

`-Os` place en outre chaque fonction et objet de données, générés ou du
runtime, dans sa propre section et lie avec `--gc-sections` (ELF),
`-dead_strip` (Mach-O) ou `/OPT:REF /OPT:ICF` (MSVC), de sorte que le code
qu'aucun chemin depuis le point d'entrée n'atteint est supprimé.

- `PATH` est relatif au répertoire d'invocation. Pour les cibles Windows,
  `.exe` est ajouté lorsque le nom de fichier n'a pas d'extension. Son
  répertoire doit exister.
- Éditeur de liens : `--linker PATH` (un chemin ou un nom de programme), sinon
  `clang++` ou `clang` depuis `PATH`, puis (Windows) `%ProgramFiles%/LLVM/bin`.
  Il est exécuté sous la forme
  `<clang> --driver-mode=g++ --target=<triple> -o <staged> <objects> <runtime>`,
  de sorte que Clang choisit l'éditeur de liens de la plateforme et les
  bibliothèques d'exécution C/C++ (sous Windows, il localise lui-même MSVC et
  le SDK ; aucun shell de développement n'est nécessaire).
- Runtime : `--runtime-library PATH`, sinon l'archive `clause_runtime` du
  build qui a produit `clau` (chemin enregistré relativement à l'exécutable,
  par exemple `bin/../lib/clause_runtime.lib`). Chaque objet natif de
  l'archive doit correspondre à l'architecture et au format d'objet de la
  cible ; `--target-triple` pour une autre cible nécessite donc un runtime
  compilé pour celle-ci.
- Les objets et l'exécutable sont préparés dans un répertoire privé
  `.clause-link-*` à côté de la sortie, qui est supprimé ensuite. La sortie
  n'est remplacée qu'après une édition de liens réussie, donc chaque échec
  laisse un fichier existant inchangé. La sortie ne doit pas être un
  répertoire ni un alias d'une entrée.
- Les avertissements de l'éditeur de liens sont transmis à stderr ;
  `--linker` et `--runtime-library` exigent `--output` ou un build de projet
  avec édition de liens.
- Les builds de projet sans `-o` lient chaque cible sélectionnée qui a
  `output` ou `entry` vers la sortie de son manifeste, en créant les
  répertoires manquants, et ne remplacent les sorties qu'une fois toutes les
  cibles sélectionnées liées ([projets](projects.md#executables)).

| Échec (code de sortie 1) | Diagnostic |
| --- | --- |
| Pas de Clang | `cannot find clang++ or clang on PATH; install LLVM/Clang or pass --linker` / `linker not found: X` |
| Pas de runtime | `runtime library not found: P; build the clause_runtime target or pass --runtime-library` |
| Pas une archive | `runtime library is not a static library: P: ...` |
| Mauvaise cible | `runtime library P contains x86_64 coff objects, but the executable targets T; ...` |
| Erreur d'édition de liens | `linking O failed: <clang> exited with status N:` suivi de la sortie de l'éditeur de liens (64 Kio au plus) |
| Destination incorrecte | `output directory does not exist: D`, `artifact destination is not a regular file: O`, `artifact destination aliases an input: O` |

## Escripts

Un fichier source dont la première ligne commence par `#!` est compilé comme
un escript, dans n'importe quel mode et quel que soit le nom du fichier
(entrées positionnelles ou fichiers `.erl` de projet). Les règles suivent
`escript` d'OTP 29 pour les scripts sources :

- La ligne `#!` est ignorée. Un commentaire optionnel en ligne 2 et une ligne
  d'émulateur `%%!` (ligne 2, ou ligne 3 après le commentaire) sont des
  commentaires ; les arguments `%%!` ne peuvent pas s'appliquer au code
  compilé et produisent un avertissement.
- Si la première forme n'est pas `-module(...)`, le module est
  `<file name with '.' replaced by '_'>__escript` (`?MODULE` compris). OTP
  ajoute un suffixe d'horodatage/unique ; Clause garde un nom déterministe. La
  déclaration synthétisée occupe la ligne 1, donc les numéros de ligne
  suivants sont inchangés.
- `main/1` est obligatoire (`escript does not define main/1`) et
  implicitement exportée ; les autres fonctions suivent les règles d'export
  normales.
- `-mode(compile | interpret | debug | native)` est accepté et ignoré ; les
  autres valeurs sont des erreurs. En dehors des escripts, `-mode` reste non
  pris en charge.
- Point d'entrée : sans `--entry`, l'unique escript du lot est le point
  d'entrée (il l'emporte sur les modules exportant `main/1`) ; plusieurs
  escripts sont ambigus.
- Code de sortie comme `escript` d'OTP : une exception qui s'échappe du point
  d'entrée de l'escript sort avec 127 et
  `escript: exception <class>: <reason>` sur stderr ; les autres lignes du
  tableau des codes de sortie s'appliquent sans changement.
- Les fichiers sans `#!` sont des modules ordinaires. (`escript file.erl`
  d'OTP sauterait leur première ligne ; Clause ne le fait pas.) Les escripts
  beam précompilés et les escripts archives ne sont pas pris en charge.

## Comparaison avec OTP

Les goldens des [fixtures de programmes](../tests/fixtures/programs/README.md)
exécutent le point d'entrée sous OTP avec les mêmes règles
([oracle](../tests/compiler/programs/oracle.escript)) ; le même oracle génère
les [cas golden d'exécutables](../tests/fixtures/executables/README.md) que
l'exécuteur de bout en bout lie et exécute sous chaque politique. Différences
avec `escript` pour les modules ordinaires : les exceptions non capturées
sortent avec 1 au lieu de 127, et `main/1` doit être exportée. Les sources
escript gardent les règles d'OTP (voir ci-dessus).
