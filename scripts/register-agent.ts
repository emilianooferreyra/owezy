// Registers the agent's ERC-8004 identity from the agent wallet, then checks on-chain that the
// transaction carries the attribution tag. Celo Sepolia unless CELO_NETWORK=mainnet.
//
// Run: node --env-file=.env scripts/register-agent.ts
import { verifyTx } from "@celo/attribution-tags";
import { createPublicClient, http } from "viem";
import { registerAgent } from "../src/core/celo/agent-identity.ts";
import { agentWallet, agentWalletConfigFromEnv, assertCanPayGas, celoChain } from "../src/core/celo/agent-wallet.ts";
import { ATTRIBUTION_CODES } from "../src/core/celo/attribution.ts";

// HTTPS, so one transaction is enough; works before the app is deployed. Override with AGENT_URI.
const DEFAULT_AGENT_URI =
  "https://raw.githubusercontent.com/emilianooferreyra/owezy/main/public/agent.json";

const config = agentWalletConfigFromEnv(process.env);
const chain = celoChain(config.network);
const wallet = agentWallet(config);
const publicClient = createPublicClient({ chain, transport: http() });
const agentURI = process.env.AGENT_URI || DEFAULT_AGENT_URI;

console.log(`Registering ${wallet.account.address} on ${chain.name} with ${agentURI}`);

await assertCanPayGas({
  address: wallet.account.address,
  network: config.network,
  getBalance: (args) => publicClient.getBalance(args),
});

const { agentId, hash } = await registerAgent({
  write: (request) => wallet.writeContract(request),
  waitForReceipt: ({ hash }) => publicClient.waitForTransactionReceipt({ hash }),
  network: config.network,
  agentURI,
});

console.log(`Agent id: ${agentId}`);
console.log(`Transaction: ${chain.blockExplorers.default.url}/tx/${hash}`);

const tag = await verifyTx({ client: publicClient, hash });
if (tag?.codes.includes(ATTRIBUTION_CODES[0] ?? "")) {
  console.log(`Attribution tag on-chain: ${tag.codes.join(", ")}`);
} else {
  console.error("The transaction does NOT carry the enrollment attribution code. Do not send more until it does.");
  process.exitCode = 1;
}
