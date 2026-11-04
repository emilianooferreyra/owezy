import type { Metadata } from "next";
import { getDictionary, hasLocale } from "@/core/i18n";
import { DemoScreen } from "./demo";

export async function generateMetadata({ params }: PageProps<"/[lang]/demo">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return { title: meta.demoTitle, description: meta.demoDescription };
}

// A Server Component, so the page can export metadata; the interactive demo is the client part.
export default function DemoPage() {
  return <DemoScreen />;
}
