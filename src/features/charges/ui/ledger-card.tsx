"use client";

import { BookOpen, Check, NotebookPen, Send, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/core/lib/utils";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { formatArs } from "../../../core/money/money";
import type { LedgerEntryView, LedgerView } from "../charges-feature";
import { customerState } from "./ledger-model";

const CARD = "w-full max-w-md rounded-3xl bg-card shadow-sm ring-1 ring-foreground/5";

/** What a customer still owes for: the entries not paid yet, in a few words. */
function owedFor(entries: readonly LedgerEntryView[]): string {
  return entries
    .filter(({ status }) => status !== "paid")
    .map(({ description }) => description)
    .join(" · ");
}

/**
 * The shop's ledger as the agent shows it: who owes what, and a button to charge each customer
 * who has something without a payment link. Buttons send the same message the owner would type.
 */
export function LedgerCard({
  ledger,
  onCharge,
  disabled = false,
}: {
  ledger: LedgerView;
  onCharge: (customer: string) => void;
  disabled?: boolean;
}) {
  return (
    <motion.section
      aria-label="Libreta"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(CARD, "grid gap-1 p-2")}
    >
      <header className="flex items-center justify-between px-3 pb-1 pt-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" aria-hidden="true" /> Libreta
        </h3>
        <span className="text-sm text-muted-foreground">
          Total <span className="font-semibold tabular-nums text-foreground">{formatArs(ledger.totalOwed)}</span>
        </span>
      </header>
      {ledger.customers.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted-foreground">Todavía no anotaste nada.</p>
      ) : (
        <ul className="grid">
          {ledger.customers.map((customer) => {
            const state = customerState(customer);
            return (
              <li
                key={customer.customer}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5",
                  state === "up-to-date" && "opacity-60",
                )}
              >
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary">
                  <UserRound className="size-4" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{customer.customer}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {owedFor(customer.entries) || "Pagó todo"}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatArs(customer.owed)}</span>
                {state === "to-charge" && (
                  <Button
                    type="button"
                    size="xs"
                    disabled={disabled}
                    onClick={() => onCharge(customer.customer)}
                    aria-label={`Cobrar a ${customer.customer}`}
                    className="cursor-pointer"
                  >
                    <Send aria-hidden="true" /> Cobrar
                  </Button>
                )}
                {state === "link-sent" && <Badge variant="secondary">Link enviado</Badge>}
                {state === "up-to-date" && (
                  <Badge variant="outline">
                    <Check aria-hidden="true" /> Al día
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}

/** A purchase the agent just wrote down. */
export function LedgerNote({ entry }: { entry: LedgerEntryView }) {
  return (
    <motion.p
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(CARD, "flex items-center gap-3 px-4 py-3 text-sm")}
    >
      <NotebookPen className="size-4 shrink-0 text-success" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Anotado: <span className="font-medium">{entry.customer}</span> · {entry.description}
      </span>
      <span className="font-semibold tabular-nums">{formatArs(entry.amount)}</span>
    </motion.p>
  );
}

/** The customers a name could be: the owner taps the right one instead of typing it. */
export function CustomerChoice({
  candidates,
  onChoose,
  disabled = false,
}: {
  candidates: readonly string[];
  onChoose: (customer: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="¿Cuál cliente?" className="flex flex-wrap gap-2">
      {candidates.map((candidate) => (
        <Button
          key={candidate}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChoose(candidate)}
          className="cursor-pointer rounded-full"
        >
          <UserRound aria-hidden="true" /> {candidate}
        </Button>
      ))}
    </div>
  );
}
