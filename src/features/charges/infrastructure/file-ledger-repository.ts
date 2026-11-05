import { z } from "zod";
import { readJsonFile, writeJsonFile } from "../../../core/storage/json-file";
import { LedgerConflictError, type LedgerRepository } from "../application/ports";
import type { LedgerEntry } from "../domain/ledger";

// The file can be edited by hand, so every record is checked.
const storedEntry = z.object({
  id: z.string().min(1),
  customer: z.string().min(1),
  description: z.string().min(1),
  amount: z.object({ amount: z.string().regex(/^\d+$/), currency: z.enum(["wARS", "wBRL"]) }),
  recordedAt: z.string(),
  idempotencyKey: z.string().optional(),
  chargeId: z.string().optional(),
});
type StoredEntry = z.infer<typeof storedEntry>;

function toStored(entry: LedgerEntry): StoredEntry {
  return { ...entry, amount: { amount: entry.amount.amount.toString(), currency: entry.amount.currency } };
}

function fromStored(record: unknown): LedgerEntry | undefined {
  const parsed = storedEntry.safeParse(record);
  if (!parsed.success) {
    console.warn("Skipping a damaged entry in the ledger file", { record, issues: parsed.error.issues });
    return undefined;
  }
  const { amount, idempotencyKey, chargeId, ...rest } = parsed.data;
  return {
    ...rest,
    amount: { amount: BigInt(amount.amount), currency: amount.currency },
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    ...(chargeId === undefined ? {} : { chargeId }),
  };
}

/** Keeps the ledger in a JSON file for local demos. Vercel has no persistent disk: Postgres there. */
export class FileLedgerRepository implements LedgerRepository {
  constructor(private readonly path: string) {}

  async list(): Promise<readonly LedgerEntry[]> {
    return (await this.records()).map(fromStored).filter((entry): entry is LedgerEntry => entry !== undefined);
  }

  async add(entry: LedgerEntry): Promise<void> {
    const records = await this.records();
    if (records.some((record) => (record as { id?: unknown })?.id === entry.id)) {
      throw new LedgerConflictError(entry.id);
    }
    await writeJsonFile(this.path, [...records, toStored(entry)]);
  }

  async assignCharge(entryIds: readonly string[], chargeId: string): Promise<readonly string[]> {
    const ids = new Set(entryIds);
    const records = (await this.records()).map((record) => {
      const stored = record as Partial<StoredEntry>;
      return stored.id !== undefined && ids.has(stored.id) && stored.chargeId === undefined
        ? { ...stored, chargeId }
        : record;
    });
    await writeJsonFile(this.path, records);
    return records.flatMap((record) => {
      const stored = record as Partial<StoredEntry>;
      return stored.id !== undefined && ids.has(stored.id) && stored.chargeId === chargeId ? [stored.id] : [];
    });
  }

  async releaseCharge(chargeId: string): Promise<void> {
    const records = (await this.records()).map((record) => {
      const stored = record as Partial<StoredEntry>;
      if (stored.chargeId !== chargeId) return record;
      const { chargeId: _, ...unlinked } = stored;
      return unlinked;
    });
    await writeJsonFile(this.path, records);
  }

  private async records(): Promise<readonly unknown[]> {
    const stored = await readJsonFile<unknown>(this.path, []);
    if (!Array.isArray(stored)) {
      throw new Error(`The ledger file at ${this.path} is not a list: fix or remove it`);
    }
    return stored;
  }
}
