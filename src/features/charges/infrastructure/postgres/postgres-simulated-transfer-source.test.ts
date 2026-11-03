import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../../../core/storage/database";
import { UNIT, wars } from "../../testing/fixtures";
import { PostgresSimulatedTransferSource } from "./postgres-simulated-transfer-source";
import { PGLITE_STARTUP_MS, testDatabase } from "./test-database";

const NOW = new Date("2026-10-17T15:05:00.000Z");

describe("PostgresSimulatedTransferSource", () => {
  let db: Database;

  // PGlite starts in seconds when every test file runs at once; each test then only empties it.
  beforeAll(() => testDatabase(), PGLITE_STARTUP_MS);

  beforeEach(async () => {
    db = await testDatabase();
  });

  it("lists nothing before any simulated payment", async () => {
    expect(await new PostgresSimulatedTransferSource(db).listIncoming()).toEqual([]);
  });

  it("shares simulated payments between instances and keeps the exact amount", async () => {
    const amount = { amount: 85_000n * UNIT + 1n, currency: "wARS" as const };

    const transfer = await new PostgresSimulatedTransferSource(db, { now: () => NOW }).simulatePayment(amount);

    expect(transfer).toStrictEqual({ id: "simulated-1", amount, receivedAt: NOW.toISOString() });
    expect(await new PostgresSimulatedTransferSource(db).listIncoming()).toStrictEqual([transfer]);
  });

  it("gives unique ids that say the payment is simulated, even when two arrive at once", async () => {
    const [first, second] = await Promise.all([
      new PostgresSimulatedTransferSource(db).simulatePayment(wars(1_000n)),
      new PostgresSimulatedTransferSource(db).simulatePayment(wars(2_000n)),
    ]);

    expect(new Set([first?.id, second?.id])).toEqual(new Set(["simulated-1", "simulated-2"]));
  });
});
