import { type Address, createPublicClient, http, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import { TOKENS } from "../../../../core/celo/tokens";
import type { TransferLogReader } from "./onchain-transfer-source";
import type { TransferLog } from "./transfer-log";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/**
 * Reads Transfer events of every known token (wARS, wBRL) to the business address through a Celo
 * RPC (forno by default). One query covers all tokens, so the scan cursor stays one per address.
 * Read-only: no wallet, no keys. Some RPCs omit `blockTimestamp` on logs; then the block is fetched.
 */
export function viemTransferLogReader(config: { recipient: Address; rpcUrl?: string }): TransferLogReader {
  const client = createPublicClient({ chain: celo, transport: http(config.rpcUrl) });

  async function timestampOf(blockNumber: bigint, fromLog: bigint | null | undefined): Promise<bigint> {
    return fromLog ?? (await client.getBlock({ blockNumber })).timestamp;
  }

  return {
    latestBlock: () => client.getBlockNumber(),

    async transfersTo(from, to) {
      const logs = await client.getLogs({
        address: Object.values(TOKENS),
        event: TRANSFER,
        args: { to: config.recipient },
        fromBlock: from,
        toBlock: to,
        strict: true,
      });

      return Promise.all(
        logs.map(
          async (log): Promise<TransferLog> => ({
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            blockNumber: log.blockNumber,
            blockTimestamp: await timestampOf(log.blockNumber, log.blockTimestamp),
            token: log.address,
            to: log.args.to,
            value: log.args.value,
          }),
        ),
      );
    },
  };
}
