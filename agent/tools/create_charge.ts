import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { DEFAULT_CURRENCY, formatMoney, fromDecimalString, isCurrency } from "../../src/core/money/money";
import { chargesRuntime, shopCurrency } from "../../src/features/charges";

export default defineTool({
  description:
    "Create a charge in the shop's currency for a customer and get the link they open to pay. " +
    "The charge gets its own reference (e.g. C-0007): never ask the owner for one. " +
    "Once it is created, the app shows its card and your turn ends, unless amountAdjusted is true: " +
    "then explain the extra cents in one short sentence.",
  inputSchema: z.object({
    customer: z.string().trim().min(1).max(80).describe('Who pays, e.g. "Juan Pérez".'),
    description: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe('What the charge is for, e.g. "2 docenas de medialunas".'),
    amount: z
      .string()
      // Ten digits of whole units and 18 decimals at most: the domain caps amounts, this keeps a
      // huge string from being parsed at all.
      .max(30)
      .regex(/^\d+(\.\d+)?$/)
      .describe('Amount in whole units of the currency as a plain decimal string, e.g. "85000" or "85000.5". No thousands separators.'),
    currency: shopCurrency,
  }),
  // A write the owner did not ask for never runs: eve pauses every call until a person confirms it
  // in the chat. Enforced by the runtime, not the model, so a prompt injection cannot skip it.
  approval: always(),
  label: {
    start: ({ customer, amount, currency }) => `Cobrar ${formatMoney(amount, currency ?? "wARS")} a ${customer}`,
  },
  async execute(input, ctx) {
    // An interrupted step re-runs within the same turn, so session + turn identify this request:
    // a retry returns the same charge instead of a duplicate.
    const requestId = `${ctx.session.id}:${ctx.session.turn.id}`;
    // Built on first call, not at import time, so a bad configuration fails the call, not the build.
    const charge = await chargesRuntime().feature.createCharge({ ...input, requestId });
    // Compared in the currency the charge was created in, so both amounts use its precision.
    const currency = isCurrency(charge.currency) ? charge.currency : DEFAULT_CURRENCY;
    // Another pending charge already had this amount, so the charge got extra cents to tell the
    // two payments apart: the owner did not ask for them, and the model explains them.
    const amountAdjusted =
      fromDecimalString(charge.amount, currency).amount !== fromDecimalString(input.amount, currency).amount;
    return { ...charge, amountAdjusted };
  },
  // The charge card is the confirmation: eve ends the turn instead of calling the model again,
  // which could write it twice. Extra cents still need the model's one-line explanation.
  endsTurn: (output) => !output.amountAdjusted,
});
