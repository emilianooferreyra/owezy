import type { UsageLedger, UtcDay } from "./daily-budget";

/** Keeps usage in this process only. For tests. */
export class InMemoryUsageLedger implements UsageLedger {
  private readonly calls = new Map<string, { day: UtcDay; tokens: number }>();

  async record(callId: string, day: UtcDay, tokens: number): Promise<void> {
    if (!this.calls.has(callId)) {
      this.calls.set(callId, { day, tokens });
    }
  }

  async spentOn(day: UtcDay): Promise<number> {
    let total = 0;
    for (const call of this.calls.values()) {
      if (call.day === day) total += call.tokens;
    }
    return total;
  }
}
