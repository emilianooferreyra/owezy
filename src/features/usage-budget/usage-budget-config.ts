import { join } from "node:path";
import { connectDatabase } from "../../core/storage/database";
import { MissingDatabaseError } from "../charges/charges-config";
import { DailyBudget } from "./daily-budget";
import { FileUsageLedger } from "./file-usage-ledger";
import { PostgresUsageLedger } from "./postgres-usage-ledger";

/** Groq's free tier serves 200K tokens a day; the rest is room for calls already running. */
export const DEFAULT_DAILY_TOKEN_BUDGET = 180_000;

export class InvalidDailyTokenBudgetError extends Error {
  constructor(value: string) {
    super(`DAILY_TOKEN_BUDGET must be a positive whole number of tokens, got "${value}"`);
    this.name = "InvalidDailyTokenBudgetError";
  }
}

export type UsageBudgetConfig = Readonly<{
  dailyTokens: number;
  storage: Readonly<{ databaseUrl: string }> | Readonly<{ file: string }>;
}>;

type Env = Readonly<Record<string, string | undefined>>;

function dailyTokensFrom(env: Env): number {
  const value = env.DAILY_TOKEN_BUDGET;
  if (value === undefined || value === "") return DEFAULT_DAILY_TOKEN_BUDGET;
  if (!/^\d+$/.test(value) || Number(value) <= 0) throw new InvalidDailyTokenBudgetError(value);
  return Number(value);
}

/** Reads the budget configuration: Postgres when DATABASE_URL is set, a JSON file in DATA_DIR otherwise. */
export function usageBudgetConfigFromEnv(env: Env, cwd: string): UsageBudgetConfig {
  const dailyTokens = dailyTokensFrom(env);
  const databaseUrl = env.DATABASE_URL || undefined;
  if (databaseUrl !== undefined) return { dailyTokens, storage: { databaseUrl } };
  if (env.VERCEL) throw new MissingDatabaseError();
  return { dailyTokens, storage: { file: join(env.DATA_DIR || join(cwd, ".data"), "model-usage.json") } };
}

export function dailyBudgetFromConfig(config: UsageBudgetConfig): DailyBudget {
  const ledger =
    "databaseUrl" in config.storage
      ? new PostgresUsageLedger(connectDatabase(config.storage.databaseUrl))
      : new FileUsageLedger(config.storage.file);
  return new DailyBudget(ledger, config.dailyTokens);
}

let budget: DailyBudget | undefined;

/**
 * The day's model budget as the environment configures it, built once per process. The chat's
 * auth walk reads it and the instrumentation writes to it, so both agree on storage and limit.
 */
export function dailyBudgetRuntime(): DailyBudget {
  budget ??= dailyBudgetFromConfig(usageBudgetConfigFromEnv(process.env, process.cwd()));
  return budget;
}
