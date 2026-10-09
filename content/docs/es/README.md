---
source: docs/README.md
sourceCommit: 06042fa
sourceSha256: f48733b2827bbf09b77162c249d6b913411b1f3a60e76cf52b281ba68666f65b
translatedAt: 2026-10-09
---
# Documentación de Clause

Notas breves de referencia sobre la implementación actual. Cada archivo describe
el comportamiento y los límites que existen hoy; los planes y el historial de
pasos se encuentran en `.agents/`.

| Tema | Documento |
| --- | --- |
| Preprocesamiento (comportamiento de `epp`, inclusiones, macros, características) | [preprocessor.md](preprocessor.md) |
| Análisis sintáctico, propiedad del AST, límites de sintaxis | [parser.md](parser.md) |
| Proyectos TOML y selección de objetivos | [projects.md](projects.md) |
| CLI del compilador, artefactos, SDK de LLVM, ejemplo | [compile.md](compile.md) |
| Punto de entrada del ejecutable, argumentos, código de salida, flujos de salida, enlazado | [executables.md](executables.md) |
| Análisis semántico, tipos, inferencia, vinculaciones | [semantic.md](semantic.md) |
| Política de especialización por tipos | [specialization.md](specialization.md) |
| ABI del código generado: términos, símbolos, registro, fallos, raíces | [abi.md](abi.md) |
| Patrones, cláusulas y coincidencias en el cuerpo | [patterns.md](patterns.md) |
| Guards y el catálogo de BIF de guard | [guards.md](guards.md) |
| Representaciones de términos (átomos, números, contenedores, maps, bits, records) e impresión | [terms.md](terms.md) |
| Records nativos, cualificados y anónimos (OTP 29) | [native-records.md](native-records.md) |
| Valores de función: `fun F/A`, `fun M:F/A`, llamadas a funs | [funs.md](funs.md) |
| Builtins de producción: catálogo, llamadas puente, funs builtin, registro | [builtins.md](builtins.md) |
| Módulos de biblioteca (subconjuntos de `lists`, `maps`) compilados con los programas | [library.md](library.md) |
| Salida de consola: `io:format/1,2`, `io:put_chars/1`, disposición de `~p` | [io.md](io.md) |
| Ciclo de vida del runtime, memoria, salida estándar, servidor de código, contabilidad del planificador | [runtime.md](runtime.md) |
| Procesos: workers del planificador, porciones de tiempo, `spawn/1,3`, `is_process_alive/1`, enlaces, señales de salida, monitores, nombres registrados | [processes.md](processes.md) |
| Puertos: identidad, tabla de puertos, drivers, modos de datos, el hilo de E/S, E/S estándar, archivos y sockets (decisión del plan step 57A) | [ports.md](ports.md) |
| Contrato del heap de proceso: disposición de palabras, áreas, admisión, raíces, recolección | [runtime-heap.md](runtime-heap.md) |
| Decisión sobre el modelo de ejecución: marcos, llamadas, llamadas de cola, cesión, excepciones | [execution-model.md](execution-model.md) |
| Notificación de características diferidas (`notimpl`) | [features.md](features.md) |
| Referencia fijada del código fuente de OTP y procedimiento de actualización | [otp-reference.md](otp-reference.md) |
| Diferencias de comportamiento conocidas respecto a Erlang/OTP | [differences.md](differences.md) |
| Línea base de validación, modos de prueba, carencias de plataforma, historial | [validation.md](validation.md) |

Los registros de validación anteriores por paso y la evidencia en JSON se
condensaron en el [historial de validación](validation.md#history); los
originales completos permanecen en el historial de Git (presentes por última vez
en el commit `2777c98`).
