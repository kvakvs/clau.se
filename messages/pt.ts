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
      "Clause é um compilador AOT para Erlang. Ele pré-processa, analisa e verifica o código Erlang, compila-o via LLVM e gera executáveis nativos com o seu próprio runtime: processos leves, troca de mensagens e coleta de lixo por processo.",
    status:
      "Em desenvolvimento: um subconjunto crescente de Erlang já compila e executa. A documentação indica o que funciona e em que o Clause difere do Erlang/OTP.",
    ctaDocs: "Ler a documentação",
    ctaSource: "Código no GitHub",
    cardsTitle: "Funcionalidades",
    cards: [
      {
        id: "otp",
        property: "OTP 29",
        title: "Sintaxe moderna de Erlang",
        text: "Pré-processador e parser para Erlang/OTP 29: macros, records, records nativos, maps, bitstrings, compreensões, maybe e especificações de tipos.",
      },
      {
        id: "llvm",
        property: "LLVM",
        title: "Backend LLVM",
        text: "Compila para LLVM IR verificado, bitcode ou objetos nativos com O0, O2 ou Os, com variantes de funções especializadas por tipo.",
      },
      {
        id: "executables",
        property: "clau -o app",
        title: "Executáveis nativos",
        text: "Liga módulos Erlang e o runtime num programa autónomo com o Clang, com um único comando.",
      },
      {
        id: "processes",
        property: "spawn · send · receive",
        title: "Processos Erlang",
        text: "Processos em threads do escalonador com receive seletivo, tempos limite, links, monitores, nomes registados e sinais de saída.",
      },
      {
        id: "memory",
        property: "GC por processo",
        title: "Memória isolada",
        text: "Cada processo tem o seu próprio heap, limpo por um coletor de lixo por cópia segundo o design clássico do ERTS.",
      },
      {
        id: "targets",
        property: "7 plataformas",
        title: "Multiplataforma",
        text: "Execução validada no Windows x64; objetos verificados para Linux x86, x64, ARM e AArch64, Windows x86 e x64, e Apple Silicon.",
      },
    ],
    detailsTitle: "Funcionalidades em detalhe",
    details: [
      {
        id: "frontend",
        title: "Frontend",
        items: [
          "Pré-processamento: macros, include, include_lib, compilação condicional e funcionalidades da linguagem",
          "Sintaxe de Erlang/OTP 29: expressões, padrões, records, bitstrings, tipos e especificações, controlo de fluxo e compreensões",
          "Verificação de sintaxe, saída do código expandido e árvore sintática indentada",
          "Diagnósticos de código-fonte em vários ficheiros de entrada",
        ],
      },
      {
        id: "compiler",
        title: "Compilador",
        items: [
          "Análise semântica: verificação do subconjunto, ligação de variáveis, resolução de chamadas, tipos declarados e inferidos",
          "LLVM O0, O2 e Os; objetos, IR e bitcode por módulo; instantâneos de IR anotados com o código Erlang",
          "Relatórios de tipos: código-fonte anotado com as assinaturas de funções inferidas",
          "Chamadas de cauda reais para chamadas locais, remotas e mutuamente recursivas",
          "Uma mensagem notimpl explícita para Erlang válido que precisa de uma funcionalidade ainda não implementada",
        ],
      },
      {
        id: "runtime",
        title: "Runtime",
        items: [
          "Biblioteca de runtime em C++23 sem LLVM, ligada a cada programa",
          "Inteiros de precisão arbitrária, vírgula flutuante, átomos, tuplos, listas, maps, bitstrings, records, funs, pids, portas e referências",
          "Processos, mensagens, receive seletivo, links, monitores e nomes registados em threads do escalonador",
          "Heap por processo com coletor de lixo por cópia e binários fora do heap",
          "Portas para E/S padrão, ficheiros, subprocessos e sockets",
          "Exceções com try, catch e after, e rastreios de pilha",
          "io:format com a formatação ~p do OTP; subconjuntos de lists, maps, file e io",
        ],
      },
      {
        id: "tooling",
        title: "Projetos e ferramentas",
        items: [
          "Projetos TOML com alvos nomeados, descoberta de código-fonte e opções por alvo",
          "Projetos iniciais comentados com clau --new-project",
          "Um único comando clau, do código Erlang ao executável nativo",
          "Comportamento verificado contra as saídas do Erlang/OTP de referência",
        ],
      },
    ],
  },
  docs: {
    title: "Documentação",
    notReady: "A documentação ainda não está pronta.",
    meanwhile:
      "Entretanto, pode ler as notas de desenvolvimento do repositório do projeto. Descrevem a implementação atual e os seus limites, e estão escritas em inglês.",
    synced: "Sincronizado a partir do commit",
    startHere: "Comece aqui",
    reference: "Notas de referência",
    notWritten: "Ainda não escrito. Entretanto, consulte:",
    allDocs: "Toda a documentação",
    englishOnly: "Esta página está disponível apenas em inglês.",
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
  },
  notFound: {
    title: "Página não encontrada",
    home: "Ir para a página inicial",
  },
} satisfies Messages;
