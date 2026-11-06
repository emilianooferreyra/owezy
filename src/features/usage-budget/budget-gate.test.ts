import { none, routeAuth } from "eve/channels/auth";
import { describe, expect, it } from "vitest";
import { dailyBudgetGate } from "./budget-gate";
import { DailyBudget } from "./daily-budget";
import { InMemoryUsageLedger } from "./in-memory-usage-ledger";

// Accepts anyone, as the public demo does after the gate.
const ANYONE = none();

async function spentBudget() {
  const budget = new DailyBudget(new InMemoryUsageLedger(), 1_000);
  await budget.record("call-1", { inputTokens: 1_000 });
  return budget;
}

function request(method: string, path: string) {
  return new Request(`https://demo.test${path}`, { method });
}

describe("dailyBudgetGate", () => {
  it("lets messages through while the day's budget lasts", async () => {
    const budget = new DailyBudget(new InMemoryUsageLedger(), 1_000);

    const result = await routeAuth(request("POST", "/eve/v1/session"), [dailyBudgetGate(() => budget), ANYONE]);

    expect(result).not.toBeInstanceOf(Response);
  });

  it.each([
    ["a new chat", "/eve/v1/session"],
    ["a follow-up message", "/eve/v1/session/ses_123"],
    ["a new chat with a trailing slash", "/eve/v1/session/"],
    ["a follow-up with a trailing slash", "/eve/v1/session/ses_123/"],
    ["compacting a session, which summarizes it with the model", "/eve/v1/session/ses_123/compact"],
    ["compacting a session with a trailing slash", "/eve/v1/session/ses_123/compact/"],
  ])("rejects %s with 403 daily_budget_exhausted once the budget is spent", async (_name, path) => {
    const budget = await spentBudget();

    const result = await routeAuth(request("POST", path), [dailyBudgetGate(() => budget), ANYONE]);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, code: "daily_budget_exhausted" });
  });

  it.each([
    ["reading a session's stream", "GET", "/eve/v1/session/ses_123/stream"],
    ["cancelling a turn", "POST", "/eve/v1/session/ses_123/cancel"],
    ["reading a stream with a trailing slash", "GET", "/eve/v1/session/ses_123/stream/"],
    ["cancelling with a trailing slash", "POST", "/eve/v1/session/ses_123/cancel/"],
    ["clearing a session with a trailing slash", "POST", "/eve/v1/session/ses_123/clear/"],
    ["resetting a session with a trailing slash", "POST", "/eve/v1/session/ses_123/reset/"],
    ["reading the compact path without POST", "GET", "/eve/v1/session/ses_123/compact"],
  ])("still allows %s after the budget is spent, since it calls no model", async (_name, method, path) => {
    const budget = await spentBudget();

    const result = await routeAuth(request(method, path), [dailyBudgetGate(() => budget), ANYONE]);

    expect(result).not.toBeInstanceOf(Response);
  });
});
