// Test-only: how every ChargeRepository discards a charge a request made and then lost a race for.
import { beforeEach, describe, expect, it } from "vitest";
import type { ChargeRepository } from "../application/ports";
import { applyPayment } from "../domain/charge";
import { aCharge, aTransfer, wars } from "./fixtures";

export function chargeDiscardContract(name: string, open: () => Promise<ChargeRepository>) {
  describe(`${name} (discarding a charge)`, () => {
    let charges: ChargeRepository;

    beforeEach(async () => {
      charges = await open();
    });

    it("removes a pending charge made by the same request", async () => {
      const charge = aCharge({ id: "C-0001", idempotencyKey: "owner-a|juan" });
      await charges.save(charge);

      await charges.discard(charge);

      expect(await charges.list()).toEqual([]);
    });

    it("keeps a charge another request made with the same reference", async () => {
      const kept = aCharge({ id: "C-0001", idempotencyKey: "owner-a|juan" });
      await charges.save(kept);

      await charges.discard({ ...kept, idempotencyKey: "owner-b|juan" });

      expect(await charges.list()).toEqual([kept]);
    });

    it("never removes a paid charge", async () => {
      const pending = aCharge({ id: "C-0001", amount: wars(1_000n), idempotencyKey: "owner-a|juan" });
      const paid = applyPayment(pending, aTransfer({ amount: wars(1_000n) }));
      await charges.save(paid);

      await charges.discard(pending);

      expect(await charges.list()).toEqual([paid]);
    });
  });
}
