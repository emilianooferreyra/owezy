import { describe, expect, it } from "vitest";
import { InMemoryChargeRepository } from "../infrastructure/in-memory-charge-repository";
import { InMemoryLedgerRepository } from "../infrastructure/in-memory-ledger-repository";
import { wars } from "../testing/fixtures";
import { createChargeUseCase } from "./create-charge";
import { AmbiguousCustomerError, addToLedgerUseCase, chargeFromLedgerUseCase, NothingToChargeError } from "./ledger";
import { LedgerConflictError, type PaymentLinkBuilder } from "./ports";
import type { LedgerEntry } from "../domain/ledger";

const fakeLink: PaymentLinkBuilder = (charge) => `https://pay.test/${charge.id}`;
const NOW = new Date("2026-11-03T15:00:00.000Z");

function setup(ledger = new InMemoryLedgerRepository()) {
  const charges = new InMemoryChargeRepository();
  const createCharge = createChargeUseCase({ charges, buildPaymentLink: fakeLink, now: () => NOW });
  return {
    ledger,
    charges,
    addToLedger: addToLedgerUseCase({ ledger, now: () => NOW }),
    chargeFromLedger: chargeFromLedgerUseCase({ ledger, charges, buildPaymentLink: fakeLink, createCharge }),
  };
}

const purchase = (requestId: string, customer: string, description: string, pesos: bigint) => ({
  requestId,
  customer,
  description,
  amount: wars(pesos),
});

describe("addToLedger use case", () => {
  it("writes the purchase down as L-0001, L-0002...", async () => {
    const { ledger, addToLedger } = setup();

    const first = await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));
    const second = await addToLedger(purchase("turn-2", "Martina Gómez", "pan", 5_000n));

    expect([first.entry.id, second.entry.id]).toEqual(["L-0001", "L-0002"]);
    expect(first.entry).toMatchObject({ customer: "Juan Pérez", recordedAt: NOW.toISOString() });
    expect(await ledger.list()).toHaveLength(2);
  });

  it("writes a short name under the customer the ledger already has", async () => {
    const { ledger, addToLedger } = setup();
    await addToLedger(purchase("turn-1", "Martina Gómez", "pan", 5_000n));

    const { entry } = await addToLedger(purchase("turn-2", "martina", "pastafrola", 8_000n));

    expect(entry.customer).toBe("Martina Gómez");
    expect((await ledger.list()).map(({ customer }) => customer)).toEqual(["Martina Gómez", "Martina Gómez"]);
  });

  it("does not write the purchase twice when the same request names the customer two ways", async () => {
    const { ledger, addToLedger } = setup();
    await addToLedger(purchase("turn-1", "Martina Gómez", "pan", 5_000n));

    const first = await addToLedger(purchase("turn-2", "Martina", "3 medialunas", 4_500n));
    const retry = await addToLedger(purchase("turn-2", "Martina Gómez", "3 medialunas", 4_500n));

    expect(retry).toEqual({ entry: first.entry, created: false });
    expect(await ledger.list()).toHaveLength(2);
  });

  it("writes nothing when the name could be two customers, and names them", async () => {
    const { ledger, addToLedger } = setup();
    await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));
    await addToLedger(purchase("turn-2", "Juan Ruiz", "pan", 5_000n));

    const attempt = addToLedger(purchase("turn-3", "Juan", "facturas", 4_000n));

    await expect(attempt).rejects.toBeInstanceOf(AmbiguousCustomerError);
    await expect(attempt).rejects.toMatchObject({ candidates: ["Juan Pérez", "Juan Ruiz"] });
    expect(await ledger.list()).toHaveLength(2);
  });

  it("does not write the same request twice when the agent retries it", async () => {
    const { ledger, addToLedger } = setup();

    await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));
    const retry = await addToLedger(purchase("turn-1", "juan perez", "torta", 30_000n));

    expect(retry.created).toBe(false);
    expect(await ledger.list()).toHaveLength(1);
  });

  it("takes the next reference when another writer took this one at the same time", async () => {
    class RacedLedger extends InMemoryLedgerRepository {
      raced = false;
      override async add(entry: LedgerEntry): Promise<void> {
        if (!this.raced) {
          this.raced = true;
          await super.add({ ...entry, idempotencyKey: "someone-else" });
          throw new LedgerConflictError(entry.id);
        }
        await super.add(entry);
      }
    }
    const { addToLedger } = setup(new RacedLedger());

    const result = await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));

    expect(result.entry.id).toBe("L-0002");
  });
});

describe("chargeFromLedger use case", () => {
  it("charges what the customer has not been charged for yet, in one charge, and marks those entries", async () => {
    const { ledger, addToLedger, chargeFromLedger } = setup();
    await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));
    await addToLedger(purchase("turn-2", "Martina Gómez", "pan", 5_000n));
    await addToLedger(purchase("turn-3", "Juan Pérez", "medialunas", 12_000n));

    const result = await chargeFromLedger({ requestId: "turn-4", customer: "juan perez" });

    expect(result.created).toBe(true);
    expect(result.charge).toMatchObject({
      customer: "Juan Pérez",
      description: "torta + medialunas",
      amount: wars(42_000n),
    });
    expect(result.entries.map(({ id }) => id)).toEqual(["L-0001", "L-0003"]);
    const charged = (await ledger.list()).filter(({ chargeId }) => chargeId === result.charge.id);
    expect(charged.map(({ id }) => id)).toEqual(["L-0001", "L-0003"]);
  });

  it("charges the customer the ledger has when the owner uses part of the name", async () => {
    const { addToLedger, chargeFromLedger } = setup();
    await addToLedger(purchase("turn-1", "Martina Gómez", "pan", 5_000n));

    const result = await chargeFromLedger({ requestId: "turn-2", customer: "Martina" });

    expect(result.charge).toMatchObject({ customer: "Martina Gómez", amount: wars(5_000n) });
  });

  it("charges nobody when the name could be two customers, and names them", async () => {
    const { charges, addToLedger, chargeFromLedger } = setup();
    await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));
    await addToLedger(purchase("turn-2", "Juan Ruiz", "pan", 5_000n));

    const attempt = chargeFromLedger({ requestId: "turn-3", customer: "juan" });

    await expect(attempt).rejects.toMatchObject({ name: "AmbiguousCustomerError", candidates: ["Juan Pérez", "Juan Ruiz"] });
    expect(await charges.list()).toHaveLength(0);
  });

  it("never charges the same entries twice", async () => {
    const { addToLedger, chargeFromLedger } = setup();
    await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));
    await chargeFromLedger({ requestId: "turn-2", customer: "Juan Pérez" });

    await expect(chargeFromLedger({ requestId: "turn-3", customer: "Juan Pérez" })).rejects.toBeInstanceOf(
      NothingToChargeError,
    );
  });

  it("returns the same charge when the agent retries the request that created it", async () => {
    const { charges, addToLedger, chargeFromLedger } = setup();
    await addToLedger(purchase("turn-1", "Juan Pérez", "torta", 30_000n));
    const first = await chargeFromLedger({ requestId: "turn-2", customer: "Juan Pérez" });

    const retry = await chargeFromLedger({ requestId: "turn-2", customer: "Juan Pérez" });

    expect(retry).toMatchObject({ created: false, charge: { id: first.charge.id } });
    expect(await charges.list()).toHaveLength(1);
  });

  it("says so when the customer owes nothing that is not charged already", async () => {
    const { chargeFromLedger } = setup();

    await expect(chargeFromLedger({ requestId: "turn-1", customer: "Nadie" })).rejects.toThrow(NothingToChargeError);
  });
});
