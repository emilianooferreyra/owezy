/** The languages the app speaks. Rioplatense Spanish comes first: it is the default. */
export const LOCALES = ["es-AR", "pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es-AR";

/** The name each language has in itself, for the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { "es-AR": "Español", "pt-BR": "Português", en: "English" };

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the locale from an Accept-Language header, e.g. "pt-BR,pt;q=0.9,en;q=0.8" → "pt-BR".
 * An exact tag wins; otherwise the language alone matches ("pt-PT" → "pt-BR", "es-MX" → "es-AR").
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  const preferences = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter(({ tag, q }) => tag !== "" && tag !== "*" && Number.isFinite(q) && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of preferences) {
    const exact = LOCALES.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;
    const language = tag.split("-")[0];
    const sameLanguage = LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === language);
    if (sameLanguage) return sameLanguage;
  }
  return DEFAULT_LOCALE;
}

/** The path of a page in a locale: localePath("pt-BR", "/demo") → "/pt-BR/demo". */
export function localePath(locale: Locale, path = "/"): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** The same page in another locale: swaps the first path segment when it is a locale. */
export function switchLocale(pathname: string, locale: Locale): string {
  const [, first = "", ...rest] = pathname.split("/");
  const tail = hasLocale(first) ? rest : [first, ...rest].filter(Boolean);
  return localePath(locale, tail.length > 0 ? `/${tail.join("/")}` : "/");
}

/** Fills {placeholders} in a dictionary string: format("Hola {name}", { name: "Juan" }) → "Hola Juan". */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
