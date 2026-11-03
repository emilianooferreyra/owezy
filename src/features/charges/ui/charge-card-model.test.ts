import type { EveMessagePart } from "eve/react";
import { describe, expect, it } from "vitest";
import type { ChargeView } from "../charges-feature";
import {
  chargeFromPart,
  parseChargeView,
  paymentMessage,
  pollStatusResult,
  receiptFor,
  whatsAppNumber,
  whatsAppShareUrl,
} from "./charge-card-model";

const CHARGE: ChargeView = {
  id: "C-0007",
  customer: "Juan Pérez",
  description: "2 docenas de medialunas",
  amount: "85000",
  currency: "wARS",
  status: "pending",
  createdAt: "2026-10-17T15:00:00.000Z",
  paymentLink: "http://localhost:3000/pay/C-0007",
  created: true,
};

const PAID: ChargeView = {
  ...CHARGE,
  status: "paid",
  paidAt: "2026-10-17T15:05:00.000Z",
  paidBy: "simulated-3",
};

function toolPart(overrides: Record<string, unknown> = {}): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolCallId: "call-1",
    toolName: "create_charge",
    state: "output-available",
    input: { customer: "Juan Pérez", description: "2 docenas de medialunas", amount: "85000" },
    output: CHARGE,
    ...overrides,
  } as EveMessagePart;
}

describe("chargeFromPart", () => {
  it("returns the charge from a finished create_charge call", () => {
    expect(chargeFromPart(toolPart())).toEqual(CHARGE);
  });

  it("returns the charge from a finished charge_from_ledger call, which creates one too", () => {
    expect(chargeFromPart(toolPart({ toolName: "charge_from_ledger", output: { ...CHARGE, entries: ["L-0001"] } }))).toMatchObject(
      CHARGE,
    );
  });

  it("ignores text parts", () => {
    expect(chargeFromPart({ type: "text", text: "hola" } as EveMessagePart)).toBeUndefined();
  });

  it("ignores other tools", () => {
    expect(chargeFromPart(toolPart({ toolName: "something_else" }))).toBeUndefined();
  });

  it("ignores a call that is still running", () => {
    expect(chargeFromPart(toolPart({ state: "input-available", output: undefined }))).toBeUndefined();
  });

  it("ignores a preliminary (partial) result", () => {
    expect(chargeFromPart(toolPart({ partial: true }))).toBeUndefined();
  });

  it("ignores an output that is not a charge, since tool outputs reach the UI untyped", () => {
    expect(chargeFromPart(toolPart({ output: { id: "C-0007" } }))).toBeUndefined();
  });
});

describe("parseChargeView", () => {
  it("accepts a charge from the status endpoint, which carries no 'created' flag", () => {
    const { created: _created, ...fromEndpoint } = CHARGE;

    expect(parseChargeView({ ...fromEndpoint, status: "paid" })).toEqual({ ...fromEndpoint, status: "paid" });
  });

  it("rejects a response that is not a charge", () => {
    expect(parseChargeView({ error: "not found" })).toBeUndefined();
  });
});

describe("pollStatusResult", () => {
  it("updates every charge the server returned", () => {
    expect(pollStatusResult(["C-0007"], 200, { charges: [PAID] })).toEqual({ kind: "update", charges: [PAID], gone: [] });
  });

  it("reports the asked charges the server no longer has, so they stop being polled instead of asked forever", () => {
    expect(pollStatusResult(["C-0007", "C-0099"], 200, { charges: [PAID] })).toMatchObject({ gone: ["C-0099"] });
  });

  it("skips an entry that is not a charge, without dropping the valid ones or calling its id gone", () => {
    const result = pollStatusResult(["C-0007", "C-0008"], 200, { charges: [PAID, { id: "C-0008" }] });

    expect(result).toEqual({ kind: "update", charges: [PAID], gone: [] });
  });

  it("retries on a server error or an unexpected body", () => {
    expect(pollStatusResult(["C-0007"], 500, {})).toEqual({ kind: "retry" });
    expect(pollStatusResult(["C-0007"], 200, { nope: true })).toEqual({ kind: "retry" });
    expect(pollStatusResult(["C-0007"], 200, undefined)).toEqual({ kind: "retry" });
  });
});

describe("paymentMessage", () => {
  it("greets the customer by first name and says what, how much and where to pay", () => {
    expect(paymentMessage(CHARGE)).toBe(
      "¡Hola Juan! Te paso el link para pagar 2 docenas de medialunas (C-0007) por $85.000: http://localhost:3000/pay/C-0007",
    );
  });

  it("greets the customer by the name the owner wrote in their contact", () => {
    expect(paymentMessage(CHARGE, "Juancito")).toMatch(/^¡Hola Juancito!/);
  });
});

describe("whatsAppNumber", () => {
  it.each([
    ["11 2345-6789", "5491123456789"],
    ["011 2345-6789", "5491123456789"],
    ["+54 9 11 2345-6789", "5491123456789"],
    ["54 11 2345 6789", "5491123456789"],
    ["(351) 456-7890", "5493514567890"],
  ])("turns the Argentine mobile %s into WhatsApp's international format", (input, expected) => {
    expect(whatsAppNumber(input)).toBe(expected);
  });

  it.each([
    ["too short", "2345-6789"],
    ["with the 15 prefix, which hides where the area code ends", "11 15 2345-6789"],
    ["not a number", "Kevin"],
    ["empty", ""],
  ])("rejects a number that is %s", (_case, input) => {
    expect(whatsAppNumber(input)).toBeUndefined();
  });
});

describe("whatsAppShareUrl", () => {
  it("opens the customer's WhatsApp chat with the payment message ready to send", () => {
    const url = new URL(whatsAppShareUrl(CHARGE, { firstName: "Juan", phone: "5491123456789" }));

    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/5491123456789");
    expect(url.searchParams.get("text")).toBe(paymentMessage(CHARGE, "Juan"));
  });
});

describe("receiptFor", () => {
  it("has no receipt while the charge is pending", () => {
    expect(receiptFor(CHARGE)).toBeUndefined();
  });

  it("builds the receipt of a paid charge, with the time in Argentina", () => {
    expect(receiptFor(PAID)).toEqual({
      reference: "C-0007",
      operation: "simulated-3",
      paidAt: "17/10/2026 12:05",
      customer: "Juan Pérez",
      description: "2 docenas de medialunas",
      amount: "$85.000",
      method: "Ripio · wARS en Celo",
      simulated: true,
    });
  });

  it("marks only simulated payments as simulated", () => {
    expect(receiptFor({ ...PAID, paidBy: "0xabc:3" })?.simulated).toBe(false);
  });

  it("links a real payment to its transaction on Celoscan, the proof anyone can check", () => {
    const txHash = "0x96826333ef7ebc965b53850659251b13eee6ed17c49887ed63f4090e722511a0";

    expect(receiptFor({ ...PAID, paidBy: `${txHash}:0` })?.explorerUrl).toBe(`https://celoscan.io/tx/${txHash}`);
  });

  it("has no explorer link for a simulated payment", () => {
    expect(receiptFor(PAID)?.explorerUrl).toBeUndefined();
  });
});
