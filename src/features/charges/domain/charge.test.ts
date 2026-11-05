import { describe, expect, it } from "vitest";
import { type Currency, CurrencyMismatchError, money, UnknownCurrencyError } from "../../../core/money/money";
import { aCharge, aTransfer, UNIT, wars } from "../testing/fixtures";
import {
  applyPayment,
  distinctPendingAmount,
  InvalidChargeAmountError,
  InvalidChargeDetailsError,
  isChargeReference,
  matchTransfer,
  newestFirst,
  nextChargeReference,
} from "./charge";

describe("Charge", () => {
  it("starts as pending, with who pays, what for and when it was created", () => {
    const charge = aCharge();

    expect(charge).toMatchObject({
      id: "C-0001",
      customer: "Juan Pérez",
      description: "2 docenas de medialunas",
      createdAt: "2026-10-17T15:00:00.000Z",
      status: "pending",
    });
  });

  it("trims the customer and the description", () => {
    expect(aCharge({ customer: "  Juan Pérez ", description: " medialunas  " })).toMatchObject({
      customer: "Juan Pérez",
      description: "medialunas",
    });
  });

  it.each([
    ["customer", { customer: "  " }],
    ["description", { description: "" }],
  ])("rejects a blank %s", (_field, overrides) => {
    expect(() => aCharge(overrides)).toThrow(InvalidChargeDetailsError);
  });

  it("rejects a zero amount", () => {
    expect(() => aCharge({ amount: wars(0n) })).toThrow(InvalidChargeAmountError);
  });

  it("rejects a negative amount", () => {
    expect(() => aCharge({ amount: money(-1n, "wARS") })).toThrow(InvalidChargeAmountError);
  });

  it("accepts up to a thousand million whole units, and rejects a cent more", () => {
    expect(aCharge({ amount: wars(1_000_000_000n) }).amount).toEqual(wars(1_000_000_000n));
    expect(() => aCharge({ amount: money(wars(1_000_000_000n).amount + UNIT / 100n, "wARS") })).toThrow(
      InvalidChargeAmountError,
    );
  });

  it("rejects a currency the app does not know, instead of guessing its decimals", () => {
    expect(() => aCharge({ amount: money(1n, "wXYZ" as Currency) })).toThrow(UnknownCurrencyError);
  });

  it("rejects an amount too large for the database to hold, with a message the owner can act on", () => {
    expect(() => aCharge({ amount: money(10n ** 100n, "wARS") })).toThrow(/at most 1000000000/);
  });
});

describe("applyPayment", () => {
  it("marks the charge paid with the transfer that paid it and when it arrived", () => {
    const result = applyPayment(aCharge(), aTransfer({ id: "tx-1", receivedAt: "2026-10-17T15:05:00.000Z" }));

    expect(result).toMatchObject({ status: "paid", paidBy: "tx-1", paidAt: "2026-10-17T15:05:00.000Z" });
  });

  it("stays pending when a different amount arrives", () => {
    const result = applyPayment(aCharge(), aTransfer({ amount: wars(90_000n) }));

    expect(result.status).toBe("pending");
    expect(result.paidBy).toBeUndefined();
  });

  it("keeps the first payment when a paid charge receives another transfer", () => {
    const paid = applyPayment(aCharge(), aTransfer({ id: "tx-1" }));

    expect(applyPayment(paid, aTransfer({ id: "tx-2" })).paidBy).toBe("tx-1");
  });

  it("does not modify the original charge", () => {
    const charge = aCharge();

    applyPayment(charge, aTransfer());

    expect(charge.status).toBe("pending");
  });

  it("rejects a payment in another currency", () => {
    expect(() => applyPayment(aCharge(), aTransfer({ amount: money(85_000n * UNIT, "wBRL") }))).toThrow(
      CurrencyMismatchError,
    );
  });
});

