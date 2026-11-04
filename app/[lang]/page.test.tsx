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
    expect(screen.getByText("La libreta del fiado que cobra sola.")).toBeTruthy();
  });

  it("shows a sample ledger as a picture: who owes what, and a Cobrar that does nothing", async () => {
    render(await HomePage(pageProps("es-AR")));

    const ledger = screen.getByRole("region", { name: "Libreta" });
    expect(within(ledger).getByText("Juan Pérez")).toBeTruthy();
    expect(within(ledger).getAllByText("Cobrar").length).toBeGreaterThan(0);
    expect(within(ledger).queryAllByRole("button")).toEqual([]);
    expect(within(ledger).queryAllByRole("link")).toEqual([]);
  });

  it("sums up the ledger flow in three steps, leaving the explanation to the detail page", async () => {
    render(await HomePage(pageProps("es-AR")));

    const flow = screen.getByRole("region", { name: "Cómo funciona" });
    const steps = within(flow)
      .getAllByRole("heading", { level: 3 })
      .map((step) => step.textContent);
    expect(steps).toEqual(["Anotás", "Cobrás", "Te avisa"]);
  });

  it("links to the demo and to the detailed explanation, the latter as an outlined button", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.getByRole("link", { name: /Probar la demo/ }).getAttribute("href")).toBe("/es-AR/demo");
    const howItWorks = screen.getByRole("link", { name: /Ver cómo funciona/ });
    expect(howItWorks.getAttribute("href")).toBe("/es-AR/how-it-works");
    expect(howItWorks.getAttribute("data-variant")).toBe("outline");
  });

  it("ends with a one-line footer, without navigation", async () => {
    render(await HomePage(pageProps("es-AR")));

    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toBe("Owezy · Celo mainnet");
    expect(footer.className).toContain("text-left");
    expect(within(footer).queryAllByRole("link")).toEqual([]);
  });

  it("leaves the wallet out of the landing", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.queryByRole("region", { name: "Dónde recibís tus cobros" })).toBeNull();
  });

  it("speaks Brazilian Portuguese and English under their locales, linking within them", async () => {
    render(await HomePage(pageProps("pt-BR")));
    expect(screen.getByText("A caderneta do fiado que cobra sozinha.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Testar a demo/ }).getAttribute("href")).toBe("/pt-BR/demo");
    cleanup();

    render(await HomePage(pageProps("en")));
    expect(screen.getByText("The credit ledger that collects itself.")).toBeTruthy();
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
    expect(within(caderneta).queryAllByRole("button")).toEqual([]);
    expect(within(caderneta).getByText("R$ 570")).toBeTruthy();
    cleanup();

    await renderInLocale("en");
    const ledger = screen.getByRole("region", { name: "Ledger" });
    expect(within(ledger).getByText("Juan Pérez")).toBeTruthy();
    expect(within(ledger).getByText("$94.000")).toBeTruthy();
  });

  it("puts Owezy and the language switcher at the very top of the page", async () => {
    render(await HomePage(pageProps("pt-BR")));

    const top = screen.getByRole("link", { name: "Owezy" }).closest("header") as HTMLElement;
    expect(top.parentElement?.firstElementChild).toBe(top);
    expect(within(top).getByRole("link", { name: "Owezy" }).getAttribute("href")).toBe("/pt-BR");
    expect(within(top).getByRole("link", { name: "Como funciona" }).getAttribute("href")).toBe("/pt-BR/how-it-works");
    expect(within(top).getByRole("navigation", { name: "Idioma" })).toBeTruthy();
  });

  it("leaves the audience and the stack to the detail page: no badge above the hero", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.queryByText("Para PyMEs de Argentina y Brasil · Celo + Ripio")).toBeNull();
  });

  it("animates each step's icon when the pointer is over its card, each in its own way", async () => {
    render(await HomePage(pageProps("es-AR")));

    const steps = within(screen.getByRole("region", { name: "Cómo funciona" })).getAllByRole("listitem");
    const animations = steps.map((step) => {
      expect(step.className).toContain("group");
      return step.querySelector("[data-step-icon]")?.getAttribute("class") ?? "";
    });
    expect(animations[0]).toContain("group-hover:animate-write");
    expect(animations[1]).toContain("group-hover:animate-fly");
    expect(animations[2]).toContain("group-hover:animate-ring");
  });

  it("shows the ledger mascot on the demo button instead of an arrow, and shakes it on hover", async () => {
    render(await HomePage(pageProps("es-AR")));

    const button = screen.getByRole("link", { name: /Probar la demo/ });
    expect(button.querySelector(".lucide-arrow-right")).toBeNull();
    expect(button.querySelector("[data-owezy-mark]")?.parentElement?.getAttribute("class")).toContain(
      "group-hover:animate-shake",
    );
  });

  it("puts the green mascot on a white demo button, so it stands out", async () => {
    render(await HomePage(pageProps("es-AR")));

    const button = screen.getByRole("link", { name: /Probar la demo/ });
    expect(button.getAttribute("data-variant")).toBe("outline");
    expect(button.className).toContain("bg-card");
  });

  it("paints the owner's message in the highlight yellow, like the payment that answers it", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.getByText("Juan se llevó 2 docenas de medialunas, 12 lucas").className).toContain("bg-highlight");
  });

  it("tilts the owner's message downwards, like the payment note", async () => {
    render(await HomePage(pageProps("es-AR")));

    const owner = screen.getByText("Juan se llevó 2 docenas de medialunas, 12 lucas");
    expect(owner.className).toMatch(/(^|\s)rotate-2(\s|$)/);
  });

  it("keeps both hero buttons white on hover", async () => {
    render(await HomePage(pageProps("es-AR")));

    expect(screen.getByRole("link", { name: /Probar la demo/ }).className).toContain("hover:bg-card");
    expect(screen.getByRole("link", { name: /Ver cómo funciona/ }).className).toContain("hover:bg-card");
  });
});
