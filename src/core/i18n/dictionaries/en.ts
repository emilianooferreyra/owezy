import type { Dictionary } from "./es-AR";

/** The app's copy in English, mainly for visitors and judges outside Latin America. */
export const en = {
  meta: {
    description: "A collections assistant for small businesses: charge in pesos or reais and get paid on Celo, with Ripio.",
    ogAlt: "Owezy. They owe, you get paid. Collections in pesos and reais on Celo and Ripio.",
    howItWorksTitle: "How it works",
    demoTitle: "Demo",
    demoDescription: "Ask the assistant for a charge and pay it from the customer's phone, with simulated payments.",
    payTitle: "Pay",
  },
  common: {
    language: "Language",
    backHome: "Back to home",
    backToApp: "Back to the app",
    tryDemo: "Try the demo",
    howItWorks: "See how it works",
    viewCode: "View the code",
  },
  notFound: {
    title: "We couldn't find this page",
    body: "The link may be mistyped, or the page may no longer exist.",
  },
  payNotFound: {
    title: "This payment link doesn't exist",
    body: "It may be incomplete, or the charge may no longer be available. Ask the business for a new link.",
  },
  error: {
    title: "Something went wrong",
    body: "We couldn't load this page. Try again in a few seconds.",
    retry: "Try again",
  },
  landing: {
    badge: "For small businesses in Argentina and Brazil · Celo + Ripio",
    tagline: "They owe, you get paid.",
    intro:
      "Write down what customers buy on credit, charge it with one tap, and know when they paid. Your customer pays from their bank in their own currency; you receive local stablecoins on Celo.",
    sceneOwner: "Juan took 2 dozen medialunas, 12k pesos",
    sceneNoted: "Written in the ledger",
    scenePaid: "💸 Juan paid you $57,000",
    howItWorks: "How it works",
    steps: [
      { title: "Write it down", example: "“Juan took medialunas, 12k pesos.”" },
      { title: "Charge", example: "One tap and Juan gets the payment link." },
      { title: "Get notified", example: "When he pays, the agent marks it in the ledger." },
    ],
    countries: "Live in Argentina and Brazil",
    countriesNext: "wMXN, wCOP, wPEN and wCLP already exist on Celo: adding a country means adding its token.",
    builtWith: "Built with eve · Celo · Ripio",
  },
  howItWorks: {
    badge: "Agents on Open Rails · Celo + Ripio",
    title: "An agent that collects for your business, in your currency",
    intro:
      "You ask for a charge the way you'd ask a person. Your customer pays from their bank, in pesos or reais. You receive wARS or wBRL on Celo, and the agent reconciles every payment so you never cross off a spreadsheet again.",
    problemTitle: "The problem",
    problems: [
      {
        title: "Money arrives without context",
        description:
          "A transfer comes in and you have to work out who sent it and why. With a dozen customers, there goes your afternoon.",
      },
      {
        title: "Reconciling is manual",
        description:
          "Most small businesses keep a spreadsheet next to online banking and cross off payments one by one. One mistake means chasing someone who already paid.",
      },
      {
        title: "Your customer won't learn crypto",
        description:
          "Getting paid on Celo is cheap and instant, but asking a customer to install a wallet loses the sale. They must pay the way they already do.",
      },
    ],
    stepsTitle: "Step by step",
    stepsIntro: "It all happens in a chat. The agent answers with cards, not paragraphs.",
    steps: [
      {
        title: "Write down what you're owed",
        description:
          "“Juan took 2 dozen medialunas, 12k pesos.” The agent writes it in the ledger with add_to_ledger, and the code validates the amount before saving anything.",
      },
      {
        title: "Charge with one tap",
        description:
          "From the ledger, Charge gathers everything the customer owes into one charge, C-0001, with its payment link. If the request repeats in the same turn, it returns the same charge: never a duplicate.",
      },
      {
        title: "Your customer pays",
        description:
          "The link opens Ripio's on-ramp: your customer pays from their bank, in pesos or with Pix in reais, and your wallet receives wARS or wBRL on Celo.",
      },
      {
        title: "The agent watches the blockchain",
        description:
          "It reads the wARS and wBRL transfers that reach your address on Celo mainnet. Reading needs no keys and signs nothing.",
      },
      {
        title: "It reconciles and tells you",
        description:
          "Each transfer goes to the pending charge with that exact amount and currency. The charge becomes paid and both sides get a receipt. And you can ask “who owes me?” anytime.",
      },
    ],
    exampleTitle: "An example with numbers",
    exampleIntro:
      "A bakery has two pending charges. The ramp link carries no order number, so the amount is the only clue.",
    exampleCharges: [
      { id: "C-0001", line: "Juan Pérez · 2 dozen medialunas", amount: "$85,000" },
      { id: "C-0002", line: "María Gómez · birthday cake", amount: "$42,500" },
    ],
    exampleMatchLead: "A transfer of 85,000 wARS arrives.",
    exampleMatch:
      "Only C-0001 is pending with that exact amount and was created before the transfer: it becomes paid and Juan gets his receipt.",
    exampleAmbiguousLead: "If C-0002 were also $85,000,",
    exampleAmbiguous:
      "the agent doesn't pick one. It flags the transfer as ambiguous and asks you to assign it. A wrong “paid” is worse than a question.",
    realTodayTitle: "What is real today",
    realTodayIntro: "A demo should never pretend to be something it isn't.",
    states: { works: "Works", simulated: "Simulated by default", soon: "Coming soon" },
    realToday: [
      {
        piece: "The agent and its tools",
        state: "works",
        detail: "An eve agent on Groq, with the ledger (write, read, charge) and the charges.",
      },
      {
        piece: "Charges and reconciliation",
        state: "works",
        detail: "Charge numbers, idempotency and payment matching by amount and currency, with tests.",
      },
      { piece: "Argentina (wARS) and Brazil (wBRL)", state: "works", detail: "Each business charges in its country's currency." },
      { piece: "Wallet and balance", state: "works", detail: "Read from Celo mainnet. Read-only." },
      {
        piece: "The customer's payment",
        state: "simulated",
        detail: "A simulated checkout, so a demo never moves real money. Ripio's ramp is turned on by configuration.",
      },
      {
        piece: "Agent identity (ERC-8004) and attribution (ERC-8021)",
        state: "works",
        detail: "Registered on Celo Sepolia, with the attribution tag in the transaction. Mainnet is pending.",
      },
    ],
    builtTitle: "How it's built",
    builtIntro: "Four layers. Money lives on Celo, the agent decides, the app talks, and nothing in between holds keys.",
    layers: [
      { title: "You", points: ["You chat with the agent", "Your wallet receives wARS or wBRL"] },
      { title: "The app", points: ["Next.js 16, React 19", "Your chat and the customer's phone, side by side"] },
      { title: "The agent", points: ["eve (Vercel), gpt-oss-120b on Groq", "Typed tools, nothing else"] },
      { title: "Celo mainnet", points: ["Ripio's wARS and wBRL", "Transfers read with viem"] },
    ],
    guaranteesTitle: "Guarantees",
    guarantees: [
      "There are no private keys in the code. The app never signs or moves money.",
      "Connecting the wallet is read-only: it tells the app where your payments arrive.",
      "Payments are simulated unless the deploy explicitly turns on the real ramp.",
      "Money is never a floating-point number: amounts are integers in base units, so a balance never shows money that isn't there.",
      "Reconciliation never guesses: an ambiguous transfer waits for a person to decide.",
    ],
    walletTitle: "Where your payments arrive",
    walletIntro: "Connect the wallet where you want to get paid and see your balance. Read-only: you sign nothing.",
    linksTitle: "Links",
  },
} satisfies Dictionary;
