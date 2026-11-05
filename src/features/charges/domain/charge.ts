import { equals, exceedsMaximum, MAX_WHOLE_UNITS, type Money, money, oneCent } from "../../../core/money/money";

export type ChargeStatus = "pending" | "paid";

export type Charge = Readonly<{
  /** Short reference the owner and the payer see, e.g. C-0007. */
  id: string;
  customer: string;
  description: string;
  amount: Money;
  /** ISO 8601 timestamp. */
  createdAt: string;
  status: ChargeStatus;
  /** Identifies the request that created the charge, so a retried request returns the same charge. */
  idempotencyKey?: string;
  /** Id of the transfer that paid the charge, so the same transfer never pays twice. */
  paidBy?: string;
  /** ISO 8601 timestamp of the paying transfer. */
  paidAt?: string;
}>;

/** A token transfer that arrived at the business address. */
export type IncomingTransfer = Readonly<{
  /** Unique per transfer, e.g. `${txHash}:${logIndex}` on-chain. */
  id: string;
  amount: Money;
  /** ISO 8601 timestamp: the block time on-chain. */
  receivedAt: string;
}>;

export type TransferMatch =
  | Readonly<{ kind: "matched"; charge: Charge }>
  | Readonly<{ kind: "unmatched" }>
  | Readonly<{ kind: "ambiguous"; candidates: readonly Charge[] }>;

export class InvalidChargeAmountError extends Error {
  constructor(amount: bigint) {
    super(
      amount <= 0n
        ? `A charge amount must be greater than zero, got ${amount}`
        : `A charge amount must be at most ${MAX_WHOLE_UNITS} whole units`,
    );
    this.name = "InvalidChargeAmountError";
  }
}

export class InvalidChargeDetailsError extends Error {
  constructor(field: "customer" | "description") {
    super(`A charge needs a ${field}`);
    this.name = "InvalidChargeDetailsError";
  }
}

export function createCharge(input: {
  id: string;
  customer: string;
  description: string;
  amount: Money;
  createdAt: string;
  idempotencyKey?: string;
}): Charge {
  if (input.amount.amount <= 0n || exceedsMaximum(input.amount)) {
    throw new InvalidChargeAmountError(input.amount.amount);
  }
  const customer = input.customer.trim();
  const description = input.description.trim();
  if (!customer) {
    throw new InvalidChargeDetailsError("customer");
  }
  if (!description) {
    throw new InvalidChargeDetailsError("description");
  }

  return {
    id: input.id,
    customer,
    description,
    amount: input.amount,
    createdAt: input.createdAt,
    status: "pending",
    ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
  };
}

export function applyPayment(charge: Charge, transfer: IncomingTransfer): Charge {
  if (charge.status === "pending" && equals(transfer.amount, charge.amount)) {
    return { ...charge, status: "paid", paidBy: transfer.id, paidAt: transfer.receivedAt };
  }

  return charge;
}

/**
 * Finds the pending charge a transfer pays. The ramp link carries no order reference, so
 * the amount is the only key: when two pending charges share it, the transfer is ambiguous
 * and a person decides. Money is never assigned by guessing, and a transfer only pays charges
 * that already existed when it arrived.
 */
export function matchTransfer(charges: readonly Charge[], transfer: IncomingTransfer): TransferMatch {
  const candidates = charges.filter(
    (charge) =>
      charge.status === "pending" &&
      Date.parse(charge.createdAt) <= Date.parse(transfer.receivedAt) &&
      charge.amount.currency === transfer.amount.currency &&
      equals(charge.amount, transfer.amount),
  );

  const [only] = candidates;
  if (candidates.length === 1 && only) {
    return { kind: "matched", charge: only };
  }
  return candidates.length === 0 ? { kind: "unmatched" } : { kind: "ambiguous", candidates };
}

/**
 * The amount to charge so no two pending charges share one: the ramp link carries no reference,
 * so the amount is how a transfer finds its charge. A taken amount gets one cent more, then two,
 * until it is free; paid charges no longer compete.
 */
export function distinctPendingAmount(requested: Money, charges: readonly Charge[]): Money {
  const taken = new Set(
    charges
      .filter((charge) => charge.status === "pending" && charge.amount.currency === requested.currency)
      .map((charge) => charge.amount.amount),
  );
  const cent = oneCent(requested.currency).amount;
  let amount = requested.amount;
  while (taken.has(amount)) {
    amount += cent;
  }
  return money(amount, requested.currency);
}

const REFERENCE_PATTERN = /^C-(\d+)$/;

/** Whether an id is a charge reference (C-nnnn), e.g. before using one that came from a URL. */
export function isChargeReference(id: string): boolean {
  return REFERENCE_PATTERN.test(id);
}

/** The number in a C-nnnn reference, or 0 for any other id. */
function referenceNumber(charge: Charge): number {
  const number = REFERENCE_PATTERN.exec(charge.id)?.[1];
  return number === undefined ? 0 : Number(number);
}

/** The reference for a new charge: one past the highest existing C-nnnn. */
export function nextChargeReference(charges: readonly Charge[]): string {
  const highest = charges.reduce((max, charge) => Math.max(max, referenceNumber(charge)), 0);
  return `C-${String(highest + 1).padStart(4, "0")}`;
}

/** Charges from the most recent; charges created in the same instant keep their reference order. */
export function newestFirst(charges: readonly Charge[]): Charge[] {
  return [...charges].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) || referenceNumber(right) - referenceNumber(left),
  );
}
