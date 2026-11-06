import { sql } from "drizzle-orm";
import { beforeAll, describe } from "vitest";
import type { Database } from "../../core/storage/database";
import { PGLITE_STARTUP_MS, testDatabase } from "../charges/infrastructure/postgres/test-database";
import { PostgresUsageLedger } from "./postgres-usage-ledger";
import { usageLedgerContract } from "./usage-ledger-contract";

describe("PostgresUsageLedger", () => {
  let db: Database;

  // PGlite starts in seconds when every test file runs at once; each test then only empties it.
  beforeAll(async () => {
    db = await testDatabase();
  }, PGLITE_STARTUP_MS);

  usageLedgerContract(async () => {
    await db.execute(sql`truncate model_usage`);
    return new PostgresUsageLedger(db);
  });
});
