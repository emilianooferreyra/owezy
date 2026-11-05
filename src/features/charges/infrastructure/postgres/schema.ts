import { sql } from "drizzle-orm";
import { bigserial, check, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// wARS has 18 decimals: $85.000 is 8.5e22 base units, beyond bigint (int8). numeric(78, 0) holds
// any uint256, and Drizzle hands it back as a JavaScript bigint.
const baseUnits = () => numeric({ precision: 78, scale: 0, mode: "bigint" }).notNull();
const instant = () => timestamp({ withTimezone: true, mode: "date" });

export const charges = pgTable(
  "charges",
  {
    id: text().primaryKey(),
    customer: text().notNull(),
    description: text().notNull(),
    amount: baseUnits(),
    currency: text().notNull(),
    createdAt: instant().notNull(),
    status: text().notNull(),
    idempotencyKey: text().unique(),
    // One transfer pays one charge, even if two reconciliations race.
    paidBy: text().unique(),
    paidAt: instant(),
  },
  (table) => [
    check("charges_status", sql`${table.status} in ('pending', 'paid')`),
    check("charges_amount_positive", sql`${table.amount} > 0`),
    // Reconciliation matches by exact amount, so two pending charges must never share one.
    uniqueIndex("charges_pending_amount").on(table.currency, table.amount).where(sql`${table.status} = 'pending'`),
  ],
);

export const activity = pgTable("activity", {
  // Insertion order: the log is append-only and read oldest first.
  seq: bigserial({ mode: "number" }).primaryKey(),
  id: text().notNull().unique(),
  kind: text().notNull(),
  transferId: text().notNull(),
  amount: baseUnits(),
  currency: text().notNull(),
  receivedAt: instant().notNull(),
  recordedAt: instant().notNull(),
  /** What only some kinds carry: the charge and customer, or the candidate charges. */
  details: jsonb().notNull(),
});

/** How far the on-chain scan got. One row per business address. */
export const scanCursor = pgTable("scan_cursor", {
  recipient: text().primaryKey(),
  lastBlock: numeric({ precision: 78, scale: 0, mode: "bigint" }),
});

/** Transfers the on-chain scan found, in the order it found them. */
export const scannedTransfers = pgTable("scanned_transfers", {
  seq: bigserial({ mode: "number" }).primaryKey(),
  recipient: text().notNull(),
  id: text().notNull().unique(),
  amount: baseUnits(),
  currency: text().notNull(),
  receivedAt: instant().notNull(),
});

/** Demo payments. The sequence names them: simulated-1, simulated-2... */
export const simulatedTransfers = pgTable("simulated_transfers", {
  seq: bigserial({ mode: "number" }).primaryKey(),
  amount: baseUnits(),
  currency: text().notNull(),
  receivedAt: instant().notNull(),
});

/** The shop's ledger ("libreta"): what customers took and still owe, in the order written down. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    seq: bigserial({ mode: "number" }).primaryKey(),
    id: text().notNull().unique(),
    customer: text().notNull(),
    description: text().notNull(),
    amount: baseUnits(),
    currency: text().notNull(),
    recordedAt: instant().notNull(),
    idempotencyKey: text().unique(),
    /** The charge that includes the entry, once the owner charged it. */
    chargeId: text().references(() => charges.id),
  },
  (table) => [check("ledger_entries_amount_positive", sql`${table.amount} > 0`)],
);
