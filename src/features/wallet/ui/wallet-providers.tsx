"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { lightTheme, type Locale as RainbowKitLocale, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { getDictionary, type Locale } from "@/core/i18n";
import { createWalletConfig } from "../infrastructure/wagmi-config";

// The preset's primary color (oklch(0.205 0 0)), so the modal matches the app's buttons.
const theme = lightTheme({ accentColor: "#171717", accentColorForeground: "#fafafa", borderRadius: "large" });
// RainbowKit's default "learn more" page (learn.rainbow.me/understanding-web3) answers 404,
// so it points to ethereum.org's wallet page in the visitor's language.
const LEARN_MORE: Record<Locale, string> = {
  "es-AR": "https://ethereum.org/es/wallets/",
  "pt-BR": "https://ethereum.org/pt-br/wallets/",
  en: "https://ethereum.org/en/wallets/",
};
// The modal's own copy: RainbowKit has no Rioplatense Spanish, Latin American Spanish is the closest.
const MODAL_LOCALE: Record<Locale, RainbowKitLocale> = { "es-AR": "es-419", "pt-BR": "pt-BR", en: "en-US" };

/** wagmi, its query cache and RainbowKit's modal, created once per browser session. */
export function WalletProviders({
  projectId,
  locale,
  children,
}: {
  projectId: string;
  locale: Locale;
  children: ReactNode;
}) {
  const [config] = useState(() => createWalletConfig(projectId, getDictionary(locale).wallet.group));
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} appInfo={{ learnMoreUrl: LEARN_MORE[locale] }} locale={MODAL_LOCALE[locale]}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
