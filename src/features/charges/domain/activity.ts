import type { Money } from "../../../core/money/money";
import type { Charge, IncomingTransfer } from "./charge";

type PaymentEvent<Kind extends string> = Readonly<{
  /** Stable per kind and transfer, so recording the same event twice keeps one entry. */
  id: `${Kind}:${string}`;
  kind: Kind;
  transferId: string;
  amount: Money;
  /** When the money arrived. */
  receivedAt: string;
  /** When the agent noticed it. */
  recordedAt: string;
}>;

/** Something the agent did or noticed on its own, for the owner to see. */
export type ActivityEntry =
  | (PaymentEvent<"payment-matched"> & Readonly<{ chargeId: string; customer: string }>)
  | PaymentEvent<"payment-unmatched">
  | (PaymentEvent<"payment-ambiguous"> & Readonly<{ chargeIds: readonly string[] }>);

function paymentEvent<Kind extends ActivityEntry["kind"]>(kind: Kind, transfer: IncomingTransfer, recordedAt: string) {
  return {
    id: `${kind}:${transfer.id}` as const,
    kind,
    transferId: transfer.id,
    amount: transfer.amount,
    receivedAt: transfer.receivedAt,
    recordedAt,
  };
}

export function matchedPayment(transfer: IncomingTransfer, charge: Charge, recordedAt: string): ActivityEntry {
  return { ...paymentEvent("payment-matched", transfer, recordedAt), chargeId: charge.id, customer: charge.customer };
}

export function unmatchedPayment(transfer: IncomingTransfer, recordedAt: string): ActivityEntry {
  return paymentEvent("payment-unmatched", transfer, recordedAt);
}

export function ambiguousPayment(
  transfer: IncomingTransfer,
  candidates: readonly Charge[],
  recordedAt: string,
): ActivityEntry {
  return { ...paymentEvent("payment-ambiguous", transfer, recordedAt), chargeIds: candidates.map(({ id }) => id) };
}
