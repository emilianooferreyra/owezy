import type { Money } from "../../../core/money/money";
import { type Charge, createCharge, distinctPendingAmount, nextChargeReference } from "../domain/charge";
import { ChargeConflictError, type ChargeRepository, type PaymentLinkBuilder } from "./ports";

// Two requests saving at once is rare (one owner, one agent), so a few attempts always settle it.
const MAX_ATTEMPTS = 3;

export type CreateChargeResult = Readonly<{
  charge: Charge;
  paymentLink: string;
  /** false when the same request already created this charge (the call was a safe retry). */
  created: boolean;
}>;

export type CreateChargeRequest = Readonly<{
  /** Identifies the owner's request, e.g. `${sessionId}:${turnId}`. Stable when the agent retries. */
  requestId: string;
  customer: string;
  description: string;
  amount: Money;
}>;

/** The same request asking for the same charge: a retry, never a second charge. */
function idempotencyKeyOf(request: CreateChargeRequest): string {
  const customer = request.customer.trim().toLowerCase();
  const description = request.description.trim().toLowerCase();
  return [request.requestId, customer, description, request.amount.currency, request.amount.amount].join("|");
}

export function createChargeUseCase(deps: {
  charges: ChargeRepository;
  buildPaymentLink: PaymentLinkBuilder;
  now: () => Date;
}) {
  async function attempt(request: CreateChargeRequest, idempotencyKey: string): Promise<CreateChargeResult> {
    const existing = await deps.charges.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { charge: existing, paymentLink: deps.buildPaymentLink(existing), created: false };
    }

    const charges = await deps.charges.list();
    const charge = createCharge({
      id: nextChargeReference(charges),
      customer: request.customer,
      description: request.description,
      amount: distinctPendingAmount(request.amount, charges),
      createdAt: deps.now().toISOString(),
      idempotencyKey,
    });
    await deps.charges.save(charge);

    return { charge, paymentLink: deps.buildPaymentLink(charge), created: true };
  }

  return async (request: CreateChargeRequest): Promise<CreateChargeResult> => {
    const idempotencyKey = idempotencyKeyOf(request);
    for (let attempts = 1; ; attempts += 1) {
      try {
        return await attempt(request, idempotencyKey);
      } catch (error) {
        // Another writer saved first: reading again sees its charge and picks around it.
        if (!(error instanceof ChargeConflictError) || attempts >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  };
}
