// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
      "Dónde recibís tus cobros",
      "Links",
    ]);
  });

  it("lets the shop connect the wallet where its charges arrive, read-only", async () => {
    render(await HowItWorksPage(pageProps("es-AR")));

    expect(screen.getByRole("region", { name: "Dónde recibís tus cobros" })).toBeTruthy();
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
});
