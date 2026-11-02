import { describe, expect, it, vi } from "vitest";
import { fromDecimalString } from "../../core/money/money";
import { createChargesFeature } from "./charges-feature";
import { InMemoryActivityLog } from "./infrastructure/in-memory-activity-log";
import { InMemoryChargeRepository } from "./infrastructure/in-memory-charge-repository";
import { SimulatedTransferSource } from "./infrastructure/simulated-transfer-source";
import { reconcileOnSchedule } from "./scheduled-reconciliation";

const CREATED_AT = new Date("2026-10-17T15:00:00.000Z");
const PAID_AT = new Date("2026-10-17T15:05:00.000Z");

function setup() {
  const simulator = new SimulatedTransferSource({ now: () => PAID_AT });
  const charges = createChargesFeature({
    charges: new InMemoryChargeRepository(),
    buildPaymentLink: (charge) => `https://pay.test/${charge.id}`,
    now: () => CREATED_AT,
    simulator,
    activity: new InMemoryActivityLog(),
  });
  const logger = { info: vi.fn(), error: vi.fn() };
  return { charges, simulator, logger };
}

describe("reconcileOnSchedule", () => {
  it("reconciles the payments that arrived and reports what it did", async () => {
    const { charges, simulator, logger } = setup();
    await charges.createCharge({
      requestId: "session-1:turn-1",
      customer: "Juan Pérez",
      description: "2 docenas de medialunas",
      amount: "85000",
    });
    await simulator.simulatePayment(fromDecimalString("85000", "wARS"));

    await reconcileOnSchedule(charges, logger);

    expect(await charges.getCharge("C-0001")).toMatchObject({ status: "paid" });
    expect(logger.info).toHaveBeenCalledWith("reconcile: 1 paid, 0 unmatched, 0 ambiguous");
  });

  it("logs the failure and rethrows it, so the scheduled run shows up as failed", async () => {
    const { logger } = setup();
    const failure = new Error("Celo RPC unreachable");

    await expect(
      reconcileOnSchedule({ syncPayments: () => Promise.reject(failure) }, logger),
    ).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledWith("reconcile failed", failure);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
