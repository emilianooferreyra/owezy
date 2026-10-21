import type { ActivityLog } from "../application/ports";
import type { ActivityEntry } from "../domain/activity";

/** Keeps the agent's activity in process memory. A test double: the app uses FileActivityLog. */
export class InMemoryActivityLog implements ActivityLog {
  readonly #entries = new Map<string, ActivityEntry>();

  async record(entries: readonly ActivityEntry[]): Promise<void> {
    for (const entry of entries) {
      if (!this.#entries.has(entry.id)) {
        this.#entries.set(entry.id, entry);
      }
    }
  }

  async list(): Promise<readonly ActivityEntry[]> {
    return [...this.#entries.values()];
  }
}
