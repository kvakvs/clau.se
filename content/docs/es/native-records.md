---
source: docs/native-records.md
sourceCommit: 6ed3851c
sourceSha256: 5383c5a0c72bed06730432be7a2605262122d7580d5a4e6124e01661d7e93086
translatedAt: 2026-10-15
---
# Records nativos

Delimita las formas de record de
OTP 29 más allá de los records ordinarios de tupla y fija su representación,
operaciones y errores. El step 31B implementó las celdas del runtime y
`CLAUSE_record_v1`; 31C compila los records nativos locales, 31D
las formas cualificadas e importadas con `-export_record`/`-import_record`, y
31E las formas anónimas. Los records de tupla están en
[términos](terms.md#records).

OTP 29 marca los records nativos como experimentales. Los datos siguientes
provienen de los fuentes fijados de `maint-29` (`erl_lint`,
`erl_expand_records`, `v3_core`, `beam_core_to_ssa`,
`erts/emulator/beam/erl_record.c`, `utils.c`, `erl_printf_term.c`) y de pruebas
en vivo sobre OTP 29.1.1.

## Alcance

Se seleccionan las tres formas que van más allá de los records de tupla.
Comparten una única representación, por lo que no necesitan una decisión de
representación aparte:

| Forma | Sintaxis | Step |
| --- | --- | --- |
| Record nativo, local | `-record #r{...}.`, `#r{...}`, `X#r.f`, `X#r{...}`, patrones, `is_record/1,2,3` | 31C |
| Cualificado e importado | `#m:r{...}`, `X#m:r.f`, `X#m:r{...}`, patrones; `-export_record`, `-import_record` | 31D |
| Inferido (anónimo) | `X#_.f`, `X#_{...}`, patrón `#_{...}` | 31E |

No seleccionados: el módulo de reflexión `records` (una biblioteca, junto con el
trabajo de biblioteca del step 39), `term_to_binary` (`RECORD_EXT`) y la
actualización de código en caliente (D01). Las llamadas a `records:*` siguen
dando diagnósticos `unknown module`.

## Representación

- **Descriptor.** Cada definición de record nativo se compila a un único
  `abi::v1::RecordDescriptor` inmutable junto al descriptor de su módulo: el
  `ModuleDescriptor` que lo define, slots de átomo para los nombres del módulo
  y del record, el indicador de exportación (`-export_record` en tiempo de
  compilación) y los slots de átomo de los nombres de campo en orden de
  definición. Los slots de átomo se resuelven mediante los átomos registrados
  del módulo, como los nombres de `FrameDescriptor`. Los programas son estáticos
  (sin descarga), por lo que un descriptor vive tanto como el programa; otro
  módulo del lote se refiere a él por símbolo. Los valores por defecto se
  compilan en cada punto de construcción y nunca se almacenan.
- **Instancia.** Celda del heap de tipo `native_record`: cabecera
  (recuento `1 + n`), una palabra de descriptor no rastreada y después `n`
  valores rastreados en orden de definición. Un record sin campos es una celda
  de dos palabras.
- El descriptor captura módulo, nombre, indicador de exportación y lista de
  campos en la construcción, como hace la definición capturada de OTP. Toda
  operación posterior a la construcción lee el descriptor de la instancia,
  nunca el código que la ejecuta.
- La copia, la recolección, el recorrido y la verificación tratan la celda
  como una tupla cuya primera palabra de contenido no se rastrea. La admisión
  exige un descriptor registrado por un módulo del mismo runtime.

## Operaciones

`M` es el módulo actual. Todos los errores tienen la clase `error`; el
contenido de badrecord es el valor causante, salvo en la construcción externa
fallida.

| Operación | Acepta | Fallo |
| --- | --- | --- |
| Construcción local `#r{...}` | Siempre (la definición es local) | Un campo desconocido o un valor ausente son errores de compilación |
| Construcción externa `#m:r{...}` (también `#r{...}` importado, también `#M:r`) | `m:r` definido en el lote y exportado | `{badrecord, {m, r}}`; después `{badfield, {{m, r}, F}}`, `{novalue, {{m, r}, F}}` (prevalece badfield) |
| Acceso local `X#r.f` | Record nativo llamado `r` (el módulo y el indicador de exportación **no** se comprueban, como en el runtime de OTP) | `{badrecord, X}`; campo ausente `{badfield, {{Mod, r}, f}}` |
| Acceso externo `X#m:r.f` | Módulo `m`, nombre `r`, exportado | `{badrecord, X}`; `{badfield, ...}` |
| Acceso anónimo `X#_.f` | Cualquier record nativo (la exportación **no** se comprueba, como en el runtime de OTP) | `{badrecord, X}`; `{badfield, ...}` |
| Actualización local `X#r{...}` | Módulo `M`, nombre `r` | `{badrecord, X}`; campo desconocido `{badfield, ...}` |
| Actualización externa `X#m:r{...}` | Exportado, módulo `m`, nombre `r` | igual |
| Actualización anónima `X#_{...}` | Exportado o módulo `M` | igual |
| Patrón local `#r{...}` | Módulo `M`, nombre `r`, todos los campos enumerados presentes | no encaja |
| Patrón externo `#m:r{...}` | Módulo `m`, nombre `r`; exportado cuando se enumera un campo | no encaja |
| Patrón anónimo `#_{...}` | Cualquier record nativo; exportado o módulo `M` cuando se enumera un campo | no encaja |

- La construcción evalúa los campos dados en orden de código fuente (los
  valores por defecto son literales); una actualización evalúa primero el
  record y después los nuevos valores en orden de código fuente, a diferencia
  de una actualización de record de tupla. Las actualizaciones vacías también
  comprueban.
- Guards: solo el acceso a campos (un fallo hace fallar el guard) e
  `is_record`. La construcción en un guard da `creating a record in a guard is
  only supported for tuple records`; la actualización da
  `illegal guard expression`.
- `is_record(X)` solo es verdadero para records nativos. `is_record(X, r)` con
  un `r` nativo local comprueba el módulo `M` y el nombre `r`; con `r` importado
  de `m` comprueba el módulo `m`. `is_record(X, m, r)` con átomos comprueba
  módulo y nombre; con un entero es la prueba de tupla.
- Los records nativos no son tuplas: `is_tuple` es falso; los servicios de
  elemento y tamaño los rechazan.

## Reglas en tiempo de compilación

Los mensajes siguen a `erl_lint`:

- Los valores por defecto deben ser literales tras el plegado de constantes
  (números, átomos, cadenas, `[]`, conses/tuplas/maps de ellos, binaries solo de
  cadenas): `illegal default value for field a in native record r`.
- Construcción local sin valor para un campo sin valor por defecto:
  `field a is not initialized in native record r`; campo desconocido:
  `field zz undefined in record r`. Los campos desconocidos en accesos,
  actualizaciones y patrones se aceptan (OTP solo advierte); fallan en tiempo
  de ejecución.
- El índice `#r.a`, `record_info/2`, los inicializadores `_ = V` y los
  refinamientos de tipo de campo son exclusivos de los records de tupla, con
  los mensajes de OTP.
- Un nombre es o bien un record de tupla, o un record nativo, o un record
  importado; los conflictos y las formas `-export_record`/`-import_record`
  incorrectas son errores. `-export_record` debe preceder a las definiciones de
  funciones.
- Las formas externas que nombran un módulo ajeno al lote, un record no definido
  o no exportado se compilan y fallan en tiempo de ejecución como en OTP. La
  construcción externa se resuelve contra el lote en tiempo de compilación: el
  módulo importador hace él mismo el lowering de los valores por
  defecto literales del módulo que lo define y referencia su descriptor
  exportado; los campos
  desconocidos lanzan `badfield` antes de que un valor ausente lance `novalue`
  (`ErrorReason` 21).

## Impresión y orden

- `erlang:display/1` imprime `#m:r{a=1,b=2}`: sin espacios, campos en orden de
  definición. OTP imprime los campos en orden de índice de la tabla de átomos,
  que depende del orden de creación de los átomos y no es reproducible; es una
  diferencia registrada, como con las claves de map.
- Orden de términos: tupla < record nativo < map. Los records se comparan por
  módulo, nombre, indicador de exportación (false primero), número de campos,
  nombres de campo en orden de definición y después valores en orden de
  definición. `=:=` exige además el mismo orden de campos; `==` compara los
  valores numéricamente (el compilador de OTP pliega algunos `==` sobre records
  a `=:=`; se sigue la regla del runtime).

## Diferencias que se mantienen

| OTP | Clause |
| --- | --- |
| El orden de campos de `display` sigue los índices de átomo | Orden de definición |
| La construcción externa de un módulo no cargado falla hasta que se carga | Todos los módulos del lote se cargan al arrancar; un módulo ajeno al lote siempre falla |
| El compilador puede plegar `==` entre records a `=:=` (`#r{a=1} == #r{a=1.0}` es false) | `==` del runtime (true) |
| Campos desconocidos en accesos/actualizaciones/patrones, construcción cualificada del propio módulo sin valores, records sin usar o definidos en cabeceras: advertencias | Sin advertencias |
