import type { Messages } from "@/messages/en";

export const pt = {
  meta: {
    description:
      "Clause compila Erlang/OTP 29 antecipadamente via LLVM em executáveis nativos.",
  },
  nav: {
    label: "Principal",
    home: "Início",
    docs: "Documentação",
    benchmarks: "Benchmarks",
    resources: "Recursos",
  },
  theme: {
    label: "Tema de cores",
    light: "Claro",
    auto: "Auto",
    dark: "Escuro",
  },
  language: {
    label: "Idioma",
  },
  footer: {
    tagline: "Erlang, compilado antecipadamente.",
    updated: "Atualizado",
    cookies: "Cookies",
  },
  home: {
    title: "Erlang/OTP 29, compilado para código nativo",
    intro:
      "Clause é um compilador AOT para Erlang. Pré-processa, analisa e verifica o código Erlang, compila-o via LLVM e gera executáveis nativos com o seu próprio runtime: processos leves em várias threads do escalonador, troca de mensagens, portas e recolha de lixo por processo.",
    status:
      "Em desenvolvimento: um subconjunto crescente de Erlang e da stdlib do OTP compila para executáveis nativos que já executam em Windows e Linux. Falta ainda: macOS com Apple Silicon e hardware ARM nativo, os conjuntos de testes do próprio OTP e mais otimização. A página de benchmarks mostra a posição do Clause face ao OTP; a documentação indica o que funciona e em que o Clause difere.",
    ctaDocs: "Ler a documentação",
    ctaSource: "Código no GitHub",
    cardsTitle: "Funcionalidades",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Sintaxe moderna de Erlang",
        text: "Pré-processa e analisa código-fonte Erlang/OTP 29, incluindo records nativos.",
      },
      {
        id: "benchmarks",
        property: "{ratio} {side}",
        title: "Velocidade face ao OTP",
        text: "Média geométrica de {count} kernels de teste, Clause -O2 face ao JIT da BEAM.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Executáveis nativos",
        text: "Um comando do código-fonte Erlang a um programa autónomo, compilado através do LLVM com otimização em tempo de ligação. Escripts também.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Processos Erlang",
        text: "Processos leves com recolha de lixo por processo em várias threads do escalonador.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "Biblioteca OTP",
        text: "stdlib e kernel próprios do Clause com as exportações, resultados e erros do OTP 29.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Portas e E/S",
        text: "Ficheiros, subprocessos e sockets TCP/UDP numa única thread de E/S orientada a eventos.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Inferência de tipos",
        text: "Em O2, os tipos inferidos eliminam verificações em runtime e selecionam código especializado.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Executa parse transforms durante a compilação; os executáveis nunca precisam do OTP.",
      },
      {
        id: "targets",
        property: "7 plataformas",
        title: "Multiplataforma",
        text: "Corre em Windows x64 e Linux x86-64; objetos para sete plataformas.",
      },
    ],
    detailsTitle: "Funcionalidades em detalhe",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Sintaxe Erlang/OTP 29: records, maps, bitstrings, comprehensions, tipos e especificações",
          "Macros, includes e compilação condicional",
          "Parse transforms num Erlang/OTP 29 do anfitrião, incluindo ms_transform e qlc",
        ],
      },
      {
        id: "language",
        title: "Semântica de Erlang",
        items: [
          "Correspondência de padrões e guardas em cláusulas, case, if e receive",
          "Records, funs, maybe e comprehensions de listas, binários e maps",
          "Exceções com try, catch e stack traces",
        ],
      },
      {
        id: "compiler",
        title: "Compilador",
        items: [
          "Inferência de tipos com tipos de funções por cláusula",
          "LLVM O0, O2 e Os, com otimização em tempo de ligação entre módulos",
          "O2 elimina verificações de tipos provadas pela inferência",
          "Chamadas de cauda próprias e recursão profunda",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Runtime C++23 com todos os tipos de termos Erlang, incluindo inteiros de precisão arbitrária",
          "Processos, receive seletivo, links, monitores e temporizadores em vários escalonadores",
          "Heaps por processo com um recoletor de lixo por cópia",
          "Tabelas ETS concorrentes em C++",
        ],
      },
      {
        id: "library",
        title: "Biblioteca OTP",
        items: [
          "Módulos OTP 29 próprios do Clause com as exportações, resultados e razões de erro do OTP",
          "stdlib: lists, maps, string, binary, json, rand e os módulos de coleções",
          "ets, dets com ficheiros tal como o OTP os escreve, re e zlib",
          "kernel: file, gen_tcp, gen_udp, inet e os",
        ],
      },
      {
        id: "tooling",
        title: "Projetos e ferramentas",
        items: [
          "Um único comando clau do código-fonte Erlang a um executável nativo",
          "Projetos TOML com caches de compilação SQLite",
          "Informação de depuração com -g (CodeView ou DWARF 5) e profiling com --profile",
          "Testado face ao Erlang/OTP de referência e comparado com o OTP em benchmarks",
        ],
      },
    ],
  },
  docs: {
    title: "Documentação",
    notReady: "A documentação ainda não está pronta.",
    meanwhile:
      "Entretanto, pode ler as notas de desenvolvimento do repositório do projeto. Descrevem a implementação atual e os seus limites.",
    synced: "Sincronizado a partir do commit",
    startHere: "Comece aqui",
    reference: "Notas de referência",
    notWritten: "Ainda não escrito. Entretanto, consulte:",
    allDocs: "Toda a documentação",
    englishOnly:
      "Esta página ainda não foi traduzida, por isso é apresentada em inglês.",
    outdated:
      "O original em inglês mudou desde esta tradução, pelo que partes dela podem estar desatualizadas.",
    translated: "Traduzido do original em inglês",
    readEnglish: "Ler em inglês",
    featured: {
      gettingStarted: {
        title: "Primeiros passos",
        text: "Pré-requisitos: CMake, um compilador C++23, Clang, o SDK do LLVM 23, Boost e toml++; o CMake descarrega as restantes bibliotecas. O Erlang/OTP é opcional.",
      },
      building: {
        title: "Compilar o compilador",
        text: "Configurar, compilar e testar com presets do CMake em Linux, macOS e Windows.",
      },
      using: {
        title: "Usar o compilador",
        text: "Opções de linha de comandos, modos de inspeção, executáveis, projetos TOML e parse transforms.",
      },
      interpreting: {
        title: "Como interpretar os resultados",
        text: "Experimentar o Clause em código Erlang existente: o que compila hoje, o que significam as mensagens notimpl e o que tentar a seguir.",
      },
      differences: {
        title: "Diferenças conhecidas do Erlang/OTP",
        text: "Comportamento observável em que o Clause difere conscientemente do OTP 29.",
      },
    },
  },
  benchmarks: {
    title: "Benchmarks",
    intro:
      "O Clause comparado com o Erlang/OTP numa única máquina: os mesmos programas Erlang, compilados pelo erlc e pelo clau -O2, medem o tempo dos seus kernels após uma chamada de aquecimento. Estes números mudam a cada otimização.",
    geomean:
      "Média geométrica dos tempos dos kernels, Clause -O2 face ao JIT da BEAM (OTP)",
    slowerOnAverage: "mais lento em média",
    fasterOnAverage: "mais rápido em média",
    barFaster: "mais rápido",
    barSlower: "mais lento",
    faster: "Kernels em que o Clause é mais rápido",
    first: "Média geométrica em {date}, a primeira execução registada",
    kernelsTitle: "Tempos dos kernels",
    kernelsNote:
      "Mediana de {runs} execuções em milissegundos. A barra mostra o tempo do Clause dividido pelo do OTP numa escala logarítmica.",
    noisy: "As execuções variaram mais de metade da mediana.",
    kernel: "Kernel",
    otp: "OTP JIT",
    clause: "Clause -O2",
    ratio: "Clause ÷ OTP",
    legendFaster: "Clause mais rápido",
    legendSlower: "OTP mais rápido",
    groups: {
      datagen: "Geração de dados",
      dataproc: "Processamento de dados",
      file: "E/S de ficheiros",
      gc: "Recolha de lixo",
      msg: "Troca de mensagens",
      socket: "Sockets em loopback",
    },
    kernelInfo: {
      "datagen.list_of_tuples":
        "Constrói uma lista de 200 000 tuplos pequenos, 260 vezes",
      "datagen.list_to_tuple":
        "Converte listas de 1000 elementos em tuplos, 170 000 vezes",
      "datagen.map_put":
        "Insere 2000 chaves inteiras num map, uma a uma, 4900 vezes",
      "datagen.binary_append":
        "Acrescenta 10 000 inteiros de 32 bits a um binary crescente, 23 000 vezes",
      "datagen.bigint_factorial":
        "Calcula o fatorial de 3000 com inteiros grandes, 330 vezes",
      "datagen.string_build":
        "Constrói 20 000 cadeias a partir de inteiros e átomos, 1000 vezes",
      "dataproc.sort":
        "Ordena uma lista de 20 000 inteiros aleatórios, 600 vezes",
      "dataproc.map_foldl":
        "Aplica map e depois fold a 20 000 inteiros, 4500 vezes",
      "dataproc.map_update":
        "Incrementa cada valor de um map de 500 chaves, 24 000 vezes",
      "dataproc.binary_match":
        "Soma 20 000 inteiros de 32 bits extraídos de um binary, 49 000 vezes",
      "dataproc.int_to_list":
        "Converte 20 000 inteiros em cadeias e de volta, 2000 vezes",
      "dataproc.term_to_binary":
        "Codifica e descodifica um termo aninhado grande, 4300 vezes",
      "dataproc.comprehension":
        "Comprehension que filtra e duplica 20 000 inteiros, 15 000 vezes",
      "dataproc.small_map":
        "Atualiza 80 milhões de vezes um pequeno map de estado",
      "file.small_files":
        "Escreve, relê e apaga 500 ficheiros pequenos, 11 vezes",
      "file.large_write":
        "Escreve um ficheiro de 16 MB em blocos de 64 KB, 200 vezes",
      "file.large_read":
        "Lê um ficheiro de 16 MB em blocos de 64 KB, 370 vezes",
      "file.read_line":
        "Lê linha a linha um ficheiro de texto de 20 000 linhas, 52 vezes",
      "file.read_file":
        "Lê um ficheiro inteiro de 16 MB numa só chamada, 330 vezes",
      "gc.short_processes":
        "Lança 5000 processos efémeros que geram lixo cada um, 69 vezes",
      "gc.grow_shrink":
        "Faz crescer o heap com uma lista de 200 000 elementos e larga-a, 300 vezes",
      "gc.long_lived_churn":
        "Mantém uma janela deslizante de 10 000 elementos vivos no meio de lixo, 370 vezes",
      "gc.explicit_collect":
        "Força a recolha de lixo com 10 000 tuplos vivos, 5100 vezes",
      "msg.ping_pong":
        "Troca uma mensagem entre dois processos 2 milhões de vezes",
      "msg.fan_in":
        "100 processos enviam 1000 mensagens cada um a um só, 25 vezes",
      "msg.ring":
        "Passa um testemunho 3050 vezes por um anel de 1000 processos",
      "msg.large_message":
        "Envia uma lista de 100 000 elementos a outro processo e de volta, 560 vezes",
      "socket.tcp_echo": "Eco de 30 000 mensagens de 1 KB por TCP em loopback",
      "socket.tcp_connect":
        "Abre 900 ligações TCP em loopback, com eco de 25 mensagens de 1 KB em cada",
      "socket.udp_round_trip":
        "Ida e volta de um datagrama de 1 KB, 27 900 vezes, por UDP em loopback",
    },
    programInfo: {
      bench_datagen:
        "Constrói em massa listas, tuplos, maps, binaries e inteiros grandes",
      bench_dataproc:
        "Ordenação, fold, atualização de maps, matching de binaries e conversões",
      bench_file:
        "Escrita e leitura de ficheiros pequenos e grandes, leitura por linhas",
      bench_gc: "Processos efémeros, heap que cresce e encolhe, dados vivos",
      bench_msg:
        "Pingue-pongue, fan-in, anel de processos e cópia de mensagens grandes",
      bench_socket: "Eco TCP, ligações TCP e idas e voltas UDP em loopback",
    },
    programsTitle: "Programas completos",
    programsNote:
      "Tempo real em segundos, incluindo o arranque, mediana das execuções.",
    program: "Programa",
    historyTitle: "Progresso",
    historyNote:
      "Média geométrica do tempo do Clause dividido pelo do OTP em cada dia com execuções registadas.",
    pinnedSince:
      "As execuções anteriores a {date} não estavam fixadas a um conjunto de CPUs, pelo que parte da alteração desse dia se deve à fixação.",
    date: "Data",
    commit: "Commit",
    sizesTitle: "Tamanho dos executáveis",
    sizesNote:
      "Tamanho em megabytes dos programas de teste tal como o Clause os constrói em cada nível de otimização.",
    sizesHistoryNote:
      "Tamanhos com -O2 dos últimos {count} commits medidos, do mais antigo para o mais recente. Cada execução constrói também uma referência (baseline), o commit anterior do Clause (o commit mais recente com pelo menos um dia de antiguidade em relação a HEAD, ou o indicado com --baseline), com -O2 para detetar regressões; as referências aparecem aqui como commits próprios. A tabela abaixo acrescenta o total de todos os programas bench_* e o tamanho do compilador clau.",
    sizesTotal: "Todos os programas bench_*",
    megabytes: "{value} MB",
    setupTitle: "Configuração",
    machine: "Máquina",
    cpus: "{count} CPUs lógicos",
    cpuSet: "Conjunto de CPUs",
    cpuSetPerformance:
      "Núcleos de desempenho {list}, {count} de {total} CPUs lógicos",
    cpuSetList: "CPUs {list}, {count} de {total} CPUs lógicos",
    pinningPerformance:
      "O OTP e o Clause correm nos mesmos CPUs: cada programa de benchmark está fixado aos núcleos de desempenho do processador, pelo que num CPU híbrido nenhum kernel acaba num núcleo de eficiência mais lento. Ambos mantêm um escalonador ativo por cada CPU do conjunto, sem o vincular a um CPU concreto dentro dele.",
    pinningList:
      "O OTP e o Clause correm nos mesmos CPUs: cada programa de benchmark está fixado ao conjunto de CPUs indicado acima. Ambos mantêm um escalonador ativo por cada CPU do conjunto, sem o vincular a um CPU concreto dentro dele.",
    otpVersion: "Erlang/OTP",
    clauseCommit: "Commit do Clause",
    runAt: "Execução",
    reproduce:
      "Para executar os benchmarks, use make benchmark ou make-benchmark.bat no repositório do Clause; as notas de benchmarks descrevem os programas e as opções.",
    notes: "Notas de benchmarks",
  },
  resources: {
    title: "Recursos",
    intro: "Onde encontrar o código-fonte e acompanhar o desenvolvimento.",
    github: {
      title: "Repositório no GitHub",
      text: "Código-fonte, issues e histórico de desenvolvimento.",
    },
    credits: "Créditos de arte",
  },
  cookies: {
    banner:
      "Este site conta as visitas com o Google Analytics, que só instala cookies se os aceitar.",
    accept: "Aceitar",
    decline: "Recusar",
    policyLink: "Política de cookies",
    title: "Política de cookies",
    intro:
      "O clau.se conta as visitas com o Google Analytics para saber que páginas são lidas. O Google Analytics só é carregado e só instala cookies depois de os aceitar; até lá, ou se os recusar, nada é enviado à Google.",
    choiceTitle: "A sua escolha",
    choice:
      "Recusar não altera nada no site. Pode mudar a sua escolha a qualquer momento; retirar o consentimento apaga os cookies de análise.",
    current: "Escolha atual: {state}",
    granted: "aceites",
    denied: "recusados",
    unset: "ainda não feita",
    storedTitle: "O que é guardado",
    name: "Nome",
    purpose: "Finalidade",
    duration: "Duração",
    rows: [
      {
        name: "_ga",
        purpose: "Cookie do Google Analytics: distingue os visitantes",
        duration: "2 anos",
      },
      {
        name: "_ga_8Y3XJHBHPB",
        purpose: "Cookie do Google Analytics: guarda o estado de uma visita",
        duration: "2 anos",
      },
      {
        name: "analytics-consent",
        purpose:
          "Armazenamento local do navegador: a sua escolha sobre cookies",
        duration: "Até o apagar",
      },
      {
        name: "theme, locale",
        purpose:
          "Armazenamento local do navegador: o tema de cores e o idioma escolhidos",
        duration: "Até o apagar",
      },
    ],
    googleTitle: "Google Analytics",
    google:
      "O Google Analytics é um serviço da Google. Com o seu consentimento recebe as páginas visitadas, a página de origem, o tipo de navegador e de dispositivo e uma localização aproximada obtida a partir do endereço IP.",
    googleLink: "Como a Google utiliza esta informação",
    contact: "Questões sobre esta política:",
  },
  notFound: {
    title: "Página não encontrada",
    home: "Ir para a página inicial",
  },
} satisfies Messages;
