import { describe, expect, it } from "vitest";
import {
  InMemoryScanStore,
  OnchainTransferSource,
  type TransferLogReader,
} from "./onchain-transfer-source";
import { TOKENS } from "../../../../core/celo/tokens";
import type { TransferLog } from "./transfer-log";

const BUSINESS = "0x000000000000000000000000000000000000dEaD";

function transferAt(blockNumber: bigint, logIndex = 0): TransferLog {
  return {
    transactionHash: `0x${blockNumber.toString(16).padStart(64, "0")}`,
    logIndex,
    blockNumber,
    blockTimestamp: 1_790_000_000n + blockNumber,
    token: TOKENS.wARS,
    to: BUSINESS,
    value: 85_000n * 10n ** 18n,
  };
}

/** A chain double: logs by block, a movable safe head, and a record of every query. */
class FakeChain implements TransferLogReader {
  head = 1_000n;
  logs: TransferLog[] = [];
  queries: Array<[bigint, bigint]> = [];

  async safeBlock() {
    return this.head;
  }

  async transfersTo(from: bigint, to: bigint) {
    this.queries.push([from, to]);
    return this.logs.filter((log) => log.blockNumber >= from && log.blockNumber <= to);
  }
}

function setup(options: { minIntervalMs?: number } = {}) {
  const chain = new FakeChain();
  const store = new InMemoryScanStore();
  let clock = 0;
  const source = (overrides: { store?: InMemoryScanStore } = {}) =>
    new OnchainTransferSource({
      reader: chain,
      store: overrides.store ?? store,
      startBlock: 900n,
      chunkSize: 50n,
      minIntervalMs: options.minIntervalMs ?? 0,
      now: () => clock,
    });
  return { chain, store, source, tick: (ms: number) => (clock += ms) };
}

describe("OnchainTransferSource", () => {
  it("reads transfers from the start block up to the safe head", async () => {
    const { chain, source } = setup();
    chain.logs = [transferAt(950n)];

    const transfers = await source().listIncoming();

    expect(transfers.map((transfer) => transfer.id)).toEqual([`${transferAt(950n).transactionHash}:0`]);
    expect(chain.queries.at(0)?.[0]).toBe(900n);
    expect(chain.queries.at(-1)?.[1]).toBe(1_000n);
  });

  it("splits the scan into chunks the RPC accepts", async () => {
    const { chain, source } = setup();

    await source().listIncoming();

    expect(chain.queries).toEqual([
      [900n, 949n],
      [950n, 999n],
      [1_000n, 1_000n],
    ]);
  });

  it("does not count a transfer until its block is safe (backed by data on Ethereum)", async () => {
    const { chain, source } = setup();
    chain.logs = [transferAt(1_001n)];

    expect(await source().listIncoming()).toEqual([]);

    chain.head = 1_001n;
    expect(await source().listIncoming()).toHaveLength(1);
  });

  it("only reads new blocks on the next call, and keeps the transfers it already found", async () => {
    const { chain, source } = setup();
    chain.logs = [transferAt(950n)];
    const reader = source();
    await reader.listIncoming();
    chain.queries = [];
    chain.head = 1_010n;
    chain.logs.push(transferAt(1_005n));

    const transfers = await reader.listIncoming();

    expect(chain.queries).toEqual([[1_001n, 1_010n]]);
    expect(transfers).toHaveLength(2);
  });

  it("continues from the saved progress after a restart", async () => {
    const { chain, store, source } = setup();
    await source({ store }).listIncoming();
    chain.queries = [];

    await source({ store }).listIncoming();

    expect(chain.queries).toEqual([]);
  });

  it("never lists the same transfer twice", async () => {
    const { chain, store, source } = setup();
    chain.logs = [transferAt(950n)];
    await source({ store }).listIncoming();
    await store.save({ ...(await store.load()), lastBlock: 900n });

    const transfers = await source({ store }).listIncoming();

    expect(transfers).toHaveLength(1);
  });

  it("without a start block, watches only from now on instead of scanning history", async () => {
    const chain = new FakeChain();
    chain.logs = [transferAt(950n)];
    const source = new OnchainTransferSource({
      reader: chain,
      store: new InMemoryScanStore(),
      chunkSize: 50n,
      minIntervalMs: 0,
    });

    expect(await source.listIncoming()).toEqual([]);
    expect(chain.queries).toEqual([]);

    chain.head = 1_005n;
    chain.logs.push(transferAt(1_003n));
    expect((await source.listIncoming()).map((transfer) => transfer.id)).toEqual([
      `${transferAt(1_003n).transactionHash}:0`,
    ]);
  });

  it("does not hit the chain again within the minimum interval", async () => {
    const { chain, source, tick } = setup({ minIntervalMs: 5_000 });
    const reader = source();
    await reader.listIncoming();
    chain.queries = [];
    chain.head = 1_010n; // new blocks exist, so only the interval can explain not reading them

    await reader.listIncoming();
    expect(chain.queries).toEqual([]);

    tick(5_000);
    await reader.listIncoming();
    expect(chain.queries).toHaveLength(1);
  });
});
