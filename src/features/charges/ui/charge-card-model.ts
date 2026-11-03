import type { EveMessagePart } from "eve/react";
import { z } from "zod";
import { formatArs } from "../../../core/money/money";
import type { ChargeView } from "../charges-feature";

// The tools whose output is a charge the owner can send: each shows as a charge card.
const CHARGE_TOOLS = new Set(["create_charge", "charge_from_ledger"]);

// Tool outputs reach the browser as `unknown`, so the card validates them before rendering.
const chargeViewSchema = z.object({
  id: z.string(),
  customer: z.string(),
  description: z.string(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.string(),
  status: z.enum(["pending", "paid"]),
  createdAt: z.iso.datetime(),
  paymentLink: z.url(),
  paidAt: z.iso.datetime().optional(),
  paidBy: z.string().optional(),
  created: z.boolean().optional(),
});

/** Validates a charge received over the network (tool output or status endpoint). */
export function parseChargeView(value: unknown): ChargeView | undefined {
  const parsed = chargeViewSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  // Optional fields are dropped when absent rather than set to undefined (exactOptionalPropertyTypes).
  const { paidAt, paidBy, created, ...view } = parsed.data;
  return {
    ...view,
    ...(paidAt === undefined ? {} : { paidAt }),
    ...(paidBy === undefined ? {} : { paidBy }),
    ...(created === undefined ? {} : { created }),
  };
}

export type PollStatusResult =
  | Readonly<{ kind: "update"; charges: readonly ChargeView[]; gone: readonly string[] }>
  | Readonly<{ kind: "retry" }>;

function idOf(entry: unknown): string | undefined {
  return typeof entry === "object" && entry !== null && "id" in entry && typeof entry.id === "string"
    ? entry.id
    : undefined;
}

/**
 * What the shared status poll does with a response to `GET /api/charges?ids=…`: update the
 * charges that came back, and stop asking for the ones the server no longer has.
 */
export function pollStatusResult(askedIds: readonly string[], httpStatus: number, body: unknown): PollStatusResult {
  const entries = typeof body === "object" && body !== null && "charges" in body ? body.charges : undefined;
  if (httpStatus !== 200 || !Array.isArray(entries)) {
    return { kind: "retry" };
  }
  const returned = new Set(entries.map(idOf));
  return {
    kind: "update",
    charges: entries.flatMap((entry) => parseChargeView(entry) ?? []),
    gone: askedIds.filter((id) => !returned.has(id)),
  };
}

/** The charge a finished create_charge call returned, or undefined for any other part. */
export function chargeFromPart(part: EveMessagePart): ChargeView | undefined {
  if (
    part.type !== "dynamic-tool" ||
    !CHARGE_TOOLS.has(part.toolName) ||
    part.state !== "output-available" ||
    part.partial
  ) {
    return undefined;
  }

  return parseChargeView(part.output);
}

export { formatArs };

/** The message the owner sends the payer, in the simulated phone or through WhatsApp. */
export function paymentMessage(charge: ChargeView, firstName = charge.customer.split(/\s+/)[0] ?? charge.customer): string {
  return `¡Hola ${firstName}! Te paso el link para pagar ${charge.description} (${charge.id}) por ${formatArs(charge.amount)}: ${charge.paymentLink}`;
}

/**
 * An Argentine mobile number in WhatsApp's international format (549 + area code + number), or
 * undefined when it cannot be read with certainty. The local "15" prefix is rejected rather than
 * guessed: area codes have two to four digits, so it is unclear where they end.
 */
export function whatsAppNumber(input: string): string | undefined {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("549")) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("54")) {
    return `549${digits.slice(2)}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `549${digits.slice(1)}`;
  }
  if (digits.length === 10 && !digits.startsWith("0")) {
    return `549${digits}`;
  }
  return undefined;
}

/**
 * A wa.me link that opens the owner's WhatsApp on the customer's chat, with the payment message
 * ready. The owner presses send: nothing goes out on its own, and the customer sees a number
 * they already know.
 */
export function whatsAppShareUrl(charge: ChargeView, contact: { firstName: string; phone: string }): string {
  return `https://wa.me/${contact.phone}?text=${encodeURIComponent(paymentMessage(charge, contact.firstName))}`;
}

export type Receipt = Readonly<{
  reference: string;
  /** The paying transfer's id: the operation number. */
  operation: string;
  /** Local time in Argentina, dd/mm/yyyy hh:mm. */
  paidAt: string;
  customer: string;
  description: string;
  amount: string;
  method: string;
  /** A simulated receipt must say so: it is never proof of a real payment. */
  simulated: boolean;
  /** For a real payment, its transaction on Celoscan: the proof anyone can check. */
  explorerUrl?: string;
}>;

const ARGENTINA_TIME = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatArgentinaTime(iso: string): string {
  const parts = Object.fromEntries(
    ARGENTINA_TIME.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** The receipt of a paid charge, or undefined while it is pending. */
export function receiptFor(charge: ChargeView): Receipt | undefined {
  if (charge.status !== "paid" || charge.paidAt === undefined || charge.paidBy === undefined) {
    return undefined;
  }
  const simulated = charge.paidBy.startsWith("simulated-");
  // On-chain transfer ids are `${txHash}:${logIndex}`.
  const txHash = charge.paidBy.split(":")[0];
  return {
    reference: charge.id,
    operation: charge.paidBy,
    paidAt: formatArgentinaTime(charge.paidAt),
    customer: charge.customer,
    description: charge.description,
    amount: formatArs(charge.amount),
    method: "Ripio · wARS en Celo",
    simulated,
    ...(simulated || !txHash ? {} : { explorerUrl: `https://celoscan.io/tx/${txHash}` }),
  };
}
