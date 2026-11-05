import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../../../core/storage/database";
import { createLedgerEntry, type LedgerEntry } from "../../domain/ledger";
import { aCharge, wars } from "../../testing/fixtures";
import { ledgerRepositoryContract } from "../../testing/ledger-repository-contract";
import { PostgresChargeRepository } from "./postgres-charge-repository";
import { PostgresLedgerRepository } from "./postgres-ledger-repository";
import { PGLITE_STARTUP_MS, testDatabase } from "./test-database";

// PGlite starts in seconds when every test file runs at once; each test then only empties it.
beforeAll(() => testDatabase(), PGLITE_STARTUP_MS);

/** The charges the contract links entries to: in Postgres an entry can only point at a real charge. */
async function withCharges(db: Database, ...ids: string[]): Promise<Database> {
  const charges = new PostgresChargeRepository(db);
  for (const [index, id] of ids.entries()) {
    await charges.save(aCharge({ id, amount: wars(1_000n + BigInt(index)) }));
  }
  return db;
}

ledgerRepositoryContract(
  "PostgresLedgerRepository",
  async () => new PostgresLedgerRepository(await withCharges(await testDatabase(), "C-0001", "C-0002")),
);

describe("PostgresLedgerRepository, guarded by the database itself", () => {
  let ledger: PostgresLedgerRepository;

  beforeEach(async () => {
    ledger = new PostgresLedgerRepository(await testDatabase());
  });

  const entry = (amount = wars(30_000n)): LedgerEntry => ({
    ...createLedgerEntry({
      id: "L-0001",
      customer: "Juan Pérez",
      description: "torta",
      amount: wars(30_000n),
      recordedAt: "2026-10-30T12:00:00.000Z",
    }),
    amount,
  });

  it("refuses an entry with no amount, even one that skipped the domain's checks", async () => {
    await expect(ledger.add(entry(wars(0n)))).rejects.toThrow();
    expect(await ledger.list()).toEqual([]);
  });

  it("refuses to link an entry to a charge that does not exist", async () => {
    await ledger.add(entry());

    await expect(ledger.assignCharge(["L-0001"], "C-9999")).rejects.toThrow();
    expect((await ledger.list())[0]?.chargeId).toBeUndefined();
  });
});
