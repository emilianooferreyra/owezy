import { type AuthFn, ForbiddenError } from "eve/channels/auth";
import type { DailyBudget } from "./daily-budget";
import { DAILY_BUDGET_EXHAUSTED } from "./daily-budget-exhausted";

// The requests that start model calls: creating a session (POST /session), a follow-up or an
// approval answer (POST /session/:id), and compacting (POST /session/:id/compact), which summarizes
// the chat with the model. Streams, cancel, clear and reset spend no tokens. The router ignores one
// trailing slash, so the match does too.
const MODEL_PATH = /\/session(\/[^/]+(\/compact)?)?$/;

function spendsTokens(request: Request): boolean {
  return request.method === "POST" && MODEL_PATH.test(new URL(request.url).pathname.replace(/\/+$/, ""));
}

/**
 * The first step of the chat's auth walk: rejects a new message once the day's model budget is
 * spent, and otherwise skips to the next step, so it never admits anyone by itself.
 */
export function dailyBudgetGate(budget: () => DailyBudget): AuthFn<Request> {
  return async (request) => {
    if (!spendsTokens(request)) {
      return null;
    }
    if (await budget().isExhausted()) {
      throw new ForbiddenError({
        code: DAILY_BUDGET_EXHAUSTED,
        message: "The demo reached today's model budget. Please try again tomorrow.",
      });
    }
    return null;
  };
}
