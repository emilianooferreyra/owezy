import { describe, expect, it } from "vitest";
import type { PaymentLinkBuilder } from "./application/ports";
import { ChargeNotFoundError, createChargesFeature } from "./charges-feature";
import { InMemoryChargeRepository } from "./infrastructure/in-memory-charge-repository";
import { InMemoryLedgerRepository } from "./infrastructure/in-memory-ledger-repository";
import { SimulatedTransferSource } from "./infrastructure/simulated-transfer-source";

const fakeLink: PaymentLinkBuilder = (charge) => `https://pay.test/${charge.id}`;
const NOW = new Date("2026-11-03T15:00:00.000Z");

function feature() {
  return createChargesFeature({
    charges: new InMemoryChargeRepository(),
    ledger: new InMemoryLedgerRepository(),
    buildPaymentLink: fakeLink,
    now: () => NOW,
    simulator: new SimulatedTransferSource({ now: () => new Date(NOW.getTime() + 60_000) }),
  });
}

describe("charges feature: one shop per country", () => {
  it("charges in pesos when nothing says otherwise", async () => {
    const charge = await feature().createCharge({ requestId: "t1", customer: "Juan", description: "pan", amount: "5000" });

    expect(charge.currency).toBe("wARS");
  });

  it("charges and writes down in reais for a Brazilian shop", async () => {
    const shop = feature();

    const charge = await shop.createCharge({
      requestId: "t1",
      customer: "João",
      description: "pão de queijo",
      amount: "120",
      currency: "wBRL",
    });
    const { entry } = await shop.addToLedger({
      requestId: "t2",
      customer: "Maria",
      description: "bolo",
      amount: "85.5",
      currency: "wBRL",
    });

    expect(charge).toMatchObject({ amount: "120", currency: "wBRL" });
    expect(entry).toMatchObject({ amount: "85.5", currency: "wBRL" });
  });

  it("keeps each country's ledger apart: totals never add pesos and reais", async () => {
    const shop = feature();
    await shop.addToLedger({ requestId: "t1", customer: "Juan Pérez", description: "torta", amount: "30000" });
    await shop.addToLedger({ requestId: "t2", customer: "João Silva", description: "bolo", amount: "120", currency: "wBRL" });

    const argentina = await shop.readLedger({});
    const brazil = await shop.readLedger({ currency: "wBRL" });

    expect(argentina.customers.map(({ customer }) => customer)).toEqual(["Juan Pérez"]);
    expect(argentina.totalOwed).toBe("30000");
    expect(brazil.customers.map(({ customer }) => customer)).toEqual(["João Silva"]);
    expect(brazil.totalOwed).toBe("120");
  });

  it("numbers entries across both countries, so a reference never repeats", async () => {
    const shop = feature();
    await shop.addToLedger({ requestId: "t1", customer: "Juan Pérez", description: "torta", amount: "30000" });

    const { entry } = await shop.addToLedger({
      requestId: "t2",
      customer: "João Silva",
      description: "bolo",
      amount: "120",
      currency: "wBRL",
    });

    expect(entry.id).toBe("L-0002");
  });

  it("finds the customer only among the same country's customers", async () => {
    const shop = feature();
    await shop.addToLedger({ requestId: "t1", customer: "Ana Pérez", description: "torta", amount: "30000" });

    const { entry } = await shop.addToLedger({ requestId: "t2", customer: "Ana", description: "bolo", amount: "120", currency: "wBRL" });

    expect(entry.customer).toBe("Ana");
  });

  it("charges a Brazilian customer from the Brazilian ledger, in reais", async () => {
    const shop = feature();
    await shop.addToLedger({ requestId: "t1", customer: "João Silva", description: "bolo", amount: "120", currency: "wBRL" });
    await shop.addToLedger({ requestId: "t2", customer: "João Silva", description: "pão", amount: "30", currency: "wBRL" });

    const charge = await shop.chargeFromLedger({ requestId: "t3", customer: "João", currency: "wBRL" });

    expect(charge).toMatchObject({ customer: "João Silva", amount: "150", currency: "wBRL", entries: ["L-0001", "L-0002"] });
  });

  it("never finds an Argentine customer from the Brazilian shop", async () => {
    const shop = feature();
    await shop.addToLedger({ requestId: "t1", customer: "Juan Pérez", description: "torta", amount: "30000" });

    await expect(shop.chargeFromLedger({ requestId: "t2", customer: "Juan", currency: "wBRL" })).rejects.toMatchObject({
      name: "NothingToChargeError",
    });
  });

  it("lists each country's charges with its own total", async () => {
    const shop = feature();
    await shop.createCharge({ requestId: "t1", customer: "Juan", description: "pan", amount: "5000" });
    await shop.createCharge({ requestId: "t2", customer: "João", description: "pão", amount: "20", currency: "wBRL" });

    const brazil = await shop.listCharges({ currency: "wBRL" });
    const argentina = await shop.listCharges({});

    expect(brazil).toMatchObject({ count: 1, total: "20" });
    expect(brazil.charges[0]?.currency).toBe("wBRL");
    expect(argentina).toMatchObject({ count: 1, total: "5000" });
  });

  it("pays a charge in reais with a simulated transfer in reais", async () => {
    const shop = feature();
    const charge = await shop.createCharge({ requestId: "t1", customer: "João", description: "pão", amount: "20", currency: "wBRL" });

    const { outcome, charge: paid } = await shop.simulatePayment(charge.id);

    expect(outcome).toBe("paid");
    expect(paid.status).toBe("paid");
  });

  describe("sharing a charge again", () => {
    it("gives back an existing charge with its link, so the owner can send it again", async () => {
      const shop = feature();
      const created = await shop.createCharge({ requestId: "t1", customer: "Carlos Ruiz", description: "torta", amount: "28000" });

      const shared = await shop.shareCharge({ reference: created.id, currency: "wARS" });

      expect(shared).toMatchObject({ id: created.id, customer: "Carlos Ruiz", amount: "28000", status: "pending", paymentLink: created.paymentLink });
    });

    it("shows a charge that was already paid as paid, so it is not sent twice", async () => {
      const shop = feature();
      const created = await shop.createCharge({ requestId: "t1", customer: "Carlos Ruiz", description: "torta", amount: "28000" });
      await shop.simulatePayment(created.id);

      expect(await shop.shareCharge({ reference: created.id, currency: "wARS" })).toMatchObject({ status: "paid" });
    });

    it("never shares another country's charge, as if it did not exist", async () => {
      const shop = feature();
      const brazilian = await shop.createCharge({ requestId: "t1", customer: "João", description: "pão", amount: "120", currency: "wBRL" });

      await expect(shop.shareCharge({ reference: brazilian.id, currency: "wARS" })).rejects.toBeInstanceOf(ChargeNotFoundError);
      await expect(shop.shareCharge({ reference: "C-9999", currency: "wARS" })).rejects.toBeInstanceOf(ChargeNotFoundError);
    });
  });
});
