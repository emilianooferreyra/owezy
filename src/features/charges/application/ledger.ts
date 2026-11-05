import { type Currency, DEFAULT_CURRENCY, type Money, money } from "../../../core/money/money";
import {
  chargeDescription,
  createLedgerEntry,
  customerKey,
  type LedgerEntry,
  nextEntryReference,
  resolveCustomer,
  unbilledEntries,
} from "../domain/ledger";
import type { CreateChargeRequest, CreateChargeResult } from "./create-charge";
import { type ChargeRepository, LedgerConflictError, type LedgerRepository, type PaymentLinkBuilder } from "./ports";

// Two writers saving at once is rare (one owner, one agent), so a few attempts always settle it.
const MAX_ATTEMPTS = 3;

export class NothingToChargeError extends Error {
  constructor(customer: string) {
    super(`${customer} has nothing in the ledger that is not charged already`);
    this.name = "NothingToChargeError";
  }
}

/** The name the owner used fits more than one customer: the agent asks which one. */
export class AmbiguousCustomerError extends Error {
  readonly candidates: readonly string[];

  constructor(name: string, candidates: readonly string[]) {
    super(`"${name}" could be ${candidates.join(" or ")}`);
    this.name = "AmbiguousCustomerError";
    this.candidates = candidates;
  }
}

/** One country's part of the ledger. References still count over the whole ledger, so they never repeat. */
function inCurrency(entries: readonly LedgerEntry[], currency: Currency): readonly LedgerEntry[] {
  return entries.filter((entry) => entry.amount.currency === currency);
}

/** The ledger's name for the customer, the typed name for a new one, or an error when it is ambiguous. */
function customerNamed(entries: readonly LedgerEntry[], name: string): string {
  const match = resolveCustomer(entries, name);
  if (match.kind === "ambiguous") {
    throw new AmbiguousCustomerError(name, match.candidates);
  }
  return match.kind === "known" ? match.customer : name;
}

export type AddToLedgerRequest = Readonly<{
  /** Identifies the owner's request, e.g. `${sessionId}:${turnId}`. Stable when the agent retries. */
  requestId: string;
  customer: string;
  description: string;
  amount: Money;
}>;

export type AddToLedgerResult = Readonly<{
  entry: LedgerEntry;
  /** false when the same request already wrote this entry (the call was a safe retry). */
  created: boolean;
}>;

/**
 * The same request writing the same purchase: a retry, never a second entry. Keyed by the
 * customer the ledger resolved, so "Martina" and "Martina Gómez" in one request are one purchase.
 */
function idempotencyKeyOf(request: AddToLedgerRequest, customer: string): string {
  const description = request.description.trim().toLowerCase();
  return [request.requestId, customerKey(customer), description, request.amount.currency, request.amount.amount].join("|");
}

export function addToLedgerUseCase(deps: { ledger: LedgerRepository; now: () => Date }) {
  async function attempt(request: AddToLedgerRequest): Promise<AddToLedgerResult> {
    const entries = await deps.ledger.list();
    // Customers belong to one country's shop: a Brazilian "Ana" is never the Argentine "Ana Pérez".
    const customer = customerNamed(inCurrency(entries, request.amount.currency), request.customer);
    const idempotencyKey = idempotencyKeyOf(request, customer);
    const existing = entries.find((entry) => entry.idempotencyKey === idempotencyKey);
    if (existing) {
      return { entry: existing, created: false };
    }
    const entry = createLedgerEntry({
      id: nextEntryReference(entries),
      customer,
      description: request.description,
      amount: request.amount,
      recordedAt: deps.now().toISOString(),
      idempotencyKey,
    });
    await deps.ledger.add(entry);
    return { entry, created: true };
  }

  return async (request: AddToLedgerRequest): Promise<AddToLedgerResult> => {
    for (let attempts = 1; ; attempts += 1) {
      try {
        return await attempt(request);
      } catch (error) {
        if (!(error instanceof LedgerConflictError) || attempts >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  };
}

export type ChargeFromLedgerResult = CreateChargeResult & Readonly<{ entries: readonly LedgerEntry[] }>;

/**
 * Charges a customer for everything in the ledger no charge includes yet, in a single charge, and
 * links those entries to it so they are never charged twice.
 */
export function chargeFromLedgerUseCase(deps: {
  ledger: LedgerRepository;
  charges: ChargeRepository;
  buildPaymentLink: PaymentLinkBuilder;
  createCharge: (request: CreateChargeRequest) => Promise<CreateChargeResult>;
}) {
  type Request = Readonly<{
    requestId: string;
    customer: string;
    /** The shop's country: only its customers and entries are charged. */
    currency?: Currency;
  }>;

  async function attempt(request: Request): Promise<ChargeFromLedgerResult> {
    const entries = inCurrency(await deps.ledger.list(), request.currency ?? DEFAULT_CURRENCY);
    const open = unbilledEntries(entries, customerNamed(entries, request.customer));
    const [first] = open;
    if (!first) {
      // A retry of a request that already finished: return the charge it created.
      const earlier = (await deps.charges.list()).find((charge) =>
        charge.idempotencyKey?.startsWith(`${request.requestId}|`),
      );
      const linked = earlier && entries.filter((entry) => entry.chargeId === earlier.id);
      if (earlier && linked && linked.length > 0) {
        return { charge: earlier, paymentLink: deps.buildPaymentLink(earlier), created: false, entries: linked };
      }
      throw new NothingToChargeError(request.customer);
    }

    const total = open.reduce((sum, entry) => sum + entry.amount.amount, 0n);
    const result = await deps.createCharge({
      requestId: request.requestId,
      customer: first.customer,
      description: chargeDescription(open),
      amount: money(total, first.amount.currency),
    });
    const linked = new Set(
      await deps.ledger.assignCharge(
        open.map(({ id }) => id),
        result.charge.id,
      ),
    );
    if (open.some((entry) => !linked.has(entry.id))) {
      // Another request charged some of these entries between this one's read and its link. The
      // charge this request just made is for entries it does not own: undo it before anyone sees
      // it, then read the ledger again.
      if (result.created) {
        await deps.ledger.releaseCharge(result.charge.id);
        await deps.charges.discard(result.charge);
      }
      throw new LedgerConflictError(first.id);
    }
    return { ...result, entries: open.map((entry) => ({ ...entry, chargeId: result.charge.id })) };
  }

  return async (request: Request): Promise<ChargeFromLedgerResult> => {
    for (let attempts = 1; ; attempts += 1) {
      try {
        return await attempt(request);
      } catch (error) {
        if (!(error instanceof LedgerConflictError) || attempts >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  };
}
