// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import type { ChargeView } from "../charges-feature";
import { SimulatedCheckout } from "./simulated-checkout";

const CHARGE: ChargeView = {
  id: "C-0001",
  customer: "Juan Pérez",
  description: "2 docenas de medialunas",
  amount: "85000",
  currency: "wARS",
  status: "pending",
  createdAt: "2026-10-17T15:00:00.000Z",
  paymentLink: "http://localhost:3000/pay/C-0001",
};

afterEach(cleanup);

describe("SimulatedCheckout", () => {
  it("charges an Argentine customer in pesos", () => {
    render(<SimulatedCheckout charge={CHARGE} />);

    expect(screen.getByRole("button", { name: "Pagar $85.000" })).toBeTruthy();
    expect(screen.getByText(/Pagás en pesos desde tu banco/)).toBeTruthy();
  });

  it("charges a Brazilian customer in reais, in Portuguese", () => {
    render(
      <I18nProvider locale="pt-BR">
        <SimulatedCheckout charge={{ ...CHARGE, amount: "850", currency: "wBRL" }} />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "Pagar R$ 850" })).toBeTruthy();
    expect(screen.getByText(/Você paga em reais com Pix/)).toBeTruthy();
  });

  it("speaks English, with the amount in the charge's currency", () => {
    render(
      <I18nProvider locale="en">
        <SimulatedCheckout charge={CHARGE} />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "Pay $85.000" })).toBeTruthy();
    expect(screen.getByText(/You pay in pesos from your bank/)).toBeTruthy();
  });

  it("shows the receipt of a paid charge in the page's language", () => {
    render(
      <I18nProvider locale="en">
        <SimulatedCheckout charge={{ ...CHARGE, status: "paid", paidAt: "2026-10-17T15:05:00.000Z", paidBy: "simulated-1" }} />
      </I18nProvider>,
    );

    expect(screen.getByRole("article", { name: "Payment receipt" })).toBeTruthy();
    expect(screen.getByText("Ripio · wARS on Celo")).toBeTruthy();
  });
});
