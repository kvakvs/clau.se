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
    cookies: "Cookies",
  },
  home: {
    title: "Erlang/OTP 29, compilado a código nativo",
    intro:
      "Clause es un compilador anticipado (AOT) para Erlang. Preprocesa, analiza sintáctica y semánticamente el código Erlang, lo compila mediante LLVM y enlaza ejecutables nativos con su propio runtime: procesos ligeros en varios hilos planificadores, paso de mensajes, puertos y recolección de basura por proceso.",
    status:
      "En desarrollo: un subconjunto creciente de Erlang y de stdlib de OTP se compila a ejecutables nativos que ya se ejecutan en Windows y Linux. Pendiente: macOS con Apple Silicon y hardware ARM nativo, los propios conjuntos de pruebas de OTP y más optimización. La página de benchmarks muestra la posición de Clause frente a OTP; la documentación indica qué funciona y en qué difiere Clause.",
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
        text: "Procesos ligeros con sus propios montículos y recolección de basura en varios hilos planificadores, con receive selectivo, enlaces y monitores.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "Biblioteca de OTP",
        text: "Módulos propios de Clause para stdlib, kernel y ERTS con las exportaciones, los resultados y los errores de OTP 29, desde lists y maps hasta tablas ETS y archivos dets que OTP puede abrir.",
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
          "Inferencia de tipos con tipos de función por cláusula; se notifican las especificaciones que los contradicen",
          "LLVM O0, O2 y Os; objetos, IR y bitcode por módulo; listados de IR y ensamblador anotados con el código Erlang",
          "Rutas rápidas en línea para asignación de memoria, comprobaciones de tipos, acceso a tuplas, listas y maps, binaries, cierres y aritmética de flotantes",
          "O2 elimina las comprobaciones de tipo demostradas por la inferencia y selecciona variantes especializadas por tipo",
          "Optimización en tiempo de enlace entre módulos con --lto; se omiten de los ejecutables las exportaciones inalcanzables",
          "Llamadas de cola reales y recursión profunda en una pila explícita por proceso",
          "Un mensaje notimpl explícito para Erlang válido que requiere una característica aún no implementada",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Biblioteca de runtime en C++23 sin LLVM, enlazada en cada programa",
          "Todos los tipos de términos de Erlang, incluidos los enteros de precisión arbitraria",
          "Procesos, mensajes, receive selectivo, enlaces, monitores, nombres registrados y temporizadores en varios hilos planificadores",
          "Montículos por proceso con un recolector de basura por copia, binaries compartidos fuera del montículo y límites de memoria opcionales",
          "Puertos para archivos, E/S estándar, subprocesos y sockets TCP/UDP en un único hilo de E/S basado en eventos",
          "Tablas ETS concurrentes en C++",
        ],
      },
      {
        id: "library",
        title: "Biblioteca de OTP",
        items: [
          "Versiones propias de Clause de los módulos de OTP 29 con las listas de exportaciones, los resultados y los motivos de error de OTP; las funciones aún no implementadas lanzan not_implemented",
          "stdlib: lists, maps, string, unicode, binary, io_lib, json, rand, calendar, los módulos de colecciones, sofs, graph y digraph",
          "ets con especificaciones de coincidencia y archivos de tablas, dets con archivos idénticos byte a byte a los que escribe OTP, y ms_transform",
          "re sobre PCRE2, zlib y el módulo erlang",
          "kernel: file, gen_tcp, gen_udp, inet, os y code",
          "Los módulos de ERTS que llaman kernel y stdlib de OTP",
        ],
      },
      {
        id: "tooling",
        title: "Proyectos y herramientas",
        items: [
          "Proyectos TOML con objetivos con nombre, descubrimiento de fuentes y opciones por objetivo",
          "Cachés de compilación SQLite para los resultados de compilación, la salida de los parse transforms y los resultados de la inferencia",
          "Proyectos iniciales comentados con clau --new-project",
          "Un solo comando clau del código Erlang a un ejecutable nativo; los escripts también se compilan",
          "Tablas de líneas de depuración con -g (CodeView o DWARF 5) y perfilado opcional con --profile",
          "Probado frente al Erlang/OTP de referencia, con ejecuciones con sanitizers en Linux y benchmarks frente a OTP",
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
        text: "Requisitos: CMake, un compilador de C++23, Clang, el SDK de LLVM 23, Boost y toml++; CMake descarga las demás bibliotecas. Erlang/OTP es opcional.",
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
    kernelInfo: {
      "datagen.list_of_tuples":
        "Construye una lista de 200 000 tuplas pequeñas",
      "datagen.list_to_tuple":
        "Convierte listas de 1000 elementos en tuplas, 100 veces",
      "datagen.map_put": "Inserta 2000 claves enteras en un map, una a una",
      "datagen.binary_append":
        "Añade 10 000 enteros de 32 bits a un binary creciente",
      "datagen.bigint_factorial":
        "Calcula el factorial de 3000 con enteros grandes",
      "datagen.string_build":
        "Construye 20 000 cadenas a partir de enteros y átomos",
      "dataproc.sort": "Ordena una lista de 20 000 enteros aleatorios",
      "dataproc.map_foldl": "Aplica map y luego fold a 20 000 enteros",
      "dataproc.map_update":
        "Incrementa dos veces cada valor de un map de 500 claves",
      "dataproc.binary_match":
        "Suma 20 000 enteros de 32 bits extraídos de un binary",
      "dataproc.int_to_list": "Convierte 20 000 enteros en cadenas y de vuelta",
      "dataproc.term_to_binary":
        "Codifica y decodifica un término anidado grande",
      "dataproc.comprehension":
        "Comprehension que filtra y duplica 20 000 enteros",
      "dataproc.small_map": "Actualiza 20 000 veces un map de estado pequeño",
      "file.small_files": "Escribe, relee y borra 500 archivos pequeños",
      "file.large_write": "Escribe un archivo de 16 MB en bloques de 64 KB",
      "file.large_read": "Lee un archivo de 16 MB en bloques de 64 KB",
      "file.read_line":
        "Lee línea a línea un archivo de texto de 20 000 líneas",
      "file.read_file": "Lee un archivo entero de 16 MB en una sola llamada",
      "gc.short_processes":
        "Lanza 5000 procesos efímeros que generan basura cada uno",
      "gc.grow_shrink":
        "Hace crecer el heap con una lista de 200 000 elementos y la suelta",
      "gc.long_lived_churn":
        "Mantiene una ventana deslizante de datos vivos entre basura",
      "gc.explicit_collect":
        "Fuerza la recolección de basura con 10 000 tuplas vivas",
      "msg.ping_pong": "Rebota un mensaje entre dos procesos 50 000 veces",
      "msg.fan_in": "100 procesos envían 1000 mensajes cada uno a uno solo",
      "msg.ring": "Pasa un testigo 50 vueltas por un anillo de 1000 procesos",
      "msg.large_message":
        "Envía una lista de 100 000 elementos a otro proceso y de vuelta",
      "socket.tcp_echo":
        "Hace eco de 2000 mensajes de 1 KB por TCP en loopback",
      "socket.tcp_connect": "Abre y cierra 300 conexiones TCP en loopback",
      "socket.udp_round_trip":
        "Rebota un datagrama de 1 KB 2000 veces por UDP en loopback",
    },
    programInfo: {
      bench_datagen:
        "Construye en masa listas, tuplas, maps, binaries y enteros grandes",
      bench_dataproc:
        "Ordenación, fold, actualización de maps, matching de binaries y conversiones",
      bench_file:
        "Escritura y lectura de archivos pequeños y grandes, lectura por líneas",
      bench_gc: "Procesos efímeros, heap que crece y encoge, datos vivos",
      bench_msg:
        "Ping-pong, fan-in, anillo de procesos y copia de mensajes grandes",
      bench_socket: "Eco TCP, conexiones TCP e idas y vueltas UDP en loopback",
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
    sizesTitle: "Tamaño de los ejecutables",
    sizesNote:
      "Tamaño en megabytes de los programas de prueba tal como Clause los compila en cada nivel de optimización.",
    sizesHistoryNote:
      "Tamaños con -O2 de los últimos {count} commits medidos, del más antiguo al más reciente. Cada ejecución compila también una línea base, el commit anterior de Clause (el commit más reciente con al menos un día de antigüedad respecto a HEAD, o el indicado con --baseline), con -O2 para detectar regresiones; las líneas base aparecen aquí como commits propios. La tabla siguiente añade el total de todos los programas bench_* y el tamaño del compilador clau.",
    sizesTotal: "Todos los programas bench_*",
    megabytes: "{value} MB",
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
  cookies: {
    banner:
      "Este sitio cuenta las visitas con Google Analytics, que solo instala cookies si se aceptan.",
    accept: "Aceptar",
    decline: "Rechazar",
    policyLink: "Política de cookies",
    title: "Política de cookies",
    intro:
      "clau.se cuenta las visitas con Google Analytics para saber qué páginas se leen. Google Analytics se carga y sus cookies se instalan solo después de aceptarlas; hasta entonces, o si se rechazan, no se envía nada a Google.",
    choiceTitle: "Su elección",
    choice:
      "Rechazarlas no cambia nada en el sitio. La elección puede cambiarse en cualquier momento; al retirar el consentimiento se borran las cookies de analítica.",
    current: "Elección actual: {state}",
    granted: "aceptadas",
    denied: "rechazadas",
    unset: "sin elegir",
    storedTitle: "Qué se almacena",
    name: "Nombre",
    purpose: "Finalidad",
    duration: "Duración",
    rows: [
      {
        name: "_ga",
        purpose: "Cookie de Google Analytics: distingue a los visitantes",
        duration: "2 años",
      },
      {
        name: "_ga_8Y3XJHBHPB",
        purpose: "Cookie de Google Analytics: mantiene el estado de una visita",
        duration: "2 años",
      },
      {
        name: "analytics-consent",
        purpose:
          "Almacenamiento local del navegador: la elección sobre cookies",
        duration: "Hasta que se borre",
      },
      {
        name: "theme, locale",
        purpose:
          "Almacenamiento local del navegador: el tema de color y el idioma elegidos",
        duration: "Hasta que se borre",
      },
    ],
    googleTitle: "Google Analytics",
    google:
      "Google Analytics es un servicio de Google. Con el consentimiento recibe las páginas visitadas, la página de referencia, el tipo de navegador y de dispositivo y una ubicación aproximada derivada de la dirección IP.",
    googleLink: "Cómo usa Google esta información",
    contact: "Preguntas sobre esta política:",
  },
  notFound: {
    title: "Página no encontrada",
    home: "Ir a la página de inicio",
  },
} satisfies Messages;
