---
source: docs/terms.md
sourceCommit: 336caea7
sourceSha256: 96b812193b9f942c57eed9d94df4955f308354e89e00cc00f4d46f19b54c2882
translatedAt: 2026-10-18
---
# Representación de términos

Tipos admitidos: átomos/booleanos, enteros arbitrarios, flotantes binary64
finitos, tuplas, listas propias/impropias y cadenas, maps, bitstrings y records
ordinarios de tupla; native records ([native records](native-records.md));
funs ([valores de función](funs.md)); pids, puertos y referencias locales
([más abajo](#pids-and-references), [puertos](ports.md#identity)). Las
codificaciones en palabras están en [abi.md](abi.md#terms).

## Propiedad

- Los valores compuestos residen en el heap de su proceso
  ([contrato del heap](runtime-heap.md)) o en el área de literales de solo
  lectura de un módulo ([áreas](runtime-heap.md#areas)). Los punteros de
  proceso siempre designan el inicio de un objeto. La admisión (solo en compilaciones Debug;
  Release confía en las palabras, `CHECKED_ADMISSION`) comprueba el rango
  poseído y la forma de la cabecera, y rechaza las direcciones ajenas y las
  formas no válidas ([admisión](runtime-heap.md#admission)); el tipo y la extensión se
  decodifican de la cabecera.
- Un `Term` del anfitrión es exactamente una `Word`, trivialmente copiable,
  con solo `value_`. Un Term de heap es válido hasta la siguiente recolección
  de su heap o la salida del proceso
  ([raíces](runtime-heap.md#roots-and-safe-points)); no fija nada ni lleva
  heap, testigo de vida o contador de recolecciones. El acceso posterior lee
  memoria movida o liberada y es indefinido; no existe el error `stale_term`.
  Su destrucción es segura. Las factorías, las reservas y los búferes de
  mensajes conservan sus propias comprobaciones de vida y siguen informando
  de `expired_context`.
- La construcción valida los hijos, reserva, inicializa y luego publica en un
  solo paso; un fallo revierte el almacenamiento y los contadores.
- `Term::from_word(word)` admite solo inmediatos independientes del
  propietario; `Term::from_word(word, context)` admite además átomos y términos
  del heap de ese contexto. La entrega dentro del mismo heap conserva la
  identidad. `copy_to`/`ProcessHeap::add` copian un grafo de otro proceso del
  mismo runtime bajo un contrato del llamante; las factorías de términos rechazan
  entradas ajenas con `wrong_owner`
  ([copia entre heaps](runtime-heap.md#copying-between-heaps)).
- Las celdas viven hasta que una recolección las encuentra inalcanzables, o
  hasta el desmontaje del heap ([recolección](runtime-heap.md#collection)).

## Átomos

- `AtomStorage` por runtime, internado de forma diferida según la grafía UTF-8
  exacta, sin normalización ni expulsión. `RuntimeOptions::max_atoms` 1..2^26,
  por defecto 2^20; los nombres de módulos y exportaciones cuentan. Las grafías
  existentes tienen éxito al alcanzar la capacidad.
- Hasta 255 escalares Unicode; se permiten el vacío, NUL y caracteres
  suplementarios; se rechaza UTF-8 mal formado, sobrelargo o con sustitutos
  (surrogates).
- Los contenidos provienen de un contador global del proceso del sistema y
  nunca se reutilizan, ni siquiera entre runtimes. El índice global contiene
  2^28 números, limitados por la carga útil de átomo de la palabra en destinos
  de 32 bits (2^26 identidades durante su vida). Los límites por runtime no
  cambian. Los números de átomo nunca salen de un nodo: ETF y los formatos de
  disco usan grafías.
- `detail::atom_table` permite lecturas sin bloqueos por número de átomo:
  directamente los registros fijos y después bloques de 4.096 ranuras
  conservados durante toda la vida del proceso del sistema. Cada `AtomStorage`
  posee sus registros por grafía, los publica en este índice y admite solo los
  registros propios o fijos. El desmontaje retira sus ranuras.
- Los Terms de átomo no fijan nada. `atom_spelling()` toma prestada la grafía
  hasta el desmontaje del runtime; tanto esta función como `atom_utf8()`
  informan de `expired_context` después de desmontar el runtime de un átomo
  no fijo. Mover un átomo entre runtimes significa internar su grafía en el
  destino mientras el runtime de origen siga vivo.
- Los booleanos son los átomos `true`/`false`. Los átomos fijos `false`,
  `true`, `undefined`, `ok` y `error` (`abi::v1::fixed_atom_spellings`) tienen
  las palabras de los números de átomo 0–4 en todos los runtimes, con registros
  estáticos inmortales, se encuentran sin el bloqueo y no cuentan ni en
  `size()` ni para `max_atoms`; el código generado los usa como constantes.
  Cualquier otra palabra de átomo es privada del runtime.
- Los literales compuestos de constantes (cadenas, listas y tuplas de
  inmediatos y otros literales, flotantes, bignums) son celdas del área de
  literales del módulo, construidas en tiempo de compilación y compartidas
  ([áreas de literales](runtime-heap.md#areas)); los literales enteros del
  rango pequeño son inmediatos.
- Los demás literales átomo se cargan desde la caché de átomos del módulo
  (`ModuleDescriptor::atom_cache`: la identidad del runtime que la reclama y
  después una palabra por ranura), que rellena el primer runtime que registra el
  módulo; un contexto cuyo `FrameState::runtime` coincide con la reclamación la
  lee sin llamada, y cualquier otro llama a `CLAUSE_atom_v3`. La reclamación se
  devuelve cuando el servidor de código del runtime libera el módulo.
- El internado y la búsqueda son seguros frente a hilos de trabajo
  concurrentes del planificador ([hilos](runtime.md#threads)); una grafía
  conserva una sola palabra.

## Enteros

- Los valores dentro de la carga útil de 28/60 bits del destino son inmediatos;
  los mayores son celdas inmutables de signo/magnitud. El cero y los valores
  pequeños siempre se normalizan a inmediatos. No hay estrechamiento de
  literales al ancho del anfitrión.
- En `-O2`, los operandos que la inferencia demuestra pequeños omiten sus
  comprobaciones de etiqueta, y un rango de resultado demostrado omite también
  la comprobación de desbordamiento y la alternativa
  ([demostraciones](specialization.md#proofs)).
- Los `+`, `-`, `*` generados prueban una ruta rápida en línea con dos
  inmediatos y, si no, llaman al servicio del runtime: `+` y `-` suman o restan
  directamente las palabras etiquetadas (`a + (b ^ 15)`) y recurren a la
  alternativa cuando la palabra se desborda, que es exactamente cuando el
  resultado sale del rango pequeño; `*` calcula en doble ancho con límites
  explícitos. Lo mismo hacen `band`, `bor`, `bxor`, `bsr`, `div`, `rem` y las
  comparaciones de dos enteros pequeños
  ([formas en línea](abi.md#runtime-services)).
- `div` trunca hacia cero; `rem` toma el signo del dividendo; las operaciones
  bit a bit usan complemento a dos infinito; los desplazamientos negativos
  invierten la dirección; los desplazamientos a la derecha enormes se saturan a
  0 o -1.
- Errores: operandos incorrectos y divisor cero → `badarith`; `abs/1` →
  `badarg`.
- Límites: como en ERTS, una magnitud de como máximo `BIG_ARITY_MAX` palabras:
  4.194.240 bits en destinos de 64 bits (65.535 palabras), 4.194.272 en 32 bits
  (131.071 palabras); el texto decimal sigue (1.262.593 y 1.262.602 dígitos).
  Un resultado aritmético mayor lanza `error:system_limit` en un cuerpo
  (`ValueOutcome::system_limit`, [ABI](abi.md#failure-channel-revision-2)) y
  hace fallar un guard; un segmento entero que extrae un valor mayor no
  coincide. El compilador rechaza un literal de más de 4.194.240 bits
  (`illegal integer`, como el escáner de OTP) y un patrón constante que lo
  supere (`illegal pattern`).

## Flotantes

- Los bits IEEE binary64 pasan al runtime como ocho bytes en orden de red; NaN
  e infinito se rechazan. Sin fast-math.
- `+ - *` siguen siendo exactos con dos enteros; cualquier operando flotante
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
  `[]` son inmediatos. Las cadenas son listas de puntos de código. Las listas
  no tienen más límite de longitud que la memoria (incluido un presupuesto de
  heap opcional). Las tuplas contienen hasta 16.777.215 elementos
  (`MAX_TUPLE_ARITY`, el `MAX_ARITYVAL` de OTP); los constructores informan de
  una mayor como `resource_limit`; los builtins (`make_tuple`,
  `list_to_tuple/1`) lanzan `badarg`.
- Servicios: `hd`, `tl`, `length`, `tuple_size`, `size`, `element` con base 1.

## Maps

- Tablas inmutables ordenadas por el orden exacto de claves. Las claves de
  construcción duplicadas conservan el último valor. La construcción ordena las
  claves (O(n log n) comparaciones; las claves ya ascendentes solo se
  comprueban). Hasta 32 entradas, un map es una sola celda del heap y una
  actualización inserta mediante búsqueda binaria en una copia; por encima de
  eso es un árbol B+ de celdas del heap actualizado por copia de rutas en
  O(log n) ([árboles de maps](runtime-heap.md#map-trees)). No hay límite de
  tamaño ni de trabajo más allá de la memoria, como en OTP. Las claves enteras
  y flotantes difieren (también `0.0` frente a `-0.0`, también anidadas).
- Las actualizaciones `K := V` requieren la clave; `K => V` inserta o
  reemplaza. Las actualizaciones preparan una tabla nueva y la publican una
  sola vez.
- Errores en el cuerpo: `{badmap, M}`, `{badkey, K}`; los guards rechazan en su
  lugar.
- Servicios: `is_map`, `map_size`, `map_get`, `is_map_key`, construcción,
  actualización.

## Bitstrings

- Empaquetados con el bit más significativo primero, con longitud exacta en
  bits y relleno a cero. Hasta 64 bytes residen en línea en un binario del heap
  dimensionado a los datos; los valores mayores usan un búfer inmutable
  compartido fuera del heap, y los fragmentos son celdas sub-binary de su
  original ([binarios fuera del heap](runtime-heap.md#off-heap-binaries)). No
  hay límite de tamaño más allá de un presupuesto opcional del heap del
  proceso; los segmentos enteros se escriben sin construir un entero tan ancho
  como el segmento.
- La construcción prepara todos los segmentos antes de publicar. Los segmentos
  enteros se truncan; el orden de bytes nativo procede del data layout del
  destino. Un segmento entero de un valor pequeño y un ancho de como máximo 64
  bits se escribe desde su palabra de máquina (bytes enteros de una vez en un
  límite de byte); los demás toman la ruta de multiprecisión. El código
  generado construye en línea las construcciones pequeñas de ancho constante
  ([marcos y transferencias](abi.md#frames-and-transfers)).
- Concatenaciones al final, como los binarios escribibles de OTP: una
  construcción que empieza con un binary completo (`<<Acc/binary, ...>>`)
  construye su resultado en un búfer con espacio libre (el doble de su tamaño,
  al menos 256 bytes) cuya celda fuera del heap en el proceso creador registra
  sus bits en uso y su capacidad (cero en cualquier otra celda, incluidas las
  copias). Una concatenación posterior cuya vista del acumulador termina
  exactamente allí escribe los nuevos bytes en el espacio libre, que ninguna
  vista cubre, y devuelve una vista más larga del mismo búfer: un sub-binary de
  la propia celda fuera del heap del búfer, que puede llegar más allá de los
  bits de esa celda. Cualquier otro acumulador (una vista más antigua, la de
  otro proceso, una no alineada, un búfer lleno) se copia en un nuevo búfer de
  tamaño doble. Las demás vistas del búfer nunca cambian.
- Segmentos flotantes: anchos 16/32/64; la construcción puede codificar
  infinito, pero el ajuste de patrones rechaza campos infinitos/NaN. Los ajustes
  de flotantes de ancho cero extraen `0.0`.
- Los segmentos UTF-8/16/32 validan escalares, sustitutos y truncamiento.
- El ajuste de patrones avanza un cursor de bits explícito solo si tiene éxito;
  `:all` como tamaño explícito no es válido.
- Servicios: `is_binary`, `is_bitstring`, `bit_size`, `byte_size` (redondea
  hacia arriba), `size` (redondea hacia abajo), `binary_part/2,3`. Errores →
  `badarg`.

## Records

- Los records ordinarios se expanden a tuplas `{Tag, Fields...}`. Las
  declaraciones deben preceder al uso; los duplicados, los campos desconocidos,
  las referencias hacia delante o a sí mismos y los campos comodín no válidos
  son errores.
- La construcción evalúa los campos en orden de declaración: valor explícito;
  si no, el valor por defecto comodín `_ = V`; si no, el valor por defecto
  declarado; si no, `undefined`. Cada valor por defecto se evalúa por separado
  en cada uso.
- Los patrones comprueban la aridad y la etiqueta, y después solo los campos
  enumerados. `#r.f` es el índice con base 1 (la etiqueta en 1).
- El acceso a campos comprueba la aridad y la etiqueta; el fallo es
  `{badrecord, V}` en los cuerpos y un rechazo en los guards.
- `is_record(V, r)` usa la aridad declarada. `is_record/3` necesita una
  etiqueta átomo y una aridad entera (no positiva → false; tipos incorrectos →
  `badarg`); un tercer argumento átomo es la consulta de native record y
  devuelve false. Los guards requieren argumentos literales.
- La actualización `Expr#r{f = V, ...}` evalúa los nuevos valores en el orden
  del código fuente, después `Expr`, después comprueba la aridad y la etiqueta
  (`{badrecord, Value}` si no coinciden, también para `Expr#r{}`) y construye
  una tupla nueva; los demás campos se copian. `_ = V` se rechaza en las
  actualizaciones; las actualizaciones son ilegales en patrones y guards.
- `record_info(fields | size, r)` se expande en tiempo de compilación a la
  lista de nombres de campos o al tamaño de la tupla. Ambos argumentos deben
  ser átomos literales y `r` un record de tupla declarado antes; es ilegal en
  guards, y un `record_info/2` local se rechaza como ya definido.
- Native records: [native records](native-records.md) (formas locales,
  cualificadas, importadas y anónimas).

## Pids y referencias

`self/0` devuelve el pid del proceso que llama, `make_ref/0` una referencia
nueva; `pid_to_list/1` y `ref_to_list/1` devuelven su texto.

- Un pid es una palabra inmediata (cuatro bits bajos `0x3`) que contiene el
  número del proceso. Los números proceden de una única secuencia global del
  proceso del sistema y nunca se reutilizan, de modo que un runtime admite una
  palabra de pid solo cuando emitió ese número: una palabra falsificada (nunca
  emitida) o el pid de otro runtime es `wrong_owner`. El pid de un proceso que
  ha terminado sigue siendo un término válido, como en OTP. Los destinos de 32
  bits tienen 2^28 números por ejecución del programa, los de 64 bits 2^60;
  crear un proceso más allá de ellos falla con `resource_limit`.
- Un puerto es una palabra inmediata (cuatro bits bajos `0x7`) que contiene su
  número de su propia secuencia que nunca se reutiliza, admitida como un pid; se
  imprime como `#Port<0.N>` y se ordena entre los funs y los pids
  ([puertos](ports.md#identity)).
- Una referencia es una celda del heap (`reference`: cabecera más un número de
  64 bits no rastreado) admitida como cualquier término del heap: solo en su
  propio proceso, copiada por valor entre procesos. Un `Term` del anfitrión sin
  raíz no puede consultarse tras una recolección o la salida del proceso. Los
  números proceden de un único contador
  global del proceso del sistema, de modo que cada referencia de una ejecución
  del programa es única.
- Una referencia handle (una magic reference de OTP) es una celda de referencia
  que además contiene un búfer fuera del heap; es la misma referencia para
  todos los servicios y comparte su búfer con todas las copias
  ([referencias handle](runtime-heap.md#handle-references)).
- La impresión sigue las identidades locales de OTP: un pid como `<0.N.S>` (N
  los 28 bits bajos de su número, S el resto), una referencia como
  `#Ref<0.A.B.C>` (C los 18 bits bajos de su número, B los 32 siguientes, A el
  resto), tanto en el estilo `~w` como en el de display. Los pids se ordenan por
  número y las referencias por número, de modo que las referencias posteriores
  de un programa se ordenan después de las anteriores.

## Comparación y orden

Iterativa y sin límite de trabajo, como en OTP: solo la memoria para los pares
pendientes acota una comparación, incluidas las búsquedas de claves de map, y
las palabras idénticas son iguales sin recorrerlas. Los bitstrings alineados a
byte comparan bytes enteros de una vez. Orden: números < átomos < referencias
< funs < puertos < pids < tuplas < native records < maps < nil < listas <
bitstrings (los [funs](funs.md#comparison-and-printing) se ordenan entre sí).
Los átomos se comparan por su grafía UTF-8 (orden de puntos de código); las
tuplas por aridad y después por campos; los maps por tamaño, después por claves
y después por valores; los bitstrings por bits lógicos. Dos enteros pequeños,
dos flotantes o dos binarios de bytes enteros se ordenan directamente a partir
de sus palabras o celdas (`detail::word_order`), y dos átomos a partir de sus
grafías en la tabla de átomos (`AtomStorage::spelling`, mediante el índice
numérico sin bloqueos), sin admisión de términos.

## Impresión

`format_term` ([output.hpp](../runtime/include/clause/runtime/output.hpp))
representa cualquier término admitido en uno de dos estilos de OTP. Los
enteros, las tuplas (los records son tuplas) y el anidamiento se ven igual en
ambos.

| | `~w` (`TermStyle::write`) | `erlang:display/1` (`TermStyle::display`) |
| --- | --- | --- |
| Átomos | Entre comillas salvo que empiece por una letra minúscula Latin-1 seguida de caracteres de nombre (con `@`); las palabras reservadas y `maybe`/`else` van entre comillas; más allá de Latin-1 se escapa como `\x{H}` | Entre comillas salvo que empiece por una letra minúscula Latin-1 seguida de alfanuméricos o `_`; las palabras reservadas y `@` no tienen regla especial; se conserva UTF-8 |
| Flotantes | Ida y vuelta más corta con la disposición de OTP: `0.1`, `100.0`, `1.0e16`, `1.5e-7` | C `%.6e`: `1.500000e+00` |
| Listas | Elementos: `[104,105]`, `[1,2\|3]` | Una lista plana de bytes Latin-1 imprimibles se imprime como `"hi"` (bytes en bruto; solo se escapan `\n` y `"`) |
| Bitstrings | `<<1,2,5:3>>` | Un binary ASCII imprimible se imprime como `<<"hi">>`, los demás como `~w` |
| Maps | `#{k => v,k2 => v2}` | `#{k=>v,k2=>v2}` |

- Los maps se imprimen en orden de claves de map
  (`maps:iterator(M, ordered)`, como `~kw` de OTP). El `~w` predeterminado de
  OTP y `erlang:display/1` siguen en cambio su disposición interna: el orden de
  la tabla de átomos para las claves átomo de maps pequeños (varía entre
  ejecuciones de la VM) y el orden de hash por encima de 32 claves. Clause no
  reproduce ese orden.
- La representación es iterativa, por lo que la profundidad solo está limitada
  por el término. El texto está limitado a 64 MiB por defecto; superarlo (por
  ejemplo, un subtérmino muy compartido) falla con `resource_limit` y no
  devuelve texto parcial.
- Goldens: `runtime_printing` compara ambos estilos con OTP (todos los
  resultados de los corpus más casos límite de autoría propia); se omiten las
  filas de display cuyo orden de map en OTP es interno
  ([fixtures](../tests/fixtures/printing/README.md)).
