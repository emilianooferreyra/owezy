import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { ledgerRepositoryContract } from "../testing/ledger-repository-contract";
import { FileLedgerRepository } from "./file-ledger-repository";

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

ledgerRepositoryContract("FileLedgerRepository", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ledger-"));
  dirs.push(dir);
  return new FileLedgerRepository(join(dir, "ledger.json"));
});
