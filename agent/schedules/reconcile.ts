import { defineSchedule } from "eve/schedules";
import { chargesRuntime, reconcileOnSchedule } from "../../src/features/charges";

// The agent reconciles on its own, with no model call: each outcome lands in the activity log.
// Once a day (12:00 UTC, 09:00 in Argentina) because Vercel Hobby rejects more frequent crons; a
// GitHub Actions workflow calls /api/cron/reconcile every 15 minutes in between. `eve dev` never
// fires crons; trigger it with
// curl -X POST http://localhost:3000/eve/v1/dev/schedules/reconcile
export default defineSchedule({
  cron: "0 12 * * *",
  async run() {
    await reconcileOnSchedule(chargesRuntime().feature, console);
  },
});
