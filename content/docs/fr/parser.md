---
source: docs/parser.md
sourceCommit: a8c3f8f6
sourceSha256: 86719d7cbbba9250f7167908fc08ac6735ed50c9adf31c9d0655d626a595c815
translatedAt: 2026-10-17
---
# Analyseur syntaxique

Analyse la grammaire complète d'OTP 29 à partir des jetons prétraités vers un
AST possédé.

## CLI

`clau --parse-check -I include -DDEBUG module.erl` prétraite et analyse, en
écrivant les diagnostics sur stderr et rien sur stdout en cas de succès. Toutes
les options de prétraitement s'appliquent. `--print-pp` et `--print-ast`
affichent le source développé ou l'arbre issus de la même passe. Les options de
chemin de sortie sont des erreurs d'utilisation dans les modes de
vérification/affichage. Les entrées sont isolées ; tout échec conserve un code de
sortie d'échec. `--` permet les chemins commençant par `-`. Codes de sortie :
0 succès (avertissements permis), 1 échec de source/système de fichiers,
2 erreur d'utilisation.

Le texte de l'AST utilise des objets entre parenthèses, une indentation de deux
espaces et des champs `name=value` :

```lisp
(Function name=i arity=0 clauses=1
  clause[0]=(FunctionClause arguments=0 guard=none body=1
    body[0]=(IntegerLiteral value=42)
  )
)
```

L'afficheur est itératif ; au-delà de 64 niveaux, il plafonne l'indentation et
ajoute des étiquettes `[depth=N]`. Le texte de l'AST sert uniquement à
l'inspection ; il n'existe pas de lecteur.

## API

En-tête `clause/compiler/parser.hpp`, cible CMake `clause_frontend` :

```cpp
clause::ParseResult load(const std::filesystem::path &path) {
    clause::SourceManager sources;
    clause::PreprocessorSession pp(sources.read(path));
    return clause::parse_module(pp);
}
auto result = load("module.erl"); // Sources and session are gone; AST owns its data.
for (const auto &id : result.module.forms()) {
    const auto &origin = result.module.anchor(result.module.form(id).source);
}
```

- `ast::Module` est déplaçable uniquement (move-only) et possède les formes, les
  arènes de nœuds plates, les tampons sources et les instantanés de
  fonctionnalités. Les déplacements préservent les handles.
- Handles distincts `ExprId`, `PatternSyntaxId`, `TermId`, `TypeId`, `FormId` ;
  les vérifications de propriétaire/génération rejettent les handles étrangers
  ou périmés.
- `module.visit(id, visitor)` distribue sur un variant fermé. Parcourir les
  arbres profonds avec des piles explicites.
- `NodeSource` est une plage de jetons développés plus une ancre ; utiliser
  `extent()`/`anchor()` plutôt que de supposer une orthographe physique contiguë.
- Flux : `ParserSession::consume(event)`, `parse_form(tokens, eof, features)`,
  puis `std::move(session).finish(features)`. Toujours vérifier
  `ParseResult::failed` ; des formes récupérées n'impliquent pas un succès.
- `tests/compiler/parser/consumer.cpp` est un exemple compilé de gestion de la
  propriété.

Couverture de la grammaire : attributs et termes littéraux, records
tuples/natifs, déclarations type/opaque/nominal, specs/callbacks, toutes les
expressions, motifs, gardes, clauses, binaries, fun/try/maybe/receive, et
comprehensions de liste/map/binary avec les générateurs stricts et les groupes
zip d'OTP 29. Les annotations de test SSA sont exclues. Le succès syntaxique
n'implique rien quant au lint, aux liaisons ou à la génération de code.

## Récupération et limites

Les formes en échec annulent les arènes et les origines ; les formes suivantes
restent disponibles mais l'échec est persistant. Les diagnostics portent une
catégorie, des coordonnées logiques, une trace de macros/inclusions, l'ouvrant
non apparié le plus proche et les terminaux `Diagnostic::expected`.

Valeurs par défaut : 1 000 000 jetons/forme, 4 000 000 jetons/module,
1 000 000 nœuds, 1 000 diagnostics (+1 message d'épuisement), imbrication 256
(plafond strict de l'API 512), 16 000 000 unités de travail. L'afficheur d'arbre
est limité par défaut à 4 000 000 objets visités et lève `std::length_error` à
l'épuisement. Ce sont des limites de comptabilité, pas des garanties de temps
réel. L'épuisement des ressources arrête la session.

## Preuves de compatibilité

- Les 344 productions ordinaires de `erl_parse.yrl` ont toutes des fixtures
  témoins mesurées ; 79 productions d'annotation SSA sont exclues
  (`tests/fixtures/parser/phase6/`).
- 43 fixtures positives sont comparées structurellement avec OTP ; 183 fixtures
  de rejet, trois fixtures d'exception du constructeur d'OTP (`record_helper`,
  `record_extra`, `any_first`) et `bad.erl` couvrent les erreurs.
- Corpus de sources réelles (audit optionnel) : `lists`, `maps`, `sets`,
  `erl_scan` de stdlib ; `beam_ssa`, `beam_asm` et quatre en-têtes du
  compilateur, avec des correspondances `-I`/`--app-dir`, `maybe_expr` activé,
  `compr_assign` désactivé et `-DCOMPILER_VSN='"parser-compatibility"'`.
- `parser_stress` (chaîne de 12 000 opérateurs), `parser_mutations_0`..`3`
  (fragments de 900 mutations à graine, graine `0x29a016`, exécutés deux fois) et
  `parser_hardening` bornent le comportement.
