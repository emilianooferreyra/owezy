import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/core/i18n";
import { shopFor } from "@/features/charges/ui/shops";
import { DemoScreen } from "./demo";

export async function generateMetadata({ params }: PageProps<"/[lang]/demo">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return { title: meta.demoTitle, description: meta.demoDescription };
}

/**
 * A Server Component, so the page can export metadata; the interactive demo is the client part.
 * The shop comes from ?country= or the locale. Keyed by country: switching shop remounts the
 * demo, which starts a new agent session instead of continuing the other country's chat.
 */
export default async function DemoPage({ params, searchParams }: PageProps<"/[lang]/demo">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { country } = await searchParams;
  const shop = shopFor(lang, country);
  return <DemoScreen key={shop.country} shop={shop} />;
}
