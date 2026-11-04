import type { Address, Hex } from "viem";
import { currencyOfToken } from "../../../../core/celo/tokens";
import { money } from "../../../../core/money/money";
import type { IncomingTransfer } from "../../domain/charge";

/** A decoded Transfer event of a known token (wARS, wBRL) to the business address, as the chain reader returns it. */
export type TransferLog = Readonly<{
  transactionHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  /** Seconds since the epoch. */
  blockTimestamp: bigint;
  /** The token contract that emitted the event: it decides the currency. */
  token: Address;
  to: Address;
  value: bigint;
}>;

export class UnknownTokenError extends Error {
  constructor(token: string) {
    super(`${token} is not a known token`);
    this.name = "UnknownTokenError";
  }
}

/**
 * One transaction can carry several transfers, so the log index is part of the id. The currency
 * comes from the token that moved: a wBRL payment must never match a wARS charge of the same amount.
 */
export function toIncomingTransfer(log: TransferLog): IncomingTransfer {
  const currency = currencyOfToken(log.token);
  if (!currency) {
    throw new UnknownTokenError(log.token);
  }
  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    amount: money(log.value, currency),
    receivedAt: new Date(Number(log.blockTimestamp) * 1000).toISOString(),
  };
}

/** Inclusive [from, to] chunks of at most `size` blocks: RPCs cap how many blocks one query spans. */
export function blockRanges(from: bigint, to: bigint, size: bigint): Array<[bigint, bigint]> {
  const ranges: Array<[bigint, bigint]> = [];
  for (let start = from; start <= to; start += size) {
    const end = start + size - 1n;
    ranges.push([start, end < to ? end : to]);
  }
  return ranges;
}
