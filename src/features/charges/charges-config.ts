import { join } from "node:path";
import { type ChargesFeature, createChargesFeature } from "./charges-feature";
import { FileScanStore } from "./infrastructure/onchain/file-scan-store";
import { OnchainTransferSource } from "./infrastructure/onchain/onchain-transfer-source";
import { viemTransferLogReader } from "./infrastructure/onchain/viem-transfer-log-reader";
import { FileActivityLog } from "./infrastructure/file-activity-log";
import { FileLedgerRepository } from "./infrastructure/file-ledger-repository";
import { FileChargeRepository } from "./infrastructure/file-charge-repository";
import { FileSimulatedTransferSource } from "./infrastructure/file-simulated-transfer-source";
import { connectDatabase, type Database } from "../../core/storage/database";
import { PostgresActivityLog } from "./infrastructure/postgres/postgres-activity-log";
import { PostgresChargeRepository } from "./infrastructure/postgres/postgres-charge-repository";
import { PostgresLedgerRepository } from "./infrastructure/postgres/postgres-ledger-repository";
import { PostgresScanStore } from "./infrastructure/postgres/postgres-scan-store";
import { PostgresSimulatedTransferSource } from "./infrastructure/postgres/postgres-simulated-transfer-source";
import type { ActivityLog, ChargeRepository, LedgerRepository, PaymentSimulator } from "./application/ports";
import type { ScanStore } from "./infrastructure/onchain/onchain-transfer-source";
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

export class MissingDatabaseError extends Error {
  constructor() {
    super("DATABASE_URL is required on Vercel: there is no persistent disk, so files would vanish between requests");
    this.name = "MissingDatabaseError";
  }
}

/** Where charges live: Postgres when `databaseUrl` is set, JSON files in `dataDir` otherwise. */
type Storage = Readonly<{ dataDir: string; databaseUrl?: string }>;

export type ChargesConfig =
  | (Storage & Readonly<{ mode: "simulated"; appUrl: string }>)
  | (Storage & Readonly<{ mode: "ripio"; recipient: Address; startBlock?: bigint }>);

type Env = Readonly<Record<string, string | undefined>>;

/** The payments mode as written. Simulated is the default, so a demo never touches real money. */
function paymentsMode(env: Env): string {
  return env.PAYMENTS_MODE || "simulated";
}

/** Where payment links point: APP_URL, else the Vercel production domain, else the local app. */
function appUrlFrom(env: Env): string {
  if (env.APP_URL) {
    return env.APP_URL;
  }
  return env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : DEFAULT_APP_URL;
}

/** Reads the charges configuration. Simulated is the default, so a demo never touches real money. */
export function chargesConfigFromEnv(env: Env, cwd: string): ChargesConfig {
  const dataDir = env.DATA_DIR || join(cwd, ".data");
  const databaseUrl = env.DATABASE_URL || undefined;
  if (env.VERCEL && !databaseUrl) {
    throw new MissingDatabaseError();
  }
  const storage: Storage = databaseUrl === undefined ? { dataDir } : { dataDir, databaseUrl };
  const mode = paymentsMode(env);

  if (mode === "simulated") {
    return { mode, appUrl: appUrlFrom(env), ...storage };
  }
  if (mode === "ripio") {
    const recipient = env.BUSINESS_ADDRESS;
    if (!isAddress(recipient)) {
      throw new InvalidBusinessAddressError(recipient);
    }
    const startBlock = env.START_BLOCK;
    if (startBlock === undefined || startBlock === "") {
      return { mode, recipient, ...storage };
    }
    if (!BLOCK_PATTERN.test(startBlock)) {
      throw new InvalidStartBlockError(startBlock);
    }
    return { mode, recipient, ...storage, startBlock: BigInt(startBlock) };
  }
  throw new InvalidPaymentsModeError(mode);
}

type Stores = Readonly<{
  charges: ChargeRepository;
  activity: ActivityLog;
  ledger: LedgerRepository;
  simulator: () => PaymentSimulator;
  scan: (recipient: Address) => ScanStore;
}>;

function postgresStores(db: Database): Stores {
  return {
    charges: new PostgresChargeRepository(db),
    activity: new PostgresActivityLog(db),
    ledger: new PostgresLedgerRepository(db),
    simulator: () => new PostgresSimulatedTransferSource(db),
    scan: (recipient) => new PostgresScanStore(db, recipient),
  };
}

function fileStores(dataDir: string): Stores {
  return {
    charges: new FileChargeRepository(join(dataDir, "charges.json")),
    activity: new FileActivityLog(join(dataDir, "activity.json")),
    ledger: new FileLedgerRepository(join(dataDir, "ledger.json")),
    simulator: () => new FileSimulatedTransferSource(join(dataDir, "simulated-transfers.json")),
    scan: () => new FileScanStore(join(dataDir, "onchain-scan.json")),
  };
}

/**
 * Builds the feature, shared by the agent and the web app (separate processes): Postgres when the
 * config has a database URL (required on Vercel), JSON files for local demos otherwise.
 */
export function chargesFeatureFromConfig(
  config: ChargesConfig,
  options: { connect?: (url: string) => Database } = {},
): ChargesFeature {
  const connect = options.connect ?? connectDatabase;
  const { charges, activity, ledger, simulator, scan } =
    config.databaseUrl === undefined ? fileStores(config.dataDir) : postgresStores(connect(config.databaseUrl));

  if (config.mode === "simulated") {
    return createChargesFeature({
      charges,
      activity,
      ledger,
      buildPaymentLink: simulatedCheckoutLinkBuilder({ appUrl: config.appUrl }),
      simulator: simulator(),
    });
  }
  return createChargesFeature({
    charges,
    activity,
    ledger,
    buildPaymentLink: ripioRampLinkBuilder({ recipient: config.recipient }),
    transfers: new OnchainTransferSource({
      reader: viemTransferLogReader({ recipient: config.recipient }),
      store: scan(config.recipient),
      ...(config.startBlock === undefined ? {} : { startBlock: config.startBlock }),
      confirmations: CONFIRMATIONS,
      chunkSize: CHUNK_SIZE,
      minIntervalMs: MIN_READ_INTERVAL_MS,
    }),
  });
}
