---
source: docs/asn1.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: fc528bb80707fa028fab896cf045bdf94eebb64ce17aa24704db249ed19cbe6b
translatedAt: 2026-10-26
---
# Especificaciones ASN.1

Clau compila especificaciones ASN.1 (`.asn`, `.asn1` y listas de módulos
`.set.asn`) en módulos Erlang como hace `asn1ct` de OTP: `Module.erl` con
`encode/2`, `decode/2` y los valores del módulo, y `Module.hrl` con sus records
y macros. El módulo generado se incorpora al lote como cualquier otra fuente;
su codificación y decodificación se ejecutan en el motor BER, DER y PER de C++
de `clause_runtime` (sin necesidad de OpenSSL). Las especificaciones de
`public_key` de OTP se compilarán del mismo modo.

## Entradas

Las entradas posicionales que terminan en `.asn` o `.asn1` son especificaciones:

```sh
clau --asn1-option der --asn1-outdir gen Kitchen.asn main.erl -o app
clau --generate-asn1 --asn1-outdir gen Kitchen.asn   # only write gen/Kitchen.erl and gen/Kitchen.hrl
```

| Opción | Significado |
| --- | --- |
| `--asn1-option <option>` | Una opción de `asn1ct` para todas las especificaciones de la invocación; se puede repetir. Por defecto, `ber`. |
| `--asn1-outdir <dir>` | Dónde se escriben `Module.erl` y `Module.hrl` (`outdir` de asn1ct); por defecto, el directorio actual. El directorio se añade a la ruta de inclusión, por lo que funciona `-include("Module.hrl").`. |
| `--generate-asn1` | Escribe solo los módulos y las cabeceras generados; no compila nada. |
| `-I <dir>` | También se busca aquí los módulos ASN.1 importados (`i` de asn1ct), después del directorio de la propia especificación. |

