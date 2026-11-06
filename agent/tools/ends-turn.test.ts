import type { ToolContext } from "eve/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChargesFeature, type ChargesFeature } from "../../src/features/charges/charges-feature";
import { InMemoryChargeRepository } from "../../src/features/charges/infrastructure/in-memory-charge-repository";
import { InMemoryLedgerRepository } from "../../src/features/charges/infrastructure/in-memory-ledger-repository";
import { SimulatedTransferSource } from "../../src/features/charges/infrastructure/simulated-transfer-source";
import { parseChargeView } from "../../src/features/charges/ui/charge-card-model";

// The tools run against an in-memory shop instead of the configured one.
const shop = vi.hoisted(() => ({ feature: undefined as unknown as ChargesFeature }));
vi.mock("../../src/features/charges", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/charges")>()),
  chargesRuntime: () => ({ feature: shop.feature }),
}));

import addToLedger from "./add_to_ledger";
import chargeFromLedger from "./charge_from_ledger";
import createCharge from "./create_charge";
import shareCharge from "./share_charge";

const NOW = new Date("2026-11-03T15:00:00.000Z");

beforeEach(() => {
  shop.feature = createChargesFeature({
    charges: new InMemoryChargeRepository(),
    ledger: new InMemoryLedgerRepository(),
    buildPaymentLink: (charge) => `https://pay.test/${charge.id}`,
    now: () => NOW,
    simulator: new SimulatedTransferSource({ now: () => new Date(NOW.getTime() + 60_000) }),
  });
});

/** The context of one owner request: a new turn id is a new request. */
const turn = (id: string) => ({ session: { id: "session-1", turn: { id } } }) as unknown as ToolContext;

type AnyTool = { execute: (input: never, ctx: ToolContext) => unknown; endsTurn?: unknown };

/** Runs a tool the way eve does, and answers whether that call ends the turn. */
async function run(tool: AnyTool, input: Record<string, unknown>, turnId: string) {
  const output = await tool.execute(input as never, turn(turnId));
  const endsTurn = tool.endsTurn;
  if (typeof endsTurn !== "function") {
    throw new Error("endsTurn must decide from the result");
  }
  return { output, endsTurn: await (endsTurn as (output: unknown) => boolean | Promise<boolean>)(output) };
}

const charge = (customer: string, amount: string) => ({ customer, description: "2 tortas", amount, currency: "wARS" });
const note = (customer: string, amount: string) => ({ customer, description: "torta", amount, currency: "wARS" });

describe("create_charge ends the turn", () => {
  it("when the charge is created: its card is the answer", async () => {
    const { output, endsTurn } = await run(createCharge, charge("Mario Casese", "11500"), "t1");

    expect(endsTurn).toBe(true);
    // Still the card's charge, as before.
    expect(parseChargeView(output)).toMatchObject({ id: "C-0001", customer: "Mario Casese", amount: "11500" });
    expect(output).toMatchObject({ amountAdjusted: false });
  });

  it("when a retry of the same request returns the charge it already created", async () => {
    await run(createCharge, charge("Mario Casese", "11500"), "t1");

    const { output, endsTurn } = await run(createCharge, charge("Mario Casese", "11500"), "t1");

    expect(output).toMatchObject({ id: "C-0001", created: false });
    expect(endsTurn).toBe(true);
  });

  it("not when it added cents to keep the amount distinct: the model explains them", async () => {
    await run(createCharge, charge("Mario Casese", "11500"), "t1");

    const { output, endsTurn } = await run(createCharge, charge("Juan Pérez", "11500"), "t2");

    expect(output).toMatchObject({ id: "C-0002", amount: "11500.01", amountAdjusted: true });
    expect(endsTurn).toBe(false);
  });
});

describe("charge_from_ledger ends the turn", () => {
  it("when it charged the customer: its card is the answer", async () => {
    await run(addToLedger, note("Juan Pérez", "30000"), "t1");

    const { output, endsTurn } = await run(chargeFromLedger, { customer: "Juan", currency: "wARS" }, "t2");

    expect(parseChargeView(output)).toMatchObject({ customer: "Juan Pérez", amount: "30000" });
    expect(endsTurn).toBe(true);
  });

  it("not when there is nothing to charge: the model tells the owner", async () => {
    const { output, endsTurn } = await run(chargeFromLedger, { customer: "Juan", currency: "wARS" }, "t1");

    expect(output).toMatchObject({ charged: false });
    expect(endsTurn).toBe(false);
  });

  it("not when the name fits several customers: the model asks which one", async () => {
    await run(addToLedger, note("Juan Pérez", "30000"), "t1");
    await run(addToLedger, note("Juan Ruiz", "5000"), "t2");

    const { output, endsTurn } = await run(chargeFromLedger, { customer: "Juan", currency: "wARS" }, "t3");

    expect(output).toMatchObject({ charged: false, candidates: ["Juan Pérez", "Juan Ruiz"] });
    expect(endsTurn).toBe(false);
  });

  it("not when the charge got cents to keep it distinct: the model explains them", async () => {
    await run(createCharge, charge("Martina Gómez", "30000"), "t1");
    await run(addToLedger, note("Juan Pérez", "30000"), "t2");

    const { output, endsTurn } = await run(chargeFromLedger, { customer: "Juan", currency: "wARS" }, "t3");

    expect(output).toMatchObject({ amount: "30000.01" });
    expect(endsTurn).toBe(false);
  });
});

describe("add_to_ledger ends the turn", () => {
  it("when it wrote the entry: its card is the answer", async () => {
    const { output, endsTurn } = await run(addToLedger, note("Juan Pérez", "30000"), "t1");

    expect(output).toMatchObject({ created: true, entry: { customer: "Juan Pérez", amount: "30000" } });
    expect(endsTurn).toBe(true);
  });

  it("not when the name fits several customers: nothing was written", async () => {
    await run(addToLedger, note("Juan Pérez", "30000"), "t1");
    await run(addToLedger, note("Juan Ruiz", "5000"), "t2");

    const { output, endsTurn } = await run(addToLedger, note("Juan", "1000"), "t3");

    expect(output).toMatchObject({ written: false, candidates: ["Juan Pérez", "Juan Ruiz"] });
    expect(endsTurn).toBe(false);
  });
});

describe("share_charge ends the turn", () => {
  it("when it shows a pending charge: its card is the answer", async () => {
    await run(createCharge, charge("Mario Casese", "11500"), "t1");

    const { output, endsTurn } = await run(shareCharge, { reference: "C-0001", currency: "wARS" }, "t2");

    expect(parseChargeView(output)).toMatchObject({ id: "C-0001", status: "pending" });
    expect(endsTurn).toBe(true);
  });

  it("not when the charge is already paid: the model says so instead of sending it", async () => {
    await run(createCharge, charge("Mario Casese", "11500"), "t1");
    await shop.feature.simulatePayment("C-0001");

    const { output, endsTurn } = await run(shareCharge, { reference: "C-0001", currency: "wARS" }, "t2");

    expect(output).toMatchObject({ status: "paid" });
    expect(endsTurn).toBe(false);
  });

  it("not when the charge does not exist", async () => {
    const { output, endsTurn } = await run(shareCharge, { reference: "C-0009", currency: "wARS" }, "t1");

    expect(output).toMatchObject({ shared: false });
    expect(endsTurn).toBe(false);
  });
});
