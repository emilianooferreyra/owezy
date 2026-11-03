// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LedgerView } from "../charges-feature";
import { CustomerChoice, LedgerCard, LedgerNote } from "./ledger-card";

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
    {
      customer: "Juan Pérez",
      owed: "57000",
      unbilled: "57000",
      entries: [entry("L-0001", "medialunas", "12000", "unbilled"), entry("L-0003", "torta", "45000", "unbilled")],
    },
    { customer: "Martina Gómez", owed: "9000", unbilled: "0", entries: [entry("L-0002", "pan", "9000", "charged")] },
    { customer: "Lucía Fernández", owed: "0", unbilled: "0", entries: [entry("L-0004", "budín", "7500", "paid")] },
  ],
  totalOwed: "66000",
};

afterEach(cleanup);

describe("LedgerCard", () => {
  it("shows who owes what, for what, and the shop's total", () => {
    render(<LedgerCard ledger={LEDGER} onCharge={() => {}} />);

    const card = screen.getByRole("region", { name: "Libreta" });
    expect(within(card).getByText("$66.000")).toBeTruthy();
    const juan = within(card).getByText("Juan Pérez").closest("li") as HTMLElement;
    expect(within(juan).getByText("medialunas · torta")).toBeTruthy();
    expect(within(juan).getByText("$57.000")).toBeTruthy();
  });

  it("offers to charge only customers with something not charged yet, and sends that customer", () => {
    const onCharge = vi.fn();
    render(<LedgerCard ledger={LEDGER} onCharge={onCharge} />);

    expect(screen.getAllByRole("button", { name: /Cobrar/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar a Juan Pérez" }));

    expect(onCharge).toHaveBeenCalledWith("Juan Pérez");
    expect(screen.getByText("Link enviado")).toBeTruthy();
    expect(screen.getByText("Al día")).toBeTruthy();
  });

  it("holds the buttons while the agent is answering", () => {
    render(<LedgerCard ledger={LEDGER} onCharge={() => {}} disabled />);

    expect((screen.getByRole("button", { name: "Cobrar a Juan Pérez" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says the ledger is empty instead of showing an empty list", () => {
    render(<LedgerCard ledger={{ customers: [], totalOwed: "0" }} onCharge={() => {}} />);

    expect(screen.getByText("Todavía no anotaste nada.")).toBeTruthy();
  });
});

describe("LedgerNote", () => {
  it("confirms what was written down, for whom and how much", () => {
    render(<LedgerNote entry={{ ...entry("L-0009", "pastafrola", "8000", "unbilled"), customer: "Martina Gómez" }} />);

    const note = screen.getByRole("status");
    expect(note.textContent).toContain("Martina Gómez");
    expect(note.textContent).toContain("pastafrola");
    expect(note.textContent).toContain("$8.000");
  });
});

describe("CustomerChoice", () => {
  it("lets the owner pick which customer they meant", () => {
    const onChoose = vi.fn();
    render(<CustomerChoice candidates={["Juan Pérez", "Juan Ruiz"]} onChoose={onChoose} />);

    fireEvent.click(screen.getByRole("button", { name: /Juan Ruiz/ }));

    expect(onChoose).toHaveBeenCalledWith("Juan Ruiz");
  });
});
