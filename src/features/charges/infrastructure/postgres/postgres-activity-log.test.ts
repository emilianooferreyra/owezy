import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../../../core/storage/database";
import { ambiguousPayment, matchedPayment, unmatchedPayment } from "../../domain/activity";
import { aCharge, aTransfer, UNIT } from "../../testing/fixtures";
import { PostgresActivityLog } from "./postgres-activity-log";
import { PGLITE_STARTUP_MS, testDatabase } from "./test-database";

const RECORDED_AT = "2026-10-20T12:00:00.000Z";

describe("PostgresActivityLog", () => {
  let db: Database;

  // PGlite starts in seconds when every test file runs at once; each test then only empties it.
  beforeAll(() => testDatabase(), PGLITE_STARTUP_MS);

  beforeEach(async () => {
    db = await testDatabase();
  });

  it("starts empty", async () => {
    expect(await new PostgresActivityLog(db).list()).toEqual([]);
  });

  it("keeps every kind of entry with every field, including amounts too large for a 64-bit integer", async () => {
    const transfer = aTransfer({ id: "tx-1", amount: { amount: 42_500n * UNIT + 1n, currency: "wARS" } });
    const entries = [
      matchedPayment(transfer, aCharge({ id: "C-0007", customer: "Martina" }), RECORDED_AT),
      unmatchedPayment(aTransfer({ id: "tx-2" }), RECORDED_AT),
      ambiguousPayment(aTransfer({ id: "tx-3" }), [aCharge({ id: "C-0001" }), aCharge({ id: "C-0002" })], RECORDED_AT),
    ];

    await new PostgresActivityLog(db).record(entries);

    expect(await new PostgresActivityLog(db).list()).toStrictEqual(entries);
  });

  it("appends new entries and keeps the first of each id, so repeated runs never duplicate one", async () => {
    const log = new PostgresActivityLog(db);
    const first = unmatchedPayment(aTransfer({ id: "tx-1" }), RECORDED_AT);
    const second = unmatchedPayment(aTransfer({ id: "tx-2" }), RECORDED_AT);
    await log.record([first]);

    await log.record([unmatchedPayment(aTransfer({ id: "tx-1" }), "2026-10-21T12:00:00.000Z"), second, second]);

    expect(await log.list()).toEqual([first, second]);
  });

  it("records nothing when there is nothing new", async () => {
    const log = new PostgresActivityLog(db);

    await log.record([]);

    expect(await log.list()).toEqual([]);
  });
});
