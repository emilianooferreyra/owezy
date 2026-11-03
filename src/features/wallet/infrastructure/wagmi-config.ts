import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, valoraWallet } from "@rainbow-me/rainbowkit/wallets";
import { celo } from "viem/chains";
import { createConfig, http } from "wagmi";

/**
 * Read-only wallet setup on Celo: the business connects the wallet its charges arrive at. Browser
 * wallets (MiniPay inside Opera included) connect directly; mobile ones (Valora) through
 * WalletConnect, which needs the project id. Reads go through Celo's public RPC (forno), so the
 * wallet never has to switch networks or sign anything.
 */
export function createWalletConfig(projectId: string) {
  const connectors = connectorsForWallets(
    [{ groupName: "Billeteras", wallets: [injectedWallet, metaMaskWallet, valoraWallet] }],
    { appName: "Owezy", projectId },
  );

  return createConfig({
    chains: [celo],
    connectors,
    transports: { [celo.id]: http() },
    ssr: true,
  });
}
