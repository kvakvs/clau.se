---
source: docs/features.md
sourceCommit: 6ed3851c
sourceSha256: bdb726e4ca520adf0644572e0d808482745802ff3316d535cdb5ea6178e5a0a8
translatedAt: 2026-10-15
---
# Notificación de funcionalidades diferidas

El Erlang legal que necesita una funcionalidad no implementada falla con un
único mensaje explícito, distinto de los errores ordinarios de entrada no
válida. La alternativa genérica soportada (por ejemplo, la especialización
omitida) es silenciosa y no constituye un fallo.

```text
[pattern matching] notimpl: src/example.erl:12:5 [module="example"] [target="native"] [operation="match argument"]
```

## Catálogo

[features.hpp](../abi/include/clause/abi/features.hpp) asigna identificadores
estables y nunca reutilizados y nombres de diagnóstico, con responsable y estado
por entrada. Una entrada se retira o se refina cuando llega su funcionalidad; su
identificador queda reservado.

| Responsable | Dónde informa |
| --- | --- |
| Análisis semántico del compilador | Comprobaciones de capacidad sobre todas las funciones, incluido el código no usado |
| Lowering del compilador | Rechazo defensivo en las operaciones alcanzadas; descarta los artefactos preparados |
| Driver | `-o/--output` [enlaza](executables.md#linking) las entradas posicionales o un destino de proyecto; las compilaciones de proyectos enlazan cada destino ejecutable en su [`output`](projects.md#executables) del manifiesto |
| Servicios del runtime | Véanse los [servicios diferidos del runtime](runtime.md#deferred-services) |

## Reglas de los mensajes

- El [formateador](../abi/include/clause/abi/feature_diagnostic.hpp) compartido
  omite el contexto desconocido, escapa los bytes de control como `\xHH` y
  escapa las comillas y las barras invertidas para que el contexto no pueda
  inyectar líneas. Se conserva UTF-8.
- Exactamente un mensaje por operación fallida, con independencia de
  `--verbose`.
- Una característica diferida que el compilador pudiera omitir sin cambiar lo
  que acepta se informaría como advertencia y la compilación continuaría;
  ninguna lo hace hoy (`parse transforms` lo hacía hasta que el plan step 73F
  las aplicó, véase [transforms](transforms.md)). `codegen_placeholders`
  comprueba un mensaje por cada característica diferida del compilador.
- Compilador: [reject_feature](../compiler/src/codegen/features.hpp) informa del
  primer fallo de un lote, retiene el fallo, descarta la salida preparada y marca
  el diagnóstico como `reported` para que los drivers no lo vuelvan a imprimir.
- Runtime: [FeatureFailure](../runtime/include/clause/runtime/features.hpp)
  informa una vez por operación a través de un receptor prestado (null →
  stderr). Las llamadas posteriores devuelven el estado retenido. Los fallos del
  receptor o del formateo se convierten en `diagnostic_failure`; las excepciones
  quedan contenidas.
- Los llamadores propagan el fallo sin volver a informar; un anfitrión debería
  terminar con un código distinto de cero y desmontarse normalmente.
