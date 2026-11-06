CREATE TABLE "model_usage" (
	"call_id" text PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"tokens" integer NOT NULL,
	CONSTRAINT "model_usage_tokens" CHECK ("model_usage"."tokens" >= 0)
);
--> statement-breakpoint
CREATE INDEX "model_usage_day" ON "model_usage" USING btree ("day");