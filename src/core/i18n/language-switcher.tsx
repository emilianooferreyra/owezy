"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/core/lib/utils";
import { useI18n } from "./i18n-provider";
import { LOCALE_NAMES, LOCALES, switchLocale } from "./locales";

const SHORT: Record<(typeof LOCALES)[number], string> = { "es-AR": "ES", "pt-BR": "PT", en: "EN" };

/** Links to the same page in each language. The current one is marked, not linked. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label={dict.common.language} className={cn("flex gap-1 rounded-full bg-card p-1 text-xs shadow-sm ring-1 ring-foreground/5", className)}>
      {LOCALES.map((option) =>
        option === locale ? (
          <span key={option} aria-current="true" title={LOCALE_NAMES[option]} className="rounded-full bg-primary px-2.5 py-1 font-semibold text-primary-foreground">
            {SHORT[option]}
          </span>
        ) : (
          <Link
            key={option}
            href={switchLocale(pathname, option)}
            hrefLang={option}
            lang={option}
            title={LOCALE_NAMES[option]}
            aria-label={LOCALE_NAMES[option]}
            className="rounded-full px-2.5 py-1 font-medium text-muted-foreground hover:text-foreground"
          >
            {SHORT[option]}
          </Link>
        ),
      )}
    </nav>
  );
}
