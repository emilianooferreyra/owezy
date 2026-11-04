"use client";

import { ExternalLink, LoaderCircle, LogOut, Wallet } from "lucide-react";
import { erc20Abi } from "viem";
import { celo } from "viem/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useReadContract } from "wagmi";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/core/ui/card";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { TOKENS } from "../../../core/celo/tokens";
import type { Currency } from "../../../core/money/money";
import { formatTokenBalance, shortAddress } from "../wallet-display";

const CURRENCIES = Object.keys(TOKENS) as Currency[];

/** One token's balance at the address, read from Celo mainnet: wARS for Argentina, wBRL for Brazil. */
function TokenBalance({ address, currency }: { address: `0x${string}`; currency: Currency }) {
  const copy = useI18n().dict.wallet;
  const balance = useReadContract({
    address: TOKENS[currency],
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
    chainId: celo.id,
  });

  return (
    <div className="grid gap-1">
      <p className="text-sm text-muted-foreground">{format(copy.balanceIn, { token: currency })}</p>
      <p className="text-3xl font-semibold tracking-tight">
        {balance.data === undefined ? (
          balance.isError ? (
            <span className="text-base text-destructive">{copy.balanceError}</span>
          ) : (
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label={copy.readingBalance} />
          )
        ) : (
          formatTokenBalance(balance.data, currency)
        )}
      </p>
    </div>
  );
}

/**
 * The business connects the wallet its charges arrive at, and sees its real wARS and wBRL
 * balances on Celo. Read-only: nothing is signed.
 */
export function WalletPanel() {
  const { address, isConnected } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { disconnect } = useDisconnect();
  const copy = useI18n().dict.wallet;

  if (!isConnected || !address) {
    // The modal (RainbowKit) lists the wallets and explains what a wallet is; this button opens it.
    // openConnectModal is undefined until RainbowKit is ready.
    return (
      <Button size="lg" variant="outline" className="cursor-pointer" disabled={!openConnectModal || connectModalOpen} onClick={openConnectModal}>
        {connectModalOpen ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
        {copy.connect}
      </Button>
    );
  }

  return (
    <Card size="sm" className="w-full max-w-sm text-left">
      <CardHeader>
        <CardDescription>{copy.arrivesAt}</CardDescription>
        <CardTitle className="font-mono">{shortAddress(address)}</CardTitle>
        <CardAction>
          <Badge variant="secondary">Celo</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {CURRENCIES.map((currency) => (
          <TokenBalance key={currency} address={address} currency={currency} />
        ))}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <Button asChild variant="link" size="sm" className="px-0">
          <a href={`https://celoscan.io/address/${address}`} target="_blank" rel="noreferrer">
            {copy.celoscan} <ExternalLink aria-hidden="true" />
          </a>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => disconnect()}>
          <LogOut aria-hidden="true" /> {copy.disconnect}
        </Button>
      </CardFooter>
    </Card>
  );
}
