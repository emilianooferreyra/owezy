import { groq } from "@ai-sdk/groq";
import { defineAgent } from "eve";

export default defineAgent({
  // Called directly through Groq (reads GROQ_API_KEY), not through the AI Gateway.
  model: groq("openai/gpt-oss-120b"),
  // The window Groq's free tier actually serves, not the model's 131K: it rejects any request over
  // 8000 tokens per minute. eve compacts from this value, so a long chat stays under the limit.
  modelContextWindowTokens: 8_000,
  // Compact early: the answer and its reasoning also count toward Groq's per-request limit.
  compaction: { thresholdPercent: 0.6 },
  reasoning: "high",
  // Only the authored tools: no bash, web or file tools. Keeps the agent on
  // collections and each request under Groq's free-tier limit of 8K tokens per minute.
  defaultTools: false,
});
