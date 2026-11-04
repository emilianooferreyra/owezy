"use client";

import { useEveAgent } from "eve/react";
import { ArrowLeft, ArrowUp, Bot, LoaderCircle, Smartphone, Store } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { format, localePath } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { LanguageSwitcher } from "@/core/i18n/language-switcher";
import { cn } from "@/core/lib/utils";
import { Button } from "@/core/ui/button";
import { InlineMarkdown } from "@/core/ui/inline-markdown";
import { Input } from "@/core/ui/input";
import { WalletSection } from "@/features/wallet/ui";
import {
  AR,
  ActivityPanel,
  CustomerChoice,
  candidatesFromPart,
  ChargeCard,
  chargeFromPart,
  chargeRequest,
  DemoProvider,
  greetingFor,
  LedgerCard,
  LedgerNote,
  lastLedgerReadIndex,
  ledgerFromPart,
  noteFromPart,
  PayerPhone,
  SHOPS,
  type Shop,
  shopContext,
  useDemo,
  useLedger,
} from "@/features/charges/ui";

/**
 * Both sides of the demo for one shop: the owner's chat with the agent and the customer's phone.
 * The page keys it by country, so switching shop mounts a new one: a new eve session (the hook
 * keeps its session in the component), a new ledger and new charges, never the other country's.
 */
export function DemoScreen({ shop = AR }: { shop?: Shop }) {
  return (
    <DemoProvider>
      <Demo shop={shop} />
    </DemoProvider>
  );
}

const TABS = [
  { id: "business", icon: Store },
  { id: "customer", icon: Smartphone },
] as const;

function Demo({ shop }: { shop: Shop }) {
  const { state, dispatch } = useDemo();
  const copy = useI18n().dict.demo;
  const unread = state.sent.filter((id) => state.charges[id]?.status === "pending").length;

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_28rem] lg:grid-rows-1">
      <nav
        aria-label={copy.sides}
        className="sticky top-0 z-20 grid grid-cols-2 gap-1 border-b bg-background/80 p-2 backdrop-blur lg:hidden"
      >
        {TABS.map(({ id, icon: Icon }) => {
          const active = state.tab === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => dispatch({ type: "tab-selected", tab: id })}
              className={cn(
                "relative inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-foreground/5"
                />
              )}
              <span className="relative inline-flex items-center gap-2">
                <Icon className="size-4" aria-hidden="true" />
                {copy[id]}
                {id === "customer" && unread > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground">
                    {unread}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <section aria-label={copy.business} className={cn("min-w-0", state.tab !== "business" && "max-lg:hidden")}>
        <OwnerChat shop={shop} />
      </section>

      <section
        aria-label={copy.customer}
        className={cn(
          "grid content-start gap-3 px-4 py-5 lg:sticky lg:top-0 lg:h-dvh lg:content-center lg:border-l lg:bg-card/50",
          state.tab !== "customer" && "max-lg:hidden",
        )}
      >
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.customerPhone}
        </p>
        <PayerPhone businessName={shop.name} />
      </section>
    </div>
  );
}

const BUBBLE = "max-w-[85%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5";
const AGENT_BUBBLE = "rounded-bl-lg bg-card shadow-sm ring-1 ring-foreground/5";

/**
 * The agent's first message, written from the shop's ledger: who owes what today, with a button
 * to charge each customer. It costs no tokens, and it changes with the business.
 */
function Greeting({
  shop,
  version,
  onCharge,
  disabled,
}: {
  shop: Shop;
  version: number;
  onCharge: (customer: string) => void;
  disabled: boolean;
}) {
  const { locale, dict } = useI18n();
  const ledger = useLedger(version, shop.currency);
  const line =
    ledger.kind === "ready"
      ? greetingFor(ledger.ledger, shop, locale)
      : format(ledger.kind === "failed" ? dict.demo.greetingFailed : dict.demo.greetingLoading, { owner: shop.owner });

  return (
    <div role="note" aria-label={dict.demo.greetingLabel} className="flex flex-col items-start gap-2">
      <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn(BUBBLE, AGENT_BUBBLE)}>
        {line}
      </motion.p>
      {ledger.kind === "ready" && ledger.ledger.customers.length > 0 && (
        <LedgerCard ledger={ledger.ledger} currency={shop.currency} onCharge={onCharge} disabled={disabled} />
      )}
    </div>
  );
}

/**
 * Argentina or Brazil. Each is a link to the same page with ?country=, so the choice can be
 * shared, and the page mounts a fresh demo for it instead of mixing two shops in one chat.
 */
function CountrySwitch({ shop }: { shop: Shop }) {
  const { locale, dict } = useI18n();
  return (
    <div role="group" aria-label={dict.demo.country} className="inline-flex rounded-full bg-secondary p-0.5">
      {SHOPS.map((option) => {
        const current = option.country === shop.country;
        return (
          <Link
            key={option.country}
            href={`${localePath(locale, "/demo")}?country=${option.country}`}
            aria-current={current ? "true" : undefined}
            replace
            scroll={false}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors",
              current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden="true">{option.flag}</span> {dict.demo.countries[option.country]}
          </Link>
        );
      })}
    </div>
  );
}

