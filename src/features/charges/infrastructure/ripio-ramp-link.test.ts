import { describe, expect, it } from "vitest";
import { type Currency, money } from "../../../core/money/money";
import { aCharge } from "../testing/fixtures";
import { ripioRampLinkBuilder, UnsupportedRampCurrencyError } from "./ripio-ramp-link";

const UNIT = 10n ** 18n;
const RECIPIENT = "0x000000000000000000000000000000000000dEaD";

describe("ripioRampLinkBuilder", () => {
  it("builds an on-ramp link to the recipient with the amount in whole pesos", () => {
    const buildLink = ripioRampLinkBuilder({ recipient: RECIPIENT });
    const charge = aCharge({ id: "C-0123", amount: money(85_000n * UNIT, "wARS") });

    // Format from the organizer's Builder Session slides (docs/hackathon-ideas.md).
    expect(buildLink(charge)).toBe(
      `https://ramp.ripio.com/?country=AR&chain=42220&token=WARS&amount=85000&address=${RECIPIENT}`,
    );
  });

  it("builds the Brazilian on-ramp link for a charge in reais", () => {
    const buildLink = ripioRampLinkBuilder({ recipient: RECIPIENT });
    const charge = aCharge({ id: "C-0124", amount: money(850n * UNIT, "wBRL") });

    expect(buildLink(charge)).toBe(
      `https://ramp.ripio.com/?country=BR&chain=42220&token=WBRL&amount=850&address=${RECIPIENT}`,
    );
  });

  it("refuses to build a link for a currency the ramp is not configured for", () => {
    const buildLink = ripioRampLinkBuilder({ recipient: RECIPIENT });
    // Forged after creation: the domain itself refuses a currency the app does not know.
    const charge = { ...aCharge({ id: "C-0123" }), amount: money(500n * UNIT, "wXYZ" as Currency) };

    expect(() => buildLink(charge)).toThrow(UnsupportedRampCurrencyError);
  });
});
