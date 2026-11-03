import { asc } from "drizzle-orm";
import type { Currency } from "../../../../core/money/money";
import type { Database } from "../../../../core/storage/database";
import type { ActivityLog } from "../../application/ports";
import type { ActivityEntry } from "../../domain/activity";
import { activity } from "./schema";

type Row = typeof activity.$inferSelect;
type Details = Record<string, unknown>;

/** The fields only some kinds carry, kept in the row's `details`. */
function detailsOf(entry: ActivityEntry): Details {
  switch (entry.kind) {
    case "payment-matched":
      return { chargeId: entry.chargeId, customer: entry.customer };
    case "payment-unmatched":
      return {};
    case "payment-ambiguous":
      return { chargeIds: entry.chargeIds };
  }
}

function fromRow(row: Row): ActivityEntry {
  return {
    id: row.id,
    kind: row.kind,
    transferId: row.transferId,
    amount: { amount: row.amount, currency: row.currency as Currency },
    receivedAt: row.receivedAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    ...(row.details as Details),
  } as ActivityEntry;
}

/** Keeps the agent's activity in Postgres. Append-only: an id already there keeps its first entry. */
export class PostgresActivityLog implements ActivityLog {
  constructor(private readonly db: Database) {}

  async record(entries: readonly ActivityEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    await this.db
      .insert(activity)
      .values(
        entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          transferId: entry.transferId,
          amount: entry.amount.amount,
          currency: entry.amount.currency,
          receivedAt: new Date(entry.receivedAt),
          recordedAt: new Date(entry.recordedAt),
          details: detailsOf(entry),
        })),
      )
      .onConflictDoNothing({ target: activity.id });
  }

  async list(): Promise<readonly ActivityEntry[]> {
    const rows = await this.db.select().from(activity).orderBy(asc(activity.seq));
    return rows.map(fromRow);
  }
}