/** What the agent reconciled on its own, one tap away in the header instead of above the chat. */
function ActivityToggle({ shop }: { shop: Shop }) {
  const [open, setOpen] = useState(false);
  const copy = useI18n().dict.demo;
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="cursor-pointer"
      >
        <Bot aria-hidden="true" /> {copy.activity}
      </Button>
      {open && <ActivityPanel currency={shop.currency} className="absolute right-0 top-full z-30 mt-2 w-80" />}
    </div>
  );
}

const LEDGER_TOOLS = new Set(["add_to_ledger", "charge_from_ledger"]);

function OwnerChat({ shop }: { shop: Shop }) {
  const { locale, dict } = useI18n();
  const copy = dict.demo;
  // Every turn tells the agent which shop is talking and the page's language: the tools then
  // charge in the shop's currency and the agent answers in the visitor's language.
  const agent = useEveAgent({ prepareSend: (input) => ({ ...input, clientContext: shopContext(shop, locale) }) });
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isResuming = agent.status === "resuming";
  const bottom = useRef<HTMLDivElement>(null);

  // Every finished write to the ledger reads it again, so the greeting's card stays current.
  const parts = agent.data.messages.flatMap((message) => message.parts);
  const ledgerWrites = parts.filter(
    (part) => part.type === "dynamic-tool" && LEDGER_TOOLS.has(part.toolName) && part.state === "output-available",
  ).length;
  const lastText = parts.at(-1)?.type === "text" ? (parts.at(-1) as { text: string }).text.length : 0;

  // Keep the newest message in view as it streams in.
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [parts.length, lastText, isBusy]);

  function say(message: string) {
    if (isResuming) {
      return;
    }
    void agent.send(message, isBusy ? { turnPolicy: "steer" } : undefined);
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get("message") ?? "").trim();
    if (message.length === 0) {
      return;
    }
    say(message);
    form.reset();
  }

  const charge = (customer: string) => say(chargeRequest(customer, locale));

  return (
    <div className="mx-auto grid min-h-full max-w-2xl grid-rows-[auto_1fr_auto] px-4">
      <header className="flex flex-wrap items-center gap-3 border-b py-5">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {shop.name.charAt(0)}
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">{shop.name}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle[shop.country]}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher className="mr-1" />
          <ActivityToggle shop={shop} />
          <Button asChild variant="ghost" size="sm">
            <Link href={localePath(locale, "/")}>
              <ArrowLeft aria-hidden="true" /> {copy.home}
            </Link>
          </Button>
        </div>
        <CountrySwitch shop={shop} />
        {/* Where the shop's payments arrive: connect the wallet, read-only, to see its balance. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{dict.wallet.where}</span>
          <WalletSection />
        </div>
      </header>

      <div aria-live="polite" className="flex flex-col gap-4 py-5">
        <Greeting shop={shop} version={ledgerWrites} onCharge={charge} disabled={isBusy || isResuming} />
        {agent.data.messages.map((message) => {
          const newestLedger = lastLedgerReadIndex(message.parts);
          return (
          <div
            key={message.id}
            className={cn("flex flex-col gap-2", message.role === "user" ? "items-end" : "items-start")}
          >
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <motion.p
                    key={part.id ?? index}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      BUBBLE,
                      message.role === "user" ? "rounded-br-lg bg-primary text-primary-foreground" : AGENT_BUBBLE,
                    )}
                  >
                    {message.role === "user" ? part.text : <InlineMarkdown text={part.text} />}
                  </motion.p>
                );
              }
              if (part.type !== "dynamic-tool") {
                return null;
              }
              const created = chargeFromPart(part);
              if (created) {
                return <ChargeCard key={part.toolCallId} charge={created} />;
              }
              const ledger = ledgerFromPart(part);
              if (ledger) {
                // An older read of the same answer: the newest card below already shows it.
                if (index !== newestLedger) return null;
                return <LedgerCard key={part.toolCallId} ledger={ledger} currency={shop.currency} onCharge={charge} disabled={isBusy || isResuming} />;
              }
              const note = noteFromPart(part);
              if (note) {
                return <LedgerNote key={part.toolCallId} entry={note} />;
              }
              const candidates = candidatesFromPart(part);
              if (candidates) {
                return <CustomerChoice key={part.toolCallId} candidates={candidates} onChoose={say} disabled={isBusy || isResuming} />;
              }
              if (part.state === "output-error") {
                return (
                  <p key={part.toolCallId} className="text-sm text-destructive">
                    {format(copy.toolError, { error: part.errorText })}
                  </p>
                );
              }
              return null;
            })}
          </div>
          );
        })}
        {isBusy && (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> {copy.thinking}
          </p>
        )}
        {agent.error && <p className="text-sm text-destructive">{agent.error.message}</p>}
        <div ref={bottom} className="h-2 shrink-0" aria-hidden="true" />
      </div>

      <div className="sticky bottom-0 bg-background/80 pb-4 pt-3 backdrop-blur">
        <form onSubmit={send} className="flex gap-2">
          <Input
            name="message"
            aria-label={copy.message}
            placeholder={copy.placeholder[shop.country]}
            autoComplete="off"
            disabled={isResuming}
            className="h-11 flex-1 px-4"
          />
          <Button type="submit" size="icon-lg" disabled={isResuming} aria-label={copy.send} className="size-11">
            <ArrowUp aria-hidden="true" />
          </Button>
        </form>
      </div>
    </div>
  );
}
