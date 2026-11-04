import { describe, expect, it } from "vitest";
import { formatTokenBalance, formatWarsBalance, shortAddress } from "./wallet-display";

const UNIT = 10n ** 18n;

describe("shortAddress", () => {
  it("keeps the start and the end of an address so people can recognise it", () => {
    expect(shortAddress("0x1a2B3c4D5e6F708192a3B4c5D6e7F8091a2B9fC3")).toBe("0x1a2B…9fC3");
  });
});

describe("formatWarsBalance", () => {
  it("shows a wARS balance as pesos", () => {
    expect(formatWarsBalance(85_000n * UNIT)).toBe("$85.000");
  });

  it("shows at most two decimals, cutting the rest instead of rounding up", () => {
    expect(formatWarsBalance(1_234n * UNIT + (UNIT * 5679n) / 10000n)).toBe("$1.234,56");
  });

  it("shows an empty wallet as zero", () => {
    expect(formatWarsBalance(0n)).toBe("$0");
  });
});

describe("formatTokenBalance", () => {
  it("shows a wBRL balance as reais, cutting past two decimals", () => {
    expect(formatTokenBalance(1_234n * UNIT + (UNIT * 5679n) / 10000n, "wBRL")).toBe("R$ 1.234,56");
  });

  it("shows a wARS balance as pesos", () => {
    expect(formatTokenBalance(85_000n * UNIT, "wARS")).toBe("$85.000");
  });
});
