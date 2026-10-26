---
source: docs/README.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: be550511f58d81353b8a28ffdeba68d3c2e49d69eb8cb6688c3867b834199234
translatedAt: 2026-10-26
---
# Documentación de Clause

Notas breves de referencia sobre la implementación actual. Cada archivo describe
el comportamiento y los límites que existen hoy; los planes y el historial de
pasos se encuentran en `.agents/`.

| Tema | Documento |
| --- | --- |
| Compilación de Clause: requisitos, presets, opciones de configuración, pruebas, control de calidad, benchmarks | [building.md](building.md) |
| Preprocesamiento (comportamiento de `epp`, inclusiones, macros, características) | [preprocessor.md](preprocessor.md) |
| Análisis sintáctico, propiedad del AST, límites de sintaxis | [parser.md](parser.md) |
| Proyectos TOML, selección de objetivos, directorio de compilación y cachés, fuentes ignorados | [projects.md](projects.md) |
| CLI del compilador, artefactos, impresión del código fuente y del formato abstracto, caché de compilación, SDK de LLVM, PCRE2 y zlib, ejemplo | [compile.md](compile.md) |
| Especificaciones ASN.1: entradas `.asn` y `[[targets.asn1]]`, opciones de asn1ct, cobertura, módulos generados | [asn1.md](asn1.md) |
| Punto de entrada del ejecutable, argumentos, código de salida, flujos de salida, enlazado | [executables.md](executables.md) |
| Información de depuración (`-g`), depuradores y la pila de llamadas de Erlang | [debugging.md](debugging.md) |
| Perfilado opcional (`--profile FILE`): entradas y tiempo propio por función y proceso | [profiling.md](profiling.md) |
| Parse transforms: cargador OTP del anfitrión, intercambio del formato abstracto, búsqueda de transformaciones | [transforms.md](transforms.md) |
| Análisis semántico, tipos, inferencia, vinculaciones | [semantic.md](semantic.md) |
| Especialización por tipos en `-O2`: demostraciones y variantes de representación | [specialization.md](specialization.md) |
| ABI del código generado: términos, símbolos, registro, fallos, raíces | [abi.md](abi.md) |
| Patrones, cláusulas, coincidencias en el cuerpo y comprehensions | [patterns.md](patterns.md) |
| Guards y el catálogo de BIF de guard | [guards.md](guards.md) |
| Representaciones de términos (átomos, números, contenedores, maps, bits, records) e impresión | [terms.md](terms.md) |
| Records nativos, cualificados y anónimos (OTP 29) | [native-records.md](native-records.md) |
| Valores de función: `fun F/A`, `fun M:F/A`, clausuras, funs con nombre, llamadas dinámicas | [funs.md](funs.md) |
| Builtins de producción: catálogo, llamadas puente, builtins de módulo, porciones, registro | [builtins.md](builtins.md) |
| Ciclo de vida del runtime, memoria, servidor de código, términos persistentes, hilos, salida estándar, arranque | [runtime.md](runtime.md) |
| Procesos: hilos de trabajo del planificador, mensajes y receive, enlaces, monitores, nombres registrados, temporizadores, introspección, alias, señales de salida | [processes.md](processes.md) |
| Puertos: identidad, tabla de puertos, drivers, modos de datos, el hilo de E/S, puertos ocupados, subprocesos, E/S estándar, archivos y sockets | [ports.md](ports.md) |
| Contrato del heap de proceso: disposición de palabras, áreas, admisión, raíces, recolección | [runtime-heap.md](runtime-heap.md) |
| Modelo de ejecución: marcos, llamadas, llamadas de cola, cesión, excepciones | [execution-model.md](execution-model.md) |
| Notificación de características diferidas (`notimpl`) | [features.md](features.md) |
| Referencia fijada del código fuente de OTP y procedimiento de actualización | [otp-reference.md](otp-reference.md) |
| Diferencias de comportamiento conocidas respecto a Erlang/OTP | [differences.md](differences.md) |
| Línea base de validación, modos de prueba, carencias de plataforma, benchmarks, historial | [validation.md](validation.md) |

Los registros de validación anteriores por paso y la evidencia en JSON se
condensaron en el [historial de validación](validation.md#history); los
originales completos permanecen en el historial de Git (presentes por última vez
en el commit `2777c98`).

## Bibliotecas

Aplicaciones OTP propias de Clause en `library/`, en [libraries/](libraries).

| Tema | Documento |
| --- | --- |
| Módulos de biblioteca de `library/{erts,kernel,stdlib}` compilados con los programas, cómo los obtienen los programas, módulos disponibles y ausentes | [library.md](library.md) |
| Salida de consola: `io:format`, `io:put_chars`, dispositivos, controles de formato, disposición de `~p` | [io.md](io.md) |
| Criptografía: versiones y fuentes de OpenSSL, compilación, enlazado, modo FIPS y programas FIPS fijados | [crypto.md](crypto.md) |
| public_key: especificaciones ASN.1 y sus fuentes, módulos generados, `public_key.hrl` | [public_key.md](public_key.md) |
