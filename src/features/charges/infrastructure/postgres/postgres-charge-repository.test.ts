import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../../../core/storage/database";
import { ChargeConflictError } from "../../application/ports";
import { applyPayment } from "../../domain/charge";
import { chargeDiscardContract } from "../../testing/charge-repository-discard-contract";
import { aCharge, aTransfer, UNIT, wars } from "../../testing/fixtures";
import { PostgresChargeRepository } from "./postgres-charge-repository";
import { PGLITE_STARTUP_MS, testDatabase } from "./test-database";

describe("PostgresChargeRepository", () => {
  let db: Database;

  // PGlite starts in seconds when every test file runs at once; each test then only empties it.
  beforeAll(() => testDatabase(), PGLITE_STARTUP_MS);

  beforeEach(async () => {
    db = await testDatabase();
  });

  it("starts empty", async () => {
    const repository = new PostgresChargeRepository(db);

    expect(await repository.list()).toEqual([]);
    expect(await repository.findById("C-0001")).toBeUndefined();
  });

  it("keeps every field, including an amount in base units too large for a 64-bit integer", async () => {
    const charge = aCharge({ amount: { amount: 85_000n * UNIT + 1n, currency: "wARS" }, idempotencyKey: "key-1" });
    const paid = applyPayment(charge, aTransfer({ amount: charge.amount }));

    await new PostgresChargeRepository(db).save(paid);

    expect(await new PostgresChargeRepository(db).findById("C-0001")).toEqual(paid);
  });

  it("keeps a pending charge without the fields only paid or retried charges have", async () => {
    const charge = aCharge();

    await new PostgresChargeRepository(db).save(charge);

    expect(await new PostgresChargeRepository(db).findById("C-0001")).toStrictEqual(charge);
  });

  it("finds a charge by the request that created it", async () => {
    const charge = aCharge({ idempotencyKey: "key-1" });
    await new PostgresChargeRepository(db).save(charge);

    expect(await new PostgresChargeRepository(db).findByIdempotencyKey("key-1")).toEqual(charge);
    expect(await new PostgresChargeRepository(db).findByIdempotencyKey("key-2")).toBeUndefined();
  });

  it("replaces a charge saved with the same id and keeps the others, in creation order", async () => {
    const repository = new PostgresChargeRepository(db);
    const first = aCharge({ id: "C-0001", amount: wars(1_000n) });
    const second = aCharge({ id: "C-0002", amount: wars(2_000n), createdAt: "2026-10-17T16:00:00.000Z" });
    await repository.save(second);
    await repository.save(first);

    const paid = applyPayment(first, aTransfer({ amount: first.amount }));
    await repository.save(paid);

    expect(await repository.list()).toEqual([paid, second]);
  });

  it("refuses a second pending charge for the same amount, which reconciliation could not tell apart", async () => {
    const repository = new PostgresChargeRepository(db);
    await repository.save(aCharge({ id: "C-0001" }));

    await expect(repository.save(aCharge({ id: "C-0002" }))).rejects.toBeInstanceOf(ChargeConflictError);
    expect((await repository.list()).map((charge) => charge.id)).toEqual(["C-0001"]);
  });

  it("refuses a different charge that took the same reference at the same time, keeping the first", async () => {
    const repository = new PostgresChargeRepository(db);
    const first = aCharge({ id: "C-0001", amount: wars(1_000n), idempotencyKey: "request-1" });
    await repository.save(first);

    const racing = aCharge({ id: "C-0001", amount: wars(2_000n), idempotencyKey: "request-2" });

    await expect(repository.save(racing)).rejects.toBeInstanceOf(ChargeConflictError);
    expect(await repository.list()).toEqual([first]);
  });

  it("refuses a transfer paying a second charge", async () => {
    const repository = new PostgresChargeRepository(db);
    const transfer = aTransfer({ amount: wars(1_000n) });
    await repository.save(applyPayment(aCharge({ id: "C-0001", amount: wars(1_000n) }), transfer));

    const second = applyPayment(aCharge({ id: "C-0002", amount: wars(1_000n) }), transfer);

    await expect(repository.save(second)).rejects.toBeInstanceOf(ChargeConflictError);
  });

  it("keeps the first payment when a reconciliation that read the charge before it was paid saves another transfer", async () => {
    const repository = new PostgresChargeRepository(db);
    const pending = aCharge({ id: "C-0001", amount: wars(1_000n) });
    await repository.save(pending);
    const first = applyPayment(pending, aTransfer({ id: "0xfirst:0", amount: wars(1_000n) }));
    await repository.save(first);

    // Another run read `pending` before the first one saved, and found a second, duplicate payment.
    const stale = applyPayment(pending, aTransfer({ id: "0xsecond:0", amount: wars(1_000n) }));

    await expect(repository.save(stale)).rejects.toBeInstanceOf(ChargeConflictError);
    expect(await repository.findById("C-0001")).toEqual(first);
  });

  it("accepts saving a paid charge again unchanged, as a repeated reconciliation does", async () => {
    const repository = new PostgresChargeRepository(db);
    const paid = applyPayment(aCharge({ id: "C-0001", amount: wars(1_000n) }), aTransfer({ amount: wars(1_000n) }));
    await repository.save(paid);

    await repository.save(paid);

    expect(await repository.findById("C-0001")).toEqual(paid);
  });

  it("never turns a paid charge back into a pending one", async () => {
    const repository = new PostgresChargeRepository(db);
    const pending = aCharge({ id: "C-0001", amount: wars(1_000n) });
    await repository.save(applyPayment(pending, aTransfer({ amount: wars(1_000n) })));

    await expect(repository.save(pending)).rejects.toBeInstanceOf(ChargeConflictError);
    expect(await repository.findById("C-0001")).toMatchObject({ status: "paid" });
  });
});

chargeDiscardContract("PostgresChargeRepository", async () => new PostgresChargeRepository(await testDatabase()));