Un destino de proyecto enumera las especificaciones en grupos `[[targets.asn1]]`,
cada uno compilado con sus propias opciones:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[[targets.asn1]]
sources = ["asn1/*.asn"]
options = ["per", "noobj"]
outdir = "build/gen"   # default: asn1/ in the target's build directory
```

`sources` (obligatorio) acepta archivos y patrones con comodines como las fuentes
del destino, para `.asn` y `.asn1`; un patrón sin coincidencias es un error.
Las importaciones se buscan en los directorios de las especificaciones del
grupo. Un módulo generado ya incluido entre las fuentes del destino no se añade
dos veces. `outdir` se añade a la ruta de inclusión del destino.

Un archivo `.set.asn` enumera un archivo de módulo por línea (compilación
combinada de asn1ct); cada nombre se prueba tal como está y después añadiendo
`.asn1`, `.asn` y `.py`. El módulo combinado toma el nombre del archivo del
conjunto.

## Opciones

| Opción | Efecto |
| --- | --- |
| `ber` | Reglas básicas de codificación (por defecto). |
| `der` | Reglas de codificación distinguida: `ber` con `SET`/`SET OF` ordenados, valores `DEFAULT` omitidos y comprobaciones DER. |
| `maps` | Los valores `SEQUENCE`/`SET` son maps; se omiten los componentes ausentes. |
| `undec_rest` | `decode/2` devuelve `{ok, Value, Rest}` con los bytes posteriores al valor. |
| `no_ok_wrapper` | `encode/2` y `decode/2` devuelven el propio valor y generan excepciones en caso de error. |
| `legacy_erlang_types` | Se aceptan valores `BIT STRING` y `OCTET STRING` como listas, `{Unused, Binary}` y enteros. |
| `legacy_bit_string`, `compact_bit_string` | Formas antiguas de `BIT STRING` (listas de 0 y 1, `{Unused, Binary}`); implican `legacy_erlang_types`. |
| `noobj`, `asn1config`, `verbose`, `warnings`, `errors`, `deterministic` | Se aceptan y no cambian nada. |
| `per`, `uper` | Reglas de codificación compacta, alineadas y sin alinear ([PER](#per)). |
| `no_final_padding` | Con `uper`: `encode/2` devuelve los bits sin relleno hasta un octeto (un bitstring). |
| `jer` | Se rechaza: `jer (JSON encoding rules) is not supported`. |

Cualquier otra opción produce `unknown ASN.1 option 'Name'` (salida 2).

## Cobertura

Las construcciones de X.680/X.681/X.682/X.683 que usan los módulos PKIX y PKCS
de OTP y las especificaciones de emqx:

- Tipos: `BOOLEAN`, `INTEGER` con números con nombre, `ENUMERATED` con
  extensiones, `NULL`, `BIT STRING` con bits con nombre, `OCTET STRING`,
  `OBJECT IDENTIFIER`, `RELATIVE-OID`, `REAL`, las cadenas de caracteres
  restringidas, `UTCTime`, `GeneralizedTime`, `ObjectDescriptor`, `SEQUENCE`,
  `SET`, `SEQUENCE OF`, `SET OF`, `CHOICE`, `ANY`, `ANY DEFINED BY`,
  `INSTANCE OF`, tipos abiertos, tipos de selección (`name < Type`).
- Etiquetado: etiquetas explícitas, implícitas y automáticas, valores
  predeterminados del módulo, `COMPONENTS OF`, marcadores de extensión, grupos
  de adiciones de extensión y componentes posteriores a las extensiones.
- Restricciones: valores individuales, intervalos, `SIZE`, `FROM`, uniones e
  intersecciones (evaluadas para los límites que comprueba BER y codifica PER);
  `WITH COMPONENT(S)`, `CONTAINING`, `PATTERN`, `CONSTRAINED BY` e `INCLUDES`
  se analizan y no se comprueban, como en asn1ct.
- Objetos de información: clases con `WITH SYNTAX`, `TYPE-IDENTIFIER`,
  `ABSTRACT-SYNTAX`, objetos, conjuntos de objetos (uniones, conjuntos
  extensibles, conjuntos a partir de otros conjuntos y campos de objetos),
  restricciones de tabla simples y de relación entre componentes
  (`{Set}{@a.b}`, decodificadas y codificadas mediante el tipo del objeto).
- Tipos, objetos y conjuntos de objetos parametrizados; importaciones entre
  módulos; valores `DEFAULT` de todos los tipos.

No se admiten, y cada uno produce un error en su posición: `EXTERNAL`,
`EMBEDDED PDV` y `CHARACTER STRING` (`unsupported ASN.1 type`), valores
parametrizados, objetos extraídos de conjuntos de objetos, definiciones `MACRO`
y notaciones de valores que las especificaciones de OTP no usan
(`unsupported value notation`).

## Módulos generados

`Module.erl` exporta lo mismo que el de asn1ct: `encoding_rule/0`, `maps/0`,
`bit_string_format/0`, `legacy_erlang_types/0`, `encode/2`, `decode/2`, `info/0`
y una función por asignación de valor. Los records y sus nombres siguen a
asn1ct (tipos internos nombrados por su ruta, `SEQOF`/`SETOF` para elementos
de colecciones, instancias parametrizadas), por lo que `Module.hrl` es idéntico
al de asn1ct salvo por la primera línea de comentario; los valores se imprimen
como los imprime asn1ct.

`encode/2` y `decode/2` devuelven `{ok, Value}` o `{error, {asn1, Reason}}` con
los motivos de asn1ct (`{bad_range, ...}`, `{unexpected, ...}`,
`{invalid_choice_type, ...}`, `{'Type not compatible with table constraint', ...}`,
los errores TLV de `asn1rt_nif`); la decodificación conserva la tolerancia y
peculiaridades de asn1ct (se omiten los componentes de extensión desconocidos,
`{asn1_OPENTYPE, Bytes}` y `{asn1_ExtAlt, Bytes}` para valores desconocidos de
tipos abiertos y `CHOICE`, `{asn1_enum, N}`).

Las funciones generadas llaman a `clause_asn1:encode/3` y
`clause_asn1:decode/3` con un término de esquema:
`{asn1_schema, 1, Rule, Flags, #{Type => Node}, Nodes}`. Cada nodo es
`{Kind, Tags, Fields...}` (clases en el orden de `NodeKind` del compilador,
etiquetas como `Number bsl 2 bor Class`; límites `{Lower, Upper, Extensible}`
con los valores raíz de una lista extensible de valores individuales como
cuarto elemento, cadenas restringidas con su alfabeto PER, componentes con su
indicador de grupo de adición); el formato es interno de Clause y puede cambiar.

## PER

`per` (alineado) y `uper` (sin alinear) siguen el código que genera asn1ct y
`asn1rtt_per`/`asn1rtt_uper`/`asn1rtt_per_common`, byte por byte (X.691 tal como
lo implementa OTP):

- Restricciones visibles para PER tal como las calcula `effective_constraint/2`
  de asn1ct: intervalos de valores (enteros restringidos, semirrestringidos y
  sin restricciones), límites de `SIZE` inferiores a 64K (los superiores se
  codifican como longitudes sin restricciones), raíces extensibles (una lista
  extensible de valores individuales codifica solo esos valores como valores
  raíz) y alfabetos `FROM` de las cadenas con multiplicador conocido
  (`NumericString`, `PrintableString`, `VisibleString`, `IA5String`,
  `BMPString`, `UniversalString`, `UTCTime`, `GeneralizedTime`), cuyos
  caracteres son índices cuando sus códigos no caben en el ancho de carácter.
- Los componentes raíz de `SET` se codifican en orden de etiqueta, las
  alternativas de `CHOICE` en orden textual (como asn1ct, en lugar del orden
  canónico de X.691), los elementos de `ENUMERATED` por valor; las adiciones de
  extensión son tipos abiertos, un grupo de adición es una `SEQUENCE` de sus
  componentes; fragmentos por encima de 16K unidades (octetos, bits, caracteres,
  elementos).
- Se conservan las peculiaridades de asn1ct: en un record, las adiciones de
  extensión posteriores a un grupo de varios componentes se leen de posiciones
  incorrectas (desplazadas por la longitud del grupo menos uno); los elementos
  de tipo abierto de una `SEQUENCE OF` ignoran su restricción de tabla; eliminar
  los bits cero finales de una cola de `BIT STRING` con nombres compuesta solo
  por ceros falla con `badmatch`; una entrada mal formada falla con el
  `badmatch`, `case_clause` o `function_clause` del código generado sobre los
  bits restantes.

## Diagnósticos

Los errores incluyen la ruta, línea y columna de la especificación, y detienen
la invocación (salida 1) antes de la compilación de Erlang:

```text
syntax.asn:4:1: error: expected '::=' near 'END'
undefined.asn:3:22: error: undefined reference Missing
import.asn:4:9: error: cannot find ASN.1 module Absent
empty.asn:1:1: error: no ASN.1 module found
```

Las diferencias respecto a asn1ct se enumeran en
[differences.md](differences.md#asn1).
