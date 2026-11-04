import { type Currency, formatMoney, money, toDecimalString } from "../../core/money/money";

/** "0x1a2B3c…9fC3" style: the start and the end are what people compare. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** A token balance (18-decimal base units) in its country's money, with at most two decimals, truncated. */
export function formatTokenBalance(raw: bigint, currency: Currency): string {
  return formatMoney(toDecimalString(money(raw, currency), { maxFractionDigits: 2 }), currency);
}

/** A wARS balance as pesos. */
export function formatWarsBalance(raw: bigint): string {
  return formatTokenBalance(raw, "wARS");
}
