// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HowItWorksPage, { metadata } from "./page";

afterEach(cleanup);

describe("how it works page", () => {
  it("has its own title inside the app's title template", () => {
    expect(metadata.title).toBe("Cómo funciona");
  });

  it("goes deeper than the landing: problem, flow, an example, what is real today, how it is built and its guarantees", () => {
    render(<HowItWorksPage />);

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

  it("lets the shop connect the wallet where its charges arrive, read-only", () => {
    render(<HowItWorksPage />);

    expect(screen.getByRole("region", { name: "Dónde recibís tus cobros" })).toBeTruthy();
  });

  it("is honest that payments are simulated by default", () => {
    render(<HowItWorksPage />);

    const realToday = screen.getByRole("region", { name: "Qué es real hoy" });
    expect(within(realToday).getByText("El pago del cliente")).toBeTruthy();
    expect(within(realToday).getAllByText("Simulado por defecto").length).toBeGreaterThan(0);
  });

  it("links to the demo and to the public code", () => {
    render(<HowItWorksPage />);

    expect(screen.getAllByRole("link", { name: /Probar la demo/ })[0]?.getAttribute("href")).toBe("/demo");
    expect(screen.getAllByRole("link", { name: /Ver el código/ })[0]?.getAttribute("href")).toBe(
      "https://github.com/emilianooferreyra/owezy",
    );
  });
});
