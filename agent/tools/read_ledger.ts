import { defineTool } from "eve/tools";
import { z } from "zod";
import { chargesRuntime } from "../../src/features/charges";

export default defineTool({
  description:
    "Read the shop's ledger (libreta): what each customer took and still owes, the one who owes most " +
    "first, with each entry's status (unbilled, charged with a pending link, or paid). It checks for " +
    'payments first, so statuses are current. Use it for "¿quién me debe?", "¿qué llevó Martina?" or ' +
    "before charging someone.",
  inputSchema: z.object({
    customer: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .describe('Only this customer; a first name is enough ("Martina"). Leave it out to read every customer.'),
  }),
  label: {
    start: ({ customer }) => (customer ? `Revisar la libreta de ${customer}` : "Revisar la libreta"),
  },
  async execute(input) {
    return chargesRuntime().feature.readLedger(input);
  },
});
