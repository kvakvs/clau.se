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
    benchmarks: "Benchmarks",
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
    updated: "Actualizado",
  },
  home: {
    title: "Erlang/OTP 29, compilado a código nativo",
    intro:
      "Clause es un compilador anticipado (AOT) para Erlang. Preprocesa, analiza sintáctica y semánticamente el código Erlang, lo compila mediante LLVM y enlaza ejecutables nativos con su propio runtime: procesos ligeros en varios hilos planificadores, paso de mensajes, puertos y recolección de basura por proceso.",
    status:
      "En desarrollo: un subconjunto creciente de Erlang ya se compila a ejecutables nativos y se ejecuta en Windows y Linux, con versiones de Clause de la mayoría de los módulos de runtime que llaman kernel y stdlib de OTP. Pendiente: validación en macOS con Apple Silicon y en hardware ARM nativo, comparaciones más amplias con los propios conjuntos de pruebas de OTP y más optimización; la página de benchmarks muestra la posición de Clause frente a OTP. La documentación indica qué funciona y en qué difiere Clause de Erlang/OTP.",
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
        text: "Compila a LLVM IR verificado, bitcode u objetos nativos con O0, O2 u Os, con optimización opcional en tiempo de enlace entre módulos.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Ejecutables nativos",
        text: "Enlaza módulos Erlang, el subconjunto de la biblioteca que usan y el runtime en un programa autónomo con Clang, en un solo comando. Los escripts también se compilan.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Procesos Erlang",
        text: "Procesos con su propio heap y recolección de basura, en colas de ejecución por worker repartidas entre hilos planificadores, con receive selectivo, tiempos de espera, enlaces, monitores y nombres registrados.",
      },
      {
        id: "library",
        property: "re · zlib · binary",
        title: "Módulos de biblioteca de OTP",
        text: "Builtins de runtime para binary, math, unicode, persistent_term, atomics y counters, re sobre PCRE2 y zlib, con los resultados y errores de OTP 29.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Puertos y E/S",
        text: "Archivos, entrada y salida estándar, subprocesos y sockets TCP/UDP mediante puertos, atendidos por un único hilo de E/S basado en eventos.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Inferencia de tipos",
        text: "Infiere tipos de función por cláusula; con O2 eliminan comprobaciones en tiempo de ejecución y seleccionan variantes especializadas por tipo con una alternativa genérica.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Aplica parse transforms como erlc, ejecutándolos durante la compilación en un Erlang/OTP 29 instalado en el host; los ejecutables nunca necesitan OTP.",
      },
      {
        id: "targets",
        property: "7 plataformas",
        title: "Multiplataforma",
        text: "Ejecución nativa validada en Windows x64 y Linux x86-64; runtime probado en x86 de 32 bits y, mediante emulación, en ARM. Objetos para siete plataformas, incluido Apple Silicon.",
      },
    ],
    detailsTitle: "Características en detalle",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Preprocesado: macros, include, include_lib (también desde directorios de aplicación con versión), compilación condicional y características del lenguaje",
          "Parse transforms ejecutados en un Erlang/OTP 29 del host, incluidos ms_transform y qlc de OTP; --print-abstr muestra las formas del formato abstracto",
          "Sintaxis de Erlang/OTP 29: expresiones, patrones, records, bitstrings, tipos y especificaciones, control de flujo y comprehensions",
          "Comprobación de sintaxis, salida del código expandido y vista indentada del árbol sintáctico",
          "Diagnósticos de código fuente en varios archivos de entrada",
        ],
      },
      {
        id: "language",
        title: "Semántica de Erlang",
        items: [
          "Coincidencia de patrones y guards en cláusulas de función, case, if, receive y coincidencias en el cuerpo",
          "maybe y comprehensions de listas, binaries y maps",
          "Records con actualizaciones y record_info/2; records nativos, cualificados y anónimos",
          "Funs con capturas, funs con nombre, llamadas dinámicas y apply",
          "Excepciones: error, exit, throw, catch, try ... of ... catch ... after, y trazas de pila",
          "Atributos de módulo: comprobación de callbacks de -behaviour, -import, atributos informativos y module_info/0,1 generado",
        ],
      },
      {
        id: "compiler",
        title: "Compilador",
        items: [
          "Análisis semántico: comprobación del subconjunto, ligado de variables, resolución de llamadas, tipos declarados e inferidos",
          "Inferencia de tipos con tipos de función por cláusula; una especificación que contradice los tipos de argumento inferidos es un error de compilación; las demás contradicciones son advertencias",
          "La inferencia cubre solo el código que alcanza la función de entrada; los resultados para OTP y los directorios de biblioteca configurados se guardan en caché por módulo",
          "LLVM O0, O2 y Os; objetos, IR y bitcode por módulo; instantáneas de IR y listados de ensamblador anotados con el código Erlang",
          "El código generado asigna memoria, comprueba tipos, lee tuplas, listas y maps, construye y compara binaries, crea closures y realiza aritmética de flotantes en línea, y llama al runtime solo en las rutas lentas",
          "O2 elimina las comprobaciones de tipo y de forma demostradas por la inferencia, con variantes especializadas por tipo acotadas",
          "Optimización en tiempo de enlace entre módulos con --lto",
          "Los ejecutables omiten las exportaciones que su función de entrada no puede alcanzar; --keep-exports las conserva todas",
          "Informes de tipos: código fuente anotado con las firmas de función inferidas",
          "Llamadas de cola reales y recursión profunda en una pila explícita por proceso",
          "Un mensaje notimpl explícito para Erlang válido que requiere una característica aún no implementada",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Biblioteca de runtime en C++23 sin LLVM, enlazada en cada programa",
          "Enteros de precisión arbitraria, flotantes, átomos, tuplas, listas, maps, bitstrings, records, funs, pids, puertos y referencias",
          "Procesos, mensajes, receive selectivo, enlaces, monitores, nombres registrados y temporizadores en varios hilos planificadores, cada uno con su propia cola de ejecución",
          "Heaps por proceso con recolector de basura por copia, binarios y maps grandes fuera del heap, áreas de literales de módulo y límites de memoria opcionales",
          "Puertos para archivos, E/S estándar, subprocesos y sockets TCP/UDP en un único hilo de E/S basado en eventos",
          "El módulo erlang: diccionario de proceso, formato externo de términos con compresión, tiempo y temporizadores, introspección de procesos, opciones de spawn, alias y hashing",
          "Toda exportación de OTP 29 de un módulo de biblioteca de Clause se compila; las funciones aún no implementadas lanzan not_implemented al llamarlas",
          "io:format, io:fwrite e io:put_chars hacia cualquier dispositivo de E/S, con el formato ~p de OTP; subconjuntos de lists, maps, file, gen_tcp, gen_udp, inet, os y code",
          "Módulos binary, math, persistent_term, atomics y counters completos; conversiones de unicode",
          "re sobre PCRE2 y zlib, compilados a partir de las versiones de las bibliotecas que incluye OTP 29",
          "Versiones de Clause de los módulos de ERTS que llaman kernel y stdlib de OTP, como init, erts_internal, erl_prim_loader, prim_eval y unicode_util",
        ],
      },
      {
        id: "tooling",
        title: "Proyectos y herramientas",
        items: [
          "Proyectos TOML con objetivos con nombre, descubrimiento de fuentes, rutas de búsqueda, directorios y módulos ignorados, y opciones por objetivo",
          "Un directorio de compilación con cachés de compilación SQLite para los resultados de compilación, la salida de los parse transforms y los resultados de la inferencia",
          "Inspección con --print-inputs, --print-env y --print-stage-times",
          "Proyectos iniciales comentados con clau --new-project",
          "Un solo comando clau del código Erlang a un ejecutable nativo; los escripts también se compilan",
          "Tablas de líneas de depuración con -g (CodeView o DWARF 5) y perfilado opcional con --profile",
          "Comportamiento comprobado contra las salidas de Erlang/OTP de referencia",
          "Benchmarks de rendimiento frente al Erlang/OTP del host, ejecutados manualmente",
          "Ejecuciones con sanitizers de direcciones, de comportamiento indefinido y de hilos en Linux",
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
    englishOnly:
      "Esta página aún no está traducida, por eso se muestra en inglés.",
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
        text: "Opciones de línea de comandos, modos de inspección, ejecutables, proyectos TOML y parse transforms.",
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
  benchmarks: {
    title: "Benchmarks",
    intro:
      "Clause comparado con Erlang/OTP en una misma máquina: los mismos programas Erlang, compilados con erlc y con clau -O2, miden el tiempo de sus kernels tras una llamada de calentamiento. Estas cifras cambian con cada optimización.",
    geomean:
      "Media geométrica de los tiempos de los kernels, Clause -O2 frente al JIT de BEAM (OTP)",
    slowerOnAverage: "más lento de media",
    fasterOnAverage: "más rápido de media",
    barFaster: "más rápido",
    barSlower: "más lento",
    faster: "Kernels en los que Clause es más rápido",
    first: "Media geométrica el {date}, la primera ejecución registrada",
    kernelsTitle: "Tiempos de los kernels",
    kernelsNote:
      "Mediana de {runs} ejecuciones en milisegundos. La barra muestra el tiempo de Clause dividido por el de OTP en escala logarítmica.",
    noisy: "Las ejecuciones variaron más de la mitad de la mediana.",
    kernel: "Kernel",
    otp: "OTP JIT",
    clause: "Clause -O2",
    ratio: "Clause ÷ OTP",
    legendFaster: "Clause más rápido",
    legendSlower: "OTP más rápido",
    groups: {
      datagen: "Generación de datos",
      dataproc: "Procesamiento de datos",
      file: "E/S de archivos",
      gc: "Recolección de basura",
      msg: "Paso de mensajes",
      socket: "Sockets de loopback",
    },
    programsTitle: "Programas completos",
    programsNote:
      "Tiempo real en segundos, incluido el arranque, mediana de las ejecuciones.",
    program: "Programa",
    historyTitle: "Progreso",
    historyNote:
      "Media geométrica del tiempo de Clause dividido por el de OTP en cada día con ejecuciones registradas.",
    date: "Fecha",
    commit: "Commit",
    setupTitle: "Configuración",
    machine: "Máquina",
    cpus: "{count} CPU lógicas",
    otpVersion: "Erlang/OTP",
    clauseCommit: "Commit de Clause",
    runAt: "Ejecución",
    reproduce:
      "Para ejecutar los benchmarks, use make benchmark o make-benchmark.bat en el repositorio de Clause; las notas de benchmarks describen los programas y las opciones.",
    notes: "Notas de benchmarks",
  },
  resources: {
    title: "Recursos",
    intro: "Dónde encontrar el código fuente y seguir el desarrollo.",
    github: {
      title: "Repositorio en GitHub",
      text: "Código fuente, incidencias e historial de desarrollo.",
    },
    credits: "Créditos de arte",
  },
  notFound: {
    title: "Página no encontrada",
    home: "Ir a la página de inicio",
  },
} satisfies Messages;
