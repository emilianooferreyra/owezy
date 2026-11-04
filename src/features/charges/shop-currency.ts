import { z } from "zod";
import { DEFAULT_CURRENCY } from "../../core/money/money";

/**
 * The currency every agent tool takes: the shop's country decides it, and the demo sends it in
 * each turn's context (shop.currency). Tools cannot read that context, so the model passes it on.
 */
export const shopCurrency = z
  .enum(["wARS", "wBRL"])
  .default(DEFAULT_CURRENCY)
  .describe("The shop's currency, from the turn context (shop.currency): wARS for Argentina, wBRL for Brazil.");
