---
source: docs/io.md
sourceCommit: 6ed3851c
sourceSha256: 66dc714b12c1c9b117cfcabd5ac63dc68c134dc7a995c6548ba5de931204f6c2
translatedAt: 2026-10-15
---
# Salida por consola (`io`)

`io:format/1,2` e `io:put_chars/1` escriben en
la salida estándar. Son builtins del runtime del módulo `io` en el catálogo del
puente ([builtins](builtins.md)); el runtime implementa en C++ las reglas de
`io_lib_format` e `io_lib_pretty` de OTP
([io_format.cpp](../runtime/src/builtins/io_format.cpp),
[io_pretty.cpp](../runtime/src/builtins/io_pretty.cpp)).

## Llamadas

- `io:format(Format)` equivale a `io:format(Format, [])`. Ambas devuelven `ok`.
  `io:fwrite/1,2,3` son lo mismo que `io:format/1,2,3`; `io:nl/0,1` escriben un
  salto de línea.
- Dispositivos de `io:format/3`, `io:fwrite/3`, `io:put_chars/2`
  e `io:nl/1`: `standard_io` y `user` son la salida estándar,
  `standard_error` es la salida de error estándar (antes se vacía la salida
  estándar, de modo que ambas conservan su orden). Un pid, o un átomo
  registrado para uno, es un servidor de E/S: el texto se le envía como UTF-8
  mediante `file:write/2` (un archivo abierto del módulo `file` de Clause), y
  la llamada devuelve lo que este devuelva. Un átomo no registrado es `badarg`,
  un pid muerto `error:terminated`, el propio llamante `error:calling_self` y
  cualquier otro término `function_clause`, como en OTP.
- `io:put_chars(Chardata)` escribe chardata: caracteres Unicode, binaries
  UTF-8 y listas anidadas que terminan en `[]` o en un binary. Cualquier otra
  cosa (un átomo, un sustituto (surrogate), UTF-8 no válido, un bitstring)
  lanza `badarg`.
- El texto se construye completo y luego se escribe como UTF-8, como hace el
  dispositivo de salida estándar de OTP en modo `-noshell` (codificación
  `unicode`). Un error no escribe nada. Una escritura rechazada es el fallo del
  runtime `output_failure` (salida 70).
- Las llamadas cualificadas, `fun io:format/2`, `apply(io, format, Args)` y
  `M:format(...)` llegan todas a los builtins. Las demás funciones de `io`
  conservan el diagnóstico `unknown module io`. Un módulo del lote llamado `io`
  no sustituye a los builtins (el `io` de OTP es sticky).

## Formatos

- `Format` es un átomo (sus caracteres), un binary (sus bytes como caracteres
  Latin-1) o una lista. Un elemento de la lista que no es un carácter es
  chardata que se escribe tal cual, sin secuencias de control, y avanza la
  columna en uno (una peculiaridad de OTP).
- Secuencias de control `~F.P.PadModC`: ancho de campo `F` (negativo o `-`:
  alineado a la izquierda), precisión `P`, carácter de relleno, `*` que toma un
  entero (o el relleno) de los argumentos, modificadores `t` (Unicode), `l` (sin
  detección de cadenas) y `k` (maps ordenados; Clause siempre imprime los maps
  en orden de claves).
- `C` admitidos: `~w`, `~p`, `~s`, `~c`, `~b`, `~B`, `~i`, `~n`, `~~`, con las
  reglas de campo de OTP: `~s` trunca o rellena hasta `P` dentro de `F`; `~w` y
  `~b` imprimen caracteres `*` cuando el texto no cabe en `F`; `~c` repite el
  carácter; `~b`/`~B` toman la base de `P` (2..36); `~n` con `F` escribe `F`
  saltos de línea.
- Sin `t`, `~s` solo acepta caracteres Latin-1 y `~c` escribe el byte bajo de
  su entero; `~w`/`~p` escapan los caracteres de átomos fuera de Latin-1 como
  `\x{...}`. Con `t`, `~s` lee los binaries como UTF-8 (con Latin-1 como
  alternativa) y `~p` escribe `<<"..."/utf8>>` para binaries UTF-8 imprimibles.
- `badarg`: un carácter de control desconocido, argumentos que faltan o
  sobran, un argumento de tipo incorrecto, `F` menor que `P` para `~s`/`~c`,
  un `~p` o `~n` alineado a la izquierda, una base fuera de 2..36, una salida
  que no es Unicode.
- No implementados (`badarg`, véase [diferencias](differences.md#io)): `~e`,
  `~f`, `~g`, `~x`, `~X`, `~+`, `~#`, `~W`, `~P` y el modificador `K`.

## Impresión legible (`~p`)

- La longitud de línea es `F` (80 por defecto; 0 escribe una sola línea); la
  primera columna es `P`, o si no, la columna que la salida ha alcanzado en su
  línea (los tabuladores avanzan a múltiplos de 8).
- El término se convierte en la forma intermedia de OTP: cada valor con su
  longitud en una línea; las cadenas (listas planas de caracteres Latin-1
  imprimibles, el `io:printable_range()` por defecto), los binaries
  imprimibles, los átomos y los números son texto.
- Lo que cabe en el resto de la línea se escribe completo. Las listas y las
  tuplas se parten entre elementos, alineadas tras el corchete o la llave; las
  tuplas etiquetadas (`{atom, ...}`) se alinean tras la etiqueta, o se sangran
  4 (o 1) posiciones cuando eso superaría la mitad de la línea; los pares de
  maps y los campos de native records que no caben ponen el valor en la línea
  siguiente; los binaries largos se parten entre bytes.
- Los contenedores anidados a más de 256 niveles lanzan `system_limit` (la
  maquetación es recursiva sobre la pila nativa).
- El formateo se ejecuta hasta el final, por grande que sea el término
  ([porciones](builtins.md#portions)).
