import { describe, expect, it } from "vitest";
import { aCharge, aTransfer, wars } from "../testing/fixtures";
import { applyPayment } from "./charge";
import {
  chargeDescription,
  createLedgerEntry,
  InvalidLedgerEntryError,
  type LedgerEntry,
  nextEntryReference,
  resolveCustomer,
  sameCustomer,
  summarizeLedger,
  unbilledEntries,
} from "./ledger";

function anEntry(overrides: Partial<Parameters<typeof createLedgerEntry>[0]> = {}): LedgerEntry {
  return createLedgerEntry({
    id: "L-0001",
    customer: "Juan Pérez",
    description: "2 docenas de medialunas",
    amount: wars(30_000n),
    recordedAt: "2026-10-30T12:00:00.000Z",
    ...overrides,
  });
}

describe("createLedgerEntry", () => {
  it("records who took what, for how much and when, trimming the names", () => {
    expect(anEntry({ customer: "  Juan Pérez ", description: " torta " })).toEqual({
      id: "L-0001",
      customer: "Juan Pérez",
      description: "torta",
      amount: wars(30_000n),
      recordedAt: "2026-10-30T12:00:00.000Z",
    });
  });

  it.each([
    ["a zero amount", { amount: wars(0n) }, /amount/],
    ["no customer", { customer: "  " }, /customer/],
    ["no description", { description: "" }, /description/],
  ] as const)("refuses an entry with %s", (_, overrides, message) => {
    expect(() => anEntry(overrides)).toThrow(InvalidLedgerEntryError);
    expect(() => anEntry(overrides)).toThrow(message);
  });
});

describe("sameCustomer", () => {
  it("matches a name however the owner types it: case, accents and extra spaces", () => {
    expect(sameCustomer("Juan Pérez", "  juan   perez ")).toBe(true);
    expect(sameCustomer("Martina Gómez", "MARTINA GOMEZ")).toBe(true);
  });

  it("does not match a different customer, even one sharing a first name", () => {
    expect(sameCustomer("Juan Pérez", "Juan Gómez")).toBe(false);
    expect(sameCustomer("Juan Pérez", "Juan")).toBe(false);
  });
});

describe("resolveCustomer", () => {
  const ledger = [
    anEntry({ id: "L-0001", customer: "Juan Pérez" }),
    anEntry({ id: "L-0002", customer: "Martina Gómez" }),
    anEntry({ id: "L-0003", customer: "Juan Ruiz" }),
    anEntry({ id: "L-0004", customer: "juan perez" }),
  ];

  it("finds the customer by the full name however it is typed, as the ledger first wrote it", () => {
    expect(resolveCustomer(ledger, "JUAN PEREZ")).toEqual({ kind: "known", customer: "Juan Pérez" });
  });

  it("finds the customer by part of the name when only one customer has it", () => {
    expect(resolveCustomer(ledger, "martina")).toEqual({ kind: "known", customer: "Martina Gómez" });
    expect(resolveCustomer(ledger, "Gomez")).toEqual({ kind: "known", customer: "Martina Gómez" });
  });

  it("lists every customer the name could be when it fits more than one", () => {
    expect(resolveCustomer(ledger, "Juan")).toEqual({ kind: "ambiguous", candidates: ["Juan Pérez", "Juan Ruiz"] });
  });

  it("treats a name nobody in the ledger has as a new customer, even one sharing a first name", () => {
    expect(resolveCustomer(ledger, "Pedro")).toEqual({ kind: "new" });
    expect(resolveCustomer(ledger, "Martina López")).toEqual({ kind: "new" });
    expect(resolveCustomer(ledger, "Mar")).toEqual({ kind: "new" });
  });
});

describe("summarizeLedger", () => {
  const juanTortas = anEntry({ id: "L-0001", amount: wars(30_000n) });
  const juanPan = anEntry({ id: "L-0002", description: "pan", amount: wars(5_000n) });
  const martina = anEntry({ id: "L-0003", customer: "Martina Gómez", amount: wars(42_000n) });

  it("adds up what each customer owes, the one who owes most first", () => {
    const summary = summarizeLedger([juanTortas, juanPan, martina], []);

    expect(summary.map(({ customer, owed }) => [customer, owed])).toEqual([
      ["Martina Gómez", wars(42_000n)],
      ["Juan Pérez", wars(35_000n)],
    ]);
  });

  it("tells apart what was not charged yet, what has a pending charge, and what was paid", () => {
    const pending = aCharge({ id: "C-0001", amount: wars(30_000n) });
    const paid = applyPayment(aCharge({ id: "C-0002", amount: wars(42_000n) }), aTransfer({ amount: wars(42_000n) }));
    const entries = [{ ...juanTortas, chargeId: "C-0001" }, juanPan, { ...martina, chargeId: "C-0002" }];

    const summary = summarizeLedger(entries, [pending, paid]);

    const juan = summary.find(({ customer }) => customer === "Juan Pérez");
    expect(juan).toMatchObject({ owed: wars(35_000n), unbilled: wars(5_000n) });
    expect(juan?.entries.map(({ id, status }) => [id, status])).toEqual([
      ["L-0001", "charged"],
      ["L-0002", "unbilled"],
    ]);
    const martinaBalance = summary.find(({ customer }) => customer === "Martina Gómez");
    expect(martinaBalance).toMatchObject({ owed: wars(0n), unbilled: wars(0n) });
    expect(martinaBalance?.entries[0]?.status).toBe("paid");
  });

  it("groups one customer's entries even when the name was typed differently", () => {
    const summary = summarizeLedger([juanTortas, { ...juanPan, customer: "juan perez" }], []);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ customer: "Juan Pérez", owed: wars(35_000n) });
  });

  it("can look at a single customer", () => {
    const summary = summarizeLedger([juanTortas, martina], [], { customer: "martina gomez" });

    expect(summary.map(({ customer }) => customer)).toEqual(["Martina Gómez"]);
  });
});

describe("unbilledEntries", () => {
  it("returns only the customer's entries that no charge includes yet", () => {
    const charged = { ...anEntry({ id: "L-0001" }), chargeId: "C-0001" };
    const open = anEntry({ id: "L-0002" });
    const other = anEntry({ id: "L-0003", customer: "Martina Gómez" });

    expect(unbilledEntries([charged, open, other], "JUAN PEREZ")).toEqual([open]);
  });
});

describe("chargeDescription", () => {
  it("lists what the customer took", () => {
    expect(chargeDescription([anEntry({ description: "torta" }), anEntry({ description: "pan" })])).toBe(
      "torta + pan",
    );
  });

  it("summarizes when the list does not fit in a charge description", () => {
    const entries = Array.from({ length: 12 }, (_, index) => anEntry({ description: `pedido número ${index}` }));

    expect(chargeDescription(entries)).toBe("12 compras de la libreta");
  });
});

describe("nextEntryReference", () => {
  it("numbers entries one past the highest, like charges", () => {
    expect(nextEntryReference([])).toBe("L-0001");
    expect(nextEntryReference([anEntry({ id: "L-0001" }), anEntry({ id: "L-0009" })])).toBe("L-0010");
  });
});
