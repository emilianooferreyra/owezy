import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonFile, writeJsonFile } from "../../../core/storage/json-file";
import { ambiguousPayment, matchedPayment, unmatchedPayment } from "../domain/activity";
import { aCharge, aTransfer, UNIT } from "../testing/fixtures";
import { FileActivityLog } from "./file-activity-log";

const RECORDED_AT = "2026-10-20T12:00:00.000Z";

describe("FileActivityLog", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "activity-"));
    file = join(dir, "activity.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("starts empty when the file does not exist yet", async () => {
    expect(await new FileActivityLog(file).list()).toEqual([]);
  });

  it("keeps every kind of entry with every field, including exact amounts JSON cannot hold as a number", async () => {
    const transfer = aTransfer({ id: "tx-1", amount: { amount: 42_500n * UNIT + 1n, currency: "wARS" } });
    const entries = [
      matchedPayment(transfer, aCharge({ id: "C-0007", customer: "Martina" }), RECORDED_AT),
      unmatchedPayment(aTransfer({ id: "tx-2" }), RECORDED_AT),
      ambiguousPayment(aTransfer({ id: "tx-3" }), [aCharge({ id: "C-0001" }), aCharge({ id: "C-0002" })], RECORDED_AT),
    ];

    await new FileActivityLog(file).record(entries);

    expect(await new FileActivityLog(file).list()).toEqual(entries);
  });

  it("shares the activity between instances, as the agent and the web app do", async () => {
    const entry = unmatchedPayment(aTransfer({ id: "tx-1" }), RECORDED_AT);

    await new FileActivityLog(file).record([entry]);

    expect(await new FileActivityLog(file).list()).toEqual([entry]);
  });

  it("keeps one entry when a batch repeats an id", async () => {
    const entry = unmatchedPayment(aTransfer({ id: "tx-1" }), RECORDED_AT);

    await new FileActivityLog(file).record([entry, entry]);

    expect(await new FileActivityLog(file).list()).toEqual([entry]);
  });

  it("appends new entries and keeps the first of each id, so repeated runs never duplicate one", async () => {
    const log = new FileActivityLog(file);
    const first = unmatchedPayment(aTransfer({ id: "tx-1" }), RECORDED_AT);
    const second = unmatchedPayment(aTransfer({ id: "tx-2" }), RECORDED_AT);
    await log.record([first]);

    await log.record([unmatchedPayment(aTransfer({ id: "tx-1" }), "2026-10-20T12:05:00.000Z"), second]);

    expect(await log.list()).toEqual([first, second]);
  });

  it("does not touch the file when there is nothing new", async () => {
    await new FileActivityLog(file).record([]);

    expect(await readJsonFile<unknown>(file, "no file")).toBe("no file");
  });

  describe("with entries damaged by hand", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("skips a damaged entry and warns, instead of failing every read", async () => {
      const entry = unmatchedPayment(aTransfer({ id: "tx-2" }), RECORDED_AT);
      await new FileActivityLog(file).record([entry]);
      const [stored] = await readJsonFile<unknown[]>(file, []);
      await writeJsonFile(file, [{ id: "payment-unmatched:tx-1", kind: "payment-unmatched" }, stored]);

      expect(await new FileActivityLog(file).list()).toEqual([entry]);
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it("keeps a damaged entry in the file when recording another, so nothing is lost silently", async () => {
      const damaged = { id: "payment-unmatched:tx-1", kind: "payment-unmatched" };
      await writeJsonFile(file, [damaged]);

      await new FileActivityLog(file).record([unmatchedPayment(aTransfer({ id: "tx-2" }), RECORDED_AT)]);

      expect((await readJsonFile<unknown[]>(file, []))[0]).toEqual(damaged);
    });

    it("reads nothing from a file that is not a list, and refuses to overwrite it", async () => {
      await writeJsonFile(file, { not: "a list" });
      const log = new FileActivityLog(file);

      expect(await log.list()).toEqual([]);
      await expect(log.record([unmatchedPayment(aTransfer(), RECORDED_AT)])).rejects.toThrow(/not a list/);
      expect(await readJsonFile<unknown>(file, undefined)).toEqual({ not: "a list" });
    });

    it("never fails when there is nothing to record, so a damaged file cannot break every reconciliation", async () => {
      await writeJsonFile(file, { not: "a list" });

      await expect(new FileActivityLog(file).record([])).resolves.toBeUndefined();
    });
  });
});
