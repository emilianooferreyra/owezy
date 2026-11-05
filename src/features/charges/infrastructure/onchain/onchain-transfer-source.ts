import type { TransferSource } from "../../application/ports";
import type { IncomingTransfer } from "../../domain/charge";
import { blockRanges, type TransferLog, toIncomingTransfer } from "./transfer-log";

/** Reads wARS and wBRL transfers to the business address from the chain. */
export interface TransferLogReader {
  /**
   * The newest block Celo has already backed with data on Ethereum (the `safe` head). Celo is an
   * OP Stack L2 with one-second blocks: until then, a block rests on the sequencer alone and can be
   * replaced, so a fixed count of confirmations on top of the latest block is only a few seconds.
   */
  safeBlock(): Promise<bigint>;
  /** Transfers to the business address in blocks [from, to], both inclusive. */
  transfersTo(from: bigint, to: bigint): Promise<readonly TransferLog[]>;
}

/** How far the scan got, and every transfer it found so far. */
export type ScanState = Readonly<{
  lastBlock?: bigint;
  transfers: readonly IncomingTransfer[];
}>;

export interface ScanStore {
  load(): Promise<ScanState>;
  save(state: ScanState): Promise<void>;
}

export class InMemoryScanStore implements ScanStore {
  #state: ScanState = { transfers: [] };

  async load(): Promise<ScanState> {
    return this.#state;
  }

  async save(state: ScanState): Promise<void> {
    this.#state = state;
  }
}

export type OnchainTransferSourceOptions = Readonly<{
  reader: TransferLogReader;
  store: ScanStore;
  /**
   * First block to scan. Without it, the first run starts at the confirmed head and only watches
   * from then on: the business wants payments for charges made with the app, not its history.
   */
  startBlock?: bigint;
  /** Maximum blocks per query. */
  chunkSize: bigint;
  /** Minimum time between chain reads; calls in between get the saved transfers. */
  minIntervalMs: number;
  now?: () => number;
}>;

/**
 * Transfers that reached the business address on-chain. Each call scans only the blocks after the
 * saved progress, up to the safe head, and saves after every chunk so a restart resumes there.
 */
export class OnchainTransferSource implements TransferSource {
  readonly #options: OnchainTransferSourceOptions;
  readonly #now: () => number;
  #lastRead: number | undefined;

  constructor(options: OnchainTransferSourceOptions) {
    this.#options = options;
    this.#now = options.now ?? Date.now;
  }

  async listIncoming(): Promise<readonly IncomingTransfer[]> {
    const { reader, store, startBlock, chunkSize, minIntervalMs } = this.#options;
    let state = await store.load();

    if (this.#lastRead !== undefined && this.#now() - this.#lastRead < minIntervalMs) {
      return state.transfers;
    }
    this.#lastRead = this.#now();

    const safeHead = await reader.safeBlock();
    const from = state.lastBlock === undefined ? startBlock : state.lastBlock + 1n;
    if (from === undefined) {
      await store.save({ ...state, lastBlock: safeHead });
      return state.transfers;
    }

    for (const [chunkStart, chunkEnd] of blockRanges(from, safeHead, chunkSize)) {
      const known = new Set(state.transfers.map((transfer) => transfer.id));
      const found = (await reader.transfersTo(chunkStart, chunkEnd))
        .map(toIncomingTransfer)
        .filter((transfer) => !known.has(transfer.id));
      state = { lastBlock: chunkEnd, transfers: [...state.transfers, ...found] };
      await store.save(state);
    }

    return state.transfers;
  }
}
