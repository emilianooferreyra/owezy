import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonFile, writeJsonFile } from "../../../core/storage/json-file";
import { applyPayment, type Charge, newestFirst } from "../domain/charge";
import { chargeDiscardContract } from "../testing/charge-repository-discard-contract";
import { aCharge, aTransfer, UNIT } from "../testing/fixtures";
import { FileChargeRepository, UNKNOWN_CREATION_TIME } from "./file-charge-repository";

describe("FileChargeRepository", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "charges-"));
    file = join(dir, "charges.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("starts empty when the file does not exist yet", async () => {
    const repository = new FileChargeRepository(file);

    expect(await repository.list()).toEqual([]);
    expect(await repository.findById("C-0001")).toBeUndefined();
  });

  it("keeps every field, including the exact amount in base units that JSON cannot hold as a number", async () => {
    const charge = aCharge({ amount: { amount: 85_000n * UNIT + 1n, currency: "wARS" }, idempotencyKey: "key-1" });
    const paid = applyPayment(charge, aTransfer({ amount: charge.amount }));

    await new FileChargeRepository(file).save(paid);

    expect(await new FileChargeRepository(file).findById("C-0001")).toEqual(paid);
  });

  it("finds a charge by the request that created it", async () => {
    const charge = aCharge({ idempotencyKey: "key-1" });
    await new FileChargeRepository(file).save(charge);

    expect(await new FileChargeRepository(file).findByIdempotencyKey("key-1")).toEqual(charge);
    expect(await new FileChargeRepository(file).findByIdempotencyKey("key-2")).toBeUndefined();
  });

  it("shares charges between instances, as the agent and the web app do", async () => {
    const agentSide = new FileChargeRepository(file);
    const webSide = new FileChargeRepository(file);
    const charge = aCharge();
    await agentSide.save(charge);

    const paid = applyPayment(charge, aTransfer());
    await webSide.save(paid);

    expect(await agentSide.findById("C-0001")).toEqual(paid);
  });

  it("replaces a charge saved with the same id and keeps the others", async () => {
    const repository = new FileChargeRepository(file);
    const first = aCharge({ id: "C-0001" });
    const second = aCharge({ id: "C-0002" });
    await repository.save(first);
    await repository.save(second);

    const paid = applyPayment(first, aTransfer());
    await repository.save(paid);

    expect(await repository.list()).toEqual([paid, second]);
  });

  describe("with charges written by older versions or damaged by hand", () => {
    const stored = (charge: Charge) => ({
      ...charge,
      amount: { amount: charge.amount.amount.toString(), currency: charge.amount.currency },
    });

    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("reads a charge saved before charges had a creation time, as the oldest one", async () => {
      const { createdAt: _, ...legacy } = stored(aCharge({ id: "C-0001" }));
      await writeJsonFile(file, [legacy, stored(aCharge({ id: "C-0002" }))]);

      const charges = await new FileChargeRepository(file).list();

      expect(charges.map((charge) => charge.id)).toEqual(["C-0001", "C-0002"]);
      expect(charges[0]?.createdAt).toBe(UNKNOWN_CREATION_TIME);
      expect(newestFirst(charges).map((charge) => charge.id)).toEqual(["C-0002", "C-0001"]);
    });

    it("skips a damaged charge and warns, instead of failing every read", async () => {
      await writeJsonFile(file, [
        { id: "C-0001", amount: { amount: "not-a-number", currency: "wARS" } },
        stored(aCharge({ id: "C-0002" })),
      ]);

      const charges = await new FileChargeRepository(file).list();

      expect(charges.map((charge) => charge.id)).toEqual(["C-0002"]);
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it("keeps a damaged charge in the file when saving another, so nothing is lost silently", async () => {
      const damaged = { id: "C-0001", amount: { amount: "not-a-number", currency: "wARS" } };
      await writeJsonFile(file, [damaged]);

      await new FileChargeRepository(file).save(aCharge({ id: "C-0002" }));

      expect(await readJsonFile<unknown[]>(file, [])).toEqual([damaged, stored(aCharge({ id: "C-0002" }))]);
    });

    it("reads no charges from a file that is not a list, and refuses to overwrite it", async () => {
      await writeJsonFile(file, { not: "a list" });
      const repository = new FileChargeRepository(file);

      expect(await repository.list()).toEqual([]);
      await expect(repository.save(aCharge())).rejects.toThrow(/not a list/);
      expect(await readJsonFile<unknown>(file, undefined)).toEqual({ not: "a list" });
    });
  });
});

describe("FileChargeRepository", () => {
  let dir: string;

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  chargeDiscardContract("FileChargeRepository", async () => {
    dir = await mkdtemp(join(tmpdir(), "charges-"));
    return new FileChargeRepository(join(dir, "charges.json"));
  });
});
