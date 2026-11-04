"use client";

import { localePath } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import type { Currency } from "@/core/money/money";
import type { LedgerView } from "@/features/charges/charges-feature";
import { LedgerCard } from "@/features/charges/ui";

type Status = "unbilled" | "charged" | "paid";

const entry = (currency: Currency) => (id: string, customer: string, description: string, amount: string, status: Status) => ({
  id,
  customer,
  description,
  amount,
  currency,
  recordedAt: "2026-11-03T15:00:00.000Z",
  status,
});

const ars = entry("wARS");
const brl = entry("wBRL");

// Fixed data, the same shops the demo starts with: the landing never reads the database.
const ARGENTINE_SAMPLE: LedgerView = {
  customers: [
    {
      customer: "Juan Pérez",
      owed: "57000",
      unbilled: "57000",
      entries: [
        ars("L-0001", "Juan Pérez", "medialunas", "12000", "unbilled"),
        ars("L-0003", "Juan Pérez", "torta", "45000", "unbilled"),
      ],
    },
    {
      customer: "Carlos Ruiz",
      owed: "28000",
      unbilled: "28000",
      entries: [ars("L-0004", "Carlos Ruiz", "alfajores", "28000", "unbilled")],
    },
    {
      customer: "Martina Gómez",
      owed: "9000",
      unbilled: "0",
      entries: [ars("L-0002", "Martina Gómez", "pan", "9000", "charged")],
    },
    {
      customer: "Lucía Fernández",
      owed: "0",
      unbilled: "0",
      entries: [ars("L-0005", "Lucía Fernández", "budín", "7500", "paid")],
    },
  ],
  totalOwed: "94000",
};

// Bia's bakery in São Paulo, matching the Portuguese hero scene (João owes R$ 570).
const BRAZILIAN_SAMPLE: LedgerView = {
  customers: [
    {
      customer: "João Silva",
      owed: "570",
      unbilled: "570",
      entries: [
        brl("L-0001", "João Silva", "pão de queijo", "120", "unbilled"),
        brl("L-0003", "João Silva", "bolo de aniversário", "450", "unbilled"),
      ],
    },
    {
      customer: "Pedro Santos",
      owed: "280",
      unbilled: "280",
      entries: [brl("L-0004", "Pedro Santos", "brigadeiros", "280", "unbilled")],
    },
    {
      customer: "Ana Costa",
      owed: "90",
      unbilled: "0",
      entries: [brl("L-0002", "Ana Costa", "pão francês", "90", "charged")],
    },
    {
      customer: "Beatriz Lima",
      owed: "0",
      unbilled: "0",
      entries: [brl("L-0005", "Beatriz Lima", "bolo de fubá", "75", "paid")],
    },
  ],
  totalOwed: "940",
};

/**
 * The ledger card with sample data: Brazilian customers in reais for a Portuguese visitor, Argentine
 * ones in pesos otherwise. Charging anyone takes the visitor to the demo, where it is real.
 */
export function SampleLedger() {
  const { locale } = useI18n();
  const brazilian = locale === "pt-BR";
  return (
    <LedgerCard
      ledger={brazilian ? BRAZILIAN_SAMPLE : ARGENTINE_SAMPLE}
      currency={brazilian ? "wBRL" : "wARS"}
      onCharge={() => window.location.assign(localePath(locale, "/demo"))}
    />
  );
}
