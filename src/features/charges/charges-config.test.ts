import { describe, expect, it } from "vitest";
import { PGLITE_STARTUP_MS, testDatabase } from "./infrastructure/postgres/test-database";
import { PostgresChargeRepository } from "./infrastructure/postgres/postgres-charge-repository";
import { PostgresLedgerRepository } from "./infrastructure/postgres/postgres-ledger-repository";
import {
  chargesConfigFromEnv,
  chargesFeatureFromConfig,
  InvalidBusinessAddressError,
  InvalidPaymentsModeError,
  InvalidStartBlockError,
  MissingDatabaseError,
} from "./charges-config";

const CWD = "/project";
const ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("chargesConfigFromEnv", () => {
  it("defaults to simulated payments on the local app, so no demo ever touches real money", () => {
    expect(chargesConfigFromEnv({}, CWD)).toEqual({
      mode: "simulated",
      appUrl: "http://localhost:3000",
      dataDir: "/project/.data",
    });
  });

  it("reads the app URL and data folder when they are set", () => {
    expect(chargesConfigFromEnv({ APP_URL: "https://cobros.test", DATA_DIR: "/tmp/data" }, CWD)).toEqual({
      mode: "simulated",
      appUrl: "https://cobros.test",
      dataDir: "/tmp/data",
    });
  });

  it("on Vercel, builds payment links on the production domain when APP_URL is not set", () => {
    const env = { VERCEL: "1", DATABASE_URL: "postgres://db.test/charges", VERCEL_PROJECT_PRODUCTION_URL: "cobros.vercel.app" };

    expect(chargesConfigFromEnv(env, CWD)).toMatchObject({ appUrl: "https://cobros.vercel.app" });
    expect(chargesConfigFromEnv({ ...env, APP_URL: "https://mi-dominio.test" }, CWD)).toMatchObject({
      appUrl: "https://mi-dominio.test",
    });
  });

  it("uses the real Ripio ramp with a valid business address", () => {
    expect(chargesConfigFromEnv({ PAYMENTS_MODE: "ripio", BUSINESS_ADDRESS: ADDRESS }, CWD)).toEqual({
      mode: "ripio",
      recipient: ADDRESS,
      dataDir: "/project/.data",
    });
  });

  it.each([undefined, "", "0x123", "dEaD", `${ADDRESS}0`, "0x000000000000000000000000000000000000zzzz"])(
    "refuses the ripio mode with %j as the business address",
    (address) => {
      const env = { PAYMENTS_MODE: "ripio", ...(address === undefined ? {} : { BUSINESS_ADDRESS: address }) };

      expect(() => chargesConfigFromEnv(env, CWD)).toThrow(InvalidBusinessAddressError);
    },
  );

  it("reads the block to start watching payments from, when given", () => {
    const env = { PAYMENTS_MODE: "ripio", BUSINESS_ADDRESS: ADDRESS, START_BLOCK: "80385000" };

    expect(chargesConfigFromEnv(env, CWD)).toMatchObject({ mode: "ripio", startBlock: 80_385_000n });
  });

  it.each(["-1", "1.5", "abc", "1e9"])("refuses %j as a start block", (startBlock) => {
    const env = { PAYMENTS_MODE: "ripio", BUSINESS_ADDRESS: ADDRESS, START_BLOCK: startBlock };

    expect(() => chargesConfigFromEnv(env, CWD)).toThrow(InvalidStartBlockError);
  });

  it("stores in Postgres when a database URL is set, in either mode", () => {
    const url = "postgres://user:secret@db.test/charges";

    expect(chargesConfigFromEnv({ DATABASE_URL: url }, CWD)).toMatchObject({ mode: "simulated", databaseUrl: url });
    expect(
      chargesConfigFromEnv({ PAYMENTS_MODE: "ripio", BUSINESS_ADDRESS: ADDRESS, DATABASE_URL: url }, CWD),
    ).toMatchObject({ mode: "ripio", databaseUrl: url });
  });

  it("refuses to run on Vercel without a database, where files would vanish between requests", () => {
    expect(() => chargesConfigFromEnv({ VERCEL: "1" }, CWD)).toThrow(MissingDatabaseError);
    expect(() => chargesConfigFromEnv({ VERCEL: "1", DATABASE_URL: "" }, CWD)).toThrow(MissingDatabaseError);
  });

  it("refuses an unknown payments mode instead of guessing", () => {
    expect(() => chargesConfigFromEnv({ PAYMENTS_MODE: "real" }, CWD)).toThrow(InvalidPaymentsModeError);
  });
});

describe("chargesFeatureFromConfig", () => {
  it("keeps charges and simulated payments in Postgres when the config has a database URL", async () => {
    const db = await testDatabase();
    const urls: string[] = [];
    const config = chargesConfigFromEnv({ DATABASE_URL: "postgres://db.test/charges" }, "/nonexistent");
    const feature = chargesFeatureFromConfig(config, {
      connect: (url) => {
        urls.push(url);
        return db;
      },
    });

    const charge = await feature.createCharge({
      requestId: "request-1",
      customer: "Juan Pérez",
      description: "medialunas",
      amount: "1000",
    });
    const { outcome } = await feature.simulatePayment(charge.id);

    expect(urls).toEqual(["postgres://db.test/charges"]);
    expect(outcome).toBe("paid");
    expect((await new PostgresChargeRepository(db).findById(charge.id))?.status).toBe("paid");
    expect(await feature.listActivity({})).toHaveLength(1);
    await feature.addToLedger({ requestId: "request-2", customer: "Martina", description: "pan", amount: "5000" });
    expect((await new PostgresLedgerRepository(db).list()).map(({ id }) => id)).toEqual(["L-0001"]);
  }, PGLITE_STARTUP_MS);
});

describe("chargesFeatureFromConfig in ripio mode", () => {
  it("has the ledger too, so the real payments mode keeps the same assistant", async () => {
    const db = await testDatabase();
    const config = chargesConfigFromEnv(
      { PAYMENTS_MODE: "ripio", BUSINESS_ADDRESS: ADDRESS, DATABASE_URL: "postgres://db.test/charges" },
      "/nonexistent",
    );
    const feature = chargesFeatureFromConfig(config, { connect: () => db });

    const { entry } = await feature.addToLedger({ requestId: "r-1", customer: "Martina", description: "pan", amount: "5000" });

    expect(entry.id).toBe("L-0001");
  }, PGLITE_STARTUP_MS);
});
