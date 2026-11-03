import { chargesRuntime, LedgerUnavailableError } from "@/features/charges";

/** The shop's ledger for the demo's greeting: who owes what, with each entry's status. */
export async function GET() {
  try {
    return Response.json(await chargesRuntime().feature.readLedger({}));
  } catch (error) {
    if (error instanceof LedgerUnavailableError) {
      return Response.json({ error: "ledger-unavailable" }, { status: 503 });
    }
    throw error;
  }
}
