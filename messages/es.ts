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
        text: "Preprocesa y analiza código fuente Erlang/OTP 29, records nativos incluidos.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "Backend LLVM",
        text: "Compila mediante LLVM con O2, con optimización en tiempo de enlace entre módulos.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Ejecutables nativos",
        text: "Un comando del código fuente Erlang a un programa autónomo. Escripts también.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Procesos Erlang",
        text: "Procesos ligeros con recolección de basura por proceso en varios hilos planificadores.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "Biblioteca de OTP",
        text: "stdlib y kernel propios de Clause con las exportaciones, los resultados y los errores de OTP 29.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Puertos y E/S",
        text: "Archivos, subprocesos y sockets TCP/UDP en un único hilo de E/S basado en eventos.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Inferencia de tipos",
        text: "Con O2, los tipos inferidos eliminan comprobaciones en tiempo de ejecución y seleccionan código especializado.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Ejecuta parse transforms durante la compilación; los ejecutables nunca necesitan OTP.",
      },
      {
        id: "targets",
        property: "7 plataformas",
        title: "Multiplataforma",
        text: "Funciona en Windows x64 y Linux x86-64; objetos para siete plataformas.",
      },
    ],
    detailsTitle: "Características en detalle",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Sintaxis de Erlang/OTP 29: records, maps, bitstrings, comprehensions, tipos y especificaciones",
          "Macros, includes y compilación condicional",
          "Parse transforms en un Erlang/OTP 29 del host, incluidos ms_transform y qlc",
        ],
      },
      {
        id: "language",
        title: "Semántica de Erlang",
        items: [
          "Coincidencia de patrones y guardas en cláusulas, case, if y receive",
          "Records, funs, maybe y comprehensions de listas, binarios y maps",
          "Excepciones con try, catch y trazas de pila",
        ],
      },
      {
        id: "compiler",
        title: "Compilador",
        items: [
          "Inferencia de tipos con tipos de función por cláusula",
          "LLVM O0, O2 y Os, con optimización en tiempo de enlace entre módulos",
          "O2 elimina las comprobaciones de tipos que la inferencia demuestra",
          "Llamadas de cola propias y recursión profunda",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Runtime en C++23 con todos los tipos de términos de Erlang, incluidos enteros de precisión arbitraria",
          "Procesos, receive selectivo, enlaces, monitores y temporizadores en varios planificadores",
          "Montículos por proceso con un recolector de basura por copia",
          "Tablas ETS concurrentes en C++",
        ],
      },
      {
        id: "library",
        title: "Biblioteca de OTP",
        items: [
          "Módulos OTP 29 propios de Clause con las exportaciones, los resultados y los motivos de error de OTP",
          "stdlib: lists, maps, string, binary, json, rand y los módulos de colecciones",
          "ets, dets con archivos tal como OTP los escribe, re y zlib",
          "kernel: file, gen_tcp, gen_udp, inet y os",
        ],
      },
      {
        id: "tooling",
        title: "Proyectos y herramientas",
        items: [
          "Un solo comando clau del código fuente Erlang a un ejecutable nativo",
          "Proyectos TOML con cachés de compilación SQLite",
          "Información de depuración con -g (CodeView o DWARF 5) y perfilado con --profile",
          "Probado frente al Erlang/OTP de referencia y comparado con OTP en benchmarks",
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
        "Construye una lista de 200 000 tuplas pequeñas, 260 veces",
      "datagen.list_to_tuple":
        "Convierte listas de 1000 elementos en tuplas, 170 000 veces",
      "datagen.map_put":
        "Inserta 2000 claves enteras en un map, una a una, 4900 veces",
      "datagen.binary_append":
        "Añade 10 000 enteros de 32 bits a un binary creciente, 23 000 veces",
      "datagen.bigint_factorial":
        "Calcula el factorial de 3000 con enteros grandes, 330 veces",
      "datagen.string_build":
        "Construye 20 000 cadenas a partir de enteros y átomos, 1000 veces",
      "dataproc.sort":
        "Ordena una lista de 20 000 enteros aleatorios, 600 veces",
      "dataproc.map_foldl":
        "Aplica map y luego fold a 20 000 enteros, 4500 veces",
      "dataproc.map_update":
        "Incrementa cada valor de un map de 500 claves, 24 000 veces",
      "dataproc.binary_match":
        "Suma 20 000 enteros de 32 bits extraídos de un binary, 49 000 veces",
      "dataproc.int_to_list":
        "Convierte 20 000 enteros en cadenas y de vuelta, 2000 veces",
      "dataproc.term_to_binary":
        "Codifica y decodifica un término anidado grande, 4300 veces",
      "dataproc.comprehension":
        "Comprehension que filtra y duplica 20 000 enteros, 15 000 veces",
      "dataproc.small_map":
        "Actualiza 80 millones de veces un map de estado pequeño",
      "file.small_files":
        "Escribe, relee y borra 500 archivos pequeños, 11 veces",
      "file.large_write":
        "Escribe un archivo de 16 MB en bloques de 64 KB, 200 veces",
      "file.large_read":
        "Lee un archivo de 16 MB en bloques de 64 KB, 370 veces",
      "file.read_line":
        "Lee línea a línea un archivo de texto de 20 000 líneas, 52 veces",
      "file.read_file":
        "Lee un archivo entero de 16 MB en una sola llamada, 330 veces",
      "gc.short_processes":
        "Lanza 5000 procesos efímeros que generan basura cada uno, 69 veces",
      "gc.grow_shrink":
        "Hace crecer el heap con una lista de 200 000 elementos y la suelta, 300 veces",
      "gc.long_lived_churn":
        "Mantiene una ventana deslizante de 10 000 elementos vivos entre basura, 370 veces",
      "gc.explicit_collect":
        "Fuerza la recolección de basura con 10 000 tuplas vivas, 5100 veces",
      "msg.ping_pong":
        "Rebota un mensaje entre dos procesos 2 millones de veces",
      "msg.fan_in":
        "100 procesos envían 1000 mensajes cada uno a uno solo, 25 veces",
      "msg.ring": "Pasa un testigo 3050 vueltas por un anillo de 1000 procesos",
      "msg.large_message":
        "Envía una lista de 100 000 elementos a otro proceso y de vuelta, 560 veces",
      "socket.tcp_echo":
        "Hace eco de 30 000 mensajes de 1 KB por TCP en loopback",
      "socket.tcp_connect":
        "Abre 900 conexiones TCP en loopback con eco de 25 mensajes de 1 KB en cada una",
      "socket.udp_round_trip":
        "Rebota un datagrama de 1 KB 27 900 veces por UDP en loopback",
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
