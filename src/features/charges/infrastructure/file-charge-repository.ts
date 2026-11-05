import { z } from "zod";
import type { Currency } from "../../../core/money/money";
import { readJsonFile, writeJsonFile } from "../../../core/storage/json-file";
import type { ChargeRepository } from "../application/ports";
import type { Charge } from "../domain/charge";

/** A charge as stored on disk: the bigint amount travels as a decimal string. */
type StoredCharge = Omit<Charge, "amount"> & { amount: { amount: string; currency: Currency } };

/** Charges saved before they had a creation time get this one: they sort as the oldest. */
export const UNKNOWN_CREATION_TIME = "1970-01-01T00:00:00.000Z";

// The file is shared, edited by hand and written by older versions, so every record is checked.
const storedCharge = z.object({
  id: z.string().min(1),
  customer: z.string(),
  description: z.string(),
  amount: z.object({ amount: z.string().regex(/^\d+$/), currency: z.enum(["wARS", "wBRL"]) }),
  createdAt: z.string().default(UNKNOWN_CREATION_TIME),
  status: z.enum(["pending", "paid"]),
  idempotencyKey: z.string().optional(),
  paidBy: z.string().optional(),
  paidAt: z.string().optional(),
});

function toStored(charge: Charge): StoredCharge {
  return { ...charge, amount: { amount: charge.amount.amount.toString(), currency: charge.amount.currency } };
}

/** The charge in a stored record, or undefined (with a warning) when the record is damaged. */
function fromStored(record: unknown): Charge | undefined {
  const parsed = storedCharge.safeParse(record);
  if (!parsed.success) {
    console.warn("Skipping a damaged charge in the charges file", { record, issues: parsed.error.issues });
    return undefined;
  }
  const { amount, idempotencyKey, paidBy, paidAt, ...rest } = parsed.data;
  return {
    ...rest,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    ...(paidBy === undefined ? {} : { paidBy }),
    ...(paidAt === undefined ? {} : { paidAt }),
    amount: { amount: BigInt(amount.amount), currency: amount.currency },
  };
}

function idOf(record: unknown): unknown {
  return typeof record === "object" && record !== null ? (record as { id?: unknown }).id : undefined;
}

/**
 * Keeps charges in a JSON file so the agent and the web app (separate processes) share them.
 * For local demos only: Vercel has no persistent disk. Postgres replaces it when we deploy.
 */
export class FileChargeRepository implements ChargeRepository {
  constructor(private readonly path: string) {}

  async findById(id: string): Promise<Charge | undefined> {
    return (await this.list()).find((charge) => charge.id === id);
  }

  async findByIdempotencyKey(key: string): Promise<Charge | undefined> {
    return (await this.list()).find((charge) => charge.idempotencyKey === key);
  }

  async list(): Promise<readonly Charge[]> {
    const records = await this.records();
    if (!records) {
      console.warn("The charges file is not a list: reading no charges", { path: this.path });
      return [];
    }
    return records.map(fromStored).filter((charge): charge is Charge => charge !== undefined);
  }

  async save(charge: Charge): Promise<void> {
    // Works on the raw records, so a damaged one stays in the file for a person to fix.
    const stored = await this.records();
    if (!stored) {
      throw new Error(`The charges file at ${this.path} is not a list: fix or remove it before saving`);
    }
    const records = [...stored];
    const index = records.findIndex((record) => idOf(record) === charge.id);
    if (index === -1) {
      records.push(toStored(charge));
    } else {
      records[index] = toStored(charge);
    }
    await writeJsonFile(this.path, records);
  }

  async discard(charge: Charge): Promise<void> {
    const stored = await this.records();
    if (!stored) {
      return;
    }
    const saved = (await this.list()).find(({ id }) => id === charge.id);
    if (saved?.status !== "pending" || saved.idempotencyKey !== charge.idempotencyKey) {
      return;
    }
    await writeJsonFile(
      this.path,
      stored.filter((record) => idOf(record) !== charge.id),
    );
  }

  /** The raw records, or undefined when the file holds something other than a list. */
  private async records(): Promise<readonly unknown[] | undefined> {
    const stored = await readJsonFile<unknown>(this.path, []);
    return Array.isArray(stored) ? stored : undefined;
  }
}
