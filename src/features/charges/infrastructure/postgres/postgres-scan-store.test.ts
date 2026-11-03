import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../../../core/storage/database";
import { aTransfer, UNIT } from "../../testing/fixtures";
import { PostgresScanStore } from "./postgres-scan-store";
import { PGLITE_STARTUP_MS, testDatabase } from "./test-database";

const SHOP = "0x0000000000000000000000000000000000000001";
const OTHER_SHOP = "0x0000000000000000000000000000000000000002";

describe("PostgresScanStore", () => {
  let db: Database;

  // PGlite starts in seconds when every test file runs at once; each test then only empties it.
  beforeAll(() => testDatabase(), PGLITE_STARTUP_MS);

  beforeEach(async () => {
    db = await testDatabase();
  });

  it("starts with nothing scanned", async () => {
    expect(await new PostgresScanStore(db, SHOP).load()).toStrictEqual({ transfers: [] });
  });

  it("keeps the progress and the exact amounts across instances, in the order found", async () => {
    const transfers = [
      aTransfer({ id: "0xabc:1", amount: { amount: 85_000n * UNIT + 1n, currency: "wARS" } }),
      aTransfer({ id: "0xabc:0", receivedAt: "2026-10-17T15:06:00.000Z" }),
    ];

    await new PostgresScanStore(db, SHOP).save({ lastBlock: 39_130_266n, transfers });

    expect(await new PostgresScanStore(db, SHOP).load()).toStrictEqual({ lastBlock: 39_130_266n, transfers });
  });

  it("moves the progress forward and adds new transfers without repeating the saved ones", async () => {
    const store = new PostgresScanStore(db, SHOP);
    const first = aTransfer({ id: "0xabc:0" });
    const second = aTransfer({ id: "0xdef:0" });
    await store.save({ lastBlock: 10n, transfers: [first] });

    await store.save({ lastBlock: 20n, transfers: [first, second] });

    expect(await store.load()).toStrictEqual({ lastBlock: 20n, transfers: [first, second] });
  });

  it("keeps each business address's scan apart", async () => {
    await new PostgresScanStore(db, SHOP).save({ lastBlock: 10n, transfers: [aTransfer({ id: "0xabc:0" })] });

    expect(await new PostgresScanStore(db, OTHER_SHOP).load()).toStrictEqual({ transfers: [] });
  });
});
