import type { Locale } from "../../../core/i18n";
import { type Currency, DEFAULT_CURRENCY, isCurrency } from "../../../core/money/money";

export type Country = "AR" | "BR";

/** The demo's shop: who owns it, where it is, and the token it charges in. */
export type Shop = Readonly<{ country: Country; currency: Currency; name: string; owner: string; flag: string }>;

// Shop names stay in their own language whatever the visitor reads: Ana's shop is in Buenos Aires, Bia's in São Paulo.
export const AR: Shop = { country: "AR", currency: "wARS", name: "Panadería de Ana", owner: "Ana", flag: "🇦🇷" };
export const BR: Shop = { country: "BR", currency: "wBRL", name: "Padaria da Bia", owner: "Bia", flag: "🇧🇷" };

/** Every shop the demo can show, in the order the country switch lists them. */
export const SHOPS: readonly Shop[] = [AR, BR];

const TIME_ZONES: Record<Country, string> = {
  AR: "America/Argentina/Buenos_Aires",
  BR: "America/Sao_Paulo",
};

/**
 * The shop a demo opens with: `?country=AR|BR` wins, so a link can show either country;
 * otherwise a Portuguese visitor gets the Brazilian shop and everyone else the Argentine one.
 */
export function shopFor(locale: Locale, country?: string | string[]): Shop {
  const wanted = (Array.isArray(country) ? country[0] : country)?.toUpperCase();
  return SHOPS.find((shop) => shop.country === wanted) ?? (locale === "pt-BR" ? BR : AR);
}

/**
 * A view's currency as the app knows it. Views carry it as a plain string (it crossed the
 * network); anything unknown reads as the default rather than breaking the screen.
 */
export function currencyOf(value: string): Currency {
  return isCurrency(value) ? value : DEFAULT_CURRENCY;
}

/** The shop that charges in a currency: where its customers live, and so their clock and phone numbers. */
export function shopOfCurrency(currency: string): Shop {
  const wanted = currencyOf(currency);
  return SHOPS.find((shop) => shop.currency === wanted) ?? AR;
}

/** The time zone a payment in this currency is read in: the shop's own. */
export function timeZoneOf(currency: string): string {
  return TIME_ZONES[shopOfCurrency(currency).country];
}

/**
 * What every demo turn tells the agent about the page: which shop is talking and in which
 * language to answer. eve passes it to the model for that turn only.
 */
export function shopContext(shop: Shop, language: Locale) {
  const { country, currency, name, owner } = shop;
  return { shop: { country, currency, name, owner }, language };
}
