import { custom } from "viem";
import { describe, expect, it } from "vitest";
import { viemTransferLogReader } from "./viem-transfer-log-reader";

const BUSINESS = "0x000000000000000000000000000000000000dEaD";

/** An RPC double that records every request and answers block lookups. */
function fakeRpc() {
  const requests: Array<{ method: string; params: unknown }> = [];
  const transport = custom({
    async request({ method, params }: { method: string; params: unknown }) {
      requests.push({ method, params });
      if (method === "eth_getBlockByNumber") {
        return { number: "0x3e8", hash: `0x${"ab".repeat(32)}`, timestamp: "0x1", transactions: [] };
      }
      if (method === "eth_chainId") return "0xa4ec";
      throw new Error(`unexpected ${method}`);
    },
  });
  return { transport, requests };
}

describe("viemTransferLogReader", () => {
  it("asks for the safe head, which Celo has already backed with data on Ethereum, not the latest block", async () => {
    const { transport, requests } = fakeRpc();
    const reader = viemTransferLogReader({ recipient: BUSINESS, transport });

    expect(await reader.safeBlock()).toBe(1_000n);
    expect(requests).toEqual([{ method: "eth_getBlockByNumber", params: ["safe", false] }]);
  });
});
