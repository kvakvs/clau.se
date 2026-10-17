---
source: docs/executables.md
sourceCommit: a8c3f8f6
sourceSha256: 70d36ba8e8c6b7bf8d1497635905c412b3fd8db8a36ef4ee8de8c1ee6f06f6ae
translatedAt: 2026-10-17
---
# Exécutables

Contrat des programmes construits par `clau -o` ou par un build de projet. Les
entrées positionnelles, ou exactement une cible de projet sélectionnée, sont
liées dans le chemin `-o` ; un build de projet lie chaque cible exécutable
sélectionnée à son `output` du manifeste
([édition de liens](#linking), [projets](projects.md#executables)).

## Choix du point d'entrée

Le point d'entrée est une fonction exportée d'arité 1 qui reçoit la liste des
arguments. Une `FUNCTION` sélectionnée sans `FUNCTION/1` peut à la place être
une `FUNCTION/0` exportée : elle s'exécute sans les arguments du programme (les
options du runtime en sont tout de même retirées). Un suffixe `/0` ou `/1` ne
sélectionne que cette arité, donc `--entry benchmarks:run/0` exécute `run/0`
même si `run/1` est aussi exportée. Le choix par défaut (sans sélection) est
toujours `main/1`.

| Source | Écriture | Portée |
| --- | --- | --- |
| CLI | `--entry MODULE[:FUNCTION[/ARITY]]` | Lot positionnel, ou l'unique cible de projet sélectionnée |
| Manifeste | `entry = "MODULE[:FUNCTION[/ARITY]]"` dans une table `[[targets]]` | Cette cible |
| Par défaut | L'unique escript, sinon l'unique module exportant `main/1` | Seulement lorsqu'un exécutable est demandé (`-o`, ou une cible de projet avec `output`) |

- `FUNCTION` vaut `main` par défaut. Les noms sont du texte d'atome sans
  guillemets : 1 à 255 scalaires Unicode, UTF-8 valide, sans caractères de
  contrôle ni `:`. Un `/DIGITS` final après `FUNCTION` est l'arité et doit
  valoir `0` ou `1` ; les autres barres obliques font partie du nom. Les autres
  écritures sont des erreurs d'utilisation (CLI, code de sortie 2) ou des
  erreurs de manifeste (code de sortie 1).
- Le manifeste entier est décodé, donc un `entry` mal formé échoue même dans
  les cibles non sélectionnées ([manifeste](projects.md)).
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
| Ni `F/1` ni `F/0` | `<file>:<line>:<col>: entry function M:F/1 is not defined` à la déclaration du module |
| `F/A` explicite absente | `... entry function M:F/A is not defined; found F/N` à une définition de même nom, sinon à la déclaration du module |
| Seulement d'autres arités | `... is not defined; found F/N, but the entry takes the argument list (FUNCTION/1) or nothing (FUNCTION/0)` à cette définition |
| `F/1` (sinon `F/0`) non exportée | `<file>:<line>:<col>: entry function M:F/A is not exported` à la définition |
| Pas de sélection, aucun export `main/1` | `no entry point: no module exports main/1; choose the entry with --entry MODULE[:FUNCTION[/ARITY]] (an exported FUNCTION/1, or FUNCTION/0 run without the program arguments; FUNCTION defaults to main, ARITY to 1, else 0)` |
| Pas de sélection, plusieurs | `ambiguous entry point: main/1 is exported by a, b; choose the entry with ...` (même indication) |

Pour les cibles de projet, l'indication nomme aussi la clé du manifeste :
`... --entry
MODULE[:FUNCTION[/ARITY]] or with entry = "MODULE[:FUNCTION[/ARITY]]" in this
target's [[targets]] table of the project manifest ...`, par exemple :

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]
entry = "app:start"   # calls app:start/1 (or app:start/0); "app:start/0" calls app:start/0; plain "app" calls app:main/1
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
| `--min-heap-size WORDS` | `min_heap_size` par défaut de chaque processus, au moins 1, arrondi à une taille de tas supérieure, comme `+hms` d'OTP ; au plus `--max-heap` ; 233 par défaut ([dimensionnement](runtime-heap.md#sizing-and-budget)) |
| `--max-memory BYTES` | Plafond de la mémoire de l'ensemble des processus (tas, binaries hors tas, piles) ; non plafonné par défaut |
| `--schedulers N` | Workers de l'ordonnanceur exécutant les processus, de 1 à 1 024 ; un par processeur logique par défaut, comme `+S` d'OTP ([workers](processes.md#workers)) |
| `--profile FILE` | Écrit dans `FILE`, à la fin du programme, un rapport des entrées et du temps propre par fonction et par processus ([profilage](profiling.md)) ; désactivé par défaut |
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
OTP. `halt/2` n'est pas disponible. `halt(N)` garde les 31 bits de poids
faible de tout entier non négatif, comme le fait OTP. Un slogan est une liste
propre d'au plus 1 023 points de code Unicode. Un halt déroule le point
d'entrée à travers le canal d'erreur vérifié comme une erreur, il n'arrête
donc le programme qu'après le nettoyage généré.

## Flux de sortie

- stdout : sortie `standard_io` (`io:format/1,2`, `io:put_chars/1`,
  `erlang:display/1`). Avec tampon ; vidé sur chaque chemin de sortie sauf
  `abort`.
- stderr : le rapport d'exception non capturée, la sortie `standard_error`,
  les échecs du runtime et les rapports d'erreur des autres processus qui
  plantent ([processus](processes.md#exits)).
- Le rapport est une ligne `uncaught exception <class>: <reason in ~w form>`,
  sans cadres de pile. Son texte exact n'est pas une interface stable ; les
  tests le comparent par motif.

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
   processus qu'il crée, sur les workers de l'ordonnanceur
   ([processus](processes.md)) jusqu'à sa fin.
4. Convertit le résultat en code de sortie ci-dessus, en affichant les
   rapports après le vidage de stdout, puis libère chaque processus et arrête
   le runtime sur chaque chemin (sauf `halt(abort)`).

`clau -o` lie lui-même ces objets ([édition de liens](#linking)). Édition de
liens manuelle (la
[recette du harnais natif](compile.md#run-the-compiled-module-example) sans
source de harnais) :

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

`--lto` compile les modules et le module de démarrage en bitcode LLVM au lieu
d'objets et lie avec `-flto -fuse-ld=lld`, de sorte que LLD optimise le code
généré du programme comme une seule unité face à l'archive native du runtime.
Les descripteurs de modules et de démarrage, les entrées exportées et `main`
restent référencés et subsistent ; les programmes se comportent comme sans
cette option. Seul LLD lit le bitcode de ce compilateur, donc `--lto` est
accepté pour les cibles Windows MSVC et ELF ; les autres échouent avant
l'édition de liens avec
`--lto is not supported for target <triple>: it needs LLD`. `--lto` exige une
sortie exécutable (`-o` ou un build de projet qui lie). Le Clang/LLD installé
doit être de la même version de LLVM que `clau` (23.1).

### Vivacité des exports

Un exécutable laisse de côté les exports qu'il ne peut pas atteindre, de sorte
que l'élimination du code mort de `-Os` et `--lto` suppriment le code de
bibliothèque que le programme n'appelle jamais. Juste après la résolution des
appels, avant l'inférence de types, une analyse du lot entier part de la
fonction d'entrée et marque comme vivant tout ce qu'une fonction vivante
appelle directement (y compris via `-import` et les auto-imports d'OTP), chaque
`fun F/A` et `fun M:F/A` littérale, et les cibles littérales de `apply/3`,
`spawn/3`, `spawn_link/3`, `spawn_monitor/3`, `spawn_opt/4,5`,
`spawn_request/3,5`, `hibernate/3` et `make_fun/3` (toutes les arités de `M:F`
lorsque la liste d'arguments n'est pas littérale), ainsi que `file:write/2`
dès que `io:format/3`, `io:fwrite/3`, `io:put_chars/2` ou `io:nl/1` est vivant
(leurs builtins écrivent par son intermédiaire vers un périphérique de
processus). Elle reste conservatrice :

- un module dont l'atome de nom est utilisé comme valeur n'importe où dans le
  code vivant (passé, stocké, envoyé, `?MODULE`, étiquette de record,
  `M:F(...)` avec une fonction déterminée à l'exécution, `fun M:F/A` avec une
  partie déterminée à l'exécution) garde tous ses exports, ce qui garde aussi
  les callbacks des modules de behaviour démarrés par leur nom ;
- dès que le code vivant contient à la fois un appel avec un module déterminé
  à l'exécution (`M:F(...)`, `apply/3` ou un spawn avec un module variable,
  `fun M:F/A` avec un module variable, `binary_to_term/1,2`) et un builtin
  produisant des atomes (`list_to_atom/1`, `list_to_existing_atom/1`,
  `binary_to_atom/1,2`, `binary_to_existing_atom/1,2`, `binary_to_term/1,2`,
  `fun_info/1,2`, `fun_info_mfa/1`, `process_info/1,2`, `loaded/0`,
  `pre_loaded/0`), tous les exports de tous les modules restent.

Une fonction qu'aucun code vivant n'atteint n'obtient aucun code. Un export
laissé de côté garde son nom dans la table d'exports du module, sans code, de
sorte que `function_exported/3` et `module_info(exports)` répondent comme s'il
était exporté, tandis qu'un appel dynamique qui l'atteint lève `undef`
([différences](differences.md#errors-stack-traces-and-reports)). Cela ne peut
arriver que lorsqu'un nom de module vient de l'extérieur de l'analyse : une
trace de pile, un terme d'exception ou des données venant de l'extérieur du
programme. `--verbose` trace le résultat par module
(`phase=liveness detail="dropped-exports=3"`, ou
`detail="kept-all-exports reason='m' is used as a value in main:main/1"`).

Une fonction qu'aucun code vivant n'atteint n'est jamais non plus soumise à
l'inférence de types ni vérifiée contre sa `-spec` : l'inférence ne couvre que
le code vivant, ce qui est plus rapide pour les programmes qui utilisent peu de
gros modules de bibliothèque et ne peut que restreindre les faits des fonctions
vivantes, puisque les appelants inaccessibles ne joignent plus leurs
arguments. Une spécification contredite uniquement dans du code inaccessible
est donc signalée pour les artefacts `--emit` mais pas pour l'exécutable.

`--keep-exports` (ou l'option de projet `keep_exports = true`) garde chaque
export appelable. L'analyse s'applique aux exécutables (`-o` ou un build de
projet qui lie) et aux inspections d'IR et d'assembleur dotées d'un point
d'entrée (`--entry` ou l'`entry` du manifeste de la cible), qui montrent alors
le code de l'exécutable ; les artefacts `--emit`, destinés à d'autres
programmes, gardent chaque export.

`-g` garde les tables de lignes Erlang pour les débogueurs : dans l'exécutable
(ELF), ou dans un `<name>.pdb` publié à côté (cibles MSVC)
([débogage](debugging.md)).

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
  `.clause-link-*` à côté de la sortie, qui est supprimé ensuite ; il reste
  là, et non dans le [répertoire de build](projects.md#build-directory), car
  le renommage final ne doit pas traverser de volumes. La sortie n'est
  remplacée qu'après une édition de liens réussie, donc chaque échec laisse un
  fichier existant inchangé. La sortie ne doit pas être un répertoire ni un
  alias d'une entrée.
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
