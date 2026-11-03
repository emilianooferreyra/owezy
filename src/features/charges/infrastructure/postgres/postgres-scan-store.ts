import { asc, eq } from "drizzle-orm";
import type { Currency } from "../../../../core/money/money";
import type { Database } from "../../../../core/storage/database";
import type { ScanState, ScanStore } from "../onchain/onchain-transfer-source";
import { scanCursor, scannedTransfers } from "./schema";

/** Keeps the on-chain scan progress in Postgres, so any instance resumes where the last one stopped. */
export class PostgresScanStore implements ScanStore {
  constructor(
    private readonly db: Database,
    private readonly recipient: string,
  ) {}

  async load(): Promise<ScanState> {
    const [cursor] = await this.db.select().from(scanCursor).where(eq(scanCursor.recipient, this.recipient));
    const rows = await this.db
      .select()
      .from(scannedTransfers)
      .where(eq(scannedTransfers.recipient, this.recipient))
      .orderBy(asc(scannedTransfers.seq));
    const transfers = rows.map((row) => ({
      id: row.id,
      amount: { amount: row.amount, currency: row.currency as Currency },
      receivedAt: row.receivedAt.toISOString(),
    }));
    const lastBlock = cursor?.lastBlock ?? undefined;
    return lastBlock === undefined ? { transfers } : { lastBlock, transfers };
  }

  async save(state: ScanState): Promise<void> {
    // Transfers first: a crash in between rescans a few blocks, never skips a transfer.
    if (state.transfers.length > 0) {
      await this.db
        .insert(scannedTransfers)
        .values(
          state.transfers.map((transfer) => ({
            recipient: this.recipient,
            id: transfer.id,
            amount: transfer.amount.amount,
            currency: transfer.amount.currency,
            receivedAt: new Date(transfer.receivedAt),
          })),
        )
        .onConflictDoNothing({ target: scannedTransfers.id });
    }
    const lastBlock = state.lastBlock ?? null;
    await this.db
      .insert(scanCursor)
      .values({ recipient: this.recipient, lastBlock })
      .onConflictDoUpdate({ target: scanCursor.recipient, set: { lastBlock } });
  }
}
