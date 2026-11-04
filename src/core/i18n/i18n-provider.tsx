"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type Dictionary, getDictionary } from "./dictionaries";
import { DEFAULT_LOCALE, type Locale } from "./locales";

type I18n = { locale: Locale; dict: Dictionary };

// Without a provider (a component rendered on its own, as in tests) the default locale applies.
const I18nContext = createContext<I18n>({ locale: DEFAULT_LOCALE, dict: getDictionary(DEFAULT_LOCALE) });

/** Gives Client Components the page's locale. The layout passes only the locale: each bundle has the copy. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict: getDictionary(locale) }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
