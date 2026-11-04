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

/** EIP-1193 -32002: the wallet already has a request from this site waiting for an answer. */
const REQUEST_PENDING = -32002;

/**
 * Whether a connection failed because MetaMask (or another browser wallet) still holds an earlier
 * request from this site: it refuses new ones until the person answers that one in the extension.
 * wagmi and viem wrap the wallet's error, so the code is looked for along the `cause` chain.
 */
export function isPendingWalletRequest(error: unknown): boolean {
  for (let current = error, depth = 0; current && typeof current === "object" && depth < 10; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (code === REQUEST_PENDING) return true;
    current = cause;
  }
  return false;
}
