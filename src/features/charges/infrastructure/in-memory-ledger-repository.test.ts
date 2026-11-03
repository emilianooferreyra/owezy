import { ledgerRepositoryContract } from "../testing/ledger-repository-contract";
import { InMemoryLedgerRepository } from "./in-memory-ledger-repository";

ledgerRepositoryContract("InMemoryLedgerRepository", async () => new InMemoryLedgerRepository());
