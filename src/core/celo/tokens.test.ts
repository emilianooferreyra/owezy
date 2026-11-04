import { describe, expect, it } from "vitest";
import { currencyOfToken, TOKENS } from "./tokens";

describe("tokens", () => {
  it("knows Ripio's wARS and wBRL on Celo mainnet, verified on-chain", () => {
    expect(TOKENS.wARS).toBe("0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d");
    expect(TOKENS.wBRL).toBe("0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0");
  });

  it("tells which currency a token address is, whatever its letter case", () => {
    expect(currencyOfToken("0xD76F5FAF6888E24D9F04BF92A0C8B921FE4390E0")).toBe("wBRL");
    expect(currencyOfToken("0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d")).toBe("wARS");
    expect(currencyOfToken("0x000000000000000000000000000000000000dEaD")).toBeUndefined();
  });
});
