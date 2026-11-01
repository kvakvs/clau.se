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
      "Clause es un compilador anticipado (AOT) para Erlang. Preprocesa, analiza sintáctica y semánticamente el código Erlang, lo compila mediante LLVM y enlaza ejecutables nativos con su propio runtime: procesos ligeros en varios hilos planificadores, paso de mensajes, distribución, puertos y recolección de basura por proceso.",
    status:
      "En desarrollo: los programas Erlang/OTP 29 se compilan a ejecutables nativos que ya se ejecutan en Windows y Linux, con stdlib, kernel, crypto y ssl propios de Clause, y funcionan como nodos distribuidos que se conectan entre sí y con nodos OTP 29. Pendiente: macOS con Apple Silicon y hardware ARM nativo, los propios conjuntos de pruebas de OTP, las ubicaciones de archivo fuente y línea en las trazas de pila, rpc, global y pg entre nodos y más optimización; no se admite la carga de código en caliente. La página de benchmarks muestra la posición de Clause frente a OTP; la documentación indica qué funciona y en qué difiere Clause.",
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
        id: "benchmarks",
        property: "{ratio} {side}",
        title: "Velocidad frente a OTP",
        text: "Media geométrica de {count} kernels de prueba, Clause -O2 frente al JIT de BEAM.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Ejecutables nativos",
        text: "Un comando del código fuente Erlang a un programa autónomo, compilado mediante LLVM con optimización en tiempo de enlace. Escripts también.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Procesos Erlang",
        text: "Procesos ligeros con recolección de basura por proceso en varios hilos planificadores.",
      },
      {
        id: "library",
        property: "gen_server · ssl",
        title: "Biblioteca de OTP",
        text: "stdlib, kernel, crypto y ssl propios de Clause con las exportaciones, los resultados y los errores de OTP 29.",
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
        id: "distribution",
        property: "node@host",
        title: "Erlang distribuido",
        text: "Los nodos se conectan entre sí y con nodos OTP 29 mediante el protocolo de OTP: mensajes, enlaces, monitores y creación remota de procesos.",
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
          "Parse transforms sin instalar Erlang/OTP: ms_transform, qlc, merl y las propias",
          "Especificaciones ASN.1 compiladas en módulos como lo hace asn1ct: BER, DER, PER y UPER",
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
          "O2 integra en línea funciones locales pequeñas, funs conocidas y bucles de lists",
          "Llamadas de cola propias y recursión profunda",
          "Generación de código en paralelo en todos los hilos de hardware",
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
        id: "distribution",
        title: "Distribución",
        items: [
          "Nodos con nombre mediante --sname y --name, o net_kernel:start en tiempo de ejecución",
          "Handshake y cookies de OTP sobre TCP, IPv4 e IPv6",
          "Mensajes, enlaces, monitores, líderes de grupo y creación de procesos entre nodos",
          "Funciona con nodos OTP 29 en ambos sentidos",
          "epmd integrado, o clause-epmd como programa aparte",
        ],
      },
      {
        id: "library",
        title: "Biblioteca de OTP",
        items: [
          "Módulos OTP 29 propios de Clause con las exportaciones, los resultados y los motivos de error de OTP",
          "gen_server, gen_statem, gen_event, supervisor, application y logger",
          "stdlib: lists, maps, string, binary, json, re, rand y los módulos de colecciones",
          "ets, dets, disk_log, zip y erl_tar con archivos tal como OTP los escribe",
          "erl_scan, erl_parse, erl_lint, erl_eval, qlc y compile en tiempo de ejecución, con los módulos compilados interpretados",
          "syntax_tools: erl_syntax, erl_prettypr, epp_dodger y merl",
          "kernel: file, gen_tcp, gen_udp, inet, inet_res y os",
          "crypto sobre OpenSSL con modo FIPS; public_key con validación de rutas de certificados, CRL y OCSP",
          "ssl: conexiones TLS 1.2 y 1.3 sobre libssl de OpenSSL",
        ],
      },
      {
        id: "tooling",
        title: "Proyectos y herramientas",
        items: [
          "Un solo comando clau del código fuente Erlang a un ejecutable nativo",
          "Proyectos TOML con cachés de compilación SQLite",
          "Archivos vm.args y sys.config de releases, leídos como los lee el arranque de OTP",
          "Shell interactiva de Erlang con clau --shell",
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
        text: "Requisitos, una primera compilación y un primer programa: CMake 3.28+, un compilador de C++23 y Python 3; CMake busca o descarga LLVM 23 y las demás bibliotecas.",
      },
      building: {
        title: "Compilar el compilador",
        text: "Requisitos, presets y opciones de CMake, pruebas y benchmarks en Linux, macOS y Windows.",
      },
      using: {
        title: "Usar el compilador",
        text: "La línea de comandos de clau: opciones, artefactos, listados y la caché de compilación.",
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
      dist: "Distribución",
      file: "E/S de archivos",
      float: "Coma flotante",
      gc: "Recolección de basura",
      libraries: "Bibliotecas",
      msg: "Paso de mensajes",
      socket: "Sockets de loopback",
      ssl: "TLS",
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
      "dist.ping_pong":
        "5 000 idas y vueltas de un mensaje con otro nodo por TCP, 3 veces",
      "dist.data_exchange":
        "200 idas y vueltas de un binario de 64 KB y 1 000 tuplas con otro nodo, 3 veces",
      "dist.spawn": "Crea 500 procesos uno tras otro en otro nodo, 3 veces",
      "dist.reconnect":
        "20 desconexiones y reconexiones con otro nodo, cada una con una ida y vuelta, 3 veces",
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
      "float.sum": "Suma un float en un bucle de 1 millón de pasos, 200 veces",
      "float.mandelbrot":
        "Iteraciones de Mandelbrot sobre una cuadrícula de 120×120, 120 veces",
      "float.limit":
        "Hace crecer un float paso a paso hasta superar 1e100, 80 veces",
      "float.negate":
        "Menos unario y float/1 en un bucle de floats de 1 millón de pasos, 70 veces",
      "float.guards":
        "Una guarda is_float/1 en un bucle de floats de 1 millón de pasos, 120 veces",
      "float.calls":
        "Suma trapezoidal de un polinomio, una llamada por paso, 160 veces",
      "gc.short_processes":
        "Lanza 5000 procesos efímeros que generan basura cada uno, 69 veces",
      "gc.grow_shrink":
        "Hace crecer el heap con una lista de 200 000 elementos y la suelta, 300 veces",
      "gc.long_lived_churn":
        "Mantiene una ventana deslizante de 10 000 elementos vivos entre basura, 370 veces",
      "gc.explicit_collect":
        "Fuerza la recolección de basura con 10 000 tuplas vivas, 5100 veces",
      "libraries.qlc":
        "Ejecuta la transformación de qlc sobre 27 consultas y 3 módulos, 11 veces",
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
      "ssl.tls_echo": "5 000 ecos TLS 1.3 de 1 KB en loopback, 3 veces",
      "ssl.tls_handshake":
        "50 conexiones TLS 1.3, cada una con un handshake completo y un eco, 3 veces",
      "ssl.tls_bulk":
        "Envía 1 024 bloques de 16 KB por TLS 1.3 en loopback, 3 veces",
    },
    programInfo: {
      bench_datagen:
        "Construye en masa listas, tuplas, maps, binaries y enteros grandes",
      bench_dataproc:
        "Ordenación, fold, actualización de maps, matching de binaries y conversiones",
      bench_dist:
        "Idas y vueltas, datos, procesos remotos y reconexiones entre nodos; OTP también los ejecuta sobre TLS",
      bench_file:
        "Escritura y lectura de archivos pequeños y grandes, lectura por líneas",
      bench_float:
        "Bucles de floats: sumas, Mandelbrot, límites, negación, guardas y llamadas",
      bench_gc: "Procesos efímeros, heap que crece y encoge, datos vivos",
      bench_library:
        "La parse transform de qlc en tiempo de ejecución, como la usa qlc:q/1",
      bench_msg:
        "Ping-pong, fan-in, anillo de procesos y copia de mensajes grandes",
      bench_socket: "Eco TCP, conexiones TCP e idas y vueltas UDP en loopback",
      bench_ssl: "Eco, handshakes y transferencia masiva TLS 1.3 en loopback",
    },
    programsTitle: "Programas completos",
    programsNote:
      "Tiempo real en segundos, incluido el arranque, mediana de las ejecuciones.",
    program: "Programa",
    historyTitle: "Progreso",
    historyNote:
      "Media geométrica del tiempo de Clause dividido por el de OTP en cada día con ejecuciones registradas.",
    pinnedSince:
      "Las ejecuciones anteriores al {date} no estaban fijadas a un conjunto de CPU, por lo que parte del cambio de ese día se debe a la fijación.",
    date: "Fecha",
    commit: "Commit",
    sizesTitle: "Tamaño de los ejecutables",
    sizesNote:
      "Tamaño en megabytes de los programas de prueba tal como Clause los compila en cada nivel de optimización.",
    sizesHistoryNote:
      "Tamaños con -O2 de las últimas {count} ejecuciones de benchmarks, de la más antigua a la más reciente, un commit de Clause por ejecución. La tabla siguiente añade el total de todos los programas bench_* y el tamaño del compilador clau.",
    sizesTotal: "Todos los programas bench_*",
    megabytes: "{value} MB",
    setupTitle: "Configuración",
    machine: "Máquina",
    cpus: "{count} CPU lógicas",
    cpuSet: "Conjunto de CPU",
    cpuSetPerformance:
      "Núcleos de rendimiento {list}, {count} de {total} CPU lógicas",
    cpuSetList: "CPU {list}, {count} de {total} CPU lógicas",
    pinningPerformance:
      "OTP y Clause se ejecutan en las mismas CPU: cada programa de benchmark está fijado a los núcleos de rendimiento del procesador, de modo que en una CPU híbrida ningún kernel acaba en un núcleo de eficiencia más lento. Ambos mantienen un planificador activo por cada CPU del conjunto, sin vincularlo a ninguna CPU concreta dentro de él.",
    pinningList:
      "OTP y Clause se ejecutan en las mismas CPU: cada programa de benchmark está fijado al conjunto de CPU indicado arriba. Ambos mantienen un planificador activo por cada CPU del conjunto, sin vincularlo a ninguna CPU concreta dentro de él.",
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
