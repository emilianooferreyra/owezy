import type { Address } from "viem";
import { TOKENS } from "./tokens";

/**
 * Ripio's wARS on Celo mainnet. Verified on-chain on 2026-10-18 through forno.celo.org:
 * symbol() = "wARS", decimals() = 18, EIP-1967 proxy (docs/verifications.md).
 */
export const WARS_TOKEN: Address = TOKENS.wARS;
