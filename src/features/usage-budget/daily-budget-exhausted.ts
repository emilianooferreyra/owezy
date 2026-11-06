/** The code the chat answers with once the day's model budget is spent. The demo shows its own copy for it. */
export const DAILY_BUDGET_EXHAUSTED = "daily_budget_exhausted";

/** Whether a chat error is the chat refusing a message because the day's budget is spent. */
export function isDailyBudgetExhausted(error: Error): boolean {
  return (error as Error & { code?: unknown }).code === DAILY_BUDGET_EXHAUSTED;
}
