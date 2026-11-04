import { describe, expect, it, vi } from "vitest";
import { pageProps } from "@/core/i18n/testing";
import { generateMetadata as layoutMetadata } from "./layout";

// next/font only works inside the Next.js compiler; the layout's fonts are not under test here.
vi.mock("next/font/google", () => ({
  DM_Sans: () => ({ variable: "font-sans" }),
  Geist_Mono: () => ({ variable: "font-mono" }),
}));
import { generateMetadata as demoMetadata } from "./demo/page";
import { generateMetadata as payMetadata } from "./pay/[id]/page";

describe("metadata", () => {
  it("never lets search engines index a payment link: it carries a customer's charge", async () => {
    expect((await payMetadata(pageProps("es-AR", { id: "C-0001" }))).robots).toEqual({ index: false, follow: false });
  });

  it("gives every page its own title inside the app's title template", async () => {
    expect((await layoutMetadata({ params: Promise.resolve({ lang: "es-AR" }), children: null })).title).toMatchObject({
      template: "%s · Owezy",
    });
    expect((await demoMetadata(pageProps("es-AR"))).title).toBe("Demo");
    expect((await payMetadata(pageProps("es-AR", { id: "C-0001" }))).title).toBe("Pagar");
  });

  it("titles and describes pages in the visitor's language", async () => {
    expect((await payMetadata(pageProps("pt-BR", { id: "C-0001" }))).title).toBe("Pagar");
    expect((await payMetadata(pageProps("en", { id: "C-0001" }))).title).toBe("Pay");
    expect((await layoutMetadata({ params: Promise.resolve({ lang: "en" }), children: null })).description).toMatch(
      /collections assistant/,
    );
  });
});
