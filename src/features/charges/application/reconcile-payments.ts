import { type ActivityEntry, ambiguousPayment, matchedPayment, unmatchedPayment } from "../domain/activity";
import { applyPayment, type Charge, matchTransfer } from "../domain/charge";
import type { ActivityLog, ChargeRepository, TransferSource } from "./ports";

export type ReconciliationReport = Readonly<{
  /** Ids of the charges this run marked as paid. */
  paid: readonly string[];
  /** Ids of transfers that match no pending charge. */
  unmatched: readonly string[];
  /** Ids of transfers that could pay more than one charge: a person has to decide. */
  ambiguous: readonly string[];
}>;

export function reconcilePaymentsUseCase(deps: {
  charges: ChargeRepository;
  transfers: TransferSource;
  /** Where the agent leaves what it found, for the owner to see. */
  activity?: ActivityLog;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  return async (): Promise<ReconciliationReport> => {
    const charges = new Map<string, Charge>((await deps.charges.list()).map((charge) => [charge.id, charge]));
    const applied = new Set([...charges.values()].flatMap((charge) => (charge.paidBy ? [charge.paidBy] : [])));
    const report = { paid: [] as string[], unmatched: [] as string[], ambiguous: [] as string[] };
    const recordedAt = now().toISOString();
    const entries: ActivityEntry[] = [];

    for (const transfer of await deps.transfers.listIncoming()) {
      if (applied.has(transfer.id)) {
        continue;
      }

      const match = matchTransfer([...charges.values()], transfer);
      if (match.kind === "matched") {
        const paid = applyPayment(match.charge, transfer);
        await deps.charges.save(paid);
        charges.set(paid.id, paid);
        report.paid.push(paid.id);
        entries.push(matchedPayment(transfer, paid, recordedAt));
      } else {
        report[match.kind].push(transfer.id);
        entries.push(
          match.kind === "ambiguous"
            ? ambiguousPayment(transfer, match.candidates, recordedAt)
            : unmatchedPayment(transfer, recordedAt),
        );
      }
    }

    await deps.activity?.record(entries);
    return report;
  };
}
