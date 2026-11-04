"use client";

import type { Locale } from "@/core/i18n";
import { WalletPanel } from "./wallet-panel";
import { WalletProviders } from "./wallet-providers";

/** The wallet panel with wagmi and RainbowKit around it: the heavy part, loaded on its own by WalletSection. */
export function WalletWidget({ projectId, locale }: { projectId: string; locale: Locale }) {
  return (
    <WalletProviders projectId={projectId} locale={locale}>
      <WalletPanel />
    </WalletProviders>
  );
}
