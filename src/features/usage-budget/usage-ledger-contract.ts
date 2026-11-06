import { expect, it } from "vitest";
import type { UsageLedger } from "./daily-budget";

/** The behavior every UsageLedger must keep, run against each storage. */
export function usageLedgerContract(ledger: () => Promise<UsageLedger> | UsageLedger) {
  it("starts a day with nothing spent", async () => {
    expect(await (await ledger()).spentOn("2026-11-06")).toBe(0);
  });

  it("adds up the calls of the same day only", async () => {
    const store = await ledger();
    await store.record("call-1", "2026-11-06", 1_200);
    await store.record("call-2", "2026-11-06", 800);
    await store.record("call-3", "2026-11-05", 5_000);

    expect(await store.spentOn("2026-11-06")).toBe(2_000);
  });

  it("ignores a call recorded again, so a replay counts once", async () => {
    const store = await ledger();
    await store.record("call-1", "2026-11-06", 1_200);
    await store.record("call-1", "2026-11-06", 1_200);

    expect(await store.spentOn("2026-11-06")).toBe(1_200);
  });
}
