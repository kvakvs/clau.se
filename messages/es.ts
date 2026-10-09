import type { Messages } from "@/messages/en";

export const es = {
  meta: {
    description:
      "Clause compila Erlang/OTP 29 de forma anticipada mediante LLVM en ejecutables nativos.",
  },
  nav: {
    label: "Principal",
    home: "Inicio",
    docs: "Documentación",
    resources: "Recursos",
  },
  theme: {
    label: "Tema de color",
    light: "Claro",
    auto: "Auto",
    dark: "Oscuro",
  },
  language: {
    label: "Idioma",
  },
  footer: {
    tagline: "Erlang, compilado de antemano.",
  },
  home: {
    title: "Erlang/OTP 29, compilado a código nativo",
    intro:
      "Clause es un compilador anticipado (AOT) para Erlang. Preprocesa, analiza sintáctica y semánticamente el código Erlang, lo compila mediante LLVM y enlaza ejecutables nativos con su propio runtime: procesos ligeros, paso de mensajes y recolección de basura por proceso.",
    status:
      "En desarrollo: un subconjunto creciente de Erlang ya se compila y ejecuta. La documentación indica qué funciona y en qué difiere Clause de Erlang/OTP.",
    ctaDocs: "Leer la documentación",
    ctaSource: "Código en GitHub",
    cardsTitle: "Características",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Sintaxis moderna de Erlang",
        text: "Preprocesador y parser para Erlang/OTP 29: macros, records, records nativos, maps, bitstrings, comprehensions, maybe y especificaciones de tipos.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "Backend LLVM",
        text: "Compila a LLVM IR verificado, bitcode u objetos nativos con O0, O2 u Os, con variantes de funciones especializadas por tipo.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Ejecutables nativos",
        text: "Enlaza módulos Erlang y el runtime en un programa autónomo con Clang, en un solo comando.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Procesos Erlang",
        text: "Procesos en hilos planificadores con receive selectivo, tiempos de espera, enlaces, monitores, nombres registrados y señales de salida.",
      },
      {
        id: "memory",
        property: "GC por proceso",
        title: "Memoria aislada",
        text: "Cada proceso tiene su propio heap, gestionado por un recolector de basura por copia según el diseño clásico de ERTS.",
      },
      {
        id: "targets",
        property: "7 plataformas",
        title: "Multiplataforma",
        text: "Ejecución validada en Windows x64; objetos comprobados para Linux x86, x64, ARM y AArch64, Windows x86 y x64, y Apple Silicon.",
      },
    ],
    detailsTitle: "Características en detalle",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Preprocesado: macros, include, include_lib, compilación condicional y características del lenguaje",
          "Sintaxis de Erlang/OTP 29: expresiones, patrones, records, bitstrings, tipos y especificaciones, control de flujo y comprehensions",
          "Comprobación de sintaxis, salida del código expandido y vista indentada del árbol sintáctico",
          "Diagnósticos de código fuente en varios archivos de entrada",
        ],
      },
      {
        id: "compiler",
        title: "Compilador",
        items: [
          "Análisis semántico: comprobación del subconjunto, ligado de variables, resolución de llamadas, tipos declarados e inferidos",
          "LLVM O0, O2 y Os; objetos, IR y bitcode por módulo; instantáneas de IR anotadas con el código Erlang",
          "Informes de tipos: código fuente anotado con las firmas de función inferidas",
          "Llamadas de cola reales para llamadas locales, remotas y mutuamente recursivas",
          "Un mensaje notimpl explícito para Erlang válido que requiere una característica aún no implementada",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Biblioteca de runtime en C++23 sin LLVM, enlazada en cada programa",
          "Enteros de precisión arbitraria, flotantes, átomos, tuplas, listas, maps, bitstrings, records, funs, pids, puertos y referencias",
          "Procesos, mensajes, receive selectivo, enlaces, monitores y nombres registrados en hilos planificadores",
          "Heaps por proceso con recolector de basura por copia y binarios fuera del heap",
          "Puertos para E/S estándar, archivos, subprocesos y sockets",
          "Excepciones con try, catch y after, y trazas de pila",
          "io:format con el formato ~p de OTP; subconjuntos de lists, maps, file e io",
        ],
      },
      {
        id: "tooling",
        title: "Proyectos y herramientas",
        items: [
          "Proyectos TOML con objetivos con nombre, descubrimiento de fuentes y opciones por objetivo",
          "Proyectos iniciales comentados con clau --new-project",
          "Un solo comando clau del código Erlang a un ejecutable nativo",
          "Comportamiento comprobado contra las salidas de Erlang/OTP de referencia",
        ],
      },
    ],
  },
  docs: {
    title: "Documentación",
    notReady: "La documentación aún no está lista.",
    meanwhile:
      "Mientras tanto, puedes leer las notas de desarrollo del repositorio del proyecto. Describen la implementación actual y sus límites.",
    synced: "Sincronizado desde el commit",
    startHere: "Empieza aquí",
    reference: "Notas de referencia",
    notWritten: "Aún no está escrito. Mientras tanto, consulta:",
    allDocs: "Toda la documentación",
    englishOnly: "Esta página aún no está traducida, por eso se muestra en inglés.",
    outdated:
      "El original en inglés ha cambiado desde que se hizo esta traducción, por lo que partes de ella pueden estar desactualizadas.",
    translated: "Traducido del original en inglés",
    readEnglish: "Leer en inglés",
    featured: {
      gettingStarted: {
        title: "Primeros pasos",
        text: "Requisitos: CMake, un compilador de C++23, Clang, el SDK de LLVM, Boost y toml++.",
      },
      building: {
        title: "Compilar el compilador",
        text: "Configurar, compilar y probar con presets de CMake en Linux, macOS y Windows.",
      },
      using: {
        title: "Usar el compilador",
        text: "Opciones de línea de comandos, modos de inspección, ejecutables y proyectos TOML.",
      },
      interpreting: {
        title: "Cómo interpretar los resultados",
        text: "Probar Clause con código Erlang existente: qué compila hoy, qué significan los mensajes notimpl y qué probar a continuación.",
      },
      differences: {
        title: "Diferencias conocidas con Erlang/OTP",
        text: "Comportamiento observable en el que Clause difiere a sabiendas de OTP 29.",
      },
    },
  },
  resources: {
    title: "Recursos",
    intro: "Dónde encontrar el código fuente y seguir el desarrollo.",
    github: {
      title: "Repositorio en GitHub",
      text: "Código fuente, incidencias e historial de desarrollo.",
    },
  },
  notFound: {
    title: "Página no encontrada",
    home: "Ir a la página de inicio",
  },
} satisfies Messages;
