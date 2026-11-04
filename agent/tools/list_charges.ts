import { defineTool } from "eve/tools";
import { z } from "zod";
import { chargesRuntime, shopCurrency } from "../../src/features/charges";

const STATUS_LABEL = { pending: "pendientes", paid: "cobrados" } as const;

export default defineTool({
  description:
    "List the business's charges, newest first, with how many match and what they add up to. " +
    "It checks for payments that arrived first, so each status is current. " +
    'Use it for payment links: "¿qué links siguen sin pagar?" (pending) or "¿qué cobré?" (paid). ' +
    'For "¿quién me debe?" use read_ledger instead.',
  inputSchema: z.object({
    status: z
      .enum(["pending", "paid"])
      .optional()
      .describe("Only pending (still owed) or only paid charges. Leave it out to list every charge."),
    currency: shopCurrency,
  }),
  label: {
    start: ({ status }) => (status ? `Revisar cobros ${STATUS_LABEL[status]}` : "Revisar cobros"),
  },
  async execute(input) {
    return chargesRuntime().feature.listCharges(input);
  },
});
