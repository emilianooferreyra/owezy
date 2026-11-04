"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { useI18n } from "@/core/i18n/i18n-provider";
import type { Receipt } from "./charge-card-model";
import { SuccessCheck } from "./success-check";

const ROWS = ["description", "customer", "reference", "paidAt", "method", "operation"] as const satisfies readonly (keyof Receipt)[];

/**
 * A payment receipt, without a frame of its own so it fits a card or a dialog.
 * In test mode it carries a "Prueba" badge, as test objects do in Stripe.
 */
export function ReceiptView({ receipt }: { receipt: Receipt }) {
  const copy = useI18n().dict.receipt;
  return (
    <article aria-label={copy.label} className="grid gap-5">
      <header className="grid justify-items-center gap-1.5 text-center">
        <SuccessCheck />
        <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {copy.received}
          {receipt.simulated && (
            <Badge className="bg-test-muted uppercase tracking-wide text-test-foreground">{copy.test}</Badge>
          )}
        </p>
        <p className="text-3xl font-semibold tracking-tight">{receipt.amount}</p>
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 border-t border-dashed pt-4 text-sm">
        {ROWS.map((field) => (
          <div key={field} className="contents">
            <dt className="text-muted-foreground">{copy.rows[field]}</dt>
            <dd
              className={
                field === "operation" ? "text-right font-mono text-xs break-all" : "text-right font-medium break-words"
              }
            >
              {String(receipt[field])}
            </dd>
          </div>
        ))}
      </dl>
      {receipt.explorerUrl && (
        <Button asChild variant="outline" size="sm" className="justify-self-center">
          <a href={receipt.explorerUrl} target="_blank" rel="noreferrer">
            {copy.explorer} <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      )}
    </article>
  );
}
