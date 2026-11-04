// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { pageProps } from "@/core/i18n/testing";
import HowItWorksPage, { generateMetadata } from "./page";

afterEach(cleanup);

describe("how it works page", () => {
  it("has its own title inside the app's title template, in each language", async () => {
    expect((await generateMetadata(pageProps("es-AR"))).title).toBe("Cómo funciona");
    expect((await generateMetadata(pageProps("pt-BR"))).title).toBe("Como funciona");
    expect((await generateMetadata(pageProps("en"))).title).toBe("How it works");
  });

  it("goes deeper than the landing: problem, flow, an example, what is real today, how it is built and its guarantees", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    const sections = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(sections).toEqual([
      "El problema",
      "Paso a paso",
      "Un ejemplo con números",
      "Qué es real hoy",
      "Cómo está construido",
      "Garantías",
      "Para el jurado",
      "Links",
    ]);
  });

  it("leaves connecting the wallet to the demo: this page explains", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    expect(screen.queryByRole("region", { name: "Dónde recibís tus cobros" })).toBeNull();
    expect(screen.queryByText("Conectar billetera")).toBeNull();
  });

  it("says the agent works on its own: it checks payments every 15 minutes without being asked", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    const realToday = screen.getByRole("region", { name: "Qué es real hoy" });
    expect(within(realToday).getByText("El agente trabaja solo")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Paso a paso" })).getByText(/cada 15 minutos/)).toBeTruthy();
  });

  it("maps the track's five criteria, and the agent's identity, to where a judge can check each one", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    const judges = screen.getByRole("region", { name: "Para el jurado" });
    const criteria = within(judges)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(criteria).toEqual([
      "Opera en Celo mainnet con wFIAT real",
      "Uso real de wFIAT y del stack de Celo",
      "Un agente autónomo y útil",
      "UX usable por una persona real",
      "Impacto claro para LatAm",
      "Identidad del agente (ERC-8004)",
    ]);
    const hrefs = within(judges)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("https://celoscan.io/token/0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d");
    expect(hrefs).toContain("https://github.com/emilianooferreyra/owezy");
    expect(hrefs).toContain("/es-AR/demo");
    expect(hrefs).toContain(
      "https://celo-sepolia.blockscout.com/tx/0xaf510704d7006dfabe26880e72b7020e30c8af51b393ba79e8a53e28813cdba8",
    );
  });

  it("is honest that payments are simulated by default", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    const realToday = screen.getByRole("region", { name: "Qué es real hoy" });
    expect(within(realToday).getByText("El pago del cliente")).toBeTruthy();
    expect(within(realToday).getAllByText("Simulado por defecto").length).toBeGreaterThan(0);
  });

  it("links to the demo and to the public code", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    expect(screen.getAllByRole("link", { name: /Probar la demo/ })[0]?.getAttribute("href")).toBe("/es-AR/demo");
    expect(screen.getAllByRole("link", { name: /Ver el código/ })[0]?.getAttribute("href")).toBe(
      "https://github.com/emilianooferreyra/owezy",
    );
  });

  it("keeps Owezy and the language switcher at the very top", async () => {
    render(<I18nProvider locale="en">{await HowItWorksPage(pageProps("en"))}</I18nProvider>);

    const top = screen.getByRole("link", { name: "Owezy" }).closest("header") as HTMLElement;
    expect(top.parentElement?.firstElementChild).toBe(top);
    expect(within(top).getByRole("link", { name: "Owezy" }).getAttribute("href")).toBe("/en");
    expect(within(top).getByRole("navigation", { name: "Language" })).toBeTruthy();
  });

  it("keeps the landing's width, so the top bar does not jump between the two pages", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    const top = screen.getByRole("link", { name: "Owezy" }).closest("header") as HTMLElement;
    expect(top.className).toContain("max-w-6xl");
    expect(screen.getByRole("main").className).toContain("max-w-6xl");
  });

  it("gathers the on-chain proof in Links: the agent card, its ERC-8004 registration and its wallet", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    const links = within(screen.getByRole("region", { name: "Links" }));
    expect(links.getByRole("link", { name: /Ficha del agente/ }).getAttribute("href")).toBe("/agent.json");
    expect(links.getByRole("link", { name: /Registro ERC-8004/ }).getAttribute("href")).toBe(
      "https://celo-sepolia.blockscout.com/tx/0xaf510704d7006dfabe26880e72b7020e30c8af51b393ba79e8a53e28813cdba8",
    );
    expect(links.getByRole("link", { name: /Wallet del agente/ }).getAttribute("href")).toBe(
      "https://celo-sepolia.blockscout.com/address/0xEA93f4D017BFF57a4E79CFC19b98BDb6CeA4f99c",
    );
  });

  it("uses the landing's demo button: white, with the shaking ledger mascot instead of an arrow", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    const buttons = screen.getAllByRole("link", { name: /Probar la demo/ }).filter((link) => link.className.includes("bg-card"));
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.getAttribute("data-variant")).toBe("outline");
      expect(button.querySelector(".lucide-arrow-right")).toBeNull();
      expect(button.querySelector("[data-owezy-mark]")?.parentElement?.getAttribute("class")).toContain(
        "group-hover:animate-shake",
      );
    }
  });
});
