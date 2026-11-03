import { defineTool } from "eve/tools";
import { z } from "zod";
import { AmbiguousCustomerError, chargesRuntime } from "../../src/features/charges";

export default defineTool({
  description:
    "Write down in the ledger (libreta) that a customer took something and still owes it, e.g. " +
    '"anotá que Juan llevó 2 tortas por $30.000". It does not send a payment link: use ' +
    "charge_from_ledger for that.",
  inputSchema: z.object({
    customer: z.string().trim().min(1).max(80).describe('Who took it, e.g. "Juan Pérez".'),
    description: z.string().trim().min(1).max(120).describe('What they took, e.g. "2 tortas".'),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .describe('Amount in whole pesos as a plain decimal string, e.g. "30000". No thousands separators.'),
  }),
  label: {
    start: ({ customer, amount }) => `Anotar $${amount} a ${customer}`,
  },
  async execute(input, ctx) {
    // Session + turn identify the request, so a retried step does not write the entry twice.
    const requestId = `${ctx.session.id}:${ctx.session.turn.id}`;
    try {
      return await chargesRuntime().feature.addToLedger({ ...input, requestId });
    } catch (error) {
      // Nothing was written: the model asks the owner which customer they meant.
      if (error instanceof AmbiguousCustomerError) {
        return { written: false, reason: "The name fits several customers: ask which one.", candidates: error.candidates };
      }
      throw error;
    }
  },
});
