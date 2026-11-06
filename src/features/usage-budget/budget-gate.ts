import { type AuthFn, ForbiddenError } from "eve/channels/auth";
import type { DailyBudget } from "./daily-budget";
import { DAILY_BUDGET_EXHAUSTED } from "./daily-budget-exhausted";

// Creating a session (POST /session) or sending a follow-up (POST /session/:id) are the requests
// that start model calls. Streams, cancel and the other session commands spend no tokens.
const MESSAGE_PATH = /\/session(\/[^/]+)?$/;

/**
 * The first step of the chat's auth walk: rejects a new message once the day's model budget is
 * spent, and otherwise skips to the next step, so it never admits anyone by itself.
 */
export function dailyBudgetGate(budget: () => DailyBudget): AuthFn<Request> {
  return async (request) => {
    if (request.method !== "POST" || !MESSAGE_PATH.test(new URL(request.url).pathname)) {
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
