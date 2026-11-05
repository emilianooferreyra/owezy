import { describe, expect, it } from "vitest";
import type { ActivityView } from "../charges-feature";
import { EMPTY_NOTICES, trackPaymentNotices } from "./payment-notices";

const paid = (transfer: string, customer: string, chargeId: string, recordedAt: string): ActivityView => ({
  id: `payment-matched:${transfer}`,
  kind: "payment-matched",
  transferId: transfer,
  amount: "28000",
  currency: "wARS",
  receivedAt: recordedAt,
  recordedAt,
  chargeId,
  customer,
});

const unmatched: ActivityView = {
  id: "payment-unmatched:tx-9",
  kind: "payment-unmatched",
  transferId: "tx-9",
  amount: "100",
  currency: "wARS",
  receivedAt: "2026-11-04T10:00:00.000Z",
  recordedAt: "2026-11-04T10:00:00.000Z",
};

const OLD = paid("tx-1", "Martina Gómez", "C-0001", "2026-11-04T09:00:00.000Z");

describe("trackPaymentNotices", () => {
  it("does not announce payments that were already there when the chat opened", () => {
    const state = trackPaymentNotices(EMPTY_NOTICES, [OLD], 0);

    expect(state.notices).toEqual([]);
  });

  it("announces a payment that arrives while the chat is open, after the messages there were then", () => {
    const opened = trackPaymentNotices(EMPTY_NOTICES, [OLD], 0);
    const carlos = paid("tx-2", "Carlos Ruiz", "C-0002", "2026-11-04T11:00:00.000Z");

    const state = trackPaymentNotices(opened, [carlos, OLD], 3);

    expect(state.notices).toEqual([
      { id: carlos.id, customer: "Carlos Ruiz", chargeId: "C-0002", amount: "28000", currency: "wARS", afterMessage: 3 },
    ]);
  });

  it("announces each payment once, keeping where it first appeared", () => {
    const opened = trackPaymentNotices(EMPTY_NOTICES, [], 0);
    const carlos = paid("tx-2", "Carlos Ruiz", "C-0002", "2026-11-04T11:00:00.000Z");
    const first = trackPaymentNotices(opened, [carlos], 1);

    const again = trackPaymentNotices(first, [carlos], 5);

    expect(again).toBe(first);
  });

  it("announces several new payments oldest first, and only payments that paid a charge", () => {
    const opened = trackPaymentNotices(EMPTY_NOTICES, [], 0);
    const later = paid("tx-3", "Lucía", "C-0003", "2026-11-04T12:00:00.000Z");
    const earlier = paid("tx-2", "Carlos Ruiz", "C-0002", "2026-11-04T11:00:00.000Z");

    const state = trackPaymentNotices(opened, [later, unmatched, earlier], 2);

    expect(state.notices.map((notice) => notice.customer)).toEqual(["Carlos Ruiz", "Lucía"]);
  });

  it("waits for the first read of the activity before deciding what is old", () => {
    expect(trackPaymentNotices(EMPTY_NOTICES, undefined, 4)).toBe(EMPTY_NOTICES);
  });
});
