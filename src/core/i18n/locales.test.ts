import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, format, hasLocale, localePath, negotiateLocale, switchLocale } from "./locales";

describe("locales", () => {
  it("speaks Rioplatense Spanish by default", () => {
    expect(DEFAULT_LOCALE).toBe("es-AR");
    expect(negotiateLocale(null)).toBe("es-AR");
    expect(negotiateLocale("fr-FR,fr;q=0.9")).toBe("es-AR");
  });

  it("picks the visitor's language from the browser, by preference order", () => {
    expect(negotiateLocale("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("fr;q=0.9,en;q=0.5,pt;q=0.8")).toBe("pt-BR");
  });

  it("matches the language when the region differs", () => {
    expect(negotiateLocale("pt-PT")).toBe("pt-BR");
    expect(negotiateLocale("es-MX")).toBe("es-AR");
    expect(negotiateLocale("EN-gb")).toBe("en");
  });

  it("knows which path segments are locales", () => {
    expect(hasLocale("pt-BR")).toBe(true);
    expect(hasLocale("pt")).toBe(false);
  });

  it("builds a page's path in a locale, and the same page in another one", () => {
    expect(localePath("es-AR")).toBe("/es-AR");
    expect(localePath("pt-BR", "/demo")).toBe("/pt-BR/demo");
    expect(switchLocale("/es-AR/how-it-works", "en")).toBe("/en/how-it-works");
    expect(switchLocale("/pt-BR", "es-AR")).toBe("/es-AR");
    expect(switchLocale("/pay/C-0001", "pt-BR")).toBe("/pt-BR/pay/C-0001");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(format("Cobrar a {name}", { name: "Juan" })).toBe("Cobrar a Juan");
    expect(format("{a} y {b}", { a: 1 })).toBe("1 y {b}");
  });
});
