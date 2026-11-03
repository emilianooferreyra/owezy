import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** Any Postgres connection the adapters can use: Neon in production, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT>;

/** The column naming the migrations were generated with (see drizzle.config.ts). */
export const DATABASE_CASING = "snake_case";

/** Connects to Neon over HTTP: no pool to keep warm, which suits serverless functions. */
export function connectDatabase(url: string): Database {
  return drizzle({ client: neon(url), casing: DATABASE_CASING });
}
