// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "./page";

afterEach(cleanup);

describe("landing page", () => {
  it("names the product and says what it does for the shop", () => {
    render(<HomePage />);

    const hero = screen.getByRole("heading", { level: 1 });
    expect(hero.textContent).toContain("Owezy");
    expect(screen.getByText("Te deben. Owezy les cobra por vos.")).toBeTruthy();
  });

  it("shows a sample ledger: who owes what, and who can be charged", () => {
    render(<HomePage />);

    const ledger = screen.getByRole("region", { name: "Libreta" });
    expect(within(ledger).getByText("Juan Pérez")).toBeTruthy();
    expect(within(ledger).getByRole("button", { name: "Cobrar a Juan Pérez" })).toBeTruthy();
  });

  it("sums up the ledger flow in three steps, leaving the explanation to the detail page", () => {
    render(<HomePage />);

    const flow = screen.getByRole("region", { name: "Cómo funciona" });
    const steps = within(flow)
      .getAllByRole("heading", { level: 3 })
      .map((step) => step.textContent);
    expect(steps).toEqual(["Anotás", "Cobrás", "Te avisa"]);
  });

  it("links to the demo, the detailed explanation and the code", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /Probar la demo/ }).getAttribute("href")).toBe("/demo");
    expect(screen.getByRole("link", { name: /Ver cómo funciona/ }).getAttribute("href")).toBe("/how-it-works");
    expect(screen.getByRole("link", { name: /Ver el código/ }).getAttribute("href")).toBe(
      "https://github.com/emilianooferreyra/owezy",
    );
  });

  it("leaves the wallet out of the landing", () => {
    render(<HomePage />);

    expect(screen.queryByRole("region", { name: "Dónde recibís tus cobros" })).toBeNull();
  });
});
