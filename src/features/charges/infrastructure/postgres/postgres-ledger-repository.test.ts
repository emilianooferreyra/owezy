import { beforeAll } from "vitest";
import { ledgerRepositoryContract } from "../../testing/ledger-repository-contract";
import { PostgresLedgerRepository } from "./postgres-ledger-repository";
import { PGLITE_STARTUP_MS, testDatabase } from "./test-database";

// PGlite starts in seconds when every test file runs at once; each test then only empties it.
beforeAll(() => testDatabase(), PGLITE_STARTUP_MS);

ledgerRepositoryContract("PostgresLedgerRepository", async () => new PostgresLedgerRepository(await testDatabase()));
