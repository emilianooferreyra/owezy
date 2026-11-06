import { describe, expect, it } from "vitest";
import { MissingDatabaseError } from "../charges/charges-config";
import { DEFAULT_DAILY_TOKEN_BUDGET, InvalidDailyTokenBudgetError, usageBudgetConfigFromEnv } from "./usage-budget-config";

const CWD = "/app";

describe("usageBudgetConfigFromEnv", () => {
  it("keeps Groq's free tier of 200K tokens a day with room for calls already running", () => {
    expect(usageBudgetConfigFromEnv({}, CWD).dailyTokens).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
    expect(DEFAULT_DAILY_TOKEN_BUDGET).toBeLessThan(200_000);
  });

  it("takes the budget from DAILY_TOKEN_BUDGET", () => {
    expect(usageBudgetConfigFromEnv({ DAILY_TOKEN_BUDGET: "50000" }, CWD).dailyTokens).toBe(50_000);
  });

  it.each(["0", "-5", "lots", "1.5"])("rejects a DAILY_TOKEN_BUDGET of %s", (value) => {
    expect(() => usageBudgetConfigFromEnv({ DAILY_TOKEN_BUDGET: value }, CWD)).toThrow(InvalidDailyTokenBudgetError);
  });

  it("keeps usage in Postgres when DATABASE_URL is set, and in DATA_DIR otherwise", () => {
    expect(usageBudgetConfigFromEnv({ DATABASE_URL: "postgres://db" }, CWD).storage).toStrictEqual({
      databaseUrl: "postgres://db",
    });
    expect(usageBudgetConfigFromEnv({}, CWD).storage).toStrictEqual({ file: "/app/.data/model-usage.json" });
    expect(usageBudgetConfigFromEnv({ DATA_DIR: "/tmp/data" }, CWD).storage).toStrictEqual({
      file: "/tmp/data/model-usage.json",
    });
  });

  it("requires a database on Vercel, where files would vanish between requests", () => {
    expect(() => usageBudgetConfigFromEnv({ VERCEL: "1" }, CWD)).toThrow(MissingDatabaseError);
  });
});
