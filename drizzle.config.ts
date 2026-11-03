import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` writes a SQL migration from the schema; `pnpm db:migrate` applies the
// migrations to the database at DATABASE_URL.
export default defineConfig({
  schema: "./src/features/charges/infrastructure/postgres/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  casing: "snake_case",
  strict: true,
});
