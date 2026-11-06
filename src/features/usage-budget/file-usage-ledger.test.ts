import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileUsageLedger } from "./file-usage-ledger";
import { usageLedgerContract } from "./usage-ledger-contract";

const directories: string[] = [];

async function freshPath() {
  const directory = await mkdtemp(join(tmpdir(), "usage-ledger-"));
  directories.push(directory);
  return join(directory, "model-usage.json");
}

async function freshLedger() {
  return new FileUsageLedger(await freshPath());
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("FileUsageLedger", () => {
  usageLedgerContract(freshLedger);

  it("keeps the day's total across instances, as a restarted dev server would", async () => {
    const path = await freshPath();
    await new FileUsageLedger(path).record("call-1", "2026-11-06", 1_200);

    expect(await new FileUsageLedger(path).spentOn("2026-11-06")).toBe(1_200);
  });
});
