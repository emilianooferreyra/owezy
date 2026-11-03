import { describe, expect, it } from "vitest";
import { LedgerUnavailableError, createChargesFeature } from "./charges-feature";
import { NothingToChargeError } from "./application/ledger";
import type { PaymentLinkBuilder } from "./application/ports";
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

const note = (requestId: string, customer: string, description: string, amount: string) => ({
  requestId,
  customer,
  description,
  amount,
});

describe("charges feature: the ledger", () => {
  it("writes a purchase down and shows it as plain JSON, amounts as decimal strings", async () => {
    const result = await feature().addToLedger(note("turn-1", "Juan Pérez", "torta", "30000"));

    expect(result).toEqual({
      created: true,
      entry: {
        id: "L-0001",
        customer: "Juan Pérez",
        description: "torta",
        amount: "30000",
        currency: "wARS",
        recordedAt: NOW.toISOString(),
        status: "unbilled",
      },
    });
  });

  it("answers who owes what, with each customer's total and the shop's total", async () => {
    const charges = feature();
    await charges.addToLedger(note("turn-1", "Juan Pérez", "torta", "30000"));
    await charges.addToLedger(note("turn-2", "Martina Gómez", "pan", "5000"));
    await charges.addToLedger(note("turn-3", "Juan Pérez", "medialunas", "12000"));

    const ledger = await charges.readLedger({});

    expect(ledger.totalOwed).toBe("47000");
    expect(ledger.customers.map(({ customer, owed, unbilled }) => [customer, owed, unbilled])).toEqual([
      ["Juan Pérez", "42000", "42000"],
      ["Martina Gómez", "5000", "5000"],
    ]);
  });

  it("looks a customer up by part of the name, or shows every customer the name could be", async () => {
    const charges = feature();
    await charges.addToLedger(note("turn-1", "Juan Pérez", "torta", "30000"));
    await charges.addToLedger(note("turn-2", "Martina Gómez", "pan", "5000"));
    await charges.addToLedger(note("turn-3", "Juan Ruiz", "medialunas", "12000"));

    const customersOf = async (customer: string) =>
      (await charges.readLedger({ customer })).customers.map(({ customer: name }) => name);

    expect(await customersOf("martina")).toEqual(["Martina Gómez"]);
    expect(await customersOf("Juan")).toEqual(["Juan Pérez", "Juan Ruiz"]);
    expect(await customersOf("Pedro")).toEqual([]);
  });

  it("charges a customer from the ledger, and shows the entries as paid once the payment arrives", async () => {
    const charges = feature();
    await charges.addToLedger(note("turn-1", "Juan Pérez", "torta", "30000"));
    await charges.addToLedger(note("turn-2", "Juan Pérez", "medialunas", "12000"));

    const charge = await charges.chargeFromLedger({ requestId: "turn-3", customer: "juan perez" });
    expect(charge).toMatchObject({
      id: "C-0001",
      customer: "Juan Pérez",
      description: "torta + medialunas",
      amount: "42000",
      paymentLink: "https://pay.test/C-0001",
      created: true,
      entries: ["L-0001", "L-0002"],
    });
    expect((await charges.readLedger({})).customers[0]?.entries.map(({ status }) => status)).toEqual([
      "charged",
      "charged",
    ]);

    await charges.simulatePayment("C-0001");

    const after = await charges.readLedger({ customer: "Juan Pérez" });
    expect(after.customers[0]).toMatchObject({ owed: "0", unbilled: "0" });
    expect(after.customers[0]?.entries.map(({ status }) => status)).toEqual(["paid", "paid"]);
  });

  it("refuses to charge a customer who has nothing left to charge", async () => {
    await expect(feature().chargeFromLedger({ requestId: "turn-1", customer: "Nadie" })).rejects.toBeInstanceOf(
      NothingToChargeError,
    );
  });

  it("says the ledger is not set up instead of failing obscurely", async () => {
    const withoutLedger = createChargesFeature({ charges: new InMemoryChargeRepository(), buildPaymentLink: fakeLink });

    await expect(withoutLedger.readLedger({})).rejects.toBeInstanceOf(LedgerUnavailableError);
  });
});
