import { describe, expect, it, vi } from "vitest";
import { fromDecimalString, InvalidAmountError } from "../../core/money/money";
import type { PaymentLinkBuilder, TransferSource } from "./application/ports";
import {
  ChargeNotFoundError,
  createChargesFeature,
  PaymentSimulationUnavailableError,
} from "./charges-feature";
import { ambiguousPayment, unmatchedPayment } from "./domain/activity";
import { InMemoryActivityLog } from "./infrastructure/in-memory-activity-log";
import { InMemoryChargeRepository } from "./infrastructure/in-memory-charge-repository";
import { SimulatedTransferSource } from "./infrastructure/simulated-transfer-source";
import { aCharge, aTransfer } from "./testing/fixtures";

const fakeLink: PaymentLinkBuilder = (charge) => `https://pay.test/${charge.id}`;
const CREATED_AT = new Date("2026-10-17T15:00:00.000Z");
const PAID_AT = new Date("2026-10-17T15:05:00.000Z");

function feature(options: { simulated?: boolean } = { simulated: true }) {
  return createChargesFeature({
    charges: new InMemoryChargeRepository(),
    buildPaymentLink: fakeLink,
    now: () => CREATED_AT,
    ...(options.simulated ? { simulator: new SimulatedTransferSource({ now: () => PAID_AT }) } : {}),
  });
}

const request = {
  requestId: "session-1:turn-1",
  customer: "Juan Pérez",
  description: "2 docenas de medialunas",
  amount: "85000",
};

