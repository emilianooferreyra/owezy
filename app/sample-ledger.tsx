"use client";

import type { LedgerView } from "@/features/charges/charges-feature";
import { LedgerCard } from "@/features/charges/ui";

const entry = (id: string, customer: string, description: string, amount: string, status: "unbilled" | "charged" | "paid") => ({
  id,
  customer,
  description,
  amount,
  currency: "wARS",
  recordedAt: "2026-11-03T15:00:00.000Z",
  status,
});

// Fixed data, the same shop the demo starts with: the landing never reads the database.
const SAMPLE: LedgerView = {
  customers: [
    {
      customer: "Juan Pérez",
      owed: "57000",
      unbilled: "57000",
      entries: [
        entry("L-0001", "Juan Pérez", "medialunas", "12000", "unbilled"),
        entry("L-0003", "Juan Pérez", "torta", "45000", "unbilled"),
      ],
    },
    {
      customer: "Carlos Ruiz",
      owed: "28000",
      unbilled: "28000",
      entries: [entry("L-0004", "Carlos Ruiz", "alfajores", "28000", "unbilled")],
    },
    {
      customer: "Martina Gómez",
      owed: "9000",
      unbilled: "0",
      entries: [entry("L-0002", "Martina Gómez", "pan", "9000", "charged")],
    },
    {
      customer: "Lucía Fernández",
      owed: "0",
      unbilled: "0",
      entries: [entry("L-0005", "Lucía Fernández", "budín", "7500", "paid")],
    },
  ],
  totalOwed: "94000",
};

/** The ledger card with sample data; charging anyone takes the visitor to the demo, where it is real. */
export function SampleLedger() {
  return <LedgerCard ledger={SAMPLE} onCharge={() => window.location.assign("/demo")} />;
}
