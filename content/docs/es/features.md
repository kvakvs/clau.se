---
source: docs/features.md
sourceCommit: a8c3f8f6
sourceSha256: c542e68489672ac575517c6517e5952bc91a1aa3d15f5b5da6474cffc0302f6e
translatedAt: 2026-10-17
---
# Notificación de características diferidas

El Erlang legal que necesita una característica no implementada falla con un
único mensaje explícito, distinto de los errores ordinarios de entrada no
válida. La alternativa genérica admitida (por ejemplo, una especialización
omitida) es silenciosa y no constituye un fallo.

```text
[pattern matching] notimpl: src/example.erl:12:5 [module="example"] [target="native"] [operation="match argument"]
```

## Catálogo

[features.hpp](../abi/include/clause/abi/features.hpp) asigna identificadores
estables y nunca reutilizados y nombres de diagnóstico, con responsable y estado
por entrada. Una entrada se retira o se refina cuando llega su característica;
su identificador queda reservado.

| Responsable | Dónde informa |
| --- | --- |
| Análisis semántico del compilador | Comprobaciones de capacidad sobre todas las funciones, incluido el código no usado |
| Lowering del compilador | Rechazo defensivo en las operaciones alcanzadas; descarta los artefactos preparados |
| Driver | Nada diferido: `executable linking` está implementado ([enlazado](executables.md#linking)) |
| Servicios del runtime | Véanse los [servicios diferidos del runtime](runtime.md#deferred-services) |

Características diferidas del compilador hoy, cada una cubierta por
`codegen_placeholders`:

| Característica | Ejemplo que la notifica |
| --- | --- |
| `heap expressions` | Asignaciones en comprehensions `compr_assign` (`[Y \|\| X <- L, Y = X]`) |
| `dynamic calls` | Un fun builtin de `apply` (`fun erlang:apply/2`) |
| `behavior-changing attributes` | `-on_load`, `-nifs`, opciones `-compile` no inertes, módulos parametrizados ([subconjunto aceptado](compile.md#accepted-source-subset)) |

## Reglas de los mensajes

- El [formateador](../abi/include/clause/abi/feature_diagnostic.hpp) compartido
  omite el contexto desconocido, escapa los bytes de control como `\xHH` y
  escapa las comillas y las barras invertidas para que el contexto no pueda
  inyectar líneas. Se conserva UTF-8.
- Exactamente un mensaje por operación fallida, con independencia de
  `--verbose`.
- Una característica diferida que el compilador pudiera omitir sin cambiar lo
  que acepta se notificaría como advertencia y la compilación continuaría;
  ninguna lo hace hoy. `codegen_placeholders` comprueba un mensaje por cada
  característica diferida del compilador.
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