describe("charges feature", () => {
  it("creates a wARS charge and returns a plain view with its reference and link", async () => {
    const view = await feature().createCharge(request);

    expect(view).toEqual({
      id: "C-0001",
      customer: "Juan Pérez",
      description: "2 docenas de medialunas",
      amount: "85000",
      currency: "wARS",
      status: "pending",
      createdAt: "2026-10-17T15:00:00.000Z",
      paymentLink: "https://pay.test/C-0001",
      created: true,
    });
  });

  it("returns a view that survives a JSON round trip (eve tool outputs must be serializable)", async () => {
    const view = await feature().createCharge({ ...request, amount: "85000.5" });

    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("does not duplicate the charge when the agent retries the same request", async () => {
    const charges = feature();
    await charges.createCharge(request);

    const retry = await charges.createCharge(request);

    expect(retry).toMatchObject({ id: "C-0001", created: false });
  });

  it("rejects an amount that is not a decimal number", async () => {
    await expect(feature().createCharge({ ...request, amount: "85.000,50" })).rejects.toThrow(InvalidAmountError);
  });

  it("finds a charge by reference for the payment page and the card's status", async () => {
    const charges = feature();
    await charges.createCharge(request);

    expect(await charges.getCharge("C-0001")).toMatchObject({ id: "C-0001", status: "pending" });
    expect(await charges.getCharge("C-9999")).toBeUndefined();
  });

  describe("getCharges", () => {
    it("returns the charges that exist among the ids, in the order asked, and skips the rest", async () => {
      const charges = feature();
      await charges.createCharge(request);
      await charges.createCharge({ ...request, requestId: "session-1:turn-2" });

      const found = await charges.getCharges(["C-0002", "C-9999", "C-0001"]);

      expect(found.map((charge) => charge.id)).toEqual(["C-0002", "C-0001"]);
    });

    it("reads the repository once, however many charges it is asked for", async () => {
      const repository = new InMemoryChargeRepository();
      const list = vi.spyOn(repository, "list");
      const charges = createChargesFeature({ charges: repository, buildPaymentLink: fakeLink });

      await charges.getCharges(["C-0001", "C-0002", "C-0003"]);

      expect(list).toHaveBeenCalledOnce();
    });
  });

  describe("syncPayments", () => {
    it("marks charges paid from the transfers the chain reports", async () => {
      const amount = fromDecimalString("85000", "wARS");
      const chain: TransferSource = {
        listIncoming: async () => [{ id: "0xabc:0", amount, receivedAt: "2026-10-18T01:10:53.000Z" }],
      };
      const charges = createChargesFeature({
        charges: new InMemoryChargeRepository(),
        buildPaymentLink: fakeLink,
        now: () => CREATED_AT,
        transfers: chain,
      });
      await charges.createCharge(request);

      const report = await charges.syncPayments();

      expect(report.paid).toEqual(["C-0001"]);
      expect(await charges.getCharge("C-0001")).toMatchObject({ status: "paid", paidBy: "0xabc:0" });
    });

    it("does nothing when there is no source of transfers", async () => {
      const charges = createChargesFeature({ charges: new InMemoryChargeRepository(), buildPaymentLink: fakeLink });

      expect(await charges.syncPayments()).toEqual({ paid: [], unmatched: [], ambiguous: [] });
    });
  });

  describe("listCharges", () => {
    async function withCharges(amounts: string[]) {
      const charges = feature();
      for (const [index, amount] of amounts.entries()) {
        await charges.createCharge({ ...request, requestId: `session-1:turn-${index}`, amount });
      }
      return charges;
    }

    it("lists the newest charges first", async () => {
      const charges = await withCharges(["1000", "2000", "3000"]);

      const { charges: listed } = await charges.listCharges({});

      expect(listed.map((charge) => charge.id)).toEqual(["C-0003", "C-0002", "C-0001"]);
    });

    it("filters by status and adds up what the filtered charges are worth", async () => {
      const charges = await withCharges(["1000", "2000.5", "3000"]);
      await charges.simulatePayment("C-0003");

      const pending = await charges.listCharges({ status: "pending" });

      expect(pending.charges.map((charge) => charge.id)).toEqual(["C-0002", "C-0001"]);
      expect(pending).toMatchObject({ count: 2, total: "3000.5" });
    });

    it("shows the latest payments, since it reconciles the transfers that arrived before listing", async () => {
      const amount = fromDecimalString("85000", "wARS");
      const chain: TransferSource = {
        listIncoming: async () => [{ id: "0xabc:0", amount, receivedAt: "2026-10-18T01:10:53.000Z" }],
      };
      const charges = createChargesFeature({
        charges: new InMemoryChargeRepository(),
        buildPaymentLink: fakeLink,
        now: () => CREATED_AT,
        transfers: chain,
      });
      await charges.createCharge(request);

      const { charges: listed } = await charges.listCharges({});

      expect(listed[0]).toMatchObject({ id: "C-0001", status: "paid" });
    });

    it("returns at most the limit, while the count and total still cover every match", async () => {
      const charges = await withCharges(["1000", "2000", "3000"]);

      const result = await charges.listCharges({ limit: 2 });

      expect(result.charges.map((charge) => charge.id)).toEqual(["C-0003", "C-0002"]);
      expect(result).toMatchObject({ count: 3, total: "6000" });
    });

    it("returns the newest 20 by default, so a long history does not flood the model", async () => {
      const charges = await withCharges(Array.from({ length: 21 }, () => "1000"));

      const result = await charges.listCharges({});

      expect(result.charges).toHaveLength(20);
      expect(result.count).toBe(21);
    });

    it("reports zero when there is nothing to list", async () => {
      expect(await feature().listCharges({ status: "paid" })).toEqual({ charges: [], count: 0, total: "0" });
    });
  });

  describe("simulated payments", () => {
    it("pays the charge through the same reconciliation real payments use, with receipt data", async () => {
      const charges = feature();
      await charges.createCharge(request);

      const result = await charges.simulatePayment("C-0001");

      expect(result.outcome).toBe("paid");
      expect(result.charge).toMatchObject({
        status: "paid",
        paidAt: "2026-10-17T15:05:00.000Z",
        paidBy: "simulated-1",
      });
      expect(await charges.getCharge("C-0001")).toMatchObject({ status: "paid" });
    });

    it("does not pay twice when the payer presses the button again", async () => {
      const charges = feature();
      await charges.createCharge(request);
      await charges.simulatePayment("C-0001");

      expect((await charges.simulatePayment("C-0001")).outcome).toBe("already-paid");
    });

    it("pays the right charge when two customers were charged the same amount (the second costs a cent more)", async () => {
      const charges = feature();
      await charges.createCharge(request);
      const ana = await charges.createCharge({ ...request, customer: "Ana Gómez" });

      const result = await charges.simulatePayment("C-0002");

      expect(ana.amount).toBe("85000.01");
      expect(result.outcome).toBe("paid");
      expect((await charges.getCharge("C-0001"))?.status).toBe("pending");
    });

    it("fails for a charge that does not exist", async () => {
      await expect(feature().simulatePayment("C-9999")).rejects.toThrow(ChargeNotFoundError);
    });

    it("is unavailable when the feature runs without a simulator (real payments)", async () => {
      const charges = feature({ simulated: false });
      await charges.createCharge(request);

      await expect(charges.simulatePayment("C-0001")).rejects.toThrow(PaymentSimulationUnavailableError);
    });
  });

  describe("the agent's activity", () => {
    function featureWithActivity() {
      const activity = new InMemoryActivityLog();
      const transfers = new SimulatedTransferSource({ now: () => PAID_AT });
      const charges = createChargesFeature({
        charges: new InMemoryChargeRepository(),
        buildPaymentLink: fakeLink,
        now: () => CREATED_AT,
        simulator: transfers,
        activity,
      });
      return { charges, transfers, activity };
    }

    it("records a simulated payment the agent reconciled", async () => {
      const { charges, activity } = featureWithActivity();
      await charges.createCharge(request);

      await charges.simulatePayment("C-0001");

      expect(await activity.list()).toMatchObject([{ kind: "payment-matched", chargeId: "C-0001" }]);
    });

    it("records what it finds when the owner asks for their charges", async () => {
      const { charges, transfers, activity } = featureWithActivity();
      await charges.createCharge(request);
      await transfers.simulatePayment(fromDecimalString("85000", "wARS"));

      await charges.listCharges({});

      expect(await activity.list()).toMatchObject([{ kind: "payment-matched", chargeId: "C-0001" }]);
    });

    describe("listActivity", () => {
      it("shows what the agent did as plain JSON, with the amount as a decimal string", async () => {
        const { charges } = featureWithActivity();
        await charges.createCharge(request);
        await charges.simulatePayment("C-0001");

        const listed = await charges.listActivity({});

        expect(listed).toEqual([
          {
            id: "payment-matched:simulated-1",
            kind: "payment-matched",
            transferId: "simulated-1",
            amount: "85000",
            currency: "wARS",
            receivedAt: "2026-10-17T15:05:00.000Z",
            recordedAt: "2026-10-17T15:00:00.000Z",
            chargeId: "C-0001",
            customer: "Juan Pérez",
          },
        ]);
        expect(JSON.parse(JSON.stringify(listed))).toEqual(listed);
      });

      it("shows the newest first and at most the limit", async () => {
        const { charges, transfers } = featureWithActivity();
        for (const amount of ["1", "2", "3"]) {
          await transfers.simulatePayment(fromDecimalString(amount, "wARS"));
          await charges.syncPayments();
        }

        const listed = await charges.listActivity({ limit: 2 });

        expect(listed.map((entry) => entry.transferId)).toEqual(["simulated-3", "simulated-2"]);
      });

      it("keeps the candidates of an ambiguous payment and the transfer of an unmatched one", async () => {
        const { charges, activity } = featureWithActivity();
        await activity.record([
          unmatchedPayment(aTransfer({ id: "tx-1" }), "2026-10-20T12:00:00.000Z"),
          ambiguousPayment(aTransfer({ id: "tx-2" }), [aCharge({ id: "C-0001" }), aCharge({ id: "C-0002" })], "2026-10-20T12:00:00.000Z"),
        ]);

        expect(await charges.listActivity({})).toMatchObject([
          { kind: "payment-ambiguous", transferId: "tx-2", chargeIds: ["C-0001", "C-0002"] },
          { kind: "payment-unmatched", transferId: "tx-1" },
        ]);
      });

      it("is empty when the feature keeps no activity", async () => {
        expect(await feature().listActivity({})).toEqual([]);
      });
    });
  });
});