describe("matchTransfer", () => {
  it("matches the only pending charge with the exact amount", () => {
    const charges = [aCharge({ id: "C-0001" }), aCharge({ id: "C-0002", amount: wars(90_000n) })];

    expect(matchTransfer(charges, aTransfer({ amount: wars(90_000n) }))).toEqual({
      kind: "matched",
      charge: charges[1],
    });
  });

  it("reports an unmatched transfer when no pending charge has that amount", () => {
    expect(matchTransfer([aCharge()], aTransfer({ amount: wars(1n) }))).toEqual({ kind: "unmatched" });
  });

  it("never guesses: two pending charges with the same amount make the transfer ambiguous", () => {
    const charges = [aCharge({ id: "C-0001" }), aCharge({ id: "C-0002" })];

    expect(matchTransfer(charges, aTransfer())).toEqual({ kind: "ambiguous", candidates: charges });
  });

  it("ignores charges that are already paid", () => {
    const paid = applyPayment(aCharge(), aTransfer({ id: "tx-0" }));

    expect(matchTransfer([paid], aTransfer({ id: "tx-1" }))).toEqual({ kind: "unmatched" });
  });

  it("never pays a charge created after the transfer arrived", () => {
    const charge = aCharge({ createdAt: "2026-10-18T10:00:00.000Z" });
    const earlierTransfer = aTransfer({ receivedAt: "2026-10-17T22:00:00.000Z" });

    expect(matchTransfer([charge], earlierTransfer)).toEqual({ kind: "unmatched" });
  });

  it("treats a transfer in another currency as unmatched instead of failing", () => {
    const transfer = aTransfer({ amount: money(85_000n * UNIT, "wBRL") });

    expect(matchTransfer([aCharge()], transfer)).toEqual({ kind: "unmatched" });
  });
});

describe("newestFirst", () => {
  it("puts the most recently created charge first", () => {
    const older = aCharge({ id: "C-0001", createdAt: "2026-10-17T15:00:00.000Z" });
    const newer = aCharge({ id: "C-0002", createdAt: "2026-10-18T09:00:00.000Z" });

    expect(newestFirst([older, newer])).toEqual([newer, older]);
  });

  it("breaks a tie in time by the reference number, not its text (C-10000 is newer than C-9999)", () => {
    const charges = [aCharge({ id: "C-9999" }), aCharge({ id: "C-10000" }), aCharge({ id: "C-0002" })];

    expect(newestFirst(charges).map((charge) => charge.id)).toEqual(["C-10000", "C-9999", "C-0002"]);
  });

  it("does not reorder the original list", () => {
    const charges = [aCharge({ id: "C-0001" }), aCharge({ id: "C-0002" })];

    newestFirst(charges);

    expect(charges.map((charge) => charge.id)).toEqual(["C-0001", "C-0002"]);
  });
});

describe("isChargeReference", () => {
  it.each(["C-0001", "C-10000"])("accepts %s", (id) => {
    expect(isChargeReference(id)).toBe(true);
  });

  it.each(["", "C-", "c-0001", "C-00a1", "order-123", " C-0001", "C-0001/../x"])("rejects %j", (id) => {
    expect(isChargeReference(id)).toBe(false);
  });
});

describe("nextChargeReference", () => {
  it("starts at C-0001", () => {
    expect(nextChargeReference([])).toBe("C-0001");
  });

  it("follows the highest existing reference, even when charges are out of order", () => {
    const charges = [aCharge({ id: "C-0007" }), aCharge({ id: "C-0002" })];

    expect(nextChargeReference(charges)).toBe("C-0008");
  });

  it("ignores ids that are not charge references", () => {
    expect(nextChargeReference([aCharge({ id: "order-123" })])).toBe("C-0001");
  });

  it("keeps counting past four digits", () => {
    expect(nextChargeReference([aCharge({ id: "C-9999" })])).toBe("C-10000");
  });
});

describe("distinctPendingAmount", () => {
  const CENT = UNIT / 100n;

  it("keeps the amount when no pending charge has it", () => {
    expect(distinctPendingAmount(wars(85_000n), [aCharge({ amount: wars(42_500n) })])).toEqual(wars(85_000n));
  });

  it("adds a cent when a pending charge already has the amount, so a transfer can only match one charge", () => {
    expect(distinctPendingAmount(wars(85_000n), [aCharge({ amount: wars(85_000n) })])).toEqual(
      money(85_000n * UNIT + CENT, "wARS"),
    );
  });

  it("keeps adding cents until the amount is free", () => {
    const pending = [
      aCharge({ id: "C-0001", amount: wars(85_000n) }),
      aCharge({ id: "C-0002", amount: money(85_000n * UNIT + CENT, "wARS") }),
    ];

    expect(distinctPendingAmount(wars(85_000n), pending)).toEqual(money(85_000n * UNIT + 2n * CENT, "wARS"));
  });

  it("ignores paid charges: their amount can be charged again as is", () => {
    const paid = applyPayment(aCharge({ amount: wars(85_000n) }), aTransfer({ amount: wars(85_000n) }));

    expect(distinctPendingAmount(wars(85_000n), [paid])).toEqual(wars(85_000n));
  });
});
