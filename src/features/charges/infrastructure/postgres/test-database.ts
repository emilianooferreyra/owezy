import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { DATABASE_CASING, type Database } from "../../../../core/storage/database";

/** How long starting PGlite may take while every test file runs at once. */
export const PGLITE_STARTUP_MS = 60_000;

let shared: Promise<Database> | undefined;

async function migrated(): Promise<Database> {
  const db = drizzle({ client: new PGlite(), casing: DATABASE_CASING });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

/**
 * An in-memory Postgres with the real migrations applied, emptied for each test. Starting PGlite
 * takes about a second, so each test file starts it once.
 */
export async function testDatabase(): Promise<Database> {
  shared ??= migrated();
  const db = await shared;
  await db.execute(
    sql`truncate charges, activity, scan_cursor, scanned_transfers, simulated_transfers restart identity`,
  );
  return db;
}
