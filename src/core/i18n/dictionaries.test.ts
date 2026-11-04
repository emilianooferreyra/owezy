import { describe, expect, it } from "vitest";
import { getDictionary } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALES } from "./locales";

/** Every path to a string, with array items by index: "landing.steps.0.title". */
function shape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => shape(item, `${path}.${index}`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => shape(item, path ? `${path}.${key}` : key));
  }
  return [path];
}

/** Every string in a dictionary. */
function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(strings);
  return typeof value === "string" ? [value] : [];
}

describe("dictionaries", () => {
  const reference = shape(getDictionary(DEFAULT_LOCALE)).sort();

  it.each(LOCALES)("%s has exactly the keys and list lengths of the default locale", (locale) => {
    expect(shape(getDictionary(locale)).sort()).toEqual(reference);
  });

  it.each(LOCALES)("%s has no empty copy", (locale) => {
    expect(strings(getDictionary(locale)).filter((text) => text.trim() === "")).toEqual([]);
  });

  it("is actually translated: pt-BR and en do not repeat the Spanish copy", () => {
    expect(getDictionary("pt-BR").landing.tagline).not.toBe(getDictionary("es-AR").landing.tagline);
    expect(getDictionary("en").landing.tagline).toBe("They owe, you get paid.");
  });
});
