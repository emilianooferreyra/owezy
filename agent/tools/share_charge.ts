import { defineTool } from "eve/tools";
import { z } from "zod";
import { ChargeNotFoundError, chargesRuntime, shopCurrency } from "../../src/features/charges";

export default defineTool({
  description:
    "Show an existing charge again, with its link, so the owner can send it to the customer again " +
    '(e.g. "mandáselo de nuevo", "pasame el link de Carlos"). The app shows it as the charge card, ' +
    "with its WhatsApp button: never paste the link. Find the reference with list_charges first if " +
    "the owner names only the customer. It writes nothing. When the charge is pending, the card is " +
    "the answer and your turn ends; when it is already paid, say so instead of sending it.",
  inputSchema: z.object({
    reference: z
      .string()
      .regex(/^C-\d+$/)
      .describe('The charge reference, e.g. "C-0002".'),
    currency: shopCurrency,
  }),
  label: {
    start: ({ reference }) => `Buscar el cobro ${reference}`,
  },
  async execute(input) {
    try {
      return await chargesRuntime().feature.shareCharge(input);
    } catch (error) {
      // An expected answer, not a failure: the model tells the owner it does not exist.
      if (error instanceof ChargeNotFoundError) {
        return { shared: false, reason: `There is no charge ${input.reference} in this shop.` };
      }
      throw error;
    }
  },
  // A pending charge's card is the answer: eve ends the turn instead of calling the model again.
  // Not when the charge does not exist, nor when it is paid: the model tells the owner.
  endsTurn: (output) => "status" in output && output.status === "pending",
});
