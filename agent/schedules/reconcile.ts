import { defineSchedule } from "eve/schedules";
import { chargesRuntime, reconcileOnSchedule } from "../../src/features/charges";

// The agent reconciles on its own every 15 minutes, with no model call: each outcome lands in the
// activity log. `eve dev` never fires crons; trigger it with
// curl -X POST http://localhost:2000/eve/v1/dev/schedules/reconcile
export default defineSchedule({
  cron: "*/15 * * * *",
  async run() {
    await reconcileOnSchedule(chargesRuntime().feature, console);
  },
});
