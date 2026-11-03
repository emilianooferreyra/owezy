import { describe, expect, it } from "vitest";
import agent from "./agent";

// Groq's free tier rejects any single request over 8000 tokens per minute ("Request too large").
const GROQ_FREE_TIER_TOKENS_PER_REQUEST = 8_000;

describe("agent", () => {
  it("compacts the conversation before a request outgrows Groq's free-tier limit", () => {
    const config = agent as unknown as { modelContextWindowTokens?: number };

    expect(config.modelContextWindowTokens).toBeLessThanOrEqual(GROQ_FREE_TIER_TOKENS_PER_REQUEST);
  });
});
