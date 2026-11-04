import type { Address } from "viem";
import type { Currency } from "../money/money";

/**
 * Ripio's local stablecoins on Celo mainnet, one per country. Both verified on-chain through
 * forno.celo.org: wARS on 2026-10-18, wBRL on 2026-11-04 (symbol() = "wBRL", decimals() = 18).
 */
export const TOKENS: Record<Currency, Address> = {
  wARS: "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d",
  wBRL: "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0",
};

/** The currency a token address stands for, or undefined for a token the app does not know. */
export function currencyOfToken(address: string): Currency | undefined {
  const wanted = address.toLowerCase();
  return (Object.keys(TOKENS) as Currency[]).find((currency) => TOKENS[currency].toLowerCase() === wanted);
}
