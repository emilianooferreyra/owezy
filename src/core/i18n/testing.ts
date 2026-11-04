import type { Locale } from "./locales";

/** The props Next.js gives a page under /[lang], for rendering a Server Component in a test. */
export function pageProps<P extends Record<string, string>>(lang: Locale, params?: P) {
  return {
    params: Promise.resolve({ lang, ...params } as { lang: string } & P),
    searchParams: Promise.resolve({}),
  };
}
