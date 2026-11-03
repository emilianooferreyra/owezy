import type { Money } from "../../../core/money/money";
import type { ActivityEntry } from "../domain/activity";
import type { Charge, IncomingTransfer } from "../domain/charge";
import type { LedgerEntry } from "../domain/ledger";

export interface ChargeRepository {
  findById(id: string): Promise<Charge | undefined>;
  findByIdempotencyKey(key: string): Promise<Charge | undefined>;
  list(): Promise<readonly Charge[]>;
  save(charge: Charge): Promise<void>;
}

/** What the agent did on its own. Append-only: recording an entry whose id is already there keeps the first. */
export interface ActivityLog {
  record(entries: readonly ActivityEntry[]): Promise<void>;
  list(): Promise<readonly ActivityEntry[]>;
}

/** Builds the link the payer opens to pay a charge. */
export type PaymentLinkBuilder = (charge: Charge) => string;

/** Transfers that arrived at the business address: on-chain in production, simulated in demos. */
export interface TransferSource {
  listIncoming(): Promise<readonly IncomingTransfer[]>;
}

/** A transfer source that can also fake a payment. Only demos have one: there is no real-money path. */
export interface PaymentSimulator extends TransferSource {
  simulatePayment(amount: Money): Promise<IncomingTransfer>;
}

/**
 * Saving would break a rule another writer got to first: the reference is taken, another pending
 * charge has the same amount, or the transfer already paid a charge. Reading again and retrying
 * resolves it.
 */
export class ChargeConflictError extends Error {
  constructor(chargeId: string, options?: { cause?: unknown }) {
    super(`Charge ${chargeId} conflicts with one saved at the same time`, options);
    this.name = "ChargeConflictError";
  }
}

/** The shop's ledger ("libreta"): what customers took and still owe. */
export interface LedgerRepository {
  list(): Promise<readonly LedgerEntry[]>;
  /** Writes a new entry. Throws LedgerConflictError when another writer took its reference first. */
  add(entry: LedgerEntry): Promise<void>;
  /** Links entries to the charge that includes them. Entries already in a charge are left as they are. */
  assignCharge(entryIds: readonly string[], chargeId: string): Promise<void>;
}

/** Another writer saved an entry with the same reference first. Reading again and retrying resolves it. */
export class LedgerConflictError extends Error {
  constructor(entryId: string, options?: { cause?: unknown }) {
    super(`Ledger entry ${entryId} conflicts with one saved at the same time`, options);
    this.name = "LedgerConflictError";
  }
}
