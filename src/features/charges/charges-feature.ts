import { type Currency, DEFAULT_CURRENCY, fromDecimalString, money, toDecimalString } from "../../core/money/money";
import { createChargeUseCase } from "./application/create-charge";
import { addToLedgerUseCase, chargeFromLedgerUseCase } from "./application/ledger";
import type {
  ActivityLog,
  ChargeRepository,
  LedgerRepository,
  PaymentLinkBuilder,
  PaymentSimulator,
  TransferSource,
} from "./application/ports";
import { type ReconciliationReport, reconcilePaymentsUseCase } from "./application/reconcile-payments";
import type { ActivityEntry } from "./domain/activity";
import { type Charge, type ChargeStatus, newestFirst } from "./domain/charge";
import { type LedgerEntry, type LedgerEntryStatus, resolveCustomer, summarizeLedger } from "./domain/ledger";

/** Every customer a name could be: one, several when it is ambiguous, or none. */
function customersNamed(entries: readonly LedgerEntry[], name: string): readonly string[] {
  const match = resolveCustomer(entries, name);
  return match.kind === "known" ? [match.customer] : match.kind === "ambiguous" ? match.candidates : [];
}

export class ChargeNotFoundError extends Error {
  constructor(id: string) {
    super(`Charge ${id} does not exist`);
    this.name = "ChargeNotFoundError";
  }
}

export class LedgerUnavailableError extends Error {
  constructor() {
    super("This deployment has no ledger configured");
    this.name = "LedgerUnavailableError";
  }
}

export class PaymentSimulationUnavailableError extends Error {
  constructor() {
    super("Payments can only be simulated in simulated mode");
    this.name = "PaymentSimulationUnavailableError";
  }
}

/** A charge as plain JSON: amounts are decimal strings, never bigint. */
export type ChargeView = Readonly<{
  id: string;
  customer: string;
  description: string;
  amount: string;
  currency: string;
  status: ChargeStatus;
  createdAt: string;
  paymentLink: string;
  /** When the charge was paid, for the receipt. */
  paidAt?: string;
  /** The transfer that paid the charge: the receipt's operation number. */
  paidBy?: string;
  /** Only on creation: false when the same request already created it (a safe retry). */
  created?: boolean;
}>;

export type ChargeList = Readonly<{
  /** The newest matching charges, up to the limit. */
  charges: readonly ChargeView[];
  /** How many charges match, beyond the limit too. */
  count: number;
  /** What every matching charge is worth together, as a decimal string. */
  total: string;
}>;

type Viewed<Entry> = Entry extends unknown
  ? Omit<Entry, "amount"> & Readonly<{ amount: string; currency: string }>
  : never;

/** What the agent did, as plain JSON: the amount is a decimal string, never bigint. */
export type ActivityView = Viewed<ActivityEntry>;

/** A ledger entry as plain JSON: the amount is a decimal string, never bigint. */
export type LedgerEntryView = Readonly<{
  id: string;
  customer: string;
  description: string;
  amount: string;
  currency: string;
  recordedAt: string;
  status: LedgerEntryStatus;
  /** The charge that includes it, once the owner charged it. */
  chargeId?: string;
}>;

export type LedgerView = Readonly<{
  /** The customers in the ledger, the one who owes most first. */
  customers: readonly Readonly<{
    customer: string;
    /** Not paid yet: unbilled entries plus those in pending charges. */
    owed: string;
    /** What no charge includes yet: what charging this customer would ask for. */
    unbilled: string;
    entries: readonly LedgerEntryView[];
  }>[];
  /** What every customer listed owes together. */
  totalOwed: string;
}>;

const DEFAULT_LIST_LIMIT = 20;

export type SimulatedPaymentOutcome = "paid" | "already-paid" | "ambiguous";

/**
 * Wires the charges feature. A shop charges in its country's currency (wARS by default, or wBRL):
 * every call names it, and lists, totals and ledgers only ever show that currency.
 */
