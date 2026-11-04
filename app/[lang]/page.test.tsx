// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Locale } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { pageProps } from "@/core/i18n/testing";
import HomePage from "./page";

afterEach(cleanup);

/** The landing with the layout's locale around it, as the sample ledger (a Client Component) reads it. */
async function renderInLocale(lang: Locale) {
  return render(<I18nProvider locale={lang}>{await HomePage(pageProps(lang))}</I18nProvider>);
}

describe("landing page", () => {
  it("names the product and says what it does for the shop", async () => {
    render(await HomePage(pageProps("es-AR")));

    const hero = screen.getByRole("heading", { level: 1 });
    expect(hero.textContent).toContain("Owezy");
    expect(screen.getByText("Te deben. Owezy les cobra por vos.")).toBeTruthy();
  });

  it("shows a sample ledger: who owes what, and who can be charged", async () => {
    render(await HomePage(pageProps("es-AR")));

    const ledger = screen.getByRole("region", { name: "Libreta" });
    expect(within(ledger).getByText("Juan Pérez")).toBeTruthy();
    expect(within(ledger).getByRole("button", { name: "Cobrar a Juan Pérez" })).toBeTruthy();
  });

  it("sums up the ledger flow in three steps, leaving the explanation to the detail page", async () => {
    render(await HomePage(pageProps("es-AR")));

    const flow = screen.getByRole("region", { name: "Cómo funciona" });
    const steps = within(flow)
      .getAllByRole("heading", { level: 3 })
      .map((step) => step.textContent);
    expect(steps).toEqual(["Anotás", "Cobrás", "Te avisa"]);
  });

  it("links to the demo, the detailed explanation and the code", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.getByRole("link", { name: /Probar la demo/ }).getAttribute("href")).toBe("/es-AR/demo");
    expect(screen.getByRole("link", { name: /Ver cómo funciona/ }).getAttribute("href")).toBe("/es-AR/how-it-works");
    expect(screen.getByRole("link", { name: /Ver el código/ }).getAttribute("href")).toBe(
      "https://github.com/emilianooferreyra/owezy",
    );
  });

  it("leaves the wallet out of the landing", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.queryByRole("region", { name: "Dónde recibís tus cobros" })).toBeNull();
  });

  it("speaks Brazilian Portuguese and English under their locales, linking within them", async () => {
    render(await HomePage(pageProps("pt-BR")));
    expect(screen.getByText("Te devem. A Owezy cobra por você.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Testar a demo/ }).getAttribute("href")).toBe("/pt-BR/demo");
    cleanup();

    render(await HomePage(pageProps("en")));
    expect(screen.getByText("They owe, you get paid.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Try the demo/ }).getAttribute("href")).toBe("/en/demo");
  });

  it("says where it works today and that more countries are coming", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.getByText("Hoy en Argentina y Brasil")).toBeTruthy();
    expect(screen.getByText(/Próximamente/)).toBeTruthy();
  });

  it("shows Brazilian customers in reais on pt-BR, Argentine customers in pesos otherwise", async () => {
    await renderInLocale("pt-BR");
    const caderneta = screen.getByRole("region", { name: "Caderneta" });
    expect(within(caderneta).getByText("João Silva")).toBeTruthy();
    expect(within(caderneta).getByRole("button", { name: "Cobrar João Silva" })).toBeTruthy();
    expect(within(caderneta).getByText("R$ 570")).toBeTruthy();
    cleanup();

    await renderInLocale("en");
    const ledger = screen.getByRole("region", { name: "Ledger" });
    expect(within(ledger).getByText("Juan Pérez")).toBeTruthy();
    expect(within(ledger).getByText("$94.000")).toBeTruthy();
  });
});
