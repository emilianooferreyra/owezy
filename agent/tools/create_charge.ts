import { defineTool } from "eve/tools";
import { z } from "zod";
import { formatMoney } from "../../src/core/money/money";
import { chargesRuntime, shopCurrency } from "../../src/features/charges";

export default defineTool({
  description:
    "Create a charge in the shop's currency for a customer and get the link they open to pay. " +
    "The charge gets its own reference (e.g. C-0007): never ask the owner for one.",
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
  label: {
    start: ({ customer, amount, currency }) => `Cobrar ${formatMoney(amount, currency ?? "wARS")} a ${customer}`,
  },
  async execute(input, ctx) {
    // An interrupted step re-runs within the same turn, so session + turn identify this request:
    // a retry returns the same charge instead of a duplicate.
    const requestId = `${ctx.session.id}:${ctx.session.turn.id}`;
    // Built on first call, not at import time, so a bad configuration fails the call, not the build.
    return chargesRuntime().feature.createCharge({ ...input, requestId });
  },
});
