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

  it("returns the charge from a finished share_charge call, so a link sent again shows as its card", () => {
    expect(chargeFromPart(toolPart({ toolName: "share_charge" }))).toEqual(CHARGE);
  });

  it("shows no card when share_charge found nothing to share", () => {
    expect(chargeFromPart(toolPart({ toolName: "share_charge", output: { shared: false, reason: "No charge C-9999." } }))).toBeUndefined();
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

describe("a Brazilian charge", () => {
  const BRL: ChargeView = { ...CHARGE, customer: "João Silva", description: "pão de queijo", amount: "850", currency: "wBRL" };
  const BRL_PAID: ChargeView = { ...BRL, status: "paid", paidAt: "2026-10-17T15:05:00.000Z", paidBy: "simulated-4" };

  it("asks for reais in the page's language", () => {
    expect(paymentMessage(BRL, undefined, "pt-BR")).toBe(
      "Oi, João! Segue o link para pagar pão de queijo (C-0007) no valor de R$ 850: http://localhost:3000/pay/C-0007",
    );
    expect(paymentMessage(BRL, "Jo", "en")).toBe(
      "Hi Jo! Here is the link to pay for pão de queijo (C-0007), R$ 850: http://localhost:3000/pay/C-0007",
    );
  });

  it("shares the message in the page's language on WhatsApp", () => {
    const url = new URL(whatsAppShareUrl(BRL, { firstName: "João", phone: "5511912345678" }, "pt-BR"));

    expect(url.searchParams.get("text")).toBe(paymentMessage(BRL, "João", "pt-BR"));
  });

  it("gets a receipt in reais, paid through wBRL, at São Paulo time and in the page's language", () => {
    expect(receiptFor(BRL_PAID, "pt-BR")).toEqual({
      reference: "C-0007",
      operation: "simulated-4",
      paidAt: "17/10/2026 12:05",
      customer: "João Silva",
      description: "pão de queijo",
      amount: "R$ 850",
      method: "Ripio · wBRL na Celo",
      simulated: true,
    });
    expect(receiptFor(BRL_PAID, "en")?.paidAt).toBe("10/17/2026 12:05");
    expect(receiptFor(BRL_PAID, "en")?.method).toBe("Ripio · wBRL on Celo");
  });
});

describe("whatsAppNumber in Brazil", () => {
  it.each([
    ["11 91234-5678", "5511912345678"],
    ["(21) 98765-4321", "5521987654321"],
    ["+55 11 91234-5678", "5511912345678"],
    ["011 91234-5678", "5511912345678"],
  ])("turns the Brazilian mobile %s into WhatsApp's international format", (input, expected) => {
    expect(whatsAppNumber(input, "BR")).toBe(expected);
  });

  it.each([
    ["a landline, without the mobile 9", "11 2345-6789"],
    ["too short", "91234-5678"],
    ["empty", ""],
  ])("rejects a number that is %s", (_case, input) => {
    expect(whatsAppNumber(input, "BR")).toBeUndefined();
  });
});

describe("whatsAppNumber", () => {
  it.each([
    ["11 2345-6789", "5491123456789"],
    ["011 2345-6789", "5491123456789"],
    ["+54 9 11 2345-6789", "5491123456789"],
    ["54 11 2345 6789", "5491123456789"],
    ["(351) 456-7890", "5493514567890"],
    // Typed as written locally: trunk 0 plus area code 11, without the 15.
    ["01131909679", "5491131909679"],
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
