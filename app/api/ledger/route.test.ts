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

describe("GET /api/ledger (simulated mode)", () => {
  let dir: string;

  beforeAll(async () => {
    await import("./route");
  }, 30_000);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ledger-route-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("PAYMENTS_MODE", "simulated");
    vi.stubEnv("APP_URL", "http://localhost:3000");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("returns who owes what and the shop's total", async () => {
    const { feature, route } = await loadRoute();
    await feature.addToLedger({ requestId: "seed:1", customer: "Juan Pérez", description: "torta", amount: "30000" });

    const response = await route.GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.totalOwed).toBe("30000");
    expect(body.customers).toMatchObject([{ customer: "Juan Pérez", owed: "30000", unbilled: "30000" }]);
  });

  it("returns an empty ledger before anything is written down", async () => {
    const { route } = await loadRoute();

    expect(await (await route.GET()).json()).toEqual({ customers: [], totalOwed: "0" });
  });
});