export function createChargesFeature(deps: {
  charges: ChargeRepository;
  buildPaymentLink: PaymentLinkBuilder;
  now?: () => Date;
  /** Present only in simulated mode. */
  simulator?: PaymentSimulator;
  /** Where real transfers come from (the chain) in ripio mode. */
  transfers?: TransferSource;
  /** Where every reconciliation leaves what it found, for the owner to see. */
  activity?: ActivityLog;
  /** The shop's ledger ("libreta") of what customers took and still owe. */
  ledger?: LedgerRepository;
}) {
  const transfers = deps.transfers ?? deps.simulator;
  const now = deps.now ?? (() => new Date());

  function reconcileFrom(source: TransferSource) {
    return reconcilePaymentsUseCase({
      charges: deps.charges,
      transfers: source,
      now,
      ...(deps.activity === undefined ? {} : { activity: deps.activity }),
    })();
  }
  const createCharge = createChargeUseCase({
    charges: deps.charges,
    buildPaymentLink: deps.buildPaymentLink,
    now,
  });

  function toView(charge: Charge): ChargeView {
    return {
      id: charge.id,
      customer: charge.customer,
      description: charge.description,
      amount: toDecimalString(charge.amount),
      currency: charge.amount.currency,
      status: charge.status,
      createdAt: charge.createdAt,
      paymentLink: deps.buildPaymentLink(charge),
      ...(charge.paidAt === undefined ? {} : { paidAt: charge.paidAt }),
      ...(charge.paidBy === undefined ? {} : { paidBy: charge.paidBy }),
    };
  }

  async function findOrFail(id: string): Promise<Charge> {
    const charge = await deps.charges.findById(id);
    if (!charge) {
      throw new ChargeNotFoundError(id);
    }
    return charge;
  }

  function ledgerOrFail(): LedgerRepository {
    if (!deps.ledger) {
      throw new LedgerUnavailableError();
    }
    return deps.ledger;
  }

  function toEntryView(entry: LedgerEntry, status: LedgerEntryStatus): LedgerEntryView {
    return {
      id: entry.id,
      customer: entry.customer,
      description: entry.description,
      amount: toDecimalString(entry.amount),
      currency: entry.amount.currency,
      recordedAt: entry.recordedAt,
      status,
      ...(entry.chargeId === undefined ? {} : { chargeId: entry.chargeId }),
    };
  }

  async function syncPayments(): Promise<ReconciliationReport> {
    if (!transfers) {
      return { paid: [], unmatched: [], ambiguous: [] };
    }
    return reconcileFrom(transfers);
  }

  return {
    async createCharge(input: {
      requestId: string;
      customer: string;
      description: string;
      /** Whole units of the currency as a decimal string, e.g. "85000". */
      amount: string;
      currency?: Currency;
    }): Promise<ChargeView> {
      const { currency = DEFAULT_CURRENCY, ...request } = input;
      const result = await createCharge({ ...request, amount: fromDecimalString(input.amount, currency) });
      return { ...toView(result.charge), created: result.created };
    },

    /** Reconciles the transfers that arrived (on-chain, or simulated) with the pending charges. */
    syncPayments,

    async getCharge(id: string): Promise<ChargeView | undefined> {
      const charge = await deps.charges.findById(id);
      return charge && toView(charge);
    },

    /**
     * An existing charge with its link, for sending it again. It reconciles first, so a charge
     * that was already paid shows as paid. A charge of another country's shop does not exist here.
     */
    async shareCharge(input: { reference: string; currency?: Currency }): Promise<ChargeView> {
      await syncPayments();
      const charge = await findOrFail(input.reference);
      if (charge.amount.currency !== (input.currency ?? DEFAULT_CURRENCY)) {
        throw new ChargeNotFoundError(input.reference);
      }
      return toView(charge);
    },

    /** Several charges with one repository read, for the cards' shared status poll. */
    async getCharges(ids: readonly string[]): Promise<ChargeView[]> {
      const byId = new Map((await deps.charges.list()).map((charge) => [charge.id, charge]));
      return ids.flatMap((id) => {
        const charge = byId.get(id);
        return charge ? [toView(charge)] : [];
      });
    },

    /**
     * The business's charges, newest first. It reconciles first, so a payment that already
     * arrived shows as paid instead of pending.
     */
    async listCharges(filter: {
      status?: ChargeStatus | undefined;
      limit?: number;
      currency?: Currency;
    }): Promise<ChargeList> {
      await syncPayments();
      const currency = filter.currency ?? DEFAULT_CURRENCY;
      const matching = newestFirst(await deps.charges.list()).filter(
        (charge) =>
          charge.amount.currency === currency && (filter.status === undefined || charge.status === filter.status),
      );
      const total = matching.reduce((sum, charge) => sum + charge.amount.amount, 0n);
      return {
        charges: matching.slice(0, filter.limit ?? DEFAULT_LIST_LIMIT).map(toView),
        count: matching.length,
        total: toDecimalString(money(total, currency)),
      };
    },

    /**
     * What the agent did on its own, newest first. Only reads: the scheduled reconciliation
     * writes it, so the owner's panel can poll without reading the chain.
     */
    async listActivity(filter: { limit?: number; currency?: Currency }): Promise<ActivityView[]> {
      const currency = filter.currency ?? DEFAULT_CURRENCY;
      const entries = ((await deps.activity?.list()) ?? []).filter((entry) => entry.amount.currency === currency);
      // The log is append-only, so the newest entries are last.
      return [...entries]
        .reverse()
        .slice(0, filter.limit ?? DEFAULT_LIST_LIMIT)
        .map((entry) => ({ ...entry, amount: toDecimalString(entry.amount), currency: entry.amount.currency }));
    },

    /**
     * What each customer owes, from the ledger. It reconciles first, so entries whose charge was
     * paid show as paid.
     */
    async readLedger(filter: { customer?: string | undefined; currency?: Currency }): Promise<LedgerView> {
      const ledger = ledgerOrFail();
      await syncPayments();
      const currency = filter.currency ?? DEFAULT_CURRENCY;
      const entries = (await ledger.list()).filter((entry) => entry.amount.currency === currency);
      const charges = (await deps.charges.list()).filter((charge) => charge.amount.currency === currency);
      const all = summarizeLedger(entries, charges);
      const wanted = filter.customer === undefined ? undefined : customersNamed(entries, filter.customer);
      const balances = wanted === undefined ? all : all.filter(({ customer }) => wanted.includes(customer));
      const totalOwed = balances.reduce((sum, { owed }) => sum + owed.amount, 0n);
      return {
        customers: balances.map((balance) => ({
          customer: balance.customer,
          owed: toDecimalString(balance.owed),
          unbilled: toDecimalString(balance.unbilled),
          entries: balance.entries.map((entry) => toEntryView(entry, entry.status)),
        })),
        totalOwed: toDecimalString(money(totalOwed, currency)),
      };
    },

    /** Writes down that a customer took something and still owes it. */
    async addToLedger(input: {
      requestId: string;
      customer: string;
      description: string;
      /** Whole units of the currency as a decimal string, e.g. "30000". */
      amount: string;
      currency?: Currency;
    }): Promise<{ entry: LedgerEntryView; created: boolean }> {
      const add = addToLedgerUseCase({ ledger: ledgerOrFail(), now });
      const { currency = DEFAULT_CURRENCY, ...request } = input;
      const { entry, created } = await add({ ...request, amount: fromDecimalString(input.amount, currency) });
      return { entry: toEntryView(entry, "unbilled"), created };
    },

    /** Charges a customer for everything in the ledger not charged yet, in one charge. */
    async chargeFromLedger(input: {
      requestId: string;
      customer: string;
      currency?: Currency;
    }): Promise<ChargeView & { entries: readonly string[] }> {
      const charge = chargeFromLedgerUseCase({
        ledger: ledgerOrFail(),
        charges: deps.charges,
        buildPaymentLink: deps.buildPaymentLink,
        createCharge,
      });
      const result = await charge(input);
      return { ...toView(result.charge), created: result.created, entries: result.entries.map(({ id }) => id) };
    },

    /** Fakes the payer's transfer, then runs the same reconciliation real transfers go through. */
    async simulatePayment(id: string): Promise<{ charge: ChargeView; outcome: SimulatedPaymentOutcome }> {
      const simulator = deps.simulator;
      if (!simulator) {
        throw new PaymentSimulationUnavailableError();
      }

      const charge = await findOrFail(id);
      if (charge.status === "paid") {
        return { charge: toView(charge), outcome: "already-paid" };
      }

      await simulator.simulatePayment(charge.amount);
      const report = await reconcileFrom(simulator);
      const updated = await findOrFail(id);
      return { charge: toView(updated), outcome: report.paid.includes(id) ? "paid" : "ambiguous" };
    },
  };
}

export type ChargesFeature = ReturnType<typeof createChargesFeature>;
