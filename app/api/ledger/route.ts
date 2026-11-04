import { chargesRuntime, LedgerUnavailableError } from "@/features/charges";
import { currencyFrom, UNKNOWN_CURRENCY } from "../currency";

/** One country's ledger for the demo's greeting: who owes what, with each entry's status. */
export async function GET(request: Request) {
  const currency = currencyFrom(request);
  if (!currency) return UNKNOWN_CURRENCY();
  try {
    return Response.json(await chargesRuntime().feature.readLedger({ currency }));
  } catch (error) {
    if (error instanceof LedgerUnavailableError) {
      return Response.json({ error: "ledger-unavailable" }, { status: 503 });
    }
    throw error;
  }
}
