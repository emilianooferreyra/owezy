import { readJsonFile, writeJsonFile } from "../../core/storage/json-file";
import type { UsageLedger, UtcDay } from "./daily-budget";

type Calls = Record<string, { day: UtcDay; tokens: number }>;

/**
 * Keeps usage in a JSON file, for local development without a database. Only the newest day is
 * kept, so the file never grows past one day of calls.
 */
export class FileUsageLedger implements UsageLedger {
  constructor(private readonly path: string) {}

  async record(callId: string, day: UtcDay, tokens: number): Promise<void> {
    const calls = await readJsonFile<Calls>(this.path, {});
    if (calls[callId]) return;
    const kept = Object.fromEntries(Object.entries(calls).filter(([, call]) => call.day >= day));
    await writeJsonFile(this.path, { ...kept, [callId]: { day, tokens } });
  }

  async spentOn(day: UtcDay): Promise<number> {
    const calls = await readJsonFile<Calls>(this.path, {});
    return Object.values(calls)
      .filter((call) => call.day === day)
      .reduce((total, call) => total + call.tokens, 0);
  }
}
