import { chargesRuntime } from "@/features/charges";
import { currencyFrom, UNKNOWN_CURRENCY } from "../currency";

/**
 * What the agent reconciled on its own for one country's shop, newest first, for the owner's
 * activity panel. It only reads the log: the scheduled reconciliation writes it, so polling this
 * route never reads the chain.
 */
export async function GET(request: Request) {
  const currency = currencyFrom(request);
  if (!currency) return UNKNOWN_CURRENCY();
  return Response.json({ activity: await chargesRuntime().feature.listActivity({ currency }) });
}
