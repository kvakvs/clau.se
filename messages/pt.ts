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
  },
  home: {
    title: "Erlang/OTP 29, compilado para código nativo",
    intro:
      "Clause é um compilador AOT para Erlang. Pré-processa, analisa e verifica o código Erlang, compila-o via LLVM e gera executáveis nativos com o seu próprio runtime: processos leves em várias threads do escalonador, troca de mensagens, portas e recolha de lixo por processo.",
    status:
      "Em desenvolvimento: um subconjunto crescente de Erlang já compila para executáveis nativos e executa em Windows e Linux. Falta ainda: validação em macOS com Apple Silicon e em hardware ARM nativo, e comparações mais amplas com os conjuntos de testes do próprio OTP. A documentação indica o que funciona e em que o Clause difere do Erlang/OTP.",
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
        text: "Processos em várias threads do escalonador com receive seletivo, tempos limite, links, monitores, nomes registados e sinais de saída.",
      },
      {
        id: "memory",
        property: "GC por processo",
        title: "Memória isolada",
        text: "Cada processo tem o seu próprio heap, limpo por um coletor de lixo por cópia segundo o design clássico do ERTS.",
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
        id: "debugging",
        property: "-g · --profile",
        title: "Depuração e perfilagem",
        text: "Tabelas de linhas do código Erlang para depuradores nativos e um relatório de custos opcional por função e por processo.",
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
          "Pré-processamento: macros, include, include_lib, compilação condicional e funcionalidades da linguagem",
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
        ],
      },
      {
        id: "compiler",
        title: "Compilador",
        items: [
          "Análise semântica: verificação do subconjunto, ligação de variáveis, resolução de chamadas, tipos declarados e inferidos",
          "Inferência de tipos com tipos de funções por cláusula; especificações que contradizem os tipos inferidos são erros de compilação",
          "LLVM O0, O2 e Os; objetos, IR e bitcode por módulo; instantâneos de IR anotados com o código Erlang",
          "O2 elimina verificações de tipo e de forma comprovadas pela inferência, com um número limitado de variantes especializadas por tipo",
          "Otimização em tempo de ligação entre módulos com --lto",
          "Relatórios de tipos: código-fonte anotado com as assinaturas de funções inferidas",
          "Chamadas de cauda reais e recursão profunda numa pilha explícita por processo",
          "Uma mensagem notimpl explícita para Erlang válido que precisa de uma funcionalidade ainda não implementada",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Biblioteca de runtime em C++23 sem LLVM, ligada a cada programa",
          "Inteiros de precisão arbitrária, vírgula flutuante, átomos, tuplos, listas, maps, bitstrings, records, funs, pids, portas e referências",
          "Processos, mensagens, receive seletivo, links, monitores, nomes registados e temporizadores em várias threads do escalonador",
          "Heap por processo com coletor de lixo por cópia, binaries fora do heap e limites de memória opcionais",
          "Portas para ficheiros, E/S padrão, subprocessos e sockets TCP/UDP numa única thread de E/S orientada a eventos",
          "io:format com a formatação ~p do OTP; subconjuntos de lists, maps, file, io, gen_tcp, gen_udp, inet e os",
        ],
      },
      {
        id: "tooling",
        title: "Projetos e ferramentas",
        items: [
          "Projetos TOML com alvos nomeados, descoberta de código-fonte e opções por alvo",
          "Projetos iniciais comentados com clau --new-project",
          "Um único comando clau, do código Erlang ao executável nativo; os escripts também compilam",
          "Tabelas de linhas de depuração com -g (CodeView ou DWARF 5) e perfilagem opcional com --profile",
          "Comportamento verificado contra as saídas do Erlang/OTP de referência",
          "Execuções com sanitizers de endereços, de comportamento indefinido e de threads em Linux",
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
        text: "Pré-requisitos: CMake, um compilador C++23, Clang, o SDK do LLVM, Boost e toml++.",
      },
      building: {
        title: "Compilar o compilador",
        text: "Configurar, compilar e testar com presets do CMake em Linux, macOS e Windows.",
      },
      using: {
        title: "Usar o compilador",
        text: "Opções de linha de comandos, modos de inspeção, executáveis e projetos TOML.",
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
  resources: {
    title: "Recursos",
    intro: "Onde encontrar o código-fonte e acompanhar o desenvolvimento.",
    github: {
      title: "Repositório no GitHub",
      text: "Código-fonte, issues e histórico de desenvolvimento.",
    },
    credits: "Créditos de arte",
  },
  notFound: {
    title: "Página não encontrada",
    home: "Ir para a página inicial",
  },
} satisfies Messages;
