// Fills the ledger with a few customers who owe the bakery, so the demo has a business to talk about.
// Safe to run twice: each entry has a fixed request id, so a second run writes nothing new.
//
// Local (JSON files in DATA_DIR):  pnpm seed:demo
// Production (Neon):               vercel env run -e production -- pnpm seed:demo
import { chargesRuntime } from "../src/features/charges";

const ENTRIES = [
  { customer: "Juan Pérez", description: "2 docenas de medialunas", amount: "12000" },
  { customer: "Martina Gómez", description: "3 panes de campo", amount: "9000" },
  { customer: "Juan Pérez", description: "torta de cumpleaños", amount: "45000" },
  { customer: "Carlos Ruiz", description: "alfajores para la oficina", amount: "28000" },
  { customer: "Martina Gómez", description: "facturas surtidas", amount: "6500" },
  { customer: "Lucía Fernández", description: "budín de limón", amount: "7500" },
] as const;

const { feature } = chargesRuntime();
let written = 0;
for (const [index, entry] of ENTRIES.entries()) {
  const { created } = await feature.addToLedger({ ...entry, requestId: `seed-demo:${index + 1}` });
  written += created ? 1 : 0;
}
const ledger = await feature.readLedger({});
console.log(`seed: ${written} new entries; ${ledger.customers.length} customers owe $${ledger.totalOwed}`);
