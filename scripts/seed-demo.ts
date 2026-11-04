// Fills both demo shops' ledgers with a few customers who owe them, so the demo has a business to
// talk about: the Argentine bakery in pesos (wARS) and the Brazilian one in reais (wBRL).
// Safe to run twice: each entry has a fixed request id, so a second run writes nothing new.
//
// Local (JSON files in DATA_DIR):  pnpm seed:demo
// Production (Neon):               vercel env run -e production -- pnpm seed:demo
import { formatMoney } from "../src/core/money/money";
import { chargesRuntime } from "../src/features/charges";

const SHOPS = [
  {
    currency: "wARS",
    prefix: "seed-demo",
    entries: [
      { customer: "Juan Pérez", description: "2 docenas de medialunas", amount: "12000" },
      { customer: "Martina Gómez", description: "3 panes de campo", amount: "9000" },
      { customer: "Juan Pérez", description: "torta de cumpleaños", amount: "45000" },
      { customer: "Carlos Ruiz", description: "alfajores para la oficina", amount: "28000" },
      { customer: "Martina Gómez", description: "facturas surtidas", amount: "6500" },
      { customer: "Lucía Fernández", description: "budín de limón", amount: "7500" },
    ],
  },
  {
    currency: "wBRL",
    // A prefix of its own: the Argentine ids stay exactly as earlier runs wrote them.
    prefix: "seed-demo-br",
    entries: [
      { customer: "João Silva", description: "2 dúzias de pão de queijo", amount: "120" },
      { customer: "Maria Souza", description: "bolo de cenoura", amount: "85" },
      { customer: "João Silva", description: "bolo de aniversário", amount: "450" },
      { customer: "Pedro Costa", description: "coxinhas para o escritório", amount: "280" },
      { customer: "Maria Souza", description: "sonhos", amount: "65" },
      { customer: "Fernanda Lima", description: "pudim", amount: "75" },
    ],
  },
] as const;

const { feature } = chargesRuntime();
for (const { currency, prefix, entries } of SHOPS) {
  let written = 0;
  for (const [index, entry] of entries.entries()) {
    const { created } = await feature.addToLedger({ ...entry, currency, requestId: `${prefix}:${index + 1}` });
    written += created ? 1 : 0;
  }
  const ledger = await feature.readLedger({ currency });
  console.log(
    `seed ${currency}: ${written} new entries; ${ledger.customers.length} customers owe ${formatMoney(ledger.totalOwed, currency)}`,
  );
}
