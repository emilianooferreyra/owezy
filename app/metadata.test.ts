import { describe, expect, it, vi } from "vitest";
import { metadata as rootMetadata } from "./layout";

// next/font only works inside the Next.js compiler; the layout's fonts are not under test here.
vi.mock("next/font/google", () => ({
  DM_Sans: () => ({ variable: "font-sans" }),
  Geist_Mono: () => ({ variable: "font-mono" }),
}));
import { metadata as demoMetadata } from "./demo/page";
import { metadata as payMetadata } from "./pay/[id]/page";

describe("metadata", () => {
  it("never lets search engines index a payment link: it carries a customer's charge", () => {
    expect(payMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("gives every page its own title inside the app's title template", () => {
    expect(rootMetadata.title).toMatchObject({ template: "%s · Owezy" });
    expect(demoMetadata.title).toBe("Demo");
    expect(payMetadata.title).toBe("Pagar");
  });
});
