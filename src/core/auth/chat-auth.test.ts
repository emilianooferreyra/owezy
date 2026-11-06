import { routeAuth } from "eve/channels/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyBudget } from "../../features/usage-budget/daily-budget";
import { InMemoryUsageLedger } from "../../features/usage-budget/in-memory-usage-ledger";
import { chatAuthWith } from "./chat-auth";

beforeEach(() => {
  // A Vercel production deployment: not eve dev, not vercel dev.
  vi.stubEnv("EVE_DEV", "");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const newChat = () => new Request("https://demo.test/eve/v1/session", { method: "POST" });

describe("chatAuth", () => {
  it("lets an anonymous browser chat with the deployed demo, so judges can try it without an account", async () => {
    const budget = new DailyBudget(new InMemoryUsageLedger(), 1_000);

    const result = await routeAuth(newChat(), chatAuthWith(() => budget));

    expect(result).not.toBeInstanceOf(Response);
  });

  it("refuses new chats once the day's model budget is spent, so one visitor cannot use up Groq's quota", async () => {
    const budget = new DailyBudget(new InMemoryUsageLedger(), 1_000);
    await budget.record("call-1", { inputTokens: 1_000 });

    const result = await routeAuth(newChat(), chatAuthWith(() => budget));

    expect((result as Response).status).toBe(403);
  });
});
