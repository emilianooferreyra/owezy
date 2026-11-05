import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createChargeUseCase } from "../../application/create-charge";
import { addToLedgerUseCase, chargeFromLedgerUseCase, NothingToChargeError } from "../../application/ledger";
import type { PaymentLinkBuilder } from "../../application/ports";
import { wars } from "../../testing/fixtures";
import { PostgresChargeRepository } from "./postgres-charge-repository";
import { PostgresLedgerRepository } from "./postgres-ledger-repository";
import { PGLITE_STARTUP_MS, testDatabase } from "./test-database";

const fakeLink: PaymentLinkBuilder = (charge) => `https://pay.test/${charge.id}`;
const NOW = new Date("2026-11-03T15:00:00.000Z");

// The real adapters and constraints: the race only shows where the database refuses a write.
describe("chargeFromLedger against Postgres, with two requests at the same time", () => {
  beforeAll(() => testDatabase(), PGLITE_STARTUP_MS);

  let setup: Awaited<ReturnType<typeof open>>;
  async function open() {
    const db = await testDatabase();
    const ledger = new PostgresLedgerRepository(db);
    const charges = new PostgresChargeRepository(db);
    const createCharge = createChargeUseCase({ charges, buildPaymentLink: fakeLink, now: () => NOW });
    const addToLedger = addToLedgerUseCase({ ledger, now: () => NOW });
    const chargeFromLedger = chargeFromLedgerUseCase({ ledger, charges, buildPaymentLink: fakeLink, createCharge });
    return { ledger, charges, addToLedger, chargeFromLedger };
  }

  beforeEach(async () => {
    setup = await open();
  });

  it("charges each entry once and leaves no stray charge behind", async () => {
    const { ledger, charges, addToLedger, chargeFromLedger } = setup;
    await addToLedger({ requestId: "turn-1", customer: "Juan Pérez", description: "torta", amount: wars(30_000n) });
    await addToLedger({ requestId: "turn-2", customer: "Juan Pérez", description: "pan", amount: wars(5_000n) });

    // Both read the ledger before either links the entries to its charge.
    const results = await Promise.allSettled([
      chargeFromLedger({ requestId: "owner-a", customer: "Juan Pérez" }),
      chargeFromLedger({ requestId: "owner-b", customer: "Juan Pérez" }),
    ]);

    const all = await charges.list();
    expect(all).toHaveLength(1);
    const [charge] = all;
    expect(charge?.amount).toEqual(wars(35_000n));
    expect((await ledger.list()).map((entry) => entry.chargeId)).toEqual([charge?.id, charge?.id]);

    const [won, lost] = [...results].sort((result) => (result.status === "fulfilled" ? -1 : 1));
    expect(won?.status === "fulfilled" && won.value.charge).toEqual(charge);
    expect(lost?.status === "rejected" && lost.reason).toBeInstanceOf(NothingToChargeError);
  });

  it("returns the same charge to a retry of the same request running at the same time", async () => {
    const { charges, addToLedger, chargeFromLedger } = setup;
    await addToLedger({ requestId: "turn-1", customer: "Juan Pérez", description: "torta", amount: wars(30_000n) });

    const [first, retry] = await Promise.all([
      chargeFromLedger({ requestId: "owner-a", customer: "Juan Pérez" }),
      chargeFromLedger({ requestId: "owner-a", customer: "Juan Pérez" }),
    ]);

    expect(await charges.list()).toHaveLength(1);
    expect(retry.charge).toEqual(first.charge);
  });
});
