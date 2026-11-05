import { and, asc, eq, sql } from "drizzle-orm";
import type { Currency } from "../../../../core/money/money";
import type { Database } from "../../../../core/storage/database";
import { ChargeConflictError, type ChargeRepository } from "../../application/ports";
import type { Charge } from "../../domain/charge";
import { isUniqueViolation } from "./errors";
import { charges } from "./schema";

type Row = typeof charges.$inferSelect;

function fromRow(row: Row): Charge {
  return {
    id: row.id,
    customer: row.customer,
    description: row.description,
    amount: { amount: row.amount, currency: row.currency as Currency },
    createdAt: row.createdAt.toISOString(),
    status: row.status as Charge["status"],
    ...(row.idempotencyKey === null ? {} : { idempotencyKey: row.idempotencyKey }),
    ...(row.paidBy === null ? {} : { paidBy: row.paidBy }),
    ...(row.paidAt === null ? {} : { paidAt: row.paidAt.toISOString() }),
  };
}

function toRow(charge: Charge): Row {
  return {
    id: charge.id,
    customer: charge.customer,
    description: charge.description,
    amount: charge.amount.amount,
    currency: charge.amount.currency,
    createdAt: new Date(charge.createdAt),
    status: charge.status,
    idempotencyKey: charge.idempotencyKey ?? null,
    paidBy: charge.paidBy ?? null,
    paidAt: charge.paidAt === undefined ? null : new Date(charge.paidAt),
  };
}

/** Keeps charges in Postgres, so every serverless instance and the schedule share them. */
export class PostgresChargeRepository implements ChargeRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Charge | undefined> {
    const [row] = await this.db.select().from(charges).where(eq(charges.id, id));
    return row && fromRow(row);
  }

  async findByIdempotencyKey(key: string): Promise<Charge | undefined> {
    const [row] = await this.db.select().from(charges).where(eq(charges.idempotencyKey, key));
    return row && fromRow(row);
  }

  async list(): Promise<readonly Charge[]> {
    const rows = await this.db.select().from(charges).orderBy(asc(charges.createdAt), asc(charges.id));
    return rows.map(fromRow);
  }

  async discard(charge: Charge): Promise<void> {
    await this.db
      .delete(charges)
      .where(
        and(
          eq(charges.id, charge.id),
          eq(charges.status, "pending"),
          sql`${charges.idempotencyKey} is not distinct from ${charge.idempotencyKey ?? null}`,
        ),
      );
  }

  async save(charge: Charge): Promise<void> {
    const { id, ...changes } = toRow(charge);
    let saved: readonly unknown[];
    try {
      saved = await this.db
        .insert(charges)
        .values({ id, ...changes })
        .onConflictDoUpdate({
          target: charges.id,
          set: changes,
          // Only the same charge moves on (e.g. pending to paid). Another request that picked the
          // same reference at the same time created a different charge: it must not overwrite.
          // And only a pending charge moves: once paid, the payment that paid it stays, even if
          // another reconciliation that read the charge earlier tries to pay it with a second transfer.
          // The check runs in the same statement as the write, so it holds however runs interleave.
          setWhere: sql`${charges.idempotencyKey} is not distinct from excluded.idempotency_key and ${charges.createdAt} = excluded.created_at and (${charges.status} = 'pending' or ${charges.paidBy} is not distinct from excluded.paid_by)`,
        })
        .returning({ id: charges.id });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ChargeConflictError(charge.id, { cause: error });
      }
      throw error;
    }
    if (saved.length === 0) {
      throw new ChargeConflictError(charge.id);
    }
  }
}
