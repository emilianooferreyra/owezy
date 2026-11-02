import type { ChargesFeature } from "./charges-feature";

export type ReconciliationLogger = Pick<Console, "info" | "error">;

/**
 * What the agent runs on its own clock: reconcile the payments that arrived (each outcome lands in
 * the activity log) and leave a one-line summary in the logs. A failure is logged and rethrown so
 * the scheduled run is marked as failed instead of passing silently.
 */
export async function reconcileOnSchedule(
  charges: Pick<ChargesFeature, "syncPayments">,
  logger: ReconciliationLogger,
): Promise<void> {
  try {
    const report = await charges.syncPayments();
    logger.info(
      `reconcile: ${report.paid.length} paid, ${report.unmatched.length} unmatched, ${report.ambiguous.length} ambiguous`,
    );
  } catch (error) {
    logger.error("reconcile failed", error);
    throw error;
  }
}
