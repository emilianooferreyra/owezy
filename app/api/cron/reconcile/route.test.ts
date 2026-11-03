import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-cron-secret";

// The route reads its configuration from the environment once per process, so each test points
// DATA_DIR at a fresh folder and reloads the modules.
async function loadRoute() {
  vi.resetModules();
  const charges = await import("@/features/charges");
  const route = await import("./route");
  return { feature: charges.chargesRuntime().feature, route };
}

function call(authorization?: string) {
  return new Request("http://localhost/api/cron/reconcile", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("POST /api/cron/reconcile", () => {
  let dir: string;

  beforeAll(async () => {
    await import("./route");
  }, 30_000);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cron-route-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("PAYMENTS_MODE", "simulated");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("reconciles a payment that arrived while nobody was looking", async () => {
    const { feature, route } = await loadRoute();
    await feature.createCharge({
      requestId: "session-1:turn-1",
      customer: "Juan Pérez",
      description: "2 docenas de medialunas",
      amount: "85000",
    });
    // The payer's transfer lands after the charge, without the app reconciling it, as a real one would.
    await writeFile(
      join(dir, "simulated-transfers.json"),
      JSON.stringify([
        {
          id: "simulated-1",
          amount: { amount: (85_000n * 10n ** 18n).toString(), currency: "wARS" },
          receivedAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ]),
    );

    const response = await route.POST(call(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect((await feature.listActivity({}))[0]).toMatchObject({ kind: "payment-matched", chargeId: "C-0001" });
  });

  it.each([undefined, "Bearer wrong-secret", SECRET, `Basic ${SECRET}`])(
    "refuses a caller without the secret (authorization: %j) and reconciles nothing",
    async (authorization) => {
      const { feature, route } = await loadRoute();
      const sync = vi.spyOn(feature, "syncPayments");

      const response = await route.POST(call(authorization));

      expect(response.status).toBe(401);
      expect(sync).not.toHaveBeenCalled();
    },
  );

  it("stays off until a secret is configured, so nobody can trigger it on an unprotected deployment", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { feature, route } = await loadRoute();
    const sync = vi.spyOn(feature, "syncPayments");

    const response = await route.POST(call("Bearer "));

    expect(response.status).toBe(503);
    expect(sync).not.toHaveBeenCalled();
  });
});
