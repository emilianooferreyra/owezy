import { describe, expect, it } from "vitest";
import { DailyBudget } from "./daily-budget";
import { InMemoryUsageLedger } from "./in-memory-usage-ledger";

const MORNING = new Date("2026-11-06T09:00:00.000Z");
const NIGHT = new Date("2026-11-06T23:59:00.000Z");
const NEXT_DAY = new Date("2026-11-07T00:01:00.000Z");

function budgetOf(limit: number, now: () => Date = () => MORNING) {
  return new DailyBudget(new InMemoryUsageLedger(), limit, now);
}

describe("DailyBudget", () => {
  it("is open while the day's tokens stay under the limit", async () => {
    const budget = budgetOf(1_000);

    await budget.record("call-1", { inputTokens: 600, outputTokens: 399 });

    expect(await budget.isExhausted()).toBe(false);
  });

  it("is exhausted once input and output tokens together reach the limit", async () => {
    const budget = budgetOf(1_000);

    await budget.record("call-1", { inputTokens: 600, outputTokens: 400 });

    expect(await budget.isExhausted()).toBe(true);
  });

  it("counts a model call that eve reports twice only once", async () => {
    const budget = budgetOf(1_000);

    await budget.record("call-1", { inputTokens: 600 });
    await budget.record("call-1", { inputTokens: 600 });

    expect(await budget.isExhausted()).toBe(false);
  });

  it("starts the next UTC day with a fresh budget", async () => {
    let now = NIGHT;
    const budget = budgetOf(1_000, () => now);
    await budget.record("call-1", { inputTokens: 1_000 });

    now = NEXT_DAY;

    expect(await budget.isExhausted()).toBe(false);
  });

  it("treats usage the provider did not report as zero tokens", async () => {
    const budget = budgetOf(1);

    await budget.record("call-1", {});

    expect(await budget.isExhausted()).toBe(false);
  });
});
