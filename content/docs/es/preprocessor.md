---
source: docs/preprocessor.md
sourceCommit: 06042fa
sourceSha256: 08b6bf1b734adf5fc6f8aef3972fd56c8f9d20c1a688610c989862794900cd67
translatedAt: 2026-10-09
---
# Preprocesador

Reimplementación nativa en C++ de `epp` de OTP para el código fuente fijado de
`maint-29`. Boost.Parser se encarga de las reglas de caracteres; los metadatos
compartidos del compilador proporcionan la precedencia de operadores. Los tokens
expandidos nunca se vuelven a convertir en texto fuente.

`PreprocessorSession` devuelve las formas expandidas (incluidos los atributos
`-file` implícitos), diagnósticos estructurados e instantáneas inmutables de
funcionalidades por forma; `features()` expone el estado final de la sesión para
el analizador sintáctico. Es una interfaz interna, no un formato de etapa
público. `DirectiveReader` es la API anterior, solo sintáctica.

## Comportamiento soportado

- Macros de objeto y sobrecargadas por aridad, sustitución en bruto, argumentos
  de bloque/fun anidados, conversión a cadena con la grafía canónica de tokens
  de OTP, redefinición, eliminación de definiciones y diagnósticos de ciclos de
  dependencia.
- Anidamiento de condicionales con efectos y errores omitidos, diagnósticos de
  fin de archivo.
- `-include`/`-include_lib`, cabeceras de ruta con variables de entorno,
  recursión protegida.
- `?MODULE`, `?BASE_MODULE` (y las formas `_STRING`), `?FILE`, `?LINE`,
  `?FUNCTION_NAME`/`?FUNCTION_ARITY`, `?FEATURE_AVAILABLE`/`?FEATURE_ENABLED`,
  `?OTP_RELEASE` (29) y `?MACHINE` (`'BEAM'`, solo por compatibilidad de código
  fuente).
- Evaluación de guards en `-if`/`-elif` con enteros arbitrarios y el catálogo de
  BIF de guard de OTP; no se ejecutan llamadas arbitrarias.
- Funcionalidades de OTP 29.1: `maybe_expr` (activada por defecto, controla
  `maybe`/`else`) y `compr_assign` (experimental, desactivada). Un `all`
  inicial selecciona ambas; `-feature(all, ...)` en el código fuente no es
  válido, como en epp. Otros nombres son errores.

## Políticas de compatibilidad

- Búsqueda de includes: directorio del archivo actual, directorio de trabajo y
  después las rutas de include en el orden de la API. La CLI invierte los `-I`
  repetidos para coincidir con `erlc`. Las rutas absolutas evitan la búsqueda.
  `include_lib` prueba las rutas ordinarias y después los directorios de
  aplicación proporcionados explícitamente; no hay servidor de código ni
  deducción de versiones.
- Las cabeceras de ruta `$VAR` usan un resolutor inyectado; las variables no
  definidas se mantienen literales. Los operandos de include no se expanden como
  macros. Los archivos se decodifican como UTF-8 o como Latin-1 declarado; se
  aplican las reglas de rutas del anfitrión independientemente de la CPU de
  destino.
- Los includes comparten el estado de macros/funcionalidades/módulo; cada
  archivo tiene su propia pila de condicionales y su correspondencia de archivo
  lógico.
- Las condiciones validan todas las ramas antes de la evaluación en
  cortocircuito. La sintaxis inválida es un error; las variables no vinculadas,
  los resultados no booleanos y las excepciones de evaluación seleccionan false.
  El acceso a campos/índices de records en condiciones falla; un acceso a record
  no seleccionado por el cortocircuito es válido.
- La construcción de records en una condición recibe un diagnóstico controlado
  (`record construction requires record expansion`); epp de OTP 29.1 falla en
  ese caso.
- Los valores iniciales de `-D` son términos literales normalizados a tokens,
  incluidos binaries y funs externos que `erl_parse:tokens/1` no puede
  representar.
- `self()` es un pid sintético estable y `node()` es `nonode@nohost`.
- Un LF justo después del punto final de un include hace avanzar la línea
  `-file` devuelta; el espacio, los comentarios y CRLF siguen el `scan_dot` de
  un carácter de OTP.

## Límites y diagnósticos

Valores por defecto (configurables mediante `PreprocessorLimits`): 256 niveles
de expansión y 1.000.000 de tokens producidos por forma, profundidad de include
64, anidamiento de expresiones 256, más límites fijos de 4.194.240 bits para
enteros (el límite de OTP en anfitriones de 64 bits) y 1.000.000 de bits para
valores bitstring. El agotamiento es un diagnóstico de recursos, nunca una
condición falsa silenciosa.

Los diagnósticos incluyen una categoría estable, la gravedad, los tramos
físicos, coordenadas lógicas opcionales y los tramos de macros/includes
relacionados. Las advertencias no provocan fallo; los errores retienen el fallo
mientras la recuperación continúa en el siguiente límite de forma.

## Pruebas

Los goldens de tokens (`semantic/*.erl.tokens`) registran los tipos de token de
epp, los valores decodificados (flotantes como bits binary64) y el orden de los
diagnósticos; la redacción no tiene por qué coincidir con la de OTP. Los
fragmentos locales `semantic/headers/*.hrl` sustituyen a las cabeceras de OTP
que antes se copiaban. `preprocessor_workflow` cubre árboles de include reales,
el orden de las opciones, el entorno, Latin-1 y casos de condiciones a través
de la CLI.
