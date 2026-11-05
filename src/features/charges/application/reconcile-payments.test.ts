import { describe, expect, it } from "vitest";
import { InMemoryActivityLog } from "../infrastructure/in-memory-activity-log";
import { ChargeConflictError, type ChargeRepository } from "./ports";
import { InMemoryChargeRepository } from "../infrastructure/in-memory-charge-repository";
import { SimulatedTransferSource } from "../infrastructure/simulated-transfer-source";
import { aCharge, wars } from "../testing/fixtures";
import { reconcilePaymentsUseCase } from "./reconcile-payments";

async function setup(...pending: Array<[id: string, units: bigint]>) {
  const charges = new InMemoryChargeRepository();
  for (const [id, units] of pending) {
    await charges.save(aCharge({ id, amount: wars(units) }));
  }
  const transfers = new SimulatedTransferSource();
  const reconcile = reconcilePaymentsUseCase({ charges, transfers });
  return { charges, transfers, reconcile };
}

describe("reconcilePayments use case", () => {
  it("marks the matching charge as paid and reports it", async () => {
    const { charges, transfers, reconcile } = await setup(["C-0123", 85_000n]);
    const transfer = await transfers.simulatePayment(wars(85_000n));

    const report = await reconcile();

    expect(report).toEqual({ paid: ["C-0123"], unmatched: [], ambiguous: [] });
    expect(await charges.findById("C-0123")).toMatchObject({ status: "paid", paidBy: transfer.id });
  });

  it("is safe to repeat: a second run changes nothing", async () => {
    const { transfers, reconcile } = await setup(["C-0123", 85_000n]);
    await transfers.simulatePayment(wars(85_000n));
    await reconcile();

    const second = await reconcile();

    expect(second).toEqual({ paid: [], unmatched: [], ambiguous: [] });
  });

  it("never lets a transfer that already paid a charge pay a newer one with the same amount", async () => {
    const { charges, transfers, reconcile } = await setup(["C-0001", 85_000n]);
    await transfers.simulatePayment(wars(85_000n));
    await reconcile();
    await charges.save(aCharge({ id: "C-0002", amount: wars(85_000n) }));

    await reconcile();

    expect(await charges.findById("C-0002")).toMatchObject({ status: "pending" });
  });

  it("leaves a charge another run paid at the same time to that run, without failing or claiming it", async () => {
    const { charges, transfers } = await setup(["C-0001", 85_000n]);
    await transfers.simulatePayment(wars(85_000n));
    // The database refuses the save: another reconciliation paid C-0001 between this run's read and write.
    const racing: ChargeRepository = {
      findById: (id) => charges.findById(id),
      findByIdempotencyKey: (key) => charges.findByIdempotencyKey(key),
      list: () => charges.list(),
      save: async () => {
        throw new ChargeConflictError("C-0001");
      },
    };
    const activity = new InMemoryActivityLog();

    const report = await reconcilePaymentsUseCase({ charges: racing, transfers, activity })();

    expect(report).toEqual({ paid: [], unmatched: [], ambiguous: [] });
    expect(await activity.list()).toEqual([]);
  });

  it("reports a transfer that matches no charge", async () => {
    const { transfers, reconcile } = await setup(["C-0123", 85_000n]);
    const transfer = await transfers.simulatePayment(wars(1_000n));

    expect(await reconcile()).toEqual({ paid: [], unmatched: [transfer.id], ambiguous: [] });
  });

  it("leaves both charges pending when a transfer could pay either", async () => {
    const { charges, transfers, reconcile } = await setup(["C-0001", 85_000n], ["C-0002", 85_000n]);
    const transfer = await transfers.simulatePayment(wars(85_000n));

    expect(await reconcile()).toEqual({ paid: [], unmatched: [], ambiguous: [transfer.id] });
    expect(await charges.findById("C-0001")).toMatchObject({ status: "pending" });
    expect(await charges.findById("C-0002")).toMatchObject({ status: "pending" });
  });

  it("reports a duplicate payment in the same run as unmatched and keeps the first one", async () => {
    const { charges, transfers, reconcile } = await setup(["C-0123", 85_000n]);
    const first = await transfers.simulatePayment(wars(85_000n));
    const duplicate = await transfers.simulatePayment(wars(85_000n));

    expect(await reconcile()).toEqual({ paid: ["C-0123"], unmatched: [duplicate.id], ambiguous: [] });
    expect(await charges.findById("C-0123")).toMatchObject({ paidBy: first.id });
  });

  it("pays two charges with different amounts in one run", async () => {
    const { transfers, reconcile } = await setup(["C-0001", 85_000n], ["C-0002", 90_000n]);
    await transfers.simulatePayment(wars(90_000n));
    await transfers.simulatePayment(wars(85_000n));

    const report = await reconcile();

    expect([...report.paid].sort()).toEqual(["C-0001", "C-0002"]);
  });
});

describe("reconcilePayments use case, keeping the agent's activity", () => {
  const NOW = new Date("2026-10-20T12:00:00.000Z");

  async function setupWithActivity(...pending: Array<[id: string, units: bigint]>) {
    const charges = new InMemoryChargeRepository();
    for (const [id, units] of pending) {
      await charges.save(aCharge({ id, customer: `Customer of ${id}`, amount: wars(units) }));
    }
    const transfers = new SimulatedTransferSource();
    const activity = new InMemoryActivityLog();
    const reconcile = reconcilePaymentsUseCase({ charges, transfers, activity, now: () => NOW });
    return { transfers, activity, reconcile };
  }

  it("records who paid which charge, how much, and when the agent noticed", async () => {
    const { transfers, activity, reconcile } = await setupWithActivity(["C-0007", 42_500n]);
    const transfer = await transfers.simulatePayment(wars(42_500n));

    await reconcile();

    expect(await activity.list()).toEqual([
      {
        id: `payment-matched:${transfer.id}`,
        kind: "payment-matched",
        transferId: transfer.id,
        amount: wars(42_500n),
        receivedAt: transfer.receivedAt,
        recordedAt: NOW.toISOString(),
        chargeId: "C-0007",
        customer: "Customer of C-0007",
      },
    ]);
  });

  it("records a payment that matches no charge, for the owner to look at", async () => {
    const { transfers, activity, reconcile } = await setupWithActivity(["C-0007", 42_500n]);
    const transfer = await transfers.simulatePayment(wars(12_000n));

    await reconcile();

    expect(await activity.list()).toMatchObject([{ kind: "payment-unmatched", transferId: transfer.id }]);
  });

  it("records the charges an ambiguous payment could pay, so the owner can decide", async () => {
    const { transfers, activity, reconcile } = await setupWithActivity(["C-0001", 85_000n], ["C-0002", 85_000n]);
    const transfer = await transfers.simulatePayment(wars(85_000n));

    await reconcile();

    expect(await activity.list()).toMatchObject([
      { kind: "payment-ambiguous", transferId: transfer.id, chargeIds: ["C-0001", "C-0002"] },
    ]);
  });

  it("records each event once, although an unmatched payment is reported on every run", async () => {
    const { transfers, activity, reconcile } = await setupWithActivity(["C-0007", 42_500n]);
    await transfers.simulatePayment(wars(12_000n));

    await reconcile();
    await reconcile();

    expect(await activity.list()).toHaveLength(1);
  });
});
