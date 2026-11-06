/** Token counts as the model provider reports them for one call. Either may be missing. */
export type ModelUsage = Readonly<{ inputTokens?: number; outputTokens?: number }>;

/** A calendar day in UTC, as `YYYY-MM-DD`. */
export type UtcDay = string;

/** Where the tokens each model call spent are kept, one entry per call. */
export interface UsageLedger {
  /** Adds a call's tokens to its day. A call already recorded is ignored, so a replay counts once. */
  record(callId: string, day: UtcDay, tokens: number): Promise<void>;
  /** The tokens all calls of that day spent. */
  spentOn(day: UtcDay): Promise<number>;
}

export function utcDay(date: Date): UtcDay {
  return date.toISOString().slice(0, 10);
}

/**
 * Groq's free tier serves a fixed number of tokens per day to the whole app, and the chat is
 * public. Without a cap, one visitor could spend the day's tokens and leave the demo broken for
 * everyone else. This budget counts what the model spends and says when the day's share is gone.
 */
export class DailyBudget {
  constructor(
    private readonly ledger: UsageLedger,
    private readonly limit: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(callId: string, usage: ModelUsage): Promise<void> {
    const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    await this.ledger.record(callId, utcDay(this.now()), tokens);
  }

  async isExhausted(): Promise<boolean> {
    return (await this.ledger.spentOn(utcDay(this.now()))) >= this.limit;
  }
}
