CREATE TABLE "ledger_entries" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"customer" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"currency" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"idempotency_key" text,
	"charge_id" text,
	CONSTRAINT "ledger_entries_id_unique" UNIQUE("id"),
	CONSTRAINT "ledger_entries_idempotencyKey_unique" UNIQUE("idempotency_key")
);
