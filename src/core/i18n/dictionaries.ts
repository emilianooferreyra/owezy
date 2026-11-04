import { en } from "./dictionaries/en";
import { type Dictionary, esAR } from "./dictionaries/es-AR";
import { ptBR } from "./dictionaries/pt-BR";
import type { Locale } from "./locales";

export type { Dictionary } from "./dictionaries/es-AR";

const DICTIONARIES: Record<Locale, Dictionary> = { "es-AR": esAR, "pt-BR": ptBR, en };

/** The copy for a locale. Plain data, so a Server Component can hand it to a Client Component. */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
