import { describe, expect, it } from "vitest";
import {
  CurrencyMismatchError,
  equals,
  formatArs,
  formatMoney,
  fromDecimalString,
  InvalidAmountError,
  money,
  toDecimalString,
} from "./money";

const UNIT = 10n ** 18n;

describe("Money", () => {
  it("keeps the amount in base units and its currency", () => {
    const value = money(85_000n, "wARS");

    expect(value.amount).toBe(85_000n);
    expect(value.currency).toBe("wARS");
  });

  it("is equal to another value with the same amount and currency", () => {
    expect(equals(money(85_000n, "wARS"), money(85_000n, "wARS"))).toBe(true);
  });

  it("is not equal to another value with a different amount", () => {
    expect(equals(money(85_000n, "wARS"), money(90_000n, "wARS"))).toBe(false);
  });

  it("refuses to compare different currencies", () => {
    expect(() => equals(money(85_000n, "wARS"), money(85_000n, "wBRL"))).toThrow(
      CurrencyMismatchError,
    );
  });

  describe("toDecimalString", () => {
    it("formats a whole amount without decimals", () => {
      expect(toDecimalString(money(85_000n * UNIT, "wARS"))).toBe("85000");
    });

    it("keeps the fractional part without trailing zeros", () => {
      expect(toDecimalString(money(85_000n * UNIT + UNIT / 2n, "wARS"))).toBe("85000.5");
    });

    it("formats amounts smaller than one unit", () => {
      expect(toDecimalString(money(1n, "wARS"))).toBe("0.000000000000000001");
    });

    it("cuts to a maximum of decimals by truncating, never rounding money up", () => {
      const value = money(85_000n * UNIT + (UNIT * 129n) / 1000n, "wARS"); // 85000.129

      expect(toDecimalString(value, { maxFractionDigits: 2 })).toBe("85000.12");
    });

    it("drops the fraction entirely when the cut leaves only zeros", () => {
      expect(toDecimalString(money(5n * UNIT + 1n, "wARS"), { maxFractionDigits: 2 })).toBe("5");
    });
  });

  describe("formatMoney", () => {
    it("writes pesos the Argentine way", () => {
      expect(formatMoney("85000.5", "wARS")).toBe("$85.000,50");
    });

    it("writes reais the Brazilian way, with R$ and the same separators", () => {
      expect(formatMoney("850", "wBRL")).toBe("R$ 850");
      expect(formatMoney("1250000.75", "wBRL")).toBe("R$ 1.250.000,75");
    });
  });

  describe("formatArs", () => {
    it("groups thousands with dots", () => {
      expect(formatArs("85000")).toBe("$85.000");
    });

    it("formats millions", () => {
      expect(formatArs("1250000")).toBe("$1.250.000");
    });

    it("leaves small amounts without separators", () => {
      expect(formatArs("500")).toBe("$500");
    });

    it("uses a comma for decimals and shows cents with two digits", () => {
      expect(formatArs("85000.5")).toBe("$85.000,50");
    });

    it("keeps every decimal the amount has, without rounding money", () => {
      expect(formatArs("0.125")).toBe("$0,125");
    });
  });

  describe("fromDecimalString", () => {
    it("parses a whole amount into base units", () => {
      expect(fromDecimalString("85000", "wARS")).toEqual(money(85_000n * UNIT, "wARS"));
    });

    it("parses a fractional amount into base units", () => {
      expect(fromDecimalString("85000.5", "wARS")).toEqual(
        money(85_000n * UNIT + UNIT / 2n, "wARS"),
      );
    });

    it("parses the smallest amount the token supports", () => {
      expect(fromDecimalString("0.000000000000000001", "wARS")).toEqual(money(1n, "wARS"));
    });

    it.each(["", "abc", "-5", "1,5", "1.2.3", ".5", "5.", "1e3", " 5"])(
      "rejects %j as an amount",
      (value) => {
        expect(() => fromDecimalString(value, "wARS")).toThrow(InvalidAmountError);
      },
    );

    it("rejects more decimals than the token supports", () => {
      expect(() => fromDecimalString("0.0000000000000000001", "wARS")).toThrow(
        InvalidAmountError,
      );
    });
  });
});
