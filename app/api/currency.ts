import { type Currency, DEFAULT_CURRENCY, isCurrency } from "@/core/money/money";

/**
 * The shop's currency from `?currency=`, wARS when it is missing. Undefined when the value is not
 * a currency the app knows, so the route answers 400 instead of showing another country's data.
 */
export function currencyFrom(request: Request): Currency | undefined {
  const value = new URL(request.url).searchParams.get("currency");
  if (value === null || value === "") return DEFAULT_CURRENCY;
  return isCurrency(value) ? value : undefined;
}

export const UNKNOWN_CURRENCY = () => Response.json({ error: "unknown-currency" }, { status: 400 });
