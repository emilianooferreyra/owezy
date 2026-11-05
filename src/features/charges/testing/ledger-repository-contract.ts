// Test-only: what every LedgerRepository must do, run against each adapter.
import { beforeEach, describe, expect, it } from "vitest";
import { LedgerConflictError, type LedgerRepository } from "../application/ports";
import { createLedgerEntry, type LedgerEntry } from "../domain/ledger";
import { UNIT, wars } from "./fixtures";

function anEntry(id: string, overrides: Partial<Parameters<typeof createLedgerEntry>[0]> = {}): LedgerEntry {
  return createLedgerEntry({
    id,
    customer: "Juan Pérez",
    description: "torta",
    amount: wars(30_000n),
    recordedAt: "2026-10-30T12:00:00.000Z",
    ...overrides,
  });
}

export function ledgerRepositoryContract(name: string, open: () => Promise<LedgerRepository>) {
  describe(`${name} (LedgerRepository contract)`, () => {
    let ledger: LedgerRepository;

    beforeEach(async () => {
      ledger = await open();
    });

    it("starts empty", async () => {
      expect(await ledger.list()).toEqual([]);
    });

    it("keeps every field and the order entries were written in, with amounts too large for 64 bits", async () => {
      const first = anEntry("L-0002", { amount: { amount: 42_500n * UNIT + 1n, currency: "wARS" }, idempotencyKey: "k" });
      const second = anEntry("L-0001", { customer: "Martina Gómez" });

      await ledger.add(first);
      await ledger.add(second);

      expect(await ledger.list()).toStrictEqual([first, second]);
    });

    it("refuses a second entry with a reference already taken", async () => {
      await ledger.add(anEntry("L-0001"));

      await expect(ledger.add(anEntry("L-0001", { description: "otra cosa" }))).rejects.toBeInstanceOf(
        LedgerConflictError,
      );
    });

    it("links entries to a charge, and never moves an entry already in another charge", async () => {
      await ledger.add(anEntry("L-0001"));
      await ledger.add(anEntry("L-0002"));
      await ledger.add(anEntry("L-0003"));
      await ledger.assignCharge(["L-0001"], "C-0001");

      await ledger.assignCharge(["L-0001", "L-0002"], "C-0002");

      expect((await ledger.list()).map(({ id, chargeId }) => [id, chargeId])).toEqual([
        ["L-0001", "C-0001"],
        ["L-0002", "C-0002"],
        ["L-0003", undefined],
      ]);
    });

    it("says which of the entries the charge includes, so a request can tell another one charged some first", async () => {
      await ledger.add(anEntry("L-0001"));
      await ledger.add(anEntry("L-0002"));
      await ledger.assignCharge(["L-0001"], "C-0001");

      expect(await ledger.assignCharge(["L-0001", "L-0002"], "C-0002")).toEqual(["L-0002"]);
      // Linking again to the same charge, as a retried request does, still counts the entries.
      expect(await ledger.assignCharge(["L-0002"], "C-0002")).toEqual(["L-0002"]);
      expect(await ledger.assignCharge([], "C-0002")).toEqual([]);
    });

    it("unlinks every entry of one charge, and only of that charge", async () => {
      await ledger.add(anEntry("L-0001"));
      await ledger.add(anEntry("L-0002"));
      await ledger.assignCharge(["L-0001"], "C-0001");
      await ledger.assignCharge(["L-0002"], "C-0002");

      await ledger.releaseCharge("C-0002");

      expect((await ledger.list()).map(({ id, chargeId }) => [id, chargeId])).toEqual([
        ["L-0001", "C-0001"],
        ["L-0002", undefined],
      ]);
    });
  });
}
