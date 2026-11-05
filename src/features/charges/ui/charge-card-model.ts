import type { EveMessagePart } from "eve/react";
import { z } from "zod";
import { DEFAULT_LOCALE, format, getDictionary, type Locale } from "../../../core/i18n";
import { formatMoney } from "../../../core/money/money";
import type { ChargeView } from "../charges-feature";
import { type Country, currencyOf, timeZoneOf } from "./shops";

// The tools whose output is a charge the owner can send: each shows as a charge card.
const CHARGE_TOOLS = new Set(["create_charge", "charge_from_ledger", "share_charge"]);

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

/** A charge's amount the way its country writes it: "$85.000" for wARS, "R$ 850" for wBRL. */
export function chargeAmount(charge: Pick<ChargeView, "amount" | "currency">): string {
  return formatMoney(charge.amount, currencyOf(charge.currency));
}

/** The message the owner sends the payer, in the simulated phone or through WhatsApp, in the page's language. */
export function paymentMessage(
  charge: ChargeView,
  firstName = charge.customer.split(/\s+/)[0] ?? charge.customer,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return format(getDictionary(locale).charges.paymentMessage, {
    name: firstName,
    description: charge.description,
    id: charge.id,
    amount: chargeAmount(charge),
    link: charge.paymentLink,
  });
}

/**
 * An Argentine mobile number in WhatsApp's international format (549 + area code + number), or
 * undefined when it cannot be read with certainty. The local "15" prefix is rejected rather than
 * guessed: area codes have two to four digits, so it is unclear where they end.
 */
function argentineWhatsAppNumber(digits: string): string | undefined {
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
 * A Brazilian mobile number in WhatsApp's format (55 + two-digit DDD + nine digits starting with
 * 9), or undefined. Landlines (eight digits) are rejected: they do not have WhatsApp as a rule.
 */
function brazilianWhatsAppNumber(digits: string): string | undefined {
  const national = digits.length === 13 && digits.startsWith("55")
    ? digits.slice(2)
    : digits.length === 12 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return national.length === 11 && !national.startsWith("0") && national[2] === "9" ? `55${national}` : undefined;
}

/** A customer's mobile in WhatsApp's international format, read the way their country writes it. */
export function whatsAppNumber(input: string, country: Country = "AR"): string | undefined {
  const digits = input.replace(/\D/g, "");
  return country === "BR" ? brazilianWhatsAppNumber(digits) : argentineWhatsAppNumber(digits);
}

/**
 * A wa.me link that opens the owner's WhatsApp on the customer's chat, with the payment message
 * ready. The owner presses send: nothing goes out on its own, and the customer sees a number
 * they already know.
 */
export function whatsAppShareUrl(
  charge: ChargeView,
  contact: { firstName: string; phone: string },
  locale: Locale = DEFAULT_LOCALE,
): string {
  return `https://wa.me/${contact.phone}?text=${encodeURIComponent(paymentMessage(charge, contact.firstName, locale))}`;
}

export type Receipt = Readonly<{
  reference: string;
  /** The paying transfer's id: the operation number. */
  operation: string;
  /** The shop's local time, dd/mm/yyyy hh:mm (mm/dd/yyyy in English). */
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

/**
 * Day, month, year and time in the shop's time zone, ordered the way the page's language writes
 * dates: 17/10/2026 12:05 in Spanish and Portuguese, 10/17/2026 12:05 in English.
 */
function formatLocalTime(iso: string, currency: string, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timeZoneOf(currency),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const date = parts
    .filter(({ type }) => type === "day" || type === "month" || type === "year")
    .map((part) => part.value)
    .join("/");
  return `${date} ${value("hour")}:${value("minute")}`;
}

/** The receipt of a paid charge, or undefined while it is pending. */
export function receiptFor(charge: ChargeView, locale: Locale = DEFAULT_LOCALE): Receipt | undefined {
  if (charge.status !== "paid" || charge.paidAt === undefined || charge.paidBy === undefined) {
    return undefined;
  }
  const simulated = charge.paidBy.startsWith("simulated-");
  // On-chain transfer ids are `${txHash}:${logIndex}`.
  const txHash = charge.paidBy.split(":")[0];
  return {
    reference: charge.id,
    operation: charge.paidBy,
    paidAt: formatLocalTime(charge.paidAt, charge.currency, locale),
    customer: charge.customer,
    description: charge.description,
    amount: chargeAmount(charge),
    method: format(getDictionary(locale).receipt.method, { token: currencyOf(charge.currency) }),
    simulated,
    ...(simulated || !txHash ? {} : { explorerUrl: `https://celoscan.io/tx/${txHash}` }),
  };
}
