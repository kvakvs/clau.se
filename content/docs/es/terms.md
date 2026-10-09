---
source: docs/terms.md
sourceCommit: 06042fa
sourceSha256: a6c1ea20b3bdb7055c6080cff72a2a86c4cdce87eb6bd8944ffce5c709e98d66
translatedAt: 2026-10-09
---
# Representación de términos

Tipos admitidos: átomos/booleanos, enteros arbitrarios, flotantes binary64
finitos, tuplas, listas propias/impropias y cadenas, maps, bitstrings y records
ordinarios de tupla; records nativos ([records nativos](native-records.md));
funs ([valores de función](funs.md)); pids, puertos y referencias locales
([más abajo](#pids-and-references), [puertos](ports.md#identity)). Las
codificaciones en palabras están en [abi.md](abi.md#terms).

## Propiedad

- Los valores compuestos residen en el heap de su proceso
  ([runtime](runtime.md#process-memory)). Los punteros de proceso
  siempre designan el inicio de un objeto. La admisión comprueba la propiedad:
  la palabra apunta, alineada a palabra, por debajo del tope del bloque de
  heap del proceso o de uno de sus fragmentos, y la cabecera (o celda cons)
  que hay allí coincide con su etiqueta
  ([admisión](runtime-heap.md#admission)). Las palabras ajenas y obsoletas se
  rechazan sin ninguna lectura. El tipo y la extensión se decodifican de la
  cabecera.
- Un `Term` del anfitrión para un valor del heap es una palabra etiquetada
  en bruto, válida hasta la siguiente recolección de su heap
  ([raíces](runtime-heap.md#roots-and-safe-points)); no fija el almacenamiento
  del heap. Tras el desmontaje del contexto, el acceso devuelve
  `expired_context`; tras una recolección posterior, `stale_term`. Destruir
  términos siempre es seguro.
- La construcción valida los hijos, reserva, inicializa y luego publica en un
  solo paso; un fallo revierte el almacenamiento y los contadores.
- `Term::from_word(word)` admite solo inmediatos independientes del propietario;
  `Term::from_word(word, context)` admite además átomos y términos del heap
  de ese contexto. La entrega dentro del mismo heap conserva la identidad.
  `copy_to`/`ProcessHeap::add` copian un grafo de otro proceso del mismo
  runtime conservando su compartición; las factorías de términos
  rechazan entradas ajenas con `wrong_owner`
  ([copia entre heaps](runtime-heap.md#copying-between-heaps)).
- Las celdas viven hasta que una recolección explícita las encuentra
  inalcanzables, o hasta el desmontaje del heap.

## Átomos

- `AtomStorage` por runtime, internado de forma diferida según la
  grafía UTF-8 exacta, sin normalización ni expulsión.
  `RuntimeOptions::max_atoms` 1..2^26, por defecto 2^20; los nombres de módulos
  y exportaciones cuentan. Las grafías existentes tienen éxito al alcanzar la
  capacidad.
- Hasta 255 escalares Unicode; se permiten el vacío, NUL y caracteres
  suplementarios; se rechaza UTF-8 mal formado, sobrelargo o con sustitutos
  (surrogates).
- Los contenidos provienen de un contador global del proceso del sistema, de
  modo que la palabra de átomo de otro runtime es detectable. Los
  procesos de 32 bits tienen 2^26 identidades en total durante su vida.
- Los `Term` de átomo del anfitrión fijan la grafía y sobreviven al desmontaje
  del runtime. Mover un átomo entre runtimes significa
  internar `atom_utf8()` en el destino.
- Los booleanos son los átomos `true`/`false`.
- El internado y la búsqueda son seguros desde workers concurrentes
  del planificador ([hilos](runtime.md#threads)); una grafía conserva una única
  palabra.

## Enteros

- Los valores que caben en el contenido de 28/60 bits del destino son
  inmediatos; los mayores son celdas inmutables de signo/magnitud. El cero y los
  valores pequeños siempre se normalizan a inmediatos. No hay estrechamiento de
  literales al ancho del anfitrión.
- Los `+`, `-`, `*` generados prueban una vía rápida en línea sobre dos
  inmediatos (cálculo de doble ancho con límites explícitos); si no, llaman al
  servicio del runtime.
- `div` trunca hacia cero; `rem` toma el signo del dividendo; las operaciones
  bit a bit usan complemento a dos infinito; los desplazamientos negativos
  invierten la dirección; los desplazamientos a la derecha enormes se saturan a
  0 o -1.
- Errores: operandos incorrectos y divisor cero → `badarith`; `abs/1` →
  `badarg`.
- Límites: como en ERTS, una magnitud de como máximo `BIG_ARITY_MAX` palabras:
  4.194.240 bits en destinos de 64 bits (65.535 palabras), 4.194.272 en 32 bits
  (131.071 palabras); el texto decimal se ajusta a ello (1.262.593 y 1.262.602
  dígitos). Un resultado aritmético mayor lanza `error:system_limit` en un
  cuerpo (`ValueOutcome::system_limit`,
  [ABI](abi.md#failure-channel-revision-2)) y hace fallar un guard; un segmento
  entero que extrae un valor mayor no encaja. El compilador rechaza un literal
  de más de 4.194.240 bits (`illegal integer`, como el analizador léxico de OTP)
  y un patrón constante que lo supere (`illegal pattern`).

## Flotantes

- Los bits IEEE binary64 pasan al runtime como ocho bytes en orden
  de red; NaN e infinito se rechazan. Sin fast-math.
- `+ - *` se mantienen exactos sobre dos enteros; cualquier operando flotante
  usa binary64. `/` siempre convierte ambos. Los resultados no finitos y los
  divisores cero → `badarith`.
- `float/1` redondea al par más cercano; `round/1` resuelve los empates
  alejándose de cero; `trunc`, `floor`, `ceil` devuelven enteros arbitrarios.
  Operandos incorrectos → `badarg`.
- La igualdad exacta distingue `1` de `1.0` y `0.0` de `-0.0`; la comparación
  numérica compara la parte entera exacta y la fracción del flotante, sin
  redondear nunca el entero. `min/max` devuelven el primer operando en caso de
  empate.

## Tuplas, listas, cadenas

- Tupla: cabecera de aridad + campos. Cons: palabras de cabeza + cola. `{}` y
  `[]` son inmediatos. Las cadenas son listas de puntos de código. Las listas no
  tienen límite de longitud más allá de la memoria (incluido un presupuesto de
  heap opcional). Las tuplas contienen hasta 16.777.215 elementos
  (`MAX_TUPLE_ARITY`, `MAX_ARITYVAL` de OTP); los constructores informan de una
  mayor como `resource_limit`, los builtins lanzarán `badarg`.
- Servicios: `hd`, `tl`, `length`, `tuple_size`, `size`, `element` con base
  uno.

## Maps

- Tablas inmutables ordenadas por el orden exacto de claves. Las claves
  duplicadas en la construcción conservan el último valor. La construcción
  ordena las claves (O(n log n) comparaciones; las claves ya ascendentes solo se
  comprueban); las actualizaciones insertan por búsqueda binaria. No hay límite
  de tamaño ni de trabajo más allá de la memoria, como en OTP; en destinos de 32
  bits el recuento de palabras de la cabecera limita un map a 2^24 - 1 entradas
  (`resource_limit`). Las claves enteras y flotantes difieren (también `0.0`
  frente a `-0.0`, también anidadas).
- Las actualizaciones `K := V` requieren la clave; `K => V` inserta o
  reemplaza. Las actualizaciones preparan una tabla nueva y la publican una
  sola vez.
- Errores en cuerpos: `{badmap, M}`, `{badkey, K}`; los guards rechazan en su
  lugar.
- Servicios: `is_map`, `map_size`, `map_get`, `is_map_key`, construcción,
  actualización.

## Bitstrings

- Empaquetados con el bit más significativo primero, con longitud exacta en bits
  y relleno a cero. Hasta 64 bytes residen en línea en un binary del heap
  dimensionado a los datos; los valores mayores usan un búfer inmutable
  compartido fuera del heap, visto mediante celdas de binary fuera del
  heap que comparten las colas extraídas. El búfer se carga una sola vez
  al proceso que lo crea. No hay límite de tamaño más allá de un presupuesto de
  heap de proceso opcional; los segmentos enteros se escriben sin construir
  un entero tan ancho como el segmento.
- La construcción prepara todos los segmentos antes de publicar. Los segmentos
  enteros se truncan; el orden de bytes nativo proviene de la disposición de
  datos del destino.
- Segmentos flotantes: anchos 16/32/64; la construcción puede codificar
  infinito, pero el encaje rechaza campos infinitos/NaN. Los encajes de
  flotantes de ancho cero extraen `0.0`.
- Los segmentos UTF-8/16/32 validan escalares, sustitutos y truncamiento.
- El encaje avanza un cursor de bits explícito solo en caso de éxito; `:all`
  como tamaño explícito no es válido.
- Servicios: `is_binary`, `is_bitstring`, `bit_size`, `byte_size` (redondea
  hacia arriba), `size` (redondea hacia abajo), `binary_part/2,3`. Errores →
  `badarg`.

## Records

- Los records ordinarios se expanden a tuplas `{Tag, Fields...}`. Las
  declaraciones deben preceder al uso; los duplicados, los campos desconocidos,
  las referencias adelantadas o a sí mismo y los campos comodín inválidos son
  errores.
- La construcción evalúa los campos en orden de declaración: valor explícito;
  si no, el valor por defecto comodín `_ = V`; si no, el valor por defecto
  declarado; si no, `undefined`. Cada valor por defecto se evalúa por separado
  en cada uso.
- Los patrones comprueban la aridad y la etiqueta, y después solo los campos
  enumerados. `#r.f` es el índice con base uno (la etiqueta en 1).
- El acceso a campos comprueba la aridad y la etiqueta; el fallo es
  `{badrecord, V}` en cuerpos y un rechazo en guards.
- `is_record(V, r)` usa la aridad declarada. `is_record/3` necesita una
  etiqueta átomo y una aridad entera (no positiva → false; tipos incorrectos →
  `badarg`); un tercer argumento átomo es la consulta de record nativo y
  devuelve false. Los guards requieren argumentos literales.
- La actualización `Expr#r{f = V, ...}` evalúa los nuevos valores en orden de
  código fuente, después `Expr`, luego comprueba la aridad y la etiqueta
  (`{badrecord, Value}` si no coinciden, también para `Expr#r{}`) y construye
  una tupla nueva; los demás campos se copian. `_ = V` se rechaza en las
  actualizaciones; las actualizaciones no están permitidas en patrones ni en
  guards.
- `record_info(fields | size, r)` se expande en tiempo de compilación a la
  lista de nombres de campo o al tamaño de la tupla. Ambos argumentos deben ser
  átomos literales y `r` un record de tupla declarado antes; no está permitido
  en guards, y un `record_info/2` local se rechaza como ya definido.
- Records nativos: [records nativos](native-records.md) (formas local,
  cualificada, importada y anónima).

## Pids y referencias

Plan 11 step 42. `self/0` devuelve el pid del proceso que llama, `make_ref/0`
una referencia nueva; `pid_to_list/1` y `ref_to_list/1` devuelven su texto.

- Un pid es una palabra inmediata (cuatro bits bajos `0x3`) que contiene el
  número del proceso. Los números provienen de una única secuencia global del
  proceso del sistema y nunca se reutilizan, de modo que un runtime admite una
  palabra de pid solo si emitió ese número: una palabra falsificada
  (nunca emitida) o el pid de otro runtime es
  `wrong_owner`. El pid de un proceso terminado sigue siendo un término válido,
  como en OTP. Los destinos de 32 bits tienen 2^28 números por ejecución del
  programa, los de 64 bits 2^60; crear un proceso más allá falla con
  `resource_limit`.
- Un puerto (plan step 57B) es una palabra inmediata (cuatro bits bajos `0x7`)
  que contiene su número de una secuencia propia que nunca se reutiliza, y se
  admite como un pid; se imprime como `#Port<0.N>` y se ordena entre los funs y
  los pids ([puertos](ports.md#identity)).
- Una referencia es una celda del heap (`reference`: cabecera más un número
  de 64 bits no rastreado) admitida como cualquier término del heap: solo
  en su propio proceso, obsoleta tras una recolección si es un `Term` del
  anfitrión, copiada por valor entre procesos. Los números provienen de un
  contador global del proceso del sistema, por lo que cada referencia de una
  ejecución del programa es única.
- La impresión sigue las identidades locales de OTP: un pid como `<0.N.S>` (N
  los 28 bits bajos de su número, S el resto), una referencia como
  `#Ref<0.A.B.C>` (C los 18 bits bajos de su número, B los 32 siguientes, A el
  resto), tanto en el estilo `~w` como en el de display. Los pids se ordenan por
  número y las referencias también, de modo que las referencias posteriores de
  un programa se ordenan después de las anteriores.

## Comparación y orden

Iterativa y sin límite de trabajo, como en OTP: solo la memoria para los pares
pendientes limita una comparación, incluidas las búsquedas de claves de map, y
las palabras idénticas son iguales sin recorrerlas. Los bitstrings alineados a
byte comparan bytes completos de una vez. Orden: números < átomos < referencias
< funs < pids < tuplas < records nativos < maps < nil < listas < bitstrings
(los [funs](funs.md#comparison-and-printing) se ordenan entre sí). Los átomos
se comparan por su grafía UTF-8 (orden de puntos de código); las tuplas por
aridad y después por campos; los maps por tamaño, luego por claves y luego por
valores; los bitstrings por sus bits lógicos.

## Impresión

`format_term` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
representa cualquier término admitido en uno de dos estilos de OTP. Los
enteros, las tuplas (los records son tuplas) y el anidamiento se ven igual en
ambos.

| | `~w` (`TermStyle::write`) | `erlang:display/1` (`TermStyle::display`) |
| --- | --- | --- |
| Átomos | Entre comillas salvo que empiece por una letra minúscula de Latin-1 seguida de caracteres de nombre (con `@`); las palabras reservadas y `maybe`/`else` van entre comillas; fuera de Latin-1 se escapa como `\x{H}` | Entre comillas salvo que empiece por una letra minúscula de Latin-1 seguida de alfanuméricos o `_`; las palabras reservadas y `@` no tienen regla especial; se conserva UTF-8 |
| Flotantes | Ida y vuelta más corta en el formato de OTP: `0.1`, `100.0`, `1.0e16`, `1.5e-7` | `%.6e` de C: `1.500000e+00` |
| Listas | Elementos: `[104,105]`, `[1,2\|3]` | Una lista plana de bytes Latin-1 imprimibles se imprime como `"hi"` (bytes en bruto; solo se escapan `\n` y `"`) |
| Bitstrings | `<<1,2,5:3>>` | Un binary ASCII imprimible se imprime como `<<"hi">>`, los demás como `~w` |
| Maps | `#{k => v,k2 => v2}` | `#{k=>v,k2=>v2}` |

- Los maps se imprimen en orden de claves (`maps:iterator(M, ordered)`, como
  `~kw` de OTP). El `~w` por defecto de OTP y `erlang:display/1` siguen en
  cambio su disposición interna: orden de la tabla de átomos para las claves
  átomo de maps pequeños (varía entre ejecuciones de la VM) y orden de hash por
  encima de 32 claves. Clause no reproduce ese orden.
- La representación es iterativa, por lo que la profundidad solo está limitada
  por el término. El texto tiene un tope de 64 MiB por defecto; superarlo (por
  ejemplo, con un subtérmino ampliamente compartido) falla con `resource_limit`
  y no devuelve texto parcial.
- Goldens: `runtime_printing` compara ambos estilos
  con OTP para 9.542 valores (todos los resultados del corpus más casos límite
  escritos a mano); se omiten las filas de display cuyo orden de map en OTP es
  interno ([fixtures](../tests/fixtures/printing/README.md)).
