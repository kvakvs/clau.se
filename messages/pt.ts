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
        text: "Pré-processador e parser para Erlang/OTP 29: macros, records, records nativos, maps, bitstrings, comprehensions, maybe e especificações de tipos.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "Backend LLVM",
        text: "Compila para LLVM IR verificado, bitcode ou objetos nativos com O0, O2 ou Os, com otimização opcional em tempo de ligação entre módulos.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Executáveis nativos",
        text: "Liga módulos Erlang, o subconjunto da biblioteca que utilizam e o runtime num programa autónomo com o Clang, com um único comando. Os escripts também compilam.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Processos Erlang",
        text: "Processos leves com heaps e recolha de lixo próprios em várias threads do escalonador, com receive seletivo, links e monitores.",
      },
      {
        id: "library",
        property: "ets · dets · json",
        title: "Biblioteca OTP",
        text: "Módulos stdlib, kernel e ERTS próprios do Clause com as exportações, resultados e erros do OTP 29, desde lists e maps até tabelas ETS e ficheiros dets que o OTP pode abrir.",
      },
      {
        id: "ports",
        property: "gen_tcp · file · os",
        title: "Portas e E/S",
        text: "Ficheiros, entrada e saída padrão, subprocessos e sockets TCP/UDP através de portas, servidos por uma única thread de E/S orientada a eventos.",
      },
      {
        id: "inference",
        property: "--print-types",
        title: "Inferência de tipos",
        text: "Infere tipos de funções por cláusula; em O2, estes eliminam verificações em runtime e selecionam variantes especializadas por tipo, com uma variante genérica de recurso.",
      },
      {
        id: "transforms",
        property: "parse_transform",
        title: "Parse transforms",
        text: "Aplica parse transforms tal como o erlc, executando-os durante a compilação num Erlang/OTP 29 instalado no anfitrião; os executáveis nunca precisam do OTP.",
      },
      {
        id: "targets",
        property: "7 plataformas",
        title: "Multiplataforma",
        text: "Execução nativa validada em Windows x64 e Linux x86-64; runtime testado em x86 de 32 bits e, sob emulação, em ARM. Objetos para sete plataformas, incluindo Apple Silicon.",
      },
    ],
    detailsTitle: "Funcionalidades em detalhe",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Pré-processamento: macros, include, include_lib (também a partir de diretórios de aplicações com versão), compilação condicional e funcionalidades da linguagem",
          "Parse transforms executados num Erlang/OTP 29 do anfitrião, incluindo ms_transform e qlc do OTP; --print-abstr imprime as formas do formato abstrato",
          "Sintaxe de Erlang/OTP 29: expressões, padrões, records, bitstrings, tipos e especificações, controlo de fluxo e comprehensions",
          "Verificação de sintaxe, saída do código expandido e árvore sintática indentada",
          "Diagnósticos de código-fonte em vários ficheiros de entrada",
        ],
      },
      {
        id: "language",
        title: "Semântica de Erlang",
        items: [
          "Correspondência de padrões e guards em cláusulas de funções, case, if, receive e correspondências no corpo",
          "maybe, e comprehensions de listas, binaries e maps",
          "Records com atualizações e record_info/2; records nativos, qualificados e anónimos",
          "Funs com capturas, funs com nome, chamadas dinâmicas e apply",
          "Exceções: error, exit, throw, catch, try ... of ... catch ... after, e rastreios de pilha",
          "Atributos de módulo: verificação de callbacks de -behaviour, -import, atributos informativos e module_info/0,1 gerado",
        ],
      },
      {
        id: "compiler",
        title: "Compilador",
        items: [
          "Análise semântica: verificação do subconjunto, ligação de variáveis, resolução de chamadas, tipos declarados e inferidos",
          "Inferência de tipos com tipos de funções por cláusula; as especificações que os contradizem são assinaladas",
          "LLVM O0, O2 e Os; objetos, IR e bitcode por módulo; listagens de IR e assembly anotadas com o código Erlang",
          "Caminhos rápidos inline para alocação, testes de tipos, acesso a tuplos, listas e maps, binaries, closures e aritmética de vírgula flutuante",
          "O2 elimina verificações de tipos comprovadas pela inferência e seleciona variantes especializadas por tipo",
          "Otimização em tempo de ligação entre módulos com --lto; as exportações inalcançáveis são omitidas dos executáveis",
          "Chamadas de cauda reais e recursão profunda numa pilha explícita por processo",
          "Uma mensagem notimpl explícita para Erlang válido que precisa de uma funcionalidade ainda não implementada",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Biblioteca de runtime em C++23 sem LLVM, ligada a cada programa",
          "Todos os tipos de termos Erlang, incluindo inteiros de precisão arbitrária",
          "Processos, mensagens, receive seletivo, links, monitores, nomes registados e temporizadores em várias threads de trabalho do escalonador",
          "Heaps por processo com coletor de lixo por cópia, binaries partilhados fora do heap e limites de memória opcionais",
          "Portas para ficheiros, E/S padrão, subprocessos e sockets TCP/UDP numa única thread de E/S orientada a eventos",
          "Tabelas ETS concorrentes em C++",
        ],
      },
      {
        id: "library",
        title: "Biblioteca OTP",
        items: [
          "Versões próprias do Clause dos módulos do OTP 29 com as listas de exportações, resultados e motivos de erro do OTP; as funções ainda não implementadas lançam not_implemented",
          "stdlib: lists, maps, string, unicode, binary, io_lib, json, rand, calendar, os módulos de coleções, sofs, graph e digraph",
          "ets com especificações de correspondência e ficheiros de tabelas, dets com ficheiros idênticos byte a byte aos que o OTP escreve, e ms_transform",
          "re sobre PCRE2, zlib e o módulo erlang",
          "kernel: file, gen_tcp, gen_udp, inet, os e code",
          "Os módulos ERTS chamados pelo kernel e pela stdlib do OTP",
        ],
      },
      {
        id: "tooling",
        title: "Projetos e ferramentas",
        items: [
          "Projetos TOML com alvos nomeados, descoberta de código-fonte e opções por alvo",
          "Caches SQLite de compilação para resultados de compilação, saída de parse transforms e resultados de inferência",
          "Projetos iniciais comentados com clau --new-project",
          "Um único comando clau, do código Erlang ao executável nativo; os escripts também compilam",
          "Tabelas de linhas de depuração com -g (CodeView ou DWARF 5) e perfilagem opcional com --profile",
          "Testado contra o Erlang/OTP de referência, com execuções com sanitizers em Linux e benchmarks face ao OTP",
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
    programsTitle: "Programas completos",
    programsNote:
      "Tempo real em segundos, incluindo o arranque, mediana das execuções.",
    program: "Programa",
    historyTitle: "Progresso",
    historyNote:
      "Média geométrica do tempo do Clause dividido pelo do OTP em cada dia com execuções registadas.",
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
