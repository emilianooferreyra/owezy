import { type AuthFn, localDev, none, vercelOidc } from "eve/channels/auth";
import { dailyBudgetGate } from "../../features/usage-budget/budget-gate";
import type { DailyBudget } from "../../features/usage-budget/daily-budget";
import { dailyBudgetRuntime } from "../../features/usage-budget/usage-budget-config";

/**
 * Who may talk to the agent. The deployed demo is public: anyone with the link can chat and create
 * charges, so judges can try it without an account. That is safe because the agent never moves
 * money. What a visitor can spend is Groq's daily quota, which every visitor shares, so the walk
 * starts with the day's model budget: once it is spent, new messages are refused until tomorrow.
 * `none()` must stay last.
 */
export function chatAuthWith(budget: () => DailyBudget): AuthFn<Request>[] {
  return [dailyBudgetGate(budget), vercelOidc(), localDev(), none()];
}

export const chatAuth = chatAuthWith(dailyBudgetRuntime);
