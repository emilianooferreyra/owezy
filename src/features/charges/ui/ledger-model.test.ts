import type { EveMessagePart } from "eve/react";
import { describe, expect, it } from "vitest";
import type { LedgerView } from "../charges-feature";
import {
  candidatesFromPart,
  chargeRequest,
  customerState,
  greetingFor,
  ledgerFromPart,
  noteFromPart,
  parseLedgerView,
} from "./ledger-model";
import { BR } from "./shops";

const entry = (id: string, description: string, amount: string, status: "unbilled" | "charged" | "paid") => ({
  id,
  customer: "x",
  description,
  amount,
  currency: "wARS",
  recordedAt: "2026-11-03T15:00:00.000Z",
  status,
});

const LEDGER: LedgerView = {
  customers: [
    { customer: "Juan Pérez", owed: "57000", unbilled: "57000", entries: [entry("L-0001", "torta", "57000", "unbilled")] },
    { customer: "Martina Gómez", owed: "9000", unbilled: "0", entries: [{ ...entry("L-0002", "pan", "9000", "charged"), chargeId: "C-0001" }] },
    { customer: "Lucía Fernández", owed: "0", unbilled: "0", entries: [{ ...entry("L-0003", "budín", "7500", "paid"), chargeId: "C-0002" }] },
  ],
  totalOwed: "66000",
};

function toolPart(toolName: string, output: unknown, overrides: Record<string, unknown> = {}): EveMessagePart {
  return { type: "dynamic-tool", toolName, toolCallId: "t1", state: "output-available", input: {}, output, ...overrides } as EveMessagePart;
}

describe("parseLedgerView", () => {
  it("accepts a ledger as the server sends it", () => {
    expect(parseLedgerView(LEDGER)).toEqual(LEDGER);
  });

  it("rejects anything else, so a broken response never renders", () => {
    expect(parseLedgerView({ customers: "nope" })).toBeUndefined();
    expect(parseLedgerView({ ...LEDGER, totalOwed: "$66.000" })).toBeUndefined();
  });
});

describe("customerState", () => {
  it("tells whether to charge the customer, whether a link is out, or whether they are up to date", () => {
    expect(LEDGER.customers.map(customerState)).toEqual(["to-charge", "link-sent", "up-to-date"]);
  });
});

describe("greetingFor", () => {
  it("opens with what the shop is owed and by how many customers", () => {
    expect(greetingFor(LEDGER)).toBe("¡Hola, Ana! Hoy te deben $66.000 entre 2 clientes.");
  });

  it("says it once when a single customer owes", () => {
    expect(greetingFor({ ...LEDGER, customers: LEDGER.customers.slice(1), totalOwed: "9000" })).toBe(
      "¡Hola, Ana! Hoy te deben $9.000 entre 1 cliente.",
    );
  });

  it("invites the owner to write something down when nobody owes", () => {
    expect(greetingFor({ customers: [], totalOwed: "0" })).toBe(
      "¡Hola, Ana! Nadie te debe nada. Contame qué se llevó alguien y lo anoto.",
    );
  });
});

describe("greetingFor in Brazil and in English", () => {
  const brazilian: LedgerView = {
    customers: [
      { customer: "João Silva", owed: "570", unbilled: "570", entries: [{ ...entry("L-0001", "pão de queijo", "570", "unbilled"), currency: "wBRL" }] },
    ],
    totalOwed: "570",
  };

  it("greets Bia in Portuguese with what her shop is owed in reais", () => {
    expect(greetingFor(brazilian, BR, "pt-BR")).toBe("Oi, Bia! Hoje te devem R$ 570 entre 1 cliente.");
  });

  it("greets in English, in the shop's currency", () => {
    expect(greetingFor(brazilian, BR, "en")).toBe("Hi, Bia! Today you are owed R$ 570 by 1 customer.");
    expect(greetingFor({ customers: [], totalOwed: "0" }, BR, "en")).toBe(
      "Hi, Bia! Nobody owes you anything. Tell me what someone took and I'll write it down.",
    );
  });
});

describe("chargeRequest", () => {
  it("is written in the page's language", () => {
    expect(chargeRequest("João Silva", "pt-BR")).toBe("Cobra o que João Silva deve");
    expect(chargeRequest("João Silva", "en")).toBe("Charge João Silva what they owe");
  });

  it("is what the owner would type to charge a customer from the ledger", () => {
    expect(chargeRequest("Juan Pérez")).toBe("Cobrale a Juan Pérez lo que debe");
  });
});

describe("tool parts", () => {
  it("reads the ledger a finished read_ledger call returned", () => {
    expect(ledgerFromPart(toolPart("read_ledger", LEDGER))).toEqual(LEDGER);
    expect(ledgerFromPart(toolPart("read_ledger", LEDGER, { state: "input-available" }))).toBeUndefined();
    expect(ledgerFromPart(toolPart("list_charges", LEDGER))).toBeUndefined();
  });

  it("reads the entry a finished add_to_ledger call wrote", () => {
    const written = { created: true, entry: { ...entry("L-0009", "pastafrola", "8000", "unbilled"), customer: "Martina Gómez" } };

    expect(noteFromPart(toolPart("add_to_ledger", written))).toEqual(written.entry);
    expect(noteFromPart(toolPart("add_to_ledger", { written: false, candidates: ["A", "B"] }))).toBeUndefined();
  });

  it("offers the customers a name could be when a ledger tool could not tell", () => {
    const ambiguous = { charged: false, reason: "…", candidates: ["Juan Pérez", "Juan Ruiz"] };

    expect(candidatesFromPart(toolPart("charge_from_ledger", ambiguous))).toEqual(["Juan Pérez", "Juan Ruiz"]);
    expect(candidatesFromPart(toolPart("add_to_ledger", { ...ambiguous, written: false }))).toEqual(["Juan Pérez", "Juan Ruiz"]);
    expect(candidatesFromPart(toolPart("create_charge", ambiguous))).toBeUndefined();
  });
});
