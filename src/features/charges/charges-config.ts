import { join } from "node:path";
import { type ChargesFeature, createChargesFeature } from "./charges-feature";
import { FileScanStore } from "./infrastructure/onchain/file-scan-store";
import { OnchainTransferSource } from "./infrastructure/onchain/onchain-transfer-source";
import { viemTransferLogReader } from "./infrastructure/onchain/viem-transfer-log-reader";
import { FileActivityLog } from "./infrastructure/file-activity-log";
import { FileChargeRepository } from "./infrastructure/file-charge-repository";
import { FileSimulatedTransferSource } from "./infrastructure/file-simulated-transfer-source";
import { ripioRampLinkBuilder } from "./infrastructure/ripio-ramp-link";
import { simulatedCheckoutLinkBuilder } from "./infrastructure/simulated-checkout-link";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BLOCK_PATTERN = /^\d+$/;

// On-chain reading: blocks to wait before trusting a transfer, blocks per RPC query (forno accepts
// 5000), and the minimum time between chain reads when the charge cards poll.
const CONFIRMATIONS = 3n;
const CHUNK_SIZE = 5_000n;
const MIN_READ_INTERVAL_MS = 10_000;

type Address = `0x${string}`;

function isAddress(value: string | undefined): value is Address {
  return value !== undefined && ADDRESS_PATTERN.test(value);
}
const DEFAULT_APP_URL = "http://localhost:3000";

export class InvalidBusinessAddressError extends Error {
  constructor(address: string | undefined) {
    super(
      `"${address ?? ""}" is not a valid BUSINESS_ADDRESS (expected 0x followed by 40 hex characters)`,
    );
    this.name = "InvalidBusinessAddressError";
  }
}

export class InvalidPaymentsModeError extends Error {
  constructor(mode: string) {
    super(`PAYMENTS_MODE must be "simulated" or "ripio", got "${mode}"`);
    this.name = "InvalidPaymentsModeError";
  }
}

export class InvalidStartBlockError extends Error {
  constructor(value: string) {
    super(`START_BLOCK must be a block number, got "${value}"`);
    this.name = "InvalidStartBlockError";
  }
}

export type ChargesConfig =
  | Readonly<{ mode: "simulated"; appUrl: string; dataDir: string }>
  | Readonly<{ mode: "ripio"; recipient: Address; dataDir: string; startBlock?: bigint }>;

type Env = Readonly<Record<string, string | undefined>>;

/** The payments mode as written. Simulated is the default, so a demo never touches real money. */
function paymentsMode(env: Env): string {
  return env.PAYMENTS_MODE || "simulated";
}

/** Reads the charges configuration. Simulated is the default, so a demo never touches real money. */
export function chargesConfigFromEnv(env: Env, cwd: string): ChargesConfig {
  const dataDir = env.DATA_DIR || join(cwd, ".data");
  const mode = paymentsMode(env);

  if (mode === "simulated") {
    return { mode, appUrl: env.APP_URL || DEFAULT_APP_URL, dataDir };
  }
  if (mode === "ripio") {
    const recipient = env.BUSINESS_ADDRESS;
    if (!isAddress(recipient)) {
      throw new InvalidBusinessAddressError(recipient);
    }
    const startBlock = env.START_BLOCK;
    if (startBlock === undefined || startBlock === "") {
      return { mode, recipient, dataDir };
    }
    if (!BLOCK_PATTERN.test(startBlock)) {
      throw new InvalidStartBlockError(startBlock);
    }
    return { mode, recipient, dataDir, startBlock: BigInt(startBlock) };
  }
  throw new InvalidPaymentsModeError(mode);
}

/** Builds the feature with file storage, shared by the agent and the web app (separate processes). */
export function chargesFeatureFromConfig(config: ChargesConfig): ChargesFeature {
  const charges = new FileChargeRepository(join(config.dataDir, "charges.json"));
  const activity = new FileActivityLog(join(config.dataDir, "activity.json"));

  if (config.mode === "simulated") {
    return createChargesFeature({
      charges,
      activity,
      buildPaymentLink: simulatedCheckoutLinkBuilder({ appUrl: config.appUrl }),
      simulator: new FileSimulatedTransferSource(join(config.dataDir, "simulated-transfers.json")),
    });
  }
  return createChargesFeature({
    charges,
    activity,
    buildPaymentLink: ripioRampLinkBuilder({ recipient: config.recipient }),
    transfers: new OnchainTransferSource({
      reader: viemTransferLogReader({ recipient: config.recipient }),
      store: new FileScanStore(join(config.dataDir, "onchain-scan.json")),
      ...(config.startBlock === undefined ? {} : { startBlock: config.startBlock }),
      confirmations: CONFIRMATIONS,
      chunkSize: CHUNK_SIZE,
      minIntervalMs: MIN_READ_INTERVAL_MS,
    }),
  });
}
