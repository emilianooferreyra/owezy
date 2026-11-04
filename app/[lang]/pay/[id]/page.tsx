import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/core/i18n";
import { chargesRuntime } from "@/features/charges";
import { LanguageSwitcher } from "@/core/i18n/language-switcher";
import { SimulatedCheckout } from "@/features/charges/ui";

// A payment link carries a customer's charge: it must never show up in search results.
const ROBOTS = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<"/[lang]/pay/[id]">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).meta.payTitle : undefined, robots: ROBOTS };
}

/** The payer's side of a simulated charge. In ripio mode payers go to the real ramp instead. */
export default async function PayPage({ params }: PageProps<"/[lang]/pay/[id]">) {
  const { id } = await params;
  const { config, feature } = chargesRuntime();
  const charge = config.mode === "simulated" ? await feature.getCharge(id) : undefined;

  if (!charge) {
    notFound();
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <LanguageSwitcher className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        <SimulatedCheckout charge={charge} />
      </div>
    </main>
  );
}
