import { z } from "zod";
import { readJsonFile, writeJsonFile } from "../../../core/storage/json-file";
import type { ActivityLog } from "../application/ports";
import type { ActivityEntry } from "../domain/activity";

// The file is shared and can be edited by hand, so every record is checked.
const storedEvent = {
  id: z.string().min(1),
  transferId: z.string().min(1),
  amount: z.object({ amount: z.string().regex(/^\d+$/), currency: z.enum(["wARS", "wBRL"]) }),
  receivedAt: z.string(),
  recordedAt: z.string(),
};

const storedEntry = z.discriminatedUnion("kind", [
  z.object({ ...storedEvent, kind: z.literal("payment-matched"), chargeId: z.string(), customer: z.string() }),
  z.object({ ...storedEvent, kind: z.literal("payment-unmatched") }),
  z.object({ ...storedEvent, kind: z.literal("payment-ambiguous"), chargeIds: z.array(z.string()) }),
]);

function toStored(entry: ActivityEntry) {
  return { ...entry, amount: { amount: entry.amount.amount.toString(), currency: entry.amount.currency } };
}

/** The entry in a stored record, or undefined (with a warning) when the record is damaged. */
function fromStored(record: unknown): ActivityEntry | undefined {
  const parsed = storedEntry.safeParse(record);
  if (!parsed.success) {
    console.warn("Skipping a damaged entry in the activity file", { record, issues: parsed.error.issues });
    return undefined;
  }
  const { amount } = parsed.data;
  return { ...parsed.data, amount: { amount: BigInt(amount.amount), currency: amount.currency } } as ActivityEntry;
}

function idOf(record: unknown): unknown {
  return typeof record === "object" && record !== null ? (record as { id?: unknown }).id : undefined;
}

/**
 * Keeps the agent's activity in a JSON file, so the agent and the web app (separate processes)
 * share it. For local demos only: Vercel has no persistent disk.
 */
export class FileActivityLog implements ActivityLog {
  constructor(private readonly path: string) {}

  async record(entries: readonly ActivityEntry[]): Promise<void> {
    // Most reconciliations find nothing new: they must never fail on a damaged file.
    if (entries.length === 0) {
      return;
    }
    // Works on the raw records, so a damaged one stays in the file for a person to fix.
    const stored = await this.records();
    if (!stored) {
      throw new Error(`The activity file at ${this.path} is not a list: fix or remove it before recording`);
    }
    const known = new Set(stored.map(idOf));
    const fresh: ActivityEntry[] = [];
    for (const entry of entries) {
      if (!known.has(entry.id)) {
        known.add(entry.id);
        fresh.push(entry);
      }
    }
    if (fresh.length > 0) {
      await writeJsonFile(this.path, [...stored, ...fresh.map(toStored)]);
    }
  }

  async list(): Promise<readonly ActivityEntry[]> {
    const records = await this.records();
    if (!records) {
      console.warn("The activity file is not a list: reading no activity", { path: this.path });
      return [];
    }
    return records.map(fromStored).filter((entry): entry is ActivityEntry => entry !== undefined);
  }

  /** The raw records, or undefined when the file holds something other than a list. */
  private async records(): Promise<readonly unknown[] | undefined> {
    const stored = await readJsonFile<unknown>(this.path, []);
    return Array.isArray(stored) ? stored : undefined;
  }
}
