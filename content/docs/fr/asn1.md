---
source: docs/asn1.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: fc528bb80707fa028fab896cf045bdf94eebb64ce17aa24704db249ed19cbe6b
translatedAt: 2026-10-26
---
# Spécifications ASN.1

Clau compile les spécifications ASN.1 (`.asn`, `.asn1` et listes de modules
`.set.asn`) en modules Erlang comme `asn1ct` d’OTP : `Module.erl` avec
`encode/2`, `decode/2` et les valeurs du module, et `Module.hrl` avec ses records
et macros. Le module généré rejoint le lot comme toute autre source ; son
encodage et son décodage s’exécutent dans le moteur C++ BER, DER et PER de
`clause_runtime` (sans OpenSSL). Les spécifications de `public_key` d’OTP
seront compilées de la même manière.

## Entrées

Les entrées positionnelles se terminant par `.asn` ou `.asn1` sont des
spécifications :

```sh
clau --asn1-option der --asn1-outdir gen Kitchen.asn main.erl -o app
clau --generate-asn1 --asn1-outdir gen Kitchen.asn   # only write gen/Kitchen.erl and gen/Kitchen.hrl
```

| Option | Signification |
| --- | --- |
| `--asn1-option <option>` | Une option `asn1ct` pour toutes les spécifications de l’invocation ; répétable. Par défaut : `ber`. |
| `--asn1-outdir <dir>` | Emplacement où écrire `Module.erl` et `Module.hrl` (`outdir` d’asn1ct) ; répertoire courant par défaut. Ce répertoire rejoint le chemin d’inclusion, donc `-include("Module.hrl").` fonctionne. |
| `--generate-asn1` | Écrire uniquement les modules et en-têtes générés ; ne rien compiler. |
| `-I <dir>` | Également parcouru pour rechercher les modules ASN.1 importés (`i` d’asn1ct), après le répertoire de la spécification elle-même. |

