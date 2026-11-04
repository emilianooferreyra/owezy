"use client";

import { ChevronDown, ExternalLink, LoaderCircle, LogOut, Wallet } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { erc20Abi } from "viem";
import { celo } from "viem/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMutationState } from "@tanstack/react-query";
import { useAccount, useDisconnect, useReadContract } from "wagmi";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { useDismiss } from "@/core/ui/use-dismiss";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/core/ui/card";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { TOKENS } from "../../../core/celo/tokens";
import type { Currency } from "../../../core/money/money";
import { formatTokenBalance, isPendingWalletRequest, shortAddress } from "../wallet-display";

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
 * balances on Celo. Read-only: nothing is signed. It lives in the demo's header, so once connected
 * it is only the short address; the card with the balances opens from it, like the bell's panel.
 */
export function WalletPanel() {
  const { address, isConnected } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { disconnect } = useDisconnect();
  const copy = useI18n().dict.wallet;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, box);
  // RainbowKit's modal connects through wagmi's "connect" mutation; the newest attempt says why it failed.
  const connectErrors = useMutationState({ filters: { mutationKey: ["connect"] }, select: (mutation) => mutation.state.error });
  const waitingInWallet = isPendingWalletRequest(connectErrors.at(-1));

  if (!isConnected || !address) {
    // The modal (RainbowKit) lists the wallets and explains what a wallet is; this button opens it.
    // openConnectModal is undefined until RainbowKit is ready.
    return (
      <div className="relative">
        <Button size="sm" variant="outline" className="cursor-pointer" disabled={!openConnectModal || connectModalOpen} onClick={openConnectModal}>
          {connectModalOpen ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
          {copy.connect}
        </Button>
        {/* MetaMask refuses a new request while an older one waits: the owner has to answer it there. */}
        {waitingInWallet && (
          <p
            role="alert"
            className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl bg-highlight px-3 py-2 text-xs font-medium text-highlight-foreground shadow-lg"
          >
            {copy.pendingRequest}
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="cursor-pointer font-mono"
      >
        <Wallet aria-hidden="true" /> {shortAddress(address)} <ChevronDown aria-hidden="true" />
      </Button>
      {open && (
    <Card size="sm" className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] text-left shadow-lg">
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
      )}
    </div>
  );
}
