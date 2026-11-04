"use client";

import { Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { useI18n } from "@/core/i18n/i18n-provider";
import { Button } from "@/core/ui/button";

/** Same size and label as the real connect button, so nothing moves when the panel arrives. */
function ConnectPlaceholder() {
  const copy = useI18n().dict.wallet;
  return (
    <Button size="lg" variant="outline" disabled>
      <Wallet aria-hidden="true" />
      {copy.connect}
    </Button>
  );
}

// wagmi, viem and react-query travel in their own chunk, fetched after the page is interactive.
// The dynamic import lives in a Client Component: Next.js only code-splits it from one.
// ssr: false, since a wallet only exists in the browser.
const WalletWidget = dynamic(() => import("./wallet-widget").then((module) => module.WalletWidget), {
  ssr: false,
  loading: ConnectPlaceholder,
});

/** The wallet in the demo, under the country switch: connect and see the real wARS and wBRL balances on Celo, without slowing the page down. */
export function WalletSection() {
  const { locale, dict } = useI18n();
  // Written out in full: Next.js inlines NEXT_PUBLIC_ variables at build time only on literal access.
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    // Without it mobile wallets cannot connect; say so, and skip downloading the wallet code.
    return <p className="text-sm text-muted-foreground">{dict.wallet.notConfigured}</p>;
  }
  return <WalletWidget projectId={projectId} locale={locale} />;
}
