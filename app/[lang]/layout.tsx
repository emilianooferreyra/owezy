import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getDictionary, hasLocale, LOCALES } from "@/core/i18n";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { LanguageSwitcher } from "@/core/i18n/language-switcher";
import { cn } from "@/core/lib/utils";
import "../globals.css";

// DM Sans comes from the shadcn preset; Geist Mono is for references and operation numbers.
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

// Only the three locales exist: /fr renders the 404 instead of a page in no language.
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return {
    title: { template: "%s · Owezy", default: "Owezy" },
    description: getDictionary(lang).meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((locale) => [locale, `/${locale}`])) },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html lang={lang} className={cn(dmSans.variable, geistMono.variable, "font-sans")}>
      <body>
        <I18nProvider locale={lang}>
          <LanguageSwitcher className="fixed top-3 right-3 z-50" />
          {children as ReactNode}
        </I18nProvider>
      </body>
    </html>
  );
}
