import { defineInstrumentation } from "eve/instrumentation";
import { dailyBudgetRuntime } from "../../src/features/usage-budget/usage-budget-config";

/**
 * Adds every model call's tokens to the day's budget that the chat's auth walk checks. It needs
 * only usage, never prompts or answers, so this file receives no content.
 */
export default defineInstrumentation({
  tracePolicy: () => ({ emit: true, recordInputs: false, recordOutputs: false }),
  events: {
    "model.call.completed": async (event) => {
      try {
        await dailyBudgetRuntime().record(event.idempotencyKey, event.usage);
      } catch (error) {
        // A missed record must not fail the reply the visitor already has; the margin under
        // Groq's daily limit covers a few uncounted calls.
        console.error("Could not record model usage", error);
      }
    },
  },
});
