// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import type { ActivityView } from "../charges-feature";
import { ACTIVITY_POLL_INTERVAL_MS, ActivityPanel } from "./activity-panel";

const matched: ActivityView = {
  id: "payment-matched:tx-1",
  kind: "payment-matched",
  transferId: "tx-1",
  amount: "85000",
  currency: "wARS",
  receivedAt: "2026-10-17T17:05:00.000Z",
  recordedAt: "2026-10-17T17:15:00.000Z",
  chargeId: "C-0001",
  customer: "Juan Pérez",
};
const unmatched: ActivityView = {
  id: "payment-unmatched:tx-2",
  kind: "payment-unmatched",
  transferId: "tx-2",
  amount: "1200",
  currency: "wARS",
  receivedAt: "2026-10-17T17:20:00.000Z",
  recordedAt: "2026-10-17T17:30:00.000Z",
};

function stubActivityEndpoint(answers: (() => Response)[]) {
  const fetch = vi.fn(async () => (answers.length > 1 ? answers.shift() : answers[0])?.() ?? Response.json({}));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ActivityPanel", () => {
  it("shows what the agent reconciled on its own, flagging what needs the owner", async () => {
    stubActivityEndpoint([() => Response.json({ activity: [unmatched, matched] })]);

    render(<ActivityPanel />);
    await settle();

    const items = within(screen.getByRole("list", { name: "Actividad del agente" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "14:20Llegó un pago de $1.200 que no coincide con ningún cobroRevisar",
      "14:05Juan Pérez pagó el cobro C-0001 ($85.000)",
    ]);
  });

  it("says so when the agent has not reconciled anything yet", async () => {
    stubActivityEndpoint([() => Response.json({ activity: [] })]);

    render(<ActivityPanel />);
    await settle();

    expect(screen.getByText("Todavía no concilié ningún pago.")).toBeTruthy();
  });

  it("polls, so a payment reconciled in the background shows up without reloading", async () => {
    const fetch = stubActivityEndpoint([
      () => Response.json({ activity: [] }),
      () => Response.json({ activity: [matched] }),
    ]);

    render(<ActivityPanel />);
    await settle();
    await settle(ACTIVITY_POLL_INTERVAL_MS);

    expect(fetch).toHaveBeenCalledWith("/api/activity?currency=wARS", expect.anything());
    expect(screen.getByText("Juan Pérez pagó el cobro C-0001 ($85.000)")).toBeTruthy();
  });

  it("keeps the last list it had when a poll fails", async () => {
    stubActivityEndpoint([
      () => Response.json({ activity: [matched] }),
      () => Response.json({ error: "boom" }, { status: 500 }),
    ]);

    render(<ActivityPanel />);
    await settle();
    await settle(ACTIVITY_POLL_INTERVAL_MS);

    expect(screen.getByText("Juan Pérez pagó el cobro C-0001 ($85.000)")).toBeTruthy();
  });

  it("reads only the shop's country: a Brazilian shop asks for wBRL and sees reais", async () => {
    const fetch = stubActivityEndpoint([
      () => Response.json({ activity: [{ ...matched, currency: "wBRL", amount: "850", customer: "João Silva" }] }),
    ]);

    render(<ActivityPanel currency="wBRL" />);
    await settle();

    expect(fetch).toHaveBeenCalledWith("/api/activity?currency=wBRL", expect.anything());
    expect(screen.getByText("João Silva pagó el cobro C-0001 (R$ 850)")).toBeTruthy();
  });

  it("speaks the page's language", async () => {
    stubActivityEndpoint([() => Response.json({ activity: [] })]);

    render(
      <I18nProvider locale="en">
        <ActivityPanel />
      </I18nProvider>,
    );
    await settle();

    expect(screen.getByRole("heading", { name: "What I did on my own" })).toBeTruthy();
    expect(screen.getByText("No payments reconciled yet.")).toBeTruthy();
  });

  it("stops polling once it is gone", async () => {
    const fetch = stubActivityEndpoint([() => Response.json({ activity: [] })]);

    const { unmount } = render(<ActivityPanel />);
    await settle();
    unmount();
    const calls = fetch.mock.calls.length;
    await settle(ACTIVITY_POLL_INTERVAL_MS * 3);

    expect(fetch.mock.calls.length).toBe(calls);
  });
});
