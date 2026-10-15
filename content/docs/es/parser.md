---
source: docs/parser.md
sourceCommit: 6ed3851c
sourceSha256: 620d520afbba7b5b1d96dcbf60cf55b23bfb6a23153437fd25ee82c424a2afc1
translatedAt: 2026-10-15
---
# Analizador sintáctico

Analiza la gramática completa de OTP 29 a partir de tokens preprocesados y
produce un AST propietario de sus datos.

## CLI

`clau --parse-check -I include -DDEBUG module.erl` preprocesa y analiza,
escribe los diagnósticos en stderr y nada en stdout en caso de éxito. Se aplican
todas las opciones de preprocesado. `--print-pp` y `--print-ast` imprimen el
código fuente expandido o el árbol de la misma pasada. Las opciones de ruta de
salida son errores de uso en los modos de comprobación/impresión. Las entradas
están aisladas; cualquier fallo mantiene un código de salida de fallo. `--`
permite rutas que empiezan por `-`. Códigos de salida: 0 éxito (se permiten
advertencias), 1 fallo de código fuente/sistema de archivos, 2 error de uso.

El texto del AST usa objetos entre paréntesis, sangría de dos espacios y campos
`name=value`:

```lisp
(Function name=i arity=0 clauses=1
  clause[0]=(FunctionClause arguments=0 guard=none body=1
    body[0]=(IntegerLiteral value=42)
  )
)
```

El impresor es iterativo; a partir de 64 niveles limita la sangría y añade
etiquetas `[depth=N]`. El texto del AST es solo para inspección; no hay lector.

## API

Cabecera `clause/compiler/parser.hpp`, objetivo de CMake `clause_frontend`:

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

- `ast::Module` solo admite movimiento y posee las formas, las arenas planas de
  nodos, los búferes de código fuente y las instantáneas de funcionalidades. Los
  movimientos conservan los identificadores.
- Identificadores distintos `ExprId`, `PatternSyntaxId`, `TermId`, `TypeId`,
  `FormId`; las comprobaciones de propietario/generación rechazan los
  identificadores ajenos u obsoletos.
- `module.visit(id, visitor)` despacha sobre una variante cerrada. Los árboles
  profundos se recorren con pilas explícitas.
- `NodeSource` es un rango de tokens expandidos más un ancla; conviene usar
  `extent()`/`anchor()` en lugar de suponer una grafía física contigua.
- Streaming: `ParserSession::consume(event)`,
  `parse_form(tokens, eof, features)` y después
  `std::move(session).finish(features)`. Siempre hay que comprobar
  `ParseResult::failed`; las formas recuperadas no implican éxito.
- `tests/compiler/parser/consumer.cpp` es un ejemplo compilado de propiedad.

Cobertura de la gramática: atributos y términos literales, records de
tupla/nativos, declaraciones type/opaque/nominal, specs/callbacks, todas las
expresiones, patrones, guards, cláusulas, binaries, fun/try/maybe/receive, y
comprehensions de listas/maps/binaries con los generadores estrictos y los
grupos zip de OTP 29. Se excluyen las anotaciones de prueba SSA. El éxito
sintáctico no implica nada sobre lint, vínculos ni generación de código.

## Recuperación y límites

Las formas fallidas revierten las arenas y los orígenes; las formas posteriores
siguen disponibles, pero el fallo es persistente. Los diagnósticos incluyen la
categoría, las coordenadas lógicas, la traza de macros/includes, el delimitador
de apertura sin cerrar más cercano y los terminales de `Diagnostic::expected`.

Valores por defecto: 1.000.000 de tokens/forma, 4.000.000 de tokens/módulo,
1.000.000 de nodos, 1.000 diagnósticos (+1 mensaje de agotamiento),
anidamiento 256 (techo absoluto de la API 512), 16.000.000 de unidades de
trabajo. El impresor del árbol tiene por defecto 4.000.000 de objetos visitados
y lanza `std::length_error` al agotarse. Son límites contables, no garantías de
tiempo real. El agotamiento de recursos detiene la sesión.

## Pruebas de compatibilidad

- Las 344 producciones ordinarias de `erl_parse.yrl` tienen fixtures testigo
  medidos; se excluyen 79 producciones de anotación SSA
  (`tests/fixtures/parser/phase6/`).
- 43 fixtures positivos se comparan estructuralmente con OTP; 183 fixtures de
  rechazo, tres fixtures de excepciones del constructor de OTP
  (`record_helper`, `record_extra`, `any_first`) y `bad.erl` cubren los
  errores.
- Corpus de código real (auditoría opcional): `lists`, `maps`, `sets`,
  `erl_scan` de stdlib; `beam_ssa`, `beam_asm` y cuatro cabeceras de compiler,
  con asignaciones `-I`/`--app-dir`, `maybe_expr` activado, `compr_assign`
  desactivado y `-DCOMPILER_VSN='"parser-compatibility"'`.
- `parser_stress` (cadena de 12.000 operadores), `parser_mutations_0`..`3`
  (particiones de 900 mutaciones con semilla, semilla `0x29a016`, ejecutadas dos
  veces) y `parser_hardening` acotan el comportamiento.
