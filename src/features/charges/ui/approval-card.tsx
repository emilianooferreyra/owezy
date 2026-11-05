"use client";

import { Check, X } from "lucide-react";
import { z } from "zod";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { Button } from "@/core/ui/button";
import { type Currency, DEFAULT_CURRENCY, formatMoney, isCurrency } from "../../../core/money/money";

/** What the card needs from an eve tool-approval request: the call it gates and its answers. */
export type ApprovalRequest = Readonly<{
  requestId: string;
  /** eve's own text, shown when the card does not know the tool. */
  prompt: string;
  options?: readonly Readonly<{ id: string; label: string }>[] | undefined;
  action: Readonly<{ toolName: string; input: unknown }>;
}>;

const DECIMAL = /^\d+(\.\d+)?$/;
// The input comes from the model: read only what the copy needs, and fall back when it does not fit.
const PURCHASE = z.object({
  customer: z.string(),
  description: z.string(),
  amount: z.string().regex(DECIMAL),
  currency: z.custom<Currency>((value) => typeof value === "string" && isCurrency(value)).optional(),
});
const CUSTOMER = z.object({ customer: z.string() });

/**
 * Asks the owner before the agent writes a charge or a ledger entry. The pause is enforced by eve
 * (the tool's `approval: always()`), not by the model: the call does not run until a person taps
 * Confirm, and the card says exactly what will run, from the call's own input.
 */
export function ApprovalCard({
  request,
  onRespond,
  disabled = false,
}: {
  request: ApprovalRequest;
  onRespond: (requestId: string, optionId: string) => void;
  disabled?: boolean;
}) {
  const copy = useI18n().dict.demo.approval;
  const labels: Record<string, string> = { approve: copy.approve, cancel: copy.cancel };

  return (
    <div role="group" aria-label={copy.label} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
      <p>{question(request, copy)}</p>
      <div className="flex flex-wrap gap-2">
        {(request.options ?? []).map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={option.id === "approve" ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onRespond(request.requestId, option.id)}
            className="cursor-pointer rounded-full"
          >
            {option.id === "approve" ? <Check aria-hidden="true" /> : option.id === "cancel" ? <X aria-hidden="true" /> : null}
            {labels[option.id] ?? option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function question(request: ApprovalRequest, copy: ReturnType<typeof useI18n>["dict"]["demo"]["approval"]): string {
  const { toolName, input } = request.action;
  if (toolName === "create_charge" || toolName === "add_to_ledger") {
    const parsed = PURCHASE.safeParse(input);
    if (!parsed.success) return request.prompt;
    const { customer, description, amount, currency } = parsed.data;
    return format(copy[toolName], { customer, description, amount: formatMoney(amount, currency ?? DEFAULT_CURRENCY) });
  }
  if (toolName === "charge_from_ledger") {
    const parsed = CUSTOMER.safeParse(input);
    return parsed.success ? format(copy.charge_from_ledger, { customer: parsed.data.customer }) : request.prompt;
  }
  return request.prompt;
}
