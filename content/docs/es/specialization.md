---
source: docs/specialization.md
sourceCommit: 06042fa
sourceSha256: 2c39d48470df1d080597dde6ad170daf6c6a24e35d3a42c166a0c9dcf90dee23
translatedAt: 2026-10-09
---
# Especialización por tipos

El modo de velocidad (`-O2`) puede clonar una función en variantes de
representación protegidas por comprobaciones de etiqueta en tiempo de ejecución.
`-O0` y `--no-type-specialization` producen solo código genérico.

## Política

- Los perfiles provienen de hechos inferidos en los puntos de llamada. Hoy solo
  los singletons enteros exactos y representables en el objetivo demuestran un
  argumento entero pequeño. Las specs, `integer()` amplio, las uniones y los
  valores desconocidos permanecen genéricos.
- Una variante solo se justifica si elimina una comprobación implementada: una
  comparación exacta de etiqueta baja sobre la carga de un argumento en el
  bloque de entrada, antes de cualquier efecto secundario.
- Límites: 3 variantes por función, 32 por módulo, 128 por objetivo. El
  crecimiento estimado y luego el real (clon + guards + despacho + respaldo)
  deben mantenerse dentro de 2x el número de instrucciones genéricas por función
  y por módulo.
- Los cuerpos genéricos se conservan siempre. Los borradores que exceden el
  presupuesto se descartan en silencio; el programa nunca falla a causa de la
  especialización.
- La selección es determinista (orden de módulo, símbolo y perfil).

## Lowering

La clonación/simplificación de LLVM sustituye las comprobaciones demostradas
dentro del clon. Un despachador acotado prueba cada etiqueta restringida y
reenvía el contexto y los argumentos a una variante o al cuerpo genérico; el
símbolo público y la ABI no cambian. No se introducen desempaquetados sin
comprobación, suposiciones basadas en specs ni flags de fast-math.

## Efecto actual

El subconjunto de código fuente actual no tiene comprobaciones de representación
eliminables, por lo que el código fuente Erlang real recibe cero variantes
incluso en O2; especializar una identidad solo haría crecer el código. Fixtures
específicos de LLVM inyectan comprobaciones de etiqueta repetidas para ejercitar
aciertos, respaldos y la reversión por crecimiento con ejecución nativa.

`codegen_measurements` escribe `measurements/<config>/measurements.json` en el
directorio de compilación de las pruebas de codegen (tiempo de compilación,
bytes de IR/objeto, variantes, tiempo nativo). Los tiempos son descriptivos,
nunca umbrales. Muestra de Windows x64 / LLVM 23.1.2 (2026-09-29): la carga de
trabajo de código fuente produce 232,876 bytes de IR / 40,498 bytes de objeto en
O0 y 204,408 / 35,886 con ambas políticas de O2, cero variantes; el fixture
sintético añadió 30 instrucciones a una función de 55 instrucciones para una
variante aceptada.
