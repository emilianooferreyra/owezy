import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Currency } from "../../../../core/money/money";
import type { Database } from "../../../../core/storage/database";
import { LedgerConflictError, type LedgerRepository } from "../../application/ports";
import type { LedgerEntry } from "../../domain/ledger";
import { isUniqueViolation } from "./errors";
import { ledgerEntries } from "./schema";

type Row = typeof ledgerEntries.$inferSelect;

function fromRow(row: Row): LedgerEntry {
  return {
    id: row.id,
    customer: row.customer,
    description: row.description,
    amount: { amount: row.amount, currency: row.currency as Currency },
    recordedAt: row.recordedAt.toISOString(),
    ...(row.idempotencyKey === null ? {} : { idempotencyKey: row.idempotencyKey }),
    ...(row.chargeId === null ? {} : { chargeId: row.chargeId }),
  };
}

/** Keeps the shop's ledger in Postgres, shared by every instance. */
export class PostgresLedgerRepository implements LedgerRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<readonly LedgerEntry[]> {
    const rows = await this.db.select().from(ledgerEntries).orderBy(asc(ledgerEntries.seq));
    return rows.map(fromRow);
  }

  async add(entry: LedgerEntry): Promise<void> {
    try {
      await this.db.insert(ledgerEntries).values({
        id: entry.id,
        customer: entry.customer,
        description: entry.description,
        amount: entry.amount.amount,
        currency: entry.amount.currency,
        recordedAt: new Date(entry.recordedAt),
        idempotencyKey: entry.idempotencyKey ?? null,
        chargeId: entry.chargeId ?? null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new LedgerConflictError(entry.id, { cause: error });
      }
      throw error;
    }
  }

  async assignCharge(entryIds: readonly string[], chargeId: string): Promise<readonly string[]> {
    if (entryIds.length === 0) {
      return [];
    }
    // Only entries no charge includes yet, or this one: an entry is never charged twice. The check
    // and the write are one statement, so two requests racing for an entry cannot both get it.
    const rows = await this.db
      .update(ledgerEntries)
      .set({ chargeId })
      .where(
        and(
          inArray(ledgerEntries.id, [...entryIds]),
          or(isNull(ledgerEntries.chargeId), eq(ledgerEntries.chargeId, chargeId)),
        ),
      )
      .returning({ id: ledgerEntries.id });
    return rows.map(({ id }) => id);
  }

  async releaseCharge(chargeId: string): Promise<void> {
    await this.db.update(ledgerEntries).set({ chargeId: null }).where(eq(ledgerEntries.chargeId, chargeId));
  }
}
