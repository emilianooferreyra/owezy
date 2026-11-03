import { routeAuth } from "eve/channels/auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatAuth } from "./chat-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("chatAuth", () => {
  it("lets an anonymous browser chat with the deployed demo, so judges can try it without an account", async () => {
    // A Vercel production deployment: not eve dev, not vercel dev.
    vi.stubEnv("EVE_DEV", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");

    const result = await routeAuth(new Request("https://demo.test/eve/v1/session", { method: "POST" }), chatAuth);

    expect(result).not.toBeInstanceOf(Response);
  });
});
