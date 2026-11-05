import type { ChargeRepository } from "../application/ports";
import type { Charge } from "../domain/charge";

/** Keeps charges in process memory. A test double: the app uses FileChargeRepository. */
export class InMemoryChargeRepository implements ChargeRepository {
  readonly #charges = new Map<string, Charge>();

  async findById(id: string): Promise<Charge | undefined> {
    return this.#charges.get(id);
  }

  async findByIdempotencyKey(key: string): Promise<Charge | undefined> {
    return [...this.#charges.values()].find((charge) => charge.idempotencyKey === key);
  }

  async list(): Promise<readonly Charge[]> {
    return [...this.#charges.values()];
  }

  async discard(charge: Charge): Promise<void> {
    const saved = this.#charges.get(charge.id);
    if (saved?.status === "pending" && saved.idempotencyKey === charge.idempotencyKey) {
      this.#charges.delete(charge.id);
    }
  }

  async save(charge: Charge): Promise<void> {
    this.#charges.set(charge.id, charge);
  }
}
