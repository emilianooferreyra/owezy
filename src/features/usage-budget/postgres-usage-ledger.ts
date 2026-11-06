import { eq, sum } from "drizzle-orm";
import type { Database } from "../../core/storage/database";
import type { UsageLedger, UtcDay } from "./daily-budget";
import { modelUsage } from "./schema";

/** Keeps usage in Postgres, so every serverless instance sees the same daily total. */
export class PostgresUsageLedger implements UsageLedger {
  constructor(private readonly db: Database) {}

  async record(callId: string, day: UtcDay, tokens: number): Promise<void> {
    await this.db.insert(modelUsage).values({ callId, day, tokens }).onConflictDoNothing({ target: modelUsage.callId });
  }

  async spentOn(day: UtcDay): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(modelUsage.tokens).mapWith(Number) })
      .from(modelUsage)
      .where(eq(modelUsage.day, day));
    return row?.total ?? 0;
  }
}
