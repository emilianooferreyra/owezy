import { type Money, money } from "../../../core/money/money";
import type { Charge } from "./charge";

/**
 * One line of the shop's ledger (the "libreta"): a customer took something and still owes it.
 * When the owner charges it, `chargeId` links the entry to that charge, so it is never charged twice.
 */
export type LedgerEntry = Readonly<{
  /** Short reference, e.g. L-0007. */
  id: string;
  customer: string;
  description: string;
  amount: Money;
  /** ISO 8601 timestamp of when the owner wrote it down. */
  recordedAt: string;
  /** Identifies the request that wrote it, so a retried request does not write it twice. */
  idempotencyKey?: string;
  /** The charge that includes this entry, once the owner charged it. */
  chargeId?: string;
}>;

/** Not charged yet, included in a pending charge, or paid through that charge. */
export type LedgerEntryStatus = "unbilled" | "charged" | "paid";

export type CustomerBalance = Readonly<{
  customer: string;
  /** Everything not paid yet: unbilled entries plus those in pending charges. */
  owed: Money;
  /** The part no charge includes yet: what charging this customer would ask for. */
  unbilled: Money;
  entries: readonly (LedgerEntry & Readonly<{ status: LedgerEntryStatus }>)[];
}>;

export class InvalidLedgerEntryError extends Error {
  constructor(field: "amount" | "customer" | "description") {
    super(field === "amount" ? "A ledger entry amount must be greater than zero" : `A ledger entry needs a ${field}`);
    this.name = "InvalidLedgerEntryError";
  }
}

export function createLedgerEntry(input: {
  id: string;
  customer: string;
  description: string;
  amount: Money;
  recordedAt: string;
  idempotencyKey?: string;
}): LedgerEntry {
  if (input.amount.amount <= 0n) {
    throw new InvalidLedgerEntryError("amount");
  }
  const customer = input.customer.trim().replace(/\s+/g, " ");
  const description = input.description.trim();
  if (!customer) {
    throw new InvalidLedgerEntryError("customer");
  }
  if (!description) {
    throw new InvalidLedgerEntryError("description");
  }
  return {
    id: input.id,
    customer,
    description,
    amount: input.amount,
    recordedAt: input.recordedAt,
    ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
  };
}

/** A name as the owner might type it: no case, accents or extra spaces. */
export function customerKey(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Whether two names are the same customer however they were typed. Never matches a partial name. */
export function sameCustomer(left: string, right: string): boolean {
  return customerKey(left) === customerKey(right);
}

/** Who a name the owner typed refers to: one customer in the ledger, several, or a new one. */
export type CustomerMatch =
  | Readonly<{ kind: "known"; customer: string }>
  | Readonly<{ kind: "ambiguous"; candidates: readonly string[] }>
  | Readonly<{ kind: "new" }>;

/**
 * Finds the customer the owner means, as the ledger first wrote the name. The full name always
 * wins; otherwise every word typed must be a whole word of the customer's name ("Martina" or
 * "Gómez" for Martina Gómez). A name that fits several customers is ambiguous, never a guess.
 */
export function resolveCustomer(entries: readonly LedgerEntry[], name: string): CustomerMatch {
  const key = customerKey(name);
  const customers = new Map<string, string>();
  for (const entry of entries) {
    const entryKey = customerKey(entry.customer);
    if (!customers.has(entryKey)) {
      customers.set(entryKey, entry.customer);
    }
  }

  const exact = customers.get(key);
  if (exact !== undefined) {
    return { kind: "known", customer: exact };
  }
  const words = key.split(" ").filter(Boolean);
  const candidates = [...customers.entries()]
    .filter(([entryKey]) => words.length > 0 && words.every((word) => entryKey.split(" ").includes(word)))
    .map(([, customer]) => customer);
  const [only] = candidates;
  if (only === undefined) {
    return { kind: "new" };
  }
  return candidates.length === 1 ? { kind: "known", customer: only } : { kind: "ambiguous", candidates };
}

function statusOf(entry: LedgerEntry, charges: ReadonlyMap<string, Charge>): LedgerEntryStatus {
  if (entry.chargeId === undefined) {
    return "unbilled";
  }
  return charges.get(entry.chargeId)?.status === "paid" ? "paid" : "charged";
}

const sum = (amounts: readonly Money[], currency: Money["currency"]): Money =>
  money(amounts.reduce((total, amount) => total + amount.amount, 0n), currency);

/**
 * What each customer owes, the one who owes most first. Entries are grouped by customer however
 * the name was typed, under the name first written down.
 */
export function summarizeLedger(
  entries: readonly LedgerEntry[],
  charges: readonly Charge[],
  filter: { customer?: string } = {},
): CustomerBalance[] {
  const chargesById = new Map(charges.map((charge) => [charge.id, charge]));
  const groups = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    if (filter.customer !== undefined && !sameCustomer(entry.customer, filter.customer)) {
      continue;
    }
    const key = customerKey(entry.customer);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return [...groups.values()]
    .map((group): CustomerBalance => {
      const [first] = group as [LedgerEntry, ...LedgerEntry[]];
      const withStatus = group.map((entry) => ({ ...entry, status: statusOf(entry, chargesById) }));
      const currency = first.amount.currency;
      return {
        customer: first.customer,
        owed: sum(withStatus.filter(({ status }) => status !== "paid").map(({ amount }) => amount), currency),
        unbilled: sum(withStatus.filter(({ status }) => status === "unbilled").map(({ amount }) => amount), currency),
        entries: withStatus,
      };
    })
    .sort((left, right) =>
      left.owed.amount === right.owed.amount
        ? left.customer.localeCompare(right.customer)
        : left.owed.amount > right.owed.amount
          ? -1
          : 1,
    );
}

/** The customer's entries that no charge includes yet: what charging them asks for. */
export function unbilledEntries(entries: readonly LedgerEntry[], customer: string): LedgerEntry[] {
  return entries.filter((entry) => entry.chargeId === undefined && sameCustomer(entry.customer, customer));
}

// Charge descriptions hold at most 120 characters.
const MAX_DESCRIPTION_LENGTH = 120;

/** What a charge built from ledger entries is for: the items, or a count when they do not fit. */
export function chargeDescription(entries: readonly LedgerEntry[]): string {
  const items = entries.map(({ description }) => description).join(" + ");
  return items.length <= MAX_DESCRIPTION_LENGTH ? items : `${entries.length} compras de la libreta`;
}

const REFERENCE_PATTERN = /^L-(\d+)$/;

/** The reference for a new entry: one past the highest existing L-nnnn. */
export function nextEntryReference(entries: readonly LedgerEntry[]): string {
  const highest = entries.reduce((max, entry) => Math.max(max, Number(REFERENCE_PATTERN.exec(entry.id)?.[1] ?? 0)), 0);
  return `L-${String(highest + 1).padStart(4, "0")}`;
}
