import { describe, expect, it } from "vitest";
import { shopCurrency } from "./shop-currency";

describe("shopCurrency", () => {
  it("takes the shop's currency and defaults to pesos when the model leaves it out", () => {
    expect(shopCurrency.parse("wBRL")).toBe("wBRL");
    expect(shopCurrency.parse(undefined)).toBe("wARS");
  });

  it("rejects anything that is not one of the two countries' currencies", () => {
    expect(shopCurrency.safeParse("USD").success).toBe(false);
    expect(shopCurrency.safeParse("BRL").success).toBe(false);
  });
});
