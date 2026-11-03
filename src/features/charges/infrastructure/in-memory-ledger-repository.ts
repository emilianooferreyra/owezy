import { LedgerConflictError, type LedgerRepository } from "../application/ports";
import type { LedgerEntry } from "../domain/ledger";

/** Keeps the ledger in process memory. A test double: the app uses files or Postgres. */
export class InMemoryLedgerRepository implements LedgerRepository {
  readonly #entries: LedgerEntry[] = [];

  async list(): Promise<readonly LedgerEntry[]> {
    return [...this.#entries];
  }

  async add(entry: LedgerEntry): Promise<void> {
    if (this.#entries.some(({ id }) => id === entry.id)) {
      throw new LedgerConflictError(entry.id);
    }
    this.#entries.push(entry);
  }

  async assignCharge(entryIds: readonly string[], chargeId: string): Promise<void> {
    const ids = new Set(entryIds);
    this.#entries.forEach((entry, index) => {
      if (ids.has(entry.id) && entry.chargeId === undefined) {
        this.#entries[index] = { ...entry, chargeId };
      }
    });
  }
}
