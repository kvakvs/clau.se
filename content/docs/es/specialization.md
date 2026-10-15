---
source: docs/specialization.md
sourceCommit: 6ed3851c
sourceSha256: 896b741de11f8f1f7f9098670798d1de273c0e4be02cb7ebfadca90e184b0e36
translatedAt: 2026-10-15
---
# Especialización por tipos

El modo de velocidad (`-O2`) usa [hechos inferidos](semantic.md#inference) para
eliminar comprobaciones en tiempo de ejecución (demostraciones) y puede clonar
una función en variantes de representación protegidas por comprobaciones de
etiqueta en tiempo de ejecución. `-O0` y `--no-type-specialization` producen
solo código genérico: se mantienen todas las comprobaciones y todo acceso a un
compuesto pasa por su servicio del runtime.

## Demostraciones

Una demostración (proof) solo procede de hechos que se cumplen siempre que el
código se ejecuta:

- los hechos de los argumentos de una función local unidos a partir de todos
  sus llamantes (`Inference::inputs`; las funciones exportadas y las funciones
  nombradas por `fun F/A` no tienen ninguno);
- el hecho registrado de una expresión (el hecho de un operando se registra
  antes de que la operación que lo usa lo estreche);
- una prueba de forma anterior en el mismo plan de encaje: los nodos del plan
  se ejecutan en línea, así que una prueba de tupla o de cons superada domina
  todos los nodos posteriores.

Las especificaciones nunca demuestran nada. `term()` y `none()` (código que la
inferencia encontró inalcanzable) no demuestran nada; los cuerpos de funs
anónimos no reciben demostraciones.

| Operación | Demostrada por | Código generado |
| --- | --- | --- |
| `+ - *` | ambos operandos en rangos de enteros pequeños, rango del resultado dentro de la carga útil inmediata | decodificar, calcular y codificar en línea; sin etiqueta, desbordamiento ni ruta alternativa |
| `+ - *` | uno o ambos operandos en rangos de enteros pequeños | desaparecen las pruebas de etiqueta demostradas; se mantienen la comprobación de desbordamiento y la ruta alternativa del servicio |
| patrón de tupla | hecho del argumento o del valor examinado: tuplas exactas de la aridad del patrón | se elimina la prueba de forma (sin demostrar: se prueba en línea) |
| elemento de tupla | una prueba de forma o un hecho que demuestra la tupla | carga en línea del elemento |
| patrón de lista | hecho: seguro una celda cons | se elimina la prueba de forma (si no, una prueba de etiqueta primaria en cada nivel) |
| cabeza, cola | una prueba de cons o un hecho que demuestra la celda | cargas en línea |
| literal exacto `[]`, `{}`, entero pequeño, átomo | siempre (en todos los niveles desde OPT0.2A) | comparación de palabras: los inmediatos iguales son una sola palabra |
| generador de lista | hecho de la entrada del generador: una lista propia | prueba de cons y lecturas de celdas en línea en cada iteración |

Los hechos llegan a los patrones de las cabeceras de función (argumentos
unidos de los llamantes), a los encajes en el cuerpo (el lado derecho) y a las
cláusulas de case/try (el valor examinado o el valor del cuerpo de try); los
hechos de elemento, cabeza y cola siguen a las extracciones. Una lectura en
línea se guarda en una ranura raíz como la salida de un servicio, de modo que
el lowering de marcos la conserva como término a través de los puntos seguros
([regla de recarga](runtime-heap.md#reload-rule)). Las únicas conversiones de
punteros en el código generado son estas lecturas demostradas y las cargas de
cabecera de las pruebas de forma de tupla en línea (`proven.cell`).
Las constantes de disposición provienen de [`abi/term.hpp`](abi.md#terms); el
runtime las verifica frente a sus disposiciones privadas de celdas.

## Variantes

- Los perfiles provienen de hechos en los puntos de llamada: un argumento cuyo
  hecho contiene solo enteros pequeños (singletons o rangos) demuestra un
  argumento entero pequeño. Las specs, `integer()` amplio, las uniones con
  otros tipos y los valores desconocidos permanecen genéricos.
- Una variante solo se justifica si elimina una comprobación implementada: una
  comparación exacta de etiqueta baja de una palabra de argumento en cualquier
  parte del cuerpo (el array de argumentos nunca se escribe, y una recolección
  nunca cambia un entero pequeño).
- Límites: 3 variantes por función, 32 por módulo, 128 por objetivo. El
  crecimiento estimado y luego el real (clon + guards + despacho + respaldo)
  deben mantenerse dentro de 2x el número de instrucciones genéricas por función
  y por módulo.
- Los cuerpos genéricos se conservan siempre. Los borradores que exceden el
  presupuesto se descartan en silencio; el programa nunca falla a causa de la
  especialización.
- La selección es determinista (orden de módulo, símbolo y perfil).

La clonación/simplificación de LLVM sustituye las comprobaciones demostradas
dentro del clon. Un despachador acotado prueba cada etiqueta restringida y
reenvía el contexto y los argumentos a una variante o al cuerpo genérico; el
símbolo público y la ABI no cambian. No se introducen suposiciones basadas en
specs ni flags de fast-math.

## Efecto actual

Las demostraciones actúan sobre código fuente real: las funciones locales
cuyos llamantes pasan enteros pequeños, tuplas y listas pierden sus
comprobaciones de etiqueta, de forma y de servicio
([`proofs`](../tests/fixtures/executables/proofs/proofs.erl), comprobado por la
prueba de CTest `codegen_proofs` y ejecutado como el golden de ejecutables
`executables_proofs`). Una variante debe ahorrar más instrucciones de las que
cuesta su despacho; una única prueba de etiqueta eliminada de un argumento
rara vez lo consigue, así que las variantes de código fuente normalmente se
planifican y después las rechaza el límite de crecimiento. Fixtures
específicos de LLVM inyectan comprobaciones de etiqueta repetidas para
ejercitar aciertos, respaldos y la reversión por crecimiento con ejecución
nativa.

Los goldens de ejecutables se ejecutan con todas las políticas en el modo
completo; el modo rápido ejecuta `-O0` (genérico) y `-O2` con especialización
(demostraciones).

`codegen_measurements` escribe `measurements/<config>/measurements.json` en el
directorio de compilación de las pruebas de codegen (tiempo de compilación,
bytes de IR/objeto, variantes, lecturas demostradas, tiempo nativo). Los
tiempos son descriptivos, nunca umbrales. Muestra de Windows x64 / LLVM 23.1.2
(2026-09-29, antes de las demostraciones): la carga de trabajo de código fuente
produce 232,876 bytes de IR / 40,498 bytes de objeto en O0 y 204,408 / 35,886
con ambas políticas de O2, cero variantes; el fixture sintético añadió 30
instrucciones a una función de 55 instrucciones para una variante aceptada.
