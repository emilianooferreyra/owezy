import { describe, expect, it } from "vitest";
import { unmatchedPayment } from "../domain/activity";
import { aTransfer } from "../testing/fixtures";
import { InMemoryActivityLog } from "./in-memory-activity-log";

const RECORDED_AT = "2026-10-20T12:00:00.000Z";

describe("InMemoryActivityLog", () => {
  it("lists what was recorded", async () => {
    const log = new InMemoryActivityLog();
    const entry = unmatchedPayment(aTransfer({ id: "tx-1" }), RECORDED_AT);

    await log.record([entry]);

    expect(await log.list()).toEqual([entry]);
  });

  it("keeps the first entry when the same one is recorded again, so repeated runs never duplicate it", async () => {
    const log = new InMemoryActivityLog();
    const first = unmatchedPayment(aTransfer({ id: "tx-1" }), RECORDED_AT);

    await log.record([first]);
    await log.record([unmatchedPayment(aTransfer({ id: "tx-1" }), "2026-10-20T12:05:00.000Z")]);

    expect(await log.list()).toEqual([first]);
  });
});
