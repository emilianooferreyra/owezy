import { chargeDiscardContract } from "../testing/charge-repository-discard-contract";
import { InMemoryChargeRepository } from "./in-memory-charge-repository";

chargeDiscardContract("InMemoryChargeRepository", async () => new InMemoryChargeRepository());
