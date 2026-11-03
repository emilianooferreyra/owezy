import type { EveMessagePart } from "eve/react";
import { z } from "zod";
import { formatArs } from "../../../core/money/money";
import type { LedgerEntryView, LedgerView } from "../charges-feature";

const OWNER_NAME = "Ana";
const decimal = z.string().regex(/^\d+(\.\d+)?$/);

// Tool outputs and the ledger route reach the browser as `unknown`, so they are validated first.
const entrySchema = z.object({
  id: z.string(),
  customer: z.string(),
  description: z.string(),
  amount: decimal,
  currency: z.string(),
  recordedAt: z.iso.datetime(),
  status: z.enum(["unbilled", "charged", "paid"]),
  chargeId: z.string().optional(),
});

const ledgerSchema = z.object({
  customers: z.array(
    z.object({ customer: z.string(), owed: decimal, unbilled: decimal, entries: z.array(entrySchema) }),
  ),
  totalOwed: decimal,
});

function toEntryView({ chargeId, ...entry }: z.infer<typeof entrySchema>): LedgerEntryView {
  // Optional fields are dropped when absent rather than set to undefined (exactOptionalPropertyTypes).
  return { ...entry, ...(chargeId === undefined ? {} : { chargeId }) };
}

/** Validates a ledger received over the network (tool output or the ledger route). */
export function parseLedgerView(value: unknown): LedgerView | undefined {
  const parsed = ledgerSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  return {
    totalOwed: parsed.data.totalOwed,
    customers: parsed.data.customers.map((customer) => ({ ...customer, entries: customer.entries.map(toEntryView) })),
  };
}

type CustomerView = LedgerView["customers"][number];

/** What the owner can do about a customer: charge them, wait for a link already sent, or nothing. */
export function customerState(customer: CustomerView): "to-charge" | "link-sent" | "up-to-date" {
  if (Number(customer.unbilled) > 0) {
    return "to-charge";
  }
  return Number(customer.owed) > 0 ? "link-sent" : "up-to-date";
}

/** The agent's first line, written from the ledger instead of a fixed script. */
export function greetingFor(ledger: LedgerView): string {
  const owing = ledger.customers.filter((customer) => Number(customer.owed) > 0).length;
  if (owing === 0) {
    return `¡Hola, ${OWNER_NAME}! Nadie te debe nada. Contame qué se llevó alguien y lo anoto.`;
  }
  return `¡Hola, ${OWNER_NAME}! Hoy te deben ${formatArs(ledger.totalOwed)} entre ${owing} ${owing === 1 ? "cliente" : "clientes"}.`;
}

/** What the owner would type to charge a customer from the ledger: the "Cobrar" button sends it. */
export function chargeRequest(customer: string): string {
  return `Cobrale a ${customer} lo que debe`;
}

function finishedOutput(part: EveMessagePart, toolNames: readonly string[]): unknown {
  if (part.type !== "dynamic-tool" || !toolNames.includes(part.toolName) || part.state !== "output-available" || part.partial) {
    return undefined;
  }
  return part.output;
}

/** The ledger a finished read_ledger call returned, shown as a card. */
export function ledgerFromPart(part: EveMessagePart): LedgerView | undefined {
  const output = finishedOutput(part, ["read_ledger"]);
  return output === undefined ? undefined : parseLedgerView(output);
}

const noteSchema = z.object({ entry: entrySchema });

/** The entry a finished add_to_ledger call wrote down. */
export function noteFromPart(part: EveMessagePart): LedgerEntryView | undefined {
  const parsed = noteSchema.safeParse(finishedOutput(part, ["add_to_ledger"]));
  return parsed.success ? toEntryView(parsed.data.entry) : undefined;
}

const candidatesSchema = z.object({ candidates: z.array(z.string()).min(2) });

/** The customers a name could be, when add_to_ledger or charge_from_ledger could not tell. */
export function candidatesFromPart(part: EveMessagePart): readonly string[] | undefined {
  const parsed = candidatesSchema.safeParse(finishedOutput(part, ["add_to_ledger", "charge_from_ledger"]));
  return parsed.success ? parsed.data.candidates : undefined;
}
