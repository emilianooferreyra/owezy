import type { Dictionary } from "./es-AR";

/** The app's copy in Brazilian Portuguese. */
export const ptBR = {
  meta: {
    description: "Assistente de cobranças para PMEs: cobre em pesos ou reais e receba na Celo, com a Ripio.",
    ogAlt: "Owezy. Te devem, a Owezy cobra por você. Cobranças em pesos e reais na Celo e na Ripio.",
    howItWorksTitle: "Como funciona",
    demoTitle: "Demo",
    demoDescription: "Peça uma cobrança ao assistente e pague pelo celular do cliente, com pagamentos simulados.",
    payTitle: "Pagar",
  },
  common: {
    language: "Idioma",
    backHome: "Voltar ao início",
    backToApp: "Voltar ao app",
    tryDemo: "Testar a demo",
    howItWorks: "Ver como funciona",
    viewCode: "Ver o código",
  },
  notFound: {
    title: "Não encontramos esta página",
    body: "Pode ser que o link esteja errado ou que a página não exista mais.",
  },
  payNotFound: {
    title: "Este link de pagamento não existe",
    body: "Pode ser que esteja incompleto ou que a cobrança não esteja mais disponível. Peça um link novo à loja.",
  },
  error: {
    title: "Algo deu errado",
    body: "Não conseguimos carregar esta página. Tente de novo em alguns segundos.",
    retry: "Tentar de novo",
  },
  landing: {
    badge: "Para PMEs da Argentina e do Brasil · Celo + Ripio",
    tagline: "Te devem. A Owezy cobra por você.",
    intro:
      "Anote o fiado, cobre com um toque e saiba quando te pagaram. Seu cliente paga pelo banco na moeda dele; você recebe stablecoins locais na Celo.",
    sceneOwner: "O João levou 2 dúzias de pão de queijo, 120 reais",
    sceneNoted: "Anotado na caderneta",
    scenePaid: "💸 O João te pagou R$ 570",
    howItWorks: "Como funciona",
    steps: [
      { title: "Você anota", example: "“O João levou pão de queijo, 120 reais.”" },
      { title: "Você cobra", example: "Um toque e o João recebe o link de pagamento." },
      { title: "Te avisa", example: "Quando ele paga, o agente marca na caderneta." },
    ],
    countries: "Hoje na Argentina e no Brasil",
    countriesNext: "Em breve",
    builtWith: "Feito com eve · Celo · Ripio",
  },
  howItWorks: {
    badge: "Agents on Open Rails · Celo + Ripio",
    title: "Um agente que cobra pela sua loja, na sua moeda",
    intro:
      "Você pede a cobrança como pediria a alguém. Seu cliente paga pelo banco, em pesos ou em reais. Você recebe wARS ou wBRL na Celo, e o agente concilia cada pagamento para você nunca mais riscar uma planilha.",
    problemTitle: "O problema",
    problems: [
      {
        title: "O dinheiro chega sem contexto",
        description:
          "Cai uma transferência e você precisa descobrir quem mandou e por quê. Com uma dúzia de clientes, lá se vai a tarde.",
      },
      {
        title: "Conciliar é na mão",
        description:
          "A maioria das PMEs tem uma planilha ao lado do internet banking e risca cobranças uma por uma. Um erro é cobrar quem já pagou.",
      },
      {
        title: "Seu cliente não vai aprender cripto",
        description:
          "Receber na Celo é barato e instantâneo, mas pedir para um cliente instalar uma carteira é perder a venda. Ele precisa pagar como já paga.",
      },
    ],
    stepsTitle: "Passo a passo",
    stepsIntro: "Tudo acontece num chat. O agente responde com cartões, não com parágrafos.",
    steps: [
      {
        title: "Você anota o que te devem",
        description:
          "«O João levou 2 dúzias de pão de queijo, 120 reais». O agente anota na caderneta com add_to_ledger, e o código valida o valor antes de salvar qualquer coisa.",
      },
      {
        title: "Você cobra com um toque",
        description:
          "Na caderneta, Cobrar junta tudo o que o cliente deve numa cobrança, C-0001, com o link de pagamento. Se o pedido se repete no mesmo turno, devolve a mesma cobrança: nunca uma duplicada.",
      },
      {
        title: "Seu cliente paga",
        description:
          "O link abre o on-ramp da Ripio: seu cliente paga pelo banco, com Pix em reais ou em pesos, e sua carteira recebe wBRL ou wARS na Celo.",
      },
      {
        title: "O agente olha a blockchain",
        description:
          "Lê as transferências de wARS e wBRL que chegam ao seu endereço na Celo mainnet. Para ler, não precisa de chaves nem assina nada.",
      },
      {
        title: "Concilia e te avisa",
        description:
          "Cada transferência vai para a cobrança pendente com esse valor exato e essa moeda. A cobrança passa a paga e os dois lados recebem o comprovante. E você pode perguntar «quem me deve?» quando quiser.",
      },
    ],
    exampleTitle: "Um exemplo com números",
    exampleIntro:
      "Uma padaria tem duas cobranças pendentes. O link do ramp não leva número de pedido, então o valor é a única pista.",
    exampleCharges: [
      { id: "C-0001", line: "João Silva · 2 dúzias de pão de queijo", amount: "R$ 850" },
      { id: "C-0002", line: "Maria Souza · bolo de aniversário", amount: "R$ 425" },
    ],
    exampleMatchLead: "Chega uma transferência de 850 wBRL.",
    exampleMatch:
      "Só a C-0001 está pendente com esse valor exato e foi criada antes da transferência: passa a paga e o João recebe o comprovante.",
    exampleAmbiguousLead: "Se a C-0002 também fosse de R$ 850,",
    exampleAmbiguous:
      "o agente não escolhe uma. Marca a transferência como ambígua e pede para você decidir. Um “pago” errado é pior que uma pergunta.",
    realTodayTitle: "O que é real hoje",
    realTodayIntro: "Uma demo nunca deveria se passar por algo que não é.",
    states: { works: "Funciona", simulated: "Simulado por padrão", soon: "Em breve" },
    realToday: [
      {
        piece: "O agente e suas ferramentas",
        state: "works",
        detail: "Agente em eve sobre Groq, com a caderneta (anotar, ler, cobrar) e as cobranças.",
      },
      {
        piece: "Cobranças e conciliação",
        state: "works",
        detail: "Números de cobrança, idempotência e atribuição de pagamentos por valor e moeda, com testes.",
      },
      { piece: "Argentina (wARS) e Brasil (wBRL)", state: "works", detail: "Cada loja cobra na moeda do seu país." },
      { piece: "Carteira e saldo", state: "works", detail: "Lido da Celo mainnet. Só leitura." },
      {
        piece: "O pagamento do cliente",
        state: "simulated",
        detail: "Um checkout simulado, para que uma demo nunca mova dinheiro real. O ramp da Ripio é ativado por configuração.",
      },
      {
        piece: "Identidade do agente (ERC-8004) e atribuição (ERC-8021)",
        state: "works",
        detail: "Registrado na Celo Sepolia, com a tag de atribuição na transação. Mainnet, pendente.",
      },
    ],
    builtTitle: "Como é construído",
    builtIntro: "Quatro camadas. O dinheiro vive na Celo, o agente decide, o app conversa, e nada no meio guarda chaves.",
    layers: [
      { title: "Você", points: ["Conversa com o agente", "Sua carteira recebe wARS ou wBRL"] },
      { title: "O app", points: ["Next.js 16, React 19", "Seu chat e o celular do cliente, lado a lado"] },
      { title: "O agente", points: ["eve (Vercel), gpt-oss-120b na Groq", "Ferramentas tipadas, nada mais"] },
      { title: "Celo mainnet", points: ["wARS e wBRL da Ripio", "Transferências lidas com viem"] },
    ],
    guaranteesTitle: "Garantias",
    guarantees: [
      "Não há chaves privadas no código. O app nunca assina nem move dinheiro.",
      "Conectar a carteira é só leitura: serve para indicar onde chegam suas cobranças.",
      "Os pagamentos são simulados, a menos que o deploy ative explicitamente o ramp real.",
      "O dinheiro nunca é um número com decimais flutuantes: os valores são inteiros em unidades base, assim um saldo nunca mostra dinheiro que não existe.",
      "A conciliação nunca adivinha: uma transferência ambígua espera uma pessoa decidir.",
    ],
    walletTitle: "Onde você recebe suas cobranças",
    walletIntro: "Conecte a carteira onde quer receber e veja seu saldo. Só leitura: você não assina nada.",
    linksTitle: "Links",
  },
} satisfies Dictionary;
