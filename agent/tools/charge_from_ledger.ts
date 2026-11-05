import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { AmbiguousCustomerError, chargesRuntime, NothingToChargeError, shopCurrency } from "../../src/features/charges";

export default defineTool({
  description:
    "Charge a customer for everything in the ledger that has no payment link yet: one charge for the " +
    'total, with its link. Use it for "cobrale a Juan lo que debe". The entries are marked so they are ' +
    "never charged twice. Pass the customer's name as the ledger has it.",
  inputSchema: z.object({
    customer: z.string().trim().min(1).max(80).describe('Who to charge, e.g. "Juan Pérez".'),
    currency: shopCurrency,
  }),
  // A write the owner did not ask for never runs: eve pauses every call until a person confirms it
  // in the chat. Enforced by the runtime, not the model, so a prompt injection cannot skip it.
  approval: always(),
  label: {
    start: ({ customer }) => `Cobrarle a ${customer} lo de la libreta`,
  },
  async execute(input, ctx) {
    const requestId = `${ctx.session.id}:${ctx.session.turn.id}`;
    try {
      return await chargesRuntime().feature.chargeFromLedger({ ...input, requestId });
    } catch (error) {
      // An expected answer, not a failure: the model tells the owner instead of showing an error.
      if (error instanceof NothingToChargeError) {
        return { charged: false, reason: "Nothing in the ledger without a payment link for this customer." };
      }
      if (error instanceof AmbiguousCustomerError) {
        return { charged: false, reason: "The name fits several customers: ask which one.", candidates: error.candidates };
      }
      throw error;
    }
  },
});
