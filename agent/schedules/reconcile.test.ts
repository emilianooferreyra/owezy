import { describe, expect, it } from "vitest";
import schedule from "./reconcile";

describe("reconcile schedule", () => {
  it("runs at most once a day, the limit Vercel Hobby enforces at deploy time", () => {
    // A fixed minute and hour with any day: "M H * * *". Steps, lists or ranges in the first two
    // fields would run more often and make the deploy fail.
    expect(schedule.cron).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
});
