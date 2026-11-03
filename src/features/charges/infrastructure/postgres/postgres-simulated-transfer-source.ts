import { asc } from "drizzle-orm";
import type { Currency, Money } from "../../../../core/money/money";
import type { Database } from "../../../../core/storage/database";
import type { PaymentSimulator } from "../../application/ports";
import type { IncomingTransfer } from "../../domain/charge";
import { simulatedTransfers } from "./schema";

type Row = typeof simulatedTransfers.$inferSelect;

/** Ids start with "simulated-", so a demo payment is never mistaken for a real one. */
function fromRow(row: Row): IncomingTransfer {
  return {
    id: `simulated-${row.seq}`,
    amount: { amount: row.amount, currency: row.currency as Currency },
    receivedAt: row.receivedAt.toISOString(),
  };
}

/** Demo payments kept in Postgres, so the payment page and the reconciliation share them. */
export class PostgresSimulatedTransferSource implements PaymentSimulator {
  readonly #now: () => Date;

  constructor(
    private readonly db: Database,
    options: { now?: () => Date } = {},
  ) {
    this.#now = options.now ?? (() => new Date());
  }

  async simulatePayment(amount: Money): Promise<IncomingTransfer> {
    // The sequence numbers each payment, so two at once never share an id.
    const [row] = await this.db
      .insert(simulatedTransfers)
      .values({ amount: amount.amount, currency: amount.currency, receivedAt: this.#now() })
      .returning();
    if (!row) {
      throw new Error("Postgres returned no row for the simulated payment");
    }
    return fromRow(row);
  }

  async listIncoming(): Promise<readonly IncomingTransfer[]> {
    const rows = await this.db.select().from(simulatedTransfers).orderBy(asc(simulatedTransfers.seq));
    return rows.map(fromRow);
  }
}
