import { describe, expect, it } from "vitest";
import { AR, BR, shopContext, shopFor, shopOfCurrency, timeZoneOf } from "./shops";

describe("shopFor", () => {
  it("opens the Brazilian shop for a Portuguese visitor and the Argentine one for everyone else", () => {
    expect(shopFor("pt-BR")).toBe(BR);
    expect(shopFor("es-AR")).toBe(AR);
    expect(shopFor("en")).toBe(AR);
  });

  it("lets ?country= choose the shop, so a link can show either country", () => {
    expect(shopFor("pt-BR", "AR")).toBe(AR);
    expect(shopFor("en", "br")).toBe(BR);
    expect(shopFor("es-AR", ["BR", "AR"])).toBe(BR);
  });

  it("ignores a country the demo does not have", () => {
    expect(shopFor("pt-BR", "MX")).toBe(BR);
  });
});

describe("shops", () => {
  it("are Ana's bakery in pesos and Bia's in reais, named in their own language", () => {
    expect(AR).toMatchObject({ country: "AR", currency: "wARS", name: "Panadería de Ana", owner: "Ana" });
    expect(BR).toMatchObject({ country: "BR", currency: "wBRL", name: "Padaria da Bia", owner: "Bia" });
  });

  it("find the shop and time zone of a currency", () => {
    expect(shopOfCurrency("wBRL")).toBe(BR);
    expect(timeZoneOf("wBRL")).toBe("America/Sao_Paulo");
    expect(timeZoneOf("wARS")).toBe("America/Argentina/Buenos_Aires");
  });

  it("tell the agent the shop and the language of the page", () => {
    expect(shopContext(BR, "en")).toEqual({
      shop: { country: "BR", currency: "wBRL", name: "Padaria da Bia", owner: "Bia" },
      language: "en",
    });
  });
});