Une cible de projet répertorie les spécifications dans des groupes
`[[targets.asn1]]`, chacun compilé avec ses propres options :

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[[targets.asn1]]
sources = ["asn1/*.asn"]
options = ["per", "noobj"]
outdir = "build/gen"   # default: asn1/ in the target's build directory
```

`sources` (obligatoire) accepte des fichiers et des motifs avec caractères
génériques comme les sources de la cible, pour `.asn` et `.asn1` ; un motif
sans correspondance est une erreur. Les imports sont recherchés dans les
répertoires des spécifications du groupe. Un module généré déjà répertorié
parmi les sources de la cible n’est pas ajouté deux fois. `outdir` rejoint le
chemin d’inclusion de la cible.

Un fichier `.set.asn` répertorie un fichier de module par ligne (compilation
fusionnée d’asn1ct) ; chaque nom est essayé tel quel, puis avec les suffixes
`.asn1`, `.asn` et `.py`. Le module fusionné prend le nom du fichier d’ensemble.

## Options

| Option | Effet |
| --- | --- |
| `ber` | Basic Encoding Rules (par défaut). |
| `der` | Distinguished Encoding Rules : `ber` avec `SET`/`SET OF` triés, valeurs `DEFAULT` omises et vérifications DER. |
| `maps` | Les valeurs `SEQUENCE`/`SET` sont des maps ; les composants absents sont omis. |
| `undec_rest` | `decode/2` renvoie `{ok, Value, Rest}` avec les octets qui suivent la valeur. |
| `no_ok_wrapper` | `encode/2` et `decode/2` renvoient la valeur elle-même et lèvent une exception en cas d’erreur. |
| `legacy_erlang_types` | Valeurs `BIT STRING` et `OCTET STRING` sous forme de listes, `{Unused, Binary}` et entiers acceptés. |
| `legacy_bit_string`, `compact_bit_string` | Anciennes formes de `BIT STRING` (listes de 0 et 1, `{Unused, Binary}`) ; impliquent `legacy_erlang_types`. |
| `noobj`, `asn1config`, `verbose`, `warnings`, `errors`, `deterministic` | Acceptées, sans effet. |
| `per`, `uper` | Packed Encoding Rules, alignées et non alignées ([PER](#per)). |
| `no_final_padding` | Avec `uper` : `encode/2` renvoie les bits sans bourrage jusqu’à un octet (un bitstring). |
| `jer` | Rejetée : `jer (JSON encoding rules) is not supported`. |

Toute autre option produit `unknown ASN.1 option 'Name'` (code de sortie 2).

## Couverture

Les constructions de X.680/X.681/X.682/X.683 utilisées par les modules PKIX et
PKCS d’OTP et les spécifications d’emqx :

- Types : `BOOLEAN`, `INTEGER` avec nombres nommés, `ENUMERATED` avec
  extensions, `NULL`, `BIT STRING` avec bits nommés, `OCTET STRING`,
  `OBJECT IDENTIFIER`, `RELATIVE-OID`, `REAL`, chaînes de caractères
  restreintes, `UTCTime`, `GeneralizedTime`, `ObjectDescriptor`, `SEQUENCE`,
  `SET`, `SEQUENCE OF`, `SET OF`, `CHOICE`, `ANY`, `ANY DEFINED BY`,
  `INSTANCE OF`, types ouverts, types de sélection (`name < Type`).
- Étiquetage : étiquettes explicites, implicites et automatiques, valeurs par
  défaut des modules, `COMPONENTS OF`, marqueurs d’extension, groupes d’ajouts
  d’extension et composants après les extensions.
- Contraintes : valeurs uniques, intervalles, `SIZE`, `FROM`, unions et
  intersections (évaluées pour les bornes que BER vérifie et que PER encode) ;
  `WITH COMPONENT(S)`, `CONTAINING`, `PATTERN`, `CONSTRAINED BY` et `INCLUDES`
  sont analysées sans être vérifiées, comme par asn1ct.
- Objets d’information : classes avec `WITH SYNTAX`, `TYPE-IDENTIFIER`,
  `ABSTRACT-SYNTAX`, objets, ensembles d’objets (unions, ensembles extensibles,
  ensembles issus d’autres ensembles et champs d’objets), contraintes de table
  simples et de relation entre composants (`{Set}{@a.b}`, décodées et encodées
  au moyen du type de l’objet).
- Types, objets et ensembles d’objets paramétrés ; imports entre modules ;
  valeurs `DEFAULT` de tous les types.

Non pris en charge, chacun produisant une erreur à sa position : `EXTERNAL`,
`EMBEDDED PDV` et `CHARACTER STRING` (`unsupported ASN.1
type`), valeurs paramétrées, objets extraits d’ensembles d’objets, définitions
`MACRO` et notations de valeurs que les spécifications d’OTP n’utilisent pas
(`unsupported value notation`).

## Modules générés

`Module.erl` exporte les mêmes fonctions que celui d’asn1ct :
`encoding_rule/0`, `maps/0`, `bit_string_format/0`, `legacy_erlang_types/0`,
`encode/2`, `decode/2`, `info/0` et une fonction par affectation de valeur.
Les records et leurs noms suivent asn1ct (types internes nommés selon leur
chemin, `SEQOF`/`SETOF` pour les éléments de collection, instances
paramétrées), donc `Module.hrl` est identique à celui d’asn1ct, hormis la
première ligne de commentaire ; les valeurs sont affichées comme par asn1ct.

`encode/2` et `decode/2` renvoient `{ok, Value}` ou `{error, {asn1, Reason}}`
avec les motifs d’asn1ct (`{bad_range, ...}`, `{unexpected, ...}`,
`{invalid_choice_type, ...}`, `{'Type not compatible with table constraint', ...}`,
les erreurs TLV d’`asn1rt_nif`) ; le décodage conserve la tolérance et les
particularités d’asn1ct (composants d’extension inconnus ignorés,
`{asn1_OPENTYPE, Bytes}` et `{asn1_ExtAlt, Bytes}` pour les valeurs de type
ouvert et de `CHOICE` inconnues, `{asn1_enum, N}`).

Les fonctions générées appellent `clause_asn1:encode/3` et
`clause_asn1:decode/3` avec un terme de schéma : `{asn1_schema, 1,
Rule, Flags, #{Type => Node}, Nodes}`. Chaque nœud est
`{Kind, Tags, Fields...}` (catégories dans l’ordre du `NodeKind` du
compilateur, étiquettes sous la forme `Number bsl 2 bor Class` ; bornes
`{Lower, Upper, Extensible}` avec les valeurs racines d’une liste extensible
de valeurs uniques comme quatrième élément, chaînes restreintes avec leur
alphabet PER, composants avec leur indicateur de groupe d’ajouts) ; le format
est interne à Clause et peut changer.

## PER

`per` (aligné) et `uper` (non aligné) suivent le code généré par asn1ct et
`asn1rtt_per`/`asn1rtt_uper`/`asn1rtt_per_common`, octet pour octet (X.691
tel qu’OTP l’implémente) :

- Contraintes visibles par PER telles que les calcule `effective_constraint/2`
  d’asn1ct : intervalles de valeurs (entiers contraints, semi-contraints et
  non contraints), bornes `SIZE` inférieures à 64K (les bornes supérieures
  sont encodées comme des longueurs non contraintes), racines extensibles
  (une liste extensible de valeurs uniques encode uniquement ces valeurs
  comme valeurs racines) et alphabets `FROM` des chaînes à multiplicateur
  connu (`NumericString`, `PrintableString`, `VisibleString`, `IA5String`,
  `BMPString`, `UniversalString`, `UTCTime`, `GeneralizedTime`), dont les
  caractères sont des indices lorsque leurs codes ne tiennent pas dans la
  largeur de caractère.
- Les composants racines de `SET` sont encodés dans l’ordre des étiquettes,
  les alternatives de `CHOICE` dans l’ordre textuel (comme asn1ct, plutôt que
  dans l’ordre canonique de X.691), les éléments d’`ENUMERATED` par valeur ;
  les ajouts d’extension sont des types ouverts, un groupe d’ajouts est une
  `SEQUENCE` de ses composants ; fragmentation au-delà de 16K unités
  (octets, bits, caractères, éléments).
- Les particularités d’asn1ct sont conservées : dans un record, les ajouts
  d’extension après un groupe de plusieurs composants sont lus aux mauvaises
  positions (décalées de la longueur du groupe moins un) ; les éléments de
  type ouvert d’un `SEQUENCE OF` ignorent leur contrainte de table ; la
  suppression des bits nuls finaux d’une fin de `BIT STRING` nommé entièrement
  nulle échoue avec `badmatch` ; une entrée mal formée échoue avec le
  `badmatch`, `case_clause` ou `function_clause` du code généré sur les bits
  restants.

## Diagnostics

Les erreurs indiquent le chemin, la ligne et la colonne de la spécification,
et arrêtent l’invocation (code de sortie 1) avant la compilation Erlang :

```text
syntax.asn:4:1: error: expected '::=' near 'END'
undefined.asn:3:22: error: undefined reference Missing
import.asn:4:9: error: cannot find ASN.1 module Absent
empty.asn:1:1: error: no ASN.1 module found
```

Les différences avec asn1ct sont répertoriées dans
[differences.md](differences.md#asn1).
