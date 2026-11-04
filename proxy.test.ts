import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

const request = (path: string, acceptLanguage?: string) =>
  new NextRequest(`https://getowezy.vercel.app${path}`, {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });

describe("proxy", () => {
  it("sends a path without locale to Spanish when the browser says nothing", () => {
    const response = proxy(request("/demo"));

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://getowezy.vercel.app/es-AR/demo");
  });

  it("sends the visitor to their browser's language, keeping the query", () => {
    const response = proxy(request("/pay/C-0001?ref=wa", "pt-BR,pt;q=0.9"));

    expect(response?.headers.get("location")).toBe("https://getowezy.vercel.app/pt-BR/pay/C-0001?ref=wa");
  });

  it("sends the home page to the locale's home", () => {
    expect(proxy(request("/", "en-US"))?.headers.get("location")).toBe("https://getowezy.vercel.app/en");
  });

  it("leaves a path that already has its locale alone", () => {
    expect(proxy(request("/en/how-it-works", "pt-BR"))).toBeUndefined();
  });

  it("never runs on the API, the agent, the generated icons or public files", () => {
    const matcher = new RegExp(`^${config.matcher[0]?.replace("/((?!", "/(?!(?:").replace(").*)", ")).*")}$`);
    for (const path of ["/api/ledger", "/eve/v1/sessions", "/agent.json", "/_next/static/x.js", "/icon", "/apple-icon"]) {
      expect(matcher.test(path), path).toBe(false);
    }
    expect(matcher.test("/demo")).toBe(true);
  });
});
