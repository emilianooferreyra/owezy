CREATE TABLE "activity" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"transfer_id" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"currency" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"details" jsonb NOT NULL,
	CONSTRAINT "activity_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" text PRIMARY KEY NOT NULL,
	"customer" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text,
	"paid_by" text,
	"paid_at" timestamp with time zone,
	CONSTRAINT "charges_idempotencyKey_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "charges_paidBy_unique" UNIQUE("paid_by"),
	CONSTRAINT "charges_status" CHECK ("charges"."status" in ('pending', 'paid')),
	CONSTRAINT "charges_amount_positive" CHECK ("charges"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "scan_cursor" (
	"recipient" text PRIMARY KEY NOT NULL,
	"last_block" numeric(78, 0)
);
--> statement-breakpoint
CREATE TABLE "scanned_transfers" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"id" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"currency" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "scanned_transfers_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "simulated_transfers" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"currency" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "charges_pending_amount" ON "charges" USING btree ("currency","amount") WHERE "charges"."status" = 'pending';