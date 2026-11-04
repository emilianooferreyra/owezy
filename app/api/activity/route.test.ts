import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The route reads its configuration from the environment once per process, so each test points
// DATA_DIR at a fresh folder and reloads the modules.
async function loadRoute() {
  vi.resetModules();
  const charges = await import("@/features/charges");
  const route = await import("./route");
  return { feature: charges.chargesRuntime().feature, route };
}

describe("GET /api/activity (simulated mode)", () => {
  let dir: string;

  beforeAll(async () => {
    await import("./route");
  }, 30_000);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "activity-route-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("PAYMENTS_MODE", "simulated");
    vi.stubEnv("APP_URL", "http://localhost:3000");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("lists what the agent reconciled on its own", async () => {
    const { feature, route } = await loadRoute();
    await feature.createCharge({
      requestId: "session-1:turn-1",
      customer: "Juan Pérez",
      description: "2 docenas de medialunas",
      amount: "85000",
    });
    await feature.simulatePayment("C-0001");

    const response = await route.GET(new Request("http://localhost/api/activity"));

    expect(response.status).toBe(200);
    expect((await response.json()).activity).toMatchObject([
      { kind: "payment-matched", chargeId: "C-0001", customer: "Juan Pérez", amount: "85000", currency: "wARS" },
    ]);
  });

  it("only reads: it never reconciles, so polling it costs no chain reads", async () => {
    const { feature, route } = await loadRoute();
    const sync = vi.spyOn(feature, "syncPayments");

    await route.GET(new Request("http://localhost/api/activity"));

    expect(sync).not.toHaveBeenCalled();
  });
  it("rejects a currency the app does not know", async () => {
    const { route } = await loadRoute();

    const response = await route.GET(new Request("http://localhost/api/activity?currency=USD"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown-currency" });
  });

  it("shows only the Brazilian shop's activity when asked in reais", async () => {
    const { feature, route } = await loadRoute();
    const charge = await feature.createCharge({ requestId: "t1", customer: "João", description: "pão", amount: "20", currency: "wBRL" });
    await feature.simulatePayment(charge.id);

    const brazil = await (await route.GET(new Request("http://localhost/api/activity?currency=wBRL"))).json();
    const argentina = await (await route.GET(new Request("http://localhost/api/activity"))).json();

    expect(brazil.activity.length).toBeGreaterThan(0);
    expect(brazil.activity.every(({ currency }: { currency: string }) => currency === "wBRL")).toBe(true);
    expect(argentina.activity).toEqual([]);
  });
});
