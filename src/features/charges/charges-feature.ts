import { fromDecimalString, money, toDecimalString } from "../../core/money/money";
import { createChargeUseCase } from "./application/create-charge";
import type {
  ActivityLog,
  ChargeRepository,
  PaymentLinkBuilder,
  PaymentSimulator,
  TransferSource,
} from "./application/ports";
import { type ReconciliationReport, reconcilePaymentsUseCase } from "./application/reconcile-payments";
import { type Charge, type ChargeStatus, newestFirst } from "./domain/charge";

export class ChargeNotFoundError extends Error {
  constructor(id: string) {
    super(`Charge ${id} does not exist`);
    this.name = "ChargeNotFoundError";
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

const DEFAULT_LIST_LIMIT = 20;

export type SimulatedPaymentOutcome = "paid" | "already-paid" | "ambiguous";

/** Wires the charges feature. Phase 1 charges in wARS only. */
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
      /** Whole pesos as a decimal string, e.g. "85000". */
      amount: string;
    }): Promise<ChargeView> {
      const result = await createCharge({ ...input, amount: fromDecimalString(input.amount, "wARS") });
      return { ...toView(result.charge), created: result.created };
    },

    /** Reconciles the transfers that arrived (on-chain, or simulated) with the pending charges. */
    syncPayments,

    async getCharge(id: string): Promise<ChargeView | undefined> {
      const charge = await deps.charges.findById(id);
      return charge && toView(charge);
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
    async listCharges(filter: { status?: ChargeStatus | undefined; limit?: number }): Promise<ChargeList> {
      await syncPayments();
      const matching = newestFirst(await deps.charges.list()).filter(
        (charge) => filter.status === undefined || charge.status === filter.status,
      );
      const total = matching.reduce((sum, charge) => sum + charge.amount.amount, 0n);
      return {
        charges: matching.slice(0, filter.limit ?? DEFAULT_LIST_LIMIT).map(toView),
        count: matching.length,
        total: toDecimalString(money(total, "wARS")),
      };
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
