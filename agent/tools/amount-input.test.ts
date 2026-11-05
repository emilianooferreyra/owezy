import { describe, expect, it } from "vitest";
import type { z } from "zod";
import addToLedger from "./add_to_ledger";
import createCharge from "./create_charge";

describe.each([
  ["create_charge", createCharge],
  ["add_to_ledger", addToLedger],
])("%s amount", (_, tool) => {
  // The tools are written with zod; eve types the schema as any Standard Schema.
  const schema = tool.inputSchema as z.ZodType;
  const input = (amount: string) => ({ customer: "Juan", description: "2 tortas", amount, currency: "wARS" });

  it("accepts the largest amount the shop may charge, with cents", () => {
    expect(schema.safeParse(input("1000000000.50")).success).toBe(true);
  });

  it("rejects an amount too long to be real before it is parsed", () => {
    expect(schema.safeParse(input("9".repeat(31))).success).toBe(false);
  });
});
