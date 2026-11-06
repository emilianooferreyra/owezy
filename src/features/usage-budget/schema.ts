import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text } from "drizzle-orm/pg-core";

/** One row per model call: the primary key makes a replayed call count once. */
export const modelUsage = pgTable(
  "model_usage",
  {
    callId: text().primaryKey(),
    // The UTC day as YYYY-MM-DD, the unit the daily budget sums over.
    day: text().notNull(),
    tokens: integer().notNull(),
  },
  (table) => [index("model_usage_day").on(table.day), check("model_usage_tokens", sql`${table.tokens} >= 0`)],
);
