import { describe, expect, it } from "vitest";
import type { ActivityView } from "../charges-feature";
import { activityLine, parseActivity } from "./activity-model";

const base = {
  transferId: "tx-1",
  amount: "85000.01",
  currency: "wARS",
  receivedAt: "2026-10-17T17:05:00.000Z",
  recordedAt: "2026-10-17T17:15:00.000Z",
} as const;

const matched: ActivityView = {
  ...base,
  id: "payment-matched:tx-1",
  kind: "payment-matched",
  chargeId: "C-0001",
  customer: "Juan Pérez",
};
const unmatched: ActivityView = { ...base, id: "payment-unmatched:tx-1", kind: "payment-unmatched" };
const ambiguous: ActivityView = {
  ...base,
  id: "payment-ambiguous:tx-1",
  kind: "payment-ambiguous",
  chargeIds: ["C-0001", "C-0002"],
};

describe("activityLine", () => {
  it("tells the owner which charge a payment paid, in pesos and Argentine time", () => {
    expect(activityLine(matched)).toEqual({
      time: "14:05",
      text: "Juan Pérez pagó el cobro C-0001 ($85.000,01)",
      needsOwner: false,
    });
  });

  it("asks the owner to look at a payment that matches no charge", () => {
    expect(activityLine(unmatched)).toEqual({
      time: "14:05",
      text: "Llegó un pago de $85.000,01 que no coincide con ningún cobro",
      needsOwner: true,
    });
  });

  it("asks the owner to choose when a payment matches several charges", () => {
    expect(activityLine(ambiguous)).toEqual({
      time: "14:05",
      text: "Llegó un pago de $85.000,01 que puede ser de C-0001 o C-0002: elegí vos cuál",
      needsOwner: true,
    });
  });
});

describe("activityLine for a Brazilian shop", () => {
  const brazilian = { ...base, currency: "wBRL", amount: "850" };

  it("shows reais and São Paulo time, in the page's language", () => {
    expect(activityLine({ ...matched, ...brazilian, customer: "João Silva" }, "pt-BR")).toEqual({
      time: "14:05",
      text: "João Silva pagou a cobrança C-0001 (R$ 850)",
      needsOwner: false,
    });
    expect(activityLine({ ...ambiguous, ...brazilian }, "en")).toEqual({
      time: "14:05",
      text: "A payment of R$ 850 arrived that could be C-0001 or C-0002: please choose which",
      needsOwner: true,
    });
  });

  it("reads the time in the shop's own time zone", () => {
    const winter = "2026-07-01T12:00:00.000Z";
    // Buenos Aires and São Paulo are both UTC-3 all year: the zone comes from the currency anyway.
    expect(activityLine({ ...unmatched, ...brazilian, receivedAt: winter }, "pt-BR").time).toBe("09:00");
  });
});

describe("parseActivity", () => {
  it("reads the route's answer", () => {
    expect(parseActivity({ activity: [matched, unmatched] })).toEqual([matched, unmatched]);
  });

  it.each([
    ["no body", undefined],
    ["no activity list", { error: "boom" }],
    ["an entry of an unknown kind", { activity: [{ ...base, id: "x", kind: "refund" }] }],
  ])("returns undefined for %s, so a bad answer never breaks the panel", (_case, body) => {
    expect(parseActivity(body)).toBeUndefined();
  });
});
