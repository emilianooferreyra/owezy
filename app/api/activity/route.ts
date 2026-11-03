import { chargesRuntime } from "@/features/charges";

/**
 * What the agent reconciled on its own, newest first, for the owner's activity panel. It only
 * reads the log: the scheduled reconciliation writes it, so polling this route never reads the chain.
 */
export async function GET() {
  return Response.json({ activity: await chargesRuntime().feature.listActivity({}) });
}
