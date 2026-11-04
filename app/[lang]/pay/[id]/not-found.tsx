"use client";

import { useI18n } from "@/core/i18n/i18n-provider";

/**
 * A payment link that leads nowhere: mistyped, or from a charge that no longer exists. The
 * payer is the business's customer, so it points them back to the business, not to our home.
 */
export default function PayNotFound() {
  const { dict } = useI18n();

  return (
    <main className="grid min-h-[80dvh] place-items-center p-4">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.payNotFound.title}</h1>
        <p className="text-muted-foreground">{dict.payNotFound.body}</p>
      </div>
    </main>
  );
}
